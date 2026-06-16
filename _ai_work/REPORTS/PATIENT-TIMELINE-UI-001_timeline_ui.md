# PATIENT-TIMELINE-UI-001 timeline UI

## Summary

Added the first read-only patient timeline UI slice for the patient card.

The new `История` tab uses the already merged `PatientTimelineAggregator` foundation through a small hook and a dedicated UI component.

This task did not add migrations, cloud changes, browser smoke, source mutations, audit log, encounter model, documents, payments, or stock.

## Branch

`feature/patient-timeline-ui-001`

## PR

https://github.com/NckNA/codex-test/pull/298

## PR head reviewed before final report update

`00fa9bdbfe01a099d5840ee2dfa4343dd96da888`

## Report update commit

N/A because the final report update commit cannot reference itself before creation.

## Changed files summary

- `src/data/hooks/usePatientTimeline.ts`
- `src/data/hooks/usePatientTimeline.test.tsx`
- `src/components/patient/PatientTimelineTab.tsx`
- `src/components/patient/PatientTimelineTab.test.tsx`
- `src/pages/PatientCardPage.tsx`
- `src/pages/PatientCardPage.test.tsx`
- `_ai_work/REPORTS/PATIENT-TIMELINE-UI-001_timeline_ui.md`

## Current UI recon

Current `PatientCardPage` tabs before this task:

- `Обзор`
- `История приёмов`
- `Зубная карта`
- `Проблемы и риски`
- `План лечения`
- `Финансы`
- `Документы`
- `Коммуникации`
- `Файлы`

The existing `История приёмов` tab is appointment-specific. It was kept unchanged.

The new patient timeline tab is a separate `История` tab so appointment history is not confused with the unified patient timeline.

PatientCardPage already loaded patient profile and medical summary. Timeline sources were not all available on the page, so this task added `usePatientTimeline` to load source data through existing repositories and pass normalized events to the UI.

## Implementation summary

Added `usePatientTimeline`:

- loads chief complaint;
- loads findings;
- loads treatment plans;
- loads appointments;
- loads patient files;
- loads dental chart for future-safe aggregator input;
- calls `buildPatientTimeline`;
- filters events through `canRoleSeePatientTimelineEvent`;
- returns read-only timeline events.

Added `PatientTimelineTab`:

- renders a read-only timeline;
- renders category filters;
- renders include archived toggle;
- renders category/status/date/source labels;
- renders archived markers;
- renders loading, error, no-tenant, and empty states;
- does not mutate source records.

Updated `PatientCardPage`:

- added `История` tab;
- kept `История приёмов` tab;
- wires `usePatientTimeline` into `PatientTimelineTab`;
- keeps timeline state limited to category filter and include archived toggle.

## Timeline UI behavior

The timeline is newest-first because it uses sorted aggregator output and additionally sorts defensively in the UI component.

Supported categories shown in this first UI slice:

- patient;
- complaint;
- finding;
- treatment plan;
- appointment;
- file.

Filters:

- `Все`
- `Пациент`
- `Жалобы`
- `Находки`
- `Планы лечения`
- `Приёмы`
- `Файлы`

Archived events are hidden by default. The `Показать архивные события` toggle requests archived source events through the hook and keeps UI filtering aligned with the aggregator.

The timeline is read-only. It has no edit, archive, delete, save, upload, or mutation action from timeline items.

Appointments remain appointment events. They are not shown as completed treatment.

File events show metadata labels only. Timeline does not fetch signed URLs, storage objects, previews, or thumbnails.

## Role visibility

Role visibility remains conservative and uses `canRoleSeePatientTimelineEvent`.

- `clinic_owner` and `clinic_admin` can see all current event visibility buckets.
- `doctor` can see clinical and admin events.
- `registrar` and `receptionist` see admin events only.
- `cashier` sees financial and admin events only.
- missing tenant role shows a safe no-active-clinic message.

The UI uses `activeTenant.role`. It does not fake admin access.

## Data boundary

- `tenantId` is required by the aggregator.
- `patientId` is required by the aggregator.
- Supabase-active no-tenant state returns an empty timeline and does not use local fallback.
- `PatientTimelineTab` does not call Supabase.
- `PatientTimelineTab` does not read localStorage.
- No cloud was touched.

## Tests

Added:

- `src/components/patient/PatientTimelineTab.test.tsx`
- `src/data/hooks/usePatientTimeline.test.tsx`
- `src/pages/PatientCardPage.test.tsx`

Covered:

- empty timeline state;
- event title, date, category, status, and tooth labels;
- newest-first rendering;
- category filtering;
- include archived toggle;
- archived marker;
- no mutation labels/actions;
- cashier conservative visibility;
- missing tenant role safe state;
- appointment remains appointment, not treatment completion;
- patient file events render without thumbnails/signed URL fetch;
- hook loads source repositories and calls aggregator;
- hook blocks Supabase-active no-tenant fallback;
- hook returns empty when patient is missing;
- PatientCardPage shows `История` and keeps `История приёмов`;
- clicking `История` renders timeline content.

## What was intentionally NOT changed

- no migrations;
- no cloud;
- no browser smoke;
- no local Supabase;
- no audit log;
- no encounter/visit model;
- no documents/payments/stock;
- no source mutations from timeline;
- no signed URL/file preview from timeline;
- no next task started.

## Checks

GitHub Actions CI on reviewed head `00fa9bdbfe01a099d5840ee2dfa4343dd96da888`:

- run `27638543371`;
- CI `#481`;
- tested commit `00fa9bdbfe01a099d5840ee2dfa4343dd96da888`;
- ESLint: success;
- tests: success;
- build: success.

## Final verdict

TIMELINE UI IMPLEMENTED AND VERIFIED

## Recommended next task

`PATIENT-TIMELINE-UI-SMOKE-001`
