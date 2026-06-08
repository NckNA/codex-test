# ARCH-059: Review CreatePlanFromFindingsModal Migration and Decide TreatmentPlanPatientPreview Read-Only Cleanup

## 1. Title
ARCH-059 — Review CreatePlanFromFindingsModal migration and decide TreatmentPlanPatientPreview read-only cleanup

## 2. Scope
This report verifies the successful integration of the parent-owned workflow in `CreatePlanFromFindingsModal` (ARCH-058) and maps out the strategy to eliminate the final direct `storage.ts` usage in the Treatment Plans domain (`TreatmentPlanPatientPreview`).

## 3. Inputs Reviewed
- `_ai_work/REPORTS/ARCH-058_create_plan_from_findings_workflow_integration_report.md`
- `_ai_work/REPORTS/ARCH-057_review_create_plan_from_findings_workflow_boundary.md`
- `_ai_work/REPORTS/ARCH-056_treatmentplans_tab_hooks_integration_report.md`
- `src/components/treatment/TreatmentPlansTab.tsx`
- `src/components/treatment/TreatmentPlanPatientPreview.tsx`
- `src/data/hooks/useTreatmentPlans.ts`, `usePatientFindings.ts`, `useChiefComplaint.ts`, `usePatientsCollection.ts`

## 4. ARCH-058 Verification
- **Verified:** `TreatmentPlansTab` properly utilizes `useClinicalWorkflow` for the create-from-findings orchestrator.
- **Verified:** `CreatePlanFromFindingsModal` no longer imports `storage.ts`.
- **Verified:** `CreatePlanFromFindingsModal` receives `findings` and `treatmentPlans` via props.
- **Verified:** The parent successfully refetches `treatmentPlans` and `findings` after a successful workflow run.
- **Verified:** The modal closes only after a successful cross-domain orchestration, leaving state intact on errors.
- **Verified:** Orchestrator, hooks, repositories, and types were strictly left unmodified.
- **Verified:** `TreatmentPlanPatientPreview` was intentionally left legacy and unmodified.
- **Verified:** Manual smoke was explicitly omitted during ARCH-058.

## 5. Current TreatmentPlanPatientPreview Behavior Map
The preview component currently operates as a read-only viewer that builds a clinical summary for the patient:
- **Direct Storage Usages:**
  - `storage.getPatients().find(p => p.id === patientId)`
  - `storage.getChiefComplaint(patientId)`
  - `storage.getFindings(patientId)`
- **Derived Data:**
  - `linkedFindingIds`: Extracted from the provided `plan.stages`.
  - `linkedFindings`: Filtered from `storage.getFindings` matching the IDs.
  - `additionalFindings`: Unlinked findings with recommendations or "observing" status, acting as additional risk/advisory notes.
- **Presentation:** Displays patient info, chief complaint, plan stages, and a static `IMPORTANT_NOTE`.

## 6. Storage Dependency Map
Currently, the preview component is entirely bound to the synchronous legacy `storage.ts` API. This prevents true data decoupling and asynchronous state management.

## 7. Risk Analysis
- **Read-Only Persistence Risk: Low/Medium.** The component does not mutate data, meaning it cannot break application state.
- **Patient-Facing Document Correctness Risk: Medium.** It builds a comprehensive cross-domain document. If data is stale, the patient or staff might see incorrect treatment timelines or mismatched recommendations.

## 8. Cleanup Option Analysis

### Option A — Parent-provided preview data via existing hooks (Recommended)
- `TreatmentPlansTab` uses `usePatientsCollection` (or `usePatientProfile`) and `useChiefComplaint` to load the patient and complaint data.
- The tab already possesses `findings`.
- `TreatmentPlansTab` passes `patient`, `chiefComplaint`, and `findings` to `TreatmentPlanPatientPreview`.
- **Why it's best:** Completely decouples the presentation layer from data fetching. Ensures synchronization since the parent already orchestrates all related hook states.

### Option B — TreatmentPlanPatientPreview uses hooks directly
- The modal imports the necessary hooks itself.
- **Why it's less ideal:** Blurs the line between dumb presentation components and smart container components, especially for a strictly read-only preview.

### Option C — Leave preview legacy for now
- **Why it's rejected:** Delays the completion of the Treatment Plans module migration.

### Option D — Migrate preview plus PatientCardPage summary/global sync
- **Why it's rejected:** Scope creep. PatientCardPage summary behavior is an overarching dashboard concern, not isolated to the treatment plan preview.

## 9. Recommended Next Implementation Boundary
**ARCH-060 — Refactor TreatmentPlanPatientPreview to storage-free read-only component via parent-provided data, no PatientCardPage/global refresh changes.**

## 10. Proposed ARCH-060 Allowed/Disallowed Files

**Allowed Files:**
- `src/components/treatment/TreatmentPlansTab.tsx`
- `src/components/treatment/TreatmentPlanPatientPreview.tsx`
- `_ai_work/REPORTS/ARCH-060_treatment_plan_patient_preview_readonly_cleanup_report.md`

**Forbidden Files:**
- `src/components/treatment/TreatmentPlanModal.tsx`
- `src/components/treatment/CreatePlanFromFindingsModal.tsx`
- `src/components/dental/DentalChartTab.tsx`
- `src/components/dental/FindingsRisksTab.tsx`
- `src/pages/PatientCardPage.tsx`
- Hooks, repositories, orchestrators, aggregators, `storage.ts`, types, tests, backend, configs, routes.

## 11. Patient/Chief Complaint Data Source Decision
- `TreatmentPlansTab` will utilize existing hooks (`usePatientsCollection` / `useChiefComplaint`) to acquire the `patient` and `chiefComplaint` objects.
- These objects will be injected as props into `TreatmentPlanPatientPreview`.

## 12. PatientCardPage / Summary Refresh Decision
- The overarching `PatientCardPage` dashboard remains untouched.
- No global event bus or Context-based sync will be introduced.
- The existing behavior (refresh upon re-entry to the overview tab) stands.

## 13. RESEARCH-003 Interaction Note
- Domain model v2 (RESEARCH-003) remains strictly documentation.
- The current MVP DTOs and properties must be used.

## 14. What Must NOT Be Changed Next
- Do NOT implement global state.
- Do NOT rewrite orchestrators or existing hooks.
- Do NOT change `PatientCardPage.tsx`.
- Do NOT change backend schema.

## 15. Acceptance Criteria for ARCH-060
- `TreatmentPlanPatientPreview` is completely decoupled from `storage.ts`.
- It relies entirely on props (`patient`, `chiefComplaint`, `findings`, `plan`) passed from `TreatmentPlansTab`.
- No new UI libraries, global state, or `any` assertions are introduced.
- Existing tests, linting, and builds pass.

## 16. Recommended Next Task
**ARCH-060 — Refactor TreatmentPlanPatientPreview to storage-free read-only component via parent-provided data, no PatientCardPage changes.**
