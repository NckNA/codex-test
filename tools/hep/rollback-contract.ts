import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { redactGuardrailText } from "./guardrail-blocker.ts";

export type RollbackContractStatus = "draft" | "active" | "verified" | "failed" | "revoked" | "expired";
export type RollbackStepType = "git_restore" | "git_revert" | "file_restore" | "config_restore" | "registry_restore" | "runtime_restore" | "manual_review" | "smoke_check" | "no_op";
export type RollbackRiskLevel = "low" | "medium" | "high" | "critical";
export type RollbackValidationStatus = "not_checked" | "dry_run_passed" | "dry_run_failed" | "manually_verified" | "impossible";

export interface RollbackStep {
  stepId: string;
  type: RollbackStepType;
  command?: string;
  target?: string;
  description: string;
  dryRunCommand?: string;
  expectedResult: string;
  riskLevel: RollbackRiskLevel;
  requiresManualApproval: boolean;
  forbiddenOnProtectedAssets: boolean;
}

export interface RollbackContract {
  contractId: string;
  taskId: string;
  actor: string;
  action: string;
  target?: string;
  assetId?: string;
  waiverId?: string;
  status: RollbackContractStatus;
  riskLevel: RollbackRiskLevel;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  createdBy: string;
  approvedBy?: string;
  reason: string;
  changedFiles: string[];
  affectedAssets: string[];
  rollbackSteps: RollbackStep[];
  validationStatus: RollbackValidationStatus;
  validationEvidence: string[];
  forbiddenTargets: string[];
  protectedAssetTouched: boolean;
  requiresOwnerReview: boolean;
  ownerReviewBy?: string;
  notes: string[];
  revokedAt?: string;
  revokeReason?: string;
  revokedBy?: string;
  verifiedAt?: string;
  verifiedBy?: string;
}

export interface RollbackRegistryFile {
  schemaVersion: 1;
  createdAt: string;
  updatedAt: string;
  contracts: RollbackContract[];
}

export interface RollbackSignal {
  taskId: string;
  actor: string;
  action: string;
  target?: string;
  assetId?: string;
  waiverId?: string;
  matched: boolean;
  contractId?: string;
  status?: RollbackContractStatus;
  active: boolean;
  verified: boolean;
  expired: boolean;
  validationStatus: RollbackValidationStatus;
  rollbackPlanPresent: boolean;
  rollbackStepsPresent: boolean;
  changedFilesPresent: boolean;
  protectedAssetTouched: boolean;
  requiresOwnerReview: boolean;
  ownerReviewPresent: boolean;
  canSupportWaiver: boolean;
  canSupportRiskReduction: boolean;
  reasons: string[];
  warnings: string[];
  matchedContractIds: string[];
}

export interface RollbackOptions {
  workspaceRoot: string;
}

export interface RollbackCheckOptions extends RollbackOptions {
  taskId: string;
  actor: string;
  action: string;
  target?: string;
  assetId?: string;
  waiverId?: string;
}

export interface RollbackAddOptions extends RollbackOptions {
  contractId?: string;
  taskId: string;
  actor: string;
  action: string;
  target?: string;
  assetId?: string;
  waiverId?: string;
  riskLevel?: RollbackRiskLevel;
  reason: string;
  changedFiles: string[];
  affectedAssets?: string[];
  rollbackSteps: RollbackStep[];
  validationStatus?: RollbackValidationStatus;
  validationEvidence?: string[];
  forbiddenTargets?: string[];
  protectedAssetTouched: boolean;
  requiresOwnerReview?: boolean;
  ownerReviewBy?: string;
  createdBy: string;
  approvedBy?: string;
  notes?: string[];
  expiresAt?: string;
}

function registryPath(workspaceRoot: string): string {
  return join(resolve(workspaceRoot), "memory", "rollback", "rollback-contracts.json");
}

function eventPath(workspaceRoot: string): string {
  return join(resolve(workspaceRoot), "logs", "rollback", "rollback-events.jsonl");
}

function nowIso(): string {
  return new Date().toISOString();
}

function sanitize(value: string): string {
  return redactGuardrailText(value).value;
}

function sanitizeList(values: string[] = []): string[] {
  return values.map(sanitize).filter(Boolean);
}

function normalizeAction(value: string): string {
  return value.trim().toLowerCase();
}

function normalizePath(value?: string): string | undefined {
  return value?.replaceAll("\\", "/").toLowerCase();
}

function requireText(name: string, value: string | undefined): string {
  if (!value || value.trim().length === 0) throw new Error(`${name} is required`);
  return value.trim();
}

function isExpired(contract: RollbackContract, now = new Date()): boolean {
  if (!contract.expiresAt) return false;
  const expiresAt = new Date(contract.expiresAt);
  return Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime();
}

function requiresApproval(risk: RollbackRiskLevel): boolean {
  return risk === "medium" || risk === "high" || risk === "critical";
}

function hasDryRunOrEvidence(steps: RollbackStep[], evidence: string[]): boolean {
  return steps.some((step) => Boolean(step.dryRunCommand?.trim())) || evidence.length > 0;
}

function splitCommand(command: string): string[] {
  return command.trim().split(/\s+/).filter(Boolean);
}

function isSafeDryRunCommand(command: string): boolean {
  const parts = splitCommand(command.toLowerCase());
  if (parts.length < 2 || parts[0] !== "git") return false;
  const sub = parts[1];
  const allowedSubs = new Set(["diff", "status", "rev-parse", "ls-files"]);
  if (!allowedSubs.has(sub)) return false;
  const forbiddenTokens = [";", "&&", "||", "|", ">", "<", "`", "$(", "rm", "del", "remove", "restore", "reset", "clean", "checkout", "revert", "commit", "push", "pull", "fetch"];
  const lowered = command.toLowerCase();
  return !forbiddenTokens.some((token) => lowered.includes(token));
}

function runSafeDryRun(command: string, cwd: string): string {
  if (!isSafeDryRunCommand(command)) throw new Error(`Unsafe dry-run command rejected: ${sanitize(command)}`);
  const parts = splitCommand(command);
  const output = execFileSync(parts[0], parts.slice(1), {
    cwd,
    encoding: "utf8",
    timeout: 15000,
    stdio: ["ignore", "pipe", "pipe"]
  });
  return sanitize(output.toString().slice(0, 2000));
}

function createStepFromText(command: string, riskLevel: RollbackRiskLevel): RollbackStep {
  return {
    stepId: `step.${randomUUID()}`,
    type: "git_restore",
    command: sanitize(command),
    description: "Rollback step declared from CLI input.",
    expectedResult: "Working tree returns to the expected prior state for the declared files.",
    riskLevel,
    requiresManualApproval: riskLevel === "high" || riskLevel === "critical",
    forbiddenOnProtectedAssets: true
  };
}

export function parseRollbackStepInput(command: string, riskLevel: RollbackRiskLevel, dryRunCommand?: string): RollbackStep {
  return {
    ...createStepFromText(command, riskLevel),
    dryRunCommand: dryRunCommand ? sanitize(dryRunCommand) : undefined
  };
}

function validateContract(options: RollbackAddOptions): void {
  const risk = options.riskLevel ?? "low";
  requireText("taskId", options.taskId);
  requireText("actor", options.actor);
  requireText("action", options.action);
  requireText("reason", options.reason);
  requireText("createdBy", options.createdBy);
  if (options.changedFiles.length === 0) throw new Error("changedFiles is required");
  if (options.rollbackSteps.length === 0) throw new Error("rollbackSteps is required");
  if (requiresApproval(risk) && !options.approvedBy) throw new Error("approvedBy is required for medium/high/critical rollback contracts");
  if ((risk === "high" || risk === "critical") && !hasDryRunOrEvidence(options.rollbackSteps, options.validationEvidence ?? [])) {
    throw new Error("dryRunCommand or validationEvidence is required for high/critical rollback contracts");
  }
  if (options.protectedAssetTouched && !options.ownerReviewBy) throw new Error("ownerReviewBy is required when protectedAssetTouched is true");
  if (options.expiresAt) {
    const expiresAt = new Date(options.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) throw new Error("expiresAt must be a valid ISO timestamp");
  }
}

export function initializeRollbackRegistry(options: RollbackOptions): RollbackRegistryFile {
  const createdAt = nowIso();
  const registry: RollbackRegistryFile = {
    schemaVersion: 1,
    createdAt,
    updatedAt: createdAt,
    contracts: [
      {
        contractId: "example.disabled",
        taskId: "EXAMPLE",
        actor: "example.actor",
        action: "inspect",
        status: "revoked",
        riskLevel: "low",
        createdAt: "2020-01-01T00:00:00.000Z",
        updatedAt: "2020-01-01T00:00:01.000Z",
        createdBy: "system",
        reason: "Example only; not active.",
        changedFiles: [],
        affectedAssets: [],
        rollbackSteps: [],
        validationStatus: "impossible",
        validationEvidence: [],
        forbiddenTargets: [],
        protectedAssetTouched: false,
        requiresOwnerReview: false,
        notes: ["disabled example"]
      }
    ]
  };
  const path = registryPath(options.workspaceRoot);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
  mkdirSync(dirname(eventPath(options.workspaceRoot)), { recursive: true });
  if (!existsSync(eventPath(options.workspaceRoot))) writeFileSync(eventPath(options.workspaceRoot), "", "utf8");
  writeRollbackEvent(options, { event: "rollback-init", taskId: "HERMES-ROLLBACK-CONTRACT-001" });
  return registry;
}

export function loadRollbackRegistry(options: RollbackOptions): RollbackRegistryFile {
  const path = registryPath(options.workspaceRoot);
  if (!existsSync(path)) return initializeRollbackRegistry(options);
  const parsed = JSON.parse(readFileSync(path, "utf8")) as RollbackRegistryFile;
  if (!Array.isArray(parsed.contracts)) throw new Error("Invalid rollback registry: contracts must be an array");
  return parsed;
}

export function saveRollbackRegistry(options: RollbackOptions, registry: RollbackRegistryFile): void {
  registry.updatedAt = nowIso();
  const path = registryPath(options.workspaceRoot);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
}

export function listRollbackContracts(options: RollbackOptions & { status?: RollbackContractStatus }): RollbackContract[] {
  const registry = loadRollbackRegistry(options);
  return options.status ? registry.contracts.filter((contract) => contract.status === options.status) : registry.contracts;
}

function contractMatches(contract: RollbackContract, check: RollbackCheckOptions): boolean {
  if (contract.taskId !== check.taskId) return false;
  if (contract.actor !== check.actor) return false;
  if (normalizeAction(contract.action) !== normalizeAction(check.action)) return false;
  if (contract.waiverId && check.waiverId && contract.waiverId !== check.waiverId) return false;
  if (contract.assetId && check.assetId && contract.assetId !== check.assetId) return false;
  if (contract.assetId && !check.assetId) return false;
  const contractTarget = normalizePath(contract.target);
  const checkTarget = normalizePath(check.target);
  if (contractTarget && contractTarget !== checkTarget) return false;
  return Boolean(contract.assetId || contractTarget || contract.waiverId || contract.taskId === check.taskId);
}

export function findRollbackContracts(options: RollbackCheckOptions): RollbackContract[] {
  const registry = loadRollbackRegistry(options);
  return registry.contracts.filter((contract) => contractMatches(contract, options));
}

function baseSignal(options: RollbackCheckOptions): RollbackSignal {
  return {
    taskId: options.taskId,
    actor: options.actor,
    action: options.action,
    target: options.target,
    assetId: options.assetId,
    waiverId: options.waiverId,
    matched: false,
    active: false,
    verified: false,
    expired: false,
    validationStatus: "not_checked",
    rollbackPlanPresent: false,
    rollbackStepsPresent: false,
    changedFilesPresent: false,
    protectedAssetTouched: false,
    requiresOwnerReview: false,
    ownerReviewPresent: false,
    canSupportWaiver: false,
    canSupportRiskReduction: false,
    reasons: [],
    warnings: [],
    matchedContractIds: []
  };
}

export function evaluateRollbackContract(options: RollbackCheckOptions): RollbackSignal {
  const signal = baseSignal(options);
  const path = registryPath(options.workspaceRoot);
  if (!existsSync(path)) {
    return { ...signal, warnings: ["Rollback registry is missing; no contract can be evaluated."] };
  }

  let matches: RollbackContract[];
  try {
    matches = findRollbackContracts(options).filter((contract) => contract.contractId !== "example.disabled");
  } catch (error) {
    return { ...signal, warnings: [`Rollback registry unavailable: ${error instanceof Error ? error.message : String(error)}`] };
  }

  if (matches.length === 0) return { ...signal, reasons: ["No matching rollback contract found."] };

  const contract = matches[0];
  const expired = isExpired(contract);
  const revoked = contract.status === "revoked";
  const verified = contract.status === "verified" || contract.validationStatus === "dry_run_passed" || contract.validationStatus === "manually_verified";
  const active = (contract.status === "active" || contract.status === "verified") && !expired && !revoked;
  const rollbackStepsPresent = contract.rollbackSteps.length > 0;
  const changedFilesPresent = contract.changedFiles.length > 0;
  const ownerReviewPresent = Boolean(contract.ownerReviewBy);
  const evidencePresent = contract.validationEvidence.length > 0 || contract.rollbackSteps.some((step) => Boolean(step.dryRunCommand));
  const canSupportWaiver = active && rollbackStepsPresent && changedFilesPresent && (!contract.protectedAssetTouched || ownerReviewPresent);

  return {
    ...signal,
    matched: true,
    contractId: contract.contractId,
    status: contract.status,
    active,
    verified,
    expired,
    validationStatus: contract.validationStatus,
    rollbackPlanPresent: rollbackStepsPresent,
    rollbackStepsPresent,
    changedFilesPresent,
    protectedAssetTouched: contract.protectedAssetTouched,
    requiresOwnerReview: contract.requiresOwnerReview,
    ownerReviewPresent,
    canSupportWaiver,
    canSupportRiskReduction: canSupportWaiver && evidencePresent,
    reasons: active ? [`Matched active rollback contract ${contract.contractId}.`] : [`Matched rollback contract ${contract.contractId}, but it is not active.`],
    warnings: [
      ...(expired ? [`Rollback contract ${contract.contractId} is expired.`] : []),
      ...(revoked ? [`Rollback contract ${contract.contractId} is revoked.`] : []),
      ...(contract.protectedAssetTouched && !ownerReviewPresent ? ["Rollback contract touches a protected asset and lacks owner review."] : []),
      ...(!evidencePresent ? ["Rollback contract lacks dry-run command or validation evidence."] : [])
    ],
    matchedContractIds: matches.map((item) => item.contractId)
  };
}

export function addOrUpdateRollbackContract(options: RollbackAddOptions): RollbackContract {
  validateContract(options);
  const registry = loadRollbackRegistry(options);
  const at = nowIso();
  const riskLevel = options.riskLevel ?? "low";
  const contractId = options.contractId || `rollback.${options.taskId.toLowerCase()}.${options.actor.replace(/[^a-z0-9._-]/gi, "-")}.${normalizeAction(options.action)}.${Date.now()}`;
  const existing = registry.contracts.find((contract) => contract.contractId === contractId);
  const contract: RollbackContract = {
    contractId,
    taskId: options.taskId,
    actor: options.actor,
    action: normalizeAction(options.action),
    target: options.target,
    assetId: options.assetId,
    waiverId: options.waiverId,
    status: "active",
    riskLevel,
    createdAt: existing?.createdAt ?? at,
    updatedAt: at,
    expiresAt: options.expiresAt,
    createdBy: sanitize(options.createdBy),
    approvedBy: options.approvedBy ? sanitize(options.approvedBy) : undefined,
    reason: sanitize(options.reason),
    changedFiles: sanitizeList(options.changedFiles),
    affectedAssets: sanitizeList(options.affectedAssets),
    rollbackSteps: options.rollbackSteps.map((step) => ({
      ...step,
      command: step.command ? sanitize(step.command) : undefined,
      dryRunCommand: step.dryRunCommand ? sanitize(step.dryRunCommand) : undefined,
      description: sanitize(step.description),
      expectedResult: sanitize(step.expectedResult),
      target: step.target ? sanitize(step.target) : undefined
    })),
    validationStatus: options.validationStatus ?? "not_checked",
    validationEvidence: sanitizeList(options.validationEvidence),
    forbiddenTargets: sanitizeList(options.forbiddenTargets),
    protectedAssetTouched: options.protectedAssetTouched,
    requiresOwnerReview: options.requiresOwnerReview ?? options.protectedAssetTouched,
    ownerReviewBy: options.ownerReviewBy ? sanitize(options.ownerReviewBy) : undefined,
    notes: sanitizeList(options.notes)
  };

  const index = registry.contracts.findIndex((item) => item.contractId === contractId);
  if (index >= 0) registry.contracts[index] = contract;
  else registry.contracts.push(contract);
  saveRollbackRegistry(options, registry);
  writeRollbackEvent(options, { event: "rollback-add", taskId: contract.taskId, contractId, action: contract.action });
  return contract;
}

export function revokeRollbackContract(options: RollbackOptions & { contractId: string; reason: string; revokedBy?: string }): RollbackContract {
  const registry = loadRollbackRegistry(options);
  const contract = registry.contracts.find((item) => item.contractId === options.contractId);
  if (!contract) throw new Error(`Rollback contract not found: ${options.contractId}`);
  contract.status = "revoked";
  contract.updatedAt = nowIso();
  contract.revokedAt = contract.updatedAt;
  contract.revokeReason = sanitize(requireText("reason", options.reason));
  contract.revokedBy = options.revokedBy ? sanitize(options.revokedBy) : undefined;
  saveRollbackRegistry(options, registry);
  writeRollbackEvent(options, { event: "rollback-revoke", taskId: contract.taskId, contractId: contract.contractId });
  return contract;
}

export function verifyRollbackContract(options: RollbackOptions & { contractId: string; verifiedBy: string; repositoryPath?: string }): RollbackContract {
  const registry = loadRollbackRegistry(options);
  const contract = registry.contracts.find((item) => item.contractId === options.contractId);
  if (!contract) throw new Error(`Rollback contract not found: ${options.contractId}`);
  if (contract.status === "revoked") throw new Error(`Rollback contract is revoked: ${options.contractId}`);
  if (contract.protectedAssetTouched && !contract.ownerReviewBy) throw new Error("Owner review is required before verification for protected assets");
  const cwd = resolve(options.repositoryPath ?? process.cwd());
  const evidence: string[] = [];
  const commands = contract.rollbackSteps
    .map((step) => step.dryRunCommand?.trim())
    .filter((command): command is string => Boolean(command));
  if (commands.length === 0) throw new Error("No dry-run commands available for rollback verification");

  try {
    for (const command of commands) {
      const output = runSafeDryRun(command, cwd);
      evidence.push(`dry-run passed: ${sanitize(command)}${output ? ` | output: ${output}` : ""}`);
    }
    contract.status = "verified";
    contract.validationStatus = "dry_run_passed";
    contract.verifiedBy = sanitize(options.verifiedBy);
  } catch (error) {
    contract.status = "failed";
    contract.validationStatus = "dry_run_failed";
    contract.verifiedBy = sanitize(options.verifiedBy);
    evidence.push(`dry-run failed: ${error instanceof Error ? sanitize(error.message) : sanitize(String(error))}`);
  }

  contract.updatedAt = nowIso();
  contract.verifiedAt = contract.updatedAt;
  contract.validationEvidence.push(...evidence);
  saveRollbackRegistry(options, registry);
  writeRollbackEvent(options, { event: "rollback-dry-run-verify", taskId: contract.taskId, contractId: contract.contractId, status: contract.validationStatus });
  return contract;
}

export function markRollbackVerified(options: RollbackOptions & { contractId: string; verifiedBy: string; evidence?: string }): RollbackContract {
  const registry = loadRollbackRegistry(options);
  const contract = registry.contracts.find((item) => item.contractId === options.contractId);
  if (!contract) throw new Error(`Rollback contract not found: ${options.contractId}`);
  contract.status = "verified";
  contract.validationStatus = "manually_verified";
  contract.updatedAt = nowIso();
  contract.verifiedAt = contract.updatedAt;
  contract.verifiedBy = sanitize(options.verifiedBy);
  if (options.evidence) contract.validationEvidence.push(sanitize(options.evidence));
  saveRollbackRegistry(options, registry);
  writeRollbackEvent(options, { event: "rollback-verify", taskId: contract.taskId, contractId: contract.contractId });
  return contract;
}

export function writeRollbackEvent(options: RollbackOptions, event: Record<string, unknown>): void {
  const path = eventPath(options.workspaceRoot);
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify({ generatedAt: nowIso(), ...event })}\n`, "utf8");
}

export function formatRollbackCheck(signal: RollbackSignal): string {
  const lines = [
    "Rollback Contract Check Result:",
    `- Matched: ${signal.matched}`,
    `- Active: ${signal.active}`,
    `- Contract ID: ${signal.contractId ?? "n/a"}`,
    `- Status: ${signal.status ?? "none"}`,
    `- Validation: ${signal.validationStatus}`,
    `- Rollback steps present: ${signal.rollbackStepsPresent}`,
    `- Changed files present: ${signal.changedFilesPresent}`,
    `- Protected asset touched: ${signal.protectedAssetTouched}`,
    `- Owner review present: ${signal.ownerReviewPresent}`,
    `- Can support waiver: ${signal.canSupportWaiver}`,
    `- Can support risk reduction: ${signal.canSupportRiskReduction}`
  ];
  if (signal.reasons.length > 0) lines.push("- Reasons:", ...signal.reasons.map((reason) => `  * ${sanitize(reason)}`));
  if (signal.warnings.length > 0) lines.push("- Warnings:", ...signal.warnings.map((warning) => `  * ${sanitize(warning)}`));
  return lines.join("\n");
}
