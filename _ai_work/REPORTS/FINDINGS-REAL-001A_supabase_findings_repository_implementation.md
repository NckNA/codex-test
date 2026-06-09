# FINDINGS-REAL-001A: SupabaseFindingsRepository Implementation

## Summary
Successfully implemented `SupabaseFindingsRepository` and explicitly routed `usePatientFindings` to use it when the app is in `supabase-active` mode with a valid tenant. `LocalStorageFindingsRepository` is retained as a safe fallback for `dev` mode and missing tenants.

## Files Changed
- `src/data/repositories/FindingsRepository.ts`: Added `SupabaseFindingsRepository`, `createFindingsRepository` factory.
- `src/data/repositories/FindingsRepository.test.ts`: Added unit tests for factory routing, mapping, tenant safety, and CRUD.
- `src/data/hooks/usePatientFindings.ts`: Updated to use the factory via `useMemo`, correctly reacting to `authMode`, `activeTenant`, and `isSupabaseConfigured`.
- `src/data/hooks/usePatientFindings.test.tsx`: Added new tests to verify hook routing logic.

## What was implemented
1. **SupabaseFindingsRepository**: 
   - `listFindingsByPatient`: Filters by `tenant_id` and `patient_id`. Orders by `created_at` descending.
   - `createFinding`: Generates `UUID` using `crypto.randomUUID()`. Maps inputs securely.
   - `updateFinding`: Filters by `tenant_id`, `patient_id`, and `id` before updating fields. Updates `updated_at`.
   - `deleteFinding`: Filters by `tenant_id`, `patient_id`, and `id`. Handles Supabase deletion.

2. **createFindingsRepository Factory**:
   - Routes to `Supabase` if `backend === 'supabase'` and `tenantId` is present.
   - Routes to `LocalStorage` otherwise.

3. **usePatientFindings Hook**:
   - Uses `useMemo` for the repository instance to avoid refetch loops.
   - Preserves manual wrapper around mutations to ensure `refetch` happens sequentially and errors propagate nicely.

## Mapping details
- **Frontend -> DB**:
  - `toothNumber` -> `tooth_number` (with `undefined`/`null` mapped to `null`)
  - `riskDescription` -> `risk_description` (mapped to `null` if undefined)
  - `recommendation` -> `recommendation` (mapped to `null` if undefined)
  - `isChiefComplaintRelated` -> `is_chief_complaint_related`
  - `includeInTreatmentPlan` -> `include_in_treatment_plan`
- **DB -> Frontend**:
  - `tooth_number` -> `toothNumber` (mapped to `undefined` if null)
  - `risk_description` -> `riskDescription` (mapped to `undefined` if null)
  - `recommendation` -> `recommendation` (mapped to `undefined` if null)
  - Enums (`category`, `severity`, `status`) strictly typed via `as FindingCategory` etc.

## Tenant, RLS, and UUID Safety Notes
- **UUIDs**: Findings created in Supabase are assigned a strict `crypto.randomUUID()`. Local strings like `f1` and `f2` stay fully isolated in `dev` mode.
- **Tenant scoping**: Every query (`select`, `insert`, `update`, `delete`) enforces `.eq('tenant_id', this.tenantId)`. This prevents cross-tenant data leakage.
- **RLS**: Since `delete` RLS only allows `clinic_admin`, the UI mutations will gracefully throw the `PostgrestError` up to the UI if a doctor attempts a deletion.

## Tests added
- `FindingsRepository.test.ts`: Added tests for `SupabaseFindingsRepository` mock interactions to ensure `.eq('tenant_id', ...)` and `.eq('patient_id', ...)` are always called.
- `usePatientFindings.test.tsx`: Added hook tests verifying that it routes to Supabase when configured, and falls back to LocalStorage in dev mode or when the tenant is missing.

## Commands run & Results
- `npm run lint`: **0 errors, 0 warnings**
- `npm test`: **116 passed** (including the new Findings repository and hook tests)
- `npm run build`: **Success** (637ms, chunks built perfectly)

## What was NOT changed (Strictly adhered to)
- `TreatmentPlansRepository` was **NOT** implemented.
- `DentalChartRepository` was **NOT** migrated.
- Tooth states and visual logic were **NOT** touched.
- Automatic treatment plan generation was **NOT** implemented.
- Supabase migrations and `seed.sql` were **NOT** changed.
- Dependencies (`package.json`) were **NOT** modified.

## Known Limitations
- Partial Clinical Migration: Since `DentalChartRepository` is still local, users on different devices will see Supabase findings sync correctly, but visual tooth colors will not sync until `DentalChart` is migrated.

## Final Verdict
**SUCCESS**. FindingsRepository is now safely backed by Supabase with proper boundaries, making it ready to supply UUIDs for the upcoming TreatmentPlans migration.

## Recommended Next Task
**FINDINGS-REAL-001B**: Real browser QA for Supabase Findings (using Chrome DevTools MCP to physically interact with the UI).
