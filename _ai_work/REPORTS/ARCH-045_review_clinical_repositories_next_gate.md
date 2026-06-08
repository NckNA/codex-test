# ARCH-045: Review Clinical Repositories & Next Gate

## 1. Title
ARCH-045 — Review clinical repositories and define safe test/workflow/hooks gate

## 2. Scope
This report verifies the clinical repositories implemented in ARCH-044, analyzes their testability along with existing aggregators, reviews the readiness of the `ClinicalWorkflowOrchestrator` and clinical hooks, and decides the safest next architectural step. 

## 3. Inputs Reviewed
- `_ai_work/REPORTS/ARCH-043_clinical_dal_boundary_map.md`
- `_ai_work/REPORTS/ARCH-044_clinical_repositories_only_report.md`
- `src/data/repositories/DentalChartRepository.ts`
- `src/data/repositories/FindingsRepository.ts`
- `src/data/repositories/TreatmentPlansRepository.ts`
- `src/data/aggregators/ClinicalSummaryAggregator.ts`
- `src/data/aggregators/PatientListVisitSummaryAggregator.ts`
- `package.json`

## 4. ARCH-044 Repository Review
The implementation of the clinical repositories in ARCH-044 is clean and adheres exactly to the ARCH-043 specifications.
- `DentalChartRepository.ts`
- `FindingsRepository.ts`
- `TreatmentPlansRepository.ts`
These files are purely data-access abstractions over `storage.ts`.

## 5. Repository Boundary Verification
- **Confirmed**: `DentalChartRepository` owns only dental chart data.
- **Confirmed**: `FindingsRepository` owns only findings/risks data.
- **Confirmed**: `TreatmentPlansRepository` owns only treatment plan data.
- **Confirmed**: No repository performs cross-domain mutations.
- **Confirmed**: No `ClinicalRepository` god-object exists.
- **Confirmed**: No orchestrator exists yet.
- **Confirmed**: No hooks were created.
- **Confirmed**: UI components were not changed.
- **Confirmed**: `storage.ts` and `types/index.ts` were not changed.

## 6. Repository Contract Test Candidates
To ensure these repositories function perfectly before any UI integration, they must be tested.

**DentalChartRepository:**
- `getDentalChart` returns an existing chart.
- `getDentalChart` preserves the current fallback/default-chart creation behavior when data is missing.
- `saveDentalChart` successfully persists updates.
- Verify it does not create or update findings.

**FindingsRepository:**
- `listFindingsByPatient` returns only the specific patient's findings.
- `createFinding` properly assigns the ID and saves.
- `updateFinding` strictly updates the matching patient/finding and fields.
- `deleteFinding` successfully removes only the matching finding.
- Verify it does not touch dental charts or treatment plans.

**TreatmentPlansRepository:**
- `listTreatmentPlansByPatient` returns only patient plans.
- `createTreatmentPlan` persists the plan correctly.
- `updateTreatmentPlan` updates existing plan fields.
- `deleteTreatmentPlan` removes the specific plan.
- Verify it does not mutate findings or dental chart.

## 7. Aggregator Test Candidates
Aggregators are the critical read-path for the UI. They must be bulletproof before underlying write-paths change.

**ClinicalSummaryAggregator:**
- Summary accurately reflects dental findings counts.
- Summary accurately reflects treatment plan totals and active plans.
- Summary handles missing or empty data gracefully (e.g., new patients).
- Verify it does absolutely no storage mutation (read-only purity).

**PatientListVisitSummaryAggregator:**
- Correctly calculates `lastVisit` and `nextVisit`.
- Ignores cancelled or blocked appointments based on current business rules.
- Gracefully handles patients without any appointments.
- Verify it does no storage mutation.

## 8. Clinical Workflow/Orchestrator Readiness Review
The `ClinicalWorkflowOrchestrator` is structurally designed (ARCH-043) but **not yet ready to be implemented**.
- **applyToothStatusChange flow**: Requires coordinating `DentalChartRepository` and `FindingsRepository`.
- **createTreatmentPlanFromFindings flow**: Requires coordinating `TreatmentPlansRepository` and `FindingsRepository`.
- **Summary refresh**: Requires triggering after mutations.

**Is ClinicalWorkflowOrchestrator needed eventually?** Yes.
**Should it be implemented immediately after repositories?** No. It is dangerous to implement complex cross-domain workflows before the foundational blocks (repositories and aggregators) have guaranteed, tested behavior.

## 9. Hooks Readiness Review
React hooks (`useDentalChart`, `usePatientFindings`, `useTreatmentPlans`) rely directly on the repositories and the orchestrator.
**Should clinical hooks be implemented before tests?** No. Hooks introduce React state cycles. The underlying TS classes must be verified first.

## 10. UI Integration Risk Review
**Should clinical UI be integrated before tests?** Absolutely not. The UI components currently perform direct, synchronous `storage.ts` operations with deep cross-domain logic. Integrating them before verifying the new DAL with automated tests is a massive regression risk.

## 11. Test Infrastructure Status
- `package.json` contains no existing testing framework (like Vitest or Jest).
- There are no existing `*.test.ts` files in the repository.
- A testing library (e.g., Vitest) must be installed and configured as part of the first testing task.

## 12. Next-Step Options
- **Option A**: Implement `ClinicalWorkflowOrchestrator` now. *(Rejected: Building complex logic on untested foundations).*
- **Option B**: Implement React hooks now. *(Rejected: UI logic should wait for stable foundation).*
- **Option C**: Add contract/unit tests for repositories and aggregators. *(Recommended: Ensures boundaries behave exactly as expected before replacing production UI logic).*

## 13. Options Comparison
Attempting to build the orchestrator now risks baking hidden `storage.ts` behaviors into new business logic. Testing the raw repositories and aggregators first explicitly defines and locks in the expected `storage.ts` behaviors, creating a safety net for all future steps (orchestrator, hooks, and UI).

## 14. Recommended Next Gate
**TEST-001 — Add unit/contract tests for clinical repositories and existing aggregators before orchestrator/hooks.**

*Note: Tests belong outside the ARCH track as they are verification, not structural architecture migration.*

## 15. What Must NOT Be Changed Next
- Do **NOT** implement `ClinicalWorkflowOrchestrator`.
- Do **NOT** implement React hooks.
- Do **NOT** integrate UI components.
- Do **NOT** start new product features.

## 16. Acceptance Criteria for TEST-001
- Install a modern, lightweight testing framework (e.g., Vitest) without breaking Vite/React.
- Create tests for `DentalChartRepository`.
- Create tests for `FindingsRepository`.
- Create tests for `TreatmentPlansRepository`.
- Create tests for `ClinicalSummaryAggregator`.
- Create tests for `PatientListVisitSummaryAggregator`.
- `npm run test` (or equivalent) passes successfully.
- No UI components or hooks are modified.
- Existing `npm run lint` and `npm run build` must continue to pass with 0 errors/warnings.

## 17. Recommended Next Task
**TEST-001 — Add unit/contract tests for clinical repositories and existing aggregators before orchestrator/hooks.**
