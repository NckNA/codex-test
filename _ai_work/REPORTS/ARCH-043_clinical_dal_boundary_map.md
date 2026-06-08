# ARCH-043: Clinical DAL Boundary Map

## 1. Title
ARCH-043 — Design clinical DAL boundary map for Dental/Findings/Treatment before implementation.

## 2. Scope
This document defines the Data Access Layer (DAL) boundaries for the clinical domains: Dental Chart, Findings/Risks, and Treatment Plans. It outlines repository contracts, hook interfaces, cross-domain orchestration strategies, and establishes a safe implementation sequence that mitigates the high risks identified in ARCH-042.

## 3. Inputs Reviewed
- `_ai_work/REPORTS/ARCH-042_remaining_ui_storage_and_clinical_boundary_review.md`
- Previous architecture and aggregator reports (`ARCH-016`, `ARCH-017`, `ARCH-018`)
- Current clinical UI component source code

## 4. Current Baseline
- `SchedulePage` and Patient domains are successfully decoupled from direct `storage.ts` imports.
- Tailwind and PostCSS configurations are restored and functioning correctly.
- All high-risk synchronous direct storage mutations are concentrated in the clinical React components.

## 5. Clinical Domain Map

### A. Dental Chart Domain
- **UI Files**: `DentalChartTab.tsx`
- **Current Storage**: `getDentalChart`, `saveDentalChart`, `getFindings`, `addFinding`, `updateFinding`
- **Risk if migrated blindly**: High. The component automatically generates or updates findings when a tooth status changes. Hiding this logic inside a simple `DentalChartRepository` would violate the Single Responsibility Principle and create dangerous invisible side-effects.

### B. Findings/Risks Domain
- **UI Files**: `FindingsRisksTab.tsx`, `FindingModal.tsx`
- **Current Storage**: `getFindings`, `addFinding`, `updateFinding`, `deleteFinding`
- **Risk if migrated blindly**: High. Direct CRUD operations. Finding statuses (`included_in_plan`, etc.) represent the state machine of the patient's treatment and must not be corrupted.

### C. Treatment Plans Domain
- **UI Files**: `TreatmentPlansTab.tsx`, `TreatmentPlanModal.tsx`, `CreatePlanFromFindingsModal.tsx`
- **Current Storage**: `getTreatmentPlans`, `addTreatmentPlan`, `updateTreatmentPlan`, `deleteTreatmentPlan`, `getFindings`, `updateFinding`
- **Risk if migrated blindly**: Very High. `CreatePlanFromFindingsModal` contains a massive cross-domain flow: it generates a plan, saves it, and batch-updates the related findings.

### D. Patient Clinical Preview/Summary Domain
- **UI Files**: `TreatmentPlanPatientPreview.tsx`, `ClinicalSummaryAggregator.ts`
- **Current Storage**: `getPatients`, `getChiefComplaint`, `getFindings`, `getTreatmentPlans`
- **Risk if migrated blindly**: Medium. These are read-only but perform synchronous, heavy joins across four domains.

## 6. Repository Boundary Design
Each domain will have a dedicated repository. Repositories will **strictly** manage their own data and will **not** orchestrate cross-domain updates.

### 1. DentalChartRepository
Responsible solely for the patient's tooth status grid.
```typescript
interface DentalChartRepository {
  getDentalChart(patientId: string): Promise<DentalChart | null>;
  saveDentalChart(patientId: string, chart: DentalChart): Promise<void>;
}
```
*Note: It will not create or update findings. That is an orchestrator responsibility.*

### 2. FindingsRepository
Responsible for findings and risks. The name `FindingsRepository` is chosen because the underlying data model is `DentalFinding` (which encompasses both problems and risks).
```typescript
interface FindingsRepository {
  listFindingsByPatient(patientId: string): Promise<DentalFinding[]>;
  createFinding(patientId: string, finding: Omit<DentalFinding, 'id' | 'patientId' | 'createdAt' | 'updatedAt'>): Promise<void>;
  updateFinding(patientId: string, finding: DentalFinding): Promise<void>;
  deleteFinding(patientId: string, findingId: string): Promise<void>;
}
```

### 3. TreatmentPlansRepository
Responsible strictly for treatment plans and stages.
```typescript
interface TreatmentPlansRepository {
  listTreatmentPlansByPatient(patientId: string): Promise<TreatmentPlan[]>;
  createTreatmentPlan(patientId: string, plan: TreatmentPlan): Promise<void>;
  updateTreatmentPlan(patientId: string, plan: TreatmentPlan): Promise<void>;
  deleteTreatmentPlan(patientId: string, planId: string): Promise<void>;
}
```
*Note: `createPlanFromFindings` will not live here as it mutates findings.*

### 4. TreatmentPlanPatientPreviewAggregator
A read-only aggregator to replace the massive synchronous joins in the preview modal.
```typescript
interface TreatmentPlanPatientPreviewAggregator {
  getPreviewData(patientId: string, planId: string): Promise<{
    patient: Patient | null;
    chiefComplaint: ChiefComplaint | null;
    linkedFindings: DentalFinding[];
    additionalFindings: DentalFinding[];
    plan: TreatmentPlan;
  }>;
}
```

## 7. Cross-Domain Orchestrator Design
To prevent UI components from becoming God-objects and to keep Repositories pure, we introduce a `ClinicalWorkflowOrchestrator` (or `ClinicalMutationService`).

```typescript
interface ClinicalWorkflowOrchestrator {
  // Handles DentalChartTab logic: saves chart, then creates/updates the finding
  applyToothStatusChange(
    patientId: string, 
    chart: DentalChart, 
    findingPayload: Partial<DentalFinding> | null
  ): Promise<void>;

  // Handles CreatePlanFromFindingsModal logic: creates plan, batch-updates findings
  createTreatmentPlanFromFindings(
    patientId: string, 
    selectedFindings: DentalFinding[], 
    planDraft: TreatmentPlan
  ): Promise<void>;
}
```

## 8. Hook Boundary Design
Hooks will wrap the repositories and the orchestrator, utilizing the `useAsyncQuery` and manual mutation patterns established in previous ARCH tasks.

### 1. `useDentalChart(patientId: string)`
- `chart`, `isLoading`, `isError`, `error`, `refetch`
- `saveDentalChart`, `isSaving`, `saveError`

### 2. `usePatientFindings(patientId: string)`
- `findings`, `isLoading`, `isError`, `error`, `refetch`
- `createFinding`, `updateFinding`, `deleteFinding`, `isSaving`, `saveError`

### 3. `useTreatmentPlans(patientId: string)`
- `treatmentPlans`, `isLoading`, `isError`, `error`, `refetch`
- `createTreatmentPlan`, `updateTreatmentPlan`, `deleteTreatmentPlan`, `isSaving`, `saveError`

### 4. `useClinicalWorkflow(patientId: string)`
- `applyToothStatusChange`, `createTreatmentPlanFromFindings`
- `isSaving`, `saveError`

## 9. Refresh/Refetch Strategy Options
Because we are not introducing a global cache (like React Query), we must be careful about stale data.
- **Strategy**: When a cross-domain mutation occurs (e.g., `createTreatmentPlanFromFindings`), the UI must trigger a `refetch()` on the affected hooks (e.g., `usePatientFindings` and `useTreatmentPlans`). 
- **Implementation**: The hooks will expose `refetch`. The React components handling the modals will `await` the orchestrator mutation, and then `await refetch()` for the required hooks before closing the modal, exactly as implemented in `SchedulePage` during ARCH-038.

## 10. Future Implementation Sequence
Given the high risk of breaking the application, implementation must be strictly phased:

- **ARCH-044**: Implement Clinical Repositories (`DentalChartRepository`, `FindingsRepository`, `TreatmentPlansRepository`) and the `ClinicalWorkflowOrchestrator` as pure TS classes/functions. **No React/UI integration.**
- **ARCH-045**: Implement the React hooks (`useDentalChart`, `usePatientFindings`, `useTreatmentPlans`, `useClinicalWorkflow`). **No React/UI integration.**
- **ARCH-046**: Integrate read-only previews and simple CRUD (`TreatmentPlansTab`, `FindingsRisksTab`).
- **ARCH-047**: Integrate complex orchestrator flows (`CreatePlanFromFindingsModal`, `DentalChartTab`).

## 11. Risk Ranking
1. Implementing UI integration simultaneously with repository creation. *(Highest Risk)*
2. Allowing repositories to trigger cross-domain side-effects. *(High Risk)*
3. Implementing repositories and orchestrators as isolated TS files first. *(Safest)*

## 12. What Must NOT be Changed Next
- Do **NOT** integrate hooks into React UI components.
- Do **NOT** create new React hooks yet.
- Do **NOT** modify `src/components/*`.
- Do **NOT** introduce global caching or state management.

## 13. Acceptance Criteria for ARCH-044
- `src/data/repositories/DentalChartRepository.ts` created.
- `src/data/repositories/FindingsRepository.ts` created.
- `src/data/repositories/TreatmentPlansRepository.ts` created.
- `src/data/orchestrators/ClinicalWorkflowOrchestrator.ts` created.
- All new files strictly use `storage.ts` for operations, adhering to the designed contracts.
- **Zero changes** to UI components or existing hooks.
- `npm run build` and `npm run lint` pass with 0 warnings.

## 14. Recommended Next Task
**ARCH-044 — Implement clinical repositories and orchestrator (no UI integration).**
