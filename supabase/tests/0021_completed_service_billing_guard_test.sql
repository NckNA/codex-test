\set ON_ERROR_STOP on
\echo 'COMPLETED-SERVICE-BILLING-GUARD-001 local SQL validation'

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

-- All identities and domain rows are scoped to this transaction.  This test
-- intentionally does not depend on the optional local QA-user seed.
\set tenant_a 'a9210000-0000-4000-8000-000000000001'
\set tenant_b 'b9210000-0000-4000-8000-000000000001'
\set patient_a 'a9220000-0000-4000-8000-000000000001'
\set patient_a2 'a9220000-0000-4000-8000-000000000002'
\set patient_b 'b9220000-0000-4000-8000-000000000001'
\set owner_a 'a9230000-0000-4000-8000-000000000001'
\set admin_a 'a9230000-0000-4000-8000-000000000002'
\set cashier_a 'a9230000-0000-4000-8000-000000000003'
\set doctor_a 'a9230000-0000-4000-8000-000000000004'
\set registrar_a 'a9230000-0000-4000-8000-000000000005'
\set notenant 'a9230000-0000-4000-8000-000000000006'
\set admin_b 'b9230000-0000-4000-8000-000000000001'
\set appointment_doctor_a 'a9260000-0000-4000-8000-000000000001'
\set invoice_a1 'a9240000-0000-4000-8000-000000000001'
\set invoice_a2 'a9240000-0000-4000-8000-000000000002'
\set invoice_a_patient2 'a9240000-0000-4000-8000-000000000003'
\set invoice_b 'b9240000-0000-4000-8000-000000000001'
\set service_a1 'a9250000-0000-4000-8000-000000000001'
\set service_a2 'a9250000-0000-4000-8000-000000000002'
\set service_corrected 'a9250000-0000-4000-8000-000000000003'
\set service_archived 'a9250000-0000-4000-8000-000000000004'
\set service_owner 'a9250000-0000-4000-8000-000000000005'
\set service_admin 'a9250000-0000-4000-8000-000000000006'
\set service_cashier 'a9250000-0000-4000-8000-000000000007'

INSERT INTO public.tenants(id, name) VALUES
  (:'tenant_a', 'Completed service billing guard A'),
  (:'tenant_b', 'Completed service billing guard B');
INSERT INTO auth.users(id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  (:'owner_a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'csg-owner@example.local', 'not-a-secret', now(), '{"provider":"email"}', '{}', now(), now()),
  (:'admin_a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'csg-admin@example.local', 'not-a-secret', now(), '{"provider":"email"}', '{}', now(), now()),
  (:'cashier_a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'csg-cashier@example.local', 'not-a-secret', now(), '{"provider":"email"}', '{}', now(), now()),
  (:'doctor_a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'csg-doctor@example.local', 'not-a-secret', now(), '{"provider":"email"}', '{}', now(), now()),
  (:'registrar_a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'csg-registrar@example.local', 'not-a-secret', now(), '{"provider":"email"}', '{}', now(), now()),
  (:'notenant', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'csg-notenant@example.local', 'not-a-secret', now(), '{"provider":"email"}', '{}', now(), now()),
  (:'admin_b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'csg-admin-b@example.local', 'not-a-secret', now(), '{"provider":"email"}', '{}', now(), now());
INSERT INTO public.profiles(id) VALUES
  (:'owner_a'), (:'admin_a'), (:'cashier_a'), (:'doctor_a'), (:'registrar_a'), (:'notenant'), (:'admin_b');
INSERT INTO public.tenant_users(tenant_id, user_id, role) VALUES
  (:'tenant_a', :'owner_a', 'clinic_owner'),
  (:'tenant_a', :'admin_a', 'clinic_admin'),
  (:'tenant_a', :'cashier_a', 'cashier'),
  (:'tenant_a', :'doctor_a', 'doctor'),
  (:'tenant_a', :'registrar_a', 'registrar'),
  (:'tenant_b', :'admin_b', 'clinic_admin');

INSERT INTO public.patients(id, tenant_id, full_name, phone, source, balance) VALUES
  (:'patient_a', :'tenant_a', 'Billing Guard Patient A', '+77009220001', 'phone', 777),
  (:'patient_a2', :'tenant_a', 'Billing Guard Patient A2', '+77009220002', 'phone', 0),
  (:'patient_b', :'tenant_b', 'Billing Guard Patient B', '+77009220003', 'phone', 0);
INSERT INTO public.doctors(id, tenant_id, full_name)
VALUES (:'appointment_doctor_a', :'tenant_a', 'Billing guard fixture doctor');
INSERT INTO public.appointments(tenant_id, patient_id, doctor_id, service, status, start_time, end_time)
VALUES (:'tenant_a', :'patient_a', :'appointment_doctor_a', 'No billing side effect fixture', 'completed', now() - interval '1 hour', now());
INSERT INTO public.invoices(id, tenant_id, patient_id, invoice_number, status, currency, subtotal_amount, total_amount, balance_amount, created_by, metadata) VALUES
  (:'invoice_a1', :'tenant_a', :'patient_a', 'CSBG-A1', 'draft', 'KZT', 0, 0, 0, :'admin_a', '{}'),
  (:'invoice_a2', :'tenant_a', :'patient_a', 'CSBG-A2', 'draft', 'KZT', 0, 0, 0, :'admin_a', '{}'),
  (:'invoice_a_patient2', :'tenant_a', :'patient_a2', 'CSBG-A-P2', 'draft', 'KZT', 0, 0, 0, :'admin_a', '{}'),
  (:'invoice_b', :'tenant_b', :'patient_b', 'CSBG-B1', 'draft', 'KZT', 0, 0, 0, :'admin_b', '{}');
INSERT INTO public.completed_services(id, tenant_id, patient_id, service_name, service_code, tooth_number, tooth_surface, quantity, unit_price, total_amount, currency, status, correction_reason, archived_at, created_by, metadata) VALUES
  (:'service_a1', :'tenant_a', :'patient_a', 'Guard service one', 'CS-1', '11', 'O', 1, 1000, 1000, 'KZT', 'completed', NULL, NULL, :'admin_a', '{}'),
  (:'service_a2', :'tenant_a', :'patient_a', 'Guard service two', 'CS-2', '12', 'M', 1, 2000, 2000, 'KZT', 'completed', NULL, NULL, :'admin_a', '{}'),
  (:'service_corrected', :'tenant_a', :'patient_a', 'Corrected service', NULL, NULL, NULL, 1, 10, 10, 'KZT', 'corrected', 'fixture correction', NULL, :'admin_a', '{}'),
  (:'service_archived', :'tenant_a', :'patient_a', 'Archived service', NULL, NULL, NULL, 1, 10, 10, 'KZT', 'archived', NULL, now(), :'admin_a', '{}'),
  (:'service_owner', :'tenant_a', :'patient_a', 'Owner service', NULL, NULL, NULL, 1, 50, 50, 'KZT', 'completed', NULL, NULL, :'admin_a', '{}'),
  (:'service_admin', :'tenant_a', :'patient_a', 'Admin service', NULL, NULL, NULL, 1, 60, 60, 'KZT', 'completed', NULL, NULL, :'admin_a', '{}'),
  (:'service_cashier', :'tenant_a', :'patient_a', 'Cashier service', NULL, NULL, NULL, 1, 70, 70, 'KZT', 'completed', NULL, NULL, :'admin_a', '{}');

-- The schema deliberately has no "incomplete" completed-service state. It
-- rejects that invalid lifecycle value; valid non-final/archived rows below
-- are separately proven unavailable to the billing RPC.
SELECT pg_temp.expect_error(format('insert into public.completed_services(tenant_id,patient_id,service_name,status) values(%L::uuid,%L::uuid,''invalid incomplete'',''incomplete'')', :'tenant_a', :'patient_a'), 'completed_services_status_check');

SELECT balance::text AS balance_before FROM public.patients WHERE id = :'patient_a' \gset
SELECT encode(digest(coalesce(jsonb_agg(to_jsonb(cs) ORDER BY id)::text, '[]'), 'sha256'), 'hex') AS services_before FROM public.completed_services cs WHERE patient_id = :'patient_a' \gset
SELECT count(*)::text AS appointments_before FROM public.appointments WHERE patient_id = :'patient_a' \gset
SELECT count(*)::text AS payments_before FROM public.payments WHERE patient_id = :'patient_a' \gset
SELECT count(*)::text AS refunds_before FROM public.refunds WHERE patient_id = :'patient_a' \gset
SELECT count(*)::text AS adjustments_before FROM public.financial_adjustments WHERE patient_id = :'patient_a' \gset
SELECT count(*)::text AS documents_before FROM public.documents WHERE patient_id = :'patient_a' \gset

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'admin_a', true);

-- First bill succeeds and produces exactly one financial audit/activity pair.
SELECT (public.add_invoice_item(:'tenant_a', :'invoice_a1', 'Guard service one', 1, 1000, 0, 0, :'service_a1')).id::text AS item_a1 \gset
SELECT pg_temp.assert_true((SELECT total_amount FROM public.invoices WHERE id = :'invoice_a1') = 1000, 'first completed-service bill updates total');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.invoice_items WHERE completed_service_id = :'service_a1') = 1, 'first completed-service bill creates one item');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.audit_events WHERE action = 'invoice_item_added' AND metadata->>'completedServiceId' = :'service_a1') = 1, 'first bill creates one audit event');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.activity_events WHERE type = 'invoice_item_added' AND metadata->>'completedServiceId' = :'service_a1') = 1, 'first bill creates one activity event');

-- Duplicate via either invoice is safe and has no item, total, or success event side effect.
SELECT pg_temp.expect_error(format('select public.add_invoice_item(%L::uuid,%L::uuid,%L,1,1000,0,0,%L::uuid)', :'tenant_a', :'invoice_a1', 'same invoice retry', :'service_a1'), 'Эта выполненная услуга уже включена');
SELECT pg_temp.expect_error(format('select public.add_invoice_item(%L::uuid,%L::uuid,%L,1,1000,0,0,%L::uuid)', :'tenant_a', :'invoice_a2', 'other invoice retry', :'service_a1'), 'Эта выполненная услуга уже включена');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.invoice_items WHERE completed_service_id = :'service_a1') = 1, 'duplicate RPC creates no second item');
SELECT pg_temp.assert_true((SELECT total_amount FROM public.invoices WHERE id = :'invoice_a1') = 1000 AND (SELECT total_amount FROM public.invoices WHERE id = :'invoice_a2') = 0, 'duplicate RPC changes no totals');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.audit_events WHERE action = 'invoice_item_added' AND metadata->>'completedServiceId' = :'service_a1') = 1, 'duplicate RPC creates no second audit');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.activity_events WHERE type = 'invoice_item_added' AND metadata->>'completedServiceId' = :'service_a1') = 1, 'duplicate RPC creates no second activity');

-- The scoped eligibility read is stable and has all three modeled states.
SELECT pg_temp.assert_true((SELECT billing_state = 'billed' AND invoice_id = :'invoice_a1'::uuid AND invoice_item_id IS NOT NULL AND invoice_number = 'CSBG-A1' AND invoice_status = 'draft' AND billed_at IS NOT NULL FROM public.get_completed_service_billing_eligibility(:'tenant_a', :'patient_a') WHERE completed_service_id = :'service_a1'), 'billed eligibility exposes only scoped historic invoice metadata');
SELECT pg_temp.assert_true((SELECT billing_state = 'unbilled' FROM public.get_completed_service_billing_eligibility(:'tenant_a', :'patient_a') WHERE completed_service_id = :'service_a2'), 'completed unbilled service is selectable');
SELECT pg_temp.assert_true((SELECT billing_state = 'unavailable' FROM public.get_completed_service_billing_eligibility(:'tenant_a', :'patient_a') WHERE completed_service_id = :'service_corrected'), 'non-completed service is unavailable');
SELECT pg_temp.assert_true((SELECT billing_state = 'unavailable' FROM public.get_completed_service_billing_eligibility(:'tenant_a', :'patient_a') WHERE completed_service_id = :'service_archived'), 'archived service is unavailable');
SELECT jsonb_agg(to_jsonb(e) ORDER BY e.completed_service_id)::text AS eligibility_once FROM public.get_completed_service_billing_eligibility(:'tenant_a', :'patient_a') e \gset
SELECT pg_temp.assert_true(:'eligibility_once' = (SELECT jsonb_agg(to_jsonb(e) ORDER BY e.completed_service_id)::text FROM public.get_completed_service_billing_eligibility(:'tenant_a', :'patient_a') e), 'repeated eligibility reads are stable');

SELECT public.add_invoice_item(:'tenant_a', :'invoice_a2', 'Guard service two', 1, 2000, 0, 0, :'service_a2');
SELECT public.add_invoice_item(:'tenant_a', :'invoice_a2', 'Manual item', 1, 300, 0, 0, NULL);
SELECT pg_temp.assert_true((SELECT count(*) FROM public.invoice_items WHERE invoice_id = :'invoice_a2' AND completed_service_id = :'service_a2') = 1, 'two different completed services can be billed');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.invoice_items WHERE invoice_id = :'invoice_a2' AND completed_service_id IS NULL) = 1, 'manual NULL completed_service item remains allowed');
SELECT pg_temp.assert_true((SELECT total_amount FROM public.invoices WHERE id = :'invoice_a2') = 2300, 'successful totals are correct');
SELECT pg_temp.expect_error(format('select public.add_invoice_item(%L::uuid,%L::uuid,%L,1,10,0,0,%L::uuid)', :'tenant_a', :'invoice_a2', 'corrected', :'service_corrected'), 'not available');
SELECT pg_temp.expect_error(format('select public.add_invoice_item(%L::uuid,%L::uuid,%L,1,10,0,0,%L::uuid)', :'tenant_a', :'invoice_a2', 'archived', :'service_archived'), 'not available');
SELECT pg_temp.expect_error(format('select public.add_invoice_item(%L::uuid,%L::uuid,%L,1,10,0,0,%L::uuid)', :'tenant_a', :'invoice_a_patient2', 'cross patient', :'service_a1'), 'not available');
SELECT set_config('request.jwt.claim.sub', :'admin_b', true);
SELECT pg_temp.expect_error(format('select public.add_invoice_item(%L::uuid,%L::uuid,%L,1,10,0,0,%L::uuid)', :'tenant_b', :'invoice_b', 'cross tenant', :'service_a1'), 'not available');
SELECT pg_temp.expect_error(format('select public.get_completed_service_billing_eligibility(%L::uuid,%L::uuid)', :'tenant_a', :'patient_a'), 'Insufficient finance permissions');

-- Existing add_invoice_item writers remain the exact allowed matrix.
SELECT set_config('request.jwt.claim.sub', :'owner_a', true);
SELECT public.add_invoice_item(:'tenant_a', :'invoice_a2', 'Owner service', 1, 50, 0, 0, :'service_owner');
SELECT set_config('request.jwt.claim.sub', :'admin_a', true);
SELECT public.add_invoice_item(:'tenant_a', :'invoice_a2', 'Admin service', 1, 60, 0, 0, :'service_admin');
SELECT set_config('request.jwt.claim.sub', :'cashier_a', true);
SELECT public.add_invoice_item(:'tenant_a', :'invoice_a2', 'Cashier service', 1, 70, 0, 0, :'service_cashier');
SELECT set_config('request.jwt.claim.sub', :'doctor_a', true);
SELECT pg_temp.expect_error(format('select public.add_invoice_item(%L::uuid,%L::uuid,%L)', :'tenant_a', :'invoice_a2', 'doctor denied'), 'Insufficient finance permissions');
SELECT set_config('request.jwt.claim.sub', :'registrar_a', true);
SELECT pg_temp.expect_error(format('select public.add_invoice_item(%L::uuid,%L::uuid,%L)', :'tenant_a', :'invoice_a2', 'registrar denied'), 'Insufficient finance permissions');
SELECT set_config('request.jwt.claim.sub', :'notenant', true);
SELECT pg_temp.expect_error(format('select public.add_invoice_item(%L::uuid,%L::uuid,%L)', :'tenant_a', :'invoice_a2', 'no tenant denied'), 'Insufficient finance permissions');
SELECT set_config('request.jwt.claim.sub', :'admin_a', true);

RESET ROLE;
-- Privileged fixture attempts exercise the guard itself; authenticated writers
-- never receive direct INSERT permission.
SELECT pg_temp.expect_error(format('insert into public.invoice_items(tenant_id,invoice_id,patient_id,completed_service_id,service_name,quantity,unit_price,total_amount,status,metadata) values(%L::uuid,%L::uuid,%L::uuid,%L::uuid,%L,1,1000,1000,%L,%L::jsonb)', :'tenant_a', :'invoice_a2', :'patient_a', :'service_a1', 'direct duplicate', 'active', '{}'), 'uq_invoice_items_completed_service_billed_once');
SELECT pg_temp.expect_error(format('insert into public.invoice_items(tenant_id,invoice_id,patient_id,completed_service_id,service_name,quantity,unit_price,total_amount,status,metadata) values(%L::uuid,%L::uuid,%L::uuid,%L::uuid,%L,1,1,1,%L,%L::jsonb)', :'tenant_a', :'invoice_a_patient2', :'patient_a2', :'service_a1', 'cross patient direct', 'active', '{}'), 'does not belong');
SELECT pg_temp.expect_error(format('insert into public.invoice_items(tenant_id,invoice_id,patient_id,completed_service_id,service_name,quantity,unit_price,total_amount,status,metadata) values(%L::uuid,%L::uuid,%L::uuid,%L::uuid,%L,1,1,1,%L,%L::jsonb)', :'tenant_b', :'invoice_b', :'patient_b', :'service_a1', 'cross tenant direct', 'active', '{}'), 'does not belong');
SELECT pg_temp.expect_error(format('insert into public.invoice_items(tenant_id,invoice_id,patient_id,service_name,quantity,unit_price,total_amount,status,metadata) values(%L::uuid,%L::uuid,%L::uuid,%L,1,1,1,%L,%L::jsonb)', :'tenant_a', :'invoice_b', :'patient_a', 'invoice mismatch', 'active', '{}'), 'must match its invoice');
SELECT pg_temp.expect_error(format('insert into public.invoice_items(tenant_id,invoice_id,patient_id,completed_service_id,service_name,quantity,unit_price,total_amount,status,metadata) values(%L::uuid,%L::uuid,%L::uuid,%L::uuid,%L,1,1,1,%L,%L::jsonb)', :'tenant_a', :'invoice_a2', :'patient_a', 'a9250000-0000-4000-8000-000000000099', 'orphan', 'active', '{}'), 'Completed service not found');
SELECT pg_temp.expect_error(format('update public.invoice_items set completed_service_id = null where id = %L::uuid', :'item_a1'), 'immutable');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'admin_a', true);
SELECT pg_temp.expect_error(format('insert into public.invoice_items(tenant_id,invoice_id,patient_id,service_name,quantity,unit_price,total_amount,status,metadata) values(%L::uuid,%L::uuid,%L::uuid,%L,1,1,1,%L,%L::jsonb)', :'tenant_a', :'invoice_a2', :'patient_a', 'direct authenticated', 'active', '{}'), 'permission denied');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT pg_temp.expect_error(format('select public.add_invoice_item(%L::uuid,%L::uuid,%L)', :'tenant_a', :'invoice_a2', 'anon denied'), 'permission denied');
SELECT pg_temp.assert_true(NOT has_function_privilege('anon', 'public.add_invoice_item(uuid,uuid,text,numeric,numeric,numeric,numeric,uuid,text,text,text,text,jsonb)', 'EXECUTE'), 'anon has no add_invoice_item execute');
RESET ROLE;

-- Voiding then archiving does not release the historical unique lock.  Item
-- archiving likewise cannot make a previously billed service selectable.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'admin_a', true);
SELECT public.void_invoice(:'tenant_a', :'invoice_a1', 'historical lock fixture');
RESET ROLE;
UPDATE public.invoices SET status = 'archived', archived_at = now() WHERE id = :'invoice_a1';
UPDATE public.invoice_items SET status = 'archived', archived_at = now() WHERE id = :'item_a1';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'admin_a', true);
SELECT pg_temp.expect_error(format('select public.add_invoice_item(%L::uuid,%L::uuid,%L,1,1000,0,0,%L::uuid)', :'tenant_a', :'invoice_a2', 'after void and archive', :'service_a1'), 'Эта выполненная услуга уже включена');
RESET ROLE;

SELECT pg_temp.assert_true((SELECT balance FROM public.patients WHERE id = :'patient_a') = :'balance_before'::numeric, 'patients.balance is unchanged');
SELECT pg_temp.assert_true((SELECT encode(digest(coalesce(jsonb_agg(to_jsonb(cs) ORDER BY id)::text, '[]'), 'sha256'), 'hex') FROM public.completed_services cs WHERE patient_id = :'patient_a') = :'services_before', 'completed_services rows and fields are unchanged');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.appointments WHERE patient_id = :'patient_a') = :'appointments_before'::integer, 'appointments are unchanged');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.payments WHERE patient_id = :'patient_a') = :'payments_before'::integer, 'payments are unchanged');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.refunds WHERE patient_id = :'patient_a') = :'refunds_before'::integer, 'refunds are unchanged');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.financial_adjustments WHERE patient_id = :'patient_a') = :'adjustments_before'::integer, 'write-offs and adjustments are unchanged');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.documents WHERE patient_id = :'patient_a') = :'documents_before'::integer, 'documents are unchanged');

ROLLBACK;
\echo 'COMPLETED-SERVICE-BILLING-GUARD-001 SQL validation passed'
