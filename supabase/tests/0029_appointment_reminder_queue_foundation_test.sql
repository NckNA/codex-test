\set ON_ERROR_STOP on
\echo 'APPOINTMENT-REMINDER-QUEUE-FOUNDATION-001 local SQL validation'

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

\set tenant_a 'a2910000-0000-4000-8000-000000000001'
\set tenant_b 'b2910000-0000-4000-8000-000000000001'
\set tenant_c 'c2910000-0000-4000-8000-000000000001'
\set owner_a 'a2920000-0000-4000-8000-000000000001'
\set admin_a 'a2920000-0000-4000-8000-000000000002'
\set registrar_a 'a2920000-0000-4000-8000-000000000003'
\set doctor_user_a 'a2920000-0000-4000-8000-000000000004'
\set cashier_a 'a2920000-0000-4000-8000-000000000005'
\set no_tenant 'a2920000-0000-4000-8000-000000000006'
\set owner_b 'b2920000-0000-4000-8000-000000000001'
\set owner_c 'c2920000-0000-4000-8000-000000000001'
\set patient_a 'a2930000-0000-4000-8000-000000000001'
\set patient_b 'b2930000-0000-4000-8000-000000000001'
\set patient_c 'c2930000-0000-4000-8000-000000000001'
\set doctor_a 'a2940000-0000-4000-8000-000000000001'
\set doctor_b 'b2940000-0000-4000-8000-000000000001'
\set doctor_c 'c2940000-0000-4000-8000-000000000001'
\set appt_a 'a2950000-0000-4000-8000-000000000001'
\set appt_contact 'a2950000-0000-4000-8000-000000000002'
\set appt_confirmed 'a2950000-0000-4000-8000-000000000003'
\set appt_unreachable 'a2950000-0000-4000-8000-000000000004'
\set appt_callback 'a2950000-0000-4000-8000-000000000005'
\set appt_cancel 'a2950000-0000-4000-8000-000000000006'
\set appt_noshow 'a2950000-0000-4000-8000-000000000007'
\set appt_completed 'a2950000-0000-4000-8000-000000000008'
\set appt_arrived 'a2950000-0000-4000-8000-000000000009'
\set appt_progress 'a2950000-0000-4000-8000-000000000010'
\set appt_blocked 'a2950000-0000-4000-8000-000000000011'
\set appt_past 'a2950000-0000-4000-8000-000000000012'
\set appt_visit 'a2950000-0000-4000-8000-000000000013'
\set appt_delete 'a2950000-0000-4000-8000-000000000014'
\set appt_b 'b2950000-0000-4000-8000-000000000001'
\set appt_c 'c2950000-0000-4000-8000-000000000001'

SELECT pg_temp.assert_true(to_regclass('public.tenant_reminder_policies') IS NOT NULL, 'policy table exists');
SELECT pg_temp.assert_true(to_regclass('public.appointment_reminder_jobs') IS NOT NULL, 'job table exists');
SELECT pg_temp.assert_true((SELECT relrowsecurity FROM pg_class WHERE oid='public.tenant_reminder_policies'::regclass), 'policy RLS enabled');
SELECT pg_temp.assert_true((SELECT relrowsecurity FROM pg_class WHERE oid='public.appointment_reminder_jobs'::regclass), 'job RLS enabled');
SELECT pg_temp.assert_true(NOT has_table_privilege('authenticated','public.appointment_reminder_jobs','INSERT'), 'authenticated cannot insert jobs');
SELECT pg_temp.assert_true(NOT has_table_privilege('authenticated','public.appointment_reminder_jobs','UPDATE'), 'authenticated cannot update jobs');
SELECT pg_temp.assert_true(NOT has_table_privilege('authenticated','public.appointment_reminder_jobs','DELETE'), 'authenticated cannot delete jobs');
SELECT pg_temp.assert_true(has_table_privilege('authenticated','public.appointment_reminder_jobs','SELECT'), 'authenticated can select through RLS');

INSERT INTO public.tenants(id,name,timezone) VALUES
  (:'tenant_a','Reminder Clinic A','Asia/Almaty'),
  (:'tenant_b','Reminder Clinic B','Europe/Berlin'),
  (:'tenant_c','Reminder Clinic C','America/New_York');

SELECT pg_temp.assert_true((SELECT count(*)=3 FROM public.tenant_reminder_policies WHERE tenant_id IN (:'tenant_a',:'tenant_b',:'tenant_c')), 'new tenants receive policies');
SELECT pg_temp.assert_true((SELECT bool_and(NOT enabled) FROM public.tenant_reminder_policies WHERE tenant_id IN (:'tenant_a',:'tenant_b',:'tenant_c')), 'existing/new tenants disabled by default');

INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) VALUES
  (:'owner_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rem-owner-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'admin_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rem-admin-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'registrar_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rem-reg-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'doctor_user_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rem-doc-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'cashier_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rem-cash-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'no_tenant','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rem-none@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'owner_b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rem-owner-b@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'owner_c','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rem-owner-c@example.local','x',now(),'{"provider":"email"}','{}',now(),now());

INSERT INTO public.profiles(id,first_name,last_name) VALUES
  (:'owner_a','Owner','A'),(:'admin_a','Admin','A'),(:'registrar_a','Registrar','A'),
  (:'doctor_user_a','Doctor','A'),(:'cashier_a','Cashier','A'),(:'no_tenant','No','Tenant'),
  (:'owner_b','Owner','B'),(:'owner_c','Owner','C');

INSERT INTO public.tenant_users(tenant_id,user_id,role) VALUES
  (:'tenant_a',:'owner_a','clinic_owner'),(:'tenant_a',:'admin_a','clinic_admin'),
  (:'tenant_a',:'registrar_a','registrar'),(:'tenant_a',:'doctor_user_a','doctor'),
  (:'tenant_a',:'cashier_a','cashier'),(:'tenant_b',:'owner_b','clinic_owner'),
  (:'tenant_c',:'owner_c','clinic_owner');

INSERT INTO public.patients(id,tenant_id,full_name,phone,source,status,balance) VALUES
  (:'patient_a',:'tenant_a','Reminder Patient A','+77002910001','phone','active',0),
  (:'patient_b',:'tenant_b','Reminder Patient B','+49002910001','phone','active',0),
  (:'patient_c',:'tenant_c','Reminder Patient C','+12022910001','phone','active',0);
INSERT INTO public.doctors(id,tenant_id,user_id,full_name,specialization,cabinet,color,active) VALUES
  (:'doctor_a',:'tenant_a',:'doctor_user_a','Reminder Doctor A','General','A1','#111111',true),
  (:'doctor_b',:'tenant_b',NULL,'Reminder Doctor B','General','B1','#222222',true),
  (:'doctor_c',:'tenant_c',NULL,'Reminder Doctor C','General','C1','#333333',true);

-- All fixtures are inserted while policies are disabled; migration/insert must not create jobs.
INSERT INTO public.appointments(id,tenant_id,patient_id,doctor_id,cabinet,service,status,start_time,end_time) VALUES
  (:'appt_a',:'tenant_a',:'patient_a',:'doctor_a','A1','Base','new','2026-08-10 05:00+00','2026-08-10 06:00+00'),
  (:'appt_cancel',:'tenant_a',:'patient_a',:'doctor_a','A1','Cancel','new','2026-08-15 05:00+00','2026-08-15 06:00+00'),
  (:'appt_noshow',:'tenant_a',:'patient_a',:'doctor_a','A1','No show','new','2026-08-16 05:00+00','2026-08-16 06:00+00'),
  (:'appt_completed',:'tenant_a',:'patient_a',:'doctor_a','A1','Completed','completed','2026-08-17 05:00+00','2026-08-17 06:00+00'),
  (:'appt_arrived',:'tenant_a',:'patient_a',:'doctor_a','A1','Arrived','arrived','2026-08-18 05:00+00','2026-08-18 06:00+00'),
  (:'appt_progress',:'tenant_a',:'patient_a',:'doctor_a','A1','Progress','in_progress','2026-08-19 05:00+00','2026-08-19 06:00+00'),
  (:'appt_blocked',:'tenant_a',NULL,:'doctor_a','A1','Blocked','blocked','2026-08-20 05:00+00','2026-08-20 06:00+00'),
  (:'appt_past',:'tenant_a',:'patient_a',:'doctor_a','A1','Past','new','2026-06-01 05:00+00','2026-06-01 06:00+00'),
  (:'appt_visit',:'tenant_a',:'patient_a',:'doctor_a','A1','Visit lifecycle','new','2026-08-21 05:00+00','2026-08-21 06:00+00'),
  (:'appt_delete',:'tenant_a',:'patient_a',:'doctor_a','A1','Hard delete','new','2026-08-22 05:00+00','2026-08-22 06:00+00'),
  (:'appt_b',:'tenant_b',:'patient_b',:'doctor_b','B1','Berlin','new','2026-08-10 08:00+00','2026-08-10 09:00+00'),
  (:'appt_c',:'tenant_c',:'patient_c',:'doctor_c','C1','New York','new','2026-08-10 14:00+00','2026-08-10 15:00+00');

INSERT INTO public.appointments(
  id,tenant_id,patient_id,doctor_id,cabinet,service,status,start_time,end_time,
  confirmation_state,last_confirmation_attempt_at,confirmation_attempt_count,
  confirmation_metadata_version,last_confirmation_outcome
) VALUES
  (:'appt_contact',:'tenant_a',:'patient_a',:'doctor_a','A1','Contact','new','2026-08-11 05:00+00','2026-08-11 06:00+00','contact_in_progress','2026-07-01 00:00+00',1,1,'message_sent'),
  (:'appt_unreachable',:'tenant_a',:'patient_a',:'doctor_a','A1','Unreachable','new','2026-08-13 05:00+00','2026-08-13 06:00+00','unreachable','2026-07-01 00:00+00',1,1,'unreachable'),
  (:'appt_callback',:'tenant_a',:'patient_a',:'doctor_a','A1','Callback','new','2026-08-14 05:00+00','2026-08-14 06:00+00','callback_requested','2026-07-01 00:00+00',1,1,'callback_requested');

INSERT INTO public.appointments(
  id,tenant_id,patient_id,doctor_id,cabinet,service,status,start_time,end_time,
  confirmation_state,confirmed_at,confirmed_by,confirmation_channel,
  last_confirmation_attempt_at,confirmation_attempt_count,confirmation_metadata_version,
  last_confirmation_outcome
) VALUES
  (:'appt_confirmed',:'tenant_a',:'patient_a',:'doctor_a','A1','Confirmed','new','2026-08-12 05:00+00','2026-08-12 06:00+00','confirmed','2026-07-01 00:00+00',:'owner_a','phone','2026-07-01 00:00+00',1,1,'confirmed');

SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.appointment_reminder_jobs), 'disabled policy and migration create no jobs');
SELECT count(*)::text AS visits_before FROM public.patient_visits \gset
SELECT count(*)::text AS encounters_before FROM public.clinical_encounters \gset
SELECT count(*)::text AS services_before FROM public.completed_services \gset
SELECT count(*)::text AS invoices_before FROM public.invoices \gset
SELECT count(*)::text AS payments_before FROM public.payments \gset
SELECT count(*)::text AS refunds_before FROM public.refunds \gset
SELECT count(*)::text AS adjustments_before FROM public.financial_adjustments \gset
SELECT balance::text AS balance_before FROM public.patients WHERE id=:'patient_a' \gset

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
SELECT public.set_tenant_reminder_policy(:'tenant_a',true,true,false,true,'12:00',true,true,true,180);
SELECT set_config('request.jwt.claim.sub',:'owner_b',true);
SELECT public.set_tenant_reminder_policy(:'tenant_b',true,true,false,true,'12:00',true,true,true,180);
SELECT set_config('request.jwt.claim.sub',:'owner_c',true);
SELECT public.set_tenant_reminder_policy(:'tenant_c',true,true,false,true,'12:00',true,true,true,180);

-- Owner/admin/registrar can read policy/jobs; doctor/cashier/no-tenant cannot see queue rows.
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
SELECT public.plan_appointment_reminder_jobs(:'tenant_a',:'appt_a','2026-07-01 00:00+00') AS first_plan \gset
SELECT public.plan_appointment_reminder_jobs(:'tenant_a',:'appt_a','2026-07-01 00:00+00') AS second_plan \gset
SELECT pg_temp.assert_true(jsonb_array_length(:'first_plan'::jsonb->'created')=3, 'unconfirmed creates three jobs');
SELECT pg_temp.assert_true(jsonb_array_length(:'second_plan'::jsonb->'created')=0 AND jsonb_array_length(:'second_plan'::jsonb->'reused')=3, 'repeat planning reuses exact jobs');
SELECT pg_temp.assert_true((SELECT count(*)=3 FROM public.appointment_reminder_jobs WHERE tenant_id=:'tenant_a' AND appointment_id=:'appt_a'), 'repeat planner creates no duplicates');
SELECT pg_temp.assert_true((SELECT count(*)=3 FROM public.audit_events WHERE tenant_id=:'tenant_a' AND action='appointment_reminder_planned' AND appointment_id=:'appt_a'::text), 'replay creates no duplicate audit');
SELECT pg_temp.assert_true((SELECT count(*)=3 FROM public.activity_events WHERE tenant_id=:'tenant_a' AND type='appointment_reminder_planned' AND source_id IN (SELECT id::text FROM public.appointment_reminder_jobs WHERE appointment_id=:'appt_a')), 'activity emitted once per created job');

SELECT set_config('request.jwt.claim.sub',:'admin_a',true);
SELECT pg_temp.assert_true((SELECT count(*)=3 FROM public.appointment_reminder_jobs WHERE tenant_id=:'tenant_a' AND appointment_id=:'appt_a'), 'admin reads own tenant jobs');
SELECT set_config('request.jwt.claim.sub',:'registrar_a',true);
SELECT pg_temp.assert_true((SELECT count(*)=3 FROM public.appointment_reminder_jobs WHERE tenant_id=:'tenant_a' AND appointment_id=:'appt_a'), 'registrar reads operational jobs');
SELECT public.plan_appointment_reminder_jobs(:'tenant_a',:'appt_contact','2026-07-01 00:00+00') AS contact_plan \gset
SELECT pg_temp.assert_true(jsonb_array_length(:'contact_plan'::jsonb->'created')=2, 'contact in progress suppresses repeated confirmation request by default');
SELECT set_config('request.jwt.claim.sub',:'doctor_user_a',true);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.appointment_reminder_jobs WHERE tenant_id=:'tenant_a'), 'doctor has no reminder queue access');
SELECT pg_temp.expect_error(format('select public.plan_appointment_reminder_jobs(%L::uuid,%L::uuid,%L::timestamptz)',:'tenant_a',:'appt_a','2026-07-01 00:00+00'),'Недостаточно прав');
SELECT set_config('request.jwt.claim.sub',:'cashier_a',true);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.appointment_reminder_jobs WHERE tenant_id=:'tenant_a'), 'cashier has no reminder queue access');
SELECT set_config('request.jwt.claim.sub',:'no_tenant',true);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.appointment_reminder_jobs), 'no-tenant user sees no jobs');
SELECT pg_temp.expect_error(format('select public.plan_appointment_reminder_jobs(%L::uuid,%L::uuid,%L::timestamptz)',:'tenant_a',:'appt_a','2026-07-01 00:00+00'),'Недостаточно прав');
SELECT set_config('request.jwt.claim.sub',:'owner_b',true);
SELECT pg_temp.expect_error(format('select public.plan_appointment_reminder_jobs(%L::uuid,%L::uuid,%L::timestamptz)',:'tenant_a',:'appt_a','2026-07-01 00:00+00'),'Недостаточно прав');

-- Timezone calculations are server-side and exact.
SELECT public.plan_appointment_reminder_jobs(:'tenant_b',:'appt_b','2026-07-01 00:00+00');
SELECT set_config('request.jwt.claim.sub',:'owner_c',true);
SELECT public.plan_appointment_reminder_jobs(:'tenant_c',:'appt_c','2026-07-01 00:00+00');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT due_at='2026-08-09 07:00+00' FROM public.appointment_reminder_jobs WHERE appointment_id=:'appt_a' AND reminder_type='day_before_reminder'), 'Asia/Almaty local noon maps to 07:00 UTC');
SELECT pg_temp.assert_true((SELECT due_at='2026-08-09 10:00+00' FROM public.appointment_reminder_jobs WHERE appointment_id=:'appt_b' AND reminder_type='day_before_reminder'), 'Europe/Berlin local noon maps to 10:00 UTC');
SELECT pg_temp.assert_true((SELECT due_at='2026-08-09 16:00+00' FROM public.appointment_reminder_jobs WHERE appointment_id=:'appt_c' AND reminder_type='day_before_reminder'), 'America/New_York local noon maps to 16:00 UTC');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
SELECT public.plan_appointment_reminder_jobs(:'tenant_a',:'appt_confirmed','2026-07-01 00:00+00') AS confirmed_plan \gset
SELECT pg_temp.assert_true(jsonb_array_length(:'confirmed_plan'::jsonb->'created')=1, 'confirmed creates ordinary reminder only');
SELECT public.plan_appointment_reminder_jobs(:'tenant_a',:'appt_unreachable','2026-07-01 00:00+00') AS unreachable_plan \gset
SELECT pg_temp.assert_true(jsonb_array_length(:'unreachable_plan'::jsonb->'created')=1, 'unreachable creates control call only');
SELECT public.plan_appointment_reminder_jobs(:'tenant_a',:'appt_callback','2026-07-01 00:00+00') AS callback_plan \gset
SELECT pg_temp.assert_true((:'callback_plan'::jsonb->>'callbackDeferred')::boolean, 'callback is explicitly deferred without a callback time');
SELECT pg_temp.assert_true(jsonb_array_length(:'callback_plan'::jsonb->'created')=0, 'callback timestamp is not invented');
SELECT public.plan_appointment_reminder_jobs(:'tenant_a',:'appt_completed','2026-07-01 00:00+00');
SELECT public.plan_appointment_reminder_jobs(:'tenant_a',:'appt_arrived','2026-07-01 00:00+00');
SELECT public.plan_appointment_reminder_jobs(:'tenant_a',:'appt_progress','2026-07-01 00:00+00');
SELECT public.plan_appointment_reminder_jobs(:'tenant_a',:'appt_blocked','2026-07-01 00:00+00');
SELECT public.plan_appointment_reminder_jobs(:'tenant_a',:'appt_past','2026-07-01 00:00+00');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.appointment_reminder_jobs WHERE appointment_id IN (:'appt_completed',:'appt_arrived',:'appt_progress',:'appt_blocked',:'appt_past')), 'ineligible and past appointments create no jobs');

-- Visit lifecycle invalidates pending reminder work without rewriting appointment status.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'admin_a',true);
SELECT public.plan_appointment_reminder_jobs(:'tenant_a',:'appt_visit','2026-07-01 00:00+00');
SELECT (public.check_in_patient_visit(:'tenant_a',:'patient_a',:'appt_visit','regular','2026-08-21 04:55+00','Reminder visit lifecycle','{"smokeTest":"reminder-queue"}'::jsonb)).id AS visit_id \gset
SELECT public.start_patient_visit(:'tenant_a',:'visit_id','{"smokeTest":"reminder-queue"}'::jsonb);
SELECT public.complete_patient_visit(:'tenant_a',:'visit_id','{"smokeTest":"reminder-queue"}'::jsonb);
RESET ROLE;
SELECT pg_temp.assert_true((SELECT count(*)=3 FROM public.appointment_reminder_jobs WHERE appointment_id=:'appt_visit' AND state='skipped' AND terminal_reason='appointment_arrived'), 'arrival skips all pending jobs');
SELECT pg_temp.assert_true((SELECT count(*)=3 FROM public.audit_events WHERE action='appointment_reminder_skipped' AND appointment_id=:'appt_visit'::text), 'visit invalidation audits each actual transition once');
DELETE FROM public.patient_visits WHERE id=:'visit_id';

-- Hard delete cascades reminder jobs and leaves no orphan rows.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'admin_a',true);
SELECT public.plan_appointment_reminder_jobs(:'tenant_a',:'appt_delete','2026-07-01 00:00+00');
DELETE FROM public.appointments WHERE tenant_id=:'tenant_a' AND id=:'appt_delete';
RESET ROLE;
SELECT pg_temp.assert_true(NOT EXISTS (SELECT 1 FROM public.appointment_reminder_jobs WHERE appointment_id=:'appt_delete'), 'hard delete cascades reminder jobs');

-- Reschedule atomically supersedes old plans and creates a new version-bound set.
UPDATE public.appointments SET start_time='2026-08-10 07:00+00', end_time='2026-08-10 08:00+00' WHERE id=:'appt_a';
SELECT pg_temp.assert_true((SELECT count(*)=3 FROM public.appointment_reminder_jobs WHERE appointment_id=:'appt_a' AND state='superseded'), 'reschedule supersedes old jobs');
SELECT pg_temp.assert_true((SELECT count(*)=3 FROM public.appointment_reminder_jobs WHERE appointment_id=:'appt_a' AND state='scheduled'), 'reschedule creates new jobs');
SELECT pg_temp.assert_true((SELECT count(DISTINCT appointment_updated_at)=2 FROM public.appointment_reminder_jobs WHERE appointment_id=:'appt_a'), 'jobs bind to exact appointment versions');

-- Completed history survives later cancellation while active jobs are cancelled.
SELECT set_config('app.reminder_job_internal','on',true);
UPDATE public.appointment_reminder_jobs
SET state='completed', completed_at=now(), terminal_reason='manual_test_completion'
WHERE id=(SELECT id FROM public.appointment_reminder_jobs WHERE appointment_id=:'appt_cancel' AND false LIMIT 1);
SELECT set_config('app.reminder_job_internal','off',true);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
SELECT public.plan_appointment_reminder_jobs(:'tenant_a',:'appt_cancel','2026-07-01 00:00+00');
RESET ROLE;
SELECT set_config('app.reminder_job_internal','on',true);
UPDATE public.appointment_reminder_jobs
SET state='completed', completed_at=now(), terminal_reason='manual_test_completion'
WHERE id=(SELECT id FROM public.appointment_reminder_jobs WHERE appointment_id=:'appt_cancel' ORDER BY reminder_type LIMIT 1);
SELECT set_config('app.reminder_job_internal','off',true);
SELECT updated_at::text AS cancel_expected_updated_at FROM public.appointments WHERE id=:'appt_cancel' \gset
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
SELECT public.cancel_appointment(
  :'tenant_a', :'appt_cancel', 'clinic', 'Reminder queue cancellation test',
  :'cancel_expected_updated_at'::timestamptz, 'reminder-queue-cancel-001'
);
RESET ROLE;
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.appointment_reminder_jobs WHERE appointment_id=:'appt_cancel' AND state='completed'), 'completed historical job preserved');
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM public.appointment_reminder_jobs WHERE appointment_id=:'appt_cancel' AND state='cancelled'), 'cancellation cancels remaining pending jobs');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
SELECT public.plan_appointment_reminder_jobs(:'tenant_a',:'appt_noshow','2026-07-01 00:00+00');
RESET ROLE;
SELECT updated_at::text AS noshow_expected_updated_at FROM public.appointments WHERE id=:'appt_noshow' \gset
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
SELECT public.mark_appointment_no_show(
  :'tenant_a', :'appt_noshow', 'Reminder queue no-show test',
  :'noshow_expected_updated_at'::timestamptz, 'reminder-queue-noshow-001'
);
RESET ROLE;
SELECT pg_temp.assert_true((SELECT count(*)=3 FROM public.appointment_reminder_jobs WHERE appointment_id=:'appt_noshow' AND state='cancelled'), 'no-show cancels pending jobs');

-- Policy version changes create new plan identity only when explicitly reconciled.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'admin_a',true);
SELECT public.set_tenant_reminder_policy(:'tenant_a',true,true,false,true,'11:30',true,true,true,120);
SELECT public.plan_appointment_reminder_jobs(:'tenant_a',:'appt_contact','2026-07-01 00:00+00');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT count(DISTINCT policy_version)=2 FROM public.appointment_reminder_jobs WHERE appointment_id=:'appt_contact'), 'policy change yields a new version-bound plan');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.appointment_reminder_jobs j JOIN public.appointments a ON a.id=j.appointment_id AND a.tenant_id=j.tenant_id JOIN public.tenant_reminder_policies p ON p.tenant_id=j.tenant_id WHERE j.state IN ('scheduled','ready') AND (j.appointment_updated_at<>a.updated_at OR j.policy_version<>p.policy_version)), 'active stale jobs zero');

-- Direct writes, invalid values, duplicate keys and tenant mismatches are blocked.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
SELECT pg_temp.expect_error(format('insert into public.appointment_reminder_jobs(tenant_id,appointment_id,patient_id,reminder_type,execution_mode,due_at,state,appointment_updated_at,policy_version,plan_key,payload_fingerprint,metadata) values(%L::uuid,%L::uuid,%L::uuid,%L,%L,now(),%L,now(),1,%L,%L,%L::jsonb)',:'tenant_a',:'appt_a',:'patient_a','day_before_reminder','manual','scheduled',repeat('c',64),repeat('d',64),'{}'),'permission denied');
SELECT pg_temp.expect_error(format('update public.appointment_reminder_jobs set state=%L where tenant_id=%L::uuid','completed',:'tenant_a'),'permission denied');
RESET ROLE;
SELECT set_config('app.reminder_job_internal','on',true);
SELECT pg_temp.expect_error(format('insert into public.appointment_reminder_jobs(tenant_id,appointment_id,patient_id,reminder_type,execution_mode,due_at,state,appointment_updated_at,policy_version,plan_key,payload_fingerprint,metadata) values(%L::uuid,%L::uuid,%L::uuid,%L,%L,now(),%L,now(),1,%L,%L,%L::jsonb)',:'tenant_a',:'appt_a',:'patient_a','marketing','manual','scheduled',repeat('e',64),repeat('f',64),'{}'),'appointment_reminder_jobs_type_check');
SELECT pg_temp.expect_error(format('insert into public.appointment_reminder_jobs(tenant_id,appointment_id,patient_id,reminder_type,execution_mode,due_at,state,appointment_updated_at,policy_version,plan_key,payload_fingerprint,metadata) values(%L::uuid,%L::uuid,%L::uuid,%L,%L,now(),%L,now(),1,%L,%L,%L::jsonb)',:'tenant_a',:'appt_a',:'patient_a','day_before_reminder','manual','sent',repeat('1',64),repeat('2',64),'{}'),'appointment_reminder_jobs_state_check');
SELECT pg_temp.expect_error(format('insert into public.appointment_reminder_jobs(tenant_id,appointment_id,patient_id,reminder_type,execution_mode,due_at,state,appointment_updated_at,policy_version,plan_key,payload_fingerprint,metadata) values(%L::uuid,%L::uuid,%L::uuid,%L,%L,now(),%L,now(),1,%L,%L,%L::jsonb)',:'tenant_a',:'appt_a',:'patient_b','day_before_reminder','manual','scheduled',repeat('3',64),repeat('4',64),'{}'),'appointment_reminder_jobs_patient_fk');
SELECT set_config('app.reminder_job_internal','off',true);

SELECT pg_temp.assert_true((SELECT count(*) FROM public.appointment_reminder_jobs GROUP BY tenant_id,plan_key HAVING count(*)>1 LIMIT 1) IS NULL, 'duplicate plan keys zero');
SELECT pg_temp.assert_true((SELECT count(*) FROM (SELECT tenant_id,appointment_id,reminder_type,due_at,appointment_updated_at,policy_version,count(*) FROM public.appointment_reminder_jobs GROUP BY 1,2,3,4,5,6 HAVING count(*)>1) d)=0, 'duplicate logical jobs zero');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.appointments a1 JOIN public.appointments a2 ON a1.tenant_id=a2.tenant_id AND a1.id<a2.id AND a1.doctor_id=a2.doctor_id AND a1.status NOT IN ('cancelled','no_show','completed') AND a2.status NOT IN ('cancelled','no_show','completed') AND a1.start_time<a2.end_time AND a1.end_time>a2.start_time)=0, 'doctor overlaps remain zero');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.appointments WHERE end_time<=start_time)=0, 'invalid appointment intervals zero');
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.patient_visits)=:'visits_before', 'no visit side effects');
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.clinical_encounters)=:'encounters_before', 'no encounter side effects');
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.completed_services)=:'services_before', 'no completed service side effects');
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.invoices)=:'invoices_before', 'no invoice side effects');
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.payments)=:'payments_before', 'no payment side effects');
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.refunds)=:'refunds_before', 'no refund side effects');
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.financial_adjustments)=:'adjustments_before', 'no adjustment side effects');
SELECT pg_temp.assert_true((SELECT balance::text FROM public.patients WHERE id=:'patient_a')=:'balance_before', 'patient balance unchanged');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.appointment_confirmation_attempts)=0, 'planner creates no confirmation attempt');

ROLLBACK;
\echo 'APPOINTMENT-REMINDER-QUEUE-FOUNDATION-001 SQL validation passed'
