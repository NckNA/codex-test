# ARCH-006: Review of ChiefComplaint Slice and Next Migration Plan

## 1. Scope
This report reviews the implementation of the first Data Access Layer (DAL) slice (`ARCH-005`), which migrated the Chief Complaint feature. It evaluates the implemented hooks and repository patterns, identifies risks, and proposes the next safest module to migrate.

## 2. Inputs Reviewed
- `_ai_work/REPORTS/ARCH-005_chief_complaint_adapter_hook_slice_report.md`
- `src/data/repositories/ChiefComplaintRepository.ts`
- `src/data/hooks/useChiefComplaint.ts`
- `src/components/dental/FindingsRisksTab.tsx`

## 3. ARCH-005 Implementation Summary
The `ChiefComplaint` slice was successfully migrated:
- `ChiefComplaintRepository` encapsulates `localStorage` calls behind Promise-based methods.
- `useChiefComplaint` manages async states (`isLoading`, `isSaving`, `error`).
- `FindingsRisksTab.tsx` uses the hook to fetch and save the complaint, keeping draft state synchronization safely inside the component using a narrow `eslint-disable` rule.
- `storage.ts` and `types/index.ts` were strictly preserved.

## 4. What Was Done Well
- **Limited Scope:** The migration was strictly isolated to the top half of `FindingsRisksTab.tsx`. The lower half (Findings list) remained on direct storage access without breaking.
- **Strict Typing:** No `any` casting was used. Proper verbatim module syntax (`import type`) was utilized.
- **UI Decoupling:** The UI component no longer calls `storage.saveChiefComplaint` directly and gracefully handles simulated async network states.

## 5. Risks or Issues Found
- **Synchronization Boilerplate:** Syncing remote persisted state into a local React `useState` draft required `eslint-disable-next-line react-hooks/set-state-in-effect`. While justified for this MVP, scaling this to complex forms will produce significant boilerplate.
- **Manual Refetching:** The hook must manually call its internal `fetchComplaint` after saving.
- **No Shared Error Boundary:** Errors are trapped in local component state.
- **Cross-Entity Coupling:** The current pattern does not address what happens if saving a treatment plan needs to invalidate the finding list.

## 6. Current Remaining Direct Storage Access
The application remains highly coupled to `localStorage` in:
- `PatientCardPage.tsx` (Reads all patient context arrays synchronously).
- `PatientHistoryTab.tsx` (Reads appointments).
- `PatientOverviewTab.tsx` (Reads mixed medical summaries).
- `DentalChartTab.tsx` (Reads/writes teeth condition and findings).
- `FindingsRisksTab.tsx` (Reads/writes/deletes findings).
- `TreatmentPlansTab.tsx` (Reads/writes plans).
- Lists: `PatientsPage`, `SchedulePage`.

## 7. Next Slice Options Comparison
- **Option A (Patient Appointments/History):** Mostly read-only list. Low risk, simple array.
- **Option B (Patient Overview):** High risk. Synchronously aggregates data from 4+ entities. Needs complex derived-data hooks.
- **Option C (Findings List):** High risk. Deeply coupled with treatment plan creation and chart status.
- **Option D (Dental Chart):** High risk. Requires massive state updates (32 teeth array) on every click.
- **Option E (Treatment Plans):** High risk. Requires cross-invalidation of Findings when a plan is created.

## 8. Recommended Next Migration Slice
**ARCH-007 — Migrate PatientHistoryTab / appointments read-only flow to async repository + hook.**

## 9. Why This Next Slice is Safest
Migrating the `PatientHistoryTab` (appointments) is the safest next step because:
- It is primarily a **read-only flow** in the context of the patient card.
- It validates the pattern for fetching and rendering **arrays/lists** using hooks without the complexity of mutations.
- It completely avoids cross-entity mutation complexity (appointments do not currently auto-update dental findings or plans).
- It allows us to build the `AppointmentRepository` and `usePatientAppointments` hook smoothly.

## 10. What Must NOT Be Migrated Next
- Do **NOT** migrate the Findings list or Treatment Plans. They require cross-hook invalidation strategies (creating a plan alters finding statuses) that are not yet designed.
- Do **NOT** migrate `PatientCardPage` global summaries yet.
- Do **NOT** introduce a global state manager (like React Query or Redux).
- Do **NOT** implement the backend.

## 11. Acceptance Criteria for Future ARCH-007
- Create `AppointmentRepository` with `listAppointmentsByPatient` method.
- Create `usePatientAppointments` hook returning an array of appointments with `isLoading`/`isError` states.
- Refactor `PatientHistoryTab.tsx` to use the new hook instead of passing down synchronous data from `PatientCardPage`.
- Preserve UI behavior, maintaining 0 lint errors and successful builds.

## 12. Recommended Next Task
**ARCH-007 — Migrate PatientHistoryTab / appointments read-only flow to async repository + hook.**
