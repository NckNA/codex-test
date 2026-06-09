# ARCH-070: Supabase SQL Local Validation Report

## Validation Environment Status
- **Docker availability:** `Docker version 29.5.3, build d1c06ef`
- **Supabase CLI availability:** Installed as local devDependency (`npx supabase`).

## Status
**COMPLETED**

## Validation Results

1. **Schema Initialization & Seed:** 
   `0001_initial_schema.sql` ran cleanly. Mock data from `supabase/seed.sql` inserted successfully.
2. **Table Existence:** 
   Confirmed all 16 tables exist in the `public` schema.
3. **RLS Configuration:** 
   Confirmed RLS is enabled on all tenant-owned tables.
4. **Integration Tokens Security:** 
   Confirmed `integration_tokens` has RLS enabled with 0 frontend policies, ensuring it is backend-only.
5. **Audit Logs Security:** 
   Confirmed `audit_logs` has only SELECT (`r`) and INSERT (`a`) policies. No UPDATE or DELETE policies exist.
6. **Cross-Tenant FK Constraints:** 
   - Attempting to insert an appointment with `tenant B` using a patient from `tenant A` correctly failed with a foreign key violation on `appointments_tenant_id_patient_id_fkey`.
   - Attempting to insert a `tooth_state` with `tenant B` using a `dental_chart` from `tenant A` correctly failed.
   - Attempting to insert a `treatment_stage` with `tenant B` using a `treatment_plan` from `tenant A` correctly failed.
7. **Doctor Deletion Behavior (ARCH-069-FIX-2 check):** 
   - Confirmed that deleting a doctor safely sets `appointments.doctor_id` to `NULL` while retaining the `appointments.tenant_id`. Data context was not corrupted.

## Constraints Confirmations
- **Explicit confirmation that `src/*` was not touched:** Confirmed.
- **Explicit confirmation that `package.json` is unchanged except for `supabase` CLI:** Confirmed.
- **Explicit confirmation that no Supabase SDK was installed:** Confirmed.
- **Explicit confirmation that no real cloud resources were created:** Confirmed.
- **Explicit confirmation that no real secrets were added:** Confirmed.

## Recommended Next Task
**ARCH-071 — Full project readiness audit**
