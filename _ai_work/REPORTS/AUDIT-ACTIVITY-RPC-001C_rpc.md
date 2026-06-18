# AUDIT-ACTIVITY-RPC-001C: controlled audit/activity RPC foundation

## Summary

This PR adds a schema-only SQL helper foundation for trusted transactional audit/activity writes.

It adds internal database helper functions that future domain-specific RPCs can call in the same transaction as sensitive mutations.

The PR does not expose arbitrary raw audit/activity writes to authenticated browser users.

## Branch name

`feature/audit-activity-rpc-001c`

## PR URL

https://github.com/NckNA/codex-test/pull/305

## PR head reviewed before final report update

`d8c95496c56e40d470d5046351bfb91157b68f5b`

## Report update commit

N/A because the final report update commit cannot reference itself before creation.

## Changed files summary

Expected files only:

- `supabase/migrations/0013_create_audit_activity_rpc.sql`
- `_ai_work/REPORTS/AUDIT-ACTIVITY-RPC-001C_rpc.md`

No app code, UI, repository write methods, seed, browser smoke, or cloud changes.

## Current RPC/function recon

Existing `save_treatment_plan_with_stages(...)` uses `SECURITY INVOKER`, sets `search_path = public`, revokes public execute, and grants execute to authenticated users. It performs a domain-specific transactional write for treatment plans and stages.

Existing RLS helpers `get_user_tenants()` and `has_tenant_role(uuid, app_role[])` were grant-hardened in migration `0008_harden_rls_helper_function_grants.sql` by revoking execute from `anon` and `PUBLIC`, while granting execute to authenticated and service_role.

Current audit/activity schema from `0012_create_audit_activity_log.sql` already contains:

- `public.audit_events`
- `public.activity_events`
- RLS on both tables
- conservative table grants
- no broad client insert/update/delete
- legacy `public.audit_logs` preserved as minimal scaffold

## Migration summary

Migration added:

`supabase/migrations/0013_create_audit_activity_rpc.sql`

Created functions:

- `public.record_audit_event_internal(...)`
- `public.record_activity_event_internal(...)`

The optional combined helper was intentionally deferred. Future domain RPCs can call both internal helpers in the same transaction when both raw audit and product activity rows are needed.

## Security model

The helpers are internal trusted write helpers, not browser-facing raw audit writers.

Both helper functions are:

- `SECURITY DEFINER`
- `SET search_path = public, pg_temp`
- revoked from `PUBLIC`
- revoked from `anon`
- revoked from `authenticated`
- granted only to `service_role`

This prevents normal authenticated browser code from creating fake audit or activity rows directly.

Future domain-specific RPCs should enforce tenant/role/business rules and then call these helpers transactionally.

## Function behavior

### `record_audit_event_internal(...)`

Inserts one row into `public.audit_events` and returns the inserted audit event id.

It validates:

- non-empty `action`
- allowed audit `category`
- non-empty `target_type`
- non-empty `target_id`
- allowed `severity`
- allowed `redaction_level`
- `metadata` is a JSON object
- `before_data`, `after_data`, and `diff_data` are JSON objects when provided

It supports future links for patient, appointment, visit, encounter, treatment plan, stage, finding, file, payment, and stock movement.

### `record_activity_event_internal(...)`

Inserts one row into `public.activity_events` and returns the inserted activity event id.

It validates:

- non-null `tenant_id`
- allowed activity `category`
- non-empty `type`
- non-empty `title`
- non-empty `source_type`
- non-empty `source_id`
- allowed `visibility`
- allowed `severity`
- `metadata` is a JSON object

It optionally links to `audit_event_id` and patient id.

## Grants and revokes

No table grants were expanded.

Function grants are conservative:

- `PUBLIC`: no execute
- `anon`: no execute
- `authenticated`: no execute
- `service_role`: execute

No broad client write path was added.

## Validation status

GitHub-side checks can validate SQL file presence and app build health.

Local Supabase validation is still required and was not run in this environment because no local terminal/Supabase CLI is available here.

Not run locally here:

- `npx supabase status`
- `npx supabase db reset`
- local function existence SQL checks
- local grant checks
- local authenticated direct helper execution denial
- local service_role helper insert tests
- local invalid payload tests
- local rollback/count cleanup validation
- local advisor checks

Because cloud is explicitly forbidden for this task, Supabase cloud was not used as a substitute.

## Expected local validation checklist for reviewer/agent with terminal

Run locally only:

- `npx supabase status`
- `npx supabase db reset`
- confirm both helper functions exist
- confirm PUBLIC/anon/authenticated cannot execute internal helpers
- confirm service_role/trusted context can execute helpers
- confirm direct authenticated table inserts remain blocked
- confirm RLS remains enabled on `audit_events` and `activity_events`
- confirm table grants remain conservative
- confirm valid helper inserts work inside rollback transaction
- confirm invalid payloads are rejected
- confirm final counts for `audit_events` and `activity_events` are zero after rollback/cleanup

## What was intentionally NOT changed

- no Supabase cloud
- no app UI
- no frontend write repository methods
- no timeline integration
- no existing mutation wiring
- no visits/encounters
- no completed services
- no payments
- no stock
- no documents
- no seed/backfill
- no legacy `audit_logs` destructive change

## Checks

Local checks:

- `git status --short`: not run here
- `npm run lint`: not run locally here
- `npm run test -- --run`: not run locally here
- `npm run build`: not run locally here
- local Supabase reset: not run here

GitHub Actions CI:

- pending after PR creation

## Final verdict

PARTIAL

Reason: migration and report are created, but local Supabase replay/RLS/grant/helper execution validation is not available in this environment and must be run by an agent with local terminal/Supabase CLI access.

## Recommended next task

PATIENT-TIMELINE-ACTIVITY-INTEGRATION-001 only after local Supabase validation of this PR passes.

If local validation finds SQL/grant issues, do `AUDIT-ACTIVITY-RPC-001C-FIX` first.
