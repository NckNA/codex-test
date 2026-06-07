# MVP-002 Extract Patient Card Tabs Report

## What was extracted
To reduce the complexity and size of `PatientCardPage.tsx` (which acted as a "God Component"), the inline JSX for the "Overview" (`overview`) and "Appointment History" (`history`) tabs was extracted into separate presentational components. The helper functions formatting data specifically for these tabs (e.g., `getSourceLabel`, `getStatusLabel`, `getStatusColor`) were also moved to their respective new components.

## New files created
- `src/components/patients/patient-card/PatientOverviewTab.tsx`
- `src/components/patients/patient-card/PatientHistoryTab.tsx`

## Files changed
- `src/pages/PatientCardPage.tsx`:
  - Removed 5 helper formatting functions.
  - Replaced nearly 300 lines of inline tab JSX with the new `<PatientOverviewTab />` and `<PatientHistoryTab />` components.
  - Passed required properties down (`patient`, `dentalSummary`, `appointments`, etc.).

## What behavior was intentionally preserved
- The visual layout, styles, icons, and spacing are 100% identical.
- Tab switching logic remains in the parent (`PatientCardPage.tsx`).
- Medical data fetching (local storage) and derived state `useMemo` hooks remain in the parent for now, to ensure no state logic or data model changes occurred.
- The "Перейти в расписание" button still navigates correctly to `/`.

## What was not changed
- No medical behavior, dental chart, or treatment plan logic was modified.
- No storage logic or backend architecture was changed.
- No global `PatientContext` was introduced in this step to keep the refactoring scope safe and minimal.
- The pre-existing ESLint warning in `DentalChartTab.tsx` was not touched.

## Remaining risks after this refactor
- `PatientCardPage.tsx` still handles fetching data from `localStorage` directly for all tabs and computing heavy summaries. A future task should consider moving this into a custom hook or Context (`usePatientCardData`).
- The other tabs (Dental Chart, Findings, Plans) also directly read/write from `localStorage`, meaning state updates might occasionally require full-page re-renders or careful event listening if the prototype grows further.

## Recommended next task
**MVP-003 — Stabilize complaint → finding → treatment plan flow.**
This task should address the functional overlap between the Dental Chart and Findings tabs, ensuring the core medical workflow is fully stable before further refactoring.
