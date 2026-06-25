import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  addOrUpdateSelfImprovementProposal,
  approveSelfImprovementProposal,
  evaluateSelfImprovementProposal,
  formatSelfImprovementCheck,
  initializeSelfImprovementRegistry,
  listSelfImprovementProposals,
  parseSelfImprovementList,
  revokeSelfImprovementProposal
} from "../self-improvement-gate.ts";

function workspace(): string {
  return join(tmpdir(), "self-improvement-tests", `${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

function cleanup(path: string): void {
  rmSync(path, { recursive: true, force: true });
}

function base(root: string) {
  return {
    workspaceRoot: root,
    taskId: "HERMES-SELF-IMPROVEMENT-GATE-001",
    actor: "maintenance.autopilot",
    action: "self-improve",
    target: "tools/hep/index.ts",
    rootCause: "tooling_false_positive" as const,
    riskLevel: "medium" as const,
    createdBy: "Nick",
    blockerSummary: "CLI route was blocked by tool layer",
    evidence: ["blocked command shape observed"],
    proposedTaskId: "HERMES-SELF-IMPROVEMENT-GATE-001",
    proposedScope: ["tools/hep/index.ts"],
    expectedBenefit: "Reduce repeated blocked CLI edits",
    safetyChecks: ["npm test -- --run", "npm run build"]
  };
}

describe("self-improvement gate", () => {
  it("initializes an empty registry", () => {
    const root = workspace();
    try {
      expect(initializeSelfImprovementRegistry({ workspaceRoot: root })).toEqual([]);
      expect(existsSync(join(root, "memory", "self-improvement", "self-improvement-registry.json"))).toBe(true);
    } finally {
      cleanup(root);
    }
  });

  it("adds and lists a proposal", () => {
    const root = workspace();
    try {
      const proposal = addOrUpdateSelfImprovementProposal(base(root));
      expect(proposal.status).toBe("proposed");
      expect(proposal.evidence).toEqual(["blocked command shape observed"]);
      expect(listSelfImprovementProposals({ workspaceRoot: root })).toHaveLength(1);
    } finally {
      cleanup(root);
    }
  });

  it("requires evidence, scope, and safety checks", () => {
    const root = workspace();
    try {
      expect(() => addOrUpdateSelfImprovementProposal({ ...base(root), evidence: [] })).toThrow(/evidence/);
      expect(() => addOrUpdateSelfImprovementProposal({ ...base(root), proposedScope: [] })).toThrow(/proposedScope/);
      expect(() => addOrUpdateSelfImprovementProposal({ ...base(root), safetyChecks: [] })).toThrow(/safetyChecks/);
    } finally {
      cleanup(root);
    }
  });

  it("requires rollbackRef for high risk proposals", () => {
    const root = workspace();
    try {
      expect(() => addOrUpdateSelfImprovementProposal({ ...base(root), riskLevel: "high" })).toThrow(/rollbackRef/);
      const proposal = addOrUpdateSelfImprovementProposal({ ...base(root), riskLevel: "high", rollbackRef: "rb.self.1" });
      expect(proposal.rollbackRef).toBe("rb.self.1");
    } finally {
      cleanup(root);
    }
  });

  it("does not allow unapproved proposal to proceed", () => {
    const root = workspace();
    try {
      addOrUpdateSelfImprovementProposal(base(root));
      const signal = evaluateSelfImprovementProposal({ workspaceRoot: root, taskId: "HERMES-SELF-IMPROVEMENT-GATE-001", actor: "maintenance.autopilot", action: "self-improve", target: "tools/hep/index.ts" });
      expect(signal.matched).toBe(true);
      expect(signal.approved).toBe(false);
      expect(signal.canProceed).toBe(false);
      expect(signal.reasons).toContain("Self-improvement proposal is not approved.");
    } finally {
      cleanup(root);
    }
  });

  it("allows approved proposal to proceed", () => {
    const root = workspace();
    try {
      const proposal = addOrUpdateSelfImprovementProposal({ ...base(root), approvedBy: "Nick" });
      const signal = evaluateSelfImprovementProposal({ workspaceRoot: root, taskId: proposal.taskId, actor: proposal.actor, action: proposal.action, target: proposal.target });
      expect(signal.approved).toBe(true);
      expect(signal.canProceed).toBe(true);
      expect(formatSelfImprovementCheck(signal)).toContain("Self-Improvement Gate Result");
    } finally {
      cleanup(root);
    }
  });

  it("approves and revokes proposals", () => {
    const root = workspace();
    try {
      const proposal = addOrUpdateSelfImprovementProposal(base(root));
      const approved = approveSelfImprovementProposal({ workspaceRoot: root, proposalId: proposal.proposalId, approvedBy: "Nick" });
      expect(approved.status).toBe("approved");
      const revoked = revokeSelfImprovementProposal({ workspaceRoot: root, proposalId: proposal.proposalId, reason: "test cleanup", revokedBy: "Nick" });
      expect(revoked.status).toBe("revoked");
    } finally {
      cleanup(root);
    }
  });

  it("writes event log", () => {
    const root = workspace();
    try {
      addOrUpdateSelfImprovementProposal(base(root));
      const eventPath = join(root, "logs", "self-improvement", "self-improvement-events.jsonl");
      expect(existsSync(eventPath)).toBe(true);
      expect(readFileSync(eventPath, "utf8")).toContain("self-improvement-add");
    } finally {
      cleanup(root);
    }
  });

  it("parses semicolon lists", () => {
    expect(parseSelfImprovementList("a;b; c ")).toEqual(["a", "b", "c"]);
  });
});
