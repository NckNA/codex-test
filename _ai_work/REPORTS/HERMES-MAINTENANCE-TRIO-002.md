# HERMES-MAINTENANCE-TRIO-002

## Status
Implemented locally.

## Scope
Extended Maintenance Trio v1 with safer autonomous controls for reversible workspace maintenance.

## Changes
- Added batch limiting support with `--max-actions <n>` for `maintenance-apply`.
- Added `--only <scope>` filters for `maintenance-plan` and `maintenance-apply`.
- Added `--dry-run` support for maintenance safe apply.
- Added `reports/indexes/report-index.json` generation.
- Upgraded protected asset manifest to version 2.
- Preserved v1 compatibility fields:
  - `quartermasterDecision`
  - `suggestedTarget`
  - `deleteEnabled`
  - `summary`
- Kept destructive delete disabled.
- Kept git checkouts, policies, memory, agent workspaces, and unknown root objects protected or escalated.

## Commands
```bash
node tools/hep/index.ts maintenance-plan --taskId HERMES-MAINTENANCE-TRIO-002 --only reports
node tools/hep/index.ts maintenance-apply --safe --dry-run --max-actions 5 --only reports
node tools/hep/index.ts maintenance-apply --safe --max-actions 5 --only reports
node tools/hep/index.ts maintenance-restore --actionId <id>
```

## Validation
- `npm run lint`: passed.
- `npm test`: passed, 61 files, 626 tests.
- `npx tsc -b`: passed.
- `npm run build`: passed (`tsc -b && vite build`).

## Known pre-existing warnings
- React `act(...)` warnings remain in existing component tests.
- Existing Vite bundle-size warning remains expected from earlier runs.

## Safety posture
- Delete remains disabled.
- Safe apply only supports reversible archive/quarantine moves.
- Dry-run writes an action log entry but does not move files and cannot be restored.
- `maxActions` should be used for all scheduled runs.

## Next recommended task
HERMES-MAINTENANCE-TRIO-003: add scheduled safe-run policy, report index summaries, and lifecycle finalizer for merged PR/task policies.

