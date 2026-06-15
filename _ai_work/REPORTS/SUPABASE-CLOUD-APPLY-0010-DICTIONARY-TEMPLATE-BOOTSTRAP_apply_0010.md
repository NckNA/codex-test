# SUPABASE-CLOUD-APPLY-0010-DICTIONARY-TEMPLATE-BOOTSTRAP

## 1. Summary

Applied the already-merged Git migration `supabase/migrations/0010_clinical_dictionary_template_bootstrap.sql` to the dev/test Supabase cloud project `codex-test-cloud`.

Result:

- Cloud migration history now contains `0010_clinical_dictionary_template_bootstrap`.
- `clinical_dictionary_templates` exists.
- `clinical_dictionary_template_items` exists.
- Default template `default_dental_v1` exists and is active.
- Template item counts are `25` diagnoses and `18` works, `43` total.
- Bootstrap RPC exists.
- Bootstrap RPC remains `SECURITY INVOKER`, with `search_path=public`.
- RPC grants are safe: `anon=false`, `PUBLIC=false`, `authenticated=true`.
- Tenant-scoped `clinical_dictionary_items` remains unchanged at `0` rows.
- No tenants/users were created.
- No seed was applied.
- No cloud reset was performed.
- No tenant bootstrap RPC was executed.

## 2. Branch name

`ops/cloud-apply-0010-dictionary-template-bootstrap`

## 3. PR URL

Pending PR creation.

## 4. PR head reviewed before final report update

Pending PR creation.

## 5. Report update commit

N/A because the final report update commit cannot reference itself before creation.

## 6. Changed files summary

Expected changed files:

- `_ai_work/REPORTS/SUPABASE-CLOUD-APPLY-0010-DICTIONARY-TEMPLATE-BOOTSTRAP_apply_0010.md`

No source code, migrations, seed, scripts, source documents, or old reports were changed.

## 7. Cloud project identity

Confirmed project identity before apply:

- Project name: `codex-test-cloud`
- Project id/ref: `cwkgxgubvdkkjcslvdgn`
- Status: `ACTIVE_HEALTHY`
- Region: `ap-northeast-2`
- Database version: `17.6.1.127`

Nick previously confirmed this cloud project is development/test only and contains no real clinics, doctors, patients, medical records, payments, or production users.

## 8. Preflight results

Read-only cloud preflight passed.

Migration history before apply contained:

- `0001 / initial_schema`
- `0002 / add_dental_chart_editor_fields_to_tooth_states`
- `0003 / add_dental_chart_links_to_findings`
- `20260612152210 / add_dental_photo_storage`
- `20260614225430 / 0004_align_findings_status_lifecycle`
- `20260614225512 / 0005_create_clinical_dictionary_items`
- `20260615104342 / 0006_treatment_plan_stage_sync_rpc`
- `20260615111827 / 0007_revoke_anon_execute_from_treatment_plan_rpc`
- `20260615132148 / 0008_harden_rls_helper_function_grants`
- `20260615141156 / 0009_backfill_dental_photo_storage`

Preflight confirmed:

- `0010_clinical_dictionary_template_bootstrap` was absent before apply.
- `public.clinical_dictionary_templates` was absent before apply.
- `public.clinical_dictionary_template_items` was absent before apply.
- `public.bootstrap_clinical_dictionary_from_template(uuid,text)` was absent before apply.
- `tenants` count before apply: `0`.
- `tenant_users` count before apply: `0`.
- `clinical_dictionary_items` count before apply: `0`.
- `clinical_dictionary_items` rows with `null tenant_id` before apply: `0`.

Previous storage drift was already backfilled by migration `0009`; storage was not changed in this task.

No tenant names, user emails, patient data, medical details, secrets, service-role keys, or passwords were printed.

## 9. Migration applied

Applied migration:

- Filename: `supabase/migrations/0010_clinical_dictionary_template_bootstrap.sql`
- Migration name: `0010_clinical_dictionary_template_bootstrap`
- Apply method: Supabase cloud migration workflow via `apply_migration`
- Git source: `main`
- Git file blob SHA: `6f2d1d718fa745486758f54a8d0dbc199eaa3d67`

The applied SQL was assembled from the Git migration file on `main` and matched the migration content used for `0010`:

- template tables;
- template RLS policies;
- table grants;
- default template `default_dental_v1`;
- 43 template items;
- bootstrap RPC;
- RPC execute grants.

Confirmed intentionally not done:

- No `seed.sql` applied.
- No cloud reset.
- No tenants created.
- No users created.
- No tenant-scoped dictionary rows inserted.
- No bootstrap RPC executed for any tenant.
- No source code changed.
- No migration edited.

## 10. Post-apply validation

Post-apply read-only validation passed.

Migration history:

- `20260615175513 / 0010_clinical_dictionary_template_bootstrap` is present.

Objects:

- `public.clinical_dictionary_templates` exists.
- `public.clinical_dictionary_template_items` exists.
- `public.bootstrap_clinical_dictionary_from_template(uuid,text)` exists.

Default template:

- `default_dental_v1` exists.
- `is_active = true`.

Template item counts for `default_dental_v1`:

- `diagnosis = 25`
- `work = 18`
- `total = 43`

Tenant-scoped dictionary rows after apply:

- `tenants = 0`
- `tenant_users = 0`
- `clinical_dictionary_items = 0`
- `clinical_dictionary_items where tenant_id is null = 0`

Bootstrap RPC validation:

- Function: `public.bootstrap_clinical_dictionary_from_template(uuid,text)`
- Security mode: `SECURITY INVOKER` (`prosecdef = false`)
- Volatility: `VOLATILE` (`provolatile = v`), as expected for an INSERT-capable bootstrap RPC
- Function config: `search_path=public`
- `anon EXECUTE = false`
- `PUBLIC EXECUTE = false`
- `authenticated EXECUTE = true`

RLS/policy validation:

- `clinical_dictionary_templates` has authenticated SELECT policy for active templates.
- `clinical_dictionary_template_items` has authenticated SELECT policy for active template items whose template is active.
- No broad authenticated/anon write policy was found for template tables.

Optional runtime tenant RPC smoke:

- Skipped because cloud has `0` tenants and `0` tenant_users, and this task forbids creating tenants/users or executing tenant bootstrap.
- Read-only validation is sufficient for this empty dev/test cloud state.

## 11. Advisor result

Security advisors after apply returned no new warning for the bootstrap RPC.

Expected result confirmed:

- `bootstrap_clinical_dictionary_from_template` did not introduce a new `SECURITY DEFINER` warning because it is `SECURITY INVOKER`.

Existing out-of-scope warnings remain:

- `rls_enabled_no_policy` INFO for `public.integration_tokens`.
- `authenticated_security_definer_function_executable` WARN for `public.get_user_tenants()`.
- `authenticated_security_definer_function_executable` WARN for `public.has_tenant_role(target_tenant_id uuid, allowed_roles public.app_role[])`.

Those warnings predate this task and are intentionally out of scope here.

## 12. Cloud safety

Confirmed:

- Dev/test project only.
- No production data handled.
- No real patient data printed.
- No real clinic names printed.
- No user emails printed.
- No secrets printed.
- No service-role key printed.
- No passwords printed.
- No storage objects touched.
- No patient/medical details touched.

## 13. What was intentionally NOT changed

- No repo source code changes.
- No existing migration edits.
- No new migration created.
- No seed data applied.
- No cloud reset.
- No tenant creation.
- No user creation.
- No tenant-scoped dictionary rows inserted.
- No bootstrap RPC execution for a tenant.
- No source documents changed.
- No next feature started.

## 14. Remaining known issues

- Findings archive UI cleanup.
- Role label UX.
- Future dental photo upload/storage integration.
- Tenant creation/onboarding flow.
- Documents/payments/stock/subscription features pending.
- `integration_tokens` advisor info remains out of scope.

## 15. Checks

Repository local checks were not run in this session because there is no executable local terminal available in the current tool runtime.

- `git status --short`: not run locally.
- `npm run lint`: not run locally.
- `npm run test -- --run`: not run locally.
- `npm run build`: not run locally.
- GitHub Actions CI: pending PR creation/update.

Because this is a report-only PR and no code/migration file is changed in Git, GitHub Actions CI is the source of truth for repository checks after PR creation.

## 16. Final verdict

`CLOUD 0010 APPLIED AND VERIFIED`

Reason:

- Cloud project identity verified.
- Cloud preflight passed.
- `0010` was absent before apply.
- Exact Git migration 0010 was applied to dev/test cloud via migration workflow.
- Template tables exist after apply.
- Default template exists and is active.
- Template counts are `25 + 18 = 43`.
- Bootstrap RPC exists with safe grants.
- Tenant-scoped dictionary rows remain `0`.
- No tenants/users/seed/reset/bootstrap execution occurred.
- Advisors show no new `SECURITY DEFINER` warning from `0010`.

## 17. Recommended next task

`FINDINGS-ARCHIVE-UI-CLEANUP-001`
