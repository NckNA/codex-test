# PATIENT-TIMELINE-RECON-001: patient timeline architecture

## Summary

This is a report-only architecture recon for a future patient timeline in DentalFlow CRM. The current app already has several patient-related source-of-truth domains, but it does not have one unified patient timeline. The recommended architecture is a hybrid model:

1. first implement a computed `PatientTimelineAggregator` from current source tables and repositories;
2. later add an immutable audit/activity log for events that must survive source row edits, archival, or deletion;
3. keep a stable `PatientTimelineEvent` interface from the first slice so the implementation can evolve without rewriting UI.

This task intentionally does not implement UI, migrations, RLS, cloud changes, seed data, or app code.

## Branch

`recon/patient-timeline-001`

## PR URL

https://github.com/NckNA/codex-test/pull/295

## PR head reviewed before final report update

`3df8434ce9ed7ce1da066ab723e8137e669ef7c9`

## Report update commit

N/A because the final report update commit cannot reference itself before creation.

## Changed files summary

One new report file only:

- `_ai_work/REPORTS/PATIENT-TIMELINE-RECON-001_patient_timeline_architecture.md`

## Source availability note

The requested open-source recon report path was searched and fetched from `main`, but was not present under `_ai_work/REPORTS/OPEN-SOURCE-DENTAL-CRM-ARCHITECTURE-RECON-001_open_source_patterns.md` at recon time. The design still follows the architecture principles provided in the task brief: tenant-scoped data, metadata-first files, source links, private file previews, audit-friendly history, and archive-not-hard-delete semantics.

No external code, external schema, GPL/AGPL code, or vendored dependency was copied.

## Current state recon

### Files inspected

Project docs and reports:

- `_ai_work/SOURCES/03_MULTI_TENANT_ARCHITECTURE_RULES.md`
- `_ai_work/SOURCES/04_DATA_ISOLATION_AND_SECURITY.md`
- `_ai_work/SOURCES/05_MEDICAL_DOMAIN_MODEL.md`
- `_ai_work/SOURCES/06_PATIENT_CARD_AND_DENTAL_CHART_RULES.md`
- `_ai_work/SOURCES/07_TREATMENT_PLAN_AND_DOCUMENTS.md`
- `_ai_work/SOURCES/08_APPOINTMENTS_AND_SCHEDULE.md`
- `_ai_work/SOURCES/11_BACKEND_AND_API_ARCHITECTURE.md`
- `_ai_work/SOURCES/13_STORAGE_AND_MIGRATION_STRATEGY.md`
- `_ai_work/SOURCES/14_UI_UX_RULES.md`
- `_ai_work/SOURCES/18_TESTING_AND_QUALITY_ASSURANCE_STRATEGY.md`
- `_ai_work/SOURCES/19_TOOL_REGISTRY_AND_USAGE_POLICY.md`
- recent reports for clinical summary, findings lifecycle, files/storage, cloud apply, role labels, and multitenant QA where available on `main`.

Source and migration files:

- `src/pages/PatientCardPage.tsx`
- `src/components/patients/patient-card/PatientHistoryTab.tsx`
- `src/data/aggregators/ClinicalSummaryAggregator.ts`
- `src/data/hooks/usePatientFindings.ts`
- `src/data/hooks/useDentalChart.ts`
- `src/data/hooks/usePatientFiles.ts`
- `src/data/hooks/usePatientAppointments.ts`
- `src/data/repositories/ChiefComplaintRepository.ts`
- `src/data/repositories/DentalChartRepository.ts`
- `src/data/repositories/FindingsRepository.ts`
- `src/data/repositories/TreatmentPlansRepository.ts`
- `src/data/repositories/PatientFilesRepository.ts`
- `src/data/repositories/AppointmentRepository.ts`
- `src/types/index.ts`
- `src/contexts/TenantContext.tsx`
- `src/contexts/AuthContext.tsx`
- `supabase/migrations/0001_initial_schema.sql`
- `supabase/migrations/0004_align_findings_status_lifecycle.sql`
- `supabase/migrations/0006_treatment_plan_stage_sync_rpc.sql`
- `supabase/migrations/0011_patient_file_metadata.sql`

### Repo searches performed

Search terms included:

- `timeline`, `history`, `activity`, `audit`, `event`, `log`
- `created_at`, `updated_at`, `archived_at`, `uploaded_by`, `created_by`, `doctor_id`, `author_id`
- `patient_id`, `appointment`, `treatment_plan`, `treatment_stage`, `finding`, `patient_files`
- `chief complaint`, `complaint`, `completed service`, `payment`, `invoice`, `stock`, `inventory`

### Existing timeline/history/activity logic

- There is no unified patient timeline aggregator or timeline event model yet.
- `PatientCardPage` has a tab labelled `История приёмов`, but this is appointment history only, not a unified patient timeline.
- `ClinicalSummaryAggregator` already combines chart, treatment plans, chief complaint, findings, and appointments into a read model, which is a good architectural precedent for a computed timeline aggregator.
- `audit_logs` exists in the initial schema, but there is no current repository/UI integration for patient timeline events.

## Existing patient data sources

### Patients

- Table exists and is Supabase-backed.
- Has `tenant_id`, `id`, `created_at`, `updated_at`, status, profile/contact fields, integration metadata, balance fields.
- Lacks explicit `created_by` / `updated_by` attribution.
- Can produce now: patient-created and patient-profile-updated computed events from timestamps, but update attribution is missing.

### Chief complaints

- Table and repository exist.
- Supabase-backed and localStorage-backed.
- Has `tenant_id`, `patient_id`, `created_at`, `updated_at`.
- Lacks actor attribution and explicit archive/resolution state.
- Can produce now: complaint added / complaint updated events.
- Needs later schema if complaint resolution/archive history becomes important.

### Dental chart and tooth states

- `dental_charts` and `tooth_states` exist.
- Supabase-backed and localStorage-backed.
- Has tenant and patient relation through chart; tooth states have timestamps.
- Lacks actor attribution and immutable per-change history.
- Can produce now: current chart snapshot events such as chart created/updated and tooth state updated.
- Cannot accurately reconstruct historical tooth changes without an audit/activity event table.

### Findings

- Table and repository exist.
- Supabase-backed and localStorage-backed.
- Has `tenant_id`, `patient_id`, tooth number, status, severity, clinical text, created/updated timestamps.
- Status lifecycle is aligned to canonical values including `archived`.
- Delete action archives rather than hard-deletes in repository behavior.
- Lacks actor attribution and status transition history.
- Can produce now: finding discovered, monitoring/planned/in-treatment/completed/declined/archived status events from current state, but prior transitions are not immutable.

### Treatment plans and stages

- Tables and repository exist.
- Supabase-backed and localStorage-backed.
- `treatment_plans` has `tenant_id`, `patient_id`, status, total price, created/updated timestamps.
- `treatment_stages` has `tenant_id`, plan relation, status, teeth, price, source, finding ids, timestamps.
- Save is handled through `save_treatment_plan_with_stages` RPC.
- Delete currently physically deletes plans/stages in repository path, which is not ideal for long-term timeline/audit semantics.
- Can produce now: plan created/updated/status event and stage planned/updated/completed events.
- Needs future archive/cancel semantics and actor attribution.

### Appointments

- Table and repository exist.
- Supabase-backed and localStorage-backed repository exists, but the current patient history hook uses localStorage repository only.
- Has `tenant_id`, optional `patient_id`, doctor id, service, status, payment type, price, start/end, created/updated timestamps.
- Lacks actor attribution and visit/encounter model.
- Can produce now: scheduled, rescheduled by changed time if audit exists later, cancelled, completed, no-show based on status.
- Needs future visit/encounter boundary before treating appointment completion as clinical visit completion.

### Patient files / dental photos

- `patient_files` metadata table exists after migration `0011`.
- Supabase-backed and local/dev fallback repository exist.
- Has `tenant_id`, `patient_id`, storage metadata, file kind, source context, tooth/finding/plan/stage/appointment links, `uploaded_by`, `archived_by`, archive timestamps, created/updated timestamps.
- Can produce now: file uploaded, file archived, file metadata updated.
- This is the most timeline-ready source because it already has explicit metadata and archive fields.

### Clinical dictionaries / bootstrap

- Dictionary tables and template/bootstrap work exist in recent tasks.
- Dictionary events are mostly tenant/system-level, not patient-level.
- They should not appear in patient timeline unless a dictionary action directly changes patient clinical records.

### Documents

- Initial schema contains a simple `documents` metadata table, but the app document module is not yet implemented.
- Future timeline events: document generated/signed/archived, consent form attached, document linked to plan/stage/appointment.

### Payments / billing

- Patient and appointment types include balance, payment type, price, and treatment plan total price.
- Full payment/invoice module is not implemented.
- Future timeline events: invoice created, payment added, partial payment, refund, debt remaining.

### Stock / inventory

- No implemented stock/inventory module found in current app source.
- Future timeline events should be stock movements linked to completed services or treatment stages, but only after the stock module exists.

### Audit/activity

- `audit_logs` exists in schema but is not currently wired into patient timeline.
- It has tenant, user, action, entity type/id, metadata, created_at.
- It is a good future basis for immutable system/activity events but needs design before use as patient timeline source.

## Proposed event categories

### A. Patient profile events

- `patient.created`
- `patient.updated`
- `patient.contact_updated`
- `patient.medical_history_updated`

Current support: partially possible from patient timestamps and fields. Actor attribution missing.

### B. Complaint events

- `complaint.added`
- `complaint.updated`
- `complaint.resolved`
- `complaint.archived`

Current support: added/updated only. Resolution/archive needs schema.

### C. Dental chart events

- `dental_chart.created`
- `dental_chart.updated`
- `tooth.status_changed`
- `tooth.zone_updated`
- `tooth.diagnosis_added`
- `tooth.work_planned`

Current support: current snapshot only. True change history needs audit/activity events.

### D. Finding events

- `finding.discovered`
- `finding.monitoring_started`
- `finding.added_to_plan`
- `finding.in_treatment`
- `finding.completed`
- `finding.declined_by_patient`
- `finding.archived`

Current support: current state with created/updated timestamps. Exact transition history needs immutable events.

### E. Treatment plan events

- `treatment_plan.created`
- `treatment_plan.approved`
- `treatment_plan.in_progress`
- `treatment_plan.completed`
- `treatment_plan.cancelled`
- `treatment_stage.added`
- `treatment_stage.updated`
- `treatment_stage.completed`

Current support: current plans/stages. Plan/stage deletion should be revisited before timeline relies on it as history.

### F. Appointment events

- `appointment.scheduled`
- `appointment.rescheduled`
- `appointment.cancelled`
- `appointment.completed`
- `appointment.no_show`
- `appointment.linked_to_treatment`

Current support: appointment row status and start/end. Reschedule history needs audit/activity. Visit/encounter is not yet modeled.

### G. File/photo/document events

- `file.uploaded`
- `file.archived`
- `file.linked_to_tooth`
- `file.linked_to_finding`
- `file.linked_to_plan`
- `file.linked_to_stage`
- `file.metadata_updated`

Current support: strong for patient files because `0011` added metadata, context, uploader, and archive fields.

### H. Payment/billing events

- `invoice.created`
- `payment.added`
- `payment.partial`
- `payment.refunded`
- `debt.remaining`

Current support: future only. Do not infer detailed billing timeline from treatment plan totals or appointment payment type.

### I. Stock/inventory events

- `stock.material_written_off`
- `stock.movement_linked_to_service`

Current support: future only.

### J. Audit/system events

- `audit.role_changed`
- `audit.user_invited`
- `audit.dictionary_bootstrapped`
- `audit.migration_applied`

Patient timeline rule: include only events with direct patient impact. Tenant/system-only events belong in admin audit, not patient timeline.

## Architecture options

### Option 1: Computed timeline from existing source tables

Description:

- Query source tables and repositories: patients, complaints, findings, dental chart, treatment plans, stages, appointments, patient files.
- Map records into `PatientTimelineEvent` objects at runtime.
- No timeline-specific table in the first version.

Pros:

- Fastest path.
- No migration.
- Uses current source-of-truth tables.
- Low risk for first UI slice.
- Good fit for data that already has tenant/patient/timestamp fields.

Cons:

- Harder pagination across many sources.
- Not immutable.
- Source row edits can rewrite history.
- Some events cannot be reconstructed without audit rows.
- Deletion/archive behavior must be carefully normalized.

### Option 2: Dedicated `timeline_events` table

Description:

- Every domain action writes an immutable event row.
- Timeline reads from one table.

Pros:

- Strong auditability.
- Easier pagination and sorting.
- Source row edits do not erase event history.
- Good long-term analytics foundation.

Cons:

- Requires migration and write-path changes across domains.
- Requires backfill.
- If a code path forgets to write an event, the timeline silently becomes incomplete.
- Too much overhead before documents/payments/stock/visit model boundaries are settled.

### Option 3: Hybrid model

Description:

- Start with a computed `PatientTimelineAggregator` and stable event interface.
- Later add immutable audit/activity events for status transitions, deletes/archives, role-sensitive events, and system actions.
- Timeline UI merges computed source events and audit events.

Pros:

- Practical now.
- Avoids premature event-sourcing.
- Lets UI ship sooner.
- Keeps future immutable audit path open.
- Fits current repo because clinical summary already uses an aggregator pattern.

Cons:

- Requires discipline to prevent each module from inventing its own history.
- Some early timeline events remain computed snapshots, not immutable facts.
- Later audit merge/backfill must be designed carefully.

## Recommended architecture

Use the hybrid model.

Near-term:

- Create `PatientTimelineEvent` domain type.
- Create `PatientTimelineAggregator` that reads existing Supabase-backed repositories and maps records into timeline events.
- Use source tables as source of truth.
- Render timeline read-only in a new patient card tab.

Later:

- Add an immutable activity/audit model after visit/encounter and payment/document boundaries are clearer.
- Use audit rows for state transitions, actor attribution, role/system changes, and historical events that must survive edits/deletes.
- Merge computed events and audit events behind the same interface.

Reason:

The current repo has enough tenant/patient/timestamp data to compute a useful first timeline, but not enough actor attribution or immutable transition history to justify a dedicated timeline table immediately. Going full event table now would create a lot of write-path plumbing before the product has stable visits, documents, payments, and stock models. That is how architecture becomes paperwork with a database trigger.

## Proposed PatientTimelineEvent model

```ts
export type PatientTimelineCategory =
  | 'patient'
  | 'complaint'
  | 'dental_chart'
  | 'finding'
  | 'treatment_plan'
  | 'appointment'
  | 'file'
  | 'payment'
  | 'stock'
  | 'audit';

export type PatientTimelineVisibility =
  | 'clinical'
  | 'admin'
  | 'financial'
  | 'system';

export interface PatientTimelineEvent {
  id: string;
  tenantId: string;
  patientId: string;
  occurredAt: string;
  category: PatientTimelineCategory;
  type: string;
  title: string;
  description?: string;
  sourceType: string;
  sourceId: string;
  sourceStatus?: string;
  toothId?: string | null;
  findingId?: string | null;
  treatmentPlanId?: string | null;
  treatmentStageId?: string | null;
  appointmentId?: string | null;
  fileId?: string | null;
  actorUserId?: string | null;
  actorLabel?: string | null;
  visibility: PatientTimelineVisibility;
  isArchived?: boolean;
  linkTarget?: string;
  metadata?: Record<string, unknown>;
}
```

### Required fields

- `id`: stable event id generated by source type and source id, e.g. `finding:<id>:status:<status>` for computed events.
- `tenantId`: always required for isolation.
- `patientId`: always required.
- `occurredAt`: sort key.
- `category`, `type`, `title`, `sourceType`, `sourceId`, `visibility`.

### Optional fields

Use optional links only when the source actually supports them:

- `toothId`
- `findingId`
- `treatmentPlanId`
- `treatmentStageId`
- `appointmentId`
- `fileId`
- `actorUserId`
- `actorLabel`
- `metadata`

### Event id strategy

Computed events:

- `patient:<patientId>:created`
- `complaint:<complaintId>:created`
- `finding:<findingId>:current-status`
- `plan:<planId>:created`
- `stage:<stageId>:current-status`
- `appointment:<appointmentId>:status`
- `file:<fileId>:uploaded`
- `file:<fileId>:archived`

Future immutable events:

- Use database event UUID from `activity_events` or `timeline_events` table.

### Sorting strategy

- Primary: `occurredAt DESC`.
- Secondary: category priority if equal timestamps.
- Tertiary: source id for deterministic order.

### Pagination strategy

First slice:

- Fetch bounded sets by source, e.g. latest 50 findings/plans/appointments/files.
- Merge and sort in aggregator.

Later:

- Cursor pagination using `(occurredAt, id)` across audit/event table.
- If hybrid, computed events remain limited while audit events paginate from immutable table.

### Source link strategy

Use `linkTarget` values that map to existing UI areas, not raw URLs at first:

- `patient.overview`
- `patient.findings:<findingId>`
- `patient.plan:<planId>`
- `patient.appointment:<appointmentId>`
- `patient.files:<fileId>`
- `patient.dental_chart:tooth:<toothId>`

### Archived/historical behavior

- Archived clinical records should remain visible in timeline as history if the role can see clinical history.
- Archived findings/files should be visually muted and labelled as archived.
- Archived data must not appear as active recommendation/treatment candidate, but timeline is explicitly historical, so hiding all archive events would erase history.

## Data source mapping

| Source | Existing | Supabase-backed | tenant_id | patient_id | Timestamps | Actor attribution | Events possible now | Missing data | Future change | Risk |
|---|---:|---:|---:|---:|---|---|---|---|---|---|
| patients | yes | yes | yes | id | created_at, updated_at | missing | patient created/updated | created_by/updated_by | add actor attribution or audit events | profile edits rewrite history |
| chief_complaints | yes | yes | yes | yes | created_at, updated_at | missing | complaint added/updated | resolution/archive state | add complaint status or audit events | complaint edits overwrite earlier wording |
| dental_charts | yes | yes | yes | yes | created_at, updated_at | missing | chart created/updated | per-change history | add audit events for tooth changes | cannot reconstruct tooth history |
| tooth_states | yes | yes | yes | via dental_chart | created_at, updated_at | missing | tooth current-state updated | actor/status transitions | add tooth-state audit events | snapshot mistaken for full history |
| findings | yes | yes | yes | yes | created_at, updated_at | missing | finding current status events | transition history/actor | add finding activity events | archived data shown as active if UI filters fail |
| treatment_plans | yes | yes | yes | yes | created_at, updated_at | missing | plan created/current status | actor/approval timestamp | add plan activity events | delete path can erase history |
| treatment_stages | yes | yes | yes | via plan | created_at, updated_at | missing | stage created/current status | actor/completion timestamp | add stage activity events | stage sync can remove absent stages |
| appointments | yes | yes | yes | optional | start/end, created_at, updated_at | doctor_id only, no editor | scheduled/status events | reschedule actor/history, visit boundary | visit/encounter model | appointment confused with actual visit |
| patient_files | yes | yes | yes | yes | created_at, updated_at, archived_at | uploaded_by, archived_by | file uploaded/archived | metadata update actor | add metadata update audit | file previews must obey role visibility |
| documents | schema only | partial/future | yes | yes | created_at | missing | future document attached/generated | module not implemented | documents module | confusing template with patient document |
| audit_logs | schema only | yes | yes | entity_id | created_at | user_id | future audit/system events | patient linkage convention | activity/audit recon | dumping system noise into patient timeline |
| payments | future | no | future | future | future | future | future billing events | module missing | payment/invoice model | leaking finance to clinical roles |
| stock | future | no | future | future/service link | future | future | future stock events | module missing | inventory model | stock noise in clinical timeline |

## Role and visibility rules

### No-tenant and cross-tenant

- No-tenant users: no patient timeline access.
- Cross-tenant users: no cross-tenant timeline events.
- Every timeline query must be tenant-scoped before patient-scoped.

### clinic_owner / clinic_admin

Recommended visibility:

- clinical events;
- admin appointment events;
- files/documents visible under tenant policy;
- system patient-affecting events;
- financial events if the product owner confirms admins can see financial detail.

### doctor

Recommended visibility:

- clinical events;
- findings, chart, plans/stages, patient files related to care;
- appointment events relevant to care;
- no detailed financial events by default unless product rule says otherwise.

### registrar / receptionist

Recommended visibility:

- patient profile basics;
- appointment/admin events;
- maybe limited document status events;
- clinical notes/findings only if product decides registrars may see clinical detail.

Open decision: should registrar see findings or only appointment/status summary?

### cashier

Recommended visibility:

- billing/payment events;
- invoice/debt status;
- limited treatment plan financial summary if needed for payment workflows;
- no clinical notes, findings details, or file thumbnails by default.

Open decision: should cashier see plan stage titles or only billable line items?

### platform roles

- Platform roles do not automatically get clinic patient data access.
- Platform access to patient timeline must be explicit, audited, and preferably support/super-admin only.

### Archived data

- Archived findings/files should appear in clinical timeline as historical events for roles allowed to see clinical history.
- Archived records must be labelled and muted.
- Archived records must not be treated as active recommendations, active risks, or plan candidates.

## UI/UX recommendation

### Location

Add a new patient card tab:

- Current `История приёмов` tab is appointment-only.
- Future unified tab should be `История` or `Лента пациента`.
- Keep `История приёмов` separate or replace it only after timeline UI includes appointment filtering.

Recommended first slice:

- Add new tab `История` in `PatientCardPage`.
- Keep `История приёмов` as appointment-specific until product confirms merge.

### Layout

- Group events by date.
- Show compact event cards with icon/category/status.
- No edit actions from timeline in first slice.
- Each event links to source area: findings, treatment plan, dental chart, appointment, files.

### Filters

Initial filters:

- Все
- Клиника/медицина
- Приёмы
- Проблемы
- Планы лечения
- Файлы
- Финансы
- Система

### Empty state

`История пациента пока пуста. События появятся после приёмов, находок, планов лечения, файлов или других действий.`

### Loading/error

- Loading: skeleton list by date.
- Error: retry button.
- No-tenant: inherited no-tenant gate, do not fallback to localStorage in Supabase-active mode.

### File thumbnails

- Timeline should not embed raw storage paths.
- Use signed URLs through file repository when thumbnails are allowed by role.
- For restricted roles, show metadata-only file event.

### Visit grouping

- Future: group clinical events under visit/encounter once visit model exists.
- Do not treat appointment as visit until encounter model is defined.

## Implementation plan

### 1. PATIENT-TIMELINE-AGGREGATOR-001

Scope:

- Add `PatientTimelineEvent` types.
- Add `PatientTimelineAggregator`.
- Compute events from current repositories: chief complaints, findings, treatment plans/stages, appointments, patient files, optionally patient profile.
- Unit tests for sorting, role visibility, archived handling, no-tenant boundaries.
- No UI mutations.

### 2. PATIENT-TIMELINE-UI-001

Scope:

- Add read-only `История` patient tab.
- Render computed timeline events grouped by date.
- Add category filters.
- Source links to existing tabs/sections where safe.
- No edit/delete/archive actions from timeline.

### 3. ENCOUNTER-VISIT-MODEL-RECON-001

Scope:

- Define appointment vs visit/encounter.
- Decide how completed clinical work, notes, files, and signatures attach to a visit.
- Decide whether timeline groups by appointment, visit, or both.

### 4. AUDIT-ACTIVITY-LOG-RECON-001

Scope:

- Design immutable tenant-scoped activity events.
- Decide relation between `audit_logs`, patient timeline, and security/admin audit.
- Define actor attribution, event metadata, patient linkage, and retention.

### 5. TIMELINE-AUDIT-INTEGRATION-001

Scope:

- Merge computed source events with immutable activity/audit events.
- Add backfill strategy if needed.
- Add cursor pagination for durable event table.

### Later related tasks

- Documents module: document generated/uploaded/signed/archived events.
- Payments module: invoice/payment/refund/debt events with financial visibility rules.
- Stock module: material write-off linked to service/visit.
- Reporting module: timeline event aggregation without leaking cross-tenant data.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Cross-tenant data leak | Every event query must require tenant_id and patient_id; aggregator must use activeTenant. |
| Archived clinical data shown as active | Timeline can show archived history, but UI must label archived and exclude from active workflows. |
| Appointment confused with visit | Add encounter/visit recon before clinical visit grouping. |
| Financial data shown to wrong roles | Add visibility filtering before payment events ship. |
| Supabase-active falling back to localStorage | No-tenant and Supabase-active modes must return empty/error, not local fallback. |
| Missing actor attribution | Use actor fields where present; add activity/audit later for immutable actor history. |
| Source rows rewrite history | Start computed, but add immutable activity table before relying on timeline as legal audit. |
| Performance across many tables | First slice should query bounded sets; later add dedicated event table/cursor pagination. |
| Pagination/sorting inconsistency | Normalize `occurredAt`, stable event ids, deterministic tie-breaks. |
| Future audit migration complexity | Define event interface now and keep computed/audit merge boundary explicit. |

## Backlog impact

- Documents: timeline should consume document metadata/events once module exists.
- Payments: requires payment visibility rules before timeline display.
- Stock: needs service/visit linkage before stock appears in patient timeline.
- Visits/encounters: should be designed before grouping clinical events as visits.
- Audit log: should become immutable source for high-value transition events.
- Reports: timeline categories can later feed operational reports, but reporting must not bypass tenant/RLS rules.

## What was intentionally NOT changed

- No app code changed.
- No DB migrations created or edited.
- No cloud touched.
- No seed data created.
- No dependencies added.
- No external code copied.
- No timeline UI implemented.
- No audit log implemented.
- No encounter/visit model implemented.
- No documents/payments/stock implementation started.

## Checks

- `git status --short`: not run locally in this runtime; PR compare must remain one-file report-only.
- npm checks: not required for report-only recon.
- GitHub Actions CI: run `27623192248` / CI `#460` / success on head `3df8434ce9ed7ce1da066ab723e8137e669ef7c9`.

## Final verdict

`RECON COMPLETE`

## Recommended next task

`PATIENT-TIMELINE-AGGREGATOR-001`
