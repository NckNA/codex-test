# LAB-WORK-NEXT-RECON-001J — Next Laboratory Product Step

## Summary

Report-only HERMES STUDY/RECON against DentalFlow `origin/main` after frozen patient laboratory read/reference sequence 001D–001I.

Final verdict: **PASS**

Decision: **build the clinic-wide laboratory read foundation before any laboratory mutation/action contract.**

Recommended next implementation: `LAB-WORK-QUEUE-READ-001K`.

## Branch

`recon/lab-work-next-001j`

## PR URL

https://github.com/NckNA/codex-test/pull/376

- Base branch: `main`.
- Verified baseline: `07f22fc44270305b1a8263b9c3cde7a85a63d2e8`.
- Baseline contains the completed read-only patient laboratory surface with resolved doctor/laboratory/work-type labels.
- Initial report head: `0b24c7571396ce8f6e26c2789750dd4928aa8de7`.
- Initial CI: run `#805` / `32227328012`, **SUCCESS**.
- Report update commit: N/A because the report commit cannot contain its own future SHA; the immutable finalization receipt records the final commit and CI.

## Changed files summary

This task changes exactly one report:

`_ai_work/REPORTS/LAB-WORK-NEXT-RECON-001J_next_step.md`

Application code, migrations and browser state are not changed.

## 1. Current state

DentalFlow now has:

```text
001A schema foundation
001B tenant-aware laboratory repository
001C fail-closed auth/tenant/backend repository selection
001D patient-scoped order read
001F patient Laboratory tab
001H bounded reference resolver without work-type N+1
001I human-readable doctor/laboratory/work-type patient surface
```

The patient context can therefore answer what laboratory work exists for one known patient without exposing repository mutations or raw reference UUIDs.

What does not yet exist is the clinic-wide operational answer:

```text
Which laboratory works across this clinic are currently in progress,
for which patients,
with which doctors/laboratories,
and which are approaching their planned date?
```

MacDent RECON explicitly established that laboratory work is a clinic-wide operational queue, not only a patient-card detail.

## 2. Options compared

### Option A — laboratory create/edit mutation contract next

Technically possible because `LaboratoryWorkRepository` already contains create/update methods.

Rejected as the immediate next step.

A production write contract would need decisions and verification around:

- role authorization;
- audit/activity evidence;
- create/update error semantics;
- status/milestone transition policy;
- stale-write/concurrency behavior;
- work-type relation updates;
- reference administration boundaries;
- real browser mutation QA and cleanup.

Starting writes now would create new laboratory data before DentalFlow has the clinic-wide operational surface required to find and manage that data. That is backwards product sequencing.

### Option B — clinic-wide read-only queue surface immediately

Directionally correct but still too large for one next task.

A usable queue needs:

- tenant-wide order loading;
- patient human-readable names;
- existing 001H doctor/laboratory/work-type enrichment;
- status/doctor/laboratory filters;
- route/sidebar integration;
- loading/error/empty states;
- browser role QA.

The first two data requirements should be proven before route/UI work.

### Option C — data-only tenant-wide queue read foundation

**Recommended.**

The smallest next step is a read-only hook that loads tenant-wide laboratory orders through the accepted 001C repository and resolves patient names without using the current mutation-capable/global-fallback patient collection hook.

After that, a separate UI task can build the top-level queue using 001K + existing 001H.

## 3. Why current `usePatientsCollection()` must not be the queue authority

`usePatientsCollection()` currently chooses:

```text
supabase-active + tenant + configured
→ Supabase PatientRepository

otherwise
→ LocalStoragePatientRepository
```

It also exposes patient mutations (`createPatient`, `updatePatient`).

The local PatientRepository reads the global legacy patient storage rather than a verified tenant-qualified patient collection.

Therefore a laboratory queue must not consume `usePatientsCollection()` merely to translate `patientId → fullName`.

That would weaken the safety model already established in laboratory 001C/001H.

## 4. Recommended 001K semantic contract

Task: `LAB-WORK-QUEUE-READ-001K`.

Data flow:

```text
useLaboratoryWorkRepository()
→ accepted 001C backend / tenant / user / ready / repository
→ repository.listOrders(filters)
→ tenant-wide laboratory orders

safe Supabase tenant selected?
→ create PatientRepository with exactly that backend + tenant
→ listPatients() once
→ patientNameById

local backend?
→ do NOT instantiate legacy global LocalStoragePatientRepository
→ patientName remains null
→ never substitute raw patientId as display label
```

Recommended public result:

```text
orders
patientNamesById
isLoading
isError
error
refetch
```

No repository or mutation methods may be exposed.

## 5. Queue filters in 001K

The existing laboratory repository already supports:

```text
patientId
status
laboratoryId
responsibleDoctorId
```

001K may accept a bounded read filter object using those existing fields rather than inventing new server-side semantics.

For the first queue foundation, date-range/overdue logic should remain presentation/read-model logic unless a measured performance need justifies a new repository query contract.

Query identity must include:

- backend;
- tenant;
- user;
- normalized filter values.

Filter/context changes must clear stale previous results.

## 6. Patient-name safety

For Supabase:

- PatientRepository is constructed only after 001C has selected safe `supabase` + tenant;
- `listPatients()` is tenant-filtered by the repository;
- patient names are mapped by ID;
- unknown patient IDs resolve to `null`, not raw UUID text.

For local backend:

- do not use the legacy unscoped patient repository;
- queue orders may still load from the tenant-qualified laboratory repository;
- patient display name remains unresolved until a tenant-safe local patient contract exists.

This mirrors the doctor-name safety refinement accepted in 001H.

## 7. Query-complexity target

001K itself should perform at most:

```text
laboratory orders: 1
patients: 0 or 1
```

A later queue UI composed with 001H then remains bounded regardless of the number of orders:

```text
orders: 1
patients: 1
laboratories: 1
work types: 1
order/type links: 1
doctors: 1
```

Maximum six reads, not N+1.

If no safe patient repository is available, the patient read is zero.

## 8. Why not modify 001H to include patient names

001H is already a frozen order-reference resolver used by the patient card, where the patient identity is known from context.

Adding patient-name loading to it would make every patient-card laboratory view load the whole patient collection for information the screen already knows.

Therefore patient-name resolution belongs to the queue read context, not the generic patient-card enrichment hook.

## 9. Expected 001K file scope

Likely bounded scope:

```text
src/data/hooks/useLaboratoryWorkQueue.ts
src/data/hooks/useLaboratoryWorkQueue.test.tsx
_ai_work/REPORTS/LAB-WORK-QUEUE-READ-001K_queue_read.md
```

No repository/schema change should be needed because `listOrders(filters)` and tenant-filtered Supabase `listPatients()` already exist.

If implementation evidence proves a repository change is unavoidable, stop and re-scope rather than silently expanding 001K.

## 10. 001K test requirements

Tests must prove:

- unavailable/not-ready 001C selection performs no reads;
- tenant-wide order read uses only 001C repository;
- existing filters are forwarded exactly;
- safe Supabase patient repository uses the exact selected tenant/backend;
- patient list is loaded at most once;
- local backend does not instantiate legacy global patient repository;
- unknown patient IDs never become raw display labels;
- filter/tenant/user changes clear stale results;
- public hook exposes no patient/laboratory mutation methods or repository objects.

No browser smoke is required because 001K is data-only.

## 11. Deferred top-level UI

After 001K is frozen, the next likely task should be a separate bounded UI task for a top-level `/laboratory` operations page.

That page can compose:

```text
001K → orders + patient names
001H → doctor + laboratory + work-type names
```

and provide read-only queue/filter behavior before any write controls are introduced.

Sidebar/route changes belong to that UI task, not 001K.

## 12. Mutation sequencing after read queue

A laboratory mutation/action contract remains necessary, but should come after the read-only operational queue is established and human-tested.

The later write RECON/contract must address at least:

- who can create/update orders;
- reference dictionary administration;
- status/milestone mutation rules;
- work-type relation atomicity;
- audit/activity events;
- concurrency/stale writes;
- failure recovery;
- browser mutation QA using synthetic local data only.

No finance/payment or warehouse semantics should be smuggled into that contract.

## Checks

Baseline `07f22fc44270305b1a8263b9c3cde7a85a63d2e8`:

- `npm run lint`: **PASS**;
- full Vitest: **PASS — 119 files / 1234 tests**;
- `npm run build`: **PASS**;
- `git diff --check`: **PASS**.

## Browser smoke

**NOT REQUIRED for RECON.** Application code is unchanged and browser access is disabled by task policy.

## Issues / limitations

- Legacy local patient storage is not a verified tenant-scoped source, so 001K must suppress local patient-name resolution instead of pretending isolation exists.
- Existing legacy `usePatientsCollection()` combines reads and mutations; 001K should not refactor that unrelated hook in the same task.
- Existing baseline React `act(...)` warnings and 7 npm audit findings remain outside scope.

## Final verdict

```text
RECON: PASS
PATIENT LAB READ SURFACE: COMPLETE
CLINIC-WIDE OPERATIONAL QUEUE: NEXT PRODUCT DIRECTION
WRITE CONTRACT BEFORE QUEUE: REJECTED
DIRECT usePatientsCollection FOR QUEUE NAMES: REJECTED
TENANT-WIDE DATA FOUNDATION FIRST: REQUIRED
NEXT TASK: LAB-WORK-QUEUE-READ-001K
```

## Recommended next task

**LAB-WORK-QUEUE-READ-001K — add a data-only tenant-wide laboratory queue read hook using the accepted 001C repository selection and a safe Supabase-only tenant-scoped patient-name read. Forward only existing laboratory filters, suppress raw patient IDs, block the legacy unscoped local patient repository, expose no mutations, and require unit tests only. No UI, migrations, finance, warehouse, treatment/completed-service coupling, MacDent or amoCRM writes.**