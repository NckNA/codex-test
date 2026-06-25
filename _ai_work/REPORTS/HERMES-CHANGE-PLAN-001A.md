# HERMES-CHANGE-PLAN-001A Report

## Verdict

PASS

## Task

HERMES-CHANGE-PLAN-001A: HEP local change-plan module.

## What changed

Implemented a repo-local HEP change-plan module without touching DentalFlow application code.

Changed files:

- `tools/hep/change-plan.ts`
- `tools/hep/__tests__/change-plan.test.ts`
- `tools/hep/index.ts`
- `_ai_work/REPORTS/HERMES-CHANGE-PLAN-001A.md`

## What did not change

No changes were made to:

- `src/**`
- React UI
- DentalFlow pages/components/hooks
- Supabase migrations
- generated types
- seed files
- package.json
- package-lock.json
- cloud Supabase
- production credentials
- media files

## Implementation summary

Added `tools/hep/change-plan.ts` with typed local HEP change-plan primitives:

- `createChangePlan`
- `validateChangePlanInput`
- `validatePlanAgainstScope`
- `simulateChangePlan`
- `approveChangePlan`
- `revokeChangePlan`
- `comparePlannedToActual`
- `toStorageRecord`
- `normalizePlanPath`

The module supports:

- safe task ID and actor validation;
- safe relative path normalization;
- absolute path and traversal rejection;
- allowlist/prefix scope validation;
- planned-vs-actual changed file comparison;
- owner-review blocking for high/critical risk plans;
- approve/revoke state transitions;
- secret redaction through existing HEP redaction behavior.

Extended `tools/hep/index.ts` with minimal local CLI commands:

- `change-plan:create`
- `change-plan:simulate`
- `change-plan:approve`
- `change-plan:revoke`
- `change-plan:diff-check`

Created `tools/hep/__tests__/change-plan.test.ts` with coverage for:

- valid plan creation;
- unsafe task ID rejection;
- safe path normalization;
- traversal/absolute path rejection;
- allowlist pass/block;
- unplanned file detection;
- missing planned file detection;
- low/medium ALLOW simulation;
- high-risk owner-review BLOCK simulation;
- approved high-risk ALLOW simulation;
- revoke transition and revoked BLOCK simulation;
- redaction in storage records.

## Validation

Targeted test:

```bash
npx vitest run tools/hep/__tests__/change-plan.test.ts
```

Result:

- PASS
- 1 test file passed
- 12 tests passed

Full quality run:

```bash
npm test -- --run
npm run lint
npm run build
```

Result:

- PASS: test
- PASS: lint
- PASS: build
- 62 test files passed
- 632 tests passed

CLI smoke:

```bash
node tools/hep/index.ts change-plan:create --taskId HERMES-CHANGE-PLAN-001A --actor maintenance.autopilot --action modify --target tools/hep/change-plan.ts --riskLevel medium --summary "Smoke local change-plan CLI" --plannedFiles tools/hep/change-plan.ts,tools/hep/index.ts --createdBy Nick --rollbackRef feature/hermes-change-plan-001a
```

Result:

- PASS: emitted a redacted JSON change-plan record with active status.

Report validation:

- `report_validate` was attempted before opening a PR.
- It failed because no pull request exists yet for `feature/hermes-change-plan-001a`, not because of report content.

Notes:

- Existing React test warnings about `act(...)` appeared in stderr during the full test run.
- They did not fail the suite and are unrelated to this HEP tooling task.

## Risk / limitations

- The module is local tooling only. It does not yet enforce gates automatically before `git commit` or `git push`.
- Existing external smoke registries in `D:\hermes\memory\change-plans` and `D:\hermes\memory\changesets` were not modified.
- CLI commands are intentionally minimal and JSON-oriented; no interactive UX was added.

## Recommended next task

HERMES-CHANGESET-GATE-001A

Purpose: enforce planned-vs-actual file gates before commit/push using the new local change-plan module.
