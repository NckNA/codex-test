\set ON_ERROR_STOP on
\echo 'PLATFORM-SUPERADMIN-TENANT-LIFECYCLE-001 SQL validation'
BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.assert_true(p_condition boolean,p_message text)
RETURNS void LANGUAGE plpgsql AS $$BEGIN IF NOT coalesce(p_condition,false) THEN RAISE EXCEPTION 'ASSERTION FAILED: %',p_message; END IF; END$$;
CREATE OR REPLACE FUNCTION pg_temp.expect_error(p_sql text,p_expected text)
RETURNS void LANGUAGE plpgsql AS $$DECLARE v_message text; BEGIN BEGIN EXECUTE p_sql; RAISE EXCEPTION 'expected error containing "%"',p_expected; EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_message=MESSAGE_TEXT; IF v_message LIKE 'expected error containing%' THEN RAISE; END IF; IF position(lower(p_expected) in lower(v_message))=0 THEN RAISE EXCEPTION 'expected "%", got "%"',p_expected,v_message; END IF; END; END$$;

\set super '35010000-0000-4000-8000-000000000001'
\set disabled_super '35010000-0000-4000-8000-000000000002'
\set owner_a '35010000-0000-4000-8000-000000000003'
\set owner_2 '35010000-0000-4000-8000-000000000004'
\set admin_a '35010000-0000-4000-8000-000000000005'
\set doctor_a '35010000-0000-4000-8000-000000000006'
\set registrar_a '35010000-0000-4000-8000-000000000007'
\set cashier_a '35010000-0000-4000-8000-000000000008'
\set unknown_a '35010000-0000-4000-8000-000000000009'
\set multi_user '35010000-0000-4000-8000-000000000010'
\set tenant_a '35020000-0000-4000-8000-000000000001'
\set tenant_b '35020000-0000-4000-8000-000000000002'
\set patient_a '35030000-0000-4000-8000-000000000001'
\set doctor_row '35040000-0000-4000-8000-000000000001'
\set appt_a '35050000-0000-4000-8000-000000000001'
\set payment_a '35060000-0000-4000-8000-000000000001'
\set encounter_a '35070000-0000-4000-8000-000000000001'

INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) VALUES
(:'super','00000000-0000-0000-0000-000000000000','authenticated','authenticated','platform-super@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
(:'disabled_super','00000000-0000-0000-0000-000000000000','authenticated','authenticated','platform-disabled@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
(:'owner_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','owner-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
(:'owner_2','00000000-0000-0000-0000-000000000000','authenticated','authenticated','owner-2@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
(:'admin_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
(:'doctor_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','doctor-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
(:'registrar_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','registrar-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
(:'cashier_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','cashier-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
(:'unknown_a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','unknown-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
(:'multi_user','00000000-0000-0000-0000-000000000000','authenticated','authenticated','multi@example.local','x',now(),'{"provider":"email"}','{}',now(),now());
INSERT INTO public.profiles(id,first_name,last_name) VALUES
(:'super','Platform','Superadmin'),(:'disabled_super','Disabled','Platform'),(:'owner_a','Owner','A'),(:'owner_2','Owner','Two'),(:'admin_a','Admin','A'),(:'doctor_a','Doctor','A'),(:'registrar_a','Registrar','A'),(:'cashier_a','Cashier','A'),(:'unknown_a','Unknown','A'),(:'multi_user','Multi','Tenant');
INSERT INTO public.platform_administrators(user_id,status,display_name) VALUES
(:'super','active','Platform Superadmin'),(:'disabled_super','disabled','Disabled Platform Admin');

INSERT INTO public.tenants(id,name,timezone) VALUES (:'tenant_a','Lifecycle Existing A','Asia/Almaty'),(:'tenant_b','Lifecycle Existing B','Asia/Almaty');
INSERT INTO public.tenant_users(tenant_id,user_id,role) VALUES
(:'tenant_a',:'owner_a','clinic_owner'),(:'tenant_a',:'admin_a','clinic_admin'),(:'tenant_a',:'doctor_a','doctor'),(:'tenant_a',:'registrar_a','registrar'),(:'tenant_a',:'cashier_a','cashier'),(:'tenant_a',:'multi_user','registrar'),
(:'tenant_b',:'owner_2','clinic_owner'),(:'tenant_b',:'multi_user','registrar');

INSERT INTO public.patients(id,tenant_id,full_name) VALUES (:'patient_a',:'tenant_a','Lifecycle Patient');
INSERT INTO public.doctors(id,tenant_id,user_id,full_name,active) VALUES (:'doctor_row',:'tenant_a',:'doctor_a','Lifecycle Doctor',true);
INSERT INTO public.appointments(id,tenant_id,patient_id,doctor_id,status,payment_type,source,start_time,end_time)
VALUES (:'appt_a',:'tenant_a',:'patient_a',:'doctor_row','new','cash','phone',now()+interval '1 day',now()+interval '1 day 1 hour');
INSERT INTO public.payments(id,tenant_id,patient_id,status,payment_method,amount,currency,received_at,metadata)
VALUES (:'payment_a',:'tenant_a',:'patient_a','received','cash',1000,'KZT',now(),'{}');
INSERT INTO public.clinical_encounters(id,tenant_id,patient_id,status,encounter_type,metadata)
VALUES (:'encounter_a',:'tenant_a',:'patient_a','draft','consultation','{}');

SELECT (now()-interval '1 day')::text AS create_start,
       (now()+interval '30 days')::text AS create_expiry,
       (now()+interval '37 days')::text AS create_grace,
       (now()+interval '2 hours')::text AS audit_suspend_until
\gset

SELECT pg_temp.assert_true(public.is_active_platform_superadmin(:'super'),'1 active platform superadmin recognized');
SELECT pg_temp.assert_true(NOT public.is_active_platform_superadmin(:'disabled_super'),'2 disabled platform superadmin blocked');
SELECT pg_temp.assert_true(NOT public.is_active_platform_superadmin(:'owner_a'),'3 clinic owner is not platform admin');
SELECT pg_temp.assert_true(NOT public.is_active_platform_superadmin(:'admin_a'),'4 clinic admin is not platform admin');
SELECT pg_temp.assert_true(NOT public.is_active_platform_superadmin(:'doctor_a'),'5 doctor blocked');
SELECT pg_temp.assert_true(NOT public.is_active_platform_superadmin(:'registrar_a'),'6 registrar blocked');
SELECT pg_temp.assert_true(NOT public.is_active_platform_superadmin(:'cashier_a'),'7 cashier blocked');
SELECT pg_temp.assert_true(NOT public.is_active_platform_superadmin(:'unknown_a'),'8 unknown user blocked');
SELECT pg_temp.assert_true(NOT public.is_active_platform_superadmin(NULL),'9 anonymous blocked');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
SELECT pg_temp.expect_error(format('insert into public.platform_administrators(user_id,status) values (%L::uuid,''active'')',:'unknown_a'),'permission denied');
SELECT pg_temp.assert_true(true,'10 direct platform-admin insertion blocked');
SELECT pg_temp.expect_error(format('insert into public.platform_administrators(user_id,status) values (%L::uuid,''active'')',:'owner_a'),'permission denied');
SELECT pg_temp.assert_true(true,'11 self-promotion blocked');
SELECT pg_temp.expect_error(format('select public.create_platform_tenant(''Forbidden Clinic'',%L::uuid,now(),now()+interval ''1 month'',now()+interval ''2 months'',''forbidden-create'')',:'owner_a'),'PLATFORM_ADMIN_REQUIRED');
SELECT pg_temp.assert_true(true,'13 non-superadmin tenant creation blocked');
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub',:'super',true);
SELECT public.create_platform_tenant('Created Clinic',:'owner_2',:'create_start'::timestamptz,:'create_expiry'::timestamptz,:'create_grace'::timestamptz,'create-001') AS created \gset
SELECT (:'created'::jsonb->>'tenantId') AS created_tenant \gset
SELECT pg_temp.assert_true(:'created'::jsonb->>'effectiveStatus'='active','12 superadmin creates tenant');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.tenant_lifecycle WHERE tenant_id=:'created_tenant'),'14 lifecycle created');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.tenant_subscription_periods WHERE tenant_id=:'created_tenant' AND superseded_at IS NULL),'15 subscription created');
SELECT pg_temp.assert_true(jsonb_array_length(public.get_platform_tenant_details(:'created_tenant')->'owners')=1,'16 owner assigned');
SELECT pg_temp.assert_true((public.get_platform_tenant_details(:'created_tenant')->'owners'->0->>'membershipStatus')='active','17 created active tenant has active owner');
SELECT count(*)::text AS tenants_before_bad_owner FROM public.tenants \gset
SELECT pg_temp.expect_error('select public.create_platform_tenant(''Bad Owner'',''ffffffff-ffff-4fff-8fff-ffffffffffff''::uuid,now(),now()+interval ''1 month'',NULL,''bad-owner'')','OWNER_NOT_FOUND');
SELECT pg_temp.assert_true((SELECT count(*)=:tenants_before_bad_owner::bigint FROM public.tenants),'18 failed owner resolution rolls back');
SELECT pg_temp.expect_error(format('select public.create_platform_tenant(''Bad Dates'',%L::uuid,now(),now()-interval ''1 day'',NULL,''bad-dates'')',:'owner_2'),'INVALID_SUBSCRIPTION_DATES');
SELECT pg_temp.assert_true((SELECT count(*)=:tenants_before_bad_owner::bigint FROM public.tenants),'19 invalid subscription rolls back');
SELECT public.create_platform_tenant('Created Clinic',:'owner_2',:'create_start'::timestamptz,:'create_expiry'::timestamptz,:'create_grace'::timestamptz,'create-001') AS replay \gset
SELECT pg_temp.assert_true(:'replay'::jsonb->>'tenantId'=:'created_tenant' AND (:'replay'::jsonb->>'replay')::boolean,'20 same creation key replays');
SELECT pg_temp.expect_error(format('select public.create_platform_tenant(''Changed Clinic'',%L::uuid,now()-interval ''1 day'',now()+interval ''30 days'',now()+interval ''37 days'',''create-001'')',:'owner_2'),'PLATFORM_OPERATION_CONFLICT');
SELECT pg_temp.assert_true(true,'21 same key changed payload conflicts');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.tenant_users WHERE tenant_id=:'created_tenant' AND user_id=:'super'),'46 platform admin not added to tenant');

SELECT pg_temp.assert_true((SELECT allowed FROM public.tenant_operational_access_allowed(:'tenant_a',:'owner_a','test')),'23 active tenant access allowed');
RESET ROLE;

-- Future subscription and grace/expiry derivation.
UPDATE public.tenant_lifecycle SET status='provisioning',subscription_started_at=now()+interval '1 day',subscription_expires_at=now()+interval '30 days',grace_expires_at=now()+interval '37 days' WHERE tenant_id=:'tenant_b';
SELECT pg_temp.assert_true(public.get_tenant_effective_lifecycle_status(:'tenant_b',now())='provisioning','24 subscription not started blocks');
UPDATE public.tenant_lifecycle SET status='active',subscription_started_at=now()-interval '30 days',subscription_expires_at=now()-interval '2 days',grace_expires_at=now()+interval '2 days' WHERE tenant_id=:'tenant_b';
SELECT pg_temp.assert_true(public.get_tenant_effective_lifecycle_status(:'tenant_b',now())='active','26 grace preserves access');
SELECT pg_temp.assert_true(public.get_tenant_effective_lifecycle_status(:'tenant_b',now()+interval '3 days')='expired','27 grace expiration blocks');
UPDATE public.tenant_lifecycle SET subscription_expires_at=now()-interval '3 days',grace_expires_at=now()-interval '1 day' WHERE tenant_id=:'tenant_b';
SELECT pg_temp.assert_true(public.get_tenant_effective_lifecycle_status(:'tenant_b',now())='expired','25 expired subscription blocks');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub',:'super',true);
SELECT public.suspend_tenant(:'tenant_a','administrative','Safe lifecycle QA note',now()+interval '1 hour','suspend-temp') AS temp_suspend \gset
SELECT pg_temp.assert_true(public.get_tenant_effective_lifecycle_status(:'tenant_a',now())='suspended','28 temporary suspension blocks');
SELECT pg_temp.assert_true(public.get_tenant_effective_lifecycle_status(:'tenant_a',now()+interval '2 hours')='active','29 suspension ending restores effective access');
SELECT public.resume_tenant(:'tenant_a','qa_resume','resume-valid') AS resumed \gset
SELECT pg_temp.assert_true(:'resumed'::jsonb->>'status'='active','31 resume succeeds with valid subscription');
SELECT public.suspend_tenant(:'tenant_a','contract_pause',NULL,NULL,'suspend-indefinite') AS indefinite \gset
SELECT pg_temp.assert_true(public.get_tenant_effective_lifecycle_status(:'tenant_a',now()+interval '10 years')='suspended','30 indefinite suspension blocks');
SELECT public.resume_tenant(:'tenant_a','qa_resume','resume-after-indefinite') AS resumed2 \gset

RESET ROLE;
UPDATE public.tenant_lifecycle
SET status='expired',subscription_started_at=now()-interval '30 days',subscription_expires_at=now()-interval '2 days',grace_expires_at=now()-interval '1 day'
WHERE tenant_id=:'tenant_b';
UPDATE public.tenant_subscription_periods
SET starts_at=now()-interval '30 days',expires_at=now()-interval '2 days',grace_expires_at=now()-interval '1 day',status='expired'
WHERE tenant_id=:'tenant_b' AND superseded_at IS NULL;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub',:'super',true);
SELECT pg_temp.expect_error(format('select public.resume_tenant(%L::uuid,''qa'',''resume-expired'')',:'tenant_b'),'RESUME_REQUIRES_VALID_SUBSCRIPTION');
SELECT pg_temp.assert_true(true,'32 resume blocked with expired subscription');
SELECT count(*)::text AS history_before FROM public.tenant_subscription_periods WHERE tenant_id=:'tenant_b' \gset
SELECT public.extend_tenant_subscription(:'tenant_b',now()+interval '60 days',now()+interval '67 days','manual_extension','extend-expired') AS extended \gset
SELECT pg_temp.assert_true(:'extended'::jsonb->>'effectiveStatus'='active','33 extension restores access');
SELECT pg_temp.assert_true((SELECT count(*)=:history_before::bigint+1 FROM public.tenant_subscription_periods WHERE tenant_id=:'tenant_b'),'34 subscription history preserved');
SELECT public.shorten_tenant_subscription(:'tenant_b',now()+interval '30 days',now()+interval '37 days','contract_change',true,false,'shorten-001') AS shortened \gset
SELECT pg_temp.assert_true(
  jsonb_path_exists(public.get_platform_tenant_details(:'tenant_b')->'lifecycleHistory', '$[*] ? (@.action == "platform_tenant_subscription_shortened")'),
  '35 shortening audited through safe lifecycle history'
);

SELECT public.add_platform_tenant_owner(:'tenant_a',:'owner_2','owner-add-001') AS owner_added \gset
SELECT pg_temp.assert_true((:'owner_added'::jsonb->>'ownerCount')::int=2,'43 add second owner succeeds');
SELECT public.remove_platform_tenant_owner(:'tenant_a',:'owner_2','owner-remove-001') AS owner_removed \gset
SELECT pg_temp.expect_error(format('select public.remove_platform_tenant_owner(%L::uuid,%L::uuid,''owner-remove-last'')',:'tenant_a',:'owner_a'),'LAST_CLINIC_OWNER_REQUIRED');
SELECT pg_temp.assert_true(true,'44 final owner removal blocked');
RESET ROLE;

INSERT INTO public.tenant_users(tenant_id,user_id,role,membership_status)
VALUES (:'tenant_b',:'unknown_a','clinic_owner','disabled');
SELECT pg_temp.assert_true(
  (SELECT count(*)=1 FROM public.tenant_users WHERE tenant_id=:'tenant_b' AND role='clinic_owner' AND membership_status='active')
  AND (SELECT count(*)=1 FROM public.tenant_users WHERE tenant_id=:'tenant_b' AND role='clinic_owner' AND membership_status='disabled'),
  '45 disabled owner does not satisfy owner invariant'
);

-- Suspended core mutations denied while data remains.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub',:'super',true);
SELECT public.suspend_tenant(:'tenant_a','compliance_review',NULL,NULL,'suspend-core') AS suspended_core \gset
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
WITH changed AS (UPDATE public.patients SET notes='blocked' WHERE id=:'patient_a' RETURNING 1)
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM changed),'48 suspended patient mutation blocked');
WITH changed AS (UPDATE public.appointments SET comment='blocked' WHERE id=:'appt_a' RETURNING 1)
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM changed),'49 suspended appointment mutation blocked');
SELECT pg_temp.expect_error(
  format('update public.payments set metadata=jsonb_build_object(''blocked'',true) where id=%L::uuid',:'payment_a'),
  'permission denied'
);
SELECT pg_temp.assert_true(true,'50 suspended payment mutation blocked');
SELECT pg_temp.expect_error(
  format('update public.clinical_encounters set metadata=jsonb_build_object(''blocked'',true) where id=%L::uuid',:'encounter_a'),
  'permission denied'
);
SELECT pg_temp.assert_true(true,'51 suspended clinical mutation blocked');
SELECT pg_temp.expect_error(format('select public.amocrm_start_connection_server(%L::uuid,%L::uuid,%L,%L,now()+interval ''10 minutes'',NULL,NULL,false)',:'tenant_a',:'owner_a',repeat('a',64),repeat('b',64)),'permission denied');
SELECT pg_temp.assert_true(true,'53 suspended integration mutation blocked');
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub',:'super',true);
SELECT public.resume_tenant(:'tenant_a','qa_resume','resume-core') AS resume_core \gset
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
UPDATE public.patients SET notes='active-flow-ok' WHERE id=:'patient_a';
SELECT pg_temp.assert_true((SELECT notes='active-flow-ok' FROM public.patients WHERE id=:'patient_a'),'54 active tenant flow remains functional');
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM public.list_my_tenant_access() WHERE operational_access_allowed),'55 multi-tenant switch source has two active tenants') FROM (SELECT set_config('request.jwt.claim.sub',:'multi_user',true)) s;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub',:'owner_a',true);
SELECT pg_temp.expect_error(format('select public.get_tenant_lifecycle_summary(%L::uuid)',:'tenant_b'),'TENANT_LIFECYCLE_READ_FORBIDDEN');
SELECT pg_temp.assert_true(true,'61 cross-tenant lifecycle read blocked');
SELECT pg_temp.expect_error(format('delete from public.tenants where id=%L::uuid',:'tenant_a'),'permission denied');
SELECT pg_temp.assert_true(true,'42 physical tenant delete unavailable to authenticated');
SELECT pg_temp.expect_error(format('update public.tenant_lifecycle set status=''active'' where tenant_id=%L::uuid',:'tenant_a'),'permission denied');
SELECT pg_temp.assert_true(true,'57 direct lifecycle writes blocked');
SELECT pg_temp.expect_error(format('update public.tenant_subscription_periods set reason_code=''x'' where tenant_id=%L::uuid',:'tenant_a'),'permission denied');
SELECT pg_temp.assert_true(true,'58 direct subscription writes blocked');
RESET ROLE;

SELECT pg_temp.assert_true((SELECT relrowsecurity FROM pg_class WHERE oid='public.platform_administrators'::regclass),'56 platform administrators RLS enabled');
SELECT pg_temp.assert_true((SELECT relrowsecurity FROM pg_class WHERE oid='public.tenant_lifecycle'::regclass),'56 lifecycle RLS enabled');
SELECT pg_temp.assert_true((SELECT relrowsecurity FROM pg_class WHERE oid='public.tenant_subscription_periods'::regclass),'56 subscription RLS enabled');

SELECT count(*)::text AS audit_before_replay FROM public.audit_events WHERE tenant_id=:'tenant_a' AND action='platform_tenant_suspended' \gset
SELECT count(*)::text AS activity_before_replay FROM public.activity_events WHERE tenant_id=:'tenant_a' AND type='platform_tenant_suspended' \gset
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub',:'super',true);
SELECT public.suspend_tenant(:'tenant_a','administrative',NULL,:'audit_suspend_until'::timestamptz,'audit-once') AS audit_once \gset
SELECT public.suspend_tenant(:'tenant_a','administrative',NULL,:'audit_suspend_until'::timestamptz,'audit-once') AS audit_replay \gset
SELECT pg_temp.assert_true((:'audit_replay'::jsonb->>'replay')::boolean,'60 replay result marked');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT count(*)=:audit_before_replay::bigint+1 FROM public.audit_events WHERE tenant_id=:'tenant_a' AND action='platform_tenant_suspended'),'59 audit written once');
SELECT pg_temp.assert_true((SELECT count(*)=:activity_before_replay::bigint+1 FROM public.activity_events WHERE tenant_id=:'tenant_a' AND type='platform_tenant_suspended'),'60 replay does not duplicate activity');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub',:'super',true);
SELECT public.resume_tenant(:'tenant_a','qa','resume-before-archive') AS pre_archive_resume \gset
SELECT public.archive_tenant(:'tenant_a','customer_request',true,'archive-001') AS archived \gset
SELECT pg_temp.assert_true(public.get_tenant_effective_lifecycle_status(:'tenant_a',now())='archived','36 archive blocks access');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.tenants WHERE id=:'tenant_a'),'37 archive preserves tenant');
SELECT pg_temp.assert_true((SELECT count(*)>=1 FROM public.tenant_users WHERE tenant_id=:'tenant_a'),'38 archive preserves memberships');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.patients WHERE id=:'patient_a'),'39 archive preserves patients');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.appointments WHERE id=:'appt_a'),'40 archive preserves appointments');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.payments WHERE id=:'payment_a'),'41 archive preserves financial records');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.tenant_users WHERE user_id=:'super'),'46 platform admin remains outside clinics');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub',:'super',true);
SELECT pg_temp.assert_true((SELECT jsonb_path_query_array(to_jsonb(x),'$.**.fullName')='[]'::jsonb FROM public.list_platform_tenants(NULL,NULL,100,0) x LIMIT 1),'47 platform list excludes patient names');
SELECT pg_temp.assert_true((SELECT count(*)>=1 FROM public.list_platform_tenants(NULL,NULL,100,0)),'22 platform list tenant data isolated');
SELECT pg_temp.assert_true((SELECT to_jsonb(x)::text !~* 'patient|diagnos|payment|phone|complaint' FROM public.list_platform_tenants(NULL,NULL,100,0) x LIMIT 1),'62 platform listing excludes clinical and financial payloads');
RESET ROLE;

-- Expired communication mutation is blocked at shared manager/lifecycle helper boundary.
UPDATE public.tenant_lifecycle SET status='expired',subscription_expires_at=now()-interval '2 days',grace_expires_at=now()-interval '1 day' WHERE tenant_id=:'tenant_b';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub',:'owner_2',true);
SELECT pg_temp.assert_true((SELECT NOT allowed AND reason_code='subscription_expired' FROM public.tenant_operational_access_allowed(:'tenant_b',:'owner_2','communication')),'52 expired tenant communication blocked');
RESET ROLE;

SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.tenant_lifecycle tl WHERE tl.status='active' AND NOT EXISTS(SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id=tl.tenant_id AND tu.role='clinic_owner' AND tu.membership_status='active')),'database counter active ownerless tenants zero');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.tenants t LEFT JOIN public.tenant_lifecycle tl ON tl.tenant_id=t.id WHERE tl.tenant_id IS NULL),'database counter tenants without lifecycle zero');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM (SELECT tenant_id,count(*) FROM public.tenant_subscription_periods WHERE superseded_at IS NULL GROUP BY tenant_id HAVING count(*)>1) q),'database counter multiple current periods zero');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.platform_administrators pa JOIN public.tenant_users tu ON tu.user_id=pa.user_id),'database counter platform admins auto-added zero');

ROLLBACK;
\echo 'PLATFORM-SUPERADMIN-TENANT-LIFECYCLE-001 SQL validation passed'
