-- 0013_create_audit_activity_rpc.sql
-- Controlled internal helpers for transactional audit/activity writes.
-- These helpers are intentionally not browser-callable by normal authenticated users.

CREATE OR REPLACE FUNCTION public.record_audit_event_internal(
  p_tenant_id uuid,
  p_action text,
  p_category text,
  p_target_type text,
  p_target_id text,
  p_actor_user_id uuid DEFAULT auth.uid(),
  p_actor_role text DEFAULT NULL,
  p_actor_tenant_role text DEFAULT NULL,
  p_actor_display_name text DEFAULT NULL,
  p_severity text DEFAULT 'info',
  p_patient_id uuid DEFAULT NULL,
  p_appointment_id text DEFAULT NULL,
  p_visit_id uuid DEFAULT NULL,
  p_encounter_id uuid DEFAULT NULL,
  p_treatment_plan_id text DEFAULT NULL,
  p_treatment_stage_id text DEFAULT NULL,
  p_finding_id text DEFAULT NULL,
  p_file_id text DEFAULT NULL,
  p_payment_id text DEFAULT NULL,
  p_stock_movement_id text DEFAULT NULL,
  p_before_data jsonb DEFAULT NULL,
  p_after_data jsonb DEFAULT NULL,
  p_diff_data jsonb DEFAULT NULL,
  p_redaction_level text DEFAULT 'standard',
  p_reason text DEFAULT NULL,
  p_request_id text DEFAULT NULL,
  p_session_id text DEFAULT NULL,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_audit_event_id uuid;
BEGIN
  IF p_action IS NULL OR length(btrim(p_action)) = 0 THEN
    RAISE EXCEPTION 'Audit action is required';
  END IF;

  IF p_category IS NULL OR p_category NOT IN (
    'auth',
    'tenant',
    'role_membership',
    'patient',
    'appointment',
    'visit',
    'encounter',
    'finding',
    'treatment_plan',
    'completed_service',
    'file',
    'document',
    'payment',
    'stock',
    'dictionary',
    'billing_subscription',
    'system',
    'support_access'
  ) THEN
    RAISE EXCEPTION 'Unsupported audit category: %', p_category;
  END IF;

  IF p_target_type IS NULL OR length(btrim(p_target_type)) = 0 THEN
    RAISE EXCEPTION 'Audit target_type is required';
  END IF;

  IF p_target_id IS NULL OR length(btrim(p_target_id)) = 0 THEN
    RAISE EXCEPTION 'Audit target_id is required';
  END IF;

  IF p_severity IS NULL OR p_severity NOT IN ('debug', 'info', 'warning', 'critical') THEN
    RAISE EXCEPTION 'Unsupported audit severity: %', p_severity;
  END IF;

  IF p_redaction_level IS NULL OR p_redaction_level NOT IN ('none', 'standard', 'restricted', 'confidential') THEN
    RAISE EXCEPTION 'Unsupported audit redaction_level: %', p_redaction_level;
  END IF;

  IF p_metadata IS NULL OR jsonb_typeof(p_metadata) <> 'object' THEN
    RAISE EXCEPTION 'Audit metadata must be a JSON object';
  END IF;

  IF p_before_data IS NOT NULL AND jsonb_typeof(p_before_data) <> 'object' THEN
    RAISE EXCEPTION 'Audit before_data must be a JSON object when provided';
  END IF;

  IF p_after_data IS NOT NULL AND jsonb_typeof(p_after_data) <> 'object' THEN
    RAISE EXCEPTION 'Audit after_data must be a JSON object when provided';
  END IF;

  IF p_diff_data IS NOT NULL AND jsonb_typeof(p_diff_data) <> 'object' THEN
    RAISE EXCEPTION 'Audit diff_data must be a JSON object when provided';
  END IF;

  INSERT INTO public.audit_events (
    tenant_id,
    actor_user_id,
    actor_role,
    actor_tenant_role,
    actor_display_name,
    action,
    category,
    severity,
    target_type,
    target_id,
    patient_id,
    appointment_id,
    visit_id,
    encounter_id,
    treatment_plan_id,
    treatment_stage_id,
    finding_id,
    file_id,
    payment_id,
    stock_movement_id,
    before_data,
    after_data,
    diff_data,
    redaction_level,
    reason,
    request_id,
    session_id,
    ip_address,
    user_agent,
    metadata
  ) VALUES (
    p_tenant_id,
    p_actor_user_id,
    p_actor_role,
    p_actor_tenant_role,
    p_actor_display_name,
    p_action,
    p_category,
    p_severity,
    p_target_type,
    p_target_id,
    p_patient_id,
    p_appointment_id,
    p_visit_id,
    p_encounter_id,
    p_treatment_plan_id,
    p_treatment_stage_id,
    p_finding_id,
    p_file_id,
    p_payment_id,
    p_stock_movement_id,
    p_before_data,
    p_after_data,
    p_diff_data,
    p_redaction_level,
    p_reason,
    p_request_id,
    p_session_id,
    p_ip_address,
    p_user_agent,
    p_metadata
  ) RETURNING id INTO v_audit_event_id;

  RETURN v_audit_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_activity_event_internal(
  p_tenant_id uuid,
  p_category text,
  p_type text,
  p_title text,
  p_source_type text,
  p_source_id text,
  p_patient_id uuid DEFAULT NULL,
  p_audit_event_id uuid DEFAULT NULL,
  p_actor_user_id uuid DEFAULT auth.uid(),
  p_description text DEFAULT NULL,
  p_source_status text DEFAULT NULL,
  p_visibility text DEFAULT 'admin',
  p_severity text DEFAULT 'info',
  p_occurred_at timestamptz DEFAULT now(),
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_is_archived boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_activity_event_id uuid;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Activity tenant_id is required';
  END IF;

  IF p_category IS NULL OR p_category NOT IN (
    'patient',
    'complaint',
    'dental_chart',
    'finding',
    'treatment_plan',
    'appointment',
    'visit',
    'encounter',
    'completed_service',
    'file',
    'document',
    'payment',
    'stock',
    'audit',
    'system'
  ) THEN
    RAISE EXCEPTION 'Unsupported activity category: %', p_category;
  END IF;

  IF p_type IS NULL OR length(btrim(p_type)) = 0 THEN
    RAISE EXCEPTION 'Activity type is required';
  END IF;

  IF p_title IS NULL OR length(btrim(p_title)) = 0 THEN
    RAISE EXCEPTION 'Activity title is required';
  END IF;

  IF p_source_type IS NULL OR length(btrim(p_source_type)) = 0 THEN
    RAISE EXCEPTION 'Activity source_type is required';
  END IF;

  IF p_source_id IS NULL OR length(btrim(p_source_id)) = 0 THEN
    RAISE EXCEPTION 'Activity source_id is required';
  END IF;

  IF p_visibility IS NULL OR p_visibility NOT IN ('clinical', 'admin', 'financial', 'system') THEN
    RAISE EXCEPTION 'Unsupported activity visibility: %', p_visibility;
  END IF;

  IF p_severity IS NULL OR p_severity NOT IN ('debug', 'info', 'warning', 'critical') THEN
    RAISE EXCEPTION 'Unsupported activity severity: %', p_severity;
  END IF;

  IF p_metadata IS NULL OR jsonb_typeof(p_metadata) <> 'object' THEN
    RAISE EXCEPTION 'Activity metadata must be a JSON object';
  END IF;

  INSERT INTO public.activity_events (
    tenant_id,
    patient_id,
    audit_event_id,
    actor_user_id,
    category,
    type,
    title,
    description,
    source_type,
    source_id,
    source_status,
    visibility,
    severity,
    occurred_at,
    metadata,
    is_archived
  ) VALUES (
    p_tenant_id,
    p_patient_id,
    p_audit_event_id,
    p_actor_user_id,
    p_category,
    p_type,
    p_title,
    p_description,
    p_source_type,
    p_source_id,
    p_source_status,
    p_visibility,
    p_severity,
    COALESCE(p_occurred_at, now()),
    p_metadata,
    COALESCE(p_is_archived, false)
  ) RETURNING id INTO v_activity_event_id;

  RETURN v_activity_event_id;
END;
$$;

COMMENT ON FUNCTION public.record_audit_event_internal(
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  text,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb,
  jsonb,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb
) IS 'Internal trusted helper for transactional audit writes. Not for arbitrary frontend audit creation. Future domain RPCs should call it in the same transaction as sensitive mutations. Never store secrets, passwords, service role keys, tokens, or full file contents.';

COMMENT ON FUNCTION public.record_activity_event_internal(
  uuid,
  text,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  timestamptz,
  jsonb,
  boolean
) IS 'Internal trusted helper for transactional product activity writes. Patient timeline should consume summarized activity, not raw audit diffs. Not for arbitrary frontend activity creation.';

REVOKE ALL ON FUNCTION public.record_audit_event_internal(
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  text,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb,
  jsonb,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_audit_event_internal(
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  text,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb,
  jsonb,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb
) FROM anon;
REVOKE ALL ON FUNCTION public.record_audit_event_internal(
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  text,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb,
  jsonb,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_audit_event_internal(
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  text,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb,
  jsonb,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb
) TO service_role;

REVOKE ALL ON FUNCTION public.record_activity_event_internal(
  uuid,
  text,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  timestamptz,
  jsonb,
  boolean
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_activity_event_internal(
  uuid,
  text,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  timestamptz,
  jsonb,
  boolean
) FROM anon;
REVOKE ALL ON FUNCTION public.record_activity_event_internal(
  uuid,
  text,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  timestamptz,
  jsonb,
  boolean
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_activity_event_internal(
  uuid,
  text,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  timestamptz,
  jsonb,
  boolean
) TO service_role;
