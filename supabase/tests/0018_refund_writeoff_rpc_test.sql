\set ON_ERROR_STOP on
\echo 'REFUNDS-WRITEOFFS-FOUNDATION-001 local SQL validation'

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.assert_true(p_condition boolean, p_message text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF COALESCE(p_condition, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'ASSERTION FAILED: %', p_message;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.expect_error(p_sql text, p_expected text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_message text;
BEGIN
  BEGIN
    EXECUTE p_sql;
    RAISE EXCEPTION 'ASSERTION FAILED: expected error containing "%"', p_expected;
  EXCEPTION
    WHEN OTHERS THEN
      v_message := SQLERRM;
      IF v_message LIKE 'ASSERTION FAILED:%' THEN
        RAISE;
      END IF;
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
\set patient_a 'a1000000-0000-4000-8000-000000000001'
\set patient_b 'b1000000-0000-4000-8000-000000000001'

INSERT INTO public.patients (id, tenant_id, full_name, phone, source, balance)
VALUES
  (:'patient_a'::uuid, :'tenant_a'::uuid, 'Refund Writeoff Smoke A', '+77000000001', 'phone', 0),
  (:'patient_b'::uuid, :'tenant_b'::uuid, 'Refund Writeoff Smoke B', '+77000000002', 'phone', 0);

SELECT count(*)::text AS completed_before FROM public.completed_services WHERE patient_id = :'patient_a'::uuid \gset
SELECT count(*)::text AS appointments_before FROM public.appointments WHERE patient_id = :'patient_a'::uuid \gset
SELECT balance::text AS balance_before FROM public.patients WHERE id = :'patient_a'::uuid \gset

SET LOCAL ROLE authenticated;

-- REFUND ROLE AND VALIDATION MATRIX
SELECT set_config('request.jwt.claim.sub', :'doctor_a', true);
SELECT pg_temp.expect_error(
  format('select public.request_refund(%L::uuid,%L::uuid,100,''cash'',''doctor attempt'',null,''{}''::jsonb)', :'tenant_a', '00000000-0000-4000-8000-000000000099'),
  'Insufficient finance permissions'
);

SELECT set_config('request.jwt.claim.sub', :'registrar_a', true);
SELECT pg_temp.expect_error(
  format('select public.request_refund(%L::uuid,%L::uuid,100,''cash'',''registrar attempt'',null,''{}''::jsonb)', :'tenant_a', '00000000-0000-4000-8000-000000000099'),
  'Insufficient finance permissions'
);

SELECT set_config('request.jwt.claim.sub', :'notenant', true);
SELECT pg_temp.expect_error(
  format('select public.request_refund(%L::uuid,%L::uuid,100,''cash'',''no tenant attempt'',null,''{}''::jsonb)', :'tenant_a', '00000000-0000-4000-8000-000000000099'),
  'Insufficient finance permissions'
);

SELECT set_config('request.jwt.claim.sub', :'cashier_a', true);
SELECT (public.record_patient_credit_payment(:'tenant_a'::uuid, :'patient_a'::uuid, 1000, 'cash', 'KZT', NULL, NULL, NULL, NULL, 'refund-test-payment-key', '{}'::jsonb)#>>'{payment,id}') AS refund_payment \gset

SELECT pg_temp.expect_error(
  format('select public.request_refund(%L::uuid,%L::uuid,0,''cash'',''bad amount'',null,''{}''::jsonb)', :'tenant_a', :'refund_payment'),
  'must be positive'
);
SELECT pg_temp.expect_error(
  format('select public.request_refund(%L::uuid,%L::uuid,1,''crypto'',''bad method'',null,''{}''::jsonb)', :'tenant_a', :'refund_payment'),
  'Unsupported refund method'
);
SELECT pg_temp.expect_error(
  format('select public.request_refund(%L::uuid,%L::uuid,1,''cash'','' '',null,''{}''::jsonb)', :'tenant_a', :'refund_payment'),
  'reason is required'
);
SELECT pg_temp.expect_error(
  format('select public.request_refund(%L::uuid,%L::uuid,1,''cash'',''bad metadata'',null,''[]''::jsonb)', :'tenant_a', :'refund_payment'),
  'Metadata must be a JSON object'
);

SELECT set_config('request.jwt.claim.sub', :'admin_b', true);
SELECT pg_temp.expect_error(
  format('select public.request_refund(%L::uuid,%L::uuid,100,''cash'',''cross tenant'',null,''{}''::jsonb)', :'tenant_b', :'refund_payment'),
  'Payment not found in this tenant'
);

SELECT set_config('request.jwt.claim.sub', :'cashier_a', true);
SELECT (public.request_refund(:'tenant_a'::uuid, :'refund_payment'::uuid, 400, 'cash', 'Return overpayment', 'refund-idempotency-1', '{"source":"sql-smoke"}'::jsonb)).id::text AS refund_400 \gset
SELECT (public.request_refund(:'tenant_a'::uuid, :'refund_payment'::uuid, 400, 'cash', 'Return overpayment', 'refund-idempotency-1', '{"source":"retry"}'::jsonb)).id::text AS refund_400_retry \gset
SELECT pg_temp.assert_true(:'refund_400' = :'refund_400_retry', 'refund idempotency retry must return same row');
SELECT pg_temp.assert_true((SELECT COALESCE(sum(amount), 0) FROM public.refunds WHERE tenant_id = :'tenant_a'::uuid AND payment_id = :'refund_payment'::uuid AND status IN ('pending','approved')) = 400, 'pending refund must reserve 400');
SELECT pg_temp.assert_true((SELECT p.amount - COALESCE((SELECT sum(pa.amount) FROM public.payment_allocations pa WHERE pa.tenant_id=p.tenant_id AND pa.payment_id=p.id AND pa.status='active'),0) - COALESCE((SELECT sum(r.amount) FROM public.refunds r WHERE r.tenant_id=p.tenant_id AND r.payment_id=p.id AND r.status='completed'),0) - COALESCE((SELECT sum(r.amount) FROM public.refunds r WHERE r.tenant_id=p.tenant_id AND r.payment_id=p.id AND r.status IN ('pending','approved')),0) FROM public.payments p WHERE p.id=:'refund_payment'::uuid) = 600, 'refundable amount after reservation must be 600');
SELECT pg_temp.expect_error(
  format('select public.request_refund(%L::uuid,%L::uuid,601,''cash'',''over reserved capacity'',null,''{}''::jsonb)', :'tenant_a', :'refund_payment'),
  'exceeds currently unallocated refundable amount'
);

SELECT pg_temp.expect_error(
  format('select public.approve_refund(%L::uuid,%L::uuid)', :'tenant_a', :'refund_400'),
  'Insufficient finance permissions'
);

SELECT set_config('request.jwt.claim.sub', :'admin_a', true);
SELECT (public.approve_refund(:'tenant_a'::uuid, :'refund_400'::uuid)).status AS approved_status \gset
SELECT pg_temp.assert_true(:'approved_status' = 'approved', 'admin must approve pending refund');

SELECT set_config('request.jwt.claim.sub', :'cashier_a', true);
SELECT (public.complete_refund(:'tenant_a'::uuid, :'refund_400'::uuid, 'LOCAL-REFUND-400', '{"recorded":true}'::jsonb)).status AS completed_status \gset
SELECT pg_temp.assert_true(:'completed_status' = 'completed', 'cashier must complete approved refund');
SELECT (public.complete_refund(:'tenant_a'::uuid, :'refund_400'::uuid, 'LOCAL-REFUND-400', '{}'::jsonb)).id::text AS completed_retry \gset
SELECT pg_temp.assert_true(:'completed_retry' = :'refund_400', 'completed refund retry must return same row');
SELECT pg_temp.assert_true((SELECT status FROM public.payments WHERE id = :'refund_payment'::uuid) = 'partially_refunded', 'payment must become partially_refunded');

SELECT set_config('request.jwt.claim.sub', :'admin_a', true);
SELECT pg_temp.expect_error(
  format('select public.void_refund(%L::uuid,%L::uuid,''illegal reversal'')', :'tenant_a', :'refund_400'),
  'Completed refunds are immutable'
);

SELECT set_config('request.jwt.claim.sub', :'cashier_a', true);
SELECT (public.request_refund(:'tenant_a'::uuid, :'refund_payment'::uuid, 600, 'cash', 'Return remainder', 'refund-idempotency-2', '{}'::jsonb)).id::text AS refund_600 \gset
SELECT set_config('request.jwt.claim.sub', :'admin_a', true);
SELECT public.approve_refund(:'tenant_a'::uuid, :'refund_600'::uuid);
SELECT set_config('request.jwt.claim.sub', :'cashier_a', true);
SELECT public.complete_refund(:'tenant_a'::uuid, :'refund_600'::uuid, 'LOCAL-REFUND-600', '{}'::jsonb);
SELECT pg_temp.assert_true((SELECT status FROM public.payments WHERE id = :'refund_payment'::uuid) = 'refunded', 'payment must become refunded after full return');
SELECT set_config('request.jwt.claim.sub', :'admin_a', true);
SELECT pg_temp.expect_error(
  format('select public.void_payment(%L::uuid,%L::uuid,''cannot void refunded payment'')', :'tenant_a', :'refund_payment'),
  'Payment with active or completed refunds cannot be voided'
);

-- Pending cannot complete, pending/approved can void, rejection releases reserve.
SELECT (public.record_patient_credit_payment(:'tenant_a'::uuid, :'patient_a'::uuid, 500, 'cash', 'KZT', NULL, NULL, NULL, NULL, 'refund-test-reserve-key', '{}'::jsonb)#>>'{payment,id}') AS reserve_payment \gset
SELECT (public.request_refund(:'tenant_a'::uuid, :'reserve_payment'::uuid, 400, 'cash', 'Pending flow', 'refund-pending-flow', '{}'::jsonb)).id::text AS pending_refund \gset
SELECT pg_temp.expect_error(
  format('select public.complete_refund(%L::uuid,%L::uuid,null,''{}''::jsonb)', :'tenant_a', :'pending_refund'),
  'Only approved refunds can be completed'
);
SELECT set_config('request.jwt.claim.sub', :'admin_a', true);
SELECT public.reject_refund(:'tenant_a'::uuid, :'pending_refund'::uuid, 'Rejected in smoke');
SELECT pg_temp.assert_true((SELECT p.amount - COALESCE((SELECT sum(r.amount) FROM public.refunds r WHERE r.tenant_id=p.tenant_id AND r.payment_id=p.id AND r.status IN ('pending','approved','completed')),0) FROM public.payments p WHERE p.id=:'reserve_payment'::uuid) = 500, 'rejection must release reservation');
SELECT set_config('request.jwt.claim.sub', :'cashier_a', true);
SELECT (public.request_refund(:'tenant_a'::uuid, :'reserve_payment'::uuid, 500, 'cash', 'Replacement request', 'refund-replacement', '{}'::jsonb)).id::text AS replacement_refund \gset
SELECT set_config('request.jwt.claim.sub', :'admin_a', true);
SELECT public.void_refund(:'tenant_a'::uuid, :'replacement_refund'::uuid, 'Cancelled before approval');
SELECT pg_temp.assert_true((SELECT p.amount - COALESCE((SELECT sum(r.amount) FROM public.refunds r WHERE r.tenant_id=p.tenant_id AND r.payment_id=p.id AND r.status IN ('pending','approved','completed')),0) FROM public.payments p WHERE p.id=:'reserve_payment'::uuid) = 500, 'void must release reservation');

-- Allocated funds cannot be refunded until controlled allocation void.
SELECT set_config('request.jwt.claim.sub', :'admin_a', true);
SELECT (public.create_invoice(:'tenant_a'::uuid, :'patient_a'::uuid)).id::text AS allocated_invoice \gset
SELECT public.add_invoice_item(:'tenant_a'::uuid, :'allocated_invoice'::uuid, 'Allocated refund test', 1, 1000);
SELECT public.issue_invoice(:'tenant_a'::uuid, :'allocated_invoice'::uuid);
SELECT set_config('request.jwt.claim.sub', :'cashier_a', true);
SELECT (public.record_patient_credit_payment(:'tenant_a'::uuid, :'patient_a'::uuid, 1000, 'cash', 'KZT', NULL, NULL, NULL, NULL, 'refund-test-allocated-key', '{}'::jsonb)#>>'{payment,id}') AS allocated_payment \gset
SELECT (public.allocate_payment(:'tenant_a'::uuid, :'allocated_payment'::uuid, 1000, :'allocated_invoice'::uuid)).id::text AS allocation_id \gset
SELECT pg_temp.expect_error(
  format('select public.request_refund(%L::uuid,%L::uuid,100,''cash'',''allocated money'',null,''{}''::jsonb)', :'tenant_a', :'allocated_payment'),
  'exceeds currently unallocated refundable amount'
);
SELECT set_config('request.jwt.claim.sub', :'admin_a', true);
SELECT public.void_payment_allocation(:'tenant_a'::uuid, :'allocation_id'::uuid, 'Release allocation for refund');
SELECT set_config('request.jwt.claim.sub', :'cashier_a', true);
SELECT (public.request_refund(:'tenant_a'::uuid, :'allocated_payment'::uuid, 100, 'cash', 'Now refundable', 'refund-after-allocation-void', '{}'::jsonb)).id::text AS after_void_refund \gset
SELECT set_config('request.jwt.claim.sub', :'admin_a', true);
SELECT public.void_refund(:'tenant_a'::uuid, :'after_void_refund'::uuid, 'Smoke cleanup transition');

-- WRITE-OFF ROLE AND VALIDATION MATRIX
SELECT set_config('request.jwt.claim.sub', :'admin_a', true);
SELECT (public.create_invoice(:'tenant_a'::uuid, :'patient_a'::uuid)).id::text AS writeoff_invoice \gset
SELECT public.add_invoice_item(:'tenant_a'::uuid, :'writeoff_invoice'::uuid, 'Write-off test', 1, 1000);
SELECT public.issue_invoice(:'tenant_a'::uuid, :'writeoff_invoice'::uuid);

SELECT set_config('request.jwt.claim.sub', :'cashier_a', true);
SELECT pg_temp.expect_error(
  format('select public.request_invoice_write_off(%L::uuid,%L::uuid,100,''cashier attempt'',null,''{}''::jsonb)', :'tenant_a', :'writeoff_invoice'),
  'Insufficient finance permissions'
);
SELECT set_config('request.jwt.claim.sub', :'doctor_a', true);
SELECT pg_temp.expect_error(
  format('select public.request_invoice_write_off(%L::uuid,%L::uuid,100,''doctor attempt'',null,''{}''::jsonb)', :'tenant_a', :'writeoff_invoice'),
  'Insufficient finance permissions'
);
SELECT set_config('request.jwt.claim.sub', :'admin_b', true);
SELECT pg_temp.expect_error(
  format('select public.request_invoice_write_off(%L::uuid,%L::uuid,100,''cross tenant'',null,''{}''::jsonb)', :'tenant_b', :'writeoff_invoice'),
  'Invoice not found in this tenant'
);

SELECT set_config('request.jwt.claim.sub', :'admin_a', true);
SELECT pg_temp.expect_error(
  format('select public.request_invoice_write_off(%L::uuid,%L::uuid,0,''bad amount'',null,''{}''::jsonb)', :'tenant_a', :'writeoff_invoice'),
  'must be positive'
);
SELECT pg_temp.expect_error(
  format('select public.request_invoice_write_off(%L::uuid,%L::uuid,1,'' '',null,''{}''::jsonb)', :'tenant_a', :'writeoff_invoice'),
  'reason is required'
);
SELECT pg_temp.expect_error(
  format('select public.request_invoice_write_off(%L::uuid,%L::uuid,1,''bad metadata'',null,''[]''::jsonb)', :'tenant_a', :'writeoff_invoice'),
  'Metadata must be a JSON object'
);

SELECT (public.create_invoice(:'tenant_a'::uuid, :'patient_a'::uuid)).id::text AS draft_invoice \gset
SELECT public.add_invoice_item(:'tenant_a'::uuid, :'draft_invoice'::uuid, 'Draft writeoff negative', 1, 100);
SELECT pg_temp.expect_error(
  format('select public.request_invoice_write_off(%L::uuid,%L::uuid,10,''draft not eligible'',null,''{}''::jsonb)', :'tenant_a', :'draft_invoice'),
  'Cannot write off invoice with status draft'
);

SELECT (public.create_invoice(:'tenant_a'::uuid, :'patient_a'::uuid)).id::text AS paid_invoice \gset
SELECT public.add_invoice_item(:'tenant_a'::uuid, :'paid_invoice'::uuid, 'Paid writeoff negative', 1, 100);
SELECT public.issue_invoice(:'tenant_a'::uuid, :'paid_invoice'::uuid);
SELECT set_config('request.jwt.claim.sub', :'cashier_a', true);
SELECT (public.record_patient_credit_payment(:'tenant_a'::uuid, :'patient_a'::uuid, 100, 'cash', 'KZT', NULL, NULL, NULL, NULL, 'refund-test-paid-invoice-key', '{}'::jsonb)#>>'{payment,id}') AS paid_invoice_payment \gset
SELECT public.allocate_payment(:'tenant_a'::uuid, :'paid_invoice_payment'::uuid, 100, :'paid_invoice'::uuid);
SELECT set_config('request.jwt.claim.sub', :'admin_a', true);
SELECT pg_temp.expect_error(
  format('select public.request_invoice_write_off(%L::uuid,%L::uuid,1,''paid not eligible'',null,''{}''::jsonb)', :'tenant_a', :'paid_invoice'),
  'Cannot write off invoice with status paid'
);

SELECT count(*)::text AS writeoff_payment_count_before FROM public.payments WHERE patient_id = :'patient_a'::uuid \gset
SELECT (public.request_invoice_write_off(:'tenant_a'::uuid, :'writeoff_invoice'::uuid, 400, 'Bad debt partial', 'writeoff-idempotency-1', '{"source":"sql-smoke"}'::jsonb)).id::text AS writeoff_400 \gset
SELECT (public.request_invoice_write_off(:'tenant_a'::uuid, :'writeoff_invoice'::uuid, 400, 'Bad debt partial', 'writeoff-idempotency-1', '{"source":"retry"}'::jsonb)).id::text AS writeoff_400_retry \gset
SELECT pg_temp.assert_true(:'writeoff_400' = :'writeoff_400_retry', 'write-off idempotency retry must return same row');
SELECT pg_temp.assert_true((SELECT COALESCE(sum(amount),0) FROM public.financial_adjustments WHERE tenant_id=:'tenant_a'::uuid AND invoice_id=:'writeoff_invoice'::uuid AND adjustment_type='write_off' AND status='active') = 400, 'active write-off must reserve 400');
SELECT pg_temp.assert_true((SELECT i.total_amount - i.paid_amount - COALESCE((SELECT sum(fa.amount) FROM public.financial_adjustments fa WHERE fa.tenant_id=i.tenant_id AND fa.invoice_id=i.id AND fa.adjustment_type='write_off' AND fa.status IN ('active','approved')),0) FROM public.invoices i WHERE i.id=:'writeoff_invoice'::uuid) = 600, 'available write-off amount must be 600');
SELECT pg_temp.expect_error(
  format('select public.request_invoice_write_off(%L::uuid,%L::uuid,601,''over reserve'',null,''{}''::jsonb)', :'tenant_a', :'writeoff_invoice'),
  'exceeds available invoice balance'
);

SELECT (public.approve_invoice_write_off(:'tenant_a'::uuid, :'writeoff_400'::uuid)).status AS writeoff_400_status \gset
SELECT pg_temp.assert_true(:'writeoff_400_status' = 'approved', 'admin must approve active write-off');
SELECT pg_temp.assert_true((SELECT written_off_amount FROM public.invoices WHERE id = :'writeoff_invoice'::uuid) = 400, 'partial write-off must increment written_off_amount');
SELECT pg_temp.assert_true((SELECT balance_amount FROM public.invoices WHERE id = :'writeoff_invoice'::uuid) = 600, 'partial write-off must leave 600 balance');
SELECT pg_temp.assert_true((SELECT paid_amount FROM public.invoices WHERE id = :'writeoff_invoice'::uuid) = 0, 'write-off must not increase paid_amount');
SELECT pg_temp.assert_true((SELECT status FROM public.invoices WHERE id = :'writeoff_invoice'::uuid) = 'issued', 'partial write-off without payment remains issued');
SELECT pg_temp.expect_error(
  format('select public.void_invoice(%L::uuid,%L::uuid,''cannot void invoice with write-off'')', :'tenant_a', :'writeoff_invoice'),
  'Invoice with active or approved write-offs cannot be voided'
);

SELECT (public.request_invoice_write_off(:'tenant_a'::uuid, :'writeoff_invoice'::uuid, 600, 'Bad debt remainder', 'writeoff-idempotency-2', '{}'::jsonb)).id::text AS writeoff_600 \gset
SELECT public.approve_invoice_write_off(:'tenant_a'::uuid, :'writeoff_600'::uuid);
SELECT pg_temp.assert_true((SELECT written_off_amount FROM public.invoices WHERE id = :'writeoff_invoice'::uuid) = 1000, 'full write-off must total 1000');
SELECT pg_temp.assert_true((SELECT balance_amount FROM public.invoices WHERE id = :'writeoff_invoice'::uuid) = 0, 'full write-off must zero balance');
SELECT pg_temp.assert_true((SELECT status FROM public.invoices WHERE id = :'writeoff_invoice'::uuid) = 'written_off', 'full write-off must set written_off status');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.payments WHERE patient_id = :'patient_a'::uuid) = :'writeoff_payment_count_before'::integer, 'write-off must not create payment');

SELECT public.void_invoice_write_off(:'tenant_a'::uuid, :'writeoff_600'::uuid, 'Reverse second write-off');
SELECT pg_temp.assert_true((SELECT written_off_amount FROM public.invoices WHERE id = :'writeoff_invoice'::uuid) = 400, 'void approved write-off must reduce written_off_amount');
SELECT pg_temp.assert_true((SELECT balance_amount FROM public.invoices WHERE id = :'writeoff_invoice'::uuid) = 600, 'void approved write-off must reopen debt');
SELECT pg_temp.assert_true((SELECT status FROM public.invoices WHERE id = :'writeoff_invoice'::uuid) = 'issued', 'reopened debt must restore issued status');

SELECT (public.request_invoice_write_off(:'tenant_a'::uuid, :'writeoff_invoice'::uuid, 100, 'Reject flow', 'writeoff-reject-flow', '{}'::jsonb)).id::text AS rejected_writeoff \gset
SELECT public.reject_invoice_write_off(:'tenant_a'::uuid, :'rejected_writeoff'::uuid, 'Rejected in smoke');
SELECT pg_temp.assert_true((SELECT balance_amount FROM public.invoices WHERE id = :'writeoff_invoice'::uuid) = 600, 'rejected write-off must not change invoice balance');

-- ACTOR, AUDIT, ACTIVITY, AND SIDE-EFFECT ASSERTIONS
SELECT pg_temp.assert_true((SELECT requested_by FROM public.refunds WHERE id = :'refund_400'::uuid) = :'cashier_a'::uuid, 'refund requested_by must come from auth.uid()');
SELECT pg_temp.assert_true((SELECT approved_by FROM public.refunds WHERE id = :'refund_400'::uuid) = :'admin_a'::uuid, 'refund approved_by must come from auth.uid()');
SELECT pg_temp.assert_true((SELECT completed_by FROM public.refunds WHERE id = :'refund_400'::uuid) = :'cashier_a'::uuid, 'refund completed_by must come from auth.uid()');
SELECT pg_temp.assert_true((SELECT created_by FROM public.financial_adjustments WHERE id = :'writeoff_400'::uuid) = :'admin_a'::uuid, 'write-off created_by must come from auth.uid()');
SELECT pg_temp.assert_true((SELECT approved_by FROM public.financial_adjustments WHERE id = :'writeoff_400'::uuid) = :'admin_a'::uuid, 'write-off approved_by must come from auth.uid()');

SELECT pg_temp.assert_true((SELECT count(*) FROM public.audit_events WHERE action = 'refund_requested' AND tenant_id = :'tenant_a'::uuid) >= 4, 'refund_requested audit events must exist');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.audit_events WHERE action = 'refund_approved' AND tenant_id = :'tenant_a'::uuid) >= 2, 'refund_approved audit events must exist');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.audit_events WHERE action = 'refund_completed' AND tenant_id = :'tenant_a'::uuid) = 2, 'refund_completed audit events must be idempotent');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.audit_events WHERE action = 'refund_rejected' AND tenant_id = :'tenant_a'::uuid) = 1, 'refund_rejected audit event must exist');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.audit_events WHERE action = 'refund_voided' AND tenant_id = :'tenant_a'::uuid) >= 2, 'refund_voided audit events must exist');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.audit_events WHERE action = 'write_off_requested' AND tenant_id = :'tenant_a'::uuid) >= 3, 'write_off_requested audit events must exist');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.audit_events WHERE action = 'write_off_approved' AND tenant_id = :'tenant_a'::uuid) = 2, 'write_off_approved audit events must exist');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.audit_events WHERE action = 'write_off_rejected' AND tenant_id = :'tenant_a'::uuid) = 1, 'write_off_rejected audit event must exist');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.audit_events WHERE action = 'write_off_voided' AND tenant_id = :'tenant_a'::uuid) = 1, 'write_off_voided audit event must exist');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.activity_events WHERE type IN ('refund_requested','refund_approved','refund_completed','refund_rejected','refund_voided') AND tenant_id = :'tenant_a'::uuid) >= 11, 'refund activity events must exist');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.activity_events WHERE type IN ('write_off_requested','write_off_approved','write_off_rejected','write_off_voided') AND tenant_id = :'tenant_a'::uuid) >= 7, 'write-off activity events must exist');

SELECT pg_temp.assert_true((SELECT count(*) FROM public.completed_services WHERE patient_id = :'patient_a'::uuid) = :'completed_before'::integer, 'completed_services must remain unchanged');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.appointments WHERE patient_id = :'patient_a'::uuid) = :'appointments_before'::integer, 'appointments must remain unchanged');
SELECT pg_temp.assert_true((SELECT balance FROM public.patients WHERE id = :'patient_a'::uuid) = :'balance_before'::numeric, 'patients.balance must remain unchanged');

\echo 'REFUNDS-WRITEOFFS SQL TESTS PASSED'
ROLLBACK;
