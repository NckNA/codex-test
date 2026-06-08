# ARCH-050: Review Clinical Hooks & First UI Slice

## 1. Title
ARCH-050 — Review clinical hooks implementation and design first safe UI integration slice.

## 2. Scope
This report verifies the clinical hooks implemented in ARCH-049, maps the remaining direct dependencies on `storage.ts` in the UI, and identifies the safest initial slice for integrating the hooks into the UI layer.

## 3. Inputs Reviewed
- `_ai_work/REPORTS/ARCH-048_review_orchestrator_tests_and_clinical_hooks_boundary.md`
- `_ai_work/REPORTS/ARCH-049_clinical_hooks_only_report.md`
- `_ai_work/REPORTS/TEST-002_clinical_workflow_orchestrator_tests_report.md`
- Hooks: `useDentalChart`, `usePatientFindings`, `useTreatmentPlans`, `useClinicalWorkflow`
- Supporting hooks: `useAsyncQuery`, `usePatientMedicalSummary`, `usePatientProfile`, `usePatientsCollection`, `useScheduleAppointments`
- Clinical UI files: `PatientCardPage.tsx`, `DentalChartTab.tsx`, `ToothEditorModal.tsx`, `FindingModal.tsx`, `FindingsRisksTab.tsx`, `CreatePlanFromFindingsModal.tsx`, `TreatmentPlansTab.tsx`, `TreatmentPlanModal.tsx`, `TreatmentPlanPatientPreview.tsx`

## 4. ARCH-049 Hook Verification
- **`useDentalChart` exists?** Yes.
- **`usePatientFindings` exists?** Yes.
- **`useTreatmentPlans` exists?** Yes.
- **`useClinicalWorkflow` exists?** Yes.
- **`useAsyncQuery` used appropriately?** Yes, across domain read hooks.
- **Manual mutation wrappers used?** Yes.
- **Direct import of `storage.ts` avoided?** Yes.
- **`useAsyncMutation` avoided?** Yes.
- **Global state / Event bus avoided?** Yes.
- **UI untouched?** Yes.
- **God-hook `useClinicalData` avoided?** Yes.

## 5. Hook Quality Review
- **`useDentalChart`**: Strictly owns chart reading and text field saving. `applyToothStatusChange` is properly segregated. *Potential issue:* Modifying text fields (`saveDentalChart`) refetches the chart but not the findings. This is correct domain boundary behavior, but the UI must be aware of it.
- **`usePatientFindings`**: Strictly owns findings CRUD. *Potential issue:* Creating or modifying a finding will affect the medical summary badge, but this hook doesn't auto-refresh the summary. This must be handled by UI-level page coordination.
- **`useTreatmentPlans`**: Strictly owns plans CRUD. Same summary refresh observation as findings.
- **`useClinicalWorkflow`**: Perfectly handles cross-domain mutation. Takes no `patientId` (preventing stale closures), holds no `data` state, and expects the caller to coordinate adjacent domain `refetch()` invocations.

## 6. Remaining Direct Storage Usage Map
| Component | Risk Level | Direct `storage.ts` Usage |
|-----------|-----------|-------------------------|
| `DentalChartTab` | **High** | Reads/writes dental chart, reads/creates findings, manages cross-domain tooth updates. |
| `FindingsRisksTab` | Medium | Reads/updates/deletes findings. |
| `FindingModal` | Medium | Finding form CRUD. |
| `TreatmentPlansTab` | Medium | Reads plans, reads findings. |
| `TreatmentPlanModal` | Medium | Plan CRUD. |
| `CreatePlanFromFindingsModal` | **High** | Cross-domain mutation: creates plan and updates finding statuses simultaneously. |
| `TreatmentPlanPatientPreview` | Low | Read-only presentation. |

## 7. UI Integration Option Analysis
- **Option A (Chart text-only)**: Too fragmented. Splitting state management across `storage.ts` and hooks within the same component introduces edge cases and synchronization nightmares.
- **Option B (Full DentalChartTab migration)**: Migrates one cohesive component unit. Requires combining `useDentalChart`, `usePatientFindings`, and `useClinicalWorkflow`. The highest risk is the `ToothEditorModal` lifecycle, but resolving this creates the perfect blueprint for the rest of the app.
- **Option C (FindingsRisksTab)**: Medium risk, but less impactful as a foundational workflow compared to the core dental chart.
- **Option D (TreatmentPlansTab CRUD)**: Safer than chart migration but tangled with the `CreatePlanFromFindingsModal` flow.
- **Option E (TreatmentPlanPatientPreview read-only)**: Lowest risk, but avoids proving out the mutation patterns which is the core architectural goal.
- **Option F (CreatePlanFromFindingsModal)**: Extremely high risk to do first since it relies heavily on both findings and plans states.

## 8. First Slice Recommendation
**Full `DentalChartTab` migration** is chosen as the safest, most impactful first slice. We will aggressively box the scope to this single tab to prevent cascading refactoring.

## 9. DentalChartTab Migration Boundary
- **Allowed Component**: `DentalChartTab.tsx` only. (`ToothEditorModal.tsx` may be modified slightly ONLY if TypeScript prop typings demand it, but its internal presentation logic must remain).
- **Hooks Used**: `useDentalChart`, `usePatientFindings`, `useClinicalWorkflow`.
- **Action**: Completely remove `import { storage }` from `DentalChartTab`.
- **Existing Behaviors**: Must preserve all existing visual and interaction behaviors.

## 10. Refetch and Modal Close Strategy
To resolve cross-domain synchronization without global state:
1. **Tooth Save Action**:
   - `try {`
   - `await useClinicalWorkflow.applyToothStatusChange(...)`
   - `await useDentalChart.refetch()`
   - `await usePatientFindings.refetch()`
   - Close the modal.
   - `} catch (e) {`
   - `console.error(...)`
   - Leave the modal open to let the user see the failure/retry.
   - `}`
2. **Text Save Action**:
   - Await `useDentalChart.saveDentalChart(...)`.

## 11. PatientCardPage / Medical Summary Refresh Decision
`PatientCardPage` natively refetches the medical summary when transitioning back to the overview tab. **Do NOT modify `PatientCardPage`** in this first UI slice. The existing tab re-entry refetch pattern is sufficient for now and keeps the scope strictly limited to the `DentalChartTab`.

## 12. Smoke Checklist for First UI Slice
After integration, the following manual smoke test must pass:
- [ ] Open patient card.
- [ ] Open Dental Chart tab.
- [ ] Existing chart renders properly.
- [ ] Text field save works correctly.
- [ ] Clicking a tooth opens the modal.
- [ ] Changing a tooth condition (without a finding payload) saves and updates the chart visually.
- [ ] Changing a tooth condition + creating a finding saves both.
- [ ] Finding badge/summary count updates appropriately.
- [ ] Modal closes **only** after successful save.
- [ ] Console shows no runtime errors.
- [ ] Overview summary refreshes upon returning to the Overview tab.

## 13. Risk Ranking
1. (High) Broad UI Migration — Modifying all tabs at once. (REJECTED)
2. (High) Cross-Domain Modal Migration — `CreatePlanFromFindingsModal`. (REJECTED)
3. **(Medium) Full Single-Tab Migration — `DentalChartTab`. (SELECTED)**
4. (Low) Fragmented partial migration — Chart text-only. (REJECTED)

## 14. What Must NOT Be Changed Next
- `FindingsRisksTab`, `FindingModal`, `TreatmentPlansTab`, `TreatmentPlanModal`, `TreatmentPlanPatientPreview`, `CreatePlanFromFindingsModal`.
- `PatientCardPage`, `Header`.
- Hooks, Repositories, Orchestrator, Aggregators, Tests.
- `storage.ts`, `types/index.ts`.
- Package configs, backend routes.
- Global state management systems.

## 15. Acceptance Criteria for ARCH-051
- `DentalChartTab` uses only the new hooks; `storage.ts` import is fully removed.
- `ToothEditorModal` visual presentation remains intact.
- Workflow successfully coordinates modal closing and subsequent data refetching.
- No other clinical tabs are modified.
- All tests, linting, and builds pass perfectly (0 errors, 0 warnings).

## 16. Recommended Next Task
**ARCH-051 — Integrate DentalChartTab with clinical hooks as the first cohesive slice, no other clinical tabs.**
