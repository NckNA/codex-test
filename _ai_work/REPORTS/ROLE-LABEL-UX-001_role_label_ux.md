# ROLE-LABEL-UX-001: fix clinic/platform role labels in UI

## Summary

Implemented centralized role display mapping and replaced the layout header's hardcoded role label with the active clinic tenant membership role.

- Branch name: `feature/role-label-ux-001`
- PR URL: [Pending PR creation]
- PR head reviewed before final report update: [Pending PR creation]
- Report update commit: N/A because the final report update commit cannot reference itself before creation.

---

## Changed Files Summary

- `src/domain/roleLabels.ts`
- `src/domain/roleLabels.test.ts`
- `src/components/layout/Header.tsx`
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

When `activeTenant.role` changes, the header label changes with it. This is covered by `App.test.tsx`.

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

Blocked in this environment: Chrome DevTools MCP is not available, so I could not perform real browser login/navigation smoke.

Not faked.

Required manual smoke after CI if browser tooling is available:

1. Admin Clinic A: visible role label should be `Администратор клиники`, not generic `Администратор`.
2. Doctor Clinic A: visible role label should be `Врач`; dictionary page should remain read-only.
3. No-tenant user: no fake admin role; no-tenant gate remains.
4. Multi-tenant fixture: switching active tenant should update visible role label.

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

- `git status --short`: not run locally; GitHub PR file list must be used as source of truth.
- `npm run lint`: pending GitHub Actions CI.
- `npm run test -- --run`: pending GitHub Actions CI.
- `npm run build`: pending GitHub Actions CI.
- `GitHub Actions CI result`: pending.

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

**PARTIAL**

Reason: implementation is complete, but GitHub Actions CI and browser smoke are not completed yet.

---

## Recommended Next Task

`DENTAL-PHOTO-STORAGE-INTEGRATION-001`
