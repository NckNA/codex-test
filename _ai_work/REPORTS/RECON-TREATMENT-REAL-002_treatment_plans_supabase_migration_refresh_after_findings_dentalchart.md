# RECON-TREATMENT-REAL-002: Refresh TreatmentPlans Supabase migration plan

## 1. Summary
This report re-evaluates the Supabase migration plan for `TreatmentPlansRepository` after the successful integration and browser testing of `FindingsRepository` and `DentalChartRepository`. It assesses readiness, dependencies, and boundaries for migrating treatment plans.

## 2. Scope
This is a RECON/report-only task. The focus is strictly on inspecting repository shapes, UI dependencies, Supabase schema fit, and ID generation strategies. No application code, migrations, or seeds were modified.

## 3. Files inspected
**Repositories:**
- `src/data/repositories/PatientRepository.ts`: Checked for UUID readiness. Migrated, ready, no blocker.
- `src/data/repositories/FindingsRepository.ts`: Checked for UUID findings safety. Migrated, ready, resolves previous blocker.
- `src/data/repositories/DentalChartRepository.ts`: Checked for tooth_states and charting dependencies. Migrated, ready, no direct dependencies block TreatmentPlans.
- `src/data/repositories/ChiefComplaintRepository.ts`: Checked for dependencies. Migrated, ready, no blocker.
- `src/data/repositories/DoctorRepository.ts`: Checked for dependencies. Migrated, ready, no blocker.
- `src/data/repositories/AppointmentRepository.ts`: Checked for dependencies. Migrated, ready, no blocker.
- `src/data/repositories/TreatmentPlansRepository.ts`: Core focus. Currently uses `localStorage`. Target for next migration.

**Hooks:**
- `src/data/hooks/useTreatmentPlans.ts`: Core focus. Hardcodes LocalStorage. Needs update for factory routing.
- `src/data/hooks/usePatientFindings.ts`: Checked for UUID data supply. Uses Supabase UUIDs in active mode. No blocker.
- `src/data/hooks/useDentalChart.ts`: Checked for state dependencies. No direct blocker for TreatmentPlans repo CRUD.
- `src/data/hooks/useClinicalWorkflow.ts`: Checked for generation logic. Uses orchestrator to generate plans. Must NOT be modified during repository migration.

**UI:**
- `src/components/treatment/TreatmentPlansTab.tsx`: Checked for how plans are rendered and auto-generated.
- `src/components/treatment/*`: Checked for sub-components (modals, previews).
- `patient card / clinical workflow related UI`: Checked for workflow dependencies.

**Supabase:**
- `supabase/migrations/0001_initial_schema.sql`: Checked `treatment_plans` and `treatment_stages` schema.
- `supabase/seed.sql`: Checked initial seed format constraints.

**Previous reports:**
- `RECON-TREATMENT-REAL-001`: Provided base context and identified the `finding_ids` blocker.
- `RECON-FINDINGS-REAL-001`, `FINDINGS-REAL-001A`, `FINDINGS-REAL-001B`: Confirmed that findings are now UUID-safe, removing the blocker.
- `RECON-DENTALCHART-REAL-001`, `DENTALCHART-REAL-001A`, `DENTALCHART-REAL-001B`: Confirmed chart migration. Does not block TreatmentPlans.
- `PATIENT-REAL-001B`, `CHIEF-REAL-001B`, `APPOINTMENT-REAL-001B`, `DOCTOR-REAL-001C`: Verified prior environment stability.

## 4. Previous RECON-TREATMENT-REAL-001 findings
The previous RECON identified a major blocker: `TreatmentStages` optionally references `finding_ids`. Because `FindingsRepository` was still using local string IDs (`'f1'`, `'f2'`), migrating `TreatmentPlansRepository` first would have caused PostgreSQL type errors when attempting to insert string IDs into a `uuid[]` column.

## 5. What changed after Findings migration
- `FindingsRepository` is now Supabase-backed (behind a factory).
- Mock string IDs have been removed from the database flow; findings now use real UUIDs generated natively by Supabase or `crypto.randomUUID()`.
- **Blocker resolved**: `finding_ids` can now safely be referenced in `treatment_stages.finding_ids` UUID arrays without crashing, as long as the active mode is `supabase-active`.

## 6. What changed after DentalChart migration
- `DentalChartRepository` is now Supabase-backed.
- The `ClinicalWorkflowOrchestrator` safely applies tooth status changes to both `dental_charts` and `findings` in Supabase.
- Tooth generation processes now create UUID-backed findings instead of local mock prototypes.

## 7. Current TreatmentPlansRepository shape
- **Methods**: `listTreatmentPlansByPatient`, `createTreatmentPlan`, `updateTreatmentPlan`, `deleteTreatmentPlan`.
- **Read/Write**: Full `TreatmentPlan` object including nested `TreatmentStage` array.
- **Patient-scoped**: Yes, all methods require `patientId`.
- **Backend**: Hardcoded to `LocalStorageTreatmentPlansRepository`.
- **Local IDs**: Generates string IDs like `plan_${timestamp}` and `stage_${timestamp}_...`.
- **References**: References `findingIds` directly in stages. No direct dependencies on doctors, appointments, or billing inside the repository level.
- **Generation**: Only stores plans. Generation happens in `ClinicalWorkflowOrchestrator`.

## 8. Current frontend treatment plan model
- **TreatmentPlan**: `id`, `patientId`, `title`, `status`, `stages` (array of `TreatmentStage`), `totalPrice`, `createdAt`, `updatedAt`.
- **TreatmentStage**: `id`, `title`, `teeth`, `description`, `price`, `status`, `findingIds`, `source`.
- **ID formats**: `string` (currently local prototypes like `plan_123`, must become `uuid`).
- **Teeth**: `number[]` representing `toothNumber`.
- **Status**: Enums (`TreatmentPlanStatus`, `TreatmentStageStatus`).

## 9. Supabase schema fit
- **Tables**: `treatment_plans` and `treatment_stages` exist.
- **FK constraints**: `patient_id` and `tenant_id` are strictly enforced with `ON DELETE CASCADE`.
- **RLS**: Row Level Security is fully enabled and checks `tenant_id`.
- **`finding_ids`**: Uses `uuid[]`.
- **Mismatches**: `treatment_stages` requires an `order_index` (`integer NOT NULL`) which is missing from the frontend model. The backend integration will need to inject this during the `mapToRow` phase based on array index.

## 10. UI dependency analysis
- **TreatmentPlansTab**: Fetches data via `useTreatmentPlans`. Uses `useClinicalWorkflow` to generate plans from findings.
- **Modals**: `TreatmentPlanModal` handles manual CRUD. `CreatePlanFromFindingsModal` handles auto-generation selection.
- **Manual vs Auto**: Both exist. Manual editing operates on the plan object and saves via `useTreatmentPlans`.

## 11. Findings dependency analysis
- With `FindingsRepository` migrated, findings retrieved in `supabase-active` mode have strict UUIDs.
- `ClinicalWorkflowOrchestrator` safely generates `TreatmentPlan` prototypes with UUID `findingIds`.
- The risk of mixing local string IDs with Supabase UUID fields is effectively zero *if* `createTreatmentPlansRepository` enforces the same `authMode` routing as Findings.

## 12. DentalChart dependency analysis
- `TreatmentPlansRepository` does not interact with `DentalChartRepository` or `tooth_states` IDs. It only records raw `toothNumber` arrays in stages.
- The limitations of DENTALCHART-REAL-001B (untested tooth reset, local fallback checks) do not block Treatment Plans repository migration because there is no direct schema FK to `tooth_states` or `dental_charts`.

## 13. Automatic generation dependency analysis
- TREATMENT-REAL-001A may implement repository-only manual CRUD.
- It must NOT modify ClinicalWorkflowOrchestrator generation logic.
- It must NOT implement automatic treatment plan generation.
- It must NOT update finding statuses as part of repository migration unless existing orchestrator already does this through existing API.
- Automatic generation requires separate RECON/REAL task after repository migration and browser QA.

## 14. ID strategy
- `plan.id` and `stage.id` must use `crypto.randomUUID()` in the UI or let the repository override local `plan_${time}` IDs with UUIDs before sending to Supabase.
- `finding_ids` must remain as they are (now UUIDs from the Findings migration).
- `patient_id` is an existing UUID.
- No local IDs must be sent to Supabase. The repository `mapToRow` layer should discard local IDs and replace them with UUIDs for new records, similar to how Findings was implemented.

## 15. Tenant/RLS/FK risk analysis
- `tenant_id` must be injected into all `treatment_plans` and `treatment_stages` payloads.
- Queries must filter by `tenant_id` (handled automatically by RLS, but explicitly in `eq('tenant_id')` for safety).
- Nested inserts: `treatment_plans` must be inserted before `treatment_stages` due to FK constraint.

## 16. Migration strategy options
- **Option A**: Implement `TreatmentPlansRepository` Supabase migration now, repository-only, manual plan CRUD only.
- **Option B**: Implement `TreatmentPlansRepository` but keep automatic generation and advanced workflow local/disabled.
- **Option C**: Do another schema/report clarification first if blockers remain.
- **Option D**: Split into TREATMENT-REAL-001A (repository + hook/factory), TREATMENT-REAL-001B (real browser QA), TREATMENT-GENERATION-RECON-001 (auto generation).

**Option D** is the safest. It isolates repository-level CRUD from orchestrator-level generation logic, allowing us to stabilize the repo first.

## 17. Recommended strategy
READY for TREATMENT-REAL-001A repository-only implementation WITH STRICT EXCLUSIONS:
- no automatic generation changes;
- no documents;
- no billing;
- no appointment integration;
- no dental chart mutation;
- no findings mutation except preserving existing orchestrator behavior;
- only manual list/create/update/delete for treatment plans and stages.

## 18. Future TREATMENT-REAL-001A boundaries
Add explicit future implementation requirements:
- SupabaseTreatmentPlansRepository;
- createTreatmentPlansRepository factory;
- useTreatmentPlans routing by authMode + activeTenant + isSupabaseConfigured;
- localStorage fallback;
- no-tenant safe local fallback or blocked behavior;
- tenant_id + patient_id filters everywhere;
- errors throw;
- local IDs are replaced/rejected before Supabase;
- stages saved with tenant_id + treatment_plan_id;
- order_index injected from stage array index;
- finding_ids validated as UUIDs or omitted/rejected if unsafe.

## 19. Tests required
- factory routing (`supabase-active` vs `dev`).
- `listTreatmentPlansByPatient` mapping stages.
- `createTreatmentPlan` with nested stages insert.
- `updateTreatmentPlan` (delete old stages, insert new).
- `deleteTreatmentPlan` (verify cascade).
- UUID safety (intercept local IDs).
- Enums map correctly.

## 20. Browser QA plan
- Open Treatment Plans tab in `supabase-active` mode.
- Create manual plan with manual stages.
- Verify persistence on refresh.
- Edit plan, edit stages.
- Delete plan.
- Check Supabase `treatment_plans` and `treatment_stages` network requests.

## 21. Blockers

**Repository-only blockers:**
- NONE FOUND. With `FindingsRepository` migrated and generating valid UUIDs, repository-only manual CRUD is unblocked.

**Repository-only risks/constraints:**
- `treatment_stages.order_index` must be injected by repository mapping;
- plan/stage local IDs must never be sent to Supabase UUID fields;
- stage save strategy must be defined: delete+insert or upsert if schema supports it;
- `finding_ids` must only be passed when UUID-safe;
- no-tenant must not call Supabase;
- local/dev fallback must remain local;
- nested plan + stages save has transaction/partial-save risk if using Supabase REST without transaction.

**Generation blockers:**
- automatic generation is NOT READY for implementation changes in TREATMENT-REAL-001A;
- generation must remain out of scope;
- repository-only migration may accept already-formed `TreatmentPlan` objects only.

**Documents/billing/appointment blockers:**
- NOT READY and out of scope.

## 22. What was NOT changed
Must explicitly state:
- no src/* files changed;
- TreatmentPlansRepository was not implemented;
- automatic treatment plan generation was not implemented;
- DentalChartRepository was not changed;
- FindingsRepository was not changed;
- PatientRepository was not changed;
- supabase/migrations were not changed;
- supabase/seed.sql was not changed;
- package.json/package-lock.json were not changed;
- no .env files were committed.

## 23. Commands run

**Local commands:**
- `npm run lint`: PASS
- `npm test`: FAIL due local `.env.local` AuthContext mode mismatch
- `npm run build`: PASS

**GitHub CI:**
- CI validate: PASS
- ESLint: PASS
- tests: PASS
- build: PASS

State clearly:
- `.env.local` was local only;
- `.env.local` was not committed;
- the local test failure is environment-specific;
- CI confirms clean test/build state on the PR.

## 24. Final verdict
**READY** for TREATMENT-REAL-001A repository-only implementation WITH STRICT EXCLUSIONS.
**NOT READY** for automatic treatment plan generation.
**NOT READY** for documents/billing/appointment integration.

## 25. Recommended next task
Proceed to TREATMENT-REAL-001A: Implement `SupabaseTreatmentPlansRepository` behind explicit factory.
