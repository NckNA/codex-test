# DICT-SUPABASE-SEED-001A: Demo Clinic Clinical Dictionary Seed

## 1. Summary
This task seeded Demo Clinic A (`11111111-1111-1111-1111-111111111111`) with default clinical dictionary rows into `supabase/seed.sql`. This fulfills the prerequisite to connect `useDictionaries` to Supabase without breaking the dental charting workflow, allowing `clinical_dictionary_items` to have data out-of-the-box in local development.

## 2. Branch Name
`feature/dict-supabase-seed-001a-demo-defaults`

## 3. Commit Hash
- **PR head reviewed before final report update:** `164cd6b36219d56f286d98288bacb390c3d2b998`
- **Report update commit:** N/A because the final report update commit cannot reference itself before creation

## 4. PR URL
https://github.com/NckNA/codex-test/pull/267

## 5. Changed Files Summary
- `supabase/seed.sql` (MODIFIED: appended dictionary seed data)
- `_ai_work/REPORTS/DICT-SUPABASE-SEED-001A_demo_clinical_dictionary_seed.md` (NEW)

## 6. Source of Truth
The seed definitions were strictly derived from:
- `src/config/clinicalDictionaries.ts`
- `defaultDiagnoses`
- `defaultClinicalWorks`
No new diagnosis/work IDs were invented. No descriptions, prices, allowed statuses, or allowed zones were altered.

## 7. Seed Strategy
- **Demo Clinic A only:** Data was explicitly seeded only for tenant `11111111-1111-1111-1111-111111111111`.
- **Idempotent Upsert:** The seed script uses `INSERT ... ON CONFLICT (tenant_id, id) DO UPDATE SET ...` to guarantee safety upon repeated `db reset` commands without deleting custom rows created during testing.
- **No auto-write on read:** The repository is still independent. No auto-seeding logic was injected into the front-end codebase.
- **No new tenant initialization yet:** Tenant B remains unseeded, leaving new tenant initialization logic for a future task.

## 8. Mapping Summary
- **Diagnosis mapping:** `type = 'diagnosis'`, `work_access_type = null`, `allowed_diagnosis_ids = '{}'`.
- **Work mapping:** `type = 'work'`, `work_access_type` maps to `base_available`, `status_available`, or `requires_diagnosis`.
- **Arrays:** Correctly formatted to PostgreSQL text arrays (e.g., `ARRAY['natural', 'deciduous']::text[]`).
- **Price:** Mapped to `null` unless provided.
- **AllowedDiagnosisIds:** Mapped perfectly, preserving diagnosis-work links.
- **IsActive:** Mapped to `true` as the defaults do not specify explicit `false`.

## 9. Row Counts
- **Expected diagnosis count:** 25
- **Actual diagnosis count:** 25
- **Expected work count:** 18
- **Actual work count:** 18
- **Total:** 43

## 10. Representative Row Validation
- **Normal Diagnosis (`dx_caries_initial`):** Found with allowed statuses `['natural', 'deciduous']` and zone `['crown']`.
- **Work with `base_available` (`work_temporary_filling`):** Found.
- **Work with `requires_diagnosis` (`work_fissure_sealing`):** Found.
- **Work with non-empty `allowed_diagnosis_ids` (`work_filling_1_surface`):** Found, accurately linking to `dx_caries_enamel`, `dx_caries_dentin`, `dx_filling_defect`.
- **Priced work:** Not applicable (defaults do not contain priced works).
- **Inactive item:** Not applicable (defaults do not contain inactive items).

## 11. Constraint Validation Results
Validated directly via `pg` script running against local Supabase:
- Diagnoses with invalid work/price fields: 0
- Works with null `work_access_type`: 0
- Items with negative price: 0
- Items with unknown type: 0
All items fully satisfy the constraints defined in `0005_create_clinical_dictionary_items.sql`.

## 12. RLS/Read Validation
- **What was tested:** Direct schema and constraint validations.
- **What was not repeated:** RLS dynamic read simulation across tenant scopes.
- **Reliance on PR #265:** PR #265 explicitly verified the exact `clinical_dictionary_items` RLS constraints via dynamic JWT injection for local auth-contexts. As the RLS logic targets `tenant_id` without differentiating between seeded vs. user-created rows, repeating the RLS QA was deemed unpractical and unnecessary.

## 13. Direct Supabase Validation
- **Environment Used:** Local/Dev Supabase running on Docker (`postgresql://postgres:postgres@127.0.0.1:54322/postgres`).
- **Commands Run:**
  - `npx supabase status`
  - `npx supabase db reset`
  - `node _ai_work/scratch/rls_test/validateSeed.js` (Custom pg client script).
  - *Note: `_ai_work/scratch/` and `validateSeed.js` were local/untracked validation artifacts and were not committed.*
- **SQL Checks Run:** Row count verifications (`COUNT(*) WHERE type = 'work'`), single-row inspections (`SELECT * WHERE id = 'dx_caries_initial'`), constraint sanity checks (`SELECT WHERE type='diagnosis' AND price IS NOT NULL`), and tenant scope isolation checks.
- **Results:** 100% success. DB reset applied flawlessly. All 43 rows inserted cleanly.

## 14. Repository Checks
- `git status --short`: clean (excluding the generated report)
- `npm run lint`: Passed
- `npm run test -- --run`: Passed
- `npm run build`: Passed

## 15. What Was Intentionally NOT Changed
- No `src` changes.
- No `migrations`.
- No `RLS` changes.
- No repository implementation.
- No UI integration.
- No Edge Function or DB Triggers for new tenant initialization.
- No Tenant B seed data inserted.

## 16. Remaining Risks
- Repository still relies entirely on `localStorage`.
- `MedicalPage` still does not read or save to Supabase.
- New tenant default initialization is not implemented (Tenant B is unseeded).
- Existing localStorage edits are not migrated and will be visually missing once the backend transitions to Supabase.
- Future browser QA is required to ensure `useDictionaries` seamlessly adapts to the API transition.

## 17. Final Verdict
**READY FOR DICT-SUPABASE-001B**
Demo Clinic A is now fully equipped with a reliable set of defaults in Supabase `local/dev`.

## 18. Recommended Next Task
**DICT-SUPABASE-001B:** Implement `SupabaseClinicalDictionariesRepository` and backend-aware `useDictionaries`, with no auto-seeding and no UI redesign.
