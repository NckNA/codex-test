import * as childProcess from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { TaskMemoryManager } from "./task-memory.ts";

// Mutable wrapper object for Git execution to allow ESM Vitest mocking/spying
export const gitExecutor = {
  execSync(cmd: string, options?: childProcess.ExecSyncOptions): string {
    const res = childProcess.execSync(cmd, options);
    return res ? res.toString() : "";
  }
};

// Check if workspace has uncommitted changes
export function checkWorkspaceClean(repositoryPath: string): void {
  try {
    const output = gitExecutor.execSync("git status --porcelain", { cwd: repositoryPath, encoding: "utf8" }).trim();
    if (output.length > 0) {
      throw new Error(`Source repository has uncommitted changes:\n${output}\nClean up or commit before creating worktree.`);
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("Source repository has uncommitted changes")) {
      throw e;
    }
    throw new Error(`Failed to check git workspace clean status: ${e instanceof Error ? e.message : e}`, { cause: e });
  }
}

// Path validation checks (traversal, drive changes, UNC paths, registry constraints)
export function validateWorktreePath(worktreeRoot: string, taskId: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(taskId)) {
    throw new Error(`Unsafe taskId "${taskId}". Task ID must only contain alphanumeric characters, underscores, and dashes.`);
  }

  const resolvedRoot = path.resolve(worktreeRoot);
  const canonicalRoot = path.resolve("D:/hermes/worktrees");

  // Ensure it stays under D:\hermes\worktrees
  if (!resolvedRoot.toLowerCase().replace(/\\/g, "/").startsWith(canonicalRoot.toLowerCase().replace(/\\/g, "/"))) {
    throw new Error(`Unsafe worktreeRoot "${worktreeRoot}". Root must stay under D:\\hermes\\worktrees.`);
  }

  const targetPath = path.resolve(resolvedRoot, taskId);

  // Path traversal check
  const rootPrefix = resolvedRoot.endsWith(path.sep) ? resolvedRoot : resolvedRoot + path.sep;
  if (!targetPath.toLowerCase().startsWith(rootPrefix.toLowerCase())) {
    throw new Error(`Path traversal detected! Target path "${targetPath}" escapes worktree root "${resolvedRoot}".`);
  }

  // Reject UNC paths
  if (targetPath.startsWith("\\\\") || targetPath.startsWith("//")) {
    throw new Error(`UNC paths are not allowed: ${targetPath}`);
  }

  // Reject drive changes that escape the root drive
  const rootDrive = path.parse(resolvedRoot).root;
  const targetDrive = path.parse(targetPath).root;
  if (rootDrive.toLowerCase() !== targetDrive.toLowerCase()) {
    throw new Error(`Drive change detected! Target drive "${targetDrive}" does not match root drive "${rootDrive}".`);
  }

  return targetPath;
}

// Main Worktree Manager Class
export class WorktreeManager {
  private repositoryPath: string;
  private worktreeRoot: string;
  private memory: TaskMemoryManager;

  constructor(repositoryPath: string, worktreeRoot: string = "D:/hermes/worktrees") {
    this.repositoryPath = path.resolve(repositoryPath);
    this.worktreeRoot = path.resolve(worktreeRoot);
    this.memory = new TaskMemoryManager(this.repositoryPath);
  }

  public initTask(options: {
    taskId: string;
    baseBranch: string;
    branchName: string;
    dryRun?: boolean;
    bypassCleanCheck?: boolean;
  }): void {
    const taskId = options.taskId;
    const baseBranch = options.baseBranch;
    const branchName = options.branchName;
    const dryRun = !!options.dryRun;
    const bypassCleanCheck = !!options.bypassCleanCheck;

    // 1. Validation regex for branch name
    if (!/^[a-zA-Z0-9_\-/]+$/.test(branchName)) {
      throw new Error(`Unsafe branchName "${branchName}". Branch must contain only safe branch characters.`);
    }

    // 2. Validate worktree path safety
    const targetPath = validateWorktreePath(this.worktreeRoot, taskId);

    if (fs.existsSync(targetPath)) {
      throw new Error(`Unsafe existing folder: Target worktree path already exists at "${targetPath}".`);
    }

    // 3. Workspace Clean Check
    if (!bypassCleanCheck) {
      checkWorkspaceClean(this.repositoryPath);
    }

    console.log(`\nInitializing Task: ${taskId}`);
    console.log(`Repository:       ${this.repositoryPath}`);
    console.log(`Target Worktree:  ${targetPath}`);
    console.log(`Base Branch:      ${baseBranch}`);
    console.log(`Task Branch:      ${branchName}`);
    if (dryRun) console.log("MODE:             DRY-RUN (No actions will be executed)");

    if (dryRun) {
      console.log(`[Dry-run] Would fetch origin and checkout ${baseBranch}`);
      console.log(`[Dry-run] Would create branch ${branchName} from ${baseBranch}`);
      console.log(`[Dry-run] Would run: git worktree add ${targetPath} ${branchName}`);
      console.log(`[Dry-run] Would write task metadata to database`);
      return;
    }

    // 4. Executing Git operations
    try {
      console.log(`Fetching latest ${baseBranch}...`);
      gitExecutor.execSync(`git fetch origin ${baseBranch}`, { cwd: this.repositoryPath, stdio: "inherit" });

      // Create branch locally if it does not exist
      console.log(`Checking if branch ${branchName} exists...`);
      let branchExists = false;
      try {
        gitExecutor.execSync(`git show-ref --verify refs/heads/${branchName}`, { cwd: this.repositoryPath });
        branchExists = true;
      } catch {
        // Branch does not exist locally
      }

      if (!branchExists) {
        console.log(`Creating branch ${branchName} from ${baseBranch}...`);
        gitExecutor.execSync(`git branch ${branchName} origin/${baseBranch}`, { cwd: this.repositoryPath, stdio: "inherit" });
      }

      console.log(`Creating worktree under ${targetPath}...`);
      gitExecutor.execSync(`git worktree add "${targetPath}" ${branchName}`, { cwd: this.repositoryPath, stdio: "inherit" });
      
    } catch (e) {
      throw new Error(`Git worktree creation failed: ${e instanceof Error ? e.message : e}`, { cause: e });
    }

    // 5. Connect and save to memory
    try {
      this.memory.connect();
      this.memory.insertTaskHistory({
        taskId,
        taskType: "local_tooling",
        repositoryPath: this.repositoryPath,
        worktreePath: targetPath,
        baseBranch,
        branchName,
        status: "INITIALIZED"
      });
      this.memory.insertTaskEvent(taskId, "WORKTREE_CREATED", `Successfully created worktree at ${targetPath}`);
      console.log("Task memory updated successfully.");
    } catch (e) {
      console.error(`Warning: Failed to update task memory: ${e instanceof Error ? e.message : e}`);
    } finally {
      this.memory.close();
    }
  }

  public status(taskId: string): void {
    const targetPath = validateWorktreePath(this.worktreeRoot, taskId);

    if (!fs.existsSync(targetPath)) {
      throw new Error(`Worktree for task "${taskId}" does not exist at "${targetPath}"`);
    }

    console.log(`\nStatus for Task: ${taskId}`);
    console.log(`Worktree Path:   ${targetPath}`);

    try {
      const branch = gitExecutor.execSync("git branch --show-current", { cwd: targetPath, encoding: "utf8" }).trim();
      const commit = gitExecutor.execSync("git log -n 1 --oneline", { cwd: targetPath, encoding: "utf8" }).trim();
      const dirtyStatus = gitExecutor.execSync("git status --porcelain", { cwd: targetPath, encoding: "utf8" }).trim();
      
      console.log(`Active Branch:   ${branch}`);
      console.log(`Head Commit:     ${commit}`);
      console.log(`Status:          ${dirtyStatus.length > 0 ? "DIRTY" : "CLEAN"}`);
      if (dirtyStatus.length > 0) {
        console.log(`Uncommitted changes:\n${dirtyStatus}`);
      }
    } catch (e) {
      throw new Error(`Failed to retrieve git status from worktree: ${e instanceof Error ? e.message : e}`, { cause: e });
    }
  }

  public cleanTask(taskId: string, force: boolean = false): void {
    const targetPath = validateWorktreePath(this.worktreeRoot, taskId);

    if (!fs.existsSync(targetPath)) {
      throw new Error(`Worktree for task "${taskId}" does not exist at "${targetPath}"`);
    }

    // Check if worktree has uncommitted changes
    let isDirty = false;
    try {
      const output = gitExecutor.execSync("git status --porcelain", { cwd: targetPath, encoding: "utf8" }).trim();
      if (output.length > 0) {
        isDirty = true;
      }
    } catch {
      console.warn("Warning: Could not verify if worktree is clean.");
    }

    if (isDirty && !force) {
      throw new Error(`Worktree for task "${taskId}" has uncommitted changes. Refusing to delete without --force flag.`);
    }

    console.log(`Removing worktree at ${targetPath}...`);
    try {
      gitExecutor.execSync(`git worktree remove "${targetPath}" ${force ? "--force" : ""}`, { cwd: this.repositoryPath, stdio: "inherit" });
      console.log(`Worktree pruned successfully.`);
    } catch (e) {
      throw new Error(`Failed to remove git worktree: ${e instanceof Error ? e.message : e}`, { cause: e });
    }

    try {
      this.memory.connect();
      this.memory.updateTaskFinalStatus(taskId, { status: "CLEANED" });
      this.memory.insertTaskEvent(taskId, "WORKTREE_CLEANED", `Successfully removed worktree at ${targetPath}`);
      console.log("Task memory status updated to CLEANED.");
    } catch (e) {
      console.warn(`Warning: Failed to update task memory: ${e instanceof Error ? e.message : e}`);
    } finally {
      this.memory.close();
    }
  }
}
