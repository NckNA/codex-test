# APPOINTMENT-CANCELLATION-NOSHOW-001: controlled appointment lifecycle actions

## Final verdict

Final verdict: **PASS**

APPOINTMENT CANCELLATION AND NO-SHOW LIFECYCLE IMPLEMENTED AND VERIFIED

## Summary

Appointment cancellation and no-show are now dedicated controlled lifecycle operations rather than generic status values. New transitions require auditable metadata, use tenant-scoped transactional RPCs, preserve operation-key idempotency and recovery, emit exactly one audit/activity pair, and enforce role, transition, tenant, optimistic-version, and concurrency boundaries in PostgreSQL.

The schedule UI separates `Cancel appointment`, `Mark no-show`, and physical `Delete appointment`. Terminal metadata remains visible after reload in SchedulePage and patient appointment history. Generic create, reschedule, and details RPCs cannot create, enter, or reactivate `cancelled` / `no_show` states.

No reminder, penalty, waitlist, finance, document, clinical, stock, amoCRM, cloud migration, or automatic expiry behavior was introduced.

## Branch

`feature/appointment-cancellation-noshow-001`

## PR URL

PENDING

## Baseline

- repository: `NckNA/codex-test`;
- required and verified `origin/main`: `1ec15f8df7285502d4c3726c9557d3a5ac712aac`;
- PR #348 was merged into that exact baseline;
- the task worktree was created from that baseline.

## PR head reviewed before final report update

- implementation head reviewed: PENDING;
- workflow: `CI`;
- run: PENDING;
- run ID: PENDING;
- conclusion: PENDING;
- the PR must remain open and unmerged.

## Report update commit

- Report update commit: N/A because the report commit cannot reference itself.
- The final report head and fresh CI run are recorded by the immutable finalization receipt.

## Changed files

- `supabase/migrations/0026_appointment_cancellation_noshow.sql`
- `supabase/tests/0026_appointment_cancellation_noshow_test.sql`
- `supabase/tests/0026_appointment_cancellation_noshow_concurrency.ps1`
- `supabase/tests/0025_appointment_conflict_hardening_test.sql`
- `src/types/index.ts`
- `src/data/repositories/AppointmentRepository.ts`
- `src/data/repositories/AppointmentRepository.test.ts`
- `src/data/hooks/useScheduleAppointments.ts`
- `src/data/hooks/useScheduleAppointments.test.tsx`
- `src/components/schedule/appointmentLifecycle.ts`
- `src/components/schedule/AppointmentCancellationDialog.tsx`
- `src/components/schedule/AppointmentNoShowDialog.tsx`
- `src/components/schedule/AppointmentLifecycleDialogs.test.tsx`
- `src/components/schedule/AppointmentModal.tsx`
- `src/components/schedule/AppointmentModal.test.tsx`
- `src/components/patients/patient-card/PatientHistoryTab.tsx`
- `src/components/patients/patient-card/PatientHistoryTab.test.tsx`
- `src/pages/SchedulePage.tsx`
- `_ai_work/REPORTS/APPOINTMENT-CANCELLATION-NOSHOW-001_lifecycle.md`

## Original lifecycle inventory

Before this task:

- `cancelled` and `no_show` were generic status options;
- create, reschedule, and details RPCs accepted terminal statuses;
- reason, source, actor, and lifecycle timestamp were not required;
- no dedicated audit/activity event represented either transition;
- generic tenant-member mutation permissions admitted doctor/cashier attempts;
- registrar UI exposed hard delete although backend RLS denied it;
- cancellation released its slot because conflict SQL excluded `cancelled`;
- `no_show` remained slot-blocking;
- hard delete was already a distinct physical operation.

## Lifecycle data model

Migration `0026` adds to `appointments`:

- `cancelled_at`, `cancelled_by`, `cancellation_source`, `cancellation_reason`;
- `no_show_at`, `no_show_by`, `no_show_reason`;
- `lifecycle_metadata_version`.

Historical terminal rows remain unchanged with version `0`; the migration does not invent missing facts. New controlled transitions write complete version `1` metadata.

## Controlled RPC contract

Dedicated RPCs:

- `cancel_appointment(...)`;
- `mark_appointment_no_show(...)`;
- existing `get_appointment_operation(...)` recovers both operation types.

They require tenant membership, permit only `clinic_owner`, `clinic_admin`, and `registrar`, reject doctor/cashier/no-membership/cross-tenant calls, validate metadata, lock the appointment, enforce expected `updated_at`, enforce transitions, reuse `appointment_operations`, and write one audit/activity pair.

A preliminary implementation left the lifecycle GUC active until transaction end. SQL tests reproduced a generic-create bypass in the same transaction. The final RPCs reset the one-time marker immediately after the protected update.

## Generic bypass protection

A lifecycle trigger rejects unauthorized terminal inserts/updates and terminal reactivation. Generic create/reschedule/details RPCs no longer accept `cancelled` or `no_show`.

`update_appointment_details` is replaced in `0026` so terminal-state denial occurs before unrelated conflict checks, producing the correct lifecycle error.

## Role and UI policy

- owner/admin: cancel, mark no-show, hard delete;
- registrar: cancel and mark no-show, no hard delete;
- doctor/cashier/no-tenant: no lifecycle or delete action;
- physical delete remains the existing owner/admin RLS operation.

Terminal statuses are removed from generic status controls. Separate dialogs require metadata, warn the user, disable duplicate submission, show reconciliation/safe errors, and retain a confirmed success view.

## Client, recovery, and stale context

The repository adds `cancelAppointment` and `markAppointmentNoShow` using the existing operation-key and recovery pattern. The hook shares duplicate calls, preserves keys after ambiguous failures, clears them after definitive failures, and discards results after context changes.

Browser QA found and fixed two integration defects, both covered by regression tests:

1. SchedulePage prematurely replaced modal `initialData`, closing the nested success view. The modal now owns its confirmed lifecycle result.
2. A delayed result for appointment A could overwrite newly selected appointment B. `AppointmentModal` verifies the captured appointment ID before applying a result.

## Audit and history

Each successful transition writes exactly one operation row, one audit row, and one activity row. Replay does not duplicate them.

Schedule details and patient history display terminal status, timestamp, reason, cancellation source where applicable, and a neutral `Clinic employee` label instead of a raw actor UUID. No-show wording does not imply completed treatment or a clinical encounter.

## Browser validation

Real local Supabase browser QA covered:

- owner/admin/registrar/doctor/cashier/no-tenant role matrix;
- cancellation and no-show with metadata, reload, and patient-history verification;
- separate cancellation and physical delete actions;
- rapid double submit;
- actual UI reuse of a released slot;
- lost response after commit with visible reconciliation and recovery;
- delayed old-appointment response after context change;
- two pre-opened sessions racing cancel versus no-show;
- tenant isolation and safe user-visible errors.

Chrome DevTools MCP used `chrome_devtools` version `1.5.0` in isolated headless contexts. It confirmed one logical result for double-click, successful rebooking of the released `17:00` slot, generic bypass rejection, `cancel_appointment` plus `get_appointment_operation` recovery, exactly one winner in the lifecycle race, RPC-only lifecycle writes with no direct PATCH/DELETE, and no service-role material, SQLSTATE, stack trace, or secret.

Existing unrelated accessibility issues were reported by Chrome. The expected HTTP 400 was the handled losing lifecycle race request.

## Database validation

The browser fixture snapshot proved:

- five cancellations and one no-show had complete metadata version `1`;
- duplicate, recovery, and race appointments each had one operation/audit/activity result;
- the released slot contained one new active appointment;
- active doctor overlaps: `0`;
- active patient overlaps: `0`;
- invalid intervals: `0`;
- all seven fixture `patients.balance` values were unchanged;
- visits, encounters, completed services, treatment plans, findings, dental charts, invoices, invoice items, payments, allocations, refunds, adjustments, and documents received zero side-effect rows.

Temporary QA users, tenants, patients, doctors, appointments, MCP clients, fixtures, logs, delay shims, and Vite processes were removed. The final local database was reset with `npx supabase db reset --no-seed`.

## SQL and concurrency validation

Passed after a fresh migration reset:

- `0024_legacy_core_table_grants_test.sql`;
- updated `0025_appointment_conflict_hardening_test.sql`;
- `0026_appointment_cancellation_noshow_test.sql`;
- `0025_appointment_conflict_concurrency.ps1`;
- `0026_appointment_cancellation_noshow_concurrency.ps1`.

Conflict hardening concurrency final result:

- success operations: `13`;
- appointment rows: `15`;
- unique appointment IDs: `13`;
- doctor overlaps: `0`;
- patient overlaps: `0`;
- invalid intervals: `0`;
- audit/activity: `13/13`;
- deadlocks: `0`.

Lifecycle concurrency final result:

- success count: `13`;
- replay count: `2`;
- conflict count: `5`;
- cancelled rows: `8`;
- no-show rows: `2`;
- audit/activity: `10/10`;
- active overlaps: `0`;
- deadlocks: `0`.

## Lint, tests, and build

Final checks:

- `npm run lint`: passed;
- `npm run test -- --run`: **87 files / 957 tests passed**;
- `npm run build`: passed;
- targeted lifecycle/repository/hook/modal/history suite: passed.

Existing unrelated React `act(...)` warnings and the existing Vite bundle-size warning remain. They did not fail the commands and were not introduced by this task.

## Security boundaries

- no frontend service-role key;
- no direct lifecycle table write;
- no cross-tenant lifecycle mutation;
- no raw database error displayed;
- operation rows remain unreadable to ordinary browser roles;
- generic terminal bypasses are rejected;
- lifecycle authorization does not leak across statements;
- hard delete remains separate and owner/admin-only.

## Issues / limitations

- Historical terminal rows cannot receive trustworthy reasons or actors retroactively and remain metadata version `0`.
- Terminal correction/reopen is intentionally unavailable and requires a dedicated audited workflow.
- No-show continues to block its original interval, preserving the existing slot policy.
- Hard delete and broad non-lifecycle appointment mutation permissions were not redesigned.

## What was intentionally not implemented

- reminders, confirmation messages, or cancellation notifications;
- penalties, deposits, or no-show charges;
- waitlist or slot-offer automation;
- terminal correction/reopen;
- room/chair resource model;
- finance, documents, stock, treatment, visit, encounter, or completed-service mutation;
- amoCRM integration;
- cloud Supabase apply;
- package or lock-file change;
- PR merge.

## Fresh CI

Implementation CI is pending after commit and push. A second fresh CI run is required after the final report-only metadata commit. The PR must remain open and unmerged.

## Recommended next task

**APPOINTMENT-LIFECYCLE-CORRECTION-001**

Reason: any correction or reopening must be a separate privileged operation with its own reason, actor, before/after audit, idempotency, and conflict revalidation rather than a return to generic status editing.
