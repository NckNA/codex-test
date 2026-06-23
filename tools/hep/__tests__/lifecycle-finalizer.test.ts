import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { finalizeLifecycle } from "../lifecycle-finalizer.ts";

describe("Lifecycle finalizer", () => {
  function createWorkspace(): string {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "hermes-lifecycle-"));
    fs.mkdirSync(path.join(workspace, "memory"), { recursive: true });
    fs.mkdirSync(path.join(workspace, "codex-test", "_ai_work", "REPORTS"), { recursive: true });
    fs.writeFileSync(path.join(workspace, "codex-test", "_ai_work", "REPORTS", "TASK-001_report.md"), "# TASK-001", "utf8");
    fs.writeFileSync(path.join(workspace, "super-hermes-policy.json"), "{}", "utf8");
    fs.writeFileSync(path.join(workspace, "memory", "task-registry.json"), JSON.stringify({ schemaVersion: 1, workspaceRoot: workspace, tasks: [{ taskId: "TASK-001", status: "ACTIVE_POLICY" }] }, null, 2), "utf8");
    fs.writeFileSync(path.join(workspace, "memory", "pr-registry.json"), JSON.stringify({ schemaVersion: 1, workspaceRoot: workspace, pullRequests: [] }, null, 2), "utf8");
    fs.writeFileSync(path.join(workspace, "memory", "worktree-registry.json"), JSON.stringify({ schemaVersion: 1, workspaceRoot: workspace, worktrees: [{ path: path.join(workspace, "TASK-001-work"), branch: "feature/task-001", head: "abc123" }] }, null, 2), "utf8");
    return workspace;
  }

  it("marks merged task registries and worktree archive candidate", () => {
    const workspace = createWorkspace();
    const result = finalizeLifecycle({ workspaceRoot: workspace, taskId: "TASK-001", prNumber: 328, prState: "MERGED", branch: "feature/task-001", head: "abc123", baseBranch: "main", finalizedAt: "2026-06-24T00:00:00.000Z" });
    expect(result.status).toBe("MERGED");
    expect(result.updatedFiles).toHaveLength(4);
    const taskRegistry = JSON.parse(fs.readFileSync(path.join(workspace, "memory", "task-registry.json"), "utf8"));
    expect(taskRegistry.tasks[0].status).toBe("MERGED");
    expect(taskRegistry.tasks[0].previousStatus).toBe("ACTIVE_POLICY");
    const prRegistry = JSON.parse(fs.readFileSync(path.join(workspace, "memory", "pr-registry.json"), "utf8"));
    expect(prRegistry.pullRequests[0].state).toBe("MERGED");
    const worktreeRegistry = JSON.parse(fs.readFileSync(path.join(workspace, "memory", "worktree-registry.json"), "utf8"));
    expect(worktreeRegistry.worktrees[0].lifecycleStatus).toBe("ARCHIVE_CANDIDATE");
    expect(fs.existsSync(path.join(workspace, "super-hermes-policy.json"))).toBe(true);
  });

  it("supports dry-run without changing registries", () => {
    const workspace = createWorkspace();
    const result = finalizeLifecycle({ workspaceRoot: workspace, taskId: "TASK-001", prState: "MERGED", branch: "feature/task-001", finalizedAt: "2026-06-24T00:00:00.000Z", dryRun: true });
    expect(result.updatedFiles).toHaveLength(0);
    const taskRegistry = JSON.parse(fs.readFileSync(path.join(workspace, "memory", "task-registry.json"), "utf8"));
    expect(taskRegistry.tasks[0].status).toBe("ACTIVE_POLICY");
  });
});
