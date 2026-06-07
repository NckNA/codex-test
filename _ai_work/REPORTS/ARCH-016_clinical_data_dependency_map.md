# ARCH-016: Clinical Data Dependency Map

## 1. Scope
This report maps the data dependencies across the complex medical modules (`DentalChart`, `Findings/Risks`, `TreatmentPlans`, `PatientOverview`, `PatientCardPage`, `Schedule`) to safely plan the next DAL (Data Access Layer) migration phase.

## 2. Inputs Reviewed
- `_ai_work/REPORTS/ARCH-015_review_chief_complaint_refactor_and_next_boundary.md`
- `src/components/dental/DentalChartTab.tsx`
- `src/components/dental/FindingsRisksTab.tsx`
- `src/components/treatment/TreatmentPlansTab.tsx`
- `src/components/patients/patient-card/PatientOverviewTab.tsx`
- `src/pages/PatientCardPage.tsx`
- `src/utils/storage.ts`

## 3. Current Migrated DAL/Hook Baseline
- **ChiefComplaint:** Partly migrated. Reads via `useAsyncQuery`, writes via manual wrapper.
- **Appointments:** Read-only migrated for history (`usePatientAppointments`). Write flow still uses raw `storage.ts`.
- **Doctors:** Migrated (`useClinicDoctors`).
- **Utilities:** `useAsyncQuery` and `useAsyncMutation` available.

## 4. Domain Dependency Map
```text
[ChiefComplaint] ---------+
                          |
[DentalChart] ------------+---> [Findings/Risks] ---> [TreatmentPlans] ---> (Patient Preview)
      |                                |                      |
      |                                |                      |
      +--------------------------------+----------------------+---> [PatientOverviewTab Summary]
      |                                |                      |
      +--------------------------------+----------------------+---> [PatientCardPage Summary]
                                                                        ^
[Appointments/Schedule] ------------------------------------------------+
```

## 5. Domain-by-Domain Analysis

### 1. ChiefComplaint
- **Source of Truth:** Itself (Storage key: `df_chief_complaints`).
- **Storage functions used:** `getChiefComplaint`, `saveChiefComplaint`.
- **Current direct readers:** `useChiefComplaint` hook.
- **Current writers/mutators:** `useChiefComplaint` hook.
- **Derived consumers:** `FindingsRisksTab` (to generate related findings), `PatientCardPage` (summary calculation), `PatientOverviewTab` (display).
- **Existing migrated DAL/hook status:** Migrated via `useChiefComplaint` + `useAsyncQuery`.
- **Couplings:** `FindingsRisksTab` creates Findings based on `ChiefComplaint`.
- **Migration risk level:** Low (Already done).

### 2. DentalChart / Tooth states
- **Source of Truth:** Itself (Storage key: `df_dental_charts`).
- **Storage functions used:** `getDentalChart`, `saveDentalChart`.
- **Current direct readers:** `DentalChartTab`, `PatientCardPage`.
- **Current writers/mutators:** `DentalChartTab` (clicking a tooth and saving status, text complaints/diagnosis).
- **Derived consumers:** `PatientCardPage` summary (`needsTreatment`, `missing`), `PatientOverviewTab`.
- **Existing migrated DAL/hook status:** Not migrated. Uses direct `storage.ts`.
- **Couplings:** When a tooth is mutated in `DentalChartTab`, it simultaneously creates or updates `Findings` via `storage.addFinding`/`storage.updateFinding`. High coupling.
- **Migration risk level:** High.
- **Safe migration notes:** Cannot migrate `DentalChart` without safely managing the synchronous side-effect that creates `Findings`.

### 3. Findings / Risks / Problems
- **Source of Truth:** Itself (Storage key: `df_dental_findings`), but heavily influenced by `DentalChart`.
- **Storage functions used:** `getFindings`, `addFinding`, `updateFinding`, `deleteFinding`.
- **Current direct readers:** `FindingsRisksTab`, `DentalChartTab`, `TreatmentPlansTab`, `PatientCardPage`.
- **Current writers/mutators:** `FindingsRisksTab`, `DentalChartTab` (implicit creation).
- **Derived consumers:** `TreatmentPlansTab` (reads them to build plans), `PatientCardPage` (summary calculations).
- **Existing migrated DAL/hook status:** Not migrated.
- **Couplings:** Lifecycle statuses (`discovered`, `included_in_plan`) determine visibility and plan generation.
- **Migration risk level:** High.
- **Safe migration notes:** Changing Findings logic risks breaking the "Create Plan from Findings" pipeline.

### 4. TreatmentPlans
- **Source of Truth:** Itself (Storage key: `df_treatment_plans`).
- **Storage functions used:** `getTreatmentPlans`, `addTreatmentPlan`, `updateTreatmentPlan`, `deleteTreatmentPlan`.
- **Current direct readers:** `TreatmentPlansTab`, `PatientCardPage`.
- **Current writers/mutators:** `TreatmentPlansTab`.
- **Derived consumers:** `PatientCardPage` summary (`activePlans`, `totalAmount`), `PatientOverviewTab`.
- **Existing migrated DAL/hook status:** Not migrated.
- **Couplings:** Relies on Findings for generation.
- **Migration risk level:** High.

### 5. PatientOverview / Medical Summary
- **Source of Truth:** Derived exclusively. Does not own data.
- **Current direct readers:** N/A (Displays data).
- **Current writers/mutators:** None (Read-only component).
- **Derived from:** `Patient`, `DentalSummary` (passed from `PatientCardPage`), `Appointments`.
- **Migration risk level:** Low.

### 6. PatientCardPage Summaries
- **Source of Truth:** Derived exclusively.
- **Current direct readers:** Calculates `dentalSummary` from raw storage.
- **Current writers/mutators:** None.
- **Derived from:** `storage.getDentalChart`, `storage.getTreatmentPlans`, `storage.getChiefComplaint`, `storage.getFindings`.
- **Migration risk level:** Medium.
- **Safe migration notes:** Moving the inline raw storage calls into a selector hook is extremely safe since it performs no mutations.

### 7. Appointments / Schedule
- **Source of Truth:** Itself (`df_appointments`).
- **Storage functions used:** `getAppointments`.
- **Derived consumers:** `PatientCardPage` uses them to calculate `lastVisit` and `nextVisit`.
- **Migration risk level:** Medium.

## 6. Sources of Truth Analysis
- **Owners:** `ChiefComplaint`, `DentalChart`, `Findings`, `TreatmentPlans`, `Appointments`. These manage actual persisted JSON data.
- **Consumers:** `PatientOverviewTab`, `PatientCardPage` summary variables (`dentalSummary`, `lastVisit`, `nextVisit`). These must never own duplicated state.

## 7. High-Risk Couplings
1. **DentalChart -> Findings:** `DentalChartTab` manually calls `storage.addFinding`/`updateFinding` when saving a tooth state. If we migrate DentalChart to a remote API/Hook, we must ensure Findings are simultaneously updated.
2. **Findings -> TreatmentPlans:** Plans are generated from Findings. Statuses must match.
3. **Cross-Domain Summaries:** `PatientCardPage` reads from 5 different storage buckets synchronously in a `useMemo`. When these domains become async, the summary calculation must elegantly handle loading states without flashing.

## 8. Remaining Direct Storage Access
- `DentalChartTab.tsx`
- `FindingsRisksTab.tsx`
- `TreatmentPlansTab.tsx`
- `PatientCardPage.tsx` (Summary aggregation)

## 9. Migration Options Comparison
| Option | Strategy | Assessment |
| :--- | :--- | :--- |
| **Option A** | Migrate `DentalChart` first | Dangerous. Will break the synchronous creation of `Findings`. |
| **Option B** | Migrate `Findings` first | Dangerous. `DentalChart` still expects to write Findings synchronously. |
| **Option C** | Migrate `TreatmentPlans` first | Risky. Treatment plans heavily rely on `Findings` arrays. |
| **Option D** | Create a `read-only` Summary Hook | **Safest**. Migrating the `PatientCardPage` aggregation logic into a read-only hook removes raw storage reads without touching any mutations. |

## 10. Recommended Next Step
**ARCH-017 — Design read-only ClinicalSummaryAggregator / usePatientMedicalSummary contract before migrating write-heavy clinical modules.**

## 11. Why This Next Step Is Safest
`PatientCardPage` currently reads from all domains synchronously via `storage.ts`. If we migrate `DentalChart` to be async, `PatientCardPage` will break. By creating a unified `usePatientMedicalSummary` hook first, we can encapsulate the complexity of loading multiple async domains into one place. Since it is entirely read-only derived data, it carries zero risk of corrupting clinical records.

## 12. What Must NOT Be Migrated Yet
Do not migrate `DentalChartTab`, `FindingsRisksTab`, or `TreatmentPlansTab` mutations until the read-only summary layer is in place.

## 13. Acceptance Criteria for Future ARCH-017
- Inspect `PatientCardPage.tsx` and `PatientOverviewTab.tsx`.
- Design a `usePatientMedicalSummary` hook architecture.
- Document the return shape of the aggregator.
- Do NOT implement the aggregator in `src/`.
- Do NOT change `storage.ts`, backend, or types.

## 14. Recommended Next Task
**ARCH-017 — Design read-only ClinicalSummaryAggregator / usePatientMedicalSummary contract before migrating write-heavy clinical modules.**
