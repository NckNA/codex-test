\set ON_ERROR_STOP on
\echo 'LAB-WORK-QUEUE-PAGINATION-FOUNDATION-001X local SQL validation'

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.assert_true(p_condition boolean, p_message text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF COALESCE(p_condition, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'ASSERTION FAILED: %', p_message;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.expect_error(p_sql text, p_expected text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_message text;
BEGIN
  BEGIN
    EXECUTE p_sql;
    RAISE EXCEPTION 'ASSERTION FAILED: expected error containing "%"', p_expected;
  EXCEPTION WHEN OTHERS THEN
    v_message := SQLERRM;
    IF v_message LIKE 'ASSERTION FAILED:%' THEN RAISE; END IF;
    IF position(lower(p_expected) in lower(v_message)) = 0 THEN
      RAISE EXCEPTION 'ASSERTION FAILED: expected "%", got "%"', p_expected, v_message;
    END IF;
  END;
END;
$$;

\set tenant_a 'a3700000-0000-4000-8000-000000000001'
\set tenant_b 'b3700000-0000-4000-8000-000000000001'
\set owner_a 'a3710000-0000-4000-8000-000000000001'
\set admin_a 'a3710000-0000-4000-8000-000000000002'
\set doctor_user_a 'a3710000-0000-4000-8000-000000000003'
\set registrar_a 'a3710000-0000-4000-8000-000000000004'
\set cashier_a 'a3710000-0000-4000-8000-000000000005'
\set admin_b 'b3710000-0000-4000-8000-000000000001'
\set patient_a 'a3720000-0000-4000-8000-000000000001'
\set patient_search 'a3720000-0000-4000-8000-000000000002'
\set patient_b 'b3720000-0000-4000-8000-000000000001'
\set doctor_a 'a3730000-0000-4000-8000-000000000001'
\set doctor_search 'a3730000-0000-4000-8000-000000000002'
\set doctor_b 'b3730000-0000-4000-8000-000000000001'
\set lab_a 'a3740000-0000-4000-8000-000000000001'
\set lab_search 'a3740000-0000-4000-8000-000000000002'
\set lab_b 'b3740000-0000-4000-8000-000000000001'
\set type_a 'a3750000-0000-4000-8000-000000000001'
\set type_search_a 'a3750000-0000-4000-8000-000000000002'
\set type_search_b 'a3750000-0000-4000-8000-000000000003'
\set type_b 'b3750000-0000-4000-8000-000000000001'
\set order_overdue 'a3760000-0000-4000-8000-000000000001'
\set order_today 'a3760000-0000-4000-8000-000000000002'
\set order_upcoming 'a3760000-0000-4000-8000-000000000003'
\set order_unscheduled 'a3760000-0000-4000-8000-000000000004'
\set order_completed 'a3760000-0000-4000-8000-000000000005'
\set order_search 'a3760000-0000-4000-8000-000000000006'
\set order_literal 'a3760000-0000-4000-8000-000000000007'
\set order_tie_a 'a3760000-0000-4000-8000-000000000008'
\set order_tie_b 'a3760000-0000-4000-8000-000000000009'
\set order_b 'b3760000-0000-4000-8000-000000000001'

SELECT CASE WHEN extract(hour FROM (now() AT TIME ZONE 'UTC')) < 12 THEN 'UTC' ELSE 'Pacific/Honolulu' END AS test_timezone \gset

SELECT pg_temp.assert_true(to_regprocedure('public.list_laboratory_work_queue_page(uuid,text,uuid,uuid,text,text,integer,integer)') IS NOT NULL,'paged laboratory queue RPC exists');
SELECT pg_temp.assert_true(to_regprocedure('public.get_laboratory_work_queue_summary(uuid)') IS NOT NULL,'laboratory queue summary RPC exists');
SELECT pg_temp.assert_true((SELECT prosecdef AND provolatile='s' FROM pg_proc WHERE oid='public.list_laboratory_work_queue_page(uuid,text,uuid,uuid,text,text,integer,integer)'::regprocedure),'page RPC is SECURITY DEFINER and STABLE');
SELECT pg_temp.assert_true((SELECT prosecdef AND provolatile='s' FROM pg_proc WHERE oid='public.get_laboratory_work_queue_summary(uuid)'::regprocedure),'summary RPC is SECURITY DEFINER and STABLE');
SELECT pg_temp.assert_true(has_function_privilege('authenticated','public.list_laboratory_work_queue_page(uuid,text,uuid,uuid,text,text,integer,integer)','EXECUTE'),'authenticated can execute page RPC');
SELECT pg_temp.assert_true(NOT has_function_privilege('anon','public.list_laboratory_work_queue_page(uuid,text,uuid,uuid,text,text,integer,integer)','EXECUTE'),'anon cannot execute page RPC');
SELECT pg_temp.assert_true(has_function_privilege('authenticated','public.get_laboratory_work_queue_summary(uuid)','EXECUTE'),'authenticated can execute summary RPC');
SELECT pg_temp.assert_true(NOT has_function_privilege('anon','public.get_laboratory_work_queue_summary(uuid)','EXECUTE'),'anon cannot execute summary RPC');

SELECT pg_temp.assert_true(to_regprocedure('public.create_laboratory_work_order_atomic(uuid,uuid,uuid,text,uuid[],uuid,uuid,text,timestamp with time zone,timestamp with time zone,timestamp with time zone,timestamp with time zone,timestamp with time zone,text,text,integer[],text,text)') IS NOT NULL,'001N create mutation RPC remains present');

INSERT INTO public.tenants(id,name,timezone) VALUES
  (:'tenant_a','Lab Queue Paging Clinic A',:'test_timezone'),
  (:'tenant_b','Lab Queue Paging Clinic B',:'test_timezone');

INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) VALUES
  (:'owner_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lab37-owner-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'admin_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lab37-admin-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'doctor_user_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lab37-doctor-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'registrar_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lab37-registrar-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'cashier_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lab37-cashier-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'admin_b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lab37-admin-b@example.local','x',now(),'{"provider":"email"}','{}',now(),now());

INSERT INTO public.profiles(id,first_name,last_name) VALUES
  (:'owner_a','Owner','A'),(:'admin_a','Admin','A'),(:'doctor_user_a','Doctor','A'),
  (:'registrar_a','Registrar','A'),(:'cashier_a','Cashier','A'),(:'admin_b','Admin','B');

INSERT INTO public.tenant_users(tenant_id,user_id,role) VALUES
  (:'tenant_a',:'owner_a','clinic_owner'),
  (:'tenant_a',:'admin_a','clinic_admin'),
  (:'tenant_a',:'doctor_user_a','doctor'),
  (:'tenant_a',:'registrar_a','registrar'),
  (:'tenant_a',:'cashier_a','cashier'),
  (:'tenant_b',:'admin_b','clinic_admin');

INSERT INTO public.patients(id,tenant_id,full_name,phone,source,status,balance) VALUES
  (:'patient_a',:'tenant_a','Queue Base Patient','+77003700001','phone','active',0),
  (:'patient_search',:'tenant_a','Patient Needle','+77003700002','phone','archived',0),
  (:'patient_b',:'tenant_b','Queue Patient B','+77003700003','phone','active',0);

INSERT INTO public.doctors(id,tenant_id,user_id,full_name,specialization,cabinet,color,active) VALUES
  (:'doctor_a',:'tenant_a',:'doctor_user_a','Queue Base Doctor','Prosthetics','A1','#111111',true),
  (:'doctor_search',:'tenant_a',NULL,'Doctor Needle','Prosthetics','A2','#222222',false),
  (:'doctor_b',:'tenant_b',NULL,'Queue Doctor B','Prosthetics','B1','#333333',true);

INSERT INTO public.laboratories(id,tenant_id,name,active) VALUES
  (:'lab_a',:'tenant_a','Queue Base Lab',true),
  (:'lab_search',:'tenant_a','Lab Needle',false),
  (:'lab_b',:'tenant_b','Queue Lab B',true);

INSERT INTO public.laboratory_work_types(id,tenant_id,name,code,active,sort_order) VALUES
  (:'type_a',:'tenant_a','Queue Base Type','Q-BASE',true,10),
  (:'type_search_a',:'tenant_a','Needle Type Alpha','Q-NA',false,20),
  (:'type_search_b',:'tenant_a','Needle Type Beta','Q-NB',true,30),
  (:'type_b',:'tenant_b','Queue Type B','Q-B',true,10);

-- Nine Clinic A orders. The selected test timezone always has a local hour below 14,
-- so local 20:00 is safely in the future on the current tenant-local day.
INSERT INTO public.laboratory_work_orders(
  id,tenant_id,patient_id,responsible_doctor_id,laboratory_id,order_number,title,status,planned_ready_at,created_at,updated_at
) VALUES
  (:'order_overdue',:'tenant_a',:'patient_a',:'doctor_a',:'lab_a','Q-001','Priority overdue','in_progress',now()-interval '2 hours',now()-interval '9 days',now()-interval '9 minutes'),
  (:'order_today',:'tenant_a',:'patient_a',:'doctor_a',:'lab_a','Q-002','Priority today','in_progress',(((now() AT TIME ZONE :'test_timezone')::date + time '20:00') AT TIME ZONE :'test_timezone'),now()-interval '8 days',now()-interval '8 minutes'),
  (:'order_upcoming',:'tenant_a',:'patient_a',:'doctor_a',:'lab_a','Q-003','Priority upcoming','in_progress',((((now() AT TIME ZONE :'test_timezone')::date + 1) + time '10:00') AT TIME ZONE :'test_timezone'),now()-interval '7 days',now()-interval '7 minutes'),
  (:'order_unscheduled',:'tenant_a',:'patient_a',:'doctor_a',:'lab_a','Q-004','Priority unscheduled','in_progress',NULL,now()-interval '6 days','2026-01-01 00:00+00'),
  (:'order_completed',:'tenant_a',:'patient_a',:'doctor_a',:'lab_a','Q-005','Priority completed','completed',now()-interval '1 day',now()-interval '5 days',now()-interval '5 minutes'),
  (:'order_search',:'tenant_a',:'patient_search',:'doctor_search',:'lab_search','ORDER-777','Title Needle','in_progress',((((now() AT TIME ZONE :'test_timezone')::date + 1) + time '12:00') AT TIME ZONE :'test_timezone'),now()-interval '4 days',now()-interval '4 minutes'),
  (:'order_literal',:'tenant_a',:'patient_a',:'doctor_a',:'lab_a','Q-007','Literal %_ Marker','in_progress',NULL,now()-interval '3 days','2026-01-01 00:00+00'),
  (:'order_tie_a',:'tenant_a',:'patient_a',:'doctor_a',:'lab_a','Q-008','Tie Marker','in_progress',((((now() AT TIME ZONE :'test_timezone')::date + 1) + time '15:00') AT TIME ZONE :'test_timezone'),now()-interval '2 days','2026-02-02 00:00+00'),
  (:'order_tie_b',:'tenant_a',:'patient_a',:'doctor_a',:'lab_a','Q-009','Tie Marker','in_progress',((((now() AT TIME ZONE :'test_timezone')::date + 1) + time '15:00') AT TIME ZONE :'test_timezone'),now()-interval '1 day','2026-02-02 00:00+00'),
  (:'order_b',:'tenant_b',:'patient_b',:'doctor_b',:'lab_b','B-001','Tenant B order','in_progress',NULL,now(),now());

INSERT INTO public.laboratory_work_order_types(tenant_id,laboratory_work_order_id,laboratory_work_type_id) VALUES
  (:'tenant_a',:'order_search',:'type_search_a'),
  (:'tenant_a',:'order_search',:'type_search_b'),
  (:'tenant_a',:'order_overdue',:'type_a'),
  (:'tenant_b',:'order_b',:'type_b');

SELECT count(*)::text AS audit_before FROM public.audit_events \gset
SELECT count(*)::text AS activity_before FROM public.activity_events \gset

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'admin_a',true);

-- Page boundary and deterministic operational order.
SELECT pg_temp.assert_true((public.list_laboratory_work_queue_page(:'tenant_a')->>'totalFiltered')::integer = 9,'admin sees all 9 tenant A orders in totalFiltered');
SELECT pg_temp.assert_true(jsonb_array_length(public.list_laboratory_work_queue_page(:'tenant_a',p_limit=>3)->'items') = 3,'page respects requested limit');
SELECT pg_temp.assert_true(
  public.list_laboratory_work_queue_page(:'tenant_a',p_limit=>3)->'items'->0->>'id' = :'order_overdue'
  AND public.list_laboratory_work_queue_page(:'tenant_a',p_limit=>3)->'items'->1->>'id' = :'order_today'
  AND public.list_laboratory_work_queue_page(:'tenant_a',p_limit=>3)->'items'->2->>'id' = :'order_upcoming',
  'operational order is overdue then today then upcoming'
);
SELECT pg_temp.assert_true(
  public.list_laboratory_work_queue_page(:'tenant_a',p_search=>'Tie Marker')->'items'->0->>'id'=:'order_tie_a'
  AND public.list_laboratory_work_queue_page(:'tenant_a',p_search=>'Tie Marker')->'items'->1->>'id'=:'order_tie_b',
  'equal sort keys use deterministic id tie-breaker'
);
WITH p1 AS (
  SELECT value->>'id' AS id FROM jsonb_array_elements(public.list_laboratory_work_queue_page(:'tenant_a',p_limit=>3,p_offset=>0)->'items')
), p2 AS (
  SELECT value->>'id' AS id FROM jsonb_array_elements(public.list_laboratory_work_queue_page(:'tenant_a',p_limit=>3,p_offset=>3)->'items')
)
SELECT pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM p1 JOIN p2 USING(id)),'adjacent pages do not overlap');

-- Filters execute before the page boundary.
SELECT pg_temp.assert_true(
  (public.list_laboratory_work_queue_page(:'tenant_a',p_status=>'completed',p_limit=>1)->>'totalFiltered')::integer=1
  AND public.list_laboratory_work_queue_page(:'tenant_a',p_status=>'completed',p_limit=>1)->'items'->0->>'id'=:'order_completed',
  'status filter executes before paging'
);
SELECT pg_temp.assert_true(
  (public.list_laboratory_work_queue_page(:'tenant_a',p_responsible_doctor_id=>:'doctor_search',p_limit=>1)->>'totalFiltered')::integer=1
  AND public.list_laboratory_work_queue_page(:'tenant_a',p_responsible_doctor_id=>:'doctor_search',p_limit=>1)->'items'->0->>'id'=:'order_search',
  'doctor filter executes before paging including inactive historical doctor'
);
SELECT pg_temp.assert_true(
  (public.list_laboratory_work_queue_page(:'tenant_a',p_laboratory_id=>:'lab_search',p_limit=>1)->>'totalFiltered')::integer=1
  AND public.list_laboratory_work_queue_page(:'tenant_a',p_laboratory_id=>:'lab_search',p_limit=>1)->'items'->0->>'id'=:'order_search',
  'laboratory filter executes before paging including inactive historical lab'
);

-- Authoritative due buckets.
SELECT pg_temp.assert_true((public.list_laboratory_work_queue_page(:'tenant_a',p_due_filter=>'overdue')->>'totalFiltered')::integer=1,'overdue bucket is exact');
SELECT pg_temp.assert_true((public.list_laboratory_work_queue_page(:'tenant_a',p_due_filter=>'today')->>'totalFiltered')::integer=1,'today bucket uses tenant-local day and excludes already-overdue work');
SELECT pg_temp.assert_true((public.list_laboratory_work_queue_page(:'tenant_a',p_due_filter=>'upcoming')->>'totalFiltered')::integer=4,'upcoming bucket starts after tenant-local today');
SELECT pg_temp.assert_true((public.list_laboratory_work_queue_page(:'tenant_a',p_due_filter=>'unscheduled')->>'totalFiltered')::integer=2,'unscheduled bucket is exact');

-- Cross-entity search. The order_search row deliberately matches several related entities.
SELECT pg_temp.assert_true((public.list_laboratory_work_queue_page(:'tenant_a',p_search=>'Title Needle')->>'totalFiltered')::integer=1,'search finds title');
SELECT pg_temp.assert_true((public.list_laboratory_work_queue_page(:'tenant_a',p_search=>'ORDER-777')->>'totalFiltered')::integer=1,'search finds order number');
SELECT pg_temp.assert_true((public.list_laboratory_work_queue_page(:'tenant_a',p_search=>'Patient Needle')->>'totalFiltered')::integer=1,'search finds archived patient name');
SELECT pg_temp.assert_true((public.list_laboratory_work_queue_page(:'tenant_a',p_search=>'Doctor Needle')->>'totalFiltered')::integer=1,'search finds inactive doctor name');
SELECT pg_temp.assert_true((public.list_laboratory_work_queue_page(:'tenant_a',p_search=>'Lab Needle')->>'totalFiltered')::integer=1,'search finds inactive laboratory name');
SELECT pg_temp.assert_true(
  (public.list_laboratory_work_queue_page(:'tenant_a',p_search=>'Needle Type')->>'totalFiltered')::integer=1
  AND jsonb_array_length(public.list_laboratory_work_queue_page(:'tenant_a',p_search=>'Needle Type')->'items')=1,
  'multiple matching work types do not duplicate an order'
);
SELECT pg_temp.assert_true(
  (public.list_laboratory_work_queue_page(:'tenant_a',p_search=>'%_')->>'totalFiltered')::integer=1
  AND public.list_laboratory_work_queue_page(:'tenant_a',p_search=>'%_')->'items'->0->>'id'=:'order_literal',
  'percent and underscore are treated as literal search text'
);
SELECT pg_temp.assert_true(
  (public.list_laboratory_work_queue_page(:'tenant_a',p_search=>'Title Needle',p_offset=>50)->>'totalFiltered')::integer=1
  AND jsonb_array_length(public.list_laboratory_work_queue_page(:'tenant_a',p_search=>'Title Needle',p_offset=>50)->'items')=0,
  'zero-item offset page still reports totalFiltered'
);

-- Whole-tenant summary is independent from page/search filters.
SELECT pg_temp.assert_true(public.get_laboratory_work_queue_summary(:'tenant_a')='{"inProgress":8,"overdue":1,"completed":1}'::jsonb,'summary counts whole tenant independently from queue page');
SELECT pg_temp.assert_true(
  (public.list_laboratory_work_queue_page(:'tenant_a',p_search=>'Title Needle')->>'totalFiltered')::integer=1
  AND public.get_laboratory_work_queue_summary(:'tenant_a')->>'inProgress'='8',
  'search page does not alter global summary'
);

-- Input validation is explicit and bounded.
SELECT pg_temp.expect_error(format($q$SELECT public.list_laboratory_work_queue_page(%L::uuid,p_status=>'invalid')$q$,:'tenant_a'),'LAB_QUEUE_INVALID_STATUS');
SELECT pg_temp.expect_error(format($q$SELECT public.list_laboratory_work_queue_page(%L::uuid,p_due_filter=>'invalid')$q$,:'tenant_a'),'LAB_QUEUE_INVALID_DUE_FILTER');
SELECT pg_temp.expect_error(format($q$SELECT public.list_laboratory_work_queue_page(%L::uuid,p_limit=>0)$q$,:'tenant_a'),'LAB_QUEUE_INVALID_LIMIT');
SELECT pg_temp.expect_error(format($q$SELECT public.list_laboratory_work_queue_page(%L::uuid,p_limit=>101)$q$,:'tenant_a'),'LAB_QUEUE_INVALID_LIMIT');
SELECT pg_temp.expect_error(format($q$SELECT public.list_laboratory_work_queue_page(%L::uuid,p_limit=>NULL)$q$,:'tenant_a'),'LAB_QUEUE_INVALID_LIMIT');
SELECT pg_temp.expect_error(format($q$SELECT public.list_laboratory_work_queue_page(%L::uuid,p_offset=>-1)$q$,:'tenant_a'),'LAB_QUEUE_INVALID_OFFSET');
SELECT pg_temp.expect_error(format($q$SELECT public.list_laboratory_work_queue_page(%L::uuid,p_offset=>NULL)$q$,:'tenant_a'),'LAB_QUEUE_INVALID_OFFSET');

-- All SELECT-capable laboratory roles are allowed.
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
SELECT pg_temp.assert_true((public.list_laboratory_work_queue_page(:'tenant_a')->>'totalFiltered')::integer=9,'clinic owner can read queue');
SELECT set_config('request.jwt.claim.sub',:'doctor_user_a',true);
SELECT pg_temp.assert_true((public.list_laboratory_work_queue_page(:'tenant_a')->>'totalFiltered')::integer=9,'doctor can read queue');
SELECT set_config('request.jwt.claim.sub',:'registrar_a',true);
SELECT pg_temp.assert_true((public.get_laboratory_work_queue_summary(:'tenant_a')->>'inProgress')::integer=8,'registrar can read summary');

-- Unsupported role and cross-tenant caller are denied even through SECURITY DEFINER.
SELECT set_config('request.jwt.claim.sub',:'cashier_a',true);
SELECT pg_temp.expect_error(format($q$SELECT public.list_laboratory_work_queue_page(%L::uuid)$q$,:'tenant_a'),'LAB_QUEUE_ACCESS_DENIED');
SELECT pg_temp.expect_error(format($q$SELECT public.get_laboratory_work_queue_summary(%L::uuid)$q$,:'tenant_a'),'LAB_QUEUE_ACCESS_DENIED');

SELECT set_config('request.jwt.claim.sub',:'admin_b',true);
SELECT pg_temp.assert_true(
  (public.list_laboratory_work_queue_page(:'tenant_b')->>'totalFiltered')::integer=1
  AND public.list_laboratory_work_queue_page(:'tenant_b')->'items'->0->>'id'=:'order_b',
  'tenant B admin sees only tenant B queue'
);
SELECT pg_temp.assert_true(public.get_laboratory_work_queue_summary(:'tenant_b')='{"inProgress":1,"overdue":0,"completed":0}'::jsonb,'tenant B summary is isolated');

SELECT set_config('request.jwt.claim.sub',:'admin_a',true);
SELECT pg_temp.expect_error(format($q$SELECT public.list_laboratory_work_queue_page(%L::uuid)$q$,:'tenant_b'),'LAB_QUEUE_ACCESS_DENIED');
SELECT pg_temp.expect_error(format($q$SELECT public.get_laboratory_work_queue_summary(%L::uuid)$q$,:'tenant_b'),'LAB_QUEUE_ACCESS_DENIED');

RESET ROLE;

-- STABLE read RPCs must have no audit/activity side effect.
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.audit_events)=:'audit_before','page/summary reads write no audit event');
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.activity_events)=:'activity_before','page/summary reads write no activity event');

\echo 'LAB-WORK-QUEUE-PAGINATION-FOUNDATION-001X PASS'
ROLLBACK;
