# DENTALCHART-BROWSER-QA-001 — Pending browser QA report

Status: **PENDING MANUAL BROWSER QA**

This report intentionally does **not** claim browser QA has passed.

The current execution environment does not provide a browser / Chrome DevTools MCP session, and the task was explicitly requested as “без браузера пока”. Therefore this report records the required browser QA plan, acceptance criteria, remaining risks, and the exact evidence that must be collected later before the dental chart editor can be treated as browser-validated.

## Scope

This QA checkpoint covers the dental chart chain merged in the recent PR sequence:

1. `DENTALCHART-COMPAT-001`
   - forward-compatible `ToothRecord` fields;
   - normalization for old and new tooth records.
2. `DENTALCHART-DICTIONARIES-001`
   - clinical diagnosis/work dictionaries;
   - pure filtering helpers.
3. `DENTALCHART-EDITOR-PROTOTYPE-001`
   - new tooth editor modal UI;
   - anatomical status;
   - visual state;
   - clinical zones;
   - diagnoses;
   - planned works.
4. `DENTALCHART-PERSISTENCE-001`
   - Supabase persistence for new editor fields.
5. `DENTALCHART-PERSISTENCE-QA-001`
   - code-level QA report for migration/repository/test coverage.

## Explicit non-goals

This report does not:

- change application code;
- change UI;
- change tests;
- change Supabase migrations;
- change seed data;
- verify real browser behavior;
- verify real Supabase runtime behavior;
- verify localStorage behavior through the actual UI;
- verify visual layout in a real viewport.

## Current verified state before browser QA

The following has already been verified by code review and CI in prior PRs:

- normalization helpers exist and are tested;
- clinical dictionaries exist and are tested;
- the new editor compiles and has unit tests;
- Supabase repository read/write mapping includes the new fields;
- migration adds the required nullable/defaulted tooth state columns;
- CI passed for lint, tests, and build on the preceding PRs.

This is **not equivalent** to browser QA.

## Required local setup for future browser QA

Use latest `main` after the persistence and QA report merges.

```bash
git checkout main
git pull origin main
npm install
npm run dev
```

Open the Vite URL, usually:

```text
http://localhost:5173
```

For Supabase persistence QA, the local environment must include:

```env
VITE_SUPABASE_URL=<project-url>
VITE_SUPABASE_ANON_KEY=<anon-key>
```

Do **not** use service role keys in the frontend environment.

## Required database setup for Supabase runtime QA

Before testing Supabase persistence through the browser, the database must include migration:

```text
supabase/migrations/0002_add_dental_chart_editor_fields_to_tooth_states.sql
```

Required columns on `tooth_states`:

- `presence_status`
- `visual_state`
- `visual_state_override`
- `diagnoses`
- `planned_works`
- `planned_work_records`
- `completed_works`

If these columns are missing in the runtime database, the UI may appear to save data while reload loses new editor fields.

## Browser QA scenario A — Smoke open editor

Purpose: confirm the new editor opens without runtime crashes.

Steps:

1. Open the app.
2. Open a patient card.
3. Navigate to the dental chart.
4. Click a natural tooth.
5. Confirm the tooth editor modal opens.
6. Open browser DevTools console.

Expected result:

- modal opens;
- no red console errors;
- no React runtime crash;
- existing tooth data is displayed;
- old `condition`-based visual state still appears compatible.

Evidence required:

- screenshot of opened editor;
- screenshot or copied console output showing no relevant errors.

## Browser QA scenario B — Anatomical status and visual state

Purpose: confirm anatomical status and visual state controls update the model safely.

Steps:

1. Open a tooth.
2. Change anatomical status to `implant`.
3. Confirm available clinical zones/work options update consistently.
4. Change display/visual state manually if the UI exposes this control.
5. Save.
6. Reopen the same tooth.

Expected result:

- status selection does not crash;
- visual state is still compatible with current dental chart colors;
- saved status is visible after reopening the modal.

Evidence required:

- before/after screenshot;
- console screenshot.

## Browser QA scenario C — Diagnosis to work flow

Purpose: confirm diagnosis selection drives planned work options.

Steps:

1. Open a natural tooth.
2. Select clinical zone `crown`.
3. Select a caries-related diagnosis, for example enamel caries if present.
4. Confirm related planned work options appear.
5. Select a planned work.
6. Save.
7. Reopen the tooth.

Expected result:

- diagnosis checkbox/selection works;
- related work becomes available;
- selected planned work is retained in the modal after reopening;
- no duplicate planned work records are created from repeated save without a new selection.

Evidence required:

- screenshot with diagnosis selected;
- screenshot with planned work selected;
- screenshot after reopen.

## Browser QA scenario D — Refresh persistence

Purpose: confirm data survives full page reload.

Steps:

1. Open a tooth.
2. Select anatomical status.
3. Select diagnosis.
4. Select planned work.
5. Save.
6. Refresh the browser page.
7. Navigate back to the same patient and tooth.
8. Open the same tooth.

Expected result:

- selected status remains;
- selected diagnosis remains;
- selected planned work remains;
- notes/old fields remain;
- no red console errors.

Evidence required:

- screenshot before refresh;
- screenshot after refresh;
- console screenshot after refresh.

## Browser QA scenario E — Old data compatibility

Purpose: confirm old tooth records without new fields still open safely.

Steps:

1. Use a patient/dental chart created before the compatibility work.
2. Open the dental chart.
3. Click several teeth with old-only data.
4. Open and save one old tooth without changing new fields.
5. Refresh and reopen it.

Expected result:

- old data does not crash normalization;
- old fields are preserved;
- missing future fields default safely;
- saving does not erase existing old tooth data.

Evidence required:

- screenshot of old tooth before save;
- screenshot after save/reopen;
- console screenshot.

## Browser QA scenario F — Supabase persistence verification

Purpose: confirm browser save writes new fields into `tooth_states`.

Steps:

1. Use Supabase-backed mode with migration `0002` applied.
2. Open a patient dental chart.
3. Edit one tooth:
   - anatomical status;
   - diagnosis;
   - planned work;
   - optional visual override.
4. Save.
5. Refresh page and reopen tooth.
6. Inspect `tooth_states` row in Supabase.

Expected result:

- UI reload shows the saved values;
- row contains expected values in:
  - `presence_status`;
  - `visual_state`;
  - `visual_state_override` where applicable;
  - `diagnoses`;
  - `planned_works`;
  - `planned_work_records`;
  - `completed_works`.

Evidence required:

- browser screenshot after save;
- browser screenshot after refresh;
- Supabase row screenshot or exported row snippet;
- console screenshot.

## Browser QA scenario G — Regression check for section visibility

Purpose: ensure the earlier regression where sections disappeared does not return.

Steps:

1. Open a tooth.
2. Switch through all available zones/tabs.
3. Confirm the editor remains usable and does not hide required controls unexpectedly.
4. Save after switching zones.

Expected result:

- zone switching does not lose selected values;
- diagnosis/work controls stay logically available;
- save still works after zone changes.

Evidence required:

- screenshots for at least two zones;
- console screenshot.

## Browser QA scenario H — Negative/edge cases

Purpose: catch common UI/state bugs.

Cases to test:

1. Open modal and close without saving.
2. Open modal, change fields, close/cancel if available.
3. Reopen and confirm unsaved changes did not persist.
4. Select and then unselect diagnosis.
5. Select diagnosis, select work, then remove diagnosis.
6. Try a missing tooth and confirm incompatible natural-tooth work is not offered.
7. Try implant status and confirm implant-compatible work behavior.

Expected result:

- cancel/close behavior is predictable;
- incompatible works are not offered;
- removing diagnosis does not leave invalid planned work state unless intentionally supported;
- no red console errors.

## Acceptance criteria

`DENTALCHART-BROWSER-QA-001` can be marked browser-passed only after all of the following are true:

- app opens locally;
- dental chart opens;
- tooth editor opens;
- no red console errors during smoke flow;
- anatomical status saves and reloads;
- diagnosis saves and reloads;
- planned work saves and reloads;
- old tooth rows remain compatible;
- Supabase row contains new fields after save when Supabase mode is used;
- refresh persistence works;
- evidence screenshots/logs are attached to the QA result.

## Remaining risks until real browser QA is executed

- UI may render but be visually awkward in real viewport sizes.
- Save button may work in unit tests but fail in real interaction flow.
- Supabase migration may not be applied in the actual runtime database.
- LocalStorage and Supabase paths may behave differently.
- Diagnosis/work selections may persist in memory but fail after refresh.
- Planned work records may duplicate through repeated saves.
- Zone switching may reset selected diagnosis/work unexpectedly.
- Browser console may reveal runtime warnings/errors not caught by CI.

## Recommended next task

Create a real browser QA task once a browser-capable agent or local operator is available:

```text
DENTALCHART-BROWSER-QA-REAL-001
```

That task should execute the scenarios in this report and attach evidence.

## Final QA status

```text
Code-level QA: already covered by prior PRs and CI
Browser QA: NOT EXECUTED
Supabase runtime QA: NOT EXECUTED
Manual evidence: NOT PROVIDED
Result: PENDING REAL BROWSER QA
```
