# DOCS-TENANT-LOCAL-001: Local Supabase tenant mapping setup

## Summary

This document explains how to prepare a local Supabase user so future `TenantContext` real loading can resolve clinic access through `profiles` and `tenant_users`.

This is a local developer setup guide only. It does not change migrations, seed data, RLS policies, application code, repositories, or production behavior.

## Why this exists

Real tenant loading needs this relationship:

```text
Supabase authenticated user UUID
  -> public.profiles.id
  -> public.tenant_users.user_id
  -> public.tenant_users.tenant_id
  -> public.tenants.id
```

If this mapping is missing, the expected safe result is an empty tenant list. The app must never silently fall back to `devTenant` in `supabase-active` mode.

## Prerequisites

- Local Supabase is running.
- Migrations are applied.
- `supabase/seed.sql` has created demo tenants.
- The app points to the same local Supabase instance.
- You can open local Supabase Studio.

Demo tenant IDs from `seed.sql`:

```text
Demo Clinic A: 11111111-1111-1111-1111-111111111111
Demo Clinic B: 22222222-2222-2222-2222-222222222222
```

## Step 1. Create a local authenticated user

Create the user through Supabase Studio Authentication UI or through the app auth flow when available.

Then copy the generated user UUID.

Use this placeholder below:

```text
<LOCAL_AUTH_USER_UUID>
```

Do not hardcode this UUID into migrations or global seed files.

## Step 2. Create the matching profile row

`tenant_users.user_id` references `profiles.id`, and `profiles.id` represents the authenticated user UUID.

Use Supabase Studio table editor or SQL editor to create a row in `public.profiles`:

```text
id: <LOCAL_AUTH_USER_UUID>
first_name: Local
last_name: Admin
```

If a profile row already exists, update it instead of creating a duplicate.

## Step 3. Link the user to Demo Clinic A

Create a row in `public.tenant_users`:

```text
tenant_id: 11111111-1111-1111-1111-111111111111
user_id: <LOCAL_AUTH_USER_UUID>
role: clinic_admin
```

For multi-tenant testing, optionally add a second row:

```text
tenant_id: 22222222-2222-2222-2222-222222222222
user_id: <LOCAL_AUTH_USER_UUID>
role: registrar
```

Recommended local test roles:

```text
clinic_admin
registrar
```

## Step 4. Verify the mapping

In Supabase Studio, confirm:

```text
public.tenants contains Demo Clinic A
public.profiles contains <LOCAL_AUTH_USER_UUID>
public.tenant_users contains <LOCAL_AUTH_USER_UUID> linked to Demo Clinic A
```

Recommended manual check:

```text
Find the tenant_users row for <LOCAL_AUTH_USER_UUID>.
Confirm its tenant_id exists in public.tenants.
Confirm its role is a valid app_role value.
```

## RLS verification notes

The future app query is expected to read tenant access from `tenant_users` and join tenant metadata from `tenants`.

Expected conceptual query shape:

```text
tenant_users: role, tenant_id, tenants(id, name, status)
```

This is expected to work only when:

- the user is authenticated;
- the authenticated user UUID has a matching `profiles.id`;
- `tenant_users.user_id` matches that profile id;
- `tenant_users.tenant_id` points to an existing tenant;
- RLS allows the authenticated user to read the relevant rows.

A SQL editor check may use elevated local privileges, so it is not enough by itself to prove app-side RLS behavior. The implementation task must still verify the query through the Supabase client in authenticated mode.

## Troubleshooting

### Login works, but tenant list is empty

Check:

```text
1. Is the app logged in as the same user UUID used in profiles?
2. Does public.profiles contain that UUID?
3. Does public.tenant_users contain that UUID?
4. Does tenant_users.tenant_id point to an existing tenant?
5. Is the app connected to the same local Supabase instance?
```

### Creating tenant_users row fails

Most likely the matching profile row is missing. Create the profile first, then create the tenant mapping.

### Multiple tenants do not appear

Check that multiple `tenant_users` rows exist for the same user UUID. Tenant switcher UI is not implemented yet, so the first implementation may initially choose the first available tenant.

## Do not do yet

Do not do these in this documentation task:

- do not change `supabase/seed.sql`;
- do not modify RLS policies;
- do not change `TenantContext.tsx`;
- do not implement tenant loading;
- do not implement tenant switcher UI;
- do not migrate repositories to Supabase.

## Ready for next step

After this documentation exists, the next safe task is:

```text
TENANT-REAL-001A: Implement real tenant loading in TenantContext
```

That implementation must preserve dev fallback behavior and use the tests from `TEST-TENANT-REAL-001`.