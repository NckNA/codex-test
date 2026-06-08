# ARCH-030: PatientsPage DAL List/Create/Edit Migration Report

## 1. Files Inspected
- `_ai_work/REPORTS/ARCH-029_patient_list_search_create_dal_contract.md`
- `src/pages/PatientsPage.tsx`
- `src/components/patients/PatientModal.tsx`
- `src/data/repositories/PatientRepository.ts`
- `src/data/hooks/usePatientProfile.ts`
- `src/data/hooks/useAsyncQuery.ts`
- `src/utils/storage.ts`
- `src/types/index.ts`

## 2. Files Changed
- **Modified**: `src/data/repositories/PatientRepository.ts`
- **Created**: `src/data/hooks/usePatientsCollection.ts`
- **Modified**: `src/pages/PatientsPage.tsx`
- **Created**: `_ai_work/REPORTS/ARCH-030_patients_page_dal_list_create_edit_report.md`

## 3. PatientRepository Changes
- The `PatientRepository` interface was extended with `listPatients(): Promise<Patient[]>` and `createPatient(patient: Patient): Promise<void>`.
- `LocalStoragePatientRepository` now implements these using `storage.getPatients()` and `storage.addPatient()`.
- The existing single-profile methods (`getPatientById`, `updatePatient`) remain fully intact.
- No `any` types were used.

## 4. usePatientsCollection Hook Summary
- `usePatientsCollection.ts` was successfully created.
- It uses the object-style `useAsyncQuery` hook with `useCallback` to fetch the list of patients.
- It implements safe, manual mutation logic for `createPatient` and `updatePatient` with internal `isSaving` and `saveError` states.
- It explicitly **does not** use `useAsyncMutation`.
- Errors are merged correctly (`isError` favors `saveError`, then falls back to `queryError`).

## 5. PatientsPage Integration Summary
- `PatientsPage` now fully consumes `usePatientsCollection`.
- Direct calls to `storage.getPatients`, `storage.addPatient`, and `storage.updatePatient` have been removed.
- `storage.getAppointments()` **remains** intentionally untouched as a known technical debt for the schedule migration phase.
- `handleSavePatient` is now an async function that correctly awaits `createPatient`/`updatePatient` and closes the modal only upon success. It wraps everything in a try/catch block to keep errors contained.
- All client-side searching, status filtering, and source filtering algorithms were preserved exactly as they were.

## 6. Loading/Error/Save Behavior
- A minimal, non-blocking spinner is displayed initially (`isPatientsLoading && patients.length === 0 && !isModalOpen`).
- A minimal error state with a "Повторить" (Retry) button is shown if the initial fetch fails (`isPatientsError && patients.length === 0 && !isModalOpen`).
- Full-page loading/error states are explicitly guarded by `!isModalOpen`. This prevents `PatientModal` from being unmounted during create/update save failures or refetches when the patients list is empty.
- Background refetches (e.g., after saving a patient) do not trigger full-page replacement, ensuring the modal does not unexpectedly disappear.
- If an error occurs during saving, the modal safely remains open, and the error is caught gracefully.

## 7. What Behavior Was Preserved
- The list of patients renders successfully.
- Search by name/phone works identically.
- Source/Status dropdown filters work identically.
- Creating a new patient and editing an existing one still works through the unchanged `PatientModal`.
- The calculation for `lastVisit` and `nextVisit` still works properly (using the unchanged `appointments` dependency).
- Navigating to the detailed Patient Card works.

## 8. What Was Intentionally Not Changed
- `PatientModal.tsx` was **not changed** (no `isSaving` prop).
- `PatientCardPage.tsx` and `PatientOverviewTab.tsx` were **not changed**.
- Clinical tabs were **not changed**.
- `SchedulePage.tsx` was **not changed**.
- `AppointmentRepository` and `usePatientAppointments` were **not changed**.
- `usePatientProfile.ts` was **not changed**.
- `useAsyncQuery` and `useAsyncMutation` were **not changed**.
- `storage.ts` and `types/index.ts` were **not changed**.
- Backend, routes, package.json, and dependencies were **not changed**.
- Appointment-derived `lastVisit`/`nextVisit` calculation was **not migrated** yet.
- `PatientListAggregator` was **not created**.

## 9. Checks Performed
- ✅ `PatientRepository.ts` changed.
- ✅ `usePatientsCollection.ts` created.
- ✅ `PatientsPage.tsx` changed.
- ✅ `PatientModal.tsx` changed? **No.**
- ✅ `PatientCardPage.tsx` changed? **No.**
- ✅ `PatientOverviewTab.tsx` changed? **No.**
- ✅ Clinical tabs changed? **No.**
- ✅ `SchedulePage.tsx` changed? **No.**
- ✅ `AppointmentRepository`/`usePatientAppointments` changed? **No.**
- ✅ `usePatientProfile.ts` changed? **No.**
- ✅ `useAsyncQuery`/`useAsyncMutation` changed? **No.**
- ✅ `storage.ts` changed? **No.**
- ✅ `types/index.ts` changed? **No.**
- ✅ `PatientsPage` still directly calls `storage.getPatients`/`addPatient`/`updatePatient`? **No.**
- ✅ `PatientsPage` still directly calls `storage.getAppointments`? **Yes (intentionally).**
- ✅ Appointment-derived last/next visit was migrated? **No.**
- ✅ `PatientListAggregator` was created? **No.**
- ✅ `useAsyncMutation` was used? **No.**
- ✅ `any` was used? **No.**
- ✅ Backend/package/routes/dependencies changed? **No.**
- ✅ Lint passed with 0 errors/0 warnings? **Yes.**

## 10. Known Limitations
- **Appointment Dependency**: `PatientsPage` still directly imports and calls `storage.getAppointments()` to compute the `lastVisit`/`nextVisit` fields for the list. This is an accepted cross-domain boundary violation temporarily deferred until the Schedule DAL migration.
- **UX Limitation**: `PatientModal` does not display an `isSaving` spinner on its Save button, as modifying the modal was forbidden.
- **Filtering**: All filtering remains on the client side, which fits the LocalStorage MVP but will need adjustment for a real backend API.

## 11. Recommended Next Task
**ARCH-031 — Review PatientsPage DAL migration and decide appointment-summary boundary.**
