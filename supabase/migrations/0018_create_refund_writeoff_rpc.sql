-- 0018_create_refund_writeoff_rpc.sql
-- Controlled backend lifecycle for refunds and invoice write-offs.
-- Refunds return only currently unallocated payment funds.
-- Write-offs reduce invoice debt without creating or changing payment facts.

ALTER TABLE public.refunds
  ADD COLUMN IF NOT EXISTS idempotency_key text;

ALTER TABLE public.financial_adjustments
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_refunds_tenant_idempotency_key
  ON public.refunds (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_financial_adjustments_tenant_idempotency_key
  ON public.financial_adjustments (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.refunds
  DROP CONSTRAINT IF EXISTS refunds_idempotency_key_non_empty_check;
ALTER TABLE public.refunds
  ADD CONSTRAINT refunds_idempotency_key_non_empty_check
  CHECK (idempotency_key IS NULL OR length(btrim(idempotency_key)) > 0);

ALTER TABLE public.financial_adjustments
  DROP CONSTRAINT IF EXISTS financial_adjustments_idempotency_key_non_empty_check;
ALTER TABLE public.financial_adjustments
  ADD CONSTRAINT financial_adjustments_idempotency_key_non_empty_check
  CHECK (idempotency_key IS NULL OR length(btrim(idempotency_key)) > 0);

ALTER TABLE public.refunds
  DROP CONSTRAINT IF EXISTS refunds_approved_state_check;
ALTER TABLE public.refunds
  ADD CONSTRAINT refunds_approved_state_check
  CHECK (
    status NOT IN ('approved', 'completed')
    OR (approved_at IS NOT NULL AND approved_by IS NOT NULL)
  );

ALTER TABLE public.refunds
  DROP CONSTRAINT IF EXISTS refunds_completed_actor_check;
ALTER TABLE public.refunds
  ADD CONSTRAINT refunds_completed_actor_check
  CHECK (status <> 'completed' OR completed_by IS NOT NULL);

ALTER TABLE public.refunds
  DROP CONSTRAINT IF EXISTS refunds_rejected_at_check;
ALTER TABLE public.refunds
  ADD CONSTRAINT refunds_rejected_at_check
  CHECK (status <> 'rejected' OR rejected_at IS NOT NULL);

ALTER TABLE public.financial_adjustments
  DROP CONSTRAINT IF EXISTS financial_adjustments_approved_state_check;
ALTER TABLE public.financial_adjustments
  ADD CONSTRAINT financial_adjustments_approved_state_check
  CHECK (
    status <> 'approved'
    OR (approved_at IS NOT NULL AND approved_by IS NOT NULL)
  );

CREATE OR REPLACE FUNCTION public.sanitize_finance_metadata_internal(
  p_metadata jsonb
) RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_metadata jsonb := COALESCE(p_metadata, '{}'::jsonb);
BEGIN
  IF jsonb_typeof(v_metadata) <> 'object' THEN
    RAISE EXCEPTION 'Metadata must be a JSON object';
  END IF;

  IF octet_length(v_metadata::text) > 16384 THEN
    RAISE EXCEPTION 'Metadata is too large';
  END IF;

  RETURN jsonb_strip_nulls(v_metadata);
END;
$$;

CREATE OR REPLACE FUNCTION public.payment_active_allocation_total_internal(
  p_tenant_id uuid,
  p_payment_id uuid,
  p_exclude_allocation_id uuid DEFAULT NULL
) RETURNS numeric(12,2)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(sum(amount), 0)::numeric(12,2)
  FROM public.payment_allocations
  WHERE tenant_id = p_tenant_id
    AND payment_id = p_payment_id
    AND status = 'active'
    AND (p_exclude_allocation_id IS NULL OR id <> p_exclude_allocation_id);
$$;

CREATE OR REPLACE FUNCTION public.payment_completed_refund_total_internal(
  p_tenant_id uuid,
  p_payment_id uuid,
  p_exclude_refund_id uuid DEFAULT NULL
) RETURNS numeric(12,2)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(sum(amount), 0)::numeric(12,2)
  FROM public.refunds
  WHERE tenant_id = p_tenant_id
    AND payment_id = p_payment_id
    AND status = 'completed'
    AND (p_exclude_refund_id IS NULL OR id <> p_exclude_refund_id);
$$;

CREATE OR REPLACE FUNCTION public.payment_reserved_refund_total_internal(
  p_tenant_id uuid,
  p_payment_id uuid,
  p_exclude_refund_id uuid DEFAULT NULL
) RETURNS numeric(12,2)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(sum(amount), 0)::numeric(12,2)
  FROM public.refunds
  WHERE tenant_id = p_tenant_id
    AND payment_id = p_payment_id
    AND status IN ('pending', 'approved')
    AND (p_exclude_refund_id IS NULL OR id <> p_exclude_refund_id);
$$;

CREATE OR REPLACE FUNCTION public.payment_refundable_amount_internal(
  p_tenant_id uuid,
  p_payment_id uuid,
  p_exclude_refund_id uuid DEFAULT NULL
) RETURNS numeric(12,2)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_amount numeric(12,2);
  v_allocated numeric(12,2);
  v_completed numeric(12,2);
  v_reserved numeric(12,2);
BEGIN
  SELECT amount INTO v_amount
  FROM public.payments
  WHERE tenant_id = p_tenant_id AND id = p_payment_id;

  IF v_amount IS NULL THEN
    RAISE EXCEPTION 'Payment not found in this tenant';
  END IF;

  v_allocated := public.payment_active_allocation_total_internal(p_tenant_id, p_payment_id);
  v_completed := public.payment_completed_refund_total_internal(p_tenant_id, p_payment_id, p_exclude_refund_id);
  v_reserved := public.payment_reserved_refund_total_internal(p_tenant_id, p_payment_id, p_exclude_refund_id);

  RETURN GREATEST(0, v_amount - v_allocated - v_completed - v_reserved)::numeric(12,2);
END;
$$;

CREATE OR REPLACE FUNCTION public.invoice_approved_writeoff_total_internal(
  p_tenant_id uuid,
  p_invoice_id uuid,
  p_exclude_adjustment_id uuid DEFAULT NULL
) RETURNS numeric(12,2)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(sum(fa.amount), 0)::numeric(12,2)
  FROM public.financial_adjustments fa
  LEFT JOIN public.invoice_items ii
    ON ii.id = fa.invoice_item_id
   AND ii.tenant_id = fa.tenant_id
  WHERE fa.tenant_id = p_tenant_id
    AND fa.adjustment_type = 'write_off'
    AND fa.status = 'approved'
    AND (fa.invoice_id = p_invoice_id OR ii.invoice_id = p_invoice_id)
    AND (p_exclude_adjustment_id IS NULL OR fa.id <> p_exclude_adjustment_id);
$$;

CREATE OR REPLACE FUNCTION public.invoice_reserved_writeoff_total_internal(
  p_tenant_id uuid,
  p_invoice_id uuid,
  p_exclude_adjustment_id uuid DEFAULT NULL
) RETURNS numeric(12,2)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(sum(fa.amount), 0)::numeric(12,2)
  FROM public.financial_adjustments fa
  LEFT JOIN public.invoice_items ii
    ON ii.id = fa.invoice_item_id
   AND ii.tenant_id = fa.tenant_id
  WHERE fa.tenant_id = p_tenant_id
    AND fa.adjustment_type = 'write_off'
    AND fa.status = 'active'
    AND (fa.invoice_id = p_invoice_id OR ii.invoice_id = p_invoice_id)
    AND (p_exclude_adjustment_id IS NULL OR fa.id <> p_exclude_adjustment_id);
$$;

CREATE OR REPLACE FUNCTION public.invoice_available_writeoff_amount_internal(
  p_tenant_id uuid,
  p_invoice_id uuid,
  p_exclude_adjustment_id uuid DEFAULT NULL
) RETURNS numeric(12,2)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total numeric(12,2);
  v_paid numeric(12,2);
  v_approved numeric(12,2);
  v_reserved numeric(12,2);
BEGIN
  SELECT total_amount INTO v_total
  FROM public.invoices
  WHERE tenant_id = p_tenant_id AND id = p_invoice_id;

  IF v_total IS NULL THEN
    RAISE EXCEPTION 'Invoice not found in this tenant';
  END IF;

  SELECT COALESCE(sum(pa.amount), 0)::numeric(12,2)
  INTO v_paid
  FROM public.payment_allocations pa
  LEFT JOIN public.invoice_items ii
    ON ii.id = pa.invoice_item_id
   AND ii.tenant_id = pa.tenant_id
  WHERE pa.tenant_id = p_tenant_id
    AND pa.status = 'active'
    AND (pa.invoice_id = p_invoice_id OR ii.invoice_id = p_invoice_id);

  v_approved := public.invoice_approved_writeoff_total_internal(
    p_tenant_id, p_invoice_id, p_exclude_adjustment_id
  );
  v_reserved := public.invoice_reserved_writeoff_total_internal(
    p_tenant_id, p_invoice_id, p_exclude_adjustment_id
  );

  RETURN GREATEST(0, v_total - v_paid - v_approved - v_reserved)::numeric(12,2);
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_invoice_financials_internal(
  p_invoice_id uuid
) RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice public.invoices;
  v_subtotal numeric(12,2) := 0;
  v_discount numeric(12,2) := 0;
  v_adjustment numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_paid numeric(12,2) := 0;
  v_written_off numeric(12,2) := 0;
  v_balance numeric(12,2) := 0;
  v_next_status text;
BEGIN
  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF v_invoice.id IS NULL THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  SELECT
    COALESCE(sum(quantity * unit_price), 0)::numeric(12,2),
    COALESCE(sum(discount_amount), 0)::numeric(12,2),
    COALESCE(sum(adjustment_amount), 0)::numeric(12,2),
    COALESCE(sum(total_amount), 0)::numeric(12,2)
  INTO v_subtotal, v_discount, v_adjustment, v_total
  FROM public.invoice_items
  WHERE tenant_id = v_invoice.tenant_id
    AND invoice_id = p_invoice_id
    AND status IN ('active', 'adjusted');

  SELECT COALESCE(sum(pa.amount), 0)::numeric(12,2)
  INTO v_paid
  FROM public.payment_allocations pa
  LEFT JOIN public.invoice_items ii
    ON ii.id = pa.invoice_item_id
   AND ii.tenant_id = pa.tenant_id
  WHERE pa.tenant_id = v_invoice.tenant_id
    AND pa.status = 'active'
    AND (pa.invoice_id = p_invoice_id OR ii.invoice_id = p_invoice_id);

  v_written_off := public.invoice_approved_writeoff_total_internal(
    v_invoice.tenant_id, p_invoice_id
  );

  IF v_paid + v_written_off > v_total THEN
    RAISE EXCEPTION 'Invoice financial invariant violated: payments plus write-offs exceed total amount';
  END IF;

  v_balance := GREATEST(0, v_total - v_paid - v_written_off)::numeric(12,2);
  v_next_status := v_invoice.status;

  IF v_invoice.status NOT IN ('draft', 'voided', 'archived') THEN
    IF v_balance = 0 AND v_written_off > 0 THEN
      v_next_status := 'written_off';
    ELSIF v_balance = 0 AND v_written_off = 0 THEN
      v_next_status := 'paid';
    ELSIF v_balance > 0 AND v_paid > 0 THEN
      v_next_status := 'partially_paid';
    ELSE
      v_next_status := 'issued';
    END IF;
  END IF;

  UPDATE public.invoices
  SET subtotal_amount = v_subtotal,
      discount_amount = v_discount,
      adjustment_amount = v_adjustment,
      total_amount = v_total,
      paid_amount = v_paid,
      refunded_amount = COALESCE(refunded_amount, 0),
      written_off_amount = v_written_off,
      balance_amount = v_balance,
      status = v_next_status
  WHERE id = p_invoice_id
  RETURNING * INTO v_invoice;

  RETURN v_invoice;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_payment_status_internal(
  p_payment_id uuid
) RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment public.payments;
  v_allocated numeric(12,2) := 0;
  v_refunded numeric(12,2) := 0;
  v_next_status text;
BEGIN
  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF v_payment.id IS NULL THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;

  v_allocated := public.payment_active_allocation_total_internal(
    v_payment.tenant_id, p_payment_id
  );
  v_refunded := public.payment_completed_refund_total_internal(
    v_payment.tenant_id, p_payment_id
  );

  IF v_allocated + v_refunded > v_payment.amount THEN
    RAISE EXCEPTION 'Payment financial invariant violated: allocations plus completed refunds exceed payment amount';
  END IF;

  v_next_status := v_payment.status;

  IF v_payment.status NOT IN ('voided', 'archived') THEN
    IF v_refunded >= v_payment.amount THEN
      v_next_status := 'refunded';
    ELSIF v_refunded > 0 THEN
      v_next_status := 'partially_refunded';
    ELSIF v_allocated >= v_payment.amount THEN
      v_next_status := 'allocated';
    ELSIF v_allocated > 0 THEN
      v_next_status := 'partially_allocated';
    ELSE
      v_next_status := 'received';
    END IF;
  END IF;

  UPDATE public.payments
  SET status = v_next_status
  WHERE id = p_payment_id
  RETURNING * INTO v_payment;

  RETURN v_payment;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_payment_allocation_capacity_internal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment public.payments;
  v_allocated numeric(12,2);
  v_completed numeric(12,2);
  v_reserved numeric(12,2);
  v_invoice_id uuid;
  v_invoice_total numeric(12,2);
  v_invoice_allocated numeric(12,2);
  v_writeoffs numeric(12,2);
  v_writeoff_reserved numeric(12,2);
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_payment
  FROM public.payments
  WHERE tenant_id = NEW.tenant_id AND id = NEW.payment_id
  FOR UPDATE;

  IF v_payment.id IS NULL THEN
    RAISE EXCEPTION 'Payment not found in this tenant';
  END IF;

  v_allocated := public.payment_active_allocation_total_internal(
    NEW.tenant_id, NEW.payment_id, NEW.id
  );
  v_completed := public.payment_completed_refund_total_internal(
    NEW.tenant_id, NEW.payment_id
  );
  v_reserved := public.payment_reserved_refund_total_internal(
    NEW.tenant_id, NEW.payment_id
  );

  IF v_allocated + NEW.amount + v_completed + v_reserved > v_payment.amount THEN
    RAISE EXCEPTION 'Allocation amount exceeds payment capacity after refunds and reserved refunds';
  END IF;

  IF NEW.invoice_id IS NOT NULL THEN
    v_invoice_id := NEW.invoice_id;
  ELSE
    SELECT invoice_id INTO v_invoice_id
    FROM public.invoice_items
    WHERE tenant_id = NEW.tenant_id AND id = NEW.invoice_item_id;
  END IF;

  IF v_invoice_id IS NOT NULL THEN
    SELECT total_amount INTO v_invoice_total
    FROM public.invoices
    WHERE tenant_id = NEW.tenant_id AND id = v_invoice_id
    FOR UPDATE;

    SELECT COALESCE(sum(pa.amount), 0)::numeric(12,2)
    INTO v_invoice_allocated
    FROM public.payment_allocations pa
    LEFT JOIN public.invoice_items ii
      ON ii.id = pa.invoice_item_id
     AND ii.tenant_id = pa.tenant_id
    WHERE pa.tenant_id = NEW.tenant_id
      AND pa.status = 'active'
      AND pa.id <> NEW.id
      AND (pa.invoice_id = v_invoice_id OR ii.invoice_id = v_invoice_id);

    v_writeoffs := public.invoice_approved_writeoff_total_internal(
      NEW.tenant_id, v_invoice_id
    );
    v_writeoff_reserved := public.invoice_reserved_writeoff_total_internal(
      NEW.tenant_id, v_invoice_id
    );

    IF v_invoice_allocated + NEW.amount + v_writeoffs + v_writeoff_reserved > v_invoice_total THEN
      RAISE EXCEPTION 'Allocation amount exceeds invoice capacity after write-offs and reserved write-offs';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payment_allocations_capacity_guard ON public.payment_allocations;
CREATE TRIGGER payment_allocations_capacity_guard
BEFORE INSERT OR UPDATE OF amount, status, payment_id, invoice_id, invoice_item_id
ON public.payment_allocations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_payment_allocation_capacity_internal();

CREATE OR REPLACE FUNCTION public.enforce_payment_refund_void_guard_internal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $payment_refund_guard$
BEGIN
  IF NEW.status = 'voided' AND OLD.status <> 'voided' AND EXISTS (
    SELECT 1
    FROM public.refunds
    WHERE tenant_id = NEW.tenant_id
      AND payment_id = NEW.id
      AND status IN ('pending', 'approved', 'completed')
  ) THEN
    RAISE EXCEPTION 'Payment with active or completed refunds cannot be voided';
  END IF;

  RETURN NEW;
END;
$payment_refund_guard$;

DROP TRIGGER IF EXISTS payments_refund_void_guard ON public.payments;
CREATE TRIGGER payments_refund_void_guard
BEFORE UPDATE OF status ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.enforce_payment_refund_void_guard_internal();

CREATE OR REPLACE FUNCTION public.enforce_invoice_writeoff_void_guard_internal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $invoice_writeoff_guard$
BEGIN
  IF NEW.status = 'voided' AND OLD.status <> 'voided' AND EXISTS (
    SELECT 1
    FROM public.financial_adjustments fa
    LEFT JOIN public.invoice_items ii
      ON ii.tenant_id = fa.tenant_id
     AND ii.id = fa.invoice_item_id
    WHERE fa.tenant_id = NEW.tenant_id
      AND fa.adjustment_type = 'write_off'
      AND fa.status IN ('active', 'approved')
      AND (fa.invoice_id = NEW.id OR ii.invoice_id = NEW.id)
  ) THEN
    RAISE EXCEPTION 'Invoice with active or approved write-offs cannot be voided';
  END IF;

  RETURN NEW;
END;
$invoice_writeoff_guard$;

DROP TRIGGER IF EXISTS invoices_writeoff_void_guard ON public.invoices;
CREATE TRIGGER invoices_writeoff_void_guard
BEFORE UPDATE OF status ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.enforce_invoice_writeoff_void_guard_internal();

CREATE OR REPLACE FUNCTION public.request_refund(
  p_tenant_id uuid,
  p_payment_id uuid,
  p_amount numeric,
  p_refund_method text,
  p_reason text,
  p_idempotency_key text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS public.refunds
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment public.payments;
  v_refund public.refunds;
  v_metadata jsonb;
  v_idempotency_key text := NULLIF(btrim(p_idempotency_key), '');
  v_refundable numeric(12,2);
BEGIN
  PERFORM public.ensure_finance_write_role_internal(
    p_tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role, 'cashier'::public.app_role]
  );

  IF p_payment_id IS NULL THEN RAISE EXCEPTION 'Payment ID is required'; END IF;
  IF COALESCE(p_amount, 0) <= 0 THEN RAISE EXCEPTION 'Refund amount must be positive'; END IF;
  IF p_refund_method IS NULL OR p_refund_method NOT IN ('cash', 'kaspi', 'halyk_terminal', 'card', 'bank_transfer', 'other') THEN
    RAISE EXCEPTION 'Unsupported refund method: %', p_refund_method;
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) = 0 THEN RAISE EXCEPTION 'Refund reason is required'; END IF;
  IF p_idempotency_key IS NOT NULL AND v_idempotency_key IS NULL THEN RAISE EXCEPTION 'Idempotency key must not be empty'; END IF;
  v_metadata := public.sanitize_finance_metadata_internal(p_metadata);

  SELECT * INTO v_payment
  FROM public.payments
  WHERE tenant_id = p_tenant_id AND id = p_payment_id
  FOR UPDATE;

  IF v_payment.id IS NULL THEN RAISE EXCEPTION 'Payment not found in this tenant'; END IF;
  IF v_payment.status IN ('voided', 'archived') THEN
    RAISE EXCEPTION 'Cannot refund payment with status %', v_payment.status;
  END IF;

  IF v_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_refund
    FROM public.refunds
    WHERE tenant_id = p_tenant_id AND idempotency_key = v_idempotency_key;

    IF v_refund.id IS NOT NULL THEN
      IF v_refund.payment_id <> p_payment_id
         OR v_refund.amount <> p_amount::numeric(12,2)
         OR v_refund.refund_method <> p_refund_method THEN
        RAISE EXCEPTION 'Idempotency key is already used for a different refund request';
      END IF;
      RETURN v_refund;
    END IF;
  END IF;

  v_refundable := public.payment_refundable_amount_internal(p_tenant_id, p_payment_id);
  IF p_amount > v_refundable THEN
    RAISE EXCEPTION 'Refund amount exceeds currently unallocated refundable amount';
  END IF;

  INSERT INTO public.refunds (
    tenant_id, patient_id, payment_id, status, refund_method, amount, currency,
    reason, requested_by, requested_at, metadata, idempotency_key
  ) VALUES (
    p_tenant_id, v_payment.patient_id, v_payment.id, 'pending', p_refund_method,
    p_amount, v_payment.currency, btrim(p_reason), auth.uid(), now(), v_metadata, v_idempotency_key
  ) RETURNING * INTO v_refund;

  PERFORM public.log_finance_event_internal(
    p_tenant_id, 'refund_requested', 'refund', v_refund.id,
    v_refund.patient_id, v_refund.payment_id, v_refund.reason,
    jsonb_build_object(
      'refundId', v_refund.id, 'paymentId', v_refund.payment_id,
      'amount', v_refund.amount, 'currency', v_refund.currency,
      'fromStatus', NULL, 'toStatus', 'pending'
    )
  );

  RETURN v_refund;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_refund(
  p_tenant_id uuid,
  p_refund_id uuid
) RETURNS public.refunds
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_refund public.refunds;
  v_payment public.payments;
  v_refundable numeric(12,2);
BEGIN
  PERFORM public.ensure_finance_write_role_internal(
    p_tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role]
  );

  SELECT * INTO v_refund
  FROM public.refunds
  WHERE tenant_id = p_tenant_id AND id = p_refund_id
  FOR UPDATE;

  IF v_refund.id IS NULL THEN RAISE EXCEPTION 'Refund not found in this tenant'; END IF;
  IF v_refund.status IN ('approved', 'completed') THEN RETURN v_refund; END IF;
  IF v_refund.status <> 'pending' THEN RAISE EXCEPTION 'Only pending refunds can be approved'; END IF;

  SELECT * INTO v_payment
  FROM public.payments
  WHERE tenant_id = p_tenant_id AND id = v_refund.payment_id
  FOR UPDATE;
  IF v_payment.id IS NULL THEN RAISE EXCEPTION 'Payment not found in this tenant'; END IF;
  IF v_payment.status IN ('voided', 'archived') THEN RAISE EXCEPTION 'Cannot approve refund for payment with status %', v_payment.status; END IF;

  v_refundable := public.payment_refundable_amount_internal(p_tenant_id, v_payment.id, v_refund.id);
  IF v_refund.amount > v_refundable THEN RAISE EXCEPTION 'Refund amount exceeds currently refundable amount'; END IF;

  UPDATE public.refunds
  SET status = 'approved', approved_by = auth.uid(), approved_at = now()
  WHERE id = v_refund.id
  RETURNING * INTO v_refund;

  PERFORM public.log_finance_event_internal(
    p_tenant_id, 'refund_approved', 'refund', v_refund.id,
    v_refund.patient_id, v_refund.payment_id,
    p_metadata => jsonb_build_object(
      'refundId', v_refund.id, 'paymentId', v_refund.payment_id,
      'amount', v_refund.amount, 'currency', v_refund.currency,
      'fromStatus', 'pending', 'toStatus', 'approved'
    )
  );

  RETURN v_refund;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_refund(
  p_tenant_id uuid,
  p_refund_id uuid,
  p_external_reference text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS public.refunds
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_refund public.refunds;
  v_payment public.payments;
  v_metadata jsonb;
  v_refundable numeric(12,2);
BEGIN
  PERFORM public.ensure_finance_write_role_internal(
    p_tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role, 'cashier'::public.app_role]
  );
  v_metadata := public.sanitize_finance_metadata_internal(p_metadata);

  SELECT * INTO v_refund
  FROM public.refunds
  WHERE tenant_id = p_tenant_id AND id = p_refund_id
  FOR UPDATE;

  IF v_refund.id IS NULL THEN RAISE EXCEPTION 'Refund not found in this tenant'; END IF;
  IF v_refund.status = 'completed' THEN RETURN v_refund; END IF;
  IF v_refund.status <> 'approved' THEN RAISE EXCEPTION 'Only approved refunds can be completed'; END IF;

  SELECT * INTO v_payment
  FROM public.payments
  WHERE tenant_id = p_tenant_id AND id = v_refund.payment_id
  FOR UPDATE;
  IF v_payment.id IS NULL THEN RAISE EXCEPTION 'Payment not found in this tenant'; END IF;
  IF v_payment.status IN ('voided', 'archived') THEN RAISE EXCEPTION 'Cannot complete refund for payment with status %', v_payment.status; END IF;

  v_refundable := public.payment_refundable_amount_internal(p_tenant_id, v_payment.id, v_refund.id);
  IF v_refund.amount > v_refundable THEN RAISE EXCEPTION 'Refund amount exceeds currently refundable amount'; END IF;

  UPDATE public.refunds
  SET status = 'completed',
      completed_by = auth.uid(),
      completed_at = now(),
      external_reference = COALESCE(NULLIF(btrim(p_external_reference), ''), external_reference),
      metadata = public.sanitize_finance_metadata_internal(metadata || v_metadata)
  WHERE id = v_refund.id
  RETURNING * INTO v_refund;

  PERFORM public.recalculate_payment_status_internal(v_payment.id);

  PERFORM public.log_finance_event_internal(
    p_tenant_id, 'refund_completed', 'refund', v_refund.id,
    v_refund.patient_id, v_refund.payment_id,
    p_metadata => jsonb_build_object(
      'refundId', v_refund.id, 'paymentId', v_refund.payment_id,
      'amount', v_refund.amount, 'currency', v_refund.currency,
      'fromStatus', 'approved', 'toStatus', 'completed',
      'externalReference', v_refund.external_reference
    )
  );

  RETURN v_refund;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_refund(
  p_tenant_id uuid,
  p_refund_id uuid,
  p_reason text
) RETURNS public.refunds
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_refund public.refunds;
  v_reason text;
BEGIN
  PERFORM public.ensure_finance_write_role_internal(
    p_tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role]
  );
  v_reason := NULLIF(btrim(p_reason), '');
  IF v_reason IS NULL THEN RAISE EXCEPTION 'Rejection reason is required'; END IF;

  SELECT * INTO v_refund
  FROM public.refunds
  WHERE tenant_id = p_tenant_id AND id = p_refund_id
  FOR UPDATE;

  IF v_refund.id IS NULL THEN RAISE EXCEPTION 'Refund not found in this tenant'; END IF;
  IF v_refund.status = 'rejected' THEN RETURN v_refund; END IF;
  IF v_refund.status <> 'pending' THEN RAISE EXCEPTION 'Only pending refunds can be rejected'; END IF;

  UPDATE public.refunds
  SET status = 'rejected',
      rejected_at = now(),
      metadata = public.sanitize_finance_metadata_internal(
        metadata || jsonb_build_object(
          'rejectionReason', v_reason,
          'rejectedBy', auth.uid(),
          'rejectedAt', now()
        )
      )
  WHERE id = v_refund.id
  RETURNING * INTO v_refund;

  PERFORM public.log_finance_event_internal(
    p_tenant_id, 'refund_rejected', 'refund', v_refund.id,
    v_refund.patient_id, v_refund.payment_id, v_reason,
    jsonb_build_object(
      'refundId', v_refund.id, 'paymentId', v_refund.payment_id,
      'amount', v_refund.amount, 'currency', v_refund.currency,
      'fromStatus', 'pending', 'toStatus', 'rejected'
    )
  );

  RETURN v_refund;
END;
$$;

CREATE OR REPLACE FUNCTION public.void_refund(
  p_tenant_id uuid,
  p_refund_id uuid,
  p_reason text
) RETURNS public.refunds
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_refund public.refunds;
  v_reason text;
  v_from_status text;
BEGIN
  PERFORM public.ensure_finance_write_role_internal(
    p_tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role]
  );
  v_reason := NULLIF(btrim(p_reason), '');
  IF v_reason IS NULL THEN RAISE EXCEPTION 'Void reason is required'; END IF;

  SELECT * INTO v_refund
  FROM public.refunds
  WHERE tenant_id = p_tenant_id AND id = p_refund_id
  FOR UPDATE;

  IF v_refund.id IS NULL THEN RAISE EXCEPTION 'Refund not found in this tenant'; END IF;
  IF v_refund.status = 'voided' THEN RETURN v_refund; END IF;
  IF v_refund.status = 'completed' THEN RAISE EXCEPTION 'Completed refunds are immutable and cannot be voided'; END IF;
  IF v_refund.status NOT IN ('pending', 'approved') THEN RAISE EXCEPTION 'Only pending or approved refunds can be voided'; END IF;

  v_from_status := v_refund.status;
  UPDATE public.refunds
  SET status = 'voided', voided_by = auth.uid(), voided_at = now(), void_reason = v_reason
  WHERE id = v_refund.id
  RETURNING * INTO v_refund;

  PERFORM public.log_finance_event_internal(
    p_tenant_id, 'refund_voided', 'refund', v_refund.id,
    v_refund.patient_id, v_refund.payment_id, v_reason,
    jsonb_build_object(
      'refundId', v_refund.id, 'paymentId', v_refund.payment_id,
      'amount', v_refund.amount, 'currency', v_refund.currency,
      'fromStatus', v_from_status, 'toStatus', 'voided'
    )
  );

  RETURN v_refund;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_invoice_write_off(
  p_tenant_id uuid,
  p_invoice_id uuid,
  p_amount numeric,
  p_reason text,
  p_idempotency_key text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS public.financial_adjustments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice public.invoices;
  v_adjustment public.financial_adjustments;
  v_metadata jsonb;
  v_idempotency_key text := NULLIF(btrim(p_idempotency_key), '');
  v_available numeric(12,2);
BEGIN
  PERFORM public.ensure_finance_write_role_internal(
    p_tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role]
  );

  IF p_invoice_id IS NULL THEN RAISE EXCEPTION 'Invoice ID is required'; END IF;
  IF COALESCE(p_amount, 0) <= 0 THEN RAISE EXCEPTION 'Write-off amount must be positive'; END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) = 0 THEN RAISE EXCEPTION 'Write-off reason is required'; END IF;
  IF p_idempotency_key IS NOT NULL AND v_idempotency_key IS NULL THEN RAISE EXCEPTION 'Idempotency key must not be empty'; END IF;
  v_metadata := public.sanitize_finance_metadata_internal(p_metadata);

  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE tenant_id = p_tenant_id AND id = p_invoice_id
  FOR UPDATE;

  IF v_invoice.id IS NULL THEN RAISE EXCEPTION 'Invoice not found in this tenant'; END IF;
  IF v_invoice.status NOT IN ('issued', 'partially_paid') THEN
    RAISE EXCEPTION 'Cannot write off invoice with status %', v_invoice.status;
  END IF;

  v_invoice := public.recalculate_invoice_financials_internal(v_invoice.id);
  IF v_invoice.status NOT IN ('issued', 'partially_paid') THEN
    RAISE EXCEPTION 'Cannot write off invoice with status %', v_invoice.status;
  END IF;

  IF v_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_adjustment
    FROM public.financial_adjustments
    WHERE tenant_id = p_tenant_id AND idempotency_key = v_idempotency_key;

    IF v_adjustment.id IS NOT NULL THEN
      IF v_adjustment.adjustment_type <> 'write_off'
         OR v_adjustment.invoice_id <> p_invoice_id
         OR v_adjustment.amount <> p_amount::numeric(12,2) THEN
        RAISE EXCEPTION 'Idempotency key is already used for a different adjustment request';
      END IF;
      RETURN v_adjustment;
    END IF;
  END IF;

  v_available := public.invoice_available_writeoff_amount_internal(p_tenant_id, p_invoice_id);
  IF p_amount > v_available THEN
    RAISE EXCEPTION 'Write-off amount exceeds available invoice balance';
  END IF;

  INSERT INTO public.financial_adjustments (
    tenant_id, patient_id, invoice_id, adjustment_type, status, amount,
    currency, reason, created_by, metadata, idempotency_key
  ) VALUES (
    p_tenant_id, v_invoice.patient_id, v_invoice.id, 'write_off', 'active',
    p_amount, v_invoice.currency, btrim(p_reason), auth.uid(), v_metadata, v_idempotency_key
  ) RETURNING * INTO v_adjustment;

  PERFORM public.log_finance_event_internal(
    p_tenant_id, 'write_off_requested', 'financial_adjustment', v_adjustment.id,
    v_adjustment.patient_id, p_reason => v_adjustment.reason,
    p_metadata => jsonb_build_object(
      'adjustmentId', v_adjustment.id, 'invoiceId', v_adjustment.invoice_id,
      'amount', v_adjustment.amount, 'currency', v_adjustment.currency,
      'fromStatus', NULL, 'toStatus', 'active'
    )
  );

  RETURN v_adjustment;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_invoice_write_off(
  p_tenant_id uuid,
  p_adjustment_id uuid
) RETURNS public.financial_adjustments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_adjustment public.financial_adjustments;
  v_invoice public.invoices;
  v_available numeric(12,2);
BEGIN
  PERFORM public.ensure_finance_write_role_internal(
    p_tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role]
  );

  SELECT * INTO v_adjustment
  FROM public.financial_adjustments
  WHERE tenant_id = p_tenant_id AND id = p_adjustment_id
  FOR UPDATE;

  IF v_adjustment.id IS NULL THEN RAISE EXCEPTION 'Financial adjustment not found in this tenant'; END IF;
  IF v_adjustment.adjustment_type <> 'write_off' THEN RAISE EXCEPTION 'Adjustment is not an invoice write-off'; END IF;
  IF v_adjustment.status = 'approved' THEN RETURN v_adjustment; END IF;
  IF v_adjustment.status <> 'active' THEN RAISE EXCEPTION 'Only active write-offs can be approved'; END IF;

  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE tenant_id = p_tenant_id AND id = v_adjustment.invoice_id
  FOR UPDATE;
  IF v_invoice.id IS NULL THEN RAISE EXCEPTION 'Invoice not found in this tenant'; END IF;
  IF v_invoice.status NOT IN ('issued', 'partially_paid') THEN RAISE EXCEPTION 'Cannot approve write-off for invoice with status %', v_invoice.status; END IF;

  v_available := public.invoice_available_writeoff_amount_internal(
    p_tenant_id, v_invoice.id, v_adjustment.id
  );
  IF v_adjustment.amount > v_available THEN RAISE EXCEPTION 'Write-off amount exceeds available invoice balance'; END IF;

  UPDATE public.financial_adjustments
  SET status = 'approved', approved_by = auth.uid(), approved_at = now()
  WHERE id = v_adjustment.id
  RETURNING * INTO v_adjustment;

  PERFORM public.recalculate_invoice_financials_internal(v_invoice.id);

  PERFORM public.log_finance_event_internal(
    p_tenant_id, 'write_off_approved', 'financial_adjustment', v_adjustment.id,
    v_adjustment.patient_id,
    p_metadata => jsonb_build_object(
      'adjustmentId', v_adjustment.id, 'invoiceId', v_adjustment.invoice_id,
      'amount', v_adjustment.amount, 'currency', v_adjustment.currency,
      'fromStatus', 'active', 'toStatus', 'approved'
    )
  );

  RETURN v_adjustment;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_invoice_write_off(
  p_tenant_id uuid,
  p_adjustment_id uuid,
  p_reason text
) RETURNS public.financial_adjustments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_adjustment public.financial_adjustments;
  v_reason text;
BEGIN
  PERFORM public.ensure_finance_write_role_internal(
    p_tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role]
  );
  v_reason := NULLIF(btrim(p_reason), '');
  IF v_reason IS NULL THEN RAISE EXCEPTION 'Rejection reason is required'; END IF;

  SELECT * INTO v_adjustment
  FROM public.financial_adjustments
  WHERE tenant_id = p_tenant_id AND id = p_adjustment_id
  FOR UPDATE;

  IF v_adjustment.id IS NULL THEN RAISE EXCEPTION 'Financial adjustment not found in this tenant'; END IF;
  IF v_adjustment.adjustment_type <> 'write_off' THEN RAISE EXCEPTION 'Adjustment is not an invoice write-off'; END IF;
  IF v_adjustment.status = 'rejected' THEN RETURN v_adjustment; END IF;
  IF v_adjustment.status <> 'active' THEN RAISE EXCEPTION 'Only active write-offs can be rejected'; END IF;

  UPDATE public.financial_adjustments
  SET status = 'rejected',
      metadata = public.sanitize_finance_metadata_internal(
        metadata || jsonb_build_object(
          'rejectionReason', v_reason,
          'rejectedBy', auth.uid(),
          'rejectedAt', now()
        )
      )
  WHERE id = v_adjustment.id
  RETURNING * INTO v_adjustment;

  PERFORM public.log_finance_event_internal(
    p_tenant_id, 'write_off_rejected', 'financial_adjustment', v_adjustment.id,
    v_adjustment.patient_id, p_reason => v_reason,
    p_metadata => jsonb_build_object(
      'adjustmentId', v_adjustment.id, 'invoiceId', v_adjustment.invoice_id,
      'amount', v_adjustment.amount, 'currency', v_adjustment.currency,
      'fromStatus', 'active', 'toStatus', 'rejected'
    )
  );

  RETURN v_adjustment;
END;
$$;

CREATE OR REPLACE FUNCTION public.void_invoice_write_off(
  p_tenant_id uuid,
  p_adjustment_id uuid,
  p_reason text
) RETURNS public.financial_adjustments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_adjustment public.financial_adjustments;
  v_reason text;
  v_from_status text;
  v_recalculate boolean;
BEGIN
  PERFORM public.ensure_finance_write_role_internal(
    p_tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role]
  );
  v_reason := NULLIF(btrim(p_reason), '');
  IF v_reason IS NULL THEN RAISE EXCEPTION 'Void reason is required'; END IF;

  SELECT * INTO v_adjustment
  FROM public.financial_adjustments
  WHERE tenant_id = p_tenant_id AND id = p_adjustment_id
  FOR UPDATE;

  IF v_adjustment.id IS NULL THEN RAISE EXCEPTION 'Financial adjustment not found in this tenant'; END IF;
  IF v_adjustment.adjustment_type <> 'write_off' THEN RAISE EXCEPTION 'Adjustment is not an invoice write-off'; END IF;
  IF v_adjustment.status = 'voided' THEN RETURN v_adjustment; END IF;
  IF v_adjustment.status NOT IN ('active', 'approved') THEN RAISE EXCEPTION 'Only active or approved write-offs can be voided'; END IF;

  PERFORM 1 FROM public.invoices
  WHERE tenant_id = p_tenant_id AND id = v_adjustment.invoice_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found in this tenant'; END IF;

  v_from_status := v_adjustment.status;
  v_recalculate := v_adjustment.status = 'approved';

  UPDATE public.financial_adjustments
  SET status = 'voided', voided_by = auth.uid(), voided_at = now(), void_reason = v_reason
  WHERE id = v_adjustment.id
  RETURNING * INTO v_adjustment;

  IF v_recalculate THEN
    PERFORM public.recalculate_invoice_financials_internal(v_adjustment.invoice_id);
  END IF;

  PERFORM public.log_finance_event_internal(
    p_tenant_id, 'write_off_voided', 'financial_adjustment', v_adjustment.id,
    v_adjustment.patient_id, p_reason => v_reason,
    p_metadata => jsonb_build_object(
      'adjustmentId', v_adjustment.id, 'invoiceId', v_adjustment.invoice_id,
      'amount', v_adjustment.amount, 'currency', v_adjustment.currency,
      'fromStatus', v_from_status, 'toStatus', 'voided'
    )
  );

  RETURN v_adjustment;
END;
$$;

COMMENT ON FUNCTION public.request_refund(uuid, uuid, numeric, text, text, text, jsonb)
  IS 'Request return of currently unallocated payment funds. Does not reverse invoice allocations.';
COMMENT ON FUNCTION public.approve_refund(uuid, uuid)
  IS 'Owner/admin approval of a pending refund request.';
COMMENT ON FUNCTION public.complete_refund(uuid, uuid, text, jsonb)
  IS 'Record completion of an approved refund; no provider API call is performed.';
COMMENT ON FUNCTION public.reject_refund(uuid, uuid, text)
  IS 'Reject a pending refund request and release reserved payment capacity.';
COMMENT ON FUNCTION public.void_refund(uuid, uuid, text)
  IS 'Cancel a pending or approved refund. Completed refunds are immutable.';
COMMENT ON FUNCTION public.request_invoice_write_off(uuid, uuid, numeric, text, text, jsonb)
  IS 'Request debt reduction for an issued or partially paid invoice.';
COMMENT ON FUNCTION public.approve_invoice_write_off(uuid, uuid)
  IS 'Approve and apply an invoice write-off without changing payment facts.';
COMMENT ON FUNCTION public.reject_invoice_write_off(uuid, uuid, text)
  IS 'Reject an active invoice write-off request.';
COMMENT ON FUNCTION public.void_invoice_write_off(uuid, uuid, text)
  IS 'Void active or approved invoice write-off; approved reversal reopens debt.';

REVOKE ALL ON FUNCTION public.sanitize_finance_metadata_internal(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payment_active_allocation_total_internal(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payment_completed_refund_total_internal(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payment_reserved_refund_total_internal(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payment_refundable_amount_internal(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.invoice_approved_writeoff_total_internal(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.invoice_reserved_writeoff_total_internal(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.invoice_available_writeoff_amount_internal(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_payment_allocation_capacity_internal() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_payment_refund_void_guard_internal() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_invoice_writeoff_void_guard_internal() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.request_refund(uuid, uuid, numeric, text, text, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_refund(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_refund(uuid, uuid, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_refund(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.void_refund(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_invoice_write_off(uuid, uuid, numeric, text, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_invoice_write_off(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_invoice_write_off(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.void_invoice_write_off(uuid, uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.request_refund(uuid, uuid, numeric, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_refund(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_refund(uuid, uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_refund(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_refund(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_invoice_write_off(uuid, uuid, numeric, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_invoice_write_off(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_invoice_write_off(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_invoice_write_off(uuid, uuid, text) TO authenticated;
