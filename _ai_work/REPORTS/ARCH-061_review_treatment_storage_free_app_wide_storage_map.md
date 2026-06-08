# ARCH-061: Review Treatment Plans Full Storage Decoupling and App-Wide Storage Map

## 1. Title
ARCH-061 — Review Treatment Plans full storage decoupling and map remaining app-wide direct storage dependencies

## 2. Scope
This report documents the successful culmination of the UI-level `storage.ts` decoupling within the Treatment Plans module. It subsequently audits the entire codebase to locate remaining legacy dependencies on `storage.ts`, categorizes them by risk layer, and defines the next safe migration slice.

## 3. Inputs Reviewed
- `_ai_work/REPORTS/ARCH-056_treatmentplans_tab_hooks_integration_report.md`
- `_ai_work/REPORTS/ARCH-057_review_create_plan_from_findings_workflow_boundary.md`
- `_ai_work/REPORTS/ARCH-058_create_plan_from_findings_workflow_integration_report.md`
- `_ai_work/REPORTS/ARCH-059_review_treatment_preview_readonly_boundary.md`
- `_ai_work/REPORTS/ARCH-060_treatment_plan_patient_preview_readonly_cleanup_report.md`
- Code search across `src` for `storage.ts` imports and usages.

## 4. Treatment Plans Decoupling Verification
All treatment UI components are successfully decoupled from direct `storage.ts` imports and calls:

| Component | Direct Import? | Direct Calls? | Current Data Source / Orchestration | Risk Level |
| :--- | :---: | :---: | :--- | :--- |
| **`TreatmentPlansTab`** | No | No | `useTreatmentPlans`, `usePatientFindings`, `useClinicalWorkflow`, `usePatientsCollection`, `useChiefComplaint` | Safe |
| **`TreatmentPlanModal`** | No | No | Props (dumb presentation component) | Safe |
| **`CreatePlanFromFindingsModal`**| No | No | Props, calls parent callback `onCreatePlanFromFindings` | Safe |
| **`TreatmentPlanPatientPreview`**| No | No | Props (purely read-only) | Safe |

**Status Confirmation:**
- Treatment Plans UI module has **zero** direct `storage.ts` imports.
- Treatment Plans UI module has **zero** direct `storage.*` calls.
- `TreatmentPlanPatientPreview` is now strictly storage-free.

*(Additionally, previously migrated components like `DentalChartTab`, `FindingsRisksTab`, `FindingModal`, and `SchedulePage` remain successfully storage-free).*

## 5. Search Methodology
The audit was conducted using ripgrep via the `grep_search` command.
Query used: `from ['\"].*utils/storage['\"]` across `src`.

## 6. App-Wide Storage Dependency Map

| File | Layer | Direct Import? | Direct Calls? | Current Role | Risk Level | Recommended Action |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| `src/utils/storage.ts` | Storage Implementation | N/A | N/A | Core LocalStorage persistence logic | Acceptable | Retain for MVP |
| `src/main.tsx` | Bootstrap / Seed | Yes | Yes | Calls `storage.seedDummyData()` for initial app load | Low | Retain |
| `src/data/repositories/*.ts` | Repository | Yes | Yes | DAL abstraction (`PatientRepository`, `TreatmentPlansRepository`, etc.) | Acceptable | Retain as intended DAL boundary |
| `src/components/layout/Header.tsx` | UI component | Yes | Yes | Reads `storage.getDoctors()` to populate dropdown filters | Medium | **Migrate next** |
| `src/data/aggregators/ClinicalSummaryAggregator.ts` | Aggregator / Read Model | Yes | Yes | Composes clinical summary cross-domain | High | Migrate to Repositories later |
| `src/data/aggregators/PatientListVisitSummaryAggregator.ts` | Aggregator / Read Model | Yes | Yes | Composes patient visit counts | Medium | Migrate to Repositories later |

*(No direct `storage` imports were found in Orchestrators or Hooks).*

## 7. Dependency Classification by Layer
- **Acceptable Boundary:** Repositories correctly abstract `storage.ts`.
- **Low Risk:** Bootstrap/demo seeding in `main.tsx`.
- **Medium Risk (UI):** `Header.tsx` directly accesses storage for UI rendering.
- **High Risk (Aggregators):** `ClinicalSummaryAggregator` and `PatientListVisitSummaryAggregator` build large complex read models synchronously bypassing the repository layer.

## 8. Remaining UI/Page Risks
The only remaining explicit direct UI dependency on `storage.ts` is in `src/components/layout/Header.tsx`.

## 9. Aggregator / Read Model Risks
Aggregators currently bypass Repositories. While technically they encapsulate cross-domain read logic, reading directly from `storage.ts` prevents caching, mocking, and future asynchronous backend integration. Migrating them carries moderate risk because it touches heavily utilized components like `PatientCardPage` and the Patient List.

## 10. Next-Slice Option Analysis

### Option A — Header doctors dependency cleanup (Recommended)
- **Scope:** Migrate `Header.tsx` to use the already existing `useClinicDoctors` hook.
- **Risk:** Low.
- **Why:** Safely eliminates the last layout-level / visible UI direct storage read without touching high-risk aggregates.

### Option B — Clinical Summary Aggregator Cleanup
- **Scope:** Convert `ClinicalSummaryAggregator` to use `Repositories`.
- **Risk:** High. Touches the core dashboard (`PatientCardPage`).

### Option C — App-Wide Storage Rewrite / Domain Model v2
- **Risk:** Very High.
- **Status:** Explicitly rejected for now.

## 11. Recommended Next Task
**ARCH-062 — Remove Header direct storage dependency via existing doctor hook/repository.**

## 12. Proposed ARCH-062 Boundary
**Allowed Files:**
- `src/components/layout/Header.tsx`
- `_ai_work/REPORTS/ARCH-062_header_doctors_storage_cleanup_report.md`

**Forbidden Files:**
- `PatientCardPage.tsx`
- Clinical/treatment components
- `SchedulePage.tsx`
- Repositories, orchestrators, aggregators, hooks.
- `storage.ts`, `types/index.ts`.
- Tests, configs, routes, backend.

## 13. What Must NOT Be Changed Next
- Broad app-wide rewrite.
- `PatientCardPage` summary refactor or global refresh changes.
- Aggregator migration (reserved for future step).
- RESEARCH-003 Domain model v2 implementation.
- Global event bus / cache introduction.

## 14. Acceptance Criteria for ARCH-062
- `Header.tsx` no longer imports `storage.ts`.
- `Header.tsx` uses `useClinicDoctors()` to load doctors.
- The dropdown functionality remains visually identical.
- No global state introduced.

## 15. Known Limitations
- Aggregators remain synchronous legacy code directly bound to `storage.ts`.
- PatientCard summary refresh logic is untouched.
- RESEARCH-003 Domain Model V2 remains documentation-only.
