# NO-TENANT-UI-001: Add no-tenant blocked screen

## Summary
Added blocked UI states in `App.tsx` for authenticated users connecting via Supabase who do not yet have an assigned clinic (`tenant`), as well as dedicated loading and error states for the tenant data fetching layer.

## Changed Files
- `src/App.tsx`
- `src/App.test.tsx`
- `_ai_work/REPORTS/NO-TENANT-UI-001_blocked_screen_report.md` (Added)

## Behavior Added
- **Tenant Loading Screen**: An explicit "Загрузка клиники..." spinner appears when an authenticated user is awaiting `TenantContext` initialization.
- **Tenant Error Screen**: If the `tenant_users` query fails, the user sees a "Не удалось загрузить клинику" view displaying the error message and a "Выйти" (Logout) button.
- **No-Tenant Blocked Screen**: If `activeTenant === null` and `availableTenants` is empty after fetching is complete, the user is presented with a "Клиника не назначена" screen. This securely blocks all private `react-router` routes and prompts them to log out or contact an administrator.

## Tests Added
Tests in `App.test.tsx` have been completely revamped to explicitly assert all 7 required states:
1. Dev mode remains perfectly bypassed into regular app routing.
2. Auth loading renders the auth spinner.
3. No user renders `LoginPage`.
4. User + Tenant loading renders "Загрузка клиники...".
5. User + Tenant error renders "Не удалось загрузить клинику" and logout button works.
6. User + Zero tenants renders "Клиника не назначена" and logout button works.
7. User + Active tenant renders regular app routes securely.

## Confirmations
- ✅ Dev mode unchanged.
- ✅ No `TenantContext.tsx` or `AuthContext.tsx` logic changes.
- ✅ No repositories, storage, migrations, seed, or package dependencies were altered.

## Validation Results
- `npm ci`: Passed
- `npm run lint`: Passed
- `npm run test`: Passed
- `npm run build`: Passed

## Remaining Risks
- Now that both frontend and backend architectures are in place for fetching tenants, local testing remains impossible out-of-the-box because `seed.sql` deliberately omits `auth.users` row seeding. A developer must know the manual steps required to set up local Supabase Auth for a clinic.

## Recommended Next Task
**DOCS-TENANT-LOCAL-001: Document local Supabase auth user/profile/tenant_users setup**

This continues to be the primary blocker before anyone can QA the new login-to-tenant workflow. We need a clear, repeatable, documented process for creating test users via the local Supabase Studio and linking them to mock clinics.
