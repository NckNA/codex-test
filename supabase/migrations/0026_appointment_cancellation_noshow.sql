-- 0026_appointment_cancellation_noshow.sql
-- APPOINTMENT-CANCELLATION-NOSHOW-001
-- Auditable, idempotent and tenant-safe cancellation/no-show lifecycle boundary.

DO $$
DECLARE
  v_cancelled bigint;
  v_no_show bigint;
BEGIN
  SELECT count(*) INTO v_cancelled FROM public.appointments WHERE status = 'cancelled';
  SELECT count(*) INTO v_no_show FROM public.appointments WHERE status = 'no_show';

  -- Existing terminal rows are preserved as legacy version 0.  No actor, reason
  -- or timestamp is fabricated.  New controlled lifecycle actions use version 1.
  RAISE NOTICE 'APPOINTMENT-CANCELLATION-NOSHOW-001 legacy rows: cancelled=%, no_show=%',
    v_cancelled, v_no_show;
END;
$$;

ALTER TABLE public.appointments
  ADD COLUMN cancelled_at timestamptz,
  ADD COLUMN cancelled_by uuid,
  ADD COLUMN cancellation_source text,
  ADD COLUMN cancellation_reason text,
  ADD COLUMN no_show_at timestamptz,
  ADD COLUMN no_show_by uuid,
  ADD COLUMN no_show_reason text,
  ADD COLUMN lifecycle_metadata_version integer NOT NULL DEFAULT 0;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_cancelled_by_fk
    FOREIGN KEY (cancelled_by) REFERENCES public.profiles(id) ON DELETE RESTRICT,
  ADD CONSTRAINT appointments_no_show_by_fk
    FOREIGN KEY (no_show_by) REFERENCES public.profiles(id) ON DELETE RESTRICT,
  ADD CONSTRAINT appointments_lifecycle_metadata_version_check
    CHECK (lifecycle_metadata_version IN (0, 1)),
  ADD CONSTRAINT appointments_cancellation_source_check
    CHECK (
      cancellation_source IS NULL
      OR cancellation_source IN ('patient', 'clinic', 'doctor', 'technical', 'other')
    ),
  ADD CONSTRAINT appointments_lifecycle_metadata_check
    CHECK (
      (
        status = 'cancelled'
        AND no_show_at IS NULL
        AND no_show_by IS NULL
        AND no_show_reason IS NULL
        AND (
          (
            lifecycle_metadata_version = 0
            AND cancelled_at IS NULL
            AND cancelled_by IS NULL
            AND cancellation_source IS NULL
            AND cancellation_reason IS NULL
          )
          OR
          (
            lifecycle_metadata_version = 1
            AND cancelled_at IS NOT NULL
            AND cancelled_by IS NOT NULL
            AND cancellation_source IS NOT NULL
            AND cancellation_reason IS NOT NULL
            AND length(btrim(cancellation_reason)) > 0
          )
        )
      )
      OR
      (
        status = 'no_show'
        AND cancelled_at IS NULL
        AND cancelled_by IS NULL
        AND cancellation_source IS NULL
        AND cancellation_reason IS NULL
        AND (
          (
            lifecycle_metadata_version = 0
            AND no_show_at IS NULL
            AND no_show_by IS NULL
            AND no_show_reason IS NULL
          )
          OR
          (
            lifecycle_metadata_version = 1
            AND no_show_at IS NOT NULL
            AND no_show_by IS NOT NULL
            AND no_show_reason IS NOT NULL
            AND length(btrim(no_show_reason)) > 0
          )
        )
      )
      OR
      (
        status NOT IN ('cancelled', 'no_show')
        AND lifecycle_metadata_version = 0
        AND cancelled_at IS NULL
        AND cancelled_by IS NULL
        AND cancellation_source IS NULL
        AND cancellation_reason IS NULL
        AND no_show_at IS NULL
        AND no_show_by IS NULL
        AND no_show_reason IS NULL
      )
    );

ALTER TABLE public.appointment_operations
  DROP CONSTRAINT appointment_operations_operation_type_check;

ALTER TABLE public.appointment_operations
  ADD CONSTRAINT appointment_operations_operation_type_check
  CHECK (operation_type IN ('create', 'reschedule', 'cancel', 'no_show'));

CREATE OR REPLACE FUNCTION public.guard_appointment_lifecycle_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $lifecycle_guard$
DECLARE
  v_action text := current_setting('app.appointment_lifecycle_action', true);
BEGIN
  -- service_role remains available for local setup/cleanup and explicit imports.
  -- Ordinary authenticated writes are already blocked by the authoritative-write
  -- trigger.  This second guard also prevents SECURITY DEFINER create/reschedule/
  -- details RPCs from manufacturing cancellation or no-show state.
  IF current_user = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'cancelled' AND v_action IS DISTINCT FROM 'cancel' THEN
      RAISE EXCEPTION 'Текущий статус записи не позволяет выполнить это действие.';
    END IF;
    IF NEW.status = 'no_show' AND v_action IS DISTINCT FROM 'no_show' THEN
      RAISE EXCEPTION 'Текущий статус записи не позволяет выполнить это действие.';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status IN ('cancelled', 'no_show') OR NEW.status IN ('cancelled', 'no_show') THEN
    IF v_action = 'cancel'
       AND OLD.status IN ('new', 'confirmed')
       AND NEW.status = 'cancelled' THEN
      RETURN NEW;
    END IF;

    IF v_action = 'no_show'
       AND OLD.status IN ('new', 'confirmed')
       AND NEW.status = 'no_show' THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Текущий статус записи не позволяет выполнить это действие.';
  END IF;

  RETURN NEW;
END;
$lifecycle_guard$;

DROP TRIGGER IF EXISTS appointments_lifecycle_write_guard ON public.appointments;
CREATE TRIGGER appointments_lifecycle_write_guard
BEFORE INSERT OR UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.guard_appointment_lifecycle_write();

CREATE OR REPLACE FUNCTION public.cancel_appointment(
  p_tenant_id uuid,
  p_appointment_id uuid,
  p_cancellation_source text,
  p_cancellation_reason text,
  p_expected_updated_at timestamptz,
  p_operation_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET timezone = 'UTC'
AS $cancel_rpc$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_key text;
  v_source text := NULLIF(btrim(p_cancellation_source), '');
  v_reason text := NULLIF(btrim(p_cancellation_reason), '');
  v_fingerprint text;
  v_operation public.appointment_operations%ROWTYPE;
  v_before public.appointments%ROWTYPE;
  v_after public.appointments%ROWTYPE;
  v_lock_key text;
  v_audit_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Недостаточно прав для изменения записи.';
  END IF;

  SELECT tu.role::text INTO v_actor_role
  FROM public.tenant_users tu
  WHERE tu.tenant_id = p_tenant_id
    AND tu.user_id = v_actor;

  IF v_actor_role IS NULL OR v_actor_role NOT IN ('clinic_owner', 'clinic_admin', 'registrar') THEN
    RAISE EXCEPTION 'Недостаточно прав для изменения записи.';
  END IF;

  IF v_source IS NULL THEN
    RAISE EXCEPTION 'Укажите, кто отменил запись.';
  END IF;
  IF v_source NOT IN ('patient', 'clinic', 'doctor', 'technical', 'other') THEN
    RAISE EXCEPTION 'Укажите, кто отменил запись.';
  END IF;
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Укажите причину.';
  END IF;
  IF p_expected_updated_at IS NULL THEN
    RAISE EXCEPTION 'Запись была изменена другим пользователем. Обновите расписание.';
  END IF;

  v_key := public.normalize_appointment_operation_key(p_operation_key);
  v_fingerprint := encode(extensions.digest(jsonb_build_object(
    'operationType', 'cancel',
    'tenantId', p_tenant_id,
    'appointmentId', p_appointment_id,
    'expectedUpdatedEpoch', extract(epoch FROM p_expected_updated_at),
    'cancellationSource', v_source,
    'cancellationReason', v_reason
  )::text, 'sha256'), 'hex');

  PERFORM pg_advisory_xact_lock(
    hashtextextended('appointment-operation:' || p_tenant_id::text || ':' || v_key, 0)
  );

  SELECT * INTO v_operation
  FROM public.appointment_operations ao
  WHERE ao.tenant_id = p_tenant_id
    AND ao.operation_key = v_key;

  IF FOUND THEN
    IF v_operation.operation_type <> 'cancel' OR v_operation.fingerprint <> v_fingerprint THEN
      RAISE EXCEPTION 'Эта операция уже была выполнена с другими параметрами.';
    END IF;
    RETURN jsonb_build_object(
      'appointment', v_operation.result_appointment,
      'replayed', true,
      'recovered', false,
      'operationType', 'cancel'
    );
  END IF;

  SELECT * INTO v_before
  FROM public.appointments a
  WHERE a.id = p_appointment_id
    AND a.tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Недостаточно прав для изменения записи.';
  END IF;

  IF v_before.status = 'cancelled' THEN
    RAISE EXCEPTION 'Запись уже отменена.';
  END IF;
  IF v_before.status NOT IN ('new', 'confirmed') THEN
    RAISE EXCEPTION 'Текущий статус записи не позволяет выполнить это действие.';
  END IF;
  IF v_before.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Запись была изменена другим пользователем. Обновите расписание.';
  END IF;

  FOR v_lock_key IN
    SELECT resource_key
    FROM (
      VALUES
        ('appointment-resource:' || p_tenant_id::text || ':doctor:' || v_before.doctor_id::text),
        (CASE WHEN v_before.patient_id IS NOT NULL
          THEN 'appointment-resource:' || p_tenant_id::text || ':patient:' || v_before.patient_id::text END)
    ) AS resources(resource_key)
    WHERE resource_key IS NOT NULL
    ORDER BY resource_key
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));
  END LOOP;

  PERFORM set_config('app.appointment_lifecycle_action', 'cancel', true);

  UPDATE public.appointments
  SET status = 'cancelled',
      cancelled_at = transaction_timestamp(),
      cancelled_by = v_actor,
      cancellation_source = v_source,
      cancellation_reason = v_reason,
      no_show_at = NULL,
      no_show_by = NULL,
      no_show_reason = NULL,
      lifecycle_metadata_version = 1
  WHERE id = p_appointment_id
    AND tenant_id = p_tenant_id
  RETURNING * INTO v_after;

  PERFORM set_config('app.appointment_lifecycle_action', '', true);

  v_audit_id := public.record_audit_event_internal(
    p_tenant_id => p_tenant_id,
    p_action => 'appointment_cancelled',
    p_category => 'appointment',
    p_target_type => 'appointment',
    p_target_id => p_appointment_id::text,
    p_actor_user_id => v_actor,
    p_actor_tenant_role => v_actor_role,
    p_patient_id => v_before.patient_id,
    p_appointment_id => p_appointment_id::text,
    p_before_data => jsonb_build_object(
      'status', v_before.status,
      'updatedAt', v_before.updated_at
    ),
    p_after_data => jsonb_build_object(
      'status', v_after.status,
      'cancelledAt', v_after.cancelled_at,
      'cancelledBy', v_after.cancelled_by,
      'cancellationSource', v_after.cancellation_source,
      'cancellationReason', v_after.cancellation_reason
    ),
    p_request_id => v_key,
    p_metadata => jsonb_build_object('operationKey', v_key, 'replayed', false)
  );

  PERFORM public.record_activity_event_internal(
    p_tenant_id => p_tenant_id,
    p_category => 'appointment',
    p_type => 'appointment_cancelled',
    p_title => 'Запись отменена',
    p_source_type => 'appointment',
    p_source_id => p_appointment_id::text,
    p_patient_id => v_before.patient_id,
    p_audit_event_id => v_audit_id,
    p_actor_user_id => v_actor,
    p_source_status => 'cancelled',
    p_visibility => 'admin',
    p_metadata => jsonb_build_object(
      'appointmentId', p_appointment_id,
      'cancellationSource', v_source,
      'cancellationReason', v_reason,
      'operationKey', v_key,
      'replayed', false
    )
  );

  INSERT INTO public.appointment_operations (
    tenant_id, operation_key, operation_type, fingerprint, appointment_id,
    patient_id, doctor_id, start_time, end_time, status,
    result_appointment, actor_user_id
  ) VALUES (
    p_tenant_id, v_key, 'cancel', v_fingerprint, p_appointment_id,
    v_before.patient_id, v_before.doctor_id, v_before.start_time, v_before.end_time, 'cancelled',
    public.appointment_row_json(v_after), v_actor
  );

  RETURN jsonb_build_object(
    'appointment', public.appointment_row_json(v_after),
    'replayed', false,
    'recovered', false,
    'operationType', 'cancel'
  );
END;
$cancel_rpc$;

CREATE OR REPLACE FUNCTION public.mark_appointment_no_show(
  p_tenant_id uuid,
  p_appointment_id uuid,
  p_no_show_reason text,
  p_expected_updated_at timestamptz,
  p_operation_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET timezone = 'UTC'
AS $no_show_rpc$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_key text;
  v_reason text := NULLIF(btrim(p_no_show_reason), '');
  v_fingerprint text;
  v_operation public.appointment_operations%ROWTYPE;
  v_before public.appointments%ROWTYPE;
  v_after public.appointments%ROWTYPE;
  v_lock_key text;
  v_audit_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Недостаточно прав для изменения записи.';
  END IF;

  SELECT tu.role::text INTO v_actor_role
  FROM public.tenant_users tu
  WHERE tu.tenant_id = p_tenant_id
    AND tu.user_id = v_actor;

  IF v_actor_role IS NULL OR v_actor_role NOT IN ('clinic_owner', 'clinic_admin', 'registrar') THEN
    RAISE EXCEPTION 'Недостаточно прав для изменения записи.';
  END IF;

  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Укажите причину.';
  END IF;
  IF p_expected_updated_at IS NULL THEN
    RAISE EXCEPTION 'Запись была изменена другим пользователем. Обновите расписание.';
  END IF;

  v_key := public.normalize_appointment_operation_key(p_operation_key);
  v_fingerprint := encode(extensions.digest(jsonb_build_object(
    'operationType', 'no_show',
    'tenantId', p_tenant_id,
    'appointmentId', p_appointment_id,
    'expectedUpdatedEpoch', extract(epoch FROM p_expected_updated_at),
    'noShowReason', v_reason
  )::text, 'sha256'), 'hex');

  PERFORM pg_advisory_xact_lock(
    hashtextextended('appointment-operation:' || p_tenant_id::text || ':' || v_key, 0)
  );

  SELECT * INTO v_operation
  FROM public.appointment_operations ao
  WHERE ao.tenant_id = p_tenant_id
    AND ao.operation_key = v_key;

  IF FOUND THEN
    IF v_operation.operation_type <> 'no_show' OR v_operation.fingerprint <> v_fingerprint THEN
      RAISE EXCEPTION 'Эта операция уже была выполнена с другими параметрами.';
    END IF;
    RETURN jsonb_build_object(
      'appointment', v_operation.result_appointment,
      'replayed', true,
      'recovered', false,
      'operationType', 'no_show'
    );
  END IF;

  SELECT * INTO v_before
  FROM public.appointments a
  WHERE a.id = p_appointment_id
    AND a.tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Недостаточно прав для изменения записи.';
  END IF;

  IF v_before.status = 'no_show' THEN
    RAISE EXCEPTION 'Неявка уже отмечена.';
  END IF;
  IF v_before.status NOT IN ('new', 'confirmed') THEN
    RAISE EXCEPTION 'Текущий статус записи не позволяет выполнить это действие.';
  END IF;
  IF v_before.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Запись была изменена другим пользователем. Обновите расписание.';
  END IF;

  FOR v_lock_key IN
    SELECT resource_key
    FROM (
      VALUES
        ('appointment-resource:' || p_tenant_id::text || ':doctor:' || v_before.doctor_id::text),
        (CASE WHEN v_before.patient_id IS NOT NULL
          THEN 'appointment-resource:' || p_tenant_id::text || ':patient:' || v_before.patient_id::text END)
    ) AS resources(resource_key)
    WHERE resource_key IS NOT NULL
    ORDER BY resource_key
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));
  END LOOP;

  PERFORM set_config('app.appointment_lifecycle_action', 'no_show', true);

  UPDATE public.appointments
  SET status = 'no_show',
      no_show_at = transaction_timestamp(),
      no_show_by = v_actor,
      no_show_reason = v_reason,
      cancelled_at = NULL,
      cancelled_by = NULL,
      cancellation_source = NULL,
      cancellation_reason = NULL,
      lifecycle_metadata_version = 1
  WHERE id = p_appointment_id
    AND tenant_id = p_tenant_id
  RETURNING * INTO v_after;

  PERFORM set_config('app.appointment_lifecycle_action', '', true);

  v_audit_id := public.record_audit_event_internal(
    p_tenant_id => p_tenant_id,
    p_action => 'appointment_no_show_marked',
    p_category => 'appointment',
    p_target_type => 'appointment',
    p_target_id => p_appointment_id::text,
    p_actor_user_id => v_actor,
    p_actor_tenant_role => v_actor_role,
    p_patient_id => v_before.patient_id,
    p_appointment_id => p_appointment_id::text,
    p_before_data => jsonb_build_object(
      'status', v_before.status,
      'updatedAt', v_before.updated_at
    ),
    p_after_data => jsonb_build_object(
      'status', v_after.status,
      'noShowAt', v_after.no_show_at,
      'noShowBy', v_after.no_show_by,
      'noShowReason', v_after.no_show_reason
    ),
    p_request_id => v_key,
    p_metadata => jsonb_build_object('operationKey', v_key, 'replayed', false)
  );

  PERFORM public.record_activity_event_internal(
    p_tenant_id => p_tenant_id,
    p_category => 'appointment',
    p_type => 'appointment_no_show_marked',
    p_title => 'Отмечена неявка',
    p_source_type => 'appointment',
    p_source_id => p_appointment_id::text,
    p_patient_id => v_before.patient_id,
    p_audit_event_id => v_audit_id,
    p_actor_user_id => v_actor,
    p_source_status => 'no_show',
    p_visibility => 'admin',
    p_metadata => jsonb_build_object(
      'appointmentId', p_appointment_id,
      'noShowReason', v_reason,
      'operationKey', v_key,
      'replayed', false
    )
  );

  INSERT INTO public.appointment_operations (
    tenant_id, operation_key, operation_type, fingerprint, appointment_id,
    patient_id, doctor_id, start_time, end_time, status,
    result_appointment, actor_user_id
  ) VALUES (
    p_tenant_id, v_key, 'no_show', v_fingerprint, p_appointment_id,
    v_before.patient_id, v_before.doctor_id, v_before.start_time, v_before.end_time, 'no_show',
    public.appointment_row_json(v_after), v_actor
  );

  RETURN jsonb_build_object(
    'appointment', public.appointment_row_json(v_after),
    'replayed', false,
    'recovered', false,
    'operationType', 'no_show'
  );
END;
$no_show_rpc$;

-- Replace the generic details RPC so lifecycle terminal states fail before
-- unrelated slot-conflict checks.  This preserves the 0025 contract for all
-- non-terminal details while making cancellation/no-show dedicated actions.
CREATE OR REPLACE FUNCTION public.update_appointment_details(
  p_tenant_id uuid,
  p_appointment_id uuid,
  p_cabinet text,
  p_service text,
  p_status text,
  p_payment_type text,
  p_source text,
  p_price numeric,
  p_comment text,
  p_expected_updated_at timestamptz
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET timezone = 'UTC'
AS $details_rpc$
DECLARE
  v_actor uuid := auth.uid();
  v_status text := COALESCE(NULLIF(btrim(p_status), ''), 'new');
  v_cabinet text := COALESCE(btrim(p_cabinet), '');
  v_service text := COALESCE(btrim(p_service), '');
  v_comment text := NULLIF(btrim(p_comment), '');
  v_payment_type text := NULLIF(btrim(p_payment_type), '');
  v_source text := NULLIF(btrim(p_source), '');
  v_before public.appointments%ROWTYPE;
  v_after public.appointments%ROWTYPE;
  v_lock_key text;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.tenant_users tu
    WHERE tu.tenant_id = p_tenant_id AND tu.user_id = v_actor
  ) THEN
    RAISE EXCEPTION 'Недостаточно прав для изменения записи.';
  END IF;

  IF v_status NOT IN ('new', 'confirmed', 'arrived', 'in_progress', 'completed', 'blocked') THEN
    RAISE EXCEPTION 'Текущий статус записи не позволяет выполнить это действие.';
  END IF;

  IF v_payment_type IS NOT NULL AND v_payment_type NOT IN ('cash', 'card', 'kaspi', 'insurance', 'installment', 'unpaid') THEN
    RAISE EXCEPTION 'Не удалось сохранить запись. Обновите расписание и проверьте результат.';
  END IF;

  IF v_source IS NOT NULL AND v_source NOT IN ('phone', 'whatsapp', 'instagram', 'walk_in', 'repeat', 'referral') THEN
    RAISE EXCEPTION 'Не удалось сохранить запись. Обновите расписание и проверьте результат.';
  END IF;

  SELECT * INTO v_before
  FROM public.appointments a
  WHERE a.id = p_appointment_id
    AND a.tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Недостаточно прав для изменения записи.';
  END IF;

  IF v_before.status IN ('cancelled', 'no_show') THEN
    RAISE EXCEPTION 'Текущий статус записи не позволяет выполнить это действие.';
  END IF;

  IF p_expected_updated_at IS NULL OR v_before.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Запись была изменена другим пользователем. Обновите расписание.';
  END IF;

  IF v_before.patient_id IS NULL AND v_status <> 'blocked' THEN
    RAISE EXCEPTION 'Пациент недоступен в этой клинике.';
  END IF;

  FOR v_lock_key IN
    SELECT resource_key
    FROM (
      VALUES
        ('appointment-resource:' || p_tenant_id::text || ':doctor:' || v_before.doctor_id::text),
        (CASE WHEN v_before.patient_id IS NOT NULL THEN 'appointment-resource:' || p_tenant_id::text || ':patient:' || v_before.patient_id::text END)
    ) AS resources(resource_key)
    WHERE resource_key IS NOT NULL
    ORDER BY resource_key
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.tenant_id = p_tenant_id
      AND a.id <> p_appointment_id
      AND a.doctor_id = v_before.doctor_id
      AND a.status <> 'cancelled'
      AND a.start_time < v_before.end_time
      AND a.end_time > v_before.start_time
  ) THEN
    RAISE EXCEPTION 'У врача уже есть запись на это время.';
  END IF;

  IF v_before.patient_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.tenant_id = p_tenant_id
      AND a.id <> p_appointment_id
      AND a.patient_id = v_before.patient_id
      AND a.status <> 'cancelled'
      AND a.start_time < v_before.end_time
      AND a.end_time > v_before.start_time
  ) THEN
    RAISE EXCEPTION 'У пациента уже есть другая запись на это время.';
  END IF;

  UPDATE public.appointments
  SET cabinet = v_cabinet,
      service = v_service,
      status = v_status,
      payment_type = v_payment_type,
      source = v_source,
      price = p_price,
      comment = v_comment
  WHERE id = p_appointment_id
    AND tenant_id = p_tenant_id
  RETURNING * INTO v_after;

  RETURN jsonb_build_object(
    'appointment', public.appointment_row_json(v_after),
    'replayed', false,
    'recovered', false,
    'operationType', 'details'
  );
END;
$details_rpc$;

REVOKE ALL ON FUNCTION public.guard_appointment_lifecycle_write() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_appointment(uuid,uuid,text,text,timestamptz,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_appointment_no_show(uuid,uuid,text,timestamptz,text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.cancel_appointment(uuid,uuid,text,text,timestamptz,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_appointment_no_show(uuid,uuid,text,timestamptz,text) TO authenticated, service_role;
