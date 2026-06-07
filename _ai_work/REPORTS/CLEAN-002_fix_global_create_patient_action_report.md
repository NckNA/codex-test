# CLEAN-002 Fix Global Create Patient Action Report

## Task ID
CLEAN-002

## Goal
Remove misleading fake action behavior from the global "Записать пациента" button in the header.

## What was inspected
- `src/components/layout/Header.tsx` (where the button is rendered)
- `src/pages/SchedulePage.tsx` (where `AppointmentModal` is used)
- `src/pages/PatientsPage.tsx` (where `PatientModal` is used)

## Current behavior found
The "Записать пациента" button in `Header.tsx` was a visually active blue button with hover states, but it had no `onClick` handler and did absolutely nothing when clicked.

## Chosen Fix Option
**Option B**: "If no safe existing flow exists, disable the button and add clear visible text/tooltip explaining that this action is not available in the prototype yet."

## Why this option was safest
While `AppointmentModal` and `PatientModal` exist in the codebase, they are tightly coupled to the local state of their respective pages (`SchedulePage` and `PatientsPage`). To wire the global header button to these modals (Option A) would require hoisting the modal state and the `storage` update handlers up to a global context. Doing so would violate the rule to keep changes minimal and "not invent a large new workflow." Option B successfully removes the misleading "fake action" UX with exactly 5 lines of safe UI changes.

## Files changed
- `src/components/layout/Header.tsx`: Changed the button classes to `bg-slate-300 text-slate-500 cursor-not-allowed`, added the `disabled` attribute, and added a `title` tooltip explaining the limitation.

## Checks performed
- ✅ Checked that `Header.tsx` compiles.
- ✅ `npm run lint` — passed (0 errors, 1 pre-existing warning in `DentalChartTab.tsx`).
- ✅ `npm run build` — passed.
- ✅ Verified no other files or dependencies were modified.
- ✅ Verified no MCP tools or browser automation were used.

## Remaining known limitations
The prototype currently lacks a global modal context system, which is why actions like creating a patient or appointment must be done from their specific pages (`/patients` or `/`).
