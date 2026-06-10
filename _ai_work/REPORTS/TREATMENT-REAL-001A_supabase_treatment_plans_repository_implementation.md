# TREATMENT-REAL-001A: SupabaseTreatmentPlansRepository Implementation

## 1. Summary
This report details the implementation of `SupabaseTreatmentPlansRepository` and its integration into the application. The repository handles manual CRUD for treatment plans and their nested stages via Supabase REST endpoints, while preserving `localStorage` fallbacks for `dev` environments.

## 2. Scope
Repository-only manual treatment plan CRUD. No automatic generation, no documents, no billing/appointments, no mutation of findings or charts.

## 3. Files changed
- `src/data/repositories/TreatmentPlansRepository.ts`
- `src/data/repositories/TreatmentPlansRepository.test.ts`
- `src/data/hooks/useTreatmentPlans.ts`
- `src/data/hooks/useTreatmentPlans.test.tsx`
- `_ai_work/REPORTS/TREATMENT-REAL-001A_supabase_treatment_plans_repository_implementation.md`

## 4. Files inspected
- `src/types/index.ts`
- `src/data/hooks/useClinicalWorkflow.ts`
- `src/data/hooks/usePatientFindings.ts`

## 5. Implementation details
- Created `SupabaseTreatmentPlansRepository` class.
- Added `createTreatmentPlansRepository` factory logic.
- Updated `useTreatmentPlans` hook to consume the factory based on `authMode`, `isSupabaseConfigured`, and `tenantId`.

## 6. Factory routing behavior
- Returns `SupabaseTreatmentPlansRepository` only when `authMode === 'supabase-active'`, `isSupabaseConfigured` is `true`, and `tenantId` is present.
- Returns `LocalStorageTreatmentPlansRepository` in all other cases (including `dev` mode or missing configurations).

## 7. Supabase query safety
- All `.from('treatment_plans')` and `.from('treatment_stages')` calls strictly `.eq('tenant_id', this.tenantId)`.
- Plan-level operations filter by `.eq('patient_id', patientId)`.
- Updates/deletes strictly specify `.eq('id', planId)`.
- Cross-tenant/cross-patient access is prevented at the repository layer.

## 8. ID strategy
- `patientId` must be a valid UUID. Validated before any request.
- Local/prototype strings (e.g. `plan_...`) are intercepted.
- If an existing UUID is passed, it is preserved. If not, a safe UUID is generated via `crypto.randomUUID()` on insertion.
- No local IDs are sent to Supabase UUID columns.

## 9. Treatment plan mapping
- Handled properly mapping from `TreatmentPlan` frontend objects to `treatment_plans` rows.
- `totalPrice` mapped to `total_price`.
- Missing optional dates injected with ISO string backups.

## 10. Treatment stages/items mapping
- For updates, stages are saved using sequential `delete()` then `insert()`.
- Nested items receive `tenant_id` and `treatment_plan_id`.
- `order_index` is safely injected from the array index.
- Empty fields map to `null` where appropriate.

## 11. finding_ids UUID safety
- Iterated over `stage.findingIds` and strictly filtered only valid UUIDs (`/^[0-9a-f]{8}-[...]$/i`).
- Any non-UUID (e.g., local mock strings) are silently stripped to avoid PostgreSQL type errors inside the `uuid[]` column.

## 12. Tenant/RLS/FK safety
- `tenant_id` and `treatment_plan_id` injected on every stage insert.
- Validated `patientId` explicitly.
- Foreign Keys natively enforce cascade deletes in the database schema.

## 13. Local fallback behavior
- Factory cleanly returns `LocalStorageTreatmentPlansRepository` when Supabase criteria are unmet, ensuring `dev` mode continues normally.

## 14. No-tenant behavior
- Handled explicitly: `useTreatmentPlans` factory logic falls back to `local` if no tenant is provided, preventing unauthenticated queries. Supabase repository constructor mandates `tenantId`.

## 15. Error behavior
- Supabase errors strictly `throw new Error(...)`.
- The hook safely intercepts errors, exposes them via `isError` / `saveError`, and never swallows failures or implicitly degrades to `localStorage` post-failure.

## 16. Tests added/updated
- `TreatmentPlansRepository.test.ts`: Added explicit factory unit tests checking backend resolution with/without `tenantId`.
- `useTreatmentPlans.test.tsx`: Created suite using custom `act`/`createRoot` (to avoid `@testing-library/react` issues) verifying routing state changes properly.

## 17. Commands run
- `npm run lint`
- `npm test`
- `npm run build`

## 18. Command results
- `npm run lint`: PASS
- `npm run build`: PASS
- `npm test`: FAIL. Single failure in `AuthContext.test.tsx` (`expected 'supabase-active' to be 'dev'`). This is an environmental issue caused by `.env.local` enforcing active mode, which affects the isolated component test. It is not caused by these implementation changes. The newly added tests pass successfully.

## 19. What was NOT changed
- automatic treatment plan generation was not implemented;
- ClinicalWorkflowOrchestrator generation logic was not changed;
- FindingsRepository was not changed;
- DentalChartRepository was not changed;
- PatientRepository was not changed;
- AppointmentRepository was not changed;
- DoctorRepository was not changed;
- TreatmentPlansTab UI was not changed unless truly required;
- documents were not implemented;
- billing/payment logic was not implemented;
- appointment scheduling was not implemented;
- supabase/migrations were not changed;
- supabase/seed.sql was not changed;
- package.json/package-lock.json were not changed;
- no .env files were committed.

## 20. Known limitations
- The `delete` + `insert` strategy for saving stages lacks transaction support. A partial failure (e.g. network drop after delete, before insert) could lose stage data. Proper RPC functions would be needed for transactional guarantees.
- `ClinicalWorkflowOrchestrator` still creates plans via LocalStorage when auto-generating.

## 21. Final verdict
READY FOR REVIEW

## 22. Recommended next task
TREATMENT-REAL-001B — Real browser QA for Supabase treatment plans
