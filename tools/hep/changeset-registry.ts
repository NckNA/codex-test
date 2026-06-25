import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { redactGuardrailText } from "./guardrail-blocker.ts";

export type ChangesetStatus = "draft" | "recorded" | "validated" | "failed" | "revoked";
export type ChangesetRiskLevel = "low" | "medium" | "high" | "critical";

export interface ChangesetFile {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed" | "unknown";
  additions?: number;
  deletions?: number;
}

export interface ChangesetCheck {
  name: string;
  status: "pass" | "fail" | "skipped" | "unknown";
  command?: string;
  evidence?: string;
}

export interface ChangesetRecord {
  changesetId: string;
  taskId: string;
  actor: string;
  action: string;
  target?: string;
  status: ChangesetStatus;
  riskLevel: ChangesetRiskLevel;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  planId?: string;
  rollbackRef?: string;
  commitHash?: string;
  branch?: string;
  plannedFiles: string[];
  actualFiles: ChangesetFile[];
  unplannedFiles: string[];
  missingPlannedFiles: string[];
  checks: ChangesetCheck[];
  diffSummary?: string;
  notes: string[];
}

export interface ChangesetSignal {
  taskId: string;
  actor: string;
  action: string;
  target?: string;
  matched: boolean;
  changesetId?: string;
  status?: ChangesetStatus;
  recorded: boolean;
  validated: boolean;
  hasCommit: boolean;
  plannedFilesPresent: boolean;
  actualFilesPresent: boolean;
  unplannedFilesPresent: boolean;
  missingPlannedFilesPresent: boolean;
  checksPassing: boolean;
  reasons: string[];
  warnings: string[];
  matchedChangesetIds: string[];
}

export interface ChangesetOptions {
  workspaceRoot: string;
}

export interface ChangesetAddOptions extends ChangesetOptions {
  taskId: string;
  actor: string;
  action: string;
  target?: string;
  riskLevel: ChangesetRiskLevel;
  createdBy: string;
  planId?: string;
  rollbackRef?: string;
  commitHash?: string;
  branch?: string;
  plannedFiles: string[];
  actualFiles: ChangesetFile[];
  checks: ChangesetCheck[];
  diffSummary?: string;
  notes?: string[];
}

const REGISTRY_RELATIVE_PATH = join("memory", "changesets", "changeset-registry.json");
const EVENT_RELATIVE_PATH = join("logs", "changesets", "changeset-events.jsonl");

function nowIso(): string {
  return new Date().toISOString();
}

function registryPath(workspaceRoot: string): string {
  return join(resolve(workspaceRoot), REGISTRY_RELATIVE_PATH);
}

function eventPath(workspaceRoot: string): string {
  return join(resolve(workspaceRoot), EVENT_RELATIVE_PATH);
}

function ensureParent(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
}

function sanitize(value: string): string {
  return redactGuardrailText(value).value.trim();
}

function sanitizeList(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => sanitize(value)).filter(Boolean)));
}

function normalizeFile(file: ChangesetFile): ChangesetFile {
  return {
    path: sanitize(file.path),
    status: file.status || "unknown",
    additions: typeof file.additions === "number" ? file.additions : undefined,
    deletions: typeof file.deletions === "number" ? file.deletions : undefined
  };
}

function normalizeCheck(check: ChangesetCheck): ChangesetCheck {
  return {
    name: sanitize(check.name),
    status: check.status || "unknown",
    command: check.command ? sanitize(check.command) : undefined,
    evidence: check.evidence ? sanitize(check.evidence) : undefined
  };
}

function validateChangeset(options: ChangesetAddOptions): void {
  if (!options.taskId.trim()) throw new Error("Changeset requires taskId");
  if (!options.actor.trim()) throw new Error("Changeset requires actor");
  if (!options.action.trim()) throw new Error("Changeset requires action");
  if (!options.createdBy.trim()) throw new Error("Changeset requires createdBy");
  if (options.plannedFiles.length === 0) throw new Error("Changeset requires plannedFiles");
  if (options.actualFiles.length === 0) throw new Error("Changeset requires actualFiles");
  if (options.checks.length === 0) throw new Error("Changeset requires checks");
  if ((options.riskLevel === "high" || options.riskLevel === "critical") && !options.rollbackRef?.trim()) {
    throw new Error("High-risk changeset requires rollbackRef");
  }
}

function computeUnplanned(planned: string[], actual: ChangesetFile[]): string[] {
  const plannedSet = new Set(planned.map((item) => sanitize(item)));
  return actual.map((file) => sanitize(file.path)).filter((path) => !plannedSet.has(path));
}

function computeMissing(planned: string[], actual: ChangesetFile[]): string[] {
  const actualSet = new Set(actual.map((file) => sanitize(file.path)));
  return planned.map((path) => sanitize(path)).filter((path) => !actualSet.has(path));
}

function checksPassing(checks: ChangesetCheck[]): boolean {
  return checks.length > 0 && checks.every((check) => check.status === "pass" || check.status === "skipped");
}

export function initializeChangesetRegistry(options: ChangesetOptions): ChangesetRecord[] {
  const path = registryPath(options.workspaceRoot);
  ensureParent(path);
  if (!existsSync(path)) writeFileSync(path, "[]\n", "utf8");
  return loadChangesetRegistry(options);
}

export function loadChangesetRegistry(options: ChangesetOptions): ChangesetRecord[] {
  const path = registryPath(options.workspaceRoot);
  if (!existsSync(path)) return [];
  const parsed = JSON.parse(readFileSync(path, "utf8")) as ChangesetRecord[];
  return Array.isArray(parsed) ? parsed : [];
}

export function saveChangesetRegistry(options: ChangesetOptions, records: ChangesetRecord[]): void {
  const path = registryPath(options.workspaceRoot);
  ensureParent(path);
  writeFileSync(path, `${JSON.stringify(records, null, 2)}\n`, "utf8");
}

export function writeChangesetEvent(options: ChangesetOptions, event: Record<string, unknown>): void {
  const path = eventPath(options.workspaceRoot);
  ensureParent(path);
  appendFileSync(path, `${JSON.stringify({ ...event, at: nowIso() })}\n`, "utf8");
}

export function listChangesets(options: ChangesetOptions): ChangesetRecord[] {
  return loadChangesetRegistry(options);
}

export function addOrUpdateChangeset(options: ChangesetAddOptions): ChangesetRecord {
  validateChangeset(options);
  const records = loadChangesetRegistry(options);
  const plannedFiles = sanitizeList(options.plannedFiles);
  const actualFiles = options.actualFiles.map(normalizeFile);
  const unplannedFiles = computeUnplanned(plannedFiles, actualFiles);
  const missingPlannedFiles = computeMissing(plannedFiles, actualFiles);
  const normalizedChecks = options.checks.map(normalizeCheck);
  const existingIndex = records.findIndex((record) => record.taskId === options.taskId && record.actor === options.actor && record.action === options.action && (record.target || "") === (options.target || "") && record.status !== "revoked");
  const existing = existingIndex >= 0 ? records[existingIndex] : undefined;
  const status: ChangesetStatus = checksPassing(normalizedChecks) && unplannedFiles.length === 0 && missingPlannedFiles.length === 0 ? "validated" : "recorded";
  const record: ChangesetRecord = {
    changesetId: existing?.changesetId ?? `changeset.${sanitize(options.taskId).toLowerCase()}.${randomUUID()}`,
    taskId: sanitize(options.taskId),
    actor: sanitize(options.actor),
    action: sanitize(options.action),
    target: options.target ? sanitize(options.target) : undefined,
    status,
    riskLevel: options.riskLevel,
    createdAt: existing?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
    createdBy: sanitize(options.createdBy),
    planId: options.planId ? sanitize(options.planId) : undefined,
    rollbackRef: options.rollbackRef ? sanitize(options.rollbackRef) : undefined,
    commitHash: options.commitHash ? sanitize(options.commitHash) : undefined,
    branch: options.branch ? sanitize(options.branch) : undefined,
    plannedFiles,
    actualFiles,
    unplannedFiles,
    missingPlannedFiles,
    checks: normalizedChecks,
    diffSummary: options.diffSummary ? sanitize(options.diffSummary) : undefined,
    notes: sanitizeList(options.notes ?? [])
  };
  if (existingIndex >= 0) records[existingIndex] = record;
  else records.push(record);
  saveChangesetRegistry(options, records);
  writeChangesetEvent(options, { event: existing ? "changeset-update" : "changeset-add", taskId: record.taskId, changesetId: record.changesetId, status: record.status });
  return record;
}

export function findChangesets(options: ChangesetOptions & { taskId: string; actor?: string; action?: string; target?: string }): ChangesetRecord[] {
  return loadChangesetRegistry(options).filter((record) => {
    if (record.taskId !== options.taskId) return false;
    if (options.actor && record.actor !== options.actor) return false;
    if (options.action && record.action !== options.action) return false;
    if (options.target && record.target !== options.target) return false;
    return true;
  });
}

export function evaluateChangeset(options: ChangesetOptions & { taskId: string; actor: string; action: string; target?: string }): ChangesetSignal {
  const matches = findChangesets(options);
  const selected = matches.find((record) => record.status === "validated") ?? matches.find((record) => record.status !== "revoked");
  const reasons: string[] = [];
  const warnings: string[] = [];
  if (!selected) reasons.push("No matching changeset found.");
  if (selected && selected.unplannedFiles.length > 0) warnings.push("Changeset contains unplanned files.");
  if (selected && selected.missingPlannedFiles.length > 0) warnings.push("Changeset is missing planned files.");
  if (selected && !checksPassing(selected.checks)) warnings.push("Changeset checks are not all passing or skipped.");
  return {
    taskId: options.taskId,
    actor: options.actor,
    action: options.action,
    target: options.target,
    matched: Boolean(selected),
    changesetId: selected?.changesetId,
    status: selected?.status,
    recorded: Boolean(selected && selected.status !== "revoked"),
    validated: selected?.status === "validated",
    hasCommit: Boolean(selected?.commitHash),
    plannedFilesPresent: Boolean(selected && selected.plannedFiles.length > 0),
    actualFilesPresent: Boolean(selected && selected.actualFiles.length > 0),
    unplannedFilesPresent: Boolean(selected && selected.unplannedFiles.length > 0),
    missingPlannedFilesPresent: Boolean(selected && selected.missingPlannedFiles.length > 0),
    checksPassing: Boolean(selected && checksPassing(selected.checks)),
    reasons,
    warnings,
    matchedChangesetIds: matches.map((record) => record.changesetId)
  };
}

export function revokeChangeset(options: ChangesetOptions & { changesetId: string; reason: string; revokedBy: string }): ChangesetRecord {
  const records = loadChangesetRegistry(options);
  const record = records.find((item) => item.changesetId === options.changesetId);
  if (!record) throw new Error(`Changeset not found: ${options.changesetId}`);
  record.status = "revoked";
  record.updatedAt = nowIso();
  record.notes.push(`revoked by ${sanitize(options.revokedBy)}: ${sanitize(options.reason)}`);
  saveChangesetRegistry(options, records);
  writeChangesetEvent(options, { event: "changeset-revoke", taskId: record.taskId, changesetId: record.changesetId, revokedBy: sanitize(options.revokedBy) });
  return record;
}

export function parseChangesetFileInput(input: string): ChangesetFile {
  const parts = input.split("|").map((part) => part.trim());
  return {
    path: parts[0] || "unknown",
    status: (parts[1] as ChangesetFile["status"]) || "unknown",
    additions: parts[2] ? Number.parseInt(parts[2], 10) : undefined,
    deletions: parts[3] ? Number.parseInt(parts[3], 10) : undefined
  };
}

export function parseChangesetCheckInput(input: string): ChangesetCheck {
  const parts = input.split("|").map((part) => part.trim());
  return {
    name: parts[0] || "check",
    status: (parts[1] as ChangesetCheck["status"]) || "unknown",
    command: parts[2] || undefined,
    evidence: parts[3] || undefined
  };
}

export function formatChangesetCheck(signal: ChangesetSignal): string {
  return [
    "Changeset Check Result:",
    `- Matched: ${signal.matched}`,
    `- Recorded: ${signal.recorded}`,
    `- Validated: ${signal.validated}`,
    `- Changeset ID: ${signal.changesetId || "n/a"}`,
    `- Has commit: ${signal.hasCommit}`,
    `- Planned files present: ${signal.plannedFilesPresent}`,
    `- Actual files present: ${signal.actualFilesPresent}`,
    `- Unplanned files present: ${signal.unplannedFilesPresent}`,
    `- Missing planned files present: ${signal.missingPlannedFilesPresent}`,
    `- Checks passing: ${signal.checksPassing}`,
    "- Reasons:",
    ...(signal.reasons.length > 0 ? signal.reasons.map((reason) => `  * ${reason}`) : ["  * none"]),
    "- Warnings:",
    ...(signal.warnings.length > 0 ? signal.warnings.map((warning) => `  * ${warning}`) : ["  * none"])
  ].join("\n");
}
