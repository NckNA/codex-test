# ARCH-056: TreatmentPlansTab Hooks Integration Report

## 1. Files Inspected
- `_ai_work/REPORTS/ARCH-055_review_findings_migration_treatmentplans_boundary.md`
- `src/components/treatment/TreatmentPlansTab.tsx`
- `src/components/treatment/TreatmentPlanModal.tsx`
- `src/components/treatment/CreatePlanFromFindingsModal.tsx`
- `src/components/treatment/TreatmentPlanPatientPreview.tsx`
- `src/data/hooks/useTreatmentPlans.ts`
- `src/data/hooks/usePatientFindings.ts`
- `src/data/repositories/TreatmentPlansRepository.ts`
- `src/types/index.ts`

## 2. Files Changed
- `src/components/treatment/TreatmentPlansTab.tsx`
- `src/components/treatment/TreatmentPlanModal.tsx`
- `_ai_work/REPORTS/ARCH-056_treatmentplans_tab_hooks_integration_report.md` (this file)

## 3. Summary of TreatmentPlansTab Migration
`TreatmentPlansTab` was updated to consume `useTreatmentPlans` instead of interacting with `storage.ts` directly.
- The `loadPlans` method and `plans` state were removed entirely in favor of the `treatmentPlans` array directly provided by the hook.
- `handleSavePlan` was converted to an async method that calls `createTreatmentPlan` or `updateTreatmentPlan`.
- `handleDeletePlan` now calls `deleteTreatmentPlan` asynchronously.

## 4. TreatmentPlanModal Presentation-Only Refactor
`TreatmentPlanModal` was refactored to remove the direct use of `storage.getFindings`.
- It now receives `findings: DentalFinding[]` as a direct prop from its parent, `TreatmentPlansTab`, which fetches them using `usePatientFindings`.
- The `handleSubmit` was converted into an async callback ensuring that the parent controls the promise resolution.

## 5. Storage Removal Confirmation
- `TreatmentPlansTab` **NO LONGER** imports or calls `storage.ts`.
- `TreatmentPlanModal` **NO LONGER** imports or calls `storage.ts`.

## 6. Hooks Used
- `useTreatmentPlans` was utilized for plan CRUD.
- `usePatientFindings` was utilized strictly to provide read-only finding titles for presentation in `TreatmentPlanModal`.
- `useClinicalWorkflow` was deliberately **NOT** utilized.

## 7. Create/Update/Delete Workflow Behavior
Creating, updating, and deleting treatment plans from `TreatmentPlansTab` fully passes through `useTreatmentPlans`. The hook manages internal reloading and state changes upon resolution.

## 8. CreatePlanFromFindingsModal Legacy Handoff Behavior
`CreatePlanFromFindingsModal` was **intentionally kept unchanged**, leaving its complex legacy code operating directly against `storage.ts`.
To gracefully handle the legacy component within the migrated parent:
- When the legacy modal succeeds (`onPlanCreated`), `TreatmentPlansTab` executes an awaited call to `refetchTreatmentPlans()` on the hook.
- This hybrid boundary allows safe integration without destabilizing the broader application logic or embarking on complex cross-domain hook rewriting concurrently.

## 9. Modal Close/Error Behavior
- `TreatmentPlanModal` waits for `await onSave(planToSave)` to resolve before completing the execution.
- Only the parent `TreatmentPlansTab` resets local UI state (`setIsModalOpen(false)`) **after** the promise resolves.
- If a save error occurs, the error is caught and logged, leaving the modal safely open to prevent data loss.

## 10. What Was Intentionally Not Changed
- `CreatePlanFromFindingsModal.tsx`
- `TreatmentPlanPatientPreview.tsx`
- All Dental Chart and Finding Risks components (`DentalChartTab.tsx`, `FindingsRisksTab.tsx`, `FindingModal.tsx`).
- `PatientCardPage.tsx`
- Hooks, repositories, orchestrators, tests, storage logic, and configurations.

## 11. Checks Performed
- **`TreatmentPlansTab.tsx` changed?** Yes.
- **`TreatmentPlanModal.tsx` changed?** Yes.
- **Storage import removed from `TreatmentPlansTab`?** Yes.
- **Storage import removed from `TreatmentPlanModal`?** Yes.
- **`TreatmentPlansTab` calls storage directly?** No.
- **`TreatmentPlanModal` calls storage directly?** No.
- **`useTreatmentPlans` used?** Yes.
- **`usePatientFindings` used?** Yes (for read-only finding labels).
- **`useClinicalWorkflow` used?** No.
- **`CreatePlanFromFindingsModal` changed?** No.
- **`CreatePlanFromFindingsModal` remains legacy storage-bound?** Yes.
- **`TreatmentPlanPatientPreview` changed?** No.
- **`DentalChartTab` / `FindingsRisksTab` / `FindingModal` changed?** No.
- **`PatientCardPage` changed?** No.
- **Hooks, repos, configs, types, backend changed?** No.
- **`useAsyncMutation` used?** No.
- **`any` typing used?** No.
- **Global state / event bus introduced?** No.
- **`TreatmentPlanModal` closes itself after save?** No.
- **Parent closes `TreatmentPlanModal` only after successful save?** Yes.
- **Treatment-from-findings workflow migrated?** No.

## 12. Manual Smoke Result
**Manual browser smoke was not performed.** Reliance was placed entirely on TypeScript types, Vitest contract verifications, and architectural review constraints.

## 13. Known Limitations
- `CreatePlanFromFindingsModal` and `TreatmentPlanPatientPreview` remain tightly coupled to `storage.ts` directly.
- The `RESEARCH-003` robust dental model v2 was not touched here.
- `PatientCardPage` dashboard refresh remains heavily reliant on the old page re-entry behavior.
- Errors on save are emitted to the console without a user-facing toast overlay mechanism.

## 14. Recommended Next Task
**ARCH-057 — Review TreatmentPlansTab migration and design CreatePlanFromFindingsModal workflow migration.**
