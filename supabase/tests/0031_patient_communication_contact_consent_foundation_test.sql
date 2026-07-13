\set ON_ERROR_STOP on
\echo 'APPOINTMENT-REMINDER-CONTACT-CONSENT-FOUNDATION-001 SQL validation'
BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.assert_true(p_condition boolean, p_message text)
RETURNS void LANGUAGE plpgsql AS $assert$
BEGIN
  IF NOT coalesce(p_condition,false) THEN
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
    IF position(lower(p_expected) in lower(v_message))=0 THEN
      RAISE EXCEPTION 'expected "%", got "%"', p_expected, v_message;
    END IF;
  END;
END;
$expect$;

\set tenant_a 'c3110000-0000-4000-8000-000000000001'
\set tenant_b 'c3110000-0000-4000-8000-000000000002'
\set owner_a 'c3120000-0000-4000-8000-000000000001'
\set admin_a 'c3120000-0000-4000-8000-000000000002'
\set registrar_a 'c3120000-0000-4000-8000-000000000003'
\set doctor_a 'c3120000-0000-4000-8000-000000000004'
\set cashier_a 'c3120000-0000-4000-8000-000000000005'
\set unknown_user 'c3120000-0000-4000-8000-000000000006'
\set owner_b 'c3120000-0000-4000-8000-000000000007'
\set patient_legacy 'c3130000-0000-4000-8000-000000000001'
\set patient_a 'c3130000-0000-4000-8000-000000000002'
\set patient_family 'c3130000-0000-4000-8000-000000000003'
\set patient_b 'c3130000-0000-4000-8000-000000000004'

DELETE FROM public.tenants WHERE id IN (:'tenant_a'::uuid,:'tenant_b'::uuid);
DELETE FROM auth.users WHERE id IN (
  :'owner_a'::uuid,:'admin_a'::uuid,:'registrar_a'::uuid,:'doctor_a'::uuid,
  :'cashier_a'::uuid,:'unknown_user'::uuid,:'owner_b'::uuid
);

INSERT INTO public.tenants(id,name,timezone) VALUES
(:'tenant_a','Communication Test A','Asia/Almaty'),(:'tenant_b','Communication Test B','Europe/Berlin');
INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) VALUES
(:'owner_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','comm-owner-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
(:'admin_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','comm-admin-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
(:'registrar_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','comm-registrar-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
(:'doctor_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','comm-doctor-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
(:'cashier_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','comm-cashier-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
(:'unknown_user','00000000-0000-0000-0000-000000000000','authenticated','authenticated','comm-unknown@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
(:'owner_b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','comm-owner-b@example.local','x',now(),'{"provider":"email"}','{}',now(),now());
INSERT INTO public.profiles(id) VALUES
(:'owner_a'),(:'admin_a'),(:'registrar_a'),(:'doctor_a'),(:'cashier_a'),(:'unknown_user'),(:'owner_b');
INSERT INTO public.tenant_users(tenant_id,user_id,role) VALUES
(:'tenant_a',:'owner_a','clinic_owner'),(:'tenant_a',:'admin_a','clinic_admin'),
(:'tenant_a',:'registrar_a','registrar'),(:'tenant_a',:'doctor_a','doctor'),
(:'tenant_a',:'cashier_a','cashier'),(:'tenant_b',:'owner_b','clinic_owner');

INSERT INTO public.patients(id,tenant_id,full_name,phone,source,status,balance) VALUES
(:'patient_legacy',:'tenant_a','Legacy Patient','+7 (700) 111-22-33','phone','active',123.45),
(:'patient_a',:'tenant_a','Patient A',NULL,'phone','active',50),
(:'patient_family',:'tenant_a','Family Patient',NULL,'phone','active',0),
(:'patient_b',:'tenant_b','Patient B','+4915112345678','phone','active',0);

SELECT balance::text AS patient_balance_before FROM public.patients WHERE id=:'patient_a' \gset
SELECT count(*)::text AS reminders_before FROM public.appointment_reminder_jobs \gset
SELECT count(*)::text AS confirmations_before FROM public.appointment_confirmation_attempts \gset
SELECT count(*)::text AS visits_before FROM public.patient_visits \gset
SELECT count(*)::text AS encounters_before FROM public.clinical_encounters \gset
SELECT count(*)::text AS services_before FROM public.completed_services \gset
SELECT count(*)::text AS invoices_before FROM public.invoices \gset
SELECT count(*)::text AS payments_before FROM public.payments \gset

-- 1-10 Role and tenant isolation matrix.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.patient_communication_contacts WHERE patient_id=:'patient_legacy'),'owner reads contacts');
SELECT set_config('request.jwt.claim.sub',:'admin_a',true);
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.patient_communication_contacts WHERE patient_id=:'patient_legacy'),'admin reads contacts');
SELECT set_config('request.jwt.claim.sub',:'registrar_a',true);
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.patient_communication_contacts WHERE patient_id=:'patient_legacy'),'registrar reads contacts');
SELECT set_config('request.jwt.claim.sub',:'doctor_a',true);
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.patient_communication_contacts WHERE patient_id=:'patient_legacy'),'doctor read-only contact visibility');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.patient_communication_consent_events),'doctor cannot view consent history');
SELECT set_config('request.jwt.claim.sub',:'cashier_a',true);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.patient_communication_contacts),'cashier has no communication contact access');
SELECT set_config('request.jwt.claim.sub',:'unknown_user',true);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.patient_communication_contacts),'unknown user blocked');
SELECT set_config('request.jwt.claim.sub',:'owner_b',true);
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.patient_communication_contacts WHERE patient_id=:'patient_b'),'tenant B sees own legacy contact');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.patient_communication_contacts WHERE patient_id=:'patient_legacy'),'cross-tenant read blocked');
SELECT pg_temp.expect_error(format(
  'select public.set_patient_communication_preferences(%L::uuid,%L::uuid,%L,%L,true,%L)',
  :'tenant_a',:'patient_a','ru','phone','cross-tenant-preferences-001'
),'Недостаточно прав');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT pg_temp.expect_error('select count(*) from public.patient_communication_contacts','permission denied');
RESET ROLE;

-- 11-19 Normalization and legacy behavior.
SELECT pg_temp.assert_true(public.normalize_patient_phone_e164('+7 (700) 123-45-67')='+77001234567','Kazakhstan E.164 normalization');
SELECT pg_temp.assert_true(public.normalize_patient_phone_e164('+49 151 12345678')='+4915112345678','international E.164 normalization');
SELECT pg_temp.assert_true(public.normalize_patient_phone_e164('87001234567') IS NULL,'no silent country guess');
SELECT pg_temp.assert_true(public.normalize_patient_phone_e164('+77001234567 ext 4') IS NULL,'extensions rejected');
SELECT pg_temp.assert_true(public.normalize_patient_email(' Patient+tag@Example.COM ')='patient+tag@example.com','email trim lower and plus preserved');
SELECT pg_temp.assert_true(public.normalize_patient_email('bad@') IS NULL,'invalid email rejected');
SELECT pg_temp.assert_true((SELECT contact_value_raw='+7 (700) 111-22-33' AND contact_value_normalized='+77001112233' AND NOT is_verified AND verification_source='import_legacy' FROM public.patient_communication_contacts WHERE patient_id=:'patient_legacy'),'legacy raw preserved and imported unverified');
SELECT pg_temp.assert_true((SELECT sms_consent_state='unknown' AND whatsapp_consent_state='unknown' AND email_consent_state='unknown' FROM public.patient_communication_preferences WHERE patient_id=:'patient_legacy'),'legacy consent unknown');
SELECT pg_temp.assert_true((SELECT phone='+7 (700) 111-22-33' FROM public.patients WHERE id=:'patient_legacy'),'patients.phone unchanged');

-- 20-26 Contacts, primary rules, representative and preferences.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'admin_a',true);
SELECT public.upsert_patient_communication_contact(
  :'tenant_a',:'patient_a',NULL,'phone','+7 700 222 33 44',true,true,'patient_confirmed','patient',NULL,NULL,'ru',NULL,'contact-phone-a-001'
) AS phone_a_result \gset
SELECT (:'phone_a_result'::jsonb->'contact'->>'id') AS phone_a_id \gset
SELECT pg_temp.assert_true(:'phone_a_result'::jsonb->'contact'->>'contactValueNormalized'='+77002223344','normalized phone stored');
SELECT pg_temp.assert_true(:'phone_a_result'::jsonb->'contact'->>'contactValueRaw'='+7 700 222 33 44','raw phone preserved');
SELECT pg_temp.expect_error(format(
  'select public.upsert_patient_communication_contact(%L::uuid,%L::uuid,NULL,%L,%L,false,false,%L,%L,NULL,NULL,%L,NULL,%L)',
  :'tenant_a',:'patient_a','phone','8700','staff_entered','patient','ru','invalid-phone-001'
),'корректный номер телефона');
SELECT public.upsert_patient_communication_contact(
  :'tenant_a',:'patient_a',NULL,'phone','+77009990000',true,true,'patient_confirmed','patient',NULL,NULL,'kk',NULL,'contact-second-phone-001'
) AS second_phone_result \gset
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.patient_communication_contacts WHERE patient_id=:'patient_a' AND contact_type='phone' AND is_primary AND archived_at IS NULL),'one primary phone');
SELECT public.upsert_patient_communication_contact(
  :'tenant_a',:'patient_a',NULL,'email',' Patient+tag@Example.COM ',true,false,'staff_entered','patient',NULL,NULL,'en',NULL,'contact-email-a-001'
) AS email_a_result \gset
SELECT (:'email_a_result'::jsonb->'contact'->>'id') AS email_a_id \gset
SELECT pg_temp.assert_true(:'email_a_result'::jsonb->'contact'->>'contactValueNormalized'='patient+tag@example.com','email lowercased without plus collapse');
SELECT pg_temp.expect_error(format(
  'select public.upsert_patient_communication_contact(%L::uuid,%L::uuid,NULL,%L,%L,false,false,%L,%L,NULL,NULL,%L,NULL,%L)',
  :'tenant_a',:'patient_a','email','bad@','staff_entered','patient','ru','invalid-email-001'
),'корректный адрес электронной почты');
SELECT public.upsert_patient_communication_contact(
  :'tenant_a',:'patient_a',NULL,'email','second@example.com',true,false,'staff_entered','patient',NULL,NULL,'ru',NULL,'contact-second-email-001'
);
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.patient_communication_contacts WHERE patient_id=:'patient_a' AND contact_type='email' AND is_primary AND archived_at IS NULL),'one primary email');
SELECT pg_temp.expect_error(format(
  'select public.upsert_patient_communication_contact(%L::uuid,%L::uuid,NULL,%L,%L,false,false,%L,%L,%L,NULL,%L,NULL,%L)',
  :'tenant_a',:'patient_family','phone','+77005556677','staff_entered','representative','Мама','ru','representative-missing-relation-001'
),'представителя');
SELECT public.upsert_patient_communication_contact(
  :'tenant_a',:'patient_family',NULL,'phone','+77005556677',true,true,'representative_confirmed','representative','Мама пациента','parent','kk',NULL,'representative-valid-001'
) AS representative_result \gset
SELECT pg_temp.assert_true(:'representative_result'::jsonb->'contact'->>'ownerType'='representative' AND :'representative_result'::jsonb->'contact'->>'representativeRelation'='parent','representative explicit');
SELECT pg_temp.expect_error(format(
  'select public.set_patient_communication_preferences(%L::uuid,%L::uuid,%L,%L,true,%L)',
  :'tenant_a',:'patient_a','de','sms','bad-language-001'
),'Не удалось сохранить');
SELECT pg_temp.expect_error(format(
  'select public.set_patient_communication_preferences(%L::uuid,%L::uuid,%L,%L,true,%L)',
  :'tenant_a',:'patient_a','ru','telegram','bad-channel-001'
),'Не удалось сохранить');
SELECT public.set_patient_communication_preferences(:'tenant_a',:'patient_a','kk','sms',true,'preferences-valid-001');
SELECT pg_temp.assert_true((SELECT preferred_language='kk' AND preferred_channel='sms' FROM public.patient_communication_preferences WHERE patient_id=:'patient_a'),'preferences validated and saved');

-- 27-34 Consent states and idempotency.
SELECT pg_temp.assert_true((SELECT sms_consent_state='unknown' FROM public.patient_communication_preferences WHERE patient_id=:'patient_a'),'consent unknown by default');
SELECT count(*)::text AS audit_before_consent FROM public.audit_events WHERE patient_id=:'patient_a' AND action='patient_communication_consent_changed' \gset
SELECT public.set_patient_communication_consent(:'tenant_a',:'patient_a','sms','granted','patient_verbal','Пациент согласился','consent-sms-grant-001') AS sms_grant_result \gset
SELECT pg_temp.assert_true((SELECT sms_consent_state='granted' FROM public.patient_communication_preferences WHERE patient_id=:'patient_a'),'grant SMS consent');
SELECT public.set_patient_communication_consent(:'tenant_a',:'patient_a','whatsapp','granted','patient_written','Письменно','consent-whatsapp-grant-001');
SELECT pg_temp.assert_true((SELECT whatsapp_consent_state='granted' FROM public.patient_communication_preferences WHERE patient_id=:'patient_a'),'grant WhatsApp separately');
SELECT public.set_patient_communication_consent(:'tenant_a',:'patient_a','email','denied','patient_verbal','Не желает email','consent-email-deny-001');
SELECT pg_temp.assert_true((SELECT email_consent_state='denied' FROM public.patient_communication_preferences WHERE patient_id=:'patient_a'),'deny email consent');
SELECT public.set_patient_communication_consent(:'tenant_a',:'patient_a','sms','withdrawn','patient_verbal','Отозвал','consent-sms-withdraw-001');
SELECT pg_temp.assert_true((SELECT sms_consent_state='withdrawn' FROM public.patient_communication_preferences WHERE patient_id=:'patient_a'),'withdraw consent');
SELECT public.set_patient_communication_consent(:'tenant_a',:'patient_a','sms','granted','patient_verbal','Пациент согласился снова','consent-sms-regrant-001');
SELECT public.set_patient_communication_consent(:'tenant_a',:'patient_a','sms','granted','patient_verbal','Пациент согласился снова','consent-sms-regrant-001') AS sms_replay \gset
SELECT pg_temp.assert_true((:'sms_replay'::jsonb->>'replayed')::boolean,'same-key replay safe');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.patient_communication_consent_events WHERE operation_key='consent-sms-regrant-001'),'one consent event on replay');
SELECT pg_temp.expect_error(format(
  'select public.set_patient_communication_consent(%L::uuid,%L::uuid,%L,%L,%L,%L,%L)',
  :'tenant_a',:'patient_a','sms','denied','patient_verbal','changed','consent-sms-regrant-001'
),'другими параметрами');
SELECT pg_temp.assert_true((SELECT count(*)=5 FROM public.patient_communication_consent_events WHERE patient_id=:'patient_a'),'consent transition history count');
SELECT pg_temp.assert_true((SELECT count(*)::int=(:'audit_before_consent')::int+5 FROM public.audit_events WHERE patient_id=:'patient_a' AND action='patient_communication_consent_changed'),'audit exactly once per changed consent');

-- 35-45 Suppression, eligibility, representative and duplicate behavior.
SELECT public.get_patient_communication_eligibility(:'tenant_a',:'patient_a','sms') AS sms_eligible \gset
SELECT pg_temp.assert_true((:'sms_eligible'::jsonb->>'automatedEligible')::boolean,'granted valid verified phone eligible for SMS');
SELECT public.get_patient_communication_eligibility(:'tenant_a',:'patient_a','whatsapp') AS whatsapp_eligible \gset
SELECT pg_temp.assert_true((:'whatsapp_eligible'::jsonb->>'automatedEligible')::boolean,'WhatsApp consent independent and eligible');
SELECT public.get_patient_communication_eligibility(:'tenant_a',:'patient_a','email') AS email_blocked \gset
SELECT pg_temp.assert_true(NOT (:'email_blocked'::jsonb->>'automatedEligible')::boolean AND :'email_blocked'::jsonb->'blockedReasons' ? 'consent_denied','denied email blocked');
SELECT public.set_patient_communication_suppression(:'tenant_a',:'patient_a','whatsapp',true,'patient_request','suppress-whatsapp-001');
SELECT public.get_patient_communication_eligibility(:'tenant_a',:'patient_a','whatsapp') AS whatsapp_suppressed \gset
SELECT pg_temp.assert_true(:'whatsapp_suppressed'::jsonb->'blockedReasons' ? 'channel_suppressed','channel suppression precedence');
SELECT public.set_patient_communication_suppression(:'tenant_a',:'patient_a','whatsapp',false,NULL,'unsuppress-whatsapp-001');
SELECT public.get_patient_communication_eligibility(:'tenant_a',:'patient_a','whatsapp') AS whatsapp_restored \gset
SELECT pg_temp.assert_true((:'whatsapp_restored'::jsonb->>'automatedEligible')::boolean,'unsuppress restores when consent permits');
SELECT public.set_patient_communication_suppression(:'tenant_a',:'patient_a','global',true,'patient_request','global-suppress-001');
SELECT public.get_patient_communication_eligibility(:'tenant_a',:'patient_a','sms') AS globally_blocked_sms \gset
SELECT public.get_patient_communication_eligibility(:'tenant_a',:'patient_a','whatsapp') AS globally_blocked_whatsapp \gset
SELECT pg_temp.assert_true(:'globally_blocked_sms'::jsonb->'blockedReasons' ? 'global_suppression' AND :'globally_blocked_whatsapp'::jsonb->'blockedReasons' ? 'global_suppression','global suppression blocks automated channels');
SELECT public.get_patient_communication_eligibility(:'tenant_a',:'patient_a','phone') AS manual_phone_during_global \gset
SELECT pg_temp.assert_true((:'manual_phone_during_global'::jsonb->>'manualEligible')::boolean,'manual phone remains distinct for non-legal global suppression');
SELECT public.set_patient_communication_suppression(:'tenant_a',:'patient_a','global',false,NULL,'global-unsuppress-001');
SELECT public.get_patient_communication_eligibility(:'tenant_a',:'patient_legacy','sms') AS legacy_sms \gset
SELECT pg_temp.assert_true(:'legacy_sms'::jsonb->'blockedReasons' ? 'consent_unknown' AND :'legacy_sms'::jsonb->'blockedReasons' ? 'unverified_contact','legacy unknown/unverified blocks automation');
SELECT public.get_patient_communication_eligibility(:'tenant_a',:'patient_family','whatsapp') AS representative_review \gset
SELECT pg_temp.assert_true(:'representative_review'::jsonb->'blockedReasons' ? 'representative_review_required','representative requires review');
SELECT public.upsert_patient_communication_contact(
  :'tenant_a',:'patient_a',NULL,'phone','+77005556677',false,true,'patient_confirmed','patient',NULL,NULL,'ru',NULL,'duplicate-family-001'
) AS duplicate_result \gset
SELECT pg_temp.assert_true((:'duplicate_result'::jsonb->>'duplicateWarning')::boolean,'duplicate warning detected');
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM public.patient_communication_contacts WHERE tenant_id=:'tenant_a' AND contact_value_normalized='+77005556677' AND archived_at IS NULL),'shared family number not hard blocked');

-- Missing contact and invalid/unverified eligibility.
SELECT public.get_patient_communication_eligibility(:'tenant_a',:'patient_a','email') AS email_existing \gset
SELECT pg_temp.assert_true(:'email_existing'::jsonb->'blockedReasons' ? 'consent_denied','email existing but denied blocked');
SELECT public.get_patient_communication_eligibility(:'tenant_a',:'patient_family','email') AS missing_email \gset
SELECT pg_temp.assert_true(:'missing_email'::jsonb->'blockedReasons' ? 'no_contact','missing contact blocked');

-- Archive and primary rules.
SELECT updated_at::text AS email_updated FROM public.patient_communication_contacts WHERE id=:'email_a_id'::uuid \gset
SELECT public.archive_patient_communication_contact(:'tenant_a',:'patient_a',:'email_a_id',:'email_updated'::timestamptz,'archive-email-001');
SELECT updated_at::text AS archived_email_updated FROM public.patient_communication_contacts WHERE id=:'email_a_id'::uuid \gset
SELECT pg_temp.expect_error(format(
  'select public.set_primary_patient_communication_contact(%L::uuid,%L::uuid,%L::uuid,%L::timestamptz,%L)',
  :'tenant_a',:'patient_a',:'email_a_id',:'archived_email_updated','archived-primary-001'
),'Архивный контакт');

-- 46-49 Direct writes, append-only and RLS.
SELECT pg_temp.expect_error(format(
  'insert into public.patient_communication_contacts(tenant_id,patient_id,contact_type,contact_value_raw,owner_type) values(%L::uuid,%L::uuid,%L,%L,%L)',
  :'tenant_a',:'patient_a','phone','+77000000000','patient'
),'permission denied');
SELECT pg_temp.expect_error(format(
  'update public.patient_communication_preferences set preferred_language=%L where tenant_id=%L::uuid and patient_id=%L::uuid',
  'en',:'tenant_a',:'patient_a'
),'permission denied');
SELECT pg_temp.expect_error('update public.patient_communication_consent_events set reason=''changed''','permission denied');
SELECT pg_temp.expect_error('delete from public.patient_communication_consent_events','permission denied');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT relrowsecurity FROM pg_class WHERE oid='public.patient_communication_contacts'::regclass),'contacts RLS enabled');
SELECT pg_temp.assert_true((SELECT relrowsecurity FROM pg_class WHERE oid='public.patient_communication_preferences'::regclass),'preferences RLS enabled');
SELECT pg_temp.assert_true((SELECT relrowsecurity FROM pg_class WHERE oid='public.patient_communication_consent_events'::regclass),'consent RLS enabled');

-- 50 Audit/activity parity and 51-55 side-effect invariants.
SELECT pg_temp.assert_true((
  SELECT count(*) FROM public.audit_events WHERE tenant_id=:'tenant_a' AND action LIKE 'patient_communication_%'
)=(
  SELECT count(*) FROM public.activity_events WHERE tenant_id=:'tenant_a' AND type LIKE 'patient_communication_%'
),'audit/activity parity');
SELECT pg_temp.assert_true((SELECT count(*)=(:'reminders_before')::int FROM public.appointment_reminder_jobs),'no reminder job mutation');
SELECT pg_temp.assert_true((SELECT count(*)=(:'confirmations_before')::int FROM public.appointment_confirmation_attempts),'no confirmation mutation');
SELECT pg_temp.assert_true((SELECT count(*)=(:'visits_before')::int FROM public.patient_visits),'no visits created');
SELECT pg_temp.assert_true((SELECT count(*)=(:'encounters_before')::int FROM public.clinical_encounters),'no encounters created');
SELECT pg_temp.assert_true((SELECT count(*)=(:'services_before')::int FROM public.completed_services),'no services created');
SELECT pg_temp.assert_true((SELECT count(*)=(:'invoices_before')::int FROM public.invoices),'no invoices created');
SELECT pg_temp.assert_true((SELECT count(*)=(:'payments_before')::int FROM public.payments),'no payments created');
SELECT pg_temp.assert_true((SELECT balance::text=:'patient_balance_before' FROM public.patients WHERE id=:'patient_a'),'patient balance unchanged');
SELECT pg_temp.assert_true(NOT EXISTS(
  SELECT 1 FROM public.patient_communication_consent_events GROUP BY tenant_id,operation_key HAVING count(*)>1
),'duplicate consent events zero');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.patient_communication_contacts c JOIN public.patients p ON p.id=c.patient_id WHERE c.tenant_id<>p.tenant_id),'cross-tenant contact leaks zero');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.patient_communication_contacts WHERE contact_value_normalized IS NOT NULL AND ((contact_type='phone' AND contact_value_normalized !~ '^\+[1-9][0-9]{7,14}$') OR (contact_type='email' AND contact_value_normalized<>lower(contact_value_normalized)))),'invalid normalized contacts zero');
SELECT pg_temp.assert_true(NOT EXISTS(
  SELECT 1
  FROM (VALUES
    (:'patient_legacy'::uuid,'sms'),(:'patient_legacy'::uuid,'whatsapp'),(:'patient_legacy'::uuid,'email'),
    (:'patient_a'::uuid,'sms'),(:'patient_a'::uuid,'whatsapp'),(:'patient_a'::uuid,'email'),
    (:'patient_family'::uuid,'sms'),(:'patient_family'::uuid,'whatsapp'),(:'patient_family'::uuid,'email')
  ) AS candidate(patient_id,channel)
  CROSS JOIN LATERAL public.get_patient_communication_eligibility(:'tenant_a',candidate.patient_id,candidate.channel) result
  WHERE (result->>'automatedEligible')::boolean
    AND result->>'consentState'<>'granted'
),'automated eligibility without consent zero');

SELECT
  (SELECT count(*) FROM public.patient_communication_contacts WHERE tenant_id='c3110000-0000-4000-8000-000000000001') AS contacts,
  (SELECT count(*) FROM public.patient_communication_consent_events WHERE tenant_id='c3110000-0000-4000-8000-000000000001') AS consent_events,
  (SELECT count(*) FROM public.patient_communication_operations WHERE tenant_id='c3110000-0000-4000-8000-000000000001') AS operations,
  (SELECT count(*) FROM public.audit_events WHERE tenant_id='c3110000-0000-4000-8000-000000000001' AND action LIKE 'patient_communication_%') AS audit,
  (SELECT count(*) FROM public.activity_events WHERE tenant_id='c3110000-0000-4000-8000-000000000001' AND type LIKE 'patient_communication_%') AS activity,
  (SELECT count(*) FROM public.appointment_reminder_jobs) AS reminder_jobs;

ROLLBACK;
\echo 'APPOINTMENT-REMINDER-CONTACT-CONSENT-FOUNDATION-001 SQL validation passed'
