# QA-001 Current Prototype Smoke Test Checklist

## Task ID
QA-001

## Summary
This document contains a manual smoke test checklist for the current DentalFlow CRM frontend prototype. This is a manual QA document. **No automated tests were executed or implemented as part of this PR.** This checklist is intended for a human tester to verify that the core UI flows and placeholder pages are still functioning without critical runtime crashes.

## Current prototype context
- **Frontend:** React + Vite SPA.
- **Storage:** Local `localStorage` acts as the sole source of truth (via `src/utils/storage.ts`).
- **Backend:** A separate amoCRM OAuth skeleton exists but is disconnected from the frontend.
- **Pages:** Includes functional modules (Schedule, Patients List, Patient Card, Dental Chart, Treatment Plans) and numerous placeholder modules (CRM, Finance, Warehouse, etc.).
- **Production readiness:** ❌ Not production-ready. No tenant isolation, no auth, no database, no real external API integration.

---

## How to run basic checks
Run the following commands in the project root:

1. **Lint check:**
   ```bash
   npm run lint
   ```
   *Expected:* 0 errors. A known warning (`react-hooks/exhaustive-deps`) in `DentalChartTab.tsx` is acceptable at this stage.

2. **Build check:**
   ```bash
   npm run build
   ```
   *Expected:* Successful Vite build output (`✓ built in ...ms`).

3. **Dev server (for manual UI testing):**
   ```bash
   npm run dev
   ```
   *Expected:* Server starts on `localhost:5173`. Open in browser.

## Smoke test result legend
- **PASS:** Feature works as described without runtime errors or crashes.
- **FAIL:** Feature throws an error, crashes the page, or visually breaks.
- **BLOCKED:** Feature cannot be tested due to another failing component.
- **NOT RUN:** Tester skipped this check.
- **NOT IMPLEMENTED:** Expected logic is not yet built.
- **EXPECTED PLACEHOLDER:** Page safely renders a "Coming Soon" or generic placeholder.

---

## Pre-test setup checklist
- [ ] Pull the latest `main` branch.
- [ ] Run `npm install` if `package.json` was updated.
- [ ] Run `npm run lint` and `npm run build` to verify compilation.
- [ ] Run `npm run dev` and open the app.
- [ ] **Data Safety:** Ensure no real patient data is entered. Use only fake names (e.g., "Иванов Иван").
- [ ] **Storage Safety:** Do not manually clear `localStorage` unless explicitly testing the reset behavior.

---

## Route/navigation checklist

| Path / Route | Expected Page | Smoke Result | Notes |
|---|---|---|---|
| `/` | SchedulePage | `[ ]` | Main dashboard/schedule |
| `/patients` | PatientsPage | `[ ]` | List of patients |
| `/patients/:id` | PatientCardPage | `[ ]` | Patient details |
| `/crm` | PlaceholderPage | `[ ]` | "Coming Soon" message |
| `/finance` | PlaceholderPage | `[ ]` | "Coming Soon" message |
| `/warehouse` | PlaceholderPage | `[ ]` | "Coming Soon" message |
| `/settings` | PlaceholderPage | `[ ]` | "Coming Soon" message |

---

## Patients list checklist
- [ ] Open the **Пациенты** (Patients) page via the sidebar.
- [ ] Verify that demo patients load correctly.
- [ ] Test the search/filter box if present (does it filter the list?).
- [ ] Click on a patient row to open the Patient Card.
- [ ] Click "Add Patient" (Добавить пациента).
- [ ] Fill out the form with fake data and save. Verify the new patient appears in the list.
- [ ] Verify no runtime crashes occur during creation.

---

## Patient card checklist
- [ ] Open a specific Patient Card (e.g., `/patients/1`).
- [ ] Verify the header displays the patient's name, phone, and source.
- [ ] Verify the navigation tabs (Dental Chart, Treatment Plans, Info) are visible.
- [ ] Edit patient info (if supported) and save.
- [ ] **Missing patient:** Manually navigate to `/patients/999` in the URL bar. Verify it shows an appropriate "Not Found" state rather than a blank white screen crash.

---

## Dental chart checklist
- [ ] Navigate to the **Зубная карта** (Dental Chart) tab in a Patient Card.
- [ ] Verify the adult/child tooth grid renders correctly.
- [ ] Select a tooth. Verify the condition modal or sidebar opens.
- [ ] Change the condition of the tooth (e.g., to "Caries" or "Missing").
- [ ] Save the condition and verify the tooth graphic updates.
- [ ] Refresh the page (`F5`) and verify the changes persist (localStorage).
- [ ] *Known issue:* `src/components/dental/DentalChartTab.tsx` has an existing lint warning. Verify the page doesn't crash despite the warning.

---

## Chief complaints/findings checklist
- [ ] Navigate to the **Жалобы и диагнозы** (Findings/Risks) tab.
- [ ] Verify seeded complaints load correctly.
- [ ] Click "Add complaint/finding". Add a test entry and save.
- [ ] Ensure the finding appears in the list.
- [ ] Delete a finding and confirm it is removed from the list.
- [ ] **Safety check:** Verify no medical data is accidentally broadcasted or sent in background requests (check Network tab in DevTools).

---

## Treatment plans checklist
- [ ] Navigate to the **Планы лечения** (Treatment Plans) tab.
- [ ] Click "Create Plan" (Создать план). Add stages/services and save.
- [ ] Click "Create Plan from Findings" (Создать план из проблем) if supported. Select findings and save.
- [ ] Preview the patient-facing plan (Предпросмотр для пациента). Verify total price displays correctly.
- [ ] **amoCRM check:** Verify the amoCRM button is disabled with a placeholder tooltip (e.g., "amoCRM: после подключения").
- [ ] **Safety check:** Verify no real amoCRM API calls are made in the Network tab.

---

## Schedule/appointments checklist
- [ ] Open the **Расписание** (Schedule) page.
- [ ] Verify the calendar/grid renders and seeded appointments are visible.
- [ ] Change the date or view (Day/Week) if supported.
- [ ] Click an empty slot to create an appointment. Select a patient and save.
- [ ] Edit an existing appointment (change time/doctor).
- [ ] Verify that completing an appointment does NOT accidentally mark an entire treatment plan as complete.

---

## Placeholder pages checklist
The following pages are placeholders. Navigating to them should show a generic "Under Construction" or "Coming Soon" screen without crashing.
- [ ] CRM (`/crm`)
- [ ] Finance (`/finance`)
- [ ] Documents (`/documents`)
- [ ] Warehouse (`/warehouse`)
- [ ] Medical/Dict (`/medical`)
- [ ] Statistics (`/statistics`)
- [ ] Reports (`/reports`)
- [ ] Bonus (`/bonus`)
- [ ] Mailing (`/mailing`)
- [ ] SMS (`/sms`)
- [ ] Settings (`/settings`)

**Requirement:** Placeholders must not fake success (e.g., clicking a disabled "Sync" button should not say "Synced successfully").

---

## amoCRM/integration checklist
- [ ] **Direct calls:** Open browser DevTools (Network tab). Verify the frontend makes **zero** calls to `amocrm.ru` or `localhost:4000`.
- [ ] **Tokens:** Verify no tokens (`access_token`, `client_secret`) are visible in the UI or stored in browser `localStorage`.
- [ ] **UI Boundaries:** Verify the amoCRM sync button in Treatment Plans is strictly disabled (`cursor-not-allowed`).
- [ ] **Backend status:** The backend proxy skeleton exists but is NOT expected to be connected.

---

## localStorage safety checklist
- [ ] **Seed data:** Open DevTools > Application > Local Storage. Verify keys like `df_patients`, `df_appointments` exist.
- [ ] **Persistence:** Refresh the browser multiple times. Verify data doesn't disappear.
- [ ] **Reset caution:** Do not clear localStorage during a normal test session unless you are explicitly testing the `storage.init()` seed behavior.
- [ ] **Prototype risk:** Keep in mind that clearing browser data will permanently delete all local prototype data.

---

## Known limitations
- **Persistence:** LocalStorage is the only source of truth. No cloud persistence yet.
- **Multi-tenancy:** No tenant isolation exists in the frontend.
- **Auth:** No login, RBAC, or user roles exist.
- **amoCRM:** Real amoCRM sync is not implemented. Backend is an OAuth skeleton.
- **Lint:** One known React exhaustive-deps warning in `DentalChartTab.tsx`.

---

## Smoke test execution template
*(Copy this section into an issue or PR comment when running the test manually)*

```text
Date: 
Tester: 
Branch/commit: 
Browser (Name/Version): 
Environment: Local Dev
Commands run: `npm run lint`, `npm run build`, `npm run dev`
Manual UI sections tested: 
Results: [PASS / FAIL]
Failures (if any):
Screenshots/logs:
Notes:
```

---

## Checks performed during this audit

- `git status --short`: Verified clean (only report created)
- `npm run lint`: Executed. Found 0 errors, 1 existing warning (`DentalChartTab.tsx`).
- `npm run build`: Executed. Completed successfully.
- Code inspections: Verified routing (`main.tsx`) and application boundaries.

## Safety notes
- **Audit-only task:** This checklist was created without modifying application logic.
- **No tests implemented:** No automated CI/unit/e2e tests were added.
- **No execution claim:** The tester must manually run the checklist. This PR does not claim the manual test was executed by the AI.
- **No secrets/data added:** No real patient data or `.env` files were created.
- **No production claims:** This is for stabilizing the prototype only.

## What was not implemented
- No automated tests (Vitest, Playwright, Cypress) were added.
- No CI/CD workflows were created.
- No code changes, bug fixes, or UI modifications were made.
- No backend or amoCRM logic was changed.
- No storage logic was changed.

## Recommended next steps
- **CLEAN-001** — Identify fake actions and risky placeholders in the UI.
- **FIX-001** — Fix existing `DentalChartTab` eslint warning.
- **STORAGE-001** — Plan safe localStorage hardening.
- **AMO-PLAN-001** — Plan safe amoCRM integration boundary before implementation.
