# POST-FINANCE-ROADMAP-RECON-001 — Current-state reconciliation and post-finance roadmap

## 1. Final verdict

**POST-FINANCE ROADMAP RECONCILED AND NEXT TASK VERIFIED**

Repository evidence at baseline `5d8970c350b4678036f175791e8130b1f56ef200` shows that DentalFlow is no longer a localStorage-only prototype and no longer lacks a finance foundation. Authentication, tenant membership, core patient/clinical persistence, visit/encounter/completed-service workflows, audit/activity, invoice/payment/refund/write-off operations, patient credit, and deposit reservation/use are implemented. The largest remaining risks are not generic missing modules, but specific operational invariants and unreachable or incomplete workflows.

Exactly one next task is recommended:

`CASHIER-CREDIT-PREPAYMENT-HARDENING-001`

It must harden the existing `payments`/`record_payment` model for intentional, idempotent, recoverable unallocated-credit intake. It must not create a second prepayment ledger or duplicate the already merged patient-credit/deposit foundation.

## 2. Executive summary

**Summary:** DentalFlow currently contains three different maturity bands:

1. **Implemented and verified operational core**
   - Supabase authentication and tenant membership;
   - tenant-scoped patient directory and patient card;
   - chief complaint, findings, dental chart, clinical dictionaries, treatment plans;
   - patient visits, clinical encounters, completed services;
   - patient timeline and admin audit/activity viewer;
   - invoices, invoice items, payments, allocations, refunds, write-offs;
   - patient finance summary, patient credit, deposit reservation/release/use;
   - idempotent multi-invoice cashier payment;
   - patient file metadata and Supabase Storage foundation.

2. **Implemented with material gaps or mixed authority**
   - route-level role visibility;
   - patient card tabs and file reachability;
   - treatment-plan lifecycle governance;
   - diagnosis as a patient clinical fact;
   - schedule conflict enforcement and operational workflows;
   - generic unallocated payment intake;
   - finance corrections, discounts, cash shifts, reports, debt collections;
   - document snapshots;
   - amoCRM OAuth skeleton;
   - platform subscriptions/access enforcement.

3. **Placeholders or absent modules**
   - top-level Finance, Documents, Warehouse, Mailing, Settings, Statistics, Reports, Bonus, SMS, CRM, Doctors and Appointments pages are placeholders;
   - warehouse, notifications, public booking, imports/exports, cashier shifts, debt collection and AI-assisted functions are not operational;
   - documents and SaaS billing have schema fragments but no complete operational workflow.

The repository has **22 migrations**, through `0022_create_patient_fund_reservations.sql`, and high-risk encounter/finance mutations are generally routed through tenant/role-aware RPCs. Earlier core modules still use direct Supabase table CRUD under RLS and retain localStorage adapters for development mode.

The main roadmap correction is therefore:

```text
Do not rebuild patients, schedule, treatment plans, finance, refunds,
write-offs, patient credit or deposits as generic new modules.

Do harden the exact unfinished operational boundary.
```

## 3. Branch

`recon/post-finance-roadmap-recon-001`

## 4. PR URL

https://github.com/NckNA/codex-test/pull/342

## 5. Baseline

Required and verified baseline:

`5d8970c350b4678036f175791e8130b1f56ef200`

Verification:

- `origin/main` resolved to the required SHA after fetch;
- PR #341 was confirmed merged into `main` with merge commit `5d8970c350b4678036f175791e8130b1f56ef200`;
- the report worktree was fast-forwarded to that exact baseline;
- the worktree was clean before report creation.

## 6. PR head reviewed before final report update

Implementation/report head reviewed before the final metadata update: `ba99a71aa9462e8539b71fcc80724024aff8e96b`.

GitHub Actions CI run `#683` (run ID `29149263631`) completed successfully on that exact SHA. The PR contained exactly one changed file and no application, SQL, migration, test, generated-type, seed or dependency changes.

## 7. Report update commit

Report update commit: N/A (the report commit cannot reference itself; use the finalization receipt). The immutable finalization receipt and final PR metadata snapshot must identify the report-only commit and fresh CI run.

## 8. Changed files

Expected and intended changed files:

- `_ai_work/REPORTS/POST-FINANCE-ROADMAP-RECON-001_roadmap.md`

No optional roadmap/index document was updated. This is deliberate: both `PROJECT_ROUTES.md` and `16_DEVELOPMENT_ROADMAP_AND_TASK_BACKLOG.md` are materially stale, but rewriting either inside this reconciliation would mix historical correction with the evidence report. The current report records exact stale claims and can be referenced by a later small documentation-only correction task.

## 9. Sources reviewed

### Required project sources

All provided source documents were reviewed:

- `_ai_work/SOURCES/00_PROJECT_MASTER_CONTEXT.md`
- `_ai_work/SOURCES/01_PRODUCT_VISION_AND_BUSINESS_MODEL.md`
- `_ai_work/SOURCES/02_ROLES_AND_PERMISSIONS.md`
- `_ai_work/SOURCES/03_MULTI_TENANT_ARCHITECTURE_RULES.md`
- `_ai_work/SOURCES/04_DATA_ISOLATION_AND_SECURITY.md`
- `_ai_work/SOURCES/05_MEDICAL_DOMAIN_MODEL.md`
- `_ai_work/SOURCES/06_PATIENT_CARD_AND_DENTAL_CHART_RULES.md`
- `_ai_work/SOURCES/07_TREATMENT_PLAN_AND_DOCUMENTS.md`
- `_ai_work/SOURCES/08_APPOINTMENTS_AND_SCHEDULE.md`
- `_ai_work/SOURCES/09_AMOCRM_INTEGRATION_RULES.md`
- `_ai_work/SOURCES/10_AMOCRM_TECHNICAL_ARCHITECTURE.md`
- `_ai_work/SOURCES/11_BACKEND_AND_API_ARCHITECTURE.md`
- `_ai_work/SOURCES/12_BILLING_AND_ACCESS_CONTROL.md`
- `_ai_work/SOURCES/13_STORAGE_AND_MIGRATION_STRATEGY.md`
- `_ai_work/SOURCES/14_UI_UX_RULES.md`
- `_ai_work/SOURCES/15_AI_WORKFLOW_FOR_JULES_CODEX_CHATGPT.md`
- `_ai_work/SOURCES/16_DEVELOPMENT_ROADMAP_AND_TASK_BACKLOG.md`
- `_ai_work/SOURCES/17_TASK_TEMPLATE_AND_PR_REVIEW_CHECKLIST.md`
- `_ai_work/SOURCES/18_TESTING_AND_QUALITY_ASSURANCE_STRATEGY.md`
- `_ai_work/SOURCES/SOURCES_INDEX.md`

`SOURCES_INDEX.md` marks documents 00–18 as **Provided**.

### Current maps

- `_ai_work/PROJECT_ROUTES.md`
- `_ai_work/ARCHITECTURE_CURRENT.md`
- actual `src/App.tsx`, `Sidebar.tsx`, page/component/repository/hook inventories.

### Finance evidence

Reviewed current code, migrations, SQL/concurrency tests and reports for:

- `FINANCE-OPERATIONS-RECON-001`
- `CASHIER-PAYMENT-FLOW-001`
- `CASHIER-PAYMENT-FLOW-HARDENING-001`
- `REFUNDS-WRITEOFFS-FOUNDATION-001`
- `REFUNDS-WRITEOFFS-UI-001`
- `FINANCE-SUMMARY-CORRECTNESS-001`
- `COMPLETED-SERVICE-BILLING-GUARD-001`
- `PATIENT-CREDIT-DEPOSITS-RECON-001`
- `PATIENT-CREDIT-DEPOSITS-FOUNDATION-001`
- `PATIENT-CREDIT-DEPOSITS-UI-001`
- all finance-related reports under `_ai_work/REPORTS`.

### Clinical, schedule, security and integration evidence

Reviewed current repository code and relevant reports for:

- patient persistence and browser QA;
- chief complaint, findings, dental chart and treatment plans;
- treatment-plan generation/deletion cleanup;
- visits, encounters and completed services;
- patient timeline and summary;
- appointment persistence and browser QA;
- auth, no-tenant and multi-tenant browser QA;
- audit/activity and admin viewer;
- patient file metadata and dental-photo storage;
- amoCRM mapper/backend skeleton;
- documents, warehouse, mailing, settings and platform billing placeholders/foundations.

## 10. Repository inventory

### Application structure

| Area | Current inventory | Interpretation |
|---|---:|---|
| `src/pages` | 20 production page files, 3 page test files | Several routes are operational, but 12 top-level pages are explicit placeholders. |
| `src/components` | 76 production component files, 21 component test files | Most operational functionality lives in patient-card and cashier components rather than top-level module pages. |
| `src/data/repositories` | 14 production repositories/clients, 14 repository/client test files | Every current repository family has automated test coverage. |
| `src/data/hooks` | 32 production hooks, 29 hook test files | Backend selection, stale-response protection and action flows are mostly hook-based. |
| `src/data/orchestrators` | 1 production orchestrator, 1 test file | Clinical multi-entity workflows are coordinated in the frontend layer. |
| `src/data/aggregators` | 3 production aggregators, 3 test files | Patient summary/timeline/read-model composition exists. |
| `src/context` / `src/hooks` | Schedule UI context/provider plus accessor | Context stores date/view/filter state, not appointment persistence. |
| `src/contexts` | Auth and Tenant providers | Supabase session/membership foundation with dev fallback. |
| `src/integrations/amocrm` | mapper and types | Frontend-safe commercial mapping only. |
| `backend` | Node HTTP integration proxy skeleton | Health route and amoCRM OAuth skeleton; memory stores; real sync absent. |
| `supabase/migrations` | 22 migrations, `0001` through `0022` | Current authoritative schema/RPC evolution. |
| `supabase/tests` | 9 SQL/concurrency scripts | Finance high-risk invariants are tested at database/concurrency level. |
| `_ai_work/REPORTS` | 273 report files at reconciliation time | Valuable historical evidence, but not all claims remain current. |
| `_ai_work/SOURCES` | source documents 00–18 plus index | Stable architectural rules are present. |

### Current route-bearing pages

Operational top-level pages:

- `SchedulePage`
- `PatientsPage`
- `PatientCardPage`
- `MedicalPage`
- `CashierPaymentPage`
- `AdminAuditPage`

Explicit placeholder top-level pages:

- `CrmPage`
- `AppointmentsPage`
- `DocumentsPage`
- `DoctorsPage`
- `FinancePage`
- `WarehousePage`
- `StatisticsPage`
- `ReportsPage`
- `BonusPage`
- `MailingPage`
- `SmsPage`
- `SettingsPage`

Operational functionality hidden below the patient route:

- visits;
- encounters;
- completed services;
- dental chart;
- chief complaint/findings;
- treatment plans;
- patient timeline;
- finance, refunds, write-offs, credit and deposits.

## 11. Module status legend

Exactly one primary status is assigned to each module:

- `IMPLEMENTED_AND_VERIFIED`: code, persistence, permissions/invariants, tests and meaningful runtime/browser evidence align for the stated scope.
- `IMPLEMENTED_WITH_GAPS`: operational workflow exists, but material lifecycle, authority, reachability, permission or correctness gaps remain.
- `PARTIAL`: only a subset of the workflow exists, or multiple layers do not yet form one complete operation.
- `BACKEND_ONLY`: schema/RPC/backend exists without an operational frontend workflow.
- `UI_ONLY`: interactive UI exists without authoritative persistence or backend enforcement.
- `PLACEHOLDER`: route/component intentionally displays future-work content.
- `ARCHITECTURE_ONLY`: rules/design exist without operational implementation.
- `LOCALSTORAGE_ONLY`: current source of truth is localStorage only.
- `DEPRECATED_OR_STALE`: retained document/code is materially superseded.
- `NOT_IMPLEMENTED`: no meaningful current implementation found.

Confidence:

- `HIGH`: implementation, persistence and tests/runtime evidence align for the classified scope.
- `MEDIUM`: evidence is strong, but a dedicated runtime test, persistence layer or complete lifecycle is absent. Placeholder/absent modules use MEDIUM even when exhaustive search strongly supports the finding.
- `LOW`: material repository evidence is ambiguous.

## 12. Full module capability matrix

| # | Module | Primary status | Route/page and main UI | Repository/hooks | Tables/RPC/RLS | Tests/browser validation | Source of truth | Known gaps | Evidence | Confidence |
|---:|---|---|---|---|---|---|---|---|---|---|
| 1 | Authentication | IMPLEMENTED_AND_VERIFIED | `LoginPage`, `App` auth gate | `AuthContext` | Supabase Auth session/JWT | `AuthContext.test.tsx`; `AUTH-TENANT-E2E-001` | Supabase Auth in configured mode; dev identity otherwise | No MFA, reset/recovery/admin user management in product UI | `src/contexts/AuthContext.tsx`, auth reports | HIGH |
| 2 | Tenant membership | IMPLEMENTED_AND_VERIFIED | Header tenant switch, app no-tenant gate | `TenantContext` | `tenant_users`, `tenants`, RLS helpers | `TenantContext.test.tsx`; multitenant/no-tenant browser QA | Supabase | Selection is in-memory per session; no tenant administration UI | `TenantContext.tsx`, migrations `0001/0008`, multitenant reports | HIGH |
| 3 | Roles and permissions | IMPLEMENTED_WITH_GAPS | Per-domain capability helpers; audit nav gating | domain permission helpers | `app_role`, `has_tenant_role`, RLS and RPC checks | role tests and browser role matrices | Database/RPC for high-risk operations; UI mirrors selected roles | Sidebar exposes almost all routes to all roles; source role catalogue is broader than implemented role enum/capability maps; no centralized permission registry | `Sidebar.tsx`, finance/visit/encounter permission files, RLS migrations | HIGH |
| 4 | Patient directory | IMPLEMENTED_AND_VERIFIED | `/patients`, patient modal/search/list | `PatientRepository`, `usePatientsCollection`, `usePatientProfile` | `patients`, tenant RLS | repository/hooks/pages/browser multitenant QA | Supabase in active mode; localStorage in dev | Direct table writes rather than domain RPC; no duplicate-patient workflow/import | patient repo/hooks/pages and patient reports | HIGH |
| 5 | Patient card | IMPLEMENTED_WITH_GAPS | `/patients/:patientId`, operational domain tabs | multiple hooks/aggregators | patient/clinical/finance tables | `PatientCardPage.test.tsx` plus domain browser reports | Mixed by domain, Supabase in active mode | `summary` tab button renders no content; `DentalPhotosPanel` branch is unreachable because no `files` tab; docs placeholder; edit button not route-role hidden | `PatientCardPage.tsx` | HIGH |
| 6 | Chief complaint | IMPLEMENTED_AND_VERIFIED | Findings/Risks tab | `ChiefComplaintRepository`, `useChiefComplaint` | `chief_complaints`, tenant/patient FK/RLS | repository/hook and real browser QA | Supabase active; localStorage dev | No immutable complaint history/versioning; direct table write | chief complaint files/reports | HIGH |
| 7 | Findings | IMPLEMENTED_AND_VERIFIED | Findings/Risks and tooth editor integration | `FindingsRepository`, `usePatientFindings` | `findings`, RLS/status constraints | repository/hooks/components and browser QA | Supabase active; localStorage dev | Status changes are direct CRUD; no separate signed diagnosis fact | findings files/reports | HIGH |
| 8 | Diagnoses | PARTIAL | `MedicalPage` registry; tooth editor selection; chart free-text diagnosis | `ClinicalDictionariesRepository`, `useDictionaries`; chart repository for text | `clinical_dictionary_items`; `dental_charts.diagnosis` text | dictionary tests/browser QA | Tenant clinical dictionary plus chart text | No patient-level diagnosis entity, lifecycle, author, encounter linkage or immutable diagnosis record | `MedicalPage.tsx`, migrations `0005/0010`, diagnosis search | HIGH |
| 9 | Dental chart | IMPLEMENTED_AND_VERIFIED | Dental chart tab, tooth grid/editor, image export | `DentalChartRepository`, `useDentalChart`, clinical workflow hook | `dental_charts`, `tooth_states`, `findings`, RLS | repository/hooks/components/browser QA | Supabase active; localStorage dev | Direct table CRUD; PNG export is client-only artifact, not medical document snapshot | dental files/reports | HIGH |
| 10 | Treatment plans | IMPLEMENTED_WITH_GAPS | treatment-plan tab, stage editor, patient preview, create from findings | `TreatmentPlansRepository`, `useTreatmentPlans`, `ClinicalWorkflowOrchestrator` | `treatment_plans`, `treatment_stages`, `save_treatment_plan_with_stages` | repository/hook/orchestrator/components/browser QA | Supabase active; localStorage dev | Multi-entity create/delete cleanup is frontend orchestration rather than one DB transaction; status governance/approval history/document snapshot incomplete | treatment files/reports | HIGH |
| 11 | Completed services | IMPLEMENTED_AND_VERIFIED | patient Services tab | `EncounterVisitRepository/RpcClient`, completed-service hooks | `completed_services`; `record_completed_service`, `void_completed_service` | repository/RPC/hooks/components/browser smoke; SQL billing guard | Supabase/RPC | Correction columns exist but controlled correction workflow is absent; only void operational | migrations `0014/0015/0021`, service reports | HIGH |
| 12 | Clinical workflow | IMPLEMENTED_WITH_GAPS | chart/findings/plan coordination; visits/encounters/services tabs | `ClinicalWorkflowOrchestrator`, encounter/visit clients | mixed direct CRUD plus visit/encounter RPCs | orchestrator/RPC/hooks/UI tests | Supabase active; local adapters for early modules | Cross-entity chart/findings/plan operations are not fully atomic at DB level; encounter notes are summary-level, not full immutable clinical note/correction model | orchestrator and clinical reports | HIGH |
| 13 | Patient timeline | IMPLEMENTED_AND_VERIFIED | patient History tab | `PatientTimelineAggregator`, `usePatientTimeline`, audit repository | reads appointments, clinical, files, finance/activity facts | aggregator/hook/component and browser smoke | Calculated read model | Actor display and deep links are incomplete for some event types; dev mode omits Supabase-only audit facts | timeline files/reports | HIGH |
| 14 | Appointments | IMPLEMENTED_WITH_GAPS | schedule day grid/modal; patient appointment history | `AppointmentRepository`, appointment hooks | `appointments`, tenant RLS, direct CRUD | repository/hooks/modal/page and browser QA | Supabase active; localStorage dev | No mutation RPC, server conflict lock, cancellation reason, reschedule chain or audit event | appointment repo/hooks/migration/reports | HIGH |
| 15 | Schedule | IMPLEMENTED_WITH_GAPS | `/`, day view with doctors/time slots | appointment/doctor/patient hooks; schedule UI context | appointments/doctors/patients | page/modal/repository tests and browser QA | Mixed dev/Supabase | Only day view; week/month show future message; hardcoded “tasks today”; client-only conflict check; no resource model/waitlist/recurrence | `SchedulePage.tsx`, `AppointmentModal.tsx` | HIGH |
| 16 | Confirmation/no-show workflow | PARTIAL | appointment status buttons include confirmed/no_show | appointment repository/hooks | appointment status column/RLS | modal/repository tests | Appointment row | No reminders, confirmation queue, contact attempts, no-show reason, automated message or rescheduling workflow | appointment modal/types/source 08 | HIGH |
| 17 | Documents | BACKEND_ONLY | `/documents` and patient Docs tab are placeholders | no document repository/hook | `documents` table and RLS from `0001` | no operational document tests/browser workflow | Supabase schema only | No template registry, immutable snapshot generation, statuses/cancellation, print/PDF or audit workflow | migration `0001`, placeholder page, source 07 | MEDIUM |
| 18 | Finance overall | IMPLEMENTED_WITH_GAPS | patient Finance tab and `/cashier/payments`; `/finance` placeholder | finance repository/RPC client and multiple hooks | finance tables and RPCs `0016–0022` | extensive unit, SQL, concurrency and browser QA | Supabase/RPC | No top-level operational finance workspace, cash shifts, corrections, period reporting, debt collection, fiscal/provider integration | finance code/reports | HIGH |
| 19 | Invoices | IMPLEMENTED_AND_VERIFIED | patient Finance tab | finance repository/client/actions | `invoices`, `invoice_items`; create/add/issue/void RPCs | client/repo/hooks/components, SQL/browser finance QA | Supabase/RPC | Issued-invoice correction and governed discount/surcharge flow absent | migrations `0016/0017/0021` | HIGH |
| 20 | Payments | IMPLEMENTED_WITH_GAPS | generic patient “Принять оплату” and cashier payment | finance RPC client/actions/cashier flow | `payments`; `record_payment`, `record_and_allocate_payment`, void | comprehensive tests/browser QA | Supabase/RPC | Generic `record_payment` is not idempotent/recoverable; cashier path is idempotent but rejects invoice-less/overpayment intake | `PaymentActions.tsx`, `FinanceRpcClient.ts`, migrations `0017/0019` | HIGH |
| 21 | Allocations | IMPLEMENTED_AND_VERIFIED | patient allocation form; cashier atomic allocation | finance client/hooks/components | `payment_allocations`; allocate/void RPCs and capacity guards | unit/SQL/concurrency/browser QA | Supabase/RPC | Reservation-backed allocation is intentionally immutable pending future correction flow | migrations `0017/0018/0022` | HIGH |
| 22 | Refunds | IMPLEMENTED_AND_VERIFIED | payment refund actions/lifecycle | refund hook/client | `refunds`; request/approve/complete/reject/void RPCs | unit/SQL/concurrency/browser QA | Supabase/RPC | Governance thresholds/evidence policy may be extended, but lifecycle is real | migrations `0018/0022`, refund reports | HIGH |
| 23 | Write-offs | IMPLEMENTED_AND_VERIFIED | invoice write-off actions/lifecycle | write-off hook/client | `financial_adjustments` with `write_off`; lifecycle RPCs | unit/SQL/concurrency/browser QA | Supabase/RPC | No two-person rule, threshold matrix, reason taxonomy/evidence attachment; those are governance hardening, not missing lifecycle | migration `0018`, UI/report evidence | HIGH |
| 24 | Patient credit | IMPLEMENTED_AND_VERIFIED | finance/cashier summaries | finance repository summary/capacity hooks | calculated from payments, allocations, refunds and reservations; summary/capacity RPCs | SQL/unit/browser QA | Calculated authoritative read model | No intentional idempotent cashier credit-intake operation | migrations `0020/0022` | HIGH |
| 25 | Deposits | IMPLEMENTED_AND_VERIFIED | patient Credit and Deposits panel/dialogs | reservation hooks/repository/client | `patient_fund_reservations`; create/release/use/read RPCs | unit/SQL/concurrency/full browser lifecycle | Supabase/RPC | Partial release intentionally not exposed; linked labels depend available options | migration `0022`, PR #341 report | HIGH |
| 26 | Cashier | IMPLEMENTED_AND_VERIFIED | `/cashier/payments` patient search, invoice selection and atomic payment | cashier hooks/client/components | `record_and_allocate_payment`, recovery RPC | unit/concurrency/browser role QA | Supabase/RPC | No prepayment/overpayment mode; no shifts/till reconciliation/fiscal integration | cashier files/reports | HIGH |
| 27 | Cashier shifts | NOT_IMPLEMENTED | none | none | no shift/till tables or RPCs | none | none | Open/close, expected cash, variance, custody and audit absent | exhaustive code/schema/task search | MEDIUM |
| 28 | Debt collections | NOT_IMPLEMENTED | none | none | no aging/collection/promise/contact tables or RPCs | none | none | Debt aging, owner, promise-to-pay, attempts and legal status absent | code/schema search and finance recon | MEDIUM |
| 29 | Financial reporting | PARTIAL | patient-level finance cards; `/reports`, `/statistics`, `/finance` placeholders | finance summary repository | `get_patient_finance_summary`, capacity RPCs | summary SQL/unit/UI tests | Patient-level calculated read model | No tenant-period ledger reports, reconciliation exports, aging, provider/cashier shift reports or authoritative dashboard read models | migrations `0020/0022`, placeholder pages | HIGH |
| 30 | Warehouse | PLACEHOLDER | `/warehouse` | none | no warehouse tables/RPCs | none | static placeholder | Inventory, movement, supplier, usage linkage and audit absent | `WarehousePage.tsx` | MEDIUM |
| 31 | Mailing | PLACEHOLDER | `/mailing`, `/sms` | none | no notification/message tables/services | none | static placeholder | Templates, consent, queue, provider, delivery status and audit absent | mailing/SMS pages | MEDIUM |
| 32 | amoCRM | PARTIAL | no product settings UI; mapper only in frontend | Node backend OAuth skeleton and pure mapper | memory OAuth state/token stores; no Supabase connection model | backend syntax/check evidence and historical reports | Dev-memory backend skeleton | No tenant-scoped encrypted persistence, refresh lifecycle, sync logs, real sync/webhook validation or feature entitlement | `backend`, `src/integrations/amocrm`, AMO reports | MEDIUM |
| 33 | Clinic settings | PLACEHOLDER | `/settings` | none | no operational settings model beyond existing tenant/domain tables | none | static placeholder | Clinic profile, working hours, resources, permissions/settings UX absent | `SettingsPage.tsx` | MEDIUM |
| 34 | SaaS/platform billing | BACKEND_ONLY | no billing UI | none | `subscriptions` table; tenant status fields | schema/RLS evidence only | Supabase schema fragment | No tariff/entitlement/access guard, manual platform admin, suspension workflow, billing audit or provider | migration `0001`, source 12 | MEDIUM |
| 35 | Audit/activity | IMPLEMENTED_AND_VERIFIED | `/admin/audit`, patient timeline | `AuditActivityRepository`, hooks/aggregator | `audit_events`, `activity_events`, internal recorder functions | repository/hooks/viewer/browser and domain event tests | Supabase | Not every early direct-CRUD module emits full domain audit; retention/export absent | migrations `0012/0013`, admin audit reports | HIGH |
| 36 | Files/storage | PARTIAL | `DentalPhotosPanel` exists but patient-card `files` tab is missing | `PatientFilesRepository`, `usePatientFiles` | Supabase Storage bucket plus `patient_files` metadata/RLS | repository/hook/component/storage reports | Supabase Storage active; local dev fallback | Operational component is unreachable from current patient tab list; no general document/file centre; archive only, no legal snapshot | patient files code, migration `0011`, `PatientCardPage.tsx` | HIGH |
| 37 | Imports/exports | NOT_IMPLEMENTED | no import/export module | none | none | none | none | Dry-run, duplicate detection, permissions, expiry and audit absent; dental PNG download is not domain export | code/route/schema search | MEDIUM |
| 38 | Notifications | NOT_IMPLEMENTED | mailing/SMS placeholders | none | none | none | none | No reminder queue/provider/delivery/consent/audit | placeholder pages and schedule code | MEDIUM |
| 39 | Public booking | NOT_IMPLEMENTED | no public route | none | none | none | none | Tenant routing, slot authority, rate limiting, privacy and entitlement absent | route/schema search | MEDIUM |
| 40 | AI-assisted functions | ARCHITECTURE_ONLY | no product AI UI | none | none | none | source documents only | No reviewed suggestion workflow, model boundary, consent, audit or clinical safety implementation | source 15/18 and code search | MEDIUM |

### Modules classified `UI_ONLY`

No major business module is classified `UI_ONLY`. The repository does contain UI-only fragments:

- hardcoded “tasks today” in `SchedulePage`;
- the patient `summary` tab button without rendered content;
- day/week/month view selection where non-day modes only display a future-work message;
- client-only dental chart PNG export;
- navigation entries for placeholder modules.

These fragments must not be treated as persisted workflows.

### Modules classified `LOCALSTORAGE_ONLY`

No major module is classified `LOCALSTORAGE_ONLY` in Supabase-active operation. LocalStorage adapters remain for development/prototype mode for patients, doctors, appointments, complaint, dental chart, findings, treatment plans and dictionaries. They are alternate dev sources, not the active production-like source when Supabase auth/tenant configuration is present.

## 13. Route/UI reconciliation

| Route | Actual state | Sidebar visibility | Persistence/backend | Reconciliation finding |
|---|---|---|---|---|
| `/` | Operational schedule day view | visible to all tenant roles | appointments/doctors/patients via local or Supabase repositories | Real implementation, but client-side conflict checks and incomplete operations. |
| `/crm` | Placeholder | visible to all | none | Navigation overstates implementation. |
| `/appointments` | Placeholder titled “Приёмы” | visible to all | none on this page | Duplicates terminology with operational patient Visits/Encounters and schedule appointments. |
| `/documents` | Placeholder | visible to all | `documents` table exists but unused | Backend-only schema incorrectly appears as future generic page. |
| `/patients` | Operational | visible to all | tenant-scoped repository | Real implementation. |
| `/patients/:patientId` | Operational multi-domain workspace | dynamic, not sidebar | multiple repositories/RPCs | Most product value is hidden here; docs/summary/files reachability gaps remain. |
| `/doctors` | Placeholder | visible to all | doctor repository is used by schedule | Doctor data exists, but no doctor-management workspace. |
| `/medical` | Operational dictionary registry | visible to all; editing role-gated in page | clinical dictionary repository/bootstrap RPC | `ARCHITECTURE_CURRENT.md` incorrectly calls this placeholder. |
| `/finance` | Placeholder | visible to all | none on this page | Mislabels finance as missing while real finance exists inside patient card/cashier. |
| `/cashier/payments` | Operational cashier | visible to all; panel itself blocks unauthorized roles | atomic cashier RPC | Route visibility should match capability. |
| `/warehouse` | Placeholder | visible to all | none | Honest placeholder, but no role filtering. |
| `/statistics` | Placeholder | visible to all | none | No reporting read models. |
| `/reports` | Placeholder | visible to all | none | No tenant-period reports. |
| `/bonus` | Placeholder | visible to all | none | No bonus domain. |
| `/mailing` | Placeholder | visible to all | none | No message provider/queue. |
| `/sms` | Placeholder | visible to all | none | No message provider/queue. |
| `/settings` | Placeholder | visible to all | none | No clinic settings/integration/billing workspace. |
| `/admin/audit` | Operational | only admin-capable roles | audit repository/read models | Correct conditional navigation and page capability. |

### Missing or dead UI paths

- `DentalPhotosPanel` is imported and conditionally rendered for `activeTab === 'files'`, but `TABS` contains no `files` entry. The component/persistence exists but is unreachable through normal patient-card navigation.
- `TABS` contains `summary`, but no render branch handles `summary`, producing an empty content area.
- `docs` is handled as a placeholder; `communications` is referenced in render logic but has no tab.
- `/finance` is a dead operational entry point because the page is a placeholder while working finance lives elsewhere.
- `/appointments` is a placeholder despite operational schedule appointments and patient visit/encounter tabs.

### Role visibility

The app-level auth/no-tenant gates are real. Route-specific visibility is weak:

- only `/admin/audit` is conditionally added to the sidebar;
- all placeholder and operational routes otherwise appear to every tenant role;
- sensitive components generally apply their own capability checks and backend/RLS remains authoritative;
- this is primarily UX/information-architecture debt, not evidence of a cross-tenant bypass.

## 14. Storage/source-of-truth matrix

| Domain | Active source of truth | Dev/fallback source | Authority type | Mixed-state risk |
|---|---|---|---|---|
| Auth | Supabase Auth | fixed dev user | Supabase authoritative | Low in active mode. |
| Tenant membership/role | `tenant_users`/`tenants` | fixed demo tenant/role | Supabase authoritative | Dev role is intentionally broad. |
| Patients | Supabase `patients` | localStorage | mixed by runtime mode | `storage.init()` runs even in Supabase mode, so stale demo rows coexist locally although hooks select Supabase. |
| Doctors | Supabase `doctors` | localStorage | mixed by runtime mode | No doctor management UI. |
| Appointments/schedule | Supabase `appointments` direct CRUD | localStorage | mixed by runtime mode | No server-side conflict invariant; local and Supabase semantics can diverge. |
| Complaint | Supabase `chief_complaints` | localStorage | mixed by runtime mode | No history/versioning. |
| Findings | Supabase `findings` | localStorage | mixed by runtime mode | Direct CRUD and frontend workflow coordination. |
| Dental chart | Supabase chart/tooth tables | localStorage | mixed by runtime mode | Multi-row updates are not one RPC transaction. |
| Clinical dictionaries | Supabase tenant registry/template bootstrap | local defaults/storage | mixed by runtime mode | Active mode correctly uses tenant data. |
| Treatment plans | Supabase plans/stages plus stage-sync RPC | localStorage | mixed by runtime mode | Findings cleanup/generation uses frontend orchestration across repositories. |
| Visits/encounters/services | Supabase tables/RPCs | no supported local authoritative workflow | Supabase authoritative | Correctly rejects unsafe local pretending. |
| Patient timeline | calculated from domain repositories/activity | calculated local subset | read-model | Content differs by runtime because audit/activity is Supabase-only. |
| Patient files | Supabase Storage + `patient_files` | local dev repository | mixed by runtime mode | Operational UI is currently unreachable. |
| Finance | Supabase finance tables/RPCs/read models | none | Supabase authoritative | Strongest source-of-truth boundary in repository. |
| Documents | `documents` table only | placeholder UI | backend schema only | No authoritative snapshot workflow. |
| Audit/activity | Supabase event tables | unsupported local fallback | Supabase authoritative | Early direct-CRUD domains do not all emit complete events. |
| amoCRM | backend in-memory token/state skeleton | none | dev backend skeleton | Not tenant-scoped/persistent; cannot be production authority. |
| Platform billing | `subscriptions` schema fragment | none | backend schema only | No access enforcement or UI. |
| Warehouse/mailing/settings/reports | static placeholder | none | static placeholder | No persistence. |

### Dangerous mixed-state findings

1. `src/main.tsx` always runs `storage.init()`, including Supabase-active sessions. The active hooks generally select Supabase correctly, but local demo data still exists beside authoritative rows.
2. Early domain repositories expose both localStorage and direct Supabase adapters. Behavior, constraints and audit are not identical across modes.
3. The schedule uses direct table writes and client conflict checks, so two clients can make decisions from different snapshots.
4. `ClinicalWorkflowOrchestrator` coordinates findings/plans/chart work in the frontend; failures can require compensation rather than one database transaction.
5. Patient timeline composition can be complete in Supabase mode but omit audit/activity facts in local mode.
6. Patient files have correct storage metadata authority, but the only operational component is unreachable from the tab list.

No active Supabase-mode hook was found intentionally reading localStorage while writing the same entity to Supabase. The risk is architectural duality and fallback divergence, not a proven current split-brain write path.

## 15. Database/table inventory

### Migration sequence

| Migration | Purpose |
|---|---|
| `0001_initial_schema.sql` | tenants, profiles/membership, subscriptions, audit log, patients, doctors, appointments, clinical core, treatment plans, documents, integration tokens and initial RLS. |
| `0002_add_dental_chart_editor_fields_to_tooth_states.sql` | dental editor fields. |
| `0003_add_dental_chart_links_to_findings.sql` | chart/finding linkage. |
| `0004_align_findings_status_lifecycle.sql` | finding status lifecycle alignment. |
| `0005_create_clinical_dictionary_items.sql` | tenant clinical dictionary registry. |
| `0006_treatment_plan_stage_sync_rpc.sql` | atomic plan/stage synchronization RPC. |
| `0007_revoke_anon_execute_from_treatment_plan_rpc.sql` | RPC grant hardening. |
| `0008_harden_rls_helper_function_grants.sql` | tenant/RLS helper grant hardening. |
| `0009_backfill_dental_photo_storage.sql` | dental-photo storage backfill/foundation. |
| `0010_clinical_dictionary_template_bootstrap.sql` | global templates and tenant bootstrap RPC. |
| `0011_patient_file_metadata.sql` | patient file metadata/archive model. |
| `0012_create_audit_activity_log.sql` | audit and activity event tables. |
| `0013_create_audit_activity_rpc.sql` | internal event recording functions. |
| `0014_create_encounter_visit_model.sql` | patient visits, clinical encounters and completed services. |
| `0015_create_encounter_visit_rpc.sql` | controlled visit/encounter/service lifecycle RPCs. |
| `0016_create_finance_model.sql` | invoices, items, payments, allocations, refunds and adjustments. |
| `0017_create_finance_rpc.sql` | core finance mutation RPCs and event logging. |
| `0018_create_refund_writeoff_rpc.sql` | refund/write-off lifecycles and financial guards. |
| `0019_harden_cashier_payment_flow.sql` | idempotent atomic cashier payment/allocation and recovery. |
| `0020_create_patient_finance_summary_rpc.sql` | authoritative patient finance summary read model. |
| `0021_prevent_duplicate_completed_service_billing.sql` | completed-service billing eligibility and duplicate guard. |
| `0022_create_patient_fund_reservations.sql` | patient credit/deposit reservations, capacity, idempotency and hardened finance invariants. |

### Current domain tables

| Table | Purpose and ownership | Lifecycle/archive | Access/mutation path | Audit/tests |
|---|---|---|---|---|
| `tenants` | clinic tenant root; platform-scoped ID/status | tenant status, no ordinary hard-delete workflow | RLS/membership helpers | auth/multitenant tests/reports |
| `profiles` | auth user profile | basic profile | RLS | auth context evidence |
| `tenant_users` | user-to-tenant membership and role | membership row | RLS; read by TenantContext | tenant tests/browser QA |
| `subscriptions` | tenant SaaS subscription skeleton | subscription status | schema/RLS only | no operational tests |
| `audit_logs` | initial legacy audit table | append-style intent | RLS | superseded in practice by newer event tables |
| `patients` | tenant patient identity | active/archive-style status; no `archived_at` column | direct repository CRUD under RLS | repository/hook/page/browser tests |
| `doctors` | tenant clinician/resource | basic active data | direct repository reads/CRUD under RLS | repository/hook/schedule tests |
| `appointments` | tenant/patient booking | status field; no archive timestamp | direct repository CRUD under RLS | repository/hooks/modal/browser QA; no SQL concurrency test |
| `chief_complaints` | current complaint per tenant/patient | overwrite/current-state model | direct repository upsert under RLS | repository/hook/browser QA |
| `dental_charts` | patient chart header/text | current-state model | direct repository CRUD under RLS | repository/hook/browser QA |
| `tooth_states` | chart-owned per-tooth state | current-state rows | direct repository CRUD under RLS | repository/components/browser QA |
| `findings` | patient clinical finding/risk | explicit status lifecycle including archive | direct repository CRUD under RLS | repository/hook/component/browser QA |
| `treatment_plans` | patient commercial/clinical plan | plan status lifecycle | repository plus stage-sync RPC | repository/orchestrator/UI/browser QA |
| `treatment_stages` | ordered plan stages | stage status | written through stage-sync RPC for plan saves | RPC/repository tests |
| `documents` | intended patient document record | basic fields, no verified snapshot workflow | schema/RLS only | no operational document tests |
| `integration_tokens` | initial integration-token schema | basic connection data | schema only; not used by current Node memory store | no current client usage |
| `clinical_dictionary_items` | tenant diagnosis/work registry | active/disabled | repository CRUD under role/RLS | repository/provider/page/browser tests |
| `clinical_dictionary_templates` | platform template headers | template version/status | bootstrap internals | SQL/repository tests |
| `clinical_dictionary_template_items` | platform template items | template content | bootstrap internals | SQL/repository tests |
| `patient_files` | tenant/patient storage metadata | `archived_at` and archive metadata | Storage + metadata repository under RLS | repository/hook/component/storage QA |
| `audit_events` | compliance/security event stream | append-only intent | SELECT via repository; writes internal functions | repository/viewer/domain tests |
| `activity_events` | user-facing operational timeline stream | append-only intent | SELECT via repository; writes internal functions | repository/timeline/domain tests |
| `patient_visits` | arrival/visit lifecycle | status plus archive/cancel fields | authenticated SELECT; writes only RPC/service role | SQL/RPC/hook/UI/browser tests |
| `clinical_encounters` | clinical session lifecycle and summary | status, correction/archive fields | authenticated SELECT; writes only RPC/service role | SQL/RPC/hook/UI/browser tests |
| `completed_services` | immutable performed-service fact with void/correction structure | completed/voided/corrected/archive fields | authenticated SELECT; writes only RPC/service role | SQL/RPC/UI/billing-guard tests |
| `invoices` | patient invoice header | draft/issued/partially_paid/paid/voided/written_off/archived | read under RLS; mutations via RPC | extensive unit/SQL/browser tests |
| `invoice_items` | invoice line/completed-service billing link | active/voided/adjusted/archived | read under RLS; add through RPC and duplicate guard | client/SQL/concurrency tests |
| `payments` | received-money fact | received/allocated/partial/refunded/voided/archived | read under RLS; mutations via RPC | extensive client/SQL/concurrency/browser tests |
| `payment_allocations` | allocation of a payment to invoice/item | active/voided | controlled RPC and triggers | client/SQL/concurrency tests |
| `refunds` | money-return workflow | requested/approved/completed/rejected/voided | lifecycle RPCs only | client/hook/UI/SQL/concurrency tests |
| `financial_adjustments` | discount/correction/write-off/surcharge/void decision model | active/approved/rejected/voided | only write-off lifecycle is operational | write-off tests; other types backend-only |
| `patient_fund_reservations` | reserved patient credit/deposit | active/partially_used/fully_used/released/refunded/archived | SELECT only; create/release/use RPCs | unit/SQL/concurrency/full browser QA |
| `private_finance.mutation_authorizations` | short-lived internal authorization for guarded finance mutations | consumed/internal | no client/service-role table access | SQL/concurrency tests |

### Archive and immutable-fact observations

- Encounter, completed-service, invoice, item, payment, patient-file and reservation models contain explicit archive/void/correction fields.
- Early patient/appointment/chart/complaint models are current-state CRUD models and do not provide the same immutable mutation history.
- Completed-service and finance facts are materially stronger than early clinical CRUD tables.
- `financial_adjustments` advertises multiple adjustment types, but only write-off is an implemented controlled lifecycle.

## 16. RPC inventory

### Public client-used mutation/read RPCs

Clinical dictionaries and treatment plans:

- `bootstrap_clinical_dictionary_from_template`
- `save_treatment_plan_with_stages`

Visit/encounter/service lifecycle:

- `check_in_patient_visit`
- `start_patient_visit`
- `complete_patient_visit`
- `cancel_patient_visit`
- `create_clinical_encounter`
- `start_clinical_encounter`
- `complete_clinical_encounter`
- `record_completed_service`
- `void_completed_service`

Core finance:

- `create_invoice`
- `add_invoice_item`
- `get_completed_service_billing_eligibility`
- `issue_invoice`
- `void_invoice`
- `record_payment`
- `allocate_payment`
- `void_payment_allocation`
- `void_payment`

Cashier:

- `record_and_allocate_payment`
- `get_cashier_payment_operation`

Refunds/write-offs:

- `request_refund`
- `approve_refund`
- `complete_refund`
- `reject_refund`
- `void_refund`
- `request_invoice_write_off`
- `approve_invoice_write_off`
- `reject_invoice_write_off`
- `void_invoice_write_off`

Read models and deposits:

- `get_patient_finance_summary`
- `get_payment_fund_capacity`
- `get_patient_fund_reservations`
- `create_patient_fund_reservation`
- `release_patient_fund_reservation`
- `allocate_reserved_credit`

### Internal SECURITY DEFINER/trigger functions

Current migrations define internal helpers for:

- tenant membership/role checks;
- audit/activity event recording;
- invoice/payment recalculation;
- finance role checks and metadata sanitization;
- payment allocation/refund/deposit capacity;
- completed-service billing guard;
- write-off/refund guards;
- cashier operation result recovery;
- private finance mutation authorization;
- reservation enforcement/result mapping.

These internal functions correctly have no frontend client usage and generally have EXECUTE revoked from public/anon/authenticated where appropriate.

### Replaced definitions

Several functions are intentionally replaced by later migrations:

- `add_invoice_item`: hardened by `0021`;
- `allocate_payment`, `approve_refund`, `complete_refund`, `reject_refund`, `void_refund`, `void_payment`, `void_payment_allocation`: hardened by `0022`;
- `get_patient_finance_summary`: extended by `0022`;
- finance recalculation/capacity helpers: replaced as later invariants were introduced.

The current definition is the latest migration definition, not the first filename in which the function appeared.

### Backend-only or unused capability signals

- `financial_adjustments` types `discount`, `correction`, `surcharge`, and `void` have no equivalent controlled client/RPC lifecycle beyond invoice-item input amounts and write-off operations.
- completed-service/encounter correction columns document future controlled correction flows, but no client-used correction RPC exists.
- `documents`, `subscriptions` and `integration_tokens` have no current operational client repository.
- amoCRM sync endpoints explicitly return 501 placeholders.

### Missing/deprecated client mismatch

No current frontend client call was found targeting a missing public RPC. Internal helper functions correctly have no client call. Obsolete behavior is primarily represented by old documentation and earlier function definitions, not broken current RPC names.

## 17. Security/RLS summary

### Implemented security boundaries

- Supabase Auth supplies the user session/JWT.
- `tenant_users` supplies tenant membership and clinic role.
- `get_user_tenants()` and `has_tenant_role(...)` support RLS/RPC authorization.
- The application blocks authenticated users without a tenant before private routes render.
- Tenant-scoped tables use RLS and tenant/patient foreign keys.
- High-risk visit/encounter/completed-service tables revoke authenticated writes and grant SELECT only; lifecycle writes are RPC-only.
- Finance tables use role-aware RPCs, guards, triggers and audit/activity logging.
- Deposit reservations revoke direct INSERT/UPDATE/DELETE from authenticated and service_role; mutation is RPC/internal-authorization controlled.
- Private finance authorization schema/table access is revoked from application roles.
- Anonymous EXECUTE is revoked from controlled RPCs.
- Multitenant and no-tenant browser QA has verified cross-tenant isolation for tested domains.

### Remaining security/governance gaps

- Early core modules still permit direct RLS-protected table CRUD and do not have the same mutation/audit guarantees as finance and encounter domains.
- UI role visibility is inconsistent with backend capability visibility.
- The source role catalogue is broader than implemented `app_role`/frontend role maps.
- No platform support-access workflow, export controls, notification consent, retention dashboard or incident tooling is operational.
- amoCRM token/state storage is dev-memory only and not tenant-scoped.
- Platform subscription/access/feature enforcement is not implemented.

### Security conclusion

There is no evidence that UI-only hiding is treated as the sole security boundary for implemented high-risk finance/encounter operations. Database/RPC enforcement is real. Remaining gaps are uneven maturity across older direct-CRUD domains and future platform/integration capabilities.

## 18. Finance final state

### Capability matrix after PR #341

| Finance capability | State | Evidence and gap |
|---|---|---|
| Invoice creation | Implemented | `create_invoice`, patient Finance UI, tests. |
| Invoice lines | Implemented | `add_invoice_item`, draft-line UI, completed-service eligibility. |
| Completed-service billing guard | Implemented and concurrency-verified | unique partial index/trigger/RPC guard and `0021` tests. |
| Invoice issue | Implemented | `issue_invoice`, UI/tests. |
| Invoice void | Implemented | reason-required RPC/UI/tests. |
| Item correction | Absent | item status/schema supports concepts, but no controlled correction/void-item workflow. |
| Payment recording | Implemented with gap | generic `record_payment` records unallocated payment but lacks idempotency/recovery. |
| Cashier multi-invoice payment | Implemented and hardened | atomic `record_and_allocate_payment`, idempotency/fingerprint/recovery, concurrency/browser QA. |
| Allocations | Implemented | generic and cashier allocations; capacity guards. |
| Payment void | Implemented | guarded against allocations/refunds/deposits. |
| Refund lifecycle | Implemented | request/approve/complete/reject/void, capacity/concurrency tests. |
| Write-off lifecycle | Implemented | request/approve/reject/void and invoice recalculation. |
| Patient credit | Implemented | authoritative summary/capacity calculation. |
| Deposit reservation | Implemented | create with purpose/source/capacity/idempotency. |
| Deposit release | Implemented | controlled release; not a refund. |
| Reserved-credit use | Implemented | allocation to eligible invoice, no new payment. |
| Prepayment intake | Partial | generic patient Finance UI can record unallocated payment; cashier intentionally cannot. Generic path is not idempotent/recoverable. |
| Cash shifts | Absent | no model/RPC/UI. |
| Debt aging/collections | Absent | no model/read model/UI. |
| Financial reporting | Partial | patient summary only; no tenant-period reports/export foundation. |
| Provider/fiscal integration | Absent | no payment provider, fiscal receipt or terminal reconciliation. |

### Required explicit answers

1. **Is `CASHIER-CREDIT-PREPAYMENT-001` still a real gap?**
   - The operational need is real.
   - The old task title/scope is unsafe if interpreted as “build prepayment from scratch”, because payments and patient credit already exist.
   - The remaining gap is an intentional, idempotent, recoverable cashier intake path for money that is not fully allocated to selected invoices.

2. **Can staff already record unallocated payment manually?**
   - Yes. `PaymentActions` in the patient Finance tab calls `recordPayment`/`record_payment` without requiring an invoice or allocation.

3. **Is that current path idempotent?**
   - No. `record_payment` accepts no operation key/fingerprint, and `FinanceRpcClient.recordPayment` has no recovery lookup. A lost success response followed by retry can duplicate a payment.

4. **Does cashier UI intentionally support prepayment?**
   - No. `CashierPaymentForm` requires at least one selected invoice, rejects amount above selected invoice debt, and `record_and_allocate_payment` consumes the full payment into those invoices.

5. **Would a new prepayment task duplicate `record_payment`?**
   - A naive implementation would. It must reuse the existing `payments` fact and patient-credit calculation. A second “prepayments” money table or parallel payment action would be a duplicate and a reconciliation hazard.

6. **Is only UI missing, or backend hardening too?**
   - Both. Backend/client idempotency and recovery are missing for unallocated intake; intentional cashier UX is also missing.

7. **Should the next task be recon, hardening or implementation?**
   - **Hardening.** This report supplies the reconciliation. Direct UI implementation before an idempotent backend invariant would expose a duplicate-payment risk.

## 19. Clinical final state

### Clinical fact separation

The repository generally preserves required domain boundaries:

```text
ChiefComplaint
!= DentalFinding
!= patient Diagnosis fact
!= TreatmentPlan
!= CompletedService
!= Appointment
!= Invoice
!= Payment
```

### Current state by fact

| Clinical fact | Current implementation | Persistence | Workflow linkage | Remaining gap |
|---|---|---|---|---|
| Chief complaint | editable patient complaint with related teeth | `chief_complaints` | displayed in findings/plan/encounter context | current-state overwrite, no immutable history |
| Finding | structured category/severity/status/tooth/risk/recommendation | `findings` | chart can create finding; findings can seed plan; timeline | direct CRUD/status governance; no signed diagnostic conclusion |
| Diagnosis | tenant registry plus chart free-text/selection | dictionary + chart text | work compatibility in tooth editor | no patient diagnosis entity, author, encounter linkage or lifecycle |
| Dental chart | tooth states, notes, chart text, finding generation | `dental_charts`, `tooth_states` | findings/summary/timeline | direct multi-row CRUD, PNG not document snapshot |
| Treatment plan | plans/stages, create from findings, preview | `treatment_plans`, `treatment_stages` | findings cleanup/generation and commercial preview | frontend orchestration across entities; approval/signature/snapshot governance incomplete |
| Completed service | immutable performed-service row with void | `completed_services` | encounter/visit/finance billing guard | controlled correction row flow not implemented |
| Visit | check-in/start/complete/cancel | `patient_visits` | encounter linkage and timeline | not integrated with schedule appointment lifecycle automatically |
| Clinical encounter | create/start/complete and summary | `clinical_encounters` | visit/patient timeline | full signed clinical note/correction/versioning absent |
| Timeline | aggregate clinical, schedule, finance, file/activity facts | calculated read model | patient card | actor labels/deep links incomplete |
| Document snapshot | not operational | `documents` schema only | none | entire immutable document workflow absent |

### Immutable historical facts

Stronger immutable/controlled facts:

- completed services;
- visits/encounters lifecycle events;
- invoices/payments/allocations/refunds/write-offs/reservations;
- audit/activity events.

Current-state mutable facts:

- complaint;
- findings;
- chart/tooth state;
- plans/stages through direct repository orchestration;
- appointments.

### Clinical conclusion

Do not schedule generic “build treatment plans”, “build findings”, “build dental chart” or “build completed services” tasks. Those capabilities exist. Future work must target exact gaps: diagnosis fact model, atomic clinical workflow/corrections, document snapshots, or schedule-to-visit linkage.

## 20. Schedule final state

| Requirement | Current state |
|---|---|
| Appointment persistence | Implemented through Supabase `appointments`; localStorage dev adapter remains. |
| CRUD | Create, edit and delete operational in day schedule/modal. |
| Conflict checks | Implemented only in current browser snapshot for doctor/cabinet overlap; no DB lock/constraint/RPC. |
| Provider/resource model | Doctors and free-text cabinet; no generalized resource/capacity model. |
| Statuses | new, confirmed, arrived, in_progress, completed, no_show, cancelled, blocked. |
| Reminders | Not implemented. |
| Confirmation | Manual status only; no queue/contact workflow. |
| No-show | Manual status only; no reason/follow-up/report. |
| Rescheduling | Edit time in place; no rescheduled-from chain or reason. |
| Cancellation reasons | Not implemented. |
| Waitlist | Not implemented. |
| Recurring appointments | Not implemented. |
| Patient communication | Not implemented. |
| Tenant isolation | Supabase RLS and tenant-scoped repository; browser QA exists. |
| Role permissions | No dedicated schedule capability map; route visible to all tenant roles; table RLS is membership-based. |
| LocalStorage remnants | Full local appointment repository and unconditional `storage.init()` remain for dev mode. |
| Views | Day view operational; non-day views show future-work message. |
| Operational tasks | “Tasks today” list is hardcoded UI-only content. |
| Appointment/visit linkage | Separate concepts; no automatic check-in/encounter transition from schedule. |

### What is already implemented

- real appointment persistence;
- daily doctor schedule;
- patient/doctor selection;
- create/edit/delete;
- manual statuses including confirmation/no-show;
- client-side doctor/cabinet overlap warning;
- patient appointment history;
- tenant isolation for tested data.

### What still uses old context/storage

- `ScheduleContext` correctly remains UI state only;
- `LocalStorageAppointmentRepository` remains a complete dev adapter;
- `storage.init()` still seeds local schedule data;
- local and Supabase appointment mutation semantics differ;
- old route maps still describe storage functions as the schedule authority without mentioning the Supabase repository.

### Next operational schedule workflow

The next schedule-specific task should not be “build schedule”. It should be `SCHEDULE-OPERATIONS-RECON-001`, followed by a narrow backend-hardening task for atomic conflict prevention, cancellation/rescheduling audit and appointment-to-visit handoff. A direct reminder/public-booking task would be premature while slot authority is client-side.

## 21. Documents/integrations/other modules

| Module | Actual state | Prerequisite before implementation |
|---|---|---|
| Documents | `documents` table/RLS plus placeholder pages; no repository/snapshot UI | `DOCUMENT-SNAPSHOT-RECON-001`, then immutable template/snapshot/status/audit foundation before PDF/signing |
| Patient files | Storage and metadata implemented; UI component unreachable | small patient-card reachability/permission task after confirming intended tab placement |
| Warehouse | placeholder only | warehouse domain recon; completed-service/material linkage and tenant/audit model |
| Mailing/SMS | placeholders only | communication consent, templates, provider abstraction, queue/delivery/audit; schedule authority first for reminders |
| Settings | placeholder | settings-domain inventory, role model and tenant configuration schema |
| amoCRM | frontend-safe mapper and Node OAuth skeleton with memory stores | tenant-scoped encrypted persistence, refresh, feature entitlement, sync log, manual safe sync, webhook verification |
| SaaS billing | `subscriptions` schema fragment | tariff/entitlement/access model, platform-vs-clinic role guard, audit, suspension semantics |
| Reports/statistics | placeholders; patient finance summary exists | domain-specific authoritative read models first |
| Imports/exports | absent | format/recon, dry-run, duplicate detection, permissions, audit, expiration |
| Notifications | absent | consent and delivery foundation; no direct provider call from UI |
| Public booking | absent | authoritative schedule conflict RPC, tenant routing, privacy/rate-limit/entitlement |
| AI functions | source rules only | data classification, reviewed suggestion workflow, model/provider decision, audit and doctor confirmation |

## 22. Stale document findings

| Document | Current claim | Actual state | Evidence | Recommended correction |
|---|---|---|---|---|
| `_ai_work/PROJECT_ROUTES.md`, section 9 | Finance, Documents, Warehouse, Mailing and Settings are all equivalent placeholders | Finance is operational in patient card and cashier; only top-level Finance page is placeholder. Documents has schema only; the others remain placeholders. | `PatientFinancePanel`, cashier components, migrations `0016–0022`, placeholder pages | Mark Finance as distributed operational module; distinguish schema-only Documents from pure placeholders. |
| `PROJECT_ROUTES.md`, schedule section | Schedule is “implemented” with storage functions as associated persistence | Schedule is mixed local/Supabase and operational only for day view; conflict enforcement is client-side | `AppointmentRepository`, `SchedulePage`, `AppointmentModal` | Mark `IMPLEMENTED_WITH_GAPS`, Supabase-active authority, server conflict gap. |
| `PROJECT_ROUTES.md`, patient/clinical sections | Storage functions are the current linked implementation | Active configured mode uses Supabase repositories | repository factories/hooks | Replace storage-only descriptions with runtime source-of-truth matrix. |
| `PROJECT_ROUTES.md`, source docs section | Documents 00–18 are pending except index | All 00–18 files exist and index marks all Provided | `_ai_work/SOURCES/SOURCES_INDEX.md` | Mark source foundation complete. |
| `_ai_work/ARCHITECTURE_CURRENT.md`, routes | Only Schedule, Patients and PatientCard are implemented; MedicalPage is placeholder | MedicalPage, CashierPaymentPage and AdminAuditPage are operational; patient card has multiple operational modules | actual routes/pages/tests | Replace page inventory with current route matrix. |
| `ARCHITECTURE_CURRENT.md`, storage | localStorage is the project storage model | Supabase is active authority for configured tenants across most core modules; localStorage is dev fallback | repository factories/hooks/migrations | Mark architecture as mixed runtime with Supabase authority in active mode. |
| `ARCHITECTURE_CURRENT.md`, treatment preview | patient preview reads patient/complaint/findings from Storage | hooks select Supabase in active mode | treatment/patient/complaint/finding hooks | Remove storage-only statement. |
| `16_DEVELOPMENT_ROADMAP_AND_TASK_BACKLOG.md`, source status | 17–18 pending / source foundation incomplete | 00–18 all Provided | source index | Mark historical phase complete, do not delete history. |
| Source 16, current caution | tenant isolation/auth/database/CI may not exist | Supabase auth, tenant/RLS, 22 migrations and CI workflow exist | contexts, migrations, `.github/workflows/ci.yml` | Mark these as historical cautions, retain remaining production gaps separately. |
| Source 16, Phase 4–7 generic backlog | patients, appointments, chart, findings, plans and finance are future generic builds | those modules now exist at varying maturity | code/migrations/reports | Mark generic tasks obsolete or superseded by merged task IDs; retain precise gaps only. |
| Older clinical/browser reports | some state that Patient/Treatment/CompletedService repositories were not yet migrated | later migrations/repositories/UI are merged | current code and later reports | Treat as historical evidence, not current roadmap authority. |
| Older finance recon recommendations | prepayment/corrections/shifts/reporting listed as flat future implementation tasks | prepayment overlaps current payment/credit/deposit architecture; write-off lifecycle now exists | current `record_payment`, cashier/deposit/write-off code | Replace flat implementation list with recon/hardening dependency order. |

No old document was modified in this PR. Historical context is preserved, while this report becomes the current reconciliation reference.

## 23. Duplicate task findings

| Proposed task | Repository/GitHub exact duplicate | Current overlap | Finding | Scheduling verdict |
|---|---|---|---|---|
| `CASHIER-CREDIT-PREPAYMENT-001` | No exact PR/branch/task implementation | Generic unallocated `record_payment`; patient credit summary; deposit reservations | Partial overlap; original from-scratch interpretation is obsolete/unsafe | Replace with `CASHIER-CREDIT-PREPAYMENT-HARDENING-001`, then narrow UI task. |
| `CASHIER-CREDIT-PREPAYMENT-RECON-001` | No exact match | This report performs required reconciliation | A separate recon would duplicate this report | Reject as duplicate of current reconciliation. |
| `CASHIER-CREDIT-PREPAYMENT-HARDENING-001` | No exact match | No idempotent unallocated-intake operation exists | Real non-duplicating gap | Safe and recommended next. |
| `INVOICE-CORRECTIONS-FOUNDATION-001` | No exact implementation | schema has correction/adjustment fields; issued invoice/item correction RPC absent | Partial overlap; “foundation” scope ambiguous | Do not implement directly; run `INVOICE-CORRECTIONS-RECON-001`. |
| `INVOICE-CORRECTIONS-RECON-001` | No exact match | needed to separate item void, compensating line, discount/surcharge and immutable invoice history | Real recon gap | Safe after prepayment hardening. |
| `CASHIER-SHIFTS-FOUNDATION-001` | No exact implementation | no model at all | No overlap, but operational policy requirements are unspecified | Recon first. |
| `CASHIER-SHIFTS-RECON-001` | No exact match | none | Real recon gap | Safe near-term. |
| `FINANCE-REPORTING-READMODELS-001` | No exact implementation | patient-level summary RPC exists | Partial overlap; tenant-period scope undefined | `FINANCE-REPORTING-RECON-001` first. |
| `FINANCE-REPORTING-RECON-001` | No exact match | current patient read model provides starting evidence | Real recon gap | Safe after corrections/shifts contracts. |
| `DEBT-AGING-COLLECTIONS-001` | No exact implementation | current debt amount exists only at patient/invoice level | No operational overlap | Block until reporting/correction model; recon first. |
| `DEBT-AGING-COLLECTIONS-RECON-001` | No exact match | none | Real later recon gap | Safe after finance reporting recon. |
| `FINANCE-DASHBOARD-001` | No exact implementation | patient summary cards only | Dashboard would duplicate calculations if built before read models | Not ready; blocked by reporting read models. |
| `DISCOUNTS-APPROVALS-001` | No exact implementation | invoice-item discount input and `financial_adjustments.discount` type exist | Partial overlap; no approval lifecycle | Recon first, likely combine with invoice-corrections governance. |
| `FINANCE-WRITEOFF-GOVERNANCE-001` | No exact implementation | full write-off request/approve/reject/void lifecycle already exists | Major overlap; only thresholds/two-person/taxonomy/evidence are missing | Do not rebuild lifecycle; schedule a narrow governance hardening task only after policy recon. |

### Task IDs/branches/PR search result

- No exact GitHub PR title or remote branch was found for the candidate future IDs.
- Candidate IDs mostly occur only as recommendations in historical finance reports.
- Absence of an exact ID is not proof of a missing capability; current code overlap was used as the deciding evidence.

## 24. Real gaps

### P0: active correctness/security/data-loss risk

1. **Unallocated/prepayment payment intake is not idempotent or recoverable.**
   - `record_payment` can create patient credit.
   - a lost successful response and retry can create duplicate money facts.
   - cashier’s hardened operation cannot be used because it requires invoices and full allocation.

2. **Appointment conflict authority is client-side.**
   - concurrent users can pass the same stale overlap check;
   - direct table CRUD has no slot-lock/conflict RPC;
   - reminders/public booking must not be built on this boundary.

### P1: operational blocker or dependency root

3. **Issued-invoice/item correction and discount governance are undefined.**
   - schema vocabulary exists;
   - write-off is not a substitute for correction;
   - immutable accounting history needs a precise compensating model.

4. **Immutable document snapshot workflow is absent.**
   - documents are medically/legal sensitive;
   - table existence does not provide template version, snapshot, cancellation, print or audit semantics.

5. **Cashier shift/till accountability is absent.**
   - no open/close, expected cash, variance, custody or shift report;
   - required before trustworthy cash reporting/fiscal integration.

6. **Patient-level diagnosis fact is absent.**
   - dictionary and chart text are not a diagnosis record;
   - author, encounter, time, status and correction history are missing.

### P2: useful workflow improvement

7. Patient file component is unreachable; patient Summary tab is blank.
8. Route/sidebar role visibility and duplicate placeholder entry points need reconciliation.
9. Treatment plan and chart/finding cross-entity workflows need stronger database atomicity/audit.
10. Tenant-period finance reporting and debt aging are absent.
11. Schedule confirmation/rescheduling/cancellation/no-show operations are incomplete after conflict hardening.

### P3: later enhancement

12. Warehouse.
13. Messaging/notifications.
14. amoCRM production integration.
15. SaaS billing/access automation.
16. Public booking.
17. Imports/exports.
18. AI-assisted features.

## 25. Risk and priority scoring

Scoring: 1 = low, 5 = highest. “Size” and “duplication risk” are risk/cost scores, not value scores.

| Gap | Patient safety | Financial integrity | Tenant/security | Operational value | Dependency centrality | Data migration risk | Size | Duplication risk | Priority |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Idempotent patient-credit/prepayment intake | 1 | 5 | 3 | 5 | 5 | 2 | 3 | 5 | P0 |
| Server-authoritative schedule conflict/lifecycle | 4 | 2 | 3 | 5 | 5 | 3 | 4 | 3 | P0 |
| Invoice/item corrections and discount governance | 2 | 5 | 3 | 4 | 5 | 4 | 4 | 5 | P1 |
| Immutable document snapshots | 5 | 2 | 4 | 4 | 5 | 4 | 5 | 3 | P1 |
| Cashier shifts/till reconciliation | 1 | 5 | 3 | 5 | 4 | 3 | 4 | 3 | P1 |
| Patient diagnosis fact | 5 | 1 | 3 | 4 | 4 | 4 | 4 | 4 | P1 |
| Finance reporting read models | 1 | 4 | 3 | 5 | 4 | 3 | 4 | 5 | P2 |
| Patient files/summary reachability | 2 | 1 | 2 | 3 | 2 | 1 | 1 | 2 | P2 |
| Route/role information architecture | 1 | 1 | 2 | 3 | 2 | 1 | 2 | 2 | P2 |
| Debt collections | 1 | 4 | 2 | 4 | 2 | 3 | 4 | 4 | P2 |
| amoCRM production sync | 1 | 2 | 5 | 3 | 2 | 4 | 5 | 3 | P3 |
| Platform billing/access automation | 1 | 3 | 5 | 4 | 3 | 5 | 5 | 3 | P3 for internal clinic; P1 before paid SaaS |

## 26. Dependency graph

```text
CURRENT VERIFIED FOUNDATION
Auth + tenant membership + RLS
Patients + clinical core
Visits + encounters + completed services
Audit/activity
Finance model + RPCs + cashier hardening
Patient finance summary + deposits

FINANCE INTEGRITY BRANCH
→ CASHIER-CREDIT-PREPAYMENT-HARDENING-001
  → CASHIER-CREDIT-PREPAYMENT-UI-001
    → CASHIER-SHIFTS-RECON-001
      → cashier-shift foundation/UI
        → FINANCE-REPORTING-RECON-001
          → tenant-period read models
            → DEBT-AGING-COLLECTIONS-RECON-001
              → finance dashboard/provider/fiscal integrations

ACCOUNTING CORRECTION BRANCH
current invoice/refund/write-off foundation
→ INVOICE-CORRECTIONS-RECON-001
  → correction/discount governance invariants
    → correction RPC/client/UI
      → reliable reporting and aging

SCHEDULE BRANCH
current appointment table/day UI
→ SCHEDULE-OPERATIONS-RECON-001
  → server conflict/cancellation/reschedule invariants
    → confirmation/no-show/reminder workflow
      → messaging integration
        → public booking

CLINICAL/DOCUMENT BRANCH
current findings/chart/plans/encounters/services
→ patient diagnosis fact recon
→ DOCUMENT-SNAPSHOT-RECON-001
  → immutable template/snapshot/status/audit foundation
    → print/PDF/signing/export

PLATFORM/INTEGRATION BRANCH
stable internal source of truth
→ settings/entitlement/access foundation
  → persistent tenant-scoped amoCRM connection
    → manual safe sync + logs
      → webhook/automatic sync

Warehouse, public booking, AI and provider integration remain downstream.
```

Rules enforced by this order:

- no UI prepayment mode before idempotent intake invariant;
- no finance dashboard before authoritative period read models;
- no debt workflow before correction/reporting authority;
- no reminders/public booking before server slot authority;
- no PDF/signing before immutable document snapshot;
- no external sync before protected tenant-scoped connection/source of truth.

## 27. Candidate task readiness cards

### Card 1: `CASHIER-CREDIT-PREPAYMENT-HARDENING-001`

- **Problem:** unallocated money can be recorded, but generic `record_payment` is not idempotent/recoverable and cashier cannot intentionally accept prepayment.
- **Existing capability:** payments table, `record_payment`, idempotent cashier pattern, patient credit/deposit capacity, audit/activity infrastructure.
- **Missing capability:** explicit operation key/fingerprint, authoritative result recovery, concurrency guarantee for invoice-less credit intake.
- **Duplication risk:** high if a second prepayment table or duplicate payment action is introduced.
- **Dependencies:** all prerequisites already merged through `0022`.
- **Recommended task type:** hardening, backend/RPC/client/tests first.
- **Estimated scope:** medium.
- **Main risks:** duplicate payment facts, incompatible RPC signature, accidental allocation, confusing “deposit” versus received money.
- **Go/no-go:** **GO; recommended NEXT.**

### Card 2: `SCHEDULE-OPERATIONS-RECON-001`

- **Problem:** schedule looks operational but conflict prevention is client-only and lifecycle semantics are incomplete.
- **Existing capability:** appointment table/RLS, direct CRUD repository, day UI, status buttons, patient history.
- **Missing capability:** authoritative conflict model, resource scope, cancellation/reschedule audit, handoff to visit, role policy.
- **Duplication risk:** high if a new schedule module is built instead of hardening appointments.
- **Dependencies:** current appointment foundation.
- **Recommended task type:** recon, then split schema/RPC/UI.
- **Estimated scope:** medium report, large eventual implementation.
- **Main risks:** double booking, time-zone/resource ambiguity, destructive migration of existing statuses.
- **Go/no-go:** **GO near-term; no direct implementation yet.**

### Card 3: `INVOICE-CORRECTIONS-RECON-001`

- **Problem:** issued invoices/items cannot be safely corrected; schema has overlapping adjustment vocabulary.
- **Existing capability:** immutable-ish invoice/payment facts, invoice void, write-off, item discount/adjustment fields, adjustment table.
- **Missing capability:** exact correction taxonomy, compensating-entry rules, item void/correction, discount/surcharge approval and audit.
- **Duplication risk:** very high because write-off, void, discount and correction must not become interchangeable.
- **Dependencies:** current finance foundation; should precede reporting/aging.
- **Recommended task type:** recon.
- **Estimated scope:** medium report, large staged implementation.
- **Main risks:** rewriting financial history, double discount, inconsistent balance recalculation.
- **Go/no-go:** **GO after prepayment hardening.**

### Card 4: `DOCUMENT-SNAPSHOT-RECON-001`

- **Problem:** documents page/table exist, but no official immutable document workflow exists.
- **Existing capability:** patient/plan/encounter facts, file storage metadata, audit/activity infrastructure, documents table skeleton.
- **Missing capability:** template/version/snapshot semantics, generation inputs, permissions, statuses, cancellation, print/export and audit.
- **Duplication risk:** medium; confusing plan preview, dental PNG and patient file with official document is the main hazard.
- **Dependencies:** clinical fact boundaries already exist; exact legal/product requirements still need reconciliation.
- **Recommended task type:** recon.
- **Estimated scope:** medium report, large staged implementation.
- **Main risks:** mutable historical documents, medical/legal misrepresentation, sensitive file access.
- **Go/no-go:** **GO near-term.**

### Card 5: `CASHIER-SHIFTS-RECON-001`

- **Problem:** payment operations exist without till/shift custody and close reconciliation.
- **Existing capability:** payments, methods, cash received summaries, audit events, cashier roles.
- **Missing capability:** shift open/close, cashier/till, opening amount, expected/actual cash, variance, approval and report boundaries.
- **Duplication risk:** medium; must not infer shifts from payment timestamps or create a second payment ledger.
- **Dependencies:** prepayment hardening and correction rules; reporting follows.
- **Recommended task type:** recon.
- **Estimated scope:** medium report, large staged implementation.
- **Main risks:** cash accountability ambiguity, time-zone/shift ownership, retrospective mutation.
- **Go/no-go:** **GO after intentional payment-intake boundary is stable.**

## 28. Recommended next task

### Exact task

`CASHIER-CREDIT-PREPAYMENT-HARDENING-001`

### Title

Harden idempotent patient-credit intake before adding cashier prepayment UI

### Type

Finance backend/RPC/client hardening with database and concurrency tests. No broad UI redesign.

### Why this is the best next task

- It addresses an active duplicate-money risk, not merely an absent convenience feature.
- It reuses the current `payments` source of truth and patient credit/deposit calculations.
- It uses the already proven cashier idempotency/reconciliation pattern.
- It is prerequisite work for any intentional cashier prepayment/overpayment UI.
- It is smaller and safer than invoice corrections, shifts or reporting.
- It does not require a new recon because this report answers the key current-state questions.

### Why it is not a duplicate

Existing components do not provide the required combined capability:

- `record_payment` creates unallocated payment but has no idempotency/recovery;
- `record_and_allocate_payment` is idempotent/recoverable but requires invoices and full allocation;
- deposit creation reserves already received credit and must not accept new money;
- patient finance summary only reads/calculates state.

The new task must close the intersection, not copy any one of those features.

### Expected scope

- define one explicit operation contract for receiving money as patient credit;
- reuse `payments`, not create a prepayment ledger;
- add operation key/fingerprint and same-key/same-payload semantics;
- provide authoritative recovery/read RPC for uncertain responses;
- ensure zero allocation is intentional and audited;
- return payment plus current capacity/credit summary;
- enforce tenant, patient, currency, role and amount invariants;
- add RPC client/hook foundation needed by a later UI task;
- add SQL, concurrency, client and stale-response tests;
- document safe wording: “received money / available credit”, not “deposit created”.

### Major exclusions

- no cashier prepayment UI in the hardening task unless an exceptionally small diagnostic/admin surface is explicitly authorized;
- no second payment/prepayment table;
- no deposit reservation changes;
- no invoice correction, shifts, debt aging, reports or provider integration;
- no cloud apply.

## 29. Near-term roadmap

The next 3–5 tasks after the recommended NEXT task, in priority/dependency order:

| Order | Task | Type | Reason | Prerequisites | Non-duplication evidence | Expected scope | Major exclusions |
|---:|---|---|---|---|---|---|---|
| 1 | `CASHIER-CREDIT-PREPAYMENT-UI-001` | operational UI | expose the hardened credit-intake operation intentionally in cashier | prepayment hardening | cashier currently requires invoices; generic patient form is not safe cashier UX | cashier mode, wording, role gating, reconciliation UI, browser QA | no new payment model/deposit mutation |
| 2 | `SCHEDULE-OPERATIONS-RECON-001` | report/recon | define server conflict/lifecycle/resource contract before changing schedule | current appointment foundation | schedule exists; task targets invariants, not a new calendar | schema/RPC/UI gap map and staged tasks | no reminders/public booking implementation |
| 3 | `INVOICE-CORRECTIONS-RECON-001` | report/recon | separate correction, void, write-off, discount and surcharge | finance foundation | no correction RPC; write-off lifecycle must not be rebuilt | accounting invariants and staged task contract | no code/migration |
| 4 | `DOCUMENT-SNAPSHOT-RECON-001` | report/recon | define immutable official document boundary | clinical/file/audit foundation | patient preview, PNG and file metadata are not documents | template/snapshot/status/audit/storage contract | no PDF/signing implementation |
| 5 | `CASHIER-SHIFTS-RECON-001` | report/recon | define till/shift accountability before finance reports | stable payment/prepayment boundary | no shift model exists; must reuse payments | operational roles, state machine, variance/report dependencies | no foundation/UI implementation |

## 30. Later roadmap

### Finance operations

- cashier shift foundation/UI;
- invoice correction/discount governance foundation and UI;
- tenant-period finance read models;
- debt aging/collections;
- finance dashboard and exports;
- fiscal/provider integration after internal accounting authority.

### Schedule and communications

- server-authoritative conflict/cancellation/reschedule lifecycle;
- appointment-to-visit handoff;
- confirmation/no-show operational queue;
- consent-aware notifications;
- waitlist and recurring appointments;
- public booking only after slot authority/rate limiting/privacy/entitlement.

### Clinical and documents

- patient diagnosis fact and correction history;
- stronger atomic chart/finding/plan workflows;
- immutable document templates/snapshots;
- print/PDF/signing/export after snapshot foundation;
- patient file reachability and general file workspace.

### Platform and integrations

- clinic settings/working hours/resources;
- tariff/subscription/entitlement/access enforcement;
- tenant-scoped persistent amoCRM connection and manual safe sync;
- warehouse/material use linked to completed services;
- imports/exports with dry-run/audit/expiry;
- production monitoring/backups/restore/security review;
- AI-assisted functions only after explicit safety/audit/provider design.

## 31. Tasks explicitly rejected as duplicates

- Generic “implement finance module”: finance is already operational in patient card/cashier.
- Generic “implement patient credit”: authoritative summary/capacity exists.
- Generic “implement deposits”: reservation/release/use UI and backend are merged.
- Generic “implement payments”: payment facts and two intake/allocation paths exist; exact hardening is needed.
- Generic “implement refunds”: lifecycle exists.
- Generic “implement write-offs”: lifecycle exists; only governance hardening may remain.
- Generic “implement schedule”: appointment persistence/day UI exists.
- Generic “implement treatment plans”: plans/stages/generation/preview exist.
- Generic “implement completed services”: lifecycle and billing guard exist.
- `CASHIER-CREDIT-PREPAYMENT-RECON-001`: current report already performs the required reconciliation.
- A second prepayment/deposit money table: duplicates `payments` and patient-credit model.
- `FINANCE-DASHBOARD-001` before read models: would duplicate/recompute business formulas in UI.
- `FINANCE-WRITEOFF-GOVERNANCE-001` if scoped to rebuild write-off lifecycle: lifecycle is already implemented.

## 32. Tasks requiring recon before implementation

- `INVOICE-CORRECTIONS-FOUNDATION-001` → first `INVOICE-CORRECTIONS-RECON-001`.
- `DISCOUNTS-APPROVALS-001` → reconcile with invoice correction/adjustment governance.
- `CASHIER-SHIFTS-FOUNDATION-001` → first `CASHIER-SHIFTS-RECON-001`.
- `FINANCE-REPORTING-READMODELS-001` → first `FINANCE-REPORTING-RECON-001`.
- `DEBT-AGING-COLLECTIONS-001` → first reporting/correction authority, then debt recon.
- `FINANCE-DASHBOARD-001` → first reporting read models.
- `FINANCE-WRITEOFF-GOVERNANCE-001` → narrow governance recon, explicitly preserve existing lifecycle.
- schedule reminders/public booking → first `SCHEDULE-OPERATIONS-RECON-001` and conflict hardening.
- document PDF/signing → first `DOCUMENT-SNAPSHOT-RECON-001` and snapshot foundation.
- amoCRM production sync → first connection/token/entitlement/logging recon against current skeleton.
- SaaS billing implementation → first platform role/access/entitlement recon.
- warehouse implementation → first domain/material-use recon.

## 33. Known uncertainties

**Issues/Limitations:**

1. Repository evidence proves current code and migrations, not production deployment state, backup quality or real clinic adoption.
2. Historical browser reports vary in depth; some older reports explicitly record skipped scenarios. Current classification uses later code/tests and does not promote old PASS claims beyond their tested scope.
3. The full source role catalogue contains more roles than the current database/frontend capability maps. The exact future role migration policy is not yet reconciled.
4. Legal requirements for official medical documents, signatures, fiscal receipts, consent and retention require product/legal decisions outside current code.
5. Appointment time-zone and resource rules are not formalized enough to prescribe a final conflict schema in this report.
6. “Prepayment” may mean received unallocated money, a reserved deposit purpose, or an invoice overpayment in staff language. The next task must define those words explicitly while preserving one payment source of truth.
7. No cloud database or production environment was inspected or modified.
8. The report intentionally does not update stale roadmap documents; they remain historical and should point to this report in a later dedicated docs task.

## 34. Validation

**Checks:** Required report-only checks were run on the final report worktree:

```text
git status --short
npm run lint
npm run test -- --run
npm run build
```

Validation results:

- `git status --short`: only `_ai_work/REPORTS/POST-FINANCE-ROADMAP-RECON-001_roadmap.md` was untracked/changed before commit;
- `npm ci`: passed; 296 packages installed from the lock file;
- `npm run lint`: passed;
- `npm run test -- --run`: passed, **79 test files / 809 tests**;
- `npm run build`: passed, 1,945 modules transformed;
- application code changes: none;
- SQL/migration changes: none;
- test changes: none;
- generated types: none;
- seed changes: none;
- dependency/lock changes: none;
- cloud operations: none;
- intended changed file: this report only.

Non-blocking baseline observations:

- existing React test-suite `act(...)` warnings were emitted in older tests while all tests passed;
- Vite reported the existing bundle-size warning for the approximately 1,007.50 kB main chunk;
- `npm ci` reported two high-severity dependency audit findings; this report-only task did not update dependencies or run `npm audit fix`.

**Browser smoke:** No new browser actions were run because the task is report-only and browser access was disabled by task policy. Current browser evidence was reconciled from the merged auth/tenant, clinical, schedule, cashier, timeline, audit and deposit QA reports listed in section 9; repository code and current automated tests were treated as authoritative where older browser reports recorded limitations.

## 35. Fresh CI
Implementation-head CI completed successfully:

- workflow: `CI`;
- run: `#683`;
- run ID: `29149263631`;
- tested commit: `ba99a71aa9462e8539b71fcc80724024aff8e96b`;
- ESLint: passed;
- tests: passed;
- build: passed;
- changed files: exactly this report;
- PR state: open and unmerged.

The final report metadata commit cannot contain the future CI run that tests itself. The finalization receipt and final response must therefore verify that a fresh second CI run tested the final PR head after this metadata update.

Required final verification:

- tested commit equals current PR head;
- workflow `CI` completed successfully;
- ESLint passed;
- tests passed;
- build passed;
- only the report file is changed;
- PR remains open and unmerged.

## 36. Final verdict

**POST-FINANCE ROADMAP RECONCILED AND NEXT TASK VERIFIED**

Current DentalFlow is a mixed-maturity but substantial system, not the prototype described by older route/roadmap files. The repository already contains a verified finance and clinical foundation. The correct next task is not another generic feature build and not the previous report’s recommendation copied blindly.

The exact next task is:

`CASHIER-CREDIT-PREPAYMENT-HARDENING-001`

It is selected because it closes a real P0 financial integrity gap while reusing the current payment, credit, audit and deposit architecture. It is not a duplicate because no current operation combines intentional unallocated credit intake with idempotency, payload conflict detection and uncertain-response recovery.

Do not merge this report PR automatically. Do not start the recommended task inside this PR.
