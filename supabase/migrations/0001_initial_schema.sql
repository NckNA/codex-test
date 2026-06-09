-- 0001_initial_schema.sql
-- Drafted based on _ai_work/DATABASE_SCHEMA.md

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
  patient_id uuid NOT NULL,
  text text NOT NULL,
  related_teeth integer[] NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, patient_id),
  FOREIGN KEY (tenant_id, patient_id) REFERENCES patients(tenant_id, id) ON DELETE CASCADE
);

-- DENTAL CHARTS
CREATE TABLE dental_charts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  complaints text,
  diagnosis text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, patient_id),
  UNIQUE(tenant_id, id),
  FOREIGN KEY (tenant_id, patient_id) REFERENCES patients(tenant_id, id) ON DELETE CASCADE
);

-- TOOTH STATES (Dental Chart Teeth)
CREATE TABLE tooth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  dental_chart_id uuid NOT NULL,
  tooth_number integer NOT NULL,
  condition text NOT NULL CHECK (condition IN ('healthy', 'caries', 'filled', 'missing', 'crown', 'implant', 'root', 'pulpitis', 'periodontitis', 'needs_treatment')),
  surfaces text[] DEFAULT '{}',
  crown text,
  root text,
  gum text,
  bone text,
  canal text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(dental_chart_id, tooth_number),
  FOREIGN KEY (tenant_id, dental_chart_id) REFERENCES dental_charts(tenant_id, id) ON DELETE CASCADE
);

-- FINDINGS
CREATE TABLE findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  tooth_number integer,
  title text NOT NULL,
  category text NOT NULL CHECK (category IN ('caries', 'missing_tooth', 'gum_problem', 'root_problem', 'bite_problem', 'aesthetic_problem', 'pain', 'risk_zone', 'hygiene', 'prosthetics', 'implantology', 'other')),
  status text NOT NULL DEFAULT 'discovered' CHECK (status IN ('discovered', 'recommended', 'included_in_plan', 'observing', 'declined_by_patient', 'completed')),
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'urgent')),
  description text NOT NULL,
  risk_description text,
  recommendation text,
  is_chief_complaint_related boolean DEFAULT false,
  include_in_treatment_plan boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  FOREIGN KEY (tenant_id, patient_id) REFERENCES patients(tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX idx_findings_tenant_patient ON findings(tenant_id, patient_id);

-- TREATMENT PLANS
CREATE TABLE treatment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'in_progress', 'completed', 'cancelled')),
  total_price numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, id),
  FOREIGN KEY (tenant_id, patient_id) REFERENCES patients(tenant_id, id) ON DELETE CASCADE
);

-- TREATMENT STAGES
CREATE TABLE treatment_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  treatment_plan_id uuid NOT NULL,
  title text NOT NULL,
  teeth integer[] DEFAULT '{}',
  description text,
  price numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  finding_ids uuid[],
  source text CHECK (source IN ('manual', 'from_finding')),
  order_index integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  FOREIGN KEY (tenant_id, treatment_plan_id) REFERENCES treatment_plans(tenant_id, id) ON DELETE CASCADE
);

-- DOCUMENTS METADATA
CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  file_name text NOT NULL,
  file_size integer NOT NULL,
  file_type text,
  storage_path text NOT NULL,
  created_at timestamptz DEFAULT now(),
  FOREIGN KEY (tenant_id, patient_id) REFERENCES patients(tenant_id, id) ON DELETE CASCADE
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

-- 4. RLS Helper Functions

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

-- 5. RLS Policies

-- WARNING: Current RLS policies are tenant-isolation policies, not final production role authorization policies.

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE chief_complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE dental_charts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tooth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_tokens ENABLE ROW LEVEL SECURITY;


-- 5.1 RLS - Tenants
CREATE POLICY "Tenant members can read own metadata" ON tenants FOR SELECT USING (id IN (SELECT get_user_tenants()));

-- 5.2 RLS - Profiles
CREATE POLICY "Users can read own" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "User update own profile" ON profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- 5.3 RLS - Tenant Users
CREATE POLICY "Tenant members read own tenant list" ON tenant_users FOR SELECT USING (tenant_id IN (SELECT get_user_tenants()));

-- 5.4 RLS - Patients
CREATE POLICY "Users can view patients in their tenant" ON patients FOR SELECT USING (tenant_id IN (SELECT get_user_tenants()));
CREATE POLICY "Users can insert patients in their tenant" ON patients FOR INSERT WITH CHECK (tenant_id IN (SELECT get_user_tenants()));
CREATE POLICY "Users can update patients in their tenant" ON patients FOR UPDATE USING (tenant_id IN (SELECT get_user_tenants())) WITH CHECK (tenant_id IN (SELECT get_user_tenants()));
CREATE POLICY "Only admins can delete patients" ON patients FOR DELETE USING (has_tenant_role(tenant_id, ARRAY['clinic_admin'::app_role, 'clinic_owner'::app_role]));

-- 5.5 RLS - Doctors
CREATE POLICY "Users can view doctors in their tenant" ON doctors FOR SELECT USING (tenant_id IN (SELECT get_user_tenants()));
CREATE POLICY "Users can insert doctors in their tenant" ON doctors FOR INSERT WITH CHECK (tenant_id IN (SELECT get_user_tenants()));
CREATE POLICY "Users can update doctors in their tenant" ON doctors FOR UPDATE USING (tenant_id IN (SELECT get_user_tenants())) WITH CHECK (tenant_id IN (SELECT get_user_tenants()));
CREATE POLICY "Only admins can delete doctors" ON doctors FOR DELETE USING (has_tenant_role(tenant_id, ARRAY['clinic_admin'::app_role, 'clinic_owner'::app_role]));

-- 5.6 RLS - Appointments
CREATE POLICY "Users can view appts in their tenant" ON appointments FOR SELECT USING (tenant_id IN (SELECT get_user_tenants()));
CREATE POLICY "Users can insert appts in their tenant" ON appointments FOR INSERT WITH CHECK (tenant_id IN (SELECT get_user_tenants()));
CREATE POLICY "Users can update appts in their tenant" ON appointments FOR UPDATE USING (tenant_id IN (SELECT get_user_tenants())) WITH CHECK (tenant_id IN (SELECT get_user_tenants()));
CREATE POLICY "Only admins can delete appts" ON appointments FOR DELETE USING (has_tenant_role(tenant_id, ARRAY['clinic_admin'::app_role, 'clinic_owner'::app_role]));

-- 5.7 RLS - Chief Complaints
CREATE POLICY "Users can view complaints in their tenant" ON chief_complaints FOR SELECT USING (tenant_id IN (SELECT get_user_tenants()));
CREATE POLICY "Users can insert complaints in their tenant" ON chief_complaints FOR INSERT WITH CHECK (tenant_id IN (SELECT get_user_tenants()));
CREATE POLICY "Users can update complaints in their tenant" ON chief_complaints FOR UPDATE USING (tenant_id IN (SELECT get_user_tenants())) WITH CHECK (tenant_id IN (SELECT get_user_tenants()));
CREATE POLICY "Only admins can delete complaints" ON chief_complaints FOR DELETE USING (has_tenant_role(tenant_id, ARRAY['clinic_admin'::app_role, 'clinic_owner'::app_role]));

-- 5.8 RLS - Dental Charts
CREATE POLICY "Users can view charts in their tenant" ON dental_charts FOR SELECT USING (tenant_id IN (SELECT get_user_tenants()));
CREATE POLICY "Users can insert charts in their tenant" ON dental_charts FOR INSERT WITH CHECK (tenant_id IN (SELECT get_user_tenants()));
CREATE POLICY "Users can update charts in their tenant" ON dental_charts FOR UPDATE USING (tenant_id IN (SELECT get_user_tenants())) WITH CHECK (tenant_id IN (SELECT get_user_tenants()));
CREATE POLICY "Only admins can delete charts" ON dental_charts FOR DELETE USING (has_tenant_role(tenant_id, ARRAY['clinic_admin'::app_role, 'clinic_owner'::app_role]));

-- 5.9 RLS - Tooth States
CREATE POLICY "Users can view tooth states in their tenant" ON tooth_states FOR SELECT USING (tenant_id IN (SELECT get_user_tenants()));
CREATE POLICY "Users can insert tooth states in their tenant" ON tooth_states FOR INSERT WITH CHECK (tenant_id IN (SELECT get_user_tenants()));
CREATE POLICY "Users can update tooth states in their tenant" ON tooth_states FOR UPDATE USING (tenant_id IN (SELECT get_user_tenants())) WITH CHECK (tenant_id IN (SELECT get_user_tenants()));
CREATE POLICY "Only admins can delete tooth states" ON tooth_states FOR DELETE USING (has_tenant_role(tenant_id, ARRAY['clinic_admin'::app_role, 'clinic_owner'::app_role]));

-- 5.10 RLS - Findings
CREATE POLICY "Users can view findings in their tenant" ON findings FOR SELECT USING (tenant_id IN (SELECT get_user_tenants()));
CREATE POLICY "Users can insert findings in their tenant" ON findings FOR INSERT WITH CHECK (tenant_id IN (SELECT get_user_tenants()));
CREATE POLICY "Users can update findings in their tenant" ON findings FOR UPDATE USING (tenant_id IN (SELECT get_user_tenants())) WITH CHECK (tenant_id IN (SELECT get_user_tenants()));
CREATE POLICY "Only admins can delete findings" ON findings FOR DELETE USING (has_tenant_role(tenant_id, ARRAY['clinic_admin'::app_role, 'clinic_owner'::app_role]));

-- 5.11 RLS - Treatment Plans
CREATE POLICY "Users can view plans in their tenant" ON treatment_plans FOR SELECT USING (tenant_id IN (SELECT get_user_tenants()));
CREATE POLICY "Users can insert plans in their tenant" ON treatment_plans FOR INSERT WITH CHECK (tenant_id IN (SELECT get_user_tenants()));
CREATE POLICY "Users can update plans in their tenant" ON treatment_plans FOR UPDATE USING (tenant_id IN (SELECT get_user_tenants())) WITH CHECK (tenant_id IN (SELECT get_user_tenants()));
CREATE POLICY "Only admins can delete plans" ON treatment_plans FOR DELETE USING (has_tenant_role(tenant_id, ARRAY['clinic_admin'::app_role, 'clinic_owner'::app_role]));

-- 5.12 RLS - Treatment Stages
CREATE POLICY "Users can view stages in their tenant" ON treatment_stages FOR SELECT USING (tenant_id IN (SELECT get_user_tenants()));
CREATE POLICY "Users can insert stages in their tenant" ON treatment_stages FOR INSERT WITH CHECK (tenant_id IN (SELECT get_user_tenants()));
CREATE POLICY "Users can update stages in their tenant" ON treatment_stages FOR UPDATE USING (tenant_id IN (SELECT get_user_tenants())) WITH CHECK (tenant_id IN (SELECT get_user_tenants()));
CREATE POLICY "Only admins can delete stages" ON treatment_stages FOR DELETE USING (has_tenant_role(tenant_id, ARRAY['clinic_admin'::app_role, 'clinic_owner'::app_role]));

-- 5.13 RLS - Documents
CREATE POLICY "Users can view docs in their tenant" ON documents FOR SELECT USING (tenant_id IN (SELECT get_user_tenants()));
CREATE POLICY "Users can insert docs in their tenant" ON documents FOR INSERT WITH CHECK (tenant_id IN (SELECT get_user_tenants()));
CREATE POLICY "Users can update docs in their tenant" ON documents FOR UPDATE USING (tenant_id IN (SELECT get_user_tenants())) WITH CHECK (tenant_id IN (SELECT get_user_tenants()));
CREATE POLICY "Only admins can delete docs" ON documents FOR DELETE USING (has_tenant_role(tenant_id, ARRAY['clinic_admin'::app_role, 'clinic_owner'::app_role]));

-- 5.14 RLS - Audit Logs
CREATE POLICY "Tenant members can view audit logs" ON audit_logs FOR SELECT USING (tenant_id IN (SELECT get_user_tenants()));
CREATE POLICY "Users can insert audit logs in their tenant" ON audit_logs FOR INSERT WITH CHECK (tenant_id IN (SELECT get_user_tenants()));
-- UPDATE and DELETE explicitly FALSE by default if no policy grants it, which is the intention.

-- 5.15 RLS - Integration Tokens
-- No policies granted. Accessible only via service_role in Edge Functions/proxies.

-- 5.16 RLS - Subscriptions
CREATE POLICY "Tenant members can read subscription" ON subscriptions FOR SELECT USING (tenant_id IN (SELECT get_user_tenants()));
-- INSERT/UPDATE/DELETE handled by stripe webhooks using service_role.
