# ARCH-026: PatientProfile Repository and Hook Contract

## 1. Title
ARCH-026 — Design PatientRepository / usePatientProfile contract for PatientCardPage patient loading/editing.

## 2. Scope
This document outlines the design for migrating the patient profile loading and editing logic out of `PatientCardPage` and into a standardized Data Access Layer (DAL). It defines the `PatientRepository` interface, the `usePatientProfile` hook, and the integration strategy for ARCH-027.

## 3. Inputs Reviewed
- `_ai_work/REPORTS/ARCH-025_review_summary_refetch_and_next_boundary.md`
- `src/pages/PatientCardPage.tsx`
- `src/components/patients/PatientModal.tsx`
- Existing DAL hooks and repositories (e.g., `useChiefComplaint`, `useAsyncQuery`)
- `src/utils/storage.ts`

## 4. Current PatientCardPage Patient Profile Flow
- **Loading**: `PatientCardPage` uses a `useMemo` block to synchronously read from `storage.getPatients()` and find the patient by `patientId`. If `!patient`, it returns a hardcoded "Пациент не найден" UI.
- **Saving**: `handleSave` directly calls `storage.updatePatient(updated)` and then immediately calls `setIsModalOpen(false)`.

## 5. Current PatientModal Integration
- `PatientModal` accepts `onSave: (patient: Patient) => void`.
- The modal's internal `handleSubmit` is synchronous. It validates the form, constructs the updated `Patient` object, calls `onSave(patientToSave)`, but it does **not** manage its own open/closed state. The closing action is orchestrated entirely by `PatientCardPage`.

## 6. Existing DAL Patterns to Reuse
- `useAsyncQuery` will be used for the initial profile fetch.
- `savePatient` mutation should be a manual wrapper function (similar to the pattern used in `useChiefComplaint`), or `useAsyncMutation` if carefully managed, because `updatePatient` returns `void`. Using a manual wrapper around `useAsyncQuery`'s `refetch` provides more control over error handling and the subsequent cache invalidation.

## 7. Proposed PatientRepository Contract
**Immediate Needs (for ARCH-027)**:
```typescript
export interface PatientRepository {
  getPatientById(patientId: string): Promise<Patient | null>;
  updatePatient(patient: Patient): Promise<void>;
}
```

**Deferred to Future Tasks (e.g., Patient List Migration)**:
```typescript
// Not part of ARCH-027
// listPatients(): Promise<Patient[]>;
// searchPatients(query: string): Promise<Patient[]>;
// createPatient(patient: Omit<Patient, 'id'>): Promise<Patient>;
```

## 8. Proposed LocalStoragePatientRepository Behavior
```typescript
import { storage } from '../../utils/storage';
import { Patient } from '../../types';

export const LocalStoragePatientRepository = {
  async getPatientById(patientId: string): Promise<Patient | null> {
    const patients = storage.getPatients();
    const patient = patients.find(p => p.id === patientId);
    return patient || null;
  },

  async updatePatient(patient: Patient): Promise<void> {
    storage.updatePatient(patient);
  }
};
```

## 9. Proposed usePatientProfile Contract
```typescript
export function usePatientProfile(patientId: string) {
  // 1. Data Fetching
  const { data, isLoading, isError, error, refetch } = useAsyncQuery<Patient | null>(
    () => LocalStoragePatientRepository.getPatientById(patientId),
    [patientId],
    Boolean(patientId) // enabled
  );

  // 2. Mutation State
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<Error | null>(null);

  // 3. Save Function
  const savePatient = async (patient: Patient) => {
    try {
      setIsSaving(true);
      setSaveError(null);
      await LocalStoragePatientRepository.updatePatient(patient);
      await refetch(); // refresh local state immediately
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Failed to save patient');
      setSaveError(err);
      throw err; // throw so UI can prevent modal close
    } finally {
      setIsSaving(false);
    }
  };

  return {
    patient: data || null,
    isLoading,
    isError: isError || saveError !== null,
    error: error || saveError,
    isSaving,
    savePatient,
    refetch,
  };
}
```

## 10. Query/Loading/Not-Found Behavior
In `PatientCardPage`:
- **While `isLoading` is true**: Return a minimal full-page loading spinner/skeleton. The patient identity is critical to the entire layout, so rendering tabs without a patient object is impossible.
- **After loading, if `!patient`**: Return the *existing* "Пациент не найден" (Patient not found) fallback UI.
- **If `isError`**: Render a minimal error boundary or add a retry button to the "not found" screen.

## 11. Save/Edit Behavior
In `PatientCardPage`, `handleSave` will be updated to:
```typescript
  const handleSave = async (updated: Patient) => {
    try {
      await savePatient(updated);
      setIsModalOpen(false); // only close on success
    } catch (error) {
      console.error("Failed to save patient:", error);
      // Optional: show toast notification here. The modal remains open.
    }
  };
```
Because `PatientModal` types `onSave` as `(patient: Patient) => void`, passing an `async` function is perfectly valid in TypeScript (as promises satisfy `void` returns). `PatientModal` does not need to be changed.

## 12. Future PatientCardPage Integration Plan (ARCH-027)
1. Create `src/data/repositories/PatientRepository.ts`.
2. Create `src/data/hooks/usePatientProfile.ts`.
3. In `PatientCardPage`, replace the `useMemo` direct storage read with `usePatientProfile`.
4. Replace `storage.updatePatient` inside `handleSave` with `savePatient`.
5. Add a simple full-page `isLoading` fallback.
6. Keep the "Not found" UI.
7. Do not touch `PatientOverviewTab`, `PatientModal`, or the clinical tabs.

## 13. Risks and Constraints
- **Async Modal Save**: The modal might not show a spinning loader on the "Save" button because `PatientModal` does not accept an `isSaving` prop. This is a minor UX limitation acceptable for the MVP. Modifying `PatientModal` adds scope risk and is explicitly avoided.
- **Double Loading States**: The page will briefly show the patient loading state, and then the medical summary loading banner. This is an expected side-effect of decoupling the hooks.

## 14. What Must NOT Be Changed in the Implementation Task
- Do not modify `PatientModal.tsx`.
- Do not modify `PatientOverviewTab.tsx` or clinical tabs.
- Do not modify `storage.ts`.
- Do not implement patient list/search DAL features.
- Do not introduce React Query, Redux, Context, or Event Bus.

## 15. Acceptance Criteria for Future Implementation (ARCH-027)
- `PatientRepository` provides `getPatientById` and `updatePatient`.
- `usePatientProfile` manages the fetch and save lifecycle.
- `PatientCardPage` is successfully integrated.
- `storage.getPatients()` is completely removed from `PatientCardPage`.
- The application compiles and runs without warnings or errors.

## 16. Recommended Next Task
**ARCH-027 — Implement PatientRepository and usePatientProfile, then integrate PatientCardPage patient loading/editing.**
