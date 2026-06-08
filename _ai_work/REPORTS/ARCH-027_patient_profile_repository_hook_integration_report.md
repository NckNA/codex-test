# ARCH-027: Patient Profile Repository and Hook Integration Report

## 1. Files Inspected
- `_ai_work/REPORTS/ARCH-026_patient_profile_repository_hook_contract.md`
- `src/pages/PatientCardPage.tsx`
- `src/components/patients/PatientModal.tsx`
- `src/data/hooks/useAsyncQuery.ts`
- `src/data/hooks/useChiefComplaint.ts`
- `src/utils/storage.ts`
- `src/types/index.ts`

## 2. Files Changed
- **Created**: `src/data/repositories/PatientRepository.ts`
- **Created**: `src/data/hooks/usePatientProfile.ts`
- **Modified**: `src/pages/PatientCardPage.tsx`
- **Created**: `_ai_work/REPORTS/ARCH-027_patient_profile_repository_hook_integration_report.md`

## 3. Repository Implementation Summary
- `PatientRepository.ts` was created.
- `LocalStoragePatientRepository` implements `getPatientById` and `updatePatient`.
- `getPatientById` uses `storage.getPatients().find`.
- `updatePatient` uses `storage.updatePatient`.
- The interface is Promise-based and returns/accepts `Patient` types with no `any`.
- List/search methods were intentionally excluded.

## 4. Hook Implementation Summary
- `usePatientProfile.ts` was created.
- Data fetching uses the object-style API of `useAsyncQuery` (`{ queryFn, initialData, enabled }`) with `useCallback` for the query function.
- `useAsyncMutation` was explicitly NOT used.
- `savePatient` is a robust manual wrapper that manages `isSaving`, clears/sets `saveError`, awaits the repository update, and then awaits a `refetch()` call.
- On error, `savePatient` throws the parsed error.
- Hook exposes merged error states: `isError` prioritizing `saveError !== null`, and `error` prioritizing `saveError || queryError`.

## 5. PatientCardPage Integration Summary
- Direct `storage` imports and `getPatients`/`updatePatient` calls were completely removed from `PatientCardPage`.
- `PatientCardPage` now exclusively uses the `usePatientProfile` hook to fetch and update the patient.
- `handleSave` is now `async`. It wraps the `savePatient` call in a try/catch, closing the modal only on success. If an error occurs, it is caught internally, avoiding unhandled promise rejections.

## 6. Loading/Not-Found/Error Behavior
- A minimal full-page spinner and "Загрузка карточки пациента..." text is displayed while `isPatientLoading` is true.
- A minimal error state with a "Повторить" (Retry) button is displayed if `isPatientError` is true.
- If loading finishes and the patient is still falsy, the existing "Пациент не найден" UI is shown.

## 7. Save/Edit Behavior
- The `PatientModal`'s synchronous `onSave` call continues to work flawlessly with the new async `handleSave`.
- On success, the modal closes.
- On failure, the modal safely remains open.

## 8. What Behavior Was Preserved
- The patient card loads successfully.
- The editing modal opens, saves, and updates the profile correctly.
- All tabs (Overview, History, Dental Chart, Findings, Treatment Plans, etc.) render perfectly.
- The `usePatientMedicalSummary` hook and its tab-change refetch logic still function independently.
- `PatientModal` remains untouched.

## 9. What Was Intentionally Not Changed
- `PatientModal.tsx` was not changed.
- `PatientOverviewTab.tsx` and all clinical tabs were not changed.
- `SchedulePage.tsx` was not changed.
- `PatientsPage` / list / search were not changed.
- `usePatientMedicalSummary.ts` and `ClinicalSummaryAggregator.ts` were not changed.
- `useAsyncQuery.ts` and `useAsyncMutation.ts` were not changed.
- `storage.ts` and `types/index.ts` were not changed.
- No React Query, Context, Event Bus, or global state was introduced.

## 10. Checks Performed
- ✅ `PatientRepository.ts` created.
- ✅ `usePatientProfile.ts` created.
- ✅ `PatientCardPage.tsx` modified to remove `storage`.
- ✅ `PatientModal.tsx` unchanged.
- ✅ `PatientOverviewTab.tsx` unchanged.
- ✅ Clinical tabs unchanged.
- ✅ `SchedulePage.tsx` unchanged.
- ✅ `PatientsPage`/list/search unchanged.
- ✅ `usePatientMedicalSummary.ts` unchanged.
- ✅ `ClinicalSummaryAggregator.ts` unchanged.
- ✅ `useAsyncQuery` and `useAsyncMutation` unchanged.
- ✅ `storage.ts` unchanged.
- ✅ `types/index.ts` unchanged.
- ✅ `PatientCardPage` no longer imports or calls `storage`.
- ✅ `useAsyncMutation` was not used.
- ✅ No `any` used.
- ✅ `backend`, `package.json`, `routes`, dependencies unchanged.

## 11. Known Limitations
- `PatientModal` does not accept an `isSaving` prop and therefore does not show a spinning state on its "Save" button. This is acceptable for the MVP.
- Patient list and search pages still access storage directly.

## 12. Recommended Next Task
**ARCH-028 — Review patient profile DAL integration and decide next patient-domain boundary.**
