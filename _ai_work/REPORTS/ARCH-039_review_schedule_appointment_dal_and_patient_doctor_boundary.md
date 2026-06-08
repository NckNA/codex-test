# ARCH-039: Review Schedule DAL and Patient/Doctor Boundary

## 1. Title
ARCH-039 — Review SchedulePage appointment DAL integration and decide patient/doctor dependency boundary.

## 2. Scope
This document reviews the successful integration of the appointment DAL into `SchedulePage` and `AppointmentModal` (ARCH-038). It then analyzes the remaining direct `storage.ts` dependencies (doctors and patients) and defines the strategy for removing them using existing hooks and prop bridges.

## 3. Inputs Reviewed
- `_ai_work/REPORTS/ARCH-038_schedule_appointments_dal_integration_report.md`
- `src/pages/SchedulePage.tsx`
- `src/components/schedule/AppointmentModal.tsx`
- `src/data/hooks/useScheduleAppointments.ts`
- `src/data/hooks/useClinicDoctors.ts`
- `src/data/repositories/DoctorRepository.ts`
- `src/data/hooks/usePatientsCollection.ts`
- `src/data/repositories/PatientRepository.ts`
- `src/utils/storage.ts`

## 4. ARCH-038 Implementation Review
- ✅ `SchedulePage` correctly uses `useScheduleAppointments`.
- ✅ `SchedulePage` no longer imports or calls `storage.getAppointments()`, `storage.addAppointment()`, `storage.updateAppointment()`, or `storage.deleteAppointment()`.
- ✅ `AppointmentModal` successfully accepts the `appointments` prop and uses it for conflict checking.
- ✅ `AppointmentModal` no longer imports or calls `storage.getAppointments()`.
- ✅ Handlers are correctly implemented as async and safely block modal closure on error.

## 5. Current SchedulePage Remaining Storage Usage
- `storage.getDoctors()`
- `storage.getPatients()`

## 6. Current AppointmentModal Remaining Storage Usage
- `storage.getDoctors()`
- `storage.getPatients()`

## 7. Doctor Dependency Behavior
- **SchedulePage**: Uses doctors to render the daily columns and apply `doctorFilter`.
- **AppointmentModal**: Uses doctors for the `<select>` dropdown and deriving default cabinet strings.
- **Existing DAL**: `useClinicDoctors` is a clean, read-only hook exposing `doctors`, `isLoading`, `isError`.

## 8. Patient Dependency Behavior
- **SchedulePage**: Uses patients solely to display full names on the appointment cards.
- **AppointmentModal**: Uses patients for the `<select>` dropdown.
- **Existing DAL**: `usePatientsCollection` exposes `patients` along with mutation handlers (`createPatient`, `updatePatient`). While a bit heavy for read-only usage, extracting just `patients` from it is perfectly safe and avoids creating redundant "list-only" hooks.

## 9. Risk Analysis
- **Reusing hooks**: `useClinicDoctors` and `usePatientsCollection` already exist and wrap local storage via `useAsyncQuery`. Calling them in `SchedulePage` involves replacing `useMemo(() => storage.get*, [])` with the hook calls. 
- **Modal Coupling**: If `AppointmentModal` independently calls these hooks, it creates redundant data fetching, potential race conditions on mount, and breaks the "dumb component" pattern. Passing them as props from `SchedulePage` ensures the modal renders instantly with the same data the page uses.

## 10. Boundary Options
- **Option A**: Leave doctors/patients as synchronous storage reads. *(Unacceptable technical debt)*
- **Option B**: Use existing `useClinicDoctors` and `usePatientsCollection` in `SchedulePage`. Pass `doctors` and `patients` as props into `AppointmentModal`. *(Recommended: Cleanest, safest, reuses existing code, fully decouples the modal)*
- **Option C**: Create new `useScheduleReferenceData` hook. *(Rejected: Over-engineering, existing hooks are sufficient for MVP)*

## 11. Recommended Next Boundary
**Option B — Use existing hooks in SchedulePage and pass props to AppointmentModal.**

## 12. Exact Behavior That Must Be Preserved
- `SchedulePage` doctor columns must render based on the `doctors` array and `doctorFilter`.
- Appointment cards must resolve patient names using the `patients` array.
- `AppointmentModal` dropdowns must populate identically.
- `AppointmentModal` must still fall back to `doctors.find(...).cabinet` if cabinet is empty.

## 13. What Must NOT be Changed Next
- Do **NOT** modify `AppointmentRepository` or `useScheduleAppointments`.
- Do **NOT** modify the internal implementation of `useClinicDoctors` or `usePatientsCollection`.
- Do **NOT** introduce new data fetching hooks.
- Do **NOT** make `AppointmentModal` async-aware (it remains a synchronous view component receiving data via props).
- Do **NOT** add clinical module features.

## 14. Acceptance Criteria for ARCH-040
- `SchedulePage` imports `useClinicDoctors` and `usePatientsCollection`.
- `SchedulePage` completely removes `import { storage }`.
- `AppointmentModal` accepts `doctors` and `patients` as props.
- `AppointmentModal` completely removes `import { storage }`.
- Lint and build pass cleanly.

## 15. Recommended Next Task
**ARCH-040 — Remove doctor/patient storage reads from SchedulePage and AppointmentModal using existing hooks and prop bridge.**

---

### Explicit Architecture Questions Answered
- **Is ARCH-039 implementation or review/design?** Review/design only.
- **Should src/ code be changed in ARCH-039?** No.
- **Does SchedulePage now use useScheduleAppointments?** Yes.
- **Does SchedulePage still call appointment storage methods?** No.
- **Does AppointmentModal still call storage.getAppointments?** No.
- **Does SchedulePage still call storage.getDoctors/getPatients?** Yes.
- **Does AppointmentModal still call storage.getDoctors/getPatients?** Yes.
- **Should doctor/patient loading be migrated next?** Yes.
- **Should existing useClinicDoctors be reused?** Yes.
- **Should existing usePatientsCollection be reused?** Yes.
- **Should doctors/patients be passed into AppointmentModal as props?** Yes.
- **Should AppointmentModal become async-aware next?** No.
- **Should isSaving UX be added next?** No.
- **Should clinical modules be touched next?** No.
- **Should Tailwind/PostCSS config fix be handled separately?** Yes, it is out of scope for the architecture domain migration.
- **What exactly should ARCH-040 do?** It should replace direct storage calls for doctors and patients in `SchedulePage` with existing hooks, and pass the data down to `AppointmentModal`, thereby making both components entirely free of direct `storage.ts` imports.
