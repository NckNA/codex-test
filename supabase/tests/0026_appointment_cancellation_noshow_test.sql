\set ON_ERROR_STOP on
\echo 'APPOINTMENT-CANCELLATION-NOSHOW-001 local SQL validation'

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

\set tenant_a 'a2610000-0000-4000-8000-000000000001'
\set tenant_b 'b2610000-0000-4000-8000-000000000001'
\set owner_a 'a2620000-0000-4000-8000-000000000001'
\set admin_a 'a2620000-0000-4000-8000-000000000002'
\set registrar_a 'a2620000-0000-4000-8000-000000000003'
\set doctor_user_a 'a2620000-0000-4000-8000-000000000004'
\set cashier_a 'a2620000-0000-4000-8000-000000000005'
\set no_tenant 'a2620000-0000-4000-8000-000000000006'
\set unknown_user 'a2620000-0000-4000-8000-000000000007'
\set admin_b 'b2620000-0000-4000-8000-000000000001'
\set patient_a1 'a2630000-0000-4000-8000-000000000001'
\set patient_a2 'a2630000-0000-4000-8000-000000000002'
\set patient_a3 'a2630000-0000-4000-8000-000000000003'
\set patient_b1 'b2630000-0000-4000-8000-000000000001'
\set doctor_a1 'a2640000-0000-4000-8000-000000000001'
\set doctor_a2 'a2640000-0000-4000-8000-000000000002'
\set doctor_b1 'b2640000-0000-4000-8000-000000000001'
\set legacy_cancelled 'a2650000-0000-4000-8000-000000000001'
\set legacy_no_show 'a2650000-0000-4000-8000-000000000002'

INSERT INTO public.tenants(id,name) VALUES
  (:'tenant_a','Appointment lifecycle A'),
  (:'tenant_b','Appointment lifecycle B');

INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) VALUES
  (:'owner_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','acn-owner@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'admin_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','acn-admin@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'registrar_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','acn-registrar@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'doctor_user_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','acn-doctor@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'cashier_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','acn-cashier@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'no_tenant','00000000-0000-0000-0000-000000000000','authenticated','authenticated','acn-notenant@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'unknown_user','00000000-0000-0000-0000-000000000000','authenticated','authenticated','acn-unknown@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'admin_b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','acn-admin-b@example.local','x',now(),'{"provider":"email"}','{}',now(),now());

INSERT INTO public.profiles(id,first_name,last_name) VALUES
  (:'owner_a','Owner','A'),(:'admin_a','Admin','A'),(:'registrar_a','Registrar','A'),
  (:'doctor_user_a','Doctor','A'),(:'cashier_a','Cashier','A'),(:'no_tenant','No','Tenant'),
  (:'unknown_user','Unknown','User'),(:'admin_b','Admin','B');

INSERT INTO public.tenant_users(tenant_id,user_id,role) VALUES
  (:'tenant_a',:'owner_a','clinic_owner'),
  (:'tenant_a',:'admin_a','clinic_admin'),
  (:'tenant_a',:'registrar_a','registrar'),
  (:'tenant_a',:'doctor_user_a','doctor'),
  (:'tenant_a',:'cashier_a','cashier'),
  (:'tenant_b',:'admin_b','clinic_admin');

INSERT INTO public.patients(id,tenant_id,full_name,phone,source,status,balance) VALUES
  (:'patient_a1',:'tenant_a','ACN Patient A1','+77002630001','phone','active',321),
  (:'patient_a2',:'tenant_a','ACN Patient A2','+77002630002','phone','active',654),
  (:'patient_a3',:'tenant_a','ACN Patient A3','+77002630003','phone','active',987),
  (:'patient_b1',:'tenant_b','ACN Patient B1','+77002630004','phone','active',111);

INSERT INTO public.doctors(id,tenant_id,user_id,full_name,specialization,cabinet,color,active) VALUES
  (:'doctor_a1',:'tenant_a',:'doctor_user_a','ACN Doctor A1','General','A1','#111111',true),
  (:'doctor_a2',:'tenant_a',NULL,'ACN Doctor A2','Surgery','A2','#222222',true),
  (:'doctor_b1',:'tenant_b',NULL,'ACN Doctor B1','General','B1','#333333',true);

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
SELECT balance::text AS balance_a1_before FROM public.patients WHERE id=:'patient_a1' \gset
SELECT balance::text AS balance_a2_before FROM public.patients WHERE id=:'patient_a2' \gset

-- Historical compatibility: terminal rows existing before 0026 remain version 0
-- without fabricated actor/reason/timestamp metadata.
SET LOCAL ROLE service_role;
INSERT INTO public.appointments(id,tenant_id,patient_id,doctor_id,cabinet,service,status,start_time,end_time)
VALUES
  (:'legacy_cancelled',:'tenant_a',:'patient_a1',:'doctor_a1','A1','Legacy cancelled','cancelled','2026-10-01 08:00+00','2026-10-01 09:00+00'),
  (:'legacy_no_show',:'tenant_a',:'patient_a2',:'doctor_a2','A2','Legacy no-show','no_show','2026-10-01 10:00+00','2026-10-01 11:00+00');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT lifecycle_metadata_version=0 AND cancelled_at IS NULL AND cancellation_reason IS NULL FROM public.appointments WHERE id=:'legacy_cancelled'),'legacy cancelled row preserved without invented metadata');
SELECT pg_temp.assert_true((SELECT lifecycle_metadata_version=0 AND no_show_at IS NULL AND no_show_reason IS NULL FROM public.appointments WHERE id=:'legacy_no_show'),'legacy no-show row preserved without invented metadata');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);

-- Owner cancels a new appointment and complete lifecycle metadata is stored.
SELECT public.create_appointment(:'tenant_a',:'patient_a1',:'doctor_a1','2026-10-02 08:00+00','2026-10-02 09:00+00','A1','Owner cancel','new','unpaid','phone',100,'before cancel','acn-owner-cancel-create')::text AS owner_create \gset
SELECT (:'owner_create'::jsonb#>>'{appointment,id}') AS owner_cancel_id \gset
SELECT (:'owner_create'::jsonb#>>'{appointment,updated_at}') AS owner_cancel_updated \gset
SELECT public.cancel_appointment(:'tenant_a',:'owner_cancel_id','patient','Patient requested cancellation',:'owner_cancel_updated','acn-owner-cancel')::text AS owner_cancel \gset
SELECT pg_temp.assert_true((:'owner_cancel'::jsonb#>>'{appointment,status}')='cancelled','owner cancels new appointment');
SELECT pg_temp.assert_true((:'owner_cancel'::jsonb#>>'{appointment,cancellation_source}')='patient','cancellation source stored');
SELECT pg_temp.assert_true((:'owner_cancel'::jsonb#>>'{appointment,cancellation_reason}')='Patient requested cancellation','cancellation reason stored trimmed');
SELECT pg_temp.assert_true((:'owner_cancel'::jsonb#>>'{appointment,cancelled_by}')::uuid=:'owner_a','cancelled_by stored');
SELECT pg_temp.assert_true((:'owner_cancel'::jsonb#>>'{appointment,cancelled_at}')::timestamptz IS NOT NULL,'cancelled_at stored');
SELECT pg_temp.assert_true((:'owner_cancel'::jsonb#>>'{appointment,lifecycle_metadata_version}')::integer=1,'controlled cancellation version stored');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.appointments WHERE id=:'owner_cancel_id')=1,'cancelled appointment row preserved');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT count(*) FROM public.appointment_operations WHERE tenant_id=:'tenant_a' AND operation_key='acn-owner-cancel' AND operation_type='cancel')=1,'cancellation creates one operation row');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
SELECT pg_temp.assert_true((SELECT count(*) FROM public.audit_events WHERE request_id='acn-owner-cancel' AND action='appointment_cancelled')=1,'cancellation creates one audit event');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.activity_events WHERE type='appointment_cancelled' AND metadata->>'operationKey'='acn-owner-cancel')=1,'cancellation creates one activity event');

-- Same-key replay is safe and changed payloads are rejected.
SELECT public.cancel_appointment(:'tenant_a',:'owner_cancel_id','patient','Patient requested cancellation',:'owner_cancel_updated','acn-owner-cancel')::text AS owner_cancel_replay \gset
SELECT pg_temp.assert_true((:'owner_cancel_replay'::jsonb->>'replayed')::boolean,'same cancellation key marks replay');
SELECT pg_temp.assert_true((:'owner_cancel_replay'::jsonb#>>'{appointment,id}')=:'owner_cancel_id','same cancellation key returns same appointment');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.audit_events WHERE request_id='acn-owner-cancel')=1,'replay creates no duplicate audit');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.activity_events WHERE metadata->>'operationKey'='acn-owner-cancel')=1,'replay creates no duplicate activity');
SELECT pg_temp.expect_error(format('select public.cancel_appointment(%L::uuid,%L::uuid,%L,%L,%L::timestamptz,%L)',:'tenant_a',:'owner_cancel_id','patient','Changed reason',:'owner_cancel_updated','acn-owner-cancel'),'другими параметрами');
SELECT pg_temp.expect_error(format('select public.cancel_appointment(%L::uuid,%L::uuid,%L,%L,%L::timestamptz,%L)',:'tenant_a',:'owner_cancel_id','clinic','Patient requested cancellation',:'owner_cancel_updated','acn-owner-cancel'),'другими параметрами');

-- Cancelled row releases both doctor and patient resources.
SELECT public.create_appointment(:'tenant_a',:'patient_a2',:'doctor_a1','2026-10-02 08:00+00','2026-10-02 09:00+00','A1','Doctor slot reused','new','unpaid','phone',1,NULL,'acn-reuse-doctor')->'appointment'->>'id' AS reused_doctor \gset
SELECT public.create_appointment(:'tenant_a',:'patient_a1',:'doctor_a2','2026-10-02 08:00+00','2026-10-02 09:00+00','A2','Patient slot reused','new','unpaid','phone',1,NULL,'acn-reuse-patient')->'appointment'->>'id' AS reused_patient \gset
SELECT pg_temp.assert_true(:'reused_doctor' IS NOT NULL AND :'reused_patient' IS NOT NULL,'cancelled row releases doctor and patient slots');

-- Admin and registrar follow intended policy.
SELECT set_config('request.jwt.claim.sub',:'admin_a',true);
SELECT public.create_appointment(:'tenant_a',:'patient_a1',:'doctor_a1','2026-10-03 08:00+00','2026-10-03 09:00+00','A1','Admin confirmed','confirmed','unpaid','phone',1,NULL,'acn-admin-cancel-create')::text AS admin_create \gset
SELECT public.cancel_appointment(:'tenant_a',(:'admin_create'::jsonb#>>'{appointment,id}')::uuid,'clinic','Clinic schedule changed',(:'admin_create'::jsonb#>>'{appointment,updated_at}')::timestamptz,'acn-admin-cancel')->>'operationType' AS admin_cancel_type \gset
SELECT pg_temp.assert_true(:'admin_cancel_type'='cancel','admin cancels confirmed appointment');

SELECT set_config('request.jwt.claim.sub',:'registrar_a',true);
SELECT public.create_appointment(:'tenant_a',:'patient_a1',:'doctor_a1','2026-10-03 10:00+00','2026-10-03 11:00+00','A1','Registrar new','new','unpaid','phone',1,NULL,'acn-registrar-cancel-create')::text AS registrar_create \gset
SELECT public.cancel_appointment(:'tenant_a',(:'registrar_create'::jsonb#>>'{appointment,id}')::uuid,'doctor','Doctor unavailable',(:'registrar_create'::jsonb#>>'{appointment,updated_at}')::timestamptz,'acn-registrar-cancel')->>'operationType' AS registrar_cancel_type \gset
SELECT pg_temp.assert_true(:'registrar_cancel_type'='cancel','registrar may cancel');

-- Doctor, cashier, unknown/no-tenant and cross-tenant callers are blocked.
SELECT set_config('request.jwt.claim.sub',:'admin_a',true);
SELECT public.create_appointment(:'tenant_a',:'patient_a1',:'doctor_a1','2026-10-04 08:00+00','2026-10-04 09:00+00','A1','Role cancel target','new','unpaid','phone',1,NULL,'acn-role-cancel-create')::text AS role_cancel_create \gset
SELECT (:'role_cancel_create'::jsonb#>>'{appointment,id}') AS role_cancel_id \gset
SELECT (:'role_cancel_create'::jsonb#>>'{appointment,updated_at}') AS role_cancel_updated \gset
SELECT set_config('request.jwt.claim.sub',:'doctor_user_a',true);
SELECT pg_temp.expect_error(format('select public.cancel_appointment(%L::uuid,%L::uuid,%L,%L,%L::timestamptz,%L)',:'tenant_a',:'role_cancel_id','patient','Doctor tries',:'role_cancel_updated','acn-doctor-cancel'),'Недостаточно прав');
SELECT set_config('request.jwt.claim.sub',:'cashier_a',true);
SELECT pg_temp.expect_error(format('select public.cancel_appointment(%L::uuid,%L::uuid,%L,%L,%L::timestamptz,%L)',:'tenant_a',:'role_cancel_id','patient','Cashier tries',:'role_cancel_updated','acn-cashier-cancel'),'Недостаточно прав');
SELECT set_config('request.jwt.claim.sub',:'no_tenant',true);
SELECT pg_temp.expect_error(format('select public.cancel_appointment(%L::uuid,%L::uuid,%L,%L,%L::timestamptz,%L)',:'tenant_a',:'role_cancel_id','patient','No tenant tries',:'role_cancel_updated','acn-no-tenant-cancel'),'Недостаточно прав');
SELECT set_config('request.jwt.claim.sub',:'unknown_user',true);
SELECT pg_temp.expect_error(format('select public.cancel_appointment(%L::uuid,%L::uuid,%L,%L,%L::timestamptz,%L)',:'tenant_a',:'role_cancel_id','patient','Unknown tries',:'role_cancel_updated','acn-unknown-cancel'),'Недостаточно прав');
SELECT set_config('request.jwt.claim.sub',:'admin_b',true);
SELECT pg_temp.expect_error(format('select public.cancel_appointment(%L::uuid,%L::uuid,%L,%L,%L::timestamptz,%L)',:'tenant_a',:'role_cancel_id','patient','Cross tenant tries',:'role_cancel_updated','acn-cross-cancel'),'Недостаточно прав');

-- Required source/reason and transition protection.
SELECT set_config('request.jwt.claim.sub',:'admin_a',true);
SELECT pg_temp.expect_error(format('select public.cancel_appointment(%L::uuid,%L::uuid,%L,%L,%L::timestamptz,%L)',:'tenant_a',:'role_cancel_id','','Reason',:'role_cancel_updated','acn-source-empty'),'Укажите, кто отменил');
SELECT pg_temp.expect_error(format('select public.cancel_appointment(%L::uuid,%L::uuid,%L,%L,%L::timestamptz,%L)',:'tenant_a',:'role_cancel_id','invalid','Reason',:'role_cancel_updated','acn-source-invalid'),'Укажите, кто отменил');
SELECT pg_temp.expect_error(format('select public.cancel_appointment(%L::uuid,%L::uuid,%L,%L,%L::timestamptz,%L)',:'tenant_a',:'role_cancel_id','patient','',:'role_cancel_updated','acn-reason-empty'),'Укажите причину');
SELECT pg_temp.expect_error(format('select public.cancel_appointment(%L::uuid,%L::uuid,%L,%L,%L::timestamptz,%L)',:'tenant_a',:'role_cancel_id','patient','   ',:'role_cancel_updated','acn-reason-space'),'Укажите причину');

SELECT public.create_appointment(:'tenant_a',:'patient_a1',:'doctor_a1','2026-10-05 08:00+00','2026-10-05 09:00+00','A1','Completed cancel blocked','completed','unpaid','phone',1,NULL,'acn-completed-cancel-create')::text AS completed_cancel \gset
SELECT pg_temp.expect_error(format('select public.cancel_appointment(%L::uuid,%L::uuid,%L,%L,%L::timestamptz,%L)',:'tenant_a',(:'completed_cancel'::jsonb#>>'{appointment,id}'),'clinic','Not allowed',(:'completed_cancel'::jsonb#>>'{appointment,updated_at}'),'acn-completed-cancel'),'Текущий статус');
SELECT public.create_appointment(:'tenant_a',:'patient_a1',:'doctor_a1','2026-10-05 10:00+00','2026-10-05 11:00+00','A1','Progress cancel blocked','in_progress','unpaid','phone',1,NULL,'acn-progress-cancel-create')::text AS progress_cancel \gset
SELECT pg_temp.expect_error(format('select public.cancel_appointment(%L::uuid,%L::uuid,%L,%L,%L::timestamptz,%L)',:'tenant_a',(:'progress_cancel'::jsonb#>>'{appointment,id}'),'clinic','Not allowed',(:'progress_cancel'::jsonb#>>'{appointment,updated_at}'),'acn-progress-cancel'),'Текущий статус');
SELECT public.create_appointment(:'tenant_a',:'patient_a1',:'doctor_a1','2026-10-05 12:00+00','2026-10-05 13:00+00','A1','Arrived cancel blocked','arrived','unpaid','phone',1,NULL,'acn-arrived-cancel-create')::text AS arrived_cancel \gset
SELECT pg_temp.expect_error(format('select public.cancel_appointment(%L::uuid,%L::uuid,%L,%L,%L::timestamptz,%L)',:'tenant_a',(:'arrived_cancel'::jsonb#>>'{appointment,id}'),'clinic','Not allowed',(:'arrived_cancel'::jsonb#>>'{appointment,updated_at}'),'acn-arrived-cancel'),'Текущий статус');

-- Generic create/reschedule/details cannot manufacture lifecycle statuses.
SELECT pg_temp.expect_error(format('select public.create_appointment(%L::uuid,%L::uuid,%L::uuid,%L::timestamptz,%L::timestamptz,%L,%L,%L,%L,%L,%L::numeric,%L,%L)',:'tenant_a',:'patient_a1',:'doctor_a1','2026-10-06 08:00+00','2026-10-06 09:00+00','A1','Generic cancelled','cancelled','unpaid','phone','1','','acn-generic-create-cancel'),'Текущий статус');
SELECT pg_temp.expect_error(format('select public.create_appointment(%L::uuid,%L::uuid,%L::uuid,%L::timestamptz,%L::timestamptz,%L,%L,%L,%L,%L,%L::numeric,%L,%L)',:'tenant_a',:'patient_a1',:'doctor_a1','2026-10-06 08:00+00','2026-10-06 09:00+00','A1','Generic no-show','no_show','unpaid','phone','1','','acn-generic-create-noshow'),'Текущий статус');
SELECT public.create_appointment(:'tenant_a',:'patient_a1',:'doctor_a1','2026-10-06 10:00+00','2026-10-06 11:00+00','A1','Generic details target','new','unpaid','phone',1,NULL,'acn-generic-target')::text AS generic_target \gset
SELECT pg_temp.expect_error(format('select public.update_appointment_details(%L::uuid,%L::uuid,%L,%L,%L,%L,%L,%L::numeric,%L,%L::timestamptz)',:'tenant_a',(:'generic_target'::jsonb#>>'{appointment,id}'),'A1','Generic details','cancelled','unpaid','phone','1','',(:'generic_target'::jsonb#>>'{appointment,updated_at}')),'Текущий статус');
SELECT pg_temp.expect_error(format('select public.update_appointment_details(%L::uuid,%L::uuid,%L,%L,%L,%L,%L,%L::numeric,%L,%L::timestamptz)',:'tenant_a',(:'generic_target'::jsonb#>>'{appointment,id}'),'A1','Generic details','no_show','unpaid','phone','1','',(:'generic_target'::jsonb#>>'{appointment,updated_at}')),'Текущий статус');
SELECT pg_temp.expect_error(format('select public.reschedule_appointment(%L::uuid,%L::uuid,%L::uuid,%L::uuid,%L::timestamptz,%L::timestamptz,%L,%L,%L,%L,%L,%L::numeric,%L,%L::timestamptz,%L)',:'tenant_a',(:'generic_target'::jsonb#>>'{appointment,id}'),:'patient_a1',:'doctor_a1','2026-10-06 11:00+00','2026-10-06 12:00+00','A1','Generic reschedule','cancelled','unpaid','phone','1','',(:'generic_target'::jsonb#>>'{appointment,updated_at}'),'acn-generic-reschedule'),'Текущий статус');

-- No-show controlled action from new and confirmed statuses.
SELECT public.create_appointment(:'tenant_a',:'patient_a2',:'doctor_a1','2026-10-07 08:00+00','2026-10-07 09:00+00','A1','No-show new','new','unpaid','phone',1,NULL,'acn-noshow-new-create')::text AS noshow_new_create \gset
SELECT public.mark_appointment_no_show(:'tenant_a',(:'noshow_new_create'::jsonb#>>'{appointment,id}')::uuid,'Patient did not arrive',(:'noshow_new_create'::jsonb#>>'{appointment,updated_at}')::timestamptz,'acn-noshow-new')::text AS noshow_new \gset
SELECT pg_temp.assert_true((:'noshow_new'::jsonb#>>'{appointment,status}')='no_show','new appointment marked no-show');
SELECT pg_temp.assert_true((:'noshow_new'::jsonb#>>'{appointment,no_show_reason}')='Patient did not arrive','no-show reason stored');
SELECT pg_temp.assert_true((:'noshow_new'::jsonb#>>'{appointment,no_show_by}')::uuid=:'admin_a','no_show_by stored');
SELECT pg_temp.assert_true((:'noshow_new'::jsonb#>>'{appointment,no_show_at}')::timestamptz IS NOT NULL,'no_show_at stored');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.appointments WHERE id=(:'noshow_new'::jsonb#>>'{appointment,id}')::uuid)=1,'no-show row preserved');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT count(*) FROM public.appointment_operations WHERE operation_key='acn-noshow-new' AND operation_type='no_show')=1,'no-show creates one operation');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'admin_a',true);
SELECT pg_temp.assert_true((SELECT count(*) FROM public.audit_events WHERE request_id='acn-noshow-new' AND action='appointment_no_show_marked')=1,'no-show creates one audit');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.activity_events WHERE metadata->>'operationKey'='acn-noshow-new' AND type='appointment_no_show_marked')=1,'no-show creates one activity');

SELECT public.mark_appointment_no_show(:'tenant_a',(:'noshow_new_create'::jsonb#>>'{appointment,id}')::uuid,'Patient did not arrive',(:'noshow_new_create'::jsonb#>>'{appointment,updated_at}')::timestamptz,'acn-noshow-new')::text AS noshow_replay \gset
SELECT pg_temp.assert_true((:'noshow_replay'::jsonb->>'replayed')::boolean,'same no-show key replays');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.audit_events WHERE request_id='acn-noshow-new')=1,'no-show replay has one audit');
SELECT pg_temp.expect_error(format('select public.mark_appointment_no_show(%L::uuid,%L::uuid,%L,%L::timestamptz,%L)',:'tenant_a',(:'noshow_new_create'::jsonb#>>'{appointment,id}'),'Changed reason',(:'noshow_new_create'::jsonb#>>'{appointment,updated_at}'),'acn-noshow-new'),'другими параметрами');

SELECT public.create_appointment(:'tenant_a',:'patient_a2',:'doctor_a2','2026-10-07 10:00+00','2026-10-07 11:00+00','A2','No-show confirmed','confirmed','unpaid','phone',1,NULL,'acn-noshow-confirmed-create')::text AS noshow_confirmed_create \gset
SELECT set_config('request.jwt.claim.sub',:'registrar_a',true);
SELECT public.mark_appointment_no_show(:'tenant_a',(:'noshow_confirmed_create'::jsonb#>>'{appointment,id}')::uuid,'Unable to contact patient',(:'noshow_confirmed_create'::jsonb#>>'{appointment,updated_at}')::timestamptz,'acn-noshow-confirmed')->>'operationType' AS registrar_noshow_type \gset
SELECT pg_temp.assert_true(:'registrar_noshow_type'='no_show','registrar marks confirmed no-show');

-- No-show continues to block doctor and patient slots under existing policy.
SELECT set_config('request.jwt.claim.sub',:'admin_a',true);
SELECT pg_temp.expect_error(format('select public.create_appointment(%L::uuid,%L::uuid,%L::uuid,%L::timestamptz,%L::timestamptz,%L,%L,%L,%L,%L,%L::numeric,%L,%L)',:'tenant_a',:'patient_a3',:'doctor_a1','2026-10-07 08:00+00','2026-10-07 09:00+00','A1','No-show doctor overlap','new','unpaid','phone','1','','acn-noshow-doctor-overlap'),'У врача уже есть запись');
SELECT pg_temp.expect_error(format('select public.create_appointment(%L::uuid,%L::uuid,%L::uuid,%L::timestamptz,%L::timestamptz,%L,%L,%L,%L,%L,%L::numeric,%L,%L)',:'tenant_a',:'patient_a2',:'doctor_a2','2026-10-07 08:00+00','2026-10-07 09:00+00','A2','No-show patient overlap','new','unpaid','phone','1','','acn-noshow-patient-overlap-2'),'У пациента уже есть другая запись');

-- No-show validation, role and transition matrix.
SELECT public.create_appointment(:'tenant_a',:'patient_a3',:'doctor_a1','2026-10-08 08:00+00','2026-10-08 09:00+00','A1','Role no-show target','new','unpaid','phone',1,NULL,'acn-role-noshow-create')::text AS role_noshow \gset
SELECT pg_temp.expect_error(format('select public.mark_appointment_no_show(%L::uuid,%L::uuid,%L,%L::timestamptz,%L)',:'tenant_a',(:'role_noshow'::jsonb#>>'{appointment,id}'),'   ',(:'role_noshow'::jsonb#>>'{appointment,updated_at}'),'acn-noshow-empty'),'Укажите причину');
SELECT set_config('request.jwt.claim.sub',:'doctor_user_a',true);
SELECT pg_temp.expect_error(format('select public.mark_appointment_no_show(%L::uuid,%L::uuid,%L,%L::timestamptz,%L)',:'tenant_a',(:'role_noshow'::jsonb#>>'{appointment,id}'),'Doctor tries',(:'role_noshow'::jsonb#>>'{appointment,updated_at}'),'acn-doctor-noshow'),'Недостаточно прав');
SELECT set_config('request.jwt.claim.sub',:'cashier_a',true);
SELECT pg_temp.expect_error(format('select public.mark_appointment_no_show(%L::uuid,%L::uuid,%L,%L::timestamptz,%L)',:'tenant_a',(:'role_noshow'::jsonb#>>'{appointment,id}'),'Cashier tries',(:'role_noshow'::jsonb#>>'{appointment,updated_at}'),'acn-cashier-noshow'),'Недостаточно прав');
SELECT set_config('request.jwt.claim.sub',:'admin_b',true);
SELECT pg_temp.expect_error(format('select public.mark_appointment_no_show(%L::uuid,%L::uuid,%L,%L::timestamptz,%L)',:'tenant_a',(:'role_noshow'::jsonb#>>'{appointment,id}'),'Cross tenant',(:'role_noshow'::jsonb#>>'{appointment,updated_at}'),'acn-cross-noshow'),'Недостаточно прав');
SELECT set_config('request.jwt.claim.sub',:'admin_a',true);

SELECT pg_temp.expect_error(format('select public.mark_appointment_no_show(%L::uuid,%L::uuid,%L,%L::timestamptz,%L)',:'tenant_a',(:'owner_cancel'::jsonb#>>'{appointment,id}'),'Cancelled cannot no-show',(:'owner_cancel'::jsonb#>>'{appointment,updated_at}'),'acn-cancelled-to-noshow'),'Текущий статус');
SELECT pg_temp.expect_error(format('select public.cancel_appointment(%L::uuid,%L::uuid,%L,%L,%L::timestamptz,%L)',:'tenant_a',(:'noshow_new'::jsonb#>>'{appointment,id}'),'clinic','No-show cannot cancel',(:'noshow_new'::jsonb#>>'{appointment,updated_at}'),'acn-noshow-to-cancel'),'Текущий статус');
SELECT pg_temp.expect_error(format('select public.mark_appointment_no_show(%L::uuid,%L::uuid,%L,%L::timestamptz,%L)',:'tenant_a',(:'completed_cancel'::jsonb#>>'{appointment,id}'),'Completed cannot no-show',(:'completed_cancel'::jsonb#>>'{appointment,updated_at}'),'acn-completed-noshow'),'Текущий статус');
SELECT pg_temp.expect_error(format('select public.mark_appointment_no_show(%L::uuid,%L::uuid,%L,%L::timestamptz,%L)',:'tenant_a',(:'arrived_cancel'::jsonb#>>'{appointment,id}'),'Arrived cannot no-show',(:'arrived_cancel'::jsonb#>>'{appointment,updated_at}'),'acn-arrived-noshow'),'Текущий статус');

-- Recovery for both lifecycle operations and safe not-found.
SELECT pg_temp.assert_true((public.get_appointment_operation(:'tenant_a','acn-owner-cancel')->>'found')::boolean,'recovery finds cancellation');
SELECT pg_temp.assert_true((public.get_appointment_operation(:'tenant_a','acn-owner-cancel')->>'operationType')='cancel','recovery identifies cancellation');
SELECT pg_temp.assert_true((public.get_appointment_operation(:'tenant_a','acn-noshow-new')->>'found')::boolean,'recovery finds no-show');
SELECT pg_temp.assert_true((public.get_appointment_operation(:'tenant_a','acn-noshow-new')->>'operationType')='no_show','recovery identifies no-show');
SELECT pg_temp.assert_true(NOT (public.get_appointment_operation(:'tenant_a','acn-unknown-lifecycle')->>'found')::boolean,'unknown operation returns found=false');

-- Hard delete remains separate and owner/admin-only. Cancellation never calls DELETE.
SELECT public.create_appointment(:'tenant_a',:'patient_a3',:'doctor_a2','2026-10-09 08:00+00','2026-10-09 09:00+00','A2','Delete target','new','unpaid','phone',1,NULL,'acn-delete-create')->'appointment'->>'id' AS delete_target \gset
SELECT set_config('request.jwt.claim.sub',:'registrar_a',true);
DELETE FROM public.appointments WHERE id=:'delete_target';
SELECT pg_temp.assert_true((SELECT count(*) FROM public.appointments WHERE id=:'delete_target')=1,'registrar cannot hard delete');
SELECT set_config('request.jwt.claim.sub',:'admin_a',true);
DELETE FROM public.appointments WHERE id=:'delete_target';
SELECT pg_temp.assert_true((SELECT count(*) FROM public.appointments WHERE id=:'delete_target')=0,'admin hard delete remains separate');

-- Anonymous execution is denied.
RESET ROLE;
SET LOCAL ROLE anon;
SELECT pg_temp.expect_error(format('select public.cancel_appointment(%L::uuid,%L::uuid,%L,%L,%L::timestamptz,%L)',:'tenant_a',:'role_cancel_id','patient','Anon',:'role_cancel_updated','acn-anon-cancel'),'permission denied');
SELECT pg_temp.expect_error(format('select public.mark_appointment_no_show(%L::uuid,%L::uuid,%L,%L::timestamptz,%L)',:'tenant_a',:'role_cancel_id','Anon',:'role_cancel_updated','acn-anon-noshow'),'permission denied');
RESET ROLE;

-- Catalog, RLS, grants and preserved history facts.
SELECT pg_temp.assert_true((SELECT relrowsecurity FROM pg_class WHERE oid='public.appointments'::regclass),'appointments RLS remains enabled');
SELECT pg_temp.assert_true((SELECT relrowsecurity FROM pg_class WHERE oid='public.appointment_operations'::regclass),'operations RLS remains enabled');
SELECT pg_temp.assert_true(EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.appointments'::regclass AND tgname='appointments_lifecycle_write_guard' AND NOT tgisinternal),'lifecycle guard installed');
SELECT pg_temp.assert_true(has_function_privilege('authenticated','public.cancel_appointment(uuid,uuid,text,text,timestamptz,text)','EXECUTE'),'authenticated cancel RPC granted');
SELECT pg_temp.assert_true(has_function_privilege('authenticated','public.mark_appointment_no_show(uuid,uuid,text,timestamptz,text)','EXECUTE'),'authenticated no-show RPC granted');
SELECT pg_temp.assert_true(NOT has_function_privilege('anon','public.cancel_appointment(uuid,uuid,text,text,timestamptz,text)','EXECUTE'),'anon cancel execute denied');
SELECT pg_temp.assert_true(NOT has_function_privilege('anon','public.mark_appointment_no_show(uuid,uuid,text,timestamptz,text)','EXECUTE'),'anon no-show execute denied');
SELECT pg_temp.assert_true(has_table_privilege('authenticated','public.appointments','SELECT'),'existing appointment read grant preserved');
SELECT pg_temp.assert_true(has_table_privilege('authenticated','public.appointments','DELETE'),'existing delete grant preserved for RLS');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.appointments WHERE id=:'owner_cancel_id' AND status='cancelled')=1,'cancelled history row remains queryable');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.appointments WHERE id=(:'noshow_new'::jsonb#>>'{appointment,id}')::uuid AND status='no_show')=1,'no-show history row remains queryable');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.appointments WHERE status='cancelled' AND lifecycle_metadata_version=1 AND (cancelled_at IS NULL OR cancelled_by IS NULL OR cancellation_source IS NULL OR btrim(cancellation_reason)=''))=0,'controlled cancelled rows have complete metadata');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.appointments WHERE status='no_show' AND lifecycle_metadata_version=1 AND (no_show_at IS NULL OR no_show_by IS NULL OR btrim(no_show_reason)=''))=0,'controlled no-show rows have complete metadata');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.appointments a JOIN public.appointments b ON b.id>a.id AND b.tenant_id=a.tenant_id AND b.doctor_id=a.doctor_id AND a.status<>'cancelled' AND b.status<>'cancelled' AND b.start_time<a.end_time AND b.end_time>a.start_time)=0,'conflict protection still has zero doctor overlaps');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.appointments a JOIN public.appointments b ON b.id>a.id AND b.tenant_id=a.tenant_id AND b.patient_id=a.patient_id AND a.patient_id IS NOT NULL AND a.status<>'cancelled' AND b.status<>'cancelled' AND b.start_time<a.end_time AND b.end_time>a.start_time)=0,'conflict protection still has zero patient overlaps');

-- Appointment lifecycle actions do not create clinical or financial facts.
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
SELECT pg_temp.assert_true((SELECT balance FROM public.patients WHERE id=:'patient_a1')=:'balance_a1_before'::numeric,'patient A1 balance unchanged');
SELECT pg_temp.assert_true((SELECT balance FROM public.patients WHERE id=:'patient_a2')=:'balance_a2_before'::numeric,'patient A2 balance unchanged');

ROLLBACK;
\echo 'APPOINTMENT-CANCELLATION-NOSHOW-001 SQL validation passed'
