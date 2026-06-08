# ARCH-053: Review Dental Chart Fix and Next Clinical Slice

## 1. Title
ARCH-053 — Review DentalChart responsive/accessibility fix and decide next clinical UI slice

## 2. Scope
This report verifies the structural and accessibility improvements made to the `ToothGrid` component in ARCH-052. It also documents the resulting manual smoke test confirmation, maps the remaining technical debt regarding direct `storage.ts` usage in the clinical module, and strategically outlines the next minimal UI integration slice.

## 3. Inputs Reviewed
- `_ai_work/REPORTS/ARCH-051_dental_chart_tab_hooks_integration_report.md`
- `_ai_work/REPORTS/ARCH-052_dental_chart_responsive_a11y_fix_report.md`
- `_ai_work/REPORTS/ARCH-050_review_clinical_hooks_first_ui_slice.md`
- `_ai_work/REPORTS/ARCH-049_clinical_hooks_only_report.md`
- **Currently Migrated UI**: `src/components/dental/DentalChartTab.tsx`, `src/components/dental/ToothGrid.tsx`
- **Clinical Hooks**: `useDentalChart.ts`, `usePatientFindings.ts`, `useTreatmentPlans.ts`, `useClinicalWorkflow.ts`
- **Remaining Unmigrated UI Candidates**: `FindingsRisksTab.tsx`, `FindingModal.tsx`, `TreatmentPlansTab.tsx`, `TreatmentPlanModal.tsx`, `CreatePlanFromFindingsModal.tsx`, `TreatmentPlanPatientPreview.tsx`, `PatientCardPage.tsx`

## 4. ARCH-052 Verification
We confirm the following regarding the ARCH-052 fix:
- `ToothGrid.tsx` was correctly refactored.
- `ToothItem` interactive elements were transformed from semantically incorrect `<div>`s to native `<button type="button">` elements.
- Meaningful `aria-label` attributes (`Редактировать зуб {toothNumber}`) were added for screen reader support.
- Tailwind `focus-visible` utility classes were added to provide standard keyboard accessibility styling.
- The `ToothGrid` layout was updated to `w-max min-w-max`, escaping the flex centering clipping trap on narrow screens and allowing intrinsic scrolling.
- `DentalChartTab` and other clinical tabs were untouched. 
- Core layers (`storage.ts`, hooks, orchestrator, etc.) were explicitly untouched.

## 5. Manual Smoke Confirmation
The following manual browser smoke test was documented and verified:
- **Patient card opened.** (Confirmed)
- **Dental Chart tab opened.** (Confirmed)
- **ToothGrid opened on narrow layout.** (Confirmed)
- **Tooth 18 is reachable/clickable.** (Confirmed)
- **Clicking tooth 18 opens ToothEditorModal.** (Confirmed)
- **It no longer hits sidebar “Рассылка”.** (Confirmed)
- **Console errors: none.** (Confirmed)
- **npm run test passed: 33 tests.** (Confirmed)
- **npm run build passed.** (Confirmed)
- **npm run lint passed.** (Confirmed)
- **npm run check --prefix backend passed.** (Not applicable / Skipped - no backend available)

## 6. DentalChartTab Migration Status
The `DentalChartTab` is now considered architecturally stable. It successfully encapsulates the core data flow patterns via custom hooks (`useDentalChart`, `usePatientFindings`, `useClinicalWorkflow`). The responsive/a11y issues originally discovered during manual review have been fully addressed.
- **Decision:** Do not expand `DentalChartTab` further right now. It is robust enough to serve as the blueprint for migrating adjacent tabs.

## 7. Remaining Clinical Storage Dependency Map
| UI Component | Risk Level | Direct `storage.ts` Dependency Profile |
|--------------|------------|----------------------------------------|
| `FindingsRisksTab` | **Medium** | Needs `getFindings`, `addFinding`, `updateFinding`, `deleteFinding`. Primarily a single-domain CRUD interface. |
| `FindingModal` | Medium | Relies heavily on callbacks from the parent tab. Low architectural risk if kept strictly presentational. |
| `TreatmentPlansTab` | Medium | Needs `getTreatmentPlans`, `getFindings`. Single-domain CRUD mixed with cross-domain reads. |
| `TreatmentPlanModal` | Medium | Standard single-domain form. |
| `CreatePlanFromFindingsModal` | **High** | Coordinates creating a plan while mutating finding statuses across two domains simultaneously. |
| `TreatmentPlanPatientPreview` | Low | Read-only presentation of top plans. |

## 8. Next Slice Option Analysis
- **Option A (FindingsRisksTab migration)**: **Medium Risk.** Directly maps to the already robust `usePatientFindings` hook. Isolates the findings domain cleanly before complicating the state with Treatment Plans.
- **Option B (FindingModal-focused)**: **Medium Risk.** Awkward to migrate without its parent `FindingsRisksTab`. 
- **Option C (TreatmentPlansTab)**: **Medium/High Risk.** Requires handling Treatment Plans while the underlying Findings layer (which feeds it) is still half-migrated in adjacent components.
- **Option D (TreatmentPlanPatientPreview)**: **Low Risk.** Very safe, but moves the needle too little architecturally.
- **Option E (CreatePlanFromFindingsModal)**: **Very High Risk.** Requires a mature hook-based state across both Findings and Treatment Plans to coordinate successfully without global state. 
- **Option F (Broad UI migration)**: **Rejected.** Violates the incremental migration strategy.

## 9. Recommended Next UI Slice
**ARCH-054 — Integrate FindingsRisksTab with usePatientFindings only, no TreatmentPlans, no CreatePlanFromFindingsModal.**
This provides the most logical, incremental step forward by securing the Findings domain before tackling the complex Treatment Plans orchestration.

## 10. ARCH-054 Proposed Boundary
**Allowed Files:**
- `src/components/dental/FindingsRisksTab.tsx`
- `src/components/dental/FindingModal.tsx` (only if strictly necessary for prop typing)
- `_ai_work/REPORTS/ARCH-054_findings_risks_tab_hooks_integration_report.md`

**Forbidden Files:**
- `DentalChartTab`, `ToothGrid`
- `TreatmentPlansTab`, `TreatmentPlanModal`, `CreatePlanFromFindingsModal`, `TreatmentPlanPatientPreview`
- `PatientCardPage`
- All Hooks, Repositories, Orchestrator, Aggregators, `storage.ts`, `types/index.ts`, Tests.

**Expected Behavior for ARCH-054:**
- `FindingsRisksTab` imports and uses `usePatientFindings`.
- Direct `storage.ts` imports are deleted from `FindingsRisksTab`.
- Create/Update/Delete flows route exclusively through the hook.
- Modals close only upon successful hook mutation.
- No `any` casting, no `useAsyncMutation`, no global state/event bus introduction.

## 11. Medical Summary / Refresh Strategy
The existing `PatientCardPage` badge refresh behavior is triggered natively upon re-entry to the Overview tab. **This pattern will remain untouched.** We will intentionally defer cross-tab immediate badge sync to maintain page-local coordination simplicity.

## 12. Future Dental Model Note
While it is tempting to expand the clinical model to include intricate visual data (surfaces, gum health, bone loss, root canals, implantology), this is strictly outside the scope of the current architectural data-flow migration track. 
*Recommendation for the future:* Initiate a separate design track (`DENTAL-MODEL-001 — Design extended dental clinical model for surfaces, gum, bone, canals, implant planning`) once the foundational `LocalStorage` hook migration is complete across all tabs.

## 13. Risk Ranking
1. (High) Cross-Domain CreatePlanFromFindingsModal
2. (High) TreatmentPlansTab (depends on findings state)
3. **(Medium) FindingsRisksTab (SELECTED)**
4. (Low) TreatmentPlanPatientPreview read-only cleanup

## 14. What Must NOT Be Changed Next
Do **not** touch `DentalChartTab`, `ToothGrid`, `TreatmentPlansTab`, `CreatePlanFromFindingsModal`, `PatientCardPage`, Hooks, Repositories, `storage.ts`, or any global configurations.

## 15. Acceptance Criteria for ARCH-054
- `FindingsRisksTab` is free of `storage.ts`.
- CRUD actions utilize `usePatientFindings`.
- No global state managers are introduced.
- Modals respect the asynchronous result of hook operations before closing.
- Build, lint, and test suites pass perfectly.

## 16. Recommended Next Task
**ARCH-054 — Integrate FindingsRisksTab with usePatientFindings only, no treatment plan workflow.**
