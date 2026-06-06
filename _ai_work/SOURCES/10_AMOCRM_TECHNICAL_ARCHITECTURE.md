# 10_AMOCRM_TECHNICAL_ARCHITECTURE.md

## Назначение документа

Этот документ описывает техническую архитектуру интеграции DentalFlow CRM с amoCRM.

Документ дополняет продуктовые правила интеграции из `09_AMOCRM_INTEGRATION_RULES.md` и фиксирует, как технически должна быть устроена безопасная интеграция:

- backend/proxy как обязательная граница;
- OAuth flow;
- tenant-scoped token storage;
- safe DTO;
- field mapping;
- sync logs;
- webhooks;
- retries;
- rate limits;
- audit;
- security checks;
- production limitations.

Главное правило:

**DentalFlow Frontend не должен обращаться к amoCRM API напрямую.**

Правильная техническая схема:

```text
DentalFlow Frontend
→ DentalFlow Backend / Integration Proxy
→ amoCRM API
```

Если frontend напрямую ходит в amoCRM, значит где-то рядом уже лежат токены, secrets и будущий отчёт “как мы вообще до этого дошли”. История старая, как OAuth, и такая же утомительная.

---

## Главный технический принцип

amoCRM integration должна быть server-side controlled.

Это означает:

- OAuth начинается через backend;
- callback принимает backend;
- token exchange выполняет backend;
- tokens хранятся backend-side;
- refresh выполняется backend-side;
- field mapping применяется backend-side;
- outgoing payload строится backend-side;
- medical fields фильтруются backend-side;
- sync logs пишутся backend-side;
- tenant checks выполняются backend-side;
- frontend получает только safe status and safe actions.

Frontend не должен знать secrets.

Frontend не должен хранить tokens.

Frontend не должен строить final amoCRM payload.

---

## Архитектурная схема

Базовая production-схема:

```text
React / Vite Frontend
→ DentalFlow Backend API
→ Integration Service
→ AmoCrmClient
→ amoCRM API
```

Сопутствующие компоненты:

```text
Tenant Context
Role / Permission Guard
Feature Entitlement Guard
Token Store
Field Mapping Store
Sync Log Store
Audit Log Store
Webhook Handler
Retry / Queue Worker
```

На раннем этапе часть компонентов может быть skeleton or dev-only.

Но production architecture должна вести именно к этой схеме.

---

## Current skeleton context

В проекте уже может существовать backend/proxy skeleton.

Он может включать:

```text
backend/src/server.js
backend/src/config.js
backend/src/routes/amoCrmRoutes.js
backend/src/services/amoCrmClient.js
backend/src/services/amoCrmTokenStore.js
backend/src/services/amoCrmStateStore.js
backend/src/utils/jsonResponse.js
```

Этот skeleton полезен как подготовка.

Но skeleton не равен production integration.

Если используется memory token store, он должен быть явно dev-only.

Если OAuth routes существуют, они не означают real safe sync.

---

## Что является production integration

Production amoCRM integration требует:

- backend auth;
- tenant model;
- tenant membership;
- roles and permissions;
- subscription/feature entitlement;
- persistent token storage;
- encrypted or protected secrets;
- token refresh;
- tenant-scoped field mapping;
- safe DTO mappers;
- sync logs;
- audit logs;
- retry strategy;
- rate limit strategy;
- webhook validation;
- error normalization;
- monitoring;
- security review;
- tests.

Без этого интеграцию нельзя считать production-ready.

---

## Что не является production integration

Не production-ready:

- disabled button;
- mapper preview only;
- OAuth skeleton;
- memory token store;
- manual fetch without token storage;
- direct frontend call;
- hardcoded token;
- hardcoded field IDs;
- no tenant mapping;
- no sync logs;
- no retries;
- no webhook validation;
- no permission checks;
- no audit.

Нельзя продавать skeleton как готовую интеграцию.

Это не “почти готово”. Это “у нас есть форма будущей двери, но замка, стены и здания пока нет”.

---

## Backend/proxy responsibility

Backend/proxy отвечает за:

- создание authorization URL;
- проверку OAuth state;
- обмен authorization code на tokens;
- хранение tokens;
- refresh tokens;
- получение account info;
- хранение tenant connection status;
- создание safe outgoing payload;
- отправку запросов в amoCRM;
- обработку ошибок amoCRM;
- обработку rate limits;
- запись sync logs;
- запись audit events;
- обработку webhooks;
- проверку permissions;
- проверку feature entitlement;
- запрет sync для suspended tenant.

---

## Frontend responsibility

Frontend отвечает за:

- показать статус amoCRM;
- показать safe error;
- инициировать connect через backend;
- открыть authorization URL, если backend вернул его;
- показать callback result, если нужно;
- показать disconnect action;
- показать disabled state по тарифу или правам;
- показать last sync status;
- показать safe sync preview;
- не показывать tokens;
- не отправлять medical data.

Frontend не должен:

- хранить access_token;
- хранить refresh_token;
- хранить client_secret;
- вызывать amoCRM API напрямую;
- строить full amoCRM payload;
- обходить backend permission checks;
- решать tenant access.

---

## Suggested route groups

Будущие backend routes могут быть разделены так:

```text
/api/health
/api/integrations/amocrm/connect
/api/integrations/amocrm/callback
/api/integrations/amocrm/status
/api/integrations/amocrm/disconnect
```

Для production tenant-aware API лучше:

```text
/api/tenants/:tenantId/integrations/amocrm/connect
/api/tenants/:tenantId/integrations/amocrm/callback
/api/tenants/:tenantId/integrations/amocrm/status
/api/tenants/:tenantId/integrations/amocrm/disconnect
/api/tenants/:tenantId/integrations/amocrm/sync-preview
/api/tenants/:tenantId/integrations/amocrm/sync
/api/tenants/:tenantId/integrations/amocrm/logs
```

Точный API будет определён в backend architecture tasks.

---

## Route: connect

Connect route должен инициировать OAuth.

Conceptual request:

```text
POST /api/tenants/:tenantId/integrations/amocrm/connect
```

Backend должен проверить:

- user authenticated;
- user belongs to tenant;
- user has integrations.configure;
- tenant has amocrm feature entitlement;
- tenant not suspended;
- config exists;
- redirect URI valid;
- state created and stored.

Response должен быть safe:

```text
{
  "ok": true,
  "authorizationUrl": "https://..."
}
```

Response не должен содержать client_secret.

---

## Route: callback

Callback route принимает OAuth response.

Conceptual request:

```text
GET /api/tenants/:tenantId/integrations/amocrm/callback?code=...&state=...
```

Backend должен:

- validate state;
- check state expiry;
- ensure state belongs to tenant;
- ensure state belongs to initiating user/session if applicable;
- exchange code server-side;
- store tokens server-side;
- fetch safe account info if needed;
- mark connection connected;
- create audit event;
- redirect to frontend safe result page.

Callback не должен возвращать raw token response.

---

## Route: status

Status route показывает safe status.

Conceptual request:

```text
GET /api/tenants/:tenantId/integrations/amocrm/status
```

Response:

```text
{
  "ok": true,
  "connected": true,
  "status": "connected",
  "accountName": "Example amoCRM account",
  "lastSyncAt": "2026-06-06T10:00:00Z",
  "needsReconnect": false,
  "safeMessage": null
}
```

Response не должен содержать:

```text
access_token
refresh_token
client_secret
authorization_code
raw token response
```

---

## Route: disconnect

Disconnect route отключает integration.

Conceptual request:

```text
POST /api/tenants/:tenantId/integrations/amocrm/disconnect
```

Backend должен проверить:

- user authenticated;
- tenant membership;
- integrations.disconnect or integrations.configure;
- tenant access allowed.

Действия:

- remove or invalidate stored tokens;
- mark connection disconnected;
- pause sync;
- keep safe historical logs;
- create audit event.

Disconnect не удаляет patients, treatment plans, appointments or documents.

---

## Route: sync preview

Sync preview показывает, что будет отправлено.

Conceptual request:

```text
POST /api/tenants/:tenantId/integrations/amocrm/sync-preview
```

Backend должен вернуть safe DTO.

Preview не должен отправлять network request в amoCRM.

Preview должен показать только allowed fields.

Пример:

```text
{
  "fullName": "Иван Иванов",
  "phone": "+7...",
  "source": "instagram",
  "leadStatus": "plan_proposed",
  "plannedAmount": 250000,
  "currency": "KZT",
  "commercialStatus": "patient_thinking"
}
```

Никаких toothNumber, findings, riskDescription.

---

## Route: manual sync

Manual sync запускает safe sync.

Conceptual request:

```text
POST /api/tenants/:tenantId/integrations/amocrm/sync
```

Backend должен проверить:

- user permission integrations.sync;
- tenant feature entitlement;
- tenant not suspended;
- connection connected;
- tokens valid or refreshable;
- field mapping valid;
- payload allowlisted;
- no medical fields.

Manual sync должен писать sync log.

---

## OAuth configuration

Backend config может включать:

```text
AMOCRM_CLIENT_ID
AMOCRM_CLIENT_SECRET
AMOCRM_REDIRECT_URI
AMOCRM_AUTH_BASE_URL
AMOCRM_TOKEN_URL
AMOCRM_API_BASE_URL
```

Реальные значения должны быть в `.env`, не в Git.

В Git допустим только `.env.example` с placeholder values.

---

## `.env.example`

Допустимо:

```text
AMOCRM_CLIENT_ID=replace_me
AMOCRM_CLIENT_SECRET=replace_me
AMOCRM_REDIRECT_URI=http://localhost:4000/api/integrations/amocrm/callback
```

Недопустимо:

```text
AMOCRM_CLIENT_SECRET=real_secret
```

Если реальный secret попал в Git, это security incident.

---

## OAuth authorization URL

Authorization URL должен строиться backend-side.

Он должен включать:

```text
client_id
redirect_uri
response_type=code
state
```

State обязателен.

State должен быть unpredictable.

State должен быть связан с tenant.

---

## OAuth state store

State store должен хранить:

```text
state
tenantId
userId
createdAt
expiresAt
usedAt
redirectAfterSuccess, optional
```

State должен:

- истекать;
- использоваться один раз;
- быть удалён после использования;
- не храниться в frontend как source of truth.

Dev-only in-memory state store допустим для skeleton.

Production требует persistent or shared storage, если backend масштабируется.

---

## State expiry

Рекомендуемый срок жизни state:

```text
10 minutes
```

Если state истёк:

```text
{
  "ok": false,
  "code": "OAUTH_STATE_EXPIRED",
  "message": "Сессия подключения истекла. Повторите подключение."
}
```

Не раскрывать технические детали.

---

## Token exchange

Token exchange выполняется backend-side.

Backend отправляет запрос к amoCRM token endpoint.

Request содержит:

```text
grant_type
client_id
client_secret
code
redirect_uri
```

Response содержит tokens.

Token response нельзя возвращать frontend.

Token response нельзя логировать.

---

## Token response handling

Backend должен извлечь:

```text
access_token
refresh_token
expires_in
token_type
```

И сохранить server-side.

В UI можно вернуть только:

```text
connected: true
status: "connected"
```

или safe redirect.

---

## Token storage model

Production token storage может выглядеть так:

```text
AmoCrmToken
- id
- tenantId
- provider
- accessTokenEncrypted
- refreshTokenEncrypted
- expiresAt
- tokenType
- createdAt
- updatedAt
- lastRefreshedAt
- status
```

Нельзя хранить plaintext tokens без защиты.

Нельзя хранить tokens in localStorage.

---

## Token encryption

Production должен защищать tokens.

Варианты:

- database encryption;
- application-level encryption;
- secret manager;
- managed vault.

Финальное решение будет отдельной security/backend задачей.

В source docs нужно зафиксировать:

```text
tokens protected server-side
```

---

## Memory token store

Memory token store допустим только для dev skeleton.

Ограничения:

- теряется при restart;
- не encrypted;
- не подходит для multi-instance backend;
- не подходит для production;
- не даёт нормальный audit;
- не является SaaS token storage.

Reports должны честно писать:

```text
memory token store is dev-only
```

---

## Token refresh

Token refresh выполняет backend.

Flow:

```text
access token near expiry
→ backend uses refresh token
→ amoCRM returns new tokens
→ backend stores new tokens
→ old tokens replaced
→ sync continues
```

Если refresh fails:

```text
connection status = needs_reconnect
safe error shown
audit/sync log created
```

---

## Refresh safety

Refresh process не должен:

- логировать tokens;
- отправлять tokens frontend;
- делать infinite retry loop;
- смешивать tenant tokens;
- refresh token одного tenant использовать для другого tenant.

---

## Connection model

Production connection model:

```text
AmoCrmConnection
- id
- tenantId
- provider
- accountId
- accountName
- baseDomain
- status
- connectedAt
- disconnectedAt
- needsReconnectAt
- createdBy
- updatedBy
- lastSyncAt
- lastSyncStatus
```

Connection не должна хранить raw token fields directly in frontend DTO.

---

## Connection status

Возможные статусы:

```text
not_connected
connecting
connected
needs_reconnect
sync_paused
disabled
disconnected
error
```

UI должен показывать safe status.

Backend должен хранить technical details safely.

---

## Tenant-scoped connection

Каждая connection принадлежит tenant.

Правило:

```text
AmoCrmConnection.tenantId = currentTenantId
```

Нельзя делать global connection для всех clinics.

Нельзя использовать один token для всех tenant.

---

## Account info

Backend может получить safe account info из amoCRM.

Можно хранить:

```text
accountId
accountName
baseDomain
connectedAt
```

Не хранить в frontend:

```text
tokens
secrets
raw account response with sensitive fields
```

---

## Field mapping model

Field mapping tenant-scoped.

Production model:

```text
AmoCrmFieldMapping
- id
- tenantId
- provider
- dentalFlowFieldKey
- amoCrmFieldId
- amoCrmFieldName
- direction
- isEnabled
- createdAt
- updatedAt
```

Direction:

```text
inbound
outbound
both
```

Mapping должен быть explicit allowlist.

---

## Pipeline mapping model

Pipeline mapping tenant-scoped.

Production model:

```text
AmoCrmPipelineMapping
- id
- tenantId
- amoCrmPipelineId
- amoCrmStatusId
- dentalFlowLeadStatus
- dentalFlowCommercialStatus
- direction
- isEnabled
```

Разные клиники могут иметь разные pipelines.

Нельзя hardcode one pipeline for all.

---

## Responsible user mapping

Responsible user mapping tenant-scoped.

```text
AmoCrmUserMapping
- id
- tenantId
- dentalFlowUserId
- amoCrmResponsibleUserId
- isActive
```

Не все клиники будут использовать это сразу.

---

## External identity mapping

External IDs должны храниться tenant-scoped.

```text
ExternalEntityMapping
- id
- tenantId
- provider
- localEntityType
- localEntityId
- externalEntityType
- externalEntityId
- createdAt
- updatedAt
```

Uniqueness:

```text
tenantId + provider + externalEntityType + externalEntityId
```

Не считать external ID globally unique.

---

## Safe DTO principle

Все outgoing payloads должны строиться через safe DTO.

Плохой вариант:

```text
send(patient)
send(treatmentPlan)
```

Правильный вариант:

```text
buildAmoCrmContactDto(patient)
buildAmoCrmDealDto(patient, treatmentPlan)
buildAmoCrmTaskDto(patient, followUp)
```

DTO должен содержать только allowlisted fields.

---

## Contact DTO

Safe contact DTO может содержать:

```text
fullName
phone
email, if allowed
source
```

Не содержит:

```text
allergies
medicalNotes
dentalChart
findings
documents
payments
```

---

## Deal DTO

Safe deal DTO может содержать:

```text
patientName
phone
leadStatus
commercialStatus
plannedAmount
currency
nextAppointmentAt
responsibleUser
```

Не содержит:

```text
toothNumber
finding title
finding description
riskDescription
diagnosis
medical document
clinical note
```

---

## Task DTO

Safe task DTO может содержать:

```text
taskText
dueAt
responsibleUser
patientName
phone
commercialContext
```

Safe task example:

```text
Связаться с пациентом по предложенному плану лечения.
Сумма плана: 250000 KZT.
```

Unsafe:

```text
Позвонить по 47 зубу, urgent riskDescription...
```

---

## Mapper layer

Mapper layer должен быть pure.

Он должен:

- принимать DentalFlow entities;
- возвращать safe DTO;
- не делать network calls;
- не читать tokens;
- не менять database;
- не обращаться к localStorage;
- фильтровать запрещённые поля;
- использовать allowlist.

Пример:

```text
mapPatientToAmoContactDraft(patient)
mapTreatmentPlanToAmoDealDraft(patient, plan)
buildAmoSyncPreview(patient, plan)
```

---

## Mapper prohibited fields

Mapper не должен использовать:

```text
dentalChart
DentalFinding.description
DentalFinding.riskDescription
toothNumber
diagnosis
MedicalDocument
ClinicalNote
allergies
contraindications
completedService notes
```

Если mapper начинает читать эти поля, review должен остановить PR.

---

## Allowlist over blacklist

Outgoing mapping должен быть allowlist.

Правильно:

```text
const allowedFields = ["fullName", "phone", "source", "leadStatus"]
```

Плохо:

```text
const payload = patient
delete payload.dentalChart
delete payload.findings
```

Blacklist почти гарантированно пропустит новое sensitive field.

---

## Sync operation model

Sync operation может иметь lifecycle.

```text
created
queued
running
success
failed
retry_scheduled
cancelled
```

Не всё нужно в MVP.

Но production sync должен быть отслеживаемым.

---

## Sync log model

Sync log:

```text
IntegrationSyncLog
- id
- tenantId
- provider
- operation
- direction
- entityType
- entityId
- externalEntityId
- status
- safeMessage
- errorCode
- attempt
- createdAt
- updatedAt
```

Sync log не должен содержать tokens or medical payload.

---

## Sync direction

Direction:

```text
inbound
outbound
```

Inbound:

```text
amoCRM → DentalFlow
```

Outbound:

```text
DentalFlow → amoCRM
```

Direction должен быть явным.

---

## Sync operation types

Operation examples:

```text
contact.create
contact.update
deal.create
deal.update
task.create
task.update
lead.import
webhook.process
token.refresh
connection.test
```

Operation names должны быть stable.

---

## Safe sync log messages

Safe message:

```text
Contact updated successfully.
Deal sync failed: mapping missing.
Token refresh failed: reconnect required.
```

Unsafe message:

```text
Failed with refresh_token=...
Payload: 47 tooth caries...
```

---

## Audit vs sync log

Sync log — техническая история integration operation.

Audit log — кто и что сделал в системе.

Пример:

```text
Audit:
integration.amocrm.connected by user X

Sync log:
token exchange success for tenant Y
```

Оба нужны, но не одно и то же.

---

## Audit events

Audit events:

```text
integration.amocrm.connect_started
integration.amocrm.connected
integration.amocrm.disconnected
integration.amocrm.reconnect_required
integration.amocrm.mapping_updated
integration.amocrm.manual_sync_started
integration.amocrm.sync_retry_requested
integration.amocrm.webhook_received
integration.amocrm.webhook_rejected
```

Audit должен быть tenant-aware.

Audit не должен содержать secrets.

---

## Error model

Errors должны быть normalized.

Example safe error codes:

```text
AMOCRM_NOT_CONNECTED
AMOCRM_NEEDS_RECONNECT
AMOCRM_RATE_LIMIT
AMOCRM_MAPPING_MISSING
AMOCRM_AUTH_FAILED
AMOCRM_REMOTE_ERROR
AMOCRM_WEBHOOK_INVALID
AMOCRM_SYNC_DISABLED
AMOCRM_TENANT_SUSPENDED
AMOCRM_FEATURE_NOT_AVAILABLE
```

UI message должен быть safe.

---

## Safe error response

Safe response:

```text
{
  "ok": false,
  "code": "AMOCRM_NEEDS_RECONNECT",
  "message": "Требуется повторное подключение amoCRM."
}
```

Не возвращать raw provider error if it contains secrets.

---

## Raw provider errors

Raw provider errors могут содержать sensitive technical details.

Если нужно сохранить technical detail:

- sanitize first;
- remove tokens;
- remove secrets;
- remove medical fields;
- store safe code;
- restrict access.

---

## Rate limits

amoCRM API может ограничивать запросы.

Backend должен уметь:

- detect rate limit;
- stop immediate retries;
- schedule retry;
- use backoff;
- show safe message;
- avoid API spam;
- log safe status.

---

## Retry strategy

Retry должен быть controlled.

Правила:

- retry only idempotent or safely repeatable operations;
- use backoff;
- max retry attempts;
- store attempts count;
- create sync log;
- avoid duplicate contacts/deals;
- do not retry auth errors forever;
- do not retry suspended tenant sync.

---

## Idempotency

Sync operations должны быть idempotent.

Повтор одного sync не должен создавать дубликаты.

Нужны:

- external IDs;
- idempotency keys where possible;
- entity mapping;
- conflict checks;
- safe update instead of create when mapping exists.

Пример:

```text
patient has externalContactId
→ update contact
not create new contact
```

---

## Duplicate prevention

Duplicate prevention:

- check tenant-scoped external mapping;
- check phone match only as helper;
- avoid creating duplicate contact on retry;
- log duplicate conflict;
- require manual resolution if uncertain.

Phone match не должен быть единственным source of truth.

---

## Conflict resolution

Conflict examples:

```text
same phone, multiple contacts
deal deleted in amoCRM
mapping points to missing external entity
status changed in both systems
field mapping missing
token expired during sync
```

Conflicts should not be silently ignored.

Need safe status:

```text
sync_failed
mapping_required
manual_review_required
```

---

## Queue architecture

Production sync may require queue.

Possible flow:

```text
DentalFlow event
→ IntegrationJob queued
→ Worker processes job
→ AmoCrmClient sends request
→ SyncLog written
→ Audit if needed
```

Queue helps with:

- retries;
- rate limits;
- async operations;
- webhook processing;
- failure isolation.

Do not implement queue without separate task.

---

## Integration job model

Possible future model:

```text
IntegrationJob
- id
- tenantId
- provider
- operation
- entityType
- entityId
- status
- attempts
- nextRunAt
- createdAt
- updatedAt
```

Job payload must not contain secrets or medical data.

---

## Webhook architecture

Webhooks are future high-risk integration layer.

Webhook handler must:

- identify provider;
- validate request;
- resolve tenant;
- validate payload;
- map external entity;
- apply allowed changes only;
- write sync log;
- write audit if important;
- return safe response.

Do not implement production webhooks without separate security task.

---

## Webhook URL strategy

Possible strategies:

```text
/api/webhooks/amocrm/:tenantWebhookId
/api/tenants/:tenantId/webhooks/amocrm
/api/webhooks/amocrm with account mapping
```

Final strategy must avoid leaking tenant data.

Webhook URL alone is not enough security.

---

## Webhook validation

Webhook validation should include:

- provider signature if available;
- shared secret if used;
- account ID mapping;
- tenant connection exists;
- payload shape;
- allowed event types;
- replay protection if possible.

If validation fails:

```text
reject
log safe event
do not apply changes
```

---

## Webhook tenant resolution

Webhook must resolve tenant safely.

Possible data:

```text
amoCRM accountId
connectionId
tenantWebhookId
state/secret
```

Never apply webhook event globally.

Never process webhook without tenant mapping.

---

## Webhook payload safety

Webhook payload may be unsafe.

Do not trust:

- names;
- phones;
- status IDs;
- custom fields;
- external IDs;
- timestamps;
- nested payloads.

Validate everything.

Do not create medical data from webhook.

---

## Inbound sync rules

Inbound sync can update safe commercial/contact fields.

Allowed inbound:

```text
phone
name
source
lead status
commercial follow-up status
task status
```

Forbidden inbound:

```text
dental chart
findings
diagnosis
medical notes
documents
completed services
payments as medical facts
```

Inbound should not overwrite critical DentalFlow fields without rules.

---

## Outbound sync rules

Outbound sync sends safe commercial/admin summary.

Allowed outbound:

```text
contact safe fields
deal amount
lead status
appointment status safe summary
follow-up task
commercial status
```

Forbidden outbound:

```text
medical details
toothNumber
riskDescription
diagnosis
document snapshot
medical PDF
clinical notes
```

---

## Feature entitlement guard

Before sync:

```text
requireFeature(tenantId, "amocrm_integration")
```

If feature disabled:

```text
AMOCRM_FEATURE_NOT_AVAILABLE
```

Frontend disabled state is not enough.

Backend must enforce.

---

## Subscription guard

Before sync:

```text
requireTenantAccessStatus(tenantId)
```

If suspended:

```text
AMOCRM_TENANT_SUSPENDED
```

Suspended tenant:

- no new outbound sync;
- webhooks restricted;
- jobs paused;
- data preserved.

---

## Permission guard

Actions require permissions.

Examples:

```text
connect → integrations.configure
disconnect → integrations.disconnect or integrations.configure
manual sync → integrations.sync
view logs → integrations.view_logs
update mapping → integrations.configure
```

Permission must be checked in tenant context.

---

## Tenant guard

Every route must check tenant.

```text
currentUser
→ tenant membership
→ permission
→ feature
→ operation
```

No tenant membership, no access.

Do not trust tenantId from frontend without backend validation.

---

## Storage boundaries

Production storage boundaries:

```text
tokens → secure backend storage
field mappings → database tenant-scoped
sync logs → database tenant-scoped
audit logs → database tenant-aware
connection status → database tenant-scoped
safe UI status → API response
```

Not production storage:

```text
localStorage
memory store
markdown reports
browser cache
```

---

## Frontend localStorage rules

Frontend may store UI state.

Frontend must not store:

```text
access_token
refresh_token
client_secret
authorization_code
raw token response
webhook secret
```

Frontend may store temporarily:

```text
selected tab
last opened page
safe filter state
```

Not secrets.

---

## Backend config rules

Backend config should be loaded from env.

Config validation should check:

- required variables;
- valid redirect URI;
- API base URL;
- token endpoint;
- client id exists;
- client secret exists.

If config missing, connect route should return safe error:

```text
AMOCRM_CONFIG_MISSING
```

Do not reveal secret values.

---

## Environment separation

Separate environments:

```text
development
staging
production
```

Production amoCRM app credentials should not be used in local dev casually.

Dev should use test account and fake data.

---

## Test amoCRM account

Development should use:

- test amoCRM account;
- fake patients;
- fake phone numbers;
- fake treatment plans;
- no real medical data.

Never test integration by sending real patient medical data.

---

## Medical leakage checks

For PRs touching amoCRM implementation, search for medical fields.

Examples:

```text
rg -n "toothNumber|DentalFinding|dentalChart|riskDescription|diagnosis|ClinicalNote|MedicalDocument" backend/src src/integrations
```

If found in outgoing mapper or client, review carefully.

Finding these words in docs is fine.

Finding them in DTO sent to amoCRM is dangerous.

---

## Secret leakage checks

For PRs touching OAuth/secrets:

```text
rg -n "access_token|refresh_token|client_secret|clientSecret|authorization_code|Bearer|github_pat|DATABASE_URL|PRIVATE_KEY" .
```

If real-looking secret appears, stop and rotate.

---

## Direct frontend call checks

Search for direct amoCRM calls in frontend:

```text
rg -n "amocrm|amoCRM|amo.crm|/oauth2/access_token" src
```

Frontend may contain labels, placeholders, types or safe UI.

Frontend must not contain direct API calls or tokens.

---

## Package changes

Do not add packages for amoCRM casually.

If package added, task must explain:

- why needed;
- alternatives;
- security risk;
- bundle impact;
- backend/frontend impact;
- license risk.

Docs-only tasks must not change package files.

---

## API client design

AmoCrmClient backend service should:

- receive safe DTO;
- receive tenant connection context;
- retrieve token server-side;
- refresh token if needed;
- call amoCRM API;
- normalize response;
- return safe result;
- never expose tokens to caller.

---

## AmoCrmClient should not

AmoCrmClient should not:

- read from frontend storage;
- accept raw Patient object;
- accept raw TreatmentPlan object;
- log tokens;
- include medical data;
- manage UI state;
- decide permissions alone.

Permission and tenant guard should happen before client call.

---

## Service layering

Suggested backend layering:

```text
routes
→ guards
→ integration service
→ mapper
→ token store
→ amoCRM client
→ sync log
→ audit log
```

Routes should not contain all logic.

Otherwise backend becomes another God Component, only less visible and more dangerous.

---

## Route layer

Route layer handles:

- HTTP method;
- URL parsing;
- request body parsing;
- response formatting;
- calling service;
- catching errors.

Route should not directly build complex amoCRM payload.

---

## Guard layer

Guard layer handles:

- auth;
- tenant access;
- permission;
- feature entitlement;
- subscription/access status.

Guard failure returns safe error.

---

## Integration service layer

Integration service handles business logic:

- connect;
- disconnect;
- status;
- sync preview;
- sync;
- webhook process;
- logs.

It coordinates mapper, client, token store and logs.

---

## Mapper layer

Mapper layer builds safe DTO.

It must be testable and pure.

It must use allowlist.

---

## Token store layer

Token store handles:

- save tokens;
- get tokens for tenant;
- update refreshed tokens;
- remove tokens;
- mark needs reconnect.

Token store must not expose tokens to frontend.

---

## Sync log layer

Sync log layer records safe operation result.

It should support filtering by tenant.

It should not store secrets or medical payload.

---

## Audit layer

Audit layer records important user/system actions.

It should support tenant-aware audit.

It should not store secrets.

---

## DTO versioning

Future DTOs may need versioning.

Example:

```text
AmoCrmDealDraftV1
AmoCrmContactDraftV1
```

Versioning helps when mapping changes.

Not needed immediately, but architecture should not block it.

---

## Backward compatibility

When mapping changes, old sync logs and external IDs should remain understandable.

Do not break existing mappings silently.

Migration may be needed for production.

---

## Migration considerations

When moving from skeleton to production:

```text
memory token store
→ persistent encrypted token store

hardcoded route
→ tenant-aware route

safe mapper preview
→ sync service

manual status
→ sync logs

dev OAuth
→ production OAuth
```

Do this in small PRs.

One giant PR for integration migration is how projects summon pain.

---

## Rollback considerations

If sync breaks:

- disable sync for tenant;
- mark connection paused;
- keep DentalFlow data safe;
- stop outbound jobs;
- show safe error;
- preserve logs;
- do not delete patient data.

Integration failure must not break core CRM.

---

## Failure isolation

amoCRM downtime should not stop DentalFlow.

If amoCRM unavailable:

- patient card still works;
- appointments still work;
- treatment plans still work;
- documents still work;
- sync status shows failure;
- retry later.

External integration is optional layer, not life support.

---

## Monitoring

Production should monitor:

- sync failures;
- token refresh failures;
- rate limits;
- webhook rejection;
- queue backlog;
- mapping errors;
- duplicate conflicts;
- needs reconnect tenants.

Monitoring should be safe and not expose secrets.

---

## Admin visibility

Platform admin may see integration health:

```text
tenant
provider
status
lastSyncAt
errorCount
needsReconnect
```

Platform admin should not see:

```text
tokens
medical payload
raw patient data
```

---

## Clinic owner visibility

Clinic owner may see:

- connected status;
- account name;
- last sync;
- safe errors;
- mapping status;
- reconnect action;
- disconnect action.

No raw tokens.

---

## Support visibility

Support may see limited safe technical status.

Support access should be scoped and audited.

Support should not get permanent access to all tenant integrations.

---

## Security incident examples

Security incident examples:

- token committed to Git;
- access token returned to frontend;
- refresh token logged;
- medical data sent to amoCRM;
- wrong tenant token used;
- webhook processed for wrong tenant;
- sync log contains medical payload;
- report contains real OAuth code.

Action:

```text
stop
rotate secret if needed
audit impact
fix
document incident
```

---

## Testing strategy

Future tests should cover:

- mapper excludes medical fields;
- mapper allowlist only;
- frontend does not call amoCRM API directly;
- status response has no tokens;
- suspended tenant cannot sync;
- missing permission denied;
- disconnected tenant cannot sync;
- token refresh safe;
- webhook invalid rejected;
- sync logs contain no secrets;
- tenant isolation enforced.

---

## Unit tests

Unit tests for mapper:

```text
input patient with medical fields
→ output DTO has no medical fields
```

Unit tests for token store:

```text
tokens never returned in public DTO
```

Unit tests for route/service:

```text
without permission → denied
without feature → denied
suspended tenant → denied
```

---

## Integration tests

Integration tests can use fake amoCRM client.

Do not hit real amoCRM in normal automated tests unless explicitly configured.

Use mocks/fakes for:

- token exchange;
- refresh;
- contact create/update;
- deal create/update;
- webhook payloads.

---

## Manual QA checklist

For real sync PRs:

- connect works;
- callback works;
- status safe;
- tokens not in UI;
- tokens not in logs;
- sync preview safe;
- no medical fields sent;
- disconnected state works;
- needs reconnect works;
- suspended tenant blocked;
- wrong permission blocked;
- tenant isolation checked.

---

## CI considerations

Future CI can include:

- lint;
- build;
- backend syntax check;
- tests;
- secret scan;
- grep checks for unsafe direct amoCRM calls;
- grep checks for forbidden medical fields in integration payload.

CI does not replace human review.

Sadly, neither does optimism.

---

## Documentation requirements

Any amoCRM technical PR must report:

- changed files;
- whether src changed;
- whether backend changed;
- whether package files changed;
- tenant impact;
- storage impact;
- sensitive data impact;
- token handling;
- medical data boundary;
- what was not implemented;
- risks.

---

## Report honesty

Reports must not claim production readiness unless production requirements are met.

Bad report:

```text
amoCRM integration completed
```

when only OAuth skeleton exists.

Good report:

```text
OAuth connection skeleton added.
Real sync, production token storage, webhooks and retries are not implemented.
```

Honesty is cheaper than debugging marketing lies later.

---

## MVP technical path

Safe technical path:

```text
1. Docs and rules
2. Safe frontend metadata
3. Safe mapper preview
4. Backend proxy skeleton
5. OAuth skeleton
6. Tenant-aware architecture
7. Persistent token storage
8. Field mapping
9. Sync logs
10. Manual safe sync
11. Retry/rate limit handling
12. Webhooks
13. Automatic sync
```

Do not jump from step 5 to step 13 because “it looks easy”.

---

## What can be done before full backend

Before full production backend, safe tasks:

- docs;
- disabled placeholders;
- pure mappers;
- safe preview;
- dev-only OAuth skeleton;
- no network sync;
- clear warnings.

Do not add production claims.

---

## What must wait for backend foundation

Must wait:

- tenant-aware production token storage;
- real sync;
- webhooks;
- automatic sync;
- queue;
- field mapping UI;
- persistent sync logs;
- tenant-level audit;
- production retries;
- production rate limit handling.

---

## Что нельзя делать

Нельзя:

- вызывать amoCRM API из frontend;
- хранить tokens в frontend;
- хранить tokens в localStorage;
- возвращать tokens в API response;
- логировать tokens;
- коммитить secrets;
- делать global amoCRM connection for all tenants;
- использовать один token для всех tenants;
- отправлять full Patient object;
- отправлять full TreatmentPlan object;
- отправлять dental chart;
- отправлять toothNumber;
- отправлять clinical findings;
- отправлять riskDescription;
- отправлять diagnosis;
- отправлять MedicalDocument;
- использовать blacklist вместо allowlist;
- делать real sync без tenant/security/storage foundation;
- делать webhook без tenant validation;
- считать memory token store production;
- заявлять production-ready для skeleton;
- добавлять dependencies без отдельной задачи.

---

## Правила для ИИ-задач

Если задача касается amoCRM technical architecture, backend proxy, OAuth, token storage, webhooks, sync, mapping, retries или rate limits, ИИ должен проверить:

- backend/proxy remains boundary;
- frontend does not call amoCRM directly;
- tokens stay server-side;
- tenant-scoped connection is respected;
- permissions are checked;
- feature entitlement is considered;
- suspended tenant behavior is considered;
- safe DTO uses allowlist;
- no medical data in payload;
- no secrets in logs/reports;
- storage impact is explicit;
- report states what is not implemented.

---

## Acceptance для amoCRM technical задач

amoCRM technical task считается корректной, если:

- scope ограничен;
- frontend/backend boundary соблюдён;
- no direct frontend amoCRM calls;
- tokens not exposed;
- tenant impact указан;
- storage impact указан;
- sensitive data impact указан;
- medical data boundary соблюдена;
- mapper safe;
- logs safe;
- errors safe;
- skeleton vs production честно разделены;
- report создан.

---

## Итог

Техническая архитектура amoCRM integration должна строиться вокруг backend/proxy.

Главная схема:

```text
Frontend
→ DentalFlow Backend / Integration Proxy
→ Safe DTO Mapper
→ Token Store
→ AmoCrmClient
→ amoCRM API
→ Sync Log
→ Audit Log
```

Главная security-цепочка:

```text
auth
→ tenant membership
→ permission
→ feature entitlement
→ subscription status
→ safe mapping
→ server-side token
→ amoCRM request
→ safe log
```

Главная защитная мысль:

```text
tokens живут на backend,
medical data остаётся в DentalFlow,
amoCRM получает только safe commercial summary
```

Если эти технические границы сохранить, amoCRM может стать сильной интеграцией.

Если нарушить, она станет красиво оформленным туннелем для токенов, чужих tenant и медицинских данных. А это уже не архитектура, а автогенератор будущих извинений.
