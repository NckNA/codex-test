# ARCH-012: Async Hook Utilities and Read-Only Refactor Report

## 1. Files Inspected
- `_ai_work/REPORTS/ARCH-011_shared_async_hook_utility_design.md`
- `src/data/hooks/useClinicDoctors.ts`
- `src/data/hooks/usePatientAppointments.ts`
- `src/data/hooks/useChiefComplaint.ts`
- `src/data/repositories/DoctorRepository.ts`
- `src/data/repositories/AppointmentRepository.ts`

## 2. Files Changed
- **New:** `src/data/hooks/useAsyncQuery.ts`
- **New:** `src/data/hooks/useAsyncMutation.ts`
- **Modified:** `src/data/hooks/useClinicDoctors.ts`
- **Modified:** `src/data/hooks/usePatientAppointments.ts`

## 3. useAsyncQuery Implementation Summary
Created a generic, strongly typed internal utility hook `useAsyncQuery<T>` using only native React primitives. It handles initialization, loading states, error catching, and safely blocks state updates if the component is unmounted (using a shared `isMountedRef`). This unmount safety explicitly protects *both* the initial load and any subsequent manual `refetch` calls. It accepts a `queryFn`, `initialData`, and an `enabled` flag. A targeted `eslint-disable-next-line` was added to safely toggle off `isLoading` when `enabled` dynamically becomes false.

## 4. useAsyncMutation Implementation Summary
Created a generic `useAsyncMutation<TInput, TResult>` utility. It encapsulates `isMutating`, `isError`, and `error` states, and provides a safe wrapper around asynchronous `mutationFn` executions. Like `useAsyncQuery`, it uses a shared `isMountedRef` to strictly prevent `setState` calls or `onSuccess`/`onError` callback executions if the component has unmounted before the Promise resolves. It safely catches thrown errors and casts them to standard `Error` objects.

## 5. useClinicDoctors Refactor Summary
Refactored to rely purely on `useAsyncQuery`. The boilerplate `useState` and `useEffect` blocks were deleted. It still calls `LocalStorageDoctorRepository.listDoctors()` inside a `useCallback`, ensuring that historical doctor names (even inactive ones) continue to be resolvable. The public return shape remains identical.

## 6. usePatientAppointments Refactor Summary
Refactored to rely on `useAsyncQuery`. Boilerplate was removed. The query explicitly passes `enabled: Boolean(patientId)` to prevent fetching if a patient ID is absent. The public API (`appointments`, `isLoading`, `isError`, `error`, `refetch`) remains fully backwards compatible.

## 7. What Behavior Was Preserved
- The public APIs of the migrated hooks are exactly the same.
- UI components (e.g., `PatientHistoryTab`) were completely unaffected.
- The `patientId` guard correctly prevents null fetching.
- Repository behavior and storage access rules are unchanged.

## 8. What Was Intentionally Not Changed
- `useChiefComplaint` was **NOT** changed, as it contains mixed query/mutation logic and is reserved for the next stabilization phase.
- UI components (`PatientHistoryTab`, `PatientCardPage`, `PatientOverviewTab`) were **NOT** changed.
- `storage.ts` and `types/index.ts` were **NOT** changed.
- Repositories were **NOT** changed.
- Dependencies (`package.json`) were **NOT** changed.
- Global state management (React Query/Redux) or real backends were **NOT** introduced.
- No `any` casting was used.

## 9. Checks Performed
- ✅ `npm run lint` passed (0 errors, 0 warnings).
- ✅ `npm run build` passed successfully.
- ✅ Verified `useChiefComplaint` was not touched.
- ✅ Verified UI components were unmodified.
- ✅ Verified hook public return types correctly matched previous implementations.

## 10. Remaining Risks
The `useAsyncMutation` hook has been created but is not yet utilized. The `useChiefComplaint` hook remains the sole holdout of duplicated boilerplate. Migrating it will be slightly more complex since it must integrate both `useAsyncQuery` and `useAsyncMutation` into a single public interface.

## 11. Recommended Next Task
**ARCH-013 — Review async hook utility implementation and decide whether to refactor useChiefComplaint mutation flow next.**
