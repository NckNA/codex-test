# Supabase Auth and Tenant Context

This document outlines the skeleton design for introducing the Supabase client and the required frontend contexts for multi-tenancy.

## 1. Supabase Client Isolation (`src/lib/supabaseClient.ts`)
The Supabase JS client must be initialized in a single dedicated module.
- It safely reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- If these are missing, it initializes as `null` to avoid crashing the current non-Supabase `localStorage` repository logic.
- **SECURITY WARNING**: `service_role` keys are strictly forbidden in the frontend (`.env` or anywhere else). Only the `anon` key is permitted.

## 2. AuthContext (`src/contexts/AuthContext.tsx`)
Currently a skeleton, this context will later:
- Hook into `supabase.auth.onAuthStateChange`.
- Expose the current authenticated user (`AppUser` shape).
- Provide `login`/`logout` functions.
- Serve as the gatekeeper for user sessions before any tenant logic runs.

## 3. TenantContext (`src/contexts/TenantContext.tsx`)
Because the database strictly enforces `tenant_id` for almost all rows via RLS, the frontend must safely store and provide the active tenant context.
- Once authenticated, the user will select or default to an `ActiveTenant`.
- **Future Supabase Repositories MUST obtain `tenant_id` from this context** (or via an adapter layer that injects it automatically into repository queries).
- This ensures developers cannot accidentally hardcode production tenant IDs.

## 4. Why Repository Migration is Still Forbidden
At this stage, the `AuthContext` and `TenantContext` are strictly un-wired skeletons.
If we were to migrate a repository now:
1. We would have to hardcode a `tenant_id` which breaks multi-tenancy rules.
2. Or we would wire it to the `TenantContext`, which currently has a `null` active tenant.
3. The real Supabase RLS policies require a valid JWT with `auth.uid()`, meaning the real authentication flow must be functional before repositories can successfully insert/select data.

## 5. What Remains Before First Repository Migration
- Wire `AuthProvider` into the application root (likely inside `src/main.tsx` or `App.tsx`).
- Connect `AuthProvider` to the real Supabase Auth endpoints.
- Wire `TenantProvider` to fetch the user's allowed tenants from `tenant_users` and set an active tenant.
- Replace the mock login UI with actual authentication.
- Create an adapter or base class for Repositories so they don't manually pull `tenant_id` from React Context directly, but rather through a safe injection boundary.
