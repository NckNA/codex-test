# PATIENT-TIMELINE-UI-SMOKE-001 browser smoke

## 1. Summary

Browser smoke validation was performed locally for the patient card timeline UI added as the separate `История` tab.

The app was tested against local Supabase only, using local QA login shortcut buttons instead of manually typing credentials.

Result: **TIMELINE UI BROWSER SMOKE PASSED**.

Notes:

- The `История` tab is visible separately from `История приёмов`.
- The timeline renders safely for Admin A, Doctor A, Registrar A, Cashier A, and Multi-tenant.
- No-tenant user is safely blocked by the no-tenant gate, including direct patient-route navigation.
- Timeline category filters and archived toggle are visible and stable.
- Timeline items are read-only and expose no mutation controls.
- No unexpected browser console fatal errors were observed.
- No Supabase cloud URL was observed.
- No service-role key, password, or secret was visible in the browser.

## 2. Branch name

`qa/patient-timeline-ui-smoke-001`

## 3. PR URL

https://github.com/NckNA/codex-test/pull/299

## 4. PR head reviewed before final report update

`abf8e6c3220b9fa9562666aca6ee8869e2424fb7`

## 5. Report update commit

N/A because the final report update commit cannot reference itself before creation.

## 6. Changed files summary

Exactly one report file is intended to be changed:

- `_ai_work/REPORTS/PATIENT-TIMELINE-UI-SMOKE-001_browser_smoke.md`

No application code, tests, migrations, storage policy files, or environment files were changed.

## 7. Environment

- Local app URL: `http://localhost:5173/`
- Local Supabase API: `http://127.0.0.1:54321`
- Local Supabase was used.
- Supabase cloud project `cwkgxgubvdkkjcslvdgn` was not touched.
- Browser tool used: Playwright Chromium through the local terminal. Hermes browser snapshot/open calls were blocked for localhost, so the real browser smoke was performed through local Playwright instead.
- QA shortcut used: yes.
- QA users tested without passwords:
  - Admin A
  - Doctor A
  - Registrar A
  - Cashier A
  - No-tenant
  - Multi-tenant

## 8. Preflight

- Branch was created from current `origin/main`.
- Base commit: `4bf318ced507e6b8691c62bc8ba36a4f69f470df`.
- Local Supabase status: running.
- Local migrations: `0001` through `0011` listed as applied locally.
- QA users: reused and local QA passwords reset through `npm run qa:seed-users`.
- QA fixture result:
  - users created: 0
  - users reused: 7
  - passwords reset: 7
  - profiles upserted: 7
  - tenant users inserted: 7
- QA shortcut env was configured only in `.env.local` during browser smoke and then removed before final checks.
- No credential value was stored in this report.
- App startup: `npm run dev` served Vite at `http://localhost:5173/`.

## 9. QA shortcut smoke

PASS.

- Login page showed the local QA panel.
- Panel label was visible: `Локальный QA-вход. Только для разработки.`
- Required shortcut buttons were visible:
  - Admin A
  - Doctor A
  - Registrar A
  - Cashier A
  - No-tenant
  - Multi-tenant
  - Admin B
- Admin A login through the shortcut succeeded through normal app flow.
- No password, service-role key, or secret key was visible on the login page or in browser storage checks.
- No login-page console errors were observed.

## 10. Admin smoke result

PASS.

- Login: Admin A shortcut clicked and login succeeded.
- Active role label: `Администратор клиники`.
- Patient card opened: seeded patient `John Doe`.
- Patient id opened locally: `44444444-4444-4444-4444-444444444444`.
- `История` tab visible: yes.
- `История приёмов` tab still visible separately: yes.
- Full tab row observed:
  - `Обзор`
  - `История`
  - `История приёмов`
  - `Зубная карта`
  - `Проблемы и риски`
  - `План лечения`
  - `Финансы`
  - `Документы`
  - `Коммуникации`
  - `Файлы`
- Timeline render result: safe render with one default event before archive toggle.
- Default event observed: patient-created event, labelled as patient/admin context.
- Category filters visible: yes, 7 filter buttons.
- Filter click tested: yes, stable.
- Archived toggle visible: yes.
- Archived toggle tested: yes, stable; archived marker appeared when archived events were included.
- No edit/delete/archive/upload/save mutation buttons inside timeline: confirmed.
- Appointment event handling: no completed-treatment wording was observed. The appointment category/filter label remained `Приёмы`.
- File events: no signed URL, render, preview, or thumbnail storage request was observed during targeted timeline network check.
- Console: no unexpected runtime errors or React fatal errors.

## 11. Doctor smoke result

PASS.

- Login: Doctor A shortcut clicked and login succeeded.
- Active role label: `Врач`.
- Patient card opened: seeded patient `John Doe`.
- `История` tab visible: yes.
- `История приёмов` tab still visible separately: yes.
- Timeline rendered safely.
- Filters visible and stable.
- Archived toggle visible and stable.
- No mutation buttons inside timeline.
- No completed-treatment wording was observed for appointment context.
- File events did not fetch signed URLs/previews during targeted timeline network check.
- Console: no unexpected runtime errors or React fatal errors.

## 12. Receptionist / registrar smoke result

PASS with visibility observation.

- Login: Registrar A shortcut clicked and login succeeded.
- Active role label: `Регистратор`.
- Patient card access: allowed in current product behavior.
- `История` tab access: allowed.
- `История приёмов` tab still visible separately: yes.
- Timeline rendered safely.
- Visible event content was limited to admin-style patient-created context in this seeded data set.
- Clinical category filter labels are visible in the shared timeline UI, but detailed clinical event items were not exposed in the observed list.
- No mutation buttons inside timeline.
- Console: no unexpected runtime errors or React fatal errors.

## 13. Cashier smoke result

PASS with visibility observation.

- Login: Cashier A shortcut clicked and login succeeded.
- Active role label: `Кассир`.
- Patient card access: allowed in current product behavior.
- `История` tab access: allowed.
- Clinical details: no clinical detail item was observed; visible event content was limited to admin-style patient-created context in this seeded data set.
- Clinical category filter labels are visible in the shared timeline UI.
- No mutation buttons inside timeline.
- Console: no unexpected runtime errors or React fatal errors.

## 14. No-tenant smoke result

PASS.

- Login: No-tenant shortcut clicked and login succeeded.
- No-tenant gate displayed after tenant loading.
- Gate text confirmed: `Клиника не назначена`.
- Direct patient route was checked using the seeded patient id.
- Direct route stayed blocked by the no-tenant gate.
- No patient id or patient timeline data was shown on direct navigation.
- No tenant-scoped data leakage was observed.

## 15. Optional multi-tenant result

PASS.

- Login: Multi-tenant shortcut clicked and login succeeded.
- Default active clinic behavior loaded Clinic A context with `Администратор клиники` role.
- Patient card opened for Clinic A seeded patient.
- `История` and `История приёмов` were both visible.
- Timeline rendered safely.
- Filters and archived toggle were stable.
- No cross-tenant leakage was observed in browser/network checks.
- Tenant switcher was not implemented or changed in this task.

## 16. Data boundary

PASS.

- Local Supabase only: browser requests used `127.0.0.1:54321`.
- Cloud Supabase URL: not observed.
- Cloud project id `cwkgxgubvdkkjcslvdgn`: not observed in browser requests.
- Service role key in browser: not observed.
- QA password in browser: not observed.
- No cross-tenant data leakage observed.
- No localStorage fallback showed fake patient timeline in Supabase-active no-tenant mode.
- Targeted storage network check during timeline smoke:
  - `/storage/v1/object/sign`: 0 requests
  - `/storage/v1/render`: 0 requests
  - storage requests total: 0

## 17. Console / network observations

- Admin A console: clean.
- Doctor A console: clean.
- Registrar A console: clean.
- Cashier A console: clean.
- No-tenant console: clean.
- Multi-tenant console: clean.
- Request hosts observed during role smoke:
  - `localhost:5173`
  - `127.0.0.1:54321`

## 18. What was intentionally NOT changed

- No application code changed.
- No migrations created.
- No migrations applied to cloud.
- No Supabase cloud access used.
- No storage upload performed.
- No storage policy changes.
- No patient files uploaded.
- No source mutations made from timeline.
- No encounter/visit model created.
- No audit log created.
- No payments/documents/stock feature work started.
- No role logic modified.
- No PR merge attempted.

## 19. Checks

- `git status --short` before report creation: clean.
- `npm run lint`: PASS.
- `npm run test -- --run`: PASS on clean environment after removing temporary `.env.local`.
  - Note: one earlier run failed because `.env.local` intentionally enabled the local QA shortcut/Supabase browser-smoke environment. The file was removed because it is not committed, then tests passed: 44 test files, 354 tests.
- `npm run build`: PASS.
  - Vite emitted the existing large chunk warning.
- GitHub Actions CI result for reviewed PR head `abf8e6c3220b9fa9562666aca6ee8869e2424fb7`: PASS. Run id `27711954202`; workflow `CI`; run number `492`; job `validate`; ESLint, tests, and build passed. GitHub emitted a Node 20 deprecation warning for Actions, but the workflow conclusion was success.

## 20. Final verdict

**TIMELINE UI BROWSER SMOKE PASSED**

## 21. Recommended next task

`ENCOUNTER-VISIT-MODEL-RECON-001`
