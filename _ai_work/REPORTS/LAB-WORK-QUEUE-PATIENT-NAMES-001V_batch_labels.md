# QA Report: LAB-WORK-QUEUE-PATIENT-NAMES-001V

## Final verdict

**PASS**

## Branch

feature/lab-work-queue-patient-names-001v

## PR URL

https://github.com/NckNA/codex-test/pull/398

## Environment

local-only; cloud Supabase forbidden/not used

## Summary

Replaced the laboratory queue's broad tenant-wide patient hydration with a minimal exact-ID label read. The new PatientRepository capability normalizes and deduplicates IDs, chunks requests to at most 100 IDs, selects only id/full_name, keeps archived patient labels available for historical laboratory rows, and enforces tenant scope. useLaboratoryWorkQueue no longer calls listPatients() and fails the secondary label read closed rather than falling back to broad patient loading.

## Checks

- Targeted tests: 2 files / 26 tests PASS.
- Full Vitest: 129 test files / 1321 tests PASS.
- ESLint: PASS.
- Build: PASS.
- git diff --check: PASS.
- useLaboratoryWorkQueue listPatients() calls: 0.
- Local Supabase reset: PASS.
- patients schema/RLS assertions: 7/7 PASS.
- Live local RLS smoke: PASS.
- Synthetic patient cleanup: 0 rows remaining.
- Browser QA not required for this data-only task. The localhost site remains running for user inspection.

## Browser smoke

Not required for this data-only task. No UI behavior changed. The existing localhost site remains running for user inspection, and no browser result is used as evidence for the repository refactor.

## Validation

Repository contract:
- Empty input short-circuits without Supabase.
- IDs are trimmed, deduplicated and sorted.
- Supabase requests are chunked to at most 100 IDs.
- SELECT is limited to `id,full_name`.
- `tenant_id` predicate is applied on every chunk.
- Archived patients are intentionally not filtered out because historical laboratory rows must retain patient names.
- A failed chunk stops and propagates the secondary-read error.

Queue contract:
- Uses exact patient IDs derived from loaded laboratory orders.
- Does not call `listPatients()`.
- Missing label capability fails the secondary label read closed and does not fall back to broad loading.
- Secondary label failure keeps primary laboratory orders visible.
- Filter and tenant/user context changes clear stale labels.
- Unknown patient IDs are never substituted as raw display names.

Live local Supabase evidence:
- Admin A returned active and archived Clinic A labels.
- Admin B returned only the Clinic B label.
- Admin A using a repository configured with Clinic B tenant ID still returned no Clinic B rows because RLS remained authoritative.
- Result shape contained only `id` and `fullName`.
- All synthetic patient rows were deleted and verified at zero.

## Changed files

- `src/data/repositories/PatientRepository.ts`
- `src/data/repositories/PatientRepository.test.ts`
- `src/data/hooks/useLaboratoryWorkQueue.ts`
- `src/data/hooks/useLaboratoryWorkQueue.test.tsx`
- `_ai_work/REPORTS/LAB-WORK-QUEUE-PATIENT-NAMES-001V_batch_labels.md`

## Roles tested

- QA Admin A
- QA Admin B

## Scope boundaries

- No UI changes.
- No migrations or schema changes.
- No mutation changes.
- No MacDent or amoCRM interaction.
- No cloud Supabase access.

## CI

- Implementation commit: `e9ea55dcfbf5855d6715319ad3263062c89bdfd4`.
- Implementation CI: run `#867` / `32260325281`, **SUCCESS** on `e9ea55dcfbf5855d6715319ad3263062c89bdfd4`.
- Final report update commit: N/A because the report cannot contain its own future SHA; final evidence is persisted after publication.

## Issues / limitations

- `SupabaseLaboratoryWorkRepository.listOrders()` remains application-level unpaginated. This task only bounds patient label hydration.
- Other broad patient reads outside the laboratory queue remain outside 001V scope.
- Existing unrelated React `act(...)` warnings, Vite chunk warning and npm audit findings remain baseline.
- Hermes active task policy is globally shared and has repeatedly been overwritten by parallel tasks. 001V policy was re-applied before guarded operations.

## Recommended Next Task

`LAB-WORK-QUEUE-PAGINATION-RECON-001W`: report-only reconnaissance for bounded/paginated tenant-wide laboratory order loading before changing `listOrders()` or queue UX.
