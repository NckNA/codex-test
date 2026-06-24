# HERMES-WAIVER-RB-REF-CLI-001

## Verdict
PASS

## Summary
Added CLI support for setting `rollbackRef` on waiver creation.

## Changed files
- `tools/hep/index.ts`
- `_ai_work/REPORTS/HERMES-WAIVER-RB-REF-CLI-001.md`

## Implementation
- Added `--rb-ref <id>` to waiver CLI parsing.
- Passed the value to `addOrUpdateWaiver` as `rollbackRef`.
- Documented the flag in CLI help.

## Validation
- lint: PASS
- test: PASS, 77 files / 811 tests
- build: PASS

## Smoke
- `waiver-add --rb-ref contract.smoke.ref`: PASS
- `waiver-see` returned the same `rollbackRef`: PASS
- smoke waiver cleanup via revoke: PASS

## Next
HERMES-ROLLBACK-VERIFY-001
