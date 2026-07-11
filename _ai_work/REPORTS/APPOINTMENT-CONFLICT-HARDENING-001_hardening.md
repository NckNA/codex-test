# APPOINTMENT-CONFLICT-HARDENING-001: authoritative appointment conflict protection

## Final verdict

APPOINTMENT CONFLICT HARDENING IMPLEMENTED AND VERIFIED

## Summary

Appointment creation and protected appointment mutation now cross transactional PostgreSQL RPCs. The database serializes tenant-scoped doctor and patient resources with deterministic advisory locks, uses half-open overlap checks, rejects invalid intervals and changed-payload retries, preserves one logical appointment per operation key, and provides operation recovery after an uncertain response.

Configured Supabase mode no longer performs direct appointment INSERT or protected UPDATE from the frontend. The legacy grants matrix remains intact for compatibility with `0024`, while a database trigger rejects ordinary authenticated INSERT/UPDATE. Current hard delete remains under the existing owner/admin RLS policy, as required by scope.

## Branch

`feature/appointment-conflict-hardening-001`

## PR URL

Pending publication.

## Baseline

- repository: `NckNA/codex-test`;
- required baseline: `8dfa46d27a7e192a3c949c7515bb94fb72345dee`;
- verified `origin/main`: `8dfa46d27a7e192a3c949c7515bb94fb72345dee`;
- PR #346 was merged into that exact commit;
- worktree was created cleanly from current `main`/`origin/main`.

## PR head reviewed before final report update

Pending implementation commit, PR publication, and fresh CI.

## Report update commit

N/A because the final report commit cannot reference itself.

## Changed files

- `supabase/migrations/0025_harden_appointment_conflicts.sql`
- `supabase/tests/0025_appointment_conflict_hardening_test.sql`
- `supabase/tests/0025_appointment_conflict_concurrency.ps1`
- `supabase/tests/0024_legacy_core_table_grants_test.sql`
- `supabase/tests/0021_completed_service_billing_guard_test.sql`
- `supabase/tests/0022_patient_credit_deposits_foundation_test.sql`
- `src/data/repositories/AppointmentRepository.ts`
- `src/data/repositories/AppointmentRepository.test.ts`
- `src/data/hooks/useScheduleAppointments.ts`
- `src/data/hooks/useScheduleAppointments.test.tsx`
- `src/components/schedule/AppointmentModal.tsx`
- `src/components/schedule/AppointmentModal.test.tsx`
- `src/pages/SchedulePage.tsx`
- `src/types/index.ts`
- `_ai_work/REPORTS/APPOINTMENT-CONFLICT-HARDENING-001_hardening.md`

No historical migration, generated type, package, lock file, finance implementation, clinical implementation, reminder, waitlist, room/chair, confirmation workflow, or cloud state changed.

The three older SQL tests changed only to align fixtures/expectations with the new appointment boundary:

- `0021`: adds a tenant-valid doctor to its appointment side-effect fixture;
- `0022`: adds a tenant-valid doctor to its two appointment fixtures;
- `0024`: preserves the grants matrix but validates RPC writes and direct-write denial instead of the superseded direct CRUD contract.

## Pre-read

Reviewed before implementation:

- `_ai_work/REPORTS/SCHEDULE-OPERATIONS-RECON-001_recon.md`
- `_ai_work/REPORTS/LEGACY-CORE-TABLE-GRANTS-RECOVERY-001_recovery.md`
- `_ai_work/SOURCES/02_ROLES_AND_PERMISSIONS.md`
- `_ai_work/SOURCES/03_MULTI_TENANT_ARCHITECTURE_RULES.md`
- `_ai_work/SOURCES/04_DATA_ISOLATION_AND_SECURITY.md`
- `_ai_work/SOURCES/05_MEDICAL_DOMAIN_MODEL.md`
- `_ai_work/SOURCES/08_APPOINTMENTS_AND_SCHEDULE.md`
- `_ai_work/SOURCES/11_BACKEND_AND_API_ARCHITECTURE.md`
- `_ai_work/SOURCES/18_TESTING_AND_QUALITY_ASSURANCE_STRATEGY.md`
- migrations `0001` through `0024`, with appointment, audit, activity, encounter, finance, and grants sections;
- SchedulePage, AppointmentModal, AppointmentRepository, schedule hooks/context, role helpers, appointment types, and existing tests.

## Previous write contract

Before this task:

- `SupabaseAppointmentRepository.createAppointment` performed direct `POST /rest/v1/appointments` through `.insert(...)`;
- `updateAppointment` performed a full direct `.update(...)` and could change patient, doctor, start, end, status, and details together;
- reschedule was not a dedicated operation;
- modal quick validation checked doctor and text cabinet only;
- patient overlap was not checked;
- edit excluded its own appointment in the modal check;
- modal submit was not disabled and rapid duplicate submit could send multiple writes;
- hook exposed an internal saving state but SchedulePage/modal did not consume it;
- no operation key, replay identity, recovery read, or optimistic version check existed;
- the database accepted concurrent conflicting writes.

After this task, the only direct appointment table calls in the production repository are tenant-scoped SELECT and the existing DELETE. Create, reschedule, details/status update, and recovery use RPCs.

## Active-slot policy

The shared database rule is:

- `cancelled`: does not block and releases doctor/patient slots;
- `new`, `confirmed`, `arrived`, `in_progress`, `completed`, `no_show`, `blocked`: block slots.

This preserves the current product semantics: only cancellation made an appointment non-conflicting in the prior client check. `completed` and `no_show` remain historical schedule facts occupying their original interval. `blocked` remains a doctor-only schedule block and may have no patient.

## Interval semantics

All overlap checks use half-open intervals:

```text
existing.start_time < proposed.end_time
AND existing.end_time > proposed.start_time
```

Therefore:

- exact overlap: rejected;
- partial overlap: rejected;
- contained interval: rejected;
- surrounding interval: rejected;
- back-to-back intervals: allowed;
- zero and negative duration: rejected;
- overnight intervals remain valid when `end_time > start_time`;
- comparison is performed on `timestamptz` values.

Migration `0025` adds `appointments_valid_interval_check` with `end_time > start_time`.

## Historical-data precheck

Before adding constraints/indexes, migration `0025` fails clearly if existing rows contain:

- invalid intervals;
- missing doctor;
- missing patient on a non-`blocked` appointment;
- missing/cross-tenant patient references;
- missing/cross-tenant doctor references;
- duplicate active logical groups;
- active doctor overlap pairs;
- active patient overlap pairs.

The migration never deletes, rewrites, cancels, or archives historical appointments.

## Chosen enforcement design

Chosen design: transactional `SECURITY DEFINER` RPCs with deterministic advisory locking and explicit overlap queries.

Why:

- it supports both doctor and patient resources;
- it supports one ignored status (`cancelled`) without duplicating complicated exclusion predicates;
- create/reschedule/recovery/idempotency can share one transaction boundary;
- safe domain errors can be returned deliberately;
- it does not require a new slot/resource model;
- current PostgreSQL/Supabase extensions already provide advisory locks and `pgcrypto` digest.

PostgreSQL exclusion constraints were not chosen because two resource dimensions, replay/recovery semantics, current status behavior, and safe error mapping would still require a substantial RPC boundary. A slot serialization table was larger than the represented domain.

## Lock strategy

Create acquires locks in this order:

1. tenant + operation key;
2. sorted tenant + doctor and tenant + patient resource keys.

Reschedule acquires:

1. tenant + operation key;
2. target appointment row `FOR UPDATE`;
3. sorted distinct old doctor, old patient, new doctor, and new patient resource keys.

All resource keys are tenant-scoped and hashed with `hashtextextended`. Locks are held through overlap validation, mutation, audit/activity creation, and operation recording. The concurrency suite observed zero deadlocks.

## Idempotency design

`public.appointment_operations` stores:

- tenant ID;
- operation key;
- operation type (`create` or `reschedule`);
- SHA-256 fingerprint;
- appointment ID when still present;
- patient/doctor/start/end/status;
- safe appointment result snapshot;
- actor and timestamp.

Uniqueness is `tenant_id + operation_key`.

Create fingerprint includes all business-significant fields:

- tenant, patient, doctor;
- cabinet, service, status;
- payment type, source, price, comment;
- start and end epoch values.

Reschedule additionally includes appointment ID and expected version.

Rules verified:

- same tenant + same key + same payload returns the same result with `replayed=true`;
- no duplicate row/event is produced;
- same key + changed patient/doctor/time/details is rejected;
- same key in another tenant is independent;
- malformed keys are rejected;
- concurrent same-key calls resolve to one appointment;
- hard delete sets operation `appointment_id` to null but preserves the result snapshot and key, preventing key reuse/amnesia.

## Create RPC

Signature:

```sql
public.create_appointment(
  p_tenant_id uuid,
  p_patient_id uuid,
  p_doctor_id uuid,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_cabinet text,
  p_service text,
  p_status text,
  p_payment_type text,
  p_source text,
  p_price numeric,
  p_comment text,
  p_operation_key text
) returns jsonb
```

It authenticates, validates tenant membership/current role policy, validates tenant patient/doctor ownership, interval and enum values, normalizes strings/key, resolves replay, locks resources, checks doctor and patient conflicts, inserts one appointment, emits one success audit/activity pair, records operation identity, and returns appointment plus replay/recovery metadata.

## Reschedule RPC

Signature:

```sql
public.reschedule_appointment(
  p_tenant_id uuid,
  p_appointment_id uuid,
  p_patient_id uuid,
  p_doctor_id uuid,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_cabinet text,
  p_service text,
  p_status text,
  p_payment_type text,
  p_source text,
  p_price numeric,
  p_comment text,
  p_expected_updated_at timestamptz,
  p_operation_key text
) returns jsonb
```

It locks the target row, verifies tenant and optimistic `updated_at`, locks old/new resources in deterministic order, excludes the target appointment from overlap checks, updates protected and detail fields atomically, emits one reschedule event pair, and records replay identity.

## Recovery RPC

Signature:

```sql
public.get_appointment_operation(
  p_tenant_id uuid,
  p_operation_key text
) returns jsonb
```

It returns safe found/type/appointment/replay/recovered data. Fingerprints, lock keys, SQLSTATE, function names, and raw database objects are not returned. Cross-tenant recovery is denied.

## Non-time update handling

`public.update_appointment_details(...)` controls:

- cabinet;
- service;
- status;
- payment type;
- source;
- price;
- comment.

It accepts `p_expected_updated_at` and cannot change patient, doctor, start, or end. Status reactivation from `cancelled` obtains the same doctor/patient resource locks and rechecks overlap before making the row active.

## Direct-write protection

Migration `0024` established an explicit authenticated CRUD grant matrix for appointments. Migration `0025` preserves that matrix for compatibility but installs `appointments_authoritative_write_guard`:

- SECURITY DEFINER RPCs execute as `postgres` and pass;
- guarded local service-role setup/cleanup passes;
- ordinary authenticated direct INSERT or UPDATE receives the safe permission error;
- SELECT remains available through RLS;
- DELETE remains available only where the existing owner/admin RLS policy permits it.

The frontend contains no protected `.insert(...)` or `.update(...)` appointment path. Browser network capture showed zero direct POST/PATCH requests to `/rest/v1/appointments`.

## Role enforcement

Current appointment role semantics were preserved rather than redesigned:

- clinic owner: create/update via RPC; delete allowed by existing RLS;
- clinic admin: create/update via RPC; delete allowed;
- registrar: create/update via RPC; delete denied;
- doctor: create/update via RPC under current broad policy;
- cashier: create/update via RPC under current broad policy;
- no-tenant/unknown/anonymous: denied.

A doctor permission redesign is intentionally deferred.

## Tenant and relationship integrity

Verified:

- patient and doctor must belong to the appointment tenant;
- composite patient/doctor tenant foreign keys remain present;
- cross-tenant create and reschedule are rejected;
- tenant B cannot read or recover tenant A operation data;
- operation keys are tenant-scoped;
- RLS remains enabled on appointments and appointment operations;
- operation table has no authenticated direct SELECT grant.

## Audit and activity

Successful first execution emits:

- `appointment_created`; or
- `appointment_rescheduled`.

Events contain tenant, appointment, patient, doctor, actor, operation reference, current status, and old/new start/end for reschedule. Replay emits no duplicate event; conflicts emit no success event.

No parallel audit subsystem was added.

## Repository migration

`SupabaseAppointmentRepository` now exposes:

- `createAppointment`;
- `rescheduleAppointment`;
- `updateAppointmentDetails`;
- `recoverAppointmentOperation`;
- tenant-scoped list methods;
- existing hard delete.

It generates/receives one operation key per logical attempt, preserves it during ambiguous retry, invokes the four scheduling RPCs, maps database rows, normalizes time values, maps safe Russian errors, and attempts recovery only for ambiguous outcomes.

Production frontend source contains no `service_role` reference and no Supabase localStorage fallback.

## Hook/modal integration

`useScheduleAppointments` now:

- chooses Supabase/local backend as before;
- uses a tenant/auth context query key;
- generates one UUID per logical create/reschedule attempt;
- shares one in-flight promise for rapid duplicate submission;
- retains the key after ambiguous failure;
- routes patient/doctor/start/end changes to reschedule RPC;
- routes details/status-only changes to details RPC;
- exposes saving/reconciliation/safe error states;
- refreshes once after confirmed success;
- ignores stale success/error from an old tenant context.

AppointmentModal now:

- has an immediate ref-based submit lock;
- disables inputs, close, delete, cancel, and submit while saving;
- shows `Сохраняем запись…`;
- shows `Проверяем, была ли запись сохранена…` during recovery;
- keeps form data open on conflict;
- performs quick doctor and patient half-open checks;
- ignores cancelled appointments in the quick check;
- validates zero/negative intervals;
- does not close before confirmed success.

No visual schedule redesign was made.

## SQL tests

`0025_appointment_conflict_hardening_test.sql` passed after a clean reset.

It covers role matrix, anonymous/no-tenant, tenant relationships, interval cases, doctor/patient overlap shapes, different resources, cancelled/completed/no-show/blocked behavior, idempotent create/recovery, changed-payload rejection, tenant-scoped keys, free/conflicting/self/back-to-back/cross-tenant reschedule, optimistic concurrency, details/status reactivation, direct-write denial, read/delete behavior, grants/trigger/RLS/FKs, zero overlap queries, hard-delete operation history, and clinical/financial non-side-effects.

Relevant SQL regressions passed:

- `0018_refund_writeoff_rpc_test.sql`
- `0019_cashier_payment_hardening_test.sql`
- `0021_completed_service_billing_guard_test.sql`
- `0022_patient_credit_deposits_foundation_test.sql`
- `0023_patient_credit_intake_hardening_test.sql`
- `0024_legacy_core_table_grants_test.sql`
- `0025_appointment_conflict_hardening_test.sql`

## Concurrency tests

`0025_appointment_conflict_concurrency.ps1` passed:

- exact same doctor: one success, one conflict, one row;
- partial doctor overlap: one success, one conflict;
- same patient/different doctor: one success, one patient conflict;
- different patient/doctor: two successes;
- back-to-back: two successes;
- same key/same payload: both calls resolve, one appointment ID, one replay;
- same key/different payload: one success, one idempotency conflict;
- concurrent reschedule: one winner;
- create vs reschedule: one slot owner;
- tenant isolation: two independent successes;
- invalid intervals: zero rows;
- final doctor overlap pairs: 0;
- final patient overlap pairs: 0;
- invalid intervals: 0;
- audit/activity: 13/13;
- deadlocks: 0.

All current concurrency regressions also passed:

- refund/write-off;
- cashier payment;
- completed-service billing;
- patient fund reservations;
- patient credit intake;
- appointment conflicts.

## TypeScript tests

Targeted scheduling tests: 37 passed.

Full suite:

- test files: 80 passed;
- tests: 884 passed.

Coverage added for RPC invocation, unchanged operation keys, ambiguous recovery, direct-write source guards, safe errors, replay mapping, tenant scope, stale response suppression, duplicate submit, recovery UI, doctor/patient conflicts, back-to-back, cancelled quick-check behavior, interval validation, form preservation, and one refresh after success.

## Browser smoke

Real local Supabase mode was used with ordinary Supabase Auth and two isolated browser sessions.

Verified:

- normal create persisted after reload;
- simultaneous exact doctor conflict produced one winner and one safe conflict;
- partial doctor conflict produced one winner and one safe conflict;
- same patient/different doctor produced one winner and one safe patient conflict;
- back-to-back UI bookings both succeeded;
- rapid same-key duplicate calls returned one appointment ID and one replay;
- a deliberately discarded successful response was recovered by the original key;
- two appointments concurrently rescheduled into one slot produced one winner;
- an active appointment was cancelled through the details RPC and its slot reused;
- tenant B could not see tenant A appointments or recover tenant A operation.

Rejected RPCs appear in Chrome as the expected `400 Bad Request` resource entry. There were no unhandled promises, raw SQL/constraint/function text in the UI, fatal console errors, or visible secrets.

## Network validation

Captured local Kong/PostgREST requests:

- `POST /rest/v1/rpc/create_appointment`: success and expected conflict responses;
- `POST /rest/v1/rpc/reschedule_appointment`: success and expected conflict response;
- `POST /rest/v1/rpc/update_appointment_details`: success;
- `POST /rest/v1/rpc/get_appointment_operation`: success and tenant denial;
- direct `POST /rest/v1/appointments`: 0;
- direct protected `PATCH /rest/v1/appointments`: 0.

No service-role credential was sent by browser code.

## Database validation

After browser smoke:

- active doctor overlap pairs: 0;
- active patient overlap pairs: 0;
- invalid intervals: 0;
- duplicate tenant operation keys: 0;
- successful operation rows: 11;
- distinct operation appointment IDs: 11;
- appointment-created audits/activities: 10/10;
- appointment-rescheduled audits/activities: 1/1;
- RLS enabled on appointments and appointment operations.

After final clean reset and transactional SQL validation, all QA tables returned zero rows.

## Side-effect validation

Appointment create/reschedule produced no:

- visit;
- clinical encounter;
- completed service;
- treatment plan;
- finding;
- dental-chart mutation;
- invoice;
- payment;
- refund;
- write-off/financial adjustment;
- document.

Patient balances remained unchanged. No stock, reminder, waitlist, confirmation, or amoCRM data was created.

## Cleanup

Removed:

- QA auth users, tenants, memberships, patients, doctors, appointments, and operation rows;
- temporary same-origin recovery page;
- Vite process;
- screenshots and network log extracts;
- temporary patch scripts.

Final command:

```text
npx supabase db reset --no-seed
```

Final counters:

```text
auth.users | tenants | profiles | tenant_users | patients | doctors | appointments | appointment_operations | audit_events | activity_events
0          | 0       | 0        | 0            | 0        | 0       | 0            | 0                      | 0            | 0
```

## Checks

- baseline and merged dependency verified;
- clean forward migration `0001–0025`: passed;
- SQL hardening test: passed;
- grants regression: passed;
- relevant SQL regressions: passed;
- all six concurrency suites: passed;
- targeted TypeScript tests: passed;
- real two-session Supabase browser smoke: passed;
- RPC-only protected browser network path: verified;
- database overlap/invalid/key counts: zero;
- cleanup counters: zero;
- `git diff --check`: passed;
- production frontend service-role scan: clean;
- temporary file scan: clean.

## Lint/test/build

- `npm run lint`: passed;
- `npm run test -- --run`: 80 files / 884 tests passed;
- `npm run build`: passed.

Existing unrelated React `act(...)` test warnings and the existing Vite bundle-size warning remain.

## Fresh CI

Pending PR publication and a fresh GitHub Actions run on the final PR head.

Required final confirmation:

- CI tested the exact final PR head;
- ESLint passed;
- tests passed;
- build passed;
- PR remains open and unmerged.

## Known limitations

- Cabinet remains untrusted free text and is not an authoritative conflict resource.
- Current broad doctor/cashier appointment mutation policy is preserved; permission redesign is deferred.
- Expected rejected PostgREST RPCs appear as HTTP 400 resource entries in Chrome, although the UI receives only safe domain text.
- Hard delete remains; the idempotency operation snapshot/key is preserved after deletion.
- LocalStorage development mode remains available by explicit backend selection; configured Supabase mode uses RPCs.

## What was intentionally not implemented

- week/month schedule views;
- lifecycle redesign;
- cancellation reasons;
- no-show metadata redesign;
- confirmation workflow;
- reminders;
- waitlist;
- room/chair/assistant/equipment models;
- public booking;
- hard-delete removal;
- source-of-truth consolidation;
- finance or clinical changes;
- cloud migration apply;
- generated types;
- HEP-V2.

## Recommended next task

`SCHEDULE-SOURCE-OF-TRUTH-CONSOLIDATION-001`

Reason: appointment writes are now authoritative and conflict-safe. The next task should make all patient-card and summary appointment readers consume the same Supabase-backed facts instead of mixing them with localStorage-only readers.

This task was not started.
