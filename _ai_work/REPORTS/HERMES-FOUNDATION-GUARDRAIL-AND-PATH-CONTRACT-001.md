# HERMES-FOUNDATION-GUARDRAIL-AND-PATH-CONTRACT-001

## Summary

Fixed the Dependency Guard path contract before HERMES-DECISION-GATEWAY-001. Repo-relative HEP paths such as `tools/hep/index.ts` now resolve against the configured repository path instead of the Hermes workspace root.

Also added a small guardrail blocker reporting workflow for structured JSON/Markdown diagnostics when safe work is blocked by policy, safety layers, tooling contracts, or path contracts.

## Branch And Commits

- Branch: `feature/hermes-maintenance-trio-002-finalize`
- Commit before: `643ac3c feat(hep): add hazard registry`
- Commit after: recorded in final handoff because this report cannot contain the hash of the commit that includes itself

## Files Changed

- `tools/hep/dependency-guard.ts`
- `tools/hep/__tests__/dependency-guard.test.ts`
- `tools/hep/index.ts`
- `tools/hep/guardrail-blocker.ts`
- `tools/hep/__tests__/guardrail-blocker.test.ts`
- `_ai_work/REPORTS/HERMES-FOUNDATION-GUARDRAIL-AND-PATH-CONTRACT-001.md`

## Path Contract Implemented

Dependency Guard now supports these target path formats:

- Repo-relative: `tools/hep/index.ts`
  - Resolves against `projectPath` / `repositoryPath`.
  - Example: `D:\hermes\codex-test\tools\hep\index.ts`.

- Workspace-relative: `codex-test/tools/hep/index.ts`
  - Resolves against `workspaceRoot`.
  - Example: `D:\hermes\codex-test\tools\hep\index.ts`.

- Absolute path:
  - Allowed only when inside `workspaceRoot` or `projectPath`.
  - Outside roots is blocked by Dependency Guard path contract.

Traversal such as `../outside.txt` is blocked before disk inspection.

## Dependency Check Smoke Results

Repo-relative smoke:

```bash
node tools/hep/index.ts dependency-check --workspaceRoot D:\hermes --repositoryPath D:\hermes\codex-test --taskId HERMES-FOUNDATION-GUARDRAIL-AND-PATH-CONTRACT-001 --actor maintenance.autopilot --action inspect --target tools/hep/index.ts
```

Result:

- decision: `ALLOW`
- target path: `codex-test/tools/hep/index.ts`
- notes: `path-format:repo-relative`, `exists:file`
- `missing-on-disk`: not present

Workspace-relative smoke:

```bash
node tools/hep/index.ts dependency-check --workspaceRoot D:\hermes --repositoryPath D:\hermes\codex-test --taskId HERMES-FOUNDATION-GUARDRAIL-AND-PATH-CONTRACT-001 --actor maintenance.autopilot --action inspect --target codex-test/tools/hep/index.ts
```

Result:

- decision: `ALLOW`
- target path: `codex-test/tools/hep/index.ts`
- notes: `path-format:workspace-relative`, `exists:file`
- `missing-on-disk`: not present

## Observability Snapshot

Command:

```bash
node tools/hep/index.ts observability-snapshot --workspaceRoot D:\hermes --repositoryPath D:\hermes\codex-test --max-events 50 --max-reports 25
```

Status:

- overall: `green`
- eventsRead: `3`
- failures: `0`
- denied: `0`
- escalations: `0`
- outputs:
  - `D:\hermes\reports\active\observability-snapshot.json`
  - `D:\hermes\reports\active\observability-snapshot.md`

## Report Index Refresh

Command:

```bash
node tools/hep/index.ts reports-index --workspaceRoot D:\hermes --repositoryPath D:\hermes\codex-test --output D:\hermes\reports\indexes\report-index.json
```

Status:

- output exists: `D:\hermes\reports\indexes\report-index.json`
- total: `297`
- withTaskId: `181`
- orphaned: `116`
- stale: `56`
- blocked: `101`
- duplicateTaskIds: `17`

## Guardrail Blocker Workflow

Added:

- `tools/hep/guardrail-blocker.ts`
- `tools/hep/__tests__/guardrail-blocker.test.ts`
- CLI command: `guardrail-blocker-write`

The blocker workflow writes:

- `D:\hermes\reports\active\blockers-<TASK_ID>-blocker.json`
- `D:\hermes\reports\active\blockers-<TASK_ID>-blocker.md`

Required fields include task id, block type, expected capability, attempted tool/path, completed work, remaining work, safe next steps, cloud touched flag, repo dirty flag, and redaction status.

Secret redaction is applied before writing JSON or Markdown. The module does not read `.env` files.

## Validation Results

- `npm run lint`: passed
- `npm test -- tools/hep/__tests__/dependency-guard.test.ts`: passed, 14 tests
- `npm test -- tools/hep/__tests__/guardrail-blocker.test.ts`: passed, 3 tests
- `npm test`: passed, 70 files / 683 tests
- `npm run build`: passed

Build warning:

- Vite reports one bundle chunk over 500 kB after minification. This is a warning, not a build failure.

## Limitations

- This task does not weaken existing guardrails.
- This task does not change cloud Supabase, migrations, app UI, generated types, package files, or secrets.
- The blocker writer records diagnostics only; it does not override policy decisions.
- Dependency Guard still defaults to conservative decisions for risky mutations.

## Recommended Next Task

`HERMES-DECISION-GATEWAY-001`
