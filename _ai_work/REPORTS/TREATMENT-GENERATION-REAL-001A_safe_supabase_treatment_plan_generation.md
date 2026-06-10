# Implementation Report: TREATMENT-GENERATION-REAL-001A
**Title:** Implement safe Supabase-backed treatment plan generation
**Date:** 10.06.2026

## 1. Summary
This task successfully implemented safe, Supabase-backed treatment plan generation from findings. The severe mixed-persistence bug in `ClinicalWorkflowOrchestrator`—where findings were updated in Supabase but generated treatment plans were forced into LocalStorage—has been resolved. The orchestrator now respects the global `authMode` routing and seamlessly utilizes the `SupabaseTreatmentPlansRepository` when configured, completely preserving tenant isolation, RLS rules, and UUID validation.

## 2. Scope
Implementation was strictly bounded to persistence routing logic and UUID generation for treatment plans derived from findings. No new UI, billing, documents, or appointment logic was added. All work remained within the orchestrator and hook layers.

## 3. Files changed
* `src/data/hooks/useClinicalWorkflow.ts`
* `src/data/hooks/useClinicalWorkflow.test.tsx`
* `src/data/orchestrators/ClinicalWorkflowOrchestrator.ts`
* `src/data/orchestrators/ClinicalWorkflowOrchestrator.test.ts`

## 4. Files inspected
* `src/types/index.ts`
* `src/data/repositories/TreatmentPlansRepository.ts`

## 5. Reports inspected
* `TREATMENT-GENERATION-RECON-001_automatic_treatment_plan_generation_recon.md`
* `TREATMENT-REAL-001A_supabase_treatment_plans_repository_implementation.md`
* `TREATMENT-REAL-001B_real_browser_qa_supabase_treatment_plans.md`
* `FINDINGS-REAL-001A_supabase_findings_repository_implementation.md`

## 6. Implementation details
* Replaced hardcoded `LocalStorageTreatmentPlansRepository` inside `useClinicalWorkflow` with dynamic `createTreatmentPlansRepository` routing.
* Modified `ClinicalWorkflowOrchestratorDependencies` to accept a `backend?: 'local' | 'supabase'` configuration.
* Replaced non-compliant template string IDs (`plan_12345`) with valid `crypto.randomUUID()` values when operating in `supabase` mode.

## 7. Previous mixed-persistence problem
Previously, running "Создать план из проблем" with `supabase-active` updated findings globally in the Supabase database but saved the new treatment plan only in the local browser cache. This caused severe data desynchronization.

## 8. New repository routing behavior
`useClinicalWorkflow` now acts identically to all other repository hooks. It monitors `authMode`, `activeTenant?.tenantId`, and `isSupabaseConfigured` to select a unified backend across all integrated repositories.

## 9. Supabase-active behavior
When `supabase-active` mode is engaged, a valid tenant is active, and Supabase is configured, both the finding status update and the plan creation occur securely through the Supabase remote API.

## 10. Local/dev fallback behavior
If Supabase is not active, the system safely falls back to local JSON/storage, utilizing timestamp-based IDs (`plan_timestamp`) as before to maintain backward compatibility.

## 11. No-tenant behavior
If no active tenant exists, the orchestrator forcibly downgrades to `local` backend mode to prevent invalid RLS writes to the database.

## 12. ID strategy
* **Supabase mode:** Generates strict `crypto.randomUUID()` values for both `planId` and all `stage.id` entries.
* **Local mode:** Retains the legacy `plan_${timestamp}` behavior for maximum compatibility.

## 13. finding_ids UUID safety
The orchestrator now explicitly evaluates `validateUuid` against the passed `patientId` and all source `finding.id` references before initiating a Supabase operation. Invalid arrays are strictly rejected before any writes occur.

## 14. Save order and failure behavior
* The execution flow was hardened. The treatment plan is strictly saved **first**.
* If the plan creation fails, execution halts immediately. No findings are mutated.
* Findings are updated one-by-one **only** after plan validation.
* If a finding fails to update post-plan creation, the system throws an explicit, trackable error exposing the desync without quietly silencing it.

## 15. Tenant/patient/RLS safety
Because the backend injection now uses the standard repository configurations, `tenant_id` is automatically and safely attached to all created stages and plans deep inside `SupabaseTreatmentPlansRepository`. RLS remains entirely intact and no manual bypasses were utilized.

## 16. Stage generation behavior
Existing mapping logic for stages (extracting `title`, `toothNumber`, generating `description` strings, and preserving zero price with `status: 'planned'`) was left exactly as originally designed.

## 17. Clinical domain boundaries
No boundaries were crossed.
The generation algorithm did NOT issue automated diagnoses, did NOT automatically create billing invoices, did NOT close appointments, and did NOT create missing documents.

## 18. Tests added/updated
* Updated `useClinicalWorkflow.test.tsx` to assert that `createTreatmentPlansRepository` is invoked correctly based on the environment context.
* Expanded `ClinicalWorkflowOrchestrator.test.ts` to simulate local generation behavior.
* Added `it('creates draft treatment plan with valid UUIDs in supabase backend')` in the orchestrator test file.
* Added boundary tests confirming UUID validation rejects faulty arrays before save attempts.

## 19. Commands run
* `npm run lint`
* `npm test`
* `npm run build`

## 20. Command results
* **`npm run lint`:** PASS
* **`npm test`:** PASS (149 tests passed across 25 files).
* **`npm run build`:** PASS

## 21. What was NOT changed
* No documents were implemented.
* No billing/payment logic was implemented.
* No appointments were implemented.
* No completed services were implemented.
* No dental chart mutation was added.
* `FindingsRepository` was NOT changed.
* `DentalChartRepository` was NOT changed.
* `PatientRepository` was NOT changed.
* `AppointmentRepository` was NOT changed.
* `DoctorRepository` was NOT changed.
* `supabase/migrations` were NOT changed.
* `supabase/seed.sql` was NOT changed.
* `package.json`/`package-lock.json` were NOT changed.
* No `.env` files were committed.
* No screenshots were committed.
* No credentials/tokens/API keys were committed.
* No browser QA was performed in this task.

## 22. Known limitations
If Supabase successfully stores the generated plan but encounters a network disconnect halfway through iterating and updating findings, the database will be partially desynchronized (Plan exists, but a source finding remains 'discovered'). An explicit error trace is now thrown, but the operation lacks a true transactional rollback since it bridges two separate repository domains.

## 23. Final verdict
READY FOR REVIEW

## 24. Recommended next task
TREATMENT-GENERATION-REAL-001B — Real browser QA for Supabase-backed treatment plan generation
