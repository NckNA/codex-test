# QA-FIXTURES-MULTITENANT-001B role smoke support

## Summary

Implemented local QA fixture script support for role smoke preparation.

The local-only QA seeding script now:

- keeps strict local-only guards;
- reuses existing QA auth users and resets their local QA password to the configured `QA_USER_PASSWORD` without printing it;
- keeps the existing admin, doctor, no-tenant, and multi-tenant fixtures;
- adds a receptionist smoke fixture using the current DB enum value `registrar`;
- adds a cashier smoke fixture using `cashier`.

## Branch

`feature/qa-fixtures-role-smoke-support-001b`

## PR URL

https://github.com/NckNA/codex-test/pull/292

## PR head reviewed before final report update

`a8b5439a9a03ed2200b9d44f710481ce2d1c24b1`

## Report update commit

N/A because the final report update commit cannot reference itself before creation.

## Changed files summary

- `scripts/seed-qa-users.cjs`
- `_ai_work/REPORTS/QA-FIXTURES-MULTITENANT-001B_role_smoke_support.md`

## Root cause

PR #290 role-label browser smoke could not be finalized because the local QA fixture layer was unreliable:

- existing local QA users could exist with an unknown/stale password;
- expected password sign-in could fail with `Invalid login credentials`;
- receptionist/registrar fixture was missing;
- cashier fixture was missing;
- multi-tenant user existed, but active tenant switch browser smoke still needs a tenant switcher UI.

## Script changes

Updated `scripts/seed-qa-users.cjs`:

- added `LOCAL_ONLY_CONFIRMATION` constant for the strict guard;
- kept required `ALLOW_LOCAL_QA_USER_SEED=YES_I_UNDERSTAND_LOCAL_ONLY` guard;
- kept rejection of `NODE_ENV=production`;
- kept local Supabase URL guard requiring `http:` and `localhost`, `127.0.0.1`, or `::1`;
- kept rejection of `.supabase.co` URLs;
- added `SUPPORTED_APP_ROLES` aligned with `app_role` from `0001_initial_schema.sql`;
- added `buildPersonas()` to define fixtures centrally;
- added paged `findAuthUserByEmail()` so existing users can be found beyond the first auth page;
- existing users are reused and password-reset via Admin API using `QA_USER_PASSWORD`;
- new users are created with the configured password;
- password value is never printed;
- service role key is never printed;
- `.env.local` is never printed.

## Role fixture inventory

Expected local fixtures after running the script:

- `qa.admin.a@example.local` => Demo Clinic A / `clinic_admin`
- `qa.doctor.a@example.local` => Demo Clinic A / `doctor`
- `qa.admin.b@example.local` => Demo Clinic B / `clinic_admin`
- `qa.notenant@example.local` => no tenant membership
- `qa.multitenant@example.local` => Demo Clinic A / `clinic_admin` + Demo Clinic B / `doctor`
- `qa.receptionist.a@example.local` => Demo Clinic A / `registrar`
- `qa.cashier.a@example.local` => Demo Clinic A / `cashier`

Enum support:

- current `app_role` enum supports `registrar`;
- current `app_role` enum does not use `receptionist`;
- the fixture keeps the requested email `qa.receptionist.a@example.local` but stores role `registrar`, which maps to the UI label `Регистратор`;
- current `app_role` enum supports `cashier`.

## Local Supabase validation

`npx supabase status`: **PASS** — local development setup is running at `http://127.0.0.1:54321`.

`npx supabase db reset`: not required — local database was already in a valid state with all migrations applied through `0009`.

## Seed command result

Command run (without secrets):

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=<local service role key, not printed>
ALLOW_LOCAL_QA_USER_SEED=YES_I_UNDERSTAND_LOCAL_ONLY
QA_USER_PASSWORD=<local QA password, not printed>
node scripts/seed-qa-users.cjs
```

Result: **PASS**

```
--- QA USER FIXTURE SUMMARY ---
Users created:          2
Users reused:           5
Passwords reset:        5
Profiles upserted:      7
Tenant users inserted:  7

Memberships:
qa.admin.a@example.local          => Demo Clinic A / clinic_admin
qa.doctor.a@example.local         => Demo Clinic A / doctor
qa.admin.b@example.local          => Demo Clinic B / clinic_admin
qa.notenant@example.local         => no tenant
qa.multitenant@example.local      => Demo Clinic A / clinic_admin + Demo Clinic B / doctor
qa.receptionist.a@example.local   => Demo Clinic A / registrar
qa.cashier.a@example.local        => Demo Clinic A / cashier
------------------------------
```

## Auth login validation

All 7 fixtures validated via Supabase Auth REST API (`/auth/v1/token?grant_type=password`). No passwords printed.

| Email | Login result |
|---|---|
| `qa.admin.a@example.local` | **PASS** |
| `qa.doctor.a@example.local` | **PASS** |
| `qa.admin.b@example.local` | **PASS** |
| `qa.notenant@example.local` | **PASS** |
| `qa.multitenant@example.local` | **PASS** |
| `qa.receptionist.a@example.local` | **PASS** |
| `qa.cashier.a@example.local` | **PASS** |

## Membership validation

Memberships validated via direct DB query against `auth.users`, `public.tenant_users`, and `public.tenants`.

| Email | Tenant | Role | Expected | Result |
|---|---|---|---|---|
| `qa.admin.a@example.local` | Demo Clinic A | `clinic_admin` | Demo Clinic A / clinic_admin | **PASS** |
| `qa.doctor.a@example.local` | Demo Clinic A | `doctor` | Demo Clinic A / doctor | **PASS** |
| `qa.admin.b@example.local` | Demo Clinic B | `clinic_admin` | Demo Clinic B / clinic_admin | **PASS** |
| `qa.notenant@example.local` | — | — | no memberships | **PASS** |
| `qa.multitenant@example.local` | Demo Clinic A | `clinic_admin` | Demo Clinic A / clinic_admin | **PASS** |
| `qa.multitenant@example.local` | Demo Clinic B | `doctor` | Demo Clinic B / doctor | **PASS** |
| `qa.receptionist.a@example.local` | Demo Clinic A | `registrar` | Demo Clinic A / registrar | **PASS** |
| `qa.cashier.a@example.local` | Demo Clinic A | `cashier` | Demo Clinic A / cashier | **PASS** |

## What was intentionally NOT changed

- No cloud Supabase access.
- No DB migration.
- No RLS change.
- No `app_role` enum change.
- No PR #290 role-label production code change.
- No package/dependency change.
- No password printed.
- No service role key printed.
- No `.env.local` contents printed.
- No next feature started.

## Checks

- `git status --short`:
  ```
  M _ai_work/REPORTS/QA-FIXTURES-MULTITENANT-001B_role_smoke_support.md
  ```
- `npm run lint`: **PASS** (Zero warnings or errors).
- `npm run test -- --run`: **PASS** (All 279 tests pass with `.env.local` temporarily moved during tests).
- `npm run build`: **PASS** (Project builds cleanly).
- GitHub Actions CI result: **PASS** (Workflow CI, run #437, run id 27577026710, head a8b5439a9a03ed2200b9d44f710481ce2d1c24b1).

## Remaining known limitation

The active tenant switcher UI is still missing, so full multi-tenant browser switch smoke for PR #290 still requires either a tenant switcher task or test-level/context verification.

## Final verdict

**READY FOR REVIEW**

Local Supabase seed completed successfully. All 7 QA fixture users seeded, all 7 auth logins validated, all tenant memberships confirmed correct. All repository checks (lint, test, build) pass.

## Recommended next task

`ROLE-LABEL-UX-001-BROWSER-SMOKE-FINALIZE`
