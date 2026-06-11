# DENTALCHART-BACKFILL-RECON-001

## Purpose

This report is a chronological backfill for the dental chart work after the recent fast PR chain.

The goal is not to plan from the latest visible UI only. The goal is to reconstruct the middle of the route:

- what entered `main`;
- what did not enter `main`;
- which old notes became stale;
- which data fields now exist in frontend/backend boundaries;
- which migrations are present but still need live Supabase application;
- what must be checked before the next major feature.

This is a report-only checkpoint. No application code was changed.

---

## Source of truth hierarchy

Use this order when reasoning about the current dental chart state:

1. GitHub `main`, merged PRs, changed files and CI.
2. Repository source files on `main`.
3. Report-only PRs merged into `_ai_work/REPORTS`.
4. Browser/local smoke reports from Codex or other agents.
5. Chat discussion notes.

Codex smoke is useful QA evidence, but it is not the primary audit source.

---

## Current verified baseline

Repository: `NckNA/codex-test`

Current dental chart route checkpoint is after PR #212.

Latest relevant merged PR:

- PR #212: `DENTALCHART-DENTITION-MODE-001: add adult and child tooth chart modes`
- Merge commit: `4c862149a826d4868c6ff4079a2579020c66364c`

Open PRs checked during this audit: none known from the current dental chart chain.

Closed not merged PR to remember:

- PR #213: `UI marker update`
- State: closed
- Merged: false
- Draft: true
- Meaning: status marker experiment must NOT be treated as part of `main`.

---

## Chronological route

### PR #198 — DENTALCHART-EDITOR-FIX-001

Status: merged.

Purpose:

- Fixed regression where `ToothEditorModal` displayed only the selected clinical zone and made other sections look deleted.
- Restored simultaneous visibility of clinical sections.

Why it matters:

- This was the recovery point after the visual dental chart PR caused UI confusion.
- It re-established the rule that zone tabs may focus/highlight, but must not hide the rest of the clinical editor unless explicitly designed that way.

Current status:

- Included in `main`.

---

### PR #199 — cleanup accidental temporary files

Status: merged.

Purpose:

- Removed accidental temporary files that had been committed during recovery work:
  - `src/utils/dentalChartCompatibility.ts`
  - `src/utils/branch.txt`
  - `PLEASE_STOP.txt`

Why it matters:

- Reset the repository after accidental direct writes.
- This cleanup must be remembered so future audits do not treat those temporary files as historical architecture.

Current status:

- Included in `main`.
- The temporary files are not part of the product.

---

### PR #200 — DENTALCHART-COMPAT-001

Status: merged.

Purpose:

- Added forward-compatible tooth fields and normalization layer.
- Kept legacy `condition` behavior.
- Added optional fields such as:
  - `presenceStatus`
  - `visualState`
  - `visualStateOverride`
  - `diagnoses`
  - `plannedWorks`
  - `plannedWorkRecords`
  - `completedWorks`

Why it matters:

- This is the compatibility bridge between the old dental chart shape and the new editor model.
- Old localStorage/Supabase-shaped teeth can be loaded without crashing the newer UI.

Current status:

- Included in `main`.
- This is architecture plus normalization, not a visible feature by itself.

---

### PR #201 — DENTALCHART-DICTIONARIES-001

Status: merged.

Purpose:

- Added clinical dictionary seed config for diagnoses and works.
- Added filtering helpers by:
  - tooth presence status;
  - clinical zone;
  - selected diagnosis;
  - base/status work access.

Why it matters:

- The editor no longer relies on hardcoded random UI labels only.
- It has structured seed data for clinical choices.

Current status:

- Included in `main`.
- Still code-based seed dictionaries, not tenant/admin-managed dictionaries.

---

### PR #202 — DENTALCHART-EDITOR-PROTOTYPE-001

Status: merged.

Purpose:

- Migrated tooth editor toward the saved clinical prototype UI.
- Built editor on top of compatibility model and dictionaries.
- Added workflow around:
  - anatomical status;
  - calculated/manual visual state;
  - notes;
  - clinical zones;
  - diagnoses;
  - planned works;
  - clinical finding creation.

Why it matters:

- This is the main visible editor upgrade.
- It transformed the tooth modal from simple condition editing into a more clinical workflow.

Current status:

- Included in `main`.
- Browser QA was not initially completed by ChatGPT environment.

---

### PR #203 — DENTALCHART-PERSISTENCE-001

Status: merged.

Purpose:

- Added Supabase migration for new dental chart editor fields in `tooth_states`.
- Updated `SupabaseDentalChartRepository` to read/write the new fields.
- Preserved old DB fields.

Added migration:

- `supabase/migrations/0002_add_dental_chart_editor_fields_to_tooth_states.sql`

Fields added by migration:

- `presence_status`
- `visual_state`
- `visual_state_override`
- `diagnoses`
- `planned_works`
- `planned_work_records`
- `completed_works`

Why it matters:

- Without this, the new editor would only be a local/front-end illusion for Supabase mode.

Current status:

- Code and migration file are in `main`.
- Live Supabase application is NOT confirmed.

---

### PR #204 — DENTALCHART-PERSISTENCE-QA-001

Status: merged.

Purpose:

- Report-only QA for persistence layer after PR #203.
- Confirmed repository/migration/test coverage from code perspective.
- Documented that real browser/Supabase runtime verification remained pending.

Why it matters:

- This is a checkpoint that says the code path exists, not that live Supabase has been updated.

Current status:

- Included in `main` as report-only.

---

### PR #205 — DENTALCHART-BROWSER-QA-001

Status: merged.

Purpose:

- Report-only pending browser QA checklist.
- It did not claim browser QA had passed.
- It recorded required browser scenarios for the new dental chart editor and persistence chain.

Why it matters:

- Prevents future agents from pretending that CI equals browser QA.

Current status:

- Included in `main` as pending QA report.

---

### PR #206 — DENTALCHART-TOOTH-VISUAL-REFINE-001

Status: merged.

Purpose:

- Modernized anatomical tooth SVG shapes.
- Preserved condition-based coloring and `ToothGrid` behavior.

Why it matters:

- Improved visual quality without changing dental data behavior.

Current status:

- Included in `main`.
- Visual review should still be confirmed in browser when available.

---

### PR #207 — DENTALCHART-SUPABASE-FALLBACK-001

Status: merged.

Purpose:

- Added safe fallback for `SupabaseDentalChartRepository.saveDentalChart()`.
- If live Supabase does not yet have the editor-field columns, repository retries saving only legacy fields.

Why it matters:

- Protects the app from crashing if migration `0002` has not been applied.

Important limitation:

- If fallback is used, new editor fields may be lost in Supabase mode until migration `0002` is applied.
- This is a safety net, not full persistence.

Current status:

- Included in `main`.

---

### PR #208 — DENTALCHART-TOOTHGRID-UX-001

Status: merged.

Purpose:

- Improved tooth grid readability.
- Added:
  - upper/lower jaw labels;
  - compact legend;
  - hover/focus tooltip per tooth;
  - stronger selected tooth highlighting.

Why it matters:

- Visible user-facing improvement.
- Helps doctors understand the chart faster.

Known issue from later smoke:

- Horizontal scrolling at 1440x900 remained a problem.

Current status:

- Included in `main`.

---

### PR #209 — DENTALCHART-EDITOR-UX-POLISH-001

Status: merged.

Purpose:

- Improved selected diagnosis/work UX in the tooth editor.
- Added:
  - selected summary;
  - chips;
  - quick remove actions;
  - clear all / clear zone actions;
  - counters;
  - warning for work without diagnosis.

Why it matters:

- Made the editor more usable for real clinical selection flow.

Current status:

- Included in `main`.

---

### Codex local smoke after #209 / before later route updates

Status: QA evidence only.

Codex reported:

- lint passed with warnings only;
- tests passed;
- build passed;
- local browser opened;
- dental chart rendered;
- editor opened;
- diagnosis/work selection worked;
- finding checkbox worked;
- save worked;
- F5 persistence worked in local mode;
- no console errors;
- Supabase path not checked.

Important:

- Codex smoke confirms local behavior for the checked main state.
- It does not replace GitHub audit.
- It does not confirm live Supabase migrations.
- It may not include later PRs unless the latest commit is explicitly verified.

---

### PR #210 — DENTALCHART-FINDING-LINK-001

Status: merged.

Purpose:

- Added structured links between tooth editor selections and dental findings.
- Added optional fields:
  - `clinicalZone`
  - `diagnosisIds`
  - `plannedWorkIds`
  - `plannedWorkRecordIds`
- Added migration for findings structured links.

Added migration:

- `supabase/migrations/0003_add_dental_chart_links_to_findings.sql`

Why it matters:

- Before this, finding meaning could be trapped in text descriptions.
- After this, a finding can point back to selected zone/diagnoses/works.

Current status:

- Included in `main`.
- Live Supabase migration `0003` application is NOT confirmed.

---

### PR #211 — DENTALCHART-ZONE-HIGHLIGHT-001

Status: merged.

Purpose:

- Added zone overlay markers on dental chart teeth.
- Markers are derived from:
  - planned work records;
  - finding clinical zones;
  - legacy tooth fields.

Why it matters:

- Moves chart closer to competitor-level clinical readability.
- Doctor can see which zone is involved, not only tooth-level color.

Current status:

- Included in `main`.
- Visual/browser confirmation after merge should still be done.

---

### PR #212 — DENTALCHART-DENTITION-MODE-001

Status: merged.

Purpose:

- Added adult/child dentition mode switch.
- Added child FDI formula:
  - upper: `55–65`
  - lower: `85–75`
- Extended `ToothNumber` to support primary tooth numbers.
- Added fallback display teeth for child mode.

Why it matters:

- This directly addresses competitor parity around child tooth formulas.

Current status:

- Included in `main`.
- Mixed dentition is NOT implemented.

---

### PR #213 — UI marker update

Status: closed, not merged.

Purpose attempted:

- Status marker layer experiment.

Why it matters:

- Must be explicitly excluded from current product state.
- Do not claim status markers are in `main`.
- If status markers are needed, create a clean new PR from current `main`.

Current status:

- Not in `main`.

---

## Current data map

### ToothRecord

Now represents both old and forward-compatible dental chart data.

Legacy fields still matter:

- `condition`
- `surfaces`
- `crown`, `workCrown`
- `root`, `workRoot`
- `gum`, `workGum`
- `bone`, `workBone`
- `canal`, `workCanal`
- `notes`
- `updatedAt`

Forward-compatible fields:

- `presenceStatus`
- `visualState`
- `visualStateOverride`
- `diagnoses`
- `plannedWorks`
- `plannedWorkRecords`
- `completedWorks`

### DentalFinding

Now can carry structured dental chart links:

- `clinicalZone`
- `diagnosisIds`
- `plannedWorkIds`
- `plannedWorkRecordIds`

### LocalStorage

Local smoke confirms current dental chart/editor/finding flow can persist through F5 in local mode.

### Supabase

Code supports new fields, but live database status is unknown.

Required migrations:

- `0002_add_dental_chart_editor_fields_to_tooth_states.sql`
- `0003_add_dental_chart_links_to_findings.sql`

Until live Supabase confirms these migrations are applied:

- repository fallback may protect legacy saves;
- new editor/finding fields may not persist in Supabase mode.

---

## Stale notes to replace

Older project notes that say DentalChartRepository and FindingsRepository are untouched/local-only are now stale for the current branch context.

Replace them with this more precise status:

- Dental chart has forward-compatible model and repository persistence code.
- Supabase migration files exist for tooth editor fields and finding links.
- Live Supabase migration application is pending/unknown.
- LocalStorage flow has browser-smoke evidence.
- Supabase runtime flow does not yet have browser/database smoke confirmation.

Do not delete old recon reports. Mark them as superseded for this dental chart route.

---

## Known risks

### 1. Live Supabase migrations are pending/unknown

Migration files exist, but there is no verified evidence that they are applied to the real Supabase environment.

Risk:

- new tooth editor fields may not persist;
- finding links may not persist;
- fallback may silently keep only legacy data.

### 2. Supabase fallback can hide missing migration symptoms

Fallback is useful, but it can make the UI appear saved while new structured fields are dropped in Supabase mode.

Risk:

- user thinks diagnosis/work/finding links were saved;
- database only contains old fields.

### 3. Browser QA is local, not live Supabase

Codex verified local mode, not Supabase runtime.

Risk:

- localStorage path works;
- Supabase path may still fail or downgrade to fallback.

### 4. Responsive grid issue

Smoke reported horizontal scroll at 1440x900.

Risk:

- chart is functional but less usable on normal desktop.

### 5. Status markers are not in main

PR #213 was closed and not merged.

Risk:

- future agents may assume status markers exist.

### 6. Mixed dentition is not implemented

Adult/child switch exists, but mixed dentition is not implemented.

Risk:

- child formula support may be mistaken for full pediatric/mixed dentition workflow.

---

## Route forward

Recommended next route after this backfill checkpoint:

1. `SUPABASE-MIGRATION-APPLY-001`
   - Apply migrations `0002` and `0003` to target Supabase environment.
   - Verify columns/constraints exist.

2. `DENTALCHART-SUPABASE-SMOKE-001`
   - Use real Supabase mode.
   - Save tooth editor selections.
   - Save finding links.
   - Refresh and verify data in UI and database.

3. `DENTALCHART-TOOTHGRID-RESPONSIVE-001`
   - Fix horizontal scroll at 1440x900.

4. `DENTALCHART-STATUS-MARKERS-001`
   - Recreate clean PR from current `main`.
   - Do not reuse closed red/draft PR #213 as source of truth.

5. `DENTALCHART-MIXED-DENTITION-RECON-001`
   - Recon only before implementation.
   - Do not jump straight from child mode to mixed dentition.

6. `DICTIONARY-ADMIN-RECON-001`
   - Recon tenant/RLS/schema strategy for editable dictionaries.

7. `TREATMENTPLAN-FROM-DENTALCHART-RECON-001`
   - Recon before generating treatment plans from dental chart selections/findings.

---

## Stop rules

Do not start treatment plan generation until:

- findings links are confirmed in Supabase runtime;
- dental chart editor data persists in Supabase runtime;
- migration status is verified.

Do not start dictionary admin until:

- tenant ownership model is clear;
- RLS strategy is documented;
- default vs tenant-specific dictionaries are separated.

Do not claim browser QA passed unless:

- a real browser was opened;
- steps were executed;
- console was checked;
- commit tested is named.

Do not claim Supabase persistence passed unless:

- migrations were applied to live target;
- DB rows were inspected or reliable Supabase runtime smoke was performed.

Do not treat PR #213 as implemented functionality.

---

## Final verdict

Dental chart route is now materially advanced and user-visible:

- clinical editor exists;
- dictionaries exist;
- tooth graphics improved;
- grid UX improved;
- editor UX improved;
- finding links exist;
- zone highlights exist;
- adult/child dentition switch exists;
- local browser smoke evidence exists.

But the production-readiness blocker remains:

- live Supabase migration application and Supabase runtime smoke are not confirmed.

Next safe task should be Supabase migration verification, not another clinical feature.
