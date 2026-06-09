# RECON-PATIENT-REAL-001: PatientRepository Supabase Migration Plan

## Summary
This document outlines the strategy for migrating the `PatientRepository` from `localStorage` to Supabase. This builds upon the successful patterns established in `ChiefComplaintRepository`, leveraging a factory pattern and hook-level routing to ensure zero regression in the `dev` fallback environment while cleanly moving patient data to the backend.

## Files Inspected
- `src/data/repositories/PatientRepository.ts`
- `src/types/index.ts`
- `src/data/hooks/usePatientsCollection.ts`
- `src/data/hooks/usePatientProfile.ts`
- `src/pages/PatientsPage.tsx`
- `src/components/patients/PatientModal.tsx`
- `supabase/migrations/0001_initial_schema.sql`

## 1. Current PatientRepository Shape
- **Interface**: Exposes `getPatientById`, `updatePatient`, `listPatients`, and `createPatient`.
- **Backend Dependency**: Directly bound to `storage.ts` (`localStorage`) via `LocalStoragePatientRepository`. There is currently no factory pattern.
- **Frontend Usage**: `usePatientsCollection` and `usePatientProfile` import `LocalStoragePatientRepository` explicitly.
- **Client Processing**: The UI fetches all patients (`listPatients()`) and performs searching/filtering purely on the client side in `PatientsPage.tsx`.

## 2. Supabase Schema Fit
The Supabase `patients` table perfectly accommodates the frontend `Patient` type:
- `id` (uuid)
- `tenant_id` (uuid)
- `full_name` -> `fullName`
- `birth_date` -> `birthDate`
- `phone` -> `phone`
- `source` -> `source`
- `status` -> `status`
- `notes` -> `notes`
- `allergies` -> `allergies`
- `balance` -> `balance`
- `bonus_balance` -> `bonusBalance`
- `integration` (jsonb) -> `integration`
- `created_at` -> `createdAt`
No schema migrations are required.

## 3. Relationship Impact
- **Positive**: Once patients are created in Supabase, the `ChiefComplaintRepository` will work seamlessly for new patients without hitting Postgres Foreign Key constraint errors.
- **Mixed Backend**: `AppointmentRepository`, `TreatmentPlansRepository`, and `DentalChartRepository` will continue to use `localStorage`. They will store the Supabase-generated Patient UUIDs. This is an expected temporary state and will naturally resolve as we migrate the remaining repositories sequentially.

## 4. Tenant/RLS Readiness
- The system is completely ready. The `TenantContext` already blocks unassigned users from reaching the private routing layer.
- Existing RLS policies (`auth.uid() = user_id` mapped via `tenant_users`) will naturally secure the patients table.

## 5. Proposed Migration Strategy
- **Refactor Repository**: Convert `src/data/repositories/PatientRepository.ts` to expose `createPatientRepository({ backend, tenantId })`.
- **Implement Supabase Class**: Create `SupabasePatientRepository` utilizing the Supabase client.
- **Refactor Hooks**: Update `usePatientProfile` and `usePatientsCollection` to read `authMode` from `useAuth()` and instantiate the repository via the factory, routing to `'supabase'` only when `authMode === 'supabase-active'`, `activeTenant` exists, and Supabase is configured.

## 6. Query Design
- `listPatients`: `supabase.from('patients').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false })`
- `getPatientById`: `supabase.from('patients').select('*').eq('tenant_id', tenantId).eq('id', patientId).maybeSingle()`
- `createPatient`: `supabase.from('patients').insert({ id, tenant_id, ...mappedData })`
- `updatePatient`: `supabase.from('patients').update({ ...mappedData }).eq('tenant_id', tenantId).eq('id', patientId)`

## 7. ID Strategy
- **Current Issue**: `PatientModal.tsx` currently generates IDs using `p${Date.now()}`. This is illegal in Supabase which strictly requires UUIDs.
- **Solution**: Refactor `PatientModal.tsx` to generate IDs using `crypto.randomUUID()`.
- **Safety**: `localStorage` accepts any string, so saving a UUID locally for the `dev` fallback is perfectly safe. The Supabase repository will accept this explicit UUID on `createPatient`, allowing immediate optimistic UI updates without waiting for a DB-generated ID.

## 8. Mixed Backend Risk
While `PatientRepository` operates against Supabase, other domains (Appointments, Treatment Plans, Dental Charts) will remain local. A user switching browsers will see their Supabase patients but lose their `localStorage` appointments. This is a known, expected, and acceptable risk during an incremental migration strategy.

## 9. Tests Required Before Implementation
- Unit tests for `PatientRepository` factory routing.
- Unit tests for `SupabasePatientRepository` DB queries and data mapping (using mocked client).
- Unit tests for `usePatientsCollection` and `usePatientProfile` proving dev mode fallback isolation.

## 10. Browser QA Plan
- Verify local UI behavior with `authMode: dev`.
- Verify Supabase UI behavior with real `authMode: supabase-active`.
- Create a new patient via UI -> Verify creation in Supabase DB.
- Create a Chief Complaint for the new patient -> Verify FK succeeds.
- Confirm RLS isolates patients per clinic.

## 11. Risks/Blockers
- **Blocker**: None.
- **Do NOT do yet**: Do not implement any backfill scripts for legacy local data yet.

## 12. Recommended Next Task
**PATIENT-REAL-001A: Implement SupabasePatientRepository behind explicit factory**
- **Allowed files**: `PatientRepository.ts`, `PatientRepository.test.ts`, `usePatientsCollection.ts`, `usePatientsCollection.test.tsx`, `usePatientProfile.ts`, `usePatientProfile.test.tsx`, `PatientModal.tsx`.
- **Forbidden files**: UI Components (except PatientModal), `storage.ts`, `App.tsx`, migrations.
- **Implementation boundaries**: Implement factory, hook routing, Supabase class, and update `PatientModal` ID generation. Do NOT migrate Appointments or Treatment Plans.

## Final Verdict
- **READY** for `PatientRepository` implementation
- **NOT READY** for `AppointmentRepository` migration
- **NOT READY** for `TreatmentPlansRepository` migration
- **NOT READY** for `DentalChartRepository` migration
