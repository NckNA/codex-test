# PAYMENTS-DEBTS-REPOSITORY-001B — Finance read repository

## Summary
Implemented a read-only finance repository layer for the finance schema introduced by PAYMENTS-DEBTS-SCHEMA-001A.

This task adds typed read models, Supabase read methods, snake_case-to-camelCase mappers, patient finance facts aggregation, and a preliminary TypeScript patient finance summary helper.

No write paths, RPCs, UI, hooks, migrations, cloud actions, seed data, generated types, stock, documents, timeline, or reports UI were implemented.

## Branch name
`feature/payments-debts-repository-001b`

## PR URL
https://github.com/NckNA/codex-test/pull/324

## PR head reviewed before final report update
d380980a0d3087d453499f46b94ed57825dd4000

## Report update commit
N/A because the final report update commit cannot reference itself before creation.

## Changed files summary
Expected changed files:

- `src/data/repositories/FinanceRepository.ts`
- `src/data/repositories/FinanceRepository.test.ts`
- `_ai_work/REPORTS/PAYMENTS-DEBTS-REPOSITORY-001B_repository.md`

No migration, UI, hook, repository outside finance, seed, cloud, generated type, stock, document, timeline, or report UI files were intentionally changed.

## Pre-read summary
Reviewed existing repository conventions from the encounter/visit read repository:

- repository is class-based;
- Supabase client is injected through constructor/factory;
- tenantId is required before querying;
- DB rows are mapped into camelCase domain models;
- list methods use Supabase `.select()`, `.eq()`, optional filters, ordering, and pagination;
- get methods use `.maybeSingle()` and return `null` when missing;
- repository tests mock the Supabase query chain.

Finance schema dependency:

- The implementation targets `0016_create_finance_model.sql` from PAYMENTS-DEBTS-SCHEMA-001A.
- `origin/main` now contains `0016_create_finance_model.sql` after PR #323 was merged.
- This branch was rebased onto current `origin/main` and validated against the local finance tables created by `0016`.

## Repository design
Added `src/data/repositories/FinanceRepository.ts`.

Structure:

- `FinanceRepository` interface;
- `SupabaseFinanceRepository` class;
- `createFinanceRepository` factory;
- finance domain type aliases;
- row mappers;
- `computePatientFinanceSummary` helper.

Supabase usage:

- uses injected `SupabaseClient`;
- defaults to the existing app `supabase` client through the factory;
- supports only the Supabase backend;
- rejects local backend for finance reads.

Tenant boundary:

- every public repository method requires `tenantId`;
- every query filters `tenant_id` before returning rows;
- patient-scoped facts/summary require both `tenantId` and `patientId`.

## Methods added
Read-only methods:

1. `listInvoices`
2. `getInvoiceById`
3. `listInvoiceItems`
4. `listPayments`
5. `getPaymentById`
6. `listPaymentAllocations`
7. `listRefunds`
8. `listFinancialAdjustments`
9. `getPatientFinanceFacts`
10. `getPatientFinanceSummary`

## Domain models and mapping
Added domain models for:

- `Invoice`
- `InvoiceItem`
- `Payment`
- `PaymentAllocation`
- `Refund`
- `FinancialAdjustment`
- `PatientFinanceFacts`
- `PatientFinanceSummary`

Mapping behavior:

- converts DB snake_case fields to camelCase;
- preserves nullable fields;
- preserves metadata as a plain object;
- coerces numeric DB values into numbers;
- throws on missing required fields.

## Query behavior
Filters:

- all methods require and filter by `tenant_id`;
- patient-scoped list methods filter by `patient_id` when provided;
- invoice item reads can filter by `invoice_id` and `completed_service_id`;
- payment reads can filter by `payment_method` and status;
- allocations can filter by payment, invoice, invoice item, and patient;
- refunds can filter by payment and status;
- adjustments can filter by invoice, invoice item, payment, type, and status.

Archived/voided handling:

- invoice, invoice item, payment, refund, and adjustment list methods exclude `archived` by default;
- payment allocations exclude `voided` and `archived` by default;
- patient finance summary ignores voided/archived/rejected facts.

Ordering:

- invoices: `created_at desc`;
- invoice items: `created_at desc`;
- payments: `received_at desc`;
- allocations: `allocated_at desc`;
- refunds: `requested_at desc`;
- adjustments: `created_at desc`.

Pagination:

- list methods support `limit` and `offset`;
- limit is clamped to 1..200;
- default limit is 50.

## Patient finance summary
Added a preliminary TypeScript read helper.

Included:

- active invoice total;
- payment amount;
- allocated payment amount;
- completed refund amount;
- discount amount;
- write-off amount;
- net adjustment amount;
- balance amount;
- credit amount;
- open/unpaid/partially-paid invoice counts;
- last payment timestamp.

Excluded:

- voided/archived invoices;
- voided/archived payments;
- voided/archived allocations;
- non-completed refunds;
- rejected/voided/archived adjustments;
- `patients.balance`.

Formula limitation:

- The helper is intentionally conservative and preliminary.
- It is not a final accounting ledger, not a write authority, and not a replacement for future RPC-controlled balance logic.
- It does not mutate invoices, payments, completed services, or patient rows.

## Safety boundaries
The repository intentionally performs no financial writes.

Blocked by design:

- no `insert`;
- no `update`;
- no `delete`;
- no `upsert`;
- no `rpc`;
- no raw SQL;
- no localStorage fallback;
- no frontend service-role usage;
- no `patients.balance` source-of-truth use;
- no `completed_services` mutation;
- no UI or React imports.

The repository is a read layer only. Future writes remain reserved for `PAYMENTS-DEBTS-RPC-001C`.

## Tests
Added `src/data/repositories/FinanceRepository.test.ts`.

Covered scenarios:

- tenantId required before querying;
- patientId required for patient facts/summary;
- IDs required for get methods;
- invoice mapping;
- invoice item mapping including `completed_service_id`;
- payment mapping including `payment_method` and `received_at`;
- allocation mapping;
- refund mapping;
- adjustment mapping;
- invoice filters and pagination;
- invoice item filters;
- payment filters;
- allocation filters;
- refund filters;
- adjustment filters;
- patient facts aggregation;
- zero summary when no facts exist;
- summary ignores voided/archived facts;
- overpayment/credit handling;
- Supabase error propagation;
- empty list behavior;
- pagination normalization;
- factory behavior;
- no mocked write calls.

## Local validation
`npx supabase db reset --no-seed` was rerun through the local Supabase reset tool after rebasing onto current origin/main.

Validation result:

- local reset passed with `0016_create_finance_model.sql` applied;
- finance tables exist locally: `invoices`, `invoice_items`, `payments`, `payment_allocations`, `refunds`, `financial_adjustments`;
- row counts are `0` for all six finance tables;
- no seed data was inserted;
- no invoice/payment/refund/adjustment rows were created;
- repository empty-list and zero-summary behavior is covered by unit tests;
- repository reads remain read-only and tenant-bound.

## What was intentionally NOT changed
- no migrations;
- no SQL schema edits;
- no UI;
- no hooks;
- no RPC;
- no frontend RPC client;
- no Supabase cloud;
- no seed;
- no generated types;
- no payment integrations;
- no stock;
- no documents;
- no timeline;
- no reports UI.

## Checks
Local checks:

- `npm ci` — passed, with existing dependency audit warnings.
- `npm run lint` — passed.
- `npm run test -- --run src/data/repositories/FinanceRepository.test.ts` — passed, 19 tests.
- `npm run test -- --run` — passed, 59 files / 552 tests.
- `npm run build` — passed.
- `npx supabase db reset --no-seed` — passed through local Supabase reset after rebase; `0016_create_finance_model.sql` applied and finance tables validated empty.

GitHub Actions CI:

- Pending fresh CI after final report update.

## Issues / warnings
Known limitations:

1. Patient finance summary is preliminary and should not be treated as final accounting truth.
2. Existing project test warnings remain: React `act(...)` warnings in unrelated UI tests and intentional error-handling stderr logs.
3. 
pm ci` reports existing dependency audit warnings; no dependency changes were made.

## Final verdict
PAYMENTS DEBTS REPOSITORY IMPLEMENTED AND VERIFIED

## Recommended next task
PAYMENTS-DEBTS-RPC-001C


