-- 0022_create_patient_fund_reservations.sql
-- Patient credit remains a derived view over payments, allocations, refunds,
-- and payment-linked reservations. This migration creates no second money ledger.
--
-- Capacity lock order for all mutation RPCs in this migration:
--   1. payment row;
--   2. refund rows for the payment, ordered by id;
--   3. active/partially-used reservation rows, ordered by id;
--   4. target reservation row;
--   5. target invoice row when reserved credit is consumed.
--
-- The public app has no direct reservation/allocation/refund writes. Triggers are
-- still authoritative backstops for privileged or future write paths.

DO $precheck$
DECLARE
  v_count bigint;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.payment_allocations pa
  LEFT JOIN public.payments p ON p.id = pa.payment_id
  WHERE p.id IS NULL
     OR pa.tenant_id <> p.tenant_id
     OR pa.patient_id <> p.patient_id
     OR upper(btrim(pa.currency)) <> upper(btrim(p.currency));
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Cannot install patient fund reservations: % orphan or mismatched payment allocation row(s) exist.', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.refunds r
  LEFT JOIN public.payments p ON p.id = r.payment_id
  WHERE p.id IS NULL
     OR r.tenant_id <> p.tenant_id
     OR r.patient_id <> p.patient_id
     OR upper(btrim(r.currency)) <> upper(btrim(p.currency));
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Cannot install patient fund reservations: % orphan or mismatched refund row(s) exist.', v_count;
  END IF;

  WITH capacity AS (
    SELECT p.id, p.amount,
      COALESCE((SELECT sum(pa.amount) FROM public.payment_allocations pa WHERE pa.payment_id = p.id AND pa.status = 'active'), 0) AS allocated,
      COALESCE((SELECT sum(r.amount) FROM public.refunds r WHERE r.payment_id = p.id AND r.status = 'completed'), 0) AS completed_refunds,
      COALESCE((SELECT sum(r.amount) FROM public.refunds r WHERE r.payment_id = p.id AND r.status IN ('pending', 'approved')), 0) AS reserved_refunds
    FROM public.payments p
  )
  SELECT count(*) INTO v_count
  FROM capacity
  WHERE allocated + completed_refunds + reserved_refunds > amount;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Cannot install patient fund reservations: % payment(s) already exceed authoritative capacity. Resolve finance history first.', v_count;
  END IF;
END;
$precheck$;

CREATE SCHEMA IF NOT EXISTS private_finance;
REVOKE ALL ON SCHEMA private_finance FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE private_finance.mutation_authorizations (
  token uuid PRIMARY KEY,
  action text NOT NULL,
  target_id uuid NOT NULL,
  transaction_id bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
REVOKE ALL ON TABLE private_finance.mutation_authorizations FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.issue_finance_mutation_authorization_internal(
  p_action text,
  p_target_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private_finance, public, pg_temp
AS $$
DECLARE
  v_token uuid := gen_random_uuid();
BEGIN
  IF length(btrim(COALESCE(p_action, ''))) = 0 OR p_target_id IS NULL THEN
    RAISE EXCEPTION 'Mutation authorization action and target are required';
  END IF;
  INSERT INTO private_finance.mutation_authorizations(token, action, target_id, transaction_id)
  VALUES (v_token, p_action, p_target_id, txid_current());
  PERFORM set_config('app.finance_mutation_token', v_token::text, true);
  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_finance_mutation_authorization_internal(
  p_action text,
  p_target_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private_finance, public, pg_temp
AS $$
DECLARE
  v_token uuid;
  v_deleted uuid;
BEGIN
  BEGIN
    v_token := NULLIF(current_setting('app.finance_mutation_token', true), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN false;
  END;
  IF v_token IS NULL THEN RETURN false; END IF;

  DELETE FROM private_finance.mutation_authorizations
  WHERE token = v_token
    AND action = p_action
    AND target_id = p_target_id
    AND transaction_id = txid_current()
  RETURNING token INTO v_deleted;
  PERFORM set_config('app.finance_mutation_token', '', true);
  RETURN v_deleted IS NOT NULL;
END;
$$;

CREATE TABLE public.patient_fund_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  currency text NOT NULL,
  purpose_type text NOT NULL,
  purpose_label text,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE RESTRICT,
  treatment_plan_id uuid REFERENCES public.treatment_plans(id) ON DELETE RESTRICT,
  original_amount numeric(12,2) NOT NULL,
  consumed_amount numeric(12,2) NOT NULL DEFAULT 0,
  released_amount numeric(12,2) NOT NULL DEFAULT 0,
  remaining_amount numeric(12,2) GENERATED ALWAYS AS (
    original_amount - consumed_amount - released_amount
  ) STORED,
  status text NOT NULL DEFAULT 'active',
  expires_at timestamptz,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text NOT NULL,
  operation_fingerprint text NOT NULL,
  release_idempotency_key text,
  release_operation_fingerprint text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  released_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  released_at timestamptz,
  release_reason text,
  archived_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  archived_at timestamptz,
  archived_from_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT patient_fund_reservations_patient_fk
    FOREIGN KEY (tenant_id, patient_id) REFERENCES public.patients(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT patient_fund_reservations_currency_check
    CHECK (length(btrim(currency)) > 0),
  CONSTRAINT patient_fund_reservations_purpose_check
    CHECK (purpose_type IN ('general', 'appointment', 'treatment_plan', 'service', 'other')),
  CONSTRAINT patient_fund_reservations_other_label_check
    CHECK (purpose_type <> 'other' OR length(btrim(COALESCE(purpose_label, ''))) > 0),
  CONSTRAINT patient_fund_reservations_reference_check
    CHECK (
      (appointment_id IS NULL OR purpose_type = 'appointment')
      AND (treatment_plan_id IS NULL OR purpose_type = 'treatment_plan')
    ),
  CONSTRAINT patient_fund_reservations_status_check
    CHECK (status IN ('active', 'partially_used', 'fully_used', 'released', 'refunded', 'archived')),
  CONSTRAINT patient_fund_reservations_amounts_check
    CHECK (
      original_amount > 0
      AND consumed_amount >= 0
      AND released_amount >= 0
      AND consumed_amount + released_amount <= original_amount
    ),
  CONSTRAINT patient_fund_reservations_metadata_check
    CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT patient_fund_reservations_idempotency_check
    CHECK (
      length(btrim(idempotency_key)) BETWEEN 1 AND 240
      AND length(btrim(operation_fingerprint)) > 0
      AND (
        (release_idempotency_key IS NULL AND release_operation_fingerprint IS NULL)
        OR (
          length(btrim(release_idempotency_key)) BETWEEN 1 AND 240
          AND length(btrim(release_operation_fingerprint)) > 0
        )
      )
    ),
  CONSTRAINT patient_fund_reservations_lifecycle_check
    CHECK (
      (status = 'active' AND consumed_amount = 0 AND released_amount = 0 AND released_at IS NULL AND released_by IS NULL)
      OR (status = 'partially_used' AND consumed_amount > 0 AND remaining_amount > 0 AND released_amount = 0 AND released_at IS NULL AND released_by IS NULL)
      OR (status = 'fully_used' AND consumed_amount = original_amount AND released_amount = 0 AND remaining_amount = 0)
      OR (status = 'released' AND remaining_amount = 0 AND released_amount > 0 AND released_at IS NOT NULL AND released_by IS NOT NULL AND length(btrim(COALESCE(release_reason, ''))) > 0)
      OR (status = 'refunded' AND remaining_amount = 0)
      OR (status = 'archived' AND remaining_amount = 0 AND archived_at IS NOT NULL AND archived_by IS NOT NULL AND archived_from_status IN ('fully_used', 'released', 'refunded'))
    )
);

CREATE UNIQUE INDEX uq_patient_fund_reservations_tenant_create_key
  ON public.patient_fund_reservations (tenant_id, idempotency_key);
CREATE UNIQUE INDEX uq_patient_fund_reservations_tenant_release_key
  ON public.patient_fund_reservations (tenant_id, release_idempotency_key)
  WHERE release_idempotency_key IS NOT NULL;
CREATE INDEX idx_patient_fund_reservations_payment_active
  ON public.patient_fund_reservations (tenant_id, payment_id, id)
  WHERE status IN ('active', 'partially_used');
CREATE INDEX idx_patient_fund_reservations_patient_created
  ON public.patient_fund_reservations (tenant_id, patient_id, created_at DESC);

ALTER TABLE public.payment_allocations
  ADD COLUMN patient_fund_reservation_id uuid REFERENCES public.patient_fund_reservations(id) ON DELETE RESTRICT,
  ADD COLUMN reservation_operation_key text,
  ADD COLUMN reservation_operation_fingerprint text;

ALTER TABLE public.payment_allocations
  ADD CONSTRAINT payment_allocations_reservation_operation_check
  CHECK (
    (patient_fund_reservation_id IS NULL AND reservation_operation_key IS NULL AND reservation_operation_fingerprint IS NULL)
    OR (
      patient_fund_reservation_id IS NOT NULL
      AND length(btrim(reservation_operation_key)) BETWEEN 1 AND 240
      AND length(btrim(reservation_operation_fingerprint)) > 0
    )
  );

CREATE UNIQUE INDEX uq_payment_allocations_tenant_reservation_operation_key
  ON public.payment_allocations (tenant_id, reservation_operation_key)
  WHERE reservation_operation_key IS NOT NULL;
CREATE INDEX idx_payment_allocations_reservation
  ON public.payment_allocations (tenant_id, patient_fund_reservation_id)
  WHERE patient_fund_reservation_id IS NOT NULL;

DROP TRIGGER IF EXISTS patient_fund_reservations_set_updated_at ON public.patient_fund_reservations;
CREATE TRIGGER patient_fund_reservations_set_updated_at
BEFORE UPDATE ON public.patient_fund_reservations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.patient_fund_reservations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Finance operators can read patient fund reservations" ON public.patient_fund_reservations;
CREATE POLICY "Finance operators can read patient fund reservations"
ON public.patient_fund_reservations FOR SELECT TO authenticated
USING (
  public.has_tenant_role(
    tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role, 'cashier'::public.app_role]
  )
);

GRANT SELECT ON public.patient_fund_reservations TO authenticated, service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.patient_fund_reservations FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.payment_active_deposit_reserved_total_internal(
  p_tenant_id uuid,
  p_payment_id uuid,
  p_exclude_reservation_id uuid DEFAULT NULL
) RETURNS numeric(12,2)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(sum(remaining_amount), 0)::numeric(12,2)
  FROM public.patient_fund_reservations
  WHERE tenant_id = p_tenant_id
    AND payment_id = p_payment_id
    AND status IN ('active', 'partially_used')
    AND (p_exclude_reservation_id IS NULL OR id <> p_exclude_reservation_id);
$$;

CREATE OR REPLACE FUNCTION public.lock_payment_capacity_rows_internal(
  p_tenant_id uuid,
  p_payment_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM id FROM public.refunds
  WHERE tenant_id = p_tenant_id
    AND payment_id = p_payment_id
    AND status IN ('pending', 'approved', 'completed')
  ORDER BY id FOR UPDATE;

  PERFORM id FROM public.patient_fund_reservations
  WHERE tenant_id = p_tenant_id
    AND payment_id = p_payment_id
    AND status IN ('active', 'partially_used')
  ORDER BY id FOR UPDATE;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_payment_fund_capacity_internal(
  p_tenant_id uuid,
  p_payment_id uuid,
  p_exclude_refund_id uuid DEFAULT NULL,
  p_exclude_reservation_id uuid DEFAULT NULL
) RETURNS TABLE (
  payment_amount numeric(12,2),
  active_allocated_amount numeric(12,2),
  completed_refund_amount numeric(12,2),
  refund_reserved_amount numeric(12,2),
  reserved_deposit_amount numeric(12,2),
  gross_unallocated_amount numeric(12,2),
  available_credit_amount numeric(12,2)
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_amount numeric(12,2);
  v_allocated numeric(12,2);
  v_completed numeric(12,2);
  v_refund_reserved numeric(12,2);
  v_deposit_reserved numeric(12,2);
BEGIN
  SELECT amount INTO v_amount
  FROM public.payments
  WHERE tenant_id = p_tenant_id AND id = p_payment_id;
  IF v_amount IS NULL THEN
    RAISE EXCEPTION 'Payment not found in this tenant';
  END IF;

  v_allocated := public.payment_active_allocation_total_internal(p_tenant_id, p_payment_id);
  v_completed := public.payment_completed_refund_total_internal(p_tenant_id, p_payment_id, p_exclude_refund_id);
  v_refund_reserved := public.payment_reserved_refund_total_internal(p_tenant_id, p_payment_id, p_exclude_refund_id);
  v_deposit_reserved := public.payment_active_deposit_reserved_total_internal(p_tenant_id, p_payment_id, p_exclude_reservation_id);

  RETURN QUERY SELECT
    v_amount,
    v_allocated,
    v_completed,
    v_refund_reserved,
    v_deposit_reserved,
    GREATEST(0, v_amount - v_allocated - v_completed)::numeric(12,2),
    GREATEST(0, v_amount - v_allocated - v_completed - v_refund_reserved - v_deposit_reserved)::numeric(12,2);
END;
$$;

CREATE OR REPLACE FUNCTION public.payment_refundable_amount_internal(
  p_tenant_id uuid,
  p_payment_id uuid,
  p_exclude_refund_id uuid DEFAULT NULL
) RETURNS numeric(12,2)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_capacity record;
BEGIN
  SELECT * INTO v_capacity
  FROM public.get_payment_fund_capacity_internal(
    p_tenant_id, p_payment_id, p_exclude_refund_id, NULL
  );
  RETURN v_capacity.available_credit_amount;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_payment_fund_capacity(
  p_tenant_id uuid,
  p_patient_id uuid,
  p_payment_id uuid
) RETURNS TABLE (
  payment_id uuid,
  patient_id uuid,
  currency text,
  payment_amount numeric(12,2),
  active_allocated_amount numeric(12,2),
  completed_refund_amount numeric(12,2),
  refund_reserved_amount numeric(12,2),
  reserved_deposit_amount numeric(12,2),
  gross_unallocated_amount numeric(12,2),
  available_credit_amount numeric(12,2)
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment public.payments;
  v_capacity record;
BEGIN
  PERFORM public.ensure_finance_write_role_internal(
    p_tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role, 'cashier'::public.app_role]
  );
  SELECT * INTO v_payment FROM public.payments p
  WHERE p.tenant_id = p_tenant_id AND p.patient_id = p_patient_id AND p.id = p_payment_id;
  IF v_payment.id IS NULL THEN
    RAISE EXCEPTION 'Payment not found for this patient and tenant';
  END IF;
  SELECT * INTO v_capacity FROM public.get_payment_fund_capacity_internal(p_tenant_id, p_payment_id);
  RETURN QUERY SELECT v_payment.id, v_payment.patient_id, v_payment.currency,
    v_capacity.payment_amount, v_capacity.active_allocated_amount,
    v_capacity.completed_refund_amount, v_capacity.refund_reserved_amount,
    v_capacity.reserved_deposit_amount, v_capacity.gross_unallocated_amount,
    v_capacity.available_credit_amount;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_patient_fund_reservations(
  p_tenant_id uuid,
  p_patient_id uuid,
  p_payment_id uuid DEFAULT NULL
) RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  patient_id uuid,
  payment_id uuid,
  currency text,
  purpose_type text,
  purpose_label text,
  appointment_id uuid,
  treatment_plan_id uuid,
  original_amount numeric(12,2),
  consumed_amount numeric(12,2),
  released_amount numeric(12,2),
  remaining_amount numeric(12,2),
  status text,
  expires_at timestamptz,
  notes text,
  created_at timestamptz,
  released_at timestamptz,
  archived_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.ensure_finance_write_role_internal(
    p_tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role, 'cashier'::public.app_role]
  );
  IF NOT EXISTS (SELECT 1 FROM public.patients p WHERE p.tenant_id = p_tenant_id AND p.id = p_patient_id) THEN
    RAISE EXCEPTION 'Patient not found in this tenant';
  END IF;
  RETURN QUERY
  SELECT r.id, r.tenant_id, r.patient_id, r.payment_id, r.currency, r.purpose_type, r.purpose_label,
    r.appointment_id, r.treatment_plan_id, r.original_amount, r.consumed_amount,
    r.released_amount, r.remaining_amount, r.status, r.expires_at, r.notes,
    r.created_at, r.released_at, r.archived_at
  FROM public.patient_fund_reservations r
  WHERE r.tenant_id = p_tenant_id
    AND r.patient_id = p_patient_id
    AND (p_payment_id IS NULL OR r.payment_id = p_payment_id)
  ORDER BY r.created_at DESC, r.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.patient_fund_reservation_result_internal(
  p_reservation_id uuid,
  p_status text,
  p_allocation_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_reservation public.patient_fund_reservations;
  v_allocation public.payment_allocations;
  v_capacity record;
BEGIN
  SELECT * INTO v_reservation FROM public.patient_fund_reservations WHERE id = p_reservation_id;
  IF v_reservation.id IS NULL THEN RAISE EXCEPTION 'Reservation not found'; END IF;
  IF p_allocation_id IS NOT NULL THEN
    SELECT * INTO v_allocation FROM public.payment_allocations WHERE id = p_allocation_id;
  END IF;
  SELECT * INTO v_capacity FROM public.get_payment_fund_capacity_internal(v_reservation.tenant_id, v_reservation.payment_id);
  RETURN jsonb_build_object(
    'status', p_status,
    'reservation', to_jsonb(v_reservation) - 'metadata' - 'operation_fingerprint' - 'release_operation_fingerprint',
    'allocation', CASE WHEN v_allocation.id IS NULL THEN NULL ELSE to_jsonb(v_allocation) - 'metadata' - 'reservation_operation_fingerprint' END,
    'capacity', jsonb_build_object(
      'paymentId', v_reservation.payment_id,
      'patientId', v_reservation.patient_id,
      'currency', v_reservation.currency,
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

CREATE OR REPLACE FUNCTION public.enforce_patient_fund_reservation_internal()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private_finance, pg_temp
AS $$
DECLARE
  v_payment public.payments;
  v_capacity record;
  v_appointment public.appointments;
  v_plan public.treatment_plans;
  v_authorized boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_authorized := public.consume_finance_mutation_authorization_internal('reservation_create', NEW.id);
    IF NOT v_authorized THEN
      RAISE EXCEPTION 'Reservation creation requires create_patient_fund_reservation';
    END IF;
    IF NEW.status <> 'active' OR NEW.consumed_amount <> 0 OR NEW.released_amount <> 0 THEN
      RAISE EXCEPTION 'New reservation must start active and unused';
    END IF;
  ELSE
    IF OLD.status = 'archived' THEN RAISE EXCEPTION 'Archived reservation cannot be mutated'; END IF;
    IF NEW.consumed_amount IS DISTINCT FROM OLD.consumed_amount THEN
      v_authorized := public.consume_finance_mutation_authorization_internal('reservation_consume', NEW.id);
      IF NOT v_authorized THEN RAISE EXCEPTION 'Reservation consumption requires allocate_reserved_credit'; END IF;
    ELSIF NEW.released_amount IS DISTINCT FROM OLD.released_amount THEN
      v_authorized := public.consume_finance_mutation_authorization_internal('reservation_release', NEW.id);
      IF NOT v_authorized THEN RAISE EXCEPTION 'Reservation release requires release_patient_fund_reservation'; END IF;
    ELSIF NEW.status = 'archived' AND OLD.status IN ('fully_used', 'released', 'refunded') THEN
      v_authorized := public.consume_finance_mutation_authorization_internal('reservation_archive', NEW.id);
      IF NOT v_authorized THEN RAISE EXCEPTION 'Reservation archive requires an authorized archive operation'; END IF;
    ELSE
      RAISE EXCEPTION 'Reservation updates require an authoritative reservation operation';
    END IF;

    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.patient_id IS DISTINCT FROM OLD.patient_id
       OR NEW.payment_id IS DISTINCT FROM OLD.payment_id
       OR NEW.currency IS DISTINCT FROM OLD.currency
       OR NEW.original_amount IS DISTINCT FROM OLD.original_amount
       OR NEW.purpose_type IS DISTINCT FROM OLD.purpose_type
       OR NEW.purpose_label IS DISTINCT FROM OLD.purpose_label
       OR NEW.appointment_id IS DISTINCT FROM OLD.appointment_id
       OR NEW.treatment_plan_id IS DISTINCT FROM OLD.treatment_plan_id
       OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
       OR NEW.operation_fingerprint IS DISTINCT FROM OLD.operation_fingerprint
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Reservation identity and original financial facts are immutable';
    END IF;
    IF OLD.status IN ('released', 'refunded') AND NEW.status <> 'archived' THEN
      RAISE EXCEPTION 'Terminal reservation can only be archived';
    END IF;
    IF OLD.status = 'fully_used' AND NEW.status <> 'archived' THEN
      RAISE EXCEPTION 'Fully used reservation can only be archived';
    END IF;
    IF OLD.status = 'active' AND NEW.status NOT IN ('active', 'partially_used', 'fully_used', 'released') THEN
      RAISE EXCEPTION 'Invalid reservation status transition';
    END IF;
    IF OLD.status = 'partially_used' AND NEW.status NOT IN ('partially_used', 'fully_used', 'released') THEN
      RAISE EXCEPTION 'Invalid reservation status transition';
    END IF;
  END IF;

  SELECT * INTO v_payment FROM public.payments
  WHERE id = NEW.payment_id AND tenant_id = NEW.tenant_id FOR UPDATE;
  IF v_payment.id IS NULL
     OR v_payment.patient_id <> NEW.patient_id
     OR upper(btrim(v_payment.currency)) <> upper(btrim(NEW.currency)) THEN
    RAISE EXCEPTION 'Reservation tenant, patient, currency, and payment must match';
  END IF;
  IF v_payment.status IN ('voided', 'archived', 'refunded') THEN
    RAISE EXCEPTION 'Платёж недоступен для резервирования.';
  END IF;

  IF NEW.appointment_id IS NOT NULL THEN
    SELECT * INTO v_appointment FROM public.appointments WHERE id = NEW.appointment_id;
    IF v_appointment.id IS NULL OR v_appointment.tenant_id <> NEW.tenant_id OR v_appointment.patient_id <> NEW.patient_id THEN
      RAISE EXCEPTION 'Appointment purpose does not belong to this patient and tenant';
    END IF;
  END IF;
  IF NEW.treatment_plan_id IS NOT NULL THEN
    SELECT * INTO v_plan FROM public.treatment_plans WHERE id = NEW.treatment_plan_id;
    IF v_plan.id IS NULL OR v_plan.tenant_id <> NEW.tenant_id OR v_plan.patient_id <> NEW.patient_id THEN
      RAISE EXCEPTION 'Treatment plan purpose does not belong to this patient and tenant';
    END IF;
  END IF;

  PERFORM public.lock_payment_capacity_rows_internal(NEW.tenant_id, NEW.payment_id);
  IF NEW.status IN ('active', 'partially_used') THEN
    SELECT * INTO v_capacity FROM public.get_payment_fund_capacity_internal(
      NEW.tenant_id, NEW.payment_id, NULL, CASE WHEN TG_OP = 'UPDATE' THEN NEW.id ELSE NULL END
    );
    IF v_capacity.active_allocated_amount + v_capacity.completed_refund_amount
       + v_capacity.refund_reserved_amount + v_capacity.reserved_deposit_amount
       + NEW.remaining_amount > v_capacity.payment_amount THEN
      RAISE EXCEPTION 'Недостаточно доступного кредита для создания депозита.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS patient_fund_reservations_guard ON public.patient_fund_reservations;
CREATE TRIGGER patient_fund_reservations_guard
BEFORE INSERT OR UPDATE ON public.patient_fund_reservations
FOR EACH ROW EXECUTE FUNCTION public.enforce_patient_fund_reservation_internal();

CREATE OR REPLACE FUNCTION public.create_patient_fund_reservation(
  p_tenant_id uuid,
  p_patient_id uuid,
  p_payment_id uuid,
  p_amount numeric,
  p_purpose_type text,
  p_purpose_label text DEFAULT NULL,
  p_appointment_id uuid DEFAULT NULL,
  p_treatment_plan_id uuid DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment public.payments;
  v_reservation public.patient_fund_reservations;
  v_capacity record;
  v_amount numeric(12,2);
  v_key text;
  v_metadata jsonb;
  v_fingerprint text;
  v_reservation_id uuid := gen_random_uuid();
BEGIN
  PERFORM public.ensure_finance_write_role_internal(
    p_tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role, 'cashier'::public.app_role]
  );
  v_amount := round(COALESCE(p_amount, 0)::numeric, 2)::numeric(12,2);
  IF v_amount <= 0 THEN RAISE EXCEPTION 'Некорректная сумма депозита.'; END IF;
  v_key := btrim(COALESCE(p_idempotency_key, ''));
  IF length(v_key) = 0 OR length(v_key) > 240 THEN RAISE EXCEPTION 'Deposit idempotency key is required'; END IF;
  v_metadata := public.sanitize_finance_metadata_internal(p_metadata);
  IF p_purpose_type NOT IN ('general', 'appointment', 'treatment_plan', 'service', 'other') THEN
    RAISE EXCEPTION 'Unsupported deposit purpose';
  END IF;
  IF p_purpose_type = 'other' AND length(btrim(COALESCE(p_purpose_label, ''))) = 0 THEN
    RAISE EXCEPTION 'Purpose label is required for other deposit purpose';
  END IF;

  v_fingerprint := md5(jsonb_build_object(
    'tenantId', p_tenant_id, 'patientId', p_patient_id, 'paymentId', p_payment_id,
    'amount', v_amount, 'purposeType', p_purpose_type,
    'purposeLabel', nullif(btrim(COALESCE(p_purpose_label, '')), ''),
    'appointmentId', p_appointment_id, 'treatmentPlanId', p_treatment_plan_id,
    'expiresAt', p_expires_at, 'notes', nullif(btrim(COALESCE(p_notes, '')), ''),
    'metadata', v_metadata
  )::text);

  PERFORM pg_advisory_xact_lock(hashtextextended('fund-reservation:create:' || p_tenant_id::text || ':' || v_key, 0));
  SELECT * INTO v_reservation FROM public.patient_fund_reservations
  WHERE tenant_id = p_tenant_id AND idempotency_key = v_key;
  IF v_reservation.id IS NOT NULL THEN
    IF v_reservation.operation_fingerprint <> v_fingerprint THEN
      RAISE EXCEPTION 'Депозит уже создан с другими параметрами.';
    END IF;
    RETURN public.patient_fund_reservation_result_internal(v_reservation.id, 'already_completed');
  END IF;

  SELECT * INTO v_payment FROM public.payments
  WHERE tenant_id = p_tenant_id AND patient_id = p_patient_id AND id = p_payment_id
  FOR UPDATE;
  IF v_payment.id IS NULL OR v_payment.status IN ('voided', 'archived', 'refunded') THEN
    RAISE EXCEPTION 'Платёж недоступен для резервирования.';
  END IF;
  PERFORM public.lock_payment_capacity_rows_internal(p_tenant_id, p_payment_id);
  SELECT * INTO v_capacity FROM public.get_payment_fund_capacity_internal(p_tenant_id, p_payment_id);
  IF v_amount > v_capacity.available_credit_amount THEN
    RAISE EXCEPTION 'Недостаточно доступного кредита для создания депозита.';
  END IF;

  PERFORM public.issue_finance_mutation_authorization_internal('reservation_create', v_reservation_id);
  INSERT INTO public.patient_fund_reservations (
    id, tenant_id, patient_id, payment_id, currency, purpose_type, purpose_label,
    appointment_id, treatment_plan_id, original_amount, expires_at, notes,
    metadata, idempotency_key, operation_fingerprint, created_by
  ) VALUES (
    v_reservation_id, p_tenant_id, p_patient_id, p_payment_id, v_payment.currency, p_purpose_type,
    nullif(btrim(COALESCE(p_purpose_label, '')), ''), p_appointment_id, p_treatment_plan_id,
    v_amount, p_expires_at, nullif(btrim(COALESCE(p_notes, '')), ''), v_metadata,
    v_key, v_fingerprint, auth.uid()
  ) RETURNING * INTO v_reservation;

  PERFORM public.log_finance_event_internal(
    p_tenant_id, 'patient_fund_reservation_created', 'patient_fund_reservation', v_reservation.id,
    p_patient_id, p_payment_id,
    p_metadata => jsonb_build_object(
      'reservationId', v_reservation.id, 'paymentId', p_payment_id,
      'amount', v_amount, 'remainingAmount', v_reservation.remaining_amount,
      'purposeType', v_reservation.purpose_type, 'operationRef', md5(v_key)
    )
  );
  RETURN public.patient_fund_reservation_result_internal(v_reservation.id, 'completed');
END;
$$;

CREATE OR REPLACE FUNCTION public.release_patient_fund_reservation(
  p_tenant_id uuid,
  p_reservation_id uuid,
  p_amount numeric DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_probe public.patient_fund_reservations;
  v_reservation public.patient_fund_reservations;
  v_payment public.payments;
  v_key text;
  v_reason text;
  v_fingerprint text;
  v_before numeric(12,2);
BEGIN
  PERFORM public.ensure_finance_write_role_internal(
    p_tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role]
  );
  v_key := btrim(COALESCE(p_idempotency_key, ''));
  v_reason := btrim(COALESCE(p_reason, ''));
  IF length(v_key) = 0 OR length(v_key) > 240 THEN RAISE EXCEPTION 'Release idempotency key is required'; END IF;
  IF length(v_reason) = 0 THEN RAISE EXCEPTION 'Release reason is required'; END IF;
  IF p_amount IS NOT NULL AND p_amount <= 0 THEN RAISE EXCEPTION 'Release amount must be positive'; END IF;
  v_fingerprint := md5(jsonb_build_object(
    'tenantId', p_tenant_id, 'reservationId', p_reservation_id,
    'amount', p_amount, 'reason', v_reason
  )::text);

  PERFORM pg_advisory_xact_lock(hashtextextended('fund-reservation:release:' || p_tenant_id::text || ':' || v_key, 0));
  SELECT * INTO v_reservation FROM public.patient_fund_reservations
  WHERE tenant_id = p_tenant_id AND release_idempotency_key = v_key;
  IF v_reservation.id IS NOT NULL THEN
    IF v_reservation.id <> p_reservation_id OR v_reservation.release_operation_fingerprint <> v_fingerprint THEN
      RAISE EXCEPTION 'Release idempotency key is already used with different details';
    END IF;
    RETURN public.patient_fund_reservation_result_internal(v_reservation.id, 'already_completed');
  END IF;

  SELECT * INTO v_probe FROM public.patient_fund_reservations
  WHERE tenant_id = p_tenant_id AND id = p_reservation_id;
  IF v_probe.id IS NULL THEN RAISE EXCEPTION 'Reservation not found in this tenant'; END IF;
  SELECT * INTO v_payment FROM public.payments
  WHERE tenant_id = p_tenant_id AND id = v_probe.payment_id FOR UPDATE;
  IF v_payment.id IS NULL THEN RAISE EXCEPTION 'Payment not found in this tenant'; END IF;
  PERFORM public.lock_payment_capacity_rows_internal(p_tenant_id, v_payment.id);
  SELECT * INTO v_reservation FROM public.patient_fund_reservations
  WHERE tenant_id = p_tenant_id AND id = p_reservation_id FOR UPDATE;
  IF v_reservation.status NOT IN ('active', 'partially_used') OR v_reservation.remaining_amount <= 0 THEN
    RAISE EXCEPTION 'Reservation cannot be released';
  END IF;
  IF p_amount IS NOT NULL AND round(p_amount::numeric, 2)::numeric(12,2) <> v_reservation.remaining_amount THEN
    RAISE EXCEPTION 'Only full remaining reservation release is supported';
  END IF;
  v_before := v_reservation.remaining_amount;
  PERFORM public.issue_finance_mutation_authorization_internal('reservation_release', v_reservation.id);

  UPDATE public.patient_fund_reservations
  SET released_amount = released_amount + remaining_amount,
      status = 'released',
      released_by = auth.uid(), released_at = now(), release_reason = v_reason,
      release_idempotency_key = v_key,
      release_operation_fingerprint = v_fingerprint
  WHERE id = v_reservation.id
  RETURNING * INTO v_reservation;

  PERFORM public.log_finance_event_internal(
    p_tenant_id, 'patient_fund_reservation_released', 'patient_fund_reservation', v_reservation.id,
    v_reservation.patient_id, v_reservation.payment_id, v_reason,
    jsonb_build_object(
      'reservationId', v_reservation.id, 'paymentId', v_reservation.payment_id,
      'amount', v_before, 'beforeRemainingAmount', v_before,
      'afterRemainingAmount', v_reservation.remaining_amount,
      'purposeType', v_reservation.purpose_type, 'operationRef', md5(v_key)
    )
  );
  RETURN public.patient_fund_reservation_result_internal(v_reservation.id, 'completed');
END;
$$;

CREATE OR REPLACE FUNCTION public.allocate_reserved_credit(
  p_tenant_id uuid,
  p_patient_id uuid,
  p_reservation_id uuid,
  p_invoice_id uuid,
  p_amount numeric,
  p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_probe public.patient_fund_reservations;
  v_reservation public.patient_fund_reservations;
  v_payment public.payments;
  v_invoice public.invoices;
  v_allocation public.payment_allocations;
  v_amount numeric(12,2);
  v_key text;
  v_fingerprint text;
  v_before numeric(12,2);
  v_event text;
BEGIN
  PERFORM public.ensure_finance_write_role_internal(
    p_tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role, 'cashier'::public.app_role]
  );
  v_amount := round(COALESCE(p_amount, 0)::numeric, 2)::numeric(12,2);
  IF v_amount <= 0 THEN RAISE EXCEPTION 'Allocation amount must be positive'; END IF;
  v_key := btrim(COALESCE(p_idempotency_key, ''));
  IF length(v_key) = 0 OR length(v_key) > 240 THEN RAISE EXCEPTION 'Reservation allocation idempotency key is required'; END IF;
  v_fingerprint := md5(jsonb_build_object(
    'tenantId', p_tenant_id, 'patientId', p_patient_id,
    'reservationId', p_reservation_id, 'invoiceId', p_invoice_id, 'amount', v_amount
  )::text);

  PERFORM pg_advisory_xact_lock(hashtextextended('fund-reservation:consume:' || p_tenant_id::text || ':' || v_key, 0));
  SELECT * INTO v_allocation FROM public.payment_allocations
  WHERE tenant_id = p_tenant_id AND reservation_operation_key = v_key;
  IF v_allocation.id IS NOT NULL THEN
    IF v_allocation.patient_fund_reservation_id <> p_reservation_id
       OR v_allocation.invoice_id <> p_invoice_id
       OR v_allocation.amount <> v_amount
       OR v_allocation.reservation_operation_fingerprint <> v_fingerprint THEN
      RAISE EXCEPTION 'Reservation allocation idempotency key is already used with different details';
    END IF;
    RETURN public.patient_fund_reservation_result_internal(p_reservation_id, 'already_completed', v_allocation.id);
  END IF;

  SELECT * INTO v_probe FROM public.patient_fund_reservations
  WHERE tenant_id = p_tenant_id AND patient_id = p_patient_id AND id = p_reservation_id;
  IF v_probe.id IS NULL THEN RAISE EXCEPTION 'Reservation not found for this patient and tenant'; END IF;
  SELECT * INTO v_payment FROM public.payments
  WHERE tenant_id = p_tenant_id AND patient_id = p_patient_id AND id = v_probe.payment_id FOR UPDATE;
  IF v_payment.id IS NULL OR v_payment.status IN ('voided', 'archived', 'refunded') THEN
    RAISE EXCEPTION 'Payment is not available for reserved allocation';
  END IF;
  PERFORM public.lock_payment_capacity_rows_internal(p_tenant_id, v_payment.id);
  SELECT * INTO v_reservation FROM public.patient_fund_reservations
  WHERE tenant_id = p_tenant_id AND patient_id = p_patient_id AND id = p_reservation_id FOR UPDATE;
  IF v_reservation.status NOT IN ('active', 'partially_used') OR v_amount > v_reservation.remaining_amount THEN
    RAISE EXCEPTION 'Reserved allocation amount exceeds reservation remainder';
  END IF;
  SELECT * INTO v_invoice FROM public.invoices
  WHERE tenant_id = p_tenant_id AND patient_id = p_patient_id AND id = p_invoice_id FOR UPDATE;
  IF v_invoice.id IS NULL THEN RAISE EXCEPTION 'Invoice not found for this patient and tenant'; END IF;
  IF v_invoice.status NOT IN ('issued', 'partially_paid') THEN RAISE EXCEPTION 'Invoice is not available for reserved allocation'; END IF;
  IF upper(btrim(v_invoice.currency)) <> upper(btrim(v_payment.currency)) THEN RAISE EXCEPTION 'Payment and invoice currency mismatch'; END IF;
  v_invoice := public.recalculate_invoice_financials_internal(v_invoice.id);
  IF v_amount > v_invoice.balance_amount THEN RAISE EXCEPTION 'Reserved allocation amount exceeds remaining invoice balance'; END IF;
  v_before := v_reservation.remaining_amount;
  PERFORM public.issue_finance_mutation_authorization_internal('reserved_allocation_insert', v_reservation.id);

  INSERT INTO public.payment_allocations (
    tenant_id, patient_id, payment_id, invoice_id, amount, currency, status,
    metadata, created_by, patient_fund_reservation_id,
    reservation_operation_key, reservation_operation_fingerprint
  ) VALUES (
    p_tenant_id, p_patient_id, v_payment.id, v_invoice.id, v_amount, v_payment.currency, 'active',
    jsonb_build_object('source', 'reserved_credit_allocation', 'patientFundReservationId', v_reservation.id),
    auth.uid(), v_reservation.id, v_key, v_fingerprint
  ) RETURNING * INTO v_allocation;

  PERFORM public.issue_finance_mutation_authorization_internal('reservation_consume', v_reservation.id);
  UPDATE public.patient_fund_reservations
  SET consumed_amount = consumed_amount + v_amount,
      status = CASE WHEN remaining_amount - v_amount = 0 THEN 'fully_used' ELSE 'partially_used' END
  WHERE id = v_reservation.id
  RETURNING * INTO v_reservation;

  PERFORM public.recalculate_payment_status_internal(v_payment.id);
  PERFORM public.recalculate_invoice_financials_internal(v_invoice.id);
  v_event := CASE WHEN v_reservation.status = 'fully_used'
    THEN 'patient_fund_reservation_fully_used'
    ELSE 'patient_fund_reservation_partially_used' END;

  PERFORM public.log_finance_event_internal(
    p_tenant_id, v_event, 'patient_fund_reservation', v_reservation.id,
    p_patient_id, v_payment.id,
    p_metadata => jsonb_build_object(
      'reservationId', v_reservation.id, 'paymentId', v_payment.id,
      'invoiceId', v_invoice.id, 'allocationId', v_allocation.id,
      'amount', v_amount, 'beforeRemainingAmount', v_before,
      'afterRemainingAmount', v_reservation.remaining_amount,
      'purposeType', v_reservation.purpose_type, 'operationRef', md5(v_key)
    )
  );
  PERFORM public.log_finance_event_internal(
    p_tenant_id, 'reserved_credit_allocated', 'payment_allocation', v_allocation.id,
    p_patient_id, v_payment.id,
    p_metadata => jsonb_build_object(
      'reservationId', v_reservation.id, 'paymentId', v_payment.id,
      'invoiceId', v_invoice.id, 'allocationId', v_allocation.id,
      'amount', v_amount, 'remainingAmount', v_reservation.remaining_amount,
      'purposeType', v_reservation.purpose_type, 'operationRef', md5(v_key)
    )
  );
  RETURN public.patient_fund_reservation_result_internal(v_reservation.id, 'completed', v_allocation.id);
END;
$$;
CREATE OR REPLACE FUNCTION public.enforce_payment_allocation_capacity_internal()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment public.payments;
  v_reservation public.patient_fund_reservations;
  v_allocated numeric(12,2);
  v_completed numeric(12,2);
  v_refund_reserved numeric(12,2);
  v_deposit_reserved numeric(12,2);
  v_invoice_id uuid;
  v_invoice_total numeric(12,2);
  v_invoice_allocated numeric(12,2);
  v_writeoffs numeric(12,2);
  v_writeoff_reserved numeric(12,2);
BEGIN
  IF TG_OP = 'UPDATE' AND (
       NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.patient_id IS DISTINCT FROM OLD.patient_id
       OR NEW.payment_id IS DISTINCT FROM OLD.payment_id
       OR NEW.invoice_id IS DISTINCT FROM OLD.invoice_id
       OR NEW.invoice_item_id IS DISTINCT FROM OLD.invoice_item_id
       OR NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.currency IS DISTINCT FROM OLD.currency
       OR NEW.patient_fund_reservation_id IS DISTINCT FROM OLD.patient_fund_reservation_id
       OR NEW.reservation_operation_key IS DISTINCT FROM OLD.reservation_operation_key
       OR NEW.reservation_operation_fingerprint IS DISTINCT FROM OLD.reservation_operation_fingerprint
     ) THEN
    RAISE EXCEPTION 'Payment allocation financial identity is immutable';
  END IF;
  IF TG_OP = 'UPDATE'
     AND OLD.patient_fund_reservation_id IS NOT NULL
     AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Reservation-backed allocations are immutable; use a future controlled correction flow';
  END IF;
  IF NEW.status <> 'active' THEN RETURN NEW; END IF;

  SELECT * INTO v_payment FROM public.payments
  WHERE tenant_id = NEW.tenant_id AND id = NEW.payment_id FOR UPDATE;
  IF v_payment.id IS NULL
     OR v_payment.patient_id <> NEW.patient_id
     OR upper(btrim(v_payment.currency)) <> upper(btrim(NEW.currency)) THEN
    RAISE EXCEPTION 'Payment allocation tenant, patient, and currency must match payment';
  END IF;
  IF v_payment.status IN ('voided', 'archived', 'refunded') THEN
    RAISE EXCEPTION 'Payment is not available for allocation';
  END IF;
  PERFORM public.lock_payment_capacity_rows_internal(NEW.tenant_id, NEW.payment_id);

  v_allocated := public.payment_active_allocation_total_internal(NEW.tenant_id, NEW.payment_id, NEW.id);
  v_completed := public.payment_completed_refund_total_internal(NEW.tenant_id, NEW.payment_id);
  v_refund_reserved := public.payment_reserved_refund_total_internal(NEW.tenant_id, NEW.payment_id);

  IF NEW.patient_fund_reservation_id IS NULL THEN
    v_deposit_reserved := public.payment_active_deposit_reserved_total_internal(NEW.tenant_id, NEW.payment_id);
  ELSE
    IF NOT public.consume_finance_mutation_authorization_internal('reserved_allocation_insert', NEW.patient_fund_reservation_id) THEN
      RAISE EXCEPTION 'Reservation-backed allocation requires allocate_reserved_credit';
    END IF;
    SELECT * INTO v_reservation FROM public.patient_fund_reservations
    WHERE tenant_id = NEW.tenant_id AND id = NEW.patient_fund_reservation_id FOR UPDATE;
    IF v_reservation.id IS NULL
       OR v_reservation.patient_id <> NEW.patient_id
       OR v_reservation.payment_id <> NEW.payment_id
       OR upper(btrim(v_reservation.currency)) <> upper(btrim(NEW.currency))
       OR v_reservation.status NOT IN ('active', 'partially_used')
       OR NEW.amount > v_reservation.remaining_amount THEN
      RAISE EXCEPTION 'Reservation-backed allocation does not match an available reservation';
    END IF;
    v_deposit_reserved := public.payment_active_deposit_reserved_total_internal(
      NEW.tenant_id, NEW.payment_id, v_reservation.id
    ) + (v_reservation.remaining_amount - NEW.amount);
  END IF;

  IF v_allocated + NEW.amount + v_completed + v_refund_reserved + v_deposit_reserved > v_payment.amount THEN
    RAISE EXCEPTION 'Allocation amount exceeds payment capacity after refunds and reservations';
  END IF;

  IF NEW.invoice_id IS NOT NULL THEN
    v_invoice_id := NEW.invoice_id;
  ELSE
    SELECT invoice_id INTO v_invoice_id FROM public.invoice_items
    WHERE tenant_id = NEW.tenant_id AND id = NEW.invoice_item_id;
  END IF;
  IF v_invoice_id IS NOT NULL THEN
    SELECT total_amount INTO v_invoice_total FROM public.invoices
    WHERE tenant_id = NEW.tenant_id AND id = v_invoice_id FOR UPDATE;
    SELECT COALESCE(sum(pa.amount), 0)::numeric(12,2) INTO v_invoice_allocated
    FROM public.payment_allocations pa
    LEFT JOIN public.invoice_items ii ON ii.id = pa.invoice_item_id AND ii.tenant_id = pa.tenant_id
    WHERE pa.tenant_id = NEW.tenant_id AND pa.status = 'active' AND pa.id <> NEW.id
      AND (pa.invoice_id = v_invoice_id OR ii.invoice_id = v_invoice_id);
    v_writeoffs := public.invoice_approved_writeoff_total_internal(NEW.tenant_id, v_invoice_id);
    v_writeoff_reserved := public.invoice_reserved_writeoff_total_internal(NEW.tenant_id, v_invoice_id);
    IF v_invoice_allocated + NEW.amount + v_writeoffs + v_writeoff_reserved > v_invoice_total THEN
      RAISE EXCEPTION 'Allocation amount exceeds invoice capacity after write-offs and reserved write-offs';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payment_allocations_capacity_guard ON public.payment_allocations;
CREATE TRIGGER payment_allocations_capacity_guard
BEFORE INSERT OR UPDATE OF tenant_id, patient_id, payment_id, invoice_id, invoice_item_id, amount, currency, status, patient_fund_reservation_id, reservation_operation_key, reservation_operation_fingerprint
ON public.payment_allocations
FOR EACH ROW EXECUTE FUNCTION public.enforce_payment_allocation_capacity_internal();
CREATE OR REPLACE FUNCTION public.enforce_refund_capacity_internal()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment public.payments;
  v_allocated numeric(12,2);
  v_completed numeric(12,2);
  v_refund_reserved numeric(12,2);
  v_deposit_reserved numeric(12,2);
BEGIN
  IF TG_OP = 'UPDATE' AND (
       NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.patient_id IS DISTINCT FROM OLD.patient_id
       OR NEW.payment_id IS DISTINCT FROM OLD.payment_id
       OR NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.currency IS DISTINCT FROM OLD.currency
       OR NEW.refund_method IS DISTINCT FROM OLD.refund_method
       OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
     ) THEN
    RAISE EXCEPTION 'Refund financial identity is immutable';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NOT public.consume_finance_mutation_authorization_internal('refund_insert', NEW.id) THEN
      RAISE EXCEPTION 'Refund creation requires request_refund';
    END IF;
  ELSE
    IF NOT public.consume_finance_mutation_authorization_internal('refund_update', NEW.id) THEN
      RAISE EXCEPTION 'Refund transition requires an authoritative refund RPC';
    END IF;
  END IF;
  IF NEW.status NOT IN ('pending', 'approved', 'completed') THEN RETURN NEW; END IF;
  SELECT * INTO v_payment FROM public.payments
  WHERE tenant_id = NEW.tenant_id AND id = NEW.payment_id FOR UPDATE;
  IF v_payment.id IS NULL
     OR v_payment.patient_id <> NEW.patient_id
     OR upper(btrim(v_payment.currency)) <> upper(btrim(NEW.currency)) THEN
    RAISE EXCEPTION 'Refund tenant, patient, and currency must match payment';
  END IF;
  IF v_payment.status IN ('voided', 'archived') THEN RAISE EXCEPTION 'Payment is not refundable'; END IF;
  PERFORM public.lock_payment_capacity_rows_internal(NEW.tenant_id, NEW.payment_id);
  v_allocated := public.payment_active_allocation_total_internal(NEW.tenant_id, NEW.payment_id);
  v_completed := public.payment_completed_refund_total_internal(NEW.tenant_id, NEW.payment_id, NEW.id);
  v_refund_reserved := public.payment_reserved_refund_total_internal(NEW.tenant_id, NEW.payment_id, NEW.id);
  v_deposit_reserved := public.payment_active_deposit_reserved_total_internal(NEW.tenant_id, NEW.payment_id);
  IF NEW.status = 'completed' THEN v_completed := v_completed + NEW.amount;
  ELSE v_refund_reserved := v_refund_reserved + NEW.amount;
  END IF;
  IF v_allocated + v_completed + v_refund_reserved + v_deposit_reserved > v_payment.amount THEN
    RAISE EXCEPTION 'Refund amount exceeds payment capacity after allocations and reservations';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS refunds_capacity_guard ON public.refunds;
CREATE TRIGGER refunds_capacity_guard
BEFORE INSERT OR UPDATE OF tenant_id, patient_id, payment_id, amount, currency, refund_method, idempotency_key, status
ON public.refunds
FOR EACH ROW EXECUTE FUNCTION public.enforce_refund_capacity_internal();
CREATE OR REPLACE FUNCTION public.enforce_payment_refund_void_guard_internal()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'voided' AND OLD.status <> 'voided' THEN
    IF EXISTS (
      SELECT 1 FROM public.refunds
      WHERE tenant_id = NEW.tenant_id AND payment_id = NEW.id
        AND status IN ('pending', 'approved', 'completed')
    ) THEN
      RAISE EXCEPTION 'Payment with active or completed refunds cannot be voided';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.patient_fund_reservations
      WHERE tenant_id = NEW.tenant_id AND payment_id = NEW.id
        AND status IN ('active', 'partially_used') AND remaining_amount > 0
    ) THEN
      RAISE EXCEPTION 'Нельзя аннулировать платёж с активным депозитом.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_refund_void_guard ON public.payments;
CREATE TRIGGER payments_refund_void_guard
BEFORE UPDATE OF status ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.enforce_payment_refund_void_guard_internal();
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
  v_capacity record;
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

  PERFORM public.lock_payment_capacity_rows_internal(p_tenant_id, p_payment_id);
  SELECT * INTO v_capacity
  FROM public.get_payment_fund_capacity_internal(p_tenant_id, p_payment_id);

  IF p_amount > v_capacity.available_credit_amount THEN
    IF v_capacity.reserved_deposit_amount > 0 THEN
      RAISE EXCEPTION 'Часть средств зарезервирована как депозит. Сначала освободите резерв.';
    END IF;
    RAISE EXCEPTION 'Allocation amount exceeds available payment capacity';
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
  v_deposit_reserved numeric(12,2);
  v_refund_id uuid := gen_random_uuid();
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

  PERFORM public.lock_payment_capacity_rows_internal(p_tenant_id, p_payment_id);
  v_refundable := public.payment_refundable_amount_internal(p_tenant_id, p_payment_id);
  v_deposit_reserved := public.payment_active_deposit_reserved_total_internal(p_tenant_id, p_payment_id);
  IF p_amount > v_refundable THEN
    IF v_deposit_reserved > 0 THEN
      RAISE EXCEPTION 'Часть средств зарезервирована как депозит. Сначала освободите резерв.';
    END IF;
    RAISE EXCEPTION 'Refund amount exceeds currently unallocated refundable amount';
  END IF;

  PERFORM public.issue_finance_mutation_authorization_internal('refund_insert', v_refund_id);
  INSERT INTO public.refunds (
    id, tenant_id, patient_id, payment_id, status, refund_method, amount, currency,
    reason, requested_by, requested_at, metadata, idempotency_key
  ) VALUES (
    v_refund_id, p_tenant_id, v_payment.patient_id, v_payment.id, 'pending', p_refund_method,
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
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private_finance, pg_temp
AS $$
DECLARE
  v_probe public.refunds;
  v_refund public.refunds;
  v_payment public.payments;
  v_refundable numeric(12,2);
BEGIN
  PERFORM public.ensure_finance_write_role_internal(p_tenant_id, ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role]);
  SELECT * INTO v_probe FROM public.refunds WHERE tenant_id = p_tenant_id AND id = p_refund_id;
  IF v_probe.id IS NULL THEN RAISE EXCEPTION 'Refund not found in this tenant'; END IF;
  SELECT * INTO v_payment FROM public.payments WHERE tenant_id = p_tenant_id AND id = v_probe.payment_id FOR UPDATE;
  IF v_payment.id IS NULL THEN RAISE EXCEPTION 'Payment not found in this tenant'; END IF;
  PERFORM public.lock_payment_capacity_rows_internal(p_tenant_id, v_payment.id);
  SELECT * INTO v_refund FROM public.refunds WHERE tenant_id = p_tenant_id AND id = p_refund_id FOR UPDATE;
  IF v_refund.payment_id <> v_payment.id THEN RAISE EXCEPTION 'Refund payment changed during transition'; END IF;
  IF v_refund.status IN ('approved', 'completed') THEN RETURN v_refund; END IF;
  IF v_refund.status <> 'pending' THEN RAISE EXCEPTION 'Only pending refunds can be approved'; END IF;
  IF v_payment.status IN ('voided', 'archived') THEN RAISE EXCEPTION 'Cannot approve refund for payment with status %', v_payment.status; END IF;
  v_refundable := public.payment_refundable_amount_internal(p_tenant_id, v_payment.id, v_refund.id);
  IF v_refund.amount > v_refundable THEN RAISE EXCEPTION 'Refund amount exceeds currently refundable amount'; END IF;
  PERFORM public.issue_finance_mutation_authorization_internal('refund_update', v_refund.id);
  UPDATE public.refunds SET status='approved', approved_by=auth.uid(), approved_at=now()
  WHERE id=v_refund.id RETURNING * INTO v_refund;
  PERFORM public.log_finance_event_internal(p_tenant_id,'refund_approved','refund',v_refund.id,v_refund.patient_id,v_refund.payment_id,
    p_metadata=>jsonb_build_object('refundId',v_refund.id,'paymentId',v_refund.payment_id,'amount',v_refund.amount,'currency',v_refund.currency,'fromStatus','pending','toStatus','approved'));
  RETURN v_refund;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_refund(
  p_tenant_id uuid,
  p_refund_id uuid,
  p_external_reference text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS public.refunds
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private_finance, pg_temp
AS $$
DECLARE
  v_probe public.refunds;
  v_refund public.refunds;
  v_payment public.payments;
  v_metadata jsonb;
  v_refundable numeric(12,2);
BEGIN
  PERFORM public.ensure_finance_write_role_internal(p_tenant_id, ARRAY['clinic_owner'::public.app_role,'clinic_admin'::public.app_role,'cashier'::public.app_role]);
  v_metadata := public.sanitize_finance_metadata_internal(p_metadata);
  SELECT * INTO v_probe FROM public.refunds WHERE tenant_id=p_tenant_id AND id=p_refund_id;
  IF v_probe.id IS NULL THEN RAISE EXCEPTION 'Refund not found in this tenant'; END IF;
  SELECT * INTO v_payment FROM public.payments WHERE tenant_id=p_tenant_id AND id=v_probe.payment_id FOR UPDATE;
  IF v_payment.id IS NULL THEN RAISE EXCEPTION 'Payment not found in this tenant'; END IF;
  PERFORM public.lock_payment_capacity_rows_internal(p_tenant_id,v_payment.id);
  SELECT * INTO v_refund FROM public.refunds WHERE tenant_id=p_tenant_id AND id=p_refund_id FOR UPDATE;
  IF v_refund.payment_id <> v_payment.id THEN RAISE EXCEPTION 'Refund payment changed during transition'; END IF;
  IF v_refund.status='completed' THEN RETURN v_refund; END IF;
  IF v_refund.status<>'approved' THEN RAISE EXCEPTION 'Only approved refunds can be completed'; END IF;
  IF v_payment.status IN ('voided','archived') THEN RAISE EXCEPTION 'Cannot complete refund for payment with status %',v_payment.status; END IF;
  v_refundable := public.payment_refundable_amount_internal(p_tenant_id,v_payment.id,v_refund.id);
  IF v_refund.amount > v_refundable THEN RAISE EXCEPTION 'Refund amount exceeds currently refundable amount'; END IF;
  PERFORM public.issue_finance_mutation_authorization_internal('refund_update',v_refund.id);
  UPDATE public.refunds SET status='completed',completed_by=auth.uid(),completed_at=now(),
    external_reference=COALESCE(NULLIF(btrim(p_external_reference),''),external_reference),
    metadata=public.sanitize_finance_metadata_internal(metadata||v_metadata)
  WHERE id=v_refund.id RETURNING * INTO v_refund;
  PERFORM public.recalculate_payment_status_internal(v_payment.id);
  PERFORM public.log_finance_event_internal(p_tenant_id,'refund_completed','refund',v_refund.id,v_refund.patient_id,v_refund.payment_id,
    p_metadata=>jsonb_build_object('refundId',v_refund.id,'paymentId',v_refund.payment_id,'amount',v_refund.amount,'currency',v_refund.currency,'fromStatus','approved','toStatus','completed','externalReference',v_refund.external_reference));
  RETURN v_refund;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_refund(
  p_tenant_id uuid,
  p_refund_id uuid,
  p_reason text
) RETURNS public.refunds
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private_finance, pg_temp
AS $$
DECLARE
  v_probe public.refunds;
  v_refund public.refunds;
  v_payment public.payments;
  v_reason text;
BEGIN
  PERFORM public.ensure_finance_write_role_internal(p_tenant_id,ARRAY['clinic_owner'::public.app_role,'clinic_admin'::public.app_role]);
  v_reason:=NULLIF(btrim(p_reason),''); IF v_reason IS NULL THEN RAISE EXCEPTION 'Rejection reason is required'; END IF;
  SELECT * INTO v_probe FROM public.refunds WHERE tenant_id=p_tenant_id AND id=p_refund_id;
  IF v_probe.id IS NULL THEN RAISE EXCEPTION 'Refund not found in this tenant'; END IF;
  SELECT * INTO v_payment FROM public.payments WHERE tenant_id=p_tenant_id AND id=v_probe.payment_id FOR UPDATE;
  IF v_payment.id IS NULL THEN RAISE EXCEPTION 'Payment not found in this tenant'; END IF;
  PERFORM public.lock_payment_capacity_rows_internal(p_tenant_id,v_payment.id);
  SELECT * INTO v_refund FROM public.refunds WHERE tenant_id=p_tenant_id AND id=p_refund_id FOR UPDATE;
  IF v_refund.payment_id <> v_payment.id THEN RAISE EXCEPTION 'Refund payment changed during transition'; END IF;
  IF v_refund.status='rejected' THEN RETURN v_refund; END IF;
  IF v_refund.status<>'pending' THEN RAISE EXCEPTION 'Only pending refunds can be rejected'; END IF;
  PERFORM public.issue_finance_mutation_authorization_internal('refund_update',v_refund.id);
  UPDATE public.refunds SET status='rejected',rejected_at=now(),metadata=public.sanitize_finance_metadata_internal(metadata||jsonb_build_object('rejectionReason',v_reason,'rejectedBy',auth.uid(),'rejectedAt',now()))
  WHERE id=v_refund.id RETURNING * INTO v_refund;
  PERFORM public.log_finance_event_internal(p_tenant_id,'refund_rejected','refund',v_refund.id,v_refund.patient_id,v_refund.payment_id,v_reason,
    jsonb_build_object('refundId',v_refund.id,'paymentId',v_refund.payment_id,'amount',v_refund.amount,'currency',v_refund.currency,'fromStatus','pending','toStatus','rejected'));
  RETURN v_refund;
END;
$$;

CREATE OR REPLACE FUNCTION public.void_refund(
  p_tenant_id uuid,
  p_refund_id uuid,
  p_reason text
) RETURNS public.refunds
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private_finance, pg_temp
AS $$
DECLARE
  v_probe public.refunds;
  v_refund public.refunds;
  v_payment public.payments;
  v_reason text;
  v_from_status text;
BEGIN
  PERFORM public.ensure_finance_write_role_internal(p_tenant_id,ARRAY['clinic_owner'::public.app_role,'clinic_admin'::public.app_role]);
  v_reason:=NULLIF(btrim(p_reason),''); IF v_reason IS NULL THEN RAISE EXCEPTION 'Void reason is required'; END IF;
  SELECT * INTO v_probe FROM public.refunds WHERE tenant_id=p_tenant_id AND id=p_refund_id;
  IF v_probe.id IS NULL THEN RAISE EXCEPTION 'Refund not found in this tenant'; END IF;
  SELECT * INTO v_payment FROM public.payments WHERE tenant_id=p_tenant_id AND id=v_probe.payment_id FOR UPDATE;
  IF v_payment.id IS NULL THEN RAISE EXCEPTION 'Payment not found in this tenant'; END IF;
  PERFORM public.lock_payment_capacity_rows_internal(p_tenant_id,v_payment.id);
  SELECT * INTO v_refund FROM public.refunds WHERE tenant_id=p_tenant_id AND id=p_refund_id FOR UPDATE;
  IF v_refund.payment_id <> v_payment.id THEN RAISE EXCEPTION 'Refund payment changed during transition'; END IF;
  IF v_refund.status='voided' THEN RETURN v_refund; END IF;
  IF v_refund.status='completed' THEN RAISE EXCEPTION 'Completed refunds are immutable and cannot be voided'; END IF;
  IF v_refund.status NOT IN ('pending','approved') THEN RAISE EXCEPTION 'Only pending or approved refunds can be voided'; END IF;
  v_from_status:=v_refund.status;
  PERFORM public.issue_finance_mutation_authorization_internal('refund_update',v_refund.id);
  UPDATE public.refunds SET status='voided',voided_by=auth.uid(),voided_at=now(),void_reason=v_reason
  WHERE id=v_refund.id RETURNING * INTO v_refund;
  PERFORM public.log_finance_event_internal(p_tenant_id,'refund_voided','refund',v_refund.id,v_refund.patient_id,v_refund.payment_id,v_reason,
    jsonb_build_object('refundId',v_refund.id,'paymentId',v_refund.payment_id,'amount',v_refund.amount,'currency',v_refund.currency,'fromStatus',v_from_status,'toStatus','voided'));
  RETURN v_refund;
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
  IF v_allocation.patient_fund_reservation_id IS NOT NULL THEN
    RAISE EXCEPTION 'Reservation-backed allocation cannot be voided by the generic allocation flow';
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
  IF EXISTS (SELECT 1 FROM public.patient_fund_reservations WHERE tenant_id = p_tenant_id AND payment_id = p_payment_id AND status IN ('active', 'partially_used') AND remaining_amount > 0) THEN
    RAISE EXCEPTION 'Нельзя аннулировать платёж с активным депозитом.';
  END IF;

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
  active_deposit_reservations AS (
    SELECT r.payment_id, COALESCE(sum(r.remaining_amount), 0)::numeric(18,2) AS reserved_amount
    FROM public.patient_fund_reservations r
    JOIN valid_payments vp ON vp.id = r.payment_id
    WHERE r.tenant_id = p_tenant_id
      AND r.patient_id = p_patient_id
      AND r.status IN ('active', 'partially_used')
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
      COALESCE(dr.reserved_amount, 0)::numeric(18,2) AS deposit_reserved_amount,
      GREATEST(0, vp.amount - COALESCE(pa.allocated_amount, 0) - COALESCE(cr.completed_amount, 0))::numeric(18,2) AS gross_unallocated,
      GREATEST(0, vp.amount - COALESCE(pa.allocated_amount, 0) - COALESCE(cr.completed_amount, 0) - COALESCE(rr.reserved_amount, 0) - COALESCE(dr.reserved_amount, 0))::numeric(18,2) AS available_credit,
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
    LEFT JOIN active_deposit_reservations dr ON dr.payment_id = vp.id
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
      COALESCE((SELECT sum(deposit_reserved_amount) FROM payment_facts p WHERE p.summary_currency = ck.currency), 0)::numeric(18,2) AS reserved_deposit,
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
      'code', 'DEPOSIT_RESERVATION_EXCEEDS_CAPACITY', 'currency', summary_currency,
      'entityType', 'payment', 'entityId', id,
      'details', jsonb_build_object(
        'reservedDepositAmount', deposit_reserved_amount,
        'availableBeforeDeposit', GREATEST(0, amount - allocated_amount - completed_amount - reserved_amount)
      )
    )
    FROM payment_facts
    WHERE deposit_reserved_amount > GREATEST(0, amount - allocated_amount - completed_amount - reserved_amount)
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
    'modelVersion', 'finance-summary-v2',
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
        'reservedDepositAmount', reserved_deposit,
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
COMMENT ON TABLE public.patient_fund_reservations IS
  'Payment-linked purpose reservation. It blocks derived payment capacity but never records receipt of money.';
COMMENT ON COLUMN public.patient_fund_reservations.remaining_amount IS
  'Derived unconsumed and unreleased reservation remainder; active/partially_used remainder reduces available credit.';
COMMENT ON COLUMN public.payment_allocations.patient_fund_reservation_id IS
  'Optional immutable link used only by allocate_reserved_credit; generic allocations must leave reserved capacity untouched.';

REVOKE ALL ON FUNCTION public.issue_finance_mutation_authorization_internal(text, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.consume_finance_mutation_authorization_internal(text, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SCHEMA private_finance FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE private_finance.mutation_authorizations FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.payment_active_deposit_reserved_total_internal(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lock_payment_capacity_rows_internal(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_payment_fund_capacity_internal(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.patient_fund_reservation_result_internal(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_patient_fund_reservation_internal() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_refund_capacity_internal() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.get_payment_fund_capacity(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_patient_fund_reservations(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_patient_fund_reservation(uuid, uuid, uuid, numeric, text, text, uuid, uuid, timestamptz, text, jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.release_patient_fund_reservation(uuid, uuid, numeric, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.allocate_reserved_credit(uuid, uuid, uuid, uuid, numeric, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_payment_fund_capacity(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_patient_fund_reservations(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_patient_fund_reservation(uuid, uuid, uuid, numeric, text, text, uuid, uuid, timestamptz, text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_patient_fund_reservation(uuid, uuid, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_reserved_credit(uuid, uuid, uuid, uuid, numeric, text) TO authenticated;
