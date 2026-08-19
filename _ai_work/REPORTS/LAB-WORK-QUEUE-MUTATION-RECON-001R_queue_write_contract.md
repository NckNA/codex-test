# LAB-WORK-QUEUE-MUTATION-RECON-001R

## Summary

The frozen 001Q patient-card mutation surface is reusable for the top-level `/laboratory` queue, but the queue is **not ready for direct write-UI implementation yet** because there is no bounded server-side patient lookup suitable for a create-order picker.

Current patient search candidates load the full tenant patient collection and filter in the browser. That is avoidable PHI exposure and a scaling boundary that should not be copied into a new write flow.

Recommended sequence:

```text
001R RECON
  -> 001S bounded Patient Lookup Foundation (data-only)
  -> 001T top-level Laboratory Queue Mutation Surface (UI + real browser QA)
```

The existing atomic laboratory RPCs, typed mutation client/hook, role matrix, mutationVersion concurrency and 001Q dialogs remain authoritative and should be reused rather than reimplemented.

## Task

Report-only reconnaissance for extending laboratory create/edit/complete/reopen actions from the patient Laboratory tab to the top-level operational `/laboratory` queue.

No runtime code, migrations, schema, browser mutation or database write belongs to this task.

## Branch

`recon/lab-work-queue-mutation-001r`

## PR URL

https://github.com/NckNA/codex-test/pull/390

- Base: `main`.
- Baseline: `bef74bafa30c578061495f01d704721fc8e53fd4` (001Q frozen).
- Initial report head: `de3ce5ea39a7f5c81d110c8f8c6ef246055d0841`.
- Initial CI: run `#847` / `32248334608`, **SUCCESS** on `de3ce5ea39a7f5c81d110c8f8c6ef246055d0841`.
- Final PR #390 report head: `9f5466fcf5c7cb3cd0d614aa5838df17f66b8c0c`.
- Final PR #390 CI: run `#848` / `32248584764`, **SUCCESS** on `9f5466fcf5c7cb3cd0d614aa5838df17f66b8c0c`.
- PR #390 merge commit: `e27531bb6367e5eb069565e6fcf431ca8dc9fde4`.
- Report correction commit: N/A because this correction only persists already verified final PR #390 evidence in `main`.

## Changed files

This report-only task changes exactly one repository file:

```text
_ai_work/REPORTS/LAB-WORK-QUEUE-MUTATION-RECON-001R_queue_write_contract.md
```

No `src/*`, migration, seed, package, lockfile, helper script, screenshot or environment file belongs to this PR.

## Current accepted foundation

The following is already frozen in `main` and must not be redesigned inside the queue task:

### 001N database mutation contract

- atomic create;
- atomic edit of order + complete desired work-type set;
- explicit complete;
- explicit reopen with reason;
- tenant and role enforcement;
- audit inside the same transaction;
- monotonic `mutation_version` optimistic concurrency;
- no hard delete;
- no finance/warehouse/treatment/completed-service side effects.

### 001O client/hook contract

- Supabase-only production mutation client;
- no direct table mutation in the UI path;
- create identity/idempotent retry behavior;
- `expectedVersion` for edit/complete/reopen;
- bounded error categories;
- canonical refresh after deterministic conflict;
- exact retry only for operation-uncertain state;
- tenant/user context isolation.

### 001Q patient-card surface

Reusable components/data logic now exist:

- `LaboratoryWorkOrderDialog`;
- `LaboratoryWorkCompleteDialog`;
- `LaboratoryWorkReopenDialog`;
- `getLaboratoryWorkRoleCapabilities`;
- `useLaboratoryMutationOptions`;
- `useLaboratoryWorkMutations`.

The queue should consume these rather than fork a second laboratory form or lifecycle implementation.

## Current top-level queue shape

`src/pages/LaboratoryPage.tsx` currently:

- reads all laboratory orders through `useLaboratoryWorkQueue`;
- hydrates doctor/laboratory/work-type labels through `usePatientLaboratoryWorkReferences`;
- hydrates patient names through `useLaboratoryWorkQueue`;
- provides status/doctor/laboratory/due/search filters;
- sorts overdue/today/upcoming/unscheduled/completed work;
- already has `activeTenant` and tenant timezone;
- has a shared `refreshAll()` path;
- renders each order as an operational queue card;
- explicitly says the page is read-only;
- currently has no mutation hook or action controls.

This shape is suitable for adding queue actions after the patient lookup prerequisite is solved.

## Role contract for the queue

Reuse the frozen 001Q capability matrix exactly:

| Role | Create | Edit in progress | Complete | Reopen completed |
|---|---:|---:|---:|---:|
| clinic_owner | yes | yes | yes | yes |
| clinic_admin | yes | yes | yes | yes |
| doctor | yes | yes | yes | no |
| registrar | yes | yes | yes | no |
| cashier / unsupported | no | no | no | no |

The existing Sidebar hides `/laboratory` for unsupported roles, but direct-route access must not become authorization. Queue mutation controls must still be capability-gated, while RPC/database authorization remains authoritative.

## Reuse analysis

### Create/edit form

`LaboratoryWorkOrderDialog` can be reused after one small presentation extension.

Its actual mutation contract is already context-neutral:

- receives a fixed `patientId`;
- optionally receives an existing order;
- emits create or edit desired state;
- owns doctor/laboratory/work-type options;
- owns timezone conversion and FDI validation;
- owns mutationVersion edit guard.

The only patient-card-specific text is currently:

```text
Пациент: текущая карточка. Изменить пациента здесь нельзя.
```

For queue reuse, do not fork the dialog. Add an optional human patient label/context prop so the queue can show the selected patient name/phone while keeping patientId immutable for that form instance.

### Complete/reopen dialogs

These are already queue-neutral and can be reused without semantic changes.

### Mutation hook

The queue can instantiate:

```text
useLaboratoryWorkMutations({ refresh: refreshAll })
```

`refreshAll` should be stable (`useCallback`) when wired into mutation callbacks.

After a successful mutation, refresh:

- orders;
- patient display names;
- doctor/laboratory/work-type labels.

### Error/reconciliation banners

Reuse the 001Q UX:

- bounded mutation error;
- refresh warning;
- high-visibility operation-uncertain warning;
- exact `retryPendingMutation()` only;
- no reconstructed retry command;
- no hidden auto-retry.

## Patient selection is the blocker

### PatientRepository today

`PatientRepository` currently exposes:

```text
getPatientById
listPatients
createPatient
updatePatient
```

There is no bounded server-side lookup/search contract.

`SupabasePatientRepository.listPatients()` performs:

```text
patients
  select *
  tenant_id = active tenant
  order by created_at desc
```

That is correct tenant isolation, but it reads the entire tenant patient collection and full patient rows.

### Existing cashier search is not suitable as-is

`useCashierPatientSearch`:

1. builds a Supabase patient repository;
2. calls `listPatients()`;
3. downloads all patients;
4. filters name/phone in React;
5. excludes `status === 'archived'` client-side.

It has useful request-generation and tenant-switch protections, but its retrieval boundary is unsuitable for a general laboratory create picker.

Do not copy or rename it and call the problem solved.

### Existing queue patient-name hydration has the same broad read

`useLaboratoryWorkQueue` currently resolves names for the order patient IDs by calling `patientRepository.listPatients()` and then filtering the returned collection to the requested IDs in JavaScript.

This is an existing read-path scalability/minimization issue. It is **not introduced by queue mutations**, so it does not have to be bundled into 001S, but the new picker must not make the same pattern worse.

A later bounded `getPatientLookupByIds(ids)` optimization can replace this hydration separately if needed.

## Required patient lookup contract

Before queue create UI, add a small generic read contract to the existing patient data layer.

Recommended type:

```ts
interface PatientLookupRecord {
  id: string;
  fullName: string;
  phone: string;
  status: string;
}

interface SearchPatientLookupInput {
  query: string;
  limit?: number;
}
```

Recommended repository method:

```text
searchPatientLookup(input) -> PatientLookupRecord[]
```

### Required properties

- tenant-scoped in every Supabase query;
- no query when normalized input is shorter than 2 characters;
- hard maximum result count, recommended 20;
- select only picker fields (`id`, `full_name`, `phone`, `status`), not `*`;
- do not return notes, allergies, finance fields or integration metadata;
- exclude archived patients from the active create picker, consistent with current active-list behavior;
- deterministic ordering;
- errors throw and become one bounded UI error;
- local implementation may exist for repository parity/dev tests, but the laboratory queue write hook must remain fail-closed to a real Supabase tenant/user context.

### Search construction

Avoid raw user interpolation into PostgREST `.or(...)` filter strings.

Recommended bounded implementation:

- classify phone-like input with a strict character pattern (`+`, digits, spaces, parentheses, hyphen);
- phone-like input searches `phone ILIKE`;
- other input searches `full_name ILIKE`;
- escape SQL LIKE wildcard characters `%`, `_` and the escape character before building the pattern;
- always apply tenant filter and result limit;
- server-side archived exclusion.

This avoids a new database RPC/migration while keeping user text out of raw PostgREST filter syntax.

If more advanced fuzzy multi-field search becomes necessary later, that is a separate search/API design task.

## Archived patient semantics

The current laboratory create RPC validates that the patient exists inside the tenant, but does **not** require a non-archived patient status.

Project patient-card rules say archive may hide a patient from active lists and must preserve historical records.

Therefore:

- the new queue create picker should exclude archived patients as active-list UX;
- existing laboratory history for archived patients must remain readable;
- 001S must not silently change the frozen backend RPC to reject archived patients;
- if the business wants “archived patient can never receive any new laboratory order even through direct RPC/patient-card route”, that requires a separate explicit domain/backend decision and migration task.

Do not smuggle that policy change into a search helper.

## Queue create interaction

After 001S exists, recommended 001T interaction:

1. role-capable user clicks `Новая работа` in the queue header;
2. a small patient lookup step opens;
3. no patients are preloaded;
4. user enters at least 2 characters of name or phone;
5. bounded server results show name + phone only;
6. user explicitly selects one result;
7. selected patient becomes fixed for the create form;
8. reusable `LaboratoryWorkOrderDialog` opens/continues with that patientId;
9. the form cannot silently change patientId;
10. create goes only through frozen `useLaboratoryWorkMutations.createOrder`;
11. successful create closes dialogs and refreshes queue data.

Do not add “create new patient” inside the laboratory picker. Patient creation remains a separate patient workflow.

## Queue existing-order actions

Each order card can use its authoritative `order.patientId` and `mutationVersion`.

For `in_progress`:

- edit if role permits and `mutationVersion` is valid;
- complete if role permits and `mutationVersion` is valid.

For `completed`:

- no edit;
- owner/admin reopen only;
- reopen reason required.

Missing/invalid mutation version:

- show refresh/current-data warning;
- do not offer unsafe edit/complete/reopen mutation.

No patient picker is used for edit, complete or reopen.

## Stale and uncertain behavior

001T must preserve the proven 001Q behavior.

### Stale edit

- open version N;
- another session saves N+1;
- stale submit rejected;
- bounded stale message shown;
- canonical refreshed queue card wins;
- no mixed work-type set;
- stale dialog may remain open only if the current canonical order is still safely available; otherwise close and require a fresh action.

Expected HTTP 400 network/resource console entry from a rejected stale RPC should be reported honestly as a negative-path transport artifact, not mislabeled as a normal-flow console failure.

### Operation uncertain

- high-visibility warning;
- do not issue a new create/edit command;
- exact retry uses only `retryPendingMutation()`;
- selected patient/order context must remain tied to the captured tenant/user context;
- tenant switch invalidates visible pending-state interaction.

## Tenant boundary

Patient lookup must not rely on hidden IDs or UI filtering.

Required protections:

```text
active tenant/user Supabase context
  -> tenant-scoped PatientRepository search
  -> RLS
  -> selected patientId
  -> laboratory create RPC tenant validation
```

Admin B searching for a known Clinic A patient name/phone must receive no Clinic A result.

Known Clinic A patient UUID entered through a direct route or forged UI state must still be rejected/not exposed by tenant-scoped reads/RPC validation.

## PHI minimization

The queue patient picker needs only:

- patient id internally;
- patient full name;
- phone;
- status for active/archived filtering.

It does **not** need:

- notes;
- allergies;
- balance;
- bonus balance;
- integration metadata;
- medical findings;
- dental chart;
- treatment plans;
- documents.

Search results must never display raw UUIDs.

## Strategy comparison

### Strategy A: reuse `usePatientsCollection`

**REJECT.**

Reasons:

- loads the full patient collection;
- can use local fallback;
- brings create/update patient mutation surface along conceptually;
- not a bounded write-picker boundary.

### Strategy B: reuse `useCashierPatientSearch` unchanged

**REJECT.**

Reasons:

- cashier-domain naming/coupling;
- calls `listPatients()` and filters in browser;
- downloads full patient records;
- no result limit at the repository boundary.

Its request-generation/context-switch pattern is useful reference code, not the retrieval contract to copy.

### Strategy C: query Supabase directly inside `LaboratoryPage`

**REJECT.**

Reasons:

- bypasses repository/data-layer conventions;
- makes the page own DB/query syntax;
- encourages God-page growth;
- harder to test and reuse.

### Strategy D: add bounded patient lookup to existing PatientRepository + fail-closed laboratory lookup hook

**RECOMMENDED.**

Benefits:

- no new backend family;
- no migration;
- server-side tenant filtering;
- minimal selected columns;
- bounded result count;
- reusable by later picker surfaces;
- isolated data-only verification before UI mutation work;
- preserves 001Q dialog/RPC architecture.

## Recommended implementation split

### 001S: LAB-WORK-PATIENT-LOOKUP-FOUNDATION

Data-only prerequisite.

Expected bounded scope:

```text
src/data/repositories/PatientRepository.ts
src/data/repositories/PatientRepository.test.ts
src/data/hooks/useLaboratoryPatientLookup.ts
src/data/hooks/useLaboratoryPatientLookup.test.tsx
_ai_work/REPORTS/LAB-WORK-PATIENT-LOOKUP-FOUNDATION-001S_patient_lookup.md
```

No UI files, migrations, queue mutations or patient writes.

Required 001S tests:

- input shorter than minimum produces no backend search;
- tenant id is applied to every Supabase lookup query;
- only minimal picker columns requested;
- hard result limit enforced/clamped;
- name lookup;
- phone-like lookup;
- escaped LIKE wildcard behavior;
- archived patients excluded from active picker results;
- Supabase errors propagate as bounded hook error;
- fail closed without Supabase tenant/user context;
- tenant switch drops stale prior-tenant results;
- no `listPatients()` full collection fallback in laboratory lookup;
- no patient create/update path exposed.

Recommended real local data-layer smoke for 001S:

- create synthetic tenant A and tenant B patient names locally;
- authenticate QA Admin A and Admin B;
- search by name and phone through the actual new repository/hook/client boundary;
- verify A cannot find B and B cannot find A;
- verify archived fixture excluded;
- verify result fields are minimal;
- cleanup all synthetic rows.

Browser smoke is not mandatory if 001S changes no UI.

### 001T: LAB-WORK-QUEUE-MUTATION-SURFACE

Only after 001S is frozen.

Expected UI scope:

- `LaboratoryPage.tsx` + tests;
- small queue patient picker component + tests;
- minimal reusable `LaboratoryWorkOrderDialog` patient-label presentation extension + tests;
- reuse existing lifecycle dialogs/permissions/options/mutation hook;
- QA report.

Do not create a second order form or second mutation client.

## Real browser QA matrix for 001T

### Admin A

1. Open `/laboratory`.
2. Verify no patient list is preloaded by opening create picker.
3. Search synthetic patient by name.
4. Verify bounded result shows name + phone and no raw UUID/medical fields.
5. Select patient.
6. Create order with doctor/lab/work types/time/shade/teeth.
7. Verify queue card appears.
8. Reload and verify persistence.
9. Edit from queue card and verify reload persistence.
10. Complete and verify edit disappears.
11. Reopen with reason and verify status returns to in progress.
12. No delete control.
13. Normal-flow console errors 0 / failed requests 0.

### Doctor A

- patient lookup/create allowed;
- edit allowed;
- complete allowed;
- reopen absent;
- reload persistence.

### Registrar A

- same create/edit/complete behavior;
- reopen absent.

### Cashier / unsupported direct route

- queue may render according to existing read access;
- no create/edit/complete/reopen controls;
- no patient lookup request initiated by mutation UI.

### Tenant boundary

- Admin B search cannot discover Clinic A synthetic patient by name or phone;
- Admin B cannot mutate a known Clinic A order/patient ID;
- no Clinic A labels/raw IDs appear.

### Stale race

- two real sessions edit same order at version N;
- one winner increments version;
- loser receives bounded stale message;
- queue refresh displays winner;
- relation set belongs wholly to winner;
- expected stale rejection transport entry documented if emitted.

### Operation uncertain

If safely reproducible without corrupting state:

- induce/fixture uncertain client response;
- verify high-visibility no-duplicate warning;
- verify exact retry path only.

If not safely reproducible in browser, unit/integration coverage from frozen 001O plus queue wiring tests must remain the fallback and report must state that limitation.

### Cleanup

Delete every task-created patient/order/link/reference/audit fixture and verify zero rows.

## What 001S / 001T must NOT do

- no new laboratory backend or RPC family;
- no new laboratory schema/migration;
- no patient create/update inside laboratory flow;
- no full patient preload for the create picker;
- no raw user text interpolation in a PostgREST `.or(...)` expression;
- no raw UUID display;
- no hard delete;
- no new lifecycle statuses;
- no finance/warehouse/treatment/completed-service/dental-chart/finding writes;
- no MacDent/amoCRM writes;
- no local production mutation fallback;
- no global patient-search refactor of cashier/CRM surfaces “for consistency”;
- no unrelated fix of the existing queue name-hydration `listPatients()` issue unless separately tasked.

## Checks

Report-only baseline on `bef74bafa30c578061495f01d704721fc8e53fd4`:

- ESLint: **PASS**.
- Full Vitest: **128 files / 1297 tests PASS**.
- Build: **PASS**.
- `git diff --check`: **PASS**.
- Browser smoke: **not required**, because 001R changes no runtime/UI code.
- No local/cloud database mutation performed by this recon.

Existing baseline warnings remain outside scope:

- React test `act(...)` warnings in unrelated tests;
- Vite large-chunk warning;
- npm audit reports 7 known vulnerabilities after `npm ci`.

## Browser smoke

**NOT PERFORMED by design.**

Reason: 001R is report-only reconnaissance and changes no runtime behavior. The exact real-browser matrix is defined above for the future 001T UI task.

## Issues / limitations

1. `PatientRepository` has no bounded lookup API today.
2. `useCashierPatientSearch` and queue patient-name hydration both currently use full `listPatients()` reads before client-side filtering.
3. The create RPC checks tenant patient existence but not archived status; picker archive filtering must not be misrepresented as a backend prohibition.
4. `LaboratoryWorkOrderDialog` has one patient-card-specific presentation string that should be generalized, not forked.
5. The pure laboratory permission helper currently lives under the patient-card component folder. Queue reuse creates a slightly awkward import direction. Do not duplicate it; move it to a shared domain location only in a separate tiny refactor if this becomes materially confusing.
6. More advanced fuzzy/multi-field patient search is intentionally deferred.
7. Hermes shared task policy can be overwritten by parallel sessions; each future SQL/browser/write step must verify/reapply its task policy before execution. This is a tooling isolation issue, not a DentalFlow product requirement.

## Final verdict

Final verdict: **PASS**

Queue write UI readiness: **NOT READY until bounded patient lookup 001S is frozen.**

After 001S: **READY for a small 001T queue mutation surface using the frozen 001Q components/client.**

## Recommended next task

**LAB-WORK-PATIENT-LOOKUP-FOUNDATION-001S — add a bounded tenant-scoped patient lookup contract to the existing PatientRepository and a fail-closed laboratory patient lookup hook. Select only id/fullName/phone/status, enforce minimum query + hard limit, perform server-side name-or-phone lookup without raw `.or(...)` interpolation, exclude archived patients from active picker results, test tenant switching/errors, and prove the path against local Supabase. No UI, no migrations, no patient writes, no laboratory mutations.**
