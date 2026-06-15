# SUPABASE-CLOUD-DICTIONARY-SEED-RECON-001: Dictionary seed strategy

## Summary
Recon-only audit for clinical dictionary seed/bootstrap behavior.

Default clinical dictionaries currently live in local/dev seed data and legacy local TypeScript defaults. Cloud dev/test has the schema but no tenants and no clinical dictionary rows.

No cloud data was changed. No migration, source code, seed, RLS, tenant, user, or dictionary data was created.

Final verdict: `READY FOR DICTIONARY BOOTSTRAP IMPLEMENTATION`.

## Branch
`recon/cloud-dictionary-seed-001`

## PR URL
https://github.com/NckNA/codex-test/pull/286

## PR head reviewed before final report update
`73e5a9f0aa7b4f40dfe5dc284421e41d0351a563`

## Report update commit
N/A because the final report update commit cannot reference itself before creation.

## Changed files summary
Report-only change:
- `_ai_work/REPORTS/SUPABASE-CLOUD-DICTIONARY-SEED-RECON-001_dictionary_seed_strategy.md`

No source, migration, seed, RLS, script, or existing report files were changed.

## Root cause
Local/dev Demo Clinic A has dictionary defaults, but SaaS/cloud tenant dictionary bootstrap is not defined. New real tenants would currently start empty unless tenant-scoped dictionary items are created by a controlled setup flow.

## Git/code audit

Migration `0005_create_clinical_dictionary_items` creates tenant-scoped `clinical_dictionary_items`:
- primary key: `(tenant_id, id)`
- `type`: `diagnosis` or `work`
- work access mode: `base_available`, `status_available`, or `requires_diagnosis`
- SELECT is tenant-member scoped through `get_user_tenants()`
- writes are owner/admin scoped through `has_tenant_role(...)`

`supabase/seed.sql` creates local/dev demo data:
- Demo Clinic A receives the clinical dictionary defaults.
- Demo Clinic B receives no dictionary rows.
- Demo Clinic A default count is 25 diagnoses, 18 works, 43 total.
- The seed insert is idempotent through conflict handling.
- This is local/dev reset data, not a production/cloud onboarding strategy.

Runtime behavior:
- localStorage mode still has legacy local defaults from `src/config/clinicalDictionaries.ts`.
- Supabase repository does not auto-seed dictionaries.
- Supabase mode requires an active tenant and returns empty arrays for empty tenant dictionaries.
- `useDictionaries`, `MedicalPage`, and `TenantContext` do not bootstrap dictionaries for new tenants.
- `scripts/seed-qa-users.cjs` seeds QA users/memberships only, not dictionary rows.

Safety conclusion: there is no frontend Supabase auto-seeding path. Empty Supabase tenant dictionary result stays empty. Demo Clinic A seed must not be treated as production default.

## Local validation
Codex completed the missing local validation.

Result id: `LOCAL-DICTIONARY-SEED-RECON-VALIDATION-001`

Validated branch: `recon/cloud-dictionary-seed-001`

Validated commit: `73e5a9f0aa7b4f40dfe5dc284421e41d0351a563`

Local Supabase:
- status before start: running
- status after start if needed: not needed
- db reset: pass

Schema:
- `clinical_dictionary_items` exists: yes

Demo Clinic A:
- diagnosis count: 25
- work count: 18
- total count: 43

Demo Clinic B:
- total count: 0

Tenant safety:
- null `tenant_id` rows: 0

Template/global/bootstrap tables:
- found: no
- list: none

Final local verdict: `LOCAL DICTIONARY SEED RECON VALIDATION PASSED`.

## Cloud read-only audit

Project:
- name: `codex-test-cloud`
- id/ref: `cwkgxgubvdkkjcslvdgn`
- status: `ACTIVE_HEALTHY`
- environment: dev/test cloud

Migration history contains migrations through `0009`, including `0005_create_clinical_dictionary_items`.

Read-only counts:
- tenants: 0
- tenant_users: 0
- clinical_dictionary_items: 0
- clinical_dictionary_items with null tenant_id: 0

No template/default/global/bootstrap dictionary table was found in cloud.

No cloud inserts, updates, deletes, DDL, tenant creation, user creation, seed, reset, or dictionary rows were performed.

Advisor state remained unchanged from known post-hardening state:
- `integration_tokens` RLS/no-policy info remains out of scope.
- authenticated SECURITY DEFINER helper warnings remain out of scope for intentional RLS helpers.

## Strategy options

A. Keep `seed.sql` only for local/dev Demo Clinic A.
- Good for local reset.
- Not a SaaS onboarding strategy.

B. Add immutable dictionary template tables.
- Reusable, versionable, auditable.
- Recommended foundation.

C. Add secured tenant bootstrap RPC/function.
- Copies template items into exactly one tenant.
- Recommended implementation mechanism.

D. Add admin import defaults UI later.
- Useful UX layer, but still needs backend templates/rules.

E. Frontend auto-seeding.
- Rejected for Supabase production/SaaS mode because hidden writes can create leakage risk, write failures, race conditions, and poor auditability.

## Recommended architecture
Use Git-defined template/bootstrap architecture:

1. Keep `seed.sql` as local/dev Demo Clinic A data only.
2. Add reusable dictionary template tables in a future migration.
3. Add a secured tenant bootstrap mechanism that copies template items into `clinical_dictionary_items` for exactly one target tenant.
4. Call bootstrap from a controlled tenant creation/admin flow, never automatically from frontend reads.
5. Preserve tenant isolation: copied dictionary items must always carry the target tenant id; no global null-tenant fallback.

This avoids cross-tenant leakage and keeps SaaS onboarding explicit and auditable.

## Proposed next task
`CLINICAL-DICTIONARY-TEMPLATE-BOOTSTRAP-001`

Scope summary:
- create template tables and default template data in Git migration;
- create secure tenant bootstrap mechanism;
- preserve existing `clinical_dictionary_items` RLS;
- no frontend auto-seeding;
- test that a new tenant receives only its own copied defaults;
- test no-tenant and other-tenant isolation.

## What was intentionally NOT changed
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

## Remaining known issues
- findings archive UI cleanup
- role label UX
- future dental photo upload/storage integration
- `integration_tokens` advisor info if still present
- documents/payments/stock/subscription features pending

## Checks
- git status --short: not run locally by this assistant; PR changed files confirm report-only scope
- npm run lint: not run locally by this assistant; GitHub Actions CI run #401 passed ESLint on reviewed head `73e5a9f0aa7b4f40dfe5dc284421e41d0351a563`
- npm run test -- --run: not run locally by this assistant; GitHub Actions CI run #401 passed tests on reviewed head `73e5a9f0aa7b4f40dfe5dc284421e41d0351a563`
- npm run build: not run locally by this assistant; GitHub Actions CI run #401 passed build on reviewed head `73e5a9f0aa7b4f40dfe5dc284421e41d0351a563`
- GitHub Actions CI result: run #401 success for PR head reviewed before this final report update

## Final verdict
`READY FOR DICTIONARY BOOTSTRAP IMPLEMENTATION`

## Recommended next task
`CLINICAL-DICTIONARY-TEMPLATE-BOOTSTRAP-001`
