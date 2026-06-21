# PAYMENTS-DEBTS-SCHEMA-001A — Finance schema foundation

## Summary
Implemented the schema-only finance foundation for DentalFlow CRM. The migration adds durable financial source-of-truth tables for invoices, invoice items, payments, payment allocations, refunds, and financial adjustments.

This task deliberately separates clinical facts from financial facts:

- `completed_services` remains the performed clinical/billable service fact.
- `invoice_items` may reference completed services but do not mutate them.
- `payments` are money received, not treatment completion.
- `refunds` are money returned and must link to original payments.
- `financial_adjustments` model discounts, corrections, write-offs, surcharges, and void adjustments; they are not payments.
- debt/balance should be derived from financial facts or later maintained only through controlled RPCs, not manually typed into `patients.balance`.

## Branch name
`feature/payments-debts-schema-001a`

## PR URL
https://github.com/NckNA/codex-test/pull/323

## PR head reviewed before final report update
fbfc99df4a89b29c488fce49318e783c8ec5d4b2

## Report update commit
N/A because the final report update commit cannot reference itself before creation.

## Changed files summary
Expected changed files:

- `supabase/migrations/0016_create_finance_model.sql`
- `_ai_work/REPORTS/PAYMENTS-DEBTS-SCHEMA-001A_schema.md`

No UI, app code, repositories, hooks, seed, generated types, cloud files, documents, stock, timeline, or reports implementation were changed.

## Pre-read / recon summary
The previous finance recon established that the project did not yet have a proper finance ledger model. Existing finance-adjacent fields were only placeholders or legacy snapshots:

- `patients.balance`
- `patients.bonus_balance`
- `appointments.payment_type`
- `appointments.price`
- `audit_events.payment_id`
- finance placeholder UI/documentation references

These fields are not sufficient as source of truth for invoices, payment allocation, refunds, adjustments, or debt.

Schema conventions reused:

- tenant FK target: `public.tenants(id)`
- patient FK target: `public.patients(tenant_id, id)`
- completed service target: `public.completed_services(id)` as an optional simple FK, with same-tenant validation reserved for future RPCs because `completed_services` currently does not expose a composite unique `(tenant_id, id)` key.
- user references: `auth.users(id)` following encounter/visit schema conventions.
- updated_at convention: existing `public.set_updated_at()` trigger function from `0014_create_encounter_visit_model.sql`.
- RLS convention: `public.has_tenant_role(tenant_id, ARRAY[...]::public.app_role[])`.
- grants convention: revoke all from PUBLIC/anon/authenticated, then grant SELECT to authenticated under RLS and ALL to service_role.

## Migration summary
Created:

- `supabase/migrations/0016_create_finance_model.sql`

Tables created:

- `public.invoices`
- `public.invoice_items`
- `public.payments`
- `public.payment_allocations`
- `public.refunds`
- `public.financial_adjustments`

Optional view:

- `public.patient_financial_summary` was skipped intentionally in this migration.

Reason for skipping the view:

- the first schema foundation should avoid a misleading patient balance projection before the RPC/write-path rules are implemented;
- registrar/doctor visibility requires a more precise future summary view/RPC design;
- table-level RLS over all underlying finance facts may not produce an intentionally limited balance summary for every role.

Comments were added to document domain boundaries and financial source-of-truth rules.

## Table design

### invoices
Financial charge grouping/request for a patient.

Important columns include:

- `tenant_id`
- `patient_id`
- `invoice_number`
- `status`
- `currency`
- `issue_date`
- `due_date`
- amount snapshot columns: subtotal, discount, adjustment, total, paid, refunded, written off, balance
- `created_by`, `issued_by`, `voided_by`
- lifecycle timestamps
- `metadata`

### invoice_items
Financial line items.

Important columns include:

- `invoice_id`
- `patient_id`
- optional `completed_service_id`
- service snapshots: name, code, tooth, surface, quantity, unit price, discount, adjustment, total
- lifecycle and void fields

`invoice_items.completed_service_id` links to the clinical/billable fact but does not mutate `completed_services`.

### payments
Money received from patient/payer.

Important columns include:

- `payment_method`
- `amount`
- `received_at`
- `external_reference`
- `received_by`
- void lifecycle fields

### payment_allocations
How received money is applied to an invoice or invoice item.

Important columns include:

- `payment_id`
- optional `invoice_id`
- optional `invoice_item_id`
- `amount`
- `allocated_at`

The table requires at least one allocation target.

### refunds
Money returned to the payer.

Important columns include:

- `payment_id`
- `refund_method`
- `amount`
- required `reason`
- approval/completion lifecycle columns

### financial_adjustments
Commercial/accounting adjustments.

Types:

- `discount`
- `correction`
- `write_off`
- `surcharge`
- `void`

Important columns include optional links to invoice, invoice item, or payment. At least one target is required.

## Constraints
Implemented constraints include:

- status allowlists for every finance table;
- amount positivity or non-negativity checks;
- non-empty currency checks;
- payment/refund method allowlists;
- required non-empty `reason` for refunds and adjustments;
- required void reason / voided timestamp checks where feasible;
- metadata must be a JSON object;
- payment allocations require an invoice or invoice item target;
- financial adjustments require an invoice, invoice item, or payment target.

## Indexes
Added expected access-path indexes for:

- invoices by tenant/patient/status and tenant/status/created_at;
- invoice items by tenant/invoice, tenant/patient, tenant/completed_service;
- payments by tenant/patient/status and tenant/method/received_at;
- payment allocations by tenant/payment, tenant/invoice, tenant/invoice_item;
- refunds by tenant/patient/status and tenant/payment;
- financial adjustments by tenant/patient/type/status, tenant/invoice, tenant/invoice_item.

## updated_at triggers
Attached `public.set_updated_at()` triggers to:

- `invoices`
- `invoice_items`
- `payments`
- `payment_allocations`
- `refunds`
- `financial_adjustments`

## RLS and grants
RLS enabled on all six finance tables.

Read policy recommendation implemented conservatively:

- `clinic_owner` / `clinic_admin`: finance read within tenant.
- `cashier`: finance read within tenant.
- `registrar`: limited read for `invoices` and `payments` only.
- `doctor`: no broad direct finance table read by default.
- no-tenant: blocked.
- cross-tenant: blocked by `tenant_id` policy.
- anon: no access.
- authenticated: SELECT only where RLS permits.

Direct broad client writes are blocked:

- no authenticated INSERT;
- no authenticated UPDATE;
- no authenticated DELETE;
- no authenticated TRUNCATE;
- no authenticated REFERENCES;
- no authenticated TRIGGER.

Future writes are reserved for `PAYMENTS-DEBTS-RPC-001C` controlled SECURITY DEFINER RPCs.

## Domain boundaries
Preserved boundaries:

- completed service is not payment;
- invoice item may reference completed service;
- invoice is not payment;
- payment does not prove treatment completion;
- discount/write-off is not payment;
- write-off is a financial decision, not money received;
- debt/balance must be computed from financial facts or maintained only via controlled RPCs later.

No auto-invoice triggers were added.
No auto-payment triggers were added.
No completed service mutation was added.
No treatment plan mutation was added.

## What was intentionally NOT changed
Not changed:

- no UI;
- no app code;
- no repository;
- no hooks;
- no RPC;
- no Supabase cloud;
- no seed;
- no generated types;
- no stock;
- no documents;
- no timeline;
- no reports implementation;
- no payment processor integrations;
- no Kaspi/Halyk integration.

## Local validation
Local database reset:

- `npx supabase db reset --no-seed` passed.
- Existing migrations `0001` through `0015` still apply.
- New migration `0016_create_finance_model.sql` applies cleanly.

Schema validation after reset:

- all six finance tables exist;
- RLS is enabled on all six finance tables;
- row counts are 0 for all six finance tables;
- constraints exist on all finance tables;
- indexes exist on all finance tables;
- updated_at triggers exist on all finance tables;
- authenticated has SELECT grants only;
- anon has no grants;
- service_role remains privileged.

Validation snapshots:

- RLS enabled: `financial_adjustments`, `invoice_items`, `invoices`, `payment_allocations`, `payments`, `refunds` all true.
- Row counts: all six finance tables returned 0 rows.
- Index count: invoices 3, invoice_items 4, payments 3, payment_allocations 4, refunds 3, financial_adjustments 4.
- Triggers: one `*_set_updated_at` trigger on each finance table.

## Checks
Local checks run:

- `npx supabase db reset --no-seed`: passed.
- `npm ci`: passed in isolated worktree to install dependencies.
- `npm run lint`: passed.
- `npm run test -- --run`: passed, 58 files / 533 tests.
- `npm run build`: passed.

Known warnings:

- Existing React `act(...)` warnings remain in older tests and are unrelated to this schema-only migration.
- `npm ci` reported 2 high-severity dependency audit findings; no dependency changes were made in this task.

GitHub Actions CI:

- GitHub Actions CI #610 / run 27902189175: success on fbfc99df4a89b29c488fce49318e783c8ec5d4b2.

## Issues / warnings
- `patient_financial_summary` view was intentionally skipped for first schema foundation to avoid a misleading summary before controlled write paths and role-specific summary access are implemented.
- `invoice_items.completed_service_id` uses a simple FK to `completed_services(id)`. Same-tenant validation is reserved for future RPCs because the existing `completed_services` table does not currently expose a composite `(tenant_id, id)` unique key.
- No schema tests were added because this project does not currently expose a dedicated migration-test convention beyond local Supabase reset and catalog validation.

## Final verdict
PAYMENTS DEBTS SCHEMA IMPLEMENTED AND VERIFIED

## Recommended next task
PAYMENTS-DEBTS-REPOSITORY-001B
