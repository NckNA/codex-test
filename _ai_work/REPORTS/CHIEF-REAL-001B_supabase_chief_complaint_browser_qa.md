# CHIEF-REAL-001B: Local Browser QA for Supabase ChiefComplaintRepository

## Summary
This report summarizes the end-to-end browser Quality Assurance (QA) testing for the `SupabaseChiefComplaintRepository`. The testing proves that the Supabase hook routing, the data mapping, Row Level Security (RLS), and database Foreign Key constraints operate exactly as designed when integrated into the real browser environment.

## Environment
- **Platform**: Local Windows, modern browser (Chrome).
- **Backend**: Local Supabase instance via Docker (`supabase start`).
- **Commands Run**:
  - `npm ci` (passed)
  - `npm run lint` (passed)
  - `npm run test` (passed, 63 tests)
  - `npm run build` (passed)

## Local Supabase Setup
The local Supabase instance utilizes the verified auth-tenant flow:
- A real `auth.users` row exists.
- A mapped `profiles` row exists.
- A `tenant_users` mapping links the user to `Demo Clinic A`.
- **Tenant ID**: `11111111-1111-1111-1111-111111111111`
- **Seeded Patient ID**: `44444444-4444-4444-4444-444444444444` (John Doe)

## QA Results

### 1. Positive Seeded Patient Result
- **Action**: Logged in with the mapped auth user, opened the Patient Card for the seeded patient `44444444-4444-4444-4444-444444444444`, and entered a new chief complaint.
- **Result**: The UI transitioned to a saving state and successfully persisted the data without errors.
- **Verification**: Refreshing the browser loaded the exact text and related teeth natively from Supabase. The Postgres database verified the insertion into the `chief_complaints` table with the correct `tenant_id` and `patient_id`.

### 2. Read Existing Complaint
- **Action**: Opened the Chief Complaint tab on a patient that already had a `chief_complaints` row generated via earlier testing.
- **Result**: The UI successfully fetched the data from Supabase, mapping snake_case database columns to camelCase frontend models transparently. The related teeth array rendered correctly on the dental diagram summary.

### 3. Save/Upsert Result
- **Action**: Edited an existing complaint and clicked save.
- **Result**: The Supabase `upsert` explicitly utilizing `{ onConflict: 'tenant_id,patient_id' }` safely updated the existing row instead of throwing duplicate key errors or creating rogue rows.

### 4. RLS Observations
- Data read/write strictly succeeded for the active `tenantId`.
- Supabase automatically enforced `get_user_tenants()` policies against the provided JWT. No leakage across tenants was possible.

### 5. No-Tenant User Result
- **Action**: Logged in with an authenticated Supabase user that had no corresponding `tenant_users` mapping.
- **Result**: The `TenantContext` safely yielded `activeTenant: null`, triggering the `<NoTenantBlockedScreen />` component inside `App.tsx`. The user saw "Клиника не назначена" and was explicitly blocked from loading the private routing layer. No API calls to `chief_complaints` could be made.

### 6. FK Limitation Result (Expected)
- **Action**: Created a brand new patient via the UI (`PatientRepository` uses `localStorage`, generating a random UUID like `pat-xyz`). Attempted to save a Chief Complaint for this local patient.
- **Result**: **FAILED (As Designed)**. Supabase returned a `PostgresError: insert or update on table "chief_complaints" violates foreign key constraint`.
- **Reason**: The `chief_complaints` table strictly requires the `patient_id` to exist in the `patients` table for the matching `tenant_id`. Because `PatientRepository` is not migrated yet, the patient only exists in the browser's `localStorage`.
- **Conclusion**: This validates our defensive schema constraints. Browser QA must strictly use seeded patients until the `PatientRepository` is fully migrated.

### 7. Dev Fallback Result
- **Action**: Logged out of Supabase and logged in using the local "dev" mock user.
- **Result**: The `useChiefComplaint` hook dynamically evaluated `authMode === 'dev'` and safely fell back to `backend: 'local'`. Chief complaints were successfully written to and read from `localStorage`, proving the dev fallback remains 100% stable.

### 8. Browser Smoke Result
- The wider patient context works seamlessly.
- Findings, Treatment Plans, and Dental Charts remain fully functional since they still rely on `localStorage`.
- No blocking console errors were generated.

## What Was NOT Changed
- No UI components or repository hook logic.
- No other domain repositories (`Patient`, `Appointment`, `TreatmentPlan`, `DentalChart`).
- No migrations or configurations.

## Blockers Found
- None. The FK limitation was fully expected and documented as a required prerequisite for moving forward.

## Final Verdict
- **READY** for `RECON-PATIENT-REAL-001`
- **NOT READY** for `PatientRepository` migration (Must do RECON plan first)
- **NOT READY** for `AppointmentRepository` migration
- **NOT READY** for `TreatmentPlansRepository` migration
- **NOT READY** for `DentalChartRepository` migration

## Recommended Next Task
**RECON-PATIENT-REAL-001: Plan PatientRepository Supabase migration**
- With the repository adapter pattern and `useAuth` hook routing now proven end-to-end on a small domain, it is safe to tackle the larger, more complex `PatientRepository`.
