# QA Report: TREATMENT-DELETE-RECON-001
## Recon Supabase-safe treatment plan deletion and cleanup workflow

## 1. Summary
The deletion of treatment plans is currently implemented at the repository level but lacks clinical orchestration. While Supabase correctly cascades deletions to `treatment_stages` via database constraints and securely guards the operation via RLS (Admins/Owners only), the `findings` linked to the deleted plan's stages are completely orphaned in an "included_in_plan" status. A new orchestrator method is required to safely unlink findings during deletion, alongside UX improvements to handle role-based access. No schema or RLS blockers exist to implement this fix.

## 2. Scope
- Inspected `TreatmentPlansRepository`, `ClinicalWorkflowOrchestrator`, and `TreatmentPlansTab.tsx`.
- Inspected initial schema RLS policies and foreign key constraints in `0001_initial_schema.sql`.
- Inspected `DentalFinding` types and `FindingsRepository` update behavior.
- Analyzed role-based restrictions, local fallback behavior, and transaction requirements.

## 3. Files inspected
- `src/components/treatment/TreatmentPlansTab.tsx`
- `src/data/repositories/TreatmentPlansRepository.ts`
- `src/data/hooks/useTreatmentPlans.ts`
- `src/data/orchestrators/ClinicalWorkflowOrchestrator.ts`
- `src/data/repositories/FindingsRepository.ts`
- `src/types/index.ts`
- `supabase/migrations/0001_initial_schema.sql`

## 4. Reports inspected
- `TREATMENT-GENERATION-REAL-001B_real_browser_qa_supabase_generation.md`
- `TREATMENT-GENERATION-REAL-001A_safe_supabase_treatment_plan_generation.md`
- `TREATMENT-REAL-001A_supabase_treatment_plans_repository_implementation.md`

## 5. Commands run
- `npm run lint`
- `npm run build`
- `npm test -- --run`

## 6. Command results
- **npm run lint:** PASS (No errors)
- **npm run build:** PASS (Built successfully)
- **npm test:** PASS (151 tests passed)

## 7. Current delete entry points
- **UI Action:** `handleDeletePlan` in `TreatmentPlansTab.tsx` (Real, but unsafe due to missing orchestrator cleanup).
- **Hook Method:** `useTreatmentPlans.deleteTreatmentPlan` (Real).
- **Repository Method:** `SupabaseTreatmentPlansRepository.deleteTreatmentPlan` (Real, Supabase-backed).
- **Orchestrator Method:** Unimplemented. The orchestrator currently lacks a deletion method.

## 8. Real vs fake/placeholder delete classification
The deletion is **Real** but **Partial**. The repository genuinely issues a `DELETE` HTTP request to Supabase, which removes the plan and its stages, but it fails to execute the business logic required to restore associated findings.

## 9. SupabaseTreatmentPlansRepository delete behavior
- **Table:** Deletes from `treatment_plans`.
- **Filters:** Explicitly filters by `tenant_id`, `patient_id`, and `id`.
- **Stages:** It does not manually delete stages, but stages are deleted automatically via Supabase PostgreSQL `ON DELETE CASCADE`.
- **Findings:** It does NOT unlink findings.
- **Errors:** It throws an error if Supabase returns a failure (e.g., RLS violation).

## 10. LocalStorage delete behavior
- `LocalStorageTreatmentPlansRepository.deleteTreatmentPlan` natively removes the plan from local storage.
- It also does not orchestrate finding status reversion, mirroring the partial behavior of the Supabase repository.

## 11. RLS delete policy analysis
- **`treatment_plans`:** `Only admins can delete plans` (Checks for `clinic_admin` or `clinic_owner`).
- **`treatment_stages`:** `Only admins can delete stages`.
- **`findings`:** Users can `UPDATE` findings in their tenant (Doctors can update).
- **Tenant checks:** No-tenant is implicitly blocked by `get_user_tenants()` logic.
- RLS successfully protects against unauthorized deletion by doctors/registrars. 

## 12. Stage cleanup analysis
- `treatment_stages` are physically deleted via `ON DELETE CASCADE` defined in `0001_initial_schema.sql`.
- Manual stage deletion is not performed by the repository, nor is it required.
- Physical deletion is standard in this schema. No soft-delete column exists.

## 13. Findings unlink/status cleanup analysis
- `findings` in the data model do not hold a `treatment_plan_id`. Instead, they only possess a `status` (e.g., `included_in_plan`) and a boolean `include_in_treatment_plan`.
- When a plan is deleted, findings that were pulled into the plan's stages must be reverted to `status: 'discovered'` (or their previous active state) and `include_in_treatment_plan: false`.
- **Risk:** Currently, findings are left orphaned in the `included_in_plan` state forever. They disappear from the active findings pool and cannot be added to a new plan.
- Cleanup must happen *after* retrieving the plan's stages (to know which findings to restore), but *before or immediately after* the plan is deleted.

## 14. Patient/tenant safety analysis
- Deleting a plan from the wrong patient is prevented by `patient_id` explicitly matching in the repository `eq()` chains.
- Cross-tenant deletion is guarded by `tenant_id` and RLS.
- The only safety breach is data integrity related to the finding status desync.

## 15. Role-based UX analysis
- The UI currently renders the "Удалить" (Delete) trash icon for all users regardless of role.
- If a doctor attempts to delete, the Supabase repository catches an RLS violation and throws an error.
- The UI catches this via `try/catch` and silently logs `console.error('Failed to delete treatment plan', e)`. The user is not informed gracefully.

## 16. Local/dev fallback analysis
- The local/dev fallback utilizes `LocalStorageTreatmentPlansRepository`. It is vulnerable to the same finding desync issue because the orchestrator is bypassed.

## 17. Transaction/consistency analysis
- To safely delete a plan, we need an orchestrator method: `ClinicalWorkflowOrchestrator.deleteTreatmentPlan`.
- The sequence must be:
  1. Fetch the treatment plan and its stages to extract all `findingIds`.
  2. Delete the treatment plan via `TreatmentPlansRepository`.
  3. Iterate over the extracted `findingIds` and update their status back to `discovered` via `FindingsRepository`.
- While an RPC would provide atomicity, the application currently handles creation orchestrations via pseudo-transactions (ordered API calls). Deletion can safely adopt the same pattern. 

## 18. Schema/RLS/migration blocker analysis
- **None.** The existing schema with its cascade rules, and the existing RLS policies fully support the required operations. Admins have the requisite permissions to delete plans and update findings. No database migrations are required.

## 19. Risks
- If a network error occurs between deleting the plan and restoring the findings, some findings may remain orphaned.
- Showing the delete button to non-admins causes silent console errors without UX feedback.

## 20. Blockers
- No hard blockers found.

## 21. Recommended implementation strategy
1. Add `deleteTreatmentPlan` to `ClinicalWorkflowOrchestrator` to coordinate the plan deletion and finding restoration.
2. Update `useClinicalWorkflow` to expose the new orchestrated delete method.
3. Update `TreatmentPlansTab.tsx` to call the orchestrator's delete method instead of the raw repository hook.
4. Update `TreatmentPlansTab.tsx` to conditionally disable or hide the delete button based on the user's role, and to show a user-friendly error toast if deletion fails.

## 22. Recommended next task
**TREATMENT-DELETE-REAL-001A — Implement Supabase-safe treatment plan deletion and cleanup**

## 23. What was NOT changed
- No `src/*` files were changed.
- No tests were changed.
- No `TreatmentPlansRepository` code was changed.
- No `FindingsRepository` code was changed.
- No `DentalChartRepository` code was changed.
- No `ClinicalWorkflowOrchestrator` code was changed.
- No UI code was changed.
- No delete workflow was implemented.
- No stage cleanup was implemented.
- No finding unlink/status cleanup was implemented.
- No documents were implemented.
- No billing/payment logic was implemented.
- No appointments were implemented.
- No completed services were implemented.
- `supabase/migrations` were not changed.
- `supabase/seed.sql` was not changed.
- `package.json/package-lock.json` were not changed.
- No `.env` files were committed.
- No screenshots were committed.
- No credentials/tokens/API keys were committed.

## 24. Final verdict
**READY FOR TREATMENT-DELETE-REAL-001A**
