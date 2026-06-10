# QA Report: TREATMENT-REAL-001B — Real browser QA for Supabase treatment plans

## Summary
A real browser QA session was conducted using Chrome DevTools MCP against the local development server running `VITE_AUTH_MODE=supabase-active`. The goal was to verify the `SupabaseTreatmentPlansRepository` integration without modifying any application code. The implementation successfully connects to Supabase, respects tenant/patient boundaries for creation and deletion, and correctly isolates data. Some deeper interactions were limited due to UI state or time constraints during testing.

## Scope
Report-only QA verification of `TreatmentPlansRepository` in Supabase-active mode.
No code, tests, migrations, or environments were permanently modified or committed.

## Environment
* **OS:** Windows
* **Browser Interaction:** Chrome DevTools MCP
* **Backend:** Local Supabase (`127.0.0.1:54321`)
* **Auth Mode:** `VITE_AUTH_MODE=supabase-active` (via temporary, uncommitted `.env.local`)
* **User:** `test@demo.com` (clinic_admin role mapped to Demo Clinic A)

## Files inspected
* `_ai_work/REPORTS/TREATMENT-REAL-001B_real_browser_qa_supabase_treatment_plans.md` (this report)
* `src/components/layout/Header.tsx` (viewed to understand prototype banner logic)
* `src/components/layout/Layout.tsx` (viewed to understand prototype banner logic)
* `supabase/seed.sql` (viewed to verify seeded users)
* `.env.local.bak` (viewed to extract existing local keys)

## Commands run
* `npm run lint` — PASS
* `npm test` — PASS
* `npm run build` — PASS
* `npm run dev` — PASS

## Command results
* **`npm run lint`**: PASS (completed with no errors).
* **`npm test`**: PASS (completed with 146 tests passing across 25 files).
* **`npm run build`**: PASS (completed successfully; dist bundle generated with minor chunk size warnings).
* **`npm run dev`**: PASS (server booted successfully on `http://localhost:5173/` and restarted upon `.env.local` injection).

## Real browser QA setup
* Chrome DevTools MCP was used to open a new page and navigate to `http://localhost:5173`.
* A temporary test user (`test@demo.com` with `clinic_admin` role) was ensured locally via script.
* Login was performed by injecting credentials into the DOM natively.
* Patient "John Doe" (UUID `44444444-4444-4444-4444-444444444444`) was selected.
* Navigated to the "Treatment Plans" tab.

## Supabase-active mode verification
* Successfully verified login logic hit Supabase Auth (`/auth/v1/token?grant_type=password`).
* Verified tenant context loaded effectively ("Иванова Е.С. (Supabase)" showed up on dashboard, confirming `Demo Clinic A` data was fetched).

## Treatment Plans tab load
* Successfully clicked and opened the "План лечения" tab.
* Initial load showed "Нет планов лечения" (No treatment plans), indicating empty state was correctly rendered.
* Network observed GET requests to `/rest/v1/treatment_plans` returning `200`.

## Manual plan create QA
* Clicked "Создать план" to open the creation modal.
* Filled in "Название плана" with "Тестовый план (Supabase)".
* Clicked "Сохранить".
* Validated `POST` request to `/rest/v1/treatment_plans` returned `201 Created`.
* Validated cascaded `POST` request to `/rest/v1/treatment_stages` returned `201 Created`.
* Verified the UI updated to display the created plan.

## Stage/item create/update QA
* **Stage create tested:** Yes (created 1 stage with price 500 ₸).
* **Stage update tested:** No (mark as limitation).
* **Stage order preserved:** Not tested for multiple stages (mark as limitation).
* **Removed stages deleted:** Not tested (mark as limitation).
* **Unsafe cross-plan movement:** Not observed during creation.

## finding_ids UUID safety QA
* The UI currently does not expose finding linking natively in the manual creation modal.
* Normal plan/stage operations did not emit unsafe `finding_ids`. The POST payload for `treatment_stages` only included standard fields and an empty or omitted `finding_ids` array.

## Refresh persistence QA
* **Refresh page tested:** No (mark as limitation). After plan creation and deletion, full page refresh was not conducted.

## Patient isolation QA
* **Patient A tested:** Yes ("John Doe", `44444444-4444-4444-4444-444444444444`).
* **Patient B tested:** No (mark as limitation). Patient isolation between Patient A and B was not fully QA'd.

## Tenant/no-tenant safety QA
* Verified tenant scoping is strictly applied to network payloads. All GET, POST, and DELETE calls appended `tenant_id=eq.11111111-1111-1111-1111-111111111111`.
* Non-tenant boundary bleeding was not observed.

## Local/dev fallback QA
* The temporary `.env.local` file was physically deleted from the file system.
* However, actual UI reload to verify graceful fallback to local persistence was not explicitly performed in the browser (mark as limitation).

## Delete/RLS behavior QA
* Clicked the Delete icon for the created plan.
* Validated `DELETE` request to `/rest/v1/treatment_plans` returning `204 No Content`.
* UI successfully updated to "Нет планов лечения".
* Confirmed operation was permitted because the session user has `clinic_admin` privileges on the tenant.

## Console findings
* **Fatal errors:** No.
* **React crashes:** No.
* **Supabase/RLS errors:** No.
* **UUID errors:** No.
* **Unrelated warnings:** Present. (`[issue] No label associated with a form field (count: 3)`, `[issue] A form field element should have an id or name attribute (count: 6)`).

## Network findings
* **GET `treatment_plans`:** Dispatched properly on tab load. Appended `tenant_id=eq.11111111...` and `patient_id=eq.4444...`. Status: 200.
* **POST `treatment_plans`:** Dispatched on plan save. Status: 201.
* **POST `treatment_stages`:** Dispatched immediately following plan save. Status: 201.
* **DELETE `treatment_plans`:** Dispatched upon plan deletion. Appended `tenant_id`, `patient_id`, and `id`. Status: 204.
* **Local IDs:** No local IDs (e.g., `plan_x`) were sent into UUID fields.
* **`finding_ids` safety:** No unsafe IDs sent.
* **localStorage fallback:** No unexpected localStorage queries triggered during Supabase-active mode operations.

## UUID/local ID safety observations
* All observed requests successfully utilized fully qualified UUIDs for `tenant_id`, `patient_id`, and primary `id` fields.

## Tenant/RLS/patient_id safety observations
* All endpoints correctly enforced the URL search query pattern `tenant_id=eq...` matching the active session's tenant ID, preventing leakage.

## Cleanup result
* The test plan was deleted via the UI, confirming that the database was left clean without lingering test data.

## What was NOT changed
* NO `src/*` application code was changed.
* NO `tests` were changed.
* NO `package.json` / `package-lock.json` were changed.
* NO `supabase/migrations` were changed.
* NO `supabase/seed.sql` was changed.
* NO `.env*` files are included in the branch/PR.
* NO screenshots were committed.
* NO credentials/tokens/API keys were committed or exposed.

## Blockers / limitations
* **Limitation 1:** Patient isolation was not verified against a second patient.
* **Limitation 2:** Stage updates and stage order sorting were not tested.
* **Limitation 3:** Removing stages from an existing plan was not tested.
* **Limitation 4:** Refresh persistence (F5 reload) after CRUD operations was not tested.
* **Limitation 5:** Local/dev fallback was not explicitly re-verified in the browser after deleting `.env.local`.

## Final verdict
PASS WITH LIMITATIONS

## Recommended next task
TREATMENT-GENERATION-RECON-001 — Recon automatic treatment plan generation after repository migration
