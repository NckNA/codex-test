# ARCH-016: Clinical Data Dependency Map

## 1. Scope
This report maps the data dependencies, coupling, and migration risks associated with the complex medical modules (Dental Chart, Findings, Treatment Plans, and Patient Summaries). It aims to determine the safest next architectural migration boundary before further code changes are made to these modules.

## 2. Inputs Reviewed
- `_ai_work/REPORTS/ARCH-015_review_chief_complaint_refactor_and_next_boundary.md`
- `src/components/dental/DentalChartTab.tsx`
- `src/components/dental/FindingsRisksTab.tsx`
- `src/components/treatment/TreatmentPlansTab.tsx`
- `src/components/patients/patient-card/PatientOverviewTab.tsx`
- `src/pages/PatientCardPage.tsx`
- `src/pages/SchedulePage.tsx`
- `src/data/hooks/useChiefComplaint.ts`
- `src/data/repositories/ChiefComplaintRepository.ts`
- `src/data/hooks/usePatientAppointments.ts`
- `src/data/hooks/useClinicDoctors.ts`
- `src/utils/storage.ts`

## 3. Current Migrated DAL/Hook Baseline
- **Is ChiefComplaint already partly migrated?** Yes. It uses `useChiefComplaint` and `ChiefComplaintRepository`.
- **Are Appointments/Doctors for PatientHistory already migrated?** Yes. The read-only history flows are migrated via `usePatientAppointments` and `useClinicDoctors`.
- Shared utilities (`useAsyncQuery`, `useAsyncMutation`) are available and used by migrated hooks.

## 4. Domain Dependency Map
The clinical modules do not exist in isolation. They form a highly coupled network where changes in one domain (e.g., Dental Chart) often propagate directly to others (e.g., Findings, and subsequently Treatment Plans). The overview tabs (e.g., `PatientOverviewTab`) heavily aggregate data from all of these sources.

## 5. Domain-by-Domain Table

| Domain | Source of Truth | Storage Functions Used | Readers | Writers/Mutators | Derived Consumers | Couplings / Risks | Migration Risk |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ChiefComplaint** | `storage.getChiefComplaint` | `getChiefComplaint`, `saveChiefComplaint` (migrated) | `FindingsRisksTab`, `PatientCardPage` | `FindingsRisksTab` (via hook) | `PatientCardPage` | Findings can be flagged as `isChiefComplaintRelated`. | Low (already migrated) |
| **DentalChart** | `storage.getDentalChart` | `getDentalChart`, `saveDentalChart` | `DentalChartTab`, `PatientCardPage` | `DentalChartTab` | `PatientCardPage` (`needsTreatment`, `missing`) | Writes findings when teeth are updated. High coupling with Findings. | **High** |
| **Findings/Risks** | `storage.getFindings` | `getFindings`, `addFinding`, `updateFinding`, `deleteFinding` | `FindingsRisksTab`, `DentalChartTab`, `PatientCardPage` | `FindingsRisksTab`, `DentalChartTab` | `PatientCardPage`, `TreatmentPlansTab` | Central hub. Findings status dictates inclusion in Treatment Plans. | **High** |
| **TreatmentPlans** | `storage.getTreatmentPlans` | `getTreatmentPlans`, `addTreatmentPlan`, `updateTreatmentPlan`, `deleteTreatmentPlan` | `TreatmentPlansTab`, `PatientCardPage` | `TreatmentPlansTab` | `PatientCardPage` (`totalAmount`, `activePlans`) | Generated directly from Findings flagged `includeInTreatmentPlan`. | **High** |
| **PatientOverview** | (Derived Data) | None directly | User UI | None | None | Needs data from all domains above. | Medium |
| **PatientCardPage** | (Aggregator) | All of the above plus `getAppointments` | Internal calculation | None | `PatientOverviewTab` | Calculates `dentalSummary`, `lastVisit`, `nextVisit`. | Medium |
| **Appointments** | `storage.getAppointments` | `getAppointments`, `addAppointment`, `updateAppointment`, `deleteAppointment` | `SchedulePage`, `PatientCardPage` | `SchedulePage` | `PatientCardPage` | `PatientCardPage` uses them to calculate visits. | Medium |

## 6. Text Dependency Diagram
```text
ChiefComplaint
   |
   +---> Findings/Risks <---+
   |          |             |
   |          v             |
   |     TreatmentPlans     |
   |          |             |
   v          v             |
PatientCardPage Summary <---+--- DentalChart
   ^
   |
Appointments
```

*Data flow description:*
- `DentalChart` mutations can automatically generate `Findings/Risks`.
- `ChiefComplaint` influences `Findings/Risks` (complaint-related flags).
- `Findings/Risks` marked for treatment generate `TreatmentPlans`.
- `PatientCardPage` (and `PatientOverviewTab`) aggregates data from `ChiefComplaint`, `DentalChart`, `Findings/Risks`, `TreatmentPlans`, and `Appointments` to create the medical summary.

## 7. Sources of Truth Analysis
- **Sources of Truth**: 
  - `DentalChart` (owns tooth states)
  - `Findings/Risks` (owns problem lists and statuses)
  - `TreatmentPlans` (owns generated plans and stages)
  - `ChiefComplaint` (owns the complaint text/related teeth)
  - `Appointments` (owns the schedule)
- **Derived Consumers**:
  - `PatientOverviewTab` and `PatientCardPage` do not own any clinical data. They compute summaries like `needsTreatment`, `activePlans`, `totalAmount`, etc., directly from the sources of truth. They must not become owners of duplicated data.

## 8. Derived Data / Summary Analysis
The `PatientCardPage` relies heavily on reading raw storage to compute the `dentalSummary`. It loops over all teeth, findings, and plans to count conditions, active plans, and total amounts. Moving any of the underlying domain modules without first abstracting this derivation logic would result in a broken summary or massive prop-drilling complexity.

## 9. High-Risk Couplings
1. **DentalChart <-> Findings**: Saving a tooth in `DentalChartTab.tsx` directly modifies the Findings storage.
2. **Findings <-> TreatmentPlans**: Findings have an `includeInTreatmentPlan` flag. Treatment plans are assembled using findings that meet this criteria.
3. **Clinical Modules -> PatientCardPage**: The `PatientCardPage` directly reads the storage of Chart, Findings, and Plans on every render to compute its `dentalSummary` and visit history.

## 10. Remaining Direct Storage Access
The following UI components still import and use `storage.ts` directly:
- `src/components/dental/DentalChartTab.tsx`
- `src/components/dental/FindingsRisksTab.tsx`
- `src/components/treatment/TreatmentPlansTab.tsx`
- `src/pages/PatientCardPage.tsx`
- `src/pages/SchedulePage.tsx`

## 11. Migration Options Comparison
| Option | Strategy | Assessment |
| :--- | :--- | :--- |
| **Option A** | Start with DentalChart repository/hook | **High Risk**. Changes here break Findings generation and summary calculation. |
| **Option B** | Start with Findings repository/hook | **High Risk**. Coupled to Dental Chart, Chief Complaint, and Plans. |
| **Option C** | Start with TreatmentPlans repository/hook | **High Risk**. Heavily dependent on Findings. |
| **Option D** | Start with read-only MedicalSummary hook | **Safe & Recommended**. It abstracts the cross-domain derivation logic out of `PatientCardPage` without touching the mutation flows. |
| **Option E** | Create ClinicalSummaryAggregator | **Safe & Recommended**. Equivalent to Option D. Focuses on the read-only layer first. |
| **Option F** | Pause DAL migration and move to backend | Premature. The frontend needs to be decoupled before sending data to an API. |

## 12. Recommended Next Step
**ARCH-017 — Design read-only ClinicalSummaryAggregator / usePatientMedicalSummary contract before migrating write-heavy clinical modules.**

## 13. Why This Next Step Is Safest
- **Is DentalChart currently safe to migrate immediately?** No. It's tightly coupled to findings creation and summary.
- **Is Findings/Risks currently safe to migrate immediately?** No. It's the central nexus of clinical data.
- **Is TreatmentPlans currently safe to migrate immediately?** No.
- **Should a read-only ClinicalSummaryAggregator be designed before write-heavy migrations?** Yes.

By creating a `usePatientMedicalSummary` (or `ClinicalSummaryAggregator`), we can centralize all derived calculations (e.g., `needsTreatment`, `totalAmount`, `lastVisit`) behind a clean, read-only interface. This removes direct `storage` calls from `PatientCardPage` and `PatientOverviewTab`. Once the read layer is decoupled, we can safely refactor the individual write-heavy modules (Chart, Findings, Plans) one by one without breaking the patient summary.

## 14. What Must NOT Be Migrated Yet
- Do not migrate `DentalChartTab` mutations.
- Do not migrate `FindingsRisksTab` mutations.
- Do not migrate `TreatmentPlansTab` mutations.

## 15. Acceptance Criteria for Future ARCH-017
- Design a read-only hook (e.g., `usePatientMedicalSummary`) to calculate `dentalSummary`, `lastVisit`, and `nextVisit`.
- The hook must replace direct storage reads inside `PatientCardPage.tsx`.
- Which files should ARCH-017 inspect? `PatientCardPage.tsx`, `PatientOverviewTab.tsx`.
- Which files should ARCH-017 NOT change? `DentalChartTab.tsx`, `FindingsRisksTab.tsx`, `TreatmentPlansTab.tsx`, `SchedulePage.tsx`, `storage.ts`, backend APIs.

## 16. Recommended Next Task
**ARCH-017 — Design read-only ClinicalSummaryAggregator / usePatientMedicalSummary contract before migrating write-heavy clinical modules.**
