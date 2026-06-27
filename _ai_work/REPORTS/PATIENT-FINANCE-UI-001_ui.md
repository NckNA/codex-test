# PATIENT-FINANCE-UI-001: Patient Finance UI QA report

## 1. Summary

Patient Finance UI was repaired and validated after the failing PR CI was reproduced locally.

Root cause: `src/components/finance/PatientFinancePanel.test.tsx` asserted the loading state after an immediately-resolving mock repository had already completed. The test was stabilized with a controlled deferred promise. A separate TypeScript build error in `src/components/finance/InvoiceDetail.tsx` was fixed by avoiding nullable `invoice.currency` access during item rendering.

## 2. Branch and PR

- Repository: `NckNA/codex-test`
- Branch: `feature/patient-finance-ui-001`
- PR: `#331`
- PR title: `PATIENT-FINANCE-UI-001: add patient finance tab`
- PR URL: https://github.com/NckNA/codex-test/pull/331

## 3. Scope kept

Changed only Patient Finance UI / related tests / this report:

- `src/components/finance/InvoiceDetail.tsx`
- `src/components/finance/PatientFinancePanel.test.tsx`
- `_ai_work/REPORTS/PATIENT-FINANCE-UI-001_ui.md`

No migrations, seed files, generated types, unrelated DentalFlow code, Supabase cloud changes, or HEP work were changed.

## 4. Fix details

### Test stabilization

`PatientFinancePanel.test.tsx` now uses a small `deferred<T>()` helper so the loading-state assertion runs while the finance query is still unresolved. After the assertion, the deferred invoice list resolves to `[]`, and the test verifies the empty finance state.

### TypeScript build fix

`InvoiceDetail.tsx` now derives `invoiceCurrency` from `invoice?.currency ?? 'KZT'` before rendering invoice item money fields. This removes the `TS18047: 'invoice' is possibly 'null'` errors without changing UI behavior.

## 5. Local validation

Local Hermes/Windows execution bridge is available again.

- Hermes CLI: reachable
- Workspace root: `D:\hermes`
- Local worktree: `D:\hermes\worktrees\archived\patient-finance-ui-001-work`

Dependency install:

- `npm ci`: passed after stopping the local Vite dev server that was locking a Rolldown native binding under `node_modules`.

Quality checks:

- `npm test`: passed, 64 test files, 642 tests.
- `npm run lint`: passed.
- `npm run build`: passed.

Non-blocking warning:

- Vite reported a chunk larger than 500 kB after minification. This is a warning, not a failed check, and was not changed because it is outside the PR scope.

## 6. Browser smoke

Dev server:

- Started with `npm run dev -- --host 127.0.0.1`
- Local URL: `http://127.0.0.1:5173/`

Smoke path:

- Opened `http://127.0.0.1:5173/patients/p1`
- Confirmed demo patient page rendered: `???????? ?.?.`
- Clicked the `???????` tab
- Confirmed the finance panel rendered with heading `???????` and create draft invoice UI
- Screenshot saved locally: `D:\hermes\reports\patient-p1-finance.png`

Observed local-browser limitation:

- The browser smoke showed the safe message `?? ??????? ????????? ?????????? ??????.` because the local prototype browser session did not have live finance backend data wired for that demo patient. This did not block CI because repository/hook/component coverage is mocked and local build/test/lint all passed.

## 7. GitHub CI

After code fix commit `4e37708749addd5ce8d2e98caade68a57b518b91`:

- Workflow: `CI`
- Run: `#644`
- Job: `validate`
- Steps: `ESLint`, `Tests`, `Build`
- Result: success

A follow-up report-only commit may trigger another CI run; the final PR state should be checked against the latest head commit.

## 8. Remaining risks

- Browser smoke verifies render/no-crash of the finance tab, but not a full live finance data flow against a seeded local Supabase database.
- Existing React `act(...)` warnings remain in unrelated tests. They do not fail the suite and were not changed to avoid scope creep.
- Bundle size warning remains unchanged because it is unrelated to Patient Finance CI failure.

## 9. Verdict

PASS for current PR objective: Patient Finance UI now passes local tests, lint, build, and the relevant GitHub Actions CI on the code-fix commit. Browser smoke confirms the finance tab renders without crashing in the local prototype route.

## 10. Recommended next task

CASHIER-PAYMENT-FLOW-001
