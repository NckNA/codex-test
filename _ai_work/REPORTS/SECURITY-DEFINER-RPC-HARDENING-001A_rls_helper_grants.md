# SECURITY-DEFINER-RPC-HARDENING-001A: tighten RLS helper function grants

## 1. Summary

Migration `0008_harden_rls_helper_function_grants.sql` was added and applied to the dev/test Supabase cloud project `codex-test-cloud` (`cwkgxgubvdkkjcslvdgn`).

The migration performs minimal grant hardening for the two expected `SECURITY DEFINER` RLS helper functions:

- `public.get_user_tenants()`
- `public.has_tenant_role(target_tenant_id uuid, allowed_roles app_role[])`

Result after validation:

- `anon EXECUTE = false` for both functions locally and in dev/test cloud.
- `PUBLIC EXECUTE = false` for both functions locally and in dev/test cloud.
- `authenticated EXECUTE = true` for both functions locally and in dev/test cloud.
- `service_role EXECUTE = true` for both functions locally and in dev/test cloud.
- Both functions remain `SECURITY DEFINER`.
- Both functions remain `STABLE`.
- Both functions keep explicit `search_path=public`.
- No function bodies were changed.
- No RLS policies were changed.
- No seed data was applied.
- No cloud reset was performed.
- No table/data mutation was performed.

Final verdict: `RLS HELPER GRANTS HARDENED AND VERIFIED`.

Cloud grant validation passed. Codex completed the missing local Supabase validation on commit `4c5d2a1d7bf5e5cb1e95d0aa8d5235feb71162e0`, including `npx supabase db reset`, migration history through `0008`, function property checks, ACL checks, and SQL-level grant validation.

Runtime fixture RLS smoke remains documented as skipped because no authenticated local QA fixture session/credentials were supplied and the dev/test cloud currently has no safe fixture tenant/user data. SQL-level local validation passed and cloud grant validation passed.

## 2. Branch name

`fix/security-definer-rpc-hardening-001a`

## 3. PR URL

https://github.com/NckNA/codex-test/pull/284

## 4. PR head reviewed before final report update

`4c5d2a1d7bf5e5cb1e95d0aa8d5235feb71162e0`

## 5. Report update commit

N/A because the final report update commit cannot reference itself before creation.

## 6. Changed files summary

PR changed files before final report update were exactly:

- `[NEW] supabase/migrations/0008_harden_rls_helper_function_grants.sql`
- `[NEW] _ai_work/REPORTS/SECURITY-DEFINER-RPC-HARDENING-001A_rls_helper_grants.md`

No source code, seed file, RLS policy file, old migration, old report, or source document was intentionally changed.

## 7. Root cause

Recon task `SECURITY-DEFINER-RPC-RECON-001` confirmed that the two expected RLS helper functions were intentionally `SECURITY DEFINER`, but had broad direct execute grants:

- `PUBLIC EXECUTE = true`
- `anon EXECUTE = true`
- `authenticated EXECUTE = true`

The primary issue for this task was the broad direct `PUBLIC` / `anon` execution surface on helper functions exposed in the `public` schema.

The functions are used by 49 RLS policies:

- `get_user_tenants()`: 36 policy references.
- `has_tenant_role(...)`: 13 policy references.

The recon conclusion was to avoid blind `SECURITY INVOKER` conversion and instead preserve behavior while tightening grants.

## 8. Migration added

### 8.1 Filename

`supabase/migrations/0008_harden_rls_helper_function_grants.sql`

### 8.2 Exact function signatures

- `public.get_user_tenants()`
- `public.has_tenant_role(uuid, app_role[])`

The signatures were taken from `supabase/migrations/0001_initial_schema.sql`.

### 8.3 Exact grant changes

```sql
REVOKE EXECUTE ON FUNCTION public.get_user_tenants() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_tenants() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_tenants() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_tenants() TO service_role;

REVOKE EXECUTE ON FUNCTION public.has_tenant_role(uuid, app_role[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_tenant_role(uuid, app_role[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_tenant_role(uuid, app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_tenant_role(uuid, app_role[]) TO service_role;
```

### 8.4 Confirmed non-changes

- No function body changes.
- No `SECURITY INVOKER` conversion.
- No `SECURITY DEFINER` removal.
- No return type changes.
- No volatility changes.
- No `search_path` changes.
- No RLS policy changes.
- No app/source code changes.

## 9. Local validation

Codex completed the missing local validation for migration `0008`.

Validation record:

- **Validation ID:** `LOCAL-SECURITY-DEFINER-RPC-HARDENING-0008-VALIDATION`
- **Repository:** `NckNA/codex-test`
- **Branch:** `fix/security-definer-rpc-hardening-001a`
- **Commit validated:** `4c5d2a1d7bf5e5cb1e95d0aa8d5235feb71162e0`

### 9.1 Local Supabase status and reset

| Item | Result |
| :--- | :--- |
| Status before start | `running` |
| Status after start if needed | not needed |
| `npx supabase db reset` | pass |

### 9.2 Local migration history

| Check | Result |
| :--- | :--- |
| Migrations through `0008` present locally | yes |
| `0008_harden_rls_helper_function_grants` present locally | yes |
| Missing migrations | none |

### 9.3 Local function properties after `0008`

| Function | Found | SECURITY DEFINER | SECURITY INVOKER | Volatility | function_config | search_path=public |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `public.get_user_tenants()` | yes | true | false | `STABLE` | `search_path=public` | yes |
| `public.has_tenant_role(target_tenant_id uuid, allowed_roles app_role[])` | yes | true | false | `STABLE` | `search_path=public` | yes |

### 9.4 Local effective EXECUTE privileges after `0008`

| Function | anon EXECUTE | authenticated EXECUTE | PUBLIC EXECUTE | service_role EXECUTE |
| :--- | :--- | :--- | :--- | :--- |
| `public.get_user_tenants()` | false | true | false | true |
| `public.has_tenant_role(...)` | false | true | false | true |

ACL rows:

- `get_user_tenants`: `authenticated`, `postgres`, and `service_role` have `EXECUTE`; `anon` and `PUBLIC` are absent.
- `has_tenant_role`: `authenticated`, `postgres`, and `service_role` have `EXECUTE`; `anon` and `PUBLIC` are absent.

### 9.5 Optional local RLS smoke

Optional local runtime RLS smoke was skipped.

Skipped reason:

- No authenticated local QA fixture session or credentials were supplied.

Local smoke conclusion:

- SQL-level grant validation passed.
- Function property validation passed.
- ACL validation passed.
- No local data/fixture mutation was performed.

### 9.6 Final local verdict

`LOCAL 0008 VALIDATION PASSED`

## 10. Cloud preflight

### 10.1 Project identity

Project details from Supabase:

- **Project name:** `codex-test-cloud`
- **Project ID / ref:** `cwkgxgubvdkkjcslvdgn`
- **Status:** `ACTIVE_HEALTHY`
- **Region:** `ap-northeast-2`
- **Database:** PostgreSQL `17.6.1.127`
- **Environment:** development/test cloud.

### 10.2 Migration history before apply

Before apply, cloud migration history contained:

- `0001_initial_schema`
- `0002_add_dental_chart_editor_fields_to_tooth_states`
- `0003_add_dental_chart_links_to_findings`
- orphan cloud drift migration `add_dental_photo_storage`
- `0004_align_findings_status_lifecycle`
- `0005_create_clinical_dictionary_items`
- `0006_treatment_plan_stage_sync_rpc`
- `0007_revoke_anon_execute_from_treatment_plan_rpc`

Before apply:

- `0007` present: yes.
- `0008_harden_rls_helper_function_grants` absent: yes.

### 10.3 Function properties before apply

Read-only preflight confirmed both helper functions existed and were still:

- `LANGUAGE sql`
- `STABLE`
- `SECURITY DEFINER = true`
- `function_config = search_path=public`

Pre-apply function grants:

| Function | anon EXECUTE | authenticated EXECUTE | PUBLIC EXECUTE | service_role EXECUTE | ACL |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `public.get_user_tenants()` | `true` | `true` | `true` | `true` | `{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}` |
| `public.has_tenant_role(...)` | `true` | `true` | `true` | `true` | `{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}` |

Pre-apply advisor warnings included:

- `anon_security_definer_function_executable` for both helper functions.
- `authenticated_security_definer_function_executable` for both helper functions.
- `rls_enabled_no_policy` INFO for `public.integration_tokens`.

## 11. Cloud apply

Migration applied:

- **Migration name:** `0008_harden_rls_helper_function_grants`
- **Apply method:** Supabase `apply_migration` against dev/test cloud project `cwkgxgubvdkkjcslvdgn`
- **SQL source:** same grant-only SQL as `supabase/migrations/0008_harden_rls_helper_function_grants.sql`

Safety confirmations:

- No seed applied.
- No cloud reset.
- No unrelated migrations applied.
- No destructive commands.
- No data mutation.
- No function body rewrite.
- No RLS policy rewrite.

Apply result: success.

## 12. Cloud post-apply validation

### 12.1 Migration history after apply

Cloud migration history after apply includes:

- `20260615132148 / 0008_harden_rls_helper_function_grants`

### 12.2 Function properties after apply

Post-apply validation confirmed both functions still exist and remain unchanged in behavior-relevant properties:

| Function | Return type | Volatility | SECURITY DEFINER | search_path |
| :--- | :--- | :--- | :--- | :--- |
| `public.get_user_tenants()` | `SETOF uuid` | `s` / stable | `true` | `search_path=public` |
| `public.has_tenant_role(target_tenant_id uuid, allowed_roles app_role[])` | `boolean` | `s` / stable | `true` | `search_path=public` |

### 12.3 Function grants after apply

Post-apply grant validation:

| Function | anon EXECUTE | authenticated EXECUTE | PUBLIC EXECUTE | service_role EXECUTE | ACL |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `public.get_user_tenants()` | `false` | `true` | `false` | `true` | `{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}` |
| `public.has_tenant_role(...)` | `false` | `true` | `false` | `true` | `{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}` |

Grant cleanup result:

- `anon EXECUTE = false`: pass.
- `PUBLIC EXECUTE = false`: pass.
- `authenticated EXECUTE = true`: pass.
- `service_role EXECUTE = true`: preserved.

### 12.4 Data and RLS smoke status

Cloud data counts after apply:

| Table | Count |
| :--- | ---: |
| `tenants` | 0 |
| `tenant_users` | 0 |
| `patients` | 0 |
| `appointments` | 0 |
| `treatment_plans` | 0 |
| `treatment_stages` | 0 |

Because the dev/test cloud currently has no tenant, tenant user, patient, appointment, treatment plan, or treatment stage rows, authenticated QA-user RLS smoke could not be performed without creating fixture data.

No fixture data was created because this task forbids data mutation and cloud reset.

SQL-level policy dependency validation after apply confirmed the helper dependency map is still present:

- `get_user_tenants()`: 36 policy references.
- `has_tenant_role(...)`: 13 policy references.
- Total helper policy references: 49.

Smoke conclusion:

- Grant-level smoke passed.
- Anonymous direct helper execution is blocked by grants.
- Authenticated helper execution remains granted as required.
- Full tenant-user runtime smoke was skipped due to no safe dev/test fixture data.
- Local runtime fixture smoke was skipped due to no supplied authenticated local QA fixture session/credentials.
- SQL-level local validation passed and cloud grant validation passed.

## 13. Advisor result

Security advisors after `0008`:

Remaining warnings / info:

- `rls_enabled_no_policy` INFO for `public.integration_tokens` remains out of scope.
- `authenticated_security_definer_function_executable` WARN remains for `public.get_user_tenants()`.
- `authenticated_security_definer_function_executable` WARN remains for `public.has_tenant_role(target_tenant_id uuid, allowed_roles public.app_role[])`.

Improvement:

- `anon_security_definer_function_executable` warnings for both helper functions are no longer present after `0008`.

Interpretation:

- Remaining authenticated warnings are expected because this task intentionally preserves `authenticated EXECUTE = true` to avoid breaking app/RLS behavior.
- No new warning was introduced by `0008`.

## 14. What was intentionally NOT changed

- No function body changes.
- No `SECURITY INVOKER` conversion.
- No `SECURITY DEFINER` removal.
- No RLS policy changes.
- No app code changes.
- No seed changes.
- No cloud reset.
- No source document changes.
- No old migration edits.
- No old report edits.
- No production apply.

## 15. Remaining known issues

- `SUPABASE-CLOUD-DRIFT-BACKFILL-001`: orphan `add_dental_photo_storage` cloud drift remains.
- `FINDINGS-ARCHIVE-UI-CLEANUP-001` remains.
- `SUPABASE-CLOUD-DICTIONARY-SEED-RECON-001` remains for cloud dictionary seed/population decision.
- `ROLE-LABEL-UX-001` remains if still applicable.
- `public.integration_tokens` advisor INFO `rls_enabled_no_policy` remains out of scope.
- Authenticated SECURITY DEFINER advisor warnings remain by design because authenticated execution was preserved.
- Full authenticated QA-user RLS smoke remains skipped because cloud has no safe fixture data and this task forbids data mutation.

## 16. Checks

| Check | Result |
| :--- | :--- |
| `git status --short` | PR changed files before final report update were exactly the migration file plus this report file. |
| Local Supabase status | Codex validation: status before start `running`; status after start not needed. |
| Local Supabase reset | Codex validation: `npx supabase db reset` pass. |
| Local migration validation | Codex validation: migrations through `0008` present locally; missing migrations none. |
| Local SQL/function/grant validation | Codex validation: pass; both helper functions preserve `SECURITY DEFINER`, `STABLE`, `search_path=public`, `authenticated=true`, `service_role=true`, `anon=false`, `PUBLIC=false`. |
| Local runtime RLS smoke | Skipped: no authenticated local QA fixture session or credentials were supplied; SQL-level grant validation passed. |
| `npm run lint` | Not run locally in this final report update. GitHub Actions CI run `#392` passed `Run ESLint` for head `4c5d2a1d7bf5e5cb1e95d0aa8d5235feb71162e0`. |
| `npm run test -- --run` | Not run locally in this final report update. GitHub Actions CI run `#392` passed tests for head `4c5d2a1d7bf5e5cb1e95d0aa8d5235feb71162e0`. |
| `npm run build` | Not run locally in this final report update. GitHub Actions CI run `#392` passed build for head `4c5d2a1d7bf5e5cb1e95d0aa8d5235feb71162e0`. |
| GitHub Actions CI result | `CI` run `#392` for head `4c5d2a1d7bf5e5cb1e95d0aa8d5235feb71162e0` completed successfully before this final report update. |

## 17. Final verdict

`RLS HELPER GRANTS HARDENED AND VERIFIED`

Reason:

- Git migration `0008` exists and only changes EXECUTE grants for the two expected RLS helper functions.
- Function bodies are unchanged.
- Functions remain `SECURITY DEFINER`.
- Functions remain `STABLE`.
- Functions keep `search_path=public`.
- Local Supabase validation passed after `db reset`.
- Local SQL-level grant validation passed.
- Dev/test cloud migration apply passed.
- Dev/test cloud grant validation passed.
- Anonymous/PUBLIC direct EXECUTE is blocked locally and in cloud.
- Authenticated and service role EXECUTE remain granted locally and in cloud.
- Advisor state improved by removing anon SECURITY DEFINER executable warnings.
- Runtime fixture smoke limitation is documented and does not require data mutation in this task.

## 18. Recommended next task

`SUPABASE-CLOUD-DRIFT-BACKFILL-001`
