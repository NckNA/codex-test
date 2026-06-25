# HERMES-OWNERSHIP-TARGET-CHECK-ALIAS-001

## Verdict
PASS

## Summary
Added target-based ownership checking.

## Changed files
- `tools/hep/asset-ownership.ts`
- `tools/hep/__tests__/asset-ownership.test.ts`
- `tools/hep/index.ts`
- `_ai_work/REPORTS/HERMES-OWNERSHIP-TARGET-CHECK-ALIAS-001.md`

## Implementation
- Added `checkOwnershipForTarget`.
- Added CLI routes:
  - `ownership-target-check`
  - `ownership-check-target`
- Existing `ownership-check --asset-id` remains unchanged.

## Validation
- targeted ownership test: PASS, 17 tests
- lint: PASS
- full test suite: PASS, 81 files / 867 tests
- build: PASS

## Smoke
- `ownership-target-check`: PASS
- `ownership-check-target`: PASS
- target `tools/hep/index.ts` resolved to `hep.cli.index`
- result: matched, owner, authorized

## Safety
- No app/UI changes.
- No migrations.
- No cloud access.
- No destructive action execution.

## Next
HERMES-GOVERNANCE-FINALIZE-001
