import { redactGuardrailText } from "./guardrail-blocker.ts";

export type BlockerCategory =
  | "legitimate_block"
  | "configuration_error"
  | "tooling_false_positive"
  | "architecture_gap"
  | "dirty_state"
  | "unknown";

export type BlockerDisposition =
  | "do_not_bypass"
  | "fix_task_or_scope"
  | "fix_policy_or_config"
  | "fix_tooling"
  | "build_missing_layer"
  | "clean_worktree"
  | "investigate";

export interface BlockerDiagnosisInput {
  taskId?: string;
  activeTaskId?: string;
  actor?: string;
  action?: string;
  target?: string;
  tool?: string;
  operation?: string;
  reason?: string;
  policyMode?: string;
  appCodeChanges?: boolean;
  gitCodeChanges?: boolean;
  migrations?: boolean;
  cloudSupabase?: boolean;
  worktreeClean?: boolean;
  expectedCapability?: string;
}

export interface BlockerDiagnosisResult {
  category: BlockerCategory;
  disposition: BlockerDisposition;
  bypassAllowed: false;
  safeToRetry: boolean;
  requiresCleanup: boolean;
  requiresPolicyChange: boolean;
  requiresToolingFix: boolean;
  requiresNewLayer: boolean;
  recommendedTaskId?: string;
  reasons: string[];
  nextSteps: string[];
  evidence: {
    taskId?: string;
    activeTaskId?: string;
    actor?: string;
    action?: string;
    target?: string;
    tool?: string;
    operation?: string;
    reason?: string;
    policyMode?: string;
  };
}

function clean(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return redactGuardrailText(value).value;
}

function haystack(input: BlockerDiagnosisInput): string {
  return [
    input.reason,
    input.tool,
    input.operation,
    input.action,
    input.target,
    input.expectedCapability,
    input.policyMode
  ].filter(Boolean).join(" ").toLowerCase();
}

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function taskMismatch(input: BlockerDiagnosisInput): boolean {
  return Boolean(input.taskId && input.activeTaskId && input.taskId !== input.activeTaskId);
}

function isAppTarget(target?: string): boolean {
  const normalized = target?.replaceAll("\\", "/").toLowerCase() ?? "";
  return normalized === "src" || normalized.startsWith("src/") || normalized.includes("/src/");
}

function isMigrationTarget(target?: string): boolean {
  return (target?.replaceAll("\\", "/").toLowerCase() ?? "").includes("supabase/migrations/");
}

function isProtectedOrExternal(text: string): boolean {
  return includesAny(text, [
    "protected asset",
    "critical asset",
    "media_rescue",
    "user documents",
    "outside-workspace",
    "outside allowed roots",
    "path contract",
    "cloud supabase",
    "service_role",
    "production credential"
  ]);
}

export function diagnoseBlocker(input: BlockerDiagnosisInput): BlockerDiagnosisResult {
  const text = haystack(input);
  const reasons: string[] = [];
  const nextSteps: string[] = [];
  let category: BlockerCategory = "unknown";
  let disposition: BlockerDisposition = "investigate";
  let safeToRetry = false;
  let requiresCleanup = false;
  let requiresPolicyChange = false;
  let requiresToolingFix = false;
  let requiresNewLayer = false;
  let recommendedTaskId: string | undefined;

  if (input.worktreeClean === false || includesAny(text, ["worktree dirty", "dirty worktree", "uncommitted", "staged changes"])) {
    category = "dirty_state";
    disposition = "clean_worktree";
    requiresCleanup = true;
    reasons.push("Worktree is not clean. Continuing would risk mixing unrelated changes.");
    nextSteps.push("Stop implementation and inspect git status.");
    nextSteps.push("Commit, stash, or revert unrelated changes before retrying.");
  } else if (taskMismatch(input) || includesAny(text, ["policy_task_mismatch", "active policy task", "differs from request task"])) {
    category = "configuration_error";
    disposition = "fix_policy_or_config";
    requiresPolicyChange = true;
    reasons.push("Active policy task does not match the requested task.");
    nextSteps.push("Apply the correct task policy for the requested taskId.");
    nextSteps.push("Re-run preflight before retrying the blocked operation.");
    safeToRetry = true;
  } else if ((isAppTarget(input.target) || includesAny(text, ["appcodechanges", "app code changes"])) && input.appCodeChanges === false) {
    category = "configuration_error";
    disposition = "fix_policy_or_config";
    requiresPolicyChange = true;
    recommendedTaskId = "HERMES-TASK-POLICY-APP-CODE-PERMISSION-001";
    reasons.push("Policy does not allow app/UI code changes for a request that appears to need them.");
    nextSteps.push("Do not bypass policy. Create or apply a UI/app task policy with explicit appCodeChanges=true and a narrow allowlist.");
    nextSteps.push("If parser cannot infer this, fix task-policy inference.");
    safeToRetry = true;
  } else if ((isMigrationTarget(input.target) || includesAny(text, ["migration", "migrations"])) && input.migrations === false) {
    category = "configuration_error";
    disposition = "fix_policy_or_config";
    requiresPolicyChange = true;
    reasons.push("Policy does not allow migrations for a migration-like target.");
    nextSteps.push("Use a schema/cloud task with explicit migration permission, or change target/scope.");
    safeToRetry = true;
  } else if (isProtectedOrExternal(text)) {
    category = "legitimate_block";
    disposition = "fix_task_or_scope";
    reasons.push("The blocker protects critical, external, cloud, credential, or protected-user-data boundaries.");
    nextSteps.push("Do not bypass. Change target/action/scope or add the required approved architecture layer.");
    nextSteps.push("For exceptional non-destructive cases, use Ownership, Waiver, and Rollback contracts within their limits.");
  } else if (includesAny(text, ["waiver registry", "rollback contract", "ownership", "mission control", "missing layer", "not implemented"])) {
    category = "architecture_gap";
    disposition = "build_missing_layer";
    requiresNewLayer = true;
    reasons.push("The blocker indicates a missing safety or governance layer rather than a one-off permission issue.");
    nextSteps.push("Create a scoped HEP task for the missing layer.");
    nextSteps.push("Keep DENY precedence intact while adding the layer.");
    recommendedTaskId = includesAny(text, ["rollback"])
      ? "HERMES-ROLLBACK-CONTRACT-001"
      : includesAny(text, ["waiver"])
        ? "HERMES-WAIVER-REGISTRY-001"
        : undefined;
  } else if (includesAny(text, ["false positive", "safety layer", "tool blocked", "blocked by safety", "ignored option", "requires --asset-id", "not found"])
  ) {
    category = "tooling_false_positive";
    disposition = "fix_tooling";
    requiresToolingFix = true;
    reasons.push("The blocker appears to come from tool behavior or CLI semantics rather than the target action itself.");
    nextSteps.push("Write a blocker report with exact tool, input, and expected capability.");
    nextSteps.push("Create a narrow tool-fix task or adjust CLI behavior, then retry safely.");
    if (includesAny(text, ["waiver-id", "ignored option"])) recommendedTaskId = "HERMES-WAIVER-CLI-ID-RESPECT-001";
  } else {
    reasons.push("The blocker could not be confidently classified from the provided evidence.");
    nextSteps.push("Collect exact tool output, active policy, taskId, actor, action, target, and git status.");
    nextSteps.push("Do not bypass until classification is clear.");
  }

  return {
    category,
    disposition,
    bypassAllowed: false,
    safeToRetry,
    requiresCleanup,
    requiresPolicyChange,
    requiresToolingFix,
    requiresNewLayer,
    recommendedTaskId,
    reasons: reasons.map((reason) => clean(reason) ?? reason),
    nextSteps: nextSteps.map((step) => clean(step) ?? step),
    evidence: {
      taskId: clean(input.taskId),
      activeTaskId: clean(input.activeTaskId),
      actor: clean(input.actor),
      action: clean(input.action),
      target: clean(input.target),
      tool: clean(input.tool),
      operation: clean(input.operation),
      reason: clean(input.reason),
      policyMode: clean(input.policyMode)
    }
  };
}

export function formatBlockerDiagnosis(result: BlockerDiagnosisResult): string {
  const lines = [
    "Blocker Root Cause Diagnosis:",
    `- Category: ${result.category}`,
    `- Disposition: ${result.disposition}`,
    `- Bypass allowed: ${result.bypassAllowed}`,
    `- Safe to retry after fix: ${result.safeToRetry}`,
    `- Requires cleanup: ${result.requiresCleanup}`,
    `- Requires policy change: ${result.requiresPolicyChange}`,
    `- Requires tooling fix: ${result.requiresToolingFix}`,
    `- Requires new layer: ${result.requiresNewLayer}`,
    `- Recommended task: ${result.recommendedTaskId ?? "n/a"}`,
    "- Reasons:",
    ...(result.reasons.length ? result.reasons.map((reason) => `  * ${reason}`) : ["  * none"]),
    "- Next steps:",
    ...(result.nextSteps.length ? result.nextSteps.map((step) => `  * ${step}`) : ["  * none"])
  ];
  return lines.join("\n");
}
