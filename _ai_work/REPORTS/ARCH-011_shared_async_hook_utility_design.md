# ARCH-011: Shared Async Hook Utility Design

## 1. Scope
This report designs a minimal shared utility pattern to eliminate the boilerplate currently duplicated across our Data Access Layer (DAL) hooks (`useChiefComplaint`, `usePatientAppointments`, `useClinicDoctors`). It specifies a contract for two internal helper hooks (`useAsyncQuery` and `useAsyncMutation`) that standardize state management without introducing external dependencies.

## 2. Inputs Reviewed
- `_ai_work/REPORTS/ARCH-010_review_history_decoupling_and_hook_utility_direction.md`
- `src/data/hooks/useChiefComplaint.ts`
- `src/data/hooks/usePatientAppointments.ts`
- `src/data/hooks/useClinicDoctors.ts`
- `src/data/repositories/ChiefComplaintRepository.ts`
- `src/data/repositories/AppointmentRepository.ts`
- `src/data/repositories/DoctorRepository.ts`

## 3. Current Hook Duplication Summary
Across all three current hooks, the following boilerplate is repeated:
- `isLoading`, `isError`, and `error` state declarations.
- Initial mounting safety checks (`let mounted = true;`).
- `useEffect` initialization triggers with local `try/catch/finally` blocks.
- `useCallback` wrapper functions for manual refetching.
- Duplicated handling of `patientId` guards (skipping fetches if no ID exists).

## 4. Design Goals
- Eliminate the duplicated React state and `useEffect` boilerplate from domain hooks.
- Provide a robust interface for both read-only data fetching and future mutations.
- Ensure type-safety without `any`.
- Keep domain hooks responsible for domain logic (calling specific repositories, mapping data).
- Ensure existing public hook APIs are strictly preserved.

## 5. Non-Goals
- Do NOT introduce React Query, Redux, or any global state manager.
- Do NOT implement global caching or automatic cross-hook invalidation.
- Do NOT assume a real backend yet (designed for local repositories now).
- Do NOT leak unmounted safety concerns back to the domain hooks.

## 6. Options Comparison
- **Option A (Generic useAsyncResource<T>):** Hard to balance both queries and mutations in a single hook API without messy config objects.
- **Option B (Separate useAsyncQuery<T> and useAsyncMutation<T>):** Preferred. Matches industry standards, cleanly separating read and write lifecycles.
- **Option C (Small helper functions only):** Insufficient. Does not solve the React lifecycle (`useEffect`/`useState`) duplication.
- **Option D (Keep duplication):** Unsustainable for complex upcoming migrations (Dental Chart, Treatment Plans).
- **Option E (Add React Query):** Violates explicit project constraints.

## 7. Recommended Utility Design
We recommend **Option B**: creating two small, strictly typed internal utilities.
1. `useAsyncQuery<T>`: For initial fetching and refetching.
2. `useAsyncMutation<TInput, TResult>`: For saving, creating, updating, and deleting.

## 8. Proposed useAsyncQuery Contract
**Return shape:**
```typescript
{
  data: T;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}
```
**Configuration shape:**
```typescript
{
  queryFn: () => Promise<T>;
  initialData: T;
  enabled?: boolean; // Defaults to true. If false, skips initial fetch.
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}
```

## 9. Proposed useAsyncMutation Contract
**Return shape:**
```typescript
{
  isMutating: boolean; // Aliased to isSaving locally if needed
  isError: boolean;
  error: Error | null;
  mutate: (input: TInput) => Promise<TResult | undefined>;
  reset: () => void;
}
```
**Configuration shape:**
```typescript
{
  mutationFn: (input: TInput) => Promise<TResult>;
  onSuccess?: (result: TResult, input: TInput) => void;
  onError?: (error: Error, input: TInput) => void;
}
```

## 10. How Existing Hooks Would Use the Utilities Later
Instead of managing state manually, `useClinicDoctors` would look like:
```typescript
export function useClinicDoctors() {
  const { data, isLoading, isError, error, refetch } = useAsyncQuery<Doctor[]>({
    queryFn: () => LocalStorageDoctorRepository.listDoctors(),
    initialData: [],
  });
  return { doctors: data, isLoading, isError, error, refetch };
}
```

## 11. What Should Remain Domain-Specific
Domain hooks (like `usePatientAppointments`) must retain ownership of:
- Repository selection (`AppointmentRepository`).
- Argument handling (`patientId`).
- Renaming the generic `data` output to domain-specific terms (e.g., `appointments`).
- Calculating the `enabled` flag (e.g., `enabled: !!patientId`).

## 12. Migration Plan for Future ARCH-012
In `ARCH-012`, we should:
1. Create `src/data/hooks/useAsyncQuery.ts`.
2. Create `src/data/hooks/useAsyncMutation.ts`.
3. Refactor ONLY the read-only hooks first:
   - `useClinicDoctors.ts`
   - `usePatientAppointments.ts`
4. Leave `useChiefComplaint` alone until the read-only pattern is proven, as it contains both query and mutation logic.

## 13. Risks and Constraints
- The utilities will lack advanced caching. Subsequent navigations will still show loading states. This is expected for MVP local-storage mock architecture.
- If we do not properly implement the `enabled` flag, hooks might fetch data with `undefined` IDs, causing crashes.

## 14. What Must NOT Be Implemented Yet
- Do NOT write `useAsyncQuery.ts` or `useAsyncMutation.ts` in this task.
- Do NOT refactor existing hooks.
- Do NOT migrate `DentalChart`, `Findings`, `TreatmentPlans`, or `PatientOverview`.
- Do NOT install React Query.

## 15. Recommended Next Task
**ARCH-012 — Implement useAsyncQuery/useAsyncMutation utilities and refactor read-only hooks only.**
