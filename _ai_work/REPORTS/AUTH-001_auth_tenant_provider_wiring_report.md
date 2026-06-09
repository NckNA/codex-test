# AUTH-001: Auth/Tenant Provider Wiring Report

## Summary
The `AuthProvider` and `TenantProvider` have been successfully wired into the application root (`src/main.tsx`). A "dev-mode" fallback was implemented to guarantee that the application continues to run flawlessly on local `localStorage` singletons when Supabase is not configured, entirely preserving the current mock data flow.

## Changed Files
- `src/main.tsx`
- `src/contexts/AuthContext.tsx`
- `src/contexts/TenantContext.tsx`
- `_ai_work/SUPABASE_AUTH_TENANT_CONTEXT.md`
- `_ai_work/REPORTS/AUTH-001_auth_tenant_provider_wiring_report.md` (Created)

## Provider Wiring Details
- **Location**: `src/main.tsx`
- **Order**: `<AuthProvider>` wraps `<TenantProvider>`, which wraps `<BrowserRouter>`.

## Fallback Behavior
- **AuthContext**: Reads `isSupabaseConfigured` from the client. If missing, `authMode` becomes `'dev'`. A deterministic mock user (`id: 'dev-user-000000000000'`) is yielded. `isLoading` is set to `false`.
- **TenantContext**: Depends on `authMode`. If `'dev'`, it immediately yields a mock tenant (`11111111-1111-1111-1111-111111111111`, "Demo Clinic"). `isLoading` is set to `false`.

## Confirmations
- ✅ `storage.ts` remains completely untouched. Its synchronous initialization logic works precisely as before.
- ✅ Repositories are unchanged and remain singletons.
- ✅ UI components, pages, and specific routes remain untouched.
- ✅ No login screen or authentication blocker was added.
- ✅ Supabase cloud was not touched.

## Validation Results
- `npm ci`: Passed
- `npm run lint`: Passed
- `npm run test`: Passed (33 tests in 6 files)
- `npm run build`: Passed
- The application compiles and renders exactly as it did before, but now with context providers successfully mounted at the root.

## CI Status Expectation
The `.github/workflows/ci.yml` is expected to pass all checks.

## Remaining Risks
- Repositories are still statically exported singletons. They cannot access the newly available `useTenant()` context without refactoring.

## Recommended Next Task
**ARCH-075 — Implement Repository Adapter Boundary**
*(Refactor the static `LocalStorage` repositories into a Dependency Injection / Factory pattern so they can safely receive `tenant_id` from the React tree, preparing them for the actual Supabase client migration without breaking the current flow).*
