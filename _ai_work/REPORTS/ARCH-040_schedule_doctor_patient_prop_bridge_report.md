# ARCH-040: Schedule Doctor & Patient Prop Bridge Report

## 1. Files Inspected
- `_ai_work/REPORTS/ARCH-039_review_schedule_appointment_dal_and_patient_doctor_boundary.md`
- `src/pages/SchedulePage.tsx`
- `src/components/schedule/AppointmentModal.tsx`
- `src/data/hooks/useClinicDoctors.ts`
- `src/data/hooks/usePatientsCollection.ts`
- `src/data/hooks/useScheduleAppointments.ts`
- `src/utils/storage.ts`
- `src/types/index.ts`

## 2. Files Changed
- **Modified**: `src/pages/SchedulePage.tsx`
- **Modified**: `src/components/schedule/AppointmentModal.tsx`
- **Created**: `_ai_work/REPORTS/ARCH-040_schedule_doctor_patient_prop_bridge_report.md`

## 3. SchedulePage Hook Integration Summary
- Removed `import { storage }` entirely.
- Integrated `useClinicDoctors` to load `allDoctors`.
- Replaced synchronous `storage.getDoctors()` with `allDoctors`.
- Integrated `usePatientsCollection` to load `patients`.
- Replaced synchronous `storage.getPatients()` with `patients`.
- Maintained the local `doctors` memoization which applies `doctorFilter` to `allDoctors` so the visible columns behavior is preserved perfectly.

## 4. AppointmentModal Prop Bridge Summary
- Removed `import { storage }` entirely.
- Added `doctors` and `patients` to `AppointmentModalProps`.
- `AppointmentModal` now relies solely on these props for dropdown rendering and cabinet fallbacks.
- From `SchedulePage`, the unfiltered `allDoctors` array is passed down, ensuring the modal dropdown always shows all doctors regardless of the current column filter.

## 5. Behavior Preservation Notes
- Visual layout of `SchedulePage` is strictly maintained.
- `AppointmentModal` dropdowns and conflict checking logic are unchanged, they simply read from React props rather than synchronous storage.
- Save/delete behaviors remain unchanged.
- Because `useClinicDoctors` and `usePatientsCollection` default to `initialData: []` in `useAsyncQuery` before refetching, the page might initially render empty slots momentarily upon load. This is accepted per the architecture guidelines (no heavy new blocking UI introduced in this step).

## 6. What Was Intentionally Not Changed
- No new hooks were created.
- `AppointmentModal` was not made async-aware and does not have `isSaving` states.
- Error/loading UX was not added to the schedule for reference data.
- The underlying `DoctorRepository`, `PatientRepository`, `useClinicDoctors`, and `usePatientsCollection` were not altered.
- Clinical modules remain untouched.

## 7. Checks Performed
- ✅ `SchedulePage.tsx` changed? **Yes.**
- ✅ `AppointmentModal.tsx` changed? **Yes.**
- ✅ `SchedulePage` imports `storage`? **No.**
- ✅ `AppointmentModal` imports `storage`? **No.**
- ✅ `SchedulePage` uses `useClinicDoctors`? **Yes.**
- ✅ `SchedulePage` uses `usePatientsCollection`? **Yes.**
- ✅ `doctors` passed into `AppointmentModal`? **Yes.**
- ✅ `patients` passed into `AppointmentModal`? **Yes.**
- ✅ `AppointmentModal` receives doctors/patients as props? **Yes.**
- ✅ `AppointmentModal` uses `storage.getDoctors/getPatients/getAppointments`? **No.**
- ✅ `SchedulePage` uses any `storage` methods? **No.**
- ✅ `AppointmentRepository`/`useScheduleAppointments` changed? **No.**
- ✅ `DoctorRepository`/`useClinicDoctors` changed? **No.**
- ✅ `PatientRepository`/`usePatientsCollection` changed? **No.**
- ✅ `storage.ts` changed? **No.**
- ✅ `types/index.ts` changed? **No.**
- ✅ New hooks created? **No.**
- ✅ `useAsyncMutation` used? **No.**
- ✅ `any` used? **No.**
- ✅ Backend/package/routes/dependencies changed? **No.**
- ✅ Clinical modules changed? **No.**

## 8. Known Limitations
- `AppointmentModal` still does not show `isSaving`.
- Save/delete errors are still only logged in `SchedulePage`.
- There is no polished loading/error UX for schedule reference data yet.
- `usePatientsCollection` is heavier than a read-only patient list hook, but accepted for MVP to avoid extra abstraction.

## 9. Recommended Next Task
**ARCH-041 — Review SchedulePage full storage decoupling and decide next architecture gate.**
