-- 0002_add_dental_chart_editor_fields_to_tooth_states.sql
-- Persist forward-compatible dental chart editor fields without removing legacy tooth_state columns.

ALTER TABLE tooth_states
  ADD COLUMN IF NOT EXISTS presence_status text,
  ADD COLUMN IF NOT EXISTS visual_state text,
  ADD COLUMN IF NOT EXISTS visual_state_override text,
  ADD COLUMN IF NOT EXISTS diagnoses text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS planned_works text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS planned_work_records jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS completed_works text[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tooth_states_presence_status_check'
  ) THEN
    ALTER TABLE tooth_states
      ADD CONSTRAINT tooth_states_presence_status_check
      CHECK (
        presence_status IS NULL
        OR presence_status IN ('natural', 'missing', 'implant', 'root_remnant', 'deciduous', 'impacted')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tooth_states_visual_state_check'
  ) THEN
    ALTER TABLE tooth_states
      ADD CONSTRAINT tooth_states_visual_state_check
      CHECK (
        visual_state IS NULL
        OR visual_state IN ('healthy', 'caries', 'filled', 'missing', 'crown', 'implant', 'root', 'pulpitis', 'periodontitis', 'needs_treatment')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tooth_states_visual_state_override_check'
  ) THEN
    ALTER TABLE tooth_states
      ADD CONSTRAINT tooth_states_visual_state_override_check
      CHECK (
        visual_state_override IS NULL
        OR visual_state_override IN ('healthy', 'caries', 'filled', 'missing', 'crown', 'implant', 'root', 'pulpitis', 'periodontitis', 'needs_treatment')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tooth_states_planned_work_records_array_check'
  ) THEN
    ALTER TABLE tooth_states
      ADD CONSTRAINT tooth_states_planned_work_records_array_check
      CHECK (jsonb_typeof(planned_work_records) = 'array');
  END IF;
END $$;
