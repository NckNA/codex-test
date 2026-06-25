import { randomUUID } from "node:crypto";
import { redactSecrets } from "./task-memory.ts";

export type ChangePlanAction = "create" | "modify" | "delete" | "inspect";
export type ChangePlanRiskLevel = "low" | "medium" | "high" | "critical";
export type ChangePlanStatus = "draft" | "active" | "approved" | "revoked";
export type ChangePlanDecision = "ALLOW" | "BLOCK";

export interface ChangePlanFile {
  path: string;
  reason: string;
  changeType: ChangePlanAction;
}

export interface ChangePlanCheck {
  command: string;
  required: boolean;
  expectedResult: string;
}

export interface ChangePlanInput {
  taskId: string;
  actor: string;
  action: ChangePlanAction;
  target: string;
  riskLevel: ChangePlanRiskLevel;
  createdBy: string;
  reason: string;
  summary: string;
  expectedFiles: ChangePlanFile[];
  checks: ChangePlanCheck[];
  rollbackRef: string;
  requiresOwnerReview?: boolean;
  notes?: string[];
  planId?: string;
  createdAt?: string;
}

export interface ChangePlanRecord extends ChangePlanInput {
  planId: string;
  status: ChangePlanStatus;
  createdAt: string;
  updatedAt: string;
  requiresOwnerReview: boolean;
  approvedBy?: string;
  approvedAt?: string;
  revokedBy?: string;
  revokedAt?: string;
}

export interface ChangePlanScope {
  allowedFiles?: string[];
  allowedPrefixes?: string[];
  forbiddenPrefixes?: string[];
}

export interface ChangePlanSimulation {
  decision: ChangePlanDecision;
  reasons: string[];
  matchedRules: string[];
}

export interface ActualChangedFile {
  path: string;
  status?: string;
  additions?: number;
  deletions?: number;
}

export interface PlannedDiffResult {
  plannedFiles: string[];
  actualFiles: ActualChangedFile[];
  unplannedFiles: ActualChangedFile[];
  missingPlannedFiles: string[];
}

const TASK_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,119}$/;
const ACTOR_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,159}$/;
const SAFE_REF_RE = /^[a-zA-Z0-9][a-zA-Z0-9._/-]{1,199}$/;
const VALID_ACTIONS: ChangePlanAction[] = ["create", "modify", "delete", "inspect"];
const VALID_RISK_LEVELS: ChangePlanRiskLevel[] = ["low", "medium", "high", "critical"];

export function normalizePlanPath(input: string): string {
  const normalized = input.trim().replace(/\\/g, "/").replace(/\/+/g, "/");
  if (!normalized) {
    throw new Error("Path must not be empty.");
  }
  if (normalized.startsWith("/") || /^[a-zA-Z]:\//.test(normalized)) {
    throw new Error(`Unsafe absolute path: ${input}`);
  }
  const parts = normalized.split("/");
  if (parts.includes("..") || parts.includes(".")) {
    throw new Error(`Unsafe path traversal segment in: ${input}`);
  }
  return normalized;
}

function assertNonEmpty(value: string, fieldName: string): void {
  if (!value || value.trim().length === 0) {
    throw new Error(`${fieldName} is required.`);
  }
}

function assertTaskId(taskId: string): void {
  if (!TASK_ID_RE.test(taskId)) {
    throw new Error(`Unsafe taskId "${taskId}".`);
  }
}

function assertActor(actor: string): void {
  if (!ACTOR_RE.test(actor)) {
    throw new Error(`Unsafe actor "${actor}".`);
  }
}

function assertSafeRef(value: string, fieldName: string): void {
  if (!SAFE_REF_RE.test(value)) {
    throw new Error(`Unsafe ${fieldName} "${value}".`);
  }
}

function normalizeFile(file: ChangePlanFile): ChangePlanFile {
  assertNonEmpty(file.reason, "file.reason");
  if (!VALID_ACTIONS.includes(file.changeType)) {
    throw new Error(`Invalid file changeType "${file.changeType}".`);
  }
  return {
    path: normalizePlanPath(file.path),
    reason: redactSecrets(file.reason),
    changeType: file.changeType
  };
}

function normalizeCheck(check: ChangePlanCheck): ChangePlanCheck {
  assertNonEmpty(check.command, "check.command");
  assertNonEmpty(check.expectedResult, "check.expectedResult");
  return {
    command: redactSecrets(check.command),
    required: check.required,
    expectedResult: redactSecrets(check.expectedResult)
  };
}

function normalizeNotes(notes: string[] | undefined): string[] {
  return (notes ?? []).map((note) => redactSecrets(note));
}

export function validateChangePlanInput(input: ChangePlanInput): void {
  assertTaskId(input.taskId);
  assertActor(input.actor);
  assertNonEmpty(input.createdBy, "createdBy");
  assertNonEmpty(input.reason, "reason");
  assertNonEmpty(input.summary, "summary");
  assertSafeRef(input.rollbackRef, "rollbackRef");
  if (!VALID_ACTIONS.includes(input.action)) {
    throw new Error(`Invalid action "${input.action}".`);
  }
  if (!VALID_RISK_LEVELS.includes(input.riskLevel)) {
    throw new Error(`Invalid riskLevel "${input.riskLevel}".`);
  }
  normalizePlanPath(input.target);
  if (input.expectedFiles.length === 0) {
    throw new Error("expectedFiles must contain at least one file.");
  }
  if (input.checks.length === 0) {
    throw new Error("checks must contain at least one check.");
  }
  input.expectedFiles.forEach(normalizeFile);
  input.checks.forEach(normalizeCheck);
}

export function createChangePlan(input: ChangePlanInput): ChangePlanRecord {
  validateChangePlanInput(input);
  const now = input.createdAt ?? new Date().toISOString();
  const expectedFiles = input.expectedFiles.map(normalizeFile);
  const checks = input.checks.map(normalizeCheck);
  const requiresOwnerReview = input.requiresOwnerReview ?? (input.riskLevel === "high" || input.riskLevel === "critical");

  return {
    ...input,
    planId: input.planId ?? `change-plan.${input.taskId.toLowerCase()}.${randomUUID()}`,
    status: "active",
    createdAt: now,
    updatedAt: now,
    target: normalizePlanPath(input.target),
    reason: redactSecrets(input.reason),
    summary: redactSecrets(input.summary),
    expectedFiles,
    checks,
    requiresOwnerReview,
    notes: normalizeNotes(input.notes)
  };
}

function matchesPrefix(filePath: string, prefix: string): boolean {
  const cleanPrefix = normalizePlanPath(prefix).replace(/\*\*$/u, "").replace(/\*$/u, "").replace(/\/$/u, "");
  return filePath === cleanPrefix || filePath.startsWith(`${cleanPrefix}/`);
}

function isFileAllowed(filePath: string, scope: ChangePlanScope): boolean {
  const normalized = normalizePlanPath(filePath);
  const forbiddenPrefixes = scope.forbiddenPrefixes ?? [];
  if (forbiddenPrefixes.some((prefix) => matchesPrefix(normalized, prefix))) {
    return false;
  }

  const allowedFiles = (scope.allowedFiles ?? []).map((path) => normalizePlanPath(path));
  const allowedPrefixes = scope.allowedPrefixes ?? [];
  if (allowedFiles.length === 0 && allowedPrefixes.length === 0) {
    return true;
  }
  return allowedFiles.includes(normalized) || allowedPrefixes.some((prefix) => matchesPrefix(normalized, prefix));
}

export function validatePlanAgainstScope(plan: ChangePlanRecord, scope: ChangePlanScope): string[] {
  const blocked: string[] = [];
  for (const file of plan.expectedFiles) {
    if (!isFileAllowed(file.path, scope)) {
      blocked.push(file.path);
    }
  }
  return blocked;
}

export function simulateChangePlan(plan: ChangePlanRecord, scope: ChangePlanScope = {}): ChangePlanSimulation {
  const reasons: string[] = [];
  const matchedRules: string[] = [];

  if (plan.status === "revoked") {
    reasons.push("Plan is revoked.");
    matchedRules.push("BLOCK_REVOKED");
  }

  if ((plan.riskLevel === "high" || plan.riskLevel === "critical") && !plan.requiresOwnerReview) {
    reasons.push("High or critical risk plans must require owner review.");
    matchedRules.push("BLOCK_HIGH_RISK_WITHOUT_OWNER_REVIEW_FLAG");
  }

  if (plan.requiresOwnerReview && plan.status !== "approved") {
    reasons.push("Plan requires owner review before execution.");
    matchedRules.push("BLOCK_OWNER_REVIEW_REQUIRED");
  }

  const blockedFiles = validatePlanAgainstScope(plan, scope);
  if (blockedFiles.length > 0) {
    reasons.push(`Planned files outside allowed scope: ${blockedFiles.join(", ")}`);
    matchedRules.push("BLOCK_SCOPE_VIOLATION");
  }

  if (reasons.length > 0) {
    return { decision: "BLOCK", reasons, matchedRules };
  }

  return {
    decision: "ALLOW",
    reasons: ["Plan is within scope and does not require additional owner review."],
    matchedRules: ["ALLOW_SCOPE_AND_RISK_OK"]
  };
}

export function approveChangePlan(plan: ChangePlanRecord, approvedBy: string, approvedAt: string = new Date().toISOString()): ChangePlanRecord {
  assertNonEmpty(approvedBy, "approvedBy");
  if (plan.status === "revoked") {
    throw new Error("Cannot approve a revoked change plan.");
  }
  return {
    ...plan,
    status: "approved",
    approvedBy: redactSecrets(approvedBy),
    approvedAt,
    updatedAt: approvedAt
  };
}

export function revokeChangePlan(plan: ChangePlanRecord, revokedBy: string, revokedAt: string = new Date().toISOString()): ChangePlanRecord {
  assertNonEmpty(revokedBy, "revokedBy");
  return {
    ...plan,
    status: "revoked",
    revokedBy: redactSecrets(revokedBy),
    revokedAt,
    updatedAt: revokedAt,
    notes: [...(plan.notes ?? []), `revoked by ${redactSecrets(revokedBy)}`]
  };
}

function normalizeActualFile(file: string | ActualChangedFile): ActualChangedFile {
  if (typeof file === "string") {
    return { path: normalizePlanPath(file) };
  }
  return {
    ...file,
    path: normalizePlanPath(file.path)
  };
}

export function comparePlannedToActual(plan: ChangePlanRecord, actualFiles: Array<string | ActualChangedFile>): PlannedDiffResult {
  const plannedFiles = plan.expectedFiles.map((file) => normalizePlanPath(file.path));
  const actual = actualFiles.map(normalizeActualFile);
  const plannedSet = new Set(plannedFiles);
  const actualSet = new Set(actual.map((file) => file.path));

  return {
    plannedFiles,
    actualFiles: actual,
    unplannedFiles: actual.filter((file) => !plannedSet.has(file.path)),
    missingPlannedFiles: plannedFiles.filter((file) => !actualSet.has(file))
  };
}

export function toStorageRecord(plan: ChangePlanRecord): ChangePlanRecord {
  return {
    ...plan,
    createdBy: redactSecrets(plan.createdBy),
    reason: redactSecrets(plan.reason),
    summary: redactSecrets(plan.summary),
    rollbackRef: redactSecrets(plan.rollbackRef),
    notes: normalizeNotes(plan.notes),
    expectedFiles: plan.expectedFiles.map(normalizeFile),
    checks: plan.checks.map(normalizeCheck)
  };
}
