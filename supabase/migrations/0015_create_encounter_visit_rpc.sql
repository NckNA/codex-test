-- 0015_create_encounter_visit_rpc.sql
-- SECURITY DEFINER write RPC paths for patient visits, clinical encounters, and completed services.

-- 1. check_in_patient_visit
CREATE OR REPLACE FUNCTION public.check_in_patient_visit(
  p_tenant_id uuid,
  p_patient_id uuid,
  p_appointment_id uuid DEFAULT NULL,
  p_visit_type text DEFAULT 'regular',
  p_arrived_at timestamptz DEFAULT now(),
  p_notes text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS public.patient_visits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role_ok boolean;
  v_patient_ok boolean;
  v_appointment_ok boolean;
  v_active_visit_exists boolean;
  v_visit public.patient_visits;
  v_audit_id uuid;
  v_activity_id uuid;
BEGIN
  -- 1. Verify tenant is not null
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant ID is required';
  END IF;

  -- 2. Verify role permissions
  v_role_ok := public.has_tenant_role(
    p_tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role, 'registrar'::public.app_role, 'doctor'::public.app_role]
  );
  IF NOT v_role_ok THEN
    RAISE EXCEPTION 'Access denied: insufficient permissions for this tenant';
  END IF;

  -- 3. Verify patient exists in tenant
  SELECT EXISTS (
    SELECT 1 FROM public.patients
    WHERE id = p_patient_id AND tenant_id = p_tenant_id
  ) INTO v_patient_ok;
  IF NOT v_patient_ok THEN
    RAISE EXCEPTION 'Patient not found in this tenant';
  END IF;

  -- 4. Verify appointment belongs to patient and tenant (if provided)
  IF p_appointment_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.appointments
      WHERE id = p_appointment_id AND tenant_id = p_tenant_id AND patient_id = p_patient_id
    ) INTO v_appointment_ok;
    IF NOT v_appointment_ok THEN
      RAISE EXCEPTION 'Appointment not found or does not belong to this patient/tenant';
    END IF;

    -- 5. Reject if appointment already has an active (non-cancelled, non-archived) visit
    SELECT EXISTS (
      SELECT 1 FROM public.patient_visits
      WHERE appointment_id = p_appointment_id AND tenant_id = p_tenant_id AND status NOT IN ('cancelled', 'archived')
    ) INTO v_active_visit_exists;
    IF v_active_visit_exists THEN
      RAISE EXCEPTION 'Active visit already exists for this appointment';
    END IF;
  END IF;

  -- 6. Insert visit
  INSERT INTO public.patient_visits (
    tenant_id,
    patient_id,
    appointment_id,
    status,
    visit_type,
    arrived_at,
    checked_in_at,
    created_by,
    updated_by,
    notes,
    metadata
  ) VALUES (
    p_tenant_id,
    p_patient_id,
    p_appointment_id,
    'checked_in',
    p_visit_type,
    COALESCE(p_arrived_at, now()),
    now(),
    auth.uid(),
    auth.uid(),
    p_notes,
    p_metadata
  ) RETURNING * INTO v_visit;

  -- 7. Log audit event
  v_audit_id := public.record_audit_event_internal(
    p_tenant_id,
    'patient_visit_checked_in',
    'visit',
    'patient_visit',
    v_visit.id::text,
    auth.uid(),
    p_patient_id => p_patient_id,
    p_appointment_id => p_appointment_id::text,
    p_visit_id => v_visit.id,
    p_metadata => p_metadata
  );

  -- 8. Log activity event
  v_activity_id := public.record_activity_event_internal(
    p_tenant_id,
    'visit',
    'patient_visit_checked_in',
    'Patient visit checked in',
    'patient_visit',
    v_visit.id::text,
    p_patient_id => p_patient_id,
    p_audit_event_id => v_audit_id,
    p_actor_user_id => auth.uid(),
    p_source_status => 'checked_in',
    p_visibility => 'admin',
    p_metadata => p_metadata
  );

  RETURN v_visit;
END;
$$;

-- 2. start_patient_visit
CREATE OR REPLACE FUNCTION public.start_patient_visit(
  p_tenant_id uuid,
  p_visit_id uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS public.patient_visits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role_ok boolean;
  v_visit public.patient_visits;
  v_audit_id uuid;
  v_activity_id uuid;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant ID is required';
  END IF;

  v_role_ok := public.has_tenant_role(
    p_tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role, 'registrar'::public.app_role, 'doctor'::public.app_role]
  );
  IF NOT v_role_ok THEN
    RAISE EXCEPTION 'Access denied: insufficient permissions for this tenant';
  END IF;

  -- Select visit for update to prevent concurrent updates
  SELECT * INTO v_visit FROM public.patient_visits
  WHERE id = p_visit_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF v_visit.id IS NULL THEN
    RAISE EXCEPTION 'Patient visit not found in this tenant';
  END IF;

  -- Validate transition
  IF v_visit.status <> 'checked_in' THEN
    RAISE EXCEPTION 'Invalid status transition: cannot start visit from status %', v_visit.status;
  END IF;

  -- Update visit
  UPDATE public.patient_visits
  SET status = 'in_progress',
      started_at = COALESCE(started_at, now()),
      updated_by = auth.uid()
  WHERE id = p_visit_id AND tenant_id = p_tenant_id
  RETURNING * INTO v_visit;

  -- Log audit event
  v_audit_id := public.record_audit_event_internal(
    p_tenant_id,
    'patient_visit_started',
    'visit',
    'patient_visit',
    p_visit_id::text,
    auth.uid(),
    p_patient_id => v_visit.patient_id,
    p_appointment_id => v_visit.appointment_id::text,
    p_visit_id => p_visit_id,
    p_metadata => p_metadata
  );

  -- Log activity event
  v_activity_id := public.record_activity_event_internal(
    p_tenant_id,
    'visit',
    'patient_visit_started',
    'Patient visit started',
    'patient_visit',
    p_visit_id::text,
    p_patient_id => v_visit.patient_id,
    p_audit_event_id => v_audit_id,
    p_actor_user_id => auth.uid(),
    p_source_status => 'in_progress',
    p_visibility => 'admin',
    p_metadata => p_metadata
  );

  RETURN v_visit;
END;
$$;

-- 3. complete_patient_visit
CREATE OR REPLACE FUNCTION public.complete_patient_visit(
  p_tenant_id uuid,
  p_visit_id uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS public.patient_visits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role_ok boolean;
  v_visit public.patient_visits;
  v_audit_id uuid;
  v_activity_id uuid;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant ID is required';
  END IF;

  v_role_ok := public.has_tenant_role(
    p_tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role, 'doctor'::public.app_role]
  );
  IF NOT v_role_ok THEN
    RAISE EXCEPTION 'Access denied: insufficient permissions for this tenant';
  END IF;

  SELECT * INTO v_visit FROM public.patient_visits
  WHERE id = p_visit_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF v_visit.id IS NULL THEN
    RAISE EXCEPTION 'Patient visit not found in this tenant';
  END IF;

  IF v_visit.status NOT IN ('checked_in', 'in_progress') THEN
    RAISE EXCEPTION 'Invalid status transition: cannot complete visit from status %', v_visit.status;
  END IF;

  UPDATE public.patient_visits
  SET status = 'completed',
      completed_at = now(),
      updated_by = auth.uid()
  WHERE id = p_visit_id AND tenant_id = p_tenant_id
  RETURNING * INTO v_visit;

  v_audit_id := public.record_audit_event_internal(
    p_tenant_id,
    'patient_visit_completed',
    'visit',
    'patient_visit',
    p_visit_id::text,
    auth.uid(),
    p_patient_id => v_visit.patient_id,
    p_appointment_id => v_visit.appointment_id::text,
    p_visit_id => p_visit_id,
    p_metadata => p_metadata
  );

  v_activity_id := public.record_activity_event_internal(
    p_tenant_id,
    'visit',
    'patient_visit_completed',
    'Patient visit completed',
    'patient_visit',
    p_visit_id::text,
    p_patient_id => v_visit.patient_id,
    p_audit_event_id => v_audit_id,
    p_actor_user_id => auth.uid(),
    p_source_status => 'completed',
    p_visibility => 'admin',
    p_metadata => p_metadata
  );

  RETURN v_visit;
END;
$$;

-- 4. cancel_patient_visit
CREATE OR REPLACE FUNCTION public.cancel_patient_visit(
  p_tenant_id uuid,
  p_visit_id uuid,
  p_reason text,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS public.patient_visits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role_ok boolean;
  v_visit public.patient_visits;
  v_audit_id uuid;
  v_activity_id uuid;
  v_final_metadata jsonb;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant ID is required';
  END IF;

  IF p_reason IS NULL OR length(btrim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'Cancellation reason is required';
  END IF;

  v_role_ok := public.has_tenant_role(
    p_tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role, 'registrar'::public.app_role, 'doctor'::public.app_role]
  );
  IF NOT v_role_ok THEN
    RAISE EXCEPTION 'Access denied: insufficient permissions for this tenant';
  END IF;

  SELECT * INTO v_visit FROM public.patient_visits
  WHERE id = p_visit_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF v_visit.id IS NULL THEN
    RAISE EXCEPTION 'Patient visit not found in this tenant';
  END IF;

  IF v_visit.status NOT IN ('checked_in', 'in_progress') THEN
    RAISE EXCEPTION 'Invalid status transition: cannot cancel visit from status %', v_visit.status;
  END IF;

  v_final_metadata := COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('cancellation_reason', p_reason);

  UPDATE public.patient_visits
  SET status = 'cancelled',
      cancelled_at = now(),
      notes = CASE 
        WHEN notes IS NULL OR length(btrim(notes)) = 0 THEN 'Cancellation reason: ' || p_reason
        ELSE notes || E'\nCancellation reason: ' || p_reason
      END,
      metadata = v_final_metadata,
      updated_by = auth.uid()
  WHERE id = p_visit_id AND tenant_id = p_tenant_id
  RETURNING * INTO v_visit;

  v_audit_id := public.record_audit_event_internal(
    p_tenant_id,
    'patient_visit_cancelled',
    'visit',
    'patient_visit',
    p_visit_id::text,
    auth.uid(),
    p_patient_id => v_visit.patient_id,
    p_appointment_id => v_visit.appointment_id::text,
    p_visit_id => p_visit_id,
    p_reason => p_reason,
    p_metadata => v_final_metadata
  );

  v_activity_id := public.record_activity_event_internal(
    p_tenant_id,
    'visit',
    'patient_visit_cancelled',
    'Patient visit cancelled',
    'patient_visit',
    p_visit_id::text,
    p_patient_id => v_visit.patient_id,
    p_audit_event_id => v_audit_id,
    p_actor_user_id => auth.uid(),
    p_description => p_reason,
    p_source_status => 'cancelled',
    p_visibility => 'admin',
    p_metadata => v_final_metadata
  );

  RETURN v_visit;
END;
$$;

-- 5. create_clinical_encounter
CREATE OR REPLACE FUNCTION public.create_clinical_encounter(
  p_tenant_id uuid,
  p_patient_id uuid,
  p_visit_id uuid DEFAULT NULL,
  p_appointment_id uuid DEFAULT NULL,
  p_doctor_user_id uuid DEFAULT NULL,
  p_encounter_type text DEFAULT 'consultation',
  p_chief_complaint_snapshot text DEFAULT NULL,
  p_clinical_summary text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS public.clinical_encounters
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role_ok boolean;
  v_patient_ok boolean;
  v_visit_ok boolean;
  v_appointment_ok boolean;
  v_doctor_ok boolean;
  v_doc_user_id uuid;
  v_encounter public.clinical_encounters;
  v_audit_id uuid;
  v_activity_id uuid;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant ID is required';
  END IF;

  -- 1. Check permissions
  v_role_ok := public.has_tenant_role(
    p_tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role, 'doctor'::public.app_role]
  );
  IF NOT v_role_ok THEN
    RAISE EXCEPTION 'Access denied: insufficient permissions for this tenant';
  END IF;

  -- 2. Verify patient belongs to tenant
  SELECT EXISTS (
    SELECT 1 FROM public.patients
    WHERE id = p_patient_id AND tenant_id = p_tenant_id
  ) INTO v_patient_ok;
  IF NOT v_patient_ok THEN
    RAISE EXCEPTION 'Patient not found in this tenant';
  END IF;

  -- 3. Verify visit (if provided)
  IF p_visit_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.patient_visits
      WHERE id = p_visit_id AND tenant_id = p_tenant_id AND patient_id = p_patient_id
    ) INTO v_visit_ok;
    IF NOT v_visit_ok THEN
      RAISE EXCEPTION 'Visit not found or does not belong to this patient/tenant';
    END IF;
  END IF;

  -- 4. Verify appointment (if provided)
  IF p_appointment_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.appointments
      WHERE id = p_appointment_id AND tenant_id = p_tenant_id AND patient_id = p_patient_id
    ) INTO v_appointment_ok;
    IF NOT v_appointment_ok THEN
      RAISE EXCEPTION 'Appointment not found or does not belong to this patient/tenant';
    END IF;
  END IF;

  -- 5. Set doctor user ID
  v_doc_user_id := COALESCE(p_doctor_user_id, auth.uid());

  -- 6. Verify doctor user belongs to tenant and has allowed role
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = v_doc_user_id AND tenant_id = p_tenant_id 
      AND role IN ('clinic_owner'::public.app_role, 'clinic_admin'::public.app_role, 'doctor'::public.app_role)
  ) INTO v_doctor_ok;
  IF NOT v_doctor_ok THEN
    RAISE EXCEPTION 'Doctor user not authorized or does not belong to this tenant';
  END IF;

  -- 7. Insert encounter
  INSERT INTO public.clinical_encounters (
    tenant_id,
    patient_id,
    visit_id,
    appointment_id,
    doctor_user_id,
    status,
    encounter_type,
    created_by,
    updated_by,
    chief_complaint_snapshot,
    clinical_summary,
    metadata
  ) VALUES (
    p_tenant_id,
    p_patient_id,
    p_visit_id,
    p_appointment_id,
    v_doc_user_id,
    'draft',
    p_encounter_type,
    auth.uid(),
    auth.uid(),
    p_chief_complaint_snapshot,
    p_clinical_summary,
    p_metadata
  ) RETURNING * INTO v_encounter;

  -- 8. Log audit event
  v_audit_id := public.record_audit_event_internal(
    p_tenant_id,
    'clinical_encounter_created',
    'encounter',
    'clinical_encounter',
    v_encounter.id::text,
    auth.uid(),
    p_patient_id => p_patient_id,
    p_appointment_id => p_appointment_id::text,
    p_visit_id => p_visit_id,
    p_encounter_id => v_encounter.id,
    p_metadata => p_metadata
  );

  -- 9. Log activity event
  v_activity_id := public.record_activity_event_internal(
    p_tenant_id,
    'encounter',
    'clinical_encounter_created',
    'Clinical encounter created',
    'clinical_encounter',
    v_encounter.id::text,
    p_patient_id => p_patient_id,
    p_audit_event_id => v_audit_id,
    p_actor_user_id => auth.uid(),
    p_source_status => 'draft',
    p_visibility => 'clinical',
    p_metadata => p_metadata
  );

  RETURN v_encounter;
END;
$$;

-- 6. start_clinical_encounter
CREATE OR REPLACE FUNCTION public.start_clinical_encounter(
  p_tenant_id uuid,
  p_encounter_id uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS public.clinical_encounters
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role_ok boolean;
  v_encounter public.clinical_encounters;
  v_audit_id uuid;
  v_activity_id uuid;
END_TIME timestamptz;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant ID is required';
  END IF;

  v_role_ok := public.has_tenant_role(
    p_tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role, 'doctor'::public.app_role]
  );
  IF NOT v_role_ok THEN
    RAISE EXCEPTION 'Access denied: insufficient permissions for this tenant';
  END IF;

  SELECT * INTO v_encounter FROM public.clinical_encounters
  WHERE id = p_encounter_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF v_encounter.id IS NULL THEN
    RAISE EXCEPTION 'Clinical encounter not found in this tenant';
  END IF;

  IF v_encounter.status <> 'draft' THEN
    RAISE EXCEPTION 'Invalid status transition: cannot start encounter from status %', v_encounter.status;
  END IF;

  UPDATE public.clinical_encounters
  SET status = 'in_progress',
      started_at = COALESCE(started_at, now()),
      updated_by = auth.uid()
  WHERE id = p_encounter_id AND tenant_id = p_tenant_id
  RETURNING * INTO v_encounter;

  v_audit_id := public.record_audit_event_internal(
    p_tenant_id,
    'clinical_encounter_started',
    'encounter',
    'clinical_encounter',
    p_encounter_id::text,
    auth.uid(),
    p_patient_id => v_encounter.patient_id,
    p_appointment_id => v_encounter.appointment_id::text,
    p_visit_id => v_encounter.visit_id,
    p_encounter_id => p_encounter_id,
    p_metadata => p_metadata
  );

  v_activity_id := public.record_activity_event_internal(
    p_tenant_id,
    'encounter',
    'clinical_encounter_started',
    'Clinical encounter started',
    'clinical_encounter',
    p_encounter_id::text,
    p_patient_id => v_encounter.patient_id,
    p_audit_event_id => v_audit_id,
    p_actor_user_id => auth.uid(),
    p_source_status => 'in_progress',
    p_visibility => 'clinical',
    p_metadata => p_metadata
  );

  RETURN v_encounter;
END;
$$;

-- 7. complete_clinical_encounter
CREATE OR REPLACE FUNCTION public.complete_clinical_encounter(
  p_tenant_id uuid,
  p_encounter_id uuid,
  p_clinical_summary text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS public.clinical_encounters
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role_ok boolean;
  v_encounter public.clinical_encounters;
  v_audit_id uuid;
  v_activity_id uuid;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant ID is required';
  END IF;

  v_role_ok := public.has_tenant_role(
    p_tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role, 'doctor'::public.app_role]
  );
  IF NOT v_role_ok THEN
    RAISE EXCEPTION 'Access denied: insufficient permissions for this tenant';
  END IF;

  SELECT * INTO v_encounter FROM public.clinical_encounters
  WHERE id = p_encounter_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF v_encounter.id IS NULL THEN
    RAISE EXCEPTION 'Clinical encounter not found in this tenant';
  END IF;

  IF v_encounter.status NOT IN ('draft', 'in_progress') THEN
    RAISE EXCEPTION 'Invalid status transition: cannot complete encounter from status %', v_encounter.status;
  END IF;

  UPDATE public.clinical_encounters
  SET status = 'completed',
      completed_at = now(),
      clinical_summary = COALESCE(p_clinical_summary, clinical_summary),
      updated_by = auth.uid()
  WHERE id = p_encounter_id AND tenant_id = p_tenant_id
  RETURNING * INTO v_encounter;

  v_audit_id := public.record_audit_event_internal(
    p_tenant_id,
    'clinical_encounter_completed',
    'encounter',
    'clinical_encounter',
    p_encounter_id::text,
    auth.uid(),
    p_patient_id => v_encounter.patient_id,
    p_appointment_id => v_encounter.appointment_id::text,
    p_visit_id => v_encounter.visit_id,
    p_encounter_id => p_encounter_id,
    p_metadata => p_metadata
  );

  v_activity_id := public.record_activity_event_internal(
    p_tenant_id,
    'encounter',
    'clinical_encounter_completed',
    'Clinical encounter completed',
    'clinical_encounter',
    p_encounter_id::text,
    p_patient_id => v_encounter.patient_id,
    p_audit_event_id => v_audit_id,
    p_actor_user_id => auth.uid(),
    p_source_status => 'completed',
    p_visibility => 'clinical',
    p_metadata => p_metadata
  );

  RETURN v_encounter;
END;
$$;

-- 8. record_completed_service
CREATE OR REPLACE FUNCTION public.record_completed_service(
  p_tenant_id uuid,
  p_patient_id uuid,
  p_visit_id uuid DEFAULT NULL,
  p_encounter_id uuid DEFAULT NULL,
  p_appointment_id uuid DEFAULT NULL,
  p_finding_id uuid DEFAULT NULL,
  p_treatment_plan_id uuid DEFAULT NULL,
  p_treatment_stage_id uuid DEFAULT NULL,
  p_clinical_dictionary_item_id text DEFAULT NULL,
  p_service_code text DEFAULT NULL,
  p_service_name text DEFAULT NULL,
  p_tooth_number text DEFAULT NULL,
  p_tooth_surface text DEFAULT NULL,
  p_quantity numeric DEFAULT 1,
  p_unit_price numeric DEFAULT NULL,
  p_total_amount numeric DEFAULT NULL,
  p_currency text DEFAULT 'KZT',
  p_performed_at timestamptz DEFAULT now(),
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS public.completed_services
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role_ok boolean;
  v_patient_ok boolean;
  v_visit_ok boolean;
  v_encounter_ok boolean;
  v_appointment_ok boolean;
  v_finding_ok boolean;
  v_plan_ok boolean;
  v_stage_ok boolean;
  v_dict_ok boolean;
  v_service public.completed_services;
  v_audit_id uuid;
  v_activity_id uuid;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant ID is required';
  END IF;

  IF p_service_name IS NULL OR length(btrim(p_service_name)) = 0 THEN
    RAISE EXCEPTION 'Service name is required';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero';
  END IF;

  IF p_unit_price IS NOT NULL AND p_unit_price < 0 THEN
    RAISE EXCEPTION 'Unit price cannot be negative';
  END IF;

  IF p_total_amount IS NOT NULL AND p_total_amount < 0 THEN
    RAISE EXCEPTION 'Total amount cannot be negative';
  END IF;

  IF p_currency IS NULL OR length(btrim(p_currency)) = 0 THEN
    RAISE EXCEPTION 'Currency is required';
  END IF;

  -- 1. Check permissions
  v_role_ok := public.has_tenant_role(
    p_tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role, 'doctor'::public.app_role]
  );
  IF NOT v_role_ok THEN
    RAISE EXCEPTION 'Access denied: insufficient permissions for this tenant';
  END IF;

  -- 2. Verify patient
  SELECT EXISTS (
    SELECT 1 FROM public.patients
    WHERE id = p_patient_id AND tenant_id = p_tenant_id
  ) INTO v_patient_ok;
  IF NOT v_patient_ok THEN
    RAISE EXCEPTION 'Patient not found in this tenant';
  END IF;

  -- 3. Verify visit
  IF p_visit_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.patient_visits
      WHERE id = p_visit_id AND tenant_id = p_tenant_id AND patient_id = p_patient_id
    ) INTO v_visit_ok;
    IF NOT v_visit_ok THEN
      RAISE EXCEPTION 'Visit not found or does not belong to this patient/tenant';
    END IF;
  END IF;

  -- 4. Verify encounter
  IF p_encounter_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.clinical_encounters
      WHERE id = p_encounter_id AND tenant_id = p_tenant_id AND patient_id = p_patient_id
    ) INTO v_encounter_ok;
    IF NOT v_encounter_ok THEN
      RAISE EXCEPTION 'Encounter not found or does not belong to this patient/tenant';
    END IF;
  END IF;

  -- 5. Verify appointment
  IF p_appointment_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.appointments
      WHERE id = p_appointment_id AND tenant_id = p_tenant_id AND patient_id = p_patient_id
    ) INTO v_appointment_ok;
    IF NOT v_appointment_ok THEN
      RAISE EXCEPTION 'Appointment not found or does not belong to this patient/tenant';
    END IF;
  END IF;

  -- 6. Verify finding
  IF p_finding_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.findings
      WHERE id = p_finding_id AND tenant_id = p_tenant_id AND patient_id = p_patient_id
    ) INTO v_finding_ok;
    IF NOT v_finding_ok THEN
      RAISE EXCEPTION 'Finding not found or does not belong to this patient/tenant';
    END IF;
  END IF;

  -- 7. Verify treatment plan
  IF p_treatment_plan_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.treatment_plans
      WHERE id = p_treatment_plan_id AND tenant_id = p_tenant_id AND patient_id = p_patient_id
    ) INTO v_plan_ok;
    IF NOT v_plan_ok THEN
      RAISE EXCEPTION 'Treatment plan not found or does not belong to this patient/tenant';
    END IF;
  END IF;

  -- 8. Verify treatment stage
  IF p_treatment_stage_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.treatment_stages s
      JOIN public.treatment_plans p ON s.treatment_plan_id = p.id
      WHERE s.id = p_treatment_stage_id AND p.tenant_id = p_tenant_id AND p.patient_id = p_patient_id
    ) INTO v_stage_ok;
    IF NOT v_stage_ok THEN
      RAISE EXCEPTION 'Treatment stage not found or does not belong to this patient/tenant';
    END IF;
  END IF;

  -- 9. Verify dictionary item
  IF p_clinical_dictionary_item_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.clinical_dictionary_items
      WHERE id = p_clinical_dictionary_item_id AND tenant_id = p_tenant_id
    ) INTO v_dict_ok;
    IF NOT v_dict_ok THEN
      RAISE EXCEPTION 'Clinical dictionary item not found in this tenant';
    END IF;
  END IF;

  -- 10. Insert completed service
  INSERT INTO public.completed_services (
    tenant_id,
    patient_id,
    visit_id,
    encounter_id,
    appointment_id,
    finding_id,
    treatment_plan_id,
    treatment_stage_id,
    clinical_dictionary_item_id,
    service_code,
    service_name,
    tooth_number,
    tooth_surface,
    quantity,
    unit_price,
    total_amount,
    currency,
    performed_by,
    performed_at,
    status,
    created_by,
    updated_by,
    metadata
  ) VALUES (
    p_tenant_id,
    p_patient_id,
    p_visit_id,
    p_encounter_id,
    p_appointment_id,
    p_finding_id,
    p_treatment_plan_id,
    p_treatment_stage_id,
    p_clinical_dictionary_item_id,
    p_service_code,
    p_service_name,
    p_tooth_number,
    p_tooth_surface,
    p_quantity,
    p_unit_price,
    p_total_amount,
    p_currency,
    auth.uid(),
    COALESCE(p_performed_at, now()),
    'completed',
    auth.uid(),
    auth.uid(),
    p_metadata
  ) RETURNING * INTO v_service;

  -- 11. Log audit event
  v_audit_id := public.record_audit_event_internal(
    p_tenant_id,
    'completed_service_recorded',
    'completed_service',
    'completed_service',
    v_service.id::text,
    auth.uid(),
    p_patient_id => p_patient_id,
    p_appointment_id => p_appointment_id::text,
    p_visit_id => p_visit_id,
    p_encounter_id => p_encounter_id,
    p_treatment_plan_id => p_treatment_plan_id::text,
    p_treatment_stage_id => p_treatment_stage_id::text,
    p_finding_id => p_finding_id::text,
    p_metadata => p_metadata
  );

  -- 12. Log activity event
  v_activity_id := public.record_activity_event_internal(
    p_tenant_id,
    'completed_service',
    'completed_service_recorded',
    'Completed service recorded',
    'completed_service',
    v_service.id::text,
    p_patient_id => p_patient_id,
    p_audit_event_id => v_audit_id,
    p_actor_user_id => auth.uid(),
    p_source_status => 'completed',
    p_visibility => 'clinical',
    p_metadata => p_metadata
  );

  RETURN v_service;
END;
$$;

-- 9. void_completed_service
CREATE OR REPLACE FUNCTION public.void_completed_service(
  p_tenant_id uuid,
  p_completed_service_id uuid,
  p_reason text,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS public.completed_services
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role_ok boolean;
  v_service public.completed_services;
  v_audit_id uuid;
  v_activity_id uuid;
  v_final_metadata jsonb;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant ID is required';
  END IF;

  IF p_reason IS NULL OR length(btrim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'Reason for voiding is required';
  END IF;

  -- 1. Check permissions
  v_role_ok := public.has_tenant_role(
    p_tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role, 'doctor'::public.app_role]
  );
  IF NOT v_role_ok THEN
    RAISE EXCEPTION 'Access denied: insufficient permissions for this tenant';
  END IF;

  -- 2. Select service for update
  SELECT * INTO v_service FROM public.completed_services
  WHERE id = p_completed_service_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF v_service.id IS NULL THEN
    RAISE EXCEPTION 'Completed service not found in this tenant';
  END IF;

  -- 3. Check allowed status transitions
  IF v_service.status = 'voided' THEN
    RAISE EXCEPTION 'Completed service is already voided';
  END IF;
  IF v_service.status = 'archived' THEN
    RAISE EXCEPTION 'Completed service is archived and cannot be voided';
  END IF;
  IF v_service.status NOT IN ('completed', 'corrected') THEN
    RAISE EXCEPTION 'Invalid status transition: cannot void service with status %', v_service.status;
  END IF;

  v_final_metadata := COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('void_reason', p_reason);

  -- 4. Update service
  UPDATE public.completed_services
  SET status = 'voided',
      voided_at = now(),
      voided_by = auth.uid(),
      correction_reason = p_reason,
      metadata = v_final_metadata,
      updated_by = auth.uid()
  WHERE id = p_completed_service_id AND tenant_id = p_tenant_id
  RETURNING * INTO v_service;

  -- 5. Log audit event
  v_audit_id := public.record_audit_event_internal(
    p_tenant_id,
    'completed_service_voided',
    'completed_service',
    'completed_service',
    p_completed_service_id::text,
    auth.uid(),
    p_patient_id => v_service.patient_id,
    p_appointment_id => v_service.appointment_id::text,
    p_visit_id => v_service.visit_id,
    p_encounter_id => v_service.encounter_id,
    p_treatment_plan_id => v_service.treatment_plan_id::text,
    p_treatment_stage_id => v_service.treatment_stage_id::text,
    p_finding_id => v_service.finding_id::text,
    p_reason => p_reason,
    p_metadata => v_final_metadata
  );

  -- 6. Log activity event
  v_activity_id := public.record_activity_event_internal(
    p_tenant_id,
    'completed_service',
    'completed_service_voided',
    'Completed service voided',
    'completed_service',
    p_completed_service_id::text,
    p_patient_id => v_service.patient_id,
    p_audit_event_id => v_audit_id,
    p_actor_user_id => auth.uid(),
    p_description => p_reason,
    p_source_status => 'voided',
    p_visibility => 'clinical',
    p_metadata => v_final_metadata
  );

  RETURN v_service;
END;
$$;

-- Revoke default PUBLIC execute privilege from all new functions
REVOKE ALL ON FUNCTION public.check_in_patient_visit(uuid, uuid, uuid, text, timestamptz, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_in_patient_visit(uuid, uuid, uuid, text, timestamptz, text, jsonb) FROM anon;

REVOKE ALL ON FUNCTION public.start_patient_visit(uuid, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_patient_visit(uuid, uuid, jsonb) FROM anon;

REVOKE ALL ON FUNCTION public.complete_patient_visit(uuid, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_patient_visit(uuid, uuid, jsonb) FROM anon;

REVOKE ALL ON FUNCTION public.cancel_patient_visit(uuid, uuid, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_patient_visit(uuid, uuid, text, jsonb) FROM anon;

REVOKE ALL ON FUNCTION public.create_clinical_encounter(uuid, uuid, uuid, uuid, uuid, text, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_clinical_encounter(uuid, uuid, uuid, uuid, uuid, text, text, text, jsonb) FROM anon;

REVOKE ALL ON FUNCTION public.start_clinical_encounter(uuid, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_clinical_encounter(uuid, uuid, jsonb) FROM anon;

REVOKE ALL ON FUNCTION public.complete_clinical_encounter(uuid, uuid, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_clinical_encounter(uuid, uuid, text, jsonb) FROM anon;

REVOKE ALL ON FUNCTION public.record_completed_service(uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, text, text, text, text, numeric, numeric, numeric, text, timestamptz, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_completed_service(uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, text, text, text, text, numeric, numeric, numeric, text, timestamptz, jsonb) FROM anon;

REVOKE ALL ON FUNCTION public.void_completed_service(uuid, uuid, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.void_completed_service(uuid, uuid, text, jsonb) FROM anon;

-- Grant EXECUTE to authenticated users
GRANT EXECUTE ON FUNCTION public.check_in_patient_visit(uuid, uuid, uuid, text, timestamptz, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_patient_visit(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_patient_visit(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_patient_visit(uuid, uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_clinical_encounter(uuid, uuid, uuid, uuid, uuid, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_clinical_encounter(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_clinical_encounter(uuid, uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_completed_service(uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, text, text, text, text, numeric, numeric, numeric, text, timestamptz, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_completed_service(uuid, uuid, text, jsonb) TO authenticated;
