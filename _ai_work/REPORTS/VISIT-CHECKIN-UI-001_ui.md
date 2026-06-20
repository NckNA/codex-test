# VISIT-CHECKIN-UI-001 — Visit check-in lifecycle UI

## Summary
Implemented the first patient visit lifecycle UI layer in the patient card. The UI adds a dedicated `Визиты` tab, reads patient visits through `EncounterVisitRepository`, and sends visit lifecycle mutations through `EncounterVisitRpcClient` only.

Final verdict: **PASS**

Reason: implementation, unit tests, lint, full test suite, build, GitHub CI, and the complete local Supabase role-based lifecycle smoke all passed. The smoke covered real check-in/start/complete/cancel RPC writes, role and tenant boundaries, audit/activity creation, and verified cleanup. No cloud Supabase was touched.

## Branch
`feature/visit-checkin-ui-001`

## PR URL
https://github.com/NckNA/codex-test/pull/315

## PR head reviewed before final report update
`990699bedbdd7578c1374046af4d4587d208aec9`

## Report update commit
N/A — the final report update commit cannot reference itself before creation.

## Changed files summary

UI:
- `src/components/visits/VisitCheckInPanel.tsx`
- `src/components/visits/VisitLifecycleActions.tsx`
- `src/components/visits/VisitStatusBadge.tsx`
- `src/components/visits/visitLabels.ts`
- `src/components/visits/visitPermissions.ts`

Hooks:
- `src/data/hooks/usePatientVisits.ts`
- `src/data/hooks/useVisitLifecycleActions.ts`

Page integration:
- `src/pages/PatientCardPage.tsx`
- `src/pages/LoginPage.tsx` (stable local QA login selector only)

Tests:
- `src/components/visits/VisitCheckInPanel.test.tsx`
- `src/data/hooks/usePatientVisits.test.tsx`
- `src/data/hooks/useVisitLifecycleActions.test.tsx`

Report:
- `_ai_work/REPORTS/VISIT-CHECKIN-UI-001_ui.md`

## Current UI/data recon

### Patient page structure
`PatientCardPage` uses tab state with existing patient sections. The task adds a new `Визиты` tab between `История приёмов` and `Зубная карта`.

### Tenant/patient context
- `patientId` is read from route params in `PatientCardPage`.
- active tenant and role come from `TenantContext`.
- visit actions are blocked when tenant or patient is missing.

### Role/permission pattern
Role gating is implemented as UI convenience in `visitPermissions.ts`:
- `clinic_owner` / `clinic_admin`: check in, start, complete, cancel.
- `doctor`: check in, start, complete, cancel.
- `registrar`: check in, start, cancel; no complete button.
- `cashier`: read-only/no mutation actions.
- no tenant: blocked state.

RPC remains the source of truth for permission enforcement.

### Repository/RPC client pattern
- Reads use `EncounterVisitRepository.listPatientVisits` through `usePatientVisits`.
- Writes use `EncounterVisitRpcClient` through `useVisitLifecycleActions`.
- Components receive injectable repository/client dependencies for tests but default to Supabase-backed factories in runtime.

### Test pattern
Tests follow the existing Vitest + React DOM `createRoot` + `act` style already present in the project.

## Implementation summary

### Components
- `VisitCheckInPanel` renders the visit section, check-in form, visit list, status/timestamps, empty/loading/error states, and role-gated actions.
- `VisitLifecycleActions` renders start/complete/cancel buttons for eligible visit statuses.
- `VisitStatusBadge` renders Russian status labels.

### Hooks
- `usePatientVisits` fetches visit rows only when `tenantId` and `patientId` are present.
- `useVisitLifecycleActions` wraps check-in/start/complete/cancel RPC client calls and refreshes the visit list after success.

### Patient page integration
`PatientCardPage` now renders `VisitCheckInPanel` in the new `Визиты` tab and passes `tenantId`, `patientId`, and current role.

### Error handling
Safe Russian UI messages are used for no tenant, missing patient, permission denial, invalid transition, and update failures. Raw database objects are not rendered.

## Domain boundary
Preserved:
- appointment = scheduled slot / booking intent.
- patient_visit = actual patient attendance instance.
- visit status = attendance workflow.
- clinical_encounter UI is not implemented.
- completed_service UI is not implemented.
- completing a visit does not create a completed service.
- payment, stock, documents, and timeline integration are not touched.

## Data/write boundary
- Reads go through `EncounterVisitRepository`.
- Writes go through `EncounterVisitRpcClient`.
- No direct table writes were added in UI/hooks.
- No raw `supabase.rpc` calls were added to UI components.
- No `service_role` usage was added.
- No `localStorage` fallback was added.

Static scan of new visit UI/hooks found no `localStorage`, `service_role`, `.from(...).insert/update/delete`, `createClinicalEncounter`, or `recordCompletedService` usage.

## Role behavior
- Owner/admin can see all lifecycle buttons.
- Doctor can see check-in/start/complete/cancel buttons.
- Registrar can see check-in/start/cancel, but not complete.
- Cashier sees no mutation actions.
- No-tenant state shows safe blocked UI.
- Cross-tenant leakage is left to tenant context + repository/RLS boundaries; no manual bypass was added.

## Unit tests

Added tests cover:
- no fetch without tenantId/patientId;
- repository-backed visit fetch;
- repository error surfacing;
- refresh behavior;
- check-in/start/complete/cancel RPC calls;
- successful action refresh;
- cancel reason requirement;
- safe permission error mapping;
- no clinical encounter/completed service RPC calls from lifecycle actions;
- loading/empty/list UI;
- checked-in/in-progress/completed/cancelled button visibility;
- registrar/cashier role visibility;
- no-tenant blocked state;
- check-in form RPC call;
- cancel reason UI validation.

Targeted visit tests: `3 passed / 22 tests passed`.

Full suite: `52 passed / 490 tests passed`.

Known test-suite warning: existing React `act(...)` warning noise appears in stderr across existing tests and the new tests, but Vitest exits successfully.

## Browser smoke

### Prototype/no-Supabase UI smoke
- Started Vite locally on `http://127.0.0.1:5174`.
- `/patients` loaded successfully.
- `/patients/p1` loaded successfully.
- Patient card displayed the new `Визиты` tab.
- Clicking the `Визиты` tab rendered the new visit panel.
- No fatal console errors.
- No visible `service_role` / service-role key markers.
- Since Supabase env was not configured in that app process, the panel correctly surfaced a safe configuration error instead of crashing.

### Full local Supabase lifecycle smoke
- Started a dedicated Supabase-configured Vite process on `http://127.0.0.1:5175` with credentials injected only through the process environment.
- Created one task-scoped local patient and exercised the real UI and visit RPCs in six isolated browser sessions.
- `clinic_admin`: check-in -> start -> complete passed.
- `doctor`: check-in -> start -> complete passed.
- `registrar`: check-in -> cancel passed; complete control was absent.
- `cashier`: visit history was readable; all mutation controls were absent.
- no-tenant user: Tenant A patient visit panel was blocked.
- Tenant B admin: cross-tenant access to the Tenant A patient visit panel was blocked.
- Database verification before cleanup: `2` completed visits, `1` cancelled visit, `8` audit events, and `8` activity events.
- Screenshots were saved under `D:\hermes\reports\visit-lifecycle-smoke`.

### Cleanup
Cleanup ran in a `finally` block and removed exactly `8` activity events, `8` audit events, `3` patient visits, and `1` task-created patient. Post-cleanup verification returned `0` remaining task rows.

## What was intentionally NOT changed
- No migrations.
- No Supabase cloud access.
- No clinical encounter UI.
- No completed services UI.
- No timeline integration.
- No payments.
- No stock.
- No documents.
- No seed/backfill changes.
- No appointment status side effects.
- No PatientTimelineAggregator changes.

## Checks

- `npm run lint`: passed.
- `npm run test`: passed, 52 files / 490 tests.
- targeted visit tests: passed, 3 files / 22 tests.
- `npm run build`: passed.
- `git diff --check`: passed.
- GitHub Actions CI: passed, run `27864786601` / `CI #575`, tested commit `990699bedbdd7578c1374046af4d4587d208aec9`.
- Super Hermes lifecycle smoke: passed, 6/6 role and tenant scenarios; cleanup verified at zero remaining rows.

## Issues / warnings

1. Existing Vitest stderr contains React `act(...)` warning noise; tests still pass.
2. Vite build reports the existing large chunk warning.
3. The existing prototype-mode banner is still visible in the Supabase-configured browser view; it is outside this visit UI task and does not affect the verified repository/RPC behavior.

## Final verdict
**PASS:** visit UI, role controls, real local Supabase lifecycle writes, RLS/tenant boundaries, audit/activity side effects, cleanup, unit tests, build, and GitHub CI are verified.

## Recommended next task
**ENCOUNTER-CLINICAL-NOTES-UI-001** — add the first clinical notes/encounter UI layer for a patient visit, scoped to the clinical encounter model created in ENCOUNTER-VISIT-MODEL-001A.

<!-- SUPER_HERMES_METADATA:START -->
## Final Report Metadata

- PR: https://github.com/NckNA/codex-test/pull/315
- PR number: 315
- Branch: feature/visit-checkin-ui-001
- Base branch: main
- Implementation/reviewed HEAD: 990699bedbdd7578c1374046af4d4587d208aec9
- Local HEAD at finalization: 990699bedbdd7578c1374046af4d4587d208aec9
- Latest CI run ID: 27864786601
- Latest CI number: 575
- Latest CI conclusion: SUCCESS
- CI tested commit: 990699bedbdd7578c1374046af4d4587d208aec9
- Latest green CI run ID: 27864786601
- Latest green CI number: 575
- Latest green CI tested commit: 990699bedbdd7578c1374046af4d4587d208aec9

### Checks

| Check | Workflow | Status | Conclusion | Run | Tested commit |
| --- | --- | --- | --- | --- | --- |
| validate | CI | COMPLETED | SUCCESS | 27864786601 | 990699bedbdd7578c1374046af4d4587d208aec9 |

> A report-only commit cannot contain its own SHA or future CI result. After commit/push, Super Hermes stores those final values in an immutable local finalization receipt.
<!-- SUPER_HERMES_METADATA:END -->
