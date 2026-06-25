import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadChangePlanRegistry, evaluateChangePlan, type ChangePlan, type ChangePlanSignal } from "./change-plan.ts";
import { evaluateChangeset, loadChangesetRegistry, type ChangesetRecord, type ChangesetSignal } from "./changeset-registry.ts";
import { evaluateRollbackContract, loadRollbackRegistry, type RollbackContract, type RollbackSignal } from "./rollback-contract.ts";
import { evaluateWaiver, loadWaiverRegistry, type WaiverRecord, type WaiverSignal } from "./waiver-registry.ts";
import { simulateDecisionGateway, type DecisionSimulationResult } from "./decision-gateway.ts";
import { redactGuardrailText } from "./guardrail-blocker.ts";

export interface MissionControlOptions {
  workspaceRoot: string;
  repositoryPath: string;
  taskId: string;
  actor: string;
  action: string;
  target: string;
  targetType?: string;
  riskLevel?: string;
  includeSimulation?: boolean;
}

export interface MissionControlPolicySummary {
  activeTaskId?: string;
  appliedAt?: string;
  expiresAt?: string;
  gitCodeChanges?: boolean;
  appCodeChanges?: boolean;
  migrations?: boolean;
  cloudSupabaseForbidden?: boolean;
}

export interface MissionControlLatestReports {
  count: number;
  latest: string[];
}

export interface MissionControlSnapshot {
  generatedAt: string;
  taskId: string;
  actor: string;
  action: string;
  target: string;
  branch?: string;
  head?: string;
  policy: MissionControlPolicySummary;
  simulation?: Pick<DecisionSimulationResult, "decision" | "allowed" | "requiredMode" | "matchedRules" | "missingEvidence" | "recommendedNextSteps">;
  changePlan?: ChangePlanSignal;
  changeset?: ChangesetSignal;
  rollback?: RollbackSignal;
  waiver?: WaiverSignal;
  registries: {
    changePlans: number;
    changesets: number;
    rollbackContracts: number;
    waivers: number;
  };
  latestRecords: {
    changePlan?: Pick<ChangePlan, "planId" | "status" | "riskLevel" | "updatedAt">;
    changeset?: Pick<ChangesetRecord, "changesetId" | "status" | "riskLevel" | "updatedAt">;
    rollback?: Pick<RollbackContract, "contractId" | "status" | "riskLevel" | "updatedAt">;
    waiver?: Pick<WaiverRecord, "waiverId" | "status" | "riskLevel" | "updatedAt">;
  };
  reports: MissionControlLatestReports;
  blockers: string[];
  warnings: string[];
  recommendedNextAction: string;
}

function sanitize(value: string): string {
  return redactGuardrailText(value).value.trim();
}

function nowIso(): string {
  return new Date().toISOString();
}

function readJsonIfExists<T>(path: string): T | undefined {
  try {
    if (!existsSync(path)) return undefined;
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return undefined;
  }
}

function policyPath(workspaceRoot: string): string {
  return join(resolve(workspaceRoot), "super-hermes-policy.json");
}

function loadPolicySummary(workspaceRoot: string): MissionControlPolicySummary {
  const policy = readJsonIfExists<Record<string, unknown>>(policyPath(workspaceRoot));
  const allowed = (policy?.allowed ?? {}) as Record<string, unknown>;
  const forbidden = (policy?.forbidden ?? {}) as Record<string, unknown>;
  return {
    activeTaskId: typeof policy?.activeTaskId === "string" ? sanitize(policy.activeTaskId) : undefined,
    appliedAt: typeof policy?.appliedAt === "string" ? sanitize(policy.appliedAt) : undefined,
    expiresAt: typeof policy?.expiresAt === "string" ? sanitize(policy.expiresAt) : undefined,
    gitCodeChanges: typeof allowed.gitCodeChanges === "boolean" ? allowed.gitCodeChanges : undefined,
    appCodeChanges: typeof allowed.appCodeChanges === "boolean" ? allowed.appCodeChanges : undefined,
    migrations: typeof allowed.migrations === "boolean" ? allowed.migrations : undefined,
    cloudSupabaseForbidden: typeof forbidden.cloudSupabase === "boolean" ? forbidden.cloudSupabase : undefined
  };
}

function latestReports(workspaceRoot: string, taskId: string): MissionControlLatestReports {
  const reportsDir = join(resolve(workspaceRoot), "codex-test", "_ai_work", "REPORTS");
  try {
    if (!existsSync(reportsDir)) return { count: 0, latest: [] };
    const files = readdirSync(reportsDir)
      .filter((file) => file.endsWith(".md") && (file.includes(taskId) || file.startsWith("HERMES-")))
      .map((file) => ({ file, mtime: statSync(join(reportsDir, file)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    return { count: files.length, latest: files.slice(0, 5).map((item) => item.file) };
  } catch {
    return { count: 0, latest: [] };
  }
}

function newestByUpdatedAt<T extends { updatedAt?: string }>(items: T[]): T | undefined {
  return [...items].sort((a, b) => Date.parse(b.updatedAt ?? "") - Date.parse(a.updatedAt ?? ""))[0];
}

function latestChangePlan(items: ChangePlan[]): MissionControlSnapshot["latestRecords"]["changePlan"] {
  const item = newestByUpdatedAt(items);
  return item ? { planId: item.planId, status: item.status, riskLevel: item.riskLevel, updatedAt: item.updatedAt } : undefined;
}

function latestChangeset(items: ChangesetRecord[]): MissionControlSnapshot["latestRecords"]["changeset"] {
  const item = newestByUpdatedAt(items);
  return item ? { changesetId: item.changesetId, status: item.status, riskLevel: item.riskLevel, updatedAt: item.updatedAt } : undefined;
}

function latestRollback(items: RollbackContract[]): MissionControlSnapshot["latestRecords"]["rollback"] {
  const item = newestByUpdatedAt(items);
  return item ? { contractId: item.contractId, status: item.status, riskLevel: item.riskLevel, updatedAt: item.updatedAt } : undefined;
}

function latestWaiver(items: WaiverRecord[]): MissionControlSnapshot["latestRecords"]["waiver"] {
  const item = newestByUpdatedAt(items);
  return item ? { waiverId: item.waiverId, status: item.status, riskLevel: item.riskLevel, updatedAt: item.updatedAt } : undefined;
}

function recommend(snapshot: Omit<MissionControlSnapshot, "recommendedNextAction">): string {
  if (snapshot.policy.activeTaskId !== snapshot.taskId) return "Fix active task policy before doing work.";
  if (snapshot.simulation && !snapshot.simulation.allowed) return `Resolve simulation blockers: ${snapshot.simulation.matchedRules.join(", ")}`;
  if (!snapshot.changePlan?.matched) return "Create a change plan before implementation.";
  if (!snapshot.changePlan.approved && snapshot.changePlan.status !== "approved") return "Approve or review the change plan.";
  if (!snapshot.changeset?.matched) return "Record an actual changeset after implementation.";
  if (!snapshot.changeset.validated) return "Validate the changeset and resolve unplanned or missing files.";
  if (snapshot.rollback?.matched && !snapshot.rollback.verified) return "Verify rollback evidence before closing high-risk work.";
  return "Ready for report finalization or next scoped task.";
}

export function buildMissionControlSnapshot(options: MissionControlOptions): MissionControlSnapshot {
  const workspaceRoot = resolve(options.workspaceRoot);
  const taskId = sanitize(options.taskId);
  const actor = sanitize(options.actor);
  const action = sanitize(options.action);
  const target = sanitize(options.target);
  const warnings: string[] = [];
  const blockers: string[] = [];
  const policy = loadPolicySummary(workspaceRoot);

  let simulation: MissionControlSnapshot["simulation"] | undefined;
  if (options.includeSimulation !== false) {
    try {
      const sim = simulateDecisionGateway({
        workspaceRoot,
        repositoryPath: resolve(options.repositoryPath),
        taskId,
        actor,
        action,
        target,
        targetType: options.targetType as never,
        riskLevel: options.riskLevel,
        writeEvent: false,
        writeDecisionLedger: false
      });
      simulation = {
        decision: sim.decision,
        allowed: sim.allowed,
        requiredMode: sim.requiredMode,
        matchedRules: sim.matchedRules,
        missingEvidence: sim.missingEvidence,
        recommendedNextSteps: sim.recommendedNextSteps
      };
      if (!sim.allowed) blockers.push(...sim.blockers);
      warnings.push(...sim.warnings);
    } catch (error) {
      warnings.push(`Simulation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  let changePlan: ChangePlanSignal | undefined;
  let changeset: ChangesetSignal | undefined;
  let rollback: RollbackSignal | undefined;
  let waiver: WaiverSignal | undefined;

  try { changePlan = evaluateChangePlan({ workspaceRoot, taskId, actor, action, target }); } catch (error) { warnings.push(`Change plan check failed: ${error instanceof Error ? error.message : String(error)}`); }
  try { changeset = evaluateChangeset({ workspaceRoot, taskId, actor, action, target }); } catch (error) { warnings.push(`Changeset check failed: ${error instanceof Error ? error.message : String(error)}`); }
  try { rollback = evaluateRollbackContract({ workspaceRoot, taskId, actor, action, target }); } catch (error) { warnings.push(`Rollback check failed: ${error instanceof Error ? error.message : String(error)}`); }
  try { waiver = evaluateWaiver({ workspaceRoot, taskId, actor, action, target }); } catch (error) { warnings.push(`Waiver check failed: ${error instanceof Error ? error.message : String(error)}`); }

  if (policy.activeTaskId !== taskId) blockers.push("Active task policy mismatch.");
  if (changePlan && !changePlan.matched) blockers.push("No matching change plan.");
  if (changeset && changeset.matched && !changeset.validated) blockers.push("Matching changeset is not validated.");

  const changePlans = loadChangePlanRegistry({ workspaceRoot });
  const changesets = loadChangesetRegistry({ workspaceRoot });
  const rollbackRegistry = loadRollbackRegistry({ workspaceRoot });
  const waivers = loadWaiverRegistry({ workspaceRoot });
  const reports = latestReports(workspaceRoot, taskId);

  const partial: Omit<MissionControlSnapshot, "recommendedNextAction"> = {
    generatedAt: nowIso(),
    taskId,
    actor,
    action,
    target,
    policy,
    simulation,
    changePlan,
    changeset,
    rollback,
    waiver,
    registries: {
      changePlans: changePlans.length,
      changesets: changesets.length,
      rollbackContracts: rollbackRegistry.contracts.length,
      waivers: waivers.length
    },
    latestRecords: {
      changePlan: latestChangePlan(changePlans),
      changeset: latestChangeset(changesets),
      rollback: latestRollback(rollbackRegistry.contracts),
      waiver: latestWaiver(waivers)
    },
    reports,
    blockers: Array.from(new Set(blockers.map(sanitize))).filter(Boolean),
    warnings: Array.from(new Set(warnings.map(sanitize))).filter(Boolean)
  };

  return { ...partial, recommendedNextAction: recommend(partial) };
}

export function formatMissionControl(snapshot: MissionControlSnapshot): string {
  return [
    "Hermes Mission Control",
    `- Task: ${snapshot.taskId}`,
    `- Actor/action/target: ${snapshot.actor} / ${snapshot.action} / ${snapshot.target}`,
    `- Policy active task: ${snapshot.policy.activeTaskId ?? "n/a"}`,
    `- Simulation: ${snapshot.simulation?.decision ?? "n/a"} allowed=${snapshot.simulation?.allowed ?? "n/a"}`,
    `- Change plan: matched=${snapshot.changePlan?.matched ?? false} approved=${snapshot.changePlan?.approved ?? false} id=${snapshot.changePlan?.planId ?? "n/a"}`,
    `- Changeset: matched=${snapshot.changeset?.matched ?? false} validated=${snapshot.changeset?.validated ?? false} id=${snapshot.changeset?.changesetId ?? "n/a"}`,
    `- Rollback: matched=${snapshot.rollback?.matched ?? false} verified=${snapshot.rollback?.verified ?? false} id=${snapshot.rollback?.contractId ?? "n/a"}`,
    `- Waiver: matched=${snapshot.waiver?.matched ?? false} active=${snapshot.waiver?.active ?? false} id=${snapshot.waiver?.waiverId ?? "n/a"}`,
    `- Reports latest: ${snapshot.reports.latest.join(", ") || "none"}`,
    "- Blockers:",
    ...(snapshot.blockers.length > 0 ? snapshot.blockers.map((item) => `  * ${item}`) : ["  * none"]),
    "- Warnings:",
    ...(snapshot.warnings.length > 0 ? snapshot.warnings.map((item) => `  * ${item}`) : ["  * none"]),
    `- Recommended next action: ${snapshot.recommendedNextAction}`
  ].join("\n");
}
