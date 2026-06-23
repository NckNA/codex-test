import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, normalize, resolve, sep } from "node:path";

export type GuardianRiskLevel = "low" | "medium" | "high" | "critical";
export type GuardianDecision = "ALLOW" | "DENY" | "REQUIRE_DRY_RUN" | "REQUIRE_APPROVAL";

export interface GuardianRolePolicy {
  actor: string;
  level: number;
  allowedZones: string[];
  forbiddenZones: string[];
  allowedActions: string[];
  forbiddenActions: string[];
  maxActions?: number;
  requiresDryRunFirst?: boolean;
  requiresReport?: boolean;
  requiresTests?: boolean;
}

export interface GuardianCheckInput {
  workspaceRoot?: string;
  taskId: string;
  actor: string;
  action: string;
  target: string;
  dryRun?: boolean;
  actionCount?: number;
  writeAudit?: boolean;
}

export interface GuardianCheckResult {
  decision: GuardianDecision;
  allowed: boolean;
  risk: GuardianRiskLevel;
  taskId: string;
  actor: string;
  action: string;
  target: string;
  zone: string;
  reasons: string[];
  requirements: string[];
  policy: GuardianRolePolicy;
}

export interface GuardianAuditEvent {
  timestamp: string;
  taskId: string;
  actor: string;
  action: string;
  target: string;
  zone: string;
  decision: GuardianDecision;
  risk: GuardianRiskLevel;
  reasons: string[];
  requirements: string[];
}

const DEFAULT_WORKSPACE_ROOT = "D:/hermes";

const DEFAULT_POLICIES: GuardianRolePolicy[] = [
  {
    actor: "auditor.readonly",
    level: 0,
    allowedZones: ["*"],
    forbiddenZones: ["secrets"],
    allowedActions: ["read", "scan", "map", "plan"],
    forbiddenActions: ["write", "move", "delete", "edit_policy", "edit_git", "mutate_registry"]
  },
  {
    actor: "archivist.indexer",
    level: 1,
    allowedZones: ["reports", "reports/indexes", "logs", "memory/indexes"],
    forbiddenZones: [".git", "policies", "projects", "worktrees", "memory/registries", "secrets"],
    allowedActions: ["read", "scan", "write_index", "write_log", "plan"],
    forbiddenActions: ["delete", "move_git_root", "edit_policy", "mutate_registry"],
    requiresReport: true
  },
  {
    actor: "maintenance.autopilot",
    level: 1,
    allowedZones: ["reports", "reports/indexes", "temp", "logs", "memory/maintenance"],
    forbiddenZones: [".git", "policies", "projects", "worktrees", "agents", "core", "memory/registries", "secrets"],
    allowedActions: ["read", "scan", "plan", "dry_run", "write_index", "write_log"],
    forbiddenActions: ["delete", "move", "edit_policy", "mutate_registry", "move_git_root"],
    maxActions: 10,
    requiresDryRunFirst: true,
    requiresReport: true
  },
  {
    actor: "maintenance.trio",
    level: 2,
    allowedZones: ["reports", "reports/archived", "temp", "quarantine", "logs", "memory/maintenance"],
    forbiddenZones: [".git", "policies", "projects", "worktrees", "agents", "core", "memory/registries", "secrets"],
    allowedActions: ["read", "scan", "plan", "archive", "quarantine", "restore", "write_log", "write_index"],
    forbiddenActions: ["delete", "move_git_root", "edit_policy", "mutate_registry"],
    maxActions: 20,
    requiresReport: true,
    requiresTests: true
  },
  {
    actor: "lifecycle.finalizer",
    level: 3,
    allowedZones: ["memory/registries", "memory/lifecycle", "reports", "logs"],
    forbiddenZones: [".git", "policies", "projects", "worktrees", "agents", "core", "secrets"],
    allowedActions: ["read", "scan", "mutate_registry", "write_log", "write_report", "plan"],
    forbiddenActions: ["delete", "move", "edit_policy", "move_git_root"],
    requiresReport: true,
    requiresTests: true
  },
  {
    actor: "hep.cli.editor",
    level: 3,
    allowedZones: ["tools/hep", "reports", "logs"],
    forbiddenZones: [".git", "policies", "memory/registries", "projects", "worktrees", "secrets"],
    allowedActions: ["read", "scan", "edit_cli", "write_code", "write_tests", "write_report", "write_log"],
    forbiddenActions: ["delete", "edit_policy", "move_git_root", "mutate_registry"],
    requiresReport: true,
    requiresTests: true
  },
  {
    actor: "human.approved.dangerous",
    level: 4,
    allowedZones: ["*"],
    forbiddenZones: ["secrets"],
    allowedActions: ["read", "scan", "plan", "archive", "quarantine", "restore", "mutate_registry", "edit_cli", "write_code", "write_tests", "write_report", "delete"],
    forbiddenActions: ["output_secret"],
    requiresReport: true,
    requiresTests: true
  }
];

function toPosixPath(value: string): string {
  return value.replace(/\\/g, "/");
}

function isInside(parent: string, child: string): boolean {
  const parentNorm = normalize(parent);
  const childNorm = normalize(child);
  return childNorm === parentNorm || childNorm.startsWith(parentNorm.endsWith(sep) ? parentNorm : `${parentNorm}${sep}`);
}

function relativeTarget(workspaceRoot: string, target: string): string {
  const root = resolve(workspaceRoot);
  const absoluteTarget = isAbsolute(target) ? resolve(target) : resolve(root, target);
  if (!isInside(root, absoluteTarget)) {
    return "outside-workspace";
  }
  const relative = absoluteTarget.slice(root.length).replace(/^[/\\]+/, "");
  return toPosixPath(relative || ".");
}

export function detectGuardianZone(workspaceRoot: string, target: string): string {
  const rel = relativeTarget(workspaceRoot, target);
  if (rel === "outside-workspace") return "outside-workspace";
  if (rel === ".") return "workspace-root";
  if (rel.includes("/.git") || rel === ".git" || rel.endsWith("/.git")) return ".git";
  if (rel.match(/(^|\/)\.env(\.|$)/)) return "secrets";
  if (rel.startsWith("tools/hep/")) return "tools/hep";
  if (rel === "tools/hep") return "tools/hep";
  if (rel.startsWith("reports/indexes/")) return "reports/indexes";
  if (rel.startsWith("reports/archived/")) return "reports/archived";
  if (rel.startsWith("reports/")) return "reports";
  if (rel.startsWith("_ai_work/REPORTS/")) return "reports";
  if (rel.startsWith("memory/maintenance") || rel.startsWith("memory/maintenance-")) return "memory/maintenance";
  if (rel.startsWith("memory/lifecycle") || rel.includes("lifecycle-actions")) return "memory/lifecycle";
  if (rel.startsWith("memory/") && rel.endsWith("-registry.json")) return "memory/registries";
  if (rel.startsWith("memory/")) return "memory";
  if (rel.startsWith("policies/")) return "policies";
  if (rel.startsWith("projects/")) return "projects";
  if (rel.startsWith("worktrees/")) return "worktrees";
  if (rel.startsWith("agents/")) return "agents";
  if (rel.startsWith("core/")) return "core";
  if (rel.startsWith("logs/")) return "logs";
  if (rel.startsWith("temp/")) return "temp";
  if (rel.startsWith("quarantine/")) return "quarantine";
  return rel.split("/")[0] || "workspace-root";
}

function zoneMatches(pattern: string, zone: string): boolean {
  return pattern === "*" || zone === pattern || zone.startsWith(`${pattern}/`);
}

function actionMatches(pattern: string, action: string): boolean {
  return pattern === "*" || pattern === action;
}

export function getGuardianPolicies(workspaceRoot = DEFAULT_WORKSPACE_ROOT): GuardianRolePolicy[] {
  const policyPath = resolve(workspaceRoot, "memory", "guardian-acl.json");
  if (!existsSync(policyPath)) {
    return DEFAULT_POLICIES;
  }
  const parsed = JSON.parse(readFileSync(policyPath, "utf8")) as { roles?: GuardianRolePolicy[] };
  if (!Array.isArray(parsed.roles)) {
    return DEFAULT_POLICIES;
  }
  return parsed.roles;
}

export function writeDefaultGuardianPolicies(workspaceRoot = DEFAULT_WORKSPACE_ROOT): string {
  const policyPath = resolve(workspaceRoot, "memory", "guardian-acl.json");
  mkdirSync(dirname(policyPath), { recursive: true });
  if (!existsSync(policyPath)) {
    writeFileSync(policyPath, `${JSON.stringify({ version: 1, roles: DEFAULT_POLICIES }, null, 2)}\n`, "utf8");
  }
  return policyPath;
}

function riskFor(action: string, zone: string): GuardianRiskLevel {
  if (["delete", "edit_policy", "output_secret"].includes(action)) return "critical";
  if (["mutate_registry", "move_git_root"].includes(action)) return "high";
  if (["archive", "quarantine", "restore", "edit_cli", "write_code"].includes(action)) return "medium";
  if ([".git", "secrets", "policies", "projects", "worktrees", "core"].some((protectedZone) => zoneMatches(protectedZone, zone))) return "high";
  return "low";
}

export function checkGuardianAccess(input: GuardianCheckInput): GuardianCheckResult {
  const workspaceRoot = input.workspaceRoot ?? DEFAULT_WORKSPACE_ROOT;
  const policies = getGuardianPolicies(workspaceRoot);
  const policy = policies.find((candidate) => candidate.actor === input.actor);
  if (!policy) {
    return {
      decision: "DENY",
      allowed: false,
      risk: "high",
      taskId: input.taskId,
      actor: input.actor,
      action: input.action,
      target: input.target,
      zone: detectGuardianZone(workspaceRoot, input.target),
      reasons: [`Unknown actor: ${input.actor}`],
      requirements: ["Register actor in memory/guardian-acl.json"],
      policy: {
        actor: input.actor,
        level: -1,
        allowedZones: [],
        forbiddenZones: ["*"],
        allowedActions: [],
        forbiddenActions: ["*"]
      }
    };
  }

  const zone = detectGuardianZone(workspaceRoot, input.target);
  const risk = riskFor(input.action, zone);
  const reasons: string[] = [];
  const requirements: string[] = [];

  if (zone === "outside-workspace") {
    reasons.push("Target is outside the Hermes workspace");
  }
  if (policy.forbiddenZones.some((pattern) => zoneMatches(pattern, zone))) {
    reasons.push(`Actor ${policy.actor} is forbidden from zone ${zone}`);
  }
  if (!policy.allowedZones.some((pattern) => zoneMatches(pattern, zone))) {
    reasons.push(`Actor ${policy.actor} is not allowed in zone ${zone}`);
  }
  if (policy.forbiddenActions.some((pattern) => actionMatches(pattern, input.action))) {
    reasons.push(`Actor ${policy.actor} is forbidden to perform action ${input.action}`);
  }
  if (!policy.allowedActions.some((pattern) => actionMatches(pattern, input.action))) {
    reasons.push(`Actor ${policy.actor} is not allowed to perform action ${input.action}`);
  }
  if (policy.maxActions !== undefined && input.actionCount !== undefined && input.actionCount > policy.maxActions) {
    reasons.push(`Action count ${input.actionCount} exceeds maxActions ${policy.maxActions}`);
  }
  if (policy.requiresReport) requirements.push("write_report");
  if (policy.requiresTests) requirements.push("run_tests");
  if (policy.requiresDryRunFirst) requirements.push("dry_run_first");

  let decision: GuardianDecision = reasons.length > 0 ? "DENY" : "ALLOW";
  if (decision === "ALLOW" && policy.requiresDryRunFirst && !input.dryRun) {
    decision = "REQUIRE_DRY_RUN";
    reasons.push("Actor requires dry-run before non-dry-run execution");
  }
  if (decision === "ALLOW" && risk === "critical" && policy.level < 4) {
    decision = "REQUIRE_APPROVAL";
    reasons.push("Critical action requires explicit human-approved dangerous role");
  }

  const result: GuardianCheckResult = {
    decision,
    allowed: decision === "ALLOW",
    risk,
    taskId: input.taskId,
    actor: input.actor,
    action: input.action,
    target: input.target,
    zone,
    reasons,
    requirements,
    policy
  };

  if (input.writeAudit) {
    writeGuardianAuditEvent(workspaceRoot, result);
  }

  return result;
}

export function writeGuardianAuditEvent(workspaceRoot: string, result: GuardianCheckResult): string {
  const logPath = resolve(workspaceRoot, "logs", "guardian-acl-events.jsonl");
  mkdirSync(dirname(logPath), { recursive: true });
  const event: GuardianAuditEvent = {
    timestamp: new Date().toISOString(),
    taskId: result.taskId,
    actor: result.actor,
    action: result.action,
    target: result.target,
    zone: result.zone,
    decision: result.decision,
    risk: result.risk,
    reasons: result.reasons,
    requirements: result.requirements
  };
  appendFileSync(logPath, `${JSON.stringify(event)}\n`, "utf8");
  return logPath;
}

export function formatGuardianCheck(result: GuardianCheckResult, auditPath?: string): string {
  const lines = [
    `Guardian ACL decision: ${result.decision}`,
    `Allowed: ${result.allowed}`,
    `Risk: ${result.risk}`,
    `Task: ${result.taskId}`,
    `Actor: ${result.actor}`,
    `Action: ${result.action}`,
    `Target: ${result.target}`,
    `Zone: ${result.zone}`
  ];
  if (result.requirements.length > 0) {
    lines.push(`Requirements: ${result.requirements.join(", ")}`);
  }
  if (result.reasons.length > 0) {
    lines.push("Reasons:");
    for (const reason of result.reasons) lines.push(`- ${reason}`);
  }
  if (auditPath) {
    lines.push(`Audit log: ${auditPath}`);
  }
  return lines.join("\n");
}
