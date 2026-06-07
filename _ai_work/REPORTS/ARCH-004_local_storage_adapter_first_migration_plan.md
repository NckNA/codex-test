# ARCH-004: LocalStorageAdapter Implementation Plan (First Slice)

## Scope
This report provides a concrete implementation plan for the very first migration slice: the **Chief Complaint** flow. It details how to introduce the async-ready Data Access Layer (DAL) and the first patient-scoped hook (`useChiefComplaint`) into `FindingsRisksTab.tsx` without disrupting the rest of the application or modifying global storage logic.

## Inputs Reviewed
- `ARCH-001` (Audit of synchronous storage access).
- `ARCH-002` (Definition of repository interfaces).
- `ARCH-003` (Definition of patient-scoped hooks).
- `src/components/dental/FindingsRisksTab.tsx` (Current UI implementation).
- `src/utils/storage.ts` (Current data access layer).
- `src/types/index.ts` (Current data models).

## Why ChiefComplaint is the first safe slice
The Chief Complaint flow is the ideal first slice because:
1. It is tightly isolated to a single component section (`FindingsRisksTab.tsx`).
2. It interacts with a small, flat data entity (`ChiefComplaint`).
3. It has minimal cascading dependencies compared to `DentalChart` or `TreatmentPlan`.
4. Successfully migrating it validates the Repository and Hook pattern locally before scaling it to more complex entities.

## Current ChiefComplaint Flow
Currently in `FindingsRisksTab.tsx`:
- Data loads synchronously on mount using `storage.getChiefComplaint(patientId)`.
- The user edits the complaint text in a local React state (`useState`).
- Upon clicking "Сохранить", it synchronously calls `storage.saveChiefComplaint(patientId, ...)`.
- Save feedback ("Сохранено") is handled via a temporary local state (`isSaved`).

## Proposed Files for First Implementation
The following new files will be created in the future `ARCH-005` task:
- `src/data/repositories/ChiefComplaintRepository.ts` (Interface and LocalStorage Adapter implementation).
- `src/data/hooks/useChiefComplaint.ts` (The async hook).

*Note: Existing types in `src/types/index.ts` will NOT be changed.*

## Proposed Interface / Adapter Structure
```typescript
// Interface
export interface IChiefComplaintRepository {
  getChiefComplaint(patientId: string): Promise<ChiefComplaint | null>;
  saveChiefComplaint(patientId: string, complaint: Partial<ChiefComplaint>): Promise<void>;
}

// LocalStorage Adapter
export const LocalStorageChiefComplaintRepository: IChiefComplaintRepository = {
  getChiefComplaint: async (patientId) => {
    // Awaits Promise.resolve to simulate network delay/async
    return Promise.resolve(storage.getChiefComplaint(patientId));
  },
  saveChiefComplaint: async (patientId, complaint) => {
    storage.saveChiefComplaint(patientId, complaint as any);
    return Promise.resolve();
  }
};
```

## Proposed Hook Contract for useChiefComplaint
```typescript
export function useChiefComplaint(patientId: string) {
  // Uses LocalStorageChiefComplaintRepository internally
  // Manages data, isLoading, error, isSaving state.
  // Returns:
  // - complaint: ChiefComplaint | null
  // - isLoading: boolean
  // - isSaving: boolean
  // - saveComplaint: (text: string, teeth: number[]) => Promise<void>
  // - refetch: () => Promise<void>
}
```
**Important Design Decision:** 
The hook will **NOT** own the draft state (the keystrokes while typing). The draft state (`complaintText`, `complaintTeeth`) must remain as local `useState` within `FindingsRisksTab.tsx`. The hook will only expose the persisted `complaint` and the `saveComplaint` mutation. This mimics how forms work over real APIs (where you don't sync every keystroke to the server) and is the safest MVP migration path.

## Proposed Component Migration Steps
In `FindingsRisksTab.tsx`:
1. Replace synchronous `storage.getChiefComplaint` calls with `const { complaint, isLoading, isSaving, saveComplaint } = useChiefComplaint(patientId);`.
2. Add a fallback loading skeleton or spinner for the complaint block if `isLoading` is true.
3. Update `useEffect` logic: when `complaint` data arrives from the hook, initialize the local draft `useState`.
4. Update the save button `onClick` handler to await `saveComplaint(...)` instead of calling `storage` directly.

## Testing and Verification Plan
To verify that no behavior changed during `ARCH-005`:
1. Open a patient card.
2. Open the "Проблемы и риски" tab.
3. Verify the existing complaint loads correctly.
4. Edit the complaint text and related teeth.
5. Save the complaint. Verify it persists to `localStorage` (check DevTools).
6. Verify the inline "Сохранено" feedback still appears correctly.
7. Switch to another tab and back, or reload the page, to ensure the saved complaint is reloaded from `localStorage`.
8. Ensure `npm run lint` returns 0 errors and 0 warnings.
9. Ensure `npm run build` passes successfully.
10. Ensure the lower half of the page (Findings list) works exactly as before.

## Risks and Rollback Plan
- **Risk:** Asynchronous `useEffect` timing might cause the local draft state to overwrite the remote state incorrectly on re-renders. 
  - **Mitigation:** Only sync the hook's `complaint` to local draft state when it strictly changes (e.g., using a reliable dependency array or comparing timestamps).
- **Rollback:** If issues arise, the `useChiefComplaint` hook can be safely reverted inside `FindingsRisksTab.tsx` back to direct synchronous `storage` calls, as `storage.ts` is intentionally left unmodified.

## What must NOT be included in the first implementation
- Do NOT change `storage.ts`.
- Do NOT change data models or types in `src/types/index.ts`.
- Do NOT fully migrate `FindingsRisksTab.tsx`. Only the top section (Chief Complaint) will be migrated.
- Do NOT migrate the Findings/Risks list yet.
- Do NOT migrate `DentalChartTab` yet.
- Do NOT introduce React Query or a global state manager.
- Do NOT introduce a real backend.

## Acceptance Criteria for Future ARCH-005
- `useChiefComplaint` hook and repository are created.
- `FindingsRisksTab.tsx`'s chief complaint section is migrated to use the hook.
- No other components or functionalities are broken.
- Linter and build pass cleanly.

## Recommended Next Task
**ARCH-005 — Implement ChiefComplaint LocalStorageAdapter and useChiefComplaint first slice.**
