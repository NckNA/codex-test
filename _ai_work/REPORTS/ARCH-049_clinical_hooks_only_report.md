# ARCH-049: Clinical Hooks Implementation Report

## 1. Files Inspected
- `_ai_work/REPORTS/ARCH-048_review_orchestrator_tests_and_clinical_hooks_boundary.md`
- `src/data/hooks/useAsyncQuery.ts`
- `src/data/repositories/DentalChartRepository.ts`
- `src/data/repositories/FindingsRepository.ts`
- `src/data/repositories/TreatmentPlansRepository.ts`
- `src/data/orchestrators/ClinicalWorkflowOrchestrator.ts`
- `src/types/index.ts`

## 2. Files Changed
- `src/data/hooks/useDentalChart.ts` (New)
- `src/data/hooks/usePatientFindings.ts` (New)
- `src/data/hooks/useTreatmentPlans.ts` (New)
- `src/data/hooks/useClinicalWorkflow.ts` (New)

## 3. `useDentalChart` Summary
This hook encapsulates pure domain CRUD logic for the Dental Chart. It uses `useAsyncQuery` to load a specific patient's chart via `LocalStorageDentalChartRepository`. It exposes a single manual mutation wrapper, `saveDentalChart`, which strictly delegates to the repository and safely synchronizes local React state by calling `refetch()` internally. It explicitly does **not** expose the `applyToothStatusChange` cross-domain logic.

## 4. `usePatientFindings` Summary
This hook encapsulates pure domain CRUD logic for Findings. It loads a specific patient's findings via `LocalStorageFindingsRepository`. It provides manual mutation wrappers (`createFinding`, `updateFinding`, `deleteFinding`) that automatically sync the local findings array via `refetch()`. It does not contain any UI workflow or selection logic.

## 5. `useTreatmentPlans` Summary
This hook encapsulates pure domain CRUD logic for Treatment Plans. It loads a patient's plans via `LocalStorageTreatmentPlansRepository`. Similar to the findings hook, it exposes `createTreatmentPlan`, `updateTreatmentPlan`, and `deleteTreatmentPlan` as manual mutation wrappers synced via `refetch()`.

## 6. `useClinicalWorkflow` Summary
This hook is the exclusive entry point for cross-domain orchestrator mutations (`applyToothStatusChange` and `createTreatmentPlanFromFindings`). 
- **Design Decision**: `useClinicalWorkflow` does **not** take a `patientId` argument. The input structures (`ApplyToothStatusChangeInput`, `CreateTreatmentPlanFromFindingsInput`) strictly require `patientId` at call-time. Omitting the parameter from the hook prevents stale closures and redundant closure scopes.
- It operates completely stateless regarding queried data (no `useAsyncQuery` call, no `data` property, no internal `refetch()`). 
- The caller is responsible for awaiting the orchestrator operation and then manually invoking `refetch()` on the adjacent domain hooks to synchronize read-state.

## 7. Mutation Wrapper Strategy
The implementation strictly follows the manual wrapper pattern for all mutation operations instead of blindly throwing `useAsyncMutation`. For every mutation:
1. `isSaving` is set to `true`.
2. `saveError` is reset to `null`.
3. The underlying repository/orchestrator is invoked.
4. (For domain hooks) `refetch()` is awaited.
5. Errors are gracefully parsed, stored into `saveError`, and actively thrown to propagate to the caller.
6. `isSaving` is finally restored to `false`.

## 8. Refetch/Refresh Strategy
Following the ARCH-048 design:
- Domain hooks (Chart, Findings, Plans) auto-refetch via their own mutation wrappers.
- The Workflow hook relies on **Page-Local Coordination**. The UI will be responsible for triggering refetches on adjacent hooks after a workflow mutation succeeds. No global event bus was added.

## 9. Domain Boundary Preservation
The hook files perfectly mirror the architectural boundaries:
- `useDentalChart` → `DentalChartRepository`
- `usePatientFindings` → `FindingsRepository`
- `useTreatmentPlans` → `TreatmentPlansRepository`
- `useClinicalWorkflow` → `ClinicalWorkflowOrchestrator`

There is no "god-hook" (`useClinicalData`), nor does the orchestrator hook import `storage.ts` or mix repository interfaces together.

## 10. What Was Intentionally Not Changed
- **UI Components:** The clinical tabs (`DentalChartTab`, `TreatmentPlansTab`, etc.) remain untouched and continue to directly utilize `storage.ts`.
- **Orchestrators & Repositories:** Left untouched.
- **`storage.ts` / `types/index.ts`:** Untouched.
- No global state managers (Redux, Zustand) or Event Buses were introduced.

## 11. Checks Performed
- **`useDentalChart.ts` created?** Yes.
- **`usePatientFindings.ts` created?** Yes.
- **`useTreatmentPlans.ts` created?** Yes.
- **`useClinicalWorkflow.ts` created?** Yes.
- **`useClinicalWorkflow` uses `patientId` argument?** No, because `patientId` is explicitly passed within the method inputs. This avoids redundant state/stale closures.
- **UI components changed?** No.
- **`ClinicalWorkflowOrchestrator.ts` changed?** No.
- **Repositories changed?** No.
- **Aggregators changed?** No.
- **Tests changed?** No.
- **`storage.ts` / `types/index.ts` changed?** No.
- **`package.json` / `package-lock` changed?** No.
- **Backend / routes / configs changed?** No.
- **`useAsyncMutation` used?** No. Manual wrappers were employed per existing conventions.
- **`any` used?** No.
- **One giant `useClinicalData` god-hook created?** No.
- **Global state / event bus introduced?** No.
- **`npm run test` passed?** Yes.
- **`npm run lint` passed?** Yes (0 errors, 0 warnings).
- **`npm run build` passed?** Yes (0 errors, 0 warnings).

## 12. Known Limitations
- The newly created hooks are completely dormant. The clinical UI is not yet using them.
- Because `useClinicalWorkflow` relies on Page-Local Coordination, integrating it later into the UI will require explicit prop drilling or sibling component communication to invoke `refetch()` effectively across tabs.
- No hook tests were added in this task.
- Eligibility filtering for Treatment Plans from Findings remains the strict responsibility of the UI layer.

## 13. Recommended Next Task
**ARCH-050 — Review clinical hooks implementation and design first safe UI integration slice.**
