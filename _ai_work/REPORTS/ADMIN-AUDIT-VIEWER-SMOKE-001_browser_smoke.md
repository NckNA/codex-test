# ADMIN-AUDIT-VIEWER-SMOKE-001 — Browser smoke report

## 1. Summary

Browser smoke was executed against the local app and local Supabase for the admin audit/activity viewer.

Result: **PARTIAL**.

The route/access/navigation/tab/filter/no-tenant/cross-role smoke paths were exercised in a real browser with local QA users. Admin-like roles could open `/admin/audit`; denied roles were blocked and did not show audit/activity rows; no-tenant was gated; the UI did not expose raw JSON/diff payloads or elevated browser values; no fatal browser console errors were observed.

Main limitation: temporary local smoke rows could not be inserted through the available local automation path because the tool safety layer blocked both local SQL/container execution and local elevated Supabase helper scripts before any DB mutation was performed. Therefore Activity/Audit row rendering was checked only through the safe empty-state path, not through visible seeded activity/audit rows.

## 2. Branch

`smoke/admin-audit-viewer-001`

## 3. PR URL

TBD until PR creation.

## 4. PR head reviewed before final report update

TBD until PR creation / final report update.

## 5. Report update commit

N/A because the final report update commit cannot reference itself before creation.

## 6. Changed files summary

Expected report-only change:

- `_ai_work/REPORTS/ADMIN-AUDIT-VIEWER-SMOKE-001_browser_smoke.md`

No app code, migrations, generated types, seed changes, RLS/grants, UI changes, or cloud config changes were intentionally made.

## 7. Environment

- Local app URL used for successful Supabase-active browser smoke: `http://127.0.0.1:5175/`
- Local Supabase URL: `http://127.0.0.1:54321`
- Local Supabase DB reset: performed successfully.
- Browser: Playwright Chromium, headless.
- QA login method: local QA shortcut after starting Vite with local env vars in the dev-server process.
- Supabase cloud: not touched.
- Secrets/passwords/elevated local values: not included in this report.

Note: local Supabase `status` reported optional stopped services (`imgproxy`, `edge_runtime`, `pooler`) while the local API/DB stack was usable. This did not block DB reset, QA seed, or browser access.

## 8. Local setup

### Supabase status

Local Supabase was running at `http://127.0.0.1:54321`. Optional services warning observed as above.

### DB reset

`npx supabase db reset`: PASS.

Applied migrations through:

- `0012_create_audit_activity_log.sql`
- `0013_create_audit_activity_rpc.sql`

### QA users seed

QA users were seeded locally after reset.

Seed summary observed:

- users created: 7
- profiles upserted: 7
- tenant memberships inserted: 7

QA roles used:

- `qa.admin.a@example.local` — Demo Clinic A / clinic_admin
- `qa.doctor.a@example.local` — Demo Clinic A / doctor
- `qa.receptionist.a@example.local` — Demo Clinic A / registrar
- `qa.cashier.a@example.local` — Demo Clinic A / cashier
- `qa.notenant@example.local` — no tenant
- `qa.multitenant@example.local` — Demo Clinic A / clinic_admin + Demo Clinic B / doctor
- `qa.admin.b@example.local` — Demo Clinic B / clinic_admin

### App dev server

Initial Vite restart did not pick up `.env.local`; the successful run used process-level local env vars and started Vite on port `5175`.

## 9. Smoke data

Temporary local smoke rows were intended but were **not inserted**.

Attempted paths blocked before mutation:

- local container SQL / `psql` execution path;
- local elevated Supabase JS helper script path.

Reason: OpenAI/Hermes safety filter blocked commands/files containing local elevated-value handling and SQL execution patterns. No cloud was touched and no local smoke insert completed.

Rows visible in the admin viewer during smoke:

- activity rows: 0
- audit rows: 0

Cleanup:

- no smoke rows were inserted by the completed smoke path;
- temporary `.env.local` and smoke scripts were deleted before report commit.

Final marker-count SQL validation was not performed because the same local SQL/elevated helper paths were blocked. The browser-visible result was an empty audit/activity state for all tenant-scoped viewer checks.

## 10. Admin / owner smoke

### Admin A (`qa.admin.a@example.local`)

Result: PASS for access/navigation/route/tabs/filters/empty state.

Observed:

- sidebar showed `Журнал действий`: yes;
- direct `/admin/audit`: accessible;
- page title `Журнал действий`: visible;
- tabs `Активность` and `Аудит`: visible;
- Activity tab queried local `activity_events` via REST GET;
- Audit tab queried local `audit_events` via REST GET;
- empty state rendered safely;
- category filter did not crash;
- severity filter did not crash;
- date from/to did not crash;
- activity visibility / include-archived controls were present and did not crash;
- audit targetType/patientId/actorUserId filters did not crash;
- pagination controls `Назад` / `Далее` visible;
- reload did not crash;
- console fatal errors: none observed.

Limitation:

- activity/audit row rendering with seeded smoke data was not validated because local smoke rows could not be inserted.

## 11. Denied role smoke

### Doctor A (`qa.doctor.a@example.local`)

- sidebar `Журнал действий`: hidden;
- direct `/admin/audit`: safe denied state;
- audit/activity data rows displayed: 0;
- audit/activity repository REST requests observed: none;
- console fatal errors: none.

### Registrar A (`qa.receptionist.a@example.local`)

- sidebar `Журнал действий`: hidden;
- direct `/admin/audit`: safe denied state;
- audit/activity data rows displayed: 0;
- audit/activity repository REST requests observed: none;
- console fatal errors: none.

### Cashier A (`qa.cashier.a@example.local`)

- sidebar `Журнал действий`: hidden;
- direct `/admin/audit`: safe denied state;
- audit/activity data rows displayed: 0;
- audit/activity repository REST requests observed: none;
- console fatal errors: none.

## 12. No-tenant smoke

`qa.notenant@example.local`:

- no-tenant gate visible after login;
- sidebar `Журнал действий`: hidden;
- direct `/admin/audit`: safe `Клиника не назначена` gate;
- audit/activity data rows displayed: 0;
- audit/activity repository REST requests observed: none;
- console fatal errors: none.

## 13. Multi-tenant smoke

`qa.multitenant@example.local`:

- default active tenant behaved as admin-access tenant;
- sidebar `Журнал действий`: visible;
- `/admin/audit`: accessible;
- Activity/Audit tabs visible;
- filters did not crash;
- reload did not crash;
- console fatal errors: none.

Tenant switching:

- a tenant switcher path was not exercised in this smoke run. The browser smoke detected no visible Clinic B switch action in the scripted flow.

Cross-tenant leakage:

- no Clinic A smoke rows existed, so row-level leakage could not be validated with seeded rows.

## 14. Clinic B / cross-tenant smoke

`qa.admin.b@example.local`:

- sidebar `Журнал действий`: visible;
- `/admin/audit`: accessible;
- Activity/Audit tabs visible;
- empty state acceptable because no Clinic B smoke rows were inserted;
- filters did not crash;
- reload did not crash;
- console fatal errors: none.

Cross-tenant limitation:

- no seeded Clinic A rows existed, so absence of Clinic A rows in Clinic B was not meaningfully validated beyond empty-state behavior.

## 15. Safety checks

Observed in browser/UI:

- no raw JSON/diff payload rendered in the table/list path;
- no smoke metadata object dump rendered;
- no elevated local value visible in page body;
- no secrets visible in page body;
- denied/no-tenant roles did not show audit/activity rows;
- denied/no-tenant roles did not trigger audit/activity REST reads;
- allowed roles used GET requests to local Supabase REST endpoints only.

Write-action check:

- No app code was changed and the UI is implemented as read-only.
- The automated body-text heuristic was too broad and produced a false-positive-style `writeButtonsVisible` flag, so the report does not treat that heuristic as reliable evidence of a write button.
- No explicit create/update/delete audit/activity action was exercised or found in the implemented viewer source during pre-read.

## 16. Issues found

### Blocker for full PASS

Local smoke rows could not be inserted due the tool safety layer blocking local SQL/elevated helper execution paths before mutation.

Impact:

- visible row rendering for Activity/Audit tabs was not verified;
- archived activity row visibility was not verified with data;
- cross-tenant row leakage was not verified with seeded Clinic A rows;
- final marker counts could not be SQL-verified.

### Non-blocking observations

- Vite did not pick up `.env.local` after the first start; successful smoke used process-level local env vars.
- Local Supabase status reported optional stopped services (`imgproxy`, `edge_runtime`, `pooler`), but the local API/DB paths used by the app were usable.
- Existing unit tests still emit known React `act(...)` warnings, but the test command exits successfully.

## 17. What was intentionally NOT changed

- no code changes;
- no migrations;
- no Supabase cloud;
- no UI changes;
- no RLS/grants changes;
- no audit/activity write paths;
- no patient timeline changes;
- no encounter/visit work;
- no payments/stock/documents;
- no generated types;
- no seed changes committed.

## 18. Checks

Before report creation:

- `git status --short`: clean after deleting temporary smoke files and `.env.local`.

Local checks:

- `npm run lint`: PASS;
- `npm run test -- --run`: PASS, 47 files / 414 tests;
- `npm run build`: PASS.

Warnings:

- existing React `act(...)` warnings in unrelated tests;
- existing Vite chunk-size warning.

GitHub Actions CI:

- TBD after report PR push.

## 19. Final verdict

`PARTIAL`

Exact missing smoke areas:

- seeded activity row rendering;
- seeded audit row rendering;
- archived activity visibility with real data;
- cross-tenant row leakage with real seeded Clinic A rows;
- final SQL marker-count cleanup verification.

All route/access/filter/empty-state/no-tenant/denied-role/console checks that could be performed without seeded rows were completed.

## 20. Recommended next task

`ADMIN-AUDIT-VIEWER-SMOKE-DATA-FIX-001`
