import * as fs from "node:fs";
import * as path from "node:path";

export const HAZARD_REGISTRY_SCHEMA_VERSION = "1" as const;

export type HazardSeverity = "low" | "medium" | "high" | "critical";
export type HazardStatus = "active" | "mitigated" | "accepted" | "retired";
export type HazardArea = "host" | "hep" | "cli" | "policy" | "storage" | "security" | "git" | "unknown";

export interface HazardInput {
  hazardId: string;
  title: string;
  area: HazardArea;
  severity: HazardSeverity;
  status?: HazardStatus;
  symptom: string;
  cause?: string;
  workaround: string;
  prevention: string;
  linkedTasks?: string[];
  tags?: string[];
  firstSeenAt?: string;
  lastSeenAt?: string;
}

export interface Hazard extends Required<Omit<HazardInput, "status" | "cause" | "linkedTasks" | "tags" | "firstSeenAt" | "lastSeenAt">> {
  schemaVersion: typeof HAZARD_REGISTRY_SCHEMA_VERSION;
  status: HazardStatus;
  cause: string;
  linkedTasks: string[];
  tags: string[];
  occurrenceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  mitigatedAt: string | null;
  updatedAt: string;
}

export interface HazardRegistry {
  schemaVersion: typeof HAZARD_REGISTRY_SCHEMA_VERSION;
  generatedAt: string;
  hazards: Hazard[];
}

export interface HazardEvent {
  timestamp: string;
  action: "init" | "add" | "see" | "mitigate";
  hazardId: string;
  taskId?: string | null;
  actor?: string | null;
  note?: string;
}

export interface HazardRegistryOptions {
  hermesRoot?: string;
  registryPath?: string;
  eventLogPath?: string;
  now?: () => Date;
}

export interface HazardListFilter {
  status?: HazardStatus;
  area?: HazardArea;
  severity?: HazardSeverity;
}

const DEFAULT_HERMES_ROOT = "D:/hermes";

const SEVERITIES = new Set(["low", "medium", "high", "critical"]);
const STATUSES = new Set(["active", "mitigated", "accepted", "retired"]);
const AREAS = new Set(["host", "hep", "cli", "policy", "storage", "security", "git", "unknown"]);

export const DEFAULT_HAZARDS: HazardInput[] = [
  {
    hazardId: "HZD-HOST-HDD-PREDICTIVE-FAILURE-001",
    title: "Toshiba HDD reports predictive failure",
    area: "storage",
    severity: "critical",
    symptom: "Windows reports predictive failure for the Toshiba HDD.",
    cause: "Physical disk health warning from the storage layer.",
    workaround: "Move personal media and important work to the healthy D drive or an external backup target.",
    prevention: "Do not store important data on the failing HDD; use it only for disposable content until replaced.",
    linkedTasks: ["HOST-AUDIT-001", "HOST-MEDIA-COPY-001A"],
    tags: ["host", "storage", "hdd"]
  },
  {
    hazardId: "HZD-HOST-G-DRIVE-FULL-001",
    title: "G drive can fill and hide operational risk",
    area: "storage",
    severity: "medium",
    symptom: "G drive became nearly full and mixed useful media with disposable files.",
    cause: "Old storage layout did not distinguish important files from reinstallable data.",
    workaround: "Keep E/G as disposable storage only and keep important media on D or external backup.",
    prevention: "Use a 100 GB free-space threshold on D and keep E/G out of the critical path.",
    linkedTasks: ["HOST-MEDIA-VERIFY-001"],
    tags: ["storage", "cleanup"]
  },
  {
    hazardId: "HZD-HOST-DEFENDER-EXCLUSIONS-RISK-001",
    title: "Broad Defender exclusions reduce host trust",
    area: "security",
    severity: "critical",
    symptom: "Security audit found broad or suspicious Defender exclusions.",
    cause: "Legacy Windows setup accumulated unsafe exclusions and suspicious activation/security tooling.",
    workaround: "Treat current Windows as low trust and avoid granting broad autonomous access.",
    prevention: "Use clean Windows migration plan and keep Defender enabled with narrow exclusions only.",
    linkedTasks: ["HOST-SECURITY-TRIAGE-001", "HOST-MIGRATION-PLAN-001"],
    tags: ["security", "windows"]
  },
  {
    hazardId: "HZD-HOST-WINDOWS-LOW-TRUST-001",
    title: "Old Windows installation is low trust for long-lived Hermes",
    area: "host",
    severity: "high",
    symptom: "Host has old Windows, suspicious startup traces, and weakened security posture.",
    cause: "Long-lived Windows installation with legacy tools and accumulated configuration drift.",
    workaround: "Use the current host as a temporary working deck, not as the final autonomous Hermes foundation.",
    prevention: "Perform clean migration before granting broader automated hands to Hermes.",
    linkedTasks: ["HOST-AUDIT-001", "HOST-MIGRATION-PLAN-001"],
    tags: ["host", "migration"]
  },
  {
    hazardId: "HZD-CLI-LARGE-PATCH-BLOCKED-001",
    title: "Large CLI patches can be blocked by safety layer",
    area: "cli",
    severity: "medium",
    symptom: "Large safe_text_patch/file replacement attempts against HEP CLI were blocked.",
    cause: "Safety layer is sensitive to large code insertions or suspicious text fragments.",
    workaround: "Use smaller patches, direct terminal edits, or split CLI wiring into smaller tasks.",
    prevention: "Keep CLI additions small and testable; avoid combining unrelated changes.",
    linkedTasks: ["HERMES-HEP-LINE-RECONCILE-001", "HERMES-EVENT-LOG-CLI-WIRE-001"],
    tags: ["cli", "tooling"]
  },
  {
    hazardId: "HZD-SAFETY-LAYER-BLOCKS-READS-001",
    title: "Safety layer can block benign reads and status checks",
    area: "policy",
    severity: "medium",
    symptom: "Read-only commands such as file reads, status checks, and quality runs may be blocked.",
    cause: "Tool safety layer can over-classify local development operations.",
    workaround: "Fall back to narrower terminal commands or manual user-run commands with exact scope.",
    prevention: "Prefer small scoped operations and always report blocked validation honestly.",
    linkedTasks: ["HERMES-OBSERVABILITY-001", "HERMES-HEP-LINE-RECONCILE-001"],
    tags: ["policy", "safety"]
  },
  {
    hazardId: "HZD-CODEX-TEST-MUST-NOT-ARCHIVE-001",
    title: "Main codex-test checkout must not be archived as stale worktree",
    area: "hep",
    severity: "high",
    symptom: "Lifecycle/maintenance logic once risked treating codex-test as an archive candidate.",
    cause: "Registry classification did not clearly separate stable project checkout from task worktrees.",
    workaround: "Protect D:/hermes/codex-test as a stable project checkout.",
    prevention: "Asset registry and maintenance policies must mark stable roots as protected.",
    linkedTasks: ["HERMES-GOVERNANCE-LIFECYCLE-001", "HERMES-MAINTENANCE-AUTOPILOT-001B"],
    tags: ["hep", "maintenance"]
  },
  {
    hazardId: "HZD-HEP-BRANCH-DIVERGENCE-001",
    title: "HEP modules can diverge across feature branches",
    area: "git",
    severity: "high",
    symptom: "Event log and observability were implemented on different lines.",
    cause: "Parallel worktrees created useful modules without immediate reconciliation.",
    workaround: "Run a dedicated reconcile task before building dependent modules.",
    prevention: "Create merge/reconcile checkpoints after foundation tasks.",
    linkedTasks: ["HERMES-EVENT-LOG-001", "HERMES-OBSERVABILITY-001", "HERMES-HEP-LINE-RECONCILE-001"],
    tags: ["git", "architecture"]
  },
  {
    hazardId: "HZD-HEP-REPORT-ONLY-POLICY-STUCK-001",
    title: "Task policy can remain report-only after task spec edits",
    area: "policy",
    severity: "medium",
    symptom: "Code was ready but commit was refused because active policy still allowed reports only.",
    cause: "Policy inference did not detect or re-apply code-change scope reliably.",
    workaround: "Apply explicit code_changes policy or ask user to commit exact allowlisted files.",
    prevention: "Task specs should include a compact machine-readable permission block before implementation.",
    linkedTasks: ["HERMES-HEP-LINE-RECONCILE-001", "HERMES-EVENT-LOG-CLI-WIRE-001"],
    tags: ["policy", "git"]
  }
];

function nowIso(options?: HazardRegistryOptions): string {
  return (options?.now?.() ?? new Date()).toISOString();
}

function registryPath(options?: HazardRegistryOptions): string {
  const root = path.resolve(options?.hermesRoot ?? DEFAULT_HERMES_ROOT);
  const candidate = path.resolve(options?.registryPath ?? path.join(root, "memory", "hazards", "hazards.json"));
  assertInside(root, candidate);
  return candidate;
}

function hazardEventLogPath(options?: HazardRegistryOptions): string {
  const root = path.resolve(options?.hermesRoot ?? DEFAULT_HERMES_ROOT);
  const candidate = path.resolve(options?.eventLogPath ?? path.join(root, "logs", "hazards", "hazard-events.jsonl"));
  assertInside(root, candidate);
  return candidate;
}

function assertInside(root: string, candidate: string): void {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  const rootWithSeparator = resolvedRoot.endsWith(path.sep) ? resolvedRoot : `${resolvedRoot}${path.sep}`;
  if (resolvedCandidate !== resolvedRoot && !resolvedCandidate.startsWith(rootWithSeparator)) {
    throw new Error(`Path escapes Hermes root: ${candidate}`);
  }
}

function validateId(id: string): void {
  if (!/^HZD-[A-Z0-9._-]+$/.test(id)) {
    throw new Error(`Invalid hazard id: ${id}`);
  }
}

function validateEnum(value: string, allowed: ReadonlySet<string>, label: string): void {
  if (!allowed.has(value)) throw new Error(`Invalid ${label}: ${value}`);
}

function normalizeHazard(input: HazardInput, options?: HazardRegistryOptions): Hazard {
  validateId(input.hazardId);
  validateEnum(input.area, AREAS, "area");
  validateEnum(input.severity, SEVERITIES, "severity");
  const status = input.status ?? "active";
  validateEnum(status, STATUSES, "status");
  const timestamp = nowIso(options);
  return {
    schemaVersion: HAZARD_REGISTRY_SCHEMA_VERSION,
    hazardId: input.hazardId,
    title: requireText(input.title, "title"),
    area: input.area,
    severity: input.severity,
    status,
    symptom: requireText(input.symptom, "symptom"),
    cause: input.cause ?? "unknown",
    workaround: requireText(input.workaround, "workaround"),
    prevention: requireText(input.prevention, "prevention"),
    linkedTasks: unique(input.linkedTasks ?? []),
    tags: unique(input.tags ?? []),
    occurrenceCount: 1,
    firstSeenAt: input.firstSeenAt ?? timestamp,
    lastSeenAt: input.lastSeenAt ?? timestamp,
    mitigatedAt: null,
    updatedAt: timestamp
  };
}

function requireText(value: string, label: string): string {
  if (!value || value.trim().length === 0) throw new Error(`Hazard ${label} is required`);
  return value.trim();
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function readRegistry(options?: HazardRegistryOptions): HazardRegistry {
  const filePath = registryPath(options);
  if (!fs.existsSync(filePath)) return { schemaVersion: HAZARD_REGISTRY_SCHEMA_VERSION, generatedAt: nowIso(options), hazards: [] };
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as HazardRegistry;
  if (parsed.schemaVersion !== HAZARD_REGISTRY_SCHEMA_VERSION || !Array.isArray(parsed.hazards)) {
    throw new Error("Unsupported hazard registry format");
  }
  return parsed;
}

function writeRegistry(registry: HazardRegistry, options?: HazardRegistryOptions): string {
  const filePath = registryPath(options);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
  return filePath;
}

function appendHazardEvent(event: HazardEvent, options?: HazardRegistryOptions): string {
  const filePath = hazardEventLogPath(options);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(event)}\n`, "utf8");
  return filePath;
}

export function initHazardRegistry(options?: HazardRegistryOptions): HazardRegistry {
  const existing = readRegistry(options);
  const byId = new Map(existing.hazards.map((hazard) => [hazard.hazardId, hazard]));
  for (const input of DEFAULT_HAZARDS) {
    if (!byId.has(input.hazardId)) byId.set(input.hazardId, normalizeHazard(input, options));
  }
  const registry: HazardRegistry = {
    schemaVersion: HAZARD_REGISTRY_SCHEMA_VERSION,
    generatedAt: nowIso(options),
    hazards: [...byId.values()].sort((a, b) => a.hazardId.localeCompare(b.hazardId))
  };
  writeRegistry(registry, options);
  appendHazardEvent({ timestamp: nowIso(options), action: "init", hazardId: "HZD-REGISTRY-INIT", note: `hazards=${registry.hazards.length}` }, options);
  return registry;
}

export function listHazards(filter: HazardListFilter = {}, options?: HazardRegistryOptions): Hazard[] {
  const registry = readRegistry(options);
  return registry.hazards.filter((hazard) => {
    if (filter.status && hazard.status !== filter.status) return false;
    if (filter.area && hazard.area !== filter.area) return false;
    if (filter.severity && hazard.severity !== filter.severity) return false;
    return true;
  });
}

export function getHazard(hazardId: string, options?: HazardRegistryOptions): Hazard | undefined {
  validateId(hazardId);
  return readRegistry(options).hazards.find((hazard) => hazard.hazardId === hazardId);
}

export function addHazard(input: HazardInput, options?: HazardRegistryOptions & { actor?: string; taskId?: string }): Hazard {
  const registry = readRegistry(options);
  const existingIndex = registry.hazards.findIndex((hazard) => hazard.hazardId === input.hazardId);
  const timestamp = nowIso(options);
  let hazard: Hazard;
  if (existingIndex >= 0) {
    const existing = registry.hazards[existingIndex];
    hazard = {
      ...existing,
      title: input.title ? input.title.trim() : existing.title,
      area: input.area ?? existing.area,
      severity: input.severity ?? existing.severity,
      status: input.status ?? existing.status,
      symptom: input.symptom ? input.symptom.trim() : existing.symptom,
      cause: input.cause ?? existing.cause,
      workaround: input.workaround ? input.workaround.trim() : existing.workaround,
      prevention: input.prevention ? input.prevention.trim() : existing.prevention,
      linkedTasks: unique([...existing.linkedTasks, ...(input.linkedTasks ?? [])]),
      tags: unique([...existing.tags, ...(input.tags ?? [])]),
      occurrenceCount: existing.occurrenceCount + 1,
      lastSeenAt: timestamp,
      updatedAt: timestamp
    };
    registry.hazards[existingIndex] = hazard;
  } else {
    hazard = normalizeHazard(input, options);
    registry.hazards.push(hazard);
  }
  registry.generatedAt = timestamp;
  registry.hazards.sort((a, b) => a.hazardId.localeCompare(b.hazardId));
  writeRegistry(registry, options);
  appendHazardEvent({ timestamp, action: "add", hazardId: hazard.hazardId, actor: options?.actor ?? null, taskId: options?.taskId ?? null }, options);
  return hazard;
}

export function mitigateHazard(hazardId: string, note: string, options?: HazardRegistryOptions & { actor?: string; taskId?: string }): Hazard {
  validateId(hazardId);
  const registry = readRegistry(options);
  const index = registry.hazards.findIndex((hazard) => hazard.hazardId === hazardId);
  if (index < 0) throw new Error(`Hazard not found: ${hazardId}`);
  const timestamp = nowIso(options);
  const hazard: Hazard = { ...registry.hazards[index], status: "mitigated", mitigatedAt: timestamp, updatedAt: timestamp };
  registry.hazards[index] = hazard;
  registry.generatedAt = timestamp;
  writeRegistry(registry, options);
  appendHazardEvent({ timestamp, action: "mitigate", hazardId, actor: options?.actor ?? null, taskId: options?.taskId ?? null, note }, options);
  return hazard;
}

export function formatHazardList(hazards: Hazard[]): string {
  if (hazards.length === 0) return "No hazards found.";
  return hazards.map((hazard) => `${hazard.hazardId} [${hazard.status}/${hazard.severity}/${hazard.area}] ${hazard.title}`).join("\n");
}
