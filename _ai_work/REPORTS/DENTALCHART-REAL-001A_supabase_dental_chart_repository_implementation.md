# DENTALCHART-REAL-001A: Supabase DentalChartRepository Implementation

## 1. Summary
Implemented `SupabaseDentalChartRepository` and integrated it behind the factory function `createDentalChartRepository`. 
The `useDentalChart` hook safely routes to Supabase when the application is running in `supabase-active` mode with a valid `tenantId`. 
Additionally, the `useClinicalWorkflow` hook was updated to dynamically route `applyToothStatusChange` and `createTreatmentPlanFromFindings` to use the appropriate `DentalChartRepository` and `FindingsRepository` (Supabase or local) based on the context, ensuring the tooth editor correctly saves data to Supabase.
The original local storage behavior remains intact as a fallback for both charts and treatment plans.

## 2. Files changed
- `src/data/repositories/DentalChartRepository.ts`
- `src/data/repositories/DentalChartRepository.test.ts`
- `src/data/hooks/useDentalChart.ts`
- `src/data/hooks/useDentalChart.test.tsx`
- `src/data/hooks/useClinicalWorkflow.ts`
- `src/data/hooks/useClinicalWorkflow.test.tsx` (new)
- `_ai_work/REPORTS/DENTALCHART-REAL-001A_supabase_dental_chart_repository_implementation.md`

## 3. What was implemented
- `SupabaseDentalChartRepository`: Implements `getDentalChart` and `saveDentalChart` against the `dental_charts` and `tooth_states` Supabase tables.
- `createDentalChartRepository`: Factory function routing to Supabase or `LocalStorageDentalChartRepository`.
- `useDentalChart`: Hook updated to memoize repository creation based on `authMode` and `activeTenant`.
- `useClinicalWorkflow`: Hook updated to dynamically construct the `ClinicalWorkflowOrchestrator` to properly route saves from the tooth editor to either the Supabase or local repositories for charts and findings. Treatment plans remain strictly local.

## 4. Factory/routing behavior
- When `backend === 'supabase'` and a `tenantId` is provided, `createDentalChartRepository` and `createFindingsRepository` return instances of their respective Supabase repositories.
- Otherwise (no tenant, dev mode, missing configuration), they fall back to LocalStorage.
- This ensures no-tenant mode does not throw unexpected Supabase RLS errors or crash the UI.

## 5. Supabase query design
- **`getDentalChart`**:
  - Fetches the chart from `dental_charts` by `tenant_id` and `patient_id` (`maybeSingle`).
  - Fetches associated teeth from `tooth_states` by `tenant_id` and `dental_chart_id`.
  - Maps db results to `DentalChart`. If any of the 32 teeth are missing, they are merged with default healthy teeth.
  - If no chart exists, it gracefully returns a default empty chart without writing to the database (Read-only get).
- **`saveDentalChart`**:
  - **Stable Chart ID Strategy**: First selects the existing chart by `tenant_id` + `patient_id`. If it exists, reuses its `id` to guarantee safety with FK-linked `tooth_states`. If it doesn't exist, generates a new UUID once.
  - Upserts the chart into `dental_charts` with `onConflict: 'tenant_id,patient_id'`.
  - Prepares 32 rows for `tooth_states` and uses bulk `upsert` with `onConflict: 'dental_chart_id,tooth_number'`.

## 6. DentalChart mapping details
- **Frontend -> DB**:
  - `patientId` -> `patient_id`
  - `complaints` -> `complaints`
  - `diagnosis` -> `diagnosis`
- **DB -> Frontend**:
  - Reverses the mapping.
  - Returns `createdAt` and `updatedAt` from database timestamps.

## 7. Tooth states mapping details
- **Frontend -> DB**:
  - `toothNumber` -> `tooth_number`
  - `condition` -> `condition`
  - `surfaces` -> `surfaces` (array)
  - `crown` -> `crown`
  - `root` -> `root`
  - `gum` -> `gum`
  - `bone` -> `bone`
  - `canal` -> `canal`
  - `notes` -> `notes`
- **DB -> Frontend**:
  - Reverses the mapping cleanly, providing fallback defaults (e.g. `[]` for surfaces if null) to satisfy the strict TS types.

## 8. ID/UUID/local ID safety
- Supabase enforces UUIDs for chart `id`. The repository always checks for existing UUIDs, and generates `crypto.randomUUID()` exclusively when creating new records. Local IDs (`chart_p1`) are never sent to Supabase.
- Tooth states do not use explicit frontend IDs. They rely on the composite `dental_chart_id` and `tooth_number` for upsert constraints.
- Local mode continues using `chart_${patientId}` without impact.

## 9. Tenant/RLS/FK safety
- Every Supabase query explicitly filters by `tenant_id`.
- Chart upserts rely on `tenant_id,patient_id` conflict resolution.
- Tooth upserts rely on `dental_chart_id,tooth_number` conflict resolution, while still sending `tenant_id` for RLS evaluation.

## 10. Transaction limitation / partial-save risk
- **Limitation Documented**: Supabase REST does not support multi-table atomic transactions natively.
- **Risk**: A network error could theoretically occur between upserting the chart and upserting the tooth states.
- **Mitigation**: We perform the chart upsert first, then the bulk tooth upsert. If the second fails, the chart still exists (potentially without the newest tooth updates). We rely on standard REST error throwing.

## 11. Tests added/updated
- **DentalChartRepository.test.ts**:
  - Verified factory fallback behavior.
  - Verified `SupabaseDentalChartRepository.getDentalChart` calls correct tables and merges default teeth.
  - Verified `SupabaseDentalChartRepository.saveDentalChart` uses stable existing chart IDs and correctly performs upserts.
- **useDentalChart.test.tsx**:
  - Validated context-based routing, ensuring `authMode="dev"` or missing tenant routes to local fallback, and `supabase-active` with tenant routes to Supabase.
- **useClinicalWorkflow.test.tsx**:
  - Validated that the orchestrator routes to Supabase DentalChart/Findings repositories in `supabase-active` mode, and safely falls back to local ones otherwise.

## 12. Commands run
```bash
npm run lint
npm test
npm run build
```

## 13. Results of npm run lint
Passed. No ESLint warnings or errors in the updated files.

## 14. Results of npm test
Passed. All unit tests, including the new repository and hook routing tests, execute successfully.

## 15. Results of npm run build
Passed. The application successfully compiles and builds.

## 16. What was NOT changed
- **TreatmentPlansRepository** was not implemented.
- **Automatic treatment plan generation** was not touched.
- **FindingsRepository** was not changed.
- **Supabase migrations** were not changed.
- `supabase/seed.sql` was not changed.
- Browser QA was not performed and must be separate `DENTALCHART-REAL-001B`.

## 17. Known limitations
- Local Storage behavior generates charts silently on read (`storage.createDefaultDentalChart`). Supabase mode mimics this to the frontend but does not persist the default chart on a purely `GET` request.

## 18. Final verdict
**PASS**. The Supabase repository for Dental Charts is cleanly implemented and safely insulated behind the factory pattern.

## 19. Recommended next task
**DENTALCHART-REAL-001B**: Real browser QA for Supabase dental chart to verify the UI interaction works correctly.
