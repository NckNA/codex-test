# CLINICAL-DICTIONARY-TEMPLATE-BOOTSTRAP-001 template bootstrap report

## Summary

Implemented a Git-only clinical dictionary template/bootstrap mechanism for tenant-scoped dictionary import.

Cloud was not modified. Migration 0010 was not applied to cloud.

Review follow-up fixed the MedicalPage regression by restoring the previous diagnosis/work editor flows, status-to-zone selector behavior, and zone/status-label search while keeping bootstrap UX minimal and explicit.

## Branch

`feature/clinical-dictionary-template-bootstrap-001`

## PR URL

https://github.com/NckNA/codex-test/pull/287

## PR head reviewed before final report update

`21d1a12b7a89e02812b97f113204f0f3af2fe769`

## Report update commit

N/A because the final report update commit cannot reference itself before creation.

## Changed files summary

Allowed files changed:

- `supabase/migrations/0010_clinical_dictionary_template_bootstrap.sql`
- `src/data/repositories/ClinicalDictionariesRepository.ts`
- `src/data/repositories/ClinicalDictionariesRepository.test.ts`
- `src/data/hooks/useDictionaries.tsx`
- `src/pages/MedicalPage.tsx`
- `src/pages/MedicalPage.test.tsx`
- `_ai_work/REPORTS/CLINICAL-DICTIONARY-TEMPLATE-BOOTSTRAP-001_template_bootstrap.md`

No `seed.sql`, old migration, context, backend, script, config, or source document changes were made.

## Root cause

Default clinical dictionaries previously existed only as local/dev seed data for Demo Clinic A. A reusable SaaS bootstrap/import mechanism for new tenant dictionaries was missing.

## Migration added

File: `supabase/migrations/0010_clinical_dictionary_template_bootstrap.sql`

Adds:

- `public.clinical_dictionary_templates`
- `public.clinical_dictionary_template_items`
- default template `default_dental_v1`
- 43 template items: 25 diagnoses and 18 works
- RLS on template tables
- authenticated-only template SELECT policies
- no runtime write policies for template tables
- RPC `public.bootstrap_clinical_dictionary_from_template(target_tenant_id uuid, template_key text default 'default_dental_v1')`

RPC security:

- `SECURITY INVOKER`
- `SET search_path = public`
- rejects unauthenticated calls
- requires `clinic_owner` or `clinic_admin` for `target_tenant_id`
- copies template rows into `clinical_dictionary_items` for exactly one tenant
- uses `ON CONFLICT (tenant_id, id) DO NOTHING`
- returns inserted/skipped counts
- execute revoked from `anon` and `PUBLIC`
- execute granted to `authenticated`

No function body from existing migrations was changed.

No RLS policy on existing tenant tables was changed.

## Repository and hook changes

Repository:

- added `ClinicalDictionaryBootstrapResult`
- added `bootstrapFromTemplate(templateKey?)`
- Supabase repository calls RPC once with active `tenantId`
- Supabase repository does not auto-bootstrap on list/load
- Supabase repository surfaces RPC errors
- LocalStorage repository exposes an explicit local bootstrap action without affecting Supabase behavior

Hook:

- exposes `bootstrapDefaults(templateKey?)`
- exposes `isBootstrappingDefaults`
- blocks no-tenant Supabase access
- reloads dictionaries after successful explicit bootstrap
- does not auto-run bootstrap when dictionaries are empty

## UI changes

`MedicalPage.tsx` includes explicit empty-dictionary bootstrap UX without removing the existing dictionary editing behavior:

- Supabase active + active tenant + clinic owner/admin + empty dictionary: shows `Загрузить базовый справочник`
- Supabase active + active tenant + doctor/non-admin + empty dictionary: shows read-only contact-admin message
- Supabase active + no tenant: no import button
- existing dictionary: no auto-import and no import button
- existing diagnosis rows still use `DiagnosisEditorRow`
- existing work rows still use `WorkEditorRow`
- `Редактировать` opens the actual editor
- save calls `saveDiagnosis` / `saveWork`
- disable/restore still call the relevant save handler
- `StatusZoneSelector` keeps status-to-zone availability filtering
- search still matches zone/status labels

## Local validation

Completed against local Supabase only:

- `npx supabase status`: PASS; local stack was already running
- `npx supabase db reset`: PASS
- migration history: `0001` through `0010` present locally
- `public.clinical_dictionary_templates`: exists
- `public.clinical_dictionary_template_items`: exists
- active template: `default_dental_v1`, version `1`
- template items: 25 diagnoses, 18 works, 43 total
- Demo Clinic A seed: 25 diagnoses, 18 works, 43 total
- Demo Clinic B before bootstrap: 0 rows
- template tables have no `tenant_id` column and remain reusable global definitions
- bootstrap RPC remains `SECURITY INVOKER`, uses `search_path=public`, is unavailable to `anon`/`PUBLIC`, and is executable by `authenticated`

Authenticated bootstrap validation:

- local QA fixture users were created with the existing guarded `scripts/seed-qa-users.cjs`
- Admin B imported the default template through the browser UI
- Demo Clinic B after first bootstrap: 25 diagnoses, 18 works, 43 total
- second authenticated RPC call: `inserted_count=0`, `skipped_existing_count=43`
- Demo Clinic B remained at 43 rows after the second call
- `clinical_dictionary_items` rows with null `tenant_id`: 0
- temporary local QA membership adjustment used for Doctor B smoke was restored with the existing fixture script
- no cloud command, linked reset, cloud migration, or cloud data mutation was performed

## Browser smoke

Completed with the feature branch running locally at `http://127.0.0.1:5176/medical`:

- Admin B / empty Demo Clinic B:
  - `Загрузить базовый справочник` was visible
  - import completed through the UI
  - 43 edit-capable dictionary rows appeared
  - reload preserved all 43 rows
  - import button was no longer shown after bootstrap
- Doctor / empty Demo Clinic B:
  - import button was not visible
  - read-only message instructed the user to contact the clinic administrator
- No-tenant user:
  - `Клиника не назначена` gate remained active
  - import button was not visible
  - no local/default dictionary rows leaked into the no-tenant state
- Browser console after Admin B reload: no errors

Regression sanity:

- diagnosis `Редактировать` opened the actual diagnosis editor
- diagnosis save persisted through `saveDiagnosis`; the temporary QA name change was restored
- work `Редактировать` opened the actual work editor
- work save persisted through `saveWork`; the temporary QA name change was restored
- disable and restore both worked
- status-to-zone filtering worked: `Кость` was unavailable for natural/deciduous statuses and appeared after selecting missing-tooth status
- search by zone label returned matching rows
- search by status label returned matching rows

## Cloud safety

Cloud was not modified.

- migration 0010 was not applied to cloud
- no cloud seed
- no cloud tenants created
- no cloud users created
- no cloud dictionary rows inserted
- no cloud reset

Cloud apply must happen later after merge through a separate task.

## What was intentionally NOT changed

- no `supabase/seed.sql` edits
- no cloud apply
- no frontend auto-seeding
- no source documents
- no unrelated RLS changes
- no existing migration edits
- no patient data
- no credentials

## Remaining known issues

- apply 0010 to dev/test cloud after merge
- findings archive UI cleanup
- role label UX
- future dental photo upload/storage integration
- `integration_tokens` advisor info if still present

## Checks

- `git status --short`: only the report changed for this validation; pre-existing untracked local artifacts were not staged or modified
- `npm run lint`: PASS
- `npm run test -- --run`: PASS in CI-equivalent environment, 35 test files and 275 tests
  - first local run failed only because ignored `.env.local` activates Supabase while `AuthContext.test.tsx` explicitly tests dev fallback
  - rerun with `.env.local` temporarily moved outside the workspace and restored in `finally`: PASS
- `npm run build`: PASS
  - existing Vite chunk-size warning remains non-blocking
- GitHub Actions CI before validation report update: PASS for PR head `21d1a12b7a89e02812b97f113204f0f3af2fe769`
- GitHub Actions CI after validation report push: pending at report commit time

## Final verdict

**READY FOR REVIEW**

Implementation, local migration validation, authenticated idempotent bootstrap, browser role smoke, regression sanity, lint, tests, and build all passed. Migration `0010` remains Git/local-only and was not applied to cloud.

## Recommended next task

`SUPABASE-CLOUD-APPLY-0010-DICTIONARY-TEMPLATE-BOOTSTRAP`
