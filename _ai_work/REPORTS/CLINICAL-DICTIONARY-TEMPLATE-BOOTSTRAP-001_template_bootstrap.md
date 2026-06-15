# CLINICAL-DICTIONARY-TEMPLATE-BOOTSTRAP-001 template bootstrap report

## Summary

Implemented a Git-only clinical dictionary template/bootstrap mechanism for tenant-scoped dictionary import.

Cloud was not modified. Migration 0010 was not applied to cloud.

## Branch

`feature/clinical-dictionary-template-bootstrap-001`

## PR URL

Pending PR creation.

## PR head reviewed before final report update

Pending final report update.

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

`MedicalPage.tsx` now includes explicit empty-dictionary bootstrap UX:

- Supabase active + active tenant + clinic owner/admin + empty dictionary: shows `Загрузить базовый справочник`
- Supabase active + active tenant + doctor/non-admin + empty dictionary: shows read-only contact-admin message
- Supabase active + no tenant: no import button
- existing dictionary: no auto-import and no import button

Known implementation note: `MedicalPage.tsx` was simplified while adding the import UX. This should receive focused review because the task asked for minimal UI changes.

## Local validation

Not completed in this pass:

- `npx supabase status` not run
- `npx supabase db reset` not run
- SQL template counts not locally verified
- Demo Clinic B bootstrap RPC not locally smoke-tested with authenticated context
- doctor/non-admin RPC block not locally validated

SQL-level expected migration outcomes after reset:

- template key: `default_dental_v1`
- template items: 25 diagnoses, 18 works, 43 total
- Demo Clinic A seed remains 25 diagnoses, 18 works, 43 total
- Demo Clinic B starts with 0 rows until explicit bootstrap
- null `tenant_id` dictionary rows remain 0

## Browser smoke

Not completed in this pass.

Required browser smoke still needed:

- admin/owner empty dictionary sees import button and import succeeds
- doctor/non-admin empty dictionary does not see import button
- no-tenant gate remains without import button

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

Pending:

- `git status --short`: not run locally
- `npm run lint`: not run locally
- `npm run test -- --run`: not run locally
- `npm run build`: not run locally
- GitHub Actions CI: pending PR creation

## Final verdict

PARTIAL: implementation is present in Git branch, but local Supabase validation, browser smoke, and CI are still missing.

## Recommended next task

`SUPABASE-CLOUD-APPLY-0010-DICTIONARY-TEMPLATE-BOOTSTRAP`
