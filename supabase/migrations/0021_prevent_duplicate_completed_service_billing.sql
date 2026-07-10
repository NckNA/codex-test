-- COMPLETED-SERVICE-BILLING-GUARD-001
-- A completed clinical service is a historical clinical fact.  One non-null
-- invoice_items.completed_service_id is therefore retained for its entire
-- financial history, including voided and archived invoice/item states.

-- Do not silently repair historical finance data.  These checks intentionally
-- inspect every item state, because a void/archive does not release a service.
DO $$
DECLARE
  v_count bigint;
BEGIN
  SELECT count(*) INTO v_count
  FROM (
    SELECT completed_service_id
    FROM public.invoice_items
    WHERE completed_service_id IS NOT NULL
    GROUP BY completed_service_id
    HAVING count(*) > 1
  ) duplicates;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Cannot install completed-service billing guard: % duplicate completed_service_id link(s) exist (including voided/archived rows). Resolve historical duplicates first.', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.invoice_items ii
  LEFT JOIN public.completed_services cs ON cs.id = ii.completed_service_id
  WHERE ii.completed_service_id IS NOT NULL AND cs.id IS NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Cannot install completed-service billing guard: % orphan completed_service_id link(s) exist (including voided/archived rows). Resolve historical links first.', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.invoice_items ii
  LEFT JOIN public.invoices i ON i.id = ii.invoice_id
  WHERE i.id IS NULL OR ii.tenant_id <> i.tenant_id OR ii.patient_id <> i.patient_id;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Cannot install completed-service billing guard: % invoice-item/invoice tenant or patient mismatch(es) exist (including voided/archived rows). Resolve historical rows first.', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.invoice_items ii
  JOIN public.completed_services cs ON cs.id = ii.completed_service_id
  WHERE ii.completed_service_id IS NOT NULL
    AND (ii.tenant_id <> cs.tenant_id OR ii.patient_id <> cs.patient_id);
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Cannot install completed-service billing guard: % cross-tenant or cross-patient completed-service link(s) exist (including voided/archived rows). Resolve historical links first.', v_count;
  END IF;

END;
$$;

-- PostgreSQL partial-index predicates cannot refer to invoice state.  A plain
-- non-null unique key is deliberately stronger: financial void/archive never
-- frees a completed service for a second bill.
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoice_items_completed_service_billed_once
  ON public.invoice_items (completed_service_id)
  WHERE completed_service_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.enforce_invoice_item_completed_service_billing_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice public.invoices;
  v_completed_service public.completed_services;
BEGIN
  -- A historical clinical link is a financial fact, not an editable selector.
  -- There is no supported item-removal flow; allowing a privileged UPDATE to
  -- clear or replace this value would silently release or reassign the lock.
  IF TG_OP = 'UPDATE'
     AND OLD.completed_service_id IS NOT NULL
     AND NEW.completed_service_id IS DISTINCT FROM OLD.completed_service_id THEN
    RAISE EXCEPTION 'A billed completed service link is immutable';
  END IF;

  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = NEW.invoice_id
  FOR KEY SHARE;

  IF v_invoice.id IS NULL THEN
    RAISE EXCEPTION 'Invoice item invoice does not exist';
  END IF;
  IF NEW.tenant_id <> v_invoice.tenant_id OR NEW.patient_id <> v_invoice.patient_id THEN
    RAISE EXCEPTION 'Invoice item tenant and patient must match its invoice';
  END IF;

  -- Manual items remain valid and do not participate in the clinical lock.
  IF NEW.completed_service_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_completed_service
  FROM public.completed_services
  WHERE id = NEW.completed_service_id
  FOR KEY SHARE;

  IF v_completed_service.id IS NULL THEN
    RAISE EXCEPTION 'Completed service not found';
  END IF;
  IF v_completed_service.tenant_id <> NEW.tenant_id
     OR v_completed_service.patient_id <> NEW.patient_id THEN
    RAISE EXCEPTION 'Completed service does not belong to this invoice patient/tenant';
  END IF;
  IF v_completed_service.status <> 'completed' OR v_completed_service.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Completed service is not available for billing';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoice_items_completed_service_billing_guard ON public.invoice_items;
CREATE TRIGGER invoice_items_completed_service_billing_guard
BEFORE INSERT OR UPDATE OF tenant_id, invoice_id, patient_id, completed_service_id
ON public.invoice_items
FOR EACH ROW
EXECUTE FUNCTION public.enforce_invoice_item_completed_service_billing_guard();

-- This is the only actual invoice-item creation RPC.  It retains the original
-- role set, derives the actor from auth.uid(), locks the source service, and
-- commits item, invoice totals, and success audit as one transaction.
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
  v_constraint_name text;
BEGIN
  PERFORM public.ensure_finance_write_role_internal(
    p_tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role, 'cashier'::public.app_role]
  );
  IF p_invoice_id IS NULL THEN RAISE EXCEPTION 'Invoice ID is required'; END IF;
  IF p_service_name IS NULL OR length(btrim(p_service_name)) = 0 THEN RAISE EXCEPTION 'Service name is required'; END IF;
  IF COALESCE(p_quantity, 0) <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;
  IF COALESCE(p_unit_price, 0) < 0 OR COALESCE(p_discount_amount, 0) < 0 OR COALESCE(p_adjustment_amount, 0) < 0 THEN RAISE EXCEPTION 'Amounts must be non-negative'; END IF;
  IF jsonb_typeof(v_metadata) <> 'object' THEN RAISE EXCEPTION 'Metadata must be a JSON object'; END IF;

  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id AND tenant_id = p_tenant_id
  FOR UPDATE;
  IF v_invoice.id IS NULL THEN RAISE EXCEPTION 'Invoice not found in this tenant'; END IF;
  IF v_invoice.status NOT IN ('draft', 'issued') THEN RAISE EXCEPTION 'Cannot add invoice item to invoice with status %', v_invoice.status; END IF;

  IF p_completed_service_id IS NOT NULL THEN
    SELECT * INTO v_completed_service
    FROM public.completed_services
    WHERE id = p_completed_service_id
    FOR UPDATE;

    IF v_completed_service.id IS NULL
       OR v_completed_service.tenant_id <> p_tenant_id
       OR v_completed_service.patient_id <> v_invoice.patient_id
       OR v_completed_service.status <> 'completed'
       OR v_completed_service.archived_at IS NOT NULL THEN
      RAISE EXCEPTION 'Completed service is not available for this invoice';
    END IF;
    IF EXISTS (SELECT 1 FROM public.invoice_items WHERE completed_service_id = p_completed_service_id) THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Эта выполненная услуга уже включена в другой счёт.';
    END IF;
  END IF;

  v_total := GREATEST(0, COALESCE(p_quantity, 1) * COALESCE(p_unit_price, 0) - COALESCE(p_discount_amount, 0) + COALESCE(p_adjustment_amount, 0))::numeric(12,2);
  BEGIN
    INSERT INTO public.invoice_items (
      tenant_id, invoice_id, patient_id, completed_service_id, service_name, service_code,
      tooth_number, tooth_surface, quantity, unit_price, discount_amount, adjustment_amount,
      total_amount, status, notes, metadata, created_by
    ) VALUES (
      p_tenant_id, p_invoice_id, v_invoice.patient_id, p_completed_service_id, btrim(p_service_name),
      p_service_code, p_tooth_number, p_tooth_surface, p_quantity, p_unit_price, p_discount_amount,
      p_adjustment_amount, v_total, 'active', p_notes, v_metadata, auth.uid()
    ) RETURNING * INTO v_item;
  EXCEPTION WHEN unique_violation THEN
    -- The pre-check is user-friendly, while the unique index is the race-safe
    -- backstop.  Inspect the actual constraint: a broad "row exists" check
    -- could mislabel a future, unrelated invoice_items unique violation.
    GET STACKED DIAGNOSTICS v_constraint_name = CONSTRAINT_NAME;
    IF p_completed_service_id IS NOT NULL
       AND v_constraint_name = 'uq_invoice_items_completed_service_billed_once' THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Эта выполненная услуга уже включена в другой счёт.';
    END IF;
    RAISE;
  END;

  PERFORM public.recalculate_invoice_financials_internal(p_invoice_id);
  PERFORM public.log_finance_event_internal(
    p_tenant_id, 'invoice_item_added', 'invoice_item', v_item.id, v_invoice.patient_id,
    p_metadata => jsonb_strip_nulls(jsonb_build_object(
      'invoiceId', p_invoice_id, 'invoiceItemId', v_item.id,
      'completedServiceId', p_completed_service_id, 'amount', v_total
    ))
  );
  RETURN v_item;
END;
$$;

-- A server-side, unpaginated eligibility read is necessary for race-safe UI.
-- It exposes invoice metadata only to the same existing finance-writer roles.
CREATE OR REPLACE FUNCTION public.get_completed_service_billing_eligibility(
  p_tenant_id uuid,
  p_patient_id uuid
) RETURNS TABLE (
  completed_service_id uuid,
  service_name text,
  service_code text,
  tooth_number text,
  tooth_surface text,
  quantity numeric,
  unit_price numeric,
  currency text,
  billing_state text,
  invoice_id uuid,
  invoice_item_id uuid,
  invoice_number text,
  invoice_status text,
  billed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.ensure_finance_write_role_internal(
    p_tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role, 'cashier'::public.app_role]
  );
  IF p_patient_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.patients WHERE tenant_id = p_tenant_id AND id = p_patient_id
  ) THEN
    RAISE EXCEPTION 'Patient not found in this tenant';
  END IF;

  RETURN QUERY
  SELECT cs.id, cs.service_name, cs.service_code, cs.tooth_number, cs.tooth_surface,
    cs.quantity, cs.unit_price, cs.currency,
    CASE WHEN ii.id IS NOT NULL THEN 'billed'
         WHEN cs.status = 'completed' AND cs.archived_at IS NULL THEN 'unbilled'
         ELSE 'unavailable' END,
    ii.invoice_id, ii.id, i.invoice_number, i.status, ii.created_at
  FROM public.completed_services cs
  LEFT JOIN public.invoice_items ii ON ii.completed_service_id = cs.id
  LEFT JOIN public.invoices i ON i.id = ii.invoice_id
  WHERE cs.tenant_id = p_tenant_id AND cs.patient_id = p_patient_id
  ORDER BY cs.performed_at DESC, cs.id;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_invoice_item_completed_service_billing_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.add_invoice_item(uuid, uuid, text, numeric, numeric, numeric, numeric, uuid, text, text, text, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_completed_service_billing_eligibility(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_invoice_item(uuid, uuid, text, numeric, numeric, numeric, numeric, uuid, text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_completed_service_billing_eligibility(uuid, uuid) TO authenticated;

COMMENT ON INDEX public.uq_invoice_items_completed_service_billed_once IS
  'Historical billing lock: one completed clinical service backs at most one invoice item, including voided or archived finance records.';
