import * as fs from "node:fs";
import * as path from "node:path";
import { checkGuardianAccess, type GuardianCheckResult, type GuardianDecision } from "./guardian-acl.ts";
import {
  applySafeMaintenancePlan,
  createMaintenancePlan,
  type MaintenanceFinding,
  type MaintenancePlan
} from "./maintenance.ts";
import { dependencyCheck, type DependencyAction, type DependencyDecision } from "./dependency-guard.ts";
import { buildReportIndex, writeReportIndex } from "./report-indexer.ts";

export interface MaintenanceAutopilotOptions {
  workspaceRoot: string;
  projectPath?: string;
  taskId?: string;
  scope?: string | string[];
  only?: string[];
  maxActions?: number;
  dryRun?: boolean;
  actor?: string;
  writeLog?: boolean;
  now?: string;
}

export interface MaintenanceAutopilotBlockedCandidate {
  path: string;
  decision: DependencyDecision;
  reasons: string[];
}

export interface MaintenanceAutopilotResult {
  ok: boolean;
  runId: string;
  timestamp: string;
  taskId: string;
  actor: string;
  dryRun: boolean;
  maxActions: number;
  scopes: string[];
  guardianDecision: GuardianDecision | "NOT_RUN";
  dependencyDecisionCounts: Record<DependencyDecision, number>;
  plannedActionsCount: number;
  blockedCount: number;
  logPath: string;
  warnings: string[];
  result: "ALLOW_DRY_RUN" | "DENY" | "FAILED";
  reportIndexSummary: {
    total: number;
    orphaned: number;
    stale: number;
    duplicateTaskIds: number;
  };
  plannedFindings: number;
  actions: number;
  escalations: number;
  recommendations: string[];
  blockedCandidates: MaintenanceAutopilotBlockedCandidate[];
}

interface AutopilotRunLogEntry {
  timestamp: string;
  taskId: string;
  actor: string;
  dryRun: boolean;
  scope: string[];
  only: string[];
  maxActions: number;
  guardianDecision: MaintenanceAutopilotResult["guardianDecision"];
  dependencySummary: Record<DependencyDecision, number>;
  plannedActionsCount: number;
  blockedCount: number;
  warnings: string[];
  result: MaintenanceAutopilotResult["result"];
}

const DEFAULT_ACTOR = "maintenance.autopilot";
const DEFAULT_TASK_ID = "HERMES-MAINTENANCE-AUTOPILOT-001B";
const DEPENDENCY_DECISIONS: DependencyDecision[] = ["ALLOW", "DENY", "REQUIRE_WAIVER_PLAN", "ALLOW_WITH_IMPACT_PLAN", "ESCALATE"];

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function appendJsonl(filePath: string, value: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, `${JSON.stringify(value)}\n`, "utf8");
}

function normalizeScopes(options: MaintenanceAutopilotOptions): string[] {
  const fromScope = Array.isArray(options.scope) ? options.scope : options.scope ? [options.scope] : [];
  const scopes = [...fromScope, ...(options.only || [])]
    .flatMap((item) => item.split(","))
    .map((item) => item.trim())
    .filter(Boolean);
  return scopes.length > 0 ? Array.from(new Set(scopes)) : ["reports"];
}

function guardianTargetForScope(scope: string): string {
  const normalized = scope.toLowerCase();
  if (["temp", "quarantine"].includes(normalized)) return "temp";
  if (["logs", "write_log"].includes(normalized)) return "logs";
  if (["index", "indexes", "reports-index", "reports/indexes"].includes(normalized)) return "reports/indexes";
  return "reports";
}

function isGuardianCompatible(result: GuardianCheckResult, dryRun: boolean): boolean {
  return result.decision === "ALLOW" || (dryRun && result.decision === "REQUIRE_DRY_RUN");
}

function makeDecisionCounts(): Record<DependencyDecision, number> {
  return Object.fromEntries(DEPENDENCY_DECISIONS.map((decision) => [decision, 0])) as Record<DependencyDecision, number>;
}

function dependencyActionForFinding(finding: MaintenanceFinding): DependencyAction {
  return finding.decision === "ARCHIVE" ? "archive" : "quarantine";
}

function isActionableFinding(finding: MaintenanceFinding): boolean {
  return finding.decision === "ARCHIVE" || finding.decision === "QUARANTINE";
}

function countEscalations(plan?: MaintenancePlan): number {
  if (!plan) return 0;
  return plan.findings.filter((finding) => finding.decision === "ESCALATE" || finding.quartermasterDecision === "ESCALATE").length;
}

function summarizeReportIndex(index?: ReturnType<typeof buildReportIndex>): MaintenanceAutopilotResult["reportIndexSummary"] {
  return {
    total: index?.summary.total ?? 0,
    orphaned: index?.summary.orphaned ?? 0,
    stale: index?.summary.stale ?? 0,
    duplicateTaskIds: index?.summary.duplicateTaskIds.length ?? 0
  };
}

function safePlanForAllowedFindings(plan: MaintenancePlan, allowedFindings: MaintenanceFinding[]): MaintenancePlan {
  const allowed = new Set(allowedFindings.map((finding) => finding.path));
  return {
    ...plan,
    findings: plan.findings.filter((finding) => !isActionableFinding(finding) || allowed.has(finding.path))
  };
}

function logRun(logPath: string, result: MaintenanceAutopilotResult): void {
  const entry: AutopilotRunLogEntry = {
    timestamp: result.timestamp,
    taskId: result.taskId,
    actor: result.actor,
    dryRun: result.dryRun,
    scope: result.scopes,
    only: result.scopes,
    maxActions: result.maxActions,
    guardianDecision: result.guardianDecision,
    dependencySummary: result.dependencyDecisionCounts,
    plannedActionsCount: result.plannedActionsCount,
    blockedCount: result.blockedCount,
    warnings: result.warnings,
    result: result.result
  };
  appendJsonl(logPath, entry);
}

function buildResult(input: {
  workspaceRoot: string;
  now: string;
  taskId: string;
  actor: string;
  dryRun: boolean;
  maxActions: number;
  scopes: string[];
  guardianDecision: MaintenanceAutopilotResult["guardianDecision"];
  dependencyDecisionCounts?: Record<DependencyDecision, number>;
  plannedActionsCount?: number;
  blockedCount?: number;
  warnings?: string[];
  result: MaintenanceAutopilotResult["result"];
  reportIndex?: ReturnType<typeof buildReportIndex>;
  plan?: MaintenancePlan;
  blockedCandidates?: MaintenanceAutopilotBlockedCandidate[];
}): MaintenanceAutopilotResult {
  const plannedActionsCount = input.plannedActionsCount ?? 0;
  const recommendations = [
    "Review dry-run actions before enabling any scheduled safe apply.",
    "Keep delete disabled.",
    "Use --max-actions for every manual maintenance-apply run."
  ];
  return {
    ok: input.result === "ALLOW_DRY_RUN",
    runId: `autopilot-${input.now.replace(/[:.]/g, "-")}`,
    timestamp: input.now,
    taskId: input.taskId,
    actor: input.actor,
    dryRun: input.dryRun,
    maxActions: input.maxActions,
    scopes: input.scopes,
    guardianDecision: input.guardianDecision,
    dependencyDecisionCounts: input.dependencyDecisionCounts ?? makeDecisionCounts(),
    plannedActionsCount,
    blockedCount: input.blockedCount ?? 0,
    logPath: path.join(input.workspaceRoot, "logs", "maintenance-autopilot-runs.jsonl"),
    warnings: input.warnings ?? [],
    result: input.result,
    reportIndexSummary: summarizeReportIndex(input.reportIndex),
    plannedFindings: input.plan?.findings.length ?? 0,
    actions: plannedActionsCount,
    escalations: countEscalations(input.plan),
    recommendations,
    blockedCandidates: input.blockedCandidates ?? []
  };
}

export function runMaintenanceAutopilot(options: MaintenanceAutopilotOptions): MaintenanceAutopilotResult {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const projectPath = path.resolve(options.projectPath || path.join(workspaceRoot, "codex-test"));
  const now = options.now || new Date().toISOString();
  const taskId = options.taskId || DEFAULT_TASK_ID;
  const actor = options.actor || DEFAULT_ACTOR;
  const maxActions = options.maxActions ?? 10;
  const scopes = normalizeScopes(options);
  const dryRun = options.dryRun !== false;
  const warnings: string[] = [];

  if (maxActions < 0) {
    throw new Error("maxActions must be non-negative");
  }
  if (!dryRun) {
    throw new Error("Maintenance autopilot v1B is dry-run only");
  }

  const guardianChecks = scopes.map((scope) => checkGuardianAccess({
    workspaceRoot,
    taskId,
    actor,
    action: "dry_run",
    target: guardianTargetForScope(scope),
    dryRun: true,
    actionCount: maxActions,
    writeAudit: false
  }));
  const blockedGuardian = guardianChecks.find((check) => !isGuardianCompatible(check, dryRun));
  if (blockedGuardian) {
    warnings.push(...blockedGuardian.reasons.map((reason) => `Guardian blocked autopilot: ${reason}`));
    const result = buildResult({
      workspaceRoot,
      now,
      taskId,
      actor,
      dryRun,
      maxActions,
      scopes,
      guardianDecision: blockedGuardian.decision,
      blockedCount: 1,
      warnings,
      result: "DENY"
    });
    if (options.writeLog !== false) logRun(result.logPath, result);
    return result;
  }

  const plan = createMaintenancePlan({ workspaceRoot, taskId, only: scopes });
  const dependencyDecisionCounts = makeDecisionCounts();
  const allowedFindings: MaintenanceFinding[] = [];
  const blockedCandidates: MaintenanceAutopilotBlockedCandidate[] = [];

  for (const finding of plan.findings.filter(isActionableFinding)) {
    const dependencyResult = dependencyCheck({
      workspaceRoot,
      taskId,
      actor,
      action: dependencyActionForFinding(finding),
      target: finding.path,
      dryRun: true,
      reason: "maintenance autopilot dry-run candidate"
    });
    dependencyDecisionCounts[dependencyResult.decision] += 1;
    if (dependencyResult.decision === "ALLOW" || dependencyResult.decision === "ALLOW_WITH_IMPACT_PLAN") {
      allowedFindings.push(finding);
      continue;
    }
    blockedCandidates.push({
      path: finding.relativePath,
      decision: dependencyResult.decision,
      reasons: dependencyResult.reasons
    });
  }

  const safePlan = safePlanForAllowedFindings(plan, allowedFindings);
  const actions = applySafeMaintenancePlan(safePlan, { dryRun: true, maxActions, only: scopes });
  let reportIndex: ReturnType<typeof buildReportIndex> | undefined;
  try {
    reportIndex = buildReportIndex({ workspaceRoot, projectPath, now });
    writeReportIndex(reportIndex);
  } catch (error) {
    warnings.push(`Report index update warning: ${error instanceof Error ? error.message : String(error)}`);
  }

  const result = buildResult({
    workspaceRoot,
    now,
    taskId,
    actor,
    dryRun,
    maxActions,
    scopes,
    guardianDecision: "ALLOW",
    dependencyDecisionCounts,
    plannedActionsCount: actions.length,
    blockedCount: blockedCandidates.length,
    warnings,
    result: "ALLOW_DRY_RUN",
    reportIndex,
    plan,
    blockedCandidates
  });
  if (options.writeLog !== false) logRun(result.logPath, result);
  return result;
}

export function formatMaintenanceAutopilotResult(result: MaintenanceAutopilotResult): string {
  return [
    `Maintenance autopilot run: ${result.runId}`,
    `OK: ${result.ok}`,
    `Result: ${result.result}`,
    `Dry run: ${result.dryRun ? "yes" : "no"}`,
    `Actor: ${result.actor}`,
    `Scopes: ${result.scopes.join(",")}`,
    `Max actions: ${result.maxActions}`,
    `Guardian: ${result.guardianDecision}`,
    `Planned findings: ${result.plannedFindings}`,
    `Dry-run actions: ${result.plannedActionsCount}`,
    `Blocked candidates: ${result.blockedCount}`,
    `Dependency decisions: ${JSON.stringify(result.dependencyDecisionCounts)}`,
    `Report index total: ${result.reportIndexSummary.total}`,
    `Report index orphaned: ${result.reportIndexSummary.orphaned}`,
    `Report index stale: ${result.reportIndexSummary.stale}`,
    `Report index duplicate taskIds: ${result.reportIndexSummary.duplicateTaskIds}`,
    `Log: ${result.logPath}`,
    "Warnings:",
    ...(result.warnings.length > 0 ? result.warnings.map((item) => `- ${item}`) : ["- none"]),
    "Recommendations:",
    ...result.recommendations.map((item) => `- ${item}`)
  ].join("\n");
}
