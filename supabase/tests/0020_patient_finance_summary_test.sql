\set ON_ERROR_STOP on
\echo 'FINANCE-SUMMARY-CORRECTNESS-001 local SQL validation'
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

SELECT id::text AS admin_a FROM auth.users WHERE email='qa.admin.a@example.local' \gset
SELECT id::text AS cashier_a FROM auth.users WHERE email='qa.cashier.a@example.local' \gset
SELECT id::text AS doctor_a FROM auth.users WHERE email='qa.doctor.a@example.local' \gset
SELECT id::text AS registrar_a FROM auth.users WHERE email='qa.receptionist.a@example.local' \gset
SELECT id::text AS notenant FROM auth.users WHERE email='qa.notenant@example.local' \gset
SELECT id::text AS admin_b FROM auth.users WHERE email='qa.admin.b@example.local' \gset
\set tenant_a '11111111-1111-1111-1111-111111111111'
\set tenant_b '22222222-2222-2222-2222-222222222222'
\set patient_empty 'a9200000-0000-4000-8000-000000000001'
\set patient_core 'a9200000-0000-4000-8000-000000000002'
\set patient_250 'a9200000-0000-4000-8000-000000000003'
\set patient_1000 'a9200000-0000-4000-8000-000000000004'
\set patient_anomaly 'a9200000-0000-4000-8000-000000000005'
\set patient_b 'b9200000-0000-4000-8000-000000000001'
\set invoice_core 'a9210000-0000-4000-8000-000000000001'
\set invoice_draft 'a9210000-0000-4000-8000-000000000002'
\set invoice_anomaly 'a9210000-0000-4000-8000-000000000003'
\set payment_core 'a9220000-0000-4000-8000-000000000001'
\set payment_usd 'a9220000-0000-4000-8000-000000000002'
\set payment_anomaly 'a9220000-0000-4000-8000-000000000003'

INSERT INTO public.patients(id,tenant_id,full_name,phone,source,balance) VALUES
(:'patient_empty',:'tenant_a','Summary Empty','+77009200001','phone',17),
(:'patient_core',:'tenant_a','Summary Core','+77009200002','phone',18),
(:'patient_250',:'tenant_a','Summary 250','+77009200003','phone',19),
(:'patient_1000',:'tenant_a','Summary 1000','+77009200004','phone',20),
(:'patient_anomaly',:'tenant_a','Summary Anomaly','+77009200005','phone',21),
(:'patient_b',:'tenant_b','Summary Tenant B','+77009200006','phone',22);

INSERT INTO public.invoices(id,tenant_id,patient_id,invoice_number,status,currency,subtotal_amount,total_amount,paid_amount,written_off_amount,balance_amount,issued_at,issue_date,issued_by)
VALUES
(:'invoice_core',:'tenant_a',:'patient_core','SUM-CORE','issued','KZT',1000,1000,0,400,600,now(),now(),:'admin_a'),
(:'invoice_draft',:'tenant_a',:'patient_core','SUM-DRAFT','draft','KZT',9999,9999,0,0,9999,NULL,NULL,NULL),
(:'invoice_anomaly',:'tenant_a',:'patient_anomaly','SUM-ANOM','issued','KZT',1000,1000,0,0,1000,now(),now(),:'admin_a');

INSERT INTO public.financial_adjustments(tenant_id,patient_id,invoice_id,adjustment_type,status,amount,currency,reason,approved_by,approved_at)
VALUES(:'tenant_a',:'patient_core',:'invoice_core','write_off','approved',400,'KZT','SQL summary fixture',:'admin_a',now());

INSERT INTO public.payments(id,tenant_id,patient_id,status,payment_method,amount,currency,received_at,received_by) VALUES
(:'payment_core',:'tenant_a',:'patient_core','partially_refunded','cash',1000,'KZT',now(),:'cashier_a'),
(:'payment_usd',:'tenant_a',:'patient_core','received','card',50,'USD',now(),:'cashier_a'),
(:'payment_anomaly',:'tenant_a',:'patient_anomaly','received','cash',100,'KZT',now(),:'cashier_a');

INSERT INTO public.refunds(tenant_id,patient_id,payment_id,status,refund_method,amount,currency,reason,requested_by,approved_by,completed_by,approved_at,completed_at)
VALUES(:'tenant_a',:'patient_core',:'payment_core','completed','cash',200,'KZT','Completed fixture',:'admin_a',:'admin_a',:'admin_a',now(),now());
INSERT INTO public.refunds(tenant_id,patient_id,payment_id,status,refund_method,amount,currency,reason,requested_by)
VALUES(:'tenant_a',:'patient_core',:'payment_core','pending','cash',100,'KZT','Reserved fixture',:'admin_a');

INSERT INTO public.payments(tenant_id,patient_id,status,payment_method,amount,currency,received_at,received_by)
SELECT :'tenant_a',:'patient_250','received','cash',1,'KZT',now(),:'cashier_a' FROM generate_series(1,250);
INSERT INTO public.payments(tenant_id,patient_id,status,payment_method,amount,currency,received_at,received_by)
SELECT :'tenant_a',:'patient_1000','received','cash',1,'KZT',now(),:'cashier_a' FROM generate_series(1,1000);

ALTER TABLE public.payment_allocations DISABLE TRIGGER payment_allocations_capacity_guard;
INSERT INTO public.payment_allocations(tenant_id,patient_id,payment_id,invoice_id,amount,currency,status,created_by)
VALUES(:'tenant_a',:'patient_anomaly',:'payment_anomaly',:'invoice_anomaly',150,'KZT','active',:'admin_a');
ALTER TABLE public.payment_allocations ENABLE TRIGGER payment_allocations_capacity_guard;
INSERT INTO public.refunds(tenant_id,patient_id,payment_id,status,refund_method,amount,currency,reason,requested_by,approved_by,approved_at)
VALUES(:'tenant_a',:'patient_anomaly',:'payment_anomaly','approved','cash',20,'KZT','Over reserve anomaly',:'admin_a',:'admin_a',now());

INSERT INTO public.financial_adjustments(tenant_id,patient_id,invoice_id,adjustment_type,status,amount,currency,reason,approved_by,approved_at)
VALUES(:'tenant_a',:'patient_anomaly',:'invoice_anomaly','write_off','approved',10,'KZT','Write-off mismatch anomaly',:'admin_a',now());

SELECT count(*)::text AS services_before FROM public.completed_services WHERE patient_id=:'patient_core' \gset
SELECT count(*)::text AS appointments_before FROM public.appointments WHERE patient_id=:'patient_core' \gset
SELECT count(*)::text AS documents_before FROM public.documents WHERE patient_id=:'patient_core' \gset
SELECT balance::text AS balance_before FROM public.patients WHERE id=:'patient_core' \gset
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'admin_a', true);

SELECT public.get_patient_finance_summary(:'tenant_a',:'patient_empty')::text AS empty_summary \gset
SELECT pg_temp.assert_true(jsonb_array_length(:'empty_summary'::jsonb->'currencies')=0,'empty patient must have no currency buckets');
SELECT pg_temp.assert_true((:'empty_summary'::jsonb->>'factComplete')::boolean,'empty summary must be complete');
SELECT pg_temp.assert_true(:'empty_summary'::jsonb->>'modelVersion'='finance-summary-v1','model version must be stable');
SELECT pg_temp.assert_true((:'empty_summary'::jsonb->>'asOf') IS NOT NULL,'asOf must be present');

SELECT public.get_patient_finance_summary(:'tenant_a',:'patient_core')::text AS core_summary \gset
SELECT pg_temp.assert_true(jsonb_array_length(:'core_summary'::jsonb->'currencies')=2,'currencies must remain separate');
SELECT pg_temp.assert_true((SELECT (x->>'totalInvoiced')::numeric FROM jsonb_array_elements(:'core_summary'::jsonb->'currencies') x WHERE x->>'currency'='KZT')=1000,'draft invoice must be excluded');
SELECT pg_temp.assert_true((SELECT (x->>'currentDebt')::numeric FROM jsonb_array_elements(:'core_summary'::jsonb->'currencies') x WHERE x->>'currency'='KZT')=600,'current debt must use issued balance only');
SELECT pg_temp.assert_true((SELECT (x->>'approvedWriteOffAmount')::numeric FROM jsonb_array_elements(:'core_summary'::jsonb->'currencies') x WHERE x->>'currency'='KZT')=400,'approved write-off must be reported');
SELECT pg_temp.assert_true((SELECT (x->>'cashReceived')::numeric FROM jsonb_array_elements(:'core_summary'::jsonb->'currencies') x WHERE x->>'currency'='KZT')=1000,'cash received must be complete');
SELECT pg_temp.assert_true((SELECT (x->>'completedRefundAmount')::numeric FROM jsonb_array_elements(:'core_summary'::jsonb->'currencies') x WHERE x->>'currency'='KZT')=200,'completed refund must be reported');
SELECT pg_temp.assert_true((SELECT (x->>'grossUnallocatedAmount')::numeric FROM jsonb_array_elements(:'core_summary'::jsonb->'currencies') x WHERE x->>'currency'='KZT')=800,'completed refund must reduce unallocated funds');
SELECT pg_temp.assert_true((SELECT (x->>'refundReservedAmount')::numeric FROM jsonb_array_elements(:'core_summary'::jsonb->'currencies') x WHERE x->>'currency'='KZT')=100,'pending refund must reserve capacity');
SELECT pg_temp.assert_true((SELECT (x->>'availableCreditAmount')::numeric FROM jsonb_array_elements(:'core_summary'::jsonb->'currencies') x WHERE x->>'currency'='KZT')=700,'available credit must subtract refund reservation');
SELECT pg_temp.assert_true((SELECT (x->>'netPositionAmount')::numeric FROM jsonb_array_elements(:'core_summary'::jsonb->'currencies') x WHERE x->>'currency'='KZT')=100,'net position must be credit minus debt');
SELECT pg_temp.assert_true((SELECT (x->>'cashReceived')::numeric FROM jsonb_array_elements(:'core_summary'::jsonb->'currencies') x WHERE x->>'currency'='USD')=50,'USD must not be added to KZT');
SELECT pg_temp.assert_true(EXISTS(SELECT 1 FROM jsonb_array_elements(:'core_summary'::jsonb->'warnings') w WHERE w->>'code'='MULTIPLE_CURRENCIES'),'multiple currency warning required');

SELECT public.get_patient_finance_summary(:'tenant_a',:'patient_250')::text AS summary_250 \gset
SELECT pg_temp.assert_true((SELECT (x->>'cashReceived')::numeric FROM jsonb_array_elements(:'summary_250'::jsonb->'currencies') x WHERE x->>'currency'='KZT')=250,'250 rows must not be truncated');
SELECT pg_temp.assert_true((SELECT (x->>'availableCreditAmount')::numeric FROM jsonb_array_elements(:'summary_250'::jsonb->'currencies') x WHERE x->>'currency'='KZT')=250,'250 credit rows must be complete');
SELECT public.get_patient_finance_summary(:'tenant_a',:'patient_1000')::text AS summary_1000 \gset
SELECT pg_temp.assert_true((SELECT (x->>'cashReceived')::numeric FROM jsonb_array_elements(:'summary_1000'::jsonb->'currencies') x WHERE x->>'currency'='KZT')=1000,'1000 rows must not be truncated');
SELECT pg_temp.assert_true((SELECT (x->>'availableCreditAmount')::numeric FROM jsonb_array_elements(:'summary_1000'::jsonb->'currencies') x WHERE x->>'currency'='KZT')=1000,'1000 credit rows must be complete');

SELECT public.get_patient_finance_summary(:'tenant_a',:'patient_anomaly')::text AS anomaly_summary \gset
SELECT pg_temp.assert_true(EXISTS(SELECT 1 FROM jsonb_array_elements(:'anomaly_summary'::jsonb->'warnings') w WHERE w->>'code'='PAYMENT_OVERCONSUMED'),'overconsumed payment warning required');
SELECT pg_temp.assert_true(EXISTS(SELECT 1 FROM jsonb_array_elements(:'anomaly_summary'::jsonb->'warnings') w WHERE w->>'code'='REFUND_RESERVATION_EXCEEDS_CAPACITY'),'refund reservation warning required');
SELECT pg_temp.assert_true(EXISTS(SELECT 1 FROM jsonb_array_elements(:'anomaly_summary'::jsonb->'warnings') w WHERE w->>'code'='PAYMENT_STATUS_MISMATCH'),'payment status warning required');
SELECT pg_temp.assert_true(EXISTS(SELECT 1 FROM jsonb_array_elements(:'anomaly_summary'::jsonb->'warnings') w WHERE w->>'code'='INVOICE_PAID_MISMATCH'),'invoice paid warning required');
SELECT pg_temp.assert_true(EXISTS(SELECT 1 FROM jsonb_array_elements(:'anomaly_summary'::jsonb->'warnings') w WHERE w->>'code'='INVOICE_WRITEOFF_MISMATCH'),'invoice write-off warning required');
SELECT pg_temp.assert_true(EXISTS(SELECT 1 FROM jsonb_array_elements(:'anomaly_summary'::jsonb->'warnings') w WHERE w->>'code'='INVOICE_STATUS_MISMATCH'),'invoice status warning required');
SELECT pg_temp.assert_true((:'anomaly_summary'::jsonb::text) NOT LIKE '%metadata%','summary must not expose raw metadata');

SELECT set_config('request.jwt.claim.sub', :'cashier_a', true);
SELECT pg_temp.assert_true((public.get_patient_finance_summary(:'tenant_a',:'patient_core')->>'factComplete')::boolean,'cashier can read');
SELECT set_config('request.jwt.claim.sub', :'doctor_a', true);
SELECT pg_temp.assert_true((public.get_patient_finance_summary(:'tenant_a',:'patient_core')->>'factComplete')::boolean,'doctor can read');
SELECT set_config('request.jwt.claim.sub', :'registrar_a', true);
SELECT pg_temp.assert_true((public.get_patient_finance_summary(:'tenant_a',:'patient_core')->>'factComplete')::boolean,'registrar can read');
SELECT set_config('request.jwt.claim.sub', :'notenant', true);
SELECT pg_temp.expect_error(format('select public.get_patient_finance_summary(%L::uuid,%L::uuid)',:'tenant_a',:'patient_core'),'Insufficient finance permissions');
SELECT set_config('request.jwt.claim.sub', :'admin_b', true);
SELECT pg_temp.expect_error(format('select public.get_patient_finance_summary(%L::uuid,%L::uuid)',:'tenant_a',:'patient_core'),'Insufficient finance permissions');
SELECT pg_temp.expect_error(format('select public.get_patient_finance_summary(%L::uuid,%L::uuid)',:'tenant_b',:'patient_core'),'Patient not found in this tenant');

RESET ROLE;
SET LOCAL ROLE anon;
SELECT pg_temp.expect_error(format('select public.get_patient_finance_summary(%L::uuid,%L::uuid)',:'tenant_a',:'patient_core'),'permission denied');
RESET ROLE;

SELECT pg_temp.assert_true((SELECT count(*) FROM public.completed_services WHERE patient_id=:'patient_core')=:'services_before'::integer,'summary must not mutate clinical services');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.appointments WHERE patient_id=:'patient_core')=:'appointments_before'::integer,'summary must not mutate appointments');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.documents WHERE patient_id=:'patient_core')=:'documents_before'::integer,'summary must not mutate documents');
SELECT pg_temp.assert_true((SELECT balance FROM public.patients WHERE id=:'patient_core')=:'balance_before'::numeric,'summary must not mutate patients.balance');

ROLLBACK;
\echo 'FINANCE-SUMMARY-CORRECTNESS-001 SQL validation passed'
