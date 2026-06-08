# ARCH-023: Patient Card Tab-Change Refetch Strategy

## 1. Title
ARCH-023 — Design minimal PatientCardPage tab-change summary refetch strategy.

## 2. Scope
This report defines the implementation strategy for ensuring the medical summary remains fresh when navigating back to the "Overview" tab in `PatientCardPage`. The scope is strictly limited to architectural design; no code changes are introduced in ARCH-023.

## 3. Inputs Reviewed
- `_ai_work/REPORTS/ARCH-022_review_summary_ux_and_cross_tab_refresh.md`
- `src/pages/PatientCardPage.tsx`
- `src/data/hooks/usePatientMedicalSummary.ts`
- `src/data/hooks/useAsyncQuery.ts`
- `src/data/aggregators/ClinicalSummaryAggregator.ts`
- `src/components/patients/patient-card/PatientOverviewTab.tsx`
- `src/components/dental/DentalChartTab.tsx`
- `src/components/dental/FindingsRisksTab.tsx`
- `src/components/treatment/TreatmentPlansTab.tsx`

## 4. Current State Summary
- `PatientCardPage` owns the `activeTab` state and the `usePatientMedicalSummary` hook.
- `PatientOverviewTab` is purely presentational.
- Clinical tabs (e.g., `DentalChartTab`) can mutate data but have no way of notifying the parent page.
- The `usePatientMedicalSummary` hook is called once on mount and currently has no triggers to refetch, meaning its data is only as fresh as the moment the page loaded.

## 5. Stale Summary Problem
When a user edits data in a sibling tab (like changing a tooth's condition or adding a diagnosis) and then clicks back to the "Overview" tab, the `PatientCardPage` does not fetch the new data. The medical summary displays stale information until a manual page refresh occurs.

## 6. Why PatientCardPage-Only Strategy is Preferred
A `PatientCardPage`-only strategy is the least invasive option. It avoids altering the complex internal state and mutation logic of the clinical tabs. It also prevents the premature introduction of global state management (React Query, Redux), Context, or event buses, adhering to the project's strict architecture guidelines.

## 7. Refetch Trigger Design
The proposed trigger is the `activeTab` state. Whenever `activeTab` changes to `'overview'`, the `PatientCardPage` should call `refetchMedicalSummary()`. This ensures the data is freshly fetched exactly when the user intends to look at it.

## 8. Initial Load / Double-Fetch Prevention
By default, the `usePatientMedicalSummary` hook already fetches data when the component first mounts. Triggering a refetch blindly when `activeTab === 'overview'` (which is the default tab) would cause an unnecessary double-fetch on the initial page load. 
To prevent this, the component should use a `useRef` to track either whether the initial fetch has occurred or simply keep track of the previous tab. A `previousTabRef` is the safest mechanism: it ensures a refetch *only* when transitioning from a non-overview tab back to the overview tab.

## 9. Loading/Error Interaction
- **Loading**: If `isMedicalSummaryLoading` is already true, the refetch should be skipped to prevent overlapping network requests or redundant storage reads.
- **Error**: If the previous fetch resulted in an error, navigating back to the Overview tab should still attempt a refetch (it acts as an implicit retry mechanism).
- **Missing patientId**: Refetch must be skipped if `patientId` is falsy.

## 10. Infinite Loop Prevention
Calling `refetchMedicalSummary` updates state inside the hook (setting `isLoading` to true, then returning data). If placed inside a `useEffect` without careful dependency management, this could trigger an infinite render loop. The `useEffect` must depend *only* on `activeTab`, `patientId`, `isMedicalSummaryLoading`, and `refetchMedicalSummary`. The `useRef` ensures the effect condition is only met once per tab transition.

## 11. Alternatives Considered
- **`hasSeenOverviewRef`**: Simply tracking if the overview has been seen once. This is slightly less robust than `previousTabRef` because it might inadvertently trigger refetches on unrelated re-renders if the `useEffect` dependencies shift. `previousTabRef` explicitly models the *transition* intent.
- **Mutation Callbacks**: Passing a refetch callback down to child tabs. This pollutes child tab props and requires modifying write-heavy modules, which introduces unnecessary risk.

## 12. Recommended Future Implementation (ARCH-024)
The implementation in `PatientCardPage.tsx` should follow this exact pattern:

```tsx
  const previousTabRef = useRef(activeTab);

  useEffect(() => {
    // Determine if we are transitioning INTO the overview tab from another tab
    const isTransitioningToOverview = 
      previousTabRef.current !== 'overview' && activeTab === 'overview';
    
    // Update the ref for the next render
    previousTabRef.current = activeTab;

    if (!isTransitioningToOverview) return;
    if (!patientId) return;
    if (isMedicalSummaryLoading) return;

    refetchMedicalSummary();
  }, [activeTab, patientId, isMedicalSummaryLoading, refetchMedicalSummary]);
```

## 13. What Must NOT Be Changed in ARCH-024
- Do not modify `PatientOverviewTab`.
- Do not modify clinical tabs (`DentalChartTab`, `FindingsRisksTab`, etc.).
- Do not modify `usePatientMedicalSummary` or `ClinicalSummaryAggregator`.
- Do not introduce React Query, Context, Redux, or an event bus.
- Do not add cross-tab refetch logic outside of `PatientCardPage`.

## 14. Acceptance Criteria for Future ARCH-024
- Only `PatientCardPage.tsx` is modified.
- Refetch occurs when switching from another tab back to "Overview".
- No double-fetch occurs on the initial page load.
- No infinite loops occur.
- Write-heavy clinical tabs remain untouched.
- `PatientOverviewTab` remains untouched.

## 15. Recommended Next Task
**ARCH-024 — Implement PatientCardPage tab-change medical summary refetch.**
