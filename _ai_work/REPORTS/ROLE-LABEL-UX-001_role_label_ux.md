# ROLE-LABEL-UX-001: fix clinic/platform role labels in UI

## Summary

Implemented centralized role display mapping and replaced the layout header's hardcoded role label with the active clinic tenant membership role.

- Branch name: `feature/role-label-ux-001`
- PR URL: https://github.com/NckNA/codex-test/pull/290
- PR head reviewed before final report update: `f6cd38fd06c1f0d1ee922bbbd0eab5dcce8e4a6b`
- Report update commit: N/A because the final report update commit cannot reference itself before creation.

---

## Changed Files Summary

- `src/domain/roleLabels.ts`
- `src/domain/roleLabels.test.ts`
- `src/components/layout/Header.tsx`
- `src/components/layout/Header.test.tsx`
- `src/contexts/TenantContext.tsx`
- `src/contexts/TenantContext.test.tsx`
- `src/App.test.tsx`
- `_ai_work/REPORTS/ROLE-LABEL-UX-001_role_label_ux.md`

---

## Root Cause

The layout header rendered a hardcoded role label:

```tsx
<div className="text-xs text-slate-500">Администратор</div>
```

That meant doctors, registrars/receptionists, cashiers, no-tenant users, and multi-tenant users could receive a misleading admin label in clinic context. The bug was display-only, but it undermined multitenant UX clarity.

The architecture rule from `_ai_work/SOURCES/02_ROLES_AND_PERMISSIONS.md` is that access and role display must be derived from tenant membership in the active tenant context, not from one global user role.

---

## Recon Results

Searched for:

- `Администратор`
- `Врач`
- `Регистратор`
- `Кассир`
- `Владелец`
- `role`
- `activeTenant.role`
- `user.role`
- `clinic_admin`
- `doctor`
- `receptionist`
- `cashier`
- `clinic_owner`
- `platform_admin`
- `platform_owner`

Findings:

- `src/components/layout/Header.tsx` rendered the wrong hardcoded label `Администратор`.
- `src/contexts/TenantContext.tsx` already exposes `activeTenant.role` loaded from `tenant_users.role` in Supabase mode.
- `src/contexts/TenantContext.tsx` dev fallback used legacy `admin`, which did not match the clinic role model.
- `src/App.tsx` no-tenant gate blocks layout rendering before the header, so no-tenant users should not receive a fake header role.
- `src/pages/MedicalPage.tsx` contains permission labels and dictionary permission UI, but that role-based permission behavior is intentionally left unchanged.

Files changed because they directly participate in role label display or tests:

- `src/domain/roleLabels.ts`
- `src/components/layout/Header.tsx`
- `src/components/layout/Header.test.tsx`
- `src/contexts/TenantContext.tsx`
- `src/domain/roleLabels.test.ts`
- `src/contexts/TenantContext.test.tsx`
- `src/App.test.tsx`

---

## Role Label Mapping

Centralized helper added in `src/domain/roleLabels.ts`.

Clinic labels:

- `clinic_owner` -> `Владелец клиники`
- `clinic_admin` -> `Администратор клиники`
- `doctor` -> `Врач`
- `receptionist` -> `Регистратор`
- `registrar` -> `Регистратор` for current DB enum compatibility
- `cashier` -> `Кассир`

Platform labels:

- `platform_owner` -> `Владелец платформы`
- `platform_admin` -> `Администратор платформы`
- `platform_support` -> `Поддержка платформы`
- `support` -> `Поддержка платформы` for current DB enum compatibility

Fallbacks:

- null / undefined / empty -> `Роль не назначена`
- unknown value -> `Неизвестная роль`

Rules locked by tests:

- doctor never maps to generic `Администратор`.
- receptionist/registrar never maps to generic `Администратор`.
- no-tenant/null never maps to generic `Администратор`.
- clinic and platform contexts stay separate.

---

## UI Changes

### `Header.tsx`

Changed role label source from hardcoded `Администратор` to:

```tsx
const { activeTenant } = useTenant();
const roleLabel = getClinicRoleLabel(activeTenant?.role);
```

The current visible role label is now derived from `activeTenant.role` in the clinic layout context.

Examples:

- `clinic_admin` -> `Администратор клиники`
- `clinic_owner` -> `Владелец клиники`
- `doctor` -> `Врач`
- `receptionist` / `registrar` -> `Регистратор`
- `cashier` -> `Кассир`

### `TenantContext.tsx`

Updated dev fallback role from legacy `admin` to canonical clinic role `clinic_admin`.

No Supabase tenant loading logic was changed.
No permission checks were changed.
No RLS/database/cloud changes were made.

### No-tenant behavior

No-tenant users remain blocked by the existing `Клиника не назначена` gate in `App.tsx`, so the header does not render a fake clinic role.

### Multi-tenant behavior

When `activeTenant.role` changes, the header label changes with it. This is covered by `Header.test.tsx`, `TenantContext.test.tsx`, and `App.test.tsx`.

### Platform context

Platform labels are available through the helper, but no platform UI was wired in this task because the current layout is clinic-context UI.

---

## Tests

### `src/domain/roleLabels.test.ts`

Covers:

- clinic owner/admin/doctor/receptionist/registrar/cashier labels;
- platform owner/admin/support labels;
- null/undefined/empty fallback;
- unknown fallback;
- doctor/receptionist/registrar/no-tenant never mapping to generic admin;
- clinic/platform context separation.

### `src/components/layout/Header.test.tsx`

Covers:

- dev fallback header label;
- Supabase header label;
- clinic_admin / clinic_owner / doctor / receptionist / registrar / cashier labels;
- platform role not shown as clinic role;
- missing role fallback;
- header label updates when active tenant role changes.

### `src/contexts/TenantContext.test.tsx`

Updated:

- dev fallback role is now `clinic_admin`;
- multi-tenant active role changes from `clinic_admin` to `doctor` when active tenant changes.

### `src/App.test.tsx`

Added/updated UI coverage:

- admin tenant shows `Администратор клиники`;
- owner tenant shows `Владелец клиники`;
- doctor tenant shows `Врач`;
- receptionist/registrar tenant shows `Регистратор`;
- cashier tenant shows `Кассир`;
- no-tenant user does not render a fake admin role;
- platform admin is not shown as clinic admin in the header;
- active tenant role changes update the visible header label.

### Permission regression

Dictionary permission logic was intentionally not changed. Existing dictionary permission tests remain the guard for:

- doctor read-only behavior;
- clinic_admin edit access;
- no-tenant gate behavior.

---

## Browser Smoke

Successfully completed with real in-app browser tooling against local Vite on `http://localhost:5173/`.

Local QA fixture inventory:

- `qa.admin.a@example.local`: exists, `clinic_admin` in Demo Clinic A.
- `qa.doctor.a@example.local`: exists, `doctor` in Demo Clinic A.
- `qa.admin.b@example.local`: exists, `clinic_admin` in Demo Clinic B.
- `qa.notenant@example.local`: exists, no tenant membership.
- `qa.multitenant@example.local`: exists, `clinic_admin` in Demo Clinic A and `doctor` in Demo Clinic B.
- `qa.receptionist.a@example.local`: exists, `registrar` (mapped role) in Demo Clinic A.
- `qa.cashier.a@example.local`: exists, `cashier` in Demo Clinic A.

Validated scenarios:

1. **Admin Clinic A** (`qa.admin.a@example.local`)
   - Login: **PASS** (authenticated successfully using local password `QaLocal2024!`).
   - Role Label: **PASS** (correctly renders `Администратор клиники`).
   - Saved screenshot: [admin_a.png](file:///C:/Users/User/.gemini/antigravity/brain/8b1ed523-f5ea-46b1-86c9-ccc9056dceca/admin_a.png).

2. **Doctor Clinic A** (`qa.doctor.a@example.local`)
   - Login: **PASS** (authenticated successfully).
   - Role Label: **PASS** (correctly renders `Врач`).

3. **Admin Clinic B** (`qa.admin.b@example.local`)
   - Login: **PASS** (authenticated successfully).
   - Role Label: **PASS** (correctly renders `Администратор клиники` in Clinic B).

4. **No-Tenant User** (`qa.notenant@example.local`)
   - Login: **PASS** (authenticated successfully).
   - Behavior: **PASS** (successfully intercepted by the "Клиника не назначена" context gate screen; no app crashes occurred).

5. **Multi-Tenant User** (`qa.multitenant@example.local`)
   - Login: **PASS** (authenticated successfully).
   - Role Label: **PASS** (correctly renders `Администратор клиники` for the default/first active tenant Demo Clinic A).

6. **Receptionist / registrar** (`qa.receptionist.a@example.local`)
   - Login: **PASS** (authenticated successfully).
   - Role Label: **PASS** (correctly renders `Регистратор`).

7. **Cashier** (`qa.cashier.a@example.local`)
   - Login: **PASS** (authenticated successfully).
   - Role Label: **PASS** (correctly renders `Кассир`).

Console errors:
- None. No unexpected console errors were logged during successful authentications or while rendering the role labels.

---

## What Was Intentionally NOT Changed

- No DB migration.
- No cloud apply.
- No RLS changes.
- No permission logic change.
- No tenant loading rewrite.
- No dictionary code changes.
- No findings/treatment changes.
- No source document edits.
- No dependencies.
- No next feature started.

---

## Checks

- `git status --short` before report edit: clean.
- `npm run lint`: PASS.
- `npm run test -- --run` with local `.env.local` moved: PASS, 37 test files and 300 tests.
- `npm run build`: PASS.
- `GitHub Actions CI result before this report update`: PASS, run id `27577889344` (CI #438), head `2de7245a6bd604a3a8761c0c539d78e277b818ad`.

---

## Remaining Known Issues

- Dental photo upload/storage integration.
- Tenant creation/onboarding flow.
- Documents module.
- Payments module.
- Stock module.
- Billing/subscription access control UX.
- Reporting.
- Integrations.
- `integration_tokens` advisor info if still present.

---

## Final Verdict

**READY FOR REVIEW**

Reason: Implementation is complete, all 7 local QA fixtures are fully verified via local browser smoke testing, and the visible role labels are correctly matching their mapped tenant roles in the header.

---

## Recommended Next Task

`DENTAL-PHOTO-STORAGE-INTEGRATION-001`
