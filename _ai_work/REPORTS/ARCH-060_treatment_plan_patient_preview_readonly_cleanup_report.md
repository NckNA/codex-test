# ARCH-060: TreatmentPlanPatientPreview Read-Only Cleanup Report

## 1. Files Inspected
- `_ai_work/REPORTS/ARCH-059_review_treatment_preview_readonly_boundary.md`
- `_ai_work/REPORTS/ARCH-058_create_plan_from_findings_workflow_integration_report.md`
- `src/components/treatment/TreatmentPlansTab.tsx`
- `src/components/treatment/TreatmentPlanPatientPreview.tsx`
- `src/data/hooks/usePatientsCollection.ts`
- `src/data/hooks/useChiefComplaint.ts`
- `src/data/hooks/usePatientFindings.ts`
- `src/types/index.ts`

## 2. Files Changed
- `src/components/treatment/TreatmentPlansTab.tsx`
- `src/components/treatment/TreatmentPlanPatientPreview.tsx`
- `_ai_work/REPORTS/ARCH-060_treatment_plan_patient_preview_readonly_cleanup_report.md` (this file)

## 3. Summary of Preview Cleanup
`TreatmentPlanPatientPreview` has been successfully refactored to be a completely storage-free, read-only presentation component. 
The component now strictly expects to receive `patient`, `chiefComplaint`, and `findings` via props. It still contains view-level derived state calculations (e.g., determining which findings are linked to a plan) but it does not invoke the DAL itself.

## 4. Storage Removal Confirmation
- The `import { storage } from '../../utils/storage';` line was successfully removed from `TreatmentPlanPatientPreview.tsx`.
- The direct method calls `storage.getPatients()`, `storage.getChiefComplaint()`, and `storage.getFindings()` were removed.

## 5. Parent-Provided Data Strategy
`TreatmentPlansTab` acts as the smart container, fetching necessary cross-domain data for the preview component via existing hooks.

## 6. Hooks Used in TreatmentPlansTab
To fulfill the data requirements for the preview, `TreatmentPlansTab` now imports and invokes:
- `usePatientsCollection` (to extract the target `Patient`)
- `useChiefComplaint` (to extract the `ChiefComplaint`)
- `usePatientFindings` (existing hook; extracts `findings`)

## 7. Preview Derived Data Behavior
`TreatmentPlanPatientPreview` still accurately derives which findings are linked or serve as additional recommendations.
```typescript
const linkedFindingIds = new Set(plan.stages.flatMap(stage => stage.findingIds || []));
const linkedFindings = findings.filter(finding => linkedFindingIds.has(finding.id));
// ...
```
This preserves the presentation logic without mutating any data. Fallbacks for missing patients or complaints were preserved exactly as they were.

## 8. What Was Intentionally Not Changed
- `PatientCardPage` and its summary refresh behavior.
- `DentalChartTab`, `ToothGrid`, `FindingsRisksTab`, `FindingModal`, `TreatmentPlanModal`, `CreatePlanFromFindingsModal`.
- Any existing hooks, repositories, orchestrators, aggregators, or `storage.ts` logic.
- Treatment CRUD workflows and create-from-findings workflows.
- No global state / event bus or React Query additions.

## 9. Checks Performed
- **`TreatmentPlansTab.tsx` changed?** Yes.
- **`TreatmentPlanPatientPreview.tsx` changed?** Yes.
- **Storage import removed from `TreatmentPlanPatientPreview`?** Yes.
- **`TreatmentPlanPatientPreview` still calls storage directly?** No.
- **`TreatmentPlansTab` uses `usePatientsCollection`?** Yes.
- **`TreatmentPlansTab` uses `useChiefComplaint`?** Yes.
- **`TreatmentPlansTab` passes `patient/chiefComplaint/findings` into preview?** Yes.
- **`TreatmentPlanPatientPreview` is read-only?** Yes.
- **`TreatmentPlanModal` was changed?** No.
- **`CreatePlanFromFindingsModal` was changed?** No.
- **`DentalChartTab/FindingsRisksTab/FindingModal` changed?** No.
- **`PatientCardPage` changed?** No.
- **Hooks/repositories/orchestrator/storage/types/tests/backend/configs changed?** No.
- **`useAsyncMutation` used?** No.
- **`any` used?** No.
- **Global state/event bus introduced?** No.
- **RESEARCH-003 / domain model v2 implemented?** No.

## 10. Manual Smoke Checklist Result
**Manual browser smoke was not performed.**
Architectural guarantees were verified entirely via TypeScript typing, hook interface compliance, and automated static checks.

## 11. Known Limitations
- `PatientCardPage` summary refresh still relies on existing tab re-entry behavior.
- No global cross-tab refresh system exists.
- No hook/UI tests were added.
- Errors are still logged to the console only in mutation flows.
- RESEARCH-003 domain model v2 remains documentation-only.
- `TreatmentPlanPatientPreview` is storage-free after this task, but broader patient summary aggregators may still use legacy storage elsewhere.

## 12. Recommended Next Task
**ARCH-061 — Review Treatment Plans full storage decoupling and map remaining app-wide direct storage dependencies.**
