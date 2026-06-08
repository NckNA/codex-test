# ARCH-017: Clinical Summary Aggregator Contract

## 1. Scope
This document designs the contract for a read-only `ClinicalSummaryAggregator` and its associated React hook `usePatientMedicalSummary`. It outlines how derived medical data will be safely aggregated from complex clinical domains without mutating the underlying sources of truth. This is a design-only task; no implementation is included.

## 2. Inputs Reviewed
- `_ai_work/REPORTS/ARCH-016_clinical_data_dependency_map.md`
- `src/pages/PatientCardPage.tsx`
- `src/components/patients/patient-card/PatientOverviewTab.tsx`
- `src/components/dental/DentalChartTab.tsx`
- `src/components/dental/FindingsRisksTab.tsx`
- `src/components/treatment/TreatmentPlansTab.tsx`
- `src/pages/SchedulePage.tsx`
- `src/utils/storage.ts`
- `src/types/index.ts`

## 3. Why This Contract Is Needed
According to the dependency map from ARCH-016, `PatientCardPage` and `PatientOverviewTab` currently read directly from multiple raw storage domains (ChiefComplaint, DentalChart, Findings, TreatmentPlans, and Appointments) to compute a medical summary. 
To safely migrate the write-heavy clinical modules, we must first decouple this read-heavy derivation logic into a centralized, pure aggregator layer. This contract acts as the strict interface for that layer.

## 4. Current Summary Calculations Found
In `PatientCardPage.tsx`, the following aggregations currently exist inside `useMemo` blocks using direct `storage.ts` calls:
- `dentalSummary`: Count of teeth needing treatment, count of missing teeth, active plans count, total amount, chief complaint text, count of high/urgent findings, count of not-included findings, and count of observing findings.
- `lastVisit` and `nextVisit`: Calculated by sorting appointments relative to the current date.

## 5. Proposed ClinicalSummaryAggregator Responsibility
The `ClinicalSummaryAggregator` will be a pure business-logic layer responsible for:
- Fetching raw data from the underlying repositories or direct storage (during the transition).
- Computing the `dentalSummary` counts and texts.
- Computing `lastVisit` and `nextVisit`.
- Exposing this derived data in a strictly typed, unified object.

## 6. Proposed usePatientMedicalSummary Contract
A React hook will wrap the aggregator to manage asynchronous state, loading flags, and manual refetching, enabling UI components to consume the summary declaratively.

### A. Input
- `patientId: string` (The unique identifier of the patient)

### B. Output Fields (Proposed Return Shape)
```typescript
interface PatientMedicalSummaryResult {
  data: {
    dentalSummary: {
      needsTreatment: number;
      missing: number;
      activePlans: number;
      totalAmount: number;
      chiefComplaintText: string;
      highUrgentFindings: number;
      notIncludedFindings: number;
      observingFindings: number;
    };
    lastVisit?: Date;
    nextVisit?: Date;
  } | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}
```

## 7. Source Domains Read Conceptually
The aggregator will conceptually read from the following domains:
- **ChiefComplaint**: to extract `chiefComplaintText`.
- **DentalChart**: to calculate `needsTreatment` and `missing`.
- **Findings/Risks**: to calculate `highUrgentFindings`, `notIncludedFindings`, and `observingFindings`.
- **TreatmentPlans**: to calculate `activePlans` and `totalAmount`.
- **Appointments**: to calculate `lastVisit` and `nextVisit`.

## 8. What Remains Source of Truth
The underlying domains (Chart, Findings, Plans, Appointments, Complaints) remain the absolute sources of truth. The aggregator acts purely as a read-model projection.

## 9. What the Aggregator Must NOT Own or Mutate
- **No Ownership**: It must not persist the computed summary to local storage or a database. The summary is strictly derived at runtime.
- **No Mutations**: It must NOT mutate `DentalChart`, `Findings`, `TreatmentPlans`, `Appointments`, or `ChiefComplaint`.

## 10. Loading, Error, and Refetch Behavior
- **Initial Load**: Upon mounting or changing `patientId`, `isLoading` will be `true`. Once the aggregator resolves all domain reads, `isLoading` becomes `false` and `data` is populated.
- **Errors**: If any domain read fails, `isError` will be `true` and `error` will contain the details.
- **Refetch**: The `refetch` function allows the UI to manually trigger a recalculation (e.g., after a user saves a new finding or updates the dental chart in a separate tab).

## 11. Data Freshness Strategy
Currently, there is no global cache invalidation or React Query. 
Data freshness will be maintained by manually calling `refetch()` when a sibling tab modifies the underlying data, or by allowing the hook to re-run its aggregator logic when the component mounts. The initial implementation will rely on local repository/storage reads.

## 12. Future Implementation Boundary
Future ARCH-018 may create the pure aggregator and hook files only. Integration into `PatientCardPage.tsx` and `PatientOverviewTab.tsx` should be a separate ARCH-019 task after the hook contract is implemented and reviewed.

Files to be created in ARCH-018:
- **New File**: `src/data/aggregators/ClinicalSummaryAggregator.ts` (or similar pure TS file).
- **New File**: `src/data/hooks/usePatientMedicalSummary.ts`.
- **New File**: A report file detailing the implementation.

## 13. Future Implementation Non-Goals
The future implementation (ARCH-018) must **NOT** touch:
- `src/components/dental/DentalChartTab.tsx` (mutation logic)
- `src/components/dental/FindingsRisksTab.tsx` (mutation logic)
- `src/components/treatment/TreatmentPlansTab.tsx` (mutation logic)
- `src/pages/SchedulePage.tsx`
- `src/utils/storage.ts`
- `src/types/index.ts` (unless explicitly requested to add the aggregator types)
- Backend code
- Dependencies (no React Query, Zustand, etc.)

## 14. Risks and Constraints
- Without global state management, siblings (e.g., `DentalChartTab` and `PatientOverviewTab`) do not automatically sync. The `PatientCardPage` must pass down a mechanism (like a `key` prop or a `refetch` trigger) if the summary needs to update instantly after a mutation in a different tab.
- The aggregator might become a bottleneck if patient histories grow excessively large, though this is negligible for local mock storage.

## 15. Future Migration Order
1. **ARCH-018**: Implement pure `ClinicalSummaryAggregator` and `usePatientMedicalSummary` hook. Do not touch write-heavy clinical modules.
2. **ARCH-019**: Integrate `PatientCardPage` and `PatientOverviewTab` to consume the new hook, fully removing direct `storage.ts` read logic from the UI for these summaries.
3. **Subsequent Tasks**: Plan and execute migrations for the write-heavy modules (`DentalChart`, `Findings`, `TreatmentPlans`) one by one, now safely shielded by the aggregator interface.

## 16. Acceptance Criteria for Future ARCH-018
- The `usePatientMedicalSummary` hook and `ClinicalSummaryAggregator` are implemented exactly as designed in this contract.
- It calculates the exact same fields previously computed in `PatientCardPage.tsx`.
- No `PatientCardPage.tsx` changes in ARCH-018.
- No `PatientOverviewTab.tsx` changes in ARCH-018.
- No `DentalChartTab.tsx` / `FindingsRisksTab.tsx` / `TreatmentPlansTab.tsx` / `SchedulePage.tsx` changes.
- No `storage.ts` or `types/index.ts` changes unless explicitly authorized.
- ARCH-018 should only implement the aggregator/hook and generate an implementation report.

## 17. Recommended Next Task
**ARCH-018 — Implement pure ClinicalSummaryAggregator and usePatientMedicalSummary hook without touching write-heavy clinical modules.**
