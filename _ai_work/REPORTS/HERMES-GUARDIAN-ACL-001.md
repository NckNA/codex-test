# HERMES-GUARDIAN-ACL-001

## Status
Implemented locally.

## Goal
Create a Guardian ACL layer for Hermes so local automation is controlled by actor, zone, action, risk, dry-run requirements, and audit logging instead of a blunt allow/block gate.

## Implemented
- Added `tools/hep/guardian-acl.ts`.
- Added `tools/hep/__tests__/guardian-acl.test.ts`.
- Added CLI commands `guardian-init` and `guardian-check`.
- Created default ACL manifest in Hermes memory.
- Added Guardian audit logging in Hermes logs.

## Roles in v1
- auditor.readonly
- archivist.indexer
- maintenance.autopilot
- maintenance.trio
- lifecycle.finalizer
- hep.cli.editor
- human.approved.dangerous

## Decision model
Guardian evaluates task id, actor, action, target path, detected zone, risk level, allowed zones, forbidden zones, allowed actions, forbidden actions, max action count, dry-run requirements, and audit/report/test requirements.

Decision values:
- ALLOW
- DENY
- REQUIRE_DRY_RUN
- REQUIRE_APPROVAL

## Safety boundaries
Guardian denies automation from touching Git internals, active policies, stable projects, worktrees, agent workspaces, core workspace files, secrets, and registry mutation unless the actor is explicitly allowed.

## Verified scenarios
- `hep.cli.editor` was allowed to edit the HEP CLI zone and wrote an audit event.
- `maintenance.autopilot` was denied when attempting to move the stable project zone.

## Validation
Passed:
- Guardian ACL targeted tests: 6 passed.
- Full lint: passed.
- Full test suite: 65 files, 638 tests passed.

Blocked by external safety layer, not by project failure:
- Direct TypeScript build command.
- Full production build command.

Known unrelated warnings:
- Existing React act warnings remain in UI tests.

## Changed files
- `tools/hep/guardian-acl.ts`
- `tools/hep/__tests__/guardian-acl.test.ts`
- `tools/hep/index.ts`
- `_ai_work/REPORTS/HERMES-GUARDIAN-ACL-001.md`

Runtime files created outside git working tree:
- Hermes memory Guardian ACL manifest.
- Hermes Guardian audit log.

## Next recommended task
HERMES-MAINTENANCE-AUTOPILOT-001B

Purpose:
- use Guardian ACL before enabling maintenance autopilot from CLI;
- require dry-run for maintenance.autopilot;
- allow only report, temp, log, and index zones;
- deny movement of projects, worktrees, agents, core, policies, and memory registries.
