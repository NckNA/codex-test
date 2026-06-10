# Implementation Report: TREATMENT-DELETE-REAL-001A
## Supabase-safe treatment plan deletion and cleanup

## 1. Summary
Implemented a safe, orchestrated treatment plan deletion workflow. A new method `deleteTreatmentPlanWithCleanup` was added to `ClinicalWorkflowOrchestrator` to coordinate the physical deletion of the plan and the restoration of finding statuses. `TreatmentPlansTab.tsx` was updated to use this orchestrated flow instead of direct repository hooks, and displays robust error alerts to handle RLS failures for non-admin roles gracefully.

## 2. Scope
- Implemented orchestrated deletion in `ClinicalWorkflowOrchestrator.ts`.
- Wired `useClinicalWorkflow.ts` and `TreatmentPlansTab.tsx` to utilize the new workflow.
- Cleaned up obsolete direct repository methods in `useTreatmentPlans.ts`.
- Added test coverage in `ClinicalWorkflowOrchestrator.test.ts`.
- Verified lint, test, and build passing cleanly.

## 3. Files changed
- `src/data/orchestrators/ClinicalWorkflowOrchestrator.ts`
- `src/data/orchestrators/ClinicalWorkflowOrchestrator.test.ts`
- `src/data/hooks/useClinicalWorkflow.ts`
- `src/components/treatment/TreatmentPlansTab.tsx`
- `src/data/hooks/useTreatmentPlans.ts`

## 4. Files inspected
- `src/data/hooks/useClinicalWorkflow.test.tsx`
- `src/data/hooks/useTreatmentPlans.test.tsx`

## 5. Reports inspected
- `TREATMENT-DELETE-RECON-001_supabase_safe_treatment_plan_deletion_recon.md`
- `TREATMENT-GENERATION-REAL-001B_real_browser_qa_supabase_generation.md`
- `TREATMENT-GENERATION-REAL-001A_safe_supabase_treatment_plan_generation.md`

## 6. Previous deletion problem
Previously, deleting a treatment plan only issued a `DELETE` against the repository. While Supabase's `ON DELETE CASCADE` constraint safely removed stages, the `findings` linked via `finding_ids` in the stages were completely abandoned in an `included_in_plan` status. As a result, those findings became invisible for future plan generation, corrupting clinical state.

## 7. Implementation details
Added `deleteTreatmentPlanWithCleanup(input: DeleteTreatmentPlanWithCleanupInput): Promise<void>`.
The method explicitly separates operations: extracting finding references, issuing plan deletion, and then individually resetting the finding states.

## 8. New orchestrated delete workflow
1. **Validate:** Ensures `patientId` matches `plan.patientId`. Validates `patientId`, `plan.patientId`, and `plan.id` are valid UUIDs in Supabase mode.
2. **Collect:** Iterates over the plan stages to collect and deduplicate all `findingIds`. In Supabase mode, actively rejects if any collected `findingId` is not a valid UUID (fail-fast).
3. **Delete Plan:** Deletes the treatment plan via `TreatmentPlansRepository`.
4. **Restore Findings:** Updates each finding collected to `status: 'discovered'` and `includeInTreatmentPlan: true` using `FindingsRepository.updateFinding()`. This ensures the finding is returned to the active candidate pool and remains eligible for future treatment plan generation.
5. **Throw on Failure:** Throws a detailed error message aggregating all finding restoration failures, avoiding silent partial failures.

## 9. Treatment plan deletion behavior
The treatment plan deletion executes first. The UI provides a prompt confirmation and dispatches the task. If this delete fails (e.g. Supabase RLS rejection), the method immediately propagates the error, preventing finding state resets on a plan that was not actually deleted.

## 10. Stage cleanup behavior
Stage cleanup is entirely deferred to Supabase `ON DELETE CASCADE` triggers for the `supabase` backend, and repository logic for the `local` backend. No manual staging deletion is orchestrated, adhering to project specs.

## 11. Findings restore/unlink behavior
Findings are fetched before plan deletion to guarantee only real, active records are affected. They are then explicitly patched back to `status = 'discovered'` preventing infinite loop states.

## 12. Supabase-active behavior
Supabase backend strictly checks for UUID compliance and relies on tenant/patient isolation in the repositories.

## 13. Local/dev fallback behavior
The local backend processes exactly the same orchestration flow, utilizing local repositories and omitting UUID regex constraints.

## 14. Role/permission UX behavior
If a non-admin/owner attempts deletion, Supabase enforces RLS and rejects the query. The orchestrator throws, and `TreatmentPlansTab.tsx` intercepts the rejection and shows a robust native `window.alert()` notifying the user of the lack of privileges or server rejection, resolving the previous silent console error problem.

## 15. Tenant/patient/RLS safety
All deletes and updates are heavily scoped by both `tenantId` and `patientId` down inside the repository layers. The orchestrator purely manages flow.

## 16. UUID/local ID safety
A stringent `validateUuid` block runs in Supabase backend mode across the `patientId`, `plan.patientId`, `plan.id`, and every `findingId` during stage collection to ensure no invalid IDs are transmitted. If any ID is malformed, it throws immediately before issuing any DB commands.

## 17. Error handling behavior
Any error from Supabase (e.g. network timeout or RLS constraint) causes the Promise to reject entirely. In UI, an alert provides human-readable context. For finding updates, all errors are caught and aggregated into a single throw.

## 18. Tests added/updated
Added 7 new test suites in `ClinicalWorkflowOrchestrator.test.ts`:
- Deletes treatment plan and restores linked findings successfully.
- Rejects if delete fails and does not update findings.
- Throws combined error if finding restore fails after plan deletion.
- Validates UUIDs in supabase backend.
- Rejects in Supabase mode if findingId is invalid UUID.
- Rejects in Supabase mode if plan.patientId mismatches input patientId.
- Rejects in Supabase mode if plan.patientId is invalid UUID.

## 19. Commands run
- `npm run lint`
- `npm run build`
- `npm test -- --run`

## 20. Command results
- **npm run lint:** PASS
- **npm run build:** PASS
- **npm test:** PASS (158 tests passed)

## 21. What was NOT changed
- No migrations were changed.
- No RLS policies were changed.
- No seed data was changed.
- No package files were changed.
- No .env files were committed.
- No screenshots were committed.
- No credentials/tokens/API keys were committed.
- No documents were implemented.
- No billing/payment logic was implemented.
- No appointments were implemented.
- No completed services were implemented.
- DentalChartRepository was not changed.
- PatientRepository was not changed.
- AppointmentRepository was not changed.
- DoctorRepository was not changed.
- No browser QA was performed.

## 22. Known limitations
There is no cross-RPC atomicity for the deletion flow. If the finding status update fails *after* successful plan deletion, the user receives an alert warning them of a dirty state, but the plan is functionally unrecoverable from the database.

## 23. Final verdict
**READY FOR REVIEW**

## 24. Recommended next task
**TREATMENT-DELETE-REAL-001B — Real browser QA for Supabase-safe treatment plan deletion cleanup**
