# CASHIER-PAYMENT-FLOW-HARDENING-001

## 1. Summary

The cashier payment workstation was hardened against stale patient state, out-of-order asynchronous responses, rapid duplicate submission, partial allocation failure, lost network responses, and unsafe backend error disclosure.

The cashier now uses one atomic and idempotent backend transaction. It no longer records a payment and then allocates it through independent frontend writes.

Final verdict: **PASS**

## 2. Branch

- Branch: `feature/cashier-payment-flow-hardening-001`
- Baseline: `origin/main`
- Required baseline merge commit confirmed: `eb6fd18be3a5a0021ad61b78bee7dc64bf988859`
- PR #333 was present in the baseline before this branch was created.

## 3. PR URL

- PR: https://github.com/NckNA/codex-test/pull/334
- PR title: `CASHIER-PAYMENT-FLOW-HARDENING-001: harden cashier payment reliability`
- PR state before final report update: open, not merged.

## 4. PR head reviewed before final report update

- Implementation head: `dda7889f5812ae43de76057a2c949aac3441d772`
- GitHub Actions workflow: `CI`
- Run ID: `29084583430`
- Run number: `656`
- Conclusion: `success`
- Tested commit: `dda7889f5812ae43de76057a2c949aac3441d772`
- Tested commit matched the PR implementation head.

## 5. Report update commit

N/A because the final report update commit cannot reference itself before creation.

- Report update commit: N/A (the report commit cannot reference itself; use the finalization receipt).
- The final report-only commit and its fresh CI run are recorded in the finalization receipt, PR body, and final task response after push.

## 6. Changed files

Implementation files:

- `supabase/migrations/0019_harden_cashier_payment_flow.sql`
- `supabase/tests/0019_cashier_payment_hardening_test.sql`
- `supabase/tests/0019_cashier_payment_concurrency.ps1`
- `src/data/repositories/FinanceRepository.ts`
- `src/data/repositories/FinanceRpcClient.ts`
- `src/data/repositories/FinanceRpcClient.test.ts`
- `src/data/hooks/useAsyncQuery.ts`
- `src/data/hooks/useAsyncQuery.test.tsx`
- `src/data/hooks/useCashierPatientSearch.ts`
- `src/data/hooks/useCashierPatientSearch.test.tsx`
- `src/data/hooks/useCashierPaymentFlow.ts`
- `src/data/hooks/useCashierPaymentFlow.test.tsx`
- `src/components/cashier/CashierPatientSearch.tsx`
- `src/components/cashier/CashierPaymentForm.tsx`
- `src/components/cashier/CashierPaymentPanel.tsx`
- `src/components/cashier/CashierPaymentPanel.test.tsx`
- `src/components/cashier/CashierPaymentResult.tsx`

Report file:

- `_ai_work/REPORTS/CASHIER-PAYMENT-FLOW-HARDENING-001_hardening.md`

No seed, generated type, unrelated UI, refund UI, or write-off UI file was changed.

## 7. Pre-read

Reviewed before implementation:

- `_ai_work/REPORTS/PAYMENTS-DEBTS-RECON-001_finance_model.md`
- `_ai_work/REPORTS/PAYMENTS-DEBTS-RPC-001C_rpc.md`
- `_ai_work/REPORTS/PAYMENTS-DEBTS-RPC-CLIENT-001D_client.md`
- `_ai_work/REPORTS/PATIENT-FINANCE-UI-001_ui.md`
- `_ai_work/REPORTS/CASHIER-PAYMENT-FLOW-001_cashier.md`
- `_ai_work/REPORTS/REFUNDS-WRITEOFFS-FOUNDATION-001_foundation.md`
- security-definer and tenant-boundary reports
- cashier hooks, components, route and role gating
- `FinanceRepository.ts` and `FinanceRpcClient.ts`
- migrations `0016`, `0017`, and `0018`
- current finance role, audit/activity, RLS, and grant helpers.

## 8. Existing cashier failure analysis

The previous flow was:

1. optionally issue every selected draft invoice;
2. call `recordPayment`;
3. call `allocatePayment` in a frontend loop;
4. refresh finance reads;
5. construct a result in the hook.

Failure consequences:

- a payment could commit before the first allocation failed;
- a later allocation could fail after earlier allocations committed;
- a committed response lost by the network could encourage a duplicate retry;
- refresh failure could be presented as payment failure;
- patient A finance or result state could remain visible while patient B was selected;
- a slow patient A request could overwrite patient B;
- patient search had the same out-of-order response risk;
- raw repository/Supabase errors could reach the cashier UI.

Existing `record_payment` did not provide cashier operation idempotency. `external_reference` and metadata were not sufficient uniqueness controls.

## 9. Architecture decision

Implemented the preferred atomic backend solution plus an explicit reconciliation lookup.

The cashier UI now calls one RPC:

```sql
record_and_allocate_payment(
  p_tenant_id uuid,
  p_patient_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_currency text default 'KZT',
  p_received_at timestamptz default null,
  p_external_reference text default null,
  p_payer_name text default null,
  p_notes text default null,
  p_invoice_ids uuid[],
  p_idempotency_key text,
  p_metadata jsonb default '{}'
) returns jsonb
```

Reconciliation uses:

```sql
get_cashier_payment_operation(
  p_tenant_id uuid,
  p_idempotency_key text
) returns jsonb
```

Existing lower-level finance RPCs remain available for compatibility, but the cashier workflow no longer composes them client-side.

## 10. Patient state isolation

Patient identity is represented by a tenant/patient context key.

On a context change the flow clears:

- selected invoice IDs;
- prior payment result;
- operation key and captured request;
- action error;
- refresh warning;
- preview state in the panel;
- previous finance data visibility.

Finance data, selection, errors, and result are additionally guarded at render time by the active tenant/patient context. A mismatched result is never exposed.

Patient selection is disabled while a write or reconciliation is in flight. An already submitted backend operation is not silently cancelled.

## 11. Async race protection

`useAsyncQuery` now tracks request generations and query identity.

Only the latest request may apply:

- success state;
- error state;
- loading completion;
- callbacks.

Older requests and unmounted components are ignored. Data from an old query key is hidden immediately before replacement data arrives.

`useCashierPatientSearch` has an independent generation, tenant, and mounted guard. A slow `Ali` search cannot overwrite a newer `Alisa` search, and a stale error cannot replace current success.

The shared hook contract was preserved for existing callers. Full-suite validation caught and prevented an initial implementation that could retrigger callers with unstable `initialData` values.

## 12. Operation state machine

`useCashierPaymentFlow` now exposes explicit states:

- `idle`
- `loading_patient_finance`
- `ready`
- `submitting`
- `reconciling`
- `succeeded`
- `failed_before_commit`
- `uncertain`
- `stale_patient`

The hook returns the active patient, finance data, selected invoices, operation status/key, confirmed result, safe error, refresh warning, submit, retry, reconciliation, reset, and refresh operations.

Write success and post-write refresh success are separate facts.

## 13. Idempotency design

Added to `payments`:

- `cashier_operation_key text`
- `cashier_operation_fingerprint text`

A partial unique index enforces one key per tenant:

`uq_payments_tenant_cashier_operation_key (tenant_id, cashier_operation_key)`

The client generates one key per intended submit:

`cashier-payment:<tenantId>:<patientId>:<uuid>`

The key is retained for safe retry and reconciliation. It is not regenerated on retry.

The server fingerprints the material request fields, including tenant, patient, amount, method, currency, optional payment fields, invoice order, and metadata. Reuse with a different request raises `CASHIER_IDEMPOTENCY_CONFLICT`.

An advisory transaction lock serializes concurrent retries with the same tenant/key. Exact repeats return `already_completed` with the existing payment and allocations.

## 14. Atomic transaction design

The RPC:

1. derives the actor from `auth.uid()`;
2. permits only clinic owner, clinic admin, and cashier;
3. validates tenant, patient, amount, method, currency, metadata, invoice IDs, and operation key;
4. rejects empty or duplicate invoice IDs;
5. locks selected invoices in stable UUID order;
6. verifies tenant, patient, actionable status, positive balance, and write-off conflicts;
7. issues selected draft invoices only when active items exist;
8. rejects payment above selected available balance;
9. records exactly one payment;
10. allocates in caller-selected deterministic order;
11. recalculates invoices and payment through existing controlled helpers;
12. writes established audit/activity facts;
13. returns a composite result.

Any exception rolls back draft issue, payment creation, all allocations, status recalculation, audit, and activity writes.

## 15. Retry/reconciliation design

When the client cannot classify the outcome of the first request, it does not generate another operation key.

It shows a reconciliation state and calls `get_cashier_payment_operation` with the same tenant/key.

Possible durable outcomes:

- `not_found`: payment was not created;
- `completed`: existing transaction result loaded;
- `already_completed`: exact idempotent retry returned the existing transaction.

No artificial durable `in_progress` state was introduced.

If reconciliation also cannot be completed, the UI remains `uncertain` and explicitly warns the cashier not to enter the payment again until checked.

## 16. Error classification

Cashier-safe categories:

- `validation`
- `permission`
- `stale_patient`
- `duplicate_conflict`
- `operation_uncertain`
- `payment_not_created`
- `operation_failed`
- `read_failed`

User-facing messages are Russian and bounded. Raw SQLSTATE values, Postgres function names, JSON dumps, stack traces, and UUID collections are not rendered.

Examples implemented:

- `Недостаточно прав для кассовой операции.`
- `Оплата не была создана.`
- `Не удалось получить ответ сервера. Проверяем, была ли оплата сохранена.`
- `Оплата сохранена, но данные не удалось обновить. Обновите страницу.`

## 17. UI behavior

`CashierPaymentPanel`:

- keys the finance workspace by tenant/patient;
- hides prior patient facts immediately;
- displays patient-specific loading, reconciliation, uncertain, and refresh-warning states;
- disables patient switching during active write/reconciliation;
- never renders a mismatched result.

`CashierPaymentForm`:

- uses an immediate submit ref guard and disabled control;
- preserves values during uncertain/retry state;
- separates `Принять оплату`, `Проверить результат`, and `Повторить безопасно`.

`CashierPaymentResult` displays patient, short payment ID, amount, method, allocated invoices/amount, remaining debt, operation status, retry notice, and timestamp. It is not called a fiscal receipt.

## 18. Role/tenant matrix

Backend and UI validation:

| Role/context | Result |
|---|---|
| clinic owner | allowed |
| clinic admin | allowed |
| cashier | allowed |
| doctor | blocked |
| registrar | blocked |
| no tenant | blocked/no payment controls |
| unknown role | blocked |
| tenant B using tenant A patient/invoice | blocked |
| tenant B lookup of tenant A operation key | `not_found`, no data revealed |

Actor IDs for payments and finance facts derive from `auth.uid()`.

## 19. SQL tests

Command:

```powershell
Get-Content supabase\tests\0019_cashier_payment_hardening_test.sql | docker exec -i supabase_db_codex-test-supabase psql -U postgres -d postgres
```

Result:

`CASHIER PAYMENT HARDENING SQL TESTS PASSED`

Covered normal cashier/admin operation, denied roles, tenant/patient boundaries, invalid inputs, draft issue, invalid invoice statuses, write-off conflict, exact retry, conflicting key reuse, lookup isolation, grants, SECURITY DEFINER/search path, actor derivation, and side effects.

Forced failure on the first allocation left no payment. Forced failure on the second allocation rolled back the payment and the first allocation.

## 20. Concurrency tests

Command:

```powershell
powershell -ExecutionPolicy Bypass -File supabase\tests\0019_cashier_payment_concurrency.ps1
```

Result:

```text
IDENTICAL_RETRY success=2 payments=1 allocations=1 audit=2 activity=2
COMPETING_OPERATIONS success=1 rejected=1 payments=1 allocated=700.00 balance=300.00
CASHIER CONCURRENCY VALIDATION PASSED
```

Concurrent exact retries converged on one payment/allocation and one logical audit/activity sequence. Competing 700 payments against a 1000 invoice produced one success, one rejection, and no over-allocation.

## 21. TypeScript tests

Targeted validation:

- 6 files passed;
- 117 tests passed.

Included:

- `FinanceRpcClient`: 52 tests;
- `FinanceRepository`: 23 tests;
- async query generation tests;
- cashier search race tests;
- cashier state-machine tests;
- cashier component tests.

Full suite:

- 68 files passed;
- 700 tests passed.

## 22. Browser smoke

Local environment used real local Supabase Auth and role memberships. Temporary QA users and browser fixtures were created outside committed seed files. No secrets were printed.

### Normal payment

Passed. Cashier selected a patient/invoice, submitted payment, and saw `Оплата сохранена и распределена`. No fatal console errors, failed requests, raw SQL errors, or visible secrets.

### Double submit

The first click immediately disabled the submit control. The automation's attempted second click was refused because the button was disabled. Database validation confirmed exactly one payment and one allocation for each invoice, with no extra operation key or audit/activity sequence.

### Patient switch

Passed. Patient A data disappeared immediately when patient B was selected. Patient B data remained visible after requests settled. Patient A service/invoice text did not appear under patient B.

### Stale response

Deterministically validated in hook/component tests using delayed patient A and faster patient B promises. Browser tooling did not provide reliable request interception for this local run, so it is not falsely claimed as a browser network-interception test.

### Uncertain response/retry

Validated in hook/component tests by simulating a committed-response-loss classification and reconciliation through the same operation key. Browser tooling did not support deterministic response dropping while preserving the server commit.

### Rollback behavior

Validated through SQL transaction integration with forced first and second allocation failures. Browser-level deterministic database trigger injection during a user action was intentionally not claimed.

### Role tests

- Admin A: allowed.
- Cashier A: allowed.
- Doctor A: blocked.
- Registrar A: blocked.
- No-tenant user: no patient/payment controls.

### Cross-tenant

Admin B could not see or select Clinic A patient data. SQL lookup proved a tenant A operation key returns `not_found` in tenant B.

## 23. DB validation

Browser-run database facts before cleanup:

- Clinic A smoke payments: 4;
- active allocations: 4;
- duplicate cashier operation keys: 0;
- payment audit facts: 8;
- payment activity facts: 8;
- paid browser invoices: 4;
- tenant B payments against the Clinic A scenarios: 0.

For the rapid-submit patient, two invoices produced exactly two payments and two allocations, not a third duplicate payment.

Schema/grant assertions after final reset:

- 24/24 passed;
- cashier key/fingerprint columns exist;
- key constraint/index exist;
- payments and allocations retain RLS;
- anon/authenticated have no direct table writes;
- both public cashier RPCs are SECURITY DEFINER with `search_path=public, pg_temp`;
- authenticated has exact execute grants;
- anon and PUBLIC do not.

## 24. Side-effect validation

During browser smoke:

- `patients.balance` remained `321.00` and `654.00` for the two Clinic A patients;
- `completed_services`: 0;
- `appointments`: 0;
- `documents`: 0.

The migration and application code contain no clinical, document, stock, or timeline mutation path. Payment remains distinct from treatment completion, and allocation remains distinct from payment creation.

## 25. Cleanup

After browser and DB validation:

- dev server stopped;
- temporary `.env.local` removed;
- local database reset with `npx supabase db reset --no-seed`;
- temporary QA users and smoke fixtures removed by reset;
- patients: 0;
- invoices: 0;
- payments: 0;
- payment allocations: 0;
- completed services: 0;
- appointments: 0;
- documents: 0.

No seed changes were committed.

## 26. Lint/test/build

Final quality profile:

- `npm run lint`: passed;
- targeted tests: 6 files / 117 tests passed;
- `npm run test -- --run`: 68 files / 700 tests passed;
- `npm run build`: passed;
- `npx supabase db reset --no-seed`: passed.

Existing non-blocking warnings remain:

- unrelated React `act(...)` warnings in older dental/visit tests;
- existing Vite chunk-size warning;
- GitHub Actions warning that actions targeting Node.js 20 are forced onto Node.js 24.

## 27. GitHub Actions CI

Implementation-head CI:

- Workflow: `CI`
- Run ID: `29084583430`
- Run number: `656`
- Status: completed
- Conclusion: success
- Tested commit: `dda7889f5812ae43de76057a2c949aac3441d772`
- ESLint: success
- Tests: success
- Build: success

A fresh run on the report-only PR head is verified after this report commit is pushed.

## 28. Existing warnings

- The repository still contains unrelated React test-environment `act(...)` warnings.
- Vite still reports a non-blocking large chunk warning.
- The local QA seeder script encountered an existing profile-upsert permission problem after creating its first auth user. Local-only QA users were therefore created through a temporary non-committed SQL fixture, and final reset removed them.
- Browser tooling could not deterministically drop only the first RPC response after a committed transaction or inject an allocation failure during the browser action. Those scenarios were validated in component and SQL integration tests and are not misrepresented as browser interception tests.

No blocker remains for cashier payment reliability hardening.

## Checks

- baseline merge commit verified before branch creation;
- migration reset passed;
- SQL lifecycle, role, rollback, grant, and side-effect tests passed;
- concurrency/idempotency validation passed;
- targeted and full TypeScript suites passed;
- real local Supabase browser smoke completed for normal payment, patient switching, roles, and tenant isolation;
- schema/grant assertions passed;
- final cleanup reset passed;
- implementation-head GitHub Actions CI passed on the reviewed commit.

## Issues/Limitations

- Browser tooling could not deterministically drop only a committed RPC response or inject a second-allocation database failure during a UI action. These cases were validated through hook/component and SQL transaction tests and are not claimed as browser interception tests.
- The existing local QA seeder profile upsert failed, so temporary local QA users were created through a non-committed SQL fixture and removed by the final reset.
- Existing unrelated React `act(...)`, Vite chunk-size, and GitHub Actions Node-version warnings remain non-blocking.

## 29. What was intentionally not changed

- no refunds UI;
- no write-offs UI;
- no refund/write-off RPC behavior changes;
- no payment provider integration;
- no Kaspi/Halyk API;
- no fiscal receipt;
- no documents;
- no stock;
- no timeline integration;
- no completed-service mutation;
- no appointment mutation;
- no `patients.balance` write or truth source;
- no cloud migration apply;
- no committed seed changes;
- no committed generated types;
- no service role in application code;
- no HEP-V2;
- no unrelated broad refactor;
- no merge.

## 30. Final verdict

CASHIER PAYMENT FLOW HARDENED AND VERIFIED

## 31. Recommended next task

`REFUNDS-WRITEOFFS-UI-001`
