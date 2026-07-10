# FINANCE-SUMMARY-CORRECTNESS-001

Final verdict: **PASS locally. The authoritative per-currency patient finance summary is implemented and validated. Fresh GitHub Actions evidence is pending until the implementation commit is pushed.**

## Scope and branch

This task replaces the capped client-side finance summary with one complete PostgreSQL snapshot and integrates it into patient finance and cashier UI.

- Remote branch: `feature/finance-summary-correctness-001`
- Local worktree branch: `feature/finance-summary-correctness-001-local`
- Draft PR: `NckNA/codex-test#338`
- Required baseline and confirmed merge base: `781680ad0c009bf590d00ddf148d9e366f7381dc`
- PR remains draft and must not be merged by this task.

Not started: `FINANCE-SINGLE-CURRENCY-GUARD-001`, deposit foundation, HEP-V2, provider/fiscal integrations. No cloud Supabase migration or cloud data change occurred.

## Changed files

- `supabase/migrations/0020_create_patient_finance_summary_rpc.sql`
- `supabase/tests/0020_patient_finance_summary_test.sql`
- `src/data/repositories/FinanceRepository.ts`
- `src/data/repositories/FinanceRepository.test.ts`
- `src/data/hooks/usePatientFinance.test.tsx`
- `src/data/hooks/useCashierPaymentFlow.test.tsx`
- `src/components/finance/PatientFinanceSummaryCard.tsx`
- `src/components/finance/PatientFinancePanel.test.tsx`
- `src/components/finance/FinanceSummaryCards.test.tsx`
- `src/components/cashier/CashierPatientFinanceSummary.tsx`
- `src/components/cashier/CashierPaymentPanel.test.tsx`
- `_ai_work/REPORTS/FINANCE-SUMMARY-CORRECTNESS-001_summary.md`

## Authoritative RPC

Migration `0020_create_patient_finance_summary_rpc.sql` adds:

```sql
public.get_patient_finance_summary(p_tenant_id uuid, p_patient_id uuid) returns jsonb
```

Top-level DTO:

- `tenantId`, `patientId`, `asOf`, `modelVersion`
- `currencies[]`, `factComplete`, `warnings[]`
- `modelVersion = finance-summary-v1`
- a successful complete aggregate returns `factComplete = true`; authorization or scope failures throw instead of returning a false success.

Each currency bucket contains:

- `currency`, `totalInvoiced`, `activeAllocatedAmount`, `cashReceived`
- `completedRefundAmount`, `approvedWriteOffAmount`, `currentDebt`
- `grossUnallocatedAmount`, `refundReservedAmount`, `reservedDepositAmount`
- `availableCreditAmount`, `netPositionAmount`
- `openInvoiceCount`, `unpaidInvoiceCount`, `partiallyPaidInvoiceCount`, `lastPaymentAt`

Currencies are normalized and never combined. `reservedDepositAmount` is `0` by design because deposit reservations are out of scope.

## Formulas and lifecycle

Included invoices: `issued`, `partially_paid`, `paid`, `written_off`.

Excluded invoices: `draft`, `voided`, `archived`.

```text
currentDebt = sum(max(0, invoice.balance_amount))
grossUnallocated per payment = max(0, payment.amount - active allocations - completed refunds)
availableCredit per payment = max(0, payment.amount - active allocations - completed refunds - pending/approved refund reservations)
netPositionAmount = availableCreditAmount - currentDebt
```

Payments with status `voided` or `archived` are excluded. Only active allocations linked to valid same-tenant, same-patient payments and included invoices are counted. Completed refunds reduce payment capacity and do not create debt. Pending and approved refunds reserve credit. Only approved `write_off` adjustments are reported.

## Warnings

Implemented warning codes:

- `PAYMENT_OVERCONSUMED`
- `REFUND_RESERVATION_EXCEEDS_CAPACITY`
- `INVOICE_NEGATIVE_BALANCE`
- `INVOICE_PAID_MISMATCH`
- `INVOICE_WRITEOFF_MISMATCH`
- `INVOICE_STATUS_MISMATCH`
- `PAYMENT_STATUS_MISMATCH`
- `MULTIPLE_CURRENCIES`

Warnings expose only safe identifiers and primitive diagnostic values. Raw metadata, secrets, and backend errors are not returned.

The SQL suite runtime-validates every warning except `INVOICE_NEGATIVE_BALANCE`; the current schema constraint prevents creating a negative invoice balance through normal SQL. The warning remains defensive for imported or legacy data.

## Security and indexes

The RPC is `STABLE`, `SECURITY DEFINER`, and uses `SET search_path = public, pg_temp`. It checks `auth.uid()`, tenant role, and exact patient/tenant scope.

Allowed roles: `clinic_owner`, `clinic_admin`, `cashier`, `registrar`, `doctor`.

Execution is revoked from `PUBLIC`, `anon`, and `authenticated`, then granted explicitly to `authenticated`. Internal authorization still decides whether the call succeeds.

Partial indexes were added for active allocations, relevant refund statuses, and approved write-offs.

## Repository and UI

`SupabaseFinanceRepository.getPatientFinanceSummary` now calls only the RPC and strictly maps the versioned payload. RPC failures are sanitized to `Finance summary read failed.`

The old client-side summary calculation was removed. There is no fallback to capped list reads and no second source of truth. `getPatientFinanceFacts` remains only for detail screens.

Patient finance and cashier UI now render independent currency sections, model/as-of information, debt, credit, reserves, counts, and visible Russian warning messages. Neither UI creates a cross-currency total.

## Local SQL validation

- `npx supabase db reset` passed through migration `0020`.
- `supabase/tests/0020_patient_finance_summary_test.sql` passed transactionally.
- Final SQL line: `FINANCE-SUMMARY-CORRECTNESS-001 SQL validation passed`.

Validated cases:

- empty patient and versioned DTO shape;
- draft exclusion;
- completed refund reducing credit without creating debt;
- pending/approved refund reservations;
- approved write-off reporting and debt behavior;
- 250 payments without truncation;
- 1000 payments without truncation;
- KZT/USD separation and `MULTIPLE_CURRENCIES`;
- overconsumption, reservation, payment-status, invoice-paid, invoice-write-off, and invoice-status warnings;
- clinic admin, cashier, doctor, and registrar access;
- no-tenant, cross-tenant, wrong-patient-tenant, and anonymous denial;
- no raw metadata;
- no mutation of patients, completed services, appointments, documents, stock, or finance facts.

The SQL suite ends with `ROLLBACK`. A direct post-test query confirmed zero remaining fixture patients.

## Browser smoke

A Vite server was started from the implementation worktree with local Supabase and repository-supported QA users.

Cashier scenario:

- authenticated as `qa.cashier.a@example.local`;
- opened `/cashier/payments`;
- searched and selected the seeded patient;
- cashier summary and empty state rendered;
- no console error and no visible secret.

The harness reported one non-critical failed background request, while every required page assertion and finance RPC behavior passed.

Clinic administrator scenario:

- authenticated as `qa.admin.a@example.local`;
- opened the seeded patient card and finance tab;
- patient finance summary and empty state rendered;
- no failed request, console error, or visible secret.

The development server was stopped after validation.

## TypeScript, tests, lint, and build

Coverage includes RPC-only summary loading, absence of capped fallback reads, strict DTO mapping, warning validation, sanitized errors, multi-currency patient/cashier display, visible warnings, hook integration, and stale patient selection protection.

Final local results:

- ESLint: passed
- test files: **73 passed**
- tests: **740 passed**
- production build: passed
- `git diff --check`: passed
- local Supabase schema lint: completed successfully

Schema lint reported only pre-existing warnings in unrelated treatment-plan, visit, encounter, and completed-service functions. The new summary RPC produced no lint issue.

The build retains the repository's existing large-chunk warning. The test suite retains existing React `act(...)` warnings. Neither warning fails validation or originates from this summary implementation.

Two obsolete tests for the removed client-side summary formula were deleted, so the final count is two lower than the intermediate 742-test run.

## CI

Fresh GitHub Actions evidence will be recorded after the implementation commit is pushed to PR #338.

Current pre-push status: **pending**.

## Limitations

- Deposit reservations remain out of scope, so `reservedDepositAmount = 0`.
- Inconsistent historical facts are reported, not silently repaired.
- `INVOICE_NEGATIVE_BALANCE` is defensive because the normal schema currently prevents such a row.
- Currency buckets are separated, but single-currency enforcement belongs to `FINANCE-SINGLE-CURRENCY-GUARD-001`.

## Final verdict

**PASS locally.** The previous bridge blocker is resolved, the implementation is complete, mandatory local validation passed, fixtures were cleaned, and cloud Supabase was untouched.

PR #338 remains draft and must not be merged until fresh CI succeeds on the implementation head.

## Recommended next task

After this PR passes CI and review, the next bounded task is `FINANCE-SINGLE-CURRENCY-GUARD-001`.
