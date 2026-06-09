# Supabase Auth and Tenant Context

This document outlines the skeleton design for introducing the Supabase client and the required frontend contexts for multi-tenancy.

## 1. Supabase Client Isolation (`src/lib/supabaseClient.ts`)
The Supabase JS client must be initialized in a single dedicated module.
- It safely reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- If these are missing, it initializes as `null` to avoid crashing the current non-Supabase `localStorage` repository logic.
- **SECURITY WARNING**: `service_role` keys are strictly forbidden in the frontend (`.env` or anywhere else). Only the `anon` key is permitted.

## 2. AuthContext (`src/contexts/AuthContext.tsx`)
This context exposes an `authMode` flag (`dev` or `supabase-unwired`).
- **Dev Fallback Mode**: When Supabase env vars are missing, it defaults to a deterministic mock user. This prevents the application from breaking for developers who haven't set up Supabase yet.
- **Supabase-Unwired Mode**: When env vars are present, it stays in a safe loading/placeholder state since real auth is not yet implemented.
- Future work: Hook into `supabase.auth.onAuthStateChange` and provide real login/logout.

## 3. TenantContext (`src/contexts/TenantContext.tsx`)
Because the database strictly enforces `tenant_id` for almost all rows via RLS, the frontend must safely store and provide the active tenant context.
- **Dev Fallback Mode**: If `authMode` is `dev`, it automatically yields a mock tenant (e.g., `11111111-1111-1111-1111-111111111111`). This is for development fallback only.
- **Production Tenant Selection**: Once real auth is implemented, production tenant selection must come from authenticated user tenant membership.
- **Future Supabase Repositories MUST obtain `tenant_id` from this context** (or via an adapter layer).
- This ensures developers cannot accidentally hardcode production tenant IDs.

## 4. Provider Order and App Root (`src/main.tsx`)
The providers are wired around the main `<BrowserRouter>` in the following strict order:
```tsx
<StrictMode>
  <AuthProvider>
    <TenantProvider>
      <BrowserRouter>
        ...
      </BrowserRouter>
    </TenantProvider>
  </AuthProvider>
</StrictMode>
```
This ensures `TenantProvider` can depend on the `useAuth` hook safely.

## 5. Why Repository Migration is Still Forbidden
At this stage, the `AuthContext` and `TenantContext` are safely wired with dev fallbacks, but repositories are still synchronous `localStorage` singletons.
If we were to migrate a repository now:
1. We would have to hardcode a `tenant_id` which breaks multi-tenancy rules.
2. The real Supabase RLS policies require a valid JWT with `auth.uid()`, meaning the real authentication flow must be functional before repositories can successfully insert/select data.

## 6. What Remains Before Real Auth
- Replace the mock login UI with actual authentication flow (LoginPage, routing).
- Connect `AuthProvider` to the real Supabase Auth endpoints.
- Wire `TenantProvider` to fetch the user's allowed tenants from `tenant_users` and set an active tenant.

## 7. What Remains Before First Repository Migration
- Implement an adapter or dependency injection boundary for Repositories so they don't manually pull `tenant_id` from React Context directly, but rather through a safe injection boundary (e.g., a Factory pattern).
