\set ON_ERROR_STOP on
\echo 'PATIENT-CREDIT-DEPOSITS-FOUNDATION-001 local SQL validation'

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

\set tenant_a 'e2210000-0000-4000-8000-000000000001'
\set tenant_b 'e2210000-0000-4000-8000-000000000002'
\set patient_a 'e2220000-0000-4000-8000-000000000001'
\set patient_a2 'e2220000-0000-4000-8000-000000000002'
\set patient_b 'e2220000-0000-4000-8000-000000000003'
\set owner_a 'e2230000-0000-4000-8000-000000000001'
\set admin_a 'e2230000-0000-4000-8000-000000000002'
\set cashier_a 'e2230000-0000-4000-8000-000000000003'
\set doctor_a 'e2230000-0000-4000-8000-000000000004'
\set registrar_a 'e2230000-0000-4000-8000-000000000005'
\set notenant 'e2230000-0000-4000-8000-000000000006'
\set admin_b 'e2230000-0000-4000-8000-000000000007'
\set appointment_a 'e2270000-0000-4000-8000-000000000001'
\set appointment_a2 'e2270000-0000-4000-8000-000000000002'
\set plan_a 'e2280000-0000-4000-8000-000000000001'
\set invoice_main 'e2250000-0000-4000-8000-000000000001'
\set invoice_a2 'e2250000-0000-4000-8000-000000000002'
\set invoice_b 'e2250000-0000-4000-8000-000000000003'
\set invoice_voided 'e2250000-0000-4000-8000-000000000004'
\set item_main 'e2260000-0000-4000-8000-000000000001'
\set item_a2 'e2260000-0000-4000-8000-000000000002'
\set item_b 'e2260000-0000-4000-8000-000000000003'
\set payment_free 'e2240000-0000-4000-8000-000000000001'
\set payment_allocated 'e2240000-0000-4000-8000-000000000002'
\set payment_refunded 'e2240000-0000-4000-8000-000000000003'
\set payment_refund_reserved 'e2240000-0000-4000-8000-000000000004'
\set payment_release 'e2240000-0000-4000-8000-000000000005'
\set payment_use 'e2240000-0000-4000-8000-000000000006'
\set payment_voided 'e2240000-0000-4000-8000-000000000007'
\set payment_archived 'e2240000-0000-4000-8000-000000000008'
\set payment_a2 'e2240000-0000-4000-8000-000000000009'
\set payment_b 'e2240000-0000-4000-8000-000000000010'
\set payment_owner 'e2240000-0000-4000-8000-000000000011'
\set payment_admin 'e2240000-0000-4000-8000-000000000012'
\set payment_cashier 'e2240000-0000-4000-8000-000000000013'
\set payment_usd 'e2240000-0000-4000-8000-000000000014'
\set refund_completed 'e2290000-0000-4000-8000-000000000001'
\set refund_pending 'e2290000-0000-4000-8000-000000000002'

INSERT INTO public.tenants(id, name) VALUES
  (:'tenant_a', 'Deposit Test A'),
  (:'tenant_b', 'Deposit Test B');

INSERT INTO auth.users(id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  (:'owner_a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'deposit-owner@example.local', 'x', now(), '{"provider":"email"}', '{}', now(), now()),
  (:'admin_a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'deposit-admin@example.local', 'x', now(), '{"provider":"email"}', '{}', now(), now()),
  (:'cashier_a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'deposit-cashier@example.local', 'x', now(), '{"provider":"email"}', '{}', now(), now()),
  (:'doctor_a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'deposit-doctor@example.local', 'x', now(), '{"provider":"email"}', '{}', now(), now()),
  (:'registrar_a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'deposit-registrar@example.local', 'x', now(), '{"provider":"email"}', '{}', now(), now()),
  (:'notenant', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'deposit-notenant@example.local', 'x', now(), '{"provider":"email"}', '{}', now(), now()),
  (:'admin_b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'deposit-admin-b@example.local', 'x', now(), '{"provider":"email"}', '{}', now(), now());

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
  (:'patient_a', :'tenant_a', 'Deposit Patient A', '+77002220001', 'phone', 777),
  (:'patient_a2', :'tenant_a', 'Deposit Patient A2', '+77002220002', 'phone', 0),
  (:'patient_b', :'tenant_b', 'Deposit Patient B', '+77002220003', 'phone', 0);

INSERT INTO public.appointments(id, tenant_id, patient_id, service, status, start_time, end_time) VALUES
  (:'appointment_a', :'tenant_a', :'patient_a', 'Deposit appointment', 'confirmed', now() + interval '1 day', now() + interval '1 day 1 hour'),
  (:'appointment_a2', :'tenant_a', :'patient_a2', 'Other patient appointment', 'confirmed', now() + interval '2 days', now() + interval '2 days 1 hour');
INSERT INTO public.treatment_plans(id, tenant_id, patient_id, title, status, total_price) VALUES
  (:'plan_a', :'tenant_a', :'patient_a', 'Deposit treatment plan', 'approved', 5000);

INSERT INTO public.invoices(id, tenant_id, patient_id, invoice_number, status, currency, issued_at, voided_at, voided_by, void_reason, created_by, metadata) VALUES
  (:'invoice_main', :'tenant_a', :'patient_a', 'DEP-A-1', 'issued', 'KZT', now(), NULL, NULL, NULL, :'admin_a', '{}'),
  (:'invoice_a2', :'tenant_a', :'patient_a2', 'DEP-A2-1', 'issued', 'KZT', now(), NULL, NULL, NULL, :'admin_a', '{}'),
  (:'invoice_b', :'tenant_b', :'patient_b', 'DEP-B-1', 'issued', 'KZT', now(), NULL, NULL, NULL, :'admin_b', '{}'),
  (:'invoice_voided', :'tenant_a', :'patient_a', 'DEP-A-VOID', 'voided', 'KZT', now(), now(), :'admin_a', 'fixture', :'admin_a', '{}');
INSERT INTO public.invoice_items(id, tenant_id, invoice_id, patient_id, service_name, quantity, unit_price, total_amount, status, created_by, metadata) VALUES
  (:'item_main', :'tenant_a', :'invoice_main', :'patient_a', 'Main invoice service', 1, 10000, 10000, 'active', :'admin_a', '{}'),
  (:'item_a2', :'tenant_a', :'invoice_a2', :'patient_a2', 'Other patient service', 1, 1000, 1000, 'active', :'admin_a', '{}'),
  (:'item_b', :'tenant_b', :'invoice_b', :'patient_b', 'Other tenant service', 1, 1000, 1000, 'active', :'admin_b', '{}');
SELECT public.recalculate_invoice_financials_internal(:'invoice_main');
SELECT public.recalculate_invoice_financials_internal(:'invoice_a2');
SELECT public.recalculate_invoice_financials_internal(:'invoice_b');

INSERT INTO public.payments(id, tenant_id, patient_id, status, payment_method, amount, currency, received_by, voided_by, void_reason, voided_at, archived_at, metadata) VALUES
  (:'payment_free', :'tenant_a', :'patient_a', 'received', 'cash', 1000, 'KZT', :'admin_a', NULL, NULL, NULL, NULL, '{}'),
  (:'payment_allocated', :'tenant_a', :'patient_a', 'partially_allocated', 'cash', 1000, 'KZT', :'admin_a', NULL, NULL, NULL, NULL, '{}'),
  (:'payment_refunded', :'tenant_a', :'patient_a', 'partially_refunded', 'cash', 1000, 'KZT', :'admin_a', NULL, NULL, NULL, NULL, '{}'),
  (:'payment_refund_reserved', :'tenant_a', :'patient_a', 'received', 'cash', 1000, 'KZT', :'admin_a', NULL, NULL, NULL, NULL, '{}'),
  (:'payment_release', :'tenant_a', :'patient_a', 'received', 'cash', 500, 'KZT', :'admin_a', NULL, NULL, NULL, NULL, '{}'),
  (:'payment_use', :'tenant_a', :'patient_a', 'received', 'cash', 1000, 'KZT', :'admin_a', NULL, NULL, NULL, NULL, '{}'),
  (:'payment_voided', :'tenant_a', :'patient_a', 'voided', 'cash', 100, 'KZT', :'admin_a', :'admin_a', 'fixture', now(), NULL, '{}'),
  (:'payment_archived', :'tenant_a', :'patient_a', 'archived', 'cash', 100, 'KZT', :'admin_a', NULL, NULL, NULL, now(), '{}'),
  (:'payment_a2', :'tenant_a', :'patient_a2', 'received', 'cash', 100, 'KZT', :'admin_a', NULL, NULL, NULL, NULL, '{}'),
  (:'payment_b', :'tenant_b', :'patient_b', 'received', 'cash', 100, 'KZT', :'admin_b', NULL, NULL, NULL, NULL, '{}'),
  (:'payment_owner', :'tenant_a', :'patient_a', 'received', 'cash', 100, 'KZT', :'owner_a', NULL, NULL, NULL, NULL, '{}'),
  (:'payment_admin', :'tenant_a', :'patient_a', 'received', 'cash', 100, 'KZT', :'admin_a', NULL, NULL, NULL, NULL, '{}'),
  (:'payment_cashier', :'tenant_a', :'patient_a', 'received', 'cash', 100, 'KZT', :'cashier_a', NULL, NULL, NULL, NULL, '{}'),
  (:'payment_usd', :'tenant_a', :'patient_a', 'received', 'cash', 200, 'USD', :'admin_a', NULL, NULL, NULL, NULL, '{}');

INSERT INTO public.payment_allocations(tenant_id, patient_id, payment_id, invoice_id, amount, currency, status, metadata, created_by)
VALUES (:'tenant_a', :'patient_a', :'payment_allocated', :'invoice_main', 600, 'KZT', 'active', '{}', :'admin_a');
SELECT public.issue_finance_mutation_authorization_internal('refund_insert', :'refund_completed');
INSERT INTO public.refunds(id, tenant_id, patient_id, payment_id, status, refund_method, amount, currency, reason, requested_by, approved_by, completed_by, requested_at, approved_at, completed_at, metadata, idempotency_key)
VALUES (:'refund_completed', :'tenant_a', :'patient_a', :'payment_refunded', 'completed', 'cash', 400, 'KZT', 'completed fixture', :'admin_a', :'admin_a', :'admin_a', now(), now(), now(), '{}', 'completed-fixture');
SELECT public.issue_finance_mutation_authorization_internal('refund_insert', :'refund_pending');
INSERT INTO public.refunds(id, tenant_id, patient_id, payment_id, status, refund_method, amount, currency, reason, requested_by, approved_by, completed_by, requested_at, approved_at, completed_at, metadata, idempotency_key)
VALUES (:'refund_pending', :'tenant_a', :'patient_a', :'payment_refund_reserved', 'pending', 'cash', 300, 'KZT', 'pending fixture', :'admin_a', NULL, NULL, now(), NULL, NULL, '{}', 'pending-fixture');

SELECT balance::text AS patient_balance_before FROM public.patients WHERE id = :'patient_a' \gset
SELECT encode(digest(coalesce(jsonb_agg(to_jsonb(a) ORDER BY id)::text, '[]'), 'sha256'), 'hex') AS appointments_before FROM public.appointments a WHERE patient_id = :'patient_a' \gset
SELECT encode(digest(coalesce(jsonb_agg(to_jsonb(tp) ORDER BY id)::text, '[]'), 'sha256'), 'hex') AS plans_before FROM public.treatment_plans tp WHERE patient_id = :'patient_a' \gset
SELECT count(*)::text AS completed_services_before FROM public.completed_services WHERE patient_id = :'patient_a' \gset
SELECT count(*)::text AS documents_before FROM public.documents WHERE patient_id = :'patient_a' \gset

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'admin_a', true);

-- 1-5: initial capacity and summary visibility.
SELECT pg_temp.assert_true((SELECT payment_amount = 1000 AND gross_unallocated_amount = 1000 AND available_credit_amount = 1000 FROM public.get_payment_fund_capacity(:'tenant_a', :'patient_a', :'payment_free')), 'fully unallocated payment exposes full credit');
SELECT (public.create_patient_fund_reservation(:'tenant_a', :'patient_a', :'payment_free', 300, 'general', NULL, NULL, NULL, NULL, 'first reserve', '{}', 'free-create-1')->'reservation'->>'id')::uuid AS free_reservation_1 \gset
SELECT pg_temp.assert_true((SELECT reserved_deposit_amount = 300 AND gross_unallocated_amount = 1000 AND available_credit_amount = 700 FROM public.get_payment_fund_capacity(:'tenant_a', :'patient_a', :'payment_free')), 'reservation reduces only available credit');
SELECT pg_temp.assert_true(((public.get_patient_finance_summary(:'tenant_a', :'patient_a')->'currencies'->0->>'reservedDepositAmount')::numeric) >= 300, 'summary includes reserved deposits');
SELECT pg_temp.assert_true((public.get_patient_finance_summary(:'tenant_a', :'patient_a')->>'modelVersion') = 'finance-summary-v2', 'summary model version updated');

-- 6-11: capacity exclusions and idempotency.
SELECT pg_temp.assert_true((public.create_patient_fund_reservation(:'tenant_a', :'patient_a', :'payment_free', 300, 'general', NULL, NULL, NULL, NULL, 'first reserve', '{}', 'free-create-1')->>'status') = 'already_completed', 'same create key and payload returns existing result');
SELECT pg_temp.assert_true((SELECT count(*) = 1 FROM public.patient_fund_reservations WHERE tenant_id = :'tenant_a' AND idempotency_key = 'free-create-1'), 'idempotent create has one row');
SELECT pg_temp.expect_error(format('select public.create_patient_fund_reservation(%L::uuid,%L::uuid,%L::uuid,301,''general'',NULL,NULL,NULL,NULL,NULL,%L::jsonb,%L)', :'tenant_a', :'patient_a', :'payment_free', '{}', 'free-create-1'), 'другими параметрами');
SELECT (public.create_patient_fund_reservation(:'tenant_a', :'patient_a', :'payment_free', 500, 'appointment', 'Visit deposit', :'appointment_a', NULL, NULL, NULL, '{}', 'free-create-2')->'reservation'->>'id')::uuid AS free_reservation_2 \gset
SELECT pg_temp.assert_true((SELECT reserved_deposit_amount = 800 AND available_credit_amount = 200 FROM public.get_payment_fund_capacity(:'tenant_a', :'patient_a', :'payment_free')), 'second reservation respects first reservation');
SELECT pg_temp.expect_error(format('select public.create_patient_fund_reservation(%L::uuid,%L::uuid,%L::uuid,201,''general'',NULL,NULL,NULL,NULL,NULL,%L::jsonb,%L)', :'tenant_a', :'patient_a', :'payment_free', '{}', 'free-over'), 'Недостаточно доступного кредита');

-- 12-16: allocated, completed-refunded and refund-reserved money is unavailable.
SELECT pg_temp.expect_error(format('select public.create_patient_fund_reservation(%L::uuid,%L::uuid,%L::uuid,401,''general'',NULL,NULL,NULL,NULL,NULL,%L::jsonb,%L)', :'tenant_a', :'patient_a', :'payment_allocated', '{}', 'allocated-over'), 'Недостаточно доступного кредита');
SELECT public.create_patient_fund_reservation(:'tenant_a', :'patient_a', :'payment_allocated', 400, 'general', NULL, NULL, NULL, NULL, NULL, '{}', 'allocated-exact');
SELECT pg_temp.expect_error(format('select public.create_patient_fund_reservation(%L::uuid,%L::uuid,%L::uuid,601,''general'',NULL,NULL,NULL,NULL,NULL,%L::jsonb,%L)', :'tenant_a', :'patient_a', :'payment_refunded', '{}', 'refunded-over'), 'Недостаточно доступного кредита');
SELECT public.create_patient_fund_reservation(:'tenant_a', :'patient_a', :'payment_refunded', 600, 'general', NULL, NULL, NULL, NULL, NULL, '{}', 'refunded-exact');
SELECT pg_temp.expect_error(format('select public.create_patient_fund_reservation(%L::uuid,%L::uuid,%L::uuid,701,''general'',NULL,NULL,NULL,NULL,NULL,%L::jsonb,%L)', :'tenant_a', :'patient_a', :'payment_refund_reserved', '{}', 'refund-reserved-over'), 'Недостаточно доступного кредита');
SELECT public.create_patient_fund_reservation(:'tenant_a', :'patient_a', :'payment_refund_reserved', 700, 'general', NULL, NULL, NULL, NULL, NULL, '{}', 'refund-reserved-exact');

-- 17-22: generic allocation/refund/void cannot consume reserved capacity.
SELECT pg_temp.expect_error(format('select public.allocate_payment(%L::uuid,%L::uuid,201,%L::uuid,NULL,%L::jsonb)', :'tenant_a', :'payment_free', :'invoice_main', '{}'), 'депозит');
SELECT public.allocate_payment(:'tenant_a', :'payment_free', 200, :'invoice_main', NULL, '{}');
SELECT pg_temp.assert_true((SELECT available_credit_amount = 0 AND reserved_deposit_amount = 800 FROM public.get_payment_fund_capacity(:'tenant_a', :'patient_a', :'payment_free')), 'generic allocation consumes only unreserved capacity');
SELECT pg_temp.expect_error(format('select public.request_refund(%L::uuid,%L::uuid,1,''cash'',''reserved funds'',%L,%L::jsonb)', :'tenant_a', :'payment_free', 'free-refund-blocked', '{}'), 'депозит');
SELECT pg_temp.expect_error(format('select public.void_payment(%L::uuid,%L::uuid,''reserved funds'')', :'tenant_a', :'payment_free'), 'активным депозитом');
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM public.refunds WHERE idempotency_key = 'free-refund-blocked'), 'rejected refund creates no row');

-- 23-29: scope, payment status and purpose guards.
SELECT pg_temp.expect_error(format('select public.create_patient_fund_reservation(%L::uuid,%L::uuid,%L::uuid,10,''general'',NULL,NULL,NULL,NULL,NULL,%L::jsonb,%L)', :'tenant_a', :'patient_a', :'payment_a2', '{}', 'wrong-patient'), 'Платёж недоступен');
SELECT pg_temp.expect_error(format('select public.create_patient_fund_reservation(%L::uuid,%L::uuid,%L::uuid,10,''general'',NULL,NULL,NULL,NULL,NULL,%L::jsonb,%L)', :'tenant_a', :'patient_a', :'payment_b', '{}', 'wrong-tenant'), 'Платёж недоступен');
SELECT pg_temp.expect_error(format('select public.create_patient_fund_reservation(%L::uuid,%L::uuid,%L::uuid,10,''general'',NULL,NULL,NULL,NULL,NULL,%L::jsonb,%L)', :'tenant_a', :'patient_a', :'payment_voided', '{}', 'voided-payment'), 'Платёж недоступен');
SELECT pg_temp.expect_error(format('select public.create_patient_fund_reservation(%L::uuid,%L::uuid,%L::uuid,10,''general'',NULL,NULL,NULL,NULL,NULL,%L::jsonb,%L)', :'tenant_a', :'patient_a', :'payment_archived', '{}', 'archived-payment'), 'Платёж недоступен');
SELECT pg_temp.expect_error(format('select public.create_patient_fund_reservation(%L::uuid,%L::uuid,%L::uuid,10,''other'',NULL,NULL,NULL,NULL,NULL,%L::jsonb,%L)', :'tenant_a', :'patient_a', :'payment_admin', '{}', 'other-no-label'), 'Purpose label');
SELECT pg_temp.expect_error(format('select public.create_patient_fund_reservation(%L::uuid,%L::uuid,%L::uuid,10,''appointment'',''wrong appointment'',%L::uuid,NULL,NULL,NULL,%L::jsonb,%L)', :'tenant_a', :'patient_a', :'payment_admin', :'appointment_a2', '{}', 'wrong-appointment'), 'does not belong');
SELECT public.create_patient_fund_reservation(:'tenant_a', :'patient_a', :'payment_admin', 10, 'treatment_plan', 'Plan reserve', NULL, :'plan_a', NULL, NULL, '{}', 'plan-purpose');

-- 30-36: role matrix.
SELECT set_config('request.jwt.claim.sub', :'owner_a', true);
SELECT public.create_patient_fund_reservation(:'tenant_a', :'patient_a', :'payment_owner', 10, 'general', NULL, NULL, NULL, NULL, NULL, '{}', 'owner-create');
SELECT set_config('request.jwt.claim.sub', :'cashier_a', true);
SELECT (public.create_patient_fund_reservation(:'tenant_a', :'patient_a', :'payment_cashier', 10, 'general', NULL, NULL, NULL, NULL, NULL, '{}', 'cashier-create')->'reservation'->>'id')::uuid AS cashier_reservation \gset
SELECT pg_temp.expect_error(format('select public.release_patient_fund_reservation(%L::uuid,%L::uuid,NULL,''cashier release'',%L)', :'tenant_a', :'cashier_reservation', 'cashier-release'), 'insufficient finance permissions');
SELECT set_config('request.jwt.claim.sub', :'doctor_a', true);
SELECT pg_temp.expect_error(format('select public.create_patient_fund_reservation(%L::uuid,%L::uuid,%L::uuid,10,''general'',NULL,NULL,NULL,NULL,NULL,%L::jsonb,%L)', :'tenant_a', :'patient_a', :'payment_admin', '{}', 'doctor-create'), 'insufficient finance permissions');
SELECT set_config('request.jwt.claim.sub', :'registrar_a', true);
SELECT pg_temp.expect_error(format('select public.get_patient_fund_reservations(%L::uuid,%L::uuid,NULL)', :'tenant_a', :'patient_a'), 'insufficient finance permissions');
SELECT set_config('request.jwt.claim.sub', :'notenant', true);
SELECT pg_temp.expect_error(format('select public.get_payment_fund_capacity(%L::uuid,%L::uuid,%L::uuid)', :'tenant_a', :'patient_a', :'payment_free'), 'insufficient finance permissions');
SELECT set_config('request.jwt.claim.sub', :'admin_b', true);
SELECT pg_temp.expect_error(format('select public.get_patient_fund_reservations(%L::uuid,%L::uuid,NULL)', :'tenant_a', :'patient_a'), 'insufficient finance permissions');
SELECT set_config('request.jwt.claim.sub', :'admin_a', true);

-- 37-43: release lifecycle and idempotency.
SELECT (public.create_patient_fund_reservation(:'tenant_a', :'patient_a', :'payment_release', 300, 'general', NULL, NULL, NULL, NULL, NULL, '{}', 'release-create')->'reservation'->>'id')::uuid AS release_reservation \gset
SELECT pg_temp.expect_error(format('select public.release_patient_fund_reservation(%L::uuid,%L::uuid,100,''partial'',%L)', :'tenant_a', :'release_reservation', 'release-partial'), 'Only full');
SELECT public.release_patient_fund_reservation(:'tenant_a', :'release_reservation', NULL, 'patient changed mind', 'release-key');
SELECT pg_temp.assert_true((SELECT status = 'released' AND released_amount = 300 AND remaining_amount = 0 FROM public.patient_fund_reservations WHERE id = :'release_reservation'), 'full release updates lifecycle');
SELECT pg_temp.assert_true((SELECT available_credit_amount = 500 FROM public.get_payment_fund_capacity(:'tenant_a', :'patient_a', :'payment_release')), 'full release restores available credit');
SELECT pg_temp.assert_true((public.release_patient_fund_reservation(:'tenant_a', :'release_reservation', NULL, 'patient changed mind', 'release-key')->>'status') = 'already_completed', 'release retry returns same result');
SELECT pg_temp.expect_error(format('select public.release_patient_fund_reservation(%L::uuid,%L::uuid,NULL,''different reason'',%L)', :'tenant_a', :'release_reservation', 'release-key'), 'different details');
SELECT pg_temp.expect_error(format('select public.allocate_reserved_credit(%L::uuid,%L::uuid,%L::uuid,%L::uuid,1,%L)', :'tenant_a', :'patient_a', :'release_reservation', :'invoice_main', 'released-consume'), 'exceeds reservation remainder');

-- 44-55: controlled partial/full consumption and idempotency.
SELECT (public.create_patient_fund_reservation(:'tenant_a', :'patient_a', :'payment_use', 400, 'service', 'Implant', NULL, NULL, NULL, NULL, '{}', 'use-create')->'reservation'->>'id')::uuid AS use_reservation \gset
SELECT pg_temp.expect_error(format('select public.allocate_reserved_credit(%L::uuid,%L::uuid,%L::uuid,%L::uuid,401,%L)', :'tenant_a', :'patient_a', :'use_reservation', :'invoice_main', 'consume-over'), 'exceeds reservation remainder');
SELECT pg_temp.expect_error(format('select public.allocate_reserved_credit(%L::uuid,%L::uuid,%L::uuid,%L::uuid,10,%L)', :'tenant_a', :'patient_a', :'use_reservation', :'invoice_a2', 'consume-wrong-patient'), 'Invoice not found');
SELECT pg_temp.expect_error(format('select public.allocate_reserved_credit(%L::uuid,%L::uuid,%L::uuid,%L::uuid,10,%L)', :'tenant_a', :'patient_a', :'use_reservation', :'invoice_b', 'consume-wrong-tenant'), 'Invoice not found');
SELECT pg_temp.expect_error(format('select public.allocate_reserved_credit(%L::uuid,%L::uuid,%L::uuid,%L::uuid,10,%L)', :'tenant_a', :'patient_a', :'use_reservation', :'invoice_voided', 'consume-voided'), 'not available');
SELECT (public.allocate_reserved_credit(:'tenant_a', :'patient_a', :'use_reservation', :'invoice_main', 250, 'consume-1')->'allocation'->>'id')::uuid AS consume_allocation_1 \gset
SELECT pg_temp.assert_true((SELECT status = 'partially_used' AND consumed_amount = 250 AND remaining_amount = 150 FROM public.patient_fund_reservations WHERE id = :'use_reservation'), 'partial consume updates reservation');
SELECT pg_temp.assert_true((public.allocate_reserved_credit(:'tenant_a', :'patient_a', :'use_reservation', :'invoice_main', 250, 'consume-1')->>'status') = 'already_completed', 'consume retry returns same result');
SELECT pg_temp.assert_true((SELECT count(*) = 1 FROM public.payment_allocations WHERE reservation_operation_key = 'consume-1'), 'consume retry creates one allocation');
SELECT pg_temp.expect_error(format('select public.allocate_reserved_credit(%L::uuid,%L::uuid,%L::uuid,%L::uuid,249,%L)', :'tenant_a', :'patient_a', :'use_reservation', :'invoice_main', 'consume-1'), 'different details');
SELECT (public.allocate_reserved_credit(:'tenant_a', :'patient_a', :'use_reservation', :'invoice_main', 150, 'consume-2')->'allocation'->>'id')::uuid AS consume_allocation_2 \gset
SELECT pg_temp.assert_true((SELECT status = 'fully_used' AND consumed_amount = 400 AND remaining_amount = 0 FROM public.patient_fund_reservations WHERE id = :'use_reservation'), 'full consume sets fully_used');
SELECT pg_temp.assert_true((SELECT COALESCE(sum(amount),0) = 400 FROM public.payment_allocations WHERE patient_fund_reservation_id = :'use_reservation' AND status = 'active'), 'controlled consume creates matching allocations');
SELECT pg_temp.expect_error(format('select public.void_payment_allocation(%L::uuid,%L::uuid,''generic void'')', :'tenant_a', :'consume_allocation_1'), 'cannot be voided');
SELECT pg_temp.expect_error(format('select public.release_patient_fund_reservation(%L::uuid,%L::uuid,NULL,''fully used'',%L)', :'tenant_a', :'use_reservation', 'release-used'), 'cannot be released');

-- 56-62: database backstops and grants.
SELECT (public.request_refund(:'tenant_a', :'payment_release', 10, 'cash', 'forged complete fixture', 'forged-complete-refund', '{}')).id::text AS forged_approved_refund \gset
SELECT public.approve_refund(:'tenant_a', :'forged_approved_refund');
RESET ROLE;
SELECT pg_temp.expect_error(format('insert into public.payment_allocations(tenant_id,patient_id,payment_id,invoice_id,amount,currency,status,metadata,created_by,patient_fund_reservation_id,reservation_operation_key,reservation_operation_fingerprint) values(%L::uuid,%L::uuid,%L::uuid,%L::uuid,1,''KZT'',''active'',%L::jsonb,%L::uuid,%L::uuid,%L,%L)', :'tenant_a', :'patient_a', :'payment_free', :'invoice_main', '{}', :'admin_a', :'free_reservation_1', 'direct-reserved', 'fingerprint'), 'requires allocate_reserved_credit');
SELECT pg_temp.expect_error(format('update public.patient_fund_reservations set consumed_amount=1,status=''partially_used'' where id=%L::uuid', :'free_reservation_1'), 'requires allocate_reserved_credit');
SELECT pg_temp.expect_error(format('update public.patient_fund_reservations set released_amount=1,status=''released'',released_at=now(),released_by=%L::uuid,release_reason=''direct'' where id=%L::uuid', :'admin_a', :'free_reservation_1'), 'requires release_patient_fund_reservation');
SET LOCAL ROLE service_role;
SELECT set_config('app.finance_mutation_token', gen_random_uuid()::text, true);
SELECT pg_temp.expect_error(format('insert into public.payment_allocations(tenant_id,patient_id,payment_id,invoice_id,amount,currency,status,metadata,created_by,patient_fund_reservation_id,reservation_operation_key,reservation_operation_fingerprint) values(%L::uuid,%L::uuid,%L::uuid,%L::uuid,1,''KZT'',''active'',%L::jsonb,%L::uuid,%L::uuid,%L,%L)', :'tenant_a', :'patient_a', :'payment_free', :'invoice_main', '{}', :'admin_a', :'free_reservation_1', 'forged-reserved', 'fingerprint'), 'requires allocate_reserved_credit');
SELECT pg_temp.expect_error(format('select public.issue_finance_mutation_authorization_internal(%L,%L::uuid)', 'reservation_consume', :'free_reservation_1'), 'permission denied');
SELECT pg_temp.expect_error(format('insert into public.patient_fund_reservations(tenant_id,patient_id,payment_id,currency,purpose_type,original_amount,idempotency_key,operation_fingerprint,created_by) values(%L::uuid,%L::uuid,%L::uuid,''KZT'',''general'',1,%L,%L,%L::uuid)', :'tenant_a', :'patient_a', :'payment_release', 'service-role-create', 'fp', :'admin_a'), 'permission denied');
SELECT pg_temp.expect_error(format('update public.patient_fund_reservations set consumed_amount=1,status=''partially_used'' where id=%L::uuid', :'free_reservation_1'), 'permission denied');
SELECT pg_temp.expect_error(format('update public.patient_fund_reservations set released_amount=remaining_amount,status=''released'',released_at=now(),released_by=%L::uuid,release_reason=''forged'' where id=%L::uuid', :'admin_a', :'free_reservation_1'), 'permission denied');
SELECT pg_temp.expect_error(format('update public.patient_fund_reservations set status=''archived'',archived_at=now(),archived_by=%L::uuid,archived_from_status=''fully_used'' where id=%L::uuid', :'admin_a', :'use_reservation'), 'permission denied');
SELECT pg_temp.expect_error(format('update public.payment_allocations set tenant_id=%L::uuid where payment_id=%L::uuid and patient_fund_reservation_id is null', :'tenant_b', :'payment_free'), 'financial identity is immutable');
SELECT pg_temp.expect_error(format('update public.refunds set patient_id=%L::uuid where id=%L::uuid', :'patient_a2', :'refund_pending'), 'financial identity is immutable');
SELECT set_config('app.finance_mutation_token', gen_random_uuid()::text, true);
SELECT pg_temp.expect_error(format('insert into public.refunds(id,tenant_id,patient_id,payment_id,status,refund_method,amount,currency,reason,requested_by,requested_at,metadata,idempotency_key) values(gen_random_uuid(),%L::uuid,%L::uuid,%L::uuid,''pending'',''cash'',1,''KZT'',''forged'',%L::uuid,now(),%L::jsonb,%L)', :'tenant_a', :'patient_a', :'payment_release', :'admin_a', '{}', 'forged-refund'), 'requires request_refund');
SELECT set_config('app.finance_mutation_token', gen_random_uuid()::text, true);
SELECT pg_temp.expect_error(format('update public.refunds set status=''approved'',approved_by=%L::uuid,approved_at=now() where id=%L::uuid', :'admin_a', :'refund_pending'), 'authoritative refund RPC');
SELECT set_config('app.finance_mutation_token', gen_random_uuid()::text, true);
SELECT pg_temp.expect_error(format('update public.refunds set status=''rejected'',rejected_at=now() where id=%L::uuid', :'refund_pending'), 'authoritative refund RPC');
SELECT set_config('app.finance_mutation_token', gen_random_uuid()::text, true);
SELECT pg_temp.expect_error(format('update public.refunds set status=''voided'',voided_by=%L::uuid,voided_at=now(),void_reason=''forged'' where id=%L::uuid', :'admin_a', :'refund_pending'), 'authoritative refund RPC');
SELECT set_config('app.finance_mutation_token', gen_random_uuid()::text, true);
SELECT pg_temp.expect_error(format('update public.refunds set status=''completed'',completed_by=%L::uuid,completed_at=now() where id=%L::uuid', :'admin_a', :'forged_approved_refund'), 'authoritative refund RPC');
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'admin_a', true);
SELECT pg_temp.expect_error(format('insert into public.patient_fund_reservations(tenant_id,patient_id,payment_id,currency,purpose_type,original_amount,idempotency_key,operation_fingerprint,created_by) values(%L::uuid,%L::uuid,%L::uuid,''KZT'',''general'',1,%L,%L,%L::uuid)', :'tenant_a', :'patient_a', :'payment_release', 'direct-row', 'fp', :'admin_a'), 'permission denied');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT pg_temp.assert_true(NOT has_function_privilege('anon', 'public.create_patient_fund_reservation(uuid,uuid,uuid,numeric,text,text,uuid,uuid,timestamptz,text,jsonb,text)', 'EXECUTE'), 'anon cannot create reservations');
SELECT pg_temp.assert_true(NOT has_function_privilege('anon', 'public.allocate_reserved_credit(uuid,uuid,uuid,uuid,numeric,text)', 'EXECUTE'), 'anon cannot consume reservations');
RESET ROLE;

-- 63-69: archive semantics, stable reads, summary/multi-currency and event integrity.
SELECT public.issue_finance_mutation_authorization_internal('reservation_archive', :'use_reservation');
UPDATE public.patient_fund_reservations
SET status = 'archived', archived_at = now(), archived_by = :'admin_a', archived_from_status = 'fully_used'
WHERE id = :'use_reservation';
SELECT pg_temp.assert_true((SELECT status = 'archived' AND remaining_amount = 0 FROM public.patient_fund_reservations WHERE id = :'use_reservation'), 'archive preserves terminal row and zero capacity');
SELECT pg_temp.expect_error(format('update public.patient_fund_reservations set notes=''mutated'' where id=%L::uuid', :'use_reservation'), 'Archived reservation cannot be mutated');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'admin_a', true);
SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id)::text AS reservations_once FROM public.get_patient_fund_reservations(:'tenant_a', :'patient_a', NULL) r \gset
SELECT pg_temp.assert_true(:'reservations_once' = (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id)::text FROM public.get_patient_fund_reservations(:'tenant_a', :'patient_a', NULL) r), 'repeated reservation reads are stable');
SELECT public.create_patient_fund_reservation(:'tenant_a', :'patient_a', :'payment_usd', 50, 'general', NULL, NULL, NULL, NULL, NULL, '{}', 'usd-create');
SELECT pg_temp.assert_true((SELECT count(*) = 2 FROM jsonb_array_elements(public.get_patient_finance_summary(:'tenant_a', :'patient_a')->'currencies')), 'summary preserves multiple currency buckets');
SELECT pg_temp.assert_true(NOT EXISTS (SELECT 1 FROM public.audit_events WHERE action IN ('patient_fund_reservation_created','patient_fund_reservation_released','patient_fund_reservation_partially_used','patient_fund_reservation_fully_used','reserved_credit_allocated') AND actor_user_id IS NULL), 'all deposit success audit events have actors');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.audit_events WHERE action='reserved_credit_allocated' AND metadata->>'reservationId'=:'use_reservation') = 2, 'two successful consumes create exactly two allocation audit events');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.activity_events WHERE type='reserved_credit_allocated' AND metadata->>'reservationId'=:'use_reservation') = 2, 'two successful consumes create exactly two activity events');

-- 70-75: side-effect validation.
RESET ROLE;
SELECT pg_temp.assert_true((SELECT balance FROM public.patients WHERE id = :'patient_a') = :'patient_balance_before'::numeric, 'patients.balance remains unchanged');
SELECT pg_temp.assert_true((SELECT encode(digest(coalesce(jsonb_agg(to_jsonb(a) ORDER BY id)::text, '[]'), 'sha256'), 'hex') FROM public.appointments a WHERE patient_id = :'patient_a') = :'appointments_before', 'appointments remain unchanged');
SELECT pg_temp.assert_true((SELECT encode(digest(coalesce(jsonb_agg(to_jsonb(tp) ORDER BY id)::text, '[]'), 'sha256'), 'hex') FROM public.treatment_plans tp WHERE patient_id = :'patient_a') = :'plans_before', 'treatment plans remain unchanged');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.completed_services WHERE patient_id = :'patient_a') = :'completed_services_before'::integer, 'completed services remain unchanged');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.documents WHERE patient_id = :'patient_a') = :'documents_before'::integer, 'documents remain unchanged');
SELECT pg_temp.assert_true(to_regclass('public.stock') IS NULL AND to_regclass('public.inventory') IS NULL, 'no stock ledger exists or changes');

ROLLBACK;
\echo 'PATIENT-CREDIT-DEPOSITS-FOUNDATION-001 SQL validation passed'
