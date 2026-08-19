# LAB-WORK-PATIENT-REFERENCES-001H — Bounded Laboratory Reference Resolver

## Summary

Implemented the data-only reference resolver selected by LAB-WORK-PATIENT-REFERENCES-RECON-001G. Patient laboratory orders can now be enriched with safe display names for laboratories, laboratory work types, and tenant-scoped Supabase doctors without exposing mutation APIs or introducing per-order N+1 work-type queries.

Final verdict: **PASS**

## Branch

`feature/lab-work-patient-references-001h`

## PR URL

https://github.com/NckNA/codex-test/pull/374

- Base branch: `main`.
- Verified baseline: `704e5294cd81cea7be439319fdf3a79cb42b6d9f`.
- Implementation head: `99ac3da184b6bb7e5becdb98575870c41613da13`.
- Implementation CI: run `#799` / `32225413506`, **SUCCESS**.
- Report update commit: N/A because the report commit cannot contain its own future SHA; final report commit and CI belong in the immutable finalization receipt.

## Changed files summary

Implementation:

1. `src/data/repositories/LaboratoryWorkRepository.ts`
2. `src/data/repositories/LaboratoryWorkRepository.test.ts`
3. `src/data/hooks/usePatientLaboratoryWorkReferences.ts`
4. `src/data/hooks/usePatientLaboratoryWorkReferences.test.tsx`

Final report:

5. `_ai_work/REPORTS/LAB-WORK-PATIENT-REFERENCES-001H_references.md`

No UI, migration, seed, package, lockfile, finance, warehouse, treatment/completed-service, MacDent or amoCRM files belong in this task.

## 1. Repository batch-read contract

A new read record and batch method were added:

```text
LaboratoryWorkOrderTypeLinkRecord {
  orderId
  workTypeId
}

listOrderWorkTypeLinks(orderIds)
```

Supabase behavior:

- de-duplicates and sorts order IDs;
- empty input returns `[]` without a backend call;
- performs one read from `laboratory_work_order_types`;
- filters by the repository `tenant_id`;
- filters all requested orders through one `.in(...)` query;
- returns only `{ orderId, workTypeId }`.

Local behavior scans the tenant-qualified local relation collection once and filters it by the requested order-ID set.

The existing single-order `listOrderWorkTypeIds(orderId)` remains unchanged for future edit flows.

## 2. Resolver semantic contract

Input:

```text
LaboratoryWorkOrderRecord[]
```

Authority:

```text
useLaboratoryWorkRepository()
→ backend / tenantId / userId / ready / repository
```

Reference loading is bounded and independent of the number of patient orders:

```text
repository.listLaboratories(true)
repository.listWorkTypes(true)
repository.listOrderWorkTypeLinks(uniqueOrderIds)
doctorRepository.listDoctors() at most once, only for safe tenant-scoped Supabase selection
```

Output:

```text
referencesByOrderId[orderId] = {
  responsibleDoctorName: string | null,
  laboratoryName: string | null,
  workTypeNames: string[]
}
```

The public hook also exposes only `isLoading`, `isError`, `error`, and `refetch`.

It does not expose laboratory/doctor repositories or any create/update/add/remove functions.

## 3. Historical references

Laboratories and work types are read with `includeInactive = true` so a historical order does not lose its human-readable label merely because a laboratory or work type was later deactivated.

Missing or inaccessible IDs never become display labels. Unknown doctor/laboratory/work-type identifiers resolve to `null` or an empty name list rather than raw UUID text.

Work-type names are deterministic and de-duplicated, ordered by dictionary `sortOrder`, then name, then ID.

## 4. N+1 result

Rejected pattern:

```text
for every order:
  listOrderWorkTypeIds(order.id)
```

Implemented pattern:

```text
all visible order IDs
→ one listOrderWorkTypeLinks(orderIds) call
```

For N patient laboratory orders, the reference resolver performs a constant number of reads:

```text
laboratories: 1
work types: 1
order/type links: 1
doctors: 0 or 1
```

Combined with the existing 001D patient-order query, total laboratory/reference reads remain bounded at no more than five regardless of N.

## 5. Tenant safety refinement discovered during audit

The current legacy local `DoctorRepository` is not tenant-scoped. Using it merely because 001C selected the local backend could expose an unrelated clinic's locally stored doctor label.

Therefore 001H deliberately does **not** instantiate the local doctor repository.

Rules now are:

```text
safe Supabase + tenant selected by 001C
→ resolve doctor names from tenant-scoped Supabase DoctorRepository

local backend
→ resolve tenant-scoped laboratory/type data
→ responsibleDoctorName remains null
→ do not instantiate legacy local DoctorRepository
```

This is a safety refinement beyond the initial 001G sketch. It preserves correct data isolation instead of treating development fallback as permission to invent tenant isolation that does not exist.

The unrelated legacy doctor repository was not refactored in this task.

## 6. Stale-data protection

Resolver query identity includes:

- backend;
- tenant;
- user;
- deterministic order IDs;
- doctor/laboratory references;
- order update identity.

When patient/order-set A changes to B, 001H clears A's visible reference map before B's async reads can complete. Tests explicitly verify that stale A labels do not remain visible.

## Checks

### Targeted suite

**PASS — 35/35 tests** across:

- `LaboratoryWorkRepository.test.ts`: 11;
- `useLaboratoryWorkRepository.test.tsx`: 10;
- `usePatientLaboratoryWorkOrders.test.tsx`: 8;
- `usePatientLaboratoryWorkReferences.test.tsx`: 6.

Coverage includes batch query scope, empty input short-circuit, local tenant separation, inactive historical labels, one batch relation call, safe Supabase doctor selection, rejection of unsafe local doctor resolution, unknown-reference suppression, stale order-set reset, and public read-only surface.

### Full quality gate

- `npm run lint`: **PASS**;
- full Vitest: **PASS — 119 files / 1233 tests**;
- `npm run build`: **PASS**;
- `git diff --check`: **PASS**;
- forbidden coupling/mutation scan of the production hook: **PASS / no matches**.

### GitHub CI

Implementation SHA `99ac3da184b6bb7e5becdb98575870c41613da13` passed CI run `#799` / `32225413506` with Merge guard, ESLint, Tests and Build successful.

## Browser smoke

**NOT REQUIRED.** 001H changes only repository/data-hook behavior and introduces no visible route, page or component behavior. Browser access remained disabled by task policy.

## Scope and safety

```text
UI CHANGES: 0
MIGRATIONS: 0
CLOUD SUPABASE WRITES: 0
MACDENT WRITES: 0
AMOCRM WRITES: 0
FINANCE COUPLING: 0
WAREHOUSE COUPLING: 0
TREATMENT/COMPLETED-SERVICE COUPLING: 0
PER-ORDER WORK-TYPE N+1: 0
RAW UUID DISPLAY OUTPUT: 0
UNSCOPED LOCAL DOCTOR READ: 0
MUTATION METHODS EXPOSED BY 001H: 0
```

## Issues / limitations

- Doctor labels intentionally remain unresolved in local backend until the legacy local doctor storage has a verified tenant-scoped contract. Supabase tenant-scoped doctor resolution works normally.
- Existing unrelated React `act(...)` warnings remain baseline warnings.
- `npm ci` still reports 7 pre-existing dependency vulnerabilities (1 moderate, 6 high). No package or lockfile change is part of 001H.

## Final verdict

```text
IMPLEMENTATION: PASS
BATCH REFERENCE READ: PASS
N+1 PREVENTION: PASS
001C FAIL-CLOSED AUTHORITY: PRESERVED
SUPABASE DOCTOR TENANT SCOPE: PRESERVED
UNSCOPED LOCAL DOCTOR RESOLUTION: BLOCKED
RAW IDENTIFIER DISPLAY: BLOCKED
MUTATION SURFACE: 0
NEXT TASK: LAB-WORK-PATIENT-REFERENCE-SURFACE-001I
```

## Recommended next task

**LAB-WORK-PATIENT-REFERENCE-SURFACE-001I — update the existing read-only patient `Лаборатория` tab to display resolved `Ответственный врач`, `Лаборатория` and `Виды работ` from 001H. Keep the surface read-only, never display raw UUIDs, and perform real localhost browser QA with synthetic local Supabase data under at least Admin and Doctor roles. No migrations, finance, warehouse, treatment/completed-service, MacDent or amoCRM writes.**