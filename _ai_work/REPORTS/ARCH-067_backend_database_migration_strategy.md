# ARCH-067: Backend/database storage migration strategy

## 1. Files and sources inspected
- `_ai_work/REPORTS/ARCH-066_full_storage_dependency_audit.md`
- `_ai_work/SOURCES/00_PROJECT_MASTER_CONTEXT.md`
- `_ai_work/SOURCES/01_PRODUCT_VISION_AND_BUSINESS_MODEL.md`
- `_ai_work/SOURCES/02_ROLES_AND_PERMISSIONS.md`
- `_ai_work/SOURCES/03_MULTI_TENANT_ARCHITECTURE_RULES.md`
- `_ai_work/SOURCES/04_DATA_ISOLATION_AND_SECURITY.md`
- `_ai_work/SOURCES/10_AMOCRM_TECHNICAL_ARCHITECTURE.md`
- `_ai_work/SOURCES/11_BACKEND_AND_API_ARCHITECTURE.md`
- `_ai_work/SOURCES/12_BILLING_AND_ACCESS_CONTROL.md`
- `_ai_work/SOURCES/13_STORAGE_AND_MIGRATION_STRATEGY.md`
- `_ai_work/SOURCES/16_DEVELOPMENT_ROADMAP_AND_TASK_BACKLOG.md`
- `_ai_work/SOURCES/19_TOOL_REGISTRY_AND_USAGE_POLICY.md`
- `src/data/repositories/PatientRepository.ts`
- `src/data/repositories/AppointmentRepository.ts`
- `src/data/repositories/DoctorRepository.ts`
- `src/data/repositories/DentalChartRepository.ts`
- `src/data/repositories/ChiefComplaintRepository.ts`
- `src/data/repositories/FindingsRepository.ts`
- `src/data/repositories/TreatmentPlansRepository.ts`

## 2. Current architecture state after ARCH-066
- **UI storage decoupling status:** 100% complete. Components, Pages, Hooks, Aggregators, and Orchestrators are entirely free from direct persistence logic.
- **Repository boundary status:** The Repository layer is now the single, unified boundary for all data access across the entire application.
- **Remaining storage.init() seed in main.tsx:** Kept strictly for prototype initialization to seed mock data in empty browsers.
- **Current localStorage role:** Purely a Data Access Layer (DAL) implementation detail hidden behind the Repository interfaces.

## 3. Repository contract map
For each current repository, all methods currently run synchronous reads/writes wrapped in `Promise.resolve()` against `localStorage`. When moved to a backend, these will execute network requests. Every single entity fetched or saved will require a **tenant scope** (`tenant_id` or `clinic_id`) to ensure absolute data isolation.

- **PatientRepository**: `listPatients()`, `getPatient(id)`, `createPatient(patient)`, `updatePatient(patient)`, `deletePatient(id)`. 
- **AppointmentRepository**: `listAppointments()`, `listAppointmentsByPatient(patientId)`, `createAppointment(appt)`, `updateAppointment(appt)`, `deleteAppointment(id)`.
- **DoctorRepository**: `listDoctors()`, `getDoctor(id)`.
- **DentalChartRepository**: `getDentalChart(patientId)`, `saveDentalChart(patientId, chart)`.
- **ChiefComplaintRepository**: `getChiefComplaint(patientId)`, `saveChiefComplaint(patientId, complaint)`.
- **FindingsRepository**: `listFindingsByPatient(patientId)`, `createFinding(patientId, finding)`, `updateFinding(patientId, finding)`, `deleteFinding(patientId, findingId)`.
- **TreatmentPlansRepository**: `listTreatmentPlansByPatient(patientId)`, `createTreatmentPlan(patientId, plan)`, `updateTreatmentPlan(patientId, plan)`, `deleteTreatmentPlan(patientId, planId)`.

## 4. Domain-to-database draft map
Future relational entities and their relationships:
- `tenants` (Clinics)
- `users` (System users)
- `tenant_users` (Join table: links users to tenants with specific `roles` / `permissions`)
- `patients` (Belongs to `tenant_id`)
- `doctors` (Belongs to `tenant_id` / linked to `users`)
- `appointments` (Belongs to `tenant_id`, `patient_id`, `doctor_id`)
- `chief_complaints` (Belongs to `tenant_id`, `patient_id`)
- `dental_charts` (Belongs to `tenant_id`, `patient_id`)
- `teeth` / `tooth_states` (Belongs to `tenant_id`, `dental_chart_id`)
- `findings` (Belongs to `tenant_id`, `patient_id`, links to `tooth_number`)
- `treatment_plans` (Belongs to `tenant_id`, `patient_id`)
- `treatment_stages` (Belongs to `tenant_id`, `treatment_plan_id`)
- `documents` (Belongs to `tenant_id`, `patient_id`)
- `subscriptions` / `billing` (Belongs to `tenant_id`)
- `audit_logs` (Belongs to `tenant_id`, `user_id`)
- `integration_tokens` (Belongs to `tenant_id` - encrypted amoCRM tokens)

## 5. Backend/API boundary proposal
Instead of a monolith, the backend interface should be logically partitioned:
- **Auth & Tenant Context:** Authentication, JWT validation, and extracting `tenant_id` context.
- **Repository API:** REST or GraphQL endpoints directly mirroring the frontend Repository interfaces.
- **Patient API:** CRUD for patients and demographics.
- **Appointment API:** Scheduling and calendar operations.
- **Clinical API:** Highly relational endpoints for dental charts, complaints, and findings.
- **Treatment Plan API:** Workflows for converting findings to plans and stages.
- **Billing/Access API:** Subscription validation middleware.
- **Integration Proxy API:** Server-side proxy for amoCRM to prevent exposing API keys to the frontend.
- **Audit/Logging API:** Immutable medical record access logs.

## 6. Backend/database options comparison

### A. PostgreSQL + custom backend (Node.js/NestJS/Go)
- **Benefits:** Maximum control, custom business logic, easy amoCRM proxying.
- **Risks:** High boilerplate, slow time-to-market, devops overhead.
- **Tenant isolation fit:** Excellent (can use schema-per-tenant or Row-Level Security).
- **Medical data fit:** Excellent (relational structure is perfect for teeth/findings).
- **SaaS readiness:** High.
- **Migration complexity:** High (must build everything from scratch).
- **Recommendation:** Maybe (good long-term, but slow for MVP).

### B. Supabase (PostgreSQL + built-in API/Auth)
- **Benefits:** Instant REST API, built-in Auth, Row-Level Security (RLS) can strongly enforce tenant isolation when policies, tenant context, JWT claims, and service-role usage are configured correctly, fast MVP.
- **Risks:** Vendor lock-in (though it's open-source Postgres), server-side logic requires Edge Functions.
- **Tenant isolation fit:** Very Good (RLS policies `tenant_id = auth.jwt()->>'tenant_id'`, but requires careful configuration).
- **Medical data fit:** Very Good (it's PostgreSQL).
- **SaaS readiness:** Very High.
- **Migration complexity:** Low (frontend Repositories just switch to `supabase-js` client).
- **Recommendation:** **Yes (Preferred)**.

### C. Firebase/Firestore
- **Benefits:** Fast realtime syncing, zero devops.
- **Risks:** NoSQL is a terrible fit for highly relational medical data (dental charts -> teeth -> findings -> treatment plans).
- **Tenant isolation fit:** Good (Firestore rules).
- **Medical data fit:** Poor.
- **Recommendation:** No.

### D. Google Cloud SQL + custom backend
- **Benefits:** Enterprise scalability.
- **Risks:** Expensive, requires significant infrastructure setup for an MVP.
- **Recommendation:** No.

### E. Stay on localStorage longer
- **Benefits:** Zero cost.
- **Risks:** Data loss, no multi-device support, no real auth, cannot test multi-tenant behavior.
- **Recommendation:** No.

## 7. Recommended direction
- **Preferred option:** **Supabase (PostgreSQL)**
- **Why:** The application requires strict multi-tenant data isolation and highly relational medical records (teeth, findings, plans). Supabase/PostgreSQL is the preferred option because it provides relational modeling plus database-level RLS, but RLS must be explicitly designed, tested, and audited. RLS reduces the blast radius of application-layer bugs, but does not replace correct backend/API design. It also provides instant APIs and Auth, drastically reducing backend boilerplate and accelerating the MVP.
- **Why not the alternatives:** Firebase NoSQL is too rigid for complex dental charts. Custom backend + raw PostgreSQL requires too much boilerplate for the current prototype phase.
- **Biggest risks:** Handling amoCRM proxying, as API keys cannot be exposed on the frontend.
- **Mitigations:** Supabase Edge Functions or a minimal lightweight Node.js proxy can be deployed specifically for server-side amoCRM integration.

### RLS Specific Risks:
- service-role keys must never be exposed to frontend
- Edge Functions / backend proxy must preserve tenant context
- RLS policies must be tested with multiple tenants
- every tenant-owned table must include `tenant_id`
- policies must cover SELECT/INSERT/UPDATE/DELETE separately

## 8. Migration strategy phases
1. **Backend/database design only:** Map exact PostgreSQL schema, RLS policies, and Auth flows.
2. **Auth/tenant foundation:** Setup Supabase project, implement login/registration, and establish `tenant_id` context in the frontend.
3. **Database schema/migrations:** Deploy SQL tables and RLS policies.
4. **API contracts:** Verify Supabase JS client types against our frontend Typescript types.
5. **Repository implementation swap:** Create `SupabasePatientRepository`, `SupabaseAppointmentRepository`, etc., and swap them in the dependency injection layer.
6. **Seed/demo data migration:** Create an SQL seed file for demo users.
7. **Remove storage.init():** Delete `storage.ts` entirely.
8. **amoCRM backend proxy later:** Implement Edge Functions for integrations.
9. **billing/access control later:** Implement Stripe/billing webhooks.

## 9. First safe implementation task after this report
- **Title:** ARCH-068 — Define Supabase PostgreSQL schema and RLS policies
- **Goal:** Draft the exact SQL schema, relationships, and Row-Level Security policies for the core entities (Tenants, Users, Patients, Appointments) to validate the database design before touching any application code or installing SDKs.
- **Allowed files:** `_ai_work/DATABASE_SCHEMA.md`, `supabase/migrations/*` (if applicable for drafting).
- **Forbidden files:** `src/*`, `package.json`.
- **Why it is safe and small:** It is a pure design/documentation task that establishes the database foundation without breaking the currently functioning localStorage prototype.

## 10. Tool requirements for future phases
- Current confirmed tools are strictly GitHub MCP, Chrome DevTools MCP, and Sequential Thinking MCP.
- When Supabase SDKs, Supabase MCP, Postman, or Cloud tools become necessary for execution, the user **MUST** be asked first with an `ACTION REQUIRED` prompt.
- Unavailable tools will not be used or assumed in future agent tasks until the user explicitly confirms they are installed/enabled.

## 11. Explicit non-goals
- [x] no code changed
- [x] no backend implemented
- [x] no DB schema implemented
- [x] no migrations added
- [x] no packages installed
- [x] no cloud tools used
- [x] no optional/future tools used
- [x] no browser automation used
- [x] no production writes
