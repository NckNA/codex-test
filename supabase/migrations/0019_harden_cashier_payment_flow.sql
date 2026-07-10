-- 0019_harden_cashier_payment_flow.sql
-- Atomic, idempotent cashier payment intake and allocation.
-- Payment remains distinct from treatment completion; no clinical or patients.balance writes.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS cashier_operation_key text,
  ADD COLUMN IF NOT EXISTS cashier_operation_fingerprint text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_tenant_cashier_operation_key
  ON public.payments (tenant_id, cashier_operation_key)
  WHERE cashier_operation_key IS NOT NULL;

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_cashier_operation_key_check;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_cashier_operation_key_check
  CHECK (
    (cashier_operation_key IS NULL AND cashier_operation_fingerprint IS NULL)
    OR (
      length(btrim(cashier_operation_key)) BETWEEN 1 AND 240
      AND length(btrim(cashier_operation_fingerprint)) > 0
    )
  );

COMMENT ON COLUMN public.payments.cashier_operation_key
  IS 'Tenant-scoped idempotency key for the atomic cashier record-and-allocate operation.';
COMMENT ON COLUMN public.payments.cashier_operation_fingerprint
  IS 'Canonical request fingerprint used to reject materially different reuse of a cashier operation key.';

CREATE OR REPLACE FUNCTION public.cashier_payment_operation_result_internal(
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
  v_allocations jsonb := '[]'::jsonb;
  v_allocated numeric(12,2) := 0;
  v_remaining_debt numeric(12,2) := 0;
  v_issued_invoice_ids jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_payment
  FROM public.payments
  WHERE tenant_id = p_tenant_id
    AND id = p_payment_id;

  IF v_payment.id IS NULL THEN
    RAISE EXCEPTION 'Cashier payment operation not found';
  END IF;

  SELECT
    COALESCE(jsonb_agg(to_jsonb(pa) ORDER BY pa.allocated_at, pa.id), '[]'::jsonb),
    COALESCE(sum(pa.amount), 0)::numeric(12,2)
  INTO v_allocations, v_allocated
  FROM public.payment_allocations pa
  WHERE pa.tenant_id = p_tenant_id
    AND pa.payment_id = p_payment_id
    AND pa.status = 'active';

  SELECT COALESCE(sum(i.balance_amount), 0)::numeric(12,2)
  INTO v_remaining_debt
  FROM public.invoices i
  WHERE i.tenant_id = p_tenant_id
    AND i.patient_id = v_payment.patient_id
    AND i.status IN ('issued', 'partially_paid');

  v_issued_invoice_ids := COALESCE(v_payment.metadata -> 'cashierIssuedInvoiceIds', '[]'::jsonb);

  RETURN jsonb_build_object(
    'status', p_status,
    'operation_id', v_payment.cashier_operation_key,
    'tenant_id', v_payment.tenant_id,
    'patient_id', v_payment.patient_id,
    'payment', to_jsonb(v_payment),
    'allocations', v_allocations,
    'issued_invoice_ids', v_issued_invoice_ids,
    'requested_amount', v_payment.amount,
    'allocated_amount', v_allocated,
    'unallocated_amount', GREATEST(0, v_payment.amount - v_allocated)::numeric(12,2),
    'remaining_patient_debt', v_remaining_debt
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_and_allocate_payment(
  p_tenant_id uuid,
  p_patient_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_currency text DEFAULT 'KZT',
  p_received_at timestamptz DEFAULT NULL,
  p_external_reference text DEFAULT NULL,
  p_payer_name text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_invoice_ids uuid[] DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_metadata jsonb;
  v_key text;
  v_currency text;
  v_amount numeric(12,2);
  v_fingerprint text;
  v_existing public.payments;
  v_payment public.payments;
  v_invoice public.invoices;
  v_invoice_id uuid;
  v_sorted_invoice_ids uuid[];
  v_issued_invoice_ids uuid[] := ARRAY[]::uuid[];
  v_total_selected_balance numeric(12,2) := 0;
  v_remaining numeric(12,2);
  v_allocate numeric(12,2);
  v_has_items boolean;
  v_has_writeoff_conflict boolean;
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

  IF p_payment_method IS NULL OR p_payment_method NOT IN (
    'cash', 'kaspi', 'halyk_terminal', 'card', 'bank_transfer', 'insurance', 'osms', 'mixed', 'other'
  ) THEN
    RAISE EXCEPTION 'Unsupported payment method';
  END IF;

  v_currency := upper(btrim(COALESCE(p_currency, '')));
  IF length(v_currency) = 0 THEN
    RAISE EXCEPTION 'Currency is required';
  END IF;

  v_metadata := public.sanitize_finance_metadata_internal(p_metadata);

  v_key := btrim(COALESCE(p_idempotency_key, ''));
  IF length(v_key) = 0 THEN
    RAISE EXCEPTION 'Cashier idempotency key is required';
  END IF;
  IF length(v_key) > 240 THEN
    RAISE EXCEPTION 'Cashier idempotency key is too long';
  END IF;

  IF p_invoice_ids IS NULL OR cardinality(p_invoice_ids) = 0 THEN
    RAISE EXCEPTION 'At least one invoice is required';
  END IF;
  IF array_position(p_invoice_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Invoice IDs cannot contain null';
  END IF;
  IF cardinality(p_invoice_ids) <> (SELECT count(DISTINCT x) FROM unnest(p_invoice_ids) AS x) THEN
    RAISE EXCEPTION 'Duplicate invoice IDs are not allowed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.patients
    WHERE tenant_id = p_tenant_id AND id = p_patient_id
  ) THEN
    RAISE EXCEPTION 'Patient not found in this tenant';
  END IF;

  v_fingerprint := md5(jsonb_build_object(
    'tenantId', p_tenant_id,
    'patientId', p_patient_id,
    'amount', v_amount,
    'paymentMethod', p_payment_method,
    'currency', v_currency,
    'receivedAt', p_received_at,
    'externalReference', nullif(btrim(COALESCE(p_external_reference, '')), ''),
    'payerName', nullif(btrim(COALESCE(p_payer_name, '')), ''),
    'notes', nullif(btrim(COALESCE(p_notes, '')), ''),
    'invoiceIds', to_jsonb(p_invoice_ids),
    'metadata', v_metadata
  )::text);

  -- Same tenant/key is serialized before lookup or insert, so concurrent retries converge.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':' || v_key, 0));

  SELECT * INTO v_existing
  FROM public.payments
  WHERE tenant_id = p_tenant_id
    AND cashier_operation_key = v_key;

  IF v_existing.id IS NOT NULL THEN
    IF v_existing.cashier_operation_fingerprint <> v_fingerprint THEN
      RAISE EXCEPTION 'CASHIER_IDEMPOTENCY_CONFLICT: operation key was reused with different payment details';
    END IF;
    RETURN public.cashier_payment_operation_result_internal(p_tenant_id, v_existing.id, 'already_completed');
  END IF;

  SELECT array_agg(x ORDER BY x)
  INTO v_sorted_invoice_ids
  FROM unnest(p_invoice_ids) AS x;

  -- Lock in stable UUID order to prevent deadlocks. Allocation still follows caller-selected order.
  FOREACH v_invoice_id IN ARRAY v_sorted_invoice_ids LOOP
    SELECT * INTO v_invoice
    FROM public.invoices
    WHERE tenant_id = p_tenant_id
      AND id = v_invoice_id
    FOR UPDATE;

    IF v_invoice.id IS NULL THEN
      RAISE EXCEPTION 'Invoice not found in this tenant';
    END IF;
    IF v_invoice.patient_id <> p_patient_id THEN
      RAISE EXCEPTION 'Invoice belongs to another patient';
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.financial_adjustments fa
      LEFT JOIN public.invoice_items ii
        ON ii.tenant_id = fa.tenant_id
       AND ii.id = fa.invoice_item_id
      WHERE fa.tenant_id = p_tenant_id
        AND fa.adjustment_type = 'write_off'
        AND fa.status IN ('active', 'approved')
        AND (fa.invoice_id = v_invoice_id OR ii.invoice_id = v_invoice_id)
    ) INTO v_has_writeoff_conflict;

    IF v_has_writeoff_conflict THEN
      RAISE EXCEPTION 'Invoice has an active or approved write-off';
    END IF;

    IF v_invoice.status = 'draft' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.invoice_items
        WHERE tenant_id = p_tenant_id
          AND invoice_id = v_invoice_id
          AND status IN ('active', 'adjusted')
      ) INTO v_has_items;
      IF NOT v_has_items THEN
        RAISE EXCEPTION 'Draft invoice must have at least one active item';
      END IF;
      PERFORM public.recalculate_invoice_financials_internal(v_invoice_id);
      v_invoice := public.issue_invoice(p_tenant_id, v_invoice_id);
      v_issued_invoice_ids := array_append(v_issued_invoice_ids, v_invoice_id);
    ELSIF v_invoice.status IN ('issued', 'partially_paid') THEN
      v_invoice := public.recalculate_invoice_financials_internal(v_invoice_id);
    ELSE
      RAISE EXCEPTION 'Invoice is not actionable for cashier payment';
    END IF;

    IF v_invoice.balance_amount <= 0 THEN
      RAISE EXCEPTION 'Invoice has no available balance';
    END IF;

    v_total_selected_balance := v_total_selected_balance + v_invoice.balance_amount;
  END LOOP;

  IF v_amount > v_total_selected_balance THEN
    RAISE EXCEPTION 'Payment amount exceeds selected invoice balance';
  END IF;

  v_metadata := jsonb_strip_nulls(v_metadata || jsonb_build_object(
    'source', 'cashier_payment_flow',
    'cashierOperationKey', v_key,
    'cashierInvoiceIds', to_jsonb(p_invoice_ids),
    'cashierIssuedInvoiceIds', to_jsonb(v_issued_invoice_ids)
  ));

  v_payment := public.record_payment(
    p_tenant_id,
    p_patient_id,
    v_amount,
    p_payment_method,
    v_currency,
    p_received_at,
    nullif(btrim(COALESCE(p_external_reference, '')), ''),
    nullif(btrim(COALESCE(p_payer_name, '')), ''),
    nullif(btrim(COALESCE(p_notes, '')), ''),
    v_metadata
  );

  UPDATE public.payments
  SET cashier_operation_key = v_key,
      cashier_operation_fingerprint = v_fingerprint
  WHERE tenant_id = p_tenant_id
    AND id = v_payment.id
  RETURNING * INTO v_payment;

  v_remaining := v_amount;
  FOREACH v_invoice_id IN ARRAY p_invoice_ids LOOP
    EXIT WHEN v_remaining <= 0;

    SELECT * INTO v_invoice
    FROM public.invoices
    WHERE tenant_id = p_tenant_id
      AND id = v_invoice_id
    FOR UPDATE;

    v_invoice := public.recalculate_invoice_financials_internal(v_invoice_id);
    v_allocate := LEAST(v_remaining, v_invoice.balance_amount)::numeric(12,2);

    IF v_allocate > 0 THEN
      PERFORM public.allocate_payment(
        p_tenant_id,
        v_payment.id,
        v_allocate,
        v_invoice_id,
        NULL,
        jsonb_build_object(
          'source', 'cashier_payment_flow',
          'cashierOperationKey', v_key
        )
      );
      v_remaining := (v_remaining - v_allocate)::numeric(12,2);
    END IF;
  END LOOP;

  IF v_remaining <> 0 THEN
    RAISE EXCEPTION 'CASHIER_OPERATION_FAILED: payment allocation did not consume the full payment amount';
  END IF;

  RETURN public.cashier_payment_operation_result_internal(p_tenant_id, v_payment.id, 'completed');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_cashier_payment_operation(
  p_tenant_id uuid,
  p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_key text := btrim(COALESCE(p_idempotency_key, ''));
  v_payment public.payments;
BEGIN
  PERFORM public.ensure_finance_write_role_internal(
    p_tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role, 'cashier'::public.app_role]
  );

  IF length(v_key) = 0 THEN
    RAISE EXCEPTION 'Cashier idempotency key is required';
  END IF;

  SELECT * INTO v_payment
  FROM public.payments
  WHERE tenant_id = p_tenant_id
    AND cashier_operation_key = v_key;

  IF v_payment.id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'not_found',
      'operation_id', v_key,
      'tenant_id', p_tenant_id,
      'patient_id', NULL,
      'payment', NULL,
      'allocations', '[]'::jsonb,
      'issued_invoice_ids', '[]'::jsonb,
      'requested_amount', 0,
      'allocated_amount', 0,
      'unallocated_amount', 0,
      'remaining_patient_debt', 0
    );
  END IF;

  RETURN public.cashier_payment_operation_result_internal(p_tenant_id, v_payment.id, 'completed');
END;
$$;

COMMENT ON FUNCTION public.record_and_allocate_payment(uuid, uuid, numeric, text, text, timestamptz, text, text, text, uuid[], text, jsonb)
  IS 'Atomic idempotent cashier operation: issue selected drafts, record exactly one payment, allocate in selected order, or roll back all writes.';
COMMENT ON FUNCTION public.get_cashier_payment_operation(uuid, text)
  IS 'Tenant-scoped reconciliation lookup for an atomic cashier payment operation key.';

REVOKE ALL ON FUNCTION public.cashier_payment_operation_result_internal(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_and_allocate_payment(uuid, uuid, numeric, text, text, timestamptz, text, text, text, uuid[], text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_cashier_payment_operation(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.record_and_allocate_payment(uuid, uuid, numeric, text, text, timestamptz, text, text, text, uuid[], text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cashier_payment_operation(uuid, text) TO authenticated;
