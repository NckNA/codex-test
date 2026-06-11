# DENTALCHART-RECON-ROUTE-MAP-001

Status: report-only
Date: 2026-06-12
Repository: NckNA/codex-test

## 1. Purpose

This report rebuilds the dental chart route map chronologically after the rapid PR chain from the editor regression fix through the latest dentition mode work.

The goal is to prevent the team from starting from the latest visible state only and forgetting the middle layers: compatibility, dictionaries, editor migration, persistence, fallback, QA markers, zone highlights, and dentition mode.

No application code is changed by this report.

## 2. Current source-of-truth checkpoint

The latest known main route point for this report is after:

- PR #212: `DENTALCHART-DENTITION-MODE-001: add adult and child tooth chart modes`
- Merge commit: `4c862149a826d4868c6ff4079a2579020c66364c`

Open PRs at the time of route reconstruction: none expected.

Closed but not merged and relevant:

- PR #213: `UI marker update`
  - State: closed
  - Merged: false
  - Meaning: status markers must NOT be counted as delivered in main.

## 3. Chronological route from the recovery point

### PR #198 — DENTALCHART-EDITOR-FIX-001

Purpose:
- Restore visibility of all clinical sections in the tooth editor.

Why it mattered:
- A previous UI change made the editor appear as if clinical sections were deleted because only the selected zone was visible.

Current meaning:
- Historical recovery step.
- Do not repeat this approach; the newer editor supersedes the old section layout.

### PR #199 — cleanup accidental files

Purpose:
- Remove accidental temporary files from main.

Current meaning:
- Hygiene step.
- No product logic.

### PR #200 — DENTALCHART-COMPAT-001

Purpose:
- Add forward-compatible tooth fields and normalization.

Added concepts:
- `presenceStatus`
- `visualState`
- `visualStateOverride`
- `diagnoses`
- `plannedWorks`
- `plannedWorkRecords`
- `completedWorks`

Why it mattered:
- Old tooth data only had `condition` and legacy fields.
- New editor needed future-ready fields without breaking existing data.

Current meaning:
- Foundation layer.
- Must remain before any editor or persistence changes.

### PR #201 — DENTALCHART-DICTIONARIES-001

Purpose:
- Add seed clinical dictionaries and pure filtering helpers.

Added concepts:
- diagnosis seed config
- work seed config
- filters by presence status
- filters by clinical zone
- work suggestions by selected diagnoses

Current meaning:
- Dictionary seed layer only.
- Not yet admin-editable.
- Not yet tenant-scoped in DB.

### PR #202 — DENTALCHART-EDITOR-PROTOTYPE-001

Purpose:
- Migrate tooth editor toward the saved clinical prototype UI.

User-visible additions:
- anatomical status
- calculated/manual visual state
- zones
- diagnoses
- works
- planned work records
- clinical problem/finding creation checkbox

Current meaning:
- Main editor UI layer.
- Depends on PR #200 and PR #201.

### PR #203 — DENTALCHART-PERSISTENCE-001

Purpose:
- Persist new editor tooth fields to Supabase `tooth_states`.

Added migration:
- `supabase/migrations/0002_add_dental_chart_editor_fields_to_tooth_states.sql`

Added DB fields:
- `presence_status`
- `visual_state`
- `visual_state_override`
- `diagnoses`
- `planned_works`
- `planned_work_records`
- `completed_works`

Current meaning:
- Code and migration exist in repo.
- Live Supabase application status is still unknown unless migration is applied.

### PR #204 — DENTALCHART-PERSISTENCE-QA-001

Purpose:
- Report-only QA for the persistence layer.

Current meaning:
- Confirms code-level/migration-level review.
- Does not confirm live Supabase runtime.

### PR #205 — DENTALCHART-BROWSER-QA-001

Purpose:
- Report-only pending browser QA checklist.

Current meaning:
- Browser QA was explicitly marked pending at that time.
- Later Codex smoke partially closed local browser QA, but not Supabase runtime QA.

### PR #206 — DENTALCHART-TOOTH-VISUAL-REFINE-001

Purpose:
- Modernize tooth SVG shapes.

Current meaning:
- Visual improvement only.
- No data behavior changes.

### PR #207 — DENTALCHART-SUPABASE-FALLBACK-001

Purpose:
- Add fallback if live Supabase lacks new editor columns.

Behavior:
- First save tries new editor fields.
- If Supabase reports missing new columns/schema-cache issue, repository retries legacy-only save.

Important risk:
- This prevents full save failure, but new editor fields may be dropped until migration `0002` is applied.

Current meaning:
- Safety layer, not a substitute for applying migrations.

### PR #208 — DENTALCHART-TOOTHGRID-UX-001

Purpose:
- Improve tooth grid readability.

Added:
- upper/lower jaw labels
- legend
- hover/focus tooltip
- selected state improvement

Codex later verified local behavior after this class of changes.

### PR #209 — DENTALCHART-EDITOR-UX-POLISH-001

Purpose:
- Improve editor selected-choice UX.

Added:
- selected summary
- diagnosis/work chips
- remove actions
- clear all / clear zone
- counters
- warning for work without diagnosis

Current meaning:
- Editor usability layer.

### PR #210 — DENTALCHART-FINDING-LINK-001

Purpose:
- Link tooth editor selections to clinical findings structurally.

Added fields on findings:
- `clinicalZone`
- `diagnosisIds`
- `plannedWorkIds`
- `plannedWorkRecordIds`

Added migration:
- `supabase/migrations/0003_add_dental_chart_links_to_findings.sql`

Current meaning:
- Findings are no longer only text descriptions.
- Live Supabase status for migration `0003` is still unknown unless applied.

### Codex local smoke after PR #210

Reported local smoke result:
- latest checked commit: `fbf8101` / PR #210
- lint passed with warnings
- tests passed
- build passed
- browser opened locally
- tooth grid rendered
- tooth editor opened
- diagnosis/work/finding/save/F5 local persistence worked
- console errors: none
- Supabase path not tested

Current meaning:
- Local/browser/localStorage flow is confirmed through #210.
- Supabase runtime remains pending.

### PR #211 — DENTALCHART-ZONE-HIGHLIGHT-001

Purpose:
- Add zone overlays/markers on the tooth chart.

Added:
- zone marker layer from `plannedWorkRecords`, findings, and legacy fields
- zone summary in tooltip
- legend entries for active/planned/risk zone states

Current meaning:
- User-visible chart quality improvement.
- Needs visual browser verification after #211 and later changes.

### PR #212 — DENTALCHART-DENTITION-MODE-001

Purpose:
- Add adult/child dentition mode.

Added:
- adult formula: `18–28 / 48–38`
- child formula: `55–65 / 85–75`
- primary tooth numbers in `ToothNumber`
- display fallback for child teeth
- save support for newly added child teeth through orchestrator

Current meaning:
- User-visible feature.
- Mixed dentition is not implemented yet.

### PR #213 — UI marker update

Purpose attempted:
- Add compact status markers around teeth.

Outcome:
- Closed.
- Not merged.
- Must not be counted as delivered.

Current meaning:
- Status markers remain pending and require a clean new PR.

## 4. Old information to retire or update

### Retire: “browser QA pending only”

Update:
- Local browser smoke was performed by Codex through PR #210.
- But this does not cover PR #211/#212 visually, and it does not cover live Supabase runtime.

New wording:
- Local smoke through #210: passed.
- Live Supabase smoke: pending.
- Visual smoke after #211/#212: pending.

### Retire: “new editor is only prototype”

Update:
- The editor UI is now in main via PR #202 and polished via #209.
- It is no longer just a saved prototype.

New wording:
- Editor is implemented in main.
- Supabase runtime persistence still depends on applying migrations.

### Retire: “status markers are implemented”

Update:
- PR #213 was closed and not merged.

New wording:
- Zone highlights are implemented via #211.
- Status markers are pending.

### Retire: “only adult teeth exist”

Update:
- PR #212 added child dentition mode.

New wording:
- Adult and child modes exist.
- Mixed dentition is pending.

## 5. Current data map

### ToothRecord

Current role:
- main tooth state object used by the chart and editor.

Important fields:
- legacy: `condition`, `surfaces`, `crown`, `root`, `gum`, `bone`, `canal`, `notes`
- forward-compatible: `presenceStatus`, `visualState`, `visualStateOverride`, `diagnoses`, `plannedWorks`, `plannedWorkRecords`, `completedWorks`

### DentalFinding

Current role:
- clinical problem/finding attached to patient and optionally to a tooth.

Important fields added by #210:
- `clinicalZone`
- `diagnosisIds`
- `plannedWorkIds`
- `plannedWorkRecordIds`

### localStorage

Current role:
- supports local/browser smoke and dev persistence.

Status:
- local smoke through #210 passed.

### Supabase `tooth_states`

Expected after migration `0002`:
- stores new editor fields.

Without migration:
- fallback preserves legacy fields but may drop new editor fields.

### Supabase findings table

Expected after migration `0003`:
- stores structured dental finding links.

Without migration:
- fallback may preserve legacy finding fields but drop structured links.

## 6. Known risks

1. Live Supabase migrations may not be applied.
   - Migration `0002` pending/unknown.
   - Migration `0003` pending/unknown.

2. Fallback can hide missing migration symptoms.
   - Legacy save can succeed while new fields do not persist.

3. Codex browser smoke was local only.
   - Supabase path was not tested.

4. Visual QA after #211 and #212 is not confirmed.
   - Zone highlight and child dentition mode still need browser screenshots.

5. Tooth grid responsiveness issue remains.
   - 1440x900 horizontal overflow was reported earlier.

6. Status markers are pending.
   - PR #213 is closed and not merged.

7. Mixed dentition is not implemented.

8. Dictionary admin is not implemented.
   - Current dictionaries are seed config only, not tenant-scoped database records.

## 7. Updated route from this checkpoint

Priority order:

1. SUPABASE-MIGRATION-APPLY-001
   - Apply migrations `0002` and `0003` to the real Supabase environment.

2. DENTALCHART-SUPABASE-SMOKE-001
   - Verify real Supabase save/read for tooth editor fields and finding links.

3. DENTALCHART-LATEST-MAIN-SMOKE-AFTER-212-001
   - Browser smoke current main after #211/#212.
   - Confirm adult/child switch.
   - Confirm zone overlays.
   - Confirm no console errors.

4. DENTALCHART-TOOTHGRID-RESPONSIVE-001
   - Fix horizontal scrolling on normal desktop width.

5. DENTALCHART-STATUS-MARKERS-001-clean
   - Recreate status marker work as a clean PR.
   - Do not reuse closed PR #213 as if it were ready.

6. DENTALCHART-MIXED-DENTITION-RECON-001
   - Recon only before implementing mixed dentition.

7. DICTIONARY-ADMIN-RECON-001
   - Recon tables, tenant_id, RLS, roles before moving dictionaries from code to DB.

8. TREATMENTPLAN-FROM-DENTALCHART-RECON-001
   - Recon how plannedWorkRecords should generate treatment plan items.

## 8. Stop rules

- Do not start treatment plan integration before Supabase smoke.
- Do not start dictionary admin before tenant/RLS recon.
- Do not claim status markers are shipped from PR #213.
- Do not claim live Supabase persistence is verified until migrations are applied and smoke-tested.
- Do not start mixed dentition implementation without recon.
- Do not use stale smoke report from #210 as proof for #211/#212 behavior.

## 9. Next immediate action

Recommended next action:

`SUPABASE-MIGRATION-APPLY-001`

If Supabase access is not available:

`DENTALCHART-LATEST-MAIN-SMOKE-AFTER-212-001`

Reason:
- The current main has moved beyond the last browser smoke point.
- We need either real DB confirmation or at least current UI smoke after zone highlights and child dentition mode.
