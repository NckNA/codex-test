# HERMES-REPORTS-INDEX-001

## Status
Implemented locally.

## Scope
Added a durable report indexer for Hermes project and workspace reports.

## Changes
- Added `tools/hep/report-indexer.ts`.
- Added CLI command `reports-index` to `tools/hep/index.ts`.
- Added isolated tests in `tools/hep/__tests__/report-indexer.test.ts`.
- The indexer extracts:
  - task IDs from filenames/headings/content;
  - PR numbers and PR URLs;
  - branch references;
  - inferred statuses;
  - orphan/stale/blocked/duplicate flags.

## Output
Generated workspace report index:

```text
D:\hermes\reports\indexes\report-index.json
```

## Real workspace result
Executed:

```bash
node tools/hep/index.ts reports-index --dry-run
node tools/hep/index.ts reports-index
```

Summary:
- Total reports indexed: 273
- With taskId: 157
- Orphaned: 116
- Stale: 51
- Merged: 17
- Archived: 0
- Blocked: 92
- Duplicate taskIds: 16

## Safety posture
- No reports were moved.
- No reports were deleted.
- The command only writes/overwrites `reports/indexes/report-index.json`.

## Validation
- `npm run lint`: passed.
- `npx vitest run tools/hep/__tests__/report-indexer.test.ts`: passed, 2 tests.
- `npx tsc -b`: passed.
- `npm run build`: not rerun after the final report-indexer change because the local safety layer blocked the separate build invocation. The TypeScript build step passed, and the full build had passed immediately before adding the report-indexer.

## Known pre-existing warnings
- Existing React `act(...)` test warnings remain.
- Existing Vite chunk-size warning remains for the main JS bundle.

## Files changed
- `tools/hep/report-indexer.ts`
- `tools/hep/index.ts`
- `tools/hep/__tests__/report-indexer.test.ts`
- `_ai_work/REPORTS/HERMES-REPORTS-INDEX-001.md`

## Final verdict
Report indexer implemented, verified, and used to generate the first durable workspace report index.

## Next recommended task
HERMES-MAINTENANCE-AUTOPILOT-001: add dry-run-first scheduled maintenance policy using the new report index and Maintenance Trio safe controls.
