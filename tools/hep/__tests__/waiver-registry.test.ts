import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  initializeWaiverRegistry,
  loadWaiverRegistry,
  addOrUpdateWaiver,
  revokeWaiver,
  markWaiverUsed,
  evaluateWaiver,
  validateWaiverAdd
} from "../waiver-registry.ts";

function makeWorkspace(): string {
  const workspace = join(tmpdir(), "waiver-registry-tests", `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(workspace, { recursive: true });
  return workspace;
}

function cleanupWorkspace(workspace: string): void {
  rmSync(workspace, { recursive: true, force: true });
}

describe("Waiver Registry", () => {
  it("1. initializeWaiverRegistry creates registry with disabled example waiver", () => {
    const workspace = makeWorkspace();
    try {
      initializeWaiverRegistry({ workspaceRoot: workspace });
      const registryFile = join(workspace, "memory", "waivers", "waiver-registry.json");
      expect(existsSync(registryFile)).toBe(true);

      const waivers = loadWaiverRegistry({ workspaceRoot: workspace });
      expect(waivers.length).toBe(1);
      expect(waivers[0].waiverId).toBe("example.disabled");
      expect(waivers[0].status).toBe("revoked");
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("2. validateWaiverAdd enforces TTL, critical risk, rollback plan requirements", () => {
    const workspace = makeWorkspace();
    try {
      initializeWaiverRegistry({ workspaceRoot: workspace });

      // Reason too short
      const errs1 = validateWaiverAdd({
        workspaceRoot: workspace,
        taskId: "TASK-001",
        actor: "autopilot",
        action: "delete",
        riskLevel: "low",
        reason: "short",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        createdBy: "tester",
        reviewLevel: "none"
      });
      expect(errs1.some(e => e.includes("reason"))).toBe(true);

      // Rollback plan missing for medium risk
      const errs2 = validateWaiverAdd({
        workspaceRoot: workspace,
        taskId: "TASK-001",
        actor: "autopilot",
        action: "delete",
        riskLevel: "medium",
        reason: "Valid reason for doing waiver",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        createdBy: "tester",
        reviewLevel: "none"
      });
      expect(errs2.some(e => e.includes("rollbackPlan"))).toBe(true);

      // Critical risk not allowed
      const errs3 = validateWaiverAdd({
        workspaceRoot: workspace,
        taskId: "TASK-001",
        actor: "autopilot",
        action: "delete",
        riskLevel: "critical",
        reason: "Valid reason for doing waiver",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        createdBy: "tester",
        reviewLevel: "none"
      });
      expect(errs3.some(e => e.includes("Critical-risk waivers are not allowed"))).toBe(true);

      // Exceeded high risk TTL (max 24h)
      const errs4 = validateWaiverAdd({
        workspaceRoot: workspace,
        taskId: "TASK-001",
        actor: "autopilot",
        action: "delete",
        riskLevel: "high",
        reason: "Valid reason for doing waiver",
        rollbackPlan: "some rollback plan",
        expiresAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(), // 48 hours
        createdBy: "tester",
        reviewLevel: "none"
      });
      expect(errs4.some(e => e.includes("exceeds maximum TTL"))).toBe(true);
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("3. addOrUpdateWaiver adds and evaluateWaiver matches valid active waiver", () => {
    const workspace = makeWorkspace();
    try {
      initializeWaiverRegistry({ workspaceRoot: workspace });

      const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1h in future
      const waiver = addOrUpdateWaiver({
        workspaceRoot: workspace,
        taskId: "HERMES-WAIVER-REGISTRY-001",
        actor: "maintenance.autopilot",
        action: "archive",
        riskLevel: "low",
        reason: "Valid reason for doing waiver",
        expiresAt,
        createdBy: "tester",
        reviewLevel: "none"
      });

      expect(waiver.waiverId).toBeDefined();
      expect(waiver.status).toBe("active");

      const signal = evaluateWaiver({
        workspaceRoot: workspace,
        taskId: "HERMES-WAIVER-REGISTRY-001",
        actor: "maintenance.autopilot",
        action: "archive"
      });

      expect(signal.matched).toBe(true);
      expect(signal.active).toBe(true);
      expect(signal.canRelaxDecision).toBe(true);
      expect(signal.waiverId).toBe(waiver.waiverId);
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("4. revokeWaiver makes waiver inactive and sets status to revoked", () => {
    const workspace = makeWorkspace();
    try {
      initializeWaiverRegistry({ workspaceRoot: workspace });

      const expiresAt = new Date(Date.now() + 3600000).toISOString();
      const waiver = addOrUpdateWaiver({
        workspaceRoot: workspace,
        taskId: "HERMES-WAIVER-REGISTRY-001",
        actor: "maintenance.autopilot",
        action: "archive",
        riskLevel: "low",
        reason: "Valid reason for doing waiver",
        expiresAt,
        createdBy: "tester",
        reviewLevel: "none"
      });

      revokeWaiver({
        workspaceRoot: workspace,
        waiverId: waiver.waiverId,
        reason: "No longer needed",
        revokedBy: "tester"
      });

      const signal = evaluateWaiver({
        workspaceRoot: workspace,
        taskId: "HERMES-WAIVER-REGISTRY-001",
        actor: "maintenance.autopilot",
        action: "archive"
      });

      expect(signal.matched).toBe(true);
      expect(signal.active).toBe(false);
      expect(signal.revoked).toBe(true);
      expect(signal.canRelaxDecision).toBe(false);
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("5. markWaiverUsed sets status to used", () => {
    const workspace = makeWorkspace();
    try {
      initializeWaiverRegistry({ workspaceRoot: workspace });

      const expiresAt = new Date(Date.now() + 3600000).toISOString();
      const waiver = addOrUpdateWaiver({
        workspaceRoot: workspace,
        taskId: "HERMES-WAIVER-REGISTRY-001",
        actor: "maintenance.autopilot",
        action: "archive",
        riskLevel: "low",
        reason: "Valid reason for doing waiver",
        expiresAt,
        createdBy: "tester",
        reviewLevel: "none"
      });

      const updated = markWaiverUsed({
        workspaceRoot: workspace,
        waiverId: waiver.waiverId
      });
      expect(updated.status).toBe("used");
      expect(updated.usedAt).toBeDefined();

      const signal = evaluateWaiver({
        workspaceRoot: workspace,
        taskId: "HERMES-WAIVER-REGISTRY-001",
        actor: "maintenance.autopilot",
        action: "archive"
      });

      // Once status is 'used', isWaiverActive returns false (status !== active)
      expect(signal.active).toBe(false);
    } finally {
      cleanupWorkspace(workspace);
    }
  });
});


describe("Waiver Registry rollback reference", () => {
  it("stores rollbackRef on added waivers", () => {
    const workspace = makeWorkspace();
    try {
      initializeWaiverRegistry({ workspaceRoot: workspace });
      const record = addOrUpdateWaiver({
        workspaceRoot: workspace,
        taskId: "TASK-RB-REF-001",
        actor: "maintenance.autopilot",
        action: "inspect",
        riskLevel: "low",
        reason: "Valid reason for linking rollback evidence",
        rollbackPlan: "legacy text plan remains supported",
        rollbackRef: "contract.test.ref",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        createdBy: "tester",
        reviewLevel: "none"
      });

      expect(record.rollbackRef).toBe("contract.test.ref");
      const loaded = loadWaiverRegistry({ workspaceRoot: workspace }).find(w => w.waiverId === record.waiverId);
      expect(loaded?.rollbackRef).toBe("contract.test.ref");
    } finally {
      cleanupWorkspace(workspace);
    }
  });
});
