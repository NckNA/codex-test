# ARCH-048: Review Orchestrator Tests & Clinical Hooks Boundary

## 1. Title
ARCH-048 — Review ClinicalWorkflowOrchestrator test coverage and design clinical hooks boundary

## 2. Scope
This report evaluates the contract tests created in TEST-002 for the `ClinicalWorkflowOrchestrator` and provides a concrete boundary and responsibility map for the future React hooks that will bridge the UI to the Data Access Layer (DAL). It specifically designs the separation of pure domain CRUD operations from orchestrator workflows.

## 3. Inputs Reviewed
- `_ai_work/REPORTS/ARCH-043_clinical_dal_boundary_map.md`
- `_ai_work/REPORTS/ARCH-047_clinical_workflow_orchestrator_report.md`
- `_ai_work/REPORTS/TEST-002_clinical_workflow_orchestrator_tests_report.md`
- `src/data/orchestrators/ClinicalWorkflowOrchestrator.ts`
- `src/data/orchestrators/ClinicalWorkflowOrchestrator.test.ts`
- `src/data/repositories/DentalChartRepository.ts`
- `src/data/repositories/FindingsRepository.ts`
- `src/data/repositories/TreatmentPlansRepository.ts`
- Existing hook conventions (`useAsyncQuery`, `useAsyncMutation`, `usePatientProfile`, etc.)
- Clinical UI components (for future integration planning)

## 4. TEST-002 Coverage Verification
- **Test file exists:** Yes, `ClinicalWorkflowOrchestrator.test.ts`.
- **Dependency injection used:** Yes, in-memory fake repositories (`fakeDentalChartRepository`, etc.) were passed to `createClinicalWorkflowOrchestrator`.
- **No `localStorage` reliance:** Yes.
- **Methods tested:** Both `applyToothStatusChange` and `createTreatmentPlanFromFindings` were thoroughly tested.
- **Error propagation tested:** Yes.
- **Constraints preserved:** No hooks created, no UI modified, no source files changed, no types or `storage.ts` altered.

## 5. Orchestrator Test Quality Review
The testing approach guarantees that cross-domain mutations operate safely.
- **Tooth status changes:** Covered. Chart modifications trigger properly without modifying findings if the payload is empty.
- **New finding creation / Existing finding update:** Covered. Correctly resolves between `createFinding` and `updateFinding` based on `toothNumber`, `category`, and active statuses.
- **Ignored statuses:** Covered. `completed` and `declined_by_patient` findings trigger the creation of new findings.
- **Mismatches:** Covered. Mismatched categories or tooth numbers successfully create distinct new findings instead of overwriting.
- **Plan creation:** Covered. Empty array bails early; valid arrays generate stages and update all participating findings to `included_in_plan`.
- **Operation order:** Covered. The treatment plan is successfully generated before findings are iteratively updated.
- **Error propagation:** Covered. Rejected repository operations (e.g., plan creation failure) bubble up.

## 6. Remaining Test Gaps
While orchestrator tests are thorough, architectural limitations dictate specific gaps:
- **No Transactional Rollback:** Because `localStorage` lacks transaction support, finding update failures *after* plan creation are not rolled back. This behavior was intentionally not tested as rollback does not exist.
- **Timestamp Determinism:** `applyToothStatusChange` computes `new Date().toISOString()` internally. Exact timestamp assertions in tests are bypassed using less strict object matching.
- **No Eligibility Validation:** The orchestrator blindly trusts `selectedFindings` for plan creation. The UI still holds responsibility for filtering which findings are "eligible".
- **No Hook/UI State Behavior:** Local React state, caching, and modal closings remain completely untested since hooks are not implemented yet.

## 7. Clinical Hook Boundary Design
The UI needs to interface with both single-domain repositories and the cross-domain orchestrator. To avoid creating a "god-hook" (`useClinicalData`), we will split responsibilities into focused hooks.

### Domain Hooks
These hooks expose pure domain CRUD. They wrap repository methods and coordinate read-state.

#### A. `useDentalChart(patientId: string)`
- **Purpose**: Load the dental chart via `DentalChartRepository.getDentalChart`.
- **Returns**: `{ dentalChart, isLoading, isError, error, isSaving, saveError, refetch, saveDentalChart }`
- **Note**: Does *not* expose `applyToothStatusChange`. Modifying text fields uses `saveDentalChart`. Modifying tooth conditions uses the workflow hook.

#### B. `usePatientFindings(patientId: string)`
- **Purpose**: Load findings via `FindingsRepository.listFindingsByPatient`.
- **Returns**: `{ findings, isLoading, isError, error, isSaving, saveError, refetch, createFinding, updateFinding, deleteFinding }`
- **Note**: Only for direct CRUD. Does not touch treatment plans.

#### C. `useTreatmentPlans(patientId: string)`
- **Purpose**: Load plans via `TreatmentPlansRepository.listTreatmentPlansByPatient`.
- **Returns**: `{ treatmentPlans, isLoading, isError, error, isSaving, saveError, refetch, createTreatmentPlan, updateTreatmentPlan, deleteTreatmentPlan }`
- **Note**: Only for direct CRUD.

### Workflow Hook
#### D. `useClinicalWorkflow(patientId: string)`
- **Purpose**: Exposes cross-domain mutations via `ClinicalWorkflowOrchestrator`.
- **Returns**: `{ applyToothStatusChange, createTreatmentPlanFromFindings, isSaving, saveError }`
- **Note**: Does not maintain its own read-state (no `data` property). It relies on the consumer passing data and triggering refetches on the domain hooks.

## 8. Mutation Wrapper Strategy
The project currently relies on manual mutation wrappers rather than exclusively using `useAsyncMutation` for complex multi-step state logic.

Standard Wrapper Pattern for Hooks:
```ts
const [isSaving, setIsSaving] = useState(false);
const [saveError, setSaveError] = useState<Error | null>(null);

const executeMutation = async (args) => {
  setIsSaving(true);
  setSaveError(null);
  try {
    await repositoryOrOrchestratorMethod(args);
    await refetch(); // Sync local read-state
  } catch (err) {
    setSaveError(err instanceof Error ? err : new Error('Mutation failed'));
    throw err;
  } finally {
    setIsSaving(false);
  }
};
```
*Blind usage of `useAsyncMutation` is discouraged if it breaks this established state pattern.*

## 9. Refetch/Refresh Strategy
Because cross-domain operations affect multiple domains, local read-states must stay in sync without introducing a global Event Bus or Redux.

**Strategy: Page-Local Coordination**
- When `useClinicalWorkflow` successfully executes `applyToothStatusChange`, the caller (e.g., `DentalChartTab`) must manually trigger `refetch()` from both `useDentalChart` and `usePatientFindings`.
- When `useClinicalWorkflow` executes `createTreatmentPlanFromFindings`, the caller (e.g., `CreatePlanFromFindingsModal`) must trigger `refetch()` from both `useTreatmentPlans` and `usePatientFindings`.
- We avoid a global event bus to minimize implicit coupling. Refetches are explicitly passed as callbacks.

## 10. UI Integration Risk Review
**Immediate UI integration is REJECTED.** 
Attempting to build the hooks and integrate the UI simultaneously in one PR introduces massive regression risk. The clinical UI files currently depend directly on `storage.ts` with tightly coupled mutation logic. Refactoring `DentalChartTab` and the modals requires careful surgical updates to props and hook bindings.

## 11. Next-Step Options
- **Option A**: Implement clinical hooks only, no UI integration (ARCH-049).
- **Option B**: Add test strategy/design for hooks before implementing (TEST-003).
- **Option C**: Start UI integration now.

## 12. Options Comparison
Option C is rejected (too risky). Option B is unnecessary as the hook shapes are fully typed wrappers around strictly tested orchestrators and repositories; their behavior is purely passthrough with basic `useState` flags. Option A correctly isolates the interface layer from the presentation layer.

Since four hooks might be too dense for one PR, they can be implemented sequentially, but bundling the 3 Domain Hooks + 1 Workflow Hook as pure interfaces is a safe, testable unit of work.

## 13. Recommended Next Gate
**ARCH-049 — Implement clinical hooks only, no UI integration.**

## 14. What Must NOT Be Changed Next
- Do **NOT** modify any UI component (e.g., `DentalChartTab`, `FindingModal`).
- Do **NOT** modify `storage.ts` or `types/index.ts`.
- Do **NOT** modify the Orchestrator or Repositories.
- Do **NOT** introduce global state (Redux, Zustand, Context, Event Bus).
- Do **NOT** combine hooks into a giant `useClinicalData` god-hook.

## 15. Acceptance Criteria for ARCH-049
- Create `useDentalChart`, `usePatientFindings`, `useTreatmentPlans`, and `useClinicalWorkflow` hooks.
- Hooks must use manual mutation wrapper pattern (or `useAsyncMutation` if it strictly matches).
- Hooks must not modify the UI.
- All tests, linting, and builds must pass.

## 16. Recommended Next Task
**ARCH-049 — Implement clinical hooks only, no UI integration.**
