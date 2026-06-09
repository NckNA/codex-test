# Supabase Local Setup for DentalFlow CRM

This document describes how to safely initialize the foundational Supabase project locally. **Currently, the application continues to run on `localStorage`**. This setup is strictly for preparing the schema and Auth boundaries ahead of repository migration.

## Prerequisites
To run Supabase locally, you will eventually need:
1. Docker Desktop installed and running.
2. Supabase CLI installed globally (`npm install -g supabase` or via Homebrew/Scoop).
**Note: Do not install these tools unless explicitly directed or confirmed by your current task workflow.**

## Purpose of Local Setup
The local Supabase setup allows us to:
- Test the SQL schema and Row-Level Security (RLS) policies locally before touching cloud production.
- **WARNING**: Current RLS policies are tenant-isolation policies, not final production role authorization policies. Role-specific RLS hardening is a required follow-up task before production.
- Seed mock data (Tenants, Patients) safely.
- Develop Edge Functions later without risking real patient data.

## Configuration (.env.example)
The `.env.example` file contains placeholders. When you eventually start the local Supabase container (`supabase start`), the CLI will output your local `API URL` and `anon key`. You will copy these into a `.env.local` file as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

**CRITICAL WARNING:** 
Never expose the `service_role` key to the frontend. Do not add it to `VITE_` variables. The frontend should only ever use the `anon_key` in combination with an authenticated user's session token.

## Safe Migration & Seeding
- The migration files in `supabase/migrations/` are **drafts**. They must be validated locally.
- The `supabase/seed.sql` file contains dummy IDs and mock clinics. It does **not** contain real user credentials.
- The existing `localStorage` prototype remains fully active. Do not delete `storage.ts` or `storage.init()` until the Supabase Repository implementations are fully written and injected into the app.
