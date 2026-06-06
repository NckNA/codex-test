# 06_PATIENT_CARD_AND_DENTAL_CHART_RULES.md

## Назначение документа

Этот документ описывает правила карточки пациента и зубной карты в DentalFlow CRM.

Карточка пациента и зубная карта являются центральными рабочими зонами стоматологической CRM. Через них врач, администратор, кассир и владелец клиники видят разные стороны одного пациента.

Главное правило:

**карточка пациента должна объединять данные пациента, но не смешивать медицинскую, административную, коммерческую и финансовую логику в одну кашу.**

Если всё сложить на один экран и в один компонент, получится не CRM, а цифровой шкаф, куда все бросили документы и гордо назвали это “единым интерфейсом”.

---

## Главная роль карточки пациента

Patient Card — это центральная рабочая область пациента.

Она должна отвечать на вопросы:

```text
кто пациент
как с ним связаться
откуда он пришёл
что его беспокоит
какие есть записи
что видно по зубной карте
какие есть clinical findings
какие есть планы лечения
что согласовано
что выполнено
что оплачено
какие документы есть
какой следующий шаг
```

Карточка пациента не должна быть просто большой формой редактирования.

Это рабочий центр пациента.

---

## Главный UX-принцип карточки

Пользователь должен быстро понять:

```text
где я нахожусь
какого пациента я открыл
какой у пациента статус
что важно сейчас
какие есть риски
какой следующий шаг
что можно редактировать
что только для просмотра
что является медицинскими данными
что является коммерческими данными
что является финансовыми данными
```

Карточка не должна заставлять врача, администратора или кассира гадать.

Гадание — плохой UX, хотя почему-то многие системы продолжают продавать его как “гибкость”.

---

## Главные пользователи карточки пациента

Карточку пациента используют разные роли.

### Врач

Врачу важно:

- видеть жалобу;
- видеть зубную карту;
- фиксировать состояние зубов;
- создавать clinical findings;
- видеть риски;
- составлять план лечения;
- видеть историю лечения;
- формировать patient preview;
- не отвлекаться на лишнюю коммерческую шелуху.

### Администратор

Администратору важно:

- быстро найти пациента;
- увидеть телефон;
- увидеть источник обращения;
- увидеть lead status;
- записать пациента;
- увидеть следующий визит;
- увидеть статус плана;
- не редактировать медицинские данные случайно.

### Кассир

Кассиру важно:

- видеть сумму плана;
- видеть оплаты;
- видеть долг;
- фиксировать оплату;
- не менять зубную карту;
- не менять clinical findings.

### Владелец или управляющий

Владельцу важно:

- видеть общую картину пациента;
- видеть активные планы;
- видеть согласование;
- видеть оплаты;
- видеть источник;
- видеть follow-up;
- видеть эффективность процессов.

---

## PatientCardPage не должен быть God Component

PatientCardPage не должен превращаться в один огромный компонент.

Плохой вариант:

```text
PatientCardPage contains:
- patient overview
- edit form
- appointments
- dental chart
- tooth editor
- findings
- treatment plans
- documents
- payments
- amoCRM
- warehouse
- reports
- all business logic
```

Правильный вариант:

```text
PatientCardPage
→ PatientOverview
→ PatientAppointmentsTab
→ DentalChartTab
→ FindingsTab
→ TreatmentPlansTab
→ DocumentsTab
→ FinanceTab
→ PatientHistoryTab
→ IntegrationStatusBlock
```

Одна страница может объединять разделы, но каждый раздел должен иметь ограниченную ответственность.

---

## Рекомендуемая структура карточки пациента

Карточка пациента может быть разделена на вкладки или секции:

```text
Обзор
Записи
Зубная карта
Проблемы и риски
Планы лечения
Документы
Финансы
История
Комментарии
Интеграции
```

Не все вкладки нужно реализовывать сразу.

Но архитектура UI должна позволять добавлять их постепенно без переписывания всей страницы.

---

## Overview пациента

Overview должен быть кратким.

Он должен показывать:

- ФИО;
- телефон;
- возраст или дату рождения;
- источник обращения;
- lead status;
- следующий визит;
- последний визит;
- активные risks;
- активные treatment plans;
- сумму активных планов;
- balance / debt, если реализовано;
- allergy warning, если есть;
- CRM/integration status;
- краткий комментарий.

Overview не должен показывать всю медицинскую карту, все документы и все платежи сразу.

Overview — это панель управления, а не свалка деталей.

---

## Разделение блоков в overview

В overview нужно разделять:

### Identity

- ФИО;
- телефон;
- дата рождения;
- patientId, если нужен;
- tenant context, если нужен.

### Medical summary

- активная жалоба;
- allergy warning;
- active findings count;
- urgent findings;
- dental chart status.

### Commercial summary

- source;
- lead status;
- treatment plan approval;
- follow-up status;
- amoCRM status.

### Finance summary

- plan total;
- paid amount;
- debt;
- last payment.

### Operations summary

- next appointment;
- assigned doctor;
- last visit;
- pending tasks.

Эти блоки могут быть на одном экране, но не должны смешивать смыслы.

---

## Patient identity

Идентификация пациента должна быть стабильной.

Основные поля:

```text
id
tenantId
fullName
phone
dateOfBirth
gender, if needed
createdAt
updatedAt
```

Дополнительные поля:

```text
email
address
iin, if ever needed
emergencyContact
comment
```

Не все поля нужны в MVP.

Но patient identity должна быть отделена от medical findings и treatment plans.

---

## Patient source

Источник пациента относится к commercial/admin domain.

Примеры:

```text
manual
whatsapp
instagram
phone
website
amocrm
referral
return_patient
other
```

Source не является medical data.

Source может быть полезен для отчётов и amoCRM.

---

## Lead status

Lead status относится к commercial domain.

Примеры:

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

Lead status не должен автоматически менять medical status.

Плохая логика:

```text
leadStatus = treatment_completed
→ all findings completed
```

Правильная логика:

```text
leadStatus describes commercial journey
medical status remains controlled by medical workflow
```

---

## Patient comments

Комментарии пациента могут быть разных типов.

Нужно различать:

```text
admin comment
medical note
financial note
support note
```

На раннем этапе может быть одно поле comment.

Но важно не смешивать:

- врачебные заметки;
- заметки администратора;
- финансовые комментарии;
- support/debug comments.

Medical notes не должны автоматически показываться sales/receptionist roles.

---

## Allergy warning

Allergy information — sensitive medical data.

Если allergy field есть, UI должен показывать предупреждение заметно, но аккуратно.

Пример:

```text
Аллергия: лидокаин
```

или:

```text
Есть медицинские ограничения
```

Доступ к деталям может зависеть от роли.

Allergy не должна уходить в amoCRM.

---

## DentalChart как центральный медицинский блок

DentalChart — одна из главных частей стоматологической CRM.

Он должен показывать:

- зубы;
- номера зубов;
- состояние зубов;
- active findings;
- severity;
- planned treatment;
- completed treatment, когда появится;
- missing teeth;
- implants/crowns/fillings, если поддерживается.

DentalChart должен быть понятен врачу.

Он не должен быть просто декоративной картинкой.

---

## Adult dental chart

На раннем этапе можно использовать взрослую постоянную зубную карту.

FDI-нумерация взрослых зубов:

```text
18 17 16 15 14 13 12 11
21 22 23 24 25 26 27 28
48 47 46 45 44 43 42 41
31 32 33 34 35 36 37 38
```

Важно помнить:

- верхняя челюсть;
- нижняя челюсть;
- правая сторона пациента;
- левая сторона пациента.

Не путать визуальную сторону экрана и сторону пациента.

---

## Future pediatric chart

Молочные зубы и смешанный прикус — будущая задача.

Не реализовывать молочную карту случайно внутри adult chart.

Если понадобится pediatric chart, это отдельная domain/UI задача.

Будущие варианты:

```text
adult
pediatric
mixed
```

Но MVP может быть adult-only.

---

## Tooth entity

Зуб в UI должен иметь стабильную модель.

Минимально:

```text
toothNumber
state
activeFindings
severity
linkedTreatmentStages
```

Возможные дополнительные поля:

```text
surfaces
notes
lastUpdatedAt
lastUpdatedBy
history
```

Не всё нужно сразу.

---

## ToothNumber

ToothNumber должен быть валидным.

Для adult chart допустимые номера:

```text
11,12,13,14,15,16,17,18
21,22,23,24,25,26,27,28
31,32,33,34,35,36,37,38
41,42,43,44,45,46,47,48
```

Нельзя принимать произвольный toothNumber без проверки.

JavaScript примет почти всё, включая архитектурные преступления, поэтому проверка нужна явно.

---

## ToothState

ToothState описывает базовое состояние зуба.

Возможные состояния:

```text
healthy
missing
filled
crown
implant
root
treated
needs_attention
unknown
```

Финальный список может уточняться.

ToothState не должен подменять clinical finding.

---

## ToothState и DentalFinding

ToothState — состояние зуба.

DentalFinding — конкретная клиническая находка.

Пример:

```text
ToothState:
filled

DentalFinding:
secondary caries near old filling
```

Пример:

```text
ToothState:
missing

DentalFinding:
need prosthetic replacement
```

Нельзя хранить все проблемы зуба только в ToothState.

Это быстро уничтожит смысл истории, severity, статусов и планов лечения.

---

## Surfaces

В будущем можно поддержать поверхности зуба.

Примеры:

```text
mesial
distal
occlusal
buccal
lingual
palatal
incisal
```

Для MVP surfaces можно не реализовывать.

Если реализуются surfaces, они должны быть связаны с toothNumber and finding.

Не нужно добавлять surfaces без UI и domain rules.

---

## DentalFinding на зубной карте

DentalFinding должен быть связан с toothNumber, если относится к конкретному зубу.

Но не все findings обязательно tooth-specific.

Примеры non-tooth-specific findings:

- generalized gum issue;
- occlusion problem;
- esthetic problem;
- hygiene issue;
- orthodontic issue;
- prosthetic issue.

Модель должна позволять:

```text
toothNumber optional
```

или отдельную структуру для general findings.

Не надо насильно привязывать всё к одному зубу, если проблема общая.

---

## Active findings indicator

Зубная карта должна показывать active findings.

Active findings могут иметь статусы:

```text
discovered
planned
in_treatment
monitoring
```

Completed, declined или archived findings не должны выглядеть как активная проблема.

---

## Severity indicator

Если у зуба несколько active findings, UI должен показывать самый высокий severity.

Пример порядка:

```text
urgent
high
medium
low
```

Зуб с urgent finding должен быть заметен.

Но не надо превращать карту в новогоднюю гирлянду из тревожных значков. Врач должен видеть важное, а не бороться с визуальной паникой.

---

## Finding statuses на карте

Статусы finding:

```text
discovered
planned
in_treatment
completed
declined_by_patient
monitoring
archived
```

Визуальная логика:

- discovered → active issue;
- planned → included in treatment plan;
- in_treatment → work started;
- completed → no longer active;
- declined_by_patient → not active but important history;
- monitoring → watch status;
- archived → historical.

UI должен отличать активные и исторические состояния.

---

## Planned treatment indicator

Если finding включён в treatment plan, карта может показывать planned indicator.

Важно:

```text
planned ≠ completed
```

Планирование лечения не означает, что зуб вылечен.

Не меняйте ToothState на treated только потому, что stage добавлен в plan.

---

## Completed treatment indicator

Completed treatment должен появляться только после фактически оказанной услуги или подтверждённого medical workflow.

Не из appointment.

Не из payment.

Не из treatment plan approval.

Правильная логика:

```text
CompletedService created
→ related finding may become completed
→ tooth history updated
```

На раннем этапе CompletedService может быть future entity.

---

## Tooth selection

При выборе зуба UI должен показывать:

- toothNumber;
- текущий ToothState;
- active findings;
- linked treatment stages;
- notes, если есть;
- действия для врача.

Выбор зуба не должен автоматически создавать finding.

Выбор зуба — это навигация.

Создание finding — отдельное осознанное действие.

---

## Tooth editor

Tooth editor должен быть компактным и понятным.

Может включать:

- ToothState;
- surfaces, если реализованы;
- notes;
- active findings;
- кнопка add finding;
- кнопка link to treatment plan;
- history, если реализована.

Tooth editor не должен быть огромной формой всего пациента.

---

## Add finding flow

Создание finding должно быть понятным.

Минимальные поля:

```text
toothNumber, if applicable
category
title
description
severity
status
riskDescription, optional
```

На раннем этапе можно упростить.

Но finding должен оставаться отдельной сущностью.

---

## Finding category

Примеры category:

```text
caries
pulpitis
periodontitis
missing_tooth
fracture
old_restoration_problem
gum_problem
esthetic_problem
prosthetic_problem
orthodontic_problem
implant_related
other
```

Категории должны быть стабильными.

Не надо каждый раз писать произвольную категорию, если потом нужны фильтры и отчёты.

---

## Finding title и description

Title — короткое название.

Description — подробность.

Пример:

```text
title:
Кариозное поражение

description:
Визуально определяется кариозная полость на 47 зубе.
```

Description может быть sensitive medical data.

Не отправлять в amoCRM.

---

## RiskDescription

RiskDescription — медицинское объяснение риска.

Пример:

```text
При отсутствии лечения возможно усиление боли или дальнейшее разрушение зуба.
```

RiskDescription может использоваться для patient preview, если врач контролирует текст.

RiskDescription не должен уходить в amoCRM.

---

## Patient-facing text

Текст для пациента должен отличаться от внутренней врачебной заметки.

Внутренний текст может быть медицинским.

Patient-facing text должен быть:

- понятным;
- спокойным;
- без лишней технической детализации;
- без запугивания;
- проверенным врачом.

Не все clinical notes должны попадать в patient preview.

---

## PatientPreview из карточки пациента

Карточка пациента может иметь переход к patient preview.

PatientPreview должен показывать:

- пациенту понятную проблему;
- план лечения;
- этапы;
- стоимость;
- предупреждения;
- рекомендации;
- контакты клиники.

Не показывать:

- internal IDs;
- syncStatus;
- amoCRM fields;
- debug data;
- tokens;
- raw clinical notes;
- raw riskDescription без адаптации.

---

## Treatment plan связь с картой

TreatmentPlan может быть связан с findings.

Правильная связь:

```text
DentalFinding
→ linkedTreatmentPlanIds
→ TreatmentStage linkedFindingIds
```

План может включать:

- один finding;
- несколько findings;
- несколько stages;
- альтернативные варианты в будущем.

Не удалять finding при создании плана.

---

## Create plan from findings

Если UI позволяет создать plan from findings, нужно соблюдать правила:

- selected findings remain existing;
- plan references findings;
- finding status may become planned only if workflow allows;
- plan stages created separately;
- doctor can review before saving;
- no automatic completed status.

Плохой вариант:

```text
selected finding
→ create plan
→ finding completed
```

Правильный вариант:

```text
selected finding
→ create draft plan
→ finding linked/planned
```

---

## Findings tab

Карточка пациента должна иметь отдельный блок или вкладку findings.

Findings list должен показывать:

- toothNumber;
- category;
- title;
- severity;
- status;
- linked plan;
- createdAt;
- responsible doctor, if available.

Фильтры в будущем:

```text
active
planned
completed
urgent
by tooth
by category
```

---

## Dental chart и Findings tab

DentalChart даёт визуальную карту.

FindingsTab даёт список и детализацию.

Они должны быть связаны, но не заменять друг друга.

Карта удобна для визуального осмотра.

Список удобен для контроля, фильтров и планирования.

---

## Карточка пациента и расписание

Карточка пациента может показывать appointment history.

Но appointment не должен менять medical status автоматически.

В карточке можно показывать:

- next appointment;
- past appointments;
- appointment status;
- doctor;
- reason;
- linked plan, if any.

Но:

```text
appointment completed ≠ treatment completed
```

---

## Карточка пациента и финансы

Finance section может показывать:

- total planned amount;
- paid amount;
- debt;
- payments;
- refunds;
- balance.

Но finance section не должен менять medical facts.

Payment не закрывает finding.

Payment не завершает stage.

Payment не создаёт CompletedService.

---

## Карточка пациента и документы

Documents section может показывать:

- document type;
- status;
- createdAt;
- createdBy;
- linked treatment plan;
- preview/print/export actions.

Document должен быть snapshot-based, когда сохранён.

Patient preview не равен saved document.

---

## Карточка пациента и amoCRM

amoCRM block в карточке пациента должен быть safe.

Можно показывать:

- source;
- lead status;
- sync status;
- lastSyncAt;
- lastSyncError safe message;
- externalContactId, если нужно;
- externalLeadId/dealId, если нужно.

Нельзя показывать:

- access token;
- refresh token;
- client secret;
- raw token response;
- raw webhook payload;
- full medical payload.

Нельзя отправлять dental chart или findings в amoCRM.

---

## CRM metadata

Integration metadata пациента может включать:

```text
source
leadStatus
externalContactId
externalLeadId
syncStatus
lastSyncAt
lastSyncError
```

Эти поля относятся к integration/commercial domain.

Они не должны смешиваться с medical findings.

---

## PatientCardPage и role-aware UI

Карточка пациента должна учитывать роль.

### Doctor

Видит medical blocks.

### Receptionist

Видит identity, appointments, source, lead status, limited plan summary.

### Cashier

Видит finance and payments.

### Sales manager

Видит commercial summary and follow-up.

### Clinic owner

Видит full clinic-level summary according to permissions.

### Platform support

Видит только то, что разрешено support access.

---

## Role boundaries

Нельзя показывать всем всё.

Примеры:

- receptionist не редактирует dental chart;
- cashier не редактирует findings;
- sales_manager не видит full clinical notes;
- marketer не видит detailed medical data;
- support не видит всё без temporary access;
- platform owner не является скрытым medical superuser.

---

## Empty states

Пустые состояния должны быть полезными.

Плохо:

```text
Нет данных
```

Лучше:

```text
У пациента пока нет клинических находок.
Добавьте находку после осмотра.
```

Или:

```text
План лечения пока не создан.
Создайте план вручную или на основе выявленных проблем.
```

Пустой экран должен объяснять следующий шаг.

---

## Loading states

Карточка пациента должна показывать loading state.

Примеры:

```text
Загрузка карточки пациента...
Загрузка зубной карты...
Сохранение изменений...
Формирование preview...
```

Пользователь должен понимать, что система работает.

Молчаливый экран — это не минимализм, это тревожный UX.

---

## Error states

Ошибки должны быть безопасными.

Пример:

```text
Не удалось загрузить карточку пациента.
Проверьте подключение и повторите попытку.
```

Если доступ запрещён:

```text
Недостаточно прав для просмотра карточки пациента.
```

Не показывать:

- stack trace;
- raw API response;
- tokens;
- tenant internals;
- чужие entity details.

---

## Save states

При сохранении важных медицинских данных UI должен явно показывать результат.

Примеры:

```text
Сохранение...
Изменения сохранены.
Не удалось сохранить.
```

Для medical data лучше не делать невидимый autosave без статуса.

Если autosave появится, он должен быть понятным и безопасным.

---

## Unsaved changes

Если врач редактирует зубную карту, finding или план лечения и пытается уйти, UI должен предупредить:

```text
Есть несохранённые изменения.
```

Особенно для:

- ToothState;
- DentalFinding;
- TreatmentPlan;
- ClinicalNote;
- MedicalDocument draft.

---

## Destructive actions

Опасные действия должны требовать подтверждения.

Опасные действия:

- архивировать пациента;
- удалить/архивировать finding;
- отменить план лечения;
- отменить документ;
- отменить оплату;
- очистить зубную карту;
- удалить appointment;
- disconnect amoCRM.

UI должен объяснить последствия.

---

## Soft delete в карточке пациента

Для важных сущностей лучше использовать archive/cancelled вместо hard delete.

Примеры:

```text
Patient archived
Finding archived
TreatmentPlan cancelled
Document cancelled
```

История должна сохраняться.

Особенно для medical data.

---

## История пациента

Patient history может быть отдельной вкладкой.

Она может включать:

- appointments;
- findings;
- treatment plans;
- documents;
- payments;
- completed services;
- comments;
- audit events, if allowed.

Не нужно показывать весь audit log всем ролям.

---

## Audit в карточке пациента

В будущем можно показывать ограниченную историю изменений.

Например:

- кто создал finding;
- кто изменил plan;
- кто сформировал document;
- кто отменил appointment;
- кто принял payment.

Но audit details должны быть role-aware.

---

## Performance rules

Карточка пациента не должна грузить всё сразу без нужды.

Не нужно:

- загружать все документы полностью при открытии overview;
- загружать full audit log;
- загружать все PDF;
- пересчитывать все отчёты;
- загружать данные других patients.

Лучше:

- lazy load вкладки;
- load summary first;
- load details on demand.

---

## Data loading strategy

Рекомендуемая будущая логика:

```text
Patient summary
→ Dental chart
→ Active findings
→ Treatment plan summaries
→ Appointment summaries
→ Finance summary
→ Details on tab open
```

В прототипе может быть проще.

Но архитектура не должна вести к огромному payload “всё обо всём”.

---

## PatientCard DTO

В будущем backend должен отдавать safe DTO.

Пример:

```text
PatientCardDto
- patient
- permissions
- summary
- medicalSummary
- commercialSummary
- financeSummary
- integrationSummary
```

DTO должен быть role-aware.

Не возвращать full database object всем ролям.

---

## DentalChart DTO

DentalChart DTO может включать:

```text
patientId
tenantId
teeth
activeFindingsSummary
lastUpdatedAt
```

Tooth DTO:

```text
toothNumber
state
highestSeverity
activeFindingCount
plannedStageCount
completedServiceCount
```

Details можно загружать отдельно.

---

## ToothDetails DTO

ToothDetails может включать:

```text
toothNumber
state
surfaces
activeFindings
linkedTreatmentStages
history
notes
```

Role-aware filtering обязателен.

Sales role не должен получать clinical details.

---

## PatientCard и tenant isolation

PatientCard всегда tenant-scoped.

Нельзя открыть patient card без проверки:

```text
user belongs to tenant
patient belongs to tenant
permission exists
tenant access allowed
```

Плохой вариант:

```text
GET /patients/:patientId
```

Правильный future-вариант:

```text
GET /api/tenants/:tenantId/patients/:patientId/card
```

---

## PatientCard и stale tenant data

При смене tenant UI должен очищать открытого пациента.

Плохой сценарий:

```text
open Patient A in Tenant A
switch to Tenant B
Patient A still visible
```

Это cross-tenant leak.

Frontend должен сбрасывать patient-scoped state при смене tenant.

---

## Search patients

Поиск пациентов должен быть tenant-scoped.

Можно искать по:

- ФИО;
- телефону;
- source;
- lead status;
- external ID, если нужно;
- patient number, если появится.

Обычный clinic user не должен искать patients across all tenants.

---

## Patient list и PatientCard

PatientsPage показывает список.

PatientCard показывает детали.

PatientsPage не должен загружать всю зубную карту каждого пациента.

Список должен содержать summary:

- ФИО;
- телефон;
- source;
- lead status;
- next appointment;
- active plan status;
- balance summary, если разрешено.

Детали загружаются в карточке.

---

## Dental chart visual rules

Зубная карта должна быть визуально понятной.

Правила:

- одинаковый статус выглядит одинаково;
- active problem заметна;
- urgent выделяется;
- completed не выглядит как active problem;
- missing tooth отличается;
- planned treatment отличается от completed;
- selected tooth clearly highlighted;
- цвет не является единственным носителем смысла.

Цвета должны помогать, а не устраивать врачу экзамен на выносливость.

---

## Accessibility

Dental chart UI должен учитывать accessibility.

Правила:

- не полагаться только на цвет;
- использовать labels/tooltips;
- выбранный зуб должен быть понятен;
- контраст достаточный;
- кликабельная область нормальная;
- keyboard navigation желательна в будущем;
- error messages рядом с действиями.

---

## Mobile limitations

Зубная карта сложна для mobile.

Mobile может поддерживать:

- просмотр карточки;
- быстрый звонок;
- просмотр записей;
- краткий summary;
- просмотр plan preview.

Полное редактирование dental chart лучше оптимизировать для desktop/tablet.

Стоматологическая карта на маленьком экране — это не невозможность, но точно не место для героизма без отдельного UI-плана.

---

## PatientCard на tablet

Tablet может быть удобен врачу.

Для tablet важно:

- крупная зубная карта;
- быстрый выбор зуба;
- side panel для tooth details;
- удобное создание finding;
- patient preview.

Это future UI improvement.

---

## Side panel для зуба

Для ToothDetails можно использовать side panel.

Преимущества:

- сохраняет контекст карты;
- показывает детали выбранного зуба;
- не перекрывает всю карту;
- удобно для врача.

Модалка тоже возможна, но не должна превращаться в многоэтажную форму.

---

## Modals

Модалки подходят для:

- быстрый edit patient;
- add finding;
- confirm action;
- edit appointment;
- small payment entry.

Модалки не подходят для:

- полной карточки пациента;
- огромного treatment plan;
- полного документа;
- большого audit log.

---

## Dental chart history

В будущем нужна история изменений зубной карты.

Минимально:

```text
changedAt
changedBy
toothNumber
oldState
newState
reason
```

На раннем этапе full history можно не делать.

Но нельзя проектировать так, что dental chart silently overwrites without trace forever.

---

## Findings history

Finding status changes должны быть отслеживаемыми.

Пример:

```text
discovered → planned
planned → in_treatment
in_treatment → completed
```

В будущем важно знать:

- кто изменил статус;
- когда;
- почему;
- связано ли с treatment stage;
- связано ли с completed service.

---

## Medical safety in UI

UI не должен автоматически делать медицинские выводы.

Плохие автоматизации:

```text
payment received → finding completed
appointment completed → tooth treated
plan approved → treatment done
lead status treatment_completed → all stages completed
```

Правильная логика:

```text
doctor confirms medical completion
```

---

## Dental chart and amoCRM

Dental chart не должна отправляться в amoCRM.

Запрещено отправлять:

- toothNumber;
- tooth state;
- findings;
- severity;
- riskDescription;
- clinical notes;
- dental chart image;
- medical document.

amoCRM получает только safe commercial summary.

---

## PatientCard integration safety

Integration block не должен смешиваться с medical tabs.

Лучше:

```text
CRM / integrations block
```

отдельно от:

```text
Dental chart / findings
```

Пользователь должен понимать, что amoCRM — это sales/integration, а не медицинская карта.

---

## Print / PDF from PatientCard

Если из карточки пациента будет print/PDF, это отдельная задача.

Нельзя просто печатать весь экран карточки.

Patient-facing document должен быть:

- curated;
- snapshot-based;
- без technical fields;
- без tokens;
- без internal notes;
- без raw sync data.

---

## Patient archive

Архивирование пациента должно быть осторожным.

Patient archive не должен удалять:

- dental chart;
- findings;
- treatment plans;
- documents;
- payments;
- audit logs.

Archive может скрывать пациента из активных списков.

Hard delete — отдельная owner-level процедура.

---

## Duplicate patients

В будущем нужна логика duplicate detection.

Признаки:

- same phone;
- same fullName;
- same dateOfBirth;
- externalContactId.

Но duplicate detection должен быть tenant-scoped.

Один и тот же человек может быть пациентом двух разных клиник.

---

## Merge patients

Merge patients — dangerous operation.

Не реализовывать без отдельной задачи.

Merge должен учитывать:

- appointments;
- dental chart;
- findings;
- treatment plans;
- documents;
- payments;
- external IDs;
- audit;
- rollback risk.

На раннем этапе можно только помечать возможный duplicate.

---

## Patient import

Patient import должен быть tenant-scoped и validated.

Не реализовывать без отдельной задачи.

Import может сломать:

- IDs;
- телефоны;
- duplicate detection;
- dental chart;
- external mappings.

Нужен import report.

---

## Patient export

Patient export должен быть permission-protected.

Export может содержать sensitive data.

Нужны:

- permission;
- tenant scope;
- audit;
- role-aware fields;
- safe file generation.

Обычный receptionist не должен экспортировать всю базу без разрешения.

---

## Что нельзя делать

Нельзя:

- превращать PatientCardPage в God Component;
- смешивать medical, commercial, finance и integration logic в один блок;
- считать appointment лечением;
- считать payment лечением;
- считать treatment plan выполненной услугой;
- менять ToothState автоматически из payment;
- закрывать finding автоматически из lead status;
- отправлять dental chart в amoCRM;
- показывать clinical notes sales_manager без permission;
- показывать finance всем врачам без permission;
- печатать весь PatientCard как официальный документ;
- хранить production patient card только в localStorage;
- показывать данные другого tenant после tenant switch;
- грузить все details всех пациентов на PatientsPage;
- удалять patient medical history hard delete без процедуры.

---

## Правила для ИИ-задач

Если задача касается PatientCard, DentalChart, Findings или Patient UI, ИИ должен проверить:

- не стал ли компонент слишком большим;
- не смешаны ли домены;
- не нарушена ли tenant isolation;
- не отправляются ли medical data в amoCRM;
- не меняются ли medical statuses из finance/schedule;
- не показываются ли sensitive details неправильной роли;
- есть ли empty/loading/error states;
- есть ли safe disabled states;
- не ломается ли patient preview;
- не используется ли localStorage как production storage;
- есть ли report with safety notes.

---

## Acceptance для задач по карточке пациента

Задача считается корректной, если:

- scope ограничен;
- PatientCard responsibilities понятны;
- medical/commercial/finance/integration blocks разделены;
- DentalChart не смешан с TreatmentPlan;
- ToothState не смешан с DentalFinding;
- finding lifecycle не нарушен;
- appointment/payment не закрывают medical statuses;
- tenant impact указан;
- sensitive data impact указан;
- no medical data to amoCRM;
- UI states безопасны;
- report создан.

---

## Итог

Карточка пациента и зубная карта — центральные элементы DentalFlow.

Правильная структура:

```text
PatientCard
→ Overview
→ Appointments
→ DentalChart
→ Findings
→ TreatmentPlans
→ Documents
→ Finance
→ History
→ Integrations
```

Главная медицинская связка:

```text
DentalChart
→ ToothState
→ DentalFinding
→ TreatmentPlan
→ TreatmentStage
→ CompletedService
```

Главная защитная мысль:

```text
карточка пациента объединяет данные,
но не смешивает смыслы
```

DentalFlow должна дать врачу удобную зубную карту, администратору понятный статус пациента, кассиру финансовый блок, владельцу контроль, а системе — безопасные границы.

Если PatientCard станет свалкой всего подряд, проект будет выглядеть богатым, но работать плохо.

Если границы сохранить, DentalFlow можно развивать как нормальную стоматологическую SaaS CRM, а не как очередную страницу, где “всё есть”, но никто не понимает, что трогать нельзя.
