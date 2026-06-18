# SUPABASE-CLOUD-APPLY-AUDIT-ACTIVITY-001 — Cloud audit/activity apply

## 1. Summary

Applied audit/activity migrations `0012_create_audit_activity_log` and `0013_create_audit_activity_rpc` to the Supabase cloud dev/test project `cwkgxgubvdkkjcslvdgn`.

This was a controlled cloud schema sync only. No app code, migrations, seed data, UI, local Supabase, browser smoke, Edge Functions, storage policies, tenants, users, patients, or persistent audit/activity rows were changed outside the two cloud migration DDL applications.

Final validation confirms:

- `public.audit_events` exists;
- `public.activity_events` exists;
- legacy `public.audit_logs` remains preserved;
- RLS is enabled on all audit/activity tables;
- table grants remain conservative;
- internal helper functions exist;
- helper functions are `SECURITY DEFINER` with `search_path=public, pg_temp`;
- `PUBLIC`, `anon`, and `authenticated` cannot execute internal helpers;
- `service_role` can execute internal helpers;
- final `audit_events` and `activity_events` counts are both zero.

## 2. Branch name

`cloud/apply-audit-activity-001`

## 3. PR URL

TBD before PR creation.

## 4. PR head reviewed before final report update

TBD before final report update.

## 5. Report update commit

N/A because the final report update commit cannot reference itself before creation.

## 6. Changed files summary

Expected report-only change:

- `_ai_work/REPORTS/SUPABASE-CLOUD-APPLY-AUDIT-ACTIVITY-001_cloud_apply.md`

No app code, migration file, seed, generated type, UI, browser, local Supabase, or cloud data file was changed.

## 7. Supabase project

- Project id: `cwkgxgubvdkkjcslvdgn`
- Project ref: `cwkgxgubvdkkjcslvdgn`
- Project name: `codex-test-cloud`
- Region: `ap-northeast-2`
- Status before apply: `ACTIVE_HEALTHY`
- Database host: `db.cwkgxgubvdkkjcslvdgn.supabase.co`
- Postgres version: `17.6.1.127`

Cloud only. Local Supabase was intentionally not used for this task.

## 8. Preflight

### Migrations before apply

Before apply, cloud migrations existed through:

- `0011_patient_file_metadata`

`0012_create_audit_activity_log` was not present.

`0013_create_audit_activity_rpc` was not present.

### Tables before apply

Before apply:

- `public.audit_logs` existed and had RLS enabled;
- `public.audit_events` did not exist;
- `public.activity_events` did not exist.

### Functions before apply

Before apply:

- `public.record_audit_event_internal(...)` did not exist;
- `public.record_activity_event_internal(...)` did not exist.

### Advisors before apply

Security advisor findings before apply were pre-existing/out of scope:

- `public.integration_tokens` has RLS enabled with no policies;
- `public.get_user_tenants()` is a `SECURITY DEFINER` function executable by `authenticated`;
- `public.has_tenant_role(...)` is a `SECURITY DEFINER` function executable by `authenticated`.

Performance advisor findings before apply were pre-existing and unrelated to this task. They included unindexed foreign key warnings and unused index warnings on existing tables.

## 9. Applied migrations

### `0012_create_audit_activity_log`

Applied exact merged SQL from:

- `supabase/migrations/0012_create_audit_activity_log.sql`

Result: applied successfully.

Immediate validation after 0012 passed:

- `public.audit_events` exists;
- `public.activity_events` exists;
- `public.audit_logs` still exists;
- RLS enabled on `audit_events`;
- RLS enabled on `activity_events`;
- `audit_events` count = 0;
- `activity_events` count = 0;
- `anon` has no table access;
- `authenticated` has SELECT only;
- `authenticated` has no INSERT/UPDATE/DELETE;
- expected policies exist;
- expected constraints exist;
- expected indexes exist.

### `0013_create_audit_activity_rpc`

Applied exact merged SQL from:

- `supabase/migrations/0013_create_audit_activity_rpc.sql`

Result: applied successfully.

Post-apply migrations now include:

- `20260618114955` / `0012_create_audit_activity_log`
- `20260618115334` / `0013_create_audit_activity_rpc`

## 10. Post-apply table validation

### Tables

Validated cloud tables:

- `public.audit_events`: exists, RLS enabled;
- `public.activity_events`: exists, RLS enabled;
- `public.audit_logs`: still exists, RLS enabled.

### Counts

Final persistent counts:

- `audit_events` = 0;
- `activity_events` = 0;
- `tenants` = 0.

No seed, backfill, or persistent test rows were inserted.

### Table grants

Validated role privileges:

`anon`:

- no SELECT;
- no INSERT;
- no UPDATE;
- no DELETE.

`authenticated`:

- SELECT = yes;
- INSERT = no;
- UPDATE = no;
- DELETE = no.

This matches the intended design: SELECT is still filtered by RLS, and runtime writes are blocked.

### Policies

Validated policies:

- `Clinic admins can read tenant audit events` on `audit_events`;
- `Clinic members can read allowed activity events` on `activity_events`.

### Constraints and indexes

Validated constraints include:

- non-empty audit action/target checks;
- audit category/severity/redaction checks;
- JSON object checks for metadata and before/after/diff payloads;
- activity category/visibility/severity checks;
- activity type/title/source checks;
- tenant/patient FK safety.

Validated indexes include:

- audit tenant/created_at;
- audit patient/created_at;
- audit actor/created_at;
- audit target;
- audit category/created_at;
- audit severity/created_at;
- audit created_at;
- activity tenant/occurred_at;
- activity patient/occurred_at;
- activity audit_event_id;
- activity category/occurred_at;
- activity visibility/occurred_at;
- activity source;
- activity occurred_at.

## 11. Post-apply function validation

Validated functions:

- `public.record_audit_event_internal(...)` exists;
- `public.record_activity_event_internal(...)` exists.

Both functions are:

- `SECURITY DEFINER`;
- configured with `search_path=public, pg_temp`.

Function execute grants:

- `PUBLIC`: cannot execute;
- `anon`: cannot execute;
- `authenticated`: cannot execute;
- `service_role`: can execute.

This preserves the intended rule: internal raw helpers are not browser-callable by normal authenticated users.

## 12. Optional function tests

A safe rollback transaction was used to test valid helper execution without persistent rows.

Because cloud had no existing tenants, the test transaction created a temporary tenant row inside the transaction, called both helpers, and then rolled the transaction back.

Observed inside the rollback test:

- audit helper returned an id;
- activity helper returned an id;
- no persistent rows remained after rollback.

Same-statement row visibility for the inserted rows was not used as the authoritative link/count check because PostgreSQL snapshot behavior around helper calls in CTEs made that unreliable in this tool context. Final post-rollback counts were checked separately and remained zero.

Runtime invalid payload checks performed successfully:

- empty audit action rejected;
- unsupported audit category rejected;
- audit metadata array rejected;
- missing activity tenant rejected.

Additional invalid payload protections were validated by function body/table constraints:

- empty target_type;
- empty target_id;
- invalid severity;
- invalid redaction level;
- before_data/after_data/diff_data non-object payloads;
- unsupported activity category;
- unsupported activity visibility;
- activity metadata non-object payload.

The larger batch invalid-payload test was blocked by the SQL tool safety layer before reaching Postgres, so the report uses the successful single-case runtime checks plus catalog/function validation instead of pretending a blocked batch ran.

## 13. Advisors after apply

### Security advisors

Security advisor after apply reported the same existing warnings as preflight:

- `public.integration_tokens` has RLS enabled with no policies;
- `public.get_user_tenants()` is a SECURITY DEFINER function executable by `authenticated`;
- `public.has_tenant_role(...)` is a SECURITY DEFINER function executable by `authenticated`.

No new advisor warning was reported for:

- `public.audit_events`;
- `public.activity_events`;
- `public.record_audit_event_internal(...)`;
- `public.record_activity_event_internal(...)`.

### Performance advisors

Post-apply performance advisor was attempted twice but blocked by the tool safety layer. Preflight performance advisors were captured and contained only existing warnings unrelated to this task. This limitation is documented rather than hidden, because apparently even advisor calls can have stage fright.

## 14. What was intentionally NOT changed

- no app code;
- no migration files committed;
- no seed/backfill;
- no persistent data inserts;
- no local Supabase;
- no browser smoke;
- no UI;
- no admin audit viewer;
- no encounter/visit implementation;
- no payment/stock/document implementation;
- no storage policy changes;
- no Edge Functions;
- no generated types;
- no secrets or environment files.

## 15. Checks

### Cloud checks

Completed:

- project identity/status check;
- migration list preflight;
- table/function preflight;
- preflight advisors;
- applied `0012` only because missing;
- validated `0012` before continuing;
- applied `0013` only because missing;
- validated tables, RLS, policies, constraints, indexes, grants, functions, function grants, and counts;
- safe rollback helper execution test;
- final counts remain zero.

### Git status

Report-only PR expected. Git status equivalent is represented by PR changed files after creation.

### GitHub Actions CI

Pending until PR is opened and GitHub Actions completes.

## 16. Final verdict

`CLOUD AUDIT ACTIVITY MIGRATIONS APPLIED AND VERIFIED`

## 17. Recommended next task

`ADMIN-AUDIT-VIEWER-001`
