import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { redactGuardrailText } from "./guardrail-blocker.ts";

export type ChangesetStatus = "draft" | "recorded" | "verified" | "failed" | "revoked";
export type ChangesetRiskLevel = "low" | "medium" | "high" | "critical";

export interface ChangesetFile {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed" | "unknown";
  planned: boolean;
  reason?: string;
}

export interface ChangesetCheckResult {
  name: string;
  command: string;
  status: "pass" | "fail" | "skipped";
  evidence?: string;
}

export interface ChangesetRecord {
  changesetId: string;
  taskId: string;
  planId?: string;
  actor: string;
  status: ChangesetStatus;
  riskLevel: ChangesetRiskLevel;
  createdAt: string;
  updatedAt: string;
  commitHash?: string;
  baseCommit?: string;
  branch?: string;
  summary: string;
  plannedFiles: string[];
  actualFiles: ChangesetFile[];
  unplannedFiles: string[];
  checks: ChangesetCheckResult[];
  rollbackRef?: string;
  reportPath?: string;
  notes: string[];
}

export interface ChangesetAddOptions extends ChangesetOptions {
  taskId: string;
  planId?: string;
  actor: string;
  riskLevel: ChangesetRiskLevel;
  summary: string;
  plannedFiles: string[];
  actualFiles: ChangesetFile[];
  checks?: ChangesetCheckResult[];
  rollbackRef?: string;
  commitHash?: string;
  baseCommit?: string;
  branch?: string;
  reportPath?: string;
  notes?: string[];
}

export interface ChangesetOptions {
  workspaceRoot: string;
}

export interface ChangesetSignal {
  taskId: string;
  matched: boolean;
  changesetId?: string;
  status?: ChangesetStatus;
  verified: boolean;
  plannedFilesPresent: boolean;
  actualFilesPresent: boolean;
  unplannedFilesPresent: boolean;
  checksPassed: boolean;
  rollbackRefPresent: boolean;
  reasons: string[];
  warnings: string[];
  matchedChangesetIds: string[];
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

function sanitize(value: string): string {
  return redactGuardrailText(value).value;
}

function ensureParent(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
}

function normalizeList(values: string[]): string[] {
  return values.map((value) => sanitize(value.trim())).filter(Boolean);
}

function normalizeFile(file: ChangesetFile): ChangesetFile {
  return {
    path: sanitize(file.path.trim()),
    status: file.status || "unknown",
    planned: Boolean(file.planned),
    reason: file.reason ? sanitize(file.reason) : undefined
  };
}

function normalizeCheck(check: ChangesetCheckResult): ChangesetCheckResult {
  return {
    name: sanitize(check.name.trim()),
    command: sanitize(check.command.trim()),
    status: check.status,
    evidence: check.evidence ? sanitize(check.evidence) : undefined
  };
}

function comparePlanned(actualFiles: ChangesetFile[], plannedFiles: string[]): string[] {
  const planned = new Set(plannedFiles.map((file) => file.replaceAll("\\", "/")));
  return actualFiles
    .map((file) => file.path.replaceAll("\\", "/"))
    .filter((file) => !planned.has(file));
}

function validateChangeset(options: ChangesetAddOptions): void {
  if (!options.taskId.trim()) throw new Error("Changeset requires taskId");
  if (!options.actor.trim()) throw new Error("Changeset requires actor");
  if (!options.summary.trim()) throw new Error("Changeset requires summary");
  if (options.actualFiles.length === 0) throw new Error("Changeset requires actual files");
  if ((options.riskLevel === "high" || options.riskLevel === "critical") && !options.rollbackRef?.trim()) {
    throw new Error("High-risk changeset requires rollbackRef");
  }
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
  const existingIndex = records.findIndex((record) => record.taskId === options.taskId && record.planId === options.planId && record.status !== "revoked");
  const existing = existingIndex >= 0 ? records[existingIndex] : undefined;
  const actualFiles = options.actualFiles.map(normalizeFile);
  const plannedFiles = normalizeList(options.plannedFiles);
  const unplannedFiles = comparePlanned(actualFiles, plannedFiles);
  const checks = (options.checks ?? []).map(normalizeCheck);
  const checksPassed = checks.length > 0 && checks.every((check) => check.status === "pass");
  const record: ChangesetRecord = {
    changesetId: existing?.changesetId ?? `changeset.${sanitize(options.taskId).toLowerCase()}.${randomUUID()}`,
    taskId: sanitize(options.taskId),
    planId: options.planId ? sanitize(options.planId) : undefined,
    actor: sanitize(options.actor),
    status: checksPassed && unplannedFiles.length === 0 ? "verified" : "recorded",
    riskLevel: options.riskLevel,
    createdAt: existing?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
    commitHash: options.commitHash ? sanitize(options.commitHash) : undefined,
    baseCommit: options.baseCommit ? sanitize(options.baseCommit) : undefined,
    branch: options.branch ? sanitize(options.branch) : undefined,
    summary: sanitize(options.summary),
    plannedFiles,
    actualFiles,
    unplannedFiles,
    checks,
    rollbackRef: options.rollbackRef ? sanitize(options.rollbackRef) : undefined,
    reportPath: options.reportPath ? sanitize(options.reportPath) : undefined,
    notes: normalizeList(options.notes ?? [])
  };
  if (existingIndex >= 0) records[existingIndex] = record;
  else records.push(record);
  saveChangesetRegistry(options, records);
  writeChangesetEvent(options, { event: existing ? "changeset-update" : "changeset-add", taskId: record.taskId, changesetId: record.changesetId, status: record.status });
  return record;
}

export function evaluateChangeset(options: ChangesetOptions & { taskId: string; planId?: string }): ChangesetSignal {
  const records = loadChangesetRegistry(options).filter((record) => record.taskId === options.taskId && (!options.planId || record.planId === options.planId));
  const selected = records.find((record) => record.status === "verified") ?? records.find((record) => record.status !== "revoked");
  const reasons: string[] = [];
  const warnings: string[] = [];
  if (!selected) reasons.push("No matching changeset found.");
  if (selected && selected.unplannedFiles.length > 0) warnings.push("Changeset contains unplanned files.");
  if (selected && selected.checks.length === 0) warnings.push("Changeset has no check results.");
  if (selected && selected.checks.some((check) => check.status === "fail")) warnings.push("Changeset has failed checks.");
  return {
    taskId: options.taskId,
    matched: Boolean(selected),
    changesetId: selected?.changesetId,
    status: selected?.status,
    verified: selected?.status === "verified",
    plannedFilesPresent: Boolean(selected && selected.plannedFiles.length > 0),
    actualFilesPresent: Boolean(selected && selected.actualFiles.length > 0),
    unplannedFilesPresent: Boolean(selected && selected.unplannedFiles.length > 0),
    checksPassed: Boolean(selected && selected.checks.length > 0 && selected.checks.every((check) => check.status === "pass")),
    rollbackRefPresent: Boolean(selected?.rollbackRef),
    reasons,
    warnings,
    matchedChangesetIds: records.map((record) => record.changesetId)
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

export function parseChangesetFileInput(input: string, plannedFiles: string[] = []): ChangesetFile {
  const parts = input.split("|").map((part) => part.trim());
  const path = parts[0] || "unknown";
  const planned = plannedFiles.includes(path);
  return {
    path,
    status: (parts[1] as ChangesetFile["status"]) || "unknown",
    planned,
    reason: parts[2] || undefined
  };
}

export function parseChangesetCheckInput(input: string): ChangesetCheckResult {
  const parts = input.split("|").map((part) => part.trim());
  return {
    name: parts[0] || "check",
    command: parts[1] || "unknown",
    status: (parts[2] as ChangesetCheckResult["status"]) || "skipped",
    evidence: parts[3] || undefined
  };
}

export function readGitChangedFiles(repositoryPath: string): ChangesetFile[] {
  const output = execFileSync("git", ["status", "--porcelain"], {
    cwd: repositoryPath,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 15000
  });
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const code = line.slice(0, 2).trim();
      const path = line.slice(2).trim();
      const status: ChangesetFile["status"] = code.includes("A") ? "added" : code.includes("D") ? "deleted" : code.includes("R") ? "renamed" : code ? "modified" : "unknown";
      return { path, status, planned: false };
    });
}

export function formatChangesetCheck(signal: ChangesetSignal): string {
  return [
    "Changeset Check Result:",
    `- Matched: ${signal.matched}`,
    `- Verified: ${signal.verified}`,
    `- Status: ${signal.status || "n/a"}`,
    `- Changeset ID: ${signal.changesetId || "n/a"}`,
    `- Planned files present: ${signal.plannedFilesPresent}`,
    `- Actual files present: ${signal.actualFilesPresent}`,
    `- Unplanned files present: ${signal.unplannedFilesPresent}`,
    `- Checks passed: ${signal.checksPassed}`,
    `- Rollback ref present: ${signal.rollbackRefPresent}`,
    "- Reasons:",
    ...(signal.reasons.length > 0 ? signal.reasons.map((reason) => `  * ${reason}`) : ["  * none"]),
    "- Warnings:",
    ...(signal.warnings.length > 0 ? signal.warnings.map((warning) => `  * ${warning}`) : ["  * none"])
  ].join("\n");
}
