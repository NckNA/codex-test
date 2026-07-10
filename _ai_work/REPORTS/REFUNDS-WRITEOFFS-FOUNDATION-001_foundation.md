# REFUNDS-WRITEOFFS-FOUNDATION-001 — Refunds and invoice write-offs backend foundation

## 1. Summary

Implemented and locally verified the controlled backend lifecycle for payment refunds and invoice write-offs.

The implementation closes the deliberate gap left by the original finance RPC layer:

- refund request, approval, completion, rejection, and cancellation before completion;
- invoice write-off request, approval, rejection, and cancellation/reversal;
- tenant-scoped idempotency;
- row locking and database guards against duplicate/concurrent over-consumption;
- payment status recalculation including completed refunds;
- invoice recalculation including approved write-offs;
- tenant-scoped repository read models;
- typed frontend RPC client methods;
- SQL lifecycle, role, side-effect, and concurrency validation.

The MVP boundary is explicit: a refund may return only currently unallocated payment funds. Existing allocations must first be voided through the existing controlled allocation-void RPC. Refund processing does not silently reopen invoices and does not invent a refund-allocation model that the schema does not possess.

Final verdict: **PASS**

Task acceptance verdict: **REFUNDS WRITEOFFS FOUNDATION IMPLEMENTED AND VERIFIED**

## 2. Branch

- Branch: `feature/refunds-writeoffs-foundation-001`
- Base branch: `main`
- Required baseline commit: `69ec4e6044ac082762f4ea20ed7efad4a9d1097d`
- Baseline validation: PR #332 was merged into `main`, and the task branch was created from that exact current baseline.

## 3. PR URL

- PR: https://github.com/NckNA/codex-test/pull/333
- PR state before final report update: open, not merged, not draft.

## 4. PR head reviewed before final report update

- Implementation head reviewed: `c48a7afbc878df6ef4db24f743cb66781a7b9657`
- GitHub Actions CI on implementation head: run `29079751549`, run number `652`, conclusion `success`.

## 5. Report update commit

N/A because the final report update commit cannot reference itself before creation.

- Report update commit: N/A (the report commit cannot reference itself; use the finalization receipt).

## 6. Changed files

Implementation files:

- `supabase/migrations/0018_create_refund_writeoff_rpc.sql`
- `supabase/tests/0018_refund_writeoff_rpc_test.sql`
- `supabase/tests/0018_refund_writeoff_concurrency.ps1`
- `src/data/repositories/FinanceRepository.ts`
- `src/data/repositories/FinanceRepository.test.ts`
- `src/data/repositories/FinanceRpcClient.ts`
- `src/data/repositories/FinanceRpcClient.test.ts`

Report file:

- `_ai_work/REPORTS/REFUNDS-WRITEOFFS-FOUNDATION-001_foundation.md`

No UI, React hook, route, cashier component, seed, generated type, document, stock, timeline, appointment, completed-service, or cloud migration file was changed.

## 7. Pre-read

Reviewed before implementation:

- `_ai_work/REPORTS/PAYMENTS-DEBTS-RECON-001_finance_model.md`
- `_ai_work/REPORTS/PAYMENTS-DEBTS-SCHEMA-001A_schema.md`
- `_ai_work/REPORTS/PAYMENTS-DEBTS-REPOSITORY-001B_repository.md`
- `_ai_work/REPORTS/PAYMENTS-DEBTS-RPC-001C_rpc.md`
- `_ai_work/REPORTS/PAYMENTS-DEBTS-RPC-CLIENT-001D_client.md`
- `_ai_work/REPORTS/PATIENT-FINANCE-UI-001_ui.md`
- `_ai_work/REPORTS/CASHIER-PAYMENT-FLOW-001_cashier.md`
- `_ai_work/REPORTS/SECURITY-DEFINER-RPC-RECON-001_security_definer_audit.md`
- `_ai_work/REPORTS/SECURITY-DEFINER-RPC-HARDENING-001A_rls_helper_grants.md`
- `supabase/migrations/0016_create_finance_model.sql`
- `supabase/migrations/0017_create_finance_rpc.sql`
- later migrations through the current `main` migration head;
- current `FinanceRepository.ts`, `FinanceRpcClient.ts`, their tests, audit/activity internal helpers, tenant-role helpers, RLS policies, and SECURITY DEFINER conventions.

The two security reports exist under slightly more descriptive filenames than the abbreviated task references. Their contents and conclusions were reviewed.

## 8. Existing schema reconciliation

### Refunds table

Existing `public.refunds` already contained:

- tenant, patient, and payment references;
- lifecycle status;
- refund method, amount, currency, and reason;
- requested, approved, completed, rejected, and void timestamps/actors where supported;
- external reference and metadata;
- positive amount, status, method, metadata, void reason/timestamp, tenant ownership, and foreign-key constraints;
- tenant-scoped read RLS for finance staff;
- no direct frontend write grants;
- existing repository row mapping.

Existing statuses were sufficient and were preserved:

- `pending`
- `approved`
- `completed`
- `rejected`
- `voided`
- `archived`

Gap closed by this task:

- idempotency key and tenant-scoped unique partial index;
- additional state-integrity constraints;
- controlled write lifecycle RPCs;
- completed-refund payment recalculation;
- concurrency and legacy-operation guards.

### Financial adjustments table

Existing `public.financial_adjustments` already contained:

- tenant and patient references;
- optional invoice, invoice-item, and payment references;
- adjustment type, status, amount, currency, reason, metadata;
- created, approved, and void actor/timestamp fields;
- positive amount, type, status, metadata, void, target-reference, tenant ownership, and foreign-key constraints;
- tenant-scoped read RLS for finance staff;
- no direct frontend write grants;
- existing repository row mapping.

Existing adjustment statuses were sufficient and were preserved:

- `active` as requested/pending;
- `approved` as applied;
- `rejected`;
- `voided`;
- `archived`.

Existing write-off type was preserved: `write_off`.

Gap closed by this task:

- idempotency key and tenant-scoped unique partial index;
- approved-state integrity;
- controlled write-off lifecycle RPCs;
- write-off-aware invoice recalculation;
- concurrency and legacy-operation guards.

### Existing invoice/payment calculations

Before this task:

- invoice `paid_amount` was derived from active payment allocations;
- invoice `balance_amount` was derived from total minus active allocations;
- payment status was derived from active allocation totals;
- refund and write-off fields existed but the original recalculation helpers intentionally preserved/ignored them;
- there were no refund or write-off mutation RPCs.

This task reconciles those calculations rather than creating replacement tables.

### Audit/activity rules

The existing project supports finance events through:

- `audit_events` category `payment`;
- `activity_events` category `payment`;
- activity visibility `financial`;
- internal audit/activity functions that derive the actor from `auth.uid()`.

The implementation reuses this convention and adds explicit finance lifecycle event names.

### Role matrix before implementation

The existing finance write helper validates authenticated tenant membership and allowed roles. This task reuses it and applies narrower role arrays per refund/write-off transition.

### Exact schema gaps

The exact gaps were:

- no idempotency key support for refunds/adjustments;
- no controlled refund/write-off RPCs;
- no reserved amount calculations;
- no completed refund status calculation;
- no approved write-off invoice calculation;
- no allocation guard aware of reserved refunds/write-offs;
- no protection against voiding a payment or invoice after refund/write-off facts exist;
- missing repository eligibility/read models;
- missing typed client methods and tests.

No replacement finance table was required or created.

## 9. Architecture decisions

1. Refund and write-off remain separate financial concepts.
2. Refund returns money and is linked to a payment.
3. Write-off reduces debt and is linked to an invoice.
4. Refunds do not reverse allocations automatically.
5. Allocated funds must be released through `void_payment_allocation` first.
6. Write-offs never change `total_amount` or `paid_amount` and never create payments.
7. `completed_services` and appointments are outside the finance mutation boundary.
8. `patients.balance` is neither read nor written as finance truth.
9. All mutations occur through controlled SECURITY DEFINER RPCs.
10. Database row locks, partial unique indexes, and capacity triggers defend against retries and races independently of frontend discipline.
11. Historical read/recalculation support retains both direct invoice write-offs and schema-supported invoice-item-linked write-offs, while the new MVP request RPC creates a direct invoice-linked write-off.
12. Existing tables, statuses, audit infrastructure, RLS, and repository types were extended rather than replaced.

## 10. Refund domain model

A refund is a return of money previously received in a payment.

It is not:

- a payment void;
- an invoice void;
- a treatment cancellation;
- an appointment cancellation;
- a completed-service cancellation;
- an automatic reversal of payment allocation.

A completed refund records a financial fact. It cannot be mutated back to pending, approved, rejected, or voided. A future compensating payment would be a separate financial fact.

## 11. Refund state machine

Supported transitions:

- new request -> `pending`
- `pending` -> `approved`
- `approved` -> `completed`
- `pending` -> `rejected`
- `pending` -> `voided`
- `approved` -> `voided`

Idempotent terminal/retry behavior:

- approving an already approved refund returns the current row;
- approving a completed refund returns the current safe row;
- completing an already completed refund returns the current row without duplicating the effect;
- rejecting an already rejected refund returns the current row;
- voiding an already voided refund returns the current row.

Rejected/archived/completed refunds cannot be moved through invalid transitions. Completed refunds are immutable.

## 12. Refundable amount formula

```text
refundable amount =
payment amount
- active payment allocations
- completed refunds
- reserved pending/approved refunds
```

The request, approval, and completion paths lock the payment row and revalidate capacity.

The migration also adds an allocation-capacity trigger. A later allocation cannot consume money already completed or reserved for refund. This closes the inverse race that would remain if only refund RPCs performed locking.

## 13. Write-off domain model

A write-off is an approved financial adjustment with:

- `adjustment_type = write_off`;
- direct invoice linkage for new MVP requests;
- patient and currency derived from the invoice;
- `active` as requested/pending;
- `approved` as applied;
- `rejected`, `voided`, or `archived` as non-applying states.

It reduces invoice debt but does not change:

- invoice `total_amount`;
- invoice `paid_amount`;
- payment rows or allocation facts;
- completed services;
- treatment or appointment state.

## 14. Write-off state machine

Supported transitions:

- new request -> `active`
- `active` -> `approved`
- `active` -> `rejected`
- `active` -> `voided`
- `approved` -> `voided`

Approving an already approved write-off returns the current row. Voiding an already voided write-off returns the current row. Rejected/archived write-offs cannot be voided.

Voiding an approved write-off recalculates the invoice and reopens the corresponding debt. No financial fact is hard-deleted.

## 15. Invoice recalculation formula

```text
subtotal_amount =
sum(active/adjusted invoice item quantity * unit price)

discount_amount =
sum(active/adjusted invoice item discount_amount)

adjustment_amount =
sum(active/adjusted invoice item adjustment_amount)

total_amount =
sum(active/adjusted invoice item total_amount)

paid_amount =
sum(active payment allocations linked directly to invoice or to its invoice items)

written_off_amount =
sum(approved write_off adjustments linked directly to invoice or through a validated invoice item)

balance_amount =
max(0, total_amount - paid_amount - written_off_amount)
```

Status rules:

- `draft` remains `draft`;
- `voided` remains `voided`;
- `archived` remains `archived`;
- balance 0 with written-off amount > 0 -> `written_off`;
- balance 0 with written-off amount = 0 -> `paid`;
- balance > 0 with paid amount > 0 -> `partially_paid`;
- otherwise -> `issued`.

The helper rejects an invariant violation where active allocations plus approved write-offs exceed invoice total.

Refund amounts are not subtracted from invoice balance in this MVP.

## 16. Payment recalculation formula

```text
completed_refund_amount = sum(completed refunds)
active_allocated_amount = sum(active allocations)
```

Status priority:

- `voided` remains `voided`;
- `archived` remains `archived`;
- completed refunds >= payment amount -> `refunded`;
- completed refunds > 0 -> `partially_refunded`;
- active allocations >= payment amount -> `allocated`;
- active allocations > 0 -> `partially_allocated`;
- otherwise -> `received`.

The helper rejects an invariant violation where active allocations plus completed refunds exceed payment amount.

## 17. Idempotency design

Added nullable columns:

- `refunds.idempotency_key`
- `financial_adjustments.idempotency_key`

Added separate partial unique indexes:

- `uq_refunds_tenant_idempotency_key`
- `uq_financial_adjustments_tenant_idempotency_key`

Both indexes enforce uniqueness on `(tenant_id, idempotency_key)` only when the key is not null.

Behavior:

- the client trims supplied keys and rejects empty keys;
- the RPC locks the parent payment/invoice first;
- an existing matching key returns the existing row;
- reusing a key for materially different request facts is rejected;
- parallel identical requests with one key create exactly one row and both callers receive success;
- transition RPCs are idempotent where repeating the same completed transition is safe.

## 18. Concurrency/locking design

Refund paths lock:

- refund row where applicable;
- parent payment row.

Write-off paths lock:

- adjustment row where applicable;
- parent invoice row.

Capacity is recalculated after locks are acquired.

Additional database guards:

- `payment_allocations_capacity_guard` prevents active allocations from exceeding payment capacity after completed/reserved refunds and invoice capacity after approved/reserved write-offs;
- `payments_refund_void_guard` prevents legacy payment void from erasing the meaning of pending, approved, or completed refund facts;
- `invoices_writeoff_void_guard` prevents legacy invoice void while active/approved direct or invoice-item-linked write-offs exist.

Parallel validation results:

- two concurrent refund requests of 600 against payment 1000: one succeeded, one was rejected, reserved total 600;
- two concurrent write-off requests of 600 against invoice 1000: one succeeded, one was rejected, reserved total 600;
- two concurrent identical refund retries with one idempotency key: one row;
- two concurrent identical write-off retries with one idempotency key: one row.

## 19. Role matrix

| Operation | Owner | Admin | Cashier | Doctor | Registrar | No tenant |
|---|---:|---:|---:|---:|---:|---:|
| Request refund | yes | yes | yes | no | no | no |
| Approve refund | yes | yes | no | no | no | no |
| Complete refund | yes | yes | yes | no | no | no |
| Reject refund | yes | yes | no | no | no | no |
| Void pending/approved refund | yes | yes | no | no | no | no |
| Request write-off | yes | yes | no | no | no | no |
| Approve write-off | yes | yes | no | no | no | no |
| Reject write-off | yes | yes | no | no | no | no |
| Void active/approved write-off | yes | yes | no | no | no | no |

Cross-tenant identifiers are rejected after role validation and tenant-bound row lookup. Valid UUID format does not bypass tenant ownership.

## 20. RPC list and signatures

Refund RPCs:

```text
request_refund(
  p_tenant_id uuid,
  p_payment_id uuid,
  p_amount numeric,
  p_refund_method text,
  p_reason text,
  p_idempotency_key text default null,
  p_metadata jsonb default '{}'
) returns refunds

approve_refund(p_tenant_id uuid, p_refund_id uuid) returns refunds

complete_refund(
  p_tenant_id uuid,
  p_refund_id uuid,
  p_external_reference text default null,
  p_metadata jsonb default '{}'
) returns refunds

reject_refund(p_tenant_id uuid, p_refund_id uuid, p_reason text) returns refunds

void_refund(p_tenant_id uuid, p_refund_id uuid, p_reason text) returns refunds
```

Write-off RPCs:

```text
request_invoice_write_off(
  p_tenant_id uuid,
  p_invoice_id uuid,
  p_amount numeric,
  p_reason text,
  p_idempotency_key text default null,
  p_metadata jsonb default '{}'
) returns financial_adjustments

approve_invoice_write_off(p_tenant_id uuid, p_adjustment_id uuid)
  returns financial_adjustments

reject_invoice_write_off(
  p_tenant_id uuid,
  p_adjustment_id uuid,
  p_reason text
) returns financial_adjustments

void_invoice_write_off(
  p_tenant_id uuid,
  p_adjustment_id uuid,
  p_reason text
) returns financial_adjustments
```

No RPC accepts a frontend-supplied actor ID, patient ID, or currency where those values can be derived from the payment/invoice.

## 21. Repository read models

Added:

### `getPaymentRefundability({ tenantId, paymentId })`

Returns:

- payment;
- payment amount;
- active allocated amount;
- completed refund amount;
- reserved refund amount;
- refundable amount;
- active-allocation flag;
- refund count;
- currency.

### `getInvoiceWriteOffEligibility({ tenantId, invoiceId })`

Returns:

- invoice;
- invoice total amount;
- paid amount;
- approved write-off amount;
- reserved write-off amount;
- available write-off amount;
- eligibility flag;
- safe ineligibility reason;
- currency.

Both methods:

- require tenant and record IDs;
- use tenant-filtered existing repository reads;
- preserve RLS;
- perform no write;
- return null safely when the parent row does not exist;
- normalize errors with operation context and preserved causes.

Existing `Refund` and `FinancialAdjustment` mappings now preserve nullable `idempotencyKey`.

The patient finance summary counts only approved write-offs as applied debt reduction; active requests are reservations, not completed financial effects.

## 22. Typed client methods

Added to `FinanceRpcClient`:

Refund:

- `requestRefund`
- `approveRefund`
- `completeRefund`
- `rejectRefund`
- `voidRefund`

Write-off:

- `requestInvoiceWriteOff`
- `approveInvoiceWriteOff`
- `rejectInvoiceWriteOff`
- `voidInvoiceWriteOff`

The client:

- uses camelCase inputs;
- maps to exact SQL `p_*` names;
- validates required IDs;
- validates positive amounts;
- validates the allowed refund methods;
- requires non-empty reasons;
- accepts metadata only as a plain object;
- trims/rejects empty idempotency keys;
- maps returned rows to `Refund` and `FinancialAdjustment`;
- preserves simple safe domain errors;
- hides structured, multiline, or oversized raw database error dumps;
- contains no direct table write, localStorage, service-role, React, or UI dependency.

## 23. Audit/activity behavior

Events logged:

Refund:

- `refund_requested`
- `refund_approved`
- `refund_completed`
- `refund_rejected`
- `refund_voided`

Write-off:

- `write_off_requested`
- `write_off_approved`
- `write_off_rejected`
- `write_off_voided`

Event facts include:

- tenant;
- patient;
- payment or invoice reference;
- refund/adjustment ID;
- amount and currency;
- transition states;
- safe reason where applicable;
- actor derived from `auth.uid()`.

Idempotent completed retries do not create duplicate financial effects or duplicate completion audit events.

No credentials, service-role keys, payment-card data, or unbounded metadata are stored.

## 24. Security/grants/search_path

Verified on local Supabase:

- all 9 public mutation RPCs exist;
- all 9 are `SECURITY DEFINER`;
- all 9 set `search_path = public, pg_temp`;
- all 9 are executable by `authenticated`;
- all 9 are not executable by `anon`;
- all 9 are not executable through `PUBLIC`;
- internal calculation, sanitizer, capacity, and guard functions are not executable by frontend roles;
- direct authenticated/anon writes to refunds and financial adjustments remain unavailable;
- RLS remains enabled;
- no service-role credential is used by application code;
- all referenced finance rows are tenant validated;
- all actor fields derive from `auth.uid()`.

Catalog summary for the 9 public RPCs:

```text
secured/search_path: 9/9
anon blocked: true
authenticated granted: true
PUBLIC blocked: true
```

## 25. Local role validation

Guarded local QA users were created temporarily:

- `qa.admin.a@example.local`
- `qa.cashier.a@example.local`
- `qa.doctor.a@example.local`
- `qa.receptionist.a@example.local`
- `qa.notenant@example.local`
- `qa.admin.b@example.local`

Validated:

- cashier can request and complete refunds;
- cashier cannot approve refunds;
- doctor and registrar cannot request refunds;
- no-tenant user is blocked;
- Clinic B admin cannot access Clinic A payment/invoice/refund/write-off data;
- Clinic A admin can approve/reject/void refund and write-off transitions;
- cashier, doctor, and registrar cannot request write-offs.

QA users and all smoke facts were removed by the final local reset. No seed file was changed or committed.

## 26. Refund smoke results

Positive smoke:

1. Recorded unallocated payment 1000 KZT.
2. Cashier requested refund 400.
3. Admin approved.
4. Cashier completed.
5. Payment became `partially_refunded`.
6. Cashier requested remaining 600.
7. Admin approved.
8. Cashier completed.
9. Payment became `refunded`.
10. Completion retry returned the same refund without duplicating financial or audit effect.

Allocated-funds negative smoke:

1. Recorded payment 1000.
2. Allocated all 1000 to an invoice.
3. Refund request 100 was rejected.
4. Admin voided the allocation through `void_payment_allocation`.
5. Refund request became allowed.

Additional validation:

- pending refund reserves capacity;
- rejection releases capacity;
- void releases capacity;
- pending refund cannot be completed;
- completed refund cannot be voided;
- a payment with active/completed refunds cannot be voided through the legacy payment-void RPC;
- invalid method, amount, reason, metadata, role, tenant, and capacity are rejected;
- audit/activity events and auth-derived actors were verified.

Result: PASS.

## 27. Write-off smoke results

Positive smoke:

1. Created and issued invoice 1000 KZT.
2. Admin requested write-off 400.
3. Admin approved.
4. Invoice became:
   - total 1000;
   - paid 0;
   - written off 400;
   - balance 600;
   - status `issued`.
5. Admin requested and approved remaining 600.
6. Invoice became:
   - total 1000;
   - paid 0;
   - written off 1000;
   - balance 0;
   - status `written_off`.
7. No payment was created.
8. Voiding the approved 600 write-off reduced written-off amount to 400, reopened balance to 600, and restored `issued` status.

Negative and reservation validation:

- cashier and doctor request blocked;
- cross-tenant invoice blocked;
- draft and paid invoices blocked;
- invalid amount, reason, and metadata blocked;
- amount above available balance blocked;
- active request reserves balance;
- rejected request does not alter invoice financials;
- invoice with active/approved write-off cannot be voided through the legacy invoice-void RPC;
- audit/activity events and auth-derived actors verified.

Result: PASS.

## 28. Cross-tenant results

- Clinic B admin attempting refund against Clinic A payment: rejected as payment not found in this tenant.
- Clinic B admin attempting write-off against Clinic A invoice: rejected as invoice not found in this tenant.
- UUID validity did not bypass tenant checks.
- No Clinic A finance facts were returned through the mutation RPCs to Clinic B.

Result: PASS.

## 29. Side-effect checks

Verified before transaction rollback and cleanup:

- `completed_services` unchanged;
- appointments unchanged;
- `patients.balance` unchanged;
- write-off did not create a payment;
- write-off did not increase `paid_amount`;
- refund did not reopen invoice debt;
- no document or patient-file writes;
- no stock/material writes;
- no timeline integration;
- no treatment, visit, encounter, or clinical mutation;
- no direct frontend table mutation path was added.

Result: PASS.

## 30. Cleanup

Lifecycle SQL smoke used an explicit transaction and ended with `ROLLBACK`.

Concurrency smoke created local-only rows and was followed by:

```text
npx supabase db reset --no-seed
```

Final local database verification after cleanup:

- smoke patient marker: 0;
- invoices: 0;
- payments: 0;
- refunds: 0;
- financial adjustments: 0;
- completed services: 0;
- appointments: 0.

Two baseline patients produced by the normal local migration/fixture baseline remained after reset; no task smoke finance rows remained.

No cloud data was created, changed, or cleaned because cloud was never touched.

## Checks

- Lint: passed.
- Targeted FinanceRepository tests: 23/23 passed.
- Targeted FinanceRpcClient tests: 45/45 passed.
- Full tests: 67 files / 676 tests passed.
- Build: passed.
- Local Supabase reset: passed.
- SQL lifecycle smoke: passed.
- Concurrency/idempotency smoke: passed.
- Implementation CI: success on `c48a7afbc878df6ef4db24f743cb66781a7b9657`.

## Browser smoke

- Environment: not run by design.
- Roles: validated through authenticated local SQL contexts instead of a browser.
- Database evidence: captured through transactional SQL, catalog assertions, and two-session concurrency tests.
- Cleanup remaining rows: verified through final local reset.
- Reason: UI and browser smoke are explicitly forbidden by this backend-only task.

## 31. Tests

Targeted repository tests:

```text
FinanceRepository.test.ts: 23/23 passed
```

Targeted RPC client tests:

```text
FinanceRpcClient.test.ts: 45/45 passed
```

Full unit/integration suite:

```text
67 test files passed
676 tests passed
```

SQL lifecycle/role/side-effect validation:

```text
REFUNDS-WRITEOFFS SQL TESTS PASSED
```

Concurrency validation:

```text
REFUND_RACE success=1 rejected=1 reserved=600.00
REFUND_IDEMPOTENCY rows=1
WRITEOFF_RACE success=1 rejected=1 reserved=600.00
WRITEOFF_IDEMPOTENCY rows=1
CONCURRENCY VALIDATION PASSED
```

Schema assertions:

```text
28/28 passed
```

## 32. Lint/build

Local checks:

- `npm run lint`: passed.
- `npm run test -- --run src/data/repositories/FinanceRepository.test.ts`: passed, 23 tests.
- `npm run test -- --run src/data/repositories/FinanceRpcClient.test.ts`: passed, 45 tests.
- full test command through the repository script: passed, 67 files / 676 tests.
- `npm run build`: passed.
- `npx supabase db reset --no-seed`: passed after the final migration version and again for cleanup.

Existing non-blocking project warnings:

- unrelated React `act(...)` warnings in visit tests;
- existing Vite bundle chunk-size warning.

## 33. GitHub Actions CI

Implementation-head CI:

- Workflow: `CI`
- Run ID: `29079751549`
- Run number: `652`
- Status: `completed`
- Conclusion: `success`
- Tested commit: `c48a7afbc878df6ef4db24f743cb66781a7b9657`
- ESLint: success
- Tests: success
- Build: success

## Finalization

Final PR head before report-only update:

`108a4d04626dc2e0c184d509d5b1f73b76b72515`

GitHub Actions CI #653 / run `29080027605`:

- conclusion: `success`;
- tested commit: `108a4d04626dc2e0c184d509d5b1f73b76b72515`;
- tested commit matched the PR head before this report-only update.

Report update commit:

N/A because the final report update commit cannot reference itself before creation.

Hermes finalizer note:

Hermes finalizer failed with `replaceReportPlaceholders is not defined`.
The failure did not modify repository files or implementation results.

Final verdict:

REFUNDS WRITEOFFS FOUNDATION IMPLEMENTED AND VERIFIED

Recommended next task:

`CASHIER-PAYMENT-FLOW-HARDENING-001`

After that:

`REFUNDS-WRITEOFFS-UI-001`

A fresh CI run on the report-only commit is verified after push. Its final run ID, run number, conclusion, and tested commit are reported separately because this report cannot contain its own future commit SHA or CI result.

## 34. Issues/warnings

- Existing audit/activity category constraints do not define a separate `finance` category. The established project convention remains category `payment`, financial visibility, and finance-specific event names/metadata.
- Existing unrelated React `act(...)` warnings remain in visit tests.
- Existing Vite chunk-size warning remains non-blocking.
- Browser smoke was intentionally not run because this task explicitly forbids UI/browser work.
- Cloud Supabase was intentionally not touched.
- No historical invariant violations were present in the clean local database after reset. The migration does not silently mutate hypothetical unrelated historical rows.

No blocker remains for the backend foundation.

## 35. Known cashier debt from PR #332

The following known concerns from PR #332 were deliberately not fixed in this PR:

- stale finance/result state when switching patients;
- partial `recordPayment` / `allocatePayment` failure handling;
- raw read-error normalization in the cashier flow;
- stale cashier report metadata.

They remain one separate architectural task:

`CASHIER-PAYMENT-FLOW-HARDENING-001`

## 36. What was intentionally not implemented

- no refund/write-off UI;
- no React hooks or patient finance tab changes;
- no cashier UI changes;
- no browser smoke;
- no cloud migration apply;
- no payment-provider API;
- no Kaspi/Halyk integration;
- no fiscal receipt;
- no documents/acts;
- no stock/material integration;
- no timeline integration;
- no appointment or clinical mutation;
- no completed-service mutation;
- no `patients.balance` truth or write;
- no direct frontend table writes;
- no service-role application code;
- no committed seed changes;
- no committed generated types;
- no HEP-V2 work;
- no unrelated refactor;
- no merge.

## Final verdict

**PASS**

## 37. Task acceptance verdict

REFUNDS WRITEOFFS FOUNDATION IMPLEMENTED AND VERIFIED

## 38. Recommended next task

Immediate next task:

`CASHIER-PAYMENT-FLOW-HARDENING-001`

After cashier hardening, recommended finance continuation:

`REFUNDS-WRITEOFFS-UI-001`
