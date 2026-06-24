import { existsSync, writeFileSync, readFileSync, appendFileSync, mkdirSync } from "node:fs";
import { join, dirname, isAbsolute, resolve } from "node:path";
import { resolveDependencyTarget } from "./dependency-guard.ts";

export type AssetType =
  | "hep_tooling"
  | "runtime_memory"
  | "runtime_log"
  | "report"
  | "registry"
  | "worktree"
  | "project_root"
  | "user_data"
  | "media_archive"
  | "host_storage"
  | "unknown";

export type AssetCriticality = "low" | "medium" | "high" | "critical";

export type AssetLifecycle =
  | "active"
  | "protected"
  | "archive_candidate"
  | "archived"
  | "deprecated"
  | "unknown";

export interface AssetRecord {
  assetId: string;
  path: string;
  type: AssetType;
  owner?: string;
  criticality: AssetCriticality;
  lifecycle: AssetLifecycle;
  allowedActions?: string[];
  forbiddenActions?: string[];
  requiresPlanFor?: string[];
  tags?: string[];
  notes?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface AssetSignal {
  target: string;
  normalizedTarget: string;
  assetId?: string;
  matched: boolean;
  exists: boolean;
  type: AssetType;
  owner?: string;
  criticality: AssetCriticality;
  lifecycle: AssetLifecycle;
  actionAllowed: boolean;
  actionForbidden: boolean;
  requiresPlan: boolean;
  reasons: string[];
  warnings: string[];
}

const SEED_ASSETS: AssetRecord[] = [
  {
    assetId: "hep.project.codex-test",
    path: "codex-test",
    type: "project_root",
    criticality: "high",
    lifecycle: "active",
    owner: "Hermes HEP"
  },
  {
    assetId: "hep.cli.index",
    path: "codex-test/tools/hep/index.ts",
    type: "hep_tooling",
    criticality: "high",
    lifecycle: "active",
    owner: "Hermes HEP"
  },
  {
    assetId: "hep.decision.gateway",
    path: "codex-test/tools/hep/decision-gateway.ts",
    type: "hep_tooling",
    criticality: "high",
    lifecycle: "active"
  },
  {
    assetId: "hep.decision.policy",
    path: "codex-test/tools/hep/decision-policy.ts",
    type: "hep_tooling",
    criticality: "high",
    lifecycle: "active"
  },
  {
    assetId: "hep.dependency.guard",
    path: "codex-test/tools/hep/dependency-guard.ts",
    type: "hep_tooling",
    criticality: "high",
    lifecycle: "active"
  },
  {
    assetId: "hep.guardian.acl",
    path: "codex-test/tools/hep/guardian-acl.ts",
    type: "hep_tooling",
    criticality: "high",
    lifecycle: "active"
  },
  {
    assetId: "hep.hazard.registry.module",
    path: "codex-test/tools/hep/hazard-registry.ts",
    type: "hep_tooling",
    criticality: "high",
    lifecycle: "active"
  },
  {
    assetId: "hep.asset.registry.module",
    path: "codex-test/tools/hep/asset-registry.ts",
    type: "hep_tooling",
    criticality: "high",
    lifecycle: "active"
  },
  {
    assetId: "runtime.hazards",
    path: "memory/hazards/hazards.json",
    type: "runtime_memory",
    criticality: "high",
    lifecycle: "active"
  },
  {
    assetId: "runtime.events",
    path: "logs/events/hermes-events.jsonl",
    type: "runtime_log",
    criticality: "medium",
    lifecycle: "active"
  },
  {
    assetId: "runtime.decisions",
    path: "logs/decisions/decision-events.jsonl",
    type: "runtime_log",
    criticality: "medium",
    lifecycle: "active"
  },
  {
    assetId: "runtime.assets",
    path: "memory/assets/asset-registry.json",
    type: "registry",
    criticality: "high",
    lifecycle: "active"
  },
  {
    assetId: "reports.active",
    path: "reports/active",
    type: "report",
    criticality: "medium",
    lifecycle: "active"
  },
  {
    assetId: "reports.index",
    path: "reports/indexes/report-index.json",
    type: "registry",
    criticality: "medium",
    lifecycle: "active"
  },
  {
    assetId: "host.media_rescue",
    path: "D:\\MEDIA_RESCUE_FROM_TOSHIBA",
    type: "media_archive",
    criticality: "critical",
    lifecycle: "protected",
    owner: "Nick",
    forbiddenActions: ["delete", "archive", "move", "rename"],
    notes: ["protected personal media archive rescued from Toshiba HDD"]
  },
  {
    assetId: "worktree.event_log_old",
    path: "hermes-event-log-001-work",
    type: "worktree",
    criticality: "medium",
    lifecycle: "archive_candidate",
    requiresPlanFor: ["archive", "move", "delete"]
  }
];

function isInside(parent: string, child: string): boolean {
  const p = resolve(parent).toLowerCase().replaceAll("\\", "/");
  const c = resolve(child).toLowerCase().replaceAll("\\", "/");
  return c === p || c.startsWith(p.endsWith("/") ? p : p + "/");
}


function pathsEqual(p1: string, p2: string): boolean {
  return resolve(p1).toLowerCase().replaceAll("\\", "/") === resolve(p2).toLowerCase().replaceAll("\\", "/");
}

function isDestructiveAction(action: string): boolean {
  return ["delete", "archive", "move", "rename", "quarantine", "destructive"].includes(action.toLowerCase());
}

export function initializeAssetRegistry(options: { workspaceRoot: string }): void {
  const registryPath = join(resolve(options.workspaceRoot), "memory", "assets", "asset-registry.json");
  mkdirSync(dirname(registryPath), { recursive: true });
  
  const initialData = {
    generatedAt: new Date().toISOString(),
    assets: SEED_ASSETS
  };
  
  writeFileSync(registryPath, JSON.stringify(initialData, null, 2) + "\n", "utf8");
  
  const ledgerPath = join(resolve(options.workspaceRoot), "logs", "assets", "asset-events.jsonl");
  mkdirSync(dirname(ledgerPath), { recursive: true });
  if (!existsSync(ledgerPath)) {
    writeFileSync(ledgerPath, "", "utf8");
  }
}

export function loadAssetRegistry(options: { workspaceRoot: string }): AssetRecord[] {
  const registryPath = join(resolve(options.workspaceRoot), "memory", "assets", "asset-registry.json");
  if (!existsSync(registryPath)) {
    return [];
  }
  try {
    const data = JSON.parse(readFileSync(registryPath, "utf8"));
    return data.assets ?? [];
  } catch {
    return [];
  }
}

export function saveAssetRegistry(options: { workspaceRoot: string; assets: AssetRecord[] }): void {
  const registryPath = join(resolve(options.workspaceRoot), "memory", "assets", "asset-registry.json");
  mkdirSync(dirname(registryPath), { recursive: true });
  const data = {
    generatedAt: new Date().toISOString(),
    assets: options.assets
  };
  writeFileSync(registryPath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export function listAssets(options: {
  workspaceRoot: string;
  type?: AssetType;
  criticality?: AssetCriticality;
}): AssetRecord[] {
  const assets = loadAssetRegistry({ workspaceRoot: options.workspaceRoot });
  return assets.filter(asset => {
    if (options.type && asset.type !== options.type) return false;
    if (options.criticality && asset.criticality !== options.criticality) return false;
    return true;
  });
}

export function findAssetForTarget(options: {
  workspaceRoot: string;
  repositoryPath?: string;
  target: string;
}): AssetRecord | undefined {
  const { workspaceRoot, repositoryPath, target } = options;
  const resolvedTarget = resolveDependencyTarget(workspaceRoot, target, { projectPath: repositoryPath, repositoryPath });
  const targetAbs = resolvedTarget.absolutePath;
  
  const assets = loadAssetRegistry({ workspaceRoot });
  
  const matches = assets.filter(asset => {
    const assetAbs = isAbsolute(asset.path) ? resolve(asset.path) : resolve(workspaceRoot, asset.path);
    if (asset.type === "project_root") {
      return pathsEqual(assetAbs, targetAbs);
    }
    return isInside(assetAbs, targetAbs);
  });
  
  if (matches.length === 0) return undefined;
  
  matches.sort((a, b) => {
    const aAbs = isAbsolute(a.path) ? resolve(a.path) : resolve(workspaceRoot, a.path);
    const bAbs = isAbsolute(b.path) ? resolve(b.path) : resolve(workspaceRoot, b.path);
    return bAbs.length - aAbs.length;
  });
  
  return matches[0];
}

export function checkAssetAction(options: {
  workspaceRoot: string;
  repositoryPath?: string;
  target: string;
  action: string;
}): AssetSignal {
  const { workspaceRoot, repositoryPath, target, action } = options;
  const resolvedTarget = resolveDependencyTarget(workspaceRoot, target, { projectPath: repositoryPath, repositoryPath });
  const normalizedTarget = resolvedTarget.relativePath;
  
  const registryPath = join(resolve(workspaceRoot), "memory", "assets", "asset-registry.json");
  const registryExists = existsSync(registryPath);
  
  const reasons: string[] = [];
  const warnings: string[] = [];
  
  if (!registryExists) {
    warnings.push("Asset Registry is missing or not initialized.");
  }
  
  const exists = existsSync(resolvedTarget.absolutePath);
  const matchedAsset = registryExists ? findAssetForTarget({ workspaceRoot, repositoryPath, target }) : undefined;
  const matched = matchedAsset !== undefined;
  
  let pathAllowed = resolvedTarget.allowed;
  const targetAbs = resolvedTarget.absolutePath;
  
  if (matchedAsset) {
    const assetAbs = isAbsolute(matchedAsset.path) ? resolve(matchedAsset.path) : resolve(workspaceRoot, matchedAsset.path);
    if (isInside(assetAbs, targetAbs)) {
      pathAllowed = true;
    }
  }
  
  let actionAllowed = true;
  let actionForbidden = false;
  let requiresPlan = false;
  
  if (!pathAllowed) {
    actionAllowed = false;
    actionForbidden = true;
    reasons.push(`Target path contract violation: ${resolvedTarget.violation || "outside allowed roots"}`);
  } else if (matchedAsset) {
    if (matchedAsset.forbiddenActions && matchedAsset.forbiddenActions.includes(action)) {
      actionForbidden = true;
      reasons.push(`Action '${action}' is explicitly forbidden for asset '${matchedAsset.assetId}'`);
    }
    
    const isDestructive = isDestructiveAction(action);
    if (isDestructive && (matchedAsset.criticality === "critical" || matchedAsset.lifecycle === "protected")) {
      actionForbidden = true;
      reasons.push(`Destructive action '${action}' is forbidden on critical/protected asset '${matchedAsset.assetId}'`);
    }
    
    if (matchedAsset.allowedActions) {
      if (!matchedAsset.allowedActions.includes(action) && !actionForbidden) {
        actionAllowed = false;
        reasons.push(`Action '${action}' is not in allowed actions for asset '${matchedAsset.assetId}'`);
      }
    }
    
    if (actionForbidden) {
      actionAllowed = false;
    }
    
    if (matchedAsset.requiresPlanFor && matchedAsset.requiresPlanFor.includes(action)) {
      requiresPlan = true;
    }
    if (matchedAsset.criticality === "high" && ["move", "rename", "archive"].includes(action)) {
      requiresPlan = true;
    }
    if (matchedAsset.lifecycle === "archive_candidate" && ["archive", "move", "delete"].includes(action)) {
      requiresPlan = true;
    }
  } else {
    const isDestructive = isDestructiveAction(action);
    if (isDestructive) {
      requiresPlan = true;
    }
  }
  
  return {
    target,
    normalizedTarget,
    assetId: matchedAsset?.assetId,
    matched,
    exists,
    type: matchedAsset?.type ?? "unknown",
    owner: matchedAsset?.owner,
    criticality: matchedAsset?.criticality ?? "low",
    lifecycle: matchedAsset?.lifecycle ?? "unknown",
    actionAllowed,
    actionForbidden,
    requiresPlan,
    reasons,
    warnings
  };
}

export function addOrUpdateAsset(options: { workspaceRoot: string; asset: AssetRecord }): void {
  const { workspaceRoot, asset } = options;
  const assets = loadAssetRegistry({ workspaceRoot });
  const index = assets.findIndex(a => a.assetId === asset.assetId);
  if (index >= 0) {
    assets[index] = {
      ...assets[index],
      ...asset,
      updatedAt: new Date().toISOString()
    };
  } else {
    assets.push({
      ...asset,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
  saveAssetRegistry({ workspaceRoot, assets });
}

export function writeAssetEvent(options: { workspaceRoot: string; event: Record<string, unknown> }): void {
  const { workspaceRoot, event } = options;
  const ledgerPath = join(resolve(workspaceRoot), "logs", "assets", "asset-events.jsonl");
  mkdirSync(dirname(ledgerPath), { recursive: true });
  const entry = {
    timestamp: new Date().toISOString(),
    ...event
  };
  appendFileSync(ledgerPath, `${JSON.stringify(entry)}\n`, "utf8");
}

export function formatAssetCheck(result: AssetSignal): string {
  const lines = [
    `Asset Check Result:`,
    `- Target: ${result.target}`,
    `- Normalized Target: ${result.normalizedTarget}`,
    `- Asset ID: ${result.assetId || "n/a"}`,
    `- Matched: ${result.matched}`,
    `- Exists on disk: ${result.exists}`,
    `- Type: ${result.type}`,
    `- Owner: ${result.owner || "n/a"}`,
    `- Criticality: ${result.criticality}`,
    `- Lifecycle: ${result.lifecycle}`,
    `- Action Allowed: ${result.actionAllowed}`,
    `- Action Forbidden: ${result.actionForbidden}`,
    `- Requires Plan: ${result.requiresPlan}`
  ];
  if (result.reasons.length > 0) {
    lines.push(`- Reasons:`);
    result.reasons.forEach(r => lines.push(`  * ${r}`));
  }
  if (result.warnings.length > 0) {
    lines.push(`- Warnings:`);
    result.warnings.forEach(w => lines.push(`  * ${w}`));
  }
  return lines.join("\n");
}
