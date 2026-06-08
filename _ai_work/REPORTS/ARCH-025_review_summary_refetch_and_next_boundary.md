# ARCH-025: Review Summary Refetch and Next Boundary

## 1. Title
ARCH-025 — Review tab-change summary refetch implementation and decide next migration boundary.

## 2. Scope
This report reviews the implementation of the tab-change medical summary refetch (ARCH-024) within `PatientCardPage`, evaluates the current stabilized architecture baseline, and determines the safest next boundary for migration away from direct `storage.ts` reads.

## 3. Inputs Reviewed
- `_ai_work/REPORTS/ARCH-024_patient_card_tab_change_summary_refetch_report.md`
- `src/pages/PatientCardPage.tsx`
- `src/components/patients/patient-card/PatientOverviewTab.tsx`
- `src/data/hooks/usePatientMedicalSummary.ts`
- `src/data/aggregators/ClinicalSummaryAggregator.ts`
- `src/data/hooks/useAsyncQuery.ts`
- `src/components/dental/DentalChartTab.tsx`
- `src/components/dental/FindingsRisksTab.tsx`
- `src/components/treatment/TreatmentPlansTab.tsx`
- `src/pages/SchedulePage.tsx`
- `src/utils/storage.ts`
- `src/types/index.ts`

## 4. ARCH-024 Implementation Review
- **Does PatientCardPage refetch the summary on return to Overview?** Yes.
- **Was the initial double-fetch avoided?** Yes, via `previousTabRef`.
- **Was PatientOverviewTab changed?** No, it remains purely presentational.
- **Were clinical tabs changed?** No.
- **Were hooks/aggregator changed?** No.
- **Was global state/event bus/Context introduced?** No.
- **Is the summary refresh boundary now acceptable for MVP?** Yes. The most critical user flow (editing a sibling tab and returning to overview) now correctly shows fresh data without architectural bloat.

## 5. Current Migrated Architecture Baseline
The following areas have been successfully migrated to the new Data Access Layer (DAL) pattern:
- ChiefComplaint query flow
- PatientHistory appointments read-only flow
- PatientHistory doctors read-only flow
- `useAsyncQuery` / `useAsyncMutation` utility layers
- `ClinicalSummaryAggregator`
- `usePatientMedicalSummary` integration in `PatientCardPage`
- Loading, error handling, and tab-change refetch mechanisms for the medical summary.

## 6. Remaining Direct Storage Access Areas
The following components still directly read or mutate `storage.ts`:
- Patient profile loading/editing in `PatientCardPage` (`storage.getPatients()`, `storage.updatePatient()`)
- Patient list/search pages
- `SchedulePage` appointment mutation/read flows
- `DentalChartTab` write-heavy flow
- `FindingsRisksTab` findings/risk list write-heavy flow
- `TreatmentPlansTab` write-heavy flow

## 7. Risk Review of Next Boundary Options
- **Option A (Patient profile loading/editing)**: Low risk. This logic is highly isolated to the top level of `PatientCardPage` and the `PatientModal`. It sets the stage for full backend isolation of the patient identity without touching deep clinical data.
- **Option B (Patient list/search)**: Medium risk. Involves search algorithms and list rendering that may need pagination design soon.
- **Option C (SchedulePage appointments)**: High risk. Involves complex calendar UI and mutation flows.
- **Option D, E, F (DentalChart, Findings, TreatmentPlans)**: Very High risk. These are heavily coupled, complex mutation flows. Moving them to the DAL right now before the top-level patient entity is secured poses a high risk of regressions.

## 8. Options Comparison
Migrating write-heavy clinical modules (Options D, E, F) is too risky until we have fully secured the core entity (the Patient profile). Moving `PatientCardPage`'s patient loading to a `PatientRepository` (Option A) continues the established DAL pattern, cleanly finishes the read/write isolation for the top-level patient card, and avoids touching the tangled clinical logic.

## 9. Recommended Next Boundary
The next safest migration boundary is the patient profile loading and editing logic within `PatientCardPage`. 

## 10. Why This Next Boundary is Safest
- **Should DentalChart/Findings/TreatmentPlans be migrated next?** No.
- **Should Patient profile loading/editing be the next safer DAL boundary?** Yes.

This is patient-scoped and isolated. It continues the proven hook/repository migration pattern without disrupting the highly sensitive clinical modules. It completely decouples `PatientCardPage` from direct `storage.ts` imports, preparing the app for backend connection without risking core medical logic.

## 11. What Must NOT Be Migrated Next
- `DentalChartTab`
- `FindingsRisksTab`
- `TreatmentPlansTab`
- `SchedulePage`
- Patient list/search pages (unless explicitly grouped into the patient domain planning later).

## 12. Acceptance Criteria for Future ARCH-026
- **Design Only**: Do not implement code yet.
- **Define PatientRepository**: Outline the contract for fetching and updating patient profiles.
- **Define usePatientProfile(patientId)**: Design the hook contract using `useAsyncQuery` and `useAsyncMutation`.
- **Preserve PatientModal**: Ensure the design accommodates the existing editing modal flow.
- **No clinical modifications**: Do not touch clinical modules.

## 13. Recommended Next Task
**ARCH-026 — Design PatientRepository / usePatientProfile contract for PatientCardPage patient loading/editing.**
