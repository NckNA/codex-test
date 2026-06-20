# COMPLETED-SERVICES-UI-001 — Completed services UI

## Summary
Added the first completed/performed services UI layer to the patient card. The implementation keeps completed services separate from visits, clinical encounters, treatment plans, payments, stock, documents, and timeline events.

## Branch
feature/completed-services-ui-001

## PR
Pending PR creation.

## PR head reviewed before final report update
Pending PR creation.

## Changed files summary
- Added completed services UI components under `src/components/services/`.
- Added completed services hooks under `src/data/hooks/`.
- Added a new `Услуги` tab in `src/pages/PatientCardPage.tsx`.
- Added unit tests for hooks and panel.

## Current UI/data recon
- Patient card already had `Визиты` and `Приёмы` tabs.
- This task adds a separate `Услуги` tab to preserve domain boundaries.
- Patient and tenant context are passed from `PatientCardPage` into the panel.
- Existing visit and clinical encounter UI patterns were reused: hooks, action state, role capabilities, status badges, Russian UI labels, loading/error/empty states.
- Completed services read path exists in `EncounterVisitRepository.listCompletedServices`.
- Completed services write paths exist in `EncounterVisitRpcClient.recordCompletedService` and `EncounterVisitRpcClient.voidCompletedService`.

## Implementation summary
Components:
- `CompletedServicesPanel.tsx`
- `CompletedServiceActions.tsx`
- `CompletedServiceStatusBadge.tsx`
- `completedServiceLabels.ts`
- `completedServicePermissions.ts`

Hooks:
- `useCompletedServices.ts`
- `useCompletedServiceActions.ts`

Patient page integration:
- Added `services` tab with label `Услуги`.
- Renders `CompletedServicesPanel` with active tenant, patient id, and tenant role.

UI behavior:
- Lists completed services.
- Records completed service through the typed RPC client.
- Voids completed service with required reason through the typed RPC client.
- Shows status, service name/code, tooth, surface, quantity, amount, currency, performed date, performer, visit, encounter, plan, stage, dictionary item, void reason, and void timestamp where available.

## Domain boundary
- `patient_visit` remains actual attendance.
- `clinical_encounter` remains the doctor documentation session.
- `completed_service` is the performed clinical/billable fact.
- Recording a completed service does not create payment.
- Recording a completed service does not write stock/materials.
- Recording a completed service does not create documents.
- Recording a completed service does not update treatment plan/stage status.
- Recording a completed service does not update appointment status.
- Timeline integration was not touched.

## Data/write boundary
- Reads use `EncounterVisitRepository.listCompletedServices`.
- Writes use `EncounterVisitRpcClient.recordCompletedService` and `EncounterVisitRpcClient.voidCompletedService`.
- No direct table writes were added in UI/hooks.
- No raw `supabase.rpc` calls were added in components.
- No `service_role` usage was added.
- No `localStorage` fallback was added.
- No `PatientTimelineAggregator` changes were made.

## Role behavior
- `clinic_owner` / `clinic_admin`: can view, record, void.
- `doctor`: can view, record, void.
- `registrar`: can view when allowed by backend/RLS, no record/void controls.
- `cashier`: can view when allowed by backend/RLS, no record/void controls.
- no-tenant: safe blocked state, no actions.
- cross-tenant: no smoke patient/service leakage observed for Admin B.

## Unit tests
Added:
- `src/components/services/CompletedServicesPanel.test.tsx`
- `src/data/hooks/useCompletedServices.test.tsx`
- `src/data/hooks/useCompletedServiceActions.test.tsx`

Coverage includes:
- no fetch without tenant/patient;
- repository read path;
- repository error handling;
- refresh;
- record RPC call;
- void RPC call;
- validations for service name, quantity, negative amounts, void reason;
- loading/empty/list states;
- status/service/amount/date/link fields;
- role gating for admin/doctor/registrar/cashier;
- no-tenant blocked state;
- voided service action hiding;
- raw metadata not rendered.

## Browser smoke
Environment:
- Local Supabase detected and reachable.
- Fresh Vite dev server started on `127.0.0.1:5185` with local Supabase env and QA shortcut env injected.
- Smoke fixture created local patient `4748541e-d01e-4455-b695-7ff4f65afa7a` with marker `SERVICES_UI_001`.

Admin A:
- Logged in through local QA shortcut.
- Opened smoke patient.
- Opened `Услуги` tab.
- Recorded completed service.
- Verified status `Выполнена`.
- Voided service with reason.
- Verified status `Аннулирована`.
- No console errors.

Doctor A:
- Logged in through local QA shortcut.
- Opened smoke patient.
- Opened `Услуги` tab.
- Recorded completed service.
- Verified status `Выполнена`.
- Voided service with reason.
- Verified status `Аннулирована`.
- No console errors.

Registrar A:
- Logged in through local QA shortcut.
- Opened smoke patient.
- Record/void controls were not visible.
- No console errors.

Cashier A:
- Logged in through local QA shortcut.
- Opened smoke patient.
- Record/void controls were not visible.
- No console errors.

No-tenant:
- Logged in through local QA shortcut.
- Smoke service data was not visible.
- Mutation controls were not visible.
- No console errors.

Admin B / cross-tenant:
- Logged in through local QA shortcut.
- Smoke service data from Clinic A was not visible.
- No console errors.

DB validation:
- `completed_services`: 2 rows were created and both reached status `voided` before cleanup.
- `audit_events`: 4 completed service events were created by RPC.
- `activity_events`: 4 completed service events were created by RPC.
- `documents`: 0 rows for smoke patient.
- `payments`: table does not exist in current local schema, so no payment side effect exists in this schema.

Cleanup:
- Deleted 2 completed services.
- Deleted 4 audit events.
- Deleted 4 activity events.
- Deleted 1 smoke patient.
- Final fixture cleanup remaining rows: 0.
- Fresh Vite dev server was stopped.

Screenshots:
- `reports/completed-services-ui-001/admin-record-void.png`
- `reports/completed-services-ui-001/doctor-record-void.png`
- `reports/completed-services-ui-001/registrar-readonly.png`
- `reports/completed-services-ui-001/cashier-readonly.png`
- `reports/completed-services-ui-001/no-tenant-blocked.png`
- `reports/completed-services-ui-001/admin-b-cross-tenant.png`

## What was intentionally NOT changed
- No migrations.
- No Supabase cloud apply.
- No RLS/grants changes.
- No seed/backfill changes.
- No payment/debt/refund UI.
- No stock/material write-off.
- No documents/acts/consents.
- No timeline integration.
- No `PatientTimelineAggregator` changes.
- No treatment plan/stage auto-completion.
- No appointment status side effects.

## Checks
- Targeted completed services tests: 3 files / 21 tests passed, stderr clean.
- Full test suite: 58 files / 533 tests passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- New layer safety scan: passed.
- GitHub Actions CI: pending PR creation.

## Issues
- Full project test suite still emits pre-existing act/test-environment warnings from older visit/encounter/dental tests. New completed services targeted tests are clean.
- No dedicated completed services lifecycle smoke runner exists yet. Smoke was assembled using fixture + browser role smoke tools.

## Final verdict
**PASS**

COMPLETED SERVICES UI IMPLEMENTED AND VERIFIED

## Recommended next task
SUPABASE-CLOUD-APPLY-ENCOUNTER-VISIT-001

<!-- SUPER_HERMES_METADATA:START -->
## Final Report Metadata

- PR: https://github.com/NckNA/codex-test/pull/317
- PR number: 317
- Branch: feature/completed-services-ui-001
- Base branch: main
- Implementation/reviewed HEAD: 7a8ffeca7efc5c0820068d61b29495510aaa698c
- Local HEAD at finalization: 7a8ffeca7efc5c0820068d61b29495510aaa698c
- Latest CI run ID: 27870707109
- Latest CI number: 586
- Latest CI conclusion: none
- CI tested commit: 7a8ffeca7efc5c0820068d61b29495510aaa698c
- Latest green CI run ID: none
- Latest green CI number: none
- Latest green CI tested commit: none

### Checks

| Check | Workflow | Status | Conclusion | Run | Tested commit |
| --- | --- | --- | --- | --- | --- |
| validate | CI | IN_PROGRESS | IN_PROGRESS | 27870707109 | 7a8ffeca7efc5c0820068d61b29495510aaa698c |

> A report-only commit cannot contain its own SHA or future CI result. After commit/push, Super Hermes stores those final values in an immutable local finalization receipt.
<!-- SUPER_HERMES_METADATA:END -->
