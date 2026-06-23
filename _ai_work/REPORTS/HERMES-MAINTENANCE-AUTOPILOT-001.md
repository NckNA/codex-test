# HERMES-MAINTENANCE-AUTOPILOT-001

## Status
Partially implemented locally.

## Scope
Added dry-run-first maintenance autopilot logic on top of Maintenance Trio and the report indexer.

## Changes
- Added `tools/hep/maintenance-autopilot.ts`.
- Added isolated tests in `tools/hep/__tests__/maintenance-autopilot.test.ts`.

## Implemented behavior
- Autopilot v1 is dry-run only.
- It refreshes the durable report index.
- It builds a Maintenance Trio plan scoped to reports by default.
- It creates dry-run safe actions with `maxActions` limiting.
- It writes a run log to `logs/maintenance-autopilot-runs.jsonl`.
- It refuses non-dry-run mode in v1.

## Safety posture
- No files are moved.
- No files are deleted.
- Non-dry-run autopilot throws an error.
- Manual `maintenance-apply --safe` remains the only path for real reversible moves.

## Validation
- `npx eslint tools/hep/maintenance-autopilot.ts tools/hep/__tests__/maintenance-autopilot.test.ts tools/hep/index.ts`: passed.
- `npx vitest run tools/hep/__tests__/maintenance-autopilot.test.ts`: passed, 2 tests.
- `npx tsc -b`: passed.

## Limitation
CLI switch integration for `maintenance-autopilot` was attempted but the local command safety layer blocked the final patch insertion. The command is listed in usage text but currently not wired in the switch block. The module itself is implemented and tested.

## Files changed
- `tools/hep/maintenance-autopilot.ts`
- `tools/hep/__tests__/maintenance-autopilot.test.ts`
- `_ai_work/REPORTS/HERMES-MAINTENANCE-AUTOPILOT-001.md`

## Final verdict
Autopilot core implemented and tested. CLI switch wiring remains as a small follow-up patch.

## Next recommended task
HERMES-MAINTENANCE-AUTOPILOT-001B: wire `maintenance-autopilot` into CLI switch and run a real dry-run from CLI.

