# 17_TASK_TEMPLATE_AND_PR_REVIEW_CHECKLIST.md

## Назначение документа

Этот документ описывает стандартный шаблон задач и чеклисты ревью Pull Request для DentalFlow CRM.

DentalFlow разрабатывается через связку:

```text
User
→ ChatGPT
→ Jules / Codex
→ GitHub PR
→ Review
→ Merge
→ Verification
```

Чтобы эта связка работала стабильно, каждая задача должна быть маленькой, точной, проверяемой и безопасной.

Главное правило:

**задача без scope, acceptance criteria, checks and report — это не задача, а просьба к ИИ угадать будущее.**

Второе главное правило:

**PR нельзя принимать только потому, что “build passed”.**

Build passed означает, что машина не подавилась кодом. Это не значит, что код соблюдает tenant isolation, не отправляет medical data в amoCRM, не путает platform billing with clinic finance и не сделал `localStorage.clear()` под видом миграции.

Машины терпеливы. Пользователи — нет. Данные — тем более.

---

## Когда использовать этот документ

Этот документ использовать при:

- создании задачи для Jules;
- создании задачи для Codex;
- ревью PR;
- проверке docs-only задач;
- проверке frontend задач;
- проверке backend/API задач;
- проверке storage/migration задач;
- проверке amoCRM задач;
- проверке billing/access задач;
- проверке security-sensitive задач;
- проверке test/QA задач;
- проверке final response агента;
- принятии решения о merge.

Документ не заменяет исходные source documents 00-16 and 18.

Он задаёт рабочий процесс и формат контроля.

---

## Базовый принцип задачи

Каждая задача должна отвечать на вопросы:

```text
Что делаем?
Зачем делаем?
Какие source docs применимы?
Какие файлы можно менять?
Какие файлы нельзя менять?
Что считается результатом?
Как проверить?
Какой report создать?
Что не должно быть реализовано?
Какие риски?
```

Если на эти вопросы нет ответа, задача не готова.

“Сделай нормально” — не задача.

Это эмоциональное состояние, к сожалению, распространённое в software development.

---

## Минимальный task template

Каждая задача должна иметь минимум:

```text
Task ID:
Title:
Phase:
Type:
Goal:
Context:
Relevant source documents:
Scope:
Allowed:
Forbidden:
Critical rules:
Tenant impact:
Storage impact:
Sensitive data impact:
Acceptance criteria:
Checks:
Report:
Branch:
PR title:
Final response must include:
```

Docs tasks with exact content must also include:

```text
SOURCE FILE CONTENT
[BEGIN_FILE_XX marker]
...
[END_FILE_XX marker]
```

---

## Полный task template

Использовать этот шаблон для большинства задач.

```text
Task ID:
<TASK-ID>

Title:
<short title>

Phase:
<project phase>

Type:
docs | frontend | backend | integration | billing | storage | migration | security | test | refactor | bugfix | chore

Goal:
<one clear goal>

Context:
<why this task exists and what happened before>

Relevant source documents:
- _ai_work/SOURCES/<doc>.md
- _ai_work/SOURCES/<doc>.md

Scope:

Allowed:
- <allowed action/file/domain>

Forbidden:
- <forbidden action/file/domain>

Critical rules:
- <must-follow rule>
- <stop condition>

Tenant impact:
none | future | yes
Explanation:
<tenant-related notes>

Storage impact:
none | future | yes
Explanation:
<storage-related notes>

Sensitive data impact:
none | future | yes
Explanation:
<sensitive-data notes>

Auth/permission impact:
none | future | yes
Explanation:
<auth/permission notes>

Acceptance criteria:
- <specific checkable result>
- <specific checkable result>

Checks:
- <command or manual verification>
- <command or manual verification>

Report:
Create:
_ai_work/REPORTS/<TASK-ID>_<description>_report.md

Report must include:
- Task ID
- Summary
- Added files
- Modified files
- Changed files
- Checks
- Safety notes
- What was not implemented
- Risks

Branch:
feature/<task-id-lowercase-description>

PR title:
<TASK-ID>: <title>

Final response must include:
- PR URL
- Branch
- Commit hash
- PR target
- Changed files summary
- Checks results
- Report path
```

---

## Task ID rules

Task ID должен быть уникальным.

Examples:

```text
DOCS-002-E-17
AUDIT-001
FE-014
BE-004
DB-001
AMO-PROD-005
BILL-007
QA-003
SEC-004
```

Нельзя переиспользовать один Task ID для другой задачи.

Если задача была отменена, новый вариант должен иметь новый ID or explicit suffix.

---

## Title rules

Title должен быть коротким и точным.

Хорошо:

```text
Add task template and PR review checklist source
Split PatientCardPage into domain tabs
Add safe amoCRM contact DTO mapper
Audit current localStorage data shape
```

Плохо:

```text
Improve project
Fix stuff
Make CRM better
Do next
```

Короткий title нужен не для красоты, а чтобы через месяц не смотреть на GitHub history как на криптограмму.

---

## Phase rules

Phase показывает место задачи в roadmap.

Examples:

```text
Phase 0 — Source foundation
Phase 1 — Prototype audit and stabilization
Phase 2 — Frontend domain cleanup
Phase 3 — Backend foundation
Phase 4 — Tenant, auth and permissions foundation
Phase 5 — Storage and database foundation
Phase 8 — amoCRM real integration
Phase 9 — Billing and SaaS access control
Phase 11 — Production hardening
```

Если задача прыгает в будущую фазу, нужно явно указать почему.

---

## Type rules

Task type должен соответствовать реальной работе.

Types:

```text
docs
frontend
backend
integration
billing
storage
migration
security
test
refactor
bugfix
chore
```

Docs task не должен менять source code.

Migration task не должен маскироваться как chore.

Security task не должен быть “small fix” без safety notes.

---

## Goal rules

Goal должен быть один.

Хорошо:

```text
Create 17_TASK_TEMPLATE_AND_PR_REVIEW_CHECKLIST.md from exact payload.
```

Плохо:

```text
Create doc 17, improve docs, fix frontend warnings, add tests and update roadmap.
```

Одна задача — один главный результат.

Если целей много, разделить.

---

## Context rules

Context должен объяснять:

- что уже сделано;
- что требуется сейчас;
- почему задача нужна;
- какие предыдущие PR/tasks важны;
- что не нужно делать.

Context не должен быть романом, но должен спасать агента от старого контекста.

---

## Relevant source documents

Implementation tasks must list relevant source docs.

Examples:

### amoCRM task

```text
- _ai_work/SOURCES/09_AMOCRM_INTEGRATION_RULES.md
- _ai_work/SOURCES/10_AMOCRM_TECHNICAL_ARCHITECTURE.md
- _ai_work/SOURCES/04_DATA_ISOLATION_AND_SECURITY.md
- _ai_work/SOURCES/11_BACKEND_AND_API_ARCHITECTURE.md
```

### UI task

```text
- _ai_work/SOURCES/14_UI_UX_RULES.md
- _ai_work/SOURCES/02_ROLES_AND_PERMISSIONS.md
- _ai_work/SOURCES/04_DATA_ISOLATION_AND_SECURITY.md
```

### billing task

```text
- _ai_work/SOURCES/12_BILLING_AND_ACCESS_CONTROL.md
- _ai_work/SOURCES/03_MULTI_TENANT_ARCHITECTURE_RULES.md
- _ai_work/SOURCES/11_BACKEND_AND_API_ARCHITECTURE.md
```

If relevant source docs are missing, stop and report.

---

## Scope rules

Scope must define boundaries.

Use:

```text
Allowed:
Forbidden:
```

Allowed says what can be changed.

Forbidden says what must not be touched.

If a file is not clearly allowed and change is not necessary, do not change it.

---

## Allowed section

Allowed examples:

```text
Allowed:
- create one source document
- update SOURCES_INDEX.md status for that document
- create task report
```

```text
Allowed:
- modify PatientCardPage component
- create PatientOverview component
- update related imports
- update tests if existing
```

```text
Allowed:
- add backend route skeleton
- add service skeleton
- add safe response tests
```

Allowed is permission, not invitation to improvise.

---

## Forbidden section

Forbidden examples:

```text
Forbidden:
- changing backend/src/
- changing package.json
- changing package-lock.json
- changing application logic
- adding dependencies
- changing OAuth code
```

```text
Forbidden:
- sending medical data to amoCRM
- storing tokens in frontend
- changing patient payment logic
- changing document snapshot logic
```

Forbidden list prevents “helpful” damage.

ИИ очень любит быть helpful. Репозиторий потом долго от этого лечится.

---

## Critical rules

Critical rules are stop-level constraints.

Examples:

```text
If exact content is missing, do not create the file.
Do not implement real sync in this task.
Do not change package files.
Do not run destructive migration.
Do not include real patient data.
Do not include secrets.
```

If critical rule cannot be satisfied, stop.

---

## Impact fields

Every task should state:

```text
Tenant impact
Storage impact
Sensitive data impact
```

For code tasks also consider:

```text
Auth impact
Permission impact
Billing impact
Integration impact
Migration impact
```

Do not leave impact implicit.

Hidden impact is where bugs rent apartments.

---

## Tenant impact

Tenant impact values:

```text
none
future
yes
```

### none

No tenant behavior affected.

Example:

```text
docs-only AI workflow document
```

### future

Defines future tenant rules but does not implement.

Example:

```text
multi-tenant architecture document
```

### yes

Changes tenant-related implementation.

Example:

```text
add tenant guard
add tenantId to database schema
change tenant route behavior
```

If `yes`, PR review must check tenant isolation.

---

## Storage impact

Storage impact values:

```text
none
future
yes
```

### none

No storage changes.

### future

Planning only.

### yes

Changes localStorage, database, files, migrations, snapshots or persistence.

If `yes`, PR review must check data preservation.

---

## Sensitive data impact

Sensitive data impact values:

```text
none
future
yes
```

Sensitive data includes:

- personal data;
- medical data;
- finance data;
- billing data;
- tokens;
- secrets;
- audit data;
- integration data.

If `yes`, review must be stricter.

---

## Acceptance criteria rules

Acceptance criteria must be checkable.

Good:

```text
- file X exists
- SOURCES_INDEX marks document 17 as Provided
- no src/ files changed
- npm run build passes
```

Bad:

```text
- project improved
- UI looks better
- integration ready
```

Acceptance criteria should not rely on vibes, несмотря на human tragic attachment to them.

---

## Checks rules

Checks should match task type.

Docs task checks:

```text
- changed files docs-only
- Markdown code fences closed
- source markers excluded
- no source code changed
- npm run lint
- npm run build
```

Frontend task checks:

```text
- npm run lint
- npm run build
- affected page opens
- empty/loading/error states reviewed
- no secrets displayed
```

Backend task checks:

```text
- backend syntax check
- backend tests if available
- route/service tests
- safe error checks
```

Storage/migration task checks:

```text
- migration dry-run if applicable
- no destructive data loss
- tenantId preserved
- backup/rollback noted
```

---

## Report rules

Every task creates a report under:

```text
_ai_work/REPORTS/
```

Report is required because chat history is not a reliable project memory.

Да, удивительно, что “мы это обсуждали где-то выше” не считается архитектурой.

---

## Standard report template

```text
# <TASK-ID> Report

## Task ID

<TASK-ID>

## Summary

<what was done>

## Added files

- <file>

## Modified files

- <file>

## Changed files

- <file>

## Checks

- <check>: passed/failed/not run

## Safety notes

- <docs-only/code impact>
- <secrets>
- <real patient data>
- <tenant>
- <storage>
- <sensitive data>

## What was not implemented

- <not implemented>

## Risks

- <risk>
```

For missing source content tasks, include:

```text
## Missing source files

- <file>
```

---

## Safety notes requirements

Safety notes must mention, when relevant:

- docs-only or code change;
- no application logic changed;
- no backend logic changed;
- no package files changed;
- no dependencies added;
- no real patient data added;
- no secrets added;
- no production `.env` added;
- no tokens exposed;
- no medical data sent to external system;
- no migration executed;
- no billing/payment provider implemented;
- no production readiness claimed.

Safety notes should be boring and factual.

Boring safety notes are good. Exciting safety notes usually mean someone has already started sweating.

---

## What was not implemented rules

This section must be honest.

Examples:

```text
No backend API was implemented.
No real amoCRM sync was implemented.
No production token storage was implemented.
No payment provider integration was implemented.
No database migration was implemented.
No UI changes were implemented.
```

This prevents skeletons from being mistaken for finished features.

---

## Risks section rules

Risks should list remaining risks, not invented drama.

Examples:

```text
- This is documentation only; rules still need implementation in future tasks.
- Future implementation must enforce backend-side permissions.
- Future storage work must avoid localStorage as production source of truth.
```

If no major risk, say:

```text
No immediate implementation risk because this was docs-only.
```

---

## Branch rules

Branch naming:

```text
feature/<task-id-lowercase>-<short-description>
```

Examples:

```text
feature/docs-002-e-17-add-task-template-pr-review-checklist
feature/audit-001-inventory-project-structure
feature/fe-014-remove-fake-actions
feature/be-004-add-json-response-utility
```

Do not reuse old branch.

Do not work from stale feature branch unless task explicitly says.

---

## Starting branch procedure

Preferred start:

```text
git fetch origin
git checkout main
g.i.t p.u.l.l origin main
git checkout -b feature/<task>
```

Goal:

```text
new branch from latest main
```

If repo uses different workflow, final state must still be clean and explainable.

---

## PR title rules

PR title:

```text
<TASK-ID>: <short title>
```

Examples:

```text
DOCS-002-E-17: add task template and PR review checklist source
FE-014: remove fake actions from treatment plan UI
BE-004: add shared JSON response utility
```

PR title must not reference old task.

---

## PR body rules

PR body should include:

```text
## Summary
## Changed files
## Safety notes
## Checks
## What was not implemented
## Risks
```

For small docs-only PRs, concise body is fine.

Do not include secrets.

Do not include real patient data.

Do not exaggerate completion.

---

## Final response rules

Agent final response must include:

```text
PR URL
Branch
Commit hash
PR target
Changed files summary
Checks results
Report path
```

Optional:

```text
Merge status
Known warnings
CI status
```

If checks were not run, say why.

If no CI configured, say:

```text
No GitHub CI checks are configured.
```

---

## Docs-only task template

Use this for source documents.

```text
Task ID:
DOCS-...

Title:
Add <document>.md

Phase:
Phase 0 — Source foundation

Type:
docs

Goal:
Create one source document from exact provided content.

Context:
Documents <previous> already added.
This task adds only <document>.

Relevant source documents:
- _ai_work/SOURCES/SOURCES_INDEX.md

Scope:

Allowed:
- create _ai_work/SOURCES/<document>.md
- update SOURCES_INDEX.md for this document
- create report

Forbidden:
- changing src/
- changing backend/src/
- changing package.json
- changing package-lock.json
- changing implementation logic
- creating other documents
- inventing missing content
- copying legacy docs

Critical rules:
- use only exact content between markers
- exclude markers
- if content missing, stop

Tenant impact:
none/future

Storage impact:
none/future

Sensitive data impact:
none/future/yes

Acceptance criteria:
- source file created
- index updated
- report created
- no code changed
- Markdown valid

Checks:
- changed files docs-only
- code fences closed
- no markers included
- npm run lint
- npm run build

Report:
_ai_work/REPORTS/<task>_report.md

Branch:
feature/<branch>

PR title:
<TASK-ID>: add <name> source
```

---

## Docs-only PR review checklist

For docs-only PR, check:

```text
Task ID correct
PR title correct
branch correct
target main
changed files expected
source document created
SOURCES_INDEX updated only for created doc
report created
no src/ changes
no backend/src/ changes
no package changes
no implementation changes
no unexpected docs rewritten
Markdown valid
code fences closed
payload markers not included
no secrets
no real patient data
no unsupported production claims
```

If any implementation file changed, request changes unless task allowed it.

---

## Source document review checklist

For source documents specifically:

```text
Title matches filename
Content matches provided payload
No placeholder text
No old legacy copy unless allowed
No missing sections from payload
No unclosed code block
No accidental BEGIN/END markers
SOURCES_INDEX status correct
Documents outside scope untouched
Report path correct
```

If exact content was required, do not accept a “reasonable summary”.

---

## Frontend task template

```text
Task ID:
FE-...

Title:
<frontend task>

Phase:
Phase 2 — Frontend domain cleanup

Type:
frontend

Goal:
<one UI goal>

Relevant source documents:
- _ai_work/SOURCES/14_UI_UX_RULES.md
- _ai_work/SOURCES/02_ROLES_AND_PERMISSIONS.md
- _ai_work/SOURCES/04_DATA_ISOLATION_AND_SECURITY.md

Scope:

Allowed:
- modify specific components
- add specific components
- update related imports
- add UI states

Forbidden:
- backend changes unless specified
- package changes unless specified
- direct external API calls
- changing storage model unless specified
- fake actions
- exposing secrets
- exposing unauthorized medical data

Critical rules:
- UI is not security boundary
- no fake buttons
- disabled states explain why
- no medical data to amoCRM

Tenant impact:
future/yes

Storage impact:
none/future/yes

Sensitive data impact:
future/yes

Acceptance criteria:
- UI behavior implemented
- empty/loading/error states handled
- role/permission impact noted
- no secrets shown
- build/lint pass

Checks:
- npm run lint
- npm run build
- manual UI checklist
```

---

## Frontend PR review checklist

Check:

```text
Changed components match scope
No unrelated UI rewrites
No backend changes unless allowed
No package changes unless allowed
No direct amoCRM/provider API calls
No tokens in frontend
No fake buttons
Disabled states explain why
Empty state present
Loading state present
Error state present
Dangerous actions confirmed
Role-aware visibility considered
Tenant context considered
No stale tenant data risk
No medical data shown to wrong role
No billing debt shown to ordinary staff
No medical data in amoCRM preview
PatientCard not turned into bigger God Component
Build/lint pass
Report created
```

---

## Backend task template

```text
Task ID:
BE-...

Title:
<backend task>

Phase:
Phase 3 — Backend foundation

Type:
backend

Goal:
<one backend goal>

Relevant source documents:
- _ai_work/SOURCES/11_BACKEND_AND_API_ARCHITECTURE.md
- _ai_work/SOURCES/04_DATA_ISOLATION_AND_SECURITY.md
- other relevant docs

Scope:

Allowed:
- modify specific backend files
- add specific route/service/utility
- add tests if available

Forbidden:
- frontend changes unless specified
- package changes unless specified
- secrets
- real external API calls unless specified
- changing unrelated backend modules

Critical rules:
- backend is security boundary
- safe errors
- no raw secrets
- no raw database object leakage
- report limitations honestly

Tenant impact:
future/yes

Storage impact:
none/future/yes

Sensitive data impact:
future/yes

Acceptance criteria:
- route/service/utility implemented
- validation considered
- errors safe
- checks pass
- report created
```

---

## Backend PR review checklist

Check:

```text
Routes match task
Service boundaries clear
No God server.js growth
No raw secrets
No stack trace to user
No raw external provider errors
No raw database object returned
Auth/tenant/permission impact stated
Validation backend-side
Safe DTO used or future-noted
Logs safe
No package changes unless justified
No frontend-only security assumption
Backend checks pass
Report created
```

---

## API route review checklist

For API route PRs:

```text
HTTP method appropriate
Route path consistent
Tenant context explicit or justified
Auth/permission guard present or future-noted
Input validation present
Entity ownership checked
Response shape consistent
Error shape consistent
No secrets in response
No sensitive data overexposed
Audit need considered
Tests/checks included
```

---

## Tenant/multi-tenant task template

```text
Task ID:
TENANT-...

Title:
<tenant task>

Type:
backend | storage | security

Relevant source documents:
- _ai_work/SOURCES/03_MULTI_TENANT_ARCHITECTURE_RULES.md
- _ai_work/SOURCES/04_DATA_ISOLATION_AND_SECURITY.md
- _ai_work/SOURCES/11_BACKEND_AND_API_ARCHITECTURE.md

Critical rules:
- tenant-owned data must be tenant-scoped
- user membership required
- no cross-tenant access
- backend validates tenantId
```

---

## Tenant PR review checklist

Check:

```text
tenantId included where needed
Tenant membership checked
Entity ownership checked
No global patient access for clinic roles
No cross-tenant references
No tenantId trusted only from frontend
No stale tenant frontend state risk if UI changed
Platform roles separated from clinic roles
Tests or future tests noted
Report mentions tenant impact
```

If task changes tenant data without tenant checks, request changes.

---

## Roles/permissions task checklist

Check:

```text
Permissions are tenant-scoped
Platform roles separated from clinic roles
Clinic roles not global
Doctor/receptionist/cashier boundaries respected
Sensitive medical permissions considered
Billing permissions separated
Integration permissions separated
Frontend visibility not used as only security
Backend enforcement present or clearly future-noted
Audit for role changes considered
```

---

## Storage task template

```text
Task ID:
DB-... | MIG-...

Title:
<storage/migration task>

Type:
storage | migration | backend

Relevant source documents:
- _ai_work/SOURCES/13_STORAGE_AND_MIGRATION_STRATEGY.md
- _ai_work/SOURCES/03_MULTI_TENANT_ARCHITECTURE_RULES.md
- _ai_work/SOURCES/11_BACKEND_AND_API_ARCHITECTURE.md

Critical rules:
- backend/database is production source of truth
- no localStorage.clear as migration
- preserve tenantId
- no destructive migration without approval
- snapshots immutable
- no secrets logged
```

---

## Storage PR review checklist

Check:

```text
Storage impact stated
Tenant impact stated
Sensitive data impact stated
Source of truth clear
tenantId strategy clear
No cross-tenant references
No localStorage.clear migration
No destructive migration hidden
No document snapshot mutation
No medical data guessed
Money fields preserve amount/currency
Secrets not stored in frontend/localStorage
Migration report exists if migration
Rollback/backup considered
No package changes unless justified
```

---

## Migration PR review checklist

Check:

```text
Old shape described
New shape described
Mapping described
Data preservation described
Dropped fields listed
Destructive changes explicitly approved
Dry-run available or reason not needed
Backup/rollback notes included
TenantId preserved
Unknown states not converted into false facts
Medical status not guessed
Payment status not guessed
Documents snapshots preserved
Tokens not logged/exposed
Validation after migration defined
Report created
```

If migration says “clear old data”, reject unless explicitly approved.

---

## localStorage PR review checklist

Check:

```text
localStorage not treated as production
storageVersion considered if shape changes
No localStorage.clear without explicit approval
No secrets in localStorage
No tokens in localStorage
No official documents only in browser
No medical source of truth production claim
Migration/fallback behavior clear
Prototype limitation stated
```

---

## Medical domain task template

```text
Task ID:
MED-...

Title:
<medical task>

Type:
frontend | backend | storage

Relevant source documents:
- _ai_work/SOURCES/05_MEDICAL_DOMAIN_MODEL.md
- _ai_work/SOURCES/06_PATIENT_CARD_AND_DENTAL_CHART_RULES.md
- _ai_work/SOURCES/04_DATA_ISOLATION_AND_SECURITY.md
- _ai_work/SOURCES/14_UI_UX_RULES.md

Critical rules:
- no automatic diagnosis
- finding is not diagnosis unless module exists
- appointment completed does not complete treatment
- payment does not complete treatment
- no medical data to amoCRM
- medical permissions considered
```

---

## Medical PR review checklist

Check:

```text
Medical data role-aware
No diagnosis invented
No AI/automation creates medical fact without doctor confirmation
toothNumber validation considered
Dental chart changes auditable or future-noted
Finding lifecycle clear
Treatment completion not triggered by payment
Treatment completion not triggered by appointment alone
No medical data sent to amoCRM
No medical documents sent externally
Sensitive data impact stated
```

---

## Treatment plan PR review checklist

Check:

```text
TreatmentPlan is proposal/intent, not completed service
Stages linked correctly
Finding links preserved
Plan status transitions controlled
Amount and currency explicit
Patient preview separated from internal notes
Preview not official document
Payment not auto-created
Medical data not sent to amoCRM
Commercial summary safe if created
```

---

## Document module PR review checklist

Check:

```text
Preview != generated document
Generated document is snapshot
Snapshot immutable
Template version stored
Old documents not silently updated
Cancellation/archive preserves history
Medical document not sent to amoCRM
Patient-facing text separated from internal notes
Permissions considered
Audit considered
Print/PDF based on snapshot
```

---

## Appointment/schedule PR review checklist

Check:

```text
Appointment tenant-scoped
Doctor/cabinet/time considered
Conflict validation backend-side or clearly future-noted
Appointment status lifecycle clear
Appointment completed does not create CompletedService automatically
Appointment completed does not complete treatment automatically
No medical details in compact schedule where not needed
No-show/reschedule/cancel history considered
Timezone considered
```

---

## Clinic finance PR review checklist

Check:

```text
Clinic finance separated from platform billing
Payment amount and currency explicit
Payment does not complete treatment
Payment does not close finding
Refund/debt behavior considered
Cashier permissions considered
Finance visibility role-aware
Audit considered
No patient payment activates SaaS subscription
```

---

## Platform billing/access task template

```text
Task ID:
BILL-...

Title:
<billing/access task>

Type:
billing | backend | frontend | storage

Relevant source documents:
- _ai_work/SOURCES/12_BILLING_AND_ACCESS_CONTROL.md
- _ai_work/SOURCES/03_MULTI_TENANT_ARCHITECTURE_RULES.md
- _ai_work/SOURCES/11_BACKEND_AND_API_ARCHITECTURE.md
- _ai_work/SOURCES/14_UI_UX_RULES.md

Critical rules:
- platform billing != clinic finance
- patient payment != SaaS subscription payment
- suspension does not delete tenant data
- feature gates backend-enforced
- billing visibility role-aware
```

---

## Billing/access PR review checklist

Check:

```text
Platform billing separated from clinic finance
Subscription status separated from access status
Feature entitlement backend-side
Limits backend-side if relevant
Tenant suspension does not delete data
Suspended tenant integrations paused or future-noted
Clinic owner visibility differs from ordinary staff
Billing debt not shown to all employees
Patient payment does not affect SaaS subscription
Platform invoice not mixed with patient invoice
Audit for access changes
No payment provider secrets
No provider integration without security task
```

---

## amoCRM task template

```text
Task ID:
AMO-...

Title:
<amoCRM task>

Type:
integration | backend | frontend | docs

Relevant source documents:
- _ai_work/SOURCES/09_AMOCRM_INTEGRATION_RULES.md
- _ai_work/SOURCES/10_AMOCRM_TECHNICAL_ARCHITECTURE.md
- _ai_work/SOURCES/04_DATA_ISOLATION_AND_SECURITY.md
- _ai_work/SOURCES/11_BACKEND_AND_API_ARCHITECTURE.md

Critical rules:
- amoCRM is sales/communication layer
- DentalFlow remains medical source of truth
- no direct frontend amoCRM API calls
- tokens server-side
- safe DTO allowlist
- no medical data to amoCRM
```

---

## amoCRM PR review checklist

Check:

```text
No direct frontend amoCRM API call
No tokens in frontend
No tokens in localStorage
No client_secret in frontend
No raw token response in UI/logs
Backend/proxy boundary respected
Tenant-scoped connection
Tenant-scoped token/mapping/logs
Feature entitlement considered
Suspended tenant behavior considered
Safe DTO allowlist used
No full Patient object sent
No full TreatmentPlan object sent
No toothNumber sent
No dentalChart sent
No DentalFinding sent
No diagnosis sent
No riskDescription sent
No MedicalDocument sent
No clinical notes sent
Sync logs safe
Errors safe
Skeleton vs production stated honestly
```

If PR sends medical fields to amoCRM, request changes.

---

## OAuth PR review checklist

Check:

```text
Authorization URL created server-side
state required
state expires
state one-time use
callback handled server-side
token exchange backend-side
client_secret backend-side
token response not returned to frontend
tokens not logged
memory token store marked dev-only if used
production limitations stated
safe errors
tenant context considered
```

---

## External integration PR review checklist

For any external provider:

```text
Backend/proxy boundary
Secrets server-side
No direct frontend provider API unless explicitly safe/public
Tenant-scoped config
Safe DTO
No sensitive data overexposed
Rate limit considered
Retry considered
Webhook validation considered
Logs safe
Errors safe
Feature entitlement considered
```

---

## Security task template

```text
Task ID:
SEC-...

Title:
<security task>

Type:
security

Relevant source documents:
- _ai_work/SOURCES/04_DATA_ISOLATION_AND_SECURITY.md
- _ai_work/SOURCES/11_BACKEND_AND_API_ARCHITECTURE.md
- other domain docs

Critical rules:
- no secrets in repo
- no real patient data
- tenant isolation preserved
- sensitive data protected
- report must be explicit
```

---

## Security PR review checklist

Check:

```text
No secrets committed
No real patient data committed
No tokens exposed
No .env with real values
No stack trace leakage
No raw provider errors
No cross-tenant data access
No frontend-only security
Permissions backend-enforced
Sensitive logs safe
Audit considered
Dangerous operations confirmed
Dependencies reviewed if added
```

Suggested grep:

```text
rg -n "access_token|refresh_token|client_secret|clientSecret|authorization_code|Bearer|github_pat|DATABASE_URL|PRIVATE_KEY" .
```

Docs may contain these terms as examples.

Real-looking values must stop the PR.

---

## Dependency/package PR review checklist

If package files changed:

```text
Package change allowed by task?
Dependency needed?
Alternative considered?
Frontend or backend impact?
Security risk?
License risk?
Bundle size impact?
Lockfile updated correctly?
No unrelated package churn?
Checks pass?
```

Docs-only tasks must not change package files.

If they do, request changes.

---

## Test/QA task template

```text
Task ID:
QA-...

Title:
<testing task>

Type:
test

Relevant source documents:
- _ai_work/SOURCES/18_TESTING_AND_QUALITY_ASSURANCE_STRATEGY.md
- relevant domain docs

Goal:
<one test/QA goal>

Scope:
Allowed:
- add/update specific tests
- add checklist/report

Forbidden:
- changing application behavior unless task says
- hiding failing tests
- weakening assertions without reason
```

---

## Test/QA PR review checklist

Check:

```text
Tests match risk
Tests fail for wrong behavior
No meaningless snapshot update
No skipped tests without reason
No weakened assertions
Tenant isolation tested where relevant
Permissions tested where relevant
Sensitive data tested where relevant
Build/lint pass
Report explains coverage and gaps
```

---

## Bugfix task template

```text
Task ID:
BUG-...

Title:
Fix <specific bug>

Type:
bugfix

Context:
<observed behavior, expected behavior, logs/screenshots if any>

Relevant source documents:
- <docs>

Scope:
Allowed:
- specific files/modules

Forbidden:
- unrelated refactor
- package changes unless needed
- broad redesign

Acceptance criteria:
- bug reproduced or explained
- fix implemented
- regression check added if practical
- build/lint pass
- report created
```

---

## Bugfix PR review checklist

Check:

```text
Bug clearly described
Root cause explained
Fix limited to bug
No unrelated rewrite
Regression risk considered
Tests/checks included
No new sensitive exposure
No new tenant/security issue
Report created
```

---

## Refactor task template

```text
Task ID:
REF-...

Title:
Refactor <specific module>

Type:
refactor

Goal:
Improve structure without behavior change.

Critical rules:
- behavior must remain same unless specified
- no feature additions
- no broad rewrites
- checks required
```

---

## Refactor PR review checklist

Check:

```text
Behavior unchanged
Scope limited
No hidden feature
No hidden bugfix unless stated
Tests/checks pass
Component/service boundaries improved
No security regression
No data model change unless allowed
Report states no behavior change
```

Refactor is not a polite word for “rewrite everything because vibes”.

---

## Audit task template

```text
Task ID:
AUDIT-...

Title:
Audit <area>

Type:
docs | audit

Goal:
Document current state and risks.

Allowed:
- inspect files
- create audit report
- optionally update index/report docs if specified

Forbidden:
- implementation changes
- fixes
- package changes
- rewriting source docs
```

---

## Audit PR review checklist

Check:

```text
Audit report created
No code changed unless allowed
Current state described
Risks listed
Gaps listed
Next tasks proposed
No invented implementation
No production claims
```

Audit finds work.

Audit does not secretly do the work.

---

## PR changed files checklist

Always inspect changed files.

Expected docs-only example:

```text
_ai_work/SOURCES/<doc>.md
_ai_work/SOURCES/SOURCES_INDEX.md
_ai_work/REPORTS/<report>.md
```

If unexpected files changed:

```text
src/
backend/src/
package.json
package-lock.json
.env
```

pause and investigate.

Changed files are where truth lives, annoyingly immune to confident summaries.

---

## PR metadata checklist

Check PR metadata:

```text
PR URL
PR number
title
branch
base branch
head commit
mergeable
state
draft
changed file count
```

Expected:

```text
base = main
state = open before merge
merged = false before merge
changed files match task
```

After merge:

```text
state = closed
merged = true
merged_at exists
merge_commit_sha exists
```

---

## PR content checklist

Check PR body:

```text
Summary exists
Changed files listed
Safety notes present
Checks listed
What was not implemented
Risks
No secrets
No real patient data
No false production claims
```

---

## PR diff checklist

For code PRs, inspect diff.

Check:

```text
No unrelated changes
No hidden deletion
No broad formatting churn
No package churn
No copied secrets
No debug dumps
No console spam unless dev-only and accepted
No hardcoded real values
No tenant bypass
No role bypass
No direct external API from frontend
```

---

## Merge readiness checklist

Before merge:

```text
PR matches task
Changed files expected
Checks pass or limitations accepted
No forbidden files changed
Report exists
No unresolved serious review comments
No merge conflicts
No secrets
No real patient data
No production false claims
User approved merge if needed
```

If not ready, do not merge.

A merge button is not a moral obligation.

---

## Post-merge verification checklist

After merge:

```text
PR state closed
merged true
merged_at exists
merge_commit_sha exists
main contains expected files
next task identified
```

For source docs:

```text
SOURCES_INDEX updated
document file exists in main
next document still missing if not created
```

---

## GitHub verification checklist

Use GitHub as source of truth for:

```text
PR status
merge status
branch/head commit
changed files
merge commit
comments/reviews
```

Agent final response is not enough.

Sometimes the agent says “merged” when PR is open.

Sometimes the human says “merged” and forgot to click.

Somehow society continues.

---

## Handling open PR after final response

If final response says task complete but PR is open:

```text
Task delivered, not integrated.
Need merge PR.
```

Do not proceed as if source is in main.

---

## Handling merged PR

If PR merged:

```text
Task integrated.
Proceed to next task.
```

Optionally record:

```text
head commit
merge commit
merged_at
```

---

## Handling wrong task PR

If PR title/branch/content references wrong task:

```text
Stop.
Do not merge.
Ask agent to correct or recreate from clean main.
```

Examples:

- current task 17, PR says 16;
- branch from old task;
- changed files for different document;
- report path wrong.

---

## Handling duplicate PR

If duplicate PR appears:

```text
Identify correct PR.
Do not merge duplicate.
Close duplicate if needed.
Start next task from clean main.
```

Check:

- branch names;
- changed files;
- merge conflicts;
- created time;
- base SHA;
- task ID;
- report path.

---

## Handling conflicts

If PR has conflicts:

```text
Do not force merge.
Fetch latest main.
Rebase or recreate branch if safe.
For docs-only tasks, fresh branch from main is often simpler.
```

Report conflict.

---

## Handling missing exact content

If source payload missing:

Agent must not create file.

Report:

```text
Missing source file:
- _ai_work/SOURCES/XX_NAME.md
```

Do not fill from memory.

Do not copy legacy docs.

Do not summarize chat.

---

## Handling damaged markers

If payload markers are broken:

```text
[BEGIN_FILE_XX marker]
...
missing end marker
```

Stop and report.

Do not guess where file ends.

Because guessing document boundaries is how one file становится three files and a headache.

---

## Handling accidental payload markers in file

If final file includes:

```text
[BEGIN_FILE_XX marker]
[END_FILE_XX marker]
```

request fix.

Markers are transport format, not document content.

---

## Handling unclosed code fence

If Markdown code block unclosed:

- fix before PR;
- or request changes.

Unclosed code fence can swallow entire document.

Markdown, apparently, also enjoys chaos.

---

## Handling changed package files

If package files changed unexpectedly:

- reject/request changes;
- ask why;
- require package impact explanation.

Docs-only PR with package changes is wrong.

---

## Handling secrets found

If secret found:

```text
Stop.
Do not merge.
Remove secret.
Rotate secret if real.
Check history.
Document incident.
```

Never respond with the secret.

Never paste secret into report.

---

## Handling real patient data found

If real patient data found:

```text
Stop.
Do not merge.
Remove data.
Assess exposure.
Use fake examples.
```

Do not include real data in docs/tests/examples.

---

## Handling medical data leakage

If PR sends medical data to amoCRM/external system:

```text
Request changes.
Block merge.
Reference documents 09 and 10.
```

Forbidden examples:

```text
toothNumber
dentalChart
DentalFinding
diagnosis
riskDescription
MedicalDocument
clinical notes
```

---

## Handling frontend-only security

If PR relies only on hidden/disabled UI for security:

```text
Request backend guard or mark as prototype with no production claim.
```

For production paths, frontend-only security is not acceptable.

---

## Handling fake actions

If UI has button that does only:

```text
console.log
alert("coming soon")
fake success
```

then either:

- disable with explanation;
- remove;
- or clearly mark prototype if task accepts.

Fake success is worse than no feature.

It trains users to distrust the system, which is rude but understandable.

---

## Handling skeleton vs production claims

If PR creates skeleton but says production complete:

Request wording fix.

Use:

```text
skeleton
dev-only
prototype
placeholder
not production-ready
```

Not:

```text
completed production integration
secure billing implemented
full backend ready
```

---

## Standard commands

Common checks:

```text
npm run lint
npm run build
```

Backend checks may include:

```text
npm run check
node --check <file>
```

Search checks may include:

```text
rg -n "access_token|refresh_token|client_secret|clientSecret|authorization_code|Bearer|github_pat|DATABASE_URL|PRIVATE_KEY" .
```

```text
rg -n "toothNumber|DentalFinding|dentalChart|riskDescription|diagnosis|MedicalDocument" backend/src src/integrations
```

```text
rg -n "localStorage.clear|sessionStorage.clear" src backend _ai_work
```

Docs may contain these strings as examples.

Implementation files need stricter review.

---

## Code review severity levels

Review findings can be classified:

```text
blocker
high
medium
low
nit
```

### blocker

Must fix before merge.

Examples:

- secret committed;
- real patient data;
- cross-tenant leak;
- forbidden files changed;
- medical data sent to amoCRM;
- destructive migration unapproved.

### high

Should fix before merge.

Examples:

- missing permission check;
- unsafe error output;
- wrong source of truth;
- no validation on sensitive route.

### medium

Fix soon or before production.

Examples:

- missing loading state;
- incomplete report;
- weak test coverage.

### low

Minor issue.

### nit

Style/wording.

Do not block important PR forever over nit unless nit hides real risk. Humans love bikeshedding; resist, heroically.

---

## Review decision options

Review result can be:

```text
Approve
Request changes
Comment only
Do not merge
Close/recreate PR
```

Approve only when acceptance criteria are met.

---

## When to request changes

Request changes if:

- forbidden files changed;
- exact content not preserved;
- code fence broken;
- secrets present;
- real patient data present;
- tests/checks fail without accepted reason;
- scope creep;
- unsafe integration behavior;
- tenant/security rule violated;
- report missing;
- PR targets wrong branch;
- old context task.

---

## When to approve

Approve when:

- scope matches task;
- changed files expected;
- checks pass or limitations accepted;
- report exists;
- safety notes adequate;
- no secrets;
- no real patient data;
- no major unresolved risks;
- user/product intent respected.

---

## When to close/recreate PR

Close/recreate when:

- branch based on old stale history;
- duplicate PR with conflicts;
- wrong task content;
- too many unrelated changes;
- impossible to review safely;
- agent polluted branch.

Fresh branch from main is often cheaper than heroic cleanup.

---

## Review comment template

Use direct review comments.

```text
Issue:
<what is wrong>

Why it matters:
<risk>

Required change:
<specific action>

Reference:
<source doc / rule>
```

Example:

```text
Issue:
This outgoing amoCRM payload includes toothNumber.

Why it matters:
toothNumber is medical context and must not be sent to amoCRM.

Required change:
Remove toothNumber from the DTO and keep only safe commercial fields.

Reference:
09_AMOCRM_INTEGRATION_RULES.md
```

---

## Request changes template

```text
Request changes.

Blockers:
- <blocker 1>
- <blocker 2>

Required fixes:
- <fix 1>
- <fix 2>

Do not expand scope.
After fixes, update the report and rerun checks.
```

---

## Approval template

```text
Approved.

Verified:
- scope matches task
- changed files expected
- checks passed
- report created
- no forbidden files changed
- safety notes adequate

Ready to merge.
```

---

## Comment-only template

```text
Comment only.

The PR appears aligned with the task, but note:
- <non-blocking risk>

No required changes from this comment.
```

---

## Final verification response template

After checking PR:

```text
Проверил.

PR #<number>:
- Status: open/merged
- Branch: <branch>
- Commit: <head sha>
- Merge commit: <sha if merged>
- Changed files: <count/list>
- Checks: <status>
- Conclusion: <ready/needs merge/merged/request changes>
```

This keeps user informed without theater.

---

## User handoff template

When giving user next action:

```text
Смержи PR #<number>.
После merge проверим статус и пойдём к следующей задаче: <next task>.
```

Or:

```text
PR уже merged.
Следующая задача: <task>.
```

---

## Jules confirmation response template

When Jules asks if assumptions are correct:

```text
Да, предположения верны. Приступай.

Critical:
- use branch <branch>
- start from latest main
- change only expected files
- do not touch forbidden files
- run checks
- create report
- final response must include PR URL, branch, commit hash, target, changed files, checks, report path
```

Keep it direct.

Do not add new unclear requirements during confirmation.

---

## Wrong context correction template

If Jules goes to wrong task:

```text
Остановись.

Ты ушёл в неправильный старый контекст.

Текущая задача:
<TASK-ID>: <title>

НЕ делай:
- <wrong file>
- <wrong branch>
- <wrong PR>

Работай только по последнему payload for <TASK-ID>.

Expected changed files only:
- <file 1>
- <file 2>
- <file 3>

Start from clean latest main.
```

---

## Old report correction template

If old final report pasted:

```text
Это старый отчёт по <old task>.

Текущая задача:
<current task>

Этот отчёт не закрывает текущую задачу.
Нужен новый PR with branch <branch> and files <files>.
```

---

## Missing payload response template

If user/Jules lacks exact content:

```text
Exact content is missing.

Do not create the source document.
Create/report missing file only if task asks.
Required content:
[BEGIN_FILE_XX marker]
...
[END_FILE_XX marker]
```

---

## No merge yet response template

If PR open:

```text
PR создан правильно, но ещё не merged.
Задача доставлена, но не интегрирована в main.
Нужно смержить PR #<number>.
```

---

## Merged response template

If PR merged:

```text
PR #<number> merged в main.
Документ/задача закрыта.
Следующий шаг: <next task>.
```

---

## Source foundation final check

After docs 00-18:

Check:

```text
All files 00-18 exist
SOURCES_INDEX all Provided
Reports exist for each task
No placeholder docs
No accidental markers
No obvious Markdown breakage
No source code modified in docs tasks
```

Then create:

```text
DOCS-003 — verify source foundation
DOCS-004 — source foundation summary
```

---

## Source foundation checklist

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

All must be Provided.

---

## Pre-implementation checklist

Before starting implementation after source foundation:

```text
Relevant source docs identified
Current code audited
Task small enough
Branch defined
Allowed/forbidden clear
Tenant impact stated
Storage impact stated
Sensitive data impact stated
Acceptance criteria clear
Checks defined
Report path defined
No missing decisions
```

If missing, create audit/planning task first.

---

## Implementation PR universal checklist

For any implementation PR:

```text
Scope matches task
No unrelated files changed
No package changes unless allowed
No secrets
No real patient data
Tenant impact reviewed
Storage impact reviewed
Sensitive data impact reviewed
Permissions considered
Validation considered
Errors safe
Logs safe
UI states handled if UI
Tests/checks run
Report created
What was not implemented stated
```

---

## High-risk PR checklist

High-risk if it touches:

- tenant isolation;
- auth;
- permissions;
- medical data;
- document snapshots;
- payments;
- billing/access;
- external integrations;
- tokens/secrets;
- migrations;
- public links;
- imports/exports;
- AI medical suggestions.

High-risk PR must have:

```text
small scope
source docs referenced
extra safety notes
manual review
strong checks
no broad refactor mixed in
```

---

## Do not mix checklist

Do not mix in one PR:

```text
frontend refactor + backend auth
docs update + package upgrade
amoCRM token storage + UI redesign
billing model + payment provider
migration + unrelated cleanup
PatientCard split + treatment plan logic change
```

Mixed PRs are hard to review and easy to regret.

---

## Common rejection reasons

Reject or request changes if:

```text
wrong task
wrong branch
wrong base
unexpected files
forbidden files changed
missing report
missing checks
scope creep
secrets
real patient data
unclosed Markdown fence
payload markers included
fake action
frontend-only security
medical data to amoCRM
billing/finance mixed
localStorage.clear migration
snapshot mutation
production claim for skeleton
```

A grim little list. Also known as “Tuesday in software”.

---

## Common acceptable limitations

Acceptable if clearly stated:

```text
prototype only
skeleton only
dev-only memory store
no real sync yet
no backend enforcement yet, if docs/UI placeholder task
no CI configured
manual QA only
future tenant enforcement noted
```

Limitations are acceptable.

Hidden limitations are not.

---

## Report credibility checklist

Report is credible if:

```text
matches changed files
does not overclaim
mentions checks honestly
mentions what was not implemented
mentions risks
matches PR content
does not hide forbidden changes
does not include secrets
```

Report is not credible if it says “no code changed” while `src/` changed.

Yes, check the files. Trust, but verify, because apparently civilization requires both.

---

## Checks credibility checklist

Checks credible if:

```text
commands named
result stated
warnings stated
failures stated
not run explained
CI absence stated
```

Not credible:

```text
All good.
Should work.
No issues.
```

That is not a check. That is a mood.

---

## Manual QA note

For UI/backend workflows, manual QA may be required.

Manual QA should state:

- what was tested;
- what was not tested;
- environment;
- limitations.

Example:

```text
Manual QA:
- Patient list renders
- Empty state visible
- Add patient form opens
Not tested:
- backend persistence, because task is frontend-only prototype
```

---

## Review against source docs

PR should be reviewed against relevant source docs.

Examples:

- amoCRM PR against docs 09 and 10;
- billing PR against doc 12;
- UI PR against doc 14;
- storage PR against doc 13;
- backend PR against doc 11;
- workflow PR against doc 15.

If PR contradicts source docs, request changes or create explicit source doc update task.

---

## Updating source docs after implementation

If implementation reveals source doc needs change:

- do not silently edit source doc in implementation PR unless task allows;
- create separate docs update task;
- explain reason;
- update report.

Source docs should not drift accidentally.

---

## Updating roadmap/backlog

Roadmap updates require:

- task ID;
- reason;
- changed sections;
- report;
- no implementation hidden.

Do not rewrite roadmap inside unrelated feature PR.

---

## Updating checklist document

This document can evolve.

Changes require:

- explicit docs task;
- reason;
- report;
- no source code changes unless separately scoped.

Checklist is process infrastructure.

Do not casually mutate process during firefighting.

---

## What cannot be delegated blindly

Do not blindly delegate to AI:

- production secrets;
- payment provider setup;
- legal retention policy;
- destructive migrations;
- real patient data handling;
- public posting;
- sending patient messages;
- tenant suspension policy;
- medical diagnosis logic.

AI can draft, analyze, implement under constraints.

User/product owner must decide high-impact business/legal/medical choices.

---

## Consent checkpoint checklist

Require explicit user confirmation before:

- payment;
- booking/reservation;
- posting publicly;
- sending messages/emails;
- changing account settings;
- merging if merge is user-controlled;
- deleting data;
- destructive migration;
- real external sync;
- production secret rotation;
- tenant suspension behavior;
- legal document signing flow.

Docs-only PR creation can proceed if task says.

---

## Stop conditions checklist

Stop if:

```text
exact content missing
required source doc missing
markers missing/damaged
secret found
real patient data found
forbidden file changed unexpectedly
destructive migration implied
external API call would be real but unauthorized
payment/provider action needed
task unclear
wrong old context detected
repo state unexpected
merge conflict unresolved
```

Stopping is not failure.

Continuing blindly is how failure gets a commit hash.

---

## Communication with user

When reporting to user:

- be direct;
- state PR status;
- state next action;
- avoid pretending;
- do not over-explain if simple;
- mention if PR open vs merged;
- mention if task delivered vs integrated.

User needs control, not fog machine.

---

## Communication with Jules/Codex

When instructing agents:

- use imperative;
- list exact files;
- list forbidden files;
- state branch;
- state checks;
- state final response format;
- include exact content if docs;
- state stop conditions.

Do not write vague emotional prompts.

AIs turn vague into confident nonsense with remarkable efficiency.

---

## Minimal confirmation to Jules

Use:

```text
Да, предположения верны. Приступай.
Expected changed files only:
...
Do not touch:
...
After completion provide:
...
```

No need to debate obvious Markdown rules for the tenth time unless something changed.

---

## Final answer checklist for ChatGPT

When ChatGPT responds to user with task payload:

```text
Task ID correct
Document number correct
Branch correct
Report path correct
Forbidden files correct
Markers correct
No unclosed outer code block
No accidental missing content
Next document not created
Tone direct
```

When ChatGPT verifies PR:

```text
Use GitHub if current repo state matters
Cite PR facts if available
Say open vs merged
Say next step
```

---

## Final source foundation flow

Remaining source docs after this document:

```text
18_TESTING_AND_QUALITY_ASSURANCE_STRATEGY.md
```

After 18:

```text
DOCS-003 — verify all source docs
DOCS-004 — source foundation summary report
AUDIT-001 — repository structure audit
```

No broad implementation before verification.

Yes, one more document before the shiny code cave. Civilization demands paperwork. Tragic, but occasionally useful.

---

## Что нельзя делать

Нельзя:

- давать Jules задачу без scope;
- давать Codex “fix everything”;
- принимать PR только потому, что build passed;
- merge PR with forbidden file changes;
- merge docs-only PR with code changes;
- merge PR with secrets;
- merge PR with real patient data;
- merge PR that sends medical data to amoCRM;
- merge migration without data preservation plan;
- merge billing PR that mixes platform billing and clinic finance;
- merge UI PR with fake success actions;
- trust frontend-only security;
- trust agent final response without checking GitHub when state matters;
- считать open PR завершённой задачей;
- считать skeleton production-ready;
- переписывать source docs without explicit task;
- использовать old branch for new task;
- игнорировать duplicate PR;
- скрывать limitations in report.

---

## Правила для ИИ-задач

Если задача создаётся или ревьюится через AI workflow, агент должен проверить:

- Task ID correct;
- source docs relevant;
- scope limited;
- allowed/forbidden clear;
- branch from latest main;
- expected changed files known;
- impact fields stated;
- acceptance criteria checkable;
- checks defined;
- report path defined;
- final response format defined;
- no secrets;
- no real patient data;
- no source-of-truth confusion;
- no production claim without foundation.

---

## Acceptance для task template/checklist задач

Task template/checklist задача считается корректной, если:

- document created from exact payload;
- SOURCES_INDEX updated;
- report created;
- no source code changed;
- no backend code changed;
- no package files changed;
- template covers major task types;
- PR review checklists cover high-risk domains;
- stop conditions included;
- merge verification included;
- safety rules included.

---

## Итог

Task template and PR review checklist — это защитный слой разработки DentalFlow.

Главная task-цепочка:

```text
Clear task
→ limited scope
→ source docs
→ branch
→ implementation/docs
→ checks
→ report
→ PR
→ review
→ merge
→ verification
```

Главная review-мысль:

```text
changed files and source docs matter more than уверенный final response
```

Главная safety-мысль:

```text
high-risk domains need stricter review, not more optimism
```

Главная workflow-мысль:

```text
small scoped PRs with reports beat giant magical changes
```

DentalFlow можно развивать быстро с AI agents.

Но скорость без checklist превращается в красивую катастрофу: PR есть, scope исчез, source docs забыты, build прошёл, а medical data уже пошли в amoCRM с бантиком.

Этот документ нужен, чтобы такого не было.

Не потому что процесс важнее продукта.

А потому что без процесса продукт начинает вести себя как толпа людей в тёмной комнате с отвёртками.
