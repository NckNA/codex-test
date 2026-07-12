-- 0029_appointment_reminder_queue_foundation.sql
-- Durable tenant-scoped appointment reminder planning. This migration sends no messages.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.appointments'::regclass
      AND conname = 'appointments_tenant_id_id_unique'
  ) THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_tenant_id_id_unique UNIQUE (tenant_id, id);
  END IF;
END;
$$;

CREATE TABLE public.tenant_reminder_policies (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  confirmation_request_enabled boolean NOT NULL DEFAULT true,
  repeat_confirmation_request boolean NOT NULL DEFAULT false,
  day_before_enabled boolean NOT NULL DEFAULT true,
  day_before_local_time time NOT NULL DEFAULT '12:00',
  reminder_after_confirmation boolean NOT NULL DEFAULT true,
  callback_task_enabled boolean NOT NULL DEFAULT true,
  control_call_enabled boolean NOT NULL DEFAULT true,
  control_call_offset_minutes integer NOT NULL DEFAULT 180,
  policy_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT tenant_reminder_policies_offset_check
    CHECK (control_call_offset_minutes BETWEEN 15 AND 10080),
  CONSTRAINT tenant_reminder_policies_version_check
    CHECK (policy_version >= 1)
);

CREATE TABLE public.appointment_reminder_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  reminder_type text NOT NULL,
  execution_mode text NOT NULL DEFAULT 'manual',
  channel text,
  due_at timestamptz NOT NULL,
  state text NOT NULL DEFAULT 'scheduled',
  appointment_updated_at timestamptz NOT NULL,
  policy_version integer NOT NULL,
  plan_key text NOT NULL,
  payload_fingerprint text NOT NULL,
  priority integer NOT NULL DEFAULT 100,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  superseded_at timestamptz,
  cancelled_at timestamptz,
  skipped_at timestamptz,
  completed_at timestamptz,
  terminal_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT appointment_reminder_jobs_appointment_fk
    FOREIGN KEY (tenant_id, appointment_id)
    REFERENCES public.appointments(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT appointment_reminder_jobs_patient_fk
    FOREIGN KEY (tenant_id, patient_id)
    REFERENCES public.patients(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT appointment_reminder_jobs_type_check
    CHECK (reminder_type IN (
      'confirmation_request',
      'day_before_reminder',
      'control_call_task',
      'callback_task'
    )),
  CONSTRAINT appointment_reminder_jobs_execution_mode_check
    CHECK (execution_mode = 'manual'),
  CONSTRAINT appointment_reminder_jobs_channel_check
    CHECK (channel IS NULL),
  CONSTRAINT appointment_reminder_jobs_state_check
    CHECK (state IN ('scheduled', 'ready', 'completed', 'cancelled', 'superseded', 'skipped')),
  CONSTRAINT appointment_reminder_jobs_policy_version_check
    CHECK (policy_version >= 1),
  CONSTRAINT appointment_reminder_jobs_plan_key_check
    CHECK (length(plan_key) = 64),
  CONSTRAINT appointment_reminder_jobs_fingerprint_check
    CHECK (length(payload_fingerprint) = 64),
  CONSTRAINT appointment_reminder_jobs_priority_check
    CHECK (priority BETWEEN 1 AND 1000),
  CONSTRAINT appointment_reminder_jobs_metadata_check
    CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT appointment_reminder_jobs_terminal_fields_check
    CHECK (
      (state = 'superseded' AND superseded_at IS NOT NULL AND cancelled_at IS NULL AND skipped_at IS NULL AND completed_at IS NULL)
      OR (state = 'cancelled' AND cancelled_at IS NOT NULL AND superseded_at IS NULL AND skipped_at IS NULL AND completed_at IS NULL)
      OR (state = 'skipped' AND skipped_at IS NOT NULL AND superseded_at IS NULL AND cancelled_at IS NULL AND completed_at IS NULL)
      OR (state = 'completed' AND completed_at IS NOT NULL AND superseded_at IS NULL AND cancelled_at IS NULL AND skipped_at IS NULL)
      OR (state IN ('scheduled', 'ready') AND superseded_at IS NULL AND cancelled_at IS NULL AND skipped_at IS NULL AND completed_at IS NULL)
    ),
  CONSTRAINT appointment_reminder_jobs_terminal_reason_check
    CHECK (
      (state IN ('scheduled', 'ready') AND terminal_reason IS NULL)
      OR (state IN ('completed', 'cancelled', 'superseded', 'skipped') AND terminal_reason IS NOT NULL AND length(btrim(terminal_reason)) > 0)
    ),
  CONSTRAINT appointment_reminder_jobs_tenant_plan_key_key UNIQUE (tenant_id, plan_key)
);

CREATE INDEX idx_appointment_reminder_jobs_operational
  ON public.appointment_reminder_jobs (tenant_id, state, due_at, priority, created_at, id);
CREATE INDEX idx_appointment_reminder_jobs_appointment
  ON public.appointment_reminder_jobs (tenant_id, appointment_id, created_at, id);
CREATE INDEX idx_appointment_reminder_jobs_patient
  ON public.appointment_reminder_jobs (tenant_id, patient_id, due_at, id);
CREATE INDEX idx_appointment_reminder_jobs_active
  ON public.appointment_reminder_jobs (tenant_id, due_at, priority, id)
  WHERE state IN ('scheduled', 'ready');

ALTER TABLE public.tenant_reminder_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_reminder_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Schedule operators can read reminder policy"
  ON public.tenant_reminder_policies
  FOR SELECT TO authenticated
  USING (public.has_tenant_role(
    tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role, 'registrar'::public.app_role]
  ));

CREATE POLICY "Schedule operators can read reminder jobs"
  ON public.appointment_reminder_jobs
  FOR SELECT TO authenticated
  USING (public.has_tenant_role(
    tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role, 'registrar'::public.app_role]
  ));

REVOKE ALL ON TABLE public.tenant_reminder_policies FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.tenant_reminder_policies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tenant_reminder_policies TO service_role;

REVOKE ALL ON TABLE public.appointment_reminder_jobs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.appointment_reminder_jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.appointment_reminder_jobs TO service_role;

CREATE OR REPLACE FUNCTION public.ensure_tenant_reminder_policy_internal(p_tenant_id uuid)
RETURNS public.tenant_reminder_policies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_policy public.tenant_reminder_policies%ROWTYPE;
BEGIN
  PERFORM set_config('app.reminder_policy_internal', 'on', true);
  INSERT INTO public.tenant_reminder_policies (tenant_id)
  VALUES (p_tenant_id)
  ON CONFLICT (tenant_id) DO NOTHING;
  PERFORM set_config('app.reminder_policy_internal', 'off', true);

  SELECT * INTO v_policy
  FROM public.tenant_reminder_policies
  WHERE tenant_id = p_tenant_id;

  RETURN v_policy;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_tenant_reminder_policy_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;
  IF current_user IN ('postgres', 'service_role') THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF COALESCE(current_setting('app.reminder_policy_internal', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Недостаточно прав для изменения политики напоминаний.' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tenant_reminder_policies_write_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.tenant_reminder_policies
FOR EACH ROW EXECUTE FUNCTION public.guard_tenant_reminder_policy_write();

CREATE OR REPLACE FUNCTION public.guard_appointment_reminder_job_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;
  IF current_user IN ('postgres', 'service_role') THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;
  IF COALESCE(current_setting('app.reminder_job_internal', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Недостаточно прав для изменения очереди напоминаний.' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER appointment_reminder_jobs_write_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.appointment_reminder_jobs
FOR EACH ROW EXECUTE FUNCTION public.guard_appointment_reminder_job_write();

CREATE OR REPLACE FUNCTION public.create_default_tenant_reminder_policy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
BEGIN
  PERFORM public.ensure_tenant_reminder_policy_internal(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER tenants_create_default_reminder_policy
AFTER INSERT ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.create_default_tenant_reminder_policy();

SELECT set_config('app.reminder_policy_internal', 'on', true);
INSERT INTO public.tenant_reminder_policies (tenant_id)
SELECT id FROM public.tenants
ON CONFLICT (tenant_id) DO NOTHING;
SELECT set_config('app.reminder_policy_internal', 'off', true);

CREATE OR REPLACE FUNCTION public.appointment_reminder_job_row_json(p_job public.appointment_reminder_jobs)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_catalog, pg_temp
AS $$
  SELECT jsonb_build_object(
    'id', p_job.id,
    'tenantId', p_job.tenant_id,
    'appointmentId', p_job.appointment_id,
    'patientId', p_job.patient_id,
    'reminderType', p_job.reminder_type,
    'executionMode', p_job.execution_mode,
    'channel', p_job.channel,
    'dueAt', p_job.due_at,
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
    'terminalReason', p_job.terminal_reason,
    'metadata', p_job.metadata,
    'operationalState', CASE
      WHEN p_job.state = 'scheduled' AND p_job.due_at <= now() THEN 'ready'
      ELSE p_job.state
    END
  );
$$;

CREATE OR REPLACE FUNCTION public.record_appointment_reminder_transition_internal(
  p_job public.appointment_reminder_jobs,
  p_action text,
  p_previous_state text,
  p_new_state text,
  p_actor uuid,
  p_source text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_role text;
  v_audit_id uuid;
BEGIN
  SELECT tu.role::text INTO v_role
  FROM public.tenant_users tu
  WHERE tu.tenant_id = p_job.tenant_id AND tu.user_id = p_actor;

  v_audit_id := public.record_audit_event_internal(
    p_tenant_id => p_job.tenant_id,
    p_action => p_action,
    p_category => 'appointment',
    p_target_type => 'appointment_reminder_job',
    p_target_id => p_job.id::text,
    p_actor_user_id => p_actor,
    p_actor_tenant_role => v_role,
    p_patient_id => p_job.patient_id,
    p_appointment_id => p_job.appointment_id::text,
    p_before_data => jsonb_build_object('state', p_previous_state),
    p_after_data => jsonb_build_object(
      'state', p_new_state,
      'reminderType', p_job.reminder_type,
      'dueAt', p_job.due_at,
      'appointmentUpdatedAt', p_job.appointment_updated_at,
      'policyVersion', p_job.policy_version
    ),
    p_diff_data => jsonb_build_object('state', jsonb_build_object('from', p_previous_state, 'to', p_new_state)),
    p_redaction_level => 'standard',
    p_metadata => jsonb_build_object(
      'jobId', p_job.id,
      'planKey', p_job.plan_key,
      'source', p_source,
      'executionMode', p_job.execution_mode
    )
  );

  PERFORM public.record_activity_event_internal(
    p_tenant_id => p_job.tenant_id,
    p_category => 'appointment',
    p_type => p_action,
    p_title => CASE p_action
      WHEN 'appointment_reminder_planned' THEN 'Запланирована задача напоминания'
      WHEN 'appointment_reminder_superseded' THEN 'Устаревшая задача напоминания заменена'
      WHEN 'appointment_reminder_cancelled' THEN 'Задача напоминания отменена'
      WHEN 'appointment_reminder_skipped' THEN 'Задача напоминания пропущена'
      ELSE 'Изменена задача напоминания'
    END,
    p_source_type => 'appointment_reminder_job',
    p_source_id => p_job.id::text,
    p_patient_id => p_job.patient_id,
    p_audit_event_id => v_audit_id,
    p_actor_user_id => p_actor,
    p_visibility => 'admin',
    p_metadata => jsonb_build_object(
      'appointmentId', p_job.appointment_id,
      'reminderType', p_job.reminder_type,
      'dueAt', p_job.due_at,
      'state', p_new_state,
      'source', p_source
    )
  );
END;
$$;

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
AS $$
DECLARE
  v_job public.appointment_reminder_jobs%ROWTYPE;
  v_count integer := 0;
  v_action text;
  v_rows jsonb := '[]'::jsonb;
BEGIN
  IF p_target_state NOT IN ('cancelled', 'superseded', 'skipped') THEN
    RAISE EXCEPTION 'Unsupported reminder transition state';
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
        completed_at = NULL,
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
$$;

CREATE OR REPLACE FUNCTION public.reconcile_appointment_reminders_after_visit_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $visit$
DECLARE
  v_reason text;
BEGIN
  IF NEW.appointment_id IS NULL OR NEW.status NOT IN ('checked_in', 'in_progress', 'completed') THEN
    RETURN NEW;
  END IF;

  v_reason := CASE NEW.status
    WHEN 'checked_in' THEN 'appointment_arrived'
    WHEN 'in_progress' THEN 'appointment_in_progress'
    ELSE 'appointment_completed'
  END;

  PERFORM public.transition_active_appointment_reminder_jobs_internal(
    NEW.tenant_id,
    NEW.appointment_id,
    'skipped',
    v_reason,
    auth.uid(),
    'patient_visit_lifecycle_trigger'
  );

  RETURN NEW;
END;
$visit$;

CREATE TRIGGER patient_visits_reconcile_reminders_after_status
AFTER INSERT OR UPDATE OF status ON public.patient_visits
FOR EACH ROW EXECUTE FUNCTION public.reconcile_appointment_reminders_after_visit_change();

CREATE OR REPLACE FUNCTION public.plan_appointment_reminder_jobs_internal(
  p_tenant_id uuid,
  p_appointment_id uuid,
  p_reference_time timestamptz DEFAULT now(),
  p_actor uuid DEFAULT auth.uid(),
  p_source text DEFAULT 'internal'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_appointment public.appointments%ROWTYPE;
  v_policy public.tenant_reminder_policies%ROWTYPE;
  v_timezone text;
  v_confirmation_state text;
  v_effective_confirmed boolean;
  v_due_local timestamp;
  v_due_at timestamptz;
  v_control_due timestamptz;
  v_plan_key text;
  v_fingerprint text;
  v_desired jsonb := '[]'::jsonb;
  v_desired_item jsonb;
  v_desired_keys text[] := ARRAY[]::text[];
  v_job public.appointment_reminder_jobs%ROWTYPE;
  v_created jsonb := '[]'::jsonb;
  v_reused jsonb := '[]'::jsonb;
  v_superseded jsonb := '[]'::jsonb;
  v_cancelled jsonb := '[]'::jsonb;
  v_skipped jsonb := '[]'::jsonb;
  v_transition jsonb;
  v_reason text;
  v_target_state text;
  v_type text;
  v_priority integer;
  v_metadata jsonb;
BEGIN
  IF p_reference_time IS NULL THEN
    RAISE EXCEPTION 'Укажите контрольное время планирования.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_appointment
  FROM public.appointments
  WHERE tenant_id = p_tenant_id AND id = p_appointment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Запись не найдена.' USING ERRCODE = 'P0002';
  END IF;

  SELECT t.timezone INTO v_timezone
  FROM public.tenants t
  WHERE t.id = p_tenant_id;

  IF NOT public.is_valid_iana_timezone(v_timezone) THEN
    RAISE EXCEPTION 'Укажите корректный часовой пояс клиники.' USING ERRCODE = '22023';
  END IF;

  PERFORM public.ensure_tenant_reminder_policy_internal(p_tenant_id);
  SELECT * INTO v_policy
  FROM public.tenant_reminder_policies
  WHERE tenant_id = p_tenant_id
  FOR SHARE;

  v_confirmation_state := COALESCE(v_appointment.confirmation_state, 'unconfirmed');
  v_effective_confirmed := v_appointment.status = 'confirmed' OR v_confirmation_state = 'confirmed';

  IF NOT v_policy.enabled THEN
    v_transition := public.transition_active_appointment_reminder_jobs_internal(
      p_tenant_id, p_appointment_id, 'cancelled', 'policy_disabled', p_actor, p_source
    );
    RETURN jsonb_build_object(
      'created', '[]'::jsonb,
      'reused', '[]'::jsonb,
      'superseded', '[]'::jsonb,
      'cancelled', v_transition->'jobs',
      'skipped', '[]'::jsonb,
      'desired', '[]'::jsonb,
      'appointmentVersion', v_appointment.updated_at,
      'policyVersion', v_policy.policy_version,
      'policyEnabled', false,
      'callbackDeferred', v_confirmation_state = 'callback_requested'
    );
  END IF;

  IF v_appointment.status IN ('cancelled', 'no_show') THEN
    v_reason := CASE v_appointment.status WHEN 'cancelled' THEN 'appointment_cancelled' ELSE 'appointment_no_show' END;
    v_transition := public.transition_active_appointment_reminder_jobs_internal(
      p_tenant_id, p_appointment_id, 'cancelled', v_reason, p_actor, p_source
    );
    RETURN jsonb_build_object(
      'created', '[]'::jsonb, 'reused', '[]'::jsonb, 'superseded', '[]'::jsonb,
      'cancelled', v_transition->'jobs', 'skipped', '[]'::jsonb, 'desired', '[]'::jsonb,
      'appointmentVersion', v_appointment.updated_at, 'policyVersion', v_policy.policy_version,
      'policyEnabled', true, 'callbackDeferred', false
    );
  END IF;

  IF v_appointment.patient_id IS NULL
     OR v_appointment.status IN ('arrived', 'in_progress', 'completed', 'blocked')
     OR v_appointment.start_time <= p_reference_time THEN
    v_reason := CASE
      WHEN v_appointment.patient_id IS NULL THEN 'patient_missing'
      WHEN v_appointment.status = 'arrived' THEN 'appointment_arrived'
      WHEN v_appointment.status = 'in_progress' THEN 'appointment_in_progress'
      WHEN v_appointment.status = 'completed' THEN 'appointment_completed'
      WHEN v_appointment.status = 'blocked' THEN 'appointment_blocked'
      ELSE 'appointment_started_or_past'
    END;
    v_transition := public.transition_active_appointment_reminder_jobs_internal(
      p_tenant_id, p_appointment_id, 'skipped', v_reason, p_actor, p_source
    );
    RETURN jsonb_build_object(
      'created', '[]'::jsonb, 'reused', '[]'::jsonb, 'superseded', '[]'::jsonb,
      'cancelled', '[]'::jsonb, 'skipped', v_transition->'jobs', 'desired', '[]'::jsonb,
      'appointmentVersion', v_appointment.updated_at, 'policyVersion', v_policy.policy_version,
      'policyEnabled', true, 'callbackDeferred', false
    );
  END IF;

  -- Callback requests need an explicit callback timestamp. The current model has none, so no timestamp is invented.
  IF v_confirmation_state = 'callback_requested' THEN
    v_transition := public.transition_active_appointment_reminder_jobs_internal(
      p_tenant_id, p_appointment_id, 'superseded', 'callback_time_required', p_actor, p_source
    );
    RETURN jsonb_build_object(
      'created', '[]'::jsonb, 'reused', '[]'::jsonb, 'superseded', v_transition->'jobs',
      'cancelled', '[]'::jsonb, 'skipped', '[]'::jsonb, 'desired', '[]'::jsonb,
      'appointmentVersion', v_appointment.updated_at, 'policyVersion', v_policy.policy_version,
      'policyEnabled', true, 'callbackDeferred', v_policy.callback_task_enabled
    );
  END IF;

  -- Day-before local timestamp. PostgreSQL selects the standard-time occurrence for an ambiguous fall-back wall time.
  v_due_local := (((v_appointment.start_time AT TIME ZONE v_timezone)::date - 1) + v_policy.day_before_local_time)::timestamp;
  v_due_at := v_due_local AT TIME ZONE v_timezone;
  IF (v_due_at AT TIME ZONE v_timezone) IS DISTINCT FROM v_due_local THEN
    RAISE EXCEPTION 'Настроенное локальное время напоминания не существует в часовом поясе клиники.' USING ERRCODE = '22023';
  END IF;
  v_control_due := v_appointment.start_time - make_interval(mins => v_policy.control_call_offset_minutes);

  IF v_policy.confirmation_request_enabled
     AND NOT v_effective_confirmed
     AND (
       v_confirmation_state = 'unconfirmed'
       OR (v_confirmation_state = 'contact_in_progress' AND v_policy.repeat_confirmation_request)
     ) THEN
    v_type := 'confirmation_request';
    v_priority := 60;
    v_plan_key := encode(extensions.digest(concat_ws('|', p_tenant_id, p_appointment_id, v_type, v_due_at, v_appointment.updated_at, v_policy.policy_version), 'sha256'), 'hex');
    v_fingerprint := encode(extensions.digest(concat_ws('|', p_tenant_id, p_appointment_id, v_appointment.patient_id, v_type, 'manual', v_due_at, v_appointment.updated_at, v_policy.policy_version, v_confirmation_state, v_appointment.status), 'sha256'), 'hex');
    v_metadata := jsonb_build_object('tenantTimezone', v_timezone, 'policyKind', 'day_before_local_time');
    v_desired := v_desired || jsonb_build_array(jsonb_build_object('reminderType', v_type, 'dueAt', v_due_at, 'priority', v_priority, 'planKey', v_plan_key, 'payloadFingerprint', v_fingerprint, 'metadata', v_metadata));
    v_desired_keys := array_append(v_desired_keys, v_plan_key);
  END IF;

  IF v_policy.day_before_enabled
     AND (NOT v_effective_confirmed OR v_policy.reminder_after_confirmation)
     AND v_confirmation_state <> 'unreachable' THEN
    v_type := 'day_before_reminder';
    v_priority := 80;
    v_plan_key := encode(extensions.digest(concat_ws('|', p_tenant_id, p_appointment_id, v_type, v_due_at, v_appointment.updated_at, v_policy.policy_version), 'sha256'), 'hex');
    v_fingerprint := encode(extensions.digest(concat_ws('|', p_tenant_id, p_appointment_id, v_appointment.patient_id, v_type, 'manual', v_due_at, v_appointment.updated_at, v_policy.policy_version, v_confirmation_state, v_appointment.status), 'sha256'), 'hex');
    v_metadata := jsonb_build_object('tenantTimezone', v_timezone, 'policyKind', 'day_before_local_time');
    v_desired := v_desired || jsonb_build_array(jsonb_build_object('reminderType', v_type, 'dueAt', v_due_at, 'priority', v_priority, 'planKey', v_plan_key, 'payloadFingerprint', v_fingerprint, 'metadata', v_metadata));
    v_desired_keys := array_append(v_desired_keys, v_plan_key);
  END IF;

  IF v_policy.control_call_enabled
     AND NOT v_effective_confirmed
     AND v_confirmation_state IN ('unconfirmed', 'contact_in_progress', 'unreachable') THEN
    v_type := 'control_call_task';
    v_priority := 40;
    v_plan_key := encode(extensions.digest(concat_ws('|', p_tenant_id, p_appointment_id, v_type, v_control_due, v_appointment.updated_at, v_policy.policy_version), 'sha256'), 'hex');
    v_fingerprint := encode(extensions.digest(concat_ws('|', p_tenant_id, p_appointment_id, v_appointment.patient_id, v_type, 'manual', v_control_due, v_appointment.updated_at, v_policy.policy_version, v_confirmation_state, v_appointment.status), 'sha256'), 'hex');
    v_metadata := jsonb_build_object('tenantTimezone', v_timezone, 'policyKind', 'appointment_offset', 'offsetMinutes', v_policy.control_call_offset_minutes);
    v_desired := v_desired || jsonb_build_array(jsonb_build_object('reminderType', v_type, 'dueAt', v_control_due, 'priority', v_priority, 'planKey', v_plan_key, 'payloadFingerprint', v_fingerprint, 'metadata', v_metadata));
    v_desired_keys := array_append(v_desired_keys, v_plan_key);
  END IF;

  FOR v_job IN
    SELECT * FROM public.appointment_reminder_jobs
    WHERE tenant_id = p_tenant_id
      AND appointment_id = p_appointment_id
      AND state IN ('scheduled', 'ready')
      AND NOT (plan_key = ANY(v_desired_keys))
    ORDER BY due_at, priority, created_at, id
    FOR UPDATE
  LOOP
    PERFORM set_config('app.reminder_job_internal', 'on', true);
    UPDATE public.appointment_reminder_jobs
    SET state = 'superseded', superseded_at = now(), terminal_reason = 'plan_changed'
    WHERE id = v_job.id
    RETURNING * INTO v_job;
    PERFORM set_config('app.reminder_job_internal', 'off', true);
    PERFORM public.record_appointment_reminder_transition_internal(v_job, 'appointment_reminder_superseded', 'scheduled', 'superseded', p_actor, p_source);
    v_superseded := v_superseded || jsonb_build_array(public.appointment_reminder_job_row_json(v_job));
  END LOOP;

  FOR v_desired_item IN SELECT value FROM jsonb_array_elements(v_desired)
  LOOP
    SELECT * INTO v_job
    FROM public.appointment_reminder_jobs
    WHERE tenant_id = p_tenant_id AND plan_key = v_desired_item->>'planKey';

    IF FOUND THEN
      v_reused := v_reused || jsonb_build_array(public.appointment_reminder_job_row_json(v_job));
    ELSE
      PERFORM set_config('app.reminder_job_internal', 'on', true);
      INSERT INTO public.appointment_reminder_jobs (
        tenant_id, appointment_id, patient_id, reminder_type, execution_mode, channel,
        due_at, state, appointment_updated_at, policy_version, plan_key,
        payload_fingerprint, priority, created_by, metadata
      ) VALUES (
        p_tenant_id,
        p_appointment_id,
        v_appointment.patient_id,
        v_desired_item->>'reminderType',
        'manual',
        NULL,
        (v_desired_item->>'dueAt')::timestamptz,
        'scheduled',
        v_appointment.updated_at,
        v_policy.policy_version,
        v_desired_item->>'planKey',
        v_desired_item->>'payloadFingerprint',
        (v_desired_item->>'priority')::integer,
        p_actor,
        COALESCE(v_desired_item->'metadata', '{}'::jsonb)
      ) RETURNING * INTO v_job;
      PERFORM set_config('app.reminder_job_internal', 'off', true);
      PERFORM public.record_appointment_reminder_transition_internal(v_job, 'appointment_reminder_planned', NULL, 'scheduled', p_actor, p_source);
      v_created := v_created || jsonb_build_array(public.appointment_reminder_job_row_json(v_job));
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'created', v_created,
    'reused', v_reused,
    'superseded', v_superseded,
    'cancelled', v_cancelled,
    'skipped', v_skipped,
    'desired', v_desired,
    'appointmentVersion', v_appointment.updated_at,
    'policyVersion', v_policy.policy_version,
    'policyEnabled', true,
    'callbackDeferred', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.plan_appointment_reminder_jobs(
  p_tenant_id uuid,
  p_appointment_id uuid,
  p_reference_time timestamptz DEFAULT now()
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role public.app_role;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Недостаточно прав для планирования напоминаний.' USING ERRCODE = '42501';
  END IF;
  SELECT tu.role INTO v_role
  FROM public.tenant_users tu
  WHERE tu.tenant_id = p_tenant_id AND tu.user_id = v_actor;
  IF v_role IS NULL OR v_role NOT IN ('clinic_owner'::public.app_role, 'clinic_admin'::public.app_role, 'registrar'::public.app_role) THEN
    RAISE EXCEPTION 'Недостаточно прав для планирования напоминаний.' USING ERRCODE = '42501';
  END IF;
  RETURN public.plan_appointment_reminder_jobs_internal(p_tenant_id, p_appointment_id, p_reference_time, v_actor, 'appointment_planner_rpc');
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_tenant_appointment_reminders(
  p_tenant_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_limit integer DEFAULT 100,
  p_reference_time timestamptz DEFAULT now()
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role public.app_role;
  v_row record;
  v_result jsonb;
  v_processed integer := 0;
  v_created integer := 0;
  v_reused integer := 0;
  v_superseded integer := 0;
  v_cancelled integer := 0;
  v_skipped integer := 0;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Недостаточно прав для сверки напоминаний.' USING ERRCODE = '42501';
  END IF;
  SELECT tu.role INTO v_role FROM public.tenant_users tu
  WHERE tu.tenant_id = p_tenant_id AND tu.user_id = v_actor;
  IF v_role IS NULL OR v_role NOT IN ('clinic_owner'::public.app_role, 'clinic_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Недостаточно прав для сверки напоминаний.' USING ERRCODE = '42501';
  END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_to <= p_from OR p_to - p_from > interval '90 days' THEN
    RAISE EXCEPTION 'Укажите корректный ограниченный период сверки.' USING ERRCODE = '22023';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 500 THEN
    RAISE EXCEPTION 'Лимит сверки должен быть от 1 до 500.' USING ERRCODE = '22023';
  END IF;

  FOR v_row IN
    SELECT a.id
    FROM public.appointments a
    WHERE a.tenant_id = p_tenant_id
      AND a.start_time >= p_from
      AND a.start_time < p_to
    ORDER BY a.start_time, a.id
    LIMIT p_limit
  LOOP
    v_result := public.plan_appointment_reminder_jobs_internal(p_tenant_id, v_row.id, p_reference_time, v_actor, 'tenant_reconciliation_rpc');
    v_processed := v_processed + 1;
    v_created := v_created + jsonb_array_length(v_result->'created');
    v_reused := v_reused + jsonb_array_length(v_result->'reused');
    v_superseded := v_superseded + jsonb_array_length(v_result->'superseded');
    v_cancelled := v_cancelled + jsonb_array_length(v_result->'cancelled');
    v_skipped := v_skipped + jsonb_array_length(v_result->'skipped');
  END LOOP;

  RETURN jsonb_build_object(
    'processed', v_processed,
    'created', v_created,
    'reused', v_reused,
    'superseded', v_superseded,
    'cancelled', v_cancelled,
    'skipped', v_skipped
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_tenant_reminder_policy(
  p_tenant_id uuid,
  p_enabled boolean,
  p_confirmation_request_enabled boolean DEFAULT true,
  p_repeat_confirmation_request boolean DEFAULT false,
  p_day_before_enabled boolean DEFAULT true,
  p_day_before_local_time time DEFAULT '12:00',
  p_reminder_after_confirmation boolean DEFAULT true,
  p_callback_task_enabled boolean DEFAULT true,
  p_control_call_enabled boolean DEFAULT true,
  p_control_call_offset_minutes integer DEFAULT 180
) RETURNS public.tenant_reminder_policies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role public.app_role;
  v_before public.tenant_reminder_policies%ROWTYPE;
  v_after public.tenant_reminder_policies%ROWTYPE;
  v_changed boolean;
  v_audit_id uuid;
  v_appointment_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Недостаточно прав для изменения политики напоминаний.' USING ERRCODE = '42501';
  END IF;
  SELECT tu.role INTO v_role FROM public.tenant_users tu
  WHERE tu.tenant_id = p_tenant_id AND tu.user_id = v_actor;
  IF v_role IS NULL OR v_role NOT IN ('clinic_owner'::public.app_role, 'clinic_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Недостаточно прав для изменения политики напоминаний.' USING ERRCODE = '42501';
  END IF;
  IF p_control_call_offset_minutes NOT BETWEEN 15 AND 10080 THEN
    RAISE EXCEPTION 'Смещение контрольного звонка должно быть от 15 до 10080 минут.' USING ERRCODE = '22023';
  END IF;
  IF p_day_before_local_time IS NULL THEN
    RAISE EXCEPTION 'Укажите локальное время напоминания.' USING ERRCODE = '22023';
  END IF;

  PERFORM public.ensure_tenant_reminder_policy_internal(p_tenant_id);
  SELECT * INTO v_before FROM public.tenant_reminder_policies WHERE tenant_id = p_tenant_id FOR UPDATE;

  v_changed := ROW(
    v_before.enabled,
    v_before.confirmation_request_enabled,
    v_before.repeat_confirmation_request,
    v_before.day_before_enabled,
    v_before.day_before_local_time,
    v_before.reminder_after_confirmation,
    v_before.callback_task_enabled,
    v_before.control_call_enabled,
    v_before.control_call_offset_minutes
  ) IS DISTINCT FROM ROW(
    p_enabled,
    p_confirmation_request_enabled,
    p_repeat_confirmation_request,
    p_day_before_enabled,
    p_day_before_local_time,
    p_reminder_after_confirmation,
    p_callback_task_enabled,
    p_control_call_enabled,
    p_control_call_offset_minutes
  );

  IF NOT v_changed THEN RETURN v_before; END IF;

  PERFORM set_config('app.reminder_policy_internal', 'on', true);
  UPDATE public.tenant_reminder_policies
  SET enabled = p_enabled,
      confirmation_request_enabled = p_confirmation_request_enabled,
      repeat_confirmation_request = p_repeat_confirmation_request,
      day_before_enabled = p_day_before_enabled,
      day_before_local_time = p_day_before_local_time,
      reminder_after_confirmation = p_reminder_after_confirmation,
      callback_task_enabled = p_callback_task_enabled,
      control_call_enabled = p_control_call_enabled,
      control_call_offset_minutes = p_control_call_offset_minutes,
      policy_version = policy_version + 1,
      updated_at = now(),
      updated_by = v_actor
  WHERE tenant_id = p_tenant_id
  RETURNING * INTO v_after;
  PERFORM set_config('app.reminder_policy_internal', 'off', true);

  FOR v_appointment_id IN
    SELECT DISTINCT j.appointment_id
    FROM public.appointment_reminder_jobs j
    WHERE j.tenant_id = p_tenant_id
      AND j.state IN ('scheduled', 'ready')
    ORDER BY j.appointment_id
  LOOP
    PERFORM public.transition_active_appointment_reminder_jobs_internal(
      p_tenant_id,
      v_appointment_id,
      'superseded',
      'policy_changed',
      v_actor,
      'set_tenant_reminder_policy'
    );
  END LOOP;

  v_audit_id := public.record_audit_event_internal(
    p_tenant_id => p_tenant_id,
    p_action => 'tenant_reminder_policy_changed',
    p_category => 'tenant',
    p_target_type => 'tenant_reminder_policy',
    p_target_id => p_tenant_id::text,
    p_actor_user_id => v_actor,
    p_actor_tenant_role => v_role::text,
    p_before_data => to_jsonb(v_before) - 'created_at' - 'updated_at' - 'updated_by',
    p_after_data => to_jsonb(v_after) - 'created_at' - 'updated_at' - 'updated_by',
    p_redaction_level => 'none',
    p_metadata => jsonb_build_object('source', 'set_tenant_reminder_policy')
  );
  PERFORM public.record_activity_event_internal(
    p_tenant_id => p_tenant_id,
    p_category => 'system',
    p_type => 'tenant_reminder_policy_changed',
    p_title => 'Изменена политика напоминаний',
    p_source_type => 'tenant_reminder_policy',
    p_source_id => p_tenant_id::text,
    p_audit_event_id => v_audit_id,
    p_actor_user_id => v_actor,
    p_visibility => 'admin',
    p_metadata => jsonb_build_object('policyVersion', v_after.policy_version, 'enabled', v_after.enabled)
  );

  RETURN v_after;
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_appointment_reminders_after_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  PERFORM public.plan_appointment_reminder_jobs_internal(
    NEW.tenant_id,
    NEW.id,
    now(),
    auth.uid(),
    'appointment_lifecycle_trigger'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER appointments_reconcile_reminders_after_change
AFTER INSERT OR UPDATE OF patient_id, start_time, end_time, status, updated_at, confirmation_state ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.reconcile_appointment_reminders_after_change();

REVOKE ALL ON FUNCTION public.ensure_tenant_reminder_policy_internal(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_tenant_reminder_policy_write() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_appointment_reminder_job_write() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_default_tenant_reminder_policy() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.appointment_reminder_job_row_json(public.appointment_reminder_jobs) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_appointment_reminder_transition_internal(public.appointment_reminder_jobs, text, text, text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.transition_active_appointment_reminder_jobs_internal(uuid, uuid, text, text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reconcile_appointment_reminders_after_visit_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.plan_appointment_reminder_jobs_internal(uuid, uuid, timestamptz, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reconcile_appointment_reminders_after_change() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.plan_appointment_reminder_jobs(uuid, uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.plan_appointment_reminder_jobs(uuid, uuid, timestamptz) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.reconcile_tenant_appointment_reminders(uuid, timestamptz, timestamptz, integer, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_tenant_appointment_reminders(uuid, timestamptz, timestamptz, integer, timestamptz) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.set_tenant_reminder_policy(uuid, boolean, boolean, boolean, boolean, time, boolean, boolean, boolean, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_tenant_reminder_policy(uuid, boolean, boolean, boolean, boolean, time, boolean, boolean, boolean, integer) TO authenticated, service_role;

COMMENT ON TABLE public.tenant_reminder_policies IS 'Tenant-local reminder planning policy. Existing tenants are disabled by default.';
COMMENT ON TABLE public.appointment_reminder_jobs IS 'Durable reminder work plans only. No provider delivery or message state exists.';
COMMENT ON FUNCTION public.plan_appointment_reminder_jobs(uuid, uuid, timestamptz) IS 'Tenant-scoped idempotent appointment reminder planner. Produces manual jobs only and no external side effect.';
COMMENT ON FUNCTION public.reconcile_tenant_appointment_reminders(uuid, timestamptz, timestamptz, integer, timestamptz) IS 'Bounded manual tenant reconciliation; no scheduler or worker is created.';
