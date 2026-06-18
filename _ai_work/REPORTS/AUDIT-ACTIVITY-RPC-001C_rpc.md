# AUDIT-ACTIVITY-RPC-001C: controlled audit/activity RPC foundation

## Summary

This PR adds a schema-only SQL helper foundation for trusted transactional audit/activity writes.

It adds internal `SECURITY DEFINER` database helper functions that future domain-specific RPCs can call in the same transaction as sensitive mutations.

The PR does not expose arbitrary raw audit/activity writes to authenticated browser users.

## Branch name

`feature/audit-activity-rpc-001c`

## PR URL

https://github.com/NckNA/codex-test/pull/305

## PR head reviewed before final report update

`4bd54ebf1d5df6aca2ac9c0cecd5c67b59eb15ac`

## Changed files summary

Expected files only:

- `supabase/migrations/0013_create_audit_activity_rpc.sql`
- `_ai_work/REPORTS/AUDIT-ACTIVITY-RPC-001C_rpc.md`

No app code, UI, repository write methods, timeline integration, browser smoke, seed changes, or cloud changes.

## Local Supabase status

Local Supabase was used only against the local Docker stack.

`npx supabase status` result:

- local DB/API stack reachable;
- local DB container: `supabase_db_codex-test-supabase`;
- project URL: `http://127.0.0.1:54321`;
- local database: `127.0.0.1:54322/postgres`;
- warning: Supabase CLI reported stopped optional services: `imgproxy`, `edge_runtime`, and `pooler`;
- no Supabase cloud project was touched.

Local development keys printed by the CLI were treated as secrets and are intentionally not recorded in this report.

## Local migration replay / reset

Command executed:

```bash
npx supabase db reset
```

Result: PASS.

Migration replay applied through:

- `0012_create_audit_activity_log.sql`
- `0013_create_audit_activity_rpc.sql`

Seed completed after migration replay.

## Function existence checks

Validated through local PostgreSQL catalog inspection.

| function | exists |
|---|---:|
| `public.record_audit_event_internal(...)` | yes |
| `public.record_activity_event_internal(...)` | yes |

## Function security shape

Validated from the migration and local catalog.

| function | security | search_path |
|---|---|---|
| `public.record_audit_event_internal(...)` | `SECURITY DEFINER` | `public, pg_temp` |
| `public.record_activity_event_internal(...)` | `SECURITY DEFINER` | `public, pg_temp` |

## Function grants validation

Validated with `has_function_privilege(...)` and function ACL inspection.

| role | `record_audit_event_internal` EXECUTE | `record_activity_event_internal` EXECUTE |
|---|---:|---:|
| `PUBLIC` | no | no |
| `anon` | no | no |
| `authenticated` | no | no |
| `service_role` | yes | yes |

Result: PASS.

## Table grants unchanged

Validated with `has_table_privilege(...)` after local reset.

### `public.audit_events`

| role | SELECT | INSERT | UPDATE | DELETE | TRUNCATE | REFERENCES | TRIGGER |
|---|---:|---:|---:|---:|---:|---:|---:|
| `authenticated` | yes | no | no | no | no | no | no |
| `anon` | no | no | no | no | no | no | no |

### `public.activity_events`

| role | SELECT | INSERT | UPDATE | DELETE | TRUNCATE | REFERENCES | TRIGGER |
|---|---:|---:|---:|---:|---:|---:|---:|
| `authenticated` | yes | no | no | no | no | no | no |
| `anon` | no | no | no | no | no | no | no |

Result: PASS.

## RLS unchanged

Validated from `pg_class.relrowsecurity` after local reset.

| table | RLS enabled |
|---|---:|
| `public.audit_events` | yes |
| `public.activity_events` | yes |

Result: PASS.

## Counts after reset

| table | count |
|---|---:|
| `public.audit_events` | 0 |
| `public.activity_events` | 0 |

Result: PASS.

## Authenticated direct helper execution blocked

Validated with `SET LOCAL ROLE authenticated` inside a transaction.

Attempted direct call:

- `public.record_audit_event_internal(...)`

Expected result:

- `insufficient_privilege`

Observed result:

- blocked

Result: PASS.

## Authenticated direct table INSERT blocked

Validated with `SET LOCAL ROLE authenticated` inside a transaction.

Attempted direct insert:

- `INSERT INTO public.audit_events (...)`

Expected result:

- `insufficient_privilege`

Observed result:

- blocked

Result: PASS.

## Trusted helper insert tests

Validated with `SET LOCAL ROLE service_role` inside a transaction.

| test | result |
|---|---:|
| valid audit helper insert works | PASS |
| valid activity helper insert works | PASS |
| activity helper links `audit_event_id` | PASS |
| test rows are rolled back | PASS |

## RLS simulation

Validated using local transaction fixtures in `auth.users`, `profiles`, `tenants`, and `tenant_users`, all rolled back.

| scenario | result |
|---|---:|
| `anon` cannot select `audit_events` | PASS |
| `anon` cannot select `activity_events` | PASS |
| no-tenant authenticated user sees 0 audit rows | PASS |
| no-tenant authenticated user sees 0 activity rows | PASS |
| cross-tenant user cannot see other tenant audit rows | PASS |
| cross-tenant user cannot see other tenant activity rows | PASS |
| `clinic_owner` can read tenant audit/activity | PASS |
| `clinic_admin` can read tenant audit/activity | PASS |
| `doctor` cannot read raw audit events | PASS |
| `doctor` can read `clinical` and `admin` activity events | PASS |
| `registrar` cannot read raw audit events | PASS |
| `registrar` can read `admin` activity events only | PASS |
| `cashier` cannot read raw audit events | PASS |
| `cashier` can read `financial` and `admin` activity events | PASS |

Result: PASS.

## Invalid payload tests

Validated with trusted helper calls inside a transaction. Each case was expected to raise and did raise.

| invalid payload | result |
|---|---:|
| empty audit `action` | rejected |
| empty audit `target_type` | rejected |
| empty audit `target_id` | rejected |
| invalid audit `category` | rejected |
| invalid activity `category` | rejected |
| invalid audit `severity` | rejected |
| invalid audit `redaction_level` | rejected |
| audit `metadata` array/non-object | rejected |
| activity `metadata` array/non-object | rejected |
| audit `before_data` array/non-object | rejected |

Result: PASS.

## Rollback / final counts

After the transaction rollback, final counts were validated again.

| table | count |
|---|---:|
| `public.audit_events` | 0 |
| `public.activity_events` | 0 |

Result: PASS.

## Local checks

| command | result |
|---|---:|
| `git status --short` before report update | clean |
| `npm run lint` | PASS |
| `npm run test -- --run` | PASS, 45 files / 366 tests |
| `npm run build` | PASS |

Notes:

- Test run emitted existing React `act(...)` warnings and intentional repository error logs from error-handling tests.
- Exit code remained 0.

## GitHub Actions CI after validation report push

Fresh GitHub Actions CI was checked after pushing the local validation report update.

| field | value |
|---|---|
| workflow | `CI` |
| run id | `27749157274` |
| CI number | `523` |
| status | `completed` |
| conclusion | `success` |
| tested commit | `4bd54ebf1d5df6aca2ac9c0cecd5c67b59eb15ac` |
| job | `validate` |
| ESLint | success |
| tests | success |
| build | success |

Final report metadata update requires one additional commit after this CI result is recorded. Fresh CI must also be checked on that final commit.

## Cloud / browser / UI status

- Supabase cloud: not touched.
- Browser smoke: not run.
- UI: not changed.
- Frontend write repository methods: not added.
- Timeline/domain integration: not started.
- Visits/encounters work: not started.

## Final verdict

`AUDIT ACTIVITY RPC FOUNDATION IMPLEMENTED AND VERIFIED`

## Recommended next task

`PATIENT-TIMELINE-ACTIVITY-INTEGRATION-001`
