# RECON-TREATMENT-REAL-001: TreatmentPlansRepository Supabase Migration Plan

## Summary
Reconnaissance performed to plan the migration of `TreatmentPlansRepository` from `localStorage` to Supabase Postgres. This report outlines the current data models, dependencies, blockers, and provides a recommended migration strategy.

## Files inspected
- `src/types/index.ts`
- `src/utils/storage.ts`
- `src/data/seed.ts`
- `src/data/repositories/TreatmentPlansRepository.ts`
- `src/data/repositories/FindingsRepository.ts`
- `supabase/migrations/0001_initial_schema.sql`

## Current TreatmentPlansRepository shape
- **Interface**: `listTreatmentPlansByPatient`, `createTreatmentPlan`, `updateTreatmentPlan`, `deleteTreatmentPlan`.
- **LocalStorage behavior**: The entire `TreatmentPlan` object, including nested `stages`, is serialized to JSON and stored under a single key.
- **Embedded stages**: `stages: TreatmentStage[]` is embedded natively inside the `TreatmentPlan` object.
- **Findings reference**: `TreatmentStage` has an optional `findingIds: string[]` array.
- **Patient scoped**: All CRUD methods accept `patientId: string`.
- **Sorting / Status / Price**: Handled primarily by UI logic before saving to the repo.
- **ID generation**: Handled externally, usually via `crypto.randomUUID()` in the UI.

## Current frontend treatment model
- **TreatmentPlan**:
  - `id: string`
  - `patientId: string`
  - `title: string`
  - `status: TreatmentPlanStatus`
  - `stages: TreatmentStage[]`
  - `totalPrice: number`
  - `createdAt: string`
  - `updatedAt: string`
- **TreatmentStage**:
  - `id: string`
  - `title: string`
  - `teeth: number[]`
  - `description: string`
  - `price: number`
  - `status: TreatmentStageStatus`
  - `findingIds?: string[]`
  - `source?: TreatmentPlanSource`

## Supabase schema fit
The Supabase schema splits the model into two relational tables: `treatment_plans` and `treatment_stages`.
- **`treatment_plans`**: `id` (uuid), `tenant_id` (uuid), `patient_id` (uuid), `title`, `status`, `total_price`, `created_at`, `updated_at`. Fits frontend `TreatmentPlan` perfectly.
- **`treatment_stages`**: `id` (uuid), `tenant_id`, `treatment_plan_id` (uuid FK), `title`, `teeth` (integer[]), `description`, `price`, `status`, `finding_ids` (uuid[]), `source`, `order_index`, `created_at`, `updated_at`.
  - **Mismatch 1**: `order_index` is required in DB (`NOT NULL`) but not present in frontend model.
  - **Mismatch 2**: `finding_ids` is strictly `uuid[]` in DB, but frontend currently uses string IDs like `'f1'`, `'f2'` from `seed.ts` mock data.

## Dependency analysis
- **PatientRepository**: Migrated (UUIDs ready).
- **AppointmentRepository**: Migrated (UUIDs ready).
- **FindingsRepository**: Still uses `localStorage`. Its `seed.ts` mock data uses non-UUID string IDs (`'f1'`, `'f2'`, `'f3'`).
- **DentalChartRepository**: Still uses `localStorage`.
- **Link Risk**: If we migrate `TreatmentPlansRepository` before `FindingsRepository`, any treatment stage generated from a mock finding (`finding_ids: ['f1']`) will crash when Supabase Postgres rejects `'f1'` as an invalid UUID for the `uuid[]` array column.

## Blockers
1. **`finding_ids` UUID constraint**: The `treatment_stages.finding_ids` column expects `uuid[]`. Currently, `FindingsRepository` mock data uses local string IDs. Submitting these to Supabase will cause a database type error.
2. **Missing `order_index`**: The UI does not explicitly provide `orderIndex` for stages, but the DB requires it (`integer NOT NULL`).
3. **Transaction requirement**: Supabase REST API does not support inserting a plan and its stages in a single transactional request without an RPC (Stored Procedure). We need to handle this via sequential inserts and be aware of partial failure states.

## Strategy comparison
**Option A: Migrate TreatmentPlansRepository first, ignore/nullify finding_ids**
- *Pros*: Can be done immediately without waiting for other repositories.
- *Cons*: Breaks the link between findings and treatment plans in the UI when using Supabase mode.

**Option B: Migrate FindingsRepository and DentalChartRepository first**
- *Pros*: Safest approach. Ensures that all findings have valid UUIDs before they are linked to `TreatmentStages`. Matches natural clinical workflow (chart -> findings -> plan).
- *Cons*: Delays `TreatmentPlansRepository` migration.

**Option C: Migrate TreatmentPlans, but manually convert mock findings to UUIDs**
- *Pros*: Keeps `TreatmentPlans` unblocked.
- *Cons*: Requires modifying `seed.ts` and potentially breaking tests or logic that relies on `f1`/`f2` string IDs. Still risks inconsistencies if `FindingsRepository` isn't fully migrated.

## Recommended strategy
**Option B: Migrate Findings/DentalChart first.**
This is the only safe path that avoids data corruption or database errors. The `finding_ids` array must contain valid UUIDs. It is better to migrate the source of the data (`DentalFindings`) before migrating the consumer (`TreatmentStages`).

## ID strategy
- Use `crypto.randomUUID()` for all new plans and stages in the UI.
- No need to handle legacy local IDs (`f1`) for findings if we execute **Option B**, as all findings will be UUIDs by the time Treatment Plans migrate.

## Mapping design
- `TreatmentPlan` -> `treatment_plans`:
  - `totalPrice` -> `total_price`
  - `createdAt` / `updatedAt` -> `created_at` / `updated_at`
- `TreatmentStage` -> `treatment_stages`:
  - `findingIds` -> `finding_ids`
  - `orderIndex` -> `order_index` (Repository must automatically inject `index + 1` during `mapToRow` loop).

## Query design
- **`listTreatmentPlansByPatient`**: `select('*, treatment_stages(*)')`.
- **`createTreatmentPlan`**: Insert plan -> Insert stages using `Promise.all` sequentially.
- **`updateTreatmentPlan`**: Update plan -> Delete existing `treatment_stages` -> Insert new `treatment_stages` (easiest way to handle array of embedded stages without complex diffing logic).
- **`deleteTreatmentPlan`**: `delete()` on `treatment_plans` will safely cascade to `treatment_stages` due to Postgres `ON DELETE CASCADE`.

## Tests required
- Factory routing (`supabase-active` vs `dev`).
- `listTreatmentPlansByPatient` mapping nested `treatment_stages` back to `stages` array.
- `createTreatmentPlan` REST sequence success.
- `updateTreatmentPlan` diffing/replacement of stages.
- Deletion cascade behavior.

## Browser QA plan
- Log in as mapped clinic user.
- Go to Patient Profile -> Treatment Plans.
- Create a manual plan, add stages, save.
- Verify persistence across reload.
- (Will wait for findings migration to test "Create from finding").

## Risks
- **Partial Inserts**: Since `TreatmentPlan` and `TreatmentStages` are separate inserts via REST, a network failure could leave an orphaned plan with missing stages.
- **Order Index**: Must artificially generate `order_index` on save.

## Do NOT do yet
- Do NOT implement `SupabaseTreatmentPlansRepository`.
- Do NOT modify `seed.ts`.

## Final verdict
- **NOT READY** for TREATMENT-REAL-001A
- **READY** for Findings/Dental reconnaissance first
- **NOT READY** for DentalChartRepository migration unless separately justified

## Recommended next task
RECON-FINDINGS-REAL-001: Plan FindingsRepository Supabase migration
