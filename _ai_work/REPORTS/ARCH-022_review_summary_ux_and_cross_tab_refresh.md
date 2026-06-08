# ARCH-022: Review Summary UX and Cross-Tab Refresh

## 1. Scope
This report evaluates the current loading and error User Experience (UX) introduced in ARCH-021 for the medical summary in `PatientCardPage`. The primary goal is to analyze known limitations regarding data freshness (stale data) across tabs and recommend the safest, least-invasive strategy for cross-tab summary refreshing.

## 2. Inputs Reviewed
- `_ai_work/REPORTS/ARCH-021_patient_card_summary_loading_error_report.md`
- `src/pages/PatientCardPage.tsx`
- `src/components/patients/patient-card/PatientOverviewTab.tsx`
- `src/components/dental/DentalChartTab.tsx`
- `src/components/dental/FindingsRisksTab.tsx`
- `src/components/treatment/TreatmentPlansTab.tsx`
- `src/data/hooks/usePatientMedicalSummary.ts`
- `src/data/aggregators/ClinicalSummaryAggregator.ts`
- `src/data/hooks/useAsyncQuery.ts`

## 3. ARCH-021 Summary
ARCH-021 introduced minimal, non-blocking UI banners in `PatientCardPage` to handle the `isLoading` and `isError` states of the `usePatientMedicalSummary` hook. This ensures users are informed when the summary is loading or fails, without breaking the visual layout of `PatientOverviewTab`. 

## 4. Current UX Review
- **Does PatientCardPage show loading/error notices?** Yes.
- **Is PatientOverviewTab still presentational?** Yes. It was completely untouched and only receives props.
- **Does cross-tab refresh currently exist?** No. 

## 5. Current Data Freshness Limitation
Because the summary calculation was moved behind an asynchronous hook, its data is fetched once upon component mount. **The summary can become stale after edits in sibling tabs.** If a user navigates to a clinical tab, mutates data, and returns to the "Overview" tab, the `PatientCardPage` will not automatically refetch the summary, displaying outdated information until a hard reload occurs.

## 6. Stale-Summary Scenarios
The summary will become noticeably stale in the following common user flows:
1. User updates a tooth's condition in the Dental Chart, then returns to Overview.
2. User adds, edits, or resolves a finding/risk, then returns to Overview.
3. User creates or approves a treatment plan, then returns to Overview.
4. User updates an appointment status (e.g., in History), then returns to Overview.
5. User edits the chief complaint in the Findings/Risks tab, then returns to Overview.

## 7. Cross-Tab Refresh Options
- **Option A**: Do nothing for now; accept the stale summary until remount.
- **Option B**: Refetch the medical summary whenever `activeTab` changes to `'overview'`.
- **Option C**: Pass a `refetchMedicalSummary` callback down into all write-heavy tabs and execute it after successful save operations.
- **Option D**: Add a local `summaryVersion` counter in `PatientCardPage` and increment it via callbacks after child mutations.
- **Option E**: Implement a small local event emitter / event bus.
- **Option F**: Add React Context for patient-card refresh coordination.
- **Option G**: Introduce React Query for global cache invalidation.
- **Option H**: Move all clinical tab data under one massive parent-owned state model.

## 8. Options Comparison
- **Options E, F, G, H**: These introduce significant architectural complexity, global state, or new dependencies, violating current project constraints and over-engineering the immediate problem.
- **Option C & D**: Modifying the write-heavy clinical tabs to accept and call new callbacks introduces immediate risk to complex modules.
- **Option A**: Leaves a noticeable UX flaw.
- **Option B**: Provides a highly isolated, parent-only solution. It perfectly targets the moment the user actually needs the fresh data (when returning to the overview tab) without touching any child components.

## 9. Recommended Direction
The recommended approach is **Option B**: Design a minimal tab-change summary refetch entirely within `PatientCardPage`. 

## 10. Why This Direction is Safest
- **Should React Query/global state/event bus be introduced now?** No.
- **Should write-heavy tabs be modified immediately to call refetch callbacks?** No.
- **Should the first refresh solution be tab-change-based refetch in PatientCardPage?** Yes. 

This is the least invasive option. It keeps `PatientOverviewTab` completely presentational. It avoids risking regressions in the complex write-heavy tabs. It solves the exact stale-summary scenarios listed above by ensuring data is fresh when the user actually looks at it. While it may cause harmless extra storage reads when switching back to Overview, this is perfectly acceptable for the current localStorage MVP.

## 11. What Must NOT Be Introduced Yet
- Event buses or global Context.
- React Query, Redux, or Zustand.
- Modifications to `DentalChartTab`, `FindingsRisksTab`, or `TreatmentPlansTab`.

## 12. Future ARCH-023 Design Notes
- **Should this be designed before implementation?** Yes.
- The next step must be a **design-only** task.
- The focus must remain exclusively on `PatientCardPage`.
- The design needs to define exact conditions for calling `refetchMedicalSummary` (e.g., using `useEffect` on `activeTab`).
- The design must account for preventing infinite loops, avoiding duplicate fetches on the initial mount, and ensuring we do not trigger a refetch if the hook is already in an `isLoading` state.

## 13. Acceptance Criteria for Future ARCH-023
- Design a tab-change summary refetch strategy.
- Limit scope strictly to `PatientCardPage`.
- Do not modify clinical tabs.
- Do not introduce event bus / Context / React Query / global state.
- Do not implement the code yet (documentation only).

## 14. Recommended Next Task
**ARCH-023 — Design minimal PatientCardPage tab-change summary refetch strategy.**
