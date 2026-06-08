# ARCH-036: Appointment Repository & useScheduleAppointments Implementation Report

## 1. Files Inspected
- `_ai_work/REPORTS/ARCH-035_schedule_appointment_dal_boundary_map.md`
- `src/data/repositories/AppointmentRepository.ts`
- `src/data/hooks/usePatientAppointments.ts`
- `src/data/hooks/useAsyncQuery.ts`
- `src/utils/storage.ts`
- `src/types/index.ts`
- `src/pages/SchedulePage.tsx`
- `src/components/schedule/AppointmentModal.tsx`

## 2. Files Changed
- **Modified**: `src/data/repositories/AppointmentRepository.ts`
- **Created**: `src/data/hooks/useScheduleAppointments.ts`
- **Created**: `_ai_work/REPORTS/ARCH-036_appointment_repository_use_schedule_appointments_report.md`

## 3. AppointmentRepository Changes
The `IAppointmentRepository` interface and its local storage implementation were expanded to support full schedule CRUD operations:
- `listAppointments()`: Returns all appointments as stored.
- `createAppointment(appointment)`: Calls `storage.addAppointment`.
- `updateAppointment(appointment)`: Calls `storage.updateAppointment`.
- `deleteAppointment(appointmentId)`: Calls `storage.deleteAppointment`.
The existing `listAppointmentsByPatient` behavior was strictly preserved.

## 4. useScheduleAppointments Hook Summary
- Created using the `useAsyncQuery` object-style API.
- Implements `useCallback` for `queryFn` pointing to `LocalStorageAppointmentRepository.listAppointments()`.
- Exports state variables: `appointments`, `isLoading`, `isError`, `error`, `isSaving`, `saveError`.
- Exports methods: `createAppointment`, `updateAppointment`, `deleteAppointment`, `refetch`.
- Exclusively uses native React primitives and avoids `useAsyncMutation`.

## 5. Manual Mutation Behavior
All three mutation methods (`createAppointment`, `updateAppointment`, `deleteAppointment`) follow a strict manual execution flow:
- Set `isSaving(true)` and `saveError(null)`.
- Await the repository operation.
- Await `refetch()` immediately after a successful mutation to ensure the data is synced before the UI updates.
- If an error occurs, it is parsed, set to `saveError`, and intentionally re-thrown so the calling UI component can catch it and prevent modal closure.
- Finally, `isSaving(false)` is set.

## 6. Error/Loading Behavior
- Query errors (`queryError`) and save errors (`saveError`) are safely merged into `isError` and `error` outputs.
- `saveError` is prioritized in the merged `error` output if both exist.

## 7. What Was Intentionally Not Changed
- `SchedulePage.tsx` was **not** changed. It still directly uses `storage.ts`.
- `AppointmentModal.tsx` was **not** changed. It still directly uses `storage.ts`.
- `PatientRepository` and `usePatientsCollection` were **not** changed.
- `DoctorRepository` and `useClinicDoctors` were **not** changed.
- `usePatientAppointments` was **not** changed.
- `useAsyncQuery` and `useAsyncMutation` were **not** changed.
- `storage.ts` and `types/index.ts` were **not** changed.
- Backend, routes, package.json, and dependencies were **not** changed.
- The hook was **not** imported or integrated into any UI components.

## 8. Checks Performed
- ✅ `AppointmentRepository.ts` changed? **Yes.**
- ✅ `useScheduleAppointments.ts` created? **Yes.**
- ✅ `SchedulePage.tsx` changed? **No.**
- ✅ `AppointmentModal.tsx` changed? **No.**
- ✅ `PatientRepository`/`usePatientsCollection` changed? **No.**
- ✅ `DoctorRepository`/`useClinicDoctors` changed? **No.**
- ✅ `usePatientAppointments` changed? **No.**
- ✅ `useAsyncQuery`/`useAsyncMutation` changed? **No.**
- ✅ `storage.ts` changed? **No.**
- ✅ `types/index.ts` changed? **No.**
- ✅ Backend/package/routes/dependencies changed? **No.**
- ✅ `useAsyncMutation` used? **No.**
- ✅ `any` used? **No.**
- ✅ Hook integrated into UI? **No.**
- ✅ Lint and build pass? **Yes.**

## 9. Known Limitations
- `SchedulePage` and `AppointmentModal` are completely untouched and still contain direct `storage` calls.
- `useScheduleAppointments` is fully implemented but currently unused by the application.
- Because the UI was not modified, there are no visual or behavioral changes introduced in this step.

## 10. Recommended Next Task
**ARCH-037 — Review Appointment DAL hook implementation and design SchedulePage/AppointmentModal integration strategy.**
*(Due to the high integration risk and tight coupling of the modal's conflict checking to synchronous storage, a careful integration map is required before modifying the UI).*
