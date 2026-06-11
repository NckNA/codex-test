# SAAS-ARCHITECTURE-ROUTING-MAP-001

## Status

Report-only architecture checkpoint.

This report does not change application code, database migrations, tests, seed data, package files, or runtime configuration.

## Purpose

Create a clear SaaS routing map for DentalFlow after the backfill audit series.

The main product requirement is simple in business language:

> One platform may serve many dental clinics, but each clinic must only see and change its own data.

In technical language this means:

- every clinic is a tenant;
- every clinic-scoped record must have a tenant boundary;
- UI routes must not bypass auth/tenant gates;
- repositories must not query Supabase without tenant context;
- localStorage is only prototype/dev fallback;
- cloud/staging deployment must not be enabled before cloud schema, tenant data, and RLS are verified.

## Vocabulary for Nick / non-technical owners

### Platform admin panel / “раздел бога”

This is the future owner-level control area.

It should allow the platform owner to:

- create a new clinic account;
- assign the first clinic owner;
- suspend or activate clinic access;
- see platform-level status;
- manage subscriptions later;
- support clinics without seeing more medical data than necessary.

This is not the same as a clinic admin panel.

### Tenant

A tenant is one clinic or one dental company inside DentalFlow.

Examples:

```text
Tenant A = Clinic A
Tenant B = Clinic B
```

Tenant is the technical word for “клиника / компания / организация” in the SaaS database.

### First clinic owner

The first clinic owner is the first user linked to a newly created clinic with the `clinic_owner` role.

For the first internal clinic this can be Nick.

For a sold SaaS customer this should be created through a controlled onboarding route, not by manually editing random rows.

### User linked to tenant

A user is linked to a clinic through `tenant_users`.

Current schema idea:

```text
auth user / profile
→ tenant_users row
→ tenant
→ role inside that tenant
```

If there is no tenant_users row for the user, the app must not open clinic data routes.

## Current verified foundation

### Root provider order

Current `main.tsx` wraps the app as:

```text
AuthProvider
→ TenantProvider
→ App
```

This is the correct high-level order because tenant loading depends on the authenticated user.

Current source confirms this provider order in `src/main.tsx`.

### App route gate

Current `App.tsx` applies these gates:

1. Supabase-active + auth loading → loading screen.
2. Supabase-active + no user → login page.
3. Supabase-active + user + tenant loading → tenant loading screen.
4. Supabase-active + tenant error → tenant error screen.
5. Supabase-active + user + no tenant → “Клиника не назначена” blocked screen.
6. Dev mode or valid supabase-active user+tenant → application routes.

This is a core SaaS guardrail.

The private app routes must remain behind this gate.

### Auth mode

Current `AuthContext` derives auth mode from Supabase env availability:

```text
Supabase configured → supabase-active
Supabase not configured → dev
```

In dev mode a local demo user is used.

In Supabase-active mode auth session is read from Supabase and sign-in/sign-out use Supabase auth.

### Tenant loading

Current `TenantContext` loads tenant access for the authenticated user from `tenant_users` and joined `tenants` metadata.

The selected tenant is the first available tenant unless a previously selected tenant is still available.

Current limitation:

- no final tenant switcher UI;
- no persisted active tenant selection;
- no platform admin onboarding flow;
- tenant loading exists, but tenant lifecycle management is not implemented.

## Database boundary map

### Core SaaS tables

From `0001_initial_schema.sql`:

- `tenants` — clinic/company accounts;
- `profiles` — user profile linked to auth user;
- `tenant_users` — user-to-clinic membership and role;
- `subscriptions` — future SaaS billing state;
- `audit_logs` — future operational trace;
- domain tables such as patients, doctors, appointments, complaints, dental charts, findings, treatment plans.

### Clinic-scoped domain tables

The current schema contains tenant_id on key clinic/domain tables:

- patients;
- doctors;
- appointments;
- chief_complaints;
- dental_charts;
- tooth_states;
- findings;
- treatment_plans;
- treatment_stages;
- documents;
- audit_logs;
- subscriptions;
- integration_tokens.

This is the base wire that prevents clinics from mixing data.

### Important warning

Having `tenant_id` columns is not enough.

Every access path must also enforce tenant scope:

```text
UI tenant gate
→ hook backend switch
→ repository tenant_id filter
→ Supabase RLS
```

If one layer is missing, the other layers still help, but the system becomes weaker.

## RLS boundary map

### Current RLS intent

`0001_initial_schema.sql` enables RLS on core tables and defines tenant-isolation policies through `get_user_tenants()`.

This is a strong early foundation for SaaS isolation.

### Important limitation

Current RLS policies are primarily tenant-isolation policies.

They are not the final detailed role authorization model.

Meaning:

- they help prevent Clinic A from seeing Clinic B;
- they do not yet fully define what each role can do inside the same clinic;
- final RBAC still needs a separate recon/task.

### Current role model in schema

The `app_role` enum already includes:

- platform_owner;
- platform_admin;
- clinic_owner;
- clinic_admin;
- doctor;
- registrar;
- cashier;
- marketer;
- support.

This gives the vocabulary for the future permission system, but not every screen/action is fully role-gated yet.

## Repository routing map

### Standard frontend route to data

Safe route:

```text
Page / Component
→ data hook
→ repository factory
→ LocalStorage repository OR Supabase repository
→ database/local fallback
```

Unsafe route:

```text
Component
→ direct Supabase query
```

Direct Supabase queries should be avoided outside approved repository/context boundaries.

### Backend switch rule

Current migrated hooks generally follow this route:

```text
if authMode === 'supabase-active'
   and activeTenant?.tenantId exists
   and Supabase is configured
then backend = 'supabase'
else backend = 'local'
```

This is the correct default safety pattern.

### Repository memoization rule

Repositories used by hooks/effects/query functions should be memoized by backend and tenant id.

Reason:

```text
new repository every render
→ new queryFn every render
→ possible refetch loops
```

This was already identified in previous audit history and remains a standing rule.

## Current domain readiness map

### Migrated / Supabase-aware with fallback

These areas have been backfilled and should be treated as active Supabase-aware zones:

- PatientRepository;
- ChiefComplaintRepository;
- DoctorRepository;
- AppointmentRepository;
- FindingsRepository;
- DentalChartRepository;
- TreatmentPlansRepository.

### Still not equal to commercial SaaS-ready

Supabase-aware does not mean commercial-ready.

Commercial readiness additionally requires:

- cloud Supabase schema verified;
- cloud auth/tenant/users seeded or provisioned;
- RLS verified in cloud;
- real browser smoke in cloud/staging;
- role permissions checked;
- data lifecycle and backup plans.

## Clinical workflow junction

### Current route

The clinical workflow currently coordinates:

```text
DentalChartRepository
FindingsRepository
TreatmentPlansRepository
```

The major flow is:

```text
Tooth editor save
→ dental chart save
→ optional finding create/update
→ treatment plan generation from findings
→ treatment plan deletion cleanup
```

### Why this is useful

It keeps cross-domain medical workflow out of random UI components.

### Why this is dangerous

This can become a God-service if every future feature is connected there.

### Existing guardrails

The orchestrator already has several important checks:

- Supabase UUID validation for treatment plan generation;
- finding patient ownership checks;
- plan save before finding status updates;
- plan delete before finding restore cleanup;
- explicit error when cleanup partially fails.

### Missing guardrail

There is no true multi-step database transaction across all affected entities.

Therefore any extension of:

```text
chart → finding → plan
```

requires a separate recon before implementation.

## Local fallback map

### What local fallback is for

Local fallback is allowed for:

- prototype mode;
- development without Supabase env;
- limited local testing;
- safe transition between legacy and Supabase-aware repositories.

### What local fallback is not for

Local fallback is not production storage.

It must not be treated as SaaS data.

### Dangerous misunderstanding

If UI says “saved” in fallback mode, it may only mean legacy/local fields were saved.

For Supabase-specific fields, fallback can protect the old flow while silently omitting new structured fields if the live schema is missing.

That is why schema verification and smoke testing are required.

## Current Supabase schema status

### Repository schema files

The repository contains migrations for:

- initial SaaS/domain schema;
- dental chart editor fields;
- structured dental finding links.

### Local database status

Latest external result from local dev environment:

- local migration 0002: applied;
- local migration 0003: applied;
- local checks for required dental chart/finding columns and constraints: PASS.

### Cloud database status

Cloud Supabase schema is still not verified in this report.

Do not claim cloud readiness until a separate cloud verification task confirms it.

## SaaS creation route: new clinic

### Future platform admin route

Target route:

```text
Platform Admin
→ Create clinic tenant
→ Create/assign first clinic owner
→ Create tenant_users membership
→ Create subscription/trial row later
→ Seed basic clinic data if needed
→ Owner can invite lower roles
```

### Current implementation status

Not implemented as product UI.

Current DB schema supports the concept through:

- tenants;
- profiles;
- tenant_users;
- app_role;
- subscriptions.

But a safe onboarding workflow is not complete.

### Stop rule

Do not onboard real external clinics by ad-hoc manual row edits without a documented checklist.

If manual onboarding is temporarily needed, it must be a controlled admin procedure with verification.

## User role / permission route

### Target role layering

Platform roles:

```text
platform_owner
platform_admin
support
```

Clinic roles:

```text
clinic_owner
clinic_admin
doctor
registrar
cashier
marketer
```

### Current state

Roles exist in the schema.

TenantContext exposes the user role for the active tenant.

But role-based UI/action permissions are not fully mapped per screen/action.

### Required future report

`RBAC-PERMISSION-MATRIX-RECON-001`

It should define:

- who can view patients;
- who can edit dental chart;
- who can delete findings/plans;
- who can see finance;
- who can manage users;
- who can manage clinic settings;
- who can access platform admin.

## Data ownership map

### Platform-owned data

- tenants;
- subscriptions;
- platform-level settings;
- platform audit/support metadata.

### Clinic-owned data

- patients;
- doctors;
- appointments;
- chief complaints;
- dental charts;
- tooth states;
- findings;
- treatment plans;
- treatment stages;
- documents;
- clinic finance/warehouse later.

### User-owned data

- profile fields;
- auth identity;
- possibly personal settings later.

### Integration data

Integration data must remain tenant-scoped and backend/proxy-scoped.

External sales systems must not receive medical chart details.

## Routing map by area

### Patient card route

```text
/patients/:patientId
→ PatientCardPage
→ patient hooks/repositories
→ clinical tabs/hooks
→ repositories
→ Supabase/local fallback
```

Guardrails:

- patient id must belong to active tenant in Supabase mode;
- patient details must not be fetched without tenant context;
- medical tabs must not use mixed local/supabase data silently.

### Dental chart route

```text
PatientCardPage
→ DentalChartTab
→ ToothGrid
→ ToothEditorModal
→ ClinicalWorkflowOrchestrator
→ DentalChartRepository / FindingsRepository
```

Guardrails:

- adult/child dentition is UI/domain behavior, not tenant boundary;
- chart save must preserve tenant/patient ownership in Supabase mode;
- structured fields require schema verification;
- browser smoke must distinguish localStorage from Supabase-active mode.

### Treatment plan route

```text
Findings
→ selection
→ ClinicalWorkflowOrchestrator
→ TreatmentPlansRepository
→ TreatmentStages
→ finding status update
```

Guardrails:

- Supabase generation must reject local ids;
- findings must belong to the selected patient;
- no automatic generation expansion without recon;
- cleanup flow has partial failure risk.

### Appointment route

```text
Schedule UI
→ appointment hook
→ AppointmentRepository
→ Supabase/local fallback
```

Guardrails:

- doctor_id and patient_id must be UUID or null in Supabase mode;
- wall-clock time behavior must be preserved;
- blocked slots must allow null patient;
- browser QA required for scheduling changes.

## Deployment readiness map

### Local development

Current local dev state can be used for development and smoke tests.

### Local network access

Other computers may access a local dev server only as a temporary internal demo/testing setup.

This is not commercial SaaS.

### Staging cloud

Needed before selling:

- production frontend build;
- cloud Supabase project;
- cloud migrations applied;
- auth users/tenant_users seeded or provisioned;
- RLS verified;
- browser smoke from a separate machine;
- no localStorage production dependency for enabled modules.

### Production cloud

Not ready until staging has passed.

## Stop rules before selling to external clinics

Do not sell/deploy as SaaS until these are resolved:

1. Cloud Supabase schema verified.
2. Cloud RLS verified for at least two tenants.
3. Login + tenant assignment smoke tested in cloud/staging.
4. Patient isolation smoke tested between tenants.
5. DentalChart save/reload smoke tested in cloud/staging.
6. Appointment schedule smoke tested in cloud/staging.
7. Role matrix defined for clinic owner/admin/doctor/registrar.
8. Platform admin onboarding procedure defined.
9. Backup/restore strategy documented.
10. External integration boundary documented before real integrations.

## Required next architecture reports

### 1. RLS-POLICY-VERIFY-001

Verify actual RLS policies in local/cloud Supabase.

Must test at least:

- user A / tenant A cannot see tenant B patients;
- user B / tenant B cannot see tenant A data;
- no-tenant user cannot see clinic data;
- delete permissions match admin/owner expectations.

### 2. TENANT-PROVISIONING-RECON-001

Design how the platform admin creates:

- clinic tenant;
- first clinic owner;
- tenant_users membership;
- initial subscription/trial status;
- base clinic settings.

### 3. RBAC-PERMISSION-MATRIX-RECON-001

Define per-role access for screens and actions.

### 4. CLOUD-SUPABASE-READINESS-001

Verify cloud project schema, auth, tenant seed and RLS before staging.

### 5. STAGING-DEPLOYMENT-RECON-001

Choose and document frontend deployment path and env strategy.

### 6. DATA-MIGRATION-PLAN-001

Map localStorage/local Supabase/demo data to cloud UUID/tenant-safe data.

## Practical architecture rule for future tasks

Before any new implementation task, answer these questions:

1. Which tenant owns the data?
2. Does the repository require tenantId?
3. Is the id UUID in Supabase mode?
4. Does local fallback still exist?
5. Does RLS protect this table?
6. Does the UI route require auth/tenant gate?
7. Does the task cross repositories?
8. If it crosses repositories, is there an existing orchestrator or does it need recon?
9. Does browser smoke need Supabase-active mode?
10. Is this local-only, staging, or cloud-ready?

If any answer is unknown, do RECON first.

## Final verdict

Current architecture is moving in the right SaaS direction.

The current project already has:

- auth/tenant provider order;
- no-tenant route gate;
- tenant-scoped DB schema;
- RLS tenant-isolation foundation;
- Supabase-aware repositories for core medical/admin domains;
- local fallback for development;
- clinical workflow coordinator.

But it is not yet commercial SaaS-ready.

The next step is not another UI feature.

The next step is to verify and harden SaaS guardrails:

```text
RLS-POLICY-VERIFY-001
→ TENANT-PROVISIONING-RECON-001
→ RBAC-PERMISSION-MATRIX-RECON-001
→ CLOUD-SUPABASE-READINESS-001
→ STAGING-DEPLOYMENT-RECON-001
```

This prevents the worst SaaS failure mode:

```text
Clinic A accidentally sees Clinic B data.
```

That failure is not a UI bug. It is a product-ending security incident.
