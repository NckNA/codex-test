# HERMES-MAINTENANCE-AUTOPILOT-001B

## Status

Implemented and validated locally.

## Branch

`feature/hermes-maintenance-trio-002-finalize`

## Commit

Local commit is created after this report is staged. Final handoff contains the exact commit hash.

## Changed files

- `tools/hep/maintenance-autopilot.ts`
- `tools/hep/index.ts`
- `tools/hep/__tests__/maintenance-autopilot.test.ts`
- `_ai_work/REPORTS/HERMES-MAINTENANCE-AUTOPILOT-001B.md`

## Implementation summary

Maintenance Autopilot v1B is now a dry-run-only orchestration layer. It does not perform real file moves, deletes, archives, quarantines, migrations, deployments, or cloud changes.

The flow is:

1. Normalize `scope` / `only`.
2. Enforce `dryRun: true`.
3. Run Guardian ACL before planning.
4. Generate the maintenance plan.
5. Run Dependency Guard for each actionable archive/quarantine candidate.
6. Keep only Dependency Guard-approved candidates in dry-run apply.
7. Update the report index.
8. Write an autopilot run log.
9. Return a compact result.

## Guardian integration

Autopilot uses actor:

- `maintenance.autopilot`

It checks Guardian ACL with action:

- `dry_run`

If Guardian denies the scope, autopilot stops before creating a maintenance plan.

## Dependency Guard integration

Each actionable maintenance candidate is checked before it can become a dry-run action.

Allowed decisions:

- `ALLOW`
- `ALLOW_WITH_IMPACT_PLAN`

Blocked decisions:

- `DENY`
- `REQUIRE_WAIVER_PLAN`
- `ESCALATE`

Blocked candidates are reported in `blockedCandidates` and counted in `blockedCount`.

## Dry-run-only guarantee

`runMaintenanceAutopilot({ dryRun: false })` throws:

`Maintenance autopilot v1B is dry-run only`

The CLI always passes `dryRun: true`.

## CLI command

Added:

```bash
node --experimental-strip-types tools/hep/index.ts maintenance-autopilot --taskId HERMES-MAINTENANCE-AUTOPILOT-001B --only reports --max-actions 1 --dry-run
```

The command prints compact JSON with:

- `ok`
- `dryRun`
- `plannedActionsCount`
- `blockedCount`
- `guardianDecision`
- `dependencyDecisionCounts`
- `logPath`
- `warnings`
- `result`

## Validation results

- `npm run lint`: passed
- `npm test -- tools/hep/__tests__/maintenance-autopilot.test.ts`: passed, 6 tests
- `npm test`: passed, 66 files / 650 tests
- `npm run build`: passed

Build warning:

- Vite reports a chunk larger than 500 kB after minification. This is an existing bundle-size warning and does not fail the build.

## Limitations

- v1B is intentionally dry-run-only.
- It does not schedule itself.
- It does not approve real archive/quarantine execution.
- It does not modify Guardian or Dependency Guard policy files.
- It does not push branches or open PRs.

## Recommended next task

`HERMES-MAINTENANCE-AUTOPILOT-001C`
