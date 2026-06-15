# SUPABASE-CLOUD-APPLY-0010-DICTIONARY-TEMPLATE-BOOTSTRAP

## Summary

Applied the already-merged Git migration `supabase/migrations/0010_clinical_dictionary_template_bootstrap.sql` to the dev/test Supabase cloud project `codex-test-cloud`.

Final cloud result:

- `0010_clinical_dictionary_template_bootstrap` is present in cloud migration history.
- `clinical_dictionary_templates` exists.
- `clinical_dictionary_template_items` exists.
- `default_dental_v1` exists and is active.
- Template counts are `25` diagnoses and `18` works, `43` total.
- `public.bootstrap_clinical_dictionary_from_template(uuid,text)` exists.
- RPC is `SECURITY INVOKER`, `search_path=public`.
- RPC grants: `anon=false`, `PUBLIC=false`, `authenticated=true`.
- Tenant-scoped `clinical_dictionary_items` remains `0`.
- No tenants or users were created.
- No seed was applied.
- No cloud reset was performed.
- No tenant bootstrap RPC was executed.

## Branch

`ops/cloud-apply-0010-dictionary-template-bootstrap`

## PR

https://github.com/NckNA/codex-test/pull/288

## PR head reviewed before final report update

`894c74179436b136d71dad7a3d2acbb0b198bd83`

## Report update commit

N/A because the final report update commit cannot reference itself before creation.

## Changed files

Report-only PR:

- `_ai_work/REPORTS/SUPABASE-CLOUD-APPLY-0010-DICTIONARY-TEMPLATE-BOOTSTRAP_apply_0010.md`

No code, migration, seed, source document, or old report files were changed.

## Cloud project identity

Verified before apply:

- Project name: `codex-test-cloud`
- Project id/ref: `cwkgxgubvdkkjcslvdgn`
- Status: `ACTIVE_HEALTHY`
- Region: `ap-northeast-2`
- Database version: `17.6.1.127`

## Preflight

Migration history before apply contained migrations through `0009`:

- `0001 / initial_schema`
- `0002 / add_dental_chart_editor_fields_to_tooth_states`
- `0003 / add_dental_chart_links_to_findings`
- orphan historical `add_dental_photo_storage`
- `0004_align_findings_status_lifecycle`
- `0005_create_clinical_dictionary_items`
- `0006_treatment_plan_stage_sync_rpc`
- `0007_revoke_anon_execute_from_treatment_plan_rpc`
- `0008_harden_rls_helper_function_grants`
- `0009_backfill_dental_photo_storage`

Preflight confirmed:

- `0010` absent before apply.
- Template tables absent before apply.
- Bootstrap RPC absent before apply.
- `tenants = 0` before apply.
- `tenant_users = 0` before apply.
- `clinical_dictionary_items = 0` before apply.
- `clinical_dictionary_items` rows with `null tenant_id = 0` before apply.

Storage drift was already handled by `0009`; storage was not changed here.

## Migration applied

Applied:

- Filename: `supabase/migrations/0010_clinical_dictionary_template_bootstrap.sql`
- Migration name: `0010_clinical_dictionary_template_bootstrap`
- Apply method: Supabase cloud migration workflow via `apply_migration`
- Git source: `main`
- Git file blob SHA: `6f2d1d718fa745486758f54a8d0dbc199eaa3d67`

The applied SQL came from the Git migration on `main` and included:

- template tables;
- template RLS policies;
- table grants;
- default template `default_dental_v1`;
- 43 template items;
- bootstrap RPC;
- RPC execute grants.

Not done:

- no seed;
- no reset;
- no tenant/user creation;
- no tenant-scoped dictionary rows;
- no bootstrap RPC execution;
- no repo code change;
- no migration edit.

## Post-apply validation

Migration history:

- `20260615175513 / 0010_clinical_dictionary_template_bootstrap` is present.

Objects:

- `public.clinical_dictionary_templates` exists.
- `public.clinical_dictionary_template_items` exists.
- `public.bootstrap_clinical_dictionary_from_template(uuid,text)` exists.

Default template:

- `default_dental_v1` exists.
- `is_active = true`.

Template counts:

- `diagnosis = 25`
- `work = 18`
- `total = 43`

Tenant-scoped data after apply:

- `tenants = 0`
- `tenant_users = 0`
- `clinical_dictionary_items = 0`
- `clinical_dictionary_items where tenant_id is null = 0`

RPC validation:

- `SECURITY INVOKER` (`prosecdef=false`)
- `provolatile = v`
- `function_config = search_path=public`
- `anon EXECUTE = false`
- `PUBLIC EXECUTE = false`
- `authenticated EXECUTE = true`

RLS/policy validation:

- `clinical_dictionary_templates` has authenticated SELECT policy for active templates.
- `clinical_dictionary_template_items` has authenticated SELECT policy for active items under an active template.
- No broad runtime write policy was found for template tables.

Runtime tenant RPC smoke was skipped because cloud has no tenants/users and this task forbids creating them or running tenant bootstrap.

## Advisor result

Security advisors after apply showed no new warning for the bootstrap RPC.

Existing out-of-scope advisors remain:

- `rls_enabled_no_policy` for `integration_tokens`.
- `authenticated_security_definer_function_executable` for `get_user_tenants()`.
- `authenticated_security_definer_function_executable` for `has_tenant_role(...)`.

## Cloud safety

No production data was handled. No patient/medical details, user emails, or credentials were printed. No storage objects were touched.

## Intentionally not changed

- no repo source code;
- no existing migrations;
- no new migration;
- no seed;
- no cloud reset;
- no tenant/user creation;
- no tenant-scoped dictionary insert;
- no tenant bootstrap execution;
- no source document changes;
- no next feature started.

## Remaining known issues

- Findings archive UI cleanup.
- Role label UX.
- Future dental photo upload/storage integration.
- Tenant creation/onboarding flow.
- Documents/payments/stock/subscription features pending.
- `integration_tokens` advisor info remains out of scope.

## Checks

Local repository commands were not run because no executable local terminal is available in the current tool runtime.

- `git status --short`: not run locally.
- `npm run lint`: covered by GitHub Actions CI run #418 on PR head `894c74179436b136d71dad7a3d2acbb0b198bd83`.
- `npm run test -- --run`: covered by GitHub Actions CI run #418 on PR head `894c74179436b136d71dad7a3d2acbb0b198bd83`.
- `npm run build`: covered by GitHub Actions CI run #418 on PR head `894c74179436b136d71dad7a3d2acbb0b198bd83`.
- GitHub Actions CI: run #418 passed for pre-final report head `894c74179436b136d71dad7a3d2acbb0b198bd83`.

This final report update creates a new report-only commit and therefore triggers a new GitHub Actions run on the final head; that final-head CI result is tracked in the PR body and final response to avoid a self-referential report commit loop.

## Final verdict

`CLOUD 0010 APPLIED AND VERIFIED`

Reason:

- project identity verified;
- preflight passed;
- `0010` was absent before apply;
- Git migration `0010` was applied to dev/test cloud;
- template tables exist;
- default template exists and is active;
- template counts are `25 + 18 = 43`;
- bootstrap RPC exists with safe grants;
- tenant-scoped dictionary rows remain `0`;
- no tenants/users/seed/reset/bootstrap execution occurred;
- no new bootstrap RPC security-definer warning was introduced.

## Recommended next task

`FINDINGS-ARCHIVE-UI-CLEANUP-001`
