-- 0012_create_audit_activity_log.sql
-- Schema-only foundation for richer audit/activity logging.
-- Existing public.audit_logs is intentionally preserved as the legacy/minimal scaffold.

CREATE TABLE IF NOT EXISTS public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id),
  actor_role text,
  actor_tenant_role text,
  actor_display_name text,
  action text NOT NULL,
  category text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  target_type text NOT NULL,
  target_id text NOT NULL,
  patient_id uuid,
  appointment_id text,
  visit_id uuid,
  encounter_id uuid,
  treatment_plan_id text,
  treatment_stage_id text,
  finding_id text,
  file_id text,
  payment_id text,
  stock_movement_id text,
  before_data jsonb,
  after_data jsonb,
  diff_data jsonb,
  redaction_level text NOT NULL DEFAULT 'standard',
  reason text,
  request_id text,
  session_id text,
  ip_address text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_events_patient_fk
    FOREIGN KEY (tenant_id, patient_id) REFERENCES public.patients(tenant_id, id) ON DELETE SET NULL,
  CONSTRAINT audit_events_action_non_empty CHECK (length(btrim(action)) > 0),
  CONSTRAINT audit_events_target_type_non_empty CHECK (length(btrim(target_type)) > 0),
  CONSTRAINT audit_events_target_id_non_empty CHECK (length(btrim(target_id)) > 0),
  CONSTRAINT audit_events_category_check CHECK (category IN (
    'auth',
    'tenant',
    'role_membership',
    'patient',
    'appointment',
    'visit',
    'encounter',
    'finding',
    'treatment_plan',
    'completed_service',
    'file',
    'document',
    'payment',
    'stock',
    'dictionary',
    'billing_subscription',
    'system',
    'support_access'
  )),
  CONSTRAINT audit_events_severity_check CHECK (severity IN ('debug', 'info', 'warning', 'critical')),
  CONSTRAINT audit_events_redaction_level_check CHECK (redaction_level IN ('none', 'standard', 'restricted', 'confidential')),
  CONSTRAINT audit_events_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT audit_events_before_data_object_check CHECK (before_data IS NULL OR jsonb_typeof(before_data) = 'object'),
  CONSTRAINT audit_events_after_data_object_check CHECK (after_data IS NULL OR jsonb_typeof(after_data) = 'object'),
  CONSTRAINT audit_events_diff_data_object_check CHECK (diff_data IS NULL OR jsonb_typeof(diff_data) = 'object')
);

CREATE TABLE IF NOT EXISTS public.activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id uuid,
  audit_event_id uuid REFERENCES public.audit_events(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES auth.users(id),
  category text NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  description text,
  source_type text NOT NULL,
  source_id text NOT NULL,
  source_status text,
  visibility text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_events_patient_fk
    FOREIGN KEY (tenant_id, patient_id) REFERENCES public.patients(tenant_id, id) ON DELETE SET NULL,
  CONSTRAINT activity_events_category_check CHECK (category IN (
    'patient',
    'complaint',
    'dental_chart',
    'finding',
    'treatment_plan',
    'appointment',
    'visit',
    'encounter',
    'completed_service',
    'file',
    'document',
    'payment',
    'stock',
    'audit',
    'system'
  )),
  CONSTRAINT activity_events_visibility_check CHECK (visibility IN ('clinical', 'admin', 'financial', 'system')),
  CONSTRAINT activity_events_severity_check CHECK (severity IN ('debug', 'info', 'warning', 'critical')),
  CONSTRAINT activity_events_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT activity_events_type_non_empty CHECK (length(btrim(type)) > 0),
  CONSTRAINT activity_events_title_non_empty CHECK (length(btrim(title)) > 0),
  CONSTRAINT activity_events_source_type_non_empty CHECK (length(btrim(source_type)) > 0),
  CONSTRAINT activity_events_source_id_non_empty CHECK (length(btrim(source_id)) > 0)
);

COMMENT ON TABLE public.audit_events IS 'Append-only compliance/security audit log. Patient timeline must not render raw audit diffs directly.';
COMMENT ON TABLE public.activity_events IS 'Safe product-facing activity projection for future patient timeline and admin activity feeds.';
COMMENT ON COLUMN public.audit_events.tenant_id IS 'Tenant scope. NULL is reserved only for future platform/global events and is not broadly visible.';
COMMENT ON COLUMN public.activity_events.tenant_id IS 'Required tenant scope for product-facing activity events.';
COMMENT ON COLUMN public.audit_events.before_data IS 'Optional safe/redacted before-state object. Never store passwords, service role keys, tokens, or full file contents.';
COMMENT ON COLUMN public.audit_events.after_data IS 'Optional safe/redacted after-state object. Never store passwords, service role keys, tokens, or full file contents.';
COMMENT ON COLUMN public.audit_events.diff_data IS 'Optional safe/redacted diff object. Raw medical/financial diffs must be role-restricted by future viewers.';
COMMENT ON COLUMN public.audit_events.redaction_level IS 'Marks how sensitive the payload is: none, standard, restricted, or confidential.';
COMMENT ON COLUMN public.audit_events.reason IS 'Optional reason for correction or sensitive action. Future high-risk write paths should require it.';
COMMENT ON COLUMN public.activity_events.audit_event_id IS 'Optional link to source audit event. Timeline should render summarized activity, not raw audit details.';
COMMENT ON COLUMN public.activity_events.visibility IS 'Role-facing visibility bucket for future timeline/activity feeds.';
COMMENT ON COLUMN public.activity_events.metadata IS 'Safe product metadata only. Do not store secrets, raw file contents, or broad PHI dumps.';

CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_created_at
  ON public.audit_events (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_patient_created_at
  ON public.audit_events (patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor_created_at
  ON public.audit_events (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_target
  ON public.audit_events (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_category_created_at
  ON public.audit_events (category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_severity_created_at
  ON public.audit_events (severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at
  ON public.audit_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_events_tenant_occurred_at
  ON public.activity_events (tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_patient_occurred_at
  ON public.activity_events (patient_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_audit_event_id
  ON public.activity_events (audit_event_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_category_occurred_at
  ON public.activity_events (category, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_visibility_occurred_at
  ON public.activity_events (visibility, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_source
  ON public.activity_events (source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_occurred_at
  ON public.activity_events (occurred_at DESC);

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clinic admins can read tenant audit events" ON public.audit_events;
CREATE POLICY "Clinic admins can read tenant audit events"
ON public.audit_events
FOR SELECT
TO authenticated
USING (
  tenant_id IS NOT NULL
  AND public.has_tenant_role(
    tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role]
  )
);

DROP POLICY IF EXISTS "Clinic members can read allowed activity events" ON public.activity_events;
CREATE POLICY "Clinic members can read allowed activity events"
ON public.activity_events
FOR SELECT
TO authenticated
USING (
  public.has_tenant_role(
    tenant_id,
    ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role]
  )
  OR (
    visibility IN ('clinical', 'admin')
    AND public.has_tenant_role(tenant_id, ARRAY['doctor'::public.app_role])
  )
  OR (
    visibility = 'admin'
    AND public.has_tenant_role(tenant_id, ARRAY['registrar'::public.app_role])
  )
  OR (
    visibility IN ('financial', 'admin')
    AND public.has_tenant_role(tenant_id, ARRAY['cashier'::public.app_role])
  )
);

REVOKE ALL ON TABLE public.audit_events FROM PUBLIC;
REVOKE ALL ON TABLE public.activity_events FROM PUBLIC;
REVOKE ALL ON TABLE public.audit_events FROM anon;
REVOKE ALL ON TABLE public.activity_events FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.audit_events FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.activity_events FROM authenticated;
GRANT SELECT ON TABLE public.audit_events TO authenticated;
GRANT SELECT ON TABLE public.activity_events TO authenticated;
