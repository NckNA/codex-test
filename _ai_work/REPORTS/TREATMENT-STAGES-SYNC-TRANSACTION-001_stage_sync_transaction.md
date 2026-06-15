# TREATMENT-STAGES-SYNC-TRANSACTION-001: Fix Supabase treatment plan stage synchronization and transactional persistence

## Summary

This report documents the implementation and validation of atomic treatment plan and stages persistence. In Supabase mode, saving a treatment plan and its stages is now atomic, and stages removed in the UI are deleted from the database.

- **Branch name**: `fix/treatment-stages-sync-transaction-001`
- **PR URL**: https://github.com/NckNA/codex-test/pull/280
- **PR head reviewed before final report update**: `d5b76fc2eadcc67bed3497931dbb8085e996d0c9`
- **Report update commit**: N/A because the final report update commit cannot reference itself before creation.

---

## Changed Files Summary

- `src/data/repositories/TreatmentPlansRepository.ts`
- `src/data/repositories/TreatmentPlansRepository.test.ts`
- `supabase/migrations/0006_treatment_plan_stage_sync_rpc.sql`
- `_ai_work/REPORTS/TREATMENT-STAGES-SYNC-TRANSACTION-001_stage_sync_transaction.md`

---

## Root Cause

In Supabase-active mode:
1. `updateTreatmentPlan` updated existing stages and inserted new ones, but did NOT delete stages that were removed from the submitted plan. After a page reload, deleted stages reappeared.
2. `createTreatmentPlan` inserted the plan first, then inserted stages separately, making creation non-transactional and leaving partial data if stages insertion failed.

---

## Migration Added

- **Filename**: [0006_treatment_plan_stage_sync_rpc.sql](file:///d:/Users/User/Documents/GitHub/codex-test/supabase/migrations/0006_treatment_plan_stage_sync_rpc.sql)
- **Function Name**: `save_treatment_plan_with_stages`
- **Security Context**: `SECURITY INVOKER` (runs under the calling client's context, respecting table RLS policies).
- **Search Path**: Explicitly set to `public`.
- **Access Privilege**: Default public execute privilege is revoked; execution is granted only to the `authenticated` role.
- **No SECURITY DEFINER**: Verified (no security definer advisor warnings created).

---

## Repository Changes

`SupabaseTreatmentPlansRepository` was modified to use the database-side RPC:
- **`createTreatmentPlan`**:
  - Validates the patient ID UUID.
  - Automatically generates safe UUIDs for local/temporary plan and stage IDs.
  - Filters out invalid/non-UUID finding IDs.
  - Calls `save_treatment_plan_with_stages` RPC in a single operation.
- **`updateTreatmentPlan`**:
  - Validates the plan and patient UUIDs.
  - Converts stage IDs (generating safe UUIDs for new stages).
  - Calls the same `save_treatment_plan_with_stages` RPC in a single operation.
- **LocalStorage Repository**: Remains completely unchanged, maintaining dev fallback behavior.
- **Delete Logic**: The existing foreign key cascade remains in place to delete stages when a plan is deleted.

---

## Transaction/Sync Behavior

- **Deletion**: Stages absent from the submitted payload are deleted from the database.
- **Update**: Existing stages belonging to the same tenant and plan are updated.
- **Insertion**: New stages are inserted, keeping their `order_index` consistent with the submitted array order.
- **Ownership**: The RPC validates plan/tenant ownership and rejects stage IDs belonging to another tenant or plan.

---

## Tests Added/Updated

The repository test suite in [TreatmentPlansRepository.test.ts](file:///d:/Users/User/Documents/GitHub/codex-test/src/data/repositories/TreatmentPlansRepository.test.ts) was updated:
1. **Supabase create**: Verifies that the new RPC is invoked once with correctly mapped params, safe UUIDs are generated for local IDs, and invalid finding IDs are filtered out.
2. **Supabase update**: Verifies that the RPC is called once with the submitted stages, and throws if the RPC returns an error.
3. **Stage deletion regression**: Verifies that updating a plan with a subset of stages passes only the submitted stages to the RPC, delegating deletion of the missing ones.
4. **LocalStorage**: Verifies that local persistence remains intact.
5. **Mapping**: Verifies that listing plans sorts stages by `order_index`.

---

## Local Supabase Validation

- Ran `npx supabase db reset` to apply all migrations including `0006_treatment_plan_stage_sync_rpc.sql`.
- **Create validation**: Called the RPC directly via SQL using a test plan ID and two stages. Verified both stages were inserted correctly.
- **Update validation**: Updated the test plan with only one stage. Verified that the missing stage was deleted from the database.
- **Insert validation**: Updated the test plan again with the existing stage and one new stage. Verified correct order indices and row counts.
- **Cascade validation**: Deleted the plan and confirmed both stages were deleted automatically.

---

## Browser Smoke Validation

- Logged in as Admin A (`qa.admin.a@example.local` — local QA password used, not documented).
- Navigated to `/patients/44444444-4444-4444-4444-444444444444` (John Doe).
- Opened **Планы лечения** (Treatment plans) tab.
- Clicked **Новый план**, filled in title `"Plan X"`, and added two stages:
  - Stage 1: price `5000`
  - Stage 2: price `7000`
- Clicked **Сохранить**. Verified "Plan X" renders with `2` stages and sum `12 000 ₸`.
- Clicked **Редактировать** on "Plan X", clicked delete on Stage 2, and clicked **Сохранить**. Verified "Plan X" renders with `1` stage and sum `5 000 ₸`.
- Reloaded the page, switched to the Plans tab, and verified that Stage 2 did NOT reappear.
- Clicked **Удалить** on "Plan X" and accepted the confirmation dialog. Verified it was deleted.

---

## Cloud Safety

- Migration `0006` was **NOT** applied to the Supabase cloud instance.
- No cloud database writes were executed.

---

## What was intentionally NOT changed

- No changes or redesigns in UI components (`TreatmentPlanModal`, etc.).
- No changes to hooks (`useTreatmentPlans`, etc.).
- No changes to `supabase/seed.sql` or database schema.
- No unrelated RLS changes.

---

## Remaining Known Issues

- Cloud migration `0006` needs to be applied in a follow-up task.
- Advisor warnings about other `SECURITY DEFINER` functions in the initial schema.
- Global role label displaying "Администратор" for doctors (tracked as `ROLE-LABEL-UX-001`).

---

## Checks

- `git status --short`:
  ```
  M _ai_work/REPORTS/TREATMENT-STAGES-SYNC-TRANSACTION-001_stage_sync_transaction.md
  ```
- `npm run lint`: **PASS** (Zero warnings or errors).
- `npm run test -- --run`: **PASS** (All 268 tests pass with `.env.local` temporarily moved during tests).
- `npm run build`: **PASS** (Project builds cleanly).
- `GitHub Actions CI result`: **PASS** (Workflow CI, run #375, run id 27535774702, head d5b76fc2eadcc67bed3497931dbb8085e996d0c9).

---

## Final Verdict

**READY FOR REVIEW**

---

## Recommended Next Task

**SUPABASE-CLOUD-APPLY-0006-TREATMENT-STAGES-001**: Apply migration 0006 to dev/test cloud after preflight confirmation.
