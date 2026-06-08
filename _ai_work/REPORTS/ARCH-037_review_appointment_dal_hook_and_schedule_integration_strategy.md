# ARCH-037: Review Appointment DAL Hook & Schedule Integration Strategy

## 1. Title
ARCH-037 — Review Appointment DAL hook implementation and design SchedulePage/AppointmentModal integration strategy.

## 2. Scope
This document verifies the successful implementation of the `useScheduleAppointments` hook and the `AppointmentRepository` expansion (ARCH-036). It also provides a strategic design map for the upcoming UI integration, addressing the deep coupling of `SchedulePage` and `AppointmentModal` to synchronous `storage` methods.

## 3. Inputs Reviewed
- `_ai_work/REPORTS/ARCH-036_appointment_repository_use_schedule_appointments_report.md`
- `src/data/repositories/AppointmentRepository.ts`
- `src/data/hooks/useScheduleAppointments.ts`
- `src/data/hooks/useAsyncQuery.ts`
- `src/pages/SchedulePage.tsx`
- `src/components/schedule/AppointmentModal.tsx`
- `src/data/repositories/DoctorRepository.ts`
- `src/data/hooks/useClinicDoctors.ts`
- `src/data/repositories/PatientRepository.ts`
- `src/data/hooks/usePatientsCollection.ts`
- `src/utils/storage.ts`
- `src/types/index.ts`

## 4. ARCH-036 Implementation Review
- ✅ `AppointmentRepository` correctly exposes `listAppointments`, `createAppointment`, `updateAppointment`, and `deleteAppointment`.
- ✅ `listAppointmentsByPatient` behavior was strictly preserved.
- ✅ `useScheduleAppointments` was built using the `useAsyncQuery` object-style API.
- ✅ `useScheduleAppointments` safely avoids `useAsyncMutation`.
- ✅ `useScheduleAppointments` implements manual wrappers that correctly `await` the repository method, `await` refetch, and properly re-throw parsed errors.
- ✅ The hook is cleanly separated and **not** integrated into the UI.
- ✅ No UI components or unrelated files were altered.

## 5. Current SchedulePage Storage Usage
`SchedulePage` directly imports `storage` and performs the following synchronous operations:
- `storage.getAppointments()` (loads initial state)
- `storage.getDoctors()` (loads doctors list)
- `storage.getPatients()` (loads patients list)
- `storage.addAppointment()` (adds new appointment)
- `storage.updateAppointment()` (updates appointment)
- `storage.deleteAppointment()` (deletes appointment)

## 6. Current AppointmentModal Storage Usage
`AppointmentModal` directly imports `storage` and performs:
- `storage.getPatients()` (loads patients dropdown)
- `storage.getDoctors()` (loads doctors dropdown)
- `storage.getAppointments()` (fetches all appointments to perform conflict checking)

## 7. Current AppointmentModal Conflict Checking Behavior
Inside the modal, the `checkConflicts` function runs synchronously before calling `onSave`. It iterates over all appointments (via `storage.getAppointments()`) to detect if the chosen doctor or cabinet is double-booked for the given start/end time. 
Because it relies on the raw `storage`, any attempt to decouple `SchedulePage`'s appointment list without addressing the modal's conflict checker leaves a direct data leak to the local storage.

## 8. SchedulePage Integration Risk Analysis
- **Replacing Local State**: Exchanging `const [appointments, setAppointments]` for the DAL hook is straightforward, but the UI might flicker if loading states aren't handled silently for background refetches.
- **Async Handlers**: Converting `handleSaveAppointment` and `handleDeleteAppointment` to `async` functions requires `SchedulePage` to `await` the hook's manual wrappers and close the modal *only on success*. 
- **Full-page Loading/Errors**: Since `SchedulePage` is the main workspace, a full-page blocker should probably only appear on initial load (i.e. `isLoading && appointments.length === 0`), similar to `PatientsPage`.

## 9. AppointmentModal Integration Risk Analysis
- `AppointmentModal` exposes synchronous `onSave(appointment: Appointment) => void` and `onDelete(id: string) => void`. 
- If `SchedulePage`'s handlers become `async`, TypeScript accepts `Promise<void>` for a `void` prop, but the modal code won't `await` them. This means the modal must rely on `SchedulePage` to physically unmount or close it via the `isOpen` prop after the `Promise` resolves.
- **The Conflict Checker Risk**: To fully remove `storage.getAppointments()` from the UI domain, the modal must get the appointments from somewhere else. Making the modal fetch them asynchronously could cause complex race conditions. The safest approach is passing the already loaded `appointments` from `SchedulePage` down into the modal via props.

## 10. Integration Options
- **Option A:** Integrate `useScheduleAppointments` into `SchedulePage`. Leave `AppointmentModal` untouched (it continues calling `storage.getAppointments()` for conflicts). *High technical debt remaining.*
- **Option B (Recommended):** Integrate `useScheduleAppointments` into `SchedulePage`. Pass the `appointments` array as a prop to `AppointmentModal` and refactor `checkConflicts` to use the prop instead of `storage.getAppointments()`. Do not touch doctor/patient loading yet. *Safest path to full appointment DAL abstraction.*
- **Option C:** Integrate `useScheduleAppointments`, pass the appointments prop, AND migrate doctor/patient loading to DAL hooks in both the page and the modal. *Too large. Massive risk of UI regressions.*

## 11. Options Comparison
Option B isolates the refactor exactly to the Appointment domain while fully achieving the goal of removing direct `storage.ts` appointment calls. By passing the `appointments` array into the modal, we avoid the need to make the modal asynchronous or introduce a new hook instance inside it. Doctor and Patient dropdowns are left as technical debt for a future, isolated sprint.

## 12. Recommended ARCH-038 Scope
**ARCH-038 should be an implementation task that executes Option B:**
- Integrate `useScheduleAppointments` into `SchedulePage`.
- Remove all `storage.addAppointment`, `storage.updateAppointment`, `storage.deleteAppointment`, and `storage.getAppointments` from `SchedulePage`.
- Add an `appointments: Appointment[]` prop to `AppointmentModal`.
- Remove `storage.getAppointments` from `AppointmentModal` and use the passed prop for conflict checking.

## 13. Exact Behavior That Must Be Preserved
- `dailyAppointments` date/status filtering logic.
- Absolute positioning via `getCardStyle`.
- Time-slot and grid rendering.
- `checkConflicts` identical overlap detection logic.
- `AppointmentModal` remains open on save/delete failure (error is displayed, or `SchedulePage` refuses to close `isOpen`).
- No full-page blocking spinners during save/refetch operations.

## 14. What Must NOT be Changed in ARCH-038
- Do **NOT** change doctor or patient loading in `SchedulePage` or `AppointmentModal` (leave `storage.getPatients` and `storage.getDoctors` intact).
- Do **NOT** use `useAsyncMutation`.
- Do **NOT** add new isSaving spinners/UX to `AppointmentModal` unless strictly necessary (rely on `SchedulePage` controlling `isOpen`).
- Do **NOT** change clinical modules or other unrelated pages.

## 15. Acceptance Criteria for ARCH-038
- `SchedulePage` imports `useScheduleAppointments`.
- `SchedulePage` no longer calls `storage.getAppointments`, `storage.addAppointment`, `storage.updateAppointment`, `storage.deleteAppointment`.
- `AppointmentModal` accepts an `appointments` prop.
- `AppointmentModal` no longer calls `storage.getAppointments`.
- Doctor and Patient storage reads remain untouched.
- `lint` and `build` pass perfectly.

## 16. Recommended Next Task
**ARCH-038 — Integrate useScheduleAppointments into SchedulePage and remove appointment storage calls from SchedulePage, with minimal AppointmentModal conflict-checking prop bridge.**

---

### Explicit Architecture Questions Answered
- **Is ARCH-037 implementation or design/review?** Design/review only.
- **Should src/ code be changed in ARCH-037?** No.
- **Was AppointmentRepository implemented correctly in ARCH-036?** Yes.
- **Was useScheduleAppointments implemented correctly in ARCH-036?** Yes.
- **Is useScheduleAppointments integrated into UI now?** No.
- **Does SchedulePage still directly use appointment storage?** Yes.
- **Does AppointmentModal still directly use appointment storage?** Yes.
- **Does AppointmentModal still directly use patient/doctor storage?** Yes.
- **Should ARCH-038 modify SchedulePage?** Yes.
- **Should ARCH-038 modify AppointmentModal?** Yes.
- **Should appointments be passed into AppointmentModal?** Yes.
- **Should patients/doctors be passed into AppointmentModal in ARCH-038?** No, leave synchronous storage loading to minimize scope.
- **Should Patient/Doctor loading be migrated in ARCH-038?** No.
- **Should isSaving UX be added to AppointmentModal in ARCH-038?** No.
- **Should useAsyncMutation be used?** No.
- **Should clinical modules be touched?** No.
- **What exactly should ARCH-038 implement?** Integration of the DAL hook into `SchedulePage` and the prop bridge to `AppointmentModal` to completely decouple the appointment domain from local storage.
