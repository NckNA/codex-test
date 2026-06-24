import { describe, expect, it } from "vitest";
import { diagnoseBlocker, formatBlockerDiagnosis } from "../blocker-root-cause.ts";

describe("blocker-root-cause", () => {
  it("classifies active task mismatch as configuration error", () => {
    const result = diagnoseBlocker({
      taskId: "TASK-A",
      activeTaskId: "TASK-B",
      reason: "Active policy task TASK-B differs from request task TASK-A."
    });

    expect(result.category).toBe("configuration_error");
    expect(result.disposition).toBe("fix_policy_or_config");
    expect(result.requiresPolicyChange).toBe(true);
    expect(result.safeToRetry).toBe(true);
  });

  it("classifies app code permission failures as policy configuration issues", () => {
    const result = diagnoseBlocker({
      taskId: "PATIENT-FINANCE-UI-001",
      action: "edit",
      target: "src/pages/PatientCardPage.tsx",
      appCodeChanges: false,
      reason: "POLICY_DOES_NOT_ALLOW_CODE_CHANGES"
    });

    expect(result.category).toBe("configuration_error");
    expect(result.recommendedTaskId).toBe("HERMES-TASK-POLICY-APP-CODE-PERMISSION-001");
    expect(result.requiresPolicyChange).toBe(true);
  });

  it("classifies dirty worktree as cleanup issue", () => {
    const result = diagnoseBlocker({
      worktreeClean: false,
      reason: "WORKTREE_DIRTY uncommitted changes exist"
    });

    expect(result.category).toBe("dirty_state");
    expect(result.disposition).toBe("clean_worktree");
    expect(result.requiresCleanup).toBe(true);
  });

  it("classifies missing rollback layer as architecture gap", () => {
    const result = diagnoseBlocker({
      taskId: "HERMES-WAIVER-REGISTRY-001",
      reason: "Rollback Contract missing for high-risk waiver"
    });

    expect(result.category).toBe("architecture_gap");
    expect(result.disposition).toBe("build_missing_layer");
    expect(result.requiresNewLayer).toBe(true);
    expect(result.recommendedTaskId).toBe("HERMES-ROLLBACK-CONTRACT-001");
  });

  it("classifies CLI option behavior as tooling fix", () => {
    const result = diagnoseBlocker({
      tool: "tools/hep/index.ts",
      operation: "waiver-add",
      reason: "CLI ignored option --waiver-id and generated a different ID"
    });

    expect(result.category).toBe("tooling_false_positive");
    expect(result.disposition).toBe("fix_tooling");
    expect(result.requiresToolingFix).toBe(true);
    expect(result.recommendedTaskId).toBe("HERMES-WAIVER-CLI-ID-RESPECT-001");
  });

  it("formats a safe diagnostic summary", () => {
    const result = diagnoseBlocker({ reason: "unknown blocker" });
    const formatted = formatBlockerDiagnosis(result);

    expect(formatted).toContain("Category: unknown");
    expect(formatted).toContain("Next steps:");
  });
});
