# 03_MULTI_TENANT_ARCHITECTURE_RULES.md

## Назначение документа

Этот документ описывает правила будущей multi-tenant архитектуры DentalFlow CRM.

DentalFlow создаётся как SaaS-платформа для нескольких стоматологических клиник, а не как локальная CRM для одной организации.

Главная цель multi-tenant архитектуры:

**каждая клиника должна работать в одной общей платформе, но видеть только свои данные.**

Если это не заложить заранее, позже придётся переписывать почти всю систему. Люди почему-то называют это “масштабированием”, хотя чаще это просто раскопки собственного технического долга.

---

## Главный принцип

В DentalFlow каждая клиника, компания или сеть клиник должна быть отдельным tenant.

Один tenant — это один независимый клиент платформы.

Возможные будущие названия сущности:

```text
tenant
organization
clinic
company
```

Пока финальное название не выбрано, в документации используется:

```text
tenant
```

А технический идентификатор:

```text
tenantId
```

Главное правило:

**все данные конкретной клиники должны быть связаны с tenantId и проверяться через backend.**

---

## Что такое tenant

Tenant — это отдельный клиент DentalFlow как SaaS-платформы.

Tenant может быть:

- одной стоматологической клиникой;
- стоматологией с несколькими кабинетами;
- небольшой сетью стоматологий;
- компанией, которая управляет несколькими филиалами;
- demo-клиникой для тестирования;
- trial-клиникой для продажи.

Tenant имеет:

- своё название;
- свой статус;
- своих пользователей;
- своих пациентов;
- своё расписание;
- своих врачей;
- свои документы;
- свои финансы;
- свои интеграции;
- свои настройки;
- свою подписку;
- свои ограничения тарифа.

Tenant не должен видеть или использовать данные другого tenant.

---

## Tenant не равен пользователю

Tenant — это клиника или компания.

User — это человек.

Один user может иметь доступ к нескольким tenant.

Пример:

```text
User A
→ Tenant 1: clinic_owner
→ Tenant 2: doctor
→ Tenant 3: viewer
```

Поэтому нельзя строить систему так, будто один пользователь всегда принадлежит только одной клинике.

Нужна связка:

```text
User
Tenant
TenantUser
Role
Permission
```

---

## Tenant не равен филиалу

Tenant и branch — разные сущности.

Tenant — это клиент платформы.

Branch — это филиал внутри tenant.

Пример:

```text
Tenant: Smile Dental Group
Branches:
- Smile Dental Center 1
- Smile Dental Center 2
- Smile Dental Center 3
```

На раннем этапе можно не реализовывать branch.

Но архитектура не должна путать tenant и branch.

Если потом появятся филиалы, они должны быть внутри tenant, а не отдельными случайными псевдо-tenant без правил.

---

## Tenant не равен amoCRM account

amoCRM account может быть связан с tenant, но не является tenant.

Один tenant может иметь:

- одно подключение amoCRM;
- несколько будущих интеграций;
- свои pipeline mapping;
- свои custom fields mapping;
- свои токены;
- свои sync logs.

Правило:

```text
AmoCrmConnection belongs to tenantId
```

Токены amoCRM одного tenant нельзя использовать для другого tenant.

---

## Tenant не равен подписке

Tenant — это клиент платформы.

Subscription — это подписка tenant.

Один tenant может менять подписки, тарифы и статусы доступа.

Пример:

```text
Tenant A
→ Subscription: active / Pro

Tenant B
→ Subscription: suspended / Basic
```

Tenant не должен удаляться автоматически при завершении подписки.

Подписка управляет доступом, а не существованием данных.

---

## Базовая будущая модель tenant

Минимальная будущая структура tenant:

```text
Tenant
- id
- name
- status
- subscriptionStatus
- accessStatus
- tariffPlanId
- timezone
- locale
- createdAt
- updatedAt
- suspendedAt
- suspendedReason
- cancelledAt
```

Не все поля должны быть реализованы сразу.

Но архитектура должна ожидать, что tenant станет центральной сущностью SaaS.

---

## Статусы tenant

Tenant может иметь статусы.

Примеры:

```text
draft
trial
active
overdue
suspended
cancelled
archived
```

### draft

Tenant создан, но ещё не активирован.

### trial

Tenant находится в тестовом периоде.

### active

Tenant может нормально работать.

### overdue

Есть просрочка, но доступ может быть временно открыт.

### suspended

Доступ ограничен или заблокирован.

### cancelled

Подписка прекращена.

### archived

Tenant больше не работает, но данные сохранены по retention policy.

---

## Главное правило isolation

Tenant isolation означает:

```text
Tenant A cannot access Tenant B data.
Tenant B cannot access Tenant A data.
```

Это касается:

- frontend;
- backend;
- database;
- files;
- documents;
- integrations;
- search;
- reports;
- exports;
- backups;
- sync logs;
- audit logs;
- billing;
- support access.

Tenant isolation нельзя реализовывать только визуально.

Скрыть кнопку во frontend — не защита.

Backend должен реально запрещать доступ.

---

## Данные, которые должны быть tenant-scoped

В production почти все бизнес-сущности должны иметь tenant context.

Примеры:

```text
Patient
Doctor
Appointment
Cabinet
ChiefComplaint
DentalChart
ToothState
DentalFinding
TreatmentPlan
TreatmentStage
PatientPreview
MedicalDocument
CompletedService
Payment
ClinicFinanceRecord
WarehouseItem
StockMovement
DocumentTemplate
IntegrationConnection
AmoCrmConnection
IntegrationSyncLog
AuditLog
UserTenantRole
Notification
Report
```

Если сущность принадлежит клинике, она должна быть связана с tenantId.

---

## Platform-level сущности

Некоторые сущности существуют на уровне платформы.

Примеры:

```text
Tenant
PlatformUser
TariffPlan
Subscription
PlatformBillingEvent
PlatformAuditLog
GlobalFeatureFlag
SystemSetting
```

Но даже platform-level сущности часто связаны с tenant.

Пример:

```text
Subscription → tenantId
BillingEvent → tenantId
```

---

## Что нельзя делать глобальным

Нельзя делать глобальными:

- patients;
- appointments;
- doctors;
- dental charts;
- findings;
- treatment plans;
- medical documents;
- payments;
- warehouse items;
- amoCRM tokens;
- sync logs;
- document templates;
- clinic settings;
- reports.

Плохой вариант:

```text
patients = [...]
```

Правильный production-вариант:

```text
patients where tenantId = currentTenantId
```

---

## tenantId как обязательный будущий ключ

В production-модели tenantId должен быть обязательным для tenant-owned данных.

Пример:

```text
Patient
- id
- tenantId
- fullName
- phone
```

Пример:

```text
Appointment
- id
- tenantId
- patientId
- doctorId
- startAt
- status
```

Пример:

```text
TreatmentPlan
- id
- tenantId
- patientId
- status
- stages
```

Нельзя хранить patientId без tenant context и надеяться, что ID будет уникальным во всей вселенной. Надежда снова плохая база данных.

---

## Entity ownership

Backend должен проверять принадлежность сущности tenant.

Пример проверки:

```text
requested tenantId = Tenant A
patientId = P1
patient P1.tenantId must be Tenant A
```

Если patient принадлежит Tenant B, доступ должен быть запрещён.

Даже если пользователь знает ID чужого пациента.

---

## Cross-tenant reference запрещён

Нельзя допускать связи между сущностями разных tenant.

Плохой сценарий:

```text
TreatmentPlan.tenantId = Tenant A
TreatmentPlan.patientId → Patient from Tenant B
```

Такой сценарий должен быть невозможен или выявляться проверками.

Правильная логика:

```text
TreatmentPlan.tenantId must equal Patient.tenantId
```

То же касается:

- appointment → patient;
- finding → patient;
- document → patient;
- payment → patient;
- stock movement → warehouse item;
- sync log → integration connection.

---

## Backend enforcement

Tenant isolation должен enforced на backend.

Frontend может показывать текущий tenant и фильтровать данные.

Но backend обязан проверять:

```text
current user
current tenant
tenant membership
permission
subscription/access status
entity ownership
```

Пример правильного API:

```text
GET /api/tenants/:tenantId/patients
```

Backend проверяет:

```text
user belongs to tenantId
user has patients.view
tenant is accessible
```

---

## Нельзя доверять frontend tenantId

Frontend может передать tenantId.

Но backend не должен слепо верить frontend.

Проверка должна быть backend-side:

```text
currentUser has membership in tenantId
```

Если пользователь вручную поменяет tenantId в URL, backend всё равно должен запретить доступ.

Плохой вариант:

```text
frontend hides other tenant
backend returns whatever tenantId was requested
```

Правильный вариант:

```text
backend validates tenant membership and permission
```

---

## API route pattern

Будущие tenant-scoped endpoints должны иметь tenant context.

Примеры:

```text
GET    /api/tenants/:tenantId/patients
POST   /api/tenants/:tenantId/patients
GET    /api/tenants/:tenantId/patients/:patientId
PUT    /api/tenants/:tenantId/patients/:patientId

GET    /api/tenants/:tenantId/appointments
POST   /api/tenants/:tenantId/appointments

GET    /api/tenants/:tenantId/treatment-plans
POST   /api/tenants/:tenantId/treatment-plans

GET    /api/tenants/:tenantId/integrations/amocrm/status
POST   /api/tenants/:tenantId/integrations/amocrm/connect
```

Platform endpoints должны быть отдельно:

```text
GET  /api/platform/tenants
POST /api/platform/tenants
POST /api/platform/tenants/:tenantId/suspend
POST /api/platform/tenants/:tenantId/activate
```

---

## Current prototype exception

Сейчас DentalFlow может быть frontend/localStorage-прототипом.

В прототипе tenantId может отсутствовать или быть условным.

Это допустимо временно.

Но новые решения не должны блокировать будущий переход к tenant-aware backend.

Если добавляется новая сущность, нужно думать:

```text
К какому tenant она будет принадлежать в production?
```

Даже если сейчас поле tenantId не добавляется.

---

## Demo tenant

Для прототипа можно использовать будущую идею demo tenant.

Пример:

```text
tenantId = "demo-tenant"
```

Demo tenant может использоваться для:

- тестовых пациентов;
- демо-данных;
- локальной разработки;
- презентаций.

Но demo data не должны смешиваться с production data.

---

## localStorage и tenant

localStorage не подходит для production tenant isolation.

На раннем этапе он может хранить прототипные данные.

Но в production source of truth должен быть backend/database.

Плохой production-вариант:

```text
localStorage.patients
```

Правильный production-вариант:

```text
backend database
patients filtered by tenantId
backend permission checks
```

Если в localStorage когда-нибудь появится tenantId для прототипа, это не должно считаться настоящей защитой.

---

## Database strategy

Production database должна поддерживать tenant isolation.

Минимальные требования:

- tenantId у tenant-owned таблиц;
- индексы по tenantId;
- foreign keys;
- проверки связей;
- transactional updates;
- audit logs;
- backups;
- restore strategy.

Примеры индексов:

```text
tenantId
tenantId + patientId
tenantId + appointmentDate
tenantId + status
tenantId + createdAt
```

Без tenantId-индексов SaaS будет работать бодро ровно до первого десятка реальных клиник. Потом все будут смотреть на spinner и делать вид, что это “нагрузочное тестирование”.

---

## Row-level security

В будущем можно рассмотреть row-level security на уровне database.

Например, PostgreSQL RLS.

Но RLS не заменяет backend checks.

Правильная защита должна быть многослойной:

```text
backend guard
database constraints
audit logs
safe API responses
```

Не реализовывать RLS без отдельной архитектурной задачи.

---

## Backend tenant guard

В будущем backend должен иметь tenant guard.

Пример:

```text
requireTenantAccess(userId, tenantId)
```

Он должен проверять:

- tenant exists;
- user exists;
- user membership in tenant;
- membership status active;
- tenant status;
- subscription/access status;
- permission if needed.

---

## Permission + tenant

Permission всегда должна проверяться в tenant context.

Плохой вариант:

```text
user has patients.view globally
```

Правильный вариант:

```text
user has patients.view in tenantId
```

Один и тот же user может иметь разные права в разных tenant.

---

## Subscription + tenant

Доступ к действиям зависит не только от роли.

Также важен статус tenant/subscription.

Пример:

```text
user has patients.create
tenant is suspended
→ denied
```

Проверка доступа должна учитывать:

```text
membership
permission
subscription status
feature entitlement
entity ownership
```

---

## Feature entitlement + tenant

Тариф tenant может ограничивать функции.

Пример:

```text
Tenant A / Basic:
- patients: enabled
- appointments: enabled
- amocrm_integration: disabled

Tenant B / Pro:
- patients: enabled
- appointments: enabled
- amocrm_integration: enabled
```

Backend должен проверять feature entitlement.

Frontend может показывать disabled state, но не должен быть единственной защитой.

---

## Tenant settings

У каждого tenant должны быть свои настройки.

Примеры:

```text
clinic name
timezone
locale
currency
working hours
doctors
cabinets
services
document templates
integration settings
billing contact
notification settings
```

Настройки одной клиники не должны влиять на другую клинику.

---

## Tenant timezone

Tenant должен иметь timezone.

Для Казахстана часто актуально:

```text
Asia/Almaty
```

Но SaaS может расширяться.

Поэтому время appointments, reminders, reports и billing periods должны учитывать timezone tenant.

В базе timestamps лучше хранить в UTC, а отображать по tenant timezone.

---

## Tenant locale

В будущем tenant может иметь locale.

Примеры:

```text
ru
kk
en
```

Сейчас основной язык интерфейса может быть русский.

Но architecture не должна мешать будущей локализации.

---

## Tenant currency

Финансы клиники должны учитывать currency.

Для Казахстана базовая валюта:

```text
KZT
```

Но architecture может учитывать future multi-currency.

Важное правило:

currency tenant для clinic finance не должна смешиваться с platform billing currency без явной модели.

---

## Tenant document templates

Шаблоны документов должны быть tenant-scoped.

Каждая клиника может иметь:

- своё название;
- свои реквизиты;
- свой логотип;
- свои шаблоны документов;
- свои тексты согласий;
- свои подписи;
- свои контакты.

Нельзя использовать один глобальный шаблон для всех клиник без возможности tenant overrides.

---

## Tenant integrations

Интеграции должны быть tenant-scoped.

Примеры:

```text
AmoCrmConnection
WhatsAppConnection
SmsConnection
EmailConnection
TelephonyConnection
PaymentProviderConnection
```

Каждая connection должна иметь:

```text
tenantId
provider
status
createdAt
updatedAt
```

Secrets должны храниться server-side.

---

## amoCRM tenant isolation

amoCRM особенно важно изолировать.

Правила:

- каждый tenant имеет своё подключение amoCRM;
- токены amoCRM принадлежат tenant;
- pipeline mapping принадлежит tenant;
- custom field mapping принадлежит tenant;
- sync logs принадлежат tenant;
- external IDs хранятся с tenant context;
- suspended tenant не должен запускать sync.

Нельзя использовать один amoCRM token для всех клиник.

---

## Sync logs и tenant

Integration sync logs должны быть tenant-scoped.

Пример:

```text
IntegrationSyncLog
- id
- tenantId
- provider
- entityType
- entityId
- status
- safeMessage
- createdAt
```

Sync logs не должны раскрывать secrets.

Sync logs не должны содержать raw medical data.

---

## Audit logs и tenant

Audit logs должны быть tenant-aware.

Пример:

```text
AuditLog
- id
- tenantId
- userId
- action
- entityType
- entityId
- createdAt
- details
```

Для platform-level событий tenantId может быть null или связан с affected tenant.

Пример:

```text
tenant.suspended
→ affected tenantId
→ performed by platform_owner
```

---

## Support access и tenant

Support access должен быть scoped.

Support не должен видеть все tenant всегда.

Будущая схема:

```text
support user
→ temporary access
→ specific tenant
→ reason
→ expiresAt
→ audit log
```

Support access должен быть видимым и логируемым.

---

## Platform admin и tenant access

Platform admin может видеть список tenant и технический статус.

Но это не означает автоматический полный medical access.

Медицинский доступ к tenant должен быть:

- ограниченным;
- обоснованным;
- логируемым;
- временным, если это support use case.

Platform admin не должен быть скрытым супер-врачом всех клиник.

---

## Tenant switcher

Если пользователь имеет доступ к нескольким tenant, frontend должен иметь tenant switcher.

Tenant switcher должен показывать:

- текущую клинику;
- роль пользователя;
- возможно статус доступа;
- возможно филиал в будущем.

При переключении tenant:

- старые tenant данные должны исчезать;
- frontend должен сбрасывать tenant-scoped state;
- backend должен проверять новый tenant;
- запросы должны идти с новым tenant context.

---

## Stale data risk

После переключения tenant нельзя оставлять старые данные на экране.

Плохой сценарий:

```text
User opens Tenant A patient
switches to Tenant B
screen still shows Tenant A patient
```

Это cross-tenant leak.

UI должен либо очистить экран, либо перезагрузить данные.

---

## Search и tenant

Поиск должен быть tenant-scoped.

Плохой вариант:

```text
search patients by phone across all tenants for clinic user
```

Правильный вариант:

```text
search patients by phone within current tenant
```

Platform-level search должен быть доступен только platform roles и только по правилам.

---

## Reports и tenant

Отчёты должны быть tenant-scoped.

Clinic owner видит отчёты своей клиники.

Platform owner может видеть platform-level отчёты, но медицинские данные должны быть ограничены.

Плохой вариант:

```text
clinic_owner sees revenue of all tenants
```

Правильный вариант:

```text
clinic_owner sees own tenant reports
platform_owner sees platform billing/revenue reports
```

---

## Export и tenant

Export данных должен быть tenant-scoped.

Клиника может экспортировать только свои данные.

Export должен учитывать:

- роль;
- permission;
- tenantId;
- sensitive data;
- audit log;
- retention policy.

Обычный сотрудник не должен выгружать всю базу пациентов без разрешения.

---

## Import и tenant

Import должен быть tenant-scoped.

При импорте нужно указывать tenant context.

Нельзя импортировать данные в глобальную таблицу без tenantId.

Правила:

- validate tenant membership;
- validate import permission;
- attach tenantId to imported records;
- prevent cross-tenant references;
- log import result.

---

## Files и tenant

Файлы должны быть tenant-scoped.

Примеры файлов:

- PDF;
- scans;
- images;
- documents;
- signed forms;
- attachments.

File metadata должна содержать:

```text
tenantId
patientId
documentId
storageKey
createdAt
createdBy
```

Файлы нельзя отдавать без backend permission check.

---

## Documents и tenant

MedicalDocument должен принадлежать tenant.

Пример:

```text
MedicalDocument
- id
- tenantId
- patientId
- documentType
- snapshot
- createdAt
```

Документ одной клиники не должен быть доступен другой клинике.

Document templates тоже tenant-scoped.

---

## Payments и tenant

Payments — это финансы клиники.

Payment должен иметь tenantId.

Payment не должен смешиваться с platform billing.

Плохой вариант:

```text
one global payments table without tenantId
```

Правильный вариант:

```text
payments filtered by tenantId
```

Clinic finance tenant A не должен быть виден tenant B.

---

## Platform billing и tenant

Platform billing связан с tenant, но не является clinic finance.

Пример:

```text
Subscription
- tenantId
- tariffPlanId
- status

Invoice
- tenantId
- amount
- currency
- status
```

Эти данные видят platform roles и clinic_owner своей клиники.

Обычные сотрудники клиники не обязаны видеть задолженность tenant перед DentalFlow.

---

## Warehouse и tenant

Warehouse items должны быть tenant-scoped.

Материалы одной клиники не должны отображаться в другой.

Stock movements должны иметь tenantId.

В будущем branch-level склад может быть отдельной задачей.

На раннем этапе достаточно tenant-level warehouse.

---

## Notifications и tenant

Уведомления должны быть tenant-scoped.

Примеры:

- appointment reminder;
- treatment plan follow-up;
- billing warning;
- integration error;
- no-show follow-up.

Нельзя отправлять уведомления от имени неправильного tenant.

Шаблоны уведомлений тоже должны быть tenant-scoped.

---

## Public booking и tenant

Если появится online booking, public link должен быть tenant-scoped.

Пример:

```text
/booking/:tenantSlug
```

или другой безопасный вариант.

Он должен учитывать:

- active tenant;
- working hours;
- doctors;
- services;
- subscription status;
- feature entitlement;
- public booking settings.

Suspended tenant может иметь disabled booking.

---

## Tenant slug

В будущем tenant может иметь slug.

Пример:

```text
altynsaka
smile-dental
```

Slug может использоваться для public booking или tenant selection.

Slug не должен быть единственным security mechanism.

Backend всё равно должен проверять tenant permissions.

---

## Unique constraints

В production нужны unique constraints с tenant context.

Примеры:

```text
tenantId + patient phone
tenantId + doctor internal number
tenantId + document template code
tenantId + externalContactId
tenantId + externalLeadId
```

Не все constraints нужны сразу.

Но важно понимать:

```text
phone may repeat across different tenants
```

Пациент с одним номером может быть в двух разных клиниках.

---

## External IDs и tenant

External IDs из amoCRM должны храниться с tenant context.

Плохой вариант:

```text
externalContactId unique globally
```

Лучше:

```text
tenantId + provider + externalContactId
```

Один и тот же external ID теоретически может встретиться в разных amoCRM accounts.

Tenant context обязателен.

---

## Cache и tenant

Любой cache должен учитывать tenant.

Плохой вариант:

```text
cacheKey = patients
```

Правильный вариант:

```text
cacheKey = tenantId + patients
```

Если cache не tenant-aware, он может отдать данные чужой клиники.

Это не optimization, это утечка с ускорением.

---

## Frontend state и tenant

Frontend state должен быть tenant-aware.

При смене tenant нужно очищать:

- selected patient;
- patient list;
- appointments;
- treatment plans;
- documents;
- search results;
- sync status;
- reports.

Нельзя оставлять данные прошлого tenant.

---

## URL и tenant

В будущем URL может включать tenant context.

Пример:

```text
/app/:tenantId/patients
```

или tenant хранится в session/current context.

Оба варианта возможны.

Но backend всё равно должен проверять access.

URL не является security boundary.

---

## Error handling

Ошибки tenant access должны быть безопасными.

Плохое сообщение:

```text
Patient exists but belongs to another tenant.
```

Лучше:

```text
Not found
```

или:

```text
Access denied
```

Не нужно подтверждать существование чужих данных.

---

## Data deletion и tenant

Удаление tenant — отдельная сложная процедура.

Нельзя автоматически hard delete tenant при cancellation или suspended.

Возможные статусы:

```text
cancelled
archived
deleted_pending
deleted
```

Hard delete должен требовать:

- owner decision;
- retention policy;
- export option;
- audit log;
- backup consideration;
- legal review if needed.

---

## Backup и tenant

Backups должны учитывать tenant isolation.

Production backup может быть всей database.

Но restore может потребовать tenant-level recovery.

Нужно понимать:

- как восстановить одного tenant;
- как не затереть данные других tenant;
- как логировать restore;
- как защитить backup.

Не реализовывать без отдельной задачи.

---

## Restore и tenant

Restore может быть:

- full database restore;
- tenant restore;
- entity restore;
- file restore.

Tenant restore сложный, потому что нужно восстановить связанные сущности:

- patients;
- appointments;
- findings;
- treatment plans;
- documents;
- payments;
- files;
- audit logs.

Это будущая отдельная тема.

---

## Migration to tenant-aware model

Переход от localStorage-прототипа к tenant-aware backend должен быть поэтапным.

Возможный путь:

```text
1. Document current storage.
2. Define tenant model.
3. Define user/tenant membership.
4. Define database schema.
5. Add tenantId to entities in backend.
6. Add migration/export from localStorage.
7. Import demo data as demo tenant.
8. Switch frontend to API.
9. Remove localStorage as source of truth.
```

Нельзя делать всё одним PR.

---

## Migration safety

При добавлении tenantId нельзя ломать старые данные.

Нужны:

- safe defaults;
- migration report;
- backup;
- validation;
- ID mapping;
- broken reference detection.

Для demo/prototype можно использовать:

```text
tenantId = "demo-tenant"
```

Но production migration требует отдельной задачи.

---

## No cross-tenant analytics by accident

Analytics и reports не должны случайно смешивать tenant.

Clinic-level reports:

```text
tenant-scoped
```

Platform-level reports:

```text
platform-scoped
```

Platform reports могут агрегировать данные, но medical/sensitive details должны быть ограничены.

---

## Aggregated platform analytics

Platform owner может видеть агрегированные показатели.

Примеры:

- number of active tenants;
- subscriptions;
- overdue tenants;
- MRR;
- active users;
- usage metrics;
- integration health.

Но это не означает доступ к full patient medical data всех clinics.

---

## Tenant onboarding

В будущем нужен onboarding tenant.

Шаги могут быть:

```text
create tenant
choose tariff
create clinic owner
configure clinic settings
configure doctors
configure services
optional connect amoCRM
start trial or active subscription
```

Не реализовывать без отдельной задачи.

---

## Tenant offboarding

Offboarding tenant должен быть безопасным.

Шаги могут быть:

```text
cancel subscription
restrict access
offer export
archive tenant
retain data by policy
eventual deletion by procedure
```

Нельзя просто удалить tenant и все данные по кнопке “cancel”.

Ну можно, если цель проекта — стать юридическим фейерверком.

---

## Tenant cloning запрещён без правил

Нельзя копировать tenant целиком без отдельной процедуры.

Опасности:

- medical data leakage;
- patient duplication;
- files exposure;
- integration token leakage;
- billing confusion;
- audit confusion.

Для demo можно создавать seed tenant, но не копировать реальные clinic data без anonymization.

---

## Anonymized demo tenant

Если нужна demo-клиника, лучше использовать вымышленные данные.

Demo tenant не должен содержать реальные пациенты без разрешения и обезличивания.

Demo tenant должен быть явно помечен.

---

## Testing tenant isolation

В будущем нужны тесты tenant isolation.

Сценарии:

```text
User A belongs to Tenant A
User B belongs to Tenant B
Patient P1 belongs to Tenant A
User B cannot access P1
```

Также:

```text
switch tenant
old data disappears
search returns only current tenant data
sync uses current tenant connection
```

---

## Manual QA tenant checklist

При задачах, затрагивающих tenant logic, проверять:

- tenant impact указан;
- entity ownership не нарушен;
- нет глобальных данных без причины;
- нет API без tenant context;
- нет frontend-only защиты;
- нет shared integration token;
- нет cross-tenant report;
- нет stale data after tenant switch;
- no hard delete on suspension.

---

## Что делать сейчас в прототипе

Сейчас не обязательно немедленно внедрять tenantId во все frontend-типы.

Но каждая новая задача должна указывать:

```text
tenant impact: none / future / required now
```

Если задача создаёт новую бизнес-сущность, нужно подумать, будет ли она tenant-scoped.

Если да, report должен это отметить.

---

## Что нельзя делать

Нельзя:

- строить систему только под одну клинику;
- делать пациентов глобальными;
- делать записи глобальными;
- делать планы лечения глобальными;
- делать документы глобальными;
- делать payments глобальными;
- делать amoCRM connection глобальной для всех tenant;
- хранить tokens во frontend;
- доверять tenantId из frontend без backend check;
- использовать один `isAdmin` для platform и tenant;
- смешивать tenant и branch;
- смешивать tenant и subscription;
- смешивать platform billing и clinic finance;
- показывать данные чужого tenant;
- делать search across tenants для обычного clinic user;
- делать export всех tenant обычной clinic role;
- оставлять stale data после tenant switch;
- удалять tenant data за неоплату;
- делать migration без tenant plan.

---

## Правила для ИИ-задач

Если задача касается tenant, SaaS, backend, storage, users, roles, billing, integrations или reports, ИИ должен проверить:

- есть ли tenant impact;
- является ли сущность tenant-scoped;
- не создаётся ли global state без причины;
- не нарушается ли tenant isolation;
- не доверяет ли backend frontend tenantId;
- не смешиваются ли platform roles и clinic roles;
- не смешиваются ли tenant и branch;
- не смешиваются ли platform billing и clinic finance;
- не используются ли общие amoCRM tokens;
- не раскрываются ли medical data platform roles без rules;
- не появляется ли cross-tenant report;
- не ломается ли future database schema.

---

## Acceptance для future tenant задач

Задача, связанная с tenant architecture, считается корректной, если:

- tenant impact указан;
- tenant-owned entities имеют tenant strategy;
- backend enforcement описан или реализован;
- frontend не является единственной защитой;
- entity ownership учтён;
- cross-tenant references запрещены;
- subscription/access status учтён, если relevant;
- integrations tenant-scoped;
- reports tenant-scoped;
- export tenant-scoped;
- audit tenant-aware;
- no data deletion on suspension;
- report создан.

---

## Итог

DentalFlow должна развиваться как multi-tenant SaaS-платформа.

Правильная архитектурная цепочка:

```text
Tenant
→ TenantUser
→ Role / Permission
→ Tenant-owned data
→ Backend tenant guard
→ Entity ownership check
→ Subscription / feature check
→ Safe response
→ Audit log
```

Главная мысль:

```text
каждая клиника работает в общей платформе,
но её данные принадлежат только ей
```

Tenant isolation — это не украшение архитектуры.

Это основа коммерческого SaaS.

Если DentalFlow не сможет безопасно разделять клиники, её нельзя будет продавать другим компаниям.

И тогда вся “SaaS-платформа” превратится в локальный прототип с красивыми словами. А красивые слова, как обычно, плохо фильтруют чужих пациентов из чужого tenant.
