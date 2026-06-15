# SUPABASE-RPC-GRANT-CLEANUP-0007: revoke anon execute from treatment plan RPC

## 1. Summary

Migration `0007_revoke_anon_execute_from_treatment_plan_rpc` was added to remove the explicit `anon` EXECUTE grant from `public.save_treatment_plan_with_stages`.

The migration was applied to the dev/test Supabase cloud project `codex-test-cloud` / `cwkgxgubvdkkjcslvdgn`.

Cloud post-apply validation confirms the target grant state:

- `anon EXECUTE`: `false`
- `authenticated EXECUTE`: `true`
- `PUBLIC EXECUTE`: `false`
- Function remains `SECURITY INVOKER`
- Function is not `SECURITY DEFINER`

This report is **PARTIAL**, not fully verified, because local Supabase validation with `npx supabase status` and `npx supabase db reset` could not be executed in the available tool environment. No skipped local check is claimed as passed.

## 2. Branch name

`fix/supabase-rpc-grant-cleanup-0007`

## 3. PR URL

https://github.com/NckNA/codex-test/pull/282

## 4. PR head reviewed before final report update

`cd5a6bc8bc09f7b4403fd7946e9df42028a18173`

## 5. Report update commit

N/A because the final report update commit cannot reference itself before creation.

## 6. Changed files summary

Expected PR changed files:

- `[NEW] supabase/migrations/0007_revoke_anon_execute_from_treatment_plan_rpc.sql`
- `[NEW] _ai_work/REPORTS/SUPABASE-RPC-GRANT-CLEANUP-0007_revoke_anon_execute.md`

No source code files were changed.

## 7. Root cause

Migration `0006_treatment_plan_stage_sync_rpc` created `public.save_treatment_plan_with_stages` and revoked broad `PUBLIC` execute while granting `authenticated` execute.

Cloud validation in PR #281 found that cloud ACL still contained explicit `anon EXECUTE`:

- `authenticated EXECUTE`: `true`
- `PUBLIC EXECUTE`: `false`
- `anon EXECUTE`: `true`

That violated the expected permission model for the new RPC.

## 8. Migration added

- **Filename:** `supabase/migrations/0007_revoke_anon_execute_from_treatment_plan_rpc.sql`
- **Exact function signature used:** `public.save_treatment_plan_with_stages(uuid, uuid, uuid, text, text, numeric, jsonb)`

Statements added:

```sql
REVOKE EXECUTE ON FUNCTION public.save_treatment_plan_with_stages(uuid, uuid, uuid, text, text, numeric, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.save_treatment_plan_with_stages(uuid, uuid, uuid, text, text, numeric, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_treatment_plan_with_stages(uuid, uuid, uuid, text, text, numeric, jsonb) TO authenticated;
```

Confirmations:

- No function body change.
- No `CREATE OR REPLACE FUNCTION`.
- No `DROP FUNCTION`.
- No `ALTER FUNCTION ... SECURITY DEFINER`.
- No `SECURITY DEFINER` added.
- No RLS policy changes.
- No seed changes.

## 9. Local validation

Local Supabase validation was **NOT RUN**.

Required local commands not executed in the available tool environment:

- `npx supabase status`
- `npx supabase db reset`

Required local SQL checks therefore remain unvalidated locally:

- local migration `0007` applied;
- local function exists;
- local function is `SECURITY INVOKER`;
- local `anon EXECUTE = false`;
- local `authenticated EXECUTE = true`;
- local `PUBLIC EXECUTE = false`.

This is the exact reason the final verdict is `PARTIAL` instead of `RPC GRANT CLEANUP VERIFIED`.

No local command output, `.env.local`, service role key, password, or secret was printed.

## 10. Cloud preflight

### 10.1 Project identity

- **Project name:** `codex-test-cloud`
- **Project ID:** `cwkgxgubvdkkjcslvdgn`
- **Status:** `ACTIVE_HEALTHY`
- **Region:** `ap-northeast-2`
- **Database:** PostgreSQL `17.6.1.127`
- **Environment:** development/test cloud.

### 10.2 Migration history before apply

Cloud migration history before applying `0007` included:

- `0001` / `initial_schema`
- `0002` / `add_dental_chart_editor_fields_to_tooth_states`
- `0003` / `add_dental_chart_links_to_findings`
- `20260612152210` / `add_dental_photo_storage`
- `20260614225430` / `0004_align_findings_status_lifecycle`
- `20260614225512` / `0005_create_clinical_dictionary_items`
- `20260615104342` / `0006_treatment_plan_stage_sync_rpc`

Preflight conclusions:

- `0006_treatment_plan_stage_sync_rpc`: **present**.
- `0007_revoke_anon_execute_from_treatment_plan_rpc`: **absent before apply**.

### 10.3 Function state before apply

- Function exists: `public.save_treatment_plan_with_stages(uuid, uuid, uuid, text, text, numeric, jsonb)`.
- `prosecdef = false`.
- Function is `SECURITY INVOKER`.
- Function is not `SECURITY DEFINER`.
- Function config includes `search_path=public`.

Pre-apply grant validation:

- `anon EXECUTE`: `true`
- `authenticated EXECUTE`: `true`
- `PUBLIC EXECUTE`: `false`

Raw ACL before apply:

```text
{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
```

### 10.4 Data counts before apply

Only aggregate counts were read. No patient-identifying data was selected or printed.

- `public.treatment_plans`: `0`
- `public.treatment_stages`: `0`

## 11. Cloud apply

- **Migration filename:** `supabase/migrations/0007_revoke_anon_execute_from_treatment_plan_rpc.sql`
- **Migration name used:** `0007_revoke_anon_execute_from_treatment_plan_rpc`
- **Apply method:** Supabase cloud migration apply tool (`apply_migration`) against project `cwkgxgubvdkkjcslvdgn`.
- **Apply result:** Success.
- **Seed applied:** No.
- **Cloud DB reset:** No.
- **Unrelated migrations applied:** No.
- **Manual cloud state edit outside migration workflow:** No.
- **Data mutation:** No.

## 12. Cloud post-apply validation

### 12.1 Migration history after apply

Cloud migration history after apply includes:

- `20260615111827` / `0007_revoke_anon_execute_from_treatment_plan_rpc`

### 12.2 Function and grant validation after apply

Post-apply function validation:

- Signature: `save_treatment_plan_with_stages(uuid,uuid,uuid,text,text,numeric,jsonb)`
- Function exists: yes.
- `prosecdef = false`.
- Function remains `SECURITY INVOKER`.
- Function is not `SECURITY DEFINER`.
- Function config includes `search_path=public`.

Post-apply grant validation:

- `anon EXECUTE`: `false`
- `authenticated EXECUTE`: `true`
- `PUBLIC EXECUTE`: `false`

Raw ACL after apply:

```text
{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
```

### 12.3 Data counts after apply

Only aggregate counts were read. No patient-identifying data was selected or printed.

- `public.treatment_plans`: `0`
- `public.treatment_stages`: `0`

Counts before and after remained unchanged.

## 13. Advisor result

Security advisors were run after migration `0007`.

Results:

- Existing `rls_enabled_no_policy` INFO remains for `public.integration_tokens`.
- Existing `anon_security_definer_function_executable` WARN remains for `public.get_user_tenants()`.
- Existing `anon_security_definer_function_executable` WARN remains for `public.has_tenant_role(target_tenant_id uuid, allowed_roles public.app_role[])`.
- Existing `authenticated_security_definer_function_executable` WARN remains for `public.get_user_tenants()`.
- Existing `authenticated_security_definer_function_executable` WARN remains for `public.has_tenant_role(target_tenant_id uuid, allowed_roles public.app_role[])`.

`0007` did **not** introduce a new `SECURITY DEFINER` advisor warning for `public.save_treatment_plan_with_stages`.

## 14. What was intentionally NOT changed

- No source code.
- No repository logic.
- No function body.
- No `SECURITY DEFINER` conversion.
- No RLS policy changes.
- No `seed.sql`.
- No cloud reset.
- No demo data.
- No real data.
- No UI smoke testing.
- No `SECURITY-DEFINER-RPC-HARDENING-001` work for other functions.
- No fix for orphan `add_dental_photo_storage` cloud drift.

## 15. Remaining known issues

- `SECURITY-DEFINER-RPC-HARDENING-001` is still needed for `get_user_tenants()` / `has_tenant_role(...)`.
- `SUPABASE-CLOUD-DRIFT-BACKFILL-001` is still needed for orphan `add_dental_photo_storage`.
- `FINDINGS-ARCHIVE-UI-CLEANUP-001` remains open.
- `SUPABASE-CLOUD-DICTIONARY-SEED-RECON-001` remains open.
- `ROLE-LABEL-UX-001` remains open if still applicable.

## 16. Checks

- `git status --short`: not run in a local working tree. PR changed-files validation must confirm exactly two changed files before merge.
- `npm run lint`: pending GitHub Actions CI.
- `npm run test -- --run`: not run exactly in local environment.
- `npm run build`: pending GitHub Actions CI.
- `GitHub Actions CI result`: pending for PR #282.

## 17. Final verdict

**PARTIAL**

Exact missing validation:

- Local Supabase validation was not run:
  - `npx supabase status`
  - `npx supabase db reset`
  - local `has_function_privilege` checks.
- Exact local command `npm run test -- --run` was not run.
- GitHub Actions CI is pending at the time of this report update.

Verified despite the partial verdict:

- Git migration `0007` exists.
- `0007` revokes `anon EXECUTE` from the exact RPC signature.
- `0007` preserves `authenticated EXECUTE`.
- `0007` keeps `PUBLIC EXECUTE` revoked.
- Dev/test cloud validation passes for grants.
- Function remains `SECURITY INVOKER` in cloud.
- No function body change.
- No source code change.
- No seed.
- No cloud reset.
- No data mutation.

## 18. Recommended next task

**SECURITY-DEFINER-RPC-HARDENING-001**

Harden remaining existing `SECURITY DEFINER` functions `get_user_tenants()` and `has_tenant_role(...)` after this RPC grant cleanup is reviewed.
