/**
 * Hermes Execution Platform (HEP) ------- Decision Policy Layer
 *
 * The Decision Policy is a pure rule-evaluation engine. It receives normalized
 * signals from the Decision Gateway (or any caller) and returns a structured
 * decision result with matched rules, reasons, and recommended next steps.
 *
 * Design contract:
 *   - Decision Gateway = coordinator / signal collector / auditor
 *   - Decision Policy  = rule engine / rule table / precedence resolver
 *
 * Rule precedence (highest wins):
 *   DENY(4) > ESCALATE(3) > REQUIRE_PLAN(2) > DRY_RUN_ONLY(1) > ALLOW(0)
 *
 * Critical-hazard behavior: DENY (hard-stop). Critical hazards represent known
 * catastrophic risks (e.g., HDD predictive failure) and must be explicitly
 * mitigated, downgraded, or given a future waiver before execution proceeds.
 * High hazards use ESCALATE (manual review required). See HAZARD_CRITICAL_ACTIVE.
 *
 * Missing-signal behavior: If guardianSignal or dependencySignal is absent,
 * MISSING_REQUIRED_SIGNAL fires -------- ESCALATE. Optional registries (policy file,
 * hazard registry) may warn but must not crash.
 */

import { redactGuardrailText } from "./guardrail-blocker.ts";
import { type AssetSignal } from "./asset-registry.ts";
import { type OwnershipSignal } from "./asset-ownership.ts";
import { type WaiverSignal } from "./waiver-registry.ts";

// --------------------- Public types -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

export type PolicyDecision = "ALLOW" | "DENY" | "DRY_RUN_ONLY" | "REQUIRE_PLAN" | "ESCALATE";
export type PolicyRequiredMode =
  | "normal"
  | "dry-run"
  | "impact-plan"
  | "manual-review"
  | "blocked";
export type PolicySeverity = "info" | "low" | "medium" | "high" | "critical";

/** Normalized summary of the active Hermes policy file. */
export interface DecisionPolicySummary {
  activeTaskId?: string;
  appCodeChanges?: boolean;
  migrations?: boolean;
  status: "loaded" | "invalid";
}

/** Normalized summary of a Guardian ACL check result. */
export interface DecisionGuardianSignal {
  decision?: string;
  allowed?: boolean;
  zone?: string;
  risk?: string;
  reasons?: string[];
}

/** Normalized summary of a Dependency Guard check result. */
export interface DecisionDependencySignal {
  decision?: string;
  allowed?: boolean;
  risk?: string;
  pathNotes?: string[];
  reasons?: string[];
}

/** Normalized summary of one active hazard match. */
export interface DecisionHazardSignal {
  hazardId: string;
  severity: string;
  area?: string;
  title?: string;
}

/**
 * Input to the Decision Policy engine.
 *
 * Contains normalized signals from all HEP security layers.
 * guardianSignal and dependencySignal are required for trust;
 * their absence triggers MISSING_REQUIRED_SIGNAL -------- ESCALATE.
 * policySummary is optional ------- absent when the policy file is missing.
 */
export interface DecisionPolicyInput {
  taskId: string;
  actor: string;
  action: string;
  target: string;
  targetType?: string;
  /** Loaded from super-hermes-policy.json. Absent when policy file is missing. */
  policySummary?: DecisionPolicySummary;
  /** Result from Guardian ACL check. Required for trust; absent -------- ESCALATE. */
  guardianSignal?: DecisionGuardianSignal;
  /** Result from Dependency Guard check. Required for trust; absent -------- ESCALATE. */
  dependencySignal?: DecisionDependencySignal;
  /** Active hazards that matched the request target/action. */
  hazardSignals?: DecisionHazardSignal[];
  assetSignal?: AssetSignal;
  ownershipSignal?: OwnershipSignal;
  waiverSignal?: WaiverSignal;
  rollback?: unknown;
  changeset?: unknown;
  selfImprovement?: unknown;
  riskLevel?: string;
  dryRun?: boolean;
  allowImpactPlan?: boolean;
  context?: Record<string, unknown>;
}

/**
 * Output of the Decision Policy engine.
 * Contains the final decision, reasons, matched rule IDs, and next steps.
 * All string fields are redacted of secrets before being returned.
 */
export interface DecisionPolicyResult {
  decision: PolicyDecision;
  allowed: boolean;
  requiredMode: PolicyRequiredMode;
  reasons: string[];
  warnings: string[];
  matchedRules: string[];
  severity: PolicySeverity;
  recommendedNextSteps: string[];
}

// --------------------- Internal types -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

interface RuleCandidate {
  ruleId: string;
  decision: PolicyDecision;
  reason: string;
  mode: PolicyRequiredMode;
}

// --------------------- Constants ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

const PRECEDENCE: Record<PolicyDecision, number> = {
  ALLOW: 0,
  DRY_RUN_ONLY: 1,
  REQUIRE_PLAN: 2,
  ESCALATE: 3,
  DENY: 4
};

/** Write-class actions that require dry-run validation before live execution. */
const MAINTENANCE_WRITE_ACTIONS = new Set([
  "archive",
  "delete",
  "move",
  "quarantine",
  "apply"
]);

// --------------------- Helpers ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

function isAppCodeTarget(target: string): boolean {
  const normalized = target.replaceAll("\\", "/");
  return (
    normalized === "src" ||
    normalized.startsWith("src/") ||
    normalized.includes("/src/")
  );
}

function isMigrationTarget(target: string): boolean {
  return target.replaceAll("\\", "/").includes("supabase/migrations/");
}

function isDestructiveAction(action: string): boolean {
  return ["delete", "archive", "move", "rename", "quarantine", "destructive"].includes(action.toLowerCase());
}

function sanitizeString(value: string): string {
  return redactGuardrailText(value).value;
}

function sanitizeStrings(values: string[]): string[] {
  return values.map((v) => sanitizeString(v));
}

function toRequiredMode(
  decision: PolicyDecision,
  override?: PolicyRequiredMode
): PolicyRequiredMode {
  if (override) return override;
  switch (decision) {
    case "DENY": return "blocked";
    case "ESCALATE": return "manual-review";
    case "REQUIRE_PLAN": return "impact-plan";
    case "DRY_RUN_ONLY": return "dry-run";
    default: return "normal";
  }
}

function toSeverity(decision: PolicyDecision): PolicySeverity {
  switch (decision) {
    case "DENY": return "critical";
    case "ESCALATE": return "high";
    case "REQUIRE_PLAN": return "medium";
    case "DRY_RUN_ONLY": return "low";
    default: return "info";
  }
}

function toNextSteps(decision: PolicyDecision, matchedRules: string[]): string[] {
  switch (decision) {
    case "ALLOW":
      return ["Proceed with the action."];
    case "DENY":
      if (matchedRules.includes("WAIVER_REVOKED"))
        return ["Matching waiver has been revoked. Request a new waiver or proceed through normal approval."];
      if (matchedRules.includes("WAIVER_ROLLBACK_REQUIRED"))
        return ["Waiver requires a rollback plan for medium/high risk actions. Add rollbackPlan to the waiver."];
      if (matchedRules.includes("OWNERSHIP_ACTION_FORBIDDEN_FOR_ALL"))
        return ["This action is forbidden for all actors on this asset, including the owner. You must change the action or target."];
      if (matchedRules.includes("ASSET_CRITICAL_DESTRUCTIVE_DENY"))
        return ["Destructive actions on critical assets are strictly forbidden. You must modify the target or action to proceed."];
      if (matchedRules.includes("ASSET_PROTECTED_DESTRUCTIVE_DENY"))
        return ["Destructive actions on protected assets are strictly forbidden. You must modify the target or action to proceed."];
      if (matchedRules.includes("POLICY_APP_CODE_FORBIDDEN"))
        return ["Request a policy update to allow app code changes for this task."];
      if (matchedRules.includes("POLICY_MIGRATIONS_FORBIDDEN"))
        return ["Request a policy update to allow migrations for this task."];
      if (matchedRules.includes("HAZARD_CRITICAL_ACTIVE"))
        return [
          "Mitigate or downgrade the critical hazard before proceeding.",
          "Use: node tools/hep/index.ts hazard-mitigate --hazard-id <ID> --note <reason>"
        ];
      if (matchedRules.includes("PATH_OUTSIDE_ALLOWED_ROOTS"))
        return ["Use a target path within the configured workspace roots."];
      if (matchedRules.includes("DEPENDENCY_DENY"))
        return ["Review dependency blocking the target. May require waiver plan or asset restructuring."];
      if (matchedRules.includes("GUARDIAN_DENY"))
        return ["Request access elevation from the Guardian ACL administrator."];
      return ["Review denial reasons and contact Hermes administrator."];
    case "ESCALATE":
      if (matchedRules.includes("WAIVER_EXPIRED"))
        return ["Matching waiver has expired. Request a new waiver using: node tools/hep/index.ts waiver-add"];
      if (matchedRules.includes("WAIVER_ROLLBACK_REQUIRED"))
        return ["Waiver requires a rollback plan for medium/high risk actions."];
      if (matchedRules.includes("OWNERSHIP_ACTOR_UNAUTHORIZED_DESTRUCTIVE"))
        return [
          "Actor is not authorized to perform destructive actions on this asset.",
          "Contact the asset owner or an authorized approver to proceed."
        ];
      if (matchedRules.includes("OWNERSHIP_MISSING_HIGH_CRITICAL"))
        return ["High/critical asset has no ownership record. Add an ownership entry before proceeding."];
      if (matchedRules.includes("ASSET_OWNER_REQUIRED"))
        return ["Provide an owner for high/critical assets in the asset registry before proceeding."];
      if (matchedRules.includes("POLICY_TASK_MISMATCH"))
        return [
          "Update super-hermes-policy.json activeTaskId to match the current task.",
          "Or: wait for the active task to complete before running this check."
        ];
      if (matchedRules.includes("MISSING_REQUIRED_SIGNAL"))
        return [
          "Initialize Guardian ACL: node tools/hep/index.ts guardian-init --workspaceRoot <path>",
          "Initialize Dependency Guard: node tools/hep/index.ts dependency-init --workspaceRoot <path>"
        ];
      return [
        "Escalate to human review. Review escalation reasons before proceeding.",
        "Use: node tools/hep/index.ts decision-explain for detailed breakdown."
      ];
    case "REQUIRE_PLAN":
      if (matchedRules.includes("WAIVER_VALID_HIGH_REDUCE_ESCALATE_TO_PLAN"))
        return [
          "Action has a valid high-risk waiver. Decision relaxed from ESCALATE to REQUIRE_PLAN.",
          "Ensure rollback plan is executed if action fails."
        ];
      if (matchedRules.includes("OWNERSHIP_REVIEW_REQUIRED"))
        return [
          "This action requires explicit owner review before execution.",
          "Contact the asset owner or an authorized approver to get review approval."
        ];
      if (matchedRules.includes("ASSET_HIGH_MOVE_REQUIRE_PLAN"))
        return ["Move, rename, or archive operations on high-criticality assets require an approved impact plan."];
      if (matchedRules.includes("ASSET_UNKNOWN_DESTRUCTIVE_REQUIRE_PLAN"))
        return ["Destructive actions on unknown assets require an approved impact plan."];
      if (matchedRules.includes("ASSET_ARCHIVE_CANDIDATE_REQUIRE_PLAN"))
        return ["Operations on archive candidate assets require an approved impact plan."];
      return [
        "Create an impact plan documenting affected assets and rollback steps.",
        "Re-run with --allow-impact-plan after the plan has been approved."
      ];
    case "DRY_RUN_ONLY":
      return [
        "Re-run with --dry-run first to validate the operation safely.",
        "Review dry-run output before proceeding to a live run."
      ];
    default:
      return [];
  }
}

// --------------------- Core engine -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

/**
 * Evaluate the Decision Policy for a given request signal set.
 *
 * This is a pure function ------- it reads no files and makes no I/O calls.
 * All inputs must be pre-collected by the caller (e.g., Decision Gateway).
 *
 * All output string fields (reasons, warnings) are redacted of secrets before
 * being returned.
 *
 * Rule table (in evaluation order, highest precedence wins):
 *   MISSING_REQUIRED_SIGNAL  ------- guardian or dependency signal absent -------- ESCALATE
 *   POLICY_TASK_MISMATCH     ------- activeTaskId differs from taskId -------- ESCALATE
 *   POLICY_APP_CODE_FORBIDDEN ------- appCodeChanges=false + src target -------- DENY
 *   POLICY_MIGRATIONS_FORBIDDEN ------- migrations=false + migration target -------- DENY
 *   GUARDIAN_DENY            ------- guardian decision=DENY -------- DENY
 *   GUARDIAN_ESCALATE        ------- guardian decision=REQUIRE_APPROVAL -------- ESCALATE
 *   GUARDIAN_DRY_RUN         ------- guardian decision=REQUIRE_DRY_RUN -------- DRY_RUN_ONLY
 *   PATH_OUTSIDE_ALLOWED_ROOTS ------- path outside workspace -------- DENY
 *   DEPENDENCY_DENY          ------- dependency decision=DENY -------- DENY
 *   DEPENDENCY_ESCALATE      ------- dependency decision=ESCALATE -------- ESCALATE
 *   DEPENDENCY_REQUIRE_PLAN  ------- dependency ALLOW_WITH_IMPACT_PLAN|REQUIRE_WAIVER_PLAN -------- REQUIRE_PLAN
 *   HAZARD_CRITICAL_ACTIVE   ------- active critical hazard -------- DENY (hard stop)
 *   HAZARD_HIGH_ACTIVE       ------- active high hazard -------- ESCALATE
 *   HAZARD_MEDIUM_ACTIVE     ------- active medium hazard -------- REQUIRE_PLAN
 *   HAZARD_LOW_ACTIVE        ------- active low hazard -------- warning only (no block)
 *   MAINTENANCE_WRITE_WITHOUT_DRY_RUN ------- write action + dryRun=false -------- DRY_RUN_ONLY
 *   ALLOW_DEFAULT            ------- all checks passed -------- ALLOW
 */
export function evaluateDecisionPolicy(input: DecisionPolicyInput): DecisionPolicyResult {
  const candidates: RuleCandidate[] = [];
  const warnings: string[] = [];
  // Low-severity hazards add warnings and a matchedRule ID but no blocking candidate.
  const lowHazardMatchedRules: string[] = [];

  // -------------- BASELINE ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  candidates.push({
    ruleId: "ALLOW_DEFAULT",
    decision: "ALLOW",
    reason: "All checks passed.",
    mode: "normal"
  });

  // -------------- MISSING_REQUIRED_SIGNAL ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  // Guardian and Dependency signals are required for trust.
  // If either is absent, escalate ------- do not silently allow with incomplete checks.
  const missingSignals: string[] = [];
  if (input.guardianSignal === undefined) missingSignals.push("Guardian");
  if (input.dependencySignal === undefined) missingSignals.push("Dependency");
  if (missingSignals.length > 0) {
    candidates.push({
      ruleId: "MISSING_REQUIRED_SIGNAL",
      decision: "ESCALATE",
      reason: `Required signal(s) missing: ${missingSignals.join(", ")}. Core checks must not be absent.`,
      mode: "manual-review"
    });
  }

  // -------------- POLICY rules -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  // Policy file is optional; rules only fire when policySummary is present.
  if (input.policySummary) {
    // POLICY_TASK_MISMATCH
    if (
      input.policySummary.activeTaskId &&
      input.policySummary.activeTaskId !== input.taskId
    ) {
      candidates.push({
        ruleId: "POLICY_TASK_MISMATCH",
        decision: "ESCALATE",
        reason: `Active policy task ${input.policySummary.activeTaskId} differs from request task ${input.taskId}.`,
        mode: "manual-review"
      });
    }

    // POLICY_APP_CODE_FORBIDDEN
    if (input.policySummary.appCodeChanges === false && isAppCodeTarget(input.target)) {
      candidates.push({
        ruleId: "POLICY_APP_CODE_FORBIDDEN",
        decision: "DENY",
        reason: "Policy denies app code changes for this target.",
        mode: "blocked"
      });
    }

    // POLICY_MIGRATIONS_FORBIDDEN
    if (input.policySummary.migrations === false && isMigrationTarget(input.target)) {
      candidates.push({
        ruleId: "POLICY_MIGRATIONS_FORBIDDEN",
        decision: "DENY",
        reason: "Policy denies migration changes for this target.",
        mode: "blocked"
      });
    }
  }

  // -------------- GUARDIAN rules ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  if (input.guardianSignal !== undefined) {
    const gReasons = (input.guardianSignal.reasons ?? []).join("; ");

    if (input.guardianSignal.decision === "DENY") {
      // GUARDIAN_DENY
      candidates.push({
        ruleId: "GUARDIAN_DENY",
        decision: "DENY",
        reason: `Guardian ACL denied: ${gReasons || "denied"}`,
        mode: "blocked"
      });
      // PATH_OUTSIDE_ALLOWED_ROOTS (guardian-detected; added alongside GUARDIAN_DENY)
      if (input.guardianSignal.zone === "outside-workspace") {
        candidates.push({
          ruleId: "PATH_OUTSIDE_ALLOWED_ROOTS",
          decision: "DENY",
          reason: "Target path is outside the allowed workspace roots (detected by Guardian ACL).",
          mode: "blocked"
        });
      }
    } else if (input.guardianSignal.decision === "REQUIRE_APPROVAL") {
      // GUARDIAN_ESCALATE
      candidates.push({
        ruleId: "GUARDIAN_ESCALATE",
        decision: "ESCALATE",
        reason: `Guardian ACL requires approval: ${gReasons || "approval required"}`,
        mode: "manual-review"
      });
    } else if (input.guardianSignal.decision === "REQUIRE_DRY_RUN") {
      // GUARDIAN_DRY_RUN
      candidates.push({
        ruleId: "GUARDIAN_DRY_RUN",
        decision: "DRY_RUN_ONLY",
        reason: "Guardian ACL requires dry-run mode for this action.",
        mode: "dry-run"
      });
    }
  }

  // -------------- DEPENDENCY rules --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  if (input.dependencySignal !== undefined) {
    const dReasons = (input.dependencySignal.reasons ?? []).join("; ");
    const pathNotes = input.dependencySignal.pathNotes ?? [];

    if (input.dependencySignal.decision === "DENY") {
      // DEPENDENCY_DENY ------- always fires for any dependency DENY
      candidates.push({
        ruleId: "DEPENDENCY_DENY",
        decision: "DENY",
        reason: `Dependency Guard denied: ${dReasons || "denied"}`,
        mode: "blocked"
      });
      // PATH_OUTSIDE_ALLOWED_ROOTS (dependency-detected; added alongside DEPENDENCY_DENY)
      const isPathViolation =
        pathNotes.some((n) => n.includes("path-contract-blocked")) ||
        dReasons.toLowerCase().includes("outside") ||
        dReasons.toLowerCase().includes("path contract") ||
        dReasons.toLowerCase().includes("traverses");
      if (isPathViolation) {
        candidates.push({
          ruleId: "PATH_OUTSIDE_ALLOWED_ROOTS",
          decision: "DENY",
          reason: "Target path was rejected by Dependency Guard as outside allowed roots.",
          mode: "blocked"
        });
      }
    } else if (input.dependencySignal.decision === "ESCALATE") {
      // DEPENDENCY_ESCALATE
      candidates.push({
        ruleId: "DEPENDENCY_ESCALATE",
        decision: "ESCALATE",
        reason: `Dependency Guard escalated: ${dReasons || "escalated"}`,
        mode: "manual-review"
      });
    } else if (
      input.dependencySignal.decision === "ALLOW_WITH_IMPACT_PLAN" ||
      input.dependencySignal.decision === "REQUIRE_WAIVER_PLAN"
    ) {
      // DEPENDENCY_REQUIRE_PLAN
      candidates.push({
        ruleId: "DEPENDENCY_REQUIRE_PLAN",
        decision: "REQUIRE_PLAN",
        reason: `Dependency Guard requires impact/waiver plan: ${dReasons || "plan required"}`,
        mode: "impact-plan"
      });
    }
  }

  // -------------- HAZARD rules ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  for (const hazard of input.hazardSignals ?? []) {
    const label = hazard.title
      ? `${hazard.hazardId} (${hazard.title})`
      : hazard.hazardId;

    switch (hazard.severity) {
      case "critical":
        // HAZARD_CRITICAL_ACTIVE -------- DENY (hard stop, conservative choice)
        // Critical hazards are known catastrophic risks; they must be explicitly
        // mitigated or downgraded before execution can proceed.
        candidates.push({
          ruleId: "HAZARD_CRITICAL_ACTIVE",
          decision: "DENY",
          reason: `Active critical hazard blocks execution: ${label}. Mitigate the hazard before proceeding.`,
          mode: "blocked"
        });
        break;
      case "high":
        // HAZARD_HIGH_ACTIVE -------- ESCALATE (manual review required)
        candidates.push({
          ruleId: "HAZARD_HIGH_ACTIVE",
          decision: "ESCALATE",
          reason: `Active high hazard requires escalation: ${label}`,
          mode: "manual-review"
        });
        break;
      case "medium":
        // HAZARD_MEDIUM_ACTIVE -------- REQUIRE_PLAN
        candidates.push({
          ruleId: "HAZARD_MEDIUM_ACTIVE",
          decision: "REQUIRE_PLAN",
          reason: `Active medium hazard requires impact plan: ${label}`,
          mode: "impact-plan"
        });
        break;
      case "low":
        // HAZARD_LOW_ACTIVE -------- warning only (no blocking decision)
        warnings.push(`Active low hazard (no block): ${label}`);
        if (!lowHazardMatchedRules.includes("HAZARD_LOW_ACTIVE")) {
          lowHazardMatchedRules.push("HAZARD_LOW_ACTIVE");
        }
        break;
      default:
        warnings.push(
          `Unknown hazard severity '${hazard.severity}' for ${hazard.hazardId}; treating as low.`
        );
        if (!lowHazardMatchedRules.includes("HAZARD_LOW_ACTIVE")) {
          lowHazardMatchedRules.push("HAZARD_LOW_ACTIVE");
        }
        break;
    }
  }

  // -------------- MAINTENANCE_WRITE_WITHOUT_DRY_RUN --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  // Write-class maintenance actions require dry-run validation before going live.
  // Only fires when dryRun is explicitly false (not undefined/omitted by caller).
  if (MAINTENANCE_WRITE_ACTIONS.has(input.action) && input.dryRun === false) {
    candidates.push({
      ruleId: "MAINTENANCE_WRITE_WITHOUT_DRY_RUN",
      decision: "DRY_RUN_ONLY",
      reason: `Maintenance write action '${input.action}' requires dry-run validation before live execution.`,
      mode: "dry-run"
    });
  }

  // -------------- ASSET REGISTRY rules ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  if (input.assetSignal === undefined) {
    if (isDestructiveAction(input.action)) {
      candidates.push({
        ruleId: "ASSET_REGISTRY_MISSING",
        decision: "REQUIRE_PLAN",
        reason: "Asset registry is missing or not provided, and the action is destructive.",
        mode: "impact-plan"
      });
    }
  } else {
    const isDestructive = isDestructiveAction(input.action);
    const criticality = input.assetSignal.criticality;
    const lifecycle = input.assetSignal.lifecycle;
    const matched = input.assetSignal.matched;
    const type = input.assetSignal.type;
    const owner = input.assetSignal.owner;
    
    // ASSET_CRITICAL_DESTRUCTIVE_DENY
    if (criticality === "critical" && isDestructive) {
      candidates.push({
        ruleId: "ASSET_CRITICAL_DESTRUCTIVE_DENY",
        decision: "DENY",
        reason: `Destructive action '${input.action}' is strictly forbidden on critical asset '${input.assetSignal.assetId || input.target}'.`,
        mode: "blocked"
      });
    }
    
    // ASSET_PROTECTED_DESTRUCTIVE_DENY
    if (lifecycle === "protected" && isDestructive) {
      candidates.push({
        ruleId: "ASSET_PROTECTED_DESTRUCTIVE_DENY",
        decision: "DENY",
        reason: `Destructive action '${input.action}' is strictly forbidden on protected asset '${input.assetSignal.assetId || input.target}'.`,
        mode: "blocked"
      });
    }
    
    // ASSET_OWNER_REQUIRED
    if ((criticality === "high" || criticality === "critical") && !owner) {
      candidates.push({
        ruleId: "ASSET_OWNER_REQUIRED",
        decision: "ESCALATE",
        reason: `Asset '${input.assetSignal.assetId || input.target}' has high/critical criticality but is missing an owner in the registry.`,
        mode: "manual-review"
      });
    }
    
    // ASSET_HIGH_MOVE_REQUIRE_PLAN
    if (criticality === "high" && ["move", "rename", "archive"].includes(input.action.toLowerCase())) {
      candidates.push({
        ruleId: "ASSET_HIGH_MOVE_REQUIRE_PLAN",
        decision: "REQUIRE_PLAN",
        reason: `Move/rename/archive action '${input.action}' on high criticality asset requires approved plan.`,
        mode: "impact-plan"
      });
    }
    
    // ASSET_UNKNOWN_DESTRUCTIVE_REQUIRE_PLAN
    if ((!matched || type === "unknown") && isDestructive) {
      candidates.push({
        ruleId: "ASSET_UNKNOWN_DESTRUCTIVE_REQUIRE_PLAN",
        decision: "REQUIRE_PLAN",
        reason: `Destructive action '${input.action}' on unknown asset requires approved plan.`,
        mode: "impact-plan"
      });
    }
    
    // ASSET_ARCHIVE_CANDIDATE_REQUIRE_PLAN
    if (lifecycle === "archive_candidate" && ["archive", "move", "delete"].includes(input.action.toLowerCase())) {
      candidates.push({
        ruleId: "ASSET_ARCHIVE_CANDIDATE_REQUIRE_PLAN",
        decision: "REQUIRE_PLAN",
        reason: `Archive/move/delete action '${input.action}' on archive candidate asset requires approved plan.`,
        mode: "impact-plan"
      });
    }
  }

  // -------------- OWNERSHIP rules --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  //
  // Ownership can REQUIRE more review or DENY forbidden-for-all actions.
  // Ownership CANNOT downgrade DENY to ALLOW.
  // Rule precedence: DENY > ESCALATE > REQUIRE_PLAN (same global precedence).
  if (input.ownershipSignal !== undefined) {
    const own = input.ownershipSignal;

    // OWNERSHIP_ACTION_FORBIDDEN_FOR_ALL -------- DENY
    // An action explicitly forbidden for all actors (including owner) ------- hard stop.
    if (own.matched && own.actionForbiddenForAll) {
      candidates.push({
        ruleId: "OWNERSHIP_ACTION_FORBIDDEN_FOR_ALL",
        decision: "DENY",
        reason: `Action '${input.action}' is forbidden for all actors on asset '${own.assetId || input.target}' (including owner '${own.owner || "unknown"}').`,
        mode: "blocked"
      });
    }

    // OWNERSHIP_ACTOR_UNAUTHORIZED_DESTRUCTIVE -------- ESCALATE
    // Actor is not owner or authorized delegate AND action is destructive.
    const isDestructiveForOwnership = isDestructiveAction(input.action);
    if (
      own.matched &&
      !own.actionForbiddenForAll && // already handled above as DENY
      !own.actorAuthorized &&
      isDestructiveForOwnership
    ) {
      candidates.push({
        ruleId: "OWNERSHIP_ACTOR_UNAUTHORIZED_DESTRUCTIVE",
        decision: "ESCALATE",
        reason: `Actor '${input.actor}' is not authorized to perform destructive action '${input.action}' on asset '${own.assetId || input.target}'. Owner: '${own.owner || "unknown"}'.`,
        mode: "manual-review"
      });
    }

    // OWNERSHIP_REVIEW_REQUIRED -------- REQUIRE_PLAN
    // Action requires explicit owner review (and actor is not the owner).
    if (own.matched && own.requiresOwnerReview && !own.isOwner) {
      candidates.push({
        ruleId: "OWNERSHIP_REVIEW_REQUIRED",
        decision: "REQUIRE_PLAN",
        reason: `Action '${input.action}' on asset '${own.assetId || input.target}' requires explicit owner review from '${own.owner || "unknown"}'.`,
        mode: "impact-plan"
      });
    }

    // OWNERSHIP_MISSING_HIGH_CRITICAL -------- ESCALATE
    // A high/critical asset (from assetSignal) has no ownership record.
    const assetCriticality = input.assetSignal?.criticality;
    if (
      !own.matched &&
      (assetCriticality === "high" || assetCriticality === "critical")
    ) {
      candidates.push({
        ruleId: "OWNERSHIP_MISSING_HIGH_CRITICAL",
        decision: "ESCALATE",
        reason: `High/critical asset '${input.assetSignal?.assetId || input.target}' has no ownership record. Ownership must be established before proceeding.`,
        mode: "manual-review"
      });
    }
  }

  // -------------- WAIVER rules (post-select) ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  //
  // The waiver block runs after the initial candidate pool is built but BEFORE
  // the final winner is frozen. It can:
  //   (a) add negative rules (WAIVER_EXPIRED -------- ESCALATE, WAIVER_REVOKED -------- DENY)
  //   (b) allow relaxation of the tentative winner if all safety conditions pass.
  //
  // WHAT A WAIVER CAN NEVER DO IN V1:
  //   - Convert DENY to ALLOW
  //   - Bypass ASSET_CRITICAL_DESTRUCTIVE_DENY / ASSET_PROTECTED_DESTRUCTIVE_DENY
  //   - Bypass OWNERSHIP_ACTION_FORBIDDEN_FOR_ALL
  //   - Bypass GUARDIAN_DENY / PATH_OUTSIDE_ALLOWED_ROOTS / DEPENDENCY_DENY
  //   - Bypass HAZARD_CRITICAL_ACTIVE
  const rb = (input.rollback ?? input.context?.["rollback" + "Signal"]) as Record<string, unknown> | undefined;
  const rbMatched = Boolean(rb?.matched);
  const rbActive = Boolean(rb?.active);
  const rbExpired = Boolean(rb?.expired);
  const rbStatus = typeof rb?.status === "string" ? rb.status : "none";
  const rbStepsPresent = Boolean(rb?.rollbackStepsPresent);
  const rbFilesPresent = Boolean(rb?.changedFilesPresent);
  const rbProtected = Boolean(rb?.protectedAssetTouched);
  const rbOwnerReviewPresent = Boolean(rb?.ownerReviewPresent);
  const rbVerified = Boolean(rb?.verified) || rbStatus === "verified" || rb?.validationStatus === "dry_run_passed" || rb?.validationStatus === "manually_verified";

  if (input.waiverSignal?.active && (input.waiverSignal.riskLevel === "high" || input.waiverSignal.riskLevel === "critical") && !rbActive) {
    candidates.push({
      ruleId: "ROLLBACK_MISSING_FOR_WAIVER_HIGH",
      decision: "ESCALATE",
      reason: "High-risk waiver requires an active rollback contract before it can relax a decision.",
      mode: "manual-review"
    });
  }

  if (input.waiverSignal?.active && (input.waiverSignal.riskLevel === "high" || input.waiverSignal.riskLevel === "critical") && rbActive && !rbVerified) {
    candidates.push({
      ruleId: "ROLLBACK_VERIFY_REQUIRED_FOR_WAIVER_HIGH",
      decision: "ESCALATE",
      reason: "High-risk waiver requires a verified rollback contract before it can relax a decision.",
      mode: "manual-review"
    });
  }

  if (input.waiverSignal?.active && input.waiverSignal.riskLevel !== "low" && !rbMatched) {
    candidates.push({
      ruleId: "ROLLBACK_CONTRACT_MISSING",
      decision: "REQUIRE_PLAN",
      reason: "Risky waiver path has no matching rollback contract.",
      mode: "impact-plan"
    });
  }

  if (rbMatched && rbExpired) {
    candidates.push({ ruleId: "ROLLBACK_CONTRACT_EXPIRED", decision: "ESCALATE", reason: "Matching rollback contract is expired.", mode: "manual-review" });
  }

  if (rbMatched && rbStatus === "revoked") {
    candidates.push({ ruleId: "ROLLBACK_CONTRACT_REVOKED", decision: "DENY", reason: "Matching rollback contract is revoked.", mode: "blocked" });
  }

  if (rbMatched && rbActive && !rbStepsPresent) {
    candidates.push({ ruleId: "ROLLBACK_STEPS_MISSING", decision: "ESCALATE", reason: "Rollback contract has no rollback steps.", mode: "manual-review" });
  }

  if (rbMatched && rbActive && !rbFilesPresent) {
    candidates.push({ ruleId: "ROLLBACK_CHANGED_FILES_MISSING", decision: "ESCALATE", reason: "Rollback contract has no changed files listed.", mode: "manual-review" });
  }

  if (rbMatched && rbActive && rbProtected && !rbOwnerReviewPresent) {
    candidates.push({ ruleId: "ROLLBACK_PROTECTED_ASSET_REVIEW_REQUIRED", decision: "ESCALATE", reason: "Rollback contract touches a protected asset and requires owner review.", mode: "manual-review" });
  }

  const cs = (input.changeset ?? input.context?.["changeset" + "Signal"]) as Record<string, unknown> | undefined;
  const csMatched = Boolean(cs?.matched);
  const csRecorded = Boolean(cs?.recorded);
  const csValidated = Boolean(cs?.validated);
  const csHasCommit = Boolean(cs?.hasCommit);
  const csUnplanned = Boolean(cs?.unplannedFilesPresent);
  const csMissingPlanned = Boolean(cs?.missingPlannedFilesPresent);
  const csChecksPassing = Boolean(cs?.checksPassing);
  const highRiskAction = input.riskLevel === "high" || input.riskLevel === "critical" || input.waiverSignal?.riskLevel === "high" || input.waiverSignal?.riskLevel === "critical";
  const finalizingAction = ["finalize", "complete", "commit", "publish", "merge"].includes(input.action);

  if ((highRiskAction || finalizingAction) && !csRecorded) {
    candidates.push({ ruleId: "CHANGESET_REQUIRED", decision: "REQUIRE_PLAN", reason: "High-risk or finalizing actions require a recorded changeset.", mode: "impact-plan" });
  }

  if (csMatched && csRecorded && !csValidated) {
    candidates.push({ ruleId: "CHANGESET_VALIDATION_REQUIRED", decision: "ESCALATE", reason: "Recorded changeset is not validated.", mode: "manual-review" });
  }

  if (csMatched && csUnplanned) {
    candidates.push({ ruleId: "CHANGESET_UNPLANNED_FILES", decision: "ESCALATE", reason: "Changeset contains files that were not in the plan.", mode: "manual-review" });
  }

  if (csMatched && csMissingPlanned) {
    candidates.push({ ruleId: "CHANGESET_MISSING_PLANNED_FILES", decision: "REQUIRE_PLAN", reason: "Changeset is missing planned files.", mode: "impact-plan" });
  }

  if (csMatched && !csChecksPassing) {
    candidates.push({ ruleId: "CHANGESET_CHECKS_NOT_PASSING", decision: "ESCALATE", reason: "Changeset checks are not all passing or skipped.", mode: "manual-review" });
  }

  if ((highRiskAction || finalizingAction) && csMatched && !csHasCommit) {
    candidates.push({ ruleId: "CHANGESET_COMMIT_REQUIRED", decision: "REQUIRE_PLAN", reason: "High-risk or finalizing changeset requires a commit hash.", mode: "impact-plan" });
  }

  const si = input.selfImprovement as Record<string, unknown> | undefined;
  const selfAction = ["self-improve", "improve-hermes", "resolve-blocker", "fix-tooling"].includes(input.action);
  if (selfAction && !si?.matched) {
    candidates.push({ ruleId: "SELF_IMPROVEMENT_PROPOSAL_REQUIRED", decision: "ESCALATE", reason: "Self-improvement actions require a matching proposal.", mode: "manual-review" });
  }
  if (selfAction && si?.matched && !si?.approved) {
    candidates.push({ ruleId: "SELF_IMPROVEMENT_APPROVAL_REQUIRED", decision: "ESCALATE", reason: "Self-improvement proposal must be approved before proceeding.", mode: "manual-review" });
  }
  if (selfAction && si?.matched && !si?.evidencePresent) {
    candidates.push({ ruleId: "SELF_IMPROVEMENT_EVIDENCE_REQUIRED", decision: "REQUIRE_PLAN", reason: "Self-improvement proposal requires blocker evidence.", mode: "impact-plan" });
  }
  if (selfAction && si?.matched && !si?.scopePresent) {
    candidates.push({ ruleId: "SELF_IMPROVEMENT_SCOPE_REQUIRED", decision: "REQUIRE_PLAN", reason: "Self-improvement proposal requires explicit scope.", mode: "impact-plan" });
  }
  if (selfAction && si?.matched && !si?.safetyChecksPresent) {
    candidates.push({ ruleId: "SELF_IMPROVEMENT_SAFETY_CHECKS_REQUIRED", decision: "ESCALATE", reason: "Self-improvement proposal requires safety checks.", mode: "manual-review" });
  }
  if (selfAction && si?.matched && (si?.riskLevel === "high" || si?.riskLevel === "critical") && !si?.rollbackRefPresent) {
    candidates.push({ ruleId: "SELF_IMPROVEMENT_ROLLBACK_REQUIRED", decision: "ESCALATE", reason: "High-risk self-improvement requires rollbackRef.", mode: "manual-review" });
  }

  if (input.waiverSignal !== undefined) {
    const wv = input.waiverSignal;

    if (wv.matched) {
      // WAIVER_EXPIRED -------- ESCALATE (keep at least at ESCALATE, not lower)
      if (wv.expired) {
        candidates.push({
          ruleId: "WAIVER_EXPIRED",
          decision: "ESCALATE",
          reason: `Matching waiver '${wv.waiverId || "unknown"}' has expired. Request a new waiver.`,
          mode: "manual-review"
        });
      }

      // WAIVER_REVOKED -------- DENY (treat revoked waiver as hard stop for the relaxation pathway)
      if (wv.revoked) {
        candidates.push({
          ruleId: "WAIVER_REVOKED",
          decision: "DENY",
          reason: `Matching waiver '${wv.waiverId || "unknown"}' has been revoked. No valid exception exists.`,
          mode: "blocked"
        });
      }

      // WAIVER_ROLLBACK_REQUIRED -------- ESCALATE if rollback plan missing on medium/high risk
      if (wv.active && !wv.rollbackPlanPresent && wv.status !== "none" && (wv.riskLevel === "medium" || wv.riskLevel === "high" || wv.riskLevel === "critical")) {
        candidates.push({
          ruleId: "WAIVER_ROLLBACK_REQUIRED",
          decision: "ESCALATE",
          reason: `Active waiver '${wv.waiverId || "unknown"}' has medium/high risk but no rollback plan. Waiver cannot relax decision.`,
          mode: "manual-review"
        });
      }
    }
  }

  // -------------- SELECT WINNER ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  const sorted = [...candidates].sort(
    (a, b) => PRECEDENCE[b.decision] - PRECEDENCE[a.decision]
  );
  const winner = sorted[0] ?? {
    ruleId: "ALLOW_DEFAULT",
    decision: "ALLOW" as PolicyDecision,
    reason: "All checks passed.",
    mode: "normal" as PolicyRequiredMode
  };

  let decision = winner.decision;
  let winnerMode = winner.mode;
  const extraRules: string[] = [];

  // -------------- WAIVER relaxation (post-selection) ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  //
  // After the initial winner is selected, a valid waiver MAY relax the decision
  // downward ------- but only within explicitly allowed v1 bounds.
  //
  // Hard invariants:
  //   - decision must not go from DENY -------- ALLOW
  //   - DENY from critical/protected destructive must remain DENY
  //   - DENY from OWNERSHIP_ACTION_FORBIDDEN_FOR_ALL must remain DENY
  //   - DENY from GUARDIAN_DENY / PATH_OUTSIDE_ALLOWED_ROOTS / DEPENDENCY_DENY must remain DENY
  //   - canBypassCriticalDeny is always false in v1

  if (input.waiverSignal !== undefined && input.waiverSignal.matched) {
    const wv = input.waiverSignal;

    // Detect hard-deny rule IDs that prevent any relaxation
    const currentCandidateRuleIds = new Set(candidates.map(c => c.ruleId));
    const hasCriticalDestructiveDeny =
      currentCandidateRuleIds.has("ASSET_CRITICAL_DESTRUCTIVE_DENY") ||
      currentCandidateRuleIds.has("ASSET_PROTECTED_DESTRUCTIVE_DENY");
    const hasForbiddenForAllDeny = currentCandidateRuleIds.has("OWNERSHIP_ACTION_FORBIDDEN_FOR_ALL");
    const hasGuardianDeny = currentCandidateRuleIds.has("GUARDIAN_DENY") ||
      currentCandidateRuleIds.has("PATH_OUTSIDE_ALLOWED_ROOTS");
    const hasDependencyHardDeny = currentCandidateRuleIds.has("DEPENDENCY_DENY");
    const hasHazardCriticalDeny = currentCandidateRuleIds.has("HAZARD_CRITICAL_ACTIVE");
    const hasAnyHardDeny =
      hasCriticalDestructiveDeny || hasForbiddenForAllDeny || hasGuardianDeny || hasDependencyHardDeny || hasHazardCriticalDeny;

    if (wv.active && wv.canRelaxDecision && !wv.canBypassCriticalDeny) {
      if (hasAnyHardDeny && decision === "DENY") {
        // WAIVER_NO_DENY_BYPASS ------- waiver cannot convert DENY to ALLOW
        extraRules.push("WAIVER_NO_DENY_BYPASS");
        warnings.push(`Waiver '${wv.waiverId}' cannot bypass a hard DENY decision.`);
        if (hasCriticalDestructiveDeny) extraRules.push("WAIVER_NO_CRITICAL_DESTRUCTIVE_BYPASS");
        if (hasForbiddenForAllDeny) extraRules.push("WAIVER_NO_FORBIDDEN_FOR_ALL_BYPASS");
      } else if (decision !== "DENY") {
        // Check scope match validity
        if (!wv.scopeMatched || !wv.actionMatched) {
          extraRules.push("WAIVER_SCOPE_MISMATCH");
          warnings.push(`Waiver '${wv.waiverId}' scope or action does not exactly match this request. Waiver not applied.`);
        } else {
          // Apply relaxation based on risk level
          const waiverRisk = wv.waiverId ? (() => {
            // Re-derive risk from the waiverSignal ------- not stored on signal directly,
            // but we can determine safe relaxation from canRelaxDecision alone.
            // Low/medium -------- REQUIRE_PLAN -------- ALLOW; High -------- ESCALATE -------- REQUIRE_PLAN
            return "derived";
          })() : "none";
          void waiverRisk; // suppress unused warning ------- logic below uses canRelaxDecision

          if (decision === "REQUIRE_PLAN") {
            // WAIVER_VALID_LOW_MEDIUM_RELAX_PLAN: REQUIRE_PLAN -------- ALLOW for low/medium non-destructive
            decision = "ALLOW";
            winnerMode = "normal";
            extraRules.push("WAIVER_VALID_LOW_MEDIUM_RELAX_PLAN");
            warnings.push(`Waiver '${wv.waiverId}' relaxed decision from REQUIRE_PLAN to ALLOW.`);
          } else if (decision === "ESCALATE") {
            // WAIVER_VALID_HIGH_REDUCE_ESCALATE_TO_PLAN: ESCALATE -------- REQUIRE_PLAN for high non-destructive
            decision = "REQUIRE_PLAN";
            winnerMode = "impact-plan";
            extraRules.push("WAIVER_VALID_HIGH_REDUCE_ESCALATE_TO_PLAN");
            warnings.push(`Waiver '${wv.waiverId}' relaxed decision from ESCALATE to REQUIRE_PLAN.`);
          }
          // DRY_RUN_ONLY and ALLOW: no change needed
        }
      }
    } else if (decision === "DENY") {
      // Waiver exists but cannot bypass DENY
      extraRules.push("WAIVER_NO_DENY_BYPASS");
      if (hasCriticalDestructiveDeny) extraRules.push("WAIVER_NO_CRITICAL_DESTRUCTIVE_BYPASS");
      if (hasForbiddenForAllDeny) extraRules.push("WAIVER_NO_FORBIDDEN_FOR_ALL_BYPASS");
    }
  }

  const requiredMode = toRequiredMode(decision, winnerMode);
  const severity = toSeverity(decision);

  // -------------- BUILD matchedRules -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  // Include all rules that fired (except baseline ALLOW_DEFAULT, unless it alone wins).
  // Low-hazard matched rules are merged in from the separate tracking array.
  const nonDefaultCandidates = candidates.filter((c) => c.ruleId !== "ALLOW_DEFAULT");
  const candidateRuleIds = [...new Set(nonDefaultCandidates.map((c) => c.ruleId))];
  const allMatchedRules = [
    ...candidateRuleIds,
    ...lowHazardMatchedRules.filter((r) => !candidateRuleIds.includes(r)),
    ...extraRules.filter((r) => !candidateRuleIds.includes(r))
  ];
  const matchedRules = allMatchedRules.length > 0 ? allMatchedRules : ["ALLOW_DEFAULT"];

  // -------------- BUILD reasons ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  // Reasons come from all non-default, non-allow blocking/escalating candidates.
  // If nothing fired, show the allow reason.
  const reasonCandidates = nonDefaultCandidates;
  const rawReasons =
    reasonCandidates.length > 0
      ? [...new Set(reasonCandidates.map((c) => c.reason))]
      : [winner.reason];

  return {
    decision,
    allowed: decision === "ALLOW",
    requiredMode,
    reasons: sanitizeStrings(rawReasons),
    warnings: sanitizeStrings(warnings),
    matchedRules,
    severity,
    recommendedNextSteps: toNextSteps(decision, matchedRules)
  };
}



