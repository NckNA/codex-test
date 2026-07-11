\set ON_ERROR_STOP on
\echo 'CASHIER-CREDIT-PREPAYMENT-HARDENING-001 local SQL validation'

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

CREATE OR REPLACE FUNCTION pg_temp.expect_any_error(p_sql text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
    RAISE EXCEPTION 'ASSERTION FAILED: expected operation to fail';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'ASSERTION FAILED:%' THEN RAISE; END IF;
  END;
END;
$$;

SELECT id::text AS admin_a FROM auth.users WHERE email = 'qa.admin.a@example.local' \gset
SELECT id::text AS cashier_a FROM auth.users WHERE email = 'qa.cashier.a@example.local' \gset
SELECT id::text AS doctor_a FROM auth.users WHERE email = 'qa.doctor.a@example.local' \gset
SELECT id::text AS notenant FROM auth.users WHERE email = 'qa.notenant@example.local' \gset
SELECT id::text AS admin_b FROM auth.users WHERE email = 'qa.admin.b@example.local' \gset

\set tenant_a '11111111-1111-1111-1111-111111111111'
\set tenant_b '22222222-2222-2222-2222-222222222222'
\set patient_a 'd2300000-0000-4000-8000-000000000001'
\set patient_a2 'd2300000-0000-4000-8000-000000000002'
\set patient_b 'd2300000-0000-4000-8000-000000000003'
\set invoice_a 'd2310000-0000-4000-8000-000000000001'
\set item_a 'd2320000-0000-4000-8000-000000000001'

INSERT INTO public.patients (id, tenant_id, full_name, phone, source, balance)
VALUES
  (:'patient_a', :'tenant_a', 'Patient Credit Intake A', '+77002300001', 'phone', 321),
  (:'patient_a2', :'tenant_a', 'Patient Credit Intake A2', '+77002300002', 'phone', 654),
  (:'patient_b', :'tenant_b', 'Patient Credit Intake B', '+77002300003', 'phone', 987);

INSERT INTO public.invoices (
  id, tenant_id, patient_id, invoice_number, status, currency,
  issue_date, issued_at, subtotal_amount, total_amount, balance_amount,
  created_by, issued_by, metadata
) VALUES (
  :'invoice_a', :'tenant_a', :'patient_a', 'PCI-001', 'issued', 'KZT',
  now(), now(), 1000, 1000, 1000, :'admin_a', :'admin_a', '{"marker":"patient-credit-intake"}'
);

INSERT INTO public.invoice_items (
  id, tenant_id, invoice_id, patient_id, service_name, quantity,
  unit_price, total_amount, status, created_by, metadata
) VALUES (
  :'item_a', :'tenant_a', :'invoice_a', :'patient_a', 'Compatibility service', 1,
  1000, 1000, 'active', :'admin_a', '{"marker":"patient-credit-intake"}'
);

SELECT pg_temp.assert_true(
  NOT has_function_privilege(
    'authenticated',
    'public.record_payment(uuid,uuid,numeric,text,text,timestamptz,text,text,text,jsonb)',
    'EXECUTE'
  ),
  'legacy record_payment must not remain callable by application users'
);
SELECT pg_temp.assert_true(
  has_function_privilege(
    'authenticated',
    'public.record_patient_credit_payment(uuid,uuid,numeric,text,text,timestamptz,text,text,text,text,jsonb)',
    'EXECUTE'
  ),
  'hardened patient-credit intake must be callable by authenticated users'
);
SELECT pg_temp.assert_true(
  has_function_privilege(
    'authenticated',
    'public.get_patient_credit_payment_operation(uuid,uuid,text)',
    'EXECUTE'
  ),
  'recovery lookup must be callable by authenticated users'
);
SELECT pg_temp.assert_true(
  NOT has_table_privilege('authenticated', 'public.payments', 'INSERT'),
  'authenticated users must not insert payments directly'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'cashier_a', true);

WITH result AS (
  SELECT public.record_patient_credit_payment(
    :'tenant_a', :'patient_a', 100000, 'cash', 'kzt', NULL,
    ' CREDIT-100K ', ' Patient A ', ' Advance payment ',
    'patient-credit-success-key', '{"source":"sql-test"}'::jsonb
  ) AS payload
)
SELECT
  payload->>'status' AS first_status,
  payload->>'operation_id' AS first_operation_id,
  payload#>>'{payment,id}' AS first_payment_id,
  payload#>>'{payment,currency}' AS first_currency,
  payload#>>'{payment,status}' AS first_payment_status,
  payload#>>'{capacity,availableCreditAmount}' AS first_available_credit
FROM result \gset

SELECT pg_temp.assert_true(:'first_status' = 'completed', 'first intake must complete');
SELECT pg_temp.assert_true(:'first_operation_id' = 'patient-credit-success-key', 'operation key must be normalized and returned');
SELECT pg_temp.assert_true(:'first_currency' = 'KZT', 'currency must normalize to KZT');
SELECT pg_temp.assert_true(:'first_payment_status' = 'received', 'unallocated payment must remain received');
SELECT pg_temp.assert_true(:'first_available_credit'::numeric = 100000, 'full payment must become available credit');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.payment_allocations WHERE payment_id=:'first_payment_id') = 0, 'intake must not allocate money');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.patient_fund_reservations WHERE payment_id=:'first_payment_id') = 0, 'intake must not create a deposit reservation');
SELECT pg_temp.assert_true((SELECT balance FROM public.patients WHERE id=:'patient_a') = 321, 'patients.balance must remain unchanged');

WITH summary AS (
  SELECT public.get_patient_finance_summary(:'tenant_a', :'patient_a') AS payload
)
SELECT
  payload#>>'{currencies,0,cashReceived}' AS summary_cash_received,
  payload#>>'{currencies,0,availableCreditAmount}' AS summary_available_credit,
  payload#>>'{currencies,0,reservedDepositAmount}' AS summary_reserved_deposit
FROM summary \gset
SELECT pg_temp.assert_true(:'summary_cash_received'::numeric = 100000, 'patient finance summary must include the new received money');
SELECT pg_temp.assert_true(:'summary_available_credit'::numeric = 100000, 'patient finance summary must expose the new available credit');
SELECT pg_temp.assert_true(:'summary_reserved_deposit'::numeric = 0, 'new money intake must not create a deposit reservation');

WITH retry AS (
  SELECT public.record_patient_credit_payment(
    :'tenant_a', :'patient_a', 100000, 'cash', 'KZT', NULL,
    'CREDIT-100K', 'Patient A', 'Advance payment',
    'patient-credit-success-key', '{"source":"sql-test"}'::jsonb
  ) AS payload
)
SELECT
  payload->>'status' AS retry_status,
  payload#>>'{payment,id}' AS retry_payment_id
FROM retry \gset

SELECT pg_temp.assert_true(:'retry_status' = 'already_completed', 'identical retry must return already_completed');
SELECT pg_temp.assert_true(:'retry_payment_id' = :'first_payment_id', 'identical retry must return the same payment');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.payments WHERE tenant_id=:'tenant_a' AND credit_intake_operation_key='patient-credit-success-key') = 1, 'identical retry must not duplicate money');

-- Audit rows are intentionally admin-visible, so inspect them outside the cashier RLS role.
RESET ROLE;
SELECT pg_temp.assert_true((SELECT count(*) FROM public.audit_events WHERE payment_id=:'first_payment_id' AND action='payment_recorded') = 1, 'success audit event must not duplicate on retry');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.activity_events WHERE metadata->>'paymentId'=:'first_payment_id' AND type='payment_recorded') = 1, 'success activity event must not duplicate on retry');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'cashier_a', true);

SELECT pg_temp.expect_error(
  format(
    $$SELECT public.record_patient_credit_payment(%L::uuid,%L::uuid,99999,'cash','KZT',NULL,'CREDIT-100K','Patient A','Advance payment','patient-credit-success-key','{"source":"sql-test"}'::jsonb)$$,
    :'tenant_a', :'patient_a'
  ),
  'PATIENT_CREDIT_IDEMPOTENCY_CONFLICT'
);
SELECT pg_temp.assert_true((SELECT count(*) FROM public.payments WHERE tenant_id=:'tenant_a' AND credit_intake_operation_key='patient-credit-success-key') = 1, 'conflicting retry must not insert another payment');

WITH recovered AS (
  SELECT public.get_patient_credit_payment_operation(:'tenant_a', :'patient_a', 'patient-credit-success-key') AS payload
)
SELECT
  payload->>'status' AS recovery_status,
  payload#>>'{payment,id}' AS recovery_payment_id,
  payload#>>'{capacity,availableCreditAmount}' AS recovery_available_credit
FROM recovered \gset
SELECT pg_temp.assert_true(:'recovery_status' = 'completed', 'recovery must find the committed operation');
SELECT pg_temp.assert_true(:'recovery_payment_id' = :'first_payment_id', 'recovery must return the same payment');
SELECT pg_temp.assert_true(:'recovery_available_credit'::numeric = 100000, 'recovery must return current credit capacity');

WITH missing AS (
  SELECT public.get_patient_credit_payment_operation(:'tenant_a', :'patient_a', 'patient-credit-missing-key') AS payload
)
SELECT payload->>'status' AS missing_status, payload->'payment' = 'null'::jsonb AS missing_payment_is_null FROM missing \gset
SELECT pg_temp.assert_true(:'missing_status' = 'not_found', 'unknown operation key must return not_found');
SELECT pg_temp.assert_true(:'missing_payment_is_null'::boolean, 'not_found recovery must not invent a payment');

SELECT pg_temp.expect_error(
  format(
    $$SELECT public.get_patient_credit_payment_operation(%L::uuid,%L::uuid,'patient-credit-success-key')$$,
    :'tenant_a', :'patient_a2'
  ),
  'PATIENT_CREDIT_PATIENT_MISMATCH'
);

WITH second_payment AS (
  SELECT public.record_patient_credit_payment(
    :'tenant_a', :'patient_a', 100000, 'cash', 'KZT', NULL,
    NULL, NULL, NULL, 'patient-credit-second-key', '{}'::jsonb
  ) AS payload
)
SELECT payload#>>'{payment,id}' AS second_payment_id FROM second_payment \gset
SELECT pg_temp.assert_true(:'second_payment_id' <> :'first_payment_id', 'different operation keys may intentionally create two payments');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.payments WHERE tenant_id=:'tenant_a' AND credit_intake_operation_key IN ('patient-credit-success-key','patient-credit-second-key')) = 2, 'different keys must create two payment facts');

WITH reservation AS (
  SELECT public.create_patient_fund_reservation(
    :'tenant_a', :'patient_a', :'first_payment_id', 30000,
    'general', 'Future treatment', NULL, NULL, NULL, NULL,
    '{"source":"sql-test"}'::jsonb, 'patient-credit-reservation-key'
  ) AS payload
)
SELECT
  payload#>>'{reservation,id}' AS reservation_id,
  payload#>>'{capacity,availableCreditAmount}' AS reserved_available_credit
FROM reservation \gset
SELECT pg_temp.assert_true(:'reserved_available_credit'::numeric = 70000, 'deposit reservation must reduce available credit from the new payment');

SELECT set_config('request.jwt.claim.sub', :'admin_a', true);
SELECT pg_temp.expect_any_error(
  format($$SELECT public.void_payment(%L::uuid,%L::uuid,'must remain reserved')$$, :'tenant_a', :'first_payment_id')
);

SELECT set_config('request.jwt.claim.sub', :'admin_a', true);
SELECT public.release_patient_fund_reservation(
  :'tenant_a', :'reservation_id', NULL, 'Reservation released for test', 'patient-credit-release-key'
);
SELECT pg_temp.assert_true(
  (SELECT available_credit_amount FROM public.get_payment_fund_capacity(:'tenant_a', :'patient_a', :'first_payment_id')) = 100000,
  'released reservation must restore available credit'
);

SELECT set_config('request.jwt.claim.sub', :'cashier_a', true);
SELECT (public.request_refund(
  :'tenant_a', :'first_payment_id', 10000, 'cash', 'Compatibility refund',
  'patient-credit-refund-key', '{"source":"sql-test"}'::jsonb
)).id::text AS refund_id \gset
SELECT pg_temp.assert_true(
  (SELECT available_credit_amount FROM public.get_payment_fund_capacity(:'tenant_a', :'patient_a', :'first_payment_id')) = 90000,
  'pending refund must reserve capacity from the new payment'
);

SELECT set_config('request.jwt.claim.sub', :'admin_a', true);
SELECT public.reject_refund(:'tenant_a', :'refund_id', 'Compatibility check complete');
SELECT pg_temp.assert_true(
  (SELECT available_credit_amount FROM public.get_payment_fund_capacity(:'tenant_a', :'patient_a', :'first_payment_id')) = 100000,
  'rejected refund must restore available credit'
);

SELECT set_config('request.jwt.claim.sub', :'doctor_a', true);
SELECT pg_temp.expect_error(
  format(
    $$SELECT public.record_patient_credit_payment(%L::uuid,%L::uuid,100,'cash','KZT',NULL,NULL,NULL,NULL,'patient-credit-doctor-key','{}'::jsonb)$$,
    :'tenant_a', :'patient_a'
  ),
  'Access denied'
);

SELECT set_config('request.jwt.claim.sub', :'notenant', true);
SELECT pg_temp.expect_error(
  format(
    $$SELECT public.record_patient_credit_payment(%L::uuid,%L::uuid,100,'cash','KZT',NULL,NULL,NULL,NULL,'patient-credit-no-tenant-key','{}'::jsonb)$$,
    :'tenant_a', :'patient_a'
  ),
  'Access denied'
);

SELECT set_config('request.jwt.claim.sub', :'cashier_a', true);
SELECT pg_temp.expect_error(
  format(
    $$SELECT public.record_patient_credit_payment(%L::uuid,%L::uuid,100,'cash','KZT',NULL,NULL,NULL,NULL,'patient-credit-cross-tenant-key','{}'::jsonb)$$,
    :'tenant_a', :'patient_b'
  ),
  'Patient not found in this tenant'
);
SELECT pg_temp.expect_error(
  format(
    $$SELECT public.record_patient_credit_payment(%L::uuid,%L::uuid,100,'cash','USD',NULL,NULL,NULL,NULL,'patient-credit-usd-key','{}'::jsonb)$$,
    :'tenant_a', :'patient_a'
  ),
  'KZT only'
);

-- Existing allocated cashier flow must still work even though direct legacy
-- record_payment execution is revoked from authenticated users.
WITH cashier_result AS (
  SELECT public.record_and_allocate_payment(
    :'tenant_a', :'patient_a', 1000, 'cash', 'KZT', NULL,
    'PCI-CASHIER', NULL, NULL, ARRAY[:'invoice_a'::uuid],
    'patient-credit-cashier-compat-key', '{"source":"sql-test"}'::jsonb
  ) AS payload
)
SELECT
  payload#>>'{payment,id}' AS cashier_payment_id,
  payload#>>'{payment,cashier_operation_key}' AS cashier_operation_key,
  payload#>'{payment,credit_intake_operation_key}' = 'null'::jsonb AS cashier_credit_operation_is_null,
  payload->>'allocated_amount' AS cashier_allocated_amount
FROM cashier_result \gset
SELECT pg_temp.assert_true(:'cashier_operation_key' = 'patient-credit-cashier-compat-key', 'allocated cashier flow must retain its operation key');
SELECT pg_temp.assert_true(:'cashier_credit_operation_is_null'::boolean, 'allocated cashier flow must not use patient-credit intake namespace');
SELECT pg_temp.assert_true(:'cashier_allocated_amount'::numeric = 1000, 'allocated cashier flow must remain fully allocated');

RESET ROLE;

SELECT pg_temp.assert_true((SELECT count(*) FROM public.invoices WHERE patient_id=:'patient_a' AND id<>:'invoice_a') = 0, 'patient-credit intake must not create invoices');
SELECT pg_temp.assert_true((SELECT balance FROM public.patients WHERE id=:'patient_a') = 321, 'all finance operations must leave patients.balance unchanged');

ROLLBACK;
\echo 'PATIENT CREDIT INTAKE HARDENING SQL VALIDATION PASSED'
