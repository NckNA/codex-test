\set ON_ERROR_STOP on
\echo 'COMMUNICATION-ORCHESTRATION-FOUNDATION-001 SQL validation'
BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.assert_true(p_condition boolean, p_message text)
RETURNS void LANGUAGE plpgsql AS $assert$
BEGIN
  IF NOT coalesce(p_condition, false) THEN
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
    RAISE EXCEPTION 'expected error containing "%"', p_expected;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message LIKE 'expected error containing%' THEN RAISE; END IF;
    IF position(lower(p_expected) in lower(v_message)) = 0 THEN
      RAISE EXCEPTION 'expected "%", got "%"', p_expected, v_message;
    END IF;
  END;
END;
$expect$;

\set tenant_a 'd3210000-0000-4000-8000-000000000001'
\set tenant_b 'd3210000-0000-4000-8000-000000000002'
\set owner_a 'd3220000-0000-4000-8000-000000000001'
\set admin_a 'd3220000-0000-4000-8000-000000000002'
\set registrar_a 'd3220000-0000-4000-8000-000000000003'
\set doctor_a 'd3220000-0000-4000-8000-000000000004'
\set cashier_a 'd3220000-0000-4000-8000-000000000005'
\set unknown_user 'd3220000-0000-4000-8000-000000000006'
\set owner_b 'd3220000-0000-4000-8000-000000000007'
\set patient_a 'd3230000-0000-4000-8000-000000000001'
\set patient_b 'd3230000-0000-4000-8000-000000000002'
\set representative_patient 'd3230000-0000-4000-8000-000000000003'
\set doctor_entity_a 'd3240000-0000-4000-8000-000000000001'
\set doctor_entity_b 'd3240000-0000-4000-8000-000000000002'
\set appointment_a 'd3250000-0000-4000-8000-000000000001'
\set appointment_b 'd3250000-0000-4000-8000-000000000002'
\set contact_phone_a 'd3260000-0000-4000-8000-000000000001'
\set contact_email_a 'd3260000-0000-4000-8000-000000000002'
\set contact_rep 'd3260000-0000-4000-8000-000000000003'
\set contact_phone_b 'd3260000-0000-4000-8000-000000000004'

DELETE FROM public.tenants WHERE id IN (:'tenant_a'::uuid, :'tenant_b'::uuid);
DELETE FROM auth.users WHERE id IN (
  :'owner_a'::uuid, :'admin_a'::uuid, :'registrar_a'::uuid, :'doctor_a'::uuid,
  :'cashier_a'::uuid, :'unknown_user'::uuid, :'owner_b'::uuid
);

INSERT INTO public.tenants(id, name, timezone) VALUES
(:'tenant_a', 'Orchestration Test A', 'Asia/Almaty'),
(:'tenant_b', 'Orchestration Test B', 'Europe/Berlin');

INSERT INTO auth.users(
  id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) VALUES
(:'owner_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','orch-owner-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
(:'admin_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','orch-admin-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
(:'registrar_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','orch-registrar-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
(:'doctor_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','orch-doctor-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
(:'cashier_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','orch-cashier-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
(:'unknown_user','00000000-0000-0000-0000-000000000000','authenticated','authenticated','orch-unknown@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
(:'owner_b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','orch-owner-b@example.local','x',now(),'{"provider":"email"}','{}',now(),now());

INSERT INTO public.profiles(id) VALUES
(:'owner_a'),(:'admin_a'),(:'registrar_a'),(:'doctor_a'),(:'cashier_a'),(:'unknown_user'),(:'owner_b');

INSERT INTO public.tenant_users(tenant_id,user_id,role) VALUES
(:'tenant_a',:'owner_a','clinic_owner'),(:'tenant_a',:'admin_a','clinic_admin'),
(:'tenant_a',:'registrar_a','registrar'),(:'tenant_a',:'doctor_a','doctor'),
(:'tenant_a',:'cashier_a','cashier'),(:'tenant_b',:'owner_b','clinic_owner');

INSERT INTO public.doctors(id,tenant_id,user_id,full_name,specialization,cabinet,color,active) VALUES
(:'doctor_entity_a',:'tenant_a',:'doctor_a','Врач Оркестрации','Терапевт','1','#123456',true),
(:'doctor_entity_b',:'tenant_b',NULL,'Врач B','Терапевт','1','#654321',true);

INSERT INTO public.patients(id,tenant_id,full_name,phone,source,status,balance) VALUES
(:'patient_a',:'tenant_a','Пациент Оркестрации',NULL,'phone','active',123.45),
(:'patient_b',:'tenant_b','Пациент B',NULL,'phone','active',0),
(:'representative_patient',:'tenant_a','Пациент Представителя',NULL,'phone','active',0);

INSERT INTO public.appointments(
  id,tenant_id,patient_id,doctor_id,cabinet,service,status,start_time,end_time,created_at,updated_at
) VALUES
(:'appointment_a',:'tenant_a',:'patient_a',:'doctor_entity_a','1','Осмотр','new','2099-07-20 10:00:00+00','2099-07-20 11:00:00+00',now(),'2099-07-13 08:00:00+00'),
(:'appointment_b',:'tenant_b',:'patient_b',:'doctor_entity_b','1','Осмотр','new','2099-07-20 10:00:00+00','2099-07-20 11:00:00+00',now(),'2099-07-13 08:00:00+00');
SELECT updated_at::text AS appointment_a_updated FROM public.appointments WHERE id=:'appointment_a' \gset
SELECT updated_at::text AS appointment_b_updated FROM public.appointments WHERE id=:'appointment_b' \gset

INSERT INTO public.patient_communication_contacts(
  id,tenant_id,patient_id,contact_type,contact_value_raw,contact_value_normalized,
  is_primary,is_verified,verification_source,owner_type,representative_name,representative_relation,language,updated_at
) VALUES
(:'contact_phone_a',:'tenant_a',:'patient_a','phone','+7 700 111 22 33','+77001112233',true,true,'patient_confirmed','patient',NULL,NULL,'ru','2099-07-13 08:00:00+00'),
(:'contact_email_a',:'tenant_a',:'patient_a','email','patient@example.com','patient@example.com',true,true,'patient_confirmed','patient',NULL,NULL,'ru','2099-07-13 08:00:00+00'),
(:'contact_rep',:'tenant_a',:'representative_patient','phone','+7 700 333 44 55','+77003334455',true,true,'representative_confirmed','representative','Мама пациента','parent','ru','2099-07-13 08:00:00+00'),
(:'contact_phone_b',:'tenant_b',:'patient_b','phone','+49 151 12345678','+4915112345678',true,true,'patient_confirmed','patient',NULL,NULL,'en','2099-07-13 08:00:00+00');

UPDATE public.patient_communication_preferences
SET preferred_language='ru',preferred_channel='sms',sms_consent_state='granted',
    whatsapp_consent_state='granted',email_consent_state='granted',
    sms_suppressed=false,whatsapp_suppressed=false,email_suppressed=false,global_suppression=false
WHERE tenant_id=:'tenant_a' AND patient_id=:'patient_a';
UPDATE public.patient_communication_preferences
SET preferred_language='en',preferred_channel='sms',sms_consent_state='granted'
WHERE tenant_id=:'tenant_b' AND patient_id=:'patient_b';
UPDATE public.patient_communication_preferences
SET preferred_language='ru',preferred_channel='sms',sms_consent_state='granted'
WHERE tenant_id=:'tenant_a' AND patient_id=:'representative_patient';

INSERT INTO public.patient_communication_consent_events(
  tenant_id,patient_id,channel,previous_state,new_state,source,actor_user_id,reason,occurred_at,operation_key,fingerprint
) VALUES
(:'tenant_a',:'patient_a','sms','unknown','granted','patient_written',:'owner_a','test',now(),'orch-consent-sms-a',repeat('a',64)),
(:'tenant_a',:'patient_a','whatsapp','unknown','granted','patient_written',:'owner_a','test',now(),'orch-consent-wa-a',repeat('b',64)),
(:'tenant_a',:'patient_a','email','unknown','granted','patient_written',:'owner_a','test',now(),'orch-consent-email-a',repeat('c',64)),
(:'tenant_b',:'patient_b','sms','unknown','granted','patient_written',:'owner_b','test',now(),'orch-consent-sms-b',repeat('d',64)),
(:'tenant_a',:'representative_patient','sms','unknown','granted','representative_written',:'owner_a','test',now(),'orch-consent-rep',repeat('e',64));

-- Scenario jobs. Each is a separate source operation so duplicate logical operations remain forbidden.
INSERT INTO public.appointment_reminder_jobs(
  id,tenant_id,appointment_id,patient_id,reminder_type,execution_mode,due_at,state,
  appointment_updated_at,policy_version,plan_key,payload_fingerprint,priority,created_at,updated_at,original_due_at,metadata
)
SELECT
  ('d3270000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
  :'tenant_a'::uuid, :'appointment_a'::uuid, :'patient_a'::uuid,
  CASE WHEN n=8 THEN 'callback_task' ELSE 'confirmation_request' END,
  'manual','2099-07-19 08:00:00+00','scheduled',
  :'appointment_a_updated'::timestamptz,1,
  encode(extensions.digest('orch-plan-'||n::text,'sha256'),'hex'),
  encode(extensions.digest('orch-payload-'||n::text,'sha256'),'hex'),
  100,now(),('2099-07-13 08:00:00+00'::timestamptz + n * interval '1 microsecond'),
  '2099-07-19 08:00:00+00','{}'::jsonb
FROM generate_series(1,8) n;

INSERT INTO public.appointment_reminder_jobs(
  id,tenant_id,appointment_id,patient_id,reminder_type,execution_mode,due_at,state,
  appointment_updated_at,policy_version,plan_key,payload_fingerprint,priority,created_at,updated_at,original_due_at,metadata
) VALUES
('d3270000-0000-4000-8000-000000000101',:'tenant_b',:'appointment_b',:'patient_b','confirmation_request','manual',
 '2099-07-19 08:00:00+00','scheduled',:'appointment_b_updated'::timestamptz,1,
 encode(extensions.digest('orch-plan-b','sha256'),'hex'),encode(extensions.digest('orch-payload-b','sha256'),'hex'),100,now(),
 '2099-07-13 08:00:00+00','2099-07-19 08:00:00+00','{}');
SELECT updated_at::text AS job_version FROM public.appointment_reminder_jobs WHERE id='d3270000-0000-4000-8000-000000000001' \gset

SELECT count(*)::text AS visits_before FROM public.patient_visits \gset
SELECT count(*)::text AS encounters_before FROM public.clinical_encounters \gset
SELECT count(*)::text AS services_before FROM public.completed_services \gset
SELECT count(*)::text AS invoices_before FROM public.invoices \gset
SELECT count(*)::text AS payments_before FROM public.payments \gset
SELECT count(*)::text AS confirmations_before FROM public.appointment_confirmation_attempts \gset
SELECT balance::text AS balance_before FROM public.patients WHERE id=:'patient_a' \gset

SELECT pg_temp.assert_true(has_function_privilege('authenticated','public.communication_tenant_role(uuid)','EXECUTE'),'authenticated can execute RLS role helper');

-- 1-9 role/read isolation before route setup.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.communication_routes),'owner route read');
SELECT set_config('request.jwt.claim.sub',:'admin_a',true);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.communication_routes),'admin route read');
SELECT set_config('request.jwt.claim.sub',:'registrar_a',true);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.communication_routes),'registrar safe read');
SELECT set_config('request.jwt.claim.sub',:'doctor_a',true);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.communication_routes),'doctor blocked');
SELECT set_config('request.jwt.claim.sub',:'cashier_a',true);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.communication_routes),'cashier blocked');
SELECT set_config('request.jwt.claim.sub',:'unknown_user',true);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.communication_routes),'unknown blocked');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT pg_temp.expect_error('select count(*) from public.communication_routes','permission denied');
RESET ROLE;

-- 10-15 route administration and adapter allowlist.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
SELECT public.create_or_update_communication_route(
  :'tenant_a',NULL,'sms','noop',true,100,NULL,'orch-route-sms-noop-001'
) AS route_noop_result \gset
SELECT (:'route_noop_result'::jsonb->'route'->>'id') AS route_noop_id \gset
SELECT pg_temp.assert_true(:'route_noop_result'::jsonb->>'changed'='true','owner creates noop route');

SELECT set_config('request.jwt.claim.sub',:'admin_a',true);
SELECT public.create_or_update_communication_route(
  :'tenant_a',NULL,'sms','mock',true,50,NULL,'orch-route-sms-mock-001'
) AS route_mock_result \gset
SELECT (:'route_mock_result'::jsonb->'route'->>'id') AS route_sms_id \gset
SELECT (:'route_mock_result'::jsonb->'route'->>'updatedAt') AS route_sms_updated \gset
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.communication_routes WHERE tenant_id=:'tenant_a' AND channel='sms' AND enabled AND archived_at IS NULL),'one active route per channel');
SELECT pg_temp.assert_true(:'route_noop_id'::uuid <> :'route_sms_id'::uuid,'new route creation preserves prior route history');
SELECT pg_temp.assert_true((SELECT NOT enabled FROM public.communication_routes WHERE id=:'route_noop_id'),'prior route disabled when replacement becomes active');
SELECT pg_temp.expect_error(format(
  'select public.create_or_update_communication_route(%L::uuid,NULL,%L,%L,true,100,NULL,%L)',
  :'tenant_a','whatsapp','amocrm','orch-real-adapter'
),'Реальная отправка');
SELECT set_config('request.jwt.claim.sub',:'registrar_a',true);
SELECT pg_temp.expect_error(format(
  'select public.create_or_update_communication_route(%L::uuid,NULL,%L,%L,true,100,NULL,%L)',
  :'tenant_a','whatsapp','mock','orch-registrar-route'
),'Недостаточно прав');
SELECT set_config('request.jwt.claim.sub',:'owner_b',true);
SELECT public.create_or_update_communication_route(
  :'tenant_b',NULL,'sms','mock',true,100,NULL,'orch-route-b-001'
);
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.communication_routes),'tenant B reads only own route');
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM public.communication_routes),'tenant A sees own historical disabled and active routes');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.communication_routes WHERE tenant_id=:'tenant_b'),'cross-tenant route read blocked');

-- Template foundation prerequisite for orchestration regression.
SELECT public.create_communication_template(
  :'tenant_a','appointment_confirmation_request','sms','ru','Orchestration RU SMS',NULL,
  'Здравствуйте, {{patient_first_name}}. Запись в {{clinic_name}} на {{appointment_date}} в {{appointment_time}}.',
  'orch-template-a-create'
) AS template_a_result \gset
SELECT (:'template_a_result'::jsonb->'template'->>'id') AS template_a_id,
       (:'template_a_result'::jsonb->'version'->>'id') AS template_a_version_id,
       (:'template_a_result'::jsonb->'version'->>'updatedAt') AS template_a_version_updated \gset
SELECT public.publish_communication_template_version(
  :'tenant_a',:'template_a_id',:'template_a_version_id',:'template_a_version_updated'::timestamptz,
  'orch-template-a-publish'
);
SELECT set_config('request.jwt.claim.sub',:'owner_b',true);
SELECT public.create_communication_template(
  :'tenant_b','appointment_confirmation_request','sms','en','Orchestration EN SMS',NULL,
  'Hello, {{patient_first_name}}. Appointment at {{clinic_name}} on {{appointment_date}} at {{appointment_time}}.',
  'orch-template-b-create'
) AS template_b_result \gset
SELECT (:'template_b_result'::jsonb->'template'->>'id') AS template_b_id,
       (:'template_b_result'::jsonb->'version'->>'id') AS template_b_version_id,
       (:'template_b_result'::jsonb->'version'->>'updatedAt') AS template_b_version_updated \gset
SELECT public.publish_communication_template_version(
  :'tenant_b',:'template_b_id',:'template_b_version_id',:'template_b_version_updated'::timestamptz,
  'orch-template-b-publish'
);
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);

-- No route safely blocks whatsapp.
SELECT pg_temp.expect_error(format(
  'select public.prepare_communication_operation(%L::uuid,%L::uuid,%L,%L,%L::timestamptz,%L::timestamptz)',
  :'tenant_a','d3270000-0000-4000-8000-000000000001','whatsapp','orch-no-route-prepare',
  :'job_version'::timestamptz,:'appointment_a_updated'::timestamptz
),'не настроен тестовый маршрут');

-- 16-41 preparation, snapshots, privacy and idempotency.
SELECT public.prepare_communication_operation(
  :'tenant_a','d3270000-0000-4000-8000-000000000001','sms','orch-prepare-001',
  :'job_version'::timestamptz,:'appointment_a_updated'::timestamptz
) AS prepare_result \gset
SELECT (:'prepare_result'::jsonb->'operation'->>'id') AS operation_1 \gset
SELECT (:'prepare_result'::jsonb->'operation'->>'updatedAt') AS operation_1_updated \gset
SELECT :'operation_1' AS operation_1_original \gset
SELECT pg_temp.assert_true(:'prepare_result'::jsonb->'operation'->>'purposeCode'='appointment_confirmation_request','purpose derived');
SELECT pg_temp.assert_true(:'prepare_result'::jsonb->'operation'->>'state'='prepared','prepared state');
SELECT pg_temp.assert_true(:'prepare_result'::jsonb->'operation'->'eligibilitySnapshot'->>'eligible'='true','eligibility snapshot');
SELECT pg_temp.assert_true(:'prepare_result'::jsonb->'operation'->'consentSnapshot'->>'state'='granted','consent snapshot');
SELECT pg_temp.assert_true(:'prepare_result'::jsonb->'operation'->'suppressionSnapshot'->>'global'='false','suppression snapshot');
SELECT pg_temp.assert_true(:'prepare_result'::jsonb->'operation'->'routeSnapshot'->>'adapterCode'='mock','route snapshot');
SELECT pg_temp.assert_true(:'prepare_result'::jsonb->'operation'->'contactSnapshot'->>'maskedDestination'='+7700***2233','masked destination');
SELECT pg_temp.assert_true(position('+77001112233' in :'prepare_result')=0,'raw destination absent from safe operation');
SELECT pg_temp.assert_true((SELECT contact_snapshot->>'destinationFingerprint' ~ '^[0-9a-f]{64}$' FROM public.communication_operations WHERE id=:'operation_1'),'destination fingerprint');
SELECT pg_temp.assert_true((SELECT NOT command ? 'diagnosis' AND NOT command ? 'payment' FROM public.communication_operations WHERE id=:'operation_1'),'clinical and financial variables absent');

SELECT public.prepare_communication_operation(
  :'tenant_a','d3270000-0000-4000-8000-000000000001','sms','orch-prepare-001',
  :'job_version'::timestamptz,:'appointment_a_updated'::timestamptz
) AS prepare_replay \gset
SELECT pg_temp.assert_true(:'prepare_replay'::jsonb->>'replayed'='true' AND :'prepare_replay'::jsonb->'operation'->>'id'=:'operation_1','same preparation key replays');
SELECT pg_temp.expect_error(format(
  'select public.prepare_communication_operation(%L::uuid,%L::uuid,%L,%L,%L::timestamptz,%L::timestamptz)',
  :'tenant_a','d3270000-0000-4000-8000-000000000001','email','orch-prepare-001',
  :'job_version'::timestamptz,:'appointment_a_updated'::timestamptz
),'другими параметрами');
SELECT pg_temp.expect_error(format(
  'select public.prepare_communication_operation(%L::uuid,%L::uuid,%L,%L,%L::timestamptz,%L::timestamptz)',
  :'tenant_a','d3270000-0000-4000-8000-000000000001','sms','orch-prepare-duplicate',
  :'job_version'::timestamptz,:'appointment_a_updated'::timestamptz
),'duplicate');

-- Supported callback purpose remains blocked without an exact active template.
SELECT pg_temp.expect_error(format(
  'select public.prepare_communication_operation(%L::uuid,%L::uuid,%L,%L,%L::timestamptz,%L::timestamptz)',
  :'tenant_a','d3270000-0000-4000-8000-000000000008','sms','orch-callback-no-template',
  :'job_version'::timestamptz,:'appointment_a_updated'::timestamptz
),'нет активного шаблона');

-- Role and direct write protections.
SELECT set_config('request.jwt.claim.sub',:'registrar_a',true);
SELECT pg_temp.expect_error(format(
  'select public.prepare_communication_operation(%L::uuid,%L::uuid,%L,%L,%L::timestamptz,%L::timestamptz)',
  :'tenant_a','d3270000-0000-4000-8000-000000000002','sms','orch-registrar-prepare',
  :'job_version'::timestamptz,:'appointment_a_updated'::timestamptz
),'Недостаточно прав');
SELECT pg_temp.expect_error('insert into public.communication_operations(id) values(gen_random_uuid())','permission denied');
SELECT pg_temp.expect_error(format('update public.communication_routes set priority=1 where id=%L::uuid',:'route_sms_id'),'permission denied');
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);

-- Consent/suppression/contact blockers using controlled state changes then restoration.
RESET ROLE;
UPDATE public.patient_communication_preferences SET sms_consent_state='unknown' WHERE tenant_id=:'tenant_a' AND patient_id=:'patient_a';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
SELECT pg_temp.expect_error(format(
  'select public.prepare_communication_operation(%L::uuid,%L::uuid,%L,%L,%L::timestamptz,%L::timestamptz)',
  :'tenant_a','d3270000-0000-4000-8000-000000000002','sms','orch-consent-unknown',
  :'job_version'::timestamptz,:'appointment_a_updated'::timestamptz
),'Контакт или согласие');
RESET ROLE;
UPDATE public.patient_communication_preferences SET sms_consent_state='granted',sms_suppressed=true,sms_suppression_reason='patient_request',sms_suppressed_at=now() WHERE tenant_id=:'tenant_a' AND patient_id=:'patient_a';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
SELECT pg_temp.expect_error(format(
  'select public.prepare_communication_operation(%L::uuid,%L::uuid,%L,%L,%L::timestamptz,%L::timestamptz)',
  :'tenant_a','d3270000-0000-4000-8000-000000000002','sms','orch-suppressed',
  :'job_version'::timestamptz,:'appointment_a_updated'::timestamptz
),'Контакт или согласие');
RESET ROLE;
UPDATE public.patient_communication_preferences SET sms_suppressed=false,sms_suppression_reason=NULL,sms_suppressed_at=NULL WHERE tenant_id=:'tenant_a' AND patient_id=:'patient_a';
UPDATE public.patient_communication_contacts SET is_verified=false WHERE id=:'contact_phone_a';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
SELECT pg_temp.expect_error(format(
  'select public.prepare_communication_operation(%L::uuid,%L::uuid,%L,%L,%L::timestamptz,%L::timestamptz)',
  :'tenant_a','d3270000-0000-4000-8000-000000000002','sms','orch-unverified',
  :'job_version'::timestamptz,:'appointment_a_updated'::timestamptz
),'Контакт или согласие');
RESET ROLE;
UPDATE public.patient_communication_contacts SET is_verified=true WHERE id=:'contact_phone_a';
SELECT pg_temp.assert_true((SELECT state='cancelled' FROM public.communication_operations WHERE id=:'operation_1_original'::uuid),'stale prepared operation is cancelled after consent suppression or contact changes');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
SELECT public.prepare_communication_operation(
  :'tenant_a','d3270000-0000-4000-8000-000000000001','sms','orch-prepare-after-reconciliation',
  :'job_version'::timestamptz,:'appointment_a_updated'::timestamptz
) AS prepare_after_reconciliation \gset
SELECT (:'prepare_after_reconciliation'::jsonb->'operation'->>'id') AS operation_1 \gset
SELECT (:'prepare_after_reconciliation'::jsonb->'operation'->>'updatedAt') AS operation_1_updated \gset

-- 42-52 normalized simulation scenarios and recovery.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
SELECT public.simulate_communication_operation(
  :'tenant_a',:'operation_1','success','orch-sim-success',:'operation_1_updated'
) AS sim_success \gset
SELECT pg_temp.assert_true(:'sim_success'::jsonb->'operation'->>'state'='simulation_succeeded','success normalized');
SELECT pg_temp.assert_true(:'sim_success'::jsonb->'operation'->>'adapterResultCode'='accepted','accepted is simulation only');
SELECT pg_temp.assert_true(:'sim_success'::jsonb->'operation'->>'uncertain'='false','success certain');

-- Prepare separate source jobs and simulate each result.
SELECT public.prepare_communication_operation(:'tenant_a','d3270000-0000-4000-8000-000000000002','sms','orch-prepare-002',:'job_version'::timestamptz,:'appointment_a_updated'::timestamptz) AS p2 \gset
SELECT public.simulate_communication_operation(:'tenant_a',(:'p2'::jsonb->'operation'->>'id')::uuid,'rejected','orch-sim-rejected',(:'p2'::jsonb->'operation'->>'updatedAt')::timestamptz) AS s2 \gset
SELECT pg_temp.assert_true(:'s2'::jsonb->'operation'->>'adapterResultCode'='rejected','rejected normalized');

SELECT public.prepare_communication_operation(:'tenant_a','d3270000-0000-4000-8000-000000000003','sms','orch-prepare-003',:'job_version'::timestamptz,:'appointment_a_updated'::timestamptz) AS p3 \gset
SELECT public.simulate_communication_operation(:'tenant_a',(:'p3'::jsonb->'operation'->>'id')::uuid,'temporary_failure','orch-sim-temp',(:'p3'::jsonb->'operation'->>'updatedAt')::timestamptz) AS s3 \gset
SELECT pg_temp.assert_true(:'s3'::jsonb->'operation'->>'adapterResultCode'='temporary_failure' AND :'s3'::jsonb->'operation'->>'retryable'='true','temporary failure normalized');

SELECT public.prepare_communication_operation(:'tenant_a','d3270000-0000-4000-8000-000000000004','sms','orch-prepare-004',:'job_version'::timestamptz,:'appointment_a_updated'::timestamptz) AS p4 \gset
SELECT public.simulate_communication_operation(:'tenant_a',(:'p4'::jsonb->'operation'->>'id')::uuid,'permanent_failure','orch-sim-perm',(:'p4'::jsonb->'operation'->>'updatedAt')::timestamptz) AS s4 \gset
SELECT pg_temp.assert_true(:'s4'::jsonb->'operation'->>'adapterResultCode'='permanent_failure','permanent failure normalized');

SELECT public.prepare_communication_operation(:'tenant_a','d3270000-0000-4000-8000-000000000005','sms','orch-prepare-005',:'job_version'::timestamptz,:'appointment_a_updated'::timestamptz) AS p5 \gset
SELECT public.simulate_communication_operation(:'tenant_a',(:'p5'::jsonb->'operation'->>'id')::uuid,'timeout_before_acceptance','orch-sim-before',(:'p5'::jsonb->'operation'->>'updatedAt')::timestamptz) AS s5 \gset
SELECT pg_temp.assert_true(:'s5'::jsonb->'operation'->>'adapterResultCode'='timeout_before_acceptance' AND :'s5'::jsonb->'operation'->>'retryable'='true','timeout before acceptance normalized');

SELECT public.prepare_communication_operation(:'tenant_a','d3270000-0000-4000-8000-000000000006','sms','orch-prepare-006',:'job_version'::timestamptz,:'appointment_a_updated'::timestamptz) AS p6 \gset
SELECT public.simulate_communication_operation(:'tenant_a',(:'p6'::jsonb->'operation'->>'id')::uuid,'timeout_after_acceptance','orch-sim-after',(:'p6'::jsonb->'operation'->>'updatedAt')::timestamptz) AS s6 \gset
SELECT pg_temp.assert_true(:'s6'::jsonb->'operation'->>'state'='simulation_uncertain' AND :'s6'::jsonb->'operation'->>'uncertain'='true','timeout after acceptance uncertain');
SELECT public.recover_communication_operation(:'tenant_a',(:'p6'::jsonb->'operation'->>'id')::uuid,'orch-recover-after') AS recover_after \gset
SELECT pg_temp.assert_true(:'recover_after'::jsonb->'operation'->>'state'='simulation_uncertain','uncertain recovery does not retry');

SELECT public.prepare_communication_operation(:'tenant_a','d3270000-0000-4000-8000-000000000007','sms','orch-prepare-007',:'job_version'::timestamptz,:'appointment_a_updated'::timestamptz) AS p7 \gset
SELECT public.simulate_communication_operation(:'tenant_a',(:'p7'::jsonb->'operation'->>'id')::uuid,'unknown','orch-sim-unknown',(:'p7'::jsonb->'operation'->>'updatedAt')::timestamptz) AS s7 \gset
SELECT pg_temp.assert_true(:'s7'::jsonb->'operation'->>'state'='simulation_uncertain','unknown uncertain');
SELECT public.simulate_communication_operation(:'tenant_a',(:'p7'::jsonb->'operation'->>'id')::uuid,'unknown','orch-sim-unknown',(:'p7'::jsonb->'operation'->>'updatedAt')::timestamptz) AS sim_replay \gset
SELECT pg_temp.assert_true(:'sim_replay'::jsonb->>'replayed'='true','simulation replay safe');

-- 53-63 authoritative facts and side effects remain unchanged.
SELECT pg_temp.assert_true((SELECT state='scheduled' FROM public.appointment_reminder_jobs WHERE id='d3270000-0000-4000-8000-000000000001'),'reminder job unchanged');
SELECT pg_temp.assert_true((SELECT confirmation_state='unconfirmed' AND confirmation_attempt_count=0 FROM public.appointments WHERE id=:'appointment_a'),'appointment confirmation unchanged');
SELECT pg_temp.assert_true((SELECT count(*)::text=:'confirmations_before' FROM public.appointment_confirmation_attempts),'no confirmation attempts');
SELECT pg_temp.assert_true((SELECT count(*)::text=:'visits_before' FROM public.patient_visits),'no visits');
SELECT pg_temp.assert_true((SELECT count(*)::text=:'encounters_before' FROM public.clinical_encounters),'no encounters');
SELECT pg_temp.assert_true((SELECT count(*)::text=:'services_before' FROM public.completed_services),'no services');
SELECT pg_temp.assert_true((SELECT count(*)::text=:'invoices_before' FROM public.invoices),'no invoices');
SELECT pg_temp.assert_true((SELECT count(*)::text=:'payments_before' FROM public.payments),'no payments');
SELECT pg_temp.assert_true((SELECT balance::text=:'balance_before' FROM public.patients WHERE id=:'patient_a'),'patient balance unchanged');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.communication_operations WHERE contact_snapshot::text LIKE '%+77001112233%'),'raw destination absent');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.communication_operations WHERE (command->'variables') ?| ARRAY['diagnosis','complaint','finding','payment','balance']),'clinical/financial variables absent');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM (
  SELECT tenant_id,reminder_job_id,channel,appointment_updated_at,reminder_job_updated_at,contact_updated_at,payload_fingerprint,count(*)
  FROM public.communication_operations
  WHERE state <> 'cancelled'
  GROUP BY tenant_id,reminder_job_id,channel,appointment_updated_at,reminder_job_updated_at,contact_updated_at,payload_fingerprint
  HAVING count(*)>1
) duplicates),'duplicate active operations zero');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.communication_operations WHERE uncertain AND state <> 'simulation_uncertain'),'uncertainty state consistent');
SELECT pg_temp.assert_true((SELECT count(*) >= 7 FROM public.audit_events WHERE action LIKE 'communication_operation_%'),'communication audit exists');
SELECT pg_temp.assert_true((SELECT count(*) = (SELECT count(*) FROM public.activity_events WHERE type LIKE 'communication_operation_%') FROM public.audit_events WHERE action LIKE 'communication_operation_%'),'audit/activity parity');

RESET ROLE;
SELECT pg_temp.assert_true((SELECT relrowsecurity FROM pg_class WHERE oid='public.communication_operations'::regclass),'operation RLS enabled');
SELECT pg_temp.assert_true((SELECT relrowsecurity FROM pg_class WHERE oid='public.communication_routes'::regclass),'route RLS enabled');

ROLLBACK;
\echo 'COMMUNICATION-ORCHESTRATION-FOUNDATION-001 SQL validation passed'
