import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

export type ObservabilityOverall = "green" | "yellow" | "red" | "unknown";

export interface ObservabilityOptions {
  workspaceRoot: string;
  projectPath?: string;
  maxEvents?: number;
  maxReports?: number;
  outputJsonPath?: string;
  outputMarkdownPath?: string;
}

export interface ObservabilityEvent {
  timestamp?: string;
  taskId?: string;
  actor?: string;
  action?: string;
  target?: string;
  decision?: string;
  outcome?: string;
  severity?: string;
  message?: string;
  source?: string;
}

export interface ObservabilityReportEntry {
  path: string;
  name: string;
  modifiedAt: string;
  sizeBytes: number;
  taskId?: string;
  verdict?: string;
  status?: string;
}

export interface ModulePresence {
  name: string;
  present: boolean;
  path: string;
}

export interface ObservabilitySnapshot {
  schemaVersion: 1;
  generatedAt: string;
  workspaceRoot: string;
  projectPath?: string;
  overall: ObservabilityOverall;
  counts: {
    eventsRead: number;
    corruptEventLines: number;
    failures: number;
    denied: number;
    escalations: number;
    activeReports: number;
    missingModules: number;
  };
  recentEvents: ObservabilityEvent[];
  recentFailures: ObservabilityEvent[];
  recentDenied: ObservabilityEvent[];
  recentEscalations: ObservabilityEvent[];
  activeReports: ObservabilityReportEntry[];
  modules: ModulePresence[];
  missingModules: ModulePresence[];
  recommendations: string[];
  warnings: string[];
  outputs?: {
    json?: string;
    markdown?: string;
  };
}

const SECRET_PATTERNS: RegExp[] = [
  /sk-[A-Za-z0-9_-]{8,}/g,
  /gh[pousr]_[A-Za-z0-9_]{8,}/g,
  /xox[baprs]-[A-Za-z0-9-]{8,}/g,
  /(api[_-]?key|token|password|secret)\s*[:=]\s*[^\s,;}]+/gi
];

const DEFAULT_MODULES = [
  { name: "event-log", relativePath: "tools/hep/event-log.ts" },
  { name: "guardian-acl", relativePath: "tools/hep/guardian-acl.ts" },
  { name: "dependency-guard", relativePath: "tools/hep/dependency-guard.ts" },
  { name: "maintenance", relativePath: "tools/hep/maintenance.ts" },
  { name: "maintenance-autopilot", relativePath: "tools/hep/maintenance-autopilot.ts" },
  { name: "report-indexer", relativePath: "tools/hep/report-indexer.ts" },
  { name: "lifecycle-finalizer", relativePath: "tools/hep/lifecycle-finalizer.ts" },
  { name: "observability", relativePath: "tools/hep/observability.ts" }
];

function normalizeRoot(input: string): string {
  if (!input || input.trim().length === 0) throw new Error("workspaceRoot is required");
  return path.resolve(input);
}

function assertInside(root: string, candidate: string): string {
  const resolved = path.resolve(candidate);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to access path outside workspace root: ${candidate}`);
  }
  return resolved;
}

function redact(value: unknown): unknown {
  if (typeof value === "string") {
    return SECRET_PATTERNS.reduce((text, pattern) => text.replace(pattern, "[REDACTED]"), value);
  }
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      output[key] = /token|secret|password|api[_-]?key/i.test(key) ? "[REDACTED]" : redact(nested);
    }
    return output;
  }
  return value;
}

function asEvent(value: unknown, source: string): ObservabilityEvent {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    timestamp: typeof input.timestamp === "string" ? input.timestamp : typeof input.createdAt === "string" ? input.createdAt : undefined,
    taskId: typeof input.taskId === "string" ? input.taskId : undefined,
    actor: typeof input.actor === "string" ? input.actor : undefined,
    action: typeof input.action === "string" ? input.action : undefined,
    target: typeof input.target === "string" ? input.target : undefined,
    decision: typeof input.decision === "string" ? input.decision : undefined,
    outcome: typeof input.outcome === "string" ? input.outcome : typeof input.status === "string" ? input.status : undefined,
    severity: typeof input.severity === "string" ? input.severity : undefined,
    message: typeof input.message === "string" ? String(redact(input.message)) : undefined,
    source
  };
}

function readJsonlEvents(filePath: string, maxEvents: number): { events: ObservabilityEvent[]; corruptLines: number; warnings: string[] } {
  if (!existsSync(filePath)) return { events: [], corruptLines: 0, warnings: [`Event log not found: ${filePath}`] };
  const content = readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const events: ObservabilityEvent[] = [];
  let corruptLines = 0;
  for (const line of lines.slice(-Math.max(maxEvents * 4, maxEvents))) {
    try {
      events.push(asEvent(redact(JSON.parse(line)), filePath));
    } catch {
      corruptLines++;
    }
  }
  return { events: events.slice(-maxEvents), corruptLines, warnings: [] };
}

function listReports(root: string, maxReports: number): ObservabilityReportEntry[] {
  const dirs = [
    path.join(root, "reports", "active"),
    path.join(root, "codex-test", "_ai_work", "REPORTS")
  ];
  const entries: ObservabilityReportEntry[] = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (!name.toLowerCase().endsWith(".md")) continue;
      const fullPath = path.join(dir, name);
      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }
      if (!stat.isFile()) continue;
      const text = safeReadPrefix(fullPath, 8000);
      entries.push({
        path: fullPath,
        name,
        modifiedAt: stat.mtime.toISOString(),
        sizeBytes: stat.size,
        taskId: extractFirst(text, /(?:Task ID|taskId|Task):\s*`?([A-Z0-9._-]+)`?/i),
        verdict: extractFirst(text, /(?:Final Verdict|Verdict):\s*([^\n]+)/i),
        status: extractFirst(text, /(?:Status):\s*([^\n]+)/i)
      });
    }
  }
  return entries.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt)).slice(0, maxReports);
}

function safeReadPrefix(filePath: string, maxChars: number): string {
  try {
    return readFileSync(filePath, "utf8").slice(0, maxChars);
  } catch {
    return "";
  }
}

function extractFirst(text: string, pattern: RegExp): string | undefined {
  const match = text.match(pattern);
  return match?.[1]?.trim();
}

function detectModules(projectPath: string): ModulePresence[] {
  return DEFAULT_MODULES.map((module) => {
    const fullPath = path.join(projectPath, module.relativePath);
    return { name: module.name, path: fullPath, present: existsSync(fullPath) };
  });
}

function isFailure(event: ObservabilityEvent): boolean {
  const haystack = `${event.outcome ?? ""} ${event.severity ?? ""} ${event.message ?? ""}`.toLowerCase();
  return /fail|failed|error|red|exception|blocked/.test(haystack);
}

function isDenied(event: ObservabilityEvent): boolean {
  return `${event.decision ?? ""} ${event.outcome ?? ""} ${event.message ?? ""}`.toLowerCase().includes("deny");
}

function isEscalation(event: ObservabilityEvent): boolean {
  return `${event.decision ?? ""} ${event.outcome ?? ""} ${event.message ?? ""}`.toLowerCase().includes("escalat");
}

function computeOverall(failures: number, denied: number, escalations: number, missingModules: number, corruptEventLines: number): ObservabilityOverall {
  if (failures > 0 || escalations > 0) return "red";
  if (denied > 0 || missingModules > 0 || corruptEventLines > 0) return "yellow";
  return "green";
}

function buildRecommendations(snapshot: Pick<ObservabilitySnapshot, "counts">): string[] {
  const recommendations: string[] = [];
  if (snapshot.counts.eventsRead === 0) recommendations.push("Initialize/write Hermes event log entries so observability has live signals.");
  if (snapshot.counts.corruptEventLines > 0) recommendations.push("Inspect event log corruption and preserve bad lines for forensic review.");
  if (snapshot.counts.failures > 0) recommendations.push("Review recent failures before starting new autonomous tasks.");
  if (snapshot.counts.denied > 0) recommendations.push("Review denied actions and decide whether policy, actor role, or task scope is wrong.");
  if (snapshot.counts.escalations > 0) recommendations.push("Resolve escalations before enabling maintenance autonomy.");
  if (snapshot.counts.missingModules > 0) recommendations.push("Implement or merge missing HEP modules required by the roadmap.");
  if (recommendations.length === 0) recommendations.push("No immediate observability action required.");
  return recommendations;
}

export function createObservabilitySnapshot(options: ObservabilityOptions): ObservabilitySnapshot {
  const workspaceRoot = normalizeRoot(options.workspaceRoot);
  const projectPath = path.resolve(options.projectPath ?? path.join(workspaceRoot, "codex-test"));
  const maxEvents = Math.max(1, options.maxEvents ?? 50);
  const maxReports = Math.max(1, options.maxReports ?? 25);
  const eventLogPath = assertInside(workspaceRoot, path.join(workspaceRoot, "logs", "events", "hermes-events.jsonl"));
  const eventRead = readJsonlEvents(eventLogPath, maxEvents);
  const activeReports = listReports(workspaceRoot, maxReports);
  const modules = detectModules(projectPath);
  const missingModules = modules.filter((module) => !module.present);
  const recentFailures = eventRead.events.filter(isFailure).slice(-10);
  const recentDenied = eventRead.events.filter(isDenied).slice(-10);
  const recentEscalations = eventRead.events.filter(isEscalation).slice(-10);
  const counts = {
    eventsRead: eventRead.events.length,
    corruptEventLines: eventRead.corruptLines,
    failures: recentFailures.length,
    denied: recentDenied.length,
    escalations: recentEscalations.length,
    activeReports: activeReports.length,
    missingModules: missingModules.length
  };
  const overall = computeOverall(counts.failures, counts.denied, counts.escalations, counts.missingModules, counts.corruptEventLines);
  const snapshot: ObservabilitySnapshot = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    workspaceRoot,
    projectPath,
    overall,
    counts,
    recentEvents: eventRead.events,
    recentFailures,
    recentDenied,
    recentEscalations,
    activeReports,
    modules,
    missingModules,
    recommendations: [],
    warnings: eventRead.warnings
  };
  snapshot.recommendations = buildRecommendations(snapshot);
  return snapshot;
}

export function formatObservabilityMarkdown(snapshot: ObservabilitySnapshot): string {
  const lines: string[] = [];
  lines.push(`# Hermes Observability Snapshot`);
  lines.push("");
  lines.push(`Generated: ${snapshot.generatedAt}`);
  lines.push(`Overall: **${snapshot.overall.toUpperCase()}**`);
  lines.push("");
  lines.push(`## Counts`);
  lines.push("");
  for (const [key, value] of Object.entries(snapshot.counts)) {
    lines.push(`- ${key}: ${value}`);
  }
  lines.push("");
  lines.push(`## Missing Modules`);
  lines.push("");
  if (snapshot.missingModules.length === 0) {
    lines.push("- None");
  } else {
    for (const module of snapshot.missingModules) lines.push(`- ${module.name}: ${module.path}`);
  }
  lines.push("");
  lines.push(`## Recent Failures / Denials / Escalations`);
  lines.push("");
  const signalEvents = [...snapshot.recentFailures, ...snapshot.recentDenied, ...snapshot.recentEscalations];
  if (signalEvents.length === 0) {
    lines.push("- None");
  } else {
    for (const event of signalEvents.slice(-15)) {
      lines.push(`- ${event.timestamp ?? "unknown-time"} ${event.taskId ?? "no-task"} ${event.action ?? "no-action"}: ${event.message ?? event.outcome ?? event.decision ?? "no-message"}`);
    }
  }
  lines.push("");
  lines.push(`## Recent Reports`);
  lines.push("");
  if (snapshot.activeReports.length === 0) {
    lines.push("- None");
  } else {
    for (const report of snapshot.activeReports.slice(0, 10)) {
      lines.push(`- ${report.name} (${report.modifiedAt})${report.taskId ? ` — ${report.taskId}` : ""}`);
    }
  }
  lines.push("");
  lines.push(`## Recommendations`);
  lines.push("");
  for (const recommendation of snapshot.recommendations) lines.push(`- ${recommendation}`);
  if (snapshot.warnings.length > 0) {
    lines.push("");
    lines.push(`## Warnings`);
    lines.push("");
    for (const warning of snapshot.warnings) lines.push(`- ${warning}`);
  }
  lines.push("");
  return lines.join("\n");
}

export function writeObservabilitySnapshot(options: ObservabilityOptions): ObservabilitySnapshot {
  const workspaceRoot = normalizeRoot(options.workspaceRoot);
  const snapshot = createObservabilitySnapshot({ ...options, workspaceRoot });
  const jsonPath = assertInside(workspaceRoot, options.outputJsonPath ?? path.join(workspaceRoot, "reports", "active", "observability-snapshot.json"));
  const markdownPath = assertInside(workspaceRoot, options.outputMarkdownPath ?? path.join(workspaceRoot, "reports", "active", "observability-snapshot.md"));
  mkdirSync(path.dirname(jsonPath), { recursive: true });
  mkdirSync(path.dirname(markdownPath), { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify({ ...snapshot, outputs: { json: jsonPath, markdown: markdownPath } }, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, formatObservabilityMarkdown({ ...snapshot, outputs: { json: jsonPath, markdown: markdownPath } }), "utf8");
  return { ...snapshot, outputs: { json: jsonPath, markdown: markdownPath } };
}
