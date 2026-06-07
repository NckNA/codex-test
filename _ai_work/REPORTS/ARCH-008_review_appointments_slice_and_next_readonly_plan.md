# ARCH-008: Review of Appointments Slice and Next Read-Only Plan

## 1. Scope
This report reviews the implementation of the second Data Access Layer (DAL) slice (`ARCH-007`), which migrated the `PatientHistoryTab` appointments rendering to a read-only async hook. It evaluates the implemented pattern, identifies emerging architectural issues (like boilerplate duplication and coupling), and proposes the next safest read-only module to migrate.

## 2. Inputs Reviewed
- `_ai_work/REPORTS/ARCH-007_patient_history_appointments_hook_report.md`
- `src/data/repositories/AppointmentRepository.ts`
- `src/data/hooks/usePatientAppointments.ts`
- `src/components/patients/patient-card/PatientHistoryTab.tsx`
- `src/pages/PatientCardPage.tsx`
- `src/utils/storage.ts`
- `src/types/index.ts`
- `src/data/repositories/ChiefComplaintRepository.ts`
- `src/data/hooks/useChiefComplaint.ts`

## 3. ARCH-007 Implementation Summary
The `PatientHistoryTab` appointments slice was successfully migrated:
- `AppointmentRepository` safely encapsulated `storage.getAppointments()` with filtering and sorting moved out of the UI.
- `usePatientAppointments` provided a clean, read-only API with robust loading and error states.
- `PatientHistoryTab.tsx` transitioned to fetching its own appointments via the hook, dropping the `appointments` array prop.
- `PatientCardPage.tsx` was minimally updated to pass `patientId` instead of the appointments array to the tab.

## 4. What Was Done Well
- **Strict Adherence to Scope:** Only the appointments list within `PatientHistoryTab` was migrated. Schedule Page, mutations, and the `PatientOverviewTab` were untouched.
- **Data Integrity:** `storage.ts` and `types/index.ts` remained completely unmodified.
- **Safety:** No `any` casting was used, ensuring strict TypeScript compliance.
- **Visual Consistency:** The tab's UI layout and empty states remained completely unchanged, seamlessly integrating the async loader.

## 5. Risks or Issues Found
- **Hook Boilerplate Duplication:** The internal `useState` and `useEffect` structure for tracking `isLoading`, `isError`, and `mounted` flags is practically identical between `useChiefComplaint` and `usePatientAppointments`. Without a shared utility or a library like React Query, this boilerplate will become unwieldy.
- **Summary Logic Duplication:** `PatientCardPage.tsx` still synchronously fetches the entire appointments list just to calculate `lastVisit` and `nextVisit`. This highlights the difficulty of migrating aggregate headers without dedicated backend endpoints.
- **No Caching:** Data is refetched from scratch every time the tab mounts.

## 6. Current Remaining Direct Storage Access
Direct `localStorage` calls persist heavily across the app, specifically in:
- `PatientCardPage.tsx` (Summary calculations and Doctors list).
- `PatientOverviewTab.tsx` (Mixed medical summaries).
- `DentalChartTab.tsx` & `FindingsRisksTab.tsx` (Dental records).
- `TreatmentPlansTab.tsx` (Treatment planning).
- `SchedulePage.tsx` (Global schedule).

## 7. PatientHistoryTab Remaining Coupling
Although `PatientHistoryTab` now independently fetches its appointments, it still receives the `doctors` array as a prop from `PatientCardPage`. This forces the parent component to synchronously fetch and hold the entire clinic's doctors list, preventing the tab from being fully self-contained.

## 8. Next Read-Only Slice Options Comparison
- **Option A (Doctors lookup for PatientHistoryTab):** Small, read-only, global-scoped list. Removes the last external prop from `PatientHistoryTab`.
- **Option B (Patient details via PatientRepository):** Medium risk. Requires updating the global layout header and edit modals.
- **Option C (Patient list):** Medium risk. Wide impact across the application.
- **Option D (SchedulePage):** High risk. Complex drag-and-drop state.
- **Option E (PatientOverviewTab):** Very high risk. Depends on all medical modules.

## 9. Recommended Next Migration Slice
**ARCH-009 — Migrate PatientHistoryTab doctors lookup to async DoctorRepository + useClinicDoctors hook.**

## 10. Why This Next Slice is Safest
Migrating the doctors lookup is the safest next step because:
- It is entirely **read-only**.
- It is a small, globally scoped list, which validates a new data-access pattern (clinic-level data vs. patient-level data).
- It completely eliminates `PatientHistoryTab`'s dependency on `PatientCardPage` for data arrays.
- It avoids the complexities of mutations, the dental chart, treatment plans, and schedule views.

## 11. What Must NOT Be Migrated Next
- Do **NOT** migrate `PatientOverviewTab`, `SchedulePage`, or any dental/treatment features yet.
- Do **NOT** migrate `PatientCardPage` summary logic.
- Do **NOT** introduce global state managers (like React Query or Redux) or real backends in this specific next slice.

## 12. Acceptance Criteria for Future ARCH-009
- Create `DoctorRepository` with `listActiveDoctors()` method.
- Create `useClinicDoctors` hook returning an array of doctors.
- Refactor `PatientHistoryTab.tsx` to use the hook internally and remove the `doctors` prop entirely.
- Update `PatientCardPage.tsx` to stop passing `doctors` to the tab.
- Preserve UI behavior, maintaining 0 lint errors and successful builds.

## 13. Recommended Next Task
**ARCH-009 — Migrate PatientHistoryTab doctors lookup to async DoctorRepository + useClinicDoctors hook.**
