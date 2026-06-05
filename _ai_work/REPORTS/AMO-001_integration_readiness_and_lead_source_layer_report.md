# AMO-001 Integration Readiness and Lead Source Layer

## What was implemented
- Prepared the integration readiness layer for future amoCRM connectivity without implementing real API calls, OAuth, backend, webhooks, or token storage.
- Added `PatientIntegrationMeta`, `PatientSource`, `PatientLeadStatus`, `ExternalCrmProvider`, `SyncStatus`, and `ExternalCrmLink` types to the `Patient` interface.
- Created `src/integrations/amocrm/amoCrmTypes.ts` with draft mock types.
- Created `src/integrations/amocrm/amoCrmMapper.ts` containing pure mapping functions (`mapPatientToAmoContactDraft`, `mapTreatmentPlanToAmoLeadDraft`, `buildAmoSyncPreview`) ensuring that no detailed medical data is exposed.
- Updated `PatientModal` with a dedicated "Источник и CRM" section.
- Updated `PatientsPage` to show new Source and Lead Status badges beneath patient names.
- Updated `PatientCardPage` overview to include a "Источник / CRM" block.
- Updated `TreatmentPlansTab` to display a disabled "amoCRM: после подключения" button.
- Updated documentation `PROJECT_ROUTES.md`, `ARCHITECTURE_CURRENT.md`, `STORAGE_RULES.md`, and added `RISKS.md`.

## Files Added
- `src/integrations/amocrm/amoCrmTypes.ts`
- `src/integrations/amocrm/amoCrmMapper.ts`
- `_ai_work/RISKS.md`
- `_ai_work/REPORTS/AMO-001_integration_readiness_and_lead_source_layer_report.md`

## Files Changed
- `src/types/index.ts`
- `src/components/patients/PatientModal.tsx`
- `src/pages/PatientsPage.tsx`
- `src/pages/PatientCardPage.tsx`
- `src/components/treatment/TreatmentPlansTab.tsx`
- `_ai_work/PROJECT_ROUTES.md`
- `_ai_work/ARCHITECTURE_CURRENT.md`
- `_ai_work/STORAGE_RULES.md`

## Storage Compatibility
- Handled safely. Existing patients inside `localStorage` lacking the `integration` metadata are rendered with fallback default values (`manual`, `new_lead`) dynamically on-the-fly, without requiring active localStorage migration on load.

## What was intentionally not implemented
- Real amoCRM API calls or OAuth.
- Webhooks or backend services.
- Real synchronization mechanisms.
- Active migrations of `localStorage`.
- Fully fleshed-out "Settings" UI page (only documented).

## How to test manually
1. Open the application and navigate to Patients.
2. Verify existing patients load without crashing and show "Вручную" and "Новый лид" badges.
3. Edit an existing patient or create a new one, assign "Источник пациента" (e.g., amoCRM) and "Статус лида" (e.g., Записан).
4. Save and verify the `PatientsPage` table correctly reflects the new colored badges.
5. Open the patient card and confirm the "Источник / CRM" block shows the applied data and "Внешняя CRM не подключена".
6. Navigate to "Планы лечения" within the patient card and observe the disabled "amoCRM: после подключения" button on each active treatment plan.

## Control checklist
- [x] Patient type supports optional integration metadata.
- [x] Existing patients remain compatible.
- [x] PatientModal can edit source and lead status.
- [x] PatientsPage displays source/status badges.
- [x] PatientCardPage displays Source / CRM block.
- [x] amoCRM mapper files exist without network calls.
- [x] No real amoCRM API implemented.
- [x] Documentation updated.
