# LAB-WORK-NEXT-RECON-001E — Next Laboratory Work Step Recon

## Summary

Report-only HERMES STUDY/RECON performed against current DentalFlow `origin/main`, the merged laboratory sequence 001A–001D, the MacDent laboratory-domain reconnaissance, and the current patient-card composition.

The smallest safe next product step is a **read-only patient-card Laboratory tab** that consumes the already frozen `usePatientLaboratoryWorkOrders(patientId)` hook. It must not call `useLaboratoryWorkRepository` directly, expose repository mutations, create a second backend, or add laboratory create/update/delete controls.

Final verdict: **PASS**

Implementation readiness decision: **READY** for `LAB-WORK-PATIENT-SURFACE-001F`.

## Branch

`recon/lab-work-next-001e`

## PR URL

Pending until this report-only branch is pushed.

- Base branch: `main`.
- Verified `origin/main`: `21cd3f394d9b1b67e9c4496ee1c40b1276afffcb`.
- Baseline includes merged PR #370 / `LAB-WORK-PATIENT-READ-001D`.
- Report update commit: N/A until finalization receipt.

## Changed files summary

This report-only task changes exactly one repository file:

`_ai_work/REPORTS/LAB-WORK-NEXT-RECON-001E_next_step.md`

No `src/*`, migration, seed, package, lockfile, environment, helper-script or screenshot files belong in this PR.

## 1. Scope and safety

This task is RECON/report-only.

```text
APP CODE CHANGES: 0
MIGRATIONS: 0
CLOUD SUPABASE WRITES: 0
MACDENT WRITES: 0
AMOCRM WRITES: 0
BROWSER MUTATIONS: 0
FINANCE/WAREHOUSE/TREATMENT/COMPLETED-SERVICE CHANGES: 0
```

The Hermes Workbench semantic/search helper remains unavailable because `D:\hermes\memory\workbench-current.json` is missing. This is an existing bridge/workbench defect, not a DentalFlow repository failure. Recon therefore used the live Git checkout and bounded read-only Hermes file/terminal inspection without bypassing task safety.

## 2. Current laboratory foundation

The current main already contains the full safe foundation sequence:

1. `LAB-WORK-FOUNDATION-001A` — tenant-scoped schema for laboratories, work types, orders and order/type relations.
2. `LAB-WORK-REPOSITORY-001B` — typed tenant-aware local/Supabase repository; no entity hard-delete API.
3. `LAB-WORK-DATA-WIRING-001C` — auth/tenant-aware backend selection with fail-closed production behavior and no silent local fallback.
4. `LAB-WORK-PATIENT-READ-001D` — smallest patient-scoped read hook.

The accepted 001D semantic flow is:

```text
patientId
→ useLaboratoryWorkRepository()
→ accepted 001C auth/tenant/backend selection
→ repository.listOrders({ patientId })
→ LaboratoryWorkOrderRecord[]
```

The public 001D hook exposes only:

```text
orders
isLoading
isError
error
refetch
```

It does not expose repository mutation methods.

## 3. Current patient-card composition

`src/pages/PatientCardPage.tsx` is already organized around separate tab components rather than placing each domain implementation directly inside the page.

Current tabs include:

- Overview;
- Communications;
- Timeline/history;
- Visits;
- Encounters;
- Completed services;
- Dental chart;
- Findings/risks;
- Treatment plan;
- Finance;
- Documents;
- Summary placeholder.

Relevant implementation pattern:

```text
PatientCardPage
→ tab selector
→ dedicated domain component with patient.id
```

Examples already following this pattern include `PatientHistoryTab`, `VisitCheckInPanel`, `ClinicalEncounterPanel`, `CompletedServicesPanel`, `PatientFinancePanel`, `DentalChartTab`, `FindingsRisksTab` and `TreatmentPlansTab`.

Therefore a laboratory patient surface can be added without turning `PatientCardPage` into a new God Component, provided the rendering stays in its own component.

## 4. What 001D can render safely today

`LaboratoryWorkOrderRecord` already provides human-meaningful patient-level fields that can be rendered without another repository/backend:

- order number;
- title/work name;
- status (`in_progress` / `completed`);
- sent-to-lab timestamp;
- planned-ready timestamp;
- received-from-lab timestamp;
- try-in timestamp;
- delivered-to-patient timestamp;
- shade;
- anatomical scope;
- selected FDI teeth;
- comment;
- created/updated timestamps.

These are sufficient for a useful first read-only patient view.

## 5. What must NOT be rendered as raw identifiers

The order record also contains:

```text
responsibleDoctorId
laboratoryId
```

and work-type membership is represented separately.

A patient-facing staff UI must **not** display raw UUIDs as doctor/laboratory names. That would technically expose data while failing the actual user task.

The first patient surface should therefore omit unresolved doctor/laboratory/work-type labels rather than render identifiers.

Later bounded read-model/reference tasks may resolve:

- responsible doctor name;
- laboratory name;
- laboratory work-type labels.

This is preferable to making the UI call the full mutation-capable repository directly.

## 6. Options considered

### Option A — read-only patient Laboratory tab using 001D

Scope:

- dedicated `PatientLaboratoryWorkTab` component;
- add `Лаборатория` tab to `PatientCardPage`;
- consume `usePatientLaboratoryWorkOrders(patientId)` only;
- loading/error/empty/order states;
- render human-readable order/status/milestone/specification fields;
- no raw UUID labels;
- no mutations.

Advantages:

- smallest scope;
- immediately uses the frozen 001D boundary;
- proves the canonical lab order can appear in patient context;
- no new repository or schema work;
- no finance/warehouse/treatment coupling;
- easy to test and browser-smoke independently.

Verdict: **RECOMMENDED**.

### Option B — reference/read-model enrichment before any UI

Possible future hook/read model could resolve laboratory names, work types and doctor labels.

Advantages:

- richer first UI.

Disadvantages:

- larger data orchestration task;
- work-type membership can create N+1 reads unless deliberately designed;
- doctor resolution adds another repository/domain dependency;
- delays the smallest already-safe patient surface.

Verdict: useful **after** the first read-only surface or when richer labels become required.

### Option C — top-level Laboratory operations queue

MacDent evidence supports a clinic-wide operational queue as an important final workflow.

However a useful queue needs more than current 001D:

- all-patient order listing;
- patient names;
- doctor names;
- laboratory names;
- filters;
- planned-ready/overdue presentation;
- route/sidebar integration;
- eventually create/edit actions.

Verdict: **NOT the next smallest task**.

### Option D — create/edit laboratory work UI now

Rejected as the immediate next step.

Although repository mutations exist, a product write surface should be introduced through a separately bounded mutation/action contract with explicit role/audit/error behavior and real browser QA. It must not be smuggled into the first patient tab.

Verdict: **DEFER**.

## 7. Recommended semantic contract for 001F

Task: `LAB-WORK-PATIENT-SURFACE-001F`.

```text
PatientCardPage(patient.id)
→ Laboratory tab selected
→ PatientLaboratoryWorkTab(patientId, timezone)
→ usePatientLaboratoryWorkOrders(patientId)
→ read-only orders
→ display safe human-readable operational facts
```

Required invariants:

1. READ ONLY.
2. Consume `usePatientLaboratoryWorkOrders`; do not instantiate/use the laboratory repository in the UI component.
3. No create/update/delete/status-change/work-type mutation controls.
4. No silent local fallback beyond the already accepted 001C contract.
5. No raw `responsibleDoctorId` or `laboratoryId` presented as labels.
6. No finance/payment fields.
7. No warehouse/material fields.
8. No treatment-plan/completed-service coupling.
9. No MacDent/amoCRM calls or writes.
10. No migration/seed/package/lockfile changes.
11. Keep laboratory rendering in a dedicated component; `PatientCardPage` receives only tab wiring.
12. Use tenant timezone formatting for timestamps.
13. Patient A/B changes must remain isolated through the frozen 001D query identity.

## 8. Minimum visible fields for 001F

Per order, render only values that are already semantically complete:

- title;
- optional order number;
- status label;
- planned-ready date;
- sent date if present;
- received date if present;
- try-in date if present;
- delivered date if present;
- shade if present;
- anatomical scope / selected teeth if present;
- comment if present.

Recommended Russian labels:

```text
in_progress → В работе
completed   → Завершена
upper_jaw   → Верхняя челюсть
lower_jaw   → Нижняя челюсть
oral_cavity → Полость рта
selected_teeth → Выбранные зубы
```

No invented remake/cancelled/paid states.

## 9. UI states required

The component must define four deterministic states:

1. Loading: laboratory works are loading.
2. Error: safe error text plus `Повторить` using the read hook's `refetch`.
3. Empty: patient has no laboratory works.
4. Data: one or more read-only order cards/rows.

No edit affordance belongs in this task.

## 10. Test requirements for 001F

Targeted unit/component tests must prove at minimum:

- patient ID is forwarded to the frozen read hook;
- loading state;
- error state and retry calls `refetch`;
- empty state;
- in-progress and completed labels;
- milestone timestamps are rendered in tenant timezone;
- anatomy/selected teeth rendering;
- optional values do not produce misleading placeholders;
- raw doctor/laboratory UUID values are not displayed;
- no create/edit/delete controls are present;
- `PatientCardPage` contains a `Лаборатория` tab;
- clicking it renders the dedicated lab component with the current patient ID.

Full lint/test/build and `git diff --check` remain mandatory.

## 11. Browser QA requirement for 001F

Because 001F is a visible UI task, real localhost browser smoke is mandatory after implementation.

Use only synthetic/local DentalFlow QA data. No MacDent or amoCRM production records may be created or changed.

Minimum smoke:

1. start a fresh local app from the 001F worktree;
2. use local Supabase/dev QA environment only;
3. open a synthetic patient's card;
4. select `Лаборатория`;
5. verify one synthetic order is visible;
6. verify status and at least one milestone/specification field;
7. verify there are no create/edit/delete controls;
8. inspect console for errors;
9. verify refresh keeps the read result;
10. clean synthetic QA rows if local SQL fixture data was created.

A simulated browser result is not acceptable.

## 12. Files expected for 001F

Likely bounded implementation scope:

```text
src/components/patients/patient-card/PatientLaboratoryWorkTab.tsx
src/components/patients/patient-card/PatientLaboratoryWorkTab.test.tsx
src/pages/PatientCardPage.tsx
src/pages/PatientCardPage.test.tsx
_ai_work/REPORTS/LAB-WORK-PATIENT-SURFACE-001F_patient_surface.md
```

Do not change `LaboratoryWorkRepository.ts`, migration `0035`, finance, warehouse, treatment, completed-service, amoCRM or MacDent integration code in 001F.

## 13. Findings outside scope

Recon noticed pre-existing patient-card oddities unrelated to laboratory work:

- `summary` exists in the tab list but has no corresponding render branch in the inspected page;
- a `files` render branch exists while `files` is not present in the inspected `TABS` list.

Do **not** fix these in 001F. They require a separate patient-card cleanup task if desired. This recon records them only to prevent an agent from using the laboratory task as an excuse for unrelated cleanup.

## Checks

- Current `origin/main` verified at `21cd3f394d9b1b67e9c4496ee1c40b1276afffcb`.
- Current patient-card composition inspected.
- Merged MacDent laboratory recon inspected.
- Merged laboratory repository report inspected.
- Merged 001D patient-read report inspected.
- Schema/RLS foundation `0035` inspected.
- Application code changed: **NO**.

## Final verdict

```text
RECON: PASS
PATIENT READ FOUNDATION: READY
PATIENT CARD MODULAR INSERTION POINT: READY
DIRECT REPOSITORY USE FROM UI: NOT RECOMMENDED
RAW REFERENCE UUID DISPLAY: FORBIDDEN
TOP-LEVEL LAB QUEUE: DEFER
LAB MUTATIONS: DEFER TO SEPARATE CONTRACT
FINANCE/WAREHOUSE/TREATMENT COUPLING: DEFER
NEXT TASK: LAB-WORK-PATIENT-SURFACE-001F
```

## Recommended next task

**LAB-WORK-PATIENT-SURFACE-001F — add a dedicated read-only `Лаборатория` tab to the patient card using only `usePatientLaboratoryWorkOrders`, with component/page tests and mandatory real localhost browser smoke. No mutations, no raw reference UUID labels, no migrations, no finance/warehouse/treatment/completed-service coupling, no MacDent or amoCRM writes.**
