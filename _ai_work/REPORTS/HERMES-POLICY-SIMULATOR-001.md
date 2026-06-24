# HERMES-POLICY-SIMULATOR-001

## Verdict
PASS

## Summary
Added Decision Gateway simulation support.

## Changed files
- `tools/hep/decision-gateway.ts`
- `tools/hep/__tests__/decision-gateway.test.ts`
- `tools/hep/index.ts`
- `_ai_work/REPORTS/HERMES-POLICY-SIMULATOR-001.md`

## Implementation
- Added `simulateDecisionGateway`.
- Added `DecisionSimulationResult`.
- Added compact simulation fields:
  - decision
  - allowed
  - requiredMode
  - matchedRules
  - blockers
  - missingEvidence
  - warnings
  - recommendedNextSteps
  - signals
- Simulation always forces:
  - `writeEvent: false`
  - `writeDecisionLedger: false`
- Added CLI commands:
  - `policy-simulate`
  - `decision-simulate`

## Validation
- targeted decision-gateway test: PASS, 30 tests
- lint: PASS
- full test suite: PASS, 77 files / 817 tests
- build: PASS

## Smoke
- `decision-simulate`: PASS
- exitCode: 0
- `simulation: true`: PASS
- `eventWritten: false`: PASS
- `decisionLedgerWritten: false`: PASS

The direct `policy-simulate` smoke command was blocked by the external tool/safety layer in this session, but `decision-simulate` uses the same implementation path and passed.

## Safety
- No action execution added.
- No event writes during simulation.
- No decision ledger writes during simulation.
- No app/UI changes.
- No migrations.
- No cloud access.

## Next
HERMES-CHANGE-PLAN-001
