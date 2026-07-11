# CASHIER-CREDIT-PREPAYMENT-UI-001

## 1. Final verdict

Task verdict: **CASHIER CREDIT PREPAYMENT UI IMPLEMENTED AND VERIFIED**

Machine-readable final verdict: **PASS**

The operational cashier UI for receiving new patient money without paying an invoice is implemented, tested in a real browser, reconciled against the hardened migration 0023 contract, validated in PostgreSQL, cleaned locally, and ready for review. The PR must remain open and unmerged.

## 2. Summary

A single reusable `AcceptPatientPrepaymentDialog` now provides intentional patient-credit intake from two authorized surfaces:

1. the cashier patient workspace;
2. the patient Finance tab.

The workflow calls the existing hardened `record_patient_credit_payment` contract through `useFinanceActions` and `FinanceRpcClient`. It does not introduce a prepayment table or a second money ledger.

The domain distinction is explicit:

```text
new money now -> Принять предоплату
invoice payment -> Принять оплату по счетам
existing reserved credit -> Использовать депозит
new reservation -> Создать депозит
```

One Chrome-discovered integration defect was fixed during QA: a cashier finance refresh temporarily unmounted the prepayment dialog and erased the visible success result. The prepayment block is now preserved while its own operation is active, and a regression test protects that behavior.

## 3. Branch

`feature/cashier-credit-prepayment-ui-001`

## 4. PR URL

Pending publication.

## 5. Baseline

- repository: `NckNA/codex-test`;
- base branch: `main`;
- verified baseline: `4794a2e6552ccd224165bfd0dda5314aba5edb84`;
- PR #343 was confirmed merged into `origin/main` at that exact commit;
- the task worktree was clean before implementation.

## 6. PR head reviewed before final report update

Pending implementation commit and PR publication.

## 7. Report update commit

Report update commit: N/A because final report commit cannot reference itself; use the finalization receipt and final task response for the final report-only commit and fresh CI.

## 8. Changed files

Implementation and tests:

- `src/components/cashier/AcceptPatientPrepaymentDialog.tsx`;
- `src/components/cashier/AcceptPatientPrepaymentDialog.test.tsx`;
- `src/components/cashier/CashierPaymentForm.tsx`;
- `src/components/cashier/CashierPaymentPanel.tsx`;
- `src/components/cashier/CashierPaymentPanel.test.tsx`;
- `src/components/finance/PatientFinancePanel.tsx`;
- `src/components/finance/PatientFinancePanel.test.tsx`;
- `src/components/finance/PaymentActions.tsx`;
- `src/components/finance/PaymentList.tsx`;
- `src/data/hooks/useFinanceActions.ts`;
- `src/data/hooks/useFinanceActions.test.tsx`;
- `src/pages/PatientCardPage.tsx`;
- `_ai_work/REPORTS/CASHIER-CREDIT-PREPAYMENT-UI-001_ui.md`.

No migration, seed, package, lockfile, generated type, screenshot, QA helper, environment file, or Supabase client shim is included in the final diff.

## 9. Pre-read

Reviewed before implementation:

- `POST-FINANCE-ROADMAP-RECON-001`;
- `CASHIER-CREDIT-PREPAYMENT-HARDENING-001`;
- `CASHIER-PAYMENT-FLOW-001`;
- `CASHIER-PAYMENT-FLOW-HARDENING-001`;
- `PATIENT-CREDIT-DEPOSITS-FOUNDATION-001`;
- `PATIENT-CREDIT-DEPOSITS-UI-001`;
- `FINANCE-SUMMARY-CORRECTNESS-001`;
- cashier page, summary, search, invoice list, payment form, result panel and permissions;
- patient Finance panel, payment history/actions and deposit UI;
- `useFinanceActions`, `useCashierPaymentFlow`, `FinanceRpcClient`, `FinanceRepository` and their tests;
- migrations 0016 through 0023 and relevant SQL/concurrency tests.

## 10. Existing UI inventory

Before this task:

1. The patient Finance tab contained an inline generic action labelled `Принять оплату`.
2. That action already reached the hardened 0023 RPC through `useFinanceActions` and `FinanceRpcClient`.
3. It allowed a payment without an invoice and therefore produced unallocated patient credit.
4. Its wording did not clearly distinguish invoice payment from unallocated new money.
5. Patient credit was shown in the patient Finance summary and cashier summary.
6. Owner, admin and cashier could reach the backend action through finance permissions.
7. The hook performed same-key recovery, but the UI exposed only a generic loading flag and no reconciliation state.
8. The form had a local pending guard, while the hook did not yet deduplicate concurrent calls at the same scope.
9. The action was patient-scoped.
10. Cashier and patient-card surfaces had adjacent but different payment concepts, creating a risk of a second duplicate form.

## 11. Non-duplication decision

The old inline generic patient payment form was not copied.

A single reusable dialog was created and embedded in both allowed entry points. The old `PaymentActions` component now handles only payment void controls. Payment history remains in `PaymentList`.

The authoritative money model remains:

```text
payments = money received
payment_allocations = application of received money to invoices
patient_fund_reservations = explicit reservation of existing credit
patient credit = server-derived remaining payment capacity
```

No `prepayments` table, local financial ledger, localStorage fallback, new SQL migration, or direct table write was added.

## 12. Entry points

Two and only two operational entry points were added:

1. cashier patient workspace, test id `cashier-prepayment-open`;
2. patient Finance tab, test id `patient-finance-prepayment-open`.

The same dialog and the same hook contract are reused in both places.

The cashier entry is kept separate from the existing allocated cashier form. The patient Finance entry is kept separate from payment history, refund, void, allocation and deposit actions.

## 13. Dialog design

The dialog contains:

- patient name;
- current available credit;
- current debt;
- reserved deposit amount;
- refund reserve amount;
- fixed currency KZT;
- amount;
- payment method;
- optional received date/time;
- optional external reference;
- optional payer name;
- optional note.

There is no currency selector.

The fixed explanation is:

> Деньги будут приняты клиникой и сохранены как доступный кредит пациента. Счёт и депозит автоматически не создаются.

Before submit, the dialog shows:

- patient;
- amount;
- payment method;
- `Счёт не выбран`;
- `Деньги станут доступным кредитом пациента`;
- the warning that this records new money and does not use existing credit.

## 14. Wording separation

Implemented labels:

- unallocated new money: `Принять предоплату`;
- allocated cashier payment: `Принять оплату по счетам`;
- explicit reservation: `Создать депозит`;
- reserved-credit consumption: `Использовать депозит`.

The prepayment success state never says:

- `Счёт оплачен`;
- `Депозит создан`;
- `Кредит использован`.

The wording `Пополнить баланс` is not used, and `patients.balance` is not treated as financial truth.

## 15. Validation

Client validation enforces:

- amount greater than zero;
- finite numeric amount;
- maximum two decimal places;
- selected patient;
- selected tenant;
- selected backend-supported payment method;
- trimming of external reference, payer name and note;
- whitespace-only optional values become `null`;
- KZT is fixed.

Safe validation messages include:

- `Введите сумму больше нуля.`;
- `Выберите способ оплаты.`;
- `Пациент не выбран.`;
- `Клиника не выбрана.`.

The backend remains authoritative.

## 16. Idempotency handling

Idempotency remains owned by `useFinanceActions`, not duplicated in the component.

The hook now exposes explicit patient-credit operation status and result while preserving the hardened behavior:

- one key is generated for the first submission;
- the same key survives ambiguous transport results;
- recovery uses the same key;
- confirmed `not_found` retries once with the same key;
- changed payload while unresolved is rejected;
- definitive validation or permission failures clear pending identity;
- confirmed success clears pending identity;
- unresolved failure retains it;
- an in-flight map returns the same promise for rapid duplicate submissions at the same tenant/patient scope.

The dialog also has a synchronous submit guard and disables the form while submitting or reconciling.

## 17. Uncertain-response recovery

Visible operation states:

- submitting: `Сохраняем платёж…`;
- reconciliation: `Проверяем, был ли платёж сохранён…`;
- unresolved: `Не удалось подтвердить результат операции. Повторите попытку с теми же данными.`;
- confirmed success: `Предоплата принята.`.

Real browser recovery used a temporary DEV-only network shim:

1. `record_patient_credit_payment` committed 1200 KZT;
2. the successful response was replaced with a transport failure;
3. the recovery RPC was delayed so the reconciliation state was visible;
4. `get_patient_credit_payment_operation` found the committed payment;
5. the dialog showed one success;
6. the database contained one payment.

For the unresolved conflict scenario:

1. 1300 KZT was committed;
2. both write and recovery responses were made ambiguous;
3. the dialog retained its operation identity;
4. changing the amount to 1400 KZT was blocked locally;
5. no second payment was created.

The temporary shim was fully restored before final tests and is absent from the diff.

## 18. Stale-context protection

Operation state is scoped by:

- tenant id;
- patient id;
- current operation fingerprint/key;
- current React context.

Implemented behavior:

- patient or tenant changes reset visible dialog state;
- a late success does not update another patient;
- a late response does not trigger refresh for the new context;
- old success, credit and patient name do not flash under the new patient;
- unresolved operation identity remains tied to the original tenant/patient map entry.

Real browser smoke delayed a 1600 KZT response for Patient I, switched by keyboard to Patient B, waited for the old response, and confirmed:

- Patient B remained selected;
- no `Предоплата принята.` appeared;
- no `1 600 KZT` appeared;
- Patient I's name disappeared.

## 19. Role matrix

| Role | View cashier finance | Receive prepayment |
| --- | --- | --- |
| clinic_owner | yes | yes |
| clinic_admin | yes | yes |
| cashier | yes | yes |
| doctor | no action | no |
| registrar | no action | no |
| unknown | no action | no |
| no tenant | no mutation entry point | no |
| no patient | no action | no |

The backend still performs final authorization.

Real browser contexts confirmed owner, admin and cashier visibility, doctor and registrar denial, and no action for the no-tenant user.

## 20. Accessibility

Implemented:

- `role="dialog"` and `aria-modal="true"`;
- accessible title via `aria-labelledby`;
- linked labels and inputs;
- focus moves to amount on open;
- Escape closes only when not submitting/reconciling;
- amount uses decimal input mode;
- field errors use `aria-invalid` and `aria-describedby`;
- progress uses `role="status"`;
- operation errors use `role="alert"`;
- disabled state is represented with native disabled controls and `aria-disabled` on submit;
- confirmation summary is textual and does not rely on color;
- the dialog is width-bounded, scrollable and mobile-safe;
- keyboard submission is guarded to one in-flight call.

## 21. Component tests

`AcceptPatientPrepaymentDialog.test.tsx` contains all 38 required component scenarios:

1. owner visibility;
2. admin visibility;
3. cashier visibility;
4. doctor hidden;
5. registrar hidden;
6. no tenant hidden;
7. no patient hidden;
8. open;
9. patient name;
10. credit;
11. debt;
12. deposit reserve;
13. refund reserve;
14. fixed KZT;
15. no currency selector;
16–20. amount/method validation;
21. optional-field trimming;
22–23. confirmation wording;
24. one hardened action call;
25. duplicate submit blocked;
26–27. submitting/reconciliation UI;
28–30. correct success wording;
31–33. safe permission/conflict/generic errors;
34–36. patient/tenant/stale protection;
37. allocated cashier wording unchanged;
38. reserved-credit wording unchanged.

`CashierPaymentPanel.test.tsx` now has 14 tests and includes the real-browser regression: prepayment success remains visible while the cashier finance refresh is pending and after it completes.

`PatientFinancePanel.test.tsx` was updated for the reusable entry point and hardened result contract.

Targeted final result:

- 3 files;
- 73 tests passed.

## 22. Hook tests

`useFinanceActions.test.tsx` now contains 21 tests, including:

- same key retained after uncertainty;
- recovery success becomes confirmed success;
- confirmed `not_found` retries once with the same key;
- a second uncertain result retains operation identity;
- changed payload is blocked while unresolved;
- success clears pending identity;
- permission and validation failures clear pending identity;
- stale patient response is ignored;
- stale tenant response is ignored;
- refresh occurs once after confirmed success;
- no refresh occurs after unresolved failure;
- rapid concurrent mutation calls are deduplicated;
- explicit submitting, reconciling and succeeded statuses are observable.

All 21 hook tests passed.

## 23. Real browser smoke

A real local browser was run against Vite on port 5187 and local Supabase.

Completed scenarios:

- role visibility for owner, admin, cashier, doctor, registrar and no-tenant;
- normal prepayment of 1000 KZT;
- duplicate-click protection with 1100 KZT and one database row;
- confirmed success view after cashier refetch;
- lost committed response and recovery for 1200 KZT;
- unresolved conflict protection for 1300 KZT versus changed 1400 KZT;
- stale Patient I response after switch to Patient B;
- explicit deposit reservation of 300 KZT over the 1000 KZT prepayment;
- available credit reduced to 700 KZT;
- existing allocated cashier payment of 500 KZT;
- patient Finance entry point and adjacent deposit/use labels.

Console observations:

- no fatal console errors;
- no unhandled promise rejection;
- no raw SQL output;
- no secrets visible.

A temporary no-tenant screenshot was created outside the repository and deleted during cleanup. No screenshot is committed.

## 24. Network validation

Local Supabase gateway logs showed:

- `record_patient_credit_payment` requests: 16, including intentional retry/recovery smoke traffic;
- `get_patient_credit_payment_operation` requests: 4;
- application calls to legacy `record_payment`: 0;
- direct `POST /rest/v1/payments` inserts: 0.

The allocated cashier flow continued to use its separate hardened atomic RPC.

The browser test tools reported no failed requests in successful scenarios and no secrets in captured output.

## 25. Database validation

Browser QA used isolated deterministic patients so each scenario could be counted independently.

Final pre-cleanup financial counts:

- hardened patient-credit payments: 8;
- hardened amount: 9400 KZT;
- allocated cashier payments: 1;
- all task-patient payments: 9;
- payment allocations: 1 for 500 KZT;
- invoices: 1, total 500 KZT, paid 500 KZT, balance 0;
- fund reservations: 1 for 300 KZT, remaining 300 KZT;
- refunds: 0;
- financial adjustments/write-offs: 0;
- negative capacity: none observed.

Critical isolated results:

- normal prepayment patient: one hardened 1000 KZT row;
- duplicate-submit patient: one 1100 KZT row and one operation key;
- uncertain recovery patient: one 1200 KZT row and one operation key;
- unresolved conflict patient: one 1300 KZT row despite the attempted changed payload;
- stale patients: one committed row each, with no cross-patient visual update;
- deposit creation created no new payment;
- allocated cashier flow created one separate payment and one allocation.

Audit events:

- `payment_recorded`: 9;
- `payment_allocated`: 1;
- `patient_fund_reservation_created`: 1.

Activity events matched the same 9 / 1 / 1 counts.

All control values in `patients.balance` remained unchanged: 321, 654, 987, 444, 555, 666, 777, 888, 999 and 1010.

## 26. Side-effect validation

For task patients, all counts remained zero in:

- appointments;
- treatment plans;
- completed services;
- clinical encounters;
- patient visits;
- documents;
- financial adjustments;
- integration tokens / amoCRM.

No stock or mailing table exists in the current schema, and no stock/mailing source file was changed.

No treatment, appointment, plan, completed-service, encounter, document, stock, mailing or integration mutation was issued by the prepayment workflow.

## 27. Cleanup

Completed cleanup:

- Vite process stopped;
- temporary network shim restored from backup;
- temporary backup removed;
- PID and Vite log removed;
- temporary screenshot removed;
- temporary owner seed modification restored;
- no `.env.local` was created;
- local database reset with `npx supabase db reset --no-seed`;
- task QA patients: 0;
- payments: 0;
- allocations: 0;
- reservations: 0;
- invoices: 0;
- refunds: 0;
- audit events: 0;
- activity events: 0;
- tenants: 0;
- QA auth users: 0.

## 28. Lint/test/build

Final checks after cleanup and after removing all temporary code:

- targeted prepayment/cashier/hook tests: 73 passed;
- ESLint: passed;
- full Vitest suite: 80 files, 864 tests passed;
- TypeScript build: passed;
- Vite production build: passed;
- transformed modules: 1946.

Non-blocking baseline warnings:

- existing React `act(...)` warnings in older tests;
- existing Vite warning for the large main bundle.

No package dependency was changed in this task.

## 29. GitHub Actions CI

Pending PR publication and fresh GitHub Actions CI on the final PR head.

Required final confirmation:

- CI tested commit equals final PR head;
- ESLint passed;
- tests passed;
- build passed;
- PR remains open and unmerged.

## 30. Known limitations

1. An unresolved operation key is retained in the mounted hook instance. Durable recovery across a full browser restart is not added by this UI task and remains a future workflow concern.
2. The no-tenant browser context correctly showed no prepayment action, but the application-level pre-cashier screen did not expose the component's internal `cashier-no-tenant` text in that isolated route assertion.
3. The task does not add a legal receipt or fiscal document.
4. Existing bundle-size and unrelated React test warnings remain.
5. No cloud migration was applied; migration 0023 was already part of the verified baseline.

## 31. What was intentionally not implemented

- no prepayment table;
- no new SQL migration;
- no backend redesign;
- no direct table write;
- no service-role frontend path;
- no localStorage financial fallback;
- no automatic invoice;
- no automatic allocation;
- no automatic deposit;
- no treatment completion;
- no appointment/treatment-plan/completed-service change;
- no `patients.balance` mutation or display as financial truth;
- no cash shift;
- no fiscal receipt;
- no payment-provider integration;
- no mixed-tender redesign;
- no invoice correction;
- no refund or write-off change;
- no cloud write;
- no seed, generated type, package or HEP-V2 change.

## 32. Recommended next task

`SCHEDULE-OPERATIONS-RECON-001`

Reason: the prepayment intake chain is now operationally complete. The next P0 integrity gap identified by the repository-wide roadmap is server-side protection against double booking and a verified schedule-operations lifecycle.

This next task was not started.
