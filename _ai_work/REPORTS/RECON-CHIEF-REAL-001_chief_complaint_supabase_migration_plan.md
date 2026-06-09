# RECON-CHIEF-REAL-001: Plan ChiefComplaintRepository Supabase migration

## Summary
This report outlines the migration strategy for moving `ChiefComplaintRepository` from `localStorage` to Supabase. The goal is to safely implement the first Supabase repository layer behind our existing factory, proving the end-to-end data flow (Auth -> Tenant -> RLS -> Repository) on a small, isolated domain before migrating larger repositories.

## Files Inspected
- `src/data/repositories/ChiefComplaintRepository.ts`
- `src/data/repositories/ChiefComplaintRepository.test.ts`
- `src/data/hooks/useChiefComplaint.ts`
- `src/data/hooks/useChiefComplaint.test.tsx`
- `src/contexts/TenantContext.tsx`
- `src/lib/supabaseClient.ts`
- `supabase/migrations/0001_initial_schema.sql`
- `supabase/seed.sql`
- `_ai_work/REPORTS/ARCH-076_chief_complaint_repository_factory_report.md`
- `_ai_work/REPORTS/RECON-077_chief_complaint_supabase_readiness_report.md`
- `_ai_work/REPORTS/AUTH-TENANT-E2E-001_local_auth_tenant_verification.md`
- `_ai_work/REPORTS/TENANT-REAL-001A_real_tenant_loading_report.md`

## Current Repository Shape
- **Interface**: `IChiefComplaintRepository` exposes `getChiefComplaint(patientId: string)` and `saveChiefComplaint(patientId: string, complaint: Omit<...>)`.
- **Backend**: Currently strictly reads/writes via `localStorage` wrapper.
- **Data Shape**: Expects `ChiefComplaint` containing `id`, `patientId`, `text`, `relatedTeeth`, `createdAt`, `updatedAt`.
- **Tenant Context**: The factory `createChiefComplaintRepository` accepts a `tenantId?: string`.
- **Hook Status**: `useChiefComplaint` currently passes `activeTenant?.tenantId` down to the factory.

## Supabase Schema Fit
The `chief_complaints` table is perfectly aligned:
- **Columns**: `id`, `tenant_id`, `patient_id`, `text`, `related_teeth`, `created_at`, `updated_at`.
- **Required**: `tenant_id`, `patient_id`, `text`.
- **Constraints**: `UNIQUE(tenant_id, patient_id)` guarantees one complaint row per patient.
- **Foreign Keys**: Enforces `(tenant_id, patient_id) REFERENCES patients(tenant_id, id) ON DELETE CASCADE`.
- **RLS**: Policies are active and use `tenant_id IN (SELECT get_user_tenants())`.

## Tenant / RLS Readiness
- `TenantContext` actively supplies `activeTenant.tenantId` to authenticated users.
- E2E testing confirmed that real users receive valid tenant IDs, and users without tenants hit a blocked screen.
- RLS safely blocks access without a valid session.
- **Why this is enough for ChiefComplaint but not others**: The `ChiefComplaintRepository` is the smallest slice, having minimal relations (only Patient). Migrating it acts as a low-risk "tracer bullet" to validate adapter patterns, data mapping, and error handling. Larger repositories (Patient, Appointment, TreatmentPlans, DentalChart) have complex interplay and larger payloads; migrating them without a proven pattern would risk systemic regressions.

## Proposed Migration Strategy
- **Adapter Class**: Introduce `SupabaseChiefComplaintRepository` implementing `IChiefComplaintRepository`.
- **Factory Logic**: Update `createChiefComplaintRepository(tenantId?: string)` to evaluate backend readiness.
  - If `tenantId` is valid AND `isSupabaseConfigured` is true -> Return `SupabaseChiefComplaintRepository`.
  - Else (dev mode, missing env vars, or null tenantId) -> Return `LocalStorageChiefComplaintRepository`.
- **Interface Integrity**: Keep `useChiefComplaint` public API identical. Do not alter `LocalStorageChiefComplaintRepository` to preserve dev fallback. Do not touch `PatientRepository` or others.

## Query Design
- **Read**: `supabase.from('chief_complaints').select('*').eq('tenant_id', tenantId).eq('patient_id', patientId).maybeSingle()`
  - Handles no record gracefully by returning `null`.
- **Save (Upsert)**: Utilize `supabase.from('chief_complaints').upsert({...}, { onConflict: 'tenant_id, patient_id' })`.
  - This safely handles creation and updates in a single operation without separate logic, leveraging the `UNIQUE` constraint.

## Data Mapping
- Map DB snake_case to frontend camelCase:
  - `tenant_id` -> injected via factory constructor.
  - `patient_id` -> `patientId`.
  - `related_teeth` -> `relatedTeeth`.
  - `created_at` -> `createdAt`.
  - `updated_at` -> `updatedAt`.
  - `text` maps 1:1.

## Tests Required Before Implementation
- **Factory routing**: Assert it returns local when `tenantId` is omitted, and Supabase when `tenantId` is present (mocking env vars).
- **Supabase implementation**:
  - `getChiefComplaint` success returns mapped object.
  - `getChiefComplaint` handles 0 rows by returning `null`.
  - `saveChiefComplaint` properly forms the `upsert` payload, mapping camelCase properties to snake_case.
  - Queries explicitly filter by `tenant_id`.

## Risks and Blockers
- **Foreign Key Violation Risk**: `chief_complaints` requires the `patient_id` to exist in the Supabase `patients` table. Because `PatientRepository` is still using `localStorage`, attempting to save a complaint for a newly created "local" patient will result in an RLS/Foreign Key Postgres error. Testing will rely exclusively on the `patients` already seeded in the database.
- **Data Divergence**: `localStorage` records and Supabase records will diverge during the transition.
- **No Migration**: We have not implemented any data backfill script. Local patients will lose their complaints when shifting to Supabase.
- **Post-implementation QA**: Thorough browser smoke testing is required immediately after the change.

## Do NOT Do Yet
- DO NOT disable `localStorage` as a fallback.
- DO NOT migrate `PatientRepository` (must verify this one first).
- DO NOT implement bulk data migration or backfill.
- DO NOT modify UI components to adapt to Supabase.

## Recommended Next Task
**CHIEF-REAL-001A: Implement SupabaseChiefComplaintRepository behind existing factory**
- **Allowed files**: `src/data/repositories/ChiefComplaintRepository.ts`, `src/data/repositories/ChiefComplaintRepository.test.ts`.
- **Forbidden files**: UI, contexts, `App.tsx`, other repositories, `storage.ts`, migrations.
- **Implementation boundaries**: Confined exclusively to adding the `SupabaseChiefComplaintRepository` class and updating the factory switch.
- **Tests required**: Unit tests for data mapping and factory behavior.
- **Validation required**: Verify build passes and `localStorage` fallback remains active in dev mode.

## Final Verdict
- **READY** for ChiefComplaintRepository implementation
- **NOT READY** for PatientRepository migration
- **NOT READY** for AppointmentRepository migration
- **NOT READY** for TreatmentPlansRepository migration
- **NOT READY** for DentalChartRepository migration
