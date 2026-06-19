# ENCOUNTER-VISIT-RPC-001C — Database Write RPCs Report

## 1. Summary

This task implements and verifies controlled PostgreSQL RPC functions to act as the secure, authenticated write paths for visits, clinical encounters, and completed services.

All operations strictly validate tenant bounds, user roles, reference entity scopes, and status transitions, logging one audit event and one activity event in the same database transaction.

Final Verdict: **ENCOUNTER VISIT RPC WRITE PATH IMPLEMENTED AND VERIFIED**

## 2. Branch Name

`feature/encounter-visit-rpc-001c`

## 3. PR URL

https://github.com/NckNA/codex-test/pull/312

## 4. PR head reviewed before final report update

`7ef074b8c687c72b42649ccf810e27c3f3ee2ef3`

## 5. Report update commit

N/A because the final report update commit cannot reference itself before creation.

## 6. Changed files summary

Expected report-only and migration changes:

- `supabase/migrations/0015_create_encounter_visit_rpc.sql` (NEW)
- `_ai_work/REPORTS/ENCOUNTER-VISIT-RPC-001C_rpc.md` (NEW)

No app code, UI, frontend repository write methods, or seed changes were made.

## 7. Current RPC / Schema Recon

### audit_events table
- **Columns**: `id`, `tenant_id`, `actor_user_id`, `actor_role`, `actor_tenant_role`, `actor_display_name`, `action`, `category`, `severity`, `target_type`, `target_id`, `patient_id`, `appointment_id`, `visit_id`, `encounter_id`, `treatment_plan_id`, `treatment_stage_id`, `finding_id`, `file_id`, `payment_id`, `stock_movement_id`, `before_data`, `after_data`, `diff_data`, `redaction_level`, `reason`, `request_id`, `session_id`, `ip_address`, `user_agent`, `metadata`, `created_at`.
- **Category constraints**: `auth`, `tenant`, `role_membership`, `patient`, `appointment`, `visit`, `encounter`, `finding`, `treatment_plan`, `completed_service`, `file`, `document`, `payment`, `stock`, `dictionary`, `billing_subscription`, `system`, `support_access`.
- **Severity constraints**: `debug`, `info`, `warning`, `critical`.
- **Redaction levels**: `none`, `standard`, `restricted`, `confidential`.

### activity_events table
- **Columns**: `id`, `tenant_id`, `patient_id`, `audit_event_id`, `actor_user_id`, `category`, `type`, `title`, `description`, `source_type`, `source_id`, `source_status`, `visibility`, `severity`, `occurred_at`, `metadata`, `is_archived`, `created_at`.
- **Category constraints**: `patient`, `complaint`, `dental_chart`, `finding`, `treatment_plan`, `appointment`, `visit`, `encounter`, `completed_service`, `file`, `document`, `payment`, `stock`, `audit`, `system`.
- **Visibility constraints**: `clinical`, `admin`, `financial`, `system`.

### Helper signatures
1. `public.record_audit_event_internal(...)`
   - **Signature**: `public.record_audit_event_internal(p_tenant_id uuid, p_action text, p_category text, p_target_type text, p_target_id text, ...)`
   - **Grants**: Revoked from `PUBLIC`, `anon`, and `authenticated`. Granted exclusively to `service_role`.
   - **SECURITY DEFINER**: Enabled.
   - **search_path**: `public, pg_temp`
2. `public.record_activity_event_internal(...)`
   - **Signature**: `public.record_activity_event_internal(p_tenant_id uuid, p_category text, p_type text, p_title text, p_source_type text, p_source_id text, ...)`
   - **Grants**: Revoked from `PUBLIC`, `anon`, and `authenticated`. Granted exclusively to `service_role`.
   - **SECURITY DEFINER**: Enabled.
   - **search_path**: `public, pg_temp`
3. `public.has_tenant_role(...)`
   - **Signature**: `public.has_tenant_role(target_tenant_id uuid, allowed_roles app_role[]) RETURNS boolean`
   - **Grants**: Revoked from `PUBLIC` and `anon`. Granted to `authenticated` and `service_role`.

### app_role enum values
- `platform_owner`, `platform_admin`, `clinic_owner`, `clinic_admin`, `doctor`, `registrar`, `cashier`, `marketer`, `support`.

### Clinical workflow tables
1. **`public.patient_visits`**
   - **ID types**: `id` uuid, `patient_id` uuid, `appointment_id` uuid.
   - **Status constraints**: `checked_in`, `in_progress`, `completed`, `cancelled`, `archived`.
2. **`public.clinical_encounters`**
   - **ID types**: `id` uuid, `patient_id` uuid, `visit_id` uuid, `appointment_id` uuid.
   - **Status constraints**: `draft`, `in_progress`, `completed`, `locked`, `archived`.
3. **`public.completed_services`**
   - **ID types**: `id` uuid, `patient_id` uuid, `visit_id` uuid, `encounter_id` uuid, `appointment_id` uuid, `finding_id` uuid, `treatment_plan_id` uuid, `treatment_stage_id` uuid, `clinical_dictionary_item_id` text.
   - **Status constraints**: `completed`, `corrected`, `voided`, `archived`.

### Table grants before/after
- **Before**: Direct INSERT/UPDATE/DELETE writes are fully revoked from `authenticated` and `anon` for all three tables. Only `SELECT` is allowed.
- **After**: Direct writes remain fully blocked. Modification is only permitted through the newly created `SECURITY DEFINER` RPC functions.

## 8. Migration Summary

- **Migration filename**: `supabase/migrations/0015_create_encounter_visit_rpc.sql`
- **RPC Functions created**:
  1. `public.check_in_patient_visit(...)`
  2. `public.start_patient_visit(...)`
  3. `public.complete_patient_visit(...)`
  4. `public.cancel_patient_visit(...)`
  5. `public.create_clinical_encounter(...)`
  6. `public.start_clinical_encounter(...)`
  7. `public.complete_clinical_encounter(...)`
  8. `public.record_completed_service(...)`
  9. `public.void_completed_service(...)`
- **Security & Grants**:
  - Every function sets `SECURITY DEFINER` and a safe `search_path = public, pg_temp`.
  - Execute permission is revoked from `PUBLIC` and `anon`.
  - Execute permission is granted to `authenticated`.
  - Roles are checked inside each function using `public.has_tenant_role`.
  - Cross-tenant references are strictly validated.

## 9. RPC Behavior

1. **`check_in_patient_visit`**: Creates a visit row with status `checked_in`. Checks tenant and patient existence. Validates that the appointment belongs to the same patient and tenant, and checks that no other active visit exists for that appointment.
2. **`start_patient_visit`**: Updates status to `in_progress`. Transitions are only allowed from `checked_in`.
3. **`complete_patient_visit`**: Updates status to `completed`. Allowed from `checked_in` or `in_progress`. Blocked for the `registrar` role.
4. **`cancel_patient_visit`**: Updates status to `cancelled`. Allowed from `checked_in` or `in_progress`. Requires a cancellation reason, which is written to the audit log and appended to visit notes.
5. **`create_clinical_encounter`**: Creates a draft encounter. Validates that the patient, visit, and appointment exist and belong to the same tenant. If a doctor user ID is specified, verifies it has the appropriate clinic role.
6. **`start_clinical_encounter`**: Updates status to `in_progress`. Allowed from `draft` status.
7. **`complete_clinical_encounter`**: Updates status to `completed`. Allowed from `draft` or `in_progress` status.
8. **`record_completed_service`**: Records a service fact (status `completed`). Validates referenced patient, visit, encounter, appointment, finding, plan, stage, and clinical dictionary item. Ensures quantity > 0, price >= 0, and name is non-empty.
9. **`void_completed_service`**: Voids a service fact (status `voided`). Allowed from `completed` or `corrected`. Requires a reason, which is logged and saved in the correction reason column.

## 10. Domain Boundary

- **Appointment**: Represents booking intent, not actual attendance or clinical fact.
- **Patient Visit**: Represents physical/administrative attendance context. Complete visit does not automatically record treatment.
- **Clinical Encounter**: Represents doctor session / documentation context. Draft/in_progress/completed lifecycles.
- **Completed Service**: Represents a billable/performed service fact. Plan stage/finding links do not modify treatment plans.
- **Audit/Activity**: Security/compliance log and SAFE timeline feeds, not source clinical facts.

## 11. Audit/Activity Behavior

- Successful writes emit exactly one `audit_event` and one `activity_event` using internal helpers.
- Categories used: `visit`, `encounter`, `completed_service`.
- Metadata is kept concise (target IDs and transition tags) and contains no raw clinical summary/PHI payloads.

## 12. RLS / Grants / Write Boundary

- Direct table writes remain fully blocked for `authenticated` and `anon`.
- Access is gated at the RPC level. No anonymous calls are possible.
- Roles are strictly enforced (e.g. cashiers and no-tenant users are denied access).

## 13. Local Validation

- **Supabase status**: Running.
- **npx supabase db reset**: PASS. Applied all 15 migrations successfully.
- **Function existence & Security**: Verified.
- **Direct write block test**: PASS. direct writes from an `authenticated` role return `insufficient_privilege`.
- **Role simulations**:
  - Clinic A Admin: Allowed all visit, encounter, and service writes.
  - Clinic A Doctor: Allowed all visit, encounter, and service writes.
  - Clinic A Registrar: Allowed checking in, starting, and cancelling visits. Blocked from completing visits, creating encounters, and recording services.
  - Clinic A Cashier: Blocked from all writes.
  - No Tenant: Blocked from all writes.
  - Clinic B Admin: Blocked from editing Clinic A records (cross-tenant validation).
- **Status transition tests**: Verified. Cannot complete a cancelled visit, cannot start a completed visit, etc.
- **Invalid payloads**: Rejected correctly (empty names, negative prices, null tenants, zero quantity).
- **Audit/Activity logging**: Verified. Triggering RPCs increments both `audit_events` and `activity_events` counts with correct categories and source IDs.
- **Database cleanup**: Verified. All test rows with the smoke marker `metadata->>'smokeTest' = 'ENCOUNTER-VISIT-RPC-001C'` were successfully deleted.
- **Final marker counts**:
  - `patient_visits` = 0
  - `clinical_encounters` = 0
  - `completed_services` = 0
  - `audit_events` = 0
  - `activity_events` = 0

## 14. What was intentionally NOT changed

- No application code changes.
- No UI components or pages updated.
- No frontend repository write client methods added.
- No hooks added.
- No seed script changes.

## 15. Checks

- `git status --short`: Clean, showing only the migration file and this report.
- `npm run lint`: **PASS**.
- `npm run test -- --run`: **PASS** (432 tests passed across 48 files).
- `npm run build`: **PASS** (Build succeeds).
- **GitHub Actions CI**: pending

## 16. Issues/Warnings

- React `act(...)` warning in unrelated tests (pre-existing).
- Vite chunk size warning (pre-existing).

## 17. Final Verdict

```
ENCOUNTER VISIT RPC WRITE PATH IMPLEMENTED AND VERIFIED
```

## 18. Recommended Next Task

```
ENCOUNTER-VISIT-RPC-CLIENT-001D
```
