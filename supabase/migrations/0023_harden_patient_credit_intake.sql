-- 0023_harden_patient_credit_intake.sql
-- Idempotent, recoverable intake of new patient money that remains unallocated.
--
-- Domain boundary:
-- - payments remains the only fact that money was received;
-- - no invoice, allocation, reservation, clinical, schedule or patients.balance writes;
-- - existing record_and_allocate_payment remains unchanged and continues using the
--   legacy record_payment function internally;
-- - application callers must use record_patient_credit_payment.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS credit_intake_operation_key text,
  ADD COLUMN IF NOT EXISTS credit_intake_operation_fingerprint text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_tenant_credit_intake_operation_key
  ON public.payments (tenant_id, credit_intake_operation_key)
  WHERE credit_intake_operation_key IS NOT NULL;

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_credit_intake_operation_key_check;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_credit_intake_operation_key_check
  CHECK (
    (credit_intake_operation_key IS NULL AND credit_intake_operation_fingerprint IS NULL)
    OR (
      length(btrim(credit_intake_operation_key)) BETWEEN 1 AND 240
      AND length(btrim(credit_intake_operation_fingerprint)) > 0
    )
  );

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_single_intake_operation_namespace_check;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_single_intake_operation_namespace_check
  CHECK (NOT (
    cashier_operation_key IS NOT NULL
    AND credit_intake_operation_key IS NOT NULL
  ));

COMMENT ON COLUMN public.payments.credit_intake_operation_key
  IS 'Tenant-scoped idempotency key for intentional unallocated patient-credit intake.';
COMMENT ON COLUMN public.payments.credit_intake_operation_fingerprint
  IS 'Canonical request fingerprint used to reject materially different reuse of a patient-credit intake operation key.';

CREATE OR REPLACE FUNCTION public.patient_credit_payment_operation_result_internal(
  p_tenant_id uuid,
  p_payment_id uuid,
  p_status text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment public.payments;
  v_capacity record;
BEGIN
  SELECT * INTO v_payment
  FROM public.payments
  WHERE tenant_id = p_tenant_id
    AND id = p_payment_id;

  IF v_payment.id IS NULL THEN
    RAISE EXCEPTION 'Patient credit payment operation not found';
  END IF;

  SELECT * INTO v_capacity
  FROM public.get_payment_fund_capacity_internal(p_tenant_id, p_payment_id);

  RETURN jsonb_build_object(
    'status', p_status,
    'operation_id', v_payment.credit_intake_operation_key,
    'tenant_id', v_payment.tenant_id,
    'patient_id', v_payment.patient_id,
    'payment', to_jsonb(v_payment),
    'capacity', jsonb_build_object(
      'paymentId', v_payment.id,
      'patientId', v_payment.patient_id,
      'currency', v_payment.currency,
      'paymentAmount', v_capacity.payment_amount,
      'activeAllocatedAmount', v_capacity.active_allocated_amount,
      'completedRefundAmount', v_capacity.completed_refund_amount,
      'refundReservedAmount', v_capacity.refund_reserved_amount,
      'reservedDepositAmount', v_capacity.reserved_deposit_amount,
      'grossUnallocatedAmount', v_capacity.gross_unallocated_amount,
      'availableCreditAmount', v_capacity.available_credit_amount
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_patient_credit_payment(
  p_tenant_id uuid,
  p_patient_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_currency text DEFAULT 'KZT',
  p_received_at timestamptz DEFAULT NULL,
  p_external_reference text DEFAULT NULL,
  p_payer_name text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_operation_key text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_amount numeric(12,2);
  v_payment_method text;
  v_currency text;
  v_external_reference text;
  v_payer_name text;
  v_notes text;
  v_operation_key text;
  v_metadata jsonb;
  v_fingerprint text;
  v_existing public.payments;
  v_payment public.payments;
BEGIN
  PERFORM public.ensure_finance_write_role_internal(
    p_tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role, 'cashier'::public.app_role]
  );

  IF p_patient_id IS NULL THEN
    RAISE EXCEPTION 'Patient ID is required';
  END IF;

  v_amount := round(COALESCE(p_amount, 0)::numeric, 2)::numeric(12,2);
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be positive';
  END IF;

  v_payment_method := lower(btrim(COALESCE(p_payment_method, '')));
  IF v_payment_method NOT IN (
    'cash', 'kaspi', 'halyk_terminal', 'card', 'bank_transfer', 'insurance', 'osms', 'mixed', 'other'
  ) THEN
    RAISE EXCEPTION 'Unsupported payment method';
  END IF;

  v_currency := upper(btrim(COALESCE(p_currency, '')));
  IF v_currency <> 'KZT' THEN
    RAISE EXCEPTION 'Patient credit intake supports KZT only';
  END IF;

  v_operation_key := btrim(COALESCE(p_operation_key, ''));
  IF length(v_operation_key) = 0 THEN
    RAISE EXCEPTION 'Patient credit operation key is required';
  END IF;
  IF length(v_operation_key) > 240 THEN
    RAISE EXCEPTION 'Patient credit operation key is too long';
  END IF;

  v_external_reference := nullif(btrim(COALESCE(p_external_reference, '')), '');
  v_payer_name := nullif(btrim(COALESCE(p_payer_name, '')), '');
  v_notes := nullif(btrim(COALESCE(p_notes, '')), '');
  v_metadata := public.sanitize_finance_metadata_internal(p_metadata);

  IF NOT EXISTS (
    SELECT 1
    FROM public.patients
    WHERE tenant_id = p_tenant_id
      AND id = p_patient_id
  ) THEN
    RAISE EXCEPTION 'Patient not found in this tenant';
  END IF;

  v_fingerprint := md5(jsonb_build_object(
    'tenantId', p_tenant_id,
    'patientId', p_patient_id,
    'amount', v_amount,
    'paymentMethod', v_payment_method,
    'currency', v_currency,
    'receivedAt', p_received_at,
    'externalReference', v_external_reference,
    'payerName', v_payer_name,
    'notes', v_notes,
    'metadata', v_metadata
  )::text);

  -- Serialize same tenant/key before lookup or insert. Concurrent identical retries
  -- converge on one payment; a different payload under the same key is rejected.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('patient-credit-intake:' || p_tenant_id::text || ':' || v_operation_key, 0)
  );

  SELECT * INTO v_existing
  FROM public.payments
  WHERE tenant_id = p_tenant_id
    AND credit_intake_operation_key = v_operation_key;

  IF v_existing.id IS NOT NULL THEN
    IF v_existing.patient_id <> p_patient_id THEN
      RAISE EXCEPTION 'PATIENT_CREDIT_PATIENT_MISMATCH: operation key belongs to another patient';
    END IF;
    IF v_existing.credit_intake_operation_fingerprint <> v_fingerprint THEN
      RAISE EXCEPTION 'PATIENT_CREDIT_IDEMPOTENCY_CONFLICT: operation key was reused with different payment details';
    END IF;
    RETURN public.patient_credit_payment_operation_result_internal(
      p_tenant_id,
      v_existing.id,
      'already_completed'
    );
  END IF;

  v_metadata := jsonb_strip_nulls(v_metadata || jsonb_build_object(
    'source', 'patient_credit_intake',
    'patientCreditOperationKey', v_operation_key
  ));

  INSERT INTO public.payments (
    tenant_id,
    patient_id,
    status,
    payment_method,
    amount,
    currency,
    received_at,
    external_reference,
    payer_name,
    notes,
    metadata,
    received_by,
    credit_intake_operation_key,
    credit_intake_operation_fingerprint
  ) VALUES (
    p_tenant_id,
    p_patient_id,
    'received',
    v_payment_method,
    v_amount,
    v_currency,
    COALESCE(p_received_at, now()),
    v_external_reference,
    v_payer_name,
    v_notes,
    v_metadata,
    auth.uid(),
    v_operation_key,
    v_fingerprint
  ) RETURNING * INTO v_payment;

  PERFORM public.log_finance_event_internal(
    p_tenant_id,
    'payment_recorded',
    'payment',
    v_payment.id,
    v_payment.patient_id,
    v_payment.id,
    p_metadata => jsonb_build_object(
      'source', 'patient_credit_intake',
      'operationKey', v_operation_key,
      'paymentId', v_payment.id,
      'amount', v_payment.amount,
      'currency', v_payment.currency,
      'paymentMethod', v_payment.payment_method,
      'status', v_payment.status
    )
  );

  RETURN public.patient_credit_payment_operation_result_internal(
    p_tenant_id,
    v_payment.id,
    'completed'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_patient_credit_payment_operation(
  p_tenant_id uuid,
  p_patient_id uuid,
  p_operation_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_operation_key text := btrim(COALESCE(p_operation_key, ''));
  v_payment public.payments;
BEGIN
  PERFORM public.ensure_finance_write_role_internal(
    p_tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role, 'cashier'::public.app_role]
  );

  IF p_patient_id IS NULL THEN
    RAISE EXCEPTION 'Patient ID is required';
  END IF;
  IF length(v_operation_key) = 0 THEN
    RAISE EXCEPTION 'Patient credit operation key is required';
  END IF;
  IF length(v_operation_key) > 240 THEN
    RAISE EXCEPTION 'Patient credit operation key is too long';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.patients
    WHERE tenant_id = p_tenant_id
      AND id = p_patient_id
  ) THEN
    RAISE EXCEPTION 'Patient not found in this tenant';
  END IF;

  SELECT * INTO v_payment
  FROM public.payments
  WHERE tenant_id = p_tenant_id
    AND credit_intake_operation_key = v_operation_key;

  IF v_payment.id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'not_found',
      'operation_id', v_operation_key,
      'tenant_id', p_tenant_id,
      'patient_id', p_patient_id,
      'payment', NULL,
      'capacity', NULL
    );
  END IF;

  IF v_payment.patient_id <> p_patient_id THEN
    RAISE EXCEPTION 'PATIENT_CREDIT_PATIENT_MISMATCH: operation key belongs to another patient';
  END IF;

  RETURN public.patient_credit_payment_operation_result_internal(
    p_tenant_id,
    v_payment.id,
    'completed'
  );
END;
$$;

COMMENT ON FUNCTION public.record_patient_credit_payment(uuid, uuid, numeric, text, text, timestamptz, text, text, text, text, jsonb)
  IS 'Authoritative idempotent intake of received patient money that remains unallocated and becomes available patient credit.';
COMMENT ON FUNCTION public.get_patient_credit_payment_operation(uuid, uuid, text)
  IS 'Tenant- and patient-scoped recovery lookup for an unallocated patient-credit intake operation key.';
COMMENT ON FUNCTION public.record_payment(uuid, uuid, numeric, text, text, timestamptz, text, text, text, jsonb)
  IS 'Legacy internal payment insert used by record_and_allocate_payment. Application callers must use record_patient_credit_payment.';

REVOKE ALL ON FUNCTION public.patient_credit_payment_operation_result_internal(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_patient_credit_payment(uuid, uuid, numeric, text, text, timestamptz, text, text, text, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_patient_credit_payment_operation(uuid, uuid, text) FROM PUBLIC, anon;

-- Remove the unsafe direct application entry point while retaining the owner-only
-- function for the existing atomic cashier flow's internal call.
REVOKE ALL ON FUNCTION public.record_payment(uuid, uuid, numeric, text, text, timestamptz, text, text, text, jsonb) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.record_patient_credit_payment(uuid, uuid, numeric, text, text, timestamptz, text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_patient_credit_payment_operation(uuid, uuid, text) TO authenticated;
