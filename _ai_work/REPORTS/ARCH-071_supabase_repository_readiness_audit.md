# ARCH-071: Supabase Repository Readiness Audit

## Files Inspected
- `src/data/repositories/*.ts` (Patient, Appointment, Doctor, DentalChart, ChiefComplaint, Findings, TreatmentPlans)
- `src/types/index.ts`
- `supabase/migrations/0001_initial_schema.sql`
- `supabase/config.toml`
- `package.json`

## Summary Verdict
**NOT READY FOR REPOSITORY MIGRATION.** 
While the foundational SQL schema and RLS policies are structurally sound and validated, there is a **critical mismatch** between the Frontend TypeScript interfaces and the Supabase SQL schema. The SQL schema is too simplified and is missing numerous fields that the React application currently relies on in `localStorage`. Migrating repositories right now would cause massive data loss and UI breakage.

## 1. Repository Contract Map & Risks
| Repository | Expected Tables | Complexity | Tenant Injection Strategy | Risk Level |
|---|---|---|---|---|
| `PatientRepository` | `patients` | Direct Table | Required on INSERT | High (Schema mismatch) |
| `DoctorRepository` | `doctors`, `profiles` | Join required (`first_name`, `last_name`) | Required on INSERT | High (Schema mismatch) |
| `AppointmentRepository` | `appointments` | Direct Table | Required on INSERT | High (Schema mismatch) |
| `ChiefComplaintRepository` | `chief_complaints` | Direct Table | Required on INSERT | Medium |
| `FindingsRepository` | `findings` | Direct Table | Required on INSERT | High (Schema mismatch) |
| `TreatmentPlansRepository` | `treatment_plans`, `treatment_stages` | RPC/Transaction needed for atomic nested inserts | Required on INSERT | High |
| `DentalChartRepository` | `dental_charts`, `tooth_states` | RPC/Transaction needed for atomic nested inserts | Required on INSERT | High |

## 2. Type Compatibility Risks (CRITICAL)
A severe divergence exists between `src/types/index.ts` and `0001_initial_schema.sql`:

- **Patient:** TS expects `fullName`, `allergies`, `balance`, `bonusBalance`, `integration`, `notes`, `source`, `status`. SQL only has `first_name`, `last_name`, `gender`, `birth_date`, `phone`, `email`.
- **Doctor:** TS expects `cabinet`, `color`, `fullName`. SQL only has `specialization`, `is_active` and links to `profiles` for names.
- **Appointment:** TS expects `cabinet`, `service`, `paymentType`, `source`, `price`, `comment`. SQL only has `start_time`, `end_time`, `notes`, `status`.
- **ChiefComplaint:** TS expects `relatedTeeth: number[]`. SQL is missing this.
- **DentalChart / ToothState:** TS `DentalChart` has `complaints`, `diagnosis`. `ToothRecord` has `surfaces`, `crown`, `root`, `gum`, `bone`, `canal`. SQL only has `condition` and `notes`.
- **Finding:** TS expects `title`, `description`, `riskDescription`, `recommendation`, `isChiefComplaintRelated`, `includeInTreatmentPlan`. SQL only has `type`, `severity`, `notes`.
- **TreatmentStage:** TS expects `teeth: number[]`, `description`, `findingIds`, `source`. SQL only has `name`, `price`, `status`, `order_index`.

**Verdict:** The database schema must be expanded to match the frontend state before replacing `storage.ts`.

## 3. Auth and Tenant Context Assumptions
- **User Identity:** `auth.uid()` links to `profiles`.
- **Tenant Context:** `tenant_users` maps users to clinics. The frontend will need an `AuthContext` and `TenantContext` to know the "active" `tenant_id`.
- **Injection:** Repositories have no `tenant_id` in their contracts. The concrete Supabase repository implementations will need to pull `tenant_id` from a singleton or context provider and inject it into all `INSERT` payloads, as RLS `WITH CHECK` enforces it, and the schema requires it (`NOT NULL`).

## 4. RLS Risks
- **Current State:** Tenant-isolation MVP is functional and secure. Cross-tenant leakage is mathematically prevented.
- **Role Authorization:** Roles exist in `app_role` and `tenant_users.role`, but RLS policies broadly allow any tenant member to `INSERT/UPDATE/DELETE` (unless restricted to admins). This MVP assumption is fine for prototyping but requires hardening before production.
- **Immutability:** `audit_logs` correctly blocks `UPDATE` and `DELETE`. `integration_tokens` is securely locked away from the frontend.

## 5. Environment & Config Risks
- **Required:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- **Forbidden:** Service role keys must never be committed or prefixed with `VITE_`.
- **Local CLI:** Confirmed configured to use `npx supabase`.

## 6. LocalStorage Migration Risks
- **Monolith:** `storage.ts` holds the entire database in memory.
- **Seeding:** `storage.init()` seeds the initial app state. Once we migrate a repository, that specific domain's seed must be moved to SQL `seed.sql` and removed from `storage.init()`.
- We cannot delete `storage.ts` until *all* repositories are migrated.

## 7. Recommended Implementation Sequence
Because of the massive schema mismatch, we must alter the migration plan.

1. **ARCH-072: Schema Alignment (Database update)**
   - Expand `0001_initial_schema.sql` to include all missing columns required by the TypeScript interfaces (`cabinet`, `color`, `allergies`, `balance`, `relatedTeeth`, etc.).
2. **ARCH-073: Supabase Client & Auth Context**
   - Install `@supabase/supabase-js`.
   - Setup `supabase.ts` singleton and `AuthContext` / `TenantProvider` in React so repositories know the active `tenant_id`.
3. **ARCH-074: Pilot Repository Migration**
   - Migrate a simple, standalone repository first (e.g., `ChiefComplaintRepository` or `DoctorRepository`) to validate the pattern.
4. **ARCH-075+: Complex Repository Migrations**
   - Migrate nested entities (`TreatmentPlans`, `DentalCharts`) using Supabase RPCs (stored procedures) to handle atomic cross-table inserts.

## Blockers before production
- Schema mismatch (Critical).
- Lack of frontend Auth/Tenant context (High).
- Complex RPC creation for nested data (Medium).
- Role-specific RLS hardening (Medium).

---
**Confirmations:**
- [x] No source code changed.
- [x] No package changed.
- [x] No database migrations changed.
- [x] No cloud resources used.
