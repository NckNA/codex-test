\set ON_ERROR_STOP on
\echo 'LAB-WORK-MUTATION-FOUNDATION-001N local SQL validation'

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

\set tenant_a 'a3600000-0000-4000-8000-000000000001'
\set tenant_b 'b3600000-0000-4000-8000-000000000001'
\set owner_a 'a3610000-0000-4000-8000-000000000001'
\set admin_a 'a3610000-0000-4000-8000-000000000002'
\set registrar_a 'a3610000-0000-4000-8000-000000000003'
\set doctor_a_user 'a3610000-0000-4000-8000-000000000004'
\set cashier_a 'a3610000-0000-4000-8000-000000000005'
\set admin_b 'b3610000-0000-4000-8000-000000000001'
\set patient_a 'a3620000-0000-4000-8000-000000000001'
\set patient_b 'b3620000-0000-4000-8000-000000000001'
\set doctor_a 'a3630000-0000-4000-8000-000000000001'
\set doctor_a2 'a3630000-0000-4000-8000-000000000002'
\set doctor_b 'b3630000-0000-4000-8000-000000000001'
\set lab_a 'a3640000-0000-4000-8000-000000000001'
\set lab_a2 'a3640000-0000-4000-8000-000000000002'
\set lab_b 'b3640000-0000-4000-8000-000000000001'
\set type_a1 'a3650000-0000-4000-8000-000000000001'
\set type_a2 'a3650000-0000-4000-8000-000000000002'
\set type_a3 'a3650000-0000-4000-8000-000000000003'
\set type_b 'b3650000-0000-4000-8000-000000000001'
\set order_main 'a3660000-0000-4000-8000-000000000001'
\set order_doctor 'a3660000-0000-4000-8000-000000000002'
\set order_registrar 'a3660000-0000-4000-8000-000000000003'
\set order_cashier 'a3660000-0000-4000-8000-000000000004'
\set order_cross 'a3660000-0000-4000-8000-000000000005'

-- Migration shape and audit taxonomy.
SELECT pg_temp.assert_true(
  to_regprocedure('public.create_laboratory_work_order_atomic(uuid,uuid,uuid,text,uuid[],uuid,uuid,text,timestamp with time zone,timestamp with time zone,timestamp with time zone,timestamp with time zone,timestamp with time zone,text,text,integer[],text,text)') IS NOT NULL,
  'create atomic RPC exists'
);
SELECT pg_temp.assert_true(
  to_regprocedure('public.update_laboratory_work_order_atomic(uuid,uuid,bigint,text,uuid[],uuid,uuid,text,timestamp with time zone,timestamp with time zone,timestamp with time zone,timestamp with time zone,timestamp with time zone,text,text,integer[],text,text)') IS NOT NULL,
  'update atomic RPC exists'
);
SELECT pg_temp.assert_true(
  to_regprocedure('public.complete_laboratory_work_order_atomic(uuid,uuid,bigint,text)') IS NOT NULL,
  'complete atomic RPC exists'
);
SELECT pg_temp.assert_true(
  to_regprocedure('public.reopen_laboratory_work_order_atomic(uuid,uuid,bigint,text,text)') IS NOT NULL,
  'reopen atomic RPC exists'
);
SELECT pg_temp.assert_true(
  has_function_privilege('authenticated', 'public.complete_laboratory_work_order_atomic(uuid,uuid,bigint,text)', 'EXECUTE'),
  'authenticated can execute bounded laboratory RPC'
);
SELECT pg_temp.assert_true(
  NOT has_function_privilege('anon', 'public.complete_laboratory_work_order_atomic(uuid,uuid,bigint,text)', 'EXECUTE'),
  'anon cannot execute laboratory RPC'
);
SELECT pg_temp.assert_true(
  pg_get_constraintdef((SELECT oid FROM pg_constraint WHERE conname='audit_events_category_check')) LIKE '%laboratory%',
  'audit_events category constraint includes laboratory'
);

-- Synthetic tenant/user/reference fixtures.
INSERT INTO public.tenants(id,name) VALUES
  (:'tenant_a','Lab Mutation Clinic A'),
  (:'tenant_b','Lab Mutation Clinic B');

INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) VALUES
  (:'owner_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lab36-owner-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'admin_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lab36-admin-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'registrar_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lab36-registrar-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'doctor_a_user','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lab36-doctor-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'cashier_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lab36-cashier-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'admin_b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lab36-admin-b@example.local','x',now(),'{"provider":"email"}','{}',now(),now());

INSERT INTO public.profiles(id,first_name,last_name) VALUES
  (:'owner_a','Owner','A'),(:'admin_a','Admin','A'),(:'registrar_a','Registrar','A'),
  (:'doctor_a_user','Doctor','A'),(:'cashier_a','Cashier','A'),(:'admin_b','Admin','B');

INSERT INTO public.tenant_users(tenant_id,user_id,role) VALUES
  (:'tenant_a',:'owner_a','clinic_owner'),
  (:'tenant_a',:'admin_a','clinic_admin'),
  (:'tenant_a',:'registrar_a','registrar'),
  (:'tenant_a',:'doctor_a_user','doctor'),
  (:'tenant_a',:'cashier_a','cashier'),
  (:'tenant_b',:'admin_b','clinic_admin');

INSERT INTO public.patients(id,tenant_id,full_name,phone,source,status,balance) VALUES
  (:'patient_a',:'tenant_a','Mutation Patient A','+77003600001','phone','active',0),
  (:'patient_b',:'tenant_b','Mutation Patient B','+77003600002','phone','active',0);

INSERT INTO public.doctors(id,tenant_id,user_id,full_name,specialization,cabinet,color,active) VALUES
  (:'doctor_a',:'tenant_a',:'doctor_a_user','Mutation Doctor A','Prosthetics','A1','#111111',true),
  (:'doctor_a2',:'tenant_a',NULL,'Mutation Doctor Inactive','Prosthetics','A2','#222222',false),
  (:'doctor_b',:'tenant_b',NULL,'Mutation Doctor B','Prosthetics','B1','#333333',true);

INSERT INTO public.laboratories(id,tenant_id,name,active) VALUES
  (:'lab_a',:'tenant_a','Mutation Lab A',true),
  (:'lab_a2',:'tenant_a','Mutation Lab Inactive',false),
  (:'lab_b',:'tenant_b','Mutation Lab B',true);

INSERT INTO public.laboratory_work_types(id,tenant_id,name,code,active,sort_order) VALUES
  (:'type_a1',:'tenant_a','Mutation Crown','M-CROWN',true,10),
  (:'type_a2',:'tenant_a','Mutation Try-in','M-TRYIN',true,20),
  (:'type_a3',:'tenant_a','Mutation Inactive Type','M-OLD',false,30),
  (:'type_b',:'tenant_b','Mutation Cross Tenant Type','M-B',true,10);

SELECT count(*)::text AS invoices_before FROM public.invoices \gset
SELECT count(*)::text AS payments_before FROM public.payments \gset
SELECT count(*)::text AS completed_services_before FROM public.completed_services \gset

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'admin_a',true);

-- Admin creates one order and duplicate requested work-type IDs normalize to one set.
SELECT (public.create_laboratory_work_order_atomic(
  p_tenant_id => :'tenant_a',
  p_order_id => :'order_main',
  p_patient_id => :'patient_a',
  p_title => 'Atomic crown order',
  p_work_type_ids => ARRAY[:'type_a1'::uuid,:'type_a1'::uuid,:'type_a2'::uuid],
  p_responsible_doctor_id => :'doctor_a',
  p_laboratory_id => :'lab_a',
  p_order_number => ' ATOMIC-001 ',
  p_sent_to_lab_at => '2026-08-19 10:00+05',
  p_planned_ready_at => '2026-08-25 17:00+05',
  p_shade => ' A2 ',
  p_anatomical_scope => 'selected_teeth',
  p_selected_teeth => ARRAY[12,11,11],
  p_comment => 'PRIVATE_COMMENT_MARKER_36',
  p_request_id => 'req-create-36'
)).mutation_version::text AS created_version \gset

SELECT pg_temp.assert_true(
  (SELECT status='in_progress' AND order_number='ATOMIC-001' AND selected_teeth=ARRAY[11,12] AND mutation_version=1
   FROM public.laboratory_work_orders WHERE id=:'order_main'),
  'create canonicalizes bounded order data, forces in_progress, and starts mutation_version at 1'
);
SELECT pg_temp.assert_true(
  (SELECT count(*)=2 FROM public.laboratory_work_order_types WHERE laboratory_work_order_id=:'order_main'),
  'create commits complete deduplicated work-type set'
);
SELECT pg_temp.assert_true(
  (SELECT count(*)=1 FROM public.audit_events WHERE target_id=:'order_main' AND action='laboratory_order.created' AND category='laboratory'),
  'create writes one laboratory audit in same domain action'
);
SELECT pg_temp.assert_true(
  NOT EXISTS (
    SELECT 1 FROM public.audit_events
    WHERE target_id=:'order_main'
      AND (COALESCE(before_data::text,'') || COALESCE(after_data::text,'') || COALESCE(metadata::text,'')) LIKE '%PRIVATE_COMMENT_MARKER_36%'
  ),
  'audit does not dump free-text comment payload'
);

-- Same logical create retry returns canonical row and does not duplicate order/audit.
SELECT (public.create_laboratory_work_order_atomic(
  p_tenant_id => :'tenant_a', p_order_id => :'order_main', p_patient_id => :'patient_a',
  p_title => 'Atomic crown order',
  p_work_type_ids => ARRAY[:'type_a2'::uuid,:'type_a1'::uuid],
  p_responsible_doctor_id => :'doctor_a', p_laboratory_id => :'lab_a',
  p_order_number => 'ATOMIC-001', p_sent_to_lab_at => '2026-08-19 10:00+05',
  p_planned_ready_at => '2026-08-25 17:00+05', p_shade => 'A2',
  p_anatomical_scope => 'selected_teeth', p_selected_teeth => ARRAY[11,12],
  p_comment => 'PRIVATE_COMMENT_MARKER_36', p_request_id => 'req-create-36-retry'
)).id::text AS replay_order_id \gset
SELECT pg_temp.assert_true(:'replay_order_id'=:'order_main', 'same create identity reconciles to canonical order');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.laboratory_work_orders WHERE id=:'order_main'), 'create retry does not duplicate order');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.audit_events WHERE target_id=:'order_main' AND action='laboratory_order.created'), 'create retry does not duplicate audit');

SELECT pg_temp.expect_error(
  format($q$SELECT public.create_laboratory_work_order_atomic(
    p_tenant_id => %L::uuid,p_order_id => %L::uuid,p_patient_id => %L::uuid,p_title => %L,
    p_work_type_ids => ARRAY[%L::uuid],p_responsible_doctor_id => %L::uuid,p_laboratory_id => %L::uuid)$q$,
    :'tenant_a',:'order_main',:'patient_a','Different logical order',:'type_a1',:'doctor_a',:'lab_a'),
  'LAB_ORDER_CREATE_CONFLICT'
);

-- Cross-tenant and inactive new references are deliberately generic and create no partial row.
SELECT pg_temp.expect_error(
  format($q$SELECT public.create_laboratory_work_order_atomic(
    p_tenant_id => %L::uuid,p_order_id => %L::uuid,p_patient_id => %L::uuid,p_title => %L)$q$,
    :'tenant_a',:'order_cross',:'patient_b','Cross tenant patient'),
  'LAB_ORDER_REFERENCE_UNAVAILABLE'
);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.laboratory_work_orders WHERE id=:'order_cross'), 'failed cross-tenant create leaves no row');
SELECT pg_temp.expect_error(
  format($q$SELECT public.create_laboratory_work_order_atomic(
    p_tenant_id => %L::uuid,p_order_id => %L::uuid,p_patient_id => %L::uuid,p_title => %L,
    p_responsible_doctor_id => %L::uuid)$q$,
    :'tenant_a',:'order_cross',:'patient_a','Inactive doctor',:'doctor_a2'),
  'LAB_ORDER_REFERENCE_UNAVAILABLE'
);
SELECT pg_temp.expect_error(
  format($q$SELECT public.create_laboratory_work_order_atomic(
    p_tenant_id => %L::uuid,p_order_id => %L::uuid,p_patient_id => %L::uuid,p_title => %L,
    p_laboratory_id => %L::uuid)$q$,
    :'tenant_a',:'order_cross',:'patient_a','Inactive lab',:'lab_a2'),
  'LAB_ORDER_REFERENCE_UNAVAILABLE'
);
SELECT pg_temp.expect_error(
  format($q$SELECT public.create_laboratory_work_order_atomic(
    p_tenant_id => %L::uuid,p_order_id => %L::uuid,p_patient_id => %L::uuid,p_title => %L,
    p_work_type_ids => ARRAY[%L::uuid])$q$,
    :'tenant_a',:'order_cross',:'patient_a','Inactive type',:'type_a3'),
  'LAB_ORDER_REFERENCE_UNAVAILABLE'
);

-- Doctor and registrar are allowed operational creators.
SELECT set_config('request.jwt.claim.sub',:'doctor_a_user',true);
SELECT (public.create_laboratory_work_order_atomic(
  p_tenant_id => :'tenant_a',p_order_id => :'order_doctor',p_patient_id => :'patient_a',
  p_title => 'Doctor atomic order',p_work_type_ids => ARRAY[:'type_a1'::uuid],p_request_id => 'req-doctor-create'
)).id IS NOT NULL AS doctor_created \gset
SELECT pg_temp.assert_true(:'doctor_created'::boolean, 'doctor can create in-progress order');
UPDATE public.laboratory_work_orders SET comment='legacy direct repository style update' WHERE id=:'order_doctor';
SELECT pg_temp.assert_true((SELECT mutation_version=2 FROM public.laboratory_work_orders WHERE id=:'order_doctor'), 'lab-only trigger increments mutation_version for legacy direct UPDATE too');

SELECT set_config('request.jwt.claim.sub',:'registrar_a',true);
SELECT (public.create_laboratory_work_order_atomic(
  p_tenant_id => :'tenant_a',p_order_id => :'order_registrar',p_patient_id => :'patient_a',
  p_title => 'Registrar atomic order',p_work_type_ids => ARRAY[:'type_a1'::uuid],p_request_id => 'req-registrar-create'
)).id IS NOT NULL AS registrar_created \gset
SELECT pg_temp.assert_true(:'registrar_created'::boolean, 'registrar can create in-progress order');

-- Cashier is outside the mutation role set.
SELECT set_config('request.jwt.claim.sub',:'cashier_a',true);
SELECT pg_temp.expect_error(
  format($q$SELECT public.create_laboratory_work_order_atomic(
    p_tenant_id => %L::uuid,p_order_id => %L::uuid,p_patient_id => %L::uuid,p_title => %L)$q$,
    :'tenant_a',:'order_cashier',:'patient_a','Forbidden cashier order'),
  'LAB_ORDER_ACCESS_DENIED'
);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.laboratory_work_orders WHERE id=:'order_cashier'), 'cashier denial creates no order');

-- Edit: preserve already-linked historical inactive type/lab, but block newly selected inactive refs.
SELECT set_config('request.jwt.claim.sub',:'admin_a',true);
UPDATE public.laboratory_work_types SET active=false WHERE id=:'type_a2';
UPDATE public.laboratories SET active=false WHERE id=:'lab_a';

SELECT mutation_version::text AS edit_expected_version FROM public.laboratory_work_orders WHERE id=:'order_main' \gset
SELECT (public.update_laboratory_work_order_atomic(
  p_tenant_id => :'tenant_a',p_order_id => :'order_main',p_expected_version => :'edit_expected_version'::bigint,
  p_title => 'Atomic crown order edited',p_work_type_ids => ARRAY[:'type_a1'::uuid,:'type_a2'::uuid],
  p_responsible_doctor_id => :'doctor_a',p_laboratory_id => :'lab_a',p_order_number => 'ATOMIC-001',
  p_sent_to_lab_at => '2026-08-19 10:00+05',p_planned_ready_at => '2026-08-26 17:00+05',
  p_shade => 'A3',p_anatomical_scope => 'selected_teeth',p_selected_teeth => ARRAY[11,12],
  p_comment => 'PRIVATE_EDIT_MARKER_36',p_request_id => 'req-edit-36'
)).mutation_version::text AS edited_version \gset

SELECT pg_temp.assert_true(
  (SELECT title='Atomic crown order edited' AND laboratory_id=:'lab_a' AND planned_ready_at='2026-08-26 17:00+05'::timestamptz AND mutation_version=2
   FROM public.laboratory_work_orders WHERE id=:'order_main'),
  'edit persists canonical order fields, preserves inactive historical lab, and increments mutation_version'
);
SELECT pg_temp.assert_true(
  (SELECT count(*)=2 FROM public.laboratory_work_order_types WHERE laboratory_work_order_id=:'order_main'),
  'edit preserves already-linked inactive historical work type'
);
SELECT pg_temp.assert_true(
  (SELECT count(*)=1 FROM public.audit_events WHERE target_id=:'order_main' AND action='laboratory_order.updated'),
  'edit writes one update audit'
);
SELECT pg_temp.assert_true(
  NOT EXISTS (
    SELECT 1 FROM public.audit_events
    WHERE target_id=:'order_main'
      AND (COALESCE(before_data::text,'') || COALESCE(after_data::text,'') || COALESCE(metadata::text,'')) LIKE '%PRIVATE_EDIT_MARKER_36%'
  ),
  'edit audit does not dump free-text comment payload'
);

-- Newly adding an inactive type is denied; existing order fields/relations remain unchanged.
SELECT pg_temp.expect_error(
  format($q$SELECT public.update_laboratory_work_order_atomic(
    p_tenant_id => %L::uuid,p_order_id => %L::uuid,p_expected_version => %L::bigint,
    p_title => %L,p_work_type_ids => ARRAY[%L::uuid,%L::uuid,%L::uuid],
    p_responsible_doctor_id => %L::uuid,p_laboratory_id => %L::uuid)$q$,
    :'tenant_a',:'order_main',:'edited_version','SHOULD NOT COMMIT',:'type_a1',:'type_a2',:'type_a3',:'doctor_a',:'lab_a'),
  'LAB_ORDER_REFERENCE_UNAVAILABLE'
);
SELECT pg_temp.assert_true((SELECT title='Atomic crown order edited' FROM public.laboratory_work_orders WHERE id=:'order_main'), 'failed inactive-type edit leaves order unchanged');
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM public.laboratory_work_order_types WHERE laboratory_work_order_id=:'order_main'), 'failed inactive-type edit leaves relation set unchanged');

-- Stale snapshot cannot overwrite canonical state or relation set.
SELECT pg_temp.expect_error(
  format($q$SELECT public.update_laboratory_work_order_atomic(
    p_tenant_id => %L::uuid,p_order_id => %L::uuid,p_expected_version => %L::bigint,
    p_title => %L,p_work_type_ids => ARRAY[%L::uuid])$q$,
    :'tenant_a',:'order_main',:'edit_expected_version','STALE SHOULD NOT COMMIT',:'type_a1'),
  'LAB_ORDER_STALE_WRITE'
);
SELECT pg_temp.assert_true((SELECT title='Atomic crown order edited' FROM public.laboratory_work_orders WHERE id=:'order_main'), 'stale edit does not overwrite order');
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM public.laboratory_work_order_types WHERE laboratory_work_order_id=:'order_main'), 'stale edit does not partially replace work types');

-- Completing is an explicit lifecycle command. Doctor may complete but may not reopen.
SELECT set_config('request.jwt.claim.sub',:'doctor_a_user',true);
SELECT mutation_version::text AS complete_expected_version FROM public.laboratory_work_orders WHERE id=:'order_main' \gset
SELECT (public.complete_laboratory_work_order_atomic(
  p_tenant_id => :'tenant_a',p_order_id => :'order_main',
  p_expected_version => :'complete_expected_version'::bigint,p_request_id => 'req-complete-36'
)).mutation_version::text AS completed_version \gset
SELECT pg_temp.assert_true((SELECT status='completed' AND mutation_version=3 FROM public.laboratory_work_orders WHERE id=:'order_main'), 'doctor completes in-progress order and increments mutation_version');
SELECT set_config('request.jwt.claim.sub',:'admin_a',true);
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.audit_events WHERE target_id=:'order_main' AND action='laboratory_order.completed'), 'admin can verify complete audit recorded');
SELECT set_config('request.jwt.claim.sub',:'doctor_a_user',true);

SELECT pg_temp.expect_error(
  format($q$SELECT public.update_laboratory_work_order_atomic(
    p_tenant_id => %L::uuid,p_order_id => %L::uuid,p_expected_version => %L::bigint,
    p_title => %L,p_work_type_ids => ARRAY[%L::uuid,%L::uuid])$q$,
    :'tenant_a',:'order_main',:'completed_version','Completed edit forbidden',:'type_a1',:'type_a2'),
  'LAB_ORDER_EDIT_REQUIRES_IN_PROGRESS'
);
SELECT pg_temp.expect_error(
  format('SELECT public.reopen_laboratory_work_order_atomic(%L::uuid,%L::uuid,%L::bigint,%L,%L)',
    :'tenant_a',:'order_main',:'completed_version','Doctor cannot reopen','req-doctor-reopen'),
  'LAB_ORDER_REOPEN_ACCESS_DENIED'
);

-- Admin reopen requires explicit reason and persists that reason only in audit.
SELECT set_config('request.jwt.claim.sub',:'admin_a',true);
SELECT pg_temp.expect_error(
  format('SELECT public.reopen_laboratory_work_order_atomic(%L::uuid,%L::uuid,%L::bigint,%L,%L)',
    :'tenant_a',:'order_main',:'completed_version','   ','req-empty-reason'),
  'LAB_ORDER_REOPEN_REASON_REQUIRED'
);
SELECT (public.reopen_laboratory_work_order_atomic(
  p_tenant_id => :'tenant_a',p_order_id => :'order_main',
  p_expected_version => :'completed_version'::bigint,
  p_reason => 'Correction required after laboratory review',p_request_id => 'req-reopen-36'
)).mutation_version::text AS reopened_version \gset
SELECT pg_temp.assert_true((SELECT status='in_progress' AND mutation_version=4 FROM public.laboratory_work_orders WHERE id=:'order_main'), 'admin reopens completed order and increments mutation_version');
SELECT pg_temp.assert_true(
  (SELECT count(*)=1 FROM public.audit_events
   WHERE target_id=:'order_main' AND action='laboratory_order.reopened'
     AND reason='Correction required after laboratory review'),
  'reopen audit contains explicit reason'
);

-- Tenant B cannot address tenant A order through SECURITY DEFINER RPC.
SELECT set_config('request.jwt.claim.sub',:'admin_b',true);
SELECT pg_temp.expect_error(
  format('SELECT public.complete_laboratory_work_order_atomic(%L::uuid,%L::uuid,%L::bigint,%L)',
    :'tenant_b',:'order_main',:'reopened_version','req-cross-tenant'),
  'LAB_ORDER_NOT_FOUND'
);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.laboratory_work_orders WHERE id=:'order_main'), 'tenant B RLS still cannot read tenant A order');

RESET ROLE;

-- No hidden cross-domain side effects.
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.invoices)=:'invoices_before', 'laboratory mutation creates no invoice');
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.payments)=:'payments_before', 'laboratory mutation creates no payment');
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.completed_services)=:'completed_services_before', 'laboratory mutation creates no completed service');

ROLLBACK;
\echo 'LAB-WORK-MUTATION-FOUNDATION-001N SQL validation passed'
