# SCHEDULE-OPERATIONS-RECON-001: Appointment and schedule reconciliation

## Final verdict

**PARTIAL**

PARTIAL: authenticated table grants block Supabase schedule CRUD and role browser verification.

The repository, local database and real browser were inspected at baseline `dbdb1b0b4fd357776d021bbfc1671441e48c9c06`. The current schedule implementation is mapped with enough evidence to answer the operational questions and identify the next dependency task. However, a clean local Supabase deployment cannot load tenant membership or perform appointment CRUD because the legacy core tables created in migration `0001_initial_schema.sql` have no `SELECT`/`INSERT`/`UPDATE`/`DELETE` grants for `authenticated` or `service_role`. That blocker prevents completion of the required Supabase role-specific create/edit/cancel/cross-tenant browser smoke.

The schedule-specific integrity finding is also confirmed: if table access exists, PostgreSQL currently accepts exact overlaps, partial overlaps, simultaneous conflicting moves, duplicate retries, zero-duration appointments and negative-duration appointments.

## Summary

The product already has a substantial schedule UI. The real implementation is `SchedulePage` on `/`, with a day grid, doctor columns, filters and one appointment modal. A second sidebar route, `/appointments`, renders only a placeholder page. Rebuilding the calendar would therefore duplicate existing work, a ceremony humans perform whenever the existing module has an inconvenient name.

The intended production source of truth is `public.appointments` through `SupabaseAppointmentRepository`. The schedule context stores presentation state only. Dev mode uses `localStorage` key `df_appointments`. Two reachable patient-facing paths still contradict the production model: `usePatientAppointments` and `PatientListVisitSummaryAggregator` always read localStorage, while schedule, timeline and clinical summary can read Supabase.

Current appointment writes are direct PostgREST table mutations. There is no appointment RPC, transaction boundary, operation key, conflict lock, exclusion constraint, audit trigger or history table. The only overlap check is inside `AppointmentModal`, against the browser's currently loaded array. It protects doctor and the free-text `cabinet` string using half-open interval semantics and ignores cancelled rows. It does not protect the patient, and it cannot protect against another browser or concurrent request.

Two P0 defects were confirmed:

1. Clean-deployment legacy table grants prevent authenticated use of tenant membership, patients, doctors and appointments.
2. The appointments table has no authoritative slot, interval or duplicate protection.

The first implementation task must repair the explicit grants contract for the legacy core tables because appointment-only grants would still leave `TenantContext`, patients and doctors inaccessible. The next schedule-specific task after that is `APPOINTMENT-CONFLICT-HARDENING-001`.

## Branch

`recon/schedule-operations-recon-001`

## PR URL

https://github.com/NckNA/codex-test/pull/345

## Baseline

- Required baseline: `dbdb1b0b4fd357776d021bbfc1671441e48c9c06`.
- `origin/main` at task start: `dbdb1b0b4fd357776d021bbfc1671441e48c9c06`.
- PR #344 was verified merged into this commit.
- The source checkout and report worktree were clean before audit work.

## PR head reviewed before final report update

- implementation/report head reviewed: `6552f5e1509c5f48db3c51b8dc26e8820c5a7cd1`;
- workflow: `CI`;
- run: `#692`;
- run ID: `29162177217`;
- conclusion: `success`;
- tested commit matched the reviewed PR head.

## Report update commit

N/A because the final report update commit cannot reference itself before creation.

- Report update commit: N/A (the report commit cannot reference itself; use the finalization receipt).
- The final report-only commit and its fresh CI run are recorded in the finalization receipt, PR body, and final task response after push.

## Changed files

Expected final repository diff:

- `_ai_work/REPORTS/SCHEDULE-OPERATIONS-RECON-001_recon.md`

No application, migration, generated type, seed, package or lock file is changed.

## Sources reviewed

Architecture and operating rules:

- `_ai_work/SOURCES/00_PROJECT_MASTER_CONTEXT.md`
- `_ai_work/SOURCES/02_ROLES_AND_PERMISSIONS.md`
- `_ai_work/SOURCES/03_MULTI_TENANT_ARCHITECTURE_RULES.md`
- `_ai_work/SOURCES/04_DATA_ISOLATION_AND_SECURITY.md`
- `_ai_work/SOURCES/05_MEDICAL_DOMAIN_MODEL.md`
- `_ai_work/SOURCES/08_APPOINTMENTS_AND_SCHEDULE.md`
- `_ai_work/SOURCES/11_BACKEND_AND_API_ARCHITECTURE.md`
- `_ai_work/SOURCES/14_UI_UX_RULES.md`
- `_ai_work/SOURCES/18_TESTING_AND_QUALITY_ASSURANCE_STRATEGY.md`

Current-state sources:

- `_ai_work/REPORTS/POST-FINANCE-ROADMAP-RECON-001_roadmap.md`
- appointment DAL reports `ARCH-035` through `ARCH-041`
- `RECON-APPOINTMENT-REAL-001`
- `RECON-APPOINTMENT-REAL-002`
- `APPOINTMENT-REAL-001A`
- `APPOINTMENT-REAL-001B`
- `NO-TENANT-DATA-BOUNDARY-001`
- `MULTITENANT-QA-001`
- `_ai_work/PROJECT_ROUTES.md`
- `_ai_work/ARCHITECTURE_CURRENT.md`
- all current appointment/schedule repository, hook, component and test files
- all migrations through `0023_harden_patient_credit_intake.sql`
- current GitHub PR history through PR #344

## Current route inventory

| Route / entry | Actual component | Reachable | Sidebar | Role gate | Current result |
|---|---|---:|---:|---|---|
| `/` | `SchedulePage` | Yes | `Расписание` | None | Working day schedule UI |
| `/appointments` | `AppointmentsPage` | Yes | `Приёмы` | None | Placeholder: appointment management “will be implemented” |
| patient card `history` tab | `PatientHistoryTab` | Yes | Through Patients | Patient page access only | Reads localStorage appointments only |
| patient timeline tab | `PatientTimelineTab` through `usePatientTimeline` | Yes | Through Patients | Timeline visibility filter | Can read Supabase appointments |
| patient overview medical summary | `usePatientMedicalSummary` | Yes | Through Patients | Patient page access only | Can read Supabase appointments for last/next dates |
| doctor page | `DoctorsPage` | Yes | `Врачи` | None | Placeholder; no schedule entry |
| clinic-specific schedule view | None | No | No | N/A | Not implemented |

Findings:

1. `SchedulePage` is the actual schedule and is mounted at the root route.
2. `AppointmentsPage` is a separate placeholder, not an alternative implementation.
3. Both routes are exposed in the sidebar to every clinic role.
4. Appointment creation exists only in the schedule grid/modal.
5. An edited appointment can navigate to the patient's card.
6. The patient card can display appointments, but the `history` tab reads the wrong backend in Supabase mode.
7. No doctor-specific or clinic-capacity route exists.
8. `PROJECT_ROUTES.md` and `App.tsx` agree about which route is implemented, but sidebar wording makes the placeholder look like the main appointment module.

## Current UI inventory

| Capability | Component/state owner | Persistence caller | Role gate | Tests | Limitation |
|---|---|---|---|---|---|
| Selected date | `ScheduleProvider` | None | None | Context indirectly covered | Presentation only |
| Day/week/month mode | `ScheduleProvider`, Header | None | None | Header/component coverage | Only day renders schedule; week/month are future placeholders |
| Doctor filter | Header + context | None | None | Header tests | All doctors visible to all roles |
| Status filter | Header + context | None | None | Header tests | No lifecycle restrictions |
| Source filter | Header + context | None | None | Header tests | UI-only |
| Search field | Header | None | None | Header tests | Label says demo; does not search schedule |
| Day grid | `SchedulePage` | Read hook | None | No dedicated SchedulePage test | Fixed 09:00–20:00, 30-minute slots |
| Create | `AppointmentModal` | `useScheduleAppointments.createAppointment` | None | Modal/hook mocked tests | Browser-array conflict check only |
| Edit | `AppointmentModal` | `updateAppointment` | None | Modal/hook mocked tests | Full-row overwrite, no history |
| Reschedule | Edit start/end in place | `updateAppointment` | None | None | Silent move, no reason or previous time |
| Cancellation | Quick status `cancelled` | generic update | None | None | No reason, actor or timestamp |
| No-show | Quick status `no_show` | generic update | None | None | No reason/timestamp/counter |
| Confirmation | Quick status `confirmed` | generic update | None | None | No channel/timestamp/actor |
| Arrival | Quick status `arrived` | generic update | None | None | Not check-in; no arrival timestamp |
| In progress | Quick status | generic update | None | None | Not linked to encounter start |
| Completed | Quick status | generic update | None | Timeline boundary test | Scheduling status only |
| Hard delete | Modal delete button | direct table delete/localStorage delete | Button shown to all roles | Hook mocked test only | Historical row disappears |
| Drag/drop | None | None | N/A | None | Not implemented |
| Room/chair selection | Free-text `cabinet` | appointment row | None | None | No resource entity or FK |
| Service selection | Free-text `service` | appointment row | None | None | No service entity or FK |
| Duration | Calculated from start/end | appointment row | None | None | No positive-duration validation |
| Notes | Single `comment` textarea | appointment row | None | None | No privacy/role distinction |
| Appointment details | Same edit modal | Read appointment object | None | Modal tests | No immutable history |

The schedule also displays three hard-coded “tasks for today”. They are not persisted tasks, reminders or communication jobs.

## Source-of-truth matrix

| Fact/state | Current source | Classification | Notes |
|---|---|---|---|
| selected date | `ScheduleContext` | React context only | Presentation state |
| view mode | `ScheduleContext` | React context only | Day/week/month selection |
| doctor/status/source filters | `ScheduleContext` | React context only | Presentation state |
| modal open/edit target | `SchedulePage` state | Component-local | Cleared when modal closes |
| schedule appointment list | repository selected by `useScheduleAppointments` | Mixed | Supabase when fully configured with tenant; otherwise localStorage |
| patient history appointment list | `LocalStorageAppointmentRepository` | localStorage only | Contradicts Supabase schedule in configured mode |
| patient list visit summary | `LocalStorageAppointmentRepository` | localStorage only | Contradicts Supabase schedule |
| patient timeline appointments | configured repository | Mixed | Correctly blocks no-tenant Supabase path |
| medical last/next appointment | configured repository | Mixed/calculated | Uses appointment start and ignores blocked/cancelled |
| patient | `patients` repository / local seed | Mixed | Required only by modal UI, nullable in DB |
| doctor/provider | `doctors` repository / local seed | Mixed | Nullable in DB |
| service | appointment free text | Supabase/localStorage fact | Not a referenced service |
| start/end | appointment row/object | Supabase/localStorage fact | Timestamptz in DB, strings in TS |
| duration | `end - start` | Calculated | DB accepts zero/negative |
| status | appointment row/object | Supabase/localStorage fact | Generic text check only |
| notes | appointment `comment` | Supabase/localStorage fact | One unrestricted text field |
| confirmation | `status='confirmed'` only | Partial persisted convention | No workflow metadata |

## Schedule context responsibilities

`ScheduleProvider` owns only:

- selected date;
- view mode;
- doctor filter;
- status filter;
- source filter.

It does not own appointment facts or write persistence. That separation is correct.

`useScheduleAppointments` owns appointment loading and mutations. It resolves a repository from auth/tenant state. In Supabase-active mode without an active tenant it currently resolves the local repository because the backend condition fails; however the normal app shell blocks no-tenant users before the schedule is mounted. This is a latent fallback hazard rather than a currently reachable schedule screen.

Generic `useAsyncQuery` has request-generation and query-key stale-response protection. Schedule uses the default `queryKey=null`; a new repository/query callback triggers a new execution, and the generation guard prevents an earlier request from committing after a later execution. A delayed-response browser experiment was not possible without source instrumentation, and Supabase mode was blocked by grants.

## Appointment repository contract

Interface methods:

- `listAppointments()`
- `listAppointmentsByPatient(patientId)`
- `createAppointment(appointment)`
- `updateAppointment(appointment)`
- `deleteAppointment(appointmentId)`

Local implementation:

- reads/writes `df_appointments` in browser localStorage;
- mutations are synchronous storage operations wrapped in promises;
- data is isolated per browser profile, not per tenant.

Supabase implementation:

- `GET /rest/v1/appointments` via direct `.select()`;
- `POST /rest/v1/appointments` via direct `.insert()`;
- `PATCH /rest/v1/appointments` via direct `.update()`;
- `DELETE /rest/v1/appointments` via direct `.delete()`;
- every query includes `tenant_id` filtering in repository code;
- there is no RPC, server operation key, recovery lookup or audit call.

The row mapper writes the full appointment object. Update does not set `updated_at`, and the table has no update trigger, so `updated_at` remains stale.

## Database schema

Exact live `public.appointments` schema:

| Column | Type | Null | Default | FK/check/index | Application use |
|---|---|---:|---|---|---|
| `id` | uuid | No | `gen_random_uuid()` | PK | UI supplies UUID on create |
| `tenant_id` | uuid | No | none | FK tenants, tenant index | Repository scope |
| `patient_id` | uuid | Yes | null | composite FK with tenant | Selected patient; blocked rows may omit |
| `doctor_id` | uuid | Yes | null | composite FK with tenant | Schedule column/provider |
| `cabinet` | text | Yes | null | none | Free-text display/conflict key |
| `service` | text | Yes | null | none | Free-text visit reason/service label |
| `status` | text | No | `new` | status CHECK | Quick status buttons/filter |
| `payment_type` | text | Yes | null | payment type CHECK | Optional UI value |
| `source` | text | Yes | null | source CHECK | Filter/display |
| `price` | numeric | Yes | null | none | Expected price only |
| `comment` | text | Yes | null | none | One unrestricted note |
| `start_time` | timestamptz | No | none | none | Schedule interval |
| `end_time` | timestamptz | No | none | none | Schedule interval |
| `created_at` | timestamptz | Yes | `now()` | none | Preserved by mapper |
| `updated_at` | timestamptz | Yes | `now()` | no trigger | Not updated by repository |

Present statuses:

`new`, `confirmed`, `arrived`, `in_progress`, `completed`, `cancelled`, `no_show`, `blocked`.

Absent appointment fields/entities:

- room/chair/resource ID;
- appointment type ID;
- duration column;
- cancellation reason/time/actor;
- confirmation time/channel/actor;
- arrival/no-show time/reason;
- archive/delete markers;
- created_by/updated_by;
- metadata;
- reschedule chain/history;
- operation/idempotency key;
- reminder or waitlist relation.

Indexes are only PK, `tenant_id`, and `patient_id`. There is no doctor/time/status index or exclusion constraint. `btree_gist` is available in the PostgreSQL image but is not installed.

## RLS and tenant isolation

RLS is enabled on appointments.

Intended policies:

- SELECT: any user whose `get_user_tenants()` contains `tenant_id`;
- INSERT: any tenant member;
- UPDATE: any tenant member;
- DELETE: only `clinic_admin` or `clinic_owner`.

These policies provide row filtering only after table privileges exist. They do not provide same-tenant relationship integrity, conflict detection or lifecycle validation.

Clean-reset grant result for `tenants`, `profiles`, `tenant_users`, `patients`, `doctors`, and `appointments`:

- `authenticated SELECT=false`;
- `authenticated INSERT=false`;
- `authenticated UPDATE=false`;
- `authenticated DELETE=false`;
- `service_role SELECT=false`;
- `service_role INSERT=false`.

A real local PostgREST admin insert returned PostgreSQL code `42501`, `permission denied for table appointments`. A real browser login then failed on `GET /rest/v1/tenant_users` with 403 before the app could establish an active tenant.

Therefore the RLS design cannot currently be exercised from a clean deployment. Cloud state was not inspected and may contain drift not represented in Git.

## Relationship integrity

| Relationship/invariant | Database result |
|---|---|
| tenant exists | Enforced by FK |
| patient belongs to same tenant | Enforced by composite FK `(tenant_id, patient_id)` |
| doctor belongs to same tenant | Enforced by composite FK `(tenant_id, doctor_id)` |
| cross-tenant patient insert | Blocked in local test |
| cross-tenant doctor insert | Blocked in local test |
| cross-tenant patient update | Blocked in local test |
| cross-tenant doctor update | Blocked in local test |
| cabinet belongs to tenant | Not enforceable; cabinet is text |
| room/chair/equipment belongs to tenant | Not modelled |
| service belongs to tenant | Not modelled; service is text |
| patient active/not archived | Not enforced |
| doctor active | Not enforced |

A controlled transaction successfully inserted an appointment for a patient with `status='archived'` and a doctor with `active=false`. The transaction was rolled back.

## Current CRUD contract

| Operation | Component/hook | Repository write | Transaction | Authorization | Conflict | Audit/history | Refresh/stale handling |
|---|---|---|---|---|---|---|---|
| create | Modal → SchedulePage → hook | direct INSERT/localStorage add | None | Intended tenant-member RLS | modal browser-array check | None | await then refetch |
| edit | Modal → hook | direct UPDATE/full local overwrite | None | Intended tenant-member RLS | same modal check, excludes self | None | await then refetch |
| reschedule | Same edit | direct UPDATE start/end | None | Same as update | same client check | None | silent overwrite |
| status change | Quick button + save | generic UPDATE | None | Same as update | cancelled skips checks | None | refetch |
| cancel | choose `cancelled` + save | generic UPDATE | None | Same as update | frees client slot | No reason/time/actor | refetch |
| confirm | choose `confirmed` + save | generic UPDATE | None | Same as update | normal active conflict behavior | No metadata | refetch |
| arrived | choose `arrived` + save | generic UPDATE | None | Same as update | normal active conflict behavior | No metadata | refetch |
| no-show | choose `no_show` + save | generic UPDATE | None | Same as update | still blocks slot | No metadata | refetch |
| complete | choose `completed` + save | generic UPDATE | None | Same as update | still blocks slot | No clinical mutation | refetch |
| delete | modal delete | direct DELETE/localStorage delete | None | Intended admin/owner RLS; UI visible to all | N/A | Hard deletion | refetch |

Errors from save/delete are logged in `SchedulePage`; the modal does not present a dedicated server error state. The hook exposes `saveError`, but SchedulePage does not display it.

## Status lifecycle

| Status | Russian label | Entry rule today | Previous/next restriction | Required metadata | Terminal | Enforced by DB |
|---|---|---|---|---|---:|---:|
| `new` | Новая | Any edit | None | None | No | Value only |
| `confirmed` | Подтвержден | Any edit | None | None | No | Value only |
| `arrived` | Пришел | Any edit | None | None | No | Value only |
| `in_progress` | В работе | Any edit | None | None | No | Value only |
| `completed` | Завершен | Any edit | None | None | No | Value only |
| `cancelled` | Отменен | Any edit/new record | None; reversible | None | No | Value only |
| `no_show` | Не пришел | Any edit | None; reversible | None | No | Value only |
| `blocked` | Блок | Seed/direct data | Not offered in quick buttons | None | No | Value only |

All visible statuses can transition to all other visible statuses. `blocked` exists in TypeScript/DB/rendering but is not selectable in the modal. Source-document concepts `scheduled`, `draft`, `rescheduled` and `waiting` are not implemented. Database concept `new` substitutes for scheduled/unconfirmed.

No status creates a visit, encounter, completed service, invoice, payment, diagnosis, treatment-plan change or dental-chart change. This boundary is correct.

## Conflict checks

| Resource | Current check | Interval | Status handling | Tenant/edit handling | Race-safe |
|---|---|---|---|---|---:|
| doctor | Modal array comparison | `newStart < oldEnd && newEnd > oldStart` | ignores cancelled only | loaded list is tenant-scoped; excludes same ID | No |
| patient | None | N/A | N/A | N/A | No |
| cabinet | Exact free-text equality in modal | Same half-open overlap | ignores cancelled only | excludes same ID | No |
| room | Not modelled | N/A | N/A | N/A | No |
| chair | Not modelled | N/A | N/A | N/A | No |
| equipment | Not modelled | N/A | N/A | N/A | No |
| clinic capacity | None | N/A | N/A | N/A | No |
| assistant | Not modelled | N/A | N/A | N/A | No |

There is no SQL overlap query, trigger, exclusion constraint, advisory lock or transactional create/update RPC.

Cancelled appointments immediately stop blocking the client slot. `no_show`, `completed` and `blocked` still block. Creating a row already marked cancelled skips conflict checks entirely.

## Time interval semantics

The client overlap expression matches the preferred half-open model:

```text
existing.start < proposed.end
AND existing.end > proposed.start
```

Observed client behavior:

- exact same interval: blocked with `Врач занят в это время.`;
- partial overlap: blocked;
- contained/surrounding: expression would block;
- back-to-back: allowed;
- edit excludes the current appointment ID;
- cancelled appointment: ignored;
- no-show/completed/blocked: not ignored.

Database behavior:

- exact overlap: allowed;
- partial overlap: allowed;
- back-to-back: allowed;
- zero duration: allowed;
- negative duration: allowed;
- overnight interval: allowed;
- no timezone/tenant-timezone column exists;
- timestamps are stored as `timestamptz`, while browser `datetime-local` conversion relies on browser timezone.

## Concurrency results

Controlled local PostgreSQL experiments used two parallel connections and no schema changes.

| Scenario | Successes | Resulting rows | Authoritative result |
|---|---:|---:|---|
| A same tenant, same doctor, exact interval | 2 | 2 | Both accepted |
| B same doctor, partial overlap | 2 | 2 | Both accepted |
| C same tenant, different doctors | 2 | 2 | Both accepted as expected |
| D same doctor, back-to-back | 2 | 2 | Both accepted as expected |
| E two appointments concurrently moved to same slot | 2 | 2 colliding rows | Both accepted |
| F same logical create repeated with different UUID | 2 | 2 | Duplicate accepted |

Additional interval inserts accepted:

- zero minutes;
- negative 60 minutes;
- overnight 60 minutes.

The plain-language answer is therefore: **two administrators can book the same doctor at the same time if both writes reach the database; the database does not prevent it.**

## Duplicate/retry safety

- No operation key.
- No request fingerprint.
- No natural uniqueness rule.
- No recovery lookup.
- The modal disables neither the save button nor the whole form during `isSaving`.
- The hook has `isSaving`, but SchedulePage does not pass it into the modal.
- A double click can issue multiple create calls before the modal closes.
- A lost successful response followed by a retry with a new UUID creates a duplicate.
- Reusing the exact same UUID would hit the primary key, but the current UI generates a new UUID for a new attempt.
- Reschedule/update has no optimistic version or operation identity, so last writer wins.
- There is no appointment audit event to deduplicate.

Idempotency is relevant for create and any future move/reschedule RPC, but conflict serialization is the primary invariant. A finance-style operation table is one option, not an automatic requirement.

## Role matrix

The current UI has no schedule-specific capability helper. Sidebar links, route access, all-doctor view, modal controls and hard-delete button are shown to every role that reaches the Layout.

The intended RLS matrix, if grants are repaired, is:

| Role | View all schedule | View own only | Create | Edit/reschedule | Cancel/status | Delete | Private comment |
|---|---:|---:|---:|---:|---:|---:|---:|
| clinic_owner | Yes | No restriction | Yes | Yes | Yes | Yes | Yes |
| clinic_admin | Yes | No restriction | Yes | Yes | Yes | Yes | Yes |
| registrar | Yes | No restriction | Yes | Yes | Yes | No | Yes |
| doctor | Yes, all doctors | No own-only policy | Yes | Yes | Yes | No | Yes |
| cashier | Yes, all doctors | No restriction | Yes | Yes | Yes | No | Yes |
| unknown tenant role | Depends on membership/enum; no UI gate | No | UI yes | UI yes | UI yes | UI yes | UI yes |
| no tenant | App shell blocks | N/A | No reachable UI | No | No | No | No |

Actual clean-reset result for every authenticated role is blocked before this matrix because `tenant_users` and appointment table privileges are missing.

Mismatch summary:

- sidebar/UI: broad access;
- route guard: none;
- RLS: all tenant members may read/create/update, owner/admin delete;
- source architecture: doctor should normally see own schedule unless granted all-doctor permission;
- clean database grants: no authenticated table access at all.

## Patient and clinical boundaries

Verified absence of automatic side effects:

- no encounter created;
- no visit created;
- no completed service created;
- no treatment plan changed;
- no invoice/payment created;
- no diagnosis/finding/dental-chart mutation;
- no document created.

Local DB counts after all direct appointment experiments were zero for visits, encounters, completed services, plans, documents, invoices and payments.

Later visit/encounter/completed-service tables may reference `appointment_id`. Their migrations explicitly describe the appointment as optional booking context only. Their controlled RPCs validate matching tenant and patient. Appointment `completed` therefore currently means only that a user selected the schedule status “Завершен”. It is not proof of attendance or treatment.

## Confirmation workflow

Current implementation: one status value, `confirmed`.

Absent:

- unconfirmed/requested state distinct from `new`;
- confirmation timestamp;
- confirmation channel;
- confirmed by staff/patient;
- failed contact;
- reminder/contact count;
- last contact time;
- confirmation audit event.

The hard-coded “Подтвердить записи на завтра” item is display text, not an operational task.

## Cancellation/rescheduling

Cancellation today:

- is a generic status update to `cancelled`;
- keeps the row unless the user uses the separate Delete button;
- requires no reason;
- records no actor/timestamp;
- immediately stops blocking the frontend conflict check;
- can be reversed by selecting another status;
- has no visible history.

Rescheduling today:

- edits `start_time` and `end_time` in place;
- preserves the same ID;
- records no old/new times, reason or actor;
- has no `rescheduled` status or linked replacement row;
- can move terminal-looking statuses because no lifecycle rule exists.

Hard delete physically removes the appointment. Later clinical rows use `ON DELETE SET NULL`, so they remain but lose the appointment link. Patient deletion cascades to appointments.

## Arrival/no-show

Implemented as status labels only:

- `arrived` exists;
- `in_progress` exists;
- `no_show` exists;
- `completed` exists.

Absent:

- arrival/check-in timestamp;
- waiting state;
- late-arrival metadata;
- in-chair timestamp;
- no-show reason/time/actor;
- no-show counters;
- automatic or controlled handoff from appointment to visit.

A separate visit lifecycle exists and is the authoritative model of actual attendance/check-in. Appointment status changes do not call it.

## Reminders/communications

No appointment reminder is currently sent.

- Mailing page: placeholder.
- SMS page: placeholder.
- No reminder table, job, scheduler, template linkage or delivery log.
- No WhatsApp/SMS provider call from appointment code.
- No amoCRM appointment synchronization.
- Hard-coded schedule tasks are not persisted or delivered.

Architecture documents describe future reminders, but operational integration is absent.

## Waitlist

Status: absent.

No waitlist table, UI, candidate patient model, preferred doctor/date, contact history, automatic fill, cancelled-slot notification or manual replacement workflow was found. The source document explicitly marks waiting list as a future separate task.

## Audit/history

Appointment create, edit, move, cancel, confirm, no-show and delete produce:

- no `audit_events` row;
- no `activity_events` row;
- no history row;
- no old/new payload;
- no actor/reason;
- no request ID.

Live validation after 17 appointment rows and all concurrency experiments showed zero appointment audit events and zero appointment activity events.

`updated_at` is not a reliable history substitute because direct update does not set it and there is no trigger.

## Existing test coverage

| Invariant/area | UI/component | Repository | SQL/RLS | Concurrency | Result |
|---|---:|---:|---:|---:|---|
| Modal create payload/UUID | Yes, 2 tests total in modal file | N/A | No | No | Partial |
| Repository query shape/mapping | No | Yes | No | No | Mocked only |
| Hook CRUD/refetch | No | Yes, mocked repository | No | No | Mocked only |
| Schedule page rendering | No dedicated test | N/A | No | No | Missing |
| Overlap semantics | No test found | No | No | No | Missing |
| Positive interval | No | No | No | No | Missing |
| Tenant FKs | No | No | No appointment-specific SQL test | No | Missing automated coverage |
| RLS roles | No | No | No appointment-specific test | No | Missing |
| Table grants | No | No | No core-table grant assertion | No | Missing |
| Cancellation reason/history | No | No | No | No | Missing |
| Confirmation/no-show metadata | No | No | No | No | Missing |
| Stale response | Generic `useAsyncQuery` tests | N/A | N/A | No | Generic protection only |
| Clinical non-side-effects | Timeline boundary test | N/A | No appointment CRUD test | No | Partial |
| Double submit/retry | No | No | No | No | Missing |

The SQL files that mention appointments test finance links or patient-credit references, not appointment CRUD, RLS or conflict invariants.

## Browser smoke

Real Chrome was used against two local app modes.

### Supabase-active mode, port 5191

- correct worktree/branch confirmed;
- QA login shortcut rendered;
- login succeeded at Auth level;
- TenantContext request to `/rest/v1/tenant_users` returned 403;
- application could not establish active tenant or render schedule;
- console showed 403 resource errors;
- Kong logs confirmed 403 for `tenant_users`, `profiles` and appointment probes;
- role-specific schedule lifecycle and cross-tenant UI smoke were blocked.

### Dev/localStorage mode, port 5192

- schedule route rendered without console errors or network writes;
- `/appointments` rendered the placeholder page;
- create succeeded;
- reload in the same browser context preserved the appointment;
- a separate browser context did not see it, confirming browser-local source of truth;
- edit changed time from 10:00 to 10:30 and persisted after reload;
- cancellation persisted as status `Отменен`;
- hard delete removed the row after reload;
- exact overlap was blocked in the modal;
- partial overlap was blocked in the modal;
- back-to-back 10:00–11:00 and 11:00–12:00 was allowed;
- no fatal console error, raw SQL or secret was shown.

A second independent localStorage browser cannot act as a concurrent operator on the same dataset because each context has isolated storage. Authoritative concurrency was therefore tested directly against PostgreSQL.

Stale-response behavior was inspected in `useAsyncQuery` and its existing tests. A real delayed Supabase schedule response could not be exercised because Supabase mode fails at tenant membership and source instrumentation was forbidden.

## Network validation

Current intended schedule network contract:

- reads: direct `GET /rest/v1/appointments`;
- create: direct `POST /rest/v1/appointments`;
- edit/status/reschedule: direct `PATCH /rest/v1/appointments`;
- delete: direct `DELETE /rest/v1/appointments`;
- no appointment RPC.

Observed:

- dev/localStorage schedule: zero network writes;
- Supabase app login: `GET /rest/v1/tenant_users` → 403 before schedule;
- direct authenticated appointment insert probe: `POST /rest/v1/appointments` → 403 / PostgreSQL `42501`;
- no legacy hidden RPC or background reminder traffic;
- no service-role secret visible in browser.

## Database validation

Before cleanup the controlled fixture database contained 17 `new` appointments, including baseline and concurrency rows.

Observed active overlap pairs:

- same doctor: 4;
- same patient: 1;
- same cabinet text: 4.

Observed duplicate group:

- same tenant, patient, doctor, start, end and status: 2 rows.

Observed invalid intervals:

- 2 rows with `end_time <= start_time`.

Observed audit/activity:

- appointment audit events: 0;
- appointment activity events: 0.

Observed clinical/financial side effects:

- visits: 0;
- encounters: 0;
- completed services: 0;
- treatment plans: 0;
- documents: 0;
- invoices: 0;
- payments: 0.

## Cleanup

- Both Vite processes were stopped.
- Local Supabase was reset again with `--no-seed`.
- Final public counts: tenants 0, patients 0, doctors 0, appointments 0, audit events 0, activity events 0.
- QA fixture rows and auth data were removed by the reset.
- Temporary scripts, PID files, logs and screenshots are outside the repository and are removed before final publication.

## Real gaps

1. **P0 deployment/access:** legacy core tables lack explicit authenticated/service-role table grants after clean reset; Supabase app cannot load tenant membership or appointment CRUD.
2. **P0 slot integrity:** exact/partial doctor overlaps and concurrent conflicting moves are accepted by PostgreSQL.
3. **P0 duplicate/retry integrity:** no idempotency or natural uniqueness; a retry with new UUID creates a duplicate.
4. **P0/P1 history:** hard delete removes appointment history; cancellation/reschedule have no actor, reason, timestamp or immutable event.
5. **P1 source-of-truth contradiction:** patient history and patient-list visit summaries remain localStorage-only while schedule/timeline/medical summary can use Supabase.
6. **P1 role mismatch:** UI exposes all-doctor create/edit/status/delete controls broadly; RLS is broader than source permissions and delete UI ignores policy.
7. **P1 lifecycle:** any visible status can transition to any other; confirmation, arrival and no-show are labels, not workflows.
8. **P1 interval validity:** DB accepts zero and negative duration.
9. **P1 resource integrity:** cabinet is unscoped text; chair/room/equipment capacity is absent.
10. **P2 workflows:** reminders, communications, waitlist and free-slot replacement are absent.

## Risk priorities

| Priority | Gap | Why now |
|---|---|---|
| P0-1 | Legacy core table grants | Blocks all trustworthy Supabase schedule/role verification and normal local deployment |
| P0-2 | Appointment conflict hardening | Two operators can double-book same doctor and cabinet |
| P0-3 | Retry/duplicate safety | Lost response/double submit can create duplicate appointments |
| P0-4 | Historical preservation | Hard delete and silent move destroy operational evidence |
| P1-1 | Source-of-truth consolidation | Patient views can disagree with schedule in the same session |

## Design options

These options apply to the first schedule-specific integrity task after grants recovery.

### Option A: PostgreSQL exclusion constraints

Use `tstzrange(start_time,end_time,'[)')` and GiST exclusion constraints scoped by tenant and doctor, with a partial predicate for statuses that occupy a slot.

Advantages:

- strongest race-safe database invariant;
- naturally implements half-open intervals;
- protects direct CRUD and all clients;
- easy concurrent proof.

Costs/risks:

- requires installing available-but-not-installed `btree_gist`;
- partial status semantics must be finalized;
- separate constraints would be needed for patient and any future resource;
- free-text cabinet cannot be safely protected as a resource model;
- migration precheck must handle existing overlaps and invalid intervals.

### Option B: transactional SECURITY DEFINER create/update RPC

Create narrow tenant/role-aware create and reschedule RPCs. Lock per tenant/resource with advisory locks, validate interval and relationships, query conflicts, write appointment and audit/activity atomically, and support an operation key/recovery lookup.

Advantages:

- supports nuanced role, status, cancellation and audit rules;
- can protect doctor and patient now without inventing room entities;
- can provide safe errors and retry identity;
- aligns with the newer encounter and finance architecture.

Costs/risks:

- correctness depends on locking every write path;
- direct table writes must be revoked;
- more code and testing than a single constraint;
- advisory-lock key design must be stable.

### Option C: resource-slot/booking-lock model

Introduce normalized resources and reserved time slots or serialized booking rows.

Advantages:

- future support for doctor, room, chair, equipment and assistants;
- explicit capacity/overbooking rules;
- strong extensibility.

Costs/risks:

- much larger schema and migration;
- current resource model does not exist;
- would exceed the smallest coherent next schedule scope;
- high duplication risk with later clinic-resource work.

### Recommendation for conflict hardening

After grants recovery, choose **Option B, a controlled transactional RPC with advisory locking**, and add a database interval check. It matches the repository's current evolution toward RPC-only high-risk writes, can include safe idempotency and audit in one boundary, and does not require prematurely modelling chairs or rooms. The task should explicitly revoke direct authenticated appointment writes. A later, evidence-driven migration can add exclusion constraints once active-status semantics and resource IDs are stable.

## Duplicate-task findings

| Task name | Finding |
|---|---|
| `SCHEDULE-OPERATIONS-RECON-001` | Current task; no prior exact PR |
| `SCHEDULE-CONFLICT-HARDENING-001` | Not found; semantic overlap with recommended future appointment conflict task |
| `APPOINTMENT-CONFLICT-GUARD-001` | Not found; safe to schedule after grants recovery |
| `APPOINTMENT-LIFECYCLE-001` | Not found; broad, should wait |
| `APPOINTMENT-CONFIRMATION-001` | Not found; safe later, but dependent on lifecycle/history |
| `APPOINTMENT-NOSHOW-001` | Not found; safe later, but visit/appointment boundary must remain explicit |
| `APPOINTMENT-REMINDERS-001` | Not found; premature before authoritative booking/lifecycle |
| `WAITLIST-001` | Not found; explicitly future scope in source docs |
| `PUBLIC-BOOKING-001` | Not found; premature before conflict/security hardening |
| `APPOINTMENT-REAL-001A/B` | Merged DAL and browser QA; partial historical overlap only, not conflict/grant hardening |
| `ARCH-035`–`ARCH-041` | Merged DAL/UI integration sequence; obsolete as implementation tasks, useful evidence only |
| function-grant PRs #282/#284 | RPC/helper grant hardening only; not legacy core table grants |

No existing PR or report implements the required legacy table grants recovery or authoritative appointment conflict protection.

## Candidate readiness cards

### Card 1: `LEGACY-CORE-TABLE-GRANTS-RECOVERY-001`

- Problem: clean migrations leave core tables inaccessible to authenticated and service-role clients.
- Existing capability: RLS policies and repositories exist.
- Missing invariant: explicit least-privilege table grants consistent with current DAL.
- Evidence: local ACL checks, QA seed failure, PostgREST 403, browser tenant-membership 403.
- Dependencies: none beyond current baseline.
- Duplication risk: low; prior grant tasks covered functions or newer tables only.
- Type: schema/security hardening plus local/cloud reconciliation plan.
- Scope: inventory legacy core table access needs, grant SELECT or controlled DML deliberately, add grant/RLS tests, restore QA seed and browser login.
- Exclusions: no appointment conflict/lifecycle redesign.
- Decision: **GO, exact next task**.

### Card 2: `APPOINTMENT-CONFLICT-HARDENING-001`

- Problem: database accepts overlapping and invalid appointments.
- Existing capability: direct repository, same-tenant FKs, client half-open check.
- Missing invariant: atomic server conflict and positive interval enforcement.
- Evidence: A/B/E concurrency all produced two conflicting rows.
- Dependencies: grants recovery; active status semantics.
- Duplication risk: low; no matching task/PR.
- Type: migration + RPC + repository/client integration + concurrency tests.
- Scope: doctor and patient conflicts, interval validity, create/update locking, safe errors, audit.
- Exclusions: no cabinet/chair redesign, reminders, waitlist or broad lifecycle.
- Decision: **GO immediately after grants recovery**.

### Card 3: `SCHEDULE-SOURCE-OF-TRUTH-CONSOLIDATION-001`

- Problem: patient history and patient-list visit summary always read localStorage.
- Existing capability: configured appointment repository already supports Supabase.
- Missing invariant: all reachable appointment views use the same backend/tenant boundary.
- Evidence: `usePatientAppointments` and `PatientListVisitSummaryAggregator` hard-code local repository.
- Dependencies: grants recovery.
- Duplication risk: medium; ARCH-064 title claimed migration, but current code regressed/remains local.
- Type: small application integration and tests.
- Scope: repository config, no-tenant short circuit, patient history/list consistency.
- Exclusions: no schedule UI redesign.
- Decision: **GO after server write integrity**.

### Card 4: `APPOINTMENT-LIFECYCLE-FOUNDATION-001`

- Problem: arbitrary status transitions and no timestamps/actors/reasons.
- Existing capability: eight status values and separate visit lifecycle.
- Missing invariant: explicit appointment transition contract and history.
- Evidence: any quick status can replace any other; DB only checks membership in list.
- Dependencies: conflict RPC/audit boundary.
- Duplication risk: low, but broad scope risk high.
- Type: recon-first or narrow schema/RPC foundation.
- Scope: appointment-only transitions, preserve clinical boundary.
- Exclusions: reminders/waitlist/public booking.
- Decision: **NO-GO until conflict boundary exists; split into smaller tasks**.

### Card 5: `APPOINTMENT-CANCELLATION-NOSHOW-001`

- Problem: cancellation/no-show lack reason, actor, time and reporting history.
- Existing capability: distinct status values; cancelled frees client slot.
- Missing invariant: immutable outcome metadata and safe slot-release rules.
- Evidence: browser cancellation was generic reversible status; no audit rows.
- Dependencies: lifecycle foundation or controlled appointment RPC.
- Duplication risk: low.
- Type: narrow lifecycle workflow.
- Scope: cancel/no-show only, history/audit, role checks.
- Exclusions: reminders and waitlist.
- Decision: **GO after conflict hardening**.

### Card 6: `APPOINTMENT-CONFIRMATION-WORKFLOW-001`

- Problem: confirmation is only a status value.
- Existing capability: `confirmed` label/filter.
- Missing invariant: request/channel/time/actor/contact result.
- Evidence: no schema/UI/jobs beyond quick status.
- Dependencies: lifecycle/history; optional future communications.
- Duplication risk: low.
- Type: workflow foundation.
- Exclusions: provider integration initially.
- Decision: **GO later**.

### Card 7: `SCHEDULE-ROLE-HARDENING-001`

- Problem: UI and intended RLS expose broad all-doctor mutation access.
- Existing capability: tenant roles and source permission model.
- Missing invariant: view-own/view-all and mutation capabilities enforced consistently.
- Evidence: no schedule role helper; doctor/cashier receive same controls; delete button shown to all.
- Dependencies: grants recovery and controlled write RPC.
- Duplication risk: low.
- Type: policy/RPC/UI capability hardening.
- Exclusions: lifecycle redesign.
- Decision: **GO after write RPC exists**.

## Recommended next task

`LEGACY-CORE-TABLE-GRANTS-RECOVERY-001`

Why it is next:

- it is the earliest reproducible blocker in a clean deployment;
- TenantContext cannot load membership, so no schedule role can reach the operational page;
- appointment-only grants are insufficient because patients and doctors are also required;
- service-role QA fixture creation is broken for the same reason;
- conflict hardening cannot be integrated or browser-verified against the intended Supabase path until access is deterministic.

Why it is not a duplicate:

- PR #282 hardened one treatment-plan RPC grant;
- PR #284 hardened SECURITY DEFINER helper function grants;
- newer schema migrations explicitly grant SELECT/EXECUTE for their own tables/functions;
- no PR or task restores explicit least-privilege access for the legacy tables created in `0001`.

Why a narrower task is insufficient:

- granting only `appointments` still leaves `tenant_users`, `tenants`, `patients` and `doctors` inaccessible;
- the app cannot select an active tenant or populate the modal without those tables.

Why broader lifecycle work must wait:

- lifecycle changes on an inaccessible and non-atomic write path would stack new semantics on a broken deployment contract;
- once access is restored, `APPOINTMENT-CONFLICT-HARDENING-001` is the smallest schedule integrity task and should precede cancellation, confirmation, reminders and waitlist.

## Near-term schedule roadmap

1. `LEGACY-CORE-TABLE-GRANTS-RECOVERY-001`.
2. `APPOINTMENT-CONFLICT-HARDENING-001`.
3. `SCHEDULE-SOURCE-OF-TRUTH-CONSOLIDATION-001`.
4. `APPOINTMENT-CANCELLATION-NOSHOW-001`.
5. `SCHEDULE-ROLE-HARDENING-001`.
6. `APPOINTMENT-CONFIRMATION-WORKFLOW-001`.
7. Reminders/communications only after confirmation state is authoritative.
8. Waitlist/free-slot assistance only after cancellation and conflict rules are authoritative.
9. Public booking only after all preceding security and slot invariants.

## Limitations / known uncertainties

- Cloud database grants and schema drift were not inspected because cloud access was forbidden. A previously functioning cloud environment may contain manual/default grants absent from Git.
- Real role-specific Supabase schedule behavior could not be tested because the clean local app failed at `tenant_users` before route rendering.
- A real delayed schedule response was not injected because source edits were forbidden; stale handling is supported by generic hook code/tests but not schedule-specific browser evidence.
- The intended set of statuses that occupy a slot must be decided before conflict migration. Current client ignores only `cancelled`.
- Tenant timezone is described architecturally but not stored in the appointment model.
- Cabinet text may contain inconsistent spelling/casing; it is not suitable as an authoritative resource key.

## Checks: lint/test/build

Final local report-only validation:

- `npm run lint`: passed;
- `npm run test -- --run`: passed;
- test files: 80 passed;
- tests: 864 passed;
- `npm run build`: passed;
- existing unrelated React `act(...)` warnings remain in older tests;
- existing Vite bundle-size warning remains.

## Fresh CI

Initial report CI:

- workflow: `CI`;
- run: `#692`;
- run ID: `29162177217`;
- conclusion: `success`;
- tested commit: `6552f5e1509c5f48db3c51b8dc26e8820c5a7cd1`;
- ESLint: passed;
- tests: passed;
- build: passed.

A fresh CI run on the final metadata-only PR head is required after this report update. The PR must remain open and unmerged.

## Final verdict

**PARTIAL**

PARTIAL: authenticated table grants block Supabase schedule CRUD and role browser verification.
