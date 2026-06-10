# DOCUMENTS-RECON-001: Documents, Preview, and Treatment Plan Print Layer

## 1. Summary
Performed a strict report-only reconnaissance of the codebase to assess the feasibility of implementing documents, previewing, and printing functionality. Evaluated the existing components, types, repositories, and Supabase schema. Concluded that a non-persisted print preview for Treatment Plans is the safest, highest-value MVP to start with, requiring no architectural blockers or schema migrations.

## 2. Scope
- Inspected codebase (`src/*`) and `supabase/migrations/0001_initial_schema.sql`.
- Identified current print/export capabilities and dependencies.
- Investigated patient, findings, and treatment plan source data.
- Ran tests and build checks.
- Adhered strictly to report-only rules (no implementation or fixes).

## 3. Files inspected
- `src/pages/DocumentsPage.tsx`
- `src/components/treatment/TreatmentPlanPatientPreview.tsx`
- `src/components/treatment/TreatmentPlansTab.tsx`
- `supabase/migrations/0001_initial_schema.sql`
- `package.json`

## 4. Reports inspected
- `_ai_work/REPORTS/TREATMENT-DELETE-REAL-001A_supabase_safe_treatment_plan_deletion_implementation.md`
- `_ai_work/REPORTS/TREATMENT-DELETE-REAL-001B_real_browser_qa_supabase_delete_cleanup.md`

## 5. Commands run
- `npm run lint`
- `npm run build`
- `npm test -- --run`

## 6. Command results
- **npm run lint:** PASS
- **npm run build:** PASS
- **npm test:** FAIL (1 test failed: `src/contexts/AuthContext.test.tsx` expected `authMode` to be `'dev'`, but received `'supabase-active'`. This is a lingering side-effect in `.env.local` from a previous QA step. Per instructions, it was NOT fixed.)

## 7. Current document module state
- **Module existence:** A dedicated document module does not yet exist.
- **UI:** Only a placeholder page (`src/pages/DocumentsPage.tsx`) exists.
- **Models:** No types/models dedicated to documents currently exist in the frontend (`src/types`).
- **Repositories/Hooks:** No local or Supabase-backed repositories or hooks are implemented for documents.

## 8. Current print/export state
- **Print buttons:** No wired print or export buttons exist anywhere.
- **Browser print:** No usage of `window.print()` was found.
- **Libraries:** No external libraries (like `jsPDF`, `html2canvas`, or `react-to-print`) are installed.
- **Package changes:** Exporting to PDF or DOCX would require installing new dependencies. 

## 9. Existing document-related UI actions
- In `TreatmentPlansTab.tsx`, there is an existing button "Предпросмотр для пациента" (Preview for patient).
- This button successfully opens the `TreatmentPlanPatientPreview.tsx` modal, which renders a patient-friendly visual layout of the treatment plan, but currently offers no way to print or export it.
- There is a disabled "amoCRM" integration button.

## 10. Existing document-related models/types
- No specific document interfaces exist.

## 11. Existing document-related repositories/hooks
- None.

## 12. Supabase schema/RLS/storage analysis
- **Schema:** A `documents` table exists in `0001_initial_schema.sql`. It contains metadata (`tenant_id`, `patient_id`, `file_name`, `file_size`, `file_type`, `storage_path`).
- **RLS:** Policies exist for the `documents` table ensuring tenant isolation and role restrictions ("Only admins can delete docs").
- **Storage:** There are **NO** Supabase storage buckets defined in the schema for actual file storage. 

## 13. Treatment plan data available for documents
The following `TreatmentPlan` properties are available and safe for output:
- `plan.title`
- `plan.status`
- `plan.createdAt`
- `plan.stages` (title, description, teeth, price, status)
- `plan.totalPrice`

## 14. Patient data available for documents
- `patient.fullName`
- `chiefComplaint.text`
- `chiefComplaint.relatedTeeth`

## 15. Findings/dental chart data available for documents
Linked findings (`DentalFinding`) provide rich diagnostic context:
- `finding.toothNumber`
- `finding.title` (category)
- `finding.description`
- `finding.riskDescription`
- `finding.recommendation`
- `finding.severity`

## 16. Medical/domain safety constraints
- The `TreatmentPlanPatientPreview` correctly includes an `IMPORTANT_NOTE` explicitly stating: "План лечения является предварительным и может быть уточнён врачом после осмотра, снимков или дополнительных данных."
- The UI properly distinguishes between complaints and findings.
- Total price is labeled as "Ориентировочная итоговая стоимость".
- No billing invoices, payments, or appointments are created during preview generation.

## 17. First MVP document recommendation
**Treatment Plan Preview / Print View**
- **Reason:** The data structure is fully realized. The `TreatmentPlanPatientPreview` modal already organizes the exact data needed. Implementing a simple print action (via `window.print()`) provides immediate business value for clinic workflows without requiring complex PDF libraries or legal document signatures.

## 18. Non-persistent preview/print feasibility
- **Feasible.** Can be implemented purely client-side utilizing CSS `@media print` rules and `window.print()` directly from the existing preview modal. No storage or schema requirements.

## 19. Persisted documents feasibility
- **Not feasible yet.** Persisting documents requires configuring a Supabase storage bucket (which doesn't exist) and implementing backend storage APIs. This should be deferred.

## 20. Risks and blockers
- **Architecture blockers:** None for a non-persisted preview. Data models safely isolate and supply what is needed.
- **Risks:** Browser print variations might require careful CSS tuning.

## 21. Recommended implementation strategy
- Update `TreatmentPlanPatientPreview` to include a "Распечатать" (Print) button.
- Add print-specific CSS (`@media print`) to hide navigation, backgrounds, and shadows, formatting the modal content cleanly for A4 paper.
- Avoid introducing new dependencies or database modifications.

## 22. Recommended next task
**DOCUMENTS-REAL-001A — Implement non-persistent Treatment Plan Preview/Print**

## 23. What was NOT changed
- no src/* files were changed;
- no tests were changed;
- no UI was redesigned;
- Header was not changed;
- no buttons were removed;
- no buttons were disabled;
- no document generation was implemented;
- no print/export was implemented;
- no PDF/DOCX library was added;
- no Supabase migrations were changed;
- no RLS policies were changed;
- no storage buckets were changed;
- no seed data was changed;
- no package files were changed;
- no .env files were committed;
- no treatment plan logic was changed;
- no findings logic was changed;
- no dental chart logic was changed;
- no patient model was changed;
- no appointment logic was changed;
- no billing/payment logic was implemented;
- no completed services were implemented;
- no browser QA was performed.

## 24. Final verdict
**READY FOR DOCUMENTS-REAL-001A**
