import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { addOrUpdateChangePlan, parseChangePlanCheckInput, parseChangePlanFileInput } from "../change-plan.ts";
import { addOrUpdateChangeset, parseChangesetCheckInput, parseChangesetFileInput } from "../changeset-registry.ts";
import { buildMissionControlSnapshot, formatMissionControl } from "../mission-control.ts";

function workspace(): string {
  const root = join(tmpdir(), "mission-control-tests", `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "super-hermes-policy.json"), JSON.stringify({
    activeTaskId: "HERMES-MISSION-CONTROL-001",
    appliedAt: "2026-06-25T00:00:00.000Z",
    expiresAt: "2026-06-25T12:00:00.000Z",
    allowed: { gitCodeChanges: true, appCodeChanges: false, migrations: false },
    forbidden: { cloudSupabase: true }
  }, null, 2));
  return root;
}

function cleanup(root: string): void {
  rmSync(root, { recursive: true, force: true });
}

const baseRequest = {
  taskId: "HERMES-MISSION-CONTROL-001",
  actor: "maintenance.autopilot",
  action: "inspect",
  target: "tools/hep/index.ts",
  repositoryPath: process.cwd(),
  includeSimulation: false
};

describe("mission-control", () => {
  it("builds a snapshot with policy and missing plan blocker", () => {
    const root = workspace();
    try {
      const snapshot = buildMissionControlSnapshot({ ...baseRequest, workspaceRoot: root });

      expect(snapshot.policy.activeTaskId).toBe("HERMES-MISSION-CONTROL-001");
      expect(snapshot.changePlan?.matched).toBe(false);
      expect(snapshot.blockers).toContain("No matching change plan.");
      expect(snapshot.recommendedNextAction).toBe("Create a change plan before implementation.");
    } finally {
      cleanup(root);
    }
  });

  it("reports ready state when plan and changeset are valid", () => {
    const root = workspace();
    try {
      addOrUpdateChangePlan({
        workspaceRoot: root,
        taskId: "HERMES-MISSION-CONTROL-001",
        actor: "maintenance.autopilot",
        action: "inspect",
        target: "tools/hep/index.ts",
        riskLevel: "medium",
        createdBy: "Nick",
        approvedBy: "Nick",
        reason: "Plan mission control work",
        summary: "Add mission control snapshot",
        expectedFiles: [parseChangePlanFileInput("tools/hep/mission-control.ts|create|add mission control")],
        checks: [parseChangePlanCheckInput("npm test -- --run|required|tests pass")]
      });
      addOrUpdateChangeset({
        workspaceRoot: root,
        taskId: "HERMES-MISSION-CONTROL-001",
        actor: "maintenance.autopilot",
        action: "inspect",
        target: "tools/hep/index.ts",
        riskLevel: "medium",
        createdBy: "Nick",
        planId: "plan.test",
        rollbackRef: "rb.test",
        commitHash: "abc123",
        branch: "feature/test",
        plannedFiles: ["tools/hep/mission-control.ts"],
        actualFiles: [parseChangesetFileInput("tools/hep/mission-control.ts|added|10|0")],
        checks: [parseChangesetCheckInput("test|pass|npm test -- --run|tests pass")]
      });

      const snapshot = buildMissionControlSnapshot({ ...baseRequest, workspaceRoot: root });

      expect(snapshot.changePlan?.matched).toBe(true);
      expect(snapshot.changePlan?.approved).toBe(true);
      expect(snapshot.changeset?.validated).toBe(true);
      expect(snapshot.recommendedNextAction).toBe("Ready for report finalization or next scoped task.");
      expect(formatMissionControl(snapshot)).toContain("Hermes Mission Control");
    } finally {
      cleanup(root);
    }
  });

  it("detects active task policy mismatch", () => {
    const root = workspace();
    try {
      writeFileSync(join(root, "super-hermes-policy.json"), JSON.stringify({
        activeTaskId: "OTHER-TASK",
        allowed: { gitCodeChanges: true },
        forbidden: { cloudSupabase: true }
      }, null, 2));
      const snapshot = buildMissionControlSnapshot({ ...baseRequest, workspaceRoot: root });

      expect(snapshot.blockers).toContain("Active task policy mismatch.");
      expect(snapshot.recommendedNextAction).toBe("Fix active task policy before doing work.");
    } finally {
      cleanup(root);
    }
  });
});
