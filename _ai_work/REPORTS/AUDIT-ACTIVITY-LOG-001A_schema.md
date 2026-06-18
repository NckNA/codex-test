# AUDIT-ACTIVITY-LOG-001A Schema Report

## Summary

This PR adds the first schema-only audit/activity log foundation for DentalFlow CRM.

It introduces two new tables:

- `public.audit_events`: append-only compliance/security audit log.
- `public.activity_events`: safer product-facing activity projection for future patient timeline and admin activity feeds.

The existing `public.audit_logs` table is not removed, renamed, backfilled, or destructively changed. It remains a legacy/minimal scaffold for now.

Local Supabase migration replay and RLS simulation were performed in this validation update. The schema and RLS behavior mostly validate, but the PR is **not ready to merge** because grants on the new tables are not conservative enough: `authenticated` has `TRUNCATE`, `REFERENCES`, and `TRIGGER` privileges in addition to `SELECT`.

## Branch name

`feature/audit-activity-log-001a`

## PR URL

https://github.com/NckNA/codex-test/pull/303

## PR head reviewed before final report update

`b222a005cc72154f03aac239c1b089dd0857ba26`

GitHub PR metadata before this report update showed the expected branch, base branch `main`, and exactly two changed files:

1. `supabase/migrations/0012_create_audit_activity_log.sql`
2. `_ai_work/REPORTS/AUDIT-ACTIVITY-LOG-001A_schema.md`

## Report update commit

N/A because the final report update commit cannot reference itself before creation.

## Changed files summary

Expected PR files:

1. `supabase/migrations/0012_create_audit_activity_log.sql`
2. `_ai_work/REPORTS/AUDIT-ACTIVITY-LOG-001A_schema.md`

This validation update changes only:

1. `_ai_work/REPORTS/AUDIT-ACTIVITY-LOG-001A_schema.md`

No app code, UI, repositories, generated types, seed data, cloud changes, or browser smoke were added.

## Current schema recon

### Existing `audit_logs`

`audit_logs` is defined with:

- `id uuid primary key default gen_random_uuid()`
- `tenant_id uuid not null references tenants(id)`
- `user_id uuid references auth.users(id)`
- `action text not null`
- `entity_type text not null`
- `entity_id uuid`
- `metadata jsonb`
- `created_at timestamptz default now()`

Local post-reset validation confirmed the legacy table still exists with that same 8-column shape. It was not removed or destructively changed by migration `0012`.

RLS remains enabled on `audit_logs`.

### Existing helper functions

Existing helpers are used by the new RLS policies:

- `public.get_user_tenants()`
- `public.has_tenant_role(target_tenant_id uuid, allowed_roles app_role[])`

No new helper or SECURITY DEFINER function is introduced by this PR.

### Roles detected

Exact `app_role` enum values detected in the schema:

- `platform_owner`
- `platform_admin`
- `clinic_owner`
- `clinic_admin`
- `doctor`
- `registrar`
- `cashier`
- `marketer`
- `support`

`receptionist` is not present in the enum, so the migration does not invent it.

### FK safety findings

Safe current references used:

- `tenant_id` references `public.tenants(id)`.
- `actor_user_id` references `auth.users(id)`.
- patient references use `(tenant_id, patient_id)` against `public.patients(tenant_id, id)` and clear only `patient_id` if that patient row is deleted, preserving tenant scope.

Future objects are intentionally not hard-FKed because the tables do not exist yet:

- visits;
- encounters;
- payments;
- stock movements.

Future links are stored as nullable id fields for now.

## Migration summary

Migration file:

`supabase/migrations/0012_create_audit_activity_log.sql`

Creates:

- `public.audit_events`
- `public.activity_events`

Adds:

- check constraints;
- JSON object checks;
- table and column comments;
- tenant/patient/actor/source/category/visibility indexes;
- RLS policies;
- explicit grant/revoke statements.

## Local Supabase status

Command run:

```bash
npx supabase status
```

Result:

- local Supabase was running;
- Project URL: `http://127.0.0.1:54321`;
- local database URL target: `127.0.0.1:54322/postgres`;
- Studio was available at `http://127.0.0.1:54323`;
- some optional local containers were reported as stopped/restarting, but the local database was healthy enough for `db reset` and SQL validation.

Credential/key values printed by Supabase CLI were not copied into this report.

Supabase cloud project `cwkgxgubvdkkjcslvdgn` was not touched.

## Local migration replay/reset

Command run:

```bash
npx supabase db reset
```

Result: **PASS**

Observed migration replay:

- `0001_initial_schema.sql`
- `0002_add_dental_chart_editor_fields_to_tooth_states.sql`
- `0003_add_dental_chart_links_to_findings.sql`
- `0004_align_findings_status_lifecycle.sql`
- `0005_create_clinical_dictionary_items.sql`
- `0006_treatment_plan_stage_sync_rpc.sql`
- `0007_revoke_anon_execute_from_treatment_plan_rpc.sql`
- `0008_harden_rls_helper_function_grants.sql`
- `0009_backfill_dental_photo_storage.sql`
- `0010_clinical_dictionary_template_bootstrap.sql`
- `0011_patient_file_metadata.sql`
- `0012_create_audit_activity_log.sql`

The reset completed successfully and seeded `supabase/seed.sql`.

## Table existence and RLS enabled results

Post-reset SQL validation:

| table | exists | RLS enabled | force RLS |
|---|---:|---:|---:|
| `public.activity_events` | yes | yes | no |
| `public.audit_events` | yes | yes | no |
| `public.audit_logs` | yes | yes | no |

## Counts after reset

Post-reset counts before any RLS simulation fixture transaction:

| table | rows |
|---|---:|
| `public.audit_events` | 0 |
| `public.activity_events` | 0 |

Counts after the RLS simulation rollback were also checked and remained:

| table | rows |
|---|---:|
| `public.audit_events` | 0 |
| `public.activity_events` | 0 |

## Constraints validation

Result: **PASS**

Detected constraints on `public.audit_events`:

- primary key: `audit_events_pkey`;
- FK: `audit_events_tenant_id_fkey` to `public.tenants(id)`;
- FK: `audit_events_actor_user_id_fkey` to `auth.users(id)`;
- composite FK: `audit_events_patient_fk` to `public.patients(tenant_id, id)` with `ON DELETE SET NULL (patient_id)`;
- non-empty checks for `action`, `target_type`, `target_id`;
- category enum-like check;
- severity check;
- redaction level check;
- JSON object checks for `metadata`, `before_data`, `after_data`, `diff_data`.

Detected constraints on `public.activity_events`:

- primary key: `activity_events_pkey`;
- FK: `activity_events_tenant_id_fkey` to `public.tenants(id)`;
- FK: `activity_events_actor_user_id_fkey` to `auth.users(id)`;
- FK: `activity_events_audit_event_id_fkey` to `public.audit_events(id)` with `ON DELETE SET NULL`;
- composite FK: `activity_events_patient_fk` to `public.patients(tenant_id, id)` with `ON DELETE SET NULL (patient_id)`;
- category check;
- visibility check;
- severity check;
- JSON object check for `metadata`;
- non-empty checks for `type`, `title`, `source_type`, `source_id`.

## Index validation

Result: **PASS**

Detected indexes on `public.audit_events`:

- `audit_events_pkey`
- `idx_audit_events_actor_created_at`
- `idx_audit_events_category_created_at`
- `idx_audit_events_created_at`
- `idx_audit_events_patient_created_at`
- `idx_audit_events_severity_created_at`
- `idx_audit_events_target`
- `idx_audit_events_tenant_created_at`

Detected indexes on `public.activity_events`:

- `activity_events_pkey`
- `idx_activity_events_audit_event_id`
- `idx_activity_events_category_occurred_at`
- `idx_activity_events_occurred_at`
- `idx_activity_events_patient_occurred_at`
- `idx_activity_events_source`
- `idx_activity_events_tenant_occurred_at`
- `idx_activity_events_visibility_occurred_at`

## Comments validation

Result: **PASS**

Detected table comments:

- `public.audit_events`: append-only compliance/security audit log; patient timeline must not render raw audit diffs directly.
- `public.activity_events`: safe product-facing activity projection for future patient timeline and admin activity feeds.

Detected column comments include:

- audit tenant scope;
- audit before/after/diff safety guidance;
- redaction level meaning;
- correction reason intent;
- activity audit link safety note;
- activity visibility meaning;
- activity metadata safety guidance.

## Policy validation

Result: **PASS**

Detected policies:

### `public.audit_events`

Policy:

`Clinic admins can read tenant audit events`

Command:

- `SELECT`

Role:

- `authenticated`

Condition:

- `tenant_id IS NOT NULL`
- current authenticated user must have `clinic_owner` or `clinic_admin` for that tenant through `public.has_tenant_role(...)`.

### `public.activity_events`

Policy:

`Clinic members can read allowed activity events`

Command:

- `SELECT`

Role:

- `authenticated`

Condition:

- `clinic_owner` and `clinic_admin` can read all tenant activity;
- `doctor` can read `clinical` and `admin` activity;
- `registrar` can read `admin` activity;
- `cashier` can read `financial` and `admin` activity.

No `INSERT`, `UPDATE`, or `DELETE` policies were detected for the new tables.

## Grants validation

Result: **FAIL**

The migration correctly prevents `anon` from selecting or mutating the two new tables.

However, local privilege validation showed `authenticated` has more than `SELECT`:

| grantee | table | SELECT | INSERT | UPDATE | DELETE | TRUNCATE | REFERENCES | TRIGGER |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| `anon` | `audit_events` | no | no | no | no | no | no | no |
| `anon` | `activity_events` | no | no | no | no | no | no | no |
| `authenticated` | `audit_events` | yes | no | no | no | **yes** | **yes** | **yes** |
| `authenticated` | `activity_events` | yes | no | no | no | **yes** | **yes** | **yes** |
| `service_role` | both tables | yes | yes | yes | yes | yes | yes | yes |

This is not conservative enough for audit/activity tables.

Exact issue:

- `authenticated` should not retain `TRUNCATE`, `REFERENCES`, or `TRIGGER` privileges on `public.audit_events` or `public.activity_events`.
- For this schema foundation, `authenticated` should be limited to `SELECT` only, with RLS deciding row visibility.
- Write paths should remain reserved for future controlled repository/RPC/service work.

Likely fix in this PR:

```sql
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.audit_events FROM authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.activity_events FROM authenticated;
```

This report does not apply the fix because the requested action was validation/report-only.

## RLS simulation results

Result: **PASS for row visibility behavior**

Local simulation method:

- used a local transaction;
- inserted temporary local-only tenants/users/tenant role memberships/audit events/activity events;
- used `SET LOCAL ROLE authenticated`;
- used `set_config('request.jwt.claim.sub', <test-user-id>, true)` to simulate `auth.uid()`;
- rolled back the transaction after the simulation;
- rechecked counts after rollback.

### `anon`

`anon` cannot select either new table:

- `audit_events`: `permission denied for table audit_events`
- `activity_events`: `permission denied for table activity_events`

This is expected.

### No-tenant user

No tenant membership:

| probe | visible rows |
|---|---:|
| audit events | 0 |
| activity events | 0 |

Result: **PASS**

### Cross-tenant user

Clinic B admin against Clinic A data:

| probe | visible rows |
|---|---:|
| all audit visible to Clinic B admin | 1 |
| Clinic A audit visible to Clinic B admin | 0 |
| Clinic B audit visible to Clinic B admin | 1 |
| all activity visible to Clinic B admin | 1 |
| Clinic A activity visible to Clinic B admin | 0 |
| Clinic B activity visible to Clinic B admin | 1 |

Result: **PASS**

No cross-tenant leakage was observed.

### `clinic_owner` / `clinic_admin`

Clinic A owner/admin against Clinic A data:

| role | audit visible | activity visible |
|---|---:|---:|
| `clinic_owner` | 1 | 4 |
| `clinic_admin` | 1 | 4 |

Result: **PASS**

Owner/admin can read raw tenant audit events and all tenant activity events.

### `doctor`

Clinic A doctor:

| probe | result |
|---|---:|
| raw audit events | 0 |
| activity `admin` | 1 |
| activity `clinical` | 1 |
| activity `financial` | 0 |
| activity `system` | 0 |

Result: **PASS**

Doctor cannot select raw audit events and can read only clinical/admin activity.

### `registrar`

Clinic A registrar:

| probe | result |
|---|---:|
| raw audit events | 0 |
| activity `admin` | 1 |
| activity `clinical` | 0 |
| activity `financial` | 0 |
| activity `system` | 0 |

Result: **PASS**

Registrar cannot select raw audit events and can read only admin activity.

### `cashier`

Clinic A cashier:

| probe | result |
|---|---:|
| raw audit events | 0 |
| activity `admin` | 1 |
| activity `financial` | 1 |
| activity `clinical` | 0 |
| activity `system` | 0 |

Result: **PASS**

Cashier cannot select raw audit events and can read financial/admin activity.

## Data boundary

- Local Supabase only.
- Supabase cloud was not touched.
- No cloud project reset/apply/migration command was run.
- No storage upload was performed.
- No browser smoke was performed.
- No app code was changed.
- No UI was changed.
- No repository/RPC work was started.
- No `AUDIT-ACTIVITY-REPOSITORY-001B` work was started.

## What was intentionally NOT changed

- Existing `audit_logs` was not removed.
- No app code.
- No React UI.
- No repositories.
- No RPC functions.
- No cloud migration apply.
- No browser smoke.
- No seed or backfill committed.
- No visit/encounter/payment/stock/document implementation.
- No source mutation outside this report.
- No secrets or credential values are stored in this report.

## Checks

Local checks:

| check | result |
|---|---:|
| `git status --short` before report update | clean |
| `npx supabase status` | PASS |
| `npx supabase db reset` | PASS |
| local table/RLS/grants SQL validation | PARTIAL, grants failure |
| local RLS simulation | PASS |
| `npm run lint` | PASS |
| `npm run test -- --run` | PASS, 44 files / 354 tests |
| `npm run build` | PASS |

Test warnings observed:

- known React `act(...)` warnings in existing component/hook tests;
- expected error-path console output in dictionary tests;
- these did not fail the test run.

Build warning observed:

- existing Vite chunk size warning for the large app bundle;
- build still passed.

GitHub Actions CI before this report update:

- PR: `#303`
- workflow: `CI`
- job: `validate`
- run: `27740976604`
- tested commit: `b222a005cc72154f03aac239c1b089dd0857ba26`
- conclusion: success

Fresh GitHub Actions CI for the report update commit must be checked after this report update is pushed.

## Final verdict

`PARTIAL`

Exact failure:

- Local Supabase reset and RLS simulation were performed.
- Table creation, constraints, indexes, comments, policies, counts, and RLS row visibility behavior passed.
- Grants did **not** pass conservative validation because `authenticated` retains `TRUNCATE`, `REFERENCES`, and `TRIGGER` on both `public.audit_events` and `public.activity_events`.

The PR should not be merged until those grants are tightened.

## Recommended next task

`AUDIT-ACTIVITY-LOG-001A-GRANTS-FIX`

Suggested scope:

- update only migration/report if acceptable for this PR;
- revoke `TRUNCATE`, `REFERENCES`, and `TRIGGER` from `authenticated` on both new tables;
- rerun `npx supabase db reset`;
- rerun grants/RLS validation;
- rerun lint/tests/build;
- wait for CI.
