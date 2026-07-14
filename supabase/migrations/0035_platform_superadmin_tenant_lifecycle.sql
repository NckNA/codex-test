-- 0035_platform_superadmin_tenant_lifecycle.sql
-- PLATFORM-SUPERADMIN-TENANT-LIFECYCLE-001
-- Platform-level tenant provisioning and lifecycle foundation.
-- No cloud apply, billing provider, hard-delete API, support impersonation, or custom permissions.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. Existing tenant and membership compatibility
-- -----------------------------------------------------------------------------

ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS tenants_status_check;
UPDATE public.tenants SET status = 'archived' WHERE status = 'deleted';
ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_status_check
  CHECK (status IN ('provisioning', 'active', 'suspended', 'expired', 'archived'));

ALTER TABLE public.tenant_users
  ADD COLUMN IF NOT EXISTS membership_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT transaction_timestamp();

ALTER TABLE public.tenant_users DROP CONSTRAINT IF EXISTS tenant_users_membership_status_check;
ALTER TABLE public.tenant_users
  ADD CONSTRAINT tenant_users_membership_status_check
  CHECK (membership_status IN ('active', 'disabled', 'archived'));

CREATE INDEX IF NOT EXISTS tenant_users_active_owner_idx
  ON public.tenant_users (tenant_id, role, user_id)
  WHERE role = 'clinic_owner'::public.app_role AND membership_status = 'active';

-- -----------------------------------------------------------------------------
-- 2. Platform-superadmin identity
-- -----------------------------------------------------------------------------

CREATE TABLE public.platform_administrators (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  display_name text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  disabled_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object')
);

COMMENT ON TABLE public.platform_administrators IS
  'Global DentalFlow platform administrators. This is not tenant membership and never grants clinical access.';
COMMENT ON COLUMN public.platform_administrators.metadata IS
  'Safe platform metadata only. Never store tokens, passwords, patient, clinical, or financial data.';

ALTER TABLE public.platform_administrators ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_active_platform_superadmin(
  p_user_id uuid DEFAULT auth.uid()
) RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT p_user_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.platform_administrators pa
    WHERE pa.user_id = p_user_id
      AND pa.status = 'active'
      AND pa.disabled_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.require_active_platform_superadmin()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT public.is_active_platform_superadmin(v_actor) THEN
    RAISE EXCEPTION 'PLATFORM_ADMIN_REQUIRED' USING ERRCODE = '42501';
  END IF;
  RETURN v_actor;
END;
$$;

DROP POLICY IF EXISTS platform_administrators_read_for_platform_admins ON public.platform_administrators;
CREATE POLICY platform_administrators_read_for_platform_admins
ON public.platform_administrators
FOR SELECT
TO authenticated
USING (public.is_active_platform_superadmin(auth.uid()));

REVOKE ALL ON TABLE public.platform_administrators FROM anon, authenticated;
GRANT SELECT ON TABLE public.platform_administrators TO authenticated;
REVOKE ALL ON FUNCTION public.require_active_platform_superadmin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_platform_superadmin(uuid) TO authenticated;

-- Secure bootstrap is intentionally manual/server-controlled, for example:
-- INSERT INTO public.platform_administrators(user_id, display_name, created_by)
-- VALUES ('<verified auth user uuid>', '<operator name>', '<authorized operator uuid>');
-- Run only via local/production operator SQL or service-role tooling. No public bootstrap RPC exists.

-- -----------------------------------------------------------------------------
-- 3. Lifecycle, subscription history, and idempotent operations
-- -----------------------------------------------------------------------------

CREATE TABLE public.tenant_lifecycle (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('provisioning', 'active', 'suspended', 'expired', 'archived')),
  subscription_started_at timestamptz,
  subscription_expires_at timestamptz,
  grace_expires_at timestamptz,
  suspended_at timestamptz,
  suspended_until timestamptz,
  suspension_reason_code text,
  suspension_note text,
  resumed_at timestamptz,
  expired_at timestamptz,
  archived_at timestamptz,
  lifecycle_version bigint NOT NULL DEFAULT 1 CHECK (lifecycle_version > 0),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  CHECK (subscription_expires_at IS NULL OR subscription_started_at IS NOT NULL),
  CHECK (subscription_expires_at IS NULL OR subscription_expires_at > subscription_started_at),
  CHECK (grace_expires_at IS NULL OR subscription_expires_at IS NOT NULL),
  CHECK (grace_expires_at IS NULL OR grace_expires_at >= subscription_expires_at),
  CHECK (suspended_until IS NULL OR suspended_at IS NOT NULL),
  CHECK (suspended_until IS NULL OR suspended_until > suspended_at),
  CHECK (length(COALESCE(suspension_note, '')) <= 500)
);

CREATE TABLE public.tenant_subscription_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  grace_expires_at timestamptz,
  status text NOT NULL CHECK (status IN ('scheduled', 'active', 'superseded', 'expired', 'cancelled')),
  reason_code text NOT NULL,
  previous_period_id uuid REFERENCES public.tenant_subscription_periods(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  superseded_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  UNIQUE (tenant_id, id),
  CHECK (expires_at > starts_at),
  CHECK (grace_expires_at IS NULL OR grace_expires_at >= expires_at),
  CHECK ((status = 'superseded') = (superseded_at IS NOT NULL))
);

CREATE UNIQUE INDEX tenant_subscription_periods_one_current_idx
  ON public.tenant_subscription_periods (tenant_id)
  WHERE superseded_at IS NULL;
CREATE INDEX tenant_subscription_periods_history_idx
  ON public.tenant_subscription_periods (tenant_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.guard_tenant_hard_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $hard_delete$
DECLARE
  v_sql_role text := COALESCE(current_setting('role', true), 'none');
  v_server_fixture boolean := false;
BEGIN
  SELECT COALESCE(tl.metadata @> '{"serverBootstrap":true}'::jsonb, false)
  INTO v_server_fixture
  FROM public.tenant_lifecycle tl
  WHERE tl.tenant_id = OLD.id;

  IF v_server_fixture
     AND (v_sql_role IN ('none', 'postgres', 'service_role') OR current_user = 'postgres') THEN
    RETURN OLD;
  END IF;

  IF current_setting('app.platform_test_cleanup', true) = 'on'
     AND current_user = 'postgres'
     AND v_sql_role IN ('none', 'postgres') THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'TENANT_HARD_DELETE_FORBIDDEN' USING ERRCODE = '42501';
END;
$hard_delete$;

DROP TRIGGER IF EXISTS tenants_hard_delete_guard ON public.tenants;
CREATE TRIGGER tenants_hard_delete_guard
BEFORE DELETE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.guard_tenant_hard_delete();

REVOKE ALL ON FUNCTION public.guard_tenant_hard_delete() FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE public.platform_tenant_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_key text NOT NULL CHECK (length(btrim(operation_key)) BETWEEN 1 AND 200),
  operation_type text NOT NULL CHECK (operation_type IN (
    'tenant_create',
    'owner_assign',
    'owner_add',
    'owner_replace',
    'owner_remove',
    'subscription_set',
    'subscription_extend',
    'subscription_shorten',
    'tenant_suspend',
    'tenant_resume',
    'tenant_archive'
  )),
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  result jsonb NOT NULL CHECK (jsonb_typeof(result) = 'object'),
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);

CREATE UNIQUE INDEX platform_tenant_operations_scope_key_idx
  ON public.platform_tenant_operations (
    actor_user_id,
    operation_type,
    operation_key,
    COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );
CREATE INDEX platform_tenant_operations_tenant_created_idx
  ON public.platform_tenant_operations (tenant_id, created_at DESC);

ALTER TABLE public.tenant_lifecycle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_subscription_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_tenant_operations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.tenant_lifecycle FROM anon, authenticated;
REVOKE ALL ON TABLE public.tenant_subscription_periods FROM anon, authenticated;
REVOKE ALL ON TABLE public.platform_tenant_operations FROM anon, authenticated;

DROP POLICY IF EXISTS tenant_lifecycle_safe_read ON public.tenant_lifecycle;
CREATE POLICY tenant_lifecycle_safe_read
ON public.tenant_lifecycle
FOR SELECT
TO authenticated
USING (
  public.is_active_platform_superadmin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.tenant_users tu
    WHERE tu.tenant_id = tenant_lifecycle.tenant_id
      AND tu.user_id = auth.uid()
      AND tu.membership_status = 'active'
      AND tu.role IN ('clinic_owner'::public.app_role,'clinic_admin'::public.app_role)
  )
);

DROP POLICY IF EXISTS tenant_subscription_periods_safe_read ON public.tenant_subscription_periods;
CREATE POLICY tenant_subscription_periods_safe_read
ON public.tenant_subscription_periods
FOR SELECT
TO authenticated
USING (
  public.is_active_platform_superadmin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.tenant_users tu
    WHERE tu.tenant_id = tenant_subscription_periods.tenant_id
      AND tu.user_id = auth.uid()
      AND tu.membership_status = 'active'
      AND tu.role IN ('clinic_owner'::public.app_role,'clinic_admin'::public.app_role)
  )
);

GRANT SELECT ON TABLE public.tenant_lifecycle TO authenticated;
GRANT SELECT ON TABLE public.tenant_subscription_periods TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_operation_fingerprint(p_payload jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT encode(extensions.digest(p_payload::text, 'sha256'), 'hex');
$$;

CREATE OR REPLACE FUNCTION public.platform_operation_replay(
  p_operation_type text,
  p_operation_key text,
  p_tenant_id uuid,
  p_fingerprint text,
  p_actor_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing public.platform_tenant_operations%ROWTYPE;
  v_scope text := p_actor_user_id::text || '|' || p_operation_type || '|' ||
    COALESCE(p_tenant_id::text, 'create') || '|' || p_operation_key;
BEGIN
  IF p_operation_key IS NULL OR length(btrim(p_operation_key)) = 0 THEN
    RAISE EXCEPTION 'PLATFORM_OPERATION_KEY_REQUIRED' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_scope, 0));

  SELECT * INTO v_existing
  FROM public.platform_tenant_operations
  WHERE actor_user_id = p_actor_user_id
    AND operation_type = p_operation_type
    AND operation_key = p_operation_key
    AND tenant_id IS NOT DISTINCT FROM p_tenant_id;

  IF FOUND THEN
    IF v_existing.fingerprint <> p_fingerprint THEN
      RAISE EXCEPTION 'PLATFORM_OPERATION_CONFLICT' USING ERRCODE = 'P0001';
    END IF;
    RETURN v_existing.result || jsonb_build_object('replay', true);
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_operation_record_internal(
  p_operation_type text,
  p_operation_key text,
  p_tenant_id uuid,
  p_fingerprint text,
  p_result jsonb,
  p_actor_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.platform_tenant_operations(
    operation_key, operation_type, fingerprint, result, actor_user_id, tenant_id
  ) VALUES (
    p_operation_key, p_operation_type, p_fingerprint, p_result, p_actor_user_id, p_tenant_id
  );
  RETURN p_result || jsonb_build_object('replay', false);
END;
$$;

REVOKE ALL ON FUNCTION public.platform_operation_fingerprint(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.platform_operation_replay(text,text,uuid,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.platform_operation_record_internal(text,text,uuid,text,jsonb,uuid) FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. Effective lifecycle and operational access
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_tenant_effective_lifecycle_status(
  p_tenant_id uuid,
  p_at_time timestamptz DEFAULT statement_timestamp()
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_lifecycle public.tenant_lifecycle%ROWTYPE;
  v_access_end timestamptz;
BEGIN
  SELECT * INTO v_lifecycle
  FROM public.tenant_lifecycle
  WHERE tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RETURN 'provisioning';
  END IF;

  IF v_lifecycle.status = 'archived' OR v_lifecycle.archived_at IS NOT NULL THEN
    RETURN 'archived';
  END IF;

  IF v_lifecycle.subscription_started_at IS NULL
     OR v_lifecycle.subscription_expires_at IS NULL
     OR p_at_time < v_lifecycle.subscription_started_at THEN
    RETURN 'provisioning';
  END IF;

  IF v_lifecycle.status = 'suspended'
     AND v_lifecycle.suspended_at IS NOT NULL
     AND (v_lifecycle.suspended_until IS NULL OR p_at_time < v_lifecycle.suspended_until) THEN
    RETURN 'suspended';
  END IF;

  v_access_end := COALESCE(v_lifecycle.grace_expires_at, v_lifecycle.subscription_expires_at);
  IF p_at_time > v_access_end THEN
    RETURN 'expired';
  END IF;

  IF v_lifecycle.status = 'provisioning' THEN
    IF EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = p_tenant_id
        AND tu.role = 'clinic_owner'::public.app_role
        AND tu.membership_status = 'active'
    ) THEN
      RETURN 'active';
    END IF;
    RETURN 'provisioning';
  END IF;

  RETURN 'active';
END;
$$;

CREATE OR REPLACE FUNCTION public.tenant_operational_access_allowed(
  p_tenant_id uuid,
  p_user_id uuid,
  p_action_context text DEFAULT 'ordinary'
) RETURNS TABLE (
  allowed boolean,
  effective_status text,
  reason_code text,
  action_required text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_status text;
  v_lifecycle public.tenant_lifecycle%ROWTYPE;
  v_member boolean;
BEGIN
  SELECT * INTO v_lifecycle FROM public.tenant_lifecycle WHERE tenant_id = p_tenant_id;
  v_status := public.get_tenant_effective_lifecycle_status(p_tenant_id, statement_timestamp());

  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users tu
    WHERE tu.tenant_id = p_tenant_id
      AND tu.user_id = p_user_id
      AND tu.membership_status = 'active'
  ) INTO v_member;

  IF NOT v_member THEN
    RETURN QUERY SELECT false, v_status, 'no_tenant_membership', 'switch_tenant';
    RETURN;
  END IF;

  IF v_status = 'active' THEN
    RETURN QUERY SELECT true, v_status, NULL::text, NULL::text;
  ELSIF v_status = 'suspended' THEN
    RETURN QUERY SELECT false, v_status, 'tenant_suspended', 'contact_support';
  ELSIF v_status = 'expired' THEN
    RETURN QUERY SELECT false, v_status, 'subscription_expired', 'renew_subscription';
  ELSIF v_status = 'archived' THEN
    RETURN QUERY SELECT false, v_status, 'tenant_archived', 'contact_support';
  ELSIF v_lifecycle.subscription_started_at IS NOT NULL
        AND statement_timestamp() < v_lifecycle.subscription_started_at THEN
    RETURN QUERY SELECT false, v_status, 'subscription_not_started', 'wait_for_subscription';
  ELSE
    RETURN QUERY SELECT false, v_status, 'tenant_provisioning', 'complete_setup';
  END IF;
END;
$$;

-- Operational memberships only. Platform administrators are never added here implicitly.
CREATE OR REPLACE FUNCTION public.get_user_tenants()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT tu.tenant_id
  FROM public.tenant_users tu
  WHERE tu.user_id = auth.uid()
    AND tu.membership_status = 'active'
    AND public.get_tenant_effective_lifecycle_status(tu.tenant_id, statement_timestamp()) = 'active';
$$;

CREATE OR REPLACE FUNCTION public.has_tenant_role(
  target_tenant_id uuid,
  allowed_roles public.app_role[]
) RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $role$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid()
      AND tu.tenant_id = target_tenant_id
      AND tu.membership_status = 'active'
      AND tu.role = ANY(allowed_roles)
      AND public.get_tenant_effective_lifecycle_status(target_tenant_id, statement_timestamp()) = 'active'
  );
$role$;

-- Safe identity/membership reads remain available while operational access is blocked.
-- This helper never grants clinical, financial or mutation access.
CREATE OR REPLACE FUNCTION public.has_safe_tenant_membership(
  p_tenant_id uuid,
  p_user_id uuid DEFAULT auth.uid()
) RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $membership$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users tu
    WHERE tu.tenant_id = p_tenant_id
      AND tu.user_id = p_user_id
      AND tu.membership_status = 'active'
  );
$membership$;

REVOKE ALL ON FUNCTION public.has_safe_tenant_membership(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_safe_tenant_membership(uuid,uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Tenant members can read own metadata" ON public.tenants;
CREATE POLICY "Tenant members can read own metadata"
ON public.tenants FOR SELECT TO authenticated
USING (public.has_safe_tenant_membership(id, auth.uid()));

DROP POLICY IF EXISTS "Tenant members read own tenant list" ON public.tenant_users;
CREATE POLICY "Tenant members read own tenant list"
ON public.tenant_users FOR SELECT TO authenticated
USING (public.has_safe_tenant_membership(tenant_id, auth.uid()));

-- amoCRM role checks must honor tenant lifecycle too.
CREATE OR REPLACE FUNCTION public.integration_actor_role(
  p_tenant_id uuid,
  p_actor_id uuid DEFAULT auth.uid()
) RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT tu.role::text
  FROM public.tenant_users tu
  WHERE tu.tenant_id = p_tenant_id
    AND tu.user_id = p_actor_id
    AND tu.membership_status = 'active'
    AND public.get_tenant_effective_lifecycle_status(p_tenant_id, statement_timestamp()) = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_platform_admin_status()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT jsonb_build_object(
    'isPlatformSuperadmin', public.is_active_platform_superadmin(auth.uid()),
    'status', COALESCE((SELECT status FROM public.platform_administrators WHERE user_id = auth.uid()), 'none'),
    'displayName', (SELECT display_name FROM public.platform_administrators WHERE user_id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.list_my_tenant_access()
RETURNS TABLE (
  tenant_id uuid,
  tenant_name text,
  timezone text,
  role text,
  stored_status text,
  effective_status text,
  operational_access_allowed boolean,
  reason_code text,
  action_required text,
  subscription_started_at timestamptz,
  subscription_expires_at timestamptz,
  grace_expires_at timestamptz,
  suspended_until timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT
    t.id,
    t.name,
    t.timezone,
    tu.role::text,
    COALESCE(tl.status, 'provisioning'),
    access.effective_status,
    access.allowed,
    access.reason_code,
    access.action_required,
    tl.subscription_started_at,
    tl.subscription_expires_at,
    tl.grace_expires_at,
    tl.suspended_until
  FROM public.tenant_users tu
  JOIN public.tenants t ON t.id = tu.tenant_id
  LEFT JOIN public.tenant_lifecycle tl ON tl.tenant_id = t.id
  CROSS JOIN LATERAL public.tenant_operational_access_allowed(t.id, auth.uid(), 'bootstrap') access
  WHERE tu.user_id = auth.uid()
    AND tu.membership_status = 'active'
  ORDER BY access.allowed DESC, t.name ASC, t.id ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_tenant_effective_lifecycle_status(uuid,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_operational_access_allowed(uuid,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_platform_admin_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_tenant_access() TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. Existing tenant backfill and server fixture compatibility
-- -----------------------------------------------------------------------------

INSERT INTO public.tenant_lifecycle(
  tenant_id, status, subscription_started_at, subscription_expires_at, grace_expires_at,
  lifecycle_version, created_at, updated_at, metadata
)
SELECT
  t.id,
  CASE WHEN t.status = 'archived' THEN 'archived' ELSE 'active' END,
  COALESCE(t.created_at, transaction_timestamp() - interval '1 day'),
  COALESCE(s.current_period_end, transaction_timestamp() + interval '100 years'),
  COALESCE(s.current_period_end, transaction_timestamp() + interval '100 years'),
  1,
  transaction_timestamp(),
  transaction_timestamp(),
  jsonb_build_object('legacyBackfill', true)
FROM public.tenants t
LEFT JOIN LATERAL (
  SELECT current_period_end
  FROM public.subscriptions s
  WHERE s.tenant_id = t.id
  ORDER BY s.updated_at DESC NULLS LAST, s.created_at DESC
  LIMIT 1
) s ON true
ON CONFLICT (tenant_id) DO NOTHING;

INSERT INTO public.tenant_subscription_periods(
  tenant_id, starts_at, expires_at, grace_expires_at, status, reason_code, created_at, metadata
)
SELECT
  tl.tenant_id,
  tl.subscription_started_at,
  tl.subscription_expires_at,
  tl.grace_expires_at,
  CASE WHEN tl.status = 'archived' THEN 'cancelled' ELSE 'active' END,
  'legacy_backfill',
  transaction_timestamp(),
  jsonb_build_object('legacyBackfill', true)
FROM public.tenant_lifecycle tl
WHERE tl.subscription_started_at IS NOT NULL
  AND tl.subscription_expires_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.tenant_subscription_periods tsp WHERE tsp.tenant_id = tl.tenant_id
  );

CREATE OR REPLACE FUNCTION public.bootstrap_server_created_tenant_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := transaction_timestamp();
BEGIN
  IF current_setting('app.platform_controlled_tenant_create', true) = 'on' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.tenant_lifecycle(
    tenant_id, status, subscription_started_at, subscription_expires_at, grace_expires_at,
    lifecycle_version, created_at, updated_at, metadata
  ) VALUES (
    NEW.id, 'provisioning', v_now - interval '1 day', v_now + interval '100 years', v_now + interval '100 years',
    1, v_now, v_now, jsonb_build_object('serverBootstrap', true)
  ) ON CONFLICT (tenant_id) DO NOTHING;

  UPDATE public.tenants SET status = 'provisioning', updated_at = v_now WHERE id = NEW.id;

  INSERT INTO public.tenant_subscription_periods(
    tenant_id, starts_at, expires_at, grace_expires_at, status, reason_code, created_at, metadata
  ) VALUES (
    NEW.id, v_now - interval '1 day', v_now + interval '100 years', v_now + interval '100 years',
    'active', 'server_bootstrap', v_now, jsonb_build_object('serverBootstrap', true)
  ) ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tenants_server_lifecycle_bootstrap ON public.tenants;
CREATE TRIGGER tenants_server_lifecycle_bootstrap
AFTER INSERT ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.bootstrap_server_created_tenant_lifecycle();

CREATE OR REPLACE FUNCTION public.activate_provisioned_tenant_after_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $owner$
DECLARE
  v_now timestamptz := transaction_timestamp();
BEGIN
  IF NEW.membership_status = 'active' AND (
       NEW.role = 'clinic_owner'::public.app_role
       OR (
         auth.uid() IS NULL
         AND current_user = 'postgres'
         AND EXISTS (
           SELECT 1 FROM public.tenant_lifecycle fixture_lifecycle
           WHERE fixture_lifecycle.tenant_id = NEW.tenant_id
             AND fixture_lifecycle.metadata @> '{"serverBootstrap":true}'::jsonb
         )
       )
     ) THEN
    UPDATE public.tenant_lifecycle
    SET status = CASE
          WHEN v_now < subscription_started_at THEN 'provisioning'
          WHEN v_now > COALESCE(grace_expires_at, subscription_expires_at) THEN 'expired'
          ELSE 'active'
        END,
        expired_at = CASE WHEN v_now > COALESCE(grace_expires_at, subscription_expires_at) THEN v_now ELSE NULL END,
        updated_at = v_now
    WHERE tenant_id = NEW.tenant_id
      AND status = 'provisioning'
      AND archived_at IS NULL;

    UPDATE public.tenants t
    SET status = tl.status, updated_at = v_now
    FROM public.tenant_lifecycle tl
    WHERE t.id = NEW.tenant_id AND tl.tenant_id = t.id;
  END IF;
  RETURN NEW;
END;
$owner$;

DROP TRIGGER IF EXISTS tenant_users_activate_provisioned_tenant ON public.tenant_users;
CREATE TRIGGER tenant_users_activate_provisioned_tenant
AFTER INSERT OR UPDATE OF role, membership_status ON public.tenant_users
FOR EACH ROW EXECUTE FUNCTION public.activate_provisioned_tenant_after_owner();

REVOKE ALL ON FUNCTION public.bootstrap_server_created_tenant_lifecycle() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.activate_provisioned_tenant_after_owner() FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 6. Owner invariant
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_last_active_clinic_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_removing_owner boolean;
  v_lifecycle_status text;
  v_remaining bigint;
BEGIN
  IF auth.uid() IS NULL AND current_user IN ('postgres','supabase_admin') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_removing_owner := OLD.role = 'clinic_owner'::public.app_role
      AND OLD.membership_status = 'active';
  ELSE
    v_removing_owner := OLD.role = 'clinic_owner'::public.app_role
      AND OLD.membership_status = 'active'
      AND NOT (NEW.role = 'clinic_owner'::public.app_role AND NEW.membership_status = 'active');
  END IF;

  IF NOT v_removing_owner THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT status INTO v_lifecycle_status
  FROM public.tenant_lifecycle
  WHERE tenant_id = OLD.tenant_id;

  IF v_lifecycle_status = 'archived' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT count(*) INTO v_remaining
  FROM public.tenant_users tu
  WHERE tu.tenant_id = OLD.tenant_id
    AND tu.user_id <> OLD.user_id
    AND tu.role = 'clinic_owner'::public.app_role
    AND tu.membership_status = 'active';

  IF v_remaining = 0 THEN
    RAISE EXCEPTION 'LAST_CLINIC_OWNER_REQUIRED' USING ERRCODE = '23514';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS tenant_users_last_owner_guard ON public.tenant_users;
CREATE TRIGGER tenant_users_last_owner_guard
BEFORE UPDATE OF role, membership_status OR DELETE ON public.tenant_users
FOR EACH ROW EXECUTE FUNCTION public.enforce_last_active_clinic_owner();

REVOKE ALL ON FUNCTION public.enforce_last_active_clinic_owner() FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 7. Platform-safe audit helper
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_platform_tenant_event_internal(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_action text,
  p_previous_status text,
  p_new_status text,
  p_lifecycle_version bigint,
  p_reason_code text DEFAULT NULL,
  p_owner_user_id uuid DEFAULT NULL,
  p_subscription_started_at timestamptz DEFAULT NULL,
  p_subscription_expires_at timestamptz DEFAULT NULL,
  p_grace_expires_at timestamptz DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_audit_id uuid;
  v_safe_metadata jsonb;
BEGIN
  v_safe_metadata := jsonb_strip_nulls(jsonb_build_object(
    'tenantId', p_tenant_id,
    'lifecycleVersion', p_lifecycle_version,
    'previousStatus', p_previous_status,
    'newStatus', p_new_status,
    'reasonCode', p_reason_code,
    'ownerUserId', p_owner_user_id,
    'subscriptionStartedAt', p_subscription_started_at,
    'subscriptionExpiresAt', p_subscription_expires_at,
    'graceExpiresAt', p_grace_expires_at
  ) || COALESCE(p_metadata, '{}'::jsonb));

  v_audit_id := public.record_audit_event_internal(
    p_tenant_id => p_tenant_id,
    p_action => p_action,
    p_category => 'tenant',
    p_target_type => 'tenant_lifecycle',
    p_target_id => p_tenant_id::text,
    p_actor_user_id => p_actor_user_id,
    p_actor_role => 'platform_superadmin',
    p_severity => CASE WHEN p_action IN ('platform_tenant_archived','platform_tenant_suspended') THEN 'warning' ELSE 'info' END,
    p_before_data => jsonb_strip_nulls(jsonb_build_object('status', p_previous_status)),
    p_after_data => jsonb_strip_nulls(jsonb_build_object('status', p_new_status, 'lifecycleVersion', p_lifecycle_version)),
    p_redaction_level => 'standard',
    p_reason => p_reason_code,
    p_metadata => v_safe_metadata
  );

  PERFORM public.record_activity_event_internal(
    p_tenant_id => p_tenant_id,
    p_category => 'system',
    p_type => p_action,
    p_title => CASE p_action
      WHEN 'platform_tenant_created' THEN 'Клиника создана'
      WHEN 'platform_tenant_owner_assigned' THEN 'Владелец клиники назначен'
      WHEN 'platform_tenant_owner_added' THEN 'Добавлен владелец клиники'
      WHEN 'platform_tenant_owner_replaced' THEN 'Владелец клиники заменён'
      WHEN 'platform_tenant_subscription_set' THEN 'Подписка клиники установлена'
      WHEN 'platform_tenant_subscription_extended' THEN 'Подписка клиники продлена'
      WHEN 'platform_tenant_subscription_shortened' THEN 'Срок подписки клиники сокращён'
      WHEN 'platform_tenant_suspended' THEN 'Работа клиники приостановлена'
      WHEN 'platform_tenant_resumed' THEN 'Работа клиники возобновлена'
      WHEN 'platform_tenant_expired' THEN 'Подписка клиники истекла'
      WHEN 'platform_tenant_archived' THEN 'Клиника архивирована'
      ELSE 'Изменено состояние клиники'
    END,
    p_source_type => 'tenant_lifecycle',
    p_source_id => p_tenant_id::text,
    p_audit_event_id => v_audit_id,
    p_actor_user_id => p_actor_user_id,
    p_source_status => p_new_status,
    p_visibility => 'system',
    p_severity => CASE WHEN p_action IN ('platform_tenant_archived','platform_tenant_suspended') THEN 'warning' ELSE 'info' END,
    p_metadata => v_safe_metadata
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_platform_tenant_event_internal(uuid,uuid,text,text,text,bigint,text,uuid,timestamptz,timestamptz,timestamptz,jsonb)
  FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 8. Platform read contracts (safe metadata only)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_platform_tenants(
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
) RETURNS TABLE (
  tenant_id uuid,
  tenant_name text,
  timezone text,
  stored_status text,
  effective_status text,
  owner_count bigint,
  subscription_started_at timestamptz,
  subscription_expires_at timestamptz,
  grace_expires_at timestamptz,
  suspended_until timestamptz,
  lifecycle_version bigint,
  last_lifecycle_update timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
BEGIN
  PERFORM public.require_active_platform_superadmin();
  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.timezone,
    tl.status,
    public.get_tenant_effective_lifecycle_status(t.id, statement_timestamp()),
    count(tu.user_id) FILTER (
      WHERE tu.role = 'clinic_owner'::public.app_role AND tu.membership_status = 'active'
    ),
    tl.subscription_started_at,
    tl.subscription_expires_at,
    tl.grace_expires_at,
    tl.suspended_until,
    tl.lifecycle_version,
    tl.updated_at
  FROM public.tenants t
  JOIN public.tenant_lifecycle tl ON tl.tenant_id = t.id
  LEFT JOIN public.tenant_users tu ON tu.tenant_id = t.id
  WHERE (p_search IS NULL OR btrim(p_search) = '' OR t.name ILIKE '%' || btrim(p_search) || '%')
    AND (p_status IS NULL OR btrim(p_status) = ''
      OR public.get_tenant_effective_lifecycle_status(t.id, statement_timestamp()) = p_status
      OR tl.status = p_status)
  GROUP BY t.id, t.name, t.timezone, tl.status, tl.subscription_started_at,
    tl.subscription_expires_at, tl.grace_expires_at, tl.suspended_until,
    tl.lifecycle_version, tl.updated_at
  ORDER BY t.name ASC, t.id ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_platform_tenant_details(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_result jsonb;
BEGIN
  PERFORM public.require_active_platform_superadmin();

  SELECT jsonb_build_object(
    'tenant', jsonb_build_object(
      'tenantId', t.id,
      'tenantName', t.name,
      'timezone', t.timezone,
      'storedStatus', tl.status,
      'effectiveStatus', public.get_tenant_effective_lifecycle_status(t.id, statement_timestamp()),
      'subscriptionStartedAt', tl.subscription_started_at,
      'subscriptionExpiresAt', tl.subscription_expires_at,
      'graceExpiresAt', tl.grace_expires_at,
      'suspendedAt', tl.suspended_at,
      'suspendedUntil', tl.suspended_until,
      'suspensionReasonCode', tl.suspension_reason_code,
      'resumedAt', tl.resumed_at,
      'expiredAt', tl.expired_at,
      'archivedAt', tl.archived_at,
      'lifecycleVersion', tl.lifecycle_version,
      'updatedAt', tl.updated_at
    ),
    'owners', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'userId', tu.user_id,
        'displayName', NULLIF(btrim(concat_ws(' ', p.first_name, p.last_name)), ''),
        'membershipStatus', tu.membership_status,
        'createdAt', tu.created_at
      ) ORDER BY tu.created_at, tu.user_id)
      FROM public.tenant_users tu
      LEFT JOIN public.profiles p ON p.id = tu.user_id
      WHERE tu.tenant_id = t.id AND tu.role = 'clinic_owner'::public.app_role
    ), '[]'::jsonb),
    'subscriptionHistory', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', tsp.id,
        'startsAt', tsp.starts_at,
        'expiresAt', tsp.expires_at,
        'graceExpiresAt', tsp.grace_expires_at,
        'status', tsp.status,
        'reasonCode', tsp.reason_code,
        'previousPeriodId', tsp.previous_period_id,
        'createdBy', tsp.created_by,
        'createdAt', tsp.created_at,
        'supersededAt', tsp.superseded_at
      ) ORDER BY tsp.created_at DESC, tsp.id DESC)
      FROM public.tenant_subscription_periods tsp
      WHERE tsp.tenant_id = t.id
    ), '[]'::jsonb),
    'lifecycleHistory', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', ae.id,
        'action', ae.action,
        'actorUserId', ae.actor_user_id,
        'reasonCode', ae.reason,
        'metadata', ae.metadata,
        'createdAt', ae.created_at
      ) ORDER BY ae.created_at DESC, ae.id DESC)
      FROM (
        SELECT * FROM public.audit_events
        WHERE tenant_id = t.id AND action LIKE 'platform_tenant_%'
        ORDER BY created_at DESC
        LIMIT 100
      ) ae
    ), '[]'::jsonb)
  ) INTO v_result
  FROM public.tenants t
  JOIN public.tenant_lifecycle tl ON tl.tenant_id = t.id
  WHERE t.id = p_tenant_id;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'PLATFORM_TENANT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_tenant_lifecycle_summary(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.tenant_users tu
    WHERE tu.tenant_id = p_tenant_id
      AND tu.user_id = v_actor
      AND tu.membership_status = 'active'
      AND tu.role IN ('clinic_owner'::public.app_role, 'clinic_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'TENANT_LIFECYCLE_READ_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'tenantId', t.id,
    'tenantName', t.name,
    'storedStatus', tl.status,
    'effectiveStatus', public.get_tenant_effective_lifecycle_status(t.id, statement_timestamp()),
    'subscriptionStartedAt', tl.subscription_started_at,
    'subscriptionExpiresAt', tl.subscription_expires_at,
    'graceExpiresAt', tl.grace_expires_at,
    'suspendedUntil', tl.suspended_until,
    'lifecycleVersion', tl.lifecycle_version
  ) INTO v_result
  FROM public.tenants t JOIN public.tenant_lifecycle tl ON tl.tenant_id = t.id
  WHERE t.id = p_tenant_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_platform_tenants(text,text,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_platform_tenant_details(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_lifecycle_summary(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 9. Shared subscription replacement
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.replace_tenant_subscription_internal(
  p_tenant_id uuid,
  p_starts_at timestamptz,
  p_expires_at timestamptz,
  p_grace_expires_at timestamptz,
  p_reason_code text,
  p_actor_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lifecycle public.tenant_lifecycle%ROWTYPE;
  v_current public.tenant_subscription_periods%ROWTYPE;
  v_new_id uuid;
  v_now timestamptz := transaction_timestamp();
  v_new_status text;
  v_effective_status text;
BEGIN
  IF p_starts_at IS NULL OR p_expires_at IS NULL OR p_expires_at <= p_starts_at
     OR (p_grace_expires_at IS NOT NULL AND p_grace_expires_at < p_expires_at) THEN
    RAISE EXCEPTION 'INVALID_SUBSCRIPTION_DATES' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_lifecycle FROM public.tenant_lifecycle
  WHERE tenant_id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PLATFORM_TENANT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_lifecycle.status = 'archived' THEN
    RAISE EXCEPTION 'TENANT_ALREADY_ARCHIVED' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_current
  FROM public.tenant_subscription_periods
  WHERE tenant_id = p_tenant_id AND superseded_at IS NULL
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.tenant_subscription_periods
    SET status = 'superseded', superseded_at = v_now
    WHERE id = v_current.id;
  END IF;

  v_new_status := CASE
    WHEN v_now < p_starts_at THEN 'scheduled'
    WHEN v_now > COALESCE(p_grace_expires_at, p_expires_at) THEN 'expired'
    ELSE 'active'
  END;

  INSERT INTO public.tenant_subscription_periods(
    tenant_id, starts_at, expires_at, grace_expires_at, status, reason_code,
    previous_period_id, created_by, created_at, metadata
  ) VALUES (
    p_tenant_id, p_starts_at, p_expires_at, p_grace_expires_at, v_new_status,
    p_reason_code, v_current.id, p_actor_user_id, v_now, '{}'::jsonb
  ) RETURNING id INTO v_new_id;

  v_effective_status := CASE
    WHEN v_lifecycle.status = 'suspended'
      AND (v_lifecycle.suspended_until IS NULL OR v_lifecycle.suspended_until > v_now)
      THEN 'suspended'
    WHEN v_now < p_starts_at THEN 'provisioning'
    WHEN v_now > COALESCE(p_grace_expires_at, p_expires_at) THEN 'expired'
    ELSE 'active'
  END;

  UPDATE public.tenant_lifecycle
  SET subscription_started_at = p_starts_at,
      subscription_expires_at = p_expires_at,
      grace_expires_at = p_grace_expires_at,
      status = v_effective_status,
      expired_at = CASE WHEN v_effective_status = 'expired' THEN v_now ELSE NULL END,
      lifecycle_version = lifecycle_version + 1,
      updated_by = p_actor_user_id,
      updated_at = v_now
  WHERE tenant_id = p_tenant_id
  RETURNING * INTO v_lifecycle;

  UPDATE public.tenants
  SET status = v_effective_status, updated_at = v_now
  WHERE id = p_tenant_id;

  RETURN jsonb_build_object(
    'tenantId', p_tenant_id,
    'subscriptionPeriodId', v_new_id,
    'status', v_lifecycle.status,
    'effectiveStatus', public.get_tenant_effective_lifecycle_status(p_tenant_id, v_now),
    'lifecycleVersion', v_lifecycle.lifecycle_version,
    'subscriptionStartedAt', p_starts_at,
    'subscriptionExpiresAt', p_expires_at,
    'graceExpiresAt', p_grace_expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.replace_tenant_subscription_internal(uuid,timestamptz,timestamptz,timestamptz,text,uuid)
  FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 10. Controlled tenant creation and owner operations
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_platform_tenant(
  p_name text,
  p_owner_user_id uuid,
  p_subscription_started_at timestamptz,
  p_subscription_expires_at timestamptz,
  p_grace_expires_at timestamptz,
  p_operation_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := public.require_active_platform_superadmin();
  v_name text := regexp_replace(btrim(COALESCE(p_name, '')), '\s+', ' ', 'g');
  v_identity text;
  v_payload jsonb;
  v_fingerprint text;
  v_replay jsonb;
  v_tenant_id uuid;
  v_period_id uuid;
  v_status text;
  v_now timestamptz := transaction_timestamp();
  v_result jsonb;
BEGIN
  IF length(v_name) NOT BETWEEN 2 AND 160 THEN
    RAISE EXCEPTION 'INVALID_TENANT_NAME' USING ERRCODE = '22023';
  END IF;
  IF p_owner_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_owner_user_id) THEN
    RAISE EXCEPTION 'OWNER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF p_subscription_started_at IS NULL OR p_subscription_expires_at IS NULL
     OR p_subscription_expires_at <= p_subscription_started_at
     OR (p_grace_expires_at IS NOT NULL AND p_grace_expires_at < p_subscription_expires_at) THEN
    RAISE EXCEPTION 'INVALID_SUBSCRIPTION_DATES' USING ERRCODE = '22023';
  END IF;

  v_identity := lower(v_name);
  v_payload := jsonb_build_object(
    'name', v_identity,
    'ownerUserId', p_owner_user_id,
    'subscriptionStartedAt', p_subscription_started_at,
    'subscriptionExpiresAt', p_subscription_expires_at,
    'graceExpiresAt', p_grace_expires_at
  );
  v_fingerprint := public.platform_operation_fingerprint(v_payload);
  v_replay := public.platform_operation_replay('tenant_create', p_operation_key, NULL, v_fingerprint, v_actor);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('tenant-identity|' || v_identity, 0));
  IF EXISTS (SELECT 1 FROM public.tenants WHERE lower(regexp_replace(btrim(name), '\s+', ' ', 'g')) = v_identity) THEN
    RAISE EXCEPTION 'TENANT_IDENTITY_CONFLICT' USING ERRCODE = '23505';
  END IF;

  PERFORM set_config('app.platform_controlled_tenant_create', 'on', true);
  INSERT INTO public.tenants(name, status, created_at, updated_at)
  VALUES (v_name, 'provisioning', v_now, v_now)
  RETURNING id INTO v_tenant_id;

  v_status := CASE
    WHEN v_now < p_subscription_started_at THEN 'provisioning'
    WHEN v_now > COALESCE(p_grace_expires_at, p_subscription_expires_at) THEN 'expired'
    ELSE 'active'
  END;

  INSERT INTO public.tenant_lifecycle(
    tenant_id, status, subscription_started_at, subscription_expires_at, grace_expires_at,
    expired_at, lifecycle_version, created_by, updated_by, created_at, updated_at, metadata
  ) VALUES (
    v_tenant_id, v_status, p_subscription_started_at, p_subscription_expires_at, p_grace_expires_at,
    CASE WHEN v_status = 'expired' THEN v_now ELSE NULL END,
    1, v_actor, v_actor, v_now, v_now, '{}'::jsonb
  );

  INSERT INTO public.tenant_subscription_periods(
    tenant_id, starts_at, expires_at, grace_expires_at, status, reason_code,
    created_by, created_at, metadata
  ) VALUES (
    v_tenant_id, p_subscription_started_at, p_subscription_expires_at, p_grace_expires_at,
    CASE WHEN v_status = 'provisioning' THEN 'scheduled' WHEN v_status = 'expired' THEN 'expired' ELSE 'active' END,
    'tenant_create', v_actor, v_now, '{}'::jsonb
  ) RETURNING id INTO v_period_id;

  INSERT INTO public.tenant_users(
    tenant_id, user_id, role, membership_status, created_at, updated_at
  ) VALUES (
    v_tenant_id, p_owner_user_id, 'clinic_owner'::public.app_role, 'active', v_now, v_now
  );

  IF (SELECT count(*) FROM public.tenant_users
      WHERE tenant_id = v_tenant_id AND role = 'clinic_owner'::public.app_role AND membership_status = 'active') <> 1 THEN
    RAISE EXCEPTION 'INITIAL_OWNER_INVARIANT_FAILED' USING ERRCODE = '23514';
  END IF;

  UPDATE public.tenants SET status = v_status, updated_at = v_now WHERE id = v_tenant_id;

  v_result := jsonb_build_object(
    'tenantId', v_tenant_id,
    'tenantName', v_name,
    'ownerUserId', p_owner_user_id,
    'subscriptionPeriodId', v_period_id,
    'status', v_status,
    'effectiveStatus', public.get_tenant_effective_lifecycle_status(v_tenant_id, v_now),
    'lifecycleVersion', 1
  );

  PERFORM public.record_platform_tenant_event_internal(
    v_tenant_id, v_actor, 'platform_tenant_created', NULL, v_status, 1,
    'tenant_create', p_owner_user_id, p_subscription_started_at,
    p_subscription_expires_at, p_grace_expires_at,
    jsonb_build_object('initialOwnerAssigned', true)
  );

  RETURN public.platform_operation_record_internal(
    'tenant_create', p_operation_key, NULL, v_fingerprint, v_result, v_actor
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.add_platform_tenant_owner(
  p_tenant_id uuid,
  p_owner_user_id uuid,
  p_operation_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := public.require_active_platform_superadmin();
  v_payload jsonb := jsonb_build_object('tenantId', p_tenant_id, 'ownerUserId', p_owner_user_id);
  v_fingerprint text := public.platform_operation_fingerprint(v_payload);
  v_replay jsonb;
  v_lifecycle public.tenant_lifecycle%ROWTYPE;
  v_result jsonb;
BEGIN
  v_replay := public.platform_operation_replay('owner_add', p_operation_key, p_tenant_id, v_fingerprint, v_actor);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;

  SELECT * INTO v_lifecycle FROM public.tenant_lifecycle WHERE tenant_id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PLATFORM_TENANT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF p_owner_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_owner_user_id) THEN
    RAISE EXCEPTION 'OWNER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.tenant_users(tenant_id,user_id,role,membership_status,created_at,updated_at)
  VALUES (p_tenant_id,p_owner_user_id,'clinic_owner'::public.app_role,'active',transaction_timestamp(),transaction_timestamp())
  ON CONFLICT (tenant_id,user_id) DO UPDATE
    SET role = 'clinic_owner'::public.app_role,
        membership_status = 'active',
        disabled_at = NULL,
        updated_at = transaction_timestamp();

  v_result := jsonb_build_object(
    'tenantId', p_tenant_id,
    'ownerUserId', p_owner_user_id,
    'ownerCount', (SELECT count(*) FROM public.tenant_users
      WHERE tenant_id = p_tenant_id AND role = 'clinic_owner'::public.app_role AND membership_status = 'active'),
    'lifecycleVersion', v_lifecycle.lifecycle_version
  );

  PERFORM public.record_platform_tenant_event_internal(
    p_tenant_id,v_actor,'platform_tenant_owner_added',v_lifecycle.status,v_lifecycle.status,
    v_lifecycle.lifecycle_version,'owner_recovery',p_owner_user_id,NULL,NULL,NULL,'{}'::jsonb
  );
  RETURN public.platform_operation_record_internal('owner_add',p_operation_key,p_tenant_id,v_fingerprint,v_result,v_actor);
END;
$$;

CREATE OR REPLACE FUNCTION public.replace_platform_tenant_owner(
  p_tenant_id uuid,
  p_current_owner_user_id uuid,
  p_new_owner_user_id uuid,
  p_confirmation boolean,
  p_operation_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := public.require_active_platform_superadmin();
  v_payload jsonb := jsonb_build_object(
    'tenantId',p_tenant_id,'currentOwnerUserId',p_current_owner_user_id,
    'newOwnerUserId',p_new_owner_user_id,'confirmation',p_confirmation
  );
  v_fingerprint text := public.platform_operation_fingerprint(v_payload);
  v_replay jsonb;
  v_lifecycle public.tenant_lifecycle%ROWTYPE;
  v_result jsonb;
BEGIN
  v_replay := public.platform_operation_replay('owner_replace',p_operation_key,p_tenant_id,v_fingerprint,v_actor);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  IF p_confirmation IS DISTINCT FROM true THEN RAISE EXCEPTION 'OWNER_REPLACE_CONFIRMATION_REQUIRED' USING ERRCODE='22023'; END IF;
  IF p_current_owner_user_id = p_new_owner_user_id THEN RAISE EXCEPTION 'OWNER_REPLACE_SAME_USER' USING ERRCODE='22023'; END IF;

  SELECT * INTO v_lifecycle FROM public.tenant_lifecycle WHERE tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PLATFORM_TENANT_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=p_new_owner_user_id) THEN RAISE EXCEPTION 'OWNER_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tenant_users WHERE tenant_id=p_tenant_id AND user_id=p_current_owner_user_id AND role='clinic_owner'::public.app_role AND membership_status='active') THEN
    RAISE EXCEPTION 'CURRENT_OWNER_NOT_FOUND' USING ERRCODE='P0002';
  END IF;

  INSERT INTO public.tenant_users(tenant_id,user_id,role,membership_status,created_at,updated_at)
  VALUES (p_tenant_id,p_new_owner_user_id,'clinic_owner'::public.app_role,'active',transaction_timestamp(),transaction_timestamp())
  ON CONFLICT (tenant_id,user_id) DO UPDATE
    SET role='clinic_owner'::public.app_role,membership_status='active',disabled_at=NULL,updated_at=transaction_timestamp();

  UPDATE public.tenant_users
  SET membership_status='disabled',disabled_at=transaction_timestamp(),updated_at=transaction_timestamp()
  WHERE tenant_id=p_tenant_id AND user_id=p_current_owner_user_id;

  v_result := jsonb_build_object(
    'tenantId',p_tenant_id,'previousOwnerUserId',p_current_owner_user_id,'ownerUserId',p_new_owner_user_id,
    'ownerCount',(SELECT count(*) FROM public.tenant_users WHERE tenant_id=p_tenant_id AND role='clinic_owner'::public.app_role AND membership_status='active'),
    'lifecycleVersion',v_lifecycle.lifecycle_version
  );
  PERFORM public.record_platform_tenant_event_internal(
    p_tenant_id,v_actor,'platform_tenant_owner_replaced',v_lifecycle.status,v_lifecycle.status,
    v_lifecycle.lifecycle_version,'owner_replace',p_new_owner_user_id,NULL,NULL,NULL,
    jsonb_build_object('previousOwnerUserId',p_current_owner_user_id)
  );
  RETURN public.platform_operation_record_internal('owner_replace',p_operation_key,p_tenant_id,v_fingerprint,v_result,v_actor);
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_platform_tenant_owner(
  p_tenant_id uuid,
  p_owner_user_id uuid,
  p_operation_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := public.require_active_platform_superadmin();
  v_payload jsonb := jsonb_build_object('tenantId',p_tenant_id,'ownerUserId',p_owner_user_id);
  v_fingerprint text := public.platform_operation_fingerprint(v_payload);
  v_replay jsonb;
  v_lifecycle public.tenant_lifecycle%ROWTYPE;
  v_result jsonb;
BEGIN
  v_replay := public.platform_operation_replay('owner_remove',p_operation_key,p_tenant_id,v_fingerprint,v_actor);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  SELECT * INTO v_lifecycle FROM public.tenant_lifecycle WHERE tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PLATFORM_TENANT_NOT_FOUND' USING ERRCODE='P0002'; END IF;

  UPDATE public.tenant_users
  SET membership_status='disabled',disabled_at=transaction_timestamp(),updated_at=transaction_timestamp()
  WHERE tenant_id=p_tenant_id AND user_id=p_owner_user_id
    AND role='clinic_owner'::public.app_role AND membership_status='active';
  IF NOT FOUND THEN RAISE EXCEPTION 'OWNER_NOT_FOUND' USING ERRCODE='P0002'; END IF;

  v_result := jsonb_build_object(
    'tenantId',p_tenant_id,'removedOwnerUserId',p_owner_user_id,
    'ownerCount',(SELECT count(*) FROM public.tenant_users WHERE tenant_id=p_tenant_id AND role='clinic_owner'::public.app_role AND membership_status='active')
  );
  RETURN public.platform_operation_record_internal('owner_remove',p_operation_key,p_tenant_id,v_fingerprint,v_result,v_actor);
END;
$$;

-- -----------------------------------------------------------------------------
-- 11. Subscription operations
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_tenant_subscription(
  p_tenant_id uuid,
  p_starts_at timestamptz,
  p_expires_at timestamptz,
  p_grace_expires_at timestamptz,
  p_reason_code text,
  p_operation_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := public.require_active_platform_superadmin();
  v_payload jsonb := jsonb_build_object('tenantId',p_tenant_id,'startsAt',p_starts_at,'expiresAt',p_expires_at,'graceExpiresAt',p_grace_expires_at,'reasonCode',p_reason_code);
  v_fingerprint text := public.platform_operation_fingerprint(v_payload);
  v_replay jsonb;
  v_before public.tenant_lifecycle%ROWTYPE;
  v_result jsonb;
BEGIN
  v_replay := public.platform_operation_replay('subscription_set',p_operation_key,p_tenant_id,v_fingerprint,v_actor);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  SELECT * INTO v_before FROM public.tenant_lifecycle WHERE tenant_id=p_tenant_id;
  v_result := public.replace_tenant_subscription_internal(p_tenant_id,p_starts_at,p_expires_at,p_grace_expires_at,COALESCE(NULLIF(btrim(p_reason_code),''),'subscription_set'),v_actor);
  PERFORM public.record_platform_tenant_event_internal(
    p_tenant_id,v_actor,'platform_tenant_subscription_set',v_before.status,v_result->>'status',(v_result->>'lifecycleVersion')::bigint,
    p_reason_code,NULL,p_starts_at,p_expires_at,p_grace_expires_at,'{}'::jsonb
  );
  RETURN public.platform_operation_record_internal('subscription_set',p_operation_key,p_tenant_id,v_fingerprint,v_result,v_actor);
END;
$$;

CREATE OR REPLACE FUNCTION public.extend_tenant_subscription(
  p_tenant_id uuid,
  p_new_expires_at timestamptz,
  p_new_grace_expires_at timestamptz,
  p_reason_code text,
  p_operation_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := public.require_active_platform_superadmin();
  v_payload jsonb := jsonb_build_object('tenantId',p_tenant_id,'newExpiresAt',p_new_expires_at,'newGraceExpiresAt',p_new_grace_expires_at,'reasonCode',p_reason_code);
  v_fingerprint text := public.platform_operation_fingerprint(v_payload);
  v_replay jsonb;
  v_current public.tenant_subscription_periods%ROWTYPE;
  v_before public.tenant_lifecycle%ROWTYPE;
  v_result jsonb;
BEGIN
  v_replay := public.platform_operation_replay('subscription_extend',p_operation_key,p_tenant_id,v_fingerprint,v_actor);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  SELECT * INTO v_before FROM public.tenant_lifecycle WHERE tenant_id=p_tenant_id;
  SELECT * INTO v_current FROM public.tenant_subscription_periods WHERE tenant_id=p_tenant_id AND superseded_at IS NULL FOR UPDATE;
  IF NOT FOUND OR p_new_expires_at <= v_current.expires_at THEN RAISE EXCEPTION 'SUBSCRIPTION_EXTENSION_REQUIRED' USING ERRCODE='22023'; END IF;
  v_result := public.replace_tenant_subscription_internal(
    p_tenant_id,v_current.starts_at,p_new_expires_at,p_new_grace_expires_at,COALESCE(NULLIF(btrim(p_reason_code),''),'subscription_extend'),v_actor
  );
  PERFORM public.record_platform_tenant_event_internal(
    p_tenant_id,v_actor,'platform_tenant_subscription_extended',v_before.status,v_result->>'status',(v_result->>'lifecycleVersion')::bigint,
    p_reason_code,NULL,v_current.starts_at,p_new_expires_at,p_new_grace_expires_at,
    jsonb_build_object('previousExpiresAt',v_current.expires_at)
  );
  RETURN public.platform_operation_record_internal('subscription_extend',p_operation_key,p_tenant_id,v_fingerprint,v_result,v_actor);
END;
$$;

CREATE OR REPLACE FUNCTION public.shorten_tenant_subscription(
  p_tenant_id uuid,
  p_new_expires_at timestamptz,
  p_new_grace_expires_at timestamptz,
  p_reason_code text,
  p_confirmation boolean,
  p_immediate_expiration boolean,
  p_operation_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := public.require_active_platform_superadmin();
  v_payload jsonb := jsonb_build_object('tenantId',p_tenant_id,'newExpiresAt',p_new_expires_at,'newGraceExpiresAt',p_new_grace_expires_at,'reasonCode',p_reason_code,'confirmation',p_confirmation,'immediateExpiration',p_immediate_expiration);
  v_fingerprint text := public.platform_operation_fingerprint(v_payload);
  v_replay jsonb;
  v_current public.tenant_subscription_periods%ROWTYPE;
  v_before public.tenant_lifecycle%ROWTYPE;
  v_result jsonb;
BEGIN
  v_replay := public.platform_operation_replay('subscription_shorten',p_operation_key,p_tenant_id,v_fingerprint,v_actor);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  IF p_confirmation IS DISTINCT FROM true OR p_reason_code IS NULL OR length(btrim(p_reason_code))=0 THEN
    RAISE EXCEPTION 'SUBSCRIPTION_SHORTEN_CONFIRMATION_REQUIRED' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_before FROM public.tenant_lifecycle WHERE tenant_id=p_tenant_id;
  SELECT * INTO v_current FROM public.tenant_subscription_periods WHERE tenant_id=p_tenant_id AND superseded_at IS NULL FOR UPDATE;
  IF NOT FOUND OR p_new_expires_at >= v_current.expires_at THEN RAISE EXCEPTION 'SUBSCRIPTION_SHORTENING_REQUIRED' USING ERRCODE='22023'; END IF;
  IF p_new_expires_at < transaction_timestamp() AND p_immediate_expiration IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'IMMEDIATE_EXPIRATION_CONFIRMATION_REQUIRED' USING ERRCODE='22023';
  END IF;
  v_result := public.replace_tenant_subscription_internal(
    p_tenant_id,v_current.starts_at,p_new_expires_at,p_new_grace_expires_at,p_reason_code,v_actor
  );
  PERFORM public.record_platform_tenant_event_internal(
    p_tenant_id,v_actor,'platform_tenant_subscription_shortened',v_before.status,v_result->>'status',(v_result->>'lifecycleVersion')::bigint,
    p_reason_code,NULL,v_current.starts_at,p_new_expires_at,p_new_grace_expires_at,
    jsonb_build_object('previousExpiresAt',v_current.expires_at,'warning','subscription_shortened')
  );
  RETURN public.platform_operation_record_internal('subscription_shorten',p_operation_key,p_tenant_id,v_fingerprint,v_result,v_actor);
END;
$$;

-- -----------------------------------------------------------------------------
-- 12. Suspension, resumption, archival
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.suspend_tenant(
  p_tenant_id uuid,
  p_reason_code text,
  p_suspension_note text,
  p_suspended_until timestamptz,
  p_operation_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := public.require_active_platform_superadmin();
  v_payload jsonb := jsonb_build_object('tenantId',p_tenant_id,'reasonCode',p_reason_code,'suspensionNote',p_suspension_note,'suspendedUntil',p_suspended_until);
  v_fingerprint text := public.platform_operation_fingerprint(v_payload);
  v_replay jsonb;
  v_lifecycle public.tenant_lifecycle%ROWTYPE;
  v_previous text;
  v_result jsonb;
  v_now timestamptz := transaction_timestamp();
BEGIN
  v_replay := public.platform_operation_replay('tenant_suspend',p_operation_key,p_tenant_id,v_fingerprint,v_actor);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  IF p_reason_code NOT IN ('subscription_nonpayment','contract_pause','compliance_review','customer_request','security_incident','administrative','other') THEN
    RAISE EXCEPTION 'INVALID_SUSPENSION_REASON' USING ERRCODE='22023';
  END IF;
  IF length(COALESCE(p_suspension_note,'')) > 500 THEN RAISE EXCEPTION 'SUSPENSION_NOTE_TOO_LONG' USING ERRCODE='22023'; END IF;
  IF p_suspended_until IS NOT NULL AND p_suspended_until <= v_now THEN RAISE EXCEPTION 'INVALID_SUSPENSION_END' USING ERRCODE='22023'; END IF;

  SELECT * INTO v_lifecycle FROM public.tenant_lifecycle WHERE tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PLATFORM_TENANT_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF v_lifecycle.status='archived' THEN RAISE EXCEPTION 'TENANT_ALREADY_ARCHIVED' USING ERRCODE='P0001'; END IF;
  v_previous := v_lifecycle.status;

  UPDATE public.tenant_lifecycle
  SET status='suspended',suspended_at=v_now,suspended_until=p_suspended_until,
      suspension_reason_code=p_reason_code,suspension_note=NULLIF(btrim(p_suspension_note),''),
      resumed_at=NULL,lifecycle_version=lifecycle_version+1,updated_by=v_actor,updated_at=v_now
  WHERE tenant_id=p_tenant_id RETURNING * INTO v_lifecycle;
  UPDATE public.tenants SET status='suspended',updated_at=v_now WHERE id=p_tenant_id;

  v_result := jsonb_build_object('tenantId',p_tenant_id,'status','suspended','effectiveStatus','suspended','lifecycleVersion',v_lifecycle.lifecycle_version,'suspendedUntil',p_suspended_until);
  PERFORM public.record_platform_tenant_event_internal(
    p_tenant_id,v_actor,'platform_tenant_suspended',v_previous,'suspended',v_lifecycle.lifecycle_version,
    p_reason_code,NULL,NULL,NULL,NULL,jsonb_build_object('suspendedUntil',p_suspended_until)
  );
  RETURN public.platform_operation_record_internal('tenant_suspend',p_operation_key,p_tenant_id,v_fingerprint,v_result,v_actor);
END;
$$;

CREATE OR REPLACE FUNCTION public.resume_tenant(
  p_tenant_id uuid,
  p_reason_code text,
  p_operation_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := public.require_active_platform_superadmin();
  v_payload jsonb := jsonb_build_object('tenantId',p_tenant_id,'reasonCode',p_reason_code);
  v_fingerprint text := public.platform_operation_fingerprint(v_payload);
  v_replay jsonb;
  v_lifecycle public.tenant_lifecycle%ROWTYPE;
  v_previous text;
  v_now timestamptz := transaction_timestamp();
  v_result jsonb;
BEGIN
  v_replay := public.platform_operation_replay('tenant_resume',p_operation_key,p_tenant_id,v_fingerprint,v_actor);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  SELECT * INTO v_lifecycle FROM public.tenant_lifecycle WHERE tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PLATFORM_TENANT_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF v_lifecycle.status='archived' THEN RAISE EXCEPTION 'TENANT_ALREADY_ARCHIVED' USING ERRCODE='P0001'; END IF;
  IF v_lifecycle.subscription_started_at IS NULL OR v_now < v_lifecycle.subscription_started_at
     OR v_now > COALESCE(v_lifecycle.grace_expires_at,v_lifecycle.subscription_expires_at) THEN
    RAISE EXCEPTION 'RESUME_REQUIRES_VALID_SUBSCRIPTION' USING ERRCODE='P0001';
  END IF;
  v_previous := v_lifecycle.status;

  UPDATE public.tenant_lifecycle
  SET status='active',suspended_at=NULL,suspended_until=NULL,suspension_reason_code=NULL,suspension_note=NULL,
      resumed_at=v_now,expired_at=NULL,lifecycle_version=lifecycle_version+1,updated_by=v_actor,updated_at=v_now
  WHERE tenant_id=p_tenant_id RETURNING * INTO v_lifecycle;
  UPDATE public.tenants SET status='active',updated_at=v_now WHERE id=p_tenant_id;

  v_result := jsonb_build_object('tenantId',p_tenant_id,'status','active','effectiveStatus','active','lifecycleVersion',v_lifecycle.lifecycle_version);
  PERFORM public.record_platform_tenant_event_internal(
    p_tenant_id,v_actor,'platform_tenant_resumed',v_previous,'active',v_lifecycle.lifecycle_version,
    COALESCE(NULLIF(btrim(p_reason_code),''),'resume'),NULL,NULL,NULL,NULL,'{}'::jsonb
  );
  RETURN public.platform_operation_record_internal('tenant_resume',p_operation_key,p_tenant_id,v_fingerprint,v_result,v_actor);
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_tenant(
  p_tenant_id uuid,
  p_reason_code text,
  p_confirmation boolean,
  p_operation_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := public.require_active_platform_superadmin();
  v_payload jsonb := jsonb_build_object('tenantId',p_tenant_id,'reasonCode',p_reason_code,'confirmation',p_confirmation);
  v_fingerprint text := public.platform_operation_fingerprint(v_payload);
  v_replay jsonb;
  v_lifecycle public.tenant_lifecycle%ROWTYPE;
  v_previous text;
  v_now timestamptz := transaction_timestamp();
  v_result jsonb;
BEGIN
  v_replay := public.platform_operation_replay('tenant_archive',p_operation_key,p_tenant_id,v_fingerprint,v_actor);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  IF p_confirmation IS DISTINCT FROM true OR p_reason_code IS NULL OR length(btrim(p_reason_code))=0 THEN
    RAISE EXCEPTION 'TENANT_ARCHIVE_CONFIRMATION_REQUIRED' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_lifecycle FROM public.tenant_lifecycle WHERE tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PLATFORM_TENANT_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF v_lifecycle.status='archived' THEN RAISE EXCEPTION 'TENANT_ALREADY_ARCHIVED' USING ERRCODE='P0001'; END IF;
  v_previous := v_lifecycle.status;

  UPDATE public.tenant_lifecycle
  SET status='archived',archived_at=v_now,lifecycle_version=lifecycle_version+1,updated_by=v_actor,updated_at=v_now
  WHERE tenant_id=p_tenant_id RETURNING * INTO v_lifecycle;
  UPDATE public.tenants SET status='archived',updated_at=v_now WHERE id=p_tenant_id;
  UPDATE public.integration_oauth_states
  SET cancelled_at=COALESCE(cancelled_at,v_now),failure_code=COALESCE(failure_code,'tenant_archived')
  WHERE tenant_id=p_tenant_id AND consumed_at IS NULL AND cancelled_at IS NULL;

  v_result := jsonb_build_object('tenantId',p_tenant_id,'status','archived','effectiveStatus','archived','lifecycleVersion',v_lifecycle.lifecycle_version,'archivedAt',v_now);
  PERFORM public.record_platform_tenant_event_internal(
    p_tenant_id,v_actor,'platform_tenant_archived',v_previous,'archived',v_lifecycle.lifecycle_version,
    p_reason_code,NULL,NULL,NULL,NULL,'{}'::jsonb
  );
  RETURN public.platform_operation_record_internal('tenant_archive',p_operation_key,p_tenant_id,v_fingerprint,v_result,v_actor);
END;
$$;

-- -----------------------------------------------------------------------------
-- 13. Database mutation enforcement
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_tenant_operational_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
  v_access record;
  v_jwt_role text := COALESCE(current_setting('request.jwt.claim.role', true), '');
  v_sql_role text := COALESCE(current_setting('role', true), '');
BEGIN
  IF v_jwt_role = 'service_role'
     OR v_sql_role = 'service_role'
     OR current_user = 'service_role'
     OR (v_sql_role IN ('none','postgres') AND current_user IN ('postgres','supabase_admin')) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_tenant_id := CASE WHEN TG_OP='DELETE' THEN OLD.tenant_id ELSE NEW.tenant_id END;
  SELECT * INTO v_access
  FROM public.tenant_operational_access_allowed(v_tenant_id,auth.uid(),TG_TABLE_NAME || ':' || TG_OP);

  IF NOT COALESCE(v_access.allowed,false) THEN
    RAISE EXCEPTION 'row-level security: TENANT_OPERATIONAL_ACCESS_DENIED:%', COALESCE(v_access.reason_code,'tenant_unavailable')
      USING ERRCODE='42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
DECLARE
  v_table text;
  v_tables text[] := ARRAY[
    'patients','doctors','appointments','chief_complaints','dental_charts','tooth_states','findings',
    'treatment_plans','treatment_stages','documents','clinical_dictionary_items','patient_files',
    'patient_visits','clinical_encounters','completed_services','invoices','invoice_items','payments',
    'payment_allocations','refunds','financial_adjustments','patient_fund_reservations',
    'appointment_confirmation_attempts','appointment_reminder_jobs','appointment_reminder_operations',
    'patient_contacts','patient_communication_preferences','patient_communication_consents',
    'patient_contact_suppressions','communication_routes','communication_operations','communication_templates',
    'communication_template_versions','integration_external_references'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    IF to_regclass('public.' || v_table) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS tenant_operational_mutation_guard ON public.%I',v_table);
      EXECUTE format(
        'CREATE TRIGGER tenant_operational_mutation_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_operational_mutation()',
        v_table
      );
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_tenant_operational_mutation() FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 14. Grants for controlled RPCs only
-- -----------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.create_platform_tenant(text,uuid,timestamptz,timestamptz,timestamptz,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_platform_tenant_owner(uuid,uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.replace_platform_tenant_owner(uuid,uuid,uuid,boolean,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_platform_tenant_owner(uuid,uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_tenant_subscription(uuid,timestamptz,timestamptz,timestamptz,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.extend_tenant_subscription(uuid,timestamptz,timestamptz,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.shorten_tenant_subscription(uuid,timestamptz,timestamptz,text,boolean,boolean,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.suspend_tenant(uuid,text,text,timestamptz,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resume_tenant(uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.archive_tenant(uuid,text,boolean,text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_platform_tenant(text,uuid,timestamptz,timestamptz,timestamptz,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_platform_tenant_owner(uuid,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.replace_platform_tenant_owner(uuid,uuid,uuid,boolean,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_platform_tenant_owner(uuid,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_tenant_subscription(uuid,timestamptz,timestamptz,timestamptz,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extend_tenant_subscription(uuid,timestamptz,timestamptz,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shorten_tenant_subscription(uuid,timestamptz,timestamptz,text,boolean,boolean,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.suspend_tenant(uuid,text,text,timestamptz,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resume_tenant(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_tenant(uuid,text,boolean,text) TO authenticated;

-- Tenant creation/deletion remains unavailable through direct authenticated table access.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.tenants FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.tenant_lifecycle FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.tenant_subscription_periods FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.platform_tenant_operations FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.tenant_users FROM authenticated, anon;

COMMENT ON FUNCTION public.get_tenant_effective_lifecycle_status(uuid,timestamptz) IS
  'Authoritative effective state. Temporary suspension ends by timestamp without cron; stored state may be reconciled by the next controlled mutation.';
COMMENT ON FUNCTION public.tenant_operational_access_allowed(uuid,uuid,text) IS
  'Authoritative operational gate combining active membership and effective tenant lifecycle.';
COMMENT ON TABLE public.tenant_subscription_periods IS
  'Immutable subscription history. Changes supersede the previous current row rather than erasing dates.';
COMMENT ON TABLE public.platform_tenant_operations IS
  'Idempotency ledger for platform tenant lifecycle mutations. Contains safe result metadata only.';
