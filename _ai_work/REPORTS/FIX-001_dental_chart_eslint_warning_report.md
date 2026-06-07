# FIX-001 DentalChartTab ESLint Warning Report

## What warning was found
```
D:\Users\User\Documents\GitHub\codex-test\src\components\dental\DentalChartTab.tsx
  33:6  warning  React Hook useEffect has a missing dependency: 'loadData'. Either include it or remove the dependency array  react-hooks/exhaustive-deps
```

## What caused it
The `loadData` function was defined outside of the `useEffect` hook but called inside it. The `useEffect` hook dependency array only included `patientId`. Because `loadData` was not wrapped in `useCallback`, adding it to the dependencies would have triggered an infinite loop on every render.

## Which fix option was chosen
**Option B**: Moved the data-loading logic inside `useEffect`.
Since `loadData` is only ever called once per `patientId` change (on mount/prop change) and nowhere else in the file, it is cleaner to move the function definition directly inside the `useEffect` closure. This cleanly resolves the dependency issue without needing `useCallback`. The now unnecessary custom `// eslint-disable-next-line react-hooks/set-state-in-effect` comment was also removed since it triggered an "unused directive" warning after the move.

## What files were changed
- `src/components/dental/DentalChartTab.tsx`

## Why behavior is preserved
- The data fetched remains identical (`getDentalChart`, `getFindings`, etc.).
- The trigger condition remains identical (runs when `patientId` changes).
- No global state, routing, or storage dependencies were modified.
- No data structures were mutated.

## Checks performed
- `npm run lint` — passed (0 errors, 0 warnings). The `DentalChartTab.tsx` warning is gone.
- `npm run build` — passed successfully.

## Any remaining risks
- None. The component successfully mounts and fetches initial data for the canvas grid.

## Recommended next task
**ARCH-001 — Audit frontend storage/data access before backend migration.**
