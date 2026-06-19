# ENCOUNTER-VISIT-RPC-CLIENT-001D: typed encounter visit RPC client

## Summary

This task adds a typed frontend/data-layer RPC client wrapper for the controlled encounter/visit write RPCs introduced by the backend RPC layer. The client converts camelCase frontend inputs into snake_case PostgreSQL RPC parameters, validates required inputs before calls, surfaces Supabase RPC errors, and maps returned database rows back into existing domain types.

This is a client wrapper only. It does not create UI, hooks, timeline integration, direct table writes, localStorage fallback, migrations, cloud changes, or service-role client access.

## Branch name

`feature/encounter-visit-rpc-client-001d`

## PR URL

https://github.com/NckNA/codex-test/pull/314

## PR head reviewed before final report update

`3df4127084e98599d7c38130d992c79d7a873cdc`

## Report update commit

N/A because the final report update commit cannot reference itself before creation.

## Changed files summary

Expected files only:

- `src/data/repositories/EncounterVisitRpcClient.ts`
- `src/data/repositories/EncounterVisitRpcClient.test.ts`
- `_ai_work/REPORTS/ENCOUNTER-VISIT-RPC-CLIENT-001D_client.md`

No migrations, Supabase cloud changes, UI modifications, hook changes, timeline integration, localStorage fallback, service-role usage, or direct table writes.

## Current pattern recon

Existing repository/client patterns show these conventions:

- Data-layer files live under `src/data/repositories/`.
- Supabase-backed implementations accept a `SupabaseClient` and use the normal Supabase client APIs.
- Clinical source-of-truth data should not use localStorage or fake local fallback storage.
- Read models use typed domain objects and map Supabase snake_case rows into camelCase application types.
- Errors from Supabase are surfaced rather than swallowed.
- Tenant context is passed explicitly and validated before data access.
- Factories reject unsupported local backends for source-of-truth clinical records.
- Tests use mocked Supabase clients/chains and assert table/RPC names, parameters, validation behavior, mapper output, and error surfacing.

For this client, the closest existing patterns are:

- `EncounterVisitRepository.ts` for domain types and mappers.
- `AuditActivityRepository.ts` for strict backend behavior without unsafe localStorage fallback.
- Existing repository tests for mocked Supabase interaction and safety assertions.

## Implementation summary

### Input types

The client adds typed input contracts for all supported RPC calls:

- `CheckInPatientVisitInput`
- `StartPatientVisitInput`
- `CompletePatientVisitInput`
- `CancelPatientVisitInput`
- `CreateClinicalEncounterInput`
- `StartClinicalEncounterInput`
- `CompleteClinicalEncounterInput`
- `RecordCompletedServiceInput`
- `VoidCompletedServiceInput`

Validation includes:

- `tenantId` required for every method.
- Patient id required for check-in, encounter creation, and completed service recording.
- Visit id required for start/complete/cancel visit.
- Encounter id required for start/complete encounter.
- Completed service id and reason required for voiding completed services.
- Cancellation reason required for visit cancellation.
- Service name required for completed service recording.
- Quantity must be greater than zero when supplied.
- Unit price and total amount cannot be negative when supplied.
- Metadata must be a JSON object, not null, primitive, or array.

### Client interface

`EncounterVisitRpcClient` exposes exactly these methods:

- `checkInPatientVisit`
- `startPatientVisit`
- `completePatientVisit`
- `cancelPatientVisit`
- `createClinicalEncounter`
- `startClinicalEncounter`
- `completeClinicalEncounter`
- `recordCompletedService`
- `voidCompletedService`

The interface intentionally does not expose direct table insert/update/delete operations.

### Supabase implementation

`SupabaseEncounterVisitRpcClient` uses `client.rpc(...)` only. It does not call `client.from(...)` for writes and does not build raw SQL strings. Each method validates inputs, calls one PostgreSQL RPC by name, throws returned Supabase errors, extracts a single returned row, and maps it into the corresponding domain type.

### Mapper reuse/export

The implementation reuses existing mappers exported by `EncounterVisitRepository.ts`:

- `mapPatientVisitRow`
- `mapClinicalEncounterRow`
- `mapCompletedServiceRow`

This keeps row-to-domain mapping in one place and avoids duplicate snake_case/camelCase mapping logic.

### Factory

`createEncounterVisitRpcClient(...)` supports:

- `backend: 'supabase'` returning a `SupabaseEncounterVisitRpcClient`.
- `backend: 'local'` rejected with `Encounter/visit RPC client requires Supabase backend.`

The factory accepts an injected Supabase client for tests and falls back to the shared frontend Supabase client when configured.

## RPC mapping

All 9 client methods map to controlled PostgreSQL RPCs:

| Client method | PostgreSQL RPC | Key parameter mapping |
|---|---|---|
| `checkInPatientVisit` | `check_in_patient_visit` | `tenantId -> p_tenant_id`, `patientId -> p_patient_id`, `appointmentId -> p_appointment_id`, `visitType -> p_visit_type`, `arrivedAt -> p_arrived_at`, `notes -> p_notes`, `metadata -> p_metadata` |
| `startPatientVisit` | `start_patient_visit` | `tenantId -> p_tenant_id`, `visitId -> p_visit_id`, `metadata -> p_metadata` |
| `completePatientVisit` | `complete_patient_visit` | `tenantId -> p_tenant_id`, `visitId -> p_visit_id`, `metadata -> p_metadata` |
| `cancelPatientVisit` | `cancel_patient_visit` | `tenantId -> p_tenant_id`, `visitId -> p_visit_id`, `reason -> p_reason`, `metadata -> p_metadata` |
| `createClinicalEncounter` | `create_clinical_encounter` | `tenantId -> p_tenant_id`, `patientId -> p_patient_id`, `visitId -> p_visit_id`, `appointmentId -> p_appointment_id`, `doctorUserId -> p_doctor_user_id`, `encounterType -> p_encounter_type`, `chiefComplaintSnapshot -> p_chief_complaint_snapshot`, `clinicalSummary -> p_clinical_summary`, `metadata -> p_metadata` |
| `startClinicalEncounter` | `start_clinical_encounter` | `tenantId -> p_tenant_id`, `encounterId -> p_encounter_id`, `metadata -> p_metadata` |
| `completeClinicalEncounter` | `complete_clinical_encounter` | `tenantId -> p_tenant_id`, `encounterId -> p_encounter_id`, `clinicalSummary -> p_clinical_summary`, `metadata -> p_metadata` |
| `recordCompletedService` | `record_completed_service` | `tenantId -> p_tenant_id`, `patientId -> p_patient_id`, `visitId -> p_visit_id`, `encounterId -> p_encounter_id`, `appointmentId -> p_appointment_id`, `findingId -> p_finding_id`, `treatmentPlanId -> p_treatment_plan_id`, `treatmentStageId -> p_treatment_stage_id`, `clinicalDictionaryItemId -> p_clinical_dictionary_item_id`, `serviceCode -> p_service_code`, `serviceName -> p_service_name`, `toothNumber -> p_tooth_number`, `toothSurface -> p_tooth_surface`, `quantity -> p_quantity`, `unitPrice -> p_unit_price`, `totalAmount -> p_total_amount`, `currency -> p_currency`, `performedAt -> p_performed_at`, `metadata -> p_metadata` |
| `voidCompletedService` | `void_completed_service` | `tenantId -> p_tenant_id`, `completedServiceId -> p_completed_service_id`, `reason -> p_reason`, `metadata -> p_metadata` |

Default parameter behavior:

- `visitType` defaults to `regular`.
- `encounterType` defaults to `consultation`.
- `quantity` defaults to `1`.
- `currency` defaults to `KZT`.
- Optional ids/text timestamps are sent as `null` when omitted.
- Metadata defaults to `{}` when omitted.

## Domain boundary

This client preserves the encounter/visit domain boundaries:

- Appointment is scheduling/booking context. It is not a visit and not proof of completed clinical treatment.
- Patient visit is an actual attendance instance.
- Clinical encounter is the documented clinical session or doctor interaction.
- Completed service is the performed clinical/billable service fact.
- Completed service is not a treatment plan or treatment stage; plan/stage ids are references to intended work only.
- Payment is a future financial fact and is not proof that treatment occurred.
- The client wrapper is not the source of truth. Database RPCs remain the controlled write boundary and are responsible for durable state changes, authorization/RLS interaction, audit/activity emission, and transactional integrity.

## Safety boundary

This task intentionally keeps the client narrow:

- No direct table writes.
- No direct `insert`, `update`, `delete`, or `upsert` repository methods.
- No `service_role` usage in frontend code.
- No localStorage fallback.
- No fake clinical history.
- No UI.
- No hooks.
- No PatientCardPage changes.
- No PatientTimelineAggregator changes.
- No timeline integration.
- No Supabase cloud access.
- No browser smoke.
- No migration changes.
- No seed/backfill changes.
- No payment, stock, or document work.

The frontend client delegates all state-changing behavior to the existing database RPC layer and surfaces errors rather than silently falling back.

## Tests

Test file:

- `src/data/repositories/EncounterVisitRpcClient.test.ts`

Scenarios covered:

- All 9 methods require `tenantId`.
- `checkInPatientVisit` requires `patientId`.
- Visit start/complete/cancel methods require `visitId`.
- `cancelPatientVisit` requires a reason.
- `createClinicalEncounter` requires `patientId`.
- Encounter start/complete methods require `encounterId`.
- `recordCompletedService` requires `patientId` and `serviceName`.
- `recordCompletedService` rejects non-positive quantity.
- `recordCompletedService` rejects negative `unitPrice` and `totalAmount`.
- `voidCompletedService` requires `completedServiceId` and reason.
- Metadata rejects null, primitive, and array values.
- Every client method calls the expected RPC name.
- Every client method maps camelCase inputs to expected `p_*` parameters.
- Default values are applied for completed service quantity/currency.
- Patient visit, clinical encounter, and completed service responses map back to camelCase domain objects.
- Supabase RPC errors are surfaced.
- Empty/null RPC responses throw a clear error.
- Direct table write use is not part of the client wrapper behavior.
- Factory rejects `local` backend.
- Factory requires a configured Supabase client.

Targeted implementation validation covered 36 new unit tests in the RPC client test file.

## What was intentionally NOT changed

- No migrations.
- No Supabase cloud.
- No local Supabase validation or local database changes.
- No browser smoke.
- No UI.
- No hooks.
- No PatientCardPage changes.
- No PatientTimelineAggregator changes.
- No timeline integration.
- No payments.
- No stock.
- No documents.
- No seed changes.
- No backfill.
- No localStorage fallback.
- No direct table write path.

## Checks

| Check | Result |
|---|---|
| `git status --short` | clean before report-only update |
| `npm run lint` | PASS |
| `npm run test -- --run` | PASS (49 files / 468 tests) |
| `npm run build` | PASS |
| GitHub Actions CI | PASS |

## GitHub Actions CI

GitHub Actions CI run completed successfully for the reviewed PR head.

| Field | Value |
|---|---|
| workflow | `CI` |
| run id | `27851119363` |
| CI number | `566` |
| status | `completed` |
| conclusion | `success` |
| tested commit | `3df4127084e98599d7c38130d992c79d7a873cdc` |
| job | `validate` |
| ESLint | success |
| tests | success |
| build | success |

## Final verdict

ENCOUNTER VISIT RPC CLIENT IMPLEMENTED AND VERIFIED

## Recommended next task

VISIT-CHECKIN-UI-001
