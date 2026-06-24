# HERMES-BLOCKER-ROOT-CAUSE-001

## Summary
Implemented the first Blocker Root Cause diagnosis layer.

This layer formalizes the principle:

> Do not bypass blockers. Diagnose them. If the blocker is legitimate, change task or scope. If the blocker is erroneous, fix the policy/tooling/layer that produced it.

## Changed files
- `tools/hep/blocker-root-cause.ts`
- `tools/hep/__tests__/blocker-root-cause.test.ts`
- `tools/hep/index.ts`
- `_ai_work/REPORTS/HERMES-BLOCKER-ROOT-CAUSE-001.md`

## Model
The module classifies blockers into:
- `legitimate_block`
- `configuration_error`
- `tooling_false_positive`
- `architecture_gap`
- `dirty_state`
- `unknown`

Every diagnosis returns:
- category
- disposition
- bypassAllowed: always false
- safeToRetry
- requiresCleanup
- requiresPolicyChange
- requiresToolingFix
- requiresNewLayer
- recommendedTaskId when useful
- reasons
- nextSteps
- redacted evidence

## CLI
Added:

```powershell
node tools/hep/index.ts blocker-diagnose --taskId TASK-A --active-policy-task-id TASK-B --reason "Active policy task TASK-B differs from request task TASK-A"
```

The command prints both human-readable text and JSON.

## Safety behavior
This task does not permit bypassing any DENY, guardrail, policy, ownership, waiver, rollback, or protected-asset rule.

It only converts blocker evidence into a structured diagnosis and recommended safe fix.

## Known examples captured
- activeTaskId mismatch → configuration error
- appCodeChanges=false on UI target → policy configuration issue, recommend `HERMES-TASK-POLICY-APP-CODE-PERMISSION-001`
- dirty worktree → cleanup required
- missing rollback contract → architecture gap, recommend `HERMES-ROLLBACK-CONTRACT-001`
- CLI option inconsistency → tooling fix, recommend `HERMES-WAIVER-CLI-ID-RESPECT-001`

## Validation
Local validation completed:
- npm run lint: PASS
- npm test: PASS, 76 files / 792 tests
- npm run build: PASS

CLI smoke completed:
- policy task mismatch classified as `configuration_error`
- app UI code permission blocker classified as `configuration_error`
- app UI blocker recommends `HERMES-TASK-POLICY-APP-CODE-PERMISSION-001`
- every diagnosis keeps `bypassAllowed: false`
- CLI smoke

## Next recommended task
`HERMES-ROLLBACK-CONTRACT-001`

Rollback remains the next safety layer because Waiver Registry currently has rollback support but not a full structured rollback contract.
