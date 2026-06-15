# SUPABASE-CLOUD-DICTIONARY-SEED-RECON-001: Dictionary seed strategy

## 1. Summary
Recon-only audit for clinical dictionary seed/bootstrap behavior.

Current finding: default clinical dictionaries are split between legacy TypeScript/localStorage defaults and local `supabase/seed.sql` Demo Clinic A rows. Cloud dev/test currently has the schema but no tenants and no clinical dictionary rows.

No cloud data was changed. No migration, source code, seed, RLS, tenant, user, or dictionary data was created.

## 2. Branch
`recon/cloud-dictionary-seed-001`

## 3. PR URL
https://github.com/NckNA/codex-test/pull/286

## 4. PR head reviewed before final report update
`f319fd168828ab0584a8f4b495c78cdd5b6da9b9`

## 5. Report update commit
N/A because the final report update commit cannot reference itself before creation.

## 6. Changed files summary
Report-only change:
- `_ai_work/REPORTS/SUPABASE-CLOUD-DICTIONARY-SEED-RECON-001_dictionary_seed_strategy.md`

## 7. Root cause
Local/dev Demo Clinic A has dictionary defaults, but SaaS/cloud tenant dictionary bootstrap is not defined. New real tenants would currently start empty unless someone manually creates tenant-scoped dictionary items.

## 8. Git/code audit

### 8.1 Migration 0005 schema
`supabase/migrations/0005_create_clinical_dictionary_items.sql` creates `clinical_dictionary_items` with:
- `tenant_id uuid not null references tenants(id) on delete cascade`
- text `id`
- `type` constrained to `diagnosis` or `work`
- `name`, optional `description`
- `allowed_presence_statuses text[]`
- `allowed_zones text[]`
- `work_access_type` constrained to `base_available`, `status_available`, `requires_diagnosis`
- `allowed_diagnosis_ids text[]`
- optional `price`, `visual_priority`, `is_active`
- primary key `(tenant_id, id)`

RLS:
- SELECT: tenant members through `get_user_tenants()`.
- INSERT/UPDATE/DELETE: clinic owner/admin through `has_tenant_role(...)`.

### 8.2 seed.sql behavior
`supabase/seed.sql` creates local/dev demo data:
- Demo Clinic A tenant id: `11111111-1111-1111-1111-111111111111`.
- Demo Clinic B tenant id: `22222222-2222-2222-2222-222222222222`.
- Clinical dictionary defaults are inserted only for Demo Clinic A.
- Expected Demo Clinic A dictionary default count from task/context and seed structure: 25 diagnoses, 18 works, total 43.
- The dictionary insert is idempotent through `ON CONFLICT (tenant_id, id) DO UPDATE`.
- `seed.sql` is local/dev reset data, not a production/cloud onboarding strategy.

### 8.3 Default dictionary source in code
The legacy local source remains `src/config/clinicalDictionaries.ts`:
- `defaultDiagnoses`
- `defaultClinicalWorks`

`LocalStorageClinicalDictionariesRepository` returns and saves those defaults when localStorage is empty.

`SupabaseClinicalDictionariesRepository` does not auto-seed. It requires a `tenantId`, reads rows from `clinical_dictionary_items`, filters by `tenant_id` and `type`, and returns `[]` when Supabase returns no rows.

### 8.4 Hook/runtime behavior
`useDictionaries` chooses Supabase only when auth mode is `supabase-active`, Supabase is configured, and an active tenant exists. If Supabase auth is active but there is no active tenant, it returns empty diagnosis/work arrays and blocks writes with an active-clinic-required error.

### 8.5 MedicalPage behavior
`MedicalPage` consumes `useDictionaries`. It can display whatever the repository returns and allows management only for dev mode or Supabase clinic owner/admin roles. It does not auto-seed dictionaries.

### 8.6 TenantContext behavior
Dev mode uses fixed Demo Clinic A. Supabase mode loads tenant memberships from `tenant_users` and selected active tenant state. It does not bootstrap dictionaries for a new tenant.

### 8.7 QA seed script
`scripts/seed-qa-users.cjs` seeds local QA auth users and tenant memberships only. It does not seed dictionary rows.

### 8.8 Safety conclusion
There is no frontend Supabase auto-seeding path. Empty Supabase tenant dictionary result stays empty. Demo Clinic A seed must not be treated as production default.

## 9. Local validation
Local Supabase validation was not completed in this pass.

Not validated locally:
- `npx supabase status`
- `npx supabase db reset`
- local Demo Clinic A dictionary count
- local Demo Clinic B dictionary count
- local null `tenant_id` count
- local template/global table absence

Expected from Git/seed inspection, pending local validation:
- Demo Clinic A: 25 diagnosis, 18 work, total 43.
- Demo Clinic B: 0 dictionary rows.
- null `tenant_id`: impossible by schema and expected count 0.
- no template/global dictionary table found in Git.

## 10. Cloud read-only audit

### 10.1 Project identity
- project name: `codex-test-cloud`
- project id/ref: `cwkgxgubvdkkjcslvdgn`
- status: `ACTIVE_HEALTHY`
- environment: dev/test cloud

### 10.2 Migration history
Cloud migration history contains:
- `0001_initial_schema`
- `0002_add_dental_chart_editor_fields_to_tooth_states`
- `0003_add_dental_chart_links_to_findings`
- orphan historical `20260612152210_add_dental_photo_storage`
- `0004_align_findings_status_lifecycle`
- `0005_create_clinical_dictionary_items`
- `0006_treatment_plan_stage_sync_rpc`
- `0007_revoke_anon_execute_from_treatment_plan_rpc`
- `0008_harden_rls_helper_function_grants`
- `0009_backfill_dental_photo_storage`

### 10.3 Cloud counts
Read-only SQL counts:
- tenants: 0
- tenant_users: 0
- clinical_dictionary_items: 0
- clinical_dictionary_items with null tenant_id: 0

Because cloud has zero dictionary rows, no count by tenant/type/active was needed beyond total zero.

### 10.4 Template/global table check
No public table matching dictionary template/default/global clinical catalog/bootstrap template naming was found.

### 10.5 Advisor result
Security advisor remained unchanged from known post-hardening state:
- `integration_tokens` has RLS enabled with no policy: out of scope.
- `authenticated_security_definer_function_executable` warnings for `get_user_tenants()` and `has_tenant_role(...)`: expected/out of scope for intentional RLS helper functions.

### 10.6 Mutation safety
No cloud inserts, updates, deletes, DDL, tenant creation, user creation, seed, reset, or dictionary rows were performed.

## 11. Strategy options

### Option A: keep seed.sql only for local/dev Demo Clinic A
Pros: simple; safe for local reset; no hidden cloud writes.
Cons: new SaaS clinics start empty; not an onboarding strategy.
Conclusion: keep for local/dev only.

### Option B: global immutable dictionary template tables
Example: `clinical_dictionary_templates` and `clinical_dictionary_template_items`.
Pros: reusable, versionable, auditable.
Cons: requires migrations and bootstrap logic.
Conclusion: recommended foundation.

### Option C: tenant bootstrap RPC/function
Example: `bootstrap_clinic_defaults(tenant_id, template_id)`.
Pros: explicit, tenant-scoped, auditable, avoids frontend auto-seeding.
Cons: must be secured by owner/admin/service flow and tested with RLS.
Conclusion: recommended implementation mechanism.

### Option D: admin UI import defaults button
Pros: clinic admin chooses import timing.
Cons: requires UX and still needs backend permissions/templates.
Conclusion: useful later, not enough by itself.

### Option E: frontend auto-seeding
Conclusion: reject for Supabase production/SaaS mode. Hidden writes on read can cause cross-tenant leakage risk, RLS write failures, race conditions, and unreviewed data mutation.

## 12. Recommended architecture
Use a Git-defined template/bootstrap architecture:

1. Keep `seed.sql` as local/dev Demo Clinic A data only.
2. Add reusable dictionary template tables in a future migration.
3. Add a secured tenant bootstrap RPC/function that copies template items into `clinical_dictionary_items` for exactly one tenant.
4. Call that bootstrap from a controlled tenant creation/admin flow, never automatically from frontend reads.
5. Preserve tenant isolation: every copied dictionary item must have the target tenant id; no global `tenant_id = null` fallback should be used.

This avoids cross-tenant leakage and keeps SaaS onboarding explicit and auditable.

## 13. Proposed next task
`CLINICAL-DICTIONARY-TEMPLATE-BOOTSTRAP-001`

Scope summary:
- create template tables and default template data in Git migration;
- create secure tenant bootstrap mechanism;
- preserve existing `clinical_dictionary_items` RLS;
- no frontend auto-seeding;
- test that new tenant gets only its own copied defaults;
- test no-tenant and other-tenant isolation.

## 14. What was intentionally NOT changed
- no cloud seed
- no dictionary rows inserted
- no tenant/user creation
- no DDL
- no migration 0010
- no source code changes
- no seed.sql edits
- no RLS changes
- no cloud reset
- no implementation started

## 15. Remaining known issues
- findings archive UI cleanup
- role label UX
- future dental photo upload/storage integration
- `integration_tokens` advisor info if still present
- documents/payments/stock/subscription features pending

## 16. Checks
- git status --short: not run locally
- npm run lint: not run locally; GitHub Actions CI run #400 passed ESLint
- npm run test -- --run: not run locally; GitHub Actions CI run #400 passed tests
- npm run build: not run locally; GitHub Actions CI run #400 passed build
- GitHub Actions CI result: run #400 success for pre-final report head `f319fd168828ab0584a8f4b495c78cdd5b6da9b9`

## 17. Final verdict
PARTIAL: Git/code recon, cloud read-only recon, and GitHub Actions CI passed; local Supabase validation is still missing.

## 18. Recommended next task
`CLINICAL-DICTIONARY-TEMPLATE-BOOTSTRAP-001`
