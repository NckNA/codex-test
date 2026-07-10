# FINANCE-OPERATIONS-RECON-001

Final verdict: **PASS**

## Summary

Report-only reconciliation of finance operational readiness, data invariants, roles, audit coverage, performance risks, business gaps, architecture decisions, and the dependency-ordered implementation roadmap.

## 1. Executive summary

The finance module now has a strong transaction core but is not yet operationally complete for a dental clinic.

Implemented and materially verified capabilities include:

- tenant-scoped invoices and invoice items;
- controlled invoice creation, line addition, issue, and invoice void;
- payments and payment allocations;
- partial and full payment allocation;
- one atomic and idempotent cashier payment operation across multiple invoices;
- cashier reconciliation after an uncertain network result;
- payment/allocation void controls;
- refund request, approval, completion, rejection, and cancellation;
- partial/full write-off, rejection, and reversal;
- row locking, capacity guards, idempotency keys, audit/activity events, RLS, and controlled SECURITY DEFINER RPCs;
- patient finance and cashier UI surfaces with stale-state protection and safe error handling.

The transaction RPCs are generally stronger than the current read/reporting layer. Three gaps are critical because they can produce incorrect financial interpretation or inconsistent money:

1. `computePatientFinanceSummary` can create false debt after refunding an unallocated payment, and all summary calculations are truncated to at most 200 facts per table.
2. Allocation and cashier flows do not enforce invoice/payment currency equality. Numerically equal amounts in different currencies can be allocated as though they were interchangeable.
3. A completed service can be linked to multiple invoice items because no unique billing guard exists.

The most important unresolved dependency root is the meaning of unallocated money. Manual payment entry can create an unallocated balance, the UI calls the derived result “credit,” cashier payment forbids overpayment, refunds return only unallocated funds, and there is no explicit deposit/prepayment model. This ambiguity affects debt summaries, refunds, future deposits, overpayments, reporting, and provider reconciliation.

Therefore the recommended next task is **PATIENT-CREDIT-DEPOSITS-RECON-001**. It should define authoritative semantics before implementation work continues.

## 2. Branch

`recon/finance-operations-recon-001`

Baseline reviewed:

`38a37672688ceff5ea8f63989127c8870473dc17`

The baseline contains merged PR #335 (`REFUNDS-WRITEOFFS-UI-001`).

## 3. PR URL

https://github.com/NckNA/codex-test/pull/336

## 4. PR head reviewed before final report update

`209814b22895dc8d5021d0f9860cad328000912f`

Fresh implementation/report CI before the final metadata update:

- workflow: `CI`;
- run number: `662`;
- run ID: `29098542205`;
- result: `success`;
- tested commit: `209814b22895dc8d5021d0f9860cad328000912f`.

## 5. Report update commit

- Report update commit: N/A (the report commit cannot reference itself; use the finalization receipt).
- The immutable finalization receipt records the final report-only commit and fresh CI run.

## 6. Changed files

Exactly one file is changed by this task:

- `_ai_work/REPORTS/FINANCE-OPERATIONS-RECON-001_recon.md`

No SQL, migration, TypeScript, React, test, seed, generated type, cloud, fixture, or implementation file is changed.

## 7. Sources reviewed

### Finance reports

- `_ai_work/REPORTS/PAYMENTS-DEBTS-RECON-001_finance_model.md`
- `_ai_work/REPORTS/PAYMENTS-DEBTS-SCHEMA-001A_schema.md`
- `_ai_work/REPORTS/PAYMENTS-DEBTS-REPOSITORY-001B_repository.md`
- `_ai_work/REPORTS/PAYMENTS-DEBTS-RPC-001C_rpc.md`
- `_ai_work/REPORTS/PAYMENTS-DEBTS-RPC-CLIENT-001D_client.md`
- `_ai_work/REPORTS/PATIENT-FINANCE-UI-001_ui.md`
- `_ai_work/REPORTS/CASHIER-PAYMENT-FLOW-001_cashier.md`
- `_ai_work/REPORTS/REFUNDS-WRITEOFFS-FOUNDATION-001_foundation.md`
- `_ai_work/REPORTS/CASHIER-PAYMENT-FLOW-HARDENING-001_hardening.md`
- `_ai_work/REPORTS/REFUNDS-WRITEOFFS-UI-001_ui.md`

### Security, tenant, and role reports

- `_ai_work/REPORTS/SECURITY-DEFINER-RPC-RECON-001_security_definer_audit.md`
- `_ai_work/REPORTS/SECURITY-DEFINER-RPC-HARDENING-001A_rls_helper_grants.md`
- `_ai_work/REPORTS/MULTITENANT-QA-001_runtime_boundary_validation.md`
- `_ai_work/REPORTS/ROLE-LABEL-UX-001_role_label_ux.md`
- relevant RLS and role reports under `_ai_work/REPORTS`.

### Migrations and SQL tests

- `supabase/migrations/0016_create_finance_model.sql`
- `supabase/migrations/0017_create_finance_rpc.sql`
- `supabase/migrations/0018_create_refund_writeoff_rpc.sql`
- `supabase/migrations/0019_harden_cashier_payment_flow.sql`
- `supabase/tests/0018_refund_writeoff_rpc_test.sql`
- `supabase/tests/0018_refund_writeoff_concurrency.ps1`
- `supabase/tests/0019_cashier_payment_hardening_test.sql`
- `supabase/tests/0019_cashier_payment_concurrency.ps1`

No later finance migration exists at this baseline.

### Application code and tests

- `src/data/repositories/FinanceRepository.ts`
- `src/data/repositories/FinanceRepository.test.ts`
- `src/data/repositories/FinanceRpcClient.ts`
- `src/data/repositories/FinanceRpcClient.test.ts`
- all finance hooks and finance components;
- all cashier hooks, components, and tests;
- `src/pages/FinancePage.tsx`;
- `src/pages/CashierPaymentPage.tsx`;
- patient-card finance integration;
- finance/cashier permission helpers;
- audit/activity helper migrations and tests.

## 8. Current finance architecture

The current model correctly separates financial concepts:

- completed service is a clinical/billable fact;
- invoice item is a charge line and may reference a completed service;
- invoice groups financial charges;
- payment records money received;
- allocation explains where received money is applied;
- refund records money returned;
- write-off reduces debt without creating payment;
- patient debt is derived from financial facts, not `patients.balance`.

The architecture has three layers:

1. **Stored financial facts** in six finance tables.
2. **Controlled mutation RPCs** with tenant/role checks, locks, recalculation, audit, and RLS-protected reads.
3. **Frontend repository/client/hooks/UI** for patient finance, cashier, refunds, and write-offs.

The architecture is strongest for transactional writes. It is incomplete for authoritative summaries, reporting, corrections, credit/deposit semantics, mixed methods, claims, shifts, and integrations.

`patients.balance` is not read or changed by finance RPCs and is not authoritative.

## 9. Table inventory

### 9.1 `invoices`

| Aspect | Current state |
|---|---|
| Purpose | Patient financial charge grouping/request. Not payment and not proof of treatment completion. |
| Source-of-truth role | Stored invoice lifecycle snapshot; totals are recalculated from active/adjusted invoice items, allocations, and approved write-offs. |
| Tenant/patient | Required `tenant_id`; composite FK `(tenant_id, patient_id)` to patients. |
| Statuses | `draft`, `issued`, `partially_paid`, `paid`, `voided`, `written_off`, `archived`. |
| Amounts | subtotal, discount, adjustment, total, paid, refunded, written-off, balance. |
| Actors/audit fields | created/issued/voided actors and timestamps, void reason, metadata. |
| Archive/void | Schema supports both; controlled invoice void exists; archive RPC/UI does not. |
| RLS read | owner/admin/cashier/registrar. Doctor is not included. |
| Frontend reads | repository list/get; patient finance; cashier open invoices. |
| Frontend writes | RPC client only. |
| RPC mutations | create, issue, void; line addition recalculates. |
| Constraints | status, non-empty currency, non-negative amount snapshots, required void/issue timestamps. |
| Indexes | tenant/patient/status; tenant/status/created_at. |
| Invariants | recalculation ensures paid + approved write-off <= total and derives balance/status. |
| Gaps | no invoice number generation/uniqueness; issued invoice can receive new items; no correction note lifecycle; no archive path; no overdue/collection state; currency is arbitrary text. |

`refunded_amount` is retained but current refund logic does not connect refunds to invoices and does not recalculate this field. It is therefore underused and potentially misleading.

### 9.2 `invoice_items`

| Aspect | Current state |
|---|---|
| Purpose | Financial line item; optional link to completed service. |
| Source-of-truth role | Active/adjusted lines are authoritative for invoice subtotal, discount, adjustment, and total. |
| Tenant/patient | Required tenant and patient; invoice FK; optional completed-service FK. RPC validates completed-service tenant/patient. |
| Statuses | `active`, `voided`, `adjusted`, `archived`. |
| Amounts | quantity, unit price, discount, adjustment, total. |
| Actors/audit fields | created/voided actor, void reason/timestamp, metadata. |
| Archive/void | Schema supports them; no item void/edit/archive RPC or UI. |
| RLS read | owner/admin/cashier. |
| Frontend reads | patient finance and cashier. |
| Frontend writes | `add_invoice_item` only. |
| Constraints | service name, positive quantity, non-negative unit/discount/total; no direct constraint on adjustment in original table beyond RPC. |
| Indexes | tenant/invoice; tenant/patient; partial tenant/completed_service. |
| Invariants | RPC validates invoice and optional completed-service patient/tenant. |
| Gaps | no uniqueness preventing repeated billing of the same completed service; no controlled correction/void; discount can exceed subtotal and line total is silently floored to zero; item patient/invoice consistency is RPC-only. |

### 9.3 `payments`

| Aspect | Current state |
|---|---|
| Purpose | Money received from patient or payer. |
| Source-of-truth role | Authoritative receipt of money. Allocation/refund tables explain later use/return. |
| Tenant/patient | Required tenant and patient with composite patient FK. |
| Statuses | `received`, `allocated`, `partially_allocated`, `refunded`, `partially_refunded`, `voided`, `archived`. |
| Amounts | amount and currency. |
| Actors/audit fields | received/voided actor, timestamps, external reference, payer, notes, metadata. |
| Archive/void | Payment void RPC exists; archive path absent. |
| RLS read | owner/admin/cashier/registrar. |
| Frontend reads | patient finance and cashier. |
| Frontend writes | record RPC and atomic cashier RPC. |
| RPC mutations | record, void, atomic record-and-allocate. |
| Constraints | amount > 0; allowed method; non-empty currency; metadata object; void/archive state fields. |
| Indexes | tenant/patient/status; tenant/method/received_at; tenant/cashier operation key unique. |
| Invariants | status derived from active allocations and completed refunds; capacity trigger protects allocations/reservations. |
| Gaps | manual `record_payment` is not idempotent; no payment parts; `mixed`, insurance, and OSMS are labels only; no deposit classification; no shift link; no settlement/provider state; status cannot fully express concurrent allocation/refund dimensions. |

### 9.4 `payment_allocations`

| Aspect | Current state |
|---|---|
| Purpose | Application of a payment amount to an invoice or invoice item. |
| Source-of-truth role | Authoritative explanation of how received money reduces invoice debt. |
| Tenant/patient | Required tenant/patient/payment; invoice or item required. RPC validates same patient. |
| Statuses | `active`, `voided`, `archived`. |
| Amounts | amount and currency copied from payment. |
| Actors/audit fields | created/voided actors, timestamps, reason, metadata. |
| Archive/void | Void RPC exists; archive path absent. |
| RLS read | owner/admin/cashier. |
| Frontend reads | patient finance and cashier. |
| Frontend writes | allocate and void-allocation RPCs. |
| Constraints/triggers | positive amount, reference required, capacity trigger accounts for refunds and write-off reservations. |
| Indexes | tenant/payment; partial tenant/invoice; partial tenant/item. |
| Invariants | cannot exceed payment or invoice capacity; patient checked in RPC. |
| Gaps | no currency equality guard against invoice currency; no explicit allocation sequence/business reason; no refund-allocation reversal link; no archive workflow. |

### 9.5 `refunds`

| Aspect | Current state |
|---|---|
| Purpose | Money returned against an original payment. |
| Source-of-truth role | Completed rows are authoritative returned-money facts; pending/approved rows reserve refundable capacity. |
| Tenant/patient | Required tenant/patient/payment; payment-derived patient/currency. |
| Statuses | `pending`, `approved`, `completed`, `rejected`, `voided`, `archived`. |
| Amounts | amount/currency; method and external reference. |
| Actors/audit fields | requested, approved, completed, voided actors/timestamps; rejection actor/reason is stored in metadata. |
| Archive/void | Pending/approved can be voided; completed is immutable through RPC; archive path absent. |
| RLS read | owner/admin/cashier. |
| Frontend reads | payment-specific refund history and patient finance. |
| Frontend writes | lifecycle RPC client only. |
| RPC mutations | request, approve, complete, reject, void. |
| Constraints/indexes | state actor/timestamp checks; tenant idempotency unique; tenant/patient/status; tenant/payment. |
| Invariants | request/approval/completion lock payment; only currently unallocated funds are refundable; completed refunds affect payment status. |
| Gaps | no allocated-fund refund; no link to original allocations; no provider refund state; no same-user approval rule; idempotency fingerprint omits reason/metadata; method can differ from original payment without policy. |

### 9.6 `financial_adjustments`

| Aspect | Current state |
|---|---|
| Purpose | Schema container for discount, correction, write-off, surcharge, and void adjustments. |
| Source-of-truth role | Only approved `write_off` is integrated into invoice recalculation. Other types are not operationally authoritative. |
| Tenant/patient | Required tenant/patient and at least invoice/item/payment reference. |
| Statuses | `active`, `approved`, `rejected`, `voided`, `archived`. |
| Amounts | amount/currency/reason. |
| Actors/audit fields | created/approved/voided actors/timestamps; rejection data in metadata. |
| Archive/void | Write-off void exists; generic adjustment lifecycle does not. |
| RLS read | owner/admin/cashier. |
| Frontend reads | patient finance; write-off history. |
| Frontend writes | write-off lifecycle only. |
| RPC mutations | request/approve/reject/void invoice write-off. |
| Constraints/indexes | type/status/reference/reason/currency/metadata; tenant idempotency unique; tenant/patient/type/status and invoice/item indexes. |
| Invariants | approved write-off affects debt; active request reserves capacity; void restores debt. |
| Gaps | discount/correction/surcharge/void types lack RPC/UI/recalculation rules; summary currently counts some of them despite invoice totals not doing so; no separation of duties, thresholds, taxonomy, or evidence attachments. |

## 10. RPC inventory

### 10.1 Invoice/payment RPCs

| RPC | Roles | Locking/idempotency | State and validation | Audit/recalculation | Missing edge cases |
|---|---|---|---|---|---|
| `create_invoice` | owner/admin/cashier | no idempotency | tenant/auth role, patient, currency, metadata | invoice-created audit/activity | no numbering; duplicate submit possible; arbitrary currency |
| `add_invoice_item` | owner/admin/cashier | invoice `FOR UPDATE`; no idempotency | draft or issued invoice; optional completed-service tenant/patient | recalculates invoice; item-added event | duplicate service billing; issued correction unsafe; no item uniqueness; discount flooring |
| `issue_invoice` | owner/admin/cashier | invoice `FOR UPDATE`; safe repeat only for current issued return behavior | draft only, active item required | recalculates and audits | no immutable invoice snapshot/number; cashier may self-issue |
| `void_invoice` | owner/admin | invoice lock | reason; blocks active allocations and active/approved write-off | voids active lines and audits | no compensating note; no explicit legal/fiscal status |
| `record_payment` | owner/admin/cashier | no idempotency | patient, positive amount, method, currency, metadata | payment-recorded event | duplicate money on retry; no shift/provider/parts/deposit classification |
| `allocate_payment` | owner/admin/cashier | payment/item/invoice locks; DB capacity trigger | positive amount; same patient; received/partially allocated payment; issued/partially paid invoice | payment and invoice recalculation; allocation event | no payment/invoice currency equality check; no refund reversal link |
| `void_payment_allocation` | owner/admin | allocation lock | active only; reason | recalculates payment/invoice; audit | no replacement/correction workflow; reopens debt immediately |
| `void_payment` | owner/admin | payment lock | reason; no active allocations; refund trigger blocks pending/approved/completed refund | audit | wrong-patient/method correction remains manual void/re-enter; no shift reconciliation |

### 10.2 Cashier RPCs

| RPC | Roles | Locking/idempotency | Behavior | Audit/recalculation | Missing edge cases |
|---|---|---|---|---|---|
| `record_and_allocate_payment` | owner/admin/cashier | advisory tenant/key lock; unique operation key; full request fingerprint; stable invoice locks | requires invoice IDs, rejects overpayment, auto-issues valid draft invoices, allocates in caller order atomically | underlying invoice/payment/allocation events; returns reconciliation result | cannot record deposit/credit; no currency equality; no shift; no payment parts/provider settlement |
| `get_cashier_payment_operation` | owner/admin/cashier | lookup by tenant/key | returns completed/already-completed/not-found without exposing another tenant | no mutation/audit | no cashier shift or provider reconciliation state |

Concurrency behavior is strong for the atomic cashier path. Concurrent retries converge on one payment. A failure during allocation rolls back the whole transaction.

### 10.3 Refund RPCs

| RPC | Roles | Locking/idempotency | State transition | Audit/recalculation | Missing edge cases |
|---|---|---|---|---|---|
| `request_refund` | owner/admin/cashier | payment lock; tenant idempotency key | payment -> pending refund reservation | requested event | only unallocated funds; key comparison omits reason/metadata; refund method not tied to original method |
| `approve_refund` | owner/admin | refund/payment locks | pending -> approved | approved event | requester may approve own request; no threshold/evidence |
| `complete_refund` | owner/admin/cashier | refund/payment locks | approved -> completed | payment status recalculated; completed event | no provider settlement state; no invoice reopening for allocated funds |
| `reject_refund` | owner/admin | refund lock | pending -> rejected | rejected event | rejection actor only in metadata |
| `void_refund` | owner/admin | refund lock | pending/approved -> voided; completed immutable | void event | no archive workflow |

### 10.4 Write-off RPCs

| RPC | Roles | Locking/idempotency | State transition | Audit/recalculation | Missing edge cases |
|---|---|---|---|---|---|
| `request_invoice_write_off` | owner/admin | invoice lock; tenant idempotency | issued/partially paid invoice -> active reservation | requested event; invoice recalculated for eligibility | requester may later approve; no threshold/taxonomy/attachment |
| `approve_invoice_write_off` | owner/admin | adjustment/invoice locks | active -> approved | invoice debt/status recalculated; approved event | no four-eyes control; no owner-only threshold |
| `reject_invoice_write_off` | owner/admin | adjustment lock | active -> rejected | rejected event | actor only in metadata |
| `void_invoice_write_off` | owner/admin | adjustment/invoice locks | active/approved -> voided | approved void reopens debt; event | no approval for reversal; no collection-state coordination |

## 11. Repository/client inventory

### Finance repository

The repository provides tenant-required list/get methods for every finance table plus:

- `getPaymentRefundability`;
- `getInvoiceWriteOffEligibility`;
- `getPatientFinanceFacts`;
- `getPatientFinanceSummary`.

Positive qualities:

- tenant IDs are required before queries;
- record IDs/patient IDs are validated;
- lists use limit/offset pagination;
- default limit is 50 and maximum limit is 200;
- archived/voided facts are excluded by default;
- row mapping preserves metadata and nullable fields;
- repository performs no writes.

Operational risks:

- `getPatientFinanceSummary` loads six lists capped at 200 and calculates in the browser/application layer;
- `usePatientFinance` then loads the summary plus another seven lists, duplicating reads;
- a patient with more than 200 rows in any category receives a silently incomplete summary;
- refundability and write-off eligibility are also client-computed from at most 200 related facts;
- no tenant-level reports or server-authoritative aggregate read models exist.

### Finance RPC client

The typed client exposes every controlled RPC and performs no direct table mutation. It validates basic identifiers, amounts, methods, metadata, and idempotency keys, maps rows to domain types, and hides structured backend error dumps.

The cashier client classifies permission, idempotency conflict, and uncertain transport outcomes. Generic finance errors are safer than raw Supabase errors, although some normalized backend detail can still be appended when short and unstructured.

Client validation cannot compensate for missing DB invariants such as currency equality, unique service billing, separation of duties, or authoritative credit semantics.

## 12. UI inventory

### Patient finance panel

Users: owner, admin, cashier, doctor, registrar according to UI capabilities.

Reads:

- summary, invoices, items, payments, allocations, refunds, adjustments.

Writes:

- create invoice, add item, issue, record payment, allocate;
- admin/owner void controls;
- refund and write-off workflows through typed RPC client.

Strengths:

- loading/error/empty/no-tenant/no-patient/no-access states;
- stale query-key handling;
- safe error messaging;
- all finance facts visible in one patient context.

Gaps:

- role/RLS mismatch makes doctor and registrar full-panel reads fail or become incomplete;
- hardcoded KZT in invoice creation and summary card;
- no pagination controls despite bounded lists;
- no invoice numbering, correction note, item void, deposit context, claim context, or report/export action;
- “Paid” summary uses gross active payment receipts, not allocated net payment;
- “Credit” is derived from a preliminary formula and has no ledger/state workflow.

### Invoice list/detail

Supports invoice selection, status, amounts, issue/void, and line addition. It allows adding lines to an already issued invoice. There is no controlled edit/void/correction path for a line, so post-issue changes are not preserved as compensating facts.

### Payment list/allocation controls

Supports payment history, payment recording, allocation to invoice or item, allocation history, and admin voids. Payment method `mixed` is selectable without any method breakdown. Insurance/OSMS are selectable as immediate payments without claims.

### Cashier page

This is the most operationally hardened UI:

- tenant/patient scoped search;
- open invoice selection;
- deterministic allocation order;
- atomic submit;
- rapid double-submit protection;
- stable operation key retry;
- uncertainty reconciliation;
- stale patient-result suppression;
- safe error/result wording.

Limitations:

- requires selected invoice debt and forbids overpayment;
- cannot accept a deposit/prepayment;
- no shift/opening/closing/count reconciliation;
- no payment-part breakdown;
- no fiscal/provider result.

### Refund controls

Show payment amount, active allocation, completed/refund reservation, refundable amount, history, request/approve/complete/reject/void actions, and factual completion confirmation. Allocated funds must first be manually unallocated.

### Write-off controls

Show invoice total/paid/approved/reserved/available amounts and history, with request/approve/reject/void lifecycle. The same admin may request and approve.

### Global finance page

`src/pages/FinancePage.tsx` remains a placeholder. There is no tenant-level finance operations dashboard, report center, reconciliation page, or export surface.

## 13. Workflow completeness matrix

| # | Workflow | Classification | Evidence | Limitation |
|---|---|---|---|---|
| 1 | Completed service to invoice | **UNSAFE** | `add_invoice_item`, completed-service validation, InvoiceDetail input | optional/manual link; no uniqueness, so the same service can be billed repeatedly |
| 2 | Manual invoice creation | **COMPLETE WITH LIMITATIONS** | `create_invoice`, repository/client/hook/UI/tests | no numbering/idempotency; cashier may create |
| 3 | Draft to issued invoice | **COMPLETE WITH LIMITATIONS** | `issue_invoice`, InvoiceActions, tests | issued invoice is not immutable; line additions remain allowed |
| 4 | Partial payment | **COMPLETE** | `record_payment`, `allocate_payment`, recalculation, UI/tests | reporting explanations remain weak |
| 5 | Full payment | **COMPLETE** | allocation and invoice status recalculation; cashier tests | no fiscal/provider settlement |
| 6 | One payment across multiple invoices | **COMPLETE** | atomic cashier operation and ordered allocation | selected invoice currency equality absent |
| 7 | Payment allocation void | **COMPLETE WITH LIMITATIONS** | `void_payment_allocation`, UI/admin tests | no guided correction/replacement workflow |
| 8 | Payment void | **COMPLETE WITH LIMITATIONS** | `void_payment`, guards, UI | only when no active allocations/refunds; no shift/provider reconciliation |
| 9 | Refund request | **COMPLETE WITH LIMITATIONS** | request RPC/hook/UI/SQL/concurrency | unallocated funds only; weak semantic fingerprint |
| 10 | Refund approval | **COMPLETE WITH LIMITATIONS** | approve RPC/UI/tests | no requester/approver separation |
| 11 | Refund completion | **COMPLETE WITH LIMITATIONS** | completion RPC/UI/payment recalculation | no provider settlement; no allocated refund |
| 12 | Refund rejection | **COMPLETE** | reject RPC/UI/tests | actor stored in metadata rather than typed column |
| 13 | Refund cancellation | **COMPLETE** | void pending/approved; completed immutable | no archive workflow |
| 14 | Partial write-off | **COMPLETE** | request/approve/recalculate/tests | governance controls missing |
| 15 | Full write-off | **COMPLETE** | status `written_off`, zero balance tests | reporting/approval governance missing |
| 16 | Write-off rejection | **COMPLETE** | reject RPC/UI/tests | actor in metadata |
| 17 | Write-off reversal | **COMPLETE WITH LIMITATIONS** | void approved write-off restores debt | no separate approval/reason taxonomy/collection coordination |
| 18 | Patient debt summary | **UNSAFE** | `computePatientFinanceSummary` | refund formula can create false debt; 200-row truncation; adjustment inconsistency |
| 19 | Patient payment history | **COMPLETE WITH LIMITATIONS** | repository/UI lists | bounded without UI pagination; gross payment does not explain allocations/refunds in one ledger view |
| 20 | Cashier reconciliation after network uncertainty | **COMPLETE WITH LIMITATIONS** | operation key, lookup RPC, hook/UI/tests | only internal transaction reconciliation, not shift/provider settlement |

## 14. Partial payments

- One invoice can accept several payments through multiple active allocations.
- One payment can cover part of one invoice.
- One payment can cover several invoices through the atomic cashier RPC or repeated allocations.
- Cashier allocation order is explicit: caller-selected invoice order; locks are acquired in stable UUID order.
- Prior payments and allocations are visible in patient finance; cashier sees current patient finance facts.
- Remaining balance is stored/recalculated per invoice.

Limitations:

- there is no consolidated “why this balance changed” ledger;
- no tenant-level partial payment report;
- patient summary can be truncated/inaccurate;
- no promised-payment or collection workflow;
- no explicit installment plan.

Classification: **transactionally complete, operational reporting partial**.

## 15. Overpayments and patient credit

Current behavior is inconsistent by entry path:

- manual `record_payment` can record money without an invoice;
- unallocated money can remain on the patient;
- patient summary derives a `creditAmount` when payments/allocations produce a negative amount due;
- later manual allocation can use received/partially allocated payment;
- refund can return currently unallocated funds;
- atomic cashier payment explicitly rejects amount above selected invoice balances and requires at least one invoice.

There is no authoritative distinction among:

- unallocated payment;
- overpayment;
- deposit;
- advance/prepayment;
- patient credit;
- third-party payer credit.

The current summary formula is unsafe. It adds completed refunds to patient debt even though current refunds return only unallocated payment and do not reopen invoice debt. Example: a fully paid invoice plus a separate unallocated payment that is refunded can incorrectly produce new patient debt.

Required direction:

- define unallocated payment as a credit-source fact;
- derive total/reserved/available credit from authoritative server read models;
- identify business intent separately from the payment money fact;
- never use `patients.balance`;
- prevent summary truncation.

## 16. Deposits/prepayments

A patient can technically pay before treatment using manual payment recording, but the operation is indistinguishable from an accidental unallocated payment. The cashier flow cannot do it.

Missing capabilities:

- deposit/prepayment intent/category;
- link to planned treatment or future invoice;
- reservation of credit for a plan;
- release/reallocation rules;
- expiration policy, if business policy requires it;
- dedicated deposit receipt/terms;
- explicit refund behavior;
- UI and reports.

Recommendation: keep the actual money in `payments`, and add a separate classification/intent/reservation model rather than duplicating money in a second ledger table.

## 17. Mixed payment methods

`payment_method = 'mixed'` currently means only a label. No portions are stored.

The system cannot authoritatively represent:

- 50,000 cash + 50,000 Kaspi;
- separate acquiring references;
- separate settlement status;
- per-part refund method and limits;
- per-method cashier totals.

A child `payment_parts` model is required. Invariant: active part amounts must equal the parent payment amount, with each part containing method, reference, provider/terminal context, and settlement state as applicable.

Until then, `mixed` is operationally misleading and should not be used for production reporting.

## 18. Discounts

Two potential discount authorities exist:

1. `invoice_items.discount_amount` participates in invoice total recalculation.
2. `financial_adjustments.adjustment_type = 'discount'` exists but has no controlled lifecycle and is not included in invoice recalculation.

The application summary subtracts active adjustment discounts, creating a second calculation path that can disagree with stored invoice balance and double-discount if both are used.

Recommended authority:

- before issue: line-level discount on invoice item, with validation and reason/policy;
- after issue: approved compensating discount adjustment/credit note;
- never apply both for the same commercial decision;
- include approval thresholds, reason taxonomy, audit before/after, and reversal.

Current state: **unsafe model ambiguity; no production discount approval workflow**.

## 19. Corrections and surcharges

`financial_adjustments` supports `correction` and `surcharge`, but there are no RPCs or UI flows. Invoice recalculation ignores these rows, while patient summary counts active correction/surcharge amounts.

This makes the fields underused and inconsistent rather than operational.

Required use cases include:

- post-issue price correction;
- omitted charge;
- approved commercial correction;
- correction of non-clinical billing metadata;
- reversible debit/credit adjustment.

Any implementation must define sign semantics, invoice effect, approval, reversal, reason, and audit before/after. Generic positive `adjustment_amount` on an invoice item is insufficient for post-issue accounting.

## 20. Invoice corrections

Current issued invoice behavior is risky:

- `add_invoice_item` accepts both `draft` and `issued` invoices;
- there is no item edit, item void, credit note, debit note, or invoice revision RPC;
- the original issued amount is not preserved as an immutable snapshot;
- financial changes can be made without a formal correction document/state.

Recommended design:

- draft invoice remains editable;
- issued invoice becomes immutable in substance;
- corrections use compensating debit/credit entries or notes linked to the original invoice/line;
- clinical completed-service facts remain untouched;
- audit records before/after and reason;
- payment/write-off capacity is recalculated transactionally.

## 21. Payment corrections

Current correction mechanism is void and re-enter, subject to allocation/refund guards.

- wrong method: void/re-enter if no allocations/refunds;
- wrong amount: void/re-enter if no allocations/refunds;
- wrong patient: void/re-enter if no allocations/refunds;
- if money was actually returned, use refund, not void;
- if payment is already allocated, allocation must first be voided.

This is financially defensible but operationally manual and error-prone. A guided correction workflow should show required compensating steps and prevent staff from confusing payment void with refund.

Manual `record_payment` also lacks idempotency and is vulnerable to duplicate submission/retry outside the hardened cashier flow.

## 22. Refund limitations

The MVP deliberately refunds only currently unallocated funds. This avoids inventing an allocation-reversal model, but it limits ordinary clinic operation.

Future allocated refund needs:

- a link from refund to original allocation(s);
- proportional/explicit reversal amounts;
- atomic capacity checks;
- automatic invoice debt reopening for the reversed allocation amount;
- support for partial refund across multiple allocations;
- immutable completed refund and immutable reversal links;
- payment-part/provider-aware refund when mixed methods exist;
- audit of original and reopened invoice values.

A refund-allocation/reversal table is required. Automatically reopening debt is appropriate only for the linked reversed allocation, never as a generic refund side effect.

## 23. Write-off limitations

Current write-off transaction behavior is correct: approved write-off reduces debt without changing paid amount or creating payment, and void restores debt.

Governance gaps:

- requester may approve their own request;
- owner/admin have identical authority;
- no amount threshold;
- no owner-only large write-off;
- no reason taxonomy;
- no required attachment/evidence;
- reversal needs no second approval;
- no management report or anomaly detection;
- no collection/bad-debt state link.

Recommendation: require two-person approval for production, tenant-configurable thresholds, owner approval above threshold, structured reason, optional/required evidence, and dedicated reporting.

## 24. Insurance and OSMS

`insurance` and `osms` are accepted as payment methods. That is semantically unsafe for unpaid claims.

A claim is a receivable from a third party, not money received. Patient debt should not necessarily reduce on claim submission. Required states include:

- submitted;
- accepted/authorized;
- partially approved;
- denied;
- settled;
- reversed;
- patient responsibility transferred.

A payer/claim/remittance model is required. A `payment` should be created only when settlement money is received, or an explicitly documented accounting policy must distinguish provisional claim credit from cash settlement.

This domain requires a separate reconciliation task before implementation.

## 25. Cashier shifts

No shift model exists.

Missing:

- shift owner and terminal/location;
- opening cash balance;
- open/closed/approved status;
- payment-to-shift link;
- cash counted at close;
- expected cash;
- shortage/overage;
- cash-only, Kaspi, terminal, transfer totals;
- close approval and lock;
- payment entry policy outside an open shift;
- daily cashier report and immutable close snapshot.

Cashier shifts are mandatory before multi-clinic production cash operation. They are not required to define credit semantics, so they are not the immediate next task.

## 26. Finance reporting

| Report | Current possibility | Accuracy/readiness | Required source/read model |
|---|---|---|---|
| Daily payments | raw query possible | incomplete for shifts/provider settlement/mixed parts | payments + parts + shift |
| Payment methods | raw query possible | inaccurate for `mixed`; insurance/OSMS semantic risk | payment parts/claims |
| Cashier totals | impossible reliably | no shift/operator close | cashier shift ledger |
| Open debts | raw invoice query possible | invoice snapshots useful, but summary/read limits unsafe | authoritative debt view |
| Overdue invoices | technically possible | no classification/UI/index/collection status | due-date aging view |
| Patient credit | unsafe | semantics and summary formula unresolved | credit ledger/read model |
| Refunds | possible | unallocated-only; no provider settlement | refunds + payment/parts |
| Write-offs | possible | governance/report UI absent | approved/voided adjustments |
| Discounts | inaccurate | two authorities and no lifecycle | unified discount model |
| Voided payments | possible | no shift/provider context | payment + audit + shift |
| Voided invoices | possible | no correction-note context | invoice + correction model |
| Unallocated payments | possible | intent unknown | credit/deposit classification |
| Service revenue | possible but misleading | completed service, invoice, cash, and accrual definitions not fixed | service-to-invoice authoritative join |
| Doctor revenue | impossible reliably | doctor attribution/recognition rules absent | service attribution/read model |
| Clinic revenue | possible only by chosen definition | cash/accrual/refund/write-off semantics unresolved | reporting definitions/views |
| Cash vs accrual | impossible as formal report | no recognition policy/read models | accounting-period views |
| Audit anomalies | partial | events exist, before/after and structured categories incomplete | hardened audit read model |

The global Finance page is a placeholder. Reporting should use server-authoritative views/RPC read models. Materialized views are appropriate only for heavy tenant-period aggregates after authoritative source rules are fixed. Exports should be immutable snapshots.

## 27. Accounts receivable and debt aging

`due_date` exists and is displayed, but there is no operational A/R workflow.

Missing:

- overdue classification;
- aging buckets (for example current, 1–30, 31–60, 61–90, 90+);
- collection owner;
- collection status;
- promised payment date;
- structured debt notes;
- contact attempts/communication link;
- legal collection state;
- bad-debt/write-off relationship;
- tenant-level aging report and indexes.

This is important after summary correctness and invoice corrections are stable.

## 28. Multi-currency

Currency exists on every row, but the product is not multi-currency safe.

Findings:

- patient finance summary card hardcodes KZT;
- invoice creation hardcodes KZT;
- manual payment UI accepts currency;
- atomic cashier normalizes arbitrary non-empty currency;
- allocation copies payment currency but does not compare it to invoice currency;
- numeric payment amount can therefore reduce an invoice in another currency;
- refunds inherit payment currency and write-offs inherit invoice currency;
- there is no exchange-rate or conversion model.

Recommendation: enforce one configured currency per tenant for the current product and reject cross-currency operations at DB/RPC boundaries. Do not claim multi-currency support until FX rates, rounding, settlement, reporting, and gain/loss treatment exist.

## 29. Fiscal/provider readiness

The module is not ready for fiscal or payment-provider integration.

Current useful foundations:

- external reference fields;
- cashier idempotency;
- refund external reference;
- safe atomic money allocation;
- audit events.

Missing prerequisites:

- payment parts for mixed tenders;
- provider/acquirer transaction identifiers and status;
- webhook idempotency/inbox;
- settlement and reconciliation state;
- provider refund state and failure recovery;
- terminal/Kaspi/Halyk-specific references;
- fiscal receipt lifecycle, correction/return receipt, and receipt link;
- cashier shift link;
- immutable integration event history;
- claims model for insurance/OSMS;
- authoritative currency policy.

Provider integration must follow, not precede, credit, currency, mixed-payment, correction, and shift foundations.

## 30. Data invariants matrix

### Payments and allocations

| Invariant | Enforcement | Assessment |
|---|---|---|
| payment amount > 0 | DB check + RPC/client validation | enforced |
| active allocations + completed refunds + reserved refunds <= payment | DB allocation trigger + refund RPC locks/checks | enforced for controlled/direct DB writes except privileged bypass |
| payment tenant matches patient | composite DB FK | enforced |
| allocation tenant/patient matches payment | RPC validation plus FKs | mostly RPC; no composite payment FK for all fields |
| allocation currency matches payment | RPC copies payment currency | enforced in controlled RPC |
| allocation currency matches invoice | not checked | **not enforced, critical** |
| tenant idempotency for atomic cashier | unique index + fingerprint + advisory lock | enforced |
| manual payment idempotency | absent | not enforced |
| payment void restrictions | RPC + refund trigger | enforced |
| duplicate cashier operation | unique index + lock | enforced |

### Invoices and items

| Invariant | Enforcement | Assessment |
|---|---|---|
| total derived from active/adjusted items | recalculation RPC | enforced when recalculation invoked; direct privileged writes can bypass |
| paid derived from active allocations | recalculation RPC | enforced through controlled paths |
| written-off derived from approved write-offs | recalculation RPC | enforced |
| balance = total - paid - write-off | recalculation RPC | enforced |
| no negative balance | recalculation + DB non-negative snapshot | enforced |
| status consistent with amounts | recalculation RPC | enforced through controlled paths |
| item tenant/patient matches invoice | RPC validation is incomplete for direct insert; patient FK only | application/RPC-only |
| completed service belongs to invoice patient/tenant | RPC validation | RPC-only |
| completed service billed once | absent | **not enforced, critical** |
| allocation cannot exceed invoice balance | RPC + DB capacity trigger | enforced |
| write-off cannot exceed available balance | locked RPC checks | enforced |
| draft/issued rules | RPCs | partially enforced; item addition after issue remains allowed |

### Refunds

| Invariant | Enforcement | Assessment |
|---|---|---|
| pending/approved reserve capacity | RPC + capacity calculations/locks | enforced |
| completed immutable | RPC state machine | controlled-path enforced; no immutable DB trigger for privileged direct update |
| completed actor/timestamp required | DB checks | enforced |
| approved actor/timestamp required | DB checks | enforced |
| payment status reflects completed refunds | recalculation RPC | enforced on completion |
| currency inherited from payment | request RPC | enforced in controlled path |
| method consistent with original/provider | absent | not enforced |
| duplicate request protection | tenant key unique; partial semantic comparison | partially enforced; reason/metadata omitted |

### Write-offs

| Invariant | Enforcement | Assessment |
|---|---|---|
| active request reserves balance | RPC calculations/locks | enforced |
| approved affects debt | recalculation RPC | enforced |
| void approved restores debt | recalculation RPC | enforced |
| paid amount unchanged | recalculation formula/tests | enforced |
| no payment created | RPC scope/tests | enforced |
| actor/timestamp/reason integrity | DB/RPC, with rejected actor in metadata | mostly enforced |
| duplicate request protection | tenant key unique; partial semantic comparison | partially enforced |
| requester cannot approve | absent | not enforced |

Critical application-only or missing invariants are flagged above and must move into DB/RPC enforcement.

## 31. Security and role matrix

Legend: V = view, M = mutate, D = denied. Backend RPC/RLS is authoritative.

| Operation | Owner | Admin | Cashier | Doctor | Registrar | Unknown/no tenant |
|---|---:|---:|---:|---:|---:|---:|
| View invoices | V | V | V | D by RLS | V | D |
| View invoice items | V | V | V | D | D | D |
| Create invoice | M | M | M | D | D | D |
| Edit/add draft item | M | M | M | D | D | D |
| Add item to issued invoice | M | M | M | D | D | D |
| Issue invoice | M | M | M | D | D | D |
| Void invoice | M | M | D | D | D | D |
| View payments | V | V | V | D | V | D |
| Record payment | M | M | M | D | D | D |
| Allocate | M | M | M | D | D | D |
| Void allocation | M | M | D | D | D | D |
| Void payment | M | M | D | D | D | D |
| View refunds | V | V | V | D | D | D |
| Request refund | M | M | M | D | D | D |
| Approve/reject/void refund | M | M | D | D | D | D |
| Complete refund | M | M | M | D | D | D |
| View adjustments/write-offs | V | V | V | D | D | D |
| Request/approve/reject/void write-off | M | M | D | D | D | D |
| View reports | no implemented report permission | no implemented report permission | none | none | none | D |
| Export finance data | absent | absent | absent | absent | absent | D |

### Role mismatches

- UI `canView` includes doctor for the entire patient finance panel, but finance-table RLS excludes doctor.
- UI `canView` includes registrar, but registrar RLS permits only invoices and payments, while the panel concurrently loads items, allocations, refunds, and adjustments. One denied query fails the combined load.
- Refund/write-off UI view permissions include doctor/registrar, but corresponding RLS does not.
- Owner/admin distinctions are not represented in finance mutations.
- Cashier can create invoices, add lines, and issue invoices. That is operationally broad and may conflict with clinic separation-of-duty policy.
- Public finance RPCs have EXECUTE granted to `authenticated`, but each RPC performs tenant/role checks; internal helper execution is revoked. This is acceptable but must remain tested.
- Report/export permissions do not exist.

## 32. Audit completeness

| Event | Audit | Activity | Actor/tenant/patient | Financial references/amount | Before/after | Retry duplicate risk |
|---|---|---|---|---|---|---|
| invoice created | yes | yes | yes | invoice ID; limited metadata | after-only | create RPC not idempotent |
| item added | yes | yes | yes | invoice/item/service/amount | after-only | not idempotent; duplicate service possible |
| invoice issued | yes | yes | yes | invoice ID | status metadata | safe state check, but no immutable total snapshot |
| invoice voided | yes | yes | yes | invoice ID/reason | limited status metadata | state prevents repeat mutation |
| payment recorded | yes | yes | yes | payment/method/amount metadata | after-only | manual RPC duplicate risk |
| payment allocated | yes | yes | yes | payment/invoice/item/amount | after-only | lower-level RPC not idempotent; atomic cashier is |
| allocation voided | yes | yes | yes | allocation/payment/invoice/reason | limited transition | state prevents repeat |
| payment voided | yes | yes | yes | payment/reason | limited transition | state prevents repeat |
| atomic cashier | underlying events | underlying events | yes | operation key in metadata | no single operation before/after record | key retries do not duplicate writes/events |
| refund lifecycle | yes | yes | yes | refund/payment/amount/currency/reason/status | from/to status, no full before/after | request key partial; transition repeats mostly idempotent |
| write-off lifecycle | yes | yes | yes | adjustment/invoice/amount/currency/reason/status | from/to status, no full invoice before/after | request key partial; transition repeats mostly idempotent |

Audit strengths:

- append-only audit/activity infrastructure;
- tenant, actor, patient, target, payment, reason, metadata;
- financial visibility;
- safe search path and helper grants;
- idempotent cashier retry avoids duplicate events.

Audit gaps:

- category is `payment` with `domain=finance`, because a dedicated finance category does not exist;
- no typed invoice/refund/adjustment reference columns beyond generic target/metadata;
- no structured before/after/diff for key financial transitions;
- no shift, provider, claim, export, correction-note, or approval-chain events;
- rejected actor is metadata rather than a typed column;
- no anomaly read model.

Current audit can support a basic investigation or patient complaint, but cashier disputes, large write-off approval review, provider reconciliation, and cross-period financial reconstruction require harder structured evidence.

## 33. Performance and scale

### Existing strengths

- tenant-first indexes on core tables;
- payment method/date index;
- allocation and refund lookup indexes;
- bounded repository lists;
- invoice/payment row locks and stable cashier lock ordering;
- audit indexes by tenant, patient, actor, target, category, severity, and time.

### Risks

- patient summary loads six bounded lists and aggregates in application memory;
- patient finance UI loads summary plus the same facts again, producing duplicated queries;
- maximum 200 facts silently truncates summary/eligibility;
- refund/write-off controls can cause per-payment/per-invoice additional reads, creating N+1 behavior on long patient histories;
- no UI pagination despite bounded repository support;
- report queries would require full-table/large-tenant aggregation;
- no aging/read-model indexes.

### Candidate indexes/read models for future tasks

Do not add them in this report-only task, but review these query shapes:

- invoices `(tenant_id, patient_id, created_at DESC)`;
- invoice items `(tenant_id, patient_id, created_at DESC)`;
- payments `(tenant_id, patient_id, received_at DESC)`;
- allocations `(tenant_id, payment_id, allocated_at DESC)` and patient/date if needed;
- refunds `(tenant_id, patient_id, requested_at DESC)` and payment/date;
- adjustments `(tenant_id, patient_id, created_at DESC)` and invoice/type/status/date;
- overdue invoices `(tenant_id, status, due_date)`;
- tenant daily payment `(tenant_id, received_at, payment_method)` according to report plan;
- server-authoritative patient finance summary RPC/view;
- period reporting views/materialized views after definitions stabilize.

## 34. UX terminology review

| Term | Required meaning | Current issue/recommendation |
|---|---|---|
| Payment | money received | keep; do not use for claim submission |
| Allocation | where received money is applied | correct, but expose target and remaining unallocated amount more clearly |
| Debt/balance | amount currently owed from authoritative invoice facts | current patient summary is unsafe; label must not outrun formula |
| Refund | money actually returned only when completed | refund UI correctly distinguishes request/approval/completion |
| Write-off | debt forgiveness, not payment | current UI wording is correct |
| Discount | commercial price reduction | two possible authorities; unify |
| Void | invalidate an erroneous fact before/without actual return of money | distinguish clearly from refund/reversal |
| Archive | hide from active operation without changing financial meaning | schema supports but lifecycle/UI absent |
| Deposit/prepayment | money received for future purpose | no explicit meaning/model |
| Credit | available unallocated patient money after reservations | current derived label has no authoritative workflow |
| Invoice | financial charge/request | correct; must not imply treatment completion |
| Completed service | clinical/billable fact | optional link exists; duplicate billing guard missing |
| Mixed payment | one receipt composed of multiple method parts | currently only a label and misleading |
| Insurance/OSMS | claim/third-party receivable until settled | currently mislabeled as immediate payment method |

The UI should eventually provide a single understandable patient financial ledger explaining charge, payment, allocation, refund, write-off, correction, and remaining credit/debt.

## 35. Critical gaps

### FIN-CRIT-001 — Patient summary can report false debt or credit

- **Severity:** CRITICAL
- **Current behavior:** completed refunds are added to `amountDue`; summaries and eligibility are computed from capped application lists.
- **Business risk:** false patient debt, incorrect collection communication, false reports, or hidden credit.
- **Root cause:** preliminary client-side formula does not match the unallocated-only refund model and lacks authoritative unbounded aggregation.
- **Recommended solution:** define credit semantics, replace summary with server-authoritative read model, add invariant tests for refund/credit scenarios and large histories.
- **Dependencies:** PATIENT-CREDIT-DEPOSITS-RECON-001.
- **Suggested task:** `FINANCE-SUMMARY-CORRECTNESS-001`.
- **Layers:** migration/view or read RPC, repository, client, UI, tests.

### FIN-CRIT-002 — Cross-currency allocation is not blocked

- **Severity:** CRITICAL
- **Current behavior:** allocation copies payment currency but compares numeric amount with invoice balance without checking currency; cashier does the same.
- **Business risk:** one unit of one currency can reduce debt in another currency, corrupting balances irreversibly.
- **Root cause:** currency is arbitrary row text and no tenant/invoice/payment equality invariant exists.
- **Recommended solution:** enforce one currency per tenant for MVP; DB/RPC checks reject mismatch; add tests and normalize UI.
- **Dependencies:** tenant currency policy decision in this report.
- **Suggested task:** `FINANCE-SINGLE-CURRENCY-GUARD-001`.
- **Layers:** migration, RPC, client/UI validation, tests.

### FIN-CRIT-003 — Same completed service can be billed multiple times

- **Severity:** CRITICAL
- **Current behavior:** optional completed-service link is validated by tenant/patient but not unique.
- **Business risk:** duplicate patient charges and false service revenue.
- **Root cause:** no unique partial index or controlled rebilling/reversal model.
- **Recommended solution:** define one active billable invoice-item link per completed service, with explicit void/correction/rebill lifecycle.
- **Dependencies:** invoice correction rules.
- **Suggested task:** `COMPLETED-SERVICE-BILLING-GUARD-001`.
- **Layers:** migration, RPC, repository/UI feedback, SQL/TS tests.

## 36. High gaps

### FIN-HIGH-001 — Unallocated payment, credit, overpayment, and deposit semantics are undefined

- **Risk:** daily staff cannot safely accept or explain advance money; refund and summary behavior diverges by UI path.
- **Solution:** reconciliation decision followed by credit/deposit foundation and UI.
- **Suggested task:** `PATIENT-CREDIT-DEPOSITS-RECON-001`.

### FIN-HIGH-002 — Doctor/registrar UI permissions disagree with RLS

- **Risk:** failed finance panel reads, misleading “view allowed,” inconsistent tenant-role behavior.
- **Solution:** choose exact read policy per role, create role-specific read models or align UI/RLS, and add real RLS-backed tests.
- **Suggested task:** `FINANCE-ROLE-RLS-ALIGNMENT-001`.

### FIN-HIGH-003 — Issued invoice correction lifecycle is absent

- **Risk:** issued charges can change without immutable correction history.
- **Solution:** make issued facts immutable and use debit/credit notes or compensating adjustments.
- **Suggested task:** `INVOICE-CORRECTIONS-FOUNDATION-001`.

### FIN-HIGH-004 — Discount/correction/surcharge authorities conflict

- **Risk:** double discounting and disagreement between invoice balance and patient summary.
- **Solution:** unified pre-/post-issue adjustment policy and approved lifecycle.
- **Suggested task:** `DISCOUNTS-APPROVALS-001`.

### FIN-HIGH-005 — Allocated refunds are unsupported

- **Risk:** common refund requires manual allocation void, loses exact reversal linkage, and can reopen too much/wrong debt operationally.
- **Solution:** refund-allocation reversal model and atomic invoice reopening.
- **Suggested task:** `REFUND-ALLOCATED-FUNDS-FOUNDATION-001`.

### FIN-HIGH-006 — Mixed payment is a label without parts

- **Risk:** method totals, provider reconciliation, cash close, and refunds are false.
- **Solution:** payment-parts foundation.
- **Suggested task:** `MIXED-PAYMENTS-FOUNDATION-001`.

### FIN-HIGH-007 — Insurance/OSMS claims are modeled as received money

- **Risk:** patient debt/revenue can be reduced before payer settlement.
- **Solution:** claims/receivables reconciliation and model.
- **Suggested task:** `INSURANCE-OSMS-RECON-001`.

### FIN-HIGH-008 — No cashier shift or cash reconciliation

- **Risk:** no expected-vs-counted cash, shortage/overage, close approval, or accountable daily total.
- **Solution:** cashier shift foundation and UI.
- **Suggested tasks:** `CASHIER-SHIFTS-FOUNDATION-001`, then `CASHIER-SHIFTS-UI-001`.

### FIN-HIGH-009 — No authoritative reporting/read models or exports

- **Risk:** operational/management reports would depend on incomplete client lists and ambiguous definitions.
- **Solution:** server read models after critical semantics; immutable export snapshots.
- **Suggested task:** `FINANCE-REPORTING-READMODELS-001`.

### FIN-HIGH-010 — Write-off governance lacks separation of duties

- **Risk:** one admin can request, approve, and later reverse a write-off without threshold/evidence.
- **Solution:** two-person approval, tenant thresholds, owner escalation, taxonomy, evidence, reporting.
- **Suggested task:** `FINANCE-WRITEOFF-GOVERNANCE-001`.

### FIN-HIGH-011 — Audit lacks structured financial before/after evidence

- **Risk:** disputes and reconstruction rely on generic metadata rather than stable typed changes.
- **Solution:** finance category/reference fields or standardized metadata schema, before/after/diff, anomaly read model.
- **Suggested task:** `FINANCE-AUDIT-HARDENING-001`.

### FIN-HIGH-012 — Manual payment and lower-level writes lack operation idempotency

- **Risk:** retries outside cashier can duplicate money or allocations.
- **Solution:** idempotency/fingerprint for every externally initiated money mutation or restrict UI to atomic operations.
- **Suggested task:** `FINANCE-MUTATION-IDEMPOTENCY-001`.

## 37. Medium gaps

- **FIN-MED-001:** no guided payment correction flow; safe manual void/re-enter exists.
- **FIN-MED-002:** invoice/payment/allocation/refund/adjustment archive statuses lack controlled lifecycle.
- **FIN-MED-003:** no reason taxonomies for void/refund/write-off/correction.
- **FIN-MED-004:** no A/R aging, collection owner, promises, contact attempts, or legal state. Suggested `DEBT-AGING-COLLECTIONS-001`.
- **FIN-MED-005:** invoice number field has no generation/uniqueness policy.
- **FIN-MED-006:** no UI pagination and long patient histories are capped.
- **FIN-MED-007:** payment status is one-dimensional and can obscure combined allocation/refund history; facts remain available.
- **FIN-MED-008:** refund method is not constrained by original payment method/provider.
- **FIN-MED-009:** no immutable financial export snapshot.
- **FIN-MED-010:** no explicit installment/payment-plan model.
- **FIN-MED-011:** no dedicated cashier-operation audit record, only underlying events and metadata.

## 38. Low gaps

- Global Finance page is still a placeholder rather than navigation to operational finance functions.
- KZT is hardcoded in several UI surfaces while backend accepts arbitrary currency.
- Some finance labels do not clearly distinguish gross payments, allocated payments, available credit, and net cash.
- Archive terminology is visible in statuses without staff workflow.
- No contextual help explains payment void versus refund or invoice void versus write-off.
- No concise patient ledger/timeline visualization for balance explanations.

## 39. Decision records

### DR-01 — Should unallocated payment become patient credit?

- **Options:** ignore as incidental; store a separate credit amount; derive credit from payment/allocation/refund facts.
- **Recommendation:** derive patient credit from unallocated payment facts and explicit reservations; do not store a manually editable balance.
- **Reason:** preserves one money source of truth and supports later allocation/refund.
- **Risks:** existing summary semantics must change; migration/read-model work required.
- **Migration impact:** likely credit reservation/intent model and authoritative view/RPC.
- **Backward compatibility:** existing unallocated payments can be classified as general available credit after validation.

### DR-02 — Should deposits use payments or a separate model?

- **Options:** separate deposit-money table; payment only; payment plus deposit intent/reservation.
- **Recommendation:** payment remains the money fact; add separate deposit/prepayment intent/reservation linked to payment.
- **Reason:** avoids duplicate ledgers while distinguishing business purpose.
- **Risks:** reservation rules and treatment-plan links require careful lifecycle.
- **Migration impact:** new classification/reservation table or typed fields.
- **Backward compatibility:** existing unallocated payments remain valid, initially unclassified/general credit.

### DR-03 — Should mixed payments use payment parts?

- **Options:** metadata; one `mixed` label; child payment parts.
- **Recommendation:** child payment parts.
- **Reason:** method totals, references, settlement, refunds, and shifts require authoritative parts.
- **Risks:** parent/part sum and lifecycle complexity.
- **Migration impact:** `payment_parts`, constraints, RPC/UI/report updates.
- **Backward compatibility:** non-mixed historical payments map to one implicit part or remain parent-only under versioned reads.

### DR-04 — Should insurance/OSMS be payments or receivables?

- **Options:** immediate payment; provisional payment; claim/receivable with payment on settlement.
- **Recommendation:** claim/receivable; payment only on settlement.
- **Reason:** claim submission is not money received.
- **Risks:** patient-responsibility and authorization policies vary.
- **Migration impact:** payer/claim/remittance models.
- **Backward compatibility:** historical insurance/OSMS payments need classification as settled legacy facts.

### DR-05 — Should allocated refunds reopen invoice debt automatically?

- **Options:** never; manual allocation void first; atomic linked reversal.
- **Recommendation:** atomic reopening only for explicitly linked reversed allocations.
- **Reason:** preserves exact debt causality and prevents generic refund side effects.
- **Risks:** multi-allocation and write-off conflicts.
- **Migration impact:** refund-allocation/reversal model and RPC changes.
- **Backward compatibility:** current unallocated refunds remain unchanged.

### DR-06 — Is a refund-allocation table required?

- **Recommendation:** yes.
- **Reason:** partial/multi-invoice/mixed-method refund requires immutable linkage.
- **Risks:** reconciliation complexity.
- **Migration impact:** new table, capacity constraints, indexes, audit.
- **Backward compatibility:** nullable/no links for legacy unallocated refunds.

### DR-07 — Should discounts use invoice items or financial adjustments?

- **Options:** item only; adjustment only; stage-dependent split.
- **Recommendation:** item discount before issue; approved compensating adjustment after issue.
- **Reason:** preserves original issued facts while supporting commercial pricing.
- **Risks:** double application unless exclusive rules exist.
- **Migration impact:** adjustment lifecycle/recalculation and uniqueness/reference rules.
- **Backward compatibility:** existing item discounts remain; generic adjustment discounts must be reviewed before activation.

### DR-08 — Should write-offs require two-person approval?

- **Recommendation:** yes for production.
- **Reason:** debt forgiveness is a high-risk non-cash financial decision.
- **Risks:** small clinics need delegation/fallback policy.
- **Migration impact:** requester/approver constraints and approval state/history.
- **Backward compatibility:** existing approved write-offs remain valid legacy facts.

### DR-09 — Should large write-offs have thresholds?

- **Recommendation:** tenant-configurable thresholds with owner approval above threshold.
- **Reason:** proportional governance.
- **Risks:** configuration errors and emergency override.
- **Migration impact:** tenant finance policy and approval RPC rules.
- **Backward compatibility:** default threshold policy must be explicit.

### DR-10 — Should cashier shifts be introduced?

- **Recommendation:** yes before multi-clinic cash production.
- **Reason:** cash accountability cannot be reconstructed reliably from payment rows alone.
- **Risks:** operational adoption and late corrections.
- **Migration impact:** shifts, counts, variances, payment link, close snapshots.
- **Backward compatibility:** legacy payments can have null shift and be excluded/labeled in shift reports.

### DR-11 — Should reporting use views/materialized views/RPC read models?

- **Recommendation:** ordinary authoritative views/RPC read models first; materialized views only for heavy period aggregates.
- **Reason:** current client aggregation is bounded and unsafe.
- **Risks:** definition/version management.
- **Migration impact:** views/functions/indexes and permission model.
- **Backward compatibility:** repository can transition behind stable DTOs.

### DR-12 — Should one currency per tenant be enforced?

- **Recommendation:** yes for MVP/current production.
- **Reason:** no FX model exists and cross-currency allocation is currently unsafe.
- **Risks:** clinics needing real multi-currency require future expansion.
- **Migration impact:** tenant currency setting, checks/RPC validation, backfill validation.
- **Backward compatibility:** verify existing currencies before constraint.

### DR-13 — Should issued invoice corrections use compensating entries?

- **Recommendation:** yes.
- **Reason:** preserves issued history and separates financial correction from clinical facts.
- **Risks:** more visible documents/states.
- **Migration impact:** debit/credit note or correction-entry model and links.
- **Backward compatibility:** prevent new direct issued-line additions after rollout; retain historical lines.

### DR-14 — Should financial exports be immutable snapshots?

- **Recommendation:** yes.
- **Reason:** an exported report must be reproducible and auditable as of a time/version.
- **Risks:** storage/retention/privacy.
- **Migration impact:** export job/snapshot metadata, hash, actor, filters, as-of time.
- **Backward compatibility:** ad hoc current queries can remain for UI preview, not official export.

### DR-15 — Which events require before/after values?

Required for:

- invoice issue, void, and correction;
- line correction/void;
- allocation void/replacement;
- payment void/correction;
- every refund transition;
- every write-off transition and approval;
- cashier shift close/reopen;
- claim settlement/denial;
- provider/fiscal reconciliation corrections.

Create events may use after-only state. Idempotent retries must not duplicate events.

## 40. Dependency roadmap

Only evidence-supported tasks are recommended. Order matters.

| Order | Task ID | Purpose | Dependencies | Layers | Size | Operational value / risk reduced |
|---:|---|---|---|---|---|---|
| 1 | `PATIENT-CREDIT-DEPOSITS-RECON-001` | define unallocated payment, credit, deposit, reservation, refund semantics | this recon | report/recon | S | resolves the root meaning required by summaries, deposits, refunds, and reporting |
| 2 | `FINANCE-SUMMARY-CORRECTNESS-001` | authoritative unbounded debt/credit/read summary | task 1 | migration/read RPC, repository/client/UI/tests | M | removes false debt and truncation risk |
| 3 | `FINANCE-SINGLE-CURRENCY-GUARD-001` | tenant currency and cross-currency rejection | this recon | migration/RPC/client/UI/tests | S–M | prevents direct monetary corruption |
| 4 | `COMPLETED-SERVICE-BILLING-GUARD-001` | prevent duplicate billing of a completed service | correction policy decision | migration/RPC/UI/tests | M | prevents duplicate charges/revenue |
| 5 | `FINANCE-ROLE-RLS-ALIGNMENT-001` | align doctor/registrar UI, RLS, and read models | summary/read design | RLS/repository/UI/tests | S–M | eliminates failed/leaky role behavior |
| 6 | `INVOICE-CORRECTIONS-FOUNDATION-001` | immutable issued invoice and compensating entries | tasks 3–4 | migration/RPC/repository/client/tests | L | preserves historical invoice truth |
| 7 | `DISCOUNTS-APPROVALS-001` | one discount authority and approved post-issue flow | task 6 | all layers | L | prevents double discount/inconsistent balances |
| 8 | `REFUND-ALLOCATED-FUNDS-FOUNDATION-001` | linked allocation reversal and debt reopening | tasks 1–2, 6 | migration/RPC/repository/client/tests | XL | supports ordinary refunds safely |
| 9 | `MIXED-PAYMENTS-FOUNDATION-001` | payment parts and per-method references | tasks 1, 3 | migration/RPC/repository/client/UI/tests | L | makes mixed tender/refund/reporting truthful |
| 10 | `CASHIER-SHIFTS-FOUNDATION-001` | shifts, expected cash, close, variance | task 9 | migration/RPC/repository/tests | L | enables accountable cash operation |
| 11 | `CASHIER-SHIFTS-UI-001` | open/close/count/approve shift UI | task 10 | hooks/UI/tests | M | enables daily staff workflow |
| 12 | `FINANCE-WRITEOFF-GOVERNANCE-001` | two-person approval, thresholds, taxonomy/evidence | audit policy | migration/RPC/UI/tests | M–L | reduces unauthorized debt forgiveness |
| 13 | `FINANCE-AUDIT-HARDENING-001` | typed before/after evidence and finance events | correction/refund/shift designs | migration/helpers/read model/tests | M | improves disputes and investigations |
| 14 | `FINANCE-REPORTING-READMODELS-001` | tenant-period authoritative reports and export foundation | tasks 2–3, 6–13 as relevant | views/RPC/indexes/repository/tests | L | enables accurate operations/management reporting |
| 15 | `DEBT-AGING-COLLECTIONS-001` | overdue aging and collection workflow | task 14, correction model | migration/RPC/UI/tests | L | enables A/R management |
| 16 | `INSURANCE-OSMS-RECON-001` | define claim/payer/settlement architecture | tasks 2–3 | report/recon | M | prevents false payment/revenue semantics before claim implementation |

`FINANCE-MUTATION-IDEMPOTENCY-001` and invoice numbering should be folded into the relevant foundation tasks or scheduled immediately after task 2 if manual patient-finance payment entry remains enabled.

## 41. Pilot-clinic milestone

Current verdict: **NOT YET SAFE FOR PILOT AS A COMPLETE FINANCE MODULE**.

Minimum mandatory capabilities:

- correct authoritative patient debt/credit summary;
- explicit credit/deposit policy;
- cross-currency rejection and one tenant currency;
- duplicate completed-service billing guard;
- role/RLS alignment;
- invoice numbering and issued-invoice correction policy;
- manual payment idempotency or exclusive use of hardened cashier flow;
- clear restriction disabling unsupported mixed/insurance/OSMS semantics;
- tested daily operational reconciliation procedure;
- refund/write-off lifecycle already present;
- existing tenant isolation and audit retained.

A tightly controlled pilot could use only KZT, atomic cashier payments, no deposits/mixed/claims, and admin-reviewed corrections after the critical fixes above.

## 42. Multi-clinic production milestone

Current verdict: **NOT READY**.

Mandatory additions beyond pilot:

- cashier shifts and close approval;
- owner/admin separation and write-off thresholds;
- hardened audit before/after evidence;
- authoritative tenant reports and immutable exports;
- pagination and scale-safe read models;
- A/R aging/collections;
- finance configuration per tenant;
- operational correction/reversal workflows;
- monitoring/anomaly detection;
- documented retention and privacy controls;
- repeatable multitenant role/RLS tests.

## 43. Provider/fiscal readiness milestone

Current verdict: **NOT READY**.

Mandatory prerequisites:

- payment parts;
- provider/acquirer transaction model;
- webhook inbox/idempotency;
- settlement/reconciliation state;
- provider refund state linked to payment/refund parts;
- cashier shifts;
- single/multi-currency policy;
- invoice correction/return semantics;
- fiscal receipt, correction receipt, and return receipt lifecycle;
- immutable integration/audit events;
- claim/receivable model for insurance/OSMS.

## 44. Management reporting milestone

Current verdict: **NOT READY**.

Mandatory prerequisites:

- correct source definitions for debt, credit, discount, write-off, refund, cash, accrual, service revenue, and provider settlement;
- server-authoritative read models;
- period/date/index strategy;
- role-specific report permissions;
- immutable export snapshots;
- mixed-payment and shift facts;
- claim/insurance distinction;
- reconciliation and anomaly reports;
- tested historical reproducibility.

## 45. Recommended next task

**PATIENT-CREDIT-DEPOSITS-RECON-001**

Plain-language purpose: decide exactly what an unallocated payment means, when it becomes available patient credit, how deposits/prepayments are classified or reserved, and how later allocation/refund affects debt without creating a second money ledger.

Why it is first:

- it is the dependency root of the current critical summary defect;
- it determines how clinics accept advance money;
- it affects overpayments, refunds, cashier behavior, reporting, and future provider flows;
- it is a focused reconciliation task rather than premature implementation;
- currency and duplicate-billing guards can then proceed in parallel once this semantic root is fixed.

Expected output: report/decision record only, followed by separately scoped foundation and UI tasks if approved.

## 46. Final verdict

**FINANCE OPERATIONS RECONCILED**

The review is complete. The current finance module has a strong controlled transaction foundation but is not yet safe to describe as operationally complete. Critical and high-priority gaps, explicit architecture decisions, milestone requirements, and a dependency-ordered roadmap are documented above.

## Checks

- Baseline and merged PR #335: verified.
- Finance migrations reviewed: 4/4.
- Finance table/RLS/index/constraint inventory: completed.
- Finance RPC inventory: completed.
- Repository/client/hooks/UI review: completed.
- Finance TypeScript, SQL, and concurrency test coverage review: completed.
- Security, tenant, role, and audit review: completed.
- Browser smoke: not run; forbidden and unnecessary for this report-only task. Existing scoped browser reports were reviewed.
- Direct database mutations: none.
- Cloud Supabase: not touched.
- Report validator: passed with 0 errors and 0 warnings for PR #336.
- GitHub Actions: CI #662 / run `29098542205` passed on `209814b22895dc8d5021d0f9860cad328000912f`.

## Browser smoke

- New browser smoke was not run because this is a report-only task and browser fixture creation is forbidden.
- Existing patient-finance, cashier, refund, write-off, role, no-tenant, and cross-tenant browser evidence in the reviewed reports was reconciled.
- No new database fixture was created and no cleanup was required.

## Issues / warnings

- This is a static architecture reconciliation of the exact baseline. It does not claim new runtime implementation validation.
- The report intentionally identifies defects and risks without changing code or SQL.
- Existing scoped reports marked their own work complete; this report evaluates the combined module and therefore may classify cross-feature behavior as incomplete or unsafe.
