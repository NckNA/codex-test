# ARCH-013: Review Async Hook Utilities and Plan useChiefComplaint Refactor

## 1. Scope
This report reviews the ARCH-012 async hook utility implementation, confirms that read-only hooks were correctly refactored, and defines a safe migration plan for refactoring `useChiefComplaint` to use `useAsyncQuery` + `useAsyncMutation` without UI changes.

## 2. Inputs Reviewed
- `_ai_work/REPORTS/ARCH-012_async_hook_utilities_readonly_refactor_report.md`
- `src/data/hooks/useAsyncQuery.ts`
- `src/data/hooks/useAsyncMutation.ts`
- `src/data/hooks/useClinicDoctors.ts`
- `src/data/hooks/usePatientAppointments.ts`
- `src/data/hooks/useChiefComplaint.ts`
- `src/data/repositories/ChiefComplaintRepository.ts`
- `src/components/dental/FindingsRisksTab.tsx`

## 3. ARCH-012 Implementation Summary
ARCH-012 delivered two shared utilities and refactored two read-only hooks:
- `useAsyncQuery<T>` — generic async data loading with `isMountedRef`-based unmount safety for both initial fetch and manual `refetch`.
- `useAsyncMutation<TInput, TResult>` — generic async mutation wrapper with `isMountedRef`-based unmount safety, not yet consumed by any hook.
- `useClinicDoctors` — refactored to use `useAsyncQuery`, reduced from 64 lines to 29 lines.
- `usePatientAppointments` — refactored to use `useAsyncQuery`, reduced from 67 lines to 31 lines.

## 4. Utility Implementation Review
### useAsyncQuery
- Uses `useRef(true)` for `isMountedRef`, reset on cleanup via a dedicated `useEffect([], …)`.
- `executeFetch` is a `useCallback` that guards all `setState` calls and `onSuccess`/`onError` callbacks behind `isMountedRef.current`.
- Initial load is triggered by a second `useEffect([enabled, executeFetch])` that respects the `enabled` flag.
- `refetch` delegates to the same `executeFetch` and also respects `enabled`.
- A targeted `eslint-disable-next-line` suppresses the `set-state-in-effect` lint for the `setIsLoading(false)` call when `enabled` is false.
- No `any` used. No caching. No global state.

### useAsyncMutation
- Same `isMountedRef` pattern as `useAsyncQuery`.
- `mutate` guards `setState` and callbacks behind `isMountedRef.current` on both success and error paths.
- Returns `result` on success (even if unmounted — the return value is still useful to the caller), `undefined` on error.
- `reset` is guarded by `isMountedRef` as well.
- No `any` used. No caching. No global state.

**Verdict:** Both utilities are acceptable for the `useChiefComplaint` refactor.

## 5. Read-Only Hook Refactor Review
- `useClinicDoctors`: Public API unchanged (`doctors`, `isLoading`, `isError`, `error`, `refetch`). Still calls `listDoctors()` (not `listActiveDoctors()`). Correct.
- `usePatientAppointments`: Public API unchanged (`appointments`, `isLoading`, `isError`, `error`, `refetch`). Uses `enabled: Boolean(patientId)`. Correct.

## 6. Confirmations
- ✅ `useChiefComplaint` was not changed in ARCH-012.
- ✅ UI components were not changed.
- ✅ `storage.ts` was not changed.
- ✅ Repositories were not changed.
- ✅ Read-only hook public APIs remained unchanged.
- ✅ `useAsyncQuery` protects initial load and refetch from unmounted state updates.
- ✅ `useAsyncMutation` protects mutation resolution/rejection from unmounted state updates.
- ✅ No `any` was used.

## 7. useChiefComplaint Current State
The hook currently manages both query and mutation lifecycles manually:

**Query responsibilities (lines 6–58):**
- Loads complaint via `LocalStorageChiefComplaintRepository.getChiefComplaint(patientId)`.
- Tracks `complaint`, `isLoading`, `isError`, `error`.
- Provides `refetch` (aliased from `fetchComplaint`).
- Uses a local `mounted` flag in `useEffect` for unmount safety.
- Guards on `!patientId` to skip fetch.

**Mutation responsibilities (lines 60–77):**
- Saves complaint via `LocalStorageChiefComplaintRepository.saveChiefComplaint(patientId, input)`.
- Tracks `isSaving`.
- After successful save, calls `fetchComplaint()` to refetch the updated entity.
- Re-throws on error (the `throw err` on line 73).

**Public API (lines 79–87):**
```typescript
{
  complaint,    // ChiefComplaint | null
  isLoading,    // boolean
  isError,      // boolean
  error,        // Error | null
  isSaving,     // boolean
  refetch,      // () => Promise<void>
  saveComplaint, // (input) => Promise<void>
}
```

**Consumer: FindingsRisksTab (line 68):**
```typescript
const { complaint, isLoading: isComplaintLoading, isSaving: isComplaintSaving, saveComplaint } = useChiefComplaint(patientId);
```
- Uses `complaint` to initialize local draft state (`complaintText`, `complaintTeethInput`) via a `useEffect`.
- Uses `isComplaintLoading` for overlay and button disable.
- Uses `isComplaintSaving` for button text and disable.
- Calls `saveComplaint` from `handleSaveComplaint`, then sets `isSaved` locally.
- Does NOT use `isError`, `error`, or `refetch` directly.

## 8. useChiefComplaint Migration Risks

### Risk 1: Query and mutation state coexistence
The current hook uses a single shared `isError`/`error` for both query failures and save failures. With `useAsyncQuery` + `useAsyncMutation` these would be separate. The refactored hook must merge them back into a single `isError`/`error` to preserve the public API.

### Risk 2: `isSaving` must remain in public API
`useAsyncMutation` returns `isMutating`. The refactored hook must alias this to `isSaving`.

### Risk 3: Post-save refetch and timing
Currently `saveComplaint` **awaits** `fetchComplaint()` after a successful save. This means `saveComplaint` does not resolve until the refreshed complaint data is available in state. Any refactored version must preserve this sequential timing: the caller's `await saveComplaint(...)` must not resolve until the refetch has completed.

Using `useAsyncMutation`'s `onSuccess` callback to fire `refetch()` would not await the refetch — `onSuccess` is a fire-and-forget callback inside `useAsyncMutation`. This would subtly change timing: `saveComplaint` would resolve before the refreshed data is available, potentially breaking the `isSaved` feedback flow in `FindingsRisksTab`.

### Risk 4: `saveComplaint` re-throws on error and void mutation detection
The current `saveComplaint` uses `throw err` inside its catch block. With `useAsyncMutation<TInput, void>`, `mutate` returns `undefined` on **both** success (because `TResult = void`) and error. Therefore, **checking `result === undefined` cannot distinguish success from failure for void mutations**. This makes `useAsyncMutation` unsuitable for preserving the throw-on-error behavior without modification.

#### ARCH-014 Strategy Options

**Option A — Use `useAsyncQuery` only; keep manual `saveComplaint` wrapper (recommended):**
- Adopt `useAsyncQuery` for the loading/query half of `useChiefComplaint`.
- Keep `saveComplaint` as a manually written async function that directly awaits the repository save, then awaits `refetch()`, and re-throws on error.
- Track `isSaving` with a local `useState` inside the wrapper (separate from `useAsyncMutation`).
- This is the safest approach: it eliminates query boilerplate, preserves throw behavior, preserves await-refetch timing, and requires no changes to `useAsyncMutation`.

**Option B — Use both `useAsyncQuery` + `useAsyncMutation`, but modify `useAsyncMutation` to rethrow:**
- Would require ARCH-014 to change `useAsyncMutation` to optionally rethrow errors.
- This contradicts the preference to not change `useAsyncMutation` in ARCH-014.
- Deferred to a future task if needed.

**Option C — Postpone useChiefComplaint refactor entirely:**
- Safe but leaves the remaining boilerplate unaddressed.

**Chosen: Option A.** It eliminates the query boilerplate (the larger half of the duplication), preserves the mutation's throw and timing semantics exactly, and does not require changes to `useAsyncMutation`.

### Risk 5: FindingsRisksTab draft-state sync
`FindingsRisksTab` uses a `useEffect` watching `complaint` and `isComplaintLoading` to initialize local form draft state. This is unaffected by internal hook refactoring as long as the `complaint` value and timing remain the same.

### Risk 6: "Сохранено" feedback
The `isSaved` state and its 3-second timeout are entirely local to `FindingsRisksTab`, not controlled by the hook. Unaffected.

## 9. Proposed useChiefComplaint Refactor Design (Option A)
```typescript
export function useChiefComplaint(patientId: string) {
  // Query: load complaint via useAsyncQuery
  const queryFn = useCallback(
    () => LocalStorageChiefComplaintRepository.getChiefComplaint(patientId),
    [patientId]
  );
  const {
    data: complaint,
    isLoading,
    isError: isQueryError,
    error: queryError,
    refetch,
  } = useAsyncQuery<ChiefComplaint | null>({
    queryFn,
    initialData: null,
    enabled: Boolean(patientId),
  });

  // Mutation: manual save wrapper (NOT using useAsyncMutation)
  // Rationale: useAsyncMutation<void> cannot distinguish success from error
  // by return value, and its onSuccess callback is fire-and-forget (does not
  // await refetch). Keeping a manual wrapper preserves throw-on-error and
  // sequential await-refetch timing exactly.
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<Error | null>(null);
  const [isSaveError, setIsSaveError] = useState<boolean>(false);

  const saveComplaint = useCallback(async (
    input: Omit<ChiefComplaint, 'id' | 'patientId' | 'createdAt' | 'updatedAt'>
  ) => {
    setIsSaving(true);
    setIsSaveError(false);
    setSaveError(null);
    try {
      await LocalStorageChiefComplaintRepository.saveChiefComplaint(patientId, input);
      await refetch();
    } catch (err) {
      const parsedError = err instanceof Error ? err : new Error(String(err));
      setIsSaveError(true);
      setSaveError(parsedError);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [patientId, refetch]);

  // Merge error state for public API compatibility
  const isError = isQueryError || isSaveError;
  const error = queryError || saveError;

  return {
    complaint,
    isLoading,
    isError,
    error,
    isSaving,
    refetch,
    saveComplaint,
  };
}
```

**Key design decisions:**
- Query boilerplate is fully eliminated by `useAsyncQuery`.
- Mutation is kept as a manual wrapper because `useAsyncMutation<void>` cannot use return value to detect errors, and its `onSuccess` callback does not await `refetch()`.
- `saveComplaint` directly awaits the repository save, then awaits `refetch()`, preserving the exact sequential timing of the current implementation.
- `saveComplaint` re-throws on error, preserving the current throw behavior.
- `isSaving` is tracked with a local `useState` (not from `useAsyncMutation`).
- `isError` and `error` are merged from query and save error states to preserve the single-error public API.
- `useAsyncMutation` is **not changed** and **not consumed** in this refactor. It remains available for future hooks where throw-on-error or sequential refetch are not required.

## 10. Public API Compatibility Requirements
The following public API must be preserved exactly:
| Field | Type | Source |
|---|---|---|
| `complaint` | `ChiefComplaint \| null` | `useAsyncQuery.data` |
| `isLoading` | `boolean` | `useAsyncQuery.isLoading` |
| `isError` | `boolean` | Merged query + mutation |
| `error` | `Error \| null` | Merged query + mutation |
| `isSaving` | `boolean` | Local `useState` in save wrapper |
| `refetch` | `() => Promise<void>` | `useAsyncQuery.refetch` |
| `saveComplaint` | `(input) => Promise<void>` | Manual async wrapper (not `useAsyncMutation`) |

## 11. Testing and Verification Plan for Future ARCH-014
1. `npm run lint` must pass (0 errors, 0 warnings).
2. `npm run build` must pass.
3. Verify `FindingsRisksTab` is NOT modified.
4. Verify `PatientHistoryTab`, `PatientCardPage`, `PatientOverviewTab` are NOT modified.
5. Verify `storage.ts` and `types/index.ts` are NOT modified.
6. Verify `ChiefComplaintRepository` is NOT modified (unless strictly needed).
7. Verify the public return shape of `useChiefComplaint` is unchanged by comparing destructured fields in `FindingsRisksTab` line 68.
8. Verify that complaint loading, saving, "Сохранение..." button state, and "Сохранено" feedback all work correctly.

## 12. What Must NOT Be Changed in ARCH-014
- `FindingsRisksTab.tsx`
- `PatientHistoryTab.tsx`
- `PatientCardPage.tsx`
- `PatientOverviewTab.tsx`
- `storage.ts`
- `types/index.ts`
- `ChiefComplaintRepository.ts` (prefer no change)
- `useAsyncQuery.ts` (prefer no change)
- `useAsyncMutation.ts` (prefer no change)
- `package.json`
- Routes

## 13. Acceptance Criteria for Future ARCH-014
- `useChiefComplaint` uses `useAsyncQuery` for the query/loading half.
- Query-related `useState`/`useEffect`/`mounted` boilerplate is removed from `useChiefComplaint`.
- `saveComplaint` must still reject/throw on save failure.
- `saveComplaint` must NOT rely on `undefined` result from a void mutation to detect errors.
- Successful save must still refresh complaint data (via `await refetch()`) before `saveComplaint` resolves.
- Public API is identical to the current version.
- `FindingsRisksTab` is not modified.
- `npm run lint` passes (0 errors, 0 warnings).
- `npm run build` passes.
- No `any` is used.
- No new dependencies are introduced.
- `useAsyncMutation` is not modified.

## 14. Recommended Next Task
**ARCH-014 — Refactor useChiefComplaint to use useAsyncQuery for loading, with manual save wrapper, without UI changes.**

### ARCH-014 Expected Scope
- Modify only `src/data/hooks/useChiefComplaint.ts`.
- Add `_ai_work/REPORTS/ARCH-014_chief_complaint_hook_refactor_report.md`.
- Adopt `useAsyncQuery` for the query half.
- Keep `saveComplaint` as a manual async wrapper that awaits save + refetch and re-throws on error.
- Do NOT use `useAsyncMutation` for this hook.
- Do NOT change `useAsyncMutation.ts`.
- Preserve public API exactly.
- Do NOT change `FindingsRisksTab` or any other component.
- Do NOT migrate DentalChart, Findings, TreatmentPlans, or Overview.
