# ARCH-009: PatientHistoryTab Doctors Hook Migration Report

## 1. Files Inspected
- `_ai_work/REPORTS/ARCH-008_review_appointments_slice_and_next_readonly_plan.md`
- `src/components/patients/patient-card/PatientHistoryTab.tsx`
- `src/pages/PatientCardPage.tsx`
- `src/utils/storage.ts`
- `src/types/index.ts`

## 2. Files Changed
- **New:** `src/data/repositories/DoctorRepository.ts`
- **New:** `src/data/hooks/useClinicDoctors.ts`
- **Modified:** `src/components/patients/patient-card/PatientHistoryTab.tsx`
- **Modified:** `src/pages/PatientCardPage.tsx`

## 3. Repository Implementation Summary
Created `IDoctorRepository` and its `LocalStorageDoctorRepository` adapter. It provides `listDoctors()` and `listActiveDoctors()`. `storage.getDoctors()` was successfully encapsulated without modifying the base storage logic or the `Doctor` type.

## 4. Hook Implementation Summary
Created the `useClinicDoctors()` hook. It internally calls `LocalStorageDoctorRepository.listDoctors()`. We deliberately used `listDoctors()` instead of `listActiveDoctors()` to ensure the appointment history can correctly resolve the names of doctors who may have been deactivated since the past appointment occurred. It manages the standard async React lifecycle (`isLoading`, `isError`, `error`).

## 5. PatientHistoryTab Migration Summary
Removed the `doctors` prop entirely from `PatientHistoryTabProps`. The component now independently invokes `useClinicDoctors()` to fetch the clinic's doctor list for resolving IDs in appointment rows. The loading and error states for both appointments and doctors are smoothly combined. Unused type imports (`Doctor`) were also removed.

## 6. PatientCardPage Change Summary
Removed the `doctors={doctors}` prop passing when rendering `PatientHistoryTab`. Furthermore, the `useMemo` that previously loaded the global doctors array in `PatientCardPage` was completely removed, as it was no longer used by any other tab or summary component on the page.

## 7. What Behavior Was Preserved
- The history tab lists appointments and resolves doctor names flawlessly.
- Visual elements, table formatting, colors, and empty states remain intact.
- Header summaries and global states on the page still load correctly.
- Types and storage layer logic are fully preserved.
- Historical data integrity is preserved (names of inactive doctors still display).

## 8. What Was Intentionally Not Changed
- `storage.ts` was **NOT** changed.
- `src/types/index.ts` was **NOT** changed.
- Schedule Page was **NOT** changed.
- Patient Overview Tab was **NOT** changed.
- Appointment mutations (create/edit) were **NOT** added.
- Doctor mutations (create/edit/deactivate) were **NOT** added.
- React Query, global state managers, or real backends were **NOT** introduced.
- No `any` casting was used anywhere.
- `listActiveDoctors()` is exposed by the repository since the type supports it (`active: boolean`), but we intentionally used `listDoctors()` in the hook.

## 9. Checks Performed
- ✅ `npm run lint` passed (0 errors, 0 warnings).
- ✅ `npm run build` passed successfully.
- ✅ Verified `storage.ts` and types remained untouched.
- ✅ Verified `SchedulePage` and other tabs were undisturbed.
- ✅ Verified `PatientHistoryTab` is now 100% decoupled from parent data arrays.

## 10. Remaining Risks
The duplication of boilerplate (`isLoading`, `isError`, `mounted` flags, `useEffect` initialization) across three different hooks (`useChiefComplaint`, `usePatientAppointments`, `useClinicDoctors`) is now highly visible. Before migrating highly complex features like the dental chart or patient overview, it may be necessary to abstract this into a shared generic hook utility.

## 11. Recommended Next Task
**ARCH-010 — Review PatientHistoryTab full decoupling and decide whether to pause migrations for shared hook utility planning.**
