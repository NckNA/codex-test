# PATIENT-TIMELINE-AGGREGATOR-001 timeline aggregator

## Summary

Implemented a UI-neutral patient timeline event model and a pure computed aggregator.

The aggregator accepts already loaded source objects. It does not query Supabase, read localStorage, use browser APIs, or require local/cloud databases.

## Branch

`feature/patient-timeline-aggregator-001`

## PR

https://github.com/NckNA/codex-test/pull/297

## PR head reviewed before final report update

`ddc30fc003dfdf2cf03ba6b34aa97476a7ec388e`

## Report update commit

N/A because the final report update commit cannot reference itself before creation.

## Changed files

- `src/data/aggregators/PatientTimelineAggregator.ts`
- `src/data/aggregators/PatientTimelineAggregator.test.ts`
- `_ai_work/REPORTS/PATIENT-TIMELINE-AGGREGATOR-001_timeline_aggregator.md`

## Current state recon

Inspected current patient-related data shapes:

- `Patient`: id, status, createdAt.
- `ChiefComplaint`: patientId, text, relatedTeeth, createdAt, updatedAt.
- `DentalFinding`: patientId, optional toothNumber, status, createdAt, updatedAt.
- `TreatmentPlan`: patientId, status, createdAt, updatedAt, stages, totalPrice.
- `Appointment`: optional patientId, doctorId, service, start/end, status, createdAt.
- `PatientFileRecord`: tenantId, patientId, storage metadata, archive fields, uploadedBy, archivedBy, createdAt, updatedAt.
- `DentalChart`: patientId, createdAt, updatedAt, but no reliable per-change event history.

## Implementation

Added `PatientTimelineAggregator.ts` with:

- `PatientTimelineEventCategory`;
- `PatientTimelineEventVisibility`;
- `PatientTimelineSourceType`;
- `PatientTimelineEvent`;
- `BuildPatientTimelineInput`;
- `buildPatientTimeline`;
- `sortPatientTimelineEvents`;
- `filterPatientTimelineEvents`;
- `canRoleSeePatientTimelineEvent`.

## Sources covered

Supported:

- patient creation event;
- chief complaint event;
- finding events;
- treatment plan events;
- appointment events;
- patient file events.

Deferred:

- dental chart per-change events;
- treatment stage events;
- payments;
- stock;
- documents;
- audit/activity;
- encounter/visit model.

## Rules

Event id strategy:

- `${sourceType}:${sourceId}:${type}`.

Timestamps:

- source timestamps only;
- invalid/missing timestamps are omitted;
- no generated `now` events.

Sorting:

1. occurredAt descending;
2. category order;
3. source type;
4. source id;
5. event id.

Archived handling:

- archived findings/files are excluded by default;
- archived findings/files are included only with `includeArchived: true`.

Role visibility helper:

- owner/admin: all event visibility buckets;
- doctor: clinical and admin;
- registrar/receptionist: admin only;
- cashier: financial and admin;
- platform roles: no patient event access in this helper.

## Boundary

The aggregator requires:

- `tenantId`;
- `patientId`.

It throws clear errors when either is missing.

It does not perform data loading. Future hook/UI code must load source data and pass it in.

## Tests

Added `src/data/aggregators/PatientTimelineAggregator.test.ts`.

Covered:

- findings;
- treatment plans;
- appointments;
- appointment is not treatment completion;
- patient files;
- patient and complaint events;
- timestamp sorting;
- deterministic tie-break;
- archived default exclusion;
- includeArchived behavior;
- missing tenant/patient errors;
- invalid timestamp omission;
- category/visibility/archive filtering;
- patientId scoping;
- pure unit behavior;
- role visibility helper.

## Not changed

- no UI tab;
- no hook;
- no migrations;
- no cloud;
- no browser smoke;
- no local database;
- no audit table;
- no visit/encounter model;
- no payment/stock/documents implementation;
- no dependencies.

## Checks

GitHub Actions CI on reviewed head `ddc30fc003dfdf2cf03ba6b34aa97476a7ec388e`:

- run `27630136211`;
- CI `#472`;
- ESLint: success;
- tests: success;
- build: success.

## Final verdict

TIMELINE AGGREGATOR IMPLEMENTED AND VERIFIED

## Recommended next task

`PATIENT-TIMELINE-UI-001`
