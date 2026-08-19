-- 0036_create_laboratory_work_mutation_rpc.sql
-- Atomic tenant-scoped mutation boundary for dental laboratory work orders.
--
-- Scope:
-- - explicit laboratory audit category;
-- - atomic create/edit work-order + desired work-type set;
-- - explicit complete/reopen lifecycle commands;
-- - tenant/role/reference validation;
-- - caller-provided order UUID create idempotency;
-- - FOR UPDATE + expected_updated_at stale-write protection;
-- - no hard-delete RPC, no finance/warehouse/treatment/completed-service side effects.

-- Audit taxonomy extension. Activity-feed projection remains intentionally unchanged:
-- 001M requires audit integrity, while a product-facing activity event is optional.
ALTER TABLE public.audit_events
  DROP CONSTRAINT IF EXISTS audit_events_category_check;

ALTER TABLE public.audit_events
  ADD CONSTRAINT audit_events_category_check CHECK (category IN (
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
    'laboratory',
    'billing_subscription',
    'system',
    'support_access'
  ));

-- Laboratory-local optimistic concurrency token. Do not change the project-wide
-- set_updated_at() helper: it uses transaction time and is shared by unrelated domains.
ALTER TABLE public.laboratory_work_orders
  ADD COLUMN IF NOT EXISTS mutation_version bigint NOT NULL DEFAULT 1;

ALTER TABLE public.laboratory_work_orders
  DROP CONSTRAINT IF EXISTS laboratory_work_orders_mutation_version_check;
ALTER TABLE public.laboratory_work_orders
  ADD CONSTRAINT laboratory_work_orders_mutation_version_check CHECK (mutation_version >= 1);

CREATE OR REPLACE FUNCTION public.bump_laboratory_work_order_mutation_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $labver$
BEGIN
  NEW.mutation_version := OLD.mutation_version + 1;
  RETURN NEW;
END;
$labver$;

DROP TRIGGER IF EXISTS laboratory_work_orders_bump_mutation_version ON public.laboratory_work_orders;
CREATE TRIGGER laboratory_work_orders_bump_mutation_version
BEFORE UPDATE ON public.laboratory_work_orders
FOR EACH ROW
EXECUTE FUNCTION public.bump_laboratory_work_order_mutation_version();

-- Keep the project-wide transactional audit helper authoritative and teach it the new
-- category instead of creating a second laboratory-specific audit implementation.
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
    'laboratory',
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

-- CREATE. Caller owns domain identity via p_order_id. A retry with the same ID and
-- demonstrably identical canonical payload returns the existing order without a second audit.
CREATE OR REPLACE FUNCTION public.create_laboratory_work_order_atomic(
  p_tenant_id uuid,
  p_order_id uuid,
  p_patient_id uuid,
  p_title text,
  p_work_type_ids uuid[] DEFAULT '{}'::uuid[],
  p_responsible_doctor_id uuid DEFAULT NULL,
  p_laboratory_id uuid DEFAULT NULL,
  p_order_number text DEFAULT NULL,
  p_sent_to_lab_at timestamptz DEFAULT NULL,
  p_planned_ready_at timestamptz DEFAULT NULL,
  p_received_from_lab_at timestamptz DEFAULT NULL,
  p_try_in_at timestamptz DEFAULT NULL,
  p_delivered_to_patient_at timestamptz DEFAULT NULL,
  p_shade text DEFAULT NULL,
  p_anatomical_scope text DEFAULT NULL,
  p_selected_teeth integer[] DEFAULT '{}'::integer[],
  p_comment text DEFAULT NULL,
  p_request_id text DEFAULT NULL
) RETURNS public.laboratory_work_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_existing public.laboratory_work_orders%ROWTYPE;
  v_result public.laboratory_work_orders%ROWTYPE;
  v_work_type_ids uuid[];
  v_existing_type_ids uuid[];
  v_selected_teeth integer[];
  v_title text := btrim(COALESCE(p_title, ''));
  v_order_number text := NULLIF(btrim(p_order_number), '');
  v_shade text := NULLIF(btrim(p_shade), '');
  v_comment text := NULLIF(btrim(p_comment), '');
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'LAB_ORDER_ACCESS_DENIED';
  END IF;

  SELECT tu.role::text INTO v_actor_role
  FROM public.tenant_users tu
  WHERE tu.tenant_id = p_tenant_id AND tu.user_id = v_actor;

  IF v_actor_role IS NULL OR v_actor_role NOT IN ('clinic_owner', 'clinic_admin', 'doctor', 'registrar') THEN
    RAISE EXCEPTION 'LAB_ORDER_ACCESS_DENIED';
  END IF;

  IF p_order_id IS NULL OR p_patient_id IS NULL THEN
    RAISE EXCEPTION 'LAB_ORDER_REQUIRED_ID_MISSING';
  END IF;
  IF length(v_title) = 0 THEN
    RAISE EXCEPTION 'LAB_ORDER_TITLE_REQUIRED';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT wt ORDER BY wt), '{}'::uuid[])
    INTO v_work_type_ids
  FROM unnest(COALESCE(p_work_type_ids, '{}'::uuid[])) AS t(wt);

  SELECT COALESCE(array_agg(DISTINCT tooth ORDER BY tooth), '{}'::integer[])
    INTO v_selected_teeth
  FROM unnest(COALESCE(p_selected_teeth, '{}'::integer[])) AS t(tooth);

  -- Global PK collision is intentionally reported generically so another tenant's
  -- existence is never disclosed.
  SELECT * INTO v_existing
  FROM public.laboratory_work_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_existing.id IS NOT NULL THEN
    IF v_existing.tenant_id <> p_tenant_id THEN
      RAISE EXCEPTION 'LAB_ORDER_CREATE_CONFLICT';
    END IF;

    SELECT COALESCE(array_agg(laboratory_work_type_id ORDER BY laboratory_work_type_id), '{}'::uuid[])
      INTO v_existing_type_ids
    FROM public.laboratory_work_order_types
    WHERE tenant_id = p_tenant_id AND laboratory_work_order_id = p_order_id;

    IF v_existing.patient_id = p_patient_id
      AND v_existing.responsible_doctor_id IS NOT DISTINCT FROM p_responsible_doctor_id
      AND v_existing.laboratory_id IS NOT DISTINCT FROM p_laboratory_id
      AND v_existing.order_number IS NOT DISTINCT FROM v_order_number
      AND v_existing.title = v_title
      AND v_existing.status = 'in_progress'
      AND v_existing.sent_to_lab_at IS NOT DISTINCT FROM p_sent_to_lab_at
      AND v_existing.planned_ready_at IS NOT DISTINCT FROM p_planned_ready_at
      AND v_existing.received_from_lab_at IS NOT DISTINCT FROM p_received_from_lab_at
      AND v_existing.try_in_at IS NOT DISTINCT FROM p_try_in_at
      AND v_existing.delivered_to_patient_at IS NOT DISTINCT FROM p_delivered_to_patient_at
      AND v_existing.shade IS NOT DISTINCT FROM v_shade
      AND v_existing.anatomical_scope IS NOT DISTINCT FROM p_anatomical_scope
      AND v_existing.selected_teeth = v_selected_teeth
      AND v_existing.comment IS NOT DISTINCT FROM v_comment
      AND v_existing_type_ids = v_work_type_ids
    THEN
      RETURN v_existing;
    END IF;

    RAISE EXCEPTION 'LAB_ORDER_CREATE_CONFLICT';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.tenant_id = p_tenant_id AND p.id = p_patient_id
  ) THEN
    RAISE EXCEPTION 'LAB_ORDER_REFERENCE_UNAVAILABLE';
  END IF;

  IF p_responsible_doctor_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.doctors d
    WHERE d.tenant_id = p_tenant_id AND d.id = p_responsible_doctor_id AND d.active = true
  ) THEN
    RAISE EXCEPTION 'LAB_ORDER_REFERENCE_UNAVAILABLE';
  END IF;

  IF p_laboratory_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.laboratories l
    WHERE l.tenant_id = p_tenant_id AND l.id = p_laboratory_id AND l.active = true
  ) THEN
    RAISE EXCEPTION 'LAB_ORDER_REFERENCE_UNAVAILABLE';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(v_work_type_ids) AS requested(work_type_id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.laboratory_work_types wt
      WHERE wt.tenant_id = p_tenant_id
        AND wt.id = requested.work_type_id
        AND wt.active = true
    )
  ) THEN
    RAISE EXCEPTION 'LAB_ORDER_REFERENCE_UNAVAILABLE';
  END IF;

  INSERT INTO public.laboratory_work_orders (
    id, tenant_id, patient_id, responsible_doctor_id, laboratory_id,
    order_number, title, status, sent_to_lab_at, planned_ready_at,
    received_from_lab_at, try_in_at, delivered_to_patient_at, shade,
    anatomical_scope, selected_teeth, comment, created_by, updated_by
  ) VALUES (
    p_order_id, p_tenant_id, p_patient_id, p_responsible_doctor_id, p_laboratory_id,
    v_order_number, v_title, 'in_progress', p_sent_to_lab_at, p_planned_ready_at,
    p_received_from_lab_at, p_try_in_at, p_delivered_to_patient_at, v_shade,
    p_anatomical_scope, v_selected_teeth, v_comment, v_actor, v_actor
  )
  RETURNING * INTO v_result;

  INSERT INTO public.laboratory_work_order_types (
    tenant_id, laboratory_work_order_id, laboratory_work_type_id
  )
  SELECT p_tenant_id, p_order_id, work_type_id
  FROM unnest(v_work_type_ids) AS requested(work_type_id)
  ON CONFLICT DO NOTHING;

  PERFORM public.record_audit_event_internal(
    p_tenant_id => p_tenant_id,
    p_action => 'laboratory_order.created',
    p_category => 'laboratory',
    p_target_type => 'laboratory_work_order',
    p_target_id => p_order_id::text,
    p_actor_user_id => v_actor,
    p_actor_tenant_role => v_actor_role,
    p_patient_id => p_patient_id,
    p_after_data => jsonb_build_object(
      'status', v_result.status,
      'responsible_doctor_id', v_result.responsible_doctor_id,
      'laboratory_id', v_result.laboratory_id,
      'planned_ready_at', v_result.planned_ready_at,
      'work_type_ids', to_jsonb(v_work_type_ids)
    ),
    p_redaction_level => 'restricted',
    p_request_id => NULLIF(btrim(p_request_id), ''),
    p_metadata => jsonb_build_object('work_type_count', cardinality(v_work_type_ids))
  );

  RETURN v_result;
END;
$$;

-- EDIT. Canonical full desired state, allowed only while in_progress.
CREATE OR REPLACE FUNCTION public.update_laboratory_work_order_atomic(
  p_tenant_id uuid,
  p_order_id uuid,
  p_expected_version bigint,
  p_title text,
  p_work_type_ids uuid[] DEFAULT '{}'::uuid[],
  p_responsible_doctor_id uuid DEFAULT NULL,
  p_laboratory_id uuid DEFAULT NULL,
  p_order_number text DEFAULT NULL,
  p_sent_to_lab_at timestamptz DEFAULT NULL,
  p_planned_ready_at timestamptz DEFAULT NULL,
  p_received_from_lab_at timestamptz DEFAULT NULL,
  p_try_in_at timestamptz DEFAULT NULL,
  p_delivered_to_patient_at timestamptz DEFAULT NULL,
  p_shade text DEFAULT NULL,
  p_anatomical_scope text DEFAULT NULL,
  p_selected_teeth integer[] DEFAULT '{}'::integer[],
  p_comment text DEFAULT NULL,
  p_request_id text DEFAULT NULL
) RETURNS public.laboratory_work_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_before public.laboratory_work_orders%ROWTYPE;
  v_result public.laboratory_work_orders%ROWTYPE;
  v_current_type_ids uuid[];
  v_work_type_ids uuid[];
  v_selected_teeth integer[];
  v_title text := btrim(COALESCE(p_title, ''));
  v_order_number text := NULLIF(btrim(p_order_number), '');
  v_shade text := NULLIF(btrim(p_shade), '');
  v_comment text := NULLIF(btrim(p_comment), '');
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'LAB_ORDER_ACCESS_DENIED';
  END IF;

  SELECT tu.role::text INTO v_actor_role
  FROM public.tenant_users tu
  WHERE tu.tenant_id = p_tenant_id AND tu.user_id = v_actor;

  IF v_actor_role IS NULL OR v_actor_role NOT IN ('clinic_owner', 'clinic_admin', 'doctor', 'registrar') THEN
    RAISE EXCEPTION 'LAB_ORDER_ACCESS_DENIED';
  END IF;
  IF length(v_title) = 0 THEN
    RAISE EXCEPTION 'LAB_ORDER_TITLE_REQUIRED';
  END IF;

  SELECT * INTO v_before
  FROM public.laboratory_work_orders
  WHERE tenant_id = p_tenant_id AND id = p_order_id
  FOR UPDATE;

  IF v_before.id IS NULL THEN
    RAISE EXCEPTION 'LAB_ORDER_NOT_FOUND';
  END IF;
  IF v_before.status <> 'in_progress' THEN
    RAISE EXCEPTION 'LAB_ORDER_EDIT_REQUIRES_IN_PROGRESS';
  END IF;
  IF p_expected_version IS NULL OR v_before.mutation_version <> p_expected_version THEN
    RAISE EXCEPTION 'LAB_ORDER_STALE_WRITE';
  END IF;

  SELECT COALESCE(array_agg(laboratory_work_type_id ORDER BY laboratory_work_type_id), '{}'::uuid[])
    INTO v_current_type_ids
  FROM public.laboratory_work_order_types
  WHERE tenant_id = p_tenant_id AND laboratory_work_order_id = p_order_id;

  SELECT COALESCE(array_agg(DISTINCT wt ORDER BY wt), '{}'::uuid[])
    INTO v_work_type_ids
  FROM unnest(COALESCE(p_work_type_ids, '{}'::uuid[])) AS t(wt);

  SELECT COALESCE(array_agg(DISTINCT tooth ORDER BY tooth), '{}'::integer[])
    INTO v_selected_teeth
  FROM unnest(COALESCE(p_selected_teeth, '{}'::integer[])) AS t(tooth);

  -- Preserve already-linked inactive historical references, but a newly selected
  -- doctor/laboratory/work type must be active in this tenant.
  IF p_responsible_doctor_id IS NOT NULL
    AND p_responsible_doctor_id IS DISTINCT FROM v_before.responsible_doctor_id
    AND NOT EXISTS (
      SELECT 1 FROM public.doctors d
      WHERE d.tenant_id = p_tenant_id AND d.id = p_responsible_doctor_id AND d.active = true
    )
  THEN
    RAISE EXCEPTION 'LAB_ORDER_REFERENCE_UNAVAILABLE';
  END IF;

  IF p_laboratory_id IS NOT NULL
    AND p_laboratory_id IS DISTINCT FROM v_before.laboratory_id
    AND NOT EXISTS (
      SELECT 1 FROM public.laboratories l
      WHERE l.tenant_id = p_tenant_id AND l.id = p_laboratory_id AND l.active = true
    )
  THEN
    RAISE EXCEPTION 'LAB_ORDER_REFERENCE_UNAVAILABLE';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(v_work_type_ids) AS requested(work_type_id)
    WHERE NOT (requested.work_type_id = ANY(v_current_type_ids))
      AND NOT EXISTS (
        SELECT 1 FROM public.laboratory_work_types wt
        WHERE wt.tenant_id = p_tenant_id
          AND wt.id = requested.work_type_id
          AND wt.active = true
      )
  ) THEN
    RAISE EXCEPTION 'LAB_ORDER_REFERENCE_UNAVAILABLE';
  END IF;

  -- Existing/same references still must belong to this tenant. This deliberately
  -- prevents a SECURITY DEFINER RPC from becoming an RLS bypass.
  IF p_responsible_doctor_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.doctors d
    WHERE d.tenant_id = p_tenant_id AND d.id = p_responsible_doctor_id
  ) THEN
    RAISE EXCEPTION 'LAB_ORDER_REFERENCE_UNAVAILABLE';
  END IF;

  IF p_laboratory_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.laboratories l
    WHERE l.tenant_id = p_tenant_id AND l.id = p_laboratory_id
  ) THEN
    RAISE EXCEPTION 'LAB_ORDER_REFERENCE_UNAVAILABLE';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(v_work_type_ids) AS requested(work_type_id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.laboratory_work_types wt
      WHERE wt.tenant_id = p_tenant_id AND wt.id = requested.work_type_id
    )
  ) THEN
    RAISE EXCEPTION 'LAB_ORDER_REFERENCE_UNAVAILABLE';
  END IF;

  UPDATE public.laboratory_work_orders
  SET responsible_doctor_id = p_responsible_doctor_id,
      laboratory_id = p_laboratory_id,
      order_number = v_order_number,
      title = v_title,
      sent_to_lab_at = p_sent_to_lab_at,
      planned_ready_at = p_planned_ready_at,
      received_from_lab_at = p_received_from_lab_at,
      try_in_at = p_try_in_at,
      delivered_to_patient_at = p_delivered_to_patient_at,
      shade = v_shade,
      anatomical_scope = p_anatomical_scope,
      selected_teeth = v_selected_teeth,
      comment = v_comment,
      updated_by = v_actor
  WHERE tenant_id = p_tenant_id AND id = p_order_id
  RETURNING * INTO v_result;

  DELETE FROM public.laboratory_work_order_types
  WHERE tenant_id = p_tenant_id
    AND laboratory_work_order_id = p_order_id
    AND NOT (laboratory_work_type_id = ANY(v_work_type_ids));

  INSERT INTO public.laboratory_work_order_types (
    tenant_id, laboratory_work_order_id, laboratory_work_type_id
  )
  SELECT p_tenant_id, p_order_id, work_type_id
  FROM unnest(v_work_type_ids) AS requested(work_type_id)
  ON CONFLICT DO NOTHING;

  PERFORM public.record_audit_event_internal(
    p_tenant_id => p_tenant_id,
    p_action => 'laboratory_order.updated',
    p_category => 'laboratory',
    p_target_type => 'laboratory_work_order',
    p_target_id => p_order_id::text,
    p_actor_user_id => v_actor,
    p_actor_tenant_role => v_actor_role,
    p_patient_id => v_before.patient_id,
    p_before_data => jsonb_build_object(
      'status', v_before.status,
      'responsible_doctor_id', v_before.responsible_doctor_id,
      'laboratory_id', v_before.laboratory_id,
      'planned_ready_at', v_before.planned_ready_at,
      'work_type_ids', to_jsonb(v_current_type_ids)
    ),
    p_after_data => jsonb_build_object(
      'status', v_result.status,
      'responsible_doctor_id', v_result.responsible_doctor_id,
      'laboratory_id', v_result.laboratory_id,
      'planned_ready_at', v_result.planned_ready_at,
      'work_type_ids', to_jsonb(v_work_type_ids)
    ),
    p_redaction_level => 'restricted',
    p_request_id => NULLIF(btrim(p_request_id), ''),
    p_metadata => jsonb_build_object(
      'work_type_count_before', cardinality(v_current_type_ids),
      'work_type_count_after', cardinality(v_work_type_ids)
    )
  );

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_laboratory_work_order_atomic(
  p_tenant_id uuid,
  p_order_id uuid,
  p_expected_version bigint,
  p_request_id text DEFAULT NULL
) RETURNS public.laboratory_work_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_before public.laboratory_work_orders%ROWTYPE;
  v_result public.laboratory_work_orders%ROWTYPE;
  v_work_type_ids uuid[];
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'LAB_ORDER_ACCESS_DENIED';
  END IF;

  SELECT tu.role::text INTO v_actor_role
  FROM public.tenant_users tu
  WHERE tu.tenant_id = p_tenant_id AND tu.user_id = v_actor;
  IF v_actor_role IS NULL OR v_actor_role NOT IN ('clinic_owner', 'clinic_admin', 'doctor', 'registrar') THEN
    RAISE EXCEPTION 'LAB_ORDER_ACCESS_DENIED';
  END IF;

  SELECT * INTO v_before
  FROM public.laboratory_work_orders
  WHERE tenant_id = p_tenant_id AND id = p_order_id
  FOR UPDATE;

  IF v_before.id IS NULL THEN
    RAISE EXCEPTION 'LAB_ORDER_NOT_FOUND';
  END IF;
  IF v_before.status <> 'in_progress' THEN
    RAISE EXCEPTION 'LAB_ORDER_COMPLETE_REQUIRES_IN_PROGRESS';
  END IF;
  IF p_expected_version IS NULL OR v_before.mutation_version <> p_expected_version THEN
    RAISE EXCEPTION 'LAB_ORDER_STALE_WRITE';
  END IF;

  SELECT COALESCE(array_agg(laboratory_work_type_id ORDER BY laboratory_work_type_id), '{}'::uuid[])
    INTO v_work_type_ids
  FROM public.laboratory_work_order_types
  WHERE tenant_id = p_tenant_id AND laboratory_work_order_id = p_order_id;

  UPDATE public.laboratory_work_orders
  SET status = 'completed', updated_by = v_actor
  WHERE tenant_id = p_tenant_id AND id = p_order_id
  RETURNING * INTO v_result;

  PERFORM public.record_audit_event_internal(
    p_tenant_id => p_tenant_id,
    p_action => 'laboratory_order.completed',
    p_category => 'laboratory',
    p_target_type => 'laboratory_work_order',
    p_target_id => p_order_id::text,
    p_actor_user_id => v_actor,
    p_actor_tenant_role => v_actor_role,
    p_patient_id => v_before.patient_id,
    p_before_data => jsonb_build_object('status', v_before.status),
    p_after_data => jsonb_build_object('status', v_result.status),
    p_redaction_level => 'restricted',
    p_request_id => NULLIF(btrim(p_request_id), ''),
    p_metadata => jsonb_build_object('work_type_count', cardinality(v_work_type_ids))
  );

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.reopen_laboratory_work_order_atomic(
  p_tenant_id uuid,
  p_order_id uuid,
  p_expected_version bigint,
  p_reason text,
  p_request_id text DEFAULT NULL
) RETURNS public.laboratory_work_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_before public.laboratory_work_orders%ROWTYPE;
  v_result public.laboratory_work_orders%ROWTYPE;
  v_reason text := btrim(COALESCE(p_reason, ''));
  v_work_type_ids uuid[];
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'LAB_ORDER_ACCESS_DENIED';
  END IF;

  SELECT tu.role::text INTO v_actor_role
  FROM public.tenant_users tu
  WHERE tu.tenant_id = p_tenant_id AND tu.user_id = v_actor;
  IF v_actor_role IS NULL OR v_actor_role NOT IN ('clinic_owner', 'clinic_admin') THEN
    RAISE EXCEPTION 'LAB_ORDER_REOPEN_ACCESS_DENIED';
  END IF;
  IF length(v_reason) = 0 THEN
    RAISE EXCEPTION 'LAB_ORDER_REOPEN_REASON_REQUIRED';
  END IF;

  SELECT * INTO v_before
  FROM public.laboratory_work_orders
  WHERE tenant_id = p_tenant_id AND id = p_order_id
  FOR UPDATE;

  IF v_before.id IS NULL THEN
    RAISE EXCEPTION 'LAB_ORDER_NOT_FOUND';
  END IF;
  IF v_before.status <> 'completed' THEN
    RAISE EXCEPTION 'LAB_ORDER_REOPEN_REQUIRES_COMPLETED';
  END IF;
  IF p_expected_version IS NULL OR v_before.mutation_version <> p_expected_version THEN
    RAISE EXCEPTION 'LAB_ORDER_STALE_WRITE';
  END IF;

  SELECT COALESCE(array_agg(laboratory_work_type_id ORDER BY laboratory_work_type_id), '{}'::uuid[])
    INTO v_work_type_ids
  FROM public.laboratory_work_order_types
  WHERE tenant_id = p_tenant_id AND laboratory_work_order_id = p_order_id;

  UPDATE public.laboratory_work_orders
  SET status = 'in_progress', updated_by = v_actor
  WHERE tenant_id = p_tenant_id AND id = p_order_id
  RETURNING * INTO v_result;

  PERFORM public.record_audit_event_internal(
    p_tenant_id => p_tenant_id,
    p_action => 'laboratory_order.reopened',
    p_category => 'laboratory',
    p_target_type => 'laboratory_work_order',
    p_target_id => p_order_id::text,
    p_actor_user_id => v_actor,
    p_actor_tenant_role => v_actor_role,
    p_patient_id => v_before.patient_id,
    p_before_data => jsonb_build_object('status', v_before.status),
    p_after_data => jsonb_build_object('status', v_result.status),
    p_redaction_level => 'restricted',
    p_reason => v_reason,
    p_request_id => NULLIF(btrim(p_request_id), ''),
    p_metadata => jsonb_build_object('work_type_count', cardinality(v_work_type_ids))
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.create_laboratory_work_order_atomic(
  uuid, uuid, uuid, text, uuid[], uuid, uuid, text,
  timestamptz, timestamptz, timestamptz, timestamptz, timestamptz,
  text, text, integer[], text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_laboratory_work_order_atomic(
  uuid, uuid, uuid, text, uuid[], uuid, uuid, text,
  timestamptz, timestamptz, timestamptz, timestamptz, timestamptz,
  text, text, integer[], text, text
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.update_laboratory_work_order_atomic(
  uuid, uuid, bigint, text, uuid[], uuid, uuid, text,
  timestamptz, timestamptz, timestamptz, timestamptz, timestamptz,
  text, text, integer[], text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_laboratory_work_order_atomic(
  uuid, uuid, bigint, text, uuid[], uuid, uuid, text,
  timestamptz, timestamptz, timestamptz, timestamptz, timestamptz,
  text, text, integer[], text, text
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.complete_laboratory_work_order_atomic(uuid, uuid, bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_laboratory_work_order_atomic(uuid, uuid, bigint, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.reopen_laboratory_work_order_atomic(uuid, uuid, bigint, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reopen_laboratory_work_order_atomic(uuid, uuid, bigint, text, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.create_laboratory_work_order_atomic(
  uuid, uuid, uuid, text, uuid[], uuid, uuid, text,
  timestamptz, timestamptz, timestamptz, timestamptz, timestamptz,
  text, text, integer[], text, text
) IS 'Atomic tenant-scoped laboratory work-order creation with stable caller order UUID, complete desired work-type set, and same-transaction audit.';

COMMENT ON FUNCTION public.update_laboratory_work_order_atomic(
  uuid, uuid, bigint, text, uuid[], uuid, uuid, text,
  timestamptz, timestamptz, timestamptz, timestamptz, timestamptz,
  text, text, integer[], text, text
) IS 'Atomic in-progress laboratory work-order edit with stale-write protection and complete desired work-type replacement.';

COMMENT ON FUNCTION public.complete_laboratory_work_order_atomic(uuid, uuid, bigint, text)
IS 'Atomic in_progress to completed laboratory work-order transition with stale-write protection and audit.';

COMMENT ON FUNCTION public.reopen_laboratory_work_order_atomic(uuid, uuid, bigint, text, text)
IS 'Atomic owner/admin-only completed to in_progress transition requiring an explicit audit reason.';
