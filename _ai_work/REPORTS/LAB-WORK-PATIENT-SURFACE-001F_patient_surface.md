# LAB-WORK-PATIENT-SURFACE-001F — Read-only Patient Laboratory Surface

## Summary

DentalFlow now has a dedicated read-only `Лаборатория` tab inside the patient card. The surface consumes only the frozen `usePatientLaboratoryWorkOrders(patientId)` boundary from 001D and does not instantiate or expose the mutation-capable laboratory repository.

Final verdict: **PASS**

## Branch

`feature/lab-work-patient-surface-001f`

## PR URL

https://github.com/NckNA/codex-test/pull/372

- Base branch: `main`.
- Verified baseline: `8c0fad1ff13e54e56efc1b6f64fa9c232cfbcd90`.
- Implementation head: `729bae9e1cbcfeaad72e3fc38ec91428e1edf6fb`.
- Implementation CI: run `#793` / `32223316294`, **SUCCESS**.
- Report update commit: N/A because a report cannot contain its own future SHA; the final report commit and fresh CI are recorded in the immutable finalization receipt.

## Changed files summary

Implementation:

1. `src/components/patients/patient-card/PatientLaboratoryWorkTab.tsx`
2. `src/components/patients/patient-card/PatientLaboratoryWorkTab.test.tsx`
3. `src/pages/PatientCardPage.tsx`
4. `src/pages/PatientCardPage.test.tsx`

Final report:

5. `_ai_work/REPORTS/LAB-WORK-PATIENT-SURFACE-001F_patient_surface.md`

No repository implementation, migration, seed, package, lockfile, finance, warehouse, treatment/completed-service, amoCRM or MacDent file belongs in the task diff.

## Semantic contract

```text
PatientCardPage(patient.id)
→ select Лаборатория
→ PatientLaboratoryWorkTab(patientId, tenant timezone)
→ usePatientLaboratoryWorkOrders(patientId)
→ frozen 001D tenant/patient read boundary
→ read-only laboratory work records
```

Invariants preserved:

1. Surface is read-only.
2. `PatientLaboratoryWorkTab` calls only `usePatientLaboratoryWorkOrders`.
3. No `createOrder`, `updateOrder`, work-type mutation or delete API is exposed.
4. No second repository/backend is created.
5. Production backend routing remains governed by 001C fail-closed auth/tenant wiring.
6. Raw `responsibleDoctorId` and `laboratoryId` are not presented as human labels.
7. No finance/payment, warehouse/material, treatment-plan or completed-service coupling is introduced.
8. No MacDent or amoCRM interaction occurs.
9. Tenant timezone is used for operational timestamps.
10. PatientCardPage receives only bounded tab wiring; laboratory rendering remains in its own component.

## Visible behavior

The patient card now includes the tab:

```text
Лаборатория
```

The tab has deterministic states:

- loading;
- safe load error with `Повторить` through the read hook;
- empty state;
- one or more read-only laboratory-order cards.

Per order the surface can show existing semantically complete facts:

- title;
- optional order number;
- `В работе` / `Завершена` status;
- planned-ready time;
- sent-to-lab time;
- received-from-lab time;
- try-in time;
- delivered-to-patient time;
- shade;
- anatomical scope;
- selected FDI teeth;
- comment;
- updated timestamp.

No invented paid/remake/cancelled semantics were added.

## Reference-label boundary

The current record contains `responsibleDoctorId` and `laboratoryId`, while work-type membership is stored separately. 001F deliberately does not display raw UUIDs as if they were useful doctor/laboratory names.

Human-readable doctor/laboratory/work-type enrichment is deferred to a separate bounded read-model/reference task. That future task must avoid N+1 order/type lookup behavior and must not cause the UI to reach into mutation-capable repository methods.

## Checks

### Targeted tests

**PASS — 17/17** across:

- `PatientLaboratoryWorkTab.test.tsx`: 5/5;
- `PatientCardPage.test.tsx`: 4/4;
- frozen `usePatientLaboratoryWorkOrders.test.tsx`: 8/8.

Coverage proves:

- current patient ID is forwarded to the frozen read hook;
- loading, error/retry and empty states;
- in-progress/completed labels;
- tenant-timezone formatting;
- anatomical scope / selected teeth;
- optional fields disappear cleanly;
- raw doctor/laboratory IDs are absent;
- no create/edit/delete lab controls;
- PatientCardPage contains and opens `Лаборатория` for the current patient.

### Full quality gate

- `npm run lint`: **PASS**;
- full Vitest: **PASS — 118 files / 1226 tests**;
- `npm run build`: **PASS**;
- `git diff --check`: **PASS**;
- forbidden coupling/mutation scan of the production lab tab: **PASS / no matches**.

### GitHub CI on implementation

Implementation head `729bae9e1cbcfeaad72e3fc38ec91428e1edf6fb` passed CI run `#793` / `32223316294`:

- Merge guard: success;
- ESLint: success;
- Tests: success;
- Build: success.

## Browser smoke

**PASS — real localhost browser, not simulated.**

Environment:

- branch: `feature/lab-work-patient-surface-001f`;
- app: fresh Vite server from `D:\hermes\lab-work-patient-surface-001f-work` on `127.0.0.1:5185`;
- backend: local Supabase only at `127.0.0.1`;
- production/cloud Supabase: not used;
- QA login: local Supabase Auth shortcut enabled only in the local dev process; no `.env.local` or secret file was created.

### Admin A scenario

Synthetic local patient/order created under Demo Clinic A, then:

1. logged in as `qa.admin.a@example.local` through local QA auth;
2. opened the synthetic patient's card;
3. opened `Лаборатория`;
4. observed title `QA 001F циркониевая коронка`;
5. observed order `QA-001F`;
6. observed status `В работе`;
7. observed shade `A2`;
8. observed `Выбранные зубы: 11, 12`;
9. observed read-only QA comment;
10. navigated/reloaded the patient card and opened the tab again; record persisted through the real local Supabase read path;
11. raw synthetic order UUID was not visible;
12. no `Создать лабораторную работу` / `Удалить лабораторную работу` controls were visible;
13. console errors: **0**;
14. failed requests: **0**;
15. secrets visible: **false**.

Cleanup verification:

```text
remaining_orders = 0
remaining_patients = 0
```

### Doctor A scenario

A second isolated synthetic fixture was created under the same tenant, then:

1. logged in as `qa.doctor.a@example.local`;
2. opened the synthetic patient's card;
3. opened `Лаборатория`;
4. observed `QA 001F работа врача`;
5. observed `QA-001F-DOC`;
6. observed status `Завершена`;
7. observed shade `B1`;
8. observed `Верхняя челюсть; зубы: 21`;
9. observed read-only QA comment;
10. raw synthetic order UUID was not visible;
11. no lab create/delete controls were visible;
12. console errors: **0**;
13. failed requests: **0**;
14. secrets visible: **false**.

This also verifies that the existing RLS/select policy permits the doctor role to read tenant A laboratory orders without introducing a UI-side authorization bypass.

Cleanup verification:

```text
remaining_orders = 0
remaining_patients = 0
```

Local screenshots were saved only under `D:\hermes\reports\active` and are not part of the repository/PR.

## Domain and safety boundaries

```text
UI READ SURFACE: ADDED
LAB MUTATION CONTROLS: 0
DIRECT LAB REPOSITORY USE IN UI: 0
RAW DOCTOR/LAB UUID LABELS: 0
MIGRATIONS: 0
SEED FILE CHANGES: 0
PACKAGE/LOCKFILE CHANGES: 0
CLOUD SUPABASE WRITES: 0
MACDENT WRITES: 0
AMOCRM WRITES: 0
FINANCE COUPLING: 0
WAREHOUSE COUPLING: 0
TREATMENT/COMPLETED-SERVICE COUPLING: 0
LOCAL QA FIXTURE REMAINS: 0
```

The temporary task policy allowed local SQL only for `public.patients` and `public.laboratory_work_orders` in addition to baseline audit tables so the real browser smoke could create and clean synthetic fixtures. Cloud access and migrations remained forbidden.

## Issues / limitations

- Doctor, laboratory and work-type human-readable labels are not yet resolved by the first patient surface. UUIDs are intentionally hidden rather than displayed.
- Existing unrelated React `act(...)` warnings remain baseline warnings; all tests pass.
- `npm ci` reports the same 7 pre-existing dependency vulnerabilities: 1 moderate and 6 high. No dependency changes are in scope.
- RECON 001E recorded pre-existing `summary` / `files` PatientCardPage tab inconsistencies. They were deliberately not fixed here.
- Hermes Workbench semantic/search still has the known missing `workbench-current.json` defect; the product task did not bypass or repair it.
- `finalize_report_metadata` had the previously known `replaceReportPlaceholders` defect during 001E; 001F finalization should use the normal validator/manual bounded report flow if it recurs.

## Final verdict

**PASS**

`LAB-WORK-PATIENT-SURFACE-001F` is ready for a report-only final commit, fresh CI, independent PR scope review, merge on CLEAN/SUCCESS, origin/main verification and FREEZE.

## Recommended next task

**LAB-WORK-PATIENT-REFERENCES-RECON-001G — report-only reconnaissance for enriching patient laboratory orders with human-readable responsible doctor, laboratory and work-type labels without raw UUIDs, N+1 reads, mutation-capable UI access, or new backend duplication.**
