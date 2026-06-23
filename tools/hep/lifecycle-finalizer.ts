import * as fs from "node:fs";
import * as path from "node:path";

export type LifecycleStatus = "PROPOSED" | "APPROVED" | "IN_PROGRESS" | "READY_FOR_REVIEW" | "MERGED" | "ARCHIVED" | "BLOCKED";

interface JsonRecord {
  [key: string]: unknown;
}

export interface LifecycleFinalizeOptions {
  workspaceRoot: string;
  taskId: string;
  prNumber?: number;
  prUrl?: string;
  prState?: string;
  branch?: string;
  head?: string;
  baseBranch?: string;
  reportPath?: string;
  policyPath?: string;
  mergedAt?: string;
  finalizedAt?: string;
  dryRun?: boolean;
}

export interface LifecycleFinalizeResult {
  workspaceRoot: string;
  taskId: string;
  status: LifecycleStatus;
  dryRun: boolean;
  updatedFiles: string[];
  recommendations: string[];
  action: {
    actionId: string;
    taskId: string;
    prNumber?: number;
    fromStatus?: string;
    toStatus: LifecycleStatus;
    reversible: true;
    dryRun: boolean;
    createdAt: string;
  };
}

function ensureInsideWorkspace(workspaceRoot: string, targetPath: string): void {
  const root = path.resolve(workspaceRoot);
  const target = path.resolve(targetPath);
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error(`Refusing to touch path outside workspace: ${targetPath}`);
  }
}

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(filePath: string, value: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function appendJsonl(filePath: string, value: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, `${JSON.stringify(value)}\n`, "utf8");
}

function normalizeState(state?: string): LifecycleStatus {
  const upper = (state || "MERGED").toUpperCase();
  if (upper === "MERGED") return "MERGED";
  if (upper === "OPEN" || upper === "READY_FOR_REVIEW") return "READY_FOR_REVIEW";
  if (upper === "CLOSED" || upper === "BLOCKED") return "BLOCKED";
  return "READY_FOR_REVIEW";
}

function loadRegistry<T extends JsonRecord>(workspaceRoot: string, fileName: string, collectionName: string): T {
  const filePath = path.join(workspaceRoot, "memory", fileName);
  const fallback = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    workspaceRoot,
    managedBy: "HEP lifecycle finalizer",
    [collectionName]: []
  } as unknown as T;
  return readJson<T>(filePath, fallback);
}

function updateCollection<T extends JsonRecord>(
  registry: JsonRecord,
  collectionName: string,
  matcher: (item: T) => boolean,
  nextItem: T
): { previous?: T; items: T[] } {
  const existing = Array.isArray(registry[collectionName]) ? registry[collectionName] as T[] : [];
  let previous: T | undefined;
  let replaced = false;
  const items = existing.map((item) => {
    if (matcher(item)) {
      previous = item;
      replaced = true;
      return { ...item, ...nextItem } as T;
    }
    return item;
  });
  if (!replaced) {
    items.push(nextItem);
  }
  registry[collectionName] = items;
  return { previous, items };
}

function findTaskReport(workspaceRoot: string, taskId: string, explicitReport?: string): string | undefined {
  if (explicitReport) {
    return path.isAbsolute(explicitReport) ? explicitReport : path.join(workspaceRoot, "codex-test", explicitReport);
  }

  const reportsDir = path.join(workspaceRoot, "codex-test", "_ai_work", "REPORTS");
  if (!fs.existsSync(reportsDir)) {
    return undefined;
  }

  const match = fs.readdirSync(reportsDir)
    .filter((name) => name.toLowerCase().endsWith(".md"))
    .find((name) => name.includes(taskId));
  return match ? path.join(reportsDir, match) : undefined;
}

export function finalizeLifecycle(options: LifecycleFinalizeOptions): LifecycleFinalizeResult {
  if (!options.taskId) {
    throw new Error("taskId is required for lifecycle finalization");
  }

  const workspaceRoot = path.resolve(options.workspaceRoot);
  ensureDir(path.join(workspaceRoot, "memory"));

  const status = normalizeState(options.prState);
  const finalizedAt = options.finalizedAt || new Date().toISOString();
  const mergedAt = options.mergedAt || (status === "MERGED" ? finalizedAt : undefined);
  const policyPath = options.policyPath || path.join(workspaceRoot, "super-hermes-policy.json");
  const reportPath = findTaskReport(workspaceRoot, options.taskId, options.reportPath);
  const updatedFiles: string[] = [];
  const recommendations: string[] = [];

  const taskRegistryPath = path.join(workspaceRoot, "memory", "task-registry.json");
  const prRegistryPath = path.join(workspaceRoot, "memory", "pr-registry.json");
  const worktreeRegistryPath = path.join(workspaceRoot, "memory", "worktree-registry.json");
  const lifecycleLogPath = path.join(workspaceRoot, "memory", "lifecycle-actions.jsonl");

  for (const candidate of [taskRegistryPath, prRegistryPath, worktreeRegistryPath, lifecycleLogPath]) {
    ensureInsideWorkspace(workspaceRoot, candidate);
  }

  const taskRegistry = loadRegistry<JsonRecord>(workspaceRoot, "task-registry.json", "tasks");
  const prRegistry = loadRegistry<JsonRecord>(workspaceRoot, "pr-registry.json", "pullRequests");
  const worktreeRegistry = loadRegistry<JsonRecord>(workspaceRoot, "worktree-registry.json", "worktrees");

  const taskUpdate = {
    taskId: options.taskId,
    status,
    previousStatus: undefined as string | undefined,
    policyPath,
    reportPath,
    prNumber: options.prNumber,
    prUrl: options.prUrl,
    branch: options.branch,
    head: options.head,
    baseBranch: options.baseBranch,
    mergedAt,
    finalizedAt,
    finalizer: "HERMES-GOVERNANCE-LIFECYCLE-001"
  };
  const taskResult = updateCollection<JsonRecord>(taskRegistry, "tasks", (item) => item.taskId === options.taskId, taskUpdate as unknown as JsonRecord);
  taskUpdate.previousStatus = taskResult.previous?.status as string | undefined;
  const taskItems = Array.isArray(taskRegistry.tasks) ? taskRegistry.tasks as JsonRecord[] : [];
  taskRegistry.tasks = taskItems.map((item) => item.taskId === options.taskId ? { ...item, previousStatus: taskUpdate.previousStatus } : item);

  if (options.prNumber !== undefined) {
    updateCollection<JsonRecord>(
      prRegistry,
      "pullRequests",
      (item) => Number(item.number) === options.prNumber,
      {
        number: options.prNumber,
        state: status,
        taskId: options.taskId,
        url: options.prUrl,
        headRefName: options.branch,
        headRefOid: options.head,
        baseRefName: options.baseBranch,
        mergedAt,
        finalizedAt
      }
    );
  }

  const worktrees = Array.isArray(worktreeRegistry.worktrees) ? worktreeRegistry.worktrees as JsonRecord[] : [];
  worktreeRegistry.worktrees = worktrees.map((entry) => {
    const entryPath = typeof entry.path === "string" ? entry.path.replace(/\\/g, "/") : "";
    const stableProjectCheckout = entryPath.endsWith("/codex-test") || entryPath === "D:/hermes/codex-test";
    const branchMatches = options.branch && entry.branch === options.branch;
    const pathMatches = entryPath.toLowerCase().includes(options.taskId.toLowerCase());
    if (stableProjectCheckout) {
      return {
        ...entry,
        lifecycleStatus: "KEEP_STABLE_PROJECT_CHECKOUT",
        archiveRecommendation: "DO_NOT_ARCHIVE_STABLE_PROJECT_ROOT"
      };
    }
    if (!branchMatches && !pathMatches) {
      return entry;
    }

    recommendations.push(`Review worktree for archive after merged task: ${entry.path ?? "unknown path"}`);
    return {
      ...entry,
      lifecycleStatus: status === "MERGED" ? "ARCHIVE_CANDIDATE" : status,
      taskId: options.taskId,
      prNumber: options.prNumber,
      finalizedAt,
      archiveRecommendation: status === "MERGED" ? "REVIEW_ARCHIVE_NO_AUTOMOVE" : undefined
    };
  });

  if (status === "MERGED") {
    recommendations.push("Move active policy to archived only through an explicit reversible policy archive task.");
    recommendations.push("Run maintenance-plan --only reports after report indexes are refreshed.");
  }

  const action = {
    actionId: `lifecycle-${options.taskId}-${finalizedAt.replace(/[:.]/g, "-")}`,
    taskId: options.taskId,
    prNumber: options.prNumber,
    fromStatus: taskUpdate.previousStatus,
    toStatus: status,
    reversible: true as const,
    dryRun: !!options.dryRun,
    createdAt: finalizedAt
  };

  if (!options.dryRun) {
    writeJson(taskRegistryPath, { ...taskRegistry, generatedAt: finalizedAt, workspaceRoot, managedBy: "HEP lifecycle finalizer" });
    updatedFiles.push(taskRegistryPath);

    writeJson(prRegistryPath, { ...prRegistry, generatedAt: finalizedAt, workspaceRoot, managedBy: "HEP lifecycle finalizer" });
    updatedFiles.push(prRegistryPath);

    writeJson(worktreeRegistryPath, { ...worktreeRegistry, generatedAt: finalizedAt, workspaceRoot, managedBy: "HEP lifecycle finalizer" });
    updatedFiles.push(worktreeRegistryPath);

    appendJsonl(lifecycleLogPath, { ...action, recommendations, reportPath, policyPath });
    updatedFiles.push(lifecycleLogPath);
  }

  return { workspaceRoot, taskId: options.taskId, status, dryRun: !!options.dryRun, updatedFiles, recommendations, action };
}

export function formatLifecycleResult(result: LifecycleFinalizeResult): string {
  return [
    `Lifecycle finalizer result for ${result.taskId}`,
    `Status: ${result.status}`,
    `Dry run: ${result.dryRun ? "yes" : "no"}`,
    `Updated files: ${result.updatedFiles.length}`,
    ...result.updatedFiles.map((file) => `- ${file}`),
    "Recommendations:",
    ...(result.recommendations.length > 0 ? result.recommendations.map((item) => `- ${item}`) : ["- none"])
  ].join("\n");
}
