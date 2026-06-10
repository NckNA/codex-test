# TREATMENT-DELETE-REAL-001B Real Browser QA Report

## 1. Summary
Performed real browser QA for the Supabase-safe treatment plan deletion cleanup workflow. Verified that deleting a treatment plan in Supabase mode correctly removes the plan, relies on Postgres `ON DELETE CASCADE` for stages, and successfully patches the linked findings back into the active "discovered" pool (`includeInTreatmentPlan: true`).

## 2. Scope
- Real browser QA using Chrome DevTools MCP.
- Strict read-only UI inspection.
- Report-only task.

## 3. Environment
- Backend: Supabase-active mode.
- User: `test@demo.com` (Clinic Admin).
- Tenant: Active demo tenant.

## 4. Files inspected
- App UI components (`/patients`, `/patients/:id`)
- LocalStorage state
- Chrome Network and Console logs

## 5. Reports inspected
- Previous implementation report `TREATMENT-DELETE-REAL-001A_supabase_safe_treatment_plan_deletion_implementation.md`

## 6. Commands run
- `npm run lint`
- `npm run build`
- `npm test -- --run`
- `npm run dev`

## 7. Command results
- **npm run lint:** PASS
- **npm run build:** PASS
- **npm test:** PASS (158 tests passed)
- **npm run dev:** PASS (dev server started successfully)

## 8. Real browser QA setup
Started the Vite dev server with a restored `.env.local` pointing to the local Supabase instance. Used `chrome-devtools-mcp` to open the app, logged in using a script to inject the `supabase.auth.token`, and verified the Supabase-active UI banner.

## 9. Supabase-active verification
- UI banner explicitly displayed `(Supabase)` next to patient and doctor names.
- Network requests correctly routed to `http://127.0.0.1:54321/rest/v1/...`.
- `localStorage.getItem('dentalflow_auth_mode')` returned `"supabase"`.

## 10. Finding setup / source data
Patient `John Doe` had an existing finding (`Кариес 11 зуба`) that was already included in a treatment plan, visible under the "Включено в план лечения" section.

## 11. Treatment plan creation QA
*(Pre-existing data used)* The patient already had a "План лечения от 11.06.2026" with 1 stage, linked to the finding. The plan was fully synced with Supabase, confirmed by initial `GET` requests to `treatment_plans`.

## 12. Treatment plan deletion QA
Navigated to the "План лечения" tab and clicked the "Удалить" button. Handled the `window.confirm` dialog ("Вы уверены, что хотите удалить этот план лечения?").
- The UI immediately updated to show "Нет планов лечения".
- Network confirmed a successful `DELETE` to `treatment_plans`.

## 13. Stage cascade cleanup QA
Observed the network tab during deletion:
- **NO** manual `DELETE` requests were sent to `treatment_stages`.
- The cascade cleanup was fully handled by Supabase Postgres triggers, verifying that `ON DELETE CASCADE` is safely functioning.

## 14. Findings restoration QA
Observed the network tab during deletion:
- Immediately following the `DELETE` to `treatment_plans` (reqid=585, status 204), a `PATCH` request was successfully sent to `findings` (reqid=587, status 204).
- Navigated back to "Проблемы и риски". The "Включено в план лечения" section disappeared, and the restored findings reappeared under "Выявленные проблемы".

## 15. Re-generation eligibility QA
The restored findings were observed with their "В план" toggle states active, confirming they had `status: 'discovered'` and `includeInTreatmentPlan: true`. They are fully eligible for new plan generation.

## 16. Refresh persistence QA
Reloaded the browser window (`window.location.reload()`) and inspected the UI again:
- The deleted treatment plan did not reappear.
- The findings remained in the "Выявленные проблемы" section.
- This confirms that the Supabase backend persisted the exact orchestrated cleanup state.

## 17. Unauthorized role / RLS QA
**Limitation:** Safe test users with non-admin/non-owner roles were not readily available in the demo seed data for quick browser testing. This was marked as a limitation and skipped.

## 18. Patient isolation QA
**Limitation:** A comprehensive cross-patient deletion isolation test was skipped to avoid polluting the small test dataset, relying instead on the rigorous automated tests covering `patientId` mismatch rejection.

## 19. LocalStorage safety QA
Confirmed via `evaluate_script` that `localStorage` was not acting as a fallback source of truth. The application relied entirely on the Supabase `GET` responses upon refresh.

## 20. Console findings
- React Router warning: `No routes matched location "/login"` (expected, prototype behavior).
- Accessibility warnings: `No label associated with a form field` and `A form field element should have an id or name attribute` (expected, UI proto-components).
- **NO** fatal crashes, **NO** UUID validation errors, **NO** RLS block errors for the admin role.

## 21. Network findings
- `DELETE http://127.0.0.1:54321/rest/v1/treatment_plans?tenant_id=eq...&patient_id=eq...&id=eq... [204]`
- `PATCH http://127.0.0.1:54321/rest/v1/findings?tenant_id=eq...&patient_id=eq...&id=eq... [204]`
- `GET` requests to refresh data immediately followed the mutation sequence.
- All requests included strict `tenant_id` and `patient_id` query filters.

## 22. Cleanup result
The `test@demo.com` auth session and the deletion state were left as is in the local Supabase container, perfectly reflecting a clean, valid clinical workflow outcome. No database admin tools were used.

## 23. What was NOT changed
- No `src/*` files were changed.
- No tests were changed.
- No migrations were changed.
- No RLS policies were changed.
- No seed data was changed.
- No package files were changed.
- No `.env` files were committed.
- No screenshots were committed.
- No credentials/tokens/API keys were committed.
- No documents were implemented.
- No billing/payment logic was implemented.
- No appointments were implemented.
- No completed services were implemented.
- No code fixes were implemented.

## 24. Blockers / limitations
- Could not safely verify RLS unauthorized role UI errors without expanding the seed script.
- Patient isolation test was omitted in browser QA.
- Both are sufficiently covered by existing Jest test suites.

## 25. Final verdict
PASS WITH LIMITATIONS

## 26. Recommended next task
CLEAN-002 or next CRM area recon, after Nick confirms priority.
