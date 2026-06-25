import { describe, expect, it } from "vitest";
import {
  approveChangePlan,
  comparePlannedToActual,
  createChangePlan,
  normalizePlanPath,
  revokeChangePlan,
  simulateChangePlan,
  toStorageRecord,
  validatePlanAgainstScope,
  type ChangePlanInput,
  type ChangePlanScope
} from "../change-plan.ts";

function validInput(overrides: Partial<ChangePlanInput> = {}): ChangePlanInput {
  return {
    taskId: "HERMES-CHANGE-PLAN-001A",
    actor: "maintenance.autopilot",
    action: "modify",
    target: "tools/hep/index.ts",
    riskLevel: "medium",
    createdBy: "Nick",
    reason: "Implement local HEP change-plan module",
    summary: "Add typed change-plan simulation and planned-vs-actual checks",
    expectedFiles: [
      {
        path: "tools/hep/change-plan.ts",
        reason: "add local change-plan model and validators",
        changeType: "create"
      },
      {
        path: "tools/hep/index.ts",
        reason: "wire local change-plan CLI commands",
        changeType: "modify"
      }
    ],
    checks: [
      {
        command: "npm test -- --run",
        required: true,
        expectedResult: "tests pass"
      }
    ],
    rollbackRef: "feature/hermes-change-plan-001a",
    requiresOwnerReview: false,
    notes: [],
    planId: "change-plan.hermes-change-plan-001a.test",
    createdAt: "2026-06-25T00:00:00.000Z",
    ...overrides
  };
}

const hepScope: ChangePlanScope = {
  allowedFiles: [
    "tools/hep/change-plan.ts",
    "tools/hep/__tests__/change-plan.test.ts",
    "tools/hep/index.ts",
    "_ai_work/REPORTS/HERMES-CHANGE-PLAN-001A.md"
  ],
  forbiddenPrefixes: ["src", "supabase/migrations"]
};

describe("HEP local change-plan module", () => {
  it("creates a valid redacted active plan", () => {
    const plan = createChangePlan(validInput({ notes: ["API_KEY = top-secret"] }));

    expect(plan.planId).toBe("change-plan.hermes-change-plan-001a.test");
    expect(plan.status).toBe("active");
    expect(plan.expectedFiles[0]?.path).toBe("tools/hep/change-plan.ts");
    expect(plan.notes?.[0]).toContain("API_KEY = [REDACTED]");
  });

  it("rejects unsafe task IDs", () => {
    expect(() => createChangePlan(validInput({ taskId: "../bad" }))).toThrow(/Unsafe taskId/);
  });

  it("normalizes safe paths and rejects traversal", () => {
    expect(normalizePlanPath("tools\\hep\\index.ts")).toBe("tools/hep/index.ts");
    expect(() => normalizePlanPath("tools/../src/App.tsx")).toThrow(/path traversal/i);
    expect(() => normalizePlanPath("C:/tmp/file.ts")).toThrow(/absolute path/i);
  });

  it("passes planned file allowlist validation", () => {
    const plan = createChangePlan(validInput());
    expect(validatePlanAgainstScope(plan, hepScope)).toEqual([]);
  });

  it("blocks planned files outside the allowlist", () => {
    const plan = createChangePlan(
      validInput({
        expectedFiles: [
          {
            path: "src/App.tsx",
            reason: "not allowed for this HEP tooling task",
            changeType: "modify"
          }
        ]
      })
    );

    expect(validatePlanAgainstScope(plan, hepScope)).toEqual(["src/App.tsx"]);
    const simulation = simulateChangePlan(plan, hepScope);
    expect(simulation.decision).toBe("BLOCK");
    expect(simulation.matchedRules).toContain("BLOCK_SCOPE_VIOLATION");
  });

  it("detects unplanned actual files", () => {
    const plan = createChangePlan(validInput());
    const diff = comparePlannedToActual(plan, ["tools/hep/change-plan.ts", "src/App.tsx"]);

    expect(diff.unplannedFiles.map((file) => file.path)).toEqual(["src/App.tsx"]);
  });

  it("detects missing planned files", () => {
    const plan = createChangePlan(validInput());
    const diff = comparePlannedToActual(plan, ["tools/hep/change-plan.ts"]);

    expect(diff.missingPlannedFiles).toEqual(["tools/hep/index.ts"]);
  });

  it("allows low and medium risk plans inside scope", () => {
    const plan = createChangePlan(validInput({ riskLevel: "low" }));
    const simulation = simulateChangePlan(plan, hepScope);

    expect(simulation.decision).toBe("ALLOW");
    expect(simulation.matchedRules).toContain("ALLOW_SCOPE_AND_RISK_OK");
  });

  it("blocks high-risk plans until owner approval", () => {
    const plan = createChangePlan(validInput({ riskLevel: "high", requiresOwnerReview: true }));
    const simulation = simulateChangePlan(plan, hepScope);

    expect(simulation.decision).toBe("BLOCK");
    expect(simulation.matchedRules).toContain("BLOCK_OWNER_REVIEW_REQUIRED");
  });

  it("allows approved high-risk plans inside scope", () => {
    const plan = createChangePlan(validInput({ riskLevel: "high", requiresOwnerReview: true }));
    const approved = approveChangePlan(plan, "Nick", "2026-06-25T00:10:00.000Z");
    const simulation = simulateChangePlan(approved, hepScope);

    expect(approved.status).toBe("approved");
    expect(simulation.decision).toBe("ALLOW");
  });

  it("revokes plans and blocks revoked execution", () => {
    const plan = createChangePlan(validInput());
    const revoked = revokeChangePlan(plan, "Nick", "2026-06-25T00:20:00.000Z");
    const simulation = simulateChangePlan(revoked, hepScope);

    expect(revoked.status).toBe("revoked");
    expect(simulation.decision).toBe("BLOCK");
    expect(simulation.matchedRules).toContain("BLOCK_REVOKED");
  });

  it("redacts sensitive strings in storage records", () => {
    const plan = createChangePlan(
      validInput({
        summary: "Use DB_PASSWORD=secret-value in notes only",
        checks: [
          {
            command: "echo API_KEY=hidden-value",
            required: true,
            expectedResult: "password: 'hidden' is never printed"
          }
        ]
      })
    );
    const storage = toStorageRecord(plan);

    expect(storage.summary).toContain("DB_PASSWORD=[REDACTED]");
    expect(storage.checks[0]?.command).toContain("API_KEY=[REDACTED]");
    expect(storage.checks[0]?.expectedResult).toContain("[REDACTED]");
    expect(storage.checks[0]?.expectedResult).not.toContain("hidden");
  });
});


