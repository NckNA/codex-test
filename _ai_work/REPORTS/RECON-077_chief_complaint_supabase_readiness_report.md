# RECON-077: ChiefComplaint Supabase Migration Readiness Report

## Summary
This audit evaluated whether the `ChiefComplaintRepository` is ready to receive a real Supabase implementation within the newly established factory boundary. The primary finding is that while the database schema and factory boundaries are structurally ready, the strict **Row Level Security (RLS) policies block any direct database implementation** until real authentication is implemented. Without a valid `auth.uid()` in the request context, RLS will silently drop all queries.

## Files Inspected
- `src/types/index.ts`
- `supabase/migrations/0001_initial_schema.sql`
- `supabase/seed.sql`
- `src/contexts/AuthContext.tsx`
- `src/contexts/TenantContext.tsx`
- `src/lib/supabaseClient.ts`

## 1. Schema Readiness: READY
- **Table Exists**: The `chief_complaints` table is correctly defined in the schema.
- **Fields Aligned**: Frontend types (`id`, `patientId`, `text`, `relatedTeeth`, `createdAt`, `updatedAt`) map perfectly to SQL columns (`id`, `patient_id`, `text`, `related_teeth`, `created_at`, `updated_at`).
- **Data Types**: `related_teeth` is correctly handled as an `integer[]`.
- **Tenant Scoping**: The table enforces composite keys (`tenant_id`, `patient_id`) and foreign keys are tightly scoped.

## 2. RLS Readiness: NOT READY (Blocked by Auth)
- **Policies Present**: Yes, `chief_complaints` has strict RLS policies enabled for SELECT, INSERT, UPDATE, and DELETE.
- **Dependency**: The policies rely on `get_user_tenants()`, which strictly calls `auth.uid()`.
- **Failure Mode**: If we implement the Supabase repository now, any query made while `authMode === 'supabase-unwired'` will execute without a valid JWT. The `auth.uid()` will evaluate to null, `get_user_tenants()` will return 0 rows, and the database will return empty data or HTTP 403 errors, breaking the application.

## 3. Tenant Readiness: READY (for Dev)
- **Context**: `activeTenant` provides a `tenantId` based on the dev mock.
- **Hook Integration**: `useChiefComplaint` correctly passes `activeTenant?.tenantId` into the repository factory.
- **Seed Alignment**: The `devTenant` ID (`11111111-1111-1111-1111-111111111111`) perfectly matches the tenant inserted in `seed.sql`.

## 4. Auth Readiness: NOT READY
- **Current Mode**: `AuthContext` provides either a mock user (`dev`) or `null` (`supabase-unwired`).
- **Impact**: Without a real Supabase user session, the Supabase Client cannot pass the required JWT to satisfy RLS policies.
- **Risk**: Attempting to mock or bypass RLS for local testing is brittle and dangerous. Real authentication must be implemented first.

## 5. Factory Design Readiness: NEEDS MINOR ADJUSTMENT
- **Current Signature**: `createChiefComplaintRepository(tenantId?: string)`
- **Limitation**: The factory has no way of knowing if the user is fully authenticated or if Supabase should be utilized.
- **Recommendation**: Before (or during) the Supabase implementation, the factory signature should be updated to accept a configuration object: `createChiefComplaintRepository({ tenantId, useSupabase, supabaseClient })` so the hook can cleanly dictate the backend based on Auth state.

## 6. Fallback Behavior Recommendation
- If Supabase environment variables are missing, `localStorage` must be used.
- If Supabase is configured BUT the user is not authenticated (`auth.uid` missing), the application must force a login. Falling back to `localStorage` when Supabase is enabled but unauthenticated creates a dangerous "split-brain" state.
- **Conclusion**: Supabase repository implementations should strictly require both `isSupabaseConfigured` AND a valid authenticated `user`.

## 7. Test Readiness: NOT READY
- Currently, there are no unit tests covering the `ChiefComplaintRepository` factory or the `useChiefComplaint` hook.
- Minimal tests should be added to guarantee that the `localStorage` fallback remains active when Supabase is disabled.

## 8. Risk Table

| Action | Risk Level | Rationale |
|---|---|---|
| Adding tests for factory/localStorage fallback first | **LOW** | Completely safe, prevents regressions. |
| Adjusting factory signature to accept config object | **LOW / MEDIUM** | Minor refactor, highly localized. |
| Implementing real auth before repository migration | **MEDIUM / HIGH** | Real auth with login UI, session handling, redirects/guards, and routing is complex and touches critical flow. |
| Supabase implementation inside `ChiefComplaintRepository` now | **HIGH** | Will immediately break the UI because RLS will reject all queries due to missing `auth.uid()`. |
| Implementing repository migration without real auth | **HIGH** | Requires disabling RLS (security risk) or hacking local JWTs. |
| Migrating `PatientRepository` next | **DO NOT DO YET** | Too complex. Pilot must succeed first. |
| Migrating `AppointmentRepository` next | **DO NOT DO YET** | Too complex. Pilot must succeed first. |

## 9. Blockers Found
- **Missing `auth.uid()`**: Real Supabase Auth is an absolute prerequisite to satisfy existing RLS policies.

## 10. Explicit "Do NOT do yet"
- **DO NOT** write the Supabase data access logic for `ChiefComplaintRepository`.
- **DO NOT** disable or bypass RLS policies to make local testing work.
- **DO NOT** migrate `PatientRepository` or any other repositories.

---

## 11. Final Verdict
- **NOT READY** for `ChiefComplaint` Supabase implementation (Blocked by Auth/RLS).
- **NOT READY** for real repository migration (Blocked by Auth/RLS).
- **READY** for tests first.
- **NOT READY** for `PatientRepository` migration.
- **NOT READY** for `AppointmentRepository` migration.

---

## 12. Recommended Next Task

**TEST-077: Add ChiefComplaint factory/useChiefComplaint safety tests**

- **Why this task is next**: Before proceeding to complex auth logic or adjusting signatures, we must guarantee that the current ARCH-076 boundary is robust. Testing the `localStorage` fallback and factory guarantees prevents silent regressions during upcoming auth/Supabase changes.
- **What blocker it closes**: Closes the missing test coverage for the repository adapter boundary.
- **Allowed files**: 
  - `src/data/repositories/ChiefComplaintRepository.test.ts`
  - `src/data/hooks/useChiefComplaint.test.tsx`
  - `_ai_work/REPORTS/TEST-077_chief_complaint_factory_tests_report.md`
- **Forbidden files**: Repositories, `storage.ts`, Supabase files, UI components, routing.
- **Expected validation**: Unit tests pass and prove `LocalStorageChiefComplaintRepository` is returned by the factory, and `useChiefComplaint` provides the correct public API.
- **Why it is safer than alternatives**: It isolates testing in a very small scope with **LOW risk**, locking in the current safe behavior before tackling the MEDIUM/HIGH risk real authentication task.
