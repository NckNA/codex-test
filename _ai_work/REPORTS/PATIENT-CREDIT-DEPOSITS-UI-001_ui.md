# PATIENT-CREDIT-DEPOSITS-UI-001

## 1. Summary

Operational patient-credit and deposit workflows were added to the patient finance area. Staff can view authoritative credit and reserve totals, list reservations, create a deposit from existing received funds, release the remaining reserve, and allocate reserved credit to an eligible invoice. No workflow creates a payment when existing credit is used, and releasing a reservation does not create a refund.

## 2. Branch

`feature/patient-credit-deposits-ui-001`

Baseline: `84d32230b67627c0a8a778a533ca07c82ccabb09` from `origin/main`.

## 3. PR URL

https://github.com/NckNA/codex-test/pull/341

## 4. PR head reviewed before final report update

`325c1025ef4a0d38683bf085763a4cb32fc93600` was the implementation head reviewed before this final report update.

## 5. Report update commit

- Report update commit: N/A (the report commit cannot reference itself; use the finalization receipt).

## 6. Changed files

- `src/components/cashier/CashierPatientFinanceSummary.tsx`
- `src/components/finance/FinanceSummaryCards.test.tsx`
- `src/components/finance/PatientFinancePanel.test.tsx`
- `src/components/finance/PatientFinancePanel.tsx`
- `src/components/finance/CreateFundReservationDialog.tsx`
- `src/components/finance/CreateFundReservationDialog.test.tsx`
- `src/components/finance/PatientFundReservationCard.tsx`
- `src/components/finance/PatientFundReservationsPanel.tsx`
- `src/components/finance/PatientFundReservationsPanel.test.tsx`
- `src/components/finance/ReleaseFundReservationDialog.tsx`
- `src/components/finance/ReleaseFundReservationDialog.test.tsx`
- `src/components/finance/UseReservedCreditDialog.tsx`
- `src/components/finance/UseReservedCreditDialog.test.tsx`
- `src/components/finance/fundReservationLabels.ts`
- `src/components/finance/fundReservationPermissions.ts`
- `src/data/hooks/usePatientFundReservations.ts`
- `src/data/hooks/usePatientFundReservations.test.tsx`
- `src/data/hooks/usePatientFundReservationFlow.ts`
- `src/data/hooks/usePatientFundReservationFlow.test.tsx`
- `src/data/repositories/FinanceRpcClient.ts`
- `src/data/repositories/FinanceRpcClient.test.ts`
- `_ai_work/REPORTS/PATIENT-CREDIT-DEPOSITS-UI-001_ui.md`

No migration, seed, generated type, document, stock, timeline, or clinical file changed.

## 7. Pre-read

Reviewed the deposit reconstruction and foundation reports, finance-summary correctness report, cashier hardening report, refund/write-off UI report, finance security/role material, existing finance repository/client contracts, patient finance hooks, cashier payment flow, refund/write-off hooks, summary cards, invoice UI, role helpers, and related tests.

## 8. Existing backend contract

The UI reuses the existing methods without aliases:

- `getPatientFundReservations` → `get_patient_fund_reservations`
- `getPaymentFundCapacity` → `get_payment_fund_capacity`
- `createPatientFundReservation` → `create_patient_fund_reservation`
- `releasePatientFundReservation` → `release_patient_fund_reservation`
- `allocateReservedCredit` → `allocate_reserved_credit`
- `getPatientFinanceSummary` → `get_patient_finance_summary`

Existing statuses, purpose types, idempotency behavior, server role enforcement, and safe error normalization remain authoritative. Cashier release remains disabled because the backend permits release only for owner/admin. Actor display names and rich invoice/payment display metadata are not returned by the current reservation read model, so the UI does not invent them.

## 9. UI information architecture

A dedicated `Кредит и депозиты` section was added inside the patient finance area. It does not collapse values into a generic balance. Each currency bucket separately shows available credit, deposit reserve, refund reserve, received cash, current debt, and gross unallocated funds before reserves.

## 10. Reservation list

Reservations are shown as cards under `Активные` and `Завершённые`. Optional filters are `Все`, `Активные`, `Использованные`, and `Освобождённые`. The empty state is `У пациента пока нет депозитов.`. Current repository behavior returns the scoped list without server pagination; no new pagination model was introduced.

## 11. Status labels

- `active` → `Активен`
- `partially_used` → `Частично использован`
- `fully_used` → `Использован полностью`
- `released` → `Освобождён`
- `refunded` → `Возвращён`
- `archived` → `Архив`

Active and partially used cards expose permitted actions. Terminal cards are read-only. Archived cards are visually subdued, and every state is communicated by text rather than color alone.

## 12. Purpose labels

- `general` → `Общий депозит`
- `appointment` → `Под запись`
- `treatment_plan` → `Под план лечения`
- `service` → `Под услугу`, using the supplied service label when present
- `other` → trimmed `purpose_label`

`other` requires 2–120 characters. Appointment and treatment-plan selections only pass an existing identifier to the reservation RPC and do not mutate clinical or scheduling records. Raw metadata is never rendered.

## 13. Create flow

`Создать депозит` is available to owner, admin, and cashier only when tenant/patient context exists and at least one payment has authoritative available credit. The dialog shows payment date, method, amount, allocated amount, completed refunds, refund reserve, deposit reserve, and available credit. It validates amount, purpose, optional linkage, expiry, and note before invoking the existing create RPC. One idempotency key is generated per stable operation signature and retained through an ambiguous retry. Success text: `Депозит создан.`

## 14. Release flow

Only active or partially used reservations can be released. The UI exposes full release only, requires a reason, sends `amount: null`, and explicitly explains that funds return to available credit rather than being refunded to the patient. Owner/admin can release; cashier, doctor, and registrar cannot. Success text: `Резерв освобождён.`

## 15. Use reserved credit flow

`Использовать депозит` is shown only for actionable reservations with remaining funds and at least one eligible same-tenant, same-patient, same-currency invoice with positive debt. The dialog displays invoice debt, validates against both reservation remainder and invoice balance, then calls `allocate_reserved_credit`. It never calls the new-money payment flow. Partial success: `Часть депозита использована.` Full success: `Депозит использован полностью.`

## 16. Payment capacity display

Payment selection renders exact values from `getPaymentFundCapacity`:

- payment amount;
- active allocated amount;
- completed refund amount;
- refund-reserved amount;
- deposit-reserved amount;
- available credit.

The UI does not recompute authoritative payment capacity.

## 17. Finance summary integration

The section renders `reservedDepositAmount`, `availableCreditAmount`, `refundReservedAmount`, and `grossUnallocatedAmount` from the existing finance summary. Copy explains that available credit is already-received money not allocated, refunded, or reserved. Gross unallocated is shown separately as the pre-reserve value.

## 18. Cashier surface

The cashier summary now includes a compact read-only `Резерв депозита` value alongside debt, available credit, and refund reserve. Full reservation management remains in the patient finance section. No cashier prepayment intake was added.

## 19. Role matrix

| Role | View summary | View reservation details | Create | Release | Use |
|---|---:|---:|---:|---:|---:|
| Owner | Yes | Yes | Yes | Yes | Yes |
| Admin | Yes | Yes | Yes | Yes | Yes |
| Cashier | Yes | Yes | Yes | No | Yes |
| Doctor | Read-only indicator | No | No | No | No |
| Registrar | Read-only indicator | No | No | No | No |
| Unknown/no tenant | No fetch | No | No | No | No |

Browser smoke confirmed tenant B cannot see tenant A patient reservations.

## 20. Stale-context protection

Reservation reads are keyed by tenant, patient, role, and payment state. Patient or tenant changes reset old reservation/capacity data. Request IDs suppress late list/capacity responses. Mutation context is captured and stale create/release/consume completions do not update a new patient. Open dialogs and action feedback reset on tenant, patient, or role changes.

## 21. Uncertain-response reconciliation

Create, release, and consume flows enter `Проверяем текущее состояние операции…` after ambiguous failures, refetch reservations/allocations/capacity, and inspect the intended transition. Confirmed commits become success; unconfirmed operations show a safe refreshed failure while retaining the same idempotency key. Browser smoke intentionally dropped one successful create response after commit; reconciliation found the single committed reservation and displayed success without a duplicate.

## 22. Safe error mapping

Mapped user-facing errors include insufficient credit, unavailable payment, terminal reservation, idempotency conflict, unavailable invoice, role denial, and deposit-reserved blocking. Generic failure is `Не удалось выполнить операцию. Данные обновлены, повторите попытку.` Raw SQLSTATE, trigger, constraint, stack, and PostgREST object data are not rendered.

## 23. Accessibility

Dialogs use `role="dialog"`, `aria-modal`, labelled controls, keyboard Escape dismissal when safe, explicit disabled states, progress messages, numeric constraints, safe decimal parsing, textual statuses, and empty/no-credit states. Duplicate submit is blocked while an operation or reconciliation is in flight.

## 24. Repository/client tests

Existing repository/client methods were reused. Tests verify reservation and capacity RPC calls, create/release/consume parameter mapping, numeric and null mapping, status/purpose validation, idempotency behavior, safe plain-object PostgREST normalization, and absence of direct table writes, localStorage, service-role use, or `patients.balance` truth. Targeted repository/client tests: 97 passed.

## 25. Hook tests

Hook tests cover no-context suppression, role-based no-fetch, list/capacity loading, patient/payment stale suppression, safe errors, create/release/consume mapping, idempotency retention, committed-response reconciliation, unconfirmed safe failure, duplicate submit blocking, role denial, stale mutation suppression, refresh callbacks, and raw-error hiding. Targeted hook tests: 16 passed.

## 26. Component tests

Component tests cover empty state, every lifecycle status, purpose labels, amounts, create/release/use role gating, terminal read-only behavior, authoritative capacity display, validations, invoice debt, duplicate-submit states, safe messages, cashier compact summary, doctor/registrar indicators, no-tenant behavior, keyboard dismissal, context-change closure, and absence of `Принять оплату` inside the reserved-credit dialog. New dialog/panel component tests: 25 passed.

## 27. Browser smoke

Real localhost UI and local Supabase Auth were used.

- A: patient with no reservations showed the empty state and correct credit.
- B: creating 300 from a 1000 payment produced an active card, reserve 300, available credit 700, gross unallocated 1000, and no payment row.
- C: 800 with only 700 available was blocked and created no row/event.
- D: release restored available credit and created no refund.
- E: using 250 from a 400 reservation produced one allocation, `partially_used`, and remainder 150.
- F: using the final 150 produced `fully_used` and zero remaining reserve.
- G: generic allocation/refund paths were blocked while 700 remained reserved; no allocation/refund row was created.
- H: a committed create response was intentionally lost; reconciliation showed progress and then success with one row.
- I: admin/cashier/doctor/registrar/no-tenant/tenant-B behavior matched the role matrix.
- J: a delayed patient-A reservation response never replaced patient-B state after an SPA switch.

The A–F browser runner was formally marked false only because a page-wide assertion forbade the legitimate existing `Принять оплату` button elsewhere on the finance page; the reserved-credit dialog itself is verified not to contain that label. G was formally marked false because the assertion expected local `Сумма превышает доступную.`, while the backend correctly returned the stronger safe deposit-reserve message. Lifecycle, security, console, and database assertions passed.

## 28. DB validation

Before cleanup, browser smoke produced exactly:

- four reservations: two active (900 remaining total), one released 300, one fully used 400;
- two active reserved-credit allocations totaling 400;
- zero refunds;
- no UI-created payment rows;
- main invoice 500 → paid 400 → debt 100;
- guard invoice unchanged at debt 500;
- no negative payment capacity;
- deposit capacities of 700/200 remained distinct from available credit;
- audit counts: created 4, partially used 1, fully used 1, released 1, reserved-credit allocated 2;
- matching activity-event counts.

## 29. Side-effect validation

`patients.balance` remained deliberately different and unchanged at 321/654/987. Appointments, treatment plans, completed services, and documents remained at zero for the QA patient. No clinical mutation, document, stock, provider, fiscal, cross-patient, or cross-tenant operation occurred.

## 30. Cleanup

Vite was stopped. Temporary browser-only network shims, SPA switch control, SQL fixtures, and backup files were removed. Final local Supabase reset completed without QA reseeding. Exact verification returned zero task patient IDs, zero task payments, zero task reservations, and zero QA users.

## 31. Lint/test/build

Checks:

- Eight required targeted test commands: passed.
- Combined task-targeted suite: 153 passed.
- Full suite: 79 files, 809 tests passed.
- ESLint: passed.
- TypeScript/Vite production build: passed.
- Existing unrelated React `act(...)` warnings and the existing large-bundle warning remain non-failing.
- Foundation SQL regression: passed after clean reset.
- Foundation concurrency regression: passed, including refund transition races with `deadlocks=0`.

## 32. GitHub Actions CI

PR #341 implementation CI run #680 (`29135644763`) completed successfully on `325c1025ef4a0d38683bf085763a4cb32fc93600`. ESLint, the full test suite, and the production build passed. A fresh CI run on the report-only update commit is verified in the final handoff because that commit does not exist until this report version is created.

## 33. Known limitations

Issues/Limitations:

- The current repository RPC returns a scoped reservation list without pagination; this task uses that existing behavior.
- Actor display names are unavailable in the read DTO and are not shown.
- Payment display uses date, method, amount, and shortened ID because no richer payment reference is available.
- Appointment/treatment-plan labels require safely supplied options; otherwise cards fall back to shortened linked IDs.
- Partial release is supported by the backend but intentionally not exposed.
- Browser network interception was local-only and removed before commit.

## 34. What was intentionally not implemented

No migration, lifecycle state, expiry automation, forfeiture, refund integration, new-money/prepayment intake, overpayment acceptance, cross-patient transfer, cross-tenant transfer, provider/fiscal integration, documents, stock, timeline, cloud apply, generated types, seed changes, broad redesign, HEP-V2, or next task was implemented.

## 35. Final verdict

PATIENT CREDIT DEPOSITS UI IMPLEMENTED AND VERIFIED

## 36. Recommended next task

`CASHIER-CREDIT-PREPAYMENT-001`

After deposits can be managed and consumed through the patient finance UI, the next operational step is allowing cashier staff to intentionally accept money without an existing invoice as a prepayment, while clearly distinguishing new cash from use of existing credit.
