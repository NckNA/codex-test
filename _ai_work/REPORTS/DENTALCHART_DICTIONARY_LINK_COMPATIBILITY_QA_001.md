# DENTALCHART-DICTIONARY-LINK-COMPATIBILITY-QA-001

Issue: #253
Task type: report-only QA

## Scope Confirmation

This task is QA/report-only.

No application code was changed.

Only this report file was added:

- `_ai_work/REPORTS/DENTALCHART_DICTIONARY_LINK_COMPATIBILITY_QA_001.md`

The following areas were not changed:

- `src/` application code
- Supabase
- backend
- package files
- billing
- discounts
- RBAC
- treatment plans
- Storage
- photos/documents
- zone model
- `STATUS_TO_ZONES_MAP`

## Browser / Environment

- Browser: Google Chrome
- Dev server: Vite dev server
- Local URL: `localhost:5173`

## QA Scenarios

| Scenario | Result | Notes |
|---|---:|---|
| Work editor shows only compatible diagnoses | PASS | Diagnoses shown for linking are filtered by compatible tooth position statuses and clinical zones. |
| Incompatible linked diagnoses are removed after changing work statuses/zones | PASS | Changing allowed statuses/zones removes links that are no longer compatible. |
| `base_available` hides linked diagnoses | PASS | Linked diagnosis checklist is hidden for base-available works. |
| `base_available` clears `allowedDiagnosisIds` | PASS | Saved base-available work keeps linked diagnosis IDs empty. |
| Empty compatible list message appears | PASS | The UI shows: `Нет совместимых диагнозов для выбранных статусов и зон.` |
| `planning` did not return as a system zone | PASS | `planning` was not shown as a system zone in the tested UI paths. |
| ToothEditorModal opens normally | PASS | Opening the tooth editor did not crash. |
| Browser console has no errors | PASS | No console errors were observed during the tested scenarios. |

## Expected Compatibility Rule Verified

A diagnosis can be linked to a work only when all of the following are true:

1. `diagnosis.isActive !== false`
2. The diagnosis and work have intersecting `allowedPresenceStatuses`
3. The diagnosis and work have intersecting `allowedZones`

For `base_available` works:

- linked diagnoses are hidden;
- `allowedDiagnosisIds` is saved as an empty array.

For `requires_diagnosis` works:

- only compatible diagnoses are shown;
- only compatible diagnosis IDs are saved.

## Console Errors

None observed during the tested scenarios.

## Checks

- `git status --short`: only this report file was added
- `npm run lint`: PASS, 0 errors
- `npm run test`: PASS, 208 / 208 tests passed
- `npm run build`: PASS

## Final Result

PASS.

The diagnosis-work compatibility UI from Issue #251 was verified in the browser according to Issue #253 requirements, with no application code changes.