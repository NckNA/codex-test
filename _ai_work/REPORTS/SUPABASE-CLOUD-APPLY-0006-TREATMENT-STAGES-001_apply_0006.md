# SUPABASE-CLOUD-APPLY-0006-TREATMENT-STAGES-001: apply treatment stages RPC migration to dev cloud

## 1. Summary

Migration `0006_treatment_plan_stage_sync_rpc` was applied to the Supabase dev/test cloud project `codex-test-cloud`.

The cloud migration apply itself succeeded and `public.save_treatment_plan_with_stages` now exists as a `SECURITY INVOKER` function.

However, post-apply grant validation is **PARTIAL**, not fully verified: the function has explicit `EXECUTE` granted to `anon` in cloud ACL after apply. `PUBLIC` execute is revoked and `authenticated` execute is granted, but `anon EXECUTE` remains present. No corrective DDL was applied because this task required applying exactly the Git migration and not introducing additional cloud drift.

## 2. Branch name

`ops/cloud-apply-0006-treatment-stages-001`

## 3. PR URL

https://github.com/NckNA/codex-test/pull/281

## 4. PR head reviewed before final report update

`fd5e8e7da10336737c79564b944ec8ae78d26c01`

## 5. Report update commit

N/A because the final report update commit cannot reference itself before creation.

## 6. Changed files summary

- `[NEW] _ai_work/REPORTS/SUPABASE-CLOUD-APPLY-0006-TREATMENT-STAGES-001_apply_0006.md`

PR changed-files check before final report update confirmed exactly one changed file:

- `_ai_work/REPORTS/SUPABASE-CLOUD-APPLY-0006-TREATMENT-STAGES-001_apply_0006.md`

## 7. Cloud project identity

- **Project name:** `codex-test-cloud`
- **Project ID:** `cwkgxgubvdkkjcslvdgn`
- **Status:** `ACTIVE_HEALTHY`
- **Region:** `ap-northeast-2`
- **Database:** PostgreSQL `17.6.1.127`
- **Environment:** development/test cloud, per Nick's prior confirmation.

## 8. Preflight results

### 8.1 Project identity

- Project ID matched required target: `cwkgxgubvdkkjcslvdgn`.
- Project name matched required target: `codex-test-cloud`.
- No production indicators were found in preflight.

### 8.2 Migration history before apply

Cloud migration history before applying `0006`:

- `0001` / `initial_schema`
- `0002` / `add_dental_chart_editor_fields_to_tooth_states`
- `0003` / `add_dental_chart_links_to_findings`
- `20260612152210` / `add_dental_photo_storage`
- `20260614225430` / `0004_align_findings_status_lifecycle`
- `20260614225512` / `0005_create_clinical_dictionary_items`

Preflight conclusions:

- `0004_align_findings_status_lifecycle`: **present**.
- `0005_create_clinical_dictionary_items`: **present**.
- `0006_treatment_plan_stage_sync_rpc`: **absent before apply**.

### 8.3 Existing function state before apply

- `public.save_treatment_plan_with_stages(uuid, uuid, uuid, text, text, numeric, jsonb)`: **absent before apply**.

### 8.4 Treatment plan tables

- `public.treatment_plans`: **present**.
- `public.treatment_stages`: **present**.

### 8.5 Existing data counts before apply

Only aggregate counts were read. No patient-identifying data was selected or printed.

- `public.treatment_plans`: `0`
- `public.treatment_stages`: `0`

### 8.6 Existing orphan cloud drift

Known orphan cloud migration/storage drift remains out of scope:

- `20260612152210_add_dental_photo_storage` exists in cloud and was **not** fixed in this task.

## 9. Migration applied

- **Migration filename:** `supabase/migrations/0006_treatment_plan_stage_sync_rpc.sql`
- **Migration name used:** `0006_treatment_plan_stage_sync_rpc`
- **Apply method:** Supabase cloud migration apply tool (`apply_migration`) against project `cwkgxgubvdkkjcslvdgn`.
- **SQL matched Git migration:** Yes. The SQL applied was copied exactly from the Git migration on `main`.
- **Apply result:** Success.
- **Seed applied:** No.
- **DB reset:** No.
- **Cloud destructive operation:** No.
- **Demo data inserted:** No.
- **Real data modified:** No.

## 10. Post-apply validation

### 10.1 Migration history after apply

Cloud migration history after apply includes:

- `20260615104342` / `0006_treatment_plan_stage_sync_rpc`

### 10.2 Function exists

- `public.save_treatment_plan_with_stages(uuid, uuid, uuid, text, text, numeric, jsonb)`: **exists**.

### 10.3 Function security

Validation query result:

- `prosecdef = false`
- Function is therefore **SECURITY INVOKER**.
- Function is **not SECURITY DEFINER**.
- Function config includes `search_path=public`.

Note: `pg_get_functiondef(...)` does not print `SECURITY INVOKER` because invoker is PostgreSQL's default mode. The authoritative catalog value is `pg_proc.prosecdef = false`.

### 10.4 Function grants

Post-apply grant validation:

- `authenticated EXECUTE`: `true`
- `PUBLIC EXECUTE`: `false`
- `anon EXECUTE`: `true`

Raw function ACL after apply:

```text
{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
```

Expanded ACL:

- `anon`: `EXECUTE`
- `authenticated`: `EXECUTE`
- `postgres`: `EXECUTE`
- `service_role`: `EXECUTE`

This means grant validation is **not fully accepted**. The task expected execute permission to be restricted to `authenticated` and no broad public/anon execute permission. `PUBLIC` was revoked, but `anon` still has explicit `EXECUTE` in cloud.

No corrective `REVOKE EXECUTE ... FROM anon` was applied because that would be an additional cloud DDL change outside the exact Git migration requested by this task.

### 10.5 Data counts after apply

Only aggregate counts were read. No patient-identifying data was selected or printed.

- `public.treatment_plans`: `0`
- `public.treatment_stages`: `0`

Counts before and after remained identical.

## 11. Function behavior validation

Read-only definition validation confirmed the migration function contains the expected behavior:

- Deletes missing stages with `DELETE FROM treatment_stages` for stages not included in submitted payload.
- Updates existing stages with `ON CONFLICT (id) DO UPDATE`.
- Inserts new stages with `INSERT INTO treatment_stages`.
- Validates plan ownership with `Invalid plan/tenant/patient ownership` guard.
- Validates stage ownership with `Invalid stage ownership` guard.
- Uses `search_path=public`.

### Optional safe smoke

**SKIPPED.**

Reason: preflight showed `0` treatment plans and `0` treatment stages. No safe existing dev/test fixture data was available, and this task explicitly prohibited inserting demo data or leaving temporary rows behind. Read-only validation was used instead.

## 12. Supabase advisors

Security advisors were run after migration.

Results:

- Existing `rls_enabled_no_policy` INFO remains for `public.integration_tokens`.
- Existing `anon_security_definer_function_executable` WARN remains for `public.get_user_tenants()`.
- Existing `anon_security_definer_function_executable` WARN remains for `public.has_tenant_role(target_tenant_id uuid, allowed_roles public.app_role[])`.
- Existing `authenticated_security_definer_function_executable` WARN remains for `public.get_user_tenants()`.
- Existing `authenticated_security_definer_function_executable` WARN remains for `public.has_tenant_role(target_tenant_id uuid, allowed_roles public.app_role[])`.

`0006` did **not** introduce a new `SECURITY DEFINER` advisor warning because `public.save_treatment_plan_with_stages` is `SECURITY INVOKER`.

Important caveat: advisor output did not flag the `anon EXECUTE` ACL on `public.save_treatment_plan_with_stages`, but direct ACL validation confirmed it exists.

## 13. Cloud safety

- Project verified as development/test: `codex-test-cloud` / `cwkgxgubvdkkjcslvdgn`.
- No production data was touched.
- No real patient data was printed.
- No patient names were selected or printed.
- No secrets were printed.
- No service role key was printed.
- No passwords were printed.
- No `.env.local` contents were printed.

## 14. What was intentionally NOT changed

- No repository source code changes.
- No schema migration file edits.
- No `seed.sql` changes.
- No source changes.
- No old report changes.
- No cloud reset.
- No seed data applied.
- No demo data inserted.
- No orphan storage drift fix.
- No `SECURITY-DEFINER-RPC-HARDENING-001` work.
- No corrective grant migration was created.
- No direct corrective `REVOKE EXECUTE ... FROM anon` was applied.

## 15. Remaining known issues

- `SUPABASE-RPC-GRANT-CLEANUP-0007` is the immediate blocker: revoke `anon EXECUTE` from `public.save_treatment_plan_with_stages` via a Git migration and apply it to dev/test cloud.
- `SECURITY-DEFINER-RPC-HARDENING-001` remains in backlog for `get_user_tenants()` / `has_tenant_role(...)`, but the immediate blocker is the new RPC grant issue from migration `0006`.
- `SUPABASE-CLOUD-DRIFT-BACKFILL-001` is still needed for orphan `add_dental_photo_storage` cloud drift.
- `FINDINGS-ARCHIVE-UI-CLEANUP-001` remains open.
- `SUPABASE-CLOUD-DICTIONARY-SEED-RECON-001` remains open.
- `ROLE-LABEL-UX-001` remains open if still applicable.

## 16. Checks

- `git status --short`: not run in a local working tree because the report-only branch was created through the GitHub Contents API. PR changed-files validation confirmed exactly one changed file: `_ai_work/REPORTS/SUPABASE-CLOUD-APPLY-0006-TREATMENT-STAGES-001_apply_0006.md`.
- `npm run lint`: **PASS** via GitHub Actions CI workflow `CI`, job `validate`, step `Run ESLint`, run #378, head `aa6a3c50a3b2dc72de83a0160b48b4712d78225d`.
- `npm run test -- --run`: **NOT RUN EXACTLY**. The repository CI workflow runs `npm run test`; that CI step passed in run #378. This is not claimed as the exact requested local command.
- `npm run build`: **PASS** via GitHub Actions CI workflow `CI`, job `validate`, step `Build project`, run #378, head `aa6a3c50a3b2dc72de83a0160b48b4712d78225d`.
- `GitHub Actions CI result`: **PASS**, workflow `CI`, run #378, run id `27541090096`, head `aa6a3c50a3b2dc72de83a0160b48b4712d78225d`.

## 17. Final verdict

**PARTIAL**

Exact missing validation:

- `0006` applied successfully.
- Function exists.
- Function is `SECURITY INVOKER` and not `SECURITY DEFINER`.
- `authenticated EXECUTE` is present.
- `PUBLIC EXECUTE` is revoked.
- But `anon EXECUTE` is explicitly present after apply, so the expected restricted grant state is not fully verified.

## 18. Recommended next task

**SUPABASE-RPC-GRANT-CLEANUP-0007**

Revoke `anon EXECUTE` from `public.save_treatment_plan_with_stages` via a Git migration and apply it to dev/test cloud.

`SECURITY-DEFINER-RPC-HARDENING-001` remains in backlog, but the immediate blocker is the new RPC grant issue from migration `0006`.
