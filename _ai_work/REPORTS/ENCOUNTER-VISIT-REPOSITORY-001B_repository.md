# ENCOUNTER-VISIT-REPOSITORY-001B — Read-only encounter/visit repository

## 1. Summary

Implemented a typed read-only TypeScript repository layer for the schema introduced by `ENCOUNTER-VISIT-MODEL-001A`.

The repository provides safe read access to:

- `public.patient_visits`
- `public.clinical_encounters`
- `public.completed_services`

It preserves the domain boundary:

- appointment is booking intent, not visit;
- visit is actual attendance, not clinical documentation;
- clinical encounter is documented clinical session, not payment;
- completed service is performed clinical/billable fact, not a treatment plan or payment;
- audit/activity remains history, not the source clinical fact.

This task is read-only. No write methods were added.

## 2. Branch name

`feature/encounter-visit-repository-001b`

## 3. PR URL

https://github.com/NckNA/codex-test/pull/312

## 4. PR head reviewed before final report update

`03b1034fe0ba6053968c997f51d80ef2142cb353`

## 5. Report update commit

N/A because the final report update commit cannot reference itself before creation.

## 6. Changed files summary

Expected files changed:

- `src/data/repositories/EncounterVisitRepository.ts`
- `src/data/repositories/EncounterVisitRepository.test.ts`
- `_ai_work/REPORTS/ENCOUNTER-VISIT-REPOSITORY-001B_repository.md`

No migrations, UI, hooks, timeline, seed, Supabase config, browser smoke, or cloud files were changed.

## 7. Current repository pattern recon

### Existing repository style

The project has a mixed repository history:

- older clinical repositories such as findings/treatment plans still include localStorage fallback paths for legacy prototype flows;
- newer high-integrity data boundaries such as audit/activity use a stricter Supabase-only repository with camelCase domain objects, explicit mappers, defensive tenant checks, bounded pagination, and no fake local data fallback;
- source-of-truth clinical workflow data should follow the audit/activity style, not the legacy localStorage style.

### Tenant/no-tenant behavior

The new repository follows the newer strict pattern:

- every list/get method requires `tenantId`;
- patient-scoped workflow reads require `patientId`;
- missing active clinic throws: `Active clinic is required for encounter/visit access.`;
- get-by-id methods require both `tenantId` and `id`.

### Error handling

The repository surfaces Supabase errors directly. It does not swallow RLS/data errors and does not hide partial workflow failures.

### Factory/local fallback pattern

A factory was added:

- `createEncounterVisitRepository({ backend: 'supabase' })` returns `SupabaseEncounterVisitRepository`;
- `backend: 'local'` throws `Encounter/visit repository requires Supabase backend.`;
- no localStorage fallback is provided.

That is intentional because visits, encounters, and completed services are clinical source-of-truth records.

## 8. Implementation summary

### Domain types

Added typed domain models:

- `PatientVisit`
- `ClinicalEncounter`
- `CompletedService`

Added status/type unions:

- `PatientVisitStatus`
- `PatientVisitType`
- `ClinicalEncounterStatus`
- `ClinicalEncounterType`
- `CompletedServiceStatus`

JSON metadata is represented as `Record<string, unknown>`.

### Query option types

Added:

- `ListPatientVisitsOptions`
- `ListClinicalEncountersOptions`
- `ListCompletedServicesOptions`
- `GetByIdOptions`
- `PatientScopedOptions`
- `ListPatientClinicalWorkflowOptions`

Limits are bounded:

- default limit: `50`
- max limit: `200`
- default offset: `0`

### Repository interface

Added read-only interface `EncounterVisitRepository` with methods:

- `listPatientVisits`
- `getPatientVisitById`
- `listClinicalEncounters`
- `getClinicalEncounterById`
- `listCompletedServices`
- `getCompletedServiceById`
- `listPatientClinicalWorkflow`

No create/update/delete/void/correct/start/complete/lock methods were added.

### Supabase implementation

Added `SupabaseEncounterVisitRepository`.

Behavior:

- uses the normal Supabase client;
- queries only the three schema tables;
- always filters by `tenant_id`;
- uses query builder filters, not raw SQL strings;
- relies on database RLS for authorization;
- still passes `tenantId` defensively;
- surfaces Supabase errors;
- has no fake/local fallback;
- has no service-role client path.

### Mappers

Added:

- `mapPatientVisitRow`
- `mapClinicalEncounterRow`
- `mapCompletedServiceRow`

They convert snake_case database rows to camelCase domain objects, default invalid/non-object metadata to `{}`, preserve nullable fields, convert numeric service values to numbers, and reject missing required fields/invalid required numbers instead of silently coercing them.

## 9. Domain boundary

The repository keeps the clinical workflow model separated:

- appointment references are only booking-context links;
- visit records represent attendance;
- encounter records represent clinical documentation sessions;
- completed service records represent performed service facts;
- treatment plan/stage references are optional planning links, not completion proof;
- unit/total amounts are service/billing snapshots, not payment facts;
- payment, stock, documents, audit/activity writes, and timeline integration remain future work.

## 10. Query behavior

### Tenant filters

All methods filter by `tenant_id` and throw before querying if tenant id is missing.

### Patient filters

Patient-scoped methods filter by `patient_id`. `listPatientClinicalWorkflow` calls all three list methods using the same `tenantId` and `patientId`.

### Status/type filters

Supported filters:

- visit statuses and visit types;
- encounter statuses and encounter types;
- service statuses;
- doctor/performed-by filters;
- appointment, visit, encounter, finding, plan, stage, and dictionary item filters where appropriate.

### Archived/voided handling

Defaults:

- patient visits exclude `status = archived` unless `includeArchived = true`;
- clinical encounters exclude `status = archived` unless `includeArchived = true`;
- completed services exclude `status = archived` unless `includeArchived = true`;
- completed services exclude `status = voided` unless `includeVoided = true`;
- corrected services remain visible by default because they are still part of the correction chain and not hidden by the 001B read boundary.

### Sorting

- `patient_visits`: `arrived_at desc`, then `created_at desc`
- `clinical_encounters`: `created_at desc`
- `completed_services`: `performed_at desc`, then `created_at desc`

### Pagination

All list methods apply bounded `.range(offset, offset + limit - 1)` with normalized limit and offset.

## 11. Safety boundary

Confirmed by implementation and tests:

- no write methods;
- no insert/update/delete/upsert/rpc calls;
- no localStorage fallback;
- no service-role usage;
- no audit/activity helper calls;
- no UI changes;
- no timeline integration;
- no migrations;
- RLS remains the source of authorization.

## 12. Tests

Test file:

- `src/data/repositories/EncounterVisitRepository.test.ts`

Covered scenarios:

- list methods require `tenantId`;
- get-by-id methods require `tenantId` and `id`;
- patient workflow method requires `tenantId` and `patientId`;
- patient visits query `patient_visits`;
- visit tenant/patient/appointment/status/type/date filters;
- visit archived default/include behavior;
- visit get-by-id and null result;
- clinical encounters query `clinical_encounters`;
- encounter tenant/patient/visit/appointment/doctor/status/type/date filters;
- encounter archived default/include behavior;
- encounter get-by-id;
- completed services query `completed_services`;
- service tenant/patient/visit/encounter/appointment/finding/plan/stage/dictionary/performedBy/status/date filters;
- service archived and voided default/include behavior;
- service get-by-id;
- workflow method calls all three lists with the same tenant/patient;
- Supabase errors surface;
- workflow does not hide partial errors;
- mappers convert snake_case to camelCase;
- numeric service fields map to numbers;
- invalid required mapper values throw;
- limit/offset normalization;
- factory rejects local backend;
- repository object exposes no write methods.

Targeted test result:

- `npm run test -- EncounterVisitRepository.test.ts --run`: PASS, 18 tests.

## 13. What was intentionally NOT changed

- no migrations;
- no Supabase cloud;
- no local Supabase requirement;
- no browser smoke;
- no UI;
- no PatientCardPage changes;
- no PatientTimelineAggregator changes;
- no timeline integration;
- no hooks;
- no RPC/write path;
- no payments;
- no stock;
- no documents;
- no seed changes;
- no generated types.

## 14. Checks

Local checks:

- `npm run test -- EncounterVisitRepository.test.ts --run`: PASS, 1 file / 18 tests
- `npm run lint`: PASS
- `npm run test -- --run`: PASS, 48 files / 432 tests
- `npm run build`: PASS

Notes:

- Existing React `act(...)` warnings appear in unrelated tests and remain non-blocking.
- Existing Vite chunk size warning appears during build and remains non-blocking.

GitHub Actions CI:

- Workflow: `CI`
- Run id: `27816932897`
- CI number: `557`
- Tested commit: `03b1034fe0ba6053968c997f51d80ef2142cb353`
- Job: `validate`
- ESLint: success
- Tests: success
- Build: success
- Conclusion: success

## 15. Final verdict

`ENCOUNTER VISIT REPOSITORY IMPLEMENTED AND VERIFIED`

## 16. Recommended next task

`ENCOUNTER-VISIT-RPC-001C`
