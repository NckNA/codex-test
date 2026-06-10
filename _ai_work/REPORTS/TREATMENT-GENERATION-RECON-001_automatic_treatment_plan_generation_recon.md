# QA/Recon Report: TREATMENT-GENERATION-RECON-001
**Title:** Recon automatic treatment plan generation
**Date:** 10.06.2026

## 1. Summary
A reconnaissance of the automatic treatment plan generation logic ("Создать план из проблем") was conducted. The feature is partially real but functionally fractured. It currently successfully aggregates existing patient findings into a new treatment plan and updates finding statuses. However, the workflow relies heavily on hardcoded local IDs (`plan_${timestamp}`) and `useClinicalWorkflow` explicitly forces writes to `LocalStorageTreatmentPlansRepository`, even when `authMode` is set to `supabase-active`. This creates a severe mixed-persistence issue where finding statuses update in Supabase, but the generated treatment plans land in Local Storage.

## 2. Scope
Read-only reconnaissance of the `ClinicalWorkflowOrchestrator`, `CreatePlanFromFindingsModal`, and related generation logic. No implementation or modification of source files was performed.

## 3. Files inspected
* `src/components/treatment/TreatmentPlansTab.tsx`
* `src/components/treatment/CreatePlanFromFindingsModal.tsx`
* `src/data/hooks/useClinicalWorkflow.ts`
* `src/data/orchestrators/ClinicalWorkflowOrchestrator.ts`
* `src/data/repositories/TreatmentPlansRepository.ts`
* `src/types/index.ts`

## 4. Reports inspected
* `TREATMENT-REAL-001A_supabase_treatment_plans_repository_implementation.md`
* `TREATMENT-REAL-001B_real_browser_qa_supabase_treatment_plans.md`
* `FINDINGS-REAL-001A_supabase_findings_repository_implementation.md`

## 5. Commands run
* `npm run lint`
* `npm test`
* `npm run build`

## 6. Command results
* **`npm run lint`**: PASS (completed with no errors).
* **`npm test`**: PASS (completed with 146 tests passing across 25 files).
* **`npm run build`**: PASS (completed successfully).

## 7. Current generation entry points
* **UI Button**: "Создать план из проблем" button in `TreatmentPlansTab.tsx`.
* **Modal**: `CreatePlanFromFindingsModal.tsx` handles user selection of eligible findings.
* **Hook**: `useClinicalWorkflow().createTreatmentPlanFromFindings`.
* **Orchestrator**: `ClinicalWorkflowOrchestrator.createTreatmentPlanFromFindings`.

## 8. Real vs fake/placeholder classification
* **Real and functional**: The UI accurately reads finding metadata (category, severity) and generates corresponding treatment stages.
* **Mixed / Local-only fallback**: While finding states are updated according to the active backend, the plan creation itself is hardcoded to `LocalStorageTreatmentPlansRepository`.
* **Fake/Placeholder**: "amoCRM: после подключения" button is a disabled placeholder.

## 9. Current data flow
* **Input**: An array of selected `DentalFinding` objects retrieved from `usePatientFindings()`.
* **Mapping**: `findings` -> `stages`. One finding becomes one stage with a status of `planned`, price of `0`, and a derived description. `findingIds` array successfully links the source finding.

## 10. Current write flow
* **Writes to `TreatmentPlansRepository`**: Creates a new plan and corresponding stages.
* **Writes to `FindingsRepository`**: Iterates over selected findings and updates their status to `included_in_plan`.

## 11. LocalStorage vs Supabase usage
* **CRITICAL FINDING**: `useClinicalWorkflow.ts` explicitly hardcodes `LocalStorageTreatmentPlansRepository` for generation:
  ```ts
  // Explicitly keep TreatmentPlansRepository local since it is not yet migrated to Supabase.
  const treatmentPlansRepository = LocalStorageTreatmentPlansRepository;
  ```
* This causes a mixed-persistence write flow. Findings are updated in Supabase, but the plan is only created locally, causing data desync across sessions.

## 12. ClinicalWorkflowOrchestrator analysis
* The orchestrator successfully wraps operations securely within a shared domain.
* However, it internally uses template string ID generation instead of crypto UUIDs:
  - Plan ID: `` `plan_${planTimestamp}` ``
  - Stage ID: `` `stage_${planTimestamp}_${index}_${finding.id}` ``
* These IDs are completely unsafe for `SupabaseTreatmentPlansRepository` which strictly enforces valid UUID formats.

## 13. Findings interaction analysis
* Automatically transitions findings to `included_in_plan`.
* Safely sets `includeInTreatmentPlan: true`.
* Interaction is clean and accurately reflects clinical intention.

## 14. DentalChart interaction analysis
* `createTreatmentPlanFromFindings` does NOT interact with or mutate the `DentalChart`.
* DentalChart boundaries are respected.

## 15. TreatmentPlansRepository readiness
* `TreatmentPlansRepository` is fully prepared and migrated to handle generation. The `SupabaseTreatmentPlansRepository` exposes safe UUID sanitization and handles cascading `treatment_stages`.

## 16. Stage generation / order_index analysis
* Stages are generated with an array-index based order via `.map((finding, index))`.
* `order_index` is properly calculated during Supabase translation by the repository, not directly assigned in the Orchestrator. This is safe.

## 17. finding_ids UUID safety analysis
* `finding.id` references come directly from `usePatientFindings`. If `supabase-active` is used, these are genuine UUIDs.
* No `f1`/`f2` local mock IDs will leak into Supabase, provided the repository layer properly validates the UUID formatting.

## 18. Tenant/patient/RLS safety analysis
* **Patient ID**: Used correctly.
* **Tenant ID**: `LocalStorageTreatmentPlansRepository` ignores `tenantId`. `SupabaseTreatmentPlansRepository` would auto-inject it, but it isn't wired.
* **UUID Risk**: Template string local IDs (`plan_12345`) will instantly throw errors if routed to Supabase.

## 19. Delete/RLS implications
* Automatically generated plans do not behave differently from manually created plans. They can be deleted by users with `clinic_admin` privileges cleanly. No immediate RLS changes are required for automatic generation.

## 20. UI/UX readiness
* **User confirmation**: Checkbox selection via Modal explicitly acts as confirmation.
* **Preview**: None before generation. A new plan is instantly instantiated.
* **Error handling**: Handled standardly by hooks.
* UX is fully ready for safe implementation.

## 21. Documents/billing/appointments boundary
* The orchestrator logic successfully avoids entangling documents, appointments, and billing during generation.
* The boundary is clean and respects the domain separation.

## 22. Blockers
* **Blocker 1**: `useClinicalWorkflow` hardcodes `LocalStorageTreatmentPlansRepository` and ignores Supabase configuration for Treatment Plans.
* **Blocker 2**: `ClinicalWorkflowOrchestrator` generates non-UUID template strings for `id` fields (`plan_xxx`), which will fail the `validateUuid` enforcement inside `SupabaseTreatmentPlansRepository`.

## 23. Risks
* **Mixed Persistence Desync**: Executing "Создать план из проблем" on production today would permanently update Supabase finding statuses, but fail to persist the generated plan in the database.

## 24. Recommended implementation strategy
The next task should exclusively focus on refactoring the integration between the Orchestrator and the Repository.
1. Update `useClinicalWorkflow.ts` to properly instantiate and use `SupabaseTreatmentPlansRepository` identical to `useTreatmentPlans.ts`.
2. Update `ClinicalWorkflowOrchestrator.ts` to utilize `crypto.randomUUID()` instead of timestamp strings when `backend === 'supabase'` (or universally rely on valid UUIDs).
3. Do NOT implement document or billing logic.

## 25. Recommended next task
TREATMENT-GENERATION-REAL-001A — Implement safe Supabase-backed treatment plan generation

## 26. What was NOT changed
* NO `src/*` application code was changed.
* NO `tests` were changed.
* NO `TreatmentPlansRepository` code was changed.
* NO `useTreatmentPlans` code was changed.
* NO `ClinicalWorkflowOrchestrator` code was changed.
* NO automatic generation logic was implemented.
* `FindingsRepository`, `DentalChartRepository`, and `PatientRepository` were NOT changed.
* Documents, billing, and appointment logic were NOT implemented.
* `supabase/migrations` were NOT changed.
* `supabase/seed.sql` was NOT changed.
* `package.json`/`package-lock.json` were NOT changed.
* NO `.env` files were committed.
* NO screenshots were committed.
* NO credentials/tokens/API keys were committed or exposed.

## 27. Final verdict
READY WITH LIMITATIONS FOR TREATMENT-GENERATION-REAL-001A
