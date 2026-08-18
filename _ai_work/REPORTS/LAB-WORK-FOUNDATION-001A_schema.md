# LAB-WORK-FOUNDATION-001A — Laboratory Work Schema Foundation

Date: 2026-08-19
Mode: HERMES SKILL FIRST / BOUNDED SCHEMA IMPLEMENTATION
Repository: `NckNA/codex-test`
Branch: `feature/lab-work-foundation-001a`
Base: current `origin/main` after merged `MACDENT-LAB-WORKFLOW-RECON-001`
Cloud Supabase changes: `0`
MacDent writes: `0`
amoCRM writes: `0`
Application/UI changes: `0`

## Verdict

**PASS — bounded tenant-scoped laboratory-work schema foundation implemented and validated locally.**

This task implements only the database foundation accepted by `MACDENT-LAB-WORKFLOW-RECON-001`. It does not implement repository/API/UI behavior and does not connect laboratory operations to patient finance, warehouse, treatment-plan truth or completed-service truth.

## Scope

Changed files are intentionally limited to:

1. `supabase/migrations/0035_create_laboratory_work_foundation.sql`
2. `supabase/tests/0035_laboratory_work_foundation_test.sql`
3. `_ai_work/REPORTS/LAB-WORK-FOUNDATION-001A_schema.md`

No `src/*`, package, seed, existing migration, finance, warehouse or amoCRM files were changed.

## Domain boundary preserved

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

The MacDent-observed `paid` flag and payment amount were intentionally NOT copied because their payer/payee/accounting semantics remain unverified.

## Tables added

### `public.laboratories`

Tenant-scoped laboratory reference data:

- UUID identity;
- `tenant_id`;
- name;
- active flag;
- notes;
- timestamps.

### `public.laboratory_work_types`

Tenant-configurable laboratory vocabulary:

- UUID identity;
- `tenant_id`;
- name/code;
- active flag;
- sort order;
- timestamps.

MacDent work-type labels are not hard-coded as a global enum.

### `public.laboratory_work_orders`

Operational laboratory order:

- canonical tenant and patient;
- optional responsible canonical doctor;
- optional laboratory;
- order number/title;
- small lifecycle: `in_progress | completed`;
- independent operational milestones:
  - sent to laboratory;
  - planned ready;
  - received from laboratory;
  - try-in;
  - final delivery to patient;
- shade;
- anatomical scope;
- selected teeth;
- comment;
- created/updated actor and timestamps.

`selected_teeth` is constrained to the existing DentalFlow FDI permanent and primary tooth sets.

### `public.laboratory_work_order_types`

Tenant-safe many-to-many relation allowing one laboratory order to use multiple configurable laboratory work types.

## Tenant isolation / FK design

Composite foreign keys prevent cross-tenant references for:

- patient;
- responsible doctor;
- laboratory;
- work-order/work-type relation.

Important hardening found during implementation review:

Composite optional references use column-targeted `ON DELETE SET NULL` so deleting a doctor or laboratory clears only `responsible_doctor_id` / `laboratory_id` and never attempts to clear the non-null `tenant_id`.

The SQL test explicitly verifies that the laboratory order retains its tenant ownership after those reference deletions.

## RLS role model

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

`cashier` is intentionally outside the first laboratory operational role set. This can be revisited only with a concrete workflow requirement.

## Validation performed

### Local Supabase reset

**PASS**

All migrations through `0035_create_laboratory_work_foundation.sql` applied successfully on the local Supabase stack.

### SQL behavior / RLS / tenant tests

**PASS**

`supabase/tests/0035_laboratory_work_foundation_test.sql` verifies:

- all four tables and RLS exist;
- finance/warehouse shortcut columns are absent;
- owner/admin dictionary administration boundary;
- registrar operational order creation/update and work-type membership;
- doctor read/update/completion behavior;
- cashier exclusion;
- no-tenant isolation;
- cross-tenant read isolation;
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

Validated locally:

- tables;
- required columns;
- forbidden finance/warehouse columns;
- primary/unique/check/foreign-key constraints;
- indexes;
- updated-at triggers;
- RLS enablement.

### Repository quality checks

- `npm run lint`: **PASS**
- `npm test`: **PASS — 114 test files / 1192 tests**
- `npm run build`: **PASS**

Existing non-blocking test-console `act(...)` warnings and the existing Vite large-chunk warning remain outside this task. No dependency or application change was made to suppress unrelated warnings.

### Browser smoke

**NOT REQUIRED**

Reason: schema-only implementation; no UI or application behavior changed.

## Explicitly deferred

Not implemented in this task:

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

## Safety result

```text
TENANT ISOLATION: VALIDATED LOCALLY
RLS: VALIDATED LOCALLY
CROSS-TENANT FK GUARDS: VALIDATED
FINANCE SIDE EFFECTS: 0
COMPLETED-SERVICE SIDE EFFECTS: 0
WAREHOUSE COUPLING: 0
CLOUD SUPABASE WRITES: 0
MACDENT WRITES: 0
APPLICATION/UI CHANGES: 0
```

## Recommended next task

`LAB-WORK-REPOSITORY-001B` — add a typed tenant-aware repository/data-access layer for laboratories, laboratory work types and laboratory work orders against the new schema, with unit tests only. No UI, no finance, no warehouse and no treatment/completed-service coupling.
