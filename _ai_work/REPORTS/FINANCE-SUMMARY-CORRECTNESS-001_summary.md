# FINANCE-SUMMARY-CORRECTNESS-001

Final verdict: **BLOCKED: the ChatGPT-to-Hermes local bridge is unreachable, so the required local repository inspection, implementation, Supabase reset, SQL tests, browser smoke, cleanup, and validation cannot be performed safely.**

## 1. Summary

This task was stopped at preflight. GitHub access and Supabase project discovery succeeded, but every Hermes local-bridge call failed with a network connection error. No application code, SQL migration, tests, seed, generated types, cloud database objects, or finance data were changed.

A bounded GitHub-only reconciliation confirmed the current client summary defects described by the task: it reads at most 200 rows per finance table, omits unallocated payment capacity from patient credit, adds completed refunds to amount due, and aggregates currencies without separation.

## 2. Branch

`feature/finance-summary-correctness-001`

Created directly from the required baseline merge commit:

`781680ad0c009bf590d00ddf148d9e366f7381dc`

The GitHub default branch `main` was confirmed at that commit before branch creation. A local working-tree cleanliness check could not be performed because Hermes was unreachable.

## 3. PR URL

Pending until the initial blocked report commit is published as a draft PR.

## 4. PR head reviewed before final report update

Pending until the initial blocked report commit is created.

## 5. Report update commit

N/A because the final report update commit cannot reference itself before creation.

## 6. Changed files

- `_ai_work/REPORTS/FINANCE-SUMMARY-CORRECTNESS-001_summary.md`

No other files were changed.

## 7. Pre-read

Completed through GitHub connector:

- PR #337 and its merged reconciliation report;
- recent `main` commits proving the required finance baseline sequence;
- `src/data/repositories/FinanceRepository.ts` at baseline commit `781680ad0c009bf590d00ddf148d9e366f7381dc`.

The complete required pre-read could not be performed locally because the Hermes bridge was unreachable.

## 8. Previous client summary analysis

`computePatientFinanceSummary` lives in `src/data/repositories/FinanceRepository.ts`.

It consumes:

- invoices;
- invoice items;
- payments;
- payment allocations;
- refunds;
- financial adjustments.

`getPatientFinanceFacts` loads each list independently with `MAX_FINANCE_LIMIT`, currently 200, and `getPatientFinanceSummary` computes totals in the browser-facing repository.

| Current field | Current formula | Current defect | Target formula |
|---|---|---|---|
| `invoiceTotalAmount` | Sum of every non-voided/non-archived invoice total | Includes draft invoices and silently combines currencies | Per currency, sum non-draft/non-voided/non-archived invoice totals |
| `paidAmount` | Sum of every non-voided/non-archived payment amount | Historical cash received is mislabeled as paid/allocated and currencies are combined | `cash_received` per currency from valid payments |
| `allocatedPaymentAmount` | Sum active allocations | Truncated at 200 facts and not validated against invoice totals | `total_paid_allocated` from all active allocations linked to valid patient invoices |
| `refundedAmount` | Sum completed refunds | Later added to `amountDue`, creating false debt | Report separately as `completed_refunds`; never add to debt in current MVP |
| `writeOffAmount` | Sum approved write-offs | Client-side, truncated, and not checked against invoice write-off totals | Server aggregate of approved non-voided write-offs per currency |
| `balanceAmount` | Positive part of invoice totals + surcharges + corrections + completed refunds - allocations - discounts - write-offs | Completed refund creates debt; uses invoice totals instead of authoritative active balances; draft status included | Sum active invoice `balance_amount` per currency |
| `creditAmount` | Negative part of the same synthetic amount due | Unallocated payment capacity is normally invisible | Sum valid per-payment available unallocated capacity after completed and reserved refunds |

## 9. Exact previous defects

1. `MAX_FINANCE_LIMIT = 200` caps each fact list used by the summary.
2. `getPatientFinanceFacts` requests exactly that limit for all finance tables.
3. Completed refunds are added to `amountDue`.
4. Unallocated payment capacity is not included in `creditAmount`.
5. Draft invoices are included in active invoice totals because only voided and archived statuses are excluded.
6. All currencies are arithmetically combined.
7. Patient finance totals are computed from multiple independently fetched lists rather than one authoritative snapshot.
8. UI callers can diverge if they use different lists or formulas.

## 10. Authoritative RPC contract

Not implemented because local schema inspection and validation were unavailable.

Required target remains:

`get_patient_finance_summary(p_tenant_id uuid, p_patient_id uuid) -> jsonb`

## 11. Per-currency DTO

Not implemented. The required DTO remains a top-level summary containing `tenantId`, `patientId`, `asOf`, `modelVersion`, `currencies`, `factComplete`, and `warnings`, with one currency summary per currency.

## 12. Debt formula

Target confirmed from the task:

`current_debt = sum(active invoice balance_amount)` per currency.

Not implemented.

## 13. Credit formula

Target confirmed from the task:

`available_credit(payment) = max(0, payment.amount - active allocations - completed refunds - pending/approved refund reservations)`.

Not implemented.

## 14. Refund reserve formula

Target confirmed from the task:

`refund_reserved = sum(pending and approved refund amounts)` per payment and currency.

Not implemented.

## 15. Completed refund behavior

Current code incorrectly increases `amountDue` by completed refunds. Target behavior is to reduce unallocated payment capacity and report the refund separately without creating debt.

Not implemented.

## 16. Write-off behavior

Target behavior is to reduce invoice debt without increasing paid amount.

Not implemented.

## 17. Status filters

Current client code explicitly excludes only `voided` and `archived` invoices/payments, treats allocation statuses other than `voided`, `archived`, and `rejected` as active, includes only completed refunds in the summary, and includes adjustments other than `voided`, `archived`, and `rejected`.

The complete server-side status matrix was not implemented or validated.

## 18. Anomaly warnings

Not implemented. Required warning codes remain:

- `PAYMENT_OVERCONSUMED`
- `REFUND_RESERVATION_EXCEEDS_CAPACITY`
- `INVOICE_NEGATIVE_BALANCE`
- `INVOICE_PAID_MISMATCH`
- `INVOICE_WRITEOFF_MISMATCH`
- `INVOICE_STATUS_MISMATCH`
- `PAYMENT_STATUS_MISMATCH`
- `MULTIPLE_CURRENCIES`

## 19. Security and grants

Not implemented. No grants, RLS policies, functions, or cloud resources were changed.

## 20. Repository integration

Not implemented. Current `getPatientFinanceSummary` still calls `getPatientFinanceFacts` and `computePatientFinanceSummary`.

## 21. Hook integration

Not inspected or changed because the required local project context was unavailable.

## 22. Patient finance UI

Not changed.

## 23. Cashier integration

Not changed.

## 24. Performance and indexes

The existing 200-row cap was confirmed. No migration or index was added because local schema and query-plan validation could not be performed.

## 25. 250-row validation

Not run. Blocked by unavailable local Hermes bridge.

## 26. 1000-row validation

Not run. Blocked by unavailable local Hermes bridge.

## 27. Multi-currency validation

Not run. Current client formula was confirmed to combine currencies silently.

## 28. Role validation

Not run.

## 29. Cross-tenant validation

Not run.

## 30. Browser smoke

Not run because Hermes browser/local application access was unavailable.

## 31. Side-effect validation

No implementation or database writes occurred. Therefore this task did not change patients, completed services, appointments, documents, stock, timeline, or finance facts.

## 32. Cleanup

No local fixtures were created. No cloud migration was applied. No cleanup was required.

## 33. Tests

Not run because the local repository and process runner were unreachable.

## 34. Lint and build

Not run because the local repository and process runner were unreachable.

## 35. GitHub Actions CI

Pending after draft PR creation. CI on this report-only blocked branch does not validate the missing implementation.

## 36. What was intentionally not implemented

Everything outside the strict task scope remained untouched, including deposit reservations, credit allocation, overpayments, cashier prepayments, currency guards, completed-service billing guards, invoice corrections, new refund/write-off lifecycles, providers, fiscal receipts, documents, stock, timeline, clinical mutations, cloud migrations, seed changes, generated types, service-role application code, and HEP-V2.

## 37. Final verdict

**BLOCKED: Hermes local bridge connection failed repeatedly, preventing the mandatory local implementation and validation workflow.**

Required capability to resume:

- reachable ChatGPT-to-Hermes bridge for the repository workspace;
- local Git and filesystem access;
- local Supabase reset and SQL execution;
- local test/build runner;
- localhost browser smoke tooling.

## 38. Recommended next task

Do not start `FINANCE-SINGLE-CURRENCY-GUARD-001` yet.

Resume `FINANCE-SUMMARY-CORRECTNESS-001` after restoring Hermes connectivity. The original recommended next task remains `FINANCE-SINGLE-CURRENCY-GUARD-001` only after this summary task is implemented and verified.
