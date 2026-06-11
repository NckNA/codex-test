-- DENTALCHART-FINDING-LINK-001
-- Adds structured links from findings back to dental chart editor selections.
-- Existing rows remain valid; all new fields are nullable/defaulted.

ALTER TABLE findings
  ADD COLUMN IF NOT EXISTS clinical_zone text,
  ADD COLUMN IF NOT EXISTS diagnosis_ids text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS planned_work_ids text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS planned_work_record_ids text[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'findings_clinical_zone_check'
  ) THEN
    ALTER TABLE findings
      ADD CONSTRAINT findings_clinical_zone_check
      CHECK (
        clinical_zone IS NULL OR clinical_zone IN (
          'crown',
          'endodontics',
          'root',
          'periodontium',
          'bone',
          'orthopedics',
          'planning'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_findings_tenant_patient_tooth_zone
  ON findings(tenant_id, patient_id, tooth_number, clinical_zone);
