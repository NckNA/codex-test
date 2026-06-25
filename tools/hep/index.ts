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
  change-plan:create  Create a local HEP change-plan record from CLI options.
  change-plan:simulate Simulate ALLOW/BLOCK for a change-plan JSON file.
  change-plan:approve Approve a change-plan JSON file.
  change-plan:revoke Revoke a change-plan JSON file.
  change-plan:diff-check Compare planned files with actual changed files.

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
  --plan <path>       Path to a change-plan JSON file
  --scope <path>      Optional path to a scope JSON file
  --actualFiles <csv> Comma-separated actual changed files for diff-check
  --out <path>        Optional output JSON path for change-plan commands
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
  const planPath = (options.plan as string) || (options["plan"] as string);
  const scopePath = (options.scope as string) || (options["scope"] as string);
  const outPath = (options.out as string) || (options["out"] as string);
  const actualFilesCsv = (options.actualFiles as string) || (options["actual-files"] as string);

  const manager = new WorktreeManager(repositoryPath, worktreeRoot);

  async function readJsonFile(filePath: string): Promise<unknown> {
    const fs = await import("node:fs");
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
  }

  async function writeJsonOrPrint(value: unknown): Promise<void> {
    const serialized = `${JSON.stringify(value, null, 2)}\n`;
    if (outPath) {
      const fs = await import("node:fs");
      fs.writeFileSync(outPath, serialized, "utf8");
      console.log(`Wrote ${outPath}`);
      return;
    }
    console.log(serialized);
  }

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
      case "change-plan:create": {
        const { createChangePlan } = await import("./change-plan.ts");
        if (!taskId) throw new Error("Missing required option: --taskId");
        const actor = (options.actor as string) || "maintenance.autopilot";
        const action = ((options.action as string) || "modify") as "create" | "modify" | "delete" | "inspect";
        const target = (options.target as string) || "tools/hep/index.ts";
        const riskLevel = ((options.riskLevel as string) || (options["risk-level"] as string) || "medium") as "low" | "medium" | "high" | "critical";
        const summary = (options.summary as string) || "HEP local change-plan";
        const reason = (options.reason as string) || summary;
        const createdBy = (options.createdBy as string) || (options["created-by"] as string) || actor;
        const rollbackRef = (options.rollbackRef as string) || (options["rollback-ref"] as string) || branchName || "local.rollback.ref";
        const plannedFilesCsv = (options.plannedFiles as string) || (options["planned-files"] as string) || target;
        const expectedFiles = plannedFilesCsv.split(",").map((filePath) => ({
          path: filePath.trim(),
          reason: "planned by CLI",
          changeType: action
        }));
        const plan = createChangePlan({
          taskId,
          actor,
          action,
          target,
          riskLevel,
          createdBy,
          reason,
          summary,
          expectedFiles,
          checks: [{ command: "npm test -- --run", required: true, expectedResult: "tests pass" }],
          rollbackRef,
          requiresOwnerReview: riskLevel === "high" || riskLevel === "critical"
        });
        await writeJsonOrPrint(plan);
        break;
      }
      case "change-plan:simulate": {
        const { simulateChangePlan } = await import("./change-plan.ts");
        if (!planPath) throw new Error("Missing required option: --plan");
        const plan = await readJsonFile(planPath);
        const scope = scopePath ? await readJsonFile(scopePath) : {};
        await writeJsonOrPrint(simulateChangePlan(plan as Parameters<typeof simulateChangePlan>[0], scope as Parameters<typeof simulateChangePlan>[1]));
        break;
      }
      case "change-plan:approve": {
        const { approveChangePlan } = await import("./change-plan.ts");
        if (!planPath) throw new Error("Missing required option: --plan");
        const approvedBy = (options.approvedBy as string) || (options["approved-by"] as string) || "owner";
        const plan = await readJsonFile(planPath);
        await writeJsonOrPrint(approveChangePlan(plan as Parameters<typeof approveChangePlan>[0], approvedBy));
        break;
      }
      case "change-plan:revoke": {
        const { revokeChangePlan } = await import("./change-plan.ts");
        if (!planPath) throw new Error("Missing required option: --plan");
        const revokedBy = (options.revokedBy as string) || (options["revoked-by"] as string) || "owner";
        const plan = await readJsonFile(planPath);
        await writeJsonOrPrint(revokeChangePlan(plan as Parameters<typeof revokeChangePlan>[0], revokedBy));
        break;
      }
      case "change-plan:diff-check": {
        const { comparePlannedToActual } = await import("./change-plan.ts");
        if (!planPath) throw new Error("Missing required option: --plan");
        if (!actualFilesCsv) throw new Error("Missing required option: --actualFiles");
        const plan = await readJsonFile(planPath);
        const actualFiles = actualFilesCsv.split(",").map((filePath) => filePath.trim()).filter(Boolean);
        await writeJsonOrPrint(comparePlannedToActual(plan as Parameters<typeof comparePlannedToActual>[0], actualFiles));
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
