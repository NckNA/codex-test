\set ON_ERROR_STOP on
\echo 'CASHIER-PAYMENT-FLOW-HARDENING-001 local SQL validation'

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
      RAISE EXCEPTION 'ASSERTION FAILED: expected error containing "%", got "%"', p_expected, v_message;
    END IF;
  END;
END;
$$;

SELECT id::text AS admin_a FROM auth.users WHERE email = 'qa.admin.a@example.local' \gset
SELECT id::text AS cashier_a FROM auth.users WHERE email = 'qa.cashier.a@example.local' \gset
SELECT id::text AS doctor_a FROM auth.users WHERE email = 'qa.doctor.a@example.local' \gset
SELECT id::text AS registrar_a FROM auth.users WHERE email = 'qa.receptionist.a@example.local' \gset
SELECT id::text AS notenant FROM auth.users WHERE email = 'qa.notenant@example.local' \gset
SELECT id::text AS admin_b FROM auth.users WHERE email = 'qa.admin.b@example.local' \gset

\set tenant_a '11111111-1111-1111-1111-111111111111'
\set tenant_b '22222222-2222-2222-2222-222222222222'
\set patient_a 'a9000000-0000-4000-8000-000000000001'
\set patient_a2 'a9000000-0000-4000-8000-000000000002'
\set patient_b 'b9000000-0000-4000-8000-000000000001'
\set invoice_success 'a9100000-0000-4000-8000-000000000001'
\set invoice_admin 'a9100000-0000-4000-8000-000000000002'
\set invoice_draft 'a9100000-0000-4000-8000-000000000003'
\set invoice_draft_empty 'a9100000-0000-4000-8000-000000000004'
\set invoice_other_patient 'a9100000-0000-4000-8000-000000000005'
\set invoice_writeoff 'a9100000-0000-4000-8000-000000000006'
\set invoice_paid 'a9100000-0000-4000-8000-000000000007'
\set invoice_voided 'a9100000-0000-4000-8000-000000000008'
\set invoice_archived 'a9100000-0000-4000-8000-000000000009'
\set invoice_writtenoff 'a9100000-0000-4000-8000-000000000010'
\set invoice_rollback_1 'a9100000-0000-4000-8000-000000000011'
\set invoice_rollback_2 'a9100000-0000-4000-8000-000000000012'
\set invoice_race 'a9100000-0000-4000-8000-000000000013'
\set invoice_b 'b9100000-0000-4000-8000-000000000001'

INSERT INTO public.patients (id, tenant_id, full_name, phone, source, balance)
VALUES
  (:'patient_a'::uuid, :'tenant_a'::uuid, 'Cashier Hardening Patient A', '+77009000001', 'phone', 77),
  (:'patient_a2'::uuid, :'tenant_a'::uuid, 'Cashier Hardening Patient A2', '+77009000002', 'phone', 88),
  (:'patient_b'::uuid, :'tenant_b'::uuid, 'Cashier Hardening Patient B', '+77009000003', 'phone', 99);

INSERT INTO public.invoices (
  id, tenant_id, patient_id, invoice_number, status, currency,
  subtotal_amount, total_amount, paid_amount, written_off_amount, balance_amount, metadata
)
VALUES
  (:'invoice_success', :'tenant_a', :'patient_a', 'CH-001', 'draft', 'KZT', 1000, 1000, 0, 0, 1000, '{"marker":"cashier-hardening"}'),
  (:'invoice_admin', :'tenant_a', :'patient_a', 'CH-002', 'draft', 'KZT', 500, 500, 0, 0, 500, '{"marker":"cashier-hardening"}'),
  (:'invoice_draft', :'tenant_a', :'patient_a', 'CH-003', 'draft', 'KZT', 0, 0, 0, 0, 0, '{"marker":"cashier-hardening"}'),
  (:'invoice_draft_empty', :'tenant_a', :'patient_a', 'CH-004', 'draft', 'KZT', 0, 0, 0, 0, 0, '{"marker":"cashier-hardening"}'),
  (:'invoice_other_patient', :'tenant_a', :'patient_a2', 'CH-005', 'draft', 'KZT', 400, 400, 0, 0, 400, '{"marker":"cashier-hardening"}'),
  (:'invoice_writeoff', :'tenant_a', :'patient_a', 'CH-006', 'draft', 'KZT', 600, 600, 0, 0, 600, '{"marker":"cashier-hardening"}'),
  (:'invoice_paid', :'tenant_a', :'patient_a', 'CH-007', 'draft', 'KZT', 200, 200, 200, 0, 0, '{"marker":"cashier-hardening"}'),
  (:'invoice_voided', :'tenant_a', :'patient_a', 'CH-008', 'draft', 'KZT', 200, 200, 0, 0, 200, '{"marker":"cashier-hardening"}'),
  (:'invoice_archived', :'tenant_a', :'patient_a', 'CH-009', 'draft', 'KZT', 200, 200, 0, 0, 200, '{"marker":"cashier-hardening"}'),
  (:'invoice_writtenoff', :'tenant_a', :'patient_a', 'CH-010', 'draft', 'KZT', 200, 200, 0, 200, 0, '{"marker":"cashier-hardening"}'),
  (:'invoice_rollback_1', :'tenant_a', :'patient_a', 'CH-011', 'draft', 'KZT', 400, 400, 0, 0, 400, '{"marker":"cashier-hardening"}'),
  (:'invoice_rollback_2', :'tenant_a', :'patient_a', 'CH-012', 'draft', 'KZT', 600, 600, 0, 0, 600, '{"marker":"cashier-hardening"}'),
  (:'invoice_race', :'tenant_a', :'patient_a', 'CH-013', 'draft', 'KZT', 1000, 1000, 0, 0, 1000, '{"marker":"cashier-hardening"}'),
  (:'invoice_b', :'tenant_b', :'patient_b', 'CH-B01', 'draft', 'KZT', 1000, 1000, 0, 0, 1000, '{"marker":"cashier-hardening"}');

INSERT INTO public.invoice_items (
  tenant_id, invoice_id, patient_id, service_name, quantity, unit_price, total_amount, status, metadata
)
SELECT tenant_id, id, patient_id, 'Cashier hardening service', 1, subtotal_amount, subtotal_amount, 'active', '{"marker":"cashier-hardening"}'::jsonb
FROM public.invoices
WHERE id IN (
  :'invoice_success', :'invoice_admin', :'invoice_other_patient', :'invoice_writeoff', :'invoice_paid',
  :'invoice_voided', :'invoice_archived', :'invoice_writtenoff', :'invoice_rollback_1', :'invoice_rollback_2',
  :'invoice_race', :'invoice_b'
);

INSERT INTO public.invoice_items (
  tenant_id, invoice_id, patient_id, service_name, quantity, unit_price, total_amount, status, metadata
) VALUES (
  :'tenant_a', :'invoice_draft', :'patient_a', 'Draft cashier service', 1, 300, 300, 'active', '{"marker":"cashier-hardening"}'
);

UPDATE public.invoices
SET status='issued', issued_at=now(), issue_date=now(), issued_by=:'admin_a'::uuid
WHERE id IN (
  :'invoice_success'::uuid, :'invoice_admin'::uuid, :'invoice_other_patient'::uuid,
  :'invoice_writeoff'::uuid, :'invoice_rollback_1'::uuid, :'invoice_rollback_2'::uuid,
  :'invoice_race'::uuid
);
UPDATE public.invoices
SET status='issued', issued_at=now(), issue_date=now(), issued_by=:'admin_b'::uuid
WHERE id=:'invoice_b'::uuid;
UPDATE public.invoices
SET status='paid', issued_at=now(), issue_date=now(), issued_by=:'admin_a'::uuid
WHERE id=:'invoice_paid'::uuid;
UPDATE public.invoices
SET status='voided', voided_at=now(), voided_by=:'admin_a'::uuid, void_reason='Fixture void'
WHERE id=:'invoice_voided'::uuid;
UPDATE public.invoices
SET status='archived', archived_at=now()
WHERE id=:'invoice_archived'::uuid;
UPDATE public.invoices
SET status='written_off', issued_at=now(), issue_date=now(), issued_by=:'admin_a'::uuid
WHERE id=:'invoice_writtenoff'::uuid;

SELECT count(*)::text AS completed_before FROM public.completed_services WHERE patient_id = :'patient_a'::uuid \gset
SELECT count(*)::text AS appointments_before FROM public.appointments WHERE patient_id = :'patient_a'::uuid \gset
SELECT count(*)::text AS documents_before FROM public.documents WHERE patient_id = :'patient_a'::uuid \gset
SELECT balance::text AS patient_balance_before FROM public.patients WHERE id = :'patient_a'::uuid \gset

SET LOCAL ROLE authenticated;

-- Role matrix.
SELECT set_config('request.jwt.claim.sub', :'doctor_a', true);
SELECT pg_temp.expect_error(
  format('select public.record_and_allocate_payment(%L::uuid,%L::uuid,100,''cash'',''KZT'',null,null,null,null,ARRAY[%L::uuid],''doctor-key'',''{}''::jsonb)', :'tenant_a', :'patient_a', :'invoice_success'),
  'Insufficient finance permissions'
);
SELECT set_config('request.jwt.claim.sub', :'registrar_a', true);
SELECT pg_temp.expect_error(
  format('select public.record_and_allocate_payment(%L::uuid,%L::uuid,100,''cash'',''KZT'',null,null,null,null,ARRAY[%L::uuid],''registrar-key'',''{}''::jsonb)', :'tenant_a', :'patient_a', :'invoice_success'),
  'Insufficient finance permissions'
);
SELECT set_config('request.jwt.claim.sub', :'notenant', true);
SELECT pg_temp.expect_error(
  format('select public.record_and_allocate_payment(%L::uuid,%L::uuid,100,''cash'',''KZT'',null,null,null,null,ARRAY[%L::uuid],''notenant-key'',''{}''::jsonb)', :'tenant_a', :'patient_a', :'invoice_success'),
  'Insufficient finance permissions'
);

-- Validation and tenant/patient boundaries.
SELECT set_config('request.jwt.claim.sub', :'cashier_a', true);
SELECT pg_temp.expect_error(format('select public.record_and_allocate_payment(%L::uuid,%L::uuid,0,''cash'',''KZT'',null,null,null,null,ARRAY[%L::uuid],''zero-key'',''{}''::jsonb)', :'tenant_a', :'patient_a', :'invoice_success'), 'must be positive');
SELECT pg_temp.expect_error(format('select public.record_and_allocate_payment(%L::uuid,%L::uuid,100,''crypto'',''KZT'',null,null,null,null,ARRAY[%L::uuid],''method-key'',''{}''::jsonb)', :'tenant_a', :'patient_a', :'invoice_success'), 'Unsupported payment method');
SELECT pg_temp.expect_error(format('select public.record_and_allocate_payment(%L::uuid,%L::uuid,100,''cash'',''KZT'',null,null,null,null,ARRAY[]::uuid[],''empty-key'',''{}''::jsonb)', :'tenant_a', :'patient_a'), 'At least one invoice');
SELECT pg_temp.expect_error(format('select public.record_and_allocate_payment(%L::uuid,%L::uuid,100,''cash'',''KZT'',null,null,null,null,ARRAY[%L::uuid,%L::uuid],''duplicate-key'',''{}''::jsonb)', :'tenant_a', :'patient_a', :'invoice_success', :'invoice_success'), 'Duplicate invoice IDs');
SELECT pg_temp.expect_error(format('select public.record_and_allocate_payment(%L::uuid,%L::uuid,100,''cash'',''KZT'',null,null,null,null,ARRAY[%L::uuid],''metadata-key'',''[]''::jsonb)', :'tenant_a', :'patient_a', :'invoice_success'), 'Metadata must be a JSON object');
SELECT pg_temp.expect_error(format('select public.record_and_allocate_payment(%L::uuid,%L::uuid,2000,''cash'',''KZT'',null,null,null,null,ARRAY[%L::uuid],''over-key'',''{}''::jsonb)', :'tenant_a', :'patient_a', :'invoice_success'), 'exceeds selected invoice balance');
SELECT pg_temp.expect_error(format('select public.record_and_allocate_payment(%L::uuid,%L::uuid,100,''cash'',''KZT'',null,null,null,null,ARRAY[%L::uuid],''other-patient-key'',''{}''::jsonb)', :'tenant_a', :'patient_a', :'invoice_other_patient'), 'another patient');
SELECT pg_temp.expect_error(format('select public.record_and_allocate_payment(%L::uuid,%L::uuid,100,''cash'',''KZT'',null,null,null,null,ARRAY[%L::uuid],''cross-invoice-key'',''{}''::jsonb)', :'tenant_a', :'patient_a', :'invoice_b'), 'Invoice not found in this tenant');
SELECT pg_temp.expect_error(format('select public.record_and_allocate_payment(%L::uuid,%L::uuid,100,''cash'',''KZT'',null,null,null,null,ARRAY[%L::uuid],''cross-patient-key'',''{}''::jsonb)', :'tenant_a', :'patient_b', :'invoice_success'), 'Patient not found in this tenant');
SELECT pg_temp.expect_error(format('select public.record_and_allocate_payment(%L::uuid,%L::uuid,100,''cash'',''KZT'',null,null,null,null,ARRAY[%L::uuid],''empty-draft-key'',''{}''::jsonb)', :'tenant_a', :'patient_a', :'invoice_draft_empty'), 'at least one active item');
SELECT pg_temp.expect_error(format('select public.record_and_allocate_payment(%L::uuid,%L::uuid,100,''cash'',''KZT'',null,null,null,null,ARRAY[%L::uuid],''paid-key'',''{}''::jsonb)', :'tenant_a', :'patient_a', :'invoice_paid'), 'not actionable');
SELECT pg_temp.expect_error(format('select public.record_and_allocate_payment(%L::uuid,%L::uuid,100,''cash'',''KZT'',null,null,null,null,ARRAY[%L::uuid],''voided-key'',''{}''::jsonb)', :'tenant_a', :'patient_a', :'invoice_voided'), 'not actionable');
SELECT pg_temp.expect_error(format('select public.record_and_allocate_payment(%L::uuid,%L::uuid,100,''cash'',''KZT'',null,null,null,null,ARRAY[%L::uuid],''archived-key'',''{}''::jsonb)', :'tenant_a', :'patient_a', :'invoice_archived'), 'not actionable');
SELECT pg_temp.expect_error(format('select public.record_and_allocate_payment(%L::uuid,%L::uuid,100,''cash'',''KZT'',null,null,null,null,ARRAY[%L::uuid],''writtenoff-key'',''{}''::jsonb)', :'tenant_a', :'patient_a', :'invoice_writtenoff'), 'not actionable');

-- Active write-off reservation conflict.
SELECT set_config('request.jwt.claim.sub', :'admin_a', true);
SELECT public.request_invoice_write_off(:'tenant_a'::uuid, :'invoice_writeoff'::uuid, 100, 'Reserved debt', 'writeoff-reservation-cashier', '{}'::jsonb);
SELECT set_config('request.jwt.claim.sub', :'cashier_a', true);
SELECT pg_temp.expect_error(format('select public.record_and_allocate_payment(%L::uuid,%L::uuid,100,''cash'',''KZT'',null,null,null,null,ARRAY[%L::uuid],''writeoff-conflict-key'',''{}''::jsonb)', :'tenant_a', :'patient_a', :'invoice_writeoff'), 'active or approved write-off');

-- Cashier atomic success and exact idempotent replay.
SELECT public.record_and_allocate_payment(
  :'tenant_a', :'patient_a', 1000, 'cash', 'KZT', NULL, 'SQL-CASHIER-001', 'Patient A', 'Atomic cashier payment',
  ARRAY[:'invoice_success'::uuid], 'cashier-success-key', '{"source":"sql-smoke"}'::jsonb
)::text AS cashier_result \gset
SELECT (:'cashier_result'::jsonb -> 'payment' ->> 'id') AS cashier_payment \gset
SELECT pg_temp.assert_true((:'cashier_result'::jsonb ->> 'status') = 'completed', 'first cashier operation must complete');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.payments WHERE tenant_id=:'tenant_a' AND cashier_operation_key='cashier-success-key') = 1, 'atomic operation must create exactly one payment');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.payment_allocations WHERE payment_id=:'cashier_payment'::uuid AND status='active') = 1, 'atomic operation must create exactly one allocation');
SELECT pg_temp.assert_true((SELECT status FROM public.invoices WHERE id=:'invoice_success') = 'paid', 'invoice must be paid');
SELECT pg_temp.assert_true((SELECT status FROM public.payments WHERE id=:'cashier_payment') = 'allocated', 'payment must be allocated');
SELECT pg_temp.assert_true((SELECT received_by FROM public.payments WHERE id=:'cashier_payment') = :'cashier_a'::uuid, 'payment actor must derive from auth.uid');

SELECT public.record_and_allocate_payment(
  :'tenant_a', :'patient_a', 1000, 'cash', 'KZT', NULL, 'SQL-CASHIER-001', 'Patient A', 'Atomic cashier payment',
  ARRAY[:'invoice_success'::uuid], 'cashier-success-key', '{"source":"sql-smoke"}'::jsonb
)::text AS replay_result \gset
SELECT pg_temp.assert_true((:'replay_result'::jsonb ->> 'status') = 'already_completed', 'retry must return already_completed');
SELECT pg_temp.assert_true((:'replay_result'::jsonb -> 'payment' ->> 'id') = :'cashier_payment', 'retry must return same payment');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.payments WHERE cashier_operation_key='cashier-success-key') = 1, 'retry must not duplicate payment');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.payment_allocations WHERE payment_id=:'cashier_payment'::uuid) = 1, 'retry must not duplicate allocation');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT count(*) FROM public.audit_events WHERE payment_id=:'cashier_payment' AND action IN ('payment_recorded','payment_allocated')) = 2, 'retry must not duplicate payment audit facts');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.activity_events WHERE metadata->>'paymentId'=:'cashier_payment' AND type IN ('payment_recorded','payment_allocated')) = 2, 'retry must not duplicate payment activity facts');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'cashier_a', true);
SELECT pg_temp.expect_error(format('select public.record_and_allocate_payment(%L::uuid,%L::uuid,999,''cash'',''KZT'',null,%L,%L,%L,ARRAY[%L::uuid],%L,%L::jsonb)', :'tenant_a', :'patient_a', 'SQL-CASHIER-001', 'Patient A', 'Atomic cashier payment', :'invoice_success', 'cashier-success-key', '{"source":"sql-smoke"}'), 'CASHIER_IDEMPOTENCY_CONFLICT');
SELECT pg_temp.expect_error(format('select public.record_and_allocate_payment(%L::uuid,%L::uuid,1000,''cash'',''KZT'',null,%L,%L,%L,ARRAY[%L::uuid],%L,%L::jsonb)', :'tenant_a', :'patient_a', 'SQL-CASHIER-001', 'Patient A', 'Atomic cashier payment', :'invoice_admin', 'cashier-success-key', '{"source":"sql-smoke"}'), 'CASHIER_IDEMPOTENCY_CONFLICT');

-- Admin success.
SELECT set_config('request.jwt.claim.sub', :'admin_a', true);
SELECT public.record_and_allocate_payment(:'tenant_a', :'patient_a', 500, 'card', 'KZT', NULL, NULL, NULL, NULL, ARRAY[:'invoice_admin'::uuid], 'admin-success-key', '{}')::text AS admin_result \gset
SELECT pg_temp.assert_true((:'admin_result'::jsonb ->> 'status')='completed', 'admin must complete atomic payment');

-- Draft invoice with item is issued inside the transaction.
SELECT public.record_and_allocate_payment(:'tenant_a', :'patient_a', 300, 'cash', 'KZT', NULL, NULL, NULL, NULL, ARRAY[:'invoice_draft'::uuid], 'draft-success-key', '{}')::text AS draft_result \gset
SELECT pg_temp.assert_true((SELECT status FROM public.invoices WHERE id=:'invoice_draft')='paid', 'draft invoice must be issued then paid');
SELECT pg_temp.assert_true((:'draft_result'::jsonb -> 'issued_invoice_ids') @> to_jsonb(ARRAY[:'invoice_draft'::uuid]), 'result must report issued draft invoice');

-- Tenant-scoped reconciliation lookup.
SELECT public.get_cashier_payment_operation(:'tenant_a', 'cashier-success-key')::text AS lookup_a \gset
SELECT pg_temp.assert_true((:'lookup_a'::jsonb -> 'payment' ->> 'id')=:'cashier_payment', 'tenant A lookup must return completed operation');
SELECT set_config('request.jwt.claim.sub', :'admin_b', true);
SELECT public.get_cashier_payment_operation(:'tenant_b', 'cashier-success-key')::text AS lookup_b \gset
SELECT pg_temp.assert_true((:'lookup_b'::jsonb ->> 'status')='not_found', 'tenant B key lookup must reveal nothing');
SELECT pg_temp.expect_error(format('select public.get_cashier_payment_operation(%L::uuid,%L)', :'tenant_a', 'cashier-success-key'), 'Insufficient finance permissions');

-- Failure on the first allocation rolls back the payment.
RESET ROLE;
CREATE OR REPLACE FUNCTION pg_temp.fail_cashier_allocation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.invoice_id = 'a9100000-0000-4000-8000-000000000011'::uuid THEN RAISE EXCEPTION 'forced first allocation failure'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER cashier_force_allocation_failure BEFORE INSERT ON public.payment_allocations FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_cashier_allocation();
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'cashier_a', true);
SELECT pg_temp.expect_error(format('select public.record_and_allocate_payment(%L::uuid,%L::uuid,400,''cash'',''KZT'',null,null,null,null,ARRAY[%L::uuid],''rollback-first-key'',''{}''::jsonb)', :'tenant_a', :'patient_a', :'invoice_rollback_1'), 'forced first allocation failure');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.payments WHERE cashier_operation_key='rollback-first-key')=0, 'first allocation failure must roll back payment');
RESET ROLE;
DROP TRIGGER cashier_force_allocation_failure ON public.payment_allocations;

-- Failure on the second allocation rolls back payment and first allocation.
CREATE OR REPLACE FUNCTION pg_temp.fail_cashier_second_allocation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.invoice_id = 'a9100000-0000-4000-8000-000000000012'::uuid THEN RAISE EXCEPTION 'forced second allocation failure'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER cashier_force_second_allocation_failure BEFORE INSERT ON public.payment_allocations FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_cashier_second_allocation();
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'cashier_a', true);
SELECT pg_temp.expect_error(format('select public.record_and_allocate_payment(%L::uuid,%L::uuid,1000,''cash'',''KZT'',null,null,null,null,ARRAY[%L::uuid,%L::uuid],''rollback-second-key'',''{}''::jsonb)', :'tenant_a', :'patient_a', :'invoice_rollback_1', :'invoice_rollback_2'), 'forced second allocation failure');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.payments WHERE cashier_operation_key='rollback-second-key')=0, 'second allocation failure must roll back payment');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.payment_allocations WHERE invoice_id IN (:'invoice_rollback_1'::uuid, :'invoice_rollback_2'::uuid))=0, 'second allocation failure must roll back first allocation');
SELECT pg_temp.assert_true((SELECT paid_amount FROM public.invoices WHERE id=:'invoice_rollback_1')=0, 'rollback must restore first invoice paid amount');
RESET ROLE;
DROP TRIGGER cashier_force_second_allocation_failure ON public.payment_allocations;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'cashier_a', true);

-- Side effects and schema/grant invariants.
RESET ROLE;
SELECT pg_temp.assert_true((SELECT count(*) FROM public.completed_services WHERE patient_id=:'patient_a')=:'completed_before'::bigint, 'completed_services must remain unchanged');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.appointments WHERE patient_id=:'patient_a')=:'appointments_before'::bigint, 'appointments must remain unchanged');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.documents WHERE patient_id=:'patient_a')=:'documents_before'::bigint, 'documents must remain unchanged');
SELECT pg_temp.assert_true((SELECT balance FROM public.patients WHERE id=:'patient_a')=:'patient_balance_before'::numeric, 'patients.balance must remain unchanged');
SELECT pg_temp.assert_true((SELECT prosecdef FROM pg_proc WHERE oid='public.record_and_allocate_payment(uuid,uuid,numeric,text,text,timestamp with time zone,text,text,text,uuid[],text,jsonb)'::regprocedure), 'atomic RPC must be SECURITY DEFINER');
SELECT pg_temp.assert_true((SELECT proconfig @> ARRAY['search_path=public, pg_temp'] FROM pg_proc WHERE oid='public.record_and_allocate_payment(uuid,uuid,numeric,text,text,timestamp with time zone,text,text,text,uuid[],text,jsonb)'::regprocedure), 'atomic RPC must pin search_path');
SELECT pg_temp.assert_true(has_function_privilege('authenticated','public.record_and_allocate_payment(uuid,uuid,numeric,text,text,timestamp with time zone,text,text,text,uuid[],text,jsonb)','EXECUTE'), 'authenticated must have exact execute grant');
SELECT pg_temp.assert_true(NOT has_function_privilege('anon','public.record_and_allocate_payment(uuid,uuid,numeric,text,text,timestamp with time zone,text,text,text,uuid[],text,jsonb)','EXECUTE'), 'anon must not execute atomic RPC');
SELECT pg_temp.assert_true(NOT has_function_privilege('public','public.record_and_allocate_payment(uuid,uuid,numeric,text,text,timestamp with time zone,text,text,text,uuid[],text,jsonb)','EXECUTE'), 'PUBLIC must not execute atomic RPC');
SELECT pg_temp.assert_true(has_function_privilege('authenticated','public.get_cashier_payment_operation(uuid,text)','EXECUTE'), 'authenticated must execute lookup RPC');
SELECT pg_temp.assert_true(NOT has_function_privilege('anon','public.get_cashier_payment_operation(uuid,text)','EXECUTE'), 'anon must not execute lookup RPC');

ROLLBACK;
\echo 'CASHIER PAYMENT HARDENING SQL TESTS PASSED'
