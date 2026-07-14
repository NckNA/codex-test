\set ON_ERROR_STOP on
\echo 'COMMUNICATION-TEMPLATE-FOUNDATION-001 SQL validation'
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
(:'doctor_entity_a',:'tenant_a',:'doctor_a','Р’СЂР°С‡ РћСЂРєРµСЃС‚СЂР°С†РёРё','РўРµСЂР°РїРµРІС‚','1','#123456',true),
(:'doctor_entity_b',:'tenant_b',NULL,'Р’СЂР°С‡ B','РўРµСЂР°РїРµРІС‚','1','#654321',true);

INSERT INTO public.patients(id,tenant_id,full_name,phone,source,status,balance) VALUES
(:'patient_a',:'tenant_a','РџР°С†РёРµРЅС‚ РћСЂРєРµСЃС‚СЂР°С†РёРё',NULL,'phone','active',123.45),
(:'patient_b',:'tenant_b','РџР°С†РёРµРЅС‚ B',NULL,'phone','active',0),
(:'representative_patient',:'tenant_a','РџР°С†РёРµРЅС‚ РџСЂРµРґСЃС‚Р°РІРёС‚РµР»СЏ',NULL,'phone','active',0);

INSERT INTO public.appointments(
  id,tenant_id,patient_id,doctor_id,cabinet,service,status,start_time,end_time,created_at,updated_at
) VALUES
(:'appointment_a',:'tenant_a',:'patient_a',:'doctor_entity_a','1','РћСЃРјРѕС‚СЂ','new','2099-07-20 10:00:00+00','2099-07-20 11:00:00+00',now(),'2099-07-13 08:00:00+00'),
(:'appointment_b',:'tenant_b',:'patient_b',:'doctor_entity_b','1','РћСЃРјРѕС‚СЂ','new','2099-07-20 10:00:00+00','2099-07-20 11:00:00+00',now(),'2099-07-13 08:00:00+00');
SELECT updated_at::text AS appointment_a_updated FROM public.appointments WHERE id=:'appointment_a' \gset
SELECT updated_at::text AS appointment_b_updated FROM public.appointments WHERE id=:'appointment_b' \gset

INSERT INTO public.patient_communication_contacts(
  id,tenant_id,patient_id,contact_type,contact_value_raw,contact_value_normalized,
  is_primary,is_verified,verification_source,owner_type,representative_name,representative_relation,language,updated_at
) VALUES
(:'contact_phone_a',:'tenant_a',:'patient_a','phone','+7 700 111 22 33','+77001112233',true,true,'patient_confirmed','patient',NULL,NULL,'ru','2099-07-13 08:00:00+00'),
(:'contact_email_a',:'tenant_a',:'patient_a','email','patient@example.com','patient@example.com',true,true,'patient_confirmed','patient',NULL,NULL,'ru','2099-07-13 08:00:00+00'),
(:'contact_rep',:'tenant_a',:'representative_patient','phone','+7 700 333 44 55','+77003334455',true,true,'representative_confirmed','representative','РњР°РјР° РїР°С†РёРµРЅС‚Р°','parent','ru','2099-07-13 08:00:00+00'),
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


-- Role/RLS and empty-state access.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.communication_templates),'1 owner reads templates');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.communication_template_versions),'2 owner reads versions');
SELECT set_config('request.jwt.claim.sub',:'admin_a',true);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.communication_templates),'3 admin reads templates');
SELECT set_config('request.jwt.claim.sub',:'registrar_a',true);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.communication_templates),'4 registrar read-only templates');
SELECT set_config('request.jwt.claim.sub',:'doctor_a',true);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.communication_templates),'5 doctor blocked by RLS');
SELECT set_config('request.jwt.claim.sub',:'cashier_a',true);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.communication_templates),'6 cashier blocked by RLS');
SELECT set_config('request.jwt.claim.sub',:'unknown_user',true);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.communication_templates),'7 unknown blocked by RLS');
SELECT pg_temp.expect_error(format(
  'select public.list_communication_templates(%L::uuid,NULL,NULL,NULL)',:'tenant_a'
),'Недостаточно прав');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT pg_temp.expect_error('select count(*) from public.communication_templates','permission denied');
SELECT pg_temp.expect_error('select count(*) from public.communication_template_versions','permission denied');
RESET ROLE;

-- Simulation route exists, but preparation is blocked until an exact template is published.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
SELECT public.create_or_update_communication_route(
  :'tenant_a',NULL,'sms','mock',true,100,NULL,'template-route-a'
) AS route_a_result \gset
SELECT pg_temp.expect_error(format(
  'select public.prepare_communication_operation(%L::uuid,%L::uuid,%L,%L,%L::timestamptz,%L::timestamptz)',
  :'tenant_a','d3270000-0000-4000-8000-000000000001','sms','template-no-active-prepare',
  :'job_version'::timestamptz,:'appointment_a_updated'::timestamptz
),'нет активного шаблона');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.communication_operations),'8 no operation without active template');

-- Owner creates the stable RU/SMS identity and first draft.
SELECT public.create_communication_template(
  :'tenant_a','appointment_confirmation_request','sms','ru','Подтверждение RU SMS',NULL,
  'Здравствуйте, {{patient_first_name}}. Запись в {{clinic_name}} на {{appointment_date}} в {{appointment_time}}.',
  'template-create-ru-sms-001'
) AS create_result \gset
SELECT (:'create_result'::jsonb->'template'->>'id') AS template_id \gset
SELECT (:'create_result'::jsonb->'version'->>'id') AS draft_v1_id \gset
SELECT (:'create_result'::jsonb->'version'->>'updatedAt') AS draft_v1_updated \gset
SELECT pg_temp.assert_true(:'create_result'::jsonb->>'replayed'='false','9 template create is new');
SELECT pg_temp.assert_true(:'create_result'::jsonb->'template'->>'status'='inactive','10 new template inactive');
SELECT pg_temp.assert_true(:'create_result'::jsonb->'version'->>'status'='draft','11 initial version draft');
SELECT pg_temp.assert_true(:'create_result'::jsonb->'version'->>'versionNumber'='1','12 initial version number one');
SELECT pg_temp.assert_true(:'create_result'::jsonb->'version'->'variableKeys'=to_jsonb(ARRAY['appointment_date','appointment_time','clinic_name','patient_first_name']::text[]),'13 ordered variables');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.communication_templates WHERE tenant_id=:'tenant_a'),'14 one stable template');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.communication_template_versions WHERE tenant_id=:'tenant_a'),'15 one draft version');
SELECT pg_temp.assert_true((SELECT content_fingerprint ~ '^[0-9a-f]{64}$' FROM public.communication_template_versions WHERE id=:'draft_v1_id'),'16 content fingerprint');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT content_fingerprint=public.communication_hash(jsonb_build_object(
  'channel','sms','subject',NULL,'body','Здравствуйте, {{patient_first_name}}. Запись в {{clinic_name}} на {{appointment_date}} в {{appointment_time}}.',
  'variableKeys',ARRAY['appointment_date','appointment_time','clinic_name','patient_first_name']::text[]
)::text) FROM public.communication_template_versions WHERE id=:'draft_v1_id'),'17 deterministic content fingerprint');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);

-- Idempotency and changed-payload conflict.
SELECT public.create_communication_template(
  :'tenant_a','appointment_confirmation_request','sms','ru','Подтверждение RU SMS',NULL,
  'Здравствуйте, {{patient_first_name}}. Запись в {{clinic_name}} на {{appointment_date}} в {{appointment_time}}.',
  'template-create-ru-sms-001'
) AS create_replay \gset
SELECT pg_temp.assert_true(:'create_replay'::jsonb->>'replayed'='true','18 same create key replays');
SELECT pg_temp.assert_true(:'create_replay'::jsonb->'template'->>'id'=:'template_id','19 create replay identity stable');
SELECT pg_temp.expect_error(format(
  'select public.create_communication_template(%L::uuid,%L,%L,%L,%L,NULL,%L,%L)',
  :'tenant_a','appointment_confirmation_request','sms','ru','Changed','Другой текст','template-create-ru-sms-001'
),'другими параметрами');
SELECT pg_temp.expect_error(format(
  'select public.create_communication_template(%L::uuid,%L,%L,%L,%L,NULL,%L,%L)',
  :'tenant_a','appointment_confirmation_request','sms','ru','Duplicate','Текст','template-create-duplicate'
),'уже существует');

-- Admin creates a separate KK identity; registrar cannot mutate.
SELECT set_config('request.jwt.claim.sub',:'admin_a',true);
SELECT public.create_communication_template(
  :'tenant_a','appointment_same_day_reminder','sms','kk','Сол күнгі еске салу',NULL,
  'Сәлеметсіз бе, {{patient_first_name}}. {{appointment_time}} уақытында {{clinic_name}} клиникасында жазбаңыз бар.',
  'template-create-kk-sms-001'
) AS kk_create_result \gset
SELECT pg_temp.assert_true(:'kk_create_result'::jsonb->'template'->>'language'='kk','20 admin creates KK template');
SELECT pg_temp.assert_true(position('Сәлеметсіз' in :'kk_create_result')>0,'21 KK Unicode preserved');
SELECT set_config('request.jwt.claim.sub',:'registrar_a',true);
SELECT pg_temp.expect_error(format(
  'select public.create_communication_template(%L::uuid,%L,%L,%L,%L,NULL,%L,%L)',
  :'tenant_a','appointment_day_before_reminder','sms','ru','Registrar','Текст','template-registrar-create'
),'Недостаточно прав');
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);

-- Identity/content validation matrix.
SELECT pg_temp.expect_error(format(
  'select public.create_communication_template(%L::uuid,%L,%L,%L,%L,NULL,%L,%L)',
  :'tenant_a','marketing','sms','ru','Bad purpose','Текст','template-bad-purpose'
),'Назначение');
SELECT pg_temp.expect_error(format(
  'select public.create_communication_template(%L::uuid,%L,%L,%L,%L,NULL,%L,%L)',
  :'tenant_a','appointment_day_before_reminder','telegram','ru','Bad channel','Текст','template-bad-channel'
),'Канал');
SELECT pg_temp.expect_error(format(
  'select public.create_communication_template(%L::uuid,%L,%L,%L,%L,NULL,%L,%L)',
  :'tenant_a','appointment_day_before_reminder','sms','de','Bad language','Текст','template-bad-language'
),'Язык');
SELECT pg_temp.expect_error(format(
  'select public.create_communication_template(%L::uuid,%L,%L,%L,%L,NULL,%L,%L)',
  :'tenant_a','appointment_day_before_reminder','sms','ru','Unknown','{{unknown_value}}','template-bad-unknown'
),'неизвестную');
SELECT pg_temp.expect_error(format(
  'select public.create_communication_template(%L::uuid,%L,%L,%L,%L,NULL,%L,%L)',
  :'tenant_a','appointment_day_before_reminder','sms','ru','Clinical','{{diagnosis}}','template-bad-clinical'
),'клиническую');
SELECT pg_temp.expect_error(format(
  'select public.create_communication_template(%L::uuid,%L,%L,%L,%L,NULL,%L,%L)',
  :'tenant_a','appointment_day_before_reminder','sms','ru','Financial','{{balance}}','template-bad-financial'
),'финансовую');
SELECT pg_temp.expect_error(format(
  'select public.create_communication_template(%L::uuid,%L,%L,%L,%L,NULL,%L,%L)',
  :'tenant_a','appointment_day_before_reminder','sms','ru','Malformed','{{patient_first_name}','template-bad-braces'
),'некорректную');
SELECT pg_temp.expect_error(format(
  'select public.create_communication_template(%L::uuid,%L,%L,%L,%L,NULL,%L,%L)',
  :'tenant_a','appointment_day_before_reminder','email','ru','No subject','Текст','template-email-no-subject'
),'требуется тема');
SELECT pg_temp.expect_error(format(
  'select public.create_communication_template(%L::uuid,%L,%L,%L,%L,%L,%L,%L)',
  :'tenant_a','appointment_day_before_reminder','sms','en','SMS subject','Тема','Текст','template-sms-subject'
),'только для email');
SELECT pg_temp.expect_error(format(
  'select public.create_communication_template(%L::uuid,%L,%L,%L,%L,%L,%L,%L)',
  :'tenant_a','appointment_day_before_reminder','whatsapp','en','WA subject','Тема','Текст','template-wa-subject'
),'только для email');
SELECT pg_temp.expect_error(format(
  'select public.create_communication_template(%L::uuid,%L,%L,%L,%L,NULL,%L,%L)',
  :'tenant_a','appointment_day_before_reminder','whatsapp','ru','Empty','','template-empty-body'
),'не может быть пустым');
SELECT pg_temp.expect_error(format(
  'select public.create_communication_template(%L::uuid,%L,%L,%L,%L,NULL,%L,%L)',
  :'tenant_a','appointment_day_before_reminder','sms','en','Long',repeat('x',1001),'template-long-sms'
),'превышает');
SELECT pg_temp.expect_error(format(
  'select public.create_communication_template(%L::uuid,%L,%L,%L,%L,%L,%L,%L)',
  :'tenant_a','appointment_day_before_reminder','email','en','HTML','Subject','<script>alert(1)</script>','template-html'
),'HTML');

-- Draft update, stale protection, deterministic preview.
SELECT public.update_communication_template_draft(
  :'tenant_a',:'draft_v1_id',NULL,
  'Здравствуйте, {{patient_first_name}}. Напоминаем о записи в {{clinic_name}} {{appointment_date}} в {{appointment_time}}.',
  :'draft_v1_updated'::timestamptz,'template-update-v1'
) AS update_v1_result \gset
SELECT (:'update_v1_result'::jsonb->'version'->>'updatedAt') AS draft_v1_updated_2 \gset
SELECT pg_temp.assert_true(:'update_v1_result'::jsonb->'version'->>'status'='draft','22 draft update succeeds');
SELECT pg_temp.assert_true(position('Напоминаем' in :'update_v1_result')>0,'23 draft body updated');
SELECT pg_temp.expect_error(format(
  'select public.update_communication_template_draft(%L::uuid,%L::uuid,NULL,%L,%L::timestamptz,%L)',
  :'tenant_a',:'draft_v1_id','Старое изменение',(:'draft_v1_updated'::timestamptz - interval '1 second'),'template-stale-update'
),'изменён другим пользователем');
SELECT pg_temp.expect_error(format(
  'update public.communication_template_versions set body=%L where id=%L::uuid','Direct update',:'draft_v1_id'
),'permission denied');

SELECT public.preview_communication_template(
  :'tenant_a',:'draft_v1_id',jsonb_build_object(
    'patient_first_name','Айгүл','clinic_name','Клиника Тест','appointment_date','20.07.2099','appointment_time','16:00'
  )
) AS preview_one \gset
SELECT public.preview_communication_template(
  :'tenant_a',:'draft_v1_id',jsonb_build_object(
    'patient_first_name','Айгүл','clinic_name','Клиника Тест','appointment_date','20.07.2099','appointment_time','16:00'
  )
) AS preview_two \gset
SELECT pg_temp.assert_true(:'preview_one'::jsonb->'rendered'->>'body'=:'preview_two'::jsonb->'rendered'->>'body','24 preview deterministic body');
SELECT pg_temp.assert_true(:'preview_one'::jsonb->'rendered'->>'renderedFingerprint'=:'preview_two'::jsonb->'rendered'->>'renderedFingerprint','25 preview deterministic fingerprint');
SELECT pg_temp.assert_true(position('Айгүл' in :'preview_one')>0,'26 preview Unicode preserved');
SELECT pg_temp.assert_true(:'preview_one'::jsonb->'rendered'->>'renderedCharacterCount'=(char_length(:'preview_one'::jsonb->'rendered'->>'body'))::text,'27 rendered count');
SELECT pg_temp.expect_error(format(
  'select public.preview_communication_template(%L::uuid,%L::uuid,%L::jsonb)',
  :'tenant_a',:'draft_v1_id',jsonb_build_object('patient_first_name','Айгүл')::text
),'не хватает обязательных данных');
SELECT pg_temp.expect_error(format(
  'select public.preview_communication_template(%L::uuid,%L::uuid,%L::jsonb)',
  :'tenant_a',:'draft_v1_id',jsonb_build_object(
    'patient_first_name','Айгүл','clinic_name','Клиника','appointment_date','20.07.2099','appointment_time','16:00','diagnosis','secret'
  )::text
),'лишние');

-- Publish v1 transactionally and resolve exact identity only.
SELECT public.publish_communication_template_version(
  :'tenant_a',:'template_id',:'draft_v1_id',:'draft_v1_updated_2'::timestamptz,'template-publish-v1'
) AS publish_v1_result \gset
SELECT pg_temp.assert_true(:'publish_v1_result'::jsonb->'template'->>'status'='active','28 publish activates template');
SELECT pg_temp.assert_true(:'publish_v1_result'::jsonb->'version'->>'status'='published','29 version published');
SELECT pg_temp.assert_true(:'publish_v1_result'::jsonb->'template'->>'activeVersionId'=:'draft_v1_id','30 active version exact');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.communication_template_versions WHERE template_id=:'template_id' AND status='published'),'31 one published active version');
SELECT public.publish_communication_template_version(
  :'tenant_a',:'template_id',:'draft_v1_id',:'draft_v1_updated_2'::timestamptz,'template-publish-v1'
) AS publish_v1_replay \gset
SELECT pg_temp.assert_true(:'publish_v1_replay'::jsonb->>'replayed'='true','32 publish replay safe');
SELECT pg_temp.expect_error(format(
  'select public.publish_communication_template_version(%L::uuid,%L::uuid,%L::uuid,%L::timestamptz,%L)',
  :'tenant_a',:'template_id',:'draft_v1_id',(:'draft_v1_updated_2'::timestamptz + interval '1 second'),'template-publish-v1'
),'другими параметрами');
SELECT pg_temp.expect_error(format(
  'select public.update_communication_template_draft(%L::uuid,%L::uuid,NULL,%L,%L::timestamptz,%L)',
  :'tenant_a',:'draft_v1_id','Cannot edit',:'draft_v1_updated_2'::timestamptz,'template-edit-published'
),'Опубликованную версию');

SELECT public.get_active_communication_template(
  :'tenant_a','appointment_confirmation_request','sms','ru'
) AS active_exact \gset
SELECT pg_temp.assert_true(:'active_exact'::jsonb->'version'->>'id'=:'draft_v1_id','33 exact active resolution');
SELECT pg_temp.assert_true(public.get_active_communication_template(
  :'tenant_a','appointment_confirmation_request','sms','kk'
) IS NULL,'34 no silent language fallback');
SELECT pg_temp.assert_true(public.get_active_communication_template(
  :'tenant_a','appointment_confirmation_request','whatsapp','ru'
) IS NULL,'35 no silent channel fallback');
SELECT set_config('request.jwt.claim.sub',:'owner_b',true);
SELECT pg_temp.assert_true(public.get_active_communication_template(
  :'tenant_b','appointment_confirmation_request','sms','ru'
) IS NULL,'36 no silent tenant fallback');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.communication_templates WHERE id=:'template_id'),'37 cross-tenant template read blocked');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.communication_template_versions WHERE id=:'draft_v1_id'),'38 cross-tenant version read blocked');
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);

-- Preparation snapshots exact v1 and changes no reminder/appointment/finance state.
SELECT public.prepare_communication_operation(
  :'tenant_a','d3270000-0000-4000-8000-000000000001','sms','template-operation-v1',
  :'job_version'::timestamptz,:'appointment_a_updated'::timestamptz
) AS operation_v1_result \gset
SELECT (:'operation_v1_result'::jsonb->'operation'->>'id') AS operation_v1_id \gset
SELECT pg_temp.assert_true(:'operation_v1_result'::jsonb->'operation'->>'templateId'=:'template_id','39 operation template id');
SELECT pg_temp.assert_true(:'operation_v1_result'::jsonb->'operation'->>'templateVersionId'=:'draft_v1_id','40 operation exact version id');
SELECT pg_temp.assert_true(:'operation_v1_result'::jsonb->'operation'->>'templateVersionNumber'='1','41 operation v1 number');
SELECT pg_temp.assert_true(:'operation_v1_result'::jsonb->'operation'->>'templateContentFingerprint' ~ '^[0-9a-f]{64}$','42 template fingerprint snapshot');
SELECT pg_temp.assert_true(:'operation_v1_result'::jsonb->'operation'->>'renderedContentFingerprint' ~ '^[0-9a-f]{64}$','43 rendered fingerprint snapshot');
SELECT pg_temp.assert_true(position('Здравствуйте' in (:'operation_v1_result'::jsonb->'operation'->>'renderedBody'))=1 AND position('{{' in (:'operation_v1_result'::jsonb->'operation'->>'renderedBody'))=0,'44 rendered body snapshot');
SELECT pg_temp.assert_true(:'operation_v1_result'::jsonb->'operation'->'templateSnapshot'->>'language'='ru','45 template language snapshot');
SELECT pg_temp.assert_true(:'operation_v1_result'::jsonb->'operation'->'templateSnapshot'->>'channel'='sms','46 template channel snapshot');
SELECT pg_temp.assert_true(:'operation_v1_result'::jsonb->'operation'->'templateSnapshot'->>'purposeCode'='appointment_confirmation_request','47 template purpose snapshot');
SELECT pg_temp.assert_true(position('+77001112233' in :'operation_v1_result')=0,'48 raw destination absent');
SELECT pg_temp.assert_true(position('diagnosis' in lower(:'operation_v1_result'))=0 AND position('balance' in lower(:'operation_v1_result'))=0,'49 clinical financial variables absent');
SELECT pg_temp.assert_true((SELECT state='scheduled' FROM public.appointment_reminder_jobs WHERE id='d3270000-0000-4000-8000-000000000001'),'50 reminder unchanged');
SELECT pg_temp.assert_true((SELECT status='new' FROM public.appointments WHERE id=:'appointment_a'),'51 appointment unchanged');
SELECT pg_temp.assert_true((SELECT count(*)::text=:'confirmations_before' FROM public.appointment_confirmation_attempts),'52 confirmations unchanged');

-- New draft v2, publish, supersede v1, preserve old operation, use v2 for a new operation.
SELECT public.create_communication_template_draft(
  :'tenant_a',:'template_id','template-create-draft-v2'
) AS create_v2_result \gset
SELECT (:'create_v2_result'::jsonb->'version'->>'id') AS draft_v2_id \gset
SELECT (:'create_v2_result'::jsonb->'version'->>'updatedAt') AS draft_v2_updated \gset
SELECT pg_temp.assert_true(:'create_v2_result'::jsonb->'version'->>'versionNumber'='2','53 monotonically increasing version');
SELECT pg_temp.assert_true(:'create_v2_result'::jsonb->'version'->>'status'='draft','54 v2 draft');
SELECT public.update_communication_template_draft(
  :'tenant_a',:'draft_v2_id',NULL,
  'Новая версия для {{patient_first_name}}: {{appointment_date}} {{appointment_time}}, {{clinic_name}}.',
  :'draft_v2_updated'::timestamptz,'template-update-v2'
) AS update_v2_result \gset
SELECT (:'update_v2_result'::jsonb->'version'->>'updatedAt') AS draft_v2_updated_2 \gset
SELECT public.publish_communication_template_version(
  :'tenant_a',:'template_id',:'draft_v2_id',:'draft_v2_updated_2'::timestamptz,'template-publish-v2'
) AS publish_v2_result \gset
SELECT pg_temp.assert_true((SELECT status='superseded' FROM public.communication_template_versions WHERE id=:'draft_v1_id'),'55 prior version superseded');
SELECT pg_temp.assert_true((SELECT status='published' FROM public.communication_template_versions WHERE id=:'draft_v2_id'),'56 v2 published');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.communication_template_versions WHERE template_id=:'template_id' AND status='published'),'57 one active version enforced');
SELECT pg_temp.assert_true((SELECT template_version_id=:'draft_v1_id'::uuid AND rendered_body LIKE 'Здравствуйте,%' FROM public.communication_operations WHERE id=:'operation_v1_id'),'58 old operation unchanged');
SELECT public.prepare_communication_operation(
  :'tenant_a','d3270000-0000-4000-8000-000000000002','sms','template-operation-v2',
  :'job_version'::timestamptz,:'appointment_a_updated'::timestamptz
) AS operation_v2_result \gset
SELECT pg_temp.assert_true(:'operation_v2_result'::jsonb->'operation'->>'templateVersionId'=:'draft_v2_id','59 new operation uses v2');
SELECT pg_temp.assert_true(:'operation_v2_result'::jsonb->'operation'->>'templateVersionNumber'='2','60 new operation version number');
SELECT pg_temp.assert_true(position('Новая версия' in (:'operation_v2_result'::jsonb->'operation'->>'renderedBody'))=1,'61 new rendered content');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.communication_operations WHERE template_id IS NULL OR template_version_id IS NULL OR rendered_content_fingerprint IS NULL),'62 operation snapshots complete');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.communication_operations WHERE rendered_body ~* '(diagnosis|complaint|finding|treatment|balance|debt|invoice|payment)'),'63 no forbidden rendered variables');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.communication_operations WHERE rendered_body LIKE '%+77001112233%'),'64 raw destination absent from rendered content');

-- Direct writes remain blocked, RLS active, audit/activity paired once.
SELECT pg_temp.expect_error(format(
  'insert into public.communication_templates(tenant_id,purpose_code,channel,language,display_name,status) values(%L::uuid,%L,%L,%L,%L,%L)',
  :'tenant_a','appointment_day_before_reminder','email','ru','Direct','inactive'
),'permission denied');
SELECT pg_temp.expect_error(format(
  'update public.communication_template_versions set body=%L where id=%L::uuid','Mutated',:'draft_v1_id'
),'permission denied');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT relrowsecurity FROM pg_class WHERE oid='public.communication_templates'::regclass),'65 template RLS enabled');
SELECT pg_temp.assert_true((SELECT relrowsecurity FROM pg_class WHERE oid='public.communication_template_versions'::regclass),'66 version RLS enabled');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM information_schema.role_table_grants WHERE grantee='authenticated' AND table_schema='public' AND table_name IN ('communication_templates','communication_template_versions') AND privilege_type IN ('INSERT','UPDATE','DELETE')),'67 no authenticated direct writes');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.audit_events WHERE tenant_id=:'tenant_a' AND action LIKE 'communication_template_%')=(SELECT count(*) FROM public.activity_events WHERE tenant_id=:'tenant_a' AND type LIKE 'communication_template_%'),'68 audit activity parity');
SELECT pg_temp.assert_true((SELECT count(*)>0 FROM public.audit_events WHERE tenant_id=:'tenant_a' AND action='communication_template_published'),'69 publish audited');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.audit_events WHERE tenant_id=:'tenant_a' AND metadata::text LIKE '%Пациент Оркестрации%'),'70 no patient rendered body in audit metadata');

-- Archive blocks active resolution but retains versions for audit.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
SELECT updated_at::text AS template_updated_before_archive FROM public.communication_templates WHERE id=:'template_id' \gset
SELECT public.archive_communication_template(
  :'tenant_a',:'template_id',:'template_updated_before_archive'::timestamptz,'template-archive-main'
) AS archive_result \gset
SELECT pg_temp.assert_true(:'archive_result'::jsonb->'template'->>'status'='archived','71 template archived');
SELECT pg_temp.assert_true(public.get_active_communication_template(
  :'tenant_a','appointment_confirmation_request','sms','ru'
) IS NULL,'72 archive blocks active resolution');
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM public.communication_template_versions WHERE template_id=:'template_id'),'73 archived versions retained');
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM public.communication_operations WHERE template_id=:'template_id'),'74 historical operations retained');

-- Side-effect counters.
RESET ROLE;
SELECT pg_temp.assert_true((SELECT count(*)::text=:'visits_before' FROM public.patient_visits),'75 visits unchanged');
SELECT pg_temp.assert_true((SELECT count(*)::text=:'encounters_before' FROM public.clinical_encounters),'76 encounters unchanged');
SELECT pg_temp.assert_true((SELECT count(*)::text=:'services_before' FROM public.completed_services),'77 completed services unchanged');
SELECT pg_temp.assert_true((SELECT count(*)::text=:'invoices_before' FROM public.invoices),'78 invoices unchanged');
SELECT pg_temp.assert_true((SELECT count(*)::text=:'payments_before' FROM public.payments),'79 payments unchanged');
SELECT pg_temp.assert_true((SELECT balance::text=:'balance_before' FROM public.patients WHERE id=:'patient_a'),'80 patient balance unchanged');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.communication_operations o JOIN public.communication_templates t ON t.id=o.template_id WHERE o.tenant_id<>t.tenant_id),'81 no cross-tenant operation template link');
SELECT pg_temp.assert_true(NOT EXISTS (SELECT 1 FROM public.communication_template_versions GROUP BY template_id,version_number HAVING count(*)>1),'82 no duplicate version numbers');
SELECT pg_temp.assert_true(NOT EXISTS (SELECT 1 FROM public.communication_template_versions WHERE status='published' GROUP BY template_id HAVING count(*)>1),'83 no multiple active versions');

ROLLBACK;
\echo 'COMMUNICATION-TEMPLATE-FOUNDATION-001 SQL validation passed'
