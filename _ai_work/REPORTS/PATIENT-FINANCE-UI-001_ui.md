# PATIENT-FINANCE-UI-001: Patient Finance UI

## 1. Summary

Implemented a patient-card finance UI draft for one patient. The UI adds a `Финансы` tab with a finance summary, invoices, invoice item details, payments, payment allocations, and role-gated finance actions.

This implementation is connector-authored through GitHub API because the local Hermes/Windows execution bridge was unavailable in this session. Local browser smoke, local DB validation, lint, tests, and build were not executed here and remain required before considering the PR verified.

## 2. Branch name

- Branch: `feature/patient-finance-ui-001`
- Base branch: `main`

## 3. PR URL

- PR URL: https://github.com/NckNA/codex-test/pull/331
- PR state: draft

## 4. PR head reviewed before final report update

- PR head reviewed before final report update: `68a614865a621ddb02ee7ee654c94336a56889f5`

## 5. Report update commit

- Report update commit: N/A because the final report update commit cannot reference itself before creation.

## 6. Changed files summary

Added finance UI and hooks:

- `src/components/finance/PatientFinancePanel.tsx`
- `src/components/finance/PatientFinanceSummaryCard.tsx`
- `src/components/finance/InvoiceList.tsx`
- `src/components/finance/InvoiceDetail.tsx`
- `src/components/finance/InvoiceActions.tsx`
- `src/components/finance/PaymentList.tsx`
- `src/components/finance/PaymentActions.tsx`
- `src/components/finance/AllocationActions.tsx`
- `src/components/finance/FinanceStatusBadge.tsx`
- `src/components/finance/financeLabels.ts`
- `src/components/finance/financePermissions.ts`
- `src/data/hooks/usePatientFinance.ts`
- `src/data/hooks/useFinanceActions.ts`
- `src/components/finance/PatientFinancePanel.test.tsx`
- `src/data/hooks/usePatientFinance.test.tsx`
- `src/data/hooks/useFinanceActions.test.tsx`

Updated patient page integration:

- `src/pages/PatientCardPage.tsx`

Added report:

- `_ai_work/REPORTS/PATIENT-FINANCE-UI-001_ui.md`

## 7. Pre-read summary

Reviewed the finance schema and RPC boundary from:

- `supabase/migrations/0016_create_finance_model.sql`
- `supabase/migrations/0017_create_finance_rpc.sql`
- `src/data/repositories/FinanceRepository.ts`
- `src/data/repositories/FinanceRpcClient.ts`
- existing patient card tab pattern in `src/pages/PatientCardPage.tsx`
- existing visit, encounter, and completed-service panel patterns

Key domain boundary confirmed from the schema: completed service, invoice item, invoice, payment, allocation, refund, and adjustment are separate finance concepts; patient debt/balance is finance-derived rather than manually typed into the patient row.

## 8. Implementation summary

### Tab integration

`PatientCardPage.tsx` now imports `PatientFinancePanel` and renders it when the active tab is `finance`. The finance tab is removed from the generic placeholder block.

### Components

The finance UI is split into small components:

- summary card;
- invoice list;
- invoice detail and item form;
- invoice actions;
- payment list and record/void actions;
- allocation list, allocation form, and allocation void actions;
- status badge;
- labels and permissions helpers.

### Hooks

`usePatientFinance` reads through `FinanceRepository` only.

`useFinanceActions` writes through `FinanceRpcClient` only.

### Finance actions

Implemented UI action paths for:

- create draft invoice;
- add invoice item;
- issue invoice;
- record payment;
- allocate payment;
- void invoice;
- void payment allocation;
- void payment.

### Role gating

- `clinic_owner` / `clinic_admin`: full finance mutation UI including void actions.
- `cashier`: create/issue/record/allocate, no void actions.
- `doctor` / `registrar`: read-only finance view, no mutation actions.
- no-tenant: blocked state.

### Error handling

UI uses Russian safe messages for missing clinic, missing patient, missing invoice/payment, invalid amount/quantity, required reason, permission errors, and generic finance-operation failure.

## 9. Finance UI behavior

### Summary

Displays:

- `Начислено`
- `Оплачено`
- `Возвраты`
- `Долг`
- `Переплата`
- `Открытые счета`
- `Неоплаченные`
- `Частично оплаченные`
- `Последняя оплата`

### Invoices

Displays invoice number or short id, status, issue date, due date, total, paid amount, balance, currency, and notes.

### Invoice items

Displays service name, service code, completed service id if present, tooth number, tooth surface, quantity, unit price, discount, adjustment, total, and status.

### Payments

Displays status, amount, currency, payment method, received date, payer name, external reference, and notes.

### Allocations

Displays allocation amount, status, allocated date, payment reference, invoice reference, and invoice item reference.

### Void actions

Owner/admin-only void UI requires a reason before attempting a void operation.

## 10. Role behavior

### Owner/admin

Expected to see create draft invoice, add invoice item, issue invoice, record payment, allocate payment, and void actions.

### Cashier

Expected to see create draft invoice, add invoice item, issue invoice, record payment, and allocate payment. Cashier does not see void invoice/payment/allocation controls.

### Doctor

Read-only finance display. No mutation controls.

### Registrar

Read-only finance display. No mutation controls.

### No-tenant

Blocked state: `Не выбрана клиника.`

### Cross-tenant

No explicit cross-tenant bypass added. Patient page and repository/RLS boundaries remain responsible for preventing cross-tenant data access.

## 11. Data/write boundaries

- Reads are routed through `FinanceRepository` via `usePatientFinance`.
- Writes are routed through `FinanceRpcClient` via `useFinanceActions`.
- Components do not call raw Supabase RPC directly.
- Components do not perform direct table insert/update/delete/upsert writes.
- The UI does not use the patient row as a finance source of truth.
- The UI does not mutate completed services.

## 12. Domain boundaries

Implemented separation between:

- payment versus treatment completion;
- invoice versus payment;
- completed service versus invoice item.

Intentionally not implemented:

- stock/material write-off;
- documents/acts;
- timeline integration;
- refund workflows;
- write-off workflows;
- approval flows;
- payment-provider integrations;
- dedicated cashier workstation;
- finance reports UI.

## 13. Tests

Added hook tests for:

- no fetch without tenant id;
- no fetch without patient id;
- `FinanceRepository.getPatientFinanceSummary` usage;
- finance fact/list loading;
- refresh reload;
- repository error surfacing;
- `FinanceRpcClient.createInvoice` usage;
- add item, issue invoice, record payment, allocate payment;
- void methods;
- refresh after action;
- safe permission error surfacing.

Added component tests for:

- loading state;
- empty state;
- summary totals/debt labels;
- invoice list rendering;
- invoice item rendering;
- payment list rendering;
- allocation list rendering;
- admin mutation/void visibility;
- cashier mutation visibility without void actions;
- doctor/registrar no mutation controls;
- no-tenant block;
- create invoice action;
- item/payment/allocation validation;
- metadata not rendered.

Important limitation: these tests were added but not run in this session.

## 14. Browser smoke

Browser smoke was not executed in this session.

### Environment

- GitHub connector available.
- Local Hermes/Windows execution bridge unavailable.
- Container DNS could not resolve GitHub for cloning, so local checkout validation could not be performed here.

### Admin A result

Not run.

### Cashier A result

Not run.

### Doctor A result

Not run.

### Registrar A result

Not run.

### No-tenant result

Not run in browser; component test coverage was added for the blocked state.

### Admin B/cross-tenant result

Not run.

### DB validation

Not run.

### Cleanup counts

Not applicable because smoke rows were not created.

### Console result

Not checked.

## 15. What was intentionally NOT changed

- no migrations;
- no SQL/RPC changes;
- no cloud Supabase;
- no seed changes;
- no generated types;
- no dedicated cashier workstation;
- no refunds;
- no write-offs;
- no stock;
- no documents;
- no timeline integration;
- no reports UI;
- no HEP-V2.

## 16. Checks

- `git status --short`: not run locally in this session.
- `npm run lint`: not run locally in this session.
- `npm run test -- --run`: not run locally in this session.
- `npm run build`: not run locally in this session.
- GitHub Actions CI: pending/not verified at report creation time.

## 17. Issues/warnings

- Implementation was performed via GitHub connector only.
- Local browser smoke could not be run because Hermes/local execution was unavailable.
- Local Supabase DB reset and smoke validation were not run.
- CI status was not green-confirmed at report creation time.
- Because checks were not run, this PR must remain draft until CI/local validation is completed.

## 18. Final verdict

PARTIAL with exact missing validation:

- local lint not run;
- local tests not run;
- local build not run;
- local browser smoke not run;
- local DB validation and cleanup not run;
- GitHub Actions CI not green-confirmed.

## 19. Recommended next task

CASHIER-PAYMENT-FLOW-001
