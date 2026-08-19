# LAB-WORK-PATIENT-REFERENCES-RECON-001G — Laboratory Patient Reference Read Model

## Summary

Report-only HERMES STUDY/RECON against current DentalFlow `origin/main` after merged PR #372 / `LAB-WORK-PATIENT-SURFACE-001F`.

Final verdict: **PASS**

Implementation readiness decision: **READY** for `LAB-WORK-PATIENT-REFERENCES-001H`.

The next safe step is a data-only bounded reference resolver for laboratory orders. It must resolve responsible doctor names, laboratory names and laboratory work-type names without UI access to mutation APIs, without raw UUID labels, without N+1 work-type queries, and without weakening the fail-closed repository selection established by 001C.

## Branch

`recon/lab-work-patient-references-001g`

## PR URL

Pending until report publication.

- Base: `main`.
- Verified baseline: `a74d9eb960dd74e5f3eaeb07e86154e85101e365`.
- Baseline contains merged PR #372 / read-only patient Laboratory tab.
- Report update commit: N/A because a report commit cannot truthfully contain its own future SHA; the immutable finalization receipt records the final commit and CI.

## Changed files summary

This RECON task changes exactly one repository file:

`_ai_work/REPORTS/LAB-WORK-PATIENT-REFERENCES-RECON-001G_reference_read_model.md`

No application code, migration, package, lockfile, environment file or browser artifact belongs in this PR.

## 1. Current accepted flow

The patient surface currently follows:

```text
PatientCardPage
→ PatientLaboratoryWorkTab(patientId)
→ usePatientLaboratoryWorkOrders(patientId)
→ useLaboratoryWorkRepository()
→ repository.listOrders({ patientId })
→ read-only operational order facts
```

001F intentionally omits unresolved `responsibleDoctorId`, `laboratoryId` and work-type membership rather than rendering UUIDs.

## 2. Reference sources already available

### Laboratories

`ILaboratoryWorkRepository.listLaboratories(includeInactive?)` already returns tenant-scoped laboratory records with human-readable `name`.

For historical order resolution, the resolver should use `includeInactive = true`. An old order must not lose its laboratory label merely because that laboratory was later deactivated.

### Laboratory work types

`ILaboratoryWorkRepository.listWorkTypes(includeInactive?)` already returns tenant-configurable work-type records with human-readable `name`.

Again, historical display requires `includeInactive = true`.

### Responsible doctors

`DoctorRepository.listDoctors()` provides doctor `id → fullName` for one tenant.

However, the current `useClinicDoctors()` hook is **not suitable as the direct dependency for this laboratory resolver** because its backend-selection rule is weaker than 001C:

```text
supabase-active + missing tenant/config
→ current useClinicDoctors may construct local backend
```

The laboratory domain already has a stronger accepted rule:

```text
supabase-active + incomplete auth/tenant/config
→ backend unavailable
→ ready false
→ no local fallback
```

The laboratory reference resolver must preserve the second rule.

## 3. Confirmed N+1 risk

The current repository exposes only:

```text
listOrderWorkTypeIds(orderId)
```

Using that method once for every visible patient order would produce:

```text
1 patient order query
+ N order/type relation queries
```

That is explicitly rejected for the reference-enrichment path.

The repository needs one bounded batch read primitive:

```text
listOrderWorkTypeLinks(orderIds: string[])
→ Array<{ orderId: string; workTypeId: string }>
```

Supabase implementation must filter both by repository tenant and by the unique order ID set. Local implementation must scan the tenant-local relation collection once and filter by a `Set(orderIds)`. Empty order IDs must return `[]` without a backend request.

## 4. Options considered

### Option A — call `listOrderWorkTypeIds` per order

Rejected. Query growth would be proportional to the number of patient laboratory orders.

### Option B — enrich `LaboratoryWorkOrderRecord` directly with joined doctor/lab/type names

Rejected for the next task because it mixes canonical stored order facts with display projection, changes the frozen 001D order contract, couples base laboratory mapping to doctor display data, and makes local/Supabase parity more invasive than necessary.

### Option C — use `useClinicDoctors()` plus laboratory reads in the UI

Rejected because UI would orchestrate repositories itself, current doctor-hook selection can local-fallback under incomplete Supabase context, and relation membership would still need an N+1 workaround.

### Option D — add one data-only reference resolver using the accepted 001C selection

**Recommended.**

The resolver should use `useLaboratoryWorkRepository()` as the single backend/tenant readiness authority. When ready, it uses that laboratory repository for laboratories, work types and batched relation links, and creates the read-only `DoctorRepository` using exactly the same selected `backend` and `tenantId`. It must never instantiate the doctor repository when the 001C selection is unavailable.

## 5. Recommended 001H semantic contract

Task: `LAB-WORK-PATIENT-REFERENCES-001H`.

Input:

```text
LaboratoryWorkOrderRecord[]
```

Selection:

```text
useLaboratoryWorkRepository()
→ backend / tenantId / userId / ready / repository
```

Enabled condition:

```text
ready AND repository exists AND orders.length > 0
```

Reference loading:

```text
unique order IDs
unique responsible doctor IDs

Promise.all([
  repository.listLaboratories(true),
  repository.listWorkTypes(true),
  repository.listOrderWorkTypeLinks(orderIds),
  doctorIds.length > 0
    ? doctorRepository.listDoctors()
    : Promise.resolve([])
])
```

The doctor repository must be created only from the accepted 001C selection. No independent auth/backend decision is allowed inside 001H.

## 6. Output contract

Recommended public result:

```text
referencesByOrderId: Record<string, {
  responsibleDoctorName: string | null,
  laboratoryName: string | null,
  workTypeNames: string[]
}>
isLoading
isError
error
refetch
```

The public hook must not expose repository objects or any create/update/add/remove methods.

## 7. Missing-reference behavior

A persisted ID can outlive an active reference row or become inaccessible after data repair/history.

Rules:

- `null` doctor/laboratory ID → resolved display field stays `null`;
- non-null unresolved ID → never expose the UUID as display text;
- missing work-type ID → never emit the UUID as a label;
- duplicate work-type links → output unique names;
- work-type names should use deterministic dictionary ordering, preferably `sortOrder` then `name`.

UI wording for unresolved references belongs to the later UI task, not 001H.

## 8. Query-complexity invariant

For N laboratory orders:

```text
existing 001D order query: 1
reference resolver:
  laboratories: 1
  work types: 1
  order/type links: 1
  doctors: at most 1
```

Total is `<= 5` reads regardless of N. If there are no orders, 001H performs no reference reads.

## 9. Tenant and patient isolation

001H must inherit backend/tenant readiness from 001C.

Required invariants:

1. Supabase-active incomplete context → disabled/fail-closed.
2. No local fallback in that state.
3. Laboratory/type/link reads use the tenant-bound laboratory repository.
4. Doctor read uses a doctor repository created with the exact same selected backend and tenant.
5. The resolver only enriches orders already obtained by patient-scoped 001D; it does not broaden the patient order query.
6. Query identity includes backend, tenant, user and a deterministic order-ID set so stale patient A references cannot survive an A→B switch.

## 10. Repository change required

Smallest repository extension:

```text
export interface LaboratoryWorkOrderTypeLinkRecord {
  orderId: string;
  workTypeId: string;
}

listOrderWorkTypeLinks(orderIds: string[]): Promise<LaboratoryWorkOrderTypeLinkRecord[]>
```

Keep existing `listOrderWorkTypeIds(orderId)` for future single-order edit flows. No schema migration is required.

## 11. Why not a nested Supabase projection now

A one-query cross-table projection is possible in principle, but it is not the safest next increment. It would introduce a separate cross-domain projection contract, increase coupling to doctor/reference tables, require equivalent local projection logic, and bypass the already validated incremental 001B/001C/001D path.

The bounded constant-query read set is easier to verify. If a future top-level laboratory queue proves that five reads are too expensive at scale, a dedicated server-side read projection/RPC can be designed from measured evidence instead of guesswork.

## 12. Test requirements for 001H

Repository tests must prove:

- batch links query is tenant-scoped;
- multiple order IDs are read in one repository call;
- empty ID set performs no Supabase request;
- local backend filters the tenant-local relation collection correctly;
- output mapping is `{ orderId, workTypeId }` only.

Hook tests must prove:

- unavailable/not-ready 001C selection triggers no reference reads;
- empty orders trigger no reference reads;
- labs and work types include inactive records for historical labels;
- doctor repository is created from the exact 001C backend/tenant selection;
- multiple orders use one batch relation call, never one call per order;
- doctor/laboratory/work-type names resolve correctly;
- missing IDs never surface as raw UUID labels in resolver output;
- order-set switch resets stale references;
- public hook exposes no mutation/repository surface.

No browser smoke is required for 001H because it is data-only.

## 13. Deferred UI task

After 001H is frozen, use a separate UI task: `LAB-WORK-PATIENT-REFERENCE-SURFACE-001I`.

That task may display `Ответственный врач`, `Лаборатория` and `Виды работ` in `PatientLaboratoryWorkTab`. It must consume only read hooks and undergo real localhost browser QA under at least Admin and Doctor roles.

## 14. Explicit non-goals

001H must not add UI changes, create/edit/delete controls, status mutations, migrations, finance/payment fields, warehouse/material fields, treatment/completed-service coupling, MacDent/amoCRM calls or writes, raw UUID display, or a generic refactor of unrelated repositories.

## Checks

Baseline verification on `a74d9eb960dd74e5f3eaeb07e86154e85101e365`:

- `npm run lint`: **PASS**;
- full Vitest: **PASS — 118 files / 1226 tests**;
- `npm run build`: **PASS**;
- `git diff --check`: **PASS**.

Existing unrelated React `act(...)` warnings remain baseline warnings.

## Browser smoke

**NOT REQUIRED for RECON.** No application code is changed.

## Issues / limitations

- Current `useClinicDoctors()` has a weaker fallback rule than laboratory 001C; this RECON avoids using it as the laboratory enrichment authority rather than silently refactoring that unrelated hook.
- The proposed 001H model intentionally favors clear isolation and constant query count over a premature one-query cross-domain projection.
- `npm ci` reports the same 7 pre-existing dependency vulnerabilities (1 moderate, 6 high); remediation is outside this task.

## Final verdict

```text
RECON: PASS
RAW UUID DISPLAY: FORBIDDEN
PER-ORDER WORK-TYPE QUERY: REJECTED
DIRECT useClinicDoctors DEPENDENCY: REJECTED FOR LAB REFERENCE AUTHORITY
BATCH ORDER/TYPE READ: REQUIRED
001C FAIL-CLOSED SELECTION: AUTHORITATIVE
REFERENCE RESOLVER: READY
UI ENRICHMENT: DEFER TO 001I
NEXT TASK: LAB-WORK-PATIENT-REFERENCES-001H
```

## Recommended next task

**LAB-WORK-PATIENT-REFERENCES-001H — add a data-only bounded laboratory reference resolver: one batch order/work-type link read plus tenant-consistent doctor/laboratory/work-type resolution using the accepted 001C backend selection. Unit tests only; no UI, no migrations, no mutations, no raw UUID labels, no finance/warehouse/treatment/completed-service coupling, no MacDent or amoCRM writes.**