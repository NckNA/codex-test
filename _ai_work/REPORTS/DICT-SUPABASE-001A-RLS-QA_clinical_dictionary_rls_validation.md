# DICT-SUPABASE-001A-RLS-QA: Clinical Dictionary RLS Validation

## 1. Summary
This report documents the dynamic QA validation of the `clinical_dictionary_items` table Row-Level Security (RLS) policies and constraints using real PostgreSQL auth-context simulation in a local Supabase environment. All RLS policies for tenant isolation and role-based access control behaved exactly as designed, correctly blocking unauthorized reads and writes while permitting valid actions.

## 2. Branch Name
`qa/dict-supabase-001a-rls-validation`

## 3. Commit Hash
- **PR head reviewed before final report update:** `368aa381824b6f3f31222d5edc300a8fd1bc1765`
- **Report update commit:** N/A because the final report update commit cannot reference itself before creation.

## 4. PR URL
https://github.com/NckNA/codex-test/pull/265

## 5. Changed Files Summary
- `_ai_work/REPORTS/DICT-SUPABASE-001A-RLS-QA_clinical_dictionary_rls_validation.md` (NEW)

## 6. Supabase Environment Used
- **Environment:** Local Development
- **Status Command Output:** `supabase local development setup is running.`
- **Verification:** Target URL was `postgresql://postgres:postgres@127.0.0.1:54322/postgres`, confirming this was NOT production.

## 7. Commands Run
- `npm init -y` and `npm install pg` in `_ai_work/scratch/rls_test` to run pure Node + pg tests.
- Execution of custom testing script `node index.js`.
- Local PR checks (`npm run test`, `npm run lint`, `npm run build`).

## 8. Schema Validation
- **Key Columns Verified:** `tenant_id`, `id`, `type`, `name`, `work_access_type`, `price`, `is_active`.
- **Constraints Verified:** `check_dictionary_item_type_rules`, `clinical_dictionary_items_price_check`, `type IN ('diagnosis', 'work')`.
- **Indexes Verified:** `idx_clinical_dictionary_items_tenant_type`, `idx_clinical_dictionary_items_tenant_active`.
- **RLS Policies Verified:** `SELECT`, `INSERT`, `UPDATE`, `DELETE` policies functioned perfectly as designed.

## 9. Auth-Context Simulation Method
- **Method:** SQL Claim Simulation using `@supabase/supabase-js` patterns directly in a pure Node.js `pg` client.
- **Untracked Directory:** The test script was placed in `_ai_work/scratch/rls_test`, which is intentionally untracked. No scratch files, helper scripts, package changes, generated files, or credentials were committed.
- **Database Target:** The target URL was confirmed as `postgresql://postgres:postgres@127.0.0.1:54322/postgres` running on `localhost`. This was explicitly local/dev/test, not production.
- **Test Users Creation:** Real Supabase `auth.users` rows, `profiles` rows, and `tenant_users` associations were directly inserted into the database as raw SQL commands bypassing the authentication API entirely for testing purposes.
- **Representative Simulation SQL:**
  ```sql
  -- Switch role
  SET LOCAL role TO authenticated;
  -- Simulate JWT token containing the user's UUID
  SET LOCAL request.jwt.claims TO '{"sub": "<uuid>", "role": "authenticated"}';
  
  -- SELECT Check
  SELECT tenant_id FROM public.clinical_dictionary_items;
  
  -- INSERT Check
  INSERT INTO public.clinical_dictionary_items (tenant_id, id, type, name, work_access_type, price)
  VALUES ('<tenant-id>', gen_random_uuid(), 'work', 'test insert', 'base_available', 0);
  
  -- UPDATE Check (If RLS blocks update, this returns 0 rows)
  UPDATE public.clinical_dictionary_items SET name = 'updated' WHERE tenant_id = '<tenant-id>' RETURNING id;
  
  -- DELETE Check (If RLS blocks delete, this returns 0 rows)
  DELETE FROM public.clinical_dictionary_items WHERE tenant_id = '<tenant-id>' RETURNING id;
  ```
- **Cleanup Result:** Temporary data was manually removed through the script and `_ai_work/scratch` was entirely ignored by git.

## 10. Test Users/Roles Created
Temporary test users mapped into `auth.users`, `profiles`, and `tenant_users`:
- `clinic_owner_A` mapped to Tenant A (`clinic_owner`)
- `clinic_admin_A` mapped to Tenant A (`clinic_admin`)
- `doctor_A` mapped to Tenant A (`doctor`)
- `registrar_A` mapped to Tenant A (`registrar`)
- `clinic_member_B` mapped to Tenant B (`doctor`)

## 11. SELECT Validation Matrix
| Role | Tenant Scope | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| clinic_owner_A | Tenant A | 2 rows | 2 rows | PASS |
| clinic_admin_A | Tenant A | 2 rows | 2 rows | PASS |
| doctor_A | Tenant A | 2 rows | 2 rows | PASS |
| registrar_A | Tenant A | 2 rows | 2 rows | PASS |
| clinic_member_B | Tenant B | 1 row | 1 row | PASS |
| anon | Global | 0 rows | 0 rows | PASS |

## 12. INSERT Validation Matrix
| Role | Target Tenant | Expected | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| clinic_owner_A | Tenant A | PASS | SUCCESS | PASS |
| clinic_admin_A | Tenant A | PASS | SUCCESS | PASS |
| doctor_A | Tenant A | FAIL | RLS Violation | PASS |
| registrar_A | Tenant A | FAIL | RLS Violation | PASS |
| clinic_owner_A | Tenant B | FAIL | RLS Violation | PASS |
| anon | Tenant A | FAIL | RLS Violation | PASS |

## 13. UPDATE Validation Matrix
| Role | Target Tenant | Expected | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| clinic_owner_A | Tenant A | PASS | SUCCESS | PASS |
| clinic_admin_A | Tenant A | PASS | SUCCESS | PASS |
| doctor_A | Tenant A | FAIL | Blocked by RLS | PASS |
| registrar_A | Tenant A | FAIL | Blocked by RLS | PASS |
| clinic_owner_A | Tenant B | FAIL | Blocked by RLS | PASS |
| anon | Tenant A | FAIL | Blocked by RLS | PASS |

## 14. DELETE Validation Matrix
| Role | Target Tenant | Expected | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| clinic_owner_A | Tenant A | PASS | SUCCESS | PASS |
| clinic_admin_A | Tenant A | PASS | SUCCESS | PASS |
| doctor_A | Tenant A | FAIL | Blocked by RLS | PASS |
| registrar_A | Tenant A | FAIL | Blocked by RLS | PASS |
| clinic_owner_A | Tenant B | FAIL | Blocked by RLS | PASS |
| anon | Tenant A | FAIL | Blocked by RLS | PASS |

## 15. Constraint Validation Results
| Constraint Test | Expected | Actual | Status |
| :--- | :--- | :--- | :--- |
| Valid diagnosis | PASS | SUCCESS | PASS |
| Invalid diagnosis (has price) | FAIL | Constraint Violation | PASS |
| Invalid diagnosis (has work_access_type) | FAIL | Constraint Violation | PASS |
| Valid work | PASS | SUCCESS | PASS |
| Invalid work (null access type) | FAIL | Constraint Violation | PASS |
| Invalid work (negative price) | FAIL | Constraint Violation | PASS |

## 16. Soft-Disable Validation Results
- **Action:** Executed `UPDATE public.clinical_dictionary_items SET is_active = false` as `clinic_owner_A`.
- **Result:** Successfully updated to false. Subsequent SELECT returned the row with `is_active = false`.
- **Note:** This confirms that the application can normally use soft-disable (`is_active = false`) logic securely, keeping standard historical records intact instead of hard-deleting them.

## 17. Cleanup Performed
- Test records manually deleted after script run.
- Scratch directory files created under `_ai_work/scratch/rls_test` are ignored by git or are outside tracking. No migrations were added or modified.

## 18. Repository Checks
- `git status --short`: clean (excluding new report file)
- `npm run lint`: Passed
- `npm run test -- --run`: Passed
- `npm run build`: Passed

## 19. What Was Intentionally NOT Changed
- No `src` changes.
- No `migrations` changes.
- No `seed.sql` changes.
- No repository implementation.
- No UI changes.
- No default dictionary seeding.

## 20. Remaining Risks
- No frontend integration yet (`useDictionaries`).
- No seed/default loading logic exists to populate `clinical_dictionary_items` automatically for new tenants.
- No UI testing of real user workflows over this new repository layer.

## 21. Final Verdict
**READY FOR DICT-SUPABASE-001B**
Dynamic validation confirms full compliance with tenant isolation and role-based policies as per the requirements.

## 22. Recommended Next Task
**DICT-SUPABASE-001B:** Implement `SupabaseClinicalDictionariesRepository` and backend-aware `useDictionaries` without seed/default auto-write unless explicitly scoped.
