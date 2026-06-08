# ARCH-047: Clinical Workflow Orchestrator Implementation Report

## 1. Files Inspected
- `_ai_work/REPORTS/ARCH-043_clinical_dal_boundary_map.md`
- `_ai_work/REPORTS/ARCH-046_review_test_coverage_orchestrator_boundary.md`
- `_ai_work/REPORTS/TEST-001_clinical_repositories_aggregators_tests_report.md`
- `src/data/repositories/DentalChartRepository.ts`
- `src/data/repositories/FindingsRepository.ts`
- `src/data/repositories/TreatmentPlansRepository.ts`
- `src/components/dental/DentalChartTab.tsx`
- `src/components/treatment/CreatePlanFromFindingsModal.tsx`
- `src/types/index.ts`

## 2. Files Changed
- `src/data/orchestrators/ClinicalWorkflowOrchestrator.ts` (New file)

## 3. Orchestrator Summary
A new `ClinicalWorkflowOrchestrator` was created to encapsulate the cross-domain clinical mutations. It acts as a strict composition layer over `DentalChartRepository`, `FindingsRepository`, and `TreatmentPlansRepository`. It does not import `storage.ts` directly, nor does it become a "god-object" repository—it only coordinates existing repositories for specific business workflows.

## 4. applyToothStatusChange Behavior
This method orchestrates a tooth condition change from the Dental Chart UI:
1. Replaces the target tooth in the `DentalChart` copy and saves it via `DentalChartRepository`.
2. Checks if a `findingPayload` (title, category, severity) is provided.
3. If provided, queries `FindingsRepository` for an existing active finding on that tooth matching the category.
4. If found, updates the existing finding's metadata.
5. If not found, creates a new finding via `FindingsRepository`.

## 5. createTreatmentPlanFromFindings Behavior
This method orchestrates the creation of a treatment plan from selected findings:
1. Returns `null` immediately if the selected findings array is empty.
2. Builds `TreatmentStage` elements dynamically from each finding, mapping descriptions and recommendations.
3. Constructs a new `TreatmentPlan` and saves it via `TreatmentPlansRepository`.
4. Iterates through the selected findings and updates their status to `included_in_plan` and `includeInTreatmentPlan` to `true` via `FindingsRepository`.

## 6. Dependency Composition Strategy
The orchestrator relies on dependency injection via `ClinicalWorkflowOrchestratorDependencies`. This cleanly decouples the business logic from `localStorage`. A default instance `LocalStorageClinicalWorkflowOrchestrator` is exported, pre-configured with the LocalStorage implementations of the three clinical repositories.

## 7. Domain Boundary Preservation
- **No storage.ts**: The orchestrator does not know about internal `localStorage` keys or `storage.ts` functions.
- **No God-Object**: It exposes only two highly specific workflow methods, resisting the anti-pattern of exposing raw `save` or `get` methods.
- **Pure DAL**: It contains zero UI state logic, modal closing callbacks, or React Hook behaviors.

## 8. What Was Intentionally Not Changed
- No UI components or tabs were modified. The UI remains temporarily wired directly to `storage.ts`.
- No React hooks were created.
- Existing repositories, aggregators, `storage.ts`, and `types/index.ts` were untouched.
- No test files were modified.
- `package.json` and backend configs were untouched.

## 9. Checks Performed
- **`src/data/orchestrators/ClinicalWorkflowOrchestrator.ts` created?** Yes.
- **`src/data/orchestrators/` created?** Yes.
- **Imports `storage.ts` directly?** No.
- **Composes existing repositories?** Yes.
- **`applyToothStatusChange` implemented?** Yes.
- **`createTreatmentPlanFromFindings` implemented?** Yes.
- **Hooks created?** No.
- **UI components changed?** No.
- **Tests changed?** No.
- **Repositories changed?** No.
- **Aggregators changed?** No.
- **storage.ts/types/index.ts changed?** No.
- **useAsyncMutation used?** No.
- **`any` used?** No.
- **ClinicalRepository god-object created?** No.
- **`npm run test` passed?** Yes.
- **`npm run lint` passed?** Yes (0 errors, 0 warnings).
- **`npm run build` passed?** Yes (0 errors, 0 warnings).

## 10. Known Limitations
- The Orchestrator is purely foundational right now; it is not yet integrated into the UI.
- No orchestrator-specific tests were added in this task.
- Cross-domain operations are not transactional. If a treatment plan is created but a finding update throws an error mid-loop, there is no automatic rollback. (This is a known limitation of the underlying LocalStorage architecture).
- Clinical summary refresh/invalidation patterns are not yet handled.

## 11. Recommended Next Task
**TEST-002 — Add contract tests for ClinicalWorkflowOrchestrator before hooks/UI integration.**
