# ARCH-072 Schema Alignment Report

## Summary
The Supabase SQL schema (`0001_initial_schema.sql`) has been successfully aligned with the frontend TypeScript interfaces (`src/types/index.ts`). The database structure now perfectly matches the application's entity requirements, preventing data loss during the upcoming repository migration.

### Review Fixes Applied
- Removed local Supabase CLI artifacts from git tracking (`.branches/_current_branch`, `.temp/cli-latest`).
- Updated `DATABASE_SCHEMA.md` to perfectly match `0001_initial_schema.sql`, preserving all composite foreign key definitions (`tenant_id, id`).
- Updated `seed.sql` to include a valid `source` value (`phone`) for seeded patients.
- Added strict `CHECK` constraint for `findings.category` to match `FindingCategory` frontend enum exactly.
- Added `DEFAULT '{}'` for `tooth_states.surfaces`.

## Files Inspected
- `src/types/index.ts`
- `supabase/migrations/0001_initial_schema.sql`
- `supabase/seed.sql`
- `_ai_work/DATABASE_SCHEMA.md`

## Files Changed
- `supabase/migrations/0001_initial_schema.sql`: Updated all relevant tables to match TS interfaces.
- `supabase/seed.sql`: Replaced `first_name`/`last_name` with `full_name`.
- `_ai_work/DATABASE_SCHEMA.md`: Updated schema documentation blocks.
- `_ai_work/REPORTS/ARCH-072_schema_alignment_report.md`: Created this report.

## TypeScript ↔ SQL Compatibility Summary

| Table | Major Changes | Mapping Strategy |
|---|---|---|
| **patients** | Dropped `first_name`, `last_name`, `gender`, `email`. Added `full_name`, `source`, `status`, `notes`, `allergies`, `balance`, `bonus_balance`, `integration`. | `integration` uses `jsonb` to support the nested `PatientIntegrationMeta` structure without complex relational overhead. |
| **doctors** | Added `full_name`, `cabinet`, `color`, renamed `is_active` to `active`. | Kept `user_id` nullable (linking to `profiles`) but added explicit fields to `doctors` to match `Doctor` interface natively. |
| **appointments** | Added `cabinet`, `service`, `payment_type`, `source`, `price`, `comment`. Status constraint matches exactly. Made `patient_id` nullable. | Direct native SQL column mapping. Replaced `scheduled` status with `new` to match TS. |
| **chief_complaints**| Added `related_teeth`. | Uses `integer[] NOT NULL DEFAULT '{}'`. |
| **dental_charts** | Added `complaints`, `diagnosis`. | Direct text column mapping. |
| **tooth_states** | Added `surfaces`, `crown`, `root`, `gum`, `bone`, `canal`. Condition matches exactly. | `surfaces` uses `text[]`. `condition` matches `ToothCondition` type precisely. |
| **findings** | Renamed `type` to `category`. Added `title`, `description`, `risk_description`, `recommendation`, `is_chief_complaint_related`, `include_in_treatment_plan`. | Status mapped to match frontend enum precisely. |
| **treatment_plans** | Status includes `approved`. | Direct status matching. |
| **treatment_stages**| Renamed `name` to `title`. Added `teeth`, `description`, `finding_ids`, `source`. Status updated. | `teeth` uses `integer[]`, `finding_ids` uses `uuid[]`. `status` default to `planned`. |

## RLS Impact & Composite FK Preservation
- **Composite FK Preservation**: Confirmed that all composite FK protections implemented in ARCH-069 (e.g., `FOREIGN KEY (tenant_id, patient_id) REFERENCES patients(tenant_id, id)`) remain intact and unaltered.
- **RLS Impact**: RLS policies were **not** weakened. All previously defined MVP policies remain attached to their respective tables. New columns are automatically covered by the row-level constraints.

## Local Validation Result
✅ **Passed**: `npx supabase db reset` successfully applied the new `0001_initial_schema.sql` and `seed.sql` after all fixes. All tables, composite constraints, enums, and mock data seeded correctly.

## NPM Checks Result
✅ **Passed**:
- `npm run build`: Success
- `npm run lint`: Success
- `npm run test`: Success (33 tests passed in 6 files)

## Remaining Risks
- The frontend does not currently have a mechanism (`TenantProvider` / `AuthContext`) to inject `tenant_id` into repository queries. This is the last technical blocker before migration.
- RLS policies remain in MVP state and require role-specific hardening before production.

## Confirmations
- ✅ No source code (`src/*`) was modified.
- ✅ No packages (`package.json`) were modified.
- ✅ No Supabase SDK was installed.
- ✅ No cloud resources were used or created.

## Recommended Next Task
**ARCH-073 — Supabase Client and Auth/Tenant Context Design Skeleton**
