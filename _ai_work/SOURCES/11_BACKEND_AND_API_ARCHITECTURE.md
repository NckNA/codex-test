# 11_BACKEND_AND_API_ARCHITECTURE.md

## Назначение документа

Этот документ описывает будущую backend и API архитектуру DentalFlow CRM.

DentalFlow создаётся как SaaS CRM-платформа для стоматологических клиник, поэтому backend не может быть просто “папкой с несколькими routes”.

Backend должен стать главным security boundary, source of truth, API layer, integration layer и местом, где реально enforced tenant isolation, permissions, subscription access, validation and audit.

Главное правило:

**production DentalFlow не должен опираться на frontend/localStorage как источник истины и слой безопасности.**

Frontend помогает пользователю работать.
Backend защищает данные, проверяет права, хранит состояние, управляет интеграциями и не даёт системе превратиться в “кнопки красивые, безопасность на честном слове”.

Честное слово, как обычно, плохо работает под нагрузкой и в суде.

---

## Главная роль backend

Backend DentalFlow должен отвечать за:

- authentication;
- user session;
- tenant membership;
- roles and permissions;
- subscription/access status;
- feature entitlements;
- tenant isolation;
- entity ownership;
- validation;
- database access;
- files;
- documents;
- audit logs;
- integration secrets;
- external API calls;
- sync logs;
- safe errors;
- safe DTO;
- migrations;
- rate limits;
- background jobs;
- reporting API;
- billing access control.

Backend — это не optional layer.
Backend — это место, где DentalFlow становится SaaS-продуктом, а не локальным прототипом.

---

## Главная архитектурная схема

Будущая production-схема:

```text
Frontend
→ Backend API
→ Guards
→ Services
→ Repositories / Database
→ External Services
→ Audit / Logs
```

Расширенная схема:

```text
React / Vite Frontend
→ DentalFlow Backend API
→ Auth Guard
→ Tenant Guard
→ Permission Guard
→ Feature Entitlement Guard
→ Validation Layer
→ Domain Service
→ Repository / Database
→ Safe DTO Response
→ Audit Log
```

Для интеграций:

```text
Frontend
→ Backend API
→ Integration Service
→ Safe Mapper
→ Token Store
→ External API Client
→ Sync Log
→ Audit Log
```

---

## Backend как security boundary

Backend должен быть главным security boundary.

Backend обязан проверять:

```text
current user
current tenant
tenant membership
role / permission
subscription status
feature entitlement
entity ownership
request payload
status transition
sensitive data access
```

Frontend может скрывать кнопки, но это не защита.

Плохая логика:

```text
button hidden in frontend
→ operation is secure
```

Правильная логика:

```text
backend checks permission before operation
```

---

## Почему frontend не security boundary

Frontend может быть изменён пользователем.

Нельзя доверять:

- localStorage;
- sessionStorage;
- route guards;
- disabled buttons;
- hidden fields;
- UI state;
- role value in browser;
- tenantId in URL without backend validation;
- client-side validation.

Frontend нужен для UX.
Backend нужен для доверенной логики.

---

## Current prototype exception

Сейчас проект может быть frontend/localStorage-прототипом.

Это допустимо временно.
Но все новые архитектурные решения должны учитывать будущий backend.

Если новая сущность добавляется во frontend, нужно думать:

```text
какой backend endpoint будет у неё в production?
какой tenantId?
какие permissions?
какой DTO?
какая validation?
какой audit?
```

Прототип может быть простым.
Архитектура не должна быть наивной.

---

## Backend не должен быть amoCRM-only

В проекте может быть backend/proxy skeleton для amoCRM.

Но backend DentalFlow шире, чем amoCRM.
Он должен обслуживать:

- patients;
- appointments;
- dental chart;
- findings;
- treatment plans;
- documents;
- payments;
- warehouse;
- reports;
- users;
- roles;
- tenants;
- subscriptions;
- integrations;
- audit;
- files.

amoCRM proxy — только один модуль backend.

---

## Рекомендуемая backend структура

Будущая структура backend может быть такой:

```text
backend/
  src/
    server.js
    config.js
    routes/
    middlewares/
    guards/
    controllers/
    services/
    repositories/
    integrations/
    mappers/
    validators/
    utils/
    jobs/
    db/
    audit/
    errors/
```

Точная структура может измениться.
Но важно разделять ответственность.

---

## Server layer

Server layer отвечает за:

- запуск HTTP server;
- подключение routes;
- global error handler;
- request parsing;
- CORS, если нужно;
- health routes;
- graceful shutdown;
- environment config.

Server layer не должен содержать бизнес-логику клиники.

Плохой вариант:

```text
server.js contains all patient, appointment, amoCRM and billing logic
```

Правильный вариант:

```text
server.js wires routes and infrastructure
```

---

## Route layer

Route layer отвечает за:

- URL;
- HTTP method;
- request body parsing;
- calling guards;
- calling service;
- returning response;
- catching errors.

Route не должен:

- напрямую ходить в database;
- напрямую строить complex DTO;
- хранить secrets;
- содержать всю domain logic;
- вызывать external API без service layer.

---

## Controller layer

Controller может быть отдельным от route.
Controller отвечает за HTTP-specific orchestration.

Пример:

```text
patientsController.createPatient(req, res)
```

Он может:

- получить request context;
- вызвать validation;
- вызвать service;
- вернуть response.

Но business rules должны быть в service.

---

## Guard layer

Guard layer отвечает за доступ.

Guards:

```text
requireAuth
requireTenantAccess
requirePermission
requireFeature
requireActiveSubscription
requireEntityOwnership
```

Guard failure должен возвращать safe error.
Guard должен быть reusable.
Нельзя размазывать проверки прав по случайным routes.

---

## Service layer

Service layer содержит business logic.

Примеры:

```text
PatientService
AppointmentService
DentalChartService
FindingService
TreatmentPlanService
DocumentService
PaymentService
TenantService
BillingService
AmoCrmIntegrationService
AuditService
```

Service layer должен:

- применять domain rules;
- вызывать repositories;
- вызывать external clients through integration services;
- создавать audit events;
- возвращать domain result or DTO.

---

## Repository layer

Repository layer отвечает за database access.

Примеры:

```text
PatientRepository
AppointmentRepository
TreatmentPlanRepository
AmoCrmConnectionRepository
AuditLogRepository
```

Repository должен:

- читать данные;
- писать данные;
- применять tenant filters;
- использовать transactions where needed;
- не содержать UI logic;
- не возвращать secrets в public DTO.

---

## Mapper layer

Mapper layer преобразует domain entities в DTO.

Примеры:

```text
mapPatientToPatientCardDto
mapPatientToListItemDto
mapTreatmentPlanToPreviewDto
mapAmoCrmSafeDealDto
```

Mapper должен быть role-aware там, где есть sensitive data.
Нельзя отдавать full database object напрямую.

---

## Validator layer

Validator layer проверяет входные данные.

Проверять:

- required fields;
- types;
- enum values;
- dates;
- money;
- toothNumber;
- status transition;
- tenantId;
- entity ownership;
- payload size;
- file type;
- forbidden fields.

Frontend validation не заменяет backend validation.

---

## Error layer

Error layer нормализует ошибки.

Пример safe error response:

```text
{
  "ok": false,
  "code": "FORBIDDEN",
  "message": "Недостаточно прав для выполнения действия."
}
```

Error layer не должен раскрывать:

- stack traces;
- secrets;
- tokens;
- database internals;
- чужой tenant;
- raw external API errors;
- medical details.

---

## Request context

Каждый request должен иметь context.

Пример:

```text
RequestContext
- requestId
- userId
- tenantId
- role
- permissions
- subscriptionStatus
- locale
- timezone
```

Context не должен слепо доверять frontend.
Он должен формироваться backend-side после auth and tenant checks.

---

## requestId

Каждый request желательно иметь requestId.

requestId помогает:

- логировать ошибки;
- связывать logs;
- искать проблемы;
- отдавать safe reference пользователю;
- debug production issues.

requestId не должен содержать sensitive data.

---

## Auth

Production auth — отдельная большая задача.
Но backend architecture должна ожидать auth.

Auth отвечает за:

- user identity;
- login;
- session;
- password/magic link/SSO, если появится;
- token/session validation;
- logout;
- disabled users.

Не реализовывать auth наивно.

---

## Auth source of truth

User identity должен подтверждаться backend.

Frontend не может сказать:

```text
I am userId=1
```

и backend не должен этому верить.
Backend должен определить current user из trusted session/token.

---

## Session strategy

Финальная session strategy будет отдельной задачей.

Варианты:

- secure cookies;
- server sessions;
- JWT;
- external auth provider;
- hybrid.

Какой бы вариант ни был выбран, правила:

- secrets server-side;
- tokens protected;
- logout works;
- disabled user blocked;
- session expiration;
- no sensitive token in localStorage if avoidable.

---

## Tenant guard

Tenant guard проверяет доступ пользователя к tenant.

Проверка:

```text
tenant exists
user exists
user has active TenantUser membership
tenant is accessible
membership not disabled
```

Если tenant suspended, guard должен учитывать access rules.

---

## Permission guard

Permission guard проверяет право на действие.

Пример:

```text
patients.view
patients.create
appointments.update
dental_chart.update
integrations.configure
billing.manage
```

Permission всегда проверяется в tenant context.

Плохой вариант:

```text
user has patients.view globally
```

Правильный вариант:

```text
user has patients.view in tenantId
```

---

## Feature entitlement guard

Feature guard проверяет тарифные возможности tenant.

Пример:

```text
requireFeature("amocrm_integration")
```

Если функция недоступна по тарифу, backend должен отказать.
Frontend disabled button не является защитой.

---

## Subscription/access guard

Subscription/access guard проверяет статус tenant.

Пример:

```text
active
trial
overdue
suspended
cancelled
archived
```

Если tenant suspended:

- write operations могут быть запрещены;
- integrations paused;
- public booking disabled;
- data not deleted;
- clinic_owner может видеть billing notice.

---

## Entity ownership guard

Entity ownership guard проверяет, что сущность принадлежит tenant.

Пример:

```text
patient.tenantId === tenantId
appointment.tenantId === tenantId
document.tenantId === tenantId
```

Нельзя отдавать entity только по ID без tenant check.

---

## API route pattern

Будущий tenant-scoped API должен иметь tenant context.

Примеры:

```text
GET /api/tenants/:tenantId/patients
POST /api/tenants/:tenantId/patients
GET /api/tenants/:tenantId/patients/:patientId
PUT /api/tenants/:tenantId/patients/:patientId

GET /api/tenants/:tenantId/appointments
POST /api/tenants/:tenantId/appointments

GET /api/tenants/:tenantId/treatment-plans
POST /api/tenants/:tenantId/treatment-plans
```

Platform routes отдельно:

```text
GET /api/platform/tenants
POST /api/platform/tenants
POST /api/platform/tenants/:tenantId/suspend
```

---

## Почему tenantId в route полезен

tenantId в route делает контекст явным.

Пример:

```text
/api/tenants/:tenantId/patients/:patientId
```

Backend видит:

- какой tenant запрошен;
- какой patient запрошен;
- что нужно проверить.

Но tenantId в URL не является доказательством доступа.
Backend всё равно проверяет membership.

---

## Alternative tenant context

Возможен вариант, где tenant context хранится в session/current tenant.

Пример:

```text
GET /api/patients
```

и backend берёт currentTenantId из session.

Это возможно.
Но нужно быть особенно осторожным со stale tenant context.
Для SaaS часто безопаснее и яснее explicit tenant route.

---

## API response shape

Рекомендуемый response shape:

```text
{
  "ok": true,
  "data": {}
}
```

Для ошибки:

```text
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "Проверьте данные и повторите попытку.",
  "details": []
}
```

Финальный формат можно уточнить позже.
Главное — consistency.

---

## HTTP status codes

Примерная логика:

```text
200 OK
201 Created
204 No Content
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Validation Error
429 Too Many Requests
500 Internal Server Error
```

Не надо всё возвращать как 200 с текстом “ошибка”.
Это удобно только тем, кто хочет потом страдать в debug.

---

## Safe 404 vs 403

Если пользователь пытается открыть чужую entity, часто безопаснее вернуть:

```text
404 Not Found
```

вместо:

```text
403 Entity belongs to another tenant
```

Нельзя раскрывать существование чужих данных.
Final policy нужно определить отдельно.

---

## DTO принцип

Backend должен возвращать DTO, а не raw database object.

Плохой вариант:

```text
return patientRow
```

Правильный вариант:

```text
return PatientCardDto
```

DTO должен учитывать:

- роль;
- permissions;
- tenant;
- sensitive data;
- feature availability.

---

## Patient DTO

Patient list DTO:

```text
id
fullName
phone
source
leadStatus
nextAppointmentAt
activePlanStatus
balanceSummary, if allowed
```

Не включать dental chart в список пациентов.
Patient card DTO может быть шире, но role-aware.

---

## DentalChart DTO

DentalChart DTO:

```text
patientId
teeth
activeFindingsSummary
lastUpdatedAt
permissions
```

Не отдавать full clinical notes ролям без medical permissions.

---

## TreatmentPlan DTO

TreatmentPlan DTO должен различать:

- internal medical view;
- patient preview;
- commercial summary;
- finance view.

Не один DTO для всех ролей.
Иначе sales manager внезапно получит clinical notes, потому что “так проще”.

Да, проще. До первого нормального review.

---

## Integration DTO

Integration DTO не должен содержать secrets.

Safe:

```text
connected
status
accountName
lastSyncAt
needsReconnect
safeMessage
```

Forbidden:

```text
access_token
refresh_token
client_secret
authorization_code
raw token response
```

---

## Validation errors

Validation error должен быть понятным.

Пример:

```text
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "Проверьте заполненные поля.",
  "details": [
    {
      "field": "phone",
      "message": "Телефон обязателен."
    }
  ]
}
```

Не возвращать stack trace.

---

## Domain validation

Domain validation проверяет смысл.

Примеры:

- toothNumber valid;
- appointment startAt before endAt;
- appointment no conflict;
- treatment stage belongs to plan;
- finding belongs to patient;
- document belongs to tenant;
- payment amount positive;
- status transition allowed.

Type validation недостаточно.

---

## Status transition validation

Backend должен контролировать status transitions.

Пример:

```text
draft → proposed
proposed → approved
approved → in_progress
in_progress → completed
```

Нельзя разрешать:

```text
any status → any status
```

без правил.

---

## Money validation

Money fields должны быть явными.

Лучше:

```text
amount
currency
```

Проверять:

- amount numeric;
- amount non-negative where needed;
- currency valid;
- decimal rules;
- no floating precision issues if possible.

Финальная money model будет отдельной задачей.

---

## Date/time validation

Backend должен проверять date/time.

Особенно для:

- appointments;
- reminders;
- documents;
- billing periods;
- audit logs;
- sync jobs.

Хранить timestamps лучше в UTC.
Отображать по tenant timezone.

---

## Timezone strategy

Tenant должен иметь timezone.

Пример:

```text
Asia/Almaty
```

Backend должен:

- хранить UTC;
- знать tenant timezone;
- корректно считать local dates;
- не смешивать timezones.

Расписание без timezone strategy — это медленная мина под календарём.

---

## Database as source of truth

Production source of truth:

```text
backend database
```

Не source of truth:

```text
localStorage
browser cache
amoCRM
Excel
PDF export
WhatsApp
frontend state
```

External systems могут иметь свои данные, но DentalFlow medical/clinic data должна жить в backend database.

---

## Database choice

Финальный database choice будет отдельной задачей.

Варианты:

- PostgreSQL;
- managed database;
- other SQL database.

Для SaaS предпочтительно иметь:

- transactions;
- foreign keys;
- indexes;
- tenantId filters;
- migrations;
- backups;
- audit support.

Не выбирать database casually.

---

## TenantId in database

Tenant-owned tables должны иметь tenantId.

Примеры:

```text
patients
appointments
dental_charts
findings
treatment_plans
documents
payments
warehouse_items
integration_connections
sync_logs
audit_logs
```

Индексы:

```text
tenantId
tenantId + patientId
tenantId + status
tenantId + createdAt
tenantId + externalId
```

---

## Foreign keys

Database должна помогать сохранять целостность.

Примеры:

```text
appointment.patientId → patient.id
treatment_plan.patientId → patient.id
document.treatmentPlanId → treatment_plan.id
payment.patientId → patient.id
```

Но foreign key alone не заменяет tenant checks.
Нужно избегать cross-tenant references.

---

## Cross-tenant constraints

Нельзя допускать:

```text
appointment.tenantId = Tenant A
patient.tenantId = Tenant B
```

Production schema должна предотвращать или выявлять такие ошибки.

---

## Transactions

Transactions нужны для операций, которые меняют несколько сущностей.

Примеры:

- create treatment plan with stages;
- generate document snapshot;
- record payment and finance record;
- import patients;
- connect integration and store tokens;
- update status and audit log.

Без transactions можно получить “план есть, этапы потерялись”.
Великолепный UX для тех, кто любит загадки.

---

## Migrations

Database migrations должны быть controlled.

Правила:

- migrations versioned;
- reversible where possible;
- tested on copy/staging;
- no destructive migration without backup;
- data migration report;
- tenant impact described;
- rollback plan if needed.

Не делать schema changes случайно внутри feature PR без описания.

---

## Storage migration from localStorage

Переход от localStorage к backend должен быть отдельной стратегией.

Шаги:

```text
document current localStorage shape
define backend schema
create import/export map
demo tenant
validate data
migrate gradually
switch frontend to API
remove localStorage as source of truth
```

Не делать одним PR.

---

## API versioning

В будущем может понадобиться API versioning.

Пример:

```text
/api/v1/...
```

На раннем этапе можно не вводить version prefix.
Но architecture должна учитывать future API changes.

---

## Backward compatibility

Если API меняется, нужно учитывать:

- frontend compatibility;
- mobile app, если появится;
- public booking;
- integrations;
- webhooks;
- external clients.

Не ломать API молча.

---

## Idempotency

Некоторые API operations должны быть idempotent.

Особенно:

- integration sync;
- payment callbacks;
- webhooks;
- document generation request;
- import retry;
- notification retry.

Повтор запроса не должен создавать дубликаты.

---

## Pagination

List endpoints должны поддерживать pagination.

Пример:

```text
GET /patients?page=1&pageSize=50
```

Или cursor pagination.

Не отдавать тысячи patients одним response.

---

## Filtering

Filters должны быть tenant-scoped.

Примеры:

- patient search;
- appointment status;
- doctor;
- date range;
- lead status;
- treatment plan status;
- payment status.

Backend должен enforce tenant scope regardless of filters.

---

## Sorting

Sorting должен быть controlled.
Разрешать только known fields.

Плохой вариант:

```text
sortBy from user directly inserted into SQL
```

Правильный вариант:

```text
allowlisted sort fields
```

---

## Search

Search должен быть tenant-scoped.

Patient search:

```text
fullName
phone
source
leadStatus
```

Обычный clinic user не должен искать across all tenants.
Platform search — отдельная role-restricted feature.

---

## Rate limiting

Backend должен учитывать rate limits.

Особенно:

- auth;
- public booking;
- webhooks;
- imports;
- exports;
- search;
- notifications;
- integration sync.

Не обязательно реализовывать сразу, но architecture должна позволять.

---

## File handling

Files должны идти через backend.

Backend отвечает за:

- upload validation;
- file type;
- file size;
- tenantId metadata;
- permission check;
- storage key;
- signed URL if used;
- audit;
- no direct public access by default.

---

## File metadata

File metadata:

```text
id
tenantId
patientId
documentId
storageKey
fileType
fileSize
createdAt
createdBy
```

Файл без tenantId — будущая проблема.

---

## Public links

Public links должны быть limited.

Например:

- booking link;
- document confirmation link;
- payment link.

Rules:

- scoped token;
- expiration;
- tenant status check;
- feature check;
- no secrets;
- no full data exposure.

Не делать public links без security task.

---

## Background jobs

Backend может нуждаться в jobs.

Examples:

- reminders;
- integration sync retries;
- token refresh;
- report generation;
- document generation;
- billing checks;
- cleanup expired OAuth state;
- export generation.

Jobs должны быть tenant-aware.

---

## Queue

Queue нужна для:

- retries;
- rate limits;
- long operations;
- webhooks;
- imports/exports;
- notifications.

Не обязательно на раннем этапе.
Но architecture должна не блокировать queue.

---

## Notifications

Notification backend может отправлять:

- appointment reminders;
- follow-up reminders;
- billing alerts;
- integration error alerts;
- no-show tasks.

Notifications должны быть tenant-scoped and privacy-safe.

---

## Reminder privacy

Reminder не должен содержать sensitive medical data.

Safe:

```text
Напоминаем о записи завтра в 10:00.
```

Unsafe:

```text
Завтра лечение 47 зуба из-за urgent finding.
```

Backend должен контролировать template.

---

## Reports API

Reports должны быть backend-side.

Reasons:

- tenant isolation;
- permissions;
- finance access;
- aggregation;
- performance;
- sensitive data filtering.

Reports should not be computed from all frontend localStorage.

---

## Export API

Export должен быть controlled.

Rules:

- permission;
- tenant scope;
- audit;
- sensitive field filtering;
- file security;
- expiration;
- no secrets.

Export всей базы пациентов — owner-level action, not receptionist toy.

---

## Import API

Import должен быть controlled.

Rules:

- permission;
- tenant scope;
- validation;
- duplicate detection;
- report;
- rollback strategy if possible;
- no cross-tenant references.

Import без validation — это способ быстро испортить аккуратную базу.

---

## Audit log

Backend должен создавать audit events для важных действий.

Examples:

```text
user.login
user.invited
user.role_changed

patient.created
patient.updated

appointment.created
appointment.cancelled

dental_chart.updated
finding.created
treatment_plan.created
document.generated

payment.created

integration.connected

tenant.suspended
```

Audit должен быть tenant-aware.

---

## Audit event model

AuditLog:

```text
id
tenantId
actorUserId
action
entityType
entityId
metadata
createdAt
requestId
```

Metadata должна быть safe.
Не хранить secrets.
Не хранить full medical documents unless explicitly protected and required.

---

## Application logs

Application logs нужны для debugging and operations.

Logs can include:

```text
requestId
tenantId
userId
route
operation
status
duration
safe error code
```

Logs must not include:

- passwords;
- tokens;
- client secret;
- full medical documents;
- raw dental chart;
- private clinical notes;
- payment secrets.

---

## Safe logging

Правило:

```text
log metadata, not secrets
```

Плохой log:

```text
OAuth token response: ...
```

Хороший log:

```text
amoCRM token exchange failed: AMOCRM_AUTH_FAILED requestId=...
```

---

## Error monitoring

Production может иметь error monitoring.

Но нужно фильтровать sensitive data before sending to monitoring.

Не отправлять medical payload or secrets в external monitoring.

---

## Health endpoints

Backend должен иметь health endpoint.

Example:

```text
GET /api/health
```

Response:

```text
{
  "ok": true,
  "status": "healthy"
}
```

Health endpoint не должен раскрывать secrets or internal config.

---

## Readiness endpoint

В production могут быть:

```text
/health
/readiness
/liveness
```

Readiness может проверять database.
Но не показывать sensitive details.

---

## Config management

Config должен идти из environment.

Config validation should fail safely if required values missing.

Do not hardcode:

- database URL;
- OAuth secrets;
- API keys;
- JWT secrets;
- production URLs;
- private keys.

---

## Environment files

Допустимо:

```text
.env.example
```

Запрещено:

```text
.env with real secrets
```

Если secret committed, rotate. Git всё помнит. Да, он хуже бывшего коллеги с хорошей памятью.

---

## CORS

CORS должен быть configured intentionally.

Production should allow only trusted origins.

Не использовать:

```text
Access-Control-Allow-Origin: *
```

для authenticated production API without strong reason.

---

## CSRF

Если используется cookie-based auth, нужно учитывать CSRF.

Solutions depend on auth strategy.

Не игнорировать CSRF for state-changing operations.

---

## XSS impact

Backend должен не отдавать unsafe HTML without sanitization.

Если document templates or rich text support появятся:

- sanitize;
- escape;
- validate;
- restrict allowed tags;
- protect PDF rendering.

---

## SQL injection

If SQL used directly, all inputs must be parameterized.

Do not concatenate user input into SQL.
Sort/filter fields must be allowlisted.

---

## Dependency security

Backend dependencies should be added carefully.

Before adding dependency:

- why needed;
- alternatives;
- maintenance;
- license;
- vulnerabilities;
- install scripts;
- package size;
- backend/frontend impact.

Docs-only tasks must not change package files.

---

## API client security

External API clients must:

- not log secrets;
- normalize errors;
- support timeouts;
- handle rate limits;
- be server-side;
- use safe DTO;
- respect tenant context.

---

## Timeouts

Backend calls to external services should have timeouts.

External amoCRM/SMS/payment outage should not hang DentalFlow forever.

No timeout is just optimism with extra latency.

---

## Retries

Retries should be controlled.

Rules:

- retry safe operations;
- use backoff;
- limit attempts;
- avoid duplicates;
- do not retry auth errors forever;
- log safe status.

---

## Circuit breaker

Future architecture may need circuit breaker for external services.

If provider fails repeatedly:

- pause sync;
- mark status;
- retry later;
- keep core CRM working.

Not needed in MVP, but useful for production.

---

## API consistency

All modules should follow consistent API patterns.

Bad:

```text
patients return {data}
appointments return raw array
payments return {success}
documents throw HTML
```

Good:

```text
consistent success and error shape
```

Consistency saves time. Naturally, humans often discover this after building пять formats.

---

## Module boundaries

Backend modules should not collapse into one giant service.

Separate domains:

```text
patients
appointments
medical
treatmentPlans
documents
finance
warehouse
integrations
billing
users
tenants
reports
```

Modules can communicate through services and shared domain models.

---

## Medical boundary

Medical domain must not leak into sales integrations.

Backend should enforce:

```text
no medical data to amoCRM
```

Mapper and integration services must be allowlisted.

---

## Finance boundary

Finance domain separated from medical domain.

Payment does not complete treatment.

Backend should prevent:

```text
payment.created → finding.completed
```

unless a controlled workflow explicitly requires separate doctor action.

---

## Schedule boundary

Appointment does not complete service.

Backend should prevent:

```text
appointment.completed → completedService.created automatically
```

unless future workflow explicitly designed.

---

## Document boundary

PatientPreview is not MedicalDocument.

Backend should prevent:

```text
preview opened → document generated
```

Document generation must be explicit and snapshot-based.

---

## Billing boundary

Platform billing is not clinic finance.

Backend should separate:

```text
clinic payments from patients
```

and:

```text
tenant subscription payments to DentalFlow
```

Do not mix them in one model.

---

## Integration boundary

External integrations should never be source of truth for medical data.

amoCRM can update sales status.
DentalFlow owns medical reality.

---

## Multi-tenant boundary

Every tenant-owned operation must be tenant-scoped.

No global patient APIs for clinic users.
No global appointment search for clinic users.
No global reports for clinic users.

---

## Platform API

Platform API is for platform roles.

Examples:

```text
GET /api/platform/tenants
POST /api/platform/tenants
POST /api/platform/tenants/:tenantId/suspend
GET /api/platform/billing
GET /api/platform/audit
```

Platform API must have platform permissions.
Clinic roles should not access platform API.

---

## Tenant API

Tenant API is for clinic operations.

Examples:

```text
/api/tenants/:tenantId/patients
/api/tenants/:tenantId/appointments
/api/tenants/:tenantId/treatment-plans
/api/tenants/:tenantId/documents
/api/tenants/:tenantId/payments
```

Tenant API requires tenant membership.

---

## Public API

Public API may exist for:

- online booking;
- public forms;
- payment links;
- document confirmation.

Public API must be highly restricted.

Use scoped tokens, expiration, rate limiting and validation.
No sensitive data exposure.

---

## Webhooks API

Webhook API is external-provider-facing.

Examples:

- amoCRM webhooks;
- payment provider webhooks;
- SMS delivery callbacks.

Webhook API must validate provider authenticity and tenant mapping.
Do not trust external payload.

---

## Internal API

Internal API may support jobs/workers.

Should not be publicly exposed.
Use internal auth or network restrictions.

---

## OpenAPI / API docs

Future backend should have API documentation.

Possible approach:

- OpenAPI spec;
- route docs;
- DTO docs;
- error codes docs.

Do not let API behavior exist only in someone’s memory.
Memory, как уже продемонстрировано несколькими PR-приключениями, — это подозрительный storage engine.

---

## Testing backend

Backend tests should include:

- unit tests;
- service tests;
- route tests;
- permission tests;
- tenant isolation tests;
- validation tests;
- integration client tests with mocks;
- migration tests where needed.

---

## Tenant isolation tests

Example:

```text
User A belongs to Tenant A
Patient P belongs to Tenant B

User A requests P
→ denied / not found
```

This is critical. No SaaS without tenant isolation tests.

---

## Permission tests

Examples:

```text
receptionist cannot update dental chart
cashier cannot update findings
doctor cannot configure amoCRM
sales_manager cannot view clinical notes
clinic_owner can manage clinic users

platform_admin cannot silently edit medical data without support access rules
```

---

## Validation tests

Examples:

- invalid toothNumber rejected;
- appointment conflict rejected;
- invalid status transition rejected;
- negative payment rejected;
- cross-tenant reference rejected;
- missing required field rejected.

---

## Integration tests with mocks

External integrations should use mocks/fakes in automated tests.

Do not hit real amoCRM in normal CI.
Do not use real patient data.

---

## CI requirements

Future CI should run:

```text
npm run lint
npm run build
backend syntax check
backend tests
frontend tests
secret scan
forbidden direct integration checks
```

CI should fail on obvious unsafe patterns.

---

## Secret scan

Search examples:

```text
rg -n "access_token|refresh_token|client_secret|clientSecret|authorization_code|Bearer|github_pat|DATABASE_URL|PRIVATE_KEY" .
```

Docs may mention these terms as examples.
Real-looking secrets must stop the PR.

---

## Forbidden frontend integration check

Search:

```text
rg -n "amocrm|amoCRM|oauth2|access_token|refresh_token" src
```

Frontend may contain UI labels/types.
Frontend must not contain direct provider API calls or tokens.

---

## Forbidden medical sync check

Search implementation files:

```text
rg -n "toothNumber|DentalFinding|dentalChart|riskDescription|diagnosis|MedicalDocument" backend/src src/integrations
```

If found in outgoing integration payload, stop review.

---

## Deployment architecture

Production deployment will be separate task.

Backend must eventually support:

- environment config;
- database;
- migrations;
- logs;
- health checks;
- secure secrets;
- scaling;
- background jobs;
- backups.

Do not assume local dev server is production.

---

## Scaling

Scaling concerns:

- stateless API where possible;
- shared token/state storage;
- database connection pooling;
- queue workers;
- rate limit store;
- file storage;
- background jobs.

In-memory state does not work well across multiple instances.

---

## In-memory limitations

In-memory stores are dev-only for:

- OAuth state;
- tokens;
- jobs;
- sessions;
- rate limits.

Production needs persistent/shared storage.
In-memory works until restart. Production enjoys restarting at the worst possible moment, because comedy has timing.

---

## Backup

Backend/database must support backup strategy.

Backups should be protected.
Backups may contain all tenant data.
Access to backups must be restricted.

---

## Restore

Restore must be controlled.

Tenant-level restore is complex.
Full restore can affect all tenants.
Do not implement restore casually.

---

## Data retention

Retention policy needed for:

- tenants;
- patients;
- audit logs;
- documents;
- sync logs;
- exports;
- backups;
- deleted/archived data.

Hard delete is not default.

---

## Soft delete

Important entities should prefer soft delete/archive.

Examples:

```text
patients
appointments
findings
treatment plans
documents
payments
tenants
users
```

Hard delete requires separate procedure.

---

## API security headers

Future backend should consider security headers.

Examples:

- content security policy;
- no-sniff;
- frame options;
- referrer policy.

Exact config depends on deployment.

---

## Request body limits

Backend should limit request body size.

Especially:

- imports;
- uploads;
- documents;
- webhook payloads.

No limit means someone eventually sends a novel as JSON. Humans do enjoy testing boundaries.

---

## File upload limits

File upload needs:

- size limit;
- type allowlist;
- storage isolation;
- malware scan if feasible;
- tenantId;
- permission;
- audit.

No upload without rules.

---

## Public booking API

Future public booking API must:

- identify tenant;
- check tenant active;
- check feature enabled;
- validate slot;
- rate limit;
- collect minimal personal data;
- not expose full schedule;
- create request/appointment safely.

---

## Payment API

Payment provider integration must be separate.

Rules:

- secrets backend-side;
- webhook validation;
- no card data storage unless compliant/provider-managed;
- platform billing separate from clinic finance;
- safe logs;
- audit.

Do not mix payment provider casually into schedule or treatment task.

---

## Billing API

Platform billing API must be separate from clinic finance API.

Platform billing:

```text
tenant subscription
tariff
invoice to clinic
access status
```

Clinic finance:

```text
patient payments
treatment plan amounts
debts
refunds
```

Do not mix.

---

## Role of backend in SaaS access

Backend must enforce ability to disable tenant for non-payment.

If tenant suspended:

- deny selected write operations;
- pause integrations;
- disable public booking;
- keep data;
- allow owner billing resolution;
- show safe message.

Frontend-only disable is not enough.

---

## Report requirements for backend tasks

Every backend/API task report must include:

- changed files;
- routes added/changed;
- tenant impact;
- storage impact;
- sensitive data impact;
- auth/permission impact;
- validation impact;
- migration impact;
- tests/checks;
- what was not implemented;
- risks.

---

## What backend tasks must not hide

Reports must honestly state limitations.

Bad:

```text
backend completed
```

Good:

```text
backend skeleton created;
auth/database/tenant enforcement not implemented yet
```

Backend honesty prevents future hallucinated architecture. A rare but beautiful thing.

---

## MVP backend path

Safe backend path:

```text
1. Backend architecture docs
2. API skeleton
3. Health/config
4. Shared response/error utilities
5. Auth architecture
6. Tenant model
7. Permission model
8. Database schema
9. Patient API
10. Appointment API
11. Medical domain API
12. Treatment plan API
13. Document API
14. Integration API
15. Billing/access API
16. Tests and CI
```

Do not jump to advanced integrations before core auth/tenant/storage.

---

## What can remain prototype

Temporarily prototype:

- localStorage data;
- demo tenant;
- disabled UI;
- mock backend;
- dev-only token store;
- manual checks;
- placeholder roles.

But reports must say prototype.

---

## What cannot remain prototype for SaaS

For commercial SaaS, cannot remain prototype:

- tenant isolation;
- auth;
- permissions;
- production database;
- backups;
- secrets storage;
- payment/billing access;
- medical data storage;
- documents;
- audit;
- integration tokens.

These are not “polish”. These are foundation.

---

## Что нельзя делать

Нельзя:

- считать frontend source of truth для production;
- считать localStorage database;
- доверять role from browser;
- доверять tenantId from URL без backend check;
- отдавать raw database objects;
- строить API без tenant context;
- делать global patients for clinic users;
- делать appointment/payment/medical updates без validation;
- хранить secrets в Git;
- хранить tokens во frontend;
- логировать secrets;
- возвращать stack traces пользователю;
- делать backend God file;
- смешивать platform billing and clinic finance;
- смешивать appointment and completed service;
- смешивать payment and treatment completion;
- делать direct frontend calls to external providers;
- добавлять dependencies without reason;
- делать destructive migrations without backup/report.

---

## Правила для ИИ-задач

Если задача касается backend, API, routes, storage, database, auth, roles, permissions, tenants, integrations, billing, files, reports or migrations, ИИ должен проверить:

- tenant impact указан;
- storage impact указан;
- sensitive data impact указан;
- auth/permission impact указан;
- backend is security boundary;
- frontend is not trusted;
- tenant guard exists or future-noted;
- entity ownership considered;
- validation considered;
- DTO safe;
- errors safe;
- logs safe;
- secrets not exposed;
- package changes justified;
- migrations not hidden;
- report created.

---

## Acceptance для backend/API задач

Backend/API задача считается корректной, если:

- scope ограничен;
- routes documented or implemented clearly;
- tenant context considered;
- permissions considered;
- subscription/feature entitlement considered if relevant;
- validation included;
- DTO safe;
- no raw secrets;
- no raw database object leakage;
- no frontend-only security;
- no destructive data change without explicit approval;
- tests/checks described;
- limitations documented;
- report created.

---

## Итог

Backend/API architecture — это фундамент DentalFlow как SaaS CRM.

Главная backend цепочка:

```text
Request
→ Auth
→ Tenant Guard
→ Permission Guard
→ Feature / Subscription Guard
→ Validation
→ Service
→ Repository / Database
→ Safe DTO
→ Audit / Logs
→ Response
```

Главная SaaS-мысль:

```text
backend enforced tenant isolation
```

Главная security-мысль:

```text
frontend не является доверенной системой
```

Главная product-мысль:

```text
DentalFlow не сможет продаваться другим клиникам,
если backend не защищает данные, роли, tenant, billing and integrations
```

Frontend делает систему удобной.
Backend делает систему настоящей.

Без backend DentalFlow останется красивым прототипом.

С backend DentalFlow может стать SaaS-платформой, которую можно развивать, продавать и не бояться, что один пациент случайно появится в чужой клинике просто потому, что кто-то поверил localStorage.
