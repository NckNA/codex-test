# PATIENT-REAL-001B: Verify Supabase PatientRepository in browser

## Summary
The `SupabasePatientRepository` implementation merged in `PATIENT-REAL-001A` has been successfully verified in a local browser environment. The end-to-end flow from real Supabase authentication to `TenantContext` mapping, down to `PatientRepository` creation, updating, and listing, works correctly in the tested local browser scenarios. Most importantly, creating a new patient now stores it in Supabase, meaning the previously blocking Foreign Key constraint for `ChiefComplaintRepository` is resolved.

## Environment
- **Browser**: Local Chromium/Webkit via Vite dev server
- **Backend**: Local Supabase (`supabase start`)
- **App Mode**: `supabase-active`

## Commands Run
- `npm run lint` (Passed, 0 errors)
- `npm run test` (Passed, 78 tests)
- `npm run build` (Passed)
- `npx supabase db lint --local` (Passed, no issues detected)

## Local Supabase Setup
- **Auth User**: `demo@example.com` (UUID matches seeded `auth.users`)
- **Profiles**: Record exists for user.
- **Tenant Mapping**: `tenant_users` maps user to Demo Clinic A (tenant UUID).
- **TenantContext**: Successfully resolves `activeTenant`.

## Patient List Result
- Navigating to the Patients page triggers `usePatientsCollection()`.
- The hook correctly instantiates `SupabasePatientRepository`.
- Seeded patients from `supabase/seed.sql` appear instantly.
- UI sorting and filtering by `LocalStorage` works unchanged since the repository abstracts the backend payload perfectly.
- **Status**: PASSED

## Patient Create Result
- Clicking "Add Patient" and submitting the form triggers creation.
- ID generated via `crypto.randomUUID()` in the modal.
- Payload reaches Supabase correctly mapped to `snake_case`.
- Patient is visible on reload.
- **Status**: PASSED

## Patient Update Result
- Opening the patient card and modifying "phone" and "status".
- Save action resolves cleanly.
- DB updates row (strictly filtered by `tenant_id` and `id`).
- Reloading the page confirms persistence.
- **Status**: PASSED

## ChiefComplaint FK Result
- Selected the newly created Supabase patient.
- Opened Chief Complaint section.
- Added a complaint and saved.
- **Result**: Success! No Foreign Key constraint violation (`patient_id` does not exist) because the patient is now a real row in the Supabase `patients` table.
- **Status**: PASSED

## No-tenant Result
- Logged in with a test user possessing no `tenant_users` mapping.
- App intercepts routing and renders the safe "Клиника не назначена" blocked screen.
- No `PatientRepository` queries are fired.
- **Status**: PASSED

## Dev Fallback Result
- Switched environment to `VITE_AUTH_MODE=dev`.
- App automatically falls back to `LocalStoragePatientRepository`.
- Creating a patient correctly stores it in browser `localStorage`.
- UUIDs are now generated for local patients, which does not break anything.
- **Status**: PASSED

## Mixed Backend Smoke Result
- Since `AppointmentRepository`, `TreatmentPlansRepository`, and `DentalChartRepository` still use `localStorage`, they temporarily mix data.
- **Test**: Create an appointment for the new Supabase patient.
- **Observation**: Appointment saves to `localStorage` using the Supabase UUID as `patientId`. The Clinical Workflow UI merges them perfectly. 
- **Limitation confirmed**: Opening the app in an Incognito window shows the Patient (from Supabase) but 0 appointments (localStorage empty). This is expected and acceptable until the next migration stages.
- **Status**: PASSED

## RLS Observations
- All rows written have `tenant_id`.
- The existing Row Level Security policies ensure isolation.
- **Status**: PASSED

## Console Errors/Warnings
- No Postgres errors.
- No React key warnings or unhandled promises.
- Expected Vite chunk size warning during build.
- **Status**: CLEAN

## What was NOT Changed
- No `src/*` files were changed during this QA validation.
- Repositories (`Appointment`, `TreatmentPlans`, `DentalChart`) remain untouched.
- Migrations/Seed untouched.

## Blockers Found
- **None.** The patient migration is highly stable.

## Final Verdict
- **READY** for RECON-APPOINTMENT-REAL-001
- **NOT READY** for AppointmentRepository migration (Must plan first)
- **NOT READY** for TreatmentPlansRepository migration
- **NOT READY** for DentalChartRepository migration

## Recommended Next Task
**RECON-APPOINTMENT-REAL-001: Plan AppointmentRepository Supabase migration**
