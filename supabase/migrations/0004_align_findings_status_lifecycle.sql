-- 1. Explicitly drop the existing check constraint on findings.status
ALTER TABLE findings DROP CONSTRAINT IF EXISTS findings_status_check;

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
