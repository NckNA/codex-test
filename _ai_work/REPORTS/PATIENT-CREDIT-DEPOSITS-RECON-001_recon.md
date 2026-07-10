# PATIENT-CREDIT-DEPOSITS-RECON-001

Final verdict: **PASS**

## Summary

Report-only reconciliation of patient-held funds: unallocated payments, patient credit, overpayments, prepayments, deposits, reservations, refunds, later allocation, reporting, roles, security, and migration implications.

The recommended model keeps `payments` as the only authoritative fact that money was received. General patient credit is derived from the unallocated remainder of valid payments. A deposit is not a second money ledger; it is a reservation/intention attached to a payment that removes part of that payment from generally available credit until the reservation is used or explicitly released.

## 1. Executive summary

The current finance implementation can record money without an invoice, allocate it later, refund unallocated money, and preserve invoice/payment history. It does not yet define the business meaning of unallocated money.

The current patient summary is not merely incomplete. It is financially misleading in two independent ways:

1. unallocated payment amounts are not included in `creditAmount`, so actual patient credit is normally invisible;
2. completed refunds are added to `amountDue`, so refunding unallocated money can create false patient debt even though no invoice was reopened.

The current client-side summary also silently reads at most 200 facts from each table. A patient with a longer history can receive a mathematically valid calculation over an incomplete dataset, which is the most dangerous kind of wrong answer because it arrives wearing a tie.

The recommended authoritative model is:

- `payments` remain the receipt-of-money source of truth;
- `payment_allocations` remain the application-of-money source of truth;
- `refunds` remain the return-of-money source of truth;
- patient debt is derived from active invoice balances;
- gross unallocated funds are derived per payment;
- pending/approved refunds reserve unallocated funds for return;
- a new payment-linked reservation model records deposit purpose and blocks reserved funds from unrelated allocation/refund;
- patient available credit is derived, never stored in `patients.balance`;
- reservation use is represented by controlled allocation linked to the reservation;
- reservation release is explicit and auditable;
- forfeiture and automatic expiry are not supported in the MVP because they require legal and accounting rules beyond a payment status change;
- cross-patient and cross-clinic transfer are forbidden;
- debt, available credit, and reserved funds are displayed separately by currency;
- no silent automatic allocation is permitted.

The dependency root is **FINANCE-SUMMARY-CORRECTNESS-001**. New deposit features must not be built on a summary that hides real credit, invents debt after refunds, and truncates facts.

## 2. Branch

`recon/patient-credit-deposits-recon-001`

Required baseline:

`87f0b45c2cb8c3f11ca5d1688c2f7a97b17309c3`

Verified before work:

- `origin/main` exactly matched the required baseline;
- PR #336 was merged into `main` with merge commit `87f0b45c2cb8c3f11ca5d1688c2f7a97b17309c3`;
- the source working tree was clean;
- this branch was created from current `origin/main`.

## 3. PR URL

Not created yet.

## 4. PR head reviewed before final report update

Not available before PR creation.

## 5. Report update commit

N/A because the final report update commit cannot reference itself before creation.

- Report update commit: N/A (the report commit cannot reference itself; use the finalization receipt).
- The final report-only commit and fresh CI run must be recorded in the PR body, finalization receipt, and final task response.

## 6. Changed files

Exactly one file is permitted and created by this task:

- `_ai_work/REPORTS/PATIENT-CREDIT-DEPOSITS-RECON-001_recon.md`

No SQL, migrations, TypeScript, React, tests, seed, generated types, fixtures, cloud resources, or HEP-V2 files are changed.

## 7. Sources reviewed

### Reports

- `_ai_work/REPORTS/FINANCE-OPERATIONS-RECON-001_recon.md`
- `_ai_work/REPORTS/PAYMENTS-DEBTS-RECON-001_finance_model.md`
- `_ai_work/REPORTS/PAYMENTS-DEBTS-SCHEMA-001A_schema.md`
- `_ai_work/REPORTS/PAYMENTS-DEBTS-RPC-001C_rpc.md`
- `_ai_work/REPORTS/PATIENT-FINANCE-UI-001_ui.md`
- `_ai_work/REPORTS/CASHIER-PAYMENT-FLOW-HARDENING-001_hardening.md`
- `_ai_work/REPORTS/REFUNDS-WRITEOFFS-FOUNDATION-001_foundation.md`
- `_ai_work/REPORTS/REFUNDS-WRITEOFFS-UI-001_ui.md`
- security/RLS reconciliation and hardening reports;
- audit/activity reports and role-boundary reports.

### Schema and RPC

- `supabase/migrations/0016_create_finance_model.sql`
- `supabase/migrations/0017_create_finance_rpc.sql`
- `supabase/migrations/0018_create_refund_writeoff_rpc.sql`
- `supabase/migrations/0019_harden_cashier_payment_flow.sql`
- no later finance migration exists at this baseline.

### Application code

- `src/data/repositories/FinanceRepository.ts`
- `src/data/repositories/FinanceRpcClient.ts`
- `src/data/hooks/usePatientFinance.ts`
- `src/data/hooks/useCashierPaymentFlow.ts`
- `src/data/hooks/usePaymentRefundFlow.ts`
- finance/cashier permission helpers;
- payment, allocation, refund, cashier, and patient-summary UI;
- finance labels and status mapping;
- TypeScript finance tests;
- SQL finance tests and concurrency scripts.

## 8. Current unallocated-money behavior

### Core current formulas

Current payment refundability is calculated per payment as:

```text
payment amount
- active allocations
- completed refunds
- pending/approved refund reservations
```

Current payment status is recalculated from active allocations and completed refunds only. Reservation/deposit purpose does not exist.

Current patient summary uses:

```text
amountDue = invoice totals
          + surcharge adjustments
          + correction adjustments
          + completed refunds
          - active allocations
          - discounts
          - approved write-offs
```

It does not subtract gross payments or unallocated payment remainders. Therefore unallocated payment normally does not create `creditAmount` at all.

### Scenario inventory

| # | Scenario | Current database and statuses | Current summary/UI | Refundability/reporting/audit | Missing rule |
|---|---|---|---|---|---|
| 1 | Payment equals invoice balance | Cashier/manual flow records payment and active allocation. Payment becomes `allocated`. Invoice becomes `paid`. | Debt becomes 0. Allocated amount is shown. Credit remains 0. | Refundability is 0 because all money is allocated. `payment_recorded` and `payment_allocated` events exist; cashier may also issue a draft invoice. | Cash receipt is still not service revenue/fiscal settlement; no deposit issue. |
| 2 | Payment is less than invoice balance | If the whole payment is allocated, payment status is `allocated` even though the invoice is `partially_paid`. | Remaining invoice balance appears as debt; credit 0. Payment badge alone can mislead because “allocated” does not mean invoice fully paid. | Refundability 0 for the allocated payment. Audit records receipt/allocation. | UI must explain payment utilisation separately from invoice settlement. |
| 3 | Payment exceeds selected invoice balance | Atomic cashier RPC rejects before payment insert. Manual `record_payment` can accept 100,000 and later allocate only 80,000, leaving 20,000. Payment becomes `partially_allocated`; invoice becomes `paid`. | The 20,000 remainder is not included in current `creditAmount`; payment list shows the original 100,000 but no authoritative available-credit line. | The 20,000 is refundable and allocatable. Reports cannot distinguish intentional overpayment from accidental remainder. | Explicit overpayment confirmation, credit calculation, purpose, threshold, and cashier UX. |
| 4 | Payment recorded without allocation | `payments` row with status `received`; no allocation and no invoice change. | Payment history shows money received. Summary “allocated/paid” remains 0 and available credit remains 0, so the patient-held money is effectively hidden from the summary. | Entire amount is refundable. Only `payment_recorded` audit event explains it. | Intent: general credit, prepayment, accidental duplicate, deposit, or third-party money. |
| 5 | Allocation is voided | Allocation becomes `voided`; payment is recalculated to `received` or `partially_allocated`; invoice debt reopens. | Debt increases. The released payment remainder still is not shown as available credit. | Refundability increases. `payment_allocation_voided` event records reason and actor. | Guided correction/reallocation and visible restored credit. |
| 6 | Invoice is voided after payment | Invoice void is blocked while active allocations exist. Admin must void allocation first; then invoice can be voided. Payment remains received/unallocated. | Voided invoice is excluded from active invoice totals; restored money is not shown as credit. | Payment becomes refundable/allocatable after allocation void. Audit contains allocation void and invoice void. | Guided atomic correction and explicit retained-credit decision. |
| 7 | Payment is partially refunded | Only unallocated capacity can be refunded. Refund goes pending → approved → completed. Payment status becomes `partially_refunded`, even if another part remains allocated. | Completed refund is added to `amountDue`, so false debt may appear. Remaining unallocated credit is still invisible. | Refundability decreases by completed and pending/approved refund amounts. Full lifecycle audit exists. | Refund must reduce credit only unless linked allocation reversal reopens an invoice. |
| 8 | Payment is fully refunded | Unallocated payment is fully returned. Payment status becomes `refunded`; completed refund is immutable. | No invoice should change, but current summary can display debt equal to the refund amount. | Refundability 0. Refund history and audit are complete. | Correct server summary and explicit statement that returned unallocated money does not create debt. |
| 9 | Unallocated funds are later allocated | Existing `received` or `partially_allocated` payment is selected and allocated to an issued/partially paid invoice. Payment status becomes `partially_allocated` or `allocated`; invoice debt decreases. | Debt decreases. Any remaining unallocated credit is still invisible. | Refundability decreases. `payment_allocated` audit exists. | “Use credit” workflow, deterministic source selection, reservation checks, currency guard. |
| 10 | Payment remains unallocated indefinitely | Payment remains `received` or `partially_allocated`; no expiry, classification, reservation, or escalation. | Payment list preserves the fact; summary does not show the available amount. | It remains refundable/allocatable indefinitely unless voided/archived. No credit aging or liability report exists. | General legacy-credit classification, aging, statement, reservation policy, and operational review. |

### Additional status ambiguity

The payment status precedence is:

1. fully refunded;
2. partially refunded;
3. fully allocated;
4. partially allocated;
5. received.

Therefore one status cannot explain a payment that is partly allocated, partly refunded, partly reserved, and partly available. Status must remain a coarse lifecycle indicator; authoritative utilisation components must be returned separately.

## 9. Terminology definitions

| Term | Exact meaning | Separate financial fact? | Derived? | Dedicated table? | Invoice/revenue effect | Refund/allocation/expiry |
|---|---|---|---|---|---|---|
| Unallocated payment | Received money not currently consumed by active allocations or completed refunds. | No new fact; it is the remainder of a payment. | Yes, per payment. | No. | Does not reduce debt until allocated and is not earned revenue merely because received. | Refundable/allocatable subject to refund reservations, deposit reservations, status, tenant, patient, and currency. No automatic expiry. |
| Patient credit | Generally available unallocated received money that may be explicitly applied to future eligible invoices or returned. | No. | Yes. | No credit ledger. | No invoice effect until allocation; liability/patient-held funds for reporting. | Refundable and allocatable. Currency-specific. |
| Overpayment | Money received above the amount intentionally applied to current selected invoices. | Receipt remains a payment; overpayment is an origin/intent classification. | Remainder is derived. | No separate money table; intent metadata or controlled receipt intent. | Allocated part reduces debt; remainder becomes general credit. | Refundable or later allocatable. Must require explicit confirmation. |
| Prepayment | Money intentionally received before an invoice or charge exists. | Payment is the money fact; prepayment is receipt intent. | Available amount derived. | No separate money table. Optional reservation row if purpose-bound. | No debt reduction and no revenue recognition until later allocation/earned-event rules. | General prepayment is refundable/allocatable; reserved prepayment follows deposit rules. |
| Deposit | Received money intentionally held for a stated future purpose. | Payment remains money fact; reservation is a separate non-cash financial-control fact. | Remaining reserved amount partly derived. | Yes: payment-linked reservation/intention table. | No invoice effect until controlled allocation; not revenue merely on receipt. | Not generally allocatable/refundable while reserved. No automatic forfeiture. |
| Reservation deposit | Deposit reserved for an appointment, treatment plan, service category, case, or other controlled purpose. | Reservation fact. | Remaining/used amounts derived from reservation, linked allocations, releases, and linked refund reservations. | Same reservation model. | Only a purpose-compatible confirmed allocation reduces invoice debt. | Release before general allocation/refund, or atomic cancel-and-refund. |
| Refundable balance | Credit currently eligible for a refund request after subtracting allocations, completed refunds, pending/approved refund reservations, and active deposit reservations. | No. | Yes. | No. | No invoice effect for unallocated refunds. | Eligible for existing refund lifecycle. |
| Reserved credit | Received unallocated money blocked for a defined future purpose. | Reservation fact plus derived remaining capacity. | Yes for current remaining amount. | Reservation table plus controlled lifecycle/audit. | No invoice effect until reservation-backed allocation. | Not generally allocatable/refundable. Explicit release required. |
| Expired deposit | A reservation whose policy date passed. | Not supported as an automatic terminal money fact in MVP. | Date condition may be derived. | `expires_at` may be stored for notification only. | No automatic revenue/debt effect. | Requires explicit release/extension decision. |
| Forfeited deposit | A future explicit decision that patient-held money is no longer refundable/available under a lawful policy. | Would require a distinct approved accounting/legal fact. | No. | Deferred; not represented merely by reservation status. | Must define accounting destination and tax/legal treatment. | Unsupported in MVP. |
| Credit transferred between invoices | Existing payment allocation is voided/reversed and new allocation is created, preferably atomically. | Allocations/reversals are the facts. | No. | No credit-transfer ledger. | Reopens one invoice and reduces another. | Same patient, tenant, and currency only. |
| Credit returned to patient | Completed refund against currently free unallocated payment capacity. | Refund fact. | No. | Existing `refunds`; future reservation linkage where needed. | Does not create debt unless an explicitly linked allocation reversal occurs. | Completed refund is immutable. |

## 10. Model options

### Option A — Every unallocated payment is patient credit

**Source of truth:** payments, allocations, and refunds only.

**Advantages:** minimal migration; existing money facts remain authoritative; easy refund and later allocation; all legacy unallocated remainders can be interpreted consistently.

**Risks:** purpose cannot be explained; money cannot be reserved; accidental overpayment and intentional implant/appointment deposit are indistinguishable; appointment staff cannot know whether a specific case is secured.

**Migration:** no schema required for general credit, but a server read model is still required.

**Backward compatibility:** excellent.

**Audit/reporting:** cash and general credit can be explained, but purpose-specific liability cannot.

**Concurrency:** existing payment/allocation/refund capacity checks are reusable.

**Conclusion:** necessary default rule, insufficient as the complete model.

### Option B — Payments authoritative plus deposit/credit intent reservation

**Source of truth:** payments for received money; allocations for use; refunds for return; payment-linked reservations for purpose and blocked capacity.

**Advantages:** no duplicate money ledger; supports general credit and purpose-specific deposits; reservation release does not invent cash movement; compatible with existing allocation/refund lifecycle; strong reporting of held funds.

**Risks:** additional lifecycle and locking; allocation/refund must subtract remaining reservations; reservation use must be linked to allocation; release/refund must avoid double consumption.

**Migration:** new reservation table, optional reservation link on allocation/refund or junctions, constraints/triggers/RPCs/read models.

**Backward compatibility:** existing unallocated payments become general legacy credit; reservation table starts empty; no historical purpose is invented.

**Audit/reporting:** strongest balance of explainability and non-duplication.

**Concurrency:** requires payment row locking, stable lock order, idempotency, and database capacity guard.

**Conclusion:** recommended.

### Option C — Separate patient-credit ledger

**Source of truth:** would duplicate payment/allocation/refund facts with credit/debit ledger entries.

**Advantages:** explicit movements and potentially strong statements.

**Risks:** two sources of truth; every payment/allocation/refund must synchronize another ledger; reconciliation drift; correction complexity; risk that one tenge exists as both payment remainder and ledger credit.

**Migration:** large backfill and reconciliation; every finance RPC must change.

**Backward compatibility:** difficult because historical entries must be synthesized.

**Audit/reporting:** potentially rich but only if perfect synchronization is maintained.

**Concurrency:** high risk of partial writes and duplicate credit.

**Conclusion:** reject for MVP and current architecture.

### Option D — Deposits table contains money independently from payments

**Source of truth:** ambiguous because money would exist in both `payments` and `deposits`, or payment would be bypassed.

**Advantages:** superficially simple deposit UI and statuses.

**Risks:** duplicates receipt facts; unclear refunds/provider settlement; daily cash may disagree with deposits; audit and fiscal integrations do not know which money table is authoritative.

**Migration:** major and unsafe.

**Backward compatibility:** poor.

**Audit/reporting:** ambiguous cash receipt totals and liability.

**Concurrency:** separate capacities can double-spend money.

**Conclusion:** reject.

### Comparative recommendation

| Criterion | A | B | C | D |
|---|---|---|---|---|
| One money source of truth | Strong | Strong | Weak | Weak |
| General credit | Strong | Strong | Strong | Partial |
| Purpose reservation | None | Strong | Possible | Strong but duplicated |
| Legacy compatibility | Strong | Strong | Weak | Weak |
| Auditability | Medium | Strong | Strong only with perfect sync | Weak/ambiguous |
| Refund integration | Strong | Strong with release/link | Complex | Ambiguous |
| Concurrency risk | Low | Medium/manageable | High | High |
| Recommendation | Baseline rule only | **Selected** | Reject | Reject |

## 11. Recommended domain model

### Authoritative facts

1. `payments`: money actually received.
2. `payment_allocations`: money applied to an invoice or item.
3. `refunds`: money reserved for return and ultimately returned.
4. `invoices`: charges/debt requests.
5. `financial_adjustments`: debt decisions such as approved write-off; never a source of patient credit.
6. New `patient_fund_reservations`: purpose and blocked capacity attached to one payment.
7. Optional append-only reservation release/action facts or equivalent immutable audit-backed release records.

### Proposed reservation entity

Conceptual fields:

- `id`;
- `tenant_id`;
- `patient_id`;
- `payment_id`;
- `purpose_type`;
- `appointment_id` nullable;
- `treatment_plan_id` nullable;
- `purpose_label_snapshot` or note;
- `original_amount`;
- `status`;
- `expires_at` nullable and informational for MVP;
- `created_by`, `created_at`;
- `released_by`, `released_at`, `release_reason` where terminal release occurs;
- `idempotency_key` and request fingerprint;
- metadata limited/sanitized consistently with finance RPCs.

A reservation row references exactly one payment. One payment may fund several reservations if total remaining reservation capacity fits. A conceptual treatment deposit spanning several payments is represented by several reservation rows sharing the same purpose/reference; a multi-payment reservation aggregation entity is deferred unless real workflows require it.

### Reservation consumption

A future reservation-backed allocation must carry `reservation_id` or use an immutable reservation-to-allocation junction. The reservation and allocation must reference the same payment, tenant, patient, and currency.

The reserved remaining amount is reduced only by:

- active allocations linked to that reservation;
- an explicit release of the unused remainder;
- a linked refund reservation/completed refund through a controlled cancel-and-refund workflow.

### No separate patient credit row

General credit is a read model over payment capacity. Storing a patient-level credit number would drift from allocations/refunds/reservations and recreate the abandoned `patients.balance` problem under a more fashionable name.

## 12. Source-of-truth rules

1. A payment proves receipt of money, not treatment completion or earned revenue.
2. Allocation proves application of received money to a charge.
3. Unallocated money remains patient-held funds.
4. General credit is derived from unallocated unreserved capacity.
5. A reservation changes availability, not cash received.
6. Deposit receipt is not revenue by itself.
7. Debt is derived from issued/partially-paid invoice balances, not from payment status.
8. Write-off reduces debt but cannot create patient credit.
9. Refund reduces patient-held funds and cash; it does not increase debt unless an explicitly linked allocation reversal reopens a charge.
10. `patients.balance` is never authoritative.
11. Credit is patient-, tenant-, and currency-specific.
12. Cross-patient and cross-clinic transfer are forbidden.
13. Historical corrections use void/reversal/reallocation or explicit reservation actions, never silent row rewriting.
14. UI and reports must separate cash received, cash allocated, debt, available credit, and reserved funds.

## 13. Credit formulas

All formulas are calculated per tenant, patient, payment, and currency. Values must never be netted across currencies.

### Per-payment components

Eligible payment statuses for capacity calculations are all non-voided, non-archived payments. A `refunded` payment naturally contributes zero available capacity when completed refunds equal its amount.

```text
active_allocated(p)
  = sum(active payment_allocations for payment p)

completed_refunded(p)
  = sum(completed refunds for payment p)

refund_reserved(p)
  = sum(pending + approved refunds for payment p)

gross_unallocated(p)
  = max(0, payment.amount
           - active_allocated(p)
           - completed_refunded(p))

active_deposit_reserved(p)
  = sum(remaining amount of active/partially_used fund reservations for payment p)

available_credit(p)
  = max(0, gross_unallocated(p)
           - refund_reserved(p)
           - active_deposit_reserved(p))
```

### Patient totals per currency

```text
gross_unallocated_funds
  = sum(gross_unallocated(p))

reserved_for_refund
  = sum(refund_reserved(p))

reserved_deposit_funds
  = sum(active_deposit_reserved(p))

available_credit
  = sum(available_credit(p))

refundable_credit
  = available_credit
```

For MVP, general available credit is refundable. Reserved deposit funds are excluded until release. Future tenant policy may restrict refund timing, but it must not silently change the arithmetic.

### Linked and arbitrary-use credit

```text
credit_linked_to_future_treatment
  = reserved_deposit_funds

credit_eligible_for_arbitrary_invoice_allocation
  = available_credit
```

### Expired and forfeited funds

```text
expired_funds = 0 in MVP authoritative accounting
forfeited_funds = 0 in MVP authoritative accounting
```

An `expires_at` date may drive a review queue but not an automatic money transformation. Forfeiture requires a future explicit approved accounting/legal fact.

### Critical capacity invariant

Per payment:

```text
active allocations
+ completed refunds
+ pending/approved refund reservations
+ active remaining deposit reservations
<= payment amount
```

This invariant must be enforced in the database, not merely in React.

## 14. Debt and net-position formulas

### Debt

```text
patient debt
  = sum(balance_amount of invoices
        where tenant/patient/currency match
        and status in ('issued', 'partially_paid'))
```

Draft invoices are not debt. Paid, voided, archived, and fully written-off invoices contribute zero. Partial write-offs remain represented through the recalculated invoice balance/status.

Completed refunds of unallocated money do not enter debt.

An allocated refund may reopen debt only through an explicit immutable link to reversed allocation(s), and only by the linked reversed amount.

### Net position

```text
net position = available credit - debt
```

Net position is informational and must be calculated separately for each currency.

### UI decision

Primary display:

- **Debt**;
- **Available credit**;
- **Reserved**.

Optional secondary display:

- **Net position**, clearly labelled and never used instead of debt/credit.

Do not show one generic signed “Balance” number. Humans disagree about whether minus means debt or credit with a consistency normally reserved for printer drivers.

## 15. Payment status implications

Current statuses remain useful as coarse payment lifecycle/utilisation indicators:

- `received`;
- `partially_allocated`;
- `allocated`;
- `partially_refunded`;
- `refunded`;
- `voided`;
- `archived`.

They are not sufficient to represent all utilisation dimensions.

Decisions:

- `received` means no active allocation and no completed refund. It does not automatically prove all money is generally available because reservations or pending refunds may exist.
- part allocated + part reserved remains `partially_allocated`;
- part allocated + part refunded remains `partially_refunded` under current precedence;
- a fully reserved deposit does not require a new payment status;
- reservation purpose/state belongs to the reservation model;
- payment status should continue to be derived from allocation/refund totals for backward compatibility;
- authoritative read models must additionally return allocated, completed-refunded, refund-reserved, deposit-reserved, and available components.

Longer-term cleanup may split payment validity (`received/voided/archived`) from utilisation projection, but this is not required for the first deposit implementation.

## 16. Deposit lifecycle

### States evaluated

| State | MVP decision | Meaning |
|---|---|---|
| `active` | Keep | Full unused reservation remains blocked. |
| `partially_used` | Keep | Some reserved money has active linked allocations; remainder is still reserved. |
| `fully_used` | Keep | All reserved amount is represented by active linked allocations. |
| `released` | Keep | Unused remainder was explicitly released to general available credit. |
| `refunded` | Keep only through controlled linked flow | Reserved amount was released/cancelled and returned through refund lifecycle. |
| `forfeited` | Defer | Requires legal/accounting policy, approval, and destination fact. |
| `expired` | Do not make automatic terminal state | Date may trigger review; no money movement or revenue effect occurs automatically. |
| `archived` | Keep | Administrative hiding only after terminal lifecycle; does not alter money. |

### Allowed transitions

```text
active -> partially_used -> fully_used
active -> released
partially_used -> released (release unused remainder)
active/partially_used -> refund workflow -> refunded
terminal -> archived
```

Allocation void from a reservation-backed allocation restores the amount to that same active reservation unless the reservation was already terminal, in which case the operation must fail or use a controlled correction workflow.

### Creation

- owner/admin/cashier may record a prepayment and create a reservation through one atomic RPC;
- cashier reservation creation may be limited by tenant policy and threshold;
- reason/purpose is mandatory for a reserved deposit;
- idempotency key is mandatory.

### Release

- owner/admin may release the unused remainder;
- cashier cannot release a reservation in MVP;
- release reason is mandatory;
- release is not silently reversible; a new reservation must be created if money is reserved again;
- large releases may require owner confirmation in a later policy task.

### Allocation/use

- owner/admin/cashier may allocate reserved funds to an eligible invoice after explicit confirmation;
- purpose/reference compatibility must be validated where a reliable project entity exists;
- no automatic allocation on appointment completion or treatment completion.

### Expiry and appointment cancellation

- `expires_at` is informational and may generate a task/alert;
- no automatic release, refund, or forfeiture;
- appointment cancellation may suggest a financial action but must not mutate reservation/payment automatically;
- explicit finance action remains required.

### Forfeiture

Unsupported in MVP. A future design must define contract/legal basis, approval separation, tax/revenue treatment, reversal, reporting, and patient statement wording before any `forfeited` transition is permitted.

## 17. Prepayment workflow

Recommended workflow:

1. Staff chooses **Accept prepayment**, not **Accept invoice payment**.
2. Patient and active tenant are fixed before data entry.
3. Staff enters amount, method, currency, payer, reference, date, and optional purpose.
4. A controlled idempotent RPC records the payment.
5. If no purpose reservation is selected, the entire free amount becomes general available credit.
6. If a reservation is selected, payment and reservation are created atomically.
7. No invoice, completed service, appointment, treatment plan, document, stock, or `patients.balance` row is mutated.
8. Summary refresh shows cash received, available credit, and reserved funds separately.
9. Later, an invoice is created/issued.
10. Staff chooses **Use credit**.
11. UI proposes eligible same-currency credit sources in deterministic oldest-received order.
12. User reviews exact source payments/reservations and confirms.
13. One controlled atomic allocation operation creates allocations.
14. Invoice balance and payment statuses recalculate.
15. Remaining credit stays visible.
16. Audit records the receipt, reservation if any, allocation, source payments, invoice, actor, reason, and before/after components.

Allocation must never happen silently. The system may suggest FIFO sources, but the exact source composition must be shown and explicitly confirmed.

## 18. Overpayment workflow

Example:

- invoice debt: 80,000 ₸;
- received: 100,000 ₸;
- allocated: 80,000 ₸;
- available credit: 20,000 ₸.

### Cashier decision

Default behavior remains rejection when payment exceeds selected invoice debt.

Future cashier may allow overpayment only when all of the following are true:

1. the user explicitly selects **Leave remainder as available credit**;
2. UI shows the exact received/applied/remainder split;
3. the payment and invoices use the same tenant currency;
4. an idempotency key and material fingerprint are used;
5. backend atomically records the payment, allocates selected debt, and leaves the remainder unallocated;
6. the result explicitly returns available credit created;
7. audit contains the confirmed overpayment amount and actor.

Recommended threshold policy:

- explicit confirmation is always required;
- ordinary small remainder needs no approval, but may accept an optional note;
- above a tenant-configurable threshold, reason is mandatory and admin/owner confirmation is required;
- cashier cannot bypass the threshold by splitting one intended receipt into retries with the same business reference.

Prepayment without an invoice must be a separate action. Staff must not create a fake invoice or use overpayment as a substitute for a deposit workflow.

## 19. Deposit purposes

Do not hard-code implant/prosthetics/orthodontics/laboratory/surgery as database states. Dentistry evolves, clinics name products differently, and hard-coded taxonomies age like yogurt in a parked car.

### MVP controlled purpose types

- `general`;
- `appointment`;
- `treatment_plan`;
- `service_category`;
- `other`.

### References

- `appointment_id` when an existing appointment is selected;
- `treatment_plan_id` when an existing plan is selected;
- no `planned_service_id` until a stable authoritative planned-service entity exists;
- optional controlled service-category code/tenant label;
- mandatory free-text note for `other`;
- purpose-label snapshot for historical readability.

### Validation

Where a foreign key/reference is present, RPC must validate:

- same tenant;
- same patient;
- entity not archived/voided where applicable;
- currency/purpose compatibility if defined.

Purpose references explain intent. They do not authorize automatic clinical side effects.

## 20. Reservation invariants

| Invariant | Required enforcement |
|---|---|
| Active allocations + completed refunds + pending/approved refund reservations + active reservation remainder <= payment amount | Database trigger/capacity function plus SECURITY DEFINER RPC checks and concurrency tests. |
| Reservation tenant matches payment tenant | Composite FK where possible and RPC validation; trigger as defense. |
| Reservation patient matches payment patient | Composite FK/constraint where possible and RPC validation. |
| Reservation currency equals payment currency | Stored snapshot/check or derived-only currency with RPC/trigger validation. |
| Allocation cannot consume reserved money unless linked to that reservation | Allocation capacity trigger and controlled allocation RPC. |
| Refund cannot consume reserved money | Refundable-capacity function subtracts reservation remainder; trigger/RPC. |
| Reservation cannot exceed currently free payment amount | Payment row lock, capacity function, RPC, trigger. |
| Release restores general available credit | Controlled release RPC and authoritative read model. |
| Fully used reservation cannot be released as unused | RPC state/capacity check under lock. |
| Completed refund is immutable | Existing lifecycle rule/trigger/RPC. |
| Reservation updates are concurrency-safe | `FOR UPDATE` payment/reservation locks in stable order. |
| Cross-patient reservation/transfer forbidden | FK/RPC/trigger, never application-only. |
| Same idempotency key cannot create duplicate reservation | Unique partial index `(tenant_id, idempotency_key)` plus fingerprint comparison. |
| Archived/voided payment cannot receive reservation | RPC and trigger. |
| Voided payment cannot retain active reservation | Payment-void guard trigger and RPC. |
| Allocation and reservation use same payment | FK/trigger/RPC. |
| Reservation-backed allocation void restores reservation capacity | Controlled allocation-void logic under lock. |
| One currency is not netted against another | Query grouping and RPC guard. |
| `patients.balance` never receives credit writes | Source tests and database permissions. |

Application validation may improve messages, but none of the capacity/tenant/patient/currency invariants may remain application-only.

## 21. Role matrix

| Operation | Owner | Admin | Cashier | Doctor | Registrar | No tenant |
|---|---|---|---|---|---|---|
| View full patient credit amounts/history | Yes | Yes | Yes | No by default | No by default | Blocked |
| View purpose-specific “deposit received” indicator | Yes | Yes | Yes | Optional boolean only | Optional boolean only for appointment workflow | Blocked |
| Record general prepayment | Yes | Yes | Yes | No | No | Blocked |
| Create reservation with received payment | Yes | Yes | Yes within tenant policy/threshold | No | No | Blocked |
| Create reservation from existing general credit | Yes | Yes | Optional future; not MVP | No | No | Blocked |
| Release reservation | Yes | Yes | No | No | No | Blocked |
| Allocate general credit | Yes | Yes | Yes | No | No | Blocked |
| Allocate reservation-backed credit | Yes | Yes | Yes with purpose confirmation | No | No | Blocked |
| Request refund of available credit | Yes | Yes | Yes | No | No | Blocked |
| Approve/refuse refund | Yes | Yes | No | No | No | Blocked |
| Complete approved refund | Yes | Yes | Yes | No | No | Blocked |
| Forfeit deposit | Unsupported MVP; future owner with separate approval | No unless delegated policy | No | No | No | Blocked |
| Override/extend review date | Yes | Yes | No | No | No | Blocked |
| Transfer credit between patients/clinics | Forbidden | Forbidden | Forbidden | Forbidden | Forbidden | Blocked |
| Export patient credit history | Yes | Yes | Yes for operational patient statement | No | No | Blocked |

Doctor/registrar should not receive full payment amounts merely because they can open a patient chart. If operationally needed, expose a minimal purpose-specific boolean/status through a separate read model, not the full financial tables.

RLS and UI capabilities must be aligned. The existing UI currently treats doctor/registrar as finance viewers while table RLS does not grant a complete finance dataset.

## 22. Refund interaction

### General available credit

Eligible for the current refund lifecycle. Refund request reserves capacity; approval authorizes; completion returns money and recalculates payment status.

### Reserved deposit

Not directly refundable while reserved.

Supported future actions:

1. **Release reservation**: unused remainder becomes general credit.
2. **Request refund**: existing refund lifecycle operates on newly available capacity.
3. Preferred UX/RPC: **Cancel deposit and request refund**, one atomic action that releases the exact reservation remainder and creates an idempotent refund request.

Refund approval/completion remains separate according to the existing lifecycle.

### Used/allocated deposit

Cannot use the unallocated-refund path. It requires the future allocated-refund model with immutable links to allocation(s), exact debt reopening, and provider/payment-part awareness.

### Forfeited deposit

Unsupported. The system must not silently convert patient credit into revenue or an adjustment.

### Refund formula change

The future refundable-capacity function must subtract active reservation remainder in addition to allocations, completed refunds, and pending/approved refunds.

### Completed refunds

Remain immutable. A correction requires an explicit new compensating receipt/payment workflow, not changing the completed refund.

## 23. Invoice interaction

Recommended MVP workflow to use credit:

1. choose patient and same-currency issued/partially-paid invoice;
2. show invoice debt, available general credit, and purpose-compatible reserved credit separately;
3. enter/confirm allocation amount;
4. system proposes deterministic source payments, oldest received first;
5. user may inspect and, if permitted, override source selection;
6. backend receives an explicit ordered source plan;
7. one atomic RPC locks payment sources and invoice in stable order;
8. reserved source requires reservation link and purpose validation;
9. allocations are created;
10. invoice and payment projections recalculate;
11. audit records source composition and before/after debt/credit/reservation;
12. UI refreshes from server-authoritative summary.

Recommendation: implement one atomic multi-payment credit-allocation operation rather than a client loop. The UI may suggest FIFO, but the server executes only after explicit confirmation.

Credit transfer between invoices is not a free-floating transfer. It is an atomic void/reversal of selected allocation and creation of replacement allocation for the same patient, tenant, currency, and payment source.

Invoice void must remain blocked while active allocations exist. Staff must explicitly decide whether released money becomes general credit, is reallocated, or is refunded.

## 24. Cashier interaction

Future cashier surface must distinguish actions:

- **Accept payment** — new money is received and applied to selected invoice(s);
- **Accept prepayment** — new money is received without current invoice allocation;
- **Leave remainder as available credit** — explicitly accepted overpayment remainder;
- **Use credit** — existing money is allocated; no new cash is received;
- **Create deposit** — new/existing free money is reserved for a purpose;
- **Release reservation** — admin/owner action outside ordinary cashier rights;
- **Return to patient** — refund lifecycle, not payment void.

Critical UX rule:

> “Accept payment” and “Use credit” must never be the same ambiguous button.

Cashier result panels should show:

- newly received amount;
- newly allocated amount;
- existing credit used;
- remainder retained as credit;
- amount reserved as deposit;
- remaining debt;
- remaining available credit.

The hardened cashier operation currently rejects overpayment and requires at least one invoice. That remains the safe default until the explicit overpayment/prepayment flows exist.

## 25. Patient summary correction

### Required authoritative output

At minimum, per tenant/patient/currency:

- total invoiced;
- active allocated amount;
- total cash received;
- completed refunds;
- total approved write-offs;
- current debt;
- gross unallocated funds;
- refund-reserved funds;
- reserved deposit funds;
- available credit;
- net position;
- open/unpaid invoice counts;
- last payment timestamp;
- currency;
- fact completeness marker;
- source/as-of timestamp and model version;
- no pagination/cutoff ambiguity.

### Recommended implementation strategy

A stable, server-authoritative read RPC/function such as `get_patient_finance_summary` with:

- explicit `p_tenant_id`, `p_patient_id`;
- strict tenant-role check;
- exact authenticated EXECUTE grant;
- PUBLIC/anon revoked;
- safe `search_path`;
- aggregates executed directly in PostgreSQL over all matching rows;
- one result bucket per currency;
- no client-side 200-row cap;
- no raw sensitive metadata;
- versioned result shape.

A SECURITY DEFINER read RPC is preferred over the current client fan-out because it can enforce one coherent role/tenant boundary and return authoritative aggregates without granting broad table visibility. Its body must be narrowly scoped and security-audited.

Materialized view is not justified for one-patient current-state totals. Ordinary SQL aggregation is sufficient; materialization may later serve heavy period reporting.

### Correct refund treatment

Completed refund of unallocated money:

- reduces gross unallocated funds/available credit;
- increases completed-refund total;
- does not increase invoice debt;
- does not change an invoice;
- does not create an allocation reversal.

Debt reopens only when a future allocated refund explicitly reverses linked allocation(s).

### Completeness

The read model must always return `fact_complete = true` when the full authoritative aggregation succeeded. It must never claim completeness after pagination or cutoff. If an operational timeout/failure occurs, return an error rather than a partial total.

## 26. Reporting/accounting implications

Reports must separate:

| Measure | Meaning |
|---|---|
| Cash received | Sum of valid payment receipt facts by method/date/shift. |
| Cash allocated | Sum of active allocations, not new money. |
| Patient credit liability | Available general credit held for patients. |
| Deposits held | Remaining active reservation amount. |
| Deposits used | Active allocations linked to reservations. |
| Refunds completed | Money returned. |
| Outstanding debt | Active issued invoice balances. |
| Approved write-offs | Debt forgiven, not cash received. |
| Service revenue | Requires earned-service/accounting rules; not equal to payment receipt. |
| Unearned revenue/patient-held funds | Prepayments/deposits until recognised under future accounting rules. |
| Forfeited deposits | Unsupported until an explicit approved accounting model exists. |

Affected reports:

- daily cash report;
- patient financial statement;
- patient credit/deposit liability report;
- refund report;
- deposit aging/review report;
- outstanding debt and aging report;
- cashier reconciliation;
- provider/fiscal settlement report;
- revenue report.

Never equate `cash received = revenue`. A 100,000 ₸ implant deposit received today may be cash today, patient-held liability today, and revenue only under a later earned-event/accounting policy.

## 27. Multi-currency

Decisions:

- credit is currency-specific;
- reservation is currency-specific and inherits payment currency;
- allocation across currencies is forbidden;
- refund across currencies is forbidden;
- no FX conversion is implicit;
- one patient may theoretically have separate credit buckets by currency;
- summary and net position are calculated per currency only;
- MVP should enforce one configured currency per tenant until an FX model exists.

Dependency: **FINANCE-SINGLE-CURRENCY-GUARD-001**.

That task must validate historical currencies, add tenant currency policy, and enforce payment/invoice/allocation/refund/reservation currency compatibility. It must complete before production deposit allocation.

## 28. Historical migration

### Classification of existing rows

For every non-voided/non-archived payment, future reconciliation should classify:

- fully unallocated payment;
- partially allocated payment with unallocated remainder;
- no available remainder because fully allocated/refunded/reserved for refund;
- unknown-purpose legacy general credit;
- inconsistent capacity row;
- currency mismatch/inconsistent reference row;
- payment status inconsistent with derived utilisation.

### Migration behavior

- do not invent deposit purposes;
- do not create reservation rows for legacy payments;
- reservation table begins empty;
- every valid historical unallocated remainder is exposed as **legacy general credit**;
- retain original payment status/metadata/history;
- do not write to `patients.balance`;
- do not auto-allocate historical credit;
- do not auto-refund historical credit;
- provide a reconciliation report for review before enabling new workflows.

### Future validation queries

Implementation task should validate at least:

1. payment amount versus active allocations + completed refunds + pending/approved refunds;
2. negative/free capacity violations;
3. payment/invoice/allocation currency mismatch;
4. payment/tenant/patient mismatch across allocations/refunds;
5. voided/archived payments with active allocations/refunds/reservations;
6. payment status versus derived allocation/refund totals;
7. duplicate cashier operation/idempotency keys;
8. historical unallocated remainder by tenant/patient/currency;
9. `patients.balance` values for informational comparison only, never backfill authority;
10. source rows exceeding current client limits to demonstrate why server aggregation is necessary.

Inconsistent rows are reported and manually resolved through separately approved correction workflows. Migration must not silently “fix” financial history.

## 29. UI terminology

Recommended Russian labels:

- `Долг`
- `Доступный кредит`
- `Зарезервировано`
- `Предоплата`
- `Депозит`
- `Распределено`
- `Возвращено`
- `Использовать кредит`
- `Освободить резерв`
- `Вернуть пациенту`
- `Принято денег`
- `Оставить остаток как кредит`
- `Назначение депозита`

Recommended patient header example:

```text
Долг: 80 000 ₸
Доступный кредит: 20 000 ₸
Зарезервировано: 50 000 ₸
```

Optional secondary line:

```text
Чистая позиция: -60 000 ₸
```

Only show net position with explanatory text. Do not use generic `Баланс` alone.

Payment badge labels must not be treated as patient-position labels. `Распределён` describes a payment; `Оплачен` describes an invoice.

Doctor/registrar operational indicator should use wording such as:

- `Депозит по записи внесён`;
- `Депозит не подтверждён`;

without exposing the amount by default.

## 30. Security/RLS implications

### Table access

Future reservation tables:

- RLS enabled;
- direct INSERT/UPDATE/DELETE revoked from authenticated and anon;
- SELECT limited to owner/admin/cashier within tenant;
- service role retains administrative access;
- doctor/registrar do not receive full reservation amounts through table SELECT.

### RPC security

All mutation/read RPCs:

- explicit tenant argument;
- authenticated user required;
- tenant role checked;
- `SECURITY DEFINER` only when necessary;
- `SET search_path = public, pg_temp`;
- exact signature grants to authenticated;
- PUBLIC and anon EXECUTE revoked;
- no raw metadata or internal SQL errors in UI;
- no cross-patient/tenant lookup by guessed UUID;
- metadata size/type sanitization;
- reason length limits and controlled codes where possible.

### Limited operational reads

If doctor/registrar need deposit confirmation, expose a separate minimal RPC returning only:

- purpose reference;
- boolean/status;
- optional expiry/review date;
- no payment IDs, amount, payer, method, refund history, or metadata.

### Transfer prohibition

No RPC may accept a different target patient or target tenant. Cross-patient/cross-clinic transfer requires a future separately approved domain with legal payer/consent handling; it is not an “admin override”.

## 31. Audit events

Mandatory future events:

- `prepayment_recorded`;
- `overpayment_confirmed`;
- `patient_credit_allocated` or enriched `payment_allocated`;
- `patient_credit_allocation_voided`;
- `fund_reservation_created`;
- `fund_reservation_partially_used` where useful as a projection event;
- `fund_reservation_fully_used`;
- `fund_reservation_released`;
- `fund_reservation_refund_requested`;
- `fund_reservation_refunded`;
- `fund_reservation_expiry_extended`;
- future `fund_reservation_forfeiture_requested/approved/reversed` only after separate design;
- `patient_credit_statement_exported`.

Every material event should include:

- tenant, patient, actor;
- payment and reservation IDs;
- invoice/allocation/refund IDs where relevant;
- currency;
- amount;
- before/after allocated, refunded, refund-reserved, deposit-reserved, available-credit, and debt values;
- purpose/reference;
- reason/reason code;
- idempotency key/operation key;
- source UI/RPC;
- event timestamp;
- prior and next lifecycle states.

Audit/activity must not store secrets or unrestricted user metadata. Existing finance events may continue using the current audit category compatibility approach (`payment` category plus `domain=finance`) until the audit taxonomy is separately expanded.

## 32. Concurrency/idempotency

### Reservation creation

- mandatory tenant-scoped idempotency key;
- canonical material fingerprint: tenant, patient, payment, amount, purpose, references, expiry, controlled metadata;
- advisory transaction lock on tenant + key;
- payment row `FOR UPDATE`;
- unique partial index on tenant/key;
- same key/same payload returns existing result;
- same key/different payload rejects conflict.

### Capacity changes

Reservation create, release, reservation-backed allocation, allocation void, refund request, refund completion, and payment void must lock the affected payment and reservation rows.

For operations touching multiple payments:

- lock payment UUIDs in stable sorted order to prevent deadlocks;
- apply the user-confirmed allocation order separately;
- execute in one transaction;
- return one composite result;
- on any failure, roll back all allocations/reservation transitions/audit events.

### Database guard

A trigger/capacity function must enforce:

```text
allocations + completed refunds + refund reservations + deposit reservation remainder <= payment amount
```

RPC checks improve error messages but are not sufficient because future code paths and service-role operations exist.

### Release-and-refund

Atomic cancel/release-and-request-refund should:

1. lock payment/reservation;
2. verify unused remaining amount;
3. release exactly that remainder;
4. create one refund request using stable idempotency;
5. keep it unavailable to other allocation between steps;
6. return reservation/refund/capacity result;
7. roll back entirely on failure.

## 33. Critical risks

1. **False debt after unallocated refund.** Current summary adds completed refunds to debt without an allocation reversal.
2. **Real credit is invisible.** Current summary does not use unallocated payment remainder in `creditAmount`.
3. **Silent truncation.** Client summary reads at most 200 facts per table.
4. **Double consumption without reservation capacity guard.** Adding deposit labels without backend reservation enforcement would allow the same tenge to be both reserved and allocated/refunded.
5. **Cross-currency money application.** Existing allocation/cashier flows do not enforce payment/invoice currency equality.

These risks must be resolved before credit/deposit pilot use.

## 34. High risks

1. Cashier/manual entry paths have different overpayment behavior.
2. Manual `record_payment` lacks idempotency.
3. Payment status hides mixed utilisation components.
4. Doctor/registrar UI permissions do not align with current finance RLS.
5. Reserved deposit cancellation/refund could race allocation unless atomic.
6. Purpose-specific deposit could trigger accidental clinical automation if appointment/treatment hooks are added casually.
7. Automatic expiry/forfeiture could convert patient-held funds without lawful approval.
8. Reporting may equate payment receipt with revenue.
9. Legacy unallocated funds have unknown purpose and must not be invented as deposits.
10. Allocation void can restore hidden credit that staff may overlook.
11. No patient statement currently explains receipt, use, reservation, release, and return in one timeline.
12. Cross-patient “family” transfer would require payer/consent/accounting design and must remain forbidden.

## 35. Decision records

### DR-01 — Is patient credit stored or derived?

- **Options:** patient balance column; credit ledger; derived from payment facts.
- **Recommendation:** derive from payments, allocations, refunds, refund reservations, and deposit reservations.
- **Rationale:** one source of truth and no synchronization drift.
- **Risk:** query complexity; solved by authoritative server read model.
- **Migration impact:** read RPC/view only for first correction; reservation schema later.
- **Backward compatibility:** existing payments remain authoritative; `patients.balance` ignored.

### DR-02 — Is every unallocated payment automatically general credit?

- **Options:** no classification; all credit; only manually marked credit.
- **Recommendation:** yes, every valid unallocated unreserved remainder is general credit.
- **Rationale:** money is already received and belongs in patient-held funds even when purpose is unknown.
- **Risk:** accidental duplicate payment appears as credit until corrected/refunded.
- **Migration impact:** none for money rows; summary changes.
- **Backward compatibility:** historical unallocated money becomes legacy general credit.

### DR-03 — Is deposit a separate money table?

- **Options:** separate deposit money table; payment metadata only; payment-linked reservation.
- **Recommendation:** payment-linked reservation/intention, not separate money.
- **Rationale:** prevents duplicate cash facts while preserving purpose.
- **Risk:** lifecycle/capacity complexity.
- **Migration impact:** new reservation model and links/guards.
- **Backward compatibility:** payments unchanged.

### DR-04 — Can one payment fund multiple reservations?

- **Options:** one reservation only; multiple within capacity.
- **Recommendation:** yes, multiple reservations up to free capacity.
- **Rationale:** one receipt may cover several planned purposes.
- **Risk:** concurrency/double reservation.
- **Migration impact:** capacity trigger and indexes.
- **Backward compatibility:** no effect on existing payments.

### DR-05 — Can one reservation use multiple payments?

- **Options:** direct many-to-many; one payment per reservation; grouping model.
- **Recommendation:** one payment per reservation in MVP; multiple rows may share a purpose/reference.
- **Rationale:** simple capacity/refund traceability.
- **Risk:** one business deposit may appear as several rows.
- **Migration impact:** no junction table initially.
- **Backward compatibility:** straightforward.

### DR-06 — Can overpayment be accepted at cashier?

- **Options:** always reject; always allow; explicit controlled allow.
- **Recommendation:** default reject; allow only explicit controlled overpayment flow.
- **Rationale:** prevents accidental credit creation while supporting real clinic workflows.
- **Risk:** staff misuse/large mistaken receipt.
- **Migration impact:** extend atomic cashier RPC/result and policy.
- **Backward compatibility:** current behavior remains default.

### DR-07 — Must overpayment require explicit confirmation?

- **Options:** implicit remainder; confirmation; approval for all.
- **Recommendation:** explicit confirmation always; approval only above tenant threshold.
- **Rationale:** user must understand the remainder is retained as patient credit.
- **Risk:** threshold splitting.
- **Migration impact:** tenant finance policy and audit fields.
- **Backward compatibility:** none until feature enabled.

### DR-08 — Can cashier record prepayment without invoice?

- **Options:** no; manual generic payment; dedicated prepayment action.
- **Recommendation:** yes through a separate idempotent prepayment action.
- **Rationale:** common clinic workflow and clear semantics.
- **Risk:** duplicate receipt/incorrect patient.
- **Migration impact:** RPC/client/UI and possibly reservation schema.
- **Backward compatibility:** generic `record_payment` remains for legacy/admin correction until deprecated.

### DR-09 — How is credit later allocated?

- **Options:** silent automatic; client loop; controlled atomic allocation.
- **Recommendation:** explicit user-confirmed atomic allocation operation.
- **Rationale:** avoids partial completion and preserves intent.
- **Risk:** more complex RPC.
- **Migration impact:** multi-payment allocation RPC and tests.
- **Backward compatibility:** existing single-payment allocation remains usable.

### DR-10 — Is allocation source user-selected or automatic?

- **Options:** user only; automatic FIFO; suggested FIFO with confirmation.
- **Recommendation:** system suggests oldest eligible credit first; user confirms exact source plan and may override if permitted.
- **Rationale:** predictable operations without silent money movement.
- **Risk:** source override complexity.
- **Migration impact:** read preview and composite RPC input.
- **Backward compatibility:** no historical change.

### DR-11 — Can deposits link to appointments?

- **Options:** no links; free-text only; optional validated link.
- **Recommendation:** optional validated `appointment_id` and `treatment_plan_id`; no automatic clinical mutation.
- **Rationale:** operational usefulness and historical explanation.
- **Risk:** stale/cancelled references.
- **Migration impact:** nullable FKs or RPC validation depending existing composite keys.
- **Backward compatibility:** nullable fields.

### DR-12 — Can deposits expire?

- **Options:** automatic expiry; informational date; no date.
- **Recommendation:** optional review/expiry date, informational in MVP; explicit action required.
- **Rationale:** avoids automatic money transformation.
- **Risk:** staff may ignore expired review items.
- **Migration impact:** `expires_at`, index/report.
- **Backward compatibility:** null for existing/new general credit.

### DR-13 — Can deposits be forfeited?

- **Options:** simple status; approved accounting event; unsupported.
- **Recommendation:** unsupported in MVP; future approved accounting/legal workflow only.
- **Rationale:** forfeiture is not a harmless reservation status.
- **Risk:** clinics may need a policy before feature exists.
- **Migration impact:** none now; substantial future design.
- **Backward compatibility:** no historical forfeiture invented.

### DR-14 — Who approves forfeiture?

- **Options:** cashier/admin/owner; two-person approval.
- **Recommendation:** future owner approval with a different requester/approver and tenant threshold/policy.
- **Rationale:** converts patient-held funds and creates fraud/legal risk.
- **Risk:** small-clinic staffing constraints.
- **Migration impact:** future approval model.
- **Backward compatibility:** not applicable until supported.

### DR-15 — Is reservation release reversible?

- **Options:** mutate back to active; explicit new reservation.
- **Recommendation:** release is terminal for the released reservation remainder; create a new reservation to reserve again.
- **Rationale:** preserves clear history.
- **Risk:** additional rows.
- **Migration impact:** release audit/state.
- **Backward compatibility:** none.

### DR-16 — Can reserved money be refunded directly?

- **Options:** yes; release first; atomic release-and-refund.
- **Recommendation:** no generic direct refund; use atomic cancel/release-and-request-refund.
- **Rationale:** prevents race between release, allocation, and refund.
- **Risk:** lifecycle complexity.
- **Migration impact:** linked RPC/refund metadata or relation.
- **Backward compatibility:** existing unreserved refunds unchanged.

### DR-17 — Should release-and-refund be atomic?

- **Options:** two manual actions; one atomic request action.
- **Recommendation:** yes, atomic for deposit cancellation.
- **Rationale:** released money must not become allocatable between steps.
- **Risk:** approval/completion still spans lifecycle.
- **Migration impact:** new RPC and idempotency.
- **Backward compatibility:** existing refund RPC remains.

### DR-18 — Is cross-patient credit transfer allowed?

- **Options:** admin override; family transfer; forbidden.
- **Recommendation:** forbidden.
- **Rationale:** payer ownership, consent, refund, tax, and fraud implications are unresolved.
- **Risk:** legitimate family use cases require manual refund/new payment.
- **Migration impact:** hard tenant/patient checks.
- **Backward compatibility:** matches current allocation patient invariant.

### DR-19 — Is cross-clinic credit transfer allowed?

- **Options:** group transfer; shared wallet; forbidden.
- **Recommendation:** forbidden.
- **Rationale:** tenants are legal/operational boundaries.
- **Risk:** network clinics may request future group settlement.
- **Migration impact:** none beyond explicit guards.
- **Backward compatibility:** matches tenant isolation.

### DR-20 — Which summary read model is authoritative?

- **Options:** client aggregation; SQL view; SECURITY DEFINER read RPC; materialized view.
- **Recommendation:** narrowly scoped stable server read RPC/function, one bucket per currency.
- **Rationale:** complete aggregation and controlled role boundary.
- **Risk:** SECURITY DEFINER review required.
- **Migration impact:** new read function/grants/client DTO.
- **Backward compatibility:** repository can switch behind stable interface.

### DR-21 — How are historical unallocated payments migrated?

- **Options:** infer deposits; ignore; classify as general legacy credit.
- **Recommendation:** general legacy credit; reservation table empty.
- **Rationale:** purpose cannot be safely invented.
- **Risk:** legacy credit may require clinic review.
- **Migration impact:** reconciliation report, no payment mutation.
- **Backward compatibility:** strongest.

### DR-22 — How is multi-currency handled?

- **Options:** implicit numeric mixing; per-currency buckets; FX conversion.
- **Recommendation:** per-currency credit/debt and one tenant currency for MVP; no FX.
- **Rationale:** no exchange-rate/accounting model exists.
- **Risk:** legacy mixed currencies need remediation.
- **Migration impact:** tenant currency setting/guards.
- **Backward compatibility:** validate before constraint.

### DR-23 — What is shown to doctor/registrar?

- **Options:** full amounts; nothing; limited purpose indicator.
- **Recommendation:** no full finance amounts by default; optional boolean/status tied to appointment/treatment purpose.
- **Rationale:** least privilege and operational sufficiency.
- **Risk:** some clinics may need broader delegated role.
- **Migration impact:** separate limited read RPC/capability.
- **Backward compatibility:** resolves current UI/RLS mismatch.

### DR-24 — Which audit events are mandatory?

- **Options:** generic payment events only; reservation lifecycle and before/after components.
- **Recommendation:** record every receipt, reservation create/use/release, credit allocation/void, refund transition, threshold approval, and export with structured before/after values.
- **Rationale:** patient-held money must be explainable end to end.
- **Risk:** metadata volume/privacy.
- **Migration impact:** event taxonomy and payload conventions.
- **Backward compatibility:** existing events retained.

### DR-25 — Which next task is the dependency root?

- **Options:** currency guard; deposit foundation; summary correctness.
- **Recommendation:** **FINANCE-SUMMARY-CORRECTNESS-001**.
- **Rationale:** the existing summary hides actual credit, creates false debt after refunds, and truncates facts; every later UI/workflow depends on correct totals.
- **Risk:** deposit implementation delayed by one task.
- **Migration impact:** server read RPC/function and repository/UI transition, no reservation schema yet.
- **Backward compatibility:** improves interpretation without rewriting financial facts.

## 36. Dependency roadmap

| Order | Task | Purpose/scope | Dependencies | Migration/RPC/repository/UI/tests | Size | Operational value / risk reduced |
|---|---|---|---|---|---|---|
| 1 | **FINANCE-SUMMARY-CORRECTNESS-001** | Server-authoritative debt/credit totals; remove refund false debt and 200-row cap; per-currency result. | Current baseline only. | Migration/read RPC, client/repository, summary UI, SQL/TS tests. | M | Corrects current patient position before new features. |
| 2 | FINANCE-SINGLE-CURRENCY-GUARD-001 | Tenant currency policy and payment/invoice/allocation/refund guards. | Historical currency recon. | Migration/RPC/trigger/client tests; minimal UI policy display. | M | Prevents cross-currency destruction of meaning. |
| 3 | PATIENT-CREDIT-DEPOSITS-FOUNDATION-001 | Reservation schema, capacity guards, create/release lifecycle, read models, audit. | Tasks 1 and 2. | Migration, RPC, repository/client, SQL/concurrency/TS tests; no broad UI. | L | Makes purpose-specific deposits safe without duplicate money. |
| 4 | CREDIT-ALLOCATION-OPERATION-001 | Explicit atomic multi-payment general/reserved credit allocation and preview. | Foundation and currency guard. | RPC/client/hooks/UI integration/tests. | L | Prevents client-loop partial allocation and hidden source use. |
| 5 | PATIENT-CREDIT-DEPOSITS-UI-001 | Patient credit/deposit panels, purpose, release, history, role-safe indicators. | Summary + foundation + allocation operation. | Repository/hooks/React/tests/browser smoke. | L | Makes held funds understandable and operable. |
| 6 | CASHIER-CREDIT-PREPAYMENT-001 | Separate prepayment, overpayment-confirmation, use-credit actions in cashier. | Summary, foundation, allocation operation, UI patterns. | Extend atomic RPC/client/cashier UI/tests/concurrency. | XL | Supports real front-desk payment workflows safely. |
| 7 | DEPOSIT-REFUND-INTEGRATION-001 | Atomic cancel/release-and-request-refund; reservation-aware refund capacity. | Foundation and existing refund lifecycle. | Migration/RPC/client/UI/SQL/concurrency tests. | L | Prevents allocation/refund races and explains deposit cancellation. |
| 8 | PATIENT-FINANCE-STATEMENT-001 | Immutable patient statement/export of charges, receipts, allocation, reservation, release, refund, debt, credit. | Correct summary and implemented reservation workflows. | Read model/export metadata/UI/tests. | L | Provides patient-facing and audit reconciliation. |

These tasks are supported because each closes a specific dependency. They must not be launched automatically. Only task 1 is recommended next.

## 37. Pilot milestone

Before pilot use of patient credit/prepayments/deposits, all of the following are required:

- server-authoritative patient debt/credit summary;
- no 200-row truncation or partial completeness claim;
- completed unallocated refunds reduce credit and never create debt;
- visible general credit from unallocated payments;
- same-currency guards for payment/allocation/refund/reservation;
- controlled idempotent prepayment receipt;
- reservation capacity enforced in database;
- explicit release and reservation-backed allocation;
- available-credit refund through controlled lifecycle;
- clear `Debt`, `Available credit`, `Reserved` terminology;
- owner/admin/cashier role separation;
- doctor/registrar amount restriction;
- mandatory audit and before/after components;
- no `patients.balance` authority;
- historical unallocated-credit reconciliation completed;
- zero automatic clinical side effects;
- concurrency and retry tests proving one tenge cannot be spent twice.

Until these requirements are met, generic manual unallocated payments may remain an administrative capability, but the product must not market them as a complete deposit/credit workflow.

## 38. Recommended next task

**FINANCE-SUMMARY-CORRECTNESS-001**

Purpose:

- replace client-side capped aggregation with a complete server read model;
- make unallocated payment remainder visible as credit;
- ensure completed unallocated refunds reduce credit rather than create debt;
- return debt, gross unallocated, refund-reserved, available credit, completed refunds, and net position per currency;
- establish DTOs and terminology required by the later reservation foundation.

This is the dependency root because deposit UI, overpayment confirmation, refund decisions, historical migration, cashier results, and patient statements cannot be verified against an incorrect summary.

No implementation task is started by this recon.

## 39. Final verdict

**PATIENT CREDIT AND DEPOSITS RECONCILED**

A coherent model is selected: payments remain authoritative money receipts, unallocated unreserved remainders are derived general patient credit, and purpose-specific deposits are payment-linked reservations rather than a second cash ledger. Formulas, lifecycle, roles, refund/invoice/cashier interaction, migration strategy, security, audit, concurrency, pilot requirements, and dependency roadmap are defined.

## Checks

- Required baseline and merged PR #336: verified.
- Required finance reports, migrations, RPCs, repository/client, hooks/UI, RLS/security, audit, and tests: reviewed.
- Current unallocated-money scenarios: 10/10 documented.
- Terminology definitions: completed.
- Model options: 4/4 evaluated.
- Authoritative model and formulas: completed.
- Decision records: 25/25 completed.
- Exactly one recommended next task: present.
- Database writes: none.
- Cloud Supabase: not touched.
- SQL/code/tests/seed/generated types: not changed.
- Report validator: pending PR metadata/final validation.
- GitHub Actions: pending PR creation.

## Browser smoke

- New browser smoke is intentionally not run for this report-only task.
- Browser fixtures and database writes are forbidden by scope.
- Existing patient-finance, cashier, refund/write-off, role, no-tenant, and cross-tenant browser reports were reviewed as prior evidence.
- No fixture was created, so no cleanup is required.

## Issues / warnings

- This is an architecture/domain reconciliation, not implementation verification.
- The recommended reservation schema/RPC names are conceptual and must be finalized in a separately scoped implementation task.
- Forfeiture is deliberately unsupported until legal, accounting, approval, and reporting rules are separately approved.
- Current Russian source files display encoding artifacts in terminal output, but the underlying UI terminology intent and test coverage were reviewed; no encoding file was changed.
