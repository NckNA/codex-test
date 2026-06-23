import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { runMaintenanceAutopilot } from "../maintenance-autopilot.ts";

describe("Maintenance autopilot", () => {
  function createWorkspace(): { workspace: string; project: string } {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "hermes-autopilot-"));
    const project = path.join(workspace, "codex-test");
    fs.mkdirSync(path.join(project, "_ai_work", "REPORTS"), { recursive: true });
    fs.mkdirSync(path.join(workspace, "reports"), { recursive: true });
    fs.writeFileSync(path.join(project, "_ai_work", "REPORTS", "TASK-GAMMA-001_report.md"), "# TASK-GAMMA-001\nPR #44\n", "utf8");
    fs.writeFileSync(path.join(workspace, "reports", "legacy.md"), "legacy", "utf8");
    return { workspace, project };
  }

  it("runs dry-run by default, writes indexes/logs, and does not move report files", () => {
    const { workspace, project } = createWorkspace();
    const legacyReport = path.join(workspace, "reports", "legacy.md");
    const result = runMaintenanceAutopilot({ workspaceRoot: workspace, projectPath: project, maxActions: 1, now: "2026-06-24T00:00:00.000Z" });
    expect(result.dryRun).toBe(true);
    expect(result.actions).toBe(1);
    expect(result.scopes).toEqual(["reports"]);
    expect(fs.existsSync(legacyReport)).toBe(true);
    expect(fs.existsSync(path.join(workspace, "reports", "indexes", "report-index.json"))).toBe(true);
    expect(fs.existsSync(path.join(workspace, "logs", "maintenance-autopilot-runs.jsonl"))).toBe(true);
  });

  it("rejects non-dry-run autopilot in v1", () => {
    const { workspace, project } = createWorkspace();
    expect(() => runMaintenanceAutopilot({ workspaceRoot: workspace, projectPath: project, dryRun: false })).toThrow(/dry-run only/);
  });
});
