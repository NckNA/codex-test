# ARCH-010: Review of History Decoupling and Hook Utility Direction

## 1. Scope
This report reviews the completion of the `PatientHistoryTab` decoupling through `ARCH-007` and `ARCH-009`. It evaluates the structural consistency across the three existing data-access hooks, identifies accumulating boilerplate, and proposes a plan for abstracting these patterns before tackling more complex application modules.

## 2. Inputs Reviewed
- `_ai_work/REPORTS/ARCH-005_chief_complaint_adapter_hook_slice_report.md`
- `_ai_work/REPORTS/ARCH-007_patient_history_appointments_hook_report.md`
- `_ai_work/REPORTS/ARCH-009_patient_history_doctors_hook_report.md`
- `src/data/repositories/ChiefComplaintRepository.ts`
- `src/data/hooks/useChiefComplaint.ts`
- `src/data/repositories/AppointmentRepository.ts`
- `src/data/hooks/usePatientAppointments.ts`
- `src/data/repositories/DoctorRepository.ts`
- `src/data/hooks/useClinicDoctors.ts`
- `src/components/patients/patient-card/PatientHistoryTab.tsx`
- `src/pages/PatientCardPage.tsx`

## 3. PatientHistoryTab Decoupling Status
`PatientHistoryTab` is now **fully decoupled** from parent data arrays.
- It no longer receives `appointments` or `doctors` via props.
- It only receives `patientId` to establish context.
- It asynchronously loads its required datasets using `usePatientAppointments` and `useClinicDoctors`.
- The global data state (`PatientCardPage` summaries, `PatientOverviewTab`) remained entirely untouched and stable during this transition.

## 4. Current Repository/Hook Slices Summary
We currently have three migrated slices:
1. **Chief Complaint:** Single object, patient-scoped. Contains read and write operations (`fetchComplaint`, `saveComplaint`).
2. **Appointments:** Array, patient-scoped. Read-only operation so far.
3. **Doctors:** Array, clinic/global-scoped. Read-only operation so far.

## 5. Hook Pattern Comparison
All three hooks strictly follow a common pattern:
- Define states for `isLoading`, `isError`, and `error`.
- Provide an initial `useEffect` to fetch data on mount using a `mounted` flag to prevent state updates on unmounted components.
- Provide a `refetch` or mutation function wrapped in `useCallback` that manually updates the loading and error states using `try/catch/finally`.
- Call a corresponding `Repository` class method that resolves a `Promise`.

## 6. Duplicated Boilerplate Found
The identical implementation of state variables across all hooks has created significant boilerplate:
- `const [isLoading, setIsLoading] = useState(true);`
- `const [isError, setIsError] = useState(false);`
- `const [error, setError] = useState<Error | null>(null);`
- `let mounted = true; ... return () => { mounted = false; };`
- Repeated `try/catch/finally` blocks inside both the `useEffect` and `useCallback` functions.

## 7. Important Differences Between Hooks
- **Scope:** `useChiefComplaint` and `usePatientAppointments` require a `patientId` guard to execute, while `useClinicDoctors` fetches clinic-wide data globally.
- **Mutations:** `useChiefComplaint` includes a `saveComplaint` method and tracking for `isSaving`. The other two are strictly read-only.
- **Invalidation:** None of the current hooks support cross-invalidation (e.g., if a new appointment is created, the appointment hook has no mechanism to auto-refresh other than calling its manual `refetch`).

## 8. Risks if Migrations Continue Without Shared Pattern
If we proceed to migrate complex slices like the Dental Chart (which has 32 teeth and multiple states) or Findings/Treatment Plans (which interlock and require cross-invalidation), the current boilerplate will explode. Code readability and maintainability will drop, and adding consistent caching or invalidation retroactively will be exceedingly difficult.

## 9. Options Comparison
- **Option A (Continue migrating immediately):** Bad. It propagates boilerplate into the most complex areas of the application.
- **Option B (Implement a tiny shared async hook utility):** Good. Standardizes the loading/error/mounted boilerplate internally without adding external dependencies.
- **Option C (Define conventions only, no code):** Ineffective. Boilerplate must be structurally reduced.
- **Option D (Introduce React Query):** Premature. We are explicitly constrained from adding heavy third-party state managers right now.
- **Option E (Stop frontend migration, move to backend):** Premature. The frontend Data Access Layer must be stabilized to define clear API boundaries first.

## 10. Recommended Direction
**ARCH-011 — Design a minimal shared async hook utility/convention for local repository calls before migrating more features.**

## 11. What Must NOT Be Done Next
- Do **NOT** migrate Findings, Dental Chart, Treatment Plans, or Overview.
- Do **NOT** introduce React Query or global state managers.
- Do **NOT** begin backend API implementation.

## 12. Acceptance Criteria for Future ARCH-011
- Design a generic utility (e.g., `useAsync` or `useQueryLike`) that abstracts `isLoading`, `isError`, `error`, and `mounted` logic.
- Ensure the design supports both read-only queries and future mutations.
- The design must not use external libraries.
- The design should reduce hook boilerplate by >50%.

## 13. Recommended Next Task
**ARCH-011 — Design minimal shared async hook utility/convention for repository-backed hooks.**
