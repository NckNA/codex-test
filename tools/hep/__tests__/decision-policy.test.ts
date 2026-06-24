/**
 * Tests for tools/hep/decision-policy.ts
 *
 * Required coverage (17 tests):
 *  1.  ALLOW when all signals are clean
 *  2.  DENY beats all other decisions (precedence)
 *  3.  ESCALATE beats REQUIRE_PLAN and ALLOW
 *  4.  REQUIRE_PLAN beats DRY_RUN_ONLY and ALLOW
 *  5.  Low hazard only adds warning, does not block
 *  6.  Medium hazard returns REQUIRE_PLAN
 *  7.  High hazard returns ESCALATE
 *  8.  Critical hazard returns DENY (conservative hard-stop)
 *  9.  Guardian deny returns DENY (GUARDIAN_DENY)
 * 10.  Dependency impact returns REQUIRE_PLAN (DEPENDENCY_REQUIRE_PLAN)
 * 11.  Active policy task mismatch returns ESCALATE (POLICY_TASK_MISMATCH)
 * 12.  App code forbidden returns DENY (POLICY_APP_CODE_FORBIDDEN)
 * 13.  Migration forbidden returns DENY (POLICY_MIGRATIONS_FORBIDDEN)
 * 14.  Missing core signal returns ESCALATE (MISSING_REQUIRED_SIGNAL)
 * 15.  Maintenance write without dry-run returns DRY_RUN_ONLY
 * 16.  Reasons and matchedRules are populated
 * 17.  Sensitive-looking values in reasons are redacted
 */

import { describe, expect, it } from "vitest";
import { evaluateDecisionPolicy, type DecisionPolicyInput } from "../decision-policy.ts";

const TASK_ID = "TEST-DECISION-POLICY-001";

/** Baseline clean input — all checks pass. */
function cleanInput(overrides: Partial<DecisionPolicyInput> = {}): DecisionPolicyInput {
  return {
    taskId: TASK_ID,
    actor: "maintenance.autopilot",
    action: "inspect",
    target: "tools/hep/index.ts",
    policySummary: {
      activeTaskId: TASK_ID,
      appCodeChanges: true,
      migrations: true,
      status: "loaded"
    },
    guardianSignal: {
      decision: "ALLOW",
      allowed: true,
      zone: "cli",
      risk: "low",
      reasons: []
    },
    dependencySignal: {
      decision: "ALLOW",
      allowed: true,
      risk: "low",
      pathNotes: [],
      reasons: []
    },
    hazardSignals: [],
    dryRun: true,
    ...overrides
  };
}

describe("Decision Policy", () => {
  // ── Test 1: ALLOW when all signals clean ──────────────────────────────────
  it("returns ALLOW when all signals are clean", () => {
    const result = evaluateDecisionPolicy(cleanInput());

    expect(result.decision).toBe("ALLOW");
    expect(result.allowed).toBe(true);
    expect(result.requiredMode).toBe("normal");
    expect(result.severity).toBe("info");
    expect(result.matchedRules).toContain("ALLOW_DEFAULT");
    expect(result.reasons[0]).toContain("All checks passed");
    expect(result.warnings).toHaveLength(0);
  });

  // ── Test 2: DENY beats all other decisions ────────────────────────────────
  it("DENY beats ESCALATE and REQUIRE_PLAN (precedence)", () => {
    // Provide: DENY (guardian), ESCALATE (task mismatch), REQUIRE_PLAN (dependency)
    const result = evaluateDecisionPolicy(
      cleanInput({
        taskId: "CURRENT-TASK",
        policySummary: {
          activeTaskId: "OTHER-TASK",   // ESCALATE: POLICY_TASK_MISMATCH
          appCodeChanges: true,
          migrations: true,
          status: "loaded"
        },
        guardianSignal: {
          decision: "DENY",             // DENY: GUARDIAN_DENY
          reasons: ["actor not permitted"]
        },
        dependencySignal: {
          decision: "REQUIRE_WAIVER_PLAN", // REQUIRE_PLAN: DEPENDENCY_REQUIRE_PLAN
          reasons: ["asset has dependents"]
        }
      })
    );

    expect(result.decision).toBe("DENY");
    expect(result.allowed).toBe(false);
    expect(result.matchedRules).toContain("GUARDIAN_DENY");
    expect(result.matchedRules).toContain("POLICY_TASK_MISMATCH");
    expect(result.matchedRules).toContain("DEPENDENCY_REQUIRE_PLAN");
  });

  // ── Test 3: ESCALATE beats REQUIRE_PLAN and ALLOW ─────────────────────────
  it("ESCALATE beats REQUIRE_PLAN and ALLOW (precedence)", () => {
    const result = evaluateDecisionPolicy(
      cleanInput({
        taskId: "CURRENT-TASK",
        policySummary: {
          activeTaskId: "OTHER-TASK",   // ESCALATE
          appCodeChanges: true,
          migrations: true,
          status: "loaded"
        },
        dependencySignal: {
          decision: "REQUIRE_WAIVER_PLAN", // REQUIRE_PLAN
          reasons: ["has dependents"]
        }
      })
    );

    expect(result.decision).toBe("ESCALATE");
    expect(result.allowed).toBe(false);
    expect(result.matchedRules).toContain("POLICY_TASK_MISMATCH");
    expect(result.matchedRules).toContain("DEPENDENCY_REQUIRE_PLAN");
  });

  // ── Test 4: REQUIRE_PLAN beats DRY_RUN_ONLY and ALLOW ────────────────────
  it("REQUIRE_PLAN beats DRY_RUN_ONLY and ALLOW (precedence)", () => {
    // REQUIRE_PLAN from dependency + DRY_RUN_ONLY from maintenance write
    const result = evaluateDecisionPolicy(
      cleanInput({
        action: "archive",
        dryRun: false,                  // triggers MAINTENANCE_WRITE_WITHOUT_DRY_RUN
        dependencySignal: {
          decision: "ALLOW_WITH_IMPACT_PLAN", // REQUIRE_PLAN
          reasons: ["impact plan needed"]
        }
      })
    );

    expect(result.decision).toBe("REQUIRE_PLAN");
    expect(result.allowed).toBe(false);
    expect(result.requiredMode).toBe("impact-plan");
    expect(result.matchedRules).toContain("DEPENDENCY_REQUIRE_PLAN");
    expect(result.matchedRules).toContain("MAINTENANCE_WRITE_WITHOUT_DRY_RUN");
  });

  // ── Test 5: Low hazard → warning only, no block ───────────────────────────
  it("low hazard adds warning but does not block decision", () => {
    const result = evaluateDecisionPolicy(
      cleanInput({
        hazardSignals: [
          { hazardId: "HZD-LOW-001", severity: "low", title: "Low risk fixture" }
        ]
      })
    );

    expect(result.decision).toBe("ALLOW");
    expect(result.allowed).toBe(true);
    expect(result.warnings.some((w) => w.includes("HZD-LOW-001"))).toBe(true);
    expect(result.matchedRules).toContain("HAZARD_LOW_ACTIVE");
    // Low hazard reason must not appear in reasons (only in warnings)
    expect(result.reasons.join("")).not.toContain("HZD-LOW-001");
  });

  // ── Test 6: Medium hazard → REQUIRE_PLAN ─────────────────────────────────
  it("medium hazard returns REQUIRE_PLAN", () => {
    const result = evaluateDecisionPolicy(
      cleanInput({
        hazardSignals: [
          { hazardId: "HZD-MEDIUM-001", severity: "medium", title: "Medium risk fixture" }
        ]
      })
    );

    expect(result.decision).toBe("REQUIRE_PLAN");
    expect(result.allowed).toBe(false);
    expect(result.requiredMode).toBe("impact-plan");
    expect(result.severity).toBe("medium");
    expect(result.matchedRules).toContain("HAZARD_MEDIUM_ACTIVE");
    expect(result.reasons.some((r) => r.includes("HZD-MEDIUM-001"))).toBe(true);
  });

  // ── Test 7: High hazard → ESCALATE ───────────────────────────────────────
  it("high hazard returns ESCALATE", () => {
    const result = evaluateDecisionPolicy(
      cleanInput({
        hazardSignals: [
          { hazardId: "HZD-HIGH-001", severity: "high", title: "High risk fixture" }
        ]
      })
    );

    expect(result.decision).toBe("ESCALATE");
    expect(result.allowed).toBe(false);
    expect(result.requiredMode).toBe("manual-review");
    expect(result.severity).toBe("high");
    expect(result.matchedRules).toContain("HAZARD_HIGH_ACTIVE");
    expect(result.reasons.some((r) => r.includes("HZD-HIGH-001"))).toBe(true);
  });

  // ── Test 8: Critical hazard → DENY (hard-stop, conservative) ─────────────
  it("critical hazard returns DENY (conservative hard-stop)", () => {
    const result = evaluateDecisionPolicy(
      cleanInput({
        hazardSignals: [
          { hazardId: "HZD-CRIT-001", severity: "critical", title: "Critical risk fixture" }
        ]
      })
    );

    expect(result.decision).toBe("DENY");
    expect(result.allowed).toBe(false);
    expect(result.requiredMode).toBe("blocked");
    expect(result.severity).toBe("critical");
    expect(result.matchedRules).toContain("HAZARD_CRITICAL_ACTIVE");
    expect(result.reasons.some((r) => r.includes("HZD-CRIT-001"))).toBe(true);
    expect(result.reasons.some((r) => r.includes("Mitigate"))).toBe(true);
    expect(result.recommendedNextSteps.some((s) => s.includes("hazard-mitigate"))).toBe(true);
  });

  // ── Test 9: Guardian deny → DENY ─────────────────────────────────────────
  it("guardian deny returns DENY (GUARDIAN_DENY)", () => {
    const result = evaluateDecisionPolicy(
      cleanInput({
        guardianSignal: {
          decision: "DENY",
          allowed: false,
          zone: "cli",
          risk: "high",
          reasons: ["actor not in allowed list"]
        }
      })
    );

    expect(result.decision).toBe("DENY");
    expect(result.allowed).toBe(false);
    expect(result.matchedRules).toContain("GUARDIAN_DENY");
    expect(result.reasons.some((r) => r.includes("Guardian ACL denied"))).toBe(true);
    expect(result.reasons.some((r) => r.includes("actor not in allowed list"))).toBe(true);
  });

  // ── Test 10: Dependency impact plan → REQUIRE_PLAN ───────────────────────
  it("dependency impact plan decision returns REQUIRE_PLAN (DEPENDENCY_REQUIRE_PLAN)", () => {
    for (const depDecision of ["ALLOW_WITH_IMPACT_PLAN", "REQUIRE_WAIVER_PLAN"] as const) {
      const result = evaluateDecisionPolicy(
        cleanInput({
          dependencySignal: {
            decision: depDecision,
            allowed: false,
            risk: "medium",
            pathNotes: [],
            reasons: ["asset has active references"]
          }
        })
      );

      expect(result.decision).toBe("REQUIRE_PLAN");
      expect(result.allowed).toBe(false);
      expect(result.requiredMode).toBe("impact-plan");
      expect(result.matchedRules).toContain("DEPENDENCY_REQUIRE_PLAN");
      expect(result.reasons.some((r) => r.includes("impact/waiver plan"))).toBe(true);
    }
  });

  // ── Test 11: Policy task mismatch → ESCALATE ─────────────────────────────
  it("active policy task mismatch returns ESCALATE (POLICY_TASK_MISMATCH)", () => {
    const result = evaluateDecisionPolicy(
      cleanInput({
        taskId: "NEW-TASK-001",
        policySummary: {
          activeTaskId: "OLD-TASK-001",  // mismatch
          appCodeChanges: true,
          migrations: true,
          status: "loaded"
        }
      })
    );

    expect(result.decision).toBe("ESCALATE");
    expect(result.allowed).toBe(false);
    expect(result.matchedRules).toContain("POLICY_TASK_MISMATCH");
    expect(result.reasons.some((r) => r.includes("OLD-TASK-001"))).toBe(true);
    expect(result.reasons.some((r) => r.includes("NEW-TASK-001"))).toBe(true);
    expect(
      result.recommendedNextSteps.some((s) => s.includes("activeTaskId"))
    ).toBe(true);
  });

  // ── Test 12: App code forbidden → DENY ───────────────────────────────────
  it("app code forbidden returns DENY (POLICY_APP_CODE_FORBIDDEN)", () => {
    const result = evaluateDecisionPolicy(
      cleanInput({
        target: "src/App.tsx",
        policySummary: {
          activeTaskId: TASK_ID,
          appCodeChanges: false,   // forbidden
          migrations: true,
          status: "loaded"
        }
      })
    );

    expect(result.decision).toBe("DENY");
    expect(result.allowed).toBe(false);
    expect(result.matchedRules).toContain("POLICY_APP_CODE_FORBIDDEN");
    expect(result.reasons.some((r) => r.includes("app code"))).toBe(true);
  });

  // ── Test 13: Migration forbidden → DENY ──────────────────────────────────
  it("migration forbidden returns DENY (POLICY_MIGRATIONS_FORBIDDEN)", () => {
    const result = evaluateDecisionPolicy(
      cleanInput({
        target: "supabase/migrations/0001_init.sql",
        policySummary: {
          activeTaskId: TASK_ID,
          appCodeChanges: true,
          migrations: false,   // forbidden
          status: "loaded"
        }
      })
    );

    expect(result.decision).toBe("DENY");
    expect(result.allowed).toBe(false);
    expect(result.matchedRules).toContain("POLICY_MIGRATIONS_FORBIDDEN");
    expect(result.reasons.some((r) => r.includes("migration"))).toBe(true);
  });

  // ── Test 14: Missing core signal → ESCALATE ───────────────────────────────
  it("missing guardian signal returns ESCALATE (MISSING_REQUIRED_SIGNAL)", () => {
    const input: DecisionPolicyInput = {
      taskId: TASK_ID,
      actor: "maintenance.autopilot",
      action: "inspect",
      target: "tools/hep/index.ts",
      // guardianSignal deliberately omitted
      dependencySignal: { decision: "ALLOW", allowed: true, risk: "low", reasons: [] }
    };
    const result = evaluateDecisionPolicy(input);

    expect(result.decision).toBe("ESCALATE");
    expect(result.allowed).toBe(false);
    expect(result.matchedRules).toContain("MISSING_REQUIRED_SIGNAL");
    expect(result.reasons.some((r) => r.includes("Guardian"))).toBe(true);
    expect(
      result.recommendedNextSteps.some((s) => s.includes("guardian-init"))
    ).toBe(true);
  });

  it("missing dependency signal also returns ESCALATE (MISSING_REQUIRED_SIGNAL)", () => {
    const input: DecisionPolicyInput = {
      taskId: TASK_ID,
      actor: "maintenance.autopilot",
      action: "inspect",
      target: "tools/hep/index.ts",
      guardianSignal: { decision: "ALLOW", allowed: true, zone: "cli", reasons: [] }
      // dependencySignal deliberately omitted
    };
    const result = evaluateDecisionPolicy(input);

    expect(result.decision).toBe("ESCALATE");
    expect(result.matchedRules).toContain("MISSING_REQUIRED_SIGNAL");
    expect(result.reasons.some((r) => r.includes("Dependency"))).toBe(true);
  });

  // ── Test 15: Maintenance write without dry-run → DRY_RUN_ONLY ────────────
  it("maintenance write without dry-run returns DRY_RUN_ONLY", () => {
    for (const action of ["archive", "delete", "move", "quarantine", "apply"] as const) {
      const result = evaluateDecisionPolicy(
        cleanInput({
          action,
          dryRun: false  // explicitly false
        })
      );

      expect(result.decision).toBe("DRY_RUN_ONLY");
      expect(result.allowed).toBe(false);
      expect(result.requiredMode).toBe("dry-run");
      expect(result.matchedRules).toContain("MAINTENANCE_WRITE_WITHOUT_DRY_RUN");
      expect(result.reasons.some((r) => r.includes(action))).toBe(true);
    }
  });

  it("maintenance write with dryRun=true does NOT trigger DRY_RUN_ONLY", () => {
    const result = evaluateDecisionPolicy(
      cleanInput({ action: "archive", dryRun: true })
    );
    expect(result.decision).toBe("ALLOW");
    expect(result.matchedRules).not.toContain("MAINTENANCE_WRITE_WITHOUT_DRY_RUN");
  });

  it("maintenance write with dryRun=undefined does NOT trigger DRY_RUN_ONLY", () => {
    const input = cleanInput({ action: "archive" });
    delete input.dryRun;
    const result = evaluateDecisionPolicy(input);
    expect(result.decision).toBe("ALLOW");
    expect(result.matchedRules).not.toContain("MAINTENANCE_WRITE_WITHOUT_DRY_RUN");
  });

  // ── Test 16: Reasons and matchedRules populated ───────────────────────────
  it("reasons and matchedRules are populated for each fired rule", () => {
    const result = evaluateDecisionPolicy(
      cleanInput({
        taskId: "NEW-TASK",
        policySummary: {
          activeTaskId: "OTHER-TASK",  // POLICY_TASK_MISMATCH
          appCodeChanges: true,
          migrations: true,
          status: "loaded"
        },
        hazardSignals: [
          { hazardId: "HZD-MEDIUM-FIXTURE", severity: "medium" } // HAZARD_MEDIUM_ACTIVE
        ]
      })
    );

    // matchedRules has both rules
    expect(result.matchedRules).toContain("POLICY_TASK_MISMATCH");
    expect(result.matchedRules).toContain("HAZARD_MEDIUM_ACTIVE");

    // reasons explain both
    expect(result.reasons.some((r) => r.includes("OTHER-TASK"))).toBe(true);
    expect(result.reasons.some((r) => r.includes("HZD-MEDIUM-FIXTURE"))).toBe(true);

    // recommendedNextSteps populated
    expect(result.recommendedNextSteps.length).toBeGreaterThan(0);

    // ALLOW_DEFAULT not in matchedRules when other rules fire
    expect(result.matchedRules).not.toContain("ALLOW_DEFAULT");
  });

  it("ALLOW_DEFAULT appears in matchedRules when nothing fires", () => {
    const result = evaluateDecisionPolicy(cleanInput());
    expect(result.matchedRules).toContain("ALLOW_DEFAULT");
    expect(result.matchedRules).toHaveLength(1);
  });

  // ── Test 17: Redaction ────────────────────────────────────────────────────
  it("sensitive values in guardian reasons are redacted from output", () => {
    const result = evaluateDecisionPolicy(
      cleanInput({
        guardianSignal: {
          decision: "DENY",
          allowed: false,
          zone: "cli",
          risk: "high",
          reasons: [
            "blocked because token=supersecret sk-proj-abcdefghijklmnopqrstuvwxyz1234567890"
          ]
        }
      })
    );

    const allReasons = result.reasons.join(" ");
    expect(allReasons).not.toContain("supersecret");
    expect(allReasons).not.toContain("sk-proj-abcdefghijklmnopqrstuvwxyz1234567890");
    expect(allReasons).toContain("[REDACTED]");
  });

  it("sensitive values in dependency reasons are redacted from output", () => {
    const result = evaluateDecisionPolicy(
      cleanInput({
        dependencySignal: {
          decision: "DENY",
          allowed: false,
          risk: "high",
          pathNotes: [],
          reasons: ["denied because api_key=ghp_abc123secrettoken"]
        }
      })
    );

    const allReasons = result.reasons.join(" ");
    expect(allReasons).not.toContain("ghp_abc123secrettoken");
  });

  // ── Additional edge-case tests ────────────────────────────────────────────
  it("PATH_OUTSIDE_ALLOWED_ROOTS appears in matchedRules for out-of-workspace dependency deny", () => {
    const result = evaluateDecisionPolicy(
      cleanInput({
        dependencySignal: {
          decision: "DENY",
          allowed: false,
          risk: "critical",
          pathNotes: [],
          reasons: ["Path traverses outside workspace: C:\\outside\\file.txt"]
        }
      })
    );

    expect(result.decision).toBe("DENY");
    expect(result.matchedRules).toContain("DEPENDENCY_DENY");
    expect(result.matchedRules).toContain("PATH_OUTSIDE_ALLOWED_ROOTS");
  });

  it("guardian REQUIRE_APPROVAL fires GUARDIAN_ESCALATE → ESCALATE", () => {
    const result = evaluateDecisionPolicy(
      cleanInput({
        guardianSignal: {
          decision: "REQUIRE_APPROVAL",
          allowed: false,
          zone: "memory/registries",
          risk: "high",
          reasons: ["high-risk zone requires approval"]
        }
      })
    );

    expect(result.decision).toBe("ESCALATE");
    expect(result.matchedRules).toContain("GUARDIAN_ESCALATE");
  });

  it("guardian REQUIRE_DRY_RUN fires GUARDIAN_DRY_RUN → DRY_RUN_ONLY", () => {
    const result = evaluateDecisionPolicy(
      cleanInput({
        guardianSignal: {
          decision: "REQUIRE_DRY_RUN",
          allowed: false,
          zone: "reports",
          risk: "medium",
          reasons: ["dry run required first"]
        }
      })
    );

    expect(result.decision).toBe("DRY_RUN_ONLY");
    expect(result.matchedRules).toContain("GUARDIAN_DRY_RUN");
    expect(result.requiredMode).toBe("dry-run");
  });

  it("severity reflects the winning decision level", () => {
    expect(evaluateDecisionPolicy(cleanInput()).severity).toBe("info");
    expect(evaluateDecisionPolicy(cleanInput({
      action: "archive", dryRun: false
    })).severity).toBe("low");
    expect(evaluateDecisionPolicy(cleanInput({
      hazardSignals: [{ hazardId: "HZD-M", severity: "medium" }]
    })).severity).toBe("medium");
    expect(evaluateDecisionPolicy(cleanInput({
      hazardSignals: [{ hazardId: "HZD-H", severity: "high" }]
    })).severity).toBe("high");
    expect(evaluateDecisionPolicy(cleanInput({
      guardianSignal: { decision: "DENY", reasons: [] }
    })).severity).toBe("critical");
  });

  it("recommendedNextSteps are non-empty for all non-ALLOW decisions", () => {
    const cases = [
      cleanInput({ guardianSignal: { decision: "DENY", reasons: [] } }),
      cleanInput({ taskId: "X", policySummary: { activeTaskId: "Y", status: "loaded" } }),
      cleanInput({ dependencySignal: { decision: "REQUIRE_WAIVER_PLAN", reasons: [] } }),
      cleanInput({ action: "archive", dryRun: false })
    ];
    for (const input of cases) {
      const result = evaluateDecisionPolicy(input);
      expect(result.recommendedNextSteps.length).toBeGreaterThan(0);
    }
  });
});
