-- COMMUNICATION-TEMPLATE-FOUNDATION-001
-- Tenant-scoped, versioned, plain-text communication templates.
-- No provider, outbound HTTP, delivery worker or cloud operation is introduced.

CREATE TABLE public.communication_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  purpose_code text NOT NULL CHECK (purpose_code IN (
    'appointment_confirmation_request',
    'appointment_day_before_reminder',
    'appointment_same_day_reminder',
    'appointment_control_call_task'
  )),
  channel text NOT NULL CHECK (channel IN ('sms','whatsapp','email')),
  language text NOT NULL CHECK (language IN ('ru','kk','en')),
  display_name text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 200),
  status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('active','inactive','archived')),
  active_version_id uuid,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  archived_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata)='object' AND metadata='{}'::jsonb),
  UNIQUE (tenant_id,id),
  CHECK ((status='archived') = (archived_at IS NOT NULL)),
  CHECK ((status='active') = (active_version_id IS NOT NULL))
);
CREATE UNIQUE INDEX communication_templates_current_identity_unique
  ON public.communication_templates(tenant_id,purpose_code,channel,language)
  WHERE archived_at IS NULL;
CREATE INDEX communication_templates_tenant_status_idx
  ON public.communication_templates(tenant_id,status,purpose_code,channel,language,id);

CREATE TABLE public.communication_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_id uuid NOT NULL,
  version_number integer NOT NULL CHECK (version_number >= 1),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','superseded','archived')),
  subject text,
  body text NOT NULL,
  variable_keys text[] NOT NULL DEFAULT '{}'::text[],
  content_fingerprint text NOT NULL CHECK (content_fingerprint ~ '^[0-9a-f]{64}$'),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at timestamptz,
  archived_at timestamptz,
  supersedes_version_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata)='object' AND metadata='{}'::jsonb),
  UNIQUE (tenant_id,id),
  UNIQUE (tenant_id,template_id,id),
  UNIQUE (template_id,version_number),
  FOREIGN KEY (tenant_id,template_id)
    REFERENCES public.communication_templates(tenant_id,id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id,supersedes_version_id)
    REFERENCES public.communication_template_versions(tenant_id,id) ON DELETE RESTRICT,
  CHECK (
    (status='draft' AND published_at IS NULL AND published_by IS NULL AND archived_at IS NULL)
    OR (status='published' AND published_at IS NOT NULL AND published_by IS NOT NULL AND archived_at IS NULL)
    OR (status='superseded' AND published_at IS NOT NULL AND published_by IS NOT NULL AND archived_at IS NULL)
    OR (status='archived' AND archived_at IS NOT NULL)
  )
);
CREATE UNIQUE INDEX communication_template_versions_one_draft
  ON public.communication_template_versions(template_id) WHERE status='draft';
CREATE UNIQUE INDEX communication_template_versions_one_published
  ON public.communication_template_versions(template_id) WHERE status='published';
CREATE INDEX communication_template_versions_tenant_template_idx
  ON public.communication_template_versions(tenant_id,template_id,version_number DESC,id);

ALTER TABLE public.communication_templates
  ADD CONSTRAINT communication_templates_active_version_fk
  FOREIGN KEY (tenant_id,id,active_version_id)
  REFERENCES public.communication_template_versions(tenant_id,template_id,id)
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE public.communication_template_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  operation_key text NOT NULL CHECK (
    length(operation_key) BETWEEN 8 AND 200
    AND operation_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
  ),
  operation_type text NOT NULL CHECK (operation_type IN (
    'template_create','draft_create','draft_update','version_publish','template_archive'
  )),
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  result jsonb NOT NULL CHECK (jsonb_typeof(result)='object'),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (tenant_id,operation_key)
);

ALTER TABLE public.communication_operations
  ADD COLUMN template_id uuid,
  ADD COLUMN template_version_id uuid,
  ADD COLUMN template_version_number integer,
  ADD COLUMN template_content_fingerprint text,
  ADD COLUMN rendered_content_fingerprint text,
  ADD COLUMN rendered_subject text,
  ADD COLUMN rendered_body text,
  ADD COLUMN rendered_character_count integer,
  ADD COLUMN template_snapshot jsonb;

ALTER TABLE public.communication_operations
  ADD CONSTRAINT communication_operations_template_fk
  FOREIGN KEY (tenant_id,template_id)
  REFERENCES public.communication_templates(tenant_id,id) ON DELETE RESTRICT,
  ADD CONSTRAINT communication_operations_template_version_fk
  FOREIGN KEY (tenant_id,template_id,template_version_id)
  REFERENCES public.communication_template_versions(tenant_id,template_id,id) ON DELETE RESTRICT,
  ADD CONSTRAINT communication_operations_template_snapshot_check CHECK (
    (template_id IS NULL AND template_version_id IS NULL AND template_version_number IS NULL
      AND template_content_fingerprint IS NULL AND rendered_content_fingerprint IS NULL
      AND rendered_subject IS NULL AND rendered_body IS NULL AND rendered_character_count IS NULL
      AND template_snapshot IS NULL)
    OR
    (template_id IS NOT NULL AND template_version_id IS NOT NULL AND template_version_number >= 1
      AND template_content_fingerprint ~ '^[0-9a-f]{64}$'
      AND rendered_content_fingerprint ~ '^[0-9a-f]{64}$'
      AND rendered_body IS NOT NULL AND rendered_character_count >= 0
      AND jsonb_typeof(template_snapshot)='object'
      AND ((channel='email' AND rendered_subject IS NOT NULL) OR (channel<>'email' AND rendered_subject IS NULL)))
  );
CREATE INDEX communication_operations_template_version_idx
  ON public.communication_operations(tenant_id,template_version_id,prepared_at DESC,id)
  WHERE template_version_id IS NOT NULL;

ALTER TABLE public.communication_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_template_operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY communication_templates_read_policy ON public.communication_templates
FOR SELECT TO authenticated
USING (public.communication_tenant_role(tenant_id) IN ('clinic_owner','clinic_admin','registrar'));
CREATE POLICY communication_template_versions_read_policy ON public.communication_template_versions
FOR SELECT TO authenticated
USING (public.communication_tenant_role(tenant_id) IN ('clinic_owner','clinic_admin','registrar'));

CREATE OR REPLACE FUNCTION public.communication_template_write_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_catalog
AS $$
BEGIN
  IF current_setting('app.communication_template_internal',true)<>'on'
     AND current_user<>'postgres' AND coalesce(auth.role(),'')<>'service_role' THEN
    RAISE EXCEPTION 'Прямое изменение шаблонов запрещено.' USING ERRCODE='42501';
  END IF;
  IF TG_TABLE_NAME='communication_template_versions' THEN
    IF TG_OP='UPDATE' AND OLD.status IN ('published','superseded','archived')
       AND (
         NEW.subject IS DISTINCT FROM OLD.subject OR NEW.body IS DISTINCT FROM OLD.body
         OR NEW.variable_keys IS DISTINCT FROM OLD.variable_keys
         OR NEW.content_fingerprint IS DISTINCT FROM OLD.content_fingerprint
         OR NEW.version_number IS DISTINCT FROM OLD.version_number
         OR NEW.template_id IS DISTINCT FROM OLD.template_id
         OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       ) THEN
      RAISE EXCEPTION 'Опубликованную версию нельзя изменить. Создайте новую версию.' USING ERRCODE='55000';
    END IF;
  END IF;
  IF TG_OP='DELETE' AND current_user<>'postgres' AND coalesce(auth.role(),'')<>'service_role' THEN
    RAISE EXCEPTION 'Удаление шаблонов запрещено.' USING ERRCODE='42501';
  END IF;
  RETURN coalesce(NEW,OLD);
END;
$$;
CREATE TRIGGER communication_templates_write_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.communication_templates
FOR EACH ROW EXECUTE FUNCTION public.communication_template_write_guard();
CREATE TRIGGER communication_template_versions_write_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.communication_template_versions
FOR EACH ROW EXECUTE FUNCTION public.communication_template_write_guard();

CREATE OR REPLACE FUNCTION public.communication_template_validate_identity(
  p_purpose text,p_channel text,p_language text
) RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path=public,pg_catalog
AS $$
BEGIN
  IF p_purpose NOT IN (
    'appointment_confirmation_request','appointment_day_before_reminder',
    'appointment_same_day_reminder','appointment_control_call_task'
  ) THEN
    RAISE EXCEPTION 'Назначение шаблона не поддерживается.' USING ERRCODE='22023';
  END IF;
  IF p_channel NOT IN ('sms','whatsapp','email') THEN
    RAISE EXCEPTION 'Канал шаблона не поддерживается.' USING ERRCODE='22023';
  END IF;
  IF p_language NOT IN ('ru','kk','en') THEN
    RAISE EXCEPTION 'Язык шаблона не поддерживается.' USING ERRCODE='22023';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.communication_template_validate_content(
  p_channel text,p_subject text,p_body text
) RETURNS text[] LANGUAGE plpgsql IMMUTABLE SET search_path=public,pg_catalog
AS $$
DECLARE v_source text; v_residual text; v_match text[]; v_key text; v_keys text[]:='{}';
  v_allowed constant text[]:=ARRAY[
    'patient_first_name','clinic_name','appointment_date','appointment_time',
    'doctor_display_name','clinic_callback_phone'
  ];
  v_forbidden constant text[]:=ARRAY[
    'diagnosis','complaint','finding','tooth','treatment','treatment_plan','procedure',
    'balance','debt','invoice','payment','discount','document','medical_result',
    'raw_phone','raw_email'
  ];
BEGIN
  IF p_channel NOT IN ('sms','whatsapp','email') THEN
    RAISE EXCEPTION 'Канал шаблона не поддерживается.' USING ERRCODE='22023';
  END IF;
  IF p_body IS NULL OR btrim(p_body)='' THEN
    RAISE EXCEPTION 'Текст шаблона не может быть пустым.' USING ERRCODE='22023';
  END IF;
  IF p_channel='email' AND (p_subject IS NULL OR btrim(p_subject)='') THEN
    RAISE EXCEPTION 'Для email-шаблона требуется тема.' USING ERRCODE='22023';
  END IF;
  IF p_channel<>'email' AND p_subject IS NOT NULL AND btrim(p_subject)<>'' THEN
    RAISE EXCEPTION 'Тема разрешена только для email-шаблона.' USING ERRCODE='22023';
  END IF;
  IF p_channel='sms' AND char_length(p_body)>1000
     OR p_channel='whatsapp' AND char_length(p_body)>4000
     OR p_channel='email' AND char_length(p_body)>10000
     OR p_subject IS NOT NULL AND char_length(p_subject)>200 THEN
    RAISE EXCEPTION 'Текст шаблона превышает допустимую длину.' USING ERRCODE='22023';
  END IF;
  IF regexp_replace(coalesce(p_subject,'')||p_body,E'[\n\r\t]','','g') ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'Шаблон содержит недопустимые управляющие символы.' USING ERRCODE='22023';
  END IF;
  IF coalesce(p_subject,'') ~ '<\/?[A-Za-z][^>]*>' OR p_body ~ '<\/?[A-Za-z][^>]*>' THEN
    RAISE EXCEPTION 'HTML и исполняемая разметка в шаблонах запрещены.' USING ERRCODE='22023';
  END IF;
  v_source:=coalesce(p_subject,'')||E'\n'||p_body;
  FOR v_match IN SELECT regexp_matches(v_source,'\{\{([a-z][a-z0-9_]*)\}\}','g') LOOP
    v_key:=v_match[1];
    IF v_key=ANY(v_forbidden) THEN
      RAISE EXCEPTION 'Шаблон содержит запрещённую клиническую или финансовую переменную.' USING ERRCODE='22023';
    END IF;
    IF NOT v_key=ANY(v_allowed) THEN
      RAISE EXCEPTION 'Шаблон содержит неизвестную или некорректную переменную.' USING ERRCODE='22023';
    END IF;
    IF NOT v_key=ANY(v_keys) THEN v_keys:=array_append(v_keys,v_key); END IF;
  END LOOP;
  v_residual:=regexp_replace(v_source,'\{\{[a-z][a-z0-9_]*\}\}','','g');
  IF v_residual ~ '[{}]' THEN
    RAISE EXCEPTION 'Шаблон содержит неизвестную или некорректную переменную.' USING ERRCODE='22023';
  END IF;
  RETURN coalesce((SELECT array_agg(k ORDER BY k) FROM unnest(v_keys) k),'{}'::text[]);
END;
$$;

CREATE OR REPLACE FUNCTION public.communication_template_render_content(
  p_channel text,p_subject text,p_body text,p_variables jsonb
) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=public,pg_catalog
AS $$
DECLARE v_required text[]; v_key text; v_subject text; v_body text; v_value text;
  v_fingerprint text; v_warnings jsonb:='[]'::jsonb;
BEGIN
  IF jsonb_typeof(coalesce(p_variables,'{}'::jsonb))<>'object' THEN
    RAISE EXCEPTION 'Переменные шаблона должны быть объектом.' USING ERRCODE='22023';
  END IF;
  v_required:=public.communication_template_validate_content(p_channel,p_subject,p_body);
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(coalesce(p_variables,'{}'::jsonb)) k WHERE NOT k=ANY(v_required)) THEN
    RAISE EXCEPTION 'Переданы лишние или неизвестные переменные шаблона.' USING ERRCODE='22023';
  END IF;
  v_subject:=CASE WHEN p_subject IS NULL THEN NULL ELSE btrim(p_subject) END;
  v_body:=p_body;
  FOREACH v_key IN ARRAY v_required LOOP
    IF NOT coalesce(p_variables,'{}'::jsonb) ? v_key
       OR jsonb_typeof(p_variables->v_key)<>'string'
       OR btrim(p_variables->>v_key)='' THEN
      RAISE EXCEPTION 'Для формирования сообщения не хватает обязательных данных.' USING ERRCODE='P0002';
    END IF;
    v_value:=p_variables->>v_key;
    IF regexp_replace(v_value,E'[\n\r\t]','','g') ~ '[[:cntrl:]]'
       OR v_value ~ '<\/?[A-Za-z][^>]*>' OR char_length(v_value)>500 THEN
      RAISE EXCEPTION 'Значение переменной шаблона недопустимо.' USING ERRCODE='22023';
    END IF;
    v_subject:=CASE WHEN v_subject IS NULL THEN NULL ELSE replace(v_subject,'{{'||v_key||'}}',v_value) END;
    v_body:=replace(v_body,'{{'||v_key||'}}',v_value);
  END LOOP;
  IF p_channel='sms' AND char_length(v_body)>160 THEN
    v_warnings:=jsonb_build_array('sms_practical_single_message_length');
  END IF;
  v_fingerprint:=public.communication_hash(jsonb_build_object(
    'channel',p_channel,'subject',v_subject,'body',v_body,'variableKeys',v_required
  )::text);
  RETURN jsonb_build_object(
    'subject',v_subject,'body',v_body,
    'renderedCharacterCount',char_length(v_body)+coalesce(char_length(v_subject),0),
    'renderedFingerprint',v_fingerprint,'variableKeys',to_jsonb(v_required),'warnings',v_warnings
  );
END;
$$;


CREATE OR REPLACE FUNCTION public.communication_template_version_json(
  p_version public.communication_template_versions
) RETURNS jsonb LANGUAGE sql STABLE SET search_path=public,pg_catalog
AS $$
SELECT jsonb_build_object(
  'id',p_version.id,'tenantId',p_version.tenant_id,'templateId',p_version.template_id,
  'versionNumber',p_version.version_number,'status',p_version.status,
  'subject',p_version.subject,'body',p_version.body,'variableKeys',to_jsonb(p_version.variable_keys),
  'contentFingerprint',p_version.content_fingerprint,'createdBy',p_version.created_by,
  'createdAt',p_version.created_at,'updatedAt',p_version.updated_at,
  'publishedBy',p_version.published_by,'publishedAt',p_version.published_at,
  'archivedAt',p_version.archived_at,'supersedesVersionId',p_version.supersedes_version_id
)
$$;

CREATE OR REPLACE FUNCTION public.communication_template_json(
  p_template public.communication_templates
) RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=public,pg_catalog
AS $$
DECLARE v_active public.communication_template_versions%ROWTYPE;
  v_draft public.communication_template_versions%ROWTYPE;
BEGIN
  IF p_template.active_version_id IS NOT NULL THEN
    SELECT * INTO v_active FROM public.communication_template_versions
    WHERE tenant_id=p_template.tenant_id AND template_id=p_template.id AND id=p_template.active_version_id;
  END IF;
  SELECT * INTO v_draft FROM public.communication_template_versions
  WHERE tenant_id=p_template.tenant_id AND template_id=p_template.id AND status='draft'
  ORDER BY version_number DESC,id DESC LIMIT 1;
  RETURN jsonb_build_object(
    'id',p_template.id,'tenantId',p_template.tenant_id,'purposeCode',p_template.purpose_code,
    'channel',p_template.channel,'language',p_template.language,'displayName',p_template.display_name,
    'status',p_template.status,'activeVersionId',p_template.active_version_id,
    'activeVersion',CASE WHEN v_active.id IS NULL THEN NULL ELSE public.communication_template_version_json(v_active) END,
    'draftVersion',CASE WHEN v_draft.id IS NULL THEN NULL ELSE public.communication_template_version_json(v_draft) END,
    'createdAt',p_template.created_at,'updatedAt',p_template.updated_at,'archivedAt',p_template.archived_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.communication_template_operation_replay(
  p_tenant_id uuid,p_operation_key text,p_operation_type text,p_fingerprint text
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_catalog
AS $$
DECLARE v_saved public.communication_template_operations%ROWTYPE;
BEGIN
  IF p_operation_key IS NULL OR length(p_operation_key) NOT BETWEEN 8 AND 200
     OR p_operation_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$' THEN
    RAISE EXCEPTION 'Не удалось выполнить операцию с шаблоном.' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_saved FROM public.communication_template_operations
  WHERE tenant_id=p_tenant_id AND operation_key=p_operation_key;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_saved.operation_type<>p_operation_type OR v_saved.fingerprint<>p_fingerprint THEN
    RAISE EXCEPTION 'Операция уже выполнена с другими параметрами.' USING ERRCODE='23505';
  END IF;
  RETURN v_saved.result || jsonb_build_object('replayed',true);
END;
$$;

CREATE OR REPLACE FUNCTION public.communication_template_store_operation(
  p_tenant_id uuid,p_operation_key text,p_operation_type text,p_fingerprint text,p_result jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_catalog
AS $$
BEGIN
  INSERT INTO public.communication_template_operations(tenant_id,operation_key,operation_type,fingerprint,result)
  VALUES(p_tenant_id,p_operation_key,p_operation_type,p_fingerprint,p_result);
END;
$$;

CREATE OR REPLACE FUNCTION public.communication_template_record_event(
  p_template public.communication_templates,
  p_version public.communication_template_versions,
  p_action text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_catalog
AS $$
DECLARE v_audit uuid; v_role text; v_target text; v_target_id text; v_metadata jsonb;
BEGIN
  v_role:=public.communication_tenant_role(p_template.tenant_id);
  v_target:=CASE WHEN p_version.id IS NULL THEN 'communication_template' ELSE 'communication_template_version' END;
  v_target_id:=coalesce(p_version.id,p_template.id)::text;
  v_metadata:=jsonb_strip_nulls(jsonb_build_object(
    'templateId',p_template.id,'versionId',p_version.id,'purposeCode',p_template.purpose_code,
    'channel',p_template.channel,'language',p_template.language,'versionNumber',p_version.version_number,
    'contentFingerprint',p_version.content_fingerprint
  ));
  v_audit:=public.record_audit_event_internal(
    p_tenant_id=>p_template.tenant_id,p_action=>p_action,p_category=>'tenant',
    p_target_type=>v_target,p_target_id=>v_target_id,p_actor_user_id=>auth.uid(),
    p_actor_tenant_role=>v_role,p_before_data=>'{}',p_after_data=>'{}',p_diff_data=>'{}',
    p_redaction_level=>'standard',p_metadata=>v_metadata
  );
  PERFORM public.record_activity_event_internal(
    p_tenant_id=>p_template.tenant_id,p_category=>'system',p_type=>p_action,
    p_title=>CASE p_action
      WHEN 'communication_template_created' THEN 'Создан шаблон коммуникации'
      WHEN 'communication_template_draft_created' THEN 'Создан черновик шаблона коммуникации'
      WHEN 'communication_template_draft_updated' THEN 'Обновлён черновик шаблона коммуникации'
      WHEN 'communication_template_published' THEN 'Опубликована версия шаблона коммуникации'
      WHEN 'communication_template_superseded' THEN 'Предыдущая версия шаблона заменена'
      WHEN 'communication_template_archived' THEN 'Шаблон коммуникации архивирован'
      ELSE 'Изменён шаблон коммуникации' END,
    p_source_type=>v_target,p_source_id=>v_target_id,p_audit_event_id=>v_audit,
    p_actor_user_id=>auth.uid(),p_visibility=>'admin',p_metadata=>v_metadata
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.communication_require_manager(p_tenant_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=public,pg_catalog
AS $manager$
DECLARE v_role text;
BEGIN
  v_role:=public.communication_tenant_role(p_tenant_id);
  IF v_role IS NULL OR v_role NOT IN ('clinic_owner','clinic_admin') THEN
    RAISE EXCEPTION 'Недостаточно прав для работы с коммуникациями.' USING ERRCODE='42501';
  END IF;
  RETURN v_role;
END;
$manager$;

CREATE OR REPLACE FUNCTION public.list_communication_templates(
  p_tenant_id uuid,p_purpose_code text DEFAULT NULL,p_channel text DEFAULT NULL,p_language text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_catalog
AS $$
DECLARE v_role text;
BEGIN
  v_role:=public.communication_tenant_role(p_tenant_id);
  IF v_role IS NULL OR v_role NOT IN ('clinic_owner','clinic_admin','registrar') THEN
    RAISE EXCEPTION 'Недостаточно прав для управления шаблонами.' USING ERRCODE='42501';
  END IF;
  IF p_purpose_code IS NOT NULL OR p_channel IS NOT NULL OR p_language IS NOT NULL THEN
    PERFORM public.communication_template_validate_identity(
      coalesce(p_purpose_code,'appointment_confirmation_request'),
      coalesce(p_channel,'sms'),coalesce(p_language,'ru')
    );
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(public.communication_template_json(t)
      ORDER BY t.purpose_code,t.channel,t.language,t.created_at,t.id)
    FROM public.communication_templates t
    WHERE t.tenant_id=p_tenant_id
      AND (p_purpose_code IS NULL OR t.purpose_code=p_purpose_code)
      AND (p_channel IS NULL OR t.channel=p_channel)
      AND (p_language IS NULL OR t.language=p_language)
  ),'[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_communication_template(
  p_tenant_id uuid,p_template_id uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_catalog
AS $$
DECLARE v_role text; v_template public.communication_templates%ROWTYPE;
BEGIN
  v_role:=public.communication_tenant_role(p_tenant_id);
  IF v_role IS NULL OR v_role NOT IN ('clinic_owner','clinic_admin','registrar') THEN
    RAISE EXCEPTION 'Недостаточно прав для управления шаблонами.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_template FROM public.communication_templates
  WHERE tenant_id=p_tenant_id AND id=p_template_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN public.communication_template_json(v_template);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_active_communication_template(
  p_tenant_id uuid,p_purpose_code text,p_channel text,p_language text
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_catalog
AS $$
DECLARE v_role text; v_template public.communication_templates%ROWTYPE;
  v_version public.communication_template_versions%ROWTYPE;
BEGIN
  v_role:=public.communication_tenant_role(p_tenant_id);
  IF v_role IS NULL OR v_role NOT IN ('clinic_owner','clinic_admin','registrar') THEN
    RAISE EXCEPTION 'Недостаточно прав для управления шаблонами.' USING ERRCODE='42501';
  END IF;
  PERFORM public.communication_template_validate_identity(p_purpose_code,p_channel,p_language);
  SELECT * INTO v_template FROM public.communication_templates
  WHERE tenant_id=p_tenant_id AND purpose_code=p_purpose_code
    AND channel=p_channel AND language=p_language
    AND status='active' AND archived_at IS NULL AND active_version_id IS NOT NULL;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO v_version FROM public.communication_template_versions
  WHERE tenant_id=p_tenant_id AND template_id=v_template.id
    AND id=v_template.active_version_id AND status='published';
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'template',public.communication_template_json(v_template),
    'version',public.communication_template_version_json(v_version)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.preview_communication_template(
  p_tenant_id uuid,p_version_id uuid,p_variables jsonb
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_catalog
AS $$
DECLARE v_role text; v_version public.communication_template_versions%ROWTYPE;
  v_template public.communication_templates%ROWTYPE; v_render jsonb;
BEGIN
  v_role:=public.communication_tenant_role(p_tenant_id);
  IF v_role IS NULL OR v_role NOT IN ('clinic_owner','clinic_admin','registrar') THEN
    RAISE EXCEPTION 'Недостаточно прав для управления шаблонами.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_version FROM public.communication_template_versions
  WHERE tenant_id=p_tenant_id AND id=p_version_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Шаблон не найден.' USING ERRCODE='P0002'; END IF;
  SELECT * INTO v_template FROM public.communication_templates
  WHERE tenant_id=p_tenant_id AND id=v_version.template_id;
  v_render:=public.communication_template_render_content(
    v_template.channel,v_version.subject,v_version.body,p_variables
  );
  RETURN jsonb_build_object(
    'templateId',v_template.id,'versionId',v_version.id,'versionNumber',v_version.version_number,
    'purposeCode',v_template.purpose_code,'channel',v_template.channel,'language',v_template.language,
    'contentFingerprint',v_version.content_fingerprint,'rendered',v_render
  );
END;
$$;


CREATE OR REPLACE FUNCTION public.create_communication_template(
  p_tenant_id uuid,p_purpose_code text,p_channel text,p_language text,p_display_name text,
  p_subject text,p_body text,p_operation_key text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_catalog
AS $$
DECLARE v_role text; v_keys text[]; v_content_fingerprint text; v_fingerprint text;
  v_replay jsonb; v_result jsonb; v_template public.communication_templates%ROWTYPE;
  v_version public.communication_template_versions%ROWTYPE; v_empty public.communication_template_versions%ROWTYPE;
BEGIN
  v_role:=public.communication_require_manager(p_tenant_id);
  PERFORM public.communication_template_validate_identity(p_purpose_code,p_channel,p_language);
  IF p_display_name IS NULL OR length(btrim(p_display_name)) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'Название шаблона не указано.' USING ERRCODE='22023';
  END IF;
  v_keys:=public.communication_template_validate_content(p_channel,p_subject,p_body);
  v_content_fingerprint:=public.communication_hash(jsonb_build_object(
    'channel',p_channel,'subject',nullif(btrim(coalesce(p_subject,'')),''),
    'body',p_body,'variableKeys',v_keys
  )::text);
  v_fingerprint:=public.communication_hash(jsonb_build_object(
    'purposeCode',p_purpose_code,'channel',p_channel,'language',p_language,
    'displayName',btrim(p_display_name),'contentFingerprint',v_content_fingerprint
  )::text);
  PERFORM pg_advisory_xact_lock(hashtextextended('communication-template:'||p_tenant_id||':'||p_operation_key,0));
  v_replay:=public.communication_template_operation_replay(
    p_tenant_id,p_operation_key,'template_create',v_fingerprint
  );
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  IF EXISTS (
    SELECT 1 FROM public.communication_templates
    WHERE tenant_id=p_tenant_id AND purpose_code=p_purpose_code
      AND channel=p_channel AND language=p_language AND archived_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Шаблон для выбранных цели, канала и языка уже существует.' USING ERRCODE='23505';
  END IF;

  PERFORM set_config('app.communication_template_internal','on',true);
  INSERT INTO public.communication_templates(
    tenant_id,purpose_code,channel,language,display_name,status,created_by,updated_by
  ) VALUES(
    p_tenant_id,p_purpose_code,p_channel,p_language,btrim(p_display_name),'inactive',auth.uid(),auth.uid()
  ) RETURNING * INTO v_template;
  INSERT INTO public.communication_template_versions(
    tenant_id,template_id,version_number,status,subject,body,variable_keys,content_fingerprint,created_by
  ) VALUES(
    p_tenant_id,v_template.id,1,'draft',nullif(btrim(coalesce(p_subject,'')),''),p_body,v_keys,
    v_content_fingerprint,auth.uid()
  ) RETURNING * INTO v_version;
  PERFORM set_config('app.communication_template_internal','off',true);

  PERFORM public.communication_template_record_event(v_template,v_empty,'communication_template_created');
  PERFORM public.communication_template_record_event(v_template,v_version,'communication_template_draft_created');
  v_result:=jsonb_build_object(
    'template',public.communication_template_json(v_template),
    'version',public.communication_template_version_json(v_version)
  );
  PERFORM public.communication_template_store_operation(
    p_tenant_id,p_operation_key,'template_create',v_fingerprint,v_result
  );
  RETURN v_result||jsonb_build_object('replayed',false);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_communication_template_draft(
  p_tenant_id uuid,p_template_id uuid,p_operation_key text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_catalog
AS $$
DECLARE v_role text; v_template public.communication_templates%ROWTYPE;
  v_active public.communication_template_versions%ROWTYPE; v_version public.communication_template_versions%ROWTYPE;
  v_number integer; v_fingerprint text; v_replay jsonb; v_result jsonb;
BEGIN
  v_role:=public.communication_require_manager(p_tenant_id);
  PERFORM pg_advisory_xact_lock(hashtextextended('communication-template:'||p_tenant_id||':'||p_operation_key,0));
  SELECT * INTO v_template FROM public.communication_templates
  WHERE tenant_id=p_tenant_id AND id=p_template_id FOR UPDATE;
  IF NOT FOUND OR v_template.status='archived' THEN
    RAISE EXCEPTION 'Шаблон не найден.' USING ERRCODE='P0002';
  END IF;
  v_fingerprint:=public.communication_hash(jsonb_build_object(
    'templateId',p_template_id,'activeVersionId',v_template.active_version_id,'action','draft_create'
  )::text);
  v_replay:=public.communication_template_operation_replay(
    p_tenant_id,p_operation_key,'draft_create',v_fingerprint
  );
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  IF EXISTS (SELECT 1 FROM public.communication_template_versions
    WHERE tenant_id=p_tenant_id AND template_id=p_template_id AND status='draft') THEN
    RAISE EXCEPTION 'У шаблона уже есть черновик.' USING ERRCODE='23505';
  END IF;
  IF v_template.active_version_id IS NOT NULL THEN
    SELECT * INTO v_active FROM public.communication_template_versions
    WHERE tenant_id=p_tenant_id AND template_id=p_template_id AND id=v_template.active_version_id FOR SHARE;
  END IF;
  SELECT coalesce(max(version_number),0)+1 INTO v_number
  FROM public.communication_template_versions WHERE tenant_id=p_tenant_id AND template_id=p_template_id;
  PERFORM set_config('app.communication_template_internal','on',true);
  INSERT INTO public.communication_template_versions(
    tenant_id,template_id,version_number,status,subject,body,variable_keys,content_fingerprint,
    created_by,supersedes_version_id
  ) VALUES(
    p_tenant_id,p_template_id,v_number,'draft',v_active.subject,coalesce(v_active.body,''),
    coalesce(v_active.variable_keys,'{}'::text[]),
    coalesce(v_active.content_fingerprint,public.communication_hash(jsonb_build_object(
      'channel',v_template.channel,'subject',NULL,'body','','variableKeys','[]'::jsonb
    )::text)),auth.uid(),v_template.active_version_id
  ) RETURNING * INTO v_version;
  UPDATE public.communication_templates SET updated_by=auth.uid(),updated_at=transaction_timestamp()
  WHERE tenant_id=p_tenant_id AND id=p_template_id RETURNING * INTO v_template;
  PERFORM set_config('app.communication_template_internal','off',true);
  PERFORM public.communication_template_record_event(v_template,v_version,'communication_template_draft_created');
  v_result:=jsonb_build_object(
    'template',public.communication_template_json(v_template),
    'version',public.communication_template_version_json(v_version)
  );
  PERFORM public.communication_template_store_operation(
    p_tenant_id,p_operation_key,'draft_create',v_fingerprint,v_result
  );
  RETURN v_result||jsonb_build_object('replayed',false);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_communication_template_draft(
  p_tenant_id uuid,p_version_id uuid,p_subject text,p_body text,
  p_expected_updated_at timestamptz,p_operation_key text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_catalog
AS $$
DECLARE v_role text; v_template public.communication_templates%ROWTYPE;
  v_version public.communication_template_versions%ROWTYPE; v_keys text[];
  v_content_fingerprint text; v_fingerprint text; v_replay jsonb; v_result jsonb;
BEGIN
  v_role:=public.communication_require_manager(p_tenant_id);
  PERFORM pg_advisory_xact_lock(hashtextextended('communication-template:'||p_tenant_id||':'||p_operation_key,0));
  SELECT * INTO v_version FROM public.communication_template_versions
  WHERE tenant_id=p_tenant_id AND id=p_version_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Шаблон не найден.' USING ERRCODE='P0002'; END IF;
  SELECT * INTO v_template FROM public.communication_templates
  WHERE tenant_id=p_tenant_id AND id=v_version.template_id FOR UPDATE;
  IF v_version.status<>'draft' THEN
    RAISE EXCEPTION 'Опубликованную версию нельзя изменить. Создайте новую версию.' USING ERRCODE='55000';
  END IF;
  IF v_template.status='archived' THEN RAISE EXCEPTION 'Шаблон не найден.' USING ERRCODE='P0002'; END IF;
  v_keys:=public.communication_template_validate_content(v_template.channel,p_subject,p_body);
  v_content_fingerprint:=public.communication_hash(jsonb_build_object(
    'channel',v_template.channel,'subject',nullif(btrim(coalesce(p_subject,'')),''),
    'body',p_body,'variableKeys',v_keys
  )::text);
  v_fingerprint:=public.communication_hash(jsonb_build_object(
    'versionId',p_version_id,'expectedUpdatedAt',p_expected_updated_at,
    'contentFingerprint',v_content_fingerprint
  )::text);
  v_replay:=public.communication_template_operation_replay(
    p_tenant_id,p_operation_key,'draft_update',v_fingerprint
  );
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  IF p_expected_updated_at IS NULL OR v_version.updated_at<>p_expected_updated_at THEN
    RAISE EXCEPTION 'Черновик был изменён другим пользователем. Обновите данные.' USING ERRCODE='40001';
  END IF;
  PERFORM set_config('app.communication_template_internal','on',true);
  UPDATE public.communication_template_versions SET
    subject=nullif(btrim(coalesce(p_subject,'')),''),body=p_body,variable_keys=v_keys,
    content_fingerprint=v_content_fingerprint,updated_at=transaction_timestamp()
  WHERE tenant_id=p_tenant_id AND id=p_version_id RETURNING * INTO v_version;
  UPDATE public.communication_templates SET updated_by=auth.uid(),updated_at=transaction_timestamp()
  WHERE tenant_id=p_tenant_id AND id=v_template.id RETURNING * INTO v_template;
  PERFORM set_config('app.communication_template_internal','off',true);
  PERFORM public.communication_template_record_event(v_template,v_version,'communication_template_draft_updated');
  v_result:=jsonb_build_object(
    'template',public.communication_template_json(v_template),
    'version',public.communication_template_version_json(v_version)
  );
  PERFORM public.communication_template_store_operation(
    p_tenant_id,p_operation_key,'draft_update',v_fingerprint,v_result
  );
  RETURN v_result||jsonb_build_object('replayed',false);
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_communication_template_version(
  p_tenant_id uuid,p_template_id uuid,p_draft_version_id uuid,
  p_expected_draft_updated_at timestamptz,p_operation_key text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_catalog
AS $$
DECLARE v_role text; v_template public.communication_templates%ROWTYPE;
  v_draft public.communication_template_versions%ROWTYPE; v_previous public.communication_template_versions%ROWTYPE;
  v_fingerprint text; v_replay jsonb; v_result jsonb;
BEGIN
  v_role:=public.communication_require_manager(p_tenant_id);
  PERFORM pg_advisory_xact_lock(hashtextextended('communication-template-publish:'||p_tenant_id||':'||p_template_id,0));
  PERFORM pg_advisory_xact_lock(hashtextextended('communication-template:'||p_tenant_id||':'||p_operation_key,0));
  SELECT * INTO v_template FROM public.communication_templates
  WHERE tenant_id=p_tenant_id AND id=p_template_id FOR UPDATE;
  IF NOT FOUND OR v_template.status='archived' THEN RAISE EXCEPTION 'Шаблон не найден.' USING ERRCODE='P0002'; END IF;
  SELECT * INTO v_draft FROM public.communication_template_versions
  WHERE tenant_id=p_tenant_id AND template_id=p_template_id AND id=p_draft_version_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Шаблон не найден.' USING ERRCODE='P0002'; END IF;
  v_fingerprint:=public.communication_hash(jsonb_build_object(
    'templateId',p_template_id,'draftVersionId',p_draft_version_id,
    'expectedUpdatedAt',p_expected_draft_updated_at,'contentFingerprint',v_draft.content_fingerprint
  )::text);
  v_replay:=public.communication_template_operation_replay(
    p_tenant_id,p_operation_key,'version_publish',v_fingerprint
  );
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  IF v_draft.status<>'draft' THEN
    RAISE EXCEPTION 'Опубликованную версию нельзя изменить. Создайте новую версию.' USING ERRCODE='55000';
  END IF;
  PERFORM public.communication_template_validate_content(v_template.channel,v_draft.subject,v_draft.body);
  IF p_expected_draft_updated_at IS NULL OR v_draft.updated_at<>p_expected_draft_updated_at THEN
    RAISE EXCEPTION 'Черновик был изменён другим пользователем. Обновите данные.' USING ERRCODE='40001';
  END IF;
  IF v_template.active_version_id IS NOT NULL THEN
    SELECT * INTO v_previous FROM public.communication_template_versions
    WHERE tenant_id=p_tenant_id AND template_id=p_template_id AND id=v_template.active_version_id FOR UPDATE;
  END IF;
  PERFORM set_config('app.communication_template_internal','on',true);
  IF v_previous.id IS NOT NULL THEN
    UPDATE public.communication_template_versions SET status='superseded',updated_at=transaction_timestamp()
    WHERE tenant_id=p_tenant_id AND id=v_previous.id RETURNING * INTO v_previous;
  END IF;
  UPDATE public.communication_template_versions SET
    status='published',published_by=auth.uid(),published_at=transaction_timestamp(),updated_at=transaction_timestamp()
  WHERE tenant_id=p_tenant_id AND id=p_draft_version_id RETURNING * INTO v_draft;
  UPDATE public.communication_templates SET
    status='active',active_version_id=v_draft.id,updated_by=auth.uid(),updated_at=transaction_timestamp(),archived_at=NULL
  WHERE tenant_id=p_tenant_id AND id=p_template_id RETURNING * INTO v_template;
  PERFORM set_config('app.communication_template_internal','off',true);
  IF v_previous.id IS NOT NULL THEN
    PERFORM public.communication_template_record_event(v_template,v_previous,'communication_template_superseded');
  END IF;
  PERFORM public.communication_template_record_event(v_template,v_draft,'communication_template_published');
  v_result:=jsonb_build_object(
    'template',public.communication_template_json(v_template),
    'version',public.communication_template_version_json(v_draft),
    'supersededVersion',CASE WHEN v_previous.id IS NULL THEN NULL ELSE public.communication_template_version_json(v_previous) END
  );
  PERFORM public.communication_template_store_operation(
    p_tenant_id,p_operation_key,'version_publish',v_fingerprint,v_result
  );
  RETURN v_result||jsonb_build_object('replayed',false);
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_communication_template(
  p_tenant_id uuid,p_template_id uuid,p_expected_updated_at timestamptz,p_operation_key text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_catalog
AS $$
DECLARE v_role text; v_template public.communication_templates%ROWTYPE;
  v_active public.communication_template_versions%ROWTYPE; v_empty public.communication_template_versions%ROWTYPE;
  v_fingerprint text; v_replay jsonb; v_result jsonb;
BEGIN
  v_role:=public.communication_require_manager(p_tenant_id);
  PERFORM pg_advisory_xact_lock(hashtextextended('communication-template-publish:'||p_tenant_id||':'||p_template_id,0));
  PERFORM pg_advisory_xact_lock(hashtextextended('communication-template:'||p_tenant_id||':'||p_operation_key,0));
  SELECT * INTO v_template FROM public.communication_templates
  WHERE tenant_id=p_tenant_id AND id=p_template_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Шаблон не найден.' USING ERRCODE='P0002'; END IF;
  v_fingerprint:=public.communication_hash(jsonb_build_object(
    'templateId',p_template_id,'expectedUpdatedAt',p_expected_updated_at,'action','archive'
  )::text);
  v_replay:=public.communication_template_operation_replay(
    p_tenant_id,p_operation_key,'template_archive',v_fingerprint
  );
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  IF p_expected_updated_at IS NULL OR v_template.updated_at<>p_expected_updated_at THEN
    RAISE EXCEPTION 'Шаблон был изменён другим пользователем. Обновите данные.' USING ERRCODE='40001';
  END IF;
  IF v_template.active_version_id IS NOT NULL THEN
    SELECT * INTO v_active FROM public.communication_template_versions
    WHERE tenant_id=p_tenant_id AND template_id=p_template_id AND id=v_template.active_version_id FOR UPDATE;
  END IF;
  PERFORM set_config('app.communication_template_internal','on',true);
  IF v_active.id IS NOT NULL THEN
    UPDATE public.communication_template_versions SET status='archived',archived_at=transaction_timestamp(),updated_at=transaction_timestamp()
    WHERE tenant_id=p_tenant_id AND id=v_active.id RETURNING * INTO v_active;
  END IF;
  UPDATE public.communication_template_versions SET status='archived',archived_at=transaction_timestamp(),updated_at=transaction_timestamp()
  WHERE tenant_id=p_tenant_id AND template_id=p_template_id AND status='draft';
  UPDATE public.communication_templates SET
    status='archived',active_version_id=NULL,archived_at=transaction_timestamp(),updated_by=auth.uid(),updated_at=transaction_timestamp()
  WHERE tenant_id=p_tenant_id AND id=p_template_id RETURNING * INTO v_template;
  PERFORM set_config('app.communication_template_internal','off',true);
  IF v_active.id IS NULL THEN
    PERFORM public.communication_template_record_event(v_template,v_empty,'communication_template_archived');
  ELSE
    PERFORM public.communication_template_record_event(v_template,v_active,'communication_template_archived');
  END IF;
  v_result:=jsonb_build_object('template',public.communication_template_json(v_template));
  PERFORM public.communication_template_store_operation(
    p_tenant_id,p_operation_key,'template_archive',v_fingerprint,v_result
  );
  RETURN v_result||jsonb_build_object('replayed',false);
END;
$$;


CREATE OR REPLACE FUNCTION public.communication_purpose(p_reminder_type text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public,pg_catalog
AS $purpose$
SELECT CASE p_reminder_type
  WHEN 'confirmation_request' THEN 'appointment_confirmation_request'
  WHEN 'day_before_reminder' THEN 'appointment_day_before_reminder'
  WHEN 'same_day_reminder' THEN 'appointment_same_day_reminder'
  WHEN 'control_call_task' THEN 'appointment_control_call_task'
  WHEN 'callback_task' THEN 'appointment_control_call_task'
  ELSE NULL END
$purpose$;

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
  'templateId',p_operation.template_id,'templateVersionId',p_operation.template_version_id,
  'templateVersionNumber',p_operation.template_version_number,
  'templateContentFingerprint',p_operation.template_content_fingerprint,
  'renderedContentFingerprint',p_operation.rendered_content_fingerprint,
  'renderedSubject',p_operation.rendered_subject,'renderedBody',p_operation.rendered_body,
  'renderedCharacterCount',p_operation.rendered_character_count,
  'templateSnapshot',p_operation.template_snapshot,
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
DECLARE v_audit uuid; v_role text; v_safe jsonb;
BEGIN
  v_role:=public.communication_tenant_role(p_operation.tenant_id);
  v_safe:=jsonb_strip_nulls(jsonb_build_object(
    'id',p_operation.id,'state',p_operation.state,'reminderJobId',p_operation.reminder_job_id,
    'appointmentId',p_operation.appointment_id,'purposeCode',p_operation.purpose_code,
    'channel',p_operation.channel,'language',p_operation.language,'routeId',p_operation.route_id,
    'routeVersion',p_operation.route_version,'adapterCode',p_operation.adapter_code,
    'templateId',p_operation.template_id,'templateVersionId',p_operation.template_version_id,
    'templateVersionNumber',p_operation.template_version_number,
    'templateContentFingerprint',p_operation.template_content_fingerprint,
    'renderedContentFingerprint',p_operation.rendered_content_fingerprint,
    'adapterResultCode',p_operation.adapter_result_code,'safeErrorCode',p_operation.safe_error_code
  ));
  v_audit:=public.record_audit_event_internal(
    p_tenant_id=>p_operation.tenant_id,p_action=>p_action,p_category=>'appointment',
    p_target_type=>'communication_operation',p_target_id=>p_operation.id::text,
    p_actor_user_id=>auth.uid(),p_actor_tenant_role=>v_role,
    p_patient_id=>p_operation.patient_id,p_appointment_id=>p_operation.appointment_id::text,
    p_before_data=>jsonb_build_object('state',coalesce(p_before->>'state',p_operation.state)),
    p_after_data=>v_safe,
    p_diff_data=>jsonb_build_object('state',jsonb_build_object('from',p_before->>'state','to',p_operation.state)),
    p_redaction_level=>'standard',p_metadata=>coalesce(p_metadata,'{}')||jsonb_build_object(
      'reminderJobId',p_operation.reminder_job_id,'purposeCode',p_operation.purpose_code,
      'channel',p_operation.channel,'templateVersionId',p_operation.template_version_id,
      'renderedContentFingerprint',p_operation.rendered_content_fingerprint
    )
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
    p_visibility=>'admin',p_metadata=>jsonb_strip_nulls(jsonb_build_object(
      'appointmentId',p_operation.appointment_id,'reminderJobId',p_operation.reminder_job_id,
      'channel',p_operation.channel,'state',p_operation.state,'safeErrorCode',p_operation.safe_error_code,
      'templateVersionId',p_operation.template_version_id,
      'renderedContentFingerprint',p_operation.rendered_content_fingerprint
    )||coalesce(p_metadata,'{}'))
  );
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
  v_route public.communication_routes%ROWTYPE; v_template public.communication_templates%ROWTYPE;
  v_template_version public.communication_template_versions%ROWTYPE;
  v_doctor text; v_clinic text; v_timezone text; v_language text;
  v_eligibility jsonb; v_purpose text; v_consent text; v_channel_suppressed boolean;
  v_channel_reason text; v_channel_at timestamptz; v_available_variables jsonb; v_render_variables jsonb:='{}';
  v_key text; v_render jsonb; v_template_snapshot jsonb;
  v_eligibility_snapshot jsonb; v_consent_snapshot jsonb; v_suppression_snapshot jsonb;
  v_contact_snapshot jsonb; v_appointment_snapshot jsonb; v_route_snapshot jsonb;
  v_command jsonb; v_payload jsonb; v_fingerprint text; v_operation public.communication_operations%ROWTYPE;
  v_operation_id uuid:=gen_random_uuid(); v_masked text; v_destination_fingerprint text;
BEGIN
  v_role:=public.communication_require_manager(p_tenant_id);
  IF p_channel NOT IN ('sms','whatsapp','email') THEN
    RAISE EXCEPTION 'Канал коммуникации не поддерживается.' USING ERRCODE='22023';
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
    RAISE EXCEPTION 'Назначение шаблона не поддерживается.' USING ERRCODE='22023';
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
  v_language:=coalesce(v_contact.language,v_pref.preferred_language);
  IF v_language NOT IN ('ru','kk','en') THEN
    RAISE EXCEPTION 'Язык шаблона не поддерживается.' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_template FROM public.communication_templates
  WHERE tenant_id=p_tenant_id AND purpose_code=v_purpose AND channel=p_channel AND language=v_language
    AND status='active' AND archived_at IS NULL AND active_version_id IS NOT NULL FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Для выбранного канала и языка нет активного шаблона.' USING ERRCODE='P0002';
  END IF;
  SELECT * INTO v_template_version FROM public.communication_template_versions
  WHERE tenant_id=p_tenant_id AND template_id=v_template.id AND id=v_template.active_version_id
    AND status='published' FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Для выбранного канала и языка нет активного шаблона.' USING ERRCODE='P0002';
  END IF;
  PERFORM public.communication_template_validate_content(
    p_channel,v_template_version.subject,v_template_version.body
  );

  v_masked:=public.communication_mask_destination(v_contact.contact_value_normalized,p_channel);
  v_destination_fingerprint:=public.communication_hash(v_contact.contact_value_normalized);
  v_available_variables:=jsonb_strip_nulls(jsonb_build_object(
    'patient_first_name',split_part(btrim(v_patient.full_name),' ',1),
    'clinic_name',v_clinic,
    'appointment_date',to_char(v_appt.start_time AT TIME ZONE v_timezone,'YYYY-MM-DD'),
    'appointment_time',to_char(v_appt.start_time AT TIME ZONE v_timezone,'HH24:MI'),
    'doctor_display_name',v_doctor,
    'clinic_callback_phone',NULL
  ));
  FOREACH v_key IN ARRAY v_template_version.variable_keys LOOP
    IF NOT v_available_variables ? v_key OR btrim(v_available_variables->>v_key)='' THEN
      RAISE EXCEPTION 'Для формирования сообщения не хватает обязательных данных.' USING ERRCODE='P0002';
    END IF;
    v_render_variables:=v_render_variables||jsonb_build_object(v_key,v_available_variables->>v_key);
  END LOOP;
  v_render:=public.communication_template_render_content(
    p_channel,v_template_version.subject,v_template_version.body,v_render_variables
  );
  v_template_snapshot:=jsonb_build_object(
    'templateId',v_template.id,'templateVersionId',v_template_version.id,
    'versionNumber',v_template_version.version_number,
    'contentFingerprint',v_template_version.content_fingerprint,
    'renderedContentFingerprint',v_render->>'renderedFingerprint',
    'language',v_template.language,'channel',v_template.channel,'purposeCode',v_template.purpose_code,
    'variableKeys',to_jsonb(v_template_version.variable_keys)
  );

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
    'representativeRelation',v_contact.representative_relation,'language',v_language
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
    'purposeCode',v_purpose,'channel',p_channel,'language',v_language,
    'maskedDestination',v_masked,'destinationFingerprint',v_destination_fingerprint,
    'operationKey',p_operation_key,'variables',v_render_variables,'requestedAt',transaction_timestamp(),
    'template',v_template_snapshot,
    'renderedContent',jsonb_build_object(
      'subject',v_render->'subject','body',v_render->>'body',
      'renderedCharacterCount',(v_render->>'renderedCharacterCount')::integer,
      'renderedFingerprint',v_render->>'renderedFingerprint'
    )
  );
  v_payload:=jsonb_build_object(
    'tenantId',p_tenant_id,'reminderJobId',v_job.id,'appointmentId',v_appt.id,
    'patientId',v_patient.id,'contactId',v_contact.id,'purposeCode',v_purpose,
    'channel',p_channel,'language',v_language,'appointmentUpdatedAt',v_appt.updated_at,
    'reminderJobUpdatedAt',v_job.updated_at,'contactUpdatedAt',v_contact.updated_at,
    'consentEventId',v_consent_event.id,'consentState',v_consent,
    'globalSuppression',v_pref.global_suppression,'channelSuppression',v_channel_suppressed,
    'routeId',v_route.id,'routeVersion',v_route.configuration_version,
    'templateId',v_template.id,'templateVersionId',v_template_version.id,
    'templateVersionNumber',v_template_version.version_number,
    'templateContentFingerprint',v_template_version.content_fingerprint,
    'renderedContentFingerprint',v_render->>'renderedFingerprint','variables',v_render_variables
  );
  v_fingerprint:=public.communication_hash(v_payload::text);

  PERFORM set_config('app.communication_internal','on',true);
  INSERT INTO public.communication_operations(
    id,tenant_id,reminder_job_id,appointment_id,patient_id,contact_id,purpose_code,channel,language,
    operation_key,payload_fingerprint,appointment_updated_at,reminder_job_updated_at,contact_updated_at,
    policy_version,eligibility_version,route_id,route_version,adapter_code,created_by,
    template_id,template_version_id,template_version_number,template_content_fingerprint,
    rendered_content_fingerprint,rendered_subject,rendered_body,rendered_character_count,template_snapshot,
    eligibility_snapshot,consent_snapshot,suppression_snapshot,contact_snapshot,appointment_snapshot,
    route_snapshot,command,metadata
  ) VALUES(
    v_operation_id,p_tenant_id,v_job.id,v_appt.id,v_patient.id,v_contact.id,v_purpose,p_channel,v_language,
    p_operation_key,v_fingerprint,v_appt.updated_at,v_job.updated_at,v_contact.updated_at,
    v_job.policy_version,1,v_route.id,v_route.configuration_version,v_route.adapter_code,auth.uid(),
    v_template.id,v_template_version.id,v_template_version.version_number,v_template_version.content_fingerprint,
    v_render->>'renderedFingerprint',nullif(v_render->>'subject',''),v_render->>'body',
    (v_render->>'renderedCharacterCount')::integer,v_template_snapshot,
    v_eligibility_snapshot,v_consent_snapshot,v_suppression_snapshot,v_contact_snapshot,
    v_appointment_snapshot,v_route_snapshot,v_command,jsonb_build_object('simulationOnly',true)
  ) RETURNING * INTO v_operation;
  PERFORM set_config('app.communication_internal','off',true);
  PERFORM public.communication_record_event(
    v_operation,'communication_operation_prepared','{}','{}',jsonb_build_object(
      'templateId',v_template.id,'templateVersionId',v_template_version.id,
      'templateVersionNumber',v_template_version.version_number,
      'templateContentFingerprint',v_template_version.content_fingerprint,
      'renderedContentFingerprint',v_render->>'renderedFingerprint'
    )
  );
  RETURN jsonb_build_object('operation',public.communication_operation_json(v_operation),'replayed',false);
END;
$$;


REVOKE ALL ON public.communication_templates FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.communication_template_versions FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.communication_template_operations FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.communication_templates,public.communication_template_versions TO authenticated;
GRANT ALL ON public.communication_templates,public.communication_template_versions,public.communication_template_operations TO service_role;

REVOKE ALL ON FUNCTION public.communication_template_write_guard() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.communication_template_validate_identity(text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.communication_template_validate_content(text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.communication_template_render_content(text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.communication_template_version_json(public.communication_template_versions) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.communication_template_json(public.communication_templates) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.communication_template_operation_replay(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.communication_template_store_operation(uuid,text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.communication_template_record_event(public.communication_templates,public.communication_template_versions,text) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.list_communication_templates(uuid,text,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.get_communication_template(uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.get_active_communication_template(uuid,text,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.preview_communication_template(uuid,uuid,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.create_communication_template(uuid,text,text,text,text,text,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.create_communication_template_draft(uuid,uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.update_communication_template_draft(uuid,uuid,text,text,timestamptz,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.publish_communication_template_version(uuid,uuid,uuid,timestamptz,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.archive_communication_template(uuid,uuid,timestamptz,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_communication_templates(uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_communication_template(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_communication_template(uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_communication_template(uuid,uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_communication_template(uuid,text,text,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_communication_template_draft(uuid,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_communication_template_draft(uuid,uuid,text,text,timestamptz,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_communication_template_version(uuid,uuid,uuid,timestamptz,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_communication_template(uuid,uuid,timestamptz,text) TO authenticated;

REVOKE ALL ON FUNCTION public.communication_operation_json(public.communication_operations) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.communication_record_event(public.communication_operations,text,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.prepare_communication_operation(uuid,uuid,text,text,timestamptz,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.prepare_communication_operation(uuid,uuid,text,text,timestamptz,timestamptz) TO authenticated;

COMMENT ON TABLE public.communication_templates IS 'Stable tenant/purpose/channel/language template identity. A template is not a message.';
COMMENT ON TABLE public.communication_template_versions IS 'Versioned plain-text template content. Published content is immutable.';
COMMENT ON TABLE public.communication_template_operations IS 'Idempotency records for controlled template mutations.';
