# SUPABASE-CLOUD-APPLY-ENCOUNTER-VISIT-001-RETRY-2 — Supabase Cloud Migration Application Report

## 1. Summary
The application of local SQL migrations `0014` and `0015` to the remote Supabase Cloud project `cwkgxgubvdkkjcslvdgn` was successfully executed and verified. The host environment was configured with the native Supabase CLI and access token, and the database connection string was loaded from the User registry. Precheck verified CLI authentication and project visibility. The migrations were successfully applied to the cloud database, and postcheck confirmed that both migrations are present and active, showing 16 applied migrations total.

## 2. Branch Name
`report/supabase-cloud-apply-encounter-visit-001`

## 3. PR URL
https://github.com/NckNA/codex-test/pull/321

## 4. PR Head Reviewed Before Final Report Update
d11142f76d69ba9e698d03f16ded47eb95db2f05

## 5. Report Update Commit
N/A

## 6. Changed Files Summary
- `_ai_work/REPORTS/SUPABASE-CLOUD-APPLY-ENCOUNTER-VISIT-001.md` (Exactly one report file, no code/migration changes).

## 7. Workspace/Bridge Details
- **Project Path:** `D:\hermes\codex-test`
- **Bridge Path:** `D:\Users\User\Documents\GitHub\codex-test\mcp\hermes-bridge\`
- **Port:** `8797`
- **Workspace Root:** `D:\hermes`

## 8. Supabase Cloud Target
- **ProjectRef:** `cwkgxgubvdkkjcslvdgn`
- **ProjectName:** `codex-test-cloud`
- **Project Region:** `ap-northeast-2`
- **Project Status:** `ACTIVE_HEALTHY`

## 9. Credentials Presence
- **hasAccessToken:** `true` (CLI authenticated successfully)
- **hasCloudDbUrl:** `true` (Direct PostgreSQL URI configured with corrected user password)

## 10. Post-Migration Verification Result
- **cliAuthenticated:** `true`
- **projectVisible:** `true`
- **dbReachable:** `true`
- **migrationTableReachable:** `true`
- **migration0014Present:** `true` (Successfully applied and verified)
- **migration0015Present:** `true` (Successfully applied and verified)
- **Applied migrations count:** `16`
- **Existing tables detected:** `[patient_visits, clinical_encounters, completed_services, audit_events, activity_events]`
- **Detected public functions:** `[cancel_patient_visit, check_in_patient_visit, complete_clinical_encounter, complete_patient_visit, create_clinical_encounter, record_completed_service, start_clinical_encounter, start_patient_visit, void_completed_service, save_treatment_plan_with_stages, bootstrap_clinical_dictionary_from_template]`

## 11. Secret Leakage Check
- **No token printed:** Verified. All outputs are strictly redacted.
- **No DB URL printed:** Verified.
- **No password printed:** Verified.

## 12. What Was Intentionally NOT Changed
- **No app code changes:** Code files under `src/` or `backend/` were untouched.
- **No UI/hooks/tests changes:** UI components, React hooks, and unit tests were not altered.
- **No migration file edits:** Local migration files in `supabase/migrations/` remain intact and unedited.
- **No auth/storage/edge-function changes:** No changes to remote storage buckets, RLS rules, or edge functions.

## 13. Final Verdict
`SUCCESS`
