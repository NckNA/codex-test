# ENCOUNTER-VISIT-MODEL-RECON-001 encounter / visit model boundary

## Summary

This report defines the boundary between calendar appointments, real patient visits, clinical encounters, completed services, payments, stock movements, and audit/activity events for DentalFlow CRM.

The current product has patients, appointments, findings, treatment plans/stages, patient timeline events, patient files, and a basic `audit_logs` table. It does not yet have a dedicated visit, encounter, or completed-service model.

Main recommendation: use a staged hybrid approach. Keep appointment as calendar intent, add visit/encounter/completed-service concepts later, then integrate timeline, payments, stock, reports, and audit.

## Branch

`recon/encounter-visit-model-001`

## PR URL

https://github.com/NckNA/codex-test/pull/301

## PR head reviewed before final report update

`00466c94e95451e19676e36afa7d31a16ad4546f`

## Report update commit

N/A because the final report update commit cannot reference itself before creation.

## Changed files summary

- `_ai_work/REPORTS/ENCOUNTER-VISIT-MODEL-RECON-001_encounter_visit_model.md`

## Current state recon

Inspected code and migrations:

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

### Appointments

Current model:

- TypeScript: `Appointment`.
- Repository: `AppointmentRepository.ts`.
- Table: `appointments`.
- Tenant scoping: `tenant_id` in table and Supabase repository.
- Patient relation: `patient_id` / `patientId`, optional for blocked slots.
- Doctor relation: `doctor_id` / `doctorId`.
- Time fields: `start_time`, `end_time`, `created_at` mapped to `start`, `end`, `createdAt`.
- Status values: `new`, `confirmed`, `arrived`, `in_progress`, `completed`, `cancelled`, `no_show`, `blocked`.

Finding: `appointment.status = completed` exists, but it is still a calendar/attendance state. It must not be treated as completed clinical service, performed work, payment, or stock usage.

### Treatment plans and stages

Current model:

- Types: `TreatmentPlan`, `TreatmentStage`.
- Repository: `TreatmentPlansRepository.ts`.
- Tables: `treatment_plans`, `treatment_stages`.
- Plan statuses: `draft`, `approved`, `in_progress`, `completed`, `cancelled`.
- Stage statuses: `planned`, `in_progress`, `completed`, `cancelled`.
- RPC: `save_treatment_plan_with_stages` saves plan/stage intent transactionally.

Finding: treatment plans and stages represent intended or managed treatment workflow. They are not a performed-service ledger.

### Findings

Current model:

- Type: `DentalFinding`.
- Repository: `FindingsRepository.ts`.
- Table: `findings`.
- Canonical statuses: `discovered`, `planned`, `in_treatment`, `completed`, `declined_by_patient`, `monitoring`, `archived`.

Finding: a finding is a clinical observation/problem/risk. It is not a dictionary diagnosis and not a performed service.

### Timeline

Current timeline is computed from:

- patient creation;
- chief complaint;
- findings;
- treatment plans;
- appointments;
- patient files.

Finding: the current aggregator correctly keeps appointment events as appointment events. It does not treat appointments as completed treatment.

### Payments, stock, documents, audit

Payments/debts are not implemented as a proper ledger. `Appointment.paymentType` and patient balance fields exist, but those are not enough for accounting.

Stock/material inventory is not implemented.

Documents/files exist as metadata concepts, including newer patient file metadata. Files are not encounters.

`audit_logs` exists, but no mature immutable activity model is integrated into patient timeline or correction flows yet.

## Domain boundary definitions

### Appointment

A scheduled calendar slot or booking intent. It answers when the patient is expected and which doctor/cabinet/time is reserved. It does not prove clinical work happened.

### Visit

A real attendance instance. It answers whether the patient came, when they checked in/out, who saw them, and which appointment it was linked to if any.

### Clinical encounter

A documented clinical session. It answers what clinical interaction happened, which doctor documented it, and what notes, findings, files, plans, or complaints were linked.

### Completed service / performed procedure

A clinical or billable fact that work was actually performed. It may link to encounter, visit, appointment, treatment stage, finding, tooth, doctor, price, invoice, and later stock/material usage.

### Treatment plan

Intended future treatment. It is not a performed fact.

### Treatment stage

A step inside a plan. It may track progress, but completion must be carefully defined and should not silently create financial or stock facts.

### Payment

A financial fact. It does not prove clinical work was done.

### Stock movement

A material/accounting fact. It should later link to completed services, not calendar appointments.

### Audit/activity event

An immutable record of who changed what and when. It is not the same as a patient timeline event, though selected events may later be shown in timeline.

## Architecture options compared

### Option 1: use appointment status as visit/completion source

Pros:

- simplest;
- no new tables;
- quick for simple reports.

Cons:

- mixes calendar and clinical facts;
- weak for walk-ins;
- weak for multi-doctor visits;
- unsafe for payments/debts;
- unsafe for stock;
- bad for audit;
- dangerous for patient timeline.

Verdict: not recommended.

### Option 2: visits table only

Pros:

- separates attendance from booking;
- supports walk-ins;
- enables check-in/check-out;
- improves visit/no-show reporting.

Cons:

- still does not capture clinical details;
- still does not define performed services;
- may become an overloaded dumping-ground table.

Verdict: useful, but incomplete alone.

### Option 3: encounters plus completed services

Pros:

- clean clinical boundary;
- separates intent from fact;
- supports doctor workload;
- supports timeline;
- supports payments and stock later.

Cons:

- larger schema/UI work;
- needs careful RLS;
- needs correction/audit rules;
- too big for a single safe PR.

Verdict: correct target architecture, but should be staged.

### Option 4: hybrid staged approach

Pros:

- safest rollout;
- avoids a giant PR;
- keeps future reports grounded;
- prevents calendar/clinical/financial confusion.

Cons:

- requires discipline;
- requires multiple tasks;
- requires temporary limitations until the model is complete.

Verdict: recommended now.

## Recommended architecture

Use the hybrid staged approach:

1. Design audit/activity rules first.
2. Add schema for visits and encounters.
3. Add repositories/types/tests.
4. Add check-in/check-out UI.
5. Add clinical encounter notes.
6. Add completed services/performed works.
7. Add timeline integration.
8. Add payments/debts and stock after completed services exist.

Do not infer completed clinical work from appointment status alone. Да, очень заманчиво сделать “completed appointment = treatment done”, и именно поэтому так делать нельзя. Человечество слишком часто выбирает удобную ложь с красивой кнопкой.

## Proposed future data model

This is design only. No migration is created in this PR.

### `patient_visits`

Purpose: attendance/check-in/check-out.

Suggested fields:

- `id`
- `tenant_id`
- `patient_id`
- `appointment_id` nullable
- `primary_doctor_id` nullable
- `status`
- `visit_type`
- `started_at`
- `ended_at`
- `checked_in_at`
- `checked_out_at`
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`
- `archived_at`

Suggested statuses:

- `planned`
- `arrived`
- `in_progress`
- `completed`
- `cancelled`
- `archived`

No-show should stay primarily on appointment because no-show means no attendance happened.

### `clinical_encounters`

Purpose: documented clinical session.

Suggested fields:

- `id`
- `tenant_id`
- `patient_id`
- `visit_id` nullable
- `appointment_id` nullable
- `doctor_id`
- `encounter_type`
- `status`
- `notes`
- `started_at`
- `ended_at`
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`
- `archived_at`

Suggested statuses:

- `draft`
- `in_progress`
- `completed`
- `corrected`
- `archived`

### `completed_services` / `performed_works`

Purpose: performed clinical/billable fact.

Suggested fields:

- `id`
- `tenant_id`
- `patient_id`
- `encounter_id`
- `visit_id` nullable
- `appointment_id` nullable
- `treatment_plan_id` nullable
- `treatment_stage_id` nullable
- `finding_id` nullable
- `tooth_id` nullable
- `dictionary_work_id` nullable
- `name`
- `quantity`
- `unit_price`
- `total_price`
- `doctor_id`
- `performed_at`
- `status`
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`
- `archived_at`

Suggested statuses:

- `performed`
- `corrected`
- `voided`
- `archived`

Corrections should be audit-backed or append-friendly. Silent edits to completed work are dangerous for clinical, financial, and stock records.

### Future payment relation

- `invoice_items` should link to `completed_services`.
- Invoices should group billable performed facts.
- Payments should link to invoice/payment records.
- Debts should be derived from invoice totals minus payments/adjustments.

### Future stock relation

- `stock_movements` should link to `completed_services`.
- Stock should not be written off from appointment or planned treatment alone.

## Timeline integration plan

Current timeline should keep existing computed sources:

- patient;
- chief complaint;
- findings;
- treatment plans;
- appointments;
- patient files.

Future timeline should add:

- visit checked in;
- visit completed;
- encounter started/completed;
- completed service performed;
- invoice/payment created;
- stock/material used;
- selected audit/activity events if patient-visible.

Rules:

- appointment scheduled remains appointment event;
- appointment completed remains appointment/calendar state;
- visit completed becomes visit event;
- service performed becomes completed-service event;
- payment added becomes financial event;
- treatment plan remains plan/intention event;
- audit event remains system/history event.

## Role and visibility rules

### `clinic_owner` / `clinic_admin`

Can see visits, encounters, completed services, and financial summary according to product policy. Correction rights must require audit trail.

### `doctor`

Can see clinical visits, encounters, findings, files, and performed services in their clinic context. Can create/update clinical encounter if permitted.

### `registrar` / `receptionist`

Can manage appointments, check-in, check-out, and attendance status. Should not see detailed clinical notes unless product policy explicitly allows it.

### `cashier`

Can see billing/debt context and maybe completed service names needed for invoices. Should not see detailed clinical findings or notes unless explicitly allowed.

### No-tenant / cross-tenant

No access.

### Platform roles

No patient data by default. Platform support/admin access must be explicit and audited.

Open decisions:

- Should registrar see performed service names?
- Should cashier see tooth/finding context?
- Should doctor see financial status?
- Who can mark a service as completed?
- Who can correct a completed service?
- Are corrections append-only or editable with audit?

## Reporting impact

Appointments alone cannot produce reliable performed-service reports.

Future reporting should use:

- doctor workload: encounters and completed services;
- performed services: completed_services/performed_works;
- treatment plan acceptance: plans vs completed services;
- planned vs completed work: treatment stages vs completed services;
- patient visits: patient_visits and appointment linkage;
- no-shows: appointment no_show without attendance;
- revenue/debts: invoices/payments from completed services;
- chair utilization: appointments plus visits/check-in;
- stock/material usage: stock_movements linked to completed services.

## Staged implementation plan

1. `AUDIT-ACTIVITY-LOG-RECON-001`
   - Design correction/audit rules before editable clinical facts.

2. `ENCOUNTER-VISIT-MODEL-001A`
   - Schema only: visits, encounters, maybe completed services if safely scoped.
   - RLS policies.
   - No UI.

3. `ENCOUNTER-VISIT-REPOSITORY-001B`
   - Types, repositories, tests.

4. `VISIT-CHECKIN-UI-001`
   - Check-in/check-out from appointment/patient card.
   - Do not create performed services automatically.

5. `ENCOUNTER-CLINICAL-NOTES-UI-001`
   - Doctor encounter notes and links to findings/files/plans.

6. `COMPLETED-SERVICES-001`
   - Record performed works/services.
   - Do not auto-complete from appointment alone.

7. `TIMELINE-ENCOUNTER-INTEGRATION-001`
   - Add visit/encounter/completed-service events to `PatientTimelineAggregator`.

8. `PAYMENTS-DEBTS-RECON-001`
   - Start only after completed services exist.

9. `STOCK-INVENTORY-RECON-001`
   - Start only after completed services exist.

## Risks and mitigations

- Appointment treated as completed treatment.
  - Mitigation: keep performed services separate.

- Treatment plan treated as performed work.
  - Mitigation: keep plan as intent, service as fact.

- Payment treated as clinical completion.
  - Mitigation: payments link to invoices, not clinical proof.

- Duplicated clinical facts.
  - Mitigation: define source of truth for encounter and completed services.

- Wrong reports from calendar-only data.
  - Mitigation: report from visits/encounters/services depending on question.

- Cross-tenant leakage.
  - Mitigation: tenant_id, composite FK patterns, RLS.

- Role visibility leakage.
  - Mitigation: conservative role rules before UI.

- Editing completed service without audit.
  - Mitigation: correction/void/archive plus audit.

- Deleting clinical history.
  - Mitigation: archive/correct, do not hard-delete by default.

- Overloading PatientCardPage.
  - Mitigation: dedicated components/hooks.

- Noisy timeline.
  - Mitigation: filters and patient-visible rules.

- Premature payments/stock.
  - Mitigation: completed services first.

## What was intentionally NOT changed

- no app code;
- no migrations;
- no schema;
- no RLS;
- no Supabase cloud;
- no local Supabase;
- no browser smoke;
- no visit UI;
- no completed services implementation;
- no payments/stock/documents implementation;
- no audit implementation;
- no next task started.

## Checks

GitHub Actions CI on reviewed head `00466c94e95451e19676e36afa7d31a16ad4546f`:

- run `27713635699`;
- CI `#496`;
- tested commit `00466c94e95451e19676e36afa7d31a16ad4546f`;
- ESLint: success;
- tests: success;
- build: success.

## Final verdict

RECON COMPLETE

## Recommended next task

`AUDIT-ACTIVITY-LOG-RECON-001`
