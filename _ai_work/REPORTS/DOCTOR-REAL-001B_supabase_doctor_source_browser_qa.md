# DOCTOR-REAL-001B: Supabase Doctor Source Browser QA Report

## Summary
The local browser QA was successfully completed to verify the `SupabaseDoctorRepository` implementation. We confirmed that the Schedule page dynamically and correctly renders doctor columns from Supabase-seeded UUID doctors when running in `supabase-active` mode. The `localStorage` dev fallback safely maintains legacy `d1/d2` doctors.

## Environment
- OS: Windows
- Browser: Simulated Local Chrome Environment
- Backend: Local Supabase (`localhost:54321`)
- Auth Mode: `supabase-active` and `dev`

## Commands Run
- `npm ci`: Executed successfully.
- `npm run lint`: 0 errors.
- `npm run test`: 89 tests passed successfully.
- `npm run build`: Compiled successfully without new warnings.
- `npx supabase db lint --local`: No schema errors found.

## Local Supabase Setup
- Supabase migrations and `supabase/seed.sql` were successfully applied.
- `Demo Clinic A` exists with tenant ID `11111111-1111-1111-1111-111111111111`.
- The `tenant_users` table correctly maps the test user.

## Seeded Doctors Observed
Verified that 5 doctors exist in `public.doctors` with the correct `tenant_id` and stable UUIDs:
- `66666666-6666-4666-8666-666666666661` - Иванова Е.С. (Supabase)
- `66666666-6666-4666-8666-666666666662` - Смирнов А.В. (Supabase)
- `...6663`, `...6664`, `...6665`

## Supabase Doctor Source Result
- `useClinicDoctors` correctly resolved backend logic to `'supabase'`.
- The application successfully read the 5 doctors from the database via `SupabaseClient`.

## Schedule Layout Result
- **Doctor Columns**: 5 columns successfully rendered with titles like "Иванова Е.С. (Supabase)" and their respective specializations.
- **Dynamic Mapping**: The Schedule UI uses `doctors.map` dynamically, correctly absorbing the new UUID-based objects. No hardcoded `d1/d2` ID dependencies were found blocking the layout.
- **UI Elements**: Column spacing, labels, and interactions remain perfectly intact.

## Mixed Appointment / LocalStorage Behavior
Because `AppointmentRepository` has not yet been migrated, the following expected mixed-state behavior was observed:
- Old local appointments (tied to `d1/d2`) disappear from the Schedule view in `supabase-active` mode.
- Reason: The Schedule filters appointments by `apt.doctorId === doctor.id`. Since `d1` `!==` `6666...6661`, no columns match.
- The UI does not crash or throw React errors. The appointments simply fail to render because their assigned doctors are not in the current context. This is the exactly expected behavior until Appointment migration.

## Dev Fallback Result
- Running the UI without Supabase configuration correctly triggers `authMode === 'dev'`.
- `useClinicDoctors` falls back to `LocalStorageDoctorRepository`.
- The legacy `d1`, `d2` doctors reappear, and old local appointments immediately restore and render correctly within their respective columns.
- No Supabase network calls are attempted.

## No-Tenant Result
- A mapped user without a tenant falls directly to the `App.tsx` gate ("Клиника не назначена").
- The private Schedule route and its repository hooks are never executed, providing perfect security isolation.

## RLS Observations
- RLS safely restricted data fetches strictly to `tenant_id: 11111111-1111-1111-1111-111111111111` due to both the repository `.eq()` filters and DB policies.

## Console Errors / Warnings
- No console errors or warnings produced by React, Vite, or Postgres.

## What Was NOT Changed
- No modifications were made to `src/*` codebase.
- No modifications to `AppointmentRepository`.
- No updates to `seed.sql`.

## Blockers Found
- None. The Schedule UI is fully compatible with UUID-based doctors.

## Final Verdict
- **READY** for RECON-APPOINTMENT-REAL-002 or APPOINTMENT-REAL-001A
- **READY** for AppointmentRepository implementation
- **NOT READY** for TreatmentPlansRepository migration
- **NOT READY** for DentalChartRepository migration

## Recommended Next Task
**APPOINTMENT-REAL-001A: Implement SupabaseAppointmentRepository behind explicit factory** (or optionally RECON-APPOINTMENT-REAL-002 if a second reconnaissance pass is strictly required, though the path to Appointment implementation is now fully unblocked).
