import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { redactGuardrailText } from "./guardrail-blocker.ts";

export type SelfImprovementStatus = "proposed" | "approved" | "rejected" | "completed" | "revoked" | "expired";
export type SelfImprovementRootCause = "legitimate_block" | "configuration_error" | "tooling_false_positive" | "architecture_gap" | "dirty_state" | "missing_route" | "unknown";
export type SelfImprovementRiskLevel = "low" | "medium" | "high" | "critical";

export interface SelfImprovementProposal {
  proposalId: string;
  taskId: string;
  actor: string;
  action: string;
  target?: string;
  status: SelfImprovementStatus;
  rootCause: SelfImprovementRootCause;
  riskLevel: SelfImprovementRiskLevel;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  blockerSummary: string;
  evidence: string[];
  proposedTaskId: string;
  proposedScope: string[];
  expectedBenefit: string;
  safetyChecks: string[];
  rollbackRef?: string;
  notes: string[];
}

export interface SelfImprovementSignal {
  taskId: string;
  actor: string;
  action: string;
  target?: string;
  matched: boolean;
  proposalId?: string;
  status?: SelfImprovementStatus;
  active: boolean;
  approved: boolean;
  expired: boolean;
  proposedTaskId?: string;
  rootCause?: SelfImprovementRootCause;
  riskLevel?: SelfImprovementRiskLevel;
  evidencePresent: boolean;
  scopePresent: boolean;
  safetyChecksPresent: boolean;
  rollbackRefPresent: boolean;
  canProceed: boolean;
  reasons: string[];
  warnings: string[];
  matchedProposalIds: string[];
}

export interface SelfImprovementOptions {
  workspaceRoot: string;
}

export interface SelfImprovementAddOptions extends SelfImprovementOptions {
  taskId: string;
  actor: string;
  action: string;
  target?: string;
  rootCause: SelfImprovementRootCause;
  riskLevel: SelfImprovementRiskLevel;
  createdBy: string;
  approvedBy?: string;
  blockerSummary: string;
  evidence: string[];
  proposedTaskId: string;
  proposedScope: string[];
  expectedBenefit: string;
  safetyChecks: string[];
  rollbackRef?: string;
  expiresAt?: string;
  notes?: string[];
}

const REGISTRY_RELATIVE_PATH = join("memory", "self-improvement", "self-improvement-registry.json");
const EVENT_RELATIVE_PATH = join("logs", "self-improvement", "self-improvement-events.jsonl");

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

function isExpired(proposal: SelfImprovementProposal): boolean {
  return Boolean(proposal.expiresAt && Date.parse(proposal.expiresAt) <= Date.now());
}

function validateProposal(options: SelfImprovementAddOptions): void {
  if (!options.taskId.trim()) throw new Error("Self-improvement proposal requires taskId");
  if (!options.actor.trim()) throw new Error("Self-improvement proposal requires actor");
  if (!options.action.trim()) throw new Error("Self-improvement proposal requires action");
  if (!options.createdBy.trim()) throw new Error("Self-improvement proposal requires createdBy");
  if (!options.blockerSummary.trim()) throw new Error("Self-improvement proposal requires blockerSummary");
  if (!options.proposedTaskId.trim()) throw new Error("Self-improvement proposal requires proposedTaskId");
  if (!options.expectedBenefit.trim()) throw new Error("Self-improvement proposal requires expectedBenefit");
  if (options.evidence.length === 0) throw new Error("Self-improvement proposal requires evidence");
  if (options.proposedScope.length === 0) throw new Error("Self-improvement proposal requires proposedScope");
  if (options.safetyChecks.length === 0) throw new Error("Self-improvement proposal requires safetyChecks");
  if ((options.riskLevel === "high" || options.riskLevel === "critical") && !options.rollbackRef?.trim()) {
    throw new Error("High-risk self-improvement proposal requires rollbackRef");
  }
}

export function initializeSelfImprovementRegistry(options: SelfImprovementOptions): SelfImprovementProposal[] {
  const path = registryPath(options.workspaceRoot);
  ensureParent(path);
  if (!existsSync(path)) writeFileSync(path, "[]\n", "utf8");
  return loadSelfImprovementRegistry(options);
}

export function loadSelfImprovementRegistry(options: SelfImprovementOptions): SelfImprovementProposal[] {
  const path = registryPath(options.workspaceRoot);
  if (!existsSync(path)) return [];
  const parsed = JSON.parse(readFileSync(path, "utf8")) as SelfImprovementProposal[];
  return Array.isArray(parsed) ? parsed : [];
}

export function saveSelfImprovementRegistry(options: SelfImprovementOptions, proposals: SelfImprovementProposal[]): void {
  const path = registryPath(options.workspaceRoot);
  ensureParent(path);
  writeFileSync(path, `${JSON.stringify(proposals, null, 2)}\n`, "utf8");
}

export function writeSelfImprovementEvent(options: SelfImprovementOptions, event: Record<string, unknown>): void {
  const path = eventPath(options.workspaceRoot);
  ensureParent(path);
  appendFileSync(path, `${JSON.stringify({ ...event, at: nowIso() })}\n`, "utf8");
}

export function listSelfImprovementProposals(options: SelfImprovementOptions): SelfImprovementProposal[] {
  return loadSelfImprovementRegistry(options);
}

export function addOrUpdateSelfImprovementProposal(options: SelfImprovementAddOptions): SelfImprovementProposal {
  validateProposal(options);
  const proposals = loadSelfImprovementRegistry(options);
  const existingIndex = proposals.findIndex((item) => item.taskId === options.taskId && item.actor === options.actor && item.action === options.action && (item.target || "") === (options.target || "") && item.status !== "revoked");
  const existing = existingIndex >= 0 ? proposals[existingIndex] : undefined;
  const approved = Boolean(options.approvedBy?.trim());
  const proposal: SelfImprovementProposal = {
    proposalId: existing?.proposalId ?? `self-improvement.${sanitize(options.taskId).toLowerCase()}.${randomUUID()}`,
    taskId: sanitize(options.taskId),
    actor: sanitize(options.actor),
    action: sanitize(options.action),
    target: options.target ? sanitize(options.target) : undefined,
    status: approved ? "approved" : "proposed",
    rootCause: options.rootCause,
    riskLevel: options.riskLevel,
    createdAt: existing?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
    expiresAt: options.expiresAt ? sanitize(options.expiresAt) : undefined,
    createdBy: sanitize(options.createdBy),
    approvedBy: approved ? sanitize(options.approvedBy ?? "") : undefined,
    approvedAt: approved ? nowIso() : undefined,
    blockerSummary: sanitize(options.blockerSummary),
    evidence: sanitizeList(options.evidence),
    proposedTaskId: sanitize(options.proposedTaskId),
    proposedScope: sanitizeList(options.proposedScope),
    expectedBenefit: sanitize(options.expectedBenefit),
    safetyChecks: sanitizeList(options.safetyChecks),
    rollbackRef: options.rollbackRef ? sanitize(options.rollbackRef) : undefined,
    notes: sanitizeList(options.notes ?? [])
  };
  if (existingIndex >= 0) proposals[existingIndex] = proposal;
  else proposals.push(proposal);
  saveSelfImprovementRegistry(options, proposals);
  writeSelfImprovementEvent(options, { event: existing ? "self-improvement-update" : "self-improvement-add", taskId: proposal.taskId, proposalId: proposal.proposalId, status: proposal.status });
  return proposal;
}

export function findSelfImprovementProposals(options: SelfImprovementOptions & { taskId: string; actor?: string; action?: string; target?: string }): SelfImprovementProposal[] {
  return loadSelfImprovementRegistry(options).filter((proposal) => {
    if (proposal.taskId !== options.taskId) return false;
    if (options.actor && proposal.actor !== options.actor) return false;
    if (options.action && proposal.action !== options.action) return false;
    if (options.target && proposal.target !== options.target) return false;
    return true;
  });
}

export function evaluateSelfImprovementProposal(options: SelfImprovementOptions & { taskId: string; actor: string; action: string; target?: string }): SelfImprovementSignal {
  const matches = findSelfImprovementProposals(options);
  const selected = matches.find((proposal) => proposal.status === "approved" && !isExpired(proposal)) ?? matches.find((proposal) => proposal.status !== "revoked");
  const reasons: string[] = [];
  const warnings: string[] = [];
  if (!selected) reasons.push("No matching self-improvement proposal found.");
  if (selected && selected.status !== "approved") reasons.push("Self-improvement proposal is not approved.");
  if (selected && isExpired(selected)) reasons.push("Self-improvement proposal is expired.");
  if (selected && selected.evidence.length === 0) warnings.push("Self-improvement proposal has no evidence.");
  if (selected && selected.safetyChecks.length === 0) warnings.push("Self-improvement proposal has no safety checks.");
  if (selected && (selected.riskLevel === "high" || selected.riskLevel === "critical") && !selected.rollbackRef) warnings.push("High-risk self-improvement proposal has no rollbackRef.");
  const canProceed = Boolean(selected && selected.status === "approved" && !isExpired(selected) && selected.evidence.length > 0 && selected.proposedScope.length > 0 && selected.safetyChecks.length > 0 && (selected.riskLevel === "low" || selected.riskLevel === "medium" || Boolean(selected.rollbackRef)));
  return {
    taskId: options.taskId,
    actor: options.actor,
    action: options.action,
    target: options.target,
    matched: Boolean(selected),
    proposalId: selected?.proposalId,
    status: selected?.status,
    active: Boolean(selected && selected.status !== "revoked" && !isExpired(selected)),
    approved: selected?.status === "approved",
    expired: Boolean(selected && isExpired(selected)),
    proposedTaskId: selected?.proposedTaskId,
    rootCause: selected?.rootCause,
    riskLevel: selected?.riskLevel,
    evidencePresent: Boolean(selected && selected.evidence.length > 0),
    scopePresent: Boolean(selected && selected.proposedScope.length > 0),
    safetyChecksPresent: Boolean(selected && selected.safetyChecks.length > 0),
    rollbackRefPresent: Boolean(selected?.rollbackRef),
    canProceed,
    reasons,
    warnings,
    matchedProposalIds: matches.map((proposal) => proposal.proposalId)
  };
}

export function approveSelfImprovementProposal(options: SelfImprovementOptions & { proposalId: string; approvedBy: string }): SelfImprovementProposal {
  const proposals = loadSelfImprovementRegistry(options);
  const proposal = proposals.find((item) => item.proposalId === options.proposalId);
  if (!proposal) throw new Error(`Self-improvement proposal not found: ${options.proposalId}`);
  proposal.status = "approved";
  proposal.approvedBy = sanitize(options.approvedBy);
  proposal.approvedAt = nowIso();
  proposal.updatedAt = proposal.approvedAt;
  saveSelfImprovementRegistry(options, proposals);
  writeSelfImprovementEvent(options, { event: "self-improvement-approve", taskId: proposal.taskId, proposalId: proposal.proposalId, approvedBy: proposal.approvedBy });
  return proposal;
}

export function revokeSelfImprovementProposal(options: SelfImprovementOptions & { proposalId: string; reason: string; revokedBy: string }): SelfImprovementProposal {
  const proposals = loadSelfImprovementRegistry(options);
  const proposal = proposals.find((item) => item.proposalId === options.proposalId);
  if (!proposal) throw new Error(`Self-improvement proposal not found: ${options.proposalId}`);
  proposal.status = "revoked";
  proposal.updatedAt = nowIso();
  proposal.notes.push(`revoked by ${sanitize(options.revokedBy)}: ${sanitize(options.reason)}`);
  saveSelfImprovementRegistry(options, proposals);
  writeSelfImprovementEvent(options, { event: "self-improvement-revoke", taskId: proposal.taskId, proposalId: proposal.proposalId, revokedBy: sanitize(options.revokedBy) });
  return proposal;
}

export function parseSelfImprovementList(input: string): string[] {
  return input.split(";").map((part) => part.trim()).filter(Boolean);
}

export function formatSelfImprovementCheck(signal: SelfImprovementSignal): string {
  return [
    "Self-Improvement Gate Result:",
    `- Matched: ${signal.matched}`,
    `- Active: ${signal.active}`,
    `- Approved: ${signal.approved}`,
    `- Can proceed: ${signal.canProceed}`,
    `- Proposal ID: ${signal.proposalId || "n/a"}`,
    `- Proposed task: ${signal.proposedTaskId || "n/a"}`,
    `- Root cause: ${signal.rootCause || "n/a"}`,
    `- Evidence present: ${signal.evidencePresent}`,
    `- Scope present: ${signal.scopePresent}`,
    `- Safety checks present: ${signal.safetyChecksPresent}`,
    `- Rollback ref present: ${signal.rollbackRefPresent}`,
    "- Reasons:",
    ...(signal.reasons.length > 0 ? signal.reasons.map((reason) => `  * ${reason}`) : ["  * none"]),
    "- Warnings:",
    ...(signal.warnings.length > 0 ? signal.warnings.map((warning) => `  * ${warning}`) : ["  * none"])
  ].join("\n");
}
