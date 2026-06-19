# ENCOUNTER-VISIT-MODEL-001A — visit, encounter, completed service schema report

## 1. Summary

Implemented the schema-only foundation for actual patient attendance, clinical documentation sessions, and performed clinical/billable service facts.

The migration adds three source-of-truth tables:

- `public.patient_visits`
- `public.clinical_encounters`
- `public.completed_services`

No app code, UI, repositories, hooks, seed/backfill, browser smoke, payment/stock/document work, timeline integration, or Supabase cloud changes were made.

## 2. Branch name

`feature/encounter-visit-model-001a`

## 3. PR URL

https://github.com/NckNA/codex-test/pull/311

## 4. PR head reviewed before final report update

`288bee64133507fe5f5ea1f88c548871aef10905`

This is the PR head reviewed before the final report update. It includes the migration and validation report commits verified by CI #551.

## 5. Report update commit

N/A because the final report update commit cannot reference itself before creation.

## 6. Changed files summary

Expected files:

- `supabase/migrations/0014_create_encounter_visit_model.sql`
- `_ai_work/REPORTS/ENCOUNTER-VISIT-MODEL-001A_schema.md`

No app code changed.
No UI changed.
No repositories/hooks changed.
No seed files changed.
No generated types changed.

## 7. Current schema recon

### Existing core tables inspected

Relevant existing schema from migrations:

- `public.tenants`
- `public.profiles`
- `public.tenant_users`
- `public.patients`
- `public.appointments`
- `public.findings`
- `public.treatment_plans`
- `public.treatment_stages`
- `public.clinical_dictionary_items`
- `public.audit_logs`
- `public.audit_events`
- `public.activity_events`

### Existing ID type findings

| Entity | ID type / shape |
|---|---|
| `tenants.id` | `uuid` |
| `profiles.id` | `uuid`, references `auth.users(id)` |
| `tenant_users.id` | `uuid` |
| `tenant_users.user_id` | `uuid`, references `profiles(id)` |
| `patients.id` | `uuid`, with `UNIQUE(tenant_id, id)` |
| `appointments.id` | `uuid` |
| `findings.id` | `uuid` |
| `treatment_plans.id` | `uuid`, with `UNIQUE(tenant_id, id)` |
| `treatment_stages.id` | `uuid` |
| `clinical_dictionary_items.id` | `text`, composite PK `(tenant_id, id)` |
| `audit_events.id` | `uuid` |
| `activity_events.id` | `uuid` |

Important design consequence: `clinical_dictionary_item_id` in `completed_services` is `text`, not `uuid`, and is scoped by `(tenant_id, clinical_dictionary_item_id)`.

### Existing app_role enum

Exact enum values from `app_role`:

- `platform_owner`
- `platform_admin`
- `clinic_owner`
- `clinic_admin`
- `doctor`
- `registrar`
- `cashier`
- `marketer`
- `support`

There is no `receptionist` enum value. The project uses `registrar` for that role boundary.

### Existing RLS helper functions

Available and reused:

- `public.get_user_tenants()`
- `public.has_tenant_role(target_tenant_id uuid, allowed_roles app_role[])`

These helpers are suitable for tenant-scoped SELECT policies on the new tables.

### Existing write patterns

Current older domain tables still have broad tenant-member insert/update policies in early migrations.

Recent sensitive work is moving toward controlled RPC/helper patterns:

- treatment plan/stage sync uses a transactional RPC;
- audit/activity writes use internal helpers granted only to trusted backend context;
- audit/activity tables use conservative grants and no broad browser write path.

For this task, the new clinical fact tables follow the newer conservative approach: no broad client INSERT/UPDATE/DELETE policies in 001A.

## 8. Migration summary

Migration file:

`supabase/migrations/0014_create_encounter_visit_model.sql`

Created tables:

- `public.patient_visits`
- `public.clinical_encounters`
- `public.completed_services`

Added helper:

- `public.set_updated_at()` generic timestamp trigger helper

Added triggers:

- `patient_visits_set_updated_at`
- `clinical_encounters_set_updated_at`
- `completed_services_set_updated_at`

Validation counts from local schema checks:

- new tables found: `3`
- new table columns found: `78` total across the three tables
- constraints found: `57`
- indexes found: `24`
- comments found: `20`
- RLS-enabled new tables: `3`
- SELECT policies found: `3`
- authenticated SELECT grants: `3`
- authenticated extra grants: `0`

## 9. Domain boundary

### Appointment vs visit

`appointments` remain booking intent / scheduled slot records.

`patient_visits` represent actual attendance. A `patient_visits.appointment_id` is only a context link to the booking. Appointment status alone is not a clinical record and is not proof of treatment.

`no_show` was intentionally not added to `patient_visits.status`; no-show remains an appointment outcome, not an actual visit.

### Visit vs clinical encounter

A visit is attendance.

A clinical encounter is a documented doctor interaction/session, usually inside a visit. The two are related but not interchangeable.

### Encounter vs completed service

A clinical encounter documents clinical interaction.

A completed service is a performed clinical/billable fact. It can reference an encounter, but it is its own source fact for performed-service reports.

### Completed service vs treatment plan/stage

Treatment plans and stages are intended future work.

`completed_services` records performed facts. Plan/stage links are references only and do not prove completion by themselves.

### Completed service vs payment

`completed_services.unit_price` and `completed_services.total_amount` are service/billing snapshots only.

Payment allocation/debt/balance is a future financial module and was not implemented here.

### Source fact vs audit/activity

Audit/activity events record action history and product activity projections.

They are not the source of clinical facts. Future domain RPCs should write the clinical fact and audit/activity events in the same transaction.

## 10. patient_visits design

Purpose: actual patient attendance instance in a clinic.

Key fields:

- `tenant_id`
- `patient_id`
- optional `appointment_id`
- `status`
- `visit_type`
- timestamps for arrival/check-in/start/completion/cancellation/archive
- actor references for create/update/archive
- administrative notes
- safe `metadata` object

Allowed statuses:

- `checked_in`
- `in_progress`
- `completed`
- `cancelled`
- `archived`

Allowed visit types:

- `regular`
- `emergency`
- `consultation`
- `follow_up`
- `procedure`
- `other`

Selected constraints:

- metadata must be a JSON object;
- completed timestamp only with completed/archived state;
- cancelled timestamp only with cancelled state;
- archived timestamp only with archived state.

## 11. clinical_encounters design

Purpose: documented clinical interaction/session, usually inside a patient visit.

Key fields:

- `tenant_id`
- `patient_id`
- optional `visit_id`
- optional `appointment_id`
- `doctor_user_id`
- `status`
- `encounter_type`
- clinical summary fields
- correction reason
- safe `metadata` object

Allowed statuses:

- `draft`
- `in_progress`
- `completed`
- `locked`
- `archived`

Allowed encounter types:

- `consultation`
- `treatment`
- `surgery`
- `orthodontics`
- `prosthetics`
- `hygiene`
- `emergency`
- `follow_up`
- `other`

Selected constraints:

- metadata must be a JSON object;
- completed timestamp only with completed/locked/archived state;
- locked timestamp only with locked/archived state;
- archived timestamp only with archived state.

## 12. completed_services design

Purpose: performed clinical/billable service fact.

Key fields:

- `tenant_id`
- `patient_id`
- optional `visit_id`
- optional `encounter_id`
- optional context links to appointment/finding/treatment plan/treatment stage/dictionary item
- service code/name
- tooth fields
- quantity
- price/amount snapshot
- currency
- performed_by/performed_at
- correction/void/archive fields
- safe `metadata` object

Allowed statuses:

- `completed`
- `corrected`
- `voided`
- `archived`

Selected constraints:

- metadata must be a JSON object;
- quantity must be positive;
- unit price and total amount must be non-negative when present;
- currency must be non-empty;
- service name must be non-empty;
- corrected/voided status requires correction reason;
- voided status requires voided timestamp;
- archived status requires archived timestamp.

## 13. RLS / role visibility

RLS is enabled on all three tables.

### `patient_visits`

Allowed SELECT roles:

- `clinic_owner`
- `clinic_admin`
- `doctor`
- `registrar`

Blocked in 001A:

- `cashier`
- no-tenant users
- cross-tenant users
- platform/support/marketing roles unless future product policy explicitly allows them

Rationale: visits can contain patient attendance and notes, so cashier access is deferred until a billing/privacy policy defines limited read models.

### `clinical_encounters`

Allowed SELECT roles:

- `clinic_owner`
- `clinic_admin`
- `doctor`

Blocked:

- `registrar`
- `cashier`
- no-tenant users
- cross-tenant users

Rationale: encounters are clinical documentation, not front desk or billing data.

### `completed_services`

Allowed SELECT roles:

- `clinic_owner`
- `clinic_admin`
- `doctor`

Blocked in 001A:

- `registrar`
- `cashier`
- no-tenant users
- cross-tenant users

Rationale: completed services include clinical and billing-facing details. Cashier access is intentionally deferred until payment/debt policy defines a safe billing-facing view.

## 14. Write path strategy

No broad browser/client write policies were added for:

- `patient_visits`
- `clinical_encounters`
- `completed_services`

`authenticated` receives SELECT only, controlled by RLS.

Future write tasks should add controlled domain RPCs/repositories. Those RPCs should:

- validate tenant/patient ownership;
- perform clinical mutation;
- record audit/activity events with existing internal helpers;
- require correction reasons for high-risk corrections/voids.

## 15. Local validation

### Local Supabase status

Detected local Supabase:

- API: `http://127.0.0.1:54321`
- DB: `127.0.0.1:54322/postgres`
- cloudAccess: `false`

Optional services reported stopped:

- `imgproxy`
- `edge_runtime`
- `pooler`

These are not blockers for schema validation.

### Local db reset

`npx supabase db reset --yes`: PASS

Migration `0014_create_encounter_visit_model.sql` applied successfully after migrations `0001` through `0013`.

### Table existence and counts

New tables exist:

- `patient_visits`: yes
- `clinical_encounters`: yes
- `completed_services`: yes

Counts after reset and cleanup:

- `patient_visits = 0`
- `clinical_encounters = 0`
- `completed_services = 0`

Existing table preservation check:

- `appointments`: exists
- `treatment_plans`: exists
- `treatment_stages`: exists
- `findings`: exists
- `audit_events`: exists
- `activity_events`: exists
- `audit_logs`: exists

No destructive changes to those tables were made by this migration.

### RLS/policies/grants

- RLS enabled on all three new tables: PASS
- SELECT policies exist: PASS
- authenticated has SELECT only: PASS
- authenticated extra grants: `0`
- anon has no direct grants: PASS
- service_role privileged backend access granted: PASS

### Constraints/indexes/comments

- constraints found: `57`
- indexes found: `24`
- comments found: `20`

### RLS simulation

RLS was validated through local Supabase clients using seeded QA users and temporary local rows, then cleaned up.

Results:

| QA role | patient_visits | clinical_encounters | completed_services |
|---|---:|---:|---:|
| Clinic A admin | 1 | 1 | 1 |
| Clinic A doctor | 1 | 1 | 1 |
| Clinic A registrar | 1 | 0 | 0 |
| Clinic A cashier | 0 | 0 | 0 |
| no-tenant | 0 | 0 | 0 |
| Clinic B admin | 0 | 0 | 0 |

Direct authenticated insert into `patient_visits`: blocked.

Cleanup returned counts to 0.

### Invalid payload tests

All expected invalid payloads were rejected:

- invalid patient visit status;
- invalid encounter status;
- invalid completed service status;
- patient visit metadata array instead of object;
- completed service quantity `0`;
- empty completed service name;
- negative completed service amount.

### Local advisors

`npx supabase db lint --local`: completed with exit code 0.

Warnings were reported only for existing `public.save_treatment_plan_with_stages` from migration `0006`:

- assignment cast warning for `submitted_stage_ids` initialization;
- loop variable shadowing warning;
- unused variable warning.

No new `0014`-specific advisor warning was reported.

## 16. What was intentionally NOT changed

- no app code;
- no UI;
- no repositories;
- no hooks;
- no patient timeline integration;
- no Supabase cloud;
- no browser smoke;
- no payments;
- no stock;
- no documents;
- no seed changes;
- no backfill;
- no persistent validation data.

## 17. Checks

Local checks:

- `git status --short`: only expected migration/report files before report commit;
- `npm run lint`: PASS;
- `npm run test -- --run`: PASS, 47 files / 414 tests;
- `npm run build`: PASS.

Warnings observed:

- existing React `act(...)` warnings in tests;
- existing Vite chunk-size warning;
- existing Supabase CLI version notice.

All commands exited successfully.

### GitHub Actions CI

Fresh CI after report push:

- Workflow: `CI`
- Run id: `27806672669`
- CI number: `551`
- Tested commit: `288bee64133507fe5f5ea1f88c548871aef10905`
- Status: completed
- Conclusion: success
- Required checks: ESLint, tests, build passed.

## 18. Final verdict

`ENCOUNTER VISIT MODEL SCHEMA IMPLEMENTED AND VERIFIED`

## 19. Recommended next task

`ENCOUNTER-VISIT-REPOSITORY-001B`
