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
  const plannedFiles = ["tools/hep/index.ts"];
  return {
    workspaceRoot: root,
    taskId: "HERMES-CHANGESET-REGISTRY-001",
    planId: "change-plan.test",
    actor: "maintenance.autopilot",
    riskLevel: "medium" as const,
    summary: "Record actual HEP changes",
    plannedFiles,
    actualFiles: [parseChangesetFileInput("tools/hep/index.ts|modified|CLI updated", plannedFiles)],
    checks: [parseChangesetCheckInput("test|npm test -- --run|pass|827 tests")],
    rollbackRef: "rb.test.ref",
    commitHash: "abc123",
    branch: "feature/test"
  };
}

describe("changeset registry", () => {
  it("initializes empty registry", () => {
    const root = workspace();
    try {
      expect(initializeChangesetRegistry({ workspaceRoot: root })).toEqual([]);
      expect(existsSync(join(root, "memory", "changesets", "changeset-registry.json"))).toBe(true);
    } finally {
      cleanup(root);
    }
  });

  it("adds and lists a verified changeset", () => {
    const root = workspace();
    try {
      const record = addOrUpdateChangeset(base(root));
      expect(record.status).toBe("verified");
      expect(record.unplannedFiles).toEqual([]);
      expect(listChangesets({ workspaceRoot: root })).toHaveLength(1);
    } finally {
      cleanup(root);
    }
  });

  it("detects unplanned files", () => {
    const root = workspace();
    try {
      const record = addOrUpdateChangeset({
        ...base(root),
        actualFiles: [
          parseChangesetFileInput("tools/hep/index.ts|modified|planned", ["tools/hep/index.ts"]),
          parseChangesetFileInput("tools/hep/extra.ts|added|not planned", ["tools/hep/index.ts"])
        ]
      });
      expect(record.status).toBe("recorded");
      expect(record.unplannedFiles).toContain("tools/hep/extra.ts");
    } finally {
      cleanup(root);
    }
  });

  it("requires actual files", () => {
    const root = workspace();
    try {
      expect(() => addOrUpdateChangeset({ ...base(root), actualFiles: [] })).toThrow(/actual files/);
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

  it("evaluates matching changeset", () => {
    const root = workspace();
    try {
      addOrUpdateChangeset(base(root));
      const signal = evaluateChangeset({ workspaceRoot: root, taskId: "HERMES-CHANGESET-REGISTRY-001", planId: "change-plan.test" });
      expect(signal.matched).toBe(true);
      expect(signal.verified).toBe(true);
      expect(signal.checksPassed).toBe(true);
    } finally {
      cleanup(root);
    }
  });

  it("revokes changeset", () => {
    const root = workspace();
    try {
      const record = addOrUpdateChangeset(base(root));
      const revoked = revokeChangeset({ workspaceRoot: root, changesetId: record.changesetId, reason: "cleanup", revokedBy: "Nick" });
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

  it("formats a safe summary", () => {
    const root = workspace();
    try {
      addOrUpdateChangeset(base(root));
      const signal = evaluateChangeset({ workspaceRoot: root, taskId: "HERMES-CHANGESET-REGISTRY-001" });
      expect(formatChangesetCheck(signal)).toContain("Changeset Check Result");
    } finally {
      cleanup(root);
    }
  });
});
