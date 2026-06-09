# RECON-APPOINTMENT-REAL-002: Update AppointmentRepository Migration Plan

## Summary
This document updates the migration plan for `AppointmentRepository` from `localStorage` to Supabase, following the successful implementation and Real Browser QA of `SupabaseDoctorRepository` (DOCTOR-REAL-001C). The major blocker—`doctor_id` Foreign Key violations due to non-UUID local doctors—has been completely resolved. The frontend Schedule UI correctly utilizes the Supabase UUID doctors, seamlessly extracting UUIDs into the `AppointmentModal` without crashes. The application is now fully cleared to migrate the `AppointmentRepository` data layer.

## Files Inspected
- `src/data/repositories/AppointmentRepository.ts`
- `src/data/hooks/useScheduleAppointments.ts`
- `src/components/schedule/AppointmentModal.tsx`
- `src/pages/SchedulePage.tsx`
- `src/types/index.ts`
- `src/utils/storage.ts`
- `supabase/migrations/0001_initial_schema.sql`
- `_ai_work/REPORTS/RECON-APPOINTMENT-REAL-001_appointment_repository_supabase_migration_plan.md`
- `_ai_work/REPORTS/DOCTOR-REAL-001C_real_browser_qa_supabase_doctor_source.md`

## 1. What Changed Since RECON-APPOINTMENT-REAL-001
- `DoctorRepository` now explicitly supports Supabase via `SupabaseDoctorRepository`.
- Supabase doctors (`Demo Clinic A`) have fixed, stable UUIDs.
- Schedule UI has passed real browser QA handling these UUID doctors flawlessly.
- `AppointmentModal` receives the correct UUID `doctorId` and corresponding `cabinet` correctly from the DOM interaction.
- Old `d1/d2` local appointments vanish in `supabase-active` mode because they fail the doctor ID match, safely avoiding UI crashes.

## 2. Current AppointmentRepository Shape
- **Interface Methods**: `listAppointmentsByPatient(patientId)`, `listAppointments()`, `createAppointment(appointment)`, `updateAppointment(appointment)`, `deleteAppointment(appointmentId)`.
- **LocalStorage Behavior**: Fully synchronous writes to `localStorage` via `storage.ts`.
- **Sorting/Filtering**: `listAppointmentsByPatient` manually filters by `patientId` and sorts by `start` descending. `listAppointments` returns the raw array for the UI to filter by date/doctor.
- **ID Generation Expectations**: Currently, `AppointmentModal.tsx` generates non-UUID IDs (`a${new Date().getTime()}`) if no `id` is provided.
- **Payload Expectation**: `createAppointment` and `updateAppointment` expect the full `Appointment` object.
- **Blocked Slots**: Can be created. The `patientId` is typically an empty string `""` or `undefined` instead of a strict `null`.

## 3. Supabase Appointments Schema Fit
The `appointments` table aligns nearly perfectly with the frontend `Appointment` type:
- `id`: `uuid` (PRIMARY KEY)
- `tenant_id`: `uuid` (NOT NULL, used for isolation and RLS)
- `patient_id`: `uuid` (Nullable, perfect for blocked slots, FK to `patients`)
- `doctor_id`: `uuid` (Nullable, but required by UI, FK to `doctors`)
- `cabinet`, `service`, `comment`: `text`
- `status`: Enforced `CHECK` constraint matching frontend `AppointmentStatus`.
- `payment_type`: Enforced `CHECK` constraint matching frontend `PaymentType`.
- `source`: Enforced `CHECK` constraint matching frontend `Source`.
- `price`: `numeric(10,2)`
- `start_time`, `end_time`: `timestamptz`
- **Indexes**: `idx_appointments_tenant_id`, `idx_appointments_patient_id`.
- **RLS Policies**: Standard tenant isolation. **Crucially, DELETE requires `clinic_admin` or `clinic_owner` roles.**

## 4. Remaining Blockers
There are no hard blockers left, but several implementation details must be handled cautiously:
- **IDs**: `AppointmentModal.tsx` generates non-UUID strings (`a...`). This MUST be updated to `crypto.randomUUID()`.
- **Nullable patient_id**: Empty strings `""` from the frontend for `patientId` must be explicitly converted to `null` before inserting into Postgres to satisfy the UUID type and FK constraints.
- **Delete Policy Risk**: The `appointments` table enforces that only admins can delete. A standard `registrar` will get an RLS rejection. This is intended but must be handled gracefully in the UI/repository.
- **Timezone Conversion**: Frontend `start` and `end` are local datetime-local strings. Postgres `timestamptz` requires strict ISO strings.

## 5. Required Implementation Strategy
**Scope for APPOINTMENT-REAL-001A**:
- Create `SupabaseAppointmentRepository` implementing `IAppointmentRepository`.
- Expose `createAppointmentRepository({ backend, tenantId })` factory.
- Route `useScheduleAppointments` to resolve the backend based on:
  `authMode === 'supabase-active' && activeTenant?.tenantId && isSupabaseConfigured => supabase` (otherwise `local`).
- Update `AppointmentModal.tsx` to generate `crypto.randomUUID()` instead of `a...`.
- Ensure dev mode remains firmly locked to `LocalStorageAppointmentRepository`.
- **Out of Scope**: Do not migrate TreatmentPlans/DentalCharts. Do not change DoctorRepository or PatientRepository.

## 6. Mapping Design
**Frontend `Appointment` -> Supabase DB Row**:
- `id` -> `id` (must be UUID)
- `patientId` -> `patient_id` (convert `""` or `undefined` to `null`)
- `doctorId` -> `doctor_id`
- `cabinet` -> `cabinet`
- `service` -> `service`
- `status` -> `status`
- `paymentType` -> `payment_type` (convert `""` to `null`)
- `source` -> `source` (convert `""` to `null`)
- `price` -> `price` (or `0`)
- `comment` -> `comment` (convert `""` to `null`)
- `start` -> `start_time` (Ensure ISO conversion if needed, or rely on Postgres casting)
- `end` -> `end_time`

**Supabase DB Row -> Frontend `Appointment`**:
- Reverse mapping of above snake_case to camelCase properties. Return `patientId` as string or `undefined` to match UI expectations.

## 7. Query Design
- **`listAppointments()`**: `supabase.from('appointments').select('*').eq('tenant_id', tenantId)`
- **`listAppointmentsByPatient(patientId)`**: `supabase.from('appointments').select('*').eq('tenant_id', tenantId).eq('patient_id', patientId).order('start_time', { ascending: false })`
- **`createAppointment(appointment)`**: `supabase.from('appointments').insert({ tenant_id: tenantId, ...mappedData })`
- **`updateAppointment(appointment)`**: `supabase.from('appointments').update(mappedData).eq('tenant_id', tenantId).eq('id', appointment.id)`
- **`deleteAppointment(appointmentId)`**: `supabase.from('appointments').delete().eq('tenant_id', tenantId).eq('id', appointmentId)`

## 8. ID Strategy
- Update `AppointmentModal.tsx` to generate `crypto.randomUUID()` upon creation. This guarantees compatibility with both Supabase (`uuid` columns) and legacy `localStorage` while standardizing the format immediately.

## 9. Tests Required
- Factory routing test (`local` vs `supabase`).
- Data mapping tests verifying `start` maps to `start_time` and `patientId: ""` maps to `null`.
- Query parameter validation tests (verifying `tenantId` is always appended).
- Ensure error throwing propagates properly to `useScheduleAppointments`.
- Verification that Dev fallback triggers local storage repository.

## 10. Browser QA Plan
Must utilize Chrome DevTools MCP:
- Login as a mapped tenant user in `supabase-active` mode.
- Open the Schedule page.
- Create a blocked slot (empty patient) under a UUID doctor; verify Postgres insertion.
- Create a normal appointment for a seeded Supabase patient; verify Postgres insertion.
- Drag-and-drop or modify the appointment; verify Postgres update.
- Delete the appointment (requires `clinic_admin` mapping); verify Postgres deletion.
- Log out, disable `.env.local`, login in dev mode, verify local fallback operates perfectly.

## 11. Risks
- **Mixed Backend**: Appointments in Supabase will not have corresponding local Treatment Plans or Dental Charts. They will appear as isolated entities until the remaining repositories migrate. This is accepted.
- **Admin-Only Delete**: If a registrar attempts to delete an appointment, the UI will throw a Supabase error.
- **Nullable patient_id**: Care must be taken to not insert an empty string into a `uuid` column.

## 12. Final Verdict
- **READY** for `APPOINTMENT-REAL-001A` (Implement SupabaseAppointmentRepository behind explicit factory).
- **NOT READY** for TreatmentPlansRepository migration.
- **NOT READY** for DentalChartRepository migration.

## 13. Recommended Next Task
**APPOINTMENT-REAL-001A**: Implement SupabaseAppointmentRepository behind explicit factory.
