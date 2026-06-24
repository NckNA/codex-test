import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  addOrUpdateChangePlan,
  approveChangePlan,
  evaluateChangePlan,
  formatChangePlanCheck,
  initializeChangePlanRegistry,
  listChangePlans,
  parseChangePlanCheckInput,
  parseChangePlanFileInput,
  revokeChangePlan
} from "../change-plan.ts";

function workspace(): string {
  return join(tmpdir(), "change-plan-tests", `${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

function cleanup(path: string): void {
  rmSync(path, { recursive: true, force: true });
}

function base(root: string) {
  return {
    workspaceRoot: root,
    taskId: "HERMES-CHANGE-PLAN-001",
    actor: "maintenance.autopilot",
    action: "modify",
    target: "tools/hep/index.ts",
    riskLevel: "medium" as const,
    createdBy: "Nick",
    reason: "Plan HEP CLI change",
    summary: "Add a safe HEP CLI command",
    expectedFiles: [parseChangePlanFileInput("tools/hep/index.ts|modify|wire CLI command")],
    checks: [parseChangePlanCheckInput("npm test -- --run|required|tests pass")]
  };
}

describe("change-plan registry", () => {
  it("initializes an empty registry", () => {
    const root = workspace();
    try {
      expect(initializeChangePlanRegistry({ workspaceRoot: root })).toEqual([]);
      expect(existsSync(join(root, "memory", "change-plans", "change-plan-registry.json"))).toBe(true);
    } finally {
      cleanup(root);
    }
  });

  it("adds and lists a valid change plan", () => {
    const root = workspace();
    try {
      const plan = addOrUpdateChangePlan(base(root));
      expect(plan.status).toBe("active");
      expect(plan.expectedFiles[0].path).toBe("tools/hep/index.ts");
      expect(listChangePlans({ workspaceRoot: root })).toHaveLength(1);
    } finally {
      cleanup(root);
    }
  });

  it("requires expected files", () => {
    const root = workspace();
    try {
      expect(() => addOrUpdateChangePlan({ ...base(root), expectedFiles: [] })).toThrow(/expected files/);
    } finally {
      cleanup(root);
    }
  });

  it("requires checks", () => {
    const root = workspace();
    try {
      expect(() => addOrUpdateChangePlan({ ...base(root), checks: [] })).toThrow(/validation checks/);
    } finally {
      cleanup(root);
    }
  });

  it("requires rollbackRef and approval for high risk", () => {
    const root = workspace();
    try {
      expect(() => addOrUpdateChangePlan({ ...base(root), riskLevel: "high" })).toThrow(/rollbackRef/);
      expect(() => addOrUpdateChangePlan({ ...base(root), riskLevel: "high", rollbackRef: "rb.1" })).toThrow(/approvedBy/);
    } finally {
      cleanup(root);
    }
  });

  it("accepts high risk with rollbackRef and approval", () => {
    const root = workspace();
    try {
      const plan = addOrUpdateChangePlan({ ...base(root), riskLevel: "high", rollbackRef: "rb.1", approvedBy: "Nick" });
      expect(plan.status).toBe("approved");
      expect(plan.rollbackRef).toBe("rb.1");
    } finally {
      cleanup(root);
    }
  });

  it("evaluates matching active plan", () => {
    const root = workspace();
    try {
      addOrUpdateChangePlan(base(root));
      const signal = evaluateChangePlan({ workspaceRoot: root, taskId: "HERMES-CHANGE-PLAN-001", actor: "maintenance.autopilot", action: "modify", target: "tools/hep/index.ts" });
      expect(signal.matched).toBe(true);
      expect(signal.expectedFilesPresent).toBe(true);
      expect(signal.checksPresent).toBe(true);
    } finally {
      cleanup(root);
    }
  });

  it("approves and revokes plans", () => {
    const root = workspace();
    try {
      const plan = addOrUpdateChangePlan(base(root));
      const approved = approveChangePlan({ workspaceRoot: root, planId: plan.planId, approvedBy: "Nick" });
      expect(approved.status).toBe("approved");
      const revoked = revokeChangePlan({ workspaceRoot: root, planId: plan.planId, reason: "test cleanup", revokedBy: "Nick" });
      expect(revoked.status).toBe("revoked");
    } finally {
      cleanup(root);
    }
  });

  it("writes event log", () => {
    const root = workspace();
    try {
      addOrUpdateChangePlan(base(root));
      const eventPath = join(root, "logs", "change-plans", "change-plan-events.jsonl");
      expect(existsSync(eventPath)).toBe(true);
      expect(readFileSync(eventPath, "utf8")).toContain("change-plan-add");
    } finally {
      cleanup(root);
    }
  });

  it("formats a safe check summary", () => {
    const root = workspace();
    try {
      addOrUpdateChangePlan(base(root));
      const signal = evaluateChangePlan({ workspaceRoot: root, taskId: "HERMES-CHANGE-PLAN-001", actor: "maintenance.autopilot", action: "modify", target: "tools/hep/index.ts" });
      expect(formatChangePlanCheck(signal)).toContain("Change Plan Check Result");
    } finally {
      cleanup(root);
    }
  });
});
