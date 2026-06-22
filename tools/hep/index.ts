import { verifyNodeEnvironmentSync } from "./preflight.ts";

function printUsage(): void {
  console.log(`
Hermes Execution Platform (HEP) Task Runner CLI v1.0

Usage:
  node tools/hep/index.ts <command> [options]

Commands:
  init-task           Initialize a new task worktree and log it to SQLite memory.
  status              Check status of a task worktree.
  clean-task          Clean/remove a task worktree.
  test-db             Run connection test on SQLite database.
  finalize-report     Finalize metadata in a task report file using Git/GitHub CLI.

Options:
  --taskId <id>       ID of the task (e.g. HEP-V1-WORKTREE-MEMORY-001)
  --baseBranch <br>   Base branch to branch from (default: main)
  --branchName <br>   Target branch name for the task
  --repositoryPath <p> Path to the main git repository (default: current dir)
  --worktreeRoot <r>  Path where task worktrees are stored (default: D:/hermes/worktrees)
  --dry-run           Show git operations and DB updates without running them
  --bypassCleanCheck  Bypass check for uncommitted changes in the main workspace
  --force             Force removal of dirty worktrees (only for clean-task)
  --report <path>     Path to the report file (default: auto-detect latest modified report)
  --verdict <str>     Optional final verdict text to update in report
  --next-task <str>   Optional next task ID to update in report
`);
}

function parseArgs(args: string[]): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith("--")) {
        result[key] = nextArg;
        i++;
      } else {
        result[key] = true;
      }
    }
  }
  return result;
}

async function main(): Promise<void> {
  // 1. Run Preflight Check first before any other modules are loaded
  try {
    verifyNodeEnvironmentSync();
  } catch (err) {
    console.error("Environment verification failed:");
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  // 2. Load dependencies dynamically to ensure they evaluate AFTER preflight checks
  const { WorktreeManager } = await import("./worktree-manager.ts");
  const { TaskMemoryManager } = await import("./task-memory.ts");

  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    printUsage();
    process.exit(0);
  }

  const options = parseArgs(args.slice(1));

  const repositoryPath = (options.repositoryPath as string) || (options["repository-path"] as string) || process.cwd();
  const worktreeRoot = (options.worktreeRoot as string) || (options["worktree-root"] as string) || "D:/hermes/worktrees";
  const taskId = (options.taskId as string) || (options["task-id"] as string);
  const baseBranch = (options.baseBranch as string) || (options["base-branch"] as string) || "main";
  const branchName = (options.branchName as string) || (options["branch-name"] as string);
  const dryRun = !!options.dryRun || !!options["dry-run"];
  const force = !!options.force;
  const bypassCleanCheck = !!options.bypassCleanCheck || !!options["bypass-clean-check"];
  
  const report = (options.report as string) || (options["report"] as string);
  const nextTask = (options.nextTask as string) || (options["next-task"] as string);
  const verdict = options.verdict as string;

  const manager = new WorktreeManager(repositoryPath, worktreeRoot);

  try {
    switch (command) {
      case "init-task": {
        if (!taskId) {
          throw new Error("Missing required option: --taskId");
        }
        if (!branchName) {
          throw new Error("Missing required option: --branchName");
        }
        manager.initTask({
          taskId,
          baseBranch,
          branchName,
          dryRun,
          bypassCleanCheck
        });
        break;
      }
      case "status": {
        if (!taskId) {
          throw new Error("Missing required option: --taskId");
        }
        manager.status(taskId);
        break;
      }
      case "clean-task": {
        if (!taskId) {
          throw new Error("Missing required option: --taskId");
        }
        manager.cleanTask(taskId, force);
        break;
      }
      case "test-db": {
        console.log("Testing SQLite Database Sync connection...");
        const mem = new TaskMemoryManager(repositoryPath);
        mem.connect();
        console.log(`Database connected successfully at: ${mem.getDbPath()}`);
        mem.close();
        console.log("Database connection test PASSED.");
        break;
      }
      case "finalize-report": {
        const { finalizeReport } = await import("./metadata-finalizer.ts");
        finalizeReport({
          repositoryPath,
          reportPath: report,
          verdict,
          nextTask
        });
        break;
      }
      default: {
        console.error(`Unknown command: ${command}`);
        printUsage();
        process.exit(1);
      }
    }
  } catch (error) {
    console.error("\nError executing command:");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
