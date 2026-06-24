import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  addOrUpdateRollbackContract,
  evaluateRollbackContract,
  formatRollbackCheck,
  initializeRollbackRegistry,
  listRollbackContracts,
  markRollbackVerified,
  parseRollbackStepInput,
  revokeRollbackContract
} from "../rollback-contract.ts";

function workspace(): string {
  return mkdtempSync(join(tmpdir(), "hermes-rollback-test-"));
}

function cleanup(path: string): void {
  rmSync(path, { recursive: true, force: true });
}

function baseAdd(root: string) {
  return {
    workspaceRoot: root,
    taskId: "HERMES-ROLLBACK-CONTRACT-001",
    actor: "maintenance.autopilot",
    action: "archive",
    assetId: "hep.cli.index",
    reason: "test rollback contract",
    changedFiles: ["tools/hep/index.ts"],
    rollbackSteps: [parseRollbackStepInput("git restore -- tools/hep/index.ts", "medium", "git diff -- tools/hep/index.ts")],
    protectedAssetTouched: false,
    createdBy: "Nick",
    approvedBy: "Nick",
    riskLevel: "medium" as const,
    validationEvidence: ["dry-run declared"]
  };
}

describe("rollback-contract", () => {
  it("initializes and lists registry", () => {
    const root = workspace();
    try {
      const registry = initializeRollbackRegistry({ workspaceRoot: root });
      expect(registry.schemaVersion).toBe(1);
      const contracts = listRollbackContracts({ workspaceRoot: root });
      expect(contracts.some((contract) => contract.contractId === "example.disabled")).toBe(true);
    } finally {
      cleanup(root);
    }
  });

  it("requires reason", () => {
    const root = workspace();
    try {
      expect(() => addOrUpdateRollbackContract({ ...baseAdd(root), reason: "" })).toThrow(/reason is required/);
    } finally {
      cleanup(root);
    }
  });

  it("requires changed files", () => {
    const root = workspace();
    try {
      expect(() => addOrUpdateRollbackContract({ ...baseAdd(root), changedFiles: [] })).toThrow(/changedFiles is required/);
    } finally {
      cleanup(root);
    }
  });

  it("requires rollback steps", () => {
    const root = workspace();
    try {
      expect(() => addOrUpdateRollbackContract({ ...baseAdd(root), rollbackSteps: [] })).toThrow(/rollbackSteps is required/);
    } finally {
      cleanup(root);
    }
  });

  it("requires approvedBy for high risk", () => {
    const root = workspace();
    try {
      expect(() => addOrUpdateRollbackContract({ ...baseAdd(root), riskLevel: "high", approvedBy: undefined })).toThrow(/approvedBy is required/);
    } finally {
      cleanup(root);
    }
  });

  it("requires dry-run or evidence for high risk", () => {
    const root = workspace();
    try {
      expect(() => addOrUpdateRollbackContract({
        ...baseAdd(root),
        riskLevel: "high",
        rollbackSteps: [parseRollbackStepInput("git restore -- tools/hep/index.ts", "high")],
        validationEvidence: []
      })).toThrow(/dryRunCommand or validationEvidence is required/);
    } finally {
      cleanup(root);
    }
  });

  it("matches valid medium contract", () => {
    const root = workspace();
    try {
      const contract = addOrUpdateRollbackContract(baseAdd(root));
      const signal = evaluateRollbackContract({
        workspaceRoot: root,
        taskId: contract.taskId,
        actor: contract.actor,
        action: contract.action,
        assetId: contract.assetId
      });
      expect(signal.matched).toBe(true);
      expect(signal.active).toBe(true);
      expect(signal.rollbackStepsPresent).toBe(true);
      expect(signal.changedFilesPresent).toBe(true);
      expect(signal.canSupportWaiver).toBe(true);
    } finally {
      cleanup(root);
    }
  });

  it("does not match another task", () => {
    const root = workspace();
    try {
      addOrUpdateRollbackContract(baseAdd(root));
      const signal = evaluateRollbackContract({
        workspaceRoot: root,
        taskId: "OTHER-TASK",
        actor: "maintenance.autopilot",
        action: "archive",
        assetId: "hep.cli.index"
      });
      expect(signal.matched).toBe(false);
    } finally {
      cleanup(root);
    }
  });

  it("protected asset touch requires owner review", () => {
    const root = workspace();
    try {
      expect(() => addOrUpdateRollbackContract({
        ...baseAdd(root),
        protectedAssetTouched: true,
        ownerReviewBy: undefined
      })).toThrow(/ownerReviewBy is required/);
    } finally {
      cleanup(root);
    }
  });

  it("revoke changes signal to inactive", () => {
    const root = workspace();
    try {
      const contract = addOrUpdateRollbackContract(baseAdd(root));
      revokeRollbackContract({ workspaceRoot: root, contractId: contract.contractId, reason: "test cleanup", revokedBy: "Nick" });
      const signal = evaluateRollbackContract({
        workspaceRoot: root,
        taskId: contract.taskId,
        actor: contract.actor,
        action: contract.action,
        assetId: contract.assetId
      });
      expect(signal.matched).toBe(true);
      expect(signal.active).toBe(false);
      expect(signal.status).toBe("revoked");
    } finally {
      cleanup(root);
    }
  });

  it("verified contract supports risk reduction", () => {
    const root = workspace();
    try {
      const contract = addOrUpdateRollbackContract(baseAdd(root));
      markRollbackVerified({ workspaceRoot: root, contractId: contract.contractId, verifiedBy: "Nick", evidence: "manual verification" });
      const signal = evaluateRollbackContract({
        workspaceRoot: root,
        taskId: contract.taskId,
        actor: contract.actor,
        action: contract.action,
        assetId: contract.assetId
      });
      expect(signal.verified).toBe(true);
      expect(signal.canSupportRiskReduction).toBe(true);
    } finally {
      cleanup(root);
    }
  });

  it("missing registry returns warning and does not crash", () => {
    const root = workspace();
    try {
      const signal = evaluateRollbackContract({
        workspaceRoot: root,
        taskId: "TASK",
        actor: "actor",
        action: "inspect"
      });
      expect(signal.matched).toBe(false);
      expect(signal.warnings.join(" ")).toContain("missing");
    } finally {
      cleanup(root);
    }
  });

  it("formats safe summary", () => {
    const root = workspace();
    try {
      const contract = addOrUpdateRollbackContract(baseAdd(root));
      const signal = evaluateRollbackContract({
        workspaceRoot: root,
        taskId: contract.taskId,
        actor: contract.actor,
        action: contract.action,
        assetId: contract.assetId
      });
      const formatted = formatRollbackCheck(signal);
      expect(formatted).toContain("Rollback Contract Check Result");
      expect(formatted).toContain("Can support waiver: true");
    } finally {
      cleanup(root);
    }
  });
});
