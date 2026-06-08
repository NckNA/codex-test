# ARCH-062: Header Doctors Storage Cleanup Report

## 1. Files Inspected
- `_ai_work/REPORTS/ARCH-061_review_treatment_storage_free_app_wide_storage_map.md`
- `src/components/layout/Header.tsx`
- `src/data/hooks/useClinicDoctors.ts`
- `src/data/repositories/DoctorRepository.ts`
- `src/types/index.ts`

## 2. Files Changed
- `src/components/layout/Header.tsx`
- `_ai_work/REPORTS/ARCH-062_header_doctors_storage_cleanup_report.md` (this file)

## 3. Current Header Storage Dependency Before Change
Before the cleanup, `Header.tsx` explicitly imported `storage` from `../../utils/storage` and populated the doctor dropdown list by calling `storage.getDoctors()` synchronously during component rendering.

## 4. Summary of Cleanup
The direct import to `storage.ts` in `Header.tsx` was successfully removed. The doctor data used to populate the dropdown filter is now supplied by the `useClinicDoctors` hook, adhering to the standard DAL (Data Access Layer) abstraction used in the rest of the application. The logic for filtering and rendering the dropdown options remained exactly the same.

## 5. Hook Used
`useClinicDoctors` (from `../../data/hooks/useClinicDoctors`)

## 6. Confirmation that Header.tsx No Longer Imports storage.ts
Confirmed. The line `import { storage } from '../../utils/storage';` was deleted.

## 7. Confirmation that Header.tsx No Longer Calls Storage Directly
Confirmed. All direct references to `storage` object and `storage.getDoctors()` were removed.

## 8. Confirmation that UI Behavior/Layout Was Preserved
Confirmed. The variables and mapping logic (`doctors.find`, `doctors.map`) rely on the exact same array structure returned by `useClinicDoctors()`. CSS classes, layouts, and filter logic (including "Все врачи") are fully preserved.

## 9. What Was Intentionally Not Changed
- `PatientCardPage` and any aggregators were left untouched.
- `useClinicDoctors`, `DoctorRepository`, and `storage.ts` were strictly preserved.
- No new state managers or caches were introduced.
- Treatment plans and dental UI components were left untouched.

## 10. Checks Performed
- **`Header.tsx` changed?** Yes.
- **Storage import removed from `Header.tsx`?** Yes.
- **`Header.tsx` still calls storage directly?** No.
- **`useClinicDoctors` was used?** Yes.
- **`PatientCardPage` was changed?** No.
- **Treatment/dental components changed?** No.
- **Hooks/repositories/orchestrators/aggregators/storage/types/tests/package/backend/configs changed?** No.
- **`useAsyncMutation` used?** No.
- **`any` used?** No.
- **Global state/event bus introduced?** No.
- **RESEARCH-003/domain model v2 implemented?** No.

## 11. Mandatory Manual Browser Smoke Result
**Result:** SKIPPED (Hard Blocker)

**Reason for skipping:**
I am explicitly forbidden from using MCP Tools or browser automation in this task. Without these tools, an AI agent cannot interactively open the app in a browser to perform visual smoke tests.

**What was verified instead:**
- Verified TypeScript compilation (`npm run build` succeeds), ensuring no type mismatches between `storage.getDoctors()` and `useClinicDoctors()`.
- Verified `useClinicDoctors()` signature matches the required `doctors` array used in `Header.tsx`.
- Ensured default values and error states don't break the destructured variables (`const { doctors } = useClinicDoctors()`).

## 12. Known Limitations
- Aggregators (`ClinicalSummaryAggregator`, `PatientListVisitSummaryAggregator`) still directly depend on `storage.ts`.
- `PatientCardPage` summary refresh still relies on legacy re-entry behavior.
- No global cross-tab refresh system exists.
- RESEARCH-003 domain model v2 remains documentation-only.

## 13. Recommended Next Task
**ARCH-063 — Review aggregator/read-model storage dependencies and decide first safe summary migration boundary.**
