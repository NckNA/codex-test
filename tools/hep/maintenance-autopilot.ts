import * as fs from "node:fs";
import * as path from "node:path";
import { applySafeMaintenancePlan, createMaintenancePlan } from "./maintenance.ts";
import { buildReportIndex, writeReportIndex } from "./report-indexer.ts";

export interface MaintenanceAutopilotOptions {
  workspaceRoot: string;
  projectPath?: string;
  taskId?: string;
  maxActions?: number;
  only?: string[];
  dryRun?: boolean;
  now?: string;
}

export interface MaintenanceAutopilotResult {
  runId: string;
  taskId: string;
  dryRun: boolean;
  maxActions: number;
  scopes: string[];
  reportIndexSummary: {
    total: number;
    orphaned: number;
    stale: number;
    duplicateTaskIds: number;
  };
  plannedFindings: number;
  actions: number;
  escalations: number;
  logPath: string;
  recommendations: string[];
}

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function appendJsonl(filePath: string, value: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, `${JSON.stringify(value)}\n`, "utf8");
}

export function runMaintenanceAutopilot(options: MaintenanceAutopilotOptions): MaintenanceAutopilotResult {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const projectPath = path.resolve(options.projectPath || path.join(workspaceRoot, "codex-test"));
  const now = options.now || new Date().toISOString();
  const taskId = options.taskId || "HERMES-MAINTENANCE-AUTOPILOT-001";
  const maxActions = options.maxActions ?? 10;
  const scopes = options.only && options.only.length > 0 ? options.only : ["reports"];
  const dryRun = options.dryRun !== false;

  if (!dryRun) {
    throw new Error("Maintenance autopilot v1 is dry-run only. Use maintenance-apply --safe manually for real reversible moves.");
  }
  if (maxActions < 0) {
    throw new Error("maxActions must be non-negative");
  }

  const reportIndex = buildReportIndex({ workspaceRoot, projectPath, now });
  writeReportIndex(reportIndex);
  const plan = createMaintenancePlan({ workspaceRoot, taskId, only: scopes });
  const actions = applySafeMaintenancePlan(plan, { dryRun: true, maxActions, only: scopes });
  const escalations = plan.findings.filter((finding) => finding.decision === "ESCALATE" || finding.quartermasterDecision === "ESCALATE").length;
  const logPath = path.join(workspaceRoot, "logs", "maintenance-autopilot-runs.jsonl");
  const recommendations = [
    "Review dry-run actions before enabling any scheduled safe apply.",
    "Keep delete disabled.",
    "Use --max-actions for every manual maintenance-apply run."
  ];

  const result: MaintenanceAutopilotResult = {
    runId: `autopilot-${now.replace(/[:.]/g, "-")}`,
    taskId,
    dryRun,
    maxActions,
    scopes,
    reportIndexSummary: {
      total: reportIndex.summary.total,
      orphaned: reportIndex.summary.orphaned,
      stale: reportIndex.summary.stale,
      duplicateTaskIds: reportIndex.summary.duplicateTaskIds.length
    },
    plannedFindings: plan.findings.length,
    actions: actions.length,
    escalations,
    logPath,
    recommendations
  };

  appendJsonl(logPath, result);
  return result;
}

export function formatMaintenanceAutopilotResult(result: MaintenanceAutopilotResult): string {
  return [
    `Maintenance autopilot run: ${result.runId}`,
    `Dry run: ${result.dryRun ? "yes" : "no"}`,
    `Scopes: ${result.scopes.join(",")}`,
    `Max actions: ${result.maxActions}`,
    `Planned findings: ${result.plannedFindings}`,
    `Dry-run actions: ${result.actions}`,
    `Escalations: ${result.escalations}`,
    `Report index total: ${result.reportIndexSummary.total}`,
    `Report index orphaned: ${result.reportIndexSummary.orphaned}`,
    `Report index stale: ${result.reportIndexSummary.stale}`,
    `Report index duplicate taskIds: ${result.reportIndexSummary.duplicateTaskIds}`,
    `Log: ${result.logPath}`,
    "Recommendations:",
    ...result.recommendations.map((item) => `- ${item}`)
  ].join("\n");
}
