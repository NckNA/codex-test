# ARCH-042: Remaining UI Storage & Clinical Boundary Review

## 1. Title
ARCH-042 — Full remaining UI direct storage dependency map and clinical boundary review

## 2. Scope
This document audits the remaining direct dependencies on `storage.ts` within the UI layer, specifically focusing on the complex clinical and treatment domains. It classifies the risk levels of these usages, maps cross-domain dependencies, and recommends the safest boundary for the next architectural design phase.

## 3. Inputs Reviewed
- `_ai_work/REPORTS/ARCH-041_review_schedule_storage_decoupling_and_next_gate.md`
- `_ai_work/REPORTS/FIX-CONFIG-001_restore_tailwind_postcss_configs_report.md`
- `src/components/dental/DentalChartTab.tsx`
- `src/components/dental/FindingModal.tsx`
- `src/components/dental/FindingsRisksTab.tsx`
- `src/components/treatment/CreatePlanFromFindingsModal.tsx`
- `src/components/treatment/TreatmentPlanModal.tsx`
- `src/components/treatment/TreatmentPlanPatientPreview.tsx`
- `src/components/treatment/TreatmentPlansTab.tsx`
- `src/components/layout/Header.tsx`

## 4. Current Architecture Baseline
- `SchedulePage` and `AppointmentModal` are fully decoupled from direct storage.
- `PatientsPage` and `PatientCardPage` use the DAL/hook pattern.
- Tailwind and PostCSS configuration files have been successfully restored.
- Build and lint pass with 0 errors and 0 warnings.

## 5. Schedule/Patient Domain Status
The top-level pages for Patient Management and Schedule Management are safely abstracted behind repositories and hooks. They no longer contain synchronous reads/writes to local storage.

## 6. Remaining Direct Storage Usage Map
The following UI files in `src/` still directly import `storage.ts`:
- `src/components/layout/Header.tsx`
- `src/components/dental/DentalChartTab.tsx`
- `src/components/dental/FindingModal.tsx`
- `src/components/dental/FindingsRisksTab.tsx`
- `src/components/treatment/CreatePlanFromFindingsModal.tsx`
- `src/components/treatment/TreatmentPlanModal.tsx`
- `src/components/treatment/TreatmentPlanPatientPreview.tsx`
- `src/components/treatment/TreatmentPlansTab.tsx`

## 7. Acceptable Internal DAL Storage Usage
These files are allowed to import `storage.ts` directly as they form the underlying abstraction layer:
- `src/utils/storage.ts`
- `src/data/repositories/*`
- `src/data/aggregators/*`
- `src/main.tsx` (Application seeding)

## 8. Remaining Risky UI Storage Usage
The following components represent technical debt due to synchronous reads/writes and cross-domain logic tightly coupled to the UI.

### Dental Chart Domain
- **`DentalChartTab.tsx`**: 
  - **Reads**: `getDentalChart`, `getFindings`
  - **Writes**: `saveDentalChart`, `updateFinding`, `addFinding`
  - **Risk**: High. Contains complex cross-domain mutation logic (saving a tooth status automatically creates or updates related findings).

### Findings & Risks Domain
- **`FindingsRisksTab.tsx`**:
  - **Reads**: `getFindings`
  - **Writes**: `deleteFinding`, `updateFinding`
  - **Risk**: High. Direct CRUD logic.
- **`FindingModal.tsx`**:
  - **Writes**: `updateFinding`, `addFinding`
  - **Risk**: High. Direct mutations.

### Treatment Plans Domain
- **`TreatmentPlansTab.tsx`**:
  - **Reads**: `getTreatmentPlans`
  - **Writes**: `updateTreatmentPlan`, `addTreatmentPlan`, `deleteTreatmentPlan`
  - **Risk**: High. Direct CRUD logic.
- **`TreatmentPlanModal.tsx`**:
  - **Reads**: `getFindings`
  - **Risk**: Medium/High. Reads findings directly inside the component body on every render loop.
- **`TreatmentPlanPatientPreview.tsx`**:
  - **Reads**: `getPatients`, `getChiefComplaint`, `getFindings`
  - **Risk**: Medium. Read-only, but performs synchronous joins across four separate domains (patients, complaints, findings, plans).
- **`CreatePlanFromFindingsModal.tsx`**:
  - **Reads**: `getFindings`, `getTreatmentPlans`
  - **Writes**: `addTreatmentPlan`, `updateFinding`
  - **Risk**: Very High. Iterates over findings, generates a plan, saves the plan, and then performs batch updates on finding statuses—all tightly coupled within a React component.

## 9. Header Storage Usage Review
- **`Header.tsx`**:
  - **Reads**: `getDoctors`
  - **Risk**: Low. Read-only usage for building a UI filter. This is safe to defer.

## 10. Cross-Domain Clinical Flow Analysis
The clinical modules are highly interdependent. Refactoring one repository in isolation without a broader strategy will lead to massive breakage in cross-domain flows. Key flows include:
1. **Tooth status changes** -> automatically generate/update findings (`DentalChartTab`).
2. **Generating Treatment Plans** -> reads findings, creates a plan, and mutates finding statuses back to 'included_in_plan' (`CreatePlanFromFindingsModal`).
3. **Clinical Summary** -> aggregating all these events into the patient profile via `ClinicalSummaryAggregator`.

## 11. Risk Ranking of Remaining UI Storage Users
1. **Very High**: `CreatePlanFromFindingsModal` (Cross-domain batch mutations)
2. **High**: `DentalChartTab` (Cross-domain mutations), `TreatmentPlansTab`, `FindingsRisksTab`, `FindingModal`
3. **Medium**: `TreatmentPlanModal`, `TreatmentPlanPatientPreview`
4. **Low**: `Header`

## 12. Boundary Options
- **Option A**: Migrate Header read-only storage usage next. *(Rejected: Low impact)*
- **Option B**: Add unit tests for existing aggregators. *(Rejected: Tests are valuable, but the clinical boundaries are undefined and pose immediate architectural risk)*
- **Option C**: Design DentalChart DAL boundary first. *(Rejected: Too narrow. Dental chart mutations affect findings, which affect treatment plans)*
- **Option F**: Create one large ClinicalRepository and migrate all clinical modules. *(Rejected: Violates single responsibility, creates a god-object, extremely high risk for bugs)*
- **Option G**: Create full clinical data boundary design covering Dental + Findings + Treatment before any implementation. *(Recommended)*

## 13. Options Comparison
Creating a massive `ClinicalRepository` would be an anti-pattern. Migrating piecemeal (e.g., just `DentalChartTab`) without understanding the cross-domain write dependencies (like updating findings) will break the app. 

The only safe approach is a **design-first mapping** (Option G). We must define the exact contracts for `DentalChartRepository`, `FindingsRisksRepository`, and `TreatmentPlansRepository`, and decide how cross-domain flows (like creating a plan from findings) will be orchestrated (e.g., via a `ClinicalOrchestrator` or specialized hooks) before touching any React code.

## 14. Recommended Next Architecture Gate
**ARCH-043 — Design clinical DAL boundary map for Dental/Findings/Treatment before implementation.**

## 15. What Must NOT be Changed Next
- Do **NOT** migrate clinical UI modules immediately.
- Do **NOT** write implementation code for the clinical DAL.
- Do **NOT** create a massive `ClinicalRepository` god-object.
- Do **NOT** introduce global state (Redux/Zustand/React Query).
- Do **NOT** build new product features.

## 16. Acceptance Criteria for ARCH-043
- Produce a markdown design document detailing the exact method signatures for:
  - `DentalChartRepository`
  - `FindingsRisksRepository`
  - `TreatmentPlansRepository`
- Produce a clear strategy for handling the two major cross-domain flows:
  - `DentalChartTab` updating finding statuses.
  - `CreatePlanFromFindingsModal` creating a plan and updating finding statuses.
- Define how `useAsyncQuery`/`useAsyncMutation` wrappers will be structured for these domains.
- No `src/` code is modified during the design phase.

## 17. Recommended Next Task
**ARCH-043 — Design clinical DAL boundary map for Dental/Findings/Treatment before implementation.**

---

### Explicit Architecture Questions Answered
- **Is ARCH-042 implementation or review/design?** Review/design only.
- **Should src/ code be changed in ARCH-042?** No.
- **Are SchedulePage and AppointmentModal fully decoupled from direct storage?** Yes.
- **Is Tailwind/PostCSS config restored?** Yes.
- **Which direct storage usages remain in UI?** Header, DentalChartTab, FindingModal, FindingsRisksTab, CreatePlanFromFindingsModal, TreatmentPlanModal, TreatmentPlanPatientPreview, TreatmentPlansTab.
- **Which direct storage usages are acceptable internal DAL usage?** Repositories, aggregators, `storage.ts`, and `main.tsx`.
- **Which remaining UI storage usages are high risk?** `CreatePlanFromFindingsModal` (Very High), `DentalChartTab`, `TreatmentPlansTab`, `FindingsRisksTab`, `FindingModal`.
- **Which remaining UI storage usage is low risk?** `Header.tsx`.
- **Are clinical write-heavy modules safe to migrate immediately?** No.
- **Should Header be migrated before clinical modules?** No, the technical debt there is benign.
- **Should aggregator/hook tests be introduced before clinical implementation?** Tests are good, but designing the clinical boundary is a higher architectural priority to unlock future work safely.
- **Should new features be started now?** No.
- **Should ARCH-043 be design-only?** Yes.
- **What exactly should ARCH-043 do?** Design the repository contracts and cross-domain orchestrator hooks for the complex Dental/Findings/Treatment modules without writing implementation code.
