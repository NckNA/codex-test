# TENANT-TIMEZONE-SCHEDULING-FOUNDATION-001

## 1. Final verdict

Task verdict: **TENANT TIMEZONE SCHEDULING FOUNDATION IMPLEMENTED AND VERIFIED WITH ONE TOOLING LIMITATION**

Machine-readable final verdict: **PARTIAL**

The implementation is functionally complete and passed local migration reset, SQL regression, concurrency regression, full TypeScript quality checks, production build, and real isolated HeadlessChrome browser scenarios against local Supabase.

The verdict is PARTIAL only because the task requested a separately invokable `chrome-devtools-mcp` execution, while this ChatGPT/Hermes environment exposed isolated HeadlessChrome browser automation but no callable Chrome DevTools MCP action or executable. Equivalent browser, console, network, gateway-log, and database validation was completed.

The pull request remains open and unmerged.

## 2. Summary

This task makes each tenant's IANA timezone authoritative for appointment scheduling.

Appointment timestamps remain PostgreSQL `timestamptz` instants. Appointment forms use tenant-local `YYYY-MM-DDTHH:mm` values, repository writes accept only offset-aware instants, and the selected schedule day is a plain tenant-local `YYYY-MM-DD` value. Browser timezone and UTC midnight no longer define the clinic calendar day.

A minimal tenant selector was added for users with multiple clinic memberships. Tenant, role, timezone, and schedule-date state now change together without stale cross-tenant UI state.

No reminder queue, delivery provider, cron, worker, webhook, finance mutation, clinical mutation, public booking, cloud migration, or historical mass timestamp shift was introduced.

## 3. Branch

`feature/tenant-timezone-scheduling-foundation-001`

## 4. PR URL

https://github.com/NckNA/codex-test/pull/353

PR #353 is ready for review, open, and intentionally unmerged.

## 5. Baseline

- repository: `NckNA/codex-test`;
- base branch: `main`;
- task branch baseline: `9a67dd54d2d1a3c14abeb7c37e4538865f8cf35c`;
- required PR #351 is present in `main`;
- required earlier merge `9cb2a080f7a92702829b35505c733bad882b836f` is an ancestor;
- baseline also includes PR #352, which added the explicit no-merge CI guard and active `main` branch ruleset;
- cloud Supabase was not used or modified.

## 6. Implementation head reviewed before final report update

- implementation head: `c2ef7962eb061e1c84c6ce3e716b3ee23cffc845`;
- workflow: `CI`;
- run number: `#715`;
- run ID: `29202579685`;
- status: `completed`;
- conclusion: `success`;
- tested commit: `c2ef7962eb061e1c84c6ce3e716b3ee23cffc845`;
- tested commit matched the implementation head exactly;
- PR merge state was clean;
- the pull request remained open and unmerged.

## 7. Report update commit

Report update commit: N/A because a report-only commit cannot contain its own future SHA or the CI result that tests it.

The exact final report-only commit and fresh final CI run must be recorded in the immutable finalization receipt and final task response.

## 8. Changed files

- `_ai_work/REPORTS/TENANT-TIMEZONE-SCHEDULING-FOUNDATION-001_foundation.md`;
- `src/App.test.tsx`;
- `src/components/admin/AdminAuditViewer.test.tsx`;
- `src/components/layout/Header.test.tsx`;
- `src/components/layout/Header.tsx`;
- `src/components/patients/patient-card/PatientHistoryTab.test.tsx`;
- `src/components/patients/patient-card/PatientHistoryTab.tsx`;
- `src/components/patients/patient-card/PatientOverviewTab.tsx`;
- `src/components/schedule/AppointmentCancellationDialog.tsx`;
- `src/components/schedule/AppointmentConfirmationPanel.test.tsx`;
- `src/components/schedule/AppointmentConfirmationPanel.tsx`;
- `src/components/schedule/AppointmentLifecycleDialogs.test.tsx`;
- `src/components/schedule/AppointmentModal.test.tsx`;
- `src/components/schedule/AppointmentModal.tsx`;
- `src/components/schedule/AppointmentNoShowDialog.tsx`;
- `src/context/ScheduleContext.tsx`;
- `src/context/ScheduleProvider.test.tsx`;
- `src/context/ScheduleProvider.tsx`;
- `src/contexts/TenantContext.test.tsx`;
- `src/contexts/TenantContext.tsx`;
- `src/data/hooks/useChiefComplaint.test.tsx`;
- `src/data/hooks/useClinicalWorkflow.test.tsx`;
- `src/data/hooks/useDentalChart.test.tsx`;
- `src/data/hooks/useDictionaries.test.tsx`;
- `src/data/hooks/usePatientAppointments.test.tsx`;
- `src/data/hooks/usePatientAppointments.ts`;
- `src/data/hooks/usePatientFindings.test.tsx`;
- `src/data/hooks/usePatientListVisitSummary.test.tsx`;
- `src/data/hooks/usePatientListVisitSummary.ts`;
- `src/data/hooks/usePatientMedicalSummary.test.tsx`;
- `src/data/hooks/usePatientTimeline.test.tsx`;
- `src/data/hooks/useScheduleAppointments.ts`;
- `src/data/hooks/useTreatmentPlans.test.tsx`;
- `src/data/repositories/AppointmentRepository.test.ts`;
- `src/data/repositories/AppointmentRepository.ts`;
- `src/domain/timezone.test.ts`;
- `src/domain/timezone.ts`;
- `src/pages/MedicalPage.test.tsx`;
- `src/pages/PatientCardPage.test.tsx`;
- `src/pages/PatientCardPage.tsx`;
- `src/pages/PatientsPage.test.tsx`;
- `src/pages/PatientsPage.tsx`;
- `src/pages/SchedulePage.tsx`;
- `supabase/migrations/0028_tenant_timezone_scheduling_foundation.sql`;
- `supabase/tests/0028_tenant_timezone_scheduling_foundation_test.sql`.

No package, lockfile, generated type, environment file, screenshot, browser fixture, or cloud migration artifact belongs in the final diff.

## 9. Pre-read

The following architecture and operation reports were reviewed before implementation:

- `SCHEDULE-OPERATIONS-RECON-001`;
- `APPOINTMENT-CONFLICT-HARDENING-001`;
- `SCHEDULE-SOURCE-OF-TRUTH-CONSOLIDATION-001`;
- `APPOINTMENT-CANCELLATION-NOSHOW-001`;
- `APPOINTMENT-CONFIRMATION-WORKFLOW-001`;
- `APPOINTMENT-REMINDER-OPERATIONS-RECON-001`;
- roles and permissions;
- multi-tenant architecture rules;
- data isolation and security;
- appointments and schedule;
- backend/API architecture;
- storage and migration strategy;
- testing and QA strategy.

## 10. Original time-semantics inventory

| Area | Original behavior | Classification | Risk |
|---|---|---|---|
| Schedule selected day | JavaScript `Date` plus `toISOString().split('T')[0]` | UTC-day bug | wrong clinic day near UTC midnight |
| Slot creation | offset-free local string later marked with `Z` | unsafe `Z` append | local wall time persisted as UTC |
| Repository reads | stripped `Z` or explicit offset | offset stripping | instant meaning lost |
| Appointment modal | browser-local `Date` parsing | browser dependency | different workstations save different instants |
| Card position and label | browser `getHours()` | browser dependency | wrong schedule position and label |
| Patient and lifecycle display | locale formatting without explicit timezone | browser dependency | inconsistent schedule and history facts |
| Next or previous selection | epoch comparison | safe instant conversion | retained |
| Existing appointment rows | PostgreSQL `timestamptz` | safe stored instant | intentionally not rewritten |

## 11. Original defects

1. UTC midnight defined the clinic day.
2. Offset-free wall time was blindly treated as UTC.
3. Persisted offsets were removed during reads.
4. Browser timezone controlled forms, cards, patient history, and lifecycle metadata.
5. Tenant context did not expose an authoritative timezone.
6. Multi-tenant users had no practical tenant switch control.
7. The first real-browser reschedule exposed microsecond loss in `updated_at` when it was canonicalized through JavaScript `Date`; the final repository preserves exact database timestamp text and precision.

## 12. Tenant timezone model and migration

Migration `0028_tenant_timezone_scheduling_foundation.sql`:

1. adds `public.tenants.timezone text not null`;
2. backfills null or empty legacy values to `Asia/Almaty`;
3. sets `Asia/Almaty` as the default;
4. validates exact IANA names against PostgreSQL `pg_timezone_names`;
5. rejects invalid values through a trigger;
6. blocks direct timezone changes outside the controlled RPC path;
7. adds owner/admin-only `set_tenant_timezone(uuid,text)`;
8. emits one audit event and one activity event for an actual change;
9. preserves RLS and existing role boundaries;
10. does not rewrite appointment timestamps.

Numeric offsets are not accepted as authoritative timezone identifiers. Existing appointments remain `timestamptz` instants.

No cloud migration was applied.

## 13. Historical-data policy

Existing appointment timestamps are treated as stored instants. No row was shifted using guessed prior intent.

Historical rows created under earlier unsafe browser conversion may require a separate evidence-based and audited repair task. This task prevents future ambiguous writes without inventing historical intent.

## 14. Time representation contract

- persisted timestamp: offset-aware ISO 8601 instant;
- tenant-local form value: `YYYY-MM-DDTHH:mm`;
- tenant-local calendar date: `YYYY-MM-DD`;
- tenant timezone: exact IANA name;
- repository write boundary: offset-aware instant only;
- UI write boundary: tenant-local wall time converted through active tenant timezone;
- day interval: tenant-local midnight to next tenant-local midnight, half-open;
- comparisons: absolute instant or epoch based;
- database timestamp reads: validated but returned without changing offset or precision.

## 15. Timezone utility and DST policy

`src/domain/timezone.ts` provides:

- required IANA timezone validation;
- offset-aware instant validation;
- instant-to-tenant date conversion;
- instant-to-tenant `datetime-local` conversion;
- tenant-local wall-time-to-instant conversion;
- tenant day start and next-day exclusive boundaries;
- tenant-aware current date with injected `now`;
- tenant-day comparison;
- tenant-local formatting;
- calendar-day arithmetic without browser timezone parsing.

No dependency was added. Native `Intl.DateTimeFormat` is used with explicit `timeZone`.

DST policy:

- nonexistent spring-forward local time is rejected;
- repeated fall-back local time is rejected as ambiguous;
- no silent one-hour correction is performed;
- Berlin and New York winter and summer offsets are tested;
- Asia/Almaty and leap-day behavior are tested.

## 16. Tenant context and switching

- `ActiveTenant.timezone` is required;
- Supabase membership loading includes the tenant timezone;
- only the migration-guaranteed `Asia/Almaty` legacy fallback is permitted;
- invalid database timezone blocks scheduling with a safe error;
- tenant and timezone participate in relevant query identities;
- pending old tenant or user responses remain guarded;
- switching tenant changes tenant, role, and timezone together;
- schedule date state is keyed by tenant ID plus timezone;
- the header exposes a minimal tenant selector only for multi-tenant users;
- no broad tenant settings module was introduced.

## 17. Repository and optimistic concurrency fixes

- removed blind `Z` appending;
- removed timezone suffix stripping;
- create and reschedule require offset-aware instants;
- write values normalize to equivalent UTC ISO instants;
- database timestamps are validated but returned unchanged;
- explicit offsets and PostgreSQL microseconds survive reads;
- exact `updated_at` remains suitable for optimistic concurrency;
- lifecycle and confirmation timestamps remain instants;
- raw SQLSTATE, catalog names, stack traces, and PostgREST payloads are not exposed.

The initial browser reschedule failed safely because JavaScript normalization truncated PostgreSQL microseconds. After exact timestamp preservation, the same browser scenario passed.

## 18. Schedule, modal, patient, and lifecycle integration

- selected schedule date is a plain tenant-local `YYYY-MM-DD`;
- reachable `toISOString().split('T')[0]` logic was removed;
- schedule day membership uses tenant-local start and next-day start;
- the interval is half-open;
- card position and displayed time use tenant wall time;
- month and year headings format plain tenant dates without browser drift;
- existing appointment instants convert to tenant-local modal values;
- saving converts tenant-local start and end through active tenant timezone;
- save and reload preserve displayed local time;
- reschedule uses the same conversion contract;
- next and previous appointment selection remains instant based;
- patient list, overview, card history, confirmation, cancellation, and no-show timestamps render through the active tenant timezone.

## 19. Role matrix

Timezone read:

- owner, admin, registrar, doctor, and cashier: allowed for their own tenant;
- unknown or no-tenant user: blocked.

Timezone mutation RPC:

- owner: allowed;
- admin: allowed;
- registrar: blocked;
- doctor: blocked;
- cashier: blocked;
- unknown or no-tenant user: blocked;
- cross-tenant admin: blocked.

No frontend service-role key or service-role path was introduced.

## 20. SQL and migration validation

A clean local reset applied migrations `0001` through `0028`.

Passed SQL suites:

- `0024_legacy_core_table_grants_test.sql`;
- `0025_appointment_conflict_hardening_test.sql`;
- `0026_appointment_cancellation_noshow_test.sql`;
- `0027_appointment_confirmation_workflow_test.sql`;
- `0028_tenant_timezone_scheduling_foundation_test.sql`.

The 0028 suite verifies default and backfill behavior, valid and invalid IANA names, direct-update blocking, role boundaries, cross-tenant isolation, RLS, audited mutation, unchanged appointment instants, zero invalid intervals, and zero clinical or financial side effects.

## 21. Concurrency validation

- 0025: success operations `13`; doctor overlap pairs `0`; patient overlap pairs `0`; invalid intervals `0`; audit/activity `13/13`; deadlocks `0`;
- 0026: successes `13`; replays `2`; controlled conflicts `5`; cancelled rows `8`; no-show rows `2`; active overlap pairs `0`; deadlocks `0`;
- 0027: successes `12`; replays `2`; controlled conflicts `7`; attempts `10`; confirmations `6`; duplicate operation keys `0`; deadlocks `0`.

## 22. Browser smoke

Real isolated HeadlessChrome 150 smoke ran against local Supabase and this task branch on `127.0.0.1:5188`.

Passed scenarios:

1. create at Almaty local `09:00`, reload, and still display `09:00`;
2. raw database creation instant `2026-07-12 04:00:00+00`, which is Almaty `09:00`;
3. reschedule to Almaty local `11:30-12:30` and reload unchanged;
4. raw reschedule instants `06:30-07:30+00`, which are Almaty `11:30-12:30`;
5. one instant `2026-07-12T19:30:00Z` displayed as `13.07.2026 00:30` in Almaty;
6. the same instant displayed as `12.07.2026 21:30` in Berlin;
7. host timezone UTC+5 did not override Berlin tenant time;
8. tenant A to tenant B switch changed role and timezone and cleared the old custom date without stale A content;
9. confirmation succeeded and survived reload;
10. cancellation succeeded and rendered tenant-local metadata;
11. no-show succeeded and rendered tenant-local metadata;
12. successful final scenarios had no console errors, failed requests, or visible secrets.

Kong and PostgREST logs captured successful RPC calls:

- `create_appointment` -> 200;
- `reschedule_appointment` -> 200 after the precision fix;
- `confirm_appointment` -> 200;
- `cancel_appointment` -> 200;
- `mark_appointment_no_show` -> 200.

Database checks after browser operations showed:

- doctor overlap pairs: `0`;
- patient overlap pairs: `0`;
- invalid intervals: `0`;
- operation facts present for create, reschedule, confirm, cancel, and no-show;
- matching audit events present;
- lifecycle timestamps stored as UTC instants;
- tenant isolation preserved;
- clinical and financial side-effect counts remained zero.

## 23. Cleanup

- task Vite process stopped;
- local Supabase reset with `--no-seed` after browser and concurrency QA;
- final counters were zero for tenants, memberships, patients, doctors, appointments, appointment operations, confirmation attempts, visits, encounters, invoices, and payments;
- browser screenshots remain outside the repository under `D:\hermes\reports\tenant-timezone-smoke` and are not committed.

## 24. Checks: lint, tests, and build

Final clean checks:

- ESLint: passed;
- full Vitest suite: **90 files / 1007 tests passed**;
- TypeScript build: passed;
- Vite production build: passed;
- SQL suites 0024 through 0028: passed;
- concurrency suites 0025 through 0027: passed;
- implementation CI run `#715`, run ID `29202579685`: success on exact implementation head `c2ef7962eb061e1c84c6ce3e716b3ee23cffc845`.

Non-blocking baseline warnings:

- existing React `act(...)` warnings in older tests;
- existing Vite large-bundle warning.

No package dependency was changed.

## 25. Issues / Limitations

Security and scope boundaries:

- no frontend service-role key;
- no direct protected appointment insert or update path;
- no cross-tenant mutation;
- no raw database error displayed;
- no cloud Supabase apply;
- no historical mass timestamp shift;
- no PR merge.

Known limitations:

1. a separately invokable Chrome DevTools MCP action was unavailable; equivalent isolated HeadlessChrome validation passed;
2. historical rows remain stored instants and may require a separate evidence-based audited repair task;
3. no full tenant settings UI was added; only controlled backend mutation and minimal tenant switching were added;
4. cloud Supabase remains behind local migrations because cloud apply was explicitly forbidden;
5. existing unrelated Supabase advisor warnings remain separate hardening work;
6. existing bundle-size and React warning baselines remain unrelated.

Excluded scope:

- reminder queues or settings;
- SMS, WhatsApp, or email;
- provider SDKs;
- cron, workers, or webhooks;
- public booking;
- consent or contact redesign;
- week or month calendar redesign;
- finance or clinical changes;
- role redesign;
- generated types;
- HEP-V2.

## 26. Recommended next task

Implementation CI: workflow `CI`, run `#715`, run ID `29202579685`, conclusion `success`, tested commit `c2ef7962eb061e1c84c6ce3e716b3ee23cffc845`.

A second fresh CI run is mandatory after the report-only metadata commit. The final CI run must test the exact final PR HEAD.

The PR must remain open and unmerged.

Recommended next task: **APPOINTMENT-REMINDER-QUEUE-FOUNDATION-001**

Reason: tenant-local boundaries and durable appointment instants are now authoritative, so reminder `due_at`, appointment versioning, and cancellation or reschedule invalidation can be designed without sending anything to external providers.

This next task was not started.

Final task verdict: **TENANT TIMEZONE SCHEDULING FOUNDATION IMPLEMENTED AND VERIFIED WITH ONE TOOLING LIMITATION**
