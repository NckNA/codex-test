# LEGACY-CORE-TABLE-GRANTS-RECOVERY-001 Recovery Report

## Final verdict

**PARTIAL**

PARTIAL: the legacy core grants recovery is implemented and verified, but configured Supabase mode still bootstraps `df_appointments` in localStorage and the pre-existing `0020_patient_finance_summary_test.sql` fixture is incompatible with later refund guards.

## Summary

A single forward migration restores an explicit least-privilege table privilege contract for all 16 legacy core tables created by `0001_initial_schema.sql`.

The clean-deployment blocker is resolved:

- `authenticated` can reach the exact legacy tables and operations used by the current application;
- existing RLS policies remain the row-level authorization boundary;
- `service_role` can perform controlled local QA setup and cleanup;
- `anon` and `PUBLIC` have no protected legacy table privileges;
- unnecessary legacy `TRUNCATE`, `REFERENCES`, and `TRIGGER` grants are removed;
- no policy, role, owner, default privilege, historical migration, application feature, or cloud database was changed.

Real local Supabase browser QA confirmed successful login, tenant membership loading, tenant selection, patient create/update/reload, appointment create/update/status/reload, role access, no-tenant blocking, and patient/doctor/appointment tenant isolation without `42501` or permission errors.

Two acceptance limitations remain outside the permitted implementation scope:

1. `src/main.tsx` still calls `storage.init()` unconditionally, so a fresh configured browser creates demo `df_appointments`, `df_patients`, and `df_doctors` keys. A same-origin probe proved Supabase appointment CRUD does not mutate `df_appointments`, and all real reads/writes used PostgREST, but the literal “browser does not write `df_appointments`” criterion is not met.
2. The pre-existing `0020_patient_finance_summary_test.sql` directly inserts rows into `refunds`; later refund hardening rejects that fixture with `Refund creation requires request_refund`. This task did not rewrite a finance test unrelated to grants.

## Branch

`feature/legacy-core-table-grants-recovery-001`

## PR URL

Pending publication.

## Baseline

- repository: `NckNA/codex-test`;
- base branch: `main`;
- verified `origin/main`: `99a6d41e5061fe291eaf1af9064828d5fdf75e20`;
- PR #345 (`SCHEDULE-OPERATIONS-RECON-001`) was confirmed merged at that exact commit;
- source checkout and task worktree were clean before changes.

## PR head reviewed before final report update

Pending implementation commit and PR publication.

## Report update commit

N/A because the final report update commit cannot reference itself before creation.

- Report update commit: N/A (the report commit cannot reference itself; use the finalization receipt).
- The final report-only metadata commit and its fresh CI run will be recorded in the finalization receipt, PR body, and final task response.

## Changed files

- `supabase/migrations/0024_restore_legacy_core_table_grants.sql`
- `supabase/tests/0024_legacy_core_table_grants_test.sql`
- `_ai_work/REPORTS/LEGACY-CORE-TABLE-GRANTS-RECOVERY-001_recovery.md`

No historical migration, application source, package file, seed file, generated type, or cloud state changed.

## Pre-read

Reviewed before design and validation:

- `_ai_work/REPORTS/SCHEDULE-OPERATIONS-RECON-001_recon.md`
- `_ai_work/SOURCES/02_ROLES_AND_PERMISSIONS.md`
- `_ai_work/SOURCES/03_MULTI_TENANT_ARCHITECTURE_RULES.md`
- `_ai_work/SOURCES/04_DATA_ISOLATION_AND_SECURITY.md`
- `_ai_work/SOURCES/11_BACKEND_AND_API_ARCHITECTURE.md`
- `_ai_work/SOURCES/13_STORAGE_AND_MIGRATION_STRATEGY.md`
- `_ai_work/SOURCES/18_TESTING_AND_QUALITY_ASSURANCE_STRATEGY.md`
- `supabase/migrations/0001_initial_schema.sql`
- every later migration containing relevant `GRANT` or `REVOKE` statements;
- encounter, finance, treatment-plan, refund, deposit, and credit-intake privilege patterns;
- `AuthContext`, `TenantContext`, Supabase client configuration;
- patient, doctor, appointment, complaint, chart, finding, and treatment-plan repositories;
- schedule, patient list/card paths, and local QA fixture scripts.

## Original blocker

A clean reset created RLS policies but left the legacy core tables unreachable to `authenticated` and `service_role`.

Observed before migration `0024`:

- QA seed created an Auth user, then failed while upserting `profiles` with `permission denied for table profiles`;
- browser membership lookup previously failed on `tenant_users`;
- direct authenticated appointment access returned SQLSTATE `42501`;
- `has_table_privilege` returned false for `SELECT`, `INSERT`, `UPDATE`, and `DELETE` on every legacy table for `anon`, `authenticated`, and `service_role`;
- the same roles unexpectedly retained `TRUNCATE`, `REFERENCES`, and `TRIGGER` privileges inherited from the original table ACL state.

RLS policies existed, but the roles could not reach them. Policies without table privileges are excellent documentation and poor software.

## Legacy table inventory

Migration `0001_initial_schema.sql` created 16 legacy tables:

1. `tenants`
2. `profiles`
3. `tenant_users`
4. `subscriptions`
5. `audit_logs`
6. `patients`
7. `doctors`
8. `appointments`
9. `chief_complaints`
10. `dental_charts`
11. `tooth_states`
12. `findings`
13. `treatment_plans`
14. `treatment_stages`
15. `documents`
16. `integration_tokens`

All 16 have RLS enabled. None has forced RLS. `integration_tokens` intentionally has no authenticated policy and remains service-role-only.

All legacy primary keys are UUIDs. Migration `0001` creates no `serial` or identity sequence.

## Original privilege matrix

The clean pre-`0024` effective matrix was identical for all 16 legacy tables:

| Role | SELECT | INSERT | UPDATE | DELETE | REFERENCES | TRIGGER | TRUNCATE |
|---|---:|---:|---:|---:|---:|---:|---:|
| `anon` | no | no | no | no | yes | yes | yes |
| `authenticated` | no | no | no | no | yes | yes | yes |
| `service_role` | no | no | no | no | yes | yes | yes |
| `postgres` | yes | yes | yes | yes | yes | yes | yes |

The first three rows were simultaneously unusable for normal data access and broader than necessary for DDL-adjacent privileges.

## Application need matrix

The final matrix was derived from real repository calls, not from future possibilities.

| Table | Current browser/application need | Decision |
|---|---|---|
| `tenants` | active tenant metadata through nested membership read | authenticated `SELECT` |
| `profiles` | no current direct browser repository; QA setup uses service role | no authenticated grant |
| `tenant_users` | load current user memberships and nested tenants | authenticated `SELECT` |
| `subscriptions` | no current direct browser workflow | no authenticated grant |
| `audit_logs` | legacy table unused; newer audit tables have separate contract | no authenticated grant |
| `patients` | list/get/create/update | authenticated `SELECT, INSERT, UPDATE` |
| `doctors` | current repository is read-only | authenticated `SELECT` |
| `appointments` | current repository performs direct CRUD | authenticated `SELECT, INSERT, UPDATE, DELETE` |
| `chief_complaints` | read/upsert/update | authenticated `SELECT, INSERT, UPDATE` |
| `dental_charts` | read/upsert/update | authenticated `SELECT, INSERT, UPDATE` |
| `tooth_states` | read/upsert/update | authenticated `SELECT, INSERT, UPDATE` |
| `findings` | read/create/update/archive-by-update | authenticated `SELECT, INSERT, UPDATE` |
| `treatment_plans` | direct read/delete; create/update use existing RPC | authenticated `SELECT, DELETE` |
| `treatment_stages` | nested read; mutations occur inside treatment-plan RPC | authenticated `SELECT` |
| `documents` | no current direct Supabase browser repository | no authenticated grant |
| `integration_tokens` | secret-bearing backend data | no authenticated grant |

Patient and doctor hard-delete privileges were not granted merely because existing RLS policies mention delete. The current application does not call those operations.

## Chosen grants design

Migration `0024_restore_legacy_core_table_grants.sql`:

1. explicitly revokes all privileges on the 16 listed tables from `PUBLIC`, `anon`, `authenticated`, and `service_role`;
2. grants only the current authenticated application matrix;
3. grants ordinary CRUD to `service_role` only on the explicit 16-table list;
4. grants no `TRUNCATE`, `REFERENCES`, or `TRIGGER` privilege to client roles;
5. changes no schema ownership, default privileges, policies, roles, functions, or RLS state;
6. contains no row DML and is idempotent under repeated `REVOKE`/`GRANT` execution.

No `GRANT ALL ON ALL TABLES`, schema-wide future-table grant, or default-privilege expansion is present.

## Authenticated grants

Final effective authenticated matrix:

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---:|---:|---:|---:|
| `tenants` | yes | no | no | no |
| `profiles` | no | no | no | no |
| `tenant_users` | yes | no | no | no |
| `subscriptions` | no | no | no | no |
| `audit_logs` | no | no | no | no |
| `patients` | yes | yes | yes | no |
| `doctors` | yes | no | no | no |
| `appointments` | yes | yes | yes | yes |
| `chief_complaints` | yes | yes | yes | no |
| `dental_charts` | yes | yes | yes | no |
| `tooth_states` | yes | yes | yes | no |
| `findings` | yes | yes | yes | no |
| `treatment_plans` | yes | no | no | yes |
| `treatment_stages` | yes | no | no | no |
| `documents` | no | no | no | no |
| `integration_tokens` | no | no | no | no |

Authenticated has no `REFERENCES`, `TRIGGER`, or `TRUNCATE` on any legacy table.

Appointment DELETE remains reachable only to `clinic_owner` and `clinic_admin` because the existing RLS delete policy remains unchanged. The SQL test proved registrar DELETE affects zero rows while admin DELETE succeeds.

## Service-role grants

`service_role` receives exactly:

- `SELECT`
- `INSERT`
- `UPDATE`
- `DELETE`

on the explicit 16 legacy tables.

It receives no legacy `TRUNCATE`, `REFERENCES`, or `TRIGGER` privilege and no schema-wide/default future-table access.

Validation:

- guarded QA seed succeeded after `0024`;
- 7 Auth users were created;
- 7 profiles were upserted;
- 7 tenant memberships were inserted;
- the SQL test created and cleaned tenant/profile/membership/patient/doctor/appointment fixtures under `SET LOCAL ROLE service_role`.

No service-role key or service-role client appears in production frontend source. Non-test source scan returned no `service_role` reference.

## Anonymous/Public revocations

For every legacy table:

- `anon`: no `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, or `TRIGGER`;
- `PUBLIC`: no direct table ACL entry;
- anonymous tenant membership read fails with permission denied;
- anonymous patient read fails with permission denied;
- anonymous appointment insert fails with permission denied.

## Sequence privileges

`information_schema.sequences` reports zero sequences in schema `public` after clean reset.

All legacy IDs use UUID defaults such as `gen_random_uuid()`. No sequence privilege was added.

## Function privileges

Existing helper grants remain unchanged:

- `public.get_user_tenants()`:
  - `authenticated`: EXECUTE yes;
  - `service_role`: EXECUTE yes;
  - `anon`: no;
  - `PUBLIC`: no.
- `public.has_tenant_role(uuid, app_role[])`:
  - `authenticated`: EXECUTE yes;
  - `service_role`: EXECUTE yes;
  - `anon`: no;
  - `PUBLIC`: no.

Both remain `SECURITY DEFINER` with `search_path=public`, as previously hardened by migration `0008`.

No new function and no new SECURITY DEFINER bypass was added.

## RLS preservation

After migration `0024`:

- RLS is enabled on all 16 legacy tables;
- RLS is not disabled or bypassed for authenticated users;
- policy counts match the pre-migration inventory exactly:
  - tenants 1;
  - profiles 2;
  - tenant_users 1;
  - subscriptions 1;
  - audit_logs 2;
  - patients/doctors/appointments/chief_complaints/dental_charts/tooth_states/findings/treatment_plans/treatment_stages/documents: 4 each;
  - integration_tokens: 0.

No policy text was modified.

## Same-tenant relationship integrity

The existing composite foreign keys remain authoritative:

- appointment `(tenant_id, patient_id)` must reference patient `(tenant_id, id)`;
- appointment `(tenant_id, doctor_id)` must reference doctor `(tenant_id, id)`.

SQL results:

- same-tenant appointment create/update succeeded;
- cross-tenant patient reference on INSERT was rejected;
- cross-tenant doctor reference on INSERT was rejected;
- cross-tenant patient reference on UPDATE was rejected;
- cross-tenant doctor reference on UPDATE was rejected.

Privilege recovery did not mask or bypass relationship errors.

## Clean-reset validation

Exact command executed repeatedly:

```text
npx supabase db reset --no-seed
```

Result:

- migrations `0001` through `0024` applied successfully;
- no historical migration was edited;
- the final reset completed cleanly;
- final zero-row counters after all browser QA:
  - auth users: 0;
  - tenants: 0;
  - profiles: 0;
  - tenant users: 0;
  - patients: 0;
  - doctors: 0;
  - appointments: 0;
  - audit events: 0;
  - activity events: 0.

The Hermes reset wrapper was not accepted as final evidence because it included the repository demo seed despite `seedQaUsers=false`; the exact CLI `--no-seed` command was used for authoritative cleanup.

## SQL privilege tests

Created:

`supabase/tests/0024_legacy_core_table_grants_test.sql`

The test is seed-independent and transaction-scoped. It validates:

- exact authenticated matrix for all 16 legacy tables;
- no authenticated `TRUNCATE`, `REFERENCES`, or `TRIGGER`;
- no anon protected table privilege;
- no PUBLIC ACL leak;
- exact service-role CRUD and no extra DDL-adjacent privilege;
- RLS enabled and policy counts unchanged;
- zero public sequences;
- helper function grants;
- encounter and finance table privilege patterns unchanged;
- own-tenant membership/tenant/patient/doctor/appointment reads;
- patient create/update;
- doctor direct writes denied under the chosen current-need matrix;
- appointment create/update/delete behavior under current RLS;
- doctor/cashier broad appointment policy behavior documented;
- no-membership user isolation;
- anonymous denial;
- service-role setup and cleanup;
- cross-tenant patient/doctor relationship rejection;
- unknown role rejection at the enum boundary.

Final result after authoritative clean reset:

`LEGACY-CORE-TABLE-GRANTS-RECOVERY-001 SQL validation passed`

## Cross-tenant tests

SQL:

- tenant A could not read tenant B tenant metadata, patients, doctors, or appointments;
- tenant A could not insert a patient into tenant B;
- tenant A update against tenant B patient affected no row;
- tenant A could not create a tenant B appointment;
- cross-tenant patient/doctor links were rejected by composite foreign keys;
- no-membership user received zero tenant data;
- unknown role was rejected by `app_role` enum;
- anonymous protected reads/writes were denied.

Real browser:

- admin A saw tenant A patient/doctor/appointment markers and not tenant B markers;
- admin B saw tenant B patient/doctor/appointment markers and not tenant A markers;
- appointments A and B were placed on the same date/time to prove browser result separation rather than date filtering;
- no cross-tenant marker appeared in the opposite clinic.

## Service-role QA setup

Before migration:

- QA seed failed at profile upsert with `permission denied for table profiles`.

After migration:

- the same guarded seed script completed;
- 7 users, 7 profiles, and 7 memberships were created;
- service-role tenant/profile/membership/patient/doctor/appointment create and cleanup were also asserted inside the new SQL test;
- service-role credentials were injected only by local tools and never written to committed files or browser code.

## Real browser Supabase smoke

Environment:

- clean local Supabase;
- Vite configured with local `VITE_SUPABASE_URL` and anon key;
- QA shortcut using normal local Supabase Auth;
- prototype mode false;
- correct worktree and baseline verified before browser use.

Authentication and membership:

- login succeeded;
- `tenant_users` loaded successfully;
- active tenant selected;
- no clinic permission error appeared.

Patients:

- patient list loaded from Supabase;
- tenant A marker visible and tenant B marker hidden;
- patient created in UI;
- reload preserved it;
- patient edited in UI;
- second reload showed edited name and notes;
- PostgreSQL row matched the UI changes.

Doctors:

- tenant-scoped doctor data loaded in schedule;
- tenant A and tenant B saw only their own doctor markers;
- current product has no real doctor create UI, so controlled QA doctors were created by local fixture setup.

Appointments:

- real `SchedulePage` opened;
- appointment created through a free slot;
- reload preserved it;
- comment and status changed to `confirmed`;
- second reload preserved the update;
- PostgreSQL row matched patient, doctor, status, comment, and times;
- a second storage-probe appointment also persisted in PostgreSQL.

Roles:

- clinic admin, doctor, registrar, and cashier reached the current schedule according to existing broad RLS policies;
- registrar reached patient data within tenant A;
- no-tenant user saw `Клиника не назначена` and no clinic markers;
- overly broad appointment create/update policies for doctor and cashier were proven in SQL and intentionally not redesigned.

Browser runs reported:

- no console errors;
- no failed requests;
- no raw SQL details;
- no visible secrets;
- no `42501` or permission-denied message.

## Network validation

Kong/PostgREST evidence from the real browser run:

- `GET tenant_users`: 200;
- `GET patients`: 200;
- `GET doctors`: 200;
- `GET appointments`: 200;
- patient POST: 201;
- patient PATCH: 204;
- appointment POST: 201;
- appointment PATCH: 204;
- protected-resource 403 count during captured browser traffic: 0;
- server-error count: 0.

The log also captured tenant-scoped A/B query parameters and separate response sizes. Production frontend source contains no service-role client or key reference.

## No-localStorage validation

Positive evidence that Supabase is the operational source of truth:

- patient create/update and appointment create/update generated PostgREST writes;
- browser reloads re-read rows from PostgREST;
- PostgreSQL contained the exact UI-created and UI-edited rows;
- tenant isolation matched PostgreSQL RLS;
- no fallback error screen appeared;
- a same-origin probe recorded `df_appointments` before and after a Supabase appointment create and found `changed_since_before=false`.

Literal acceptance limitation:

- a fresh configured browser still had `df_appointments_present=true`;
- `df_patients_present=true` and `df_doctors_present=true` were also observed;
- source inspection shows this comes from unconditional `storage.init()` in `main.tsx`, which seeds demo keys before repository selection.

Therefore Supabase CRUD did not use or mutate `df_appointments`, but this task cannot claim that configured mode never writes the key. Removing that bootstrap behavior is localStorage consolidation/application code work explicitly forbidden here.

## Side-effect validation

Migration `0024` contains ACL statements and comments only. It contains no table row INSERT, UPDATE, DELETE, trigger, policy, role, ownership, or function changes.

Validation showed:

- appointment status model unchanged;
- no appointment conflict behavior added;
- no patient balance mutation by the migration;
- no finance/clinical/document/storage row mutation by the migration;
- SQL fixtures were transaction-rolled back or explicitly cleaned;
- browser fixtures were removed by final `db reset --no-seed`;
- final protected table counters are zero.

Finance and clinical rows observed during concurrency validation were test fixtures from their own scripts, not migration side effects, and were removed by final reset.

## Compatibility regressions

SQL tests passed:

- `0018_refund_writeoff_rpc_test.sql`
- `0019_cashier_payment_hardening_test.sql`
- `0021_completed_service_billing_guard_test.sql`
- `0022_patient_credit_deposits_foundation_test.sql`
- `0023_patient_credit_intake_hardening_test.sql`
- `0024_legacy_core_table_grants_test.sql`

Concurrency tests passed:

- refund/write-off capacity and idempotency;
- cashier identical retry and competing operation;
- completed-service billing race;
- deposit reservation/refund/allocation/release/consume/idempotency/transition races;
- patient-credit intake identical/conflicting/different-key races.

Pre-existing incompatible test:

- `0020_patient_finance_summary_test.sql` failed before summary assertions because it directly inserts completed/pending/approved refund rows;
- current refund guard raises `Refund creation requires request_refund`;
- migration `0024` does not touch refunds, refund triggers, finance RPCs, or finance privileges;
- no finance test or production code was modified to hide this unrelated stale fixture.

Application regressions:

- ESLint passed;
- 80 test files passed;
- 864 tests passed;
- production build passed;
- existing React `act(...)` test warnings and Vite bundle-size warning remain unrelated.

## Cleanup

Removed after QA:

- all QA Auth users and memberships through final reset;
- tenant, patient, doctor, and appointment fixtures;
- temporary storage probe HTML;
- temporary setup scripts;
- screenshots;
- Vite logs;
- browser QA Vite processes.

Final exact reset:

`npx supabase db reset --no-seed`

Final counts:

`0|0|0|0|0|0|0|0|0`

for Auth users, tenants, profiles, tenant users, patients, doctors, appointments, audit events, and activity events.

No temporary file is part of the intended Git diff.

## Lint/test/build

- `npm run lint`: passed;
- `npm run test -- --run`: passed;
- test files: 80 passed;
- tests: 864 passed;
- `npm run build`: passed.

## Fresh CI

Pending PR publication and fresh GitHub Actions run on the final PR head.

Required final verification:

- CI tested exact final PR head;
- ESLint passed;
- tests passed;
- build passed;
- PR remains open and unmerged.

## Known limitations

1. Configured Supabase mode still seeds demo localStorage keys through unconditional `storage.init()`; Supabase CRUD leaves `df_appointments` unchanged, but the key exists.
2. `0020_patient_finance_summary_test.sql` is stale relative to later refund guards and fails on direct refund fixture insertion.
3. Existing role policies are broader than the intended future permission model; doctor and cashier can currently create/update appointments under RLS.
4. Cloud privilege/schema drift was not inspected or applied because cloud work is forbidden.
5. RLS is enabled but not forced, consistent with the existing schema and Supabase service-role architecture.

## What was intentionally not fixed

- no appointment conflict constraint or RPC;
- no idempotency or retry changes for appointments;
- no appointment lifecycle, cancellation, reschedule, or audit redesign;
- no schedule UI or sidebar changes;
- no doctor CRUD UI;
- no role-policy redesign;
- no localStorage adapter/bootstrap consolidation;
- no finance/refund test rewrite;
- no treatment-plan implementation change;
- no reminders, waitlist, public booking, or HEP-V2;
- no cloud migration apply;
- no PR merge.

## Recommended next task

`APPOINTMENT-CONFLICT-HARDENING-001`

Once the clean Supabase application path works, appointment creation and rescheduling can move behind an authoritative transactional boundary that prevents simultaneous double booking, invalid intervals, and duplicate retries.

The localStorage bootstrap issue and stale finance-summary fixture should be tracked separately rather than smuggled into schedule conflict work, a tradition software projects would benefit from abandoning.
