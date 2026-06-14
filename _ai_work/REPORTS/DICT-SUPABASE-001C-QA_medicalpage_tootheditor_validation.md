# DICT-SUPABASE-001C-QA: Validate MedicalPage and ToothEditor in Supabase Mode

## Overview
This report validates the clinical dictionaries repository wiring in both `dev/local` fallback and `supabase-active` modes.

## QA Results

### 1. Dev/Local Mode (Fallback)
- **Status:** **PASS**
- **Action taken:** Started dev server with missing/empty `.env.local` to trigger fallback mode.
- **Result:** The `MedicalPage` correctly loaded `localStorage` combined with static `clinicalDictionaries.ts` defaults. Diagnoses and Works rendered correctly. Adding a diagnosis saved it to `localStorage` and persisted across reload.

### 2. Supabase DB Seeding
- **Status:** **PASS**
- **Action taken:** Ran `npx supabase db reset` and `npx supabase db query`.
- **Result:** Confirmed 43 rows (25 diagnoses, 18 works) correctly seeded under `tenant_id` matching `Demo Clinic A`.

### 3. Supabase-Active Mode Configuration
- **Status:** **PASS**
- **Action taken:** Configured `.env.local` with local Supabase `VITE_SUPABASE_URL` and anon key. Created two test users (`admin@demo.com` and `doctor@demo.com`) mapped to `Demo Clinic A` in `tenant_users` via SQL.

### 4. Supabase-Active Mode Browser Validation
- **Status:** **FAIL** (Blocker found)
- **Action taken:** Logged in as `admin@demo.com`. Navigated to `/medical`.
- **Result:** Dictionaries successfully loaded from Supabase but failed to render correctly.
- **Bug Discovered:** `SupabaseClinicalDictionariesRepository` mapper omits `type` from mapped dictionary items.
- **Impact:** `MedicalPage` relies on `item.type === 'diagnosis'`. Without `type`, Supabase-loaded diagnoses/works render incorrectly, for example all items appear as “Работа” in the UI, and filtering logic breaks.

### 5. ToothEditor Modal Validation
- **Status:** **FAIL** (Blocked by same bug)
- **Action taken:** Navigated to a seeded patient card and opened the tooth editor for tooth 11.
- **Result:** The modal correctly reached out to the Supabase-backed repository, but due to the omitted `type` mapping bug, dictionary items lacked the required structure to be handled safely by the dropdowns.

## Recommended Next Fix
**DICT-SUPABASE-001C-FIX-001:**
Add dictionary item `type` to Supabase repository mapping and update corresponding tests.

## Checks and PR metadata
- **PR URL:** https://github.com/NckNA/codex-test/pull/270
- **Branch:** qa/dict-supabase-001c-medicalpage-tootheditor
- **PR head reviewed before final report update:** 7e0299bcc4d6f684937cd997f39fa15b79bca178
- **Report update commit:** N/A because the final report update commit cannot reference itself before creation
- **Final changed files summary:**
  - `_ai_work/REPORTS/DICT-SUPABASE-001C-QA_medicalpage_tootheditor_validation.md`
- **git status --short:**
```
 M _ai_work/REPORTS/DICT-SUPABASE-001C-QA_medicalpage_tootheditor_validation.md
?? _ai_work/scratch/
?? outputs/
?? pr.txt
?? seed_output.sql
```
- **npm run lint:** Passed (0 errors, 0 warnings)
- **npm run test -- --run:** Passed (257 tests passed)
- **npm run build:** Passed
- **GitHub Actions CI:** Passing for this scope
- **Environment Notice:** Verified that `.env.local` and `_ai_work/scratch/*` remain untracked locally and were successfully excluded from all commits.

## Conclusion
The clinical dictionary repository successfully connects to Supabase and fetches the isolated tenant rows correctly. However, a mapping flaw (`type` omission) breaks `MedicalPage` runtime logic. The PR remains report-only so that the implementation fix can be handled cleanly in a separate follow-up task.
