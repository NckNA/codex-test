import * as fs from "node:fs";
import * as path from "node:path";

export type MaintenanceDecision = "KEEP" | "ARCHIVE" | "QUARANTINE" | "DELETE_BLOCKED" | "ESCALATE";
export type MaintenanceRisk = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "BLOCKED";
export type MaintenanceFindingType =
  | "governed_zone"
  | "root_project_checkout"
  | "root_worktree_candidate"
  | "agent_workspace_candidate"
  | "legacy_report"
  | "temp_artifact"
  | "unknown_root"
  | "protected_asset";

export interface MaintenanceFinding {
  path: string;
  relativePath: string;
  type: MaintenanceFindingType;
  decision: MaintenanceDecision;
  risk: MaintenanceRisk;
  reason: string;
  destination?: string;
  suggestedTarget?: string;
  quartermasterDecision?: MaintenanceDecision;
  actor: "Cleaner" | "Archivist" | "Quartermaster";
}

export interface MaintenancePlan {
  workspaceRoot: string;
  taskId?: string;
  createdAt: string;
  mode: "PLAN" | "SAFE_APPLY";
  findings: MaintenanceFinding[];
  protectedManifestPath: string;
  reportsIndexPath: string;
  deleteEnabled: false;
  summary: {
    keep: number;
    archive: number;
    quarantine: number;
    deleteBlocked: number;
    escalate: number;
  };
}

export interface MaintenanceAction {
  actionId: string;
  taskId?: string;
  createdAt: string;
  action: "ARCHIVE" | "QUARANTINE";
  from: string;
  to: string;
  reason: string;
  reversible: true;
  dryRun: boolean;
}

export interface CreateMaintenancePlanOptions {
  workspaceRoot: string;
  taskId?: string;
  only?: string[];
}

export interface ApplyMaintenanceOptions {
  maxActions?: number;
  dryRun?: boolean;
  only?: string[];
}

const GOVERNED_ROOTS = new Set([
  "agents",
  "backups",
  "core",
  "logs",
  "memory",
  "policies",
  "projects",
  "quarantine",
  "reports",
  "temp",
  "worktrees"
]);

const PROTECTED_ROOT_NAMES = new Set([
  "codex-test",
  "memory",
  "policies",
  "projects",
  "worktrees",
  "agents",
  "core",
  "super-hermes-policy.json"
]);

const REPORT_SUBZONES = new Set(["active", "archived", "indexes"]);

function toPosix(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}

function safeRelative(workspaceRoot: string, targetPath: string): string {
  const relative = path.relative(workspaceRoot, targetPath);
  return toPosix(relative || ".");
}

function ensureInsideWorkspace(workspaceRoot: string, targetPath: string): void {
  const resolvedRoot = path.resolve(workspaceRoot);
  const resolvedTarget = path.resolve(targetPath);
  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(resolvedRoot + path.sep)) {
    throw new Error(`Refusing to operate outside workspace: ${targetPath}`);
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

function uniqueDestination(targetPath: string): string {
  if (!fs.existsSync(targetPath)) {
    return targetPath;
  }
  const dir = path.dirname(targetPath);
  const parsed = path.parse(targetPath);
  let index = 1;
  while (true) {
    const candidate = path.join(dir, `${parsed.name}-${index}${parsed.ext}`);
    if (!fs.existsSync(candidate)) {
      return candidate;
    }
    index++;
  }
}

function isGitCheckout(dirPath: string): boolean {
  return fs.existsSync(path.join(dirPath, ".git"));
}

function isLikelyAgentWorkspace(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.includes("agent") || lower.includes("bot") || lower.includes("whatsapp") || lower.includes("bridge");
}

function parseOnly(only?: string[]): Set<string> | undefined {
  const normalized = (only || [])
    .flatMap((item) => item.split(","))
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return normalized.length > 0 ? new Set(normalized) : undefined;
}

function matchesOnly(finding: MaintenanceFinding, only?: Set<string>): boolean {
  if (!only) {
    return true;
  }
  const firstSegment = finding.relativePath.split("/")[0]?.toLowerCase();
  return only.has(firstSegment) || only.has(finding.type.toLowerCase()) || only.has(finding.decision.toLowerCase());
}

export function ensureMaintenanceWorkspace(workspaceRoot: string): { protectedManifestPath: string; reportsIndexPath: string } {
  const requiredDirs = [
    "reports/active",
    "reports/archived",
    "reports/indexes",
    "policies/active",
    "policies/archived",
    "worktrees/active",
    "worktrees/archived",
    "memory",
    "agents",
    "logs",
    "temp",
    "quarantine"
  ];

  for (const dir of requiredDirs) {
    ensureDir(path.join(workspaceRoot, dir));
  }

  const protectedManifestPath = path.join(workspaceRoot, "memory", "protected-assets.json");
  const existing = readJson<{ protectedRoots?: string[]; protectedGlobs?: string[] }>(protectedManifestPath, {});
  const protectedRoots = Array.from(new Set([...(existing.protectedRoots || []), ...Array.from(PROTECTED_ROOT_NAMES)])).sort();
  const protectedGlobs = Array.from(new Set([...(existing.protectedGlobs || []), "**/.git/**", "**/.env", "**/.env.*", "**/supabase/migrations/**"])).sort();
  writeJson(protectedManifestPath, {
    version: 2,
    description: "Protected Hermes assets. Maintenance Trio may classify these, but safe apply must not move or delete them.",
    protectedRoots,
    protectedGlobs,
    updatedAt: new Date().toISOString()
  });

  return {
    protectedManifestPath,
    reportsIndexPath: path.join(workspaceRoot, "reports", "indexes", "report-index.json")
  };
}

function makeFinding(workspaceRoot: string, absolutePath: string, data: Omit<MaintenanceFinding, "path" | "relativePath">): MaintenanceFinding {
  return {
    path: absolutePath,
    relativePath: safeRelative(workspaceRoot, absolutePath),
    suggestedTarget: data.destination,
    quartermasterDecision: data.decision,
    ...data
  };
}

function reportArchiveDestination(workspaceRoot: string, sourcePath: string): string {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return uniqueDestination(path.join(workspaceRoot, "reports", "archived", year, month, path.basename(sourcePath)));
}

function quarantineDestination(workspaceRoot: string, sourcePath: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return uniqueDestination(path.join(workspaceRoot, "quarantine", stamp, path.basename(sourcePath)));
}

function scanReports(workspaceRoot: string): MaintenanceFinding[] {
  const reportsRoot = path.join(workspaceRoot, "reports");
  if (!fs.existsSync(reportsRoot)) {
    return [];
  }
  const findings: MaintenanceFinding[] = [];
  for (const entry of fs.readdirSync(reportsRoot, { withFileTypes: true })) {
    if (REPORT_SUBZONES.has(entry.name)) {
      findings.push(makeFinding(workspaceRoot, path.join(reportsRoot, entry.name), {
        type: "governed_zone",
        decision: "KEEP",
        risk: "NONE",
        reason: "Managed reports sub-zone.",
        actor: "Archivist"
      }));
      continue;
    }

    const absolutePath = path.join(reportsRoot, entry.name);
    findings.push(makeFinding(workspaceRoot, absolutePath, {
      type: "legacy_report",
      decision: "ARCHIVE",
      risk: "LOW",
      reason: "Legacy report artifact lives directly under reports; archive is reversible.",
      destination: reportArchiveDestination(workspaceRoot, absolutePath),
      actor: "Archivist"
    }));
  }
  return findings;
}

function scanTemp(workspaceRoot: string): MaintenanceFinding[] {
  const tempRoot = path.join(workspaceRoot, "temp");
  if (!fs.existsSync(tempRoot)) {
    return [];
  }
  const findings: MaintenanceFinding[] = [];
  for (const entry of fs.readdirSync(tempRoot, { withFileTypes: true })) {
    const absolutePath = path.join(tempRoot, entry.name);
    findings.push(makeFinding(workspaceRoot, absolutePath, {
      type: "temp_artifact",
      decision: "QUARANTINE",
      risk: "LOW",
      reason: "Temp artifact can be moved to quarantine, not deleted.",
      destination: quarantineDestination(workspaceRoot, absolutePath),
      actor: "Cleaner"
    }));
  }
  return findings;
}

function scanRoot(workspaceRoot: string): MaintenanceFinding[] {
  const findings: MaintenanceFinding[] = [];
  for (const entry of fs.readdirSync(workspaceRoot, { withFileTypes: true })) {
    const absolutePath = path.join(workspaceRoot, entry.name);
    const lowerName = entry.name.toLowerCase();

    if (GOVERNED_ROOTS.has(entry.name)) {
      findings.push(makeFinding(workspaceRoot, absolutePath, {
        type: "governed_zone",
        decision: "KEEP",
        risk: "NONE",
        reason: "Managed Hermes workspace zone.",
        actor: "Quartermaster"
      }));
      continue;
    }

    if (PROTECTED_ROOT_NAMES.has(entry.name)) {
      findings.push(makeFinding(workspaceRoot, absolutePath, {
        type: "protected_asset",
        decision: "KEEP",
        risk: "CRITICAL",
        reason: "Protected asset listed in maintenance manifest.",
        actor: "Quartermaster"
      }));
      continue;
    }

    if (entry.isDirectory() && isGitCheckout(absolutePath)) {
      findings.push(makeFinding(workspaceRoot, absolutePath, {
        type: lowerName.includes("work") ? "root_worktree_candidate" : "root_project_checkout",
        decision: "ESCALATE",
        risk: "HIGH",
        reason: "Directory contains .git; treat as a possible engine, not trash.",
        actor: "Quartermaster"
      }));
      continue;
    }

    if (entry.isDirectory() && isLikelyAgentWorkspace(entry.name)) {
      findings.push(makeFinding(workspaceRoot, absolutePath, {
        type: "agent_workspace_candidate",
        decision: "ESCALATE",
        risk: "HIGH",
        reason: "Looks like an agent/integration workspace; requires registry decision before movement.",
        actor: "Archivist"
      }));
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith(".lnk")) {
      findings.push(makeFinding(workspaceRoot, absolutePath, {
        type: "unknown_root",
        decision: "ESCALATE",
        risk: "MEDIUM",
        reason: "Shortcut may be operational; do not move automatically.",
        actor: "Quartermaster"
      }));
      continue;
    }

    findings.push(makeFinding(workspaceRoot, absolutePath, {
      type: "unknown_root",
      decision: "ESCALATE",
      risk: "MEDIUM",
      reason: "Unclassified root object requires Quartermaster policy before automation.",
      actor: "Quartermaster"
    }));
  }
  return findings;
}

export function createReportsIndex(workspaceRoot: string): string {
  const reportsRoot = path.join(workspaceRoot, "reports");
  const indexPath = path.join(reportsRoot, "indexes", "report-index.json");
  ensureDir(path.dirname(indexPath));

  const entries: Array<{ path: string; kind: "active" | "archived" | "legacy" | "index"; size: number; modifiedAt: string }> = [];
  const collect = (dir: string, kind: "active" | "archived" | "legacy" | "index", depth = 0): void => {
    if (!fs.existsSync(dir) || depth > 5) {
      return;
    }
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolutePath = path.join(dir, entry.name);
      if (absolutePath === indexPath) {
        continue;
      }
      if (entry.isDirectory()) {
        collect(absolutePath, kind, depth + 1);
        continue;
      }
      const stat = fs.statSync(absolutePath);
      entries.push({
        path: safeRelative(workspaceRoot, absolutePath),
        kind,
        size: stat.size,
        modifiedAt: stat.mtime.toISOString()
      });
    }
  };

  if (fs.existsSync(reportsRoot)) {
    for (const entry of fs.readdirSync(reportsRoot, { withFileTypes: true })) {
      const absolutePath = path.join(reportsRoot, entry.name);
      if (REPORT_SUBZONES.has(entry.name)) {
        const kind = entry.name === "active" ? "active" : entry.name === "archived" ? "archived" : "index";
        collect(absolutePath, kind);
      } else if (entry.isDirectory()) {
        collect(absolutePath, "legacy");
      } else {
        const stat = fs.statSync(absolutePath);
        entries.push({
          path: safeRelative(workspaceRoot, absolutePath),
          kind: "legacy",
          size: stat.size,
          modifiedAt: stat.mtime.toISOString()
        });
      }
    }
  }

  writeJson(indexPath, {
    version: 1,
    generatedAt: new Date().toISOString(),
    total: entries.length,
    entries: entries.sort((a, b) => a.path.localeCompare(b.path))
  });
  return indexPath;
}

export function createMaintenancePlan(options: CreateMaintenancePlanOptions): MaintenancePlan {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  ensureInsideWorkspace(workspaceRoot, workspaceRoot);
  const { protectedManifestPath, reportsIndexPath } = ensureMaintenanceWorkspace(workspaceRoot);
  createReportsIndex(workspaceRoot);

  const only = parseOnly(options.only);
  const findings = [...scanRoot(workspaceRoot), ...scanReports(workspaceRoot), ...scanTemp(workspaceRoot)].filter((finding) => matchesOnly(finding, only));

  const summary = {
    keep: findings.filter((finding) => finding.decision === "KEEP").length,
    archive: findings.filter((finding) => finding.decision === "ARCHIVE").length,
    quarantine: findings.filter((finding) => finding.decision === "QUARANTINE").length,
    deleteBlocked: findings.filter((finding) => finding.decision === "DELETE_BLOCKED").length,
    escalate: findings.filter((finding) => finding.decision === "ESCALATE").length
  };

  return {
    workspaceRoot,
    taskId: options.taskId,
    createdAt: new Date().toISOString(),
    mode: "PLAN",
    findings,
    protectedManifestPath,
    reportsIndexPath,
    deleteEnabled: false,
    summary
  };
}

export function writeMaintenancePlan(plan: MaintenancePlan): string {
  const registryPath = path.join(plan.workspaceRoot, "memory", "maintenance-registry.json");
  writeJson(registryPath, plan);
  return registryPath;
}

function actionsLogPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, "memory", "maintenance-actions.jsonl");
}

function appendAction(workspaceRoot: string, action: MaintenanceAction): void {
  const filePath = actionsLogPath(workspaceRoot);
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, `${JSON.stringify(action)}\n`, "utf8");
}

function makeAction(plan: MaintenancePlan, finding: MaintenanceFinding, dryRun: boolean): MaintenanceAction {
  if (!finding.destination) {
    throw new Error(`Finding has no destination: ${finding.relativePath}`);
  }
  const now = new Date().toISOString();
  return {
    actionId: `maint-${now.replace(/[-:.TZ]/g, "")}-${Math.random().toString(36).slice(2, 8)}`,
    taskId: plan.taskId,
    createdAt: now,
    action: finding.decision === "ARCHIVE" ? "ARCHIVE" : "QUARANTINE",
    from: finding.path,
    to: finding.destination,
    reason: finding.reason,
    reversible: true,
    dryRun
  };
}

function assertSafeAction(finding: MaintenanceFinding): void {
  if (finding.decision !== "ARCHIVE" && finding.decision !== "QUARANTINE") {
    throw new Error(`Unsafe maintenance decision cannot be applied: ${finding.decision}`);
  }
  if (finding.risk === "HIGH" || finding.risk === "CRITICAL" || finding.risk === "BLOCKED") {
    throw new Error(`High-risk maintenance finding cannot be applied: ${finding.relativePath}`);
  }
  if (!finding.destination) {
    throw new Error(`Safe maintenance finding has no destination: ${finding.relativePath}`);
  }
  if (finding.relativePath.includes(".git") || finding.relativePath.startsWith("memory/") || finding.relativePath.startsWith("policies/")) {
    throw new Error(`Protected path cannot be moved: ${finding.relativePath}`);
  }
}

export function applySafeMaintenancePlan(plan: MaintenancePlan, options: ApplyMaintenanceOptions | Date = {}): MaintenanceAction[] {
  const normalizedOptions: ApplyMaintenanceOptions = options instanceof Date ? {} : options;
  const only = parseOnly(normalizedOptions.only);
  const maxActions = normalizedOptions.maxActions ?? Number.POSITIVE_INFINITY;
  if (!Number.isFinite(maxActions) && maxActions !== Number.POSITIVE_INFINITY) {
    throw new Error("maxActions must be a positive number");
  }
  if (maxActions <= 0) {
    return [];
  }

  const actions: MaintenanceAction[] = [];
  const candidates = plan.findings
    .filter((finding) => matchesOnly(finding, only))
    .filter((finding) => finding.decision === "ARCHIVE" || finding.decision === "QUARANTINE")
    .slice(0, maxActions);

  for (const finding of candidates) {
    assertSafeAction(finding);
    const action = makeAction(plan, finding, !!normalizedOptions.dryRun);
    if (!normalizedOptions.dryRun) {
      ensureInsideWorkspace(plan.workspaceRoot, finding.path);
      ensureInsideWorkspace(plan.workspaceRoot, action.to);
      if (!fs.existsSync(finding.path)) {
        continue;
      }
      ensureDir(path.dirname(action.to));
      fs.renameSync(finding.path, action.to);
    }
    appendAction(plan.workspaceRoot, action);
    actions.push(action);
  }

  createReportsIndex(plan.workspaceRoot);
  return actions;
}

export function restoreMaintenanceAction(workspaceRoot: string, actionId: string): { from: string; to: string } {
  const root = path.resolve(workspaceRoot);
  const filePath = actionsLogPath(root);
  if (!fs.existsSync(filePath)) {
    throw new Error(`No maintenance actions log found at ${filePath}`);
  }

  const actions = fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as MaintenanceAction);
  const action = actions.find((candidate) => candidate.actionId === actionId);
  if (!action) {
    throw new Error(`Maintenance action not found: ${actionId}`);
  }
  if (action.dryRun) {
    throw new Error(`Cannot restore dry-run action: ${actionId}`);
  }

  ensureInsideWorkspace(root, action.from);
  ensureInsideWorkspace(root, action.to);
  if (!fs.existsSync(action.to)) {
    throw new Error(`Archived/quarantined path does not exist: ${action.to}`);
  }
  if (fs.existsSync(action.from)) {
    throw new Error(`Original path already exists, refusing overwrite: ${action.from}`);
  }

  ensureDir(path.dirname(action.from));
  fs.renameSync(action.to, action.from);
  createReportsIndex(root);
  return { from: action.to, to: action.from };
}

export function formatMaintenancePlan(plan: MaintenancePlan): string {
  const counts = new Map<MaintenanceDecision, number>();
  for (const finding of plan.findings) {
    counts.set(finding.decision, (counts.get(finding.decision) || 0) + 1);
  }
  const lines = [
    `Maintenance Trio ${plan.mode}`,
    `Workspace: ${plan.workspaceRoot}`,
    `Task: ${plan.taskId || "n/a"}`,
    `Total findings: ${plan.findings.length}`,
    `KEEP: ${counts.get("KEEP") || 0}`,
    `ARCHIVE: ${counts.get("ARCHIVE") || 0}`,
    `QUARANTINE: ${counts.get("QUARANTINE") || 0}`,
    `DELETE_BLOCKED: ${counts.get("DELETE_BLOCKED") || 0}`,
    `ESCALATE: ${counts.get("ESCALATE") || 0}`,
    `Protected manifest: ${plan.protectedManifestPath}`,
    `Reports index: ${plan.reportsIndexPath}`
  ];

  const escalations = plan.findings.filter((finding) => finding.decision === "ESCALATE");
  if (escalations.length > 0) {
    lines.push("", "Escalations:");
    for (const finding of escalations) {
      lines.push(`- ${finding.relativePath}: ${finding.reason}`);
    }
  }
  return lines.join("\n");
}
