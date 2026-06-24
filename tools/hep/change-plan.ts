import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { redactGuardrailText } from "./guardrail-blocker.ts";

export type ChangePlanStatus = "draft" | "active" | "approved" | "completed" | "revoked" | "expired";
export type ChangePlanRiskLevel = "low" | "medium" | "high" | "critical";

export interface ChangePlanFile {
  path: string;
  reason: string;
  changeType: "create" | "modify" | "delete" | "move" | "unknown";
}

export interface ChangePlanCheck {
  command: string;
  required: boolean;
  expectedResult: string;
}

export interface ChangePlan {
  planId: string;
  taskId: string;
  actor: string;
  action: string;
  target?: string;
  status: ChangePlanStatus;
  riskLevel: ChangePlanRiskLevel;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  reason: string;
  summary: string;
  expectedFiles: ChangePlanFile[];
  checks: ChangePlanCheck[];
  rollbackRef?: string;
  waiverId?: string;
  requiresOwnerReview: boolean;
  ownerReviewBy?: string;
  simulationDecision?: string;
  simulationMatchedRules: string[];
  notes: string[];
}

export interface ChangePlanSignal {
  taskId: string;
  actor: string;
  action: string;
  target?: string;
  matched: boolean;
  planId?: string;
  status?: ChangePlanStatus;
  active: boolean;
  approved: boolean;
  expired: boolean;
  expectedFilesPresent: boolean;
  checksPresent: boolean;
  rollbackRefPresent: boolean;
  ownerReviewPresent: boolean;
  reasons: string[];
  warnings: string[];
  matchedPlanIds: string[];
}

export interface ChangePlanAddOptions extends ChangePlanOptions {
  taskId: string;
  actor: string;
  action: string;
  target?: string;
  riskLevel: ChangePlanRiskLevel;
  createdBy: string;
  approvedBy?: string;
  reason: string;
  summary: string;
  expectedFiles: ChangePlanFile[];
  checks: ChangePlanCheck[];
  rollbackRef?: string;
  waiverId?: string;
  requiresOwnerReview?: boolean;
  ownerReviewBy?: string;
  simulationDecision?: string;
  simulationMatchedRules?: string[];
  expiresAt?: string;
  notes?: string[];
}

export interface ChangePlanOptions {
  workspaceRoot: string;
}

const REGISTRY_RELATIVE_PATH = join("memory", "change-plans", "change-plan-registry.json");
const EVENT_RELATIVE_PATH = join("logs", "change-plans", "change-plan-events.jsonl");

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

function sanitizeList(values: string[]): string[] {
  return values.map((value) => sanitize(value.trim())).filter(Boolean);
}

function ensureParent(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
}

function normalizeFile(file: ChangePlanFile): ChangePlanFile {
  return {
    path: sanitize(file.path.trim()),
    reason: sanitize(file.reason.trim()),
    changeType: file.changeType || "unknown"
  };
}

function normalizeCheck(check: ChangePlanCheck): ChangePlanCheck {
  return {
    command: sanitize(check.command.trim()),
    required: Boolean(check.required),
    expectedResult: sanitize(check.expectedResult.trim())
  };
}

function isExpired(plan: ChangePlan): boolean {
  return Boolean(plan.expiresAt && Date.parse(plan.expiresAt) <= Date.now());
}

function validatePlan(options: ChangePlanAddOptions): void {
  if (!options.taskId.trim()) throw new Error("Change plan requires taskId");
  if (!options.actor.trim()) throw new Error("Change plan requires actor");
  if (!options.action.trim()) throw new Error("Change plan requires action");
  if (!options.reason.trim()) throw new Error("Change plan requires reason");
  if (!options.summary.trim()) throw new Error("Change plan requires summary");
  if (options.expectedFiles.length === 0) throw new Error("Change plan requires expected files");
  if (options.checks.length === 0) throw new Error("Change plan requires validation checks");
  if ((options.riskLevel === "high" || options.riskLevel === "critical") && !options.rollbackRef?.trim()) {
    throw new Error("High-risk change plan requires rollbackRef");
  }
  if ((options.riskLevel === "high" || options.riskLevel === "critical") && !options.approvedBy?.trim()) {
    throw new Error("High-risk change plan requires approvedBy");
  }
  if (options.requiresOwnerReview && !options.ownerReviewBy?.trim()) {
    throw new Error("Change plan requires ownerReviewBy when owner review is required");
  }
}

export function initializeChangePlanRegistry(options: ChangePlanOptions): ChangePlan[] {
  const path = registryPath(options.workspaceRoot);
  ensureParent(path);
  if (!existsSync(path)) writeFileSync(path, "[]\n", "utf8");
  return loadChangePlanRegistry(options);
}

export function loadChangePlanRegistry(options: ChangePlanOptions): ChangePlan[] {
  const path = registryPath(options.workspaceRoot);
  if (!existsSync(path)) return [];
  const parsed = JSON.parse(readFileSync(path, "utf8")) as ChangePlan[];
  return Array.isArray(parsed) ? parsed : [];
}

export function saveChangePlanRegistry(options: ChangePlanOptions, plans: ChangePlan[]): void {
  const path = registryPath(options.workspaceRoot);
  ensureParent(path);
  writeFileSync(path, `${JSON.stringify(plans, null, 2)}\n`, "utf8");
}

export function writeChangePlanEvent(options: ChangePlanOptions, event: Record<string, unknown>): void {
  const path = eventPath(options.workspaceRoot);
  ensureParent(path);
  appendFileSync(path, `${JSON.stringify({ ...event, at: nowIso() })}\n`, "utf8");
}

export function listChangePlans(options: ChangePlanOptions): ChangePlan[] {
  return loadChangePlanRegistry(options);
}

export function addOrUpdateChangePlan(options: ChangePlanAddOptions): ChangePlan {
  validatePlan(options);
  const plans = loadChangePlanRegistry(options);
  const existingIndex = plans.findIndex((plan) => plan.taskId === options.taskId && plan.actor === options.actor && plan.action === options.action && (plan.target || "") === (options.target || "") && plan.status !== "revoked");
  const existing = existingIndex >= 0 ? plans[existingIndex] : undefined;
  const createdAt = existing?.createdAt ?? nowIso();
  const plan: ChangePlan = {
    planId: existing?.planId ?? `change-plan.${sanitize(options.taskId).toLowerCase()}.${randomUUID()}`,
    taskId: sanitize(options.taskId),
    actor: sanitize(options.actor),
    action: sanitize(options.action),
    target: options.target ? sanitize(options.target) : undefined,
    status: options.approvedBy ? "approved" : "active",
    riskLevel: options.riskLevel,
    createdAt,
    updatedAt: nowIso(),
    expiresAt: options.expiresAt ? sanitize(options.expiresAt) : undefined,
    createdBy: sanitize(options.createdBy),
    approvedBy: options.approvedBy ? sanitize(options.approvedBy) : undefined,
    approvedAt: options.approvedBy ? nowIso() : undefined,
    reason: sanitize(options.reason),
    summary: sanitize(options.summary),
    expectedFiles: options.expectedFiles.map(normalizeFile),
    checks: options.checks.map(normalizeCheck),
    rollbackRef: options.rollbackRef ? sanitize(options.rollbackRef) : undefined,
    waiverId: options.waiverId ? sanitize(options.waiverId) : undefined,
    requiresOwnerReview: Boolean(options.requiresOwnerReview),
    ownerReviewBy: options.ownerReviewBy ? sanitize(options.ownerReviewBy) : undefined,
    simulationDecision: options.simulationDecision ? sanitize(options.simulationDecision) : undefined,
    simulationMatchedRules: sanitizeList(options.simulationMatchedRules ?? []),
    notes: sanitizeList(options.notes ?? [])
  };
  if (existingIndex >= 0) plans[existingIndex] = plan;
  else plans.push(plan);
  saveChangePlanRegistry(options, plans);
  writeChangePlanEvent(options, { event: existing ? "change-plan-update" : "change-plan-add", taskId: plan.taskId, planId: plan.planId, status: plan.status });
  return plan;
}

export function findChangePlans(options: ChangePlanOptions & { taskId: string; actor?: string; action?: string; target?: string }): ChangePlan[] {
  return loadChangePlanRegistry(options).filter((plan) => {
    if (plan.taskId !== options.taskId) return false;
    if (options.actor && plan.actor !== options.actor) return false;
    if (options.action && plan.action !== options.action) return false;
    if (options.target && plan.target !== options.target) return false;
    return true;
  });
}

export function evaluateChangePlan(options: ChangePlanOptions & { taskId: string; actor: string; action: string; target?: string }): ChangePlanSignal {
  const matches = findChangePlans(options);
  const activeMatches = matches.filter((plan) => plan.status !== "revoked" && !isExpired(plan));
  const selected = activeMatches.find((plan) => plan.status === "approved") ?? activeMatches[0];
  const reasons: string[] = [];
  const warnings: string[] = [];
  if (!selected) reasons.push("No active matching change plan found.");
  if (selected && selected.riskLevel !== "low" && !selected.rollbackRef) warnings.push("Change plan has no rollbackRef.");
  if (selected && selected.requiresOwnerReview && !selected.ownerReviewBy) warnings.push("Change plan requires owner review but ownerReviewBy is missing.");
  return {
    taskId: options.taskId,
    actor: options.actor,
    action: options.action,
    target: options.target,
    matched: Boolean(selected),
    planId: selected?.planId,
    status: selected?.status,
    active: Boolean(selected && selected.status !== "revoked" && !isExpired(selected)),
    approved: selected?.status === "approved",
    expired: Boolean(selected && isExpired(selected)),
    expectedFilesPresent: Boolean(selected && selected.expectedFiles.length > 0),
    checksPresent: Boolean(selected && selected.checks.length > 0),
    rollbackRefPresent: Boolean(selected?.rollbackRef),
    ownerReviewPresent: Boolean(selected?.ownerReviewBy),
    reasons,
    warnings,
    matchedPlanIds: matches.map((plan) => plan.planId)
  };
}

export function approveChangePlan(options: ChangePlanOptions & { planId: string; approvedBy: string }): ChangePlan {
  const plans = loadChangePlanRegistry(options);
  const plan = plans.find((item) => item.planId === options.planId);
  if (!plan) throw new Error(`Change plan not found: ${options.planId}`);
  plan.status = "approved";
  plan.approvedBy = sanitize(options.approvedBy);
  plan.approvedAt = nowIso();
  plan.updatedAt = plan.approvedAt;
  saveChangePlanRegistry(options, plans);
  writeChangePlanEvent(options, { event: "change-plan-approve", taskId: plan.taskId, planId: plan.planId, approvedBy: plan.approvedBy });
  return plan;
}

export function revokeChangePlan(options: ChangePlanOptions & { planId: string; reason: string; revokedBy: string }): ChangePlan {
  const plans = loadChangePlanRegistry(options);
  const plan = plans.find((item) => item.planId === options.planId);
  if (!plan) throw new Error(`Change plan not found: ${options.planId}`);
  plan.status = "revoked";
  plan.updatedAt = nowIso();
  plan.notes.push(`revoked by ${sanitize(options.revokedBy)}: ${sanitize(options.reason)}`);
  saveChangePlanRegistry(options, plans);
  writeChangePlanEvent(options, { event: "change-plan-revoke", taskId: plan.taskId, planId: plan.planId, revokedBy: sanitize(options.revokedBy) });
  return plan;
}

export function parseChangePlanFileInput(input: string): ChangePlanFile {
  const parts = input.split("|").map((part) => part.trim());
  return {
    path: parts[0] || "unknown",
    changeType: (parts[1] as ChangePlanFile["changeType"]) || "unknown",
    reason: parts[2] || "Declared in change plan."
  };
}

export function parseChangePlanCheckInput(input: string): ChangePlanCheck {
  const parts = input.split("|").map((part) => part.trim());
  return {
    command: parts[0] || "npm test -- --run",
    required: parts[1] !== "optional",
    expectedResult: parts[2] || "Command passes."
  };
}

export function formatChangePlanCheck(signal: ChangePlanSignal): string {
  return [
    "Change Plan Check Result:",
    `- Matched: ${signal.matched}`,
    `- Active: ${signal.active}`,
    `- Approved: ${signal.approved}`,
    `- Plan ID: ${signal.planId || "n/a"}`,
    `- Expected files present: ${signal.expectedFilesPresent}`,
    `- Checks present: ${signal.checksPresent}`,
    `- Rollback ref present: ${signal.rollbackRefPresent}`,
    `- Owner review present: ${signal.ownerReviewPresent}`,
    "- Reasons:",
    ...(signal.reasons.length > 0 ? signal.reasons.map((reason) => `  * ${reason}`) : ["  * none"]),
    "- Warnings:",
    ...(signal.warnings.length > 0 ? signal.warnings.map((warning) => `  * ${warning}`) : ["  * none"])
  ].join("\n");
}
