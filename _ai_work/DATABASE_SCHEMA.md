# DentalFlow Supabase PostgreSQL Schema and RLS Design

## 1. Design Principles
- **Multi-tenant by default:** Every tenant-owned table (patients, appointments, charts, etc.) MUST have a `tenant_id` column.
- **Strict Row-Level Security (RLS):** RLS must be enabled on every tenant-owned table. It acts as a safety net, but must be explicitly designed and audited.
- **Frontend limits:** The `service_role` key must NEVER be exposed to the frontend. The frontend must only use the `anon` key combined with the authenticated user's JWT context.
- **Tenant context preservation:** Edge Functions or backend proxies must preserve and validate the tenant context when acting on behalf of a user.
- **Data isolation boundaries:** Medical data (charts, findings, chief complaints) must strictly reside within the Supabase boundary and must never be exposed to or synchronized with external CRMs like amoCRM.
- **Non-destructive billing:** Billing or access control enforcement must restrict `SELECT/INSERT/UPDATE` operations for unpaid tenants but must never delete tenant data.

## 2. Core SaaS Tables

```sql
-- TENANTS (Clinics/Organizations)
CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  status text DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted'))
);

-- PROFILES (Extended user data)
-- Links to auth.users
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  phone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ROLES ENUM
CREATE TYPE app_role AS ENUM (
  'platform_owner', 'platform_admin', 
  'clinic_owner', 'clinic_admin', 
  'doctor', 'registrar', 'cashier', 'marketer', 'support'
);

-- TENANT_USERS (Many-to-Many mapping Users to Tenants with Roles)
CREATE TABLE tenant_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'registrar',
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);
CREATE INDEX idx_tenant_users_user_id ON tenant_users(user_id);

-- SUBSCRIPTIONS
CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stripe_customer_id text,
  status text DEFAULT 'trialing' CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid')),
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_subscriptions_tenant_id ON subscriptions(tenant_id);

-- AUDIT LOGS
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);
```

## 3. Medical/Clinic Tables

```sql
-- PATIENTS
CREATE TABLE patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  birth_date date,
  phone text,
  source text CHECK (source IN ('phone', 'whatsapp', 'instagram', 'walk_in', 'repeat', 'referral')),
  status text DEFAULT 'active',
  notes text,
  allergies text,
  balance numeric(10,2) DEFAULT 0,
  bonus_balance numeric(10,2) DEFAULT 0,
  integration jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, id)
);
CREATE INDEX idx_patients_tenant_id ON patients(tenant_id);

-- DOCTORS (Represents the clinical role, may map 1:1 with tenant_users/profiles)
CREATE TABLE doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id),
  full_name text NOT NULL,
  specialization text,
  cabinet text,
  color text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, id)
);
CREATE INDEX idx_doctors_tenant_id ON doctors(tenant_id);

-- APPOINTMENTS
CREATE TABLE appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id uuid,
  doctor_id uuid,
  cabinet text,
  service text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'confirmed', 'arrived', 'in_progress', 'completed', 'cancelled', 'no_show', 'blocked')),
  payment_type text CHECK (payment_type IN ('cash', 'card', 'kaspi', 'insurance', 'installment', 'unpaid')),
  source text CHECK (source IN ('phone', 'whatsapp', 'instagram', 'walk_in', 'repeat', 'referral')),
  price numeric(10,2),
  comment text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  FOREIGN KEY (tenant_id, patient_id) REFERENCES patients(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, doctor_id) REFERENCES doctors(tenant_id, id) ON DELETE SET NULL (doctor_id)
);
CREATE INDEX idx_appointments_tenant_id ON appointments(tenant_id);
CREATE INDEX idx_appointments_patient_id ON appointments(patient_id);

-- CHIEF COMPLAINTS
CREATE TABLE chief_complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  text text NOT NULL,
  related_teeth integer[] NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, patient_id)
);

-- DENTAL CHARTS
CREATE TABLE dental_charts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  complaints text,
  diagnosis text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, patient_id)
);

-- TOOTH STATES (Dental Chart Teeth)
CREATE TABLE tooth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  dental_chart_id uuid NOT NULL REFERENCES dental_charts(id) ON DELETE CASCADE,
  tooth_number integer NOT NULL,
  condition text NOT NULL CHECK (condition IN ('healthy', 'caries', 'filled', 'missing', 'crown', 'implant', 'root', 'pulpitis', 'periodontitis', 'needs_treatment')),
  surfaces text[],
  crown text,
  root text,
  gum text,
  bone text,
  canal text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(dental_chart_id, tooth_number)
);

-- FINDINGS
CREATE TABLE findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  tooth_number integer,
  title text NOT NULL,
  category text NOT NULL,
  status text NOT NULL DEFAULT 'discovered' CHECK (status IN ('discovered', 'recommended', 'included_in_plan', 'observing', 'declined_by_patient', 'completed')),
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'urgent')),
  description text NOT NULL,
  risk_description text,
  recommendation text,
  is_chief_complaint_related boolean DEFAULT false,
  include_in_treatment_plan boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_findings_tenant_patient ON findings(tenant_id, patient_id);

-- TREATMENT PLANS
CREATE TABLE treatment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'in_progress', 'completed', 'cancelled')),
  total_price numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- TREATMENT STAGES
CREATE TABLE treatment_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  treatment_plan_id uuid NOT NULL REFERENCES treatment_plans(id) ON DELETE CASCADE,
  title text NOT NULL,
  teeth integer[] DEFAULT '{}',
  description text,
  price numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  finding_ids uuid[],
  source text CHECK (source IN ('manual', 'from_finding')),
  order_index integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- DOCUMENTS METADATA
CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_size integer NOT NULL,
  file_type text,
  storage_path text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- INTEGRATION TOKENS
CREATE TABLE integration_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('amocrm')),
  access_token_encrypted text NOT NULL, -- Never exposed to frontend
  refresh_token_encrypted text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, provider)
);

**WARNING - Integration Tokens:**
- service-role access must only exist in Edge Functions/backend proxy
- Edge Functions must validate the caller `auth.uid()` and tenant membership before using service-role
- never expose `access_token_encrypted` or `refresh_token_encrypted` to frontend responses
```

## 4. RLS Helper Functions

Assumptions:
- The frontend will set the `tenant_id` in a custom JWT claim or via a custom header read by Supabase auth hook, OR the frontend simply relies on `auth.uid()` joining against `tenant_users`. We'll assume the safest route: relying strictly on the database joining against `tenant_users` or an explicit Supabase custom JWT claim.
- For maximum performance, JWT claims containing `tenant_id` and `role` are preferred, but standard database joins are safer for MVP. Here we use DB joins for guaranteed correctness.

```sql
-- Get tenants the current user belongs to
CREATE OR REPLACE FUNCTION get_user_tenants()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid();
$$;

-- Check if user has specific role in a tenant
CREATE OR REPLACE FUNCTION has_tenant_role(target_tenant_id uuid, allowed_roles app_role[])
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND tenant_id = target_tenant_id 
      AND role = ANY(allowed_roles)
  );
$$;
```

## 5. RLS Policy Templates

All tenant-owned tables (e.g., `patients`) must explicitly define 4 policies to prevent implicit gaps.

```sql
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

-- SELECT: User must belong to the tenant
CREATE POLICY "Users can view patients in their tenant"
ON patients FOR SELECT
USING (tenant_id IN (SELECT get_user_tenants()));

-- INSERT: User must belong to the tenant, and they must provide that exact tenant_id
CREATE POLICY "Users can insert patients in their tenant"
ON patients FOR INSERT
WITH CHECK (tenant_id IN (SELECT get_user_tenants()));

-- UPDATE: User must belong to the tenant
CREATE POLICY "Users can update patients in their tenant"
ON patients FOR UPDATE
USING (tenant_id IN (SELECT get_user_tenants()))
WITH CHECK (tenant_id IN (SELECT get_user_tenants()));

-- DELETE: Only specific roles (e.g., clinic_admin, clinic_owner) can delete
CREATE POLICY "Only admins can delete patients"
ON patients FOR DELETE
USING (has_tenant_role(tenant_id, ARRAY['clinic_admin'::app_role, 'clinic_owner'::app_role]));
```

*Note: This exact pattern is repeated for `appointments`, `chief_complaints`, `dental_charts`, `tooth_states`, `findings`, `treatment_plans`, `treatment_stages`, `documents`, and `doctors`.*

**Exceptions:**
- `audit_logs`: `INSERT` allowed for any user in the tenant, but `UPDATE` and `DELETE` are strictly `FALSE` for everyone.
- `integration_tokens`: `SELECT`, `INSERT`, `UPDATE`, `DELETE` are explicitly `FALSE` for all frontend roles. These tables are strictly operated upon by `service_role` keys inside Edge Functions/Backend Proxies.

## 5.1 RLS Policy Coverage Matrix

| Table | SELECT policy | INSERT policy | UPDATE policy | DELETE policy | Special notes |
|---|---|---|---|---|---|
| **tenants** | Tenant members can read own metadata | Platform admin manage | Platform admin manage | Platform admin manage | Readonly for clinic staff |
| **profiles** | Users can read own, tenant members read within clinic | Auth hook/Platform admin manage | User update own profile | Platform admin manage | Tied to auth.users |
| **tenant_users** | Tenant members read own tenant list | Tenant owner/admin manage inside own tenant, platform admin globally | Tenant owner/admin manage inside own tenant | Tenant owner/admin manage inside own tenant | Grants access |
| **subscriptions** | Tenant owner/admin read own tenant | Platform admin manage | Platform admin manage | FALSE (No clinic delete) | Managed via Stripe webhook |
| **audit_logs** | Tenant member or platform support | Tenant member | FALSE | FALSE | Immutable records |
| **patients** | Tenant member | Tenant member | Tenant member | Clinic owner/admin | Deletion is restricted |
| **doctors** | Tenant member | Clinic owner/admin | Clinic owner/admin | Clinic owner/admin | Managed by clinic admin |
| **appointments** | Tenant member | Tenant member | Tenant member | Clinic owner/admin | Status tracks lifecycle |
| **chief_complaints** | Tenant member | Tenant member | Tenant member | Clinic owner/admin | 1:1 with patient/chart |
| **dental_charts** | Tenant member | Tenant member | Tenant member | Clinic owner/admin | 1:1 with patient |
| **tooth_states** | Tenant member | Tenant member | Tenant member | Clinic owner/admin | Tied to chart |
| **findings** | Tenant member | Tenant member | Tenant member | Clinic owner/admin | Links to teeth |
| **treatment_plans** | Tenant member | Tenant member | Tenant member | Clinic owner/admin | Drives billing/workflow |
| **treatment_stages** | Tenant member | Tenant member | Tenant member | Clinic owner/admin | Tied to plan |
| **documents** | Tenant member | Tenant member | Tenant member | Clinic owner/admin | Links to Supabase Storage |
| **integration_tokens**| FALSE | FALSE | FALSE | FALSE | service-role only in Edge Functions/backend proxy |

## 6. Role Access Matrix

| Role | Patients | Appointments | Dental Chart / Findings | Treatment Plans | Documents | Billing | Integrations | Audit Logs |
|---|---|---|---|---|---|---|---|---|
| **platform_owner** | All | All | All | All | All | All | All | Read |
| **clinic_owner** | CRUD | CRUD | CRUD | CRUD | CRUD | CRUD | CRUD | Read |
| **clinic_admin** | CRUD | CRUD | CRUD | CRUD | CRUD | Read | CRUD | Read |
| **doctor** | Read/Update | Read/Update | CRUD | CRUD | CRUD | None | None | None |
| **registrar** | CRUD | CRUD | Read | Read | Read | Read | None | None |
| **cashier** | Read | Read | Read | Read | Read | CRUD | None | None |
| **marketer** | Read | None | None | None | None | None | None | None |
| **support (readonly)** | Read | Read | Read | Read | Read | Read | Read | Read |

*Note: CRUD implies Create/Read/Update/Delete within their own `tenant_id`.*

## 7. Repository-to-Table Mapping

- **PatientRepository**: Maps directly to `patients`. Supabase JS client can call the table API directly. RLS protects multi-tenant access.
- **AppointmentRepository**: Maps to `appointments`. Supabase JS client handles direct table API calls.
- **DoctorRepository**: Maps to `doctors` and `profiles`. Supabase JS client table API.
- **DentalChartRepository**: Maps to `dental_charts` and `tooth_states`. `saveDentalChart` may require an RPC (Remote Procedure Call) or a transaction to safely upsert the chart and its multiple tooth states atomically without race conditions.
- **ChiefComplaintRepository**: Maps to `chief_complaints`. Supabase JS client `upsert` handles this natively.
- **FindingsRepository**: Maps to `findings`. Supabase JS client direct table API.
- **TreatmentPlansRepository**: Maps to `treatment_plans` and `treatment_stages`. Creation of a plan with stages should ideally use a Supabase RPC to ensure atomic transactions.

## 8. Security Risks and Mitigations

- **Service-role key leakage:** If exposed in frontend `.env`, an attacker can bypass all RLS. **Mitigation:** Never expose `SUPABASE_SERVICE_ROLE_KEY`. Only expose `SUPABASE_ANON_KEY`.
- **Wrong tenant_id in inserts:** A user might try to insert a record into someone else's clinic. **Mitigation:** `WITH CHECK` helps prevent cross-tenant inserts only when RLS is enabled, the policy is correct, every tenant-owned table has `tenant_id`, and no service-role/Edge Function bypass is used.
- **Missing RLS on a table:** A new table is created but `ENABLE ROW LEVEL SECURITY` is forgotten, exposing all rows to `anon`. **Mitigation:** Implement CI/CD checks (e.g., `supabase db lint` or custom queries) that fail the build if any public schema table lacks RLS.
- **Edge Function bypassing tenant context:** Service-role bypasses RLS inside Edge Functions. **Mitigation:** Edge Functions must manually instantiate a Supabase client using the user's incoming Authorization JWT rather than defaulting to the admin key, unless explicitly executing elevated actions.
- **Audit logs being editable:** Attackers covering their tracks. **Mitigation:** `audit_logs` RLS policies must strictly forbid `UPDATE` and `DELETE` operations.
- **Medical data leaking to amoCRM:** HIPAA/GDPR violation. **Mitigation:** amoCRM sync logic must be explicitly restricted to Name, Phone, and Appointment timestamps. The `dental_charts` and `findings` payloads must never enter the integration proxy pipeline.

## 9. Migration Phases
1. **Schema finalization (Current Phase):** Design SQL and RLS.
2. **Local SQL validation:** Run migrations locally against Supabase CLI to verify syntax and relationships.
3. **Supabase project setup later:** Provision cloud infrastructure.
4. **Auth/tenant bootstrap:** Implement Supabase Auth, JWT claims, and context passing in the frontend.
5. **Seed/demo data:** Generate mock `tenant_id`s and seed the DB.
6. **Repository implementation swap:** Implement `SupabasePatientRepository` (and others) and inject them into the app.
7. **Remove `storage.init()`:** Purge `localStorage` usage completely.
8. **Document/file storage:** Transition file uploads to Supabase Storage with bucket-level RLS.
9. **amoCRM proxy:** Deploy Supabase Edge Functions for webhook proxying.
10. **Billing enforcement:** Integrate Stripe webhooks to update `subscriptions.status`.

## 10. Non-Goals
- No real migrations have been applied.
- No Supabase SDK has been installed.
- No cloud resources have been created.
- No application code has been modified.
- No production databases have been touched.
