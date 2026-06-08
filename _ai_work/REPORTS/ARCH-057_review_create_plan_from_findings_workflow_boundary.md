# ARCH-057: Review CreatePlanFromFindingsModal Workflow Migration Boundary

## 1. Title
ARCH-057 — Review TreatmentPlansTab migration and design CreatePlanFromFindingsModal workflow migration

## 2. Scope
This report verifies the successful integration of hooks in `TreatmentPlansTab` (ARCH-056) and evaluates the next architectural boundary for migrating the high-risk, cross-domain `CreatePlanFromFindingsModal` workflow.

## 3. Inputs Reviewed
- `_ai_work/REPORTS/ARCH-056_treatmentplans_tab_hooks_integration_report.md`
- `_ai_work/REPORTS/ARCH-055_review_findings_migration_treatmentplans_boundary.md`
- `_ai_work/REPORTS/ARCH-048_review_orchestrator_tests_and_clinical_hooks_boundary.md`
- `_ai_work/REPORTS/ARCH-047_clinical_workflow_orchestrator_report.md`
- `_ai_work/REPORTS/TEST-002_clinical_workflow_orchestrator_tests_report.md`
- Migrated UI files: `TreatmentPlansTab.tsx`, `TreatmentPlanModal.tsx`
- Legacy UI files: `CreatePlanFromFindingsModal.tsx`, `TreatmentPlanPatientPreview.tsx`
- Hooks/Orchestrators: `useTreatmentPlans.ts`, `usePatientFindings.ts`, `useClinicalWorkflow.ts`, `ClinicalWorkflowOrchestrator.ts`

## 4. ARCH-056 Verification
- **Verified:** `TreatmentPlansTab` correctly uses `useTreatmentPlans` for CRUD operations.
- **Verified:** `TreatmentPlansTab` correctly uses `usePatientFindings` strictly to pass read-only findings to `TreatmentPlanModal`.
- **Verified:** Direct `storage.ts` imports were completely removed from both `TreatmentPlansTab` and `TreatmentPlanModal`.
- **Verified:** `TreatmentPlanModal` correctly receives `findings` via props and functions strictly as a presentation layer for persistence.
- **Verified:** `CreatePlanFromFindingsModal` was intentionally kept unmodified, preserving its legacy `storage.ts` operations.
- **Verified:** `TreatmentPlanPatientPreview` was intentionally kept unmodified.
- **Verified:** `useClinicalWorkflow` was not used.
- **Verified:** No global state, event bus, `useAsyncMutation`, or `any` typings were introduced.
- **Verified:** Manual browser smoke was explicitly documented as *not performed* during ARCH-056.

## 5. Current CreatePlanFromFindingsModal Behavior Map
Presently, the modal handles a highly complex cross-domain workflow directly interacting with storage:
- **Reads:** Fetches all findings (`storage.getFindings`) and plans (`storage.getTreatmentPlans`).
- **Linked Detection:** Builds `linkedPlanByFindingId` by traversing active treatment plans.
- **Eligibility Filtering:** Trims findings to those `includeInTreatmentPlan` and of specific statuses (e.g. not completed/declined).
- **State Ownership:** Controls the UI state of checked findings (`selectedIds`).
- **Mutation:** Builds a list of `TreatmentStage` elements, creates a `TreatmentPlan`, and then synchronously writes the plan (`storage.addTreatmentPlan`) and updates every checked finding (`storage.updateFinding`) to `included_in_plan`.
- **Handoff:** Calls `onPlanCreated(plan)` to notify the parent.

## 6. Existing Orchestrator and Hook Capability Review
The `ClinicalWorkflowOrchestrator.createTreatmentPlanFromFindings` method currently:
- Accepts `patientId` and an array of `selectedFindings`.
- Synchronously orchestrates the exact same business logic for generating stages, creating the plan, and updating finding statuses.
- Persists changes sequentially using `TreatmentPlansRepository` and `FindingsRepository`.
- **Note:** It does not own UI filtering, linked plan detection, local selected states, or modal close mechanics. It also lacks a true transactional rollback (an accepted limitation for MVP).

## 7. Migration Option Analysis

### Option A — Parent-Owned Workflow (Recommended)
- `TreatmentPlansTab` (the parent) handles orchestrator execution via `useClinicalWorkflow`, coordinates post-execution refetches (`refetchTreatmentPlans` and `refetchFindings`), and closes the modal only on success.
- `CreatePlanFromFindingsModal` becomes a data-consuming UI element receiving findings and plans via props, maintaining UI-only selection logic and executing `onCreatePlanFromFindings(selectedFindings)`.
- *Risk: Medium.* Provides strict separation of presentation and orchestration.

### Option B — Modal Uses Hooks Directly
- The modal itself implements `usePatientFindings`, `useTreatmentPlans`, and `useClinicalWorkflow`.
- *Risk: Medium/High.* Violates presentation layer separation and creates dual-ownership of data reloading responsibilities between parent and modal.

### Option C — Move All Filtering to Orchestrator
- Push eligibility and linked-plan detection inside the orchestrator.
- *Risk: High.* Expanding orchestrator scope violates current contract boundaries and introduces UI-specific view logic into the DAL.

### Option D — Migrate TreatmentPlanPatientPreview Together
- Migrate read-only preview alongside the complex workflow.
- *Risk: High.* Scope creep. Should be rejected.

### Option E — Global Event Bus / Global Cache Refresh
- *Risk: High.* Violates the established page-local coordination pattern. Rejected.

## 8. Recommended Next Implementation Boundary
**ARCH-058 — Integrate CreatePlanFromFindingsModal with useClinicalWorkflow via parent-owned workflow, no preview migration.**

This approach (Option A) cleanly migrates the highest risk legacy code without expanding orchestrator responsibilities or breaking the established page-local coordination architecture.

## 9. Proposed ARCH-058 Allowed/Disallowed Files

**Allowed Files:**
- `src/components/treatment/TreatmentPlansTab.tsx`
- `src/components/treatment/CreatePlanFromFindingsModal.tsx`
- `_ai_work/REPORTS/ARCH-058_create_plan_from_findings_workflow_integration_report.md`

**Forbidden Files:**
- `src/components/treatment/TreatmentPlanModal.tsx`
- `src/components/treatment/TreatmentPlanPatientPreview.tsx`
- `src/components/dental/DentalChartTab.tsx`
- `src/components/dental/FindingsRisksTab.tsx`
- `src/components/dental/FindingModal.tsx`
- `src/pages/PatientCardPage.tsx`
- Hooks, repositories, orchestrators, aggregators, `storage.ts`, types, tests, package.json, and backend configs.

## 10. Eligibility/Filtering Decision
- **Decision:** UI retains eligibility and active-plan linked filtering logic.
- **Reasoning:** Orchestrator must remain purely executional. Future backend implementations should handle server-side validation, but in this frontend migration, modifying the orchestrator is strictly prohibited unless unavoidable.

## 11. Refetch and Modal Close Strategy
- `TreatmentPlansTab` implements an async handler for the modal's `onCreatePlanFromFindings` callback.
- The handler awaits `createTreatmentPlanFromFindings`, then explicitly awaits `refetchTreatmentPlans()` and `refetchFindings()`.
- The modal is closed (`setIsFindingsModalOpen(false)`) **only** if the entire orchestration block succeeds.
- On error, the parent catches the exception, logs it to the console, and leaves the modal open.

## 12. TreatmentPlanPatientPreview Deferral
- **Decision:** Do NOT migrate `TreatmentPlanPatientPreview` in ARCH-058.
- **Reasoning:** It is a low-risk, read-only legacy component. Attempting to mix it with high-risk workflow orchestration is an unnecessary risk.

## 13. RESEARCH-003 Interaction Note
- **Decision:** The `RESEARCH-003` (domain model v2) architecture must strictly **NOT** be implemented or intertwined with this frontend persistence migration.
- **Reasoning:** This track focuses exclusively on separating the presentation layer from the direct storage layer using existing MVP entities.

## 14. Risk Ranking
1. `CreatePlanFromFindingsModal` (High - cross-domain orchestration)
2. `TreatmentPlanPatientPreview` (Low - read-only)

## 15. What Must NOT Be Changed Next
- Do NOT alter any orchestrators, hooks, repositories, or tests.
- Do NOT touch `TreatmentPlanPatientPreview.tsx`.
- Do NOT introduce global state/cache tools.
- Do NOT touch `PatientCardPage.tsx`.

## 16. Acceptance Criteria for ARCH-058
- `TreatmentPlansTab` coordinates orchestration and refetches.
- `CreatePlanFromFindingsModal` operates fully decoupled from `storage.ts`.
- Types, lint rules, and Vitest contract suites execute flawlessly.
- Zero changes to DAL logic.

## 17. Recommended Next Task
**ARCH-058 — Integrate CreatePlanFromFindingsModal with useClinicalWorkflow via parent-owned workflow, no preview migration.**
