# RECON-DICT-DEFAULT-SEED-001: Clinical Dictionary Default Loading Plan

## 1. Summary
Integrating `SupabaseClinicalDictionariesRepository` (DICT-SUPABASE-001B) before solving default dictionary loading is highly risky. `clinical_dictionary_items` is currently completely empty in Supabase. If we switch the repository to read from Supabase now, all dental charting tools, diagnosis dropdowns, and the Medical Settings page will be completely blank for the Demo Clinic and any other tenant. 

## 2. Current localStorage Default Behavior
- **Keys:** `codex_clinical_diagnoses` and `codex_clinical_works`.
- **Loading:** `ClinicalDictionariesRepository.getDiagnoses()` and `getWorks()` attempt to parse the localStorage keys. 
- **Missing Data:** If a key is missing, the repository immediately calls `this.saveDiagnoses(defaultDiagnoses)` or `saveWorks(defaultClinicalWorks)` to write the hardcoded constants into localStorage, and returns the defaults.
- **Parse Errors:** If JSON parsing fails, the repository silently catches the error and returns the defaults, but does *not* attempt to overwrite the corrupted localStorage.
- **After Save:** Updates made in the UI overwrite the entire array in localStorage via `JSON.stringify`.
- **References:** When defaults are initially returned (either via missing key or parse error), they are returned as references to the static `src/config/clinicalDictionaries.ts` arrays until the user explicitly saves a modification, at which point deep copies are pushed to storage.

## 3. Current Default Dictionary Source
- **Definitions:** `defaultDiagnoses` and `defaultClinicalWorks` are defined in `src/config/clinicalDictionaries.ts`.
- **ID/Code Strategy:** Uses stable string identifiers (e.g., `dx_caries_initial`, `work_fissure_sealing`).
- **Diagnosis/Work Link Strategy:** `ClinicalWork` objects define `allowedDiagnosisIds` as an array of diagnosis string IDs.
- **Price Strategy:** `price` is optional. The default constants do not include prices; users must define them in the Medical Settings page.
- **Presence Statuses:** Hardcoded arrays defining valid tooth statuses (e.g., `['natural', 'deciduous']`).
- **Allowed Zones:** Hardcoded arrays defining valid structural zones (e.g., `['crown', 'endodontics']`).
- **Work Access Types:** Defines strict conditions for when a work is allowed (`base_available`, `status_available`, `requires_diagnosis`).
- **Active/Disabled:** `isActive` is an optional boolean, treated as implicitly `true` if undefined.

## 4. Current Consumers Affected by Empty Dictionaries
- **MedicalPage:** The settings UI relies entirely on the repository arrays. If empty, it renders an empty list, forcing the clinic admin to manually create every single diagnosis and work from scratch.
- **useDictionaries:** Will return empty `diagnoses` and `works` arrays. Can tolerate empty arrays safely, but functionality downstream drops to zero.
- **ToothEditorModal:** If dictionaries are empty, clicking a tooth will show zero diagnoses to select from, and consequently zero available clinical works. The charting workflow completely breaks.
- **ToothGrid & DentalChartRepository / TreatmentPlansRepository:** These store static snapshots of prices, names, and IDs. Reading historical charts will not break because the data is already denormalized inside the finding/treatment models. However, editing or adding new treatments is impossible without dictionary data.
- **Price Snapshots:** Unaffected for existing records, impossible to generate for new records.

## 5. Supabase Table Readiness
- **Required Fields:** `tenant_id`, `id`, `type`, `name`, `work_access_type`, `allowed_presence_statuses`, `allowed_zones`, `allowed_diagnosis_ids`.
- **Constraints:** `type IN ('diagnosis', 'work')`, `check_dictionary_item_type_rules` (enforces strict structural rules between works and diagnoses), `clinical_dictionary_items_price_check` (price >= 0).
- **Tenant Isolation:** Enforced via `tenant_id` and RLS `get_user_tenants()`.
- **RLS Behavior:** Validated in QA. Owners/admins can insert/update/delete. Doctors/registrars are strictly read-only.
- **Storage Capability:** Can seamlessly store current TypeScript default models. `id` is `TEXT`, so `dx_caries_initial` fits perfectly without needing UUID generation. JSON array fields map cleanly to PostgreSQL `TEXT[]`.

## 6. Seed/Default Strategy Options

### Option A: Seed Demo Clinic defaults in `supabase/seed.sql` only.
- **Tenant Isolation:** Perfect for the demo clinic.
- **Complexity:** Extremely low. Just pure SQL INSERTS in the seed file.
- **New Tenants:** Will start with empty dictionaries. 
- **Recommendation:** Good for unblocking development, but not a SaaS-complete solution.

### Option B: Repository-level fallback to static defaults when Supabase tenant has 0 rows.
- **Behavior:** `useDictionaries` returns the TypeScript constants if the DB query returns `[]`. 
- **Complexity:** High UI complexity. If a user edits one fallback item, does the repo save *just one* or *all 40*? If just one, the DB now has 1 row, meaning the fallback logic breaks on the next load.
- **RLS Issues:** Auto-writing on fallback fails if a doctor logs in (RLS blocks inserts).
- **Recommendation:** Unsafe and buggy.

### Option C: Copy defaults into each tenant during tenant creation.
- **Behavior:** An Edge Function or PostgreSQL Trigger on the `tenants` table inserts 40+ rows into `clinical_dictionary_items` immediately when a tenant is created.
- **Tenant Isolation:** Excellent. Every tenant gets a private sandbox of defaults.
- **Complexity:** Medium. Requires writing a robust DB trigger.
- **Recommendation:** The correct long-term SaaS architecture.

### Option D: System/global defaults table + tenant override model.
- **Behavior:** `clinical_dictionary_items` allows `tenant_id = null` for global items. Tenants override them by inserting shadows with the same ID.
- **Complexity:** Extremely high. Requires union queries and complex RLS.
- **Recommendation:** Overkill.

## 7. Recommended Strategy
**Short-term MVP:** Execute **Option A**. Seed Demo Clinic A (`11111111-1111-1111-1111-111111111111`) via `supabase/seed.sql`.
**Long-term SaaS:** Execute **Option C** in a future task via a PostgreSQL trigger on tenant creation.

- **Should DICT-SUPABASE-001B wait?** YES. Repository integration must wait until `seed.sql` guarantees the Demo Clinic has data.
- **Should repository fallback be allowed?** NO.
- **Should auto-write be forbidden?** YES. Auto-writes are a critical RLS and race-condition risk.
- **Should seed loading be a separate task?** YES.

## 8. Demo Clinic Strategy
- **Tenant:** Demo Clinic A (`11111111-1111-1111-1111-111111111111`) already exists in `seed.sql`.
- **Row Count:** Approximately 43 rows (25 diagnoses, 18 works).
- **ID Strategy:** Must exactly match `src/config/clinicalDictionaries.ts` (e.g., `dx_caries_initial`) to preserve front-end links and tests.
- **Sufficiency:** This is perfectly sufficient for local Supabase browser QA.

## 9. New Tenant Strategy (Future)
Future tenants should receive defaults via a **PostgreSQL Trigger on `tenants` insertion**. The trigger should execute a function that loops over static JSON/array defaults and inserts them into `clinical_dictionary_items` for the `NEW.id`. This guarantees atomic initialization without exposing auto-write logic to the frontend.

## 10. Local Fallback Strategy
- `LocalStorageClinicalDictionariesRepository` remains untouched.
- `local` mode continues to use localStorage.
- **Unconfigured Supabase:** If `supabase-active` is selected but credentials fail or are missing, the app must route to the `LocalStorage` fallback.
- **Supabase Errors:** If the DB query fails (e.g., network error), `useDictionaries` MUST propagate the error or throw. It must **not** silently failover to localStorage, as this risks split-brain data corruption.

## 11. Empty Supabase Tenant Behavior
If `supabase-active` is true, the tenant exists, and the DB query succeeds but returns `[]` (zero rows):
**Behavior:** Return `[]`. The UI should render an empty state. 
**Justification:** Showing read-only defaults is misleading if they cannot be edited. Auto-copying is dangerous. Showing an empty state forces the clinic owner to initialize their settings (or proves that our DB trigger failed to fire).

## 12. Auto-Write Risk Analysis
Repository auto-seeding is strictly forbidden because:
1. **Hidden writes on read:** Violates CQRS principles.
2. **Race conditions:** Concurrent users logging in will trigger duplicate INSERTS.
3. **RLS write permission mismatch:** If a Doctor logs in first, their auto-write will be blocked by RLS, causing a fatal error and blocking the app load.

## 13. Price Snapshot Compatibility
- Changing a price in the dictionary must **never** retroactively alter the price of assigned works on historical dental charts.
- The `ToothEditorModal` and `DentalChartRepository` currently take a snapshot of the work's attributes when assigned. This behavior is safe and must be strictly preserved.

## 14. ID Compatibility
- The `id` column must retain the string keys (`dx_...`, `work_...`).
- If these are converted to UUIDs, `allowedDiagnosisIds` links will break, and any hardcoded business logic will fail. 

## 15. Tests Required for Future Implementation
- **Seed Row Integrity:** Ensure Demo Clinic has exactly the correct number of works and diagnoses.
- **Supabase Zero-Row Behavior:** Verify that an empty tenant genuinely returns `[]`.
- **Unconfigured Fallback:** Ensure `useDictionaries` routes correctly based on `backend` configuration.
- **Supabase Error Propagation:** Verify failed queries throw errors instead of hiding behind local state.
- **Price Preservation:** Verify old dental chart records retain original prices despite dictionary modifications.

## 16. Browser QA Plan for Future Implementation
1. Boot app in `local` mode: verify dictionaries load via localStorage.
2. Boot app in `supabase-active` mode: verify Demo Clinic dictionaries load from DB.
3. Open `MedicalPage`: verify lists populate correctly.
4. Open `ToothEditorModal`: verify diagnoses are clickable and valid works appear.
5. Create a test tenant (if UI allows) and verify behavior (should be empty for now).

## 17. Direct Supabase Work Needed
**NOTE FOR NICK:**
Task **DICT-SUPABASE-SEED-001A** requires direct Supabase work because it involves modifying `supabase/seed.sql` and verifying the data insertion directly in the local PostgreSQL container. It should be handed to Codex/Google with Supabase access.

## 18. Recommended Task Breakdown
1. **DICT-SUPABASE-SEED-001A:** Seed Demo Clinic clinical dictionaries into `supabase/seed.sql`. (Requires direct Supabase access).
2. **DICT-SUPABASE-001B:** Implement `SupabaseClinicalDictionariesRepository` and update `useDictionaries` routing.
3. **DICT-SUPABASE-001C:** Ensure `MedicalPage` works with Supabase.
4. **DICT-SUPABASE-DEFAULTS-002:** (Future) Add PostgreSQL trigger for automatic new tenant initialization.

## 19. Risks and Blockers
- **Seed Drift:** `src/config/clinicalDictionaries.ts` and `seed.sql` might drift out of sync over time. We must treat `seed.sql` as the ultimate source of truth for the Demo Clinic.
- **LocalStorage Migration:** Existing local edits made by users in `local` mode cannot be automatically migrated to Supabase safely due to tenant boundary mismatches. They must be manually recreated.
- **Empty UI Shock:** A new tenant without the future DB trigger will see a broken UI.

## 20. Final Verdict
**READY for DICT-SUPABASE-SEED-001A.**
Repository integration (001B) MUST wait until the Demo Clinic seed is implemented. Auto-writing defaults is dangerous and forbidden. The exact next safe task is to seed the database.

**Recommended Next Task Prompt:**
"Execute DICT-SUPABASE-SEED-001A: Seed Demo Clinic A clinical dictionaries into supabase/seed.sql using the exact definitions from src/config/clinicalDictionaries.ts."

## 21. Checks and PR metadata
- PR URL: https://github.com/NckNA/codex-test/pull/266
- Branch: recon/dict-default-seed-001
- PR head reviewed before final report update: ec42df2d7a7fadd1b4f6a75cd873ef940ca79164
- Report update commit: N/A because the final report update commit cannot reference itself before creation
- git status --short: clean
- npm run lint: Passed
- npm run test -- --run: Passed (32 files, 225 assertions)
- npm run build: Passed
- GitHub Actions CI: pass (Green)
