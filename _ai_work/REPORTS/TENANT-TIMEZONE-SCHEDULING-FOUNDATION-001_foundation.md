# TENANT-TIMEZONE-SCHEDULING-FOUNDATION-001

## Final verdict

PARTIAL: separate Chrome DevTools MCP execution was unavailable in this ChatGPT/Hermes environment; equivalent isolated HeadlessChrome browser automation, PostgREST network validation, local Supabase tests, concurrency tests, TypeScript tests, lint, and production build passed.

## Summary

This task makes the tenant IANA timezone authoritative for appointment scheduling. Appointment timestamps remain PostgreSQL `timestamptz` instants. Forms use tenant-local `YYYY-MM-DDTHH:mm`, repository writes accept only offset-aware instants, and schedule dates are plain tenant-local `YYYY-MM-DD` values. Browser timezone and UTC midnight no longer define the clinic calendar day.

A minimal tenant switcher was added for multi-tenant users. No reminder queue, delivery provider, cron, worker, webhook, finance change, clinical change, public booking, cloud migration, or historical mass shift was introduced.

## Branch

`feature/tenant-timezone-scheduling-foundation-001`

## PR URL

Pending creation after the implementation commit.

## Baseline

- Required PR #351 is present in `main`.
- Branch baseline: `9a67dd54d2d1a3c14abeb7c37e4538865f8cf35c`.
- Required earlier merge `9cb2a080f7a92702829b35505c733bad882b836f` is an ancestor.
- Baseline also includes PR #352, which added an explicit no-merge CI guard and an active main-branch ruleset.

## PR head reviewed before final report update

Pending implementation commit.

## Report update commit

N/A because a final report commit cannot reference itself.

## Changed files

Migration and SQL validation:

- `supabase/migrations/0028_tenant_timezone_scheduling_foundation.sql`
- `supabase/tests/0028_tenant_timezone_scheduling_foundation_test.sql`

Timezone and tenant/schedule context:

- `src/domain/timezone.ts`
- `src/domain/timezone.test.ts`
- `src/contexts/TenantContext.tsx`
- `src/contexts/TenantContext.test.tsx`
- `src/context/ScheduleContext.tsx`
- `src/context/ScheduleProvider.tsx`
- `src/context/ScheduleProvider.test.tsx`
- `src/components/layout/Header.tsx`
- `src/components/layout/Header.test.tsx`

Appointment and patient scheduling paths:

- `src/data/repositories/AppointmentRepository.ts`
- `src/data/repositories/AppointmentRepository.test.ts`
- `src/data/hooks/useScheduleAppointments.ts`
- `src/data/hooks/usePatientAppointments.ts`
- `src/data/hooks/usePatientListVisitSummary.ts`
- `src/pages/SchedulePage.tsx`
- `src/components/schedule/AppointmentModal.tsx`
- confirmation, cancellation, and no-show components/tests
- patient list, overview, card, and history components/tests

Existing test fixtures were updated wherever `ActiveTenant.timezone` became required. No package or generated-type changes were made.

## Pre-read

Read before implementation:

- SCHEDULE-OPERATIONS-RECON-001
- APPOINTMENT-CONFLICT-HARDENING-001
- SCHEDULE-SOURCE-OF-TRUTH-CONSOLIDATION-001
- APPOINTMENT-CANCELLATION-NOSHOW-001
- APPOINTMENT-CONFIRMATION-WORKFLOW-001
- APPOINTMENT-REMINDER-OPERATIONS-RECON-001
- roles and permissions
- multi-tenant architecture rules
- data isolation and security
- appointments and schedule
- backend/API architecture
- storage and migration strategy
- testing and QA strategy

## Original time-semantics inventory

| Area | Original behavior | Classification | Risk |
|---|---|---|---|
| Schedule selected day | JavaScript `Date` plus `toISOString().split('T')[0]` | UTC-day bug | wrong clinic day near UTC midnight |
| Slot creation | offset-free local string later marked with `Z` | unsafe Z append | local wall time persisted as UTC |
| Repository reads | stripped `Z`/explicit offset | offset stripping | instant meaning lost |
| Appointment modal | browser-local `Date` parsing | browser dependency | different workstations save different instants |
| Card position/time | browser `getHours()` | browser dependency | wrong schedule position |
| Patient/lifecycle display | locale formatting without explicit zone | browser dependency | inconsistent schedule/history facts |
| Next/previous selection | epoch comparison | safe instant conversion | retained |
| Existing appointment rows | PostgreSQL `timestamptz` | safe stored instant | intentionally not rewritten |

## Original defects

1. UTC midnight defined the clinic day.
2. Offset-free wall time was blindly treated as UTC.
3. Persisted offsets were removed during reads.
4. Browser timezone controlled forms, cards, patient history, and lifecycle metadata.
5. Tenant context did not expose authoritative timezone.
6. Multi-tenant users had no practical tenant switch control.
7. Initial browser reschedule exposed microsecond loss in `updated_at` when canonicalized through JavaScript `Date`; final code preserves database timestamp text and precision.

## Tenant timezone model

- `public.tenants.timezone text not null`
- legacy/default value: `Asia/Almaty`
- exact IANA names only
- numeric offsets are not authoritative identifiers
- appointments remain `timestamptz`
- active timezone is loaded with tenant membership context

## Migration behavior

Migration 0028:

1. Adds `tenants.timezone`.
2. Backfills null/empty legacy values to `Asia/Almaty`.
3. Sets default and `NOT NULL`.
4. Validates against PostgreSQL `pg_timezone_names`.
5. Rejects invalid values through a trigger.
6. Blocks direct timezone changes outside the controlled RPC path.
7. Adds owner/admin-only `set_tenant_timezone(uuid,text)`.
8. Emits audit and activity events for actual changes.
9. Preserves RLS and existing role boundaries.
10. Does not rewrite appointment timestamps.

No cloud migration was applied.

## Historical-data handling

Existing timestamps are treated as stored instants. No row was shifted based on guessed prior intent. Historical rows created under earlier unsafe browser conversion may require a separate evidence-based audited repair task. This task prevents future ambiguous writes without inventing history.

## Time representation contract

- persisted timestamp: offset-aware ISO 8601 instant
- tenant-local form: `YYYY-MM-DDTHH:mm`
- tenant-local date: `YYYY-MM-DD`
- timezone: IANA name
- repository boundary: offset-aware instants only
- UI boundary: tenant-local wall time converted through tenant timezone
- day interval: tenant midnight to next tenant midnight, half-open
- comparisons: instant based
## Timezone utility

`src/domain/timezone.ts` provides IANA validation, offset-aware instant validation, instant-to-tenant date/time conversion, tenant-local wall-time-to-instant conversion, tenant day boundaries, injected tenant-aware now, tenant-day comparison, formatting, and calendar-day arithmetic. Invalid inputs fail with safe Russian messages and never silently fall back to browser timezone.

## Dependency decision

No dependency was added. Native `Intl.DateTimeFormat` is used with explicit `timeZone`. Wall-time conversion enumerates real zone offsets around the requested local time and verifies exact formatted parts, which detects missing and repeated local times without a single-offset guesser.

## DST and ambiguity policy

- nonexistent spring-forward time: reject
- repeated fall-back time: reject as ambiguous
- never silently shift by one hour
- Berlin and New York winter/summer offsets tested
- historical IANA rules delegated to runtime timezone data

## Tenant context

- `ActiveTenant.timezone` is required.
- Supabase membership query loads tenant timezone.
- Only the migration-guaranteed `Asia/Almaty` legacy fallback is permitted.
- Invalid database timezone blocks scheduling with a safe error.
- Tenant and timezone participate in relevant query identities.
- Pending old tenant/user responses remain guarded.
- Tenant switch changes tenant, role, and timezone together.
- Schedule date state is keyed by tenant id plus timezone.
- Header contains a minimal tenant selector, not a broad settings module.

## Repository conversion fixes

- removed blind `Z` append
- removed timezone suffix stripping
- create/reschedule require offset-aware instants
- write values normalize to equivalent UTC ISO instants
- database timestamps are validated but returned unchanged
- explicit offsets and PostgreSQL microseconds survive reads
- `updated_at` remains exact for optimistic concurrency
- lifecycle and confirmation timestamps remain instants
- raw SQLSTATE, catalog names, stack traces, and PostgREST payloads are not exposed

## Appointment modal integration

Existing appointments convert from persisted instant to tenant-local form values. Saving converts tenant-local start/end through the tenant timezone. Conflict checks remain instant based. Save/reload preserves local wall time. Reschedule uses the same contract. DST gaps and repeated times return safe errors.

## Schedule-day boundaries

- selected date is plain tenant-local `YYYY-MM-DD`
- reachable `toISOString().split('T')[0]` logic removed
- day membership uses tenant start and next-day start
- interval is half-open
- card position and label use tenant wall time
- month/year heading formats a plain tenant date without browser drift

## Today and tomorrow semantics

Schedule initialization uses `tenantNowDate(timezone)`. Date navigation uses plain-date calendar arithmetic. Tests inject 
ow` and prove a near-midnight UTC instant produces different correct dates in Almaty and Berlin. UTC midnight and browser midnight no longer define clinic today.

## Patient summaries

Next/previous selection remains instant based. Patient list, overview, card history, and schedule display through active tenant timezone. The same instant was browser-verified as `13.07.2026 00:30` in Almaty and `12.07.2026 21:30` in Berlin.

## Lifecycle timestamp display

Confirmation, last attempt, cancellation, no-show, and patient-history lifecycle facts render in tenant timezone. Repository values remain persisted instants.

## Role matrix

Timezone read:

- owner/admin/registrar/doctor/cashier: allowed for their tenant
- unknown/no tenant: blocked

Timezone mutation RPC:

- owner: allowed
- admin: allowed
- registrar: blocked
- doctor: blocked
- cashier: blocked
- unknown/no tenant: blocked
- cross-tenant admin: blocked

No frontend service role was introduced.

## SQL tests

Clean local reset applied migrations 0001 through 0028. Passed:

- `0024_legacy_core_table_grants_test.sql`
- `0025_appointment_conflict_hardening_test.sql`
- `0026_appointment_cancellation_noshow_test.sql`
- `0027_appointment_confirmation_workflow_test.sql`
- `0028_tenant_timezone_scheduling_foundation_test.sql`

SQL 0028 verifies default/backfill, valid and invalid IANA names, direct-update blocking, role matrix, cross-tenant isolation, RLS, audited mutation, unchanged appointment instants, no invalid intervals, and no clinical/financial effects.

## Concurrency tests

- 0025: success operations 13; doctor overlaps 0; patient overlaps 0; invalid intervals 0; audit/activity 13/13; deadlocks 0.
- 0026: successes 13; replays 2; controlled conflicts 5; cancelled 8; no-show 2; active overlaps 0; deadlocks 0.
- 0027: successes 12; replays 2; controlled conflicts 7; attempts 10; confirmations 6; duplicate keys 0; deadlocks 0.

## Timezone utility tests

Covered Almaty conversion and round trips, UTC-midnight crossing, Berlin/New York winter and summer, DST gap rejection, DST ambiguity rejection, invalid timezone/date/instant, leap day, half-open boundaries, injected now, and browser-zone independence.

## Repository tests

Covered explicit offset preservation, offset-free rejection, no suffix stripping, no blind `Z` append, correct create/reschedule instants, exact database timestamp precision, lifecycle/confirmation mapping, save/reload instant stability, and safe errors.

## Schedule and UI tests

Covered tenant-local selected day, boundary inclusion/exclusion, tenant-switch date reset, different A/B dates for one instant, modal wall-time round trip, tenant selector behavior, and unchanged confirmation/cancellation/no-show behavior.
## Browser smoke

Real isolated HeadlessChrome 150 smoke ran against local Supabase and this task branch on `127.0.0.1:5188`.

Passed scenarios:

1. Create at Almaty local 09:00 and reload at 09:00.
2. Database raw creation instant: `2026-07-12 04:00:00+00`; Almaty wall time 09:00.
3. Reschedule to Almaty local 11:30-12:30 and reload unchanged.
4. Database raw reschedule instants: 06:30-07:30 UTC; Almaty wall time 11:30-12:30.
5. One UTC instant rendered as 13 July 00:30 in Almaty.
6. The same instant rendered as 12 July 21:30 in Berlin.
7. Host timezone is UTC+5, but Berlin still rendered Berlin time.
8. Tenant A to B switch changed role/timezone and removed old custom date without stale A content.
9. Confirmation succeeded and survived reload.
10. Cancellation succeeded and rendered tenant-local metadata.
11. No-show succeeded and rendered tenant-local metadata.
12. Successful final scenarios had no console errors, failed requests, or visible secrets.

The first browser reschedule before the precision fix returned the safe stale-write error. It exposed JavaScript truncation of PostgreSQL microseconds in `updated_at`. After preserving raw timestamp precision, the same smoke passed.

### Chrome DevTools MCP limitation

Hermes exposed isolated browser automation and HeadlessChrome, but no separately invokable `chrome-devtools-mcp` action or executable. Codex configuration references a Chrome plugin, but Codex/Chrome MCP was not callable in this conversation. This exact named-tool gap is the reason for the PARTIAL verdict. Equivalent browser, console, request, gateway-log, and database validation was completed.

## Network validation

Kong/PostgREST logs captured successful calls:

- `POST /rest/v1/rpc/create_appointment` -> 200
- `POST /rest/v1/rpc/reschedule_appointment` -> 200 after precision fix
- `POST /rest/v1/rpc/confirm_appointment` -> 200
- `POST /rest/v1/rpc/cancel_appointment` -> 200
- `POST /rest/v1/rpc/mark_appointment_no_show` -> 200
- tenant-scoped reads for A and B
- patient-scoped history reads

No protected direct appointment insert/update and no frontend service-role credential were used.

## Database validation

Browser-smoke database results:

- doctor overlap pairs: 0
- patient overlap pairs: 0
- invalid intervals: 0
- create/reschedule/confirm/cancel/no-show operation facts present
- matching audit events present
- lifecycle timestamps stored as UTC instants
- same absolute instant preserved across tenants
- tenant isolation preserved

## Tenant-switch validation

Tenant A used `Asia/Almaty`; Tenant B used `Europe/Berlin`. The multi-tenant user switched from admin context in A to doctor context in B. Timezone and role changed together, the old selected date disappeared, and Berlin history rendered Berlin time rather than host UTC+5 time.

## Side-effect validation

After browser operations all counts remained zero:

- patient visits
- clinical encounters
- completed services
- invoices
- payments
- refunds
- financial adjustments

SQL 0028 independently verifies the same no-side-effect contract.

## Cleanup

- Task Vite process stopped.
- Local Supabase reset with `--no-seed` after browser and concurrency QA.
- Final counters: tenants 0, memberships 0, patients 0, doctors 0, appointments 0, operations 0, confirmation attempts 0, visits 0, encounters 0, invoices 0, payments 0.
- Browser screenshots remain outside the repository under `D:\hermes\reports\tenant-timezone-smoke` and are not committed.

## Lint, test, and build

Final clean results:

- ESLint: passed.
- Full Vitest: 90 files, 1007 tests passed.
- Production build: passed.
- Existing unrelated React act warnings and Vite bundle-size warning remain non-failing baseline warnings.

## Fresh CI

Pending PR creation and a fresh GitHub Actions run on the exact final PR head.

## Known limitations

1. Separate Chrome DevTools MCP was unavailable; equivalent HeadlessChrome validation passed.
2. Historical rows remain stored instants and may require separate evidence-based repair.
3. No full tenant settings UI was added; only controlled backend mutation and minimal tenant switching.
4. Cloud Supabase remains behind local migrations because cloud apply was explicitly forbidden.
5. Existing unrelated Supabase advisor warnings remain separate hardening work.
6. Existing bundle-size and React warning baselines remain unrelated.

## What was intentionally not implemented

- reminder queues or settings
- SMS, WhatsApp, or email
- provider SDKs
- cron, workers, or webhooks
- public booking
- consent/contact redesign
- week/month redesign
- finance or clinical changes
- role redesign
- frontend service role
- generated types
- HEP-V2
- cloud migration apply
- historical appointment mass shift

## Recommended next task

`APPOINTMENT-REMINDER-QUEUE-FOUNDATION-001`

Reason: tenant-local boundaries and durable appointment instants are now authoritative, so reminder `due_at`, appointment versioning, and cancellation/reschedule invalidation can be designed without sending anything to providers.