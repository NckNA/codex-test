/**
 * Hermes Execution Platform (HEP) — Decision Policy Layer
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
 * MISSING_REQUIRED_SIGNAL fires → ESCALATE. Optional registries (policy file,
 * hazard registry) may warn but must not crash.
 */

import { redactGuardrailText } from "./guardrail-blocker.ts";
import { type AssetSignal } from "./asset-registry.ts";

// ─── Public types ─────────────────────────────────────────────────────────────

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
 * their absence triggers MISSING_REQUIRED_SIGNAL → ESCALATE.
 * policySummary is optional — absent when the policy file is missing.
 */
export interface DecisionPolicyInput {
  taskId: string;
  actor: string;
  action: string;
  target: string;
  targetType?: string;
  /** Loaded from super-hermes-policy.json. Absent when policy file is missing. */
  policySummary?: DecisionPolicySummary;
  /** Result from Guardian ACL check. Required for trust; absent → ESCALATE. */
  guardianSignal?: DecisionGuardianSignal;
  /** Result from Dependency Guard check. Required for trust; absent → ESCALATE. */
  dependencySignal?: DecisionDependencySignal;
  /** Active hazards that matched the request target/action. */
  hazardSignals?: DecisionHazardSignal[];
  assetSignal?: AssetSignal;
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

// ─── Internal types ───────────────────────────────────────────────────────────

interface RuleCandidate {
  ruleId: string;
  decision: PolicyDecision;
  reason: string;
  mode: PolicyRequiredMode;
}

// ─── Constants ────────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Core engine ─────────────────────────────────────────────────────────────

/**
 * Evaluate the Decision Policy for a given request signal set.
 *
 * This is a pure function — it reads no files and makes no I/O calls.
 * All inputs must be pre-collected by the caller (e.g., Decision Gateway).
 *
 * All output string fields (reasons, warnings) are redacted of secrets before
 * being returned.
 *
 * Rule table (in evaluation order, highest precedence wins):
 *   MISSING_REQUIRED_SIGNAL  — guardian or dependency signal absent → ESCALATE
 *   POLICY_TASK_MISMATCH     — activeTaskId differs from taskId → ESCALATE
 *   POLICY_APP_CODE_FORBIDDEN — appCodeChanges=false + src target → DENY
 *   POLICY_MIGRATIONS_FORBIDDEN — migrations=false + migration target → DENY
 *   GUARDIAN_DENY            — guardian decision=DENY → DENY
 *   GUARDIAN_ESCALATE        — guardian decision=REQUIRE_APPROVAL → ESCALATE
 *   GUARDIAN_DRY_RUN         — guardian decision=REQUIRE_DRY_RUN → DRY_RUN_ONLY
 *   PATH_OUTSIDE_ALLOWED_ROOTS — path outside workspace → DENY
 *   DEPENDENCY_DENY          — dependency decision=DENY → DENY
 *   DEPENDENCY_ESCALATE      — dependency decision=ESCALATE → ESCALATE
 *   DEPENDENCY_REQUIRE_PLAN  — dependency ALLOW_WITH_IMPACT_PLAN|REQUIRE_WAIVER_PLAN → REQUIRE_PLAN
 *   HAZARD_CRITICAL_ACTIVE   — active critical hazard → DENY (hard stop)
 *   HAZARD_HIGH_ACTIVE       — active high hazard → ESCALATE
 *   HAZARD_MEDIUM_ACTIVE     — active medium hazard → REQUIRE_PLAN
 *   HAZARD_LOW_ACTIVE        — active low hazard → warning only (no block)
 *   MAINTENANCE_WRITE_WITHOUT_DRY_RUN — write action + dryRun=false → DRY_RUN_ONLY
 *   ALLOW_DEFAULT            — all checks passed → ALLOW
 */
export function evaluateDecisionPolicy(input: DecisionPolicyInput): DecisionPolicyResult {
  const candidates: RuleCandidate[] = [];
  const warnings: string[] = [];
  // Low-severity hazards add warnings and a matchedRule ID but no blocking candidate.
  const lowHazardMatchedRules: string[] = [];

  // ── BASELINE ───────────────────────────────────────────────────────────────
  candidates.push({
    ruleId: "ALLOW_DEFAULT",
    decision: "ALLOW",
    reason: "All checks passed.",
    mode: "normal"
  });

  // ── MISSING_REQUIRED_SIGNAL ────────────────────────────────────────────────
  // Guardian and Dependency signals are required for trust.
  // If either is absent, escalate — do not silently allow with incomplete checks.
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

  // ── POLICY rules ───────────────────────────────────────────────────────────
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

  // ── GUARDIAN rules ─────────────────────────────────────────────────────────
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

  // ── DEPENDENCY rules ────────────────────────────────────────────────────────
  if (input.dependencySignal !== undefined) {
    const dReasons = (input.dependencySignal.reasons ?? []).join("; ");
    const pathNotes = input.dependencySignal.pathNotes ?? [];

    if (input.dependencySignal.decision === "DENY") {
      // DEPENDENCY_DENY — always fires for any dependency DENY
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

  // ── HAZARD rules ────────────────────────────────────────────────────────────
  for (const hazard of input.hazardSignals ?? []) {
    const label = hazard.title
      ? `${hazard.hazardId} (${hazard.title})`
      : hazard.hazardId;

    switch (hazard.severity) {
      case "critical":
        // HAZARD_CRITICAL_ACTIVE → DENY (hard stop, conservative choice)
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
        // HAZARD_HIGH_ACTIVE → ESCALATE (manual review required)
        candidates.push({
          ruleId: "HAZARD_HIGH_ACTIVE",
          decision: "ESCALATE",
          reason: `Active high hazard requires escalation: ${label}`,
          mode: "manual-review"
        });
        break;
      case "medium":
        // HAZARD_MEDIUM_ACTIVE → REQUIRE_PLAN
        candidates.push({
          ruleId: "HAZARD_MEDIUM_ACTIVE",
          decision: "REQUIRE_PLAN",
          reason: `Active medium hazard requires impact plan: ${label}`,
          mode: "impact-plan"
        });
        break;
      case "low":
        // HAZARD_LOW_ACTIVE → warning only (no blocking decision)
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

  // ── MAINTENANCE_WRITE_WITHOUT_DRY_RUN ──────────────────────────────────────
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

  // ── ASSET REGISTRY rules ───────────────────────────────────────────────────
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

  // ── SELECT WINNER ──────────────────────────────────────────────────────────
  const sorted = [...candidates].sort(
    (a, b) => PRECEDENCE[b.decision] - PRECEDENCE[a.decision]
  );
  const winner = sorted[0] ?? {
    ruleId: "ALLOW_DEFAULT",
    decision: "ALLOW" as PolicyDecision,
    reason: "All checks passed.",
    mode: "normal" as PolicyRequiredMode
  };

  const decision = winner.decision;
  const requiredMode = toRequiredMode(decision, winner.mode);
  const severity = toSeverity(decision);

  // ── BUILD matchedRules ─────────────────────────────────────────────────────
  // Include all rules that fired (except baseline ALLOW_DEFAULT, unless it alone wins).
  // Low-hazard matched rules are merged in from the separate tracking array.
  const nonDefaultCandidates = candidates.filter((c) => c.ruleId !== "ALLOW_DEFAULT");
  const candidateRuleIds = [...new Set(nonDefaultCandidates.map((c) => c.ruleId))];
  const allMatchedRules = [
    ...candidateRuleIds,
    ...lowHazardMatchedRules.filter((r) => !candidateRuleIds.includes(r))
  ];
  const matchedRules = allMatchedRules.length > 0 ? allMatchedRules : ["ALLOW_DEFAULT"];

  // ── BUILD reasons ──────────────────────────────────────────────────────────
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
