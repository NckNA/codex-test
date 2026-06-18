# ADMIN-AUDIT-VIEWER-SMOKE-DATA-FIX-001 — Browser Smoke Report

## 1. Summary

Seeded browser smoke was executed successfully against the local app and local Supabase for the admin audit/activity viewer.

All route, access, navigation, tab, filter, no-tenant, cross-role, and cross-tenant smoke paths were exercised in a real browser with local QA users and real seeded database rows. 

Final Verdict: **ADMIN AUDIT VIEWER SEEDED BROWSER SMOKE PASSED**

## 2. Branch

`smoke/admin-audit-viewer-data-fix-001`

## 3. PR URL

https://github.com/NckNA/codex-test/pull/309

## 4. PR head reviewed before final report update

`e06cd8756e4462120fc1d1117ae91d8f1c3a58ea`

## 5. Report update commit

N/A because the final report update commit cannot reference itself before creation.

## 6. Changed files summary

Expected report-only change:

- `_ai_work/REPORTS/ADMIN-AUDIT-VIEWER-SMOKE-DATA-FIX-001_browser_smoke.md`

No app code, migrations, generated types, seed changes, RLS/grants, UI changes, or cloud config changes were made.

## 7. Relationship to PR #309

- **What was PARTIAL in PR #309**: The browser smoke was marked partial because temporary local smoke rows could not be inserted through the available local automation path due to previous safety boundaries. Thus, row rendering, archiving toggle, filter matches, and cross-tenant data leakage prevention could not be verified with actual seeded data.
- **What this task completed**: Using direct local database queries, we successfully inserted 4 activity events and 4 audit events carrying the specified smoke marker. We verified their rendering, visibility controls, filtering logic, role boundaries, and safety protections, followed by a complete cleanup of the smoke rows.

## 8. Environment

- **Local app URL**: `http://localhost:5174/`
- **Local Supabase URL**: `http://127.0.0.1:54321` (REST/GraphQL APIs, Studio at `http://127.0.0.1:54323`)
- **Browser used**: Chromium (headless, via `chrome-devtools-mcp`)
- **QA login method**: Standard email/password login screen using seeded QA credentials.
- **Supabase cloud**: Not touched.
- **Secrets/passwords**: None included in this report.

## 9. Local setup

### Supabase status
Local Supabase running on `54321`. Optional services (`imgproxy`, `edge_runtime`, `pooler`) reported stopped, but API, Auth, and DB paths remained fully operational.

### DB reset result
`npx supabase db reset`: PASS. All local migrations successfully applied.

### QA users seed
Seeded successfully. 7 users, profiles, and tenant memberships created.
Roles used:
- `qa.admin.a@example.local` (Demo Clinic A, `clinic_admin` role)
- `qa.doctor.a@example.local` (Demo Clinic A, `doctor` role)
- `qa.receptionist.a@example.local` (Demo Clinic A, `registrar` role)
- `qa.cashier.a@example.local` (Demo Clinic A, `cashier` role)
- `qa.notenant@example.local` (No tenant assigned)
- `qa.multitenant@example.local` (Demo Clinic A admin + Demo Clinic B doctor)
- `qa.admin.b@example.local` (Demo Clinic B, `clinic_admin` role)

### App dev server
Vite server successfully run on `http://localhost:5174/`.

## 10. Smoke row setup

### Method used
SQL inserts performed directly on the local database via `npx supabase db query`.

### Tenant IDs used
- **Demo Clinic A**: `11111111-1111-1111-1111-111111111111` (verified existence prior to inserts).

### Activity rows inserted
1. **Admin Visibility**: Category: `patient`, Type: `smoke_admin_activity`, Title: `Smoke admin activity A`, Visibility: `admin`, Severity: `info`, Source: `smoke / smoke-admin-a`.
2. **Clinical Visibility**: Category: `finding`, Type: `smoke_clinical_activity`, Title: `Smoke clinical activity A`, Visibility: `clinical`, Severity: `warning`, Source: `smoke / smoke-clinical-a`.
3. **Financial Visibility**: Category: `payment`, Type: `smoke_financial_activity`, Title: `Smoke financial activity A`, Visibility: `financial`, Severity: `info`, Source: `smoke / smoke-financial-a`.
4. **Archived Activity**: Category: `system`, Type: `smoke_archived_activity`, Title: `Smoke archived activity A`, Visibility: `admin`, Severity: `debug`, Source: `smoke / smoke-archived-a`, `is_archived`: `true`.

### Audit rows inserted
1. **Patient Audit**: Category: `patient`, Action: `smoke_patient_update`, Severity: `info`, Target: `patient / smoke-patient-a`, Redaction: `standard`, Reason: `Smoke safe patient audit reason`.
2. **Role/System Audit**: Category: `role_membership`, Action: `smoke_role_check`, Severity: `warning`, Target: `tenant_user / smoke-role-a`, Redaction: `restricted`, Reason: `Smoke safe role audit reason`.
3. **Critical Audit**: Category: `system`, Action: `smoke_critical_check`, Severity: `critical`, Target: `system / smoke-critical-a`, Redaction: `confidential`, Reason: `Smoke safe critical audit reason`.
4. **Hidden Diff Test**: Category: `finding`, Action: `smoke_diff_hidden_check`, Severity: `info`, Target: `finding / smoke-finding-a`, Redaction: `standard`, Reason: `Smoke safe hidden diff reason`, `before_data`: `{"safeBeforeSmokeField":"before-value"}`, `after_data`: `{"safeAfterSmokeField":"after-value"}`, `diff_data`: `{"safeDiffSmokeField":"diff-value"}`.

### Marker counts before browser smoke
- `public.activity_events` marker count: **4**
- `public.audit_events` marker count: **4**

## 11. Admin A smoke result

### Route/sidebar/tabs
- Sidebar showed "Журнал действий": **Yes**
- Route `/admin/audit` successfully resolved: **Yes**
- Tabs "Активность" and "Аудит" visible: **Yes**

### Activity tab rendering
- `Smoke admin activity A` visible: **Yes**
- `Smoke clinical activity A` visible: **Yes**
- `Smoke financial activity A` visible: **Yes**
- `Smoke archived activity A` hidden by default: **Yes**
- Toggle "Показать архивные" (Show Archived) successfully reveals `Smoke archived activity A`: **Yes**

### Audit tab rendering
- `smoke_patient_update` visible: **Yes**
- `smoke_role_check` visible: **Yes**
- `smoke_critical_check` visible: **Yes**
- `smoke_diff_hidden_check` visible: **Yes**
- Reason and Redaction Level fields rendered correctly.

### Filters
- Visibility filter (admin/clinical/financial) works: **Yes**
- Category filter works: **Yes**
- Severity filter works: **Yes**
- Date from/to filters do not crash: **Yes**

### Pagination
- Navigation controls `Назад` / `Далее` are present and functional.

### Safety checks
- Raw metadata JSON is not dumped in UI.
- `before_data` / `after_data` / `diff_data` payloads are not rendered.
- The following secret strings do **NOT** appear in the page body:
  - `safeBeforeSmokeField` (ABSENT)
  - `safeAfterSmokeField` (ABSENT)
  - `safeDiffSmokeField` (ABSENT)
- No write, delete, edit, or create buttons present (read-only view).
- No passwords or service role keys visible in body.

### Console result
- No fatal errors or warning crashes in the browser console.

## 12. Denied roles result

Tested:
- `qa.doctor.a@example.local`
- `qa.receptionist.a@example.local`
- `qa.cashier.a@example.local`

For each:
- Sidebar does **NOT** show "Журнал действий": **Yes**
- Direct `/admin/audit` navigation is blocked with a safe "Доступ запрещён" (Access Denied) screen: **Yes**
- Clinic A smoke rows are **NOT** visible: **Yes**
- No fatal console errors.

## 13. No-tenant result

Tested: `qa.notenant@example.local`

Expected & Observed:
- Blocked by tenant gate screen: **Yes**
- Sidebar does **NOT** show "Журнал действий": **Yes**
- Direct `/admin/audit` navigation is redirected/blocked: **Yes**
- Smoke rows are **NOT** visible: **Yes**
- No fatal console errors.

## 14. Multi-tenant result

Tested: `qa.multitenant@example.local`

Expected & Observed:
- When active tenant is Demo Clinic A (admin access):
  - Sidebar shows "Журнал действий": **Yes**
  - Clinic A smoke rows visible: **Yes**
- When switched to Demo Clinic B (doctor access):
  - Viewer is hidden/denied: **Yes**
  - Clinic A smoke rows are not visible: **Yes**

## 15. Admin B / cross-tenant result

Tested: `qa.admin.b@example.local`

Expected & Observed:
- Sidebar shows "Журнал действий": **Yes**
- `/admin/audit` opens successfully: **Yes**
- Clinic A smoke rows are **NOT** visible (empty state "Событий по выбранным фильтрам нет." rendered instead): **Yes**
- None of the following strings appear in the page body:
  - `Smoke admin activity A` (ABSENT)
  - `Smoke clinical activity A` (ABSENT)
  - `Smoke financial activity A` (ABSENT)
  - `Smoke archived activity A` (ABSENT)
  - `smoke_patient_update` (ABSENT)
  - `smoke_critical_check` (ABSENT)

## 16. Cleanup result

- **Delete method**: Executed direct SQL DELETE queries targeting `metadata->>'smokeTest' = 'ADMIN-AUDIT-VIEWER-SMOKE-DATA-FIX-001'` via `npx supabase db query`.
- **Final marker counts**:
  - `activity_events` marker count: **0**
  - `audit_events` marker count: **0**
- No unrelated local developer or seed data was removed.

## 17. Issues found

- No bugs, limitations, or console fatal crashes found.

## 18. What was intentionally NOT changed

- No application source code modified.
- No database migrations created/changed.
- No standard database seed (`supabase/seed.sql`) modified.
- No Supabase Cloud project accessed/modified.
- RLS/grants left intact.
- No changes made to encounter/visit/timeline data models.
- No payments, stock, or document changes.

## 19. Checks

- `git status --short`: Only report file modified (`R _ai_work/REPORTS/ADMIN-AUDIT-VIEWER-SMOKE-001_browser_smoke.md -> _ai_work/REPORTS/ADMIN-AUDIT-VIEWER-SMOKE-DATA-FIX-001_browser_smoke.md`).
- `npm run lint`: **PASS** (completed with no errors).
- `npm run test -- --run`: **PASS** (414 tests across 47 test files).
- `npm run build`: **PASS** (build completes successfully).
- GitHub Actions CI (Run ID: `27767899790`, CI: `#543` on head reviewed commit): **SUCCESS**.

## 20. Final verdict

```
ADMIN AUDIT VIEWER SEEDED BROWSER SMOKE PASSED
```

## 21. Recommended next task

```
ENCOUNTER-VISIT-MODEL-001A
```
