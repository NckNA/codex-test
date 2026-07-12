# APPOINTMENT-CONFIRMATION-WORKFLOW-001

## 1. Final verdict

Task verdict: **APPOINTMENT CONFIRMATION WORKFLOW IMPLEMENTED AND VERIFIED**

Machine-readable final verdict: **PASS**

The appointment confirmation workflow is implemented as an auditable operational fact that is separate from appointment attendance, clinical treatment, completed services, billing, and the legacy appointment status value `confirmed`.

The implementation passed local migration reset, typed schema assertions, SQL validation, concurrency validation, the full TypeScript quality gate, and real-browser Chrome DevTools MCP scenarios. The pull request must remain open and unmerged.

## 2. Summary

The schedule now supports controlled confirmation work through two explicit actions:

1. record a contact attempt;
2. confirm an appointment directly.

Each successful action uses a tenant-scoped transactional RPC, an operation key, optimistic version checking, immutable attempt history, and exactly one audit/activity pair. The UI shows the current confirmation state, attempt count, latest outcome, confirmed timestamp/channel, and attempt history.

No SMS, WhatsApp, email, reminder, background job, finance, clinical, stock, document, or cloud workflow was introduced.

## 3. Branch

`feature/appointment-confirmation-workflow-001`

## 4. PR URL

https://github.com/NckNA/codex-test/pull/350

## 5. Baseline

- repository: `NckNA/codex-test`;
- base branch: `main`;
- required and verified baseline: `17caef8336a0627ff01d0615d0847eec01255324`;
- PR #349 was verified as merged into that exact baseline;
- the task worktree was created from the verified baseline;
- cloud Supabase was not used.

## 6. Implementation head reviewed before final report update

- implementation head: `9aedc88620e35054521efaab7f506b122f8969ae`;
- workflow: `CI`;
- run number: `#707`;
- run ID: `29195697038`;
- conclusion: `success`;
- tested commit: `9aedc88620e35054521efaab7f506b122f8969ae`;
- tested commit matched the implementation head exactly;
- ESLint, tests, and build passed;
- the pull request remains open and unmerged.

## 7. Report update commit

Report update commit: N/A because a report-only commit cannot contain its own future SHA or the CI result that tests it.

The exact final report-only commit and fresh final CI run must be recorded in the immutable finalization receipt and final task response.

## 8. Changed files

Implementation and tests:

- `src/components/patients/patient-card/PatientHistoryTab.test.tsx`;
- `src/components/patients/patient-card/PatientHistoryTab.tsx`;
- `src/components/schedule/AppointmentConfirmationPanel.test.tsx`;
- `src/components/schedule/AppointmentConfirmationPanel.tsx`;
- `src/components/schedule/AppointmentModal.test.tsx`;
- `src/components/schedule/AppointmentModal.tsx`;
- `src/components/schedule/appointmentConfirmation.ts`;
- `src/data/hooks/useScheduleAppointments.test.tsx`;
- `src/data/hooks/useScheduleAppointments.ts`;
- `src/data/repositories/AppointmentRepository.test.ts`;
- `src/data/repositories/AppointmentRepository.ts`;
- `src/pages/SchedulePage.tsx`;
- `src/types/index.ts`;
- `supabase/migrations/0027_appointment_confirmation_workflow.sql`;
- `supabase/tests/0027_appointment_confirmation_workflow_concurrency.ps1`;
- `supabase/tests/0027_appointment_confirmation_workflow_test.sql`;
- `_ai_work/REPORTS/APPOINTMENT-CONFIRMATION-WORKFLOW-001_workflow.md`.

No package, lockfile, generated type, environment file, screenshot, local fixture, MCP helper, or cloud migration file belongs in the final diff.

## 9. Original confirmation inventory

Before this task:

- confirmation existed only as the legacy scheduling status `appointment.status = confirmed`;
- no separate confirmation state existed;
- no actor, time, channel, note, attempt count, or latest outcome was stored;
- no immutable attempt history existed;
- no idempotent confirmation operation existed;
- no recovery operation existed for an uncertain response;
- the generic appointment editor could select `confirmed` as an ordinary status;
- patient history could show the old status but not auditable confirmation facts;
- the SMS page was a placeholder and no reminder/provider architecture existed.

## 10. Confirmation domain semantics

Confirmation is an administrative communication fact, not a visit fact.

The implementation explicitly preserves these distinctions:

```text
confirmed appointment != patient arrived
confirmed appointment != encounter started
confirmed appointment != service completed
message sent != patient confirmed
contact attempt != successful contact
legacy status confirmed != audited confirmation metadata
```

The workflow does not create visits, encounters, completed services, invoices, payments, documents, or stock movements.

## 11. Historical compatibility

Existing rows are not assigned invented actor, timestamp, channel, or note metadata.

Migration `0027` gives historical appointments:

- `confirmation_state = unconfirmed`;
- `confirmation_attempt_count = 0`;
- `confirmation_metadata_version = 0`;
- null confirmation actor/time/channel/outcome metadata.

A historical `appointment.status = confirmed` remains unchanged as a legacy scheduling status, but it is not treated as a new auditable confirmation.

## 12. Appointment confirmation data model

Migration `0027` adds to `appointments`:

- `confirmation_state`;
- `confirmed_at`;
- `confirmed_by`;
- `confirmation_channel`;
- `confirmation_note`;
- `last_confirmation_attempt_at`;
- `confirmation_attempt_count`;
- `confirmation_metadata_version`;
- `last_confirmation_outcome`;
- `last_confirmation_note`.

Database constraints enforce coherent metadata for confirmed and non-confirmed rows.

## 13. Attempt history model

The new table `public.appointment_confirmation_attempts` stores:

- tenant;
- appointment;
- patient;
- actor;
- channel;
- outcome;
- note;
- attempted timestamp;
- operation key;
- fingerprint;
- created timestamp.

The table is RLS-enabled. Authenticated users receive tenant-scoped read access only. Frontend direct INSERT, UPDATE, and DELETE are not granted.

## 14. Confirmation state model

Supported states:

- `unconfirmed`;
- `contact_in_progress`;
- `confirmed`;
- `unreachable`;
- `callback_requested`.

The state is derived from the latest controlled contact outcome. The latest outcome remains separately visible so operational meaning is not lost when several outcomes map to the same attention state.

## 15. Contact channels and outcomes

Supported channels:

- phone;
- WhatsApp;
- SMS;
- email;
- in person;
- other.

Supported outcomes:

- confirmed;
- no answer;
- unreachable;
- callback requested;
- declined;
- wrong number;
- message sent;
- other.

`message_sent` maps to `contact_in_progress`, not `confirmed`.

## 16. Controlled RPC contract

Dedicated RPCs:

- `record_appointment_confirmation_attempt(...)`;
- `confirm_appointment(...)`;
- existing `get_appointment_operation(...)` extended for confirmation recovery.

The RPCs:

- require authenticated tenant membership;
- authorize only clinic owner, clinic admin, and registrar;
- lock the appointment row;
- enforce expected `updated_at`;
- validate appointment status and metadata;
- reuse `appointment_operations`;
- write the appointment state and history atomically;
- write exactly one audit/activity pair;
- return a safe structured result.

## 17. Transition policy

Confirmation actions are allowed for operationally confirmable scheduling rows, including `new` and historical legacy `confirmed` status rows.

Actions are rejected for:

- arrived;
- in progress;
- completed;
- cancelled;
- no-show;
- blocked.

No unconfirm/reopen/correction operation was added. That requires a separate privileged audited workflow.

## 18. Idempotency and replay

Each confirmation mutation uses a tenant-scoped operation key and fingerprint.

Behavior:

- the same key and same payload replays one logical result;
- replay does not duplicate attempt, operation, audit, or activity rows;
- the same key with changed payload is rejected;
- operation keys are independent across tenants;
- duplicate browser submission shares one in-flight promise.

## 19. Uncertain-response recovery

If the write request may have committed but the client receives an uncertain transport result, the repository calls `get_appointment_operation` with the original key.

The hook:

- exposes reconciliation state;
- preserves the same key after ambiguous failure;
- clears the key after definitive failure or confirmed success;
- ignores late results after tenant or appointment context changes.

Real-browser QA intentionally lost a successful response after commit and recovered exactly one saved attempt.

## 20. Optimistic concurrency model

Confirmation mutations require the appointment `updated_at` version observed by the client.

Two independent actions against the same stale version do not silently merge. One action wins; the other receives a controlled concurrent-change result and must reload before intentionally retrying.

This model was verified for:

- attempt versus attempt;
- confirm versus cancel;
- confirm versus no-show;
- confirm versus reschedule;
- stale expected version.

## 21. Generic status separation

The generic appointment status editor no longer exposes `confirmed` as the way to confirm an appointment.

The legacy `AppointmentStatus` value remains supported for historical data compatibility, but all new operational confirmation uses the dedicated confirmation panel and RPC boundary.

Generic appointment details edits preserve confirmation metadata and cannot directly reset or fabricate confirmation facts.

## 22. Role matrix

| Role | Read confirmation facts | Record attempt | Confirm |
| --- | --- | --- | --- |
| clinic_owner | yes | yes | yes |
| clinic_admin | yes | yes | yes |
| registrar | yes | yes | yes |
| doctor | yes | no | no |
| cashier | yes | no | no |
| unknown / no tenant | no tenant data | no | no |

Backend authorization remains authoritative even when UI actions are hidden.

## 23. Tenant and RLS boundaries

The implementation enforces:

- tenant-scoped appointment lookup;
- tenant-scoped attempt history SELECT;
- cross-tenant mutation rejection;
- no-tenant denial;
- tenant-local operation keys;
- patient/appointment tenant consistency;
- no raw operation ledger visibility to ordinary browser roles.

Real-browser tenant B isolation showed tenant B data while hiding tenant A confirmation fixtures.

## 24. Audit and activity events

Every successful confirmation attempt writes:

- one `appointment_operations` row;
- one `audit_events` row;
- one `activity_events` row.

Direct confirmation records an immutable attempt with outcome `confirmed` and emits the confirmation event once.

Replay, duplicate click, recovery, and losing race requests do not create duplicate audit/activity facts.

## 25. Repository implementation

`AppointmentRepository` now supports:

- `recordConfirmationAttempt`;
- `confirmAppointment`;
- `listConfirmationAttempts`;
- confirmation-aware operation recovery;
- row mapping for all confirmation metadata;
- safe confirmation error mapping.

The Supabase repository contains no direct confirmation INSERT/UPDATE and no service-role or localStorage fallback path.

## 26. Hook implementation

`useScheduleAppointments` adds:

- confirmation attempt mutation;
- direct confirmation mutation;
- shared in-flight exclusion with cancellation/no-show operations;
- operation-key retention and recovery;
- explicit recording/confirming/reconciling states;
- one refetch after confirmed success;
- stale tenant/context protection.

Rapid duplicate calls receive the same promise and invoke the repository once.

## 27. Schedule UI

`AppointmentConfirmationPanel` displays:

- confirmation state;
- attempt count;
- latest attempt time;
- latest outcome;
- confirmed time;
- confirmed channel;
- latest note;
- expandable attempt history.

Authorized users receive separate actions:

- `Зафиксировать попытку связи`;
- `Подтвердить запись`.

The panel explains that confirmation does not mean arrival or completed treatment.

## 28. Attention view

SchedulePage shows an operational count and filter for appointments that still require confirmation attention.

The attention set includes:

- unconfirmed;
- contact in progress;
- unreachable;
- callback requested.

It excludes confirmed, cancelled, and no-show rows. Callback and unreachable outcomes remain visible instead of disappearing from the work queue.

## 29. Patient appointment history

Patient history shows confirmation facts inside the appointment history row:

- state;
- attempt count;
- last attempt;
- latest outcome;
- confirmed timestamp;
- channel;
- note.

The wording does not imply that treatment was completed, a visit occurred, or a clinical encounter was created.

## 30. Validation and safe errors

The UI requires:

- selected contact channel;
- selected contact outcome for an attempt;
- trimmed optional note;
- valid appointment context.

The backend revalidates all fields and authorization.

Safe user-visible errors cover:

- missing channel;
- missing outcome;
- already confirmed;
- invalid transition;
- permission denial;
- concurrent change;
- idempotency conflict;
- unresolved recovery.

Raw SQLSTATE, function names, fingerprints, and stack traces are not exposed.

## 31. Browser-discovered nested-form defect

The first integrated browser run discovered that the confirmation panel contained a nested `<form>` inside the main appointment editor form.

HTML form nesting is invalid. Clicking confirmation submit triggered the outer appointment form and navigated to `/?` without invoking the confirmation RPC.

The panel was changed to a non-form container with explicit `type="button"` submission. A regression test now requires exactly one form inside `AppointmentModal` while the confirmation attempt UI is open.

Chrome DevTools MCP then verified the correct confirmation RPC and visible saved history.

## 32. Component and integration tests

Added or updated tests cover:

- state, attempt count, latest outcome, channel, and history display;
- required channel/outcome;
- note trimming;
- `message_sent` not becoming confirmed;
- direct confirmation success;
- reconciliation and safe errors;
- owner/admin/registrar actions;
- doctor/cashier/unknown read-only behavior;
- terminal status action hiding;
- attention policy;
- removal of legacy generic confirmed action;
- no nested form regression;
- patient-history confirmation facts without clinical wording.

## 33. Repository and hook tests

Repository tests cover:

- exact RPC signatures;
- attempt mapping;
- direct confirm mapping;
- tenant-scoped history SELECT;
- same-key recovery;
- safe error mapping;
- source scan for RPC-only mutation boundaries.

Hook tests cover:

- rapid duplicate attempt;
- attempt versus confirm mutual exclusion;
- ambiguous retry with the same key;
- definitive failure with a new corrected key;
- stale tenant success suppression;
- one refresh after confirmed success.

## 34. SQL validation

Passed after a fresh local migration reset:

- `0024_legacy_core_table_grants_test.sql`;
- `0025_appointment_conflict_hardening_test.sql`;
- `0026_appointment_cancellation_noshow_test.sql`;
- `0027_appointment_confirmation_workflow_test.sql`.

The `0027` SQL test validates historical compatibility, owner/admin/registrar permissions, doctor/cashier/no-tenant denial, tenant isolation, state mapping, replay, changed-payload conflict, recovery, terminal blocking, RLS, generic edit preservation, and zero clinical/financial side effects.

## 35. Concurrency validation

Passed:

- `0025_appointment_conflict_concurrency.ps1`;
- `0026_appointment_cancellation_noshow_concurrency.ps1`;
- `0027_appointment_confirmation_workflow_concurrency.ps1`.

Final confirmation concurrency result:

```text
successCount=12
replayCount=2
conflictCount=7
attempts=10
confirmations=6
operations=10
audit=10
activity=10
duplicateKeys=0
deadlocks=0
```

No active doctor/patient overlap or invalid interval was introduced.

## 36. Browser smoke: Chrome DevTools MCP A-J

Chrome DevTools MCP server version `1.5.0` ran isolated real-browser contexts against local Vite and local Supabase.

Verified scenarios:

- role visibility for owner/admin/registrar/doctor/cashier/no-tenant;
- tenant B isolation;
- A: no answer;
- B: callback requested;
- C: direct WhatsApp confirmation and reload persistence;
- D: message sent without confirmation;
- E: rapid double click with one RPC;
- F: lost committed response with visible reconciliation and recovery;
- G: confirmation versus cancellation race with one winner;
- J: delayed old-appointment result hidden after context switch;
- patient-history confirmation facts without treatment wording.

## 37. Network validation

Observed application mutation requests used only:

- `POST /rest/v1/rpc/record_appointment_confirmation_attempt`;
- `POST /rest/v1/rpc/confirm_appointment`;
- `POST /rest/v1/rpc/get_appointment_operation` for recovery;
- existing controlled lifecycle RPC for the intentional losing race.

No direct appointment PATCH was used for confirmation.

No direct POST to `appointment_confirmation_attempts` was used.

No frontend service-role material, SQLSTATE, secret, or unhandled rejection was observed.

## 38. Database validation

Final browser fixture snapshot:

- confirmation attempts: `8`;
- confirmed outcomes: `2`;
- appointment operations: `8`;
- audit events: `8`;
- activity events: `8`;
- duplicate operation keys: `0`;
- duplicate attempt keys: `0`;
- invalid tenant/patient links: `0`;
- doctor overlaps: `0`;
- patient overlaps: `0`;
- invalid intervals: `0`.

Double-click, recovery, and race scenarios each produced exactly one logical result.

## 39. Side-effect and cleanup validation

All nine fixture `patients.balance` control values remained unchanged.

Zero task side-effect rows were created in:

- visits;
- encounters;
- completed services;
- treatment plans;
- findings;
- dental charts;
- invoices;
- invoice items;
- payments;
- allocations;
- refunds;
- financial adjustments;
- documents.

Temporary QA users, tenants, patients, doctors, appointments, attempts, MCP scripts, fixtures, logs, and task Vite processes were removed.

The local database was reset with `npx supabase db reset --no-seed`; final auth, tenant, patient, appointment, attempt, operation, audit, and activity control counts were zero.

## 40. Checks: lint, tests, and build

Final checks after the browser-discovered fix and cleanup:

- ESLint: passed;
- full Vitest suite: **88 files / 987 tests passed**;
- TypeScript build: passed;
- Vite production build: passed;
- transformed modules: `1952`;
- `git diff --check`: required before commit.

Non-blocking baseline warnings:

- existing React `act(...)` warnings in older tests;
- existing Vite large-bundle warning.

No package dependency was changed.

## 41. Issues / Limitations

Security boundaries:

- no frontend service-role key;
- no direct confirmation table mutation;
- no cross-tenant mutation;
- no raw database error displayed;
- operation-key fingerprints remain internal;
- role and terminal-status checks are enforced server-side;
- cloud Supabase remains untouched.

Known limitations and excluded scope:

- historical legacy confirmed rows remain metadata version `0`;
- no correction/unconfirm/reopen workflow;
- no automated reminder scheduler;
- no SMS, WhatsApp, email, or provider integration;
- no callback task scheduler;
- no call-center queue beyond the narrow attention filter;
- no public booking;
- no finance, penalty, deposit, document, treatment, encounter, stock, or amoCRM mutation;
- no package/lockfile/generated-type change;
- no PR merge.

## 42. Recommended next task

Implementation CI: workflow `CI`, run `#707`, run ID `29195697038`, conclusion `success`, tested commit `9aedc88620e35054521efaab7f506b122f8969ae`.

A second fresh CI run is mandatory after the report-only metadata commit. The final CI run must test the exact final PR HEAD.

The PR must remain open and unmerged.

Recommended next task: **APPOINTMENT-CONFIRMATION-CORRECTION-001**

Reason: an incorrect confirmation must not be reset through generic status editing. Any correction/unconfirm operation should require privileged authorization, a correction reason, before/after audit data, idempotency, and optimistic conflict validation.

This next task was not started.

Final task verdict: **APPOINTMENT CONFIRMATION WORKFLOW IMPLEMENTED AND VERIFIED**
