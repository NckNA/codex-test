# 16_DEVELOPMENT_ROADMAP_AND_TASK_BACKLOG.md

## Назначение документа

Этот документ описывает дорожную карту разработки DentalFlow CRM и правила ведения backlog.

DentalFlow создаётся как SaaS CRM-платформа для стоматологических клиник, а не как одноразовый экран “пациенты + кнопка сохранить”. Поэтому развитие проекта должно идти по фазам: сначала источники и архитектура, затем стабилизация прототипа, затем backend, tenant isolation, storage, security, медицинские модули, интеграции, billing и production hardening.

Главное правило:

**нельзя строить production SaaS поверх frontend/localStorage-прототипа без backend, tenant isolation, permissions, storage strategy and security boundaries.**

Второе главное правило:

**любая крупная возможность должна разбиваться на маленькие задачи с понятным scope, acceptance criteria, checks and report.**

Третье главное правило:

**roadmap — это порядок движения, а не обещание реализовать всё сразу.**

Если попытаться делать всё одновременно, получится не CRM, а технический салат: amoCRM уже синхронизируется, billing кого-то отключает, зубная карта живёт в localStorage, документы переписываются задним числом, а backend где-то в углу держит табличку “я просто proxy”. Такой цирк лучше не строить, даже если билеты уже напечатаны.

---

## Главная цель roadmap

Roadmap должен помочь:

- не терять стратегическую цель;
- видеть зависимости между задачами;
- не начинать опасные функции раньше фундамента;
- сохранять SaaS-направление;
- разделять prototype, skeleton and production;
- управлять backlog;
- давать Jules/Codex маленькие безопасные задачи;
- проверять, что каждая задача ведёт проект вперёд;
- не превращать репозиторий в склад случайных экспериментов.

Roadmap не должен быть догмой.

Но он должен защищать проект от хаотичного “а давай ещё вот это”.

---

## Product destination

Конечная цель DentalFlow:

```text
SaaS CRM-платформа для стоматологических клиник
```

Система должна поддерживать:

- несколько независимых clinic tenants;
- tenant isolation;
- роли и права;
- карточку пациента;
- зубную карту;
- clinical findings;
- планы лечения;
- patient preview;
- документы snapshot;
- расписание;
- финансы клиники;
- склад;
- отчёты;
- amoCRM integration;
- platform billing;
- тарифы;
- отключение tenant за неоплату;
- backend/database source of truth;
- audit;
- safe UI;
- controlled AI workflow.

Это конечное направление, а не одна задача.

---

## Roadmap philosophy

Разработка должна идти от безопасного ядра к сложным функциям.

Правильная логика:

```text
source documents
→ prototype stabilization
→ backend foundation
→ tenant/auth/permissions
→ storage/database
→ core clinic modules
→ documents/finance/schedule
→ integrations
→ billing/access control
→ production hardening
```

Плохая логика:

```text
сразу real amoCRM sync
сразу payment provider
сразу public booking
сразу AI doctor
сразу multi-tenant billing
сразу production claims
```

Сразу всё — это не скорость.

Это способ быстро создать дорогой беспорядок.

---

## Phase overview

Основные фазы:

```text
Phase 0 — Source foundation
Phase 1 — Prototype audit and stabilization
Phase 2 — Frontend domain cleanup
Phase 3 — Backend foundation
Phase 4 — Tenant, auth and permissions foundation
Phase 5 — Storage and database foundation
Phase 6 — Core clinic modules
Phase 7 — Medical documents and finance
Phase 8 — amoCRM real integration
Phase 9 — Billing and SaaS access control
Phase 10 — Reports, imports, exports and operational tools
Phase 11 — Production hardening
Phase 12 — AI-assisted features, only after safety foundation
```

Фазы могут пересекаться частично, но опасные production-функции нельзя начинать до их prerequisites.

---

## Phase 0 — Source foundation

Цель:

```text
создать стабильную базу правил проекта
```

Source documents:

```text
00_PROJECT_MASTER_CONTEXT.md
01_PRODUCT_VISION_AND_BUSINESS_MODEL.md
02_ROLES_AND_PERMISSIONS.md
03_MULTI_TENANT_ARCHITECTURE_RULES.md
04_DATA_ISOLATION_AND_SECURITY.md
05_MEDICAL_DOMAIN_MODEL.md
06_PATIENT_CARD_AND_DENTAL_CHART_RULES.md
07_TREATMENT_PLAN_AND_DOCUMENTS.md
08_APPOINTMENTS_AND_SCHEDULE.md
09_AMOCRM_INTEGRATION_RULES.md
10_AMOCRM_TECHNICAL_ARCHITECTURE.md
11_BACKEND_AND_API_ARCHITECTURE.md
12_BILLING_AND_ACCESS_CONTROL.md
13_STORAGE_AND_MIGRATION_STRATEGY.md
14_UI_UX_RULES.md
15_AI_WORKFLOW_FOR_JULES_CODEX_CHATGPT.md
16_DEVELOPMENT_ROADMAP_AND_TASK_BACKLOG.md
17_TASK_TEMPLATE_AND_PR_REVIEW_CHECKLIST.md
18_TESTING_AND_QUALITY_ASSURANCE_STRATEGY.md
```

Acceptance:

- all source docs created;
- SOURCES_INDEX marks all Provided;
- no placeholder docs;
- no missing exact content;
- source foundation summary report created;
- Jules/Codex can reference docs for future tasks.

---

## Phase 0 backlog

Tasks:

```text
DOCS-001 — initialize _ai_work/SOURCES structure
DOCS-002-A — add source docs 00-03
DOCS-002-B — add source docs 04-08
DOCS-002-C — add source docs 09-10
DOCS-002-D — add source docs 11-13
DOCS-002-E — add source docs 14-18
DOCS-003 — verify all source documents and SOURCES_INDEX
DOCS-004 — create source foundation summary report
DOCS-005 — create first implementation backlog from source docs
```

Do not implement application features in Phase 0 docs tasks.

---

## Phase 1 — Prototype audit and stabilization

Цель:

```text
понять текущее состояние фронтенд-прототипа и стабилизировать его
```

Before adding more features, нужно провести audit.

Проверить:

- current pages;
- current routes;
- current components;
- current localStorage shape;
- current patient card flow;
- current dental chart;
- current treatment plans;
- current appointment/schedule state;
- current amoCRM skeleton;
- current backend skeleton;
- current build/lint warnings;
- current risks.

Нельзя строить следующий этаж, если неизвестно, где уже трещины.

Да, люди часто пробуют. Потом называют это “рефакторингом”.

---

## Phase 1 backlog

Tasks:

```text
AUDIT-001 — inventory current project structure
AUDIT-002 — list current routes and pages
AUDIT-003 — list current localStorage keys and data shapes
AUDIT-004 — audit PatientCardPage component boundaries
AUDIT-005 — audit DentalChartTab current logic and known warning
AUDIT-006 — audit current TreatmentPlans UI and boundaries
AUDIT-007 — audit current amoCRM backend skeleton
AUDIT-008 — audit current backend package/check scripts
AUDIT-009 — create current prototype limitations report
AUDIT-010 — create stabilization backlog
```

Acceptance:

- no code changes unless task explicitly says;
- current state documented;
- risks listed;
- next stabilization tasks defined.

---

## Phase 2 — Frontend domain cleanup

Цель:

```text
разделить frontend components by domain and reduce accidental coupling
```

На этом этапе можно улучшать frontend prototype, но без попытки сделать production backend.

Фокус:

- PatientCardPage not God Component;
- clear tabs;
- domain components;
- safe placeholders;
- disabled future features;
- no fake buttons;
- role-aware UI placeholders;
- empty/loading/error states;
- localStorage limitations labelled;
- no direct external API calls from frontend.

---

## Phase 2 backlog

Tasks:

```text
FE-001 — stabilize app routing and page structure
FE-002 — split PatientCardPage into domain tabs if needed
FE-003 — improve PatientOverview boundaries
FE-004 — stabilize DentalChartTab visual and data boundaries
FE-005 — create FindingsTab / findings list if missing
FE-006 — stabilize TreatmentPlansTab boundaries
FE-007 — add DocumentsTab placeholder with snapshot rules
FE-008 — add FinanceTab placeholder/basic summary if safe
FE-009 — add Appointments/Schedule view placeholder or MVP view
FE-010 — add Integrations status placeholder
FE-011 — add Billing/access placeholder for clinic owner only
FE-012 — add role-aware UI metadata placeholders
FE-013 — add empty/loading/error states for key pages
FE-014 — remove fake actions and console-only buttons
FE-015 — document frontend prototype limitations
```

Acceptance:

- UI clearer;
- no fake production claims;
- no medical data sent to amoCRM;
- no direct frontend external API calls;
- no backend claims if backend not ready;
- build/lint pass.

---

## Phase 3 — Backend foundation

Цель:

```text
создать общий backend/API фундамент DentalFlow
```

Backend должен быть не только amoCRM proxy.

Он должен стать будущим source of truth and security boundary.

Фокус:

- backend structure;
- health route;
- config validation;
- response utilities;
- error utilities;
- request parsing;
- route organization;
- service/repository pattern;
- safe logs;
- no production secrets;
- no application domain yet beyond skeleton.

---

## Phase 3 prerequisites

Before Phase 3 implementation:

- source docs 00-18 completed;
- current backend skeleton audited;
- backend scope defined;
- package impact clear;
- no decision hidden;
- report template ready.

---

## Phase 3 backlog

Tasks:

```text
BE-001 — audit current backend skeleton
BE-002 — define backend folder structure
BE-003 — add backend health/readiness routes if missing
BE-004 — add shared JSON response utility
BE-005 — add shared safe error model
BE-006 — add config validation without exposing secrets
BE-007 — add requestId middleware/skeleton
BE-008 — add route registry pattern
BE-009 — add service layer skeleton
BE-010 — add repository layer skeleton placeholder
BE-011 — add backend check/test scripts
BE-012 — document backend skeleton limitations
```

Acceptance:

- backend still minimal;
- no auth pretending;
- no database pretending;
- no real tenant enforcement unless implemented;
- skeleton clearly marked skeleton;
- checks pass.

---

## Phase 4 — Tenant, auth and permissions foundation

Цель:

```text
заложить SaaS access model
```

Без tenant/auth/permissions нельзя безопасно делать production SaaS.

Фокус:

- Tenant model;
- User model;
- TenantUser membership;
- roles;
- permissions;
- platform roles vs clinic roles;
- support access future;
- access guard;
- permission guard;
- feature guard future;
- no cross-tenant data.

---

## Phase 4 prerequisites

Before Phase 4:

- backend foundation exists;
- storage/database direction selected or at least documented;
- roles source doc exists;
- multi-tenant source doc exists;
- data isolation source doc exists;
- backend/API source doc exists.

---

## Phase 4 backlog

Tasks:

```text
AUTH-001 — design auth/session strategy
AUTH-002 — define User and TenantUser model
TENANT-001 — define Tenant model
TENANT-002 — implement tenant context skeleton
TENANT-003 — implement tenant guard skeleton
RBAC-001 — define roles and permissions constants
RBAC-002 — implement permission checking service
RBAC-003 — implement platform vs clinic role separation
RBAC-004 — add permission-aware backend route examples
RBAC-005 — add permission-aware frontend UI placeholders
SUPPORT-001 — design support access model
SEC-001 — add tenant isolation tests skeleton
```

Acceptance:

- tenant context not fake;
- permission checks backend-side;
- no frontend-only security;
- no global clinic role without tenant context;
- no cross-tenant access.

---

## Phase 5 — Storage and database foundation

Цель:

```text
перевести проект от localStorage prototype к backend/database source of truth
```

Storage is the foundation of SaaS.

Фокус:

- database choice;
- schema migrations;
- tenantId strategy;
- patient table;
- appointment table;
- medical tables;
- treatment plan tables;
- document snapshot storage;
- finance/billing separation;
- integration tables;
- audit tables;
- localStorage migration plan.

---

## Phase 5 prerequisites

Before Phase 5:

- backend foundation exists;
- tenant model direction exists;
- storage strategy source doc exists;
- current localStorage shape audited;
- migration risks understood.

---

## Phase 5 backlog

Tasks:

```text
DB-001 — choose database and migration tool
DB-002 — add database config skeleton
DB-003 — create initial tenant/user schema
DB-004 — create patient schema
DB-005 — create appointment schema
DB-006 — create dental chart schema
DB-007 — create findings schema
DB-008 — create treatment plan schema
DB-009 — create document snapshot schema
DB-010 — create clinic finance schema skeleton
DB-011 — create platform billing schema skeleton
DB-012 — create integration connection schema
DB-013 — create audit log schema
MIG-001 — document localStorage current shape
MIG-002 — add localStorage version if still used
MIG-003 — design localStorage to backend migration
MIG-004 — create migration dry-run report format
```

Acceptance:

- tenantId present where required;
- no cross-tenant references;
- migrations versioned;
- no localStorage.clear migration;
- no production secrets;
- backup/rollback considered.

---

## Phase 6 — Core clinic modules

Цель:

```text
создать рабочее ядро клиники
```

Core modules:

- patients;
- appointments;
- dental chart;
- findings;
- treatment plans;
- documents placeholder/snapshot;
- finance skeleton;
- reports basics.

Эта фаза делает DentalFlow реально полезной для клиники.

---

## Phase 6 backlog — Patients

Tasks:

```text
PAT-001 — implement Patient API
PAT-002 — implement Patients list backend-backed
PAT-003 — implement PatientCard backend-backed
PAT-004 — implement patient search tenant-scoped
PAT-005 — implement patient source and lead status
PAT-006 — implement patient history skeleton
PAT-007 — add patient audit events
PAT-008 — migrate patient prototype data if needed
```

Acceptance:

- tenant-scoped;
- permission-aware;
- no raw database object leakage;
- no medical data to amoCRM;
- frontend shows empty/loading/error states.

---

## Phase 6 backlog — Appointments

Tasks:

```text
APT-001 — implement Appointment model/API
APT-002 — implement schedule list/day view
APT-003 — implement create/edit/cancel appointment
APT-004 — implement appointment status lifecycle
APT-005 — implement doctor selector
APT-006 — implement conflict validation skeleton
APT-007 — implement patient appointment history
APT-008 — implement no-show status
APT-009 — implement appointment audit events
```

Acceptance:

- appointment does not complete treatment;
- appointment does not create payment;
- appointment does not change tooth state;
- conflict validation backend-side;
- tenant-scoped.

---

## Phase 6 backlog — Dental chart and findings

Tasks:

```text
MED-001 — implement DentalChart backend model/API
MED-002 — implement ToothState persistence
MED-003 — implement DentalFinding model/API
MED-004 — implement FindingsTab
MED-005 — implement finding severity/status
MED-006 — link findings to toothNumber
MED-007 — add medical permission checks
MED-008 — add audit events for dental chart/finding changes
MED-009 — add validation for toothNumber and status transitions
```

Acceptance:

- findings not diagnosis automatically;
- toothNumber tenant/patient scoped;
- no medical data to amoCRM;
- medical permissions respected;
- audit created for important changes.

---

## Phase 6 backlog — Treatment plans

Tasks:

```text
TPLAN-001 — implement TreatmentPlan model/API
TPLAN-002 — implement TreatmentStage model/API
TPLAN-003 — link findings to plan/stages
TPLAN-004 — implement plan status transitions
TPLAN-005 — implement plan total amount with currency
TPLAN-006 — implement PatientPreview from plan
TPLAN-007 — separate patient-facing text from internal note
TPLAN-008 — implement plan audit events
TPLAN-009 — add safe commercial summary DTO
```

Acceptance:

- treatment plan not completed service;
- treatment plan not payment;
- patient preview not document;
- no medical data to amoCRM;
- status transitions controlled.

---

## Phase 7 — Medical documents and finance

Цель:

```text
реализовать документы snapshot and clinic finance без смешивания доменов
```

Документы и финансы high-risk.

Нужны clear boundaries.

---

## Phase 7 backlog — Documents

Tasks:

```text
DOCMOD-001 — implement DocumentTemplate model
DOCMOD-002 — implement MedicalDocument snapshot model
DOCMOD-003 — implement generate document snapshot action
DOCMOD-004 — implement document statuses
DOCMOD-005 — implement print view from snapshot
DOCMOD-006 — implement document cancellation
DOCMOD-007 — implement document audit events
DOCMOD-008 — implement document permissions
DOCMOD-009 — implement PDF export only after snapshot rules
```

Acceptance:

- document snapshot immutable;
- preview not official document;
- old documents not silently updated;
- no medical documents to amoCRM;
- permission protected.

---

## Phase 7 backlog — Clinic finance

Tasks:

```text
FIN-001 — implement clinic payment model
FIN-002 — implement payment API
FIN-003 — implement patient payment history
FIN-004 — implement debt/balance summary
FIN-005 — implement refund skeleton
FIN-006 — implement cashier permissions
FIN-007 — implement finance audit events
FIN-008 — implement basic finance reports
```

Acceptance:

- clinic finance separate from platform billing;
- payment does not complete treatment;
- payment does not close finding;
- amount/currency explicit;
- permissions enforced.

---

## Phase 7 backlog — Warehouse future

Warehouse should wait until clinic core is stable.

Tasks later:

```text
WH-001 — design warehouse model
WH-002 — implement warehouse item list
WH-003 — implement stock movements
WH-004 — link material usage to CompletedService, not Appointment alone
WH-005 — implement supplier/purchase skeleton
WH-006 — implement warehouse reports
```

Acceptance:

- no automatic write-off from appointment;
- material usage tied to actual service/workflow;
- tenant-scoped.

---

## Phase 8 — amoCRM real integration

Цель:

```text
перейти от OAuth skeleton к safe real integration
```

amoCRM real integration нельзя делать до backend/tenant/storage/security foundation.

amoCRM получает only safe commercial summary.

---

## Phase 8 prerequisites

Before real sync:

- backend exists;
- tenant model exists;
- auth/permissions exist;
- feature entitlement exists or skeleton;
- token storage backend-side;
- safe DTO mapper;
- field mapping;
- sync logs;
- audit logs;
- no frontend direct API calls;
- no medical data to amoCRM.

---

## Phase 8 backlog

Tasks:

```text
AMO-PROD-001 — audit current amoCRM OAuth skeleton
AMO-PROD-002 — implement tenant-scoped AmoCrmConnection model
AMO-PROD-003 — implement protected token storage
AMO-PROD-004 — implement token refresh
AMO-PROD-005 — implement safe contact DTO mapper
AMO-PROD-006 — implement safe deal DTO mapper
AMO-PROD-007 — implement sync preview
AMO-PROD-008 — implement tenant-scoped field mapping
AMO-PROD-009 — implement sync logs
AMO-PROD-010 — implement manual safe sync
AMO-PROD-011 — implement retry/rate limit handling
AMO-PROD-012 — implement webhook validation
AMO-PROD-013 — implement inbound safe sync
AMO-PROD-014 — implement automatic sync only after manual sync stable
```

Acceptance:

- no tokens in frontend;
- no direct frontend amoCRM API calls;
- no toothNumber;
- no findings;
- no riskDescription;
- no diagnosis;
- no medical documents;
- tenant-scoped connection;
- sync logs safe.

---

## Phase 9 — Billing and SaaS access control

Цель:

```text
сделать DentalFlow коммерческим SaaS
```

Billing/access нельзя делать только UI.

Backend must enforce:

- subscription status;
- access status;
- feature entitlement;
- limits;
- tenant suspension;
- billing visibility.

---

## Phase 9 prerequisites

Before real billing enforcement:

- tenant model exists;
- roles/permissions exist;
- backend access guard exists;
- storage/database exists;
- platform vs clinic roles separated;
- platform billing separated from clinic finance.

---

## Phase 9 backlog

Tasks:

```text
BILL-001 — implement TariffPlan model
BILL-002 — implement Subscription model
BILL-003 — implement TenantAccessStatus model
BILL-004 — implement FeatureEntitlement model
BILL-005 — implement manual platform billing admin
BILL-006 — implement access guard by subscription/access status
BILL-007 — implement feature guard
BILL-008 — implement limits guard
BILL-009 — implement tenant suspension action
BILL-010 — implement tenant reactivation action
BILL-011 — implement clinic owner billing view
BILL-012 — implement platform billing dashboard
BILL-013 — implement billing audit events
BILL-014 — design payment provider integration
BILL-015 — implement payment provider only after security review
```

Acceptance:

- platform billing != clinic finance;
- patient payment does not activate SaaS subscription;
- suspension does not delete data;
- feature gates backend-enforced;
- billing details role-aware;
- audit exists.

---

## Phase 10 — Reports, imports, exports and operational tools

Цель:

```text
дать владельцу клиники и platform owner управленческие инструменты
```

Reports должны быть tenant-scoped.

Imports/exports high-risk.

---

## Phase 10 backlog — Reports

Tasks:

```text
REP-001 — implement appointments report
REP-002 — implement no-show report
REP-003 — implement treatment plan conversion report
REP-004 — implement finance basic report
REP-005 — implement doctor workload report
REP-006 — implement source conversion report
REP-007 — implement platform revenue report
REP-008 — implement tenant health report
```

Acceptance:

- tenant-scoped;
- role-aware;
- platform reports no medical details;
- clinic finance separate from platform billing.

---

## Phase 10 backlog — Import/export

Tasks:

```text
IMP-001 — design patient import format
IMP-002 — implement import dry-run
IMP-003 — implement duplicate detection
IMP-004 — implement controlled patient import
EXP-001 — design patient export
EXP-002 — implement role-protected export
EXP-003 — implement export audit
EXP-004 — implement export expiration
```

Acceptance:

- no cross-tenant data;
- no import without validation;
- no export without permission;
- no raw sensitive data leakage;
- audit exists.

---

## Phase 10 backlog — Operational tools

Tasks:

```text
OPS-001 — implement audit log viewer
OPS-002 — implement sync log viewer
OPS-003 — implement support access request
OPS-004 — implement tenant health dashboard
OPS-005 — implement system settings skeleton
OPS-006 — implement safe debug tools for development only
```

Acceptance:

- role restricted;
- no secrets;
- no medical data to platform support without policy;
- audit visible where allowed.

---

## Phase 11 — Production hardening

Цель:

```text
подготовить DentalFlow к реальному SaaS usage
```

Production hardening включает:

- security;
- testing;
- monitoring;
- backups;
- performance;
- migration safety;
- deployment;
- CI/CD;
- incident response.

---

## Phase 11 backlog

Tasks:

```text
PROD-001 — define production deployment architecture
PROD-002 — configure environment separation
PROD-003 — configure secret management
PROD-004 — implement backup strategy
PROD-005 — implement restore test procedure
PROD-006 — add monitoring/logging strategy
PROD-007 — add error tracking with sensitive data filtering
PROD-008 — add CI checks
PROD-009 — add secret scan
PROD-010 — add tenant isolation tests
PROD-011 — add permission tests
PROD-012 — add migration tests
PROD-013 — add performance checks
PROD-014 — define incident response procedure
```

Acceptance:

- no production secrets in Git;
- backups tested;
- tenant isolation tested;
- no sensitive data in logs;
- CI meaningful;
- deployment documented.

---

## Phase 12 — AI-assisted features

Цель:

```text
использовать AI как помощника, не как автономного врача
```

AI features should wait until:

- medical boundaries exist;
- permissions exist;
- audit exists;
- data classification exists;
- doctor confirmation workflow exists;
- no automatic diagnosis;
- no automatic treatment plan approval.

---

## Phase 12 backlog

Tasks:

```text
AI-001 — define AI safety rules for DentalFlow
AI-002 — design AI assistant for admin text only
AI-003 — design AI summary for patient communication with review
AI-004 — design AI treatment plan explanation helper
AI-005 — implement doctor-reviewed AI suggestions
AI-006 — implement AI audit/logging
AI-007 — test no automatic diagnosis
AI-008 — test no unauthorized medical exposure
```

Acceptance:

- AI suggestion clearly marked;
- doctor/user confirmation required;
- no automatic diagnosis;
- no automatic medical facts;
- no medical data sent to unsafe external systems;
- audit exists.

---

## MVP definition

MVP should be useful but honest.

MVP can include:

- patients list;
- patient card;
- basic dental chart;
- findings;
- treatment plans;
- basic appointments;
- patient preview;
- document placeholder or simple snapshot;
- basic finance summary;
- safe amoCRM placeholder or limited OAuth skeleton;
- manual settings;
- localStorage prototype if clearly marked;
- backend skeleton if clearly marked.

MVP should not claim:

- production SaaS;
- real multi-tenant safety;
- full billing;
- production amoCRM sync;
- legal documents engine;
- production storage;
- AI diagnosis;
- payment provider;
- public booking.

MVP is not a lie if labelled correctly.

It becomes a lie when “prototype” disappears from the sentence.

---

## Prototype allowed

Prototype can use:

- localStorage;
- fake tenant;
- fake users;
- mock roles;
- disabled buttons;
- placeholder integrations;
- fake reports;
- static demo data.

But prototype must not pretend to be production.

Reports and UI should state limitations.

---

## Prototype forbidden shortcuts

Even prototype should avoid:

- sending medical data to amoCRM;
- fake sync buttons;
- fake payment provider;
- pretending documents are official snapshots if they are not;
- mixing patient payment and platform billing;
- deleting local data as “migration” without warning;
- building God Components without plan to split.

Prototype shortcuts become production disasters when nobody remembers they were shortcuts.

And nobody remembers. That is why this document exists.

---

## Production readiness gates

Before claiming production-ready, DentalFlow must have:

- backend/database source of truth;
- auth;
- tenant isolation;
- roles and permissions;
- production storage;
- backups;
- audit logs;
- safe documents;
- secure integrations;
- billing/access control;
- tests;
- deployment strategy;
- monitoring;
- incident response;
- no real secrets in repo;
- no patient data leakage.

If these are missing, use words:

```text
prototype
skeleton
dev-only
not production-ready
```

---

## Dependency rules

Some work must wait for prerequisites.

### Real amoCRM sync must wait for

```text
backend
tenant model
auth/permissions
token storage
safe DTO
sync logs
feature entitlement
```

### Payment provider must wait for

```text
backend
billing model
tenant access model
secret management
webhook validation
idempotency
audit
```

### Public booking must wait for

```text
tenant routing
schedule backend
slot validation
rate limiting
privacy rules
feature entitlement
```

### Medical document engine must wait for

```text
document snapshot model
templates
permissions
audit
storage
print/export rules
```

### AI medical helper must wait for

```text
medical model
doctor confirmation
audit
permissions
data safety rules
```

### Multi-tenant production must wait for

```text
tenant guard
database tenantId
auth
permissions
tests
no localStorage source of truth
```

---

## Do-not-start-yet list

Do not start these too early:

```text
real amoCRM automatic sync
payment provider integration
public online booking
AI diagnosis
automatic treatment recommendation
production document signing
warehouse auto-writeoff
multi-branch enterprise logic
complex subscription automation
external API access for tenants
bulk import without dry-run
production PDF engine
mobile full dental chart editor
```

These are not bad features.

They are bad early features.

Timing matters. Even humans discovered this eventually, mostly through regret.

---

## Backlog categories

Backlog should be grouped.

Categories:

```text
DOCS
AUDIT
FE
BE
AUTH
TENANT
RBAC
DB
MIG
PAT
APT
MED
TPLAN
DOCMOD
FIN
WH
AMO
BILL
REP
IMP
EXP
OPS
PROD
AI
QA
SEC
```

Prefix helps see domain.

---

## Task ID prefixes

Recommended prefixes:

```text
DOCS — documentation
AUDIT — project/code audit
FE — frontend
BE — backend foundation
AUTH — authentication
TENANT — tenant model
RBAC — roles/permissions
DB — database/schema
MIG — migrations
PAT — patients
APT — appointments
MED — medical/dental chart/findings
TPLAN — treatment plans
DOCMOD — documents module
FIN — clinic finance
WH — warehouse
AMO — amoCRM integration
BILL — platform billing/access
REP — reports
IMP — imports
EXP — exports
OPS — operational tools
PROD — production hardening
AI — AI-assisted features
QA — testing/quality
SEC — security
```

Do not reuse Task ID for different work.

---

## Task size rule

One task should be small enough to review.

Good task:

```text
create one source doc
add one backend route skeleton
split one component
add one safe DTO mapper
add one report
```

Bad task:

```text
implement full backend, billing, amoCRM and documents
```

Large tasks hide risk.

Small tasks expose risk before it becomes expensive.

---

## Task readiness checklist

Before creating a task, check:

```text
Is the goal clear?
Is scope limited?
Are allowed files known?
Are forbidden files known?
Are source docs referenced?
Are acceptance criteria testable?
Are checks defined?
Is tenant impact stated?
Is storage impact stated?
Is sensitive data impact stated?
Is report path defined?
Is branch name defined?
```

If not, task is not ready.

---

## Implementation task template location

Reusable task template belongs in:

```text
17_TASK_TEMPLATE_AND_PR_REVIEW_CHECKLIST.md
```

This roadmap references the need.

Document 17 provides exact template and checklist.

---

## Testing strategy location

Detailed testing strategy belongs in:

```text
18_TESTING_AND_QUALITY_ASSURANCE_STRATEGY.md
```

This roadmap lists testing milestones.

Document 18 defines QA rules.

---

## Backlog item format

Each backlog item should eventually include:

```text
Task ID
Title
Phase
Type
Goal
Relevant source docs
Context
Scope
Allowed
Forbidden
Tenant impact
Storage impact
Sensitive data impact
Acceptance criteria
Checks
Report path
Branch
PR title
Final response requirements
```

Do not use one-line “fix calendar” tasks.

That is not a task. That is a wish with a keyboard.

---

## Priority levels

Priority can be:

```text
P0 — required for safety/foundation
P1 — required for MVP
P2 — important after MVP
P3 — nice to have
P4 — future/enterprise
```

Priority is not excitement level.

Priority is dependency and product value.

---

## Risk levels

Risk can be:

```text
low
medium
high
critical
```

Critical tasks include:

- medical data changes;
- tenant isolation;
- auth;
- billing access;
- token storage;
- payment provider;
- destructive migration;
- document snapshots;
- cross-tenant operations.

Critical tasks need smaller PRs and stronger checks.

---

## Release tracks

Possible release tracks:

```text
Prototype track
Internal clinic track
Closed beta SaaS track
Paid SaaS track
Production hardening track
Enterprise track
```

Do not mix release claims.

Internal prototype can be messy if labelled.

Paid SaaS cannot.

---

## Internal clinic version

Before selling externally, DentalFlow can be used internally.

Internal clinic version may include:

- manual controls;
- limited roles;
- prototype warnings;
- manual backup/export;
- no production billing automation;
- limited integration.

But even internal version should avoid:

- leaking medical data;
- losing documents;
- pretending payment means treatment;
- sending clinical data to amoCRM.

Internal does not mean careless.

---

## Closed beta SaaS version

Closed beta SaaS should include:

- real tenant isolation;
- backend database;
- auth;
- roles;
- backup;
- clear limitations;
- manual billing;
- limited support process;
- no risky automation without review.

Closed beta can still be incomplete.

But it cannot be unsafe by design.

---

## Paid SaaS version

Paid SaaS requires:

- stable backend;
- reliable storage;
- tenant isolation tests;
- access control;
- billing/access controls;
- support process;
- backup/restore;
- monitoring;
- clear terms;
- incident response;
- security review.

Taking money raises the bar.

Shocking discovery, apparently.

---

## Enterprise future

Enterprise features can include:

- multi-branch;
- API access;
- advanced reports;
- custom templates;
- SSO;
- custom billing;
- support SLA;
- data export packages;
- audit exports.

Do not design MVP around enterprise complexity.

But do not block future enterprise with bad foundations.

---

## Technical debt policy

Technical debt is allowed if:

- intentional;
- documented;
- scoped;
- has cleanup task;
- does not violate safety boundaries.

Bad debt:

- no tenant isolation;
- hidden secrets;
- fake sync;
- localStorage production claims;
- document snapshot mutation;
- mixed billing/finance;
- medical data in amoCRM.

Some debt is a loan.

Some debt is a building collapse.

---

## Cleanup tasks

Every known shortcut should create cleanup backlog item.

Examples:

```text
CLEAN-001 — remove fake action from TreatmentPlansTab
CLEAN-002 — split PatientCardPage God Component
CLEAN-003 — replace localStorage patient storage with API
CLEAN-004 — remove dev-only token store before production
CLEAN-005 — add missing loading/error states
```

Cleanup must be visible.

Hidden cleanup is just future pain with no calendar invite.

---

## Risk backlog

Project should maintain risks.

Risk tasks may include:

```text
RISK-001 — review medical data leakage paths
RISK-002 — review tenant isolation assumptions
RISK-003 — review localStorage limitations
RISK-004 — review amoCRM token handling
RISK-005 — review billing/access confusion
RISK-006 — review document snapshot risks
```

Risks should not be buried.

---

## Security backlog

Security tasks:

```text
SEC-001 — define data classification
SEC-002 — define secret handling policy
SEC-003 — add secret scan
SEC-004 — add tenant isolation test plan
SEC-005 — define support access policy
SEC-006 — define audit log policy
SEC-007 — define incident response
SEC-008 — review external integrations
```

Security is not final polish.

Security is foundation that people usually remember after something catches fire.

---

## QA backlog

QA tasks:

```text
QA-001 — define smoke test checklist
QA-002 — define PR review checklist
QA-003 — define docs validation checks
QA-004 — define frontend manual QA checklist
QA-005 — define backend API test checklist
QA-006 — define tenant isolation tests
QA-007 — define migration test checklist
QA-008 — define release checklist
```

Detailed QA belongs in document 18.

---

## Release checklist future

Before any release:

- build passes;
- lint passes;
- core flows tested;
- no forbidden files changed accidentally;
- no secrets;
- no patient data;
- no cross-tenant leak;
- reports updated;
- known limitations documented;
- rollback plan if needed.

Release without checklist is optimism.

Optimism is not a deployment strategy.

---

## Current known caution areas

Known caution areas:

- current frontend may still rely on localStorage;
- backend skeleton may be amoCRM-focused;
- OAuth skeleton may use dev-only memory store;
- role/permission system may not be production;
- tenant isolation may not be enforced;
- document engine may not be real;
- billing/access control may not be implemented;
- CI may not be configured;
- reports may be manual.

These are not failures.

They are known boundaries.

Unknown boundaries are the dangerous ones.

---

## Current source foundation status

As of this document, expected source progress:

```text
00–15 provided
16 in progress
17–18 pending
```

After this task:

```text
00–16 provided
17–18 pending
```

This should be checked in SOURCES_INDEX.

---

## Next source tasks after 16

Next documents:

```text
17_TASK_TEMPLATE_AND_PR_REVIEW_CHECKLIST.md
18_TESTING_AND_QUALITY_ASSURANCE_STRATEGY.md
```

Do not skip them before starting broad implementation.

They are the guardrails for future tasks.

Yes, guardrails are less exciting than code.

So are brakes, until you need them.

---

## After 00-18 completion

After all source docs are complete:

```text
DOCS-003 — verify source index and file existence
DOCS-004 — create source foundation summary report
ROADMAP-001 — extract first implementation backlog from source docs
AUDIT-001 — audit current project structure
AUDIT-002 — audit current frontend and backend state
```

Do not jump straight to production integration.

---

## First implementation recommendations

After source foundation, recommended first implementation sequence:

```text
1. Audit current repo structure
2. Audit current UI/routes/localStorage
3. Audit backend skeleton
4. Fix docs/index/report inconsistencies
5. Stabilize build/lint warnings
6. Split obvious God Components
7. Add clearer placeholders/disabled states
8. Define backend foundation tasks
9. Define tenant/auth/storage tasks
10. Start backend foundation
```

This is less glamorous than “real amoCRM sync”.

It is also less likely to explode.

---

## Roadmap update policy

Roadmap can be updated.

But update requires:

- explicit task;
- reason;
- changed sections;
- report;
- review.

Do not silently rewrite roadmap inside implementation PR.

---

## Backlog update policy

Backlog can be adjusted as project learns.

Rules:

- add new tasks with IDs;
- do not reuse old IDs;
- mark obsolete tasks instead of deleting silently;
- explain dependency changes;
- keep safety gates.

Backlog should be living but not chaotic.

---

## Obsolete tasks

If a task becomes obsolete:

```text
status = obsolete
reason = replaced by ...
```

Do not delete history silently.

---

## Blocked tasks

If a task is blocked, write why.

Examples:

```text
blocked by missing backend auth
blocked by missing tenant model
blocked by missing database choice
blocked by missing source document
blocked by legal/payment provider decision
```

Blocked is not failed.

Blocked is useful truth.

---

## Task statuses

Possible task statuses:

```text
backlog
ready
in_progress
blocked
in_review
merged
done
obsolete
```

For GitHub PR tasks, `merged` means code/docs entered main.

`done` can mean follow-up verification complete.

---

## Definition of ready

Task is ready when:

- scope clear;
- source docs known;
- prerequisites met;
- acceptance criteria clear;
- checks defined;
- no missing decisions;
- no missing exact content;
- branch name defined;
- report path defined.

If not ready, do not give to Jules/Codex.

---

## Definition of done

Task is done when:

- implementation/docs completed;
- PR created;
- changed files reviewed;
- checks run or limitations stated;
- report created;
- PR merged into main;
- merge verified;
- next step identified.

Created PR is not done.

Merged PR is closer.

Verified merge is done.

---

## Definition of blocked

Task is blocked when:

- missing decision;
- missing source doc;
- missing exact content;
- missing dependency;
- unsafe to proceed;
- requires legal/payment/security decision;
- requires credentials or secrets;
- requires production access;
- requires user confirmation.

Blocked tasks should not be forced.

Force is how careful projects become incident reports.

---

## Roadmap for documents 17 and 18

Document 17 should define:

- reusable task template;
- PR review checklist;
- report checklist;
- docs-only checklist;
- frontend checklist;
- backend checklist;
- integration checklist;
- billing checklist;
- storage/migration checklist;
- security checklist.

Document 18 should define:

- testing strategy;
- manual QA;
- automated tests;
- smoke tests;
- tenant isolation tests;
- security checks;
- build/lint checks;
- release checks;
- regression strategy.

---

## Roadmap for first real code tasks

First real code tasks should be conservative.

Examples:

```text
AUDIT-001 — repo structure audit
AUDIT-002 — current route/component inventory
CLEAN-001 — remove or document fake actions
FE-013 — add missing empty/loading/error states
BE-001 — backend skeleton audit
BE-004 — shared JSON response utility refinement
```

Avoid:

```text
AMO-PROD-010 real sync
BILL-015 payment provider
AI-005 AI medical suggestions
```

too early.

---

## Task dependency examples

Example dependency:

```text
AMO-PROD-010 manual safe sync
depends on:
- AMO-PROD-002 tenant-scoped connection
- AMO-PROD-003 protected token storage
- AMO-PROD-005 safe contact DTO
- AMO-PROD-009 sync logs
- RBAC permission guard
```

Example dependency:

```text
BILL-009 tenant suspension action
depends on:
- Tenant model
- Subscription model
- AccessStatus model
- Backend access guard
- Audit events
```

Example dependency:

```text
DOCMOD-003 generate document snapshot
depends on:
- TreatmentPlan model
- DocumentTemplate model
- Snapshot storage
- Permission guard
- Audit log
```

Dependencies are not paperwork.

They are the difference between architecture and wishful coding.

---

## Critical sequencing rules

Rules:

- no production amoCRM before backend token storage;
- no public booking before appointment backend/conflict validation;
- no payment provider before billing/access model;
- no AI medical suggestions before doctor confirmation workflow;
- no document signing before document snapshot;
- no multi-tenant SaaS claim before tenant isolation tests;
- no production storage claim before database/backups;
- no enterprise features before MVP core.

---

## Safe parallel work

Some work can happen in parallel.

Examples:

- UI placeholders and docs;
- backend skeleton and frontend audit;
- source docs and PR templates;
- manual QA checklist and current UI audit;
- design of billing model and implementation of patients API only if boundaries clear.

But avoid parallel work that touches same files or same high-risk domain.

---

## Unsafe parallel work

Avoid parallel tasks that modify:

- same component;
- same backend route;
- same source doc;
- same storage model;
- same migration;
- same integration flow;
- same billing/access rules.

Parallel AI agents plus same files equals merge conflict theater.

Tickets are free, but dignity is not.

---

## Backlog grooming

Backlog should be reviewed periodically.

Questions:

- Is this task still needed?
- Is it blocked?
- Is it too large?
- Does it have source docs?
- Does it have acceptance criteria?
- Is risk level correct?
- Does it depend on missing foundation?
- Can it be split?

Backlog grooming prevents accidental mega-tasks.

---

## Sprint concept

If using sprints, keep them small.

Example sprint:

```text
Sprint: Prototype audit
- AUDIT-001
- AUDIT-002
- AUDIT-003
- AUDIT-004
```

Do not make sprint:

```text
Implement SaaS
```

That is not a sprint. That is a prophecy.

---

## Milestones

Possible milestones:

```text
M0 — Source foundation complete
M1 — Prototype audited and stabilized
M2 — Backend skeleton stable
M3 — Tenant/auth/permissions foundation
M4 — Database-backed patient core
M5 — Core clinical workflow
M6 — Documents and finance MVP
M7 — Safe amoCRM integration beta
M8 — Manual billing/access beta
M9 — Closed beta SaaS
M10 — Paid SaaS ready
```

Milestones should have measurable acceptance.

---

## M0 — Source foundation complete

Acceptance:

- docs 00-18 exist;
- SOURCES_INDEX all Provided;
- source summary report created;
- task template exists;
- testing strategy exists;
- roadmap exists.

---

## M1 — Prototype audited and stabilized

Acceptance:

- current state documented;
- localStorage shape documented;
- routes documented;
- main risks documented;
- fake actions identified;
- build/lint stable;
- stabilization backlog created.

---

## M2 — Backend skeleton stable

Acceptance:

- backend runs;
- health route works;
- config validation exists;
- response/error utilities exist;
- report documents limitations;
- no production claims.

---

## M3 — Tenant/auth/permissions foundation

Acceptance:

- tenant model exists;
- user/membership model exists;
- permission model exists;
- backend guards exist;
- frontend reflects permissions;
- tenant isolation tests begin.

---

## M4 — Database-backed patient core

Acceptance:

- patients stored backend/database;
- patient list and card use API;
- tenant-scoped;
- localStorage no longer source of truth for patients;
- audit/log basics.

---

## M5 — Core clinical workflow

Acceptance:

- dental chart stored backend/database;
- findings stored backend/database;
- treatment plans stored backend/database;
- plan/finding links;
- patient preview;
- no medical data to amoCRM.

---

## M6 — Documents and finance MVP

Acceptance:

- document snapshot model;
- basic document generation from snapshot;
- clinic payments model;
- payment does not complete treatment;
- finance role permissions;
- audit.

---

## M7 — Safe amoCRM integration beta

Acceptance:

- tenant-scoped connection;
- protected token storage;
- safe DTO;
- manual sync;
- sync logs;
- no medical fields;
- reconnect flow;
- feature gate.

---

## M8 — Manual billing/access beta

Acceptance:

- tariff/subscription/access models;
- manual platform admin controls;
- feature entitlement;
- access guard;
- tenant suspension without data deletion;
- billing audit.

---

## M9 — Closed beta SaaS

Acceptance:

- multiple tenants;
- real auth;
- tenant isolation;
- production-like database;
- backups;
- audit;
- key modules usable;
- known limitations documented;
- support process.

---

## M10 — Paid SaaS ready

Acceptance:

- security review;
- reliable backups/restore;
- billing/access stable;
- monitoring;
- incident response;
- release checklist;
- support process;
- terms/legal review outside code;
- production deployment stable.

---

## Risk gates

Before moving to next major milestone, review risk gates.

Examples:

```text
Before M3:
tenant isolation design reviewed

Before M4:
storage/database migration plan reviewed

Before M7:
amoCRM medical leakage checks reviewed

Before M8:
platform billing vs clinic finance separation reviewed

Before M10:
security and backup strategy reviewed
```

Skipping risk gates is allowed only if the goal is future regret.

---

## Technical decision records

For major decisions, create decision records.

Examples:

```text
ADR-001 — database choice
ADR-002 — auth/session strategy
ADR-003 — tenant routing strategy
ADR-004 — file storage strategy
ADR-005 — payment provider choice
ADR-006 — amoCRM sync strategy
```

ADR can live in `_ai_work/DECISIONS/` if created later.

Do not bury major decisions in chat only.

---

## When to create ADR

Create ADR for decisions that are:

- hard to reverse;
- security-sensitive;
- architecture-wide;
- costly;
- involving vendor/provider;
- affecting data model;
- affecting tenant isolation;
- affecting billing/payment.

---

## Roadmap reports

Major roadmap updates should create report.

Report includes:

- reason for change;
- tasks added;
- tasks removed/obsolete;
- dependency changes;
- risk changes;
- next recommended tasks.

---

## Backlog source of truth

Backlog can live in source doc initially.

Later it may move to:

- GitHub issues;
- project board;
- `_ai_work/BACKLOG.md`;
- external tracker.

If moved, source doc should point to current backlog location.

Do not maintain three conflicting backlogs because humans enjoy synchronizing misery.

---

## GitHub issues future

Future task tracking can use GitHub Issues.

Rules:

- one issue per task;
- labels by domain;
- milestones;
- linked PR;
- acceptance criteria in issue;
- report linked after PR;
- close issue after merge verification.

Not required during source foundation.

---

## Labels future

Possible labels:

```text
docs
frontend
backend
security
multi-tenant
storage
migration
medical
appointments
treatment-plans
documents
finance
amocrm
billing
testing
blocked
high-risk
prototype
production
```

Labels help filter work.

---

## Project board future

A board can have columns:

```text
Backlog
Ready
In progress
Review
Merged
Blocked
Done
```

Do not let board replace acceptance criteria.

A card named “backend” in In Progress tells us almost nothing, which is apparently its favorite hobby.

---

## Documentation debt

Documentation debt includes:

- outdated source docs;
- missing report;
- missing acceptance criteria;
- unclear task scope;
- undocumented decision;
- stale roadmap;
- unclear migration;
- missing limitations.

Documentation debt becomes code debt later.

The conversion rate is terrible.

---

## Code debt

Code debt includes:

- God Components;
- fake actions;
- localStorage source of truth;
- no tenant guard;
- no permission checks;
- no validation;
- direct external API calls;
- no tests;
- secrets risk.

Code debt should be tracked.

---

## Data debt

Data debt includes:

- missing tenantId;
- ambiguous statuses;
- no currency;
- no document snapshot;
- no audit;
- old localStorage shape;
- unknown migration path;
- duplicate patients;
- external IDs without tenant context.

Data debt is the nastiest kind because it survives rewrites.

---

## Security debt

Security debt includes:

- frontend-only controls;
- tokens in unsafe storage;
- no tenant isolation tests;
- raw logs;
- no role separation;
- support superuser without audit;
- public links without expiration.

Security debt should not be normalized.

---

## Product debt

Product debt includes:

- unclear user roles;
- confusing statuses;
- mixed medical/commercial meanings;
- no empty states;
- fake production claims;
- hidden limitations;
- workflows that users cannot understand.

Product debt makes people stop using the system.

Then everyone blames “adoption”.

---

## Avoiding roadmap overload

Roadmap should not become a thousand-task graveyard.

Keep near-term tasks detailed.

Keep future tasks grouped.

Do not fully specify enterprise features before MVP core works.

A roadmap is a map, not a museum of ambitions.

---

## Near-term focus after source docs

Recommended immediate focus after 00-18:

```text
1. Verify source foundation
2. Audit current repository
3. Stabilize frontend prototype
4. Audit backend skeleton
5. Create backend foundation tasks
6. Choose storage/database path
7. Start tenant/auth design
```

This is the rational path.

The emotionally exciting path is “build real integration now”.

The rational path wins if the goal is a product, not fireworks.

---

## What not to do after source docs

Do not immediately:

- add payment provider;
- add public booking;
- add AI diagnosis;
- add automatic amoCRM sync;
- rewrite entire frontend;
- rewrite entire backend;
- migrate everything in one PR;
- create ten parallel Jules tasks touching same files.

---

## Quality bar by phase

Quality bar rises over time.

Prototype:

- works enough to validate flow;
- limitations visible.

Internal clinic:

- stable enough for controlled real use;
- data export/backup plan;
- no dangerous leaks.

Closed beta:

- tenant isolation;
- auth;
- database;
- support process.

Paid SaaS:

- production hardening;
- billing;
- monitoring;
- backups;
- incident response.

Do not use paid SaaS language for prototype.

---

## Roadmap and business model

Roadmap must support business model.

Business model requires:

- platform billing;
- tenant access control;
- feature entitlements;
- ability to onboard clinics;
- ability to suspend for non-payment;
- tenant data isolation;
- support and admin tools.

If roadmap ignores these, DentalFlow becomes internal clinic software, not SaaS.

---

## Roadmap and medical safety

Roadmap must protect medical safety.

Medical safety requires:

- role-aware access;
- no automatic diagnosis;
- doctor confirmation;
- document snapshots;
- no medical data to amoCRM;
- audit of clinical changes;
- clear UI wording.

If roadmap ignores this, DentalFlow becomes risky no matter how pretty.

---

## Roadmap and data safety

Data safety requires:

- backend/database;
- tenantId;
- migrations;
- backups;
- restore;
- no localStorage production;
- no secrets in repo;
- no raw sensitive logs.

Data loss is not a UX issue.

It is usually the moment users stop trusting the product.

---

## Roadmap and AI agents

AI agents should use roadmap to choose next tasks.

Agent must not jump to later phase unless user explicitly says and prerequisites are satisfied or task is docs/design only.

If user asks for risky later-phase implementation early, agent should warn and propose safer prerequisite task.

Not because agent is timid.

Because architecture has gravity.

---

## Task escalation

If task grows too large, split it.

Example:

Original:

```text
Implement backend patients
```

Split:

```text
PAT-001 define patient API contract
PAT-002 create patient schema
PAT-003 create patient repository
PAT-004 create patient routes
PAT-005 connect frontend patients list
PAT-006 add tests
```

Small tasks are less heroic.

Heroics are usually what happens after planning fails.

---

## Handling urgent requests

Sometimes user may want immediate feature.

If urgent, classify:

- safe prototype shortcut;
- risky production shortcut;
- docs/design only;
- blocked by foundation.

If shortcut accepted, document debt and cleanup task.

---

## Roadmap exceptions

Exceptions are allowed only if explicit.

Example:

```text
We will implement a temporary localStorage-only demo for appointments.
Limitations:
- not production
- no multi-user
- no backend validation
Cleanup:
- APT-BE migration task later
```

No silent exceptions.

---

## Decision checkpoint examples

Ask user before:

- choosing database;
- choosing auth strategy;
- choosing payment provider;
- changing billing policy;
- destructive migration;
- public release;
- real external sync;
- tenant suspension behavior;
- legal document signing.

Do not ask user before every tiny file change if task already authorizes it.

---

## Roadmap validation questions

Before starting new phase, ask:

```text
What is the objective?
What source docs apply?
What prerequisites exist?
What risks exist?
What can be split?
What is the smallest useful task?
What is not implemented?
How will it be checked?
```

This saves time, ironically by slowing down.

---

## Backlog review checklist

Backlog item should be rejected if:

- no clear goal;
- no source docs;
- no acceptance criteria;
- scope too large;
- forbidden files unclear;
- risk not stated;
- implementation jumps phase without reason;
- sensitive data impact ignored;
- storage impact ignored;
- tenant impact ignored;
- no checks.

---

## AI-generated roadmap changes

If AI proposes roadmap changes, user decides.

AI can suggest.

User owns product direction.

GitHub owns repository truth.

Reality owns consequences.

A tidy separation, for once.

---

## What to document in reports

For roadmap/backlog tasks, report:

- what roadmap sections added/changed;
- whether source docs changed;
- whether implementation changed;
- whether backlog items added;
- whether dependencies changed;
- risks;
- what not implemented.

This task is docs-only.

No implementation should be changed.

---

## What not to include in roadmap

Do not include:

- real secrets;
- real patient data;
- exact private pricing if not decided;
- legal claims not reviewed;
- medical claims not reviewed;
- production promises without foundation;
- unsupported deadlines as facts.

Roadmap can include target direction.

Not fantasy deadlines dressed as commitments.

---

## Timeline caution

This document does not define calendar dates.

Dates should be added only when realistic capacity is known.

A roadmap without dates is still useful.

A date invented to comfort someone is just a future apology.

---

## Capacity planning future

Future planning can estimate:

- task size;
- complexity;
- risk;
- dependency;
- available developer/AI capacity;
- review capacity;
- testing capacity.

AI can accelerate work.

It does not remove review.

---

## Release naming future

Possible release names:

```text
0.1 Prototype
0.2 Internal clinic MVP
0.3 Backend foundation
0.4 Clinical workflow beta
0.5 SaaS closed beta
1.0 Paid SaaS launch
```

Versioning policy can be defined later.

Do not call early prototype 1.0.

---

## Versioning caution

Version numbers should reflect maturity.

Bad:

```text
1.0 production
```

while using localStorage and no tenant auth.

Good:

```text
0.x prototype/internal beta
```

until production foundations exist.

---

## Roadmap acceptance

This document is correct if:

- phases are clear;
- dependencies are explicit;
- high-risk features are gated;
- source foundation next steps are clear;
- backlog categories exist;
- task sequencing supports SaaS goal;
- prototype vs production distinction is clear;
- safety boundaries are preserved.

---

## Что нельзя делать

Нельзя:

- начинать real amoCRM sync до backend/token/tenant foundation;
- начинать payment provider до billing/security foundation;
- начинать public booking до schedule backend and privacy rules;
- начинать AI diagnosis at all without strict future safety process;
- считать localStorage production storage;
- считать OAuth skeleton production integration;
- считать UI disabled button backend enforcement;
- считать patient payment SaaS subscription payment;
- считать appointment completed treatment completed;
- считать payment completed treatment completed;
- считать preview official document;
- делать multi-tenant claim without tenant isolation tests;
- делать one giant PR for entire SaaS;
- скрывать prototype limitations;
- использовать roadmap as excuse to implement everything now;
- переписывать roadmap inside unrelated task;
- создавать backlog без acceptance criteria;
- начинать high-risk task без source docs.

---

## Правила для ИИ-задач

Если задача касается roadmap, backlog, phase planning, milestone, implementation sequence or next-step planning, ИИ должен проверить:

- source docs status known;
- current phase identified;
- prerequisites listed;
- unsafe jumps flagged;
- task split small enough;
- tenant impact considered;
- storage impact considered;
- sensitive data impact considered;
- acceptance criteria defined;
- checks defined;
- report required;
- no implementation hidden inside docs/planning task.

---

## Acceptance для roadmap/backlog задач

Roadmap/backlog задача считается корректной, если:

- scope limited to planning/docs;
- no source code changed;
- no backend code changed;
- no package files changed;
- phases are clear;
- next tasks are actionable;
- high-risk dependencies are stated;
- prototype vs production distinction clear;
- report created;
- what was not implemented stated.

---

## Итог

Development roadmap нужен, чтобы DentalFlow развивался как SaaS CRM-платформа, а не как набор случайных экранов.

Главная дорожная цепочка:

```text
Sources
→ Audit
→ Stabilization
→ Backend
→ Tenant/Auth/Permissions
→ Storage/Database
→ Core clinic modules
→ Documents/Finance
→ Integrations
→ Billing/Access
→ Production hardening
→ AI assistance
```

Главная практическая мысль:

```text
сначала фундамент,
потом опасные и коммерческие функции
```

Главная safety-мысль:

```text
никакая поздняя функция не должна обходить tenant, storage, permissions and medical boundaries
```

Главная workflow-мысль:

```text
каждая задача маленькая, проверяемая, с отчётом and PR
```

DentalFlow можно построить.

Но не рывком “сделай всё”.

Его нужно строить слоями: источник правил, прототип, backend, данные, безопасность, клиническая логика, интеграции, billing and production.

Это скучнее, чем обещать SaaS за неделю.

Зато у продукта появляется шанс не превратиться в красивую панель управления хаосом.
