# AUDIT-ACTIVITY-LOG-RECON-001: audit and activity log architecture

## 1. Summary

This report researches the current DentalFlow CRM audit/activity state and proposes a future audit/activity architecture before visits, encounters, completed services, payments, stock, documents, correction flows, and support access are implemented.

Current finding: the database already has a minimal `audit_logs` table, but the current product does not yet have a complete immutable audit/activity model. The existing table is useful as an early scaffold, but it is not enough for clinical corrections, completed service changes, payment/refund adjustments, role changes, support access, or patient-visible activity.

Recommendation: use a hybrid staged approach. Keep patient timeline as a patient-facing summary layer, introduce explicit `audit_events` and either `activity_events` or a filtered activity view, and require transactional/RPC or trusted service-layer audit writes for high-risk clinical, financial, role, and correction flows. Because apparently "who changed the money and the medical fact" should not be answered by shrugging at a calendar row.

## 2. Branch name

`recon/audit-activity-log-001`

## 3. PR URL

Pending until PR creation.

## 4. PR head reviewed before final report update

Pending final report update.

## 5. Report update commit

N/A because the final report update commit cannot reference itself before creation.

## 6. Changed files summary

Exactly one report file:

- `_ai_work/REPORTS/AUDIT-ACTIVITY-LOG-RECON-001_audit_activity_log.md`

No code, migrations, Supabase cloud, local Supabase, browser smoke, or implementation changes were made.

## 7. Current state recon

### Existing audit/activity support

Current migration `0001_initial_schema.sql` creates `audit_logs` with:

- `id`
- `tenant_id`
- `user_id`
- `action`
- `entity_type`
- `entity_id`
- `metadata`
- `created_at`

RLS is enabled for `audit_logs`. Tenant members can read tenant audit logs, and users can insert audit logs in their tenant. Update and delete are intentionally not granted.

This means DentalFlow has an audit-like scaffold, but not a mature compliance/event architecture. Missing pieces include:

- before/after safe diff;
- redaction policy;
- severity;
- event category;
- role visibility;
- reason/correction note;
- correction chain;
- request/session context;
- patient/appointment/visit/encounter/completed-service/payment/stock/file link columns;
- support access mode;
- explicit write-path rules.

There is no dedicated activity feed UI. Patient timeline is currently computed from source tables and should remain distinct from raw audit.

### Existing actor attribution

Current source inspection:

- `patients`: has `created_at`/`updated_at`, but no `created_by` or `updated_by` in the inspected initial schema.
- `appointments`: has `doctor_id`, `created_at`, `updated_at`, but no `created_by` or `updated_by`.
- `findings`: has `created_at`/`updated_at`, but no `created_by`, `updated_by`, or `archived_by`; archive is currently represented through status update in code.
- `treatment_plans`: has `created_at`/`updated_at`, but no actor fields.
- `treatment_stages`: has `created_at`/`updated_at`, but no actor fields.
- `patient_files`: has `uploaded_by`, `archived_by`, `created_at`, `updated_at`, and `archived_at`.
- `tenant_users`: has `user_id`, `role`, and `created_at`; no actor fields for who granted/revoked role.
- `clinical dictionary` data exists as product dictionary/template direction, but dictionary import/bootstrap is not yet a robust audited product flow.
- `storage.objects`: storage policy is tenant/path-based, but metadata in `patient_files` is the proper auditable application record.

### Existing timestamps

Current source inspection:

- `patients`: `created_at`, `updated_at`.
- `appointments`: `start_time`, `end_time`, `created_at`, `updated_at`.
- `chief_complaints`: `created_at`, `updated_at`.
- `dental_charts`: `created_at`, `updated_at`.
- `tooth_states`: `created_at`, `updated_at`.
- `findings`: `created_at`, `updated_at`.
- `treatment_plans`: `created_at`, `updated_at`.
- `treatment_stages`: `created_at`, `updated_at`.
- `documents`: `created_at` only in initial schema.
- `patient_files`: `created_at`, `updated_at`, `archived_at`.
- `audit_logs`: `created_at`.

No stable `completed_at`, `cancelled_at`, `deleted_at`, or `correction_at` model exists yet for high-risk future flows.

### Sensitive flows that need audit

Current and future flows requiring audit design:

- patient profile create/update/archive;
- appointment schedule/reschedule/cancel/no-show/status change;
- finding create/update/status/archive;
- treatment plan create/update/stage update/cancel/archive;
- patient file upload/archive/metadata update;
- role/membership grant/revoke;
- clinical dictionary bootstrap/import/change;
- future visit check-in/check-out/cancel;
- future encounter start/complete/correction;
- future completed service creation/correction/reversal;
- future invoice/payment/refund/debt adjustment;
- future stock movement/write-off/correction;
- future document generation/signature/archive;
- future platform support access.

### Current gaps

The current system cannot reliably answer, for every sensitive object:

- who changed it;
- what changed before and after;
- why a correction happened;
- whether the correction was authorized;
- whether source data changed retroactively;
- whether a patient timeline event is source-of-truth or only computed;
- whether a platform/support actor accessed patient data.

## 8. Definitions

### Audit event

An immutable security/compliance record of a data mutation or sensitive access/action.

It must answer:

- who performed the action;
- in which tenant/context;
- what object was targeted;
- what action occurred;
- when it occurred;
- before/after or safe diff where needed;
- reason/correction note where needed;
- request/session context where safe;
- whether the event is security, clinical, financial, support, or system relevant.

Audit is for accountability, investigation, correction history, compliance, and debugging high-risk workflow. Audit must not be freely editable or used as a casual UI note bucket.

### Activity event

A product-level workflow event that is safe and useful for users. It may be derived from audit events or from source tables.

Examples:

- appointment cancelled;
- visit checked in;
- encounter completed;
- file uploaded;
- service corrected;
- payment recorded.

Activity is summarized. It should not expose raw diffs or sensitive hidden fields.

### Patient timeline event

A patient-centered chronological UI event. It can combine source-computed facts and selected activity events.

It should respect role visibility and avoid raw audit details. The patient timeline is not the canonical audit log. It is the readable patient story, not the black box recorder.

### System log

A developer/operator log for troubleshooting runtime behavior. It is not patient history and is not enough for compliance.

## 9. Architecture options compared

### Option 1: application-level audit writes

Every repository/service writes an audit row after mutation.

Pros:

- simple to understand;
- easy to include business context;
- easy to redact before/after fields;
- aligns with current repository pattern.

Cons:

- easy to forget;
- inconsistent across direct SQL/RPC paths;
- risky for high-value facts like completed service correction or payment refund;
- hard to enforce atomicity after mutation failure.

Verdict: acceptable for low-risk flows, not enough by itself.

### Option 2: database triggers

Postgres triggers write audit rows on insert/update/delete.

Pros:

- harder to bypass;
- captures direct database changes;
- consistent at the table layer.

Cons:

- weak business context;
- noisy;
- before/after JSON can over-capture medical or financial data;
- RLS/auth context must be handled carefully;
- difficult to express correction reason cleanly.

Verdict: useful as a safety layer for selected high-risk tables later, but not as the only product audit model.

### Option 3: RPC/service-layer mutations only

Sensitive mutations go through SQL RPC or trusted service functions that write domain object + audit atomically.

Pros:

- best consistency for clinical corrections, completed services, payments, role changes;
- can require reason/correction note;
- writes audit in the same transaction;
- easier to enforce append/correction semantics.

Cons:

- more architecture work;
- may require moving some current direct repository writes behind RPC/service boundaries;
- not ideal for every small UI update.

Verdict: best for high-risk future flows.

### Option 4: hybrid staged approach

Near term:

- design richer `audit_events`;
- create activity projection/view or table;
- require explicit audit for sensitive flows.

Later:

- RPC/service-layer writes for high-risk flows;
- optional triggers for selected tables;
- activity/timeline integration;
- admin/support audit viewers.

Pros:

- practical;
- avoids over-engineering all current tables immediately;
- supports visits/encounters/completed services/payments/stock/documents;
- allows hardening over time.

Cons:

- requires discipline;
- must document audited vs unaudited flows;
- must not leave broad client insert forever.

Verdict: recommended for DentalFlow.

## 10. Recommended architecture

Use the hybrid staged approach.

Recommended direction:

1. Keep current patient timeline as source-computed patient history.
2. Introduce a richer append-only `audit_events` model.
3. Add either `activity_events` or a filtered activity view for product-facing summaries.
4. Use transactional RPC/service-layer audit for future high-risk flows:
   - completed services;
   - clinical corrections;
   - payment/refund/debt adjustments;
   - role and membership changes;
   - support/platform access.
5. Consider database triggers later for selected high-risk tables as safety net, not as the whole design.
6. Integrate selected safe activity events into PatientTimelineAggregator later.

Why this fits the current repo:

- The repo already has tenant-scoped RLS and role helpers.
- Current repositories still mix local and Supabase paths.
- Current audit table is too minimal for sensitive corrections.
- Timeline already has a normalized event interface and should not become raw audit.
- Future visit/encounter/completed-service/payment/stock modules need audit before mutation-heavy UI exists.

## 11. Proposed future data model

This is design only. No schema was implemented.

### `audit_events`

Suggested fields:

- `id uuid primary key`
- `tenant_id uuid nullable only for platform/global events`
- `actor_user_id uuid nullable`
- `actor_role text nullable`
- `actor_tenant_role text nullable`
- `actor_display_name text nullable`
- `action text not null`
- `category text not null`
- `severity text not null default 'info'`
- `target_type text not null`
- `target_id text not null`
- `patient_id uuid nullable`
- `appointment_id uuid nullable`
- `visit_id uuid nullable`
- `encounter_id uuid nullable`
- `treatment_plan_id text/uuid nullable`
- `treatment_stage_id text/uuid nullable`
- `finding_id text/uuid nullable`
- `file_id text/uuid nullable`
- `payment_id uuid nullable`
- `stock_movement_id uuid nullable`
- `before_data jsonb nullable`
- `after_data jsonb nullable`
- `diff_data jsonb nullable`
- `redaction_level text not null`
- `reason text nullable`
- `request_id text nullable`
- `session_id text nullable`
- `ip_address text nullable if safe`
- `user_agent text nullable if safe`
- `created_at timestamptz not null default now()`

### `activity_events` or activity view

Two viable designs:

1. Separate `activity_events` table emitted by trusted flows.
2. View/materialized view over selected `audit_events`.

Suggested fields if table:

- `id uuid primary key`
- `tenant_id uuid not null`
- `patient_id uuid nullable`
- `actor_user_id uuid nullable`
- `category text not null`
- `type text not null`
- `title text not null`
- `description text nullable`
- `source_type text not null`
- `source_id text not null`
- `visibility text not null`
- `occurred_at timestamptz not null`
- `metadata jsonb nullable`
- `created_at timestamptz not null default now()`

Recommendation: start with `audit_events` and design `activity_events` as either view or table in the same schema task. If product needs editable summary labels later, table may be easier. If audit-derived summaries are enough, view may reduce duplication.

### Correction model

Add correction fields:

- `reason`
- `correction_note`
- `corrected_event_id`
- `supersedes_event_id`

Correction should be append-only for clinical and financial facts. The old fact should not silently disappear.

### Redaction strategy

Rules:

- never store secrets;
- never store credential values;
- never store full file contents;
- do not log raw service keys;
- limit before/after JSON size;
- store medical/financial diffs only when needed;
- apply role-restricted visibility;
- redact noisy UI state;
- summarize patient timeline events instead of exposing raw audit diff.

### Indexes

Suggested indexes:

- `(tenant_id, created_at desc)`
- `(patient_id, created_at desc)`
- `(actor_user_id, created_at desc)`
- `(target_type, target_id)`
- `(category, action)`
- `(severity)`
- `(visit_id)` when visits exist
- `(encounter_id)` when encounters exist
- `(payment_id)` when payments exist
- `(stock_movement_id)` when stock exists

### RLS principles

Suggested policy direction:

- tenant isolation is mandatory;
- clinic owner/admin can read tenant audit with category restrictions if product policy requires;
- doctor can read clinical patient-relevant activity, not necessarily all security audit;
- registrar can read appointment/admin activity, not clinical diffs;
- cashier can read financial activity, not clinical notes/diffs;
- no-tenant gets no audit data;
- cross-tenant gets no audit data;
- platform role gets no patient audit data by default;
- support access must be explicit, reasoned, time-limited, and audited;
- broad client insert should not be allowed for mature audit;
- inserts for high-risk categories should happen through trusted mutation paths.

## 12. Event categories and actions

### Categories

Required categories:

- `auth`
- `tenant`
- `role_membership`
- `patient`
- `appointment`
- `visit`
- `encounter`
- `finding`
- `treatment_plan`
- `completed_service`
- `file`
- `document`
- `payment`
- `stock`
- `dictionary`
- `billing_subscription`
- `system`
- `support_access`

### Action examples

Required action examples:

- `create`
- `update`
- `archive`
- `restore`
- `delete_requested`
- `delete_hard_admin_only`
- `status_change`
- `assign`
- `unassign`
- `upload`
- `sign`
- `cancel`
- `check_in`
- `check_out`
- `start_encounter`
- `complete_encounter`
- `perform_service`
- `correct_service`
- `invoice_create`
- `payment_create`
- `refund_create`
- `stock_writeoff`
- `role_grant`
- `role_revoke`
- `tenant_switch`
- `support_access_start`
- `support_access_end`

### Compliance-critical actions

Always compliance-critical:

- clinical correction;
- completed service correction;
- payment/refund/debt adjustment;
- role grant/revoke;
- support access start/end;
- hard delete request/approval if ever allowed;
- document signature/archive;
- file archive/removal;
- stock write-off correction.

### Patient timeline eligible

Candidate timeline-visible summaries:

- visit checked in/out;
- encounter started/completed;
- completed service performed;
- service corrected as summary only;
- appointment cancelled/no-show;
- file uploaded/archived;
- document generated/signed;
- invoice/payment created as financial summary if role allows.

### Admin-only/security-only

Keep out of patient timeline:

- raw role changes unless admin audit viewer;
- support access internals;
- auth/session details;
- raw before/after clinical diff;
- raw financial diff;
- service role/system internals;
- noisy UI state.

## 13. Patient timeline integration plan

Current patient timeline is computed from source tables:

- patient;
- chief complaint;
- findings;
- treatment plans;
- appointments;
- patient files.

Future patient timeline should add selected activity/audit-derived events:

- visit checked in/out;
- encounter started/completed;
- completed service performed;
- service corrected summary;
- invoice/payment activity if role allows;
- stock/material used only if useful and not noisy;
- document generated/signed;
- important patient-visible system events.

Recommended model:

- keep source-computed facts for primary clinical/admin domain objects;
- add selected `activity_events` as an additional timeline source;
- never expose raw audit diff in patient timeline;
- use a separate admin audit viewer for detailed before/after;
- use role visibility before rendering.

Correction display:

- timeline summary: `Service corrected` or `Payment adjusted`;
- detailed diff: audit viewer only;
- old facts remain visible as corrected/superseded, not silently rewritten.

## 14. Role and visibility rules

### clinic_owner / clinic_admin

Can see tenant audit/activity according to product policy. Should be able to review corrections, role changes, clinical/admin/financial actions, and export later if allowed.

Open decision: whether clinic admin sees full clinical diffs or only correction summaries.

### doctor

Can see clinical activity for the clinic and assigned/relevant patients. Can see own actions. Should not automatically see all financial/payment audit unless product policy allows.

### registrar / receptionist

Can see appointment/admin activity and check-in/check-out status. Should not see clinical note diffs or detailed findings unless product policy explicitly allows.

### cashier

Can see payment/debt/invoice activity. May need completed service names for billing, but should not see detailed clinical notes/findings unless explicitly allowed.

### no-tenant

No access.

### cross-tenant

No access.

### platform roles

No patient data by default. Support access must be explicit, time-limited, reasoned, and audited.

### Open product decisions

- Can clinic admin see full clinical diffs?
- Can doctors see financial status?
- Can cashiers see completed service names?
- Can registrar see performed service names?
- Should patients ever see a simplified activity log?
- How long are audit events retained?
- Who can export audit logs?
- What is the correction approval flow?

## 15. Write path strategy

### Low-risk UI/admin changes

App-level audit can be acceptable if low risk and not clinical/financial/security critical.

### Clinical facts

Encounters, completed services, and corrections should use transactional RPC/service-layer audit.

### Payments/refunds/debt adjustments

Transactional audit required. Payment changes must not be casual frontend updates.

### Role/membership changes

Transactional audit required. Role grants/revokes must record actor, target user, tenant, old role, new role, and reason where applicable.

### Storage/file metadata

Audit metadata action:

- upload;
- archive;
- metadata update;
- file removal request if ever allowed.

Do not audit raw object contents.

### Hard delete

Avoid hard delete for clinical/financial history. Use archive/correction. If hard delete exists later, audit `delete_requested` and approval separately.

### Existing and future repositories

Future audit responsibilities:

- `FindingsRepository`: audit create/update/status/archive.
- `TreatmentPlansRepository`: audit plan/stage create/update/cancel/archive.
- `PatientFilesRepository`: audit upload/archive/metadata update.
- `AppointmentRepository`: audit schedule/reschedule/cancel/no-show/status changes.
- future `VisitsRepository`: audit check-in/check-out/cancel.
- future `EncountersRepository`: audit start/complete/correction.
- future `CompletedServicesRepository`: transactional audit for perform/correct/reverse.
- future `PaymentsRepository`: transactional audit for invoice/payment/refund/debt adjustment.
- future `StockRepository`: audit movement/write-off/correction.
- future `TenantUsersRepository`: transactional audit for role grants/revokes.

## 16. Security, privacy, and compliance risks

### Risks

- Cross-tenant audit leakage.
- Storing too much medical data in before/after JSON.
- Exposing clinical diff to registrar/cashier.
- Broad client-side audit insert being abused.
- Service role misuse.
- Missing audit if direct Supabase update bypasses repository.
- Audit log being editable/deletable.
- Noisy logs becoming useless.
- Prompt injection/malicious text in notes/files later shown in timeline or audit viewer.
- No reason captured for corrections.
- No support/platform access audit.
- Audit table performance bottleneck.
- Undefined retention/export policy.
- Local fallback hiding real mutation behavior.

### Mitigations

- Tenant-scoped RLS.
- Append-only event model.
- No broad arbitrary client insert for mature audit.
- Redaction policy.
- Category/action/visibility fields.
- Transactional write paths for high-risk flows.
- Support access model with reason and time window.
- No raw secrets or full file content in audit.
- Tests for no-tenant and cross-tenant boundaries.
- Advisor checks after schema implementation.
- Report-only design before schema.

## 17. Staged implementation plan

1. `AUDIT-ACTIVITY-LOG-001A`
   - Schema-only migration.
   - `audit_events`.
   - optional `activity_events` or view.
   - indexes.
   - RLS.
   - no UI.

2. `AUDIT-ACTIVITY-REPOSITORY-001B`
   - Types/repository/helpers/tests.
   - list tenant audit.
   - list patient activity.
   - no broad client insert if RPC/service path is chosen.

3. `AUDIT-ACTIVITY-RPC-001C`
   - Transactional helper/RPC for high-risk writes.
   - completed services.
   - payment corrections.
   - role changes.
   - clinical corrections.

4. `PATIENT-TIMELINE-ACTIVITY-INTEGRATION-001`
   - Add selected activity events to PatientTimelineAggregator.
   - Do not expose raw audit diffs.

5. `ADMIN-AUDIT-VIEWER-001`
   - Clinic owner/admin audit viewer.
   - Filters by actor/category/target/patient/date.

6. `SUPPORT-ACCESS-AUDIT-001`
   - Platform support access model.
   - explicit reason.
   - time-limited access.
   - audited start/end.

7. `ENCOUNTER-VISIT-MODEL-001A`
   - Proceed with visits/encounters/completed services once audit direction is defined.

## 18. Relationship to future modules

### Encounter / visit model

Visit check-in/out and encounter start/complete need audit. Clinical corrections must be append-only or explicitly superseded.

### Completed services

Performed service is a clinical/billable fact and must be audited transactionally. Corrections must require reason.

### Payments / debts

Payments, refunds, and debt adjustments need financial audit with role-restricted visibility.

### Stock

Stock movement/write-off/correction should link to completed service and be audited.

### Documents

Generation, signature, archive, and correction should be audited. Do not store document contents in audit.

### Reports

Reports should use source-of-truth tables for facts and audit for investigation/correction history. Do not build revenue/performed-service reports from calendar events alone.

### ChatGPT / MCP assistant later

Any future assistant that reads or acts on patient, financial, or clinical data must use tenant/role-scoped APIs and must emit audit for sensitive access/actions. No hidden broad admin API. No support access without explicit audit.

## 19. What was intentionally NOT changed

- No code changed.
- No migrations created.
- No Supabase cloud touched.
- No local Supabase used.
- No browser smoke run.
- No audit implementation added.
- No encounter/visit implementation added.
- No completed services implemented.
- No payments, stock, or documents implemented.
- No PatientTimelineAggregator edits.
- No PatientCardPage edits.
- No next task started.

## 20. Checks

- `git status --short`: report-only branch, exactly one new report file.
- `npm run lint`: pending GitHub Actions.
- `npm run test -- --run`: pending GitHub Actions.
- `npm run build`: pending GitHub Actions.
- GitHub Actions CI: pending after PR creation.

## 21. Final verdict

`RECON COMPLETE`

## 22. Recommended next task

`AUDIT-ACTIVITY-LOG-001A`
