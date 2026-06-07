# CLEAN-003 Replace Complaint Save Alert Report

## Task ID
CLEAN-003

## Goal
Remove the native browser alert shown when saving a patient complaint and replace it with proper in-app feedback.

## What alert usage was found
A codebase search via `Select-String` confirmed that `FindingsRisksTab.tsx` was the only component using a native `alert()` for user feedback:
- `FindingsRisksTab.tsx` (line 105): `alert('Жалоба сохранена');`

## Chosen Fix Option
**Option B**: "If no shared feedback system exists, replace the alert with a small inline success message near the complaint form/button... The message should disappear after a short time."

## Why this option was safest
A search of `src/components/common` and `src/context` revealed no existing toast or notification system in the prototype. Building a global toast provider (Option A) would require broad refactoring and violate the rule against adding large notification systems. Showing an inline state (Option B) allows us to safely replace the alert with only a few lines of isolated local state (`isSaved`) without affecting any other modules.

## Files changed
- `src/components/dental/FindingsRisksTab.tsx`: 
  - Added `const [isSaved, setIsSaved] = useState(false);`
  - Replaced `alert('Жалоба сохранена');` with `setIsSaved(true); setTimeout(() => setIsSaved(false), 3000);`
  - Added inline UI next to the save button: `<CheckCircle /> Сохранено` which conditionally renders when `isSaved` is true.

## Checks performed
- ✅ Searched the entire `src/` directory for other instances of `alert(`. None were found.
- ✅ Verified `FindingsRisksTab.tsx` saves correctly.
- ✅ `npm run lint` — passed (0 errors, 1 pre-existing warning in `DentalChartTab.tsx`).
- ✅ `npm run build` — passed successfully.
- ✅ Verified no other files or dependencies were modified.
- ✅ Verified no MCP tools or browser automation were used.

## Remaining known limitations
The app still lacks a global notification (toast) system. Any future actions that need success feedback will either require similar local inline state or the implementation of a proper global toast context.
