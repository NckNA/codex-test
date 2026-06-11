# DENTALCHART-PERSISTENCE-QA-001 — Persistence QA report

## Status

Report-only QA completed for the dental chart persistence layer after:

- `DENTALCHART-COMPAT-001`
- `DENTALCHART-DICTIONARIES-001`
- `DENTALCHART-EDITOR-PROTOTYPE-001`
- `DENTALCHART-PERSISTENCE-001`

This report verifies code-level persistence readiness. It does **not** claim browser QA was performed.

## Scope

Checked areas:

- Supabase migration for new tooth editor fields.
- SupabaseDentalChartRepository read mapping.
- SupabaseDentalChartRepository write mapping.
- Compatibility with old tooth_state rows.
- Existing automated tests covering persistence behavior.

Not checked in this report:

- Live browser interaction.
- Real Supabase project migration execution.
- Real reload persistence through the deployed/local UI.
- Chrome DevTools console state.

## Files reviewed

- `supabase/migrations/0002_add_dental_chart_editor_fields_to_tooth_states.sql`
- `src/data/repositories/DentalChartRepository.ts`
- `src/data/repositories/DentalChartRepository.test.ts`

## Findings

### 1. Migration adds the required persistence columns

Migration `0002_add_dental_chart_editor_fields_to_tooth_states.sql` adds:

- `presence_status text`
- `visual_state text`
- `visual_state_override text`
- `diagnoses text[] NOT NULL DEFAULT '{}'`
- `planned_works text[] NOT NULL DEFAULT '{}'`
- `planned_work_records jsonb NOT NULL DEFAULT '[]'::jsonb`
- `completed_works text[] NOT NULL DEFAULT '{}'`

The migration keeps old tooth_state columns intact.

### 2. Migration adds defensive CHECK constraints

The migration adds guarded constraints for:

- allowed `presence_status` values;
- allowed `visual_state` values;
- allowed `visual_state_override` values;
- `planned_work_records` JSON array shape.

This is appropriate for the current model because it protects basic data shape without forcing a destructive rewrite.

### 3. Repository reads new fields from Supabase

`SupabaseDentalChartRepository.getDentalChart()` maps new DB columns into `ToothRecord` fields:

- `presenceStatus`
- `visualState`
- `visualStateOverride`
- `diagnoses`
- `plannedWorks`
- `plannedWorkRecords`
- `completedWorks`

The mapped tooth is then passed through `normalizeToothRecord()`.

### 4. Repository safely loads old rows

The repository reads rows through defensive helpers:

- `readStringArray()`
- `readPlannedWorkRecords()`

Old rows without new fields fall back to normalized defaults instead of crashing.

### 5. Repository writes new fields to Supabase

`SupabaseDentalChartRepository.saveDentalChart()` normalizes the chart first, then upserts tooth rows with both:

Legacy fields:

- `condition`
- `surfaces`
- `crown`
- `root`
- `gum`
- `bone`
- `canal`
- `notes`

New editor fields:

- `presence_status`
- `visual_state`
- `visual_state_override`
- `diagnoses`
- `planned_works`
- `planned_work_records`
- `completed_works`

### 6. Automated repository tests cover the important paths

Existing tests cover:

- reading persisted editor fields from `tooth_states`;
- old `tooth_states` rows without new fields;
- saving old and new editor fields together;
- planned work records as JSON-compatible objects;
- old stable chart ID behavior.

## Risk notes

### Browser QA is still required

The automated repository layer is covered, but the full workflow is not confirmed until a browser test verifies:

1. Open patient card.
2. Open dental chart.
3. Open tooth editor.
4. Select anatomical status.
5. Select diagnosis.
6. Select planned work.
7. Save tooth.
8. Reload page.
9. Confirm status, diagnosis, and planned work remain.
10. Confirm browser console has no errors.

### Real Supabase migration execution is still required

The migration file exists in the repository, but this report does not prove it has been applied to a real Supabase project.

Before production/deployed QA, apply migrations to the target Supabase environment.

### RLS was not changed

No RLS policy changes were introduced. This is acceptable because new columns are on the existing `tooth_states` table and should inherit the same row-level access rules.

## QA conclusion

Code-level persistence QA is acceptable.

The persistence layer is ready for live browser/Supabase validation.

## Recommended next step

Create or run a browser-backed QA task:

`DENTALCHART-BROWSER-QA-001`

Goal:

Verify the full UI persistence loop after migrations are applied:

- editor selection;
- save;
- reload;
- Supabase-backed read;
- no console errors.

## Checks expected for this report-only PR

Because this PR adds only a Markdown report, application behavior should not change.

Still run CI to confirm repository health:

- `npm run lint`
- `npm run test`
- `npm run build`
