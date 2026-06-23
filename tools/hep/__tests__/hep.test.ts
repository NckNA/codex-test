import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as childProcess from "node:child_process";
import { verifyNodeEnvironment, redactSecrets, TaskMemoryManager } from "../task-memory.ts";
import { validateWorktreePath, checkWorkspaceClean, WorktreeManager, gitExecutor } from "../worktree-manager.ts";
import { finalizeReport, detectLatestReport } from "../metadata-finalizer.ts";
import { applySafeMaintenancePlan, createMaintenancePlan, restoreMaintenanceAction } from "../maintenance.ts";

describe("HEP Tooling Validation Test Suite", () => {
  const tempDir = path.resolve("./_ai_work/scratch/temp-hep-tests");

  beforeEach(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore EPERM on locked SQLite files
      }
    }
  });

  // 1. Preflight Node Version Check
  describe("Node Environment Preflight", () => {
    it("should pass on valid Node.js version", () => {
      expect(() => verifyNodeEnvironment()).not.toThrow();
    });

    it("should fail on older Node.js versions", () => {
      const originalVersions = process.versions;
      
      // Stub process.versions.node
      Object.defineProperty(process, "versions", {
        value: { ...originalVersions, node: "18.15.0" },
        writable: true,
        configurable: true
      });

      expect(() => verifyNodeEnvironment()).toThrow(/Node.js version must be >= 24.15.0/);

      // Restore
      Object.defineProperty(process, "versions", {
        value: originalVersions,
        writable: true,
        configurable: true
      });
    });
  });

  // 2. Secret Redaction
  describe("Secret Redaction Policy", () => {
    it("should redact Supabase tokens starting with sbp_", () => {
      const text = "Found token sbp_mockToken1234567890123456789012345678 in registry";
      const result = redactSecrets(text);
      expect(result).not.toContain("mockToken1234567890123456789012345678");
      expect(result).toContain("[REDACTED_SUPABASE_TOKEN]");
    });

    it("should redact PostgreSQL connection strings", () => {
      const text = "Connecting to postgresql://postgres.dummy_project:dummy_password@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres";
      const result = redactSecrets(text);
      expect(result).not.toContain("dummy_password");
      expect(result).toContain("[REDACTED_DATABASE_URL]");
    });

    it("should redact authorization headers, bearer tokens, and passwords", () => {
      const text = "headers: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy', password: 'my-secret-pass' }";
      const result = redactSecrets(text);
      expect(result).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
      expect(result).not.toContain("my-secret-pass");
      expect(result).toContain("Authorization: '[REDACTED]'");
      expect(result).toContain("password: '[REDACTED]'");
    });

    it("should redact cookies", () => {
      const text1 = "Cookie: session_id=abc123xyz; user=john";
      const text2 = "headers: { 'cookie': 'token=foo' }";
      expect(redactSecrets(text1)).toContain("Cookie: [REDACTED_COOKIES]");
      expect(redactSecrets(text2)).toContain("'cookie': [REDACTED_COOKIES]");
    });

    it("should redact env-like secrets", () => {
      const text = "DB_PASSWORD=secret_val; API_KEY = \"my-key-123\"; OTHER_VAR=public_val";
      const result = redactSecrets(text);
      expect(result).toContain("DB_PASSWORD=[REDACTED]");
      expect(result).toContain("API_KEY = [REDACTED]");
      expect(result).toContain("OTHER_VAR=public_val"); // Non-secret variable remains unredacted
    });
  });

  // 3. Path Traversal Safety
  describe("Worktree Path Safety and Traversal Protection", () => {
    const root = "D:\\hermes\\worktrees";

    it("should resolve valid paths under the worktree root", () => {
      const resolved = validateWorktreePath(root, "task-001");
      expect(resolved.toLowerCase()).toBe(path.resolve(root, "task-001").toLowerCase());
    });

    it("should reject path traversal escapes using dot-dot relative patterns", () => {
      expect(() => validateWorktreePath(root, "../unsafe-location")).toThrow();
      expect(() => validateWorktreePath(root, "task-1/../../unsafe-location")).toThrow();
    });

    it("should reject drive changes", () => {
      expect(() => validateWorktreePath(root, "C:/unsafe-drive")).toThrow();
    });

    it("should reject UNC network paths", () => {
      expect(() => validateWorktreePath(root, "\\\\unc-network-share\\folder")).toThrow();
    });

    it("should reject roots escaping D:\\hermes\\worktrees", () => {
      expect(() => validateWorktreePath("C:\\unsafe\\root", "task-1")).toThrow(/Root must stay under D:\\hermes\\worktrees/);
    });
  });

  // 4. Dirty Workspace Refusal
  describe("Dirty Workspace Protection", () => {
    it("should throw if git status contains changes", () => {
      // Mock gitExecutor.execSync to return a dirty status
      const spy = vi.spyOn(gitExecutor, "execSync").mockReturnValue("M src/file.ts\n?? src/untracked.ts");
      expect(() => checkWorkspaceClean(tempDir)).toThrow(/Source repository has uncommitted changes/);
      spy.mockRestore();
    });

    it("should pass if git status is clean", () => {
      // Mock gitExecutor.execSync to return empty string (clean status)
      const spy = vi.spyOn(gitExecutor, "execSync").mockReturnValue("");
      expect(() => checkWorkspaceClean(tempDir)).not.toThrow();
      spy.mockRestore();
    });
  });

  // 5. Dry-run Verification
  describe("Dry-run execution", () => {
    it("should print planned actions without executing git or writing to db", () => {
      const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const execSpy = vi.spyOn(gitExecutor, "execSync").mockReturnValue("");
      
      const manager = new WorktreeManager(tempDir);
      manager.initTask({
        taskId: "HEP-DRY-RUN-001",
        baseBranch: "main",
        branchName: "feature/dry-run",
        dryRun: true,
        bypassCleanCheck: true
      });

      // Assert that git was not executed
      expect(execSpy).not.toHaveBeenCalled();
      
      // Assert that it printed dry-run info
      const loggedTexts = consoleLogSpy.mock.calls.map(args => args[0]);
      expect(loggedTexts.some(t => typeof t === "string" && t.includes("[Dry-run]"))).toBe(true);

      // Verify db file was not created
      const dbPath = path.join(tempDir, "_ai_work/task_memory/task_memory.db");
      expect(fs.existsSync(dbPath)).toBe(false);

      consoleLogSpy.mockRestore();
      execSpy.mockRestore();
    });
  });

  // 6. SQLite Task Memory Initialization and Operations
  describe("SQLite Task Memory (task_memory.db)", () => {
    it("should initialize database schema and write/read task metadata", () => {
      const memory = new TaskMemoryManager(tempDir);
      memory.connect();

      const taskId = "HEP-TEST-DB-001";
      memory.insertTaskHistory({
        taskId,
        taskType: "test_run",
        repositoryPath: tempDir,
        worktreePath: path.join(tempDir, "worktree"),
        baseBranch: "main",
        branchName: "feature/test",
        status: "INITIALIZED"
      });

      const history = memory.getTaskHistory(taskId);
      expect(history).not.toBeNull();
      expect(history?.task_id).toBe(taskId);
      expect(history?.status).toBe("INITIALIZED");

      // Verify events logging
      memory.insertTaskEvent(taskId, "TEST_EVENT", "Task database execution verified");
      
      // Update status
      memory.updateTaskFinalStatus(taskId, {
        status: "COMPLETED",
        finalVerdict: "SUCCESS"
      });

      const updatedHistory = memory.getTaskHistory(taskId);
      expect(updatedHistory?.status).toBe("COMPLETED");
      expect(updatedHistory?.final_verdict).toBe("SUCCESS");

      memory.close();
    });
  });

  // 7. .gitignore Rules Check
  describe("Gitignore Security", () => {
    it("should contain SQLite temporary file exclude patterns in .gitignore", () => {
      const gitignorePath = path.resolve("./.gitignore");
      expect(fs.existsSync(gitignorePath)).toBe(true);

      const content = fs.readFileSync(gitignorePath, "utf8");
      expect(content).toContain("_ai_work/task_memory/*.db");
      expect(content).toContain("_ai_work/task_memory/*.db-shm");
      expect(content).toContain("_ai_work/task_memory/*.db-wal");
    });

    it("should verify no database file is committed in git tracked files", () => {
      const gitFiles = childProcess.execSync("git ls-files", { encoding: "utf8" });
      expect(gitFiles).not.toContain("task_memory.db");
      expect(gitFiles).not.toContain("task_memory.db-shm");
      expect(gitFiles).not.toContain("task_memory.db-wal");
    });
  });

  // 8. Maintenance Trio
  describe("Maintenance Trio", () => {
    function createWorkspaceFixture(): string {
      const workspace = path.join(tempDir, "hermes-workspace");
      fs.mkdirSync(path.join(workspace, "memory"), { recursive: true });
      fs.mkdirSync(path.join(workspace, "reports"), { recursive: true });
      fs.mkdirSync(path.join(workspace, "codex-test", ".git"), { recursive: true });
      fs.mkdirSync(path.join(workspace, "temp"), { recursive: true });
      fs.writeFileSync(path.join(workspace, "reports", "old-report.md"), "legacy report", "utf8");
      fs.writeFileSync(path.join(workspace, "temp", "scratch.txt"), "scratch", "utf8");
      fs.writeFileSync(path.join(workspace, "super-hermes-policy.json"), "{}", "utf8");
      return workspace;
    }

    it("should keep protected assets and escalate git checkouts instead of moving engines", () => {
      const workspace = createWorkspaceFixture();
      const plan = createMaintenancePlan({ workspaceRoot: workspace, taskId: "MAINT-TEST-001" });

      const policy = plan.findings.find(item => item.relativePath === "super-hermes-policy.json");
      expect(policy?.quartermasterDecision).toBe("KEEP");
      expect(policy?.risk).toBe("CRITICAL");

      const checkout = plan.findings.find(item => item.relativePath === "codex-test");
      expect(checkout?.quartermasterDecision).toBe("KEEP");
      expect(checkout?.risk).toBe("CRITICAL");

      expect(plan.deleteEnabled).toBe(false);
      expect(plan.summary.deleteBlocked).toBe(0);
    });

    it("should archive legacy report root entries and quarantine temp entries with reversible actions", () => {
      const workspace = createWorkspaceFixture();
      const plan = createMaintenancePlan({ workspaceRoot: workspace, taskId: "MAINT-TEST-002" });

      const oldReport = plan.findings.find(item => item.relativePath === "reports/old-report.md");
      expect(oldReport?.quartermasterDecision).toBe("ARCHIVE");
      expect(oldReport?.risk).toBe("LOW");
      expect(oldReport?.suggestedTarget).toContain("reports");
      expect(oldReport?.suggestedTarget).toContain("archived");

      const scratch = plan.findings.find(item => item.relativePath === "temp/scratch.txt");
      expect(scratch?.quartermasterDecision).toBe("QUARANTINE");
      expect(scratch?.risk).toBe("LOW");

      const actions = applySafeMaintenancePlan(plan, new Date("2026-06-23T00:00:00.000Z"));
      expect(actions.length).toBe(2);
      expect(fs.existsSync(path.join(workspace, "reports", "old-report.md"))).toBe(false);
      expect(fs.existsSync(path.join(workspace, "temp", "scratch.txt"))).toBe(false);
      expect(fs.existsSync(actions[0].to || "")).toBe(true);
      expect(fs.existsSync(path.join(workspace, "memory", "maintenance-actions.jsonl"))).toBe(true);
    });

    it("should restore a reversible maintenance action by actionId", () => {
      const workspace = createWorkspaceFixture();
      const plan = createMaintenancePlan({ workspaceRoot: workspace, taskId: "MAINT-TEST-003" });
      const actions = applySafeMaintenancePlan(plan, new Date("2026-06-23T00:00:00.000Z"));
      const reportAction = actions.find(action => action.from.endsWith("old-report.md"));
      expect(reportAction).toBeDefined();

      const restored = restoreMaintenanceAction(workspace, reportAction?.actionId || "missing");
      expect(restored.to).toBe(path.join(workspace, "reports", "old-report.md"));
      expect(fs.existsSync(path.join(workspace, "reports", "old-report.md"))).toBe(true);
    });
  });

  // 9. Report Metadata Finalizer
  describe("Report Metadata Finalizer", () => {
    const mockReportsDir = path.join(tempDir, "_ai_work/REPORTS");

    beforeEach(() => {
      if (!fs.existsSync(mockReportsDir)) {
        fs.mkdirSync(mockReportsDir, { recursive: true });
      }
    });

    it("should successfully finalize bullet-list metadata format", () => {
      const reportPath = path.join(mockReportsDir, "HEP-TEST-BULLET-001.md");
      const initialContent = `# Test Report
## Metadata
- **PR URL**: TBD
- **Branch**: TBD
- **PR Head Reviewed**: TBD
- **Report Update Commit**: TBD
- **Run ID**: TBD
- **Run Number**: TBD
- **Tested Commit**: TBD
- **Final Verdict**: TBD
- **Recommended Next Task**: TBD
`;
      fs.writeFileSync(reportPath, initialContent, "utf8");

      const execSpy = vi.spyOn(gitExecutor, "execSync").mockImplementation((cmd) => {
        if (cmd === "git branch --show-current") return "feature/test-branch";
        if (cmd === "git rev-parse HEAD") return "local-head-sha-12345";
        if (cmd.startsWith("gh pr view")) return JSON.stringify({ url: "https://github.com/some/pr/326" });
        if (cmd.startsWith("gh run list")) {
          return JSON.stringify([{
            databaseId: 1234567,
            number: 42,
            status: "completed",
            conclusion: "success",
            headSha: "local-head-sha-12345"
          }]);
        }
        if (cmd === "git status --porcelain") return "";
        return "";
      });

      finalizeReport({
        repositoryPath: tempDir,
        reportPath,
        verdict: "SUCCESS",
        nextTask: "HEP-NEXT-TASK-001"
      });

      const updatedContent = fs.readFileSync(reportPath, "utf8");
      expect(updatedContent).toContain("- **PR URL**: [https://github.com/some/pr/326](https://github.com/some/pr/326)");
      expect(updatedContent).toContain("- **Branch**: `feature/test-branch`");
      expect(updatedContent).toContain("- **PR Head Reviewed**: `local-head-sha-12345`");
      expect(updatedContent).toContain("- **Report Update Commit**: `N/A because the final report update commit cannot reference itself before creation.`");
      expect(updatedContent).toContain("- **Run ID**: `1234567`");
      expect(updatedContent).toContain("- **Run Number**: `42`");
      expect(updatedContent).toContain("- **Tested Commit**: `local-head-sha-12345`");
      expect(updatedContent).toContain("- **Final Verdict**: **SUCCESS**");
      expect(updatedContent).toContain("- **Recommended Next Task**: **HEP-NEXT-TASK-001**");

      execSpy.mockRestore();
    });

    it("should successfully finalize numbered-section metadata format", () => {
      const reportPath = path.join(mockReportsDir, "HEP-TEST-NUMBERED-001.md");
      const initialContent = `# Test Report
## 1. PR URL
TBD

## 2. Branch
TBD

## 3. PR Head Reviewed
TBD

## 4. Report Update Commit
TBD

## 5. Run ID
TBD

## 6. Run Number
TBD

## 7. Tested Commit
TBD

## 8. Final Verdict
TBD

## 9. Recommended Next Task
TBD
`;
      fs.writeFileSync(reportPath, initialContent, "utf8");

      const execSpy = vi.spyOn(gitExecutor, "execSync").mockImplementation((cmd) => {
        if (cmd === "git branch --show-current") return "feature/test-branch";
        if (cmd === "git rev-parse HEAD") return "local-head-sha-12345";
        if (cmd.startsWith("gh pr view")) return JSON.stringify({ url: "https://github.com/some/pr/326" });
        if (cmd.startsWith("gh run list")) {
          return JSON.stringify([{
            databaseId: 1234567,
            number: 42,
            status: "completed",
            conclusion: "success",
            headSha: "local-head-sha-12345"
          }]);
        }
        if (cmd === "git status --porcelain") return "";
        return "";
      });

      finalizeReport({
        repositoryPath: tempDir,
        reportPath,
        verdict: "SUCCESS",
        nextTask: "HEP-NEXT-TASK-001"
      });

      const updatedContent = fs.readFileSync(reportPath, "utf8");
      expect(updatedContent).toContain("## 1. PR URL\nhttps://github.com/some/pr/326");
      expect(updatedContent).toContain("## 2. Branch\nfeature/test-branch");
      expect(updatedContent).toContain("## 3. PR Head Reviewed\nlocal-head-sha-12345");
      expect(updatedContent).toContain("## 4. Report Update Commit\nN/A because the final report update commit cannot reference itself before creation.");
      expect(updatedContent).toContain("## 5. Run ID\n1234567");
      expect(updatedContent).toContain("## 6. Run Number\n42");
      expect(updatedContent).toContain("## 7. Tested Commit\nlocal-head-sha-12345");
      expect(updatedContent).toContain("## 8. Final Verdict\nSUCCESS");
      expect(updatedContent).toContain("## 9. Recommended Next Task\nHEP-NEXT-TASK-001");

      execSpy.mockRestore();
    });

    it("should reject finalization if CI is pending", () => {
      const reportPath = path.join(mockReportsDir, "HEP-TEST-PENDING-001.md");
      const initialContent = `# Test Report
- **PR URL**: TBD
- **Branch**: TBD
- **PR Head Reviewed**: TBD
- **Report Update Commit**: TBD
- **Run ID**: TBD
- **Run Number**: TBD
- **Tested Commit**: TBD
`;
      fs.writeFileSync(reportPath, initialContent, "utf8");

      const execSpy = vi.spyOn(gitExecutor, "execSync").mockImplementation((cmd) => {
        if (cmd === "git branch --show-current") return "feature/test-branch";
        if (cmd === "git rev-parse HEAD") return "local-head-sha-12345";
        if (cmd.startsWith("gh pr view")) return JSON.stringify({ url: "https://github.com/some/pr/326" });
        if (cmd.startsWith("gh run list")) {
          return JSON.stringify([{
            databaseId: 1234567,
            number: 42,
            status: "in_progress",
            conclusion: "",
            headSha: "local-head-sha-12345"
          }]);
        }
        if (cmd === "git status --porcelain") return "";
        return "";
      });

      expect(() => {
        finalizeReport({
          repositoryPath: tempDir,
          reportPath
        });
      }).toThrow(/CI Validation Blocked: Latest workflow run is still in status "in_progress"/);

      execSpy.mockRestore();
    });

    it("should reject finalization if CI has failed", () => {
      const reportPath = path.join(mockReportsDir, "HEP-TEST-FAILED-001.md");
      const initialContent = `# Test Report
- **PR URL**: TBD
- **Branch**: TBD
- **PR Head Reviewed**: TBD
- **Report Update Commit**: TBD
- **Run ID**: TBD
- **Run Number**: TBD
- **Tested Commit**: TBD
`;
      fs.writeFileSync(reportPath, initialContent, "utf8");

      const execSpy = vi.spyOn(gitExecutor, "execSync").mockImplementation((cmd) => {
        if (cmd === "git branch --show-current") return "feature/test-branch";
        if (cmd === "git rev-parse HEAD") return "local-head-sha-12345";
        if (cmd.startsWith("gh pr view")) return JSON.stringify({ url: "https://github.com/some/pr/326" });
        if (cmd.startsWith("gh run list")) {
          return JSON.stringify([{
            databaseId: 1234567,
            number: 42,
            status: "completed",
            conclusion: "failure",
            headSha: "local-head-sha-12345"
          }]);
        }
        if (cmd === "git status --porcelain") return "";
        return "";
      });

      expect(() => {
        finalizeReport({
          repositoryPath: tempDir,
          reportPath
        });
      }).toThrow(/CI Validation Blocked: Latest workflow run finished with conclusion "failure"/);

      execSpy.mockRestore();
    });

    it("should reject finalization if latest CI headSha does not match local HEAD (stale CI)", () => {
      const reportPath = path.join(mockReportsDir, "HEP-TEST-MISMATCH-001.md");
      const initialContent = `# Test Report
- **PR URL**: TBD
- **Branch**: TBD
- **PR Head Reviewed**: TBD
- **Report Update Commit**: TBD
- **Run ID**: TBD
- **Run Number**: TBD
- **Tested Commit**: TBD
`;
      fs.writeFileSync(reportPath, initialContent, "utf8");

      const execSpy = vi.spyOn(gitExecutor, "execSync").mockImplementation((cmd) => {
        if (cmd === "git branch --show-current") return "feature/test-branch";
        if (cmd === "git rev-parse HEAD") return "local-head-sha-12345";
        if (cmd.startsWith("gh pr view")) return JSON.stringify({ url: "https://github.com/some/pr/326" });
        if (cmd.startsWith("gh run list")) {
          return JSON.stringify([{
            databaseId: 1234567,
            number: 42,
            status: "completed",
            conclusion: "success",
            headSha: "old-stale-sha-999"
          }]);
        }
        if (cmd === "git status --porcelain") return "";
        return "";
      });

      expect(() => {
        finalizeReport({
          repositoryPath: tempDir,
          reportPath
        });
      }).toThrow(/CI Validation Blocked: Tested SHA in CI \(old-stale-sha-999\) does not match local HEAD commit \(local-head-sha-12345\)/);

      execSpy.mockRestore();
    });

    it("should throw error if required metadata fields are missing", () => {
      const reportPath = path.join(mockReportsDir, "HEP-TEST-MISSING-FIELD-001.md");
      const initialContent = `# Test Report
- **Branch**: TBD
- **PR Head Reviewed**: TBD
- **Report Update Commit**: TBD
- **Run ID**: TBD
- **Run Number**: TBD
- **Tested Commit**: TBD
`;
      fs.writeFileSync(reportPath, initialContent, "utf8");

      expect(() => {
        finalizeReport({
          repositoryPath: tempDir,
          reportPath
        });
      }).toThrow(/Error: Required metadata field "PR URL" not found in the report/);
    });

    it("should throw error if multiple conflicting metadata fields are found", () => {
      const reportPath = path.join(mockReportsDir, "HEP-TEST-CONFLICT-001.md");
      const initialContent = `# Test Report
- **PR URL**: TBD
- **PR URL**: TBD
- **Branch**: TBD
- **PR Head Reviewed**: TBD
- **Report Update Commit**: TBD
- **Run ID**: TBD
- **Run Number**: TBD
- **Tested Commit**: TBD
`;
      fs.writeFileSync(reportPath, initialContent, "utf8");

      expect(() => {
        finalizeReport({
          repositoryPath: tempDir,
          reportPath
        });
      }).toThrow(/Conflict: Multiple entries found for metadata field "PR URL"/);
    });

    it("should warn on unresolved placeholders (TBD, TODO, PARTIAL) in finalized report", () => {
      const reportPath = path.join(mockReportsDir, "HEP-TEST-PLACEHOLDERS-001.md");
      const initialContent = `# Test Report
- **PR URL**: TBD
- **Branch**: TBD
- **PR Head Reviewed**: TBD
- **Report Update Commit**: TBD
- **Run ID**: TBD
- **Run Number**: TBD
- **Tested Commit**: TBD

This task has some TODO notes and the implementation is PARTIAL.
`;
      fs.writeFileSync(reportPath, initialContent, "utf8");

      const execSpy = vi.spyOn(gitExecutor, "execSync").mockImplementation((cmd) => {
        if (cmd === "git branch --show-current") return "feature/test-branch";
        if (cmd === "git rev-parse HEAD") return "local-head-sha-12345";
        if (cmd.startsWith("gh pr view")) return JSON.stringify({ url: "https://github.com/some/pr/326" });
        if (cmd.startsWith("gh run list")) {
          return JSON.stringify([{
            databaseId: 1234567,
            number: 42,
            status: "completed",
            conclusion: "success",
            headSha: "local-head-sha-12345"
          }]);
        }
        if (cmd === "git status --porcelain") return "";
        return "";
      });

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      finalizeReport({
        repositoryPath: tempDir,
        reportPath
      });

      expect(warnSpy).toHaveBeenCalled();
      const warningOutput = warnSpy.mock.calls.flat().join("\n");
      expect(warningOutput).toContain("warning: Unresolved placeholder");
      expect(warningOutput).toContain("TODO");
      expect(warningOutput).toContain("PARTIAL");

      warnSpy.mockRestore();
      execSpy.mockRestore();
    });

    it("should throw when latest report is ambiguous (multiple files modified in the last 5 minutes)", () => {
      const report1 = path.join(mockReportsDir, "HEP-REPORT-A.md");
      const report2 = path.join(mockReportsDir, "HEP-REPORT-B.md");

      fs.writeFileSync(report1, "A", "utf8");
      fs.writeFileSync(report2, "B", "utf8");

      const now = Date.now();
      fs.utimesSync(report1, new Date(now), new Date(now));
      fs.utimesSync(report2, new Date(now - 1000), new Date(now - 1000));

      const execSpy = vi.spyOn(gitExecutor, "execSync").mockReturnValue(""); // Clean git status

      expect(() => {
        detectLatestReport(tempDir);
      }).toThrow(/Ambiguous reports: The two most recently modified reports were updated within 5 minutes/);

      execSpy.mockRestore();
    });

    it("should throw when no report path is found", () => {
      const emptyDir = path.join(tempDir, "empty-reports-dir");
      const emptyReportsDir = path.join(emptyDir, "_ai_work/REPORTS");
      fs.mkdirSync(emptyReportsDir, { recursive: true });

      expect(() => {
        detectLatestReport(emptyDir);
      }).toThrow(/No report markdown files \(\.md\) found/);
    });
  });

  describe("Maintenance Trio v2 controls", () => {
    it("should build a reports index and keep protected assets out of safe apply", () => {
      const workspace = path.join(tempDir, "maintenance-v2-index");
      fs.mkdirSync(path.join(workspace, "reports"), { recursive: true });
      fs.mkdirSync(path.join(workspace, "codex-test", ".git"), { recursive: true });
      fs.writeFileSync(path.join(workspace, "reports", "legacy.md"), "legacy", "utf8");

      const plan = createMaintenancePlan({ workspaceRoot: workspace, taskId: "HERMES-MAINTENANCE-TRIO-002" });
      const protectedFinding = plan.findings.find((finding) => finding.relativePath === "codex-test");
      const reportFinding = plan.findings.find((finding) => finding.relativePath === "reports/legacy.md");

      expect(protectedFinding?.decision).toBe("KEEP");
      expect(reportFinding?.decision).toBe("ARCHIVE");
      expect(fs.existsSync(path.join(workspace, "reports", "indexes", "report-index.json"))).toBe(true);
    });

    it("should limit safe apply batches with maxActions", () => {
      const workspace = path.join(tempDir, "maintenance-v2-max-actions");
      fs.mkdirSync(path.join(workspace, "reports"), { recursive: true });
      fs.writeFileSync(path.join(workspace, "reports", "a.md"), "a", "utf8");
      fs.writeFileSync(path.join(workspace, "reports", "b.md"), "b", "utf8");

      const plan = createMaintenancePlan({ workspaceRoot: workspace, taskId: "HERMES-MAINTENANCE-TRIO-002" });
      const actions = applySafeMaintenancePlan(plan, { maxActions: 1, only: ["reports"] });

      expect(actions).toHaveLength(1);
      expect(fs.existsSync(actions[0].to)).toBe(true);
      const remainingLegacyReports = ["a.md", "b.md"].filter((name) => fs.existsSync(path.join(workspace, "reports", name)));
      expect(remainingLegacyReports).toHaveLength(1);
    });

    it("should support dry-run safe apply without moving files", () => {
      const workspace = path.join(tempDir, "maintenance-v2-dry-run");
      const reportPath = path.join(workspace, "reports", "dry.md");
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      fs.writeFileSync(reportPath, "dry", "utf8");

      const plan = createMaintenancePlan({ workspaceRoot: workspace, taskId: "HERMES-MAINTENANCE-TRIO-002", only: ["reports"] });
      const actions = applySafeMaintenancePlan(plan, { dryRun: true, maxActions: 1, only: ["reports"] });

      expect(actions).toHaveLength(1);
      expect(actions[0].dryRun).toBe(true);
      expect(fs.existsSync(reportPath)).toBe(true);
      expect(fs.existsSync(actions[0].to)).toBe(false);
      expect(() => restoreMaintenanceAction(workspace, actions[0].actionId)).toThrow(/Cannot restore dry-run action/);
    });
  });
});
