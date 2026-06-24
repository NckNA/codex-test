# HERMES-DECISION-POLICY-001

## Summary

Extracted and formalized high-level decision rules into a separate Decision Policy layer (`tools/hep/decision-policy.ts`). This ensures the Decision Gateway remains a coordinator and delegator, while the Decision Policy acts as a pure, stateless rule-evaluation engine.

The Decision Policy evaluates the complete, comprehensive rule set, gathers all matching rule IDs, and determines the final decision using strict precedence resolution:

`DENY > ESCALATE > REQUIRE_PLAN > DRY_RUN_ONLY > ALLOW`

Key highlights:
1. **Pure Stateless Evaluation**: The Decision Policy receives normalized signals from all sources (Guardian ACL, Dependency Guard, Hazard Registry, local task policy) and evaluates them without side-effects or on-disk checks.
2. **Precedence Resolution**: Ensures the highest-priority decision wins (e.g., any `DENY` override any `ESCALATE` or `ALLOW`).
3. **Hard-Stop Critical Hazards**: Explicitly maps active critical hazards (`HAZARD_CRITICAL_ACTIVE`) to `DENY` rather than `ESCALATE`, blocking execution until resolved.
4. **Matched Rules Surfacing**: All triggered rule IDs are collected and returned on the root level and under the policy result block.
5. **New CLI Command**: Added `decision-policy-check` to run gateway checks but format and output only policy-specific fields.

## Changed Files

- [NEW] `tools/hep/decision-policy.ts` (Pure Decision Policy rule engine)
- [NEW] `tools/hep/__tests__/decision-policy.test.ts` (Comprehensive 27-test suite for policy rules)
- [MODIFY] `tools/hep/decision-gateway.ts` (Delegates evaluation to Decision Policy; exposes `matchedRules` and `decisionPolicyResult`)
- [MODIFY] `tools/hep/__tests__/decision-gateway.test.ts` (Added 3 integration tests verifying rule integration)
- [MODIFY] `tools/hep/index.ts` (Added `decision-policy-check` command and help usage)
- [NEW] `D:\hermes\memory\decision-policy.json` (Decision Policy metadata file)
- [NEW] `_ai_work/REPORTS/HERMES-DECISION-POLICY-001.md` (This report)

## Implemented Rule Table

| Rule ID | Decision | Description / Rationale |
| :--- | :--- | :--- |
| `MISSING_REQUIRED_SIGNAL` | `ESCALATE` | Guardian or Dependency signal is absent |
| `POLICY_TASK_MISMATCH` | `ESCALATE` | `activeTaskId` differs from `taskId` |
| `POLICY_APP_CODE_FORBIDDEN` | `DENY` | `appCodeChanges` is false and target is app code (`src/**`) |
| `POLICY_MIGRATIONS_FORBIDDEN` | `DENY` | `migrations` is false and target is migrations (`supabase/migrations/**`) |
| `GUARDIAN_DENY` | `DENY` | Guardian ACL decision is `DENY` |
| `GUARDIAN_ESCALATE` | `ESCALATE` | Guardian ACL decision is `REQUIRE_APPROVAL` |
| `GUARDIAN_DRY_RUN` | `DRY_RUN_ONLY` | Guardian ACL decision is `REQUIRE_DRY_RUN` |
| `PATH_OUTSIDE_ALLOWED_ROOTS` | `DENY` | Target path is outside the allowed workspace roots |
| `DEPENDENCY_DENY` | `DENY` | Dependency Guard decision is `DENY` |
| `DEPENDENCY_ESCALATE` | `ESCALATE` | Dependency Guard decision is `ESCALATE` |
| `DEPENDENCY_REQUIRE_PLAN` | `REQUIRE_PLAN` | Dependency Guard requires impact/waiver plan |
| `HAZARD_CRITICAL_ACTIVE` | `DENY` | Active critical hazard (hard stop) |
| `HAZARD_HIGH_ACTIVE` | `ESCALATE` | Active high hazard (manual review) |
| `HAZARD_MEDIUM_ACTIVE` | `REQUIRE_PLAN` | Active medium hazard (impact plan required) |
| `HAZARD_LOW_ACTIVE` | `ALLOW` | Active low hazard (warning only, no block) |
| `MAINTENANCE_WRITE_WITHOUT_DRY_RUN` | `DRY_RUN_ONLY` | Write-class action executed without `dryRun: true` |
| `ALLOW_DEFAULT` | `ALLOW` | Baseline option when no other rules match |

## CLI Commands

### 1. Run Policy Check Only
Outputs only the policy-relevant fields:
```bash
node tools/hep/index.ts decision-policy-check --workspaceRoot D:\hermes --repositoryPath D:\hermes\codex-test --taskId HERMES-DECISION-POLICY-001 --actor maintenance.autopilot --action inspect --target tools/hep/index.ts --target-type file --no-write-event
```

### 2. Run Full Gateway Check
Outputs full diagnostic JSON containing `matchedRules` and `decisionPolicyResult` on the root level:
```bash
node tools/hep/index.ts decision-check --workspaceRoot D:\hermes --repositoryPath D:\hermes\codex-test --taskId HERMES-DECISION-POLICY-001 --actor maintenance.autopilot --action inspect --target tools/hep/index.ts --target-type file --no-write-event
```

## Test and Verification Results

- **`npm run lint`**: Passed clean.
- **`npm test`**: Passed all **72 test files, 729 tests** (including 27 new tests in `decision-policy.test.ts` and 3 integration tests in `decision-gateway.test.ts`).
- **`npm run build`**: Passed clean (Vite build completed, output bundle generated).

### Smoke Test Summaries

1. **Smoke A (decision-policy-check)**:
   Returned `ESCALATE` with `matchedRules: ["POLICY_TASK_MISMATCH"]` because the active policy task is set to `HERMES-FOUNDATION-AUDIT-FIX-001` (as expected).
2. **Smoke B (decision-check)**:
   Surfaced `matchedRules: ["POLICY_TASK_MISMATCH"]` and the full `decisionPolicyResult` on the root level and under `signals`.
3. **Smoke C (traversal DENY)**:
   Returned `DENY` with multiple matched rules: `["POLICY_TASK_MISMATCH", "GUARDIAN_DENY", "PATH_OUTSIDE_ALLOWED_ROOTS", "DEPENDENCY_DENY"]`.
4. **Smoke D (observability-report)**:
   Correctly captured status without failure, noting existing events.

## Recommended Next Steps

- Proceed with finalizing the maintenance trio tasks or executing policy updates as required.
