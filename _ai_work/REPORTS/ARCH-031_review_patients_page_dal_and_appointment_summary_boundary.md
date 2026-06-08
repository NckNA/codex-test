# ARCH-031: Review PatientsPage DAL Migration and Decide Appointment Summary Boundary

## 1. Title
ARCH-031 — Review PatientsPage DAL migration and decide appointment-summary boundary.

## 2. Scope
This document evaluates the successful completion of the ARCH-030 DAL migration for the `PatientsPage` (which moved core patient list and create/edit logic behind `PatientRepository` and `usePatientsCollection`). It analyzes the remaining cross-domain technical debt—specifically the local appointment summary calculation—and evaluates boundary options to determine the safest next architectural step for removing `storage.getAppointments()` from `PatientsPage`.

## 3. Inputs Reviewed
- `_ai_work/REPORTS/ARCH-030_patients_page_dal_list_create_edit_report.md`
- `src/pages/PatientsPage.tsx`
- `src/data/repositories/PatientRepository.ts`
- `src/data/hooks/usePatientsCollection.ts`
- `src/data/repositories/AppointmentRepository.ts`
- `src/data/hooks/usePatientAppointments.ts`
- `src/pages/SchedulePage.tsx`
- `src/utils/storage.ts`
- `src/types/index.ts`

## 4. ARCH-030 Implementation Review
- ✅ `PatientsPage` now successfully uses the `usePatientsCollection` hook.
- ✅ `PatientsPage` no longer calls `storage.getPatients()`, `storage.addPatient()`, or `storage.updatePatient()` directly.
- ✅ `PatientRepository` safely handles `listPatients` and `createPatient`.
- ✅ The UI was enhanced with non-blocking error/loading states guarded by `!isModalOpen`.
- ✅ `PatientModal` was intentionally **not** changed.
- ✅ `SchedulePage`, `AppointmentRepository`, and `usePatientAppointments` were intentionally **not** changed.
- ✅ `PatientListAggregator` was **not** created.
- ✅ `useAsyncMutation` and `any` types were strictly avoided.

## 5. Current PatientsPage DAL Baseline
At this stage, the `Patient` domain operations inside `PatientsPage` are fully integrated with the DAL. However, `PatientsPage` still directly accesses LocalStorage specifically to fetch appointment data for displaying visit dates.

## 6. Remaining Appointment-Derived Dependency
`PatientsPage` still contains the following direct storage call:
```typescript
const appointments = useMemo(() => storage.getAppointments(), []);
```
This data is processed locally inside `PatientsPage` to calculate the `lastVisit` and `nextVisit` dates for every row in the patient table. This constitutes a direct UI-to-storage cross-domain violation that needs to be addressed.

## 7. Current lastVisit/nextVisit Calculation Behavior
Currently, `PatientsPage` computes visit summaries using a `useMemo` hook:
- Loads **all** appointments in the system.
- Ignores appointments with missing `patientId`, `status === 'blocked'`, or `status === 'cancelled'`.
- Sorts appointments chronologically (ascending).
- Iterates through the sorted list:
  - `lastVisit`: The most recent past appointment (where `apptDate < now`).
  - `nextVisit`: The nearest upcoming appointment (where `apptDate >= now`).
- The calculation outputs a `Record<string, { lastVisit?: Date, nextVisit?: Date }>` mapping patient IDs to their visit dates.

## 8. Risks of Leaving storage.getAppointments in PatientsPage
1. **Domain Leakage:** `PatientsPage` directly depends on the Schedule/Appointment domain's internal storage mechanisms.
2. **Migration Blocker:** We cannot seamlessly migrate the application backend or storage layer if top-level pages continue to read from the legacy local storage wrapper directly.
3. **Performance Overhead:** The page currently reads and sorts the entire appointment database every time it mounts.

## 9. Boundary Options
- **Option A:** Do nothing for now; keep `storage.getAppointments` in `PatientsPage`.
- **Option B:** Add `AppointmentRepository.listAppointments()` and use it directly in `PatientsPage`.
- **Option C:** Create a read-only `PatientListVisitSummaryAggregator` that computes last/next visit per patient.
- **Option D:** Create a `usePatientListVisitSummary` hook wrapping a read-only aggregator.
- **Option E:** Move `last`/`next` visit fields directly into the `PatientRepository` `listPatients` result.
- **Option F:** Start a full `SchedulePage` / appointment DAL migration.
- **Option G:** Introduce a global cache/state for appointments.
- **Option H:** Add a massive `PatientListAggregator` that combines all patients and appointments.

## 10. Options Comparison
- **Option B (Direct Appointment Repo):** Solves the storage dependency but forces the UI component to continue handling complex sorting and joining logic.
- **Option E (Patient Repo Expansion):** Blurs domain boundaries. `PatientRepository` should only know about patients, not schedule events.
- **Option F (Full Schedule Migration):** Too massive of a scope for a single incremental step.
- **Option D (Read-Only Aggregator Hook):** Safely encapsulates the cross-domain join behind a clean interface without modifying any existing mutation flows. Follows the proven pattern of `ClinicalSummaryAggregator`.

## 11. Recommended Next Boundary
**Design a read-only `PatientListVisitSummaryAggregator` and a `usePatientListVisitSummary` hook.**
This isolates the appointment data processing while leaving `PatientRepository` strictly focused on patient data.

## 12. Why This Boundary is Safest
1. The dependency is strictly **read-only**.
2. It adheres to Single Responsibility by abstracting the cross-domain join into an Aggregator, preserving the purity of both `PatientRepository` and `AppointmentRepository`.
3. It creates a narrow, highly testable boundary without triggering a massive, risky `SchedulePage` refactoring.
4. It avoids introducing global state managers, Event Buses, or Context.
5. It ensures the UI remains minimal and focused only on rendering, rather than processing data arrays.

## 13. What Must NOT be Migrated Next
- Do **not** expand `PatientRepository` to include appointment data.
- Do **not** start modifying `SchedulePage` or appointment mutation flows.
- Do **not** implement a new global cache or React Query.
- Do **not** modify `PatientsPage` yet. The next task should be strictly design-focused.

## 14. Acceptance Criteria for Future ARCH-032
The future ARCH-032 task will be **design-only** and must:
- Define the `PatientListVisitSummaryAggregator` contract.
- Define the `usePatientListVisitSummary` hook contract.
- Define the exact returned structure (e.g., `Record<string, { lastVisit?: Date; nextVisit?: Date }>` or a named type like `PatientVisitSummaryByPatientId`).
- Guarantee exact preservation of the current `lastVisit`/`nextVisit` calculation rules (ignoring blocked/cancelled, chronological sorting).
- Define whether the aggregator calls `storage.getAppointments` internally directly or relies on a new method in an appointment repository.
- Ensure no implementation code is written, and `PatientsPage` remains unmodified.
- Prohibit any appointment mutation changes or `SchedulePage` changes.

## 15. Recommended Next Task
**ARCH-032 — Design read-only PatientListVisitSummaryAggregator / usePatientListVisitSummary contract.**
