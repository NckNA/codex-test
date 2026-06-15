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

`34e131b0d94a132f50c9dcb44d4d8da40b8482fd`

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

## Browser smoke

Not completed in this run.

Blocker: Chrome DevTools MCP is not available in this tool environment, so I cannot honestly perform the required browser click-through smoke.

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

Pending GitHub Actions CI for report metadata update commit.

Local checks not run in this tool environment:

- `npm run lint`
- `npm run test -- --run`
- `npm run build`
- `git status --short`

## Remaining known issues

- role label UX;
- dental photo upload/storage integration;
- tenant creation/onboarding flow;
- documents/payments/stock/subscription features pending;
- integration_tokens advisor info if still present.

## Final verdict

PARTIAL

Reason: implementation is present, but GitHub Actions CI and browser smoke are still pending.

## Recommended next task

`ROLE-LABEL-UX-001`
