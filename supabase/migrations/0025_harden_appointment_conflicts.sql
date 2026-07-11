-- 0025_harden_appointment_conflicts.sql
-- APPOINTMENT-CONFLICT-HARDENING-001
-- Authoritative conflict-safe appointment write boundary.

-- Historical precheck.  Existing incompatible rows are never silently changed.
DO $$
DECLARE
  v_count bigint;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.appointments
  WHERE end_time <= start_time;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'APPOINTMENT-CONFLICT-HARDENING-001: % appointment rows have invalid intervals', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.appointments
  WHERE doctor_id IS NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'APPOINTMENT-CONFLICT-HARDENING-001: % appointment rows have no doctor', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.appointments
  WHERE patient_id IS NULL
    AND status <> 'blocked';
  IF v_count > 0 THEN
    RAISE EXCEPTION 'APPOINTMENT-CONFLICT-HARDENING-001: % non-blocked appointment rows have no patient', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.appointments a
  WHERE a.patient_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.patients p
      WHERE p.id = a.patient_id
        AND p.tenant_id = a.tenant_id
    );
  IF v_count > 0 THEN
    RAISE EXCEPTION 'APPOINTMENT-CONFLICT-HARDENING-001: % appointment rows have cross-tenant or missing patients', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.appointments a
  WHERE a.doctor_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.doctors d
      WHERE d.id = a.doctor_id
        AND d.tenant_id = a.tenant_id
    );
  IF v_count > 0 THEN
    RAISE EXCEPTION 'APPOINTMENT-CONFLICT-HARDENING-001: % appointment rows have cross-tenant or missing doctors', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM (
    SELECT tenant_id, patient_id, doctor_id, start_time, end_time, count(*)
    FROM public.appointments
    WHERE status <> 'cancelled'
    GROUP BY tenant_id, patient_id, doctor_id, start_time, end_time
    HAVING count(*) > 1
  ) duplicate_groups;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'APPOINTMENT-CONFLICT-HARDENING-001: % duplicate active appointment groups exist', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.appointments a
  JOIN public.appointments b
    ON b.tenant_id = a.tenant_id
   AND b.id > a.id
   AND b.doctor_id = a.doctor_id
   AND b.status <> 'cancelled'
   AND a.status <> 'cancelled'
   AND b.start_time < a.end_time
   AND b.end_time > a.start_time;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'APPOINTMENT-CONFLICT-HARDENING-001: % active doctor overlap pairs exist', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.appointments a
  JOIN public.appointments b
    ON b.tenant_id = a.tenant_id
   AND b.id > a.id
   AND b.patient_id = a.patient_id
   AND a.patient_id IS NOT NULL
   AND b.status <> 'cancelled'
   AND a.status <> 'cancelled'
   AND b.start_time < a.end_time
   AND b.end_time > a.start_time;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'APPOINTMENT-CONFLICT-HARDENING-001: % active patient overlap pairs exist', v_count;
  END IF;
END;
$$;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_valid_interval_check
  CHECK (end_time > start_time);

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_doctor_required_check
  CHECK (doctor_id IS NOT NULL);

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_patient_required_unless_blocked_check
  CHECK (patient_id IS NOT NULL OR status = 'blocked');

CREATE INDEX idx_appointments_active_doctor_interval
  ON public.appointments (tenant_id, doctor_id, start_time, end_time)
  WHERE status <> 'cancelled';

CREATE INDEX idx_appointments_active_patient_interval
  ON public.appointments (tenant_id, patient_id, start_time, end_time)
  WHERE status <> 'cancelled' AND patient_id IS NOT NULL;

CREATE TABLE public.appointment_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  operation_key text NOT NULL,
  operation_type text NOT NULL CHECK (operation_type IN ('create', 'reschedule')),
  fingerprint text NOT NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  patient_id uuid,
  doctor_id uuid NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  status text NOT NULL,
  result_appointment jsonb NOT NULL,
  actor_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appointment_operations_key_check CHECK (
    length(operation_key) BETWEEN 8 AND 160
    AND operation_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
  ),
  CONSTRAINT appointment_operations_fingerprint_check CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT appointment_operations_interval_check CHECK (end_time > start_time),
  CONSTRAINT appointment_operations_result_object_check CHECK (jsonb_typeof(result_appointment) = 'object'),
  CONSTRAINT appointment_operations_tenant_key_key UNIQUE (tenant_id, operation_key),
  CONSTRAINT appointment_operations_patient_fk
    FOREIGN KEY (tenant_id, patient_id)
    REFERENCES public.patients(tenant_id, id)
    ON DELETE CASCADE,
  CONSTRAINT appointment_operations_doctor_fk
    FOREIGN KEY (tenant_id, doctor_id)
    REFERENCES public.doctors(tenant_id, id)
    ON DELETE CASCADE
);

CREATE INDEX idx_appointment_operations_appointment
  ON public.appointment_operations (tenant_id, appointment_id, created_at DESC);

ALTER TABLE public.appointment_operations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.appointment_operations FROM PUBLIC;
REVOKE ALL ON TABLE public.appointment_operations FROM anon;
REVOKE ALL ON TABLE public.appointment_operations FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.appointment_operations TO service_role;

CREATE OR REPLACE FUNCTION public.set_appointment_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS appointments_set_updated_at ON public.appointments;
CREATE TRIGGER appointments_set_updated_at
BEFORE UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.set_appointment_updated_at();

CREATE OR REPLACE FUNCTION public.guard_appointment_authoritative_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $guard$
BEGIN
  -- RPC functions are SECURITY DEFINER and therefore execute as postgres.
  -- service_role remains available for guarded local setup/cleanup. Ordinary
  -- authenticated PostgREST INSERT/UPDATE retains the legacy grant matrix but
  -- cannot cross this mutation boundary.
  IF current_user IN ('postgres', 'service_role') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Недостаточно прав для изменения записи.';
END;
$guard$;

DROP TRIGGER IF EXISTS appointments_authoritative_write_guard ON public.appointments;
CREATE TRIGGER appointments_authoritative_write_guard
BEFORE INSERT OR UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.guard_appointment_authoritative_write();

CREATE OR REPLACE FUNCTION public.normalize_appointment_operation_key(p_operation_key text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_key text := btrim(p_operation_key);
BEGIN
  IF v_key IS NULL
     OR length(v_key) < 8
     OR length(v_key) > 160
     OR v_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$' THEN
    RAISE EXCEPTION 'Операция с этим идентификатором уже выполнена с другими параметрами.';
  END IF;
  RETURN v_key;
END;
$$;

CREATE OR REPLACE FUNCTION public.appointment_row_json(p_appointment public.appointments)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT to_jsonb(p_appointment);
$$;

CREATE OR REPLACE FUNCTION public.create_appointment(
  p_tenant_id uuid,
  p_patient_id uuid,
  p_doctor_id uuid,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_cabinet text,
  p_service text,
  p_status text,
  p_payment_type text,
  p_source text,
  p_price numeric,
  p_comment text,
  p_operation_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET timezone = 'UTC'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_key text;
  v_status text := COALESCE(NULLIF(btrim(p_status), ''), 'new');
  v_cabinet text := COALESCE(btrim(p_cabinet), '');
  v_service text := COALESCE(btrim(p_service), '');
  v_comment text := NULLIF(btrim(p_comment), '');
  v_payment_type text := NULLIF(btrim(p_payment_type), '');
  v_source text := NULLIF(btrim(p_source), '');
  v_fingerprint text;
  v_operation public.appointment_operations%ROWTYPE;
  v_appointment public.appointments%ROWTYPE;
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
  IF v_actor_role IS NULL THEN
    RAISE EXCEPTION 'Недостаточно прав для изменения записи.';
  END IF;

  IF p_end_time IS NULL OR p_start_time IS NULL OR p_end_time <= p_start_time THEN
    RAISE EXCEPTION 'Время окончания должно быть позже времени начала.';
  END IF;

  IF v_status NOT IN ('new', 'confirmed', 'arrived', 'in_progress', 'completed', 'cancelled', 'no_show', 'blocked') THEN
    RAISE EXCEPTION 'Не удалось сохранить запись. Обновите расписание и проверьте результат.';
  END IF;

  IF v_payment_type IS NOT NULL AND v_payment_type NOT IN ('cash', 'card', 'kaspi', 'insurance', 'installment', 'unpaid') THEN
    RAISE EXCEPTION 'Не удалось сохранить запись. Обновите расписание и проверьте результат.';
  END IF;

  IF v_source IS NOT NULL AND v_source NOT IN ('phone', 'whatsapp', 'instagram', 'walk_in', 'repeat', 'referral') THEN
    RAISE EXCEPTION 'Не удалось сохранить запись. Обновите расписание и проверьте результат.';
  END IF;

  IF p_patient_id IS NULL AND v_status <> 'blocked' THEN
    RAISE EXCEPTION 'Пациент недоступен в этой клинике.';
  END IF;

  IF p_patient_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = p_patient_id AND p.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'Пациент недоступен в этой клинике.';
  END IF;

  IF p_doctor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.doctors d
    WHERE d.id = p_doctor_id AND d.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'Врач недоступен в этой клинике.';
  END IF;

  v_key := public.normalize_appointment_operation_key(p_operation_key);
  v_fingerprint := encode(extensions.digest(jsonb_build_object(
    'operationType', 'create',
    'tenantId', p_tenant_id,
    'patientId', p_patient_id,
    'doctorId', p_doctor_id,
    'cabinet', v_cabinet,
    'service', v_service,
    'status', v_status,
    'paymentType', v_payment_type,
    'source', v_source,
    'price', p_price,
    'comment', v_comment,
    'startEpoch', extract(epoch FROM p_start_time),
    'endEpoch', extract(epoch FROM p_end_time)
  )::text, 'sha256'), 'hex');

  PERFORM pg_advisory_xact_lock(hashtextextended('appointment-operation:' || p_tenant_id::text || ':' || v_key, 0));

  SELECT * INTO v_operation
  FROM public.appointment_operations ao
  WHERE ao.tenant_id = p_tenant_id
    AND ao.operation_key = v_key;

  IF FOUND THEN
    IF v_operation.operation_type <> 'create' OR v_operation.fingerprint <> v_fingerprint THEN
      RAISE EXCEPTION 'Операция с этим идентификатором уже выполнена с другими параметрами.';
    END IF;
    RETURN jsonb_build_object(
      'appointment', v_operation.result_appointment,
      'replayed', true,
      'recovered', false,
      'operationType', 'create'
    );
  END IF;

  FOR v_lock_key IN
    SELECT resource_key
    FROM (
      VALUES
        ('appointment-resource:' || p_tenant_id::text || ':doctor:' || p_doctor_id::text),
        (CASE WHEN p_patient_id IS NOT NULL THEN 'appointment-resource:' || p_tenant_id::text || ':patient:' || p_patient_id::text END)
    ) AS resources(resource_key)
    WHERE resource_key IS NOT NULL
    ORDER BY resource_key
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));
  END LOOP;

  IF v_status <> 'cancelled' THEN
    IF EXISTS (
      SELECT 1
      FROM public.appointments a
      WHERE a.tenant_id = p_tenant_id
        AND a.doctor_id = p_doctor_id
        AND a.status <> 'cancelled'
        AND a.start_time < p_end_time
        AND a.end_time > p_start_time
    ) THEN
      RAISE EXCEPTION 'У врача уже есть запись на это время.';
    END IF;

    IF p_patient_id IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.appointments a
      WHERE a.tenant_id = p_tenant_id
        AND a.patient_id = p_patient_id
        AND a.status <> 'cancelled'
        AND a.start_time < p_end_time
        AND a.end_time > p_start_time
    ) THEN
      RAISE EXCEPTION 'У пациента уже есть другая запись на это время.';
    END IF;
  END IF;

  INSERT INTO public.appointments (
    tenant_id, patient_id, doctor_id, cabinet, service, status,
    payment_type, source, price, comment, start_time, end_time
  ) VALUES (
    p_tenant_id, p_patient_id, p_doctor_id, v_cabinet, v_service, v_status,
    v_payment_type, v_source, p_price, v_comment, p_start_time, p_end_time
  )
  RETURNING * INTO v_appointment;

  v_audit_id := public.record_audit_event_internal(
    p_tenant_id => p_tenant_id,
    p_action => 'appointment_created',
    p_category => 'appointment',
    p_target_type => 'appointment',
    p_target_id => v_appointment.id::text,
    p_actor_user_id => v_actor,
    p_actor_tenant_role => v_actor_role,
    p_patient_id => p_patient_id,
    p_appointment_id => v_appointment.id::text,
    p_after_data => jsonb_build_object(
      'patientId', p_patient_id,
      'doctorId', p_doctor_id,
      'startTime', p_start_time,
      'endTime', p_end_time,
      'status', v_status
    ),
    p_request_id => v_key,
    p_metadata => jsonb_build_object('operationKey', v_key, 'replayed', false)
  );

  PERFORM public.record_activity_event_internal(
    p_tenant_id => p_tenant_id,
    p_category => 'appointment',
    p_type => 'appointment_created',
    p_title => 'Запись создана',
    p_source_type => 'appointment',
    p_source_id => v_appointment.id::text,
    p_patient_id => p_patient_id,
    p_audit_event_id => v_audit_id,
    p_actor_user_id => v_actor,
    p_source_status => v_status,
    p_visibility => 'admin',
    p_metadata => jsonb_build_object(
      'appointmentId', v_appointment.id,
      'doctorId', p_doctor_id,
      'operationKey', v_key,
      'replayed', false
    )
  );

  INSERT INTO public.appointment_operations (
    tenant_id, operation_key, operation_type, fingerprint, appointment_id,
    patient_id, doctor_id, start_time, end_time, status,
    result_appointment, actor_user_id
  ) VALUES (
    p_tenant_id, v_key, 'create', v_fingerprint, v_appointment.id,
    p_patient_id, p_doctor_id, p_start_time, p_end_time, v_status,
    public.appointment_row_json(v_appointment), v_actor
  );

  RETURN jsonb_build_object(
    'appointment', public.appointment_row_json(v_appointment),
    'replayed', false,
    'recovered', false,
    'operationType', 'create'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reschedule_appointment(
  p_tenant_id uuid,
  p_appointment_id uuid,
  p_patient_id uuid,
  p_doctor_id uuid,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_cabinet text,
  p_service text,
  p_status text,
  p_payment_type text,
  p_source text,
  p_price numeric,
  p_comment text,
  p_expected_updated_at timestamptz,
  p_operation_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET timezone = 'UTC'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_key text;
  v_status text := COALESCE(NULLIF(btrim(p_status), ''), 'new');
  v_cabinet text := COALESCE(btrim(p_cabinet), '');
  v_service text := COALESCE(btrim(p_service), '');
  v_comment text := NULLIF(btrim(p_comment), '');
  v_payment_type text := NULLIF(btrim(p_payment_type), '');
  v_source text := NULLIF(btrim(p_source), '');
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
  IF v_actor_role IS NULL THEN
    RAISE EXCEPTION 'Недостаточно прав для изменения записи.';
  END IF;

  IF p_end_time IS NULL OR p_start_time IS NULL OR p_end_time <= p_start_time THEN
    RAISE EXCEPTION 'Время окончания должно быть позже времени начала.';
  END IF;

  IF v_status NOT IN ('new', 'confirmed', 'arrived', 'in_progress', 'completed', 'cancelled', 'no_show', 'blocked') THEN
    RAISE EXCEPTION 'Не удалось сохранить запись. Обновите расписание и проверьте результат.';
  END IF;

  IF v_payment_type IS NOT NULL AND v_payment_type NOT IN ('cash', 'card', 'kaspi', 'insurance', 'installment', 'unpaid') THEN
    RAISE EXCEPTION 'Не удалось сохранить запись. Обновите расписание и проверьте результат.';
  END IF;

  IF v_source IS NOT NULL AND v_source NOT IN ('phone', 'whatsapp', 'instagram', 'walk_in', 'repeat', 'referral') THEN
    RAISE EXCEPTION 'Не удалось сохранить запись. Обновите расписание и проверьте результат.';
  END IF;

  IF p_patient_id IS NULL AND v_status <> 'blocked' THEN
    RAISE EXCEPTION 'Пациент недоступен в этой клинике.';
  END IF;

  IF p_patient_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = p_patient_id AND p.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'Пациент недоступен в этой клинике.';
  END IF;

  IF p_doctor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.doctors d
    WHERE d.id = p_doctor_id AND d.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'Врач недоступен в этой клинике.';
  END IF;

  v_key := public.normalize_appointment_operation_key(p_operation_key);
  v_fingerprint := encode(extensions.digest(jsonb_build_object(
    'operationType', 'reschedule',
    'tenantId', p_tenant_id,
    'appointmentId', p_appointment_id,
    'patientId', p_patient_id,
    'doctorId', p_doctor_id,
    'cabinet', v_cabinet,
    'service', v_service,
    'status', v_status,
    'paymentType', v_payment_type,
    'source', v_source,
    'price', p_price,
    'comment', v_comment,
    'startEpoch', extract(epoch FROM p_start_time),
    'endEpoch', extract(epoch FROM p_end_time),
    'expectedUpdatedEpoch', extract(epoch FROM p_expected_updated_at)
  )::text, 'sha256'), 'hex');

  PERFORM pg_advisory_xact_lock(hashtextextended('appointment-operation:' || p_tenant_id::text || ':' || v_key, 0));

  SELECT * INTO v_operation
  FROM public.appointment_operations ao
  WHERE ao.tenant_id = p_tenant_id
    AND ao.operation_key = v_key;

  IF FOUND THEN
    IF v_operation.operation_type <> 'reschedule' OR v_operation.fingerprint <> v_fingerprint THEN
      RAISE EXCEPTION 'Операция с этим идентификатором уже выполнена с другими параметрами.';
    END IF;
    RETURN jsonb_build_object(
      'appointment', v_operation.result_appointment,
      'replayed', true,
      'recovered', false,
      'operationType', 'reschedule'
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

  IF p_expected_updated_at IS NULL OR v_before.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Запись была изменена другим пользователем. Обновите расписание.';
  END IF;

  FOR v_lock_key IN
    SELECT DISTINCT resource_key
    FROM (
      VALUES
        ('appointment-resource:' || p_tenant_id::text || ':doctor:' || v_before.doctor_id::text),
        (CASE WHEN v_before.patient_id IS NOT NULL THEN 'appointment-resource:' || p_tenant_id::text || ':patient:' || v_before.patient_id::text END),
        ('appointment-resource:' || p_tenant_id::text || ':doctor:' || p_doctor_id::text),
        (CASE WHEN p_patient_id IS NOT NULL THEN 'appointment-resource:' || p_tenant_id::text || ':patient:' || p_patient_id::text END)
    ) AS resources(resource_key)
    WHERE resource_key IS NOT NULL
    ORDER BY resource_key
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));
  END LOOP;

  IF v_status <> 'cancelled' THEN
    IF EXISTS (
      SELECT 1
      FROM public.appointments a
      WHERE a.tenant_id = p_tenant_id
        AND a.id <> p_appointment_id
        AND a.doctor_id = p_doctor_id
        AND a.status <> 'cancelled'
        AND a.start_time < p_end_time
        AND a.end_time > p_start_time
    ) THEN
      RAISE EXCEPTION 'У врача уже есть запись на это время.';
    END IF;

    IF p_patient_id IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.appointments a
      WHERE a.tenant_id = p_tenant_id
        AND a.id <> p_appointment_id
        AND a.patient_id = p_patient_id
        AND a.status <> 'cancelled'
        AND a.start_time < p_end_time
        AND a.end_time > p_start_time
    ) THEN
      RAISE EXCEPTION 'У пациента уже есть другая запись на это время.';
    END IF;
  END IF;

  UPDATE public.appointments
  SET patient_id = p_patient_id,
      doctor_id = p_doctor_id,
      cabinet = v_cabinet,
      service = v_service,
      status = v_status,
      payment_type = v_payment_type,
      source = v_source,
      price = p_price,
      comment = v_comment,
      start_time = p_start_time,
      end_time = p_end_time
  WHERE id = p_appointment_id
    AND tenant_id = p_tenant_id
  RETURNING * INTO v_after;

  v_audit_id := public.record_audit_event_internal(
    p_tenant_id => p_tenant_id,
    p_action => 'appointment_rescheduled',
    p_category => 'appointment',
    p_target_type => 'appointment',
    p_target_id => p_appointment_id::text,
    p_actor_user_id => v_actor,
    p_actor_tenant_role => v_actor_role,
    p_patient_id => p_patient_id,
    p_appointment_id => p_appointment_id::text,
    p_before_data => jsonb_build_object(
      'patientId', v_before.patient_id,
      'doctorId', v_before.doctor_id,
      'startTime', v_before.start_time,
      'endTime', v_before.end_time,
      'status', v_before.status
    ),
    p_after_data => jsonb_build_object(
      'patientId', p_patient_id,
      'doctorId', p_doctor_id,
      'startTime', p_start_time,
      'endTime', p_end_time,
      'status', v_status
    ),
    p_request_id => v_key,
    p_metadata => jsonb_build_object('operationKey', v_key, 'replayed', false)
  );

  PERFORM public.record_activity_event_internal(
    p_tenant_id => p_tenant_id,
    p_category => 'appointment',
    p_type => 'appointment_rescheduled',
    p_title => 'Запись перенесена',
    p_source_type => 'appointment',
    p_source_id => p_appointment_id::text,
    p_patient_id => p_patient_id,
    p_audit_event_id => v_audit_id,
    p_actor_user_id => v_actor,
    p_source_status => v_status,
    p_visibility => 'admin',
    p_metadata => jsonb_build_object(
      'appointmentId', p_appointment_id,
      'oldStartTime', v_before.start_time,
      'oldEndTime', v_before.end_time,
      'newStartTime', p_start_time,
      'newEndTime', p_end_time,
      'doctorId', p_doctor_id,
      'operationKey', v_key,
      'replayed', false
    )
  );

  INSERT INTO public.appointment_operations (
    tenant_id, operation_key, operation_type, fingerprint, appointment_id,
    patient_id, doctor_id, start_time, end_time, status,
    result_appointment, actor_user_id
  ) VALUES (
    p_tenant_id, v_key, 'reschedule', v_fingerprint, p_appointment_id,
    p_patient_id, p_doctor_id, p_start_time, p_end_time, v_status,
    public.appointment_row_json(v_after), v_actor
  );

  RETURN jsonb_build_object(
    'appointment', public.appointment_row_json(v_after),
    'replayed', false,
    'recovered', false,
    'operationType', 'reschedule'
  );
END;
$$;

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
AS $$
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

  IF v_status NOT IN ('new', 'confirmed', 'arrived', 'in_progress', 'completed', 'cancelled', 'no_show', 'blocked') THEN
    RAISE EXCEPTION 'Не удалось сохранить запись. Обновите расписание и проверьте результат.';
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

  IF v_status <> 'cancelled' THEN
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
$$;

CREATE OR REPLACE FUNCTION public.get_appointment_operation(
  p_tenant_id uuid,
  p_operation_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_key text;
  v_operation public.appointment_operations%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.tenant_users tu
    WHERE tu.tenant_id = p_tenant_id AND tu.user_id = v_actor
  ) THEN
    RAISE EXCEPTION 'Недостаточно прав для изменения записи.';
  END IF;

  v_key := public.normalize_appointment_operation_key(p_operation_key);

  SELECT * INTO v_operation
  FROM public.appointment_operations ao
  WHERE ao.tenant_id = p_tenant_id
    AND ao.operation_key = v_key;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'operationType', v_operation.operation_type,
    'appointment', v_operation.result_appointment,
    'replayed', true,
    'recovered', true
  );
END;
$$;

-- Keep the explicit legacy table-grant matrix from migration 0024 intact.
-- The authoritative-write trigger blocks ordinary authenticated INSERT/UPDATE,
-- while hard delete remains under its existing owner/admin RLS policy.

REVOKE ALL ON FUNCTION public.set_appointment_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_appointment_authoritative_write() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.normalize_appointment_operation_key(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.appointment_row_json(public.appointments) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.create_appointment(uuid,uuid,uuid,timestamptz,timestamptz,text,text,text,text,text,numeric,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reschedule_appointment(uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,text,text,text,text,numeric,text,timestamptz,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_appointment_details(uuid,uuid,text,text,text,text,text,numeric,text,timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_appointment_operation(uuid,text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_appointment(uuid,uuid,uuid,timestamptz,timestamptz,text,text,text,text,text,numeric,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reschedule_appointment(uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,text,text,text,text,numeric,text,timestamptz,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_appointment_details(uuid,uuid,text,text,text,text,text,numeric,text,timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_appointment_operation(uuid,text) TO authenticated, service_role;
