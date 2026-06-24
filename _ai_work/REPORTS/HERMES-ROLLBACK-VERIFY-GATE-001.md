# HERMES-ROLLBACK-VERIFY-GATE-001

## Verdict
PASS

## Summary
Added a Decision Policy gate requiring verified rollback evidence for high-risk waiver relaxation.

## Changed files
- `tools/hep/decision-policy.ts`
- `tools/hep/__tests__/decision-policy.test.ts`
- `_ai_work/REPORTS/HERMES-ROLLBACK-VERIFY-GATE-001.md`

## Implementation
- Added verified rollback detection using:
  - `rollback.verified`
  - `rollback.status === verified`
  - `rollback.validationStatus === dry_run_passed`
  - `rollback.validationStatus === manually_verified`
- Added policy rule:
  - `ROLLBACK_VERIFY_REQUIRED_FOR_WAIVER_HIGH`
- High/critical waiver with active but unverified rollback now escalates.
- Verified rollback does not trigger the gate.

## Validation
- lint: PASS
- targeted decision-policy test: PASS, 50 tests
- full test suite: PASS, 77 files / 815 tests
- build: PASS

## Safety
- No DENY bypass added.
- No app/UI changes.
- No migrations.
- No cloud access.

## Next
HERMES-POLICY-SIMULATOR-001
