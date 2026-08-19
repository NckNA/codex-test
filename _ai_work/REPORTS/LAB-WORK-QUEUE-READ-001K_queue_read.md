# LAB-WORK-QUEUE-READ-001K — Tenant-wide laboratory queue read foundation

## Summary

Implementation of the data-only clinic-wide laboratory queue read foundation selected by `LAB-WORK-NEXT-RECON-001J`.

Final verdict: **PASS**.

The new hook loads tenant-wide laboratory work orders through the frozen 001C repository selection and resolves patient names only through a tenant-scoped Supabase PatientRepository created from that accepted backend/tenant context. The legacy unscoped local patient repository is deliberately not used.

## Branch

`feature/lab-work-queue-read-001k`

## PR URL

https://github.com/NckNA/codex-test/pull/377

- Base branch: `main`.
- Baseline: `c240d8942ef0ee7a8245e9a5bc91ad59e53566b4`.
- Initial implementation head: `1873e048d0fad9a00ae4fb4ab967a3e1cc4e2fc2`.
- Initial CI `#808` / `32228045086`: **FAILED** on one timing-sensitive context-switch assertion; ESLint passed and the failure exposed no stale tenant-A data leak.
- Context-isolation hardening head: `b2f67292197fe7e7891ef53c9e78dcc9419aa3c4`; CI `#809` / `32228209219`: **SUCCESS**.
- Final test-stability head before this report update: `4f7dbef29967117f9d451f20ab682e1d1eb97c2e`; CI `#811` / `32228470873`: **SUCCESS**.
- Report update commit: N/A because the report commit cannot truthfully contain its own future SHA; the immutable finalization receipt records the final commit and CI.

## Changed files

Implementation scope before this report:

```text
src/data/hooks/useLaboratoryWorkQueue.ts
src/data/hooks/useLaboratoryWorkQueue.test.tsx
```

This report adds only:

```text
_ai_work/REPORTS/LAB-WORK-QUEUE-READ-001K_queue_read.md
```

No UI, route, sidebar, repository, migration, schema, finance, warehouse, treatment/completed-service, MacDent or amoCRM write changes are included.

## Implemented contract

`useLaboratoryWorkQueue(filters)` now provides a bounded clinic-wide read model:

```text
orders
patientNamesById
isLoading / isError / error / refetch
secondary patient-name loading/error/refetch state
```

It exposes no repository objects and no create/update/delete methods.

## Tenant/backend safety

Order reads use only `useLaboratoryWorkRepository()` from the accepted 001C selection.

For patient-name resolution:

```text
backend === supabase
+ ready
+ tenantId
+ queue contains patient IDs
→ create PatientRepository({ backend: 'supabase', tenantId })
→ listPatients() once
→ map only requested patient IDs to full names
```

For local backend:

```text
orders may load through tenant-qualified laboratory local repository
patient repository is NOT instantiated
patientNamesById = {}
```

This intentionally avoids the legacy global/unscoped local PatientRepository.

Unknown patient IDs are omitted from `patientNamesById`; they are never substituted as raw display labels.

## Filters and query identity

The hook forwards only existing `LaboratoryWorkOrderFilters`:

- `patientId`;
- `status`;
- `laboratoryId`;
- `responsibleDoctorId`.

String IDs are trimmed and blank values normalize to `undefined`.

Order query identity includes:

- backend;
- tenant;
- user;
- normalized filters.

Patient-name query identity includes:

- backend;
- tenant;
- user;
- current unique patient IDs.

This clears stale order/name state on filter or tenant/user context switches.

## Complexity bound

001K performs at most:

```text
laboratory orders: 1 read
patients: 0 or 1 read
```

No per-order patient lookup and no N+1 behavior is introduced.

A later queue UI composed with frozen 001H remains bounded independently of order count.

## Tests

Targeted laboratory data slice:

```text
src/data/hooks/useLaboratoryWorkQueue.test.tsx
src/data/hooks/useLaboratoryWorkRepository.test.tsx
src/data/hooks/usePatientLaboratoryWorkReferences.test.tsx
```

Result: **24/24 PASS**.

The queue tests prove:

- unavailable/not-ready 001C selection performs no reads;
- tenant-wide local laboratory orders can load without opening legacy local patient storage;
- normalized existing filters are forwarded exactly;
- Supabase PatientRepository is created from the exact selected tenant/backend;
- patient list is read once and only relevant names are exposed;
- patient-name read failure does not hide already loaded laboratory orders;
- filter changes clear stale orders and patient names before replacement data arrives;
- tenant/user context changes clear stale previous-tenant data before replacement data arrives;
- unknown patient IDs never become raw display labels;
- no repository or mutation methods are exposed publicly.

## Checks

- `npm run lint`: **PASS**.
- Full Vitest: **120 files / 1242 tests PASS**.
- `npm run build`: **PASS**.
- `git diff --check`: **PASS**.
- GitHub CI #811: **SUCCESS** on `4f7dbef29967117f9d451f20ab682e1d1eb97c2e` after the context-switch timing assertion was stabilized.

Pre-existing React `act(...)` warnings remain in unrelated tests and are outside this task. Existing npm audit findings are unchanged and outside scope.

## Browser smoke

**NOT REQUIRED.**

001K is data-only and changes no route, component, DOM, visual surface or user interaction. Browser access is intentionally not required for this task.

The next UI task must perform real localhost browser role smoke.

## Issues / limitations

- CI #808 caught a timing-sensitive test assumption that required the new tenant's result to remain transiently empty. The product invariant is stricter in the useful direction: the previous tenant's orders/names must disappear immediately; replacement tenant data may arrive immediately or later. The context-isolation test was hardened and then stabilized against scheduler speed, with CI #809 and #811 succeeding.
- Local backend intentionally has no patient-name resolution because the legacy local PatientRepository is not verified tenant-scoped.
- 001K does not add date/overdue server filters; those remain later read-model/UI logic until a measured need justifies repository expansion.
- 001K does not add doctor/laboratory/work-type names; the frozen 001H resolver already owns that concern.
- No laboratory mutations are authorized by this task.

## Final verdict

```text
001K DATA FOUNDATION: PASS
TENANT-WIDE ORDER READ: READY
SAFE SUPABASE PATIENT NAMES: READY
LOCAL UNSCOPED PATIENT FALLBACK: BLOCKED BY DESIGN
RAW UNKNOWN PATIENT ID DISPLAY: BLOCKED
N+1 PATIENT LOOKUPS: NOT INTRODUCED
UI: NOT PART OF 001K
LABORATORY MUTATIONS: NOT AUTHORIZED
```

## Recommended next task

**LAB-WORK-QUEUE-SURFACE-001L — build a separate read-only top-level `/laboratory` operations page using frozen 001K for tenant-wide orders/patient names and frozen 001H for doctor/laboratory/work-type labels. Add bounded status/doctor/laboratory filters, planned-date/overdue presentation, route/sidebar integration, loading/error/empty states, tests, and real localhost browser role smoke. Do not add create/update/delete/status mutation controls, migrations, finance, warehouse, treatment/completed-service coupling, MacDent writes or amoCRM writes.**
