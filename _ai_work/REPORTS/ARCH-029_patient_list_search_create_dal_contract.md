# ARCH-029: Patient List/Search/Create DAL Contract

## 1. Title
ARCH-029 — Design Patient list/search/create DAL contract.

## 2. Scope
This document designs the Data Access Layer (DAL) contract for listing, filtering, searching, and creating patients. It evaluates the current direct storage usage in `PatientsPage` and proposes an architecture that safely migrates patient CRUD operations to the DAL while deferring cross-domain complexity (like appointments).

## 3. Inputs Reviewed
- `_ai_work/REPORTS/ARCH-028_review_patient_profile_dal_and_next_boundary.md`
- `src/pages/PatientsPage.tsx`
- `src/components/patients/PatientModal.tsx`
- `src/data/repositories/PatientRepository.ts`
- `src/data/hooks/usePatientProfile.ts`

## 4. Current PatientsPage Behavior
- Renders a table of patients.
- Implements client-side text search (name/phone).
- Implements client-side filtering by `status` and `source`.
- Calculates `lastVisit` and `nextVisit` for every row by parsing all appointments.
- Opens `PatientModal` for creating new patients or editing existing ones.

## 5. Current Direct Storage Access in PatientsPage
- `storage.getPatients()` — Used to load the initial list.
- `storage.addPatient(patient)` — Used to save a new patient.
- `storage.updatePatient(patient)` — Used to save an edited patient.
- `storage.getAppointments()` — Used to build a map of visits for the list rows.

## 6. Current Search/Filter/Sort Behavior
All search and filtering currently happen entirely on the client side inside `useMemo` hooks. The raw data array is iterated, and `.filter()` is applied based on React state variables (`searchQuery`, `statusFilter`, `sourceFilter`).

## 7. Current Create/Edit Behavior with PatientModal
- `PatientModal` operates purely on `Patient` objects.
- It generates an ID internally (`p${Date.now()}`) if one is not provided.
- It calls `onSave(patient)` synchronously.
- `PatientsPage` then either calls `storage.updatePatient` or `storage.addPatient`, updates local component state, and closes the modal.

## 8. Appointment-Derived Last/Next Visit Dependency
`PatientsPage` loads *all* appointments in the system to calculate the `lastVisit` and `nextVisit` columns. This is a severe cross-domain dependency. Moving this directly into `PatientRepository` would violate domain boundaries.

## 9. Existing PatientRepository Limitations
Currently, `PatientRepository` only supports single-patient profile operations: `getPatientById` and `updatePatient`.

## 10. Repository Design Options
- **Option A (Extend):** Add `listPatients(): Promise<Patient[]>` and `createPatient(patient: Patient): Promise<void>` to `PatientRepository`.
- **Option B (Separate):** Create `PatientCollectionRepository`.

*Recommendation:* **Option A**. The domain is still small enough that splitting the repository is unnecessary. Extending `PatientRepository` keeps all core patient persistence logic together.

## 11. Hook Design Options
We need hooks to replace the direct `storage` calls in `PatientsPage`.
- `usePatientsList()`: Wraps `listPatients` using `useAsyncQuery`. Client-side filtering remains in `PatientsPage` for the MVP.
- `useCreatePatient()`: A manual wrapper for `createPatient` (similar to how `savePatient` is handled in `usePatientProfile`).

Alternatively, we can create a combined hook: `usePatientsCollection()`. Since the page handles both reading the list and managing the modal (create/edit), a combined hook is cleaner.

## 12. Appointment Summary Design Options
- **Option A:** Keep `storage.getAppointments()` directly in `PatientsPage` temporarily.
- **Option B:** Create a `PatientListAggregator` that fetches patients and appointments and joins them.

*Recommendation:* **Option A**. To keep ARCH-030 strictly focused on migrating the *Patient* domain, we should intentionally leave the `getAppointments` storage call unchanged in `PatientsPage`. Migrating the Schedule domain is a separate, complex task.

## 13. Recommended Patient DAL Contract
Extend `PatientRepository` with:
```typescript
export interface PatientRepository {
  getPatientById(patientId: string): Promise<Patient | null>;
  updatePatient(patient: Patient): Promise<void>;
  // NEW:
  listPatients(): Promise<Patient[]>;
  createPatient(patient: Patient): Promise<void>;
}
```

## 14. Recommended Hook Contract
Create `src/data/hooks/usePatientsList.ts` (or similar name):
```typescript
export function usePatientsList() {
  const { data, isLoading, isError, error, refetch } = useAsyncQuery<Patient[]>(
    () => LocalStoragePatientRepository.listPatients(),
    [],
    true
  );

  const createPatient = async (patient: Patient) => {
    await LocalStoragePatientRepository.createPatient(patient);
    await refetch();
  };

  const updatePatient = async (patient: Patient) => {
    await LocalStoragePatientRepository.updatePatient(patient);
    await refetch();
  };

  return {
    patients: data || [],
    isLoading,
    isError,
    error,
    createPatient,
    updatePatient,
    refetch
  };
}
```

## 15. LocalStorage Behavior
- ID generation for new patients currently happens inside `PatientModal`. This should remain unchanged for now to avoid modifying the modal.
- `createPatient` simply calls `storage.addPatient`.
- Search and filtering remain client-side in `PatientsPage`.

## 16. Future Backend Compatibility
When migrating to a real backend, `listPatients` can be updated to accept pagination and filter parameters (`searchPatients(params)`). For the local MVP, loading all patients and filtering on the client perfectly mimics standard simple-app behavior.

## 17. What Must NOT Be Changed in ARCH-030
- Do NOT change `PatientModal.tsx`. It does not need an `isSaving` prop yet.
- Do NOT change `storage.ts`.
- Do NOT remove `storage.getAppointments()` from `PatientsPage` (leave it as a known technical debt for the Schedule domain migration).
- Do NOT change `PatientCardPage.tsx`.
- Do NOT change any clinical tabs.

## 18. Acceptance Criteria for Future ARCH-030
- `PatientRepository` implements `listPatients` and `createPatient`.
- A hook (e.g., `usePatientsList`) provides the list and the async mutation methods.
- `PatientsPage` uses the hook instead of `storage.getPatients`, `storage.addPatient`, and `storage.updatePatient`.
- `PatientsPage` still handles its own client-side filtering.
- `PatientsPage` still temporarily uses `storage.getAppointments()` for the visits computation.
- `PatientModal` usage is wrapped in an `async` handler in `PatientsPage` that awaits the hook's mutation methods and closes the modal only on success.

## 19. Recommended Next Task
**ARCH-030 — Implement minimal PatientsPage DAL list/create/edit migration according to ARCH-029 design.**
