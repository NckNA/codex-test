# ARCH-055: Review FindingsRisksTab Migration and Decide TreatmentPlans Boundary

## 1. Title
ARCH-055 — Review FindingsRisksTab migration and decide TreatmentPlans boundary

## 2. Scope
This report verifies the successful integration of hooks in `FindingsRisksTab` (ARCH-054), maps out the remaining direct `storage.ts` dependencies within the complex Treatment Plans module, and strategically defines the boundaries for the next safe UI migration slice (ARCH-056).

## 3. Inputs Reviewed
- `_ai_work/REPORTS/ARCH-054_findings_risks_tab_hooks_integration_report.md`
- `_ai_work/REPORTS/ARCH-053_review_dental_chart_fix_next_clinical_slice.md`
- `_ai_work/REPORTS/ARCH-048_review_orchestrator_tests_and_clinical_hooks_boundary.md`
- `_ai_work/REPORTS/ARCH-047_clinical_workflow_orchestrator_report.md`
- Migrated clinical files: `DentalChartTab.tsx`, `FindingsRisksTab.tsx`, `FindingModal.tsx`
- Treatment files: `TreatmentPlansTab.tsx`, `TreatmentPlanModal.tsx`, `CreatePlanFromFindingsModal.tsx`, `TreatmentPlanPatientPreview.tsx`
- Hooks & Orchestrator: `useTreatmentPlans.ts`, `usePatientFindings.ts`, `useClinicalWorkflow.ts`, `ClinicalWorkflowOrchestrator.ts`, `TreatmentPlansRepository.ts`, `types/index.ts`

## 4. ARCH-054 Verification
- **Verified:** `FindingsRisksTab` correctly utilizes `usePatientFindings`. Direct `storage.ts` imports were completely removed.
- **Verified:** `FindingModal` was successfully stripped of direct storage persistence. It is now a presentation-only component relying on the parent's async `onSave` handler.
- **Verified:** The treatment workflow was completely untouched.
- **Verified:** `PatientCardPage` was not touched.
- **Verified:** No global state, event bus, `useAsyncMutation`, or `any` typing was introduced.
- **Verified:** Manual browser smoke was explicitly noted as *not performed* in the ARCH-054 report.

## 5. Remaining Treatment Storage Dependency Map

### A. TreatmentPlansTab
- **Storage usages:** `storage.getTreatmentPlans`, `storage.addTreatmentPlan`, `storage.updateTreatmentPlan`, `storage.deleteTreatmentPlan`.
- **Dependencies:** Opens `TreatmentPlanModal`, `CreatePlanFromFindingsModal`, and `TreatmentPlanPatientPreview`.

### B. TreatmentPlanModal
- **Storage usages:** `storage.getFindings` (used purely for reading findings to display titles of linked problems in stages).
- **Persistence:** Already presentation-only for writing (calls `onSave(plan)`).

### C. CreatePlanFromFindingsModal
- **Storage usages:** `storage.getFindings`, `storage.getTreatmentPlans`, `storage.addTreatmentPlan`, `storage.updateFinding`.
- **Behavior:** Contains complex local filtering (eligible finding statuses, active plan logic). Directly executes a cross-domain transaction creating a plan and mutating multiple findings sequentially. 

### D. TreatmentPlanPatientPreview
- **Storage usages:** `storage.getPatients`, `storage.getChiefComplaint`, `storage.getFindings`.
- **Behavior:** Strictly read-only presentation summarizing cross-domain data for the patient.

## 6. Treatment Component Risk Review
- **`TreatmentPlansTab` (Simple CRUD): Medium.** Isolating the core CRUD operations is straightforward, assuming the complex modals can be decoupled or deferred.
- **`TreatmentPlanModal`: Low/Medium.** Mostly presentation, but reading `storage.getFindings` needs to be addressed (either passed as a prop from the parent or by consuming a hook internally).
- **`CreatePlanFromFindingsModal`: High.** Highly complex cross-domain mutation logic intertwining Treatment Plans and Findings domains.
- **`TreatmentPlanPatientPreview`: Low.** Read-only, safe to leave as-is until the core domains are fully migrated.

## 7. Next Implementation Option Analysis

- **Option A (TreatmentPlansTab simple CRUD only)**
  - *Risk: Medium.* Migrating only the parent tab leaves `CreatePlanFromFindingsModal` acting independently on storage, potentially leading to state desync if the parent hook doesn't know when to refetch.
- **Option B (TreatmentPlansTab + TreatmentPlanModal only, leave CreatePlanFromFindingsModal as-is)**
  - *Risk: Medium.* We can migrate the simple CRUD of plans, clean up `TreatmentPlanModal`, and explicitly allow the parent `TreatmentPlansTab` to call `refetch` on the hook after `CreatePlanFromFindingsModal` signals `onPlanCreated`. This isolates the High Risk component for a dedicated future task.
- **Option C (CreatePlanFromFindingsModal migration next)**
  - *Risk: High.* Requires rewiring the core UI logic to `useClinicalWorkflow.createTreatmentPlanFromFindings`. Taking this on while the parent tab is still storage-bound is a recipe for cascading refactoring chaos.
- **Option D (Migrate all treatment components together)**
  - *Risk: Very High.* Rejected. Violates incremental migration principles.
- **Option E (TreatmentPlanPatientPreview read-only first)**
  - *Risk: Low.* Rejected. Yields almost zero architectural value compared to securing the CRUD foundation.

## 8. Recommended Next UI Slice
**ARCH-056 — Integrate TreatmentPlansTab simple CRUD with useTreatmentPlans only, leave CreatePlanFromFindingsModal workflow unchanged.**
We select Option B. By wrapping the foundation in `useTreatmentPlans`, we prepare the ground for the final orchestration task without biting off more than we can safely test.

## 9. ARCH-056 Proposed Boundary

**Allowed Files:**
- `src/components/treatment/TreatmentPlansTab.tsx`
- `src/components/treatment/TreatmentPlanModal.tsx` (only to remove `storage.ts` and adjust async `onSave`)
- `_ai_work/REPORTS/ARCH-056_treatmentplans_tab_hooks_integration_report.md`

**Forbidden Files:**
- `CreatePlanFromFindingsModal.tsx`
- `TreatmentPlanPatientPreview.tsx`
- `DentalChartTab.tsx`, `FindingsRisksTab.tsx`, `FindingModal.tsx`
- `PatientCardPage.tsx`
- Hooks, Repositories, Orchestrator, `storage.ts`, Types, Tests, Backend configs.

**Expected Behavior for ARCH-056:**
- `TreatmentPlansTab` adopts `useTreatmentPlans`.
- `storage` imports are purged from `TreatmentPlansTab`.
- Create/update/delete actions for plans route through the hook.
- `TreatmentPlanModal` closes only after a successful async save. On error, it remains open and logs the failure.
- `CreatePlanFromFindingsModal` is deliberately **NOT** migrated. It will still be opened by `TreatmentPlansTab`. When it fires `onPlanCreated`, `TreatmentPlansTab` will simply call `refetch` from `useTreatmentPlans` to sync the UI.
- No `useClinicalWorkflow` usage yet. No global state, event bus, `useAsyncMutation`, or `any`.

## 10. CreatePlanFromFindingsModal Deferral Rationale
The `CreatePlanFromFindingsModal` handles a complex cross-domain orchestration (creating a plan while updating findings). It owns its own eligibility logic and active plan detection. Attempting to migrate it concurrently with the basic `TreatmentPlansTab` CRUD introduces unmanageable risk. It will be migrated in a subsequent dedicated task (ARCH-057 or later) using `useClinicalWorkflow`.

## 11. Medical Summary / Refresh Strategy
- `PatientCardPage` remains untouched.
- The existing page-local re-entry refresh pattern stands. Cross-tab global syncing is intentionally excluded from this architectural slice.

## 12. Future Dental Model Note
The expanded dental visual model (surfaces, gum, bone, implants) remains an entirely separate future feature track, wholly outside the scope of this persistence migration.

## 13. What Must NOT Be Changed Next
- Do NOT touch `CreatePlanFromFindingsModal.tsx` or `TreatmentPlanPatientPreview.tsx`.
- Do NOT alter any existing Hooks, Orchestrators, or Repositories.
- Do NOT modify PatientCardPage or global configurations.

## 14. Acceptance Criteria for ARCH-056
- `TreatmentPlansTab` uses `useTreatmentPlans` exclusively for CRUD.
- `TreatmentPlanModal` properly handles async saves.
- Build, lint, and test suites pass perfectly.
- `CreatePlanFromFindingsModal` remains perfectly operational in its legacy state.

## 15. Recommended Next Task
**ARCH-056 — Integrate TreatmentPlansTab simple CRUD with useTreatmentPlans only, leave CreatePlanFromFindingsModal workflow unchanged.**
