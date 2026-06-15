# DICT-PERMISSION-UX-001: Hide clinical dictionary editing actions for non-admin clinic roles

## Summary

This report documents the implementation and validation of the clinical dictionary permission UX gating. Doctor and other non-admin roles now receive a read-only experience when viewing the `/medical` page, with all create, edit, and disable actions hidden or deactivated. Admin/owner roles and local development mode continue to support full dictionary management.

- **Branch name**: `fix/dict-permission-ux-001`
- **PR URL**: https://github.com/NckNA/codex-test/pull/279
- **PR head reviewed before final report update**: `b28c898ce1e1ec2e5d4bc99db571b25af48dda0b`
- **Report update commit**: N/A because the final report update commit cannot reference itself before creation.

---

## Changed Files Summary

- `src/pages/MedicalPage.tsx`
- `src/pages/MedicalPage.test.tsx`
- `_ai_work/REPORTS/DICT-PERMISSION-UX-001_dictionary_edit_permission_ux.md`

---

## Root Cause

During `MULTITENANT-QA-001`, it was observed that doctor users could see edit/disable/create actions on `/medical` for clinical dictionary items, even though Supabase RLS policies block writes. Attempting to save edits resulted in raw database write errors. The UI lacked role-based permission checks to hide or disable editing actions before they were executed.

---

## Permission Rule Implemented

A local permissions flag `canManage` is derived dynamically inside `MedicalPage` using the active auth mode and active tenant role:

- **Local/Dev Mode (`authMode === 'dev'`)**:
  - Full management access remains available (convenient for local debugging/development).
- **Supabase-Active Mode (`authMode === 'supabase-active'`)**:
  - **clinic_admin** / **clinic_owner**: Allowed to create, edit, and disable dictionary items.
  - **doctor** / **receptionist / registrar** / **any unknown role**: Read-only access.
    - Create buttons (`+ Диагноз`, `+ Работа`) are hidden.
    - Inline edit and toggle action buttons are hidden.
    - A read-only notice is displayed: *"Справочники доступны только для просмотра. Редактирование доступно администратору клиники."*
  - **No active tenant (`activeTenant === null`)**:
    - The tenant gate remains intact, displaying the clinic-not-assigned warning rather than fallback/leak data.

---

## Tests Added/Updated

A new test suite was created in [MedicalPage.test.tsx](file:///d:/Users/User/Documents/GitHub/codex-test/src/pages/MedicalPage.test.tsx) covering all role permission scenarios:

1. **A. Dev/local mode**: Ensures dictionary management actions (+ Diagnosis, + Work, Edit, Toggle) remain available and no read-only note is shown.
2. **B. Supabase clinic_admin**: Ensures edit/create/disable controls are visible and enabled.
3. **C. Supabase clinic_owner**: Ensures edit/create/disable controls are visible and enabled.
4. **D. Supabase doctor**: Ensures dictionaries are visible/readable, but edit/create/disable buttons are hidden, and read-only notice is displayed.
5. **E. Supabase non-admin/receptionist**: Ensures edit/create/disable actions are hidden, and read-only notice is displayed.
6. **F. Supabase no-tenant**: Ensures no-tenant boundary remains intact, showing no edit actions or leaked local dictionary items.

---

## Browser Smoke Validation

Validation was conducted against local Supabase fixture users at `http://localhost:5173/`:

### 1. Admin A: qa.admin.a@example.local — local QA password used, not documented.
- Logged in successfully.
- Navigated to `/medical`.
- Verified that `+ Диагноз`, `+ Работа`, and all edit/disable buttons are visible.
- Verified no read-only banner is displayed.

### 2. Doctor A: qa.doctor.a@example.local — local QA password used, not documented.
- Logged in successfully.
- Navigated to `/medical`.
- Verified that dictionary items render successfully.
- Verified that `+ Диагноз`, `+ Работа`, and edit/disable buttons are hidden.
- Verified that the read-only warning banner is correctly rendered: *"Справочники доступны только для просмотра. Редактирование доступно администратору клиники."*
- Checked DevTools console and network logs: no failed write operations or error messages.

### 3. No-Tenant: qa.notenant@example.local — local QA password used, not documented.
- Logged in successfully.
- Navigated to `/medical`.
- Verified that the tenant block screen is displayed (*"Клиника не назначена"*).
- Checked that no dictionary edit controls or localStorage dictionaries are leaked.

### 4. Local/Dev Mode
- Renamed `.env.local` to trigger fallback dev mode.
- Verified that all management buttons are visible, allowing local developers to manage dictionary items without database restrictions.

---

## What was intentionally NOT changed

- No RLS changes or Supabase policies modified.
- No Supabase schema updates or database migrations added.
- No repository persistence logic modified in `src/data/repositories/*`.
- No modification of `useDictionaries` hook.
- No changes to `AuthContext` or `TenantContext`.
- No new packages or dependencies added to `package.json`.
- The global layout header's role display name bug was not fixed here (to keep changes minimal and isolated to the components on the `/medical` page).

---

## Remaining Known Issues

- The role label in the header layout may still display "Администратор" for non-admin clinic roles (tracked as `ROLE-LABEL-UX-001`).
- Warnings about `SECURITY DEFINER` RPC execution permissions in Supabase (tracked as `SECURITY-DEFINER-RPC-HARDENING-001`).
- Treatment stages deletion sync/transaction issues (tracked as `TREATMENT-STAGES-SYNC-TRANSACTION-001`).

---

## Checks

- `git status --short`:
  ```
  M _ai_work/REPORTS/DICT-PERMISSION-UX-001_dictionary_edit_permission_ux.md
  ```
- `npm run lint`: **PASS** (Zero lint warnings or errors).
- `npm run test -- --run`: **PASS** (All 267 tests pass successfully with `.env.local` temporarily moved during tests).
- `npm run build`: **PASS** (Application built successfully with Vite/tsc compiler).
- `GitHub Actions CI result`: **PASS** (Workflow CI, run #369, run id 27532695313, head b28c898ce1e1ec2e5d4bc99db571b25af48dda0b).

---

## Final Verdict

**READY FOR REVIEW**

---

## Recommended Next Task

**SECURITY-DEFINER-RPC-HARDENING-001**: Harden `SECURITY DEFINER` RPC execution permissions.
