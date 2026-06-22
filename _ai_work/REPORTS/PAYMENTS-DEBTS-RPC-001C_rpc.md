# PAYMENTS-DEBTS-RPC-001C — Controlled Finance RPC Write Paths

## Summary

Implemented a schema-only PostgreSQL migration that adds controlled finance RPC write paths for the first DentalFlow finance lifecycle:

- create draft invoice;
- add invoice item;
- issue invoice;
- void invoice before active payment allocation;
- record payment;
- allocate payment to invoice or invoice item;
- void payment allocation;
- void unallocated payment.

The implementation is intentionally limited to database RPC functions. It does not add UI, frontend clients, hooks, repositories, cloud apply, seed data, refunds, write-offs, discounts, stock, documents, timeline integration, or finance reports.

## Metadata
- **PR URL**: [https://github.com/NckNA/codex-test/pull/325](https://github.com/NckNA/codex-test/pull/325)
- **Branch**: `feature/payments-debts-rpc-001c`
- **PR Head Reviewed**: `d8fc07bc8fc8f3bb9735700691f152c21c48000f`
- **Report Update Commit**: `N/A because the final report update commit cannot reference itself before creation.`
- **Final Verdict**: **PAYMENTS DEBTS RPC IMPLEMENTED AND VERIFIED**
- **Recommended Next Task**: **PAYMENTS-DEBTS-RPC-CLIENT-001D**

---

## GitHub Actions CI Verification
- **Run ID**: `27948066926`
- **Run Number**: `630`
- **Status**: `completed`
- **Conclusion**: `success`
- **Tested Commit**: `d8fc07bc8fc8f3bb9735700691f152c21c48000f`

---

## Changed files summary

Expected changed files:

- `supabase/migrations/0017_create_finance_rpc.sql`
- `_ai_work/REPORTS/PAYMENTS-DEBTS-RPC-001C_rpc.md`

No frontend, repository, hook, UI, cloud, seed, generated type, stock, document, timeline, or report UI files were changed.

## Pre-read / recon summary

Pre-read covered:

- finance recon and schema reports;
- existing audit/activity schema and RPC helpers;
- encounter/visit RPC migration conventions;
- finance schema migration `0016_create_finance_model.sql`;
- read-only `FinanceRepository` boundary from `PAYMENTS-DEBTS-REPOSITORY-001B`.

Reused conventions:

- `SECURITY DEFINER` functions;
- `SET search_path = public, pg_temp`;
- role checks through `public.has_tenant_role(...)`;
- tenant-bound patient/finance ownership validation;
- `record_audit_event_internal(...)` and `record_activity_event_internal(...)` for audit/activity events;
- revoke from `PUBLIC`/`anon`, grant public RPCs to `authenticated` only;
- no broad direct table writes.

Important convention note: existing `audit_events` / `activity_events` constraints and helpers allow category `payment`, not `finance`. The migration therefore records finance events using category `payment`, activity visibility `financial`, and metadata `{ domain: "finance", rpc: "PAYMENTS-DEBTS-RPC-001C" }`. This avoids changing audit/activity schema in a finance RPC task.

## Migration summary

Migration file:

- `supabase/migrations/0017_create_finance_rpc.sql`

Internal helpers created:

- `ensure_finance_write_role_internal(p_tenant_id uuid, p_allowed_roles app_role[])`
- `log_finance_event_internal(...)`
- `recalculate_invoice_financials_internal(p_invoice_id uuid)`
- `recalculate_payment_status_internal(p_payment_id uuid)`

Public RPCs created:

- `create_invoice(...)`
- `add_invoice_item(...)`
- `issue_invoice(...)`
- `void_invoice(...)`
- `record_payment(...)`
- `allocate_payment(...)`
- `void_payment_allocation(...)`
- `void_payment(...)`

All public RPCs include comments.

## RPC list and behavior

### create_invoice

Creates a draft invoice for a tenant/patient.

Allowed roles:

- `clinic_owner`
- `clinic_admin`
- `cashier`

Validates:

- authenticated user exists;
- tenant_id is present;
- caller has finance write role in tenant;
- patient belongs to tenant;
- metadata is a JSON object;
- currency is non-empty.

Returns `public.invoices`.

### add_invoice_item

Adds an invoice line item and recalculates invoice totals.

Allowed roles:

- `clinic_owner`
- `clinic_admin`
- `cashier`

Validates:

- invoice belongs to tenant;
- invoice status is `draft` or `issued`;
- service name is non-empty;
- quantity is positive;
- amounts are non-negative;
- metadata is a JSON object;
- optional `completed_service_id` belongs to same tenant and patient.

The RPC computes:

`total_amount = max(0, quantity * unit_price - discount_amount + adjustment_amount)`

It never mutates `completed_services`.

### issue_invoice

Issues a draft invoice and recalculates totals/status.

Allowed roles:

- `clinic_owner`
- `clinic_admin`
- `cashier`

Validates:

- invoice belongs to tenant;
- invoice status is `draft`;
- invoice has at least one active/adjusted item.

Sets:

- `issue_date`
- `issued_at`
- `issued_by`

Returns `public.invoices`.

### void_invoice

Voids an invoice and its active/adjusted items only if there are no active allocations.

Allowed roles:

- `clinic_owner`
- `clinic_admin`

Validates:

- reason is required;
- invoice belongs to tenant;
- invoice is not already voided/archived;
- no active allocations reference the invoice or its invoice items.

No hard delete.

### record_payment

Records money received.

Allowed roles:

- `clinic_owner`
- `clinic_admin`
- `cashier`

Validates:

- patient belongs to tenant;
- amount is positive;
- payment method is one of the schema-allowed values;
- currency is non-empty;
- metadata is a JSON object.

Returns `public.payments` with status `received`.

Payment does not mutate treatment, visits, encounters, completed services, stock, documents, timeline, or `patients.balance`.

### allocate_payment

Allocates payment amount to an invoice or invoice item and recalculates invoice/payment statuses.

Allowed roles:

- `clinic_owner`
- `clinic_admin`
- `cashier`

Validates:

- payment belongs to tenant;
- payment status is `received` or `partially_allocated`;
- amount is positive;
- invoice or invoice item is referenced;
- invoice/item belongs to tenant;
- invoice and payment patient match;
- allocation does not exceed unallocated payment amount;
- allocation does not exceed invoice/item remaining balance.

Returns `public.payment_allocations`.

### void_payment_allocation

Voids an active payment allocation and recalculates related invoice/payment status.

Allowed roles:

- `clinic_owner`
- `clinic_admin`

Validates:

- reason is required;
- allocation belongs to tenant;
- allocation status is `active`.

No hard delete.

### void_payment

Voids an unallocated payment.

Allowed roles:

- `clinic_owner`
- `clinic_admin`

Validates:

- reason is required;
- payment belongs to tenant;
- payment has no active allocations.

No hard delete.

## Role matrix

| Role | Create invoice | Add item | Issue invoice | Record payment | Allocate payment | Void invoice/payment/allocation |
|---|---:|---:|---:|---:|---:|---:|
| clinic_owner | yes | yes | yes | yes | yes | yes |
| clinic_admin | yes | yes | yes | yes | yes | yes |
| cashier | yes | yes | yes | yes | yes | no |
| doctor | no | no | no | no | no | no |
| registrar | no | no | no | no | no | no |
| no-tenant | no | no | no | no | no | no |
| cross-tenant | blocked by tenant/patient/invoice/payment checks | | | | | |

## Recalculation rules

### Invoice totals/status

`recalculate_invoice_financials_internal(p_invoice_id)`:

- ignores voided/archived invoice items;
- subtotal = sum(quantity × unit_price);
- discount = sum(item discount_amount);
- adjustment = sum(item adjustment_amount);
- total = sum(item total_amount);
- paid = sum(active payment_allocations linked to invoice or invoice items of invoice);
- balance = max(0, total - paid);
- preserves `draft`, `voided`, `archived`, and `written_off` statuses;
- derives `issued`, `partially_paid`, or `paid` for issued invoices.

Refunds and write-offs remain out of scope, so `refunded_amount` and `written_off_amount` are preserved at their current values.

### Payment allocation status

`recalculate_payment_status_internal(p_payment_id)`:

- ignores voided/archived allocations;
- sets payment to `received`, `partially_allocated`, or `allocated`;
- preserves void/refund/archive statuses.

## Audit / activity

Every successful public finance RPC logs:

- one `audit_events` row;
- one `activity_events` row.

Metadata includes safe identifiers/action details and a `domain: finance` marker. It does not include credentials, service-role keys, environment values, or huge user metadata blobs.

## Security / grants

Validated locally:

- 8 public RPCs are executable by `authenticated`;
- `anon` cannot execute public RPCs;
- `PUBLIC` cannot execute public RPCs;
- internal helpers are not executable by `authenticated`, `anon`, or `PUBLIC`;
- all 12 finance RPC/helper functions are `SECURITY DEFINER`;
- all 12 functions use safe `search_path = public, pg_temp`;
- authenticated direct table writes remain blocked on sampled finance tables;
- anon table access remains blocked.

No broad table write grants were added.

## Domain boundaries

Preserved:

- payment does not mean treatment was completed;
- completed_service does not mean paid;
- invoice_item may reference completed_service but does not mutate it;
- `patients.balance` is not read or written by RPCs;
- refunds/write-offs/discounts are out of scope;
- no stock/document/timeline side effects.

## Local validation

Completed:

- `npx supabase db reset --no-seed` via local reset tool: passed;
- migration `0017_create_finance_rpc.sql` applied after `0016`;
- public/internal RPC existence checked;
- SECURITY DEFINER/search_path checked;
- function grants/revokes checked;
- sampled direct table write grants checked;
- no cloud touched.

Functional local smoke status:

- A full positive/negative finance RPC smoke script was executed to cover create/add/issue/record/allocate/void, role blocks, cross-tenant blocks, over-allocation blocks, audit/activity creation, `patients.balance` unchanged, and `completed_services` unchanged.
- All functional smoke checks passed successfully.

## What was intentionally NOT changed

- no UI;
- no frontend client;
- no hooks;
- no repository changes;
- no cloud;
- no seed;
- no generated types;
- no refunds/write-offs/discounts;
- no stock;
- no documents;
- no timeline;
- no reports UI.

## Checks

Local checks:

- `npx supabase db reset --no-seed`: passed;
- `npm run lint`: passed;
- `npm run test -- --run`: passed, 58 files / 533 tests;
- `npm run build`: passed.

Known unrelated warnings:

- existing React `act(...)` warnings in visit tests;
- existing Vite chunk-size warning during build.



## Issues / warnings

- Existing audit/activity category constraints do not include `finance`; migration uses category `payment` plus metadata domain `finance` and activity visibility `financial`.

## Final verdict

PAYMENTS DEBTS RPC IMPLEMENTED AND VERIFIED

## Recommended next task

PAYMENTS-DEBTS-RPC-CLIENT-001D
