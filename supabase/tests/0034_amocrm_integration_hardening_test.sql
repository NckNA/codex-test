\set ON_ERROR_STOP on
\echo 'AMOCRM-INTEGRATION-HARDENING-001 SQL validation'
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

\set tenant_a 'a3410000-0000-4000-8000-000000000001'
\set tenant_b 'a3410000-0000-4000-8000-000000000002'
\set owner_a 'a3420000-0000-4000-8000-000000000001'
\set admin_a 'a3420000-0000-4000-8000-000000000002'
\set registrar_a 'a3420000-0000-4000-8000-000000000003'
\set doctor_a 'a3420000-0000-4000-8000-000000000004'
\set cashier_a 'a3420000-0000-4000-8000-000000000005'
\set unknown_a 'a3420000-0000-4000-8000-000000000006'
\set owner_b 'a3420000-0000-4000-8000-000000000007'
\set state_hash_1 '1111111111111111111111111111111111111111111111111111111111111111'
\set state_hash_2 '2222222222222222222222222222222222222222222222222222222222222222'
\set state_hash_3 '3333333333333333333333333333333333333333333333333333333333333333'
\set state_hash_4 '4444444444444444444444444444444444444444444444444444444444444444'
\set state_hash_b 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
\set redirect_hash 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
\set lease_2 'a3430000-0000-4000-8000-000000000002'
\set lease_3 'a3430000-0000-4000-8000-000000000003'
\set lease_4 'a3430000-0000-4000-8000-000000000004'
\set lease_b 'a3430000-0000-4000-8000-000000000005'
\set refresh_lease_1 'a3440000-0000-4000-8000-000000000001'
\set refresh_lease_2 'a3440000-0000-4000-8000-000000000002'
\set internal_ref 'a3450000-0000-4000-8000-000000000001'
\set internal_ref_2 'a3450000-0000-4000-8000-000000000002'

DELETE FROM public.tenants WHERE id IN (:'tenant_a'::uuid, :'tenant_b'::uuid);
DELETE FROM auth.users WHERE id IN (
  :'owner_a'::uuid, :'admin_a'::uuid, :'registrar_a'::uuid, :'doctor_a'::uuid,
  :'cashier_a'::uuid, :'unknown_a'::uuid, :'owner_b'::uuid
);

INSERT INTO public.tenants(id, name, timezone) VALUES
(:'tenant_a', 'amoCRM Test A', 'Asia/Almaty'),
(:'tenant_b', 'amoCRM Test B', 'Asia/Almaty');

INSERT INTO auth.users(
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
(:'owner_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','amo-owner-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
(:'admin_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','amo-admin-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
(:'registrar_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','amo-registrar-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
(:'doctor_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','amo-doctor-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
(:'cashier_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','amo-cashier-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
(:'unknown_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','amo-unknown@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
(:'owner_b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','amo-owner-b@example.local','x',now(),'{"provider":"email"}','{}',now(),now());

INSERT INTO public.profiles(id) VALUES
(:'owner_a'),(:'admin_a'),(:'registrar_a'),(:'doctor_a'),(:'cashier_a'),(:'unknown_a'),(:'owner_b');

INSERT INTO public.tenant_users(tenant_id,user_id,role) VALUES
(:'tenant_a',:'owner_a','clinic_owner'),(:'tenant_a',:'admin_a','clinic_admin'),
(:'tenant_a',:'registrar_a','registrar'),(:'tenant_a',:'doctor_a','doctor'),
(:'tenant_a',:'cashier_a','cashier'),(:'tenant_b',:'owner_b','clinic_owner');

SELECT count(*)::text AS patients_before FROM public.patients \gset
SELECT count(*)::text AS appointments_before FROM public.appointments \gset
SELECT count(*)::text AS reminder_jobs_before FROM public.appointment_reminder_jobs \gset
SELECT count(*)::text AS communication_operations_before FROM public.communication_operations \gset
SELECT count(*)::text AS templates_before FROM public.communication_templates \gset
SELECT count(*)::text AS visits_before FROM public.patient_visits \gset
SELECT count(*)::text AS encounters_before FROM public.clinical_encounters \gset
SELECT count(*)::text AS findings_before FROM public.findings \gset
SELECT count(*)::text AS treatment_plans_before FROM public.treatment_plans \gset
SELECT count(*)::text AS services_before FROM public.completed_services \gset
SELECT count(*)::text AS invoices_before FROM public.invoices \gset
SELECT count(*)::text AS payments_before FROM public.payments \gset
SELECT count(*)::text AS refunds_before FROM public.refunds \gset
SELECT count(*)::text AS writeoffs_before FROM public.financial_adjustments \gset

SELECT pg_temp.assert_true((SELECT relrowsecurity FROM pg_class WHERE oid='public.integration_accounts'::regclass),'1 integration_accounts RLS enabled');
SELECT pg_temp.assert_true((SELECT relrowsecurity FROM pg_class WHERE oid='public.integration_credentials'::regclass),'2 integration_credentials RLS enabled');
SELECT pg_temp.assert_true((SELECT relrowsecurity FROM pg_class WHERE oid='public.integration_oauth_states'::regclass),'3 integration_oauth_states RLS enabled');
SELECT pg_temp.assert_true((SELECT relrowsecurity FROM pg_class WHERE oid='public.integration_external_references'::regclass),'4 external references RLS enabled');
SELECT pg_temp.assert_true(NOT has_table_privilege('authenticated','public.integration_credentials','SELECT'),'5 authenticated cannot select credentials');
SELECT pg_temp.assert_true(NOT has_table_privilege('authenticated','public.integration_credentials','INSERT'),'6 authenticated cannot write credentials');
SELECT pg_temp.assert_true(NOT has_table_privilege('authenticated','public.integration_oauth_states','SELECT'),'7 OAuth state not generally readable');
SELECT pg_temp.assert_true(NOT has_function_privilege('authenticated','public.amocrm_start_connection_server(uuid,uuid,text,text,timestamptz,text,text,boolean)','EXECUTE'),'8 server mutation not browser callable');

SELECT public.amocrm_start_connection_server(
  :'tenant_a', :'owner_a', :'state_hash_1', :'redirect_hash', now()+interval '10 minutes', NULL, NULL, false
) AS owner_start \gset
SELECT (:'owner_start'::jsonb->>'integrationAccountId') AS integration_a \gset
SELECT pg_temp.assert_true(:'owner_start'::jsonb->>'status'='authorization_pending','9 owner starts connection');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.integration_accounts WHERE tenant_id=:'tenant_a'),'10 one tenant integration account');
SELECT pg_temp.assert_true((SELECT state_hash=:'state_hash_1' AND initiated_by=:'owner_a' AND tenant_id=:'tenant_a' AND integration_account_id=:'integration_a' FROM public.integration_oauth_states WHERE state_hash=:'state_hash_1'),'11 state tenant/user/integration bound');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM information_schema.columns WHERE table_schema='public' AND table_name='integration_oauth_states' AND column_name IN ('state','raw_state')),'12 raw state column absent');
SELECT pg_temp.assert_true((SELECT expires_at <= created_at+interval '15 minutes' FROM public.integration_oauth_states WHERE state_hash=:'state_hash_1'),'13 state short lived');

SELECT public.amocrm_start_connection_server(
  :'tenant_a', :'admin_a', :'state_hash_2', :'redirect_hash', now()+interval '10 minutes', NULL, NULL, false
) AS admin_start \gset
SELECT pg_temp.assert_true(:'admin_start'::jsonb->>'integrationAccountId'=:'integration_a','14 admin reuses stable integration account');
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM public.integration_oauth_states WHERE tenant_id=:'tenant_a'),'15 two starts create independent states');
SELECT pg_temp.assert_true((SELECT cancelled_at IS NOT NULL FROM public.integration_oauth_states WHERE state_hash=:'state_hash_1'),'16 previous pending state cancelled');
SELECT pg_temp.expect_error(format(
  'select public.amocrm_start_connection_server(%L::uuid,%L::uuid,%L,%L,now()+interval ''10 minutes'',NULL,NULL,false)',
  :'tenant_a',:'registrar_a',repeat('c',64),:'redirect_hash'
),'AMOCRM_PERMISSION_DENIED');
SELECT pg_temp.expect_error(format(
  'select public.amocrm_start_connection_server(%L::uuid,%L::uuid,%L,%L,now()+interval ''10 minutes'',NULL,NULL,false)',
  :'tenant_a',:'doctor_a',repeat('d',64),:'redirect_hash'
),'AMOCRM_PERMISSION_DENIED');
SELECT pg_temp.expect_error(format(
  'select public.amocrm_start_connection_server(%L::uuid,%L::uuid,%L,%L,now()+interval ''10 minutes'',NULL,NULL,false)',
  :'tenant_a',:'cashier_a',repeat('e',64),:'redirect_hash'
),'AMOCRM_PERMISSION_DENIED');
SELECT pg_temp.expect_error(format(
  'select public.amocrm_start_connection_server(%L::uuid,%L::uuid,%L,%L,now()+interval ''10 minutes'',NULL,NULL,false)',
  :'tenant_a',:'unknown_a',repeat('f',64),:'redirect_hash'
),'AMOCRM_PERMISSION_DENIED');

SELECT public.amocrm_claim_callback_state_server(:'state_hash_2', :'lease_2') AS claimed_2 \gset
SELECT pg_temp.assert_true(:'claimed_2'::jsonb->>'tenantId'=:'tenant_a','17 callback tenant comes from state');
SELECT pg_temp.assert_true(:'claimed_2'::jsonb->>'initiatedBy'=:'admin_a','18 callback actor binding retained');
SELECT pg_temp.expect_error(format(
  'select public.amocrm_claim_callback_state_server(%L,%L::uuid)', :'state_hash_2',:'lease_3'
),'AMOCRM_STATE_IN_PROGRESS');

SELECT public.amocrm_complete_callback_server(
  :'state_hash_2', :'lease_2', '123456', 'HTTPS://Clinic-One.AMOCRM.RU/path', 'Clinic One',
  decode('01020304','hex'), decode('05060708','hex'), 1, now()+interval '1 day'
) AS completed_2 \gset
SELECT pg_temp.assert_true(:'completed_2'::jsonb->>'ok'='true','19 callback connects successfully');
SELECT pg_temp.assert_true(:'completed_2'::jsonb->>'externalAccountId'='123456','20 authoritative account ID stored');
SELECT pg_temp.assert_true(:'completed_2'::jsonb->>'externalAccountDomain'='clinic-one.amocrm.ru','21 authoritative domain normalized');
SELECT pg_temp.assert_true((SELECT credential_version=1 AND status='connected' FROM public.integration_accounts WHERE id=:'integration_a'),'22 initial credential version one');
SELECT pg_temp.assert_true((SELECT encrypted_access_credential=decode('01020304','hex') AND encrypted_refresh_credential=decode('05060708','hex') FROM public.integration_credentials WHERE integration_account_id=:'integration_a'),'23 encrypted bytes stored only in protected table');
SELECT pg_temp.assert_true((SELECT consumed_at IS NOT NULL FROM public.integration_oauth_states WHERE state_hash=:'state_hash_2'),'24 state consumed once');
SELECT pg_temp.expect_error(format(
  'select public.amocrm_claim_callback_state_server(%L,%L::uuid)', :'state_hash_2',:'lease_3'
),'AMOCRM_STATE_CONSUMED');

SELECT public.amocrm_get_health_server(:'tenant_a',:'owner_a') AS health_owner \gset
SELECT public.amocrm_get_health_server(:'tenant_a',:'admin_a') AS health_admin \gset
SELECT public.amocrm_get_health_server(:'tenant_a',:'registrar_a') AS health_registrar \gset
SELECT pg_temp.assert_true(:'health_owner'::jsonb->>'status'='connected' AND :'health_owner'::jsonb->>'canManage'='true','25 owner safe health');
SELECT pg_temp.assert_true(:'health_admin'::jsonb->>'canManage'='true','26 admin safe health');
SELECT pg_temp.assert_true(:'health_registrar'::jsonb->>'canManage'='false','27 registrar safe read-only health');
SELECT pg_temp.assert_true(NOT (:'health_owner'::jsonb ?| ARRAY['accessToken','refreshToken','encryptedAccessCredential','encryptedRefreshCredential','authorizationCode','stateHash','clientSecret']),'28 health contains no secrets');
SELECT pg_temp.expect_error(format('select public.amocrm_get_health_server(%L::uuid,%L::uuid)',:'tenant_a',:'doctor_a'),'AMOCRM_PERMISSION_DENIED');
SELECT pg_temp.expect_error(format('select public.amocrm_get_health_server(%L::uuid,%L::uuid)',:'tenant_a',:'cashier_a'),'AMOCRM_PERMISSION_DENIED');
SELECT pg_temp.expect_error(format('select public.amocrm_get_health_server(%L::uuid,%L::uuid)',:'tenant_a',:'unknown_a'),'AMOCRM_PERMISSION_DENIED');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.integration_accounts),'29 owner reads own account through RLS');
SELECT pg_temp.expect_error('select count(*) from public.integration_credentials','permission denied');
SELECT pg_temp.expect_error('insert into public.integration_accounts(tenant_id,provider_code) values ('''||:'tenant_a'||''',''amocrm'')','permission denied');
SELECT set_config('request.jwt.claim.sub',:'registrar_a',true);
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.integration_accounts),'30 registrar reads safe account metadata');
SELECT set_config('request.jwt.claim.sub',:'doctor_a',true);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.integration_accounts),'31 doctor blocked by RLS');
SELECT set_config('request.jwt.claim.sub',:'cashier_a',true);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.integration_accounts),'32 cashier blocked by RLS');
SELECT set_config('request.jwt.claim.sub',:'unknown_a',true);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.integration_accounts),'33 NULL membership blocked');
SELECT set_config('request.jwt.claim.sub',:'owner_b',true);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.integration_accounts WHERE tenant_id=:'tenant_a'),'34 cross-tenant read blocked');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT pg_temp.expect_error('select count(*) from public.integration_accounts','permission denied');
RESET ROLE;

-- Expected account mismatch must not overwrite the valid credential row.
SELECT public.amocrm_start_connection_server(
  :'tenant_a', :'owner_a', :'state_hash_3', :'redirect_hash', now()+interval '10 minutes', '123456', 'clinic-one.amocrm.ru', true
) AS reconnect_3 \gset
SELECT public.amocrm_claim_callback_state_server(:'state_hash_3', :'lease_3') AS claimed_3 \gset
SELECT public.amocrm_complete_callback_server(
  :'state_hash_3', :'lease_3', '999999', 'wrong-account.amocrm.ru', 'Wrong',
  decode('aaaaaaaa','hex'), decode('bbbbbbbb','hex'), 1, now()+interval '1 day'
) AS mismatch_3 \gset
SELECT pg_temp.assert_true(:'mismatch_3'::jsonb->>'errorCode'='account_mismatch','35 account mismatch blocked');
SELECT pg_temp.assert_true((SELECT encrypted_access_credential=decode('01020304','hex') AND credential_version=1 FROM public.integration_credentials WHERE integration_account_id=:'integration_a'),'36 mismatch preserves valid credentials');

-- Successful reconnect replaces credentials only after verification.
SELECT public.amocrm_start_connection_server(
  :'tenant_a', :'owner_a', :'state_hash_4', :'redirect_hash', now()+interval '10 minutes', '123456', 'clinic-one.amocrm.ru', true
) AS reconnect_4 \gset
SELECT public.amocrm_claim_callback_state_server(:'state_hash_4', :'lease_4') AS claimed_4 \gset
SELECT public.amocrm_complete_callback_server(
  :'state_hash_4', :'lease_4', '123456', 'clinic-one.amocrm.ru', 'Clinic One',
  decode('11121314','hex'), decode('15161718','hex'), 1, now()+interval '1 day'
) AS completed_4 \gset
SELECT pg_temp.assert_true(:'completed_4'::jsonb->>'credentialVersion'='2','37 reconnect increments credential version');
SELECT pg_temp.assert_true((SELECT encrypted_access_credential=decode('11121314','hex') AND credential_version=2 FROM public.integration_credentials WHERE integration_account_id=:'integration_a'),'38 reconnect replaces encrypted credentials atomically');
SELECT pg_temp.expect_error(format(
  'select public.amocrm_claim_callback_state_server(%L,%L::uuid)', :'state_hash_3',:'lease_2'
),'AMOCRM_STATE_CONSUMED');

-- The same external account cannot bind to another active tenant.
SELECT public.amocrm_start_connection_server(
  :'tenant_b', :'owner_b', :'state_hash_b', :'redirect_hash', now()+interval '10 minutes', NULL, NULL, false
) AS start_b \gset
SELECT public.amocrm_claim_callback_state_server(:'state_hash_b', :'lease_b') AS claimed_b \gset
SELECT public.amocrm_complete_callback_server(
  :'state_hash_b', :'lease_b', '123456', 'clinic-one.amocrm.ru', 'Clinic One Duplicate',
  decode('21222324','hex'), decode('25262728','hex'), 1, now()+interval '1 day'
) AS completed_b \gset
SELECT pg_temp.assert_true(:'completed_b'::jsonb->>'errorCode'='account_already_bound','39 duplicate active external account blocked');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.integration_accounts WHERE external_account_id='123456' AND status IN ('connected','refresh_required','degraded','account_mismatch','revoked','disabled')),'40 one active account binding winner');

-- Refresh lease and expected version prevent stale overwrite.
UPDATE public.integration_credentials SET access_expires_at=now()-interval '1 minute' WHERE integration_account_id=:'integration_a';
UPDATE public.integration_accounts SET token_expires_at=now()-interval '1 minute' WHERE id=:'integration_a';
SELECT public.amocrm_acquire_refresh_server(:'tenant_a',:'owner_a',:'refresh_lease_1',300) AS refresh_acquire \gset
SELECT pg_temp.assert_true(:'refresh_acquire'::jsonb->>'status'='acquired' AND :'refresh_acquire'::jsonb->>'credentialVersion'='2','41 refresh lease acquired on exact version');
SELECT public.amocrm_acquire_refresh_server(:'tenant_a',:'admin_a',:'refresh_lease_2',300) AS refresh_loser \gset
SELECT pg_temp.assert_true(:'refresh_loser'::jsonb->>'status'='in_progress','42 parallel refresh loser reuses in-progress result');
SELECT public.amocrm_commit_refresh_server(
  :'integration_a', :'owner_a', :'refresh_lease_1', 2,
  decode('31323334','hex'), decode('35363738','hex'), 1, now()+interval '1 day',
  '123456', 'clinic-one.amocrm.ru', 'Clinic One'
) AS refresh_commit \gset
SELECT pg_temp.assert_true(:'refresh_commit'::jsonb->>'status'='refreshed' AND :'refresh_commit'::jsonb->>'credentialVersion'='3','43 refresh increments version once');
SELECT public.amocrm_commit_refresh_server(
  :'integration_a', :'owner_a', :'refresh_lease_1', 2,
  decode('41424344','hex'), decode('45464748','hex'), 1, now()+interval '1 day',
  '123456', 'clinic-one.amocrm.ru', 'Clinic One'
) AS stale_refresh \gset
SELECT pg_temp.assert_true(:'stale_refresh'::jsonb->>'status'='stale','44 stale refresh cannot overwrite winner');
SELECT pg_temp.assert_true((SELECT credential_version=3 AND encrypted_refresh_credential=decode('35363738','hex') FROM public.integration_credentials WHERE integration_account_id=:'integration_a'),'45 no credential rollback');

-- Refresh failure preserves metadata and requires reconnect.
UPDATE public.integration_credentials SET access_expires_at=now()-interval '1 minute' WHERE integration_account_id=:'integration_a';
UPDATE public.integration_accounts SET token_expires_at=now()-interval '1 minute' WHERE id=:'integration_a';
SELECT public.amocrm_acquire_refresh_server(:'tenant_a',:'owner_a',:'refresh_lease_2',300) AS refresh_acquire_2 \gset
SELECT public.amocrm_fail_refresh_server(:'integration_a',:'owner_a',:'refresh_lease_2','invalid_grant') AS refresh_failed \gset
SELECT pg_temp.assert_true(:'refresh_failed'::jsonb->>'status'='refresh_required','46 invalid grant represented safely');
SELECT pg_temp.assert_true((SELECT external_account_id='123456' AND credential_version=3 AND last_error_code='invalid_grant' FROM public.integration_accounts WHERE id=:'integration_a'),'47 failed refresh preserves account metadata/version');

-- External reference foundation stores identifiers only and enforces uniqueness/isolation.
SELECT public.amocrm_create_external_reference_server(
  :'tenant_a',:'owner_a','contact',:'internal_ref','external-contact-1',NULL
) AS ref_create \gset
SELECT (:'ref_create'::jsonb->>'id') AS ref_id \gset
SELECT pg_temp.assert_true(:'ref_create'::jsonb->>'entityType'='contact','48 external reference created without sync');
SELECT pg_temp.expect_error(format(
  'select public.amocrm_create_external_reference_server(%L::uuid,%L::uuid,%L,%L::uuid,%L,NULL)',
  :'tenant_a',:'owner_a','contact',:'internal_ref','external-contact-2'
),'duplicate key');
SELECT pg_temp.expect_error(format(
  'select public.amocrm_create_external_reference_server(%L::uuid,%L::uuid,%L,%L::uuid,%L,NULL)',
  :'tenant_a',:'owner_a','contact',:'internal_ref_2','external-contact-1'
),'duplicate key');
SELECT pg_temp.expect_error(format(
  'select public.amocrm_create_external_reference_server(%L::uuid,%L::uuid,%L,%L::uuid,%L,NULL)',
  :'tenant_a',:'owner_b','contact',:'internal_ref_2','external-contact-b'
),'AMOCRM_PERMISSION_DENIED');
SELECT public.amocrm_archive_external_reference_server(:'tenant_a',:'owner_a',:'ref_id') AS ref_archived \gset
SELECT pg_temp.assert_true(:'ref_archived'::jsonb->>'archived'='true','49 reference archived safely');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'registrar_a',true);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.integration_external_references WHERE archived_at IS NULL),'50 registrar safe reference read');
SELECT pg_temp.expect_error(format(
  'insert into public.integration_external_references(tenant_id,integration_account_id,provider_code,entity_type,internal_entity_id,external_entity_id) values (%L::uuid,%L::uuid,''amocrm'',''contact'',%L::uuid,''direct'')',
  :'tenant_a',:'integration_a',:'internal_ref_2'
),'permission denied');
RESET ROLE;

-- Disconnect is tenant-scoped, cryptographically destroys active credentials, cancels states and is idempotent.
SELECT public.amocrm_disconnect_server(:'tenant_a',:'owner_a') AS disconnect_1 \gset
SELECT public.amocrm_disconnect_server(:'tenant_a',:'owner_a') AS disconnect_2 \gset
SELECT pg_temp.assert_true(:'disconnect_1'::jsonb->>'replayed'='false','51 first disconnect changes state');
SELECT pg_temp.assert_true(:'disconnect_2'::jsonb->>'replayed'='true','52 disconnect replay idempotent');
SELECT pg_temp.assert_true((SELECT status='disconnected' AND token_expires_at IS NULL FROM public.integration_accounts WHERE id=:'integration_a'),'53 only tenant A disconnected');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.integration_credentials WHERE integration_account_id=:'integration_a'),'54 credentials destroyed on disconnect');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.integration_accounts WHERE tenant_id=:'tenant_b'),'55 tenant B integration row unaffected');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.audit_events WHERE tenant_id=:'tenant_a' AND action='amocrm_disconnected'),'56 disconnect audited once');

SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.audit_events WHERE metadata::text ~* '(access[_ ]?token|refresh[_ ]?token|client[_ ]?secret|authorization[_ ]?code|state[_ ]?hash|01020304|35363738)'),'57 no credential/state material in audit');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.activity_events WHERE metadata::text ~* '(access[_ ]?token|refresh[_ ]?token|client[_ ]?secret|authorization[_ ]?code|state[_ ]?hash|01020304|35363738)'),'58 no credential/state material in activity');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.audit_events WHERE tenant_id=:'tenant_a' AND action LIKE 'amocrm_%')=(SELECT count(*) FROM public.activity_events WHERE tenant_id=:'tenant_a' AND type LIKE 'amocrm_%'),'59 audit/activity parity');

-- No business or communication side effects.
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.patients)=:'patients_before','60 patients unchanged');
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.appointments)=:'appointments_before','61 appointments unchanged');
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.appointment_reminder_jobs)=:'reminder_jobs_before','62 reminder jobs unchanged');
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.communication_operations)=:'communication_operations_before','63 communication operations unchanged');
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.communication_templates)=:'templates_before','64 templates unchanged');
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.patient_visits)=:'visits_before','65 visits unchanged');
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.clinical_encounters)=:'encounters_before','66 encounters unchanged');
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.findings)=:'findings_before','67 findings unchanged');
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.treatment_plans)=:'treatment_plans_before','68 treatment plans unchanged');
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.completed_services)=:'services_before','69 completed services unchanged');
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.invoices)=:'invoices_before','70 invoices unchanged');
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.payments)=:'payments_before','71 payments unchanged');
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.refunds)=:'refunds_before','72 refunds unchanged');
SELECT pg_temp.assert_true((SELECT count(*)::text FROM public.financial_adjustments)=:'writeoffs_before','73 write-offs unchanged');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.communication_operations WHERE metadata::text ILIKE '%amocrm%'),'74 no communication operation created');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.integration_external_references WHERE metadata <> '{}'::jsonb),'75 no clinical/financial payload in external references');

ROLLBACK;
\echo 'AMOCRM-INTEGRATION-HARDENING-001 SQL validation passed: 75 assertions'

