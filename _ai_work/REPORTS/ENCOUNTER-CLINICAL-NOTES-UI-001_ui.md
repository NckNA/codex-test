# ENCOUNTER-CLINICAL-NOTES-UI-001 — Clinical encounter notes UI

## 1. Summary

Implemented the first patient-card UI layer for clinical encounters / doctor notes.

The implementation adds a dedicated patient card tab named **Приёмы** with:

- clinical encounter list;
- draft encounter creation;
- start encounter action;
- complete encounter action with clinical summary;
- Russian status/type labels;
- role-based visibility;
- safe no-tenant/no-patient states;
- read path through `EncounterVisitRepository`;
- write path through `EncounterVisitRpcClient`.

This task keeps the domain boundary explicit: a visit is patient attendance, a clinical encounter is doctor documentation, and completed services/payments/stock/documents remain separate future facts.

## 2. Branch

`feature/encounter-clinical-notes-ui-001`

## 3. PR URL

https://github.com/NckNA/codex-test/pull/316

## 4. PR head reviewed before final report update

PR head reviewed before final report update: `d37c3657d5d21352c201e9ae8fa06ad9f69ff158`.

## 5. Report update commit

Report update commit: N/A because the final report update commit cannot reference itself before creation.

## 6. Changed files summary

Implemented files:

- `src/components/encounters/ClinicalEncounterPanel.tsx`
- `src/components/encounters/ClinicalEncounterActions.tsx`
- `src/components/encounters/ClinicalEncounterStatusBadge.tsx`
- `src/components/encounters/encounterLabels.ts`
- `src/components/encounters/encounterPermissions.ts`
- `src/data/hooks/useClinicalEncounters.ts`
- `src/data/hooks/useClinicalEncounterActions.ts`
- `src/pages/PatientCardPage.tsx`

Test files:

- `src/components/encounters/ClinicalEncounterPanel.test.tsx`
- `src/data/hooks/useClinicalEncounters.test.tsx`
- `src/data/hooks/useClinicalEncounterActions.test.tsx`

Report:

- `_ai_work/REPORTS/ENCOUNTER-CLINICAL-NOTES-UI-001_ui.md`

## 7. Current UI/data recon

### Patient page structure

`PatientCardPage` uses a tab list in `TABS` and renders tab-specific panels below the patient header.

The previous visit work added the `visits` tab and `VisitCheckInPanel`.

This task adds a new separate `encounters` tab with the Russian label **Приёмы**. This avoids mixing clinical documentation into the visit attendance panel.

### Tenant/patient context

- `patientId` is read from the route through `useParams`.
- active tenant/role comes from `TenantContext` through `useTenant`.
- `ClinicalEncounterPanel` receives:
  - `tenantId={activeTenant?.tenantId}`
  - `patientId={patient.id}`
  - `role={activeTenant?.role}`

### Visit UI pattern reused

The clinical encounter UI follows the existing visit UI structure:

- isolated component folder;
- labels utility;
- permission utility;
- hook for list/read;
- hook for lifecycle writes;
- component tests with dependency injection.

### Repository/RPC client pattern

Reads use:

- `EncounterVisitRepository.listClinicalEncounters`

Writes use:

- `EncounterVisitRpcClient.createClinicalEncounter`
- `EncounterVisitRpcClient.startClinicalEncounter`
- `EncounterVisitRpcClient.completeClinicalEncounter`

### Test pattern

Tests follow the existing lightweight jsdom + React root style used by the visit UI tests.

## 8. Implementation summary

### Components

`ClinicalEncounterPanel` renders:

- create draft form;
- encounter type selector;
- chief complaint / reason field;
- optional initial clinical summary;
- encounter list;
- safe loading/error/empty states;
- clinical status/type display;
- timestamps;
- doctor id and linked visit id when available.

`ClinicalEncounterActions` renders:

- **Начать приём** for draft encounters;
- **Завершить приём** for draft/in-progress encounters;
- required clinical summary textarea before completion;
- no actions for completed/locked/archived encounters.

`ClinicalEncounterStatusBadge` renders compact Russian status labels.

### Hooks

`useClinicalEncounters`:

- does not fetch without tenantId;
- does not fetch without patientId;
- uses `EncounterVisitRepository.listClinicalEncounters`;
- exposes encounters, loading/error states, and refresh.

`useClinicalEncounterActions`:

- uses `EncounterVisitRpcClient`;
- supports create/start/complete;
- refreshes after successful mutations;
- does not use localStorage;
- does not call raw Supabase RPCs from UI components.

### Patient page integration

Added a separate patient-card tab:

- id: `encounters`
- label: `Приёмы`
- test id: `patient-encounters-tab`

The tab renders `ClinicalEncounterPanel` only; it does not alter patient timeline, dental chart, findings, plan, finance, documents, or files tabs.

### Role gating

Implemented in `encounterPermissions.ts`.

- `clinic_owner`, `clinic_admin`, `doctor`: can view/create/start/complete.
- `registrar`, `cashier`: read-only UI, no clinical mutation controls.
- no role / unknown role: no clinical access controls.

RPC/RLS remains the source of truth. UI role hiding is only convenience.

### Error handling

UI displays safe Russian messages for:

- missing clinic;
- missing patient;
- insufficient permission;
- invalid status/transition;
- generic update failure;
- missing chief complaint on create.

Raw database error objects are not rendered into the UI.

## 9. Domain boundary

This task preserves the clinical workflow boundaries:

- `patient_visit` = actual patient attendance instance;
- `clinical_encounter` = doctor documentation session;
- `completed_service` = future performed/billable fact;
- payment/stock/documents = future separate modules.

Completing a clinical encounter does **not**:

- create completed service rows;
- create payments;
- write stock/material movements;
- change treatment plan/stage;
- update patient timeline;
- create documents.

## 10. Data/write boundary

Read boundary:

- clinical encounters are loaded through `EncounterVisitRepository.listClinicalEncounters`.

Write boundary:

- create/start/complete are executed through `EncounterVisitRpcClient`.

Explicitly not used:

- direct table writes from UI/hooks;
- raw `supabase.rpc` calls from UI components;
- service role;
- localStorage fallback;
- Supabase cloud.

## 11. Role behavior

### Owner/admin

Can view, create, start, and complete clinical encounters.

### Doctor

Can view, create, start, and complete clinical encounters.

### Registrar

Can view the read-only clinical encounter area but does not see create/start/complete controls.

### Cashier

Can view the read-only clinical encounter area but does not see mutation controls.

### No tenant

Shows safe blocked state and does not fetch data.

### Cross-tenant

No bypass was introduced. Tenant context and existing RLS/repository boundaries remain responsible for isolation.

## 12. Unit tests

Added tests:

- `src/data/hooks/useClinicalEncounters.test.tsx`
- `src/data/hooks/useClinicalEncounterActions.test.tsx`
- `src/components/encounters/ClinicalEncounterPanel.test.tsx`

Covered scenarios:

- no fetch without tenantId;
- no fetch without patientId;
- list uses repository;
- repository errors surface;
- refresh reloads encounters;
- create uses `EncounterVisitRpcClient.createClinicalEncounter`;
- start uses `startClinicalEncounter`;
- complete uses `completeClinicalEncounter`;
- successful action refreshes;
- failed action surfaces safe error;
- complete requires summary;
- no-tenant blocked state;
- empty state;
- status/timestamp rendering;
- draft actions;
- in-progress complete action;
- completed encounter hides mutation controls;
- registrar/cashier no mutation controls;
- create form validation;
- no adjacent payment/stock/document UI labels.

Targeted result:

- 3 files passed;
- 21 tests passed.

Full test result:

- 55 files passed;
- 511 tests passed.

Known warning noise:

- existing jsdom/React `act(...)` warning noise remains in several UI tests, including existing dental/visit tests. It does not fail the suite.

## 13. Browser smoke

### Environment

- `clinical_encounter_lifecycle_smoke_run` detected local Supabase and rejected all cloud access.
- It refreshed the guarded local QA users, selected a free port, and started a fresh Vite process from `feature/encounter-clinical-notes-ui-001`.
- Tested implementation head: `c6db8c336c45bec26e609ad4f08e0b4a01040a20`.
- The temporary app process was stopped by the runner after verification.

### Browser validation results

Six isolated role and tenant scenarios passed:

- `clinic_admin`: create draft -> start -> complete with exact persisted clinical summary.
- `doctor`: create draft -> start -> complete with exact persisted clinical summary.
- `registrar`: encounter history visible; create/start/complete controls absent.
- `cashier`: encounter history visible; create/start/complete controls absent.
- no-tenant user: Tenant A encounter panel blocked.
- Tenant B admin: cross-tenant access to the Tenant A encounter panel blocked.

Database evidence before cleanup:

- completed encounters: `2`;
- completed services: `0`;
- documents: `0`;
- payments: `0` (no payment table in the current schema);
- stock movements: `0` (no stock movement table in the current schema);
- audit events: `6`;
- activity events: `6`.

Visual inspection also found and fixed a damaged tab label (`??????` -> `Приёмы`). A regression test now verifies the exact visible label.

Screenshots are stored under `D:\hermes\reports\clinical-encounter-lifecycle-smoke-after-label-fix`.

### Cleanup

Cleanup ran in a `finally` block and deleted exactly `6` activity events, `6` audit events, `2` clinical encounters, and `1` smoke patient. Completed services, documents, visits, payments, and stock rows remained zero. Post-cleanup verification returned `0` remaining related rows.

### Browser smoke verdict

PASS.

## 14. What was intentionally NOT changed

No changes were made to:

- migrations;
- Supabase cloud;
- RLS/grants;
- seed.sql;
- completed service UI;
- payments;
- stock;
- documents;
- timeline integration;
- `PatientTimelineAggregator`;
- treatment plan/stage behavior;
- completed service/payment/stock/document modules.

## 15. Checks

Local checks:

- `npm run lint`: PASSED
- targeted clinical encounter tests: PASSED, 21 tests
- `npm run test -- --run`: PASSED, 55 files / 512 tests
- `npm run build`: PASSED

Build warning:

- Vite chunk size warning remains existing/non-blocking.

Browser/smoke:

- schema-valid fixture creation with `patients.source=walk_in`: PASSED;
- full clinical encounter lifecycle browser smoke: PASSED, 6/6 scenarios;
- side-effect boundary checks: PASSED, completed services/documents/payments/stock all zero;
- cleanup: PASSED, zero remaining rows;
- React `act(...)` warning scan: PASSED, no warnings emitted by the current 512-test run.

GitHub Actions CI:

- CI #581: success
- Tested commit: `c6db8c336c45bec26e609ad4f08e0b4a01040a20`

## Issues / warnings

1. Vite still reports the existing non-blocking large chunk warning.
2. The existing prototype-mode banner remains visible in the Supabase-configured app; it is outside this clinical encounter task.
3. Hook-level errors are intentionally normalized and UI displays safe Russian messages.

## Final verdict

Final verdict: **ENCOUNTER CLINICAL NOTES UI IMPLEMENTED AND VERIFIED**

Reason: clinical encounter UI, hooks, patient page integration, role and tenant boundaries, real local create/start/complete RPC writes, summary persistence, absence of adjacent service/document/payment/stock facts, audit/activity side effects, cleanup, tests, build, and CI are verified.

## Recommended next task

COMPLETED-SERVICES-UI-001

<!-- SUPER_HERMES_METADATA:START -->
## Final Report Metadata

- PR: https://github.com/NckNA/codex-test/pull/316
- PR number: 316
- Branch: feature/encounter-clinical-notes-ui-001
- Base branch: main
- Implementation/reviewed HEAD: d37c3657d5d21352c201e9ae8fa06ad9f69ff158
- Local HEAD at finalization: d37c3657d5d21352c201e9ae8fa06ad9f69ff158
- Latest CI run ID: 27868683144
- Latest CI number: 583
- Latest CI conclusion: SUCCESS
- CI tested commit: d37c3657d5d21352c201e9ae8fa06ad9f69ff158
- Latest green CI run ID: 27868683144
- Latest green CI number: 583
- Latest green CI tested commit: d37c3657d5d21352c201e9ae8fa06ad9f69ff158

### Checks

| Check | Workflow | Status | Conclusion | Run | Tested commit |
| --- | --- | --- | --- | --- | --- |
| validate | CI | COMPLETED | SUCCESS | 27868683144 | d37c3657d5d21352c201e9ae8fa06ad9f69ff158 |

> A report-only commit cannot contain its own SHA or future CI result. After commit/push, Super Hermes stores those final values in an immutable local finalization receipt.
<!-- SUPER_HERMES_METADATA:END -->
