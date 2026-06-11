# PROJECT-AUDIT-BACKFILL-003: Domain repositories reconciliation

## Status

Report-only reconciliation.

This report reconciles the historical reports for the first migrated domain repositories with the current `main` branch.

Scope:

- PatientRepository
- ChiefComplaintRepository
- DoctorRepository
- AppointmentRepository

Out of scope:

- FindingsRepository
- DentalChartRepository
- TreatmentPlansRepository
- Treatment generation
- UI redesign
- new code changes
- new migrations

## Why this report exists

The project has moved through several small repository migrations. Early reports are still useful, but they were written before later migrations changed the dependency graph.

This report marks which old claims remain valid, which are now superseded, and what must be used as the current source of truth for future tasks.

The goal is not to delete the old reports. The goal is to label them so future work does not use an outdated map as if it were the current wiring diagram.

## Status labels

- `VALID`: still accurate and safe to use.
- `PARTIALLY VALID`: still useful, but only with updated context.
- `SUPERSEDED`: replaced by later implementation or QA.
- `STALE`: historical only; do not use as current architecture.
- `DANGEROUS IF USED`: may cause a wrong task or unsafe implementation if treated as current truth.

---

# 1. Current branch baseline

Current checked baseline:

- latest relevant checkpoint before this report: PR #216, `PROJECT-AUDIT-BACKFILL-002`
- base merge commit: `cb7d39426303ba445146a01274855357e5c1fb57`
- current task branch: `audit-domain-repos-001`

This report was created after:

- `PROJECT-AUDIT-BACKFILL-001`
- `PROJECT-AUDIT-BACKFILL-002`

So this report assumes that the foundation and auth/tenant backfill statuses are already part of `main`.

---

# 2. Reports reconciled

## Patient reports

- `_ai_work/REPORTS/RECON-PATIENT-REAL-001_patient_repository_supabase_migration_plan.md`
- `_ai_work/REPORTS/PATIENT-REAL-001A_supabase_patient_repository_report.md`
- `_ai_work/REPORTS/PATIENT-REAL-001B_supabase_patient_repository_browser_qa.md`

## ChiefComplaint reports

- `_ai_work/REPORTS/RECON-CHIEF-REAL-001_chief_complaint_supabase_migration_plan.md`
- `_ai_work/REPORTS/CHIEF-REAL-001A_supabase_chief_complaint_repository_report.md`
- `_ai_work/REPORTS/CHIEF-REAL-001B_supabase_chief_complaint_browser_qa.md`

## Doctor reports

- `_ai_work/REPORTS/RECON-DOCTOR-REAL-001_doctor_data_source_alignment_plan.md`
- `_ai_work/REPORTS/DOCTOR-REAL-001A_supabase_doctor_repository_report.md`
- `_ai_work/REPORTS/DOCTOR-REAL-001B_supabase_doctor_source_browser_qa.md`
- `_ai_work/REPORTS/DOCTOR-REAL-001C_real_browser_qa_supabase_doctor_source.md`

## Appointment reports

- `_ai_work/REPORTS/RECON-APPOINTMENT-REAL-001_appointment_repository_supabase_migration_plan.md`
- `_ai_work/REPORTS/RECON-APPOINTMENT-REAL-002_post_doctor_qa_appointment_migration_plan.md`
- `_ai_work/REPORTS/APPOINTMENT-REAL-001A_supabase_appointment_repository_report.md`
- `_ai_work/REPORTS/APPOINTMENT-REAL-001B_real_browser_qa_supabase_appointments.md`

---

# 3. Current code inspection summary

## 3.1 PatientRepository

Current file:

- `src/data/repositories/PatientRepository.ts`

Current status:

- Has `LocalStoragePatientRepository`.
- Has `SupabasePatientRepository`.
- Has `createPatientRepository({ backend, tenantId })` factory.
- Supabase reads and writes use `tenant_id`.
- `listPatients()` filters by `tenant_id` and orders by `created_at` descending.
- `getPatientById()` filters by `tenant_id` and `id`.
- `createPatient()` inserts `tenant_id`.
- `updatePatient()` filters by `tenant_id` and `id`.

Current hooks:

- `src/data/hooks/usePatientsCollection.ts`
- `src/data/hooks/usePatientProfile.ts`

Current hook routing:

```ts
const backend = authMode === 'supabase-active' && activeTenant?.tenantId && isSupabaseConfigured
  ? 'supabase'
  : 'local';
```

Current verdict:

- PatientRepository is migrated to Supabase-aware routing.
- localStorage fallback remains active.
- Patient UUID strategy is current baseline.
- Patient is safe to use as a migrated domain baseline for future patient-related tasks.

Important limitation:

- This does not mean all patient-adjacent domains are migrated.
- A patient can now be Supabase-backed while some related medical modules may still be localStorage or hybrid.

## 3.2 ChiefComplaintRepository

Current file:

- `src/data/repositories/ChiefComplaintRepository.ts`

Current status:

- Has `LocalStorageChiefComplaintRepository`.
- Has `SupabaseChiefComplaintRepository`.
- Has `createChiefComplaintRepository({ backend, tenantId })` factory.
- Supabase read filters by `tenant_id` and `patient_id`.
- Supabase write uses upsert with conflict key `tenant_id,patient_id`.
- `relatedTeeth` maps to `related_teeth`.

Current hook:

- `src/data/hooks/useChiefComplaint.ts`

Current hook routing:

```ts
const backend = authMode === 'supabase-active' && activeTenant?.tenantId && isSupabaseConfigured
  ? 'supabase'
  : 'local';
```

Current verdict:

- ChiefComplaintRepository is migrated to Supabase-aware routing.
- localStorage fallback remains active.
- The old FK blocker from local-only PatientRepository is superseded by PatientRepository migration.

Important limitation:

- Chief complaints still depend on a valid Supabase patient row in Supabase mode.
- Future code must not pass local-only patient IDs into Supabase chief complaints.

## 3.3 DoctorRepository

Current file:

- `src/data/repositories/DoctorRepository.ts`

Current status:

- Has `LocalStorageDoctorRepository`.
- Has `SupabaseDoctorRepository`.
- Has `createDoctorRepository({ backend, tenantId })` factory.
- Supabase queries filter by `tenant_id`.
- Supabase doctor repository is read-only from frontend perspective.

Current hook:

- `src/data/hooks/useClinicDoctors.ts`

Current hook routing:

```ts
const backend = (authMode === 'supabase-active' && activeTenant?.tenantId && isSupabaseConfigured)
  ? 'supabase'
  : 'local';
```

Current verdict:

- DoctorRepository is migrated to Supabase-aware read source.
- local dev still uses legacy doctor IDs such as `d1`, `d2`.
- Supabase-active mode uses UUID doctors.
- This removes the historical UUID blocker for AppointmentRepository.

Important limitation:

- There is still no doctor administration UI in this scope.
- New clinics without seeded doctors may have empty schedule columns until doctor management is implemented.

## 3.4 AppointmentRepository

Current file:

- `src/data/repositories/AppointmentRepository.ts`

Current status:

- Has `LocalStorageAppointmentRepository`.
- Has `SupabaseAppointmentRepository`.
- Has `createAppointmentRepository({ backend, tenantId })` factory.
- Supabase list queries filter by `tenant_id`.
- Supabase create inserts `tenant_id`.
- Supabase update/delete filter by `tenant_id` and `id`.
- `patientId` maps to `patient_id` with empty/missing values normalized to `null`.
- `doctorId` maps to `doctor_id`.
- `paymentType`, `source`, `comment`, and `price` are normalized for nullable DB fields.
- Appointment IDs are normalized to UUID when needed.
- Appointment time handling uses clinic-local wall-clock preservation through DB/string normalization.

Current hook:

- `src/data/hooks/useScheduleAppointments.ts`

Current hook routing:

```ts
backend: (authMode === 'supabase-active' && activeTenant?.tenantId && isSupabaseConfigured)
  ? 'supabase'
  : 'local'
```

Current verdict:

- AppointmentRepository is migrated to Supabase-aware routing.
- real browser QA exists for schedule appointment flows.
- localStorage fallback remains active.

Important limitation:

- AppointmentRepository being migrated does not mean TreatmentPlans, DentalChart, Findings, or billing are all aligned.
- Some clinical modules may still not share a single backend path with Appointment.

---

# 4. Historical report reconciliation

## 4.1 RECON-CHIEF-REAL-001

Old claim:

- ChiefComplaintRepository was localStorage-backed.
- It was ready for a first small Supabase repository migration.
- FK risk existed because PatientRepository was not yet migrated.

Current main:

- ChiefComplaintRepository now has Supabase support.
- PatientRepository is now also Supabase-aware.
- The original FK risk for newly created UI patients is superseded by PatientRepository migration.

Status:

- `SUPERSEDED` as a current implementation plan.
- `VALID` as historical reasoning for why ChiefComplaint was migrated first.

New note:

- Use `CHIEF-REAL-001A` and `CHIEF-REAL-001B` as the current baseline, not the original recon.

Risk if used incorrectly:

- Treating the old FK blocker as still active would wrongly delay ChiefComplaint or Patient work.

## 4.2 CHIEF-REAL-001A

Old claim:

- SupabaseChiefComplaintRepository implemented.
- Factory/hook routing added.
- localStorage fallback preserved.
- PatientRepository was not touched.
- Browser QA still required.

Current main:

- Implementation remains aligned with current code.
- PatientRepository has since been migrated.
- Browser QA was later completed.

Status:

- `PARTIALLY VALID`.

New note:

- Use as implementation history, not as final QA status.
- The limitation about PatientRepository being local-only is now superseded.

## 4.3 CHIEF-REAL-001B

Old claim:

- Real browser QA passed for Supabase ChiefComplaint using seeded patient.
- No-tenant gate blocked access.
- Dev fallback worked.
- FK failure for new local-only patients was expected.

Current main:

- ChiefComplaint browser QA remains valid as evidence.
- The FK limitation is superseded because PatientRepository is now migrated.

Status:

- `PARTIALLY VALID`.

New note:

- Keep as browser QA evidence for ChiefComplaint.
- Do not use the old local-patient FK failure as a current blocker.

---

## 4.4 RECON-PATIENT-REAL-001

Old claim:

- PatientRepository was localStorage-backed.
- Patient table schema fit was strong.
- Patient modal needed UUID ID generation.
- Appointment, TreatmentPlans, DentalChart remained localStorage.

Current main:

- PatientRepository has Supabase support.
- Patient hooks route by auth/tenant/config.
- Patient UUID generation was implemented.
- AppointmentRepository has since been migrated too.
- TreatmentPlans and DentalChart later moved through separate work and must be reconciled in a later audit pack.

Status:

- `SUPERSEDED` as an implementation plan.
- `PARTIALLY VALID` as historical dependency reasoning.

New note:

- Use `PATIENT-REAL-001A` and `PATIENT-REAL-001B` as current patient baseline.

Risk if used incorrectly:

- Treating Appointment as still local-only from this report is stale; Appointment has its own later migration and QA.

## 4.5 PATIENT-REAL-001A

Old claim:

- SupabasePatientRepository implemented.
- hooks route by auth/tenant/config.
- PatientModal switched to UUID.
- localStorage fallback preserved.
- browser QA still required.

Current main:

- Implementation remains aligned with current code.
- Browser QA was later completed.
- Appointment later migrated, so mixed backend limitation in this report is partly superseded.

Status:

- `PARTIALLY VALID`.

New note:

- Use for implementation facts.
- Use `PATIENT-REAL-001B` for QA evidence.
- Do not treat its mixed Appointment limitation as current without checking the Appointment section.

## 4.6 PATIENT-REAL-001B

Old claim:

- Browser QA passed for PatientRepository.
- Supabase patient create/update/list worked.
- ChiefComplaint FK succeeded for newly created Supabase patient.
- no-tenant blocked.
- dev fallback worked.
- mixed backend issue remained for appointments at that time.

Current main:

- Patient QA remains valid.
- Appointment mixed-backend limitation in this report is now superseded by AppointmentRepository migration and QA.

Status:

- `PARTIALLY VALID`.

New note:

- Keep as patient QA evidence.
- Do not use its Appointment limitation as current truth.

---

## 4.7 RECON-DOCTOR-REAL-001

Old claim:

- DoctorRepository needed Supabase UUID source before AppointmentRepository could safely migrate.
- local doctors used legacy IDs such as `d1`, `d2`.
- Supabase doctors should be seeded with UUIDs.

Current main:

- SupabaseDoctorRepository exists.
- Supabase-active mode uses UUID doctors.
- Dev mode still preserves legacy local doctors.
- AppointmentRepository migration has since happened.

Status:

- `SUPERSEDED` as an implementation blocker.
- `VALID` as historical explanation for sequencing.

New note:

- Use `DOCTOR-REAL-001A` and `DOCTOR-REAL-001C` as current baseline.

## 4.8 DOCTOR-REAL-001A

Old claim:

- SupabaseDoctorRepository implemented.
- Supabase seed gained deterministic UUID doctors.
- local seed remained unchanged.
- AppointmentRepository was not touched.
- browser QA still required.

Current main:

- Implementation remains aligned with current code.
- Browser QA was later completed.
- AppointmentRepository was later migrated.

Status:

- `PARTIALLY VALID`.

New note:

- Use for implementation facts and seed/UUID strategy.
- Use `DOCTOR-REAL-001C` for browser QA evidence.

## 4.9 DOCTOR-REAL-001B

Old claim:

- Intermediate doctor browser QA report existed.

Current main:

- Later `DOCTOR-REAL-001C` is the stronger current QA baseline.

Status:

- `SUPERSEDED` by `DOCTOR-REAL-001C`.

New note:

- Prefer `DOCTOR-REAL-001C` when planning Appointment or Schedule work.

## 4.10 DOCTOR-REAL-001C

Old claim:

- Real Chrome browser QA passed for Supabase doctor source.
- Schedule rendered UUID doctors.
- AppointmentModal opened with UUID doctor ID and cabinet populated.
- dev fallback returned legacy doctors.
- no-tenant user was blocked.

Current main:

- Still valid as QA baseline for doctor source and schedule compatibility.
- AppointmentRepository later built on this foundation.

Status:

- `VALID`.

New note:

- Use as current evidence that doctor UUID source is safe for Schedule and Appointment flows.

---

## 4.11 RECON-APPOINTMENT-REAL-001

Old claim:

- Appointment migration needed planning.
- Doctor UUID blocker was still present.

Current main:

- Doctor UUID blocker was later resolved.
- Appointment migration was replanned in `RECON-APPOINTMENT-REAL-002` and implemented.

Status:

- `SUPERSEDED`.

New note:

- Do not use this as current Appointment plan.
- Use `RECON-APPOINTMENT-REAL-002`, `APPOINTMENT-REAL-001A`, and `APPOINTMENT-REAL-001B`.

## 4.12 RECON-APPOINTMENT-REAL-002

Old claim:

- After Doctor QA, AppointmentRepository was ready for implementation.
- Required UUID IDs, nullable patient_id handling, wall-clock time handling, and delete/RLS awareness.

Current main:

- Its implementation strategy is reflected in `AppointmentRepository.ts` and `useScheduleAppointments.ts`.
- Browser QA later confirmed key flows.

Status:

- `PARTIALLY VALID`.

New note:

- Use as migration design reference.
- Use `APPOINTMENT-REAL-001B` for final QA status.

## 4.13 APPOINTMENT-REAL-001A

Old claim:

- SupabaseAppointmentRepository implemented.
- Factory/hook routing added.
- AppointmentModal generated UUIDs.
- nullable fields handled.
- wall-clock time helpers added.
- browser QA still required.

Current main:

- Implementation remains aligned with current code.
- Browser QA was completed in `APPOINTMENT-REAL-001B`.

Status:

- `PARTIALLY VALID`.

New note:

- Use for implementation details.
- Use `APPOINTMENT-REAL-001B` as QA evidence.

## 4.14 APPOINTMENT-REAL-001B

Old claim:

- Real browser QA passed for Schedule appointments.
- Normal appointment create worked.
- Blocked slot create worked with `patient_id = null`.
- Update worked and persisted after refresh.
- Delete/RLS path worked for the tested admin user.
- Dev fallback worked.
- no-tenant block worked.
- No blocking console errors.

Current main:

- Still valid as QA evidence for AppointmentRepository.

Status:

- `VALID`.

New note:

- This is the current browser QA baseline for appointment scheduling.

---

# 5. Updated domain repository map

## 5.1 Backend routing rule

For the four domains in this report, the current routing rule is consistent:

```text
authMode === 'supabase-active'
AND activeTenant?.tenantId exists
AND Supabase is configured
=> SupabaseRepository

otherwise
=> LocalStorageRepository
```

This applies to:

- PatientRepository
- ChiefComplaintRepository
- DoctorRepository
- AppointmentRepository

## 5.2 Current storage status by domain

| Domain | Current status | Supabase? | localStorage fallback? | Browser QA evidence? |
| --- | --- | --- | --- | --- |
| Patient | migrated | yes | yes | yes |
| ChiefComplaint | migrated | yes | yes | yes |
| Doctor | migrated/read-only | yes | yes | yes |
| Appointment | migrated | yes | yes | yes |

## 5.3 Current ID status

| Entity | Supabase ID expectation | Current source |
| --- | --- | --- |
| Patient | UUID | PatientModal / repository path supports UUID |
| ChiefComplaint | UUID row with patient FK | Supabase row tied to UUID patient |
| Doctor | UUID in Supabase mode, legacy IDs in dev | Supabase seed / local seed split |
| Appointment | UUID | AppointmentModal and repository normalize UUID |

## 5.4 Current tenant boundary status

| Entity | tenant filter present in Supabase repository? |
| --- | --- |
| Patient | yes |
| ChiefComplaint | yes |
| Doctor | yes |
| Appointment | yes |

## 5.5 Current fallback status

The fallback rule is preserved:

- dev/no Supabase config/no active tenant -> localStorage
- supabase-active + active tenant + configured -> Supabase

Important:

The fallback must remain explicit. Future work must not silently remove local fallback unless a separate migration/release task says so.

---

# 6. Current resolved blockers

## 6.1 ChiefComplaint FK blocker

Old blocker:

- ChiefComplaint could fail when patient existed only in localStorage.

Current status:

- Resolved for Supabase-created patients because PatientRepository is now Supabase-aware.

Status:

- `SUPERSEDED`.

## 6.2 Doctor UUID blocker for Appointment

Old blocker:

- Schedule UI used local doctors such as `d1`, incompatible with Supabase `appointments.doctor_id` UUID FK.

Current status:

- Resolved in supabase-active mode by SupabaseDoctorRepository and UUID-seeded doctors.

Status:

- `SUPERSEDED`.

## 6.3 Appointment nullable patient blocker

Old blocker:

- blocked slots could pass empty patient values into UUID columns.

Current status:

- SupabaseAppointmentRepository maps empty/missing `patientId` to `null`.
- Browser QA confirmed blocked slot behavior.

Status:

- `VALIDATED`.

## 6.4 Appointment wall-clock drift risk

Old risk:

- timezone parsing could visually shift appointments.

Current status:

- AppointmentRepository uses a clinic-local wall-clock preservation approach.
- Browser QA confirmed tested behavior.

Status:

- `VALIDATED FOR CURRENT CLINIC-LOCAL MODEL`.

Important limitation:

- This is not a global timezone scheduling model.
- If multi-timezone scheduling becomes a requirement, a new recon is required.

---

# 7. Current remaining risks

## 7.1 Mixed backend is not fully gone

Patient, ChiefComplaint, Doctor, and Appointment are migrated, but this does not mean every clinical module is migrated.

Known adjacent areas that require their own audit/reconciliation:

- FindingsRepository
- DentalChartRepository
- TreatmentPlansRepository
- Treatment generation
- Documents
- Billing
- amoCRM sync

Status:

- `VALID RISK`.

## 7.2 TreatmentPlan must not be assumed safe from this report

Appointment being migrated does not make TreatmentPlans safe.

TreatmentPlans depend on:

- findings
- dental chart
- stages
- possibly patient/appointment context

Status:

- `DO NOT IMPLEMENT FROM THIS REPORT ALONE`.

## 7.3 Doctor administration is still missing

DoctorRepository is read-only.

Current status:

- Supabase doctors are seeded/loaded.
- There is no full doctor management UI in this reconciliation scope.

Risk:

- New tenants may not have doctors unless seeded or administered later.

Status:

- `OPEN PRODUCT/ADMIN GAP`.

## 7.4 Delete permissions for appointments depend on role/RLS

Appointment delete worked in QA for the tested admin/owner-like path.

Future role changes must not assume every user can delete appointments.

Status:

- `VALID RLS/ROLE RISK`.

## 7.5 localStorage data remains legacy/prototype data

localStorage fallback is intentionally preserved.

But future tasks must not treat localStorage data as production truth for these migrated domains.

Status:

- `VALID ARCHITECTURE RULE`.

---

# 8. Updated route map for these domains

## 8.1 Patient list route

```text
PatientsPage / patient UI
→ usePatientsCollection
→ createPatientRepository({ backend, tenantId })
→ SupabasePatientRepository OR LocalStoragePatientRepository
→ patients table OR localStorage
```

Predicates:

```text
Supabase only when:
authMode === 'supabase-active'
activeTenant.tenantId exists
isSupabaseConfigured === true
```

## 8.2 Patient card route

```text
PatientCardPage
→ usePatientProfile(patientId)
→ createPatientRepository({ backend, tenantId })
→ SupabasePatientRepository OR LocalStoragePatientRepository
```

## 8.3 Chief complaint route

```text
PatientCard / ChiefComplaint UI
→ useChiefComplaint(patientId)
→ createChiefComplaintRepository({ backend, tenantId })
→ SupabaseChiefComplaintRepository OR LocalStorageChiefComplaintRepository
→ chief_complaints table OR localStorage
```

Critical guard:

- Supabase mode requires patient ID that exists in Supabase patients for the same tenant.

## 8.4 Doctor source route

```text
Schedule / doctor columns
→ useClinicDoctors
→ createDoctorRepository({ backend, tenantId })
→ SupabaseDoctorRepository OR LocalStorageDoctorRepository
→ doctors table OR localStorage seed
```

Critical split:

- Supabase mode: UUID doctors.
- Dev mode: legacy local IDs such as `d1`, `d2`.

## 8.5 Appointment schedule route

```text
SchedulePage
→ useScheduleAppointments
→ createAppointmentRepository({ backend, tenantId })
→ SupabaseAppointmentRepository OR LocalStorageAppointmentRepository
→ appointments table OR localStorage
```

Critical guards:

- `tenant_id` is always applied in Supabase queries.
- empty `patientId` maps to `null` for blocked slots.
- appointment IDs must be UUID-compatible.
- wall-clock behavior is clinic-local, not global timezone scheduling.

---

# 9. What old notes must be replaced

## Replace old note

```text
PatientRepository is localStorage-only.
```

With:

```text
PatientRepository is Supabase-aware with localStorage fallback.
Use PATIENT-REAL-001A/001B as current baseline.
```

## Replace old note

```text
ChiefComplaint FK is blocked by local-only patients.
```

With:

```text
ChiefComplaint FK is valid for Supabase patients.
Local-only patient IDs must still not be sent into Supabase mode.
```

## Replace old note

```text
Doctor IDs block Appointment migration.
```

With:

```text
Doctor UUID blocker is resolved in Supabase-active mode by SupabaseDoctorRepository and seeded UUID doctors.
```

## Replace old note

```text
AppointmentRepository is not migrated.
```

With:

```text
AppointmentRepository is Supabase-aware with localStorage fallback and has real browser QA for create/update/delete/blocked slot/dev fallback/no-tenant flows.
```

## Replace old note

```text
TreatmentPlans can be implemented after Appointment.
```

With:

```text
TreatmentPlans still require their own current reconciliation because they depend on Findings and DentalChart paths.
```

---

# 10. Stop rules for future tasks

## 10.1 Allowed without new major recon

Small tasks inside these already-migrated domains may proceed if they remain within a single domain and do not alter schema:

- patient list/card minor UI improvements
- patient field mapping fixes
- chief complaint display/save polish
- schedule UI improvements using existing appointment data
- appointment form validation fixes
- doctor display/filtering using existing fields

Required:

- small scope
- tests
- browser smoke if UI behavior changes
- no schema changes unless separately approved

## 10.2 New recon required before implementation

Require a new recon before code if the task touches:

- TreatmentPlansRepository
- FindingsRepository
- DentalChartRepository
- generating treatment plan from findings/dental chart
- doctor management CRUD
- appointment recurrence
- cross-timezone scheduling
- role-based appointment permissions beyond current behavior
- production Supabase setup or migrations
- data backfill from localStorage to Supabase
- tenant switcher or multi-tenant admin UX

## 10.3 Never assume from this report

This report does not certify:

- TreatmentPlans are safe.
- Findings are safe.
- DentalChart is fully production-safe.
- production Supabase has been tested.
- all tenants have doctors.
- every role can delete appointments.
- localStorage data is production data.

---

# 11. Recommended next audit pack

Next recommended task:

```text
PROJECT-AUDIT-BACKFILL-004
Findings / DentalChart / TreatmentPlan reconciliation
```

Why:

The next domain group contains the highest dependency risk:

- findings can link to chief complaints, dental chart, and treatment stages
- dental chart has recently changed heavily
- treatment plans depend on findings/dental chart and had old blockers around local IDs vs UUIDs

Do not implement TreatmentPlan automation or deeper dental chart/Supabase behavior until that reconciliation is completed.

---

# Final verdict

## Current truth

Patient, ChiefComplaint, Doctor, and Appointment repositories are all Supabase-aware and still preserve localStorage fallback.

They share the same routing pattern:

```text
supabase-active + activeTenant + configured => Supabase
else => localStorage fallback
```

Real browser QA exists for:

- ChiefComplaint
- Patient
- Doctor source in Schedule
- Appointment flows in Schedule

## Current risk boundary

This does not automatically validate the clinical dependency graph beyond those domains.

The next dangerous area is:

```text
Findings
→ DentalChart
→ TreatmentPlan
```

That must be reconciled before new treatment-plan or clinical automation work continues.
