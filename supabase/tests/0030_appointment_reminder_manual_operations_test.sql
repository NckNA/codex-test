\set ON_ERROR_STOP on
\echo 'APPOINTMENT-REMINDER-MANUAL-OPERATIONS-001 local SQL validation'

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.assert_true(p_condition boolean, p_message text)
RETURNS void LANGUAGE plpgsql AS $assert$
BEGIN
  IF COALESCE(p_condition, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'ASSERTION FAILED: %', p_message;
  END IF;
END;
$assert$;

CREATE OR REPLACE FUNCTION pg_temp.expect_error(p_sql text, p_expected text)
RETURNS void LANGUAGE plpgsql AS $expect$
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
$expect$;

CREATE OR REPLACE FUNCTION pg_temp.make_job(
  p_tenant_id uuid,
  p_appointment_id uuid,
  p_patient_id uuid,
  p_type text,
  p_due_at timestamptz,
  p_label text
) RETURNS uuid
LANGUAGE plpgsql
AS $job$
DECLARE
  v_job_id uuid;
  v_appointment_updated_at timestamptz;
  v_policy_version integer;
BEGIN
  SELECT updated_at INTO v_appointment_updated_at
  FROM public.appointments
  WHERE tenant_id = p_tenant_id AND id = p_appointment_id;

  SELECT policy_version INTO v_policy_version
  FROM public.tenant_reminder_policies
  WHERE tenant_id = p_tenant_id;

  INSERT INTO public.appointment_reminder_jobs (
    tenant_id, appointment_id, patient_id, reminder_type, execution_mode,
    due_at, state, appointment_updated_at, policy_version,
    plan_key, payload_fingerprint, priority, metadata
  ) VALUES (
    p_tenant_id, p_appointment_id, p_patient_id, p_type, 'manual',
    p_due_at, 'scheduled', v_appointment_updated_at, v_policy_version,
    encode(extensions.digest('plan|' || p_label, 'sha256'), 'hex'),
    encode(extensions.digest('payload|' || p_label, 'sha256'), 'hex'),
    50, jsonb_build_object('fixture', p_label)
  ) RETURNING id INTO v_job_id;

  RETURN v_job_id;
END;
$job$;

\set tenant_a 'd3010000-0000-4000-8000-000000000001'
\set tenant_b 'd3010000-0000-4000-8000-000000000002'
\set owner_a 'd3020000-0000-4000-8000-000000000001'
\set admin_a 'd3020000-0000-4000-8000-000000000002'
\set registrar_a 'd3020000-0000-4000-8000-000000000003'
\set doctor_user_a 'd3020000-0000-4000-8000-000000000004'
\set cashier_a 'd3020000-0000-4000-8000-000000000005'
\set no_tenant 'd3020000-0000-4000-8000-000000000006'
\set owner_b 'd3020000-0000-4000-8000-000000000007'
\set patient_a 'd3030000-0000-4000-8000-000000000001'
\set patient_b 'd3030000-0000-4000-8000-000000000002'
\set doctor_a 'd3040000-0000-4000-8000-000000000001'
\set doctor_b 'd3040000-0000-4000-8000-000000000002'

\set appt_no_answer 'd3050000-0000-4000-8000-000000000001'
\set appt_confirm 'd3050000-0000-4000-8000-000000000002'
\set appt_message 'd3050000-0000-4000-8000-000000000003'
\set appt_callback 'd3050000-0000-4000-8000-000000000004'
\set appt_defer 'd3050000-0000-4000-8000-000000000005'
\set appt_skip 'd3050000-0000-4000-8000-000000000006'
\set appt_future 'd3050000-0000-4000-8000-000000000007'
\set appt_stale 'd3050000-0000-4000-8000-000000000008'
\set appt_cancel 'd3050000-0000-4000-8000-000000000009'
\set appt_noshow 'd3050000-0000-4000-8000-000000000010'
\set appt_completed 'd3050000-0000-4000-8000-000000000011'
\set appt_arrived 'd3050000-0000-4000-8000-000000000012'
\set appt_progress 'd3050000-0000-4000-8000-000000000013'
\set appt_blocked 'd3050000-0000-4000-8000-000000000014'
\set appt_b 'd3050000-0000-4000-8000-000000000015'
\set appt_planner_skip 'd3050000-0000-4000-8000-000000000016'
\set appt_planner_defer 'd3050000-0000-4000-8000-000000000017'
\set appt_existing_confirmed 'd3050000-0000-4000-8000-000000000018'

SELECT pg_temp.assert_true(to_regprocedure('public.complete_appointment_reminder_job(uuid,uuid,text,text,text,timestamptz,timestamptz,text)') IS NOT NULL, 'complete RPC exists');
SELECT pg_temp.assert_true(to_regprocedure('public.defer_appointment_reminder_job(uuid,uuid,timestamptz,text,timestamptz,timestamptz,text)') IS NOT NULL, 'defer RPC exists');
SELECT pg_temp.assert_true(to_regprocedure('public.skip_appointment_reminder_job(uuid,uuid,text,timestamptz,timestamptz,text)') IS NOT NULL, 'skip RPC exists');
SELECT pg_temp.assert_true((SELECT relrowsecurity FROM pg_class WHERE oid='public.appointment_reminder_jobs'::regclass), 'job RLS remains enabled');
SELECT pg_temp.assert_true((SELECT relrowsecurity FROM pg_class WHERE oid='public.appointment_confirmation_attempts'::regclass), 'attempt RLS remains enabled');
SELECT pg_temp.assert_true(NOT has_table_privilege('authenticated','public.appointment_reminder_jobs','UPDATE'), 'authenticated direct job update blocked');
SELECT pg_temp.assert_true(NOT has_table_privilege('authenticated','public.appointment_confirmation_attempts','INSERT'), 'authenticated direct attempt insert blocked');

INSERT INTO public.tenants(id,name,timezone) VALUES
  (:'tenant_a','Manual Reminder Clinic A','Asia/Almaty'),
  (:'tenant_b','Manual Reminder Clinic B','Europe/Berlin');

INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) VALUES
  (:'owner_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','manual-owner-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'admin_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','manual-admin-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'registrar_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','manual-reg-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'doctor_user_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','manual-doc-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'cashier_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','manual-cash-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'no_tenant','00000000-0000-0000-0000-000000000000','authenticated','authenticated','manual-none@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'owner_b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','manual-owner-b@example.local','x',now(),'{"provider":"email"}','{}',now(),now());

INSERT INTO public.profiles(id,first_name,last_name) VALUES
  (:'owner_a','Owner','A'),(:'admin_a','Admin','A'),(:'registrar_a','Registrar','A'),
  (:'doctor_user_a','Doctor','A'),(:'cashier_a','Cashier','A'),(:'no_tenant','No','Tenant'),(:'owner_b','Owner','B');

INSERT INTO public.tenant_users(tenant_id,user_id,role) VALUES
  (:'tenant_a',:'owner_a','clinic_owner'),(:'tenant_a',:'admin_a','clinic_admin'),
  (:'tenant_a',:'registrar_a','registrar'),(:'tenant_a',:'doctor_user_a','doctor'),
  (:'tenant_a',:'cashier_a','cashier'),(:'tenant_b',:'owner_b','clinic_owner');

INSERT INTO public.patients(id,tenant_id,full_name,phone,source,status,balance) VALUES
  (:'patient_a',:'tenant_a','Manual Reminder Patient A','+77003010001','phone','active',1250),
  (:'patient_b',:'tenant_b','Manual Reminder Patient B','+49003010001','phone','active',0);
INSERT INTO public.doctors(id,tenant_id,user_id,full_name,specialization,cabinet,color,active) VALUES
  (:'doctor_a',:'tenant_a',:'doctor_user_a','Manual Reminder Doctor A','General','A1','#111111',true),
  (:'doctor_b',:'tenant_b',NULL,'Manual Reminder Doctor B','General','B1','#222222',true);

INSERT INTO public.appointments(id,tenant_id,patient_id,doctor_id,cabinet,service,status,start_time,end_time) VALUES
  (:'appt_no_answer',:'tenant_a',:'patient_a',:'doctor_a','A1','No answer', 'new', transaction_timestamp()+interval '2 days', transaction_timestamp()+interval '2 days 1 hour'),
  (:'appt_confirm',:'tenant_a',:'patient_a',:'doctor_a','A1','Confirm', 'new', transaction_timestamp()+interval '3 days', transaction_timestamp()+interval '3 days 1 hour'),
  (:'appt_message',:'tenant_a',:'patient_a',:'doctor_a','A1','Message', 'new', transaction_timestamp()+interval '4 days', transaction_timestamp()+interval '4 days 1 hour'),
  (:'appt_callback',:'tenant_a',:'patient_a',:'doctor_a','A1','Callback', 'new', transaction_timestamp()+interval '5 days', transaction_timestamp()+interval '5 days 1 hour'),
  (:'appt_defer',:'tenant_a',:'patient_a',:'doctor_a','A1','Defer', 'new', transaction_timestamp()+interval '6 days', transaction_timestamp()+interval '6 days 1 hour'),
  (:'appt_skip',:'tenant_a',:'patient_a',:'doctor_a','A1','Skip', 'new', transaction_timestamp()+interval '7 days', transaction_timestamp()+interval '7 days 1 hour'),
  (:'appt_future',:'tenant_a',:'patient_a',:'doctor_a','A1','Future', 'new', transaction_timestamp()+interval '8 days', transaction_timestamp()+interval '8 days 1 hour'),
  (:'appt_stale',:'tenant_a',:'patient_a',:'doctor_a','A1','Stale', 'new', transaction_timestamp()+interval '9 days', transaction_timestamp()+interval '9 days 1 hour'),
  (:'appt_cancel',:'tenant_a',:'patient_a',:'doctor_a','A1','Cancel', 'new', transaction_timestamp()+interval '10 days', transaction_timestamp()+interval '10 days 1 hour'),
  (:'appt_noshow',:'tenant_a',:'patient_a',:'doctor_a','A1','No show', 'new', transaction_timestamp()+interval '11 days', transaction_timestamp()+interval '11 days 1 hour'),
  (:'appt_completed',:'tenant_a',:'patient_a',:'doctor_a','A1','Completed', 'completed', transaction_timestamp()+interval '12 days', transaction_timestamp()+interval '12 days 1 hour'),
  (:'appt_arrived',:'tenant_a',:'patient_a',:'doctor_a','A1','Arrived', 'arrived', transaction_timestamp()+interval '13 days', transaction_timestamp()+interval '13 days 1 hour'),
  (:'appt_progress',:'tenant_a',:'patient_a',:'doctor_a','A1','Progress', 'in_progress', transaction_timestamp()+interval '14 days', transaction_timestamp()+interval '14 days 1 hour'),
  (:'appt_blocked',:'tenant_a',NULL,:'doctor_a','A1','Blocked', 'blocked', transaction_timestamp()+interval '15 days', transaction_timestamp()+interval '15 days 1 hour'),
  (:'appt_b',:'tenant_b',:'patient_b',:'doctor_b','B1','Tenant B', 'new', transaction_timestamp()+interval '16 days', transaction_timestamp()+interval '16 days 1 hour'),
  (:'appt_planner_skip',:'tenant_a',:'patient_a',:'doctor_a','A1','Planner skip', 'new', transaction_timestamp()+interval '17 days', transaction_timestamp()+interval '17 days 1 hour'),
  (:'appt_planner_defer',:'tenant_a',:'patient_a',:'doctor_a','A1','Planner defer', 'new', transaction_timestamp()+interval '18 days', transaction_timestamp()+interval '18 days 1 hour');

INSERT INTO public.appointments(
  id,tenant_id,patient_id,doctor_id,cabinet,service,status,start_time,end_time,
  confirmation_state,confirmed_at,confirmed_by,confirmation_channel,
  last_confirmation_attempt_at,confirmation_attempt_count,confirmation_metadata_version,last_confirmation_outcome
) VALUES (
  :'appt_existing_confirmed',:'tenant_a',:'patient_a',:'doctor_a','A1','Already confirmed','new',
  transaction_timestamp()+interval '19 days',transaction_timestamp()+interval '19 days 1 hour',
  'confirmed',transaction_timestamp()-interval '1 day',:'owner_a','phone',
  transaction_timestamp()-interval '1 day',1,1,'confirmed'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
SELECT public.set_tenant_reminder_policy(:'tenant_a',true,true,false,true,'12:00',true,true,true,180);
SELECT set_config('request.jwt.claim.sub',:'owner_b',true);
SELECT public.set_tenant_reminder_policy(:'tenant_b',true,true,false,true,'12:00',true,true,true,180);
RESET ROLE;

SELECT pg_temp.make_job(:'tenant_a',:'appt_no_answer',:'patient_a','confirmation_request',transaction_timestamp()-interval '2 hours','no-answer') AS job_no_answer \gset
SELECT pg_temp.make_job(:'tenant_a',:'appt_confirm',:'patient_a','confirmation_request',transaction_timestamp()-interval '90 minutes','confirm') AS job_confirm \gset
SELECT pg_temp.make_job(:'tenant_a',:'appt_message',:'patient_a','day_before_reminder',transaction_timestamp()-interval '60 minutes','message') AS job_message \gset
SELECT pg_temp.make_job(:'tenant_a',:'appt_callback',:'patient_a','control_call_task',transaction_timestamp()-interval '30 minutes','callback') AS job_callback \gset
SELECT pg_temp.make_job(:'tenant_a',:'appt_defer',:'patient_a','control_call_task',transaction_timestamp()+interval '2 days','defer') AS job_defer \gset
SELECT pg_temp.make_job(:'tenant_a',:'appt_skip',:'patient_a','day_before_reminder',transaction_timestamp()+interval '3 days','skip') AS job_skip \gset
SELECT pg_temp.make_job(:'tenant_a',:'appt_future',:'patient_a','confirmation_request',transaction_timestamp()+interval '1 day','future') AS job_future \gset
SELECT pg_temp.make_job(:'tenant_a',:'appt_stale',:'patient_a','confirmation_request',transaction_timestamp()-interval '1 hour','stale') AS job_stale \gset
SELECT pg_temp.make_job(:'tenant_a',:'appt_cancel',:'patient_a','confirmation_request',transaction_timestamp()-interval '1 hour','cancel') AS job_cancel \gset
SELECT pg_temp.make_job(:'tenant_a',:'appt_noshow',:'patient_a','confirmation_request',transaction_timestamp()-interval '1 hour','noshow') AS job_noshow \gset
SELECT pg_temp.make_job(:'tenant_a',:'appt_completed',:'patient_a','confirmation_request',transaction_timestamp()-interval '1 hour','completed') AS job_completed_appt \gset
SELECT pg_temp.make_job(:'tenant_a',:'appt_arrived',:'patient_a','confirmation_request',transaction_timestamp()-interval '1 hour','arrived') AS job_arrived \gset
SELECT pg_temp.make_job(:'tenant_a',:'appt_progress',:'patient_a','confirmation_request',transaction_timestamp()-interval '1 hour','progress') AS job_progress \gset
SELECT pg_temp.make_job(:'tenant_b',:'appt_b',:'patient_b','confirmation_request',transaction_timestamp()-interval '1 hour','tenant-b') AS job_b \gset
SELECT pg_temp.make_job(:'tenant_a',:'appt_existing_confirmed',:'patient_a','day_before_reminder',transaction_timestamp()-interval '1 hour','confirmed-followup') AS job_existing_confirmed \gset

SELECT count(*)::text AS visits_before FROM public.patient_visits \gset
SELECT count(*)::text AS encounters_before FROM public.clinical_encounters \gset
SELECT count(*)::text AS services_before FROM public.completed_services \gset
SELECT count(*)::text AS plans_before FROM public.treatment_plans \gset
SELECT count(*)::text AS findings_before FROM public.findings \gset
SELECT count(*)::text AS invoices_before FROM public.invoices \gset
SELECT count(*)::text AS payments_before FROM public.payments \gset
SELECT count(*)::text AS refunds_before FROM public.refunds \gset
SELECT count(*)::text AS adjustments_before FROM public.financial_adjustments \gset
SELECT balance::text AS balance_before FROM public.patients WHERE id=:'patient_a' \gset

-- Queue read matrix.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
SELECT pg_temp.assert_true((SELECT count(*)>0 FROM public.appointment_reminder_jobs WHERE tenant_id=:'tenant_a'), 'owner views active queue');
SELECT set_config('request.jwt.claim.sub',:'admin_a',true);
SELECT pg_temp.assert_true((SELECT count(*)>0 FROM public.appointment_reminder_jobs WHERE tenant_id=:'tenant_a'), 'admin views active queue');
SELECT set_config('request.jwt.claim.sub',:'registrar_a',true);
SELECT pg_temp.assert_true((SELECT count(*)>0 FROM public.appointment_reminder_jobs WHERE tenant_id=:'tenant_a'), 'registrar views active queue');
SELECT set_config('request.jwt.claim.sub',:'doctor_user_a',true);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.appointment_reminder_jobs WHERE tenant_id=:'tenant_a'), 'doctor cannot view queue');
SELECT set_config('request.jwt.claim.sub',:'cashier_a',true);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.appointment_reminder_jobs WHERE tenant_id=:'tenant_a'), 'cashier cannot view queue');
SELECT set_config('request.jwt.claim.sub',:'no_tenant',true);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.appointment_reminder_jobs), 'unknown/no-tenant cannot view queue');
SELECT set_config('request.jwt.claim.sub',:'owner_b',true);
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.appointment_reminder_jobs WHERE tenant_id=:'tenant_b'), 'tenant B sees only tenant B jobs');
SELECT pg_temp.expect_error(format(
  'select public.complete_appointment_reminder_job(%L::uuid,%L::uuid,%L,%L,%L,(select updated_at from public.appointment_reminder_jobs where id=%L::uuid),(select updated_at from public.appointments where id=%L::uuid),%L)',
  :'tenant_a',:'job_no_answer','phone','no_answer','cross tenant',:'job_no_answer',:'appt_no_answer','manual-cross-tenant-001'
),'Недостаточно прав');
RESET ROLE;

-- Validation: required fields, due policy and direct writes.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
SELECT updated_at::text AS future_job_updated FROM public.appointment_reminder_jobs WHERE id=:'job_future' \gset
SELECT updated_at::text AS future_appt_updated FROM public.appointments WHERE id=:'appt_future' \gset
SELECT pg_temp.expect_error(format(
  'select public.complete_appointment_reminder_job(%L::uuid,%L::uuid,NULL,%L,NULL,%L::timestamptz,%L::timestamptz,%L)',
  :'tenant_a',:'job_future','no_answer',:'future_job_updated',:'future_appt_updated','manual-channel-required-001'
),'Выберите способ связи');
SELECT pg_temp.expect_error(format(
  'select public.complete_appointment_reminder_job(%L::uuid,%L::uuid,%L,NULL,NULL,%L::timestamptz,%L::timestamptz,%L)',
  :'tenant_a',:'job_future','phone',:'future_job_updated',:'future_appt_updated','manual-outcome-required-001'
),'Выберите результат связи');
SELECT pg_temp.expect_error(format(
  'select public.complete_appointment_reminder_job(%L::uuid,%L::uuid,%L,%L,NULL,%L::timestamptz,%L::timestamptz,%L)',
  :'tenant_a',:'job_future','phone','no_answer',:'future_job_updated',:'future_appt_updated','manual-future-not-due-001'
),'ещё не наступила');
SELECT pg_temp.expect_error(format('update public.appointment_reminder_jobs set state=%L where id=%L::uuid','completed',:'job_future'),'permission denied');
SELECT pg_temp.expect_error(format(
  'insert into public.appointment_confirmation_attempts(tenant_id,appointment_id,patient_id,actor_user_id,channel,outcome,operation_key,fingerprint) values(%L::uuid,%L::uuid,%L::uuid,%L::uuid,%L,%L,%L,%L)',
  :'tenant_a',:'appt_future',:'patient_a',:'owner_a','phone','no_answer','illegal-attempt-001',repeat('a',64)
),'permission denied');
RESET ROLE;

-- Complete no-answer and replay exactly once.
SELECT updated_at::text AS no_answer_job_updated FROM public.appointment_reminder_jobs WHERE id=:'job_no_answer' \gset
SELECT updated_at::text AS no_answer_appt_updated FROM public.appointments WHERE id=:'appt_no_answer' \gset
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'registrar_a',true);
SELECT public.complete_appointment_reminder_job(
  :'tenant_a',:'job_no_answer','phone','no_answer','  Не ответил  ',
  :'no_answer_job_updated'::timestamptz,:'no_answer_appt_updated'::timestamptz,'manual-complete-no-answer-001'
) AS no_answer_result \gset
SELECT public.complete_appointment_reminder_job(
  :'tenant_a',:'job_no_answer','phone','no_answer','  Не ответил  ',
  :'no_answer_job_updated'::timestamptz,:'no_answer_appt_updated'::timestamptz,'manual-complete-no-answer-001'
) AS no_answer_replay \gset
RESET ROLE;
SELECT pg_temp.assert_true((:'no_answer_result'::jsonb->>'replayed')::boolean IS FALSE, 'first completion is not replay');
SELECT pg_temp.assert_true((:'no_answer_replay'::jsonb->>'replayed')::boolean, 'same completion key replays safely');
SELECT pg_temp.assert_true((SELECT state='completed' AND completed_by=:'registrar_a' AND completion_outcome='no_answer' AND completion_note='Не ответил' AND completed_at IS NOT NULL FROM public.appointment_reminder_jobs WHERE id=:'job_no_answer'), 'no-answer job completion metadata stored and note trimmed');
SELECT pg_temp.assert_true((SELECT confirmation_state='contact_in_progress' AND confirmation_attempt_count=1 AND last_confirmation_outcome='no_answer' FROM public.appointments WHERE id=:'appt_no_answer'), 'no-answer updates authoritative confirmation state');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.appointment_confirmation_attempts WHERE appointment_id=:'appt_no_answer'), 'one confirmation attempt created');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.audit_events WHERE action='appointment_reminder_completed' AND target_id=:'job_no_answer'::text), 'completion audit exactly once');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.activity_events WHERE type='appointment_reminder_completed' AND source_id=:'job_no_answer'::text), 'completion activity exactly once');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.appointment_operations WHERE tenant_id=:'tenant_a' AND operation_key='manual-complete-no-answer-001'), 'one operation row stored');

-- Changed payload under same key is rejected.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'registrar_a',true);
SELECT pg_temp.expect_error(format(
  'select public.complete_appointment_reminder_job(%L::uuid,%L::uuid,%L,%L,%L,%L::timestamptz,%L::timestamptz,%L)',
  :'tenant_a',:'job_no_answer','phone','confirmed','different',:'no_answer_job_updated',:'no_answer_appt_updated','manual-complete-no-answer-001'
),'другими параметрами');
SELECT pg_temp.expect_error(format(
  'select public.complete_appointment_reminder_job(%L::uuid,%L::uuid,%L,%L,%L,%L::timestamptz,%L::timestamptz,%L)',
  :'tenant_a',:'job_no_answer','whatsapp','no_answer','Не ответил',:'no_answer_job_updated',:'no_answer_appt_updated','manual-complete-no-answer-001'
),'другими параметрами');
RESET ROLE;

-- Confirmed outcome confirms appointment atomically.
SELECT updated_at::text AS confirm_job_updated FROM public.appointment_reminder_jobs WHERE id=:'job_confirm' \gset
SELECT updated_at::text AS confirm_appt_updated FROM public.appointments WHERE id=:'appt_confirm' \gset
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
SELECT public.complete_appointment_reminder_job(
  :'tenant_a',:'job_confirm','phone','confirmed','Подтверждено',
  :'confirm_job_updated'::timestamptz,:'confirm_appt_updated'::timestamptz,'manual-complete-confirm-001'
);
RESET ROLE;
SELECT pg_temp.assert_true((SELECT confirmation_state='confirmed' AND confirmed_by=:'owner_a' AND confirmation_attempt_count=1 FROM public.appointments WHERE id=:'appt_confirm'), 'confirmed outcome confirms appointment');
SELECT pg_temp.assert_true((SELECT state='completed' AND confirmation_attempt_id IS NOT NULL FROM public.appointment_reminder_jobs WHERE id=:'job_confirm'), 'confirmed completion links attempt');

-- message_sent and callback_requested preserve their domain semantics.
SELECT updated_at::text AS message_job_updated FROM public.appointment_reminder_jobs WHERE id=:'job_message' \gset
SELECT updated_at::text AS message_appt_updated FROM public.appointments WHERE id=:'appt_message' \gset
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'admin_a',true);
SELECT public.complete_appointment_reminder_job(
  :'tenant_a',:'job_message','whatsapp','message_sent','Сообщение отправлено вручную',
  :'message_job_updated'::timestamptz,:'message_appt_updated'::timestamptz,'manual-complete-message-001'
);
RESET ROLE;
SELECT pg_temp.assert_true((SELECT confirmation_state='contact_in_progress' AND last_confirmation_outcome='message_sent' AND confirmed_at IS NULL FROM public.appointments WHERE id=:'appt_message'), 'message_sent does not confirm appointment');

SELECT updated_at::text AS callback_job_updated FROM public.appointment_reminder_jobs WHERE id=:'job_callback' \gset
SELECT updated_at::text AS callback_appt_updated FROM public.appointments WHERE id=:'appt_callback' \gset
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'registrar_a',true);
SELECT public.complete_appointment_reminder_job(
  :'tenant_a',:'job_callback','phone','callback_requested','Просит перезвонить позже',
  :'callback_job_updated'::timestamptz,:'callback_appt_updated'::timestamptz,'manual-complete-callback-001'
);
RESET ROLE;
SELECT pg_temp.assert_true((SELECT confirmation_state='callback_requested' AND last_confirmation_outcome='callback_requested' FROM public.appointments WHERE id=:'appt_callback'), 'callback_requested updates confirmation workflow without invented time');

-- Completing an ordinary reminder for an already confirmed appointment records follow-up without unconfirming it.
SELECT updated_at::text AS existing_job_updated FROM public.appointment_reminder_jobs WHERE id=:'job_existing_confirmed' \gset
SELECT updated_at::text AS existing_appt_updated FROM public.appointments WHERE id=:'appt_existing_confirmed' \gset
SELECT confirmed_at::text AS existing_confirmed_at FROM public.appointments WHERE id=:'appt_existing_confirmed' \gset
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'admin_a',true);
SELECT public.complete_appointment_reminder_job(
  :'tenant_a',:'job_existing_confirmed','phone','message_sent','Напомнили о визите',
  :'existing_job_updated'::timestamptz,:'existing_appt_updated'::timestamptz,'manual-complete-confirmed-followup-001'
);
RESET ROLE;
SELECT pg_temp.assert_true((SELECT confirmation_state='confirmed' AND confirmed_at::text=:'existing_confirmed_at' AND last_confirmation_outcome='message_sent' AND confirmation_attempt_count=2 FROM public.appointments WHERE id=:'appt_existing_confirmed'), 'follow-up does not unconfirm an already confirmed appointment');

-- Defer preserves identity, validates time/reason and creates no attempt.
SELECT updated_at::text AS defer_job_updated FROM public.appointment_reminder_jobs WHERE id=:'job_defer' \gset
SELECT updated_at::text AS defer_appt_updated FROM public.appointments WHERE id=:'appt_defer' \gset
SELECT due_at::text AS defer_old_due FROM public.appointment_reminder_jobs WHERE id=:'job_defer' \gset
SELECT (transaction_timestamp()+interval '4 days')::text AS defer_new_due \gset
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'registrar_a',true);
SELECT pg_temp.expect_error(format(
  'select public.defer_appointment_reminder_job(%L::uuid,%L::uuid,%L::timestamptz,%L,%L::timestamptz,%L::timestamptz,%L)',
  :'tenant_a',:'job_defer',:'defer_new_due','',:'defer_job_updated',:'defer_appt_updated','manual-defer-reason-001'
),'Укажите причину');
SELECT pg_temp.expect_error(format(
  'select public.defer_appointment_reminder_job(%L::uuid,%L::uuid,%L::timestamptz,%L,%L::timestamptz,%L::timestamptz,%L)',
  :'tenant_a',:'job_defer',(transaction_timestamp()-interval '1 minute')::text,'past',:'defer_job_updated',:'defer_appt_updated','manual-defer-past-001'
),'Новое время');
SELECT pg_temp.expect_error(format(
  'select public.defer_appointment_reminder_job(%L::uuid,%L::uuid,%L::timestamptz,%L,%L::timestamptz,%L::timestamptz,%L)',
  :'tenant_a',:'job_defer',(transaction_timestamp()+interval '7 days')::text,'after appointment',:'defer_job_updated',:'defer_appt_updated','manual-defer-after-001'
),'Новое время');
SELECT public.defer_appointment_reminder_job(
  :'tenant_a',:'job_defer',:'defer_new_due'::timestamptz,'  Перезвонить в согласованное время  ',
  :'defer_job_updated'::timestamptz,:'defer_appt_updated'::timestamptz,'manual-defer-valid-001'
) AS defer_result \gset
SELECT public.defer_appointment_reminder_job(
  :'tenant_a',:'job_defer',:'defer_new_due'::timestamptz,'  Перезвонить в согласованное время  ',
  :'defer_job_updated'::timestamptz,:'defer_appt_updated'::timestamptz,'manual-defer-valid-001'
) AS defer_replay \gset
RESET ROLE;
SELECT pg_temp.assert_true((:'defer_replay'::jsonb->>'replayed')::boolean, 'defer replay safe');
SELECT pg_temp.assert_true((SELECT id=:'job_defer'::uuid AND state='scheduled' AND due_at=:'defer_new_due'::timestamptz AND original_due_at=:'defer_old_due'::timestamptz AND defer_reason='Перезвонить в согласованное время' AND deferred_by=:'registrar_a' FROM public.appointment_reminder_jobs WHERE id=:'job_defer'), 'defer preserves identity and original due time');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.appointment_confirmation_attempts WHERE appointment_id=:'appt_defer'), 'defer creates no confirmation attempt');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.audit_events WHERE action='appointment_reminder_deferred' AND target_id=:'job_defer'::text), 'defer audit exactly once');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.activity_events WHERE type='appointment_reminder_deferred' AND source_id=:'job_defer'::text), 'defer activity exactly once');

-- Skip remains terminal history and replay safe.
SELECT updated_at::text AS skip_job_updated FROM public.appointment_reminder_jobs WHERE id=:'job_skip' \gset
SELECT updated_at::text AS skip_appt_updated FROM public.appointments WHERE id=:'appt_skip' \gset
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'admin_a',true);
SELECT pg_temp.expect_error(format(
  'select public.skip_appointment_reminder_job(%L::uuid,%L::uuid,%L,%L::timestamptz,%L::timestamptz,%L)',
  :'tenant_a',:'job_skip','',:'skip_job_updated',:'skip_appt_updated','manual-skip-reason-001'
),'Укажите причину');
SELECT public.skip_appointment_reminder_job(
  :'tenant_a',:'job_skip','  Дубликат ручной задачи  ',
  :'skip_job_updated'::timestamptz,:'skip_appt_updated'::timestamptz,'manual-skip-valid-001'
) AS skip_result \gset
SELECT public.skip_appointment_reminder_job(
  :'tenant_a',:'job_skip','  Дубликат ручной задачи  ',
  :'skip_job_updated'::timestamptz,:'skip_appt_updated'::timestamptz,'manual-skip-valid-001'
) AS skip_replay \gset
RESET ROLE;
SELECT pg_temp.assert_true((:'skip_replay'::jsonb->>'replayed')::boolean, 'skip replay safe');
SELECT pg_temp.assert_true((SELECT state='skipped' AND skipped_by=:'admin_a' AND skipped_at IS NOT NULL AND terminal_reason='Дубликат ручной задачи' FROM public.appointment_reminder_jobs WHERE id=:'job_skip'), 'skip actor/time/reason stored');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.appointment_confirmation_attempts WHERE appointment_id=:'appt_skip'), 'skip creates no confirmation attempt');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.audit_events WHERE action='appointment_reminder_skipped' AND target_id=:'job_skip'::text), 'skip audit exactly once');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.activity_events WHERE type='appointment_reminder_skipped' AND source_id=:'job_skip'::text), 'skip activity exactly once');

-- Planner-generated skip is not recreated unchanged; appointment version change may produce a new plan identity.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
SELECT public.plan_appointment_reminder_jobs(:'tenant_a',:'appt_planner_skip',transaction_timestamp()) AS planner_skip_plan \gset
RESET ROLE;
SELECT (:'planner_skip_plan'::jsonb->'created'->0->>'id')::uuid AS planner_skip_job \gset
SELECT updated_at::text AS planner_skip_job_updated FROM public.appointment_reminder_jobs WHERE id=:'planner_skip_job' \gset
SELECT updated_at::text AS planner_skip_appt_updated FROM public.appointments WHERE id=:'appt_planner_skip' \gset
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
SELECT public.skip_appointment_reminder_job(
  :'tenant_a',:'planner_skip_job','Не требуется',
  :'planner_skip_job_updated'::timestamptz,:'planner_skip_appt_updated'::timestamptz,'manual-planner-skip-001'
);
SELECT public.plan_appointment_reminder_jobs(:'tenant_a',:'appt_planner_skip',transaction_timestamp()) AS planner_skip_replan \gset
RESET ROLE;
SELECT pg_temp.assert_true(jsonb_array_length(:'planner_skip_replan'::jsonb->'created')=0, 'planner does not recreate unchanged skipped plan');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.appointment_reminder_jobs WHERE id=:'planner_skip_job' AND state='skipped'), 'skipped planner job remains history');
UPDATE public.appointments SET comment='new version for skipped plan' WHERE id=:'appt_planner_skip';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
SELECT public.plan_appointment_reminder_jobs(:'tenant_a',:'appt_planner_skip',transaction_timestamp()) AS planner_skip_new_version \gset
RESET ROLE;
SELECT pg_temp.assert_true(
  (SELECT count(*)>0 FROM public.appointment_reminder_jobs j JOIN public.appointments a ON a.id=j.appointment_id AND a.tenant_id=j.tenant_id WHERE j.appointment_id=:'appt_planner_skip' AND j.state IN ('scheduled','ready') AND j.appointment_updated_at=a.updated_at)
  AND jsonb_array_length(:'planner_skip_new_version'::jsonb->'created')=0
  AND jsonb_array_length(:'planner_skip_new_version'::jsonb->'reused')>0,
  'appointment version change creates a new active plan atomically and explicit replay reuses it'
);

-- Planner-generated defer keeps manual due override and produces no duplicate active work.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
SELECT public.plan_appointment_reminder_jobs(:'tenant_a',:'appt_planner_defer',transaction_timestamp()) AS planner_defer_plan \gset
RESET ROLE;
SELECT (:'planner_defer_plan'::jsonb->'created'->0->>'id')::uuid AS planner_defer_job \gset
SELECT updated_at::text AS planner_defer_job_updated FROM public.appointment_reminder_jobs WHERE id=:'planner_defer_job' \gset
SELECT updated_at::text AS planner_defer_appt_updated FROM public.appointments WHERE id=:'appt_planner_defer' \gset
SELECT (transaction_timestamp()+interval '10 days')::text AS planner_defer_new_due \gset
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'registrar_a',true);
SELECT public.defer_appointment_reminder_job(
  :'tenant_a',:'planner_defer_job',:'planner_defer_new_due'::timestamptz,'Согласованный срок',
  :'planner_defer_job_updated'::timestamptz,:'planner_defer_appt_updated'::timestamptz,'manual-planner-defer-001'
);
SELECT public.plan_appointment_reminder_jobs(:'tenant_a',:'appt_planner_defer',transaction_timestamp()) AS planner_defer_replan \gset
RESET ROLE;
SELECT pg_temp.assert_true((SELECT due_at=:'planner_defer_new_due'::timestamptz AND (metadata->>'manualDueOverride')::boolean FROM public.appointment_reminder_jobs WHERE id=:'planner_defer_job'), 'planner preserves explicit defer override');
SELECT pg_temp.assert_true((SELECT count(*)=jsonb_array_length(:'planner_defer_plan'::jsonb->'created') FROM public.appointment_reminder_jobs WHERE appointment_id=:'appt_planner_defer' AND state IN ('scheduled','ready')), 'defer plus planner creates no duplicate active work');

-- Stale and terminal protections.
SELECT updated_at::text AS stale_job_updated FROM public.appointment_reminder_jobs WHERE id=:'job_stale' \gset
SELECT updated_at::text AS stale_appt_old FROM public.appointments WHERE id=:'appt_stale' \gset
UPDATE public.appointments SET comment='rescheduled version marker' WHERE id=:'appt_stale';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
SELECT public.complete_appointment_reminder_job(
  :'tenant_a',:'job_stale','phone','no_answer',NULL,
  :'stale_job_updated'::timestamptz,:'stale_appt_old'::timestamptz,'manual-stale-complete-001'
) AS stale_complete_result \gset
SELECT pg_temp.assert_true(:'stale_complete_result'::jsonb->>'errorCode'='stale', 'stale completion returns structured conflict');
RESET ROLE;

SELECT updated_at::text AS cancel_expected FROM public.appointments WHERE id=:'appt_cancel' \gset
SELECT updated_at::text AS noshow_expected FROM public.appointments WHERE id=:'appt_noshow' \gset
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
SELECT public.cancel_appointment(
  :'tenant_a',:'appt_cancel','clinic','Manual reminder terminal validation',
  :'cancel_expected'::timestamptz,'manual-terminal-cancel-lifecycle-001'
);
SELECT public.mark_appointment_no_show(
  :'tenant_a',:'appt_noshow','Manual reminder no-show validation',
  :'noshow_expected'::timestamptz,'manual-terminal-noshow-lifecycle-001'
);
SELECT public.complete_appointment_reminder_job(
  :'tenant_a',:'job_cancel','phone','no_answer',NULL,
  (select updated_at from public.appointment_reminder_jobs where id=:'job_cancel'),
  (select updated_at from public.appointments where id=:'appt_cancel'),
  'manual-terminal-cancel-001'
) AS cancel_conflict_result \gset
SELECT pg_temp.assert_true(:'cancel_conflict_result'::jsonb->>'errorCode'='stale', 'cancelled appointment returns structured stale conflict');
SELECT public.complete_appointment_reminder_job(
  :'tenant_a',:'job_noshow','phone','no_answer',NULL,
  (select updated_at from public.appointment_reminder_jobs where id=:'job_noshow'),
  (select updated_at from public.appointments where id=:'appt_noshow'),
  'manual-terminal-noshow-001'
) AS noshow_conflict_result \gset
SELECT pg_temp.assert_true(:'noshow_conflict_result'::jsonb->>'errorCode'='stale', 'no-show appointment returns structured stale conflict');
SELECT pg_temp.expect_error(format(
  'select public.complete_appointment_reminder_job(%L::uuid,%L::uuid,%L,%L,NULL,(select updated_at from public.appointment_reminder_jobs where id=%L::uuid),(select updated_at from public.appointments where id=%L::uuid),%L)',
  :'tenant_a',:'job_completed_appt','phone','no_answer',:'job_completed_appt',:'appt_completed','manual-terminal-completed-001'
),'больше не доступна');
SELECT pg_temp.expect_error(format(
  'select public.complete_appointment_reminder_job(%L::uuid,%L::uuid,%L,%L,NULL,(select updated_at from public.appointment_reminder_jobs where id=%L::uuid),(select updated_at from public.appointments where id=%L::uuid),%L)',
  :'tenant_a',:'job_arrived','phone','no_answer',:'job_arrived',:'appt_arrived','manual-terminal-arrived-001'
),'больше не доступна');
SELECT pg_temp.expect_error(format(
  'select public.complete_appointment_reminder_job(%L::uuid,%L::uuid,%L,%L,NULL,(select updated_at from public.appointment_reminder_jobs where id=%L::uuid),(select updated_at from public.appointments where id=%L::uuid),%L)',
  :'tenant_a',:'job_progress','phone','no_answer',:'job_progress',:'appt_progress','manual-terminal-progress-001'
),'больше не доступна');
SELECT pg_temp.expect_error(format(
  'select public.complete_appointment_reminder_job(%L::uuid,%L::uuid,%L,%L,NULL,(select updated_at from public.appointment_reminder_jobs where id=%L::uuid),(select updated_at from public.appointments where id=%L::uuid),%L)',
  :'tenant_a',:'job_skip','phone','no_answer',:'job_skip',:'appt_skip','manual-terminal-skipped-001'
),'больше не доступна');
RESET ROLE;

-- Existing confirmation RPC still uses shared rules.
SELECT updated_at::text AS future_confirm_expected FROM public.appointments WHERE id=:'appt_future' \gset
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
SELECT public.record_appointment_confirmation_attempt(
  :'tenant_a',:'appt_future','phone','other','Shared helper regression',
  :'future_confirm_expected'::timestamptz,'manual-shared-confirmation-001'
) AS shared_confirmation_result \gset
RESET ROLE;
SELECT pg_temp.assert_true((SELECT confirmation_attempt_count=1 AND last_confirmation_outcome='other' FROM public.appointments WHERE id=:'appt_future'), 'existing confirmation RPC still works through shared helper');

-- Operation recovery returns reminder job and does not reveal cross-tenant data.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'registrar_a',true);
SELECT public.get_appointment_operation(:'tenant_a','manual-complete-no-answer-001') AS recovered_operation \gset
SELECT pg_temp.assert_true((:'recovered_operation'::jsonb->>'found')::boolean AND :'recovered_operation'::jsonb->'reminderJob'->>'id'=:'job_no_answer', 'operation recovery returns reminder job');
SELECT set_config('request.jwt.claim.sub',:'owner_b',true);
SELECT public.get_appointment_operation(:'tenant_b','manual-complete-no-answer-001') AS other_tenant_recovery \gset
SELECT pg_temp.assert_true((:'other_tenant_recovery'::jsonb->>'found')::boolean IS FALSE, 'operation keys are tenant scoped');
RESET ROLE;

-- Database invariants and side effects.
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM (SELECT tenant_id,operation_key,count(*) FROM public.appointment_operations GROUP BY 1,2 HAVING count(*)>1) q), 'duplicate operation keys zero');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM (SELECT tenant_id,appointment_id,reminder_type,due_at,appointment_updated_at,policy_version,count(*) FROM public.appointment_reminder_jobs WHERE state IN ('scheduled','ready') GROUP BY 1,2,3,4,5,6 HAVING count(*)>1) q), 'duplicate active jobs zero');
SELECT j.id,j.appointment_id,j.reminder_type,j.state,j.appointment_updated_at,a.updated_at AS current_appointment_updated_at,j.policy_version,p.policy_version AS current_policy_version,j.due_at,j.metadata
FROM public.appointment_reminder_jobs j
JOIN public.appointments a ON a.tenant_id=j.tenant_id AND a.id=j.appointment_id
JOIN public.tenant_reminder_policies p ON p.tenant_id=j.tenant_id
WHERE j.state IN ('scheduled','ready') AND (j.appointment_updated_at<>a.updated_at OR j.policy_version<>p.policy_version);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.appointment_reminder_jobs j JOIN public.appointments a ON a.tenant_id=j.tenant_id AND a.id=j.appointment_id JOIN public.tenant_reminder_policies p ON p.tenant_id=j.tenant_id WHERE j.state IN ('scheduled','ready') AND (j.appointment_updated_at<>a.updated_at OR j.policy_version<>p.policy_version)), 'stale active jobs zero');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.appointment_reminder_jobs j JOIN public.appointments a ON a.id=j.appointment_id AND a.tenant_id=j.tenant_id WHERE j.patient_id<>a.patient_id), 'job appointment patient tenant integrity');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.appointments WHERE end_time<=start_time), 'invalid appointment intervals zero');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.appointments a1 JOIN public.appointments a2 ON a1.tenant_id=a2.tenant_id AND a1.id<a2.id AND a1.doctor_id=a2.doctor_id AND a1.status NOT IN ('cancelled','no_show','completed') AND a2.status NOT IN ('cancelled','no_show','completed') AND a1.start_time<a2.end_time AND a1.end_time>a2.start_time)=0, 'doctor overlaps zero');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.appointments a1 JOIN public.appointments a2 ON a1.tenant_id=a2.tenant_id AND a1.id<a2.id AND a1.patient_id=a2.patient_id AND a1.status NOT IN ('cancelled','no_show','completed') AND a2.status NOT IN ('cancelled','no_show','completed') AND a1.start_time<a2.end_time AND a1.end_time>a2.start_time)=0, 'patient overlaps zero');
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.patient_visits)=:'visits_before', 'no visit side effects');
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.clinical_encounters)=:'encounters_before', 'no encounter side effects');
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.completed_services)=:'services_before', 'no completed service side effects');
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.treatment_plans)=:'plans_before', 'no treatment plan side effects');
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.findings)=:'findings_before', 'no finding side effects');
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.invoices)=:'invoices_before', 'no invoice side effects');
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.payments)=:'payments_before', 'no payment side effects');
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.refunds)=:'refunds_before', 'no refund side effects');
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.financial_adjustments)=:'adjustments_before', 'no adjustment side effects');
SELECT pg_temp.assert_true((SELECT balance::text FROM public.patients WHERE id=:'patient_a')=:'balance_before', 'patient balance unchanged');

SELECT
  (SELECT count(*) FROM public.appointment_reminder_jobs WHERE state IN ('scheduled','ready')) AS active_jobs,
  (SELECT count(*) FROM public.appointment_reminder_jobs WHERE state='completed') AS completed_jobs,
  (SELECT count(*) FROM public.appointment_reminder_jobs WHERE state='skipped') AS skipped_jobs,
  (SELECT count(*) FROM public.appointment_reminder_jobs WHERE deferred_at IS NOT NULL) AS deferred_jobs,
  (SELECT count(*) FROM public.appointment_confirmation_attempts) AS confirmation_attempts,
  (SELECT count(*) FROM public.audit_events WHERE action IN ('appointment_reminder_completed','appointment_reminder_deferred','appointment_reminder_skipped')) AS manual_audit,
  (SELECT count(*) FROM public.activity_events WHERE type IN ('appointment_reminder_completed','appointment_reminder_deferred','appointment_reminder_skipped')) AS manual_activity;

ROLLBACK;
\echo 'APPOINTMENT-REMINDER-MANUAL-OPERATIONS-001 SQL validation passed'
