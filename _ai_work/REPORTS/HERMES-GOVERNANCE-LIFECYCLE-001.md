# HERMES-GOVERNANCE-LIFECYCLE-001

## Status
Implemented locally.

## Scope
Added a HEP lifecycle finalizer that updates Hermes task, PR, and worktree registries after task review or merge.

## Changes
- Added `tools/hep/lifecycle-finalizer.ts`.
- Added CLI command `lifecycle-finalize` to `tools/hep/index.ts`.
- Added isolated tests in `tools/hep/__tests__/lifecycle-finalizer.test.ts`.
- Lifecycle finalizer can:
  - move a task registry entry from `ACTIVE_POLICY` to `MERGED`;
  - record previous task status;
  - upsert PR registry metadata;
  - mark matching task worktrees as `ARCHIVE_CANDIDATE`;
  - keep stable project checkout `D:/hermes/codex-test` protected from archive recommendations;
  - append reversible lifecycle action logs;
  - support `--dry-run` with no registry writes.

## Safety posture
- No files are moved.
- No files are deleted.
- Stable project checkout `codex-test` is explicitly protected even if an old worktree registry entry has stale branch metadata.
- Completed task worktrees are only marked as archive candidates.
- Policy archive remains a recommendation for a later reversible policy archive task.

## Real workspace dry-run
Executed dry-run against `PAYMENTS-DEBTS-RPC-CLIENT-001D` / PR #328.

Result:
- Status: `MERGED`
- Updated files: `0` because dry-run
- Archive recommendation: `D:/hermes/payments-debts-rpc-client-001d-work`
- Stable project root `D:/hermes/codex-test` was not recommended for archive.

The real non-dry-run CLI application was attempted but blocked by the local safety layer, so real registry files under `D:/hermes/memory` were not modified during this task.

## Validation
- `npm run lint`: passed.
- `npm test`: passed, 62 test files, 628 tests.
- `npm run build`: passed.

## Known pre-existing warnings
- Existing React `act(...)` test warnings remain.
- Existing Vite chunk-size warning remains for the main JS bundle.

## Files changed
- `tools/hep/lifecycle-finalizer.ts`
- `tools/hep/index.ts`
- `tools/hep/__tests__/lifecycle-finalizer.test.ts`
- `_ai_work/REPORTS/HERMES-GOVERNANCE-LIFECYCLE-001.md`

## Final verdict
Lifecycle finalizer implemented and verified. Real registry application is code-ready but was blocked by the local command safety layer in this session.

## Next recommended task
HERMES-REPORTS-INDEX-001: build a durable report index that links report -> taskId -> PR -> branch -> status and flags orphan/stale/conflicting reports.
