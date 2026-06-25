import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  addOrUpdateChangeset,
  evaluateChangeset,
  formatChangesetCheck,
  initializeChangesetRegistry,
  listChangesets,
  parseChangesetCheckInput,
  parseChangesetFileInput,
  revokeChangeset
} from "../changeset-registry.ts";

function workspace(): string {
  return join(tmpdir(), "changeset-registry-tests", `${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

function cleanup(path: string): void {
  rmSync(path, { recursive: true, force: true });
}

function base(root: string) {
  return {
    workspaceRoot: root,
    taskId: "HERMES-CHANGESET-REGISTRY-001",
    actor: "maintenance.autopilot",
    action: "modify",
    target: "tools/hep/index.ts",
    riskLevel: "medium" as const,
    createdBy: "Nick",
    planId: "plan.test",
    rollbackRef: "rb.test",
    commitHash: "abc123",
    branch: "feature/test",
    plannedFiles: ["tools/hep/index.ts"],
    actualFiles: [parseChangesetFileInput("tools/hep/index.ts|modified|10|2")],
    checks: [parseChangesetCheckInput("test|pass|npm test -- --run|tests pass")],
    diffSummary: "1 file changed",
    notes: ["test changeset"]
  };
}

describe("changeset registry", () => {
  it("initializes an empty registry", () => {
    const root = workspace();
    try {
      expect(initializeChangesetRegistry({ workspaceRoot: root })).toEqual([]);
      expect(existsSync(join(root, "memory", "changesets", "changeset-registry.json"))).toBe(true);
    } finally {
      cleanup(root);
    }
  });

  it("adds and lists a validated changeset", () => {
    const root = workspace();
    try {
      const record = addOrUpdateChangeset(base(root));
      expect(record.status).toBe("validated");
      expect(record.unplannedFiles).toEqual([]);
      expect(record.missingPlannedFiles).toEqual([]);
      expect(listChangesets({ workspaceRoot: root })).toHaveLength(1);
    } finally {
      cleanup(root);
    }
  });

  it("requires planned files", () => {
    const root = workspace();
    try {
      expect(() => addOrUpdateChangeset({ ...base(root), plannedFiles: [] })).toThrow(/plannedFiles/);
    } finally {
      cleanup(root);
    }
  });

  it("requires actual files", () => {
    const root = workspace();
    try {
      expect(() => addOrUpdateChangeset({ ...base(root), actualFiles: [] })).toThrow(/actualFiles/);
    } finally {
      cleanup(root);
    }
  });

  it("requires rollbackRef for high risk", () => {
    const root = workspace();
    try {
      expect(() => addOrUpdateChangeset({ ...base(root), riskLevel: "high", rollbackRef: undefined })).toThrow(/rollbackRef/);
    } finally {
      cleanup(root);
    }
  });

  it("records unplanned files", () => {
    const root = workspace();
    try {
      const record = addOrUpdateChangeset({
        ...base(root),
        actualFiles: [
          parseChangesetFileInput("tools/hep/index.ts|modified|10|2"),
          parseChangesetFileInput("tools/hep/extra.ts|added|1|0")
        ]
      });
      expect(record.status).toBe("recorded");
      expect(record.unplannedFiles).toEqual(["tools/hep/extra.ts"]);
    } finally {
      cleanup(root);
    }
  });

  it("records missing planned files", () => {
    const root = workspace();
    try {
      const record = addOrUpdateChangeset({
        ...base(root),
        plannedFiles: ["tools/hep/index.ts", "tools/hep/change-plan.ts"]
      });
      expect(record.status).toBe("recorded");
      expect(record.missingPlannedFiles).toEqual(["tools/hep/change-plan.ts"]);
    } finally {
      cleanup(root);
    }
  });

  it("evaluates matching changeset", () => {
    const root = workspace();
    try {
      addOrUpdateChangeset(base(root));
      const signal = evaluateChangeset({ workspaceRoot: root, taskId: "HERMES-CHANGESET-REGISTRY-001", actor: "maintenance.autopilot", action: "modify", target: "tools/hep/index.ts" });
      expect(signal.matched).toBe(true);
      expect(signal.validated).toBe(true);
      expect(signal.hasCommit).toBe(true);
      expect(signal.checksPassing).toBe(true);
    } finally {
      cleanup(root);
    }
  });

  it("revokes changesets", () => {
    const root = workspace();
    try {
      const record = addOrUpdateChangeset(base(root));
      const revoked = revokeChangeset({ workspaceRoot: root, changesetId: record.changesetId, reason: "test cleanup", revokedBy: "Nick" });
      expect(revoked.status).toBe("revoked");
    } finally {
      cleanup(root);
    }
  });

  it("writes event log", () => {
    const root = workspace();
    try {
      addOrUpdateChangeset(base(root));
      const eventPath = join(root, "logs", "changesets", "changeset-events.jsonl");
      expect(existsSync(eventPath)).toBe(true);
      expect(readFileSync(eventPath, "utf8")).toContain("changeset-add");
    } finally {
      cleanup(root);
    }
  });

  it("formats safe check summary", () => {
    const root = workspace();
    try {
      addOrUpdateChangeset(base(root));
      const signal = evaluateChangeset({ workspaceRoot: root, taskId: "HERMES-CHANGESET-REGISTRY-001", actor: "maintenance.autopilot", action: "modify", target: "tools/hep/index.ts" });
      expect(formatChangesetCheck(signal)).toContain("Changeset Check Result");
    } finally {
      cleanup(root);
    }
  });
});
