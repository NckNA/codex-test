# LAB-WORK-MUTATION-PATIENT-SURFACE-001Q

## Summary

The first laboratory write surface is implemented only inside the patient Laboratory tab, using the frozen atomic RPC and typed mutation client. Role boundaries, fail-closed options, tenant-timezone conversion, optimistic concurrency, exact uncertain retry and real multi-role browser QA are verified. The top-level laboratory queue remains read-only.

## Task

Implement the first bounded laboratory write UI selected by `LAB-WORK-MUTATION-SURFACE-RECON-001P`, only inside the current patient's Laboratory tab.

The task consumes the already frozen 001N atomic RPC foundation and 001O typed mutation client/hook. It does not create another mutation backend.

## Semantic boundary

```text
PatientCardPage
  -> passes patientId + tenant timezone + active tenant role
PatientLaboratoryWorkTab
  -> read list/reference state
  -> pure laboratory role capabilities
  -> fail-closed mutation options
  -> frozen useLaboratoryWorkMutations
  -> explicit create/edit/complete/reopen dialogs
Database RPC
  -> authoritative tenant/role/state/concurrency enforcement
```

The top-level `/laboratory` queue remains read-only.

No hard delete, new lifecycle status, patient picker, schema change, migration, finance/warehouse/treatment/completed-service/dental-chart/finding mutation, MacDent write or amoCRM write was added.

## Branch

`feature/lab-work-mutation-patient-surface-001q`

## PR URL

https://github.com/NckNA/codex-test/pull/388

- Base: `main`.
- Baseline: `b7cd91e855c326d380be29a15e07736228795759`.
- Implementation commit: `cc25e2216a4ad49f3786c7f6ed6e1a0109b8eb0c`.
- Implementation CI: run `#842` / `32246640827`, **SUCCESS** on `cc25e2216a4ad49f3786c7f6ed6e1a0109b8eb0c`.
- Final PR #388 report head: `66a880e5d3ec755a4bbc6ee7456f0c1deeaddfa5`.
- Final PR #388 CI: run `#843` / `32247006755`, **SUCCESS** on `66a880e5d3ec755a4bbc6ee7456f0c1deeaddfa5`.
- PR #388 merge commit: `c28065cfdf0d1e0497d223bada8f164a204079b3`.
- Report correction commit: N/A because this correction only persists already verified final PR #388 evidence in `main`.

## Implemented product behavior

### Role capabilities

A pure `laboratoryWorkPermissions.ts` helper mirrors the frozen database role contract:

- `clinic_owner`, `clinic_admin`: view/create/edit/complete/reopen;
- `doctor`, `registrar`: view/create/edit/complete, no reopen;
- cashier/unsupported roles: no laboratory mutation surface.

UI visibility is not treated as security. RPC/database authorization remains authoritative.

### Fail-closed mutation options

`useLaboratoryMutationOptions(orderId?)` uses the existing laboratory repository selection and is enabled only for a ready Supabase tenant/user context.

It reads:

- all doctors for the active tenant;
- laboratories including inactive historical values;
- work types including inactive historical values;
- exact selected work-type IDs for one edited order.

There is no local production mutation fallback and no new backend family.

If option loading fails, the form remains unavailable rather than accepting guessed IDs.

### Create/edit dialog

`LaboratoryWorkOrderDialog` supports the current order domain:

- patient fixed by current patient card, not editable;
- required title;
- optional order number;
- doctor;
- laboratory;
- work types;
- sent/planned-ready/received/try-in/delivered timestamps;
- shade;
- anatomical scope;
- FDI teeth;
- comment.

Create does not expose a status selector. New orders remain `in_progress` through the frozen RPC contract.

Edit sends the complete desired state and requires a positive `mutationVersion`.

Inactive historical doctor/laboratory/work-type references remain visible/preservable when already selected, but disappear from selectable choices after replacement/removal.

### FDI alignment

During implementation, schema comparison caught that migration 0035 accepts both permanent and deciduous FDI numbers.

The UI now accepts exactly the corresponding bounded set:

- permanent: 11-18, 21-28, 31-38, 41-48;
- deciduous: 51-55, 61-65, 71-75, 81-85.

Both unit and real browser QA exercise deciduous tooth `51`.

This remains manufacturing/laboratory scope only and does not write dental-chart state.

### Tenant timezone handling

`datetime-local` values use existing timezone helpers:

- `instantToTenantDateTimeInput` for edit display;
- `tenantDateTimeToInstant` before mutation.

No manual `Z` suffixing or browser-timezone assumption was introduced.

Real QA entered `2026-08-26 11:00` in `Asia/Almaty`; the canonical database value was `2026-08-26T06:00:00.000Z`.

### Lifecycle actions

- `Завершить работу` is an explicit confirmation action for in-progress orders.
- `Вернуть в работу` is visible only to owner/admin on completed orders.
- Reopen requires a non-empty explicit reason.
- Reopen reason is not copied into the normal order comment.
- No delete action exists.

### Concurrency/reconciliation UX

Existing 001O semantics are surfaced rather than reimplemented:

- missing/invalid `mutationVersion` blocks existing-order mutation;
- stale/conflict/state errors show bounded messages and use canonical refresh;
- operation-uncertain state warns not to create another operation;
- `Повторить ту же операцию` calls only `retryPendingMutation()`;
- post-commit refresh failure is a warning, not a false mutation failure;
- tenant/user context controls mutation availability/state.

## Changed files summary

Implementation files:

```text
src/components/patients/patient-card/PatientLaboratoryWorkTab.tsx
src/components/patients/patient-card/PatientLaboratoryWorkTab.test.tsx
src/components/patients/patient-card/LaboratoryWorkOrderDialog.tsx
src/components/patients/patient-card/LaboratoryWorkOrderDialog.test.tsx
src/components/patients/patient-card/LaboratoryWorkLifecycleDialogs.tsx
src/components/patients/patient-card/LaboratoryWorkLifecycleDialogs.test.tsx
src/components/patients/patient-card/laboratoryWorkPermissions.ts
src/components/patients/patient-card/laboratoryWorkPermissions.test.ts
src/data/hooks/useLaboratoryMutationOptions.ts
src/data/hooks/useLaboratoryMutationOptions.test.tsx
src/pages/PatientCardPage.tsx
src/pages/PatientCardPage.test.tsx
```

QA report:

```text
_ai_work/REPORTS/LAB-WORK-MUTATION-PATIENT-SURFACE-001Q_patient_surface.md
```

No migration, seed, package, lockfile, top-level Laboratory page, helper script, screenshot or environment file is part of the PR.

## Checks

### Targeted

**PASS: 6 test files / 32 tests.**

Coverage includes:

- owner/admin/doctor/registrar/unsupported role capabilities;
- fail-closed mutation-options selection;
- active and inactive historical references;
- create desired-state normalization;
- tenant-timezone conversion;
- permanent + deciduous FDI deduplication/sorting;
- edit exact `expectedVersion`;
- missing-version block;
- complete confirmation;
- reopen reason requirement;
- patient-card role propagation;
- exact uncertain retry;
- no delete/reopen role leakage.

### Full suite

**PASS: 128 test files / 1297 tests.**

### Static/build

- ESLint: **PASS**.
- TypeScript/Vite production build: **PASS**.
- `git diff --check`: **PASS**.
- Existing unrelated React `act(...)` warnings remain baseline noise.
- Existing Vite large-chunk warning remains baseline.
- Existing npm audit findings remain outside this task; no dependency files changed.

### Local schema

Typed local Supabase assertions: **9/9 PASS**.

Verified:

- `laboratory_work_orders.mutation_version` exists;
- laboratory order/work-type/laboratory tables exist;
- RLS remains enabled on the checked tables.

Fresh local Supabase reset plus guarded QA-user seed: **PASS**.

## Browser smoke

Environment:

- local Supabase only;
- Vite worktree `feature/lab-work-mutation-patient-surface-001q`;
- localhost `127.0.0.1:5185`;
- QA shortcut using ordinary local Supabase Auth;
- synthetic fixture data only;
- cloud Supabase: not touched;
- MacDent/amoCRM: not touched.

### Admin A lifecycle

Real UI operations completed:

1. Opened synthetic patient Laboratory tab.
2. Created `QA Admin Crown`.
3. Selected active doctor and `QA 001Q Lab`.
4. Selected two work types: Crown + Zirconia.
5. Entered planned-ready time, shade `A2`, and teeth `11, 12, 51`.
6. Verified visible human-readable labels.
7. Edited title to `QA Admin Crown Edited`.
8. Changed planned-ready datetime.
9. Removed Zirconia while preserving Crown.
10. Completed the order.
11. Reopened with explicit reason `QA correction 001Q`.
12. Reloaded and verified persistence.
13. Verified no delete control.

The first combined smoke sequence had timing-only false assertions immediately after route `goto` because the tab was clicked before patient-card loading settled. The actual mutations succeeded. Those false assertions were not accepted as persistence proof.

A separate reload verification with explicit waits then **PASSED**:

- title persisted;
- status returned to `В работе` after reopen;
- Crown remained;
- Zirconia was absent;
- no delete control;
- console errors: 0;
- failed requests: 0;
- secrets visible: false.

Canonical database after the Admin lifecycle:

- status: `in_progress`;
- `mutation_version = 4`;
- planned-ready instant correctly represented clinic-local 11:00 as UTC 06:00;
- selected teeth `[11,12,51]`;
- exactly one work-type relation remained after edit.

### Doctor A

**PASS.**

Through the real UI, Doctor A:

- created an order;
- edited it;
- completed it;
- reloaded and saw persisted completed state;
- never received a reopen action.

Console errors: 0. Failed requests: 0. Secrets visible: false.

### Registrar A

**PASS.**

Through the real UI, Registrar A:

- created an order;
- edited it;
- completed it;
- reloaded and saw persisted completed state;
- never received a reopen action.

Console errors: 0. Failed requests: 0. Secrets visible: false.

### Cashier A

**PASS.**

Cashier direct patient-card Laboratory route showed no laboratory mutation surface:

- no create;
- no complete;
- no reopen;
- no mutation form.

Console errors: 0. Failed requests: 0. Secrets visible: false.

### Tenant boundary

**PASS.**

Admin B opened the known direct route for the Clinic A synthetic patient.

Clinic A values were absent:

- patient name;
- order title;
- laboratory name;
- work-type names.

Console errors: 0. Failed requests: 0. Secrets visible: false.

### Raw-ID and top-level queue boundary

**PASS.**

Admin A patient Laboratory UI did not render the raw order, doctor, laboratory or work-type UUIDs used by the fixture.

The top-level `/laboratory` page still displayed its existing read-only description and had no create/complete/reopen controls.

### Real two-browser stale race

Semantic result: **PASS with expected negative-path console network entry**.

Two authenticated browser sessions opened the same in-progress order at the same version.

- Doctor A submitted `QA Concurrent Winner` first.
- Admin A then submitted stale `QA Stale Loser`.
- Doctor winner UI succeeded.
- Admin loser received the bounded message: `Лабораторная работа уже изменена. Обновите данные перед повтором.`
- Canonical refreshed UI displayed `QA Concurrent Winner`.

Database proof after the race:

- title = `QA Concurrent Winner`;
- status = `in_progress`;
- `mutation_version = 5`, exactly one increment from the pre-race version 4;
- relation set remained exactly the single Crown work type;
- no partial stale relation write occurred.

The stale losing browser logged one browser resource message for the expected Supabase RPC HTTP 400 rejection:

```text
Failed to load resource: the server responded with a status of 400 (Bad Request)
```

This is intentionally reported rather than described as a clean console. The negative RPC was rejected as designed, the UI converted it to the bounded stale state, the runner recorded no failed application request, and no partial mutation survived.

### Local screenshots

Local-only QA artifacts, not committed:

```text
D:\hermes\reports\active\LAB-WORK-MUTATION-PATIENT-SURFACE-001Q-admin-reload.png
D:\hermes\reports\active\LAB-WORK-MUTATION-PATIENT-SURFACE-001Q-doctor.png
D:\hermes\reports\active\LAB-WORK-MUTATION-PATIENT-SURFACE-001Q-registrar.png
D:\hermes\reports\active\LAB-WORK-MUTATION-PATIENT-SURFACE-001Q-cashier.png
D:\hermes\reports\active\LAB-WORK-MUTATION-PATIENT-SURFACE-001Q-tenant-boundary.png
D:\hermes\reports\active\LAB-WORK-MUTATION-PATIENT-SURFACE-001Q-stale.png
```

### Cleanup

**PASS.**

Task-scoped cleanup removed:

- 11 synthetic laboratory audit events;
- 3 synthetic laboratory orders;
- 3 synthetic order/work-type relation rows;
- 2 synthetic laboratory work types;
- 1 synthetic laboratory;
- 4 synthetic patients.

Post-cleanup verification returned zero for audit events, orders, known links, work types, laboratory and patients.

Seeded QA users and seeded doctors were not deleted.

Vite process was stopped and port 5185 was confirmed closed after QA.

## Scope / safety audit

**PASS.**

- Changed implementation files: exactly 12 declared files.
- Direct `.from(...)` calls in the new mutation UI/options surface: 0.
- `supabase/migrations/*`: unchanged.
- package/lock files: unchanged.
- `src/pages/LaboratoryPage.tsx`: unchanged.
- finance/warehouse/treatment/dental-chart domain files: unchanged.
- no local/dev production mutation fallback added.
- no hard delete added.
- no patient picker/search added.
- no raw UUID display introduced.
- no screenshots or credentials committed.

One operational tooling issue occurred twice: a parallel Hermes task replaced the global active Super-Hermes policy with `NA04-V2-LOCAL-001`. Each time the mismatch was detected before the blocked/sensitive action, the 001Q policy was explicitly restored, and no cross-project file or database mutation was performed. This is a Hermes shared-policy isolation issue, not a DentalFlow product change, and is not repaired inside this PR.

## Issues / limitations

- Expected stale RPC rejection emits an HTTP 400 resource entry in the losing browser console. Normal success/role/tenant scenarios were console-clean.
- The first combined Admin smoke sequence contained timing-only post-`goto` assertions before the patient card had settled. Persistence was re-run separately with waits and passed; the earlier false assertions are not counted as evidence.
- Top-level `/laboratory` remains intentionally read-only.
- There is still no top-level safe patient picker/search for laboratory create actions.
- The compact FDI text input is deliberately bounded and validated; a graphical manufacturing tooth selector is a separate UI enhancement.
- Audit viewing/reporting was not expanded; only the frozen atomic backend audit behavior was exercised and cleaned.
- Hermes `finalize_report_metadata` has an existing `replaceReportPlaceholders is not defined` defect seen in prior tasks; if it recurs, final evidence must be persisted through the established one-file report correction flow.

## Final verdict

Final verdict: **PASS**

## Recommended next task

**LAB-WORK-QUEUE-MUTATION-RECON-001R — report-only reconnaissance for extending the now-frozen laboratory mutation dialogs to the top-level `/laboratory` operational queue. Study a fail-closed tenant-scoped patient search/picker, role/action placement in queue cards, reuse boundaries for the 001Q dialogs, cross-patient navigation, stale/uncertain behavior, and browser QA. Do not implement queue writes or a patient-search subsystem during the recon.**
