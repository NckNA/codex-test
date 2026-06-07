# CLEAN-001 Fake Actions and Risky Placeholders Report

## Task ID
CLEAN-001

## Summary
This is a read-only cleanup planning report that identifies fake actions, risky placeholders, disabled buttons, and misleading user interactions in the current DentalFlow CRM frontend prototype. The goal is to prioritize small fixes to improve the integrity of the prototype during QA.

## Tool policy result
- **MCP tools were not used**
- **No browser automation was used**
- **Repository inspection only** (bash searches and file reads)

## Files inspected
- `src/pages/`
- `src/components/`
- `src/utils/storage.ts`
- `package.json`
- Related audit reports (AUDIT-002, AUDIT-003, AUDIT-005)

---

## Placeholder pages inventory
The following routes render the `<PlaceholderPage />` component.
**Visible message:** "🚧 [Title] Раздел находится в разработке (Задача 001)"

| Route / Page | Safe or Risky? | Recommended Action |
|---|---|---|
| `/crm` (CRM) | ✅ Safe placeholder | None. Leave as is until feature implementation. |
| `/finance` (Финансы) | ✅ Safe placeholder | None. Leave as is until feature implementation. |
| `/warehouse` (Склад) | ✅ Safe placeholder | None. Leave as is until feature implementation. |
| `/documents` (Документы) | ✅ Safe placeholder | None. Leave as is until feature implementation. |
| `/medical` (Врачебная часть) | ✅ Safe placeholder | None. Leave as is until feature implementation. |
| `/statistics` (Статистика) | ✅ Safe placeholder | None. Leave as is until feature implementation. |
| `/reports` (Отчёты) | ✅ Safe placeholder | None. Leave as is until feature implementation. |
| `/bonus` (Бонусная система) | ✅ Safe placeholder | None. Leave as is until feature implementation. |
| `/mailing` (Рассылка) | ✅ Safe placeholder | None. Leave as is until feature implementation. |
| `/sms` (СМС) | ✅ Safe placeholder | None. Leave as is until feature implementation. |
| `/settings` (Настройки) | ✅ Safe placeholder | None. Leave as is until feature implementation. |

---

## Disabled buttons and future-feature UI

| Component | Label/UI | Current Behavior | Is it clearly disabled? | Risk Level | Recommended Action |
|---|---|---|---|---|---|
| `TreatmentPlansTab.tsx` | "amoCRM: после подключения" | Button with `disabled` attribute and `cursor-not-allowed` class. Tooltip says "Интеграция с amoCRM будет доступна позже". | ✅ Yes | Low (P2) | Keep as is. It correctly signals a future feature. |
| `CreatePlanFromFindingsModal.tsx` | "Создать план из N проблем" | Button disabled when `selectedIds.length === 0`. | ✅ Yes | Low (P2) | Keep as is. Expected UI validation behavior. |

---

## Alert-based flows

| Component | User Action | Alert Text | Data Persisted? | Risk Level | Recommended Action |
|---|---|---|---|---|---|
| `FindingsRisksTab.tsx` | Saving Chief Complaint | `alert('Жалоба сохранена')` | ✅ Yes (saved to `localStorage`) | Medium (P1) | Replace `alert()` with a subtle inline success message or toast notification. |

---

## Console-only actions
**None found.** The codebase does not currently rely on `console.log` to fake successful actions. All actions that claim to save data actually write to `localStorage`.

---

## TODO/FIXME/mock/dev-only/not implemented references
- `PlaceholderPage.tsx` explicitly includes the text "Раздел находится в разработке".
- No other explicit `TODO` or `FIXME` comments were found in the inspected UI components.

---

## Misleading success or fake completion risks

1. **Header "Записать пациента" Button**
   - **File:** `src/components/layout/Header.tsx`
   - **Risk:** The "Записать пациента" (Add Appointment) button is present in the global header but does not have an `onClick` handler. Clicking it does nothing, which is confusing.
   - **Action:** Either wire it up to open the `AppointmentModal` or remove/hide it until global modals are supported.

2. **Treatment Plan Preview**
   - **File:** `TreatmentPlanPatientPreview.tsx` (Triggered from `TreatmentPlansTab.tsx`)
   - **Risk:** Opens a nice visual preview, but there is no way to export, print, or generate a PDF. Users might expect to print this for the patient, but the functionality is missing.
   - **Action:** Add a "Print" button that simply calls `window.print()`, or add a placeholder tooltip explaining that PDF export is coming soon.

---

## localStorage-related UI risk notes
- **Destructive reset:** Currently, `storage.init()` automatically runs in `main.tsx` if no data exists. There is no visible UI button to "Factory Reset" the app, which is good (prevents accidental deletion by testers).
- **Browser-only persistence:** Users might assume their data is saved to a cloud database. There is no visible indicator warning the user that clearing browser history will delete all CRM data.

---

## amoCRM-related UI risk notes
- The amoCRM mapper (`amoCrmMapper.ts`) exists but is not used in any UI action.
- The amoCRM button in `TreatmentPlansTab` is visibly and functionally disabled.
- **Risk:** Very low. The UI correctly represents that amoCRM is not yet connected.

---

## Risk prioritization

### P0 — Must not be shown as working
*(None found. All fake actions correctly display "Under construction" or are disabled.)*

### P1 — Should clean before broader testing
1. **Header Appointment Button:** Hide or implement the "Записать пациента" button in `Header.tsx`.
2. **Alert UX:** Replace `alert('Жалоба сохранена')` in `FindingsRisksTab.tsx` with inline state.
3. **Storage Warning:** Add a subtle "Local Prototype Mode" banner or warning so testers don't expect cloud persistence.

### P2 — Acceptable prototype placeholders
1. All `PlaceholderPage` routes (`/crm`, `/finance`, etc.).
2. The disabled amoCRM sync button.

---

## Recommended future code tasks
- **FIX-001** — Fix DentalChartTab eslint warning.
- **CLEAN-002** — Wire up or hide the global "Записать пациента" button in `Header.tsx`.
- **CLEAN-003** — Replace `alert()` in `FindingsRisksTab.tsx` with inline success text.
- **CLEAN-004** — Add "Local Prototype" warning badge to the Header to set data persistence expectations.

---

## Checks
- `git status --short`: Clean (only this report created).
- `Get-ChildItem` (Powershell grep equivalent): Ran searches for `alert`, `console.log`, `placeholder`, `disabled`.
- `npm run lint`: 0 errors, 1 warning (pre-existing `DentalChartTab.tsx`).
- `npm run build`: Success.

## Safety notes
- **Report-only task:** No application code was changed.
- No MCP tools or browser automation were used.
- No backend code or package files were modified.
- No destructive actions were taken on `localStorage`.

## What was not implemented
- No UI cleanup fixes were applied.
- No backend changes or amoCRM changes were made.
- No new tests or features were added.

## Issues or observations
The prototype is generally very honest. Features that aren't ready are either clearly disabled or point to a safe `PlaceholderPage`. The most glaring issue is the unresponsive button in the Header and the annoying browser `alert()` during complaint saving.

## Recommended next step
**FIX-001** — Fix existing DentalChartTab eslint warning.
