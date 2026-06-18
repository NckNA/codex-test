# AUDIT-ACTIVITY-REPOSITORY-001B Repository Report

## Summary

This PR adds a read-only TypeScript repository layer for the audit/activity schema from `AUDIT-ACTIVITY-LOG-001A`.

It adds domain types, query options, mapper functions, a read-only repository interface, and a Supabase implementation for:

- tenant audit events;
- tenant activity events;
- patient activity events.

The repository does not create, update, delete, archive, or insert audit/activity events. Write paths remain a future `AUDIT-ACTIVITY-RPC-001C` task, because letting arbitrary client code write compliance history would be software malpractice with prettier syntax.

## Branch name

`feature/audit-activity-repository-001b`

## PR URL

https://github.com/NckNA/codex-test/pull/304

## PR head reviewed before final report update

`e4ee992eca67d580106bb57b4fff172e37590cec`

This is the PR head before the report metadata update that added the PR URL and reviewed head.

## Report update commit

N/A because the final report update commit cannot reference itself before creation.

## Changed files summary

Expected changed files:

1. `src/data/repositories/AuditActivityRepository.ts`
2. `src/data/repositories/AuditActivityRepository.test.ts`
3. `_ai_work/REPORTS/AUDIT-ACTIVITY-REPOSITORY-001B_repository.md`

No migrations, UI, cloud config, seed data, generated types, browser smoke, RPC, or timeline integration were changed.

## Current repository pattern recon

Existing repositories use tenant-scoped Supabase queries and throw Supabase errors instead of silently swallowing them.

Observed patterns:

- `FindingsRepository` uses `tenant_id` and `patient_id` filters for Supabase reads and writes.
- `AppointmentRepository` filters appointments by `tenant_id`, and patient appointment reads also filter `patient_id`.
- `PatientFilesRepository` requires an active clinic for Supabase file access and throws when Supabase is not configured.
- Several older clinical repositories still have localStorage fallbacks for demo/local operation.

For audit/activity this PR intentionally does not add localStorage fallback. Fake local audit history would look authoritative while being disposable. That is worse than having no audit history.

## Implementation summary

Added in `src/data/repositories/AuditActivityRepository.ts`:

- `AuditEventCategory`
- `AuditEventSeverity`
- `AuditEventRedactionLevel`
- `AuditEvent`
- `ActivityEventCategory`
- `ActivityEventVisibility`
- `ActivityEvent`
- `ListAuditEventsOptions`
- `ListActivityEventsOptions`
- `ListPatientActivityEventsOptions`
- `AuditActivityRepository`
- `SupabaseAuditActivityRepository`
- `createAuditActivityRepository`
- `mapAuditEventRow`
- `mapActivityEventRow`
- `normalizeAuditActivityLimit`
- `normalizeAuditActivityOffset`

The repository exposes camelCase domain records and hides Supabase snake_case rows behind mapper functions.

## Read-only boundary

The public repository interface only exposes:

- `listAuditEvents`
- `listActivityEvents`
- `listPatientActivityEvents`

It does not expose:

- `createAuditEvent`
- `createActivityEvent`
- `updateAuditEvent`
- `deleteAuditEvent`
- `archiveAuditEvent`
- raw insert/update/delete helpers.

The implementation uses the normal Supabase browser client only. It does not call service-role APIs and does not include any secret-bearing path.

## Query behavior

### Audit events

`listAuditEvents`:

- requires `tenantId`;
- queries `audit_events`;
- filters defensively by `tenant_id`;
- supports category, severity, target, patient, actor, and date filters;
- sorts by `created_at` descending;
- applies bounded pagination.

### Activity events

`listActivityEvents`:

- requires `tenantId`;
- queries `activity_events`;
- filters defensively by `tenant_id`;
- supports patient, category, visibility, source, and date filters;
- excludes archived records by default;
- includes archived records only when `includeArchived=true`;
- sorts by `occurred_at` descending, then `created_at` descending;
- applies bounded pagination.

### Patient activity

`listPatientActivityEvents`:

- requires `tenantId`;
- requires `patientId`;
- delegates to `listActivityEvents` with both tenant and patient filters.

Default limit is `50`. Maximum limit is `200`. Offset defaults to `0`.

## RLS relationship

The repository is not an authorization system by itself.

It adds defensive tenant filters before every tenant-scoped query, while database RLS remains the source of authorization.

The migration keeps raw audit reads limited to clinic owner/admin by tenant and restricts activity reads by role/visibility. This repository relies on those policies and does not add write access.

## Mappers

`mapAuditEventRow` maps:

- `tenant_id` to `tenantId`;
- `actor_user_id` to `actorUserId`;
- `target_type` to `targetType`;
- `before_data`, `after_data`, `diff_data` to JSON object records or null;
- `redaction_level` to `redactionLevel`;
- `created_at` to `createdAt`.

`mapActivityEventRow` maps:

- `tenant_id` to `tenantId`;
- `patient_id` to `patientId`;
- `audit_event_id` to `auditEventId`;
- `source_type` and `source_id` to source fields;
- `source_status` to `sourceStatus`;
- `occurred_at` to `occurredAt`;
- `is_archived` to `isArchived`;
- `created_at` to `createdAt`.

Metadata defaults to `{}` when missing or not an object.

## Tests

Test file:

`src/data/repositories/AuditActivityRepository.test.ts`

Covered scenarios:

1. `listAuditEvents` requires tenantId.
2. `listActivityEvents` requires tenantId.
3. `listPatientActivityEvents` requires tenantId and patientId.
4. `listAuditEvents` queries `audit_events`.
5. `listAuditEvents` applies tenant, category, severity, target, patient, actor, and date filters.
6. `listAuditEvents` sorts by `created_at` descending.
7. `listAuditEvents` applies bounded range pagination.
8. `listActivityEvents` queries `activity_events`.
9. `listActivityEvents` applies tenant and patient filters.
10. `listActivityEvents` excludes archived by default.
11. `listActivityEvents` includes archived when requested.
12. `listActivityEvents` applies visibility, category, source, and date filters.
13. `listActivityEvents` sorts by `occurred_at` and `created_at` descending.
14. `listPatientActivityEvents` filters tenant and patient.
15. Supabase errors are surfaced.
16. Mappers convert snake_case rows to camelCase records.
17. Metadata defaults to `{}`.
18. Before/after/diff JSON is preserved.
19. Limit and offset are normalized safely.
20. The public repository object does not expose create/update/delete methods.

Tests use a mocked Supabase query chain only.

## What was intentionally NOT changed

- No migrations.
- No Supabase cloud.
- No local Supabase.
- No browser smoke.
- No UI.
- No timeline integration.
- No RPC/write path.
- No encounter/visit implementation.
- No payments, stock, or documents implementation.
- No service role access.
- No localStorage fallback.
- No secrets or environment files.

## Checks

Local terminal checks were not run in this environment.

GitHub Actions CI is pending after PR creation.

Expected checks:

- `npm run lint`
- `npm run test -- --run`
- `npm run build`

## Final verdict

`PARTIAL`

Reason: implementation and unit tests were added, but GitHub Actions CI has not run yet at this report metadata update.

## Recommended next task

`AUDIT-ACTIVITY-RPC-001C`
