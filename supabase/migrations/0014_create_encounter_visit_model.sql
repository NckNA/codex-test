-- 0014_create_encounter_visit_model.sql
-- Schema-only foundation for actual visits, documented clinical encounters,
-- and performed clinical/billable services.
--
-- Domain boundary:
-- - appointment = scheduled slot / booking intent;
-- - patient_visit = actual patient attendance instance;
-- - clinical_encounter = documented clinical session / doctor interaction;
-- - completed_service = performed clinical/billable fact;
-- - treatment plan/stage = intended work, not proof of completion;
-- - payment = separate financial fact, not proof of treatment;
-- - audit/activity = immutable/action history, not source clinical fact.

CREATE TABLE IF NOT EXISTS public.patient_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'checked_in',
  visit_type text NOT NULL DEFAULT 'regular',
  arrived_at timestamptz NOT NULL DEFAULT now(),
  checked_in_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  archived_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  archived_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT patient_visits_patient_fk
    FOREIGN KEY (tenant_id, patient_id) REFERENCES public.patients(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT patient_visits_status_check
    CHECK (status IN ('checked_in', 'in_progress', 'completed', 'cancelled', 'archived')),
  CONSTRAINT patient_visits_visit_type_check
    CHECK (visit_type IN ('regular', 'emergency', 'consultation', 'follow_up', 'procedure', 'other')),
  CONSTRAINT patient_visits_metadata_object_check
    CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT patient_visits_completed_at_status_check
    CHECK (completed_at IS NULL OR status IN ('completed', 'archived')),
  CONSTRAINT patient_visits_cancelled_at_status_check
    CHECK (cancelled_at IS NULL OR status = 'cancelled'),
  CONSTRAINT patient_visits_archived_at_status_check
    CHECK (archived_at IS NULL OR status = 'archived')
);

CREATE TABLE IF NOT EXISTS public.clinical_encounters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  visit_id uuid REFERENCES public.patient_visits(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  doctor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  encounter_type text NOT NULL DEFAULT 'consultation',
  started_at timestamptz,
  completed_at timestamptz,
  locked_at timestamptz,
  archived_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  locked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  archived_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  chief_complaint_snapshot text,
  clinical_summary text,
  correction_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clinical_encounters_patient_fk
    FOREIGN KEY (tenant_id, patient_id) REFERENCES public.patients(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT clinical_encounters_status_check
    CHECK (status IN ('draft', 'in_progress', 'completed', 'locked', 'archived')),
  CONSTRAINT clinical_encounters_type_check
    CHECK (encounter_type IN ('consultation', 'treatment', 'surgery', 'orthodontics', 'prosthetics', 'hygiene', 'emergency', 'follow_up', 'other')),
  CONSTRAINT clinical_encounters_metadata_object_check
    CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT clinical_encounters_completed_at_status_check
    CHECK (completed_at IS NULL OR status IN ('completed', 'locked', 'archived')),
  CONSTRAINT clinical_encounters_locked_at_status_check
    CHECK (locked_at IS NULL OR status IN ('locked', 'archived')),
  CONSTRAINT clinical_encounters_archived_at_status_check
    CHECK (archived_at IS NULL OR status = 'archived')
);

CREATE TABLE IF NOT EXISTS public.completed_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  visit_id uuid REFERENCES public.patient_visits(id) ON DELETE SET NULL,
  encounter_id uuid REFERENCES public.clinical_encounters(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  finding_id uuid REFERENCES public.findings(id) ON DELETE SET NULL,
  treatment_plan_id uuid,
  treatment_stage_id uuid REFERENCES public.treatment_stages(id) ON DELETE SET NULL,
  clinical_dictionary_item_id text,
  service_code text,
  service_name text NOT NULL,
  tooth_number text,
  tooth_surface text,
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  unit_price numeric(14,2),
  total_amount numeric(14,2),
  currency text NOT NULL DEFAULT 'KZT',
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'completed',
  correction_of_id uuid REFERENCES public.completed_services(id) ON DELETE SET NULL,
  correction_reason text,
  voided_at timestamptz,
  voided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  archived_at timestamptz,
  archived_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT completed_services_patient_fk
    FOREIGN KEY (tenant_id, patient_id) REFERENCES public.patients(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT completed_services_treatment_plan_fk
    FOREIGN KEY (tenant_id, treatment_plan_id) REFERENCES public.treatment_plans(tenant_id, id) ON DELETE SET NULL,
  CONSTRAINT completed_services_dictionary_fk
    FOREIGN KEY (tenant_id, clinical_dictionary_item_id) REFERENCES public.clinical_dictionary_items(tenant_id, id) ON DELETE SET NULL,
  CONSTRAINT completed_services_status_check
    CHECK (status IN ('completed', 'corrected', 'voided', 'archived')),
  CONSTRAINT completed_services_metadata_object_check
    CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT completed_services_quantity_positive_check
    CHECK (quantity > 0),
  CONSTRAINT completed_services_unit_price_nonnegative_check
    CHECK (unit_price IS NULL OR unit_price >= 0),
  CONSTRAINT completed_services_total_amount_nonnegative_check
    CHECK (total_amount IS NULL OR total_amount >= 0),
  CONSTRAINT completed_services_currency_non_empty_check
    CHECK (length(btrim(currency)) > 0),
  CONSTRAINT completed_services_service_name_non_empty_check
    CHECK (length(btrim(service_name)) > 0),
  CONSTRAINT completed_services_correction_reason_check
    CHECK (status NOT IN ('corrected', 'voided') OR length(btrim(COALESCE(correction_reason, ''))) > 0),
  CONSTRAINT completed_services_voided_at_check
    CHECK (status <> 'voided' OR voided_at IS NOT NULL),
  CONSTRAINT completed_services_archived_at_check
    CHECK (status <> 'archived' OR archived_at IS NOT NULL),
  CONSTRAINT completed_services_voided_at_status_check
    CHECK (voided_at IS NULL OR status = 'voided'),
  CONSTRAINT completed_services_archived_at_status_check
    CHECK (archived_at IS NULL OR status = 'archived')
);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS patient_visits_set_updated_at ON public.patient_visits;
CREATE TRIGGER patient_visits_set_updated_at
BEFORE UPDATE ON public.patient_visits
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS clinical_encounters_set_updated_at ON public.clinical_encounters;
CREATE TRIGGER clinical_encounters_set_updated_at
BEFORE UPDATE ON public.clinical_encounters
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS completed_services_set_updated_at ON public.completed_services;
CREATE TRIGGER completed_services_set_updated_at
BEFORE UPDATE ON public.completed_services
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_patient_visits_tenant_arrived_at
  ON public.patient_visits (tenant_id, arrived_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_visits_tenant_patient_arrived_at
  ON public.patient_visits (tenant_id, patient_id, arrived_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_visits_tenant_status
  ON public.patient_visits (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_patient_visits_appointment_id
  ON public.patient_visits (appointment_id);
CREATE INDEX IF NOT EXISTS idx_patient_visits_created_by
  ON public.patient_visits (created_by);

CREATE INDEX IF NOT EXISTS idx_clinical_encounters_tenant_created_at
  ON public.clinical_encounters (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clinical_encounters_tenant_patient_created_at
  ON public.clinical_encounters (tenant_id, patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clinical_encounters_tenant_visit
  ON public.clinical_encounters (tenant_id, visit_id);
CREATE INDEX IF NOT EXISTS idx_clinical_encounters_tenant_doctor_created_at
  ON public.clinical_encounters (tenant_id, doctor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clinical_encounters_tenant_status
  ON public.clinical_encounters (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_clinical_encounters_appointment_id
  ON public.clinical_encounters (appointment_id);

CREATE INDEX IF NOT EXISTS idx_completed_services_tenant_performed_at
  ON public.completed_services (tenant_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_completed_services_tenant_patient_performed_at
  ON public.completed_services (tenant_id, patient_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_completed_services_tenant_encounter
  ON public.completed_services (tenant_id, encounter_id);
CREATE INDEX IF NOT EXISTS idx_completed_services_tenant_visit
  ON public.completed_services (tenant_id, visit_id);
CREATE INDEX IF NOT EXISTS idx_completed_services_tenant_performed_by_performed_at
  ON public.completed_services (tenant_id, performed_by, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_completed_services_tenant_status
  ON public.completed_services (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_completed_services_treatment_plan_id
  ON public.completed_services (treatment_plan_id);
CREATE INDEX IF NOT EXISTS idx_completed_services_treatment_stage_id
  ON public.completed_services (treatment_stage_id);
CREATE INDEX IF NOT EXISTS idx_completed_services_finding_id
  ON public.completed_services (finding_id);
CREATE INDEX IF NOT EXISTS idx_completed_services_dictionary_item_id
  ON public.completed_services (tenant_id, clinical_dictionary_item_id);

COMMENT ON TABLE public.patient_visits IS 'Actual patient attendance instance in a clinic. This is not appointment intent and is not proof of completed treatment.';
COMMENT ON COLUMN public.patient_visits.appointment_id IS 'Optional link to booking context only. Appointment status alone is not proof of completed treatment.';
COMMENT ON COLUMN public.patient_visits.status IS 'Visit lifecycle for actual attendance. no_show remains an appointment outcome, not a visit status.';
COMMENT ON COLUMN public.patient_visits.notes IS 'Administrative visit notes only. Clinical documentation belongs in clinical_encounters.';

COMMENT ON TABLE public.clinical_encounters IS 'Documented clinical interaction/session, usually inside a patient visit. Not an appointment and not payment.';
COMMENT ON COLUMN public.clinical_encounters.visit_id IS 'Optional link to actual attendance. Encounter documentation may exist inside a visit but is not the visit itself.';
COMMENT ON COLUMN public.clinical_encounters.appointment_id IS 'Optional link to booking context only. Appointment status is not clinical documentation.';
COMMENT ON COLUMN public.clinical_encounters.clinical_summary IS 'Clinical session summary. Raw clinical notes UI and correction workflow are future tasks.';
COMMENT ON COLUMN public.clinical_encounters.correction_reason IS 'Future correction flows must use controlled domain RPCs with audit/activity events.';

COMMENT ON TABLE public.completed_services IS 'Performed clinical/billable service fact. This is not a treatment plan, not appointment completion, and not payment.';
COMMENT ON COLUMN public.completed_services.appointment_id IS 'Optional booking context only. Appointment completion is not proof of performed service.';
COMMENT ON COLUMN public.completed_services.treatment_plan_id IS 'Optional reference to intended plan. A treatment plan is not proof that service was performed.';
COMMENT ON COLUMN public.completed_services.treatment_stage_id IS 'Optional reference to intended treatment stage. Stage status alone is not the source of performed service facts.';
COMMENT ON COLUMN public.completed_services.finding_id IS 'Optional source finding link. Finding status alone is not proof of performed service.';
COMMENT ON COLUMN public.completed_services.clinical_dictionary_item_id IS 'Optional tenant dictionary item reference. clinical_dictionary_items.id is text and scoped by tenant_id.';
COMMENT ON COLUMN public.completed_services.unit_price IS 'Service/billing snapshot only. This is not payment.';
COMMENT ON COLUMN public.completed_services.total_amount IS 'Performed service amount snapshot only. Payment/debt allocation is a future financial module.';
COMMENT ON COLUMN public.completed_services.correction_of_id IS 'Links correction rows to the original performed service fact. Future correction writes must be audited through domain RPCs.';
COMMENT ON COLUMN public.completed_services.correction_reason IS 'Required for corrected/voided service facts when those statuses are used.';
COMMENT ON COLUMN public.completed_services.metadata IS 'Safe structured metadata only. Do not store secrets, raw file contents, or broad PHI dumps.';
COMMENT ON FUNCTION public.set_updated_at() IS 'Generic updated_at trigger helper for schema-only tables that follow the project timestamp convention.';

ALTER TABLE public.patient_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_encounters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.completed_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clinic staff can read tenant visits" ON public.patient_visits;
CREATE POLICY "Clinic staff can read tenant visits"
ON public.patient_visits
FOR SELECT
TO authenticated
USING (
  public.has_tenant_role(
    tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role, 'doctor'::public.app_role, 'registrar'::public.app_role]
  )
);

DROP POLICY IF EXISTS "Clinical staff can read tenant encounters" ON public.clinical_encounters;
CREATE POLICY "Clinical staff can read tenant encounters"
ON public.clinical_encounters
FOR SELECT
TO authenticated
USING (
  public.has_tenant_role(
    tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role, 'doctor'::public.app_role]
  )
);

DROP POLICY IF EXISTS "Clinical staff can read tenant completed services" ON public.completed_services;
CREATE POLICY "Clinical staff can read tenant completed services"
ON public.completed_services
FOR SELECT
TO authenticated
USING (
  public.has_tenant_role(
    tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role, 'doctor'::public.app_role]
  )
);

REVOKE ALL ON TABLE public.patient_visits FROM PUBLIC;
REVOKE ALL ON TABLE public.clinical_encounters FROM PUBLIC;
REVOKE ALL ON TABLE public.completed_services FROM PUBLIC;
REVOKE ALL ON TABLE public.patient_visits FROM anon;
REVOKE ALL ON TABLE public.clinical_encounters FROM anon;
REVOKE ALL ON TABLE public.completed_services FROM anon;
REVOKE ALL ON TABLE public.patient_visits FROM authenticated;
REVOKE ALL ON TABLE public.clinical_encounters FROM authenticated;
REVOKE ALL ON TABLE public.completed_services FROM authenticated;
GRANT SELECT ON TABLE public.patient_visits TO authenticated;
GRANT SELECT ON TABLE public.clinical_encounters TO authenticated;
GRANT SELECT ON TABLE public.completed_services TO authenticated;
GRANT ALL ON TABLE public.patient_visits TO service_role;
GRANT ALL ON TABLE public.clinical_encounters TO service_role;
GRANT ALL ON TABLE public.completed_services TO service_role;
