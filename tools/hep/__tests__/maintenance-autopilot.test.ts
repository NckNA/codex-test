import * as childProcess from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildAssetRecord, createAssetLease, upsertAssetRegistry } from "../dependency-guard.ts";
import { runMaintenanceAutopilot } from "../maintenance-autopilot.ts";

describe("Maintenance autopilot", () => {
  const workspaces: string[] = [];

  function createWorkspace(): { workspace: string; project: string; legacyReport: string } {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "hermes-autopilot-"));
    workspaces.push(workspace);
    const project = path.join(workspace, "codex-test");
    const legacyReport = path.join(workspace, "reports", "legacy.md");
    fs.mkdirSync(path.join(project, "_ai_work", "REPORTS"), { recursive: true });
    fs.mkdirSync(path.dirname(legacyReport), { recursive: true });
    fs.writeFileSync(path.join(project, "_ai_work", "REPORTS", "TASK-GAMMA-001_report.md"), "# TASK-GAMMA-001\nPR #44\n", "utf8");
    fs.writeFileSync(legacyReport, "legacy", "utf8");
    return { workspace, project, legacyReport };
  }

  afterEach(() => {
    for (const workspace of workspaces.splice(0)) {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("runs dry-run only, writes logs, and does not move report files", () => {
    const { workspace, project, legacyReport } = createWorkspace();
    const result = runMaintenanceAutopilot({
      workspaceRoot: workspace,
      projectPath: project,
      taskId: "HERMES-MAINTENANCE-AUTOPILOT-001B",
      maxActions: 1,
      now: "2026-06-24T00:00:00.000Z"
    });

    expect(result.ok).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.plannedActionsCount).toBe(1);
    expect(result.actions).toBe(1);
    expect(result.guardianDecision).toBe("ALLOW");
    expect(result.scopes).toEqual(["reports"]);
    expect(fs.existsSync(legacyReport)).toBe(true);
    expect(fs.existsSync(path.join(workspace, "reports", "indexes", "report-index.json"))).toBe(true);
    expect(fs.existsSync(path.join(workspace, "logs", "maintenance-autopilot-runs.jsonl"))).toBe(true);
  });

  it("rejects non dry-run autopilot in v1B", () => {
    const { workspace, project } = createWorkspace();
    expect(() => runMaintenanceAutopilot({ workspaceRoot: workspace, projectPath: project, dryRun: false })).toThrow(/dry-run only/);
  });

  it("uses guardian before planning", () => {
    const { workspace, project } = createWorkspace();
    fs.mkdirSync(path.join(workspace, "memory"), { recursive: true });
    fs.writeFileSync(path.join(workspace, "memory", "guardian-acl.json"), JSON.stringify({
      roles: [{
        actor: "maintenance.autopilot",
        level: 1,
        allowedZones: ["logs"],
        forbiddenZones: ["reports"],
        allowedActions: ["dry_run"],
        forbiddenActions: ["delete"],
        requiresDryRunFirst: true
      }]
    }, null, 2), "utf8");

    const result = runMaintenanceAutopilot({
      workspaceRoot: workspace,
      projectPath: project,
      taskId: "HERMES-MAINTENANCE-AUTOPILOT-001B",
      now: "2026-06-24T00:00:00.000Z"
    });

    expect(result.ok).toBe(false);
    expect(result.guardianDecision).toBe("DENY");
    expect(result.plannedActionsCount).toBe(0);
    expect(result.blockedCount).toBe(1);
    expect(result.warnings.join("\n")).toContain("Guardian blocked autopilot");
    expect(fs.existsSync(path.join(workspace, "reports", "indexes", "report-index.json"))).toBe(false);
  });

  it("uses dependency guard to block unsafe candidates", () => {
    const { workspace, project, legacyReport } = createWorkspace();
    const asset = {
      ...buildAssetRecord(workspace, legacyReport),
      referencedBy: ["ACTIVE-TASK-001"],
      linkedTasks: ["ACTIVE-TASK-001"]
    };
    upsertAssetRegistry(workspace, [asset]);
    createAssetLease(workspace, {
      assetId: asset.assetId,
      leasedBy: "other.actor",
      taskId: "ACTIVE-TASK-001",
      mode: "exclusive",
      expiresAt: "2099-01-01T00:00:00.000Z",
      reason: "fixture active lease"
    });

    const result = runMaintenanceAutopilot({
      workspaceRoot: workspace,
      projectPath: project,
      taskId: "HERMES-MAINTENANCE-AUTOPILOT-001B",
      maxActions: 1,
      now: "2026-06-24T00:00:00.000Z"
    });

    expect(result.ok).toBe(true);
    expect(result.plannedActionsCount).toBe(0);
    expect(result.blockedCount).toBe(1);
    expect(result.blockedCandidates[0].path).toBe("reports/legacy.md");
    expect(result.dependencyDecisionCounts.REQUIRE_WAIVER_PLAN).toBe(1);
    expect(fs.existsSync(legacyReport)).toBe(true);
  });

  it("allows safe dry-run candidates", () => {
    const { workspace, project, legacyReport } = createWorkspace();
    const result = runMaintenanceAutopilot({
      workspaceRoot: workspace,
      projectPath: project,
      taskId: "HERMES-MAINTENANCE-AUTOPILOT-001B",
      only: ["reports"],
      maxActions: 1,
      now: "2026-06-24T00:00:00.000Z"
    });

    expect(result.ok).toBe(true);
    expect(result.plannedActionsCount).toBe(1);
    expect(result.dependencyDecisionCounts.ALLOW).toBe(1);
    expect(fs.existsSync(legacyReport)).toBe(true);
  });

  it("CLI maintenance-autopilot works", () => {
    const { workspace, project } = createWorkspace();
    const cliPath = path.resolve("tools", "hep", "index.ts");
    const output = childProcess.execFileSync(process.execPath, [
      "--experimental-strip-types",
      cliPath,
      "maintenance-autopilot",
      "--workspaceRoot",
      workspace,
      "--repositoryPath",
      project,
      "--taskId",
      "HERMES-MAINTENANCE-AUTOPILOT-001B",
      "--only",
      "reports",
      "--max-actions",
      "1",
      "--dry-run"
    ], { encoding: "utf8" });
    const parsed = JSON.parse(output) as { ok: boolean; dryRun: boolean; plannedActionsCount: number; guardianDecision: string };

    expect(parsed.ok).toBe(true);
    expect(parsed.dryRun).toBe(true);
    expect(parsed.plannedActionsCount).toBe(1);
    expect(parsed.guardianDecision).toBe("ALLOW");
  });
});
