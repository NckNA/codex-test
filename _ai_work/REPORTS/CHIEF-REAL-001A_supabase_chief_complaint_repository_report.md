# CHIEF-REAL-001A: Implement SupabaseChiefComplaintRepository

## Summary
The `ChiefComplaintRepository` has been successfully implemented with a Supabase backend while completely preserving the `localStorage` fallback for the development environment. This acts as the first proven repository migration slice, validating the adapter patterns, schema, and routing logic without endangering the larger domain repositories.

## Changed Files
- `src/data/repositories/ChiefComplaintRepository.ts`
- `src/data/repositories/ChiefComplaintRepository.test.ts`
- `src/data/hooks/useChiefComplaint.ts`
- `src/data/hooks/useChiefComplaint.test.tsx`
- `_ai_work/REPORTS/CHIEF-REAL-001A_supabase_chief_complaint_repository_report.md` (Created)

## Implementation Details

### Factory Routing Behavior
The factory signature `createChiefComplaintRepository` was updated to accept an explicit routing configuration object:
```typescript
interface CreateChiefComplaintRepositoryOptions {
  tenantId?: string | null;
  backend: 'local' | 'supabase';
}
```
If `backend` is `'supabase'` and both `tenantId` and `supabase` client are available, it instantiates `SupabaseChiefComplaintRepository`. Otherwise, it safely falls back to `LocalStorageChiefComplaintRepository`.

### Hook Routing Behavior
The `useChiefComplaint` hook dynamically calculates the required backend based on the context:
```typescript
const backend = authMode === 'supabase-active' && activeTenant?.tenantId && isSupabaseConfigured
  ? 'supabase'
  : 'local';
```
This guarantees that `dev` mode always defaults to `localStorage`, even if local Supabase environment variables happen to be configured.

### Supabase Query Design
- **Read**: Uses `supabase.from('chief_complaints').select('*').eq('tenant_id', tenantId).eq('patient_id', patientId).maybeSingle()`. Handles 0 rows gracefully by returning `null`.
- **Write**: Uses `supabase.from('chief_complaints').upsert(..., { onConflict: 'tenant_id,patient_id' })`. This robustly supports both creation and updates within a single query without complex checking, strictly filtering via `tenant_id`.

### Mapping Details
- Converts frontend camelCase (`patientId`, `relatedTeeth`, `createdAt`, `updatedAt`) to Supabase snake_case (`patient_id`, `related_teeth`, `created_at`, `updated_at`).
- Nullable `relatedTeeth` arrays are properly coerced to empty arrays `[]` prior to insertion to satisfy non-null column constraints.

### Tests Added/Updated
1. **Repository Factory**: Tests guarantee the factory returns the correct class instances based on `backend` routing requests and `tenantId` presence.
2. **Repository Implementation**: Tests heavily mock the Supabase client to assert exact query chains, payload mappings, error throwing, and `maybeSingle` null handling.
3. **Hook Routing**: Tests (using React `act` and `createRoot`) strictly assert that when `authMode` is `dev`, the local backend is forced, preventing accidental data leaks or errors if Supabase is running locally.

### Validation Results
- `npm run lint`: Passed (resolved `any` types and TypeScript `--erasableSyntaxOnly` strict parameter property requirements)
- `npm run test`: Passed (63 tests)
- `npm run build`: Passed

## Known Limitations and Remaining Risks
- **Foreign Key Constraints**: Because `PatientRepository` remains strictly local, attempting to save a Chief Complaint for a newly created UI patient will trigger a Postgres Foreign Key constraint violation (`patient_id` must exist in Supabase `patients`).
- **QA Restriction**: Browser QA must exclusively use patients that are already seeded in the local Supabase backend.
- **Data Divergence**: `localStorage` data and Supabase data will remain diverged until a formal data migration strategy is executed.

## Confirmations
- ✅ `PatientRepository` was NOT touched.
- ✅ `AppointmentRepository` was NOT touched.
- ✅ `TreatmentPlansRepository` was NOT touched.
- ✅ `DentalChartRepository` was NOT touched.
- ✅ UI and routing files were NOT touched.

## Recommended Next Task
**CHIEF-REAL-001B: Local browser QA for Supabase ChiefComplaintRepository with seeded backend patient**
- Required to prove that the hook, UI, and Supabase RLS work end-to-end in the browser before moving on to migrating `PatientRepository`.
