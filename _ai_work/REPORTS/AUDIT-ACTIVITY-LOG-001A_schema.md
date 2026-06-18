# AUDIT-ACTIVITY-LOG-001A Schema Report

## Summary

This PR adds the first schema-only audit/activity log foundation for DentalFlow CRM.

It introduces two new tables:

- `public.audit_events`: append-only compliance/security audit log.
- `public.activity_events`: safer product-facing activity projection for future patient timeline and admin activity feeds.

The existing `public.audit_logs` table is not removed, renamed, backfilled, or destructively changed. It remains a legacy/minimal scaffold for now.

## Branch name

`feature/audit-activity-log-001a`

## PR URL

https://github.com/NckNA/codex-test/pull/303

## PR head reviewed before final report update

`8157bcf0eb0d9f0441a107d166b42d2c90938949`

## Report update commit

N/A because the final report update commit cannot reference itself before creation.

## Changed files summary

Expected changed files:

1. `supabase/migrations/0012_create_audit_activity_log.sql`
2. `_ai_work/REPORTS/AUDIT-ACTIVITY-LOG-001A_schema.md`

No app code, UI, repositories, generated types, seed data, cloud changes, or browser smoke were added.

## Current schema recon

### Existing `audit_logs`

`audit_logs` is defined in `supabase/migrations/0001_initial_schema.sql` with:

- `id uuid primary key default gen_random_uuid()`
- `tenant_id uuid not null references tenants(id)`
- `user_id uuid references auth.users(id)`
- `action text not null`
- `entity_type text not null`
- `entity_id uuid`
- `metadata jsonb`
- `created_at timestamptz default now()`

RLS is enabled on `audit_logs`.

Current policies allow:

- tenant members to select audit logs for their tenant;
- authenticated users to insert audit logs for their tenant.

Limitations:

- no before/after/diff fields;
- no severity;
- no redaction level;
- no correction reason;
- no request/session context;
- no patient/visit/encounter/payment/stock links;
- insert is broad for tenant members;
- raw audit is not separated from product-facing activity.

This PR intentionally does not alter `audit_logs`.

### Existing helper functions

Existing helpers are used by the new RLS policies:

- `public.get_user_tenants()`
- `public.has_tenant_role(target_tenant_id uuid, allowed_roles app_role[])`

No new helper or SECURITY DEFINER function is introduced.

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
- tenant/patient/actor indexes;
- RLS policies;
- conservative grants.

## `audit_events` design

Purpose:

- immutable security/compliance audit log;
- future accountability for sensitive clinical, financial, role, support, and correction flows;
- not intended to be rendered directly in patient timeline.

Key columns include:

- actor fields;
- action/category/severity;
- target type/id;
- patient and future domain links;
- before/after/diff JSON;
- redaction level;
- reason;
- request/session context;
- metadata;
- created timestamp.

Append-only rule:

- no runtime UPDATE policy;
- no runtime DELETE policy;
- no broad client INSERT policy in 001A.

Raw audit is not for patient timeline. Future timeline integration should use summarized `activity_events` or a safe projection.

## `activity_events` design

Purpose:

- user-facing product activity projection;
- safe future source for patient timeline;
- safe future source for admin activity feeds.

Key columns include:

- tenant and optional patient;
- optional linked audit event;
- actor;
- category/type/title/description;
- source type/id/status;
- visibility;
- severity;
- occurred timestamp;
- metadata;
- archived flag.

Visibility values:

- `clinical`
- `admin`
- `financial`
- `system`

## RLS and role visibility

### `audit_events`

SELECT:

- `clinic_owner` and `clinic_admin` can read tenant audit events.
- tenant-global null audit events are not visible through this policy.

INSERT:

- no broad client insert policy in 001A.
- future RPC/service-layer work must define controlled writes.

UPDATE/DELETE:

- no runtime policies.
- audit is append-only from the application perspective.

### `activity_events`

SELECT:

- `clinic_owner` and `clinic_admin` can read all tenant activity.
- `doctor` can read `clinical` and `admin` activity.
- `registrar` can read `admin` activity.
- `cashier` can read `financial` and `admin` activity.

INSERT:

- no broad client insert policy in 001A.

UPDATE/DELETE:

- no runtime policies.

## Redaction and security rules

The SQL comments and report document that audit/activity payloads must not store:

- passwords;
- service role keys;
- tokens;
- full file contents;
- broad PHI dumps;
- unnecessary financial details in product-facing activity.

The migration cannot fully enforce content redaction in SQL. Future repository/RPC tasks must enforce this at write time.

## Local validation

Not completed in this run.

Exact blocker:

- local terminal/Supabase CLI access is not available in the current execution environment;
- Supabase cloud must not be touched by this task;
- therefore `npx supabase status`, `npx supabase db reset`, local RLS simulation, and local advisor checks were not run.

Validation completed by static schema inspection:

- migration file exists;
- new tables are defined;
- RLS is enabled;
- policies are defined;
- constraints and indexes are defined;
- existing `audit_logs` is not removed or destructively changed;
- no seed/backfill statements are present.

Expected row counts after local reset:

- `audit_events`: 0
- `activity_events`: 0

This must be verified by a local Supabase run before merge readiness.

## What was intentionally NOT changed

- Existing `audit_logs` was not removed.
- No app code.
- No React UI.
- No repositories.
- No RPC functions.
- No cloud migration apply.
- No local Supabase reset was performed from this environment.
- No browser smoke.
- No seed or backfill.
- No visit/encounter/payment/stock/document implementation.
- No secrets or credential values are stored in this report.

## Checks

Local checks not run from this environment:

- `git status --short`
- `npx supabase status`
- `npx supabase db reset`
- local RLS simulation
- `npm run lint`
- `npm run test -- --run`
- `npm run build`

GitHub Actions CI:

- run `27740893192`
- CI `#506`
- status: completed
- conclusion: success
- tested commit: `8157bcf0eb0d9f0441a107d166b42d2c90938949`
- ESLint: success
- tests: success
- build: success

## Final verdict

`PARTIAL`

Exact missing validation:

- local Supabase migration reset and RLS simulation were not run because no local terminal/Supabase CLI is available in this execution environment.
- Supabase cloud was intentionally not touched.

## Recommended next task

`AUDIT-ACTIVITY-REPOSITORY-001B`

Before starting it, this PR should be locally validated with Supabase reset/RLS checks or reviewed by an agent with local terminal access.
