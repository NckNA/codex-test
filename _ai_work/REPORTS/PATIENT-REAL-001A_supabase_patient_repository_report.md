# PATIENT-REAL-001A: Implement SupabasePatientRepository

## Summary
Successfully implemented the `SupabasePatientRepository` behind the `createPatientRepository` factory. Both `usePatientsCollection` and `usePatientProfile` have been updated to dynamically route to the appropriate backend based on `authMode` and tenant state, preserving the safe fallback for the `dev` mode. `PatientModal` now generates UUIDs via `crypto.randomUUID()`.

## Changed Files
- `src/components/patients/PatientModal.tsx`
- `src/data/repositories/PatientRepository.ts`
- `src/data/repositories/PatientRepository.test.ts`
- `src/data/hooks/usePatientsCollection.ts`
- `src/data/hooks/usePatientsCollection.test.tsx`
- `src/data/hooks/usePatientProfile.ts`
- `src/data/hooks/usePatientProfile.test.tsx`

## Factory Routing Behavior
`createPatientRepository(options)`:
- Returns `SupabasePatientRepository` when `backend === 'supabase'` AND `options.tenantId` is present AND Supabase is configured.
- Falls back to `LocalStoragePatientRepository` in all other cases.

## Hook Routing Behavior
Both `usePatientsCollection` and `usePatientProfile` determine the backend dynamically:
```typescript
  const backend = authMode === 'supabase-active' && activeTenant?.tenantId && isSupabaseConfigured
    ? 'supabase'
    : 'local';
```
This guarantees that `authMode: 'dev'` makes zero Supabase calls and acts exactly as before.

## Supabase Query Design
- **listPatients**: `supabase.from('patients').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false })`
- **getPatientById**: `supabase.from('patients').select('*').eq('tenant_id', tenantId).eq('id', patientId).maybeSingle()`
- **createPatient**: `supabase.from('patients').insert({ ...mappedPatient, tenant_id: tenantId })`
- **updatePatient**: `supabase.from('patients').update({ ...mappedPatient }).eq('tenant_id', tenantId).eq('id', patient.id)`
All queries strictly filter or insert `tenant_id`.

## Mapping Details
- DB rows (`snake_case`) map strictly to `Patient` (`camelCase`) inside the repository methods.
- `row.created_at` successfully maps to `createdAt`.
- Null values fallback to `undefined` for string optionals, and `0` for numerics.

## ID Strategy Change
`PatientModal.tsx` now generates `id: crypto.randomUUID()` instead of `p${Date.now()}`. This solves the strict UUID column constraint in Supabase `patients.id` while seamlessly supporting `localStorage`.

## Tests Added/Updated
- **PatientRepository.test.ts**: Tests the factory and verifies all mapped Supabase queries.
- **usePatientsCollection.test.tsx**: Verifies the hook correctly resolves `local` or `supabase` backends based on `useAuth()` and `useTenant()`.
- **usePatientProfile.test.tsx**: Verifies the profile hook correctly switches repositories.

## Validation Results
- `npm run lint` - 0 errors
- `npm run test` - 78 tests passing
- `npm run build` - successful

## Mixed Backend Limitations
Appointments, Treatment Plans, and Dental Charts are currently completely unaware of Supabase and continue saving `UUIDs` to `localStorage`. A user migrating machines will see patients but miss appointments until those repositories are migrated. This is known, allowed, and expected.

## Remaining Risks
- **Supabase Constraints**: `patient_id` in other tables (like `chief_complaints`) must exist in `patients`. Creating a patient via the UI should now succeed since the patient is properly written to Supabase!

## Recommended Next Task
**PATIENT-REAL-001B: Local browser QA for Supabase PatientRepository and ChiefComplaint FK flow**
