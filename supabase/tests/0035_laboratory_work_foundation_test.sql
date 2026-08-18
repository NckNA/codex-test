\set ON_ERROR_STOP on
\echo 'LAB-WORK-FOUNDATION-001A local SQL validation'

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

\set tenant_a 'a3500000-0000-4000-8000-000000000001'
\set tenant_b 'b3500000-0000-4000-8000-000000000001'
\set owner_a 'a3510000-0000-4000-8000-000000000001'
\set admin_a 'a3510000-0000-4000-8000-000000000002'
\set registrar_a 'a3510000-0000-4000-8000-000000000003'
\set doctor_a_user 'a3510000-0000-4000-8000-000000000004'
\set cashier_a 'a3510000-0000-4000-8000-000000000005'
\set no_tenant 'a3510000-0000-4000-8000-000000000006'
\set admin_b 'b3510000-0000-4000-8000-000000000001'
\set patient_a 'a3520000-0000-4000-8000-000000000001'
\set patient_b 'b3520000-0000-4000-8000-000000000001'
\set doctor_a 'a3530000-0000-4000-8000-000000000001'
\set doctor_b 'b3530000-0000-4000-8000-000000000001'
\set lab_a 'a3540000-0000-4000-8000-000000000001'
\set lab_b 'b3540000-0000-4000-8000-000000000001'
\set type_a1 'a3550000-0000-4000-8000-000000000001'
\set type_a2 'a3550000-0000-4000-8000-000000000002'
\set type_b 'b3550000-0000-4000-8000-000000000001'
\set order_a 'a3560000-0000-4000-8000-000000000001'

-- Schema and RLS shape.
SELECT pg_temp.assert_true(to_regclass('public.laboratories') IS NOT NULL, 'laboratories table exists');
SELECT pg_temp.assert_true(to_regclass('public.laboratory_work_types') IS NOT NULL, 'laboratory_work_types table exists');
SELECT pg_temp.assert_true(to_regclass('public.laboratory_work_orders') IS NOT NULL, 'laboratory_work_orders table exists');
SELECT pg_temp.assert_true(to_regclass('public.laboratory_work_order_types') IS NOT NULL, 'laboratory_work_order_types table exists');

SELECT pg_temp.assert_true((SELECT relrowsecurity FROM pg_class WHERE oid='public.laboratories'::regclass), 'laboratories RLS enabled');
SELECT pg_temp.assert_true((SELECT relrowsecurity FROM pg_class WHERE oid='public.laboratory_work_types'::regclass), 'work types RLS enabled');
SELECT pg_temp.assert_true((SELECT relrowsecurity FROM pg_class WHERE oid='public.laboratory_work_orders'::regclass), 'orders RLS enabled');
SELECT pg_temp.assert_true((SELECT relrowsecurity FROM pg_class WHERE oid='public.laboratory_work_order_types'::regclass), 'order/type RLS enabled');

SELECT pg_temp.assert_true(
  NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='laboratory_work_orders'
      AND column_name IN ('paid','payment_amount','invoice_id','payment_id','warehouse_movement_id')
  ),
  'lab foundation does not smuggle finance or warehouse truth into order rows'
);

-- Synthetic tenant/user fixtures.
INSERT INTO public.tenants(id,name) VALUES
  (:'tenant_a','Lab Foundation Clinic A'),
  (:'tenant_b','Lab Foundation Clinic B');

INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) VALUES
  (:'owner_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lab-owner-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'admin_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lab-admin-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'registrar_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lab-registrar-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'doctor_a_user','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lab-doctor-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'cashier_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lab-cashier-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'no_tenant','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lab-no-tenant@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'admin_b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lab-admin-b@example.local','x',now(),'{"provider":"email"}','{}',now(),now());

INSERT INTO public.profiles(id,first_name,last_name) VALUES
  (:'owner_a','Owner','A'),
  (:'admin_a','Admin','A'),
  (:'registrar_a','Registrar','A'),
  (:'doctor_a_user','Doctor','A'),
  (:'cashier_a','Cashier','A'),
  (:'no_tenant','No','Tenant'),
  (:'admin_b','Admin','B');

INSERT INTO public.tenant_users(tenant_id,user_id,role) VALUES
  (:'tenant_a',:'owner_a','clinic_owner'),
  (:'tenant_a',:'admin_a','clinic_admin'),
  (:'tenant_a',:'registrar_a','registrar'),
  (:'tenant_a',:'doctor_a_user','doctor'),
  (:'tenant_a',:'cashier_a','cashier'),
  (:'tenant_b',:'admin_b','clinic_admin');

INSERT INTO public.patients(id,tenant_id,full_name,phone,source,status,balance) VALUES
  (:'patient_a',:'tenant_a','Synthetic Lab Patient A','+77003500001','phone','active',0),
  (:'patient_b',:'tenant_b','Synthetic Lab Patient B','+77003500002','phone','active',0);

INSERT INTO public.doctors(id,tenant_id,user_id,full_name,specialization,cabinet,color,active) VALUES
  (:'doctor_a',:'tenant_a',:'doctor_a_user','Synthetic Lab Doctor A','Prosthetics','A1','#111111',true),
  (:'doctor_b',:'tenant_b',NULL,'Synthetic Lab Doctor B','Prosthetics','B1','#222222',true);

-- Tenant B references are inserted as the database owner so cross-tenant FK tests have real targets.
INSERT INTO public.laboratories(id,tenant_id,name) VALUES (:'lab_b',:'tenant_b','Synthetic Lab B');
INSERT INTO public.laboratory_work_types(id,tenant_id,name,code,sort_order)
VALUES (:'type_b',:'tenant_b','Synthetic Work Type B','LAB-B',0);

SELECT count(*)::text AS invoices_before FROM public.invoices \gset
SELECT count(*)::text AS payments_before FROM public.payments \gset
SELECT count(*)::text AS completed_services_before FROM public.completed_services \gset

-- Admin A can maintain tenant-scoped laboratory references.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'admin_a',true);

INSERT INTO public.laboratories(id,tenant_id,name,notes)
VALUES (:'lab_a',:'tenant_a','Synthetic Lab A','QA-only reference');

INSERT INTO public.laboratory_work_types(id,tenant_id,name,code,sort_order) VALUES
  (:'type_a1',:'tenant_a','Synthetic Crown Work','CROWN-DEMO',10),
  (:'type_a2',:'tenant_a','Synthetic Try-in Work','TRYIN-DEMO',20);

SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.laboratories WHERE id=:'lab_a'), 'admin creates lab reference');
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM public.laboratory_work_types WHERE tenant_id=:'tenant_a'), 'admin creates tenant work types');

-- Registrar can read reference data and operate work orders, but cannot administer dictionaries.
SELECT set_config('request.jwt.claim.sub',:'registrar_a',true);
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.laboratories WHERE tenant_id=:'tenant_a'), 'registrar reads tenant lab');
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM public.laboratory_work_types WHERE tenant_id=:'tenant_a'), 'registrar reads tenant work types');

SELECT pg_temp.expect_error(
  format('insert into public.laboratories(tenant_id,name) values (%L::uuid,%L)', :'tenant_a', 'Forbidden Registrar Lab'),
  'row-level security'
);
SELECT pg_temp.expect_error(
  format('insert into public.laboratory_work_types(tenant_id,name) values (%L::uuid,%L)', :'tenant_a', 'Forbidden Registrar Type'),
  'row-level security'
);

INSERT INTO public.laboratory_work_orders(
  id, tenant_id, patient_id, responsible_doctor_id, laboratory_id,
  order_number, title, status,
  sent_to_lab_at, planned_ready_at, try_in_at,
  shade, anatomical_scope, selected_teeth, comment, created_by, updated_by
) VALUES (
  :'order_a', :'tenant_a', :'patient_a', :'doctor_a', :'lab_a',
  'LAB-DEMO-001', 'Synthetic prosthetic laboratory order', 'in_progress',
  '2026-08-19 09:00+05', '2026-08-25 17:00+05', '2026-08-24 15:00+05',
  'A2', 'selected_teeth', ARRAY[11,12], 'QA-only order', :'registrar_a', :'registrar_a'
);

INSERT INTO public.laboratory_work_order_types(tenant_id,laboratory_work_order_id,laboratory_work_type_id) VALUES
  (:'tenant_a',:'order_a',:'type_a1'),
  (:'tenant_a',:'order_a',:'type_a2');

SELECT pg_temp.assert_true(
  (SELECT selected_teeth=ARRAY[11,12] AND shade='A2' AND anatomical_scope='selected_teeth'
   FROM public.laboratory_work_orders WHERE id=:'order_a'),
  'anatomical manufacturing scope and shade persist'
);
SELECT pg_temp.assert_true(
  (SELECT count(*)=2 FROM public.laboratory_work_order_types WHERE laboratory_work_order_id=:'order_a'),
  'one order supports multiple configurable work types'
);

UPDATE public.laboratory_work_orders
SET received_from_lab_at='2026-08-23 12:30+05',
    comment='Returned from lab for synthetic QA',
    updated_by=:'registrar_a'
WHERE id=:'order_a';

SELECT pg_temp.assert_true(
  (SELECT received_from_lab_at IS NOT NULL AND planned_ready_at IS NOT NULL AND try_in_at IS NOT NULL
   FROM public.laboratory_work_orders WHERE id=:'order_a'),
  'independent milestone timestamps persist'
);

DELETE FROM public.laboratory_work_order_types
WHERE tenant_id=:'tenant_a' AND laboratory_work_order_id=:'order_a' AND laboratory_work_type_id=:'type_a2';
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.laboratory_work_order_types WHERE laboratory_work_order_id=:'order_a'), 'registrar edits order type membership');
INSERT INTO public.laboratory_work_order_types(tenant_id,laboratory_work_order_id,laboratory_work_type_id)
VALUES (:'tenant_a',:'order_a',:'type_a2');

DELETE FROM public.laboratory_work_orders WHERE id=:'order_a';
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.laboratory_work_orders WHERE id=:'order_a'), 'registrar cannot hard-delete order');

-- Doctor can read and update the same canonical operational record.
SELECT set_config('request.jwt.claim.sub',:'doctor_a_user',true);
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.laboratory_work_orders WHERE id=:'order_a'), 'doctor reads tenant lab order');
UPDATE public.laboratory_work_orders
SET status='completed', delivered_to_patient_at='2026-08-26 14:00+05', updated_by=:'doctor_a_user'
WHERE id=:'order_a';
SELECT pg_temp.assert_true((SELECT status='completed' AND delivered_to_patient_at IS NOT NULL FROM public.laboratory_work_orders WHERE id=:'order_a'), 'doctor completes operational lab order');

-- Cashier is intentionally outside the first laboratory operational role set.
SELECT set_config('request.jwt.claim.sub',:'cashier_a',true);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.laboratory_work_orders WHERE id=:'order_a'), 'cashier cannot read lab order under initial role policy');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.laboratories WHERE id=:'lab_a'), 'cashier cannot read lab reference under initial role policy');
SELECT pg_temp.expect_error(
  format(
    'insert into public.laboratory_work_orders(tenant_id,patient_id,title) values (%L::uuid,%L::uuid,%L)',
    :'tenant_a', :'patient_a', 'Forbidden cashier order'
  ),
  'row-level security'
);

-- No-tenant and other-tenant identities cannot observe tenant A laboratory data.
SELECT set_config('request.jwt.claim.sub',:'no_tenant',true);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.laboratory_work_orders WHERE id=:'order_a'), 'no-tenant user cannot read lab order');

SELECT set_config('request.jwt.claim.sub',:'admin_b',true);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.laboratory_work_orders WHERE id=:'order_a'), 'tenant B admin cannot read tenant A order');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.laboratories WHERE id=:'lab_a'), 'tenant B admin cannot read tenant A laboratory');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.laboratory_work_types WHERE tenant_id=:'tenant_a'), 'tenant B admin cannot read tenant A work types');

RESET ROLE;

-- Schema constraints prevent cross-tenant relationships even for privileged database writes.
SELECT pg_temp.expect_error(
  format(
    'insert into public.laboratory_work_orders(tenant_id,patient_id,title) values (%L::uuid,%L::uuid,%L)',
    :'tenant_a', :'patient_b', 'Cross-tenant patient'
  ),
  'laboratory_work_orders_patient_fk'
);

SELECT pg_temp.expect_error(
  format(
    'insert into public.laboratory_work_orders(tenant_id,patient_id,responsible_doctor_id,title) values (%L::uuid,%L::uuid,%L::uuid,%L)',
    :'tenant_a', :'patient_a', :'doctor_b', 'Cross-tenant doctor'
  ),
  'laboratory_work_orders_doctor_fk'
);

SELECT pg_temp.expect_error(
  format(
    'insert into public.laboratory_work_orders(tenant_id,patient_id,laboratory_id,title) values (%L::uuid,%L::uuid,%L::uuid,%L)',
    :'tenant_a', :'patient_a', :'lab_b', 'Cross-tenant laboratory'
  ),
  'laboratory_work_orders_laboratory_fk'
);

SELECT pg_temp.expect_error(
  format(
    'insert into public.laboratory_work_order_types(tenant_id,laboratory_work_order_id,laboratory_work_type_id) values (%L::uuid,%L::uuid,%L::uuid)',
    :'tenant_a', :'order_a', :'type_b'
  ),
  'laboratory_work_order_types_type_fk'
);

SELECT pg_temp.expect_error(
  format(
    'insert into public.laboratory_work_orders(tenant_id,patient_id,title,status) values (%L::uuid,%L::uuid,%L,%L)',
    :'tenant_a', :'patient_a', 'Invalid status order', 'draft'
  ),
  'laboratory_work_orders_status_check'
);

SELECT pg_temp.expect_error(
  format(
    'insert into public.laboratory_work_orders(tenant_id,patient_id,title,anatomical_scope) values (%L::uuid,%L::uuid,%L,%L)',
    :'tenant_a', :'patient_a', 'Invalid scope order', 'unknown_scope'
  ),
  'laboratory_work_orders_anatomical_scope_check'
);

SELECT pg_temp.expect_error(
  format(
    'insert into public.laboratory_work_orders(tenant_id,patient_id,title,selected_teeth) values (%L::uuid,%L::uuid,%L,ARRAY[11,99])',
    :'tenant_a', :'patient_a', 'Invalid FDI order'
  ),
  'laboratory_work_orders_selected_teeth_fdi_check'
);

SELECT pg_temp.expect_error(
  format(
    'insert into public.laboratory_work_orders(tenant_id,patient_id,title) values (%L::uuid,%L::uuid,%L)',
    :'tenant_a', :'patient_a', '   '
  ),
  'laboratory_work_orders_title_non_empty_check'
);

SELECT pg_temp.expect_error(
  format('insert into public.laboratories(tenant_id,name) values (%L::uuid,%L)', :'tenant_a', '   '),
  'laboratories_name_non_empty_check'
);

-- Composite tenant-safe SET NULL actions must clear only the optional reference,
-- never tenant_id. This protects the order if a doctor or laboratory reference is removed.
DELETE FROM public.laboratories WHERE id=:'lab_a';
SELECT pg_temp.assert_true(
  (SELECT tenant_id=:'tenant_a' AND laboratory_id IS NULL FROM public.laboratory_work_orders WHERE id=:'order_a'),
  'deleting laboratory clears only laboratory_id and preserves tenant ownership'
);
DELETE FROM public.doctors WHERE id=:'doctor_a';
SELECT pg_temp.assert_true(
  (SELECT tenant_id=:'tenant_a' AND responsible_doctor_id IS NULL FROM public.laboratory_work_orders WHERE id=:'order_a'),
  'deleting doctor clears only responsible_doctor_id and preserves tenant ownership'
);

-- The operational foundation has no patient-finance or completed-service side effects.
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.invoices)=:'invoices_before', 'lab order creates no invoice side effect');
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.payments)=:'payments_before', 'lab order creates no payment side effect');
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.completed_services)=:'completed_services_before', 'lab order creates no completed-service side effect');

ROLLBACK;
\echo 'LAB-WORK-FOUNDATION-001A SQL validation passed'
