# LAB-WORK-QUEUE-SURFACE-001L — Read-only laboratory operations page

## Summary

Adds the first top-level read-only laboratory operations page at `/laboratory`, composing the frozen 001K tenant-wide queue read model with the frozen 001H laboratory reference resolver.

Final verdict: **PASS**.

## Branch

`feature/lab-work-queue-surface-001l`

## PR URL

https://github.com/NckNA/codex-test/pull/378

- Base: `main`.
- Baseline: `d328b948b455706d941cc12da22c915f032b89ae`.
- Implementation head: `9770d6dbbc39c751aa800b7169fd9776f956fa89`.
- Implementation CI: run `#814` / `32230036581`, **SUCCESS** on `9770d6dbbc39c751aa800b7169fd9776f956fa89`.
- Report update commit: N/A because a report cannot truthfully contain its own future commit SHA; the immutable finalization receipt records the final PR HEAD and CI after report publication.

## Changed files

Implementation scope:

```text
src/App.tsx
src/components/layout/Sidebar.tsx
src/components/layout/Sidebar.test.tsx
src/pages/LaboratoryPage.tsx
src/pages/LaboratoryPage.test.tsx
```

This report adds only:

```text
_ai_work/REPORTS/LAB-WORK-QUEUE-SURFACE-001L_ui.md
```

No repository/schema/migration, finance, warehouse, treatment/completed-service, MacDent or amoCRM write changes are included.

## UI contract

The new `/laboratory` page shows clinic-wide laboratory work with:

- patient human-readable name from 001K;
- responsible doctor name from 001H;
- laboratory name from 001H;
- ordered work-type names from 001H;
- order title and order number;
- in-progress/completed status;
- planned readiness and overdue attention state;
- sent/try-in/updated timestamps in tenant timezone;
- shade, selected teeth and comment when present.

The page is explicitly read-only. There are no create, edit, delete or status-change controls.

## Filtering

Filters are client-side over the already loaded bounded read model and therefore do not turn UI changes into additional repository calls:

- text search over patient/order/reference labels;
- status;
- due bucket (overdue/today/upcoming/without date);
- responsible doctor;
- laboratory.

Doctor/laboratory filter options use resolved names. Raw UUIDs are never used as visible fallback labels.

## Failure behavior

Primary order load failure has its own safe retry state.

Secondary patient/reference failures do not hide already loaded laboratory orders. Separate retry actions exist for patient names and laboratory reference labels.

Unknown/missing names use safe textual fallbacks rather than raw IDs.

## Navigation and roles

`/laboratory` is wired into App routing and Sidebar.

Sidebar visibility follows the existing 0035 laboratory SELECT RLS roles:

```text
clinic_owner
clinic_admin
doctor
registrar
```

The navigation item is hidden for unsupported `cashier` and `receptionist` roles. Dev/no-tenant prototype mode keeps the item visible.

## Tests

Targeted slice:

```text
src/pages/LaboratoryPage.test.tsx
src/components/layout/Sidebar.test.tsx
src/data/hooks/useLaboratoryWorkQueue.test.tsx
src/data/hooks/usePatientLaboratoryWorkReferences.test.tsx
```

Result: **25/25 PASS**.

The page/sidebar tests prove:

- human labels are rendered and raw doctor/laboratory IDs are not;
- overdue and completed presentation;
- status/doctor/laboratory/search filtering;
- primary read error and retry;
- secondary reference failures preserve order visibility and retry independently;
- no create/edit/delete mutation language is introduced;
- sidebar role visibility matches laboratory read roles.

## Checks

- ESLint: **PASS**.
- Targeted suite: **25/25 PASS**.
- Full Vitest: **122 files / 1253 tests PASS**.
- Build: **PASS**.
- `git diff --check`: **PASS**.
- GitHub implementation CI #814: **SUCCESS**.

Pre-existing React `act(...)` warnings in unrelated tests and existing npm audit findings are unchanged and outside scope.

## Browser smoke

Real localhost browser QA was performed against the exact 001L worktree on `http://127.0.0.1:5188`, connected only to local Supabase. QA users were seeded through the guarded local fixture tool; passwords/secrets were not exposed or committed.

### Admin A

Role: `clinic_admin`, Demo Clinic A.

Synthetic fixture contained one patient, one doctor, one laboratory, two work types and two orders (one overdue in-progress and one completed).

Observed:

- `/laboratory` rendered successfully;
- patient, doctor and laboratory human names visible;
- both work-type names visible;
- overdue and completed states visible;
- raw patient/doctor/laboratory UUIDs not visible;
- no create/edit/delete/status-change controls;
- console errors: 0;
- failed requests: 0;
- secrets visible: false;
- cleanup verification: links/orders/types/labs/doctors/patients = `0/0/0/0/0/0`.

Screenshot: local QA artifact `LAB-WORK-QUEUE-SURFACE-001L-admin.png` (not committed).

### Doctor A

Role: `doctor`, Demo Clinic A.

Independent synthetic fixture repeated the same operational read scenario through doctor RLS.

Observed:

- `/laboratory` rendered successfully through doctor role;
- patient, doctor, laboratory and both work-type labels visible;
- overdue and completed states visible;
- no raw fixture UUIDs;
- no mutation controls;
- console errors: 0;
- failed requests: 0;
- secrets visible: false;
- cleanup verification: links/orders/types/labs/doctors/patients = `0/0/0/0/0/0`.

Screenshot: local QA artifact `LAB-WORK-QUEUE-SURFACE-001L-doctor.png` (not committed).

## Issues / limitations

- 001L intentionally does not implement laboratory order creation, editing, deletion or status transitions.
- Local fallback may omit patient/doctor labels where legacy local repositories are not tenant-scoped; no unsafe global fallback is used.
- Due filtering is presentation/read-model logic; no new server-side date filtering is introduced.
- This task does not define audit, concurrency or atomic mutation semantics.

## Final verdict

```text
001L READ-ONLY LABORATORY PAGE: PASS
TENANT-WIDE QUEUE: READY
ADMIN RLS SMOKE: PASS
DOCTOR RLS SMOKE: PASS
RAW ID DISPLAY: BLOCKED
MUTATION CONTROLS: NOT PRESENT
CLOUD/PRODUCTION WRITES: NOT USED
```

## Recommended next task

**LAB-WORK-MUTATION-RECON-001M — report-only reconnaissance for laboratory work mutations. Define authorized roles, create/update/status-transition/delete semantics, audit requirements, atomic work-type relation updates, concurrency/idempotency behavior, historical-reference handling, patient/doctor/laboratory FK validation, safe error/reconciliation behavior, tests and real-browser QA gates. Do not implement mutation UI or code during RECON.**
