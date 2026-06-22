-- 0017_create_finance_rpc.sql
-- Controlled SECURITY DEFINER write paths for first finance lifecycle.
--
-- Scope:
-- - invoices / invoice_items / payments / payment_allocations write RPCs only;
-- - no refunds, write-offs, discounts, UI, cloud, seed, documents, stock, timeline, or provider integration;
-- - completed_services and patients.balance are never mutated by these RPCs.

CREATE OR REPLACE FUNCTION public.ensure_finance_write_role_internal(
  p_tenant_id uuid,
  p_allowed_roles public.app_role[]
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant ID is required';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authenticated user is required';
  END IF;

  IF NOT public.has_tenant_role(p_tenant_id, p_allowed_roles) THEN
    RAISE EXCEPTION 'Access denied: insufficient finance permissions for this tenant';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_finance_event_internal(
  p_tenant_id uuid,
  p_action text,
  p_target_type text,
  p_target_id uuid,
  p_patient_id uuid DEFAULT NULL,
  p_payment_id uuid DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_metadata jsonb := COALESCE(p_metadata, '{}'::jsonb);
  v_audit_id uuid;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Finance event tenant_id is required';
  END IF;

  IF p_action IS NULL OR length(btrim(p_action)) = 0 THEN
    RAISE EXCEPTION 'Finance event action is required';
  END IF;

  IF p_target_type IS NULL OR length(btrim(p_target_type)) = 0 THEN
    RAISE EXCEPTION 'Finance event target_type is required';
  END IF;

  IF p_target_id IS NULL THEN
    RAISE EXCEPTION 'Finance event target_id is required';
  END IF;

  IF jsonb_typeof(v_metadata) <> 'object' THEN
    RAISE EXCEPTION 'Finance event metadata must be a JSON object';
  END IF;

  v_metadata := jsonb_strip_nulls(
    v_metadata || jsonb_build_object(
      'domain', 'finance',
      'rpc', 'PAYMENTS-DEBTS-RPC-001C',
      'action', p_action,
      'targetType', p_target_type,
      'targetId', p_target_id,
      'paymentId', p_payment_id,
      'reason', p_reason
    )
  );

  -- Existing audit/activity constraints currently allow category 'payment' and financial visibility.
  -- The metadata domain marks these events as finance-specific without changing audit schema in this task.
  v_audit_id := public.record_audit_event_internal(
    p_tenant_id,
    p_action,
    'payment',
    p_target_type,
    p_target_id::text,
    auth.uid(),
    p_patient_id => p_patient_id,
    p_payment_id => p_payment_id::text,
    p_reason => p_reason,
    p_metadata => v_metadata
  );

  PERFORM public.record_activity_event_internal(
    p_tenant_id,
    'payment',
    p_action,
    replace(initcap(replace(p_action, '_', ' ')), ' ', ' '),
    p_target_type,
    p_target_id::text,
    p_patient_id => p_patient_id,
    p_audit_event_id => v_audit_id,
    p_actor_user_id => auth.uid(),
    p_visibility => 'financial',
    p_metadata => v_metadata
  );

  RETURN v_audit_id;
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
  WHERE invoice_id = p_invoice_id
    AND status IN ('active', 'adjusted');

  SELECT COALESCE(sum(pa.amount), 0)::numeric(12,2)
  INTO v_paid
  FROM public.payment_allocations pa
  LEFT JOIN public.invoice_items ii ON ii.id = pa.invoice_item_id
  WHERE pa.status = 'active'
    AND (
      pa.invoice_id = p_invoice_id
      OR ii.invoice_id = p_invoice_id
    );

  v_balance := GREATEST(0, v_total - v_paid)::numeric(12,2);
  v_next_status := v_invoice.status;

  IF v_invoice.status NOT IN ('draft', 'voided', 'archived', 'written_off') THEN
    IF v_total > 0 AND v_paid >= v_total THEN
      v_next_status := 'paid';
    ELSIF v_paid > 0 THEN
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
      written_off_amount = COALESCE(written_off_amount, 0),
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
  v_next_status text;
BEGIN
  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF v_payment.id IS NULL THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;

  SELECT COALESCE(sum(amount), 0)::numeric(12,2)
  INTO v_allocated
  FROM public.payment_allocations
  WHERE payment_id = p_payment_id
    AND status = 'active';

  v_next_status := v_payment.status;

  IF v_payment.status NOT IN ('voided', 'archived', 'refunded', 'partially_refunded') THEN
    IF v_allocated <= 0 THEN
      v_next_status := 'received';
    ELSIF v_allocated >= v_payment.amount THEN
      v_next_status := 'allocated';
    ELSE
      v_next_status := 'partially_allocated';
    END IF;
  END IF;

  UPDATE public.payments
  SET status = v_next_status
  WHERE id = p_payment_id
  RETURNING * INTO v_payment;

  RETURN v_payment;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_invoice(
  p_tenant_id uuid,
  p_patient_id uuid,
  p_currency text DEFAULT 'KZT',
  p_due_date timestamptz DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_metadata jsonb := COALESCE(p_metadata, '{}'::jsonb);
  v_patient_exists boolean;
  v_invoice public.invoices;
BEGIN
  PERFORM public.ensure_finance_write_role_internal(
    p_tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role, 'cashier'::public.app_role]
  );

  IF p_patient_id IS NULL THEN
    RAISE EXCEPTION 'Patient ID is required';
  END IF;
  IF p_currency IS NULL OR length(btrim(p_currency)) = 0 THEN
    RAISE EXCEPTION 'Currency is required';
  END IF;
  IF jsonb_typeof(v_metadata) <> 'object' THEN
    RAISE EXCEPTION 'Metadata must be a JSON object';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.patients WHERE tenant_id = p_tenant_id AND id = p_patient_id
  ) INTO v_patient_exists;
  IF NOT v_patient_exists THEN
    RAISE EXCEPTION 'Patient not found in this tenant';
  END IF;

  INSERT INTO public.invoices (
    tenant_id, patient_id, status, currency, due_date, notes, metadata, created_by
  ) VALUES (
    p_tenant_id, p_patient_id, 'draft', btrim(p_currency), p_due_date, p_notes, v_metadata, auth.uid()
  ) RETURNING * INTO v_invoice;

  PERFORM public.log_finance_event_internal(
    p_tenant_id, 'invoice_created', 'invoice', v_invoice.id, p_patient_id,
    p_metadata => jsonb_build_object('invoiceId', v_invoice.id, 'status', v_invoice.status)
  );

  RETURN v_invoice;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_invoice_item(
  p_tenant_id uuid,
  p_invoice_id uuid,
  p_service_name text,
  p_quantity numeric DEFAULT 1,
  p_unit_price numeric DEFAULT 0,
  p_discount_amount numeric DEFAULT 0,
  p_adjustment_amount numeric DEFAULT 0,
  p_completed_service_id uuid DEFAULT NULL,
  p_service_code text DEFAULT NULL,
  p_tooth_number text DEFAULT NULL,
  p_tooth_surface text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS public.invoice_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_metadata jsonb := COALESCE(p_metadata, '{}'::jsonb);
  v_invoice public.invoices;
  v_completed_service public.completed_services;
  v_item public.invoice_items;
  v_total numeric(12,2);
BEGIN
  PERFORM public.ensure_finance_write_role_internal(
    p_tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role, 'cashier'::public.app_role]
  );

  IF p_invoice_id IS NULL THEN
    RAISE EXCEPTION 'Invoice ID is required';
  END IF;
  IF p_service_name IS NULL OR length(btrim(p_service_name)) = 0 THEN
    RAISE EXCEPTION 'Service name is required';
  END IF;
  IF COALESCE(p_quantity, 0) <= 0 THEN
    RAISE EXCEPTION 'Quantity must be positive';
  END IF;
  IF COALESCE(p_unit_price, 0) < 0 OR COALESCE(p_discount_amount, 0) < 0 THEN
    RAISE EXCEPTION 'Amounts must be non-negative';
  END IF;
  IF COALESCE(p_adjustment_amount, 0) < 0 THEN
    RAISE EXCEPTION 'Adjustment amount must be non-negative';
  END IF;
  IF jsonb_typeof(v_metadata) <> 'object' THEN
    RAISE EXCEPTION 'Metadata must be a JSON object';
  END IF;

  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id AND tenant_id = p_tenant_id
  FOR UPDATE;
  IF v_invoice.id IS NULL THEN
    RAISE EXCEPTION 'Invoice not found in this tenant';
  END IF;
  IF v_invoice.status NOT IN ('draft', 'issued') THEN
    RAISE EXCEPTION 'Cannot add invoice item to invoice with status %', v_invoice.status;
  END IF;

  IF p_completed_service_id IS NOT NULL THEN
    SELECT * INTO v_completed_service
    FROM public.completed_services
    WHERE id = p_completed_service_id
      AND tenant_id = p_tenant_id
      AND patient_id = v_invoice.patient_id;
    IF v_completed_service.id IS NULL THEN
      RAISE EXCEPTION 'Completed service not found for this invoice patient/tenant';
    END IF;
  END IF;

  v_total := GREATEST(0, COALESCE(p_quantity, 1) * COALESCE(p_unit_price, 0) - COALESCE(p_discount_amount, 0) + COALESCE(p_adjustment_amount, 0))::numeric(12,2);

  INSERT INTO public.invoice_items (
    tenant_id, invoice_id, patient_id, completed_service_id, service_name, service_code,
    tooth_number, tooth_surface, quantity, unit_price, discount_amount, adjustment_amount,
    total_amount, status, notes, metadata, created_by
  ) VALUES (
    p_tenant_id, p_invoice_id, v_invoice.patient_id, p_completed_service_id, btrim(p_service_name),
    p_service_code, p_tooth_number, p_tooth_surface, p_quantity, p_unit_price, p_discount_amount,
    p_adjustment_amount, v_total, 'active', p_notes, v_metadata, auth.uid()
  ) RETURNING * INTO v_item;

  PERFORM public.recalculate_invoice_financials_internal(p_invoice_id);

  PERFORM public.log_finance_event_internal(
    p_tenant_id, 'invoice_item_added', 'invoice_item', v_item.id, v_invoice.patient_id,
    p_metadata => jsonb_strip_nulls(jsonb_build_object(
      'invoiceId', p_invoice_id,
      'invoiceItemId', v_item.id,
      'completedServiceId', p_completed_service_id,
      'amount', v_total
    ))
  );

  RETURN v_item;
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_invoice(
  p_tenant_id uuid,
  p_invoice_id uuid
) RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice public.invoices;
  v_has_items boolean;
BEGIN
  PERFORM public.ensure_finance_write_role_internal(
    p_tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role, 'cashier'::public.app_role]
  );

  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id AND tenant_id = p_tenant_id
  FOR UPDATE;
  IF v_invoice.id IS NULL THEN
    RAISE EXCEPTION 'Invoice not found in this tenant';
  END IF;
  IF v_invoice.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft invoices can be issued';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.invoice_items
    WHERE invoice_id = p_invoice_id AND tenant_id = p_tenant_id AND status IN ('active', 'adjusted')
  ) INTO v_has_items;
  IF NOT v_has_items THEN
    RAISE EXCEPTION 'Invoice must have at least one active item before issue';
  END IF;

  UPDATE public.invoices
  SET status = 'issued',
      issue_date = COALESCE(issue_date, now()),
      issued_at = COALESCE(issued_at, now()),
      issued_by = auth.uid()
  WHERE id = p_invoice_id AND tenant_id = p_tenant_id
  RETURNING * INTO v_invoice;

  v_invoice := public.recalculate_invoice_financials_internal(p_invoice_id);

  PERFORM public.log_finance_event_internal(
    p_tenant_id, 'invoice_issued', 'invoice', v_invoice.id, v_invoice.patient_id,
    p_metadata => jsonb_build_object('invoiceId', v_invoice.id, 'status', v_invoice.status, 'totalAmount', v_invoice.total_amount)
  );

  RETURN v_invoice;
END;
$$;

CREATE OR REPLACE FUNCTION public.void_invoice(
  p_tenant_id uuid,
  p_invoice_id uuid,
  p_reason text
) RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice public.invoices;
  v_has_allocations boolean;
BEGIN
  PERFORM public.ensure_finance_write_role_internal(
    p_tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role]
  );

  IF p_reason IS NULL OR length(btrim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'Void reason is required';
  END IF;

  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id AND tenant_id = p_tenant_id
  FOR UPDATE;
  IF v_invoice.id IS NULL THEN
    RAISE EXCEPTION 'Invoice not found in this tenant';
  END IF;
  IF v_invoice.status IN ('voided', 'archived') THEN
    RAISE EXCEPTION 'Invoice is already %', v_invoice.status;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.payment_allocations pa
    LEFT JOIN public.invoice_items ii ON ii.id = pa.invoice_item_id
    WHERE pa.tenant_id = p_tenant_id
      AND pa.status = 'active'
      AND (pa.invoice_id = p_invoice_id OR ii.invoice_id = p_invoice_id)
  ) INTO v_has_allocations;
  IF v_has_allocations THEN
    RAISE EXCEPTION 'Cannot void invoice with active payment allocations';
  END IF;

  UPDATE public.invoice_items
  SET status = 'voided',
      voided_at = now(),
      voided_by = auth.uid(),
      void_reason = btrim(p_reason)
  WHERE tenant_id = p_tenant_id
    AND invoice_id = p_invoice_id
    AND status IN ('active', 'adjusted');

  UPDATE public.invoices
  SET status = 'voided',
      voided_at = now(),
      voided_by = auth.uid(),
      void_reason = btrim(p_reason),
      balance_amount = 0
  WHERE id = p_invoice_id AND tenant_id = p_tenant_id
  RETURNING * INTO v_invoice;

  PERFORM public.log_finance_event_internal(
    p_tenant_id, 'invoice_voided', 'invoice', v_invoice.id, v_invoice.patient_id,
    p_reason => btrim(p_reason),
    p_metadata => jsonb_build_object('invoiceId', v_invoice.id, 'status', v_invoice.status)
  );

  RETURN v_invoice;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_payment(
  p_tenant_id uuid,
  p_patient_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_currency text DEFAULT 'KZT',
  p_received_at timestamptz DEFAULT now(),
  p_external_reference text DEFAULT NULL,
  p_payer_name text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_metadata jsonb := COALESCE(p_metadata, '{}'::jsonb);
  v_patient_exists boolean;
  v_payment public.payments;
BEGIN
  PERFORM public.ensure_finance_write_role_internal(
    p_tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role, 'cashier'::public.app_role]
  );

  IF p_patient_id IS NULL THEN
    RAISE EXCEPTION 'Patient ID is required';
  END IF;
  IF COALESCE(p_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be positive';
  END IF;
  IF p_payment_method IS NULL OR p_payment_method NOT IN ('cash', 'kaspi', 'halyk_terminal', 'card', 'bank_transfer', 'insurance', 'osms', 'mixed', 'other') THEN
    RAISE EXCEPTION 'Unsupported payment method: %', p_payment_method;
  END IF;
  IF p_currency IS NULL OR length(btrim(p_currency)) = 0 THEN
    RAISE EXCEPTION 'Currency is required';
  END IF;
  IF jsonb_typeof(v_metadata) <> 'object' THEN
    RAISE EXCEPTION 'Metadata must be a JSON object';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.patients WHERE tenant_id = p_tenant_id AND id = p_patient_id
  ) INTO v_patient_exists;
  IF NOT v_patient_exists THEN
    RAISE EXCEPTION 'Patient not found in this tenant';
  END IF;

  INSERT INTO public.payments (
    tenant_id, patient_id, status, payment_method, amount, currency, received_at,
    external_reference, payer_name, notes, metadata, received_by
  ) VALUES (
    p_tenant_id, p_patient_id, 'received', p_payment_method, p_amount, btrim(p_currency),
    COALESCE(p_received_at, now()), p_external_reference, p_payer_name, p_notes, v_metadata, auth.uid()
  ) RETURNING * INTO v_payment;

  PERFORM public.log_finance_event_internal(
    p_tenant_id, 'payment_recorded', 'payment', v_payment.id, p_patient_id, v_payment.id,
    p_metadata => jsonb_strip_nulls(jsonb_build_object(
      'paymentId', v_payment.id,
      'amount', v_payment.amount,
      'paymentMethod', v_payment.payment_method,
      'status', v_payment.status
    ))
  );

  RETURN v_payment;
END;
$$;

CREATE OR REPLACE FUNCTION public.allocate_payment(
  p_tenant_id uuid,
  p_payment_id uuid,
  p_amount numeric,
  p_invoice_id uuid DEFAULT NULL,
  p_invoice_item_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS public.payment_allocations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_metadata jsonb := COALESCE(p_metadata, '{}'::jsonb);
  v_payment public.payments;
  v_invoice public.invoices;
  v_item public.invoice_items;
  v_allocation public.payment_allocations;
  v_effective_invoice_id uuid;
  v_unallocated numeric(12,2);
  v_target_remaining numeric(12,2);
BEGIN
  PERFORM public.ensure_finance_write_role_internal(
    p_tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role, 'cashier'::public.app_role]
  );

  IF p_payment_id IS NULL THEN
    RAISE EXCEPTION 'Payment ID is required';
  END IF;
  IF COALESCE(p_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'Allocation amount must be positive';
  END IF;
  IF p_invoice_id IS NULL AND p_invoice_item_id IS NULL THEN
    RAISE EXCEPTION 'Allocation must reference invoice or invoice item';
  END IF;
  IF jsonb_typeof(v_metadata) <> 'object' THEN
    RAISE EXCEPTION 'Metadata must be a JSON object';
  END IF;

  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id AND tenant_id = p_tenant_id
  FOR UPDATE;
  IF v_payment.id IS NULL THEN
    RAISE EXCEPTION 'Payment not found in this tenant';
  END IF;
  IF v_payment.status NOT IN ('received', 'partially_allocated') THEN
    RAISE EXCEPTION 'Cannot allocate payment with status %', v_payment.status;
  END IF;

  SELECT (v_payment.amount - COALESCE(sum(amount), 0))::numeric(12,2)
  INTO v_unallocated
  FROM public.payment_allocations
  WHERE tenant_id = p_tenant_id
    AND payment_id = p_payment_id
    AND status = 'active';

  IF p_amount > v_unallocated THEN
    RAISE EXCEPTION 'Allocation amount exceeds unallocated payment amount';
  END IF;

  IF p_invoice_item_id IS NOT NULL THEN
    SELECT * INTO v_item
    FROM public.invoice_items
    WHERE id = p_invoice_item_id AND tenant_id = p_tenant_id
    FOR UPDATE;
    IF v_item.id IS NULL THEN
      RAISE EXCEPTION 'Invoice item not found in this tenant';
    END IF;
    IF v_item.status NOT IN ('active', 'adjusted') THEN
      RAISE EXCEPTION 'Cannot allocate to invoice item with status %', v_item.status;
    END IF;
    v_effective_invoice_id := v_item.invoice_id;
  ELSE
    v_effective_invoice_id := p_invoice_id;
  END IF;

  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = v_effective_invoice_id AND tenant_id = p_tenant_id
  FOR UPDATE;
  IF v_invoice.id IS NULL THEN
    RAISE EXCEPTION 'Invoice not found in this tenant';
  END IF;
  IF v_invoice.patient_id <> v_payment.patient_id THEN
    RAISE EXCEPTION 'Payment and invoice patient mismatch';
  END IF;
  IF v_invoice.status NOT IN ('issued', 'partially_paid') THEN
    RAISE EXCEPTION 'Cannot allocate to invoice with status %', v_invoice.status;
  END IF;
  IF p_invoice_item_id IS NOT NULL AND v_item.patient_id <> v_invoice.patient_id THEN
    RAISE EXCEPTION 'Invoice item patient mismatch';
  END IF;

  PERFORM public.recalculate_invoice_financials_internal(v_invoice.id);
  SELECT * INTO v_invoice FROM public.invoices WHERE id = v_effective_invoice_id AND tenant_id = p_tenant_id FOR UPDATE;

  IF p_invoice_item_id IS NOT NULL THEN
    SELECT (v_item.total_amount - COALESCE(sum(pa.amount), 0))::numeric(12,2)
    INTO v_target_remaining
    FROM public.payment_allocations pa
    WHERE pa.tenant_id = p_tenant_id
      AND pa.invoice_item_id = p_invoice_item_id
      AND pa.status = 'active';
  ELSE
    v_target_remaining := v_invoice.balance_amount;
  END IF;

  IF p_amount > v_target_remaining THEN
    RAISE EXCEPTION 'Allocation amount exceeds remaining invoice balance';
  END IF;

  INSERT INTO public.payment_allocations (
    tenant_id, patient_id, payment_id, invoice_id, invoice_item_id, amount, currency, status, metadata, created_by
  ) VALUES (
    p_tenant_id, v_payment.patient_id, p_payment_id, CASE WHEN p_invoice_item_id IS NULL THEN v_invoice.id ELSE NULL END,
    p_invoice_item_id, p_amount, v_payment.currency, 'active', v_metadata, auth.uid()
  ) RETURNING * INTO v_allocation;

  PERFORM public.recalculate_payment_status_internal(p_payment_id);
  PERFORM public.recalculate_invoice_financials_internal(v_invoice.id);

  PERFORM public.log_finance_event_internal(
    p_tenant_id, 'payment_allocated', 'payment_allocation', v_allocation.id, v_payment.patient_id, p_payment_id,
    p_metadata => jsonb_strip_nulls(jsonb_build_object(
      'allocationId', v_allocation.id,
      'paymentId', p_payment_id,
      'invoiceId', v_invoice.id,
      'invoiceItemId', p_invoice_item_id,
      'amount', p_amount
    ))
  );

  RETURN v_allocation;
END;
$$;

CREATE OR REPLACE FUNCTION public.void_payment_allocation(
  p_tenant_id uuid,
  p_allocation_id uuid,
  p_reason text
) RETURNS public.payment_allocations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_allocation public.payment_allocations;
  v_invoice_id uuid;
BEGIN
  PERFORM public.ensure_finance_write_role_internal(
    p_tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role]
  );

  IF p_reason IS NULL OR length(btrim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'Void reason is required';
  END IF;

  SELECT * INTO v_allocation
  FROM public.payment_allocations
  WHERE id = p_allocation_id AND tenant_id = p_tenant_id
  FOR UPDATE;
  IF v_allocation.id IS NULL THEN
    RAISE EXCEPTION 'Payment allocation not found in this tenant';
  END IF;
  IF v_allocation.status <> 'active' THEN
    RAISE EXCEPTION 'Only active payment allocations can be voided';
  END IF;

  IF v_allocation.invoice_id IS NOT NULL THEN
    v_invoice_id := v_allocation.invoice_id;
  ELSE
    SELECT invoice_id INTO v_invoice_id FROM public.invoice_items WHERE id = v_allocation.invoice_item_id;
  END IF;

  UPDATE public.payment_allocations
  SET status = 'voided',
      voided_at = now(),
      voided_by = auth.uid(),
      void_reason = btrim(p_reason)
  WHERE id = p_allocation_id AND tenant_id = p_tenant_id
  RETURNING * INTO v_allocation;

  PERFORM public.recalculate_payment_status_internal(v_allocation.payment_id);
  IF v_invoice_id IS NOT NULL THEN
    PERFORM public.recalculate_invoice_financials_internal(v_invoice_id);
  END IF;

  PERFORM public.log_finance_event_internal(
    p_tenant_id, 'payment_allocation_voided', 'payment_allocation', v_allocation.id,
    v_allocation.patient_id, v_allocation.payment_id, btrim(p_reason),
    jsonb_build_object('allocationId', v_allocation.id, 'status', v_allocation.status)
  );

  RETURN v_allocation;
END;
$$;

CREATE OR REPLACE FUNCTION public.void_payment(
  p_tenant_id uuid,
  p_payment_id uuid,
  p_reason text
) RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment public.payments;
  v_has_allocations boolean;
BEGIN
  PERFORM public.ensure_finance_write_role_internal(
    p_tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role]
  );

  IF p_reason IS NULL OR length(btrim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'Void reason is required';
  END IF;

  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id AND tenant_id = p_tenant_id
  FOR UPDATE;
  IF v_payment.id IS NULL THEN
    RAISE EXCEPTION 'Payment not found in this tenant';
  END IF;
  IF v_payment.status = 'voided' THEN
    RAISE EXCEPTION 'Payment already voided';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.payment_allocations
    WHERE tenant_id = p_tenant_id AND payment_id = p_payment_id AND status = 'active'
  ) INTO v_has_allocations;
  IF v_has_allocations THEN
    RAISE EXCEPTION 'Cannot void payment with active allocations';
  END IF;

  UPDATE public.payments
  SET status = 'voided',
      voided_at = now(),
      voided_by = auth.uid(),
      void_reason = btrim(p_reason)
  WHERE id = p_payment_id AND tenant_id = p_tenant_id
  RETURNING * INTO v_payment;

  PERFORM public.log_finance_event_internal(
    p_tenant_id, 'payment_voided', 'payment', v_payment.id, v_payment.patient_id, v_payment.id,
    btrim(p_reason), jsonb_build_object('paymentId', v_payment.id, 'status', v_payment.status)
  );

  RETURN v_payment;
END;
$$;

COMMENT ON FUNCTION public.create_invoice(uuid, uuid, text, timestamptz, text, jsonb)
  IS 'Controlled finance RPC: create draft invoice. Does not mutate clinical facts or patient.balance.';
COMMENT ON FUNCTION public.add_invoice_item(uuid, uuid, text, numeric, numeric, numeric, numeric, uuid, text, text, text, text, jsonb)
  IS 'Controlled finance RPC: add invoice item, optionally linked to completed_service without mutating it.';
COMMENT ON FUNCTION public.issue_invoice(uuid, uuid)
  IS 'Controlled finance RPC: issue draft invoice and recalculate totals.';
COMMENT ON FUNCTION public.void_invoice(uuid, uuid, text)
  IS 'Controlled finance RPC: admin/owner void invoice without active allocations, no hard delete.';
COMMENT ON FUNCTION public.record_payment(uuid, uuid, numeric, text, text, timestamptz, text, text, text, jsonb)
  IS 'Controlled finance RPC: record received money. Payment is not treatment completion.';
COMMENT ON FUNCTION public.allocate_payment(uuid, uuid, numeric, uuid, uuid, jsonb)
  IS 'Controlled finance RPC: allocate payment to invoice or invoice item.';
COMMENT ON FUNCTION public.void_payment_allocation(uuid, uuid, text)
  IS 'Controlled finance RPC: admin/owner void allocation with reason, no hard delete.';
COMMENT ON FUNCTION public.void_payment(uuid, uuid, text)
  IS 'Controlled finance RPC: admin/owner void unallocated payment with reason.';

REVOKE ALL ON FUNCTION public.ensure_finance_write_role_internal(uuid, public.app_role[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_finance_event_internal(uuid, text, text, uuid, uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalculate_invoice_financials_internal(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalculate_payment_status_internal(uuid) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.create_invoice(uuid, uuid, text, timestamptz, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_invoice_item(uuid, uuid, text, numeric, numeric, numeric, numeric, uuid, text, text, text, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.issue_invoice(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.void_invoice(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_payment(uuid, uuid, numeric, text, text, timestamptz, text, text, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.allocate_payment(uuid, uuid, numeric, uuid, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.void_payment_allocation(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.void_payment(uuid, uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_invoice(uuid, uuid, text, timestamptz, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_invoice_item(uuid, uuid, text, numeric, numeric, numeric, numeric, uuid, text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_invoice(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_invoice(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_payment(uuid, uuid, numeric, text, text, timestamptz, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_payment(uuid, uuid, numeric, uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_payment_allocation(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_payment(uuid, uuid, text) TO authenticated;
