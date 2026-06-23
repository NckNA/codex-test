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
  maintenance-plan    Scan Hermes workspace and write a reversible maintenance plan.
  maintenance-apply   Apply only low/medium risk reversible archive/quarantine moves.
  maintenance-restore Restore one archived/quarantined maintenance action by actionId.
  lifecycle-finalize Finalize task/PR lifecycle registries after review or merge.
  reports-index      Build a durable report index for project/workspace reports.
  guardian-init      Create default Guardian ACL manifest if missing.
  guardian-check     Evaluate one actor/action/target access decision.

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
  --workspaceRoot <p> Hermes workspace root for maintenance commands (default: D:/hermes)
  --safe              Required for maintenance-apply; destructive cleanup stays disabled.
  --max-actions <n>   Limit maintenance-apply batch size.
  --only <scope>      Limit maintenance commands to scopes like reports,temp,legacy_report.
  --actionId <id>     Action ID to restore for maintenance-restore.
  --pr <number>       Pull request number for lifecycle-finalize.
  --pr-url <url>      Pull request URL for lifecycle-finalize.
  --pr-state <state>  PR state for lifecycle-finalize (default: MERGED).
  --branch <branch>   Task branch for lifecycle-finalize.
  --head <sha>        Task head SHA for lifecycle-finalize.
  --merged-at <iso>   Merge timestamp for lifecycle-finalize.
  --output <path>     Output path for reports-index.
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
  try {
    verifyNodeEnvironmentSync();
  } catch (err) {
    console.error("Environment verification failed:");
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

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
  const workspaceRoot = (options.workspaceRoot as string) || (options["workspace-root"] as string) || "D:/hermes";
  const safe = !!options.safe;
  const actionId = (options.actionId as string) || (options["action-id"] as string);
  const maxActionsRaw = (options.maxActions as string) || (options["max-actions"] as string);
  const maxActions = maxActionsRaw ? Number.parseInt(maxActionsRaw, 10) : undefined;
  if (maxActionsRaw && (!Number.isFinite(maxActions) || (maxActions ?? 0) < 0)) {
    throw new Error("--max-actions must be a non-negative integer");
  }
  const onlyRaw = (options.only as string) || (options["only"] as string);
  const only = onlyRaw ? onlyRaw.split(",").map((item) => item.trim()).filter(Boolean) : undefined;
  const prRaw = (options.pr as string) || (options["pr"] as string);
  const prNumber = prRaw ? Number.parseInt(prRaw, 10) : undefined;
  if (prRaw && (!Number.isFinite(prNumber) || (prNumber ?? 0) <= 0)) {
    throw new Error("--pr must be a positive integer");
  }
  const prUrl = (options.prUrl as string) || (options["pr-url"] as string);
  const prState = (options.prState as string) || (options["pr-state"] as string);
  const branch = (options.branch as string) || (options["branch"] as string) || branchName;
  const head = (options.head as string) || (options["head"] as string);
  const mergedAt = (options.mergedAt as string) || (options["merged-at"] as string);
  const output = (options.output as string) || (options["output"] as string);
  const actor = (options.actor as string) || (options["actor"] as string);
  const action = (options.action as string) || (options["action"] as string);
  const target = (options.target as string) || (options["target"] as string);
  const writeAudit = !!options.writeAudit || !!options["write-audit"];

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
      case "maintenance-plan": {
        const { createMaintenancePlan, formatMaintenancePlan, writeMaintenancePlan } = await import("./maintenance.ts");
        const plan = createMaintenancePlan({ workspaceRoot, taskId, only });
        const registryPath = writeMaintenancePlan(plan);
        console.log(formatMaintenancePlan(plan));
        console.log(`Maintenance registry written to: ${registryPath}`);
        break;
      }
      case "maintenance-apply": {
        if (!safe) {
          throw new Error("maintenance-apply requires --safe. Only reversible archive/quarantine moves are supported in HEP v1.");
        }
        const { applySafeMaintenancePlan, createMaintenancePlan, formatMaintenancePlan } = await import("./maintenance.ts");
        const plan = createMaintenancePlan({ workspaceRoot, taskId, only });
        const actions = applySafeMaintenancePlan(plan, { maxActions, dryRun, only });
        console.log(formatMaintenancePlan({ ...plan, mode: "SAFE_APPLY" }));
        console.log(`Applied reversible maintenance actions: ${actions.length}`);
        for (const action of actions) {
          const dryRunLabel = action.dryRun ? " [dry-run]" : "";
          console.log(`${action.actionId}: ${action.action}${dryRunLabel} ${action.from} -> ${action.to}`);
        }
        break;
      }
      case "maintenance-restore": {
        if (!actionId) {
          throw new Error("maintenance-restore requires --actionId");
        }
        const { restoreMaintenanceAction } = await import("./maintenance.ts");
        const restored = restoreMaintenanceAction(workspaceRoot, actionId);
        console.log(`Restored ${restored.from} -> ${restored.to}`);
        break;
      }
      case "lifecycle-finalize": {
        if (!taskId) {
          throw new Error("lifecycle-finalize requires --taskId");
        }
        const { finalizeLifecycle, formatLifecycleResult } = await import("./lifecycle-finalizer.ts");
        const result = finalizeLifecycle({
          workspaceRoot,
          taskId,
          prNumber,
          prUrl,
          prState,
          branch,
          head,
          baseBranch,
          reportPath: report,
          mergedAt,
          dryRun
        });
        console.log(formatLifecycleResult(result));
        break;
      }
      case "reports-index": {
        const { buildReportIndex, writeReportIndex, formatReportIndex } = await import("./report-indexer.ts");
        const index = buildReportIndex({ workspaceRoot, projectPath: repositoryPath, outputPath: output });
        const outputPath = dryRun ? undefined : writeReportIndex(index, output);
        console.log(formatReportIndex(index, outputPath));
        break;
      }
      case "guardian-init": {
        const { writeDefaultGuardianPolicies } = await import("./guardian-acl.ts");
        const policyPath = writeDefaultGuardianPolicies(workspaceRoot);
        console.log(`Guardian ACL manifest ready: ${policyPath}`);
        break;
      }
      case "guardian-check": {
        if (!taskId) {
          throw new Error("guardian-check requires --taskId");
        }
        if (!actor) {
          throw new Error("guardian-check requires --actor");
        }
        if (!action) {
          throw new Error("guardian-check requires --action");
        }
        if (!target) {
          throw new Error("guardian-check requires --target");
        }
        const { checkGuardianAccess, formatGuardianCheck, writeGuardianAuditEvent } = await import("./guardian-acl.ts");
        const result = checkGuardianAccess({ workspaceRoot, taskId, actor, action, target, dryRun, actionCount: maxActions, writeAudit: false });
        const auditPath = writeAudit ? writeGuardianAuditEvent(workspaceRoot, result) : undefined;
        console.log(formatGuardianCheck(result, auditPath));
        if (!result.allowed) {
          process.exitCode = 2;
        }
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


