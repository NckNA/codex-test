/**
 * Tests for tools/hep/asset-ownership.ts
 *
 * Coverage:
 *  1.  evaluateOwnership: no entry → isUnowned, matched=false
 *  2.  evaluateOwnership: owner is exact actor → isOwner=true, actorAuthorized=true
 *  3.  evaluateOwnership: forbiddenForAll blocks even owner
 *  4.  evaluateOwnership: delegate with limitedTo in scope → actorAuthorized=true
 *  5.  evaluateOwnership: delegate with limitedTo out of scope → actorAuthorized=false
 *  6.  evaluateOwnership: inspector delegate non-read action → actorAuthorized=false
 *  7.  evaluateOwnership: requiresOwnerReview fires for non-owner
 *  8.  evaluateOwnership: requiresOwnerReview does not fire for owner
 *  9.  evaluateOwnership: unowned scope emits warning
 * 10.  checkOwnership: no assetId → matched=false
 * 11.  checkOwnership: loads from live registry (ownership-init required)
 * 12.  SEED: host.media_rescue forbids delete for all actors (forbiddenForAll)
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  evaluateOwnership,
  checkOwnership,
  checkOwnershipForTarget,
  initializeOwnershipRegistry,
  loadOwnershipRegistry,
  type OwnershipEntry
} from "../asset-ownership.ts";
import { initializeAssetRegistry } from "../asset-registry.ts";

const TEST_WORKSPACE = join(process.cwd(), "_test_ownership_tmp_" + Date.now());

beforeAll(() => {
  mkdirSync(TEST_WORKSPACE, { recursive: true });
  initializeAssetRegistry({ workspaceRoot: TEST_WORKSPACE });
  initializeOwnershipRegistry({ workspaceRoot: TEST_WORKSPACE });
});

afterAll(() => {
  try {
    rmSync(TEST_WORKSPACE, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
});

// ─── Helper entries ───────────────────────────────────────────────────────────

const mediaRescueEntry: OwnershipEntry = {
  assetId: "host.media_rescue",
  owner: "Nick",
  role: "owner",
  scope: "exclusive",
  forbiddenForAll: ["delete", "archive", "move", "rename"],
  requiresOwnerReview: ["move", "archive", "rename", "delete"]
};

const cliEntry: OwnershipEntry = {
  assetId: "hep.cli.index",
  owner: "Hermes HEP",
  role: "owner",
  scope: "exclusive",
  delegates: [
    { actor: "Nick", role: "approver" },
    { actor: "inspector.bot", role: "inspector" },
    { actor: "maintainer.bot", role: "maintainer", limitedTo: ["read", "inspect", "archive"] }
  ],
  ownerMayApprove: ["read", "inspect", "edit"],
  requiresOwnerReview: ["delete", "move", "rename", "archive"]
};

const unownedEntry: OwnershipEntry = {
  assetId: "some.asset",
  owner: "nobody",
  role: "owner",
  scope: "unowned"
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("evaluateOwnership", () => {
  it("no entry → matched=false, isUnowned=true", () => {
    const signal = evaluateOwnership({ entry: undefined, actor: "hermes.hep", action: "read", assetId: "unknown" });
    expect(signal.matched).toBe(false);
    expect(signal.isUnowned).toBe(true);
    expect(signal.actorAuthorized).toBe(false);
    expect(signal.reasons.length).toBeGreaterThan(0);
  });

  it("actor is owner → isOwner=true, actorAuthorized=true (unless forbiddenForAll)", () => {
    const signal = evaluateOwnership({ entry: cliEntry, actor: "Hermes HEP", action: "edit", assetId: "hep.cli.index" });
    expect(signal.isOwner).toBe(true);
    expect(signal.actorAuthorized).toBe(true);
    expect(signal.actionForbiddenForAll).toBe(false);
  });

  it("forbiddenForAll blocks even the owner", () => {
    const signal = evaluateOwnership({ entry: mediaRescueEntry, actor: "Nick", action: "delete", assetId: "host.media_rescue" });
    expect(signal.isOwner).toBe(true); // Nick is owner
    expect(signal.actionForbiddenForAll).toBe(true);
    expect(signal.actorAuthorized).toBe(false);
    expect(signal.reasons.some(r => r.includes("forbidden for all"))).toBe(true);
  });

  it("delegate with limitedTo in scope → actorAuthorized=true", () => {
    const signal = evaluateOwnership({ entry: cliEntry, actor: "maintainer.bot", action: "archive", assetId: "hep.cli.index" });
    expect(signal.isDelegate).toBe(true);
    expect(signal.delegateRole).toBe("maintainer");
    expect(signal.actorAuthorized).toBe(true);
  });

  it("delegate with limitedTo out of scope → actorAuthorized=false", () => {
    const signal = evaluateOwnership({ entry: cliEntry, actor: "maintainer.bot", action: "delete", assetId: "hep.cli.index" });
    expect(signal.isDelegate).toBe(true);
    expect(signal.actorAuthorized).toBe(false);
    expect(signal.reasons.some(r => r.includes("outside their permitted scope"))).toBe(true);
  });

  it("inspector delegate on non-read action → actorAuthorized=false", () => {
    const signal = evaluateOwnership({ entry: cliEntry, actor: "inspector.bot", action: "edit", assetId: "hep.cli.index" });
    expect(signal.isDelegate).toBe(true);
    expect(signal.delegateRole).toBe("inspector");
    expect(signal.actorAuthorized).toBe(false);
    expect(signal.reasons.some(r => r.includes("inspector role"))).toBe(true);
  });

  it("requiresOwnerReview fires for non-owner", () => {
    const signal = evaluateOwnership({ entry: cliEntry, actor: "Nick", action: "delete", assetId: "hep.cli.index" });
    expect(signal.requiresOwnerReview).toBe(true);
    expect(signal.reasons.some(r => r.includes("requires explicit owner review"))).toBe(true);
  });

  it("requiresOwnerReview does NOT add reason for the owner themselves", () => {
    const signal = evaluateOwnership({ entry: cliEntry, actor: "Hermes HEP", action: "delete", assetId: "hep.cli.index" });
    expect(signal.isOwner).toBe(true);
    expect(signal.requiresOwnerReview).toBe(true); // flag still true (it's in the list)
    // But no "requires explicit owner review" reason emitted for the owner
    expect(signal.reasons.some(r => r.includes("requires explicit owner review"))).toBe(false);
  });

  it("unowned scope emits warning", () => {
    const signal = evaluateOwnership({ entry: unownedEntry, actor: "nobody", action: "read", assetId: "some.asset" });
    expect(signal.isUnowned).toBe(true);
    expect(signal.warnings.some(w => w.includes("scope=unowned"))).toBe(true);
  });
});

describe("checkOwnership", () => {
  it("no assetId provided → matched=false", () => {
    const signal = checkOwnership({ workspaceRoot: TEST_WORKSPACE, actor: "hermes.hep", action: "read" });
    expect(signal.matched).toBe(false);
    expect(signal.reasons.some(r => r.includes("No assetId"))).toBe(true);
  });

  it("assetId not in registry → matched=false", () => {
    const signal = checkOwnership({ workspaceRoot: TEST_WORKSPACE, actor: "hermes.hep", action: "read", assetId: "not.existing" });
    expect(signal.matched).toBe(false);
    expect(signal.isUnowned).toBe(true);
  });

  it("host.media_rescue: delete is forbiddenForAll even for Nick", () => {
    const signal = checkOwnership({ workspaceRoot: TEST_WORKSPACE, actor: "Nick", action: "delete", assetId: "host.media_rescue" });
    expect(signal.matched).toBe(true);
    expect(signal.actionForbiddenForAll).toBe(true);
    expect(signal.actorAuthorized).toBe(false);
  });

  it("host.media_rescue: Nick can read (read is not in forbiddenForAll)", () => {
    const signal = checkOwnership({ workspaceRoot: TEST_WORKSPACE, actor: "Nick", action: "read", assetId: "host.media_rescue" });
    expect(signal.matched).toBe(true);
    expect(signal.isOwner).toBe(true);
    expect(signal.actionForbiddenForAll).toBe(false);
    expect(signal.actorAuthorized).toBe(true);
  });

  it("Seed registry loads all 16 entries", () => {
    const entries = loadOwnershipRegistry({ workspaceRoot: TEST_WORKSPACE });
    expect(entries.length).toBeGreaterThanOrEqual(16);
  });

  it("Registry file exists after init", () => {
    const registryPath = join(TEST_WORKSPACE, "memory", "ownership", "ownership-registry.json");
    expect(existsSync(registryPath)).toBe(true);
  });
});


describe("checkOwnershipForTarget", () => {
  it("resolves a registered target to asset ownership", () => {
    const signal = checkOwnershipForTarget({
      workspaceRoot: TEST_WORKSPACE,
      repositoryPath: join(TEST_WORKSPACE, "codex-test"),
      actor: "Hermes HEP",
      action: "edit",
      target: "tools/hep/index.ts"
    });

    expect(signal.matched).toBe(true);
    expect(signal.assetId).toBe("hep.cli.index");
    expect(signal.isOwner).toBe(true);
    expect(signal.actorAuthorized).toBe(true);
  });

  it("returns unowned signal when target is not registered as an asset", () => {
    const signal = checkOwnershipForTarget({
      workspaceRoot: TEST_WORKSPACE,
      repositoryPath: join(TEST_WORKSPACE, "codex-test"),
      actor: "Hermes HEP",
      action: "read",
      target: "unknown/file.ts"
    });

    expect(signal.matched).toBe(false);
    expect(signal.isUnowned).toBe(true);
    expect(signal.warnings.some(w => w.includes("asset"))).toBe(true);
  });
});
