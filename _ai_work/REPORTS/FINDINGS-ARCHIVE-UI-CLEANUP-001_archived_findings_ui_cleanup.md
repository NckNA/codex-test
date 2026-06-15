# FINDINGS-ARCHIVE-UI-CLEANUP-001 archived findings UI cleanup

## Summary

Implemented archived finding UI cleanup and treatment-plan eligibility safety.

Archived findings are now treated as history-only records instead of active clinical findings:

- archive wording replaces fake delete wording;
- archived findings are hidden from active finding sections by default;
- archived findings are available only behind an explicit archive toggle;
- archived findings are excluded from create-plan candidates, even when linked to an active plan;
- clinical summary active counters use explicit active finding status filtering.

## Branch

`feature/findings-archive-ui-cleanup-001`

## PR URL

https://github.com/NckNA/codex-test/pull/289

## PR head reviewed before final report update

`5f35ac61d183c1a8cba7b1b9e10ad04468d5796c`

## Report update commit

N/A because the final report update commit cannot reference itself before creation.

## Changed files summary

Changed files expected in this PR:

- `src/domain/findingStatus.ts`
- `src/components/dental/FindingsRisksTab.tsx`
- `src/components/dental/FindingsRisksTab.test.tsx`
- `src/components/treatment/CreatePlanFromFindingsModal.tsx`
- `src/components/treatment/CreatePlanFromFindingsModal.test.tsx`
- `src/data/aggregators/ClinicalSummaryAggregator.ts`
- `src/data/aggregators/ClinicalSummaryAggregator.test.ts`
- `_ai_work/REPORTS/FINDINGS-ARCHIVE-UI-CLEANUP-001_archived_findings_ui_cleanup.md`

## Root cause

Finding repository delete behavior archives records, but the UI still said delete and active workflows could treat archived findings too visibly.

The create-plan modal excluded completed and declined findings but did not explicitly exclude archived findings in all linked-plan cases.

## Domain/helper changes

Updated `src/domain/findingStatus.ts` with explicit helpers:

- `isActiveFindingStatus`
- `isInactiveFindingStatus`
- `isArchivedFindingStatus`
- `isFindingEligibleForTreatmentPlan`

Active statuses:

- `discovered`
- `planned`
- `in_treatment`
- `monitoring`

Inactive statuses:

- `completed`
- `declined_by_patient`
- `archived`

Treatment-plan candidate statuses for new selection:

- `discovered`
- `monitoring`

## Findings UI changes

Updated `src/components/dental/FindingsRisksTab.tsx`:

- archive action wording now says archive;
- confirm message now explains the record disappears from active lists but remains in history;
- archived findings are removed from active sections by default;
- completed and declined findings remain in the inactive/history section;
- archived findings are shown only after explicit `Показать архивные записи` toggle;
- archived cards are muted/history-only;
- archived cards do not show active status action buttons;
- archived cards do not show the active `В план` badge.

## Create plan modal changes

Updated `src/components/treatment/CreatePlanFromFindingsModal.tsx`:

- archived findings are never visible as selectable create-plan candidates;
- archived findings linked to active plans are still hidden;
- completed and declined findings remain excluded;
- valid active findings linked to an active plan remain visible as disabled;
- empty-state text now mentions archived findings.

## Clinical summary changes

Updated `src/data/aggregators/ClinicalSummaryAggregator.ts` to calculate active finding counters from `isActiveFindingStatus`.

Archived findings are excluded from active recommendation/risk counters.

## Tests

Updated/added tests:

- `src/components/dental/FindingsRisksTab.test.tsx`
  - archived findings hidden from active sections by default;
  - archive toggle shows archived findings only in archive section;
  - confirm text says archive;
  - archive action still uses existing `deleteFinding` archive path;
  - archived cards do not show active status buttons or active plan badge.

- `src/components/treatment/CreatePlanFromFindingsModal.test.tsx`
  - discovered findings appear;
  - monitoring findings appear;
  - completed findings are hidden;
  - declined findings are hidden;
  - archived findings are hidden;
  - archived findings linked to active plan remain hidden;
  - active linked findings remain visible as disabled;
  - empty-state text mentions archived findings.

- `src/data/aggregators/ClinicalSummaryAggregator.test.ts`
  - archived urgent findings are excluded from active high/urgent counters;
  - completed/declined behavior remains inactive;
  - unrelated localStorage mutation safety remains covered.

## GitHub Actions failure root cause and fix

GitHub Actions run `27567348795`, job `81494655312`, failed only in `Run tests`.

Two tests in `src/components/dental/FindingsRisksTab.test.tsx` located the `Архивные записи` heading and then asserted against its immediate parent. The immediate parent contains only the archive heading, explanation, and toggle; archived cards are rendered in the surrounding `<section>`. The production archive behavior was correct, but the assertions searched the wrong DOM scope.

The fix changes both test locators to use `closest('section')`. No production code or archive requirements were weakened.

## Browser smoke

Partially completed in local dev fallback mode at `http://127.0.0.1:5177/patients/p1`.

Confirmed:

- active `Кариес 47 зуба` appears in `Проблемы и риски`;
- active archive wording is `Архивировать запись Кариес 47 зуба`;
- `Кариес 47 зуба` and `Начальный кариес 24 зуба` appear in `Создать план из проблем` before archiving.

Blocker:

- clicking the archive action opened the native `window.confirm` dialog;
- the available in-app browser control timed out while the dialog was open and could not accept or dismiss it;
- post-confirm disappearance, archive-toggle visibility, create-plan exclusion after archive, and reload persistence could not be honestly verified in this run.

The archive confirmation wording and post-archive UI rules remain covered by automated tests, but this does not replace the blocked browser steps.

## What was intentionally NOT changed

- No DB migration.
- No cloud apply.
- No RLS changes.
- No hard delete.
- No dictionary/template changes.
- No `MedicalPage` changes.
- No repository archive semantics changes.
- No package/dependency changes.

## Checks

Local working tree before staging:

- modified allowed file: `src/components/dental/FindingsRisksTab.test.tsx`;
- modified allowed report: this file;
- pre-existing untracked `_ai_work/scratch/`, `outputs/`, `pr.txt`, `seed_output.sql`, and `temp.md` were not modified or staged.

Results:

- `npm run lint`: PASS.
- focused `npm run test -- --run src/components/dental/FindingsRisksTab.test.tsx`: PASS, 3/3 tests.
- `npm run test -- --run` with the local `.env.local`: FAIL in the unrelated `AuthContext (Dev Fallback)` test because local Supabase configuration selects `supabase-active` instead of the expected `dev` mode.
- `npm run test -- --run` in CI-equivalent env-neutral mode: PASS, 36 test files and 279 tests.
- `npm run build`: PASS. Vite emitted the existing large-chunk warning.

GitHub Actions CI after push: PASS.

- run id: `27570027075`;
- workflow: `CI #424`;
- conclusion: `success`;
- tested commit: `5f35ac61d183c1a8cba7b1b9e10ad04468d5796c`.

## Remaining known issues

- role label UX;
- dental photo upload/storage integration;
- tenant creation/onboarding flow;
- documents/payments/stock/subscription features pending;
- integration_tokens advisor info if still present.

## Final verdict

PARTIAL

Reason: GitHub Actions CI is green on tested commit `5f35ac61d183c1a8cba7b1b9e10ad04468d5796c`, and automated coverage validates the archive boundary. The post-confirm browser archive flow remains blocked by the native `window.confirm` / browser tooling limitation, so the report cannot honestly be promoted to `READY FOR REVIEW` without accepting the missing browser completion.

## Recommended next task

`ROLE-LABEL-UX-001`
