# RECON-TREATMENT-REAL-002: Refresh TreatmentPlans Supabase migration plan

## 1. Summary
This report re-evaluates the Supabase migration plan for `TreatmentPlansRepository` after the successful integration and browser testing of `FindingsRepository` and `DentalChartRepository`. It assesses readiness, dependencies, and boundaries for migrating treatment plans.

## 2. Scope
This is a RECON/report-only task. The focus is strictly on inspecting repository shapes, UI dependencies, Supabase schema fit, and ID generation strategies. No application code, migrations, or seeds were modified.

## 3. Files inspected
- `src/data/repositories/TreatmentPlansRepository.ts`
- `src/data/hooks/useTreatmentPlans.ts`
- `src/components/treatment/TreatmentPlansTab.tsx`
- `src/data/orchestrators/ClinicalWorkflowOrchestrator.ts`
- `src/data/hooks/useClinicalWorkflow.ts`
- `src/types/index.ts`
- `supabase/migrations/0001_initial_schema.sql`
- Previous RECON reports.

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
- Implemented in `ClinicalWorkflowOrchestrator` (`createTreatmentPlanFromFindings`).
- Currently maps `DentalFinding` into `TreatmentStage` and calls `treatmentPlansRepository.createTreatmentPlan`.
- Also updates the finding statuses to `included_in_plan`.
- **Conclusion**: The repository migration can be decoupled from the generation logic as long as the generated objects match the `TreatmentPlan` interface and valid UUIDs are used.

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
**READY for TREATMENT-REAL-001A repository-only implementation**
The schema fits, dependencies are migrated, and `finding_ids` are now UUID-safe.

## 18. Future TREATMENT-REAL-001A boundaries
**Allowed future implementation:**
- `SupabaseTreatmentPlansRepository` implementation.
- `createTreatmentPlansRepository` factory.
- Updating `useTreatmentPlans` to route by authMode/tenant.
- Manual plan list/create/update/delete.
- Stages mapping (injecting `order_index`).

**Forbidden future implementation:**
- Modifying automatic treatment plan generation in `ClinicalWorkflowOrchestrator`.
- Modifying `DentalChartRepository` or `FindingsRepository`.
- Documents/Billing/Appointment logic.

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
**NONE FOUND**. 
(The previous blocker regarding `finding_ids` was resolved by the Findings migration. The `order_index` schema requirement is a minor mapping detail, not a blocker. Automatic generation can be kept safely in the orchestrator).

## 22. What was NOT changed
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
- `npm run lint` (Result: PASS)
- `npm test` (Result: FAIL - `AuthContext.test.tsx` expected `dev` but received `supabase-active` due to local `.env.local` config).
- `npm run build` (Result: PASS)

## 24. Final verdict
**READY** for TREATMENT-REAL-001A repository-only implementation.
**NOT READY** for automatic treatment plan generation (defer to separate task).
**NOT READY** for documents/billing/appointment integration.

## 25. Recommended next task
Proceed to TREATMENT-REAL-001A: Implement `SupabaseTreatmentPlansRepository` behind explicit factory.
