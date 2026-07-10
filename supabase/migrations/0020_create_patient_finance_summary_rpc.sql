-- 0020_create_patient_finance_summary_rpc.sql
-- Complete, server-authoritative, per-currency patient finance snapshot.

CREATE INDEX IF NOT EXISTS idx_payment_allocations_summary_active
  ON public.payment_allocations (tenant_id, patient_id, payment_id)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_refunds_summary_capacity
  ON public.refunds (tenant_id, patient_id, payment_id, status)
  WHERE status IN ('pending', 'approved', 'completed');
CREATE INDEX IF NOT EXISTS idx_adjustments_summary_writeoff
  ON public.financial_adjustments (tenant_id, patient_id, invoice_id)
  WHERE adjustment_type = 'write_off' AND status = 'approved';

CREATE OR REPLACE FUNCTION public.get_patient_finance_summary(
  p_tenant_id uuid,
  p_patient_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_as_of timestamptz := statement_timestamp();
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_tenant_id IS NULL OR p_patient_id IS NULL THEN
    RAISE EXCEPTION 'Tenant and patient are required';
  END IF;
  IF NOT public.has_tenant_role(
    p_tenant_id,
    ARRAY[
      'clinic_owner'::public.app_role,
      'clinic_admin'::public.app_role,
      'cashier'::public.app_role,
      'registrar'::public.app_role,
      'doctor'::public.app_role
    ]
  ) THEN
    RAISE EXCEPTION 'Insufficient finance permissions';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.patients
    WHERE tenant_id = p_tenant_id AND id = p_patient_id
  ) THEN
    RAISE EXCEPTION 'Patient not found in this tenant';
  END IF;

  WITH valid_invoices AS (
    SELECT i.*, upper(btrim(i.currency)) AS summary_currency
    FROM public.invoices i
    WHERE i.tenant_id = p_tenant_id
      AND i.patient_id = p_patient_id
      AND i.status IN ('issued', 'partially_paid', 'paid', 'written_off')
  ),
  valid_payments AS (
    SELECT p.*, upper(btrim(p.currency)) AS summary_currency
    FROM public.payments p
    WHERE p.tenant_id = p_tenant_id
      AND p.patient_id = p_patient_id
      AND p.status NOT IN ('voided', 'archived')
  ),
  allocation_links AS (
    SELECT pa.id, pa.payment_id,
      COALESCE(pa.invoice_id, ii.invoice_id) AS invoice_id,
      pa.amount,
      vp.summary_currency
    FROM public.payment_allocations pa
    JOIN valid_payments vp
      ON vp.id = pa.payment_id
     AND vp.tenant_id = pa.tenant_id
     AND vp.patient_id = pa.patient_id
    LEFT JOIN public.invoice_items ii
      ON ii.id = pa.invoice_item_id
     AND ii.tenant_id = pa.tenant_id
     AND ii.patient_id = pa.patient_id
     AND ii.status IN ('active', 'adjusted')
    JOIN valid_invoices vi
      ON vi.id = COALESCE(pa.invoice_id, ii.invoice_id)
     AND vi.tenant_id = pa.tenant_id
     AND vi.patient_id = pa.patient_id
    WHERE pa.tenant_id = p_tenant_id
      AND pa.patient_id = p_patient_id
      AND pa.status = 'active'
  ),
  payment_allocations AS (
    SELECT payment_id, COALESCE(sum(amount), 0)::numeric(18,2) AS allocated_amount
    FROM allocation_links GROUP BY payment_id
  ),
  invoice_allocations AS (
    SELECT invoice_id, COALESCE(sum(amount), 0)::numeric(18,2) AS allocated_amount
    FROM allocation_links GROUP BY invoice_id
  ),
  completed_refunds AS (
    SELECT r.payment_id, COALESCE(sum(r.amount), 0)::numeric(18,2) AS completed_amount
    FROM public.refunds r
    JOIN valid_payments vp ON vp.id = r.payment_id
    WHERE r.tenant_id = p_tenant_id
      AND r.patient_id = p_patient_id
      AND r.status = 'completed'
    GROUP BY r.payment_id
  ),
  reserved_refunds AS (
    SELECT r.payment_id, COALESCE(sum(r.amount), 0)::numeric(18,2) AS reserved_amount
    FROM public.refunds r
    JOIN valid_payments vp ON vp.id = r.payment_id
    WHERE r.tenant_id = p_tenant_id
      AND r.patient_id = p_patient_id
      AND r.status IN ('pending', 'approved')
    GROUP BY r.payment_id
  ),
  approved_writeoffs AS (
    SELECT fa.invoice_id, COALESCE(sum(fa.amount), 0)::numeric(18,2) AS writeoff_amount
    FROM public.financial_adjustments fa
    JOIN valid_invoices vi ON vi.id = fa.invoice_id
    WHERE fa.tenant_id = p_tenant_id
      AND fa.patient_id = p_patient_id
      AND fa.adjustment_type = 'write_off'
      AND fa.status = 'approved'
    GROUP BY fa.invoice_id
  ),
  payment_facts AS (
    SELECT vp.id, vp.status, vp.amount::numeric(18,2) AS amount,
      vp.received_at, vp.summary_currency,
      COALESCE(pa.allocated_amount, 0)::numeric(18,2) AS allocated_amount,
      COALESCE(cr.completed_amount, 0)::numeric(18,2) AS completed_amount,
      COALESCE(rr.reserved_amount, 0)::numeric(18,2) AS reserved_amount,
      GREATEST(0, vp.amount - COALESCE(pa.allocated_amount, 0) - COALESCE(cr.completed_amount, 0))::numeric(18,2) AS gross_unallocated,
      GREATEST(0, vp.amount - COALESCE(pa.allocated_amount, 0) - COALESCE(cr.completed_amount, 0) - COALESCE(rr.reserved_amount, 0))::numeric(18,2) AS available_credit,
      CASE
        WHEN COALESCE(cr.completed_amount, 0) >= vp.amount THEN 'refunded'
        WHEN COALESCE(cr.completed_amount, 0) > 0 THEN 'partially_refunded'
        WHEN COALESCE(pa.allocated_amount, 0) >= vp.amount THEN 'allocated'
        WHEN COALESCE(pa.allocated_amount, 0) > 0 THEN 'partially_allocated'
        ELSE 'received'
      END AS expected_status
    FROM valid_payments vp
    LEFT JOIN payment_allocations pa ON pa.payment_id = vp.id
    LEFT JOIN completed_refunds cr ON cr.payment_id = vp.id
    LEFT JOIN reserved_refunds rr ON rr.payment_id = vp.id
  ),
  invoice_facts AS (
    SELECT vi.id, vi.status, vi.summary_currency,
      vi.total_amount::numeric(18,2) AS total_amount,
      vi.paid_amount::numeric(18,2) AS stored_paid_amount,
      vi.written_off_amount::numeric(18,2) AS stored_writeoff_amount,
      vi.balance_amount::numeric(18,2) AS balance_amount,
      COALESCE(ia.allocated_amount, 0)::numeric(18,2) AS allocated_amount,
      COALESCE(aw.writeoff_amount, 0)::numeric(18,2) AS approved_writeoff_amount,
      CASE
        WHEN vi.balance_amount <= 0 AND COALESCE(aw.writeoff_amount, 0) > 0 THEN 'written_off'
        WHEN vi.balance_amount <= 0 THEN 'paid'
        WHEN COALESCE(ia.allocated_amount, 0) > 0 THEN 'partially_paid'
        ELSE 'issued'
      END AS expected_status
    FROM valid_invoices vi
    LEFT JOIN invoice_allocations ia ON ia.invoice_id = vi.id
    LEFT JOIN approved_writeoffs aw ON aw.invoice_id = vi.id
  ),
  currency_keys AS (
    SELECT summary_currency AS currency FROM invoice_facts
    UNION
    SELECT summary_currency AS currency FROM payment_facts
  ),
  bucket_rows AS (
    SELECT ck.currency,
      COALESCE((SELECT sum(total_amount) FROM invoice_facts i WHERE i.summary_currency = ck.currency), 0)::numeric(18,2) AS total_invoiced,
      COALESCE((SELECT sum(allocated_amount) FROM payment_facts p WHERE p.summary_currency = ck.currency), 0)::numeric(18,2) AS active_allocated,
      COALESCE((SELECT sum(amount) FROM payment_facts p WHERE p.summary_currency = ck.currency), 0)::numeric(18,2) AS cash_received,
      COALESCE((SELECT sum(completed_amount) FROM payment_facts p WHERE p.summary_currency = ck.currency), 0)::numeric(18,2) AS completed_refunds,
      COALESCE((SELECT sum(approved_writeoff_amount) FROM invoice_facts i WHERE i.summary_currency = ck.currency), 0)::numeric(18,2) AS approved_writeoffs,
      COALESCE((SELECT sum(GREATEST(0, balance_amount)) FROM invoice_facts i WHERE i.summary_currency = ck.currency), 0)::numeric(18,2) AS current_debt,
      COALESCE((SELECT sum(gross_unallocated) FROM payment_facts p WHERE p.summary_currency = ck.currency), 0)::numeric(18,2) AS gross_unallocated,
      COALESCE((SELECT sum(reserved_amount) FROM payment_facts p WHERE p.summary_currency = ck.currency), 0)::numeric(18,2) AS refund_reserved,
      COALESCE((SELECT sum(available_credit) FROM payment_facts p WHERE p.summary_currency = ck.currency), 0)::numeric(18,2) AS available_credit,
      COALESCE((SELECT count(*) FROM invoice_facts i WHERE i.summary_currency = ck.currency AND i.balance_amount > 0), 0)::integer AS open_invoice_count,
      COALESCE((SELECT count(*) FROM invoice_facts i WHERE i.summary_currency = ck.currency AND i.balance_amount > 0), 0)::integer AS unpaid_invoice_count,
      COALESCE((SELECT count(*) FROM invoice_facts i WHERE i.summary_currency = ck.currency AND i.status = 'partially_paid'), 0)::integer AS partially_paid_count,
      (SELECT max(received_at) FROM payment_facts p WHERE p.summary_currency = ck.currency) AS last_payment_at
    FROM currency_keys ck
  ),
  warning_rows AS (
    SELECT jsonb_build_object(
      'code', 'PAYMENT_OVERCONSUMED', 'currency', summary_currency,
      'entityType', 'payment', 'entityId', id,
      'details', jsonb_build_object('paymentAmount', amount, 'allocatedAmount', allocated_amount, 'completedRefundAmount', completed_amount)
    ) AS warning
    FROM payment_facts WHERE allocated_amount + completed_amount > amount
    UNION ALL
    SELECT jsonb_build_object(
      'code', 'REFUND_RESERVATION_EXCEEDS_CAPACITY', 'currency', summary_currency,
      'entityType', 'payment', 'entityId', id,
      'details', jsonb_build_object('reservedRefundAmount', reserved_amount, 'availableBeforeReservation', GREATEST(0, amount - allocated_amount - completed_amount))
    )
    FROM payment_facts WHERE reserved_amount > GREATEST(0, amount - allocated_amount - completed_amount)
    UNION ALL
    SELECT jsonb_build_object(
      'code', 'PAYMENT_STATUS_MISMATCH', 'currency', summary_currency,
      'entityType', 'payment', 'entityId', id,
      'details', jsonb_build_object('actualStatus', status, 'expectedStatus', expected_status)
    )
    FROM payment_facts WHERE status <> expected_status
    UNION ALL
    SELECT jsonb_build_object(
      'code', 'INVOICE_NEGATIVE_BALANCE', 'currency', summary_currency,
      'entityType', 'invoice', 'entityId', id,
      'details', jsonb_build_object('balanceAmount', balance_amount)
    )
    FROM invoice_facts WHERE balance_amount < 0
    UNION ALL
    SELECT jsonb_build_object(
      'code', 'INVOICE_PAID_MISMATCH', 'currency', summary_currency,
      'entityType', 'invoice', 'entityId', id,
      'details', jsonb_build_object('storedPaidAmount', stored_paid_amount, 'allocatedAmount', allocated_amount)
    )
    FROM invoice_facts WHERE abs(stored_paid_amount - allocated_amount) > 0.009
    UNION ALL
    SELECT jsonb_build_object(
      'code', 'INVOICE_WRITEOFF_MISMATCH', 'currency', summary_currency,
      'entityType', 'invoice', 'entityId', id,
      'details', jsonb_build_object('storedWriteOffAmount', stored_writeoff_amount, 'approvedWriteOffAmount', approved_writeoff_amount)
    )
    FROM invoice_facts WHERE abs(stored_writeoff_amount - approved_writeoff_amount) > 0.009
    UNION ALL
    SELECT jsonb_build_object(
      'code', 'INVOICE_STATUS_MISMATCH', 'currency', summary_currency,
      'entityType', 'invoice', 'entityId', id,
      'details', jsonb_build_object('actualStatus', status, 'expectedStatus', expected_status)
    )
    FROM invoice_facts WHERE status <> expected_status
    UNION ALL
    SELECT jsonb_build_object(
      'code', 'MULTIPLE_CURRENCIES', 'currency', NULL,
      'entityType', 'patient', 'entityId', p_patient_id,
      'details', jsonb_build_object('currencyCount', (SELECT count(*) FROM currency_keys))
    )
    WHERE (SELECT count(*) FROM currency_keys) > 1
  )
  SELECT jsonb_build_object(
    'tenantId', p_tenant_id,
    'patientId', p_patient_id,
    'asOf', v_as_of,
    'modelVersion', 'finance-summary-v1',
    'currencies', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'currency', currency,
        'totalInvoiced', total_invoiced,
        'activeAllocatedAmount', active_allocated,
        'cashReceived', cash_received,
        'completedRefundAmount', completed_refunds,
        'approvedWriteOffAmount', approved_writeoffs,
        'currentDebt', current_debt,
        'grossUnallocatedAmount', gross_unallocated,
        'refundReservedAmount', refund_reserved,
        'reservedDepositAmount', 0,
        'availableCreditAmount', available_credit,
        'netPositionAmount', available_credit - current_debt,
        'openInvoiceCount', open_invoice_count,
        'unpaidInvoiceCount', unpaid_invoice_count,
        'partiallyPaidInvoiceCount', partially_paid_count,
        'lastPaymentAt', last_payment_at
      ) ORDER BY currency)
      FROM bucket_rows
    ), '[]'::jsonb),
    'factComplete', true,
    'warnings', COALESCE((SELECT jsonb_agg(warning) FROM warning_rows), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_patient_finance_summary(uuid, uuid) IS
  'Complete per-currency patient finance snapshot. No pagination, no raw metadata, no cross-currency totals.';

REVOKE ALL ON FUNCTION public.get_patient_finance_summary(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_patient_finance_summary(uuid, uuid) TO authenticated;
