# ARCH-034: Review Visit Summary Aggregator Integration & Next Boundary

## 1. Title
ARCH-034 — Review patient list visit summary aggregator integration and decide next architecture boundary.

## 2. Scope
This document reviews the successful integration of the `PatientListVisitSummaryAggregator` (ARCH-033) which removed the last direct storage access from the `PatientsPage`. It maps the remaining legacy storage dependencies across the application, assesses architectural risks, and evaluates options to determine the safest next architectural boundary.

## 3. Inputs Reviewed
- `_ai_work/REPORTS/ARCH-033_patient_list_visit_summary_aggregator_integration_report.md`
- `src/pages/PatientsPage.tsx`
- `src/data/aggregators/PatientListVisitSummaryAggregator.ts`
- `src/data/hooks/usePatientListVisitSummary.ts`
- `src/data/repositories/PatientRepository.ts`
- `src/data/hooks/usePatientsCollection.ts`
- `src/data/repositories/AppointmentRepository.ts`
- `src/data/hooks/usePatientAppointments.ts`
- `src/pages/SchedulePage.tsx`
- `src/utils/storage.ts`
- `src/types/index.ts`

## 4. ARCH-033 Implementation Review
- ✅ `PatientsPage` strictly avoids direct storage imports.
- ✅ `PatientsPage` no longer calls `storage.getAppointments()`.
- ✅ `PatientListVisitSummaryAggregator` successfully isolates the `storage.getAppointments()` call.
- ✅ The visit summary aggregator is strictly read-only.
- ✅ `usePatientListVisitSummary` uses the `useAsyncQuery` object-style API.
- ✅ `PatientRepository` and `usePatientsCollection` were untouched.
- ✅ `AppointmentRepository` and `usePatientAppointments` were untouched.
- ✅ `SchedulePage` was untouched.
- ✅ `PatientModal`, `PatientCardPage`, and clinical tabs were untouched.

## 5. Current Patient-Domain Architecture Baseline
The Patient domain is now well-architected. Both the single patient profile (`PatientCardPage` + `PatientModal` via `usePatientProfile`) and the patient collection (`PatientsPage` via `usePatientsCollection`) operate through formal Repositories and Hooks. Cross-domain aggregations (like Medical Summary and Visit Summary) are cleanly abstracted. The UI components are completely decoupled from `storage.ts`.

## 6. Current Appointment/Schedule Architecture Baseline
The Schedule/Appointment domain is still heavily coupled to `storage.ts`. While `usePatientAppointments` exists for specific patient profiles, global scheduling operations on the `SchedulePage` (listing, creating, updating, moving, blocking, cancelling) likely bypass the DAL and interact with the local storage wrapper directly.

## 7. Remaining Direct Storage Access Map
Direct imports of `storage.ts` are expected to remain in:
1. **`SchedulePage.tsx`**: (High Risk) Massive read/write operations for calendar events, blocking slots, and patient selection.
2. **`PatientModal.tsx`**: (Low/Medium Risk) Potentially loads appointment data or handles cross-domain concerns.
3. **Clinical Write-Heavy Modules (DentalChart, TreatmentPlans, Findings)**: (Extreme Risk) Directly read/write complex arrays to the patient's record.
4. **Aggregators**: (Intentional Debt) Read-only abstractions isolating specific cross-domain queries.

## 8. Risk Review of Next Possible Boundaries
- **Clinical Write-Heavy Modules**: Extreme risk. Refactoring these requires immense care to prevent data loss or UI corruption.
- **New Features**: High risk if built on top of un-migrated legacy storage code.
- **PatientModal isSaving UX**: Low risk, but low strategic value compared to decoupling major domains.
- **SchedulePage / Appointment DAL**: High risk if implemented immediately without a map, but holds the highest strategic value as it is the last major top-level domain coupled to storage.

## 9. Boundary Options
- **Option A:** Stop DAL work temporarily and do a full storage dependency map.
- **Option B:** Design Schedule/Appointment DAL boundary before touching `SchedulePage`.
- **Option C:** Immediately migrate `SchedulePage` to `AppointmentRepository`/hooks.
- **Option D:** Expand `AppointmentRepository` with global list methods.
- **Option E:** Create `AppointmentSummaryAggregator`/repository design first.
- **Option F:** Start DentalChart migration.
- **Option G:** Start Findings/Risks migration.
- **Option H:** Start TreatmentPlans migration.
- **Option I:** Add new product features now.
- **Option J:** Add `PatientModal` isSaving UX.
- **Option K:** Begin backend/SaaS readiness map.

## 10. Options Comparison
- **Immediate Implementation (Option C, F, G, H):** Refactoring complex write-heavy logic without a predefined contract usually leads to regressions and scope creep.
- **New Features (Option I, J):** Distracts from the current objective of decoupling the frontend from the local storage backend.
- **Schedule/Appointment DAL Design (Option B):** Provides a clear, documented path to untangle the next largest domain in the app. It maps the current state, defines the API for the repository/hooks, and ensures no implementation mistakes are made during the actual migration.

## 11. Recommended Next Boundary
**ARCH-035 — Design Schedule/Appointment DAL boundary map before implementation.**

## 12. Why This Boundary is Safest
- The Patient domain is stable and clean; it is the perfect time to address the Schedule domain.
- Designing before implementing prevents catastrophic regressions in the highly complex calendar UI.
- It continues the successful pattern established in previous tasks (Design -> Implement).
- It defers the extreme-risk clinical modules until the foundational Patient and Schedule domains are fully migrated.

## 13. What Must NOT be Migrated Next
- Do **NOT** migrate `SchedulePage` immediately.
- Do **NOT** touch clinical modules (DentalChart, TreatmentPlans, Findings).
- Do **NOT** introduce new product features yet.
- Do **NOT** prioritize minor UI/UX tweaks (like `PatientModal` loading states) over architectural integrity.

## 14. Acceptance Criteria for Future ARCH-035
The future ARCH-035 task must be **design-only** and include:
- A full map of direct storage usage within `SchedulePage`.
- A map of current `AppointmentRepository` capabilities.
- Defined repository contracts (`listAppointments`, `createAppointment`, etc.).
- Defined hook contracts (`useAppointmentsCollection`, `useAppointmentMutations`, etc.).
- Explicit rules for behavior preservation (rendering, date ranges, blocked slots, patient selection).
- Zero implementation code written.
- Zero modifications to `SchedulePage` or clinical modules.
- Zero introduction of global state/caching libraries.

## 15. Recommended Next Task
**ARCH-035 — Design Schedule/Appointment DAL boundary map before implementation.**

---
### Explicit Architecture Questions Answered
- **Does PatientsPage now avoid direct storage import?** Yes.
- **Does PatientsPage still call storage.getAppointments?** No.
- **Does PatientListVisitSummaryAggregator call storage.getAppointments?** Yes.
- **Was SchedulePage changed in ARCH-033?** No.
- **Were AppointmentRepository/usePatientAppointments changed in ARCH-033?** No.
- **Was PatientRepository/usePatientsCollection changed in ARCH-033?** No.
- **Were clinical tabs changed?** No.
- **Is the patient list now clean from direct storage access?** Yes.
- **What direct storage dependencies remain in the app?** Primarily `SchedulePage`, `PatientModal`, and the clinical modules (DentalChart, TreatmentPlans, Findings).
- **Should SchedulePage be migrated immediately?** No.
- **Should Schedule/Appointment DAL be designed first?** Yes.
- **Should clinical modules be migrated next?** No.
- **Should new features be started now?** No.
- **Should PatientModal isSaving UX be next?** No.
- **What should ARCH-035 do?** Design the Schedule/Appointment DAL boundary map before any implementation begins.
