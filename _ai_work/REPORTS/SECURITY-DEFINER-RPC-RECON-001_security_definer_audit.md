# SECURITY-DEFINER-RPC-RECON-001: audit SECURITY DEFINER helper functions

## 1. Summary

Read-only Git and dev/test cloud recon was performed for the remaining `SECURITY DEFINER` helper functions in `public`.

Findings:

- `public.get_user_tenants()` and `public.has_tenant_role(target_tenant_id uuid, allowed_roles app_role[])` are the only public `SECURITY DEFINER` functions found in dev/test cloud.
- Both are expected RLS helper functions created by `supabase/migrations/0001_initial_schema.sql`.
- Both are `LANGUAGE sql`, `STABLE`, owned by `postgres`, and configured with `SET search_path = public`.
- Both read `public.tenant_users` scoped by `auth.uid()`.
- Both are heavily referenced by RLS policies: 49 total policies in cloud, with 36 references involving `get_user_tenants()` and 13 involving `has_tenant_role(...)`.
- Direct conversion to `SECURITY INVOKER` is not recommended blindly because these functions are used inside tenant-isolation and role-check RLS policies and read the membership table during RLS evaluation.
- Minimal next hardening should preserve behavior, keep `SECURITY DEFINER`, keep `SET search_path = public`, and tighten direct RPC execution grants.

Important limitation:

- Local Supabase validation was not completed in this run, so the final verdict is `PARTIAL`, not `READY FOR HARDENING PLAN`.

## 2. Branch name

`recon/security-definer-rpc-001`

## 3. PR URL

https://github.com/NckNA/codex-test/pull/TBD

## 4. PR head reviewed before final report update

`TBD`

## 5. Report update commit

N/A because the final report update commit cannot reference itself before creation.

## 6. Changed files summary

Expected report-only PR changed files:

- `[NEW] _ai_work/REPORTS/SECURITY-DEFINER-RPC-RECON-001_security_definer_audit.md`

No migrations, source files, seed files, or existing reports were intentionally changed.

## 7. Project identity

Cloud project inspected read-only:

- **Project name:** `codex-test-cloud`
- **Project ID:** `cwkgxgubvdkkjcslvdgn`
- **Status:** `ACTIVE_HEALTHY`
- **Region:** `ap-northeast-2`
- **Database:** PostgreSQL `17.6.1.127`
- **Environment:** development/test cloud.

## 8. Git audit

### 8.1 Required pre-read status

Read:

- `_ai_work/SOURCES/03_MULTI_TENANT_ARCHITECTURE_RULES.md`
- `_ai_work/SOURCES/04_DATA_ISOLATION_AND_SECURITY.md`
- `_ai_work/SOURCES/11_BACKEND_AND_API_ARCHITECTURE.md`
- `_ai_work/SOURCES/13_STORAGE_AND_MIGRATION_STRATEGY.md`
- `_ai_work/SOURCES/18_TESTING_AND_QUALITY_ASSURANCE_STRATEGY.md`
- `_ai_work/REPORTS/SUPABASE-CLOUD-SCHEMA-RECONCILE-001_cloud_git_drift_audit.md`
- `_ai_work/REPORTS/SUPABASE-CLOUD-SCHEMA-RECONCILE-APPLY-001_apply_0004_0005.md`
- `_ai_work/REPORTS/MULTITENANT-QA-001_runtime_boundary_validation.md`
- `_ai_work/REPORTS/SUPABASE-CLOUD-APPLY-0006-TREATMENT-STAGES-001_apply_0006.md`
- `_ai_work/REPORTS/SUPABASE-RPC-GRANT-CLEANUP-0007_revoke_anon_execute.md`
- `supabase/migrations/0001_initial_schema.sql`
- `supabase/migrations/0002_add_dental_chart_editor_fields_to_tooth_states.sql`
- `supabase/migrations/0003_add_dental_chart_links_to_findings.sql`
- `supabase/migrations/0004_align_findings_status_lifecycle.sql`
- `supabase/migrations/0005_create_clinical_dictionary_items.sql`
- `supabase/migrations/0006_treatment_plan_stage_sync_rpc.sql`
- `supabase/migrations/0007_revoke_anon_execute_from_treatment_plan_rpc.sql`

Pre-read caveat:

- `_ai_work/SOURCES/19_TOOL_REGISTRY_AND_USAGE_POLICY.md` was requested by the task but was not found on current `main` at the specified path. A repository search for `19_TOOL_REGISTRY_AND_USAGE_POLICY` did not return that source file.

### 8.2 Where functions are defined

Both helper functions are created in:

- `supabase/migrations/0001_initial_schema.sql`

Definitions from Git:

```sql
CREATE OR REPLACE FUNCTION get_user_tenants()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION has_tenant_role(target_tenant_id uuid, allowed_roles app_role[])
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND tenant_id = target_tenant_id 
      AND role = ANY(allowed_roles)
  );
$$;
```

### 8.3 Exact signatures and attributes from Git

| Function | Arguments | Return type | Language | Volatility | Security mode | search_path | Grants in Git |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `public.get_user_tenants()` | none | `SETOF uuid` | `sql` | `STABLE` | `SECURITY DEFINER` | `public` | no explicit `REVOKE` / `GRANT` in migrations |
| `public.has_tenant_role(...)` | `target_tenant_id uuid`, `allowed_roles app_role[]` | `boolean` | `sql` | `STABLE` | `SECURITY DEFINER` | `public` | no explicit `REVOKE` / `GRANT` in migrations |

### 8.4 Function body behavior

`public.get_user_tenants()`:

- Reads `public.tenant_users`.
- Filters by `user_id = auth.uid()`.
- Returns only tenant IDs for the current authenticated user context.
- Does not use dynamic SQL.
- Does not accept caller-controlled text SQL.
- Potential leak surface if callable directly: an authenticated caller can ask which tenants their JWT maps to; anon should return no rows if `auth.uid()` is null, but direct anon execution of a `SECURITY DEFINER` function is still advisor-reported and should be tightened.

`public.has_tenant_role(target_tenant_id uuid, allowed_roles app_role[])`:

- Reads `public.tenant_users`.
- Filters by `user_id = auth.uid()`.
- Filters by the supplied `target_tenant_id`.
- Checks membership role against supplied `allowed_roles`.
- Does not use dynamic SQL.
- Potential leak surface if callable directly: authenticated users can probe boolean role membership for tenant IDs they guess. It does not return roles directly, but it can reveal true/false membership/role combinations.

### 8.5 Expected / intentional RLS helper classification

Both functions are expected RLS helpers:

- `get_user_tenants()` is used to enforce tenant membership visibility and write checks.
- `has_tenant_role(...)` is used for admin/owner-scoped destructive or dictionary mutation policies.

They likely use `SECURITY DEFINER` intentionally to avoid recursive RLS failures when policies on tenant-owned tables need to read `tenant_users` during policy evaluation.

### 8.6 Git migration history impact

Inspected migrations:

- `0001_initial_schema.sql`: creates the two helper functions and initial RLS policies.
- `0002_add_dental_chart_editor_fields_to_tooth_states.sql`: no helper function changes.
- `0003_add_dental_chart_links_to_findings.sql`: no helper function changes.
- `0004_align_findings_status_lifecycle.sql`: no helper function changes.
- `0005_create_clinical_dictionary_items.sql`: adds `clinical_dictionary_items` RLS policies that reference the helper functions; does not modify helper function definitions.
- `0006_treatment_plan_stage_sync_rpc.sql`: adds `save_treatment_plan_with_stages(...)` as `SECURITY INVOKER`, not `SECURITY DEFINER`.
- `0007_revoke_anon_execute_from_treatment_plan_rpc.sql`: grant cleanup for `save_treatment_plan_with_stages(...)`; no helper function changes.

Conclusion:

- No later Git migration modifies `get_user_tenants()` or `has_tenant_role(...)`.
- `0006` / `0007` did not introduce new `SECURITY DEFINER` functions.

## 9. Cloud audit

### 9.1 Public SECURITY DEFINER functions found in cloud

Read-only query against `pg_proc` / `pg_namespace` found exactly:

| Function | Arguments | Return type | Language | Volatility | `prosecdef` | Owner | `proconfig` |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `public.get_user_tenants()` | none | `SETOF uuid` | `sql` | `s` / stable | `true` | `postgres` | `search_path=public` |
| `public.has_tenant_role(...)` | `target_tenant_id uuid, allowed_roles app_role[]` | `boolean` | `sql` | `s` / stable | `true` | `postgres` | `search_path=public` |

No additional public `SECURITY DEFINER` functions were found.

### 9.2 Exact cloud function definitions

Cloud `pg_get_functiondef(...)` returned definitions equivalent to Git:

```sql
CREATE OR REPLACE FUNCTION public.get_user_tenants()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.has_tenant_role(target_tenant_id uuid, allowed_roles app_role[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND tenant_id = target_tenant_id 
      AND role = ANY(allowed_roles)
  );
$function$;
```

### 9.3 Cloud grants and effective privileges

Cloud ACL:

| Function | `proacl` | anon EXECUTE | authenticated EXECUTE | PUBLIC EXECUTE |
| :--- | :--- | :--- | :--- | :--- |
| `public.get_user_tenants()` | `{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}` | `true` | `true` | `true` |
| `public.has_tenant_role(...)` | `{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}` | `true` | `true` | `true` |

Risk:

- `PUBLIC EXECUTE = true` means every role inherits broad function execution unless explicitly restricted.
- `anon EXECUTE = true` is directly advisor-reported.
- `authenticated EXECUTE = true` is also advisor-reported because callers can invoke these `SECURITY DEFINER` functions via `/rest/v1/rpc/...`.

### 9.4 Cloud search_path safety

Both functions have explicit:

```text
search_path=public
```

Classification:

- `search_path` is explicit and not the main issue.
- Keeping the explicit search path is still recommended in the next hardening migration.
- The primary hardening target is direct execution grants, not function body behavior.

### 9.5 Cloud advisor warnings

Supabase security advisors were run read-only.

Current results:

| Advisor name | Title | Level | Object | Remediation URL |
| :--- | :--- | :--- | :--- | :--- |
| `rls_enabled_no_policy` | RLS Enabled No Policy | INFO | `public.integration_tokens` | `https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy` |
| `anon_security_definer_function_executable` | Public Can Execute SECURITY DEFINER Function | WARN | `public.get_user_tenants()` | `https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable` |
| `anon_security_definer_function_executable` | Public Can Execute SECURITY DEFINER Function | WARN | `public.has_tenant_role(target_tenant_id uuid, allowed_roles public.app_role[])` | `https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable` |
| `authenticated_security_definer_function_executable` | Signed-In Users Can Execute SECURITY DEFINER Function | WARN | `public.get_user_tenants()` | `https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable` |
| `authenticated_security_definer_function_executable` | Signed-In Users Can Execute SECURITY DEFINER Function | WARN | `public.has_tenant_role(target_tenant_id uuid, allowed_roles public.app_role[])` | `https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable` |

Out of scope:

- `public.integration_tokens` RLS-enabled/no-policy INFO is out of scope for this recon.

## 10. Local audit

Local Supabase audit was **not completed** in this run.

Required local commands not completed:

- `npx supabase status`
- `npx supabase db reset`

Required local read-only checks therefore remain missing:

- local public `SECURITY DEFINER` function inventory;
- local `pg_get_functiondef(...)` definitions;
- local grants for `anon`, `authenticated`, and `PUBLIC`;
- local `search_path` catalog check;
- local RLS dependency map;
- local vs cloud comparison.

No skipped local check is claimed as passed.

### 10.1 Local vs cloud comparison

| Area | Git | Cloud | Local |
| :--- | :--- | :--- | :--- |
| Helper function definitions | inspected | inspected | not run |
| `get_user_tenants()` exists | yes | yes | not run |
| `has_tenant_role(...)` exists | yes | yes | not run |
| `SECURITY DEFINER` mode | yes | yes | not run |
| `SET search_path = public` | yes | yes | not run |
| Grants | no explicit hardening in Git | broad `PUBLIC`, `anon`, `authenticated` execute | not run |
| RLS dependency map | inspected in migrations | inspected in cloud | not run |

Because local validation is missing, final verdict cannot be `READY FOR HARDENING PLAN`.

## 11. RLS dependency map

Cloud policies referencing the helper functions:

| Table | Policy | Command | Helper(s) | USING | WITH CHECK |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `tenants` | `Tenant members can read own metadata` | SELECT | `get_user_tenants` | `id IN (SELECT get_user_tenants())` | null |
| `tenant_users` | `Tenant members read own tenant list` | SELECT | `get_user_tenants` | `tenant_id IN (SELECT get_user_tenants())` | null |
| `subscriptions` | `Tenant members can read subscription` | SELECT | `get_user_tenants` | `tenant_id IN (SELECT get_user_tenants())` | null |
| `patients` | `Users can view patients in their tenant` | SELECT | `get_user_tenants` | `tenant_id IN (SELECT get_user_tenants())` | null |
| `patients` | `Users can insert patients in their tenant` | INSERT | `get_user_tenants` | null | `tenant_id IN (SELECT get_user_tenants())` |
| `patients` | `Users can update patients in their tenant` | UPDATE | `get_user_tenants` | `tenant_id IN (SELECT get_user_tenants())` | `tenant_id IN (SELECT get_user_tenants())` |
| `patients` | `Only admins can delete patients` | DELETE | `has_tenant_role` | `has_tenant_role(tenant_id, ARRAY['clinic_admin'::app_role, 'clinic_owner'::app_role])` | null |
| `doctors` | `Users can view doctors in their tenant` | SELECT | `get_user_tenants` | `tenant_id IN (SELECT get_user_tenants())` | null |
| `doctors` | `Users can insert doctors in their tenant` | INSERT | `get_user_tenants` | null | `tenant_id IN (SELECT get_user_tenants())` |
| `doctors` | `Users can update doctors in their tenant` | UPDATE | `get_user_tenants` | `tenant_id IN (SELECT get_user_tenants())` | `tenant_id IN (SELECT get_user_tenants())` |
| `doctors` | `Only admins can delete doctors` | DELETE | `has_tenant_role` | `has_tenant_role(tenant_id, ARRAY['clinic_admin'::app_role, 'clinic_owner'::app_role])` | null |
| `appointments` | `Users can view appts in their tenant` | SELECT | `get_user_tenants` | `tenant_id IN (SELECT get_user_tenants())` | null |
| `appointments` | `Users can insert appts in their tenant` | INSERT | `get_user_tenants` | null | `tenant_id IN (SELECT get_user_tenants())` |
| `appointments` | `Users can update appts in their tenant` | UPDATE | `get_user_tenants` | `tenant_id IN (SELECT get_user_tenants())` | `tenant_id IN (SELECT get_user_tenants())` |
| `appointments` | `Only admins can delete appts` | DELETE | `has_tenant_role` | `has_tenant_role(tenant_id, ARRAY['clinic_admin'::app_role, 'clinic_owner'::app_role])` | null |
| `chief_complaints` | `Users can view complaints in their tenant` | SELECT | `get_user_tenants` | `tenant_id IN (SELECT get_user_tenants())` | null |
| `chief_complaints` | `Users can insert complaints in their tenant` | INSERT | `get_user_tenants` | null | `tenant_id IN (SELECT get_user_tenants())` |
| `chief_complaints` | `Users can update complaints in their tenant` | UPDATE | `get_user_tenants` | `tenant_id IN (SELECT get_user_tenants())` | `tenant_id IN (SELECT get_user_tenants())` |
| `chief_complaints` | `Only admins can delete complaints` | DELETE | `has_tenant_role` | `has_tenant_role(tenant_id, ARRAY['clinic_admin'::app_role, 'clinic_owner'::app_role])` | null |
| `dental_charts` | `Users can view charts in their tenant` | SELECT | `get_user_tenants` | `tenant_id IN (SELECT get_user_tenants())` | null |
| `dental_charts` | `Users can insert charts in their tenant` | INSERT | `get_user_tenants` | null | `tenant_id IN (SELECT get_user_tenants())` |
| `dental_charts` | `Users can update charts in their tenant` | UPDATE | `get_user_tenants` | `tenant_id IN (SELECT get_user_tenants())` | `tenant_id IN (SELECT get_user_tenants())` |
| `dental_charts` | `Only admins can delete charts` | DELETE | `has_tenant_role` | `has_tenant_role(tenant_id, ARRAY['clinic_admin'::app_role, 'clinic_owner'::app_role])` | null |
| `tooth_states` | `Users can view tooth states in their tenant` | SELECT | `get_user_tenants` | `tenant_id IN (SELECT get_user_tenants())` | null |
| `tooth_states` | `Users can insert tooth states in their tenant` | INSERT | `get_user_tenants` | null | `tenant_id IN (SELECT get_user_tenants())` |
| `tooth_states` | `Users can update tooth states in their tenant` | UPDATE | `get_user_tenants` | `tenant_id IN (SELECT get_user_tenants())` | `tenant_id IN (SELECT get_user_tenants())` |
| `tooth_states` | `Only admins can delete tooth states` | DELETE | `has_tenant_role` | `has_tenant_role(tenant_id, ARRAY['clinic_admin'::app_role, 'clinic_owner'::app_role])` | null |
| `findings` | `Users can view findings in their tenant` | SELECT | `get_user_tenants` | `tenant_id IN (SELECT get_user_tenants())` | null |
| `findings` | `Users can insert findings in their tenant` | INSERT | `get_user_tenants` | null | `tenant_id IN (SELECT get_user_tenants())` |
| `findings` | `Users can update findings in their tenant` | UPDATE | `get_user_tenants` | `tenant_id IN (SELECT get_user_tenants())` | `tenant_id IN (SELECT get_user_tenants())` |
| `findings` | `Only admins can delete findings` | DELETE | `has_tenant_role` | `has_tenant_role(tenant_id, ARRAY['clinic_admin'::app_role, 'clinic_owner'::app_role])` | null |
| `treatment_plans` | `Users can view plans in their tenant` | SELECT | `get_user_tenants` | `tenant_id IN (SELECT get_user_tenants())` | null |
| `treatment_plans` | `Users can insert plans in their tenant` | INSERT | `get_user_tenants` | null | `tenant_id IN (SELECT get_user_tenants())` |
| `treatment_plans` | `Users can update plans in their tenant` | UPDATE | `get_user_tenants` | `tenant_id IN (SELECT get_user_tenants())` | `tenant_id IN (SELECT get_user_tenants())` |
| `treatment_plans` | `Only admins can delete plans` | DELETE | `has_tenant_role` | `has_tenant_role(tenant_id, ARRAY['clinic_admin'::app_role, 'clinic_owner'::app_role])` | null |
| `treatment_stages` | `Users can view stages in their tenant` | SELECT | `get_user_tenants` | `tenant_id IN (SELECT get_user_tenants())` | null |
| `treatment_stages` | `Users can insert stages in their tenant` | INSERT | `get_user_tenants` | null | `tenant_id IN (SELECT get_user_tenants())` |
| `treatment_stages` | `Users can update stages in their tenant` | UPDATE | `get_user_tenants` | `tenant_id IN (SELECT get_user_tenants())` | `tenant_id IN (SELECT get_user_tenants())` |
| `treatment_stages` | `Only admins can delete stages` | DELETE | `has_tenant_role` | `has_tenant_role(tenant_id, ARRAY['clinic_admin'::app_role, 'clinic_owner'::app_role])` | null |
| `documents` | `Users can view docs in their tenant` | SELECT | `get_user_tenants` | `tenant_id IN (SELECT get_user_tenants())` | null |
| `documents` | `Users can insert docs in their tenant` | INSERT | `get_user_tenants` | null | `tenant_id IN (SELECT get_user_tenants())` |
| `documents` | `Users can update docs in their tenant` | UPDATE | `get_user_tenants` | `tenant_id IN (SELECT get_user_tenants())` | `tenant_id IN (SELECT get_user_tenants())` |
| `documents` | `Only admins can delete docs` | DELETE | `has_tenant_role` | `has_tenant_role(tenant_id, ARRAY['clinic_admin'::app_role, 'clinic_owner'::app_role])` | null |
| `audit_logs` | `Tenant members can view audit logs` | SELECT | `get_user_tenants` | `tenant_id IN (SELECT get_user_tenants())` | null |
| `audit_logs` | `Users can insert audit logs in their tenant` | INSERT | `get_user_tenants` | null | `tenant_id IN (SELECT get_user_tenants())` |
| `clinical_dictionary_items` | `Tenant members can view clinical dictionary items` | SELECT | `get_user_tenants` | `tenant_id IN (SELECT get_user_tenants())` | null |
| `clinical_dictionary_items` | `Clinic admins can insert clinical dictionary items` | INSERT | `has_tenant_role` | null | `has_tenant_role(tenant_id, ARRAY['clinic_owner'::app_role, 'clinic_admin'::app_role])` |
| `clinical_dictionary_items` | `Clinic admins can update clinical dictionary items` | UPDATE | `has_tenant_role` | `has_tenant_role(tenant_id, ARRAY['clinic_owner'::app_role, 'clinic_admin'::app_role])` | `has_tenant_role(tenant_id, ARRAY['clinic_owner'::app_role, 'clinic_admin'::app_role])` |
| `clinical_dictionary_items` | `Clinic admins can delete clinical dictionary items` | DELETE | `has_tenant_role` | `has_tenant_role(tenant_id, ARRAY['clinic_owner'::app_role, 'clinic_admin'::app_role])` | null |

Dependency summary:

- `get_user_tenants()`: used in SELECT/INSERT/UPDATE membership checks across tenant-owned tables.
- `has_tenant_role(...)`: used mainly for DELETE policies and clinical dictionary admin mutation policies.

## 12. Risk analysis

### 12.1 Why the functions exist

The functions centralize tenant membership and tenant role checks for RLS policies.

They support the project rule that tenant-owned data must be filtered by current user membership and role. That aligns with the architecture source documents: tenant isolation is a foundational SaaS requirement, not a UI decoration.

### 12.2 What breaks if changed blindly

Blindly converting these helpers to `SECURITY INVOKER` may break RLS because:

- the helpers read `tenant_users` while RLS policies are being evaluated;
- `tenant_users` itself has an RLS policy that depends on `get_user_tenants()`;
- invoker-mode access may hit recursive policy evaluation or insufficient read permission;
- if the helper fails closed, authenticated users may lose access to their own tenant data;
- if the helper is rewritten poorly, tenant isolation may fail open or leak tenant membership.

This is not a safe “advisor says change it, so change it” situation. The correct move is a minimal grant/search-path hardening migration plus role-fixture validation.

### 12.3 Can they be changed to SECURITY INVOKER safely?

Current recon result:

- **Not proven safe.**
- Do not convert to `SECURITY INVOKER` in the next implementation task unless dedicated local + role-fixture QA proves there is no recursive RLS failure and no tenant boundary regression.

### 12.4 Classification per function

| Function | Classification | Reason |
| :--- | :--- | :--- |
| `public.get_user_tenants()` | Needs hardening but can remain `SECURITY DEFINER` | Valid RLS helper; explicit `search_path=public`; grant surface is too broad (`PUBLIC`, `anon`, `authenticated`). |
| `public.has_tenant_role(...)` | Needs hardening but can remain `SECURITY DEFINER` | Valid RLS helper; explicit `search_path=public`; direct RPC probing should be restricted; behavior should remain unchanged. |

## 13. Proposed hardening plan

Recommended next migration concept:

```sql
-- 0008_harden_security_definer_rls_helpers.sql

-- Preserve function bodies and SECURITY DEFINER mode.
-- Keep SET search_path = public.
-- Tighten direct execute grants.

REVOKE EXECUTE ON FUNCTION public.get_user_tenants() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_tenants() FROM PUBLIC;
-- evaluate whether authenticated direct RPC execution is actually required;
-- likely revoke authenticated too if policies still evaluate as table owner / postgres.

REVOKE EXECUTE ON FUNCTION public.has_tenant_role(uuid, public.app_role[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_tenant_role(uuid, public.app_role[]) FROM PUBLIC;
-- evaluate whether authenticated direct RPC execution is actually required;
-- likely revoke authenticated too if RLS policy execution remains valid.
```

Recommended implementation constraints:

- Do not change function bodies unless tests prove it is required.
- Do not convert to `SECURITY INVOKER` in the first hardening migration.
- Do not drop or recreate the functions unless needed to preserve exact attributes safely.
- Keep `SET search_path = public` explicit.
- Validate RLS behavior using QA fixture users before and after hardening.
- Validate direct RPC grants with `has_function_privilege` for `anon`, `authenticated`, and `PUBLIC`.
- Run security advisors after hardening.

Expected acceptance criteria for next task:

- helper functions still exist;
- helper functions remain `SECURITY DEFINER` unless invoker safety is proven;
- helper functions still have `SET search_path = public`;
- direct `anon` execute is false;
- direct `PUBLIC` execute is false;
- direct `authenticated` execute is either false or explicitly justified if required;
- tenant-member users still see only their tenant data;
- no-tenant users remain blocked;
- admin-only delete/dictionary mutation policies still enforce roles;
- Supabase security advisor warnings are reduced or explicitly justified.

## 14. What was intentionally NOT changed

- No DDL.
- No migrations.
- No `0008` migration.
- No source code.
- No RLS policies.
- No grants changed.
- No cloud writes.
- No function bodies changed.
- No seed data.
- No cloud reset.
- No production data touched.
- No secrets printed.
- No service role key printed.
- No passwords printed.
- No patient data printed.

## 15. Remaining known issues

- `SUPABASE-CLOUD-DRIFT-BACKFILL-001` remains needed for orphan `add_dental_photo_storage` cloud drift.
- `FINDINGS-ARCHIVE-UI-CLEANUP-001` remains open.
- `SUPABASE-CLOUD-DICTIONARY-SEED-RECON-001` remains open.
- `ROLE-LABEL-UX-001` remains open if still applicable.
- Direct execution hardening for `get_user_tenants()` / `has_tenant_role(...)` remains open.

## 16. Checks

- `git status --short`: not run in a local working tree.
- `npx supabase status`: not run.
- `npx supabase db reset`: not run.
- `npm run lint`: not run locally.
- `npm run test -- --run`: not run locally.
- `npm run build`: not run locally.
- GitHub Actions CI result: pending until PR is opened and CI completes.

No skipped check is claimed as passed.

## 17. Final verdict

**PARTIAL**

Exact missing validation:

- local Supabase validation was not completed;
- local function definitions/grants/search_path were not compared to cloud;
- local `npm` command checks were not run in this tool path;
- GitHub Actions CI is pending until PR is opened and run.

Verified despite partial verdict:

- Git audit identified both helper functions and their creation point.
- Cloud audit identified all public `SECURITY DEFINER` functions.
- Cloud function definitions were inspected.
- Cloud grants were inspected.
- Cloud `search_path` safety was inspected.
- Cloud RLS policy dependencies were mapped.
- Supabase security advisors were run.
- No cloud writes or DDL were performed.

## 18. Recommended next task

**SECURITY-DEFINER-RPC-HARDENING-001A**

Harden RLS helper functions with safe grants while preserving current function bodies, `SECURITY DEFINER` mode, and `SET search_path = public`, with QA fixture validation before and after the grant changes.
