# REFUNDS-WRITEOFFS-UI-001

Final verdict: **PASS**

## 1. Summary

Implemented safe payment refund and invoice debt write-off workflows inside the existing patient finance tab.

The UI now exposes backend refund and write-off lifecycles without direct table writes, raw RPC calls from React components, payment-provider integrations, clinical mutations, or SQL changes.

## 2. Branch

`feature/refunds-writeoffs-ui-001`

Required baseline:

`d124602988fabb807be41f9ad7254b0990d1adb7`

The branch was created from the current `origin/main` after confirming that PR #333 and PR #334 were merged.

## 3. PR URL

https://github.com/NckNA/codex-test/pull/335

## 4. PR head reviewed before final report update

Implementation head:

`9c468ea9f07523b52799301c182a9df805b1794c`

GitHub Actions CI #659, run `29087873866`, completed successfully on this exact implementation commit.

## 5. Report update commit

N/A because the final report update commit cannot reference itself before creation.

- Report update commit: N/A (the report commit cannot reference itself; use the finalization receipt).
- The final report-only commit and fresh CI run are recorded in the PR body, finalization receipt, and final task response after push.

## 6. Changed files

Added:

- `src/components/finance/RefundActions.tsx`
- `src/components/finance/RefundRequestDialog.tsx`
- `src/components/finance/RefundApprovalPanel.tsx`
- `src/components/finance/RefundHistory.tsx`
- `src/components/finance/WriteOffActions.tsx`
- `src/components/finance/WriteOffRequestDialog.tsx`
- `src/components/finance/WriteOffApprovalPanel.tsx`
- `src/components/finance/WriteOffHistory.tsx`
- `src/components/finance/financeAdjustmentLabels.ts`
- `src/components/finance/financeAdjustmentPermissions.ts`
- `src/data/hooks/usePaymentRefundFlow.ts`
- `src/data/hooks/useInvoiceWriteOffFlow.ts`
- `src/data/hooks/usePaymentRefundFlow.test.tsx`
- `src/data/hooks/useInvoiceWriteOffFlow.test.tsx`
- `src/components/finance/RefundActions.test.tsx`
- `src/components/finance/WriteOffActions.test.tsx`

Modified:

- `src/components/finance/PaymentList.tsx`
- `src/components/finance/InvoiceDetail.tsx`
- `src/components/finance/PatientFinancePanel.tsx`
- `src/components/finance/PatientFinancePanel.test.tsx`

No migration, SQL, generated type, seed, package, lockfile, cloud, document, stock, timeline, or clinical workflow file changed.

## 7. Pre-read

Reviewed before implementation:

- `_ai_work/REPORTS/REFUNDS-WRITEOFFS-FOUNDATION-001_foundation.md`
- `_ai_work/REPORTS/CASHIER-PAYMENT-FLOW-HARDENING-001_hardening.md`
- `_ai_work/REPORTS/PATIENT-FINANCE-UI-001_ui.md`
- `_ai_work/REPORTS/PAYMENTS-DEBTS-REPOSITORY-001B_repository.md`
- `_ai_work/REPORTS/PAYMENTS-DEBTS-RPC-CLIENT-001D_client.md`
- current finance repository and RPC client implementations
- current patient finance hooks, actions, components, role helpers, and confirmation patterns
- current auth and tenant contexts
- existing security-definer and multitenant architecture reports available in the repository

## 8. UI architecture decision

Refund controls are embedded in each payment card rendered by `PaymentList`.

Write-off controls are embedded in the selected invoice rendered by `InvoiceDetail`.

The existing patient card Finance tab remains the single operational finance surface. A second finance application was not created, and the cashier page was not expanded because the patient finance tab already supplies:

- patient identity;
- payment and invoice history;
- role context;
- shared finance refresh;
- tenant isolation;
- existing safe finance presentation.

All reads use `FinanceRepository`. All writes use `FinanceRpcClient`.

## 9. Refund workflow

Each payment card loads:

- refundability through `getPaymentRefundability`;
- refund history through `listRefunds`.

Supported transitions:

- request;
- approve;
- complete;
- reject;
- void pending or approved request.

Completed refunds expose no void action.

Refunds do not void payments or allocations automatically and do not alter invoice debt.

## 10. Refund permissions

- `clinic_owner`: request, approve, complete, reject, void.
- `clinic_admin`: request, approve, complete, reject, void.
- `cashier`: request and complete approved refund.
- `doctor`: read-only refund information, no mutations.
- `registrar`: read-only refund information, no mutations.
- no tenant or unknown role: no refund data/action workflow.

Backend role/RLS enforcement remains authoritative. Permission failures are also handled safely by the hook.

## 11. Refund request behavior

The request dialog requires:

- positive amount;
- amount not greater than currently refundable amount;
- controlled refund method;
- non-empty trimmed reason no longer than 1000 characters.

Supported methods:

- cash;
- Kaspi;
- Halyk terminal;
- card;
- bank transfer;
- other.

Only controlled metadata `{ source: 'patient_finance_ui' }` is sent. There is no raw metadata editor.

Success wording is:

`Заявка на возврат создана.`

The UI never claims that money was returned at request time.

## 12. Refund approval/rejection/void behavior

Pending refunds allow owner/admin to:

- approve after a confirmation that explicitly says money is not yet marked returned;
- reject with a required reason;
- void with a required reason.

Approved refunds allow owner/admin to void with a required reason.

Reject and void release the reserved refundable amount after refresh.

Processed/current status is reloaded after uncertain failures before another action is offered.

## 13. Refund completion behavior

Approved refunds can be completed by owner/admin/cashier.

The confirmation states:

`Подтвердите, что деньги фактически возвращены пациенту.`

An optional external reference can be recorded.

Completion calls only `FinanceRpcClient.completeRefund`. It does not call a bank, terminal, fiscal service, PDF generator, messaging service, or provider API.

After success the payment and refundability summaries refresh, showing `partially_refunded` or `refunded` as calculated by the backend.

## 14. Refund history

Payment history shows:

- amount;
- method;
- status;
- reason;
- requested, approved, completed, rejected, and voided timestamps;
- external reference;
- void reason.

Russian status labels are used. Raw metadata JSON and raw actor/security payloads are not rendered.

## 15. Refundability calculation display

The UI displays:

- `Сумма платежа`;
- `Распределено`;
- `Уже возвращено`;
- `Зарезервировано под возврат`;
- `Доступно к возврату`.

When active allocations exist, the request action is hidden and the UI states:

`Возврат недоступен: средства распределены по счетам. Сначала отмените распределение платежа по счёту.`

Allocations are never voided automatically.

## 16. Write-off workflow

The selected invoice loads:

- write-off eligibility through `getInvoiceWriteOffEligibility`;
- filtered `write_off` adjustment history through `listFinancialAdjustments`.

Supported transitions:

- request;
- approve;
- reject;
- void pending or approved write-off.

Write-offs remain distinct from payments and do not increase `paid_amount`.

## 17. Write-off permissions

- `clinic_owner`: request, approve, reject, void.
- `clinic_admin`: request, approve, reject, void.
- `cashier`: no write-off mutation controls.
- `doctor`: no write-off mutation controls.
- `registrar`: no write-off mutation controls.
- no tenant or unknown role: blocked.

## 18. Write-off request behavior

The request dialog requires:

- positive amount;
- amount not greater than available write-off amount;
- non-empty trimmed reason no longer than 1000 characters.

Success wording is:

`Заявка на списание создана.`

The UI explains that the request reserves an amount but does not reduce debt before approval.

No payment row is created by the UI.

## 19. Write-off approval/rejection/void behavior

Approval warns that the paid amount will not change.

After backend approval:

- approved write-off amount increases;
- invoice balance decreases;
- paid amount remains unchanged;
- full write-off displays the backend `written_off` status.

Rejection requires a reason and releases the reserved amount without changing invoice balance.

Voiding an approved write-off requires a reason and warns:

`Отмена одобренного списания восстановит задолженность.`

The refreshed backend result then shows the reopened debt.

## 20. Write-off history

History is filtered to `adjustment_type = write_off` and displays:

- amount;
- status;
- reason;
- created time;
- approved time;
- voided time;
- void reason;
- invoice reference.

Discounts, corrections, and surcharges are not mixed into this component.

## 21. Eligibility display

The UI displays:

- `Сумма счёта`;
- `Оплачено`;
- `Уже списано`;
- `Зарезервировано под списание`;
- `Доступно к списанию`.

Backend ineligibility reasons are converted to safe Russian messages for draft, paid, voided, archived, reserved, and fully consumed debt states.

## 22. Hook state and stale-context protection

`usePaymentRefundFlow` is keyed by tenant/payment.

`useInvoiceWriteOffFlow` is keyed by tenant/invoice.

Both hooks:

- do not fetch without complete context;
- clear action state on context change;
- use the hardened `useAsyncQuery` generation/key protection;
- ignore late read responses for the previous context;
- ignore late mutation completion/error state for the previous context;
- never render one payment's or invoice's finance state under another context;
- prevent concurrent local action submission with an in-flight promise guard.

## 23. Idempotency/retry behavior

Refund request keys use:

`refund-request:<tenantId>:<paymentId>:<uuid>`

Write-off request keys use:

`writeoff-request:<tenantId>:<invoiceId>:<uuid>`

The same key is retained across a safe retry when the material request signature is unchanged.

A new key is created for a different intended request.

For approval, completion, rejection, and void uncertainty, the hook refreshes current status before enabling another action and displays:

`Проверяем актуальный статус операции…`

The UI does not blindly repeat a lifecycle transition after an uncertain response.

## 24. Safe error handling

User-facing errors are bounded Russian messages, including:

- `Не удалось загрузить данные возврата.`
- `Не удалось загрузить данные списания.`
- `Сумма превышает доступную.`
- `Недостаточно прав.`
- `Заявка уже была обработана.`
- `Средства распределены по счетам. Сначала отмените распределение.`
- `Счёт больше не доступен для списания.`

The UI does not render SQLSTATE, Postgres function names, raw Supabase objects, stack traces, metadata JSON, or service-role information.

## 25. Role matrix

Browser and unit validation confirmed:

| Role | Refund request | Refund approve/reject/void | Refund complete | Write-off mutations |
|---|---:|---:|---:|---:|
| clinic_owner | yes | yes | yes | yes |
| clinic_admin | yes | yes | yes | yes |
| cashier | yes | no | yes | no |
| doctor | no | no | no | no |
| registrar | no | no | no | no |
| no tenant | no | no | no | no |
| unknown | no | no | no | no |

## 26. Unit tests

Required targeted command:

`npm run test -- --run src/data/hooks/usePaymentRefundFlow.test.tsx src/data/hooks/useInvoiceWriteOffFlow.test.tsx src/components/finance/RefundActions.test.tsx src/components/finance/WriteOffActions.test.tsx`

Result:

- 4 files passed;
- 38 tests passed.

Final finance targeted command also included `PatientFinancePanel.test.tsx`:

- 5 files passed;
- 47 tests passed.

Coverage includes permissions, validation, history, idempotency reuse, double submit, stale context, safe errors, allocated refund blocking, approved write-off void warning, and component integration.

## 27. Browser smoke

Used real local Supabase Auth users and deterministic local finance fixtures.

Refund browser results:

- Cashier requested 400 cash: pending shown, no returned-money claim.
- Admin approved: approved shown, no returned-money claim.
- Cashier completed: payment became partially refunded.
- Cashier requested remaining 600; Admin approved; Cashier completed.
- Payment became refunded; completed refunds totalled 1000.
- Completed refunds exposed no void action.
- Separate refund request was rejected and reserve released.
- Separate refund request was voided and reserve released.
- Allocated payment exposed no request action and instructed allocation void first.

Write-off browser results:

- Admin requested 400: pending shown, debt remained unchanged before approval.
- Admin approved 400: approved shown, balance became 600, paid remained 0.
- Admin requested and approved remaining 600: invoice displayed written-off state.
- Admin voided approved 600 after debt-reopen warning: balance returned to 600, paid remained 0.
- Separate write-off request was rejected: balance remained 500 and reserve released.

Role/tenant browser results:

- Cashier saw refund history and no write-off mutation controls.
- Doctor and registrar had no mutation controls.
- No-tenant user saw no patient finance data/actions.
- Admin B could not see Clinic A patient, payment, invoice, refund, or write-off data.
- No scenario exposed secrets or fatal console errors.

Screenshots were written only to the external Hermes report directory, not the repository.

## 28. DB validation

Before cleanup, local DB validation confirmed:

Refunds:

- main payment had completed refunds of 400 and 600;
- main payment status was `refunded`;
- reject fixture had one `rejected` refund of 300;
- void fixture had one `voided` refund of 250;
- rejected/voided payments remained `received`;
- allocated fixture remained `allocated`;
- active allocation count remained 1, total 1000.

Write-offs:

- main invoice had approved write-off 400 and voided write-off 600;
- final main invoice state after void: status `issued`, paid 0, written-off 400, balance 600;
- reject invoice had rejected write-off 200, paid 0, written-off 0, balance 500;
- payment count remained exactly the four fixture payments, proving no write-off payment creation.

Audit/activity:

- refund requested: 4 audit and 4 activity facts;
- refund approved: 2 and 2;
- refund completed: 2 and 2;
- refund rejected: 1 and 1;
- refund voided: 1 and 1;
- write-off requested: 3 and 3;
- write-off approved: 2 and 2;
- write-off rejected: 1 and 1;
- write-off voided: 1 and 1.

## 29. Side-effect validation

`patients.balance` was initialized to sentinel 321 and remained exactly 321 after all refund and write-off operations.

Source-scope checks found no references from the new workflow to:

- `completed_services`;
- appointments;
- documents;
- stock;
- timeline aggregation;
- `patients.balance` as a source of truth;
- direct table insert/update/delete/upsert;
- raw `supabase.rpc` in components;
- service-role credentials;
- localStorage.

The active task database policy intentionally excluded clinical/document tables, so a direct pre-clean runtime count query for those tables was refused by the safety layer. This limitation is not concealed. The existing seed contains no smoke clinical/document fixtures, no new code reaches those domains, the full regression suite passed, and final reset removed all task finance/audit fixtures.

## 30. Cleanup

The dev server was stopped and temporary `.env.local` was deleted.

Final command:

`npx supabase db reset --no-seed`

Final local schema/row assertions:

- 18/18 passed;
- patients 0;
- invoices 0;
- invoice items 0;
- payments 0;
- allocations 0;
- refunds 0;
- financial adjustments 0;
- audit events 0;
- activity events 0.

No seed changes were committed.

## 31. Lint/test/build

Final quality profile:

- `npm run lint`: passed;
- `npm run test -- --run`: 72 files / 738 tests passed;
- `npm run build`: passed.

Known non-blocking repository warnings:

- existing React `act(...)` warnings in some tests;
- Vite chunk-size warning;
- `npm ci` reported existing dependency audit findings; no dependency or lockfile changes were made.

## 32. GitHub Actions CI

Implementation CI:

- workflow: CI;
- run number: 659;
- run ID: `29087873866`;
- result: success;
- tested commit: `9c468ea9f07523b52799301c182a9df805b1794c`;
- ESLint: success;
- Tests: success;
- Build: success.

A fresh CI run for the final report-only head is required and is recorded after the report commit is pushed.

## 33. Browser/tooling limitations

- QA shortcut was not enabled; smoke used the normal local Supabase Auth login form with the password supplied only from the host environment.
- One early generic text assertion ran before all nested finance reads settled; subsequent selector-specific scenarios and final role scenarios passed.
- The active database policy refused direct reads of clinical/document tables because they were outside the allowlist. No policy broadening was used to weaken task isolation.
- Screenshot and temporary fixture artifacts were stored outside the repository.

## Checks

- exact required baseline verified;
- PR #333 and PR #334 merge ancestry verified;
- clean feature worktree used;
- no migration/SQL diff;
- no seed/generated type diff;
- required targeted tests passed;
- full test suite passed;
- lint and build passed;
- real local Supabase browser workflow passed;
- role and cross-tenant browser checks passed;
- finance DB facts and audit/activity facts passed;
- cleanup assertions passed;
- implementation-head CI passed.

## Issues/Limitations

No functional blocker remains.

The only validation limitation is the policy-enforced inability to issue direct runtime count queries against clinical/document tables. The report records the exact limitation and the compensating source-scope, regression, seed, and cleanup evidence.

## 34. What was intentionally not changed

- no migrations or SQL/RPC changes;
- no cloud apply;
- no seed changes committed;
- no generated types;
- no cashier page expansion;
- no payment provider, Kaspi, Halyk, bank, or terminal API;
- no fiscal receipt or PDF;
- no documents, stock, timeline, WhatsApp, or messaging integration;
- no allocation auto-void;
- no payment void substitution for refund;
- no payment creation for write-off;
- no clinical or appointment mutation;
- no `patients.balance` writes;
- no HEP-V2;
- no unrelated refactor.

## 35. Final verdict

REFUNDS WRITEOFFS UI IMPLEMENTED AND VERIFIED

## 36. Recommended next task

`FINANCE-OPERATIONS-RECON-001`

Suggested purpose:

- review remaining finance operational gaps;
- partial payments;
- overpayments and credit handling;
- refund/write-off reporting;
- permissions;
- operational audit completeness;
- finance dashboard readiness.

This next task was not started.
