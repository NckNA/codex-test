\set ON_ERROR_STOP on
\echo 'TENANT-TIMEZONE-SCHEDULING-FOUNDATION-001 local SQL validation'

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

\set tenant_a 'a2810000-0000-4000-8000-000000000001'
\set tenant_b 'b2810000-0000-4000-8000-000000000001'
\set owner_a 'a2820000-0000-4000-8000-000000000001'
\set admin_a 'a2820000-0000-4000-8000-000000000002'
\set registrar_a 'a2820000-0000-4000-8000-000000000003'
\set doctor_a_user 'a2820000-0000-4000-8000-000000000004'
\set cashier_a 'a2820000-0000-4000-8000-000000000005'
\set no_tenant 'a2820000-0000-4000-8000-000000000006'
\set unknown_user 'a2820000-0000-4000-8000-000000000007'
\set admin_b 'b2820000-0000-4000-8000-000000000001'
\set patient_a 'a2830000-0000-4000-8000-000000000001'
\set doctor_a 'a2840000-0000-4000-8000-000000000001'
\set appointment_a 'a2850000-0000-4000-8000-000000000001'

SELECT pg_temp.assert_true(
  (SELECT column_default LIKE '%Asia/Almaty%'
   FROM information_schema.columns
   WHERE table_schema='public' AND table_name='tenants' AND column_name='timezone'),
  'tenant timezone has documented legacy default'
);
SELECT pg_temp.assert_true(
  (SELECT is_nullable='NO'
   FROM information_schema.columns
   WHERE table_schema='public' AND table_name='tenants' AND column_name='timezone'),
  'tenant timezone is not nullable'
);
SELECT pg_temp.assert_true(
  (SELECT relrowsecurity FROM pg_class WHERE oid='public.tenants'::regclass),
  'tenant RLS remains enabled'
);
SELECT pg_temp.assert_true(public.is_valid_iana_timezone('Asia/Almaty'), 'Asia/Almaty accepted');
SELECT pg_temp.assert_true(public.is_valid_iana_timezone('Europe/Berlin'), 'Europe/Berlin accepted');
SELECT pg_temp.assert_true(public.is_valid_iana_timezone('America/New_York'), 'America/New_York accepted');
SELECT pg_temp.assert_true(NOT public.is_valid_iana_timezone('UTC+5'), 'numeric-like zone rejected');
SELECT pg_temp.assert_true(NOT public.is_valid_iana_timezone(''), 'empty zone rejected');

INSERT INTO public.tenants(id,name) VALUES
  (:'tenant_a','Timezone Clinic A'),
  (:'tenant_b','Timezone Clinic B');
SELECT pg_temp.assert_true((SELECT timezone='Asia/Almaty' FROM public.tenants WHERE id=:'tenant_a'), 'legacy/default tenant receives Asia/Almaty');

INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) VALUES
  (:'owner_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','tz-owner@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'admin_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','tz-admin@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'registrar_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','tz-registrar@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'doctor_a_user','00000000-0000-0000-0000-000000000000','authenticated','authenticated','tz-doctor@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'cashier_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','tz-cashier@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'no_tenant','00000000-0000-0000-0000-000000000000','authenticated','authenticated','tz-no-tenant@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'unknown_user','00000000-0000-0000-0000-000000000000','authenticated','authenticated','tz-unknown@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'admin_b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','tz-admin-b@example.local','x',now(),'{"provider":"email"}','{}',now(),now());

INSERT INTO public.profiles(id,first_name,last_name) VALUES
  (:'owner_a','Owner','A'),(:'admin_a','Admin','A'),(:'registrar_a','Registrar','A'),
  (:'doctor_a_user','Doctor','A'),(:'cashier_a','Cashier','A'),(:'no_tenant','No','Tenant'),
  (:'unknown_user','Unknown','User'),(:'admin_b','Admin','B');

INSERT INTO public.tenant_users(tenant_id,user_id,role) VALUES
  (:'tenant_a',:'owner_a','clinic_owner'),
  (:'tenant_a',:'admin_a','clinic_admin'),
  (:'tenant_a',:'registrar_a','registrar'),
  (:'tenant_a',:'doctor_a_user','doctor'),
  (:'tenant_a',:'cashier_a','cashier'),
  (:'tenant_b',:'admin_b','clinic_admin');

INSERT INTO public.patients(id,tenant_id,full_name,phone,source,status,balance)
VALUES (:'patient_a',:'tenant_a','Timezone Patient','+77002810001','phone','active',0);
INSERT INTO public.doctors(id,tenant_id,user_id,full_name,specialization,cabinet,color,active)
VALUES (:'doctor_a',:'tenant_a',:'doctor_a_user','Timezone Doctor','General','A1','#111111',true);
INSERT INTO public.appointments(id,tenant_id,patient_id,doctor_id,cabinet,service,status,start_time,end_time)
VALUES (:'appointment_a',:'tenant_a',:'patient_a',:'doctor_a','A1','Timezone baseline','new','2026-07-11 19:30+00','2026-07-11 20:30+00');

SELECT start_time::text AS start_before, end_time::text AS end_before FROM public.appointments WHERE id=:'appointment_a' \gset
SELECT count(*)::text AS visits_before FROM public.patient_visits \gset
SELECT count(*)::text AS encounters_before FROM public.clinical_encounters \gset
SELECT count(*)::text AS services_before FROM public.completed_services \gset
SELECT count(*)::text AS invoices_before FROM public.invoices \gset
SELECT count(*)::text AS payments_before FROM public.payments \gset
SELECT count(*)::text AS refunds_before FROM public.refunds \gset
SELECT count(*)::text AS adjustments_before FROM public.financial_adjustments \gset

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
SELECT public.set_tenant_timezone(:'tenant_a','Europe/Berlin');
SELECT pg_temp.assert_true((SELECT timezone='Europe/Berlin' FROM public.tenants WHERE id=:'tenant_a'), 'owner changes timezone');
SELECT pg_temp.expect_error(format('update public.tenants set timezone=%L where id=%L::uuid','Asia/Almaty',:'tenant_a'),'permission denied');
SELECT pg_temp.expect_error(format('select public.set_tenant_timezone(%L::uuid,%L)',:'tenant_a','UTC+5'),'корректный часовой пояс');
SELECT pg_temp.expect_error(format('select public.set_tenant_timezone(%L::uuid,%L)',:'tenant_a',''),'корректный часовой пояс');

SELECT set_config('request.jwt.claim.sub',:'admin_a',true);
SELECT public.set_tenant_timezone(:'tenant_a','America/New_York');
SELECT pg_temp.assert_true((SELECT timezone='America/New_York' FROM public.tenants WHERE id=:'tenant_a'), 'admin changes timezone');

SELECT set_config('request.jwt.claim.sub',:'registrar_a',true);
SELECT pg_temp.assert_true((SELECT timezone='America/New_York' FROM public.tenants WHERE id=:'tenant_a'), 'registrar may read timezone');
SELECT pg_temp.expect_error(format('select public.set_tenant_timezone(%L::uuid,%L)',:'tenant_a','Asia/Almaty'),'Недостаточно прав');
SELECT set_config('request.jwt.claim.sub',:'doctor_a_user',true);
SELECT pg_temp.expect_error(format('select public.set_tenant_timezone(%L::uuid,%L)',:'tenant_a','Asia/Almaty'),'Недостаточно прав');
SELECT set_config('request.jwt.claim.sub',:'cashier_a',true);
SELECT pg_temp.expect_error(format('select public.set_tenant_timezone(%L::uuid,%L)',:'tenant_a','Asia/Almaty'),'Недостаточно прав');
SELECT set_config('request.jwt.claim.sub',:'no_tenant',true);
SELECT pg_temp.expect_error(format('select public.set_tenant_timezone(%L::uuid,%L)',:'tenant_a','Asia/Almaty'),'Недостаточно прав');
SELECT set_config('request.jwt.claim.sub',:'unknown_user',true);
SELECT pg_temp.expect_error(format('select public.set_tenant_timezone(%L::uuid,%L)',:'tenant_a','Asia/Almaty'),'Недостаточно прав');
SELECT set_config('request.jwt.claim.sub',:'admin_b',true);
SELECT pg_temp.expect_error(format('select public.set_tenant_timezone(%L::uuid,%L)',:'tenant_a','Asia/Almaty'),'Недостаточно прав');

RESET ROLE;
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM public.audit_events WHERE tenant_id=:'tenant_a' AND action='tenant_timezone_changed'), 'timezone changes are audited once each');
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM public.activity_events WHERE tenant_id=:'tenant_a' AND type='tenant_timezone_changed'), 'timezone changes create activity facts');
SELECT pg_temp.assert_true((SELECT start_time::text=:'start_before' AND end_time::text=:'end_before' FROM public.appointments WHERE id=:'appointment_a'), 'appointment instants unchanged');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.appointments WHERE tenant_id=:'tenant_a')=1, 'no duplicate appointment rows');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.appointments WHERE end_time<=start_time)=0, 'invalid intervals remain zero');
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.patient_visits)=:'visits_before', 'no visit side effects');
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.clinical_encounters)=:'encounters_before', 'no encounter side effects');
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.completed_services)=:'services_before', 'no completed service side effects');
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.invoices)=:'invoices_before', 'no invoice side effects');
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.payments)=:'payments_before', 'no payment side effects');
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.refunds)=:'refunds_before', 'no refund side effects');
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.financial_adjustments)=:'adjustments_before', 'no adjustment side effects');

ROLLBACK;
\echo 'TENANT-TIMEZONE-SCHEDULING-FOUNDATION-001 SQL validation passed'