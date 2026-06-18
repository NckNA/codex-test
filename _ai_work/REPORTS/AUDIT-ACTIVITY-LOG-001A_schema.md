# AUDIT-ACTIVITY-LOG-001A Schema Report

## Summary

This PR adds the schema-only audit/activity log foundation for DentalFlow CRM and the follow-up grants fix from `AUDIT-ACTIVITY-LOG-001A-GRANTS-FIX`.

It introduces two new tables:

- `public.audit_events`: append-only compliance/security audit log.
- `public.activity_events`: safe product-facing activity projection for future patient timeline and admin activity feeds.

The existing `public.audit_logs` table remains present and was not removed, renamed, backfilled, or destructively changed.

Local Supabase reset, schema validation, grants validation, and RLS simulation were performed after the grants fix. The previous blocker is fixed: `authenticated` now has `SELECT` only on `audit_events` and `activity_events`; it no longer has `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, or `TRIGGER`.

## Branch name

`feature/audit-activity-log-001a`

## PR URL

https://github.com/NckNA/codex-test/pull/303

## PR head reviewed before final report update

`c6882e49ec5bf8feb904d8a6b2b5bdf91c570820`

This is the local grants-fix commit created before this final report update.

## Report update commit

N/A because the final report update commit cannot reference itself before creation.

## Changed files summary

Expected PR files remain:

1. `supabase/migrations/0012_create_audit_activity_log.sql`
2. `_ai_work/REPORTS/AUDIT-ACTIVITY-LOG-001A_schema.md`

This grants-fix update changes:

1. `supabase/migrations/0012_create_audit_activity_log.sql`
2. `_ai_work/REPORTS/AUDIT-ACTIVITY-LOG-001A_schema.md`

No app code, UI, repositories, generated types, seed data, browser smoke, or Supabase cloud changes were added.

## Migration patch summary

Migration file:

`supabase/migrations/0012_create_audit_activity_log.sql`

Patch applied inside the existing unmerged migration, not as a new `0013` migration.

The grants block now explicitly revokes all non-read table privileges from `authenticated` on both new tables while keeping RLS-controlled `SELECT`:

```sql
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.audit_events FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.activity_events FROM authenticated;
GRANT SELECT ON TABLE public.audit_events TO authenticated;
GRANT SELECT ON TABLE public.activity_events TO authenticated;
```

The migration still keeps:

- tables;
- constraints;
- indexes;
- comments;
- RLS policies;
- the legacy `public.audit_logs` table untouched.

## Local Supabase status

Command run:

```bash
npx supabase status
```

Result: **PASS**

Observed local services:

- local Supabase was running;
- Project URL: `http://127.0.0.1:54321`;
- local database target: `127.0.0.1:54322/postgres`;
- Studio was available at `http://127.0.0.1:54323`.

Supabase CLI printed local development key material in stdout. Those values were not copied into this report.

Supabase cloud project `cwkgxgubvdkkjcslvdgn` was not touched.

## Local migration replay/reset

Command run:

```bash
npx supabase db reset
```

Result: **PASS**

The reset replayed migrations `0001` through `0012_create_audit_activity_log.sql` and completed successfully.

No cloud project was touched.

## Table existence and RLS enabled results

Post-reset SQL validation:

| table | exists | RLS enabled | force RLS |
|---|---:|---:|---:|
| `public.activity_events` | yes | yes | no |
| `public.audit_events` | yes | yes | no |
| `public.audit_logs` | yes | yes | no |

`public.audit_logs` remains present and RLS-enabled. It was not destructively changed.

## Counts after reset

Post-reset counts before RLS simulation:

| table | rows |
|---|---:|
| `public.audit_events` | 0 |
| `public.activity_events` | 0 |

Counts after the RLS simulation transaction rollback:

| table | rows |
|---|---:|
| `public.audit_events` | 0 |
| `public.activity_events` | 0 |

## Constraints validation

Result: **PASS**

Detected constraint counts:

| table | constraints |
|---|---:|
| `public.audit_events` | 14 |
| `public.activity_events` | 13 |

Validation confirmed primary keys, foreign keys, enum-like check constraints, non-empty checks, and JSON object checks are present.

## Indexes validation

Result: **PASS**

Detected index counts:

| table | indexes |
|---|---:|
| `public.audit_events` | 8 |
| `public.activity_events` | 8 |

## Comments validation

Result: **PASS**

Detected table/column comments for the new audit/activity schema: `12`.

## Policies validation

Result: **PASS**

Detected policies:

| table | policy | command | roles |
|---|---|---|---|
| `public.audit_events` | `Clinic admins can read tenant audit events` | SELECT | `{authenticated}` |
| `public.activity_events` | `Clinic members can read allowed activity events` | SELECT | `{authenticated}` |

No mutation policies were added.

## Final grants validation

Result: **PASS**

### `authenticated`

Expected final state: `SELECT` only, controlled by RLS.

| table | SELECT | INSERT | UPDATE | DELETE | TRUNCATE | REFERENCES | TRIGGER |
|---|---:|---:|---:|---:|---:|---:|---:|
| `public.audit_events` | yes | no | no | no | no | no | no |
| `public.activity_events` | yes | no | no | no | no | no | no |

### `anon`

Expected final state: no table access.

| table | SELECT | INSERT | UPDATE | DELETE | TRUNCATE | REFERENCES | TRIGGER |
|---|---:|---:|---:|---:|---:|---:|---:|
| `public.audit_events` | no | no | no | no | no | no | no |
| `public.activity_events` | no | no | no | no | no | no | no |

Direct anon select probes returned `permission denied` for both `audit_events` and `activity_events`.

### `service_role`

Expected final state: privileged backend role keeps broad access as normal.

Validation focus remained on ensuring `anon` has no access and `authenticated` has only RLS-controlled `SELECT`. The migration does not revoke service-role access.

## RLS simulation results

Result: **PASS**

The simulation inserted local-only fixture users, tenant memberships, patients, audit events, and activity events inside a transaction, then rolled it back.

Observed results:

| simulated role/user | raw `audit_events` result | `activity_events` result |
|---|---:|---|
| `anon` | permission denied | permission denied |
| no-tenant authenticated user | 0 | 0 |
| cross-tenant clinic admin for Clinic B | 1 Clinic B audit row only | `admin` Clinic B activity only |
| Clinic A `clinic_owner` | 1 Clinic A audit row | `admin`, `clinical`, `financial` |
| Clinic A `clinic_admin` | 1 Clinic A audit row | `admin`, `clinical`, `financial` |
| Clinic A `doctor` | 0 raw audit rows | `admin`, `clinical` |
| Clinic A `registrar` | 0 raw audit rows | `admin` only |
| Clinic A `cashier` | 0 raw audit rows | `admin`, `financial` |

Post-rollback counts remained zero for both new tables.

## Local checks

Commands run:

```bash
git status --short
npm run lint
npm run test -- --run
npm run build
```

Results:

| check | result |
|---|---|
| `git status --short` before report update | only migration file modified |
| `npm run lint` | PASS |
| `npm run test -- --run` | PASS, 44 files / 354 tests |
| `npm run build` | PASS |

Notes:

- Vitest emitted existing `act(...)` warnings, but all tests passed.
- Vite emitted the existing large chunk warning, but build passed.

## GitHub Actions CI

Fresh GitHub Actions CI must be checked after this report update is pushed.

The final PR body and final handoff should record:

- workflow run id;
- CI number;
- success/failure;
- tested commit.

## What was intentionally NOT changed

- No Supabase cloud access.
- No new migration `0013`.
- No app code.
- No UI.
- No repository/RPC implementation.
- No browser smoke.
- No seed changes.
- No `.env.local` commit.
- No secrets, passwords, or service-role key stored in this report.
- No `AUDIT-ACTIVITY-REPOSITORY-001B` work started.

## Final verdict

`AUDIT ACTIVITY SCHEMA IMPLEMENTED AND VERIFIED`

## Recommended next task

`AUDIT-ACTIVITY-REPOSITORY-001B`
