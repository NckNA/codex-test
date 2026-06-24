import * as fs from "node:fs";
import * as path from "node:path";
import { createHash, randomUUID } from "node:crypto";

export const EVENT_SCHEMA_VERSION = "1" as const;

export type HermesActorType = "human" | "assistant" | "script" | "agent" | "system" | "unknown";
export type HermesTargetType = "file" | "folder" | "repo" | "report" | "host" | "policy" | "asset" | "browser" | "database" | "unknown";
export type HermesDecision = "ALLOW" | "DENY" | "ESCALATE" | "DRY_RUN" | "INFO" | "ERROR" | "SUCCESS" | "BLOCKED";
export type HermesResult = "started" | "completed" | "failed" | "blocked" | "skipped" | "observed";
export type HermesSeverity = "debug" | "info" | "warning" | "error" | "critical";

export interface HermesEventInput {
  taskId?: string | null;
  actor: string;
  actorType: HermesActorType;
  action: string;
  target?: string | null;
  targetType: HermesTargetType;
  decision: HermesDecision;
  result: HermesResult;
  severity: HermesSeverity;
  message: string;
  assetId?: string;
  correlationId?: string;
  parentEventId?: string;
  sourceReport?: string;
  commandName?: string;
  validationRefs?: string[];
  hazardRefs?: string[];
  metadata?: Record<string, unknown>;
}

export interface HermesEvent extends HermesEventInput {
  schemaVersion: typeof EVENT_SCHEMA_VERSION;
  eventId: string;
  timestamp: string;
  taskId: string | null;
  target: string | null;
}

export interface EventLogOptions {
  logPath?: string;
  errorLogPath?: string;
  hermesRoot?: string;
  now?: () => Date;
  uuid?: () => string;
}

export interface EventQuery {
  taskId?: string;
  decision?: HermesDecision;
  result?: HermesResult;
  actor?: string;
  limit?: number;
}

export interface EventReadResult {
  events: HermesEvent[];
  corruptedLines: number;
}

const DEFAULT_HERMES_ROOT = "D:/hermes";
const DEFAULT_EVENT_LOG_PATH = "D:/hermes/logs/events/hermes-events.jsonl";
const DEFAULT_ERROR_LOG_PATH = "D:/hermes/logs/events/event-log-errors.jsonl";

const ACTOR_TYPES: ReadonlySet<string> = new Set(["human", "assistant", "script", "agent", "system", "unknown"]);
const TARGET_TYPES: ReadonlySet<string> = new Set(["file", "folder", "repo", "report", "host", "policy", "asset", "browser", "database", "unknown"]);
const DECISIONS: ReadonlySet<string> = new Set(["ALLOW", "DENY", "ESCALATE", "DRY_RUN", "INFO", "ERROR", "SUCCESS", "BLOCKED"]);
const RESULTS: ReadonlySet<string> = new Set(["started", "completed", "failed", "blocked", "skipped", "observed"]);
const SEVERITIES: ReadonlySet<string> = new Set(["debug", "info", "warning", "error", "critical"]);

function resolveInside(root: string, candidate: string): string {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  const rootWithSeparator = resolvedRoot.endsWith(path.sep) ? resolvedRoot : `${resolvedRoot}${path.sep}`;

  if (resolvedCandidate !== resolvedRoot && !resolvedCandidate.startsWith(rootWithSeparator)) {
    throw new Error(`Path escapes Hermes root: ${candidate}`);
  }

  return resolvedCandidate;
}

function ensureJsonlPath(logPath: string): void {
  if (!logPath.toLowerCase().endsWith(".jsonl")) {
    throw new Error("Event log path must end with .jsonl");
  }
}

function getLogPath(options: EventLogOptions = {}): string {
  const hermesRoot = options.hermesRoot ?? DEFAULT_HERMES_ROOT;
  const logPath = options.logPath ?? DEFAULT_EVENT_LOG_PATH;
  ensureJsonlPath(logPath);
  return resolveInside(hermesRoot, logPath);
}

function getErrorLogPath(options: EventLogOptions = {}): string {
  const hermesRoot = options.hermesRoot ?? DEFAULT_HERMES_ROOT;
  const errorLogPath = options.errorLogPath ?? DEFAULT_ERROR_LOG_PATH;
  ensureJsonlPath(errorLogPath);
  return resolveInside(hermesRoot, errorLogPath);
}

export function initEventLog(options: EventLogOptions = {}): string {
  const logPath = getLogPath(options);
  const errorLogPath = getErrorLogPath(options);
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.mkdirSync(path.dirname(errorLogPath), { recursive: true });

  if (!fs.existsSync(logPath)) {
    fs.writeFileSync(logPath, "", "utf8");
  }
  if (!fs.existsSync(errorLogPath)) {
    fs.writeFileSync(errorLogPath, "", "utf8");
  }

  return logPath;
}

export function redactEventSecrets(input: unknown): unknown {
  if (typeof input === "string") {
    return redactString(input);
  }

  if (Array.isArray(input)) {
    return input.map((item) => redactEventSecrets(item));
  }

  if (input && typeof input === "object") {
    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (isSecretKey(key)) {
        redacted[key] = "[REDACTED]";
      } else {
        redacted[key] = redactEventSecrets(value);
      }
    }
    return redacted;
  }

  return input;
}

function redactString(value: string): string {
  return value
    .replace(/sbp_[A-Za-z0-9_-]{20,}/g, "[REDACTED_SUPABASE_TOKEN]")
    .replace(/postgres(?:ql)?:\/\/[^\s"'<>]+/gi, "[REDACTED_DATABASE_URL]")
    .replace(/(Authorization\s*[:=]\s*)(['"]?)(?:Bearer\s+)?[^'"\s,;}]+\2/gi, "$1$2[REDACTED]$2")
    .replace(/(Cookie\s*[:=]\s*)[^\n\r]+/gi, "$1[REDACTED_COOKIES]")
    .replace(/\b([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY|PRIVATE_KEY)[A-Z0-9_]*)\s*=\s*([^\s;]+)/gi, "$1=[REDACTED]");
}

function isSecretKey(key: string): boolean {
  return /(token|secret|password|api[_-]?key|private[_-]?key|cookie|authorization)/i.test(key);
}

function requiredString(name: string, value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing or invalid required string field: ${name}`);
  }
  return value.trim();
}

function optionalString(name: string, value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid optional string field: ${name}`);
  }
  return value.trim();
}

function optionalStringArray(name: string, value: unknown): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim().length === 0)) {
    throw new Error(`Invalid optional string array field: ${name}`);
  }
  return value.map((item) => item.trim());
}

function enumField<T extends string>(name: string, value: unknown, allowed: ReadonlySet<string>): T {
  const stringValue = requiredString(name, value);
  if (!allowed.has(stringValue)) {
    throw new Error(`Invalid enum field ${name}: ${stringValue}`);
  }
  return stringValue as T;
}

function createStableEventId(event: Omit<HermesEvent, "eventId">, uuid: string): string {
  const payload = JSON.stringify({ ...event, uuid });
  return `evt_${createHash("sha256").update(payload).digest("hex").slice(0, 24)}`;
}

export function buildHermesEvent(input: HermesEventInput, options: EventLogOptions = {}): HermesEvent {
  const timestamp = (options.now ?? (() => new Date()))().toISOString();
  const uuid = (options.uuid ?? randomUUID)();
  const sanitizedInput = redactEventSecrets(input) as HermesEventInput;

  const eventWithoutId: Omit<HermesEvent, "eventId"> = {
    schemaVersion: EVENT_SCHEMA_VERSION,
    timestamp,
    taskId: sanitizedInput.taskId ?? null,
    actor: requiredString("actor", sanitizedInput.actor),
    actorType: enumField<HermesActorType>("actorType", sanitizedInput.actorType, ACTOR_TYPES),
    action: requiredString("action", sanitizedInput.action),
    target: sanitizedInput.target ?? null,
    targetType: enumField<HermesTargetType>("targetType", sanitizedInput.targetType, TARGET_TYPES),
    decision: enumField<HermesDecision>("decision", sanitizedInput.decision, DECISIONS),
    result: enumField<HermesResult>("result", sanitizedInput.result, RESULTS),
    severity: enumField<HermesSeverity>("severity", sanitizedInput.severity, SEVERITIES),
    message: requiredString("message", sanitizedInput.message),
    assetId: optionalString("assetId", sanitizedInput.assetId),
    correlationId: optionalString("correlationId", sanitizedInput.correlationId),
    parentEventId: optionalString("parentEventId", sanitizedInput.parentEventId),
    sourceReport: optionalString("sourceReport", sanitizedInput.sourceReport),
    commandName: optionalString("commandName", sanitizedInput.commandName),
    validationRefs: optionalStringArray("validationRefs", sanitizedInput.validationRefs),
    hazardRefs: optionalStringArray("hazardRefs", sanitizedInput.hazardRefs),
    metadata: sanitizedInput.metadata ? (redactEventSecrets(sanitizedInput.metadata) as Record<string, unknown>) : undefined
  };

  return {
    ...eventWithoutId,
    eventId: createStableEventId(eventWithoutId, uuid)
  };
}

export function appendHermesEvent(input: HermesEventInput, options: EventLogOptions = {}): HermesEvent {
  const logPath = initEventLog(options);
  const event = buildHermesEvent(input, options);
  fs.appendFileSync(logPath, `${JSON.stringify(event)}\n`, "utf8");
  return event;
}

export function readHermesEvents(options: EventLogOptions = {}): EventReadResult {
  const logPath = getLogPath(options);
  if (!fs.existsSync(logPath)) {
    return { events: [], corruptedLines: 0 };
  }

  const content = fs.readFileSync(logPath, "utf8");
  const events: HermesEvent[] = [];
  let corruptedLines = 0;

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    try {
      const parsed = JSON.parse(trimmed) as HermesEvent;
      if (parsed.schemaVersion === EVENT_SCHEMA_VERSION && typeof parsed.eventId === "string") {
        events.push(parsed);
      } else {
        corruptedLines++;
      }
    } catch {
      corruptedLines++;
    }
  }

  return { events, corruptedLines };
}

export function tailHermesEvents(limit: number, options: EventLogOptions = {}): HermesEvent[] {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new Error("Tail limit must be an integer from 1 to 500");
  }
  const { events } = readHermesEvents(options);
  return events.slice(-limit);
}

export function queryHermesEvents(query: EventQuery, options: EventLogOptions = {}): HermesEvent[] {
  const { events } = readHermesEvents(options);
  const filtered = events.filter((event) => {
    if (query.taskId && event.taskId !== query.taskId) {
      return false;
    }
    if (query.decision && event.decision !== query.decision) {
      return false;
    }
    if (query.result && event.result !== query.result) {
      return false;
    }
    if (query.actor && event.actor !== query.actor) {
      return false;
    }
    return true;
  });

  return query.limit ? filtered.slice(-query.limit) : filtered;
}

export function writeEventLogError(message: string, options: EventLogOptions = {}): void {
  const errorLogPath = getErrorLogPath(options);
  fs.mkdirSync(path.dirname(errorLogPath), { recursive: true });
  const sanitized = redactEventSecrets({ timestamp: new Date().toISOString(), message }) as Record<string, unknown>;
  fs.appendFileSync(errorLogPath, `${JSON.stringify(sanitized)}\n`, "utf8");
}
