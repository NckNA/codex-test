# 09_AMOCRM_INTEGRATION_RULES.md

## Назначение документа

Этот документ описывает продуктовые и архитектурные правила интеграции DentalFlow CRM с amoCRM.

amoCRM в проекте DentalFlow должна использоваться как внешняя sales/communication CRM для лидов, сделок, коммуникаций, follow-up и коммерческого сопровождения пациента.

Главное правило:

**amoCRM — это не медицинская карта DentalFlow.**

В amoCRM нельзя отправлять зубную карту, clinical findings, diagnosis, riskDescription, врачебные заметки, медицинские документы, PDF с медицинскими деталями или любые данные, которые превращают sales CRM в медицинское хранилище.

Если это правило нарушить, интеграция станет не преимуществом продукта, а аккуратным способом вынести медицинские данные туда, где им делать нечего. Люди почему-то любят называть это “сквозной автоматизацией”. На деле это часто просто сквозная утечка смысла и данных.

---

## Главная роль amoCRM

amoCRM отвечает за commercial/sales workflow.

amoCRM может использоваться для:

- лидов;
- сделок;
- контактов;
- коммуникаций;
- задач менеджерам;
- follow-up;
- воронки продаж;
- источников пациентов;
- статуса коммерческого сопровождения;
- напоминаний о необходимости связаться;
- контроля конверсии обращения в консультацию;
- контроля конверсии плана лечения в согласование.

amoCRM не отвечает за:

- зубную карту;
- медицинскую карту;
- clinical findings;
- diagnosis;
- treatment medical details;
- врачебные заметки;
- медицинские документы;
- completed services;
- историю лечения;
- склад;
- platform billing;
- tenant isolation внутри DentalFlow.

---

## Главная цепочка интеграции

Правильная концептуальная цепочка:

```text
amoCRM lead / contact / deal
→ DentalFlow patient
→ DentalFlow appointment
→ DentalFlow examination
→ DentalFlow treatment plan
→ safe commercial summary
→ amoCRM deal / task / follow-up
```

amoCRM может приводить и сопровождать лида.

DentalFlow должна вести пациента, медицинскую часть, планы лечения, документы и клиническую историю.

---

## amoCRM как внешний sales-слой

amoCRM должна быть внешним sales-слоем, а не ядром DentalFlow.

DentalFlow остаётся source of truth для:

- patient;
- appointment;
- dental chart;
- dental findings;
- treatment plans;
- patient preview;
- medical documents;
- completed services;
- clinic finance;
- tenant settings;
- integration safety rules.

amoCRM может быть source of truth для:

- lead pipeline;
- sales deal status;
- communication tasks;
- sales manager follow-up;
- commercial funnel.

---

## Что можно передавать в amoCRM

В amoCRM можно передавать только safe commercial/admin summary.

Допустимые данные:

```text
patient full name
patient phone
lead source
lead status
appointment date
appointment status
commercial treatment plan status
treatment plan total amount
currency
safe commercial summary
responsible manager
follow-up status
next action date
DentalFlow patient external link, if safe and permission-protected
```

Даже эти данные должны передаваться только через backend/proxy и с tenant checks.

---

## Что нельзя передавать в amoCRM

Запрещено передавать в amoCRM:

```text
dental chart
toothNumber
tooth surfaces
tooth state
clinical findings
diagnosis
riskDescription
clinical notes
doctor private notes
medical documents
medical PDF
medical images
allergies
contraindications
completed service medical notes
full treatment medical details
internal medical history
raw patient preview with medical details
raw document snapshot
```

amoCRM не должна становиться медицинским архивом.

---

## Почему toothNumber нельзя отправлять в amoCRM

ToothNumber является частью стоматологического medical context.

Пример опасного payload:

```text
47 tooth caries, urgent, risk of complications
```

Это медицинская информация.

В amoCRM допустима safe summary:

```text
План лечения предложен.
Сумма: 250000 KZT.
Статус: ожидает решения пациента.
```

Sales manager должен понимать коммерческий статус, но не обязан видеть зубную карту.

---

## Почему clinical findings нельзя отправлять в amoCRM

Clinical findings — это медицинские данные.

Они могут содержать:

- конкретные проблемы;
- медицинские детали;
- severity;
- riskDescription;
- связь с зубами;
- врачебные выводы;
- будущие diagnosis relations.

Это должно оставаться внутри DentalFlow.

amoCRM может знать:

```text
consultation_done
plan_proposed
plan_approved
treatment_started
```

Но не должна знать подробности clinical findings.

---

## Почему medical documents нельзя отправлять в amoCRM

Medical documents могут содержать sensitive medical data и юридически значимые данные.

Запрещено отправлять в amoCRM:

- план лечения с медицинскими деталями;
- informed consent;
- medical PDF;
- document snapshot;
- clinical recommendations;
- выписки;
- врачебные заключения.

Если когда-нибудь потребуется external document sharing, это отдельная high-risk security/legal задача.

По умолчанию:

```text
no medical documents to amoCRM
```

---

## Safe commercial summary

Safe commercial summary — это очищенная коммерческая сводка, которую можно передать в amoCRM.

Пример:

```text
Пациент прошёл консультацию.
План лечения предложен.
Сумма плана: 250000 KZT.
Статус: ожидает решения пациента.
Следующий шаг: связаться через 2 дня.
```

В ней нет:

- toothNumber;
- diagnosis;
- findings;
- riskDescription;
- medical notes;
- PDF;
- doctor private notes.

---

## Unsafe summary

Unsafe summary:

```text
У пациента кариес 47 зуба, высокий риск осложнений, требуется лечение каналов.
```

Такой текст нельзя отправлять в amoCRM.

Даже если он кажется полезным менеджеру.

Менеджеру нужна коммерческая логика, а не медицинская карта.

---

## Направление данных: inbound

Inbound integration означает поступление данных из amoCRM в DentalFlow.

Возможные inbound сценарии:

```text
amoCRM lead created
→ DentalFlow creates/links patient draft

amoCRM contact updated
→ DentalFlow updates safe contact fields, if allowed

amoCRM task/follow-up status
→ DentalFlow updates commercial follow-up metadata, if allowed
```

Inbound данные из amoCRM не должны автоматически создавать medical findings, diagnosis, treatment plan или medical documents.

---

## Направление данных: outbound

Outbound integration означает отправку данных из DentalFlow в amoCRM.

Возможные outbound сценарии:

```text
DentalFlow patient created
→ create/update amoCRM contact

DentalFlow appointment scheduled
→ update deal/task safe status

DentalFlow treatment plan proposed
→ update deal commercial status and amount

DentalFlow treatment plan approved
→ update deal commercial status

DentalFlow no-show
→ create follow-up task
```

Outbound payload должен быть safe.

---

## No direct frontend amoCRM API calls

Frontend DentalFlow не должен обращаться к amoCRM API напрямую.

Запрещено:

```text
React frontend → amoCRM API
```

Правильная схема:

```text
DentalFlow Frontend
→ DentalFlow Backend / Integration Proxy
→ amoCRM API
```

Причины:

- client secret нельзя хранить во frontend;
- access token нельзя хранить в браузере;
- refresh token нельзя хранить в localStorage;
- payload должен фильтроваться backend;
- tenant permissions должны проверяться backend;
- sync logs должны создаваться backend;
- suspended tenant не должен синхронизироваться.

---

## Backend/proxy как обязательный слой

amoCRM integration должна идти через backend/proxy.

Backend/proxy отвечает за:

- OAuth flow;
- token exchange;
- token refresh;
- tenant-scoped token storage;
- building safe payloads;
- filtering medical data;
- mapping fields;
- sync logs;
- rate limit handling;
- safe errors;
- webhook validation;
- tenant access checks;
- feature entitlement checks;
- suspended tenant restrictions.

Frontend может только инициировать безопасные действия через DentalFlow backend.

---

## Tenant-scoped integration

Каждый tenant должен иметь собственную amoCRM connection.

Правило:

```text
AmoCrmConnection belongs to tenantId
```

Один tenant не должен использовать токены другого tenant.

AmoCRM integration data должна быть tenant-scoped:

```text
connection
tokens
account info
pipeline mapping
field mapping
external IDs
sync logs
webhook settings
last sync status
```

---

## Tenant isolation для amoCRM

Клиника A не должна:

- видеть amoCRM connection клиники B;
- использовать токены клиники B;
- видеть sync logs клиники B;
- отправлять данные в amoCRM аккаунт клиники B;
- получать webhook events клиники B;
- использовать pipeline mapping клиники B.

Это critical security boundary.

---

## Subscription и amoCRM

amoCRM integration может быть доступна только на определённых тарифах.

Пример:

```text
Basic: no amoCRM integration
Standard: limited amoCRM status
Pro: amoCRM integration enabled
Enterprise: custom mapping and advanced sync
```

Backend должен проверять feature entitlement:

```text
tenant has feature amocrm_integration
```

Frontend disabled button не является защитой.

---

## Suspended tenant behavior

Если tenant suspended:

- amoCRM sync должен быть paused or denied;
- new outbound sync should not run;
- incoming webhook processing should be restricted;
- public booking and reminders may be paused;
- clinic owner may see billing/access notice;
- data must not be deleted.

Suspension ограничивает доступ, но не удаляет integration config.

---

## Integration permissions

Подключать amoCRM может только роль с permission.

Возможные permissions:

```text
integrations.view
integrations.configure
integrations.disconnect
integrations.sync
integrations.view_logs
integrations.retry_sync
```

Обычный врач, кассир или receptionist не должен подключать amoCRM.

---

## Кто может видеть amoCRM status

Разные роли могут видеть разные части integration status.

### clinic_owner

Может видеть:

- connected/disconnected;
- account name;
- last sync;
- errors;
- feature availability;
- configure/disconnect actions.

### clinic_admin

Может видеть:

- status;
- last sync;
- safe errors;
- limited configuration, if allowed.

### sales_manager

Может видеть:

- lead source;
- lead status;
- safe commercial sync status;
- follow-up status.

### doctor

Может видеть limited source/lead status only if clinic policy allows.

Doctor не обязан видеть amoCRM internals.

---

## Запрещено показывать токены в UI

В UI нельзя показывать:

```text
access_token
refresh_token
client_secret
authorization_code
raw token response
webhook secret
Bearer token
```

Даже clinic_owner не должен видеть raw tokens.

Можно показывать:

```text
Connected
Disconnected
Last sync at
Needs reconnect
Token expired
Safe error message
```

---

## OAuth rules

OAuth flow должен быть server-side controlled.

Правила:

- authorization URL формирует backend;
- state обязателен;
- state имеет срок жизни;
- callback обрабатывает backend;
- authorization code не хранится во frontend;
- token exchange выполняет backend;
- client secret хранится backend-side;
- token response не возвращается во frontend;
- errors safe;
- logs safe.

Dev-only memory token store не является production storage.

---

## OAuth state

State защищает от CSRF и путаницы tenant.

State должен быть связан с:

```text
tenantId
createdBy userId
createdAt
expiresAt
nonce
```

State должен истекать.

Пример:

```text
state expires after 10 minutes
```

State нельзя использовать повторно.

---

## Token storage

Production token storage должен быть:

- backend-side;
- tenant-scoped;
- encrypted or protected;
- not exposed to frontend;
- not stored in localStorage;
- not stored in reports;
- not logged;
- rotated/refreshed safely;
- audit-aware for connect/disconnect.

Memory token store допустим только как dev-only skeleton.

---

## Token refresh

Token refresh должен выполняться backend-side.

Правила:

- refresh token не показывать frontend;
- errors safe;
- update stored token atomically;
- failed refresh marks connection as needs_reconnect;
- do not spam provider;
- log safe metadata only.

---

## Disconnect amoCRM

Disconnect должен быть controlled action.

При disconnect:

```text
connection status = disconnected
tokens removed or invalidated
sync disabled
audit event created
safe status shown in UI
```

Disconnect не должен удалять patients, treatment plans или local DentalFlow data.

---

## Reconnect amoCRM

Reconnect должен обновлять connection.

При reconnect:

- old invalid tokens replaced;
- tenant mapping preserved if safe;
- sync status updated;
- audit event created;
- user sees safe result.

Не смешивать reconnect одного tenant с другим tenant.

---

## Field mapping

Field mapping определяет, какие поля DentalFlow связаны с amoCRM fields.

Пример safe mapping:

```text
Patient.fullName → amoCRM Contact Name
Patient.phone → amoCRM Contact Phone
Patient.source → amoCRM custom field Lead Source
Patient.leadStatus → amoCRM custom field Lead Status
TreatmentPlan.totalAmount → amoCRM Deal Budget
TreatmentPlan.commercialStatus → amoCRM Deal Status
Appointment.nextDate → amoCRM Task / custom field Next Appointment
```

Запрещённый mapping:

```text
DentalFinding.toothNumber → amoCRM
DentalFinding.description → amoCRM
DentalFinding.riskDescription → amoCRM
Diagnosis → amoCRM
MedicalDocument → amoCRM
ClinicalNote → amoCRM
```

---

## Mapping должен быть allowlist

Mapping должен строиться по allowlist.

Правильная логика:

```text
only explicitly allowed safe fields can be sent
```

Плохая логика:

```text
send all patient object except some fields
```

Allowlist безопаснее blacklist.

Blacklist почти всегда проигрывает человеческой изобретательности в создании новых полей.

---

## Safe outgoing DTO

Outbound DTO для amoCRM должен быть отдельным.

Пример:

```text
AmoCrmLeadDraft
- fullName
- phone
- source
- leadStatus
- plannedAmount
- currency
- commercialStatus
- nextAppointmentAt
- responsibleUser
```

Он не должен содержать:

```text
dentalChart
findings
diagnosis
riskDescription
medicalDocuments
clinicalNotes
allergies
contraindications
```

---

## Не отправлять full Patient object

Запрещено отправлять полный Patient object в amoCRM.

Плохая логика:

```text
send patient
```

Правильная логика:

```text
buildAmoSafeContactPayload(patient)
buildAmoSafeDealPayload(patient, plan)
```

Payload должен быть собран явно.

---

## Не отправлять full TreatmentPlan object

Запрещено отправлять полный TreatmentPlan object.

Плохая логика:

```text
send treatmentPlan
```

Правильная логика:

```text
send commercial summary:
- total amount
- status
- safe title
- next step
```

TreatmentPlan может содержать linkedFindingIds, toothNumbers, medical explanations and risk text.

Это не должно уходить в amoCRM.

---

## Source

Source показывает, откуда пришёл пациент.

Возможные значения:

```text
manual
phone
whatsapp
instagram
website
amocrm
referral
return_patient
other
```

Source можно синхронизировать с amoCRM.

Source не является medical data.

---

## Lead status

Lead status описывает коммерческий путь пациента.

Возможные значения:

```text
new_lead
contacted
consultation_scheduled
consultation_done
plan_proposed
plan_approved
treatment_started
treatment_completed
lost
return_patient
```

Lead status можно синхронизировать с amoCRM.

Lead status не должен автоматически менять medical status.

---

## Lead status не равен medical status

Плохая логика:

```text
leadStatus = treatment_completed
→ findings completed
→ treatment stages completed
```

Правильная логика:

```text
leadStatus describes commercial journey
medical completion requires CompletedService / doctor action
```

amoCRM deal won не лечит зубы.

Да, опять приходится это писать. Видимо, календарь, CRM и деньги очень хотят стать врачами.

---

## Commercial status

Commercial status может описывать состояние предложения.

Примеры:

```text
consultation_needed
consultation_done
plan_preparing
plan_proposed
patient_thinking
plan_approved
plan_declined
follow_up_needed
lost
```

Commercial status может уходить в amoCRM.

Medical status не должен вытекать в amoCRM.

---

## Appointment status в amoCRM

В amoCRM можно передавать safe appointment status:

```text
appointment_scheduled
appointment_confirmed
appointment_cancelled
appointment_no_show
appointment_completed
```

Но без medical details.

Пример safe:

```text
Пациент записан на консультацию 2026-06-10 10:00.
```

Не safe:

```text
Пациент записан на лечение 47 зуба из-за urgent finding.
```

---

## Treatment plan amount

Treatment plan amount можно передавать как commercial budget.

Пример:

```text
plannedAmount: 250000
currency: "KZT"
```

Но нельзя передавать медицинскую детализацию stages if they reveal medical content.

Safe stage names должны быть осторожными.

Лучше передавать total amount and commercial status.

---

## Deal budget

amoCRM deal budget может использоваться для суммы плана лечения.

Правило:

```text
TreatmentPlan.totalAmount → amoCRM Deal Budget
```

Но это commercial amount, not payment.

Deal budget не означает, что пациент оплатил.

Deal won не означает, что лечение выполнено.

---

## Pipeline mapping

Pipeline mapping — сопоставление DentalFlow статусов с amoCRM pipeline/status.

Пример:

```text
new_lead → New Lead
consultation_scheduled → Appointment Scheduled
consultation_done → Consultation Done
plan_proposed → Plan Proposed
plan_approved → Plan Approved
lost → Lost
```

Pipeline mapping должен быть tenant-scoped.

Разные клиники могут иметь разные воронки.

---

## Pipeline mapping не должен быть глобальным

Нельзя использовать один mapping для всех tenant как production-модель.

Плохой вариант:

```text
global amoCRM pipeline mapping
```

Правильный вариант:

```text
tenantId + provider + pipeline mapping
```

В MVP можно иметь placeholder mapping, но production должен быть tenant-scoped.

---

## Custom fields mapping

amoCRM custom fields могут отличаться у разных аккаунтов.

Mapping должен быть tenant-scoped.

Пример:

```text
AmoCrmFieldMapping
- tenantId
- fieldKey
- amoFieldId
- direction
- isEnabled
```

Не хардкодить field IDs как универсальные для всех клиник.

---

## External IDs

External IDs должны храниться с tenant context.

Пример:

```text
tenantId
provider = amocrm
externalContactId
externalLeadId
externalDealId
externalAccountId
```

Нельзя считать externalContactId globally unique across all tenant.

Правильный uniqueness:

```text
tenantId + provider + externalContactId
```

---

## Contact mapping

amoCRM Contact может соответствовать DentalFlow Patient.

Правила:

- patient belongs to tenant;
- contact belongs to tenant amoCRM account;
- mapping stored tenant-scoped;
- phone match can help, but not final truth;
- duplicates must be handled safely.

Не создавать medical data из contact.

---

## Lead/Deal mapping

amoCRM Lead/Deal может соответствовать commercial case around patient.

DentalFlow может хранить:

```text
externalLeadId
externalDealId
commercialStatus
lastSyncAt
```

Но DentalFlow medical model остаётся отдельной.

---

## Duplicate matching

Поиск совпадений может использовать:

- phone;
- fullName;
- externalContactId;
- externalLeadId.

Но duplicate matching должен быть tenant-scoped.

Один и тот же человек может быть пациентом разных клиник.

---

## Conflict handling

Интеграция должна иметь правила конфликтов.

Примеры конфликтов:

```text
phone changed in amoCRM and DentalFlow
lead status differs
duplicate contact found
external deal deleted
pipeline status unknown
field mapping missing
```

Не решать конфликты молча.

Report/log должен быть safe.

---

## Source of truth

DentalFlow source of truth:

```text
patient medical data
appointments inside DentalFlow
treatment plans
documents
clinic finance
```

amoCRM source of truth:

```text
sales pipeline
communication tasks
sales follow-up
deal stage, if configured
```

Если поле принадлежит medical domain, source of truth только DentalFlow.

---

## One-way sync

One-way sync может быть проще и безопаснее.

Примеры:

```text
amoCRM → DentalFlow:
lead/contact creates patient draft

DentalFlow → amoCRM:
safe commercial status updates deal
```

Не всё должно быть two-way.

Two-way sync сложнее и опаснее.

---

## Two-way sync

Two-way sync — будущая high-risk задача.

Она требует:

- conflict resolution;
- field ownership;
- timestamps;
- idempotency;
- retry logic;
- audit logs;
- tenant mapping;
- webhook validation;
- safe payloads.

Не реализовывать two-way sync без отдельного архитектурного задания.

---

## Idempotency

Sync operations должны быть idempotent.

Повторный sync не должен создавать дубликаты.

Пример:

```text
same patient + same externalContactId
→ update existing mapping
```

Не должно быть:

```text
retry failed sync
→ creates duplicate contact every time
```

---

## Retry logic

Retry должен быть controlled.

Правила:

- retry only safe operations;
- backoff;
- max attempts;
- safe logs;
- no duplicate creation;
- no token leak in errors;
- manual retry permission if needed.

---

## Rate limits

amoCRM API может иметь rate limits.

Integration должна учитывать:

- throttling;
- queue;
- backoff;
- safe failure status;
- user-friendly message;
- no infinite retry loop.

Не спамить API, потому что “агент старался”.

---

## Sync status

Sync status может быть:

```text
not_connected
connected
sync_pending
sync_success
sync_failed
needs_reconnect
paused
disabled
```

Sync status должен быть safe for UI.

Не хранить raw secret errors.

---

## Sync error

Sync error должен быть safe.

Плохой error:

```text
OAuth failed with client_secret=...
```

Правильный error:

```text
Не удалось синхронизировать amoCRM. Требуется повторное подключение.
```

В technical logs можно хранить safe code, но не secrets.

---

## Sync logs

Sync logs должны быть tenant-scoped.

Пример:

```text
IntegrationSyncLog
- id
- tenantId
- provider
- operation
- entityType
- entityId
- externalEntityId
- status
- safeMessage
- createdAt
```

Не хранить:

- tokens;
- full medical payload;
- raw OAuth response;
- raw webhook payload with secrets;
- medical documents.

---

## Audit events

Важные audit events:

```text
integration.amocrm.connected
integration.amocrm.disconnected
integration.amocrm.reconnected
integration.amocrm.sync_started
integration.amocrm.sync_success
integration.amocrm.sync_failed
integration.amocrm.mapping_updated
integration.amocrm.webhook_received
integration.amocrm.webhook_rejected
```

Audit должен быть tenant-aware.

Audit не должен содержать secrets.

---

## Webhooks

amoCRM webhooks — будущая задача.

Webhook endpoint должен:

- validate request;
- identify tenant safely;
- verify secret/signature if available;
- parse payload;
- map external entity to tenant;
- reject unknown tenant mapping;
- log safe event;
- avoid medical data creation;
- avoid raw secret logs.

Не реализовывать production webhooks без отдельной security task.

---

## Webhook tenant resolution

Webhook должен быть связан с tenant.

Варианты:

```text
unique webhook URL per tenant
tenant mapping by account ID
secret/state mapping
```

Нельзя принимать webhook и применять изменения без tenant mapping.

---

## Webhook safety

Webhook data нельзя считать trusted.

amoCRM external data может быть:

- missing;
- malformed;
- duplicated;
- outdated;
- malicious;
- from wrong account;
- from unknown mapping.

Backend должен валидировать.

---

## Import from amoCRM

Import из amoCRM может создать patient drafts.

Правила:

- tenant connection required;
- field mapping required;
- no medical data;
- duplicate detection;
- preview before bulk import, if possible;
- import report;
- rollback strategy, if bulk;
- audit log.

Не делать массовый import без отдельной задачи.

---

## Export to amoCRM

Export в amoCRM должен использовать safe DTO.

Правила:

- only allowlisted fields;
- tenant connection required;
- user permission required;
- feature entitlement required;
- suspended tenant denied;
- sync log created;
- errors safe.

---

## Manual sync

Manual sync может быть доступен clinic owner/admin.

Permissions:

```text
integrations.sync
integrations.retry_sync
```

Manual sync не должен обходить safety rules.

Нельзя “ручным sync” отправить medical data.

---

## Automatic sync

Automatic sync — future.

Он может запускаться при событиях:

```text
patient.created
appointment.scheduled
appointment.cancelled
treatment_plan.proposed
treatment_plan.approved
follow_up_needed
```

Но automatic sync должен быть controlled.

На раннем этапе лучше disabled/placeholder.

---

## Event-driven integration

В будущем можно использовать events.

Пример:

```text
DentalFlow event
→ integration queue
→ safe mapper
→ amoCRM client
→ sync log
```

Не реализовывать event system без отдельной backend architecture.

---

## Queue

Для production sync может понадобиться queue.

Зачем:

- retries;
- rate limits;
- async processing;
- failure isolation;
- webhook processing;
- audit.

Не реализовывать без отдельной задачи.

---

## amoCRM task creation

amoCRM tasks можно использовать для follow-up.

Примеры:

```text
call patient after consultation
follow up after plan proposed
call after no-show
remind about decision
```

Task text должен быть safe.

Не включать medical details.

---

## Safe task text

Safe task:

```text
Связаться с пациентом по плану лечения.
Статус: ожидает решения.
Сумма плана: 250000 KZT.
```

Unsafe task:

```text
Позвонить по лечению 47 зуба, высокий риск осложнений.
```

---

## amoCRM notes

amoCRM notes должны быть safe.

Можно:

```text
Консультация проведена. План лечения предложен.
```

Нельзя:

```text
Кариес 47 зуба, riskDescription, diagnosis, doctor notes.
```

---

## Responsible user mapping

В будущем можно сопоставлять DentalFlow user с amoCRM responsible user.

Mapping должен быть tenant-scoped.

Пример:

```text
DentalFlow userId
→ amoCRM responsibleUserId
```

Не хардкодить globally.

---

## Multi-clinic tenant and amoCRM

Если tenant имеет несколько филиалов, amoCRM mapping может учитывать branch.

Но branch architecture — отдельная задача.

На уровне document 09 важно:

```text
tenant comes first
branch optional future
```

Не путать tenant и amoCRM account.

---

## Multi-tenant SaaS and amoCRM

DentalFlow как SaaS может обслуживать много клиник.

Каждая клиника может иметь свой amoCRM account.

Нельзя:

```text
one global amoCRM app token for all tenants without tenant isolation
```

Правильно:

```text
each tenant connects its own amoCRM account
tokens stored tenant-scoped
```

---

## Platform owner access

Platform owner может видеть integration status across tenants.

Но не должен видеть raw tokens.

Platform owner может видеть:

- connected/disconnected;
- tenant integration health;
- error counts;
- sync failures;
- needs reconnect.

Не должен видеть:

- access tokens;
- refresh tokens;
- medical payload;
- raw patient medical data.

---

## Support access

Support может помогать с интеграцией.

Support access должен быть:

- scoped;
- temporary;
- permission-limited;
- audited.

Support не должен постоянно видеть все tenant integrations and data.

---

## UI integration status

UI может показывать:

```text
amoCRM не подключена
amoCRM подключена
Требуется повторное подключение
Последняя синхронизация: дата
Последняя ошибка: safe message
```

UI не должен показывать raw technical payload or tokens.

---

## Disabled states

Если integration не готова или недоступна:

```text
amoCRM: будет доступно после подключения интеграции.
```

Если тариф не включает:

```text
amoCRM доступна на тарифе Pro.
```

Если tenant suspended:

```text
Интеграция временно приостановлена из-за ограничения доступа.
```

Backend всё равно должен enforce.

---

## PatientCard amoCRM block

PatientCard может иметь integration block.

Показывать:

- source;
- lead status;
- external sync status;
- last sync;
- safe error;
- commercial summary.

Не показывать:

- tokens;
- raw payloads;
- medical data sent to amoCRM;
- dental chart.

---

## PatientsPage amoCRM badges

PatientsPage может показывать badges:

- source;
- lead status;
- sync status.

Badges должны быть краткими.

Не выводить medical details.

---

## TreatmentPlansTab amoCRM placeholder

Если real sync не реализован, action должен быть disabled.

Пример:

```text
amoCRM: будет доступно после подключения интеграции.
```

Не делать кнопку, которая имитирует sync.

Не отправлять real API calls раньше задачи на sync.

---

## Integration readiness layer

Можно иметь readiness layer:

- integration metadata types;
- safe DTO;
- mapper skeleton;
- disabled UI;
- docs;
- backend skeleton;
- OAuth skeleton.

Но readiness layer не равен real sync.

Reports должны честно писать:

```text
real amoCRM sync not implemented
```

---

## OAuth skeleton не равен production integration

OAuth skeleton может:

- build authorization URL;
- receive callback;
- exchange code in dev;
- store token in memory dev-only;
- return status.

Но это не production.

Production требует:

- tenant-scoped persistent storage;
- encrypted token storage;
- refresh handling;
- audit;
- logs;
- retry;
- permissions;
- feature entitlement;
- security review.

---

## Memory token store warning

Memory token store:

```text
dev-only
not persistent
not production-ready
lost on restart
not encrypted
not tenant production storage
```

Его нельзя продавать как готовую интеграцию.

---

## Field mapper skeleton

Mapper skeleton должен быть pure and safe.

Он может строить preview:

```text
buildAmoSyncPreview(patient, plan)
```

Но не должен делать network calls.

Mapper не должен включать medical data.

---

## Real API calls

Real amoCRM API calls нельзя добавлять без отдельной задачи.

Перед real sync нужны:

- technical architecture;
- token storage;
- tenant mapping;
- field mapping;
- safe DTO;
- permissions;
- sync logs;
- retry strategy;
- security review.

Не делать “маленький fetch” между делом. Так обычно и рождаются большие проблемы.

---

## Network calls location

Все real network calls to amoCRM должны быть только в backend service layer.

Пример:

```text
backend/src/services/amoCrmClient.js
```

Frontend не должен импортировать amoCRM SDK or direct API URLs.

---

## Error handling

amoCRM errors должны быть нормализованы.

Safe UI error:

```text
Не удалось синхронизировать amoCRM. Повторите позже.
```

Technical safe code:

```text
AMOCRM_RATE_LIMIT
AMOCRM_AUTH_EXPIRED
AMOCRM_MAPPING_MISSING
AMOCRM_REMOTE_ERROR
```

Не показывать raw provider response with secrets.

---

## Rate limit UI

Если rate limit:

```text
amoCRM временно ограничила запросы. Синхронизация будет повторена позже.
```

Не надо показывать technical noise.

---

## Reconnect UI

Если token expired:

```text
Требуется повторное подключение amoCRM.
```

Только пользователь с integrations.configure может reconnect.

---

## Logs in reports

Task reports не должны содержать secrets.

Нельзя вставлять:

- tokens;
- client secret;
- authorization code;
- raw OAuth response;
- real webhook secret;
- real patient medical data.

Reports могут содержать:

- changed files;
- checks;
- safe notes;
- what was not implemented;
- risks.

---

## Security search for amoCRM tasks

Для amoCRM/security задач использовать проверки.

Примеры:

```text
rg -n "access_token|refresh_token|client_secret|clientSecret|authorization_code|Bearer|github_pat" .
```

Для medical leakage:

```text
rg -n "toothNumber|DentalFinding|dentalChart|riskDescription|diagnosis|clinicalNotes|MedicalDocument" backend/src src/integrations
```

Если задача docs-only, достаточно подтвердить, что implementation files не менялись.

---

## Package changes

amoCRM docs task не должен менять package files.

Package changes для real integration допускаются только отдельной задачей.

Если dependency нужна, нужно объяснить:

- зачем;
- почему без неё нельзя;
- риски;
- alternatives;
- package impact.

---

## Storage rules

amoCRM integration storage в production должен быть backend/database.

Нельзя хранить в localStorage:

- tokens;
- connection config;
- refresh token;
- client secret;
- raw OAuth response.

Можно хранить в frontend только safe UI state:

```text
connected
lastSyncAt
safeStatus
```

---

## localStorage prototype

В прототипе patient integration metadata может быть в localStorage как demo state.

Но это не production integration storage.

Reports должны честно указывать prototype limitation.

---

## Data retention

При disconnect amoCRM нужно определить retention.

Возможные варианты:

- keep external IDs for history;
- mark connection disconnected;
- remove tokens;
- keep sync logs;
- keep patient data in DentalFlow;
- stop sync.

Не удалять patients because amoCRM disconnected.

---

## Data deletion

Удаление amoCRM connection не должно удалять DentalFlow medical data.

Удаление external mapping не должно удалять patient.

Hard delete integration logs должен быть controlled.

---

## Export

Export integration logs должен быть restricted.

Sync logs могут содержать operational metadata.

Не включать medical data or secrets.

---

## Import/export medical boundary

amoCRM import/export не должен переносить medical data.

Если пользователь хочет выгрузить medical plan в amoCRM, ответ архитектуры:

```text
No by default.
Requires separate high-risk review.
```

---

## Testing amoCRM integration

Будущие тесты должны проверять:

- no medical fields in outgoing payload;
- no tokens in frontend;
- no tokens in logs;
- tenant-scoped connection;
- suspended tenant sync denied;
- missing permission denied;
- mapper allowlist;
- safe error response;
- no direct frontend API calls.

---

## Manual QA checklist

При review amoCRM задач проверять:

- changed files;
- no src direct amoCRM API calls;
- no tokens in frontend;
- no medical data in mapper;
- no toothNumber in outgoing payload;
- no riskDescription in outgoing payload;
- no medical documents in outgoing payload;
- tenant impact;
- sensitive data impact;
- storage impact;
- report;
- what was not implemented.

---

## What can be implemented early

Ранние безопасные задачи:

- docs;
- types for safe integration metadata;
- disabled UI placeholders;
- safe mapper pure functions;
- backend proxy skeleton;
- OAuth skeleton with dev-only warnings;
- status DTO;
- safe error utility;
- security rules;
- sync strategy docs.

---

## What must wait

Должно ждать:

- real sync;
- webhook processing;
- production token storage;
- automatic sync;
- queue;
- two-way sync;
- field mapping UI;
- bulk import;
- medical document sharing;
- payment provider;
- WhatsApp sync with medical texts.

---

## Risks

Главные риски amoCRM integration:

- medical data leakage;
- tokens in frontend;
- tokens in Git;
- cross-tenant token use;
- wrong tenant mapping;
- sending full patient object;
- sending full treatment plan;
- direct frontend API calls;
- no rate limit handling;
- duplicate contacts/deals;
- wrong source of truth;
- confusing deal won with treatment completed;
- suspended tenant still syncing;
- support seeing too much;
- unsafe logs.

---

## Что нельзя делать

Нельзя:

- отправлять dental chart в amoCRM;
- отправлять toothNumber в amoCRM;
- отправлять clinical findings в amoCRM;
- отправлять diagnosis в amoCRM;
- отправлять riskDescription в amoCRM;
- отправлять medical documents в amoCRM;
- отправлять medical PDF в amoCRM;
- отправлять doctor private notes в amoCRM;
- хранить amoCRM tokens во frontend;
- хранить tokens в localStorage;
- показывать tokens в UI;
- логировать tokens;
- коммитить secrets;
- делать React → amoCRM API directly;
- использовать один amoCRM token для всех tenant;
- считать leadStatus медицинским статусом;
- считать deal won выполненным лечением;
- делать real sync без backend/security foundation;
- делать webhook без tenant validation;
- использовать blacklist вместо allowlist для outgoing payload;
- отправлять full Patient object;
- отправлять full TreatmentPlan object;
- делать production claims для OAuth skeleton.

---

## Правила для ИИ-задач

Если задача касается amoCRM, integration, OAuth, sync, webhooks, mapping, source, lead status или external IDs, ИИ должен проверить:

- integration tenant-scoped;
- no direct frontend amoCRM API calls;
- no tokens in frontend/localStorage;
- no secrets in Git;
- backend/proxy is the boundary;
- payload uses allowlist;
- no medical data to amoCRM;
- no toothNumber;
- no findings;
- no riskDescription;
- no diagnosis;
- no medical documents;
- leadStatus does not change medical status;
- deal status does not complete treatment;
- suspended tenant sync denied or future-noted;
- report includes safety notes.

---

## Acceptance для amoCRM задач

amoCRM задача считается корректной, если:

- scope ограничен;
- tenant impact указан;
- storage impact указан;
- sensitive data impact указан;
- backend boundary соблюдён;
- frontend не вызывает amoCRM API напрямую;
- tokens не раскрываются;
- mapper safe and allowlisted;
- medical data не отправляется;
- errors safe;
- logs safe;
- reports honest about skeleton vs production;
- what was not implemented clearly stated.

---

## Итог

amoCRM integration в DentalFlow нужна для sales, communication и commercial follow-up.

Правильная цепочка:

```text
amoCRM lead / deal
→ DentalFlow patient
→ DentalFlow appointment / treatment plan
→ safe commercial summary
→ amoCRM follow-up / deal status
```

Главная защитная мысль:

```text
amoCRM получает коммерческую сводку,
DentalFlow хранит медицинскую реальность
```

Главная техническая мысль:

```text
Frontend
→ DentalFlow Backend / Integration Proxy
→ amoCRM API
```

Главная SaaS-мысль:

```text
каждый tenant имеет свою amoCRM connection,
свои tokens,
свои mappings,
свои sync logs
```

Если эти границы сохранить, amoCRM станет полезной интеграцией.

Если их нарушить, amoCRM превратится в внешнюю коробку для медицинских данных, токенов и будущих проблем. А это уже не интеграция, а красиво оформленная утечка.
