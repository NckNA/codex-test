# QA-FIXTURES-MULTITENANT-001B role smoke support

## Summary

Implemented local QA fixture script support for role-smoke preparation.

The local-only QA seeding script now:

- keeps strict local-only guards;
- reuses existing QA auth users and resets their local QA credential from local configuration;
- keeps the existing admin, doctor, no-tenant, and multi-tenant fixtures;
- adds a receptionist smoke fixture using the current DB enum value `registrar`;
- adds a cashier smoke fixture using `cashier`.

## Branch

`feature/qa-fixtures-role-smoke-support-001b`

## PR URL

https://github.com/NckNA/codex-test/pull/292

## PR head reviewed before final report update

`a8b5439a9a03ed2200b9d44f710481ce2d1c24b1`

## Changed files summary

- `scripts/seed-qa-users.cjs`
- `_ai_work/REPORTS/QA-FIXTURES-MULTITENANT-001B_role_smoke_support.md`

## Root cause

PR #290 role-label browser smoke could not be finalized because the local QA fixture layer was unreliable:

- existing local QA users could exist with unknown or stale local credentials;
- expected local sign-in could fail with `Invalid login credentials`;
- receptionist/registrar fixture was missing;
- cashier fixture was missing;
- multi-tenant user existed, but active tenant switch browser smoke still needs a tenant switcher UI.

## Script changes

Updated `scripts/seed-qa-users.cjs`:

- kept strict local-only execution guards;
- added paged lookup for existing auth users;
- existing users are reused and updated through the local Admin API;
- new users are created from local configuration;
- receptionist smoke fixture uses `registrar` because that is the current enum value;
- cashier smoke fixture uses `cashier`;
- no local credential values are stored in this report.

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

- Local Supabase status: **PASS**.
- Database reset was not required because the local database was already in a valid state with migrations applied through `0009`.
- QA fixture seed command: **PASS**.
- Users created: 2.
- Users reused: 5.
- Existing users updated: 5.
- Profiles upserted: 7.
- Tenant users inserted: 7.

## Auth login validation

All 7 fixtures authenticated successfully using the configured local QA password.

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

Memberships validated via local DB query against auth users, tenant memberships, and tenants.

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
- No local credential value stored in this report.
- No next feature started.

## Checks

- `git status --short`: only the report file was modified during final report update.
- `npm run lint`: **PASS**.
- `npm run test -- --run`: **PASS**.
- `npm run build`: **PASS**.
- GitHub Actions CI result: **PASS** (Workflow CI, run #437, run id 27577026710, head `a8b5439a9a03ed2200b9d44f710481ce2d1c24b1`).

## Remaining known limitation

The active tenant switcher UI is still missing, so full multi-tenant browser switch smoke for PR #290 still requires either a tenant switcher task or test-level/context verification.

## Final verdict

**READY FOR REVIEW**

Local Supabase seed completed successfully. All 7 QA fixture users seeded, all 7 auth logins validated, all tenant memberships confirmed correct. All repository checks pass.

## Recommended next task

`ROLE-LABEL-UX-001-BROWSER-SMOKE-FINALIZE`
