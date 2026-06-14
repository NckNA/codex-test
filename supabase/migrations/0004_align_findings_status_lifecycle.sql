-- 1. Dynamically drop the existing check constraint on findings.status
DO $$
DECLARE
    const_name text;
BEGIN
    SELECT conname INTO const_name
    FROM pg_constraint
    WHERE conrelid = 'findings'::regclass 
      AND pg_get_constraintdef(oid) LIKE '%status IN%';
    
    IF const_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE findings DROP CONSTRAINT ' || const_name;
    END IF;
END $$;

-- 2. Backfill legacy statuses to canonical statuses
UPDATE findings SET status = 'discovered' WHERE status = 'recommended';
UPDATE findings SET status = 'planned' WHERE status = 'included_in_plan';
UPDATE findings SET status = 'monitoring' WHERE status = 'observing';

-- 3. Add the new check constraint for canonical statuses
ALTER TABLE findings 
  ADD CONSTRAINT findings_status_check 
  CHECK (status IN (
    'discovered', 
    'planned', 
    'in_treatment', 
    'completed', 
    'declined_by_patient', 
    'monitoring', 
    'archived'
  ));
