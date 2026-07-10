# FINANCE-SUMMARY-CORRECTNESS-001

Final verdict: **BLOCKED: the ChatGPT-to-Hermes local bridge is unreachable, so the required local repository inspection, implementation, Supabase reset, SQL tests, browser smoke, cleanup, and validation cannot be performed safely.**

## 1. Summary

The task stopped at preflight. GitHub access and Supabase project discovery succeeded, but all Hermes local-bridge calls failed with a network connection error. No application code, SQL migration, tests, seed, generated types, cloud database objects, or finance data were changed.

A bounded GitHub-only reconciliation confirmed the current client summary defects: the summary reads at most 200 rows per finance table, hides unallocated payment capacity, adds completed refunds to amount due, and silently combines currencies.

## 2. Branch

`feature/finance-summary-correctness-001`

Created directly from required baseline merge commit `781680ad0c009bf590d00ddf148d9e366f7381dc`. GitHub `main` was confirmed at this commit. Local source-worktree cleanliness could not be checked because Hermes was unreachable.

## 3. PR URL

https://github.com/NckNA/codex-test/pull/338

The PR is draft and must not be merged.

## 4. PR head reviewed before final report update

`018be0b84c8f6c52e37ff729c23d9641b3b38e9e`

CI run `29116046122`, run number `668`, passed ESLint, tests, and build on this head.

## 5. Report update commit

N/A because the final report update commit cannot reference itself before creation.

## 6. Changed files

- `_ai_work/REPORTS/FINANCE-SUMMARY-CORRECTNESS-001_summary.md`

No other files were changed.

## 7. Pre-read

Completed through GitHub:

- PR #337 and its merged reconciliation report;
- recent `main` commits proving the required finance baseline sequence;
- `src/data/repositories/FinanceRepository.ts` at baseline commit `781680ad0c009bf590d00ddf148d9e366f7381dc`.

The complete required local pre-read was blocked by the unavailable Hermes bridge.

## 8. Previous client summary analysis

`computePatientFinanceSummary` lives in `src/data/repositories/FinanceRepository.ts`.

It consumes invoices, invoice items, payments, payment allocations, refunds, and financial adjustments. `getPatientFinanceFacts` loads every list independently with `MAX_FINANCE_LIMIT = 200`; `getPatientFinanceSummary` then computes totals client-side.

| Current field | Current formula | Current bug | Target formula |
|---|---|---|---|
| `invoiceTotalAmount` | Sum every non-voided/non-archived invoice total | Includes drafts and combines currencies | Sum non-draft/non-voided/non-archived invoice totals per currency |
| `paidAmount` | Sum non-voided/non-archived payment amounts | Historical cash received is mislabeled and combined across currencies | `cash_received` per currency |
| `allocatedPaymentAmount` | Sum active allocations | Truncated and not reconciled with invoice values | All active allocations linked to valid patient invoices per currency |
| `refundedAmount` | Sum completed refunds | Added to `amountDue`, creating false debt | Report separately; do not add to debt |
| `writeOffAmount` | Sum approved write-offs | Client-side, truncated, not reconciled | Approved non-voided write-offs per currency |
| `balanceAmount` | Positive part of synthetic amount due | Uses invoice totals, includes drafts, completed refunds create debt | Sum active invoice `balance_amount` per currency |
| `creditAmount` | Negative part of synthetic amount due | Unallocated payment capacity is normally invisible | Sum valid unallocated capacity after refunds and reservations |

## 9. Exact previous defects

1. `MAX_FINANCE_LIMIT = 200` caps each fact list.
2. `getPatientFinanceFacts` requests exactly that limit for all finance tables.
3. Completed refunds are added to `amountDue`.
4. Unallocated payment capacity is absent from `creditAmount`.
5. Draft invoices are included because only voided and archived invoices are excluded.
6. Currencies are added together.
7. Multiple independently fetched lists are treated as one authoritative snapshot.
8. Different UI surfaces can diverge if they do not share the same client formula.

## 10. Authoritative RPC contract

Not implemented. Required target remains:

`get_patient_finance_summary(p_tenant_id uuid, p_patient_id uuid) -> jsonb`

## 11. Per-currency DTO

Not implemented. Required top-level fields remain `tenantId`, `patientId`, `asOf`, `modelVersion`, `currencies`, `factComplete`, and `warnings`, with separate currency summaries.

## 12. Debt formula

Target: `current_debt = sum(active invoice balance_amount)` per currency. Not implemented.

## 13. Credit formula

Target per payment:

`available_credit = max(0, payment.amount - active allocations - completed refunds - pending/approved refund reservations)`.

Not implemented.

## 14. Refund reserve formula

Target: sum pending and approved refund amounts per payment and currency. Not implemented.

## 15. Completed refund behavior

Current code incorrectly increases `amountDue` by completed refunds. Target behavior is to reduce payment credit and report the refund separately without creating debt. Not implemented.

## 16. Write-off behavior

Target behavior is to reduce invoice debt without increasing paid amount. Not implemented.

## 17. Status filters

Current client code excludes only voided/archived invoices and payments, treats allocation statuses other than voided/archived/rejected as active, includes only completed refunds in the summary, and includes adjustments other than voided/archived/rejected. The authoritative server status matrix was not implemented or validated.

## 18. Anomaly warnings

Not implemented. Required codes remain:

- `PAYMENT_OVERCONSUMED`
- `REFUND_RESERVATION_EXCEEDS_CAPACITY`
- `INVOICE_NEGATIVE_BALANCE`
- `INVOICE_PAID_MISMATCH`
- `INVOICE_WRITEOFF_MISMATCH`
- `INVOICE_STATUS_MISMATCH`
- `PAYMENT_STATUS_MISMATCH`
- `MULTIPLE_CURRENCIES`

## 19. Security and grants

Not implemented. No grants, policies, functions, or cloud resources were changed.

## 20. Repository integration

Not implemented. Current `getPatientFinanceSummary` still calls `getPatientFinanceFacts` and `computePatientFinanceSummary`.

## 21. Hook integration

Not changed.

## 22. Patient finance UI

Not changed.

## 23. Cashier integration

Not changed.

## 24. Performance and indexes

The 200-row cap was confirmed. No migration or index was added because local schema and query-plan validation were unavailable.

## 25. 250-row validation

Not run. Blocked by unavailable Hermes local bridge.

## 26. 1000-row validation

Not run. Blocked by unavailable Hermes local bridge.

## 27. Multi-currency validation

Not run. Current client formula was confirmed to combine currencies silently.

## 28. Role validation

Not run.

## 29. Cross-tenant validation

Not run.

## 30. Browser smoke

Not run because local browser/application access through Hermes was unavailable.

## 31. Side-effect validation

No implementation or database writes occurred. Patients, completed services, appointments, documents, stock, timeline, and finance facts were not changed.

## 32. Cleanup

No local fixtures were created. No cloud migration was applied. No cleanup was required.

## 33. Tests

Mandatory targeted and SQL tests were not run locally. The repository CI suite passed on the initial report-only head, but that does not validate the missing implementation.

## 34. Lint and build

GitHub Actions run `29116046122` passed ESLint, tests, and build on initial report-only head `018be0b84c8f6c52e37ff729c23d9641b3b38e9e`.

## 35. GitHub Actions CI

Initial report-only CI: success.

- workflow: `CI`
- run number: `668`
- run ID: `29116046122`
- tested head: `018be0b84c8f6c52e37ff729c23d9641b3b38e9e`

Fresh CI after this final report update must be recorded in the PR body and final task response because this commit cannot predict its own future SHA and run.

## 36. What was intentionally not implemented

No deposit reservations, credit allocation, overpayment, cashier prepayment, currency guard, completed-service billing guard, invoice correction, refund/write-off lifecycle change, provider integration, fiscal receipt, documents, stock, timeline, clinical mutation, cloud apply, seed change, generated types, service-role application code, or HEP-V2 work was started.

## 37. Final verdict

**BLOCKED: Hermes local bridge connection failed repeatedly, preventing the mandatory local implementation and validation workflow.**

Required capability to resume:

- reachable ChatGPT-to-Hermes workspace bridge;
- local Git and filesystem access;
- local Supabase reset and SQL execution;
- local test/build runner;
- localhost browser smoke tooling.

## 38. Recommended next task

Resume `FINANCE-SUMMARY-CORRECTNESS-001` after restoring Hermes connectivity.

Do not start `FINANCE-SINGLE-CURRENCY-GUARD-001` yet. It remains the correct next task only after the authoritative summary is implemented and verified.
