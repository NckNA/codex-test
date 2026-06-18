# ADMIN-AUDIT-VIEWER-001 — Admin audit/activity viewer report

## 1. Summary

Implemented a read-only clinic admin audit/activity viewer for the active tenant.

The viewer exposes safe product-facing `activity_events` and compliance-oriented `audit_events` through the existing read-only `AuditActivityRepository`. It does not create, update, delete, or write audit/activity records. It does not use service-role access, raw SQL, localStorage fallback, migrations, or cloud changes.

## 2. Branch

`feature/admin-audit-viewer-001`

## 3. PR URL

https://github.com/NckNA/codex-test/pull/308

## 4. PR head reviewed before final report update

`36dce18ad80c9dff64e58ff5dee4caa1a0350cd8`

This is the PR head reviewed before the final report update. It includes the implementation commit and the final verified report state from CI #540.

## 5. Report update commit

N/A because the final report update commit cannot reference itself before creation.

## 6. Changed files summary

Implementation files:

- `src/pages/AdminAuditPage.tsx`
- `src/components/admin/AdminAuditViewer.tsx`
- `src/data/hooks/useAuditActivityEvents.ts`
- `src/App.tsx`
- `src/components/layout/Sidebar.tsx`

Tests:

- `src/components/admin/AdminAuditViewer.test.tsx`
- `src/data/hooks/useAuditActivityEvents.test.tsx`

Report:

- `_ai_work/REPORTS/ADMIN-AUDIT-VIEWER-001_admin_audit_viewer.md`

No migrations, Supabase config, seed data, patient timeline files, repository write methods, or cloud-related files were changed.

## 7. Current UI/routing recon

### Route pattern

`src/App.tsx` registers routes under the main `Layout` route. Pages are imported directly and mounted with `<Route path="..." element={<Page />} />`.

The new route follows that convention:

- `/admin/audit` → `AdminAuditPage`

### Navigation pattern

`src/components/layout/Sidebar.tsx` owns the sidebar item list and renders `NavLink` items. Before this task, the sidebar list was static and did not hide role-specific links.

This task adds one role-aware admin item:

- label: `Журнал действий`
- path: `/admin/audit`
- visible only when `activeTenant.role` is `clinic_owner` or `clinic_admin`

### Role guard pattern

Existing role information comes from `useTenant().activeTenant.role`. Existing pages use role checks locally, for example clinical dictionary management checks `clinic_owner` / `clinic_admin` before allowing management actions.

This task adds a small shared helper in `useAuditActivityEvents.ts`:

- `canViewAdminAudit(role)`

Allowed roles:

- `clinic_owner`
- `clinic_admin`

Blocked roles:

- `doctor`
- `registrar`
- `receptionist`
- `cashier`
- no tenant
- platform-like roles by default

### No-tenant behavior

The app already has a global no-tenant gate for Supabase-authenticated users without clinic membership. The new page also has a page-level safe no-tenant gate to avoid repository queries if the route is reached directly without an active tenant.

### Loading/error/empty state pattern

Existing pages use simple Tailwind cards, inline loading text/spinners, error cards, and empty states. The new viewer follows that pattern:

- loading: `Загрузка журнала...`
- error: `Не удалось загрузить журнал.` plus repository error message
- empty: `Событий по выбранным фильтрам нет.`

## 8. Implementation summary

### Page/route

Added `src/pages/AdminAuditPage.tsx`.

Behavior:

- no tenant: show `Клиника не назначена`, no query
- unauthorized role: show `Доступ запрещён`, no query
- `clinic_owner` / `clinic_admin`: render `AdminAuditViewer`

### Viewer component

Added `src/components/admin/AdminAuditViewer.tsx`.

It renders a read-only admin tool with two tabs:

1. `Активность`
   - source: `AuditActivityRepository.listActivityEvents`
   - purpose: product-facing tenant activity

2. `Аудит`
   - source: `AuditActivityRepository.listAuditEvents`
   - purpose: compliance/security audit records

The viewer renders safe summary fields only. It does not dump raw metadata or before/after/diff JSON.

### Hook

Added `src/data/hooks/useAuditActivityEvents.ts`.

Behavior:

- accepts tenant id, role, active tab, filters, and backend availability
- creates the existing read-only `AuditActivityRepository` only when enabled
- calls `listActivityEvents` for the activity tab
- calls `listAuditEvents` for the audit tab
- does not query when tenant id is missing
- does not query when role is not `clinic_owner` / `clinic_admin`
- does not query when backend is unavailable
- surfaces repository errors through the existing `useAsyncQuery` error path
- has no local/fake fallback

### Navigation item

Updated `src/components/layout/Sidebar.tsx`.

The sidebar now appends `Журнал действий` only for `clinic_owner` / `clinic_admin`.

### Tabs and filters

Common filters:

- category
- severity
- date from
- date to
- limit
- pagination offset via `Назад` / `Далее`

Activity-specific filters:

- visibility
- include archived

Audit-specific filters:

- target type
- patient id
- actor user id

Default limit is the repository default: `50`.

## 9. Access control

| User state / role | Viewer access | Repository query |
|---|---:|---:|
| `clinic_owner` | allowed | yes |
| `clinic_admin` | allowed | yes |
| `doctor` | denied | no |
| `registrar` | denied | no |
| `receptionist` | denied | no |
| `cashier` | denied | no |
| no tenant | denied / clinic gate | no |
| platform-like roles | denied by default | no |

RLS remains the real data security boundary. The frontend guard is an access/UX gate and prevents unnecessary repository calls before authorization is established.

## 10. Data behavior

### Activity events loading

Activity tab calls:

```ts
listActivityEvents({ tenantId, categories, visibility, occurredFrom, occurredTo, includeArchived, limit, offset })
```

Shown fields:

- occurred date
- category
- type
- title
- description
- visibility
- severity
- actor user id
- patient id
- source type / source id
- source status
- archive marker

### Audit events loading

Audit tab calls:

```ts
listAuditEvents({ tenantId, categories, severities, targetType, patientId, actorUserId, createdFrom, createdTo, limit, offset })
```

Shown fields:

- created date
- category
- action
- severity
- target type / target id
- actor display/user id
- actor role / tenant role
- patient id
- redaction level
- reason

### Tenant id handling

Tenant id always comes from `activeTenant.tenantId`. There is no UI control for changing tenant id.

### Pagination

The viewer uses limit plus offset controls:

- `Назад`
- `Далее`

The next button is enabled when the current page contains at least the requested limit.

## 11. Safety boundary

Preserved boundaries:

- read-only UI
- no create/update/delete audit/activity methods
- no RPC helper calls from UI
- no service-role access from client code
- no raw SQL from frontend
- no localStorage fallback
- no Supabase cloud changes
- no migrations
- no RLS/grants changes
- no raw before/after/diff display by default
- no direct metadata JSON dump in tables/lists
- no patient timeline changes
- no visits/encounters/completed services/payments/stock/documents implementation

The admin audit viewer is separate from patient timeline. Raw `audit_events` are not exposed in patient timeline.

## 12. Tests

Updated/added test files:

- `src/components/admin/AdminAuditViewer.test.tsx`
- `src/data/hooks/useAuditActivityEvents.test.tsx`

Covered scenarios:

1. `clinic_owner` can view admin audit page.
2. `clinic_admin` can view admin audit page.
3. `doctor` is denied and repository hook is not called.
4. `registrar` is denied and repository hook is not called.
5. `receptionist` is denied and repository hook is not called.
6. `cashier` is denied and repository hook is not called.
7. no-tenant state shows a safe gate and does not query.
8. Activity tab renders safe activity fields.
9. Audit tab renders safe audit fields.
10. Loading state renders.
11. Error state renders.
12. Empty state renders.
13. Activity filters are passed to the hook.
14. Audit category and pagination state are passed to the hook.
15. Hook passes audit filters to `listAuditEvents`, including category, severity, date range, target type, patient id, actor id, limit and offset.
16. Hook passes activity filters to `listActivityEvents`, including category, visibility, date range, include archived, limit and offset.
17. Hook does not query without tenant id.
18. Hook does not query for unauthorized roles.
19. Hook does not query when backend is unavailable.
20. Repository errors are surfaced.
21. Sidebar nav item appears for `clinic_owner` / `clinic_admin` only.
22. Sidebar nav item is hidden for `doctor`, `registrar`, `receptionist`, `cashier`, and no-tenant.
23. `beforeData`, `afterData`, `diffData` are not rendered in list/table.
24. `metadata` JSON is not rendered directly.
25. No audit/activity write method is introduced by the hook contract.

Full routing was validated at page/component level rather than browser smoke. Browser smoke is intentionally out of scope for this task.

## 13. What was intentionally NOT changed

- no migrations
- no Supabase cloud
- no local Supabase
- no browser smoke
- no audit write paths
- no service-role client usage
- no patient timeline changes
- no visits/encounters
- no completed services
- no payments implementation
- no stock implementation
- no documents implementation
- no repository write methods
- no RLS/grants changes
- no seed changes

## 14. Checks

Local checks on implementation head `7ca54fcb261f8784101063385d791e75bcdec333`:

- `git status --short`: clean before report creation
- `npm run lint`: PASS
- `npm run test -- --run`: PASS, 47 files / 414 tests
- `npm run build`: PASS

Warnings observed:

- existing React `act(...)` warnings in unrelated older tests
- existing Vite chunk-size warning

Both test and build commands exited successfully.

### GitHub Actions CI

Fresh CI after report push:

- Workflow: `CI`
- Run id: `27762876292`
- CI number: `540`
- Tested commit: `36dce18ad80c9dff64e58ff5dee4caa1a0350cd8`
- Status: completed
- Conclusion: success
- Required checks: ESLint, tests, build passed.

## 15. Final verdict

`ADMIN AUDIT VIEWER IMPLEMENTED AND VERIFIED`

## 16. Recommended next task

`ADMIN-AUDIT-VIEWER-SMOKE-001`
