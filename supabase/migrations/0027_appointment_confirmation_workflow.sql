-- 0027_appointment_confirmation_workflow.sql
-- APPOINTMENT-CONFIRMATION-WORKFLOW-001
-- Auditable, idempotent and tenant-safe appointment confirmation/contact workflow.

DO $$
DECLARE
  v_rows bigint;
  v_legacy_confirmed_status bigint;
BEGIN
  SELECT count(*) INTO v_rows FROM public.appointments;
  SELECT count(*) INTO v_legacy_confirmed_status FROM public.appointments WHERE status = 'confirmed';
  RAISE NOTICE 'APPOINTMENT-CONFIRMATION-WORKFLOW-001 existing rows=%, legacy status confirmed=%',
    v_rows, v_legacy_confirmed_status;
END;
$$;

ALTER TABLE public.appointments
  ADD COLUMN confirmation_state text NOT NULL DEFAULT 'unconfirmed',
  ADD COLUMN confirmed_at timestamptz,
  ADD COLUMN confirmed_by uuid,
  ADD COLUMN confirmation_channel text,
  ADD COLUMN confirmation_note text,
  ADD COLUMN last_confirmation_attempt_at timestamptz,
  ADD COLUMN confirmation_attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN confirmation_metadata_version integer NOT NULL DEFAULT 0,
  ADD COLUMN last_confirmation_outcome text,
  ADD COLUMN last_confirmation_note text;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_confirmed_by_fk
    FOREIGN KEY (confirmed_by) REFERENCES public.profiles(id) ON DELETE RESTRICT,
  ADD CONSTRAINT appointments_confirmation_state_check
    CHECK (confirmation_state IN ('unconfirmed', 'contact_in_progress', 'confirmed', 'unreachable', 'callback_requested')),
  ADD CONSTRAINT appointments_confirmation_channel_check
    CHECK (
      confirmation_channel IS NULL
      OR confirmation_channel IN ('phone', 'whatsapp', 'sms', 'email', 'in_person', 'other')
    ),
  ADD CONSTRAINT appointments_last_confirmation_outcome_check
    CHECK (
      last_confirmation_outcome IS NULL
      OR last_confirmation_outcome IN (
        'confirmed', 'no_answer', 'unreachable', 'callback_requested',
        'declined', 'wrong_number', 'message_sent', 'other'
      )
    ),
  ADD CONSTRAINT appointments_confirmation_attempt_count_check
    CHECK (confirmation_attempt_count >= 0),
  ADD CONSTRAINT appointments_confirmation_metadata_version_check
    CHECK (confirmation_metadata_version IN (0, 1)),
  ADD CONSTRAINT appointments_confirmation_metadata_check
    CHECK (
      (
        confirmation_metadata_version = 0
        AND confirmation_state = 'unconfirmed'
        AND confirmation_attempt_count = 0
        AND confirmed_at IS NULL
        AND confirmed_by IS NULL
        AND confirmation_channel IS NULL
        AND confirmation_note IS NULL
        AND last_confirmation_attempt_at IS NULL
        AND last_confirmation_outcome IS NULL
        AND last_confirmation_note IS NULL
      )
      OR
      (
        confirmation_metadata_version = 1
        AND confirmation_attempt_count > 0
        AND last_confirmation_attempt_at IS NOT NULL
        AND last_confirmation_outcome IS NOT NULL
        AND (
          (
            confirmation_state = 'confirmed'
            AND confirmed_at IS NOT NULL
            AND confirmed_by IS NOT NULL
            AND confirmation_channel IS NOT NULL
            AND last_confirmation_outcome = 'confirmed'
          )
          OR
          (
            confirmation_state <> 'confirmed'
            AND confirmed_at IS NULL
            AND confirmed_by IS NULL
            AND confirmation_channel IS NULL
            AND confirmation_note IS NULL
          )
        )
      )
    );

CREATE INDEX idx_appointments_confirmation_attention
  ON public.appointments (tenant_id, confirmation_state, start_time)
  WHERE confirmation_state <> 'confirmed'
    AND status IN ('new', 'confirmed');

CREATE TABLE public.appointment_confirmation_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  patient_id uuid NOT NULL,
  actor_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  channel text NOT NULL,
  outcome text NOT NULL,
  note text,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  operation_key text NOT NULL,
  fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appointment_confirmation_attempts_channel_check
    CHECK (channel IN ('phone', 'whatsapp', 'sms', 'email', 'in_person', 'other')),
  CONSTRAINT appointment_confirmation_attempts_outcome_check
    CHECK (outcome IN (
      'confirmed', 'no_answer', 'unreachable', 'callback_requested',
      'declined', 'wrong_number', 'message_sent', 'other'
    )),
  CONSTRAINT appointment_confirmation_attempts_note_check
    CHECK (note IS NULL OR (length(btrim(note)) > 0 AND length(note) <= 2000)),
  CONSTRAINT appointment_confirmation_attempts_key_check
    CHECK (
      length(operation_key) BETWEEN 8 AND 160
      AND operation_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
    ),
  CONSTRAINT appointment_confirmation_attempts_fingerprint_check
    CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT appointment_confirmation_attempts_tenant_key_key UNIQUE (tenant_id, operation_key),
  CONSTRAINT appointment_confirmation_attempts_patient_fk
    FOREIGN KEY (tenant_id, patient_id)
    REFERENCES public.patients(tenant_id, id)
    ON DELETE RESTRICT
);

CREATE INDEX idx_appointment_confirmation_attempts_appointment
  ON public.appointment_confirmation_attempts (tenant_id, appointment_id, attempted_at DESC, id ASC);
CREATE INDEX idx_appointment_confirmation_attempts_patient
  ON public.appointment_confirmation_attempts (tenant_id, patient_id, attempted_at DESC, id ASC);

ALTER TABLE public.appointment_confirmation_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can read appointment confirmation attempts"
  ON public.appointment_confirmation_attempts
  FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenants()));

REVOKE ALL ON TABLE public.appointment_confirmation_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.appointment_confirmation_attempts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.appointment_confirmation_attempts TO service_role;

ALTER TABLE public.appointment_operations
  DROP CONSTRAINT appointment_operations_operation_type_check;

ALTER TABLE public.appointment_operations
  ADD COLUMN confirmation_attempt_id uuid REFERENCES public.appointment_confirmation_attempts(id) ON DELETE SET NULL,
  ADD COLUMN result_confirmation_attempt jsonb,
  ADD CONSTRAINT appointment_operations_operation_type_check
    CHECK (operation_type IN ('create', 'reschedule', 'cancel', 'no_show', 'confirmation_attempt', 'confirm')),
  ADD CONSTRAINT appointment_operations_confirmation_result_check
    CHECK (result_confirmation_attempt IS NULL OR jsonb_typeof(result_confirmation_attempt) = 'object');

CREATE OR REPLACE FUNCTION public.appointment_confirmation_attempt_row_json(
  p_attempt public.appointment_confirmation_attempts
) RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT to_jsonb(p_attempt);
$$;

CREATE OR REPLACE FUNCTION public.apply_appointment_confirmation_action(
  p_operation_type text,
  p_tenant_id uuid,
  p_appointment_id uuid,
  p_channel text,
  p_outcome text,
  p_note text,
  p_expected_updated_at timestamptz,
  p_operation_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET timezone = 'UTC'
AS $confirmation_action$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_operation_type text := NULLIF(btrim(p_operation_type), '');
  v_channel text := NULLIF(btrim(p_channel), '');
  v_outcome text := NULLIF(btrim(p_outcome), '');
  v_note text := NULLIF(btrim(p_note), '');
  v_key text;
  v_fingerprint text;
  v_operation public.appointment_operations%ROWTYPE;
  v_before public.appointments%ROWTYPE;
  v_after public.appointments%ROWTYPE;
  v_attempt public.appointment_confirmation_attempts%ROWTYPE;
  v_next_state text;
  v_now timestamptz := transaction_timestamp();
  v_audit_id uuid;
  v_action text;
  v_title text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Недостаточно прав для подтверждения записи.';
  END IF;

  SELECT tu.role::text INTO v_actor_role
  FROM public.tenant_users tu
  WHERE tu.tenant_id = p_tenant_id
    AND tu.user_id = v_actor;

  IF v_actor_role IS NULL OR v_actor_role NOT IN ('clinic_owner', 'clinic_admin', 'registrar') THEN
    RAISE EXCEPTION 'Недостаточно прав для подтверждения записи.';
  END IF;

  IF v_operation_type NOT IN ('confirmation_attempt', 'confirm') THEN
    RAISE EXCEPTION 'Не удалось сохранить подтверждение. Обновите расписание и проверьте результат.';
  END IF;
  IF v_channel IS NULL THEN
    RAISE EXCEPTION 'Выберите способ связи.';
  END IF;
  IF v_channel NOT IN ('phone', 'whatsapp', 'sms', 'email', 'in_person', 'other') THEN
    RAISE EXCEPTION 'Выберите способ связи.';
  END IF;
  IF v_outcome IS NULL THEN
    RAISE EXCEPTION 'Выберите результат связи.';
  END IF;
  IF v_outcome NOT IN (
    'confirmed', 'no_answer', 'unreachable', 'callback_requested',
    'declined', 'wrong_number', 'message_sent', 'other'
  ) THEN
    RAISE EXCEPTION 'Выберите результат связи.';
  END IF;
  IF v_operation_type = 'confirm' AND v_outcome <> 'confirmed' THEN
    RAISE EXCEPTION 'Не удалось сохранить подтверждение. Обновите расписание и проверьте результат.';
  END IF;
  IF v_note IS NOT NULL AND length(v_note) > 2000 THEN
    RAISE EXCEPTION 'Не удалось сохранить подтверждение. Обновите расписание и проверьте результат.';
  END IF;
  IF p_expected_updated_at IS NULL THEN
    RAISE EXCEPTION 'Запись была изменена другим пользователем. Обновите расписание.';
  END IF;

  v_key := public.normalize_appointment_operation_key(p_operation_key);
  v_fingerprint := encode(extensions.digest(jsonb_build_object(
    'operationType', v_operation_type,
    'tenantId', p_tenant_id,
    'appointmentId', p_appointment_id,
    'expectedUpdatedEpoch', extract(epoch FROM p_expected_updated_at),
    'channel', v_channel,
    'outcome', v_outcome,
    'note', v_note
  )::text, 'sha256'), 'hex');

  PERFORM pg_advisory_xact_lock(
    hashtextextended('appointment-operation:' || p_tenant_id::text || ':' || v_key, 0)
  );

  SELECT * INTO v_operation
  FROM public.appointment_operations ao
  WHERE ao.tenant_id = p_tenant_id
    AND ao.operation_key = v_key;

  IF FOUND THEN
    IF v_operation.operation_type <> v_operation_type OR v_operation.fingerprint <> v_fingerprint THEN
      RAISE EXCEPTION 'Эта операция уже была выполнена с другими параметрами.';
    END IF;
    RETURN jsonb_build_object(
      'appointment', v_operation.result_appointment,
      'confirmationAttempt', v_operation.result_confirmation_attempt,
      'replayed', true,
      'recovered', false,
      'operationType', v_operation_type
    );
  END IF;

  SELECT * INTO v_before
  FROM public.appointments a
  WHERE a.id = p_appointment_id
    AND a.tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Недостаточно прав для подтверждения записи.';
  END IF;
  IF v_before.status NOT IN ('new', 'confirmed') THEN
    RAISE EXCEPTION 'Текущий статус записи не позволяет выполнить это действие.';
  END IF;
  IF v_before.confirmation_state = 'confirmed' THEN
    RAISE EXCEPTION 'Запись уже подтверждена.';
  END IF;
  IF v_before.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Запись была изменена другим пользователем. Обновите расписание.';
  END IF;
  IF v_before.patient_id IS NULL THEN
    RAISE EXCEPTION 'Текущий статус записи не позволяет выполнить это действие.';
  END IF;

  v_next_state := CASE v_outcome
    WHEN 'confirmed' THEN 'confirmed'
    WHEN 'callback_requested' THEN 'callback_requested'
    WHEN 'unreachable' THEN 'unreachable'
    WHEN 'wrong_number' THEN 'unreachable'
    WHEN 'declined' THEN 'unreachable'
    ELSE 'contact_in_progress'
  END;

  INSERT INTO public.appointment_confirmation_attempts (
    tenant_id, appointment_id, patient_id, actor_user_id,
    channel, outcome, note, attempted_at, operation_key, fingerprint
  ) VALUES (
    p_tenant_id, p_appointment_id, v_before.patient_id, v_actor,
    v_channel, v_outcome, v_note, v_now, v_key, v_fingerprint
  )
  RETURNING * INTO v_attempt;

  UPDATE public.appointments
  SET confirmation_state = v_next_state,
      confirmed_at = CASE WHEN v_next_state = 'confirmed' THEN v_now ELSE NULL END,
      confirmed_by = CASE WHEN v_next_state = 'confirmed' THEN v_actor ELSE NULL END,
      confirmation_channel = CASE WHEN v_next_state = 'confirmed' THEN v_channel ELSE NULL END,
      confirmation_note = CASE WHEN v_next_state = 'confirmed' THEN v_note ELSE NULL END,
      last_confirmation_attempt_at = v_now,
      confirmation_attempt_count = confirmation_attempt_count + 1,
      confirmation_metadata_version = 1,
      last_confirmation_outcome = v_outcome,
      last_confirmation_note = v_note
  WHERE id = p_appointment_id
    AND tenant_id = p_tenant_id
  RETURNING * INTO v_after;

  v_action := CASE WHEN v_outcome = 'confirmed'
    THEN 'appointment_confirmed'
    ELSE 'appointment_confirmation_attempted'
  END;
  v_title := CASE WHEN v_outcome = 'confirmed'
    THEN 'Запись подтверждена'
    ELSE 'Зафиксирована попытка связи'
  END;

  v_audit_id := public.record_audit_event_internal(
    p_tenant_id => p_tenant_id,
    p_action => v_action,
    p_category => 'appointment',
    p_target_type => 'appointment',
    p_target_id => p_appointment_id::text,
    p_actor_user_id => v_actor,
    p_actor_tenant_role => v_actor_role,
    p_patient_id => v_before.patient_id,
    p_appointment_id => p_appointment_id::text,
    p_before_data => jsonb_build_object(
      'confirmationState', v_before.confirmation_state,
      'confirmationAttemptCount', v_before.confirmation_attempt_count,
      'updatedAt', v_before.updated_at
    ),
    p_after_data => jsonb_build_object(
      'confirmationState', v_after.confirmation_state,
      'confirmationAttemptCount', v_after.confirmation_attempt_count,
      'lastConfirmationAttemptAt', v_after.last_confirmation_attempt_at,
      'confirmedAt', v_after.confirmed_at,
      'confirmedBy', v_after.confirmed_by,
      'confirmationChannel', v_after.confirmation_channel
    ),
    p_request_id => v_key,
    p_metadata => jsonb_build_object(
      'operationKey', v_key,
      'confirmationAttemptId', v_attempt.id,
      'channel', v_channel,
      'outcome', v_outcome,
      'previousConfirmationState', v_before.confirmation_state,
      'newConfirmationState', v_after.confirmation_state,
      'replayed', false
    )
  );

  PERFORM public.record_activity_event_internal(
    p_tenant_id => p_tenant_id,
    p_category => 'appointment',
    p_type => v_action,
    p_title => v_title,
    p_source_type => 'appointment',
    p_source_id => p_appointment_id::text,
    p_patient_id => v_before.patient_id,
    p_audit_event_id => v_audit_id,
    p_actor_user_id => v_actor,
    p_source_status => v_after.status,
    p_visibility => 'admin',
    p_metadata => jsonb_build_object(
      'appointmentId', p_appointment_id,
      'confirmationAttemptId', v_attempt.id,
      'channel', v_channel,
      'outcome', v_outcome,
      'previousConfirmationState', v_before.confirmation_state,
      'newConfirmationState', v_after.confirmation_state,
      'operationKey', v_key,
      'replayed', false
    )
  );

  INSERT INTO public.appointment_operations (
    tenant_id, operation_key, operation_type, fingerprint, appointment_id,
    patient_id, doctor_id, start_time, end_time, status,
    result_appointment, actor_user_id, confirmation_attempt_id, result_confirmation_attempt
  ) VALUES (
    p_tenant_id, v_key, v_operation_type, v_fingerprint, p_appointment_id,
    v_before.patient_id, v_before.doctor_id, v_before.start_time, v_before.end_time, v_after.status,
    public.appointment_row_json(v_after), v_actor, v_attempt.id,
    public.appointment_confirmation_attempt_row_json(v_attempt)
  );

  RETURN jsonb_build_object(
    'appointment', public.appointment_row_json(v_after),
    'confirmationAttempt', public.appointment_confirmation_attempt_row_json(v_attempt),
    'replayed', false,
    'recovered', false,
    'operationType', v_operation_type
  );
END;
$confirmation_action$;

CREATE OR REPLACE FUNCTION public.record_appointment_confirmation_attempt(
  p_tenant_id uuid,
  p_appointment_id uuid,
  p_channel text,
  p_outcome text,
  p_note text,
  p_expected_updated_at timestamptz,
  p_operation_key text
) RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.apply_appointment_confirmation_action(
    'confirmation_attempt', p_tenant_id, p_appointment_id,
    p_channel, p_outcome, p_note, p_expected_updated_at, p_operation_key
  );
$$;

CREATE OR REPLACE FUNCTION public.confirm_appointment(
  p_tenant_id uuid,
  p_appointment_id uuid,
  p_channel text,
  p_note text,
  p_expected_updated_at timestamptz,
  p_operation_key text
) RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.apply_appointment_confirmation_action(
    'confirm', p_tenant_id, p_appointment_id,
    p_channel, 'confirmed', p_note, p_expected_updated_at, p_operation_key
  );
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
    'confirmationAttempt', v_operation.result_confirmation_attempt,
    'replayed', true,
    'recovered', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.appointment_confirmation_attempt_row_json(public.appointment_confirmation_attempts) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_appointment_confirmation_action(text,uuid,uuid,text,text,text,timestamptz,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_appointment_confirmation_attempt(uuid,uuid,text,text,text,timestamptz,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_appointment(uuid,uuid,text,text,timestamptz,text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.record_appointment_confirmation_attempt(uuid,uuid,text,text,text,timestamptz,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_appointment(uuid,uuid,text,text,timestamptz,text) TO authenticated, service_role;
