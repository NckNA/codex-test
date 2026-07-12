# APPOINTMENT-REMINDER-QUEUE-FOUNDATION-001

## 1. Final verdict

Final verdict: **PASS**

Task verdict: **APPOINTMENT REMINDER QUEUE FOUNDATION IMPLEMENTED AND VERIFIED**

The durable tenant-scoped reminder planning foundation is implemented and verified locally. It creates manual work plans only. It does not send a message, contact a provider, run a worker, register cron, expose a webhook, or add delivery state.

## 2. Summary

This task adds a disabled-by-default tenant reminder policy, durable version-bound appointment reminder jobs, an idempotent appointment planner, bounded tenant reconciliation, lifecycle invalidation, tenant-scoped repository reads, RLS, audit/activity facts, SQL validation, concurrency validation, TypeScript tests, and real local browser/database smoke.

Each job is bound to the exact appointment `updated_at` and policy version. Repeated planning reuses the same deterministic plan. Reschedule, relevant detail/status changes, confirmation changes, policy changes, cancellation, no-show, patient arrival, visit start/completion, and hard delete cannot leave sendable stale work.

No external message or provider request exists.

## 3. Branch

`feature/appointment-reminder-queue-foundation-001`

## 4. PR URL

Pending creation after the implementation commit.

## 5. Baseline

- repository: `NckNA/codex-test`;
- base branch: `main`;
- exact verified baseline: `80e90b4f7a0db6559ecbacc91f673b910516afa4`;
- `origin/main` exactly matched the expected baseline before the branch was created;
- the baseline contains PR #353 and `TENANT-TIMEZONE-SCHEDULING-FOUNDATION-001`;
- the task worktree was created cleanly from current `origin/main`;
- cloud Supabase was not used.

## 6. PR head reviewed before final report update

Pending implementation commit and first fresh CI run.

## 7. Report update commit

Report update commit: N/A because a report-only commit cannot contain its own future SHA or the CI result that tests it.

The exact final report-only commit and final fresh CI run must be recorded in an immutable local finalization receipt and in the final task response.

## 8. Changed files

- `_ai_work/REPORTS/APPOINTMENT-REMINDER-QUEUE-FOUNDATION-001_foundation.md`;
- `src/data/repositories/AppointmentReminderRepository.test.ts`;
- `src/data/repositories/AppointmentReminderRepository.ts`;
- `src/types/index.ts`;
- `supabase/migrations/0029_appointment_reminder_queue_foundation.sql`;
- `supabase/tests/0029_appointment_reminder_queue_concurrency.ps1`;
- `supabase/tests/0029_appointment_reminder_queue_foundation_test.sql`.

No package, lockfile, generated type, environment file, screenshot, temporary smoke script, provider SDK, worker, cron, Edge Function, or cloud migration file belongs in the final diff.

## 9. Pre-read

Reports read and reconciled before/finally during implementation:

- `_ai_work/REPORTS/APPOINTMENT-CONFLICT-HARDENING-001_hardening.md`;
- `_ai_work/REPORTS/APPOINTMENT-CANCELLATION-NOSHOW-001_lifecycle.md`;
- `_ai_work/REPORTS/APPOINTMENT-CONFIRMATION-WORKFLOW-001_workflow.md`;
- `_ai_work/REPORTS/APPOINTMENT-REMINDER-OPERATIONS-RECON-001_recon.md`;
- `_ai_work/REPORTS/TENANT-TIMEZONE-SCHEDULING-FOUNDATION-001_foundation.md`.

Architecture sources read and used:

- `_ai_work/SOURCES/02_ROLES_AND_PERMISSIONS.md`;
- `_ai_work/SOURCES/03_MULTI_TENANT_ARCHITECTURE_RULES.md`;
- `_ai_work/SOURCES/04_DATA_ISOLATION_AND_SECURITY.md`;
- `_ai_work/SOURCES/08_APPOINTMENTS_AND_SCHEDULE.md`;
- `_ai_work/SOURCES/11_BACKEND_AND_API_ARCHITECTURE.md`;
- `_ai_work/SOURCES/13_STORAGE_AND_MIGRATION_STRATEGY.md`;
- `_ai_work/SOURCES/18_TESTING_AND_QUALITY_ASSURANCE_STRATEGY.md`.

Code/schema inspected included migrations `0001`, `0013`, `0015`, and `0025` through `0028`; appointment create/reschedule/details, cancellation/no-show, confirmation, visit lifecycle, audit/activity helpers, tenant/timezone context, timezone utilities, repositories, schedule pages, placeholders, and existing SQL/concurrency suites.

## 10. Lifecycle event map

| Operation | Authoritative mutation | Transaction/version facts | Reminder result |
|---|---|---|---|
| appointment create | `create_appointment` inserts `appointments` | appointment insert and AFTER trigger are one transaction; tenant timezone and policy are available | if policy disabled, no jobs; if enabled and eligible, desired jobs are created |
| appointment reschedule | `reschedule_appointment` updates start/end and `updated_at` under appointment/resource locks | old jobs and new appointment version are visible in the same transaction | old active jobs are superseded; new version-bound jobs are created atomically |
| appointment details/status update | `update_appointment_details` updates details/status; existing updated-at trigger changes version | row is locked and optimistic `updated_at` is checked | any new appointment version supersedes old active plans; terminal/ineligible status cancels or skips work |
| confirmation attempt | confirmation RPC updates confirmation state, attempt facts, and appointment version | immutable attempt and appointment mutation are one transaction | trigger recomputes desired set; repeated request depends on policy; callback is deferred without explicit time |
| direct confirmation | `confirm_appointment` changes confirmation state/version | appointment lock and optimistic version check | confirmation-request/control-call jobs are superseded; ordinary day-before reminder remains only when policy permits |
| cancellation | `cancel_appointment` sets terminal status/metadata | cancellation RPC and appointment trigger share one transaction | all pending jobs become `cancelled`; completed history is preserved |
| no-show | `mark_appointment_no_show` sets terminal status/metadata | no-show RPC and appointment trigger share one transaction | all pending jobs become `cancelled`; completed history is preserved |
| arrival/check-in | `check_in_patient_visit` inserts a checked-in visit linked to appointment | appointment status itself is not rewritten; visit trigger runs in the same RPC transaction | all pending jobs become `skipped` with `appointment_arrived` |
| visit in progress | `start_patient_visit` changes visit status | visit row is locked; visit trigger shares transaction | any remaining pending jobs become `skipped` with `appointment_in_progress` |
| visit completion | `complete_patient_visit` changes visit status | visit row is locked; visit trigger shares transaction | any remaining pending jobs become `skipped` with `appointment_completed` |
| hard delete | existing owner/admin appointment DELETE plus composite FK cascade | database cascade is atomic | reminder jobs are deleted with appointment; no orphan row remains |

The appointment trigger is intentionally attached to `updated_at` as well as scheduling/confirmation fields because plan identity is bound to the exact appointment version, not merely the start timestamp.

## 11. Tenant policy model

`public.tenant_reminder_policies` is the authoritative minimal planning policy.

- one row per tenant;
- existing and newly created tenants are disabled by default;
- timezone is read from `tenants.timezone`, not duplicated;
- policy version starts at `1` and increments only after an actual policy change;
- owner/admin mutate policy through `set_tenant_reminder_policy`;
- policy mutation immediately supersedes every active old-policy job;
- new current-policy jobs appear only through appointment planning/lifecycle reconciliation or bounded tenant reconciliation;
- no broad settings UI was added.

Policy fields cover confirmation request, repeated confirmation request, day-before local time, reminder-after-confirmation, callback-task permission, control-call permission, and control-call offset.

## 12. Reminder job model

`public.appointment_reminder_jobs` stores durable work-plan facts:

- UUID primary key;
- tenant, appointment, and patient references;
- composite tenant/appointment and tenant/patient foreign keys;
- reminder type;
- manual execution mode;
- `due_at timestamptz`;
- non-provider job state;
- exact appointment `updated_at`;
- policy version;
- deterministic plan key and payload fingerprint;
- priority;
- actor/timestamps;
- terminal timestamps/reason;
- safe JSON metadata.

No provider ID, delivery attempt, send result, retry counter, credential, template, consent, or normalized phone field was added.

## 13. Reminder types

Supported stable types:

- `confirmation_request`;
- `day_before_reminder`;
- `control_call_task`;
- `callback_task`.

`callback_task` is schema-valid for the future manual queue, but this task creates none because the current confirmation model has no explicit callback due time.

## 14. Job states

Stored states:

- `scheduled`;
- `ready`;
- `completed`;
- `cancelled`;
- `superseded`;
- `skipped`.

Provider states such as processing, sent, delivered, uncertain, retryable failure, or terminal provider failure do not exist.

Terminal-state constraints require the matching timestamp and a non-empty terminal reason. Active states cannot carry terminal timestamps/reasons.

## 15. Execution mode

The only accepted execution mode is `manual`.

`automated_reserved` was intentionally not added. A future delivery architecture must earn that state through a separate migration instead of receiving speculative fields now.

## 16. Eligibility matrix

| Appointment/confirmation state | Confirmation request | Day-before reminder | Control call | Callback task |
|---|---:|---:|---:|---:|
| new + unconfirmed | policy | policy | policy | no |
| new + contact_in_progress | only when repeat policy enabled | policy | policy | no |
| new + confirmed or legacy status confirmed | no | only when `reminder_after_confirmation` | no | no |
| new + unreachable | no | no by initial policy | manual control call when enabled | no |
| new + callback_requested | no | no | no | deferred until explicit callback time exists |
| arrived/in_progress/completed/blocked | no | no | no | no |
| cancelled/no_show | no | no | no | no |
| appointment already started or past | no | no | no | no |
| missing patient/block slot | no | no | no | no |

`message_sent` is treated only as a contact outcome. It is not delivery proof.

## 17. Due-time calculations

All due times are computed server-side.

- confirmation request: tenant-local day before appointment at configured local time;
- day-before reminder: the same tenant-local day-before policy time;
- control call: appointment instant minus configured minutes;
- callback task: not generated without an explicit callback timestamp.

`tenants.timezone` is validated as an IANA zone. `due_at` is stored as `timestamptz`. Browser timezone is irrelevant.

Validation proves:

- Asia/Almaty local noon maps to the expected UTC instant;
- Europe/Berlin summer local noon maps correctly;
- America/New_York summer local noon maps correctly;
- a nonexistent spring-forward local time fails by timezone round-trip validation.

For an ambiguous fall-back wall time, PostgreSQL `AT TIME ZONE` deterministically chooses the standard-time occurrence. This deterministic database policy is documented rather than silently delegating to browser behavior.

## 18. Callback limitation

The current `callback_requested` fact stores no callback date/time. This task does not invent one and does not use folklore such as `now() + interval '1 hour'`.

The planner returns `callbackDeferred=true`, supersedes incompatible active generic plans, and creates no callback job. A dedicated future callback scheduling contract must first add an explicit human-selected due time.

## 19. Plan identity

`plan_key` is SHA-256 over:

- tenant ID;
- appointment ID;
- reminder type;
- `due_at`;
- exact appointment `updated_at`;
- policy version.

The tenant-scoped unique constraint is `(tenant_id, plan_key)`.

`payload_fingerprint` additionally includes patient, execution mode, confirmation state, and appointment status. Same logical plan reuses the existing row and emits no duplicate audit/activity event. Changed appointment or policy version produces a different plan and makes old active rows historical through `superseded`.

## 20. Planner RPC

Public RPC:

`plan_appointment_reminder_jobs(p_tenant_id, p_appointment_id, p_reference_time)`

Behavior:

- authenticates caller;
- permits owner/admin/registrar;
- verifies tenant membership;
- locks appointment;
- locks policy row in shared mode;
- validates tenant timezone;
- evaluates eligibility;
- computes desired jobs;
- reuses matching plans;
- supersedes stale plans;
- cancels terminal appointment plans;
- skips started/ineligible appointment plans;
- creates missing manual jobs;
- records audit/activity exactly once per actual transition;
- returns created/reused/superseded/cancelled/skipped/desired rows plus appointment and policy version;
- performs no external side effect.

## 21. Tenant reconciliation

Bounded RPC:

`reconcile_tenant_appointment_reminders(p_tenant_id, p_from, p_to, p_limit, p_reference_time)`

- owner/admin only;
- maximum window 90 days;
- limit 1 through 500;
- deterministic order by appointment start and ID;
- tenant-scoped;
- manually invoked only;
- returns compact counters;
- no scheduler, cron, worker, or unbounded scan exists.

## 22. Lifecycle invalidation

Four database mechanisms close consistency windows:

1. appointment AFTER trigger plans/reconciles on insert or relevant version/status/time/confirmation update;
2. patient-visit AFTER trigger skips jobs on checked-in/in-progress/completed;
3. policy RPC supersedes active old-policy jobs before returning;
4. appointment FK cascade removes jobs on hard delete.

Completed jobs are historical and are never changed by cancellation, no-show, reschedule, confirmation, policy mutation, or visit lifecycle.

## 23. Transaction strategy

Reminder reconciliation runs inside the same PostgreSQL transaction as authoritative appointment and visit mutations.

- reschedule cannot commit new appointment time while leaving old jobs active;
- cancellation/no-show cannot commit with sendable pending jobs;
- confirmation cannot commit while retaining an active confirmation-request plan;
- arrival cannot commit its visit while retaining pending reminder work;
- policy version cannot commit while old-policy work remains active.

The bounded tenant reconciliation exists for initial rollout, explicit repair, and future scheduler input, but no background scheduler is introduced.

## 24. Role matrix

| Role | View policy/jobs | Appointment planner | Tenant reconciliation | Policy mutation |
|---|---:|---:|---:|---:|
| owner | yes | yes | yes | yes |
| admin | yes | yes | yes | yes |
| registrar | yes | yes | no | no |
| doctor | no | no | no | no |
| cashier | no | no | no | no |
| unknown/no tenant | no | no | no | no |
| anonymous | no | no | no | no |

Backend/database rules are authoritative.

## 25. RLS and grants

RLS is enabled on both new tables.

Authenticated users receive SELECT only, and RLS narrows it to owner/admin/registrar in their tenant. Authenticated INSERT/UPDATE/DELETE grants are absent. Write-guard triggers provide defense in depth. Public mutation occurs only through controlled RPCs/internal functions. No service-role credential appears in frontend code.

Composite foreign keys prevent tenant/patient and tenant/appointment mismatches.

## 26. Audit/activity

Emitted only for actual state changes:

- `appointment_reminder_planned`;
- `appointment_reminder_superseded`;
- `appointment_reminder_cancelled`;
- `appointment_reminder_skipped`.

Events include tenant, appointment, patient, job ID, reminder type, due time, previous/new state, appointment version, policy version, actor/source, plan key, and execution mode.

Replay creates no duplicate event. No sent/delivered/failed/retried event exists.

## 27. Repository integration

`AppointmentReminderRepository` provides:

- `listReminderJobs`;
- `listReminderJobsByAppointment`;
- `planAppointmentReminderJobs`;
- `reconcileTenantReminderJobs`.

Reads always apply tenant scope and deterministic ordering. Supabase mode has no localStorage fallback and no direct write. Explicit local-development mode returns an empty disabled plan rather than pretending delivery or persistence exists. Database timestamp strings retain offset and PostgreSQL precision.

No diagnostic UI/hook was added because repository coverage plus local SQL/browser validation satisfied this foundation without expanding product UI.

## 28. Ready-state decision

`ready` is derived operationally when a stored `scheduled` job has `due_at <= referenceTime/now`.

This foundation does not mutate rows merely because time passed and therefore has no scheduler dependency. The repository exposes `operationalState=ready` and sorts derived-ready jobs before future scheduled jobs. The stored `ready` value remains schema-valid for a future explicit manual operation, but this task never background-transitions it.

## 29. SQL tests

Clean local reset applied migrations `0001` through `0029`.

Passed regression suites:

- `0024_legacy_core_table_grants_test.sql`;
- `0025_appointment_conflict_hardening_test.sql`;
- `0026_appointment_cancellation_noshow_test.sql`;
- `0027_appointment_confirmation_workflow_test.sql`;
- `0028_tenant_timezone_scheduling_foundation_test.sql`;
- `0029_appointment_reminder_queue_foundation_test.sql`.

The 0029 suite verifies schema, default-disabled policy, roles, RLS, cross-tenant boundaries, direct-write blocking, timezone calculations, eligibility/confirmation rules, callback deferral, idempotency, deterministic identity, reschedule, cancellation, no-show, visit lifecycle, hard-delete cascade, policy versioning, completed-history preservation, audit/activity exactly once, duplicate/stale invariants, and no clinical/financial side effects.

Typed PostgreSQL catalog assertions passed: **42/42**.

## 30. Concurrency tests

Passed:

- `0025_appointment_conflict_concurrency.ps1`;
- `0026_appointment_cancellation_noshow_concurrency.ps1`;
- `0027_appointment_confirmation_workflow_concurrency.ps1`;
- `0029_appointment_reminder_queue_concurrency.ps1`.

0029 scenarios covered same-appointment planners, overlapping tenant reconciliation, planner versus reschedule/cancellation/no-show/confirmation/policy change, cross-tenant independence, duplicate event prevention, and deadlock detection.

Final 0029 counters:

- created/total job records: `34`;
- superseded: `19`;
- cancelled: `6`;
- duplicate plan keys: `0`;
- duplicate logical jobs: `0`;
- active stale jobs: `0`;
- audit events: `59`;
- activity events: `59`;
- deadlocks: `0`.

## 31. TypeScript tests

Repository tests cover:

- tenant filter;
- appointment filter;
- deterministic ordering;
- derived ready state;
- exact due/appointment-version timestamp preservation;
- policy version/metadata mapping;
- planner RPC arguments;
- bounded reconciliation RPC arguments;
- safe error mapping;
- offset-free input rejection;
- explicit empty local-development behavior;
- no direct insert/update/delete;
- no provider/delivery/source-role implementation.

Repository suite: **9/9 passed**.

Full suite: **91 files / 1016 tests passed**.

## 32. Browser/local smoke

Equivalent isolated HeadlessChrome 150 was used because a separately invokable Chrome DevTools MCP action was unavailable in this environment, which the task explicitly permits when documented.

Local Supabase smoke proved:

1. disabled policy creates zero jobs;
2. enabled policy creates the expected three manual jobs;
3. repeated planner returns/reuses the same plan with no duplicate events;
4. Almaty day-before local noon produces the expected UTC due time;
5. confirmation suppresses active confirmation-request/control-call work while preserving permitted ordinary reminder;
6. reschedule supersedes old jobs and creates a new version-bound set;
7. cancellation leaves no active job;
8. no-show leaves no active job;
9. tenant B cannot view tenant A jobs;
10. a real QA administrator can log in and view the local smoke patient;
11. browser console errors: `0`;
12. failed browser requests: `0`;
13. visible secrets: `0`.

The smoke fixtures, temporary script, screenshots, and Vite process were removed.

## 33. Network validation

HeadlessChrome write traffic contained only successful local Supabase authentication:

- `POST /auth/v1/token?grant_type=password`.

Gateway search found no SMS, WhatsApp provider, email provider, Twilio, SendGrid, provider-message, or send endpoint. Frontend source contains no reminder-job insert/update/delete. Migration source contains no provider delivery state or provider message ID.

## 34. Database validation

Browser/database smoke counters before cleanup:

- jobs: `16`;
- scheduled: `4`;
- superseded: `6`;
- cancelled: `6`;
- confirmation-request jobs: `5`;
- control-call jobs: `5`;
- day-before jobs: `6`;
- duplicate plan keys: `0`;
- duplicate logical jobs: `0`;
- active stale jobs: `0`;
- invalid appointment intervals: `0`;
- reminder audit/activity counts matched exactly: planned `16/16`, superseded `6/6`, cancelled `6/6`.

Legacy concurrency remained green with doctor overlaps `0`, patient overlaps `0`, invalid intervals `0`, and deadlocks `0`.

## 35. Side-effect validation

Unchanged by planning and smoke:

- confirmation-attempt facts except when the explicit existing confirmation RPC was intentionally invoked;
- cancellation/no-show metadata except through their explicit authoritative RPCs;
- patient visits outside the explicit visit-lifecycle SQL scenario, which was removed before final side-effect counts;
- clinical encounters;
- completed services;
- treatment plans;
- findings;
- dental charts;
- invoices;
- payments;
- refunds;
- financial adjustments/write-offs;
- patient balances;
- documents;
- stock;
- amoCRM;
- provider credentials;
- message delivery.

Final smoke side-effect counters for visits, encounters, completed services, invoices, payments, refunds, and adjustments were all `0`.

## 36. Legacy/deployment behavior

- existing tenants receive a disabled policy row;
- migration performs no appointment scan;
- migration creates no reminder job;
- existing appointment timestamps are not rewritten;
- first jobs appear only through explicit planner, bounded reconciliation, or a later authoritative lifecycle mutation after policy enablement;
- no provider configuration is required.

Safe rollout:

1. apply migration;
2. verify tenant IANA timezone;
3. configure policy explicitly;
4. run bounded tenant reconciliation;
5. inspect durable jobs;
6. only later add manual operations UI in a separate task.

No cloud migration was applied in this task.

## 37. Cleanup

- task Vite process stopped;
- temporary SQL smoke script removed;
- temporary screenshots removed;
- concurrency fixtures removed by their script;
- final local `supabase db reset --no-seed` completed;
- smoke patient marker rows: `0`;
- smoke doctor marker rows: `0`;
- smoke appointment marker rows: `0`;
- reminder job rows: `0`;
- QA auth users: `0`.

The baseline migrations themselves retain their existing non-task demo tenant/patient/doctor rows after `--no-seed`; those rows were not created by this task and were not misreported as QA residue.

## 38. Checks: lint, tests, and build

Final local checks:

- ESLint: passed;
- full Vitest: **91 files / 1016 tests passed**;
- TypeScript build: passed;
- Vite production build: passed;
- transformed modules: `1953`;
- `git diff --check`: passed before report publication;
- no package or lockfile change.

Non-blocking baseline warnings remain:

- existing React `act(...)` warnings in older tests;
- existing Vite large-bundle warning.

## 39. Fresh CI

Pending PR creation and fresh GitHub Actions CI on the exact implementation head.

A second fresh CI run is required after the report-only metadata commit. The final CI run must test the exact final PR HEAD and include ESLint, tests, build, and merge guard.

The PR must remain open and unmerged.

## 40. Issues / Limitations

- callback work is deferred because the current model has no explicit callback due time;
- no full manual operations UI exists yet;
- ready state is derived, not background-mutated;
- ambiguous DST fall-back local time follows PostgreSQL standard-time occurrence;
- separately invokable Chrome DevTools MCP was unavailable, so equivalent HeadlessChrome was used;
- cloud Supabase remains untouched;
- existing unrelated React and bundle-size warnings remain baseline items.

These limitations do not compromise durable queue identity, invalidation, tenant isolation, or the no-delivery boundary.

## 41. What was intentionally not implemented

- SMS;
- WhatsApp delivery;
- email delivery;
- provider SDK or credentials;
- delivery attempts;
- delivery/provider states;
- provider message IDs;
- worker;
- cron;
- Edge Function;
- webhook;
- retry engine;
- templates;
- consent/contact redesign;
- phone normalization;
- public booking;
- broad settings UI;
- manual operations UI;
- appointment lifecycle redesign;
- finance or clinical workflow redesign;
- generated types;
- package changes;
- cloud migration apply;
- HEP-V2;
- PR merge.

## 42. Recommended next task

Recommended next task: **APPOINTMENT-REMINDER-MANUAL-OPERATIONS-001**

Reason: durable reminder jobs can now be created, invalidated, reconciled, audited, and read safely. Registrars next need a tenant-scoped operational queue where they can see due manual work, record completion, and reuse the existing confirmation-attempt workflow without provider automation.

This next task was not started.

Final task verdict: **APPOINTMENT REMINDER QUEUE FOUNDATION IMPLEMENTED AND VERIFIED**
