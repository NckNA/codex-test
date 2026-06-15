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

`f6c66edded8ddcf7b6809296704d38fa16063a79`

## Report update commit

N/A because the final report update commit cannot reference itself before creation.

## Changed files summary

Expected changed files:

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

## Local validation

Not completed in this run.

Blocked checks:

- `npx supabase status` was not executed;
- `npx supabase db reset` was not executed;
- local QA seed command was not executed;
- local Auth sign-in validation was not executed.

Reason: this run has repository and GitHub Actions access, but no executable local Supabase shell/Terminal Bridge invocation available for running `npx` commands against the developer machine.

The script changes are still limited to local-only behavior and will refuse non-local Supabase URLs.

## Auth login validation

Not completed in this run for the same local shell/browser limitation.

Expected fixtures to validate locally after seeding:

- `qa.admin.a@example.local`
- `qa.doctor.a@example.local`
- `qa.notenant@example.local`
- `qa.multitenant@example.local`
- `qa.receptionist.a@example.local`
- `qa.cashier.a@example.local`

No password is printed in this report.

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

Local checks not completed in this run:

- `git status --short`: not executed locally;
- `npm run lint`: not executed locally;
- `npm run test -- --run`: not executed locally;
- `npm run build`: not executed locally.

GitHub Actions CI on reviewed head:

- run id: `27576949205`;
- workflow: `CI #436`;
- tested commit: `f6c66edded8ddcf7b6809296704d38fa16063a79`;
- ESLint: success;
- tests: success;
- build: success.

Final report update commit triggers a new CI run after this metadata-only change.

## Remaining known limitation

The active tenant switcher UI is still missing, so full multi-tenant browser switch smoke for PR #290 still requires either a tenant switcher task or test-level/context verification.

## Final verdict

PARTIAL

Reason: implementation is present and GitHub Actions passed on the reviewed head, but local Supabase seed/login validation and local checks are not completed in this run.

## Recommended next task

`ROLE-LABEL-UX-001-BROWSER-SMOKE-FINALIZE`
