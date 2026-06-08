# ARCH-028: Review Patient Profile DAL Integration and Next Boundary

## 1. Title
ARCH-028 — Review patient profile DAL integration and decide next patient-domain boundary.

## 2. Scope
This report reviews the successful integration of `PatientRepository` and `usePatientProfile` into `PatientCardPage` (ARCH-027), evaluates the remaining direct storage accesses in the patient domain, and recommends the safest next architectural boundary to migrate.

## 3. Inputs Reviewed
- `_ai_work/REPORTS/ARCH-027_patient_profile_repository_hook_integration_report.md`
- `src/pages/PatientCardPage.tsx`
- `src/pages/PatientsPage.tsx`
- `src/components/patients/PatientModal.tsx`
- `src/data/hooks/usePatientProfile.ts`
- `src/data/repositories/PatientRepository.ts`

## 4. ARCH-027 Implementation Review
- **PatientCardPage**: No longer imports `storage`. It uses `usePatientProfile` for both fetching and updating the patient profile.
- **Direct Storage Access Removed**: `PatientCardPage` no longer calls `storage.getPatients()` or `storage.updatePatient()`.
- **UI States Guarded**: Full-page loading and error states are strictly guarded by `!patient` to prevent the card from unmounting during background refetches or save errors.
- **Save Behavior**: `savePatient` is a manual async wrapper. Errors during save do not replace the page or unmount the modal.
- **Preserved Code**: `PatientModal.tsx`, `PatientOverviewTab.tsx`, and all clinical tabs were untouched.

## 5. Current Patient-Domain Architecture Baseline
At this point, the patient profile inside the detailed view (`PatientCardPage`) is isolated behind a standardized Data Access Layer (`PatientRepository`). The read-heavy and write-heavy medical abstractions (like `ClinicalSummaryAggregator` and `DentalChartTab`) remain tightly coupled to local storage but have been separated from the top-level patient entity.

## 6. Remaining Direct Patient-Domain Storage Access
The largest remaining direct storage consumer in the patient domain is **`PatientsPage.tsx`**.
Upon inspection, `PatientsPage` still directly uses:
- `storage.getPatients()` (for initial list load and post-save refresh)
- `storage.addPatient()` (for patient creation via `PatientModal`)
- `storage.updatePatient()` (for patient editing via `PatientModal`)
- `storage.getAppointments()` (for calculating last/next visit dates)

## 7. Patient List/Search/Create Risk Review
Migrating `PatientsPage` introduces several complexities not present in the single-patient profile:
- **Filtering and Searching**: Client-side filtering logic currently lives inside `useMemo` in the component. In a real backend, this would likely shift to server-side query parameters.
- **Aggregated Data**: The list currently loads all appointments via `storage.getAppointments()` just to calculate `lastVisit` and `nextVisit`. This approach will not scale and represents a cross-domain dependency (Patient vs. Schedule).
- **Creation Logic**: `addPatient` requires ID generation and default status assignment.

## 8. Next Boundary Options
- **Option A**: Design Patient list/search/create DAL contract (Design-first).
- **Option B**: Implement Patient list/search DAL immediately.
- **Option C**: Start migrating write-heavy clinical modules (`DentalChart`, `Findings`).
- **Option D**: Start migrating `SchedulePage` and appointments.

## 9. Options Comparison
- **Option B (Immediate Implementation)** is risky because the list page relies on cross-domain data (appointments) and complex filtering. Implementing without a clear contract could lead to a bloated repository or duplicated logic.
- **Options C & D (Clinical/Schedule)** are the most complex and write-heavy domains in the application. Starting them while the core entity (Patient list) is still directly wired to storage is premature.
- **Option A (Design-first Patient List)** addresses the last remaining non-clinical piece of the core Patient domain. It allows us to carefully plan how to handle searching, pagination, and the cross-domain appointment dependency without writing code yet.

## 10. Recommended Next Boundary
**Option A: ARCH-029 — Design Patient list/search/create DAL contract.**

## 11. Why This Next Boundary Is Safest
- The patient profile DAL is already in place. `PatientRepository` currently intentionally excludes list/search/create methods.
- Extending the patient domain must be designed first to avoid mixing profile logic with search, pagination, creation, archiving, and cross-domain data (appointments).
- Patient list/search is read-heavy and much safer to migrate than the highly interactive clinical modules.
- Taking a "design-first" step limits regression risks.

## 12. What Must NOT Be Migrated Next
- **Clinical Modules** (`DentalChartTab`, `FindingsRisksTab`, `TreatmentPlansTab`) must remain untouched until the core domain (Patients, Appointments) is stable.
- **SchedulePage** should not be migrated yet.
- **PatientModal** does not need an urgent UX overhaul (e.g., adding `isSaving` props) until the DAL foundation is complete.

## 13. Acceptance Criteria for Future ARCH-029
- Provide a design report only (no implementation).
- Define the contract for listing, searching, and creating patients.
- Decide whether to extend `PatientRepository` or create a new `PatientCollectionRepository`.
- Define hook contracts (e.g., `usePatientsList()`, `useCreatePatient()`).
- Address how to handle the cross-domain dependency on appointments for the list view.
- Define future backend-compatible constraints (e.g., server-side filtering vs. client-side filtering).

## 14. Recommended Next Task
**ARCH-029 — Design Patient list/search/create DAL contract.**
