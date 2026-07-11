\set ON_ERROR_STOP on
\echo 'APPOINTMENT-CONFLICT-HARDENING-001 local SQL validation'

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

\set tenant_a 'a2510000-0000-4000-8000-000000000001'
\set tenant_b 'b2510000-0000-4000-8000-000000000001'
\set owner_a 'a2520000-0000-4000-8000-000000000001'
\set admin_a 'a2520000-0000-4000-8000-000000000002'
\set registrar_a 'a2520000-0000-4000-8000-000000000003'
\set doctor_user_a 'a2520000-0000-4000-8000-000000000004'
\set cashier_a 'a2520000-0000-4000-8000-000000000005'
\set no_tenant 'a2520000-0000-4000-8000-000000000006'
\set unknown_user 'a2520000-0000-4000-8000-000000000007'
\set admin_b 'b2520000-0000-4000-8000-000000000001'
\set patient_a1 'a2530000-0000-4000-8000-000000000001'
\set patient_a2 'a2530000-0000-4000-8000-000000000002'
\set patient_a3 'a2530000-0000-4000-8000-000000000003'
\set patient_b1 'b2530000-0000-4000-8000-000000000001'
\set doctor_a1 'a2540000-0000-4000-8000-000000000001'
\set doctor_a2 'a2540000-0000-4000-8000-000000000002'
\set doctor_b1 'b2540000-0000-4000-8000-000000000001'

INSERT INTO public.tenants(id,name) VALUES
  (:'tenant_a','Appointment hardening A'),
  (:'tenant_b','Appointment hardening B');

INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) VALUES
  (:'owner_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','ach-owner@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'admin_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','ach-admin@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'registrar_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','ach-registrar@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'doctor_user_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','ach-doctor@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'cashier_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','ach-cashier@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'no_tenant','00000000-0000-0000-0000-000000000000','authenticated','authenticated','ach-notenant@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'unknown_user','00000000-0000-0000-0000-000000000000','authenticated','authenticated','ach-unknown@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'admin_b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','ach-admin-b@example.local','x',now(),'{"provider":"email"}','{}',now(),now());

INSERT INTO public.profiles(id) VALUES
  (:'owner_a'),(:'admin_a'),(:'registrar_a'),(:'doctor_user_a'),(:'cashier_a'),(:'no_tenant'),(:'unknown_user'),(:'admin_b');

INSERT INTO public.tenant_users(tenant_id,user_id,role) VALUES
  (:'tenant_a',:'owner_a','clinic_owner'),
  (:'tenant_a',:'admin_a','clinic_admin'),
  (:'tenant_a',:'registrar_a','registrar'),
  (:'tenant_a',:'doctor_user_a','doctor'),
  (:'tenant_a',:'cashier_a','cashier'),
  (:'tenant_b',:'admin_b','clinic_admin');

INSERT INTO public.patients(id,tenant_id,full_name,phone,source,status,balance) VALUES
  (:'patient_a1',:'tenant_a','ACH Patient A1','+77002530001','phone','active',77),
  (:'patient_a2',:'tenant_a','ACH Patient A2','+77002530002','phone','active',0),
  (:'patient_a3',:'tenant_a','ACH Patient A3','+77002530003','phone','active',0),
  (:'patient_b1',:'tenant_b','ACH Patient B1','+77002530004','phone','active',0);

INSERT INTO public.doctors(id,tenant_id,full_name,specialization,cabinet,color,active) VALUES
  (:'doctor_a1',:'tenant_a','ACH Doctor A1','General','A1','#111111',true),
  (:'doctor_a2',:'tenant_a','ACH Doctor A2','Surgery','A2','#222222',true),
  (:'doctor_b1',:'tenant_b','ACH Doctor B1','General','B1','#333333',true);

SELECT count(*)::text AS visits_before FROM public.patient_visits \gset
SELECT count(*)::text AS encounters_before FROM public.clinical_encounters \gset
SELECT count(*)::text AS services_before FROM public.completed_services \gset
SELECT count(*)::text AS plans_before FROM public.treatment_plans \gset
SELECT count(*)::text AS findings_before FROM public.findings \gset
SELECT count(*)::text AS charts_before FROM public.dental_charts \gset
SELECT count(*)::text AS invoices_before FROM public.invoices \gset
SELECT count(*)::text AS payments_before FROM public.payments \gset
SELECT count(*)::text AS refunds_before FROM public.refunds \gset
SELECT count(*)::text AS adjustments_before FROM public.financial_adjustments \gset
SELECT count(*)::text AS documents_before FROM public.documents \gset
SELECT balance::text AS balance_before FROM public.patients WHERE id=:'patient_a1' \gset

SET LOCAL ROLE authenticated;

-- Current role policy: every valid tenant member may create/update; delete stays owner/admin only.
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
SELECT public.create_appointment(:'tenant_a',:'patient_a1',:'doctor_a1','2026-08-01 08:00+00','2026-08-01 09:00+00','A1','Owner','new','unpaid','phone',100,NULL,'ach-role-owner')->'appointment'->>'id' AS owner_appointment \gset
SELECT set_config('request.jwt.claim.sub',:'admin_a',true);
SELECT public.create_appointment(:'tenant_a',:'patient_a2',:'doctor_a2','2026-08-01 09:00+00','2026-08-01 10:00+00','A2','Admin','confirmed','card','phone',200,NULL,'ach-role-admin')->'appointment'->>'id' AS admin_appointment \gset
SELECT set_config('request.jwt.claim.sub',:'registrar_a',true);
SELECT public.create_appointment(:'tenant_a',:'patient_a2',:'doctor_a1','2026-08-01 10:00+00','2026-08-01 11:00+00','A1','Registrar','new','unpaid','walk_in',300,NULL,'ach-role-registrar')->'appointment'->>'id' AS registrar_appointment \gset
SELECT set_config('request.jwt.claim.sub',:'doctor_user_a',true);
SELECT public.create_appointment(:'tenant_a',:'patient_a1',:'doctor_a1','2026-08-01 11:00+00','2026-08-01 12:00+00','A1','Doctor','arrived','unpaid','repeat',400,NULL,'ach-role-doctor')->'appointment'->>'id' AS doctor_appointment \gset
SELECT set_config('request.jwt.claim.sub',:'cashier_a',true);
SELECT public.create_appointment(:'tenant_a',:'patient_a2',:'doctor_a1','2026-08-01 12:00+00','2026-08-01 13:00+00','A1','Cashier','in_progress','cash','phone',500,NULL,'ach-role-cashier')->'appointment'->>'id' AS cashier_appointment \gset
SELECT pg_temp.assert_true((SELECT count(*) FROM public.appointments WHERE id IN (:'owner_appointment'::uuid,:'admin_appointment'::uuid,:'registrar_appointment'::uuid,:'doctor_appointment'::uuid,:'cashier_appointment'::uuid))=5,'all current member roles create through RPC');

SELECT set_config('request.jwt.claim.sub',:'no_tenant',true);
SELECT pg_temp.expect_error(format('select public.create_appointment(%L::uuid,%L::uuid,%L::uuid,%L::timestamptz,%L::timestamptz,%L,%L,%L,%L,%L,%L::numeric,%L,%L)',:'tenant_a',:'patient_a1',:'doctor_a1','2026-08-01 14:00+00','2026-08-01 15:00+00','A1','No tenant','new','unpaid','phone','1','','ach-no-tenant'),'Недостаточно прав');
SELECT set_config('request.jwt.claim.sub',:'unknown_user',true);
SELECT pg_temp.expect_error(format('select public.create_appointment(%L::uuid,%L::uuid,%L::uuid,%L::timestamptz,%L::timestamptz,%L,%L,%L,%L,%L,%L::numeric,%L,%L)',:'tenant_a',:'patient_a1',:'doctor_a1','2026-08-01 14:00+00','2026-08-01 15:00+00','A1','Unknown role','new','unpaid','phone','1','','ach-unknown-role'),'Недостаточно прав');

SELECT set_config('request.jwt.claim.sub',:'admin_a',true);
SELECT pg_temp.expect_error(format('select public.create_appointment(%L::uuid,%L::uuid,%L::uuid,%L::timestamptz,%L::timestamptz,%L,%L,%L,%L,%L,%L::numeric,%L,%L)',:'tenant_a',:'patient_b1',:'doctor_a1','2026-08-02 08:00+00','2026-08-02 09:00+00','A1','Cross patient','new','unpaid','phone','1','','ach-cross-patient'),'Пациент недоступен');
SELECT pg_temp.expect_error(format('select public.create_appointment(%L::uuid,%L::uuid,%L::uuid,%L::timestamptz,%L::timestamptz,%L,%L,%L,%L,%L,%L::numeric,%L,%L)',:'tenant_a',:'patient_a1',:'doctor_b1','2026-08-02 08:00+00','2026-08-02 09:00+00','A1','Cross doctor','new','unpaid','phone','1','','ach-cross-doctor'),'Врач недоступен');
SELECT pg_temp.expect_error(format('select public.create_appointment(%L::uuid,%L::uuid,%L::uuid,%L::timestamptz,%L::timestamptz,%L,%L,%L,%L,%L,%L::numeric,%L,%L)',:'tenant_a',:'patient_a1',:'doctor_a1','2026-08-02 08:00+00','2026-08-02 08:00+00','A1','Zero','new','unpaid','phone','1','','ach-zero'),'Время окончания');
SELECT pg_temp.expect_error(format('select public.create_appointment(%L::uuid,%L::uuid,%L::uuid,%L::timestamptz,%L::timestamptz,%L,%L,%L,%L,%L,%L::numeric,%L,%L)',:'tenant_a',:'patient_a1',:'doctor_a1','2026-08-02 09:00+00','2026-08-02 08:00+00','A1','Negative','new','unpaid','phone','1','','ach-negative'),'Время окончания');
SELECT pg_temp.expect_error(format('select public.create_appointment(%L::uuid,%L::uuid,%L::uuid,%L::timestamptz,%L::timestamptz,%L,%L,%L,%L,%L,%L::numeric,%L,%L)',:'tenant_a',:'patient_a1',:'doctor_a1','2026-08-02 08:00+00','2026-08-02 09:00+00','A1','Bad key','new','unpaid','phone','1','','bad'),'идентификатором');

-- Half-open doctor overlap semantics.
SELECT public.create_appointment(:'tenant_a',:'patient_a1',:'doctor_a1','2026-08-02 10:00+00','2026-08-02 11:00+00','A1','Doctor anchor','new','unpaid','phone',1,NULL,'ach-doctor-anchor')->'appointment'->>'id' AS doctor_anchor \gset
SELECT pg_temp.expect_error(format('select public.create_appointment(%L::uuid,%L::uuid,%L::uuid,%L::timestamptz,%L::timestamptz,%L,%L,%L,%L,%L,%L::numeric,%L,%L)',:'tenant_a',:'patient_a2',:'doctor_a1','2026-08-02 10:00+00','2026-08-02 11:00+00','A1','Exact','new','unpaid','phone','1','','ach-doctor-exact'),'У врача уже есть запись');
SELECT pg_temp.expect_error(format('select public.create_appointment(%L::uuid,%L::uuid,%L::uuid,%L::timestamptz,%L::timestamptz,%L,%L,%L,%L,%L,%L::numeric,%L,%L)',:'tenant_a',:'patient_a2',:'doctor_a1','2026-08-02 10:30+00','2026-08-02 11:30+00','A1','Partial','new','unpaid','phone','1','','ach-doctor-partial'),'У врача уже есть запись');
SELECT pg_temp.expect_error(format('select public.create_appointment(%L::uuid,%L::uuid,%L::uuid,%L::timestamptz,%L::timestamptz,%L,%L,%L,%L,%L,%L::numeric,%L,%L)',:'tenant_a',:'patient_a2',:'doctor_a1','2026-08-02 10:15+00','2026-08-02 10:45+00','A1','Contained','new','unpaid','phone','1','','ach-doctor-contained'),'У врача уже есть запись');
SELECT pg_temp.expect_error(format('select public.create_appointment(%L::uuid,%L::uuid,%L::uuid,%L::timestamptz,%L::timestamptz,%L,%L,%L,%L,%L,%L::numeric,%L,%L)',:'tenant_a',:'patient_a2',:'doctor_a1','2026-08-02 09:30+00','2026-08-02 11:30+00','A1','Surrounding','new','unpaid','phone','1','','ach-doctor-surround'),'У врача уже есть запись');
SELECT public.create_appointment(:'tenant_a',:'patient_a2',:'doctor_a1','2026-08-02 11:00+00','2026-08-02 12:00+00','A1','Back to back','new','unpaid','phone',1,NULL,'ach-doctor-adjacent')->'appointment'->>'id' AS doctor_adjacent \gset
SELECT pg_temp.assert_true(:'doctor_adjacent' IS NOT NULL,'back-to-back create allowed');

-- Patient overlap is independent from doctor overlap.
SELECT public.create_appointment(:'tenant_a',:'patient_a3',:'doctor_a1','2026-08-03 10:00+00','2026-08-03 11:00+00','A1','Patient anchor','new','unpaid','phone',1,NULL,'ach-patient-anchor')->'appointment'->>'id' AS patient_anchor \gset
SELECT pg_temp.expect_error(format('select public.create_appointment(%L::uuid,%L::uuid,%L::uuid,%L::timestamptz,%L::timestamptz,%L,%L,%L,%L,%L,%L::numeric,%L,%L)',:'tenant_a',:'patient_a3',:'doctor_a2','2026-08-03 10:00+00','2026-08-03 11:00+00','A2','Patient exact','new','unpaid','phone','1','','ach-patient-exact'),'У пациента уже есть другая запись');
SELECT pg_temp.expect_error(format('select public.create_appointment(%L::uuid,%L::uuid,%L::uuid,%L::timestamptz,%L::timestamptz,%L,%L,%L,%L,%L,%L::numeric,%L,%L)',:'tenant_a',:'patient_a3',:'doctor_a2','2026-08-03 10:30+00','2026-08-03 11:30+00','A2','Patient partial','new','unpaid','phone','1','','ach-patient-partial'),'У пациента уже есть другая запись');
SELECT public.create_appointment(:'tenant_a',:'patient_a2',:'doctor_a2','2026-08-03 10:00+00','2026-08-03 11:00+00','A2','Different resources','new','unpaid','phone',1,NULL,'ach-different-resources')->'appointment'->>'id' AS different_resources \gset
SELECT pg_temp.assert_true(:'different_resources' IS NOT NULL,'different doctor and patient may share interval');

-- Cancelled releases slots; every other current status blocks.
SELECT public.create_appointment(:'tenant_a',:'patient_a1',:'doctor_a1','2026-08-04 08:00+00','2026-08-04 09:00+00','A1','Cancelled','cancelled','unpaid','phone',1,NULL,'ach-cancelled-anchor');
SELECT public.create_appointment(:'tenant_a',:'patient_a2',:'doctor_a1','2026-08-04 08:00+00','2026-08-04 09:00+00','A1','Cancelled released','new','unpaid','phone',1,NULL,'ach-cancelled-reuse')->'appointment'->>'id' AS cancelled_reuse \gset
SELECT pg_temp.assert_true(:'cancelled_reuse' IS NOT NULL,'cancelled appointment releases doctor slot');
SELECT public.create_appointment(:'tenant_a',:'patient_a1',:'doctor_a1','2026-08-04 10:00+00','2026-08-04 11:00+00','A1','Completed','completed','unpaid','phone',1,NULL,'ach-completed-anchor');
SELECT pg_temp.expect_error(format('select public.create_appointment(%L::uuid,%L::uuid,%L::uuid,%L::timestamptz,%L::timestamptz,%L,%L,%L,%L,%L,%L::numeric,%L,%L)',:'tenant_a',:'patient_a2',:'doctor_a1','2026-08-04 10:00+00','2026-08-04 11:00+00','A1','Completed blocks','new','unpaid','phone','1','','ach-completed-overlap'),'У врача уже есть запись');
SELECT public.create_appointment(:'tenant_a',:'patient_a1',:'doctor_a1','2026-08-04 11:00+00','2026-08-04 12:00+00','A1','No show','no_show','unpaid','phone',1,NULL,'ach-noshow-anchor');
SELECT pg_temp.expect_error(format('select public.create_appointment(%L::uuid,%L::uuid,%L::uuid,%L::timestamptz,%L::timestamptz,%L,%L,%L,%L,%L,%L::numeric,%L,%L)',:'tenant_a',:'patient_a2',:'doctor_a1','2026-08-04 11:00+00','2026-08-04 12:00+00','A1','No show blocks','new','unpaid','phone','1','','ach-noshow-overlap'),'У врача уже есть запись');
SELECT public.create_appointment(:'tenant_a',NULL,:'doctor_a2','2026-08-04 12:00+00','2026-08-04 13:00+00','A2','Blocked','blocked',NULL,NULL,NULL,NULL,'ach-blocked-anchor');
SELECT pg_temp.expect_error(format('select public.create_appointment(%L::uuid,%L::uuid,%L::uuid,%L::timestamptz,%L::timestamptz,%L,%L,%L,%L,%L,%L::numeric,%L,%L)',:'tenant_a',:'patient_a3',:'doctor_a2','2026-08-04 12:00+00','2026-08-04 13:00+00','A2','Blocked blocks','new','unpaid','phone','1','','ach-blocked-overlap'),'У врача уже есть запись');

-- Create idempotency and recovery.
SELECT public.create_appointment(:'tenant_a',:'patient_a1',:'doctor_a1','2026-08-05 08:00+00','2026-08-05 09:00+00','A1','Idempotent','new','unpaid','phone',100,'same','ach-create-replay')::text AS create_first \gset
SELECT public.create_appointment(:'tenant_a',:'patient_a1',:'doctor_a1','2026-08-05 08:00+00','2026-08-05 09:00+00','A1','Idempotent','new','unpaid','phone',100,'same','ach-create-replay')::text AS create_second \gset
SELECT pg_temp.assert_true((:'create_first'::jsonb#>>'{appointment,id}') = (:'create_second'::jsonb#>>'{appointment,id}'),'same create key returns same appointment');
SELECT pg_temp.assert_true((:'create_second'::jsonb->>'replayed')::boolean,'same create key marks replay');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.appointments WHERE id=(:'create_first'::jsonb#>>'{appointment,id}')::uuid)=1,'same create key creates one row');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.audit_events WHERE request_id='ach-create-replay' AND action='appointment_created')=1,'create replay emits one audit');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.activity_events WHERE type='appointment_created' AND metadata->>'operationKey'='ach-create-replay')=1,'create replay emits one activity');
SELECT pg_temp.expect_error(format('select public.create_appointment(%L::uuid,%L::uuid,%L::uuid,%L::timestamptz,%L::timestamptz,%L,%L,%L,%L,%L,%L::numeric,%L,%L)',:'tenant_a',:'patient_a1',:'doctor_a1','2026-08-05 09:00+00','2026-08-05 10:00+00','A1','Idempotent','new','unpaid','phone','100','same','ach-create-replay'),'другими параметрами');
SELECT pg_temp.expect_error(format('select public.create_appointment(%L::uuid,%L::uuid,%L::uuid,%L::timestamptz,%L::timestamptz,%L,%L,%L,%L,%L,%L::numeric,%L,%L)',:'tenant_a',:'patient_a2',:'doctor_a1','2026-08-05 08:00+00','2026-08-05 09:00+00','A1','Idempotent','new','unpaid','phone','100','same','ach-create-replay'),'другими параметрами');
SELECT pg_temp.expect_error(format('select public.create_appointment(%L::uuid,%L::uuid,%L::uuid,%L::timestamptz,%L::timestamptz,%L,%L,%L,%L,%L,%L::numeric,%L,%L)',:'tenant_a',:'patient_a1',:'doctor_a2','2026-08-05 08:00+00','2026-08-05 09:00+00','A2','Idempotent','new','unpaid','phone','100','same','ach-create-replay'),'другими параметрами');
SELECT pg_temp.assert_true((public.get_appointment_operation(:'tenant_a','ach-create-replay')->>'found')::boolean,'recovery finds create operation');
SELECT pg_temp.assert_true(NOT (public.get_appointment_operation(:'tenant_a','ach-unknown-key')->>'found')::boolean,'unknown recovery returns found=false');

-- Same key is tenant-scoped.
SELECT set_config('request.jwt.claim.sub',:'admin_b',true);
SELECT public.create_appointment(:'tenant_b',:'patient_b1',:'doctor_b1','2026-08-05 08:00+00','2026-08-05 09:00+00','B1','Tenant B same key','new','unpaid','phone',1,NULL,'ach-create-replay')->'appointment'->>'id' AS tenant_b_same_key \gset
SELECT pg_temp.assert_true(:'tenant_b_same_key' IS NOT NULL,'same key is independent in another tenant');
SELECT pg_temp.expect_error(format('select public.get_appointment_operation(%L::uuid,%L)',:'tenant_a','ach-create-replay'),'Недостаточно прав');
SELECT set_config('request.jwt.claim.sub',:'admin_a',true);

-- Reschedule uses optimistic target version plus old/new resource locks.
SELECT public.create_appointment(:'tenant_a',:'patient_a1',:'doctor_a1','2026-08-06 08:00+00','2026-08-06 09:00+00','A1','Move me','new','unpaid','phone',10,'before','ach-res-create')::text AS res_created \gset
SELECT (:'res_created'::jsonb#>>'{appointment,id}') AS res_id \gset
SELECT (:'res_created'::jsonb#>>'{appointment,updated_at}') AS res_updated \gset
SELECT public.reschedule_appointment(:'tenant_a',:'res_id',:'patient_a1',:'doctor_a2','2026-08-06 09:00+00','2026-08-06 10:00+00','A2','Moved','confirmed','card','repeat',20,'after',:'res_updated','ach-res-free')::text AS res_free \gset
SELECT pg_temp.assert_true((:'res_free'::jsonb#>>'{appointment,start_time}')::timestamptz='2026-08-06 09:00+00','free reschedule updates time');
SELECT pg_temp.assert_true((:'res_free'::jsonb#>>'{appointment,doctor_id}')::uuid=:'doctor_a2','free reschedule updates doctor');
SELECT public.reschedule_appointment(:'tenant_a',:'res_id',:'patient_a1',:'doctor_a2','2026-08-06 09:00+00','2026-08-06 10:00+00','A2','Moved','confirmed','card','repeat',20,'after',:'res_updated','ach-res-free')::text AS res_free_replay \gset
SELECT pg_temp.assert_true((:'res_free_replay'::jsonb->>'replayed')::boolean,'reschedule replay marked');
SELECT pg_temp.assert_true((:'res_free'::jsonb#>>'{appointment,id}') = (:'res_free_replay'::jsonb#>>'{appointment,id}'),'reschedule replay returns same appointment');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.audit_events WHERE request_id='ach-res-free' AND action='appointment_rescheduled')=1,'reschedule replay emits one audit');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.activity_events WHERE type='appointment_rescheduled' AND metadata->>'operationKey'='ach-res-free')=1,'reschedule replay emits one activity');
SELECT pg_temp.assert_true((public.get_appointment_operation(:'tenant_a','ach-res-free')->>'found')::boolean,'recovery finds reschedule operation');

SELECT (:'res_free'::jsonb#>>'{appointment,updated_at}') AS res_after_updated \gset
SELECT public.create_appointment(:'tenant_a',:'patient_a2',:'doctor_a1','2026-08-06 11:00+00','2026-08-06 12:00+00','A1','Res conflict anchor','new','unpaid','phone',1,NULL,'ach-res-anchor');
SELECT pg_temp.expect_error(format('select public.reschedule_appointment(%L::uuid,%L::uuid,%L::uuid,%L::uuid,%L::timestamptz,%L::timestamptz,%L,%L,%L,%L,%L,%L::numeric,%L,%L::timestamptz,%L)',:'tenant_a',:'res_id',:'patient_a1',:'doctor_a1','2026-08-06 11:00+00','2026-08-06 12:00+00','A1','Exact move','new','unpaid','phone','1','',:'res_after_updated','ach-res-exact'),'У врача уже есть запись');
SELECT pg_temp.expect_error(format('select public.reschedule_appointment(%L::uuid,%L::uuid,%L::uuid,%L::uuid,%L::timestamptz,%L::timestamptz,%L,%L,%L,%L,%L,%L::numeric,%L,%L::timestamptz,%L)',:'tenant_a',:'res_id',:'patient_a1',:'doctor_a1','2026-08-06 11:30+00','2026-08-06 12:30+00','A1','Partial move','new','unpaid','phone','1','',:'res_after_updated','ach-res-partial'),'У врача уже есть запись');
SELECT public.reschedule_appointment(:'tenant_a',:'res_id',:'patient_a1',:'doctor_a2','2026-08-06 09:00+00','2026-08-06 10:00+00','A2','Self exclude','confirmed','card','repeat',20,'self',:'res_after_updated','ach-res-self')::text AS res_self \gset
SELECT pg_temp.assert_true((:'res_self'::jsonb#>>'{appointment,id}')=:'res_id','reschedule excludes itself');
SELECT (:'res_self'::jsonb#>>'{appointment,updated_at}') AS res_self_updated \gset
SELECT public.reschedule_appointment(:'tenant_a',:'res_id',:'patient_a1',:'doctor_a1','2026-08-06 12:00+00','2026-08-06 13:00+00','A1','Adjacent move','new','unpaid','phone',1,NULL,:'res_self_updated','ach-res-adjacent')::text AS res_adjacent \gset
SELECT pg_temp.assert_true((:'res_adjacent'::jsonb#>>'{appointment,start_time}')::timestamptz='2026-08-06 12:00+00','back-to-back reschedule allowed');
SELECT (:'res_adjacent'::jsonb#>>'{appointment,updated_at}') AS res_adjacent_updated \gset
SELECT pg_temp.expect_error(format('select public.reschedule_appointment(%L::uuid,%L::uuid,%L::uuid,%L::uuid,%L::timestamptz,%L::timestamptz,%L,%L,%L,%L,%L,%L::numeric,%L,%L::timestamptz,%L)',:'tenant_b',:'res_id',:'patient_b1',:'doctor_b1','2026-08-06 14:00+00','2026-08-06 15:00+00','B1','Cross tenant res','new','unpaid','phone','1','',:'res_adjacent_updated','ach-cross-res'),'Недостаточно прав');

-- Details/status update cannot mutate protected fields and reactivation checks conflicts.
SELECT public.update_appointment_details(:'tenant_a',:'res_id','A1','Details only','cancelled','unpaid','phone',30,'cancelled',:'res_adjacent_updated')::text AS details_cancel \gset
SELECT pg_temp.assert_true((:'details_cancel'::jsonb#>>'{appointment,status}')='cancelled','details RPC updates status');
SELECT (:'details_cancel'::jsonb#>>'{appointment,updated_at}') AS details_cancel_updated \gset
SELECT public.create_appointment(:'tenant_a',:'patient_a3',:'doctor_a1','2026-08-06 12:00+00','2026-08-06 13:00+00','A1','Released by cancel','new','unpaid','phone',1,NULL,'ach-released-after-cancel')->'appointment'->>'id' AS released_after_cancel \gset
SELECT pg_temp.assert_true(:'released_after_cancel' IS NOT NULL,'controlled cancellation releases slot');
SELECT pg_temp.expect_error(format('select public.update_appointment_details(%L::uuid,%L::uuid,%L,%L,%L,%L,%L,%L::numeric,%L,%L::timestamptz)',:'tenant_a',:'res_id','A1','Reactivate','new','unpaid','phone','30','reactivate',:'details_cancel_updated'),'У врача уже есть запись');

-- Concurrent-change message from optimistic expected_updated_at.
SELECT public.create_appointment(:'tenant_a',:'patient_a1',:'doctor_a2','2026-08-07 08:00+00','2026-08-07 09:00+00','A2','Concurrent version','new','unpaid','phone',1,NULL,'ach-version-create')::text AS version_create \gset
SELECT (:'version_create'::jsonb#>>'{appointment,id}') AS version_id \gset
SELECT (:'version_create'::jsonb#>>'{appointment,updated_at}') AS version_old \gset
SELECT public.update_appointment_details(:'tenant_a',:'version_id','A2','Changed elsewhere','confirmed','unpaid','phone',1,NULL,:'version_old')::text AS version_changed \gset
SELECT pg_temp.expect_error(format('select public.reschedule_appointment(%L::uuid,%L::uuid,%L::uuid,%L::uuid,%L::timestamptz,%L::timestamptz,%L,%L,%L,%L,%L,%L::numeric,%L,%L::timestamptz,%L)',:'tenant_a',:'version_id',:'patient_a1',:'doctor_a2','2026-08-07 09:00+00','2026-08-07 10:00+00','A2','Stale move','new','unpaid','phone','1','',:'version_old','ach-version-stale'),'Запись была изменена другим пользователем');

-- Direct protected writes are closed; read and current hard-delete behavior remain.
SELECT pg_temp.expect_error(format('insert into public.appointments(tenant_id,patient_id,doctor_id,start_time,end_time,status) values(%L::uuid,%L::uuid,%L::uuid,%L::timestamptz,%L::timestamptz,%L)',:'tenant_a',:'patient_a1',:'doctor_a1','2026-08-08 08:00+00','2026-08-08 09:00+00','new'),'Недостаточно прав');
SELECT pg_temp.expect_error(format('update public.appointments set start_time=%L::timestamptz where id=%L::uuid','2026-08-01 07:00+00',:'owner_appointment'),'Недостаточно прав');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.appointments WHERE tenant_id=:'tenant_a')>0,'authenticated read access remains');
SELECT set_config('request.jwt.claim.sub',:'registrar_a',true);
DELETE FROM public.appointments WHERE id=:'owner_appointment';
SELECT pg_temp.assert_true((SELECT count(*) FROM public.appointments WHERE id=:'owner_appointment')=1,'registrar cannot hard delete');
SELECT set_config('request.jwt.claim.sub',:'admin_a',true);
DELETE FROM public.appointments WHERE id=:'owner_appointment';
SELECT pg_temp.assert_true((SELECT count(*) FROM public.appointments WHERE id=:'owner_appointment')=0,'admin current hard delete remains');
SELECT pg_temp.assert_true((public.get_appointment_operation(:'tenant_a','ach-role-owner')->>'found')::boolean,'hard-deleted appointment operation remains recoverable without key reuse');

RESET ROLE;
SET LOCAL ROLE anon;
SELECT pg_temp.expect_error(format('select public.create_appointment(%L::uuid,%L::uuid,%L::uuid,%L::timestamptz,%L::timestamptz,%L,%L,%L,%L,%L,%L::numeric,%L,%L)',:'tenant_a',:'patient_a1',:'doctor_a1','2026-08-09 08:00+00','2026-08-09 09:00+00','A1','Anon','new','unpaid','phone','1','','ach-anon'),'permission denied');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT count(*) FROM public.appointment_operations WHERE tenant_id=:'tenant_a' AND operation_key='ach-role-owner' AND appointment_id IS NULL)=1,'hard delete preserves operation-key history');

-- Catalog and invariant assertions.
SELECT pg_temp.assert_true((SELECT relrowsecurity FROM pg_class WHERE oid='public.appointments'::regclass),'appointments RLS remains enabled');
SELECT pg_temp.assert_true((SELECT relrowsecurity FROM pg_class WHERE oid='public.appointment_operations'::regclass),'operation table RLS enabled');
SELECT pg_temp.assert_true(has_table_privilege('authenticated','public.appointments','SELECT'),'authenticated appointment read granted');
SELECT pg_temp.assert_true(has_table_privilege('authenticated','public.appointments','DELETE'),'authenticated delete grant retained for RLS');
SELECT pg_temp.assert_true(has_table_privilege('authenticated','public.appointments','INSERT'),'authenticated legacy insert grant preserved');
SELECT pg_temp.assert_true(has_table_privilege('authenticated','public.appointments','UPDATE'),'authenticated legacy update grant preserved');
SELECT pg_temp.assert_true(EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.appointments'::regclass AND tgname='appointments_authoritative_write_guard' AND NOT tgisinternal),'authoritative direct-write trigger installed');
SELECT pg_temp.assert_true(NOT has_table_privilege('authenticated','public.appointment_operations','SELECT'),'operations hidden from browser');
SELECT pg_temp.assert_true(has_function_privilege('authenticated','public.create_appointment(uuid,uuid,uuid,timestamptz,timestamptz,text,text,text,text,text,numeric,text,text)','EXECUTE'),'create RPC executable');
SELECT pg_temp.assert_true(has_function_privilege('authenticated','public.reschedule_appointment(uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,text,text,text,text,numeric,text,timestamptz,text)','EXECUTE'),'reschedule RPC executable');
SELECT pg_temp.assert_true(has_function_privilege('authenticated','public.update_appointment_details(uuid,uuid,text,text,text,text,text,numeric,text,timestamptz)','EXECUTE'),'details RPC executable');
SELECT pg_temp.assert_true(has_function_privilege('authenticated','public.get_appointment_operation(uuid,text)','EXECUTE'),'recovery RPC executable');
SELECT pg_temp.assert_true(NOT has_function_privilege('anon','public.create_appointment(uuid,uuid,uuid,timestamptz,timestamptz,text,text,text,text,text,numeric,text,text)','EXECUTE'),'anon create execute denied');
SELECT pg_temp.assert_true(EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.appointments'::regclass AND conname='appointments_tenant_id_patient_id_fkey' AND contype='f'),'patient composite tenant FK preserved');
SELECT pg_temp.assert_true(EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.appointments'::regclass AND conname='appointments_tenant_id_doctor_id_fkey' AND contype='f'),'doctor composite tenant FK preserved');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.appointments WHERE end_time<=start_time)=0,'no invalid intervals');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.appointment_operations GROUP BY tenant_id,operation_key HAVING count(*)>1 LIMIT 1) IS NULL,'no duplicate operation keys');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.appointments a JOIN public.appointments b ON b.id>a.id AND b.tenant_id=a.tenant_id AND b.doctor_id=a.doctor_id AND a.status<>'cancelled' AND b.status<>'cancelled' AND b.start_time<a.end_time AND b.end_time>a.start_time)=0,'zero active doctor overlap pairs');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.appointments a JOIN public.appointments b ON b.id>a.id AND b.tenant_id=a.tenant_id AND b.patient_id=a.patient_id AND a.patient_id IS NOT NULL AND a.status<>'cancelled' AND b.status<>'cancelled' AND b.start_time<a.end_time AND b.end_time>a.start_time)=0,'zero active patient overlap pairs');

-- Appointment is not a clinical or financial fact.
SELECT pg_temp.assert_true((SELECT count(*) FROM public.patient_visits)=:'visits_before'::integer,'no visit created');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.clinical_encounters)=:'encounters_before'::integer,'no encounter created');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.completed_services)=:'services_before'::integer,'no completed service created');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.treatment_plans)=:'plans_before'::integer,'no treatment plan mutation');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.findings)=:'findings_before'::integer,'no finding mutation');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.dental_charts)=:'charts_before'::integer,'no dental chart mutation');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.invoices)=:'invoices_before'::integer,'no invoice created');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.payments)=:'payments_before'::integer,'no payment created');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.refunds)=:'refunds_before'::integer,'no refund created');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.financial_adjustments)=:'adjustments_before'::integer,'no write-off created');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.documents)=:'documents_before'::integer,'no document created');
SELECT pg_temp.assert_true((SELECT balance FROM public.patients WHERE id=:'patient_a1')=:'balance_before'::numeric,'patient balance unchanged');

ROLLBACK;
\echo 'APPOINTMENT-CONFLICT-HARDENING-001 SQL validation passed'
