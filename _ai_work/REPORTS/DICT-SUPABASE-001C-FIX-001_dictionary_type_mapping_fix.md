# DICT-SUPABASE-001C-FIX-001: Dictionary Type Mapping Fix

## 1. Summary
This task resolves the blocker discovered during `DICT-SUPABASE-001C-QA` where `SupabaseClinicalDictionariesRepository` omitted the `type` property when mapping database rows to domain objects. This bug caused all dictionaries to incorrectly fall through to 'work' behaviors in the UI, breaking `MedicalPage` filtering and `ToothEditorModal` badge rendering.

## 2. Branch Name
`fix/dict-supabase-001c-type-mapping`

## 3. Commit Hash
[Pending PR creation]

## 4. PR URL
[Pending PR creation]

## 5. Changed Files Summary
- `src/data/repositories/ClinicalDictionariesRepository.ts`: Added `type: 'diagnosis'` and `type: 'work'` to Supabase domain mappers.
- `src/data/repositories/ClinicalDictionariesRepository.test.ts`: Updated tests to expect `type` keys and added `MedicalPage` regression tests.
- `_ai_work/REPORTS/DICT-SUPABASE-001C-FIX-001_dictionary_type_mapping_fix.md`: This report.

## 6. Root Cause
The `getDiagnoses()` and `getWorks()` Supabase mappers mapped database row data to domain properties but failed to inject the literal `type` discriminators (`'diagnosis'` and `'work'`) that the domain shape expects.

## 7. Impact
Because the type was undefined, operations like `item.type === 'diagnosis'` evaluated to false. `MedicalPage` and `DiagnosisEditorRow` logic fell through to default/work states, causing all items in Supabase mode to incorrectly render visually as "РАБОТА" (Work), breaking type-filtering on the UI.

## 8. Fix
In `src/data/repositories/ClinicalDictionariesRepository.ts`:
- Modified `getDiagnoses()` mapper to explicitly set `type: 'diagnosis'`.
- Modified `getWorks()` mapper to explicitly set `type: 'work'`.

## 9. Tests Added/Updated
- **Updated mappings:** Extended `toEqual` checks for Supabase read mapping tests to assert that `type: 'diagnosis'` and `type: 'work'` are present in the resulting objects.
- **Regression coverage:** Added a new test suite `describe('F. MedicalPage compatibility regression')` that simulates the `MedicalPage` behavior by loading `diagnoses` and `works`, combining them into one array, and verifying that `.filter(item => item.type === 'diagnosis')` and `.filter(item => item.type === 'work')` accurately split the arrays without leakage.

## 10. Browser Smoke
- **Local/dev Mode:** **PASS**. Checked `/medical` without `.env.local` configured. The local storage fallback returned items correctly mapped (due to how local data hydrates), and filtering by "Диагнозы" / "Работы" succeeded seamlessly.
- **Supabase-Active Mode:** **PASS**. Created `.env.local` pointing to the local Supabase container, navigated to `/medical`, and authenticated as `admin@demo.com`. Verified that the seeded Demo Clinic A data correctly rendered with the distinct visual badges ("ДИАГНОЗ" in green and "РАБОТА" in blue), and type-filtering correctly toggled visibility.

## 11. What was intentionally NOT changed
- No changes to `MedicalPage.tsx` or `ToothEditorModal.tsx`.
- No hook/provider changes.
- No migrations, seeds, or RLS policies altered.
- No auto-seeding behavior inserted.

## 12. Remaining Risks
The domain models define `type` on `ClinicalDiagnosis` and `ClinicalWork` implicitly in some areas of the codebase but it is strictly enforced in components. Relying heavily on `item.type === 'diagnosis'` is safe now that the repository guarantees the literal string.

## 13. Final Verdict
**READY FOR REVIEW**

## 14. Recommended Next Task
**DICT-SUPABASE-001C-QA-CONTINUE**:
Re-run MedicalPage and ToothEditor runtime validation after type mapping fix to confirm overall readiness of the feature.
