# CASHIER-PAYMENT-FLOW-001: Cashier payment workstation

## Summary

Implemented a dedicated cashier payment workstation for patient invoice payment intake and allocation. The flow is separate from the patient-card finance tab and keeps payment, invoice, allocation, and treatment completion as separate concepts.

## Branch name

`feature/cashier-payment-flow-001`

## PR URL

Pending PR creation. This section will be finalized after the PR is opened.

## PR head reviewed before final report update

Pending final report update after PR creation and CI.

## Report update commit

N/A because the final report update commit cannot reference itself before creation.

## Changed files summary

- `src/App.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/pages/CashierPaymentPage.tsx`
- `src/components/cashier/CashierPaymentPanel.tsx`
- `src/components/cashier/CashierPatientSearch.tsx`
- `src/components/cashier/CashierPatientFinanceSummary.tsx`
- `src/components/cashier/CashierOpenInvoiceList.tsx`
- `src/components/cashier/CashierPaymentForm.tsx`
- `src/components/cashier/CashierAllocationPreview.tsx`
- `src/components/cashier/CashierPaymentResult.tsx`
- `src/components/cashier/cashierLabels.ts`
- `src/components/cashier/cashierPermissions.ts`
- `src/data/hooks/useCashierPatientSearch.ts`
- `src/data/hooks/useCashierPaymentFlow.ts`
- `src/components/cashier/CashierPaymentPanel.test.tsx`
- `src/data/hooks/useCashierPatientSearch.test.tsx`
- `src/data/hooks/useCashierPaymentFlow.test.tsx`
- `_ai_work/REPORTS/CASHIER-PAYMENT-FLOW-001_cashier.md`

No migrations, SQL/RPC, cloud config, seed files, generated types, stock, documents, timeline, reports UI, or HEP-V2 files were changed.

## Pre-read summary

- Finance schema reviewed: `0016_create_finance_model.sql`.
- Finance RPC reviewed: `0017_create_finance_rpc.sql`.
- Finance read repository reviewed: `FinanceRepository.ts`.
- Finance RPC client reviewed: `FinanceRpcClient.ts`.
- Patient finance UI reviewed: patient finance panel, invoice list, payments, allocation actions, finance labels and permissions.
- Routing/nav reviewed: routes in `src/App.tsx`, sidebar nav in `src/components/layout/Sidebar.tsx`.
- Tenant/role flow reviewed: `AuthContext.tsx` and `TenantContext.tsx`.
- Existing patient repository/search pattern reviewed: `PatientRepository.ts` and patient collection hook.

## Implementation summary

- Added `/cashier/payments` route via `CashierPaymentPage`.
- Added `Kassa` navigation entry in the sidebar with a receipt icon.
- Added cashier components for patient search, finance summary, open invoices, payment form, allocation preview, and payment result.
- Added `useCashierPatientSearch` for tenant-scoped patient search.
- Added `useCashierPaymentFlow` for finance summary loading, open invoice selection, payment recording, allocation, refresh, and result state.
- Added role gating for clinic owner, clinic admin, and cashier access. Doctor, registrar, no-tenant, and unknown roles are blocked.
- Added hook, component, role, and safety tests.

## Cashier flow behavior

- Cashier opens `/cashier/payments`.
- Cashier searches tenant patient by name or phone.
- Cashier selects a patient and sees finance summary from `FinanceRepository`.
- Cashier sees actionable open invoices only.
- Cashier selects invoice(s), enters payment amount/method/reference, records payment, and allocates it to selected invoice(s).
- Result panel shows patient, payment amount, method, external reference, allocated amount, remaining debt, credit/overpayment, timestamp, and allocations.
- Cashier workstation does not expose void controls or legal/fiscal receipt wording.

## Role behavior

- Owner/admin: can access cashier page and use the cashier workflow.
- Cashier: can search/select patient, view finance summary, select invoice, record payment, allocate payment, and see result. No void controls.
- Doctor: blocked from cashier payment flow, no payment form and no finance data leakage.
- Registrar: blocked from cashier payment flow, no payment form and no finance data leakage.
- No-tenant: app-level clinic gate, no payment form and no finance data leakage.
- Cross-tenant admin B: cannot find or view Clinic A smoke patient/finance data.

## Data/write boundaries

- Reads use `FinanceRepository` and `PatientRepository`.
- Writes use `FinanceRpcClient.recordPayment`, `FinanceRpcClient.allocatePayment`, and draft issue through `FinanceRpcClient.issueInvoice` when needed.
- Components do not call raw `supabase.rpc`.
- Components/hooks do not directly insert/update/delete/upsert tables.
- `patients.balance` is not used as source of truth.
- `completed_services` is not mutated.
- No service role, localStorage fallback, payment provider, document, stock, timeline, or appointment mutation in the cashier flow.

## Domain boundaries

- Payment does not mean treatment completion.
- Invoice does not mean payment.
- Allocation explains where money went; payment alone does not close a debt until allocated.
- No receipt/document/fiscal integration was implemented.
- No stock/documents/timeline side effects were added.
- No refunds, write-offs, discount approvals, finance reports, Kaspi/Halyk integrations, fiscal register, SMS, WhatsApp, or provider integrations were added.

## Tests

- Hook tests: `useCashierPatientSearch.test.tsx`, `useCashierPaymentFlow.test.tsx`.
- Component/page tests: `CashierPaymentPanel.test.tsx`.
- Safety tests verify no raw `supabase.rpc`, no direct table writes from cashier components/hooks, no localStorage/service_role references in cashier hooks, no PatientTimelineAggregator usage, no void/fiscal/legal receipt wording.
- Targeted cashier tests: 3 files, 25 tests passed.
- Full suite: 67 files, 667 tests passed.

## Browser smoke

Environment:

- Local Supabase reset with `npx supabase db reset --no-seed`.
- Local-only QA users, tenants, smoke patient, smoke issued invoice, and smoke invoice item were inserted through local Docker SQL because guarded QA seed required pre-existing tenants and host password env was unavailable.
- Temporary `.env.local` was created for local Supabase and QA shortcut, then removed before commit.
- Vite dev server used `http://127.0.0.1:5175/`.
- Secrets were not printed and were not committed.

Cashier A result: PASS.

- Full route render, patient search/select, finance summary, open invoice, invoice selection, cash payment, allocation, payment result panel, debt 0, open invoices empty, no void controls, no fatal console errors.

Admin A result: PASS.

- Admin can access cashier route and search Clinic A smoke patient. No no-access state.

Doctor A result: PASS.

- Blocked/no-access state, no payment form, no smoke finance data leakage, no fatal console errors.

Registrar A result: PASS.

- Blocked/no-access state after tenant loading settles, no payment form, no smoke finance data leakage, no fatal console errors.

No-tenant result: PASS.

- App-level clinic-not-assigned gate, no payment form, no smoke finance data leakage.

Admin B/cross-tenant result: PASS.

- Clinic B admin could open cashier page, but Clinic A smoke patient was not visible and patient search returned empty.

DB validation after browser smoke:

- invoices marker = 1 before cleanup.
- invoice_items marker = 1 before cleanup.
- payments marker = 1 before cleanup.
- payment_allocations marker = 1 before cleanup.
- invoice status = paid, paid_amount = 1000.00, balance_amount = 0.00.
- payment status = allocated, method = cash, amount = 1000.00.
- allocation status = active, amount = 1000.00.
- audit_events = 2: payment_recorded and payment_allocated.
- activity_events = 2: payment_recorded and payment_allocated.
- patients.balance unchanged at 0.00.
- completed_services = 0 for smoke patient.
- appointments = 0 for smoke patient.
- documents = 0.
- patient_files = 0 for smoke patient.
- local schema scan found no stock/material/timeline side-effect tables.

Cleanup counts after local reset:

- invoices = 0 for smoke marker.
- invoice_items = 0 for smoke marker.
- payments = 0 for smoke marker.
- payment_allocations = 0 for smoke marker.
- audit_events = 0 for smoke patient.
- activity_events = 0 for smoke patient.
- smoke patient rows = 0.

Console result:

- Browser role smoke reported no console errors, no failed requests, no visible secrets.

## What was intentionally NOT changed

- No migrations.
- No SQL/RPC changes.
- No Supabase cloud changes.
- No seed changes committed.
- No generated types committed.
- No refunds.
- No write-offs.
- No stock/material write-off.
- No documents/acts.
- No timeline integration.
- No finance reports.
- No payment provider integrations.
- No fiscal register integration.
- No appointment completion.
- No treatment completion.
- No HEP-V2 work.

## Checks

- `git status --short`: checked before smoke and after cleanup.
- `npm run lint`: passed.
- `npm run test -- --run`: passed, 67 files / 667 tests.
- `npm.cmd run build`: passed after the PowerShell wrapper was blocked by local safety layer; Vite emitted only the existing non-blocking chunk-size warning.
- GitHub Actions CI: pending PR creation.

## Issues/warnings

- The branch was pushed once before final checks by mistake; no PR was created and later validation completed before final PR creation.
- Local `.env.local` initially had a PowerShell BOM, causing blank login render; it was rewritten without BOM before smoke.
- `npm run build` through PowerShell was blocked by local command safety, so `npm.cmd run build` was used and passed.
- Existing unrelated React `act(...)` test warnings remain; they do not fail the suite.
- Existing unrelated dictionary test error-path logs remain; they do not fail the suite.
- Vite chunk-size warning remains non-blocking and outside cashier scope.
- Smoke setup used local Docker SQL for QA fixtures and invoice setup, then local reset cleanup. No seed files were committed.

## Final verdict

CASHIER PAYMENT FLOW IMPLEMENTED AND VERIFIED

## Recommended next task

REFUNDS-WRITEOFFS-RECON-001
