# SCHEDULE-SOURCE-OF-TRUTH-CONSOLIDATION-001: unify appointment readers on Supabase

## Final verdict

Final verdict: **PASS**

SCHEDULE SOURCE OF TRUTH CONSOLIDATED AND VERIFIED

## Summary

All reachable appointment readers used by the current UI now select one explicit backend. In configured `supabase-active` mode, appointment facts come only from the tenant-scoped `SupabaseAppointmentRepository`; missing session or tenant context disables the read instead of selecting localStorage. Explicit `dev` mode retains the local repository intentionally.

Patient history, patient-list previous/next summaries, patient-card medical summary, patient timeline, and SchedulePage now share the same appointment rows and deterministic date/status semantics. Stale tenant, user, and patient responses are discarded through query identity and request-generation checks. Configured bootstrap no longer creates demo `df_appointments` data.

No migration, new table, RPC, package, generated type, appointment write redesign, lifecycle redesign, cloud apply, finance mutation, or clinical mutation was introduced.

## Branch

`feature/schedule-source-of-truth-consolidation-001`

## PR URL

https://github.com/NckNA/codex-test/pull/348

## Baseline

- repository: `NckNA/codex-test`;
- required baseline: `7ba0b725acf21992a36f0185130f6bb6e8dbc791`;
- verified `origin/main`: `7ba0b725acf21992a36f0185130f6bb6e8dbc791`;
- PR #347 was present in that exact baseline;
- the source checkout was clean;
- the task worktree was created directly from `origin/main`.

## PR head reviewed before final report update

- implementation head reviewed: `35046311399ad973142a3f8427aeed56853aa81e`;
- workflow: `CI`;
- run: `#701`;
- run ID: `29183273692`;
- conclusion: `success`;
- tested commit matched the reviewed implementation head exactly;
- PR state: open, non-draft, mergeable;
- PR was not merged.

## Report update commit

- Report update commit: N/A because the final report commit cannot reference itself.
- The final report head and the fresh CI run after this update are recorded by the immutable local finalization receipt.

## Changed files

Implementation:

- `src/components/patients/patient-card/PatientHistoryTab.tsx`
- `src/components/patients/patient-card/PatientHistoryTab.test.tsx`
- `src/components/patients/patient-card/PatientOverviewTab.tsx`
- `src/components/patients/patient-card/PatientOverviewTab.test.tsx`
- `src/components/schedule/AppointmentModal.tsx`
- `src/data/aggregators/ClinicalSummaryAggregator.ts`
- `src/data/aggregators/ClinicalSummaryAggregator.test.ts`
- `src/data/aggregators/PatientListVisitSummaryAggregator.ts`
- `src/data/aggregators/PatientListVisitSummaryAggregator.test.ts`
- `src/data/hooks/usePatientAppointments.ts`
- `src/data/hooks/usePatientAppointments.test.tsx`
- `src/data/hooks/usePatientListVisitSummary.ts`
- `src/data/hooks/usePatientListVisitSummary.test.tsx`
- `src/data/hooks/usePatientMedicalSummary.ts`
- `src/data/hooks/usePatientMedicalSummary.test.tsx`
- `src/data/hooks/usePatientTimeline.ts`
- `src/data/hooks/usePatientTimeline.test.tsx`
- `src/data/hooks/useScheduleAppointments.ts`
- `src/data/hooks/useScheduleAppointments.test.tsx`
- `src/data/repositories/AppointmentRepository.ts`
- `src/data/repositories/AppointmentRepository.test.ts`
- `src/domain/appointmentSummary.ts`
- `src/main.tsx`
- `src/pages/PatientsPage.tsx`
- `src/pages/PatientsPage.test.tsx`
- `src/pages/SchedulePage.tsx`
- `src/utils/storage.ts`
- `src/utils/storage.test.ts`

Report:

- `_ai_work/REPORTS/SCHEDULE-SOURCE-OF-TRUTH-CONSOLIDATION-001_consolidation.md`

## Pre-read

Primary reports reviewed:

- `_ai_work/REPORTS/SCHEDULE-OPERATIONS-RECON-001_recon.md`
- `_ai_work/REPORTS/LEGACY-CORE-TABLE-GRANTS-RECOVERY-001_recovery.md`
- `_ai_work/REPORTS/APPOINTMENT-CONFLICT-HARDENING-001_hardening.md`

Architecture reviewed:

- `_ai_work/SOURCES/03_MULTI_TENANT_ARCHITECTURE_RULES.md`
- `_ai_work/SOURCES/04_DATA_ISOLATION_AND_SECURITY.md`
- `_ai_work/SOURCES/05_MEDICAL_DOMAIN_MODEL.md`
- `_ai_work/SOURCES/08_APPOINTMENTS_AND_SCHEDULE.md`
- `_ai_work/SOURCES/11_BACKEND_AND_API_ARCHITECTURE.md`
- `_ai_work/SOURCES/14_UI_UX_RULES.md`
- `_ai_work/SOURCES/18_TESTING_AND_QUALITY_ASSURANCE_STRATEGY.md`

The repository, hooks, aggregators, components, storage bootstrap, every `storage.getAppointments` call, every appointment repository method, and all current appointment-derived UI consumers were inspected before code changes.

## Original reader inventory

| Reader / consumer | Original source | Tenant scope | Patient scope | Original behavior | Classification | Reachable |
|---|---|---:|---:|---|---|---:|
| `SchedulePage` / `useScheduleAppointments` | selected repository | Supabase repository scoped when tenant existed | no | ascending schedule list; no-tenant Supabase could resolve local repository | mixed with latent fallback | yes |
| `PatientHistoryTab` / `usePatientAppointments` | `LocalStorageAppointmentRepository` | no | local filter only | descending history, including cancelled rows | localStorage only | yes |
| `PatientsPage` / `usePatientListVisitSummary` / aggregator | `LocalStorageAppointmentRepository` | no | grouped in memory | previous/next from browser-local array | localStorage only | yes |
| patient overview / `usePatientMedicalSummary` | configured repository | mixed | fetched all appointments, then filtered | duplicated previous/next logic; Supabase no-tenant selected local | mixed | yes |
| patient timeline / `usePatientTimeline` | configured repository | yes when Supabase tenant existed | yes | repository-backed, but no tenant/patient query identity | Supabase authoritative with stale-context gap | yes |
| `/appointments` placeholder | none | n/a | n/a | no operational reader | dead/placeholder | yes, but no appointment data |
| local repository tests and explicit dev mode | localStorage | browser-local | optional local filter | intentional development backend | local-only/test-only | yes in dev only |
| `storage.ts` appointment mutation helpers | `df_appointments` | no | n/a | explicit local adapter support | local backend implementation | reachable only in dev |

No other reachable production component directly called `storage.getAppointments()` outside the local repository adapter after consolidation.

## Original contradictions

- SchedulePage could show Supabase rows while patient history showed unrelated browser-local demo rows.
- Patient-list previous/next values could disagree with SchedulePage after create, edit, cancel, reload, or tenant change.
- Medical summary fetched all clinic appointments and calculated another copy of previous/next semantics.
- Supabase-active readers could silently select local storage when tenant context was absent.
- Timeline and patient summary queries did not consistently bind visible data to user, tenant, and patient identity.
- `storage.init()` created `df_appointments` in a fresh configured browser even though writes and schedule reads used Supabase.
- Status/date rules were duplicated, including inconsistent cancelled handling and unstable equal-time ordering.

## Chosen authoritative read contract

The existing repository contract was sufficient. No RPC or schema change was required.

- `listAppointments()` returns all rows for the active tenant, ordered by `start_time ASC, id ASC`.
- `listAppointmentsByPatient(patientId)` returns rows matching both active `tenant_id` and `patient_id`, ordered by `start_time DESC, id ASC`.
- Both methods preserve cancelled appointments as historical facts.
- Supabase read failures are mapped to safe domain text and never trigger another backend.
- The local repository implements the same interface only for explicit `dev` mode.
- The repository factory throws `Клиника не выбрана.` when asked for Supabase without a tenant instead of returning the local adapter.

Simple previous/next summaries are calculated in typed application code from one authoritative fetch. Query-specific next/latest RPCs were not added because current dataset and architecture did not justify another database contract.

## Backend-selection behavior

Configured `supabase-active` mode:

- authenticated user + active tenant: Supabase repository;
- no user or no tenant: query disabled, empty current-context state, no local fallback;
- read error: safe error state, no local merge or fallback.

Explicit `dev` mode:

- local repository selected;
- local demo appointments remain supported intentionally;
- no Supabase appointment request occurs.

Supabase and local appointment arrays are never merged.

## Patient appointment hook

`usePatientAppointments(patientId)` now binds the query to:

- auth mode;
- authenticated user ID;
- tenant ID;
- patient ID.

Its query identity is `authMode:userId:tenantId:patientId`. Missing patient disables the query. Missing session or tenant in Supabase-active mode disables the query. Identity changes reset visible data before the replacement request resolves. Late patient, tenant, session, route, and unmount responses cannot commit to the new context.

Cancelled rows remain returned for history. Errors expose only `Не удалось загрузить записи пациента.`

## Patient history integration

`PatientHistoryTab` consumes the authoritative patient appointment hook.

Verified behavior:

- a SchedulePage-created row appears in patient history;
- edited time and status replace the prior values;
- cancelled rows remain visible;
- hard-deleted rows remain subject to the existing delete behavior and would disappear on refetch;
- tenant and patient changes clear prior rows before new results;
- loading, empty, and safe error states are rendered;
- appointment history remains distinct from visits, encounters, and completed services.

## Patient-list summary integration

`usePatientListVisitSummary` creates one repository for the current context, calls `listAppointments()` once, and passes the resulting tenant array to the pure `PatientListVisitSummaryAggregator`.

The aggregator performs one in-memory grouping operation for all patient rows. It has no storage or repository dependency and therefore cannot cause per-patient requests. UI values show `…` while loading and neutral `Недоступно` on failure; local stale dates are not displayed.

The labels were corrected from visit terminology to `Предыдущая запись` and `Следующая запись` because an appointment is not a visit or encounter.

## Patient-card and medical summaries

`ClinicalSummaryAggregator` now requests `listAppointmentsByPatient(patientId)` rather than reading every tenant appointment and filtering afterward. It uses the same shared selector as the patient-list summary.

`usePatientMedicalSummary` now binds to auth mode, user, tenant, and patient identity, disables Supabase reads without tenant/session, and exposes a safe summary error without local fallback.

The overview labels are `Записи`, `Предыдущая`, and `Следующая`. Timeline appointment events continue to use the authoritative patient-scoped repository and now receive full stale-context protection.

## Date and status semantics

The shared selector in `src/domain/appointmentSummary.ts` defines the policy:

- comparison uses JavaScript `Date` epoch values derived from database timestamptz/application timestamps;
- exact `start == now` is upcoming;
- a row with `start < now` is a previous appointment fact;
- an ongoing row whose start is already past is therefore treated as previous under the explicit start-time policy;
- cancelled rows are excluded from both previous and upcoming summary values but remain in history;
- future cancelled, completed, no-show, and blocked rows are excluded from upcoming as terminal or non-patient-actionable facts;
- past no-show rows are included as previous appointment facts;
- blocked rows and rows without `patientId` are ignored for patient summaries;
- earliest eligible future row is next;
- latest eligible past row is previous;
- equal start times use appointment ID as a stable tie-breaker;
- no database status or lifecycle was modified.

## Storage bootstrap behavior

`storage.init()` accepts `includeAppointments`. `main.tsx` passes `false` when Supabase is configured and `true` only for explicit local/dev mode.

Configured mode:

- does not create `df_appointments` in a fresh browser;
- does not read, merge, or mutate `df_appointments` during Supabase appointment CRUD;
- leaves any pre-existing user browser data untouched rather than deleting it automatically;
- may continue initializing unrelated legacy demo domains, which were outside this task.

Explicit local mode continues to initialize and use demo appointments.

## Stale-context protection

Appointment-related asynchronous readers now use query keys containing all material context:

- schedule: auth mode + user ID + tenant ID;
- patient appointments: auth mode + user ID + tenant ID + patient ID;
- patient-list summary: auth mode + user ID + tenant ID;
- medical summary: auth mode + user ID + tenant ID + patient ID;
- timeline: auth mode + user ID + tenant ID + patient ID + archived filter.

The existing `useAsyncQuery` generation guard rejects results after identity changes, disable, unmount, overlapping refetch, or route change. Visible data is reset immediately on key change, preventing tenant-A or patient-A flashes in tenant-B or patient-B views.

## Error handling

Safe user-visible errors:

- schedule: `Не удалось загрузить расписание.`
- patient history: `Не удалось загрузить записи пациента.`
- patient-list summary: neutral `Недоступно`
- medical summary: `Не удалось загрузить сводку пациента.`

No SQLSTATE, PostgREST payload, table name, policy name, stack trace, service-role token, or raw server error is rendered. Error handling never switches to localStorage.

## Checks

- reader inventory completed before implementation;
- no reachable Supabase-active localStorage appointment reader remains;
- no silent fallback or Supabase/local array merge;
- tenant and patient stale-response protection passed unit and browser checks;
- targeted suite: 12 files / 85 tests passed;
- full suite: 86 files / 922 tests passed;
- lint passed;
- production build passed;
- `0024` grants regression passed;
- `0025` appointment hardening SQL and concurrency passed;
- authenticated browser smoke passed;
- Chrome DevTools MCP configured-mode validation passed;
- cleanup and final zero-row verification passed;
- implementation CI on exact reviewed head passed.

## Repository tests

Repository coverage verifies:

- tenant filter on full list;
- tenant + patient filters on patient list;
- deterministic two-column ordering;
- empty results map to empty arrays;
- safe schedule and patient read errors;
- no localStorage reference inside the Supabase repository;
- local repository remains functional when explicitly selected;
- cancelled rows are returned;
- mapping preserves status and `updatedAt`;
- cross-tenant data cannot be introduced by repository filters;
- Supabase-without-tenant cannot silently return the local adapter;
- existing hardened write RPC and hard-delete behavior remains unchanged.

## Hook tests

Hook tests verify:

- Supabase-active mode selects Supabase with tenant scope;
- dev mode selects the local repository;
- missing tenant, session, or patient prevents fetch;
- tenant and patient changes refetch;
- stale tenant and patient responses are ignored;
- errors do not trigger local fallback;
- loading, empty, disabled, and safe-error states;
- cancelled history rows are retained;
- late unmount results are ignored;
- schedule, medical summary, and timeline compatibility.

## Aggregator tests

Aggregator tests verify:

- earliest eligible future row;
- cancelled future exclusion;
- completed/no-show future exclusion;
- latest eligible past row;
- exact-now boundary;
- no-show past inclusion;
- cancelled past exclusion;
- multiple-patient grouping;
- stable equal-time ID ordering;
- blocked/no-patient exclusion;
- no-appointment null state;
- one supplied appointment array supports all patient rows without repository calls or N+1 behavior.

## UI tests

UI tests verify:

- Supabase appointment row rendering in patient history;
- cancelled history rendering;
- loading, empty, and safe error states;
- authoritative previous/next dates in the patient list;
- neutral unavailable state after summary failure;
- patient overview uses appointment terminology and the same dates;
- SchedulePage and AppointmentModal retain compatibility with the hardened write flow.

Final targeted result: 12 files / 85 tests passed.

## Browser smoke

Environment:

- clean local Supabase after migrations `0001` through `0025`;
- real local Supabase Auth users;
- tenant A and tenant B;
- tenant-scoped patients and doctors;
- configured Supabase Vite application;
- isolated Chromium browser sessions;
- no committed fixtures.

Full authenticated Chromium/Playwright smoke through Hermes verified:

1. **Create consistency**
   - SchedulePage created one appointment through the existing hardened RPC.
   - authoritative appointment ID: `a2744fa4-ca25-4abf-b0ad-5652a07e3f88`;
   - the same unique row appeared in schedule, patient-list summary, patient overview, and patient history;
   - all views remained consistent after reload.

2. **Edit consistency**
   - the same appointment ID moved from 19:00 to 18:00 and status changed to `arrived`;
   - schedule, summary, and history reflected the new values after refetch/reload;
   - no duplicate appointment was created.

3. **Cancellation**
   - the same row changed to `cancelled`;
   - it remained visible in patient history and schedule;
   - it disappeared from upcoming summary;
   - no lifecycle redesign or replacement row occurred.

4. **Tenant isolation**
   - tenant B schedule, patient list, card, and history showed only tenant-B markers;
   - tenant-A markers never appeared;
   - delayed tenant-A results did not flash after switching to tenant B.

5. **Patient switch**
   - patient-A response was deliberately delayed;
   - the UI switched to patient A2 before A completed;
   - A rows never appeared in A2, before or after the delayed response resolved.

6. **Configured localStorage proof**
   - fresh configured browser: `df_appointments=null`;
   - after real create/edit/cancel/details operations: `df_appointments=null`;
   - Supabase CRUD did not mutate the key.

7. **Explicit local mode**
   - a separate unconfigured Vite instance displayed demo appointments from `df_appointments`;
   - no Supabase appointment request occurred.

No fatal console errors, raw SQL, stack traces, secrets, or service-role material appeared. Temporary delay shims, probe pages, screenshots, logs, and browser processes were removed.

## Chrome DevTools MCP validation

The mandatory Chrome DevTools MCP check was executed with:

- server: `chrome_devtools`;
- title: `Chrome DevTools MCP server`;
- version: `1.5.0`;
- headless isolated Chrome context;
- configured app URL: `http://127.0.0.1:5207/`;
- local Supabase URL resolved by the application client: `http://127.0.0.1:54321`.

MCP confirmed before any diagnostic request:

- configured login UI rendered;
- `df_initialized="true"`;
- `df_appointments=null`;
- no `/rest/v1/appointments` request occurred without authenticated tenant context;
- console error/issue list was empty;
- no external `supabase.co` endpoint, SQLSTATE, or service_role text appeared.

A separate deliberate anonymous diagnostic call through the configured Supabase client completed against the local endpoint and received the expected authorization error. That post-snapshot QA request was not an application fallback or production reader call and was kept separate from the clean-console assertion.

## Network validation

Authenticated network probes verified:

- patient-list summary performs one appointments GET with `tenant_id=eq.<active tenant>` and no patient filter;
- patient history performs one appointments GET with both `tenant_id=eq.<active tenant>` and `patient_id=eq.<patient>`;
- one tenant-wide fetch supports multiple patient rows;
- no per-patient request flood occurred;
- no service_role was present;
- no unexpected direct INSERT or UPDATE replaced the existing hardened RPC writes;
- create, reschedule, details, and delete behavior remained on the pre-existing appointment write contract.

## Database validation

Before cleanup:

- three QA appointment rows had three distinct IDs;
- the main browser-created ID existed exactly once;
- the main row had the final `cancelled` status and edited time;
- tenant, patient, doctor, status, and time matched UI assertions;
- operation rows for the main appointment were one `create` and one `reschedule`;
- audit rows were one `appointment_created` and one `appointment_rescheduled`;
- activity rows matched those two events;
- readers created no duplicate appointment and performed no database mutation.

The unique main ID and deterministic SchedulePage test selector were used to trace the edited/cancelled schedule card; patient views read the same unique tenant/patient database row.

## No-localStorage proof

Evidence from unit tests, configured browser sessions, network probes, and Chrome DevTools MCP agrees:

- all `storage.getAppointments()` calls remain inside `storage.ts` and the explicit local repository adapter;
- no reachable Supabase-active reader imports the local appointment repository directly;
- fresh configured browser does not receive demo appointment facts;
- configured reads and writes leave `df_appointments` absent;
- Supabase errors do not trigger a local read or array merge;
- explicit dev mode still uses local appointments intentionally.

## Side-effect validation

The following remained unchanged and had zero QA rows before cleanup:

- patient visits;
- clinical encounters;
- completed services;
- treatment plans;
- findings;
- dental charts;
- invoices and invoice items;
- payments and allocations;
- refunds;
- financial adjustments;
- documents.

Appointment write RPC definitions, appointment operation records, conflict locks, grants, RLS behavior, hard delete, reminders, waitlist, documents, finance, amoCRM, and all adjacent clinical workflows were not redesigned.

## Cleanup

Removed:

- QA Auth users;
- tenant A and tenant B;
- memberships;
- patients and doctors;
- appointments and operation rows;
- audit/activity rows;
- temporary response-delay and network probe code;
- temporary HTML harnesses;
- screenshots and logs;
- configured and dev Vite processes;
- Chrome DevTools MCP temporary clients and isolated browser data.

Final command:

`npx supabase db reset --no-seed`

Final zero-row verification:

- auth users: 0;
- tenants: 0;
- patients: 0;
- doctors: 0;
- appointments: 0;
- appointment operations: 0;
- audit events: 0;
- activity events: 0.

## Lint, tests, and build

Final implementation checks:

- `npm run lint`: passed;
- `npm run test -- --run`: 86 files / 922 tests passed;
- `npm run build`: passed;
- targeted appointment reader/UI suite: 12 files / 85 tests passed.

Existing unrelated React `act(...)` warnings and the existing Vite bundle-size warning remain. They did not fail the test or build commands and were not introduced by this task.

Appointment regression checks:

- `0024_legacy_core_table_grants_test.sql`: passed;
- `0025_appointment_conflict_hardening_test.sql`: passed;
- `0025_appointment_conflict_concurrency.ps1`: passed;
- final concurrency result: 0 doctor overlaps, 0 patient overlaps, 0 invalid intervals, 0 deadlocks.

One preliminary SQL invocation through a PowerShell text pipe corrupted Cyrillic expectations. The unchanged test files were rerun by copying their original UTF-8 bytes into the database container and passed. This was a command-encoding issue, not a repository failure.

## Fresh CI

Implementation CI:

- workflow: `CI`;
- run: `#701`;
- run ID: `29183273692`;
- conclusion: `success`;
- tested commit: `35046311399ad973142a3f8427aeed56853aa81e`;
- validate job passed ESLint, tests, and build.

A fresh CI run on the final report-only PR head is required after this report update. The PR must remain open and unmerged.

## Issues / limitations

- Internal compatibility field names `lastVisit` and `nextVisit` remain in some component contracts, although the UI and documented semantics now correctly call them appointments.
- Patient-list summary intentionally performs one tenant-wide appointment fetch. This removes N+1 behavior but may eventually justify a server-side read model if tenant appointment volume becomes large.
- Summary semantics are start-time based; ongoing appointment classification is not a lifecycle engine.
- Existing broad appointment role policies, cabinet free text, hard delete, and schedule filtering behavior remain unchanged.
- Existing unrelated React test warnings and bundle-size warning remain.

## What was intentionally not implemented

- no migration or new table;
- no new RPC;
- no appointment write change;
- no status lifecycle redesign;
- no hard-delete redesign;
- no confirmation workflow;
- no cancellation/no-show reason model;
- no reminders;
- no waitlist;
- no week/month view;
- no role-policy redesign;
- no clinic resource model;
- no finance or clinical mutation;
- no cloud Supabase apply;
- no generated types;
- no package change;
- no HEP-V2 work.

## Recommended next task

**APPOINTMENT-CANCELLATION-NOSHOW-001**

Reason: all operational screens now read the same appointment facts, so cancellation and no-show can add reasons, actor, timestamps, and audit history without different parts of the application disagreeing about the underlying row.
