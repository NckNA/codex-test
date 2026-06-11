# PROJECT-AUDIT-BACKFILL-004: Findings, DentalChart, TreatmentPlan reconciliation

## Status

Report-only reconciliation.

This report reconciles the historical reports for the clinical repositories and dental chart work with the current `main` branch.

Scope:

- `FindingsRepository`
- `DentalChartRepository`
- `TreatmentPlansRepository`
- `ClinicalWorkflowOrchestrator`
- dental chart editor fields
- dental chart / finding / treatment plan linkage
- recent DentalChart PR chain #200-#212
- closed-not-merged PR #213 status marker attempt

Out of scope:

- new implementation
- UI redesign
- new migrations
- changing repository behavior
- applying live database migrations
- browser smoke testing
- treatment plan document generation
- dictionary admin
- billing
- amoCRM

## Why this report exists

The earlier project map used to say that TreatmentPlans were not ready because Findings and DentalChart were not yet migrated or reconciled.

That statement was correct at the time, but it is no longer safe as a current routing rule.

Since then, the project has added:

- Supabase-aware Findings repository.
- Supabase-aware DentalChart repository.
- Supabase-aware TreatmentPlans repository.
- Dental chart editor compatibility fields.
- Dental chart editor UI and dictionary-driven selections.
- Structured links from tooth editor selections to findings.
- Adult and child dental chart modes.
- Zone highlights on the tooth grid.

The goal of this report is to label old reports precisely instead of letting future tasks use stale blockers or stale readiness claims.

## Status labels

- `VALID`: still accurate and safe to use.
- `PARTIALLY VALID`: still useful, but only with updated context.
- `SUPERSEDED`: replaced by later implementation or QA.
- `STALE`: historical only; do not use as current architecture.
- `DANGEROUS IF USED`: may cause a wrong task or unsafe implementation if treated as current truth.

---

# 1. Current branch baseline

Baseline for this report:

- previous checkpoint: PR #217, `PROJECT-AUDIT-BACKFILL-003`
- base merge commit: `d4fbf18ccf43972539d9cd2f7c0f620f1869ae27`
- current task branch: `audit-clinical-repos-001`

This report assumes these earlier backfill checkpoints are already part of `main`:

- `PROJECT-AUDIT-BACKFILL-001`: foundation report reconciliation
- `PROJECT-AUDIT-BACKFILL-002`: auth / tenant / Supabase foundation reconciliation
- `PROJECT-AUDIT-BACKFILL-003`: Patient / ChiefComplaint / Doctor / Appointment repository reconciliation

---

# 2. Reports reconciled

## 2.1 Findings reports

- `_ai_work/REPORTS/RECON-FINDINGS-REAL-001_findings_repository_supabase_migration_plan.md`
- `_ai_work/REPORTS/FINDINGS-REAL-001A_supabase_findings_repository_implementation.md`
- `_ai_work/REPORTS/FINDINGS-REAL-001B_real_browser_qa_supabase_findings.md`

## 2.2 DentalChart reports

- `_ai_work/REPORTS/RECON-DENTALCHART-REAL-001_dental_chart_repository_supabase_migration_plan.md`
- `_ai_work/REPORTS/DENTALCHART-REAL-001A_supabase_dental_chart_repository_implementation.md`
- `_ai_work/REPORTS/DENTALCHART-REAL-001B_real_browser_qa_supabase_dental_chart.md`
- `_ai_work/REPORTS/DENTALCHART-PERSISTENCE-QA-001_report.md`
- `_ai_work/REPORTS/DENTALCHART-BROWSER-QA-001_pending_browser_qa_report.md`
- `_ai_work/REPORTS/DENTALCHART-BACKFILL-RECON-001_report.md`

## 2.3 TreatmentPlan reports

- `_ai_work/REPORTS/RECON-TREATMENT-REAL-001_treatment_plans_repository_supabase_migration_plan.md`
- `_ai_work/REPORTS/RECON-TREATMENT-REAL-002_treatment_plans_supabase_migration_refresh_after_findings_dentalchart.md`
- `_ai_work/REPORTS/TREATMENT-REAL-001A_supabase_treatment_plans_repository_implementation.md`
- `_ai_work/REPORTS/TREATMENT-GENERATION-RECON-001_automatic_treatment_plan_generation_recon.md`
- `_ai_work/REPORTS/TREATMENT-GENERATION-REAL-001A_safe_supabase_treatment_plan_generation.md`
- `_ai_work/REPORTS/TREATMENT-GENERATION-REAL-001B_real_browser_qa_supabase_generation.md`
- `_ai_work/REPORTS/TREATMENT-DELETE-RECON-001_supabase_safe_treatment_plan_deletion_recon.md`
- `_ai_work/REPORTS/TREATMENT-DELETE-REAL-001A_supabase_safe_treatment_plan_deletion_implementation.md`

## 2.4 Recent DentalChart PR chain used as context

- #200 `DENTALCHART-COMPAT-001`
- #201 `DENTALCHART-DICTIONARIES-001`
- #202 `DENTALCHART-EDITOR-PROTOTYPE-001`
- #203 `DENTALCHART-PERSISTENCE-001`
- #204 `DENTALCHART-PERSISTENCE-QA-001`
- #205 `DENTALCHART-BROWSER-QA-001`
- #206 `DENTALCHART-TOOTH-VISUAL-REFINE-001`
- #207 `DENTALCHART-SUPABASE-FALLBACK-001`
- #208 `DENTALCHART-TOOTHGRID-UX-001`
- #209 `DENTALCHART-EDITOR-UX-POLISH-001`
- #210 `DENTALCHART-FINDING-LINK-001`
- #211 `DENTALCHART-ZONE-HIGHLIGHT-001`
- #212 `DENTALCHART-DENTITION-MODE-001`
- #213 `UI marker update` — closed, not merged

---

# 3. Current code inspection summary

## 3.1 FindingsRepository

Current file:

- `src/data/repositories/FindingsRepository.ts`

Current status:

- Has `LocalStorageFindingsRepository`.
- Has `SupabaseFindingsRepository`.
- Has `createFindingsRepository({ backend, tenantId })` factory.
- Supabase list filters by `tenant_id` and `patient_id`.
- Supabase create generates `crypto.randomUUID()` for new findings.
- Supabase update and delete filter by `tenant_id`, `patient_id`, and finding `id`.
- Structured dental chart link fields are now supported:
  - `clinicalZone`
  - `diagnosisIds`
  - `plannedWorkIds`
  - `plannedWorkRecordIds`
- A fallback exists for live schemas that do not yet expose the new link fields.

Current hook:

- `src/data/hooks/usePatientFindings.ts`

Current hook routing:

```ts
const backend = authMode === 'supabase-active' && activeTenant?.tenantId && isSupabaseConfigured
  ? 'supabase'
  : 'local';
```

Current verdict:

- FindingsRepository is no longer localStorage-only.
- The old blocker that findings have only `f1`, `f2`, `f3` style IDs is superseded for Supabase-active mode.
- The old local IDs may still exist in dev/localStorage seed flow, so any Supabase task must still verify backend mode before using IDs.

Important limitation:

- Finding link columns from migration `0003` may not exist in the live database until applied.
- The repository fallback protects create/update from missing link columns, but the structured link fields will not persist in old live schema.

## 3.2 DentalChartRepository

Current file:

- `src/data/repositories/DentalChartRepository.ts`

Current status:

- Has `LocalStorageDentalChartRepository`.
- Has `SupabaseDentalChartRepository`.
- Has `createDentalChartRepository({ backend, tenantId })` factory.
- Reads `dental_charts` by `tenant_id` and `patient_id`.
- Reads `tooth_states` by `tenant_id` and `dental_chart_id`.
- Creates a default chart if no Supabase chart row exists yet.
- Merges DB teeth with a default chart.
- Writes `dental_charts` and bulk upserts `tooth_states`.
- Supports editor fields:
  - `presenceStatus`
  - `visualState`
  - `visualStateOverride`
  - `diagnoses`
  - `plannedWorks`
  - `plannedWorkRecords`
  - `completedWorks`
- Has legacy save fallback when editor columns are missing.

Current factory verdict:

- DentalChartRepository is Supabase-aware and no longer localStorage-only.
- localStorage remains the dev/fallback layer.
- The old statement that DentalChartRepository is not migrated is superseded.

Important limitation:

- Supabase save is not a single database transaction across `dental_charts` and all `tooth_states` when used through the frontend REST path.
- A partial network/API failure can save a chart row but fail tooth rows, or save legacy tooth rows without editor fields if migration `0002` is missing.
- Live Supabase migration state is separate from repository code state.

## 3.3 TreatmentPlansRepository

Current file:

- `src/data/repositories/TreatmentPlansRepository.ts`

Current status:

- Has `LocalStorageTreatmentPlansRepository`.
- Has `SupabaseTreatmentPlansRepository`.
- Has `createTreatmentPlansRepository({ backend, tenantId })` factory.
- Validates `patientId` as UUID before Supabase requests.
- Replaces local plan IDs with UUIDs on create when needed.
- Filters `findingIds` to UUIDs before writing to `treatment_stages.finding_ids`.
- Adds `tenant_id` to `treatment_plans` and `treatment_stages` payloads.
- Handles nested stages with `order_index` from array index.
- Update path verifies existing stage ownership under the exact `treatment_plan_id` before updating.
- Delete path filters by `tenant_id`, `patient_id`, and plan `id`.

Current hook:

- `src/data/hooks/useTreatmentPlans.ts`

Current hook routing:

```ts
if (authMode === 'supabase-active' && isSupabaseConfigured && tenantId) {
  return { backend: 'supabase', tenantId };
}
return { backend: 'local' };
```

Current verdict:

- TreatmentPlansRepository is no longer blocked by unmigrated Findings.
- The old `finding_ids uuid[]` blocker is superseded by Findings migration and UUID filtering.
- TreatmentPlansRepository is Supabase-aware and must be treated as implemented, not merely planned.

Important limitation:

- `useTreatmentPlans` currently exposes list/create/update/refetch, not a full delete facade.
- Delete exists in repository and workflow cleanup, but future UI tasks must verify which route they are using.
- Stage deletion has known constraints under RLS and earlier implementation notes. Do not assume removed UI stages are always physically deleted from Supabase.

## 3.4 useClinicalWorkflow / ClinicalWorkflowOrchestrator

Current files:

- `src/data/hooks/useClinicalWorkflow.ts`
- `src/data/orchestrators/ClinicalWorkflowOrchestrator.ts`

Current status:

`useClinicalWorkflow` builds a coordinated backend using the same backend decision for:

- DentalChartRepository
- FindingsRepository
- TreatmentPlansRepository

The orchestrator coordinates:

- tooth status change
- chart save
- optional finding create/update
- treatment plan generation from selected findings
- treatment plan deletion cleanup

Current positive safeguards:

- repository dependencies are injected.
- backend mode is explicit.
- Supabase generation validates patient UUID.
- Supabase generation validates selected finding UUIDs.
- Supabase generation checks finding ownership against the patient.
- treatment generation saves the plan before mutating finding statuses.
- treatment deletion validates patient and plan IDs in Supabase mode.

Current risk:

- This orchestrator is the main transformer box for clinical workflow.
- It is acceptable as a coordinator, but must not become a God-service containing every clinical rule.
- There is no single transaction across chart save, finding write, plan write, and finding status updates.
- If one later step fails, earlier steps may already be committed.

---

# 4. Current type model summary

Relevant current types:

- `ToothNumber` now includes adult and child FDI numbers.
- `ToothPresenceStatus` includes `deciduous`.
- `ClinicalZone` exists.
- `PlannedWorkRecord` exists.
- `ToothRecord` now has editor fields for diagnoses, planned works, planned records, and completed works.
- `DentalFinding` now has structured link fields back to dental chart editor selections.
- `TreatmentStage` references raw tooth numbers and optional `findingIds`.
- `TreatmentPlanSource` includes `from_finding`.

Interpretation:

- The clinical model is no longer the old simple tooth condition model.
- Future tasks must not treat dental chart as only `toothNumber + condition`.
- Future tasks must not treat findings as only free-text problems.
- Future tasks must not generate treatment plans from local/mock findings in Supabase mode.

---

# 5. Migration status

## 5.1 Migration `0002`

File:

- `supabase/migrations/0002_add_dental_chart_editor_fields_to_tooth_states.sql`

Purpose:

- Adds editor fields to `tooth_states`:
  - `presence_status`
  - `visual_state`
  - `visual_state_override`
  - `diagnoses`
  - `planned_works`
  - `planned_work_records`
  - `completed_works`
- Adds constraints for presence and visual state fields.
- Adds a JSON array check for `planned_work_records`.

Current report status:

- Present in repo.
- Required for full Supabase persistence of the new dental chart editor data.
- Live database application: not confirmed by this report.

Risk if missing live:

- DentalChartRepository fallback can retry legacy tooth save.
- Legacy tooth save can preserve basic tooth state.
- New editor data may not persist in Supabase until migration is applied.

## 5.2 Migration `0003`

File:

- `supabase/migrations/0003_add_dental_chart_links_to_findings.sql`

Purpose:

- Adds structured dental chart link fields to `findings`:
  - `clinical_zone`
  - `diagnosis_ids`
  - `planned_work_ids`
  - `planned_work_record_ids`
- Adds a clinical zone check constraint.
- Adds index on tenant/patient/tooth/zone.

Current report status:

- Present in repo.
- Required for full persistence of structured tooth-editor-to-finding links.
- Live database application: not confirmed by this report.

Risk if missing live:

- FindingsRepository fallback can save legacy finding fields.
- Structured zone/diagnosis/work links may not persist in Supabase until migration is applied.

---

# 6. Historical report reconciliation

## 6.1 `RECON-FINDINGS-REAL-001`

Old key claim:

- Findings can be migrated safely.
- Do not implement `SupabaseFindingsRepository` yet.
- TreatmentPlans are not ready until Findings are migrated.

Current status:

- `PARTIALLY VALID` as dependency analysis.
- `SUPERSEDED` as implementation instruction.

New label:

- Use this report to understand why Findings had to migrate before TreatmentPlans.
- Do not use it to claim Findings are still localStorage-only or not implemented.

## 6.2 `FINDINGS-REAL-001A`

Old key claim:

- Supabase Findings repository implementation completed.

Current status:

- `VALID`, but extended by later `DENTALCHART-FINDING-LINK-001`.

New label:

- Use as baseline for Findings repository migration.
- Add the #210 structured link extension when planning future tasks.

## 6.3 `FINDINGS-REAL-001B`

Old key claim:

- Real browser QA for Supabase findings was performed.

Current status:

- `VALID` for the tested findings behavior at that time.
- `PARTIALLY VALID` for current structured finding links because migration `0003` came later.

New label:

- Use as evidence for base findings CRUD.
- Do not treat it as proof that the new #210 structured link fields are live-verified in Supabase.

## 6.4 `RECON-DENTALCHART-REAL-001`

Old key claim:

- DentalChartRepository is ready for Supabase migration.
- Tooth states can be migrated independently.
- TreatmentPlans do not block DentalChart.

Current status:

- `PARTIALLY VALID`.
- `SUPERSEDED` for claims that the repository is still localStorage-only.

New label:

- Use for the original DentalChart migration reasoning and bulk tooth state risk.
- Do not use its old simplified `ToothRecord` shape as current truth.

## 6.5 `DENTALCHART-REAL-001A`

Old key claim:

- Supabase DentalChart repository implementation completed.

Current status:

- `VALID`, but extended by #200-#212.

New label:

- Use as baseline for core chart persistence.
- Add #203/#207/#210 context for editor fields, fallbacks, and finding links.

## 6.6 `DENTALCHART-REAL-001B`

Old key claim:

- Real browser QA for Supabase dental chart path was performed with listed limitations.

Current status:

- `VALID` for that tested scope.
- `PARTIALLY VALID` for current dental chart editor because many editor and visual changes came later.

New label:

- Use as baseline evidence for the older Supabase chart path.
- Do not claim it covers the post-#202 editor, post-#203 editor persistence, post-#210 structured finding links, or post-#212 child chart mode.

## 6.7 `RECON-TREATMENT-REAL-001`

Old key claim:

- TreatmentPlansRepository was not ready because `finding_ids` required UUIDs and findings were not yet migrated.

Current status:

- `SUPERSEDED` as current blocker.
- `VALID` as historical reason for sequencing.

New label:

- Use as historical explanation only.
- Do not use it to block TreatmentPlansRepository work now.

## 6.8 `RECON-TREATMENT-REAL-002`

Old key claim:

- After Findings and DentalChart migration, TreatmentPlansRepository became READY.

Current status:

- `VALID` as migration refresh reasoning.
- `PARTIALLY VALID` because later implementation and generation/delete tasks now need to be considered.

New label:

- Use as the handoff from NOT READY to READY.
- Do not treat it as final current state.

## 6.9 `TREATMENT-REAL-001A`

Old key claim:

- SupabaseTreatmentPlansRepository implementation completed for manual CRUD.
- Automatic generation was out of scope.

Current status:

- `VALID` for repository implementation baseline.
- `PARTIALLY VALID` for current workflow because generation/delete tasks were added later.

New label:

- Use as baseline for TreatmentPlans repository behavior.
- Do not use it to claim generation/delete do not exist.

## 6.10 Treatment generation and delete reports

Current status:

- `VALID` for their scoped implementations and QA evidence.
- `HIGH-RISK BOUNDARY` for future changes because they coordinate multiple clinical repositories.

New label:

- Any future task touching generation/delete must inspect ClinicalWorkflowOrchestrator and the corresponding reports first.
- Do not add new automatic plan behavior without a new RECON.

## 6.11 DentalChart PR #200-#212 chain

Current status:

- `VALID` as recent main route.
- This chain supersedes many older DentalChart simplifications.

Important sub-status:

- #203 and #210 added migrations and repository mappings.
- #207 added fallback for missing editor columns.
- #211 added zone visual highlights.
- #212 added adult/child dental formula modes.
- #213 was closed and not merged, so status markers are not part of current `main`.

---

# 7. Current data flow map

## 7.1 Tooth editor to chart and finding

```text
ToothGrid
→ ToothEditorModal
→ DentalChartTab
→ useClinicalWorkflow.applyToothStatusChange
→ ClinicalWorkflowOrchestrator.applyToothStatusChange
→ DentalChartRepository.saveDentalChart
→ FindingsRepository.listFindingsByPatient
→ FindingsRepository.updateFinding OR createFinding
```

Current notes:

- Chart save happens before optional finding write.
- If finding write fails after chart save, the chart may already be saved.
- This is currently accepted as frontend repository coordination, not an atomic database transaction.

## 7.2 Findings list / edit / delete

```text
PatientCardPage / Findings UI
→ usePatientFindings
→ FindingsRepository factory
→ localStorage OR Supabase findings
```

Current notes:

- Supabase mode requires authMode, tenantId, and configured client.
- local fallback remains available.
- Structured link fields require live migration `0003` for full Supabase persistence.

## 7.3 Dental chart load/save

```text
DentalChartTab
→ useDentalChart / useClinicalWorkflow
→ DentalChartRepository factory
→ localStorage OR Supabase dental_charts + tooth_states
```

Current notes:

- Supabase repository merges missing teeth with default chart.
- Adult/child chart display mode is UI-level and ToothNumber type supports both.
- Full editor persistence requires migration `0002`.

## 7.4 Treatment plan manual CRUD

```text
TreatmentPlansTab
→ useTreatmentPlans
→ TreatmentPlansRepository factory
→ localStorage OR Supabase treatment_plans + treatment_stages
```

Current notes:

- Supabase mode validates patient UUID.
- Local plan/stage IDs are replaced or filtered before Supabase writes.
- findingIds are filtered to UUID values before writing to `uuid[]`.

## 7.5 Treatment generation from findings

```text
TreatmentPlansTab / generation UI
→ useClinicalWorkflow.createTreatmentPlanFromFindings
→ ClinicalWorkflowOrchestrator.createTreatmentPlanFromFindings
→ TreatmentPlansRepository.createTreatmentPlan
→ FindingsRepository.updateFinding
```

Current notes:

- In Supabase mode, selected findings must be UUID-backed and belong to the patient.
- Plan is saved first.
- Finding statuses are updated only after the plan is saved.
- If status update fails, the plan may already exist.

## 7.6 Treatment plan deletion cleanup

```text
TreatmentPlans UI / cleanup route
→ useClinicalWorkflow.deleteTreatmentPlanWithCleanup
→ ClinicalWorkflowOrchestrator.deleteTreatmentPlanWithCleanup
→ TreatmentPlansRepository.deleteTreatmentPlan
→ FindingsRepository.updateFinding restore loop
```

Current notes:

- Plan deletion happens before finding restoration.
- If restoration fails, the plan may already be deleted.
- Future work must treat this as a non-transactional workflow and preserve explicit error reporting.

---

# 8. Current readiness map

## 8.1 Ready / current baseline

These are current migrated or Supabase-aware baselines:

- FindingsRepository base CRUD.
- DentalChartRepository base chart/tooth persistence.
- TreatmentPlansRepository manual CRUD.
- ClinicalWorkflow tooth-to-finding coordination.
- Treatment plan generation from findings.
- Treatment plan deletion cleanup.
- Dental chart editor fields in frontend model.
- Structured finding links in frontend model.
- Adult/child chart mode in frontend model and UI.

## 8.2 Ready only with migration caveat

These are implemented in code, but require live schema confirmation for full Supabase persistence:

- Dental chart editor fields in `tooth_states` via migration `0002`.
- Finding structured link fields via migration `0003`.

## 8.3 Not ready / needs new RECON before implementation

- Mixed dentition beyond simple adult/child switch.
- Dictionary administration UI.
- New automatic treatment plan pricing logic.
- Documents generated from treatment plans.
- Treatment-plan-to-payment / billing logic.
- Cross-module analytics or reporting.
- Any change that alters ClinicalWorkflowOrchestrator sequencing.
- Any new schema change touching findings, tooth_states, or treatment_stages.

## 8.4 Not in main

- `DENTALCHART-STATUS-MARKERS-001` attempt via PR #213 is not merged.
- Status marker behavior must not be treated as available in current `main`.

---

# 9. Current risk register

## 9.1 Live schema drift

Risk:

- Migrations `0002` and `0003` are in repo but may not be applied to live Supabase.

Impact:

- New editor fields and structured finding links may silently fall back to legacy persistence.

Mitigation:

- Run migration verification before claiming full Supabase persistence.
- Add a dedicated `SUPABASE-MIGRATION-APPLY-001` or `SUPABASE-SCHEMA-VERIFY-001` task.

## 9.2 Non-transactional clinical workflows

Risk:

- Frontend orchestration writes across multiple repositories without one DB transaction.

Impact:

- Chart can be saved while finding create fails.
- Plan can be saved while finding status update fails.
- Plan can be deleted while finding restore fails.

Mitigation:

- Preserve explicit errors.
- Avoid hiding failures.
- For production-critical flows, move multi-step clinical workflows behind backend RPC/API transaction boundary later.

## 9.3 Orchestrator becoming a God-service

Risk:

- ClinicalWorkflowOrchestrator already coordinates chart, findings, and treatment plans.

Impact:

- If new rules are added casually, it can become a single overloaded transformer box.

Mitigation:

- Keep it as orchestration only.
- Move domain-specific rules into small pure helpers.
- Add RECON before expanding generation/delete behavior.

## 9.4 Local IDs entering Supabase mode

Risk:

- Dev fallback can still contain local-style IDs.

Impact:

- Supabase UUID fields can fail or lose links if local IDs are used incorrectly.

Mitigation:

- Keep UUID validation and filtering.
- Do not pass local seed findings into Supabase treatment generation.
- Keep backend-mode checks in hooks and orchestrator tests.

## 9.5 Browser QA scope drift

Risk:

- Some browser QA was done before later editor/zone/dentition changes.

Impact:

- Old QA evidence may be over-claimed.

Mitigation:

- Mark old QA as valid only for its tested scope.
- Run new smoke tests after major UI/clinical flow changes.

## 9.6 DentalChart responsive issue

Risk:

- A later smoke found horizontal scrolling at desktop width.

Impact:

- Usability issue, not a data blocker.

Mitigation:

- Separate UI task: `DENTALCHART-TOOTHGRID-RESPONSIVE-001`.

---

# 10. Updated stop rules

## 10.1 Before touching Findings

Must check:

- Is task base CRUD, structured link, UI list, or treatment-generation dependency?
- Does it require migration `0003`?
- Is live schema verified?
- Are IDs UUID in Supabase mode?
- Is fallback behavior expected or dangerous?

Stop and create RECON if:

- new fields are added;
- finding statuses are redefined;
- treatment generation logic changes;
- finding delete/restore behavior changes.

## 10.2 Before touching DentalChart

Must check:

- Is task UI-only, repository, editor persistence, or schema?
- Does it require migration `0002`?
- Is the task adult/child chart mode, mixed dentition, or tooth-state persistence?
- Does it alter `plannedWorkRecords`?
- Does it affect `ClinicalWorkflowOrchestrator`?

Stop and create RECON if:

- a new schema field is needed;
- mixed dentition is added;
- tooth-level data starts linking by tooth_state UUID;
- chart save sequencing changes.

## 10.3 Before touching TreatmentPlans

Must check:

- Manual CRUD or automatic generation?
- Does it touch finding status updates?
- Does it change delete cleanup?
- Does it introduce pricing, payments, documents, or appointments?
- Are all findingIds UUID in Supabase mode?

Stop and create RECON if:

- automatic generation logic changes;
- pricing rules are introduced;
- documents are generated from treatment plans;
- payments/billing are connected;
- plan deletion cascade behavior changes.

## 10.4 Before touching ClinicalWorkflowOrchestrator

Must check:

- Which repositories are written?
- What happens if step 2 fails after step 1 succeeds?
- Is rollback needed?
- Should this move to backend/API later?

Stop and create RECON if:

- more than one new repository is added to a workflow;
- the order of chart/finding/plan writes changes;
- error handling changes;
- a task tries to hide partial failures.

---

# 11. Updated route map

Recommended next route after this report:

1. `SUPABASE-SCHEMA-VERIFY-001`
   - report-only or guided SQL verification;
   - verify live presence of migrations `0002` and `0003`;
   - do not change code.

2. `DENTALCHART-SUPABASE-SMOKE-001`
   - real browser smoke in Supabase-active mode;
   - verify editor fields, finding structured links, refresh persistence;
   - include console check.

3. `DENTALCHART-TOOTHGRID-RESPONSIVE-001`
   - UI-only fix for desktop horizontal overflow;
   - no data changes.

4. `DENTALCHART-STATUS-MARKERS-001`
   - clean new PR only;
   - do not reuse closed red PR #213 as proof.

5. `DENTALCHART-MIXED-DENTITION-RECON-001`
   - recon before mixed dentition;
   - adult/child switch already exists, mixed mode does not.

6. `DICTIONARY-ADMIN-RECON-001`
   - recon before admin-managed clinical dictionaries;
   - must consider tenant scope and whether dictionaries are global or clinic-specific.

7. `TREATMENTPLAN-FROM-DENTALCHART-RECON-001`
   - recon before deeper automatic generation from dental chart editor data;
   - must not blindly use selected works as billable services.

---

# 12. Final verdict

## Current truth

Findings, DentalChart, and TreatmentPlans are no longer the old localStorage-only / not-ready cluster.

They are now a mixed but functional clinical repository layer:

```text
FindingsRepository        = Supabase-aware + local fallback + structured link extension
DentalChartRepository     = Supabase-aware + local fallback + editor field extension
TreatmentPlansRepository  = Supabase-aware + local fallback + UUID guards
ClinicalWorkflow          = shared coordinator across chart, findings, treatment plans
```

## Main warning

The project has crossed from isolated repository migrations into linked clinical workflows.

That is useful, but also dangerous: the orchestrator now connects chart, findings, and plans. Future changes must preserve clear boundaries and explicit failure behavior.

## Operational rule from now on

Do not use old single-report conclusions in isolation.

For future tasks in this area, use this stack together:

- `PROJECT-AUDIT-BACKFILL-004`
- `DENTALCHART-BACKFILL-RECON-001`
- `RECON-FINDINGS-REAL-001` only as historical dependency reasoning
- `RECON-DENTALCHART-REAL-001` only with updated editor/dentition context
- `RECON-TREATMENT-REAL-002` plus later Treatment implementation/generation/delete reports

## Next recommended task

`SUPABASE-SCHEMA-VERIFY-001`

Purpose:

- verify that live Supabase has migrations `0002` and `0003` applied;
- confirm editor fields and finding link fields exist;
- document exact result;
- do not change application code.
