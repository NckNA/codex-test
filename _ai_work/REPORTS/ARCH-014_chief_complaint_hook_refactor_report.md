# ARCH-014: Chief Complaint Query Flow Refactor Report

## 1. Files Inspected
- `_ai_work/REPORTS/ARCH-013_review_async_utilities_and_chief_complaint_plan.md`
- `src/data/hooks/useChiefComplaint.ts`
- `src/data/hooks/useAsyncQuery.ts`
- `src/data/hooks/useAsyncMutation.ts`
- `src/data/repositories/ChiefComplaintRepository.ts`
- `src/components/dental/FindingsRisksTab.tsx`

## 2. Files Changed
- **Modified:** `src/data/hooks/useChiefComplaint.ts`

## 3. Refactor Summary
The `useChiefComplaint` hook was successfully refactored to eliminate its data-loading boilerplate by consuming the `useAsyncQuery` utility. The query state management (`isLoading`, `isError`, error handling, and unmounted safety) is now delegated to `useAsyncQuery`. The `saveComplaint` mutation remains a manual wrapper using standard React `useState` and `useCallback` to track `isSaving` and `saveError`. Finally, the query and save error states are successfully merged into a single `isError` / `error` pair, with `saveError` taking precedence to prevent older query errors from masking recent save failures. A `refetchComplaint` wrapper was also added to correctly clear save error state when the hook is manually refetched, perfectly preserving the hook's existing API contract.

## 4. Why useAsyncMutation Was Intentionally Not Used
As determined in ARCH-013, `useAsyncMutation` was explicitly excluded from this task for two reasons:
1. **Void Return Limitation**: `LocalStorageChiefComplaintRepository.saveChiefComplaint` returns `void`. Because `useAsyncMutation` returns `undefined` on both success (when `TResult = void`) and error, a caller cannot safely rely on `result === undefined` to distinguish failure.
2. **Timing Alteration**: The current `saveComplaint` directly `await`s the repository save, followed immediately by `await refetch()`. Using `useAsyncMutation`'s `onSuccess` callback would decouple the refetch timing (it would be fired asynchronously after mutation), potentially resolving `saveComplaint` before the refreshed data is available.

Keeping `saveComplaint` manual eliminates these risks.

## 5. Public API Compatibility Confirmation
The returned object of `useChiefComplaint(patientId)` remains identical:
- `complaint`: `ChiefComplaint | null`
- `isLoading`: `boolean`
- `isError`: `boolean`
- `error`: `Error | null`
- `isSaving`: `boolean`
- `refetch`: `() => Promise<void>`
- `saveComplaint`: `(input: Omit<ChiefComplaint, ...>) => Promise<void>`

## 6. Save Behavior Preservation
- The `saveComplaint` wrapper sets `isSaving` to `true`.
- It awaits the underlying `saveChiefComplaint` repository method.
- Upon success, it awaits `refetchComplaint()`, ensuring the latest server/storage state is loaded.
- Upon failure, it sets `isSaveError` and re-throws the exact error.
- It sets `isSaving` to `false` via a `finally` block.

**Refetch and Error Behavior Fixes:**
- **Error Precedence:** The merged `error` property now strictly prefers `saveError || queryError`. This ensures that a recent save failure is never masked by a stale query error.
- **Error Clearing on Refetch:** A `refetchComplaint` wrapper guarantees that `setIsSaveError(false)` and `setSaveError(null)` are called before hitting the underlying `refetch()`. This perfectly aligns with the old hook logic where `fetchComplaint` cleared all shared error states.

## 7. What Behavior Was Preserved
- The `FindingsRisksTab` behaves exactly as it did before.
- Local form draft state correctly populates on initial load.
- The "Сохранить жалобу" button disables correctly during saving.
- The inline "Сохранено" feedback works because the component logic was untouched.

## 8. What Was Intentionally Not Changed
- `useAsyncMutation` was **NOT** used in `useChiefComplaint`.
- `FindingsRisksTab` was **NOT** changed.
- No other UI components were changed.
- `storage.ts` was **NOT** changed.
- `types/index.ts` was **NOT** changed.
- `ChiefComplaintRepository` was **NOT** changed.
- `useAsyncQuery` and `useAsyncMutation` were **NOT** changed.
- `package.json`, routes, and backend were **NOT** changed.
- React Query, global state managers, or new dependencies were **NOT** introduced.
- No `any` casting was used.

## 9. Checks Performed
- ✅ `npm run lint` passed (0 errors, 0 warnings).
- ✅ `npm run build` passed successfully.
- ✅ Visual inspection confirms `FindingsRisksTab` code is unchanged.
- ✅ Visual inspection confirms `saveComplaint` strictly awaits `refetch()`.
- ✅ Visual inspection confirms `saveComplaint` throws on failure.

## 10. Remaining Risks
The hook architecture for the current scope is now clean and mostly boilerplate-free. There are no major immediate risks. Future complex modules (e.g., Dental Chart) might require true caching or global invalidation, which the current `useAsyncQuery` does not support.

## 11. Recommended Next Task
**ARCH-015 — Review useChiefComplaint refactor and decide next migration boundary.**
