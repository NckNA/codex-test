# HERMES-ROLLBACK-POLICY-TYPED-RULES-001

## Verdict
PARTIAL PASS

## Summary
Implemented typed Decision Policy support for rollback input and added explicit rollback policy rules.

This task upgrades Rollback Contract from Gateway-only signal visibility to policy-level rule evaluation.

## Changed files
- `tools/hep/decision-policy.ts`
- `tools/hep/__tests__/decision-policy.test.ts`
- `tools/hep/decision-gateway.ts`
- `_ai_work/REPORTS/HERMES-ROLLBACK-POLICY-TYPED-RULES-001.md`

## Implemented policy input
DecisionPolicyInput now accepts:

- `rollback?: unknown`

The field is intentionally policy-facing and loosely typed because direct `RollbackSignal` import edits were blocked by the tool/safety layer in this session. The policy engine casts it internally and evaluates only explicit boolean/string fields.

Gateway now passes:

- `rollback: rollbackSignal`

instead of hiding it only under context.

## Implemented rollback rules
Added policy rules:

- `ROLLBACK_MISSING_FOR_WAIVER_HIGH`
- `ROLLBACK_CONTRACT_MISSING`
- `ROLLBACK_CONTRACT_EXPIRED`
- `ROLLBACK_CONTRACT_REVOKED`
- `ROLLBACK_STEPS_MISSING`
- `ROLLBACK_CHANGED_FILES_MISSING`
- `ROLLBACK_PROTECTED_ASSET_REVIEW_REQUIRED`

## Important safety behavior
Rollback policy rules do not bypass DENY.
Rollback rules can add stricter candidates before waiver relaxation.
A missing changed-files rollback contract is escalated so waiver relaxation cannot reduce it to ALLOW.

## Tests
Added Decision Policy rollback tests covering:

- high-risk waiver without active rollback contract
- revoked rollback contract
- missing rollback steps
- missing changed files
- protected rollback without owner review

## Validation
- `npm run lint`: PASS
- `npm test`: PASS, 77 files / 810 tests
- `npm run build`: PASS

## Smoke
- `decision-check` with safe inspect action: PASS
- Gateway output includes `signals.rollback`
- Active task policy confirmed as `HERMES-ROLLBACK-POLICY-TYPED-RULES-001`

A live archive-style smoke command was not rerun in this task because the platform layer blocked that command shape in this session. Unit tests cover the policy rules directly.

## Known limitations
- Waiver Registry was not updated with `rollbackContractId` because direct edits adding that field were blocked by the tool/safety layer.
- DecisionPolicyInput uses `rollback?: unknown` rather than importing `RollbackSignal` directly.

## Recommended next task
`HERMES-WAIVER-ROLLBACK-CONTRACT-ID-001`

Purpose:
Add `rollbackContractId` support to Waiver Registry and CLI with focused safe patches, then update waiver tests.
