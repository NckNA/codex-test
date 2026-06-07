# 18_TESTING_AND_QUALITY_ASSURANCE_STRATEGY.md

## Назначение документа

Этот документ описывает стратегию тестирования и контроля качества DentalFlow CRM.

DentalFlow создаётся как SaaS CRM-платформа для стоматологических клиник, поэтому качество нельзя проверять только фразой:

```text
npm run build прошёл
```

Build — это не гарантия качества. Build означает, что проект смог собраться. Это уже приятно, но недостаточно.

Проект может прекрасно собраться и при этом показать пациенту чужую карту, отправить медицинские данные в amoCRM, перепутать оплату лечения с оплатой подписки, стереть localStorage как “миграцию” и бодро написать “success”.

Главное правило:

**качество DentalFlow — это не только отсутствие ошибок сборки, но и соблюдение tenant isolation, medical safety, data safety, security boundaries, role permissions, storage rules and product logic.**

Второе главное правило:

**каждая задача должна иметь проверки, соответствующие её риску.**

Третье главное правило:

**если проверка не выполнялась, нельзя писать, что она прошла.**

Да, это приходится документировать. Потому что человечество уже изобрело “проверил мысленно”, “должно работать”, “наверное норм” и другие способы сделать будущую боль максимально неожиданной.

---

## Главная цель QA strategy

Testing and QA strategy должна обеспечить:

- стабильность проекта;
- защиту medical data;
- защиту tenant isolation;
- защиту secrets and tokens;
- корректность ролей;
- корректность storage/migration;
- безопасность документов;
- безопасность amoCRM integration;
- разделение platform billing and clinic finance;
- надёжность backend/API;
- предсказуемый frontend UX;
- проверяемость PR;
- честные отчёты;
- release readiness.

QA — это не финальная полировка.
QA — это система раннего обнаружения глупостей до того, как они станут релизом.

---

## Quality definition

Для DentalFlow качество означает:

```text
система работает
система не теряет данные
система не показывает чужие данные
система не отправляет sensitive data наружу
система соблюдает роли и права
система честно показывает ограничения
система не притворяется production-ready, если это prototype
система проходит проверки
система имеет отчёт по задаче
```

Качество — это не только “кнопка нажимается”.
Кнопка может нажиматься прямо в пропасть. UI, конечно, будет отзывчивый. Толку мало.

---

## Основные уровни проверки

QA DentalFlow делится на уровни:

```text
Documentation validation
Static checks
Build checks
Frontend checks
Backend checks
API checks
Storage/migration checks
Tenant isolation checks
Permission checks
Security checks
Medical safety checks
Integration checks
Billing/access checks
Manual QA
Regression checks
Release checks
```

Не каждая задача требует всех уровней.
Но каждая задача должна иметь свой набор проверок.

---

## Проверки по типу задачи

### Docs task

Проверять:
- Markdown valid;
- code fences closed;
- source markers excluded;
- correct file created;
- SOURCES_INDEX updated;
- no code changes;
- no package changes;
- report created.

### Frontend task

Проверять:
- lint;
- build;
- page/component renders;
- empty/loading/error states;
- role visibility;
- tenant context;
- no secrets in UI;
- no fake actions;
- no medical leakage.

### Backend task

Проверять:
- syntax;
- route behavior;
- validation;
- safe errors;
- safe logs;
- auth/tenant/permission impact;
- no raw secrets;
- no raw database object leakage.

### Storage/migration task

Проверять:
- data preservation;
- tenantId;
- no cross-tenant references;
- no destructive migration;
- backup/rollback;
- snapshots;
- amount/currency;
- unknown states.

### Integration task

Проверять:
- backend/proxy boundary;
- no frontend tokens;
- safe DTO;
- tenant-scoped mapping;
- sync logs safe;
- no medical data to provider.

### Billing task

Проверять:
- platform billing separated from clinic finance;
- feature entitlement backend-side;
- suspension does not delete data;
- billing visibility role-aware;
- audit.

---

## Minimum checks for every PR

Every PR should have at least:

```text
changed files reviewed
scope matches task
no forbidden files changed
no secrets added
no real patient data added
report created
checks reported honestly
```

For this project, даже docs-only PR должен проходить sanity check.
Потому что “это же просто документация” — именно так случайно переписывают RISKS.md, SOURCE_INDEX and half of project memory. Бумага терпит, Git тоже, но проект потом плачет.

---

## Standard command checks

Common frontend checks:

```text
npm run lint
npm run build
```

Backend checks may include:

```text
npm run check
node --check <file>
```

If command is unavailable:
```text
not run — command not configured
```

If command fails:
```text
failed — include error summary
```

Do not write “passed” if it failed.
This is not a philosophy question. This is literally what words mean.

---

## Current known standard checks

At source foundation stage, standard checks are:

```text
npm run lint
npm run build
```

Backend check may exist depending on backend package/scripts.
If backend check is available and task touches backend, run it.
If task is docs-only and backend files are untouched, backend check is optional unless task requires it.

---

## No fake checks rule

Forbidden report wording:

```text
checks passed
```
if checks were not run.

Better:

```text
npm run lint was not run because task was documentation-only and user did not request command execution.
```

or:

```text
No GitHub CI checks are configured.
```

or:

```text
Manual Markdown validation performed.
```

Honest limitations are acceptable. Fake checks are not.

---

## Documentation validation

For docs PRs, check:
- file exists;
- title matches filename;
- Markdown headings valid;
- code fences closed;
- no unclosed code block;
- no payload markers included;
- no placeholder text;
- no accidental legacy copy;
- SOURCES_INDEX status correct;
- report exists;
- no source code changes.

Suggested manual checklist:

```text
Document title correct
Expected file path correct
SOURCES_INDEX updated only for this document
Report path correct
No src/ changes
No backend/src/ changes
No package changes
Markdown code fences balanced
```

---

## Code fence validation

Markdown code fences must be balanced.

Bad:

```text
```text
some content
```

missing closing fence can swallow rest of document.
A broken fence makes the document unreadable and sometimes turns half the file into accidental code block soup. Markdown is simple, humans still find a way.

---

## Payload marker validation

Source payload markers:

```text
<<<BEGIN_FILE_XX>>
<<<END_FILE_XX>>
```

must not be included in final file.
They are transport markers.
If markers appear in source document, request fix.

---

## SOURCES_INDEX validation

For source foundation:
- document created → SOURCES_INDEX status Provided;
- document missing → status Missing / Not Provided;
- no status lies;
- no placeholder counted as Provided.

After document 18:
```text
00–18 should be Provided
```

This must be verified in DOCS-003.

---

## Report validation

Every report should match task.
Check:
- Task ID correct;
- Summary accurate;
- Added/modified files accurate;
- Checks accurate;
- Safety notes present;
- What was not implemented honest;
- Risks reasonable;
- no secrets;
- no real patient data;
- no false production claims.

If report says “no code changed” but `src/` changed, report is wrong.
Diff wins.

---

## Static checks

Static checks include:
- lint;
- TypeScript/JS validation if configured;
- syntax checks;
- import checks;
- unused variable warnings;
- formatting if configured.

Static checks catch basic mistakes.
They do not prove business correctness.
A program can be beautifully linted and still leak tenant data. Very tidy disaster.

---

## Build checks

Build checks ensure app compiles.

For frontend:

```text
npm run build
```

Build failure blocks merge unless task is explicitly experimental and user accepts.
Build warning should be reported.
Known existing warnings should be identified as existing, not hidden.

---

## Lint checks

Lint checks detect code quality issues.

For frontend:

```text
npm run lint
```

If lint has existing known warning:
- mention warning;
- do not claim zero warnings;
- do not fix unrelated warning unless task allows.

Existing warning should eventually become backlog item.

---

## Backend syntax checks

Backend JS files can be checked with:

```text
node --check <file>
```

or project script:

```text
npm run check
```

If backend changes, syntax check should run.
If backend route/service changed, route/service behavior should be manually or automatically tested.

---

## Secret scans

Secret scan is important for tasks touching:
- OAuth;
- amoCRM;
- payment provider;
- backend config;
- environment files;
- CI;
- deployment;
- storage.

Suggested search:

```text
rg -n "access_token|refresh_token|client_secret|clientSecret|authorization_code|Bearer|github_pat|DATABASE_URL|PRIVATE_KEY|JWT_SECRET|WEBHOOK_SECRET|PAYMENT_SECRET" .
```

Docs may contain these words as examples.
Implementation files must be reviewed carefully.

---

## Secret scan review rule

If search finds a real-looking secret:

```text
stop
do not merge
remove secret
rotate if real
check history
document incident
```

Do not paste secret into chat or report.
Do not say “probably test secret” and move on.
That is how “test” becomes “production outage with paperwork”.

---

## Real patient data scan

Repo must not contain real patient data.
Check examples:
- real full names;
- real phone numbers;
- real medical notes;
- real documents;
- real scans/images;
- real payment records;
- real identification numbers.

Docs/tests should use fake data.

If real patient data appears:

```text
stop
remove data
assess exposure
replace with fake example
```

---

## Medical leakage checks

For integration PRs, especially amoCRM, search implementation files for medical fields:

```text
rg -n "toothNumber|DentalFinding|dentalChart|riskDescription|diagnosis|MedicalDocument|ClinicalNote|allergies|contraindications" backend/src src
```

Finding these terms in docs is fine.
Finding them in outgoing integration mapper/client is a blocker unless explicitly safe and not sent externally.

---

## Direct frontend integration checks

Frontend must not call amoCRM API directly.

Search:

```text
rg -n "amocrm|amoCRM|amo.crm|oauth2|access_token|refresh_token" src
```

Allowed:
- labels;
- safe UI status;
- placeholders;
- backend route references.

Forbidden:
- direct provider API call;
- frontend token exchange;
- frontend token storage;
- client_secret in frontend.

---

## localStorage destructive checks

For storage tasks:

```text
rg -n "localStorage.clear|sessionStorage.clear" src backend _ai_work
```

If found in implementation:
- review carefully;
- reject if used as migration;
- require explicit user-approved destructive behavior.

`localStorage.clear()` is not migration. It is data arson with a JavaScript API.

---

## Tenant isolation checks

Tenant isolation is critical.
Every tenant-owned read/write must be scoped.

Test idea:

```text
User A belongs to Tenant A
Patient P belongs to Tenant B

User A requests Patient P → denied or not found
```

Tenant isolation tests should eventually cover:
- patients;
- appointments;
- dental chart;
- findings;
- treatment plans;
- documents;
- payments;
- files;
- integrations;
- sync logs;
- billing;
- reports.

No SaaS without tenant isolation tests.

---

## Tenant isolation PR checklist

For relevant PRs, check:
- tenantId present;
- tenant membership checked;
- entity ownership checked;
- no global clinic data access;
- no tenantId trusted only from frontend;
- repository queries include tenant scope;
- frontend clears tenant-specific state on tenant switch;
- reports are tenant-scoped.

If tenant isolation is missing in production path, block merge.

---

## Permission checks

Permissions must be checked backend-side for production.

Test examples:

```text
receptionist cannot edit dental chart
cashier cannot edit clinical findings
doctor cannot configure platform billing
sales manager cannot view clinical notes
clinic owner can manage clinic users
platform admin cannot silently access medical data without support policy
```

Frontend visibility is not enough.

---

## Role-aware UI checks

Frontend PRs must consider:
- doctor view;
- receptionist view;
- cashier view;
- clinic owner view;
- sales manager view;
- platform admin view.

If roles are not implemented yet, task/report should say:

```text
role-aware behavior is placeholder/future
```

Do not pretend UI hiding is security.

---

## Medical safety checks

Medical safety checks prevent wrong domain behavior.

Check:
- no automatic diagnosis;
- finding is not diagnosis unless diagnosis module exists;
- appointment completion does not complete treatment;
- payment does not complete treatment;
- treatment plan approval does not create completed service;
- patient preview is not official document;
- generated document is snapshot;
- old document snapshot not mutated;
- AI suggestions not saved as medical fact without doctor confirmation.

Medical data is not decoration for sales workflows.

---

## Dental chart checks

For dental chart tasks:
- tooth numbers valid;
- selected tooth clear;
- visual state not color-only;
- active findings visible;
- completed/planned statuses separate;
- no accidental status change on click;
- medical permissions considered;
- audit considered.

Dental chart bugs can create clinical confusion.
This is slightly worse than a button being ugly. Difficult concept, but true.

---

## Finding lifecycle checks

Finding lifecycle should be controlled.
Check statuses like:

```text
active
planned
in_treatment
completed
monitoring
declined
cancelled
```

Do not allow arbitrary status jump without rule if production.
Do not close finding automatically from payment.
Do not close finding automatically from appointment.

---

## Treatment plan checks

Treatment plan QA should verify:
- plan has patient;
- stages belong to plan;
- linked findings belong to same patient/tenant;
- total amount and currency explicit;
- patient-facing text separated from internal note;
- preview not official document;
- plan status transition controlled;
- payment does not complete plan;
- plan does not send medical details to amoCRM.

---

## Document snapshot checks

Document QA must verify:
- generated document is snapshot;
- template version stored;
- patient/clinic/doctor snapshot stored if needed;
- old document not silently updated;
- cancel/archive preserves history;
- preview differs from generated document;
- print/PDF uses snapshot;
- permission checks exist;
- audit exists or future-noted.

Snapshot mutation is a serious bug.
A legal/medical document should not behave like a live React component having an identity crisis.

---

## Appointment checks

Appointment QA should verify:
- appointment belongs to tenant;
- appointment belongs to patient in same tenant;
- doctor/cabinet conflict considered;
- status lifecycle clear;
- timezone handled;
- cancellation/no-show/reschedule tracked;
- appointment completion does not complete treatment;
- appointment completion does not create payment;
- compact schedule does not leak medical details.

---

## Clinic finance checks

Clinic finance QA should verify:
- amount and currency explicit;
- payment belongs to tenant and patient;
- refunds/debts clear;
- cashier permissions;
- finance visibility role-aware;
- payment does not complete treatment;
- patient payment does not activate SaaS subscription;
- audit event created or future-noted.

---

## Platform billing checks

Platform billing QA should verify:
- platform billing separated from clinic finance;
- subscription status separated from access status;
- feature entitlement checked backend-side;
- limits enforced backend-side if implemented;
- tenant suspension does not delete data;
- ordinary staff do not see subscription debt;
- clinic owner can see billing info if allowed;
- platform admin actions audited;
- patient payment does not affect tenant subscription.

---

## Feature entitlement checks

Feature entitlement checks:

```text
tenant without amocrm_integration → connect/sync denied
tenant with feature but user without permission → denied
tenant with feature and permission → allowed if connection valid
```

Frontend disabled state is not enough.

---

## Suspended tenant checks

Suspended tenant QA should verify:
- write operations denied or limited according to policy;
- integrations paused;
- public booking disabled if implemented;
- data not deleted;
- owner billing path available if allowed;
- ordinary users get safe message;
- audit event exists.

Do not confuse “blocked access” with “deleted data”.

---

## Integration QA

External integrations must be tested with fakes/mocks where possible.

General integration checks:
- backend/proxy boundary;
- secrets server-side;
- safe DTO;
- tenant-scoped connection;
- safe errors;
- safe logs;
- retry/rate-limit behavior;
- webhook validation;
- idempotency;
- feature entitlement;
- suspended tenant behavior.

No real patient data in test provider accounts.

---

## amoCRM QA

amoCRM-specific checks:
- OAuth starts backend-side;
- state exists;
- callback handled backend-side;
- tokens not returned to frontend;
- tokens not logged;
- memory token store marked dev-only if used;
- connection tenant-scoped;
- mapper uses allowlist;
- sync preview safe;
- no medical fields in outgoing DTO;
- sync logs safe;
- reconnect flow safe;
- no direct frontend amoCRM API calls.

---

## amoCRM forbidden payload check

Outgoing amoCRM payload must not include:

```text
toothNumber
dentalChart
DentalFinding
finding.description
finding.riskDescription
diagnosis
ClinicalNote
MedicalDocument
allergies
contraindications
completedService notes
raw treatment plan medical details
```

Allowed safe commercial summary can include:

```text
patient name
phone
source
lead status
commercial status
planned amount
currency
next appointment date
```

---

## OAuth QA

OAuth QA checks:
- `client_secret` never in frontend;
- authorization URL generated server-side;
- state unpredictable;
- state expires;
- state one-time use;
- code exchange server-side;
- token response never returned to UI;
- errors safe;
- no raw provider error with secrets;
- disconnect removes/invalidates connection safely.

---

## Webhook QA

Webhook checks:
- provider authenticity validated;
- tenant resolved safely;
- event idempotency;
- payload shape validated;
- no trust in external payload;
- no medical data created from webhook;
- invalid webhook rejected;
- safe sync log created;
- no raw secrets logged.

Webhooks are not friendly messages from the universe.
They are untrusted external input wearing a JSON costume.

---

## Backend API QA

Backend API checks:
- auth required where needed;
- tenant guard;
- permission guard;
- feature guard if relevant;
- validation;
- entity ownership;
- safe DTO;
- safe errors;
- no raw database object;
- no stack trace;
- no secrets;
- audit where important;
- tests or manual verification.

---

## API response consistency checks

Check API response shape.

Preferred success:
```text
{
  "ok": true,
  "data": {}
}
```

Preferred error:
```text
{
  "ok": false,
  "code": "ERROR_CODE",
  "message": "Safe message."
}
```

Avoid random response formats across modules.
Consistency is cheap when done early and expensive when invented by archaeology.

---

## Error QA

Error handling checks:
- validation errors clear;
- permission errors safe;
- tenant errors do not reveal other tenant data;
- provider errors sanitized;
- no stack trace in user response;
- no tokens;
- no raw SQL/database detail;
- retry guidance if useful.

---

## Logging QA

Logs should include safe metadata.
Allowed:

```text
requestId
tenantId
userId
route
operation
status
safe error code
duration
```

Forbidden:

```text
passwords
tokens
client_secret
refresh_token
medical documents
full clinical notes
raw provider payload with secrets
payment secrets
```

Logs are not a secret landfill.

---

## Audit QA

Audit checks:
- important action creates audit event;
- tenantId included if tenant-related;
- actor included;
- action stable;
- entityType/entityId included if relevant;
- metadata safe;
- no secrets;
- no full medical payload unless explicitly protected and required.

Important audited actions include:
- user role changes;
- patient changes;
- dental chart changes;
- treatment plan changes;
- document generation/cancel;
- payment recorded;
- integration connected/disconnected;
- tenant suspended/reactivated;
- billing changes.

---

## Storage QA

Storage QA checks:
- tenantId on tenant-owned entities;
- foreign keys where needed;
- no cross-tenant references;
- indexes considered;
- unique constraints tenant-scoped;
- timestamps;
- soft delete/archive;
- no hard delete without approval;
- snapshots immutable;
- amount/currency explicit;
- secrets protected.

---

## Migration QA

Migration QA checks:
- old shape described;
- new shape described;
- mapping defined;
- dry-run if important;
- backup/rollback notes;
- tenantId preserved;
- no medical facts invented;
- unknown stays unknown;
- payment status not guessed;
- document snapshots preserved;
- tokens not logged;
- validation after migration.

Migration success is not “script ran”.
Migration success is “data survived correctly”. Subtle difference, yet somehow not obvious to enough people.

---

## Import QA

Import QA checks:
- tenant scope;
- file validation;
- preview/dry-run;
- mapping;
- duplicate detection;
- validation errors;
- report;
- rollback strategy if possible;
- no cross-tenant import;
- no real patient data in tests unless authorized and protected.

No “upload and pray”. Prayer is not an import strategy.

---

## Export QA

Export QA checks:
- permission;
- tenant scope;
- sensitive fields;
- file security;
- expiration;
- audit;
- download tracking if needed;
- no cross-tenant export;
- role-aware export content.

Export of patient data is high-risk.

---

## File upload QA

File upload checks:
- type allowlist;
- size limit;
- tenantId metadata;
- patient/document link;
- permission check;
- storage key not exposed unsafely;
- upload progress/error;
- no public access by default;
- audit if important.

---

## Frontend QA

Frontend QA checks:
- page renders;
- main user task clear;
- empty state;
- loading state;
- error state;
- save state;
- disabled state with explanation;
- destructive action confirmation;
- no fake success;
- no secrets in UI;
- role-aware visibility;
- tenant context clear;
- mobile/tablet if relevant;
- accessibility basics.

---

## UI smoke test

Basic UI smoke test:

```text
open app
navigate to dashboard/patients
open patient list
open patient card
open dental chart tab
open treatment plan tab
open appointments page
open settings/integrations placeholder
run build/lint
```

Adjust based on current app.
Smoke test should verify app is not obviously broken.
It does not replace deep QA.

---

## Patient flow smoke test

Core patient flow:

```text
create/open patient
verify overview
verify phone/source/status visible
open dental chart
select tooth
view/add finding if implemented
open treatment plan
create/view plan if implemented
view patient preview if implemented
open documents tab
open finance tab if allowed
```

For prototype tasks, mark what is not implemented.

---

## Appointment flow smoke test

Appointment flow:

```text
open schedule
choose date
create appointment
select patient
select doctor/time
save
verify appointment appears
edit appointment
cancel/reschedule if implemented
verify status
```

Check that appointment does not complete treatment automatically.

---

## Treatment plan flow smoke test

Treatment plan flow:

```text
open patient
open findings
create or select finding
open treatment plans
create plan
add stage
link finding if implemented
set amount/currency
preview patient-facing plan
save
verify status
```

Check that preview is not official document.

---

## Document flow smoke test

Document flow:

```text
open treatment plan
open document action
view preview
generate document if implemented
verify generated status
verify snapshot metadata
print/export if implemented
cancel/archive if implemented
```

If document module is placeholder, button should be disabled with explanation.

---

## Finance flow smoke test

Finance flow:

```text
open patient finance tab
add payment if implemented
verify amount/currency
verify payment history
verify balance/debt
verify treatment status unchanged
```

Payment must not complete medical treatment.

---

## amoCRM flow smoke test

For safe amoCRM skeleton:

```text
open integrations page
view amoCRM status
connect action disabled or backend-driven
OAuth connect if skeleton implemented
callback safe
status safe
disconnect safe
no tokens in UI
no medical data in preview
```

For real sync, add:

```text
sync preview
manual sync
sync log
needs reconnect feature
disabled suspended tenant
blocked
```

---

## Billing flow smoke test

Billing/access flow:

```text
platform admin sees tenants
tenant has subscription status
clinic owner sees billing status
ordinary staff does not see billing debt
feature unavailable shows safe message
suspended tenant access limited
data not deleted
```

Do not mix patient payment with SaaS subscription.

---

## Accessibility checks

Basic accessibility checks:
- controls have labels;
- focus visible;
- modal focus managed;
- color not only signal;
- contrast reasonable;
- error messages linked/visible;
- keyboard navigation for core actions where practical;
- buttons have clear text;
- icon-only actions have labels/tooltips.

Accessibility is not “extra”. It is the difference between software and a locked glass box.

---

## Responsive checks

Responsive checks depend on screen.
Desktop first:
- patient card;
- dental chart;
- schedule;
- reports.

Tablet:
- dental chart usable;
- side panels usable;
- touch targets.

Mobile:
- patient search;
- patient summary;
- quick call;
- appointment view.

Do not promise full mobile dental chart editing until designed.

---

## Performance checks

Performance basics:
- no giant payloads;
- no loading all patients with all dental charts;
- lazy load heavy tabs;
- pagination for long lists;
- avoid repeated unnecessary fetches;
- avoid infinite rendering loops;
- no huge console logs.

For production, add monitoring and performance tests later.

---

## Regression checks

Regression checks ensure old flows still work.
For every PR, consider:

```text
What could this break?
Which flow should be retested?
Is there a previous bug this could reintroduce?
```

Regression tests should be added for serious bugs when practical.
Bug fixed without regression check is an invitation for the bug to return wearing a fake moustache.

---

## Automated tests strategy

Future automated tests should include:
- unit tests;
- component tests;
- service tests;
- API route tests;
- integration tests with mocks;
- migration tests;
- tenant isolation tests;
- permission tests;
- security scans;
- smoke tests.

Do not try to write all tests at once.
Start with high-risk areas.

---

## Unit tests

Unit tests are good for:
- mappers;
- validators;
- permission helpers;
- status transition helpers;
- money calculations;
- date/time helpers;
- safe DTO builders;
- migration mapping functions.

Example:

```text
input Patient with dentalChart and findings → buildAmoCrmContactDto
output does not include medical fields
```

---

## Component tests

Component tests are useful for:
- empty states;
- loading states;
- error states;
- permission-based rendering;
- disabled states;
- form validation;
- dangerous action confirmation.

Example:

```text
user without integrations.configure → amoCRM connect button disabled with explanation
```

---

## Backend service tests

Backend service tests should cover:
- validation;
- tenant checks;
- permission checks;
- status transitions;
- safe DTO;
- audit events;
- error normalization.

Use fake repositories/clients where practical.

---

## API tests

API tests should cover:
- auth required;
- tenant membership;
- permission denied;
- validation errors;
- success response shape;
- safe error shape;
- no secrets in response;
- no cross-tenant data.

API tests are key for SaaS. Frontend tests cannot prove backend security.

---

## Integration tests with mocks

External provider tests should use mocks/fakes.

For amoCRM:
- fake token exchange;
- fake refresh;
- fake contact create;
- fake deal update;
- fake webhook payload.

Do not hit real amoCRM in normal CI unless explicitly configured and safe.
Never use real patient data.

---

## Migration tests

Migration tests should verify:
- old data converts;
- new data validates;
- tenantId preserved;
- statuses mapped;
- unknown handled safely;
- amount/currency preserved;
- document snapshots preserved;
- tokens not logged;
- no data silently dropped.

---

## Tenant isolation tests

Tenant isolation tests are non-negotiable for SaaS.

Examples:

```text
Tenant A user cannot read Tenant B patient
Tenant A user cannot update Tenant B appointment
Tenant A report excludes Tenant B data
Tenant A sync logs exclude Tenant B logs
Tenant A document file inaccessible to Tenant B user
```

These tests should become a core safety gate before paid SaaS.

---

## Permission tests

Permission tests:

```text
receptionist can create appointment
receptionist cannot edit dental chart
doctor can edit findings
cashier can record payment
cashier cannot edit treatment plan medical details
clinic_owner can invite users
sales_manager cannot view clinical notes
platform_admin cannot access medical details without policy
```

Permissions must be tenant-scoped.

---

## Security tests

Security tests should cover:
- no secrets in repo;
- no tokens in frontend;
- no direct provider calls;
- safe errors;
- tenant isolation;
- role enforcement;
- file access control;
- public link expiration;
- webhook validation;
- rate limiting where relevant.

Security testing should start before production, not after first incident. A radical idea, yes.

---

## Snapshot tests caution

Snapshot tests can be useful for UI structure.
But do not blindly update snapshots.

Bad:

```text
snapshot changed
update snapshot
done
```

Good:

```text
review why snapshot changed
confirm expected behavior
update if correct
```

Snapshot tests are not magic. They are just photos of previous assumptions.

---

## Manual QA strategy

Manual QA remains important.
Manual QA should be structured:
- define scenario;
- define role;
- define tenant;
- define expected result;
- record pass/fail;
- note limitations.

Manual QA should not be:

```text
clicked around, looks okay
```

That is not QA. That is wandering.

---

## Manual QA report format

Use:

```text
Manual QA:
- Environment:
- Role:
- Tenant:
- Scenario:
- Steps:
- Expected:
- Actual:
- Result:
- Notes:
```

For PR reports, concise version is acceptable.

---

## Smoke test checklist

Basic smoke checklist:

```text
app loads
main navigation works
patients page opens
patient card opens
dental chart tab opens
appointments page opens
treatment plan tab opens
documents placeholder/flow works
finance placeholder/flow works
settings/integrations page opens
no console-breaking runtime error
build/lint pass
```

Adjust based on current modules.

---

## Release checklist

Before release, check:

```text
all planned PRs merged
main builds
lint passes
backend checks pass
smoke test pass
known critical bugs resolved
no secrets
no real patient data in repo
tenant isolation risk reviewed
medical leakage risk reviewed
billing/access risk reviewed
migration risk reviewed
backup/rollback considered
release notes prepared
limitations documented
```

Release checklist becomes stricter as project moves from prototype to paid SaaS.

---

## Prototype release checklist

For prototype/internal demo:
- build passes;
- core screens open;
- limitations visible;
- no real secrets;
- no real patient data in repo;
- fake actions disabled or labelled;
- localStorage limitations stated;
- no production claims.

Prototype can be incomplete. It should not be deceptive.

---

## Internal clinic release checklist

For controlled internal clinic use:
- backup/export plan exists;
- no known data loss bug;
- patient flows tested;
- appointment flows tested;
- document limitations clear;
- finance limitations clear;
- permissions reviewed;
- real patient data handling approved internally;
- support process known.

Internal does not mean careless.

---

## Closed beta SaaS checklist

For closed beta SaaS:
- real auth;
- tenant isolation;
- tenant isolation tests;
- backend/database source of truth;
- backups;
- role permissions;
- audit;
- support process;
- billing/manual access controls;
- known limitations documented;
- incident response draft.

---

## Paid SaaS checklist

For paid SaaS:
- production deployment stable;
- monitoring;
- backup/restore tested;
- security review;
- tenant isolation tests passing;
- billing/access control stable;
- support access audited;
- secrets managed;
- legal/business terms reviewed outside code;
- release rollback plan;
- user onboarding/support docs.

Taking money means the product is no longer a hobby with a login screen.

---

## CI strategy

Future CI should include:

```text
lint
build
backend checks
unit tests
API tests
tenant isolation tests
permission tests
secret scan
forbidden frontend provider call scan
medical leakage scan
migration tests where relevant
```

CI should fail on critical safety violations.
CI should not be a decorative green badge.

---

## GitHub Actions future

Possible CI workflow:

```text
on pull_request:
  npm ci
  npm run lint
  npm run build
  backend checks
  tests
  secret scan
  safety greps
```

Do not add CI in this docs task.
CI implementation is separate future task.

---

## Safety grep CI future

Possible grep checks:

```text
rg -n "access_token|refresh_token|client_secret|clientSecret|authorization_code|Bearer|github_pat|DATABASE_URL|PRIVATE_KEY" .
```

```text
rg -n "localStorage.clear|sessionStorage.clear" src backend
```

```text
rg -n "toothNumber|DentalFinding|dentalChart|riskDescription|diagnosis|MedicalDocument" backend/src src/integrations
```

Need allowlist exceptions for docs/tests.
Automated grep is useful, but human review still required.

---

## Quality gates by risk

Low-risk docs task:
- docs-only changed files;
- Markdown valid;
- report.

Medium-risk frontend task:
- lint/build;
- UI states;
- no secrets;
- role/tenant impact.

High-risk backend/storage/security task:
- tests/checks;
- tenant/permission review;
- security scan;
- report;
- smaller PR.

Critical migration/payment/integration task:
- explicit approval;
- tests;
- dry-run where possible;
- backup/rollback;
- security review;
- manual QA;
- no broad refactor.

---

## Blocker examples

Block merge if:
- secret committed;
- real patient data committed;
- medical data sent to amoCRM;
- frontend stores tokens;
- direct frontend amoCRM API call;
- tenant data read without tenant check;
- destructive migration unapproved;
- document snapshot mutated silently;
- billing and clinic finance mixed;
- patient payment activates SaaS subscription;
- package files changed in docs-only task;
- tests/checks fail without accepted reason.

Blockers are not suggestions. They are the smoke alarm.
Do not remove battery because it is loud.

---

## High severity examples

High severity:
- missing backend validation for sensitive route;
- permission check missing;
- unsafe raw provider error;
- no audit for critical action;
- no tenant impact stated in tenant-sensitive PR;
- UI exposes billing debt to ordinary staff;
- fake success action in important flow;
- no rollback for risky migration.

Should fix before merge unless explicitly accepted as prototype and not production path.

---

## Medium severity examples

Medium severity:
- missing empty state;
- weak error wording;
- missing loading state;
- report incomplete;
- known warning not documented;
- no manual QA note;
- component too large but still controlled.

Can merge if tracked, depending on task.

---

## Low severity examples

Low severity:
- minor wording;
- small layout inconsistency;
- non-critical helper text;
- naming improvement;
- small report typo.

Do not block critical progress forever over low severity.
Bikesheds are comfortable because they are small. Products are not built inside them.

---

## Regression risk notes

Every PR report should mention risk if relevant.

Examples:

```text
Low risk: docs-only.
Medium risk: component split may affect PatientCard tabs.
High risk: changes appointment status lifecycle.
Critical risk: changes tenant guard behavior.
```

Risk level helps decide QA depth.

---

## Test data rules

Use fake data.

Allowed fake examples:

```text
Иван Иванов
+7 700 000 00 00
Demo Clinic
250000 KZT
```

Forbidden:
- real patient names;
- real phone numbers;
- real scans;
- real clinical notes;
- real payment details.

Fake data should not accidentally match real sensitive data.

---

## Demo data QA

Demo data should be clearly marked.

Check:
- tenantType demo;
- fake patient names;
- fake phone numbers;
- no real medical info;
- resettable;
- not mixed with production.

---

## Staging QA

Staging should use:
- fake or anonymized data;
- separate secrets;
- separate provider credentials;
- separate database;
- production-like configuration.

Do not connect staging casually to production patient data.

---

## Production QA caution

Production testing should be limited and controlled.

Do not:
- create fake patients in real clinic without marking;
- send test messages to real patients;
- run migration without backup;
- test payment provider with real charges accidentally;
- test amoCRM sync with real medical payload.

Production is where mistakes get witnesses.

---

## Backup before risky QA

Before risky migration/release:
- backup database;
- backup files if needed;
- verify backup exists;
- define rollback.

Do not discover backup strategy after migration fails.
That is called archaeology, not operations.

---

## Rollback QA

Release plan should include rollback notes:
- how to revert code;
- how to handle database migration;
- how to pause integrations;
- how to disable feature flag;
- how to restore access;
- how to communicate limitations.

Rollback may not always be simple.
If not simple, report it.

---

## Feature flags

Future feature flags can help QA.
Use for:
- amoCRM real sync;
- billing enforcement;
- public booking;
- new document engine;
- AI suggestions;
- imports/exports.

Feature flag must be backend-enforced for security-sensitive features.
Frontend-only feature flag is not protection.

---

## Observability QA

Production should monitor:
- errors;
- slow requests;
- sync failures;
- token refresh failures;
- webhook rejections;
- billing access changes;
- tenant suspension;
- migration failures;
- job failures.

Monitoring must not leak sensitive data.

---

## Error tracking QA

If external error tracking used:
- scrub secrets;
- scrub tokens;
- scrub medical payload;
- scrub documents;
- scrub payment secrets;
- include requestId;
- include safe error code.

External monitoring should not become another unsafe database.

---

## Performance QA future

Performance tests can include:
- patient list with many records;
- appointment calendar with many appointments;
- report generation;
- document generation;
- import dry-run;
- sync log list;
- audit log list.

Use realistic fake data.

---

## Load testing caution

Load testing production requires care.
Do not accidentally spam:
- real amoCRM;
- SMS/WhatsApp provider;
- payment provider;
- real clinic users.

Use mocks or staging.

---

## Data integrity QA

Data integrity checks:
- patient belongs to tenant;
- appointment patient same tenant;
- finding patient same tenant;
- plan/finding same patient;
- document/plan same tenant;
- payment/patient same tenant;
- integration mapping tenant-scoped;
- invoice/subscription tenant-scoped.

Data integrity is invisible until broken.
Then it becomes very visible.

---

## Status transition QA

Test status transitions:

### Appointment

```text
scheduled → confirmed
confirmed → arrived
arrived → in_progress
in_progress → completed
scheduled → cancelled
scheduled → no_show
```

### Treatment plan

```text
draft → proposed
proposed → approved
approved → in_progress
in_progress → completed
proposed → declined
```

### Document

```text
draft → generated
generated → printed
generated → signed
generated → cancelled
```

Invalid transitions should be rejected or handled explicitly.

---

## Money QA

Money checks:
- amount numeric;
- currency present;
- no floating precision issue if possible;
- totals correct;
- refunds do not double count;
- clinic finance separate from platform billing;
- invoice snapshot preserved.

Never assume all money is KZT unless model says so.

---

## Timezone QA

Timezone checks:
- tenant timezone exists;
- appointment displayed in tenant timezone;
- reports date range uses tenant timezone;
- UTC storage where appropriate;
- no raw ISO string shown to normal users;
- daylight/time edge cases considered later.

Schedule without timezone QA becomes calendar roulette.

---

## Public link QA

For future public links:
- token scoped;
- expiration;
- tenant status checked;
- feature checked;
- no full data exposure;
- rate limited;
- revocation possible;
- audit if sensitive.

Public link bugs are public. The clue is in the name.

---

## Notification QA

For reminders/messages:
- recipient correct;
- content previewed;
- no sensitive medical details unless appropriate and approved;
- channel correct;
- permission checked;
- opt-out/consent future considered;
- send logged;
- failure handled.

Do not send medical details to WhatsApp by accident.

---

## AI feature QA

Future AI features require strict checks:
- AI output marked as suggestion;
- doctor/user confirmation required;
- no automatic diagnosis;
- no automatic medical facts;
- no hidden save;
- no unauthorized data exposure;
- audit/logging;
- prompt/data safety;
- no sending sensitive data to unsafe external model/provider without policy.

AI can assist. AI should not become an invisible dentist with a keyboard.

---

## QA for AI-generated code

AI-generated code must be reviewed like any other code.
Extra checks:
- no invented business rules;
- no hidden scope creep;
- no broad rewrite;
- no fake tests;
- no security bypass;
- no hallucinated file paths;
- no old context;
- no production claims for skeleton.

AI speed does not reduce review responsibility.
It increases the amount of code that can go wrong quickly. Charming.

---

## PR report QA

Report must not overclaim.

Bad:

```text
Implemented production-ready amoCRM integration.
```

when only OAuth skeleton exists.

Good:

```text
Added OAuth skeleton. Real sync, production token storage, webhooks and retries are not implemented.
```

QA includes reviewing language.
Words create false confidence. False confidence creates incidents.

---

## QA documentation

QA artifacts may include:
- PR report;
- manual QA notes;
- test plan;
- release checklist;
- bug report;
- migration report;
- incident report;
- source foundation verification report.

QA documentation is part of project memory.

---

## Bug report template

Use:

```text
Bug ID:
Title:
Environment:
Role:
Tenant:
Steps to reproduce:
Expected result:
Actual result:
Screenshots/logs:
Severity:
Suspected area:
Regression:
Notes:
```

A bug report saying “doesn’t work” is a cry, not a report.
Understandable, but still not enough.

---

## Incident report template

For security/data incidents:

```text
Incident ID:
Detected at:
Detected by:
Affected area:
Affected tenants:
Sensitive data involved:
What happened:
Immediate action:
Containment:
Fix:
Secret rotation needed:
User notification needed:
Follow-up tasks:
Prevention:
```

Do not hide incidents in chat.

---

## Migration QA report template

```text
Migration ID:
Old shape:
New shape:
Records affected:
Tenant impact:
Sensitive data impact:
Dry-run result:
Backup status:
Fields preserved:
Fields dropped:
Unknown values:
Errors:
Rollback notes:
Result:
```

---

## Release QA report template

```text
Release:
Environment:
Commit/PRs:
Checks:
Smoke tests:
Known issues:
Risks:
Rollback:
Approval:
```

---

## Source foundation QA

After 00-18 complete, create a verification task.
DOCS-003 should verify:
- all files 00-18 exist;
- SOURCES_INDEX all Provided;
- reports exist;
- no accidental markers;
- Markdown readable;
- no obvious broken code fences;
- no docs-only source task changed code;
- final source foundation summary possible.

This document is the last source doc, but source foundation still needs verification.
Because “last file added” is not the same as “foundation verified”. Again with the words meaning things.

---

## Post-source foundation QA tasks

Recommended after document 18:

```text
DOCS-003 — verify source foundation completeness
DOCS-004 — create source foundation summary report
AUDIT-001 — inventory current repository structure
AUDIT-002 — audit current routes/pages/components
AUDIT-003 — audit current localStorage shape
AUDIT-004 — audit backend skeleton
QA-001 — create smoke test checklist for current prototype
```

Do not jump straight to production features.

---

## Current project QA caution

Known current caution areas:
- current frontend may be prototype/localStorage-based;
- backend may be skeleton;
- amoCRM may have OAuth skeleton only;
- CI may not be configured;
- role/tenant enforcement may not exist yet;
- docs source foundation is still being completed;
- production readiness should not be claimed.

This is fine if honest.
It is dangerous if hidden.

---

## Definition of checked

A task is checked when:
- expected files reviewed;
- forbidden files absent;
- required commands run or not-run explained;
- report reviewed;
- impact fields considered;
- risks considered;
- PR status known.

Not checked:

```text
agent said it was fine
```

That is faith.
Faith has uses. PR review is not one of them.

---

## Definition of passed

A check passed when command/manual check produced expected result.
Examples:

```text
npm run build passed
Markdown fences balanced
No src/ files changed
No secrets found
```

Do not say “passed” if result unknown.

---

## Definition of failed

A check failed when:
- command exits with error;
- required file missing;
- forbidden file changed;
- code fence broken;
- secret found;
- real patient data found;
- acceptance criteria unmet.

Failed check must be reported.
Do not bury failures under “minor issue”.

---

## Definition of blocked

QA blocks merge when:
- blocker found;
- required check failed;
- exact content missing;
- secret present;
- real patient data present;
- tenant isolation risk unaddressed;
- destructive migration unapproved;
- external sync unsafe;
- report missing for required task.

Blocked is not drama. Blocked is a safety function.

---

## Quality ownership

Quality is shared.
User owns product decisions.
ChatGPT helps define tasks and review.
Jules/Codex executes under constraints.
GitHub records truth.
QA strategy defines checks.

Nobody gets to say:

```text
not my problem
```

in a project handling medical, financial and tenant data.
A tragic inconvenience for everyone involved.

---

## What reviewers must remember

Reviewers must check:
- intent;
- scope;
- diff;
- data boundaries;
- security;
- tests/checks;
- report honesty;
- merge status.

Do not review only the final summary.
Final summaries are where optimism goes to wear a suit.

---

## What agents must remember

Agents must:
- follow task scope;
- stop on missing content;
- not invent rules;
- not change forbidden files;
- run checks;
- report honestly;
- keep secrets out;
- keep real patient data out;
- respect source docs.

Agents do not get bonus points for surprise improvements.

---

## What users must remember

Users should:
- provide exact payload;
- merge only after review;
- verify merged status;
- avoid giving ten parallel risky tasks;
- keep source docs as project memory;
- ask for audit before implementation when unsure.

Yes, humans also have a checklist. Deeply unfair, but necessary.

---

## QA risk areas

Major QA risk areas:
- source docs inconsistent;
- localStorage data loss;
- missing tenant isolation;
- wrong role visibility;
- medical data leakage;
- unsafe amoCRM sync;
- token exposure;
- platform billing mixed with clinic finance;
- document snapshot mutation;
- payment/treatment confusion;
- fake UI actions;
- untested migration;
- no rollback;
- no release checklist.

These risk areas should be revisited often.

---

## QA backlog

Initial QA backlog:

```text
QA-001 — create current prototype smoke test checklist
QA-002 — create docs validation script or manual checklist
QA-003 — add PR report validation checklist
QA-004 — add frontend manual QA checklist
QA-005 — add backend API test plan
QA-006 — add tenant isolation test plan
QA-007 — add permission test plan
QA-008 — add storage/migration test plan
QA-009 — add amoCRM safety test plan
QA-010 — add billing/access test plan
QA-011 — add release checklist
QA-012 — add CI plan
```

Do not implement these in this docs task.

---

## QA automation backlog

Future automation:

```text
QA-AUTO-001 — script to verify source docs 00-18 exist
QA-AUTO-002 — script to check Markdown code fences
QA-AUTO-003 — script to check no payload markers in source docs
QA-AUTO-004 — CI lint/build
QA-AUTO-005 — secret scan CI
QA-AUTO-006 — forbidden frontend provider call scan
QA-AUTO-007 — medical leakage scan
QA-AUTO-008 — tenant isolation test suite
QA-AUTO-009 — permission test suite
QA-AUTO-010 — migration test suite
```

Automation should be introduced gradually.
A bad automated check is just a fast false sense of security.

---

## Release gates by milestone

### M0 Source foundation

Gate:

```text
docs 00-18 exist
SOURCES_INDEX all Provided
docs validation pass
summary report created
```

### M1 Prototype stabilized

Gate:

```text
build/lint pass
smoke test pass
known limitations documented
fake actions removed or labelled
```

### M3 Tenant/auth foundation

Gate:

```text
tenant model exists
permissions model exists
tenant isolation tests started
no frontend-only security claim
```

### M7 amoCRM beta

Gate:

```text
safe DTO
no medical fields
token storage server-side
sync logs
feature guard
manual sync tested
```

### M10 Paid SaaS

Gate:

```text
security review
backup/restore
tenant isolation tests
monitoring
billing/access control
incident response
release checklist
```

---

## QA and roadmap relationship

Roadmap defines what to build.
QA defines how to know it is safe enough.

A roadmap without QA is a list of wishes.
QA without roadmap is a list of tests for an unknown animal.

DentalFlow needs both, because apparently software does not become good just because everyone feels busy.

---

## QA and source documents

Source docs are testing references.

Examples:
- test amoCRM against docs 09 and 10;
- test backend against doc 11;
- test billing against doc 12;
- test storage against doc 13;
- test UI against doc 14;
- test workflow against docs 15 and 17.

If implementation contradicts source docs, either fix implementation or update source docs through explicit task.

---

## QA and acceptance criteria

Acceptance criteria are not decoration.
Before merge, check each acceptance item.
If an item cannot be checked, report why.
If acceptance criteria are vague, task was not ready.

---

## QA and “not implemented”

QA should confirm not implemented items are truly not implemented.

Example:
Docs-only task says:
```text
No source code changed.
```
Check diff.

Integration skeleton says:
```text
No real sync implemented.
```
Check that no sync endpoint sends real data.

This prevents accidental hidden scope.

---

## QA and production claims

Any production-ready claim must be challenged.
Ask:

```text
Is backend/database source of truth?
Is auth implemented?
Is tenant isolation tested?
Are permissions enforced backend-side?
Are backups defined?
Are secrets protected?
Are logs safe?
Are high-risk flows tested?
```

If no, do not call it production-ready.
Use:

```text
prototype
skeleton
dev-only
beta
not production-ready
```

Words matter. Annoying, but they do.

---

## QA and user trust

DentalFlow will handle sensitive clinic workflows.
Trust depends on:
- not losing data;
- not leaking data;
- not lying about status;
- not hiding failures;
- not making unsafe automation;
- not pretending incomplete features are ready.

QA protects user trust.
User trust is slow to build and impressively quick to evaporate.

---

## What cannot be tested only by build

Build does not test:
- tenant isolation;
- permissions;
- medical safety;
- billing separation;
- document immutability;
- token leakage;
- real user workflow;
- migration data preservation;
- external integration safety;
- role-aware UI;
- support access.

Build is necessary. Build is not enough.

---

## What cannot be tested only manually

Manual QA is not enough for:
- tenant isolation regression;
- permission regression;
- migration mapping;
- safe DTO filtering;
- secret leakage scans;
- status transition logic;
- money calculations;
- idempotency.

Automate critical repeatable checks.
Manual QA catches experience and workflow issues.
Both are needed. Yes, software is demanding. No one asked it to be easy.

---

## What cannot be delegated only to AI

AI can help write tests and review diffs.
AI should not be sole authority for:
- medical safety;
- legal document behavior;
- payment provider behavior;
- production deployment readiness;
- destructive migration approval;
- security incident response;
- real patient data handling.

AI assists. Humans decide. Then everyone checks.

---

## QA reporting language

Use precise language:

```text
passed
failed
not run
not applicable
blocked
manual check passed
future-noted
```

Avoid:

```text
looks good
should be fine
probably ok
done-ish
```

The software industry already has enough poetry.

---

## Task report checklist

Every task report should include:
- Task ID;
- Summary;
- Changed files;
- Checks;
- Safety notes;
- What was not implemented;
- Risks.

For high-risk tasks also include:
- tenant impact;
- storage impact;
- sensitive data impact;
- auth/permission impact;
- migration impact;
- rollback/backup notes;
- manual QA.

---

## Pull request QA checklist

Before merge:

```text
Task ID matches PR
branch matches PR
target main
Changed files expected
No forbidden files
Report exists
Checks pass or failures accepted
No secrets
No real patient data
No medical leakage
No tenant/security blocker
No fake production claim
Acceptance criteria satisfied
```

After merge:

```text
merged true
merge commit exists
main updated
next task identified
```

---

## Source foundation final QA checklist

After this document is merged:

```text
00 exists
01 exists
02 exists
03 exists
04 exists
05 exists
06 exists
07 exists
08 exists
09 exists
10 exists
11 exists
12 exists
13 exists
14 exists
15 exists
16 exists
17 exists
18 exists
SOURCES_INDEX all Provided
Reports exist
No source doc markers included
No obvious broken Markdown
No docs-only PR modified source code
```

This should become DOCS-003.

---

## DOCS-003 recommendation

Next task after merging 18:

```text
DOCS-003 — Verify source foundation completeness
```

Goal:
- verify files 00-18;
- verify SOURCES_INDEX;
- verify reports;
- list any inconsistencies;
- do not change code;
- create verification report.

This closes Phase 0 properly.
Because “we added all docs” is good. “we verified all docs” is better.

---

## DOCS-004 recommendation

After DOCS-003:

```text
DOCS-004 — Create source foundation summary report
```

Goal:
- summarize source foundation;
- list key architecture boundaries;
- list high-risk domains;
- recommend first implementation/audit tasks.

This prepares transition from docs to code.
Slow? Yes. Useful? Also yes. Life is cruel like that.

---

## First QA implementation tasks

Recommended after source foundation:

```text
QA-001 — create current prototype smoke test checklist
AUDIT-001 — inventory current repository structure
AUDIT-002 — audit current routes/pages/components
AUDIT-003 — audit current localStorage shape
AUDIT-004 — audit backend skeleton
CLEAN-001 — identify fake actions and risky placeholders
```

Do not jump directly into risky production functions.

---

## What not to do after this document

Do not immediately:
- implement real amoCRM sync;
- implement payment provider;
- implement public booking;
- implement AI diagnosis;
- migrate storage in one PR;
- claim production readiness;
- run destructive migration;
- create ten parallel code tasks.

Last source doc does not mean “release the hounds”.
It means “now we finally have a map”.

---

## Что нельзя делать

Нельзя:
- считать build passed полноценным QA;
- писать checks passed, если checks не запускались;
- скрывать failed checks;
- merge PR with secrets;
- merge PR with real patient data;
- merge PR that leaks medical data to amoCRM;
- merge tenant-sensitive code without tenant review;
- merge permission-sensitive code without permission review;
- merge storage/migration task without data preservation notes;
- merge destructive migration without approval;
- merge billing PR that mixes platform billing and clinic finance;
- merge UI PR with fake success actions;
- считать manual clicking полноценной регрессией;
- считать frontend disabled button security;
- считать skeleton production-ready;
- пропускать report;
- пропускать post-merge verification.

---

## Правила для ИИ-задач

Если задача касается testing, QA, CI, checks, release, validation, smoke tests, security scans, tenant tests, permission tests, migration tests or review process, ИИ должен проверить:
- task type and scope clear;
- relevant source docs referenced;
- checks match risk level;
- no fake checks;
- report required;
- no code changes hidden in docs task;
- sensitive data impact stated;
- tenant impact stated;
- storage impact stated;
- blockers identified;
- what was not tested stated;
- limitations honest.

---

## Acceptance для testing/QA задач

Testing/QA задача считается корректной, если:
- scope limited;
- checks are defined;
- pass/fail/not-run status honest;
- high-risk areas covered where relevant;
- tenant isolation considered;
- permissions considered;
- sensitive data considered;
- security scans considered where relevant;
- medical leakage considered where relevant;
- report created;
- no unsupported production claims.

---

## Итог

Testing and QA strategy — это защитная система DentalFlow.

Главная QA-цепочка:

```text
Task scope
→ Acceptance criteria
→ Checks
→ Report
→ PR review
→ Merge verification
→ Regression awareness
→ Release readiness
```

Главная safety-цепочка:

```text
tenant isolation
→ permissions
→ medical boundaries
→ storage safety
→ secret protection
→ integration safety
→ billing separation
→ audit
```

Главная практическая мысль:

```text
build passed is necessary, but not enough
```

Главная project-мысль:

```text
DentalFlow может стать SaaS only if quality checks protect data, tenants, medical logic, billing and integrations
```

Без QA проект может выглядеть быстрым.
С QA проект получает шанс быть надёжным.
А надёжность в CRM для стоматологий — это не роскошь, не “потом добавим” и не пункт для красивой презентации. Это разница между системой, которой доверяют, и красивым интерфейсом, который однажды очень уверенно делает неправильную вещь.
