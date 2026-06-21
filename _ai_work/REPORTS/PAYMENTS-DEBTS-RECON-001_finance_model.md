# PAYMENTS-DEBTS-RECON-001 — Finance model recon

## Summary

This report designs the future DentalFlow CRM finance architecture for invoices, invoice items, payments, payment allocations, refunds, discounts, write-offs, and patient balances/debts.

This is a recon-only task. No schema, code, UI, seed, cloud, or data mutation was implemented.

The current clinical workflow now has visits, clinical encounters, and completed services. The key domain boundary remains:

- `completed_service` = performed clinical/billable service fact.
- `invoice` / `bill` = financial charge grouping/request.
- `invoice_item` = billed line, optionally referencing a completed service.
- `payment` = money received.
- `refund` = money returned.
- `discount` / `write_off` = financial adjustment, not money movement.
- `debt` / `balance` = derived financial state from charges, payments, refunds, and adjustments.

## Branch name

`recon/payments-debts-001`

## PR URL

https://github.com/NckNA/codex-test/pull/322

## PR head reviewed before final report update

7573bc2029294f8ff6ba87de7ed77d8570bfb651

## Report update commit

N/A because the final report update commit cannot reference itself before creation.

## Changed files summary

Expected changed file:

- `_ai_work/REPORTS/PAYMENTS-DEBTS-RECON-001_finance_model.md`

No other file should be changed in the PR.

## Current schema recon

### Existing finance-like database objects

No durable finance module currently exists for patient invoices/payments/refunds/allocations.

The current schema has only finance-adjacent fields:

- `patients.balance numeric(10,2) DEFAULT 0`
- `patients.bonus_balance numeric(10,2) DEFAULT 0`
- `appointments.payment_type text CHECK (...)`
- `appointments.price numeric(10,2)`
- audit/activity infrastructure includes `payment_id` as an optional reference field/category.

These fields are not enough for reliable accounting. They do not model invoices, invoice items, allocation, refunds, discounts, write-offs, immutable payment history, or audit-safe balance derivation.

### Current clinical billing boundary

Migration `0014_create_encounter_visit_model.sql` explicitly defines:

- appointment = scheduled slot / booking intent;
- patient_visit = actual attendance;
- clinical_encounter = documented clinical session;
- completed_service = performed clinical/billable fact;
- treatment plan/stage = intended work, not proof of completion;
- payment = separate financial fact, not proof of treatment.

`completed_services` already stores a service/billing snapshot:

- `service_code`
- `service_name`
- `quantity`
- `unit_price`
- `total_amount`
- `currency`
- `performed_by`
- `performed_at`
- `status`

But comments explicitly say `unit_price` and `total_amount` are snapshots only and not payment/debt allocation. That makes `completed_services` the right source for performed billable facts, but not the finance ledger.

### Current role/RLS context

Clinical workflow uses tenant-scoped RLS:

- `patient_visits`: owner/admin/doctor/registrar can read.
- `clinical_encounters`: owner/admin/doctor can read.
- `completed_services`: owner/admin/doctor can read.
- direct broad writes are revoked; writes go through controlled SECURITY DEFINER RPCs.

Finance should preserve this pattern: tenant-scoped reads, no broad direct client writes, controlled RPCs for sensitive financial mutations, and audit/activity events for every write.

### Reuse/deprecate recommendation

- `patients.balance` and `patients.bonus_balance` should not be the financial source of truth.
- `appointments.payment_type` and `appointments.price` should be treated as legacy scheduling hints / intake snapshots, not accounting records.
- Future implementation may either deprecate these fields in UI or compute safer values from the new finance model.

## Finance domain model

### 1. invoices / bills

Purpose: a financial charge grouping/request for a patient in a tenant.

Recommendation:

- Invoices should be explicit records, not only calculated views over completed services.
- Invoice may be created in `draft`, then issued.
- One invoice can include multiple completed services.
- A completed service should normally be billed once, but split billing can be supported by multiple invoice items referencing the same completed service with partial quantities/amounts only if explicitly allowed.
- Issued invoices should be immutable for core financial fields; corrections should be modeled by voids/adjustments/credit notes rather than silent edits.
- Draft invoices may be editable through controlled RPCs.

Suggested table: `invoices`.

Key fields:

- `id uuid primary key`
- `tenant_id uuid not null`
- `patient_id uuid not null`
- `status text not null`
- `invoice_number text` unique per tenant when issued
- `currency text not null default 'KZT'`
- `subtotal_amount numeric(14,2)`
- `discount_amount numeric(14,2)`
- `adjustment_amount numeric(14,2)`
- `total_amount numeric(14,2)`
- `issued_at timestamptz`
- `due_at timestamptz`
- `voided_at timestamptz`
- `voided_by uuid`
- `void_reason text`
- `created_by`, `updated_by`
- `metadata jsonb not null default '{}'`
- timestamps

### 2. invoice_items

Purpose: billed invoice lines.

Recommendation:

- Invoice item should snapshot service name, code, quantity, unit price, total amount, and currency at billing time.
- `completed_service_id` should be nullable to allow future manual items, but manual items should be controlled and audited.
- Link to completed service must never imply payment.
- Line-level discounts should be represented either by explicit discount fields or financial adjustment rows tied to invoice/item.

Suggested table: `invoice_items`.

Key fields:

- `id uuid primary key`
- `tenant_id uuid not null`
- `invoice_id uuid not null`
- `patient_id uuid not null`
- `completed_service_id uuid null`
- `service_code text`
- `service_name text not null`
- `description text`
- `quantity numeric(12,2) not null check > 0`
- `unit_price numeric(14,2) not null check >= 0`
- `gross_amount numeric(14,2) not null check >= 0`
- `discount_amount numeric(14,2) not null default 0 check >= 0`
- `net_amount numeric(14,2) not null check >= 0`
- `currency text not null`
- `status text not null default 'active'`
- `void_reason text`
- timestamps

### 3. payments

Purpose: money received from patient/guarantor/insurer.

Recommendation:

- Payment is its own financial fact.
- Payment can exist before allocation as deposit/prepayment.
- Payment method should be explicit, not only appointment-level `payment_type`.
- Support mixed payment by separate payment rows or a grouped receipt model later.

Suggested table: `payments`.

Key fields:

- `id uuid primary key`
- `tenant_id uuid not null`
- `patient_id uuid not null`
- `amount numeric(14,2) not null check > 0`
- `currency text not null default 'KZT'`
- `method text not null` (`cash`, `kaspi`, `halyk_terminal`, `card`, `bank_transfer`, `insurance`, `osms`, `other`)
- `status text not null`
- `received_at timestamptz not null`
- `cashier_user_id uuid`
- `external_reference text`
- `receipt_number text`
- `notes text`
- `voided_at`, `voided_by`, `void_reason`
- timestamps

### 4. payment_allocations

Purpose: map payments to invoices or invoice items.

Recommendation:

- Use allocation table to support many-to-many payment/invoice relationships.
- One payment can pay multiple invoices.
- One invoice can be paid by multiple payments.
- Allocation amount must not exceed remaining payment or invoice balance.
- Unallocated payment balance represents prepayment/credit.

Suggested table: `payment_allocations`.

Key fields:

- `id uuid primary key`
- `tenant_id uuid not null`
- `payment_id uuid not null`
- `invoice_id uuid not null`
- `invoice_item_id uuid null`
- `amount numeric(14,2) not null check > 0`
- `currency text not null`
- `allocated_at timestamptz not null`
- `allocated_by uuid`
- `status text not null default 'active'`
- `voided_at`, `voided_by`, `void_reason`

### 5. refunds

Purpose: money returned.

Recommendation:

- Refund must reference original payment.
- Partial refunds must be supported.
- Refund amount must not exceed refundable amount.
- Reason is required.
- Refund should affect available payment allocation/balance through controlled RPCs.

Suggested table: `refunds`.

Key fields:

- `id uuid primary key`
- `tenant_id uuid not null`
- `patient_id uuid not null`
- `payment_id uuid not null`
- `amount numeric(14,2) not null check > 0`
- `currency text not null`
- `method text not null`
- `status text not null`
- `reason text not null`
- `requested_by`, `approved_by`, `completed_by`
- `requested_at`, `approved_at`, `completed_at`
- timestamps

### 6. discounts / financial adjustments

Purpose: commercial or accounting adjustment, not money movement.

Recommendation:

- Use one `financial_adjustments` table for discounts, corrections, write-offs, surcharges, and void adjustments.
- Require reason for all adjustments.
- Require approval for write-offs and large discounts.
- Adjustment can target invoice or invoice item.

Suggested table: `financial_adjustments`.

Key fields:

- `id uuid primary key`
- `tenant_id uuid not null`
- `patient_id uuid not null`
- `invoice_id uuid null`
- `invoice_item_id uuid null`
- `type text not null` (`discount`, `correction`, `write_off`, `surcharge`, `void`)
- `amount numeric(14,2) not null check >= 0`
- `currency text not null`
- `reason text not null`
- `status text not null`
- `created_by`, `approved_by`, `voided_by`
- timestamps

### 7. write-offs

Purpose: forgive/remove debt through business/accounting decision.

Recommendation:

- Model write-off as `financial_adjustments.type = 'write_off'` unless accounting later requires a dedicated table.
- Must require reason and approval by clinic_owner/clinic_admin.
- Never store write-off as payment.
- Never delete invoice/payment rows to reduce debt.

### 8. patient balance / debt

Purpose: amount owed or credit balance.

Recommendation:

- Balance should be computed from financial facts or maintained only through controlled transactional RPCs.
- Do not allow manual random editing of patient debt.
- Do not rely on `patients.balance` as source of truth.

Preferred approach:

- Source of truth: `invoices`, `invoice_items`, `payments`, `payment_allocations`, `refunds`, `financial_adjustments`.
- Read model: `patient_financial_summary` view or materialized summary later.
- Optional ledger view: `patient_financial_ledger` for reporting and audit.

## Recommended architecture

### Source of truth

- Billed amount: issued `invoice_items.net_amount` grouped by invoice.
- Paid amount: `payments.amount` minus voided/refunded amounts, allocated through `payment_allocations`.
- Debt: invoice total minus valid allocations minus valid write-offs/discounts; computed by view/RPC.
- Refund: `refunds` linked to original payment.
- Discount: `financial_adjustments` or invoice item discount fields, not payment.
- Write-off: approved `financial_adjustments.type = 'write_off'`, not payment.
- Overpayment/prepayment: received payment amount not yet allocated after refunds/voids.

### Stored vs computed balance

Recommended: computed balance first.

Reason:

- Stored `patients.balance` can drift.
- Finance facts are auditable and reversible.
- Reports should be able to recompute from immutable/voidable facts.

If performance later requires stored summary:

- create `patient_financial_summaries` updated only by controlled RPCs or triggers;
- expose drift checks comparing summary with ledger facts;
- never allow manual edits.

### Completed services relationship

- `invoice_items.completed_service_id` may reference `completed_services.id`.
- Completed service is not automatically an invoice.
- Completed service is not automatically paid.
- Completed service may be listed as “not yet invoiced” until invoice item is created.
- Voiding a completed service must not silently delete or mutate issued invoice lines; it should require finance correction/void workflow.

### Treatment plans relationship

- Treatment plans/stages remain intended work.
- Future quote/estimate module may use treatment plan data.
- Actual billing should use completed services or explicit invoice items.
- Payment must not complete treatment plan/stage.

## Status model and transitions

### Invoices

Statuses:

- `draft`
- `issued`
- `partially_paid`
- `paid`
- `voided`
- `written_off`
- `archived`

Transitions:

- draft -> issued: clinic_owner/clinic_admin/cashier if policy allows.
- issued -> partially_paid: system/RPC after allocation.
- issued/partially_paid -> paid: system/RPC when balance reaches zero.
- issued/partially_paid -> written_off: clinic_owner/clinic_admin approval.
- draft/issued -> voided: reason required; owner/admin, cashier only if allowed.
- any terminal -> archived: owner/admin only.

### Invoice items

Statuses:

- `active`
- `voided`
- `adjusted`

Transitions:

- active -> adjusted: discount/correction through RPC.
- active -> voided: reason required, if invoice state permits.

### Payments

Statuses:

- `received`
- `partially_allocated`
- `allocated`
- `partially_refunded`
- `refunded`
- `voided`

Transitions:

- received -> partially_allocated/allocated: cashier/admin allocation.
- received/allocated -> partially_refunded/refunded: refund workflow.
- received -> voided: same-day correction or admin-only policy; reason required.

### Refunds

Statuses:

- `pending`
- `completed`
- `rejected`
- `voided`

Transitions:

- pending -> completed: approval/processing.
- pending -> rejected: reason required.
- completed -> voided: rare correction, admin-only, reason required.

### Adjustments

Types:

- `discount`
- `correction`
- `write_off`
- `surcharge`
- `void`

Statuses:

- `draft`
- `approved`
- `applied`
- `voided`

Transitions:

- draft -> approved: owner/admin.
- approved -> applied: controlled RPC.
- applied -> voided: owner/admin with reason.

Every transition must create audit/activity events.

## Role / RLS design

### clinic_owner / clinic_admin

Recommended:

- full finance read;
- create/issue/void invoices;
- record and allocate payments;
- approve discounts/write-offs/refunds;
- view finance reports;
- export if product policy permits.

### cashier

Recommended:

- finance read for assigned tenant;
- record payments;
- allocate payments;
- view invoice/payment history;
- create refund request but not complete refund by default;
- no clinical source fact edits;
- no write-off approval by default.

### doctor

Recommended:

- no finance writes by default;
- optional limited read: patient has unpaid balance / payment warning only;
- no refund/write-off/payment actions;
- no detailed cashier reports unless explicitly granted.

### registrar

Recommended:

- basic payment/debt visibility for scheduling/front desk;
- optional draft invoice creation if clinic policy wants registrar invoicing;
- no payment receipt/refund/write-off by default;
- no financial report export by default.

### no-tenant / cross-tenant

- no access;
- no leakage through views/RPCs;
- every finance table must carry `tenant_id` and RLS must check `has_tenant_role`.

### RLS pattern

- Enable RLS on all finance tables.
- Grant SELECT to authenticated, filtered by policies.
- Revoke broad INSERT/UPDATE/DELETE from authenticated/anon/PUBLIC.
- Grant ALL only to service_role.
- Use SECURITY DEFINER RPCs for writes with explicit role checks and tenant checks.

## RPC / write path design

Do not implement in this recon.

Recommended future RPCs:

### Invoices

- `create_invoice`
- `add_invoice_item`
- `issue_invoice`
- `void_invoice`
- `apply_invoice_discount`
- `write_off_invoice_balance`

### Payments

- `record_payment`
- `allocate_payment`
- `void_payment`
- `refund_payment`

### Adjustments

- `create_financial_adjustment`
- `approve_write_off`
- `void_adjustment`

Rules for every write RPC:

- use `auth.uid()`;
- require and validate `tenant_id`;
- validate actor role by tenant;
- validate patient/invoice/payment/line ownership;
- wrap updates in transaction;
- require reason for void/refund/write-off/discount;
- write audit_events and activity_events in same transaction;
- never trust actor input from client;
- never directly mutate clinical facts for payment workflows.

## UI rollout plan

Recommended implementation sequence:

1. `PAYMENTS-DEBTS-SCHEMA-001A` — schema-only migration.
2. `PAYMENTS-DEBTS-REPOSITORY-001B` — read-only repository.
3. `PAYMENTS-DEBTS-RPC-001C` — controlled write RPCs.
4. `PAYMENTS-DEBTS-RPC-CLIENT-001D` — typed frontend RPC client.
5. `PATIENT-FINANCE-UI-001` — patient card finance tab.
6. `CASHIER-PAYMENT-FLOW-001` — cashier-focused payment intake.
7. `REFUNDS-WRITEOFFS-UI-001` — refunds, write-offs, approvals.
8. `FINANCE-REPORTS-001` — daily cashbox, debts, revenue, doctor/service revenue.
9. `SUPABASE-CLOUD-APPLY-PAYMENTS-001` — cloud schema apply.

Do not implement UI before schema/RPC boundaries exist. That path leads to localStorage finance, and then everyone suffers professionally.

## Reporting design

Future reports and source of truth:

- Patient debt: invoices/items minus allocations/refunds/write-offs.
- Unpaid invoices: issued/partially_paid invoices with positive balance.
- Partially paid invoices: invoices with allocations less than due amount.
- Daily payments by method: payments grouped by method/status/date.
- Revenue by service: issued invoice_items, optionally linked to completed_services.
- Revenue by doctor: invoice_items linked to completed_services.performed_by.
- Refunds: refunds table joined to payments/patients.
- Write-offs: financial_adjustments where type = write_off.
- Discounts: line/invoice adjustments or discount fields.
- Overpayments/prepayments: unallocated payment balance.
- Completed services not invoiced: completed_services without active invoice_items.
- Manual invoice items: invoice_items with null completed_service_id.
- Audit report: audit_events/activity_events for financial mutations.

Revenue recognition must be decided explicitly later. For now, finance reports should separate performed services, issued invoice revenue, and cash received.

## Risk analysis

Main risks:

1. Double counting revenue if completed_services and invoice_items both count as revenue.
2. Treating payment as completed treatment.
3. Treating completed service as paid.
4. Manually editing patient debt causing drift.
5. Refunds without original payment link.
6. Discounts without reason/approval.
7. Cross-tenant financial leakage.
8. Cashier over-permission.
9. Doctor seeing unnecessary financial detail.
10. Deleting financial facts instead of voiding.
11. localStorage fallback for finance data.
12. Missing audit/activity for financial mutations.
13. Mixing platform billing with clinic finance.
14. Using appointment.payment_type as payment proof.
15. Voiding clinical service without finance correction workflow.

## What was intentionally NOT changed

- No migrations.
- No SQL apply.
- No Supabase cloud changes.
- No app code.
- No UI.
- No seed.
- No generated types.
- No browser smoke.
- No payment implementation.
- No stock implementation.
- No documents implementation.
- No timeline integration.
- No report implementation.
- No data mutation.

## Checks

Local recon checks performed:

- Read current schema files and finance-related source references.
- Confirmed current durable finance model is absent except legacy/placeholder fields.
- Confirmed completed_services domain boundary and clinical workflow comments.
- Confirmed finance page is currently placeholder-only.
- Confirmed role context is tenant-scoped through TenantContext and RLS patterns.

Git status / CI:

- GitHub Actions CI #606 / run 27889878143: success on 7573bc2029294f8ff6ba87de7ed77d8570bfb651.

## Final verdict

PAYMENTS DEBTS RECON COMPLETED

## Recommended next task

PAYMENTS-DEBTS-SCHEMA-001A
