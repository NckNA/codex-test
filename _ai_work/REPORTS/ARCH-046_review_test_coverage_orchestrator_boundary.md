# ARCH-046: Review TEST-001 Coverage & Orchestrator Boundary

## 1. Title
ARCH-046 — Review TEST-001 coverage and decide ClinicalWorkflowOrchestrator implementation boundary

## 2. Scope
This report evaluates the quality and depth of the contract tests introduced in TEST-001 for the clinical repositories and aggregators. The goal is to determine if the test coverage provides a safe enough boundary to proceed with implementing the `ClinicalWorkflowOrchestrator`, or if additional edge-case testing is required first.

## 3. Inputs Reviewed
- `_ai_work/REPORTS/ARCH-043_clinical_dal_boundary_map.md`
- `_ai_work/REPORTS/ARCH-044_clinical_repositories_only_report.md`
- `_ai_work/REPORTS/ARCH-045_review_clinical_repositories_next_gate.md`
- `_ai_work/REPORTS/TEST-001_clinical_repositories_aggregators_tests_report.md`
- `src/data/repositories/DentalChartRepository.test.ts`
- `src/data/repositories/FindingsRepository.test.ts`
- `src/data/repositories/TreatmentPlansRepository.test.ts`
- `src/data/aggregators/ClinicalSummaryAggregator.test.ts`
- `src/data/aggregators/PatientListVisitSummaryAggregator.test.ts`
- `src/utils/storage.ts`
- `src/types/index.ts`

## 4. TEST-001 Scope Verification
- **Confirmed**: Vitest and jsdom were successfully installed.
- **Confirmed**: `npm run test` and `test:watch` scripts exist in `package.json`.
- **Confirmed**: 5 test suites (23 total tests) exist and pass.
- **Confirmed**: Repository and Aggregator tests exist.
- **Confirmed**: UI components, React hooks, and Orchestrator were completely untouched.
- **Confirmed**: `storage.ts` and `types/index.ts` were completely untouched.

## 5. Repository Test Coverage Review

**DentalChartRepository.test.ts:**
- Tests normal read/write behavior: Yes.
- Tests default behavior (missing chart creation): Yes.
- Tests patient isolation: Yes (implied by ID matching).
- Tests cross-domain non-mutation: Yes (verifies `df_dental_findings` is not touched).
- *Potential Gaps*: Does not strictly verify that `df_treatment_plans` is isolated (though structurally guaranteed). The default chart creation behavior mutates localStorage on a "read" (getDentalChart), which is an existing `storage.ts` side effect that the test acknowledges.

**FindingsRepository.test.ts:**
- Tests patient filtering: Yes.
- Tests create metadata generation (ID, timestamps): Yes.
- Tests update/delete matching patient/finding: Yes.
- Tests dental chart/treatment plan isolation: Yes.
- *Potential Gaps*: `createdAt`/`updatedAt` are checked as `string` types, not strictly for ISO 8601 validity. No-op behavior (updating/deleting a non-existent finding or wrong patient ID) is not fully covered.

**TreatmentPlansRepository.test.ts:**
- Tests patient filtering: Yes.
- Tests create/update/delete behavior: Yes.
- Tests findings/chart isolation: Yes.
- *Potential Gaps*: Treatment plan stages array and total price calculations are minimally tested. Similar to findings, update/delete no-op behavior for missing plans is not explicitly covered.

## 6. Aggregator Test Coverage Review

**ClinicalSummaryAggregator.test.ts:**
- Tests empty patientId: Yes.
- Tests summary counts (missing, caries, pulpitis, plans): Yes.
- Tests last/next visit computation: Yes.
- Tests blocked/cancelled filtering: Yes.
- Tests read-only behavior: Yes.
- *Potential Gaps*: Relies on `Date.now()` which can be non-deterministic if not mocked, though relative offsets were used safely. Total amount explicitly sums completed plans (current business logic).

**PatientListVisitSummaryAggregator.test.ts:**
- Tests fixed `now` date: Yes.
- Tests last/next per patient: Yes.
- Tests missing patientId/appointments: Yes.
- Tests blocked/cancelled states: Yes.
- Tests read-only behavior: Yes.
- *Potential Gaps*: If a patient has multiple past or future visits, it doesn't assert that it precisely picks the nearest one (relies on underlying `storage.getAppointments()` sorting).

## 7. Green-Test Trap Analysis
A passing test suite (`npm run test`) can create a false sense of security. It is critical to recognize the limitations of the current green tests:
- **UI Integration Risk**: Green repository tests do not prove that the clinical UI components (which still directly mutate `storage.ts`) are safe.
- **Cross-Domain Workflow Risk**: The tests explicitly verify *isolation*, meaning they prove repositories do NOT handle cross-domain logic (e.g., changing a tooth condition does not create a finding). The UI currently handles this manually.
- **No Orchestrator Coverage**: The `ClinicalWorkflowOrchestrator` does not exist, so the actual complex business logic of the application remains entirely untested.
- **Mock Limitations**: The test fixtures use hardcoded `STORAGE_KEYS` strings (`df_dental_charts`, etc.) because the internal keys in `storage.ts` are private.

## 8. ClinicalWorkflowOrchestrator Readiness Review
The repositories are strictly isolated, and the aggregators are safely read-only. The test coverage from TEST-001, while having minor edge-case gaps (like update/delete no-ops), provides a strong enough contract to guarantee that the underlying storage operations will behave predictably. 

Because the repositories are stable and verified, the foundation is ready for the `ClinicalWorkflowOrchestrator`.

## 9. Hooks/UI Readiness Review
- **Hooks**: NOT ready. Hooks require the Orchestrator to exist so they can expose complete cross-domain workflows to React components.
- **UI**: NOT ready. The UI components must wait for the Hooks.

## 10. Coverage Gaps and Risk Ranking
1. **Low Risk**: Missing ISO date string validation in repository metadata.
2. **Low Risk**: No-op behavior for updating/deleting non-existent IDs.
3. **Medium Risk**: Orchestrator does not exist, meaning cross-domain business logic remains bound to UI components.

## 11. Next-Step Options
- **Option A**: Implement `ClinicalWorkflowOrchestrator` only, no hooks/UI.
- **Option B**: Strengthen repository/aggregator edge-case tests (TEST-002).
- **Option C**: Design Orchestrator more deeply.
- **Option D**: Implement clinical hooks.
- **Option E**: Integrate UI now.

## 12. Options Comparison
TEST-001 successfully established the black-box contracts for the base DAL layer. The gaps identified (Option B) are minor edge cases that do not block the structural architecture. Implementing hooks (Option D) or integrating the UI (Option E) before the Orchestrator exists is structurally impossible/unsafe. 

Option A is the logical next step: building the Orchestrator to compose the tested repositories into the cross-domain workflows defined in ARCH-043.

## 13. Recommended Next Gate
**ARCH-047 — Implement ClinicalWorkflowOrchestrator only, no hooks/UI.**

## 14. What Must NOT Be Changed Next
- Do **NOT** create React hooks.
- Do **NOT** integrate or modify UI components.
- Do **NOT** modify `storage.ts` or `types/index.ts`.
- Do **NOT** turn the Orchestrator into a god-object repository (it must compose the existing Repositories).

## 15. Acceptance Criteria for ARCH-047
- Create `src/data/orchestrators/ClinicalWorkflowOrchestrator.ts`.
- Implement ONLY the cross-domain workflows documented in ARCH-043:
  - `applyToothStatusChange`
  - `createTreatmentPlanFromFindings`
- The Orchestrator must use `DentalChartRepository`, `FindingsRepository`, and `TreatmentPlansRepository` methods.
- No React hooks are created.
- No UI components are modified.
- `npm run test`, `npm run lint`, and `npm run build` must continue to pass.

## 16. Recommended Next Task
**ARCH-047 — Implement ClinicalWorkflowOrchestrator only, no hooks/UI.**
