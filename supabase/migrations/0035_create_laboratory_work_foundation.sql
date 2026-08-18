-- 0035_create_laboratory_work_foundation.sql
-- Schema-only foundation for tenant-scoped dental laboratory operations.
--
-- Domain boundary:
-- - laboratory_work_order = operational production/coordination fact;
-- - treatment plan/stage = intended care, not the laboratory order;
-- - completed service = performed clinical fact, not the laboratory order;
-- - invoice/payment = separate patient finance facts;
-- - warehouse movement = separate inventory fact;
-- - laboratory payment/cost semantics are intentionally NOT modeled here.

CREATE TABLE IF NOT EXISTS public.laboratories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT laboratories_name_non_empty_check
    CHECK (length(btrim(name)) > 0),
  UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS public.laboratory_work_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT laboratory_work_types_name_non_empty_check
    CHECK (length(btrim(name)) > 0),
  CONSTRAINT laboratory_work_types_code_non_empty_check
    CHECK (code IS NULL OR length(btrim(code)) > 0),
  UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS public.laboratory_work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  responsible_doctor_id uuid,
  laboratory_id uuid,
  order_number text,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'in_progress',
  sent_to_lab_at timestamptz,
  planned_ready_at timestamptz,
  received_from_lab_at timestamptz,
  try_in_at timestamptz,
  delivered_to_patient_at timestamptz,
  shade text,
  anatomical_scope text,
  selected_teeth integer[] NOT NULL DEFAULT '{}'::integer[],
  comment text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT laboratory_work_orders_patient_fk
    FOREIGN KEY (tenant_id, patient_id)
    REFERENCES public.patients(tenant_id, id)
    ON DELETE CASCADE,
  CONSTRAINT laboratory_work_orders_doctor_fk
    FOREIGN KEY (tenant_id, responsible_doctor_id)
    REFERENCES public.doctors(tenant_id, id)
    ON DELETE SET NULL (responsible_doctor_id),
  CONSTRAINT laboratory_work_orders_laboratory_fk
    FOREIGN KEY (tenant_id, laboratory_id)
    REFERENCES public.laboratories(tenant_id, id)
    ON DELETE SET NULL (laboratory_id),
  CONSTRAINT laboratory_work_orders_title_non_empty_check
    CHECK (length(btrim(title)) > 0),
  CONSTRAINT laboratory_work_orders_order_number_non_empty_check
    CHECK (order_number IS NULL OR length(btrim(order_number)) > 0),
  CONSTRAINT laboratory_work_orders_status_check
    CHECK (status IN ('in_progress', 'completed')),
  CONSTRAINT laboratory_work_orders_anatomical_scope_check
    CHECK (
      anatomical_scope IS NULL
      OR anatomical_scope IN ('upper_jaw', 'lower_jaw', 'oral_cavity', 'selected_teeth')
    ),
  CONSTRAINT laboratory_work_orders_selected_teeth_fdi_check
    CHECK (
      selected_teeth <@ ARRAY[
        11,12,13,14,15,16,17,18,
        21,22,23,24,25,26,27,28,
        31,32,33,34,35,36,37,38,
        41,42,43,44,45,46,47,48,
        51,52,53,54,55,
        61,62,63,64,65,
        71,72,73,74,75,
        81,82,83,84,85
      ]::integer[]
    ),
  UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS public.laboratory_work_order_types (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  laboratory_work_order_id uuid NOT NULL,
  laboratory_work_type_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT laboratory_work_order_types_order_fk
    FOREIGN KEY (tenant_id, laboratory_work_order_id)
    REFERENCES public.laboratory_work_orders(tenant_id, id)
    ON DELETE CASCADE,
  CONSTRAINT laboratory_work_order_types_type_fk
    FOREIGN KEY (tenant_id, laboratory_work_type_id)
    REFERENCES public.laboratory_work_types(tenant_id, id)
    ON DELETE CASCADE,
  PRIMARY KEY (tenant_id, laboratory_work_order_id, laboratory_work_type_id)
);

-- Operational lookup indexes. No global laboratory/type uniqueness is imposed:
-- clinic vocabularies remain tenant-configurable and normalization is deferred.
CREATE INDEX IF NOT EXISTS idx_laboratories_tenant_active_name
  ON public.laboratories(tenant_id, active, name);

CREATE INDEX IF NOT EXISTS idx_laboratory_work_types_tenant_active_sort
  ON public.laboratory_work_types(tenant_id, active, sort_order, name);

CREATE INDEX IF NOT EXISTS idx_laboratory_work_orders_tenant_patient
  ON public.laboratory_work_orders(tenant_id, patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_laboratory_work_orders_tenant_doctor
  ON public.laboratory_work_orders(tenant_id, responsible_doctor_id, created_at DESC)
  WHERE responsible_doctor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_laboratory_work_orders_tenant_laboratory
  ON public.laboratory_work_orders(tenant_id, laboratory_id, created_at DESC)
  WHERE laboratory_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_laboratory_work_orders_tenant_status_ready
  ON public.laboratory_work_orders(tenant_id, status, planned_ready_at);

CREATE INDEX IF NOT EXISTS idx_laboratory_work_order_types_type
  ON public.laboratory_work_order_types(tenant_id, laboratory_work_type_id, laboratory_work_order_id);

-- Reuse the existing project-wide timestamp helper introduced by the clinical model.
DROP TRIGGER IF EXISTS laboratories_set_updated_at ON public.laboratories;
CREATE TRIGGER laboratories_set_updated_at
BEFORE UPDATE ON public.laboratories
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS laboratory_work_types_set_updated_at ON public.laboratory_work_types;
CREATE TRIGGER laboratory_work_types_set_updated_at
BEFORE UPDATE ON public.laboratory_work_types
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS laboratory_work_orders_set_updated_at ON public.laboratory_work_orders;
CREATE TRIGGER laboratory_work_orders_set_updated_at
BEFORE UPDATE ON public.laboratory_work_orders
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.laboratories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laboratory_work_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laboratory_work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laboratory_work_order_types ENABLE ROW LEVEL SECURITY;

-- Reference data: owner/admin maintain; operational clinical staff can read.
CREATE POLICY laboratories_select
ON public.laboratories
FOR SELECT
USING (
  public.has_tenant_role(
    tenant_id,
    ARRAY['clinic_owner'::app_role, 'clinic_admin'::app_role, 'doctor'::app_role, 'registrar'::app_role]
  )
);

CREATE POLICY laboratories_insert_admin
ON public.laboratories
FOR INSERT
WITH CHECK (
  public.has_tenant_role(
    tenant_id,
    ARRAY['clinic_owner'::app_role, 'clinic_admin'::app_role]
  )
);

CREATE POLICY laboratories_update_admin
ON public.laboratories
FOR UPDATE
USING (
  public.has_tenant_role(
    tenant_id,
    ARRAY['clinic_owner'::app_role, 'clinic_admin'::app_role]
  )
)
WITH CHECK (
  public.has_tenant_role(
    tenant_id,
    ARRAY['clinic_owner'::app_role, 'clinic_admin'::app_role]
  )
);

CREATE POLICY laboratories_delete_admin
ON public.laboratories
FOR DELETE
USING (
  public.has_tenant_role(
    tenant_id,
    ARRAY['clinic_owner'::app_role, 'clinic_admin'::app_role]
  )
);

CREATE POLICY laboratory_work_types_select
ON public.laboratory_work_types
FOR SELECT
USING (
  public.has_tenant_role(
    tenant_id,
    ARRAY['clinic_owner'::app_role, 'clinic_admin'::app_role, 'doctor'::app_role, 'registrar'::app_role]
  )
);

CREATE POLICY laboratory_work_types_insert_admin
ON public.laboratory_work_types
FOR INSERT
WITH CHECK (
  public.has_tenant_role(
    tenant_id,
    ARRAY['clinic_owner'::app_role, 'clinic_admin'::app_role]
  )
);

CREATE POLICY laboratory_work_types_update_admin
ON public.laboratory_work_types
FOR UPDATE
USING (
  public.has_tenant_role(
    tenant_id,
    ARRAY['clinic_owner'::app_role, 'clinic_admin'::app_role]
  )
)
WITH CHECK (
  public.has_tenant_role(
    tenant_id,
    ARRAY['clinic_owner'::app_role, 'clinic_admin'::app_role]
  )
);

CREATE POLICY laboratory_work_types_delete_admin
ON public.laboratory_work_types
FOR DELETE
USING (
  public.has_tenant_role(
    tenant_id,
    ARRAY['clinic_owner'::app_role, 'clinic_admin'::app_role]
  )
);

-- Orders: owner/admin/doctor/registrar operate; hard delete remains admin-only.
CREATE POLICY laboratory_work_orders_select
ON public.laboratory_work_orders
FOR SELECT
USING (
  public.has_tenant_role(
    tenant_id,
    ARRAY['clinic_owner'::app_role, 'clinic_admin'::app_role, 'doctor'::app_role, 'registrar'::app_role]
  )
);

CREATE POLICY laboratory_work_orders_insert
ON public.laboratory_work_orders
FOR INSERT
WITH CHECK (
  public.has_tenant_role(
    tenant_id,
    ARRAY['clinic_owner'::app_role, 'clinic_admin'::app_role, 'doctor'::app_role, 'registrar'::app_role]
  )
);

CREATE POLICY laboratory_work_orders_update
ON public.laboratory_work_orders
FOR UPDATE
USING (
  public.has_tenant_role(
    tenant_id,
    ARRAY['clinic_owner'::app_role, 'clinic_admin'::app_role, 'doctor'::app_role, 'registrar'::app_role]
  )
)
WITH CHECK (
  public.has_tenant_role(
    tenant_id,
    ARRAY['clinic_owner'::app_role, 'clinic_admin'::app_role, 'doctor'::app_role, 'registrar'::app_role]
  )
);

CREATE POLICY laboratory_work_orders_delete_admin
ON public.laboratory_work_orders
FOR DELETE
USING (
  public.has_tenant_role(
    tenant_id,
    ARRAY['clinic_owner'::app_role, 'clinic_admin'::app_role]
  )
);

-- Order/type membership is part of editing the operational order specification,
-- so clinical operational roles may add/remove relation rows.
CREATE POLICY laboratory_work_order_types_select
ON public.laboratory_work_order_types
FOR SELECT
USING (
  public.has_tenant_role(
    tenant_id,
    ARRAY['clinic_owner'::app_role, 'clinic_admin'::app_role, 'doctor'::app_role, 'registrar'::app_role]
  )
);

CREATE POLICY laboratory_work_order_types_insert
ON public.laboratory_work_order_types
FOR INSERT
WITH CHECK (
  public.has_tenant_role(
    tenant_id,
    ARRAY['clinic_owner'::app_role, 'clinic_admin'::app_role, 'doctor'::app_role, 'registrar'::app_role]
  )
);

CREATE POLICY laboratory_work_order_types_delete
ON public.laboratory_work_order_types
FOR DELETE
USING (
  public.has_tenant_role(
    tenant_id,
    ARRAY['clinic_owner'::app_role, 'clinic_admin'::app_role, 'doctor'::app_role, 'registrar'::app_role]
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.laboratories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.laboratory_work_types TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.laboratory_work_orders TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.laboratory_work_order_types TO authenticated;

GRANT ALL ON TABLE public.laboratories TO service_role;
GRANT ALL ON TABLE public.laboratory_work_types TO service_role;
GRANT ALL ON TABLE public.laboratory_work_orders TO service_role;
GRANT ALL ON TABLE public.laboratory_work_order_types TO service_role;

COMMENT ON TABLE public.laboratories IS
  'Tenant-scoped dental laboratories used by operational laboratory work orders.';
COMMENT ON TABLE public.laboratory_work_types IS
  'Tenant-configurable laboratory production/work type vocabulary; not a global clinical enum.';
COMMENT ON TABLE public.laboratory_work_orders IS
  'Operational laboratory production orders. Separate from treatment plan, performed service, patient finance, and warehouse truth.';
COMMENT ON COLUMN public.laboratory_work_orders.status IS
  'Intentionally small initial lifecycle observed structurally in MacDent: in_progress or completed.';
COMMENT ON COLUMN public.laboratory_work_orders.selected_teeth IS
  'Manufacturing/anatomical scope only; this is not a second dental chart.';
COMMENT ON TABLE public.laboratory_work_order_types IS
  'Many-to-many assignment of tenant-configurable laboratory work types to one laboratory work order.';
