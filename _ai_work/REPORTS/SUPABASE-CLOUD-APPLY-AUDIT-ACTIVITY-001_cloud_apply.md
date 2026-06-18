# SUPABASE-CLOUD-APPLY-AUDIT-ACTIVITY-001 — Cloud audit/activity validation

## 1. Summary

Cloud project `codex-test-cloud` / `cwkgxgubvdkkjcslvdgn` was checked for the merged audit/activity migrations:

- `0012_create_audit_activity_log`
- `0013_create_audit_activity_rpc`

Current cloud state was already in sync before this report update. No migration was reapplied.

Validation confirmed that cloud has:

- `public.audit_events`;
- `public.activity_events`;
- legacy `public.audit_logs` preserved;
- RLS enabled;
- conservative table grants;
- internal helper functions;
- conservative helper function grants;
- final `audit_events` and `activity_events` counts equal to zero.

This task touched Supabase cloud only for schema state inspection and rollback-only validation. It did not change app code, migrations in Git, seed data, UI, local Supabase, browser smoke, storage policies, Edge Functions, tenant/user/patient data, or persistent audit/activity rows.

## 2. Branch name

`cloud/apply-audit-activity-001`

## 3. PR URL

https://github.com/NckNA/codex-test/pull/307

## 4. PR head reviewed before final report update

`e8d01bbaa0e45daecf8d29ec0437b6b0c63c1302`

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
- Status: `ACTIVE_HEALTHY`
- Database host: `db.cwkgxgubvdkkjcslvdgn.supabase.co`
- Postgres version: `17.6.1.127`

Cloud only. Local Supabase was intentionally not used for this task.

## 8. Preflight cloud state

### Project identity

Validated project identity/status before any schema decision:

- `codex-test-cloud`
- `cwkgxgubvdkkjcslvdgn`
- `ACTIVE_HEALTHY`

### Migrations before apply decision

Cloud migrations already included:

- `20260618114955` / `0012_create_audit_activity_log`
- `20260618115334` / `0013_create_audit_activity_rpc`

Because both required migrations were already applied, no migration was reapplied.

Current latest migration seen during preflight:

- `20260618115334` / `0013_create_audit_activity_rpc`

### Tables before apply decision

Validated existing tables:

- `public.audit_logs`: exists, RLS enabled, row count 0;
- `public.audit_events`: exists, RLS enabled, row count 0;
- `public.activity_events`: exists, RLS enabled, row count 0.

### Functions before apply decision

Validated existing functions:

- `public.record_audit_event_internal(...)`: exists;
- `public.record_activity_event_internal(...)`: exists.

### Advisors snapshot

Security advisors were checked during this validation run. Current warnings are existing/out of scope:

- `public.integration_tokens` has RLS enabled with no policies;
- `public.get_user_tenants()` is a SECURITY DEFINER function executable by `authenticated`;
- `public.has_tenant_role(...)` is a SECURITY DEFINER function executable by `authenticated`.

No security advisor warning was reported for the audit/activity tables or internal helper functions.

Performance advisors were checked during this validation run. They include INFO/WARN items such as unindexed foreign keys and unused indexes. Current audit/activity-related performance items are not blockers for this cloud-sync task because the tables are empty and these indexes are expected to appear unused until real workloads exist. Future performance tuning can address composite FK coverage if needed.

## 9. Applied migrations

### `0012_create_audit_activity_log`

Status: already present in cloud before this run.

Source file inspected in Git:

- `supabase/migrations/0012_create_audit_activity_log.sql`

No reapply was performed.

### `0013_create_audit_activity_rpc`

Status: already present in cloud before this run.

Source file inspected in Git:

- `supabase/migrations/0013_create_audit_activity_rpc.sql`

No reapply was performed.

## 10. Post-validation table state

### Tables

Validated cloud tables:

- `public.audit_events`: exists, RLS enabled;
- `public.activity_events`: exists, RLS enabled;
- `public.audit_logs`: still exists, RLS enabled.

### Counts

Final persistent counts:

- `audit_events` = 0;
- `activity_events` = 0.

Rollback-only helper tests also confirmed no temporary tenant row remained.

### Table grants

Validated role privileges for `public.audit_events` and `public.activity_events`.

`anon`:

- no table privileges found.

`authenticated`:

- SELECT = yes;
- INSERT = no;
- UPDATE = no;
- DELETE = no;
- TRUNCATE = no;
- REFERENCES = no;
- TRIGGER = no.

`service_role` remains privileged, which is expected for trusted backend/service contexts.

### Policies

Validated policies:

- `Clinic admins can read tenant audit events` on `audit_events`;
- `Clinic members can read allowed activity events` on `activity_events`.

### Constraints

Validated constraints include:

- non-empty audit action/target checks;
- audit category/severity/redaction checks;
- JSON object checks for metadata and before/after/diff payloads;
- activity category/visibility/severity checks;
- activity type/title/source checks;
- tenant/patient FK safety.

### Indexes

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

## 11. Post-validation function state

Validated functions:

- `public.record_audit_event_internal(...)`;
- `public.record_activity_event_internal(...)`.

Both functions are:

- `SECURITY DEFINER`;
- configured with `search_path=public, pg_temp`.

Function execute grants:

- `PUBLIC`: cannot execute;
- `anon`: cannot execute;
- `authenticated`: cannot execute;
- `service_role`: can execute.

This preserves the intended rule: internal raw helpers are not browser-callable by normal authenticated users.

## 12. Optional safe function tests

Rollback-only runtime tests were performed against cloud.

The valid-helper test created a temporary tenant row inside a transaction, called both helpers, confirmed helper ids, confirmed activity linked to `audit_event_id`, then deliberately rolled back.

Validated:

- valid audit helper insert works in trusted context;
- valid activity helper insert works in trusted context;
- activity helper links `audit_event_id`;
- rollback returns `audit_events` count to 0;
- rollback returns `activity_events` count to 0;
- rollback removes temporary tenant row.

Invalid payload tests were performed in a rollback-only block and rejected 11 cases:

- empty audit action;
- empty audit target_type;
- empty audit target_id;
- invalid audit category;
- invalid audit severity;
- invalid audit redaction_level;
- audit metadata array/non-object;
- audit before_data array/non-object;
- invalid activity category;
- invalid activity severity;
- activity metadata array/non-object.

Final persistent counts after rollback validations:

- `audit_events` = 0;
- `activity_events` = 0.

No persistent audit/activity rows, tenants, users, or patient data were inserted.

## 13. Advisors after validation

### Security advisors

Security advisor after validation reported the same known out-of-scope warnings:

- `public.integration_tokens` has RLS enabled with no policies;
- `public.get_user_tenants()` can be executed by `authenticated` as a SECURITY DEFINER helper;
- `public.has_tenant_role(...)` can be executed by `authenticated` as a SECURITY DEFINER helper.

No new warning was reported for:

- `public.audit_events`;
- `public.activity_events`;
- `public.record_audit_event_internal(...)`;
- `public.record_activity_event_internal(...)`.

### Performance advisors

Performance advisor output includes existing/project-wide INFO/WARN items such as:

- unindexed foreign key notices;
- unused index notices;
- auth RLS initialization plan warnings on existing profile policies.

Audit/activity-specific performance items include unused indexes and FK coverage notices on currently empty audit/activity tables. These are not blockers for this cloud-sync task. They should be revisited after real workload patterns exist.

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
- advisors snapshot;
- confirmed `0012` already present;
- confirmed `0013` already present;
- did not reapply migrations;
- validated tables, RLS, policies, constraints, indexes, grants, functions, function grants, and counts;
- safe rollback helper execution test;
- invalid payload rejection tests;
- final counts remain zero.

### Git status

Report-only PR expected. Git status equivalent is represented by PR changed files after creation.

### GitHub Actions CI

Pending for this report update commit.

## 16. Final verdict

`CLOUD ALREADY IN SYNC AND VERIFIED`

## 17. Recommended next task

`ADMIN-AUDIT-VIEWER-001`
