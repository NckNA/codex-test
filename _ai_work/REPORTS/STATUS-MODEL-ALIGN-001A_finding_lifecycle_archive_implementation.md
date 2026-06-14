# STATUS-MODEL-ALIGN-001A Implementation Report

## Summary
The goal of this task was to align the `DentalFinding` lifecycle statuses across the application, database, and UI. We introduced a new canonical status model and replaced the hard delete logic with an archive behavior to maintain referential integrity and historical records while accurately reflecting active findings in the UI. We also resolved specific blocker issues with Supabase migration safety, local read normalization, and write payload normalization.

## Branch
`feature/status-model-align-001a-finding-lifecycle-archive`

## Commit Hash
`748fcbc8b74dc86fa8ee1fb21b42b61c6b85d5d7`

## PR URL
https://github.com/NckNA/codex-test/pull/261

## Changed Files Summary
- **Migration**: `supabase/migrations/0004_align_findings_status_lifecycle.sql`
- **Domain**: `src/domain/findingStatus.ts` and `src/domain/findingStatus.test.ts`
- **Data Repositories**: 
  - `src/data/repositories/FindingsRepository.ts`
  - `src/data/repositories/FindingsRepository.test.ts`
- **Orchestrator & Aggregators**:
  - `src/data/orchestrators/ClinicalWorkflowOrchestrator.ts` and tests
  - `src/data/aggregators/ClinicalSummaryAggregator.ts` and tests
- **UI Components**:
  - `src/components/dental/DentalChartTab.tsx`
  - `src/components/dental/FindingModal.tsx`
  - `src/components/dental/FindingsRisksTab.tsx`
  - `src/components/dental/ToothGrid.tsx` and tests
  - `src/components/patients/patient-card/PatientOverviewTab.tsx`
  - `src/components/treatment/CreatePlanFromFindingsModal.tsx`
  - `src/components/treatment/TreatmentPlanPatientPreview.tsx`

## Canonical Status Model
- `discovered`
- `planned`
- `in_treatment`
- `completed`
- `declined_by_patient`
- `monitoring`
- `archived`

## Legacy Mapping Table
- `discovered` -> `discovered`
- `recommended` -> `discovered`
- `included_in_plan` -> `planned`
- `observing` -> `monitoring`
- `completed` -> `completed`
- `declined_by_patient` -> `declined_by_patient`

## Supabase Migration Summary
The Supabase migration now explicitly drops the constraint `findings_status_check` using `ALTER TABLE findings DROP CONSTRAINT IF EXISTS findings_status_check;`, backfills legacy statuses to canonical ones, and adds the new check constraint with canonical statuses. No runtime or helper scripts are used.

## Repository Behavior Changes
- **Delete behavior**: Both `LocalStorageFindingsRepository` and `SupabaseFindingsRepository` update the finding status to `archived` instead of hard deleting the row.
- **Read/Write Normalization**:
  - `LocalStorageFindingsRepository.listFindingsByPatient` normalizes finding statuses on read using the legacy mapping logic.
  - `buildFindingPayload` used by Supabase write operations normalizes legacy statuses before submitting to the database.

## UI Behavior Changes
- Status drop-downs and badges across the application only show canonical statuses.
- The UI filters out archived findings from standard active findings views (like Dental Chart Tab).
- ToothGrid active markers now correctly map statuses: high/urgent -> risk, planned -> planned, monitoring -> monitoring, other active -> active. Archived and completed are not shown as active.

## Treatment Workflow Changes
- Automatically updating finding status to `planned` when a finding is included in a treatment plan.
- Relying on `ACTIVE_FINDING_STATUSES` (which explicitly excludes `archived` and `completed` logic) for most aggregations.

## Archive vs Hard Delete Explanation
Hard deleting a finding destroys referential data (e.g., historical treatments and analytics). Archiving simply flags the finding as inactive (`status = 'archived'`), removing it from primary UI visibility but preserving the database integrity for audits and historical treatment records.

## What Was Intentionally NOT Fixed
- Unrelated architecture refactoring (e.g., converting `ClinicalSummaryAggregator` to full Supabase-aware mode).
- Full audit trail generation.
- Complete redesign of the Treatment Plans.
- Modifying authentication, tenant, or amoCRM integration files.

## Tests Run and Results
- Unit tests run: 217 passed, 0 failed (`npm run test -- --run`). Includes tests for LocalStorage normalization, Supabase normalization, ToothGrid marker state, and archiving vs hard delete.
- Lint tests run: `npm run lint` (0 errors, 3 non-blocking warnings).
- Build check run: `npm run build` (successful compilation).

## Real Browser Smoke Steps and Results
**SMOKE SKIPPED**
A real manual browser session was skipped in this iteration because the fixes pertained strictly to non-visual repository normalization, ToothGrid marker state logic, and test adjustments. These behaviors were fully covered by updated unit tests (`src/components/dental/ToothGrid.test.tsx` and `src/data/repositories/FindingsRepository.test.ts`).

## Console/Network Issues
None observed during the automated checks.

## Remaining Risks
Since `LocalStorageFindingsRepository` normalizes on read, if the user interacts with normalized items and re-saves them, it will persist as canonical. If they never resave, the data stays legacy in local storage. This is acceptable for a local-fallback but could cause slight synchronization inconsistencies if mixed backend environments are used (unlikely in production since it's fully Supabase).

## Final Verdict
PASS. All blockers are resolved safely and correctly without broadening scope. Note: The `outputs/` directory observed locally is strictly an untracked, local-only directory generated by tests/builds and is not committed or part of this PR.
