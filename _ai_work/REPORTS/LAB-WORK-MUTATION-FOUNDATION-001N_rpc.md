# LAB-WORK-MUTATION-FOUNDATION-001N — atomic laboratory mutation RPC foundation

## Summary

Final verdict: **PASS**

001N implements the schema/RPC foundation selected by `LAB-WORK-MUTATION-RECON-001M`. It does not add frontend mutation hooks or UI.

The accepted transaction boundary is now:

```text
authenticated caller
→ tenant + role validation
→ tenant-qualified reference validation
→ row lock/version validation where applicable
→ one atomic order mutation
→ one atomic desired work-type-set mutation when applicable
→ same-transaction audit event
→ committed result or complete rollback
```

Four explicit lifecycle RPCs are provided:

```text
create_laboratory_work_order_atomic
update_laboratory_work_order_atomic
complete_laboratory_work_order_atomic
reopen_laboratory_work_order_atomic
```

No hard-delete RPC is exposed.

## Branch

`feature/lab-work-mutation-foundation-001n`

## PR URL

https://github.com/NckNA/codex-test/pull/382

- Base: `main`.
- Baseline: `540065480e7461a7df06ebf0d27ec71491ed9255`.
- Implementation commit: `52b7ef0c97c2b4e2eb0d801159b0c2effb226c07`.
- Implementation CI: run `#827` / `32238823704`, **SUCCESS** on `52b7ef0c97c2b4e2eb0d801159b0c2effb226c07`.
- Final PR #382 report head: `eb3b21e913407f5ad0d1798e1178c37c21626fac`.
- Final PR #382 CI: run `#828` / `32239121251`, **SUCCESS** on `eb3b21e913407f5ad0d1798e1178c37c21626fac`.
- PR #382 merge commit: `9dafba2b5a775fbf357466216c3938300905afd1`.
- Report correction commit: N/A because this correction exists only to persist the already verified final PR #382 evidence in `main`.

## Changed files

Allowed implementation scope:

```text
supabase/migrations/0036_create_laboratory_work_mutation_rpc.sql
supabase/tests/0036_laboratory_work_mutation_foundation_test.sql
supabase/tests/0036_laboratory_work_mutation_concurrency.ps1
_ai_work/REPORTS/LAB-WORK-MUTATION-FOUNDATION-001N_rpc.md
```

No `src/*`, package, seed, browser, amoCRM, MacDent, finance, warehouse, treatment or completed-service implementation files are changed.

## Semantic contract implemented

### Roles

- create in-progress: `clinic_owner`, `clinic_admin`, `doctor`, `registrar`;
- edit in-progress: same roles;
- complete: same roles;
- reopen completed: `clinic_owner` / `clinic_admin` only;
- reopen reason: mandatory;
- hard delete: not exposed.

### Lifecycle

```text
CREATE  → in_progress
EDIT    → only while in_progress
COMPLETE: in_progress → completed
REOPEN:  completed → in_progress, owner/admin + reason
```

Completed orders cannot be silently edited through the new mutation boundary.

### Tenant/reference safety

Every SECURITY DEFINER RPC verifies `auth.uid()`, tenant membership and the permitted tenant role before touching domain state. Patient, doctor, laboratory and work-type references are tenant-qualified. Cross-tenant and unavailable references return bounded domain errors rather than becoming an RLS bypass.

New doctor/laboratory/work-type assignments must be active. Already-linked inactive historical references can remain intact during an edit, preserving historical readability established by 001H/001I.

### Atomic work-type set

Create/edit accept the complete desired work-type UUID set. Duplicate IDs are normalized. Relation replacement occurs inside the same database transaction as the order row mutation. Browser/client code therefore must never issue one request per work type.

### Create identity / retry boundary

Create accepts a caller-provided stable `order_id`. A same-tenant retry with the same canonical order payload and desired work-type set returns the canonical existing row without creating a second order or second create audit. Reusing the same ID for a different command returns `LAB_ORDER_CREATE_CONFLICT`.

## Concurrency finding and solution

001M allowed `expected_updated_at` **or an equivalent version token**. The first 001N SQL test exposed an important property of the existing project-wide `set_updated_at()` trigger: it assigns `NEW.updated_at = now()`, and PostgreSQL `now()` is transaction-time. Multiple mutations inside one transaction can therefore retain the same timestamp.

Changing the global helper would have affected unrelated domains and violated 001N scope. Instead 001N adds a laboratory-local monotonic:

```text
laboratory_work_orders.mutation_version bigint NOT NULL DEFAULT 1
```

and a BEFORE UPDATE trigger that increments it on **every** update, including legacy direct repository writes. Atomic edit/complete/reopen lock the tenant-qualified row with `FOR UPDATE` and compare `p_expected_version` to `mutation_version`.

This closes the lost-update gap without changing shared timestamp behavior elsewhere in DentalFlow.

## Audit

`audit_events.category` now explicitly accepts `laboratory`, and the existing project-wide `record_audit_event_internal` helper is extended rather than replaced with a parallel audit system.

Successful RPC actions write one audit event in the same transaction:

```text
laboratory_order.created
laboratory_order.updated
laboratory_order.completed
laboratory_order.reopened
```

Audit payloads are bounded. Free-text laboratory comments are not copied into before/after/metadata. Reopen reason is recorded explicitly. Activity-feed projection is intentionally deferred because 001M marked it optional.

## Checks

- Local Supabase reset from migration `0001` through `0036`: **PASS**.
- 0036 SQL foundation validation: **PASS**.
- Real two-session PostgreSQL concurrency validation: **PASS**.
- Local Supabase schema assertions: **22/22 PASS**.
- `npm run lint`: **PASS**.
- Full Vitest: **122 test files / 1253 tests PASS**.
- `npm run build`: **PASS**.
- `git diff --check`: **PASS**.
- Forbidden cross-domain DML scan for invoices/payments/completed-services/stock/treatment: **0 matches**.
- Global `set_updated_at` modification scan: **0 matches**.
- GitHub implementation CI #827: **SUCCESS**.

Concurrency result:

```text
edit race: exactly 1 winner + exactly 1 stale loser
mixed work-type set: 0
deadlocks: 0
complete-vs-edit race: exactly 1 winner
final mutation_version after two successful racing mutations: 3
successful update/complete audits: 2
```

The SQL validation also proves:

- admin/doctor/registrar operational role rules;
- cashier denial;
- tenant B cannot address tenant A order through SECURITY DEFINER RPC;
- stable create retry does not duplicate order/audit;
- inactive new references are denied;
- inactive historical references are preserved;
- stale edit changes neither order nor relation set;
- doctor completion succeeds;
- doctor reopen is denied;
- owner/admin reopen requires a reason;
- no invoice/payment/completed-service side effects;
- legacy direct UPDATE increments `mutation_version`.

## Browser smoke

**NOT REQUIRED / NOT PERFORMED.**

001N changes only local database schema/RPC behavior and SQL/concurrency tests. `browserLocalhost` is disabled by task policy. Real browser mutation QA belongs to the later UI task after the typed client/hook is independently frozen.

## Safety audit

- Cloud Supabase: **not touched**.
- Production writes: **none**.
- MacDent writes: **none**.
- amoCRM writes: **none**.
- Finance/warehouse/treatment/completed-service coupling: **none**.
- Hard-delete RPC: **none**.
- App/frontend code: **unchanged**.
- Existing RLS remains enabled.
- SECURITY DEFINER functions validate caller tenant and role explicitly.
- Audit does not copy unrestricted laboratory free text into broad audit payloads.

## Issues / limitations

- Existing direct table/repository write methods still exist for compatibility; they are not the approved first UI transaction boundary. 001O must call only the new atomic RPCs for production mutation behavior.
- `mutation_version` is not yet mapped into the frontend laboratory record type. That belongs to 001O, not this schema-only task.
- The activity timeline does not yet project laboratory audit events. Audit integrity is complete; activity decoration remains intentionally separate.
- The first lifecycle remains only `in_progress` / `completed`. Cancelled/voided/archived are not smuggled into this task.
- Existing unrelated React `act(...)` warnings remain.
- `npm ci` reports the pre-existing dependency audit state: 1 moderate and 6 high vulnerabilities. No dependency or lockfile change is made in 001N.

## Final verdict

```text
ATOMIC LAB ORDER CREATE: PASS
ATOMIC IN-PROGRESS EDIT + DESIRED WORK-TYPE SET: PASS
EXPLICIT COMPLETE: PASS
OWNER/ADMIN REOPEN WITH REASON: PASS
TENANT / ROLE / REFERENCE VALIDATION: PASS
MONOTONIC CONCURRENCY TOKEN: PASS
REAL TWO-SESSION CONCURRENCY: PASS
SAME-TRANSACTION LABORATORY AUDIT: PASS
HARD DELETE EXPOSED: NO
FRONTEND/UI CHANGED: NO
001N: READY FOR FREEZE AFTER FINAL REPORT CI AND PR REVIEW
```

## Recommended next task

**LAB-WORK-MUTATION-CLIENT-001O — add the smallest typed frontend mutation client/hook that consumes only the frozen 001N atomic RPCs. Map `mutation_version` into the laboratory order read model, expose create/edit/complete/reopen commands with fail-closed auth/tenant/backend selection, stable caller-generated order UUID/request identity, stale/conflict error mapping and refetch/reconciliation behavior. No UI, no new migration, no hard delete, no direct browser-managed work-type mutations, and no finance/warehouse/treatment/completed-service/MacDent/amoCRM coupling.**
