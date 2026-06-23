import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { buildReportIndex, writeReportIndex } from "../report-indexer.ts";

describe("Report indexer", () => {
  it("indexes task ids, PRs, branches, stale flags, and duplicate task ids", () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "hermes-reports-"));
    const project = path.join(workspace, "codex-test");
    const reports = path.join(project, "_ai_work", "REPORTS");
    fs.mkdirSync(reports, { recursive: true });
    fs.writeFileSync(path.join(reports, "TASK-ALPHA-001_report.md"), "# TASK-ALPHA-001\n- Branch: `feature/alpha`\n- PR URL: https://github.com/acme/repo/pull/12\nFinal verdict: merged\n", "utf8");
    fs.writeFileSync(path.join(reports, "TASK-ALPHA-001_followup.md"), "# TASK-ALPHA-001 followup\nTODO pending\n", "utf8");
    fs.writeFileSync(path.join(reports, "loose.md"), "# loose note\nNo task here\n", "utf8");

    const index = buildReportIndex({ workspaceRoot: workspace, projectPath: project, now: "2026-06-24T00:00:00.000Z" });
    expect(index.summary.total).toBe(3);
    expect(index.summary.orphaned).toBe(1);
    expect(index.summary.stale).toBe(1);
    expect(index.summary.duplicateTaskIds).toContain("TASK-ALPHA-001");
    const alpha = index.entries.find((entry) => entry.fileName === "TASK-ALPHA-001_report.md");
    expect(alpha?.prNumbers).toContain(12);
    expect(alpha?.branches).toContain("feature/alpha");
    expect(alpha?.inferredStatus).toBe("MERGED");
  });

  it("writes the index to reports/indexes by default", () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "hermes-reports-write-"));
    const project = path.join(workspace, "codex-test");
    fs.mkdirSync(path.join(project, "_ai_work", "REPORTS"), { recursive: true });
    fs.writeFileSync(path.join(project, "_ai_work", "REPORTS", "TASK-BETA-001_report.md"), "# TASK-BETA-001\n", "utf8");
    const index = buildReportIndex({ workspaceRoot: workspace, projectPath: project });
    const output = writeReportIndex(index);
    expect(output).toBe(path.join(workspace, "reports", "indexes", "report-index.json"));
    expect(fs.existsSync(output)).toBe(true);
  });
});
