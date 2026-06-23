import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, relative, resolve, sep } from "node:path";

export type DependencyAction =
  | "read"
  | "index"
  | "archive"
  | "quarantine"
  | "move"
  | "edit"
  | "registry_update"
  | "delete"
  | "write"
  | "scan"
  | "edit_cli"
  | "edit_registry"
  | "finalize_lifecycle";

export type DependencyDecision =
  | "ALLOW"
  | "DENY"
  | "REQUIRE_WAIVER_PLAN"
  | "ALLOW_WITH_IMPACT_PLAN"
  | "ESCALATE";

export type AssetCriticality = "low" | "medium" | "high" | "critical";
export type AssetLeaseMode = "read" | "write" | "exclusive";
export type DependencyStatus = "active" | "merged" | "archived" | "unknown";

export interface AssetRecord {
  assetId: string;
  path: string;
  type: "project" | "worktree" | "report" | "registry" | "policy" | "agent" | "tool" | "log" | "temp" | "unknown";
  ownerTaskId?: string;
  ownerActor?: string;
  linkedTasks: string[];
  linkedReports: string[];
  linkedRegistries: string[];
  referencedBy: string[];
  dependsOn: string[];
  status: DependencyStatus;
  criticality: AssetCriticality;
  protected: boolean;
  movable: boolean;
  deleteAllowed: boolean;
  restoreRequired: boolean;
  notes: string[];
}

export interface AssetLease {
  leaseId: string;
  assetId: string;
  leasedBy: string;
  taskId: string;
  mode: AssetLeaseMode;
  expiresAt: string;
  reason: string;
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: "references" | "depends_on" | "owns" | "leases";
  taskId?: string;
  reportPath?: string;
  active?: boolean;
}

export interface ImpactPlan {
  impactedAssets: string[];
  compensatingTasks: string[];
  requiredValidations: string[];
  rollbackPlan: string[];
  reason?: string;
}

export interface DependencyCheckRequest {
  workspaceRoot: string;
  taskId: string;
  actor: string;
  action: DependencyAction;
  target: string;
  reason?: string;
  impactPlan?: ImpactPlan;
  allowImpactPlan?: boolean;
  dryRun?: boolean;
  now?: Date;
}

export interface DependencyCheckResult {
  decision: DependencyDecision;
  allowed: boolean;
  risk: AssetCriticality;
  targetAsset: AssetRecord;
  impactedAssets: string[];
  blockingDependencies: string[];
  activeLeases: AssetLease[];
  requiredActions: string[];
  compensatingTasks: string[];
  requiredValidations: string[];
  rollbackPlan: string[];
  impactPlan?: ImpactPlan;
  safeAlternative?: string;
  reasons: string[];
}

export interface DependencyGuardState {
  assetPath: string;
  leasesPath: string;
  graphPath: string;
  ledgerPath: string;
  assets: AssetRecord[];
  leases: AssetLease[];
  graph: { generatedAt: string; edges: DependencyEdge[] };
}

export interface ImpactLedgerEntry {
  entryId: string;
  timestamp: string;
  taskId: string;
  actor: string;
  action: DependencyAction;
  target: string;
  decision: DependencyDecision;
  impactedAssets: string[];
  compensatingTasks: string[];
  requiredValidations: string[];
  rollbackPlan: string[];
}

const ASSETS_PATH = join("memory", "dependency-assets.json");
const LEASES_PATH = join("memory", "dependency-leases.jsonl");
const GRAPH_PATH = join("memory", "dependency-graph.json");
const LEDGER_PATH = join("logs", "dependency-impact-ledger.jsonl");

function ensureParent(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
}

function toPosixPath(value: string): string {
  return value.split(sep).join("/").replaceAll("\\", "/");
}

function isInside(parent: string, child: string): boolean {
  const normalizedParent = normalize(parent);
  const normalizedChild = normalize(child);
  return normalizedChild === normalizedParent || normalizedChild.startsWith(normalizedParent.endsWith(sep) ? normalizedParent : `${normalizedParent}${sep}`);
}

function workspaceRelative(workspaceRoot: string, target: string): string {
  const root = resolve(workspaceRoot);
  const absolute = resolve(root, target);
  if (!isInside(root, absolute)) return toPosixPath(normalize(target));
  const rel = relative(root, absolute);
  return toPosixPath(rel || ".");
}

function stableId(input: string): string {
  return input.replaceAll("\\", "/").replace(/[^a-zA-Z0-9._/-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 180) || "workspace-root";
}

function readJson<T>(absolutePath: string, fallback: T): T {
  if (!existsSync(absolutePath)) return fallback;
  try {
    return JSON.parse(readFileSync(absolutePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function readJsonl<T>(absolutePath: string): T[] {
  if (!existsSync(absolutePath)) return [];
  return readFileSync(absolutePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as T];
      } catch {
        return [];
      }
    });
}

function appendJsonl(absolutePath: string, entry: unknown): void {
  ensureParent(absolutePath);
  appendFileSync(absolutePath, `${JSON.stringify(entry)}\n`, "utf8");
}

function writeJsonIfMissing(absolutePath: string, value: unknown): void {
  ensureParent(absolutePath);
  if (!existsSync(absolutePath)) writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function touchFileIfMissing(absolutePath: string): void {
  ensureParent(absolutePath);
  if (!existsSync(absolutePath)) writeFileSync(absolutePath, "", "utf8");
}

function detectAssetType(rel: string): AssetRecord["type"] {
  if (rel === "codex-test" || rel.startsWith("projects/")) return "project";
  if (rel.startsWith("worktrees/") || rel.endsWith("-work")) return "worktree";
  if (rel.startsWith("reports/") || rel.startsWith("_ai_work/REPORTS/") || rel.includes("/_ai_work/REPORTS/")) return "report";
  if (rel.startsWith("memory/") || rel.endsWith("registry.json") || rel.endsWith(".jsonl")) return "registry";
  if (rel.startsWith("policies/") || rel.includes("policy")) return "policy";
  if (rel.startsWith("agents/") || rel.includes("agent")) return "agent";
  if (rel.startsWith("tools/hep/") || rel.includes("/tools/hep/")) return "tool";
  if (rel.startsWith("logs/")) return "log";
  if (rel.startsWith("temp/") || rel.startsWith("quarantine/")) return "temp";
  return "unknown";
}

function criticalityFor(type: AssetRecord["type"], rel: string): AssetCriticality {
  if (type === "project" || type === "policy" || rel.includes("/.git") || rel === ".git") return "critical";
  if (type === "worktree" || type === "registry") return "high";
  if (type === "agent" || type === "tool") return "medium";
  return "low";
}

function inferOwnerTask(rel: string): string | undefined {
  const match = rel.match(/([A-Z][A-Z0-9]+(?:-[A-Z0-9]+){2,})/);
  return match?.[1];
}

function canonicalAction(action: DependencyAction): DependencyAction {
  if (action === "edit_cli") return "edit";
  if (action === "edit_registry" || action === "finalize_lifecycle") return "registry_update";
  return action;
}

function isRiskyMutation(action: DependencyAction): boolean {
  return ["archive", "quarantine", "move", "edit", "registry_update", "write", "delete"].includes(canonicalAction(action));
}

function isLowRiskRead(action: DependencyAction): boolean {
  return ["read", "index", "scan"].includes(canonicalAction(action));
}

function emptyImpactPlan(): ImpactPlan {
  return { impactedAssets: [], compensatingTasks: [], requiredValidations: [], rollbackPlan: [] };
}

function hasValidImpactPlan(plan: ImpactPlan | undefined): plan is ImpactPlan {
  return Boolean(plan?.impactedAssets.length && plan.compensatingTasks.length && plan.requiredValidations.length && plan.rollbackPlan.length);
}

function buildGeneratedImpactPlan(request: DependencyCheckRequest, impactedAssets: string[], dependencies: string[]): ImpactPlan {
  return {
    impactedAssets,
    compensatingTasks: dependencies.map((dependency) => `Repair or update dependency link: ${dependency}`),
    requiredValidations: ["npm run lint", "npm test", "npm run build"],
    rollbackPlan: [`Restore ${workspaceRelative(request.workspaceRoot, request.target)} from backup or reversible maintenance action`, "Rebuild dependency/report indexes"],
    reason: request.reason || "Generated impact plan for controlled dependency change.",
  };
}

function makeResult(input: {
  decision: DependencyDecision;
  risk: AssetCriticality;
  asset: AssetRecord;
  reasons: string[];
  blockers?: string[];
  leases?: AssetLease[];
  requiredActions?: string[];
  impactPlan?: ImpactPlan;
  safeAlternative?: string;
}): DependencyCheckResult {
  const plan = input.impactPlan ?? emptyImpactPlan();
  const decisionAllows = input.decision === "ALLOW" || input.decision === "ALLOW_WITH_IMPACT_PLAN";
  return {
    decision: input.decision,
    allowed: decisionAllows,
    risk: input.risk,
    targetAsset: input.asset,
    impactedAssets: plan.impactedAssets,
    blockingDependencies: input.blockers ?? [],
    activeLeases: input.leases ?? [],
    requiredActions: input.requiredActions ?? [],
    compensatingTasks: plan.compensatingTasks,
    requiredValidations: plan.requiredValidations,
    rollbackPlan: plan.rollbackPlan,
    impactPlan: input.impactPlan,
    safeAlternative: input.safeAlternative,
    reasons: input.reasons,
  };
}

export function buildAssetRecord(workspaceRoot: string, target: string): AssetRecord {
  const rel = workspaceRelative(workspaceRoot, target);
  const type = detectAssetType(rel);
  const criticality = criticalityFor(type, rel);
  const absolute = resolve(workspaceRoot, rel);
  const notes: string[] = [];
  if (existsSync(absolute)) {
    const stats = statSync(absolute);
    notes.push(stats.isDirectory() ? "exists:directory" : "exists:file");
    if (stats.isDirectory() && existsSync(join(absolute, ".git"))) notes.push("contains-git-metadata");
  } else {
    notes.push("missing-on-disk");
  }

  const protectedAsset = criticality === "critical" || type === "worktree" || type === "policy";
  const ownerTaskId = inferOwnerTask(rel);
  return {
    assetId: stableId(rel),
    path: rel,
    type,
    ownerTaskId,
    linkedTasks: ownerTaskId ? [ownerTaskId] : [],
    linkedReports: [],
    linkedRegistries: [],
    referencedBy: [],
    dependsOn: [],
    status: "unknown",
    criticality,
    protected: protectedAsset,
    movable: !protectedAsset && type !== "unknown",
    deleteAllowed: false,
    restoreRequired: true,
    notes,
  };
}

export function loadDependencyGuardState(workspaceRoot: string, now = new Date()): DependencyGuardState {
  const assetPath = join(workspaceRoot, ASSETS_PATH);
  const leasesPath = join(workspaceRoot, LEASES_PATH);
  const graphPath = join(workspaceRoot, GRAPH_PATH);
  const ledgerPath = join(workspaceRoot, LEDGER_PATH);
  const assets = readJson<{ assets?: AssetRecord[] }>(assetPath, { assets: [] }).assets ?? [];
  const leases = readJsonl<AssetLease>(leasesPath).filter((lease) => Date.parse(lease.expiresAt) > now.getTime());
  const graph = readJson<{ generatedAt: string; edges: DependencyEdge[] }>(graphPath, { generatedAt: "", edges: [] });
  return { assetPath, leasesPath, graphPath, ledgerPath, assets, leases, graph };
}

export function loadAssetRegistry(workspaceRoot: string): AssetRecord[] {
  return loadDependencyGuardState(workspaceRoot).assets;
}

export function upsertAssetRegistry(workspaceRoot: string, assets: AssetRecord[]): void {
  const existing = loadDependencyGuardState(workspaceRoot).assets;
  const unique = new Map<string, AssetRecord>();
  for (const asset of existing) unique.set(asset.assetId, asset);
  for (const asset of assets) unique.set(asset.assetId, asset);
  const assetPath = join(workspaceRoot, ASSETS_PATH);
  ensureParent(assetPath);
  writeFileSync(assetPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), assets: [...unique.values()] }, null, 2)}\n`, "utf8");
}

export function loadActiveLeases(workspaceRoot: string, now = new Date()): AssetLease[] {
  return loadDependencyGuardState(workspaceRoot, now).leases;
}

export function createAssetLease(workspaceRoot: string, lease: Omit<AssetLease, "leaseId">): AssetLease {
  const created: AssetLease = {
    ...lease,
    leaseId: `lease-${Date.now()}-${stableId(lease.assetId).slice(0, 32)}`,
  };
  appendJsonl(join(workspaceRoot, LEASES_PATH), created);
  return created;
}

export function buildDependencyGraph(workspaceRoot: string): { generatedAt: string; edges: DependencyEdge[] } {
  const assets = loadDependencyGuardState(workspaceRoot).assets;
  const edges = assets.flatMap((asset) => [
    ...asset.referencedBy.map((source) => ({ from: stableId(source), to: asset.assetId, type: "references" as const, active: true })),
    ...asset.dependsOn.map((target) => ({ from: asset.assetId, to: stableId(target), type: "depends_on" as const, active: true })),
    ...(asset.ownerTaskId ? [{ from: asset.ownerTaskId, to: asset.assetId, type: "owns" as const, taskId: asset.ownerTaskId, active: true }] : []),
  ]);
  const graph = { generatedAt: new Date().toISOString(), edges };
  const graphPath = join(workspaceRoot, GRAPH_PATH);
  ensureParent(graphPath);
  writeFileSync(graphPath, `${JSON.stringify(graph, null, 2)}\n`, "utf8");
  return graph;
}

function mergeRegisteredAsset(workspaceRoot: string, target: string, now: Date): AssetRecord {
  const detected = buildAssetRecord(workspaceRoot, target);
  const registered = loadDependencyGuardState(workspaceRoot, now).assets.find((asset) => asset.assetId === detected.assetId || asset.path === detected.path);
  if (!registered) return detected;
  return {
    ...detected,
    ...registered,
    notes: [...new Set([...detected.notes, ...registered.notes])],
  };
}

function activeExternalLeases(state: DependencyGuardState, asset: AssetRecord, request: DependencyCheckRequest): AssetLease[] {
  return state.leases.filter((lease) => {
    const leaseMatchesAsset = lease.assetId === asset.assetId || lease.assetId === asset.path;
    const leaseOwnedByRequester = lease.taskId === request.taskId && lease.leasedBy === request.actor;
    return leaseMatchesAsset && !leaseOwnedByRequester;
  });
}

function dependencyBlockers(state: DependencyGuardState, asset: AssetRecord, leases: AssetLease[], request: DependencyCheckRequest): string[] {
  const graphBlockers = state.graph.edges
    .filter((edge) => edge.active !== false && (edge.to === asset.assetId || edge.to === asset.path))
    .map((edge) => `${edge.type}:${edge.from}`);
  return [
    ...asset.referencedBy.map((ref) => `referenced-by:${ref}`),
    ...asset.dependsOn.map((dep) => `depends-on:${dep}`),
    ...asset.linkedReports.map((report) => `linked-report:${report}`),
    ...asset.linkedRegistries.map((registry) => `linked-registry:${registry}`),
    ...asset.linkedTasks.filter((task) => task !== request.taskId).map((task) => `linked-task:${task}`),
    ...leases.map((lease) => `active-lease:${lease.leasedBy}:${lease.mode}`),
    ...graphBlockers,
  ].filter((item, index, all) => all.indexOf(item) === index);
}

export function dependencyCheck(request: DependencyCheckRequest): DependencyCheckResult {
  const action = canonicalAction(request.action);
  const now = request.now ?? new Date();
  const state = loadDependencyGuardState(request.workspaceRoot, now);
  const asset = mergeRegisteredAsset(request.workspaceRoot, request.target, now);
  const leases = activeExternalLeases(state, asset, request);
  const blockers = dependencyBlockers(state, asset, leases, request);
  const impactedAssets = [asset.path, ...blockers].filter((item, index, all) => all.indexOf(item) === index);

  if (action === "delete") {
    return makeResult({
      decision: "DENY",
      risk: asset.criticality,
      asset,
      blockers,
      leases,
      requiredActions: ["Use archive or quarantine with a restore ledger instead of delete."],
      safeAlternative: "archive",
      reasons: ["Delete is disabled by default in Dependency Guard."],
    });
  }

  if (isLowRiskRead(action)) {
    return makeResult({
      decision: "ALLOW",
      risk: asset.criticality,
      asset,
      blockers,
      leases,
      reasons: ["Low-risk read/index action does not mutate dependencies."],
    });
  }

  if (asset.protected && isRiskyMutation(action)) {
    return makeResult({
      decision: asset.criticality === "critical" ? "DENY" : "ESCALATE",
      risk: asset.criticality,
      asset,
      blockers,
      leases,
      requiredActions: ["Create a dedicated human-approved change task.", "Prove rollback and validations before mutation."],
      safeAlternative: "read-only audit or copy into a safe workspace",
      reasons: ["Target is a protected asset and the requested action can break workspace dependencies."],
    });
  }

  if (leases.length > 0 && isRiskyMutation(action)) {
    return makeResult({
      decision: "REQUIRE_WAIVER_PLAN",
      risk: asset.criticality,
      asset,
      blockers,
      leases,
      requiredActions: ["Coordinate with active lease owner.", "Create explicit waiver plan before changing leased asset."],
      safeAlternative: "wait for lease expiry or request a separate handoff",
      impactPlan: buildGeneratedImpactPlan(request, impactedAssets, blockers),
      reasons: ["Target has an active lease owned by another task or actor."],
    });
  }

  if (blockers.length > 0 && isRiskyMutation(action)) {
    const plan = hasValidImpactPlan(request.impactPlan)
      ? request.impactPlan
      : request.allowImpactPlan
        ? buildGeneratedImpactPlan(request, impactedAssets, blockers)
        : undefined;
    if (hasValidImpactPlan(plan)) {
      return makeResult({
        decision: "ALLOW_WITH_IMPACT_PLAN",
        risk: asset.criticality,
        asset,
        blockers,
        leases,
        requiredActions: ["Execute compensating tasks.", "Run required validations green.", "Write impact ledger.", "Keep rollback path until follow-up closes."],
        safeAlternative: "defer action until dependency links close",
        impactPlan: plan,
        reasons: ["Target is referenced by active dependency links, but a valid impact plan is present."],
      });
    }
    return makeResult({
      decision: "REQUIRE_WAIVER_PLAN",
      risk: asset.criticality,
      asset,
      blockers,
      leases,
      requiredActions: ["Create impact plan with impacted assets, compensating tasks, validations, and rollback plan."],
      safeAlternative: "defer action until dependency links close",
      impactPlan: buildGeneratedImpactPlan(request, impactedAssets, blockers),
      reasons: ["Target is referenced by active dependency links and no valid impact plan was supplied."],
    });
  }

  if (asset.type === "unknown" && isRiskyMutation(action)) {
    return makeResult({
      decision: "ESCALATE",
      risk: asset.criticality,
      asset,
      blockers,
      leases,
      requiredActions: ["Classify asset ownership before mutation."],
      safeAlternative: "copy instead of mutate",
      reasons: ["Target ownership is unknown for a risky action."],
    });
  }

  if (asset.movable && isRiskyMutation(action)) {
    return makeResult({
      decision: "ALLOW",
      risk: asset.criticality,
      asset,
      blockers,
      leases,
      requiredActions: ["Write reversible action ledger.", "Keep restore path available."],
      reasons: ["No active dependencies found for movable asset."],
    });
  }

  return makeResult({
    decision: "ESCALATE",
    risk: asset.criticality,
    asset,
    blockers,
    leases,
    requiredActions: ["Manual review required before dependency mutation."],
    safeAlternative: "read-only audit",
    reasons: ["Dependency state is ambiguous."],
  });
}

export function writeImpactLedger(workspaceRoot: string, request: DependencyCheckRequest, result: DependencyCheckResult): ImpactLedgerEntry {
  const entry: ImpactLedgerEntry = {
    entryId: `impact-${Date.now()}-${stableId(result.targetAsset.assetId).slice(0, 32)}`,
    timestamp: new Date().toISOString(),
    taskId: request.taskId,
    actor: request.actor,
    action: request.action,
    target: result.targetAsset.path,
    decision: result.decision,
    impactedAssets: result.impactedAssets,
    compensatingTasks: result.compensatingTasks,
    requiredValidations: result.requiredValidations,
    rollbackPlan: result.rollbackPlan,
  };
  appendJsonl(join(workspaceRoot, LEDGER_PATH), entry);
  return entry;
}

export function initializeDependencyGuard(workspaceRoot: string): {
  assetPath: string;
  leasesPath: string;
  graphPath: string;
  ledgerPath: string;
  registryPath: string;
  assets: number;
} {
  const seedAssets = [
    buildAssetRecord(workspaceRoot, "codex-test"),
    buildAssetRecord(workspaceRoot, "memory"),
    buildAssetRecord(workspaceRoot, "policies"),
    buildAssetRecord(workspaceRoot, "projects"),
    buildAssetRecord(workspaceRoot, "worktrees"),
    buildAssetRecord(workspaceRoot, "reports"),
    buildAssetRecord(workspaceRoot, "agents"),
  ];
  const assetPath = join(workspaceRoot, ASSETS_PATH);
  const leasesPath = join(workspaceRoot, LEASES_PATH);
  const graphPath = join(workspaceRoot, GRAPH_PATH);
  const ledgerPath = join(workspaceRoot, LEDGER_PATH);
  writeJsonIfMissing(assetPath, { generatedAt: new Date().toISOString(), assets: seedAssets });
  touchFileIfMissing(leasesPath);
  writeJsonIfMissing(graphPath, { generatedAt: new Date().toISOString(), edges: [] });
  touchFileIfMissing(ledgerPath);
  const graph = buildDependencyGraph(workspaceRoot);
  return { assetPath, leasesPath, graphPath, ledgerPath, registryPath: assetPath, assets: graph.edges.length > 0 ? seedAssets.length : loadDependencyGuardState(workspaceRoot).assets.length };
}
