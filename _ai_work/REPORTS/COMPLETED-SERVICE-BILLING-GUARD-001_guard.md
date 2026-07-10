# COMPLETED-SERVICE-BILLING-GUARD-001

## 1. Summary
Implemented a database-authoritative historical billing lock: one `completed_services` row can back at most one `invoice_items` row. Added relationship guards, hardened RPC behavior, a scoped eligibility read model, UI states, SQL/concurrency/unit/browser validation, and no clinical mutations.

## 2. Branch
`feature/completed-service-billing-guard-001`, based on verified `origin/main` `6fdfda06f268967941ad3c83bf58489a50ef21b2` containing PR #338.

## 3. PR URL
Pending PR creation after the implementation commit.

## 4. PR head reviewed before final report update
Pending. The implementation head will be reviewed before the final report-only update.

## 5. Report update commit
N/A because the final report update commit cannot reference itself before creation.

## 6. Changed files
Migration/test files: `supabase/migrations/0021_prevent_duplicate_completed_service_billing.sql`, `supabase/tests/0021_completed_service_billing_guard_test.sql`, `supabase/tests/0021_completed_service_billing_guard_concurrency.ps1`. App/test files: `FinanceRepository`, `FinanceRpcClient`, `usePatientFinance`, `useFinanceActions`, `PatientFinancePanel`, `InvoiceDetail`, and their related tests. Report: this file.

## 7. Pre-read
Reviewed required finance reports (`FINANCE-OPERATIONS-RECON-001`, `FINANCE-SUMMARY-CORRECTNESS-001`, `PAYMENTS-DEBTS-SCHEMA/REPOSITORY/RPC/RPC-CLIENT`, `PATIENT-FINANCE-UI-001`), `COMPLETED-SERVICES-UI-001`, encounter/completed-service reports, RLS/security-definer reports, migrations `0014`-`0020`, finance repositories/RPC/hooks/UI, role helpers, and tests.

## 8. Current completed-service billing model
`completed_services` is the clinical fact. `invoice_items.completed_service_id` is nullable and previously allowed duplicate non-null values. Invoice/item void/archive retained rows. No draft-item removal flow existed. Normal RPC checks were not a concurrency-safe or direct-write invariant, and UI eligibility was not authoritative.

## 9. Duplicate billing risk
Two sessions could both pass an application check and insert two financial lines for one clinical service, duplicating revenue, totals, and success audit/activity events.

## 10. Active billing definition
A service is historically billed when any persisted invoice item has that non-null `completed_service_id`. Parent invoice status, item status, payment, refund, or write-off status does not release it. `completed_service_id IS NULL` remains a manual line outside this invariant.

## 11. Void/archive policy
Invoice void, invoice archive, and item void/archive keep the service locked. Payment void/refund/write-off never unbill it. A non-null source link is immutable. No draft release path was added because no current item-removal workflow exists. Rebilling requires a future explicit correction/reissue workflow.

## 12. Historical precheck
Migration `0021` fails without deleting data for duplicate source links, orphan links, missing parent invoices, invoice-item versus invoice tenant/patient mismatch, and completed-service versus invoice-item tenant/patient mismatch, including voided/archived history. Clean local reset passed repeatedly.

## 13. Database invariant
Smallest safe design, no second ledger:
```sql
CREATE UNIQUE INDEX uq_invoice_items_completed_service_billed_once
ON public.invoice_items (completed_service_id)
WHERE completed_service_id IS NOT NULL;
```
The status-independent index intentionally preserves history. A trigger adds cross-row relationship and eligibility enforcement.

## 14. Relationship guards
For source-backed items: invoice exists; item tenant/patient matches invoice; completed service exists; service tenant/patient matches invoice; status is `completed`; service is not archived; service is not already linked; existing non-null link cannot be cleared or reassigned.

## 15. RPC hardening
`add_invoice_item` keeps its signature and current role policy. It authenticates, validates membership/role, locks invoice and service, validates scope/finality/archive, inserts under the unique index, updates totals, emits audit/activity, and commits atomically. Only the named unique constraint maps to `Эта выполненная услуга уже включена в другой счёт.` A failed race creates no item, total, or success event.

## 16. Direct-write protection
`authenticated` has no direct invoice-item INSERT; `anon` has no billing/eligibility RPC execute; privileged inserts still hit trigger/index. No frontend `service_role` and no completed-service write path were added.

## 17. Billing eligibility read model
Added tenant/patient-scoped `get_completed_service_billing_eligibility`, returning `unbilled|billed|unavailable`, service details, and safe billed metadata: invoice ID, item ID, number, validated status, and billed time. It is not derived from paginated client data.

## 18. Repository/client integration
Repository/client call the exact scoped RPC, validate billing state and invoice status, and hide raw errors. Browser smoke exposed real Supabase plain-object `PostgrestError` behavior; normalization now supports both `Error` instances and plain structured objects. Unrelated `23505` remains generic.

## 19. UI behavior
Unbilled services are selectable and populate service fields. Billed/unavailable services are disabled with `Уже включено в счёт №…` or `Недоступно`. Manual line stays explicit. Loading blocks repeat submission. Duplicate response refreshes eligibility and shows `Услуга уже была включена в другой счёт. Данные обновлены.` No fallback to manual or source-ID stripping occurs.

## 20. Manual item limitation
Manual items with null source remain allowed. The guard prevents duplicate linkage of the same completed-service ID, not a deliberately typed semantically similar manual description. No fuzzy matching was added.

## 21. Role matrix
Owner/admin/cashier: view and add under existing policy. Doctor/registrar: finance read-only. No-tenant and anon: blocked. Tenant B cannot view or bill tenant A. No role was broadened.

## 22. SQL tests
Self-contained transactional SQL creates its own tenants/users/memberships/patients/invoices/services. It covers first/duplicate billing, same/other invoice, direct duplicate, two services, manual null, cross-tenant/patient, parent mismatch, orphan, corrected/archived source, roles, no-tenant/anon, stable scoped eligibility, totals, audit/activity atomicity, void/archive lock, link immutability, and side-effect snapshots. Final result: `COMPLETED-SERVICE-BILLING-GUARD-001 SQL validation passed`.

## 23. Concurrency tests
Separate authenticated PostgreSQL sessions proved same-service race `success=1 rejected=1 items=1 audit=1 activity=1 totals=100.00/0.00`; different services `success=2 items=2 audit=2 activity=2 totals=200.00/300.00`; retry remains non-duplicating. Result: `CONCURRENCY VALIDATION PASSED`.

## 24. TypeScript tests
Repository/client/hook/UI tests cover exact arguments, mappings, invalid states, safe duplicate mapping for real/plain errors, unrelated unique errors, stale-patient protection, duplicate refresh, disabled labels, invoice number, field population, manual option, loading, no direct writes/service role. Full suite: 73 files, 754 tests passed.

## 25. Browser smoke
Local-only QA fixtures verified admin normal billing, manual item, billed label, voided-invoice historical lock, unavailable states, cashier add access, doctor/registrar read-only, no-tenant block, and tenant-B isolation. A two-browser stale race produced one success and one expected HTTP 409; after fixing plain-object error normalization, the loser showed the safe refreshed message and billed label. No secrets or raw SQL were shown; no fatal console error occurred.

## 26. DB validation
Browser DB check: zero duplicate links; draft invoice total/balance 3,450 KZT for 1,500+250+800+900; one manual line; voided invoice retained one link; each successful race had one link; tenant-B service stayed unlinked. Final reset counts: tenants/patients/invoices/items/QA users all zero.

## 27. Audit/activity validation
Three browser billing successes produced three audit and three activity events, one pair per service; losing race produced none. Standalone concurrency independently verified one success pair and no failed-transaction event.

## 28. Side-effect validation
`patients.balance`, completed-service facts, appointments, payments, refunds, financial adjustments/write-offs, documents, treatment plans, and clinical history were unchanged. No payment/refund/write-off code changed. Current schema has no stock table to mutate or snapshot.

## 29. Cleanup
All QA data was local-only; Vite processes stopped; final `npx supabase db reset --no-seed` passed; fixture counts returned zero; no seed/generated types committed; agent prompts/logs excluded.

## 30. Lint/test/build
`npm run lint`: passed. `npm run test -- --run`: 73 files/754 tests passed. `npm run build`: passed. SQL, concurrency, and repeated clean reset through `0021`: passed. Existing unrelated React `act(...)` warnings and Vite chunk advisory remain non-fatal.

## 31. GitHub Actions CI
Pending PR creation and fresh CI on the current PR head.

## 32. Cloud apply precheck
No cloud action performed. Before future apply, require empty results for: duplicate non-null `completed_service_id` groups; orphan links; invoice-item/invoice tenant or patient mismatch; completed-service/item tenant or patient mismatch. Migration intentionally fails rather than deleting or choosing a winner.

## 33. Known limitations
Manual semantic duplicates are not detected. Controlled rebilling is deferred. No broad invoice-item idempotency foundation was added; this unique guard is authoritative for completed-service linkage. Browser smoke was local-only. The losing race naturally emits network-level 409, converted to safe UI text.

## 34. What was intentionally not implemented
No correction foundation, credit/debit notes, rebill workflow, clinical mutations, payment/refund/write-off/deposit changes, patient-credit foundation, fuzzy matching, cloud apply, seed/generated types, frontend service role, HEP-V2, or broad refactor.

## 35. Final verdict
PARTIAL: fresh GitHub Actions CI on the current PR head has not yet been verified.

## 36. Recommended next task
`PATIENT-CREDIT-DEPOSITS-FOUNDATION-001` because duplicate clinical billing is now blocked and safe prepayment/credit/deposit handling is the next major finance capability. Do not start it in this task.
