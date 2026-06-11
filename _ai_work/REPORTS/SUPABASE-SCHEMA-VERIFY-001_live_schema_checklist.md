# SUPABASE-SCHEMA-VERIFY-001 — Live schema verification checklist

## Status

**Report-only checkpoint.**

This task did **not** connect to the live Supabase database.

Final live DB status:

```text
LIVE DB NOT VERIFIED BY THIS TASK
```

Reason:

```text
The available tool access for this task is GitHub repository inspection and report creation.
No direct Supabase SQL execution tool was available in this session.
```

This report verifies the repository-side schema expectations and provides the exact SQL checklist that must be run against the live Supabase project.

---

## Why this check exists

The current DentalChart / Findings work has two important schema extensions:

1. `0002_add_dental_chart_editor_fields_to_tooth_states.sql`
2. `0003_add_dental_chart_links_to_findings.sql`

The migration files exist in the repository, and the frontend repositories already attempt to use those new fields.

But:

```text
migration file exists in GitHub ≠ migration is applied to the live Supabase database
```

If the live database is missing these columns, fallback logic may keep older save paths alive, but newer editor fields or structured finding links can be omitted from live Supabase writes.

---

## Repository-side evidence

### Migration 0002: tooth_states editor fields

File:

```text
supabase/migrations/0002_add_dental_chart_editor_fields_to_tooth_states.sql
```

Expected columns added to `tooth_states`:

```text
presence_status
visual_state
visual_state_override
diagnoses
planned_works
planned_work_records
completed_works
```

Expected constraints:

```text
tooth_states_presence_status_check
tooth_states_visual_state_check
tooth_states_visual_state_override_check
tooth_states_planned_work_records_array_check
```

Expected behavior:

- New editor fields can be saved to `tooth_states`.
- Old tooth state fields remain valid.
- `planned_work_records` must be a JSON array.

---

### Migration 0003: structured dental links on findings

File:

```text
supabase/migrations/0003_add_dental_chart_links_to_findings.sql
```

Expected columns added to `findings`:

```text
clinical_zone
diagnosis_ids
planned_work_ids
planned_work_record_ids
```

Expected constraint:

```text
findings_clinical_zone_check
```

Expected index:

```text
idx_findings_tenant_patient_tooth_zone
```

Expected behavior:

- Findings can store structured links back to tooth editor selections.
- Existing findings remain valid.
- Dental chart zone/finding linkage can survive Supabase persistence if these fields exist.

---

## Current repository fallback behavior

### DentalChartRepository

The Supabase dental chart repository first tries to save new editor fields to `tooth_states`.

If the database reports missing editor columns, the repository retries a legacy tooth state write without these new fields.

Implication:

```text
If migration 0002 is missing in live Supabase, the save may still succeed, but editor-specific fields can be dropped from Supabase persistence.
```

Fields at risk if 0002 is not applied:

```text
presenceStatus
visualState
visualStateOverride
diagnoses
plannedWorks
plannedWorkRecords
completedWorks
```

---

### FindingsRepository

The Supabase findings repository first tries to save structured dental chart link fields.

If the database reports missing finding link columns, the repository retries without those fields.

Implication:

```text
If migration 0003 is missing in live Supabase, finding creation/update may still succeed, but structured tooth-zone-diagnosis-work links can be dropped from Supabase persistence.
```

Fields at risk if 0003 is not applied:

```text
clinicalZone
diagnosisIds
plannedWorkIds
plannedWorkRecordIds
```

---

## SQL verification checklist

Run the following SQL queries in the live Supabase SQL Editor for the target project.

Do not run destructive statements.
Do not modify production data for this verification.

---

## Check 1 — tooth_states required columns

```sql
select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'tooth_states'
  and column_name in (
    'presence_status',
    'visual_state',
    'visual_state_override',
    'diagnoses',
    'planned_works',
    'planned_work_records',
    'completed_works'
  )
order by column_name;
```

Expected result count:

```text
7 rows
```

Expected column notes:

```text
presence_status           text, nullable
visual_state              text, nullable
visual_state_override     text, nullable
diagnoses                 ARRAY/text[], not null, default '{}'
planned_works             ARRAY/text[], not null, default '{}'
planned_work_records      jsonb, not null, default '[]'::jsonb
completed_works           ARRAY/text[], not null, default '{}'
```

PASS:

```text
All 7 expected columns exist with compatible types/defaults.
```

FAIL:

```text
One or more expected columns are missing or incompatible.
```

---

## Check 2 — tooth_states constraints

```sql
select
  conname,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.tooth_states'::regclass
  and conname in (
    'tooth_states_presence_status_check',
    'tooth_states_visual_state_check',
    'tooth_states_visual_state_override_check',
    'tooth_states_planned_work_records_array_check'
  )
order by conname;
```

Expected result count:

```text
4 rows
```

PASS:

```text
All 4 expected constraints exist.
```

FAIL:

```text
One or more constraints are missing.
```

---

## Check 3 — findings required structured link columns

```sql
select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'findings'
  and column_name in (
    'clinical_zone',
    'diagnosis_ids',
    'planned_work_ids',
    'planned_work_record_ids'
  )
order by column_name;
```

Expected result count:

```text
4 rows
```

Expected column notes:

```text
clinical_zone              text, nullable
diagnosis_ids              ARRAY/text[], not null, default '{}'
planned_work_ids           ARRAY/text[], not null, default '{}'
planned_work_record_ids    ARRAY/text[], not null, default '{}'
```

PASS:

```text
All 4 expected columns exist with compatible types/defaults.
```

FAIL:

```text
One or more expected columns are missing or incompatible.
```

---

## Check 4 — findings clinical zone constraint

```sql
select
  conname,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.findings'::regclass
  and conname = 'findings_clinical_zone_check';
```

Expected result count:

```text
1 row
```

PASS:

```text
The clinical zone constraint exists and accepts the current ClinicalZone values.
```

Expected allowed values:

```text
crown
endodontics
root
periodontium
bone
orthopedics
planning
```

FAIL:

```text
Constraint missing or allowed values differ from the current frontend ClinicalZone values.
```

---

## Check 5 — findings index

```sql
select
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'findings'
  and indexname = 'idx_findings_tenant_patient_tooth_zone';
```

Expected result count:

```text
1 row
```

PASS:

```text
Index exists on tenant/patient/tooth/zone lookup path.
```

FAIL:

```text
Index is missing.
```

---

## Combined PASS criteria

The live Supabase schema can be marked as ready for current dental chart editor and structured findings persistence only if all checks pass:

```text
Check 1: PASS
Check 2: PASS
Check 3: PASS
Check 4: PASS
Check 5: PASS
```

Then mark:

```text
SUPABASE_SCHEMA_VERIFY_001 = PASS
```

---

## Combined FAIL criteria

If any check fails, mark:

```text
SUPABASE_SCHEMA_VERIFY_001 = FAIL
```

Then do not treat Supabase persistence for the new dental chart editor fields and finding links as confirmed.

Use this status:

```text
Repository fallback protects legacy writes, but live Supabase may omit newer structured fields until migrations are applied.
```

---

## Required evidence to attach after manual verification

A human or agent with SQL access must paste the result summary into a follow-up report or PR comment.

Required format:

```text
SUPABASE-SCHEMA-VERIFY-001 live result

Project/environment checked:
<project name or environment label>

Checked by:
<name/tool>

Date/time:
<timestamp>

Check 1 tooth_states columns:
PASS/FAIL
Notes:

Check 2 tooth_states constraints:
PASS/FAIL
Notes:

Check 3 findings columns:
PASS/FAIL
Notes:

Check 4 findings constraint:
PASS/FAIL
Notes:

Check 5 findings index:
PASS/FAIL
Notes:

Final verdict:
PASS/FAIL
```

Do not paste secrets, tokens, passwords, private connection strings, or screenshots containing credentials.

---

## What must not be claimed yet

Until the live SQL checks are executed, do not claim:

```text
Supabase editor field persistence is verified.
Supabase structured finding links are verified.
Migration 0002 is applied live.
Migration 0003 is applied live.
```

Allowed claim after this report:

```text
The repository contains migrations 0002 and 0003.
The repository code expects those fields and has fallback logic for older schemas.
Live Supabase schema verification is still pending until the SQL checklist is executed.
```

---

## Next route after this report

### If all SQL checks pass

Proceed to:

```text
DENTALCHART-SUPABASE-SMOKE-001
```

Goal:

- run the app in `supabase-active` mode;
- save dental chart editor fields;
- create a structured finding from the tooth editor;
- refresh;
- verify data survives through Supabase;
- check browser console;
- optionally query DB rows after save if a safe read path is available.

### If any SQL check fails

Proceed to:

```text
SUPABASE-MIGRATION-APPLY-001
```

Goal:

- apply missing migration(s) to the live Supabase project;
- re-run this schema verification checklist;
- only then run Supabase browser smoke.

---

## Final verdict

```text
REPO EXPECTATION CHECK: PASS
LIVE SUPABASE SCHEMA CHECK: NOT PERFORMED
NEXT REQUIRED ACTION: run SQL checklist in the live Supabase SQL Editor or with an approved Supabase SQL tool
```
