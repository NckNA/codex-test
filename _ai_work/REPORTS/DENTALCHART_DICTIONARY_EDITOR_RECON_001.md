# RECON REPORT: DENTALCHART-DICTIONARY-EDITOR-RECON-001

## Verdict
The current dictionary structure is entirely static and not ready for a dynamic, tenant-based editing model. However, the data interfaces already support required fields (like `price` for works and `allowedDiagnosisIds`). The system is ready to be refactored into an editable `DictionariesRepository` without massive structural changes, provided that direct imports of static dictionaries are completely eliminated from components.

## Current dictionary sources
- **Diagnoses**: Located in `src/config/clinicalDictionaries.ts` as `defaultDiagnoses` (`ClinicalDiagnosis[]`).
- **Works**: Located in `src/config/clinicalDictionaries.ts` as `defaultWorks` (`ClinicalWork[]`).
- **Data model**: `ClinicalWork` already has an optional `price?: number` field. Diagnoses inherently do not have prices.

## Tooth editor flow
- In `ToothEditorModal.tsx`, the diagnosis-to-work mapping relies on `allowedDiagnosisIds` in the `ClinicalWork` object.
- When a diagnosis is selected, works with that diagnosis ID in their `allowedDiagnosisIds` (plus works that are globally `base_available`) are loaded into the UI.
- This linkage is used purely for filtering and populating the available works in the tooth editor, not for calculating base pricing.

## Persistence analysis
- Selected tooth treatments are persisted in `DentalChartRepository` within `localStorage` under the `codex_dental_charts` key.
- Inside a patient's chart (`ToothRecord`), assigned works are saved in `plannedWorks` and `plannedWorkRecords`.
- Currently, prices are not explicitly snapshotted into `ToothRecord` or `PlannedWorkRecord`.

## Tenant / RLS notes
- Future Supabase implementation will require dictionaries to be tenant-scoped.
- Tenant A must have their own pricing and works list separate from Tenant B.
- Row Level Security (RLS) policies will need to enforce that dictionaries are selected and modified only `WHERE tenant_id = auth.uid()`.
- The current static approach (`import { defaultWorks }`) prevents tenant scoping and mandates moving dictionaries into a state/context or repository layer.

## Recommended MVP model
1. Create `ClinicalDictionariesRepository` (localStorage-backed for now) to store mutable `diagnoses` and `works`.
2. Implement a Seeding mechanism: if the repository is empty, populate it using the static constants from `clinicalDictionaries.ts`.
3. Create a custom hook `useDictionaries` (or Context Provider) to expose the repository data throughout the app.
4. Refactor `ToothGrid` and `ToothEditorModal` to consume `useDictionaries()` instead of statically importing the constants.
5. Create a basic "Dictionaries" editor in the Doctor section to CRUD works/diagnoses, edit prices, and manage `allowedDiagnosisIds`.
6. Update the `ToothEditorModal` submission flow so that when a work is assigned to a tooth, its *current* price is saved alongside the work record (in `PlannedWorkRecord` or similar existing structure).

## Risks
1. **Direct Imports**: Many files currently use `import { defaultDiagnoses, ... }`. If not thoroughly replaced with the new hook, this will create two conflicting sources of truth.
2. **Tenant Migration**: If dictionaries are persisted locally now, moving to Supabase later will require careful migration scripts to ensure tenant scoping.
3. **Seeding/Migration**: Updating the default static constants later won't automatically update existing users' localStorage.
4. **Referential Integrity**: Disabling or deleting a dictionary item in the editor might break existing tooth records (`DentalChart`) that reference the deleted ID. A soft-delete (`isActive` flag) mechanism should be considered.

## Explicitly out of scope
- Treatment plan generation, approval, or automation.
- Role-based access control (RBAC).
- Billing, cashier, and invoice generation.
- Discounts system.
- Supabase migrations or backend schema changes.

## Proposed next implementation tasks
**Task: DENTALCHART-DICTIONARY-EDITOR-MVP-001**
- **Goal**: Make dental chart dictionaries editable with prices, ensuring selected tooth work captures the price.
- **Allowed Files**: `src/config/clinicalDictionaries.ts`, `src/data/repositories/ClinicalDictionariesRepository.ts` (new), `src/data/hooks/useDictionaries.ts` (new), `src/components/dental/ToothEditorModal.tsx`, `src/components/dental/ToothGrid.tsx`, UI components for the Doctor section.
- **Forbidden Files**: Treatment plans, billing modules, Supabase schema, patient repo, RBAC logic.

## Required QA for next implementation
- Verify that changing a price in the Doctor section updates the available works list correctly.
- Verify that assigning a work to a tooth saves the *current* price at the time of assignment.
- Verify that changing the price in the dictionary *after* assignment does not alter the price on already assigned teeth.
- Verify that linking/unlinking a diagnosis to a work correctly filters the options in `ToothEditorModal`.
- Verify `npm run lint` and `npm run test` pass.

## Final recommendation
Proceed with the MVP implementation as described. Focus strictly on replacing static imports with a `localStorage` repository pattern, ensuring price snapshotting on assignment, and building a basic CRUD UI in the Doctor section, while strictly avoiding treatment plans and billing features.
