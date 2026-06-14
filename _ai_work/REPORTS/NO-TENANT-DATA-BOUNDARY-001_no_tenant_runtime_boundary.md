# NO-TENANT-DATA-BOUNDARY-001: No-Tenant Runtime Boundary

## 1. Summary
This task implements a secure runtime boundary for authenticated Supabase users without an active tenant, preventing accidental or unauthorized fallback to `localStorage` demo data.

## 2. Branch name
`fix/no-tenant-data-boundary-001`

## 3. PR URL
https://github.com/NckNA/codex-test/pull/277

## 4. PR head reviewed before final report update
6cdcfeff55cce62736687a0a5d90d92966552326

## 5. Report update commit
N/A because the final report update commit cannot reference itself before creation.

## 6. Changed files summary
- `src/data/hooks/useDentalChart.test.tsx`
- `src/data/hooks/useDentalChart.ts`
- `src/data/hooks/useDictionaries.test.tsx`
- `src/data/hooks/useDictionaries.tsx`
- `src/data/hooks/usePatientFindings.test.tsx`
- `src/data/hooks/usePatientFindings.ts`

## 7. Root cause
Previously, when the application was in `supabase-active` mode but the active tenant context was undefined (or still loading), the repository initializers in the three affected hooks interpreted the falsy `tenantId` as a signal to fall back to the `local` backend. This resulted in no-tenant users seeing demo `localStorage` data for patient findings, dental charts, and dictionaries.

## 8. Boundary rule implemented
- **dev/local mode:** `localStorage` fallback allowed;
- **Supabase-active + tenant:** Uses Supabase backend;
- **Supabase-active + no tenant:** Hook data operations are short-circuited; no `localStorage` fallback occurs, and write operations fail with a safe blocked state error.

## 9. Hook-by-hook changes
- **`usePatientFindings`**: Short-circuits `queryFn` to return `[]`. Write functions (`createFinding`, `updateFinding`, `deleteFinding`) throw "Active clinic is required for Supabase data access."
- **`useDentalChart`**: Short-circuits `queryFn` to return `null`. `saveDentalChart` throws the safe error.
- **`useDictionaries`**: Bypasses `loadData` to return empty dictionaries `[]`. `saveDiagnosis` and `saveWork` throw the safe error.

## 10. Tests added/updated
- **`usePatientFindings.test.tsx`**: Replaced inaccurate fallback test with `creates local repository but blocks operations when no active tenant in supabase-active mode`.
- **`useDentalChart.test.tsx`**: Verified short-circuit returns `null` chart and safely blocks `saveDentalChart`.
- **`useDictionaries.test.tsx`**: Replaced fallback test with a verified short-circuit test that doesn't trigger repository queries and safely rejects writes.

## 11. Browser smoke
- **dev/local result**: PASS. (Local fallback still functioning).
- **Supabase no-tenant result**: PARTIAL. (MCP timeout issues prevented robust visual confirmation).
- **Supabase Tenant B result if possible**: PARTIAL. (MCP timeout issues).
- **console/network findings**: N/A due to test timeout.

## 12. Cloud safety
- no migrations were applied.
- no schema changes were made.
- no cloud data writes occurred.

## 13. What was intentionally NOT changed
- no UI redesign was attempted.
- no repository implementations were changed.
- no `AuthContext` / `TenantContext` changes.
- no migrations, seed updates, or RLS policies altered.
- no cloud dictionary population / seeding.

## 14. Remaining known issues
- orphaned `add_dental_photo_storage` cloud migration.
- SECURITY DEFINER advisor warnings.
- treatment stages sync/transaction fixes.
- archived findings UI cleanup.
- dictionary cloud seed/population decision.
- runtime permission UX for dictionary editing.

## 15. Checks
- `git status --short`: clean (excluding untracked scratch files).
- `npm run lint`: PASS.
- `npm run test -- --run`: PASS (258 tests).
- `npm run build`: PASS.
- GitHub Actions CI result: PASS, workflow `CI`, run 27515248730, head `6cdcfeff55cce62736687a0a5d90d92966552326`

## 16. Final verdict
PARTIAL with missing robust browser fixture smoke (MCP timeout).

## 17. Recommended next task
MULTITENANT-QA-001
