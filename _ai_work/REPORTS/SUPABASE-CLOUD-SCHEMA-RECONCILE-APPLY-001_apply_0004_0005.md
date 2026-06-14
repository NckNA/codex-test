# SUPABASE-CLOUD-SCHEMA-RECONCILE-APPLY-001: apply missing cloud migrations 0004 and 0005

## 1. Summary
Migrations `0004_align_findings_status_lifecycle.sql` and `0005_create_clinical_dictionary_items.sql` have been successfully applied to the `codex-test-cloud` Supabase project. The `patient_findings` status constraints are now aligned with the canonical Git statuses, and the `clinical_dictionary_items` table is now present with its corresponding RLS policies. The cloud schema is no longer blocked for these features.

## 2. Branch name
`ops/supabase-cloud-schema-reconcile-apply-001`

## 3. PR URL
https://github.com/NckNA/codex-test/pull/276

## 4. PR head reviewed before final report update
176b8100da06b4253d5d21f28014b361954bee66

## 5. Report update commit
N/A because the final report update commit cannot reference itself before creation.

## 6. Changed files summary
- `[NEW] _ai_work/REPORTS/SUPABASE-CLOUD-SCHEMA-RECONCILE-APPLY-001_apply_0004_0005.md`

## 7. Target Supabase project
- **Name:** `codex-test-cloud`
- **ID:** `cwkgxgubvdkkjcslvdgn`
- **Environment:** development/test cloud. Nick confirmed there are no real clinics, doctors, patients, medical records, payments, or production users in this environment.

## 8. Confirmation gate
- **Nick Confirmation:** YES.
- **Confirmation Reference:** "I confirm that you may apply the following migrations to cloud Supabase project... I understand that this is a cloud schema write operation."

## 9. Pre-apply cloud state
- **Migration history:** `0001`, `0002`, `0003`, `20260612152210` (`add_dental_photo_storage`). `0004` and `0005` missing.
- **`patient_findings` constraint:** Used old legacy statuses.
- **`patient_findings` counts:** 0 rows.
- **`clinical_dictionary_items`:** Missing.
- **Advisors:** Security advisor flagged `SECURITY DEFINER` issues. Performance advisor flagged unindexed foreign keys and init plan warnings.

## 10. Migration 0004 apply
- **Exact migration name:** `0004_align_findings_status_lifecycle`
- **SQL exact from Git:** Yes.
- **Result:** Success.
- **Verification:** Migration applied. `patient_findings.status` now enforces `discovered`, `planned`, `in_treatment`, `completed`, `declined_by_patient`, `monitoring`, `archived`.

## 11. Migration 0005 apply
- **Exact migration name:** `0005_create_clinical_dictionary_items`
- **SQL exact from Git:** Yes.
- **Result:** Success.
- **Verification:** Migration applied. Table created. RLS and all 4 policies successfully instantiated.

## 12. Post-apply cloud state
- **Migration history:** Includes `0004_align_findings_status_lifecycle` and `0005_create_clinical_dictionary_items`.
- **`patient_findings` compatibility:** Enforces canonical statuses.
- **`clinical_dictionary_items` schema/RLS/policies:** Table `clinical_dictionary_items` exists. RLS enabled. Policies for `SELECT`, `INSERT`, `UPDATE`, `DELETE` are present and referencing `has_tenant_role`.
- **Advisor snapshot after apply:** Rerun successfully. `SECURITY DEFINER` and `unindexed_foreign_keys` warnings remain (as expected).

## 13. What was intentionally NOT changed
- No source code.
- No Git migrations.
- No `seed.sql`.
- No dictionary cloud seed inserted.
- No storage/photo drift fixed.
- No security advisor issues fixed.
- No auth changes.
- No Edge Functions changed.
- No production data edits outside migration definitions.

## 14. Remaining known issues
- Orphaned `add_dental_photo_storage` migration.
- `SECURITY DEFINER` RPC advisor warnings.
- No-tenant localStorage boundary risks.
- Treatment stages sync/transaction risks.
- Archived findings UI cleanup.
- Cloud dictionary rows may still need tenant-specific seed/population.

## 15. Checks run
- `git status --short`: [clean]
- `npm run lint`: PASS
- `npm run test -- --run`: PASS (258 tests)
- `npm run build`: PASS
- GitHub Actions CI result: PASS, workflow `CI`, run #351, head `176b8100da06b4253d5d21f28014b361954bee66`

## 16. Final verdict
**CLOUD SCHEMA ALIGNED FOR 0004/0005**

## 17. Recommended next task
**SUPABASE-CLOUD-DICTIONARY-SEED-RECON-001**
