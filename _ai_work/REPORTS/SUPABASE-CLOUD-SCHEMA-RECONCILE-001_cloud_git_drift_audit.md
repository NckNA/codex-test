# SUPABASE-CLOUD-SCHEMA-RECONCILE-001: audit cloud schema drift against Git

## 1. Summary
A read-only audit of the Cloud Supabase environment against the Git repository was performed. The audit confirms significant drift: Git migrations `0004` and `0005` have not been applied to the cloud, while an orphaned migration (`add_dental_photo_storage`) exists in the cloud but not in Git. The application in its current `main` state relies on these missing migrations, meaning the cloud environment is currently incompatible and blocked for production usage.

## 2. Branch name
`recon/supabase-cloud-schema-reconcile-001`

## 3. PR URL
https://github.com/NckNA/codex-test/pull/275

## 4. PR head reviewed before final report update
abcdb48878ed8485af4de909974a5e558cb7e990

## 5. Report update commit
N/A because the final report update commit cannot reference itself before creation.

## 6. Changed files summary
- `[NEW] _ai_work/REPORTS/SUPABASE-CLOUD-SCHEMA-RECONCILE-001_cloud_git_drift_audit.md`

## 7. Supabase project inspected
- **Project Name:** `codex-test-cloud`
- **Project ID:** `cwkgxgubvdkkjcslvdgn`
- **Environment:** Unknown/Staging (Determined by active cloud state, not marked as explicit prod, but used as the main cloud target).

## 8. Git migration inventory
Files in `supabase/migrations`:
1. `0001_initial_schema.sql` (Core CRM schema).
2. `0002_add_dental_chart_editor_fields_to_tooth_states.sql` (Dental chart states).
3. `0003_add_dental_chart_links_to_findings.sql` (Findings links).
4. `0004_align_findings_status_lifecycle.sql` (Aligns `findings` status to `discovered, planned, in_treatment, completed, declined_by_patient, monitoring, archived`). Should exist in cloud.
5. `0005_create_clinical_dictionary_items.sql` (Creates `clinical_dictionary_items` and RLS). Should exist in cloud.

*Note: There is no `add_dental_photo_storage` migration in Git.*

## 9. Cloud migration inventory
Applied migrations via `supabase_migrations` table:
- `0001` (`initial_schema`)
- `0002` (`add_dental_chart_editor_fields_to_tooth_states`)
- `0003` (`add_dental_chart_links_to_findings`)
- `20260612152210` (`add_dental_photo_storage`)

- `0004` is **MISSING**.
- `0005` is **MISSING**.

## 10. Git vs cloud migration diff
- **Missing in Cloud:** `0004_align_findings_status_lifecycle.sql`, `0005_create_clinical_dictionary_items.sql`.
- **Extra in Cloud:** `20260612152210_add_dental_photo_storage`.

## 11. Cloud public schema inventory
- **Core tables present:** `tenants`, `tenant_users`, `profiles`, `patients`, `dental_charts`, `patient_findings` (as `findings`), `treatment_plans`, `treatment_stages`.
- **Core tables missing:** `clinical_dictionary_items`.

## 12. Finding status compatibility
- **Expected Git Statuses:** `discovered, planned, in_treatment, completed, declined_by_patient, monitoring, archived`.
- **Actual Cloud Statuses:** The `findings_status_check` constraint only allows `discovered, recommended, included_in_plan, observing, declined_by_patient, completed`.
- **Result:** Incompatible. Code using the new statuses will crash on INSERT/UPDATE due to the constraint violation.

## 13. Clinical dictionary compatibility
- **Table:** `clinical_dictionary_items` is completely missing from the cloud database.
- **Result:** Incompatible. MedicalPage and `useDictionaries` will crash when fetching from Supabase in `supabase-active` mode.

## 14. Seed compatibility
- Demo Clinic A and B do not exist natively in cloud unless manually seeded.
- Because `clinical_dictionary_items` is missing, running `supabase/seed.sql` on the cloud right now will throw a relation does not exist error.
- Cloud must receive the `0005` migration before seed can be fully applied.

## 15. Cloud-only storage/photo drift
- **Storage bucket:** The cloud has a `patient-files` bucket with RLS policies, but no explicit photo bucket. It's likely `add_dental_photo_storage` created `patient-files` or similar.
- **Git Migration:** Missing.
- **Code Usage:** A search through `src` confirms there are NO `supabase.storage` calls. The `DentalChartTab` uses `canvas.toDataURL('image/png')` to download locally.
- **Conclusion:** This is an abandoned cloud experiment (Option A) that has not been properly backfilled or removed. 

## 16. Security advisor findings
- **Public Can Execute SECURITY DEFINER Function (WARN):** `get_user_tenants()` and `has_tenant_role(uuid, app_role[])` are executable by `anon` and `authenticated`.
- **Signed-In Users Can Execute SECURITY DEFINER (WARN):** Same functions.
- **RLS Enabled No Policy (INFO):** `public.integration_tokens`.
- **Remediation:** Revoke `EXECUTE` for `anon` role, or rewrite to `SECURITY INVOKER` if possible.

## 17. Performance advisor findings
- **Unindexed foreign keys (INFO):** 11 foreign keys lack covering indexes (e.g., `appointments_tenant_id_patient_id_fkey`).
- **Auth RLS Initialization Plan (WARN):** `public.profiles` has policies (`User update own profile`, `Users can read own`) calling `auth.uid()` or similar functions directly. Needs `(select auth.uid())` wrapper to prevent per-row evaluation.

## 18. Edge functions / extensions
- No edge functions are currently utilized or required by the codebase.

## 19. No-tenant/localStorage boundary risk
- Files `usePatientFindings.ts`, `useDentalChart.ts`, and `useDictionaries.tsx` may currently fall back to localStorage if `isSupabaseConfigured` is true but no active tenant is selected.
- **Risk:** High. This breaks the data boundary and mixes local test data into a cloud workflow context.
- **Recommendation:** Proceed with `NO-TENANT-DATA-BOUNDARY-001` once the cloud schema is stabilized.

## 20. Treatment stages sync/transaction risk
- UI removes stages from the form, but the repository update logic does not transactionally delete the missing stages.
- **Risk:** High. Causes orphaned data and desync between the UI state and database state.
- **Recommendation:** Proceed with `TREATMENT-STAGES-SYNC-TRANSACTION-001`.

## 21. Archived findings UI risk
- Archived findings can leak into plan recommendations. The UI delete button says "Удалить" instead of "В архив".
- **Risk:** Medium. UI confusion and minor data leakage in recommendations.
- **Recommendation:** Proceed with `FINDINGS-ARCHIVE-UI-CLEANUP-001`.

## 22. Severity table

| Finding | Severity | Impact |
|---------|----------|--------|
| Missing `0004` and `0005` migrations in cloud | BLOCKER | App crashes on finding updates and dictionary reads |
| Orphaned `add_dental_photo_storage` cloud migration | HIGH | Unreproducible cloud environment |
| SECURITY DEFINER functions exposed | HIGH | Potential RPC abuse |
| No-tenant localStorage fallback | HIGH | Data boundary leakage |
| Treatment stages non-transactional sync | HIGH | Orphaned stages |
| Auth RLS init plan performance | MEDIUM | Degraded query performance |

## 23. Exact remediation plan
1. **SUPABASE-CLOUD-SCHEMA-RECONCILE-APPLY-001**: Apply missing `0004` and `0005` migrations to the cloud environment safely. This unblocks the core application.
2. **SUPABASE-CLOUD-DRIFT-BACKFILL-001**: Backfill the cloud-only storage migration into Git, or formally drop it from the cloud to ensure the Git source of truth matches the cloud state 1:1.
3. **SECURITY-DEFINER-RPC-HARDENING-001**: Secure the exposed RPC functions.
4. **NO-TENANT-DATA-BOUNDARY-001**: Fix the fallback logic when a tenant is missing.

*Reasoning: The application is fundamentally broken in cloud mode right now. Fixing the schema and drift ensures the cloud is a reliable target before fixing logic bugs.*

## 24. What was intentionally NOT changed
- No cloud writes.
- No Supabase migrations applied.
- No source code changed.
- No seed changes.
- No RLS changes.
- No storage changes.
- No auth changes.

## 25. Checks run
- `git status --short`: [clean]
- `npm run lint`: PASS
- `npm run test -- --run`: PASS (258 tests)
- `npm run build`: PASS
- GitHub Actions CI result: PASS, workflow `CI`, run #347, head `abcdb48878ed8485af4de909974a5e558cb7e990`

## 26. Final verdict
**CLOUD BLOCKED**

## 27. Recommended next task
**SUPABASE-CLOUD-SCHEMA-RECONCILE-APPLY-001**
