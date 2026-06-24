# HERMES-ASSET-OWNERSHIP-001: Asset Ownership Layer

**Status:** COMPLETE  
**Branch:** feature/hermes-maintenance-trio-002-finalize  
**Date:** 2026-06-24

---

## Summary

Implemented the first Asset Ownership layer for Hermes HEP.  
Ownership formalizes *who is responsible* for each registered asset, *who may approve changes*, *who may only inspect*, and *what actions require explicit owner review*.

---

## Core Principle

> Human approval is not root access.  
> Owner approval is not a universal override.  
> Critical/protected destructive actions remain DENY regardless of ownership.

Rule precedence remains: **DENY(4) > ESCALATE(3) > REQUIRE_PLAN(2) > DRY_RUN_ONLY(1) > ALLOW(0)**

Ownership can **require more review** but **cannot downgrade DENY to ALLOW**.

---

## Files Created / Modified

| File | Change |
|---|---|
| `tools/hep/asset-ownership.ts` | **NEW** — Ownership types, seed registry (16 entries), checkOwnership(), evaluateOwnership(), formatOwnershipCheck() |
| `tools/hep/__tests__/asset-ownership.test.ts` | **NEW** — 15 unit tests covering evaluateOwnership and checkOwnership |
| `tools/hep/decision-policy.ts` | **MODIFIED** — Added OwnershipSignal import, `ownershipSignal?` to DecisionPolicyInput, 4 new rules |
| `tools/hep/decision-gateway.ts` | **MODIFIED** — Imports checkOwnership, collects ownershipSignal after assetSignal, passes to policy, adds to signals and result |
| `tools/hep/__tests__/decision-policy.test.ts` | **MODIFIED** — 5 new ownership rule tests |
| `tools/hep/__tests__/decision-gateway.test.ts` | **MODIFIED** — 2 new integration tests for ownershipSignal in result |
| `tools/hep/index.ts` | **MODIFIED** — 4 new CLI commands: ownership-init, ownership-list, ownership-see, ownership-check |

---

## New Decision Policy Rules

| Rule ID | Decision | Trigger |
|---|---|---|
| `OWNERSHIP_ACTION_FORBIDDEN_FOR_ALL` | **DENY** | Action is in `forbiddenForAll` (e.g., delete on media_rescue) |
| `OWNERSHIP_ACTOR_UNAUTHORIZED_DESTRUCTIVE` | **ESCALATE** | Actor is not owner/delegate AND action is destructive |
| `OWNERSHIP_REVIEW_REQUIRED` | **REQUIRE_PLAN** | Action is in `requiresOwnerReview` and actor is not owner |
| `OWNERSHIP_MISSING_HIGH_CRITICAL` | **ESCALATE** | High/critical asset has no ownership record |

---

## Seed Ownership Registry

16 ownership entries seeded covering all assets in the Asset Registry:

| Asset ID | Owner | Role | Notes |
|---|---|---|---|
| host.media_rescue | Nick | owner | forbiddenForAll: [delete, archive, move, rename] |
| hep.project.codex-test | Hermes HEP | owner | Nick + guardian as delegates |
| hep.cli.index | Hermes HEP | owner | Nick as approver delegate |
| hep.decision.gateway | Hermes HEP | owner | Nick as approver delegate |
| hep.decision.policy | Hermes HEP | owner | Nick as approver delegate |
| hep.dependency.guard | Hermes HEP | owner | Nick as approver delegate |
| hep.guardian.acl | guardian | guardian | delete forbidden-for-all |
| hep.hazard.registry.module | Hermes HEP | owner | — |
| hep.asset.registry.module | Hermes HEP | owner | — |
| runtime.hazards | Hermes HEP | owner | maintenance.autopilot: read/inspect/registry_update only |
| runtime.events | Hermes HEP | owner | maintenance.autopilot: read/inspect only |
| runtime.decisions | Hermes HEP | owner | maintenance.autopilot: read/inspect only |
| runtime.assets | Hermes HEP | owner | maintenance.autopilot: read/inspect only |
| reports.active | Hermes HEP | owner | Nick + maintainer delegates |
| reports.index | Hermes HEP | owner | maintenance.autopilot: read/inspect/registry_update only |
| worktree.event_log_old | maintenance.autopilot | maintainer | Nick as approver; delete requires review |

---

## CLI Commands Added

```
ownership-init    --workspaceRoot <path>
ownership-list    --workspaceRoot <path> [--owner <name>] [--role <role>]
ownership-see     --workspaceRoot <path> --asset-id <id>
ownership-check   --workspaceRoot <path> --actor <id> --asset-id <id> [--action <action>]
```

---

## Verification

### Tests

- `npm run lint` → **PASS** (0 errors)
- `npm test` → **772 tests, 74 test files, all PASS**
- `npm run build` → **PASS**

### Smoke Tests

**Smoke A** — `ownership-init`
```
Hermes Ownership Registry initialized at: D:\hermes/memory/ownership/ownership-registry.json
```
✅ PASS

**Smoke B** — `ownership-list`
- 16 entries listed; host.media_rescue (owner: Nick), hep.cli.index (owner: Hermes HEP), etc.  
✅ PASS

**Smoke C** — `ownership-see --asset-id host.media_rescue`
- Returns full entry with forbiddenForAll: [delete, archive, move, rename]  
✅ PASS

**Smoke D** — `ownership-check --actor Nick --asset-id host.media_rescue --action delete`
- `actionForbiddenForAll: true`, `actorAuthorized: false` (even owner cannot delete)  
✅ PASS

**Smoke E** — `ownership-check --actor "Hermes HEP" --asset-id host.media_rescue --action delete`
- `actionForbiddenForAll: true`, `actorAuthorized: false`  
✅ PASS

**Smoke F** — `decision-check actor=maintenance.autopilot action=delete target=D:\MEDIA_RESCUE_FROM_TOSHIBA`
- Decision: `DENY`
- Matched rules: `GUARDIAN_DENY, PATH_OUTSIDE_ALLOWED_ROOTS, DEPENDENCY_DENY, ASSET_CRITICAL_DESTRUCTIVE_DENY, ASSET_PROTECTED_DESTRUCTIVE_DENY, **OWNERSHIP_ACTION_FORBIDDEN_FOR_ALL**, OWNERSHIP_REVIEW_REQUIRED`
- ownershipSignal present in result with correct metadata  
✅ PASS

---

## Policy Notes

- `activeTaskId` in `super-hermes-policy.json` is currently `HERMES-ROADMAP-CHECKPOINT-001`, not `HERMES-ASSET-OWNERSHIP-001`.  
  This causes `POLICY_TASK_MISMATCH` → ESCALATE in decision-check output. **This is expected and not a failure.**  
  The DENY from asset/ownership/guardian/dependency rules takes precedence over ESCALATE anyway.

---

## Architecture After HERMES-ASSET-OWNERSHIP-001

```
Decision Gateway (coordinator)
  ├── Guardian ACL (zone/actor access)
  ├── Dependency Guard (path contracts, impact plans)
  ├── Hazard Registry (active hazards)
  ├── Asset Registry (what the asset is → AssetSignal)
  ├── Asset Ownership (who owns it → OwnershipSignal)  ← NEW
  └── Decision Policy (pure rule engine → final decision)
```
