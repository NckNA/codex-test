# ENCOUNTER-VISIT-MODEL-RECON-001 encounter / visit model boundary

## Summary

This recon defines the boundary between calendar appointments, real patient attendance, clinical encounters, performed services, payment facts, stock movements, and audit/activity events for DentalFlow CRM.

The current product already has patient records, appointments, findings, treatment plans/stages, computed patient timeline events, patient files, and an initial audit_logs table. It does not yet have a dedicated visit/encounter/completed-service model.

Main recommendation: use a staged hybrid architecture. Do not treat appointment completion as performed treatment. Introduce visit/encounter/completed-service concepts deliberately, then connect them to timeline, payments, stock, reports, and audit.

## Branch

`recon/encounter-visit-model-001`

## PR URL

[Pending PR creation]

## PR head reviewed before final report update

[Pending PR creation]

## Report update commit

N/A because the final report update commit cannot reference itself before creation.

## Changed files summary

- `_ai_work/REPORTS/ENCOUNTER-VISIT-MODEL-RECON-001_encounter_visit_model.md`

## Current state recon

### Source files and migrations inspected

- `src/types/index.ts`
- `src/data/repositories/AppointmentRepository.ts`
- `src/data/repositories/TreatmentPlansRepository.ts`
- `src/data/repositories/FindingsRepository.ts`
- `src/data/aggregators/PatientTimelineAggregator.ts`
- `src/data/aggregators/ClinicalSummaryAggregator.ts`
- `src/data/hooks/usePatientTimeline.ts`
- `src/pages/PatientCardPage.tsx`
- `supabase/migrations/0001_initial_schema.sql`
- `supabase/migrations/0004_align_findings_status_lifecycle.sql`
- `supabase/migrations/0006_treatment_plan_stage_sync_rpc.sql`
- project timeline and storage reports where present on `main`

Search/recon terms included appointment, visit, encounter, treatment_plan, treatment_stage, completed, completed_service, service, procedure, work, finding, diagnosis, payment, invoice, debt, stock, inventory, material, audit, timeline, created_at, updated_at, completed_at, cancelled_at, and no_show.

### Existing appointment model

Current TypeScript type: `Appointment`.

Current repository: `AppointmentRepository.ts`.

Current table: `appointments`.

Key fields:

- `tenant_id` / `tenantId` boundary exists in Supabase repository and table.
- `patient_id` / `patientId` is optional in TypeScript because blocked calendar slots may not belong to a patient.
- `doctor_id` / `doctorId` exists.
- `start_time` / `start` and `end_time` / `end` define calendar time.
- `status` exists.
- `created_at` / `createdAt` exists.

Current appointment statuses:

- `new`
- `confirmed`
- `arrived`
- `in_progress`
- `completed`
- `cancelled`
- `no_show`
- `blocked`

Important finding: `Appointment.status = completed` exists, but it is still a calendar/attendance state. It must not be interpreted as completed clinical service, performed work, billable treatment, or stock usage.

The current appointment model can support scheduling, calendar state, patient arrival-like state, and no-show/cancellation flags. It cannot by itself prove which clinical services were performed.

### Existing treatment plan model

Current TypeScript types: `TreatmentPlan`, `TreatmentStage`.

Current repository: `TreatmentPlansRepository.ts`.

Current tables:

- `treatment_plans`
- `treatment_stages`

Plan statuses:

- `draft`
- `approved`
- `in_progress`
- `completed`
- `cancelled`

Stage statuses:

- `planned`
- `in_progress`
- `completed`
- `cancelled`

Important finding: plans and stages represent intended or managed treatment workflow. A stage being marked `completed` may indicate stage progress, but the project still lacks a separate performed-service/completed-work fact table that can safely feed clinical reports, invoices, doctor workload, and stock write-off.

The RPC `save_treatment_plan_with_stages` stores plan/stage intent transactionally. It does not create completed service facts.

### Existing findings model

Current TypeScript type: `DentalFinding`.

Current repository: `FindingsRepository.ts`.

Current table: `findings`.

Canonical finding lifecycle after alignment:

- `discovered`
- `planned`
- `in_treatment`
- `completed`
- `declined_by_patient`
- `monitoring`
- `archived`

Findings are patient-scoped and may link to tooth number, clinical zone, diagnosis IDs, planned work IDs, and treatment-plan inclusion flags.

Important finding: a finding is a clinical observation/problem/risk. It is not the same as a diagnosis dictionary item, and it is not the same as a performed service.

Archive behavior is history-preserving. Delete/archive should not erase clinical history.

### Existing timeline model

Current type/model: `PatientTimelineEvent`.

Current aggregator: `PatientTimelineAggregator.ts`.

Current UI: `PatientTimelineTab` in `PatientCardPage`.

Current computed timeline sources:

- patient creation;
- chief complaint;
- findings;
- treatment plans;
- appointments;
- patient files.

Important finding: appointment events are emitted as appointment events, not completed treatment events. This must stay true when future visits and services are added.

Current timeline intentionally does not invent dental chart change events because the chart lacks reliable per-change event history.

### Existing payments, stock, documents, audit

Payments/debts: no implemented payment/invoice/debt module was found in current code search. `Appointment.paymentType` and patient balance fields exist, but they are not a proper payment ledger.

Stock/inventory/materials: no implemented stock/inventory/material movement module was found.

Documents/files: legacy `documents` metadata table exists in the initial schema, and the newer `patient_files` metadata model exists from the dental photo storage slice. Patient files are metadata/storage events, not clinical encounters.

Audit/activity: `audit_logs` exists in the initial schema, but current patient timeline is not yet backed by an immutable audit/activity event model.

### Potentially dangerous conflations found or avoided

No intentional code path was found that directly treats appointment as completed service in the new patient timeline. The appointment status list contains `completed`, so future reporting code must not use appointment completion as performed-work evidence.

No implemented completed-service model exists yet. This is the main gap.

Treatment plan/stage status can show planned workflow progress, but must not become the billing/performed-work source of truth without a dedicated performed-service layer.

## Domain boundary definitions

### Appointment

An appointment is a scheduled time slot or booking intent.

It answers:

- when the patient is expected;
- which doctor/cabinet/time slot is reserved;
- whether the booking was new, confirmed, cancelled, no-show, arrived, in progress, completed, or blocked.

It does not prove clinical work was performed.

### Visit

A visit is a real attendance instance.

It answers:

- did the patient actually come;
- when they checked in and checked out;
- which appointment it was linked to, if any;
- which clinic/tenant handled the attendance;
- who was primarily responsible administratively or clinically.

A visit can be linked to an appointment, but it should also support walk-ins and cases where attendance is registered without a prior booking.

### Clinical encounter

A clinical encounter is a documented clinical session or examination.

It answers:

- what clinical interaction happened;
- which doctor documented it;
- what complaints/findings/files/plans were linked;
- what notes were made;
- whether the encounter is draft, active, completed, corrected, or archived.

A visit may contain one or more clinical encounters. A single visit can involve multiple clinicians or separate clinical sessions.

### Completed service / performed procedure

A completed service is a clinical and/or billable fact that work was performed.

It answers:

- what was actually done;
- when it was performed;
- which doctor performed it;
- which tooth/finding/stage/encounter it relates to;
- what price/quantity was recorded;
- how it should later connect to invoice, payment, debt, and stock write-off.

It is not the same as an appointment, treatment plan, or payment.

### Treatment plan

A treatment plan is intended future work.

It may be approved, in progress, completed, or cancelled as a planning object. It is not automatically proof that services were performed.

### Treatment stage

A treatment stage is a step inside a treatment plan.

It may help structure intended work and track progress, but completion must be carefully defined. Stage completion should not automatically create financial or stock facts unless the performed service model explicitly says so.

### Payment

A payment is a financial fact.

It proves money moved or debt changed. It does not prove clinical treatment was completed.

### Stock movement

A stock movement is a material/accounting fact.

It may later link to completed services, but it should not be inferred merely from appointment or plan status.

### Audit/activity event

An audit/activity event is an immutable record of who changed what and when.

It is not the same as patient timeline content, although selected audit/activity events may later appear in patient timeline if product rules allow.

## Architecture options

### Option 1: use appointment status as visit/completion source

This approach treats `appointment.status = completed` as evidence that the patient visited and treatment happened.

Pros:

- simplest;
- no new tables;
- quick to show something in reports.

Cons:

- mixes calendar and clinical facts;
- cannot safely support walk-ins;
- weak for multi-doctor visits;
- cannot prove performed services;
- unsafe for invoices and debts;
- unsafe for stock write-off;
- weak auditability;
- dangerous for timeline and reports.

Verdict: not recommended.

### Option 2: create visits table only

This separates attendance from appointments by adding a patient visit record linked to patient, tenant, optional appointment, and doctor.

Pros:

- separates real attendance from booking intent;
- supports walk-ins;
- improves visit/no-show reporting;
- gives check-in/check-out lifecycle.

Cons:

- still does not capture detailed clinical session notes;
- still does not define performed services;
- may become an overloaded table if clinical facts are stuffed into it.

Verdict: useful, but incomplete alone.

### Option 3: create encounters + completed services

This introduces clinical encounters for documented sessions and completed services for performed works.

Pros:

- clean clinical boundary;
- separates intent from fact;
- supports doctor workload;
- supports patient timeline;
- supports future payment/debt and stock models;
- better audit/correction story.

Cons:

- larger schema and UI work;
- requires careful RLS;
- requires correction/archive rules;
- requires staged rollout and backfill thinking.

Verdict: correct target architecture, but too large for one PR.

### Option 4: hybrid staged approach

This approach introduces the model in safe stages:

1. define visits/encounters/completed services;
2. add repositories and tests;
3. add check-in/check-out UI;
4. add clinical notes and performed service recording;
5. integrate timeline;
6. only then add payments, stock, and richer reports.

Pros:

- safer rollout;
- avoids a giant migration/UI PR;
- keeps future payments/stock/reporting grounded;
- reduces risk of mixing calendar and clinical facts.

Cons:

- requires discipline;
- requires temporary limitations while model fills out;
- requires clear task sequencing.

Verdict: recommended for DentalFlow now.

## Recommended architecture

Use the hybrid staged approach.

Do not use appointment completion as completed treatment.

Introduce these concepts separately:

- appointments for calendar booking;
- visits for attendance/check-in/check-out;
- clinical encounters for documented clinical sessions;
- completed services/performed works for actual clinical/billable facts;
- payments/invoices later as financial facts;
- stock movements later as material/accounting facts;
- audit/activity log for immutable correction and change tracking.

## Proposed future data model

This is a proposal only. No migration is created in this recon.

### `patient_visits`

Purpose: attendance/check-in/check-out.

Suggested fields:

- `id uuid primary key`
- `tenant_id uuid not null`
- `patient_id uuid not null`
- `appointment_id uuid null`
- `primary_doctor_id uuid null`
- `status text not null`
- `visit_type text not null`
- `started_at timestamptz null`
- `ended_at timestamptz null`
- `checked_in_at timestamptz null`
- `checked_out_at timestamptz null`
- `created_by uuid null`
- `updated_by uuid null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `archived_at timestamptz null`

Possible visit statuses:

- `planned`
- `arrived`
- `in_progress`
- `completed`
- `cancelled`
- `archived`

No-show recommendation: keep no-show primarily on appointment, because no-show means the patient did not attend. Only create a visit record for no-show if product explicitly wants an attendance/administrative trace object. Do not let no-show become a clinical encounter.

### `clinical_encounters`

Purpose: documented clinical session.

Suggested fields:

- `id uuid primary key`
- `tenant_id uuid not null`
- `patient_id uuid not null`
- `visit_id uuid null`
- `appointment_id uuid null`
- `doctor_id uuid not null`
- `encounter_type text not null`
- `status text not null`
- `notes text null`
- `started_at timestamptz null`
- `ended_at timestamptz null`
- `created_by uuid null`
- `updated_by uuid null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `archived_at timestamptz null`

Possible encounter statuses:

- `draft`
- `in_progress`
- `completed`
- `corrected`
- `archived`

### `completed_services` / `performed_works`

Purpose: performed clinical/billable fact.

Suggested fields:

- `id uuid primary key`
- `tenant_id uuid not null`
- `patient_id uuid not null`
- `encounter_id uuid not null`
- `visit_id uuid null`
- `appointment_id uuid null`
- `treatment_plan_id uuid null`
- `treatment_stage_id uuid null`
- `finding_id uuid null`
- `tooth_id text null`
- `dictionary_work_id uuid null`
- `name text not null`
- `quantity numeric not null default 1`
- `unit_price numeric not null default 0`
- `total_price numeric not null default 0`
- `doctor_id uuid not null`
- `performed_at timestamptz not null`
- `status text not null`
- `created_by uuid null`
- `updated_by uuid null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `archived_at timestamptz null`

Possible completed-service statuses:

- `performed`
- `corrected`
- `voided`
- `archived`

Recommendation: corrections should be append-friendly or audit-backed. Editing completed work silently is dangerous for medical, financial, and stock records.

### Future payment relation

Payments should not link directly to appointments as proof of treatment.

Recommended later model:

- `invoice_items` link to `completed_services`;
- invoices collect performed/billable items;
- payments link to invoices/payment records;
- debts are derived from invoices minus payments/adjustments.

### Future stock relation

Stock movements should link to performed services, not appointments or planned stages alone.

Recommended later model:

- `stock_movements.completed_service_id`;
- optional material usage templates from dictionary works;
- no stock write-off without a performed service or explicit manual inventory event.

## Relation to patient timeline

Current timeline should stay as-is for existing sources:

- patient created;
- chief complaint added;
- finding discovered/archived;
- treatment plan created;
- appointment scheduled;
- patient file uploaded/archived.

Future timeline additions:

- visit checked in;
- visit checked out/completed;
- encounter started/completed;
- completed service performed;
- invoice created;
- payment added;
- stock/material used;
- important audit/activity events if product decides they are patient-visible.

Rules:

- appointment scheduled remains appointment event;
- appointment completed remains appointment/calendar state, not service performed;
- visit completed becomes visit event;
- service performed becomes completed_service event;
- payment added becomes financial event;
- treatment plan remains plan/intention event;
- audit event remains system/history event.

## Role and visibility rules

### `clinic_owner` / `clinic_admin`

Can see visits, encounters, completed services, and financial summary according to clinic policy.

They can manage corrections only with audit trail and role checks.

### `doctor`

Can see clinical visits, encounters, findings, files, and performed services for assigned clinic/patient access.

Can create/update clinical encounters if product permissions allow.

Should not silently edit financial records unless explicitly allowed.

### `registrar` / `receptionist`

Can manage appointments, check-in, check-out, and attendance status.

May see visit attendance/admin status.

Should not see detailed clinical notes unless the product explicitly permits it.

### `cashier`

Can see billing/payment/debt context and possibly completed service names needed for invoice explanation.

Should not see detailed findings, notes, or clinical context unless explicitly allowed.

### No-tenant and cross-tenant users

No access.

The future model must preserve tenant_id scoping and RLS on every table.

### Platform roles

No patient data by default.

Any platform support/admin patient access must be explicit, audited, and probably separate from normal clinic role access.

### Open product decisions

- Should registrar see performed service names?
- Should cashier see tooth/finding context?
- Should doctors see financial/debt status?
- Who can mark a service as completed?
- Who can reverse/correct a completed service?
- Should corrections be append-only or editable with audit?
- Should visit check-out require encounter completion?
- Can a visit contain multiple encounters?
- Can one encounter contain multiple completed services from different doctors?

## Reporting impact

Appointments alone cannot produce reliable performed-service reports.

Future reports need the model split:

- doctor workload: based on encounters and completed services, not only appointments;
- performed services: based on completed_services/performed_works;
- treatment plan acceptance: plan intent vs completed services;
- planned vs completed work: treatment stages vs completed_services;
- patient visits: based on patient_visits and appointment linkage;
- no-shows: appointment no_show and no visit attendance;
- revenue/debts: invoices/payments based on completed services;
- chair utilization: appointments + visits + real occupancy/check-in;
- stock/material usage: stock_movements linked to completed services.

If the app reports revenue or workload from appointments alone, those reports will be wrong.

## Staged implementation plan

### 1. `AUDIT-ACTIVITY-LOG-RECON-001`

Design audit/correction rules before clinical facts become editable.

Reason: completed services, encounter corrections, and financial corrections need a safe history model.

### 2. `ENCOUNTER-VISIT-MODEL-001A`

Schema-only PR.

Include:

- `patient_visits`;
- `clinical_encounters`;
- maybe `completed_services` if scoped safely;
- tenant-scoped RLS;
- no UI;
- no payments/stock.

### 3. `ENCOUNTER-VISIT-REPOSITORY-001B`

Add types, repositories, pure tests, and no UI.

### 4. `VISIT-CHECKIN-UI-001`

Add check-in/check-out from appointment/patient card.

Do not create completed service facts automatically.

### 5. `ENCOUNTER-CLINICAL-NOTES-UI-001`

Doctor encounter notes and links to findings/files/plans.

### 6. `COMPLETED-SERVICES-001`

Mark performed works/services.

Do not auto-complete from appointment alone.

### 7. `TIMELINE-ENCOUNTER-INTEGRATION-001`

Add visit/encounter/completed-service events to `PatientTimelineAggregator`.

### 8. `PAYMENTS-DEBTS-RECON-001`

Start only after completed services are defined.

### 9. `STOCK-INVENTORY-RECON-001`

Start only after completed services are defined.

## Risks and mitigations

### Risk: appointment treated as completed treatment

Mitigation: keep appointment as booking/attendance state only. Completed services must be separate.

### Risk: treatment plan treated as performed work

Mitigation: treatment plan/stage remains intent/progress. Performed service facts live in completed_services.

### Risk: payment treated as clinical completion

Mitigation: payments link to invoices/payment records. They do not prove clinical work.

### Risk: duplicated clinical facts

Mitigation: define source of truth: encounter documents clinical session, completed_services documents performed works, plan/stage documents intent.

### Risk: wrong reports from calendar-only data

Mitigation: reports must use visits/encounters/services depending on question.

### Risk: cross-tenant leakage

Mitigation: every future table must have tenant_id, tenant-scoped FK patterns, and RLS matching existing rules.

### Risk: role visibility leakage

Mitigation: define role rules before UI; keep registrar/cashier conservative.

### Risk: editing completed service without audit

Mitigation: design correction/void/archive and audit before enabling edits.

### Risk: deleting clinical history

Mitigation: archive/correct instead of hard delete by default.

### Risk: overloading PatientCardPage

Mitigation: introduce dedicated visit/encounter components and hooks. Keep PatientCardPage orchestration thin.

### Risk: overloading timeline with noisy events

Mitigation: category filters and patient-visible rules; do not show every audit row by default.

### Risk: premature payments/stock

Mitigation: complete service model first, then payments/stock.

## What was intentionally NOT changed

- no application code;
- no database migration;
- no RLS change;
- no Supabase cloud;
- no local Supabase;
- no browser smoke;
- no visit UI;
- no completed services implementation;
- no payments module;
- no stock module;
- no documents module;
- no audit implementation;
- no next task started.

## Checks

Report-only PR.

Local npm checks were not required for this recon before PR creation.

GitHub Actions CI: pending after PR creation.

## Final verdict

RECON COMPLETE

## Recommended next task

`AUDIT-ACTIVITY-LOG-RECON-001`
