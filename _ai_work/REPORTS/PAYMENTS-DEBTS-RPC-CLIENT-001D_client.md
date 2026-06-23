# PAYMENTS-DEBTS-RPC-CLIENT-001D: Finance RPC Client

## 1. Summary

Implemented a typed frontend RPC client for the controlled finance invoice/payment write RPCs introduced by `supabase/migrations/0017_create_finance_rpc.sql`.

The client centralizes all finance write RPC calls in one repository-layer module, validates required frontend inputs before calling Supabase, maps camelCase frontend inputs to exact SQL `p_*` RPC parameters, maps returned snake_case rows to existing camelCase finance domain models, and normalizes validation/Supabase errors into a predictable client error shape.

No UI, React hooks, migrations, SQL edits, cloud Supabase, seed data, generated types, refunds/write-offs/discounts, stock, documents, timeline, or reports UI were added.

## 2. Branch

- Branch: `feature/payments-debts-rpc-client-001d`
- Base branch: `main`
- Base commit before implementation: `258e3174ea7c22a0e7f8f5c35089fde9225a84df`

## 3. PR URL

- PR URL: Pending until PR creation. This report will be updated with the final PR URL after the branch is pushed and the PR exists.

## 4. PR Head Reviewed Before Final Report Update

- PR head reviewed before final report update: Pending until PR creation.

## 5. Report Update Commit

- Report update commit: N/A because the final report update commit cannot reference itself before creation.

## 6. Changed Files Summary

Expected changed files:

- `src/data/repositories/FinanceRpcClient.ts`
- `src/data/repositories/FinanceRpcClient.test.ts`
- `_ai_work/REPORTS/PAYMENTS-DEBTS-RPC-CLIENT-001D_client.md`

No migration, UI, hook, cloud, seed, generated type, stock, document, timeline, HEP-V2, or finance report UI files were changed.

## 7. Pre-read Summary

Reviewed the finance workflow context from the existing reports and implementation files:

- Finance schema report and migration `0016_create_finance_model.sql` define invoices, invoice items, payments, and payment allocations.
- Finance repository report and `FinanceRepository.ts` provide existing domain models and snake_case-to-camelCase mappers for `Invoice`, `InvoiceItem`, `Payment`, and `PaymentAllocation`.
- Finance RPC report and `0017_create_finance_rpc.sql` define the controlled SECURITY DEFINER finance write RPCs.
- Existing RPC client pattern from `EncounterVisitRpcClient.ts` uses injected Supabase client dependencies, repository-layer methods, explicit validation, `.rpc(...)` calls, and deterministic test mocks.

## 8. Client Design

File added:

- `src/data/repositories/FinanceRpcClient.ts`

The client exposes:

- `FinanceRpcClientError`
- `FinanceRpcClient` interface
- `SupabaseFinanceRpcClient` implementation
- `createFinanceRpcClient(client)` factory
- typed input types for all controlled finance RPC write operations

Supabase client injection:

- The client receives a `SupabaseClient` instance through the constructor/factory.
- It does not create a privileged client.
- It does not use service role credentials.
- It does not read from localStorage.

Input validation:

- Required IDs are validated before RPC calls.
- Amount and quantity constraints are validated before RPC calls.
- Metadata is accepted only as a plain object when provided.
- Invalid frontend inputs throw `FinanceRpcClientError` before any `.rpc(...)` call.

Result mapping:

- The client reuses existing exported mappers from `FinanceRepository.ts`:
  - `mapInvoiceRow`
  - `mapInvoiceItemRow`
  - `mapPaymentRow`
  - `mapPaymentAllocationRow`

## 9. RPC Mapping

Implemented methods and RPC mappings:

- `createInvoice` -> `create_invoice`
- `addInvoiceItem` -> `add_invoice_item`
- `issueInvoice` -> `issue_invoice`
- `voidInvoice` -> `void_invoice`
- `recordPayment` -> `record_payment`
- `allocatePayment` -> `allocate_payment`
- `voidPaymentAllocation` -> `void_payment_allocation`
- `voidPayment` -> `void_payment`

Parameter mapping uses exact SQL `p_*` names:

- `tenantId` -> `p_tenant_id`
- `patientId` -> `p_patient_id`
- `invoiceId` -> `p_invoice_id`
- `invoiceItemId` -> `p_invoice_item_id`
- `paymentId` -> `p_payment_id`
- `allocationId` -> `p_allocation_id`
- `serviceName` -> `p_service_name`
- `quantity` -> `p_quantity`
- `unitPrice` -> `p_unit_price`
- `discountAmount` -> `p_discount_amount`
- `adjustmentAmount` -> `p_adjustment_amount`
- `completedServiceId` -> `p_completed_service_id`
- `serviceCode` -> `p_service_code`
- `toothNumber` -> `p_tooth_number`
- `toothSurface` -> `p_tooth_surface`
- `paymentMethod` -> `p_payment_method`
- `receivedAt` -> `p_received_at`
- `externalReference` -> `p_external_reference`
- `payerName` -> `p_payer_name`
- `currency` -> `p_currency`
- `dueDate` -> `p_due_date`
- `notes` -> `p_notes`
- `metadata` -> `p_metadata`
- `reason` -> `p_reason`

## 10. Domain / Result Mapping

Returned database rows are mapped to existing finance domain models:

- `Invoice`
- `InvoiceItem`
- `Payment`
- `PaymentAllocation`

Mapping preserves:

- nullable fields;
- metadata objects;
- numeric amount conventions from the existing repository mappers;
- timestamp string conventions from the existing repository mappers.

## 11. Error Handling

Validation errors throw `FinanceRpcClientError` with:

- operation name;
- safe user-facing message;
- optional code for Supabase errors.

Supabase RPC errors are normalized to `FinanceRpcClientError` and include the operation name without dumping raw Supabase response objects or secrets.

Safe validation messages include:

- `Не выбрана клиника.`
- `Пациент не выбран.`
- `Счёт не выбран.`
- `Название услуги обязательно.`
- `Количество должно быть больше 0.`
- `Сумма должна быть больше 0.`
- `Причина обязательна.`
- `Не удалось выполнить финансовую операцию.`

## 12. Safety Boundaries

Confirmed by implementation and tests:

- no direct `.from(...).insert`;
- no direct `.from(...).update`;
- no direct `.from(...).delete`;
- no direct `.from(...).upsert`;
- no `localStorage`;
- no `service_role`;
- no `patients.balance` access or mutation;
- no `completed_services` mutation;
- no refunds/write-offs/discount features added;
- no UI imports;
- no React hooks;
- no cloud Supabase;
- no migrations;
- no seed;
- no generated types;
- no HEP-V2 work.

## 13. Tests

Added:

- `src/data/repositories/FinanceRpcClient.test.ts`

Coverage includes 40 tests:

- all 8 RPC methods call the expected Supabase `.rpc(...)` names;
- all required `p_*` parameter mappings are verified;
- missing required IDs are rejected;
- invalid amounts/quantity are rejected;
- invalid payment method is rejected;
- metadata must be a plain object;
- invoice/item/payment/allocation result mapping to camelCase is verified;
- nullable fields and metadata preservation are verified;
- Supabase RPC errors are normalized;
- null data is handled safely;
- direct table writes and forbidden dependencies are guarded.

## 14. Local Validation

Local Supabase validation:

- `npx supabase db reset --no-seed`: passed.
- Migration `0017_create_finance_rpc.sql` applied after `0016_create_finance_model.sql`.
- Local RPC catalog check confirmed the 8 public finance RPCs exist.
- The 8 public finance RPCs were verified as `SECURITY DEFINER` with `search_path = public, pg_temp`.
- Supabase cloud was not used.

Optional local functional RPC smoke was not run in this task because the requested scope was frontend typed client plus unit/local validation and browser smoke was explicitly forbidden.

## 15. What Was Intentionally Not Changed

Intentionally not changed:

- no Supabase migrations;
- no SQL function edits;
- no UI;
- no React hooks;
- no cloud Supabase;
- no seed data;
- no generated types;
- no refunds/write-offs/discounts;
- no stock;
- no documents;
- no timeline;
- no reports UI;
- no HEP-V2 work.

## 16. Checks

Local checks:

- `git status --short`: expected scoped changes only.
- `npm run lint`: passed.
- `npm run test -- --run src/data/repositories/FinanceRpcClient.test.ts`: passed, 40/40 tests.
- `npm run test -- --run`: passed, 61 files / 620 tests.
- `npm run build`: passed.

GitHub Actions CI:

- Pending until PR creation and push.

## 17. Issues / Warnings

Existing unrelated warnings:

- old React `act(...)` warnings remain in unrelated UI test files;
- Vite chunk-size warning remains for the main application bundle.

These warnings are pre-existing project noise and do not block this finance RPC client task.

Skipped by instruction:

- browser smoke was not run;
- Supabase cloud was not touched;
- UI integration was not started.

## 18. Final Verdict

PAYMENTS DEBTS RPC CLIENT IMPLEMENTED AND VERIFIED

## 19. Recommended Next Task

PATIENT-FINANCE-UI-001
