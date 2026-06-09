# DOCTOR-REAL-001A: SupabaseDoctorRepository Implementation Report

## Summary
The `SupabaseDoctorRepository` has been implemented successfully behind an explicit backend routing factory. We seeded 5 deterministic UUID-based doctors into `supabase/seed.sql` for Demo Clinic A, ensuring that `appointments.doctor_id` will have valid foreign keys during the upcoming Appointment migration.

## Changed Files
- `src/data/repositories/DoctorRepository.ts`
- `src/data/repositories/DoctorRepository.test.ts`
- `src/data/hooks/useClinicDoctors.ts`
- `src/data/hooks/useClinicDoctors.test.tsx`
- `supabase/seed.sql`

## Factory Routing Behavior
A new `createDoctorRepository` factory returns:
- `SupabaseDoctorRepository` when `backend === 'supabase'` and `tenantId` is present.
- `LocalStorageDoctorRepository` when `backend === 'local'` or if a tenant is missing.

## Hook Routing Behavior
`useClinicDoctors` automatically resolves the backend dependency:
- In `dev` mode (`authMode !== 'supabase-active'`), it explicitly passes `backend: 'local'`.
- In `supabase-active` mode, if `isSupabaseConfigured` and `activeTenant.tenantId` exist, it passes `backend: 'supabase'`.
- It dynamically recomputes the repo if `authMode` or `tenantId` change.

## Supabase Query Design
- **listDoctors**: `supabase.from('doctors').select('*').eq('tenant_id', tenantId).order('full_name')`
- **listActiveDoctors**: `supabase.from('doctors').select('*').eq('tenant_id', tenantId).eq('active', true).order('full_name')`

Both strictly enforce cross-tenant boundaries by filtering on `tenant_id`. Errors are explicitly thrown, ensuring no silent failures occur. No `create` or `update` queries exist since this interface is strictly read-only.

## Mapping Details
DB row values securely map to frontend `Doctor`:
- `full_name` ➔ `fullName`
- `specialization` ➔ `specialization` (defaults to `''` if null)
- `cabinet` ➔ `cabinet` (defaults to `''` if null)
- `color` ➔ `color` (defaults to `''` if null)
- `active` ➔ `active` (defaults to `true` if null/undefined)

## Seeded Doctors and UUID Strategy
`supabase/seed.sql` now explicitly inserts:
- 5 new doctors for Tenant `11111111-1111-1111-1111-111111111111`.
- Used deterministic UUIDs (`66666666-...-666666666661`).
- Suffix names with `(Supabase)` to quickly visually confirm the DB data source during UI testing.
- Preserved local `demoDoctors` (`d1`, `d2`) unchanged.

## Tests Added/Updated
1. **Repo Tests (`DoctorRepository.test.ts`)**: 
   - Verified factory routes correctly.
   - Verified `SupabaseDoctorRepository` generates the expected Supabase SDK calls with `eq('tenant_id')`.
   - Verified row mapping.
2. **Hook Tests (`useClinicDoctors.test.tsx`)**:
   - Verified `useClinicDoctors` respects `authMode` and `activeTenant`, correctly wiring the `createDoctorRepository` invocation.

## Validation Results
- **Linting**: 0 errors.
- **Tests**: 86 tests passed.
- **Build**: Successfully compiles.

## Dev Fallback Confirmation
Because `src/data/seed.ts` is untouched, any developer running the local mode without Supabase environment variables will still see `d1`, `d2` doctors. The fallback mechanism correctly isolates the two contexts without breaking legacy schedule operations.

## AppointmentRepository Confirmation
`AppointmentRepository`, `useScheduleAppointments.ts`, and Schedule UI components were completely isolated from this PR. No appointment logic was altered.

## Remaining Risks
- The current Schedule UI hasn't been visually verified with the UUID doctors. If the UI makes hardcoded assumptions about doctor IDs, errors might appear in the schedule columns.

## Browser QA Required Next
We must physically test the Schedule page while logged in through Supabase before touching Appointments to ensure the doctor columns render properly from Postgres.

## Final Verdict
- **READY** for DoctorRepository browser QA
- **NOT READY** for AppointmentRepository implementation until doctor browser QA passes
- **NOT READY** for TreatmentPlansRepository migration
- **NOT READY** for DentalChartRepository migration

## Recommended Next Task
**DOCTOR-REAL-001B: Local browser QA for Supabase doctor source and schedule columns**
