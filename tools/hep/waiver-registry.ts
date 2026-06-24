/**
 * Hermes Execution Platform (HEP) вЂ” Waiver Registry
 *
 * Purpose:
 *   The Waiver Registry allows exceptional risky actions only under strict,
 *   auditable, time-limited, and scoped conditions.
 *
 * Core principles:
 *   - Human approval is NOT root access.
 *   - Owner approval is NOT a universal override.
 *   - A waiver is NOT a magic bypass.
 *   - A waiver is a NARROW, EXPIRING, AUDITABLE exception.
 *
 * Allowed waiver effects (v1):
 *   REQUIRE_PLAN в†’ ALLOW   for low/medium risk, non-destructive, valid waiver
 *   ESCALATE     в†’ REQUIRE_PLAN  for high risk, non-destructive, valid waiver
 *
 * Forbidden waiver effects (v1):
 *   DENY в†’ ALLOW                          (absolute)
 *   Critical/protected destructive DENY   (absolute)
 *   Guardian hard deny                    (absolute)
 *   Dependency outside-root deny          (absolute)
 *   Ownership forbidden-for-all           (absolute)
 *   Hazard critical active hard stop      (absolute)
 *
 * Rule precedence remains: DENY(4) > ESCALATE(3) > REQUIRE_PLAN(2) > DRY_RUN_ONLY(1) > ALLOW(0)
 */

import { existsSync, writeFileSync, readFileSync, appendFileSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

// в”Ђв”Ђв”Ђ Public types в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

export type WaiverStatus = "active" | "expired" | "revoked" | "used" | "rejected";

export type WaiverScopeType =
  | "asset"
  | "path"
  | "path_prefix"
  | "task"
  | "action"
  | "hazard"
  | "policy";

export type WaiverRiskLevel = "low" | "medium" | "high" | "critical";

export type WaiverReviewLevel = "none" | "owner" | "guardian" | "multi_reviewer";

export interface WaiverRecord {
  waiverId: string;
  taskId: string;
  status: WaiverStatus;
  actor: string;
  action: string;
  assetId?: string;
  target?: string;
  pathPrefix?: string;
  hazardId?: string;
  scopeType: WaiverScopeType;
  riskLevel: WaiverRiskLevel;
  reason: string;
  rollbackPlan?: string;
  rollbackRef?: string;
  expiresAt: string; // ISO 8601
  createdAt: string;
  updatedAt?: string;
  createdBy: string;
  approvedBy?: string;
  reviewLevel: WaiverReviewLevel;
  allowedActions?: string[];
  forbiddenActions?: string[];
  allowedTargets?: string[];
  notes?: string[];
  usedAt?: string;
  revokedAt?: string;
  revokeReason?: string;
}

/**
 * Signal produced by the Waiver layer for a given (taskId, actor, action, target, assetId) tuple.
 * Consumed by Decision Gateway and passed to Decision Policy.
 */
export interface WaiverSignal {
  taskId: string;
  actor: string;
  action: string;
  target?: string;
  assetId?: string;
  matched: boolean;
  waiverId?: string;
  status: WaiverStatus | "none";
  active: boolean;
  expired: boolean;
  revoked: boolean;
  scopeMatched: boolean;
  actionMatched: boolean;
  targetMatched: boolean;
  hazardMatched: boolean;
  rollbackPlanPresent: boolean;
  reviewerMatched: boolean;
  riskLevel?: WaiverRiskLevel;
  /** Whether this waiver CAN relax a non-DENY decision per v1 rules. */
  canRelaxDecision: boolean;
  /** Always false in v1 вЂ” waivers cannot bypass critical/protected destructive DENY. */
  canBypassCriticalDeny: boolean;
  reasons: string[];
  warnings: string[];
  matchedWaiverIds: string[];
}

// в”Ђв”Ђв”Ђ Schema в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

const SCHEMA_VERSION = 1;

const EXAMPLE_DISABLED_WAIVER: WaiverRecord = {
  waiverId: "example.disabled",
  taskId: "EXAMPLE",
  status: "revoked",
  actor: "example.actor",
  action: "inspect",
  scopeType: "action",
  riskLevel: "low",
  reason: "Example only вЂ” not active. See waiver-add to create real waivers.",
  expiresAt: "2020-01-01T00:00:00Z",
  createdAt: "2020-01-01T00:00:00Z",
  createdBy: "system",
  reviewLevel: "none",
  revokedAt: "2020-01-01T00:00:01Z",
  revokeReason: "Disabled example waiver вЂ” never active"
};

// в”Ђв”Ђв”Ђ I/O helpers в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

function waiverRegistryPath(workspaceRoot: string): string {
  return join(resolve(workspaceRoot), "memory", "waivers", "waiver-registry.json");
}

function waiverLedgerPath(workspaceRoot: string): string {
  return join(resolve(workspaceRoot), "logs", "waivers", "waiver-events.jsonl");
}

export function initializeWaiverRegistry(options: { workspaceRoot: string }): void {
  const registryPath = waiverRegistryPath(options.workspaceRoot);
  mkdirSync(dirname(registryPath), { recursive: true });

  const data = {
    schemaVersion: SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    waivers: [EXAMPLE_DISABLED_WAIVER]
  };
  writeFileSync(registryPath, JSON.stringify(data, null, 2) + "\n", "utf8");

  const ledgerPath = waiverLedgerPath(options.workspaceRoot);
  mkdirSync(dirname(ledgerPath), { recursive: true });
  if (!existsSync(ledgerPath)) {
    writeFileSync(ledgerPath, "", "utf8");
  }
}

export function loadWaiverRegistry(options: { workspaceRoot: string }): WaiverRecord[] {
  const registryPath = waiverRegistryPath(options.workspaceRoot);
  if (!existsSync(registryPath)) return [];
  try {
    const data = JSON.parse(readFileSync(registryPath, "utf8"));
    return data.waivers ?? [];
  } catch {
    return [];
  }
}

export function saveWaiverRegistry(options: { workspaceRoot: string; waivers: WaiverRecord[] }): void {
  const registryPath = waiverRegistryPath(options.workspaceRoot);
  mkdirSync(dirname(registryPath), { recursive: true });
  const existing = existsSync(registryPath)
    ? (() => { try { return JSON.parse(readFileSync(registryPath, "utf8")); } catch { return {}; } })()
    : {};
  const data = {
    schemaVersion: existing.schemaVersion ?? SCHEMA_VERSION,
    createdAt: existing.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    waivers: options.waivers
  };
  writeFileSync(registryPath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export function listWaivers(options: {
  workspaceRoot: string;
  status?: WaiverStatus;
  actor?: string;
  taskId?: string;
}): WaiverRecord[] {
  const waivers = loadWaiverRegistry({ workspaceRoot: options.workspaceRoot });
  return waivers.filter(w => {
    if (options.status && w.status !== options.status) return false;
    if (options.actor && w.actor !== options.actor) return false;
    if (options.taskId && w.taskId !== options.taskId) return false;
    return true;
  });
}

// в”Ђв”Ђв”Ђ Waiver validation в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

/** Maximum allowed TTL per risk level */
const MAX_TTL_MS: Record<WaiverRiskLevel, number> = {
  low: 7 * 24 * 60 * 60 * 1000,    // 7 days
  medium: 7 * 24 * 60 * 60 * 1000, // 7 days
  high: 24 * 60 * 60 * 1000,       // 24 hours
  critical: 0                        // Never allowed in v1
};

export interface WaiverAddOptions {
  workspaceRoot: string;
  taskId: string;
  actor: string;
  action: string;
  riskLevel: WaiverRiskLevel;
  reason: string;
  rollbackPlan?: string;
  rollbackRef?: string;
  expiresAt: string;
  createdBy: string;
  approvedBy?: string;
  reviewLevel: WaiverReviewLevel;
  scopeType?: WaiverScopeType;
  assetId?: string;
  target?: string;
  pathPrefix?: string;
  hazardId?: string;
  allowedActions?: string[];
  forbiddenActions?: string[];
  allowedTargets?: string[];
  notes?: string[];
}

function isDestructiveAction(action: string): boolean {
  return ["delete", "archive", "move", "rename", "quarantine", "destructive"].includes(action.toLowerCase());
}

export function validateWaiverAdd(options: WaiverAddOptions): string[] {
  const errors: string[] = [];

  if (!options.reason || options.reason.trim().length < 10) {
    errors.push("reason is required and must be at least 10 characters.");
  }
  if (!options.expiresAt) {
    errors.push("expiresAt is required.");
  } else {
    const expires = new Date(options.expiresAt);
    if (isNaN(expires.getTime())) {
      errors.push("expiresAt must be a valid ISO 8601 date.");
    } else {
      if (expires <= new Date()) {
        errors.push("expiresAt must be in the future.");
      }
      const ttl = expires.getTime() - Date.now();
      const maxTtl = MAX_TTL_MS[options.riskLevel];
      if (maxTtl === 0) {
        errors.push(`Waivers for riskLevel '${options.riskLevel}' are not allowed in v1.`);
      } else if (ttl > maxTtl) {
        const maxHours = Math.round(maxTtl / 3600000);
        errors.push(`expiresAt exceeds maximum TTL for ${options.riskLevel} risk (max ${maxHours}h).`);
      }
    }
  }

  if (["medium", "high", "critical"].includes(options.riskLevel)) {
    if (!options.rollbackPlan || options.rollbackPlan.trim().length < 5) {
      errors.push(`rollbackPlan is required for riskLevel '${options.riskLevel}' (min 5 chars).`);
    }
  }

  if (options.riskLevel === "critical") {
    errors.push("Critical-risk waivers are not allowed in v1. Destructive critical actions must remain DENY.");
  }

  return errors;
}

export function addOrUpdateWaiver(options: WaiverAddOptions): WaiverRecord {
  const errors = validateWaiverAdd(options);
  if (errors.length > 0) {
    throw new Error(`Waiver validation failed:\n${errors.map(e => `  - ${e}`).join("\n")}`);
  }

  const waivers = loadWaiverRegistry({ workspaceRoot: options.workspaceRoot });

  const now = new Date().toISOString();
  const waiverId = `waiver.${options.taskId.toLowerCase().replace(/[^a-z0-9]/g, "-")}.${options.actor.toLowerCase().replace(/[^a-z0-9]/g, "-")}.${options.action}.${Date.now()}`;

  const scopeType: WaiverScopeType = options.scopeType ?? (
    options.assetId ? "asset" :
    options.pathPrefix ? "path_prefix" :
    options.target ? "path" :
    options.hazardId ? "hazard" :
    "action"
  );

  const record: WaiverRecord = {
    waiverId,
    taskId: options.taskId,
    status: "active",
    actor: options.actor,
    action: options.action,
    assetId: options.assetId,
    target: options.target,
    pathPrefix: options.pathPrefix,
    hazardId: options.hazardId,
    scopeType,
    riskLevel: options.riskLevel,
    reason: options.reason.trim(),
    rollbackPlan: options.rollbackPlan?.trim(),
    rollbackRef: options.rollbackRef?.trim(),
    expiresAt: options.expiresAt,
    createdAt: now,
    updatedAt: now,
    createdBy: options.createdBy,
    approvedBy: options.approvedBy,
    reviewLevel: options.reviewLevel,
    allowedActions: options.allowedActions,
    forbiddenActions: options.forbiddenActions,
    allowedTargets: options.allowedTargets,
    notes: options.notes
  };

  waivers.push(record);
  saveWaiverRegistry({ workspaceRoot: options.workspaceRoot, waivers });

  writeWaiverEvent({
    workspaceRoot: options.workspaceRoot,
    event: {
      type: "WAIVER_ADDED",
      waiverId: record.waiverId,
      taskId: record.taskId,
      actor: record.actor,
      action: record.action,
      assetId: record.assetId,
      riskLevel: record.riskLevel,
      expiresAt: record.expiresAt,
      createdBy: record.createdBy
    }
  });

  return record;
}

export function revokeWaiver(options: {
  workspaceRoot: string;
  waiverId: string;
  reason: string;
  revokedBy?: string;
}): WaiverRecord {
  const waivers = loadWaiverRegistry({ workspaceRoot: options.workspaceRoot });
  const index = waivers.findIndex(w => w.waiverId === options.waiverId);
  if (index < 0) {
    throw new Error(`Waiver not found: ${options.waiverId}`);
  }
  const now = new Date().toISOString();
  waivers[index] = {
    ...waivers[index],
    status: "revoked",
    revokedAt: now,
    revokeReason: options.reason,
    updatedAt: now
  };
  saveWaiverRegistry({ workspaceRoot: options.workspaceRoot, waivers });

  writeWaiverEvent({
    workspaceRoot: options.workspaceRoot,
    event: {
      type: "WAIVER_REVOKED",
      waiverId: options.waiverId,
      revokeReason: options.reason,
      revokedBy: options.revokedBy
    }
  });

  return waivers[index];
}

export function markWaiverUsed(options: {
  workspaceRoot: string;
  waiverId: string;
}): WaiverRecord {
  const waivers = loadWaiverRegistry({ workspaceRoot: options.workspaceRoot });
  const index = waivers.findIndex(w => w.waiverId === options.waiverId);
  if (index < 0) {
    throw new Error(`Waiver not found: ${options.waiverId}`);
  }
  const now = new Date().toISOString();
  waivers[index] = {
    ...waivers[index],
    status: "used",
    usedAt: now,
    updatedAt: now
  };
  saveWaiverRegistry({ workspaceRoot: options.workspaceRoot, waivers });

  writeWaiverEvent({
    workspaceRoot: options.workspaceRoot,
    event: {
      type: "WAIVER_USED",
      waiverId: options.waiverId,
      usedAt: now
    }
  });

  return waivers[index];
}

export function writeWaiverEvent(options: { workspaceRoot: string; event: Record<string, unknown> }): void {
  const ledgerPath = waiverLedgerPath(options.workspaceRoot);
  mkdirSync(dirname(ledgerPath), { recursive: true });
  const entry = { timestamp: new Date().toISOString(), ...options.event };
  appendFileSync(ledgerPath, `${JSON.stringify(entry)}\n`, "utf8");
}

// в”Ђв”Ђв”Ђ Core match logic в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

function isWaiverActive(waiver: WaiverRecord): boolean {
  if (waiver.status !== "active") return false;
  const now = new Date();
  const expires = new Date(waiver.expiresAt);
  return expires > now;
}

function matchesScope(waiver: WaiverRecord, options: {
  taskId: string;
  actor: string;
  action: string;
  target?: string;
  assetId?: string;
}): { scopeMatched: boolean; actionMatched: boolean; targetMatched: boolean; hazardMatched: boolean } {
  // taskId must always match
  if (waiver.taskId !== options.taskId) {
    return { scopeMatched: false, actionMatched: false, targetMatched: false, hazardMatched: false };
  }
  // actor must match
  if (waiver.actor !== options.actor) {
    return { scopeMatched: false, actionMatched: false, targetMatched: false, hazardMatched: false };
  }

  // action match: direct action, or allowedActions list
  const actionMatched =
    waiver.action === options.action ||
    (Array.isArray(waiver.allowedActions) && waiver.allowedActions.includes(options.action));

  // scope match
  let scopeMatched = false;
  if (waiver.scopeType === "asset" && waiver.assetId && options.assetId) {
    scopeMatched = waiver.assetId === options.assetId;
  } else if (waiver.scopeType === "path" && waiver.target && options.target) {
    scopeMatched = waiver.target === options.target;
  } else if (waiver.scopeType === "path_prefix" && waiver.pathPrefix && options.target) {
    const norm = options.target.replaceAll("\\", "/");
    scopeMatched = norm.startsWith(waiver.pathPrefix.replaceAll("\\", "/"));
  } else if (waiver.scopeType === "task") {
    scopeMatched = waiver.taskId === options.taskId;
  } else if (waiver.scopeType === "action") {
    scopeMatched = actionMatched; // scope is the action itself
  } else if (waiver.scopeType === "hazard" && waiver.hazardId) {
    // hazard scope вЂ” will be further matched later if hazardId is provided
    scopeMatched = true;
  }

  // target match (for allowedTargets list)
  let targetMatched = !waiver.allowedTargets || waiver.allowedTargets.length === 0;
  if (waiver.allowedTargets && options.target) {
    targetMatched = waiver.allowedTargets.some(t =>
      t === options.target ||
      options.target!.replaceAll("\\", "/").startsWith(t.replaceAll("\\", "/"))
    );
  }

  // hazard match (waiver scoped to a specific hazard)
  const hazardMatched = !waiver.hazardId; // if no hazard constraint, trivially matched

  return { scopeMatched, actionMatched, targetMatched, hazardMatched };
}

export function findMatchingWaivers(options: {
  workspaceRoot: string;
  taskId: string;
  actor: string;
  action: string;
  target?: string;
  assetId?: string;
}): WaiverRecord[] {
  const waivers = loadWaiverRegistry({ workspaceRoot: options.workspaceRoot });
  return waivers.filter(w => {
    if (!isWaiverActive(w)) return false;
    const { scopeMatched, actionMatched } = matchesScope(w, options);
    return scopeMatched && actionMatched;
  });
}

/**
 * Evaluate the waiver signal for a given request.
 *
 * Conservative design:
 *   - Missing registry в†’ warning, not crash
 *   - Multiple matches в†’ pick lowest risk active waiver
 *   - canBypassCriticalDeny is always false in v1
 */
export function evaluateWaiver(options: {
  workspaceRoot: string;
  taskId: string;
  actor: string;
  action: string;
  target?: string;
  assetId?: string;
}): WaiverSignal {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const matchedWaiverIds: string[] = [];

  const registryPath = waiverRegistryPath(options.workspaceRoot);
  if (!existsSync(registryPath)) {
    warnings.push("Waiver Registry is missing or not initialized. Run waiver-init to create it.");
    return {
      taskId: options.taskId,
      actor: options.actor,
      action: options.action,
      target: options.target,
      assetId: options.assetId,
      matched: false,
      status: "none",
      active: false,
      expired: false,
      revoked: false,
      scopeMatched: false,
      actionMatched: false,
      targetMatched: false,
      hazardMatched: false,
      rollbackPlanPresent: false,
      reviewerMatched: false,
      canRelaxDecision: false,
      canBypassCriticalDeny: false,
      reasons,
      warnings,
      matchedWaiverIds
    };
  }

  let allWaivers: WaiverRecord[] = [];
  try {
    allWaivers = loadWaiverRegistry({ workspaceRoot: options.workspaceRoot });
  } catch (err) {
    warnings.push(`Waiver Registry could not be read: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Find all waivers for this task+actor+action (regardless of status, to check expired/revoked)
  const candidateWaivers = allWaivers.filter(w => {
    if (w.taskId !== options.taskId) return false;
    if (w.actor !== options.actor) return false;
    const { actionMatched, scopeMatched } = matchesScope(w, options);
    return actionMatched && scopeMatched;
  });

  // Separate active from expired/revoked
  const activeMatches = candidateWaivers.filter(w => isWaiverActive(w));
  const expiredMatches = candidateWaivers.filter(w => w.status === "expired" || (w.status === "active" && new Date(w.expiresAt) <= new Date()));
  const revokedMatches = candidateWaivers.filter(w => w.status === "revoked");

  if (activeMatches.length === 0 && candidateWaivers.length === 0) {
    warnings.push(`No matching waiver found for actor '${options.actor}' action '${options.action}' task '${options.taskId}'.`);
    return {
      taskId: options.taskId,
      actor: options.actor,
      action: options.action,
      target: options.target,
      assetId: options.assetId,
      matched: false,
      status: "none",
      active: false,
      expired: false,
      revoked: false,
      scopeMatched: false,
      actionMatched: false,
      targetMatched: false,
      hazardMatched: false,
      rollbackPlanPresent: false,
      reviewerMatched: false,
      canRelaxDecision: false,
      canBypassCriticalDeny: false,
      reasons,
      warnings,
      matchedWaiverIds
    };
  }

  // Best match: pick first active waiver (lowest risk level preferred)
  const riskOrder: WaiverRiskLevel[] = ["low", "medium", "high", "critical"];
  activeMatches.sort((a, b) => riskOrder.indexOf(a.riskLevel) - riskOrder.indexOf(b.riskLevel));

  const waiver = activeMatches[0];
  const expired = activeMatches.length === 0 && expiredMatches.length > 0;
  const revoked = activeMatches.length === 0 && revokedMatches.length > 0 && !expired;

  if (!waiver) {
    // Only expired or revoked matches
    if (expired) {
      reasons.push(`Matching waiver found but it has expired. Request a new waiver.`);
    } else if (revoked) {
      reasons.push(`Matching waiver found but it has been revoked.`);
    }
    return {
      taskId: options.taskId,
      actor: options.actor,
      action: options.action,
      target: options.target,
      assetId: options.assetId,
      matched: true,
      waiverId: expiredMatches[0]?.waiverId ?? revokedMatches[0]?.waiverId,
      status: expired ? "expired" : "revoked",
      active: false,
      expired,
      revoked: !expired && revoked,
      scopeMatched: true,
      actionMatched: true,
      targetMatched: false,
      hazardMatched: false,
      rollbackPlanPresent: false,
      reviewerMatched: false,
      canRelaxDecision: false,
      canBypassCriticalDeny: false,
      reasons,
      warnings,
      matchedWaiverIds: [...expiredMatches.map(w => w.waiverId), ...revokedMatches.map(w => w.waiverId)],
      riskLevel: expiredMatches[0]?.riskLevel ?? revokedMatches[0]?.riskLevel
    };
  }

  for (const m of activeMatches) matchedWaiverIds.push(m.waiverId);

  const { scopeMatched, actionMatched, targetMatched, hazardMatched } = matchesScope(waiver, options);

  // Check rollback plan
  const rollbackPlanPresent = !!(waiver.rollbackPlan && waiver.rollbackPlan.trim().length > 0);
  if (!rollbackPlanPresent && ["medium", "high", "critical"].includes(waiver.riskLevel)) {
    reasons.push(`Waiver '${waiver.waiverId}' has ${waiver.riskLevel} risk but no rollback plan. Waiver is non-functional.`);
  }

  // Check reviewer
  const reviewerMatched = waiver.reviewLevel !== "none" && !!(waiver.approvedBy);
  if (!reviewerMatched && waiver.reviewLevel !== "none") {
    reasons.push(`Waiver '${waiver.waiverId}' requires ${waiver.reviewLevel} review but has no approvedBy.`);
  }

  // Check forbiddenActions
  if (waiver.forbiddenActions && waiver.forbiddenActions.includes(options.action)) {
    reasons.push(`Waiver '${waiver.waiverId}' explicitly forbids action '${options.action}'.`);
  }

  // Determine if waiver CAN relax decision
  // Conditions for canRelaxDecision:
  //   1. Waiver is active
  //   2. Risk is low/medium/high (not critical)
  //   3. Rollback plan present (required for medium/high)
  //   4. Reviewer matched (if required)
  //   5. Action is NOT forbidden by the waiver
  //   6. Action is NOT destructive for critical/protected (always false)
  const destructive = isDestructiveAction(options.action);
  const hasForbiddenAction = waiver.forbiddenActions?.includes(options.action) ?? false;
  const rollbackOk = waiver.riskLevel === "low" || rollbackPlanPresent;
  const reviewOk = waiver.reviewLevel === "none" || reviewerMatched;

  const canRelaxDecision =
    waiver.riskLevel !== "critical" &&
    rollbackOk &&
    reviewOk &&
    !hasForbiddenAction &&
    reasons.length === 0;

  // Warn for destructive actions вЂ” canRelaxDecision may be true but Policy will still apply DENY rules
  if (destructive && canRelaxDecision) {
    warnings.push(`Waiver '${waiver.waiverId}' matches a destructive action '${options.action}'. Policy DENY rules still apply вЂ” waiver cannot bypass DENY.`);
  }

  return {
    taskId: options.taskId,
    actor: options.actor,
    action: options.action,
    target: options.target,
    assetId: options.assetId,
    matched: true,
    waiverId: waiver.waiverId,
    status: waiver.status,
    active: true,
    expired: false,
    revoked: false,
    scopeMatched,
    actionMatched,
    targetMatched,
    hazardMatched,
    rollbackPlanPresent,
    reviewerMatched,
    canRelaxDecision,
    canBypassCriticalDeny: false, // ALWAYS false in v1
    reasons,
    warnings,
    matchedWaiverIds,
    riskLevel: waiver.riskLevel
  };
}

// в”Ђв”Ђв”Ђ Formatting в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

export function formatWaiverCheck(signal: WaiverSignal): string {
  const lines = [
    "Waiver Check Result:",
    `- Task ID: ${signal.taskId}`,
    `- Actor: ${signal.actor}`,
    `- Action: ${signal.action}`,
    `- Target: ${signal.target || "n/a"}`,
    `- Asset ID: ${signal.assetId || "n/a"}`,
    `- Matched: ${signal.matched}`,
    `- Waiver ID: ${signal.waiverId || "n/a"}`,
    `- Status: ${signal.status}`,
    `- Active: ${signal.active}`,
    `- Expired: ${signal.expired}`,
    `- Revoked: ${signal.revoked}`,
    `- Scope Matched: ${signal.scopeMatched}`,
    `- Action Matched: ${signal.actionMatched}`,
    `- Target Matched: ${signal.targetMatched}`,
    `- Rollback Plan Present: ${signal.rollbackPlanPresent}`,
    `- Reviewer Matched: ${signal.reviewerMatched}`,
    `- Can Relax Decision: ${signal.canRelaxDecision}`,
    `- Can Bypass Critical Deny: ${signal.canBypassCriticalDeny}`
  ];
  if (signal.matchedWaiverIds.length > 0) {
    lines.push(`- Matched Waiver IDs: ${signal.matchedWaiverIds.join(", ")}`);
  }
  if (signal.reasons.length > 0) {
    lines.push("- Reasons:");
    signal.reasons.forEach(r => lines.push(`  * ${r}`));
  }
  if (signal.warnings.length > 0) {
    lines.push("- Warnings:");
    signal.warnings.forEach(w => lines.push(`  * ${w}`));
  }
  return lines.join("\n");
}
