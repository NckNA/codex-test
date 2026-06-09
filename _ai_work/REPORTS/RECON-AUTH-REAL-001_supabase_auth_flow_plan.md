# RECON-AUTH-REAL-001: Supabase Auth Flow Plan

## Summary
This reconnaissance report analyzes the current state of the application's routing and authentication contexts to plan the implementation of real Supabase Auth. It identifies that the application currently lacks an `App.tsx` component, making routing extraction a structural prerequisite before implementing route guards. Furthermore, `TenantContext` should remain mock-only until Auth is fully established to minimize risk.

## Files Inspected
- `src/main.tsx`
- `src/contexts/AuthContext.tsx`
- `src/contexts/TenantContext.tsx`
- `src/lib/supabaseClient.ts`
- `src/components/layout/Layout.tsx`
- `src/components/layout/Header.tsx`
- `supabase/migrations/0001_initial_schema.sql`
- `supabase/seed.sql`

## 1. Current Auth State
- **What it provides**: `AuthContext` provides a hardcoded mock `AppUser` and an `authMode` (`dev` or `supabase-unwired`).
- **Dev Mode**: Activates when Supabase environment variables are missing. It hardcodes `dev-user-000000000000` and `isLoading: false`.
- **Supabase-unwired Mode**: Activates when variables are present. It provides `user: null` and `isLoading: true`.
- **Missing functionality**: It currently does **not** call `supabase.auth.getSession()` or `supabase.auth.onAuthStateChange()`. Real login/logout methods are also missing.

## 2. Current Routing State
- **Location**: All routing is explicitly defined inside `src/main.tsx`.
- **App.tsx**: Does **not** exist.
- **Analysis**: To implement route guards (e.g., `ProtectedRoute` that calls `useAuth()`), the routing logic must be nested *inside* the `AuthProvider`. While this can be hacked inline in `main.tsx`, the standard and safest approach is to extract the routing into a new `src/App.tsx` component first.

## 3. Login UI Readiness
- **Existing Assets**: There is no existing `Login.tsx`, auth layout, or dedicated form components.
- **Minimal Needs**: A basic `LoginPage` component with Email, Password, and a Submit button, plus basic error state handling.
- **Logout**: Needs to be wired into `src/components/layout/Header.tsx` where the placeholder "User Profile" currently sits.
- **Postponed**: Signup, Password Reset, and OAuth should be explicitly postponed. First users should be created via local Supabase Studio.

## 4. Dev Fallback Behavior
- When Supabase variables are missing, `authMode` remains `dev`.
- The application must **bypass the login screen entirely** in dev mode and render the prototype exactly as it works today, using the mock user and `localStorage` repositories.
- This protects the current development workflow.

## 5. Supabase Configured Behavior
- When `VITE_SUPABASE_URL` is present, `authMode` becomes `supabase-active`.
- **Loading**: Show a centered loading spinner while `getSession()` resolves.
- **Null Session**: Redirect the user to `/login`.
- **Authenticated Session**: Redirect to `/` (Schedule) and provide the `auth.uid()`.

## 6. Tenant Loading Plan
- **Current State**: `TenantContext` provides a static `devTenant`.
- **Evolving**: Eventually, it must fetch `tenant_users` using the new `auth.uid()`.
- **Decision**: `TenantContext` must remain mock-only during the first auth task. Combining Auth logic + Login UI + Tenant fetching in one PR is too risky. It should be separated into a future `TENANT-REAL-001` task.

## 7. RLS Implications
- **Requirement**: Database RLS explicitly requires `auth.uid()`.
- **Seeding**: `seed.sql` does **not** contain `auth.users` records.
- **Local Dev Setup**: Once Auth is implemented, developers will need to manually create a user in local Supabase Studio and insert a mapping row into `tenant_users` linking the new `auth.uid()` to the seeded `11111111-1111-1111-1111-111111111111` tenant. This must be documented.

## 8. Repository Impact
- **Impact**: Zero.
- **Rule**: The real auth task must not touch repository factories, `useChiefComplaint`, `PatientRepository`, or `storage.ts`. All repository migrations remain strictly forbidden until Auth AND Tenant contexts are fully wired.

---

## 9. Risk Table

| Action | Risk Level |
|---|---|
| Extracting `App.tsx` before auth | **LOW** |
| Adding `LoginPage` only | **LOW / MEDIUM** |
| Updating `AuthContext` session handling | **MEDIUM** |
| Adding route guards in `App.tsx` | **MEDIUM** |
| Adding logout button in `Header` | **LOW** |
| Keeping `TenantContext` dev fallback unchanged | **LOW** |
| Loading tenants from Supabase | **MEDIUM** (Postpone) |
| Implementing `ChiefComplaint` Supabase repo immediately after login | **HIGH** (Blocked by Tenant) |
| Migrating `PatientRepository` / `AppointmentRepository` | **DO NOT DO YET** |

---

## 10. Blockers Found
- **Structural Blocker**: `main.tsx` currently holds the `Routes` directly inside the Context providers. We cannot easily insert a `RequireAuth` wrapper that consumes `useAuth()` without extracting the routes into a child component (`App.tsx`).

## 11. Explicit "Do NOT do yet"
- **DO NOT** implement `TenantContext` Supabase fetching.
- **DO NOT** migrate any repositories to Supabase.
- **DO NOT** build Signup or Password Reset UI.

---

## 12. Final Verdict
- **READY** for routing extraction (`App.tsx`).
- **READY** for real login UI and AuthContext session handling (once App.tsx is extracted).
- **NOT READY** for `TenantContext` Supabase loading (Auth must be merged first).
- **NOT READY** for `ChiefComplaint` Supabase repository (Tenant loading must be merged first).
- **NOT READY** for `PatientRepository` migration.
- **NOT READY** for `AppointmentRepository` migration.

---

## 13. Recommended Next Task

**AUTH-REAL-001C: Extract App routing before auth**

- **Why this task is next**: To implement route guards and authentication checks safely, the React Router `<Routes>` tree must be extracted out of `main.tsx` into an `<App />` component. This allows the `<App />` component to cleanly consume `useAuth()` and manage the `LoginPage` vs `Layout` conditional rendering in the subsequent Auth task.
- **What blocker it closes**: Closes the structural routing blocker preventing clean route guard implementation.
- **Allowed files**: `src/main.tsx`, `src/App.tsx` (new).
- **Forbidden files**: Contexts, Repositories, Supabase client, UI pages.
- **Expected validation**: The application looks and functions exactly the same, but `main.tsx` simply renders `<App />` inside the providers.
- **Why it is safer than alternatives**: It isolates a pure structural refactor (LOW risk) from the behavioral logic of real authentication session handling (MEDIUM risk), keeping PRs small and easily reviewable.
