/**
 * Hermes Execution Platform (HEP) — Asset Ownership Layer
 *
 * Purpose:
 *   Asset Registry = what the asset is (criticality, type, lifecycle).
 *   Asset Ownership = who is responsible for it, who may approve changes,
 *                     who may only inspect, and what kind of action requires
 *                     explicit owner review.
 *
 * Design contract:
 *   - Ownership can add checks and require more review.
 *   - Ownership CANNOT downgrade DENY to ALLOW or ESCALATE.
 *   - Critical/protected destructive actions remain DENY regardless of ownership.
 *   - Human/owner approval is NOT root access.
 *
 * Rule precedence (same as Decision Policy):
 *   DENY(4) > ESCALATE(3) > REQUIRE_PLAN(2) > DRY_RUN_ONLY(1) > ALLOW(0)
 */

import { existsSync, writeFileSync, readFileSync, appendFileSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

// ─── Public types ─────────────────────────────────────────────────────────────

export type OwnershipRole =
  | "owner"           // Full decision rights, but cannot override DENY
  | "approver"        // Can approve plan-level actions; cannot override DENY
  | "inspector"       // Read-only; no write privileges
  | "maintainer"      // Scheduled maintenance only; no destructive actions
  | "guardian";       // Security/zone guardian; DENY on critical destructive

export type OwnershipScope =
  | "exclusive"       // Single actor owns this asset
  | "shared"          // Multiple actors share ownership
  | "delegated"       // Ownership delegated from parent
  | "unowned";        // No known owner

export interface OwnershipEntry {
  /** Unique ID linking back to AssetRecord.assetId */
  assetId: string;
  /** Display name of the primary owner actor */
  owner: string;
  /** Ownership role of the primary owner */
  role: OwnershipRole;
  /** Ownership scope */
  scope: OwnershipScope;
  /** Additional actors with specific roles (e.g. secondary approvers) */
  delegates?: OwnershipDelegate[];
  /** Actions that the primary owner may approve for other actors */
  ownerMayApprove?: string[];
  /** Actions that are forbidden for ALL actors regardless of role */
  forbiddenForAll?: string[];
  /** Actions that require explicit owner review before execution */
  requiresOwnerReview?: string[];
  /** Free-text notes */
  notes?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface OwnershipDelegate {
  actor: string;
  role: OwnershipRole;
  /** If set, this delegate's rights are limited to these actions only */
  limitedTo?: string[];
}

/**
 * Signal produced by the Ownership layer for a given (actor, action, target) tuple.
 * Consumed by Decision Gateway and passed to Decision Policy as an opaque signal.
 */
export interface OwnershipSignal {
  /** The asset ID looked up from the registry (if matched) */
  assetId?: string;
  /** Whether an ownership entry was found */
  matched: boolean;
  /** Primary owner actor */
  owner?: string;
  /** Primary owner role */
  role?: OwnershipRole;
  /** Ownership scope */
  scope?: OwnershipScope;
  /** Is the requesting actor the owner? */
  isOwner: boolean;
  /** Is the requesting actor a delegate? */
  isDelegate: boolean;
  /** If delegate, what is their role? */
  delegateRole?: OwnershipRole;
  /** Is the action forbidden for all actors? */
  actionForbiddenForAll: boolean;
  /** Does this action require owner review? */
  requiresOwnerReview: boolean;
  /** Is the requesting actor authorized (owner or approved delegate)? */
  actorAuthorized: boolean;
  /** Ownership scope (passed through for Policy) */
  isUnowned: boolean;
  reasons: string[];
  warnings: string[];
}

// ─── Seed ownership data ─────────────────────────────────────────────────────

const SEED_OWNERSHIP: OwnershipEntry[] = [
  // Nick owns the personal media archive — no one else may approve destructive actions
  {
    assetId: "host.media_rescue",
    owner: "Nick",
    role: "owner",
    scope: "exclusive",
    ownerMayApprove: ["read", "inspect", "scan"],
    forbiddenForAll: ["delete", "archive", "move", "rename"],
    requiresOwnerReview: ["move", "archive", "rename", "delete"],
    notes: ["Personal media archive rescued from Toshiba HDD. Destructive actions forbidden for all actors."]
  },
  // Hermes HEP owns the project root (HEP tooling)
  {
    assetId: "hep.project.codex-test",
    owner: "Hermes HEP",
    role: "owner",
    scope: "shared",
    delegates: [
      { actor: "Nick", role: "approver" },
      { actor: "guardian", role: "guardian" }
    ],
    ownerMayApprove: ["read", "inspect", "edit", "archive", "move"],
    requiresOwnerReview: ["delete", "rename"],
    notes: ["Root project directory. Major structural changes require owner review."]
  },
  // Hermes HEP owns the CLI entry point
  {
    assetId: "hep.cli.index",
    owner: "Hermes HEP",
    role: "owner",
    scope: "exclusive",
    delegates: [
      { actor: "Nick", role: "approver" }
    ],
    ownerMayApprove: ["read", "inspect", "edit"],
    requiresOwnerReview: ["delete", "move", "rename", "archive"],
    notes: ["HEP CLI entry point. Structural changes require approval."]
  },
  // Hermes HEP owns Decision Gateway
  {
    assetId: "hep.decision.gateway",
    owner: "Hermes HEP",
    role: "owner",
    scope: "exclusive",
    delegates: [
      { actor: "Nick", role: "approver" }
    ],
    ownerMayApprove: ["read", "inspect", "edit"],
    requiresOwnerReview: ["delete", "move", "rename", "archive"],
    notes: ["Core decision coordinator. Changes require approval from owner or Nick."]
  },
  // Hermes HEP owns Decision Policy
  {
    assetId: "hep.decision.policy",
    owner: "Hermes HEP",
    role: "owner",
    scope: "exclusive",
    delegates: [
      { actor: "Nick", role: "approver" }
    ],
    ownerMayApprove: ["read", "inspect", "edit"],
    requiresOwnerReview: ["delete", "move", "rename", "archive"],
    notes: ["Pure rule engine. Changes require approval from owner or Nick."]
  },
  // Hermes HEP owns Dependency Guard
  {
    assetId: "hep.dependency.guard",
    owner: "Hermes HEP",
    role: "owner",
    scope: "exclusive",
    delegates: [
      { actor: "Nick", role: "approver" }
    ],
    ownerMayApprove: ["read", "inspect", "edit"],
    requiresOwnerReview: ["delete", "move", "rename"]
  },
  // Guardian owns the ACL module
  {
    assetId: "hep.guardian.acl",
    owner: "guardian",
    role: "guardian",
    scope: "exclusive",
    delegates: [
      { actor: "Nick", role: "approver" },
      { actor: "Hermes HEP", role: "approver" }
    ],
    ownerMayApprove: ["read", "inspect"],
    forbiddenForAll: ["delete"],
    requiresOwnerReview: ["edit", "move", "rename", "archive"],
    notes: ["Guardian ACL source. Deletions forbidden. Any modification requires guardian review."]
  },
  // Hermes HEP owns hazard registry module
  {
    assetId: "hep.hazard.registry.module",
    owner: "Hermes HEP",
    role: "owner",
    scope: "exclusive",
    delegates: [
      { actor: "Nick", role: "approver" }
    ],
    ownerMayApprove: ["read", "inspect", "edit"],
    requiresOwnerReview: ["delete", "move", "rename"]
  },
  // Hermes HEP owns asset registry module itself
  {
    assetId: "hep.asset.registry.module",
    owner: "Hermes HEP",
    role: "owner",
    scope: "exclusive",
    delegates: [
      { actor: "Nick", role: "approver" }
    ],
    ownerMayApprove: ["read", "inspect", "edit"],
    requiresOwnerReview: ["delete", "move", "rename"]
  },
  // Hermes HEP owns runtime hazards memory
  {
    assetId: "runtime.hazards",
    owner: "Hermes HEP",
    role: "owner",
    scope: "exclusive",
    delegates: [
      { actor: "maintenance.autopilot", role: "maintainer", limitedTo: ["read", "inspect", "registry_update"] }
    ],
    ownerMayApprove: ["read", "inspect", "registry_update", "edit"],
    requiresOwnerReview: ["delete", "archive", "move"]
  },
  // Hermes HEP owns runtime events log
  {
    assetId: "runtime.events",
    owner: "Hermes HEP",
    role: "owner",
    scope: "shared",
    delegates: [
      { actor: "maintenance.autopilot", role: "maintainer", limitedTo: ["read", "inspect"] }
    ],
    ownerMayApprove: ["read", "inspect", "write", "archive"],
    requiresOwnerReview: ["delete", "move"]
  },
  // Hermes HEP owns decision ledger
  {
    assetId: "runtime.decisions",
    owner: "Hermes HEP",
    role: "owner",
    scope: "shared",
    delegates: [
      { actor: "maintenance.autopilot", role: "maintainer", limitedTo: ["read", "inspect"] }
    ],
    ownerMayApprove: ["read", "inspect", "write", "archive"],
    requiresOwnerReview: ["delete", "move"]
  },
  // Hermes HEP owns asset registry data file
  {
    assetId: "runtime.assets",
    owner: "Hermes HEP",
    role: "owner",
    scope: "exclusive",
    delegates: [
      { actor: "maintenance.autopilot", role: "maintainer", limitedTo: ["read", "inspect"] }
    ],
    ownerMayApprove: ["read", "inspect", "registry_update", "edit"],
    requiresOwnerReview: ["delete", "archive", "move"]
  },
  // Hermes HEP owns reports
  {
    assetId: "reports.active",
    owner: "Hermes HEP",
    role: "owner",
    scope: "shared",
    delegates: [
      { actor: "Nick", role: "approver" },
      { actor: "maintenance.autopilot", role: "maintainer", limitedTo: ["read", "inspect", "archive"] }
    ],
    ownerMayApprove: ["read", "inspect", "write", "archive", "move"],
    requiresOwnerReview: ["delete"]
  },
  // Hermes HEP owns report index
  {
    assetId: "reports.index",
    owner: "Hermes HEP",
    role: "owner",
    scope: "exclusive",
    delegates: [
      { actor: "maintenance.autopilot", role: "maintainer", limitedTo: ["read", "inspect", "registry_update"] }
    ],
    ownerMayApprove: ["read", "inspect", "registry_update"],
    requiresOwnerReview: ["delete", "move", "rename"]
  },
  // Maintenance autopilot owns the event log worktree (archive candidate)
  {
    assetId: "worktree.event_log_old",
    owner: "maintenance.autopilot",
    role: "maintainer",
    scope: "delegated",
    delegates: [
      { actor: "Nick", role: "approver" }
    ],
    ownerMayApprove: ["read", "inspect", "archive", "move"],
    requiresOwnerReview: ["delete"],
    notes: ["Old event-log worktree. Archive and move allowed by maintainer; deletion requires review."]
  }
];

// ─── Registry I/O ─────────────────────────────────────────────────────────────

function ownershipRegistryPath(workspaceRoot: string): string {
  return join(resolve(workspaceRoot), "memory", "ownership", "ownership-registry.json");
}

function ownershipLedgerPath(workspaceRoot: string): string {
  return join(resolve(workspaceRoot), "logs", "ownership", "ownership-events.jsonl");
}

export function initializeOwnershipRegistry(options: { workspaceRoot: string }): void {
  const registryPath = ownershipRegistryPath(options.workspaceRoot);
  mkdirSync(dirname(registryPath), { recursive: true });
  const data = {
    generatedAt: new Date().toISOString(),
    entries: SEED_OWNERSHIP
  };
  writeFileSync(registryPath, JSON.stringify(data, null, 2) + "\n", "utf8");

  const ledgerPath = ownershipLedgerPath(options.workspaceRoot);
  mkdirSync(dirname(ledgerPath), { recursive: true });
  if (!existsSync(ledgerPath)) {
    writeFileSync(ledgerPath, "", "utf8");
  }
}

export function loadOwnershipRegistry(options: { workspaceRoot: string }): OwnershipEntry[] {
  const registryPath = ownershipRegistryPath(options.workspaceRoot);
  if (!existsSync(registryPath)) return [];
  try {
    const data = JSON.parse(readFileSync(registryPath, "utf8"));
    return data.entries ?? [];
  } catch {
    return [];
  }
}

export function saveOwnershipRegistry(options: { workspaceRoot: string; entries: OwnershipEntry[] }): void {
  const registryPath = ownershipRegistryPath(options.workspaceRoot);
  mkdirSync(dirname(registryPath), { recursive: true });
  const data = {
    generatedAt: new Date().toISOString(),
    entries: options.entries
  };
  writeFileSync(registryPath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export function listOwnershipEntries(options: {
  workspaceRoot: string;
  owner?: string;
  role?: OwnershipRole;
}): OwnershipEntry[] {
  const entries = loadOwnershipRegistry({ workspaceRoot: options.workspaceRoot });
  return entries.filter(entry => {
    if (options.owner && entry.owner !== options.owner) return false;
    if (options.role && entry.role !== options.role) return false;
    return true;
  });
}

export function findOwnershipEntry(options: {
  workspaceRoot: string;
  assetId: string;
}): OwnershipEntry | undefined {
  const entries = loadOwnershipRegistry({ workspaceRoot: options.workspaceRoot });
  return entries.find(e => e.assetId === options.assetId);
}

export function addOrUpdateOwnershipEntry(options: { workspaceRoot: string; entry: OwnershipEntry }): void {
  const { workspaceRoot, entry } = options;
  const entries = loadOwnershipRegistry({ workspaceRoot });
  const index = entries.findIndex(e => e.assetId === entry.assetId);
  if (index >= 0) {
    entries[index] = { ...entries[index], ...entry, updatedAt: new Date().toISOString() };
  } else {
    entries.push({ ...entry, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }
  saveOwnershipRegistry({ workspaceRoot, entries });
}

export function writeOwnershipEvent(options: { workspaceRoot: string; event: Record<string, unknown> }): void {
  const ledgerPath = ownershipLedgerPath(options.workspaceRoot);
  mkdirSync(dirname(ledgerPath), { recursive: true });
  const entry = { timestamp: new Date().toISOString(), ...options.event };
  appendFileSync(ledgerPath, `${JSON.stringify(entry)}\n`, "utf8");
}

// ─── Core check function ──────────────────────────────────────────────────────

/**
 * Evaluate ownership rules for a (actor, action, assetId) tuple.
 *
 * This is a pure computation given a pre-loaded OwnershipEntry.
 * I/O is done by the caller (checkOwnership) which loads the registry.
 *
 * Design:
 *   - Owner approval is not root access. DENY rules in Policy still apply.
 *   - forbiddenForAll always wins over isOwner.
 *   - requiresOwnerReview fires regardless of whether actor is owner.
 */
export function evaluateOwnership(options: {
  entry: OwnershipEntry | undefined;
  actor: string;
  action: string;
  assetId?: string;
}): OwnershipSignal {
  const { entry, actor, action, assetId } = options;
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (!entry) {
    return {
      assetId,
      matched: false,
      isOwner: false,
      isDelegate: false,
      actionForbiddenForAll: false,
      requiresOwnerReview: false,
      actorAuthorized: false,
      isUnowned: true,
      reasons: [`No ownership entry found for asset '${assetId || "unknown"}'.`],
      warnings: ["Asset has no ownership record. Consider adding ownership metadata."]
    };
  }

  // Determine actor role
  const isOwner = entry.owner === actor;
  let isDelegate = false;
  let delegateRole: OwnershipRole | undefined;
  let delegateLimitedTo: string[] | undefined;

  if (!isOwner && entry.delegates) {
    const delegate = entry.delegates.find(d => d.actor === actor);
    if (delegate) {
      isDelegate = true;
      delegateRole = delegate.role;
      delegateLimitedTo = delegate.limitedTo;
    }
  }

  // Check forbidden-for-all
  const actionForbiddenForAll =
    Array.isArray(entry.forbiddenForAll) && entry.forbiddenForAll.includes(action.toLowerCase());
  if (actionForbiddenForAll) {
    reasons.push(
      `Action '${action}' is forbidden for all actors on asset '${entry.assetId}' (including owner '${entry.owner}').`
    );
  }

  // Check requires-owner-review
  const requiresOwnerReview =
    Array.isArray(entry.requiresOwnerReview) && entry.requiresOwnerReview.includes(action.toLowerCase());
  if (requiresOwnerReview && !isOwner) {
    reasons.push(
      `Action '${action}' on asset '${entry.assetId}' requires explicit owner review from '${entry.owner}'.`
    );
  }

  // Check delegate limits
  if (isDelegate && delegateLimitedTo && !delegateLimitedTo.includes(action.toLowerCase())) {
    reasons.push(
      `Actor '${actor}' is a delegate of role '${delegateRole}' for asset '${entry.assetId}' but action '${action}' is outside their permitted scope: [${delegateLimitedTo.join(", ")}].`
    );
  }

  // Authorization logic:
  //   - Forbidden-for-all → never authorized
  //   - Owner → authorized (unless forbidden-for-all)
  //   - Delegate → authorized if action is in their limitedTo (or limitedTo is unset) and role allows
  //   - Unknown actor → not authorized; requiresOwnerReview or no record
  let actorAuthorized = false;
  if (!actionForbiddenForAll) {
    if (isOwner) {
      actorAuthorized = true;
    } else if (isDelegate) {
      const withinLimits = !delegateLimitedTo || delegateLimitedTo.includes(action.toLowerCase());
      // Guardian role cannot authorize destructive actions
      if (delegateRole === "inspector" && !["read", "inspect", "scan", "index"].includes(action.toLowerCase())) {
        actorAuthorized = false;
        reasons.push(`Actor '${actor}' has inspector role and may only read/inspect asset '${entry.assetId}'.`);
      } else {
        actorAuthorized = withinLimits;
      }
    }
  }

  const isUnowned = entry.scope === "unowned";
  if (isUnowned) {
    warnings.push(`Asset '${entry.assetId}' has scope=unowned. Consider assigning an owner.`);
  }

  return {
    assetId: entry.assetId,
    matched: true,
    owner: entry.owner,
    role: entry.role,
    scope: entry.scope,
    isOwner,
    isDelegate,
    delegateRole: delegateRole ?? undefined,
    actionForbiddenForAll,
    requiresOwnerReview,
    actorAuthorized,
    isUnowned,
    reasons,
    warnings
  };
}

/**
 * Main entry point: load ownership entry for the given assetId (if any),
 * then evaluate ownership rules.
 */
export function checkOwnership(options: {
  workspaceRoot: string;
  actor: string;
  action: string;
  assetId?: string;
}): OwnershipSignal {
  const { workspaceRoot, actor, action, assetId } = options;

  if (!assetId) {
    return {
      matched: false,
      isOwner: false,
      isDelegate: false,
      actionForbiddenForAll: false,
      requiresOwnerReview: false,
      actorAuthorized: false,
      isUnowned: true,
      reasons: ["No assetId provided; ownership cannot be evaluated."],
      warnings: ["Provide an assetId to evaluate ownership."]
    };
  }

  const entry = findOwnershipEntry({ workspaceRoot, assetId });
  return evaluateOwnership({ entry, actor, action, assetId });
}

// ─── Formatting ───────────────────────────────────────────────────────────────

export function formatOwnershipCheck(signal: OwnershipSignal): string {
  const lines = [
    "Ownership Check Result:",
    `- Asset ID: ${signal.assetId || "n/a"}`,
    `- Matched: ${signal.matched}`,
    `- Owner: ${signal.owner || "n/a"}`,
    `- Role: ${signal.role || "n/a"}`,
    `- Scope: ${signal.scope || "n/a"}`,
    `- Is Owner: ${signal.isOwner}`,
    `- Is Delegate: ${signal.isDelegate}`,
    `- Delegate Role: ${signal.delegateRole || "n/a"}`,
    `- Action Forbidden For All: ${signal.actionForbiddenForAll}`,
    `- Requires Owner Review: ${signal.requiresOwnerReview}`,
    `- Actor Authorized: ${signal.actorAuthorized}`,
    `- Is Unowned: ${signal.isUnowned}`
  ];
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
