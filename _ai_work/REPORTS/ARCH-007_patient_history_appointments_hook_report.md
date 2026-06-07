# ARCH-007: PatientHistoryTab Appointments Hook Migration Report

## 1. Files Inspected
- `_ai_work/REPORTS/ARCH-006_review_chief_complaint_slice_and_next_migration_plan.md`
- `src/components/patients/patient-card/PatientHistoryTab.tsx`
- `src/pages/PatientCardPage.tsx`
- `src/utils/storage.ts`
- `src/types/index.ts`

## 2. Files Changed
- **New:** `src/data/repositories/AppointmentRepository.ts`
- **New:** `src/data/hooks/usePatientAppointments.ts`
- **Modified:** `src/components/patients/patient-card/PatientHistoryTab.tsx`
- **Modified:** `src/pages/PatientCardPage.tsx`

## 3. Repository Implementation Summary
Created `IAppointmentRepository` and its `LocalStorageAppointmentRepository` adapter. It provides `listAppointmentsByPatient(patientId)` which filters and sorts appointments safely inside the repository using the existing `storage.getAppointments()`. It operates exclusively using the `Appointment` type.

## 4. Hook Implementation Summary
Created the `usePatientAppointments(patientId)` hook. It internally calls the repository and safely manages the async React lifecycle (`isLoading`, `isError`, `error`). Since appointments are read-only in this context, the hook focuses entirely on fetching and caching state natively without exposing mutation methods.

## 5. PatientHistoryTab Migration Summary
Replaced the `appointments` prop with `patientId`. The component now directly invokes `usePatientAppointments` to fetch data. Added a smooth `"Загрузка истории приёмов..."` placeholder and an error block, while keeping the main table design, empty state, and status helpers perfectly intact. Unused imports were cleaned up.

## 6. PatientCardPage Change Summary
Updated the `PatientHistoryTab` rendering to pass `patientId` instead of passing the synchronously computed `appointments` array. The global `appointments` list loaded by `PatientCardPage` remains untouched since it is still required to calculate global `lastVisit` and `nextVisit` in the header overview.

## 7. What Behavior Was Preserved
- The history tab lists appointments flawlessly with identical sorting and filtering.
- Visual elements (table, colors, labels, empty state) remain the same.
- Header summaries and global states on the page still load correctly.
- Types and storage layer logic are fully preserved.

## 8. What Was Intentionally Not Changed
- `storage.ts` was **NOT** changed.
- `src/types/index.ts` was **NOT** changed.
- Global appointment fetching for the `PatientCardPage` summary was **NOT** changed (as requested).
- Schedule Page was **NOT** changed.
- Patient Overview Tab was **NOT** changed.
- Appointment mutations (create/edit) were **NOT** added.
- React Query, global state managers, or real backends were **NOT** introduced.
- No `any` casting was used anywhere.

## 9. Checks Performed
- ✅ `npm run lint` passed (0 errors, 0 warnings).
- ✅ `npm run build` passed successfully.
- ✅ Verified `storage.ts` and types remained untouched.
- ✅ Verified `SchedulePage` and other tabs were undisturbed.

## 10. Remaining Risks
The hook safely encapsulates read-only fetching. The biggest remaining challenge is that `PatientCardPage` still synchronously queries the entire appointments list to calculate `lastVisit` and `nextVisit`. This confirms that migrating aggregate/summary components (like `PatientOverviewTab` and headers) will require careful coordination of multiple async hooks or specialized backend aggregation endpoints in the future.

## 11. Recommended Next Task
**ARCH-008 — Review ARCH-007 appointments slice and plan next read-only migration.**
