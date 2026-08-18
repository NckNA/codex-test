# LAB-WORK-FOUNDATION-001A — Laboratory Work Schema Foundation

## 1. Final verdict

Task verdict: **LABORATORY WORK SCHEMA FOUNDATION IMPLEMENTED AND VERIFIED LOCALLY**

Machine-readable final verdict: **PASS**

The bounded tenant-scoped laboratory-work schema accepted by `MACDENT-LAB-WORKFLOW-RECON-001` is implemented without UI, application, cloud Supabase, finance, warehouse, amoCRM or MacDent mutations.

## 2. Summary

Added four tenant-safe schema entities:

- `public.laboratories`;
- `public.laboratory_work_types`;
- `public.laboratory_work_orders`;
- `public.laboratory_work_order_types`.

The implementation preserves the semantic boundary:

```text
LaboratoryWorkOrder = operational laboratory production/coordination fact

LaboratoryWorkOrder != TreatmentPlan
LaboratoryWorkOrder != TreatmentStage
LaboratoryWorkOrder != CompletedService
LaboratoryWorkOrder != Appointment
LaboratoryWorkOrder != ClinicalEncounter
LaboratoryWorkOrder != Invoice
LaboratoryWorkOrder != Payment
LaboratoryWorkOrder != WarehouseMovement
LaboratoryWorkOrder != Document
```

The MacDent-observed `paid` flag and payment amount are intentionally not modeled because their payer/payee/accounting semantics remain unverified.

## 3. Branch

`feature/lab-work-foundation-001a`

## 4. PR URL

https://github.com/NckNA/codex-test/pull/364

## 5. Baseline

- Repository: `NckNA/codex-test`.
- Base branch: `main`.
- Verified baseline after merged MacDent laboratory RECON: `a9eb5a83e79f9a046918d1eca2609858f455ee0d`.
- Work performed in clean isolated worktree `D:\hermes\lab-work-foundation-001a-work`.
- Cloud Supabase writes: `0`.
- MacDent writes: `0`.
- amoCRM writes: `0`.
- Application/UI changes: `0`.

## 6. Implementation head reviewed before final report update

- Implementation head: `8e4cdaa4142014276137f48863181e6f00cd5349`.
- Workflow: `CI`.
- Run number: `#773`.
- Run ID: `32195377057`.
- Conclusion: `success`.
- Tested commit: `8e4cdaa4142014276137f48863181e6f00cd5349`.
- Tested commit matched the implementation head exactly.
- GitHub PR #364 was mergeable after CI.

## 7. Report update commit

Report update commit: N/A because a report-only commit cannot contain its own future SHA or the CI result that tests it.

The exact final report-only commit and fresh final CI run must be recorded in the immutable finalization receipt and final task response.

## 8. Changed files

Exactly three task files:

1. `supabase/migrations/0035_create_laboratory_work_foundation.sql`;
2. `supabase/tests/0035_laboratory_work_foundation_test.sql`;
3. `_ai_work/REPORTS/LAB-WORK-FOUNDATION-001A_schema.md`.

No `src/*`, package, lockfile, seed, historical migration, finance, warehouse or amoCRM file belongs in the final diff.

## 9. Schema design

### `public.laboratories`

Tenant-scoped laboratory reference data:

- UUID identity;
- `tenant_id`;
- non-empty name;
- active flag;
- notes;
- timestamps;
- tenant-safe identity uniqueness.

### `public.laboratory_work_types`

Tenant-configurable laboratory vocabulary:

- UUID identity;
- `tenant_id`;
- non-empty name;
- optional non-empty code;
- active flag;
- sort order;
- timestamps.

MacDent work-type labels are not hard-coded as a global enum.

### `public.laboratory_work_orders`

Operational laboratory order contains:

- canonical tenant and patient;
- optional responsible canonical doctor;
- optional laboratory;
- optional order number;
- title;
- lifecycle state `in_progress | completed`;
- `sent_to_lab_at`;
- `planned_ready_at`;
- `received_from_lab_at`;
- `try_in_at`;
- `delivered_to_patient_at`;
- shade;
- anatomical scope;
- selected teeth;
- comment;
- created/updated actor and timestamps.

`selected_teeth` is constrained to the existing DentalFlow FDI permanent and primary tooth sets.

### `public.laboratory_work_order_types`

Tenant-safe many-to-many relation lets one laboratory order carry multiple configurable laboratory work types.

## 10. Tenant isolation and FK hardening

Composite foreign keys prevent cross-tenant references for:

- patient;
- responsible doctor;
- laboratory;
- work-order/work-type membership.

Implementation review found and fixed an important composite-FK edge case: optional doctor/laboratory links use column-targeted `ON DELETE SET NULL`, so deleting a doctor or laboratory clears only `responsible_doctor_id` / `laboratory_id` and never attempts to clear non-null `tenant_id`.

The SQL test explicitly proves the order keeps its tenant ownership after those reference deletions.

## 11. RLS role model

Read laboratory references/orders:

- `clinic_owner`;
- `clinic_admin`;
- `doctor`;
- `registrar`.

Maintain laboratory/work-type dictionaries:

- `clinic_owner`;
- `clinic_admin`.

Create/update laboratory orders and their work-type membership:

- `clinic_owner`;
- `clinic_admin`;
- `doctor`;
- `registrar`.

Hard-delete laboratory orders:

- `clinic_owner`;
- `clinic_admin`.

`cashier` is intentionally outside the first laboratory operational role set.

## 12. Checks

### Local Supabase reset

**PASS**

All migrations through `0035_create_laboratory_work_foundation.sql` applied successfully on the local Supabase stack.

### SQL behavior / RLS / tenant validation

**PASS**

`supabase/tests/0035_laboratory_work_foundation_test.sql` verifies:

- all four tables exist;
- RLS is enabled;
- finance/warehouse shortcut columns are absent;
- owner/admin dictionary administration boundary;
- registrar operational order create/update/type-membership behavior;
- doctor read/update/completion behavior;
- cashier exclusion;
- no-tenant isolation;
- tenant-B isolation from tenant-A data;
- cross-tenant patient FK rejection;
- cross-tenant doctor FK rejection;
- cross-tenant laboratory FK rejection;
- cross-tenant work-type relation rejection;
- invalid status rejection;
- invalid anatomical scope rejection;
- invalid FDI tooth rejection;
- non-empty title/laboratory-name constraints;
- multiple work types on one order;
- independent milestone persistence;
- admin-only hard-delete behavior;
- safe doctor/laboratory reference deletion without losing tenant ownership;
- zero invoice/payment/completed-service side effects.

### Typed schema assertions

**PASS — 81/81**

Validated:

- tables;
- required columns;
- forbidden finance/warehouse columns;
- primary/unique/check/foreign-key constraints;
- indexes;
- updated-at triggers;
- RLS enablement.

### TypeScript repository quality gate

- `npm run lint`: **PASS**;
- `npm test`: **PASS — 114 test files / 1192 tests**;
- `npm run build`: **PASS**.

### GitHub CI

Implementation head `8e4cdaa4142014276137f48863181e6f00cd5349` passed CI run `32195377057` / `#773` with:

- Merge guard: success;
- ESLint: success;
- Tests: success;
- Build: success.

## 13. Browser smoke

**NOT REQUIRED**

Reason: this is a schema-only implementation. No UI route, component, hook, repository or browser behavior changed.

## 14. Issues / Limitations

Known non-blocking baseline warnings observed during the quality gate:

- existing React test `act(...)` warnings;
- existing Vite large-chunk warning.

They are unrelated to this schema task and were not suppressed with scope-creep changes.

Explicitly deferred:

- repository/API layer;
- UI;
- patient-card laboratory UI;
- top-level laboratory operations page;
- treatment-plan/stage linkage;
- completed-service linkage;
- document/file linkage;
- laboratory cost/payable accounting;
- patient payment integration;
- warehouse/material consumption;
- remake/cancellation/archive lifecycle;
- live MacDent mutation testing.

No dependency update, cloud migration or production write was performed.

## 15. Safety result

```text
TENANT ISOLATION: VALIDATED LOCALLY
RLS: VALIDATED LOCALLY
CROSS-TENANT FK GUARDS: VALIDATED
FINANCE SIDE EFFECTS: 0
COMPLETED-SERVICE SIDE EFFECTS: 0
WAREHOUSE COUPLING: 0
CLOUD SUPABASE WRITES: 0
MACDENT WRITES: 0
AMOCRM WRITES: 0
APPLICATION/UI CHANGES: 0
```

## 16. Recommended next task

`LAB-WORK-REPOSITORY-001B` — add a typed tenant-aware repository/data-access layer for laboratories, laboratory work types and laboratory work orders against the new schema, with unit tests only.

Keep out of scope:

- UI;
- finance;
- warehouse;
- treatment/completed-service coupling;
- MacDent mutations.
