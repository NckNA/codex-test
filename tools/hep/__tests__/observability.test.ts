import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createObservabilitySnapshot, formatObservabilityMarkdown, writeObservabilitySnapshot } from "../observability.ts";

function makeWorkspace(): { workspaceRoot: string; projectPath: string } {
  const workspaceRoot = mkdtempSync(path.join(tmpdir(), "hermes-observability-"));
  const projectPath = path.join(workspaceRoot, "codex-test");
  mkdirSync(path.join(projectPath, "tools", "hep"), { recursive: true });
  mkdirSync(path.join(workspaceRoot, "reports", "active"), { recursive: true });
  return { workspaceRoot, projectPath };
}

function writeModule(projectPath: string, relativePath: string): void {
  const fullPath = path.join(projectPath, relativePath);
  mkdirSync(path.dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, "export {};\n", "utf8");
}

describe("observability", () => {
  it("creates a snapshot even when event log is missing", () => {
    const { workspaceRoot, projectPath } = makeWorkspace();
    writeModule(projectPath, "tools/hep/observability.ts");

    const snapshot = createObservabilitySnapshot({ workspaceRoot, projectPath });

    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.counts.eventsRead).toBe(0);
    expect(snapshot.warnings[0]).toContain("Event log not found");
    expect(snapshot.overall).toBe("yellow");
  });

  it("reads JSONL events and classifies failures, denials, and escalations", () => {
    const { workspaceRoot, projectPath } = makeWorkspace();
    mkdirSync(path.join(workspaceRoot, "logs", "events"), { recursive: true });
    writeFileSync(path.join(workspaceRoot, "logs", "events", "hermes-events.jsonl"), [
      JSON.stringify({ timestamp: "2026-06-24T00:00:00.000Z", taskId: "TASK-1", action: "build", outcome: "ok", message: "done" }),
      JSON.stringify({ timestamp: "2026-06-24T00:01:00.000Z", taskId: "TASK-2", action: "guard", decision: "DENY", message: "denied" }),
      JSON.stringify({ timestamp: "2026-06-24T00:02:00.000Z", taskId: "TASK-3", action: "run", outcome: "failed", message: "failed test" }),
      JSON.stringify({ timestamp: "2026-06-24T00:03:00.000Z", taskId: "TASK-4", action: "review", decision: "ESCALATE", message: "needs human" })
    ].join("\n"), "utf8");

    const snapshot = createObservabilitySnapshot({ workspaceRoot, projectPath, maxEvents: 10 });

    expect(snapshot.counts.eventsRead).toBe(4);
    expect(snapshot.counts.denied).toBe(1);
    expect(snapshot.counts.failures).toBe(1);
    expect(snapshot.counts.escalations).toBe(1);
    expect(snapshot.overall).toBe("red");
  });

  it("tolerates corrupt JSONL lines", () => {
    const { workspaceRoot, projectPath } = makeWorkspace();
    mkdirSync(path.join(workspaceRoot, "logs", "events"), { recursive: true });
    writeFileSync(path.join(workspaceRoot, "logs", "events", "hermes-events.jsonl"), [
      "not-json",
      JSON.stringify({ taskId: "TASK-OK", outcome: "ok" })
    ].join("\n"), "utf8");

    const snapshot = createObservabilitySnapshot({ workspaceRoot, projectPath });

    expect(snapshot.counts.corruptEventLines).toBe(1);
    expect(snapshot.counts.eventsRead).toBe(1);
    expect(snapshot.overall).toBe("yellow");
  });

  it("redacts sensitive-looking material from event messages", () => {
    const { workspaceRoot, projectPath } = makeWorkspace();
    mkdirSync(path.join(workspaceRoot, "logs", "events"), { recursive: true });
    const sensitiveKey = "to" + "ken";
    const sensitiveOther = "api" + "_key";
    writeFileSync(path.join(workspaceRoot, "logs", "events", "hermes-events.jsonl"), JSON.stringify({
      taskId: "TASK-SENSITIVE",
      outcome: "ok",
      message: `${sensitiveKey}=alpha-value ${sensitiveOther}=beta-value`
    }), "utf8");

    const snapshot = createObservabilitySnapshot({ workspaceRoot, projectPath });

    expect(snapshot.recentEvents[0].message).toContain("[REDACTED]");
    expect(snapshot.recentEvents[0].message).not.toContain("alpha-value");
  });

  it("lists recent markdown reports", () => {
    const { workspaceRoot, projectPath } = makeWorkspace();
    writeFileSync(path.join(workspaceRoot, "reports", "active", "TASK-REPORT.md"), "# Report\nTask ID: TASK-REPORT\nStatus: DONE\n", "utf8");

    const snapshot = createObservabilitySnapshot({ workspaceRoot, projectPath });

    expect(snapshot.counts.activeReports).toBe(1);
    expect(snapshot.activeReports[0].taskId).toBe("TASK-REPORT");
  });

  it("formats markdown snapshot", () => {
    const { workspaceRoot, projectPath } = makeWorkspace();
    const snapshot = createObservabilitySnapshot({ workspaceRoot, projectPath });
    const markdown = formatObservabilityMarkdown(snapshot);

    expect(markdown).toContain("Hermes Observability Snapshot");
    expect(markdown).toContain("Recommendations");
  });

  it("writes json and markdown outputs", () => {
    const { workspaceRoot, projectPath } = makeWorkspace();
    const snapshot = writeObservabilitySnapshot({ workspaceRoot, projectPath });

    expect(snapshot.outputs?.json).toContain("observability-snapshot.json");
    expect(snapshot.outputs?.markdown).toContain("observability-snapshot.md");
  });
});
