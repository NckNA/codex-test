# HERMES-DEPENDENCY-GUARD-001C

## Status

Implemented and validated locally.

## Scope

Added the HEP Dependency Guard as a governance-only safety layer. It does not move, delete, migrate, reset, or deploy anything. It only evaluates dependency impact, returns a decision, and can write an impact-ledger entry for approved impact-plan cases.

## Changed files

- `tools/hep/dependency-guard.ts`
- `tools/hep/index.ts`
- `tools/hep/__tests__/dependency-guard.test.ts`
- `_ai_work/REPORTS/HERMES-DEPENDENCY-GUARD-001C.md`

## Implemented behavior

Dependency Guard now supports these decisions:

- `ALLOW`
- `DENY`
- `REQUIRE_WAIVER_PLAN`
- `ALLOW_WITH_IMPACT_PLAN`
- `ESCALATE`

It checks:

- low-risk `read` / `index` actions;
- default denial for `delete`;
- protected and critical assets;
- active leases owned by another task or actor;
- dependency graph references;
- unknown risky ownership;
- valid impact plans with compensating tasks, required validations, and rollback plan.

## CLI

Added:

- `dependency-init`
- `dependency-check`

`dependency-init` creates baseline dependency files only when missing:

- `memory/dependency-assets.json`
- `memory/dependency-leases.jsonl`
- `memory/dependency-graph.json`
- `logs/dependency-impact-ledger.jsonl`

`dependency-check` requires:

- `--taskId`
- `--actor`
- `--action`
- `--target`

Optional flags:

- `--allow-impact-plan`
- `--dry-run`
- `--reason`
- `--write-audit`

The CLI prints the decision result and only writes an impact-ledger entry for `ALLOW_WITH_IMPACT_PLAN` when `--write-audit` is used without `--dry-run`.

## Validation

- `npm run lint`: passed
- `npm test -- tools/hep/__tests__/dependency-guard.test.ts`: passed
- `npm test`: passed
- `npm run build`: passed
- CLI smoke test: passed
- `npx tsc -p tsconfig.node.json --noEmit`: passed

## Notes

- No Supabase cloud, migrations, secrets, CRM app logic, package files, or deployment settings were touched.
- No branch push or PR merge was performed by this task.
- The guard is intentionally conservative: risky unknown changes escalate, delete is denied by default, and dependency-linked mutation needs a waiver/impact plan.

## Recommended next task

`HERMES-MAINTENANCE-AUTOPILOT-001B`
