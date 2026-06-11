# PROJECT-AUDIT-BACKFILL-002: Auth / Tenant / Supabase foundation reconciliation

## 0. Purpose

This is a report-only reconciliation of the Auth / Tenant / Supabase foundation layer.

The goal is not to create new behavior. The goal is to compare earlier architecture and implementation reports against the current `main` branch and mark which assumptions are still valid, which are superseded, and which must not be reused as current truth.

This report follows `PROJECT-AUDIT-BACKFILL-001`, which reconciled the first foundation audits (`AUDIT-001` to `AUDIT-005` and `QA-001`).

## 1. Scope

### In scope

- Supabase client boundary.
- Auth context.
- Login gate.
- Logout UI.
- Tenant context.
- Real tenant loading.
- No-tenant blocked screen.
- Root provider and route wiring.
- Known prerequisites before repository work.

### Out of scope

- Patient repository behavior.
- Chief complaint repository behavior.
- Doctor repository behavior.
- Appointment repository behavior.
- Dental chart behavior.
- Findings behavior.
- Treatment plan behavior.
- Supabase production deployment.
- Live database verification.
- New implementation.

## 2. Sources reviewed

### Prior reports reviewed

- `ARCH-073_supabase_auth_tenant_skeleton_report.md`
- `RECON-074_auth_tenant_wiring_readiness_report.md`
- `AUTH-001_auth_tenant_provider_wiring_report.md`
- `RECON-AUTH-REAL-001_supabase_auth_flow_plan.md`
- `AUTH-REAL-001A_supabase_session_context_report.md`
- `AUTH-REAL-001B_login_page_auth_gate_report.md`
- `AUTH-REAL-001D_logout_ui_auth_smoke_tests_report.md`
- `RECON-TENANT-REAL-001_tenant_loading_plan.md`
- `TEST-TENANT-REAL-001_tenant_context_behavior_tests_report.md`
- `TENANT-REAL-001A_real_tenant_loading_report.md`
- `NO-TENANT-UI-001_blocked_screen_report.md`

### Current main files reviewed

- `src/lib/supabaseClient.ts`
- `src/contexts/AuthContext.tsx`
- `src/contexts/TenantContext.tsx`
- `src/App.tsx`
- `src/main.tsx`

## 3. Status vocabulary

- `VALID`: still correct and can be used as current project truth.
- `PARTIALLY VALID`: partly correct, but must be read with updated notes.
- `SUPERSEDED`: replaced by later implementation.
- `STALE`: historically useful, but not a safe guide for new tasks.
- `DANGEROUS IF USED`: using it as current truth can create wrong tasks or broken architecture.

## 4. Current foundation summary

### 4.1 Current root wiring

Current root structure:

```text
main.tsx
  storage.init()
  AuthProvider
    TenantProvider
      App
        BrowserRouter
          Routes
```

Meaning:

- `storage.init()` still runs at startup.
- Auth and Tenant providers are already mounted above the application.
- Routing now lives in `App.tsx`, not directly in `main.tsx`.
- `App.tsx` consumes both auth and tenant contexts.
- Private app routes are blocked in `supabase-active` mode until auth and tenant requirements are satisfied.

### 4.2 Current Supabase client boundary

Current status:

- Supabase client exists in `src/lib/supabaseClient.ts`.
- Client is created only when frontend environment values are present.
- When config is absent, `supabase` is `null` and `isSupabaseConfigured` is false.
- This preserves dev/local fallback behavior.
- Frontend must use anon/client-side configuration only.

Status: `VALID`.

### 4.3 Current AuthContext behavior

Current status:

- `AuthContext` supports two modes:
  - `dev`
  - `supabase-active`
- `dev` mode yields deterministic mock user data and does not call Supabase.
- `supabase-active` mode calls Supabase session APIs and listens for auth state changes.
- `signIn` and `signOut` exist.
- In dev mode, auth actions safely no-op.

Status: `VALID`.

### 4.4 Current Login / App gate behavior

Current status:

- `LoginPage` exists.
- `App.tsx` gates app rendering in `supabase-active` mode:
  - auth loading => loading screen;
  - no user => login page;
  - authenticated user => tenant checks;
  - active tenant => app routes.
- Dev mode bypasses auth gate and renders the prototype app.

Status: `VALID`.

### 4.5 Current TenantContext behavior

Current status:

- `TenantContext` consumes `useAuth()`.
- Dev mode yields the static dev tenant.
- Supabase-active mode waits for auth.
- Authenticated Supabase user triggers query against `tenant_users` joined with tenant metadata.
- Query is filtered by current `user.id`.
- First available tenant becomes active by default.
- `setActiveTenant` only accepts tenants already loaded for that user.
- User switching clears old tenant access by tying loaded state to `user.id`.

Status: `VALID`.

### 4.6 Current no-tenant protection

Current status:

- `App.tsx` has tenant loading, tenant error, and no-tenant blocked states.
- If user is authenticated but has no tenant mapping, private routes are not rendered.
- The user sees a clinic-not-assigned blocked screen and can sign out.

Status: `VALID`.

## 5. Prior report reconciliation

## 5.1 ARCH-073: Supabase Auth & Tenant Context Skeleton

Original claim:

- Supabase client, `AuthContext`, and `TenantContext` skeletons were added.
- Providers were not yet wired into the React tree.
- No repositories were migrated.
- Storage remained unchanged.

Current main:

- Supabase client still exists.
- Providers are now wired above the application.
- Auth and Tenant contexts are no longer only skeletons.
- Repository work has progressed in later domains, but this report remains accurate for its time.

Status: `PARTIALLY VALID`.

New note:

- Use `ARCH-073` only as the birth record of the Supabase/Auth/Tenant boundary.
- Do not use it to describe current provider wiring or current tenant behavior.

Risk if reused as current truth:

- A task may incorrectly assume providers are not mounted yet.

## 5.2 RECON-074: Auth/Tenant Wiring Readiness

Original claim:

- There was no `App.tsx`.
- Routes were defined in `main.tsx`.
- Auth/Tenant providers were ready for skeleton wiring only.
- Repository migration was not ready because singleton repositories could not receive tenant context.

Current main:

- `App.tsx` exists.
- Routes are now in `App.tsx`.
- Auth/Tenant providers are wired.
- Auth is real enough for session/login/logout flow.
- Tenant loading is real enough to query tenant membership.
- Repository migration has already occurred for some domains through later factory/repository work.

Status: `SUPERSEDED` for root wiring and auth readiness.
Status: `PARTIALLY VALID` for the architectural warning about repository boundaries.

New note:

- The warning remains conceptually important: no repository should directly guess tenant scope.
- However, it is no longer true that providers are not wired or that `App.tsx` does not exist.

Risk if reused as current truth:

- An agent may propose extracting routes or wiring providers again.

## 5.3 AUTH-001: Auth/Tenant Provider Wiring

Original claim:

- `AuthProvider` wraps `TenantProvider`, which wraps routing.
- Dev fallback user and dev tenant are available.
- Repositories remain unchanged.
- Real login was not implemented.

Current main:

- Provider order remains conceptually correct.
- `main.tsx` now wraps `<App />`, not the full router directly.
- Dev fallback is still preserved.
- Real login/session/logout has since been implemented.

Status: `PARTIALLY VALID`.

New note:

- This report is valid for provider order and fallback concept.
- It is superseded for auth capability because `AuthContext` now handles real Supabase sessions.

Risk if reused as current truth:

- A task may wrongly assume there is still no login/session behavior.

## 5.4 RECON-AUTH-REAL-001: Supabase Auth Flow Plan

Original claim:

- AuthContext lacked real session handling.
- `App.tsx` did not exist.
- Routing extraction was needed before clean route guards.
- Tenant loading should be postponed.

Current main:

- `AuthContext` has real session handling.
- `App.tsx` exists.
- Login gate exists.
- Tenant loading is implemented.
- No-tenant blocked UI exists.

Status: `SUPERSEDED`.

New note:

- Keep this report as historical planning only.
- Do not use it to determine current readiness.

Risk if reused as current truth:

- It may cause duplicate route extraction, duplicate login planning, or unnecessary blocking of tenant work.

## 5.5 AUTH-REAL-001A: Supabase Session Context

Original claim:

- `AuthContext` calls Supabase session APIs in active mode.
- It listens for auth state changes.
- Dev fallback remains intact.
- Login page and route guards were not added yet.

Current main:

- Session handling remains active.
- Dev fallback remains active.
- Login page and route guards were added later.

Status: `PARTIALLY VALID`.

New note:

- Current auth session behavior remains valid.
- The “no login page / no route guard” part is superseded.

Risk if reused as current truth:

- A task may wrongly plan LoginPage as missing.

## 5.6 AUTH-REAL-001B: Login Page and Auth Gate

Original claim:

- Login page exists.
- Auth gate exists in `App.tsx`.
- TenantContext still had no real tenant loading.
- Logout UI was missing.

Current main:

- Login page still exists.
- Auth gate still exists.
- Tenant loading is now implemented.
- Logout UI now exists.

Status: `PARTIALLY VALID`.

New note:

- Valid for LoginPage and auth gate.
- Superseded for tenant loading and logout gaps.

Risk if reused as current truth:

- A task may ask for logout UI or tenant loading as if still missing.

## 5.7 AUTH-REAL-001D: Logout UI and Auth Smoke Tests

Original claim:

- Logout UI exists.
- Auth tests cover dev and active states.
- TenantContext remained mock-driven.
- Repository operations remained localStorage-bound.

Current main:

- Logout UI remains part of auth foundation.
- Auth tests remain relevant.
- TenantContext is no longer mock-only in Supabase-active mode.
- Some repositories are no longer purely localStorage-only.

Status: `PARTIALLY VALID`.

New note:

- Valid for logout/auth test baseline.
- Superseded for tenant and repository state.

Risk if reused as current truth:

- A task may incorrectly block repository migration because it assumes tenant loading does not exist.

## 5.8 RECON-TENANT-REAL-001: Tenant Loading Plan

Original claim:

- TenantContext should fetch tenant access using authenticated user id.
- Zero tenants must produce a blocked UI state.
- Local manual setup is needed for real Supabase auth/tenant QA.
- Tenant switcher UI is not ready.
- Repository migration should wait for tenant loading.

Current main:

- TenantContext now fetches tenant access using current user id.
- Zero tenants are blocked in `App.tsx`.
- Tenant switcher UI is still not implemented.
- Local manual setup remains a practical blocker for live Supabase QA.
- Repository work in later domains must still respect tenant guard/factory rules.

Status: `PARTIALLY VALID`.

New note:

- Implementation recommendations are mostly completed.
- The remaining live-QA and tenant switcher cautions remain valid.

Risk if reused as current truth:

- It may duplicate tenant loading implementation.
- It remains useful for live Supabase QA prerequisites.

## 5.9 TEST-TENANT-REAL-001: TenantContext Behavior Tests

Original claim:

- Tests captured the pre-implementation placeholder behavior.
- Future behavior was documented.
- Production TenantContext was not changed.
- Local setup documentation remained needed.

Current main:

- TenantContext implementation has moved beyond placeholder behavior.
- Tests were updated by later implementation.
- Local setup documentation / repeatable QA remains important.

Status: `SUPERSEDED` for placeholder behavior.
Status: `PARTIALLY VALID` for QA/setup warning.

New note:

- Do not rely on this report to describe current TenantContext behavior.
- Use `TENANT-REAL-001A` and current `TenantContext.tsx` instead.

Risk if reused as current truth:

- It may incorrectly assert that supabase-active authenticated users still produce no real tenant query.

## 5.10 TENANT-REAL-001A: Real Tenant Loading

Original claim:

- TenantContext queries tenant access for authenticated Supabase users.
- Query is filtered by authenticated user id.
- First returned tenant becomes active.
- Unknown tenant selection is rejected.
- No tenant switcher UI or persistence.
- No repository migration was included.

Current main:

- Current `TenantContext.tsx` matches these core claims.
- `App.tsx` later added no-tenant UI.
- Tenant switcher UI still absent.
- Active tenant persistence still absent.

Status: `VALID`.

New note:

- This is the current key report for tenant-loading behavior.
- Pair it with `NO-TENANT-UI-001` and current code before repository work.

Risk if reused without latest context:

- It still says no no-tenant screen, which is now superseded.

## 5.11 NO-TENANT-UI-001: Blocked Screen

Original claim:

- App blocks authenticated users with no assigned clinic.
- Tenant loading and error screens exist.
- Tests cover dev bypass, auth loading, no user, tenant loading, tenant error, zero tenants, and active tenant.
- Local Supabase auth/tenant setup remains a practical QA blocker.

Current main:

- Current `App.tsx` matches these behaviors.
- This is the current key report for auth/tenant route gating.

Status: `VALID`.

New note:

- This report is the current no-tenant protection baseline.

Risk if ignored:

- Future tasks may bypass tenant checks and render private routes without active tenant.

## 6. Current route/state matrix

| Mode | Auth state | Tenant state | App result | Status |
|---|---|---|---|---|
| dev | mock user | dev tenant | app routes render | VALID fallback |
| supabase-active | loading | not evaluated | auth loading screen | VALID |
| supabase-active | no user | no tenant | login page | VALID |
| supabase-active | user | tenant loading | clinic loading screen | VALID |
| supabase-active | user | tenant query error | clinic error screen | VALID |
| supabase-active | user | zero tenants | clinic not assigned screen | VALID |
| supabase-active | user | active tenant | app routes render | VALID |

## 7. Current foundation safeguards

### 7.1 Safeguard: dev fallback

Current state:

- Missing Supabase config does not crash the app.
- App renders with dev user and dev tenant.
- Existing localStorage prototype flow remains available.

Status: `VALID`.

### 7.2 Safeguard: auth gate

Current state:

- In Supabase-active mode, unauthenticated users do not see private routes.

Status: `VALID`.

### 7.3 Safeguard: tenant loading boundary

Current state:

- Tenant state is loaded only after authenticated user exists.
- Query is scoped by current user id.
- Tenant selection can only be one of the loaded tenants.

Status: `VALID`.

### 7.4 Safeguard: no-tenant blocked screen

Current state:

- Authenticated users without clinic mapping are blocked before private routes.

Status: `VALID`.

### 7.5 Safeguard: frontend Supabase boundary

Current state:

- Supabase client is nullable.
- App code must guard Supabase usage.
- Frontend must not use server-only access.

Status: `VALID`.

## 8. Remaining gaps and risks

### 8.1 Live Supabase local setup is still not fully frictionless

The reports repeatedly note that local Supabase auth/tenant testing needs manual user/profile/tenant mapping setup.

Current status:

- No reviewed report in this backfill proves that a repeatable local setup guide has been created.
- Live tenant QA may still depend on manual setup knowledge.

Status: `PARTIALLY OPEN`.

Recommended future task:

- `DOCS-TENANT-LOCAL-001` or equivalent, unless already completed elsewhere and not found in this pass.

### 8.2 Tenant switcher UI is still not implemented

Current status:

- `TenantContext` supports multiple tenants internally.
- `setActiveTenant` exists.
- Header/app has no reviewed clinic switcher UI in this backfill.

Status: `OPEN`.

Do not implement until a scoped UI task exists.

### 8.3 Active tenant persistence is still not implemented

Current status:

- `TenantContext` selects first tenant by default.
- No reviewed persistence for chosen tenant exists in this pass.

Status: `OPEN`.

This is not a blocker for single-tenant clinic use, but matters for users with multiple clinics.

### 8.4 Browser QA evidence must be treated separately

Current status:

- Unit/build checks are repeatedly reported.
- Real browser verification of every auth/tenant state is not established by this report.
- Some later domain PRs have browser QA, but this backfill does not claim full auth/tenant browser QA coverage.

Status: `PARTIALLY OPEN`.

Rule:

- Do not say full auth/tenant browser QA has passed unless a dedicated browser QA report exists and is checked.

### 8.5 Repository work must depend on activeTenant explicitly

Current status:

- Auth/Tenant foundation exists.
- Repositories that talk to Supabase must still receive/derive tenant scope safely.
- No future repository task may bypass tenant checks.

Status: `VALID WARNING`.

## 9. Updated current truth

### Old truth

```text
Auth/Tenant exists only as skeleton or fallback.
Tenant loading is not real.
Routes live in main.tsx.
Repository migration is blocked because no tenant context is available.
```

### Current truth

```text
Auth/Tenant foundation is active.
Auth supports dev fallback and Supabase-active session flow.
App has login/auth gate and no-tenant blocked states.
TenantContext loads tenant access for authenticated users.
Routes live in App.tsx.
Repository work is no longer blocked by missing tenant context, but every repository task must still explicitly respect tenant scope, UUID/FK constraints, RLS expectations, and fallback rules.
```

## 10. Updated stop rules

The following stop rules must be used after this backfill:

1. Do not wire another AuthProvider or TenantProvider. They already exist.
2. Do not create another App extraction task. `App.tsx` already exists.
3. Do not create another basic LoginPage task. LoginPage already exists.
4. Do not create another basic logout task. Logout UI already exists.
5. Do not create another basic no-tenant blocked screen. It already exists.
6. Do not assume TenantContext is mock-only. It loads real tenant data in Supabase-active mode.
7. Do not assume repository migration is blocked by missing tenant context. It may still be blocked by domain-specific UUID/FK/RLS/data-shape issues.
8. Do not bypass `activeTenant` in future Supabase repository work.
9. Do not claim live Supabase auth/tenant QA unless a real browser/local Supabase run was performed and documented.
10. Do not implement tenant switcher or tenant persistence without a separate scoped task.

## 11. Recommended next audit batch

Next report should be:

```text
PROJECT-AUDIT-BACKFILL-003
Patient / ChiefComplaint / Doctor / Appointment repository reconciliation
```

Why:

- These are the first domain repositories that moved beyond foundation.
- They need verification against current main and earlier RECON/REAL/QA reports.
- They determine which CRUD routes are already safe and which still need separate QA.

## 12. Final verdict

- Auth foundation: `VALID CURRENT FOUNDATION`.
- Tenant loading: `VALID CURRENT FOUNDATION`.
- No-tenant gate: `VALID CURRENT FOUNDATION`.
- Older skeleton/readiness reports: mostly `SUPERSEDED` or `PARTIALLY VALID`.
- Live Supabase auth/tenant QA: `NOT CLAIMED BY THIS REPORT`.
- Tenant switcher: `NOT IMPLEMENTED`.
- Active tenant persistence: `NOT IMPLEMENTED`.
- Repository work: allowed only per-domain, only with tenant scope, UUID/FK/RLS/fallback review, and task-specific checks.
