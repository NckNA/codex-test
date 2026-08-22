-- 0037_create_laboratory_work_queue_read_rpc.sql
-- LAB-WORK-QUEUE-PAGINATION-FOUNDATION-001X
-- Read-only bounded operational queue contract. No mutation or audit side effects.

CREATE OR REPLACE FUNCTION public.list_laboratory_work_queue_page(
  p_tenant_id uuid,
  p_status text DEFAULT NULL,
  p_responsible_doctor_id uuid DEFAULT NULL,
  p_laboratory_id uuid DEFAULT NULL,
  p_due_filter text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $labqueue$
DECLARE
  v_actor uuid := auth.uid();
  v_role text;
  v_status text := NULLIF(lower(btrim(COALESCE(p_status, ''))), '');
  v_due_filter text := COALESCE(NULLIF(lower(btrim(COALESCE(p_due_filter, ''))), ''), 'all');
  v_search text := NULLIF(btrim(COALESCE(p_search, '')), '');
  v_search_pattern text;
  v_timezone text;
  v_now timestamptz := now();
  v_tenant_today date;
  v_tomorrow_start timestamptz;
  v_result jsonb;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'LAB_QUEUE_ACCESS_DENIED';
  END IF;

  SELECT tu.role::text
    INTO v_role
  FROM public.tenant_users tu
  WHERE tu.tenant_id = p_tenant_id
    AND tu.user_id = v_actor;

  IF v_role IS NULL OR v_role NOT IN ('clinic_owner', 'clinic_admin', 'doctor', 'registrar') THEN
    RAISE EXCEPTION 'LAB_QUEUE_ACCESS_DENIED';
  END IF;

  IF v_status IS NOT NULL AND v_status NOT IN ('in_progress', 'completed') THEN
    RAISE EXCEPTION 'LAB_QUEUE_INVALID_STATUS';
  END IF;

  IF v_due_filter NOT IN ('all', 'overdue', 'today', 'upcoming', 'unscheduled') THEN
    RAISE EXCEPTION 'LAB_QUEUE_INVALID_DUE_FILTER';
  END IF;

  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'LAB_QUEUE_INVALID_LIMIT';
  END IF;

  IF p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'LAB_QUEUE_INVALID_OFFSET';
  END IF;

  SELECT t.timezone
    INTO v_timezone
  FROM public.tenants t
  WHERE t.id = p_tenant_id;

  IF v_timezone IS NULL OR NOT public.is_valid_iana_timezone(v_timezone) THEN
    RAISE EXCEPTION 'LAB_QUEUE_INVALID_TENANT_TIMEZONE';
  END IF;

  v_tenant_today := (v_now AT TIME ZONE v_timezone)::date;
  v_tomorrow_start := ((v_tenant_today + 1)::timestamp AT TIME ZONE v_timezone);

  IF v_search IS NOT NULL THEN
    -- Treat %, _ and backslash as literal user text, never as caller-supplied LIKE operators.
    v_search_pattern := '%' ||
      replace(
        replace(
          replace(v_search, E'\\', E'\\\\'),
          '%', E'\\%'
        ),
        '_', E'\\_'
      ) || '%';
  END IF;

  WITH filtered AS (
    SELECT o.*
    FROM public.laboratory_work_orders o
    WHERE o.tenant_id = p_tenant_id
      AND (v_status IS NULL OR o.status = v_status)
      AND (p_responsible_doctor_id IS NULL OR o.responsible_doctor_id = p_responsible_doctor_id)
      AND (p_laboratory_id IS NULL OR o.laboratory_id = p_laboratory_id)
      AND (
        v_due_filter = 'all'
        OR (
          v_due_filter = 'overdue'
          AND o.status = 'in_progress'
          AND o.planned_ready_at IS NOT NULL
          AND o.planned_ready_at < v_now
        )
        OR (
          v_due_filter = 'today'
          AND o.status = 'in_progress'
          AND o.planned_ready_at IS NOT NULL
          AND o.planned_ready_at >= v_now
          AND o.planned_ready_at < v_tomorrow_start
        )
        OR (
          v_due_filter = 'upcoming'
          AND o.status = 'in_progress'
          AND o.planned_ready_at IS NOT NULL
          AND o.planned_ready_at >= v_tomorrow_start
        )
        OR (
          v_due_filter = 'unscheduled'
          AND o.status = 'in_progress'
          AND o.planned_ready_at IS NULL
        )
      )
      AND (
        v_search IS NULL
        OR o.title ILIKE v_search_pattern ESCAPE E'\\'
        OR COALESCE(o.order_number, '') ILIKE v_search_pattern ESCAPE E'\\'
        OR EXISTS (
          SELECT 1
          FROM public.patients p
          WHERE p.tenant_id = o.tenant_id
            AND p.id = o.patient_id
            AND p.full_name ILIKE v_search_pattern ESCAPE E'\\'
        )
        OR EXISTS (
          SELECT 1
          FROM public.doctors d
          WHERE d.tenant_id = o.tenant_id
            AND d.id = o.responsible_doctor_id
            AND d.full_name ILIKE v_search_pattern ESCAPE E'\\'
        )
        OR EXISTS (
          SELECT 1
          FROM public.laboratories l
          WHERE l.tenant_id = o.tenant_id
            AND l.id = o.laboratory_id
            AND l.name ILIKE v_search_pattern ESCAPE E'\\'
        )
        OR EXISTS (
          SELECT 1
          FROM public.laboratory_work_order_types lot
          JOIN public.laboratory_work_types wt
            ON wt.tenant_id = lot.tenant_id
           AND wt.id = lot.laboratory_work_type_id
          WHERE lot.tenant_id = o.tenant_id
            AND lot.laboratory_work_order_id = o.id
            AND wt.name ILIKE v_search_pattern ESCAPE E'\\'
        )
      )
  ), paged AS (
    SELECT f.*
    FROM filtered f
    ORDER BY
      CASE WHEN f.status = 'in_progress' THEN 0 ELSE 1 END ASC,
      f.planned_ready_at ASC NULLS LAST,
      f.updated_at DESC,
      f.id ASC
    LIMIT p_limit
    OFFSET p_offset
  )
  SELECT jsonb_build_object(
    'items', COALESCE(
      (
        SELECT jsonb_agg(
          to_jsonb(p)
          ORDER BY
            CASE WHEN p.status = 'in_progress' THEN 0 ELSE 1 END ASC,
            p.planned_ready_at ASC NULLS LAST,
            p.updated_at DESC,
            p.id ASC
        )
        FROM paged p
      ),
      '[]'::jsonb
    ),
    'totalFiltered', (SELECT count(*) FROM filtered),
    'limit', p_limit,
    'offset', p_offset
  ) INTO v_result;

  RETURN v_result;
END;
$labqueue$;

CREATE OR REPLACE FUNCTION public.get_laboratory_work_queue_summary(
  p_tenant_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $labsummary$
DECLARE
  v_actor uuid := auth.uid();
  v_role text;
  v_now timestamptz := now();
  v_in_progress bigint;
  v_overdue bigint;
  v_completed bigint;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'LAB_QUEUE_ACCESS_DENIED';
  END IF;

  SELECT tu.role::text
    INTO v_role
  FROM public.tenant_users tu
  WHERE tu.tenant_id = p_tenant_id
    AND tu.user_id = v_actor;

  IF v_role IS NULL OR v_role NOT IN ('clinic_owner', 'clinic_admin', 'doctor', 'registrar') THEN
    RAISE EXCEPTION 'LAB_QUEUE_ACCESS_DENIED';
  END IF;

  SELECT
    count(*) FILTER (WHERE o.status = 'in_progress'),
    count(*) FILTER (
      WHERE o.status = 'in_progress'
        AND o.planned_ready_at IS NOT NULL
        AND o.planned_ready_at < v_now
    ),
    count(*) FILTER (WHERE o.status = 'completed')
  INTO v_in_progress, v_overdue, v_completed
  FROM public.laboratory_work_orders o
  WHERE o.tenant_id = p_tenant_id;

  RETURN jsonb_build_object(
    'inProgress', COALESCE(v_in_progress, 0),
    'overdue', COALESCE(v_overdue, 0),
    'completed', COALESCE(v_completed, 0)
  );
END;
$labsummary$;

REVOKE ALL ON FUNCTION public.list_laboratory_work_queue_page(uuid, text, uuid, uuid, text, text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_laboratory_work_queue_page(uuid, text, uuid, uuid, text, text, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_laboratory_work_queue_page(uuid, text, uuid, uuid, text, text, integer, integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_laboratory_work_queue_summary(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_laboratory_work_queue_summary(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_laboratory_work_queue_summary(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.list_laboratory_work_queue_page(uuid, text, uuid, uuid, text, text, integer, integer) IS
  'Read-only tenant-authorized bounded laboratory queue page. Cross-entity search and due filters execute before pagination; returns canonical order rows plus totalFiltered.';

COMMENT ON FUNCTION public.get_laboratory_work_queue_summary(uuid) IS
  'Read-only tenant-authorized whole-tenant laboratory queue summary independent of page/search filters.';
