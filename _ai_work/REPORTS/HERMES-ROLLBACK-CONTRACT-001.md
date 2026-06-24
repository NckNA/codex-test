# HERMES-ROLLBACK-CONTRACT-001

## Verdict
PARTIAL PASS — Rollback Contract v1 module, CLI, tests, and Gateway signal collection are implemented.

## Summary
Implemented the first Rollback Contract layer for Hermes HEP.

Rollback Contract formalizes rollback plans as structured records with changed files, rollback steps, validation status, affected assets, protected-asset review flags, and runtime event logging.

This task keeps rollback as evidence, not permission. It does not execute rollback commands.

## Changed files
- `tools/hep/rollback-contract.ts`
- `tools/hep/__tests__/rollback-contract.test.ts`
- `tools/hep/index.ts`
- `tools/hep/decision-gateway.ts`
- `_ai_work/REPORTS/HERMES-ROLLBACK-CONTRACT-001.md`

## Runtime files
- `D:\hermes\memory\rollback\rollback-contracts.json`
- `D:\hermes\logs\rollback\rollback-events.jsonl`

## CLI commands added
- `rollback-init`
- `rollback-list`
- `rollback-see`
- `rollback-add`
- `rollback-check`
- `rollback-verify`
- `rollback-revoke`

## Gateway integration
Decision Gateway now collects a rollback signal after waiver evaluation and exposes it under:

- `signals.rollback`

Smoke decision-check confirmed `signals.rollback` appears in JSON output and includes:

- matched
- active
- contractId
- rollbackStepsPresent
- changedFilesPresent
- canSupportWaiver
- canSupportRiskReduction

## Policy integration status
RollbackSignal is passed into Decision Policy through the existing `context` field rather than a dedicated typed `rollbackSignal` property.

Reason: direct patching of `decision-policy.ts` for a new rollback import/type was blocked by the tool/safety layer during this session.

Follow-up required:

- `HERMES-ROLLBACK-POLICY-TYPED-RULES-001`

That follow-up should add explicit typed DecisionPolicyInput rollbackSignal and dedicated rollback matchedRules.

## Validation
- `npm run lint`: PASS
- `npm test`: PASS, 77 files / 805 tests
- `npm run build`: PASS

## Smoke results
Completed:

1. `rollback-init`
   - registry initialized

2. `rollback-check` without contract
   - matched false
   - active false

3. `rollback-add`
   - active medium contract created
   - changedFiles present
   - rollbackSteps present

4. `rollback-check` after add
   - matched true
   - active true
   - canSupportWaiver true
   - canSupportRiskReduction true

5. `decision-check` for HEP archive target
   - `signals.rollback` present
   - rollback contract matched
   - final decision remained DENY because Guardian/Ownership/Hazard rules were stricter

6. `rollback-revoke`
   - smoke contract revoked
   - subsequent `rollback-check` showed active false

## Safety notes
Rollback Contract v1 does not run rollback commands.
Rollback Contract v1 does not bypass DENY.
Rollback Contract v1 does not weaken Guardian, Asset, Ownership, Waiver, or Hazard rules.

## Known limitations
- Dedicated Decision Policy rollback rules were not added in this commit because direct editing of `decision-policy.ts` for the new typed rollback signal was blocked.
- Waiver Registry was not extended with `rollbackContractId` in this commit.

## Recommended next task
`HERMES-ROLLBACK-POLICY-TYPED-RULES-001`

Purpose:
Add explicit typed rollbackSignal to DecisionPolicyInput, implement dedicated rollback rules, and connect Waiver rollbackContractId support.
