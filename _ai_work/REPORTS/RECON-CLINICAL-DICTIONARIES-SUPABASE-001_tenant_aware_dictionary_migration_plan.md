# RECON-CLINICAL-DICTIONARIES-SUPABASE-001: Tenant-aware dictionary migration plan

## Current State Analysis

### Data Shape
Clinical dictionaries are split into two core entities defined in `src/config/clinicalDictionaries.ts`:
1. **ClinicalDiagnosis**: 
   - Fields: `id`, `type` ('diagnosis'), `name`, `allowedPresenceStatuses` (array of `ToothPresenceStatus`), `allowedZones` (array of `ClinicalZone`), `isActive` (boolean, optional).
2. **ClinicalWork**: 
   - Fields: `id`, `type` ('work'), `name`, `price`, `workAccessType` ('base_available' | 'requires_diagnosis'), `allowedDiagnosisIds` (array of strings for valid diagnoses), `allowedPresenceStatuses`, `allowedZones`, `isActive` (boolean, optional).

Both inherit from a base item structure, making them structurally similar except for `price`, `workAccessType`, and `allowedDiagnosisIds` specific to works.

### LocalStorage Behavior
Currently, dictionaries are managed by `ClinicalDictionariesRepository.ts`:
- Uses synchronous `localStorage.getItem` for `codex_clinical_diagnoses` and `codex_clinical_works`.
- If missing from `localStorage`, it falls back to hardcoded `defaultDiagnoses` and `defaultClinicalWorks` from configuration.
- Saves overwrite the entire array in `localStorage`. 
- There is no tenant isolation because the persistence is purely local to the browser.

### Consumption & Usage
- **MedicalPage.tsx**: The primary management UI. Allows creating/editing/disabling diagnoses and works. Reads and writes via `useDictionaries` hook.
- **ToothEditorModal.tsx**: The clinical data entry UI. Reads dictionaries to populate available diagnoses and works based on the selected tooth's presence status (e.g., natural vs implant) and clinical zone (e.g., crown vs root).
- **Hooks**: `useDictionaries.tsx` provides the context and global state for these arrays.
- **Price Usage**: Used in `ToothEditorModal.tsx` when a work is selected; the `price` is copied into the `PlannedWorkRecord` as `priceSnapshot`.
- **Diagnosis-Work Links**: Works have `allowedDiagnosisIds`. When adding a work in `ToothEditorModal`, the UI filters available "treatment works" to only those compatible with the currently selected diagnoses.

---

## Supabase Schema Plan

### Current Schema Status
The current Supabase schema (`0001_initial_schema.sql`) **does not** support clinical dictionaries. It includes tables for patients, appointments, charts, findings, and treatment plans, but no dictionary configuration tables.

### Proposed Schema
We propose a single, unified table `clinical_dictionary_items` for both diagnoses and works, utilizing JSONB and arrays to handle varying metadata fields. This simplifies querying and avoids complex joins, while still providing robust typing on the frontend.

```sql
CREATE TABLE clinical_dictionary_items (
  id text NOT NULL, -- e.g., 'dx_caries_initial' or generated UUID
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

**Why single table over multiple normalized tables?**
Clinical dictionaries are relatively small (hundreds of items, not millions) and are fetched entirely upon app load. Splitting them into `clinical_diagnoses`, `clinical_works`, and a many-to-many `clinical_work_diagnoses` linking table would introduce unnecessary relational complexity, slowing down fetching without providing significant data integrity benefits, especially since `id` references in dictionaries are handled dynamically in the frontend logic.

### Tenant Isolation & RLS
- The primary key incorporates `tenant_id`.
- Standard RLS policies will apply:
  - `SELECT`: Only users belonging to the tenant can view the dictionary.
  - `INSERT/UPDATE/DELETE`: Allowed for users with clinic-level roles (e.g., `clinic_admin`, `clinic_owner`, `doctor`).

---

## Migration Strategy

### Seed / Defaults Strategy
To balance a robust SaaS foundation with clinic customization, we will use a **Full Tenant Copy** approach:
- Each clinic gets its own independent copy of the dictionaries in the database.
- **Trigger/Seed:** We can add a database trigger on `tenants` creation, or run an initialization edge-function that bulk-inserts the system `defaultDiagnoses` and `defaultClinicalWorks` into `clinical_dictionary_items` for that new `tenant_id`.
- This ensures that clinics have sensible defaults immediately but can safely edit prices, deactivate items, or change links without affecting other clinics or system-wide immutable data.

### Soft-Disable / Archive Strategy
- Items must use soft-disable (`is_active = false`) instead of hard deletion.
- Historical `DentalChart` states, `Findings`, and `TreatmentPlans` reference dictionary item `id`s. Hard deleting an item would break historical charts.
- The UI already supports this via the `isActive` flag, hiding inactive items from dropdowns in `ToothEditorModal` while keeping them visible and restorable in `MedicalPage`. 
- Supabase queries will pull all items, but the frontend will filter `isActive: false` for clinical selection.

### Price Snapshot Compatibility
- **Resilience:** Changing a `price` in the dictionary will **not** break historical patient data.
- **Why:** In `ToothEditorModal.tsx`, when a work is selected, the application extracts the dictionary `price` and saves it statically as `priceSnapshot: work.price` inside the `PlannedWorkRecord` of the tooth state. Similarly, `TreatmentPlansRepository` persists `stage.price` natively in the Postgres `treatment_stages` row.
- **Conclusion:** Modifying dictionary prices will only affect future selections, preserving the integrity of previously planned treatments and charts.
