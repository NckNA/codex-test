# ARCH-068: Supabase Schema and RLS Design Report

## Files Inspected
- `_ai_work/REPORTS/ARCH-067_backend_database_migration_strategy.md`
- `_ai_work/REPORTS/ARCH-066_full_storage_dependency_audit.md`
- `src/data/repositories/PatientRepository.ts`
- `src/data/repositories/AppointmentRepository.ts`
- `src/data/repositories/DoctorRepository.ts`
- `src/data/repositories/DentalChartRepository.ts`
- `src/data/repositories/ChiefComplaintRepository.ts`
- `src/data/repositories/FindingsRepository.ts`
- `src/data/repositories/TreatmentPlansRepository.ts`

## Files Created
- `_ai_work/DATABASE_SCHEMA.md`
- `_ai_work/REPORTS/ARCH-068_supabase_schema_rls_design_report.md` (this file)

## Schema Scope
Drafted comprehensive PostgreSQL table definitions covering the entire SaaS architecture:
- **Tenant Management:** `tenants`, `profiles`, `tenant_users`, `subscriptions`, `audit_logs`.
- **Medical/Clinical:** `patients`, `doctors`, `appointments`, `chief_complaints`, `dental_charts`, `tooth_states`, `findings`, `treatment_plans`, `treatment_stages`, `documents`.
- **Integrations:** `integration_tokens`.

Key structural choices:
- UUIDs for all primary keys to obscure sequential IDs from malicious crawling.
- Explicit `tenant_id` columns on *every single tenant-owned record*.
- `auth.users` linked via `profiles` mapping.

## RLS Scope
Drafted Row-Level Security templates that move multi-tenant data isolation into the database engine:
- SQL Helper functions `get_user_tenants()` and `has_tenant_role()` designed.
- Exact `SELECT`, `INSERT`, `UPDATE`, and `DELETE` policies formulated to enforce boundary checks via `tenant_id IN (SELECT get_user_tenants())`.
- Matrix mapped for complex roles (`platform_admin` vs `clinic_owner` vs `doctor` vs `registrar`).

## Assumptions
- Supabase custom JWT claims or direct database joins will be used to resolve the `tenant_id` associated with a logged-in user.
- The UI will operate exclusively using the `anon` key combined with user sessions.
- AmoCRM webhook integration will be built via Edge Functions operating securely behind the scenes.

## Risks
- **RLS Complexity:** RLS is not magic; a single missing `WITH CHECK` clause can allow data tampering across tenants.
- **Service Role Leaks:** If `service_role` keys touch the frontend code, all RLS protections are completely neutralized.
- Minor RLS wording hardening applied.
- RLS policy coverage matrix added.
- No source code changed.

## Recommended Next Task
**ARCH-069 — Auth and Tenant Foundation Setup (Supabase Project Creation)**
With the schema strictly defined and RLS policies mapped, it is now safe to proceed to implementation. The next task should provision the local or cloud Supabase instance and configure the initial authentication/tenant bootstrapping.

## Confirmations
- **No code changed:** Confirmed. `src/` and `package.json` were strictly untouched.
- **No tools used:** Confirmed. No real cloud resources were created, no SDKs installed, and no Supabase CLI/MCP tools were utilized. This was purely a design exercise.
