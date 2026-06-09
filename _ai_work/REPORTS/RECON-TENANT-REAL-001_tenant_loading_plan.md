# RECON-TENANT-REAL-001: Tenant Loading Plan

## Summary
This report analyzes the current state of authentication and database schemas to formulate a safe plan for migrating `TenantContext` to load real clinic mappings from Supabase. The application is ready to fetch tenant data based on the authenticated user's session, but careful attention must be paid to local data seeding and the absence of a UI for users who do not belong to any clinic.

## Files Inspected
- `src/contexts/TenantContext.tsx`
- `src/contexts/AuthContext.tsx`
- `src/App.tsx`, `src/main.tsx`, `src/components/layout/Header.tsx`
- `src/lib/supabaseClient.ts`
- `supabase/migrations/0001_initial_schema.sql`
- `supabase/seed.sql`
- Previous RECON and AUTH reports

## 1. Current TenantContext State
- **Provides**: `activeTenant`, `availableTenants`, `setActiveTenant`, `isLoading`, `error`.
- **In `dev` mode**: Immediately resolves `availableTenants = [devTenant]` and `activeTenant = devTenant`. `isLoading` is `false`.
- **In `supabase-active` mode**: `availableTenants` is `[]`, `activeTenant` is `null`, `isLoading` is strictly `true` (waiting for implementation).
- **Queries Supabase?** No.
- **Knows real auth user?** No, it currently does not consume the `user` object from `useAuth`, only `authMode`.
- **Maps user -> tenant_users?** No.
- **Multiple tenants / Switching?** Switching is stubbed out and logs a warning.

## 2. Current AuthContext State
- **Provides**: `user` (with `id` and `email`), `authMode`, `isLoading`, `signIn`, `signOut`.
- **Suitability**: `AuthContext` now provides exactly what `TenantContext` needs: a reactive `user` object containing the authenticated `user.id`, and an `isLoading` flag to distinguish between initial load and unauthenticated states.
- **Cases to handle**:
  - *Dev mode*: Return `devTenant` (handled).
  - *Supabase-active + auth loading*: Wait (`isLoading=true`).
  - *Supabase-active + no user*: Clear tenants, wait (`isLoading=false`).
  - *Supabase-active + user exists*: Query Supabase for `tenant_users`.
  - *Errors / Zero tenants*: Expose explicitly so `App.tsx` can block rendering.

## 3. Supabase Schema Readiness
- **Tables**: `tenants` and `tenant_users` exist. `profiles` exists.
- **Linking**: `tenant_users` maps `tenant_id` to `tenants(id)` and `user_id` to `profiles(id)` (which references `auth.users(id)`).
- **Roles**: Uses `app_role` ENUM (e.g., `clinic_admin`, `doctor`, `registrar`).
- **Compatibility**: `tenant_users.user_id` perfectly matches `AuthContext.user.id`.
- **Local Seed Data**: `seed.sql` inserts mock `tenants` and `patients`, but **deliberately skips** `auth.users`, `profiles`, and `tenant_users`. 
- **Required Local Setup**: A developer must manually register a user via local Supabase Studio, copy their UUID, and manually insert records into `profiles` and `tenant_users` to test locally.

## 4. RLS Implications
- **`get_user_tenants()`**: Defined as `SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()`. It depends directly on `auth.uid()`.
- **`tenant_users` SELECT policy**: Uses `USING (tenant_id IN (SELECT get_user_tenants()))`.
- **`tenants` SELECT policy**: Uses `USING (id IN (SELECT get_user_tenants()))`.
- **Query Shape**: `TenantContext` will likely run a join query:
  `supabase.from('tenant_users').select('role, tenant_id, tenants(id, name, status)')`
- **Permissions**: This proposed query shape is expected to work under current RLS once a valid auth user/profile/tenant_users mapping exists; must be verified in the actual TENANT-REAL implementation.
- **Missing Rows**: If no `tenant_users` mapping exists, the query returns an empty array `[]`. If profile/tenant_users/tenant setup is missing, local verification will fail or return no tenants. This query must be covered by tests/mocks first and later verified manually/integration-style against local Supabase.

## 5. Proposed TenantContext Behavior
- **A) Dev mode**: Remain unchanged (use `devTenant`).
- **B) Auth Loading**: `activeTenant = null`, `isLoading = true`.
- **C) No User**: `activeTenant = null`, `isLoading = false`.
- **D) User Exists**: Execute Supabase query. Map the result into `ActiveTenant[]`. Automatically select the first tenant as `activeTenant`. `isLoading = false`.
- **E) Zero Tenants**: `activeTenant = null`, `availableTenants = []`, `isLoading = false`. Requires UI to block access.
- **F) Multiple Tenants**: Populate array, pick first by default.

## 6. Storage / Persistence Decision
- **Persist Selection**: Yes, users belonging to multiple clinics should not have their clinic reset on page refresh.
- **Location**: `localStorage`.
- **Key format**: `codex_active_tenant_${user.id}` to avoid leaking selections across different users on the same machine.
- **Recommendation**: Postpone implementing persistence to a later task (`TENANT-REAL-001B` or similar) to keep the initial data fetching PR small and focused.

## 7. UI Implications
- **Header**: Currently displays User Profile but no clinic name or switcher.
- **Switcher**: No switcher UI exists yet.
- **No-Tenant Blocked Screen**: If `activeTenant` is null but the user is logged in, `App.tsx` should render a "No Clinic Assigned" blocked screen to prevent accessing private routes that would crash without a tenant.

## 8. Repository Impact
- **Immediate Impact**: None. All repositories must strictly remain on `localStorage`.
- **Future Impact**: Once `TenantContext` is supplying a real UUID, `ChiefComplaintRepository` can be safely migrated to Supabase.

## 9. Testing Plan
- **Mocking**: Use Vitest to mock the `supabase.from().select()` chain.
- **Scenarios**:
  - `dev` mode uses `devTenant` without calling Supabase.
  - `supabase-active` without user avoids calling Supabase.
  - `supabase-active` with user executes query and maps response.
  - Query failure sets `error` and terminates loading.
  - Zero tenants yields empty arrays.

## 10. Risk Table

| Action | Risk |
| :--- | :--- |
| Report-only tenant plan | LOW |
| Add tests for TenantContext dev/supabase states | LOW |
| Add TenantContext real loading | MEDIUM |
| Add no-tenant blocked screen | LOW |
| Persist activeTenant selection | LOW |
| Add tenant switcher UI | MEDIUM |
| Migrate ChiefComplaintRepository after tenant loading | MEDIUM |
| Migrate PatientRepository | DO NOT DO YET |
| Migrate AppointmentRepository | DO NOT DO YET |
| Modify RLS policies | DO NOT DO YET |
| Seed local tenant_users mapping docs | LOW |
| Add auth.users seed rows | DO NOT DO YET |

## 11. Recommended Next Task

**TEST-TENANT-REAL-001: Add TenantContext behavior tests before implementation**
- **Why**: Before writing the data-fetching logic, we should establish the exact expected outputs of `TenantContext` under different `useAuth()` states using Vitest. This continues our strict Test-Driven approach and ensures the `dev` fallback remains protected.
- **Blocker Closed**: Validates the architectural boundary for `TENANT-REAL-001A`.
- **Allowed files**: `src/contexts/TenantContext.test.tsx` (new).
- **Forbidden files**: `src/contexts/TenantContext.tsx` (production code), Repositories, App.tsx, Supabase config.
- **Safer because**: It verifies the state machine of the context before we introduce asynchronous Supabase SDK queries, avoiding broken builds.

*(Note: We should also concurrently document local data seeding for developers (`DOCS-TENANT-LOCAL-001`), as manual DB setup is currently required).*

## Final Verdict
- **READY** for TenantContext behavior tests
- **READY** for TenantContext implementation only after tests and local mapping docs/query verification
- **READY** for no-tenant blocked screen
- **NOT READY** for tenant switcher UI
- **NOT READY** for ChiefComplaint Supabase migration (waiting on TenantContext)
- **NOT READY** for PatientRepository migration
- **NOT READY** for AppointmentRepository migration
