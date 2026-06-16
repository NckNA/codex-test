-- 0011_patient_file_metadata.sql
-- Add tenant-scoped metadata for patient files and dental photo storage.

CREATE TABLE IF NOT EXISTS public.patient_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  storage_bucket text NOT NULL DEFAULT 'patient-files',
  storage_path text NOT NULL,
  original_filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  file_kind text NOT NULL DEFAULT 'dental_photo',
  source_context text NOT NULL DEFAULT 'dental_chart',
  tooth_id text,
  finding_id uuid,
  treatment_plan_id uuid,
  treatment_stage_id uuid,
  appointment_id uuid,
  uploaded_by uuid REFERENCES auth.users(id),
  caption text,
  notes text,
  is_archived boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  archived_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT patient_files_bucket_check CHECK (storage_bucket = 'patient-files'),
  CONSTRAINT patient_files_size_check CHECK (size_bytes >= 0),
  CONSTRAINT patient_files_image_mime_check CHECK (mime_type LIKE 'image/%'),
  CONSTRAINT patient_files_kind_check CHECK (file_kind IN ('dental_photo', 'xray', 'scan', 'document')),
  CONSTRAINT patient_files_source_context_check CHECK (source_context IN ('dental_chart', 'patient_card', 'finding', 'treatment_plan', 'appointment')),
  CONSTRAINT patient_files_archive_consistency_check CHECK (
    (is_archived = false AND archived_at IS NULL AND archived_by IS NULL)
    OR is_archived = true
  ),
  CONSTRAINT patient_files_patient_fk FOREIGN KEY (tenant_id, patient_id)
    REFERENCES public.patients(tenant_id, id) ON DELETE CASCADE,
  UNIQUE (tenant_id, storage_path),
  UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_patient_files_tenant_patient
  ON public.patient_files(tenant_id, patient_id)
  WHERE is_archived = false;

CREATE INDEX IF NOT EXISTS idx_patient_files_storage_path
  ON public.patient_files(storage_path);

CREATE INDEX IF NOT EXISTS idx_patient_files_context
  ON public.patient_files(tenant_id, source_context, file_kind);

ALTER TABLE public.patient_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can read patient file metadata" ON public.patient_files;
CREATE POLICY "Tenant members can read patient file metadata"
ON public.patient_files
FOR SELECT
TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenants())
);

DROP POLICY IF EXISTS "Clinical staff can insert patient file metadata" ON public.patient_files;
CREATE POLICY "Clinical staff can insert patient file metadata"
ON public.patient_files
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_tenant_role(tenant_id, ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role, 'doctor'::public.app_role])
);

DROP POLICY IF EXISTS "Clinical staff can archive patient file metadata" ON public.patient_files;
CREATE POLICY "Clinical staff can archive patient file metadata"
ON public.patient_files
FOR UPDATE
TO authenticated
USING (
  public.has_tenant_role(tenant_id, ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role, 'doctor'::public.app_role])
)
WITH CHECK (
  public.has_tenant_role(tenant_id, ARRAY['clinic_owner'::public.app_role, 'clinic_admin'::public.app_role, 'doctor'::public.app_role])
);

DROP POLICY IF EXISTS "Tenant members can upload patient files" ON storage.objects;
DROP POLICY IF EXISTS "Clinical staff can upload patient files" ON storage.objects;
CREATE POLICY "Clinical staff can upload patient files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'patient-files'
  AND EXISTS (
    SELECT 1
    FROM public.tenant_users
    WHERE tenant_users.user_id = auth.uid()
      AND tenant_users.tenant_id::text = (storage.foldername(name))[1]
      AND tenant_users.role IN ('clinic_owner'::public.app_role, 'clinic_admin'::public.app_role, 'doctor'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Tenant members can delete patient files" ON storage.objects;
DROP POLICY IF EXISTS "Clinical staff can delete patient files" ON storage.objects;
CREATE POLICY "Clinical staff can delete patient files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'patient-files'
  AND EXISTS (
    SELECT 1
    FROM public.tenant_users
    WHERE tenant_users.user_id = auth.uid()
      AND tenant_users.tenant_id::text = (storage.foldername(name))[1]
      AND tenant_users.role IN ('clinic_owner'::public.app_role, 'clinic_admin'::public.app_role, 'doctor'::public.app_role)
  )
);
