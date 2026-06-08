# ARCH-041: Review Schedule Storage Decoupling & Next Gate

## 1. Title
ARCH-041 — Review SchedulePage full storage decoupling and decide next architecture gate.

## 2. Scope
This document verifies the completion of the Schedule domain's abstraction from the local storage mechanism (ARCH-040). It identifies the remaining direct dependencies on `storage.ts` within the UI layer, assesses the risk of migrating the clinical modules, verifies infrastructure health (Tailwind/PostCSS), and defines the next phase of the architectural migration.

## 3. Inputs Reviewed
- `_ai_work/REPORTS/ARCH-040_schedule_doctor_patient_prop_bridge_report.md`
- `src/pages/SchedulePage.tsx`
- `src/components/schedule/AppointmentModal.tsx`
- All `src/` files importing `storage.ts`
- `package.json`

## 4. ARCH-040 Implementation Review
- ✅ `SchedulePage` uses `useClinicDoctors` and `usePatientsCollection`.
- ✅ `AppointmentModal` receives `doctors` and `patients` via props.
- ✅ Direct local storage access was successfully eradicated from both files without breaking visual layout or conflict checking logic.

## 5. SchedulePage Storage Decoupling Verification
- `SchedulePage` imports `storage`: **No**
- `SchedulePage` calls storage methods: **No**
- `SchedulePage` is completely abstracted via hooks: **Yes**

## 6. AppointmentModal Storage Decoupling Verification
- `AppointmentModal` imports `storage`: **No**
- `AppointmentModal` calls storage methods: **No**
- `AppointmentModal` relies exclusively on props for data: **Yes**

## 7. Current Acceptable DAL Storage Usage
These usages are intentionally wrapped abstractions and do not represent technical debt:
- `src/utils/storage.ts`
- `src/data/repositories/AppointmentRepository.ts`
- `src/data/repositories/ChiefComplaintRepository.ts`
- `src/data/repositories/DoctorRepository.ts`
- `src/data/repositories/PatientRepository.ts`
- `src/data/aggregators/ClinicalSummaryAggregator.ts`
- `src/data/aggregators/PatientListVisitSummaryAggregator.ts`
- `src/main.tsx` (Application seeding logic)

## 8. Remaining Risky UI Storage Usage Map
The following UI components still perform synchronous, direct data fetches or mutations from `storage.ts`:
- `src/components/layout/Header.tsx` (Reads `getDoctors` to build a read-only global layout filter)
- `src/components/dental/DentalChartTab.tsx`
- `src/components/dental/FindingModal.tsx`
- `src/components/dental/FindingsRisksTab.tsx`
- `src/components/treatment/CreatePlanFromFindingsModal.tsx`
- `src/components/treatment/TreatmentPlanModal.tsx`
- `src/components/treatment/TreatmentPlanPatientPreview.tsx`
- `src/components/treatment/TreatmentPlansTab.tsx`

## 9. Clinical Modules Risk Analysis
The treatment and dental modules are deeply intertwined. They perform complex synchronous write operations (creating treatment plans from findings, updating specific teeth statuses) and complex data joining. Migrating these blindly to the DAL without a clear boundary map is highly risky. They are **not safe to migrate immediately**. A dedicated design phase is required before touching any write-heavy clinical code.

## 10. Header/Layout Risk Analysis
`Header.tsx` currently imports `storage.getDoctors()` to populate a global filter dropdown. This is a low-risk, read-only operation. However, since the dropdown doesn't yet execute global state updates that affect decoupled components (like the schedule itself, which manages its own context), this dependency is not mission-critical to resolve at this exact moment compared to the clinical modules.

## 11. Tailwind/PostCSS Config Status
- **Missing Configs**: Both `tailwind.config.js` and `postcss.config.js` are completely missing from the repository root.
- **Impact**: The `npm run build` command throws `[lightningcss minify] Unknown at rule: @tailwind` warnings because the build pipeline doesn't know how to process Tailwind CSS directives without its config.
- **Action**: This is an infrastructure issue separate from the DAL architecture migration and must be fixed in an isolated task.

## 12. Next Boundary Options
- **Option A**: Continue immediately into clinical write-heavy migration. *(Rejected: Too risky)*
- **Option B**: Add `isSaving`/error UX to `AppointmentModal` next. *(Rejected: Low priority compared to finishing the DAL)*
- **Option C**: Migrate `Header` storage utility usage. *(Rejected: Low priority)*
- **Option D**: Fix Tailwind/PostCSS configs first as a separate non-ARCH PR, then map the clinical boundary. *(Recommended)*

## 13. Options Comparison
Addressing the failing CSS build warnings ensures a clean CI pipeline. Proceeding with a full dependency map and design review of the Clinical modules prevents catastrophic regressions in the most complex part of the app. Option D provides the safest, most stable path forward.

## 14. Recommended Next Gate
**FIX-CONFIG-001 — Restore Tailwind/PostCSS config files.**
*Followed immediately by:*
**ARCH-042 — Full remaining UI direct storage dependency map and clinical boundary review.**

## 15. What Must NOT be Changed Next
- Do **NOT** migrate clinical modules immediately.
- Do **NOT** add new product features.
- Do **NOT** introduce global state/cache/event bus/React Query.
- Do **NOT** touch TreatmentPlans/DentalChart/Findings without a design-first review.
- Do **NOT** bundle the Tailwind/PostCSS config fix with architecture migration tasks.

## 16. Acceptance Criteria for Next Task (FIX-CONFIG-001)
- Restore `tailwind.config.js` (or `.ts`) and `postcss.config.js`.
- `npm run build` must complete without `Unknown at rule: @tailwind` warnings.
- No `src/` files changed.
- No architecture changes made.

## 17. Recommended Next Task
**FIX-CONFIG-001 — Restore Tailwind/PostCSS config files.**

---

### Explicit Architecture Questions Answered
- **Is ARCH-041 implementation or review/design?** Review/design only.
- **Should src/ code be changed in ARCH-041?** No.
- **Does SchedulePage import storage?** No.
- **Does SchedulePage call storage methods?** No.
- **Does AppointmentModal import storage?** No.
- **Does AppointmentModal call storage methods?** No.
- **Does SchedulePage use useScheduleAppointments/useClinicDoctors/usePatientsCollection?** Yes.
- **Does AppointmentModal receive appointments/doctors/patients via props?** Yes.
- **Which direct storage usages remain in src/?** Header, DentalChartTab, FindingModal, FindingsRisksTab, CreatePlanFromFindingsModal, TreatmentPlanModal, TreatmentPlanPatientPreview, TreatmentPlansTab, and various acceptable DAL files + main.tsx.
- **Which remaining direct storage usages are acceptable DAL/internal usage?** Aggregators, Repositories, `storage.ts`, and application seeding in `main.tsx`.
- **Which remaining direct storage usages are risky UI usage?** The entire Dental and Treatment domains, plus the `Header` layout component.
- **Are clinical modules safe to migrate immediately?** No.
- **Should new product features start now?** No.
- **Should Tailwind/PostCSS config fix be handled separately?** Yes.
- **Should AppointmentModal isSaving UX be next?** No.
- **What exactly should ARCH-042 do?** Map out the data dependencies and design the DAL boundaries for the complex, write-heavy clinical (Dental/Treatment) modules.
- **What exactly should FIX-CONFIG-001 do?** Add the missing `tailwind.config.js` and `postcss.config.js` files to the repository root so the Vite/LightningCSS build pipeline can correctly parse `@tailwind` directives.
