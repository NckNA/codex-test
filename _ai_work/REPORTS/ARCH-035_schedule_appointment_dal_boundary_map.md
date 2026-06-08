# ARCH-035: Schedule & Appointment DAL Boundary Map

## 1. Title
ARCH-035 — Design Schedule/Appointment DAL boundary map before implementation.

## 2. Scope
This document analyzes the current state of `SchedulePage` and `AppointmentModal`, mapping their direct `storage` dependencies. It defines the contracts for expanding `AppointmentRepository` and creating a new `useScheduleAppointments` hook to decouple the schedule domain from local storage without introducing regressions.

## 3. Inputs Reviewed
- `_ai_work/REPORTS/ARCH-034_review_visit_summary_aggregator_and_next_boundary.md`
- `src/pages/SchedulePage.tsx`
- `src/components/schedule/AppointmentModal.tsx`
- `src/data/repositories/AppointmentRepository.ts`
- `src/data/hooks/usePatientAppointments.ts`
- `src/data/repositories/DoctorRepository.ts`
- `src/data/hooks/useClinicDoctors.ts`
- `src/data/repositories/PatientRepository.ts`
- `src/data/hooks/usePatientsCollection.ts`
- `src/utils/storage.ts`

## 4. Current SchedulePage Behavior Map
- **Local State:** Owns `appointments` array (initialized synchronously via `storage.getAppointments()`).
- **Data Filtering:** Derives `doctors` (applying `doctorFilter`) and `patients` from synchronous storage calls via `useMemo`. Derives `dailyAppointments` filtering by `selectedDateStr`, `statusFilter`, and `sourceFilter`.
- **Card Rendering:** Uses `getCardStyle` for CSS positioning based on start/end times. Uses `patient` lookup to display names.
- **Interactivity:** 
  - Clicking empty slots opens `AppointmentModal` with pre-filled `doctorId`, `start`, and `end`.
  - Clicking an appointment opens `AppointmentModal` with `editingAppointment`.
- **Mutations:** Defines `handleSaveAppointment` (calls `storage.addAppointment` or `updateAppointment` and reloads local state) and `handleDeleteAppointment`.

## 5. Current SchedulePage Direct Storage Usage
- `storage.getAppointments()`
- `storage.getDoctors()`
- `storage.getPatients()`
- `storage.addAppointment(saved)`
- `storage.updateAppointment(saved)`
- `storage.deleteAppointment(id)`

## 6. Current AppointmentModal Integration
- Fetches `patients` and `doctors` synchronously on render via `storage.getPatients()` and `storage.getDoctors()`.
- Fetches all appointments synchronously via `storage.getAppointments()` purely for **conflict checking** (`checkConflicts` method checking overlap for the same doctor or cabinet).
- Receives `onSave` and `onDelete` callbacks from `SchedulePage`.

## 7. Current AppointmentRepository Capabilities
Currently, `LocalStorageAppointmentRepository` only supports:
- `listAppointmentsByPatient(patientId)`
This is read-only and scoped strictly to a single patient's profile.

## 8. Patient/Doctor Data Dependency Inside SchedulePage
`SchedulePage` loads doctors to render columns and patients to render names inside appointment cards. `AppointmentModal` loads them for `<select>` dropdowns.
- **Risk:** Moving these to async hooks (`usePatientsCollection`, `useClinicDoctors`) in the same PR as appointment migrations might cause massive UI flickering or complex `useEffect` chains during the transition.
- **Strategy:** For the MVP DAL boundary, keep the patient/doctor data loading strategy scoped. They can remain synchronous or use existing hooks, but the scope must not explode.

## 9. Appointment Mutation Behavior
Currently, `storage.addAppointment`, `storage.updateAppointment`, and `storage.deleteAppointment` are synchronous and return `void`.
When moving to `AppointmentRepository`, they must become `Promise<void>`.
The hook `useScheduleAppointments` will need manual mutation wrappers to handle loading states (`isSaving`) and errors gracefully, ensuring `refetch` is awaited before closing the modal.

## 10. Rendering/Filtering Behavior to Preserve
- The time grid and daily columns.
- `dailyAppointments` derivation (date string matching, status/source filters).
- `getCardStyle` logic for absolute positioning.
- Conflict checking inside `AppointmentModal`.

## 11. Repository Design Options
- **Option A:** Create `ScheduleRepository`. *Rejected: Splits appointment logic unnecessarily.*
- **Option B:** Extend `AppointmentRepository`. *Recommended: Keeps all appointment CRUD in one place.*

## 12. Hook Design Options
- **Option A:** Single `useScheduleAppointments` hook handling both reading and mutating. *Recommended for MVP to keep `SchedulePage` integration simple.*
- **Option B:** Split into read and mutation hooks. *Rejected: Overcomplicates the immediate migration.*

## 13. Recommended AppointmentRepository Contract
Extend `src/data/repositories/AppointmentRepository.ts`:
```typescript
export interface IAppointmentRepository {
  listAppointmentsByPatient(patientId: string): Promise<Appointment[]>;
  listAppointments(): Promise<Appointment[]>;
  createAppointment(appointment: Appointment): Promise<void>;
  updateAppointment(appointment: Appointment): Promise<void>;
  deleteAppointment(appointmentId: string): Promise<void>;
}
```

## 14. Recommended Hook Contract
Create `src/data/hooks/useScheduleAppointments.ts`:
```typescript
export function useScheduleAppointments() {
  // uses useAsyncQuery({ queryFn, initialData: [], enabled: true })
  
  // provides manual wrappers:
  // createAppointment = async (appt) => { set isSaving; await repo.create; await refetch; }
  // updateAppointment = async (appt) => { ... }
  // deleteAppointment = async (id) => { ... }

  return {
    appointments,
    isLoading,
    isError,
    error,
    isSaving,
    saveError,
    createAppointment,
    updateAppointment,
    deleteAppointment,
    refetch
  };
}
```
*Note: `useAsyncMutation` must be explicitly avoided as it handles void returns and refetching ambiguously in the current architecture.*

## 15. Future SchedulePage Integration Plan
1. Replace local `const [appointments, setAppointments] = useState(...)` with the `useScheduleAppointments` hook.
2. Update `handleSaveAppointment` to be `async`, await the hook's mutation, and only close the modal on success.
3. Update `handleDeleteAppointment` similarly.
4. `AppointmentModal` will need to use async conflict checking or fetch its own appointments via a hook, OR `SchedulePage` can pass down the `appointments` array. Passing down is much safer to avoid touching `AppointmentModal`'s internal storage logic prematurely.

## 16. Risks and Constraints
- **Modal Coupling:** `AppointmentModal` uses `storage.getAppointments()` internally for validation. If we only migrate `SchedulePage`, the modal still violates the boundary. We must decide whether to pass appointments as props or migrate the modal simultaneously.
- **Integration Risk:** Because `SchedulePage` and `AppointmentModal` are tightly coupled and complex, doing the Repository, Hook, Page, and Modal all in one step is too risky.

## 17. What Must NOT be Changed in Implementation
- Do **NOT** rewrite the visual layout of `SchedulePage`.
- Do **NOT** use `useAsyncMutation`.
- Do **NOT** introduce React Query or global state.
- Do **NOT** touch clinical tabs or other domains.

## 18. Acceptance Criteria for Future Implementation
- `AppointmentRepository` is extended.
- `useScheduleAppointments` is created with manual mutation wrappers.
- No UI code is broken.

## 19. Recommended Next Task
Because the integration touches both `SchedulePage` and `AppointmentModal` (for conflict validation), performing the entire migration in one step is unsafe.

**Recommended Next Task:**
**ARCH-036 — Implement AppointmentRepository schedule collection methods and useScheduleAppointments only.**

*(Integration into `SchedulePage` and `AppointmentModal` will follow in ARCH-037).*
