# CASHIER-CREDIT-PREPAYMENT-HARDENING-001 Report

## Task ID

`CASHIER-CREDIT-PREPAYMENT-HARDENING-001`

## Summary

The existing unallocated payment intake path is now hardened for intentional patient-credit intake without creating a separate prepayment ledger.

The authoritative money model remains unchanged:

```text
payment = money actually received
payment allocation = where received money was applied
unallocated payment capacity = available patient credit
fund reservation = a purpose reservation over already received money
```

The implementation adds one tenant-scoped idempotency namespace to `payments`, an explicit transactional intake RPC, a recovery/read RPC, client DTO/error mapping, caller-side same-key reconciliation, SQL coverage, and real concurrent-request validation.

No invoice, allocation, reservation, appointment, treatment plan, completed service, clinical fact, or `patients.balance` mutation is created by the hardened intake operation.

## Branch

`feature/cashier-credit-prepayment-hardening-001`

## Base branch and verified baseline

- base branch: `main`;
- verified baseline: `7deb29cc3283afadd6543c5ed29f8a2152a4100a`;
- PR #342 was confirmed merged into `origin/main` at that exact commit before implementation;
- worktree was clean before changes.

## PR URL

https://github.com/NckNA/codex-test/pull/343

## Implementation head reviewed

`f337b21b2f5836e55eea7f5395afab741d8bc7e4`

## Report update commit

N/A because the final report update commit cannot reference itself before creation.

- Report update commit: N/A (the report commit cannot reference itself; use the finalization receipt).
- The final report-only commit and its fresh CI run are recorded in the finalization receipt, PR body, and final task response after push.

## Current payment-intake recon

### 1. What called `record_payment` before this task?

The real application path was:

```text
PatientFinancePanel
→ PaymentActions
→ useFinanceActions.recordPayment
→ FinanceRpcClient.recordPayment
→ public.record_payment
```

`record_and_allocate_payment` also calls `record_payment` internally as part of the already-hardened allocated cashier transaction.

The legacy refund/write-off SQL regression test used `record_payment` only to create payment fixtures.

### 2. Was it reachable from a real UI?

Yes. The patient Finance tab exposed the existing `Принять оплату` form and called the generic `recordPayment` hook action. No new UI was needed or added by this task.

### 3. Did it create unallocated payments?

Yes. `record_payment` inserted a `payments` row with status `received`. It did not create an allocation, so the full available capacity became patient credit.

### 4. Did it accept an invoice ID?

No. The legacy generic RPC had no invoice or invoice-item parameter.

### 5. Did it allocate automatically?

No. Allocation was a separate operation. The existing `record_and_allocate_payment` cashier RPC explicitly creates allocations, but generic `record_payment` did not.

### 6. Did it use an operation key?

No. The payment table had `cashier_operation_key`, but only the allocated cashier flow used it. Generic unallocated intake had no idempotency key.

### 7. Did it use a payload fingerprint?

No. `cashier_operation_fingerprint` protected only `record_and_allocate_payment`.

### 8. Could a retry create a duplicate payment?

Yes. A lost successful response followed by the same `record_payment` retry created another payment fact and therefore duplicate money.

### 9. Did it return enough data for recovery?

No. It returned a payment row only. There was no operation identity, no recovery/read RPC, and no way to distinguish not committed from committed-but-response-lost without searching by unrelated fields.

### 10. Which roles could execute it?

The RPC allowed `clinic_owner`, `clinic_admin`, and `cashier` through `ensure_finance_write_role_internal`. Before this task, `authenticated` also retained direct EXECUTE privilege on the unsafe legacy signature.

### 11. Did it create audit and activity events?

Yes. A successful insert called `log_finance_event_internal` and created `payment_recorded` audit/activity events. Because the write itself was not idempotent, retries could also duplicate both money and events.

### 12. Did it normalize KZT?

It uppercased the currency value but did not limit generic intake to KZT. The hardened patient-credit path explicitly accepts operational currency `KZT` only.

### 13. Did it mutate `patients.balance`?

No. Patient credit was and remains derived from payment facts, active allocations, completed/pending refunds, and active fund reservations. `patients.balance` is not touched.

### 14. Was it compatible with fund reservations?

Yes at the data-model level. An unallocated payment became available capacity that `create_patient_fund_reservation` could reserve. The hardened operation preserves this model and returns current capacity directly.

## Selected design

### Option selected: B

A new explicit application RPC was added:

```text
record_patient_credit_payment
```

A recovery RPC was added:

```text
get_patient_credit_payment_operation
```

The legacy `record_payment` function is retained only because `record_and_allocate_payment` already calls it internally inside the existing SECURITY DEFINER cashier transaction.

Direct EXECUTE on the legacy function is revoked from `authenticated`. Therefore:

- the application has exactly one authoritative path for new unallocated money;
- the existing allocated cashier flow remains unchanged;
- no unsafe application caller remains;
- no duplicate client method with overlapping semantics was introduced.

## Schema changes

Migration:

`supabase/migrations/0023_harden_patient_credit_intake.sql`

Added nullable payment identity fields:

- `credit_intake_operation_key`;
- `credit_intake_operation_fingerprint`.

Added constraints:

- unique partial index on `(tenant_id, credit_intake_operation_key)`;
- operation key and fingerprint must be present together;
- one payment cannot belong to both cashier and patient-credit operation namespaces.

No new payment, prepayment, deposit, ledger, invoice, allocation, shift, provider, or receipt table was created.

## Idempotency and fingerprint model

Required operation identity:

```text
tenant_id + credit_intake_operation_key
```

Canonical server fingerprint includes:

- tenant ID;
- patient ID;
- rounded amount;
- normalized payment method;
- normalized KZT currency;
- requested received timestamp;
- trimmed external reference;
- trimmed payer name;
- trimmed notes;
- sanitized metadata.

The server stores an MD5 digest of the canonical JSON representation. The digest is an equality fingerprint, not a secret or authentication primitive.

Behavior:

- same tenant/key + same fingerprint returns the existing payment with `already_completed`;
- same tenant/key + different patient is rejected with `PATIENT_CREDIT_PATIENT_MISMATCH`;
- same tenant/key + different payload is rejected with `PATIENT_CREDIT_IDEMPOTENCY_CONFLICT`;
- different keys may intentionally create separate payment facts.

## Lock order and race safety

The write RPC performs the following order:

1. enforce tenant membership and finance role;
2. normalize and validate input;
3. verify patient belongs to tenant;
4. compute canonical fingerprint;
5. acquire `pg_advisory_xact_lock` for `patient-credit-intake:<tenant>:<operation-key>`;
6. re-read the operation key under the lock;
7. return the existing result or reject a conflict;
8. insert exactly one payment;
9. emit one success audit/activity pair;
10. return payment plus current capacity.

The unique partial index is the persistent backstop. The advisory lock gives deterministic same-key behavior and prevents a unique-violation race from becoming the application contract.

## Transactional RPC result

`record_patient_credit_payment` returns:

- operation status;
- operation ID/key;
- tenant ID;
- patient ID;
- authoritative payment row;
- current payment capacity:
  - payment amount;
  - allocated amount;
  - completed refunds;
  - pending refund reservation;
  - deposit reservation;
  - gross unallocated amount;
  - available credit.

A successful operation creates:

- one `payments` row;
- one `payment_recorded` audit event;
- one `payment_recorded` activity event.

It creates no allocation, invoice, reservation, clinical entity, schedule entity, or balance mutation.

## Recovery/read RPC

`get_patient_credit_payment_operation` accepts:

- tenant ID;
- patient ID;
- the original operation key.

It returns:

- `completed` with the authoritative payment and current capacity; or
- `not_found` without inventing a payment.

If the key belongs to another patient in the same tenant, the request is rejected instead of leaking or reusing the operation.

## Client and repository integration

### `FinanceRpcClient`

- `RecordPaymentInput` now requires `idempotencyKey`;
- `recordPayment` calls only `record_patient_credit_payment`;
- `getPatientCreditPaymentOperation` calls the recovery RPC;
- composite payment/capacity results are mapped to typed DTOs;
- safe categories distinguish permission, payload conflict, patient mismatch, validation, and uncertain transport outcomes;
- raw SQL/database details are not surfaced.

### `FinanceRepository`

Payment mapping now includes:

- `creditIntakeOperationKey`;
- `creditIntakeOperationFingerprint`.

No repository write method or direct table mutation was added.

### Real application caller

`useFinanceActions.recordPayment` now:

1. creates one operation key for a normalized request;
2. sends the hardened write;
3. on an uncertain response, queries recovery using the same key;
4. if recovery returns `not_found`, retries the write once with the same key;
5. retains the key if the result is still uncertain;
6. blocks a changed payload from silently replacing an unresolved operation;
7. scopes unresolved keys by tenant and patient so one patient cannot inherit another patient's key;
8. refreshes finance data only after a confirmed result.

No localStorage persistence or fallback was added.

## Authorization and security

- allowed write/recovery roles: `clinic_owner`, `clinic_admin`, `cashier`;
- doctor, registrar, unknown role, and no-tenant users are blocked by the backend guard;
- cross-tenant patient IDs are rejected;
- direct table INSERT remains unavailable to `authenticated`;
- direct application EXECUTE on legacy `record_payment` is revoked;
- the internal result helper is not executable by `authenticated`;
- no `service_role` key or application use was added;
- no cloud database action was performed;
- no secret, `.env.local`, generated type, package, or seed change is committed.

## Compatibility validation

### Patient credit summary

The new SQL test verifies that 100,000 KZT received with no allocation appears as:

- `cashReceived = 100000`;
- `availableCreditAmount = 100000`;
- `reservedDepositAmount = 0`.

### Fund reservations

The test creates a 30,000 KZT reservation over the new payment, observes available credit fall to 70,000 KZT, verifies payment void is blocked while reserved, releases it, and observes credit return to 100,000 KZT.

### Refund capacity

The test requests a 10,000 KZT refund over the new payment, observes available credit fall to 90,000 KZT, rejects the refund, and observes credit return to 100,000 KZT.

### Payment void behavior

Existing controlled void rules remain authoritative. The new RPC does not add or bypass a void route.

### Existing allocated cashier flow

`record_and_allocate_payment` was not modified. SQL and concurrency regression checks confirm:

- it still creates one cashier-keyed payment;
- it still allocates the requested invoice amount;
- its payment does not use the patient-credit operation namespace;
- same-key concurrency still converges safely.

### Existing refund/write-off fixture

`0018_refund_writeoff_rpc_test.sql` now creates its payment fixtures through the new authoritative application RPC because direct authenticated use of legacy `record_payment` is intentionally revoked. Refund and write-off behavior itself was not changed.

## Concurrency results

New test:

`supabase/tests/0023_patient_credit_intake_concurrency.ps1`

Observed results:

```text
IDENTICAL_RETRY success=2 payments=1 uniquePaymentIds=1 audit=1 activity=1 credit=100000.00
CONFLICTING_RETRY success=1 rejected=1 payments=1 audit=1
DIFFERENT_KEYS success=2 payments=2 amount=33333.00
PATIENT CREDIT INTAKE CONCURRENCY VALIDATION PASSED
```

This proves:

- two simultaneous identical requests create exactly one payment;
- both successful callers receive the same payment identity;
- audit/activity success events are not duplicated;
- conflicting same-key payloads result in one success and one controlled rejection;
- distinct operation keys intentionally create distinct payment facts;
- no invoice, allocation, reservation, or `patients.balance` mutation is produced by the intake operation.

Existing concurrency regressions also passed:

- `0019_cashier_payment_concurrency.ps1`;
- `0022_patient_credit_deposits_concurrency.ps1`.

## Changed files

- `supabase/migrations/0023_harden_patient_credit_intake.sql`;
- `supabase/tests/0023_patient_credit_intake_hardening_test.sql`;
- `supabase/tests/0023_patient_credit_intake_concurrency.ps1`;
- `supabase/tests/0018_refund_writeoff_rpc_test.sql`;
- `src/data/repositories/FinanceRpcClient.ts`;
- `src/data/repositories/FinanceRpcClient.test.ts`;
- `src/data/repositories/FinanceRepository.ts`;
- `src/data/repositories/FinanceRepository.test.ts`;
- `src/data/hooks/useFinanceActions.ts`;
- `src/data/hooks/useFinanceActions.test.tsx`;
- `_ai_work/REPORTS/CASHIER-CREDIT-PREPAYMENT-HARDENING-001_hardening.md`.

## Checks

Completed locally:

- clean reset applying migrations `0001` through `0023`: passed;
- local QA user fixture creation: passed;
- `0023_patient_credit_intake_hardening_test.sql`: passed;
- `0023_patient_credit_intake_concurrency.ps1`: passed;
- `0018_refund_writeoff_rpc_test.sql`: passed;
- `0019_cashier_payment_hardening_test.sql`: passed;
- `0018_refund_writeoff_concurrency.ps1`: passed;
- `0019_cashier_payment_concurrency.ps1`: passed;
- `0022_patient_credit_deposits_foundation_test.sql`: passed when executed as the UTF-8 file inside the database container;
- `0022_patient_credit_deposits_concurrency.ps1`: passed;
- `npx supabase db lint --level warning`: passed with no warning attributed to migration `0023`; remaining warnings are pre-existing in earlier migrations;
- targeted TypeScript finance tests: passed;
- final full `npm run lint`: passed;
- final full `npm run test -- --run`: passed with 79 files / 817 tests;
- final full `npm run build`: passed.

## Issues / limitations

1. `supabase/tests/0020_patient_finance_summary_test.sql` is a stale baseline fixture under the latest schema: it directly inserts into `refunds`, while migration 0022 correctly requires `request_refund`. It fails independently of migration 0023. Current patient-summary compatibility is covered by the new 0023 transactional SQL test using the supported RPC paths.
2. Existing React test-suite `act(...)` warnings remain in unrelated baseline tests; all tests pass.
3. Vite continues to report the pre-existing main-bundle size warning.
4. The client retains unresolved operation keys only in the mounted hook instance. Durable recovery across a full browser restart requires the caller to preserve the operation key in a future UI workflow. This task intentionally adds no prepayment UI or browser persistence.
5. The legacy `record_payment` function remains in the schema only for the nested existing cashier transaction. Authenticated application callers cannot execute it directly.
6. No cloud migration was applied and no production data was touched.

## Browser smoke

`BROWSER SMOKE NOT REQUIRED: backend/client hardening only`

The existing patient Finance UI caller is covered by hook/client tests. This task adds no new button, form, route, or visible prepayment workflow.

## Safety notes

- payment remains the only received-money fact;
- no separate prepayment ledger exists;
- no second cash ledger exists;
- no invoice or allocation is created by patient-credit intake;
- no deposit reservation is created automatically;
- no treatment, appointment, plan, service, or tooth state is changed;
- `patients.balance` remains untouched;
- KZT is enforced for the hardened path;
- retries cannot create duplicate money under one operation key;
- patient and tenant identity are checked on both write and recovery;
- existing cashier payment behavior is preserved.

## What was not implemented

- prepayment UI;
- cashier UI changes;
- new button or route;
- automatic deposit creation;
- invoice/allocation creation from this path;
- cash shifts;
- receipt/fiscal integration;
- payment provider integration;
- refund/write-off redesign;
- invoice corrections;
- payment splitting or mixed-tender redesign;
- cloud migration apply;
- broad finance refactor.

## Fresh CI

Implementation CI completed successfully:

- workflow: `CI`;
- run: `#686` (`29154002773`);
- tested commit: `f337b21b2f5836e55eea7f5395afab741d8bc7e4`;
- conclusion: `success`;
- ESLint: passed;
- tests: passed;
- build: passed.

The final response verifies the report-only update commit against a fresh CI run and confirms that PR #343 remains open and unmerged.

## Recommended next task

`CASHIER-CREDIT-PREPAYMENT-UI-001`

Add an explicit patient-credit/prepayment UI that preserves the operation key across a full browser restart and uses the hardened intake and recovery RPCs without introducing a second money ledger.

## Final verdict

**PASS**

The existing unallocated payment model is now safe for intentional patient-credit intake at the schema, transactional RPC, recovery, client, and concurrency levels. Future cashier prepayment UI can call this path without creating a second ledger or risking duplicate money after retries.
