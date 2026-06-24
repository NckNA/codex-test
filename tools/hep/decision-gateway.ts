import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { appendHermesEvent, redactEventSecrets, type HermesDecision, type HermesTargetType } from "./event-log.ts";
import { checkGuardianAccess, type GuardianCheckResult } from "./guardian-acl.ts";
import {
  dependencyCheck,
  resolveDependencyTarget,
  type DependencyAction,
  type DependencyCheckResult,
  type DependencyDecision
} from "./dependency-guard.ts";
import { listHazards, type Hazard } from "./hazard-registry.ts";
import { redactGuardrailText } from "./guardrail-blocker.ts";
import {
  evaluateDecisionPolicy,
  type DecisionPolicyInput,
  type DecisionPolicyResult
} from "./decision-policy.ts";
import { checkAssetAction, writeAssetEvent, type AssetSignal } from "./asset-registry.ts";
import { checkOwnership, type OwnershipSignal } from "./asset-ownership.ts";
import { evaluateWaiver, type WaiverSignal } from "./waiver-registry.ts";
import { evaluateRollbackContract, type RollbackSignal } from "./rollback-contract.ts";

export type DecisionGatewayDecision = "ALLOW" | "DENY" | "DRY_RUN_ONLY" | "REQUIRE_PLAN" | "ESCALATE";
export type DecisionRequiredMode = "normal" | "dry-run" | "impact-plan" | "manual-review";

export interface DecisionGatewayRequest {
  workspaceRoot: string;
  repositoryPath: string;
  taskId: string;
  actor: string;
  action: string;
  target: string;
  targetType?: HermesTargetType;
  reason?: string;
  dryRun?: boolean;
  allowImpactPlan?: boolean;
  riskLevel?: string;
  writeEvent?: boolean;
  writeDecisionLedger?: boolean;
}

export interface PolicySignal {
  status: "missing" | "loaded" | "invalid";
  policyPath: string;
  activeTaskId?: string;
  appCodeChanges?: boolean;
  migrations?: boolean;
  gitCodeChanges?: boolean;
  reasons: string[];
  warnings: string[];
}

export interface HazardSignal {
  status: "loaded" | "missing-or-empty" | "invalid";
  highOrCritical: number;
  medium: number;
  low: number;
  warnings: string[];
}

export interface DecisionGatewaySignals {
  policy: PolicySignal;
  guardian: {
    decision?: string;
    allowed?: boolean;
    zone?: string;
    risk?: string;
  };
  dependency: {
    decision?: DependencyDecision;
    allowed?: boolean;
    risk?: string;
    pathNotes?: string[];
  };
  hazards: HazardSignal;
  ownership?: OwnershipSignal;
  waiver?: WaiverSignal;
  rollback?: RollbackSignal;
}

export interface DecisionGatewayResult {
  decision: DecisionGatewayDecision;
  allowed: boolean;
  requiredMode?: DecisionRequiredMode;
  taskId: string;
  actor: string;
  action: string;
  target: string;
  normalizedTarget?: string;
  reasons: string[];
  warnings: string[];
  signals: DecisionGatewaySignals;
  guardianResult?: GuardianCheckResult;
  dependencyResult?: DependencyCheckResult;
  hazardMatches: Hazard[];
  eventWritten: boolean;
  decisionLedgerPath?: string;
  generatedAt: string;
  /** Rule IDs matched by Decision Policy for this request. */
  matchedRules: string[];
  /** Full Decision Policy result for detailed policy analysis. */
  decisionPolicyResult?: DecisionPolicyResult;
  assetSignal?: AssetSignal;
  ownershipSignal?: OwnershipSignal;
  waiverSignal?: WaiverSignal;
  rollbackSignal?: RollbackSignal;
}

interface SuperHermesPolicy {
  activeTaskId?: string;
  allowed?: {
    appCodeChanges?: boolean;
    migrations?: boolean;
    gitCodeChanges?: boolean;
  };
}

// CandidateDecision and PRECEDENCE are now owned by decision-policy.ts.

function assertRequired(name: string, value: string | undefined): string {
  if (!value || value.trim().length === 0) throw new Error(`Decision Gateway requires ${name}`);
  return value.trim();
}

function toPosixPath(value: string): string {
  return value.split(sep).join("/").replaceAll("\\", "/");
}

function isInside(parent: string, child: string): boolean {
  const root = resolve(parent);
  const target = resolve(child);
  const rootWithSeparator = root.endsWith(sep) ? root : `${root}${sep}`;
  return target === root || target.startsWith(rootWithSeparator);
}

function sanitizeString(value: string): string {
  return redactGuardrailText(value).value;
}

function sanitizeValue<T>(value: T): T {
  const eventRedacted = redactEventSecrets(value) as T;
  return deepRedact(eventRedacted) as T;
}

function deepRedact(value: unknown): unknown {
  if (typeof value === "string") return sanitizeString(value);
  if (Array.isArray(value)) return value.map((item) => deepRedact(item));
  if (value && typeof value === "object") {
    const redacted: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) redacted[key] = deepRedact(entry);
    return redacted;
  }
  return value;
}

function readPolicy(workspaceRoot: string, taskId: string, normalizedTarget?: string): PolicySignal {
  const policyPath = join(resolve(workspaceRoot), "super-hermes-policy.json");
  const signal: PolicySignal = {
    status: "missing",
    policyPath,
    reasons: [],
    warnings: []
  };
  if (!existsSync(policyPath)) {
    signal.warnings.push("Policy file missing; continuing with Guardian/Dependency/Hazard checks.");
    return signal;
  }
  try {
    const policy = JSON.parse(readFileSync(policyPath, "utf8")) as SuperHermesPolicy;
    signal.status = "loaded";
    signal.activeTaskId = policy.activeTaskId;
    signal.appCodeChanges = policy.allowed?.appCodeChanges;
    signal.migrations = policy.allowed?.migrations;
    signal.gitCodeChanges = policy.allowed?.gitCodeChanges;
    if (policy.activeTaskId && policy.activeTaskId !== taskId) {
      signal.reasons.push(`Active policy task ${policy.activeTaskId} differs from request task ${taskId}.`);
    }
    if (policy.allowed?.appCodeChanges === false && normalizedTarget && isAppCodeTarget(normalizedTarget)) {
      signal.reasons.push("Policy denies app code changes for this target.");
    }
    if (policy.allowed?.migrations === false && normalizedTarget && isMigrationTarget(normalizedTarget)) {
      signal.reasons.push("Policy denies migration changes for this target.");
    }
    return signal;
  } catch (error) {
    signal.status = "invalid";
    signal.warnings.push(`Policy file could not be parsed: ${error instanceof Error ? error.message : String(error)}`);
    return signal;
  }
}

function isAppCodeTarget(target: string): boolean {
  const normalized = target.replaceAll("\\", "/");
  return normalized === "src" || normalized.startsWith("src/") || normalized.includes("/src/");
}

function isMigrationTarget(target: string): boolean {
  return target.replaceAll("\\", "/").includes("supabase/migrations/");
}

function guardianTarget(request: DecisionGatewayRequest, normalizedTarget?: string): { workspaceRoot: string; target: string } {
  const repositoryPath = resolve(request.repositoryPath);
  const workspaceRoot = resolve(request.workspaceRoot);
  const projectPrefix = `${basename(repositoryPath)}/`;
  if (normalizedTarget?.startsWith(projectPrefix)) {
    return {
      workspaceRoot: repositoryPath,
      target: normalizedTarget.slice(projectPrefix.length)
    };
  }
  if (isAbsolute(request.target) && isInside(repositoryPath, request.target)) {
    return {
      workspaceRoot: repositoryPath,
      target: toPosixPath(relative(repositoryPath, resolve(request.target)))
    };
  }
  if (!isAbsolute(request.target) && !request.target.replaceAll("\\", "/").startsWith(projectPrefix)) {
    return {
      workspaceRoot: repositoryPath,
      target: request.target
    };
  }
  return { workspaceRoot, target: normalizedTarget || request.target };
}

function toDependencyAction(action: string): DependencyAction {
  const normalized = action.trim();
  const supported = new Set([
    "read",
    "inspect",
    "index",
    "archive",
    "quarantine",
    "move",
    "edit",
    "registry_update",
    "delete",
    "write",
    "scan",
    "edit_cli",
    "edit_registry",
    "finalize_lifecycle"
  ]);
  return (supported.has(normalized) ? normalized : "read") as DependencyAction;
}

function isReadOnlyAction(action: string): boolean {
  return ["read", "inspect", "scan", "index"].includes(action);
}

function deriveTargetArea(target: string): string {
  const normalized = target.toLowerCase().replaceAll("\\", "/");
  if (normalized.includes("tools/hep/")) return "cli";
  if (normalized.includes(".git")) return "git";
  if (normalized.includes("policy") || normalized.includes("super-hermes-policy")) return "policy";
  if (normalized.includes("memory/") || normalized.includes("reports/") || normalized.includes("logs/")) return "hep";
  if (normalized.includes("supabase") || normalized.includes("migration")) return "storage";
  return "unknown";
}

function genericTag(tag: string): boolean {
  return ["hep", "host", "git", "cli", "policy", "security", "storage", "maintenance", "windows"].includes(tag.toLowerCase());
}

function hazardMatchesRequest(hazard: Hazard, request: DecisionGatewayRequest, normalizedTarget?: string): boolean {
  if (hazard.status !== "active") return false;
  const target = normalizedTarget || request.target;
  const area = deriveTargetArea(target);
  const haystack = [target, request.action, request.reason || "", request.riskLevel || ""].join(" ").toLowerCase();
  if (haystack.includes(hazard.hazardId.toLowerCase())) return true;
  if (hazard.tags.some((tag) => tag.length >= 4 && !genericTag(tag) && haystack.includes(tag.toLowerCase()))) return true;
  return hazard.area === area && request.action !== "inspect";
}

function loadHazardMatches(request: DecisionGatewayRequest, normalizedTarget?: string): { signal: HazardSignal; matches: Hazard[] } {
  const signal: HazardSignal = {
    status: "missing-or-empty",
    highOrCritical: 0,
    medium: 0,
    low: 0,
    warnings: []
  };
  try {
    const matches = listHazards({ status: "active" }, { hermesRoot: request.workspaceRoot })
      .filter((hazard) => hazardMatchesRequest(hazard, request, normalizedTarget));
    signal.status = matches.length > 0 ? "loaded" : "missing-or-empty";
    signal.highOrCritical = matches.filter((hazard) => hazard.severity === "high" || hazard.severity === "critical").length;
    signal.medium = matches.filter((hazard) => hazard.severity === "medium").length;
    signal.low = matches.filter((hazard) => hazard.severity === "low").length;
    return { signal, matches };
  } catch (error) {
    signal.status = "invalid";
    signal.warnings.push(`Hazard registry unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return { signal, matches: [] };
  }
}

// chooseDecision moved to decision-policy.ts (evaluateDecisionPolicy).

function eventDecision(decision: DecisionGatewayDecision): HermesDecision {
  if (decision === "ALLOW") return "ALLOW";
  if (decision === "DENY") return "DENY";
  if (decision === "ESCALATE") return "ESCALATE";
  if (decision === "DRY_RUN_ONLY") return "DRY_RUN";
  return "BLOCKED";
}

function eventResult(decision: DecisionGatewayDecision): "completed" | "blocked" {
  return decision === "ALLOW" ? "completed" : "blocked";
}

function eventSeverity(decision: DecisionGatewayDecision): "info" | "warning" | "error" {
  if (decision === "ALLOW") return "info";
  if (decision === "DENY" || decision === "ESCALATE") return "error";
  return "warning";
}

function decisionLedgerPath(workspaceRoot: string): string {
  return join(resolve(workspaceRoot), "logs", "decisions", "decision-events.jsonl");
}

function writeDecisionLedger(result: DecisionGatewayResult, request: DecisionGatewayRequest): string {
  const ledgerPath = decisionLedgerPath(request.workspaceRoot);
  mkdirSync(dirname(ledgerPath), { recursive: true });
  const entry = sanitizeValue({
    generatedAt: result.generatedAt,
    taskId: result.taskId,
    actor: result.actor,
    action: result.action,
    target: result.target,
    normalizedTarget: result.normalizedTarget,
    decision: result.decision,
    allowed: result.allowed,
    requiredMode: result.requiredMode,
    reasons: result.reasons,
    warnings: result.warnings,
    reason: request.reason,
    signals: result.signals,
    hazardMatches: result.hazardMatches.map((hazard) => ({
      hazardId: hazard.hazardId,
      severity: hazard.severity,
      area: hazard.area,
      title: hazard.title
    }))
  });
  appendFileSync(ledgerPath, `${JSON.stringify(entry)}\n`, "utf8");
  return ledgerPath;
}

export function evaluateDecisionGateway(request: DecisionGatewayRequest): DecisionGatewayResult {
  const workspaceRoot = assertRequired("workspaceRoot", request.workspaceRoot);
  const repositoryPath = assertRequired("repositoryPath", request.repositoryPath);
  const taskId = assertRequired("taskId", request.taskId);
  const actor = assertRequired("actor", request.actor);
  const action = assertRequired("action", request.action);
  const target = assertRequired("target", request.target);
  const generatedAt = new Date().toISOString();
  const warnings: string[] = [];

  const resolvedTarget = resolveDependencyTarget(workspaceRoot, target, { projectPath: repositoryPath, repositoryPath });
  const normalizedTarget = resolvedTarget.relativePath;
  const policy = readPolicy(workspaceRoot, taskId, normalizedTarget);
  warnings.push(...policy.warnings);

  const guardianInput = guardianTarget(request, normalizedTarget);
  const guardianResult = checkGuardianAccess({
    workspaceRoot: guardianInput.workspaceRoot,
    taskId,
    actor,
    action,
    target: guardianInput.target,
    dryRun: request.dryRun || isReadOnlyAction(action),
    writeAudit: false
  });

  const dependencyResult = dependencyCheck({
    workspaceRoot,
    projectPath: repositoryPath,
    repositoryPath,
    taskId,
    actor,
    action: toDependencyAction(action),
    target,
    reason: request.reason,
    allowImpactPlan: request.allowImpactPlan,
    dryRun: request.dryRun
  });

  const { signal: hazardSignal, matches: hazardMatches } = loadHazardMatches(
    request,
    dependencyResult.targetAsset.path || normalizedTarget
  );
  warnings.push(...hazardSignal.warnings);

  let assetSignal: AssetSignal | undefined = undefined;
  try {
    assetSignal = checkAssetAction({
      workspaceRoot,
      repositoryPath,
      target,
      action
    });
    if (assetSignal.warnings) {
      warnings.push(...assetSignal.warnings);
    }
  } catch (error) {
    warnings.push(`Asset check failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  let ownershipSignal: OwnershipSignal | undefined = undefined;
  try {
    ownershipSignal = checkOwnership({
      workspaceRoot,
      actor,
      action,
      assetId: assetSignal?.assetId
    });
    if (ownershipSignal.warnings) {
      warnings.push(...ownershipSignal.warnings);
    }
  } catch (error) {
    warnings.push(`Ownership check failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  let waiverSignal: WaiverSignal | undefined = undefined;
  try {
    waiverSignal = evaluateWaiver({
      workspaceRoot,
      taskId,
      actor,
      action,
      target,
      assetId: assetSignal?.assetId
    });
    if (waiverSignal.warnings) {
      warnings.push(...waiverSignal.warnings);
    }
  } catch (error) {
    warnings.push(`Waiver check failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  let rollbackSignal: RollbackSignal | undefined = undefined;
  try {
    rollbackSignal = evaluateRollbackContract({
      workspaceRoot,
      taskId,
      actor,
      action,
      target,
      assetId: assetSignal?.assetId,
      waiverId: waiverSignal?.waiverId
    });
    if (rollbackSignal.warnings) {
      warnings.push(...rollbackSignal.warnings);
    }
  } catch (error) {
    warnings.push(`Rollback contract check failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  // в”Ђв”Ђ Delegate rule evaluation to Decision Policy в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
  // Gateway collects signals; Policy evaluates rules and resolves precedence.
  const policyInput: DecisionPolicyInput = {
    taskId,
    actor,
    action,
    target: dependencyResult.targetAsset.path || normalizedTarget || target,
    policySummary:
      policy.status !== "missing"
        ? {
            activeTaskId: policy.activeTaskId,
            appCodeChanges: policy.appCodeChanges,
            migrations: policy.migrations,
            status: policy.status as "loaded" | "invalid"
          }
        : undefined,
    guardianSignal: {
      decision: guardianResult.decision,
      allowed: guardianResult.allowed,
      zone: guardianResult.zone,
      risk: guardianResult.risk,
      reasons: guardianResult.reasons
    },
    dependencySignal: {
      decision: dependencyResult.decision,
      allowed: dependencyResult.allowed,
      risk: dependencyResult.risk,
      pathNotes: dependencyResult.targetAsset.notes,
      reasons: dependencyResult.reasons
    },
    hazardSignals: hazardMatches.map((h) => ({
      hazardId: h.hazardId,
      severity: h.severity,
      area: h.area,
      title: h.title
    })),
    assetSignal,
    ownershipSignal,
    waiverSignal,
    rollback: rollbackSignal,
    dryRun: request.dryRun,
    allowImpactPlan: request.allowImpactPlan,
    riskLevel: request.riskLevel
  };

  const policyResult = evaluateDecisionPolicy(policyInput);
  const decision = policyResult.decision;
  // Map "blocked" (policy) в†’ "manual-review" (gateway) for backward compatibility.
  const requiredMode: DecisionRequiredMode =
    policyResult.requiredMode === "blocked" ? "manual-review" : policyResult.requiredMode;
  const reasons = policyResult.reasons;
  for (const w of policyResult.warnings) {
    if (!warnings.includes(w)) warnings.push(w);
  }

  let eventWritten = false;
  const signals: DecisionGatewaySignals = {
    policy,
    guardian: {
      decision: guardianResult.decision,
      allowed: guardianResult.allowed,
      zone: guardianResult.zone,
      risk: guardianResult.risk
    },
    dependency: {
      decision: dependencyResult.decision,
      allowed: dependencyResult.allowed,
      risk: dependencyResult.risk,
      pathNotes: dependencyResult.targetAsset.notes
    },
    hazards: hazardSignal,
    ownership: ownershipSignal,
    waiver: waiverSignal,
    rollback: rollbackSignal
  };

  const baseResult: DecisionGatewayResult = {
    decision,
    allowed: decision === "ALLOW",
    requiredMode,
    taskId,
    actor,
    action,
    target,
    normalizedTarget: dependencyResult.targetAsset.path || normalizedTarget,
    reasons,
    warnings,
    signals,
    guardianResult,
    dependencyResult,
    hazardMatches,
    eventWritten,
    generatedAt,
    matchedRules: policyResult.matchedRules,
    decisionPolicyResult: policyResult,
    assetSignal,
    ownershipSignal,
    waiverSignal
  };

  if (assetSignal && request.writeEvent !== false) {
    try {
      writeAssetEvent({
        workspaceRoot,
        event: {
          taskId,
          actor,
          action,
          target,
          assetId: assetSignal.assetId,
          matched: assetSignal.matched,
          decision,
          allowed: baseResult.allowed,
          reasons: assetSignal.reasons,
          warnings: assetSignal.warnings
        }
      });
    } catch (err) {
      warnings.push(`Asset event write failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  let decisionLedger: string | undefined;
  if (request.writeDecisionLedger !== false) {
    decisionLedger = writeDecisionLedger(baseResult, request);
  }
  if (request.writeEvent !== false) {
    try {
      appendHermesEvent({
        taskId,
        actor,
        actorType: "script",
        action,
        target: baseResult.normalizedTarget || target,
        targetType: request.targetType || "unknown",
        decision: eventDecision(decision),
        result: eventResult(decision),
        severity: eventSeverity(decision),
        message: sanitizeString(`Decision Gateway ${decision}: ${request.reason || reasons.join("; ") || action}`),
        commandName: "decision-gateway",
        hazardRefs: hazardMatches.map((hazard) => hazard.hazardId),
        metadata: sanitizeValue({
          requiredMode,
          guardianDecision: guardianResult.decision,
          dependencyDecision: dependencyResult.decision,
          policyStatus: policy.status,
          reason: request.reason
        }) as Record<string, unknown>
      }, {
        hermesRoot: workspaceRoot,
        logPath: join(workspaceRoot, "logs", "events", "hermes-events.jsonl"),
        errorLogPath: join(workspaceRoot, "logs", "events", "event-log-errors.jsonl")
      });
      eventWritten = true;
    } catch (error) {
      warnings.push(`Event log write failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    ...baseResult,
    warnings,
    eventWritten,
    decisionLedgerPath: decisionLedger
  };
}

export interface DecisionSimulationResult {
  simulation: true;
  decision: DecisionGatewayDecision;
  allowed: boolean;
  requiredMode?: DecisionRequiredMode;
  taskId: string;
  actor: string;
  action: string;
  target: string;
  normalizedTarget?: string;
  matchedRules: string[];
  blockers: string[];
  missingEvidence: string[];
  warnings: string[];
  recommendedNextSteps: string[];
  eventWritten: false;
  decisionLedgerWritten: false;
  signals: DecisionGatewaySignals;
}

function classifySimulationEvidence(result: DecisionGatewayResult): string[] {
  const missing: string[] = [];
  if (result.signals.policy.status !== "loaded") missing.push("active policy");
  if (!result.signals.waiver?.active && result.matchedRules.some((rule) => rule.includes("WAIVER"))) missing.push("active waiver");
  const needsRollback = result.matchedRules.some((rule) => rule.includes("ROLLBACK"));
  if (needsRollback && !result.signals.rollback?.matched) missing.push("rollback contract");
  if (needsRollback && result.signals.rollback?.matched && !result.signals.rollback?.verified) missing.push("verified rollback");
  if (result.matchedRules.includes("ROLLBACK_CHANGED_FILES_MISSING")) missing.push("rollback changed files");
  if (result.matchedRules.includes("ROLLBACK_STEPS_MISSING")) missing.push("rollback steps");
  if (result.matchedRules.some((rule) => rule.includes("OWNER") || rule.includes("OWNERSHIP"))) missing.push("owner review or ownership permission");
  return Array.from(new Set(missing));
}

export function simulateDecisionGateway(request: DecisionGatewayRequest): DecisionSimulationResult {
  const result = evaluateDecisionGateway({
    ...request,
    writeEvent: false,
    writeDecisionLedger: false
  });
  return {
    simulation: true,
    decision: result.decision,
    allowed: result.allowed,
    requiredMode: result.requiredMode,
    taskId: result.taskId,
    actor: result.actor,
    action: result.action,
    target: result.target,
    normalizedTarget: result.normalizedTarget,
    matchedRules: result.matchedRules,
    blockers: result.allowed ? [] : result.reasons,
    missingEvidence: classifySimulationEvidence(result),
    warnings: result.warnings,
    recommendedNextSteps: result.decisionPolicyResult?.recommendedNextSteps ?? [],
    eventWritten: false,
    decisionLedgerWritten: false,
    signals: result.signals
  };
}

export function formatDecisionGatewayMarkdown(result: DecisionGatewayResult): string {
  const lines = [
    `# Decision Gateway: ${result.decision}`,
    "",
    `- **Allowed**: ${result.allowed}`,
    `- **Required mode**: ${result.requiredMode || "n/a"}`,
    `- **Task**: ${result.taskId}`,
    `- **Actor**: ${result.actor}`,
    `- **Action**: ${result.action}`,
    `- **Target**: ${result.target}`,
    `- **Normalized target**: ${result.normalizedTarget || "n/a"}`,
    `- **Generated at**: ${result.generatedAt}`,
    `- **Event written**: ${result.eventWritten}`,
    `- **Decision ledger**: ${result.decisionLedgerPath || "not written"}`,
    "",
    "## Matched Rules",
    "",
    ...(result.matchedRules.length > 0
      ? result.matchedRules.map((rule) => `- ${rule}`)
      : ["- none"]),
    "",
    "## Reasons",
    "",
    ...(result.reasons.length > 0 ? result.reasons.map((reason) => `- ${reason}`) : ["- none"]),
    "",
    "## Warnings",
    "",
    ...(result.warnings.length > 0 ? result.warnings.map((warning) => `- ${warning}`) : ["- none"]),
    "",
    "## Signals",
    "",
    `- Policy: ${result.signals.policy.status}${result.signals.policy.activeTaskId ? `, activeTaskId=${result.signals.policy.activeTaskId}` : ""}`,
    `- Guardian: ${result.signals.guardian.decision || "n/a"} zone=${result.signals.guardian.zone || "n/a"}`,
    `- Dependency: ${result.signals.dependency.decision || "n/a"} notes=${(result.signals.dependency.pathNotes || []).join(",") || "none"}`,
    `- Hazards: highOrCritical=${result.signals.hazards.highOrCritical}, medium=${result.signals.hazards.medium}, low=${result.signals.hazards.low}`,
    `- Asset: matched=${result.assetSignal?.matched || false} id=${result.assetSignal?.assetId || "n/a"} type=${result.assetSignal?.type || "unknown"} criticality=${result.assetSignal?.criticality || "low"} lifecycle=${result.assetSignal?.lifecycle || "unknown"}`,
    `- Ownership: matched=${result.ownershipSignal?.matched || false} owner=${result.ownershipSignal?.owner || "n/a"} role=${result.ownershipSignal?.role || "n/a"} scope=${result.ownershipSignal?.scope || "n/a"} isOwner=${result.ownershipSignal?.isOwner || false} actorAuthorized=${result.ownershipSignal?.actorAuthorized || false} forbiddenForAll=${result.ownershipSignal?.actionForbiddenForAll || false} requiresOwnerReview=${result.ownershipSignal?.requiresOwnerReview || false}`,
    `- Waiver: matched=${result.waiverSignal?.matched || false} active=${result.waiverSignal?.active || false} waiverId=${result.waiverSignal?.waiverId || "n/a"} canRelax=${result.waiverSignal?.canRelaxDecision || false} canBypassCriticalDeny=${result.waiverSignal?.canBypassCriticalDeny || false}`,
    ""
  ];
  return lines.join("\n");
}
