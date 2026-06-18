# PATIENT-TIMELINE-ACTIVITY-INTEGRATION-001 — Activity timeline integration report

## 1. Summary

Implemented safe integration of selected `activity_events` into the existing patient timeline.

The timeline remains read-only and patient-centered. Activity events are additive to the existing source-computed domain facts. The implementation uses `activity_events` through the read-only `AuditActivityRepository` and does not query or render raw `audit_events`.

## 2. Branch

`feature/patient-timeline-activity-integration-001`

## 3. PR URL

https://github.com/NckNA/codex-test/pull/306

## 4. PR head reviewed before final report update

`a493a576bf8ddcbe8997b837d0465706a7b09dbf`

This is the PR head reviewed before the final report update. It includes the implementation commits and the final verified report state from CI #529.

## 5. Report update commit

N/A because the final report update commit cannot reference itself before creation.

## 6. Changed files summary

Implementation files:

- `src/data/aggregators/PatientTimelineAggregator.ts`
- `src/data/hooks/usePatientTimeline.ts`
- `src/components/patient/PatientTimelineTab.tsx`

Tests:

- `src/data/aggregators/PatientTimelineAggregator.test.ts`
- `src/data/hooks/usePatientTimeline.test.tsx`

Report:

- `_ai_work/REPORTS/PATIENT-TIMELINE-ACTIVITY-INTEGRATION-001_activity_timeline.md`

`PatientTimelineTab.tsx` changed only to make existing activity/audit-like timeline category wording safe for product UI: `audit` is labeled as `Активность`, and existing filter chips now include activity-adjacent categories (`payment`, `stock`, `audit`) without redesigning the timeline layout.

## 7. Current timeline recon

### Current sources

`buildPatientTimeline` already builds source-computed events from:

- patient creation;
- chief complaint;
- dental findings;
- treatment plans;
- appointments;
- patient files.

Dental chart is intentionally not emitted as change events yet because the current chart model has no reliable per-change actor/type history.

### Current event categories

Existing timeline categories before this task:

- `patient`
- `complaint`
- `dental_chart`
- `finding`
- `treatment_plan`
- `appointment`
- `file`
- `payment`
- `stock`
- `audit`

No new timeline category was introduced. Future activity categories are mapped into this existing category set.

### Sorting

Timeline sorting remains centralized in `sortPatientTimelineEvents`:

1. `occurredAt` descending;
2. category order;
3. source type;
4. source id;
5. event id.

Activity-derived events are merged before sorting, so domain and activity events sort together by the same helper.

### Archived handling

Existing domain archived handling stays unchanged:

- archived findings are excluded unless `includeArchived=true`;
- archived patient files are excluded unless `includeArchived=true`.

New activity handling mirrors this behavior:

- archived `activity_events` are excluded by default;
- archived `activity_events` are included when `includeArchived=true`.

### Role visibility handling

Existing role filtering remains in `canRoleSeePatientTimelineEvent`:

- clinic owner/admin see all timeline events;
- doctor sees `clinical` and `admin`;
- registrar/receptionist sees `admin`;
- cashier sees `financial` and `admin`;
- platform roles remain blocked until a future explicit audited access task.

Database RLS is still the security boundary. Frontend role filtering is a product display filter, not the security authority.

### PatientId scoping

The aggregator defensively ignores source records whose `patientId` does not match the requested patient. This remains true for activity events:

- `activityEvent.tenantId` must match input tenant;
- `activityEvent.patientId` must match input patient;
- null/other-patient activity events are ignored.

## 8. Existing `usePatientTimeline` flow

Before this task, `usePatientTimeline` loaded:

- chief complaint;
- findings;
- treatment plans;
- appointments;
- patient files;
- dental chart.

The hook uses `activeTenant.tenantId` and `patient.id`; in Supabase-active no-tenant state it returns an empty timeline and does not query repositories.

Error behavior is fatal through `useAsyncQuery`: if a source repository rejects, the hook exposes `isError`/`error`. This task preserves that policy for activity repository failures instead of silently hiding repeated Supabase/RLS errors.

## 9. Existing PatientTimelineTab/UI

The UI expects `PatientTimelineEvent[]`, filters by category and archived flag, then sorts through the existing timeline helpers.

This task did not redesign layout. It only adjusted activity-safe labels/filters:

- `audit` label changed from `Журнал` to `Активность`;
- filter chips include `Оплаты`, `Склад`, and `Активность` so mapped activity categories remain filterable.

No raw audit viewer was added.

## 10. Existing AuditActivityRepository recon

`AuditActivityRepository` already provides read-only methods:

- `listAuditEvents`;
- `listActivityEvents`;
- `listPatientActivityEvents`.

This task uses only:

- `listPatientActivityEvents({ tenantId, patientId, includeArchived })`.

Repository behavior relevant to this task:

- `tenantId` is required;
- `patientId` is required for patient activity;
- `includeArchived` controls archived activity inclusion;
- no localStorage fallback exists;
- no write methods exist;
- no raw audit write/RPC path is introduced.

## 11. Activity integration summary

### Where activity_events are loaded

`usePatientTimeline` now creates `AuditActivityRepository` only when the current data backend is Supabase.

When `tenantId` and `patientId` are present and Supabase is active, it calls:

```ts
listPatientActivityEvents({ tenantId, patientId, includeArchived })
```

When the hook is in local/non-Supabase mode, it does not create a local activity fallback. Existing domain timeline sources still work; activity events are simply not faked locally.

### How activity_events are mapped

`buildPatientTimeline` accepts `activityEvents?: ActivityEvent[]` and maps them to `PatientTimelineEvent` with:

- `title` from `activityEvent.title`;
- `description` from `activityEvent.description` only if present;
- `occurredAt` from `activityEvent.occurredAt`;
- fallback to `createdAt` only if `occurredAt` is invalid;
- `visibility` from `activityEvent.visibility`;
- `sourceType`, `sourceId`, and `sourceStatus` preserved;
- `activityEventId` preserved as an opaque reference;
- `auditEventId` preserved only as an opaque reference, never displayed.

Raw `metadata` is not copied into display text and raw `before_data` / `after_data` / `diff_data` are not rendered.

### Merge and sorting

Activity events are pushed into the same event list as domain events, then sorted by the existing `sortPatientTimelineEvents` helper.

No dangerous deduplication was added because there is no stable cross-source dedupe key yet.

## 12. Category and visibility behavior

### Category mapping table

| ActivityEventCategory | PatientTimelineEventCategory |
|---|---|
| `patient` | `patient` |
| `complaint` | `complaint` |
| `dental_chart` | `dental_chart` |
| `finding` | `finding` |
| `treatment_plan` | `treatment_plan` |
| `appointment` | `appointment` |
| `visit` | `appointment` |
| `encounter` | `appointment` |
| `completed_service` | `treatment_plan` |
| `file` | `file` |
| `document` | `file` |
| `payment` | `payment` |
| `stock` | `stock` |
| `audit` | `audit` shown as `Активность` |
| `system` | `audit` shown as `Активность` |

No new category was added because the current UI and filters already have a finite category set. Future workflow-specific categories can be introduced intentionally when visits/encounters/completed services become first-class timeline concepts.

### Archived behavior

`activityEvent.isArchived` is honored:

- default: excluded;
- `includeArchived=true`: included.

### Role/RLS relationship

RLS remains the primary authorization layer. The frontend only receives rows visible under database policies. The UI role filter still applies the existing product visibility logic on top of that.

## 13. Safety boundary

Confirmed by implementation/tests:

- uses `activity_events`, not raw `audit_events`;
- no `listAuditEvents` call in `usePatientTimeline`;
- no raw audit diff rendering;
- no `before_data` / `after_data` / `diff_data` display;
- no metadata JSON displayed as user-facing text;
- no audit write methods added;
- no service role usage;
- no localStorage fallback for activity;
- no migrations changed;
- no Supabase cloud touched;
- no browser smoke run.

## 14. Error behavior

If `listPatientActivityEvents` fails, `usePatientTimeline` surfaces the error through the existing `useAsyncQuery` error path.

This matches the project pattern for repository failures: do not silently degrade repeated Supabase/RLS/repository errors. Existing UI already displays timeline load errors.

In local/non-Supabase mode, the hook does not query the activity repository because that repository intentionally has no localStorage fallback. Domain timeline events remain available in local mode.

## 15. Duplicate risk

Activity events may describe facts that are also computed from source tables, for example a future patient/file/finding activity event.

No deduplication was added in this task because there is no stable, explicit, cross-source dedupe key. Activity is additive for now. Future write/integration tasks should avoid emitting activity events that intentionally duplicate existing source-computed timeline facts unless product wants both.

## 16. Tests

Updated test files:

- `src/data/aggregators/PatientTimelineAggregator.test.ts`
- `src/data/hooks/usePatientTimeline.test.tsx`

Covered scenarios:

1. `buildPatientTimeline` includes mapped activity events.
2. Activity event uses `occurredAt` as timeline date.
3. Activity event falls back to `createdAt` only when `occurredAt` is invalid.
4. Activity title/description are used safely.
5. Raw metadata is not copied into display text.
6. Opaque `auditEventId` is preserved but not displayed as user-facing text.
7. Activity events are additive and domain events remain.
8. Sorting mixes domain and activity events correctly.
9. Archived activity events are excluded by default.
10. Archived activity events are included with `includeArchived=true`.
11. Activity tenant/patient scoping is enforced.
12. `usePatientTimeline` calls `listPatientActivityEvents` with `tenantId` and `patientId`.
13. No-tenant prevents activity repository query.
14. Activity repository errors are surfaced.
15. Category mapping covers all `ActivityEventCategory` values.
16. No raw `audit_events` repository query is used.
17. No audit write method is called.
18. Existing timeline filters still work with activity-derived events.
19. Existing role visibility tests still pass.

## 17. What was intentionally NOT changed

- no migrations;
- no Supabase cloud;
- no local Supabase;
- no browser smoke;
- no UI redesign;
- no admin audit viewer;
- no audit writes;
- no visits/encounters implementation;
- no completed services implementation;
- no payments/stock/documents implementation;
- no frontend write repository methods;
- no seed changes;
- no RLS/grants changes.

## 18. Checks

Local checks on implementation head `511c02b0c9994ab6e94ef331c3c76ae2043f81dc`:

- `git status --short`: clean before report creation;
- `npm run lint`: PASS;
- `npm run test -- --run`: PASS, 45 files / 375 tests;
- `npm run build`: PASS.

Warnings observed:

- existing React `act(...)` warnings in unrelated component/hook tests;
- existing Vite chunk-size warning.

Both commands exited successfully.

### GitHub Actions CI

Fresh CI after push:

- Workflow: `CI`
- Run id: `27752767059`
- CI number: `529`
- Tested commit: `a493a576bf8ddcbe8997b837d0465706a7b09dbf`
- Status: completed
- Conclusion: success
- Required checks: ESLint, tests, build passed.


## 19. Final verdict

`PATIENT TIMELINE ACTIVITY INTEGRATION IMPLEMENTED AND VERIFIED`

## 20. Recommended next task

`SUPABASE-CLOUD-APPLY-AUDIT-ACTIVITY-001`
