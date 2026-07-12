\set ON_ERROR_STOP on
\echo 'APPOINTMENT-CONFIRMATION-WORKFLOW-001 local SQL validation'

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

\set tenant_a 'a2710000-0000-4000-8000-000000000001'
\set tenant_b 'b2710000-0000-4000-8000-000000000001'
\set owner_a 'a2720000-0000-4000-8000-000000000001'
\set admin_a 'a2720000-0000-4000-8000-000000000002'
\set registrar_a 'a2720000-0000-4000-8000-000000000003'
\set doctor_user_a 'a2720000-0000-4000-8000-000000000004'
\set cashier_a 'a2720000-0000-4000-8000-000000000005'
\set no_tenant 'a2720000-0000-4000-8000-000000000006'
\set unknown_user 'a2720000-0000-4000-8000-000000000007'
\set admin_b 'b2720000-0000-4000-8000-000000000001'
\set patient_a1 'a2730000-0000-4000-8000-000000000001'
\set patient_a2 'a2730000-0000-4000-8000-000000000002'
\set patient_a3 'a2730000-0000-4000-8000-000000000003'
\set patient_b1 'b2730000-0000-4000-8000-000000000001'
\set doctor_a1 'a2740000-0000-4000-8000-000000000001'
\set doctor_a2 'a2740000-0000-4000-8000-000000000002'
\set doctor_b1 'b2740000-0000-4000-8000-000000000001'
\set legacy_confirmed 'a2750000-0000-4000-8000-000000000001'

INSERT INTO public.tenants(id,name) VALUES
  (:'tenant_a','Appointment confirmation A'),
  (:'tenant_b','Appointment confirmation B');

INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) VALUES
  (:'owner_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','acw-owner@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'admin_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','acw-admin@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'registrar_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','acw-registrar@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'doctor_user_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','acw-doctor@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'cashier_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','acw-cashier@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'no_tenant','00000000-0000-0000-0000-000000000000','authenticated','authenticated','acw-notenant@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'unknown_user','00000000-0000-0000-0000-000000000000','authenticated','authenticated','acw-unknown@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
  (:'admin_b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','acw-admin-b@example.local','x',now(),'{"provider":"email"}','{}',now(),now());

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
  (:'patient_a1',:'tenant_a','ACW Patient A1','+77002710001','phone','active',321),
  (:'patient_a2',:'tenant_a','ACW Patient A2','+77002710002','phone','active',654),
  (:'patient_a3',:'tenant_a','ACW Patient A3','+77002710003','phone','active',987),
  (:'patient_b1',:'tenant_b','ACW Patient B1','+77002710004','phone','active',111);

INSERT INTO public.doctors(id,tenant_id,user_id,full_name,specialization,cabinet,color,active) VALUES
  (:'doctor_a1',:'tenant_a',:'doctor_user_a','ACW Doctor A1','General','A1','#111111',true),
  (:'doctor_a2',:'tenant_a',NULL,'ACW Doctor A2','Surgery','A2','#222222',true),
  (:'doctor_b1',:'tenant_b',NULL,'ACW Doctor B1','General','B1','#333333',true);

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

-- Historical compatibility: status=confirmed is not treated as audited confirmation.
SET LOCAL ROLE service_role;
INSERT INTO public.appointments(id,tenant_id,patient_id,doctor_id,cabinet,service,status,start_time,end_time)
VALUES (:'legacy_confirmed',:'tenant_a',:'patient_a1',:'doctor_a1','A1','Legacy confirmed status','confirmed','2026-12-01 08:00+00','2026-12-01 09:00+00');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT status='confirmed' AND confirmation_state='unconfirmed' AND confirmation_metadata_version=0 AND confirmation_attempt_count=0 AND confirmed_at IS NULL AND confirmed_by IS NULL FROM public.appointments WHERE id=:'legacy_confirmed'),'legacy confirmed status remains unverified without fabricated metadata');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);

-- Owner records a trimmed phone/no-answer attempt.
SELECT public.create_appointment(:'tenant_a',:'patient_a1',:'doctor_a1','2026-12-02 08:00+00','2026-12-02 09:00+00','A1','Owner attempt','new','unpaid','phone',100,NULL,'acw-owner-create')::text AS owner_created \gset
SELECT (:'owner_created'::jsonb#>>'{appointment,id}') AS owner_id \gset
SELECT (:'owner_created'::jsonb#>>'{appointment,updated_at}') AS owner_updated \gset
SELECT public.record_appointment_confirmation_attempt(:'tenant_a',:'owner_id','phone','no_answer','  No answer, first call  ',:'owner_updated','acw-owner-attempt-0001')::text AS owner_attempt \gset
SELECT (:'owner_attempt'::jsonb#>>'{appointment,updated_at}') AS owner_attempt_updated \gset
SELECT (:'owner_attempt'::jsonb#>>'{confirmationAttempt,id}') AS owner_attempt_id \gset
SELECT pg_temp.assert_true((:'owner_attempt'::jsonb#>>'{operationType}')='confirmation_attempt','owner attempt operation type');
SELECT pg_temp.assert_true((:'owner_attempt'::jsonb#>>'{appointment,confirmation_state}')='contact_in_progress','no_answer maps to contact_in_progress');
SELECT pg_temp.assert_true((:'owner_attempt'::jsonb#>>'{appointment,confirmation_attempt_count}')::int=1,'attempt count incremented');
SELECT pg_temp.assert_true((:'owner_attempt'::jsonb#>>'{appointment,last_confirmation_attempt_at}') IS NOT NULL,'last attempt timestamp set');
SELECT pg_temp.assert_true((:'owner_attempt'::jsonb#>>'{appointment,confirmed_at}') IS NULL,'no_answer does not confirm');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT note='No answer, first call' AND channel='phone' AND outcome='no_answer' FROM public.appointment_confirmation_attempts WHERE id=:'owner_attempt_id'),'attempt row stores normalized data');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.audit_events WHERE appointment_id=:'owner_id' AND action='appointment_confirmation_attempted'),'one attempt audit event');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.activity_events WHERE source_id=:'owner_id' AND type='appointment_confirmation_attempted'),'one attempt activity event');

-- Safe replay and changed-payload rejection.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
SELECT public.record_appointment_confirmation_attempt(:'tenant_a',:'owner_id','phone','no_answer','  No answer, first call  ',:'owner_updated','acw-owner-attempt-0001')::text AS owner_replay \gset
SELECT pg_temp.assert_true((:'owner_replay'::jsonb->>'replayed')::boolean,'same-key attempt replays');
SELECT pg_temp.assert_true((:'owner_replay'::jsonb#>>'{confirmationAttempt,id}')=:'owner_attempt_id','replay returns same attempt');
SELECT pg_temp.expect_error(format('select public.record_appointment_confirmation_attempt(%L::uuid,%L::uuid,%L,%L,%L,%L::timestamptz,%L)',:'tenant_a',:'owner_id','phone','callback_requested','changed',:'owner_updated','acw-owner-attempt-0001'),'другими параметрами');
SELECT pg_temp.expect_error(format('select public.record_appointment_confirmation_attempt(%L::uuid,%L::uuid,%L,%L,%L,%L::timestamptz,%L)',:'tenant_a',:'owner_id','whatsapp','no_answer','No answer, first call',:'owner_updated','acw-owner-attempt-0001'),'другими параметрами');
SELECT public.get_appointment_operation(:'tenant_a','acw-owner-attempt-0001')::text AS owner_recovery \gset
SELECT pg_temp.assert_true((:'owner_recovery'::jsonb->>'found')::boolean AND (:'owner_recovery'::jsonb#>>'{confirmationAttempt,id}')=:'owner_attempt_id','recovery returns same attempt');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.appointment_confirmation_attempts WHERE appointment_id=:'owner_id'),'replay does not duplicate attempt');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.audit_events WHERE appointment_id=:'owner_id' AND action='appointment_confirmation_attempted'),'replay does not duplicate audit');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.activity_events WHERE source_id=:'owner_id' AND type='appointment_confirmation_attempted'),'replay does not duplicate activity');

-- Admin callback requested and registrar message sent.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'admin_a',true);
SELECT public.create_appointment(:'tenant_a',:'patient_a2',:'doctor_a2','2026-12-03 08:00+00','2026-12-03 09:00+00','A2','Admin callback','new','unpaid','whatsapp',100,NULL,'acw-admin-create')::text AS admin_created \gset
SELECT (:'admin_created'::jsonb#>>'{appointment,id}') AS admin_id \gset
SELECT (:'admin_created'::jsonb#>>'{appointment,updated_at}') AS admin_updated \gset
SELECT public.record_appointment_confirmation_attempt(:'tenant_a',:'admin_id','whatsapp','callback_requested','Call after lunch',:'admin_updated','acw-admin-callback-0001')::text AS admin_callback \gset
SELECT pg_temp.assert_true((:'admin_callback'::jsonb#>>'{appointment,confirmation_state}')='callback_requested','callback state set');
SELECT (:'admin_callback'::jsonb#>>'{appointment,updated_at}') AS admin_callback_updated \gset

SELECT set_config('request.jwt.claim.sub',:'registrar_a',true);
SELECT public.record_appointment_confirmation_attempt(:'tenant_a',:'admin_id','sms','message_sent','  SMS template sent  ',:'admin_callback_updated','acw-registrar-message-0001')::text AS registrar_message \gset
SELECT pg_temp.assert_true((:'registrar_message'::jsonb#>>'{appointment,confirmation_state}')='contact_in_progress','message_sent does not confirm');
SELECT pg_temp.assert_true((:'registrar_message'::jsonb#>>'{appointment,confirmed_at}') IS NULL,'message_sent has no confirmed timestamp');
SELECT (:'registrar_message'::jsonb#>>'{appointment,updated_at}') AS registrar_message_updated \gset

-- Unreachable state.
SELECT public.record_appointment_confirmation_attempt(:'tenant_a',:'admin_id','phone','unreachable','Number unavailable',:'registrar_message_updated','acw-registrar-unreachable-0001')::text AS registrar_unreachable \gset
SELECT pg_temp.assert_true((:'registrar_unreachable'::jsonb#>>'{appointment,confirmation_state}')='unreachable','unreachable state set');

-- Doctor, cashier, no-tenant, unknown, anonymous and cross-tenant are blocked.
SELECT set_config('request.jwt.claim.sub',:'doctor_user_a',true);
SELECT pg_temp.expect_error(format('select public.record_appointment_confirmation_attempt(%L::uuid,%L::uuid,%L,%L,%L,%L::timestamptz,%L)',:'tenant_a',:'owner_id','phone','no_answer','doctor',:'owner_attempt_updated','acw-doctor-attempt-0001'),'Недостаточно прав для подтверждения записи');
SELECT set_config('request.jwt.claim.sub',:'cashier_a',true);
SELECT pg_temp.expect_error(format('select public.confirm_appointment(%L::uuid,%L::uuid,%L,%L,%L::timestamptz,%L)',:'tenant_a',:'owner_id','phone','cashier',:'owner_attempt_updated','acw-cashier-confirm-0001'),'Недостаточно прав для подтверждения записи');
SELECT set_config('request.jwt.claim.sub',:'no_tenant',true);
SELECT pg_temp.expect_error(format('select public.confirm_appointment(%L::uuid,%L::uuid,%L,%L,%L::timestamptz,%L)',:'tenant_a',:'owner_id','phone','no tenant',:'owner_attempt_updated','acw-notenant-confirm-0001'),'Недостаточно прав для подтверждения записи');
SELECT set_config('request.jwt.claim.sub',:'unknown_user',true);
SELECT pg_temp.expect_error(format('select public.record_appointment_confirmation_attempt(%L::uuid,%L::uuid,%L,%L,%L,%L::timestamptz,%L)',:'tenant_a',:'owner_id','phone','no_answer','unknown',:'owner_attempt_updated','acw-unknown-attempt-0001'),'Недостаточно прав для подтверждения записи');
SELECT set_config('request.jwt.claim.sub',:'admin_b',true);
SELECT pg_temp.expect_error(format('select public.confirm_appointment(%L::uuid,%L::uuid,%L,%L,%L::timestamptz,%L)',:'tenant_a',:'owner_id','phone','cross tenant',:'owner_attempt_updated','acw-cross-confirm-0001'),'Недостаточно прав для подтверждения записи');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT pg_temp.expect_error(format('select public.get_appointment_operation(%L::uuid,%L)',:'tenant_a','acw-owner-attempt-0001'),'permission denied');
RESET ROLE;

-- Validation errors are safe.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
SELECT pg_temp.expect_error(format('select public.record_appointment_confirmation_attempt(%L::uuid,%L::uuid,NULL,%L,%L,%L::timestamptz,%L)',:'tenant_a',:'owner_id','no_answer','note',:'owner_attempt_updated','acw-missing-channel'),'Выберите способ связи');
SELECT pg_temp.expect_error(format('select public.record_appointment_confirmation_attempt(%L::uuid,%L::uuid,%L,NULL,%L,%L::timestamptz,%L)',:'tenant_a',:'owner_id','phone','note',:'owner_attempt_updated','acw-missing-outcome'),'Выберите результат связи');
SELECT pg_temp.expect_error(format('select public.record_appointment_confirmation_attempt(%L::uuid,%L::uuid,%L,%L,%L,%L::timestamptz,%L)',:'tenant_a',:'owner_id','telegram','no_answer','note',:'owner_attempt_updated','acw-invalid-channel'),'Выберите способ связи');
SELECT pg_temp.expect_error(format('select public.record_appointment_confirmation_attempt(%L::uuid,%L::uuid,%L,%L,%L,%L::timestamptz,%L)',:'tenant_a',:'owner_id','phone','busy_forever','note',:'owner_attempt_updated','acw-invalid-outcome'),'Выберите результат связи');

-- Direct confirmation produces one attempt and complete metadata.
SELECT public.create_appointment(:'tenant_a',:'patient_a3',:'doctor_a1','2026-12-04 08:00+00','2026-12-04 09:00+00','A1','Direct confirm','new','unpaid','phone',100,NULL,'acw-confirm-create')::text AS confirm_created \gset
SELECT (:'confirm_created'::jsonb#>>'{appointment,id}') AS confirm_id \gset
SELECT (:'confirm_created'::jsonb#>>'{appointment,updated_at}') AS confirm_updated \gset
SELECT public.confirm_appointment(:'tenant_a',:'confirm_id','whatsapp','  Confirmed in WhatsApp  ',:'confirm_updated','acw-direct-confirm-0001')::text AS direct_confirm \gset
SELECT (:'direct_confirm'::jsonb#>>'{confirmationAttempt,id}') AS direct_confirm_attempt_id \gset
SELECT pg_temp.assert_true((:'direct_confirm'::jsonb#>>'{appointment,confirmation_state}')='confirmed','direct confirm state');
SELECT pg_temp.assert_true((:'direct_confirm'::jsonb#>>'{appointment,confirmed_at}') IS NOT NULL,'confirmed_at set');
SELECT pg_temp.assert_true((:'direct_confirm'::jsonb#>>'{appointment,confirmed_by}')=:'owner_a','confirmed_by set');
SELECT pg_temp.assert_true((:'direct_confirm'::jsonb#>>'{appointment,confirmation_channel}')='whatsapp','confirmation channel set');
SELECT pg_temp.assert_true((:'direct_confirm'::jsonb#>>'{appointment,confirmation_note}')='Confirmed in WhatsApp','confirmation note trimmed');
SELECT pg_temp.assert_true((:'direct_confirm'::jsonb#>>'{appointment,confirmation_attempt_count}')::int=1,'direct confirm increments attempt count');
SELECT pg_temp.assert_true((:'direct_confirm'::jsonb#>>'{appointment,status}')='new','confirmation does not change appointment status');
SELECT pg_temp.expect_error(format('select public.confirm_appointment(%L::uuid,%L::uuid,%L,%L,%L::timestamptz,%L)',:'tenant_a',:'confirm_id','phone','again',(:'direct_confirm'::jsonb#>>'{appointment,updated_at}'),'acw-direct-confirm-0002'),'Запись уже подтверждена');
SELECT public.get_appointment_operation(:'tenant_a','acw-direct-confirm-0001')::text AS confirm_recovery \gset
SELECT pg_temp.assert_true((:'confirm_recovery'::jsonb#>>'{confirmationAttempt,id}')=:'direct_confirm_attempt_id','direct confirmation recovery');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.appointment_confirmation_attempts WHERE appointment_id=:'confirm_id' AND outcome='confirmed'),'direct confirm has one attempt row');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.audit_events WHERE appointment_id=:'confirm_id' AND action='appointment_confirmed'),'direct confirm one audit');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.activity_events WHERE source_id=:'confirm_id' AND type='appointment_confirmed'),'direct confirm one activity');

-- Generic details preserves confirmation facts and direct update is blocked.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
SELECT public.update_appointment_details(:'tenant_a'::uuid,:'confirm_id'::uuid,'A1','Edited after confirmation','new','unpaid','phone',100::numeric,'generic edit',(:'direct_confirm'::jsonb#>>'{appointment,updated_at}')::timestamptz)::text AS generic_edit \gset
SELECT pg_temp.assert_true((:'generic_edit'::jsonb#>>'{appointment,confirmation_state}')='confirmed' AND (:'generic_edit'::jsonb#>>'{appointment,confirmation_attempt_count}')::int=1,'generic details preserves confirmation metadata');
SELECT pg_temp.expect_error(format('update public.appointments set confirmation_state=%L where id=%L::uuid','unconfirmed',:'confirm_id'),'Недостаточно прав для изменения записи');

-- Terminal/operational appointment statuses block confirmation actions.
SELECT public.create_appointment(:'tenant_a',:'patient_a1',:'doctor_a2','2026-12-05 08:00+00','2026-12-05 09:00+00','A2','Cancelled target','new','unpaid','phone',100,NULL,'acw-cancelled-create')::text AS cancelled_created \gset
SELECT public.cancel_appointment(:'tenant_a',(:'cancelled_created'::jsonb#>>'{appointment,id}')::uuid,'patient','Cancelled before confirmation',(:'cancelled_created'::jsonb#>>'{appointment,updated_at}')::timestamptz,'acw-cancelled-action')::text AS cancelled_action \gset
SELECT pg_temp.expect_error(format('select public.confirm_appointment(%L::uuid,%L::uuid,%L,%L,%L::timestamptz,%L)',:'tenant_a',(:'cancelled_created'::jsonb#>>'{appointment,id}'),'phone','blocked',(:'cancelled_action'::jsonb#>>'{appointment,updated_at}'),'acw-confirm-cancelled'),'Текущий статус записи');

SELECT public.create_appointment(:'tenant_a',:'patient_a2',:'doctor_a2','2026-12-06 08:00+00','2026-12-06 09:00+00','A2','No-show target','new','unpaid','phone',100,NULL,'acw-noshow-create')::text AS noshow_created \gset
SELECT public.mark_appointment_no_show(:'tenant_a',(:'noshow_created'::jsonb#>>'{appointment,id}')::uuid,'Did not attend',(:'noshow_created'::jsonb#>>'{appointment,updated_at}')::timestamptz,'acw-noshow-action')::text AS noshow_action \gset
SELECT pg_temp.expect_error(format('select public.confirm_appointment(%L::uuid,%L::uuid,%L,%L,%L::timestamptz,%L)',:'tenant_a',(:'noshow_created'::jsonb#>>'{appointment,id}'),'phone','blocked',(:'noshow_action'::jsonb#>>'{appointment,updated_at}'),'acw-confirm-noshow'),'Текущий статус записи');

SELECT public.create_appointment(:'tenant_a',:'patient_a1',:'doctor_a2','2026-12-07 08:00+00','2026-12-07 09:00+00','A2','Completed target','completed','unpaid','phone',100,NULL,'acw-completed-create')::text AS completed_created \gset
SELECT pg_temp.expect_error(format('select public.record_appointment_confirmation_attempt(%L::uuid,%L::uuid,%L,%L,%L,%L::timestamptz,%L)',:'tenant_a',(:'completed_created'::jsonb#>>'{appointment,id}'),'phone','no_answer','blocked',(:'completed_created'::jsonb#>>'{appointment,updated_at}'),'acw-completed-attempt'),'Текущий статус записи');

-- Unknown operation is safe not-found.
SELECT public.get_appointment_operation(:'tenant_a','acw-not-found-0001')::text AS not_found \gset
SELECT pg_temp.assert_true((:'not_found'::jsonb->>'found')='false','unknown operation returns not-found');
RESET ROLE;

-- Tenant-scoped history visibility and deterministic ordering.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
SELECT pg_temp.assert_true((SELECT count(*)>=1 FROM public.appointment_confirmation_attempts WHERE tenant_id=:'tenant_a' AND appointment_id=:'owner_id'),'tenant A reads own attempt history');
SELECT pg_temp.assert_true((
  SELECT array_agg(id ORDER BY attempted_at DESC,id ASC) = array_agg(id ORDER BY attempted_at DESC,id ASC)
  FROM public.appointment_confirmation_attempts WHERE appointment_id=:'admin_id'
),'attempt history ordering is deterministic');
SELECT set_config('request.jwt.claim.sub',:'admin_b',true);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.appointment_confirmation_attempts WHERE tenant_id=:'tenant_a'),'tenant B cannot read tenant A attempt history');
RESET ROLE;

-- Conflict protection is unchanged after confirmation workflow.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
SELECT pg_temp.expect_error(format('select public.create_appointment(%L::uuid,%L::uuid,%L::uuid,%L::timestamptz,%L::timestamptz,%L,%L,%L,%L,%L,%L::numeric,%L,%L)',:'tenant_a',:'patient_a2',:'doctor_a1','2026-12-04 08:30+00','2026-12-04 09:30+00','A1','Overlap','new','unpaid','phone','1','','acw-overlap'),'У врача уже есть запись');
RESET ROLE;

-- RLS and grants remain explicit.
SELECT pg_temp.assert_true((SELECT relrowsecurity FROM pg_class WHERE oid='public.appointment_confirmation_attempts'::regclass),'attempt RLS enabled');
SELECT pg_temp.assert_true(has_table_privilege('authenticated','public.appointment_confirmation_attempts','SELECT'),'authenticated can read attempts');
SELECT pg_temp.assert_true(NOT has_table_privilege('authenticated','public.appointment_confirmation_attempts','INSERT'),'authenticated cannot insert attempts directly');
SELECT pg_temp.assert_true(NOT has_table_privilege('anon','public.appointment_confirmation_attempts','SELECT'),'anon cannot read attempts');

-- Side effects and balances remain unchanged.
SELECT pg_temp.assert_true((SELECT count(*)=:visits_before::bigint FROM public.patient_visits),'no visits created');
SELECT pg_temp.assert_true((SELECT count(*)=:encounters_before::bigint FROM public.clinical_encounters),'no encounters created');
SELECT pg_temp.assert_true((SELECT count(*)=:services_before::bigint FROM public.completed_services),'no completed services created');
SELECT pg_temp.assert_true((SELECT count(*)=:plans_before::bigint FROM public.treatment_plans),'no treatment plans created');
SELECT pg_temp.assert_true((SELECT count(*)=:findings_before::bigint FROM public.findings),'no findings created');
SELECT pg_temp.assert_true((SELECT count(*)=:charts_before::bigint FROM public.dental_charts),'no dental charts created');
SELECT pg_temp.assert_true((SELECT count(*)=:invoices_before::bigint FROM public.invoices),'no invoices created');
SELECT pg_temp.assert_true((SELECT count(*)=:payments_before::bigint FROM public.payments),'no payments created');
SELECT pg_temp.assert_true((SELECT count(*)=:refunds_before::bigint FROM public.refunds),'no refunds created');
SELECT pg_temp.assert_true((SELECT count(*)=:adjustments_before::bigint FROM public.financial_adjustments),'no adjustments created');
SELECT pg_temp.assert_true((SELECT count(*)=:documents_before::bigint FROM public.documents),'no documents created');
SELECT pg_temp.assert_true((SELECT balance::text=:'balance_a1_before' FROM public.patients WHERE id=:'patient_a1'),'patient A1 balance unchanged');
SELECT pg_temp.assert_true((SELECT balance::text=:'balance_a2_before' FROM public.patients WHERE id=:'patient_a2'),'patient A2 balance unchanged');

ROLLBACK;
\echo 'APPOINTMENT-CONFIRMATION-WORKFLOW-001 SQL validation passed'
