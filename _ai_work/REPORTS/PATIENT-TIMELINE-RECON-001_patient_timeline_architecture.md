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

`4613061b4dac7e6505d69b0d9bfb73bc875c0502`

## Report update commit

N/A because the final report update commit cannot reference itself before creation.

## Changed files summary

One new report file only:

- `_ai_work/REPORTS/PATIENT-TIMELINE-RECON-001_patient_timeline_architecture.md`

## Metadata cleanup

Recon content was reviewed as acceptable. This update refreshes final report metadata only.

## Current state summary

There is no unified patient timeline aggregator or timeline event model yet. `PatientCardPage` has an appointment-history tab, but that is appointment-only rather than a unified patient history. Existing patient-related sources include patients, chief complaints, dental chart/tooth states, findings, treatment plans and stages, appointments, patient files, documents, payments/future finance, stock/future inventory, and audit/activity foundations.

Key data sources already have enough tenant/patient/timestamp information to support a computed first timeline slice. Actor attribution and immutable transition history are inconsistent or missing across several domains, so a dedicated immutable timeline table should not be the first implementation step.

## Recommended architecture

Use a hybrid model.

Near term:

- create a `PatientTimelineEvent` domain type;
- create a `PatientTimelineAggregator` that computes patient events from existing Supabase-backed source tables and repositories;
- render a read-only timeline in a future patient-card tab;
- keep source tables as the source of truth.

Later:

- design an immutable activity/audit event model;
- capture state transitions, actor attribution, archive/delete events, and system actions;
- merge computed source events with immutable audit events behind one stable interface.

## Proposed PatientTimelineEvent model

The future model should include:

- `id`, `tenantId`, `patientId`, `occurredAt`;
- category such as patient, complaint, dental_chart, finding, treatment_plan, appointment, file, payment, stock, or audit;
- source type and source id;
- optional links to tooth, finding, treatment plan, stage, appointment, file;
- actor user id / actor label when available;
- visibility category: clinical, admin, financial, or system;
- archive/historical state;
- source link target and optional metadata.

Timeline must keep these concepts separate:

- complaint is not finding;
- finding is not diagnosis;
- treatment plan is not completed service;
- appointment is not visit/encounter;
- payment is not treatment;
- file is not document template;
- archive is not hard delete.

## Data source mapping summary

Timeline-ready now:

- patient files are the strongest source because migration `0011` provides metadata, context links, uploader/archive fields, and timestamps;
- findings can provide current-state clinical events but need immutable transition events later;
- treatment plans and stages can provide created/current-status events but need safer archive/cancel semantics;
- appointments can provide scheduling/status events but need an encounter/visit boundary;
- chief complaints can provide added/updated events but need status/archive semantics later.

Needs future work:

- financial/payment timeline requires a payments module and role visibility rules;
- stock/inventory events require stock/service linkage;
- documents require a full documents module;
- audit/activity requires a dedicated recon before becoming a patient timeline source.

## Role and visibility rules

Recommended baseline:

- clinic owner/admin: clinical, admin, files/documents under tenant policy, system patient-affecting events, and financial details only if product rules allow;
- doctor: clinical care events, findings, chart, plans/stages, related files, and care-related appointments;
- registrar/receptionist: profile basics and appointment/admin events, with clinical detail as an open product decision;
- cashier: billing/payment events and limited financial summary, not clinical notes or file thumbnails by default;
- platform roles: no automatic clinic patient timeline access;
- no-tenant and cross-tenant: no access.

Archived findings/files should remain visible as historical events for roles allowed to see clinical history, but must be muted/labelled and must not re-enter active workflows.

## UI/UX recommendation

First UI slice:

- add a read-only `История` patient tab;
- group events by date;
- provide category filters;
- link events to existing source areas where safe;
- do not allow edit/archive/delete actions directly from the timeline in the first slice;
- keep appointment history separate until the product decides whether to merge it into the unified timeline.

## Implementation plan

1. `PATIENT-TIMELINE-AGGREGATOR-001`
   - Add timeline types and computed aggregator.
   - Compute events from complaints, findings, plans/stages, appointments, patient files, and optionally patient profile.
   - Test sorting, role visibility, archived handling, and no-tenant boundaries.

2. `PATIENT-TIMELINE-UI-001`
   - Add read-only `История` tab.
   - Render computed timeline events grouped by date.
   - Add filters and source links.

3. `ENCOUNTER-VISIT-MODEL-RECON-001`
   - Define appointment versus visit/encounter.

4. `AUDIT-ACTIVITY-LOG-RECON-001`
   - Design immutable tenant-scoped activity events and their relation to patient timeline.

5. `TIMELINE-AUDIT-INTEGRATION-001`
   - Merge computed source events with immutable activity/audit events.

## Top risks

- cross-tenant leakage;
- archived clinical data shown as active;
- appointment confused with visit;
- financial data shown to wrong roles;
- Supabase-active mode falling back to localStorage;
- missing actor attribution;
- source rows rewriting history;
- performance across many tables;
- pagination/sorting inconsistency;
- future audit migration complexity.

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
- GitHub Actions CI: run `27623353949` / CI `#461` / success / tested commit `4613061b4dac7e6505d69b0d9bfb73bc875c0502`.

## Final verdict

`RECON COMPLETE`

## Recommended next task

`PATIENT-TIMELINE-AGGREGATOR-001`
