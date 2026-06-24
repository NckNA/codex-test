import type { DependencyAction } from "./dependency-guard.ts";
import type { GuardrailBlockType } from "./guardrail-blocker.ts";
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
  event-log-init      Create the local Hermes JSONL event log files.
  event-log-write     Append one sanitized event to the Hermes event log.
  event-log-tail      Print the last N Hermes events.
  event-log-query     Print Hermes events filtered by taskId.
  maintenance-plan    Scan Hermes workspace and write a reversible maintenance plan.
  maintenance-apply   Apply only low/medium risk reversible archive/quarantine moves.
  maintenance-restore Restore one archived/quarantined maintenance action by actionId.
  maintenance-autopilot Run dry-run-only guarded maintenance autopilot.
  lifecycle-finalize  Finalize task/PR lifecycle registries after review or merge.
  reports-index       Build a durable report index for project/workspace reports.
  guardian-init       Create default Guardian ACL manifest if missing.
  guardian-check      Evaluate one actor/action/target access decision.
  dependency-init     Create baseline dependency registry and graph.
  dependency-check    Evaluate dependency risk and impact waiver route.
  guardrail-blocker-write Write a structured guardrail blocker report.
  decision-check      Evaluate one request through the HEP Decision Gateway.
  decision-explain    Print a human-readable Decision Gateway explanation.
  observability-snapshot Write Hermes observability JSON and Markdown snapshots.
  observability-report Print a Hermes observability Markdown snapshot.
  hazard-init       Create default Hermes hazard registry.
  hazard-list       List known hazards.
  hazard-add        Add or update one hazard.
  hazard-see        Show one hazard.
  hazard-mitigate   Mark one hazard as mitigated.

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
  --actor <id>        Actor ID for guardian/dependency checks.
  --action <name>     Action for guardian/dependency checks.
  --target <path>     Target path for guardian/dependency checks.
                    Path formats: repo-relative tools/hep/index.ts; workspace-relative codex-test/tools/hep/index.ts; absolute only inside configured roots.
  --target-type <type> Event target type for decision/event commands.
  --allow-impact-plan Permit dependency-check to return ALLOW_WITH_IMPACT_PLAN.
  --write-audit       Write guardian/dependency audit ledger entry.
  --no-write-event    Disable Decision Gateway event-log write.
  --no-write-ledger   Disable Decision Gateway decision-ledger write.
  --max-events <n>    Limit observability events read.
  --max-reports <n>   Limit observability reports listed.
  --blocked-operation <text> Operation blocked by policy/tooling.
  --block-type <type> Guardrail block type.
  --expected-capability <text> Capability expected by the task.
  --completed <a;b>   Semicolon-separated completed blocker-report items.
  --remaining <a;b>   Semicolon-separated remaining blocker-report items.
  --next-safe-steps <a;b> Semicolon-separated safe next steps.
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

function parseListOption(value: string | undefined): string[] | undefined {
  return value
    ? value.split(";").map((item) => item.trim()).filter(Boolean)
    : undefined;
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
  const allowImpactPlan = !!options.allowImpactPlan || !!options["allow-impact-plan"];
  const reason = (options.reason as string) || (options["reason"] as string);
  const actorType = (options.actorType as string) || (options["actor-type"] as string) || "script";
  const targetType = (options.targetType as string) || (options["target-type"] as string) || "unknown";
  const decision = ((options.decision as string) || (options["decision"] as string) || "INFO").toUpperCase();
  const eventResult = (options.result as string) || (options["result"] as string) || (options.outcome as string) || "observed";
  const severity = (options.severity as string) || (options["severity"] as string) || "info";
  const message = (options.message as string) || (options["message"] as string);
  const hazardId = (options.hazardId as string) || (options["hazard-id"] as string);
  const title = (options.title as string) || (options["title"] as string);
  const area = (options.area as string) || (options["area"] as string);
  const status = (options.status as string) || (options["status"] as string);
  const hazardSeverity = (options.hazardSeverity as string) || (options["hazard-severity"] as string);
  const symptom = (options.symptom as string) || (options["symptom"] as string);
  const workaround = (options.workaround as string) || (options["workaround"] as string);
  const prevention = (options.prevention as string) || (options["prevention"] as string);
  const note = (options.note as string) || (options["note"] as string);
  const tagsRaw = (options.tags as string) || (options["tags"] as string);
  const tags = tagsRaw ? tagsRaw.split(",").map((item) => item.trim()).filter(Boolean) : undefined;
  const maxEventsRaw = (options.maxEvents as string) || (options["max-events"] as string);
  const maxEvents = maxEventsRaw ? Number.parseInt(maxEventsRaw, 10) : undefined;
  if (maxEventsRaw && (!Number.isFinite(maxEvents) || (maxEvents ?? 0) <= 0)) {
    throw new Error("--max-events must be a positive integer");
  }
  const maxReportsRaw = (options.maxReports as string) || (options["max-reports"] as string);
  const maxReports = maxReportsRaw ? Number.parseInt(maxReportsRaw, 10) : undefined;
  if (maxReportsRaw && (!Number.isFinite(maxReports) || (maxReports ?? 0) <= 0)) {
    throw new Error("--max-reports must be a positive integer");
  }
  const blockedOperation = (options.blockedOperation as string) || (options["blocked-operation"] as string);
  const blockType = (options.blockType as string) || (options["block-type"] as string) || "unknown";
  const activePolicyTaskId = (options.activePolicyTaskId as string) || (options["active-policy-task-id"] as string);
  const gitMode = (options.gitMode as string) || (options["git-mode"] as string);
  const expectedCapability = (options.expectedCapability as string) || (options["expected-capability"] as string);
  const attemptedTool = (options.attemptedTool as string) || (options["attempted-tool"] as string);
  const attemptedPath = (options.attemptedPath as string) || (options["attempted-path"] as string);
  const completed = parseListOption((options.completed as string) || (options["completed"] as string));
  const remaining = parseListOption((options.remaining as string) || (options["remaining"] as string));
  const nextSafeSteps = parseListOption((options.nextSafeSteps as string) || (options["next-safe-steps"] as string));

  const manager = new WorktreeManager(repositoryPath, worktreeRoot);

  try {
    switch (command) {
      case "init-task": {
        if (!taskId) throw new Error("Missing required option: --taskId");
        if (!branchName) throw new Error("Missing required option: --branchName");
        manager.initTask({ taskId, baseBranch, branchName, dryRun, bypassCleanCheck });
        break;
      }
      case "status": {
        if (!taskId) throw new Error("Missing required option: --taskId");
        manager.status(taskId);
        break;
      }
      case "clean-task": {
        if (!taskId) throw new Error("Missing required option: --taskId");
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
        finalizeReport({ repositoryPath, reportPath: report, verdict, nextTask });
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
        for (const actionEntry of actions) {
          const dryRunLabel = actionEntry.dryRun ? " [dry-run]" : "";
          console.log(`${actionEntry.actionId}: ${actionEntry.action}${dryRunLabel} ${actionEntry.from} -> ${actionEntry.to}`);
        }
        break;
      }
      case "maintenance-restore": {
        if (!actionId) throw new Error("maintenance-restore requires --actionId");
        const { restoreMaintenanceAction } = await import("./maintenance.ts");
        const restored = restoreMaintenanceAction(workspaceRoot, actionId);
        console.log(`Restored ${restored.from} -> ${restored.to}`);
        break;
      }
      case "maintenance-autopilot": {
        if (!taskId) throw new Error("maintenance-autopilot requires --taskId");
        const { runMaintenanceAutopilot } = await import("./maintenance-autopilot.ts");
        const result = runMaintenanceAutopilot({
          workspaceRoot,
          projectPath: repositoryPath,
          taskId,
          only,
          maxActions,
          dryRun: true,
          actor
        });
        console.log(JSON.stringify({
          ok: result.ok,
          dryRun: result.dryRun,
          plannedActionsCount: result.plannedActionsCount,
          blockedCount: result.blockedCount,
          guardianDecision: result.guardianDecision,
          dependencyDecisionCounts: result.dependencyDecisionCounts,
          logPath: result.logPath,
          warnings: result.warnings,
          result: result.result
        }, null, 2));
        if (!result.ok) process.exitCode = 2;
        break;
      }
      case "lifecycle-finalize": {
        if (!taskId) throw new Error("lifecycle-finalize requires --taskId");
        const { finalizeLifecycle, formatLifecycleResult } = await import("./lifecycle-finalizer.ts");
        const result = finalizeLifecycle({ workspaceRoot, taskId, prNumber, prUrl, prState, branch, head, baseBranch, reportPath: report, mergedAt, dryRun });
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
        if (!taskId) throw new Error("guardian-check requires --taskId");
        if (!actor) throw new Error("guardian-check requires --actor");
        if (!action) throw new Error("guardian-check requires --action");
        if (!target) throw new Error("guardian-check requires --target");
        const { checkGuardianAccess, formatGuardianCheck, writeGuardianAuditEvent } = await import("./guardian-acl.ts");
        const result = checkGuardianAccess({ workspaceRoot, taskId, actor, action, target, dryRun, actionCount: maxActions, writeAudit: false });
        const auditPath = writeAudit ? writeGuardianAuditEvent(workspaceRoot, result) : undefined;
        console.log(formatGuardianCheck(result, auditPath));
        if (!result.allowed) process.exitCode = 2;
        break;
      }
      case "dependency-init": {
        const { initializeDependencyGuard } = await import("./dependency-guard.ts");
        const initialized = initializeDependencyGuard(workspaceRoot);
        console.log(`Dependency guard initialized: ${initialized.assets} assets`);
        console.log(`Asset registry: ${initialized.assetPath}`);
        console.log(`Lease ledger: ${initialized.leasesPath}`);
        console.log(`Dependency graph: ${initialized.graphPath}`);
        console.log(`Impact ledger: ${initialized.ledgerPath}`);
        break;
      }
      case "dependency-check": {
        if (!taskId) throw new Error("dependency-check requires --taskId");
        if (!actor) throw new Error("dependency-check requires --actor");
        if (!action) throw new Error("dependency-check requires --action");
        if (!target) throw new Error("dependency-check requires --target");
        const { dependencyCheck, writeImpactLedger } = await import("./dependency-guard.ts");
        const result = dependencyCheck({ workspaceRoot, projectPath: repositoryPath, taskId, actor, action: action as DependencyAction, target, allowImpactPlan, reason });
        if (writeAudit && !dryRun && result.decision === "ALLOW_WITH_IMPACT_PLAN") {
          const entry = writeImpactLedger(workspaceRoot, { workspaceRoot, projectPath: repositoryPath, taskId, actor, action: action as DependencyAction, target }, result);
          console.log(`Impact ledger entry: ${entry.entryId}`);
        } else if (writeAudit && result.decision !== "ALLOW_WITH_IMPACT_PLAN") {
          console.log("Impact ledger entry skipped: decision is not ALLOW_WITH_IMPACT_PLAN.");
        } else if (writeAudit && dryRun) {
          console.log("Impact ledger entry skipped: dry-run mode.");
        }
        console.log(JSON.stringify(result, null, 2));
        if (result.decision !== "ALLOW" && result.decision !== "ALLOW_WITH_IMPACT_PLAN") process.exitCode = 2;
        break;
      }
      case "guardrail-blocker-write": {
        if (!taskId) throw new Error("guardrail-blocker-write requires --taskId");
        if (!blockedOperation) throw new Error("guardrail-blocker-write requires --blocked-operation");
        if (!expectedCapability) throw new Error("guardrail-blocker-write requires --expected-capability");
        const { writeGuardrailBlockerReport } = await import("./guardrail-blocker.ts");
        const report = writeGuardrailBlockerReport({
          workspaceRoot,
          taskId,
          blockedOperation,
          blockType: blockType as GuardrailBlockType,
          activePolicyTaskId,
          gitMode,
          expectedCapability,
          attemptedTool,
          attemptedPath: attemptedPath || target,
          target,
          completed,
          remaining,
          nextSafeSteps,
          cloudTouched: false
        });
        console.log(JSON.stringify({
          taskId: report.taskId,
          blockType: report.blockType,
          json: report.outputs.json,
          markdown: report.outputs.markdown,
          redactionApplied: report.redactionApplied
        }, null, 2));
        break;
      }
      case "decision-check": {
        if (!taskId) throw new Error("decision-check requires --taskId");
        if (!actor) throw new Error("decision-check requires --actor");
        if (!action) throw new Error("decision-check requires --action");
        if (!target) throw new Error("decision-check requires --target");
        const { evaluateDecisionGateway } = await import("./decision-gateway.ts");
        const result = evaluateDecisionGateway({
          workspaceRoot,
          repositoryPath,
          taskId,
          actor,
          action,
          target,
          targetType: targetType as never,
          reason,
          dryRun,
          allowImpactPlan,
          writeEvent: !options["no-write-event"],
          writeDecisionLedger: !options["no-write-ledger"]
        });
        console.log(JSON.stringify(result, null, 2));
        if (!result.allowed) process.exitCode = 2;
        break;
      }
      case "decision-explain": {
        if (!taskId) throw new Error("decision-explain requires --taskId");
        if (!actor) throw new Error("decision-explain requires --actor");
        if (!action) throw new Error("decision-explain requires --action");
        if (!target) throw new Error("decision-explain requires --target");
        const { evaluateDecisionGateway, formatDecisionGatewayMarkdown } = await import("./decision-gateway.ts");
        const result = evaluateDecisionGateway({
          workspaceRoot,
          repositoryPath,
          taskId,
          actor,
          action,
          target,
          targetType: targetType as never,
          reason,
          dryRun,
          allowImpactPlan,
          writeEvent: !options["no-write-event"],
          writeDecisionLedger: !options["no-write-ledger"]
        });
        console.log(formatDecisionGatewayMarkdown(result));
        if (!result.allowed) process.exitCode = 2;
        break;
      }
      case "hazard-init": {
        const { initHazardRegistry, formatHazardList } = await import("./hazard-registry.ts");
        const registry = initHazardRegistry({ hermesRoot: workspaceRoot });
        console.log(`Hazard registry initialized: ${registry.hazards.length} hazards`);
        console.log(formatHazardList(registry.hazards));
        break;
      }
      case "hazard-list": {
        const { listHazards, formatHazardList } = await import("./hazard-registry.ts");
        const hazards = listHazards({ status: status as never, area: area as never, severity: hazardSeverity as never }, { hermesRoot: workspaceRoot });
        console.log(formatHazardList(hazards));
        break;
      }
      case "hazard-see": {
        if (!hazardId) throw new Error("hazard-see requires --hazard-id");
        const { getHazard } = await import("./hazard-registry.ts");
        const hazard = getHazard(hazardId, { hermesRoot: workspaceRoot });
        if (!hazard) throw new Error(`Hazard not found: ${hazardId}`);
        console.log(JSON.stringify(hazard, null, 2));
        break;
      }
      case "hazard-add": {
        if (!hazardId) throw new Error("hazard-add requires --hazard-id");
        if (!title) throw new Error("hazard-add requires --title");
        if (!area) throw new Error("hazard-add requires --area");
        if (!symptom) throw new Error("hazard-add requires --symptom");
        if (!workaround) throw new Error("hazard-add requires --workaround");
        if (!prevention) throw new Error("hazard-add requires --prevention");
        const { addHazard } = await import("./hazard-registry.ts");
        const hazard = addHazard({
          hazardId,
          title,
          area: area as never,
          severity: (hazardSeverity || "medium") as never,
          status: status as never,
          symptom,
          cause: reason,
          workaround,
          prevention,
          linkedTasks: taskId ? [taskId] : undefined,
          tags
        }, { hermesRoot: workspaceRoot, actor, taskId });
        console.log(JSON.stringify(hazard, null, 2));
        break;
      }
      case "hazard-mitigate": {
        if (!hazardId) throw new Error("hazard-mitigate requires --hazard-id");
        const { mitigateHazard } = await import("./hazard-registry.ts");
        const hazard = mitigateHazard(hazardId, note || "mitigated", { hermesRoot: workspaceRoot, actor, taskId });
        console.log(JSON.stringify(hazard, null, 2));
        break;
      }
      case "event-log-init": {
        const { initEventLog } = await import("./event-log.ts");
        const logPath = initEventLog({ hermesRoot: workspaceRoot });
        console.log(`Hermes event log ready: ${logPath}`);
        break;
      }
      case "event-log-write": {
        if (!actor) throw new Error("event-log-write requires --actor");
        if (!action) throw new Error("event-log-write requires --action");
        if (!message) throw new Error("event-log-write requires --message");
        const { appendHermesEvent } = await import("./event-log.ts");
        const event = appendHermesEvent({
          taskId: taskId || null,
          actor,
          actorType: actorType as never,
          action,
          target: target || null,
          targetType: targetType as never,
          decision: decision as never,
          result: eventResult as never,
          severity: severity as never,
          message,
          commandName: command
        }, { hermesRoot: workspaceRoot });
        console.log(JSON.stringify(event, null, 2));
        break;
      }
      case "event-log-tail": {
        const { tailHermesEvents } = await import("./event-log.ts");
        const limit = maxEvents ?? 20;
        console.log(JSON.stringify(tailHermesEvents(limit, { hermesRoot: workspaceRoot }), null, 2));
        break;
      }
      case "event-log-query": {
        if (!taskId) throw new Error("event-log-query requires --taskId");
        const { queryHermesEvents } = await import("./event-log.ts");
        console.log(JSON.stringify(queryHermesEvents({ taskId }, { hermesRoot: workspaceRoot }), null, 2));
        break;
      }
      case "observability-snapshot": {
        const { writeObservabilitySnapshot } = await import("./observability.ts");
        const snapshot = writeObservabilitySnapshot({ workspaceRoot, projectPath: repositoryPath, maxEvents, maxReports });
        console.log(JSON.stringify({
          overall: snapshot.overall,
          counts: snapshot.counts,
          outputs: snapshot.outputs,
          recommendations: snapshot.recommendations
        }, null, 2));
        break;
      }
      case "observability-report": {
        const { createObservabilitySnapshot, formatObservabilityMarkdown } = await import("./observability.ts");
        const snapshot = createObservabilitySnapshot({ workspaceRoot, projectPath: repositoryPath, maxEvents, maxReports });
        console.log(formatObservabilityMarkdown(snapshot));
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







