-- 0030_appointment_reminder_manual_operations.sql
-- Tenant-scoped manual reminder operations. This migration sends no messages.

ALTER TABLE public.appointment_reminder_jobs
  ADD COLUMN original_due_at timestamptz,
  ADD COLUMN completed_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  ADD COLUMN completion_outcome text,
  ADD COLUMN completion_note text,
  ADD COLUMN confirmation_attempt_id uuid REFERENCES public.appointment_confirmation_attempts(id) ON DELETE SET NULL,
  ADD COLUMN deferred_at timestamptz,
  ADD COLUMN deferred_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  ADD COLUMN defer_reason text,
  ADD COLUMN skipped_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  ADD COLUMN operation_key text,
  ADD COLUMN operation_fingerprint text,
  ADD COLUMN last_manual_action_at timestamptz;

UPDATE public.appointment_reminder_jobs
SET original_due_at = due_at
WHERE original_due_at IS NULL;

ALTER TABLE public.appointment_reminder_jobs
  ALTER COLUMN original_due_at SET NOT NULL,
  DROP CONSTRAINT appointment_reminder_jobs_channel_check,
  DROP CONSTRAINT appointment_reminder_jobs_terminal_fields_check,
  DROP CONSTRAINT appointment_reminder_jobs_terminal_reason_check,
  ADD CONSTRAINT appointment_reminder_jobs_channel_check
    CHECK (channel IS NULL OR channel IN ('phone', 'whatsapp', 'sms', 'email', 'in_person', 'other')),
  ADD CONSTRAINT appointment_reminder_jobs_completion_outcome_check
    CHECK (
      completion_outcome IS NULL OR completion_outcome IN (
        'confirmed', 'no_answer', 'unreachable', 'callback_requested',
        'declined', 'wrong_number', 'message_sent', 'other'
      )
    ),
  ADD CONSTRAINT appointment_reminder_jobs_completion_note_check
    CHECK (completion_note IS NULL OR (length(btrim(completion_note)) > 0 AND length(completion_note) <= 2000)),
  ADD CONSTRAINT appointment_reminder_jobs_defer_reason_check
    CHECK (defer_reason IS NULL OR (length(btrim(defer_reason)) > 0 AND length(defer_reason) <= 1000)),
  ADD CONSTRAINT appointment_reminder_jobs_operation_key_check
    CHECK (
      operation_key IS NULL OR (
        length(operation_key) BETWEEN 8 AND 160
        AND operation_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
      )
    ),
  ADD CONSTRAINT appointment_reminder_jobs_operation_fingerprint_check
    CHECK (operation_fingerprint IS NULL OR operation_fingerprint ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT appointment_reminder_jobs_operation_pair_check
    CHECK (
      (operation_key IS NULL AND operation_fingerprint IS NULL AND last_manual_action_at IS NULL)
      OR (operation_key IS NOT NULL AND operation_fingerprint IS NOT NULL AND last_manual_action_at IS NOT NULL)
    ),
  ADD CONSTRAINT appointment_reminder_jobs_terminal_fields_check
    CHECK (
      (
        state = 'superseded'
        AND superseded_at IS NOT NULL
        AND cancelled_at IS NULL AND skipped_at IS NULL AND completed_at IS NULL
        AND completed_by IS NULL AND completion_outcome IS NULL AND completion_note IS NULL
        AND confirmation_attempt_id IS NULL AND skipped_by IS NULL
      )
      OR (
        state = 'cancelled'
        AND cancelled_at IS NOT NULL
        AND superseded_at IS NULL AND skipped_at IS NULL AND completed_at IS NULL
        AND completed_by IS NULL AND completion_outcome IS NULL AND completion_note IS NULL
        AND confirmation_attempt_id IS NULL AND skipped_by IS NULL
      )
      OR (
        state = 'skipped'
        AND skipped_at IS NOT NULL AND skipped_by IS NOT NULL
        AND superseded_at IS NULL AND cancelled_at IS NULL AND completed_at IS NULL
        AND completed_by IS NULL AND completion_outcome IS NULL AND completion_note IS NULL
        AND confirmation_attempt_id IS NULL
        AND deferred_at IS NULL AND deferred_by IS NULL AND defer_reason IS NULL
      )
      OR (
        state = 'completed'
        AND completed_at IS NOT NULL
        AND superseded_at IS NULL AND cancelled_at IS NULL AND skipped_at IS NULL
        AND skipped_by IS NULL
        AND (
          (
            terminal_reason = 'manual_completed'
            AND completed_by IS NOT NULL
            AND completion_outcome IS NOT NULL
            AND channel IS NOT NULL
            AND confirmation_attempt_id IS NOT NULL
            AND deferred_at IS NULL AND deferred_by IS NULL AND defer_reason IS NULL
          )
          OR terminal_reason <> 'manual_completed'
          OR terminal_reason IS NULL
        )
      )
      OR (
        state IN ('scheduled', 'ready')
        AND superseded_at IS NULL AND cancelled_at IS NULL AND skipped_at IS NULL AND completed_at IS NULL
        AND completed_by IS NULL AND completion_outcome IS NULL AND completion_note IS NULL
        AND confirmation_attempt_id IS NULL AND skipped_by IS NULL
        AND (
          (deferred_at IS NULL AND deferred_by IS NULL AND defer_reason IS NULL)
          OR (deferred_at IS NOT NULL AND deferred_by IS NOT NULL AND defer_reason IS NOT NULL)
        )
      )
    ),
  ADD CONSTRAINT appointment_reminder_jobs_terminal_reason_check
    CHECK (
      (state IN ('scheduled', 'ready') AND terminal_reason IS NULL)
      OR (state IN ('completed', 'cancelled', 'superseded', 'skipped') AND terminal_reason IS NOT NULL AND length(btrim(terminal_reason)) > 0)
    );

CREATE INDEX idx_appointment_reminder_jobs_history
  ON public.appointment_reminder_jobs (tenant_id, state, COALESCE(completed_at, skipped_at, cancelled_at, superseded_at, updated_at) DESC, id);
CREATE INDEX idx_appointment_reminder_jobs_confirmation_attempt
  ON public.appointment_reminder_jobs (tenant_id, confirmation_attempt_id)
  WHERE confirmation_attempt_id IS NOT NULL;

ALTER TABLE public.appointment_operations
  DROP CONSTRAINT appointment_operations_operation_type_check,
  ADD COLUMN reminder_job_id uuid REFERENCES public.appointment_reminder_jobs(id) ON DELETE SET NULL,
  ADD COLUMN result_reminder_job jsonb,
  ADD CONSTRAINT appointment_operations_operation_type_check
    CHECK (operation_type IN (
      'create', 'reschedule', 'cancel', 'no_show', 'confirmation_attempt', 'confirm',
      'reminder_complete', 'reminder_defer', 'reminder_skip'
    )),
  ADD CONSTRAINT appointment_operations_reminder_result_check
    CHECK (result_reminder_job IS NULL OR jsonb_typeof(result_reminder_job) = 'object');

ALTER TABLE public.appointments
  DROP CONSTRAINT appointments_confirmation_metadata_check,
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

CREATE OR REPLACE FUNCTION public.set_appointment_reminder_original_due_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog, pg_temp
AS $original_due$
BEGIN
  IF NEW.original_due_at IS NULL THEN
    NEW.original_due_at := NEW.due_at;
  END IF;
  RETURN NEW;
END;
$original_due$;

CREATE TRIGGER appointment_reminder_jobs_original_due_default
BEFORE INSERT ON public.appointment_reminder_jobs
FOR EACH ROW EXECUTE FUNCTION public.set_appointment_reminder_original_due_at();

CREATE OR REPLACE FUNCTION public.appointment_reminder_job_row_json(p_job public.appointment_reminder_jobs)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_catalog, pg_temp
AS $job_json$
  SELECT jsonb_build_object(
    'id', p_job.id,
    'tenantId', p_job.tenant_id,
    'appointmentId', p_job.appointment_id,
    'patientId', p_job.patient_id,
    'reminderType', p_job.reminder_type,
    'executionMode', p_job.execution_mode,
    'channel', p_job.channel,
    'dueAt', p_job.due_at,
    'originalDueAt', p_job.original_due_at,
    'state', p_job.state,
    'appointmentUpdatedAt', p_job.appointment_updated_at,
    'policyVersion', p_job.policy_version,
    'planKey', p_job.plan_key,
    'payloadFingerprint', p_job.payload_fingerprint,
    'priority', p_job.priority,
    'createdBy', p_job.created_by,
    'createdAt', p_job.created_at,
    'updatedAt', p_job.updated_at,
    'supersededAt', p_job.superseded_at,
    'cancelledAt', p_job.cancelled_at,
    'skippedAt', p_job.skipped_at,
    'completedAt', p_job.completed_at,
    'completedBy', p_job.completed_by,
    'completionOutcome', p_job.completion_outcome,
    'completionNote', p_job.completion_note,
    'confirmationAttemptId', p_job.confirmation_attempt_id,
    'deferredAt', p_job.deferred_at,
    'deferredBy', p_job.deferred_by,
    'deferReason', p_job.defer_reason,
    'skippedBy', p_job.skipped_by,
    'operationKey', p_job.operation_key,
    'operationFingerprint', p_job.operation_fingerprint,
    'lastManualActionAt', p_job.last_manual_action_at,
    'terminalReason', p_job.terminal_reason,
    'metadata', p_job.metadata,
    'operationalState', CASE
      WHEN p_job.state = 'scheduled' AND p_job.due_at <= now() THEN 'ready'
      ELSE p_job.state
    END
  );
$job_json$;

CREATE OR REPLACE FUNCTION public.transition_active_appointment_reminder_jobs_internal(
  p_tenant_id uuid,
  p_appointment_id uuid,
  p_target_state text,
  p_reason text,
  p_actor uuid,
  p_source text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $transition_jobs$
DECLARE
  v_job public.appointment_reminder_jobs%ROWTYPE;
  v_count integer := 0;
  v_action text;
  v_rows jsonb := '[]'::jsonb;
BEGIN
  IF p_target_state NOT IN ('cancelled', 'superseded', 'skipped') THEN
    RAISE EXCEPTION 'Unsupported reminder transition state';
  END IF;
  IF p_target_state = 'skipped' AND p_actor IS NULL THEN
    RAISE EXCEPTION 'Reminder skip transition requires an actor.' USING ERRCODE = '42501';
  END IF;

  v_action := CASE p_target_state
    WHEN 'cancelled' THEN 'appointment_reminder_cancelled'
    WHEN 'superseded' THEN 'appointment_reminder_superseded'
    ELSE 'appointment_reminder_skipped'
  END;

  FOR v_job IN
    SELECT *
    FROM public.appointment_reminder_jobs
    WHERE tenant_id = p_tenant_id
      AND appointment_id = p_appointment_id
      AND state IN ('scheduled', 'ready')
    ORDER BY due_at, priority, created_at, id
    FOR UPDATE
  LOOP
    PERFORM set_config('app.reminder_job_internal', 'on', true);
    UPDATE public.appointment_reminder_jobs
    SET state = p_target_state,
        superseded_at = CASE WHEN p_target_state = 'superseded' THEN now() ELSE NULL END,
        cancelled_at = CASE WHEN p_target_state = 'cancelled' THEN now() ELSE NULL END,
        skipped_at = CASE WHEN p_target_state = 'skipped' THEN now() ELSE NULL END,
        skipped_by = CASE WHEN p_target_state = 'skipped' THEN p_actor ELSE NULL END,
        completed_at = NULL,
        completed_by = NULL,
        completion_outcome = NULL,
        completion_note = NULL,
        confirmation_attempt_id = NULL,
        deferred_at = CASE WHEN p_target_state = 'skipped' THEN NULL ELSE deferred_at END,
        deferred_by = CASE WHEN p_target_state = 'skipped' THEN NULL ELSE deferred_by END,
        defer_reason = CASE WHEN p_target_state = 'skipped' THEN NULL ELSE defer_reason END,
        terminal_reason = p_reason
    WHERE id = v_job.id
    RETURNING * INTO v_job;
    PERFORM set_config('app.reminder_job_internal', 'off', true);

    PERFORM public.record_appointment_reminder_transition_internal(
      v_job, v_action, 'scheduled', p_target_state, p_actor, p_source
    );
    v_count := v_count + 1;
    v_rows := v_rows || jsonb_build_array(public.appointment_reminder_job_row_json(v_job));
  END LOOP;

  RETURN jsonb_build_object('count', v_count, 'jobs', v_rows);
END;
$transition_jobs$;

CREATE OR REPLACE FUNCTION public.record_appointment_reminder_manual_event_internal(
  p_job public.appointment_reminder_jobs,
  p_action text,
  p_actor uuid,
  p_actor_role text,
  p_before_data jsonb,
  p_after_data jsonb,
  p_operation_key text,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $manual_event$
DECLARE
  v_audit_id uuid;
  v_title text;
BEGIN
  v_title := CASE p_action
    WHEN 'appointment_reminder_completed' THEN 'Задача напоминания завершена'
    WHEN 'appointment_reminder_deferred' THEN 'Задача напоминания отложена'
    WHEN 'appointment_reminder_skipped' THEN 'Задача напоминания пропущена'
    ELSE 'Изменена ручная задача напоминания'
  END;

  v_audit_id := public.record_audit_event_internal(
    p_tenant_id => p_job.tenant_id,
    p_action => p_action,
    p_category => 'appointment',
    p_target_type => 'appointment_reminder_job',
    p_target_id => p_job.id::text,
    p_actor_user_id => p_actor,
    p_actor_tenant_role => p_actor_role,
    p_patient_id => p_job.patient_id,
    p_appointment_id => p_job.appointment_id::text,
    p_before_data => COALESCE(p_before_data, '{}'::jsonb),
    p_after_data => COALESCE(p_after_data, '{}'::jsonb),
    p_request_id => p_operation_key,
    p_redaction_level => 'standard',
    p_metadata => jsonb_build_object(
      'jobId', p_job.id,
      'planKey', p_job.plan_key,
      'operationKey', p_operation_key,
      'executionMode', p_job.execution_mode
    ) || COALESCE(p_metadata, '{}'::jsonb)
  );

  PERFORM public.record_activity_event_internal(
    p_tenant_id => p_job.tenant_id,
    p_category => 'appointment',
    p_type => p_action,
    p_title => v_title,
    p_source_type => 'appointment_reminder_job',
    p_source_id => p_job.id::text,
    p_patient_id => p_job.patient_id,
    p_audit_event_id => v_audit_id,
    p_actor_user_id => p_actor,
    p_source_status => p_job.state,
    p_visibility => 'admin',
    p_metadata => jsonb_build_object(
      'appointmentId', p_job.appointment_id,
      'reminderType', p_job.reminder_type,
      'dueAt', p_job.due_at,
      'originalDueAt', p_job.original_due_at,
      'state', p_job.state,
      'operationKey', p_operation_key
    ) || COALESCE(p_metadata, '{}'::jsonb)
  );
END;
$manual_event$;

CREATE OR REPLACE FUNCTION public.apply_appointment_confirmation_attempt_internal(
  p_tenant_id uuid,
  p_appointment_id uuid,
  p_actor uuid,
  p_actor_role text,
  p_channel text,
  p_outcome text,
  p_note text,
  p_expected_updated_at timestamptz,
  p_attempt_operation_key text,
  p_attempt_fingerprint text,
  p_allow_confirmed_followup boolean DEFAULT false,
  p_source text DEFAULT 'confirmation_rpc'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
SET timezone = 'UTC'
AS $confirmation_internal$
DECLARE
  v_before public.appointments%ROWTYPE;
  v_after public.appointments%ROWTYPE;
  v_attempt public.appointment_confirmation_attempts%ROWTYPE;
  v_next_state text;
  v_now timestamptz := transaction_timestamp();
  v_audit_id uuid;
  v_action text;
  v_title text;
BEGIN
  SELECT * INTO v_before
  FROM public.appointments a
  WHERE a.id = p_appointment_id
    AND a.tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Недостаточно прав для подтверждения записи.' USING ERRCODE = '42501';
  END IF;
  IF v_before.status NOT IN ('new', 'confirmed') THEN
    RAISE EXCEPTION 'Текущий статус записи не позволяет выполнить это действие.' USING ERRCODE = '55000';
  END IF;
  IF v_before.confirmation_state = 'confirmed' AND NOT p_allow_confirmed_followup THEN
    RAISE EXCEPTION 'Запись уже подтверждена.' USING ERRCODE = '55000';
  END IF;
  IF v_before.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Запись была изменена другим пользователем. Обновите расписание.' USING ERRCODE = '40001';
  END IF;
  IF v_before.patient_id IS NULL THEN
    RAISE EXCEPTION 'Текущий статус записи не позволяет выполнить это действие.' USING ERRCODE = '55000';
  END IF;

  v_next_state := CASE
    WHEN v_before.confirmation_state = 'confirmed' AND p_allow_confirmed_followup THEN 'confirmed'
    WHEN p_outcome = 'confirmed' THEN 'confirmed'
    WHEN p_outcome = 'callback_requested' THEN 'callback_requested'
    WHEN p_outcome IN ('unreachable', 'wrong_number', 'declined') THEN 'unreachable'
    ELSE 'contact_in_progress'
  END;

  INSERT INTO public.appointment_confirmation_attempts (
    tenant_id, appointment_id, patient_id, actor_user_id,
    channel, outcome, note, attempted_at, operation_key, fingerprint
  ) VALUES (
    p_tenant_id, p_appointment_id, v_before.patient_id, p_actor,
    p_channel, p_outcome, p_note, v_now, p_attempt_operation_key, p_attempt_fingerprint
  )
  RETURNING * INTO v_attempt;

  UPDATE public.appointments
  SET confirmation_state = v_next_state,
      confirmed_at = CASE
        WHEN v_next_state = 'confirmed' AND v_before.confirmation_state = 'confirmed' THEN v_before.confirmed_at
        WHEN v_next_state = 'confirmed' THEN v_now
        ELSE NULL
      END,
      confirmed_by = CASE
        WHEN v_next_state = 'confirmed' AND v_before.confirmation_state = 'confirmed' THEN v_before.confirmed_by
        WHEN v_next_state = 'confirmed' THEN p_actor
        ELSE NULL
      END,
      confirmation_channel = CASE
        WHEN v_next_state = 'confirmed' AND v_before.confirmation_state = 'confirmed' THEN v_before.confirmation_channel
        WHEN v_next_state = 'confirmed' THEN p_channel
        ELSE NULL
      END,
      confirmation_note = CASE
        WHEN v_next_state = 'confirmed' AND v_before.confirmation_state = 'confirmed' THEN v_before.confirmation_note
        WHEN v_next_state = 'confirmed' THEN p_note
        ELSE NULL
      END,
      last_confirmation_attempt_at = v_now,
      confirmation_attempt_count = confirmation_attempt_count + 1,
      confirmation_metadata_version = 1,
      last_confirmation_outcome = p_outcome,
      last_confirmation_note = p_note
  WHERE id = p_appointment_id
    AND tenant_id = p_tenant_id
  RETURNING * INTO v_after;

  v_action := CASE WHEN p_outcome = 'confirmed'
    THEN 'appointment_confirmed'
    ELSE 'appointment_confirmation_attempted'
  END;
  v_title := CASE WHEN p_outcome = 'confirmed'
    THEN 'Запись подтверждена'
    ELSE 'Зафиксирована попытка связи'
  END;

  v_audit_id := public.record_audit_event_internal(
    p_tenant_id => p_tenant_id,
    p_action => v_action,
    p_category => 'appointment',
    p_target_type => 'appointment',
    p_target_id => p_appointment_id::text,
    p_actor_user_id => p_actor,
    p_actor_tenant_role => p_actor_role,
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
    p_request_id => p_attempt_operation_key,
    p_metadata => jsonb_build_object(
      'operationKey', p_attempt_operation_key,
      'confirmationAttemptId', v_attempt.id,
      'channel', p_channel,
      'outcome', p_outcome,
      'previousConfirmationState', v_before.confirmation_state,
      'newConfirmationState', v_after.confirmation_state,
      'source', p_source,
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
    p_actor_user_id => p_actor,
    p_source_status => v_after.status,
    p_visibility => 'admin',
    p_metadata => jsonb_build_object(
      'appointmentId', p_appointment_id,
      'confirmationAttemptId', v_attempt.id,
      'channel', p_channel,
      'outcome', p_outcome,
      'previousConfirmationState', v_before.confirmation_state,
      'newConfirmationState', v_after.confirmation_state,
      'operationKey', p_attempt_operation_key,
      'source', p_source,
      'replayed', false
    )
  );

  RETURN jsonb_build_object(
    'appointment', public.appointment_row_json(v_after),
    'confirmationAttempt', public.appointment_confirmation_attempt_row_json(v_attempt)
  );
END;
$confirmation_internal$;

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
SET search_path = public, pg_catalog, pg_temp
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
  v_result jsonb;
  v_appointment jsonb;
  v_attempt jsonb;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Недостаточно прав для подтверждения записи.' USING ERRCODE = '42501';
  END IF;

  SELECT tu.role::text INTO v_actor_role
  FROM public.tenant_users tu
  WHERE tu.tenant_id = p_tenant_id
    AND tu.user_id = v_actor;

  IF v_actor_role IS NULL OR v_actor_role NOT IN ('clinic_owner', 'clinic_admin', 'registrar') THEN
    RAISE EXCEPTION 'Недостаточно прав для подтверждения записи.' USING ERRCODE = '42501';
  END IF;
  IF v_operation_type NOT IN ('confirmation_attempt', 'confirm') THEN
    RAISE EXCEPTION 'Не удалось сохранить подтверждение. Обновите расписание и проверьте результат.' USING ERRCODE = '22023';
  END IF;
  IF v_channel IS NULL OR v_channel NOT IN ('phone', 'whatsapp', 'sms', 'email', 'in_person', 'other') THEN
    RAISE EXCEPTION 'Выберите способ связи.' USING ERRCODE = '22023';
  END IF;
  IF v_outcome IS NULL OR v_outcome NOT IN (
    'confirmed', 'no_answer', 'unreachable', 'callback_requested',
    'declined', 'wrong_number', 'message_sent', 'other'
  ) THEN
    RAISE EXCEPTION 'Выберите результат связи.' USING ERRCODE = '22023';
  END IF;
  IF v_operation_type = 'confirm' AND v_outcome <> 'confirmed' THEN
    RAISE EXCEPTION 'Не удалось сохранить подтверждение. Обновите расписание и проверьте результат.' USING ERRCODE = '22023';
  END IF;
  IF v_note IS NOT NULL AND length(v_note) > 2000 THEN
    RAISE EXCEPTION 'Не удалось сохранить подтверждение. Обновите расписание и проверьте результат.' USING ERRCODE = '22023';
  END IF;
  IF p_expected_updated_at IS NULL THEN
    RAISE EXCEPTION 'Запись была изменена другим пользователем. Обновите расписание.' USING ERRCODE = '40001';
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
      RAISE EXCEPTION 'Эта операция уже была выполнена с другими параметрами.' USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object(
      'appointment', v_operation.result_appointment,
      'confirmationAttempt', v_operation.result_confirmation_attempt,
      'replayed', true,
      'recovered', false,
      'operationType', v_operation_type
    );
  END IF;

  v_result := public.apply_appointment_confirmation_attempt_internal(
    p_tenant_id, p_appointment_id, v_actor, v_actor_role,
    v_channel, v_outcome, v_note, p_expected_updated_at,
    v_key, v_fingerprint, false, 'confirmation_rpc'
  );
  v_appointment := v_result->'appointment';
  v_attempt := v_result->'confirmationAttempt';

  INSERT INTO public.appointment_operations (
    tenant_id, operation_key, operation_type, fingerprint, appointment_id,
    patient_id, doctor_id, start_time, end_time, status,
    result_appointment, actor_user_id, confirmation_attempt_id, result_confirmation_attempt
  ) VALUES (
    p_tenant_id, v_key, v_operation_type, v_fingerprint, p_appointment_id,
    (v_appointment->>'patient_id')::uuid,
    (v_appointment->>'doctor_id')::uuid,
    (v_appointment->>'start_time')::timestamptz,
    (v_appointment->>'end_time')::timestamptz,
    v_appointment->>'status',
    v_appointment, v_actor, (v_attempt->>'id')::uuid, v_attempt
  );

  RETURN jsonb_build_object(
    'appointment', v_appointment,
    'confirmationAttempt', v_attempt,
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
SET search_path = public, pg_catalog, pg_temp
AS $record_confirmation$
  SELECT public.apply_appointment_confirmation_action(
    'confirmation_attempt', p_tenant_id, p_appointment_id,
    p_channel, p_outcome, p_note, p_expected_updated_at, p_operation_key
  );
$record_confirmation$;

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
SET search_path = public, pg_catalog, pg_temp
AS $confirm_appointment$
  SELECT public.apply_appointment_confirmation_action(
    'confirm', p_tenant_id, p_appointment_id,
    p_channel, 'confirmed', p_note, p_expected_updated_at, p_operation_key
  );
$confirm_appointment$;

CREATE OR REPLACE FUNCTION public.complete_appointment_reminder_job(
  p_tenant_id uuid,
  p_job_id uuid,
  p_channel text,
  p_outcome text,
  p_note text,
  p_expected_job_updated_at timestamptz,
  p_expected_appointment_updated_at timestamptz,
  p_operation_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
SET timezone = 'UTC'
AS $complete_reminder$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_channel text := NULLIF(btrim(p_channel), '');
  v_outcome text := NULLIF(btrim(p_outcome), '');
  v_note text := NULLIF(btrim(p_note), '');
  v_key text;
  v_fingerprint text;
  v_operation public.appointment_operations%ROWTYPE;
  v_job_snapshot public.appointment_reminder_jobs%ROWTYPE;
  v_before_job public.appointment_reminder_jobs%ROWTYPE;
  v_after_job public.appointment_reminder_jobs%ROWTYPE;
  v_appointment public.appointments%ROWTYPE;
  v_policy public.tenant_reminder_policies%ROWTYPE;
  v_confirmation_result jsonb;
  v_result_appointment jsonb;
  v_attempt jsonb;
  v_now timestamptz := transaction_timestamp();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Недостаточно прав для работы с очередью напоминаний.' USING ERRCODE = '42501';
  END IF;
  SELECT tu.role::text INTO v_actor_role
  FROM public.tenant_users tu
  WHERE tu.tenant_id = p_tenant_id AND tu.user_id = v_actor;
  IF v_actor_role IS NULL OR v_actor_role NOT IN ('clinic_owner', 'clinic_admin', 'registrar') THEN
    RAISE EXCEPTION 'Недостаточно прав для работы с очередью напоминаний.' USING ERRCODE = '42501';
  END IF;
  IF v_channel IS NULL OR v_channel NOT IN ('phone', 'whatsapp', 'sms', 'email', 'in_person', 'other') THEN
    RAISE EXCEPTION 'Выберите способ связи.' USING ERRCODE = '22023';
  END IF;
  IF v_outcome IS NULL OR v_outcome NOT IN (
    'confirmed', 'no_answer', 'unreachable', 'callback_requested',
    'declined', 'wrong_number', 'message_sent', 'other'
  ) THEN
    RAISE EXCEPTION 'Выберите результат связи.' USING ERRCODE = '22023';
  END IF;
  IF v_note IS NOT NULL AND length(v_note) > 2000 THEN
    RAISE EXCEPTION 'Не удалось сохранить действие. Обновите очередь и проверьте результат.' USING ERRCODE = '22023';
  END IF;
  IF p_expected_job_updated_at IS NULL OR p_expected_appointment_updated_at IS NULL THEN
    RETURN jsonb_build_object('errorCode', 'concurrent', 'errorMessage', 'Задача была изменена другим пользователем. Обновите очередь.');
  END IF;

  v_key := public.normalize_appointment_operation_key(p_operation_key);
  v_fingerprint := encode(extensions.digest(jsonb_build_object(
    'operationType', 'reminder_complete',
    'tenantId', p_tenant_id,
    'jobId', p_job_id,
    'expectedJobUpdatedEpoch', extract(epoch FROM p_expected_job_updated_at),
    'expectedAppointmentUpdatedEpoch', extract(epoch FROM p_expected_appointment_updated_at),
    'channel', v_channel,
    'outcome', v_outcome,
    'note', v_note
  )::text, 'sha256'), 'hex');

  PERFORM pg_advisory_xact_lock(hashtextextended('appointment-operation:' || p_tenant_id::text || ':' || v_key, 0));

  SELECT * INTO v_operation
  FROM public.appointment_operations ao
  WHERE ao.tenant_id = p_tenant_id AND ao.operation_key = v_key;
  IF FOUND THEN
    IF v_operation.operation_type <> 'reminder_complete' OR v_operation.fingerprint <> v_fingerprint THEN
      RAISE EXCEPTION 'Эта операция уже выполнена с другими параметрами.' USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object(
      'job', v_operation.result_reminder_job,
      'appointment', v_operation.result_appointment,
      'confirmationAttempt', v_operation.result_confirmation_attempt,
      'replayed', true,
      'recovered', false,
      'operationType', 'reminder_complete'
    );
  END IF;

  SELECT * INTO v_job_snapshot
  FROM public.appointment_reminder_jobs j
  WHERE j.tenant_id = p_tenant_id AND j.id = p_job_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Недостаточно прав для работы с очередью напоминаний.' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('appointment-reminder-job:' || p_tenant_id::text || ':' || p_job_id::text, 0));

  SELECT * INTO v_appointment
  FROM public.appointments a
  WHERE a.tenant_id = p_tenant_id AND a.id = v_job_snapshot.appointment_id
  FOR UPDATE;
  IF NOT FOUND OR v_appointment.patient_id IS DISTINCT FROM v_job_snapshot.patient_id THEN
    RAISE EXCEPTION 'Недостаточно прав для работы с очередью напоминаний.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_policy
  FROM public.tenant_reminder_policies p
  WHERE p.tenant_id = p_tenant_id
  FOR SHARE;

  SELECT * INTO v_before_job
  FROM public.appointment_reminder_jobs j
  WHERE j.tenant_id = p_tenant_id AND j.id = p_job_id
  FOR UPDATE;

  IF v_before_job.appointment_id IS DISTINCT FROM v_appointment.id
     OR v_before_job.patient_id IS DISTINCT FROM v_appointment.patient_id THEN
    RAISE EXCEPTION 'Недостаточно прав для работы с очередью напоминаний.' USING ERRCODE = '42501';
  END IF;
  IF v_appointment.updated_at IS DISTINCT FROM p_expected_appointment_updated_at
     OR v_before_job.appointment_updated_at IS DISTINCT FROM v_appointment.updated_at
     OR v_policy.policy_version IS DISTINCT FROM v_before_job.policy_version THEN
    RETURN jsonb_build_object('errorCode', 'stale', 'errorMessage', 'Задача устарела из-за изменения записи. Обновите очередь.');
  END IF;
  IF v_before_job.state = 'completed' THEN
    RAISE EXCEPTION 'Задача уже завершена.' USING ERRCODE = '55000';
  END IF;
  IF v_before_job.state NOT IN ('scheduled', 'ready') THEN
    RAISE EXCEPTION 'Эта задача больше не доступна для выполнения.' USING ERRCODE = '55000';
  END IF;
  IF v_before_job.updated_at IS DISTINCT FROM p_expected_job_updated_at THEN
    RETURN jsonb_build_object('errorCode', 'concurrent', 'errorMessage', 'Задача была изменена другим пользователем. Обновите очередь.');
  END IF;
  IF v_appointment.status NOT IN ('new', 'confirmed') OR v_appointment.patient_id IS NULL THEN
    RAISE EXCEPTION 'Эта задача больше не доступна для выполнения.' USING ERRCODE = '55000';
  END IF;
  IF v_before_job.due_at > v_now THEN
    RAISE EXCEPTION 'Задача ещё не наступила.' USING ERRCODE = '55000';
  END IF;

  PERFORM set_config('app.reminder_job_internal', 'on', true);
  UPDATE public.appointment_reminder_jobs
  SET state = 'completed',
      channel = v_channel,
      completed_at = v_now,
      completed_by = v_actor,
      completion_outcome = v_outcome,
      completion_note = v_note,
      confirmation_attempt_id = NULL,
      deferred_at = NULL,
      deferred_by = NULL,
      defer_reason = NULL,
      skipped_by = NULL,
      operation_key = v_key,
      operation_fingerprint = v_fingerprint,
      last_manual_action_at = v_now,
      terminal_reason = 'manual_completion_pending'
  WHERE tenant_id = p_tenant_id AND id = p_job_id
  RETURNING * INTO v_after_job;
  PERFORM set_config('app.reminder_job_internal', 'off', true);

  v_confirmation_result := public.apply_appointment_confirmation_attempt_internal(
    p_tenant_id, v_appointment.id, v_actor, v_actor_role,
    v_channel, v_outcome, v_note, p_expected_appointment_updated_at,
    v_key, v_fingerprint, true, 'reminder_manual_completion'
  );
  v_result_appointment := v_confirmation_result->'appointment';
  v_attempt := v_confirmation_result->'confirmationAttempt';

  PERFORM set_config('app.reminder_job_internal', 'on', true);
  UPDATE public.appointment_reminder_jobs
  SET confirmation_attempt_id = (v_attempt->>'id')::uuid,
      terminal_reason = 'manual_completed'
  WHERE tenant_id = p_tenant_id AND id = p_job_id
  RETURNING * INTO v_after_job;
  PERFORM set_config('app.reminder_job_internal', 'off', true);

  PERFORM public.record_appointment_reminder_manual_event_internal(
    v_after_job,
    'appointment_reminder_completed',
    v_actor,
    v_actor_role,
    jsonb_build_object('state', v_before_job.state, 'dueAt', v_before_job.due_at),
    jsonb_build_object(
      'state', v_after_job.state,
      'dueAt', v_after_job.due_at,
      'completedAt', v_after_job.completed_at,
      'completedBy', v_after_job.completed_by,
      'channel', v_channel,
      'outcome', v_outcome,
      'confirmationAttemptId', v_after_job.confirmation_attempt_id
    ),
    v_key,
    jsonb_build_object('channel', v_channel, 'outcome', v_outcome, 'confirmationAttemptId', v_after_job.confirmation_attempt_id)
  );

  INSERT INTO public.appointment_operations (
    tenant_id, operation_key, operation_type, fingerprint, appointment_id,
    patient_id, doctor_id, start_time, end_time, status,
    result_appointment, actor_user_id, confirmation_attempt_id, result_confirmation_attempt,
    reminder_job_id, result_reminder_job
  ) VALUES (
    p_tenant_id, v_key, 'reminder_complete', v_fingerprint, v_appointment.id,
    v_appointment.patient_id, v_appointment.doctor_id, v_appointment.start_time, v_appointment.end_time,
    v_result_appointment->>'status', v_result_appointment, v_actor,
    (v_attempt->>'id')::uuid, v_attempt, v_after_job.id,
    public.appointment_reminder_job_row_json(v_after_job)
  );

  RETURN jsonb_build_object(
    'job', public.appointment_reminder_job_row_json(v_after_job),
    'appointment', v_result_appointment,
    'confirmationAttempt', v_attempt,
    'replayed', false,
    'recovered', false,
    'operationType', 'reminder_complete'
  );
END;
$complete_reminder$;

CREATE OR REPLACE FUNCTION public.defer_appointment_reminder_job(
  p_tenant_id uuid,
  p_job_id uuid,
  p_new_due_at timestamptz,
  p_reason text,
  p_expected_job_updated_at timestamptz,
  p_expected_appointment_updated_at timestamptz,
  p_operation_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
SET timezone = 'UTC'
AS $defer_reminder$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_reason text := NULLIF(btrim(p_reason), '');
  v_key text;
  v_fingerprint text;
  v_operation public.appointment_operations%ROWTYPE;
  v_job_snapshot public.appointment_reminder_jobs%ROWTYPE;
  v_before_job public.appointment_reminder_jobs%ROWTYPE;
  v_after_job public.appointment_reminder_jobs%ROWTYPE;
  v_appointment public.appointments%ROWTYPE;
  v_policy public.tenant_reminder_policies%ROWTYPE;
  v_now timestamptz := transaction_timestamp();
  v_appointment_json jsonb;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Недостаточно прав для работы с очередью напоминаний.' USING ERRCODE = '42501';
  END IF;
  SELECT tu.role::text INTO v_actor_role FROM public.tenant_users tu
  WHERE tu.tenant_id = p_tenant_id AND tu.user_id = v_actor;
  IF v_actor_role IS NULL OR v_actor_role NOT IN ('clinic_owner', 'clinic_admin', 'registrar') THEN
    RAISE EXCEPTION 'Недостаточно прав для работы с очередью напоминаний.' USING ERRCODE = '42501';
  END IF;
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Укажите причину.' USING ERRCODE = '22023';
  END IF;
  IF length(v_reason) > 1000 THEN
    RAISE EXCEPTION 'Укажите причину.' USING ERRCODE = '22023';
  END IF;
  IF p_new_due_at IS NULL OR p_expected_job_updated_at IS NULL OR p_expected_appointment_updated_at IS NULL THEN
    RAISE EXCEPTION 'Новое время должно быть позже текущего момента и раньше записи.' USING ERRCODE = '22023';
  END IF;

  v_key := public.normalize_appointment_operation_key(p_operation_key);
  v_fingerprint := encode(extensions.digest(jsonb_build_object(
    'operationType', 'reminder_defer',
    'tenantId', p_tenant_id,
    'jobId', p_job_id,
    'newDueEpoch', extract(epoch FROM p_new_due_at),
    'reason', v_reason,
    'expectedJobUpdatedEpoch', extract(epoch FROM p_expected_job_updated_at),
    'expectedAppointmentUpdatedEpoch', extract(epoch FROM p_expected_appointment_updated_at)
  )::text, 'sha256'), 'hex');

  PERFORM pg_advisory_xact_lock(hashtextextended('appointment-operation:' || p_tenant_id::text || ':' || v_key, 0));
  SELECT * INTO v_operation FROM public.appointment_operations ao
  WHERE ao.tenant_id = p_tenant_id AND ao.operation_key = v_key;
  IF FOUND THEN
    IF v_operation.operation_type <> 'reminder_defer' OR v_operation.fingerprint <> v_fingerprint THEN
      RAISE EXCEPTION 'Эта операция уже выполнена с другими параметрами.' USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object(
      'job', v_operation.result_reminder_job,
      'appointment', v_operation.result_appointment,
      'confirmationAttempt', NULL,
      'replayed', true,
      'recovered', false,
      'operationType', 'reminder_defer'
    );
  END IF;

  SELECT * INTO v_job_snapshot FROM public.appointment_reminder_jobs j
  WHERE j.tenant_id = p_tenant_id AND j.id = p_job_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Недостаточно прав для работы с очередью напоминаний.' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('appointment-reminder-job:' || p_tenant_id::text || ':' || p_job_id::text, 0));

  SELECT * INTO v_appointment FROM public.appointments a
  WHERE a.tenant_id = p_tenant_id AND a.id = v_job_snapshot.appointment_id
  FOR UPDATE;
  IF NOT FOUND OR v_appointment.patient_id IS DISTINCT FROM v_job_snapshot.patient_id THEN
    RAISE EXCEPTION 'Недостаточно прав для работы с очередью напоминаний.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_policy FROM public.tenant_reminder_policies p
  WHERE p.tenant_id = p_tenant_id FOR SHARE;
  SELECT * INTO v_before_job FROM public.appointment_reminder_jobs j
  WHERE j.tenant_id = p_tenant_id AND j.id = p_job_id FOR UPDATE;

  IF v_before_job.appointment_id IS DISTINCT FROM v_appointment.id
     OR v_before_job.patient_id IS DISTINCT FROM v_appointment.patient_id THEN
    RAISE EXCEPTION 'Недостаточно прав для работы с очередью напоминаний.' USING ERRCODE = '42501';
  END IF;
  IF v_appointment.updated_at IS DISTINCT FROM p_expected_appointment_updated_at
     OR v_before_job.appointment_updated_at IS DISTINCT FROM v_appointment.updated_at
     OR v_policy.policy_version IS DISTINCT FROM v_before_job.policy_version THEN
    RETURN jsonb_build_object('errorCode', 'stale', 'errorMessage', 'Задача устарела из-за изменения записи. Обновите очередь.');
  END IF;
  IF v_before_job.state = 'completed' THEN
    RAISE EXCEPTION 'Задача уже завершена.' USING ERRCODE = '55000';
  END IF;
  IF v_before_job.state NOT IN ('scheduled', 'ready') THEN
    RAISE EXCEPTION 'Эта задача больше не доступна для выполнения.' USING ERRCODE = '55000';
  END IF;
  IF v_before_job.updated_at IS DISTINCT FROM p_expected_job_updated_at THEN
    RETURN jsonb_build_object('errorCode', 'concurrent', 'errorMessage', 'Задача была изменена другим пользователем. Обновите очередь.');
  END IF;
  IF v_appointment.status NOT IN ('new', 'confirmed') OR v_appointment.patient_id IS NULL THEN
    RAISE EXCEPTION 'Эта задача больше не доступна для выполнения.' USING ERRCODE = '55000';
  END IF;
  IF p_new_due_at <= v_now OR p_new_due_at >= v_appointment.start_time OR p_new_due_at = v_before_job.due_at THEN
    RAISE EXCEPTION 'Новое время должно быть позже текущего момента и раньше записи.' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('app.reminder_job_internal', 'on', true);
  UPDATE public.appointment_reminder_jobs
  SET due_at = p_new_due_at,
      state = 'scheduled',
      deferred_at = v_now,
      deferred_by = v_actor,
      defer_reason = v_reason,
      operation_key = v_key,
      operation_fingerprint = v_fingerprint,
      last_manual_action_at = v_now,
      metadata = metadata || jsonb_build_object(
        'manualDueOverride', true,
        'manualDueAt', p_new_due_at,
        'deferReason', v_reason
      )
  WHERE tenant_id = p_tenant_id AND id = p_job_id
  RETURNING * INTO v_after_job;
  PERFORM set_config('app.reminder_job_internal', 'off', true);

  v_appointment_json := public.appointment_row_json(v_appointment);
  PERFORM public.record_appointment_reminder_manual_event_internal(
    v_after_job,
    'appointment_reminder_deferred',
    v_actor,
    v_actor_role,
    jsonb_build_object('state', v_before_job.state, 'dueAt', v_before_job.due_at),
    jsonb_build_object('state', v_after_job.state, 'dueAt', v_after_job.due_at, 'deferredAt', v_after_job.deferred_at, 'deferredBy', v_after_job.deferred_by, 'reason', v_reason),
    v_key,
    jsonb_build_object('oldDueAt', v_before_job.due_at, 'newDueAt', v_after_job.due_at, 'reason', v_reason)
  );

  INSERT INTO public.appointment_operations (
    tenant_id, operation_key, operation_type, fingerprint, appointment_id,
    patient_id, doctor_id, start_time, end_time, status,
    result_appointment, actor_user_id, reminder_job_id, result_reminder_job
  ) VALUES (
    p_tenant_id, v_key, 'reminder_defer', v_fingerprint, v_appointment.id,
    v_appointment.patient_id, v_appointment.doctor_id, v_appointment.start_time, v_appointment.end_time,
    v_appointment.status, v_appointment_json, v_actor, v_after_job.id,
    public.appointment_reminder_job_row_json(v_after_job)
  );

  RETURN jsonb_build_object(
    'job', public.appointment_reminder_job_row_json(v_after_job),
    'appointment', v_appointment_json,
    'confirmationAttempt', NULL,
    'replayed', false,
    'recovered', false,
    'operationType', 'reminder_defer'
  );
END;
$defer_reminder$;

CREATE OR REPLACE FUNCTION public.skip_appointment_reminder_job(
  p_tenant_id uuid,
  p_job_id uuid,
  p_reason text,
  p_expected_job_updated_at timestamptz,
  p_expected_appointment_updated_at timestamptz,
  p_operation_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
SET timezone = 'UTC'
AS $skip_reminder$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_reason text := NULLIF(btrim(p_reason), '');
  v_key text;
  v_fingerprint text;
  v_operation public.appointment_operations%ROWTYPE;
  v_job_snapshot public.appointment_reminder_jobs%ROWTYPE;
  v_before_job public.appointment_reminder_jobs%ROWTYPE;
  v_after_job public.appointment_reminder_jobs%ROWTYPE;
  v_appointment public.appointments%ROWTYPE;
  v_policy public.tenant_reminder_policies%ROWTYPE;
  v_now timestamptz := transaction_timestamp();
  v_appointment_json jsonb;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Недостаточно прав для работы с очередью напоминаний.' USING ERRCODE = '42501';
  END IF;
  SELECT tu.role::text INTO v_actor_role FROM public.tenant_users tu
  WHERE tu.tenant_id = p_tenant_id AND tu.user_id = v_actor;
  IF v_actor_role IS NULL OR v_actor_role NOT IN ('clinic_owner', 'clinic_admin', 'registrar') THEN
    RAISE EXCEPTION 'Недостаточно прав для работы с очередью напоминаний.' USING ERRCODE = '42501';
  END IF;
  IF v_reason IS NULL OR length(v_reason) > 1000 THEN
    RAISE EXCEPTION 'Укажите причину.' USING ERRCODE = '22023';
  END IF;
  IF p_expected_job_updated_at IS NULL OR p_expected_appointment_updated_at IS NULL THEN
    RETURN jsonb_build_object('errorCode', 'concurrent', 'errorMessage', 'Задача была изменена другим пользователем. Обновите очередь.');
  END IF;

  v_key := public.normalize_appointment_operation_key(p_operation_key);
  v_fingerprint := encode(extensions.digest(jsonb_build_object(
    'operationType', 'reminder_skip',
    'tenantId', p_tenant_id,
    'jobId', p_job_id,
    'reason', v_reason,
    'expectedJobUpdatedEpoch', extract(epoch FROM p_expected_job_updated_at),
    'expectedAppointmentUpdatedEpoch', extract(epoch FROM p_expected_appointment_updated_at)
  )::text, 'sha256'), 'hex');

  PERFORM pg_advisory_xact_lock(hashtextextended('appointment-operation:' || p_tenant_id::text || ':' || v_key, 0));
  SELECT * INTO v_operation FROM public.appointment_operations ao
  WHERE ao.tenant_id = p_tenant_id AND ao.operation_key = v_key;
  IF FOUND THEN
    IF v_operation.operation_type <> 'reminder_skip' OR v_operation.fingerprint <> v_fingerprint THEN
      RAISE EXCEPTION 'Эта операция уже выполнена с другими параметрами.' USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object(
      'job', v_operation.result_reminder_job,
      'appointment', v_operation.result_appointment,
      'confirmationAttempt', NULL,
      'replayed', true,
      'recovered', false,
      'operationType', 'reminder_skip'
    );
  END IF;

  SELECT * INTO v_job_snapshot FROM public.appointment_reminder_jobs j
  WHERE j.tenant_id = p_tenant_id AND j.id = p_job_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Недостаточно прав для работы с очередью напоминаний.' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('appointment-reminder-job:' || p_tenant_id::text || ':' || p_job_id::text, 0));

  SELECT * INTO v_appointment FROM public.appointments a
  WHERE a.tenant_id = p_tenant_id AND a.id = v_job_snapshot.appointment_id
  FOR UPDATE;
  IF NOT FOUND OR v_appointment.patient_id IS DISTINCT FROM v_job_snapshot.patient_id THEN
    RAISE EXCEPTION 'Недостаточно прав для работы с очередью напоминаний.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_policy FROM public.tenant_reminder_policies p
  WHERE p.tenant_id = p_tenant_id FOR SHARE;
  SELECT * INTO v_before_job FROM public.appointment_reminder_jobs j
  WHERE j.tenant_id = p_tenant_id AND j.id = p_job_id FOR UPDATE;

  IF v_before_job.appointment_id IS DISTINCT FROM v_appointment.id
     OR v_before_job.patient_id IS DISTINCT FROM v_appointment.patient_id THEN
    RAISE EXCEPTION 'Недостаточно прав для работы с очередью напоминаний.' USING ERRCODE = '42501';
  END IF;
  IF v_appointment.updated_at IS DISTINCT FROM p_expected_appointment_updated_at
     OR v_before_job.appointment_updated_at IS DISTINCT FROM v_appointment.updated_at
     OR v_policy.policy_version IS DISTINCT FROM v_before_job.policy_version THEN
    RETURN jsonb_build_object('errorCode', 'stale', 'errorMessage', 'Задача устарела из-за изменения записи. Обновите очередь.');
  END IF;
  IF v_before_job.state = 'completed' THEN
    RAISE EXCEPTION 'Задача уже завершена.' USING ERRCODE = '55000';
  END IF;
  IF v_before_job.state NOT IN ('scheduled', 'ready') THEN
    RAISE EXCEPTION 'Эта задача больше не доступна для выполнения.' USING ERRCODE = '55000';
  END IF;
  IF v_before_job.updated_at IS DISTINCT FROM p_expected_job_updated_at THEN
    RETURN jsonb_build_object('errorCode', 'concurrent', 'errorMessage', 'Задача была изменена другим пользователем. Обновите очередь.');
  END IF;
  IF v_appointment.status NOT IN ('new', 'confirmed') OR v_appointment.patient_id IS NULL THEN
    RAISE EXCEPTION 'Эта задача больше не доступна для выполнения.' USING ERRCODE = '55000';
  END IF;

  PERFORM set_config('app.reminder_job_internal', 'on', true);
  UPDATE public.appointment_reminder_jobs
  SET state = 'skipped',
      skipped_at = v_now,
      skipped_by = v_actor,
      deferred_at = NULL,
      deferred_by = NULL,
      defer_reason = NULL,
      operation_key = v_key,
      operation_fingerprint = v_fingerprint,
      last_manual_action_at = v_now,
      terminal_reason = v_reason
  WHERE tenant_id = p_tenant_id AND id = p_job_id
  RETURNING * INTO v_after_job;
  PERFORM set_config('app.reminder_job_internal', 'off', true);

  v_appointment_json := public.appointment_row_json(v_appointment);
  PERFORM public.record_appointment_reminder_manual_event_internal(
    v_after_job,
    'appointment_reminder_skipped',
    v_actor,
    v_actor_role,
    jsonb_build_object('state', v_before_job.state, 'dueAt', v_before_job.due_at),
    jsonb_build_object('state', v_after_job.state, 'dueAt', v_after_job.due_at, 'skippedAt', v_after_job.skipped_at, 'skippedBy', v_after_job.skipped_by, 'reason', v_reason),
    v_key,
    jsonb_build_object('reason', v_reason)
  );

  INSERT INTO public.appointment_operations (
    tenant_id, operation_key, operation_type, fingerprint, appointment_id,
    patient_id, doctor_id, start_time, end_time, status,
    result_appointment, actor_user_id, reminder_job_id, result_reminder_job
  ) VALUES (
    p_tenant_id, v_key, 'reminder_skip', v_fingerprint, v_appointment.id,
    v_appointment.patient_id, v_appointment.doctor_id, v_appointment.start_time, v_appointment.end_time,
    v_appointment.status, v_appointment_json, v_actor, v_after_job.id,
    public.appointment_reminder_job_row_json(v_after_job)
  );

  RETURN jsonb_build_object(
    'job', public.appointment_reminder_job_row_json(v_after_job),
    'appointment', v_appointment_json,
    'confirmationAttempt', NULL,
    'replayed', false,
    'recovered', false,
    'operationType', 'reminder_skip'
  );
END;
$skip_reminder$;

CREATE OR REPLACE FUNCTION public.get_appointment_operation(
  p_tenant_id uuid,
  p_operation_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $get_operation$
DECLARE
  v_actor uuid := auth.uid();
  v_key text;
  v_operation public.appointment_operations%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.tenant_users tu
    WHERE tu.tenant_id = p_tenant_id AND tu.user_id = v_actor
  ) THEN
    RAISE EXCEPTION 'Недостаточно прав для изменения записи.' USING ERRCODE = '42501';
  END IF;

  v_key := public.normalize_appointment_operation_key(p_operation_key);
  SELECT * INTO v_operation FROM public.appointment_operations ao
  WHERE ao.tenant_id = p_tenant_id AND ao.operation_key = v_key;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'operationType', v_operation.operation_type,
    'appointment', v_operation.result_appointment,
    'confirmationAttempt', v_operation.result_confirmation_attempt,
    'reminderJob', v_operation.result_reminder_job,
    'replayed', true,
    'recovered', true
  );
END;
$get_operation$;

DROP TRIGGER IF EXISTS appointments_reconcile_reminders_after_change ON public.appointments;
CREATE TRIGGER appointments_reconcile_reminders_after_change
AFTER INSERT OR UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.reconcile_appointment_reminders_after_change();

REVOKE ALL ON FUNCTION public.set_appointment_reminder_original_due_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_appointment_reminder_manual_event_internal(public.appointment_reminder_jobs,text,uuid,text,jsonb,jsonb,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_appointment_confirmation_attempt_internal(uuid,uuid,uuid,text,text,text,text,timestamptz,text,text,boolean,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_appointment_confirmation_action(text,uuid,uuid,text,text,text,timestamptz,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_appointment_confirmation_attempt(uuid,uuid,text,text,text,timestamptz,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_appointment(uuid,uuid,text,text,timestamptz,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_appointment_reminder_job(uuid,uuid,text,text,text,timestamptz,timestamptz,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.defer_appointment_reminder_job(uuid,uuid,timestamptz,text,timestamptz,timestamptz,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.skip_appointment_reminder_job(uuid,uuid,text,timestamptz,timestamptz,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_appointment_operation(uuid,text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.record_appointment_confirmation_attempt(uuid,uuid,text,text,text,timestamptz,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_appointment(uuid,uuid,text,text,timestamptz,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_appointment_reminder_job(uuid,uuid,text,text,text,timestamptz,timestamptz,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.defer_appointment_reminder_job(uuid,uuid,timestamptz,text,timestamptz,timestamptz,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.skip_appointment_reminder_job(uuid,uuid,text,timestamptz,timestamptz,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_appointment_operation(uuid,text) TO authenticated, service_role;

COMMENT ON COLUMN public.appointment_reminder_jobs.channel IS 'Manual contact channel recorded by staff. It is not provider delivery.';
COMMENT ON COLUMN public.appointment_reminder_jobs.original_due_at IS 'Planner-produced due time before any manual defer override.';
COMMENT ON COLUMN public.appointment_reminder_jobs.operation_key IS 'Latest manual operation key; immutable operation history remains in appointment_operations.';
COMMENT ON FUNCTION public.complete_appointment_reminder_job(uuid,uuid,text,text,text,timestamptz,timestamptz,text) IS 'Atomically records one authoritative confirmation attempt and completes one due manual reminder job. Sends no message.';
COMMENT ON FUNCTION public.defer_appointment_reminder_job(uuid,uuid,timestamptz,text,timestamptz,timestamptz,text) IS 'Moves one active manual job to an explicit future due time while preserving its plan identity and original due time.';
COMMENT ON FUNCTION public.skip_appointment_reminder_job(uuid,uuid,text,timestamptz,timestamptz,text) IS 'Terminates one active manual reminder job with a required reason. Planner reuses the same skipped plan identity and does not recreate it unchanged.';
