# ARCH-020: Review Summary Hook Integration and Overview Strategy

## 1. Scope
This report evaluates the recent integration of the `usePatientMedicalSummary` hook into `PatientCardPage` (completed in ARCH-019) and defines the safest strategy for handling `PatientOverviewTab`. The main objective is to decide whether `PatientOverviewTab` should be decoupled from its parent or if the immediate focus should shift toward loading/error states within `PatientCardPage`.

## 2. Inputs Reviewed
- `_ai_work/REPORTS/ARCH-018_clinical_summary_aggregator_hook_report.md`
- `_ai_work/REPORTS/ARCH-019_integrate_patient_card_medical_summary_hook_report.md`
- `src/pages/PatientCardPage.tsx`
- `src/components/patients/patient-card/PatientOverviewTab.tsx`
- `src/data/hooks/usePatientMedicalSummary.ts`
- `src/data/aggregators/ClinicalSummaryAggregator.ts`
- `src/data/hooks/useAsyncQuery.ts`

## 3. ARCH-018 / ARCH-019 Summary
- **ARCH-018** successfully implemented `ClinicalSummaryAggregator` and the `usePatientMedicalSummary` hook, creating a pure read-only boundary over the complex clinical domains.
- **ARCH-019** successfully integrated this hook into `PatientCardPage`. The direct `storage.ts` reads for the dental chart, findings, treatment plans, and appointments (for the medical summary) were entirely removed. 

## 4. PatientCardPage Integration Review
- **Does PatientCardPage use `usePatientMedicalSummary`?** Yes.
- **Does PatientCardPage directly read clinical domains for summary?** No. All summary data now correctly flows through the hook.
- **Does PatientCardPage directly read/update the patient profile?** Yes. It still uses `storage.getPatients` and `storage.updatePatient` for the basic profile and edit modal, which is acceptable at this stage.

## 5. PatientOverviewTab Current Role
- **Was PatientOverviewTab changed?** No.
- **Is PatientOverviewTab presentational?** Yes. It cleanly accepts props (`dentalSummary`, `lastVisit`, `nextVisit`, `patient`) and renders them without executing its own side-effects or storage reads.

## 6. What Improved After ARCH-019
The top-level `PatientCardPage` component is now fully decoupled from the internal data schemas of the clinical modules (teeth arrays, finding statuses, etc.). It acts purely as a coordinator, receiving a standardized interface (`PatientMedicalSummaryData`) from the domain layer.

## 7. Remaining Risks and Limitations
Because ARCH-019 focused solely on *passing data*, it deliberately ignored the asynchronous `isLoading` and `isError` states exposed by `usePatientMedicalSummary`. This means the application currently relies on a silent "flash" of empty fallback data if the hook takes time to resolve. Additionally, there are no cross-tab refetch triggers to ensure the summary updates immediately when sibling tabs mutate data.

## 8. PatientOverviewTab Decoupling Options
- **Option A**: Keep `PatientOverviewTab` presentational for now (orchestrated by `PatientCardPage`).
- **Option B**: Move `usePatientMedicalSummary` directly into `PatientOverviewTab` to make it self-fetching.
- **Option C**: Split `PatientOverviewTab` into smaller subcomponents but maintain the prop-drilling approach.
- **Option D**: Add minimal loading/error UI directly to `PatientCardPage` where the hook is currently consumed.
- **Option E**: Introduce global state/events for immediate cross-tab synchronization.
- **Option F**: Proceed straight to migrating write-heavy clinical modules (`DentalChartTab`, `FindingsRisksTab`, `TreatmentPlansTab`).

## 9. Options Comparison
- **Option B** (Moving the hook to the tab) would duplicate data-fetching responsibilities, as `PatientCardPage` might still need summary data for sibling tabs or overall routing decisions.
- **Option E & F** introduce high architectural risk before stabilizing the read layer's user experience.
- **Option A & D** (Keeping the tab presentational and handling async states at the parent) respects React's downward data flow and addresses the most immediate UX risk (unhandled loading/error states) without touching heavy business logic.

## 10. Recommended Direction
The preferred direction is a combination of **Option A** and **Option D**: keep the tab presentational and orchestrate async behavior at the parent page level.

## 11. Why PatientOverviewTab Should Not Be Decoupled Now
`PatientOverviewTab` currently acts as a clean, dumb display component. Moving the data-fetching hook inside it weakens `PatientCardPage`'s role as the primary orchestrator of the patient view. If `PatientCardPage` loses awareness of the summary state, coordinating global loading states or sharing the summary with other future tabs becomes more difficult.

## 12. Recommended Next Task
**ARCH-021 — Add minimal medical summary loading/error handling in PatientCardPage, while keeping PatientOverviewTab presentational.**

## 13. Acceptance Criteria for Future ARCH-021
- **PatientCardPage only**: Changes must be isolated to the parent page.
- **Use Async States**: Consume `isLoading`, `isError`, and `error` from `usePatientMedicalSummary`.
- **Non-Invasive UI**: Add minimal loading/error boundaries (e.g., small inline loaders or error boundaries) so the overall page layout doesn't jump drastically.
- **Preserve Props**: Do not change `PatientOverviewTab` props.
- **No Refactoring of Tab**: Do not alter `PatientOverviewTab.tsx` internals.
- **No Mutation Changes**: Do not touch clinical mutation tabs.
- **No Architecture Changes**: Do not change storage, types, backend, or dependencies.

## 14. What Must NOT Be Changed Next
- Should write-heavy modules be migrated next? **No.**
- Should cross-tab refetch triggers be introduced immediately? **No.**
- Should `PatientOverviewTab` be changed? **No.**
