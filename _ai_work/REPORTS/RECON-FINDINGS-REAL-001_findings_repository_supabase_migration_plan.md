# RECON-FINDINGS-REAL-001: FindingsRepository Supabase Migration Plan

## Summary
Reconnaissance performed to plan the migration of `FindingsRepository` from `localStorage` to Supabase Postgres. This report explicitly details the inspection of all required files, hooks, and components. The analysis confirms that Findings can be migrated safely right now without migrating `DentalChartRepository` first.

## Files Inspected & Findings
- **hooks using FindingsRepository**:
  - `src/data/hooks/usePatientFindings.ts`: Uses `LocalStorageFindingsRepository`. Exposes `findings`, `isLoading`, `addFinding`, `updateFinding`, `deleteFinding`.
  - `src/data/orchestrators/ClinicalWorkflowOrchestrator.ts`: Interacts with `FindingsRepository` to create findings from dental chart updates.
- **components/pages using findings**:
  - `src/components/dental/DentalChartTab.tsx`: Uses `usePatientFindings` to highlight teeth with findings on the visual chart.
  - `src/components/dental/FindingsRisksTab.tsx`: Uses `usePatientFindings` to list, edit, and delete findings.
  - `src/components/treatment/TreatmentPlansTab.tsx`: Uses `usePatientFindings` to select findings for new treatment plans.
- **src/types/index.ts finding types**: Contains `DentalFinding`, `FindingCategory`, `FindingSeverity`, `FindingStatus`. All map cleanly to DB structures.
- **src/utils/storage.ts finding methods**: `getFindings`, `addFinding`, `updateFinding`, `deleteFinding` serialize arrays to `localStorage`. `addFinding` generates UUIDs.
- **src/data/seed.ts demoDentalFindings**: Contains mock findings (`f1`, `f2`). These are not valid UUIDs.
- **DentalChartRepository and hooks/components**:
  - `src/data/repositories/DentalChartRepository.ts`: Uses `localStorage`.
  - `src/data/hooks/useDentalChart.ts`: Exposes chart data.
  - They do not have foreign key constraints to findings. Decoupled via `ClinicalWorkflowOrchestrator`.
- **ChiefComplaintRepository**: Inspected. Migrated to Supabase. Linkage to findings is only a boolean (`isChiefComplaintRelated`), no DB constraints block this.
- **PatientRepository**: Inspected. Migrated to Supabase. `patientId` will be valid UUIDs.
- **TreatmentPlansRepository**: Inspected. LocalStorage. Expects `findingIds`. Will store UUIDs correctly.
- **supabase/migrations/0001_initial_schema.sql**: `findings` table exists, `patient_id` is UUID. `tooth_number` is nullable integer. Check constraints perfectly match `src/types/index.ts` enums.
- **supabase/seed.sql**: NOT FOUND - no mock findings exist in Supabase seed data.
- **Previous reports**:
  - `CHIEF-REAL-001B`: Confirmed Chief Complaints migrated safely.
  - `PATIENT-REAL-001B`: Confirmed Patients migrated safely.
  - `RECON-TREATMENT-REAL-001`: Concluded `TreatmentPlansRepository` is blocked because it needs UUID findings.
  - `APPOINTMENT-REAL-001B`: Confirmed Appointments migrated safely.

## Current FindingsRepository shape
- **Interface**: `listFindingsByPatient`, `createFinding`, `updateFinding`, `deleteFinding`.
- **LocalStorage behavior**: Saves an array of `DentalFinding` objects serialized to JSON.
- **Patient scoped**: All methods require `patientId: string`.
- **ID generation**: Handled internally by the repository during `createFinding` via `crypto.randomUUID()`.
- **Sorting / Enums**: Handled by UI or default order. The `includeInTreatmentPlan` and `isChiefComplaintRelated` are booleans.

## Current frontend finding model
```typescript
export interface DentalFinding {
  id: string;
  patientId: string;
  toothNumber?: number;
  title: string;
  category: FindingCategory;
  severity: FindingSeverity;
  description: string;
  riskDescription?: string;
  recommendation?: string;
  isChiefComplaintRelated: boolean;
  includeInTreatmentPlan: boolean;
  status: FindingStatus;
  createdAt: string;
  updatedAt: string;
}
```

## Supabase schema fit
The `findings` table in Supabase fits the frontend model perfectly:
- `id`, `tenant_id`, `patient_id` are `uuid`.
- `tooth_number` is `integer` (nullable).
- `category`, `status`, and `severity` have Postgres `CHECK` constraints matching frontend enums.
- `is_chief_complaint_related` and `include_in_treatment_plan` map directly to booleans.

## Dependency analysis
- **PatientRepository**: UUIDs ready.
- **ChiefComplaintRepository**: Ready, no FK issues.
- **DentalChartRepository**: Still uses `localStorage`. `ClinicalWorkflowOrchestrator` decoupled the visual tooth state from the findings. No FK constraints exist.
- **TreatmentPlansRepository**: Blocked, but migrating findings to UUIDs unblocks it.

## Blockers
There are no major technical blockers. 
- The `seed.ts` mock IDs (`f1`, `f2`) will remain strictly in the `dev` fallback mode.
- RLS Policies restrict `DELETE` operations to `clinic_admin` and `clinic_owner`.

## Strategy comparison
**Option A: Migrate FindingsRepository first, keep DentalChartRepository local**
- *Pros*: Decouples the migration. Makes findings a clean source of UUIDs for the future Treatment Plans migration. Low risk.
- *Cons*: "Partial clinical migration" UX.

**Option B: Migrate DentalChartRepository before Findings**
- *Pros*: Solves the partial UX issue.
- *Cons*: Unnecessarily delays Findings migration.

**Option C: Migrate both simultaneously**
- *Pros*: Perfect UX.
- *Cons*: Violates the incremental safe-step methodology.

## Recommended strategy
**Option A: Migrate FindingsRepository first.**
This is the safest path to unblock Treatment Plans. 

## ID strategy
- Use `crypto.randomUUID()` internally in `createFinding`.
- Local mock IDs (`f1`, `f2`) isolated to `dev` fallback.

## Mapping design
- `toothNumber` <-> `tooth_number`
- `riskDescription` <-> `risk_description`
- `isChiefComplaintRelated` <-> `is_chief_complaint_related`
- `includeInTreatmentPlan` <-> `include_in_treatment_plan`
- `createdAt` <-> `created_at`
- `updatedAt` <-> `updated_at`

## Query design
- **`listFindingsByPatient`**: `.from('findings').select('*').eq('tenant_id', ...).eq('patient_id', patientId).order('created_at', { ascending: false })`
- **`createFinding`**: `insert()`
- **`updateFinding`**: `update()`
- **`deleteFinding`**: `delete()`

## Tests required
- Factory routing test (`supabase-active` vs `dev`).
- `listFindingsByPatient` mapping check.
- `createFinding` REST payload verification.
- Enums preservation check.
- Null `toothNumber` handling check.

## Browser QA plan
- Log in as mapped clinic user.
- Go to Patient Profile -> Зубная формула.
- Add a finding via clicking a tooth.
- Edit the finding.
- Delete the finding.
- Verify persistence in Supabase `findings` table.
- Verify dev fallback.

## Risks
- **Partial Clinical Migration Risk**: Until `DentalChartRepository` is migrated, users logging in on a new device will see their Supabase findings but will not see the visual colored teeth.
- **RLS Delete**: Normal doctors cannot delete findings in Supabase.

## Do NOT do yet
- Do NOT implement `SupabaseFindingsRepository`.
- Do NOT change `ClinicalWorkflowOrchestrator`.

## Final verdict
- **READY** for FINDINGS-REAL-001A
- **NOT READY** for DentalChart reconnaissance first (unnecessary blocker)
- **NOT READY** for TreatmentPlansRepository implementation (needs Findings first)

## Recommended next task
FINDINGS-REAL-001A: Implement SupabaseFindingsRepository behind explicit factory
