import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  appendHermesEvent,
  buildHermesEvent,
  initEventLog,
  queryHermesEvents,
  readHermesEvents,
  redactEventSecrets,
  tailHermesEvents,
  type EventLogOptions,
  type HermesEventInput
} from "../event-log.ts";

const tempRoot = path.resolve("./_ai_work/scratch/event-log-tests");
const logPath = path.join(tempRoot, "logs/events/hermes-events.jsonl");
const errorLogPath = path.join(tempRoot, "logs/events/event-log-errors.jsonl");

function options(): EventLogOptions {
  return {
    hermesRoot: tempRoot,
    logPath,
    errorLogPath,
    now: () => new Date("2026-06-24T09:00:00.000Z"),
    uuid: () => "00000000-0000-4000-8000-000000000001"
  };
}

function baseEvent(overrides: Partial<HermesEventInput> = {}): HermesEventInput {
  return {
    taskId: "HERMES-EVENT-LOG-001",
    actor: "assistant",
    actorType: "assistant",
    action: "event-log-test",
    target: "tools/hep/event-log.ts",
    targetType: "file",
    decision: "INFO",
    result: "observed",
    severity: "info",
    message: "Event log test event",
    ...overrides
  };
}

describe("Hermes unified event log", () => {
  beforeEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("creates the event log directory safely", () => {
    const createdPath = initEventLog(options());

    expect(createdPath).toBe(path.resolve(logPath));
    expect(fs.existsSync(logPath)).toBe(true);
    expect(fs.existsSync(errorLogPath)).toBe(true);
  });

  it("appends one event as valid JSONL", () => {
    const event = appendHermesEvent(baseEvent(), options());
    const content = fs.readFileSync(logPath, "utf8").trim();
    const parsed = JSON.parse(content) as Record<string, unknown>;

    expect(event.schemaVersion).toBe("1");
    expect(event.eventId).toMatch(/^evt_[a-f0-9]{24}$/);
    expect(parsed.taskId).toBe("HERMES-EVENT-LOG-001");
    expect(parsed.timestamp).toBe("2026-06-24T09:00:00.000Z");
  });

  it("preserves existing lines when appending", () => {
    appendHermesEvent(baseEvent({ action: "first" }), options());
    appendHermesEvent(baseEvent({ action: "second" }), options());

    const lines = fs.readFileSync(logPath, "utf8").trim().split(/\r?\n/);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("first");
    expect(lines[1]).toContain("second");
  });

  it("rejects malformed required fields", () => {
    expect(() => buildHermesEvent(baseEvent({ actor: "" }), options())).toThrow(/actor/);
    expect(() => buildHermesEvent(baseEvent({ decision: "MAYBE" as never }), options())).toThrow(/decision/);
  });

  it("redacts secret-like values before write", () => {
    appendHermesEvent(baseEvent({
      message: "token sbp_abcdefghijklmnopqrstuvwxyz123456 and postgresql://user:pass@example.com/db",
      metadata: {
        apiKey: "secret-value",
        nested: {
          Authorization: "Bearer abc.def.ghi",
          visible: "safe"
        }
      }
    }), options());

    const content = fs.readFileSync(logPath, "utf8");
    expect(content).not.toContain("abcdefghijklmnopqrstuvwxyz123456");
    expect(content).not.toContain("user:pass@example.com");
    expect(content).not.toContain("secret-value");
    expect(content).not.toContain("abc.def.ghi");
    expect(content).toContain("[REDACTED_SUPABASE_TOKEN]");
    expect(content).toContain("[REDACTED_DATABASE_URL]");
    expect(content).toContain("safe");
  });

  it("creates stable event ids for stable input hooks", () => {
    const first = buildHermesEvent(baseEvent(), options());
    const second = buildHermesEvent(baseEvent(), options());

    expect(first.eventId).toBe(second.eventId);
  });

  it("can query by taskId", () => {
    appendHermesEvent(baseEvent({ taskId: "TASK-A", action: "a" }), options());
    appendHermesEvent(baseEvent({ taskId: "TASK-B", action: "b" }), options());

    const matches = queryHermesEvents({ taskId: "TASK-B" }, options());
    expect(matches).toHaveLength(1);
    expect(matches[0].action).toBe("b");
  });

  it("can tail last N events", () => {
    appendHermesEvent(baseEvent({ action: "one" }), options());
    appendHermesEvent(baseEvent({ action: "two" }), options());
    appendHermesEvent(baseEvent({ action: "three" }), options());

    const tail = tailHermesEvents(2, options());
    expect(tail.map((event) => event.action)).toEqual(["two", "three"]);
  });

  it("does not allow event log path traversal", () => {
    expect(() => initEventLog({
      hermesRoot: tempRoot,
      logPath: path.resolve(tempRoot, "../outside.jsonl"),
      errorLogPath
    })).toThrow(/escapes Hermes root/);
  });

  it("handles corrupted lines without crashing reader", () => {
    initEventLog(options());
    fs.appendFileSync(logPath, "not-json\n", "utf8");
    appendHermesEvent(baseEvent({ action: "valid" }), options());

    const result = readHermesEvents(options());
    expect(result.corruptedLines).toBe(1);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].action).toBe("valid");
  });

  it("redacts nested secret keys in arbitrary metadata", () => {
    const redacted = redactEventSecrets({
      password: "do-not-print",
      nested: { token: "also-secret", normal: "visible" }
    });

    expect(redacted).toEqual({
      password: "[REDACTED]",
      nested: { token: "[REDACTED]", normal: "visible" }
    });
  });
});
