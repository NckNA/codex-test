-- 0016_create_finance_model.sql
-- Schema-only foundation for DentalFlow clinic finance.
--
-- Domain boundary:
-- - completed_service = performed clinical/billable fact, not payment;
-- - invoice_item = financial charge line and may reference a completed_service;
-- - invoice = financial charge grouping/request;
-- - payment = money received;
-- - payment_allocation = how received money is applied;
-- - refund = money returned;
-- - financial_adjustment = discount/write_off/correction/surcharge decision;
-- - debt/balance must be derived from financial facts, not manually typed into patients.balance.
--
-- This migration intentionally creates no RPC write paths, no automatic billing triggers,
-- no seed data, and no links that mutate clinical source facts.

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  invoice_number text,
  status text NOT NULL DEFAULT 'draft',
  currency text NOT NULL DEFAULT 'KZT',
  issue_date timestamptz,
  due_date timestamptz,
  subtotal_amount numeric(12,2) NOT NULL DEFAULT 0,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  adjustment_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  refunded_amount numeric(12,2) NOT NULL DEFAULT 0,
  written_off_amount numeric(12,2) NOT NULL DEFAULT 0,
  balance_amount numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  issued_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  voided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  void_reason text,
  issued_at timestamptz,
  voided_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoices_patient_fk
    FOREIGN KEY (tenant_id, patient_id) REFERENCES public.patients(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT invoices_status_check
    CHECK (status IN ('draft', 'issued', 'partially_paid', 'paid', 'voided', 'written_off', 'archived')),
  CONSTRAINT invoices_currency_non_empty_check
    CHECK (length(btrim(currency)) > 0),
  CONSTRAINT invoices_amounts_nonnegative_check
    CHECK (
      subtotal_amount >= 0
      AND discount_amount >= 0
      AND adjustment_amount >= 0
      AND total_amount >= 0
      AND paid_amount >= 0
      AND refunded_amount >= 0
      AND written_off_amount >= 0
      AND balance_amount >= 0
    ),
  CONSTRAINT invoices_metadata_object_check
    CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT invoices_void_reason_check
    CHECK (status <> 'voided' OR length(btrim(COALESCE(void_reason, ''))) > 0),
  CONSTRAINT invoices_voided_at_check
    CHECK (status <> 'voided' OR voided_at IS NOT NULL),
  CONSTRAINT invoices_issued_at_check
    CHECK (status NOT IN ('issued', 'partially_paid', 'paid', 'written_off') OR issued_at IS NOT NULL),
  CONSTRAINT invoices_archived_at_check
    CHECK (status <> 'archived' OR archived_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  completed_service_id uuid REFERENCES public.completed_services(id) ON DELETE SET NULL,
  service_name text NOT NULL,
  service_code text,
  tooth_number text,
  tooth_surface text,
  quantity numeric(12,3) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  adjustment_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  voided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  void_reason text,
  voided_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoice_items_patient_fk
    FOREIGN KEY (tenant_id, patient_id) REFERENCES public.patients(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT invoice_items_status_check
    CHECK (status IN ('active', 'voided', 'adjusted', 'archived')),
  CONSTRAINT invoice_items_service_name_non_empty_check
    CHECK (length(btrim(service_name)) > 0),
  CONSTRAINT invoice_items_quantity_positive_check
    CHECK (quantity > 0),
  CONSTRAINT invoice_items_amounts_nonnegative_check
    CHECK (unit_price >= 0 AND discount_amount >= 0 AND total_amount >= 0),
  CONSTRAINT invoice_items_metadata_object_check
    CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT invoice_items_void_reason_check
    CHECK (status <> 'voided' OR length(btrim(COALESCE(void_reason, ''))) > 0),
  CONSTRAINT invoice_items_voided_at_check
    CHECK (status <> 'voided' OR voided_at IS NOT NULL),
  CONSTRAINT invoice_items_archived_at_check
    CHECK (status <> 'archived' OR archived_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'received',
  payment_method text NOT NULL,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'KZT',
  received_at timestamptz NOT NULL DEFAULT now(),
  external_reference text,
  payer_name text,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  voided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  void_reason text,
  voided_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_patient_fk
    FOREIGN KEY (tenant_id, patient_id) REFERENCES public.patients(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT payments_status_check
    CHECK (status IN ('received', 'allocated', 'partially_allocated', 'refunded', 'partially_refunded', 'voided', 'archived')),
  CONSTRAINT payments_method_check
    CHECK (payment_method IN ('cash', 'kaspi', 'halyk_terminal', 'card', 'bank_transfer', 'insurance', 'osms', 'mixed', 'other')),
  CONSTRAINT payments_amount_positive_check
    CHECK (amount > 0),
  CONSTRAINT payments_currency_non_empty_check
    CHECK (length(btrim(currency)) > 0),
  CONSTRAINT payments_metadata_object_check
    CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT payments_void_reason_check
    CHECK (status <> 'voided' OR length(btrim(COALESCE(void_reason, ''))) > 0),
  CONSTRAINT payments_voided_at_check
    CHECK (status <> 'voided' OR voided_at IS NOT NULL),
  CONSTRAINT payments_archived_at_check
    CHECK (status <> 'archived' OR archived_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE,
  invoice_item_id uuid REFERENCES public.invoice_items(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'KZT',
  status text NOT NULL DEFAULT 'active',
  allocated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  voided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  void_reason text,
  voided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_allocations_patient_fk
    FOREIGN KEY (tenant_id, patient_id) REFERENCES public.patients(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT payment_allocations_status_check
    CHECK (status IN ('active', 'voided', 'archived')),
  CONSTRAINT payment_allocations_amount_positive_check
    CHECK (amount > 0),
  CONSTRAINT payment_allocations_currency_non_empty_check
    CHECK (length(btrim(currency)) > 0),
  CONSTRAINT payment_allocations_reference_check
    CHECK (invoice_id IS NOT NULL OR invoice_item_id IS NOT NULL),
  CONSTRAINT payment_allocations_metadata_object_check
    CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT payment_allocations_void_reason_check
    CHECK (status <> 'voided' OR length(btrim(COALESCE(void_reason, ''))) > 0),
  CONSTRAINT payment_allocations_voided_at_check
    CHECK (status <> 'voided' OR voided_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  refund_method text NOT NULL,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'KZT',
  reason text NOT NULL,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  completed_at timestamptz,
  rejected_at timestamptz,
  voided_at timestamptz,
  voided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  void_reason text,
  external_reference text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT refunds_patient_fk
    FOREIGN KEY (tenant_id, patient_id) REFERENCES public.patients(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT refunds_status_check
    CHECK (status IN ('pending', 'approved', 'completed', 'rejected', 'voided', 'archived')),
  CONSTRAINT refunds_method_check
    CHECK (refund_method IN ('cash', 'kaspi', 'halyk_terminal', 'card', 'bank_transfer', 'other')),
  CONSTRAINT refunds_amount_positive_check
    CHECK (amount > 0),
  CONSTRAINT refunds_reason_non_empty_check
    CHECK (length(btrim(reason)) > 0),
  CONSTRAINT refunds_currency_non_empty_check
    CHECK (length(btrim(currency)) > 0),
  CONSTRAINT refunds_metadata_object_check
    CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT refunds_completed_at_check
    CHECK (status <> 'completed' OR completed_at IS NOT NULL),
  CONSTRAINT refunds_void_reason_check
    CHECK (status <> 'voided' OR length(btrim(COALESCE(void_reason, ''))) > 0),
  CONSTRAINT refunds_voided_at_check
    CHECK (status <> 'voided' OR voided_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.financial_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE,
  invoice_item_id uuid REFERENCES public.invoice_items(id) ON DELETE CASCADE,
  payment_id uuid REFERENCES public.payments(id) ON DELETE CASCADE,
  adjustment_type text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'KZT',
  reason text NOT NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  voided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  voided_at timestamptz,
  void_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financial_adjustments_patient_fk
    FOREIGN KEY (tenant_id, patient_id) REFERENCES public.patients(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT financial_adjustments_type_check
    CHECK (adjustment_type IN ('discount', 'correction', 'write_off', 'surcharge', 'void')),
  CONSTRAINT financial_adjustments_status_check
    CHECK (status IN ('active', 'approved', 'rejected', 'voided', 'archived')),
  CONSTRAINT financial_adjustments_amount_positive_check
    CHECK (amount > 0),
  CONSTRAINT financial_adjustments_reason_non_empty_check
    CHECK (length(btrim(reason)) > 0),
  CONSTRAINT financial_adjustments_currency_non_empty_check
    CHECK (length(btrim(currency)) > 0),
  CONSTRAINT financial_adjustments_reference_check
    CHECK (invoice_id IS NOT NULL OR invoice_item_id IS NOT NULL OR payment_id IS NOT NULL),
  CONSTRAINT financial_adjustments_metadata_object_check
    CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT financial_adjustments_void_reason_check
    CHECK (status <> 'voided' OR length(btrim(COALESCE(void_reason, ''))) > 0),
  CONSTRAINT financial_adjustments_voided_at_check
    CHECK (status <> 'voided' OR voided_at IS NOT NULL)
);

DROP TRIGGER IF EXISTS invoices_set_updated_at ON public.invoices;
CREATE TRIGGER invoices_set_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS invoice_items_set_updated_at ON public.invoice_items;
CREATE TRIGGER invoice_items_set_updated_at
BEFORE UPDATE ON public.invoice_items
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS payments_set_updated_at ON public.payments;
CREATE TRIGGER payments_set_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS payment_allocations_set_updated_at ON public.payment_allocations;
CREATE TRIGGER payment_allocations_set_updated_at
BEFORE UPDATE ON public.payment_allocations
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS refunds_set_updated_at ON public.refunds;
CREATE TRIGGER refunds_set_updated_at
BEFORE UPDATE ON public.refunds
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS financial_adjustments_set_updated_at ON public.financial_adjustments;
CREATE TRIGGER financial_adjustments_set_updated_at
BEFORE UPDATE ON public.financial_adjustments
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_patient_status
  ON public.invoices (tenant_id, patient_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_status_created_at
  ON public.invoices (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_items_tenant_invoice
  ON public.invoice_items (tenant_id, invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_tenant_patient
  ON public.invoice_items (tenant_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_tenant_completed_service
  ON public.invoice_items (tenant_id, completed_service_id)
  WHERE completed_service_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_tenant_patient_status
  ON public.payments (tenant_id, patient_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_method_received_at
  ON public.payments (tenant_id, payment_method, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_tenant_payment
  ON public.payment_allocations (tenant_id, payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_tenant_invoice
  ON public.payment_allocations (tenant_id, invoice_id)
  WHERE invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_allocations_tenant_invoice_item
  ON public.payment_allocations (tenant_id, invoice_item_id)
  WHERE invoice_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_refunds_tenant_patient_status
  ON public.refunds (tenant_id, patient_id, status);
CREATE INDEX IF NOT EXISTS idx_refunds_tenant_payment
  ON public.refunds (tenant_id, payment_id);
CREATE INDEX IF NOT EXISTS idx_financial_adjustments_tenant_patient_type_status
  ON public.financial_adjustments (tenant_id, patient_id, adjustment_type, status);
CREATE INDEX IF NOT EXISTS idx_financial_adjustments_tenant_invoice
  ON public.financial_adjustments (tenant_id, invoice_id)
  WHERE invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_financial_adjustments_tenant_invoice_item
  ON public.financial_adjustments (tenant_id, invoice_item_id)
  WHERE invoice_item_id IS NOT NULL;

COMMENT ON TABLE public.invoices IS 'Financial charge grouping/request for a patient. An invoice is not payment and not clinical proof.';
COMMENT ON COLUMN public.invoices.balance_amount IS 'Stored lifecycle snapshot maintained by future controlled RPCs; debt reporting should be derived from finance facts or validated summaries, not manually edited patient.balance.';
COMMENT ON TABLE public.invoice_items IS 'Financial invoice line item. May reference a completed_service, but does not mutate clinical source facts.';
COMMENT ON COLUMN public.invoice_items.completed_service_id IS 'Optional link to the performed clinical/billable fact. completed_service itself does not mean invoiced or paid.';
COMMENT ON TABLE public.payments IS 'Money received from a patient or payer. Payment does not prove treatment was completed.';
COMMENT ON COLUMN public.payments.payment_method IS 'Clinic payment method snapshot such as cash, Kaspi, Halyk terminal, card, bank transfer, insurance, OSMS, mixed, or other.';
COMMENT ON TABLE public.payment_allocations IS 'Application of payment amount to an invoice or invoice item. Allocation is not receipt of new money.';
COMMENT ON TABLE public.refunds IS 'Money returned to the payer. Refunds must link to the original payment and require a reason.';
COMMENT ON TABLE public.financial_adjustments IS 'Discounts, corrections, write-offs, surcharges, and voiding adjustments. Discounts and write-offs are not payments.';
COMMENT ON COLUMN public.financial_adjustments.adjustment_type IS 'Commercial/accounting adjustment type. write_off removes debt by decision, not by money movement.';

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Finance staff can read tenant invoices" ON public.invoices;
CREATE POLICY "Finance staff can read tenant invoices"
ON public.invoices
FOR SELECT
TO authenticated
USING (
  public.has_tenant_role(
    tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role, 'cashier'::public.app_role, 'registrar'::public.app_role]
  )
);

DROP POLICY IF EXISTS "Finance staff can read tenant invoice items" ON public.invoice_items;
CREATE POLICY "Finance staff can read tenant invoice items"
ON public.invoice_items
FOR SELECT
TO authenticated
USING (
  public.has_tenant_role(
    tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role, 'cashier'::public.app_role]
  )
);

DROP POLICY IF EXISTS "Finance staff can read tenant payments" ON public.payments;
CREATE POLICY "Finance staff can read tenant payments"
ON public.payments
FOR SELECT
TO authenticated
USING (
  public.has_tenant_role(
    tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role, 'cashier'::public.app_role, 'registrar'::public.app_role]
  )
);

DROP POLICY IF EXISTS "Finance staff can read tenant payment allocations" ON public.payment_allocations;
CREATE POLICY "Finance staff can read tenant payment allocations"
ON public.payment_allocations
FOR SELECT
TO authenticated
USING (
  public.has_tenant_role(
    tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role, 'cashier'::public.app_role]
  )
);

DROP POLICY IF EXISTS "Finance staff can read tenant refunds" ON public.refunds;
CREATE POLICY "Finance staff can read tenant refunds"
ON public.refunds
FOR SELECT
TO authenticated
USING (
  public.has_tenant_role(
    tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role, 'cashier'::public.app_role]
  )
);

DROP POLICY IF EXISTS "Finance staff can read tenant adjustments" ON public.financial_adjustments;
CREATE POLICY "Finance staff can read tenant adjustments"
ON public.financial_adjustments
FOR SELECT
TO authenticated
USING (
  public.has_tenant_role(
    tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role, 'cashier'::public.app_role]
  )
);

REVOKE ALL ON TABLE public.invoices FROM PUBLIC;
REVOKE ALL ON TABLE public.invoice_items FROM PUBLIC;
REVOKE ALL ON TABLE public.payments FROM PUBLIC;
REVOKE ALL ON TABLE public.payment_allocations FROM PUBLIC;
REVOKE ALL ON TABLE public.refunds FROM PUBLIC;
REVOKE ALL ON TABLE public.financial_adjustments FROM PUBLIC;

REVOKE ALL ON TABLE public.invoices FROM anon;
REVOKE ALL ON TABLE public.invoice_items FROM anon;
REVOKE ALL ON TABLE public.payments FROM anon;
REVOKE ALL ON TABLE public.payment_allocations FROM anon;
REVOKE ALL ON TABLE public.refunds FROM anon;
REVOKE ALL ON TABLE public.financial_adjustments FROM anon;

REVOKE ALL ON TABLE public.invoices FROM authenticated;
REVOKE ALL ON TABLE public.invoice_items FROM authenticated;
REVOKE ALL ON TABLE public.payments FROM authenticated;
REVOKE ALL ON TABLE public.payment_allocations FROM authenticated;
REVOKE ALL ON TABLE public.refunds FROM authenticated;
REVOKE ALL ON TABLE public.financial_adjustments FROM authenticated;

GRANT SELECT ON TABLE public.invoices TO authenticated;
GRANT SELECT ON TABLE public.invoice_items TO authenticated;
GRANT SELECT ON TABLE public.payments TO authenticated;
GRANT SELECT ON TABLE public.payment_allocations TO authenticated;
GRANT SELECT ON TABLE public.refunds TO authenticated;
GRANT SELECT ON TABLE public.financial_adjustments TO authenticated;

GRANT ALL ON TABLE public.invoices TO service_role;
GRANT ALL ON TABLE public.invoice_items TO service_role;
GRANT ALL ON TABLE public.payments TO service_role;
GRANT ALL ON TABLE public.payment_allocations TO service_role;
GRANT ALL ON TABLE public.refunds TO service_role;
GRANT ALL ON TABLE public.financial_adjustments TO service_role;
