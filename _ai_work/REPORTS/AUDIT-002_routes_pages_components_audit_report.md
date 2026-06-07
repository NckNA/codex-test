# AUDIT-002 Routes, Pages, and Components Audit Report

## Task ID
AUDIT-002

## Summary
This read-only audit inspected the frontend routing structure, page files, and React components within the `src/` directory. The goal was to identify the current structural state, prototype indicators, component coupling risks, and domain boundaries. No application code or documentation was altered.

## App entry points
- **`src/main.tsx`**: The core React entry point. It wraps the application in `BrowserRouter` and sets up the React Router DOM `<Routes>` configuration. It also initializes the `localStorage` seed data via `storage.init()`.
- **`src/index.css`**: The Tailwind base layer CSS entry point.

## Routing structure
Routing is implemented directly in `src/main.tsx` using `react-router-dom`.
- The root route `/` uses the `Layout` component to wrap all child routes.
- The `index` route defaults to `SchedulePage` (`/`).
- Routes map directly to components in the `src/pages/` directory:
  - `/crm` -> `CrmPage`
  - `/appointments` -> `AppointmentsPage`
  - `/documents` -> `DocumentsPage`
  - `/patients` -> `PatientsPage`
  - `/patients/:patientId` -> `PatientCardPage` (Dynamic Route)
  - `/doctors`, `/medical`, `/finance`, `/warehouse`, `/statistics`, `/reports`, `/bonus`, `/mailing`, `/sms`, `/settings` -> Corresponding Page components.

## Pages inventory
The `src/pages/` folder maps 1:1 with the routing structure:
- **`SchedulePage.tsx`**: Main schedule/calendar view. Currently heavily coupled with `ScheduleContext`.
- **`PatientsPage.tsx`**: List view of patients, integrating an amoCRM tag UI indicator.
- **`PatientCardPage.tsx`**: Comprehensive view for a single patient (`/patients/:patientId`). Contains tabbed navigation.
- **Placeholder Pages**: `AppointmentsPage.tsx`, `BonusPage.tsx`, `CrmPage.tsx`, `DoctorsPage.tsx`, `DocumentsPage.tsx`, `FinancePage.tsx`, `MailingPage.tsx`, `MedicalPage.tsx`, `ReportsPage.tsx`, `SettingsPage.tsx`, `SmsPage.tsx`, `StatisticsPage.tsx`, `WarehousePage.tsx` all render a `<PlaceholderPage />` component.

## Components inventory
Summarized `src/components/` by folder:
- **`common/`**: `PlaceholderPage.tsx` acts as the primary stub for incomplete sections.
- **`layout/`**: `Layout.tsx`, `Header.tsx`, `Sidebar.tsx`. Manages the top-level shell. `Layout.tsx` wraps children in a `<ScheduleProvider>`.
- **`patients/`**: `PatientModal.tsx` (handles patient creation/editing logic and UI).
- **`dental/`**: 
  - `DentalChartTab.tsx`: Primary dental UI.
  - `ToothGrid.tsx`: Visual representation of teeth.
  - `ToothEditorModal.tsx`: Edits tooth status/conditions.
  - `FindingsRisksTab.tsx` & `FindingModal.tsx`: Management of medical findings.
- **`treatment/`**:
  - `TreatmentPlansTab.tsx`: Tab container for treatment plans.
  - `TreatmentPlanModal.tsx`: Creates/edits plans.
  - `TreatmentPlanPatientPreview.tsx`: Read-only preview for the patient.
  - `CreatePlanFromFindingsModal.tsx`: Conversion utility.
- **`schedule/`**: `AppointmentModal.tsx` handles appointment creation/editing forms.

## Patient card area
- **`PatientCardPage.tsx`** is a central hub. It fetches `dentalSummary` calculations directly inline and manages state for multiple tabs (`overview`, `dental_chart`, `plan`, `appointments`, `images`, `files`, `invoices`, `communications`).
- **Risk**: `PatientCardPage.tsx` is beginning to show signs of becoming a God Component, mixing layout, direct storage fetching, aggregation logic, and tab rendering.

## Dental chart area
- **`DentalChartTab.tsx`** manages the tooth grid and integrates closely with `ToothEditorModal.tsx` and findings logic.
- **Known warning**: `DentalChartTab.tsx` contains an existing ESLint warning regarding a missing `loadData` dependency in a `useEffect` hook.
- **Risk**: Currently relies on fetching/saving full chart objects from/to `localStorage`.

## Schedule/appointments area
- **`SchedulePage.tsx`** manages the visual calendar grid.
- It relies heavily on `useScheduleContext` (which lives in `src/hooks/` and `src/context/`) for filtering and date state.
- **Risk**: Direct reading and writing to `localStorage` (`storage.getAppointments`, `storage.updateAppointment`) occurs inside the UI component.

## Treatment plan area
- **`TreatmentPlansTab.tsx`** orchestrates treatment plans.
- **`TreatmentPlanModal.tsx`** handles creation.
- A patient preview component (`TreatmentPlanPatientPreview.tsx`) exists, correctly separating the commercial/patient-facing view from internal medical notes.

## Frontend integration area
- **`src/integrations/amocrm/amoCrmMapper.ts`** and `amoCrmTypes.ts` exist.
- They define DTO mapping (e.g., `mapTreatmentPlanToAmoLeadDraft`).
- **Risk**: DTO mappers exist in the frontend rather than exclusively in the backend proxy, though there are no explicit external HTTP calls (`fetch`/`axios`) to amoCRM directly found in the frontend yet.

## Storage references visible from frontend
- **`localStorage`** is heavily referenced throughout the frontend, strictly centralized through `src/utils/storage.ts`.
- `src/utils/storage.ts` is imported in `main.tsx`, `SchedulePage.tsx`, `PatientCardPage.tsx`, `PatientsPage.tsx`, and the component modals to perform CRUD operations on patients, appointments, treatment plans, findings, and dental charts.
- Deep audit of `localStorage` data shapes is reserved for AUDIT-003.

## Prototype/fake action indicators
Evidence-based observations of prototype status:
- **`PlaceholderPage.tsx`** is used for 13 distinct routes.
- **`alert()`**: Found in `FindingsRisksTab.tsx:105` (`alert('Жалоба сохранена')`).
- **Placeholders in Modals**: UI placeholders like `"Например: Глубокий кариес"`, `"Дополнительная информация о зубе..."`.
- **`console.log` / Fake actions**: None immediately obvious blocking actions, though standard form placeholders are abundant.
- **Integration Fake Actions**: `TreatmentPlansTab.tsx:142` has UI stating `"Интеграция с amoCRM будет доступна позже"`.

## Component risk observations
- **Coupling**: The frontend is heavily coupled to synchronous `localStorage` methods (`storage.get*`). Moving to a real backend will require introducing asynchronous logic (`useEffect`, loading states, Promises) across almost all data-fetching components.
- **God Component**: `PatientCardPage.tsx` aggregates a lot of disparate domain logic.
- **Integration Boundaries**: amoCRM mapping functions currently live in the frontend, which violates the target architecture where the backend proxy handles this mapping to ensure medical data safety.

## Checks
- `git status --short` -> clean tree.
- `npm run lint` -> Passed, 1 existing warning noted in `DentalChartTab.tsx`.
- `npm run build` -> Passed.
- `find`, `grep`, `sed` were used extensively to map the component structure and search for storage/API keywords.

## Safety notes
- **Audit-only task.**
- No source code changed.
- No backend code changed.
- No package files changed.
- No dependencies added.
- No real patient data added.
- No secrets added.
- No production claims made.

## What was not implemented
- No code changes, refactors, or UI changes were made.
- No backend or storage changes were made.
- No tests or CI logic added.
- No fixes were applied.

## Issues or observations
No blocking frontend-structure issues were fixed or modified because this task was audit-only. The frontend is a clean React prototype, but migrating it to the documented SaaS target architecture will require untangling `localStorage` from the UI components.

## Recommended next step
AUDIT-003 — Audit current localStorage/data shape.

Also planned later:
- AUDIT-004 — Audit current backend skeleton
- AUDIT-005 — Audit amoCRM/OAuth frontend-backend boundary if needed
- QA-001 — Create current prototype smoke test checklist
