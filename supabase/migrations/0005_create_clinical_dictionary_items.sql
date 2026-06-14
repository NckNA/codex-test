-- 0005_create_clinical_dictionary_items.sql

CREATE TABLE clinical_dictionary_items (
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    id text NOT NULL,
    type text NOT NULL CHECK (type IN ('diagnosis', 'work')),
    name text NOT NULL,
    description text,
    allowed_presence_statuses text[] NOT NULL DEFAULT '{}',
    allowed_zones text[] NOT NULL DEFAULT '{}',
    work_access_type text CHECK (work_access_type IS NULL OR work_access_type IN ('base_available', 'status_available', 'requires_diagnosis')),
    allowed_diagnosis_ids text[] NOT NULL DEFAULT '{}',
    price numeric(10,2) CHECK (price IS NULL OR price >= 0),
    visual_priority integer,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    PRIMARY KEY (tenant_id, id),
    
    CONSTRAINT check_dictionary_item_type_rules CHECK (
        (type = 'diagnosis' AND work_access_type IS NULL AND price IS NULL AND allowed_diagnosis_ids = '{}'::text[]) OR
        (type = 'work' AND work_access_type IS NOT NULL)
    )
);

CREATE INDEX idx_clinical_dictionary_items_tenant_type ON clinical_dictionary_items(tenant_id, type);
CREATE INDEX idx_clinical_dictionary_items_tenant_active ON clinical_dictionary_items(tenant_id, is_active);
CREATE INDEX idx_clinical_dictionary_items_tenant_type_active ON clinical_dictionary_items(tenant_id, type, is_active);

-- Enable RLS
ALTER TABLE clinical_dictionary_items ENABLE ROW LEVEL SECURITY;

-- SELECT policy: Tenant members can view clinical dictionary items
CREATE POLICY "Tenant members can view clinical dictionary items" 
ON clinical_dictionary_items 
FOR SELECT 
USING (tenant_id IN (SELECT get_user_tenants()));

-- INSERT policy: Clinic admins can insert clinical dictionary items
CREATE POLICY "Clinic admins can insert clinical dictionary items" 
ON clinical_dictionary_items 
FOR INSERT 
WITH CHECK (has_tenant_role(tenant_id, ARRAY['clinic_owner'::app_role, 'clinic_admin'::app_role]));

-- UPDATE policy: Clinic admins can update clinical dictionary items
CREATE POLICY "Clinic admins can update clinical dictionary items" 
ON clinical_dictionary_items 
FOR UPDATE 
USING (has_tenant_role(tenant_id, ARRAY['clinic_owner'::app_role, 'clinic_admin'::app_role]))
WITH CHECK (has_tenant_role(tenant_id, ARRAY['clinic_owner'::app_role, 'clinic_admin'::app_role]));

-- DELETE policy: Clinic admins can delete clinical dictionary items
CREATE POLICY "Clinic admins can delete clinical dictionary items" 
ON clinical_dictionary_items 
FOR DELETE 
USING (has_tenant_role(tenant_id, ARRAY['clinic_owner'::app_role, 'clinic_admin'::app_role]));
