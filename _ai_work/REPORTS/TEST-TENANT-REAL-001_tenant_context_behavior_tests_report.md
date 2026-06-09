# TEST-TENANT-REAL-001: TenantContext Behavior Tests Report

## Summary
Added strict behavior tests to lock in the current `TenantContext` functionality. This ensures that the dev fallback remains intact and documents the current blocked placeholder state of `supabase-active` before any real Supabase querying is introduced. 

## Changed Files
- `src/contexts/TenantContext.test.tsx` (Added)
- `_ai_work/REPORTS/TEST-TENANT-REAL-001_tenant_context_behavior_tests_report.md` (Added)

## Tests Added
1. **Dev Fallback Behavior**: Proves that when `authMode === 'dev'`, the context reliably exposes `devTenant`, `isLoading === false`, and gracefully handles `setActiveTenant`.
2. **Current Supabase-Active (No User)**: Verifies that an unauthenticated state accurately returns an empty array, a `null` active tenant, and maintains the current placeholder behavior where `isLoading === true`.
3. **Current Supabase-Active (Authenticated User)**: Verifies that, until implemented, the context correctly returns `null` for `activeTenant` and `true` for `isLoading` even when a user exists, ensuring no rogue operations occur.

## Future Behavior Documented
A skipped `describe` block was added to clearly outline the expected features for `TENANT-REAL-001A`:
- Correct `isLoading` toggling.
- Supabase queries executing strictly when a user exists.
- Handling of zero, multiple, and failing tenant queries.
- Rejecting unknown tenants in `setActiveTenant`.

## Confirmations
- ✅ No `TenantContext.tsx` production changes.
- ✅ No `AuthContext.tsx`, `App.tsx`, `Header.tsx`, or `LoginPage.tsx` changes.
- ✅ No Repository or Storage changes.
- ✅ No Supabase migration or seed changes.

## Validation Results
- `npm ci`: Passed
- `npm run lint`: Passed
- `npm run test`: Passed (New suite with 3 passing tests added)
- `npm run build`: Passed

## Remaining Risks
- The data layer is completely dependent on `activeTenant`. The real implementation of Supabase querying will be the most complex phase of the auth migration.
- Developers attempting to test real authentication locally will still face a barrier because there is no documentation on how to manually seed the `tenant_users` mapping in a local Supabase Studio environment.

## Recommended Next Task
**DOCS-TENANT-LOCAL-001: Document local Supabase auth user/profile/tenant_users setup**
- Since the real implementation (`TENANT-REAL-001A`) will require testing against a local Supabase instance, developers need explicit instructions on how to create an `auth.users` row via Studio and manually insert the linking rows into `profiles` and `tenant_users`. This setup is deliberately excluded from `seed.sql` due to the secure auth flow, making this documentation a strict prerequisite for local QA.
