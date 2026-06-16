# PATIENT-TIMELINE-AGGREGATOR-001 timeline aggregator

## Summary

Implemented the first patient timeline foundation: a UI-neutral domain event model plus a computed `buildPatientTimeline` aggregator.

The aggregator is intentionally pure. It accepts already loaded source objects and does not query Supabase, read localStorage, call browser APIs, or require local/cloud databases.

## Branch name

`feature/patient-timeline-aggregator-001`

## PR URL

Pending PR creation.

## PR head reviewed before final report update

Pending PR creation.

## Report update commit

N/A because the final report update commit cannot reference itself before creation.

## Changed files summary

Initial implementation scope:

- `src/data/aggregators/PatientTimelineAggregator.ts`
- `src/data/aggregators/PatientTimelineAggregator.test.ts`
- `_ai_work/REPORTS/PATIENT-TIMELINE-AGGREGATOR-001_timeline_aggregator.md`

## Current state recon

Inspected current project types and data-layer files:

- `src/types/index.ts`
- `src/data/aggregators/ClinicalSummaryAggregator.ts`
- `src/domain/findingStatus.ts`
- `src/data/repositories/PatientFilesRepository.ts`
- `src/contexts/TenantContext.tsx`

Existing shapes found:

- `Patient` has `id`, profile fields, `status`, and `createdAt`.
- `ChiefComplaint` has `patientId`, `text`, `relatedTeeth`, `createdAt`, and `updatedAt`.
- `DentalFinding` has `patientId`, optional `toothNumber`, `status`, `createdAt`, and `updatedAt`.
- `TreatmentPlan` has `patientId`, `status`, `createdAt`, `updatedAt`, stages, and total price.
- `Appointment` has optional `patientId`, start/end time, status, doctor id, service, and created timestamp.
- `PatientFileRecord` has tenant/patient ids, storage metadata, archive fields, upload/archive actors, and created/updated timestamps.
- `DentalChart` has patient id and chart timestamps, but no reliable per-change history or actor attribution.

## Sources supported in this PR

Supported now:

- patient profile creation event, when patient object is provided;
- chief complaint creation event, when complaint object is provided;
- finding events;
- treatment plan creation events;
- appointment scheduled events;
- patient file upload/archive events.

Deferred:

- dental chart per-tooth change events, because current chart data lacks reliable per-change actor/type history;
- treatment stage events, because current stage type does not have reliable timestamps;
- payments, stock, documents, audit events, and encounters, because those modules are future work or not stable timeline sources yet.

## Implementation summary

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

## Timeline event rules

Event id strategy:

- `${sourceType}:${sourceId}:${type}`.

`occurredAt` strategy:

- source timestamp only;
- no fake `now` events;
- invalid or missing source timestamps are omitted.

Sorting:

1. `occurredAt` descending;
2. category order;
3. source type;
4. source id;
5. event id.

Archived handling:

- archived findings are excluded by default;
- archived patient files are excluded by default;
- archived findings/files are included only with `includeArchived: true`.

Source links:

- finding ids, tooth ids, treatment plan ids, appointment ids, file ids, and file clinical metadata are preserved where present.

Role visibility:

- owner/admin can see all event visibility buckets;
- doctor can see clinical and admin events;
- registrar/receptionist can see admin events only;
- cashier can see financial and admin events;
- platform roles are conservative and do not receive patient event access in this helper.

## No-tenant and data boundary

The aggregator requires:

- `tenantId`;
- `patientId`.

Missing `tenantId` throws:

`Active clinic is required for patient timeline.`

Missing `patientId` throws:

`Patient is required for patient timeline.`

The aggregator does not:

- call Supabase;
- read localStorage;
- use browser APIs;
- know about auth mode;
- require local Supabase;
- require cloud Supabase.

## Tests

Added:

- `src/data/aggregators/PatientTimelineAggregator.test.ts`

Covered cases:

- builds finding events;
- builds treatment plan events;
- builds appointment events;
- appointment is not treated as completed treatment;
- builds patient file events;
- preserves tooth/finding/plan/file source links;
- can include patient and complaint events;
- sorts descending by source timestamp;
- deterministic tie-break for equal timestamps;
- archived findings excluded by default;
- archived findings included with `includeArchived: true`;
- archived patient files excluded by default;
- archived patient files included with `includeArchived: true`;
- missing tenant error;
- missing patient error;
- invalid timestamps are omitted;
- filters by category, visibility, and archived flag;
- patientId scoping for appointments/files;
- pure unit behavior without Supabase/localStorage/browser;
- conservative role visibility helper.

## What was intentionally NOT changed

- no UI;
- no PatientCardPage `История` tab;
- no hook;
- no browser smoke;
- no migrations;
- no cloud;
- no local Supabase;
- no audit table;
- no encounter/visit model;
- no payment/stock/documents implementation;
- no dependencies.

## Checks

Pending after PR creation:

- `git status --short`;
- `npm run lint`;
- `npm run test -- --run`;
- `npm run build`;
- GitHub Actions CI.

## Final verdict

PARTIAL pending CI validation.

## Recommended next task

`PATIENT-TIMELINE-UI-001`
