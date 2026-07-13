BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.appointment_reminder_jobs'::regclass
      AND conname = 'appointment_reminder_jobs_tenant_id_id_unique'
  ) THEN
    ALTER TABLE public.appointment_reminder_jobs
      ADD CONSTRAINT appointment_reminder_jobs_tenant_id_id_unique UNIQUE (tenant_id, id);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.communication_hash(p_value text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT
SET search_path = public, extensions, pg_catalog
AS $$ SELECT encode(extensions.digest(convert_to(p_value, 'UTF8'), 'sha256'), 'hex') $$;

CREATE OR REPLACE FUNCTION public.communication_mask_destination(p_value text, p_channel text)
RETURNS text LANGUAGE plpgsql IMMUTABLE
SET search_path = public, pg_catalog
AS $$
DECLARE v_digits text; v_local text; v_domain text;
BEGIN
  IF p_channel = 'email' THEN
    v_local := split_part(coalesce(p_value,''), '@', 1);
    v_domain := split_part(coalesce(p_value,''), '@', 2);
    IF v_local = '' OR v_domain = '' THEN RETURN '***'; END IF;
    RETURN left(v_local,1) || '***@' || v_domain;
  END IF;
  v_digits := regexp_replace(coalesce(p_value,''), '[^0-9]', '', 'g');
  IF length(v_digits) < 7 THEN RETURN '***'; END IF;
  RETURN CASE WHEN left(coalesce(p_value,''),1)='+' THEN '+' ELSE '' END
    || left(v_digits, least(4,length(v_digits)-4)) || '***' || right(v_digits,4);
END;
$$;

CREATE TABLE public.communication_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('sms','whatsapp','email')),
  adapter_code text NOT NULL CHECK (adapter_code IN ('noop','mock')),
  enabled boolean NOT NULL DEFAULT true,
  simulation_only boolean NOT NULL DEFAULT true CHECK (simulation_only),
  priority integer NOT NULL DEFAULT 100 CHECK (priority BETWEEN 1 AND 1000),
  configuration_version integer NOT NULL DEFAULT 1 CHECK (configuration_version >= 1),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  archived_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata)='object'),
  UNIQUE (tenant_id,id),
  CHECK (archived_at IS NULL OR NOT enabled)
);
CREATE UNIQUE INDEX communication_routes_one_active
  ON public.communication_routes(tenant_id,channel)
  WHERE enabled AND archived_at IS NULL;

CREATE TABLE public.communication_route_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  operation_key text NOT NULL,
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  result jsonb NOT NULL CHECK (jsonb_typeof(result)='object'),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (tenant_id,operation_key)
);

CREATE TABLE public.communication_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  reminder_job_id uuid NOT NULL,
  appointment_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  contact_id uuid NOT NULL,
  purpose_code text NOT NULL CHECK (purpose_code IN (
    'appointment_confirmation_request',
    'appointment_day_before_reminder',
    'appointment_same_day_reminder',
    'appointment_control_call_task'
  )),
  channel text NOT NULL CHECK (channel IN ('sms','whatsapp','email')),
  language text NOT NULL CHECK (language IN ('ru','kk','en')),
  state text NOT NULL DEFAULT 'prepared' CHECK (state IN (
    'prepared','simulation_running','simulation_succeeded',
    'simulation_failed','simulation_uncertain','cancelled'
  )),
  operation_key text NOT NULL CHECK (
    length(operation_key) BETWEEN 8 AND 200
    AND operation_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
  ),
  payload_fingerprint text NOT NULL CHECK (payload_fingerprint ~ '^[0-9a-f]{64}$'),
  appointment_updated_at timestamptz NOT NULL,
  reminder_job_updated_at timestamptz NOT NULL,
  contact_updated_at timestamptz NOT NULL,
  policy_version integer NOT NULL CHECK (policy_version >= 1),
  eligibility_version integer NOT NULL DEFAULT 1 CHECK (eligibility_version >= 1),
  route_id uuid NOT NULL,
  route_version integer NOT NULL CHECK (route_version >= 1),
  adapter_code text NOT NULL CHECK (adapter_code IN ('noop','mock')),
  external_operation_id text,
  adapter_result_code text CHECK (adapter_result_code IS NULL OR adapter_result_code IN (
    'accepted','rejected','temporary_failure','permanent_failure',
    'timeout_before_acceptance','timeout_after_acceptance','unknown'
  )),
  retryable boolean,
  uncertain boolean NOT NULL DEFAULT false,
  safe_error_code text,
  prepared_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  executed_at timestamptz,
  recovered_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  execution_operation_key text,
  execution_fingerprint text CHECK (
    execution_fingerprint IS NULL OR execution_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  eligibility_snapshot jsonb NOT NULL CHECK (jsonb_typeof(eligibility_snapshot)='object'),
  consent_snapshot jsonb NOT NULL CHECK (jsonb_typeof(consent_snapshot)='object'),
  suppression_snapshot jsonb NOT NULL CHECK (jsonb_typeof(suppression_snapshot)='object'),
  contact_snapshot jsonb NOT NULL CHECK (jsonb_typeof(contact_snapshot)='object'),
  appointment_snapshot jsonb NOT NULL CHECK (jsonb_typeof(appointment_snapshot)='object'),
  route_snapshot jsonb NOT NULL CHECK (jsonb_typeof(route_snapshot)='object'),
  command jsonb NOT NULL CHECK (jsonb_typeof(command)='object'),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata)='object'),
  FOREIGN KEY (tenant_id,reminder_job_id)
    REFERENCES public.appointment_reminder_jobs(tenant_id,id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id,appointment_id)
    REFERENCES public.appointments(tenant_id,id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id,patient_id)
    REFERENCES public.patients(tenant_id,id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id,contact_id)
    REFERENCES public.patient_communication_contacts(tenant_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id,route_id)
    REFERENCES public.communication_routes(tenant_id,id) ON DELETE RESTRICT,
  UNIQUE (tenant_id,operation_key),
  CHECK (
    (execution_operation_key IS NULL AND execution_fingerprint IS NULL)
    OR (
      execution_operation_key IS NOT NULL
      AND length(execution_operation_key) BETWEEN 8 AND 200
      AND execution_operation_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
      AND execution_fingerprint IS NOT NULL
    )
  ),
  CHECK (
    (state='prepared' AND executed_at IS NULL AND adapter_result_code IS NULL
      AND external_operation_id IS NULL AND NOT uncertain AND cancelled_at IS NULL)
    OR (state='simulation_running' AND executed_at IS NULL AND adapter_result_code IS NULL
      AND NOT uncertain AND cancelled_at IS NULL)
    OR (state='simulation_succeeded' AND executed_at IS NOT NULL
      AND adapter_result_code='accepted' AND NOT uncertain AND cancelled_at IS NULL)
    OR (state='simulation_failed' AND executed_at IS NOT NULL
      AND adapter_result_code IN ('rejected','temporary_failure','permanent_failure','timeout_before_acceptance')
      AND NOT uncertain AND cancelled_at IS NULL)
    OR (state='simulation_uncertain' AND executed_at IS NOT NULL
      AND adapter_result_code IN ('timeout_after_acceptance','unknown')
      AND uncertain AND cancelled_at IS NULL)
    OR (state='cancelled' AND cancelled_at IS NOT NULL AND executed_at IS NULL
      AND adapter_result_code IS NULL AND NOT uncertain)
  )
);
CREATE UNIQUE INDEX communication_operations_logical_unique
  ON public.communication_operations(tenant_id,reminder_job_id,channel,payload_fingerprint);
CREATE UNIQUE INDEX communication_operations_execution_key_unique
  ON public.communication_operations(tenant_id,execution_operation_key)
  WHERE execution_operation_key IS NOT NULL;
CREATE INDEX communication_operations_tenant_state_idx
  ON public.communication_operations(tenant_id,state,prepared_at DESC,id);
CREATE INDEX communication_operations_job_idx
  ON public.communication_operations(tenant_id,reminder_job_id,prepared_at DESC,id);

ALTER TABLE public.communication_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_route_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_operations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.communication_tenant_role(p_tenant_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public,pg_catalog
AS $$
  SELECT role::text FROM public.tenant_users
  WHERE tenant_id=p_tenant_id AND user_id=auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.communication_require_manager(p_tenant_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public,pg_catalog
AS $$
DECLARE v_role text;
BEGIN
  v_role := public.communication_tenant_role(p_tenant_id);
  IF v_role NOT IN ('clinic_owner','clinic_admin') THEN
    RAISE EXCEPTION 'Недостаточно прав для работы с коммуникациями.' USING ERRCODE='42501';
  END IF;
  RETURN v_role;
END;
$$;

CREATE POLICY communication_routes_read_policy ON public.communication_routes
FOR SELECT TO authenticated
USING (public.communication_tenant_role(tenant_id) IN ('clinic_owner','clinic_admin','registrar'));
CREATE POLICY communication_operations_read_policy ON public.communication_operations
FOR SELECT TO authenticated
USING (public.communication_tenant_role(tenant_id) IN ('clinic_owner','clinic_admin','registrar'));

REVOKE ALL ON public.communication_routes FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.communication_route_operations FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.communication_operations FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.communication_routes,public.communication_operations TO authenticated;
GRANT ALL ON public.communication_routes,public.communication_route_operations,public.communication_operations TO service_role;

CREATE OR REPLACE FUNCTION public.communication_write_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_catalog
AS $$
BEGIN
  IF TG_OP='UPDATE' THEN
    IF TG_TABLE_NAME='communication_operations' THEN
      IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
        OR NEW.reminder_job_id IS DISTINCT FROM OLD.reminder_job_id
        OR NEW.appointment_id IS DISTINCT FROM OLD.appointment_id
        OR NEW.patient_id IS DISTINCT FROM OLD.patient_id
        OR NEW.contact_id IS DISTINCT FROM OLD.contact_id
        OR NEW.purpose_code IS DISTINCT FROM OLD.purpose_code
        OR NEW.channel IS DISTINCT FROM OLD.channel
        OR NEW.language IS DISTINCT FROM OLD.language
        OR NEW.operation_key IS DISTINCT FROM OLD.operation_key
        OR NEW.payload_fingerprint IS DISTINCT FROM OLD.payload_fingerprint
        OR NEW.appointment_updated_at IS DISTINCT FROM OLD.appointment_updated_at
        OR NEW.reminder_job_updated_at IS DISTINCT FROM OLD.reminder_job_updated_at
        OR NEW.contact_updated_at IS DISTINCT FROM OLD.contact_updated_at
        OR NEW.policy_version IS DISTINCT FROM OLD.policy_version
        OR NEW.eligibility_version IS DISTINCT FROM OLD.eligibility_version
        OR NEW.route_id IS DISTINCT FROM OLD.route_id
        OR NEW.route_version IS DISTINCT FROM OLD.route_version
        OR NEW.adapter_code IS DISTINCT FROM OLD.adapter_code
        OR NEW.prepared_at IS DISTINCT FROM OLD.prepared_at
        OR NEW.created_by IS DISTINCT FROM OLD.created_by
        OR NEW.eligibility_snapshot IS DISTINCT FROM OLD.eligibility_snapshot
        OR NEW.consent_snapshot IS DISTINCT FROM OLD.consent_snapshot
        OR NEW.suppression_snapshot IS DISTINCT FROM OLD.suppression_snapshot
        OR NEW.contact_snapshot IS DISTINCT FROM OLD.contact_snapshot
        OR NEW.appointment_snapshot IS DISTINCT FROM OLD.appointment_snapshot
        OR NEW.route_snapshot IS DISTINCT FROM OLD.route_snapshot
        OR NEW.command IS DISTINCT FROM OLD.command THEN
        RAISE EXCEPTION 'Communication operation snapshots are immutable.' USING ERRCODE='23514';
      END IF;
    END IF;
    NEW.updated_at := transaction_timestamp();
  END IF;
  IF current_user IN ('postgres','service_role')
     OR coalesce(current_setting('app.communication_internal',true),'')='on' THEN
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Недостаточно прав для работы с коммуникациями.' USING ERRCODE='42501';
END;
$$;
CREATE TRIGGER communication_routes_write_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.communication_routes
FOR EACH ROW EXECUTE FUNCTION public.communication_write_guard();
CREATE TRIGGER communication_operations_write_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.communication_operations
FOR EACH ROW EXECUTE FUNCTION public.communication_write_guard();

CREATE OR REPLACE FUNCTION public.communication_route_json(p_route public.communication_routes)
RETURNS jsonb LANGUAGE sql STABLE SET search_path=public,pg_catalog
AS $$
SELECT jsonb_build_object(
  'id',p_route.id,'tenantId',p_route.tenant_id,'channel',p_route.channel,
  'adapterCode',p_route.adapter_code,'enabled',p_route.enabled,
  'simulationOnly',p_route.simulation_only,'priority',p_route.priority,
  'configurationVersion',p_route.configuration_version,
  'createdAt',p_route.created_at,'updatedAt',p_route.updated_at,'archivedAt',p_route.archived_at
)
$$;

CREATE OR REPLACE FUNCTION public.communication_operation_json(p_operation public.communication_operations)
RETURNS jsonb LANGUAGE sql STABLE SET search_path=public,pg_catalog
AS $$
SELECT jsonb_build_object(
  'id',p_operation.id,'tenantId',p_operation.tenant_id,
  'reminderJobId',p_operation.reminder_job_id,'appointmentId',p_operation.appointment_id,
  'patientId',p_operation.patient_id,'contactId',p_operation.contact_id,
  'purposeCode',p_operation.purpose_code,'channel',p_operation.channel,
  'language',p_operation.language,'state',p_operation.state,
  'operationKey',p_operation.operation_key,'payloadFingerprint',p_operation.payload_fingerprint,
  'appointmentUpdatedAt',p_operation.appointment_updated_at,
  'reminderJobUpdatedAt',p_operation.reminder_job_updated_at,
  'contactUpdatedAt',p_operation.contact_updated_at,'policyVersion',p_operation.policy_version,
  'eligibilityVersion',p_operation.eligibility_version,'routeId',p_operation.route_id,
  'routeVersion',p_operation.route_version,'adapterCode',p_operation.adapter_code,
  'externalOperationId',p_operation.external_operation_id,
  'adapterResultCode',p_operation.adapter_result_code,'retryable',p_operation.retryable,
  'uncertain',p_operation.uncertain,'safeErrorCode',p_operation.safe_error_code,
  'preparedAt',p_operation.prepared_at,'executedAt',p_operation.executed_at,
  'recoveredAt',p_operation.recovered_at,'cancelledAt',p_operation.cancelled_at,
  'updatedAt',p_operation.updated_at,'eligibilitySnapshot',p_operation.eligibility_snapshot,
  'consentSnapshot',p_operation.consent_snapshot,'suppressionSnapshot',p_operation.suppression_snapshot,
  'contactSnapshot',p_operation.contact_snapshot,'appointmentSnapshot',p_operation.appointment_snapshot,
  'routeSnapshot',p_operation.route_snapshot,'command',p_operation.command,'metadata',p_operation.metadata
)
$$;

CREATE OR REPLACE FUNCTION public.communication_record_event(
  p_operation public.communication_operations,p_action text,p_before jsonb,p_after jsonb,p_metadata jsonb DEFAULT '{}'
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_catalog
AS $$
DECLARE v_audit uuid; v_role text;
BEGIN
  v_role := public.communication_tenant_role(p_operation.tenant_id);
  v_audit := public.record_audit_event_internal(
    p_tenant_id=>p_operation.tenant_id,p_action=>p_action,p_category=>'appointment',
    p_target_type=>'communication_operation',p_target_id=>p_operation.id::text,
    p_actor_user_id=>auth.uid(),p_actor_tenant_role=>v_role,
    p_patient_id=>p_operation.patient_id,p_appointment_id=>p_operation.appointment_id::text,
    p_before_data=>coalesce(p_before,'{}'),p_after_data=>coalesce(p_after,'{}'),
    p_diff_data=>jsonb_build_object('state',jsonb_build_object('from',p_before->>'state','to',p_after->>'state')),
    p_redaction_level=>'standard',
    p_metadata=>jsonb_build_object(
      'reminderJobId',p_operation.reminder_job_id,'purposeCode',p_operation.purpose_code,
      'channel',p_operation.channel,'adapterCode',p_operation.adapter_code,
      'maskedDestination',p_operation.contact_snapshot->>'maskedDestination'
    ) || coalesce(p_metadata,'{}')
  );
  PERFORM public.record_activity_event_internal(
    p_tenant_id=>p_operation.tenant_id,p_category=>'appointment',p_type=>p_action,
    p_title=>CASE p_action
      WHEN 'communication_operation_prepared' THEN 'Подготовлена тестовая коммуникационная операция'
      WHEN 'communication_operation_simulation_started' THEN 'Запущена симуляция коммуникации'
      WHEN 'communication_operation_simulation_succeeded' THEN 'Симуляция коммуникации принята'
      WHEN 'communication_operation_simulation_uncertain' THEN 'Результат симуляции коммуникации не определён'
      WHEN 'communication_operation_cancelled' THEN 'Коммуникационная операция отменена'
      ELSE 'Симуляция коммуникации завершилась ошибкой' END,
    p_source_type=>'communication_operation',p_source_id=>p_operation.id::text,
    p_patient_id=>p_operation.patient_id,p_audit_event_id=>v_audit,p_actor_user_id=>auth.uid(),
    p_visibility=>'admin',
    p_metadata=>jsonb_build_object(
      'appointmentId',p_operation.appointment_id,'reminderJobId',p_operation.reminder_job_id,
      'channel',p_operation.channel,'state',p_operation.state,'safeErrorCode',p_operation.safe_error_code
    ) || coalesce(p_metadata,'{}')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.communication_record_route_event(
  p_route public.communication_routes,p_action text,p_before jsonb,p_after jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_catalog
AS $$
DECLARE v_audit uuid; v_role text;
BEGIN
  v_role := public.communication_tenant_role(p_route.tenant_id);
  v_audit := public.record_audit_event_internal(
    p_tenant_id=>p_route.tenant_id,p_action=>p_action,p_category=>'tenant',
    p_target_type=>'communication_route',p_target_id=>p_route.id::text,
    p_actor_user_id=>auth.uid(),p_actor_tenant_role=>v_role,
    p_before_data=>coalesce(p_before,'{}'),p_after_data=>coalesce(p_after,'{}'),
    p_diff_data=>'{}',p_redaction_level=>'standard',
    p_metadata=>jsonb_build_object(
      'channel',p_route.channel,'adapterCode',p_route.adapter_code,
      'configurationVersion',p_route.configuration_version,'simulationOnly',true
    )
  );
  PERFORM public.record_activity_event_internal(
    p_tenant_id=>p_route.tenant_id,p_category=>'system',p_type=>p_action,
    p_title=>CASE p_action WHEN 'communication_route_created' THEN 'Создан тестовый маршрут коммуникации'
      WHEN 'communication_route_disabled' THEN 'Тестовый маршрут коммуникации отключён'
      ELSE 'Тестовый маршрут коммуникации обновлён' END,
    p_source_type=>'communication_route',p_source_id=>p_route.id::text,
    p_audit_event_id=>v_audit,p_actor_user_id=>auth.uid(),p_visibility=>'admin',
    p_metadata=>jsonb_build_object(
      'channel',p_route.channel,'adapterCode',p_route.adapter_code,
      'enabled',p_route.enabled,'configurationVersion',p_route.configuration_version
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_or_update_communication_route(
  p_tenant_id uuid,p_route_id uuid,p_channel text,p_adapter_code text,p_enabled boolean,
  p_priority integer,p_expected_updated_at timestamptz,p_operation_key text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_catalog
AS $$
DECLARE v_role text; v_route public.communication_routes%ROWTYPE; v_other public.communication_routes%ROWTYPE;
  v_before jsonb:='{}'; v_fingerprint text; v_saved public.communication_route_operations%ROWTYPE;
  v_result jsonb; v_action text; v_changed boolean:=false;
BEGIN
  v_role := public.communication_require_manager(p_tenant_id);
  IF p_channel NOT IN ('sms','whatsapp','email') OR p_adapter_code NOT IN ('noop','mock')
     OR p_priority NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'Реальная отправка в этой версии запрещена.' USING ERRCODE='22023';
  END IF;
  IF p_operation_key IS NULL OR length(p_operation_key) NOT BETWEEN 8 AND 200
     OR p_operation_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$' THEN
    RAISE EXCEPTION 'Не удалось выполнить тестовую операцию.' USING ERRCODE='22023';
  END IF;
  v_fingerprint := public.communication_hash(jsonb_build_object(
    'routeId',p_route_id,'channel',p_channel,'adapterCode',p_adapter_code,
    'enabled',p_enabled,'priority',p_priority,'expectedUpdatedAt',p_expected_updated_at
  )::text);
  PERFORM pg_advisory_xact_lock(hashtextextended('communication-route:'||p_tenant_id||':'||p_operation_key,0));
  SELECT * INTO v_saved FROM public.communication_route_operations
  WHERE tenant_id=p_tenant_id AND operation_key=p_operation_key;
  IF FOUND THEN
    IF v_saved.fingerprint<>v_fingerprint THEN
      RAISE EXCEPTION 'Операция уже выполнена с другими параметрами.' USING ERRCODE='23505';
    END IF;
    RETURN v_saved.result || jsonb_build_object('replayed',true);
  END IF;

  IF p_route_id IS NOT NULL THEN
    SELECT * INTO v_route FROM public.communication_routes
    WHERE tenant_id=p_tenant_id AND id=p_route_id FOR UPDATE;
  END IF;
  IF v_route.id IS NOT NULL THEN
    IF p_expected_updated_at IS NOT NULL AND v_route.updated_at<>p_expected_updated_at THEN
      RAISE EXCEPTION 'Данные записи или контакта изменились. Обновите задачу.' USING ERRCODE='40001';
    END IF;
    v_before:=public.communication_route_json(v_route);
  END IF;

  IF p_enabled THEN
    FOR v_other IN SELECT * FROM public.communication_routes
      WHERE tenant_id=p_tenant_id AND channel=p_channel AND enabled AND archived_at IS NULL
        AND (v_route.id IS NULL OR id<>v_route.id)
      ORDER BY id FOR UPDATE
    LOOP
      PERFORM set_config('app.communication_internal','on',true);
      UPDATE public.communication_routes SET enabled=false,configuration_version=configuration_version+1,
        updated_by=auth.uid(),updated_at=transaction_timestamp()
      WHERE id=v_other.id RETURNING * INTO v_other;
      PERFORM set_config('app.communication_internal','off',true);
      PERFORM public.communication_record_route_event(
        v_other,'communication_route_disabled',jsonb_build_object('enabled',true),public.communication_route_json(v_other)
      );
    END LOOP;
  END IF;

  IF v_route.id IS NULL THEN
    PERFORM set_config('app.communication_internal','on',true);
    INSERT INTO public.communication_routes(
      tenant_id,channel,adapter_code,enabled,priority,created_by,updated_by
    ) VALUES(p_tenant_id,p_channel,p_adapter_code,p_enabled,p_priority,auth.uid(),auth.uid())
    RETURNING * INTO v_route;
    PERFORM set_config('app.communication_internal','off',true);
    v_changed:=true; v_action:='communication_route_created';
  ELSE
    v_changed := v_route.channel IS DISTINCT FROM p_channel OR v_route.adapter_code IS DISTINCT FROM p_adapter_code
      OR v_route.enabled IS DISTINCT FROM p_enabled OR v_route.priority IS DISTINCT FROM p_priority
      OR v_route.archived_at IS NOT NULL;
    IF v_changed THEN
      PERFORM set_config('app.communication_internal','on',true);
      UPDATE public.communication_routes SET channel=p_channel,adapter_code=p_adapter_code,enabled=p_enabled,
        simulation_only=true,priority=p_priority,configuration_version=configuration_version+1,
        updated_by=auth.uid(),updated_at=transaction_timestamp(),archived_at=NULL
      WHERE id=v_route.id RETURNING * INTO v_route;
      PERFORM set_config('app.communication_internal','off',true);
      v_action:='communication_route_updated';
    END IF;
  END IF;
  IF v_changed THEN
    PERFORM public.communication_record_route_event(
      v_route,v_action,v_before,public.communication_route_json(v_route)
    );
  END IF;
  v_result:=jsonb_build_object('route',public.communication_route_json(v_route),'changed',v_changed);
  INSERT INTO public.communication_route_operations(tenant_id,operation_key,fingerprint,result)
  VALUES(p_tenant_id,p_operation_key,v_fingerprint,v_result);
  RETURN v_result || jsonb_build_object('replayed',false);
END;
$$;

CREATE OR REPLACE FUNCTION public.disable_communication_route(
  p_tenant_id uuid,p_route_id uuid,p_expected_updated_at timestamptz,p_operation_key text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_catalog
AS $$
DECLARE v_role text; v_route public.communication_routes%ROWTYPE; v_before jsonb;
  v_fingerprint text; v_saved public.communication_route_operations%ROWTYPE; v_result jsonb; v_changed boolean:=false;
BEGIN
  v_role:=public.communication_require_manager(p_tenant_id);
  IF p_operation_key IS NULL OR length(p_operation_key) NOT BETWEEN 8 AND 200
     OR p_operation_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$' THEN
    RAISE EXCEPTION 'Не удалось выполнить тестовую операцию.' USING ERRCODE='22023';
  END IF;
  v_fingerprint:=public.communication_hash(jsonb_build_object(
    'routeId',p_route_id,'expectedUpdatedAt',p_expected_updated_at,'action','disable'
  )::text);
  PERFORM pg_advisory_xact_lock(hashtextextended('communication-route:'||p_tenant_id||':'||p_operation_key,0));
  SELECT * INTO v_saved FROM public.communication_route_operations
  WHERE tenant_id=p_tenant_id AND operation_key=p_operation_key;
  IF FOUND THEN
    IF v_saved.fingerprint<>v_fingerprint THEN
      RAISE EXCEPTION 'Операция уже выполнена с другими параметрами.' USING ERRCODE='23505';
    END IF;
    RETURN v_saved.result || jsonb_build_object('replayed',true);
  END IF;
  SELECT * INTO v_route FROM public.communication_routes
  WHERE tenant_id=p_tenant_id AND id=p_route_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Для этого канала не настроен тестовый маршрут.' USING ERRCODE='P0002';
  END IF;
  IF p_expected_updated_at IS NOT NULL AND v_route.updated_at<>p_expected_updated_at THEN
    RAISE EXCEPTION 'Данные записи или контакта изменились. Обновите задачу.' USING ERRCODE='40001';
  END IF;
  v_before:=public.communication_route_json(v_route);
  IF v_route.enabled OR v_route.archived_at IS NULL THEN
    PERFORM set_config('app.communication_internal','on',true);
    UPDATE public.communication_routes SET enabled=false,archived_at=coalesce(archived_at,transaction_timestamp()),
      configuration_version=configuration_version+1,updated_by=auth.uid(),updated_at=transaction_timestamp()
    WHERE id=v_route.id RETURNING * INTO v_route;
    PERFORM set_config('app.communication_internal','off',true);
    v_changed:=true;
    PERFORM public.communication_record_route_event(
      v_route,'communication_route_disabled',v_before,public.communication_route_json(v_route)
    );
  END IF;
  v_result:=jsonb_build_object('route',public.communication_route_json(v_route),'changed',v_changed);
  INSERT INTO public.communication_route_operations(tenant_id,operation_key,fingerprint,result)
  VALUES(p_tenant_id,p_operation_key,v_fingerprint,v_result);
  RETURN v_result || jsonb_build_object('replayed',false);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_communication_routes(p_tenant_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=public,pg_catalog
AS $$
DECLARE v_role text;
BEGIN
  v_role:=public.communication_tenant_role(p_tenant_id);
  IF v_role NOT IN ('clinic_owner','clinic_admin','registrar') THEN
    RAISE EXCEPTION 'Недостаточно прав для работы с коммуникациями.' USING ERRCODE='42501';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(public.communication_route_json(r) ORDER BY r.channel,r.priority,r.id)
    FROM public.communication_routes r WHERE r.tenant_id=p_tenant_id
  ),'[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.communication_purpose(p_reminder_type text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public,pg_catalog
AS $$
SELECT CASE p_reminder_type
  WHEN 'confirmation_request' THEN 'appointment_confirmation_request'
  WHEN 'day_before_reminder' THEN 'appointment_day_before_reminder'
  WHEN 'control_call_task' THEN 'appointment_control_call_task'
  ELSE NULL END
$$;

CREATE OR REPLACE FUNCTION public.communication_cancel_prepared(
  p_operation_id uuid,p_reason text,p_source text
) RETURNS public.communication_operations
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_catalog
AS $$
DECLARE v_operation public.communication_operations%ROWTYPE; v_before jsonb;
BEGIN
  SELECT * INTO v_operation FROM public.communication_operations
  WHERE id=p_operation_id FOR UPDATE;
  IF NOT FOUND OR v_operation.state<>'prepared' THEN RETURN v_operation; END IF;
  v_before:=public.communication_operation_json(v_operation);
  PERFORM set_config('app.communication_internal','on',true);
  UPDATE public.communication_operations SET state='cancelled',cancelled_at=transaction_timestamp(),
    safe_error_code=p_reason,metadata=metadata||jsonb_build_object('cancelSource',p_source)
  WHERE id=v_operation.id RETURNING * INTO v_operation;
  PERFORM set_config('app.communication_internal','off',true);
  PERFORM public.communication_record_event(
    v_operation,'communication_operation_cancelled',v_before,public.communication_operation_json(v_operation),
    jsonb_build_object('reason',p_reason,'source',p_source)
  );
  RETURN v_operation;
END;
$$;

CREATE OR REPLACE FUNCTION public.communication_invalid_reason(
  p_operation public.communication_operations
) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=public,pg_catalog
AS $$
DECLARE v_job public.appointment_reminder_jobs%ROWTYPE; v_appt public.appointments%ROWTYPE;
  v_contact public.patient_communication_contacts%ROWTYPE; v_pref public.patient_communication_preferences%ROWTYPE;
  v_route public.communication_routes%ROWTYPE; v_consent text; v_suppressed boolean;
BEGIN
  SELECT * INTO v_job FROM public.appointment_reminder_jobs
  WHERE tenant_id=p_operation.tenant_id AND id=p_operation.reminder_job_id;
  IF NOT FOUND OR v_job.state NOT IN ('scheduled','ready') THEN RETURN 'reminder_job_inactive'; END IF;
  IF v_job.updated_at<>p_operation.reminder_job_updated_at THEN RETURN 'reminder_job_stale'; END IF;
  SELECT * INTO v_appt FROM public.appointments
  WHERE tenant_id=p_operation.tenant_id AND id=p_operation.appointment_id;
  IF NOT FOUND OR v_appt.status IN ('cancelled','no_show','arrived','in_progress','completed','blocked')
     OR v_appt.start_time<=transaction_timestamp() THEN RETURN 'appointment_inactive'; END IF;
  IF v_appt.updated_at<>p_operation.appointment_updated_at THEN RETURN 'appointment_stale'; END IF;
  SELECT * INTO v_contact FROM public.patient_communication_contacts
  WHERE tenant_id=p_operation.tenant_id AND id=p_operation.contact_id;
  IF NOT FOUND OR v_contact.archived_at IS NOT NULL THEN RETURN 'contact_archived'; END IF;
  IF v_contact.updated_at<>p_operation.contact_updated_at THEN RETURN 'contact_stale'; END IF;
  IF NOT v_contact.is_verified OR v_contact.contact_value_normalized IS NULL THEN RETURN 'contact_invalid'; END IF;
  IF v_contact.owner_type='representative' THEN RETURN 'representative_review_required'; END IF;
  SELECT * INTO v_pref FROM public.patient_communication_preferences
  WHERE tenant_id=p_operation.tenant_id AND patient_id=p_operation.patient_id;
  IF NOT FOUND THEN RETURN 'consent_missing'; END IF;
  v_consent:=CASE p_operation.channel WHEN 'sms' THEN v_pref.sms_consent_state
    WHEN 'whatsapp' THEN v_pref.whatsapp_consent_state ELSE v_pref.email_consent_state END;
  v_suppressed:=CASE p_operation.channel WHEN 'sms' THEN v_pref.sms_suppressed
    WHEN 'whatsapp' THEN v_pref.whatsapp_suppressed ELSE v_pref.email_suppressed END;
  IF v_consent<>'granted' THEN RETURN 'consent_not_granted'; END IF;
  IF v_pref.global_suppression OR v_suppressed THEN RETURN 'communication_suppressed'; END IF;
  SELECT * INTO v_route FROM public.communication_routes
  WHERE tenant_id=p_operation.tenant_id AND id=p_operation.route_id;
  IF NOT FOUND OR NOT v_route.enabled OR v_route.archived_at IS NOT NULL OR NOT v_route.simulation_only
     OR v_route.configuration_version<>p_operation.route_version
     OR v_route.adapter_code<>p_operation.adapter_code THEN RETURN 'route_unavailable'; END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.prepare_communication_operation(
  p_tenant_id uuid,p_reminder_job_id uuid,p_channel text,p_operation_key text,
  p_expected_job_updated_at timestamptz,p_expected_appointment_updated_at timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_catalog
AS $$
DECLARE v_role text; v_existing public.communication_operations%ROWTYPE;
  v_job public.appointment_reminder_jobs%ROWTYPE; v_appt public.appointments%ROWTYPE;
  v_patient public.patients%ROWTYPE; v_contact public.patient_communication_contacts%ROWTYPE;
  v_pref public.patient_communication_preferences%ROWTYPE; v_consent_event public.patient_communication_consent_events%ROWTYPE;
  v_route public.communication_routes%ROWTYPE; v_doctor text; v_clinic text; v_timezone text;
  v_eligibility jsonb; v_purpose text; v_consent text; v_channel_suppressed boolean;
  v_channel_reason text; v_channel_at timestamptz; v_variables jsonb;
  v_eligibility_snapshot jsonb; v_consent_snapshot jsonb; v_suppression_snapshot jsonb;
  v_contact_snapshot jsonb; v_appointment_snapshot jsonb; v_route_snapshot jsonb;
  v_command jsonb; v_payload jsonb; v_fingerprint text; v_operation public.communication_operations%ROWTYPE;
  v_operation_id uuid:=gen_random_uuid(); v_masked text; v_destination_fingerprint text;
BEGIN
  v_role:=public.communication_require_manager(p_tenant_id);
  IF p_channel NOT IN ('sms','whatsapp','email') THEN
    RAISE EXCEPTION 'Реальная отправка в этой версии запрещена.' USING ERRCODE='22023';
  END IF;
  IF p_operation_key IS NULL OR length(p_operation_key) NOT BETWEEN 8 AND 200
     OR p_operation_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$' THEN
    RAISE EXCEPTION 'Не удалось выполнить тестовую операцию.' USING ERRCODE='22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('communication-prepare:'||p_tenant_id||':'||p_operation_key,0));
  SELECT * INTO v_existing FROM public.communication_operations
  WHERE tenant_id=p_tenant_id AND operation_key=p_operation_key;
  IF FOUND THEN
    IF v_existing.reminder_job_id<>p_reminder_job_id OR v_existing.channel<>p_channel
       OR v_existing.reminder_job_updated_at<>p_expected_job_updated_at
       OR v_existing.appointment_updated_at<>p_expected_appointment_updated_at THEN
      RAISE EXCEPTION 'Операция уже выполнена с другими параметрами.' USING ERRCODE='23505';
    END IF;
    RETURN jsonb_build_object('operation',public.communication_operation_json(v_existing),'replayed',true);
  END IF;

  SELECT * INTO v_job FROM public.appointment_reminder_jobs
  WHERE tenant_id=p_tenant_id AND id=p_reminder_job_id FOR UPDATE;
  IF NOT FOUND OR v_job.state NOT IN ('scheduled','ready') THEN
    RAISE EXCEPTION 'Контакт или согласие больше не позволяют подготовить коммуникацию.' USING ERRCODE='P0002';
  END IF;
  IF v_job.updated_at<>p_expected_job_updated_at THEN
    RAISE EXCEPTION 'Данные записи или контакта изменились. Обновите задачу.' USING ERRCODE='40001';
  END IF;
  SELECT * INTO v_appt FROM public.appointments
  WHERE tenant_id=p_tenant_id AND id=v_job.appointment_id FOR UPDATE;
  IF NOT FOUND OR v_appt.patient_id IS NULL OR v_appt.patient_id<>v_job.patient_id
     OR v_appt.status IN ('cancelled','no_show','arrived','in_progress','completed','blocked')
     OR v_appt.start_time<=transaction_timestamp() THEN
    RAISE EXCEPTION 'Контакт или согласие больше не позволяют подготовить коммуникацию.' USING ERRCODE='P0002';
  END IF;
  IF v_appt.updated_at<>p_expected_appointment_updated_at OR v_job.appointment_updated_at<>v_appt.updated_at THEN
    RAISE EXCEPTION 'Данные записи или контакта изменились. Обновите задачу.' USING ERRCODE='40001';
  END IF;
  v_purpose:=public.communication_purpose(v_job.reminder_type);
  IF v_purpose IS NULL THEN
    RAISE EXCEPTION 'Этот тип задачи не поддерживает тестовую коммуникацию.' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_pref FROM public.patient_communication_preferences
  WHERE tenant_id=p_tenant_id AND patient_id=v_job.patient_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Контакт или согласие больше не позволяют подготовить коммуникацию.' USING ERRCODE='P0002';
  END IF;
  v_eligibility:=public.get_patient_communication_eligibility(p_tenant_id,v_job.patient_id,p_channel);
  IF NOT coalesce((v_eligibility->>'automatedEligible')::boolean,false)
     OR coalesce((v_eligibility->>'requiresManualReview')::boolean,false) THEN
    RAISE EXCEPTION 'Контакт или согласие больше не позволяют подготовить коммуникацию.' USING ERRCODE='P0002';
  END IF;
  SELECT * INTO v_contact FROM public.patient_communication_contacts
  WHERE tenant_id=p_tenant_id AND id=(v_eligibility->>'selectedContactId')::uuid FOR UPDATE;
  IF NOT FOUND OR v_contact.archived_at IS NOT NULL OR NOT v_contact.is_verified
     OR v_contact.contact_value_normalized IS NULL OR v_contact.owner_type='representative' THEN
    RAISE EXCEPTION 'Контакт или согласие больше не позволяют подготовить коммуникацию.' USING ERRCODE='P0002';
  END IF;
  v_consent:=CASE p_channel WHEN 'sms' THEN v_pref.sms_consent_state
    WHEN 'whatsapp' THEN v_pref.whatsapp_consent_state ELSE v_pref.email_consent_state END;
  v_channel_suppressed:=CASE p_channel WHEN 'sms' THEN v_pref.sms_suppressed
    WHEN 'whatsapp' THEN v_pref.whatsapp_suppressed ELSE v_pref.email_suppressed END;
  v_channel_reason:=CASE p_channel WHEN 'sms' THEN v_pref.sms_suppression_reason
    WHEN 'whatsapp' THEN v_pref.whatsapp_suppression_reason ELSE v_pref.email_suppression_reason END;
  v_channel_at:=CASE p_channel WHEN 'sms' THEN v_pref.sms_suppressed_at
    WHEN 'whatsapp' THEN v_pref.whatsapp_suppressed_at ELSE v_pref.email_suppressed_at END;
  IF v_consent<>'granted' OR v_pref.global_suppression OR v_channel_suppressed THEN
    RAISE EXCEPTION 'Контакт или согласие больше не позволяют подготовить коммуникацию.' USING ERRCODE='P0002';
  END IF;
  SELECT * INTO v_consent_event FROM public.patient_communication_consent_events
  WHERE tenant_id=p_tenant_id AND patient_id=v_job.patient_id AND channel=p_channel
  ORDER BY occurred_at DESC,id DESC LIMIT 1;
  IF NOT FOUND OR v_consent_event.new_state<>'granted' THEN
    RAISE EXCEPTION 'Контакт или согласие больше не позволяют подготовить коммуникацию.' USING ERRCODE='P0002';
  END IF;
  SELECT * INTO v_route FROM public.communication_routes
  WHERE tenant_id=p_tenant_id AND channel=p_channel AND enabled AND simulation_only AND archived_at IS NULL
  ORDER BY priority,id LIMIT 1 FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Для этого канала не настроен тестовый маршрут.' USING ERRCODE='P0002';
  END IF;
  SELECT * INTO v_patient FROM public.patients WHERE tenant_id=p_tenant_id AND id=v_job.patient_id;
  SELECT name,timezone INTO v_clinic,v_timezone FROM public.tenants WHERE id=p_tenant_id;
  SELECT full_name INTO v_doctor FROM public.doctors WHERE tenant_id=p_tenant_id AND id=v_appt.doctor_id;

  v_masked:=public.communication_mask_destination(v_contact.contact_value_normalized,p_channel);
  v_destination_fingerprint:=public.communication_hash(v_contact.contact_value_normalized);
  v_variables:=jsonb_strip_nulls(jsonb_build_object(
    'patient_first_name',split_part(btrim(v_patient.full_name),' ',1),
    'clinic_name',v_clinic,
    'appointment_date',to_char(v_appt.start_time AT TIME ZONE v_timezone,'YYYY-MM-DD'),
    'appointment_time',to_char(v_appt.start_time AT TIME ZONE v_timezone,'HH24:MI'),
    'doctor_display_name',v_doctor,
    'clinic_callback_phone',NULL
  ));
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(v_variables) k
    WHERE k NOT IN ('patient_first_name','clinic_name','appointment_date','appointment_time','doctor_display_name','clinic_callback_phone')
  ) THEN
    RAISE EXCEPTION 'Не удалось выполнить тестовую операцию.' USING ERRCODE='22023';
  END IF;

  v_eligibility_snapshot:=jsonb_build_object(
    'eligible',true,'channel',p_channel,'selectedContactId',v_contact.id,
    'ownerType',v_contact.owner_type,'representative',false,'verified',v_contact.is_verified,
    'blockedReasons','[]'::jsonb,'evaluationVersion',1
  );
  v_consent_snapshot:=jsonb_build_object(
    'channel',p_channel,'state',v_consent,'source',v_consent_event.source,
    'lastEventAt',v_consent_event.occurred_at,'eventId',v_consent_event.id
  );
  v_suppression_snapshot:=jsonb_build_object(
    'global',v_pref.global_suppression,'globalReason',v_pref.global_suppression_reason,
    'globalAt',v_pref.global_suppressed_at,'channel',v_channel_suppressed,
    'channelReason',v_channel_reason,'channelAt',v_channel_at
  );
  v_contact_snapshot:=jsonb_build_object(
    'destinationFingerprint',v_destination_fingerprint,'maskedDestination',v_masked,
    'contactType',v_contact.contact_type,'primary',v_contact.is_primary,
    'verified',v_contact.is_verified,'ownerType',v_contact.owner_type,
    'representativeRelation',v_contact.representative_relation,
    'language',coalesce(v_contact.language,v_pref.preferred_language)
  );
  v_appointment_snapshot:=jsonb_build_object(
    'startInstant',v_appt.start_time,
    'tenantLocalDate',to_char(v_appt.start_time AT TIME ZONE v_timezone,'YYYY-MM-DD'),
    'tenantLocalTime',to_char(v_appt.start_time AT TIME ZONE v_timezone,'HH24:MI'),
    'doctorDisplayName',v_doctor,'clinicDisplayName',v_clinic,'callbackPhone',NULL
  );
  v_route_snapshot:=jsonb_build_object(
    'routeId',v_route.id,'configurationVersion',v_route.configuration_version,
    'adapterCode',v_route.adapter_code,'simulationOnly',true
  );
  v_command:=jsonb_build_object(
    'tenantId',p_tenant_id,'operationId',v_operation_id,'reminderJobId',v_job.id,
    'appointmentId',v_appt.id,'patientId',v_patient.id,'contactId',v_contact.id,
    'purposeCode',v_purpose,'channel',p_channel,
    'language',coalesce(v_contact.language,v_pref.preferred_language),
    'maskedDestination',v_masked,'destinationFingerprint',v_destination_fingerprint,
    'operationKey',p_operation_key,'variables',v_variables,'requestedAt',transaction_timestamp()
  );
  v_payload:=jsonb_build_object(
    'tenantId',p_tenant_id,'reminderJobId',v_job.id,'appointmentId',v_appt.id,
    'patientId',v_patient.id,'contactId',v_contact.id,'purposeCode',v_purpose,
    'channel',p_channel,'appointmentUpdatedAt',v_appt.updated_at,
    'reminderJobUpdatedAt',v_job.updated_at,'contactUpdatedAt',v_contact.updated_at,
    'consentEventId',v_consent_event.id,'consentState',v_consent,
    'globalSuppression',v_pref.global_suppression,'channelSuppression',v_channel_suppressed,
    'routeId',v_route.id,'routeVersion',v_route.configuration_version,'variables',v_variables
  );
  v_fingerprint:=public.communication_hash(v_payload::text);

  PERFORM set_config('app.communication_internal','on',true);
  INSERT INTO public.communication_operations(
    id,tenant_id,reminder_job_id,appointment_id,patient_id,contact_id,purpose_code,channel,language,
    operation_key,payload_fingerprint,appointment_updated_at,reminder_job_updated_at,contact_updated_at,
    policy_version,eligibility_version,route_id,route_version,adapter_code,created_by,
    eligibility_snapshot,consent_snapshot,suppression_snapshot,contact_snapshot,appointment_snapshot,
    route_snapshot,command,metadata
  ) VALUES(
    v_operation_id,p_tenant_id,v_job.id,v_appt.id,v_patient.id,v_contact.id,v_purpose,p_channel,
    coalesce(v_contact.language,v_pref.preferred_language),p_operation_key,v_fingerprint,
    v_appt.updated_at,v_job.updated_at,v_contact.updated_at,v_job.policy_version,1,
    v_route.id,v_route.configuration_version,v_route.adapter_code,auth.uid(),
    v_eligibility_snapshot,v_consent_snapshot,v_suppression_snapshot,v_contact_snapshot,
    v_appointment_snapshot,v_route_snapshot,v_command,jsonb_build_object('simulationOnly',true)
  ) RETURNING * INTO v_operation;
  PERFORM set_config('app.communication_internal','off',true);
  PERFORM public.communication_record_event(
    v_operation,'communication_operation_prepared','{}',public.communication_operation_json(v_operation),'{}'
  );
  RETURN jsonb_build_object('operation',public.communication_operation_json(v_operation),'replayed',false);
END;
$$;

CREATE OR REPLACE FUNCTION public.simulate_communication_operation(
  p_tenant_id uuid,p_operation_id uuid,p_scenario text,p_operation_key text,p_expected_updated_at timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_catalog
AS $$
DECLARE v_role text; v_operation public.communication_operations%ROWTYPE; v_before jsonb;
  v_fingerprint text; v_reason text; v_result text; v_state text; v_retryable boolean;
  v_uncertain boolean; v_error text; v_external text; v_action text;
BEGIN
  v_role:=public.communication_require_manager(p_tenant_id);
  IF p_scenario NOT IN ('success','rejected','temporary_failure','permanent_failure',
    'timeout_before_acceptance','timeout_after_acceptance','unknown') THEN
    RAISE EXCEPTION 'Не удалось выполнить тестовую операцию.' USING ERRCODE='22023';
  END IF;
  v_fingerprint:=public.communication_hash(jsonb_build_object(
    'operationId',p_operation_id,'scenario',p_scenario
  )::text);
  PERFORM pg_advisory_xact_lock(hashtextextended('communication-simulate:'||p_tenant_id||':'||p_operation_key,0));
  SELECT * INTO v_operation FROM public.communication_operations
  WHERE tenant_id=p_tenant_id AND id=p_operation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Не удалось выполнить тестовую операцию.' USING ERRCODE='P0002'; END IF;
  IF v_operation.execution_operation_key=p_operation_key THEN
    IF v_operation.execution_fingerprint<>v_fingerprint THEN
      RAISE EXCEPTION 'Операция уже выполнена с другими параметрами.' USING ERRCODE='23505';
    END IF;
    RETURN jsonb_build_object('operation',public.communication_operation_json(v_operation),'replayed',true);
  END IF;
  IF EXISTS(SELECT 1 FROM public.communication_operations
    WHERE tenant_id=p_tenant_id AND execution_operation_key=p_operation_key AND id<>p_operation_id) THEN
    RAISE EXCEPTION 'Операция уже выполнена с другими параметрами.' USING ERRCODE='23505';
  END IF;
  IF v_operation.state<>'prepared' THEN
    RAISE EXCEPTION 'Эта коммуникационная операция уже завершена.' USING ERRCODE='55000';
  END IF;
  IF v_operation.updated_at<>p_expected_updated_at THEN
    RAISE EXCEPTION 'Данные записи или контакта изменились. Обновите задачу.' USING ERRCODE='40001';
  END IF;
  IF v_operation.adapter_code NOT IN ('noop','mock')
     OR coalesce((v_operation.route_snapshot->>'simulationOnly')::boolean,false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Реальная отправка в этой версии запрещена.' USING ERRCODE='42501';
  END IF;
  v_reason:=public.communication_invalid_reason(v_operation);
  IF v_reason IS NOT NULL THEN
    v_operation:=public.communication_cancel_prepared(v_operation.id,v_reason,'simulation_revalidation');
    RETURN jsonb_build_object('operation',public.communication_operation_json(v_operation),'replayed',false);
  END IF;

  v_before:=public.communication_operation_json(v_operation);
  PERFORM set_config('app.communication_internal','on',true);
  UPDATE public.communication_operations SET state='simulation_running',
    execution_operation_key=p_operation_key,execution_fingerprint=v_fingerprint,safe_error_code=NULL
  WHERE id=v_operation.id RETURNING * INTO v_operation;
  PERFORM set_config('app.communication_internal','off',true);
  PERFORM public.communication_record_event(
    v_operation,'communication_operation_simulation_started',v_before,
    public.communication_operation_json(v_operation),jsonb_build_object('scenario',p_scenario)
  );

  v_result:=CASE p_scenario WHEN 'success' THEN 'accepted' ELSE p_scenario END;
  v_state:=CASE WHEN v_result='accepted' THEN 'simulation_succeeded'
    WHEN v_result IN ('timeout_after_acceptance','unknown') THEN 'simulation_uncertain'
    ELSE 'simulation_failed' END;
  v_retryable:=v_result IN ('temporary_failure','timeout_before_acceptance');
  v_uncertain:=v_result IN ('timeout_after_acceptance','unknown');
  v_error:=CASE v_result WHEN 'accepted' THEN NULL ELSE 'simulation_'||v_result END;
  v_external:='sim-'||left(public.communication_hash(v_operation.id||':'||p_operation_key||':'||p_scenario),24);
  v_before:=public.communication_operation_json(v_operation);
  PERFORM set_config('app.communication_internal','on',true);
  UPDATE public.communication_operations SET state=v_state,adapter_result_code=v_result,
    retryable=v_retryable,uncertain=v_uncertain,safe_error_code=v_error,
    external_operation_id=v_external,executed_at=transaction_timestamp()
  WHERE id=v_operation.id RETURNING * INTO v_operation;
  PERFORM set_config('app.communication_internal','off',true);
  v_action:=CASE v_state WHEN 'simulation_succeeded' THEN 'communication_operation_simulation_succeeded'
    WHEN 'simulation_uncertain' THEN 'communication_operation_simulation_uncertain'
    ELSE 'communication_operation_simulation_failed' END;
  PERFORM public.communication_record_event(
    v_operation,v_action,v_before,public.communication_operation_json(v_operation),
    jsonb_build_object('scenario',p_scenario,'resultCode',v_result)
  );
  RETURN jsonb_build_object('operation',public.communication_operation_json(v_operation),'replayed',false);
END;
$$;

CREATE OR REPLACE FUNCTION public.recover_communication_operation(
  p_tenant_id uuid,p_operation_id uuid,p_operation_key text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_catalog
AS $$
DECLARE v_role text; v_operation public.communication_operations%ROWTYPE; v_reason text;
BEGIN
  v_role:=public.communication_require_manager(p_tenant_id);
  IF p_operation_key IS NULL OR length(p_operation_key) NOT BETWEEN 8 AND 200
     OR p_operation_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$' THEN
    RAISE EXCEPTION 'Не удалось выполнить тестовую операцию.' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_operation FROM public.communication_operations
  WHERE tenant_id=p_tenant_id AND id=p_operation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Не удалось выполнить тестовую операцию.' USING ERRCODE='P0002'; END IF;
  IF v_operation.state='prepared' THEN
    v_reason:=public.communication_invalid_reason(v_operation);
    IF v_reason IS NOT NULL THEN
      v_operation:=public.communication_cancel_prepared(v_operation.id,v_reason,'recovery_revalidation');
    END IF;
  ELSIF v_operation.state IN ('simulation_succeeded','simulation_failed','simulation_uncertain')
      AND v_operation.recovered_at IS NULL THEN
    PERFORM set_config('app.communication_internal','on',true);
    UPDATE public.communication_operations SET recovered_at=transaction_timestamp()
    WHERE id=v_operation.id RETURNING * INTO v_operation;
    PERFORM set_config('app.communication_internal','off',true);
  END IF;
  RETURN jsonb_build_object(
    'operation',public.communication_operation_json(v_operation),
    'replayed',true,'recoveryOnly',true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_communication_operation(
  p_tenant_id uuid,p_operation_id uuid,p_operation_key text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_catalog
AS $$
DECLARE v_role text; v_operation public.communication_operations%ROWTYPE;
BEGIN
  v_role:=public.communication_require_manager(p_tenant_id);
  IF p_operation_key IS NULL OR length(p_operation_key) NOT BETWEEN 8 AND 200
     OR p_operation_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$' THEN
    RAISE EXCEPTION 'Не удалось выполнить тестовую операцию.' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_operation FROM public.communication_operations
  WHERE tenant_id=p_tenant_id AND id=p_operation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Не удалось выполнить тестовую операцию.' USING ERRCODE='P0002'; END IF;
  v_operation:=public.communication_cancel_prepared(v_operation.id,'manual_cancelled','manual_rpc:'||p_operation_key);
  RETURN jsonb_build_object('operation',public.communication_operation_json(v_operation),'replayed',false);
END;
$$;

CREATE OR REPLACE FUNCTION public.communication_reconcile_prepared(
  p_tenant_id uuid,p_kind text,p_id uuid,p_reason text,p_source text
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_catalog
AS $$
DECLARE v_operation public.communication_operations%ROWTYPE; v_count integer:=0;
BEGIN
  FOR v_operation IN SELECT * FROM public.communication_operations o
    WHERE o.tenant_id=p_tenant_id AND o.state='prepared' AND (
      (p_kind='job' AND o.reminder_job_id=p_id) OR
      (p_kind='appointment' AND o.appointment_id=p_id) OR
      (p_kind='patient' AND o.patient_id=p_id) OR
      (p_kind='contact' AND o.contact_id=p_id) OR
      (p_kind='route' AND o.route_id=p_id)
    ) ORDER BY o.id FOR UPDATE
  LOOP
    PERFORM public.communication_cancel_prepared(v_operation.id,p_reason,p_source);
    v_count:=v_count+1;
  END LOOP;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.communication_reconcile_job_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_catalog
AS $$
BEGIN
  IF OLD.updated_at IS DISTINCT FROM NEW.updated_at OR OLD.state IS DISTINCT FROM NEW.state THEN
    PERFORM public.communication_reconcile_prepared(NEW.tenant_id,'job',NEW.id,'reminder_job_changed','reminder_trigger');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER appointment_reminder_jobs_communication_reconcile
AFTER UPDATE ON public.appointment_reminder_jobs
FOR EACH ROW EXECUTE FUNCTION public.communication_reconcile_job_trigger();

CREATE OR REPLACE FUNCTION public.communication_reconcile_appointment_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_catalog
AS $$
BEGIN
  IF OLD.updated_at IS DISTINCT FROM NEW.updated_at OR OLD.status IS DISTINCT FROM NEW.status
     OR OLD.start_time IS DISTINCT FROM NEW.start_time THEN
    PERFORM public.communication_reconcile_prepared(
      NEW.tenant_id,'appointment',NEW.id,'appointment_changed','appointment_trigger'
    );
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER appointments_communication_reconcile
AFTER UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.communication_reconcile_appointment_trigger();

CREATE OR REPLACE FUNCTION public.communication_reconcile_contact_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_catalog
AS $$
BEGIN
  PERFORM public.communication_reconcile_prepared(NEW.tenant_id,'contact',NEW.id,'contact_changed','contact_trigger');
  RETURN NEW;
END;
$$;
CREATE TRIGGER patient_contacts_communication_reconcile
AFTER UPDATE ON public.patient_communication_contacts
FOR EACH ROW EXECUTE FUNCTION public.communication_reconcile_contact_trigger();

CREATE OR REPLACE FUNCTION public.communication_reconcile_preferences_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_catalog
AS $$
BEGIN
  PERFORM public.communication_reconcile_prepared(
    NEW.tenant_id,'patient',NEW.patient_id,'preferences_changed','preferences_trigger'
  );
  RETURN NEW;
END;
$$;
CREATE TRIGGER patient_preferences_communication_reconcile
AFTER UPDATE ON public.patient_communication_preferences
FOR EACH ROW EXECUTE FUNCTION public.communication_reconcile_preferences_trigger();

CREATE OR REPLACE FUNCTION public.communication_reconcile_route_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_catalog
AS $$
BEGIN
  IF OLD.enabled IS DISTINCT FROM NEW.enabled
     OR OLD.configuration_version IS DISTINCT FROM NEW.configuration_version
     OR OLD.archived_at IS DISTINCT FROM NEW.archived_at THEN
    PERFORM public.communication_reconcile_prepared(
      NEW.tenant_id,'route',NEW.id,'route_changed','route_trigger'
    );
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER communication_routes_operation_reconcile
AFTER UPDATE ON public.communication_routes
FOR EACH ROW EXECUTE FUNCTION public.communication_reconcile_route_trigger();

REVOKE ALL ON FUNCTION public.communication_hash(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.communication_mask_destination(text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.communication_tenant_role(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.communication_tenant_role(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.communication_require_manager(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.communication_route_json(public.communication_routes) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.communication_operation_json(public.communication_operations) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.communication_record_event(public.communication_operations,text,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.communication_record_route_event(public.communication_routes,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.communication_purpose(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.communication_cancel_prepared(uuid,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.communication_invalid_reason(public.communication_operations) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.communication_reconcile_prepared(uuid,text,uuid,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.communication_write_guard() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.communication_reconcile_job_trigger() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.communication_reconcile_appointment_trigger() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.communication_reconcile_contact_trigger() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.communication_reconcile_preferences_trigger() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.communication_reconcile_route_trigger() FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.create_or_update_communication_route(uuid,uuid,text,text,boolean,integer,timestamptz,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.disable_communication_route(uuid,uuid,timestamptz,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.list_communication_routes(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.prepare_communication_operation(uuid,uuid,text,text,timestamptz,timestamptz) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.simulate_communication_operation(uuid,uuid,text,text,timestamptz) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.recover_communication_operation(uuid,uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.cancel_communication_operation(uuid,uuid,text) FROM PUBLIC,anon;

GRANT EXECUTE ON FUNCTION public.create_or_update_communication_route(uuid,uuid,text,text,boolean,integer,timestamptz,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.disable_communication_route(uuid,uuid,timestamptz,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_communication_routes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_communication_operation(uuid,uuid,text,text,timestamptz,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.simulate_communication_operation(uuid,uuid,text,text,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recover_communication_operation(uuid,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_communication_operation(uuid,uuid,text) TO authenticated;

COMMENT ON TABLE public.communication_operations IS
  'Immutable provider-neutral communication commands and snapshots. A row is not a sent or delivered message.';
COMMENT ON TABLE public.communication_routes IS
  'Tenant-scoped simulation-only routes. Only noop and mock adapters are permitted.';
COMMENT ON COLUMN public.communication_operations.command IS
  'Safe structured command containing masked destination and allowlisted variables only.';
COMMENT ON COLUMN public.communication_operations.adapter_result_code IS
  'Normalized simulation result. accepted is not sent or delivered.';

COMMIT;
