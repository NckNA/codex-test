# ARCH-015: Review useChiefComplaint Refactor and Next Migration Boundary

## 1. Scope
This report evaluates the `ARCH-014` refactor of `useChiefComplaint` and analyzes remaining direct `storage.ts` dependencies to determine the next safest architectural migration boundary.

## 2. Inputs Reviewed
- `_ai_work/REPORTS/ARCH-014_chief_complaint_hook_refactor_report.md`
- `src/data/hooks/useChiefComplaint.ts`
- `src/data/hooks/useAsyncQuery.ts`
- `src/data/hooks/useAsyncMutation.ts`
- `src/data/hooks/usePatientAppointments.ts`
- `src/data/hooks/useClinicDoctors.ts`
- `src/components/dental/FindingsRisksTab.tsx`
- `src/components/patients/patient-card/PatientHistoryTab.tsx`
- `src/pages/PatientCardPage.tsx`

## 3. ARCH-014 Implementation Review
The refactor of `useChiefComplaint` was executed correctly according to the safest Option A path:
- **`useAsyncQuery`** is successfully utilized to eliminate query/loading boilerplate.
- **`useAsyncMutation`** was intentionally **NOT** used, bypassing the void-return and refetch-timing limitations.
- The `saveComplaint` wrapper manually handles `isSaving` state, directly `await`s the repository save, and sequentially `await`s `refetchComplaint()`.
- Error precedence was correctly structured (`error = saveError || queryError`) to ensure save errors are not masked.
- The `refetchComplaint` method clears `saveError` state upon manual refetch, preserving exact legacy behavior.
- The public API surface matches the previous version completely.

## 4. Current Migrated DAL/Hook Slices
The following slices are now successfully migrated to the async Repository + Hook pattern:
1. `ChiefComplaint` (query refactored to utility, manual save wrapper).
2. `Appointments` (read-only history flow via `usePatientAppointments`).
3. `Doctors` (read-only dictionary flow via `useClinicDoctors`).
4. Shared Utilities (`useAsyncQuery` active, `useAsyncMutation` available but idle).

## 5. What Was Done Well
- The migration strategy isolated complex modules and attacked simple, low-dependency slices first.
- Reusable utilities (`useAsyncQuery`, `useAsyncMutation`) were introduced only after boilerplate duplication was empirically proven.
- We deliberately stopped short of fully genericizing mutations (`useAsyncMutation` inside `useChiefComplaint`) when it risked subtly altering behavior (void mutation checks, async `onSuccess` timing).

## 6. Remaining Risks
The simple, isolated slices are now stable. The remaining architectural risk lies entirely within the complex medical modules. Moving these without a thorough understanding of their interconnectivity risks breaking clinical flows and data integrity.

## 7. Remaining Direct Storage Access Areas
The following components still directly read from or write to `storage.ts`:
- `DentalChartTab` (Tooth states, formulas)
- `FindingsRisksTab` (Dental findings list, risk categorizations, statuses)
- `TreatmentPlansTab` (Treatment plan generation, pricing, status tracking)
- `PatientOverviewTab` (Medical summary, derived clinical statuses)
- `PatientCardPage` (High-level summary calculations, counters)
- `SchedulePage` (Appointments calendar, drag-and-drop, creation)
- Patient List / Patient Search Pages

## 8. Complex Medical Module Dependency Concerns
Unlike `ChiefComplaint` or `Doctors`, the clinical modules (`DentalChart`, `Findings`, `TreatmentPlans`) do not exist in isolation. They form a highly coupled medical record:
- **Findings** are generated based on visual inspection or **Dental Chart** changes.
- **Treatment Plans** depend heavily on identified **Findings** (problems/risks).
- The **Dental Chart** acts as the foundation for the clinical picture.
- Derived summaries in **PatientOverviewTab** and **PatientCardPage** aggregate data across all these modules simultaneously.

## 9. Next Boundary Options Comparison

| Option | Target | Assessment |
| :--- | :--- | :--- |
| **Option A** | `DentalChartTab` read/write flow | High Risk. The core foundation of the clinical record. Changes here cascade to findings and plans. |
| **Option B** | `FindingsRisksTab` findings list | High Risk. Tightly coupled with the Chief Complaint, Dental Chart, and Treatment Plans. |
| **Option C** | `TreatmentPlansTab` flow | High Risk. The downstream consumer of all clinical findings. |
| **Option D** | `PatientOverviewTab` summary | Moderate Risk. Purely read-only, but aggregations span multiple data domains. |
| **Option E** | `PatientCardPage` summary | Moderate Risk. Similar to Option D, cross-domain aggregation. |
| **Option F** | `SchedulePage` flow | High Risk. Complex interactive UI (drag-and-drop) with appointment state mutations. |
| **Option G** | **Data Dependency Map** | **Zero Risk. High Value.** Maps the coupling between A, B, C, D, and E before writing code. |

## 10. Recommended Next Step
**ARCH-016 — Create Data Dependency Map for complex medical modules before migrating DentalChart/Findings/TreatmentPlans.**

## 11. Why This Next Step Is Safest
Attempting to migrate `DentalChart`, `Findings`, or `TreatmentPlans` right now is akin to performing surgery blindfolded. The data domains are intertwined. A change in how `Findings` are loaded might break the "Include in Treatment Plan" flow or the summary calculations on the `PatientCardPage`. 

Creating a Data Dependency Map allows us to explicitly define the read/write paths, identify cross-module data dependencies, and architect a unified migration strategy for the clinical core. This discipline prevents regressions and avoids "architecture by vibes."

## 12. What Must NOT Be Migrated Next Without Dependency Mapping
- `DentalChartTab`
- `FindingsRisksTab` (Findings list)
- `TreatmentPlansTab`
- `PatientOverviewTab`
- `PatientCardPage` summary calculations

## 13. Acceptance Criteria for Future ARCH-016
- A comprehensive Data Dependency Map report is generated.
- The map details how `DentalChart`, `Findings`, `ChiefComplaint`, and `TreatmentPlans` interact.
- The map identifies which modules act as "Source of Truth" and which act as derived consumers.
- Based on the map, a specific, ordered migration plan for the complex modules is proposed.
- No source code, UI components, backend, storage, or types are modified.

## 14. Recommended Next Task
**ARCH-016 — Create Data Dependency Map for complex medical modules before next code migration.**
