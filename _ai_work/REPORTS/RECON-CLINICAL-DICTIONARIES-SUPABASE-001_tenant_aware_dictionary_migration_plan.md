# RECON-CLINICAL-DICTIONARIES-SUPABASE-001: Tenant-aware dictionary migration plan

## Summary
This report analyzes the current `localStorage`-based clinical dictionary implementation and plans its migration to a tenant-aware Supabase schema. It compares three different schema options, recommends a unified table approach (Option B), and provides a comprehensive implementation breakdown. The migration will establish a robust SaaS foundation for clinical dictionaries while preserving historical data integrity.

## Current Dictionary Model
The dictionaries are defined in `src/config/clinicalDictionaries.ts` as two primary types:
- **ClinicalDiagnosis**: `id`, `type` ('diagnosis'), `name`, `allowedPresenceStatuses`, `allowedZones`, `isActive` (optional).
- **ClinicalWork**: `id`, `type` ('work'), `name`, `price`, `workAccessType`, `allowedDiagnosisIds`, `allowedPresenceStatuses`, `allowedZones`, `isActive` (optional).

## Current Persistence Model with Risks
- **Mechanism:** Synchronous `localStorage.getItem`/`setItem` calls in `ClinicalDictionariesRepository.ts` targeting `codex_clinical_diagnoses` and `codex_clinical_works`.
- **Defaults:** Falls back to hardcoded `defaultDiagnoses` and `defaultClinicalWorks` if storage is empty.
- **Risks:** 
  - **No Tenant Isolation:** Data is local to the browser.
  - **Data Loss:** Clearing browser data wipes custom diagnoses/works.
  - **No Synchronization:** A doctor editing a price on one device will not see the update on another device or for another doctor in the same clinic.
  - **Lack of Auditing:** Impossible to track who changed a price or disabled a diagnosis.

## Detailed Current Consumers Matrix
- **`MedicalPage.tsx`**: The configuration UI. Reads dictionaries, filters them by status/zone, and provides forms to add or edit items (including setting `isActive: false` and changing prices).
- **`ToothEditorModal.tsx`**: The clinical data entry UI. Reads dictionaries to populate available diagnoses/works based on the selected tooth's presence status and clinical zone. Reads `work.price` and persists it as `priceSnapshot` inside the `PlannedWorkRecord`.
- **`TreatmentPlansRepository.ts` / `DentalChartRepository.ts`**: Store string `id`s of diagnoses and works. Persists the snapshotted prices so historical plans are immutable.
- **Hooks (`useDictionaries.tsx`)**: Global React state context wrapper around the repository.

## Supabase Schema Fit
The current `0001_initial_schema.sql` completely lacks dictionary tables. There are tables for `dental_charts`, `tooth_states`, `treatment_stages`, and `findings` which reference dictionary IDs as simple strings/arrays without foreign keys, but the dictionaries themselves are not in the database.

## Schema Options Comparison

### Option A: Separate Tables
Create `clinical_diagnoses`, `clinical_works`, and a many-to-many `clinical_work_diagnoses` table.
- **Tenant Isolation:** High. Primary keys include `tenant_id`.
- **Seed/Default Handling:** Tedious. Requires inserting into three tables and preserving UUID/string keys accurately.
- **Editing:** Requires transactional updates across tables when updating allowed diagnoses for a work.
- **Price Overrides:** Simple `UPDATE clinical_works SET price = ...`.
- **Diagnosis-Work Links:** Strictly typed via `clinical_work_diagnoses`.
- **Soft Disable/Archive:** Standard boolean column on each table.
- **RLS Complexity:** Medium. Need policies for three tables.
- **Query Simplicity:** Low. Requires joins and data aggregation to recreate the frontend `ClinicalWork` interface.
- **Future Maintainability:** Good for strict relational integrity, but potentially over-engineered for a small dictionary dataset (hundreds of rows).
- **Migration Risk:** High due to data structure transformation.

### Option B: Single `clinical_dictionary_items` Table with JSONB/Arrays
A unified table for both diagnoses and works, using `type` to distinguish them and PostgreSQL arrays for metadata (like `allowed_zones`).
- **Tenant Isolation:** High. Primary keys include `tenant_id`.
- **Seed/Default Handling:** Easy. A single bulk insert covers both diagnoses and works.
- **Editing:** Single row `UPDATE`.
- **Price Overrides:** Direct column update `UPDATE ... SET price = ...`.
- **Diagnosis-Work Links:** Handled via a `text[]` column `allowed_diagnosis_ids`.
- **Soft Disable/Archive:** `is_active` boolean flag.
- **RLS Complexity:** Low. One table, one set of policies.
- **Query Simplicity:** High. A single `SELECT *` populates the entire dictionary state cleanly.
- **Future Maintainability:** High. Adding new metadata arrays/flags is straightforward.
- **Migration Risk:** Low. Maps almost 1:1 with the current TypeScript interfaces.

### Option C: System Defaults + Tenant Override Tables
A global read-only `system_dictionary` table plus a `tenant_dictionary_overrides` table.
- **Tenant Isolation:** High for overrides, global for base.
- **Seed/Default Handling:** None required per clinic. Clinics read from global base unless overridden.
- **Editing:** Complex. When a clinic edits a default item, an override row must be created/updated.
- **Price Overrides:** Overrides must shadow the global price.
- **Diagnosis-Work Links:** Very complex to shadow relationship changes.
- **Soft Disable/Archive:** Needs logic to interpret global `is_active` vs local override `is_active`.
- **RLS Complexity:** High.
- **Query Simplicity:** Low. Requires complex `COALESCE` joins to merge global and local state.
- **Future Maintainability:** Risky. If system IDs change or get deleted, overrides break.
- **Migration Risk:** High.

## Recommended Model with Justification
**Option B (Single `clinical_dictionary_items` Table)** is the clear winner. 
It balances relational rigor with frontend agility. Since clinical dictionaries are relatively small and loaded entirely on app start, a single table prevents the `n+1` query problems and complex joins of Option A, while completely avoiding the horrific query/override complexity of Option C. It also maps directly to the current TypeScript definitions, ensuring a fast, safe migration.

## Proposed Tables and Columns
```sql
CREATE TABLE clinical_dictionary_items (
  id text NOT NULL, -- e.g., 'dx_caries_initial' or generated ID
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('diagnosis', 'work')),
  name text NOT NULL,
  allowed_presence_statuses text[] NOT NULL DEFAULT '{}',
  allowed_zones text[] NOT NULL DEFAULT '{}',
  work_access_type text, -- 'base_available' | 'requires_diagnosis'
  allowed_diagnosis_ids text[], -- only for works
  price numeric(10,2), -- only for works
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);
```

## Tenant/RLS Strategy
- The primary key enforces uniqueness per `tenant_id`.
- **Read Access:** `SELECT` allowed for any user belonging to the tenant.
- **Write Access:** `INSERT`, `UPDATE`, `DELETE` must **NOT** be allowed for standard doctors or registrars. Modifying prices and dictionary structures is clinic configuration.
  - Allowed roles: `clinic_owner`, `clinic_admin`. (Using the existing `has_tenant_role` helper).

## Seed/Default Strategy
- **Full Tenant Copy:** When a clinic requires dictionaries (or when a tenant is created), a full copy of the `defaultDiagnoses` and `defaultClinicalWorks` will be bulk-inserted into `clinical_dictionary_items` for that `tenant_id`.
- This ensures every clinic has sensible defaults immediately but can safely customize prices/status without altering other clinics.
- Implementation can be via a Supabase Edge Function triggered on tenant creation, or a repository layer backfill on first load.

## Local Fallback Strategy
- The current `LocalStorageDentalChartRepository` approach will be preserved for the `local` backend mode.
- `createClinicalDictionariesRepository` will route between `local` and `supabase` based on the configured backend, exactly like `ClinicalSummaryAggregator`.

## Migration/Backfill Strategy
- New SaaS clinics will receive fresh seeds.
- Existing local `localStorage` data cannot easily be securely migrated to Supabase from the client side without creating security holes. Thus, SaaS users will start with the seeded default dictionary. Customizations made during the local prototype phase will need to be re-entered by the clinic admin.

## Price Snapshot Strategy
- **Resilience:** Changing a `price` in the dictionary will **not** break historical patient data or treatment plans.
- **Why:** `ToothEditorModal.tsx` natively extracts `work.price` and permanently saves it as `priceSnapshot` inside the JSON structure of `PlannedWorkRecord`. `TreatmentPlansRepository` also saves `stage.price` explicitly in Postgres. Historical data does not rely on realtime dictionary joins for prices.

## Soft Delete/Archive Strategy
- Items must use soft-disable (`is_active = false`). Hard deleting dictionary rows would cause foreign-key or ID-lookup failures in historical UI views (e.g., viewing an old plan with a deleted work).
- The `MedicalPage` already supports toggling `isActive` to disable items, while hiding them from new selections in `ToothEditorModal`.

## Implementation Plan
1. **DICT-SUPABASE-001A:** Create Supabase SQL migration for `clinical_dictionary_items` and RLS policies. Handled by Codex.
2. **DICT-SUPABASE-001B:** Implement `SupabaseClinicalDictionariesRepository` and update `useDictionaries` to route based on `backend` config.
3. **DICT-SUPABASE-001C:** Implement seed logic (Edge Function or Client-side bulk insert if empty).
4. **DICT-SUPABASE-001D:** Browser QA & Codex Validation (Verify local fallback, RLS policies, price updates).

## Tests Required
- `SupabaseClinicalDictionariesRepository.test.ts`: Mock testing CRUD operations.
- `useDictionaries.test.tsx`: Verify routing to `local` vs `supabase`.
- **Error Propagation:** Ensure Supabase read/write errors are not silently swallowed.
- **RLS Verification:** Must be tested manually or via edge function tests by Codex.

## Browser QA Plan
- Switch app to `local` mode -> Verify old localStorage logic functions correctly.
- Switch app to `supabase` mode -> Verify it reads from cloud.
- Edit a price in `MedicalPage` -> Verify it updates in DB.
- Create a new `TreatmentStage` with the updated work -> Verify new price is snapshotted.
- View an old `TreatmentStage` -> Verify historical price remains untouched.

## Risks and Blockers
- Requires direct database changes.
- Complex `text[]` to TypeScript array mapping requires careful `supabase-js` type casting.

## Final Verdict
The planning is complete. The architecture is sound and backwards-compatible with historical patient data. The next step is direct Supabase schema implementation.

---

## NOTE FOR NICK
This requires direct Supabase work and should be handed to Codex.

Jules/normal soldier must not directly work with Supabase cloud/database.

## Exact Recommended Next Task Prompt
```text
TASK ID: DICT-SUPABASE-001A
TITLE: Implement clinical dictionary Supabase schema and RLS policies
PHASE: Clinical dictionaries / SaaS foundation

GOAL:
Based on the RECON-CLINICAL-DICTIONARIES-SUPABASE-001 report, create the new SQL migration for `clinical_dictionary_items`.

REQUIREMENTS:
- Create `supabase/migrations/000X_clinical_dictionaries.sql`
- Table must be `clinical_dictionary_items` with fields matching Option B.
- Primary key must be `(tenant_id, id)`.
- Write RLS policies ensuring only `clinic_admin` and `clinic_owner` can INSERT/UPDATE/DELETE.
- Allow all tenant users to SELECT.
- NOTE: This task is explicitly assigned to Codex due to direct Supabase boundary changes.
```
