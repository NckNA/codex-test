-- APPOINTMENT-REMINDER-CONTACT-CONSENT-FOUNDATION-001
-- Authoritative tenant-scoped contacts, preferences, consent evidence and provider-neutral eligibility.
-- No delivery, provider, worker, cron, webhook or cloud behavior is introduced.

BEGIN;

CREATE OR REPLACE FUNCTION public.normalize_patient_phone_e164(p_raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_raw text := btrim(coalesce(p_raw, ''));
  v_digits text;
  v_normalized text;
BEGIN
  IF v_raw = '' OR left(v_raw, 1) <> '+' THEN
    RETURN NULL;
  END IF;
  IF v_raw ~* '(ext\.?|доб\.?|x\s*[0-9]|#|;)' THEN
    RETURN NULL;
  END IF;
  v_digits := regexp_replace(substr(v_raw, 2), '[^0-9]', '', 'g');
  v_normalized := '+' || v_digits;
  IF v_normalized ~ '^\+[1-9][0-9]{7,14}$' THEN
    RETURN v_normalized;
  END IF;
  RETURN NULL;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.normalize_patient_email(p_raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_normalized text := lower(btrim(coalesce(p_raw, '')));
BEGIN
  IF v_normalized ~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$' THEN
    RETURN v_normalized;
  END IF;
  RETURN NULL;
END;
$fn$;

CREATE TABLE public.patient_communication_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  contact_type text NOT NULL CHECK (contact_type IN ('phone', 'email')),
  contact_value_raw text NOT NULL CHECK (length(btrim(contact_value_raw)) > 0),
  contact_value_normalized text,
  country_code text,
  is_primary boolean NOT NULL DEFAULT false,
  is_verified boolean NOT NULL DEFAULT false,
  verification_source text CHECK (verification_source IS NULL OR verification_source IN (
    'import_legacy', 'staff_entered', 'patient_confirmed', 'representative_confirmed', 'other'
  )),
  owner_type text NOT NULL DEFAULT 'patient' CHECK (owner_type IN ('patient', 'representative')),
  representative_name text,
  representative_relation text CHECK (representative_relation IS NULL OR representative_relation IN (
    'parent', 'guardian', 'spouse', 'child', 'caregiver', 'other'
  )),
  language text CHECK (language IS NULL OR language IN ('ru', 'kk', 'en')),
  possible_duplicate boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  archived_at timestamptz,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, patient_id) REFERENCES public.patients(tenant_id, id) ON DELETE CASCADE,
  CHECK (
    (contact_type = 'phone' AND (contact_value_normalized IS NULL OR contact_value_normalized ~ '^\+[1-9][0-9]{7,14}$'))
    OR
    (contact_type = 'email' AND (contact_value_normalized IS NULL OR contact_value_normalized = lower(contact_value_normalized)))
  ),
  CHECK (
    owner_type = 'patient'
    OR (
      owner_type = 'representative'
      AND length(btrim(coalesce(representative_name, ''))) > 0
      AND representative_relation IS NOT NULL
    )
  ),
  CHECK (owner_type = 'representative' OR (representative_name IS NULL AND representative_relation IS NULL)),
  CHECK (NOT is_primary OR archived_at IS NULL),
  CHECK (NOT is_verified OR contact_value_normalized IS NOT NULL),
  CHECK (NOT is_verified OR verification_source IS NOT NULL)
);

CREATE INDEX idx_patient_communication_contacts_patient
  ON public.patient_communication_contacts(tenant_id, patient_id, contact_type, archived_at);
CREATE INDEX idx_patient_communication_contacts_normalized
  ON public.patient_communication_contacts(tenant_id, contact_type, contact_value_normalized)
  WHERE archived_at IS NULL AND contact_value_normalized IS NOT NULL;
CREATE UNIQUE INDEX uq_patient_primary_phone
  ON public.patient_communication_contacts(tenant_id, patient_id)
  WHERE contact_type = 'phone' AND is_primary AND archived_at IS NULL;
CREATE UNIQUE INDEX uq_patient_primary_email
  ON public.patient_communication_contacts(tenant_id, patient_id)
  WHERE contact_type = 'email' AND is_primary AND archived_at IS NULL;

CREATE TABLE public.patient_communication_preferences (
  tenant_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  preferred_language text NOT NULL DEFAULT 'ru' CHECK (preferred_language IN ('ru', 'kk', 'en')),
  preferred_channel text NOT NULL DEFAULT 'none' CHECK (preferred_channel IN ('phone', 'whatsapp', 'sms', 'email', 'none')),
  allow_manual_phone boolean NOT NULL DEFAULT true,
  sms_consent_state text NOT NULL DEFAULT 'unknown' CHECK (sms_consent_state IN ('unknown', 'granted', 'denied', 'withdrawn')),
  whatsapp_consent_state text NOT NULL DEFAULT 'unknown' CHECK (whatsapp_consent_state IN ('unknown', 'granted', 'denied', 'withdrawn')),
  email_consent_state text NOT NULL DEFAULT 'unknown' CHECK (email_consent_state IN ('unknown', 'granted', 'denied', 'withdrawn')),
  phone_suppressed boolean NOT NULL DEFAULT false,
  phone_suppression_reason text,
  phone_suppressed_at timestamptz,
  phone_suppressed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sms_suppressed boolean NOT NULL DEFAULT false,
  sms_suppression_reason text,
  sms_suppressed_at timestamptz,
  sms_suppressed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  whatsapp_suppressed boolean NOT NULL DEFAULT false,
  whatsapp_suppression_reason text,
  whatsapp_suppressed_at timestamptz,
  whatsapp_suppressed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email_suppressed boolean NOT NULL DEFAULT false,
  email_suppression_reason text,
  email_suppressed_at timestamptz,
  email_suppressed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  global_suppression boolean NOT NULL DEFAULT false,
  global_suppression_reason text,
  global_suppressed_at timestamptz,
  global_suppressed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (tenant_id, patient_id),
  FOREIGN KEY (tenant_id, patient_id) REFERENCES public.patients(tenant_id, id) ON DELETE CASCADE,
  CHECK (phone_suppression_reason IS NULL OR phone_suppression_reason IN ('patient_request','representative_request','invalid_contact','wrong_number','duplicate_contact','legal_restriction','staff_decision','other')),
  CHECK (sms_suppression_reason IS NULL OR sms_suppression_reason IN ('patient_request','representative_request','invalid_contact','wrong_number','duplicate_contact','legal_restriction','staff_decision','other')),
  CHECK (whatsapp_suppression_reason IS NULL OR whatsapp_suppression_reason IN ('patient_request','representative_request','invalid_contact','wrong_number','duplicate_contact','legal_restriction','staff_decision','other')),
  CHECK (email_suppression_reason IS NULL OR email_suppression_reason IN ('patient_request','representative_request','invalid_contact','wrong_number','duplicate_contact','legal_restriction','staff_decision','other')),
  CHECK (global_suppression_reason IS NULL OR global_suppression_reason IN ('patient_request','representative_request','invalid_contact','wrong_number','duplicate_contact','legal_restriction','staff_decision','other')),
  CHECK (phone_suppressed OR (phone_suppression_reason IS NULL AND phone_suppressed_at IS NULL)),
  CHECK (sms_suppressed OR (sms_suppression_reason IS NULL AND sms_suppressed_at IS NULL)),
  CHECK (whatsapp_suppressed OR (whatsapp_suppression_reason IS NULL AND whatsapp_suppressed_at IS NULL)),
  CHECK (email_suppressed OR (email_suppression_reason IS NULL AND email_suppressed_at IS NULL)),
  CHECK (global_suppression OR (global_suppression_reason IS NULL AND global_suppressed_at IS NULL))
);

CREATE TABLE public.patient_communication_consent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  channel text NOT NULL CHECK (channel IN ('sms', 'whatsapp', 'email')),
  previous_state text NOT NULL CHECK (previous_state IN ('unknown', 'granted', 'denied', 'withdrawn')),
  new_state text NOT NULL CHECK (new_state IN ('unknown', 'granted', 'denied', 'withdrawn')),
  source text NOT NULL CHECK (source IN (
    'patient_verbal', 'patient_written', 'representative_verbal', 'representative_written',
    'staff_correction', 'import_legacy', 'system'
  )),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  occurred_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  operation_key text NOT NULL,
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  FOREIGN KEY (tenant_id, patient_id) REFERENCES public.patients(tenant_id, id) ON DELETE CASCADE,
  UNIQUE (tenant_id, operation_key)
);
CREATE INDEX idx_patient_communication_consent_events_patient
  ON public.patient_communication_consent_events(tenant_id, patient_id, occurred_at DESC, id);

CREATE TABLE public.patient_communication_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  operation_key text NOT NULL,
  operation_type text NOT NULL,
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  patient_id uuid NOT NULL,
  result jsonb NOT NULL CHECK (jsonb_typeof(result) = 'object'),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  FOREIGN KEY (tenant_id, patient_id) REFERENCES public.patients(tenant_id, id) ON DELETE CASCADE,
  UNIQUE (tenant_id, operation_key)
);
CREATE INDEX idx_patient_communication_operations_patient
  ON public.patient_communication_operations(tenant_id, patient_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.patient_communication_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
BEGIN
  NEW.updated_at := transaction_timestamp();
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER patient_communication_contacts_touch_updated_at
BEFORE UPDATE ON public.patient_communication_contacts
FOR EACH ROW EXECUTE FUNCTION public.patient_communication_touch_updated_at();
CREATE TRIGGER patient_communication_preferences_touch_updated_at
BEFORE UPDATE ON public.patient_communication_preferences
FOR EACH ROW EXECUTE FUNCTION public.patient_communication_touch_updated_at();

CREATE OR REPLACE FUNCTION public.patient_communication_consent_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF current_user IN ('postgres', 'service_role') THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Consent history is append-only.' USING ERRCODE = '42501';
END;
$fn$;
CREATE TRIGGER patient_communication_consent_append_only_guard
BEFORE UPDATE OR DELETE ON public.patient_communication_consent_events
FOR EACH ROW EXECUTE FUNCTION public.patient_communication_consent_append_only();

CREATE OR REPLACE FUNCTION public.patient_communication_role(p_tenant_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT tu.role::text
  FROM public.tenant_users tu
  WHERE tu.tenant_id = p_tenant_id AND tu.user_id = auth.uid()
$fn$;

CREATE OR REPLACE FUNCTION public.patient_communication_assert_patient(p_tenant_id uuid, p_patient_id uuid)
RETURNS public.patients
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_patient public.patients%ROWTYPE;
BEGIN
  SELECT * INTO v_patient
  FROM public.patients p
  WHERE p.tenant_id = p_tenant_id AND p.id = p_patient_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Недостаточно прав для изменения настроек связи.' USING ERRCODE = '42501';
  END IF;
  RETURN v_patient;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.patient_communication_operation_replay(
  p_tenant_id uuid,
  p_operation_key text,
  p_operation_type text,
  p_fingerprint text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_operation public.patient_communication_operations%ROWTYPE;
BEGIN
  IF p_operation_key IS NULL OR length(btrim(p_operation_key)) < 8 OR length(p_operation_key) > 200 THEN
    RAISE EXCEPTION 'Не удалось сохранить настройки связи.' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('patient-communication:' || p_tenant_id::text || ':' || p_operation_key, 0));
  SELECT * INTO v_operation
  FROM public.patient_communication_operations o
  WHERE o.tenant_id = p_tenant_id AND o.operation_key = p_operation_key;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF v_operation.operation_type <> p_operation_type OR v_operation.fingerprint <> p_fingerprint THEN
    RAISE EXCEPTION 'Эта операция уже выполнена с другими параметрами.' USING ERRCODE = '23505';
  END IF;
  RETURN v_operation.result || jsonb_build_object('replayed', true);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.patient_communication_store_operation(
  p_tenant_id uuid,
  p_patient_id uuid,
  p_operation_key text,
  p_operation_type text,
  p_fingerprint text,
  p_result jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  INSERT INTO public.patient_communication_operations(
    tenant_id, patient_id, operation_key, operation_type, fingerprint, actor_user_id, result
  ) VALUES (
    p_tenant_id, p_patient_id, btrim(p_operation_key), p_operation_type, p_fingerprint, auth.uid(), p_result
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.record_patient_communication_audit_internal(
  p_tenant_id uuid,
  p_patient_id uuid,
  p_action text,
  p_target_type text,
  p_target_id text,
  p_before jsonb,
  p_after jsonb,
  p_reason text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_audit uuid;
  v_role text := public.patient_communication_role(p_tenant_id);
BEGIN
  v_audit := public.record_audit_event_internal(
    p_tenant_id => p_tenant_id,
    p_action => p_action,
    p_category => 'patient',
    p_target_type => p_target_type,
    p_target_id => p_target_id,
    p_actor_user_id => auth.uid(),
    p_actor_role => 'authenticated',
    p_actor_tenant_role => v_role,
    p_severity => 'info',
    p_patient_id => p_patient_id,
    p_before_data => p_before,
    p_after_data => p_after,
    p_redaction_level => 'restricted',
    p_reason => p_reason,
    p_metadata => coalesce(p_metadata, '{}'::jsonb)
  );
  PERFORM public.record_activity_event_internal(
    p_tenant_id => p_tenant_id,
    p_category => 'patient',
    p_type => p_action,
    p_title => 'Настройки связи пациента изменены',
    p_source_type => p_target_type,
    p_source_id => p_target_id,
    p_patient_id => p_patient_id,
    p_audit_event_id => v_audit,
    p_actor_user_id => auth.uid(),
    p_description => p_reason,
    p_visibility => 'admin',
    p_severity => 'info',
    p_metadata => coalesce(p_metadata, '{}'::jsonb)
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.patient_communication_contact_json(p_contact public.patient_communication_contacts)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $fn$
  SELECT jsonb_build_object(
    'id', p_contact.id,
    'tenantId', p_contact.tenant_id,
    'patientId', p_contact.patient_id,
    'contactType', p_contact.contact_type,
    'contactValueRaw', p_contact.contact_value_raw,
    'contactValueNormalized', p_contact.contact_value_normalized,
    'countryCode', p_contact.country_code,
    'isPrimary', p_contact.is_primary,
    'isVerified', p_contact.is_verified,
    'verificationSource', p_contact.verification_source,
    'ownerType', p_contact.owner_type,
    'representativeName', p_contact.representative_name,
    'representativeRelation', p_contact.representative_relation,
    'language', p_contact.language,
    'possibleDuplicate', p_contact.possible_duplicate,
    'createdBy', p_contact.created_by,
    'updatedBy', p_contact.updated_by,
    'createdAt', p_contact.created_at,
    'updatedAt', p_contact.updated_at,
    'archivedAt', p_contact.archived_at
  )
$fn$;

CREATE OR REPLACE FUNCTION public.patient_communication_preferences_json(p_preferences public.patient_communication_preferences)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $fn$
  SELECT jsonb_build_object(
    'tenantId', p_preferences.tenant_id,
    'patientId', p_preferences.patient_id,
    'preferredLanguage', p_preferences.preferred_language,
    'preferredChannel', p_preferences.preferred_channel,
    'allowManualPhone', p_preferences.allow_manual_phone,
    'smsConsentState', p_preferences.sms_consent_state,
    'whatsappConsentState', p_preferences.whatsapp_consent_state,
    'emailConsentState', p_preferences.email_consent_state,
    'phoneSuppressed', p_preferences.phone_suppressed,
    'phoneSuppressionReason', p_preferences.phone_suppression_reason,
    'smsSuppressed', p_preferences.sms_suppressed,
    'smsSuppressionReason', p_preferences.sms_suppression_reason,
    'whatsappSuppressed', p_preferences.whatsapp_suppressed,
    'whatsappSuppressionReason', p_preferences.whatsapp_suppression_reason,
    'emailSuppressed', p_preferences.email_suppressed,
    'emailSuppressionReason', p_preferences.email_suppression_reason,
    'globalSuppression', p_preferences.global_suppression,
    'globalSuppressionReason', p_preferences.global_suppression_reason,
    'createdAt', p_preferences.created_at,
    'updatedAt', p_preferences.updated_at,
    'updatedBy', p_preferences.updated_by
  )
$fn$;

CREATE OR REPLACE FUNCTION public.upsert_patient_communication_contact(
  p_tenant_id uuid,
  p_patient_id uuid,
  p_contact_id uuid,
  p_contact_type text,
  p_contact_value_raw text,
  p_is_primary boolean,
  p_is_verified boolean,
  p_verification_source text,
  p_owner_type text,
  p_representative_name text,
  p_representative_relation text,
  p_language text,
  p_expected_updated_at timestamptz,
  p_operation_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_role text := public.patient_communication_role(p_tenant_id);
  v_patient public.patients%ROWTYPE;
  v_before public.patient_communication_contacts%ROWTYPE;
  v_after public.patient_communication_contacts%ROWTYPE;
  v_normalized text;
  v_country text;
  v_fingerprint text;
  v_replay jsonb;
  v_duplicate boolean;
  v_action text;
  v_result jsonb;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('clinic_owner', 'clinic_admin', 'registrar') THEN
    RAISE EXCEPTION 'Недостаточно прав для изменения настроек связи.' USING ERRCODE = '42501';
  END IF;
  v_patient := public.patient_communication_assert_patient(p_tenant_id, p_patient_id);
  IF p_contact_type = 'phone' THEN
    v_normalized := public.normalize_patient_phone_e164(p_contact_value_raw);
    IF v_normalized IS NULL THEN
      RAISE EXCEPTION 'Укажите корректный номер телефона.' USING ERRCODE = '22023';
    END IF;
    v_country := CASE WHEN v_normalized LIKE '+7%' THEN '7' ELSE NULL END;
  ELSIF p_contact_type = 'email' THEN
    v_normalized := public.normalize_patient_email(p_contact_value_raw);
    IF v_normalized IS NULL THEN
      RAISE EXCEPTION 'Укажите корректный адрес электронной почты.' USING ERRCODE = '22023';
    END IF;
    v_country := NULL;
  ELSE
    RAISE EXCEPTION 'Не удалось сохранить настройки связи.' USING ERRCODE = '22023';
  END IF;
  IF p_owner_type NOT IN ('patient', 'representative') THEN
    RAISE EXCEPTION 'Не удалось сохранить настройки связи.' USING ERRCODE = '22023';
  END IF;
  IF p_owner_type = 'representative' AND (
    length(btrim(coalesce(p_representative_name, ''))) = 0
    OR p_representative_relation IS NULL
    OR p_representative_relation NOT IN ('parent','guardian','spouse','child','caregiver','other')
  ) THEN
    RAISE EXCEPTION 'Укажите представителя и его отношение к пациенту.' USING ERRCODE = '22023';
  END IF;
  IF p_language IS NOT NULL AND p_language NOT IN ('ru','kk','en') THEN
    RAISE EXCEPTION 'Не удалось сохранить настройки связи.' USING ERRCODE = '22023';
  END IF;
  IF p_is_verified AND p_verification_source IS NULL THEN
    RAISE EXCEPTION 'Не удалось сохранить настройки связи.' USING ERRCODE = '22023';
  END IF;

  v_fingerprint := encode(extensions.digest(jsonb_build_object(
    'patientId', p_patient_id, 'contactId', p_contact_id, 'type', p_contact_type,
    'normalized', v_normalized, 'primary', coalesce(p_is_primary, false),
    'verified', coalesce(p_is_verified, false), 'verificationSource', p_verification_source,
    'ownerType', p_owner_type, 'representativeName', nullif(btrim(coalesce(p_representative_name,'')),''),
    'representativeRelation', p_representative_relation, 'language', p_language,
    'expectedUpdatedAt', p_expected_updated_at
  )::text, 'sha256'), 'hex');
  v_replay := public.patient_communication_operation_replay(p_tenant_id, p_operation_key, 'contact_upsert', v_fingerprint);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;

  IF p_contact_id IS NOT NULL THEN
    SELECT * INTO v_before FROM public.patient_communication_contacts c
    WHERE c.tenant_id = p_tenant_id AND c.patient_id = p_patient_id AND c.id = p_contact_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Недостаточно прав для изменения настроек связи.' USING ERRCODE = '42501';
    END IF;
    IF p_expected_updated_at IS NULL OR v_before.updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'Контакт был изменён другим пользователем. Обновите данные.' USING ERRCODE = '55000', HINT = 'communication_stale';
    END IF;
  END IF;

  IF coalesce(p_is_primary, false) THEN
    UPDATE public.patient_communication_contacts
    SET is_primary = false, updated_by = auth.uid()
    WHERE tenant_id = p_tenant_id AND patient_id = p_patient_id
      AND contact_type = p_contact_type AND archived_at IS NULL AND is_primary
      AND (p_contact_id IS NULL OR id <> p_contact_id);
  END IF;

  IF p_contact_id IS NULL THEN
    INSERT INTO public.patient_communication_contacts(
      tenant_id, patient_id, contact_type, contact_value_raw, contact_value_normalized, country_code,
      is_primary, is_verified, verification_source, owner_type, representative_name,
      representative_relation, language, created_by, updated_by
    ) VALUES (
      p_tenant_id, p_patient_id, p_contact_type, btrim(p_contact_value_raw), v_normalized, v_country,
      coalesce(p_is_primary, false), coalesce(p_is_verified, false), p_verification_source,
      p_owner_type, CASE WHEN p_owner_type='representative' THEN nullif(btrim(p_representative_name),'') END,
      CASE WHEN p_owner_type='representative' THEN p_representative_relation END,
      p_language, auth.uid(), auth.uid()
    ) RETURNING * INTO v_after;
    v_action := 'patient_communication_contact_added';
  ELSE
    UPDATE public.patient_communication_contacts
    SET contact_type = p_contact_type,
        contact_value_raw = btrim(p_contact_value_raw),
        contact_value_normalized = v_normalized,
        country_code = v_country,
        is_primary = coalesce(p_is_primary, false),
        is_verified = coalesce(p_is_verified, false),
        verification_source = p_verification_source,
        owner_type = p_owner_type,
        representative_name = CASE WHEN p_owner_type='representative' THEN nullif(btrim(p_representative_name),'') END,
        representative_relation = CASE WHEN p_owner_type='representative' THEN p_representative_relation END,
        language = p_language,
        updated_by = auth.uid(),
        archived_at = NULL
    WHERE tenant_id = p_tenant_id AND patient_id = p_patient_id AND id = p_contact_id
    RETURNING * INTO v_after;
    v_action := 'patient_communication_contact_updated';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.patient_communication_contacts c
    WHERE c.tenant_id = p_tenant_id AND c.contact_type = p_contact_type
      AND c.contact_value_normalized = v_normalized AND c.archived_at IS NULL
      AND c.id <> v_after.id AND c.patient_id <> p_patient_id
  ) INTO v_duplicate;
  UPDATE public.patient_communication_contacts
  SET possible_duplicate = true, updated_by = coalesce(updated_by, auth.uid())
  WHERE tenant_id = p_tenant_id AND contact_type = p_contact_type
    AND contact_value_normalized = v_normalized AND archived_at IS NULL
    AND (v_duplicate OR id = v_after.id);
  IF NOT v_duplicate THEN
    UPDATE public.patient_communication_contacts
    SET possible_duplicate = false, updated_by = auth.uid()
    WHERE tenant_id = p_tenant_id AND id = v_after.id;
  END IF;
  SELECT * INTO v_after FROM public.patient_communication_contacts WHERE id = v_after.id;

  PERFORM public.record_patient_communication_audit_internal(
    p_tenant_id, p_patient_id, v_action, 'patient_communication_contact', v_after.id::text,
    CASE WHEN p_contact_id IS NULL THEN NULL ELSE jsonb_build_object('type',v_before.contact_type,'primary',v_before.is_primary,'verified',v_before.is_verified,'ownerType',v_before.owner_type) END,
    jsonb_build_object('type',v_after.contact_type,'primary',v_after.is_primary,'verified',v_after.is_verified,'ownerType',v_after.owner_type,'possibleDuplicate',v_after.possible_duplicate),
    NULL,
    jsonb_build_object('contactId',v_after.id,'destinationSuffix',right(coalesce(v_after.contact_value_normalized,''),4))
  );
  v_result := jsonb_build_object('contact', public.patient_communication_contact_json(v_after), 'duplicateWarning', v_duplicate, 'replayed', false);
  PERFORM public.patient_communication_store_operation(p_tenant_id,p_patient_id,p_operation_key,'contact_upsert',v_fingerprint,v_result);
  RETURN v_result;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.archive_patient_communication_contact(
  p_tenant_id uuid,
  p_patient_id uuid,
  p_contact_id uuid,
  p_expected_updated_at timestamptz,
  p_operation_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_role text := public.patient_communication_role(p_tenant_id);
  v_before public.patient_communication_contacts%ROWTYPE;
  v_after public.patient_communication_contacts%ROWTYPE;
  v_fingerprint text;
  v_replay jsonb;
  v_result jsonb;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('clinic_owner','clinic_admin','registrar') THEN
    RAISE EXCEPTION 'Недостаточно прав для изменения настроек связи.' USING ERRCODE='42501';
  END IF;
  PERFORM public.patient_communication_assert_patient(p_tenant_id,p_patient_id);
  v_fingerprint := encode(extensions.digest(jsonb_build_object('patientId',p_patient_id,'contactId',p_contact_id,'expectedUpdatedAt',p_expected_updated_at)::text,'sha256'),'hex');
  v_replay := public.patient_communication_operation_replay(p_tenant_id,p_operation_key,'contact_archive',v_fingerprint);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  SELECT * INTO v_before FROM public.patient_communication_contacts
  WHERE tenant_id=p_tenant_id AND patient_id=p_patient_id AND id=p_contact_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Недостаточно прав для изменения настроек связи.' USING ERRCODE='42501'; END IF;
  IF p_expected_updated_at IS NULL OR v_before.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Контакт был изменён другим пользователем. Обновите данные.' USING ERRCODE='55000', HINT='communication_stale';
  END IF;
  UPDATE public.patient_communication_contacts
  SET archived_at=transaction_timestamp(), is_primary=false, updated_by=auth.uid()
  WHERE id=p_contact_id RETURNING * INTO v_after;
  PERFORM public.record_patient_communication_audit_internal(
    p_tenant_id,p_patient_id,'patient_communication_contact_archived','patient_communication_contact',p_contact_id::text,
    jsonb_build_object('type',v_before.contact_type,'primary',v_before.is_primary,'verified',v_before.is_verified),
    jsonb_build_object('type',v_after.contact_type,'archived',true),NULL,
    jsonb_build_object('contactId',p_contact_id)
  );
  v_result := jsonb_build_object('contact',public.patient_communication_contact_json(v_after),'replayed',false);
  PERFORM public.patient_communication_store_operation(p_tenant_id,p_patient_id,p_operation_key,'contact_archive',v_fingerprint,v_result);
  RETURN v_result;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.set_primary_patient_communication_contact(
  p_tenant_id uuid,
  p_patient_id uuid,
  p_contact_id uuid,
  p_expected_updated_at timestamptz,
  p_operation_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_role text := public.patient_communication_role(p_tenant_id);
  v_contact public.patient_communication_contacts%ROWTYPE;
  v_after public.patient_communication_contacts%ROWTYPE;
  v_fingerprint text;
  v_replay jsonb;
  v_result jsonb;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('clinic_owner','clinic_admin','registrar') THEN
    RAISE EXCEPTION 'Недостаточно прав для изменения настроек связи.' USING ERRCODE='42501';
  END IF;
  PERFORM public.patient_communication_assert_patient(p_tenant_id,p_patient_id);
  v_fingerprint := encode(extensions.digest(jsonb_build_object('patientId',p_patient_id,'contactId',p_contact_id,'expectedUpdatedAt',p_expected_updated_at)::text,'sha256'),'hex');
  v_replay := public.patient_communication_operation_replay(p_tenant_id,p_operation_key,'contact_primary',v_fingerprint);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  SELECT * INTO v_contact FROM public.patient_communication_contacts
  WHERE tenant_id=p_tenant_id AND patient_id=p_patient_id AND id=p_contact_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Недостаточно прав для изменения настроек связи.' USING ERRCODE='42501'; END IF;
  IF v_contact.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Архивный контакт нельзя сделать основным.' USING ERRCODE='22023'; END IF;
  IF p_expected_updated_at IS NULL OR v_contact.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Контакт был изменён другим пользователем. Обновите данные.' USING ERRCODE='55000', HINT='communication_stale';
  END IF;
  UPDATE public.patient_communication_contacts
  SET is_primary=false, updated_by=auth.uid()
  WHERE tenant_id=p_tenant_id AND patient_id=p_patient_id AND contact_type=v_contact.contact_type AND archived_at IS NULL AND is_primary;
  UPDATE public.patient_communication_contacts
  SET is_primary=true, updated_by=auth.uid()
  WHERE id=p_contact_id RETURNING * INTO v_after;
  PERFORM public.record_patient_communication_audit_internal(
    p_tenant_id,p_patient_id,'patient_communication_primary_changed','patient_communication_contact',p_contact_id::text,
    jsonb_build_object('primary',v_contact.is_primary,'type',v_contact.contact_type),
    jsonb_build_object('primary',true,'type',v_contact.contact_type),NULL,jsonb_build_object('contactId',p_contact_id)
  );
  v_result := jsonb_build_object('contact',public.patient_communication_contact_json(v_after),'replayed',false);
  PERFORM public.patient_communication_store_operation(p_tenant_id,p_patient_id,p_operation_key,'contact_primary',v_fingerprint,v_result);
  RETURN v_result;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.set_patient_communication_preferences(
  p_tenant_id uuid,
  p_patient_id uuid,
  p_preferred_language text,
  p_preferred_channel text,
  p_allow_manual_phone boolean,
  p_operation_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_role text := public.patient_communication_role(p_tenant_id);
  v_before public.patient_communication_preferences%ROWTYPE;
  v_after public.patient_communication_preferences%ROWTYPE;
  v_fingerprint text;
  v_replay jsonb;
  v_result jsonb;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('clinic_owner','clinic_admin','registrar') THEN
    RAISE EXCEPTION 'Недостаточно прав для изменения настроек связи.' USING ERRCODE='42501';
  END IF;
  PERFORM public.patient_communication_assert_patient(p_tenant_id,p_patient_id);
  IF p_preferred_language NOT IN ('ru','kk','en') OR p_preferred_channel NOT IN ('phone','whatsapp','sms','email','none') THEN
    RAISE EXCEPTION 'Не удалось сохранить настройки связи.' USING ERRCODE='22023';
  END IF;
  v_fingerprint := encode(extensions.digest(jsonb_build_object('patientId',p_patient_id,'language',p_preferred_language,'channel',p_preferred_channel,'allowManualPhone',p_allow_manual_phone)::text,'sha256'),'hex');
  v_replay := public.patient_communication_operation_replay(p_tenant_id,p_operation_key,'preferences_set',v_fingerprint);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  INSERT INTO public.patient_communication_preferences(tenant_id,patient_id,updated_by)
  VALUES(p_tenant_id,p_patient_id,auth.uid()) ON CONFLICT (tenant_id,patient_id) DO NOTHING;
  SELECT * INTO v_before FROM public.patient_communication_preferences
  WHERE tenant_id=p_tenant_id AND patient_id=p_patient_id FOR UPDATE;
  UPDATE public.patient_communication_preferences
  SET preferred_language=p_preferred_language,preferred_channel=p_preferred_channel,
      allow_manual_phone=coalesce(p_allow_manual_phone,true),updated_by=auth.uid()
  WHERE tenant_id=p_tenant_id AND patient_id=p_patient_id RETURNING * INTO v_after;
  PERFORM public.record_patient_communication_audit_internal(
    p_tenant_id,p_patient_id,'patient_communication_preferences_changed','patient_communication_preferences',p_patient_id::text,
    jsonb_build_object('preferredLanguage',v_before.preferred_language,'preferredChannel',v_before.preferred_channel,'allowManualPhone',v_before.allow_manual_phone),
    jsonb_build_object('preferredLanguage',v_after.preferred_language,'preferredChannel',v_after.preferred_channel,'allowManualPhone',v_after.allow_manual_phone),
    NULL,'{}'::jsonb
  );
  v_result := jsonb_build_object('preferences',public.patient_communication_preferences_json(v_after),'replayed',false);
  PERFORM public.patient_communication_store_operation(p_tenant_id,p_patient_id,p_operation_key,'preferences_set',v_fingerprint,v_result);
  RETURN v_result;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.set_patient_communication_consent(
  p_tenant_id uuid,
  p_patient_id uuid,
  p_channel text,
  p_new_state text,
  p_source text,
  p_reason text,
  p_operation_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_role text := public.patient_communication_role(p_tenant_id);
  v_before public.patient_communication_preferences%ROWTYPE;
  v_after public.patient_communication_preferences%ROWTYPE;
  v_previous text;
  v_event public.patient_communication_consent_events%ROWTYPE;
  v_fingerprint text;
  v_replay jsonb;
  v_result jsonb;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('clinic_owner','clinic_admin','registrar') THEN
    RAISE EXCEPTION 'Недостаточно прав для изменения настроек связи.' USING ERRCODE='42501';
  END IF;
  IF p_channel NOT IN ('sms','whatsapp','email') OR p_new_state NOT IN ('unknown','granted','denied','withdrawn') THEN
    RAISE EXCEPTION 'Статус согласия не указан.' USING ERRCODE='22023';
  END IF;
  IF p_source NOT IN ('patient_verbal','patient_written','representative_verbal','representative_written','staff_correction','import_legacy','system') THEN
    RAISE EXCEPTION 'Не удалось сохранить настройки связи.' USING ERRCODE='22023';
  END IF;
  IF v_role='registrar' AND p_source NOT IN ('patient_verbal','representative_verbal','staff_correction') THEN
    RAISE EXCEPTION 'Недостаточно прав для изменения настроек связи.' USING ERRCODE='42501';
  END IF;
  PERFORM public.patient_communication_assert_patient(p_tenant_id,p_patient_id);
  v_fingerprint := encode(extensions.digest(jsonb_build_object('patientId',p_patient_id,'channel',p_channel,'newState',p_new_state,'source',p_source,'reason',nullif(btrim(coalesce(p_reason,'')),''))::text,'sha256'),'hex');
  v_replay := public.patient_communication_operation_replay(p_tenant_id,p_operation_key,'consent_set',v_fingerprint);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  INSERT INTO public.patient_communication_preferences(tenant_id,patient_id,updated_by)
  VALUES(p_tenant_id,p_patient_id,auth.uid()) ON CONFLICT (tenant_id,patient_id) DO NOTHING;
  SELECT * INTO v_before FROM public.patient_communication_preferences
  WHERE tenant_id=p_tenant_id AND patient_id=p_patient_id FOR UPDATE;
  v_previous := CASE p_channel WHEN 'sms' THEN v_before.sms_consent_state WHEN 'whatsapp' THEN v_before.whatsapp_consent_state ELSE v_before.email_consent_state END;
  IF v_previous IS DISTINCT FROM p_new_state THEN
    UPDATE public.patient_communication_preferences
    SET sms_consent_state=CASE WHEN p_channel='sms' THEN p_new_state ELSE sms_consent_state END,
        whatsapp_consent_state=CASE WHEN p_channel='whatsapp' THEN p_new_state ELSE whatsapp_consent_state END,
        email_consent_state=CASE WHEN p_channel='email' THEN p_new_state ELSE email_consent_state END,
        updated_by=auth.uid()
    WHERE tenant_id=p_tenant_id AND patient_id=p_patient_id RETURNING * INTO v_after;
    INSERT INTO public.patient_communication_consent_events(
      tenant_id,patient_id,channel,previous_state,new_state,source,actor_user_id,reason,metadata,operation_key,fingerprint
    ) VALUES (
      p_tenant_id,p_patient_id,p_channel,v_previous,p_new_state,p_source,auth.uid(),nullif(btrim(coalesce(p_reason,'')),''),
      jsonb_build_object('representativeSource',p_source LIKE 'representative_%'),btrim(p_operation_key),v_fingerprint
    ) RETURNING * INTO v_event;
    PERFORM public.record_patient_communication_audit_internal(
      p_tenant_id,p_patient_id,'patient_communication_consent_changed','patient_communication_consent_event',v_event.id::text,
      jsonb_build_object('channel',p_channel,'state',v_previous),jsonb_build_object('channel',p_channel,'state',p_new_state),
      p_reason,jsonb_build_object('source',p_source,'consentEventId',v_event.id)
    );
  ELSE
    v_after := v_before;
  END IF;
  v_result := jsonb_build_object(
    'preferences',public.patient_communication_preferences_json(v_after),
    'consentEventId',v_event.id,'changed',v_previous IS DISTINCT FROM p_new_state,'replayed',false
  );
  PERFORM public.patient_communication_store_operation(p_tenant_id,p_patient_id,p_operation_key,'consent_set',v_fingerprint,v_result);
  RETURN v_result;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.set_patient_communication_suppression(
  p_tenant_id uuid,
  p_patient_id uuid,
  p_channel text,
  p_suppressed boolean,
  p_reason text,
  p_operation_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_role text := public.patient_communication_role(p_tenant_id);
  v_before public.patient_communication_preferences%ROWTYPE;
  v_after public.patient_communication_preferences%ROWTYPE;
  v_fingerprint text;
  v_replay jsonb;
  v_result jsonb;
  v_reason text := nullif(btrim(coalesce(p_reason,'')),'');
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('clinic_owner','clinic_admin','registrar') THEN
    RAISE EXCEPTION 'Недостаточно прав для изменения настроек связи.' USING ERRCODE='42501';
  END IF;
  IF p_channel NOT IN ('global','phone','sms','whatsapp','email') THEN
    RAISE EXCEPTION 'Не удалось сохранить настройки связи.' USING ERRCODE='22023';
  END IF;
  IF p_suppressed AND v_reason NOT IN ('patient_request','representative_request','invalid_contact','wrong_number','duplicate_contact','legal_restriction','staff_decision','other') THEN
    RAISE EXCEPTION 'Укажите причину.' USING ERRCODE='22023';
  END IF;
  IF v_role='registrar' AND p_suppressed AND v_reason NOT IN ('invalid_contact','wrong_number','duplicate_contact','staff_decision') THEN
    RAISE EXCEPTION 'Недостаточно прав для изменения настроек связи.' USING ERRCODE='42501';
  END IF;
  PERFORM public.patient_communication_assert_patient(p_tenant_id,p_patient_id);
  v_fingerprint := encode(extensions.digest(jsonb_build_object('patientId',p_patient_id,'channel',p_channel,'suppressed',p_suppressed,'reason',v_reason)::text,'sha256'),'hex');
  v_replay := public.patient_communication_operation_replay(p_tenant_id,p_operation_key,'suppression_set',v_fingerprint);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  INSERT INTO public.patient_communication_preferences(tenant_id,patient_id,updated_by)
  VALUES(p_tenant_id,p_patient_id,auth.uid()) ON CONFLICT (tenant_id,patient_id) DO NOTHING;
  SELECT * INTO v_before FROM public.patient_communication_preferences
  WHERE tenant_id=p_tenant_id AND patient_id=p_patient_id FOR UPDATE;
  UPDATE public.patient_communication_preferences
  SET phone_suppressed=CASE WHEN p_channel='phone' THEN p_suppressed ELSE phone_suppressed END,
      phone_suppression_reason=CASE WHEN p_channel='phone' THEN CASE WHEN p_suppressed THEN v_reason END ELSE phone_suppression_reason END,
      phone_suppressed_at=CASE WHEN p_channel='phone' THEN CASE WHEN p_suppressed THEN transaction_timestamp() END ELSE phone_suppressed_at END,
      phone_suppressed_by=CASE WHEN p_channel='phone' THEN CASE WHEN p_suppressed THEN auth.uid() END ELSE phone_suppressed_by END,
      sms_suppressed=CASE WHEN p_channel='sms' THEN p_suppressed ELSE sms_suppressed END,
      sms_suppression_reason=CASE WHEN p_channel='sms' THEN CASE WHEN p_suppressed THEN v_reason END ELSE sms_suppression_reason END,
      sms_suppressed_at=CASE WHEN p_channel='sms' THEN CASE WHEN p_suppressed THEN transaction_timestamp() END ELSE sms_suppressed_at END,
      sms_suppressed_by=CASE WHEN p_channel='sms' THEN CASE WHEN p_suppressed THEN auth.uid() END ELSE sms_suppressed_by END,
      whatsapp_suppressed=CASE WHEN p_channel='whatsapp' THEN p_suppressed ELSE whatsapp_suppressed END,
      whatsapp_suppression_reason=CASE WHEN p_channel='whatsapp' THEN CASE WHEN p_suppressed THEN v_reason END ELSE whatsapp_suppression_reason END,
      whatsapp_suppressed_at=CASE WHEN p_channel='whatsapp' THEN CASE WHEN p_suppressed THEN transaction_timestamp() END ELSE whatsapp_suppressed_at END,
      whatsapp_suppressed_by=CASE WHEN p_channel='whatsapp' THEN CASE WHEN p_suppressed THEN auth.uid() END ELSE whatsapp_suppressed_by END,
      email_suppressed=CASE WHEN p_channel='email' THEN p_suppressed ELSE email_suppressed END,
      email_suppression_reason=CASE WHEN p_channel='email' THEN CASE WHEN p_suppressed THEN v_reason END ELSE email_suppression_reason END,
      email_suppressed_at=CASE WHEN p_channel='email' THEN CASE WHEN p_suppressed THEN transaction_timestamp() END ELSE email_suppressed_at END,
      email_suppressed_by=CASE WHEN p_channel='email' THEN CASE WHEN p_suppressed THEN auth.uid() END ELSE email_suppressed_by END,
      global_suppression=CASE WHEN p_channel='global' THEN p_suppressed ELSE global_suppression END,
      global_suppression_reason=CASE WHEN p_channel='global' THEN CASE WHEN p_suppressed THEN v_reason END ELSE global_suppression_reason END,
      global_suppressed_at=CASE WHEN p_channel='global' THEN CASE WHEN p_suppressed THEN transaction_timestamp() END ELSE global_suppressed_at END,
      global_suppressed_by=CASE WHEN p_channel='global' THEN CASE WHEN p_suppressed THEN auth.uid() END ELSE global_suppressed_by END,
      updated_by=auth.uid()
  WHERE tenant_id=p_tenant_id AND patient_id=p_patient_id RETURNING * INTO v_after;
  PERFORM public.record_patient_communication_audit_internal(
    p_tenant_id,p_patient_id,'patient_communication_suppression_changed','patient_communication_preferences',p_patient_id::text,
    jsonb_build_object('channel',p_channel,'suppressed',CASE p_channel WHEN 'global' THEN v_before.global_suppression WHEN 'phone' THEN v_before.phone_suppressed WHEN 'sms' THEN v_before.sms_suppressed WHEN 'whatsapp' THEN v_before.whatsapp_suppressed ELSE v_before.email_suppressed END),
    jsonb_build_object('channel',p_channel,'suppressed',p_suppressed),v_reason,jsonb_build_object('channel',p_channel)
  );
  v_result := jsonb_build_object('preferences',public.patient_communication_preferences_json(v_after),'replayed',false);
  PERFORM public.patient_communication_store_operation(p_tenant_id,p_patient_id,p_operation_key,'suppression_set',v_fingerprint,v_result);
  RETURN v_result;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.get_patient_communication_eligibility(
  p_tenant_id uuid,
  p_patient_id uuid,
  p_channel text
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_role text := public.patient_communication_role(p_tenant_id);
  v_preferences public.patient_communication_preferences%ROWTYPE;
  v_contact public.patient_communication_contacts%ROWTYPE;
  v_contact_type text;
  v_consent text := 'unknown';
  v_channel_suppressed boolean := false;
  v_global_suppressed boolean := false;
  v_manual_eligible boolean := false;
  v_automated_eligible boolean := false;
  v_blocked text[] := ARRAY[]::text[];
  v_status text := 'blocked';
  v_requires_review boolean := false;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('clinic_owner','clinic_admin','registrar','doctor') THEN
    RAISE EXCEPTION 'Недостаточно прав для просмотра настроек связи.' USING ERRCODE='42501';
  END IF;
  IF p_channel NOT IN ('phone','sms','whatsapp','email') THEN
    RAISE EXCEPTION 'Не удалось проверить возможность связи.' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.patients p WHERE p.tenant_id=p_tenant_id AND p.id=p_patient_id) THEN
    RAISE EXCEPTION 'Недостаточно прав для просмотра настроек связи.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_preferences FROM public.patient_communication_preferences
  WHERE tenant_id=p_tenant_id AND patient_id=p_patient_id;
  IF NOT FOUND THEN
    v_preferences.tenant_id := p_tenant_id;
    v_preferences.patient_id := p_patient_id;
    v_preferences.preferred_language := 'ru';
    v_preferences.preferred_channel := 'none';
    v_preferences.allow_manual_phone := true;
    v_preferences.sms_consent_state := 'unknown';
    v_preferences.whatsapp_consent_state := 'unknown';
    v_preferences.email_consent_state := 'unknown';
    v_preferences.phone_suppressed := false;
    v_preferences.sms_suppressed := false;
    v_preferences.whatsapp_suppressed := false;
    v_preferences.email_suppressed := false;
    v_preferences.global_suppression := false;
  END IF;
  v_contact_type := CASE WHEN p_channel='email' THEN 'email' ELSE 'phone' END;
  SELECT * INTO v_contact FROM public.patient_communication_contacts c
  WHERE c.tenant_id=p_tenant_id AND c.patient_id=p_patient_id AND c.contact_type=v_contact_type
    AND c.archived_at IS NULL
  ORDER BY c.is_primary DESC, c.created_at ASC, c.id ASC
  LIMIT 1;

  v_global_suppressed := coalesce(v_preferences.global_suppression,false);
  v_channel_suppressed := CASE p_channel
    WHEN 'phone' THEN coalesce(v_preferences.phone_suppressed,false)
    WHEN 'sms' THEN coalesce(v_preferences.sms_suppressed,false)
    WHEN 'whatsapp' THEN coalesce(v_preferences.whatsapp_suppressed,false)
    ELSE coalesce(v_preferences.email_suppressed,false)
  END;
  v_consent := CASE p_channel
    WHEN 'sms' THEN coalesce(v_preferences.sms_consent_state,'unknown')
    WHEN 'whatsapp' THEN coalesce(v_preferences.whatsapp_consent_state,'unknown')
    WHEN 'email' THEN coalesce(v_preferences.email_consent_state,'unknown')
    ELSE 'not_required'
  END;

  IF p_channel='phone' THEN
    IF v_contact.id IS NULL THEN v_blocked := array_append(v_blocked,'no_contact'); END IF;
    IF v_contact.id IS NOT NULL AND v_contact.contact_value_normalized IS NULL THEN v_blocked := array_append(v_blocked,'invalid_contact'); END IF;
    IF v_contact.id IS NOT NULL AND NOT v_contact.is_verified THEN v_requires_review := true; END IF;
    IF v_contact.owner_type='representative' THEN v_requires_review := true; END IF;
    IF v_channel_suppressed OR NOT coalesce(v_preferences.allow_manual_phone,true) THEN v_blocked := array_append(v_blocked,'channel_suppressed'); END IF;
    IF v_global_suppressed AND v_preferences.global_suppression_reason='legal_restriction' THEN v_blocked := array_append(v_blocked,'global_suppression'); END IF;
    v_manual_eligible := v_contact.id IS NOT NULL AND NOT ('channel_suppressed'=ANY(v_blocked)) AND NOT ('global_suppression'=ANY(v_blocked));
    v_status := CASE WHEN v_manual_eligible THEN 'manual_only' ELSE 'blocked' END;
  ELSE
    IF v_global_suppressed THEN v_blocked := array_append(v_blocked,'global_suppression'); END IF;
    IF v_channel_suppressed THEN v_blocked := array_append(v_blocked,'channel_suppressed'); END IF;
    IF v_consent='unknown' THEN v_blocked := array_append(v_blocked,'consent_unknown'); END IF;
    IF v_consent='denied' THEN v_blocked := array_append(v_blocked,'consent_denied'); END IF;
    IF v_consent='withdrawn' THEN v_blocked := array_append(v_blocked,'consent_withdrawn'); END IF;
    IF v_preferences.preferred_channel='none' THEN v_blocked := array_append(v_blocked,'no_preferred_channel'); END IF;
    IF v_contact.id IS NULL THEN v_blocked := array_append(v_blocked,'no_contact'); END IF;
    IF v_contact.id IS NOT NULL AND v_contact.contact_value_normalized IS NULL THEN v_blocked := array_append(v_blocked,'invalid_contact'); END IF;
    IF v_contact.id IS NOT NULL AND NOT v_contact.is_verified THEN v_blocked := array_append(v_blocked,'unverified_contact'); END IF;
    IF v_contact.owner_type='representative' THEN
      v_blocked := array_append(v_blocked,'representative_review_required');
      v_requires_review := true;
    END IF;
    v_automated_eligible := cardinality(v_blocked)=0 AND v_consent='granted';
    v_status := CASE
      WHEN v_automated_eligible THEN 'available'
      WHEN 'global_suppression'=ANY(v_blocked) OR 'channel_suppressed'=ANY(v_blocked) THEN 'suppressed'
      WHEN 'consent_unknown'=ANY(v_blocked) THEN 'consent_unknown'
      WHEN 'invalid_contact'=ANY(v_blocked) OR 'unverified_contact'=ANY(v_blocked) THEN 'invalid_contact'
      ELSE 'blocked'
    END;
  END IF;

  RETURN jsonb_build_object(
    'eligible', CASE WHEN p_channel='phone' THEN v_manual_eligible ELSE v_automated_eligible END,
    'automatedEligible', v_automated_eligible,
    'manualEligible', v_manual_eligible,
    'status', v_status,
    'channel', p_channel,
    'selectedContactId', v_contact.id,
    'normalizedDestination', v_contact.contact_value_normalized,
    'language', coalesce(v_contact.language,v_preferences.preferred_language,'ru'),
    'blockedReasons', to_jsonb(v_blocked),
    'consentState', v_consent,
    'suppressionState', jsonb_build_object('global',v_global_suppressed,'channel',v_channel_suppressed),
    'representative', coalesce(v_contact.owner_type='representative',false),
    'requiresManualReview', v_requires_review
  );
END;
$fn$;

-- Legacy compatibility: preserve patients.phone and import/synchronize only an unverified import_legacy contact.
CREATE OR REPLACE FUNCTION public.sync_patient_communication_legacy_phone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_existing uuid;
  v_normalized text;
BEGIN
  INSERT INTO public.patient_communication_preferences(tenant_id,patient_id,preferred_language,preferred_channel,allow_manual_phone)
  VALUES(NEW.tenant_id,NEW.id,'ru','none',true)
  ON CONFLICT (tenant_id,patient_id) DO NOTHING;

  IF nullif(btrim(coalesce(NEW.phone,'')),'') IS NULL THEN
    RETURN NEW;
  END IF;
  v_normalized := public.normalize_patient_phone_e164(NEW.phone);
  SELECT c.id INTO v_existing
  FROM public.patient_communication_contacts c
  WHERE c.tenant_id=NEW.tenant_id AND c.patient_id=NEW.id AND c.contact_type='phone'
    AND c.owner_type='patient' AND c.verification_source='import_legacy'
    AND NOT c.is_verified AND c.archived_at IS NULL
  ORDER BY c.is_primary DESC,c.created_at,c.id
  LIMIT 1
  FOR UPDATE;

  IF v_existing IS NOT NULL THEN
    UPDATE public.patient_communication_contacts
    SET contact_value_raw=btrim(NEW.phone),
        contact_value_normalized=v_normalized,
        country_code=CASE WHEN v_normalized LIKE '+7%' THEN '7' END,
        updated_by=NULL
    WHERE id=v_existing;
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.patient_communication_contacts c
    WHERE c.tenant_id=NEW.tenant_id AND c.patient_id=NEW.id
      AND c.contact_type='phone' AND c.archived_at IS NULL
  ) THEN
    INSERT INTO public.patient_communication_contacts(
      tenant_id,patient_id,contact_type,contact_value_raw,contact_value_normalized,country_code,
      is_primary,is_verified,verification_source,owner_type,created_by,updated_by
    ) VALUES(
      NEW.tenant_id,NEW.id,'phone',btrim(NEW.phone),v_normalized,
      CASE WHEN v_normalized LIKE '+7%' THEN '7' END,
      true,false,'import_legacy','patient',NULL,NULL
    );
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER patient_communication_legacy_phone_insert
AFTER INSERT ON public.patients
FOR EACH ROW EXECUTE FUNCTION public.sync_patient_communication_legacy_phone();
CREATE TRIGGER patient_communication_legacy_phone_update
AFTER UPDATE OF phone ON public.patients
FOR EACH ROW WHEN (OLD.phone IS DISTINCT FROM NEW.phone)
EXECUTE FUNCTION public.sync_patient_communication_legacy_phone();

INSERT INTO public.patient_communication_preferences(tenant_id,patient_id,preferred_language,preferred_channel,allow_manual_phone)
SELECT p.tenant_id,p.id,'ru','none',true FROM public.patients p
ON CONFLICT (tenant_id,patient_id) DO NOTHING;

INSERT INTO public.patient_communication_contacts(
  tenant_id,patient_id,contact_type,contact_value_raw,contact_value_normalized,country_code,
  is_primary,is_verified,verification_source,owner_type,created_by,updated_by
)
SELECT p.tenant_id,p.id,'phone',btrim(p.phone),public.normalize_patient_phone_e164(p.phone),
       CASE WHEN public.normalize_patient_phone_e164(p.phone) LIKE '+7%' THEN '7' END,
       true,false,'import_legacy','patient',NULL,NULL
FROM public.patients p
WHERE nullif(btrim(coalesce(p.phone,'')),'') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.patient_communication_contacts c
    WHERE c.tenant_id=p.tenant_id AND c.patient_id=p.id AND c.contact_type='phone' AND c.archived_at IS NULL
  );

ALTER TABLE public.patient_communication_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_communication_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_communication_consent_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_communication_operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY patient_communication_contacts_select
ON public.patient_communication_contacts FOR SELECT TO authenticated
USING (public.patient_communication_role(tenant_id) IN ('clinic_owner','clinic_admin','registrar','doctor'));
CREATE POLICY patient_communication_preferences_select
ON public.patient_communication_preferences FOR SELECT TO authenticated
USING (public.patient_communication_role(tenant_id) IN ('clinic_owner','clinic_admin','registrar','doctor'));
CREATE POLICY patient_communication_consent_events_select
ON public.patient_communication_consent_events FOR SELECT TO authenticated
USING (public.patient_communication_role(tenant_id) IN ('clinic_owner','clinic_admin','registrar'));

REVOKE ALL ON public.patient_communication_contacts FROM anon, authenticated;
REVOKE ALL ON public.patient_communication_preferences FROM anon, authenticated;
REVOKE ALL ON public.patient_communication_consent_events FROM anon, authenticated;
REVOKE ALL ON public.patient_communication_operations FROM anon, authenticated;
GRANT SELECT ON public.patient_communication_contacts TO authenticated;
GRANT SELECT ON public.patient_communication_preferences TO authenticated;
GRANT SELECT ON public.patient_communication_consent_events TO authenticated;

REVOKE ALL ON FUNCTION public.normalize_patient_phone_e164(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.normalize_patient_email(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.patient_communication_role(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.patient_communication_role(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.sync_patient_communication_legacy_phone() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.patient_communication_assert_patient(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.patient_communication_operation_replay(uuid,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.patient_communication_store_operation(uuid,uuid,text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_patient_communication_audit_internal(uuid,uuid,text,text,text,jsonb,jsonb,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.patient_communication_contact_json(public.patient_communication_contacts) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.patient_communication_preferences_json(public.patient_communication_preferences) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.upsert_patient_communication_contact(uuid,uuid,uuid,text,text,boolean,boolean,text,text,text,text,text,timestamptz,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.archive_patient_communication_contact(uuid,uuid,uuid,timestamptz,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_primary_patient_communication_contact(uuid,uuid,uuid,timestamptz,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_patient_communication_preferences(uuid,uuid,text,text,boolean,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_patient_communication_consent(uuid,uuid,text,text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_patient_communication_suppression(uuid,uuid,text,boolean,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_patient_communication_eligibility(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_patient_communication_contact(uuid,uuid,uuid,text,text,boolean,boolean,text,text,text,text,text,timestamptz,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_patient_communication_contact(uuid,uuid,uuid,timestamptz,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_primary_patient_communication_contact(uuid,uuid,uuid,timestamptz,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_patient_communication_preferences(uuid,uuid,text,text,boolean,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_patient_communication_consent(uuid,uuid,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_patient_communication_suppression(uuid,uuid,text,boolean,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_patient_communication_eligibility(uuid,uuid,text) TO authenticated;

COMMENT ON TABLE public.patient_communication_contacts IS 'Tenant-scoped raw and normalized patient/representative contacts. Contact existence is not consent.';
COMMENT ON TABLE public.patient_communication_preferences IS 'Provider-neutral language, channel, consent and suppression facts. Unknown consent is never treated as granted.';
COMMENT ON TABLE public.patient_communication_consent_events IS 'Append-only evidence for channel-specific consent transitions.';
COMMENT ON FUNCTION public.get_patient_communication_eligibility(uuid,uuid,text) IS 'Read-only provider-neutral eligibility. It never sends or mutates reminder jobs.';

COMMIT;
