# 04_DATA_ISOLATION_AND_SECURITY.md

## Назначение документа

Этот документ описывает правила изоляции данных и безопасности в DentalFlow CRM.

DentalFlow создаётся как SaaS-платформа для стоматологических клиник, поэтому безопасность и изоляция данных являются базовым фундаментом проекта, а не красивым пунктом в будущем списке “когда-нибудь сделаем”.

Главное правило:

**данные одной клиники не должны быть доступны другой клинике ни через UI, ни через backend, ни через database, ни через файлы, ни через интеграции, ни через отчёты, ни через ошибки.**

Если это правило нарушить, DentalFlow нельзя будет безопасно продавать другим клиникам.

---

## Главный принцип безопасности

DentalFlow должна строиться по принципу многоуровневой защиты.

Правильная цепочка:

```text
auth
→ tenant membership
→ role / permission
→ subscription / access status
→ entity ownership
→ validation
→ safe response
→ audit log
```

Нельзя полагаться только на один слой.

Frontend может помогать пользователю, но не должен быть единственным защитным механизмом.

Backend должен быть главным слоем контроля доступа.

Database должна помогать сохранять целостность данных.

Audit log должен фиксировать важные действия.

---

## Security by default

По умолчанию доступ должен быть запрещён.

Правильная логика:

```text
deny by default
allow only if explicitly permitted
```

Плохая логика:

```text
allow by default
hide some buttons in frontend
```

Если система не уверена, что пользователь имеет право на действие, действие должно быть запрещено.

Это скучно, зато безопасно. А “ну вроде можно” — это не политика доступа, а приглашение к будущей утечке.

---

## Изоляция tenant

Каждый tenant должен быть изолирован от других tenant.

Tenant isolation распространяется на:

- пациентов;
- записи;
- врачей;
- кабинеты;
- зубные карты;
- жалобы;
- clinical findings;
- планы лечения;
- документы;
- оплаты;
- склад;
- отчёты;
- настройки;
- пользователей;
- роли;
- интеграции;
- amoCRM tokens;
- sync logs;
- audit logs;
- файлы;
- exports;
- backups;
- notifications;
- billing status.

Клиника A не должна видеть данные клиники B.

Клиника B не должна использовать интеграции клиники A.

Обычный пользователь clinic tenant не должен иметь platform-level доступ.

---

## Tenant isolation не должен быть только UI

Скрыть кнопку во frontend недостаточно.

Плохой вариант:

```text
frontend не показывает пациентов другого tenant
backend всё равно отдаёт данные по прямому URL
```

Правильный вариант:

```text
frontend показывает только разрешённые данные
backend проверяет tenant membership
backend проверяет permission
backend проверяет entity ownership
database хранит tenantId
```

Frontend — это интерфейс.

Backend — это защита.

---

## Backend как главный security boundary

Production DentalFlow должен иметь backend как главный security boundary.

Backend отвечает за:

- проверку входа;
- проверку tenant membership;
- проверку ролей;
- проверку permissions;
- проверку subscription/access status;
- проверку принадлежности сущности tenant;
- валидацию входных данных;
- safe error responses;
- работу с database;
- работу с secrets;
- работу с tokens;
- вызовы внешних API;
- audit logs;
- integration logs.

Frontend не должен напрямую выполнять действия, требующие secrets или доверенной логики.

---

## Нельзя доверять frontend

Frontend может быть изменён пользователем.

Поэтому нельзя доверять:

- localStorage;
- sessionStorage;
- hidden fields;
- disabled buttons;
- route guards;
- UI state;
- role value from browser;
- tenantId from URL without backend validation;
- client-side validation as only validation.

Плохой вариант:

```text
if (localStorage.role === "clinic_owner") allow action
```

Правильный вариант:

```text
backend checks current user membership and permission
```

---

## TenantId из frontend не является доказательством доступа

Frontend может отправить tenantId.

Но backend обязан проверить, что текущий user действительно имеет доступ к этому tenant.

Плохой вариант:

```text
request tenantId = "tenant-b"
backend trusts it
```

Правильный вариант:

```text
backend checks:
currentUser belongs to tenant-b
membership is active
permission exists
tenant access is allowed
```

Если пользователь вручную меняет tenantId в URL, backend должен отказать.

---

## Entity ownership

Backend должен проверять принадлежность каждой сущности tenant.

Пример:

```text
GET /api/tenants/:tenantId/patients/:patientId
```

Backend должен проверить:

```text
user has access to tenantId
patient exists
patient.tenantId = tenantId
user has patients.view permission
```

Нельзя возвращать сущность только по ID без tenant check.

---

## Cross-tenant references запрещены

Сущности разных tenant не должны ссылаться друг на друга.

Плохой сценарий:

```text
TreatmentPlan.tenantId = Tenant A
TreatmentPlan.patientId → Patient from Tenant B
```

Правильное правило:

```text
TreatmentPlan.tenantId must equal Patient.tenantId
```

То же относится к:

- appointment → patient;
- dental finding → patient;
- document → patient;
- payment → patient;
- sync log → integration connection;
- file → document;
- stock movement → warehouse item.

---

## Sensitive data

В DentalFlow есть несколько типов чувствительных данных.

Основные категории:

```text
personal data
medical data
financial data
documents
integration secrets
auth secrets
billing data
audit data
files
```

Каждая категория должна иметь свои правила доступа.

---

## Personal data

Personal data включает:

- ФИО пациента;
- телефон;
- email;
- дата рождения;
- адрес, если появится;
- ИИН или другие идентификаторы, если появятся;
- контакты родственников, если появятся;
- комментарии, по которым можно идентифицировать пациента.

Personal data должно быть tenant-scoped.

Обычный пользователь другой клиники не должен видеть эти данные.

---

## Medical data

Medical data включает:

- жалобы;
- зубную карту;
- tooth state;
- clinical findings;
- diagnosis, если появится;
- riskDescription;
- врачебные заметки;
- medical documents;
- treatment history;
- completed services;
- медицинские файлы;
- снимки, если появятся.

Medical data должно быть доступно только ролям с медицинскими permissions или ролям, которым это явно разрешено.

Medical data нельзя отправлять во внешние sales-системы вроде amoCRM.

---

## Financial data

Financial data внутри клиники включает:

- стоимости планов лечения;
- оплаты пациентов;
- долги;
- возвраты;
- кассу;
- финансовые отчёты;
- invoices клиники пациенту, если появятся.

Financial data клиники не равен platform billing.

Доступ к financial data должны иметь только роли с finance permissions.

---

## Platform billing data

Platform billing data включает:

- тариф tenant;
- статус подписки;
- SaaS invoice;
- overdue;
- suspended;
- cancelled;
- billing contact;
- payment status за подписку DentalFlow.

Эти данные могут видеть:

- platform_owner;
- platform_admin с permission;
- billing_manager;
- clinic_owner своей клиники.

Обычные врачи, регистраторы и кассиры не обязаны видеть задолженность клиники перед платформой.

---

## Documents

Документы могут содержать personal, medical и financial data.

Documents должны быть:

- tenant-scoped;
- patient-scoped, если относятся к пациенту;
- permission-protected;
- snapshot-based, если это медицинский или юридически значимый документ;
- audit-ready.

Документы нельзя отдавать по прямой ссылке без backend permission check.

---

## Files

Файлы должны храниться через controlled file storage.

File metadata должна содержать:

```text
id
tenantId
patientId
documentId
storageKey
fileType
createdAt
createdBy
```

Файлы нельзя отдавать напрямую без проверки:

```text
current user
tenant access
permission
file ownership
```

Signed URLs, если появятся, должны быть короткоживущими и scope-limited.

---

## Integration secrets

Integration secrets включают:

- amoCRM access token;
- amoCRM refresh token;
- amoCRM client secret;
- OAuth authorization code;
- webhook secret;
- WhatsApp tokens;
- SMS provider keys;
- email provider credentials;
- payment provider secrets.

Эти данные должны храниться только server-side.

Запрещено хранить их в:

- frontend state;
- localStorage;
- sessionStorage;
- Git repository;
- Markdown reports;
- console logs;
- raw error messages;
- screenshots;
- public issue comments.

---

## Auth secrets

Auth secrets включают:

- passwords;
- password hashes;
- session secrets;
- JWT signing secrets;
- refresh tokens;
- magic link tokens;
- reset password tokens;
- private keys.

Эти данные нельзя раскрывать в UI, logs, reports или external integrations.

Password storage должен быть отдельной security-задачей.

Не реализовывать auth наивно.

---

## `.env` правила

Настоящие `.env` файлы не должны попадать в Git.

Допустимо:

```text
.env.example
```

Только с placeholder values.

Пример допустимого значения:

```text
AMOCRM_CLIENT_SECRET=replace_me
```

Недопустимо:

```text
AMOCRM_CLIENT_SECRET=real_secret_value
```

Если секрет попал в Git, это security incident.

---

## GitHub и secrets

Нельзя коммитить:

- GitHub PAT;
- GH_TOKEN;
- amoCRM tokens;
- database credentials;
- private keys;
- production secrets;
- real `.env`;
- OAuth secrets.

Нельзя просить пользователя отправлять secrets в чат.

Если агенту нужен доступ, пользователь должен настроить его через безопасный интерфейс или локальную среду.

---

## amoCRM security boundary

amoCRM интеграция должна работать только через backend/proxy.

Правильная схема:

```text
DentalFlow Frontend
→ DentalFlow Backend / Integration Proxy
→ amoCRM API
```

Запрещено:

```text
React frontend → amoCRM API directly
```

Причины:

- client secret нельзя хранить во frontend;
- tokens нельзя хранить в браузере;
- outgoing payload должен фильтроваться;
- sync должен логироваться;
- tenant access должен проверяться backend;
- suspended tenant не должен запускать sync.

---

## amoCRM forbidden data

В amoCRM нельзя отправлять:

- dental chart;
- toothNumber;
- tooth surfaces;
- clinical findings;
- diagnosis;
- riskDescription;
- medical documents;
- врачебные заметки;
- medical files;
- PDF с медицинскими деталями;
- raw treatment medical details.

amoCRM может получать только безопасную коммерческо-административную сводку.

Пример допустимых данных:

```text
patient full name
phone
lead source
lead status
commercial treatment plan summary
total planned amount
next appointment date
responsible manager
follow-up status
```

Даже эти данные должны отправляться только с tenant permission и через backend.

---

## OAuth security

OAuth flow должен быть server-side controlled.

Правила:

- state обязателен;
- state должен иметь срок жизни;
- authorization code не хранить во frontend;
- token exchange только backend-side;
- client secret только backend-side;
- token response не возвращать во frontend;
- errors должны быть safe;
- logs не должны содержать secrets.

Dev-only memory token store не является production storage.

---

## Token storage

Production token storage должен быть:

- server-side;
- tenant-scoped;
- encrypted or protected;
- access-controlled;
- audited for connect/disconnect;
- not exposed via API responses.

Memory token store допустим только как skeleton/dev-only placeholder.

Он должен быть явно помечен как not production-ready.

---

## Webhooks

Будущие webhooks должны быть безопасными.

Webhook endpoint должен:

- проверять подпись или secret, если provider поддерживает;
- валидировать payload;
- определять tenant;
- не доверять raw external data;
- логировать safe event;
- не сохранять secrets в logs;
- не применять изменения без tenant mapping;
- не записывать medical data из внешней sales-системы в медицинскую карту без правил.

Не реализовывать production webhooks без отдельной задачи.

---

## Safe logging

Логи не должны содержать secrets или лишние sensitive data.

Запрещено логировать:

- access token;
- refresh token;
- client secret;
- authorization code;
- password;
- raw webhook payload with secrets;
- full medical document;
- full dental chart;
- private patient notes;
- payment secrets.

Допустимо логировать safe metadata:

```text
tenantId
provider
operation
status
safe error code
createdAt
entityType
entityId
```

Если нужен подробный debug, он должен быть controlled и очищенный от secrets.

---

## Safe errors

Ошибки должны быть безопасными.

Плохой ответ:

```text
OAuth failed: client_secret=...
```

Плохой ответ:

```text
Patient exists but belongs to another tenant.
```

Правильный ответ:

```text
{
  "ok": false,
  "code": "FORBIDDEN",
  "message": "Недостаточно прав для выполнения действия."
}
```

или:

```text
{
  "ok": false,
  "code": "NOT_FOUND",
  "message": "Запись не найдена."
}
```

Ошибка не должна раскрывать существование чужих данных.

---

## Not found vs forbidden

Если пользователь пытается получить чужие данные, безопаснее часто вернуть:

```text
404 Not Found
```

вместо подробного:

```text
403 Forbidden: entity belongs to another tenant
```

Финальное правило зависит от API policy.

Но нельзя раскрывать лишнюю информацию о чужих tenant.

---

## Validation

Backend должен валидировать входные данные.

Проверять:

- required fields;
- data types;
- enum values;
- date formats;
- money values;
- tenantId;
- entity ownership;
- payload size;
- forbidden fields;
- unsafe HTML/script, если есть rich text;
- external IDs;
- file type;
- file size.

Frontend validation удобна, но backend validation обязательна.

---

## Input sanitization

Если система принимает пользовательский текст, нужно думать о sanitization.

Особенно для:

- comments;
- patient notes;
- document templates;
- treatment plan descriptions;
- webhook payloads;
- import files.

Нельзя позволять unsafe content попадать в UI или документы без правил.

---

## Output shaping

Backend не должен отдавать лишние поля.

DTO должен быть безопасным.

Плохой вариант:

```text
return full database object
```

Правильный вариант:

```text
return safe DTO for current role
```

Например, integration connection status DTO не должен включать tokens.

---

## Role-aware responses

Ответы backend могут отличаться по роли.

Пример:

doctor может получить:

```text
patient medical summary
dental chart
treatment plans
```

sales_manager может получить:

```text
patient name
phone
lead status
commercial plan summary
```

Но не должен получить full clinical findings.

---

## Least privilege

Каждая роль получает минимум прав.

Принцип:

```text
minimum necessary access
```

Примеры:

- receptionist не редактирует dental chart;
- cashier не меняет clinical findings;
- marketer не видит full medical data;
- sales_manager не видит riskDescription;
- support не имеет постоянный full access;
- platform billing manager не видит зубные карты.

---

## Support access security

Support access должен быть:

- временным;
- scoped to tenant;
- permission-limited;
- reason-based;
- auditable;
- visible to platform owner or clinic owner, если политика требует.

Support не должен иметь постоянный доступ ко всем клиникам.

Плохой вариант:

```text
support can open any tenant anytime
```

Правильный вариант:

```text
temporary support access with reason and audit
```

---

## Audit logs

Важные действия должны попадать в audit log.

Логировать:

- login/security events;
- user invited;
- role changed;
- user disabled;
- patient created/updated/archived;
- dental chart updated;
- finding created/updated/closed;
- treatment plan created/updated/approved;
- document generated/cancelled;
- payment created/refunded;
- integration connected/disconnected;
- token refreshed, safe metadata only;
- tenant suspended/activated;
- support access granted/revoked;
- export created;
- import performed.

Audit log должен быть tenant-aware.

---

## Audit log safety

Audit logs не должны содержать secrets.

Не писать в audit details:

- tokens;
- passwords;
- client secret;
- raw OAuth response;
- full medical document unless explicitly needed and protected;
- raw webhook with sensitive fields.

Audit должен объяснять, что произошло, но не становиться новой дырой безопасности.

---

## Exports

Export данных должен быть строго контролируемым.

Export должен учитывать:

- tenant;
- role;
- permission;
- sensitive data;
- audit log;
- retention policy;
- file security.

Обычный пользователь не должен выгружать всю базу пациентов.

Export всех данных tenant должен быть owner-level или platform-controlled действием.

---

## Imports

Import данных может повредить систему.

Import должен:

- быть tenant-scoped;
- проверять permission;
- валидировать файл;
- не создавать cross-tenant references;
- логировать результат;
- иметь report;
- не перезаписывать данные без явного правила.

---

## Backups

Backups должны быть защищены.

Production backup может содержать данные всех tenant.

Поэтому backup access должен быть строго ограничен.

Правила:

- backups encrypted or access-protected;
- backup access logged;
- restore controlled;
- backups not copied to dev without anonymization;
- secrets protected;
- retention defined.

Не проектировать production без backup strategy.

---

## Restore

Restore должен быть контролируемым.

Опасности:

- восстановить один tenant поверх другого;
- потерять новые данные;
- нарушить tenant isolation;
- восстановить старые secrets;
- раскрыть данные в dev.

Restore должен быть отдельной procedure.

---

## Development data

Development environment не должен использовать реальные production данные без очистки.

Для dev использовать:

- fake patients;
- demo tenant;
- fake phones;
- fake emails;
- fake amoCRM account;
- fake documents.

Если нужны реальные данные, они должны быть anonymized и разрешены.

---

## Anonymization

Anonymization должна удалять или заменять:

- ФИО;
- телефон;
- email;
- адрес;
- ИИН;
- документы;
- врачебные заметки;
- medical identifiers;
- реальные комментарии;
- attachments.

Просто скопировать production database в dev — плохая идея. Удивительно, но “для теста” не является магическим юридическим щитом.

---

## localStorage security

localStorage не является безопасным хранилищем.

Запрещено хранить в localStorage:

- access token;
- refresh token;
- client secret;
- password;
- medical documents production;
- production financial records;
- integration secrets;
- private files;
- payment provider secrets.

В прототипе localStorage допустим для demo data.

Но production source of truth должен быть backend/database.

---

## Session storage

sessionStorage тоже не место для secrets.

Он может использоваться для UI state или temporary non-sensitive values.

Но не для:

- refresh tokens;
- client secret;
- OAuth code;
- medical documents;
- integration tokens.

---

## Browser cache risk

Frontend может кешировать данные.

Кеш должен быть tenant-aware.

При переключении tenant нужно очищать tenant-scoped state.

Плохой cache key:

```text
patients
```

Правильный cache key:

```text
tenantId:patients
```

Но даже tenant-aware frontend cache не заменяет backend security.

---

## Package security

Новые dependencies нельзя добавлять без причины.

Особенно осторожно:

- auth libraries;
- crypto libraries;
- PDF libraries;
- file upload libraries;
- ORM;
- payment libraries;
- webhook libraries;
- UI packages with heavy permissions.

Если dependency нужна, задача должна объяснить:

- зачем;
- почему нельзя без неё;
- риски;
- alternatives;
- package impact.

---

## Supply chain risk

Любая dependency может быть риском.

Перед добавлением dependency нужно учитывать:

- популярность;
- поддержку;
- лицензии;
- known vulnerabilities;
- install scripts;
- package size;
- maintenance status.

Не добавлять dependency просто потому, что агенту так удобнее. Агенту вообще многое удобно, особенно ломать проект быстро.

---

## Security checks для PR

Для sensitive PR запускать safety search.

Примеры:

```text
rg -n "access_token|refresh_token|client_secret|clientSecret|password|DATABASE_URL|PRIVATE_KEY|github_pat|Bearer" .
```

Для amoCRM/security задач:

```text
rg -n "access_token|refresh_token|client_secret|clientSecret|localStorage|sessionStorage" backend src _ai_work
```

Для medical leakage:

```text
rg -n "DentalFinding|dentalChart|toothNumber|riskDescription|diagnosis|clinical" backend/src src/integrations
```

Результат нужно описывать в report.

---

## Security review for PR

Sensitive PR нельзя принимать только по словам агента.

Проверять:

- changed files;
- diff scope;
- package changes;
- secrets;
- token handling;
- medical data flow;
- tenant access;
- backend enforcement;
- safe errors;
- logs;
- report;
- what was not implemented.

Если PR затрагивает security, storage, auth, integration, billing или medical data, review должен быть строже.

---

## Data deletion security

Нельзя удалять важные данные без процедуры.

Особенно:

- patients;
- appointments;
- dental charts;
- findings;
- treatment plans;
- documents;
- payments;
- audit logs;
- integration logs;
- tenant data.

Для важных сущностей лучше использовать soft delete.

Hard delete должен быть отдельной задачей и требовать audit/backup/owner decision.

---

## Suspended tenant security

Если tenant suspended, доступ может быть ограничен.

Но данные не удаляются.

При suspended:

- рабочие write operations могут быть запрещены;
- sync может быть paused;
- public booking может быть disabled;
- ordinary staff may see limited message;
- clinic_owner may see billing status;
- backend must enforce restrictions.

Frontend-only block недостаточен.

---

## Feature entitlement security

Если тариф не включает функцию, backend должен запретить её использование.

Плохой вариант:

```text
button hidden, but API works
```

Правильный вариант:

```text
backend requireFeature("amocrm_integration")
```

Feature gate должен учитывать tenant tariff/subscription.

---

## Reports security

Reports должны быть tenant-scoped.

Clinic owner видит отчёты своей клиники.

Platform owner видит platform reports.

Reports не должны случайно смешивать данные разных tenant.

Особенно опасны:

- finance reports;
- medical reports;
- patient source reports;
- doctor performance reports;
- integration error reports;
- export reports.

---

## Search security

Search должен быть tenant-scoped.

Плохой вариант:

```text
search patient by phone across all tenants for clinic user
```

Правильный вариант:

```text
search patient by phone only inside current tenant
```

Global search должен быть доступен только platform roles и по отдельным правилам.

---

## Notification security

Notifications должны быть tenant-scoped.

Нельзя отправлять сообщение от имени неправильной клиники.

Нельзя отправлять medical details без правил.

Нельзя использовать integration credentials одного tenant для уведомлений другого tenant.

---

## Public routes security

Будущие public routes должны быть осторожными.

Примеры:

- online booking;
- public patient form;
- document confirmation link;
- payment link.

Public routes должны иметь:

- scoped token or slug;
- rate limiting, если потребуется;
- validation;
- tenant status check;
- feature entitlement check;
- no secret exposure.

Не реализовывать public booking без отдельной security-задачи.

---

## Rate limiting

В будущем нужны rate limits для:

- login;
- public forms;
- OAuth callbacks;
- webhooks;
- exports;
- imports;
- search;
- notifications.

Не обязательно реализовывать сразу.

Но backend architecture должна учитывать эту возможность.

---

## File upload security

Если появится upload файлов, нужны правила:

- allowed file types;
- file size limit;
- virus/malware scan, если возможно;
- storage isolation;
- tenantId metadata;
- permission check;
- no direct public access by default;
- safe filename handling.

Не реализовывать upload без отдельной задачи.

---

## PDF security

PDF/documents могут содержать sensitive data.

Правила:

- PDF generation backend-side or controlled;
- tenant-scoped;
- document snapshot;
- safe file storage;
- permission check;
- no medical PDF to amoCRM;
- no public PDF URL without token/permission;
- audit event for generation/export.

---

## Payment provider security

Payment provider integration для SaaS billing или clinic payments должна быть отдельной security-задачей.

Правила:

- secrets backend-side;
- webhook signature verification;
- no card data stored unless certified/provider-managed;
- safe payment status updates;
- audit logs;
- platform billing separate from clinic finance.

Не добавлять payment provider “между делом”.

---

## Security incident

Если обнаружен secret в Git или утечка данных, это security incident.

Действия:

```text
stop using leaked secret
rotate secret
remove from repo if possible
audit impact
document incident
check logs
notify responsible owner if required
```

Нельзя просто удалить строку и сделать вид, что ничего не было.

Git помнит. Увы, память у Git иногда лучше человеческой.

---

## Current prototype limitations

Текущий прототип может не иметь:

- production auth;
- production database;
- tenant enforcement;
- real permissions;
- encrypted token storage;
- production audit logs;
- backup/restore;
- real CI security checks.

Это нормально для раннего этапа.

Но новые решения не должны делать вид, что этих требований никогда не будет.

---

## Что нельзя делать

Нельзя:

- полагаться только на frontend для security;
- доверять localStorage для ролей и прав;
- хранить tokens в frontend;
- хранить secrets в Git;
- отправлять medical data в amoCRM;
- возвращать tokens через API;
- логировать secrets;
- логировать raw medical documents без необходимости;
- отдавать файлы без permission check;
- делать patients глобальными;
- делать search across tenants для clinic user;
- делать reports без tenant scope;
- смешивать platform billing и clinic finance;
- удалять данные tenant за неоплату;
- делать hard delete без процедуры;
- делать production claims для dev-only skeleton;
- добавлять dependencies без причины;
- использовать bugged internal PR process, если он создаёт duplicate/conflicting PR.

---

## Правила для ИИ-задач

Если задача касается security, data isolation, auth, roles, tenant, backend, storage, integrations, billing, documents или files, ИИ должен проверить:

- есть ли tenant impact;
- есть ли sensitive data impact;
- не нарушается ли tenant isolation;
- не доверяет ли backend frontend state;
- не появляются ли secrets во frontend;
- не появляются ли secrets в Git;
- не уходят ли medical data в amoCRM;
- safe ли error responses;
- safe ли logs;
- есть ли backend enforcement;
- нет ли destructive data change;
- нет ли package changes без причины;
- есть ли report with safety notes.

---

## Acceptance для security-related задач

Security-related задача считается корректной, если:

- sensitive data impact указан;
- tenant impact указан;
- backend enforcement описан или реализован;
- frontend не является единственной защитой;
- secrets не раскрываются;
- tokens не попадают во frontend/localStorage;
- medical data не отправляется во внешние sales-системы;
- errors safe;
- logs safe;
- entity ownership учтён;
- subscription/access status учтён, если relevant;
- audit impact описан;
- destructive changes отсутствуют или явно утверждены;
- report создан.

---

## Итог

Data isolation и security — это основа DentalFlow как SaaS-платформы.

Правильная защитная цепочка:

```text
auth
→ tenant membership
→ role / permission
→ subscription / feature entitlement
→ entity ownership
→ validation
→ safe DTO
→ audit log
```

Главная мысль:

```text
данные клиники принадлежат только этой клинике
```

И вторая мысль, которую человечество почему-то всё ещё забывает:

```text
frontend не является security boundary
```

Если DentalFlow не защитит данные tenant, medical data, financial data, documents, secrets и integrations, систему нельзя будет безопасно продавать другим клиникам.

Безопасность здесь не украшение.

Это разница между SaaS-продуктом и красивым интерфейсом, который однажды покажет чужого пациента не тому человеку.
