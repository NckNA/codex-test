# ARCH-058: CreatePlanFromFindingsModal Workflow Integration Report

## 1. Files Inspected
- `_ai_work/REPORTS/ARCH-057_review_create_plan_from_findings_workflow_boundary.md`
- `_ai_work/REPORTS/ARCH-056_treatmentplans_tab_hooks_integration_report.md`
- `src/components/treatment/TreatmentPlansTab.tsx`
- `src/components/treatment/CreatePlanFromFindingsModal.tsx`
- `src/components/treatment/TreatmentPlanPatientPreview.tsx`
- `src/data/hooks/useTreatmentPlans.ts`
- `src/data/hooks/usePatientFindings.ts`
- `src/data/hooks/useClinicalWorkflow.ts`
- `src/data/orchestrators/ClinicalWorkflowOrchestrator.ts`
- `src/types/index.ts`

## 2. Files Changed
- `src/components/treatment/TreatmentPlansTab.tsx`
- `src/components/treatment/CreatePlanFromFindingsModal.tsx`
- `_ai_work/REPORTS/ARCH-058_create_plan_from_findings_workflow_integration_report.md` (this file)

## 3. Summary of Parent-Owned Workflow Integration
The cross-domain mutation workflow was successfully moved from `CreatePlanFromFindingsModal` into `TreatmentPlansTab`.
- `TreatmentPlansTab` now imports and utilizes `useClinicalWorkflow`.
- A new asynchronous handler `handleCreatePlanFromFindings` orchestrates the execution of `createTreatmentPlanFromFindings`.
- `TreatmentPlansTab` coordinates resolving the workflow before safely unmounting the modal.

## 4. CreatePlanFromFindingsModal Storage Removal Summary
`CreatePlanFromFindingsModal` was successfully stripped of its direct reliance on `storage.ts`.
- The component now strictly consumes data (`findings` and `treatmentPlans`) passed down via props.
- It no longer performs its own updates to findings or saves new plans to storage.
- It delegates the save operation entirely by calling the `onCreatePlanFromFindings(selectedFindings)` async prop.

## 5. Hooks Used
- `useTreatmentPlans`: Used for basic CRUD of plans in `TreatmentPlansTab`.
- `usePatientFindings`: Used to supply `findings` down to both modals. Destructured to provide `refetchFindings`.
- `useClinicalWorkflow`: Used for the cross-domain `createTreatmentPlanFromFindings` orchestration logic.

## 6. Orchestrator Usage
`ClinicalWorkflowOrchestrator` handles the complex domain logic under the hood via `useClinicalWorkflow`.
- The orchestrator was left completely unchanged, respecting the current DAL boundaries and previous test contracts.
- It natively handles constructing `TreatmentStage` entries, saving the plan, and updating findings in sequence.

## 7. Refetch Strategy
To ensure synchronization across both local tabs and components:
- Upon successful execution of `createTreatmentPlanFromFindings`, the parent explicitly awaits `refetchTreatmentPlans()` and `refetchFindings()`.
- Only after both hooks have successfully reloaded their states does the system proceed to close the modal.

## 8. Modal Close/Error Behavior
- The modal remains open until the Promise returned by `onCreatePlanFromFindings` successfully resolves.
- If the orchestrator encounters an error during execution, the exception is caught and logged. The UI remains cleanly mounted, preserving the user's selected items and preventing data loss.

## 9. Eligibility/Filtering Decision
- Eligibility filtering (status checks, `includeInTreatmentPlan`, and `linkedPlanByFindingId` logic) intentionally remains inside `CreatePlanFromFindingsModal`.
- This ensures the UI remains responsible for view-level logic while preserving the orchestrator strictly for DAL transaction execution.

## 10. What Was Intentionally Not Changed
- `ClinicalWorkflowOrchestrator` and all other hooks/repositories were left unmodified.
- `TreatmentPlanPatientPreview` was left in its legacy state.
- `PatientCardPage` summary refresh behavior.
- All non-Treatment tabs (DentalChart, FindingsRisks).
- RESEARCH-003 Domain Model V2 remains documentation-only.

## 11. Checks Performed
- **`TreatmentPlansTab.tsx` changed?** Yes.
- **`CreatePlanFromFindingsModal.tsx` changed?** Yes.
- **Storage import removed from `CreatePlanFromFindingsModal`?** Yes.
- **`CreatePlanFromFindingsModal` calls storage directly?** No.
- **`TreatmentPlansTab` uses `useClinicalWorkflow`?** Yes.
- **`createTreatmentPlanFromFindings` called from parent?** Yes.
- **`TreatmentPlansTab` refetches `treatmentPlans` after workflow success?** Yes.
- **`TreatmentPlansTab` refetches `findings` after workflow success?** Yes.
- **Modal closes only after successful workflow?** Yes.
- **Modal remains open on workflow error?** Yes.
- **Eligibility filtering stayed in UI/modal?** Yes.
- **Orchestrator was changed?** No.
- **Hooks/repositories/storage/types/tests/backend/configs changed?** No.
- **`TreatmentPlanModal` was changed?** No.
- **`TreatmentPlanPatientPreview` was changed?** No.
- **`PatientCardPage` was changed?** No.
- **`useAsyncMutation` was used?** No.
- **`any` typing used?** No.
- **Global state / event bus introduced?** No.
- **RESEARCH-003 / domain model v2 implemented?** No.

## 12. Manual Smoke Checklist Result
**Manual browser smoke was not performed.**
Architectural guarantees were verified entirely via TypeScript typing, hook interface compliance, and automated static checks.

## 13. Known Limitations
- `TreatmentPlanPatientPreview` remains legacy read-only storage-bound.
- No global cross-tab refresh system exists.
- `PatientCardPage` summary refresh still relies on the existing tab re-entry behavior.
- No new hook/UI tests were added in this step.
- Errors are logged to the console only, without an overlay toast system.
- `LocalStorage` workflow still lacks a true transaction rollback.
- RESEARCH-003 domain model v2 remains purely documentation.

## 14. Recommended Next Task
**ARCH-059 — Review CreatePlanFromFindingsModal migration and decide TreatmentPlanPatientPreview read-only cleanup.**
