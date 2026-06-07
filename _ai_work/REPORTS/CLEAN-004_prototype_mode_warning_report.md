# CLEAN-004 Prototype Mode Warning Report

## Task ID
CLEAN-004

## Goal
Add a visible, non-intrusive Prototype Mode warning in the app UI explaining that data is stored only in the current browser.

## Where the warning was added
The warning was added to `src/components/layout/Layout.tsx`, positioned horizontally right below the `<Header />` and just above the main scrollable `<main>` area.

## Chosen Fix Option
**Option B**: "If there is no shared component, add a small inline warning banner in the main app layout using existing Tailwind styles."

## Why this placement was safest
There was no existing `<Alert />` or `<Banner />` component in the codebase. Adding it directly to `Layout.tsx` ensures the warning is visible on every single page of the application (as they all use the global Layout wrapper) without needing to refactor individual page components. It occupies a small horizontal strip (using `shrink-0` and padding) and does not interfere with the absolute positioning or scrolling of the main content area below it.

## Exact warning text used
"Режим прототипа: данные сохраняются только в этом браузере. Очистка localStorage, другой браузер или другое устройство могут скрыть или удалить эти данные. Production backend/database ещё не подключены."

## Files changed
- `src/components/layout/Layout.tsx`

## Checks performed
- ✅ Verified `npm run lint` — passed (0 errors, 1 pre-existing warning in `DentalChartTab.tsx`).
- ✅ Verified `npm run build` — passed successfully.
- ✅ Verified no backend or storage architecture changes were made.
- ✅ Verified no MCP tools or browser automation were used.

## Remaining known limitations
Since this is purely a visual UI banner, it doesn't provide an interactive way to "factory reset" or clear localStorage; testers who want to start fresh still need to clear their browser storage manually or use DevTools.
