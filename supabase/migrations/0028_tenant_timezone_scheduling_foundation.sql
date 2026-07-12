-- 0028_tenant_timezone_scheduling_foundation.sql
-- Authoritative tenant timezone foundation. Appointment timestamptz values are not rewritten.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS timezone text;

UPDATE public.tenants
SET timezone = 'Asia/Almaty'
WHERE timezone IS NULL OR btrim(timezone) = '';

ALTER TABLE public.tenants
  ALTER COLUMN timezone SET DEFAULT 'Asia/Almaty',
  ALTER COLUMN timezone SET NOT NULL;

CREATE OR REPLACE FUNCTION public.is_valid_iana_timezone(p_timezone text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT p_timezone IS NOT NULL
    AND btrim(p_timezone) = p_timezone
    AND p_timezone <> ''
    AND p_timezone !~ '^[+-]?[0-9]{1,2}(:?[0-9]{2})?$'
    AND EXISTS (
      SELECT 1
      FROM pg_catalog.pg_timezone_names
      WHERE name = p_timezone
    );
$$;

CREATE OR REPLACE FUNCTION public.validate_tenant_timezone_row()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NOT public.is_valid_iana_timezone(NEW.timezone) THEN
    RAISE EXCEPTION 'Укажите корректный часовой пояс клиники.' USING ERRCODE = '22023';
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.timezone IS DISTINCT FROM OLD.timezone
     AND COALESCE(current_setting('app.tenant_timezone_rpc', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Недостаточно прав для изменения часового пояса клиники.' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tenants_validate_timezone ON public.tenants;
CREATE TRIGGER tenants_validate_timezone
BEFORE INSERT OR UPDATE OF timezone ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.validate_tenant_timezone_row();

CREATE OR REPLACE FUNCTION public.set_tenant_timezone(
  p_tenant_id uuid,
  p_timezone text
) RETURNS public.tenants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role public.app_role;
  v_before text;
  v_after public.tenants;
  v_audit_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Недостаточно прав для изменения часового пояса клиники.' USING ERRCODE = '42501';
  END IF;

  SELECT tu.role
  INTO v_role
  FROM public.tenant_users tu
  WHERE tu.tenant_id = p_tenant_id
    AND tu.user_id = v_actor;

  IF v_role IS NULL OR v_role NOT IN ('clinic_owner'::public.app_role, 'clinic_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Недостаточно прав для изменения часового пояса клиники.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_valid_iana_timezone(p_timezone) THEN
    RAISE EXCEPTION 'Укажите корректный часовой пояс клиники.' USING ERRCODE = '22023';
  END IF;

  SELECT timezone
  INTO v_before
  FROM public.tenants
  WHERE id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Клиника не найдена.' USING ERRCODE = 'P0002';
  END IF;

  IF v_before = p_timezone THEN
    SELECT * INTO v_after FROM public.tenants WHERE id = p_tenant_id;
    RETURN v_after;
  END IF;

  PERFORM set_config('app.tenant_timezone_rpc', 'on', true);

  UPDATE public.tenants
  SET timezone = p_timezone,
      updated_at = now()
  WHERE id = p_tenant_id
  RETURNING * INTO v_after;

  PERFORM set_config('app.tenant_timezone_rpc', 'off', true);

  v_audit_id := public.record_audit_event_internal(
    p_tenant_id => p_tenant_id,
    p_action => 'tenant_timezone_changed',
    p_category => 'tenant',
    p_target_type => 'tenant',
    p_target_id => p_tenant_id::text,
    p_actor_user_id => v_actor,
    p_actor_tenant_role => v_role::text,
    p_before_data => jsonb_build_object('timezone', v_before),
    p_after_data => jsonb_build_object('timezone', p_timezone),
    p_diff_data => jsonb_build_object('timezone', jsonb_build_object('from', v_before, 'to', p_timezone)),
    p_redaction_level => 'none',
    p_metadata => jsonb_build_object('source', 'set_tenant_timezone')
  );

  PERFORM public.record_activity_event_internal(
    p_tenant_id => p_tenant_id,
    p_category => 'system',
    p_type => 'tenant_timezone_changed',
    p_title => 'Изменён часовой пояс клиники',
    p_source_type => 'tenant',
    p_source_id => p_tenant_id::text,
    p_audit_event_id => v_audit_id,
    p_actor_user_id => v_actor,
    p_visibility => 'admin',
    p_metadata => jsonb_build_object('timezone', p_timezone)
  );

  RETURN v_after;
END;
$$;

REVOKE ALL ON FUNCTION public.is_valid_iana_timezone(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_valid_iana_timezone(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.set_tenant_timezone(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_tenant_timezone(uuid, text) TO authenticated, service_role;

COMMENT ON COLUMN public.tenants.timezone IS 'Authoritative IANA timezone for tenant-local scheduling. Legacy default: Asia/Almaty.';
COMMENT ON FUNCTION public.set_tenant_timezone(uuid, text) IS 'Owner/admin-only audited timezone mutation. Browser numeric offsets are not accepted.';
COMMENT ON FUNCTION public.is_valid_iana_timezone(text) IS 'Validates exact IANA timezone names against PostgreSQL timezone catalog.';