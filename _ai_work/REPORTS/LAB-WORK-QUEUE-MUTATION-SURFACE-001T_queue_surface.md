# LAB-WORK-QUEUE-MUTATION-SURFACE-001T

## Summary

The top-level `/laboratory` operational queue now has the bounded write surface selected by `LAB-WORK-QUEUE-MUTATION-RECON-001R`. The implementation reuses the frozen 001O mutation hook, 001Q role/action/dialog contract and 001S bounded patient lookup. Create requires an explicit server-side patient search and explicit patient selection before the order dialog opens; the selected patient is then fixed and cannot be changed inside the order form. Existing rows reuse edit/complete/reopen lifecycle actions with the accepted `mutationVersion` gate.

No schema, migration, hard delete, new mutation backend, finance/warehouse/treatment/completed-service/dental-chart/finding, MacDent or amoCRM coupling was added.

## Branch

`feature/lab-work-queue-mutation-surface-001t`

## PR URL

https://github.com/NckNA/codex-test/pull/394

- Base: `main`.
- Baseline: `a2a73bbf3f91c3e6b58de88b3c8bf944f68b25f9`.
- Implementation commit: `ef28a2c8d74a8fa195e182e36c97f4d5f83944bc`.
- Implementation CI: run `#857` / `32254977241`, **SUCCESS** on `ef28a2c8d74a8fa195e182e36c97f4d5f83944bc`.
- Final report update commit: N/A because the report cannot contain its own future SHA. Final PR/CI evidence is persisted after publication.

## Changed files summary

Implementation changes exactly six files:

```text
src/components/laboratory/LaboratoryPatientPicker.tsx
src/components/laboratory/LaboratoryPatientPicker.test.tsx
src/components/patients/patient-card/LaboratoryWorkOrderDialog.tsx
src/components/patients/patient-card/LaboratoryWorkOrderDialog.test.tsx
src/pages/LaboratoryPage.tsx
src/pages/LaboratoryPage.test.tsx
```

This QA report is the seventh file in the final PR. No migration, seed, package, lockfile, helper script, screenshot or environment file belongs to the PR.

## Implemented behavior

- `clinic_owner` / `clinic_admin`: create, edit, complete, reopen.
- `doctor` / `registrar`: create, edit, complete; no reopen.
- unsupported roles, including cashier: no queue access even through a direct `/laboratory` route.
- create opens `LaboratoryPatientPicker` first.
- the picker starts empty and performs no search before at least two typed characters plus explicit search action.
- the picker consumes only frozen `useLaboratoryPatientLookup`; it does not call `listPatients()` or direct Supabase table APIs.
- selected patient ID and human label are passed to the frozen order dialog; patient cannot be changed inside the form.
- edit/complete/reopen are shown only when role, status and positive integer `mutationVersion` allow the action.
- rows without a valid mutation version show an update warning instead of write controls.
- stale, conflict, refresh-warning and exact uncertain-retry semantics are reused from frozen 001O.
- no delete action exists.
- the order dialog now accepts an optional human patient label for queue use while retaining the patient-card fallback text.

## Checks

### Targeted

- `LaboratoryPatientPicker.test.tsx`: 4 PASS.
- `LaboratoryWorkOrderDialog.test.tsx`: 5 PASS.
- `LaboratoryPage.test.tsx`: 8 PASS.
- Total targeted: **17/17 PASS**.

Coverage includes:

- no patient preload before explicit search;
- selected patient is returned exactly and raw patient ID is not visible text;
- fail-closed unavailable/error lookup state;
- explicit patient label in the order dialog;
- queue create requires patient selection;
- admin edit/complete/reopen;
- doctor no reopen;
- cashier direct-route denial;
- missing `mutationVersion` blocks queue actions.

### Full quality gate

- Full Vitest: **1316 tests PASS**.
- ESLint: **PASS**.
- production build: **PASS**.
- `git diff --check`: **PASS**.
- Implementation GitHub CI #857: **SUCCESS**.
- Existing unrelated React `act(...)` warnings remain in older dental tests.
- Existing Vite large-chunk warning and npm audit findings remain outside this task.

## Browser smoke

Fresh local Supabase reset and QA users were used. Only synthetic local fixtures were created. Cloud Supabase, MacDent and amoCRM were not touched.

### Admin A

Real `/laboratory` UI:

1. login;
2. bounded patient search;
3. explicit selection of `QA 001T Create Patient`;
4. create `QA 001T Created From Queue`;
5. edit existing order to `QA 001T Admin Edited`;
6. complete it;
7. reopen a completed order with explicit reason;
8. verify no delete action.

Result: **PASS**.

- console errors: 0;
- failed requests: 0;
- network writes: 5;
- secrets visible: false.

Database verification proved:

- created order belongs to the exact selected patient;
- FDI tooth `51` is preserved;
- created version = 1;
- edited+completed version advanced to 3;
- reopened completed order advanced to version 2.

### Doctor A

Real queue edit + complete on dedicated synthetic order. Reopen was absent.

Result: **PASS**.

- console errors: 0;
- failed requests: 0;
- network writes: 3.

### Registrar A

Real bounded create + edit + complete. Reopen was absent.

Result: **PASS**.

- console errors: 0;
- failed requests: 0;
- network writes: 4.

### Cashier A

Direct `/laboratory` route displayed `Недостаточно прав для лабораторных работ.` and exposed no create/complete/reopen controls.

Result: **PASS**.

### Admin B tenant boundary

Clinic B queue was empty. Clinic A patient/order names were absent. Opening create and searching for a Clinic A synthetic patient returned `Пациенты не найдены.`

Result: **PASS**.

### Two-browser stale race

Admin A and Doctor A opened the same in-progress order at the same mutation version. Admin submitted first. Doctor submitted a stale edit later.

Result:

- one winner only;
- loser received `Лабораторная работа уже изменена. Обновите данные перед повтором.`;
- canonical winner title was visible after refresh;
- final DB `mutation_version = 3` for the raced order;
- loser title row count = 0;
- winner title row count = 1;
- work-type relation set remained exactly one accepted type;
- no mixed partial state.

The losing browser logged one expected resource HTTP 400 from the rejected stale RPC. This negative-path console entry is recorded as expected evidence, not described as console-clean.

### Cleanup

Cleanup removed:

- 10 synthetic laboratory audit events;
- 6 synthetic laboratory work orders;
- 2 synthetic work types;
- 1 synthetic laboratory;
- 4 synthetic patients;
- all related order-type rows via cascade/explicit cleanup.

Final verification:

```text
audit_events = 0
orders = 0
links = 0
types = 0
labs = 0
patients = 0
```

QA users and seeded doctors were not deleted. Local Vite server was stopped and port 5185 was no longer listening.

## Issues / limitations

1. **Pre-existing broad queue patient-name hydration remains.** `useLaboratoryWorkQueue()` still calls `PatientRepository.listPatients()` and filters by order patient IDs in the browser. The new create picker does not use that path, but the existing queue read-model still loads more patient rows than necessary. This is a privacy/performance debt inherited from the read-only queue and intentionally not refactored inside this UI task.
2. The stale negative-path RPC returns HTTP 400 by design, which appears as one browser console resource error in the losing session.
3. Screenshots are local QA artifacts under `D:\hermes\reports\active` and are not repository files.
4. Hermes shared active task policy was overwritten several times by parallel sessions during the task. Every sensitive SQL/browser/Git phase re-verified/re-applied the 001T policy before proceeding. No cloud target was enabled.
5. Hermes `finalize_report_metadata` has the existing `replaceReportPlaceholders is not defined` defect. If it recurs, use the established one-file report correction flow after merge.

## Final verdict

Final verdict: **PASS**

## Recommended next task

**LAB-WORK-QUEUE-PATIENT-NAMES-RECON-001U — report-only reconnaissance for replacing the pre-existing `useLaboratoryWorkQueue()` full `listPatients()` hydration with a bounded tenant-scoped batch-by-ID patient label read. Compare an exact-ID batch repository method versus another read-model approach, require minimal fields, preserve fail-closed Supabase selection and local test parity, avoid N+1, and do not modify UI or write behavior during recon.**
