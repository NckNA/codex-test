# LAB-WORK-MUTATION-RECON-001M — Laboratory mutation contract reconnaissance

## Summary

Report-only reconnaissance for the first safe laboratory work write path after the read-only laboratory queue was frozen in 001L.

Final verdict: **PASS** for the reconnaissance itself. The product write gate remains intentionally closed:

```text
DIRECT CURRENT REPOSITORY MUTATIONS IN UI: NOT READY
LABORATORY WRITE UI: NOT READY
ATOMIC SUPABASE MUTATION FOUNDATION: READY TO DESIGN/IMPLEMENT AS NEXT SMALL TASK
```

No application code, migration, schema or browser state is changed by this task.

## Branch

`recon/lab-work-mutation-001m`

## PR URL

https://github.com/NckNA/codex-test/pull/380

- Base: `main`.
- Current verified baseline: `605c2ee759d7266c8cfc4e5c7f80032beea8e7a1` (001L implementation plus final report correction merged).
- 001L implementation merge: `466d6252a686e3c4506754be7c0c954418a7fef0`.
- Initial report head: `f0b2556f939416cbd33f3fb2f9cb722f58598ce1`.
- Initial CI: run `#819` / `32230973576`, **SUCCESS** on `f0b2556f939416cbd33f3fb2f9cb722f58598ce1`.
- Current-main synchronization head before final semantic report update: `6c49f39e8e79ee99e289e90b98293ef61a373fd5`.
- Synchronization CI: run `#822` / `32231411663`, **SUCCESS** on `6c49f39e8e79ee99e289e90b98293ef61a373fd5`.
- Final PR #380 head: `4b2a858ccc3f1e7fbc4c2a23e3768255bc0e48af`.
- Final PR #380 CI: run `#823` / `32231618885`, **SUCCESS** on `4b2a858ccc3f1e7fbc4c2a23e3768255bc0e48af`.
- PR #380 merge commit: `1f851c3d653624f67108a14326d51e4b1255c6e9`.
- Report correction commit: N/A because this correction PR exists only to persist the already verified PR #380 final evidence in `main`.

## Changed files

This is a strict report-only task. The live PR may contain exactly one project file:

```text
_ai_work/REPORTS/LAB-WORK-MUTATION-RECON-001M_write_contract.md
```

No `src/*`, migration, seed, package, helper-script, environment or screenshot files are allowed in this PR.

## Sources inspected

Laboratory lineage:

- `LAB-WORK-FOUNDATION-001A_schema.md`
- `LAB-WORK-REPOSITORY-001B_repository.md`
- `LAB-WORK-DATA-WIRING-001C_wiring.md`
- `LAB-WORK-PATIENT-READ-001D_patient_read.md`
- `LAB-WORK-NEXT-RECON-001E_next_step.md`
- `LAB-WORK-PATIENT-SURFACE-001F_patient_surface.md`
- `LAB-WORK-PATIENT-REFERENCES-RECON-001G_reference_read_model.md`
- `LAB-WORK-PATIENT-REFERENCES-001H_references.md`
- `LAB-WORK-PATIENT-REFERENCE-SURFACE-001I_reference_surface.md`
- `LAB-WORK-NEXT-RECON-001J_next_step.md`
- `LAB-WORK-QUEUE-READ-001K_queue_read.md`
- `LAB-WORK-QUEUE-SURFACE-001L_ui.md`

Implementation/schema patterns:

- `src/data/repositories/LaboratoryWorkRepository.ts`
- `supabase/migrations/0035_create_laboratory_work_foundation.sql`
- `supabase/migrations/0012_create_audit_activity_log.sql`
- `supabase/migrations/0013_create_audit_activity_rpc.sql`
- `supabase/migrations/0015_create_encounter_visit_rpc.sql`
- `supabase/migrations/0017_create_finance_rpc.sql`

## HERMES SKILL FIRST semantic contract

This RECON follows the project rule derived from `hermes.skill.integrated_strategy_world_candidate`: semantic truth and causal constraints are fixed before implementation language or UI is chosen.

Primary mutation truth:

```text
LaboratoryOrderMutation
= one tenant-authorized command
→ one canonical order state
+ one complete desired work-type relation set
+ one matching audit fact
→ committed atomically or not committed at all
```

Causal invariants:

1. Tenant/role authorization precedes all domain writes.
2. Patient/doctor/laboratory/work-type references are validated against the same tenant before mutation.
3. Existing-order mutation locks the canonical order before version/transition validation.
4. Order fields and work-type membership are one transaction boundary, not a browser-managed sequence.
5. Successful domain change and audit evidence share the same commit boundary.
6. A stale command cannot silently overwrite newer operational state.
7. An uncertain create retry reuses stable command/domain identity rather than creating a second logical order.
8. Completed state is a real lifecycle constraint, not a decorative label.
9. Human-facing mutation UI remains downstream of the verified RPC/client contracts.

Forbidden implementation patterns:

```text
frontend pseudo-transaction across updateOrder + per-type add/remove calls
last-write-wins update without version check
new UUID on blind retry after uncertain create outcome
raw cross-tenant existence leakage in validation errors
normal laboratory mutations recorded as generic system audit noise
hard-delete button in the first mutation workflow
finance/warehouse/treatment/completed-service side effects hidden inside lab save
```

Verification stages remain explicit:

```text
schema/RPC atomicity
→ SQL role/tenant/rollback/concurrency tests
→ typed client contract
→ client tests
→ bounded UI
→ real local browser role/tenant/reconciliation QA
→ audit
→ FREEZE
```

The SQL/RPC language chosen in 001N is therefore an implementation artifact controlled by this contract, not the source of the architecture.

## Current mutation surface

`ILaboratoryWorkRepository` already exposes direct writes for:

```text
createLaboratory
updateLaboratory
createWorkType
updateWorkType
createOrder
updateOrder
addOrderWorkType
removeOrderWorkType
```

There is deliberately no `deleteOrder` repository method.

`createOrder` and `updateOrder` write `laboratory_work_orders` directly. Work-type membership is modified separately through independent `upsert`/`delete` requests to `laboratory_work_order_types`.

The repository correctly tenant-scopes individual Supabase queries and maps `created_by/updated_by`, but it does not provide a transaction spanning the order and its many-to-many work-type set.

## Blocking finding 1 — order + work-type writes are not atomic

A realistic UI save commonly changes both the order payload and selected work types.

Current direct sequence would be structurally equivalent to:

```text
updateOrder(orderId, fields)
→ remove old type A
→ add type B
→ add type C
```

Any network, RLS or constraint failure between these calls can leave a committed partial state.

Therefore:

```text
DO NOT wire the existing direct repository methods to a production-style mutation form.
```

The next write foundation needs one database transaction/RPC for order + relation-set mutation.

## Blocking finding 2 — audit taxonomy has no laboratory category

`audit_events.category` is constrained to a fixed list in migration 0012. The list includes domains such as patient, appointment, visit, encounter, treatment_plan, completed_service, payment, stock, dictionary and system, but **not `laboratory`**.

`record_audit_event_internal` in migration 0013 validates the same fixed category list and likewise rejects `laboratory`.

Using `system` for normal laboratory operations would technically fit the constraint but would semantically degrade the project-wide audit model and make future filtering/reporting ambiguous.

Before laboratory mutations are accepted, the audit taxonomy should explicitly support `laboratory` and the internal audit helper must accept it.

## Existing project pattern to reuse

The project already has a stronger write pattern in encounter/visit and finance RPCs:

```text
authenticated caller
→ explicit tenant-role check inside RPC
→ tenant-qualified row lookup
→ SELECT ... FOR UPDATE for mutable existing state
→ state/relationship validation
→ mutation in one PostgreSQL transaction
→ internal audit/activity write where applicable
→ return committed canonical result
```

Laboratory mutations should reuse this pattern rather than create a frontend-managed pseudo-transaction.

## Roles

Current migration 0035 RLS says:

### Laboratory / work-type dictionaries

Read:

```text
clinic_owner
clinic_admin
doctor
registrar
```

Insert/update/delete dictionary references:

```text
clinic_owner
clinic_admin
```

Recommendation: keep this rule.

### Laboratory work orders

Current SELECT/INSERT/UPDATE RLS:

```text
clinic_owner
clinic_admin
doctor
registrar
```

Current hard DELETE RLS:

```text
clinic_owner
clinic_admin
```

Current relation-row INSERT/DELETE RLS:

```text
clinic_owner
clinic_admin
doctor
registrar
```

Recommendation for the first operational mutation API:

- create in-progress order: owner/admin/doctor/registrar;
- edit in-progress order: owner/admin/doctor/registrar;
- complete order: owner/admin/doctor/registrar;
- reopen completed order: owner/admin only, explicit reason required;
- hard delete order: **do not expose in the first UI/API workflow**;
- maintain laboratory/work-type dictionaries: owner/admin only.

This preserves current RLS intent while making reversal/destructive operations more conservative.

## Status transition contract

Current schema only allows:

```text
in_progress
completed
```

A generic `updateOrder({status})` permits both directions with no transition reason.

Recommended first mutation contract:

```text
CREATE
  → status forced/defaulted to in_progress

EDIT
  → allowed while in_progress

COMPLETE
  in_progress → completed

REOPEN
  completed → in_progress
  owner/admin only
  reason required

HARD DELETE
  not exposed
```

Do not add cancelled/voided/archived statuses inside the first mutation task. That is a separate lifecycle/schema decision.

For a completed order, ordinary clinical/production fields should not silently remain editable. Corrections should either be owner/admin-only through a bounded correction/reopen path or require reopen first. This prevents `completed` from becoming a decorative badge with mutable history underneath.

## Create/update atomic API design

Recommended next foundation: one typed RPC-oriented mutation client/repository method, not a chain of existing direct methods.

Conceptual create command:

```text
create_laboratory_work_order_atomic(
  tenant_id,
  order_id,
  patient_id,
  responsible_doctor_id,
  laboratory_id,
  order_number,
  title,
  sent_to_lab_at,
  planned_ready_at,
  received_from_lab_at,
  try_in_at,
  delivered_to_patient_at,
  shade,
  anatomical_scope,
  selected_teeth,
  comment,
  work_type_ids,
  request_id
)
```

Conceptual update command:

```text
update_laboratory_work_order_atomic(
  tenant_id,
  order_id,
  expected_updated_at,
  changed_fields / canonical payload,
  work_type_ids,
  request_id,
  optional reason
)
```

Exact SQL signature should be decided in the implementation task, but the required semantics are fixed by this RECON.

## ID / idempotency strategy

For create, prefer a caller-generated UUID `order_id` (`crypto.randomUUID()` at the trusted application command boundary) passed into the atomic RPC.

Why:

- a retry after an uncertain network response can target the same logical create;
- duplicate order creation becomes preventable without relying on human-readable order numbers;
- order number is tenant/business data and is not currently unique.

`request_id` should also be passed into audit metadata for traceability, but audit `request_id` alone is not a substitute for idempotent domain identity.

The RPC must treat an existing same-tenant `order_id` carefully: either return/reconcile the canonical existing record when the command is demonstrably the same, or return an explicit conflict. It must never silently overwrite a different existing order.

## Concurrency strategy

Update/complete/reopen must lock the tenant-qualified order:

```sql
SELECT ...
FROM laboratory_work_orders
WHERE tenant_id = p_tenant_id
  AND id = p_order_id
FOR UPDATE;
```

The command should accept `expected_updated_at` (or an equivalent version token) and reject stale writes when the client edited an older snapshot.

This is preferable to last-write-wins for operational production data.

Work-type relation replacement must occur inside the same transaction after the order lock/validation.

## Work-type relation semantics

The mutation command should accept the **complete desired set** of work-type UUIDs, normalized to unique IDs.

Within one transaction:

1. validate every requested work type belongs to the same tenant;
2. for newly assigned values require `active = true`;
3. preserve an already-linked inactive historical type when the user did not explicitly change/remove it, or expose it clearly in edit state;
4. replace relation rows atomically;
5. never use one browser request per type.

A set-based delete/insert (or equivalent SQL diff) is preferred.

## Historical reference handling

001H intentionally reads inactive laboratories/work types so historical orders remain intelligible.

Mutation semantics must preserve that property:

- inactive historical laboratory/work type remains readable;
- inactive references must not appear as normal choices for a new assignment;
- editing an old order must not silently null/remove an inactive reference merely because it is absent from the active picker;
- if a user intentionally changes away from an inactive reference, they may choose only an active replacement;
- doctor assignment should follow the same conservative pattern: new assignment should use a valid tenant doctor; inactive historical doctor data should not become raw/missing by accidental normalization.

## FK / tenant validation

The database already has composite tenant FKs for patient, doctor, laboratory and relation work types. The RPC should still validate before mutation to produce deliberate domain errors and to avoid leaking cross-tenant existence details.

Required checks:

- patient exists in caller tenant;
- responsible doctor is null or exists in caller tenant;
- laboratory is null or exists in caller tenant;
- every work type exists in caller tenant;
- newly assigned laboratory/work types are active;
- selected teeth remain valid FDI values;
- title remains non-empty;
- anatomical scope/status remain schema-valid.

Cross-tenant IDs should produce a generic `not found or unavailable in this clinic` style error, not reveal another tenant’s object.

## Audit requirements

Every successful domain mutation should emit an audit event in the same transaction.

Required actions should be distinct, for example:

```text
laboratory_order.created
laboratory_order.updated
laboratory_order.completed
laboratory_order.reopened
```

Audit should record:

- tenant;
- actor user/tenant role;
- target order ID;
- patient ID where appropriate;
- before/after or bounded diff;
- reason for reopen/correction;
- request ID;
- metadata with changed work-type IDs/count where useful.

Because comments/shade/anatomical fields can contain clinically adjacent information, avoid dumping unrestricted free text into broad activity surfaces. Use the project audit redaction model intentionally; full operational payload should not automatically become a human activity-feed description.

A separate activity event is optional and should be limited to safe summary text if product UX later needs it. Audit integrity is mandatory; activity-feed decoration is not.

## Hard delete

Although schema RLS currently permits owner/admin hard delete, initial write UI should not expose it.

Reasons:

- laboratory work is operational history tied to a patient;
- the lifecycle currently has no archived/cancelled model;
- hard delete complicates audit/reconciliation;
- a mistaken delete is more damaging than leaving a completed/reopened operational record.

If hard deletion becomes a real business requirement, it should receive its own narrow task with reason, role, audit and dependent-row behavior tested explicitly.

## Safe error / reconciliation behavior

Mutation client should distinguish at minimum:

- validation failure before commit;
- role/RLS denial;
- stale-version conflict;
- tenant/FK reference unavailable;
- invalid status transition;
- committed result returned normally;
- uncertain network outcome after request submission.

For uncertain outcomes, UI must not blindly repeat a create with a new ID. It should reconcile by the stable `order_id`/request identity and refetch the canonical order before offering another action.

After a successful mutation, read models 001K/001H should be refetched; the UI should render server-returned canonical data rather than assuming the optimistic object is authoritative.

## Tests required for atomic foundation

Minimum SQL/RPC tests:

- owner/admin/doctor/registrar create allowed;
- unsupported role denied;
- cross-tenant patient/doctor/lab/type references denied without leakage;
- create + N work types commits atomically;
- invalid one-of-N work type causes entire transaction rollback;
- duplicate work-type IDs normalize safely;
- stale `expected_updated_at` update rejected;
- concurrent updates serialize/one stale command loses safely;
- in_progress → completed allowed;
- completed ordinary edit blocked;
- completed → in_progress denied for doctor/registrar;
- owner/admin reopen requires reason;
- inactive references readable but cannot be newly selected;
- audit event created atomically on success;
- failed transaction leaves no audit success event and no partial relation changes;
- retry with same create order ID does not create a second order;
- no tenant leakage in error/result.

Client/repository tests:

- correct RPC parameters and UUID normalization;
- no direct multi-request relation mutation in the UI command path;
- safe error mapping;
- canonical result mapping;
- no mutation call without ready tenant/backend.

## Browser QA plan for later mutation UI

Real localhost browser QA must be a later UI task, after the atomic foundation is independently frozen.

Required roles/scenarios:

### Admin A

- create order with patient, doctor, lab and multiple work types;
- refresh persistence;
- edit order + change work-type set in one save;
- complete;
- verify completed editing restrictions;
- reopen with reason;
- refresh persistence;
- verify audit entry through permitted admin audit surface where appropriate.

### Doctor A

- create/edit/complete allowed;
- reopen denied/absent;
- no hard delete.

### Unsupported role

- navigation/write controls absent or mutation denied as appropriate.

### Tenant boundary

- Clinic B cannot view or mutate Clinic A fixture IDs.

### Failure/reconciliation

- stale-version conflict leaves UI recoverable and refetchable;
- no partial work-type relation state after rejected command.

Every synthetic fixture must be cleaned in `finally` with zero-row verification. Console errors, failed requests and raw UUID/secret visibility must be reported.

## Recommended implementation decomposition

Do not combine schema/RPC, repository client and UI in one PR.

Recommended sequence:

```text
001N — schema/RPC atomic mutation foundation + audit category extension + SQL/concurrency tests
001O — typed frontend mutation client/hook using only the new atomic RPCs
001P — bounded create/edit/complete/reopen UI + real browser role/tenant/reconciliation QA
```

This keeps each failure domain reviewable.

## Checks

- `npm ci`: PASS; dependencies installed from the existing lockfile only.
- `npm run lint`: PASS.
- Full Vitest: **122 files / 1253 tests PASS**.
- `npm run build`: PASS.
- `git diff --check`: PASS.
- Initial GitHub CI #819: SUCCESS on `f0b2556f939416cbd33f3fb2f9cb722f58598ce1`.

## Browser smoke

**NOT REQUIRED.** 001M is a strict report-only reconnaissance task and changes no route, component, DOM, application behavior or database schema. Real browser mutation QA is explicitly deferred to the later UI task after the atomic RPC foundation and typed client are independently frozen.

## Issues / limitations

- Current direct repository writes remain individually tenant-scoped but are not an approved UI transaction boundary.
- The project audit taxonomy currently has no `laboratory` category.
- This RECON defines required mutation semantics but intentionally does not implement SQL/RPC signatures.
- Hard delete remains outside the recommended first mutation workflow.
- Existing unrelated React `act(...)` warnings and npm audit findings are outside this task.

## Final verdict

```text
CURRENT DIRECT createOrder/updateOrder: individually tenant-scoped, but insufficient for UI transaction boundary
CURRENT add/removeOrderWorkType: NOT acceptable as per-item browser transaction chain
AUDIT CATEGORY laboratory: MISSING / BLOCKER
ATOMIC ORDER + WORK-TYPE RPC: REQUIRED
CONCURRENCY LOCK/VERSION CHECK: REQUIRED
HARD DELETE UI: NOT RECOMMENDED / NOT READY
MUTATION UI: NOT READY
NEXT FOUNDATION TASK: READY
```

## Recommended next task

**LAB-WORK-MUTATION-FOUNDATION-001N — implement the smallest schema/RPC foundation for atomic laboratory order mutations. Add explicit `laboratory` audit-category support, tenant/role/FK validation, caller-provided order UUID idempotency boundary, `FOR UPDATE` + stale-version protection for existing orders, atomic desired work-type-set replacement, create/edit/complete/reopen transition rules, same-transaction audit events, and SQL/concurrency tests. Do not build frontend mutation hooks or UI, do not expose hard delete, and do not touch finance/warehouse/treatment/completed-service/MacDent/amoCRM behavior.**
