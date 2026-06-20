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

Will be recorded by the final metadata block after PR creation.

## 4. PR head reviewed before final report update

Will be recorded by the final metadata block after PR creation.

## 5. Report update commit

N/A before final report metadata commit.

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

- Local Supabase detected and reachable.
- Local DB URL is local-only.
- Cloud Supabase was not touched.
- Active migration count: 15.
- Latest migration: `0015_create_encounter_visit_rpc.sql`.

### Smoke setup attempted

A deterministic local smoke patient was created with:

- patient id: `22222222-3333-4444-5555-666666666666`
- tenant: Demo Clinic A
- source: `walk_in`
- marker in integration JSON: `ENCOUNTER-CLINICAL-NOTES-UI-001`

Initial attempt with source `smoke` correctly failed due local `patients_source_check`. Retried with allowed source `walk_in`.

### Browser validation results

Partial browser validation succeeded:

- QA shortcut was visible on `http://localhost:5174/login`.
- Admin A login succeeded.
- Smoke patient page loaded.
- Smoke patient name was visible.
- Screenshot captured:
  - `D:\hermes\reports\encounter-clinical-notes-smoke\debug-5174-patient-with-row.png`

Full clinical encounter lifecycle browser flow did **not** complete in this run.

Observed blockers:

1. `http://localhost:5173` did not expose the QA login shortcut.
2. `http://localhost:5174` exposed QA login and loaded the patient, but the running dev server did not expose the newly added `patient-tab-encounters` selector, likely because that server was still running an older bundle.
3. A fresh Vite dev server started on `http://127.0.0.1:5180`, but browser text extraction on `/login` returned an empty app shell, preventing reliable role smoke on the fresh port.

### Cleanup

Smoke rows were cleaned manually after the partial smoke attempt.

Final cleanup counts:

- `clinical_encounters`: 0
- `audit_events`: 0
- `activity_events`: 0
- `patients`: 0 for the smoke patient id

### Browser smoke verdict

PARTIAL.

The UI has unit/build coverage and partial browser rendering/auth validation, but the full create/start/complete clinical encounter lifecycle through the current UI was not completed because the available dev server with QA auth did not serve the new tab and the fresh dev server did not render usable login content.

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
- `npm run test -- --run`: PASSED, 55 files / 511 tests
- `npm run build`: PASSED

Build warning:

- Vite chunk size warning remains existing/non-blocking.

Browser/smoke:

- local SQL setup and cleanup: PASSED after using valid patient source;
- Admin A login and smoke patient page render on existing QA dev server: PASSED;
- full clinical encounter lifecycle browser smoke: PARTIAL / not completed.

GitHub Actions CI:

- To be filled after PR creation.

## 16. Issues / warnings

1. Full browser lifecycle smoke is incomplete.
2. Available QA dev server on port 5174 appears stale for the newly added encounter tab.
3. Fresh dev server on port 5180 served an empty app shell in browser text extraction.
4. UI test suite has existing React `act(...)` warning noise, but tests pass.
5. Hook-level errors are intentionally normalized and UI displays safe Russian messages.

## 17. Final verdict

PARTIAL with exact missing validation:

Clinical encounter UI, hooks, patient page integration, unit tests, lint, full test suite, and build are complete. Full local browser lifecycle smoke for create/start/complete clinical encounter through the current UI is not completed.

## 18. Recommended next task

ENCOUNTER-CLINICAL-NOTES-UI-001B-LOCAL-SMOKE
