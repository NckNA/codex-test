# LAB-WORK-PATIENT-LOOKUP-FOUNDATION-001S

## Summary

A bounded tenant-scoped patient lookup foundation is implemented for the future top-level laboratory create picker selected by 001R.

The new path does **not** call `listPatients()` and does not expose patient create/update. Supabase lookup selects only `id, full_name, phone, status`, applies tenant scope, excludes archived patients from active picker results, performs server-side name or normalized-phone `ILIKE`, escapes LIKE wildcard characters, and clamps the result count to 20.

A laboratory-specific hook uses the already accepted laboratory backend/tenant/user readiness boundary and drops slow results from a prior tenant context.

No UI, migration, schema change, laboratory mutation or patient write is included.

## Task

Data-only prerequisite for the future `LAB-WORK-QUEUE-MUTATION-SURFACE-001T`.

## Branch

`feature/lab-work-patient-lookup-001s`

## PR URL

https://github.com/NckNA/codex-test/pull/392

- Base: `main`.
- Baseline: `14776d86c3d1e129818456cde3a8c7c7a540a2af`.
- Implementation commit: `33c035819bfbfffd04f1242e8e6ae3fd424fb794`.
- Implementation CI: run `#852` / `32250221025`, **SUCCESS** on `33c035819bfbfffd04f1242e8e6ae3fd424fb794`.
- Final report update commit: N/A because the report cannot contain its own future SHA; final evidence is persisted after publication.

## Changed files summary

Implementation:

```text
src/data/repositories/PatientRepository.ts
src/data/repositories/PatientRepository.test.ts
src/data/hooks/useLaboratoryPatientLookup.ts
src/data/hooks/useLaboratoryPatientLookup.test.tsx
```

Report:

```text
_ai_work/REPORTS/LAB-WORK-PATIENT-LOOKUP-FOUNDATION-001S_patient_lookup.md
```

No UI, migration, seed, package, lockfile, screenshot or environment file is part of the PR.

## Repository contract

`PatientRepository` now has a backward-compatible optional lookup capability and both real repository implementations provide it.

Lookup-only types:

```text
PatientLookupRecord
  id
  fullName
  phone
  status

SearchPatientLookupInput
  query
  optional limit
```

The broad interface keeps the method optional only to avoid forcing unrelated manually-built historical test mocks to change inside this task. The laboratory hook explicitly checks the capability and fails closed if it is absent.

This compatibility choice does not introduce a local production fallback.

## Supabase lookup behavior

`SupabasePatientRepository.searchPatientLookup`:

1. trims the query;
2. performs no database request below two characters;
3. clamps result limit to `1..20`, default 20;
4. classifies phone-like input by a strict character pattern and at least two digits;
5. strips phone formatting for phone lookup;
6. otherwise treats the query as a name lookup;
7. escapes `\\`, `%` and `_` before building the `ILIKE` pattern;
8. selects only `id,full_name,phone,status`;
9. filters `tenant_id` on every lookup;
10. excludes `status = archived` server-side;
11. uses `.ilike(field, pattern)` rather than raw user interpolation into `.or(...)`;
12. orders by full name;
13. applies the hard limit;
14. propagates Supabase errors.

## Local repository parity

The local prototype repository implements the same lookup shape for parity/dev use:

- minimum query;
- name/normalized-phone matching;
- archived exclusion;
- deterministic name/id ordering;
- hard limit;
- minimal lookup result shape.

The laboratory hook itself remains fail-closed to Supabase context, so local parity does not become a production mutation/search fallback.

## Laboratory lookup hook

`useLaboratoryPatientLookup` derives readiness from `useLaboratoryWorkRepository`:

```text
backend = supabase
+ repository selection ready
+ tenantId
+ userId
=> lookup ready
```

It exposes only:

```text
ready
query
results
loading
error
search(query)
clear()
```

It does not expose:

- `createPatient`;
- `updatePatient`;
- `listPatients`;
- direct database client;
- laboratory mutation client.

The hook tracks a context key containing backend/tenant/user. A slow response captured under tenant A is ignored after the active context moves to tenant B.

`clear()` also invalidates the in-flight generation so a late request cannot repopulate cleared search state.

## Archived patient semantics

Archived patients are excluded from this **active create-picker lookup**, matching existing active-list behavior.

This is not represented as a new backend invariant.

The frozen laboratory create RPC still validates patient tenant existence and does not itself reject an archived status. 001S intentionally does not change that RPC or schema. A stronger “no new laboratory order for archived patient under any path” rule would require a separate explicit domain/backend decision.

Historical laboratory orders remain readable regardless of whether the patient later becomes archived.

## Checks

### Targeted

**PASS: 2 test files / 19 tests.**

Coverage includes:

- existing PatientRepository factory/read/write regression;
- minimal lookup select columns;
- tenant filter;
- archived exclusion;
- result limit clamp;
- full-name lookup;
- normalized phone lookup;
- literal `%/_` escape behavior;
- short-query no-request behavior;
- Supabase error propagation;
- hook fail-closed behavior;
- hook minimum-query behavior;
- bounded safe error mapping;
- no patient write surface from hook;
- prior-tenant slow-response suppression;
- `clear()` in-flight invalidation.

### Full suite

**PASS: 129 test files / 1307 tests.**

### Static/build

- ESLint: **PASS**.
- TypeScript/Vite build: **PASS**.
- `git diff --check`: **PASS**.
- Existing Vite large-chunk warning remains outside scope.
- Existing npm audit findings remain outside scope; dependency files are unchanged.

### Local schema

`patients` assertions: **7/7 PASS**.

Verified:

- table exists;
- `id`;
- `tenant_id`;
- `full_name`;
- `phone`;
- `status`;
- RLS enabled.

Fresh local Supabase reset and guarded QA-user seed: **PASS**.

## Browser smoke

**NOT REQUIRED / NOT PERFORMED.**

001S has no UI. A real local Supabase data-layer smoke was performed instead.

## Real local Supabase smoke

Synthetic local fixtures:

- active patient A in Demo Clinic A;
- archived patient A in Demo Clinic A;
- active patient B in Demo Clinic B.

The actual `SupabasePatientRepository` was used with authenticated local QA Admin A/Admin B clients.

Verified:

1. literal name query containing `%_` returned the literal matching active patient, proving escape behavior against real PostgREST/Postgres;
2. formatted phone query `+7 (700) ...` normalized and found the correct patient;
3. archived patient did not appear;
4. Admin B searching for Clinic A patient returned no Clinic A row;
5. Admin A constructing a repository scoped to tenant B still returned no Clinic B row because RLS denied cross-tenant visibility;
6. Admin B found its own Clinic B row;
7. returned object keys were exactly `id`, `fullName`, `phone`, `status`.

Live smoke: **PASS**.

Cleanup removed all three synthetic patients and post-cleanup verification returned **0**.

## Scope / safety audit

**PASS.**

Changed implementation files are exactly four declared files.

The new laboratory lookup hook contains no:

- `listPatients()`;
- `createPatient()`;
- `updatePatient()`;
- direct `.from(...)` database access;
- localStorage access.

The new Supabase lookup contract explicitly contains:

- minimal select fields;
- tenant filter;
- archived filter;
- server-side `ilike`;
- hard limit.

No changes were made to:

- `LaboratoryPage`;
- patient UI;
- laboratory mutation RPC/client;
- migrations;
- seed;
- finance/warehouse/treatment/medical modules;
- amoCRM/MacDent.

## Issues / limitations

1. Existing `useCashierPatientSearch` still calls `listPatients()` and filters client-side; it is intentionally not refactored here.
2. Existing `useLaboratoryWorkQueue` patient-name hydration also calls `listPatients()` and filters to order IDs client-side; this existing broad read remains a separate optimization task.
3. Search deliberately supports simple name-or-phone substring lookup, not fuzzy ranking/transliteration/multi-field query syntax.
4. Broad `PatientRepository` type keeps lookup optional for backward compatibility with old manual test mocks; the actual LocalStorage/Supabase implementations implement the capability and the laboratory hook verifies it.
5. Archived exclusion is a picker UX rule, not a new create-RPC invariant.
6. Hermes shared active task policy can still be replaced by parallel sessions; sensitive future actions must verify the task policy before execution.

## Final verdict

Final verdict: **PASS**

The bounded patient lookup prerequisite selected by 001R is implemented and verified.

The top-level laboratory queue is now **READY for LAB-WORK-QUEUE-MUTATION-SURFACE-001T**, provided it reuses the frozen 001Q dialogs/lifecycle/roles and 001O mutation hook instead of creating a parallel mutation stack.

## Recommended next task

**LAB-WORK-QUEUE-MUTATION-SURFACE-001T — add the first top-level `/laboratory` create/edit/complete/reopen UI using the frozen 001Q components and 001S patient lookup. Add an explicit bounded patient-selection step for create only; reuse fixed patientId for the order form; role-gate actions; keep mutationVersion/stale/uncertain semantics; do not add delete/new statuses/new backend. Perform real browser QA for Admin/Doctor/Registrar/Cashier, patient search by name/phone, tenant isolation, reload persistence, and a two-session stale race.**
