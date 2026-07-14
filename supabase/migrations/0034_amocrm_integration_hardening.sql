-- AMOCRM-INTEGRATION-HARDENING-001
-- Tenant-bound amoCRM OAuth/account foundation.
-- This migration deliberately adds no contact/lead/task/message synchronization,
-- provider worker, cron, webhook handler, or cloud-side migration execution.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.integration_normalize_domain(p_domain text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_domain text;
BEGIN
  v_domain := lower(btrim(coalesce(p_domain, '')));
  v_domain := regexp_replace(v_domain, '^https?://', '', 'i');
  v_domain := split_part(v_domain, '/', 1);
  v_domain := split_part(v_domain, ':', 1);
  v_domain := regexp_replace(v_domain, '\.+$', '');

  IF v_domain = '' THEN
    RETURN NULL;
  END IF;

  IF v_domain ~ '^[a-z0-9][a-z0-9-]{1,62}$' THEN
    v_domain := v_domain || '.amocrm.ru';
  END IF;

  IF v_domain !~ '^[a-z0-9][a-z0-9.-]*\.(amocrm\.ru|amocrm\.com|kommo\.com)$' THEN
    RAISE EXCEPTION 'AMOCRM_INVALID_DOMAIN' USING ERRCODE = '22023';
  END IF;

  RETURN v_domain;
END;
$$;

CREATE OR REPLACE FUNCTION public.integration_actor_role(
  p_tenant_id uuid,
  p_actor_id uuid DEFAULT auth.uid()
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT role::text
  FROM public.tenant_users
  WHERE tenant_id = p_tenant_id
    AND user_id = p_actor_id
$$;

CREATE OR REPLACE FUNCTION public.integration_require_role(
  p_tenant_id uuid,
  p_actor_id uuid,
  p_allowed_roles text[]
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_role text;
BEGIN
  v_role := public.integration_actor_role(p_tenant_id, p_actor_id);
  IF v_role IS NULL OR NOT (v_role = ANY(p_allowed_roles)) THEN
    RAISE EXCEPTION 'AMOCRM_PERMISSION_DENIED' USING ERRCODE = '42501';
  END IF;
  RETURN v_role;
END;
$$;

CREATE TABLE public.integration_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider_code text NOT NULL CHECK (provider_code = 'amocrm'),
  status text NOT NULL DEFAULT 'disconnected' CHECK (status IN (
    'disconnected',
    'authorization_pending',
    'connected',
    'refresh_required',
    'degraded',
    'account_mismatch',
    'revoked',
    'disabled'
  )),
  external_account_id text,
  external_account_domain text,
  display_name text,
  credential_version bigint NOT NULL DEFAULT 0 CHECK (credential_version >= 0),
  token_expires_at timestamptz,
  last_connected_at timestamptz,
  last_verified_at timestamptz,
  last_refresh_at timestamptz,
  last_error_code text,
  last_error_at timestamptz,
  disconnected_at timestamptz,
  refresh_lease_token uuid,
  refresh_lease_version bigint,
  refresh_lease_expires_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  archived_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (
    jsonb_typeof(metadata) = 'object' AND metadata = '{}'::jsonb
  ),
  UNIQUE (tenant_id, id),
  CHECK (external_account_domain IS NULL OR external_account_domain = public.integration_normalize_domain(external_account_domain)),
  CHECK ((refresh_lease_token IS NULL) = (refresh_lease_version IS NULL)),
  CHECK ((refresh_lease_token IS NULL) = (refresh_lease_expires_at IS NULL))
);

CREATE UNIQUE INDEX integration_accounts_one_provider_per_tenant
  ON public.integration_accounts(tenant_id, provider_code)
  WHERE archived_at IS NULL;

CREATE UNIQUE INDEX integration_accounts_active_external_account_unique
  ON public.integration_accounts(provider_code, external_account_id)
  WHERE archived_at IS NULL
    AND external_account_id IS NOT NULL
    AND status IN ('connected', 'refresh_required', 'degraded', 'account_mismatch', 'revoked', 'disabled');

CREATE INDEX integration_accounts_tenant_status_idx
  ON public.integration_accounts(tenant_id, provider_code, status, id)
  WHERE archived_at IS NULL;

CREATE TABLE public.integration_credentials (
  integration_account_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  provider_code text NOT NULL CHECK (provider_code = 'amocrm'),
  encrypted_access_credential bytea NOT NULL,
  encrypted_refresh_credential bytea NOT NULL,
  encryption_key_version integer NOT NULL CHECK (encryption_key_version >= 1),
  credential_version bigint NOT NULL CHECK (credential_version >= 1),
  access_expires_at timestamptz NOT NULL,
  refreshed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (tenant_id, integration_account_id),
  FOREIGN KEY (tenant_id, integration_account_id)
    REFERENCES public.integration_accounts(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE public.integration_oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_hash text NOT NULL UNIQUE CHECK (state_hash ~ '^[0-9a-f]{64}$'),
  tenant_id uuid NOT NULL,
  integration_account_id uuid NOT NULL,
  initiated_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_code text NOT NULL CHECK (provider_code = 'amocrm'),
  expected_external_account_id text,
  expected_domain text,
  redirect_uri_fingerprint text NOT NULL CHECK (redirect_uri_fingerprint ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz NOT NULL,
  exchange_started_at timestamptz,
  exchange_lease_token uuid,
  consumed_at timestamptz,
  cancelled_at timestamptz,
  failure_code text,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (
    jsonb_typeof(metadata) = 'object' AND metadata = '{}'::jsonb
  ),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, integration_account_id)
    REFERENCES public.integration_accounts(tenant_id, id) ON DELETE CASCADE,
  CHECK (expected_domain IS NULL OR expected_domain = public.integration_normalize_domain(expected_domain)),
  CHECK ((exchange_started_at IS NULL) = (exchange_lease_token IS NULL)),
  CHECK (NOT (consumed_at IS NOT NULL AND cancelled_at IS NOT NULL))
);

CREATE INDEX integration_oauth_states_pending_idx
  ON public.integration_oauth_states(tenant_id, integration_account_id, expires_at, created_at)
  WHERE consumed_at IS NULL AND cancelled_at IS NULL;

CREATE TABLE public.integration_external_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  integration_account_id uuid NOT NULL,
  provider_code text NOT NULL CHECK (provider_code = 'amocrm'),
  entity_type text NOT NULL CHECK (entity_type IN (
    'contact', 'lead', 'deal', 'task', 'note', 'message', 'conversation'
  )),
  internal_entity_id uuid NOT NULL,
  external_entity_id text NOT NULL CHECK (length(btrim(external_entity_id)) BETWEEN 1 AND 200),
  external_parent_id text,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  archived_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (
    jsonb_typeof(metadata) = 'object' AND metadata = '{}'::jsonb
  ),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, integration_account_id)
    REFERENCES public.integration_accounts(tenant_id, id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX integration_external_references_internal_unique
  ON public.integration_external_references(
    tenant_id, integration_account_id, entity_type, internal_entity_id
  ) WHERE archived_at IS NULL;

CREATE UNIQUE INDEX integration_external_references_external_unique
  ON public.integration_external_references(
    tenant_id, integration_account_id, entity_type, external_entity_id
  ) WHERE archived_at IS NULL;

CREATE OR REPLACE FUNCTION public.integration_write_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF current_user <> 'postgres'
     AND coalesce(auth.role(), '') <> 'service_role'
     AND coalesce(current_setting('app.integration_internal', true), '') <> 'on' THEN
    RAISE EXCEPTION 'AMOCRM_DIRECT_WRITE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  RETURN coalesce(NEW, OLD);
END;
$$;

CREATE TRIGGER integration_accounts_write_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.integration_accounts
FOR EACH ROW EXECUTE FUNCTION public.integration_write_guard();

CREATE TRIGGER integration_credentials_write_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.integration_credentials
FOR EACH ROW EXECUTE FUNCTION public.integration_write_guard();

CREATE TRIGGER integration_oauth_states_write_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.integration_oauth_states
FOR EACH ROW EXECUTE FUNCTION public.integration_write_guard();

CREATE TRIGGER integration_external_references_write_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.integration_external_references
FOR EACH ROW EXECUTE FUNCTION public.integration_write_guard();

ALTER TABLE public.integration_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_external_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY integration_accounts_safe_read
ON public.integration_accounts
FOR SELECT TO authenticated
USING (
  public.integration_actor_role(tenant_id, auth.uid()) IN ('clinic_owner', 'clinic_admin', 'registrar')
);

CREATE POLICY integration_external_references_safe_read
ON public.integration_external_references
FOR SELECT TO authenticated
USING (
  public.integration_actor_role(tenant_id, auth.uid()) IN ('clinic_owner', 'clinic_admin', 'registrar')
);

REVOKE ALL ON public.integration_accounts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.integration_credentials FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.integration_oauth_states FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.integration_external_references FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.integration_accounts TO authenticated;
GRANT SELECT ON public.integration_external_references TO authenticated;
GRANT ALL ON public.integration_accounts TO service_role;
GRANT ALL ON public.integration_credentials TO service_role;
GRANT ALL ON public.integration_oauth_states TO service_role;
GRANT ALL ON public.integration_external_references TO service_role;

CREATE OR REPLACE FUNCTION public.integration_emit_event(
  p_tenant_id uuid,
  p_actor_id uuid,
  p_action text,
  p_integration_account_id uuid,
  p_status text,
  p_external_account_id text DEFAULT NULL,
  p_domain text DEFAULT NULL,
  p_error_code text DEFAULT NULL,
  p_credential_version bigint DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text;
  v_audit_id uuid;
  v_metadata jsonb;
BEGIN
  v_role := public.integration_actor_role(p_tenant_id, p_actor_id);
  v_metadata := jsonb_strip_nulls(jsonb_build_object(
    'integrationAccountId', p_integration_account_id,
    'tenantId', p_tenant_id,
    'externalAccountId', p_external_account_id,
    'domain', p_domain,
    'credentialVersion', p_credential_version,
    'status', p_status,
    'errorCode', p_error_code
  ));

  v_audit_id := public.record_audit_event_internal(
    p_tenant_id => p_tenant_id,
    p_action => p_action,
    p_category => 'system',
    p_target_type => 'integration_account',
    p_target_id => p_integration_account_id::text,
    p_actor_user_id => p_actor_id,
    p_actor_tenant_role => v_role,
    p_before_data => '{}'::jsonb,
    p_after_data => '{}'::jsonb,
    p_diff_data => '{}'::jsonb,
    p_redaction_level => 'restricted',
    p_metadata => v_metadata
  );

  PERFORM public.record_activity_event_internal(
    p_tenant_id => p_tenant_id,
    p_category => 'system',
    p_type => p_action,
    p_title => 'amoCRM integration status changed',
    p_source_type => 'integration_account',
    p_source_id => p_integration_account_id::text,
    p_audit_event_id => v_audit_id,
    p_actor_user_id => p_actor_id,
    p_source_status => p_status,
    p_visibility => 'admin',
    p_severity => CASE WHEN p_error_code IS NULL THEN 'info' ELSE 'warning' END,
    p_metadata => v_metadata
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.amocrm_start_connection_server(
  p_tenant_id uuid,
  p_actor_id uuid,
  p_state_hash text,
  p_redirect_uri_fingerprint text,
  p_state_expires_at timestamptz,
  p_expected_external_account_id text DEFAULT NULL,
  p_expected_domain text DEFAULT NULL,
  p_reconnect boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text;
  v_account public.integration_accounts%ROWTYPE;
  v_state_id uuid;
  v_now timestamptz := transaction_timestamp();
  v_expected_domain text;
BEGIN
  v_role := public.integration_require_role(
    p_tenant_id, p_actor_id, ARRAY['clinic_owner', 'clinic_admin']
  );

  IF p_state_hash IS NULL OR p_state_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'AMOCRM_INVALID_STATE_HASH' USING ERRCODE = '22023';
  END IF;
  IF p_redirect_uri_fingerprint IS NULL OR p_redirect_uri_fingerprint !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'AMOCRM_INVALID_REDIRECT_FINGERPRINT' USING ERRCODE = '22023';
  END IF;
  IF p_state_expires_at <= v_now OR p_state_expires_at > v_now + interval '15 minutes' THEN
    RAISE EXCEPTION 'AMOCRM_INVALID_STATE_EXPIRY' USING ERRCODE = '22023';
  END IF;

  v_expected_domain := CASE
    WHEN p_expected_domain IS NULL OR btrim(p_expected_domain) = '' THEN NULL
    ELSE public.integration_normalize_domain(p_expected_domain)
  END;

  SELECT * INTO v_account
  FROM public.integration_accounts
  WHERE tenant_id = p_tenant_id
    AND provider_code = 'amocrm'
    AND archived_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.integration_accounts(
      tenant_id, provider_code, status, created_by, updated_by
    ) VALUES (
      p_tenant_id, 'amocrm', 'authorization_pending', p_actor_id, p_actor_id
    ) RETURNING * INTO v_account;
  ELSE
    UPDATE public.integration_accounts
    SET status = CASE
          WHEN v_account.status IN ('connected', 'refresh_required', 'degraded', 'account_mismatch')
            THEN v_account.status
          ELSE 'authorization_pending'
        END,
        updated_by = p_actor_id,
        updated_at = v_now,
        last_error_code = NULL,
        last_error_at = NULL
    WHERE id = v_account.id
    RETURNING * INTO v_account;
  END IF;

  UPDATE public.integration_oauth_states
  SET cancelled_at = v_now,
      failure_code = 'superseded_by_new_attempt'
  WHERE tenant_id = p_tenant_id
    AND integration_account_id = v_account.id
    AND consumed_at IS NULL
    AND cancelled_at IS NULL;

  INSERT INTO public.integration_oauth_states(
    state_hash,
    tenant_id,
    integration_account_id,
    initiated_by,
    provider_code,
    expected_external_account_id,
    expected_domain,
    redirect_uri_fingerprint,
    expires_at
  ) VALUES (
    p_state_hash,
    p_tenant_id,
    v_account.id,
    p_actor_id,
    'amocrm',
    nullif(btrim(p_expected_external_account_id), ''),
    v_expected_domain,
    p_redirect_uri_fingerprint,
    p_state_expires_at
  ) RETURNING id INTO v_state_id;

  PERFORM public.integration_emit_event(
    p_tenant_id,
    p_actor_id,
    CASE WHEN p_reconnect THEN 'amocrm_reconnect_started' ELSE 'amocrm_connection_started' END,
    v_account.id,
    v_account.status,
    v_account.external_account_id,
    v_account.external_account_domain,
    NULL,
    v_account.credential_version
  );

  RETURN jsonb_build_object(
    'integrationAccountId', v_account.id,
    'oauthStateId', v_state_id,
    'expiresAt', p_state_expires_at,
    'status', v_account.status,
    'actorRole', v_role
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.amocrm_claim_callback_state_server(
  p_state_hash text,
  p_exchange_lease_token uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_state public.integration_oauth_states%ROWTYPE;
  v_account public.integration_accounts%ROWTYPE;
  v_now timestamptz := transaction_timestamp();
BEGIN
  IF p_state_hash IS NULL OR p_state_hash !~ '^[0-9a-f]{64}$' OR p_exchange_lease_token IS NULL THEN
    RAISE EXCEPTION 'AMOCRM_INVALID_STATE' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_state
  FROM public.integration_oauth_states
  WHERE state_hash = p_state_hash
    AND provider_code = 'amocrm'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AMOCRM_STATE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_state.cancelled_at IS NOT NULL THEN
    RAISE EXCEPTION 'AMOCRM_STATE_CANCELLED' USING ERRCODE = '55000';
  END IF;
  IF v_state.consumed_at IS NOT NULL THEN
    RAISE EXCEPTION 'AMOCRM_STATE_CONSUMED' USING ERRCODE = '55000';
  END IF;
  IF v_state.expires_at <= v_now THEN
    RAISE EXCEPTION 'AMOCRM_STATE_EXPIRED' USING ERRCODE = '22023';
  END IF;
  IF v_state.exchange_started_at IS NOT NULL THEN
    RAISE EXCEPTION 'AMOCRM_STATE_IN_PROGRESS' USING ERRCODE = '55P03';
  END IF;

  SELECT * INTO v_account
  FROM public.integration_accounts
  WHERE id = v_state.integration_account_id
    AND tenant_id = v_state.tenant_id
    AND archived_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AMOCRM_INTEGRATION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.integration_oauth_states
  SET exchange_started_at = v_now,
      exchange_lease_token = p_exchange_lease_token
  WHERE id = v_state.id;

  RETURN jsonb_strip_nulls(jsonb_build_object(
    'oauthStateId', v_state.id,
    'tenantId', v_state.tenant_id,
    'integrationAccountId', v_state.integration_account_id,
    'initiatedBy', v_state.initiated_by,
    'expectedExternalAccountId', v_state.expected_external_account_id,
    'expectedDomain', v_state.expected_domain,
    'redirectUriFingerprint', v_state.redirect_uri_fingerprint,
    'expiresAt', v_state.expires_at,
    'existingExternalAccountId', v_account.external_account_id,
    'existingDomain', v_account.external_account_domain,
    'existingStatus', v_account.status,
    'credentialVersion', v_account.credential_version
  ));
END;
$$;

CREATE OR REPLACE FUNCTION public.amocrm_fail_callback_server(
  p_state_hash text,
  p_exchange_lease_token uuid,
  p_error_code text,
  p_terminal boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_state public.integration_oauth_states%ROWTYPE;
  v_account public.integration_accounts%ROWTYPE;
  v_now timestamptz := transaction_timestamp();
BEGIN
  SELECT * INTO v_state
  FROM public.integration_oauth_states
  WHERE state_hash = p_state_hash
  FOR UPDATE;

  IF NOT FOUND OR v_state.exchange_lease_token IS DISTINCT FROM p_exchange_lease_token THEN
    RETURN jsonb_build_object('ok', false, 'ignored', true);
  END IF;

  SELECT * INTO v_account
  FROM public.integration_accounts
  WHERE id = v_state.integration_account_id
  FOR UPDATE;

  UPDATE public.integration_oauth_states
  SET exchange_started_at = CASE WHEN p_terminal THEN exchange_started_at ELSE NULL END,
      exchange_lease_token = CASE WHEN p_terminal THEN exchange_lease_token ELSE NULL END,
      consumed_at = CASE WHEN p_terminal THEN v_now ELSE NULL END,
      failure_code = p_error_code
  WHERE id = v_state.id;

  UPDATE public.integration_accounts
  SET last_error_code = p_error_code,
      last_error_at = v_now,
      status = CASE
        WHEN credential_version > 0 THEN 'degraded'
        WHEN p_terminal THEN 'disconnected'
        ELSE 'authorization_pending'
      END,
      updated_at = v_now,
      updated_by = v_state.initiated_by
  WHERE id = v_account.id
  RETURNING * INTO v_account;

  PERFORM public.integration_emit_event(
    v_state.tenant_id,
    v_state.initiated_by,
    'amocrm_connection_failed',
    v_account.id,
    v_account.status,
    v_account.external_account_id,
    v_account.external_account_domain,
    p_error_code,
    v_account.credential_version
  );

  RETURN jsonb_build_object('ok', true, 'terminal', p_terminal, 'status', v_account.status);
END;
$$;

CREATE OR REPLACE FUNCTION public.amocrm_complete_callback_server(
  p_state_hash text,
  p_exchange_lease_token uuid,
  p_external_account_id text,
  p_external_account_domain text,
  p_display_name text,
  p_encrypted_access_credential bytea,
  p_encrypted_refresh_credential bytea,
  p_encryption_key_version integer,
  p_access_expires_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_state public.integration_oauth_states%ROWTYPE;
  v_account public.integration_accounts%ROWTYPE;
  v_conflict uuid;
  v_domain text;
  v_external_id text;
  v_new_version bigint;
  v_now timestamptz := transaction_timestamp();
BEGIN
  v_external_id := nullif(btrim(p_external_account_id), '');
  v_domain := public.integration_normalize_domain(p_external_account_domain);

  IF v_external_id IS NULL OR p_encrypted_access_credential IS NULL
     OR p_encrypted_refresh_credential IS NULL OR p_encryption_key_version < 1
     OR p_access_expires_at <= v_now THEN
    RAISE EXCEPTION 'AMOCRM_INVALID_CREDENTIAL_RESPONSE' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_state
  FROM public.integration_oauth_states
  WHERE state_hash = p_state_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AMOCRM_STATE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_state.consumed_at IS NOT NULL THEN
    RAISE EXCEPTION 'AMOCRM_STATE_CONSUMED' USING ERRCODE = '55000';
  END IF;
  IF v_state.cancelled_at IS NOT NULL THEN
    RAISE EXCEPTION 'AMOCRM_STATE_CANCELLED' USING ERRCODE = '55000';
  END IF;
  IF v_state.exchange_lease_token IS DISTINCT FROM p_exchange_lease_token THEN
    RAISE EXCEPTION 'AMOCRM_CALLBACK_LEASE_MISMATCH' USING ERRCODE = '40001';
  END IF;

  SELECT * INTO v_account
  FROM public.integration_accounts
  WHERE id = v_state.integration_account_id
    AND tenant_id = v_state.tenant_id
  FOR UPDATE;

  IF v_state.expected_external_account_id IS NOT NULL
     AND v_state.expected_external_account_id <> v_external_id THEN
    UPDATE public.integration_oauth_states
    SET consumed_at = v_now,
        failure_code = 'account_mismatch'
    WHERE id = v_state.id;

    UPDATE public.integration_accounts
    SET status = 'account_mismatch',
        last_error_code = 'account_mismatch',
        last_error_at = v_now,
        updated_by = v_state.initiated_by,
        updated_at = v_now
    WHERE id = v_account.id
    RETURNING * INTO v_account;

    PERFORM public.integration_emit_event(
      v_state.tenant_id, v_state.initiated_by, 'amocrm_account_mismatch',
      v_account.id, v_account.status, v_external_id, v_domain,
      'account_mismatch', v_account.credential_version
    );
    RETURN jsonb_build_object('ok', false, 'errorCode', 'account_mismatch');
  END IF;

  IF v_state.expected_domain IS NOT NULL AND v_state.expected_domain <> v_domain THEN
    UPDATE public.integration_oauth_states
    SET consumed_at = v_now,
        failure_code = 'account_mismatch'
    WHERE id = v_state.id;

    UPDATE public.integration_accounts
    SET status = 'account_mismatch',
        last_error_code = 'account_mismatch',
        last_error_at = v_now,
        updated_by = v_state.initiated_by,
        updated_at = v_now
    WHERE id = v_account.id
    RETURNING * INTO v_account;

    PERFORM public.integration_emit_event(
      v_state.tenant_id, v_state.initiated_by, 'amocrm_account_mismatch',
      v_account.id, v_account.status, v_external_id, v_domain,
      'account_mismatch', v_account.credential_version
    );
    RETURN jsonb_build_object('ok', false, 'errorCode', 'account_mismatch');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('amocrm:' || v_external_id, 0));

  SELECT id INTO v_conflict
  FROM public.integration_accounts
  WHERE provider_code = 'amocrm'
    AND external_account_id = v_external_id
    AND tenant_id <> v_state.tenant_id
    AND archived_at IS NULL
    AND status IN ('connected', 'refresh_required', 'degraded', 'account_mismatch', 'revoked', 'disabled')
  LIMIT 1
  FOR UPDATE;

  IF v_conflict IS NOT NULL THEN
    UPDATE public.integration_oauth_states
    SET consumed_at = v_now,
        failure_code = 'account_already_bound'
    WHERE id = v_state.id;

    UPDATE public.integration_accounts
    SET status = CASE WHEN credential_version > 0 THEN status ELSE 'disconnected' END,
        last_error_code = 'account_already_bound',
        last_error_at = v_now,
        updated_by = v_state.initiated_by,
        updated_at = v_now
    WHERE id = v_account.id
    RETURNING * INTO v_account;

    PERFORM public.integration_emit_event(
      v_state.tenant_id, v_state.initiated_by, 'amocrm_connection_failed',
      v_account.id, v_account.status, v_external_id, v_domain,
      'account_already_bound', v_account.credential_version
    );
    RETURN jsonb_build_object('ok', false, 'errorCode', 'account_already_bound');
  END IF;

  v_new_version := v_account.credential_version + 1;

  INSERT INTO public.integration_credentials(
    integration_account_id,
    tenant_id,
    provider_code,
    encrypted_access_credential,
    encrypted_refresh_credential,
    encryption_key_version,
    credential_version,
    access_expires_at,
    refreshed_at
  ) VALUES (
    v_account.id,
    v_state.tenant_id,
    'amocrm',
    p_encrypted_access_credential,
    p_encrypted_refresh_credential,
    p_encryption_key_version,
    v_new_version,
    p_access_expires_at,
    v_now
  )
  ON CONFLICT (integration_account_id) DO UPDATE
  SET encrypted_access_credential = EXCLUDED.encrypted_access_credential,
      encrypted_refresh_credential = EXCLUDED.encrypted_refresh_credential,
      encryption_key_version = EXCLUDED.encryption_key_version,
      credential_version = EXCLUDED.credential_version,
      access_expires_at = EXCLUDED.access_expires_at,
      refreshed_at = EXCLUDED.refreshed_at,
      updated_at = v_now;

  UPDATE public.integration_accounts
  SET status = 'connected',
      external_account_id = v_external_id,
      external_account_domain = v_domain,
      display_name = nullif(btrim(p_display_name), ''),
      credential_version = v_new_version,
      token_expires_at = p_access_expires_at,
      last_connected_at = v_now,
      last_verified_at = v_now,
      last_refresh_at = CASE WHEN v_new_version > 1 THEN v_now ELSE last_refresh_at END,
      last_error_code = NULL,
      last_error_at = NULL,
      disconnected_at = NULL,
      refresh_lease_token = NULL,
      refresh_lease_version = NULL,
      refresh_lease_expires_at = NULL,
      updated_by = v_state.initiated_by,
      updated_at = v_now
  WHERE id = v_account.id
  RETURNING * INTO v_account;

  UPDATE public.integration_oauth_states
  SET consumed_at = v_now,
      failure_code = NULL
  WHERE id = v_state.id;

  PERFORM public.integration_emit_event(
    v_state.tenant_id, v_state.initiated_by, 'amocrm_connection_completed',
    v_account.id, v_account.status, v_account.external_account_id,
    v_account.external_account_domain, NULL, v_account.credential_version
  );
  PERFORM public.integration_emit_event(
    v_state.tenant_id, v_state.initiated_by, 'amocrm_account_verified',
    v_account.id, v_account.status, v_account.external_account_id,
    v_account.external_account_domain, NULL, v_account.credential_version
  );

  RETURN jsonb_build_object(
    'ok', true,
    'integrationAccountId', v_account.id,
    'status', v_account.status,
    'credentialVersion', v_account.credential_version,
    'externalAccountId', v_account.external_account_id,
    'externalAccountDomain', v_account.external_account_domain,
    'displayName', v_account.display_name,
    'tokenExpiresAt', v_account.token_expires_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.amocrm_get_health_server(
  p_tenant_id uuid,
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_role text;
  v_account public.integration_accounts%ROWTYPE;
BEGIN
  v_role := public.integration_require_role(
    p_tenant_id, p_actor_id, ARRAY['clinic_owner', 'clinic_admin', 'registrar']
  );

  SELECT * INTO v_account
  FROM public.integration_accounts
  WHERE tenant_id = p_tenant_id
    AND provider_code = 'amocrm'
    AND archived_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'providerCode', 'amocrm',
      'status', 'disconnected',
      'connected', false,
      'actionRequired', 'connect',
      'canReconnect', v_role IN ('clinic_owner', 'clinic_admin'),
      'canDisconnect', false,
      'canManage', v_role IN ('clinic_owner', 'clinic_admin'),
      'role', v_role
    );
  END IF;

  RETURN jsonb_strip_nulls(jsonb_build_object(
    'integrationAccountId', v_account.id,
    'providerCode', v_account.provider_code,
    'status', v_account.status,
    'connected', v_account.status IN ('connected', 'refresh_required', 'degraded'),
    'externalAccountId', v_account.external_account_id,
    'externalAccountDomain', v_account.external_account_domain,
    'displayName', v_account.display_name,
    'tokenExpiresAt', v_account.token_expires_at,
    'lastConnectedAt', v_account.last_connected_at,
    'lastVerifiedAt', v_account.last_verified_at,
    'lastRefreshAt', v_account.last_refresh_at,
    'lastErrorCode', v_account.last_error_code,
    'lastErrorAt', v_account.last_error_at,
    'credentialVersion', v_account.credential_version,
    'actionRequired', CASE
      WHEN v_account.status IN ('revoked', 'refresh_required', 'account_mismatch') THEN 'reconnect'
      WHEN v_account.status = 'degraded' THEN 'check_later'
      WHEN v_account.status IN ('disconnected', 'disabled') THEN 'connect'
      WHEN v_account.status = 'authorization_pending' THEN 'complete_authorization'
      ELSE 'none'
    END,
    'canReconnect', v_role IN ('clinic_owner', 'clinic_admin'),
    'canDisconnect', v_role IN ('clinic_owner', 'clinic_admin') AND v_account.status <> 'disconnected',
    'canManage', v_role IN ('clinic_owner', 'clinic_admin'),
    'role', v_role
  ));
END;
$$;

CREATE OR REPLACE FUNCTION public.amocrm_acquire_refresh_server(
  p_tenant_id uuid,
  p_actor_id uuid,
  p_refresh_lease_token uuid,
  p_min_valid_seconds integer DEFAULT 300
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text;
  v_account public.integration_accounts%ROWTYPE;
  v_credentials public.integration_credentials%ROWTYPE;
  v_now timestamptz := transaction_timestamp();
BEGIN
  v_role := public.integration_require_role(
    p_tenant_id, p_actor_id, ARRAY['clinic_owner', 'clinic_admin']
  );

  SELECT * INTO v_account
  FROM public.integration_accounts
  WHERE tenant_id = p_tenant_id
    AND provider_code = 'amocrm'
    AND archived_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AMOCRM_INTEGRATION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_credentials
  FROM public.integration_credentials
  WHERE integration_account_id = v_account.id
    AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'reconnect_required', 'errorCode', 'credential_revoked');
  END IF;

  IF v_credentials.access_expires_at > v_now + make_interval(secs => greatest(p_min_valid_seconds, 0)) THEN
    RETURN jsonb_build_object(
      'status', 'no_change',
      'credentialVersion', v_credentials.credential_version,
      'tokenExpiresAt', v_credentials.access_expires_at
    );
  END IF;

  IF v_account.refresh_lease_token IS NOT NULL
     AND v_account.refresh_lease_expires_at > v_now THEN
    RETURN jsonb_build_object(
      'status', 'in_progress',
      'credentialVersion', v_account.refresh_lease_version,
      'leaseExpiresAt', v_account.refresh_lease_expires_at
    );
  END IF;

  UPDATE public.integration_accounts
  SET refresh_lease_token = p_refresh_lease_token,
      refresh_lease_version = v_credentials.credential_version,
      refresh_lease_expires_at = v_now + interval '60 seconds',
      updated_by = p_actor_id,
      updated_at = v_now
  WHERE id = v_account.id;

  PERFORM public.integration_emit_event(
    p_tenant_id, p_actor_id, 'amocrm_refresh_started', v_account.id,
    v_account.status, v_account.external_account_id, v_account.external_account_domain,
    NULL, v_credentials.credential_version
  );

  RETURN jsonb_build_object(
    'status', 'acquired',
    'integrationAccountId', v_account.id,
    'tenantId', p_tenant_id,
    'externalAccountId', v_account.external_account_id,
    'externalAccountDomain', v_account.external_account_domain,
    'credentialVersion', v_credentials.credential_version,
    'encryptionKeyVersion', v_credentials.encryption_key_version,
    'encryptedRefreshCredential', encode(v_credentials.encrypted_refresh_credential, 'hex'),
    'leaseExpiresAt', v_now + interval '60 seconds',
    'actorRole', v_role
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.amocrm_commit_refresh_server(
  p_integration_account_id uuid,
  p_actor_id uuid,
  p_refresh_lease_token uuid,
  p_expected_credential_version bigint,
  p_encrypted_access_credential bytea,
  p_encrypted_refresh_credential bytea,
  p_encryption_key_version integer,
  p_access_expires_at timestamptz,
  p_verified_external_account_id text,
  p_verified_external_account_domain text,
  p_verified_display_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_account public.integration_accounts%ROWTYPE;
  v_credentials public.integration_credentials%ROWTYPE;
  v_domain text;
  v_new_version bigint;
  v_mismatch boolean;
  v_now timestamptz := transaction_timestamp();
BEGIN
  SELECT * INTO v_account
  FROM public.integration_accounts
  WHERE id = p_integration_account_id
    AND archived_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AMOCRM_INTEGRATION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.integration_require_role(
    v_account.tenant_id, p_actor_id, ARRAY['clinic_owner', 'clinic_admin']
  );

  SELECT * INTO v_credentials
  FROM public.integration_credentials
  WHERE integration_account_id = v_account.id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AMOCRM_CREDENTIAL_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_account.refresh_lease_token IS DISTINCT FROM p_refresh_lease_token
     OR v_account.refresh_lease_version IS DISTINCT FROM p_expected_credential_version THEN
    RETURN jsonb_build_object(
      'status', 'stale',
      'credentialVersion', v_credentials.credential_version
    );
  END IF;

  IF v_credentials.credential_version <> p_expected_credential_version THEN
    RETURN jsonb_build_object(
      'status', 'stale',
      'credentialVersion', v_credentials.credential_version
    );
  END IF;

  v_domain := public.integration_normalize_domain(p_verified_external_account_domain);
  v_mismatch := v_account.external_account_id IS DISTINCT FROM nullif(btrim(p_verified_external_account_id), '')
    OR v_account.external_account_domain IS DISTINCT FROM v_domain;
  v_new_version := v_credentials.credential_version + 1;

  UPDATE public.integration_credentials
  SET encrypted_access_credential = p_encrypted_access_credential,
      encrypted_refresh_credential = p_encrypted_refresh_credential,
      encryption_key_version = p_encryption_key_version,
      credential_version = v_new_version,
      access_expires_at = p_access_expires_at,
      refreshed_at = v_now,
      updated_at = v_now
  WHERE integration_account_id = v_account.id;

  UPDATE public.integration_accounts
  SET status = CASE WHEN v_mismatch THEN 'account_mismatch' ELSE 'connected' END,
      credential_version = v_new_version,
      token_expires_at = p_access_expires_at,
      last_refresh_at = v_now,
      last_verified_at = v_now,
      display_name = CASE WHEN v_mismatch THEN display_name ELSE nullif(btrim(p_verified_display_name), '') END,
      last_error_code = CASE WHEN v_mismatch THEN 'account_mismatch' ELSE NULL END,
      last_error_at = CASE WHEN v_mismatch THEN v_now ELSE NULL END,
      refresh_lease_token = NULL,
      refresh_lease_version = NULL,
      refresh_lease_expires_at = NULL,
      updated_by = p_actor_id,
      updated_at = v_now
  WHERE id = v_account.id
  RETURNING * INTO v_account;

  PERFORM public.integration_emit_event(
    v_account.tenant_id,
    p_actor_id,
    CASE WHEN v_mismatch THEN 'amocrm_account_mismatch' ELSE 'amocrm_refresh_succeeded' END,
    v_account.id,
    v_account.status,
    v_account.external_account_id,
    v_account.external_account_domain,
    CASE WHEN v_mismatch THEN 'account_mismatch' ELSE NULL END,
    v_account.credential_version
  );

  RETURN jsonb_build_object(
    'status', CASE WHEN v_mismatch THEN 'account_mismatch' ELSE 'refreshed' END,
    'credentialVersion', v_account.credential_version,
    'tokenExpiresAt', v_account.token_expires_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.amocrm_fail_refresh_server(
  p_integration_account_id uuid,
  p_actor_id uuid,
  p_refresh_lease_token uuid,
  p_error_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_account public.integration_accounts%ROWTYPE;
  v_status text;
  v_now timestamptz := transaction_timestamp();
BEGIN
  SELECT * INTO v_account
  FROM public.integration_accounts
  WHERE id = p_integration_account_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AMOCRM_INTEGRATION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.integration_require_role(
    v_account.tenant_id, p_actor_id, ARRAY['clinic_owner', 'clinic_admin']
  );

  IF v_account.refresh_lease_token IS DISTINCT FROM p_refresh_lease_token THEN
    RETURN jsonb_build_object('status', 'stale');
  END IF;

  v_status := CASE
    WHEN p_error_code IN ('invalid_grant', 'credential_revoked') THEN 'refresh_required'
    WHEN p_error_code = 'account_mismatch' THEN 'account_mismatch'
    WHEN p_error_code = 'configuration_error' THEN 'disabled'
    ELSE 'degraded'
  END;

  UPDATE public.integration_accounts
  SET status = v_status,
      last_error_code = p_error_code,
      last_error_at = v_now,
      refresh_lease_token = NULL,
      refresh_lease_version = NULL,
      refresh_lease_expires_at = NULL,
      updated_by = p_actor_id,
      updated_at = v_now
  WHERE id = v_account.id
  RETURNING * INTO v_account;

  PERFORM public.integration_emit_event(
    v_account.tenant_id, p_actor_id, 'amocrm_refresh_failed',
    v_account.id, v_account.status, v_account.external_account_id,
    v_account.external_account_domain, p_error_code, v_account.credential_version
  );

  RETURN jsonb_build_object('status', v_account.status, 'errorCode', p_error_code);
END;
$$;

CREATE OR REPLACE FUNCTION public.amocrm_disconnect_server(
  p_tenant_id uuid,
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_account public.integration_accounts%ROWTYPE;
  v_changed boolean := false;
  v_now timestamptz := transaction_timestamp();
BEGIN
  PERFORM public.integration_require_role(
    p_tenant_id, p_actor_id, ARRAY['clinic_owner', 'clinic_admin']
  );

  SELECT * INTO v_account
  FROM public.integration_accounts
  WHERE tenant_id = p_tenant_id
    AND provider_code = 'amocrm'
    AND archived_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'disconnected', 'replayed', true);
  END IF;

  v_changed := v_account.status <> 'disconnected'
    OR EXISTS (
      SELECT 1 FROM public.integration_credentials
      WHERE integration_account_id = v_account.id
    );

  DELETE FROM public.integration_credentials
  WHERE integration_account_id = v_account.id;

  UPDATE public.integration_oauth_states
  SET cancelled_at = v_now,
      failure_code = 'disconnected'
  WHERE integration_account_id = v_account.id
    AND consumed_at IS NULL
    AND cancelled_at IS NULL;

  UPDATE public.integration_accounts
  SET status = 'disconnected',
      token_expires_at = NULL,
      disconnected_at = coalesce(disconnected_at, v_now),
      refresh_lease_token = NULL,
      refresh_lease_version = NULL,
      refresh_lease_expires_at = NULL,
      last_error_code = NULL,
      last_error_at = NULL,
      updated_by = p_actor_id,
      updated_at = v_now
  WHERE id = v_account.id
  RETURNING * INTO v_account;

  IF v_changed THEN
    PERFORM public.integration_emit_event(
      p_tenant_id, p_actor_id, 'amocrm_disconnected',
      v_account.id, v_account.status, v_account.external_account_id,
      v_account.external_account_domain, NULL, v_account.credential_version
    );
  END IF;

  RETURN jsonb_build_object(
    'status', 'disconnected',
    'replayed', NOT v_changed,
    'integrationAccountId', v_account.id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.amocrm_create_external_reference_server(
  p_tenant_id uuid,
  p_actor_id uuid,
  p_entity_type text,
  p_internal_entity_id uuid,
  p_external_entity_id text,
  p_external_parent_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_account public.integration_accounts%ROWTYPE;
  v_reference public.integration_external_references%ROWTYPE;
BEGIN
  PERFORM public.integration_require_role(
    p_tenant_id, p_actor_id, ARRAY['clinic_owner', 'clinic_admin']
  );

  SELECT * INTO v_account
  FROM public.integration_accounts
  WHERE tenant_id = p_tenant_id
    AND provider_code = 'amocrm'
    AND archived_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AMOCRM_INTEGRATION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.integration_external_references(
    tenant_id, integration_account_id, provider_code, entity_type,
    internal_entity_id, external_entity_id, external_parent_id
  ) VALUES (
    p_tenant_id, v_account.id, 'amocrm', p_entity_type,
    p_internal_entity_id, btrim(p_external_entity_id), nullif(btrim(p_external_parent_id), '')
  ) RETURNING * INTO v_reference;

  PERFORM public.integration_emit_event(
    p_tenant_id, p_actor_id, 'amocrm_external_reference_created',
    v_account.id, v_account.status, v_account.external_account_id,
    v_account.external_account_domain, NULL, v_account.credential_version
  );

  RETURN jsonb_build_object(
    'id', v_reference.id,
    'entityType', v_reference.entity_type,
    'internalEntityId', v_reference.internal_entity_id,
    'externalEntityId', v_reference.external_entity_id,
    'version', v_reference.version
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.amocrm_archive_external_reference_server(
  p_tenant_id uuid,
  p_actor_id uuid,
  p_reference_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reference public.integration_external_references%ROWTYPE;
  v_account public.integration_accounts%ROWTYPE;
BEGIN
  PERFORM public.integration_require_role(
    p_tenant_id, p_actor_id, ARRAY['clinic_owner', 'clinic_admin']
  );

  SELECT * INTO v_reference
  FROM public.integration_external_references
  WHERE id = p_reference_id
    AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AMOCRM_REFERENCE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_reference.archived_at IS NULL THEN
    UPDATE public.integration_external_references
    SET archived_at = transaction_timestamp(),
        updated_at = transaction_timestamp(),
        version = version + 1
    WHERE id = v_reference.id
    RETURNING * INTO v_reference;

    SELECT * INTO v_account
    FROM public.integration_accounts
    WHERE id = v_reference.integration_account_id;

    PERFORM public.integration_emit_event(
      p_tenant_id, p_actor_id, 'amocrm_external_reference_archived',
      v_account.id, v_account.status, v_account.external_account_id,
      v_account.external_account_domain, NULL, v_account.credential_version
    );
  END IF;

  RETURN jsonb_build_object(
    'id', v_reference.id,
    'archived', true,
    'version', v_reference.version
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.amocrm_list_external_references_server(
  p_tenant_id uuid,
  p_actor_id uuid,
  p_entity_type text DEFAULT NULL
)
RETURNS SETOF public.integration_external_references
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  PERFORM public.integration_require_role(
    p_tenant_id, p_actor_id, ARRAY['clinic_owner', 'clinic_admin', 'registrar']
  );

  RETURN QUERY
  SELECT r.*
  FROM public.integration_external_references r
  WHERE r.tenant_id = p_tenant_id
    AND r.archived_at IS NULL
    AND (p_entity_type IS NULL OR r.entity_type = p_entity_type)
  ORDER BY r.created_at, r.id;
END;
$$;

COMMENT ON TABLE public.integration_accounts IS
  'Tenant-scoped safe integration account metadata. Contains no provider credentials.';
COMMENT ON TABLE public.integration_credentials IS
  'Protected encrypted provider credentials. No anon/authenticated read or write grant.';
COMMENT ON TABLE public.integration_oauth_states IS
  'One-time tenant/user/integration-bound OAuth state hashes. Raw state is never persisted.';
COMMENT ON TABLE public.integration_external_references IS
  'Tenant-scoped external identifier foundation only. No synchronization payloads.';

REVOKE ALL ON FUNCTION public.integration_actor_role(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.integration_require_role(uuid, uuid, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.integration_emit_event(uuid, uuid, text, uuid, text, text, text, text, bigint) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.amocrm_start_connection_server(uuid, uuid, text, text, timestamptz, text, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.amocrm_claim_callback_state_server(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.amocrm_fail_callback_server(text, uuid, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.amocrm_complete_callback_server(text, uuid, text, text, text, bytea, bytea, integer, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.amocrm_get_health_server(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.amocrm_acquire_refresh_server(uuid, uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.amocrm_commit_refresh_server(uuid, uuid, uuid, bigint, bytea, bytea, integer, timestamptz, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.amocrm_fail_refresh_server(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.amocrm_disconnect_server(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.amocrm_create_external_reference_server(uuid, uuid, text, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.amocrm_archive_external_reference_server(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.amocrm_list_external_references_server(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.integration_actor_role(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.integration_require_role(uuid, uuid, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.integration_emit_event(uuid, uuid, text, uuid, text, text, text, text, bigint) TO service_role;

GRANT EXECUTE ON FUNCTION public.amocrm_start_connection_server(uuid, uuid, text, text, timestamptz, text, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.amocrm_claim_callback_state_server(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.amocrm_fail_callback_server(text, uuid, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.amocrm_complete_callback_server(text, uuid, text, text, text, bytea, bytea, integer, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.amocrm_get_health_server(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.amocrm_acquire_refresh_server(uuid, uuid, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.amocrm_commit_refresh_server(uuid, uuid, uuid, bigint, bytea, bytea, integer, timestamptz, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.amocrm_fail_refresh_server(uuid, uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.amocrm_disconnect_server(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.amocrm_create_external_reference_server(uuid, uuid, text, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.amocrm_archive_external_reference_server(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.amocrm_list_external_references_server(uuid, uuid, text) TO service_role;

