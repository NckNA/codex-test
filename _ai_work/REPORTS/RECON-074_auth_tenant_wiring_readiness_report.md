# RECON-074: Auth/Tenant Wiring Readiness Report

## Summary
This reconnaissance audit inspected the current React application structure to determine the safest next step for integrating Supabase Authentication and Multi-Tenancy. The application heavily relies on synchronous `localStorage` singletons, and wiring real authentication requires careful fallback strategies to prevent breaking the existing mock data flow.

## Files Inspected
- `src/main.tsx` (App root and routing)
- `src/components/layout/Header.tsx` (Mock user UI)
- `src/utils/storage.ts` (LocalStorage engine)
- `src/data/repositories/*` (Singleton repositories)
- `src/lib/supabaseClient.ts` (Supabase client skeleton)
- `.github/workflows/ci.yml` (CI configuration)

## 1. Current App Root & Routing Findings
- **Root structure**: The application is mounted directly in `src/main.tsx`. There is no `App.tsx`.
- **Routing**: `react-router-dom`'s `<BrowserRouter>` and `<Routes>` are defined entirely within `main.tsx`.
- **Storage Initialization**: `storage.init()` is called synchronously at the top level of `main.tsx` before React even renders.
- **Mock User**: A hardcoded user ("Иван И.", "Администратор") exists in `src/components/layout/Header.tsx`. There is no mock auth system or clinic selector currently implemented.
- **Provider Insertion**: Providers would ideally wrap `<BrowserRouter>` in `src/main.tsx`.

## 2. Current Data Flow Findings
- **LocalStorage backbone**: Almost every feature depends on `src/utils/storage.ts`.
- **Singleton Repositories**: Repositories (e.g., `LocalStoragePatientRepository`) are currently exported as plain static objects/singletons. They do not accept a `tenant_id` and have no concept of tenant scoping.
- **Tight Coupling**: React hooks heavily import these singleton repositories directly.

## 3. AuthProvider Readiness
- **READY for Skeleton Wiring, NOT READY for Real Auth**: We can insert `<AuthProvider>` into `main.tsx` right now without breaking anything, *provided* it remains a skeleton.
- **Fallback Requirement**: Because `VITE_SUPABASE_URL` may be absent locally, `supabaseClient` will be `null`. The `AuthProvider` MUST implement a "dev/fallback mode" that yields a mock `AppUser` to avoid crashing or requiring immediate UI login.
- **UI**: There is no login screen. Wiring *real* auth would require stopping to design and build a `<LoginPage>`.

## 4. TenantProvider Readiness
- **READY for Skeleton Wiring**: `<TenantProvider>` should be nested immediately inside `<AuthProvider>`.
- **Tenant Selection**: No UI exists to select a tenant. In fallback/dev mode, it should automatically yield a mock `tenant_id` (e.g., `11111111-1111-1111-1111-111111111111` matching the `seed.sql`).
- **Hardcoding Risk**: We must prevent hardcoded tenant IDs in repositories. The TenantContext must be the sole source of truth.

## 5. Repository Migration Readiness
- **NOT READY**: Repositories cannot be migrated to Supabase yet.
- **Adapter Boundary Blocker**: Because repositories are static singletons, they cannot easily read from a React Context (`useTenant`). Before migrating, we must refactor repositories into a Factory or Dependency Injection pattern (e.g., `createPatientRepository(tenantId: string)`), or create a middleware layer.

## 6. CI / Validation Readiness
- **READY**: `.github/workflows/ci.yml` is active. Future implementation PRs will be automatically tested via GitHub Actions.

## 7. Risk Classification
| Next Step Candidate | Risk Level | Reason |
|---|---|---|
| **Repository Adapter Boundary** | LOW | Pure TypeScript refactoring. No logic changes, just dependency injection. |
| **Auth/Tenant Wiring (Dev Fallback)** | MEDIUM | Modifies `main.tsx` root tree. Safe as long as fallback mock user is provided. |
| **Login UI Implementation** | HIGH | Requires product design, routing changes, and session management. |
| **Pilot Repository (e.g., ChiefComplaint)** | HIGH | Blocked by lack of adapter boundary and tenant context injection. |
| **Core Repository (e.g., Patient)** | VERY HIGH | Central to app. Blocked. |

## 8. Explicit "Do NOT do yet"
- **DO NOT** build a real Login UI yet. Use a mock fallback first.
- **DO NOT** migrate any repository to Supabase yet. The adapter boundary must be built first.

## 9. Final Verdict
- **AuthProvider wiring**: READY (with Dev-Mode fallback only)
- **TenantProvider wiring**: READY (with Dev-Mode fallback only)
- **Repository migration**: NOT READY (Blocked by adapter boundary)
- **Product-visible work**: NOT READY

## 10. Recommended Next Task
**AUTH-001 — Wire Auth/Tenant Providers with Dev-Mode Fallback**

- **Why**: We need the Contexts physically present in the React tree so that future components and repository adapters can pull the `tenant_id`.
- **What blocker it closes**: It moves the application from "no auth context" to "context available", bypassing the need to build a complex Login UI immediately.
- **Allowed files**: `src/main.tsx`, `src/contexts/AuthContext.tsx`, `src/contexts/TenantContext.tsx`.
- **Forbidden files**: Repositories, Supabase schemas, existing UI components.
- **Why it is safer**: Injecting a mock user/tenant when Supabase ENV vars are missing guarantees the existing `localStorage` app will continue working flawlessly for developers who haven't set up Docker yet.
