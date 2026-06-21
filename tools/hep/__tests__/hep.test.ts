import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as childProcess from "node:child_process";
import { verifyNodeEnvironment, redactSecrets, TaskMemoryManager } from "../task-memory.ts";
import { validateWorktreePath, checkWorkspaceClean, WorktreeManager, gitExecutor } from "../worktree-manager.ts";

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
});
