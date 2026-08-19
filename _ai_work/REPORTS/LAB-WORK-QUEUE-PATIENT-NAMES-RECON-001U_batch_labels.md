# LAB-WORK-QUEUE-PATIENT-NAMES-RECON-001U

## Summary

Report-only reconnaissance of the remaining broad patient read in the frozen laboratory queue. The queue itself is accepted after 001T, but `useLaboratoryWorkQueue()` still derives exact patient IDs from loaded laboratory orders and then calls `PatientRepository.listPatients()`, which selects every patient row in the tenant and filters in browser memory. This is unnecessary PHI exposure and scales with total clinic population rather than with the displayed queue.

The selected next step is a data-only exact-ID patient-label batch capability in the existing PatientRepository. It must return minimal `id + fullName` data, preserve labels for archived patients referenced by historical/current laboratory orders, deduplicate IDs, short-circuit empty input, and split large ID sets into deterministic bounded chunks rather than issuing one query per patient or one unbounded `.in(...)` request.

No UI, mutation, schema, migration, patient write, laboratory lifecycle change, MacDent write or amoCRM write is part of this reconnaissance.

## Branch

`recon/lab-work-queue-patient-names-001u`

## PR URL

https://github.com/NckNA/codex-test/pull/396

- Base: `main`.
- Baseline: `ef5ad5f3afd311fe7ae64d3141a98b4a7cd16228` (001T frozen).
- Initial report head: `a422d553373edce77c857692e0b4b3c8ae84a55a`.
- Initial CI: run `#862` / `32256529006`, **SUCCESS** on `a422d553373edce77c857692e0b4b3c8ae84a55a`.
- Report update commit: N/A because a report cannot truthfully contain its own future SHA; final evidence is persisted after publication.

## Changed files

This report-only task changes exactly one repository file:

```text
_ai_work/REPORTS/LAB-WORK-QUEUE-PATIENT-NAMES-RECON-001U_batch_labels.md
```

No `src/*`, migration, seed, package, lockfile, helper script, screenshot or environment file belongs to this PR.

## Current accepted behavior

The following must remain accepted and unchanged:

- `useLaboratoryWorkQueue()` gets laboratory backend/tenant/user selection from frozen 001C wiring.
- unavailable backend fails closed;
- legacy local patient storage is not used to hydrate the tenant-wide queue;
- base laboratory orders remain visible when secondary patient-name loading fails;
- patient names reset when queue filters or tenant/user context changes;
- unknown/raw patient IDs are never substituted as visible names;
- queue write behavior frozen in 001T is out of scope.

## Finding 1: the current name hydration is materially broader than the queue need

Current flow:

```text
orders
  -> unique patientIds
  -> create Supabase PatientRepository for active tenant
  -> listPatients()
  -> SELECT * from every patients row in tenant
  -> browser filters returned rows by patientIds
  -> { patientId: fullName }
```

The requested display data is only the name for the exact patient IDs already present in the laboratory order set. `listPatients()` instead selects full patient rows, including fields unrelated to queue rendering, for every patient in the clinic.

This is a privacy/data-minimization and performance defect in the secondary read model. RLS still protects other tenants, but RLS does not make over-reading within the correct tenant desirable.

## Finding 2: 001S search is not the correct primitive for hydration

`searchPatientLookup()` from 001S is designed for an active patient picker:

- query text driven;
- excludes `status = archived`;
- returns `id/fullName/phone/status`;
- capped at 20 results.

Queue hydration is semantically different:

- exact known patient IDs driven;
- must not perform text search;
- must not drop an archived patient whose existing laboratory work is still visible;
- needs only `id + fullName`;
- may need more than 20 labels.

Therefore 001V must not misuse the search API repeatedly or call it once per patient.

## Finding 3: archived patient names must remain resolvable

Project patient archive rules state that archive may hide a patient from active lists but does not delete historical/clinical data. A laboratory order is an existing operational/history record with a tenant-safe patient FK. If that patient is later archived, the queue must still render the human name rather than regress to `Имя пациента недоступно` merely because the patient left active search results.

The exact-ID label method therefore **must not apply `status != archived`**. This intentionally differs from the active create picker introduced in 001S/001T.

## Finding 4: an exact `.in(id, ids)` batch is the right repository boundary, but input must be bounded

The existing codebase already uses tenant-scoped `.in(...)` enrichment for related IDs, including laboratory work-type links and appointment reminder enrichment. A new migration/RPC is not justified for two patient columns.

Recommended repository capability:

```ts
interface PatientLabelRecord {
  id: string;
  fullName: string;
}

interface PatientLabelRepository {
  listPatientLabelsByIds(patientIds: string[]): Promise<PatientLabelRecord[]>;
}
```

Supabase semantics:

```text
normalize -> dedupe -> sort IDs
empty IDs -> [] with no network request
split into deterministic chunks (recommended 100 IDs)
for each chunk:
  patients
    .select('id,full_name')
    .eq('tenant_id', tenantId)
    .in('id', chunk)
combine rows
stable deterministic result
```

The chunk size is an application-side safety bound, not a domain rule. A value around 100 keeps URL/query size bounded while avoiding per-patient N+1 behavior. Sequential chunk execution is preferable initially because it also bounds concurrent database load. With `K = ceil(uniquePatientIds / chunkSize)`, query count is O(K), not O(number of patients) one-request-per-row behavior.

Local implementation should filter local storage only by the provided IDs and return the same minimal shape for repository parity. The laboratory queue itself must still refuse local hydration because its accepted fail-closed backend boundary remains Supabase-only.

## Finding 5: the broad PatientRepository interface should not force unrelated mocks to change

001S already introduced a successful compatibility pattern:

- a narrow capability interface;
- optional capability on the broad legacy PatientRepository;
- real local/Supabase repositories implement it;
- the specialized consumer requires/checks the capability and fails closed if unavailable.

001V should use the same pattern for exact patient labels instead of making every manually assembled PatientRepository mock in unrelated domains implement a new method.

Recommended shape:

```ts
interface PatientLabelRepository {
  listPatientLabelsByIds(patientIds: string[]): Promise<PatientLabelRecord[]>;
}

interface PatientRepository {
  ...existing methods...
  listPatientLabelsByIds?: PatientLabelRepository['listPatientLabelsByIds'];
}
```

For the production Supabase implementation the method is always present.

## Finding 6: `useLaboratoryWorkQueue()` can replace broad hydration without changing its public API

The current public result already exposes:

```text
patientNamesById
arePatientNamesLoading
arePatientNamesError
patientNamesError
refetchPatientNames
```

No public hook shape change is required.

Implementation path:

```text
orders
  -> uniqueSorted(patientIds)
  -> create Supabase PatientRepository only under accepted backend/tenant context
  -> require listPatientLabelsByIds capability
  -> exact batch label read
  -> Object.fromEntries([id, fullName])
  -> existing patientNamesById surface
```

If capability/read fails:

- `orders` stay visible;
- `patientNamesById` becomes empty for the failed secondary read;
- `arePatientNamesError = true`;
- bounded existing error message remains;
- retry remains secondary-only.

Raw patient IDs must not become fallback names.

## Finding 7: tenant/user and query-identity semantics must be preserved

Current patient-name query key includes:

```text
backend + tenantId + userId + sorted patientIds
```

This is correct and should remain. 001V tests must continue to prove:

- tenant A names disappear immediately when context changes to tenant B/user B;
- stale tenant-A label responses cannot repopulate tenant-B state;
- changing order filters clears stale orders and labels before the next response arrives;
- empty order set causes no PatientRepository creation/network label request;
- duplicate patient IDs create one logical label lookup input.

## Finding 8: queue order pagination is a separate debt, but it affects the batch design

`SupabaseLaboratoryWorkRepository.listOrders()` currently performs tenant-scoped `select('*')` with sorting and no explicit application pagination/range. 001U does not redesign that accepted queue read contract.

This means the label method cannot assume a tiny patient-ID set. The exact label capability must therefore chunk its ID input even before future queue pagination exists.

After 001V removes the broad patient read, a separate later reconnaissance may evaluate explicit laboratory queue pagination/virtualization. That is not a blocker for fixing patient data minimization now.

## Options considered

### A. Keep `listPatients()` and browser-filter

**REJECTED.** Correct tenant isolation but unnecessary full-tenant/full-row read.

### B. Call `getPatientById()` once per order/patient

**REJECTED.** Creates N+1 network behavior and duplicate requests unless a second cache/aggregator is invented.

### C. Reuse `searchPatientLookup()` for each ID/name

**REJECTED.** Search semantics are wrong, archived patients are excluded, result cap is 20, and repeated search would be N+1-shaped.

### D. New database RPC accepting uuid[]

**REJECTED FOR NOW.** Could work, but a migration and SECURITY DEFINER surface are unnecessary for a simple tenant-scoped SELECT already protected by RLS.

### E. Exact-ID minimal repository batch with bounded chunks

**SELECTED.** Minimal fields, no migration, no N+1, archived-safe, tenant-safe, local parity, reusable without exposing mutation API.

## Recommended implementation task

**LAB-WORK-QUEUE-PATIENT-NAMES-001V** should be data-layer only.

Expected scope:

1. `src/data/repositories/PatientRepository.ts`
   - add narrow `PatientLabelRecord` / `PatientLabelRepository` capability;
   - local exact-ID implementation;
   - Supabase exact-ID minimal select with tenant filter and deterministic bounded chunks;
   - no archived exclusion.
2. `src/data/repositories/PatientRepository.test.ts`
   - empty input no query;
   - dedupe/sort;
   - minimal select;
   - tenant filter;
   - archived rows preserved if requested;
   - chunk boundary and deterministic merge;
   - backend error propagation.
3. `src/data/hooks/useLaboratoryWorkQueue.ts`
   - replace `listPatients()` with exact label capability;
   - preserve existing public API and secondary-failure behavior.
4. `src/data/hooks/useLaboratoryWorkQueue.test.tsx`
   - one batch call for normal small set;
   - duplicate IDs deduped;
   - no unrelated patients because they are never requested;
   - missing capability fails secondary read closed;
   - filter/context stale-data tests preserved;
   - unknown ID never displayed raw.
5. QA report.

No UI, browser smoke, migration, patient write, lab mutation or queue action change is required in 001V.

## Checks

This is a report-only reconnaissance. No product files were changed.

Baseline validation required before merge:

- ESLint PASS;
- full Vitest PASS;
- build PASS;
- `git diff --check` PASS;
- report validator PASS;
- changed-files allowlist = exactly this Markdown report;
- browser smoke: **NOT REQUIRED** because no runtime code changes.

## Browser smoke

**NOT REQUIRED.** Report-only reconnaissance; no application/runtime behavior changed.

## Issues / limitations

1. `listOrders()` remains unpaginated at the application contract level. 001V should chunk exact patient IDs but must not redesign queue pagination.
2. The exact recommended chunk size (100 IDs) is an implementation safety bound and can be adjusted if tests or transport constraints justify a different deterministic value. The invariant is bounded chunking, not the number 100 itself.
3. Existing broad patient reads in other domains, such as cashier search, are outside this laboratory queue task.
4. Hermes shared active task policy can be overwritten by parallel sessions; sensitive later phases must verify task policy before action.
5. Hermes report finalization helper remains known defective (`replaceReportPlaceholders is not defined`); use the established report-only correction flow if required.

## Final verdict

Final verdict: **PASS**

The queue patient-name hydration defect is understood and has a bounded implementation contract. No schema or UI redesign is required.

## Recommended next task

**LAB-WORK-QUEUE-PATIENT-NAMES-001V — implement the exact-ID minimal patient-label batch capability with bounded chunking and replace `useLaboratoryWorkQueue()` full `listPatients()` hydration while preserving archived labels, fail-closed tenant semantics, secondary error behavior and the hook’s existing public API. Data-layer only; no UI or migration.**
