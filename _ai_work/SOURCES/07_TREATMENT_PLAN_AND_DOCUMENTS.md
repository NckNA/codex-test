# 07_TREATMENT_PLAN_AND_DOCUMENTS.md

## Назначение документа

Этот документ описывает правила работы с планами лечения, patient preview и документами в DentalFlow CRM.

План лечения является одним из главных элементов стоматологической CRM, потому что он связывает медицинскую часть, коммерческую часть, объяснение для пациента, документы, согласование, оплату и будущий факт оказанной услуги.

Главное правило:

**план лечения — это намерение и предложение лечения, а не факт выполненной услуги.**

Второе главное правило:

**patient preview — это предпросмотр для пациента, а не сохранённый официальный документ.**

Третье главное правило:

**сохранённый документ должен быть snapshot, а не живой экран, который меняется задним числом.**

Если эти правила нарушить, DentalFlow быстро превратится в систему, где лечение “выполнено”, потому что план согласован, документ “подписан”, потому что вкладка открыта, а старые документы меняются сами, потому что кто-то поправил цену. Очень удобно, если цель — создать юридический аттракцион.

---

## Главная цепочка

Правильная цепочка работы:

```text
DentalFinding
→ TreatmentPlan
→ TreatmentStage
→ PatientPreview
→ MedicalDocument
→ CompletedService
→ Payment
```

Эта цепочка показывает смысловые связи.

Она не означает, что каждый шаг всегда обязателен.

Но она фиксирует границы:

- finding описывает проблему;
- treatment plan описывает предлагаемые действия;
- treatment stage разбивает план на этапы;
- patient preview показывает пациенту понятную версию;
- medical document фиксирует snapshot;
- completed service фиксирует факт выполненной услуги;
- payment фиксирует финансовый факт.

---

## TreatmentPlan

TreatmentPlan — план лечения.

TreatmentPlan описывает, что клиника предлагает пациенту сделать.

TreatmentPlan может содержать:

- медицинское основание;
- список связанных findings;
- этапы лечения;
- стоимость;
- сроки;
- врача;
- статус согласования;
- patient-facing explanation;
- документы;
- коммерческий статус;
- связь с amoCRM через safe summary.

TreatmentPlan не является:

- диагнозом;
- фактом лечения;
- выполненной услугой;
- оплатой;
- документом;
- записью на приём;
- гарантийным обязательством сам по себе.

---

## TreatmentPlan как медицинско-коммерческая сущность

План лечения находится на границе medical и commercial domains.

Medical part:

- какие проблемы выявлены;
- какие зубы или зоны затронуты;
- какие этапы нужны;
- какие риски есть;
- что предлагает врач.

Commercial part:

- стоимость;
- скидка, если появится;
- статус согласования;
- срок действия предложения;
- сумма для пациента;
- follow-up;
- amoCRM safe commercial status.

Эти части связаны, но не должны смешиваться бесконтрольно.

---

## TreatmentPlan не равен DentalFinding

DentalFinding — это выявленная проблема.

TreatmentPlan — это предложение, что с этой проблемой делать.

Пример:

```text
DentalFinding:
Кариозная полость на 47 зубе.

TreatmentPlan:
Лечение кариеса 47 зуба с восстановлением пломбой.
```

Finding может существовать без плана.

Plan может включать несколько findings.

Plan может иметь несколько вариантов в будущем.

---

## TreatmentPlan не равен Diagnosis

TreatmentPlan не должен автоматически создавать diagnosis.

Если diagnosis появится в системе, он должен быть отдельной сущностью или отдельным полем под контролем врача.

Плохая логика:

```text
finding category = caries
→ diagnosis auto-created
→ treatment plan auto-approved
```

Правильная логика:

```text
doctor reviews finding
doctor creates treatment plan
diagnosis, if supported, is controlled separately
```

Система не должна играть в врача. У нас и так достаточно людей, которые играют в архитекторов без схемы.

---

## TreatmentPlan не равен CompletedService

TreatmentPlan — это намерение.

CompletedService — это факт.

Плохая логика:

```text
plan approved
→ service completed
```

Правильная логика:

```text
plan approved
→ treatment can start
→ doctor performs service
→ completed service is created
```

Пациент может согласовать план и не прийти.

Пациент может согласовать только часть плана.

Лечение может быть перенесено.

План может измениться.

---

## TreatmentPlan не равен Payment

Оплата не означает, что лечение выполнено.

Плохая логика:

```text
payment created
→ treatment plan completed
→ findings completed
```

Правильная логика:

```text
payment created
→ financial status updated
doctor performs treatment
→ completed service created
→ medical status updated
```

Payment — финансовый факт.

Treatment completion — медицинский факт.

---

## TreatmentPlan не равен Appointment

Appointment — запись на приём.

TreatmentPlan — план лечения.

Плохая логика:

```text
appointment completed
→ treatment plan completed
```

Правильная логика:

```text
appointment happened
→ doctor records what was actually done
→ completed service may be created
```

Пациент мог прийти на консультацию, но лечение не проводилось.

Пациент мог прийти на этап лечения, но выполнить только часть.

---

## Основная структура TreatmentPlan

Будущая структура TreatmentPlan может быть такой:

```text
TreatmentPlan
- id
- tenantId
- patientId
- title
- description
- status
- linkedFindingIds
- stages
- totalAmount
- currency
- createdBy
- createdAt
- updatedAt
- proposedAt
- approvedAt
- declinedAt
- archivedAt
- patientPreviewId
- documentIds
- commercialStatus
- source
```

Не все поля должны быть реализованы сразу.

Но структура должна сохранять границы между планом, документом, услугой и оплатой.

---

## TreatmentPlan status

Возможные статусы плана:

```text
draft
proposed
approved
declined
in_progress
partially_completed
completed
cancelled
archived
```

### draft

План создаётся врачом или клиникой, ещё не готов к показу пациенту.

### proposed

План готов к показу пациенту.

### approved

Пациент согласовал план.

### declined

Пациент отказался.

### in_progress

По плану начато лечение.

### partially_completed

Часть этапов выполнена.

### completed

Все этапы плана выполнены как completed services.

### cancelled

План отменён.

### archived

План больше не активен, но хранится в истории.

---

## Статусы не должны меняться магически

Статус TreatmentPlan не должен меняться без понятного действия.

Запрещённые автоматические переходы:

```text
payment created → plan completed
appointment completed → plan completed
document generated → plan approved
patient preview opened → plan proposed
amoCRM deal won → plan completed
```

Допустимые controlled transitions:

```text
doctor marks plan as proposed
patient approves plan
doctor starts treatment
doctor/case manager marks stage completed after service
clinic archives old plan
```

---

## TreatmentStage

TreatmentStage — этап плана лечения.

TreatmentStage нужен, чтобы разбить план на понятные части.

Stage может содержать:

```text
id
treatmentPlanId
tenantId
patientId
title
description
order
linkedFindingIds
toothNumbers
priceAmount
currency
status
plannedDoctorId
estimatedDuration
completedServiceIds
createdAt
updatedAt
```

Не все поля обязательны для MVP.

---

## TreatmentStage status

Возможные статусы этапа:

```text
planned
approved
in_progress
completed
declined
cancelled
archived
```

Stage не должен становиться completed из-за оплаты.

Stage не должен становиться completed из-за appointment status.

Stage должен становиться completed только через медицинско-операционный workflow.

---

## TreatmentStage и DentalFinding

Stage может быть связан с одним или несколькими findings.

Пример:

```text
Finding 1:
Кариес 47 зуба

Stage:
Лечение 47 зуба
```

Пример:

```text
Findings:
- отсутствие 36 зуба
- отсутствие 37 зуба

Stage:
Ортопедическое восстановление жевательной группы слева
```

Связь должна быть reference, а не копирование и удаление finding.

---

## TreatmentStage и ToothNumber

Stage может ссылаться на toothNumbers, если лечение связано с конкретными зубами.

Но toothNumbers являются medical data.

Их нельзя отправлять в amoCRM.

В patient-facing document toothNumbers можно показывать только если это нужно и врач согласен.

---

## TreatmentStage и цена

Stage может иметь цену.

Пример:

```text
priceAmount: 45000
currency: "KZT"
```

Price — коммерческая часть плана.

Price не означает payment.

Price не означает completed service.

Price не должен автоматически списывать склад.

---

## Total amount

Total amount плана должен рассчитываться из stage prices или храниться как snapshot.

Для live plan:

```text
totalAmount = sum(stages.priceAmount)
```

Для document snapshot:

```text
snapshot.totalAmount = value at document creation time
```

Если цены в плане изменились после создания документа, старый документ не должен поменяться.

---

## Currency

Currency должна быть явной.

Для Казахстана базовая валюта:

```text
KZT
```

Плохой вариант:

```text
price: 250000
```

Лучше:

```text
amount: 250000
currency: "KZT"
```

В будущем tenant может иметь default currency.

---

## Discounts

Скидки — будущая задача.

Если скидки появятся, нужно явно различать:

```text
base amount
discount amount
discount reason
final amount
approved by
```

Нельзя просто менять цену без истории, если документ уже создан или план согласован.

Скидка влияет на commercial/finance domain, но не на medical status.

---

## Alternative treatment plans

В будущем пациенту можно предлагать альтернативные планы.

Пример:

```text
Plan A: базовое лечение
Plan B: расширенное лечение
Plan C: ортопедический вариант
```

Альтернативные планы должны быть отдельными TreatmentPlan или вариантами внутри одного case.

Не реализовывать без отдельной задачи.

Важно:

- alternatives не должны перезаписывать друг друга;
- patient approval должен быть связан с конкретным вариантом;
- documents должны snapshot конкретного варианта.

---

## TreatmentPlan approval

Approval — согласование пациентом.

Approval не равен выполнению лечения.

Approval может фиксировать:

```text
approvedAt
approvedBy
approvalMethod
comment
documentId
```

В будущем approval может быть:

- устным;
- через подпись;
- через документ;
- через электронную форму.

Не реализовывать юридически значимую подпись без отдельной задачи.

---

## Declined treatment

Пациент может отказаться от плана или части плана.

Declined не должен удалять findings.

Правильная логика:

```text
plan declined
→ plan status declined
→ related findings may become declined_by_patient or remain monitoring
→ history preserved
```

Отказ пациента важен для follow-up и медицинской истории.

---

## PatientPreview

PatientPreview — понятное представление плана для пациента.

PatientPreview нужен, чтобы показать пациенту:

- что обнаружено;
- что предлагается;
- какие этапы лечения;
- сколько стоит;
- почему важно не откладывать;
- какие есть варианты;
- что будет следующим шагом.

PatientPreview должен быть patient-facing.

Он не должен быть техническим dump из базы.

---

## PatientPreview не равен MedicalDocument

PatientPreview — предпросмотр.

MedicalDocument — сохранённый документ.

Плохая логика:

```text
preview opened
→ document created
```

Правильная логика:

```text
preview opened
→ user reviews content
→ user clicks generate document
→ snapshot created
```

Preview может меняться вместе с plan.

Saved document не должен меняться автоматически.

---

## PatientPreview content

PatientPreview может содержать:

- данные пациента;
- название клиники;
- врач;
- краткое описание;
- понятный список проблем;
- этапы лечения;
- стоимость;
- рекомендации;
- предупреждения;
- дату формирования;
- контакт клиники.

PatientPreview не должен содержать:

- internal IDs;
- tenantId;
- syncStatus;
- raw amoCRM fields;
- access tokens;
- debug data;
- raw API errors;
- private clinical notes;
- full audit logs;
- technical metadata.

---

## Patient-facing language

Текст для пациента должен быть:

- понятным;
- спокойным;
- аккуратным;
- без лишнего запугивания;
- без слишком технических терминов без объяснения;
- проверяемым врачом.

Плохой текст:

```text
У вас всё плохо, срочно лечить.
```

Лучший текст:

```text
Врач выявил проблему, которую желательно не откладывать, чтобы снизить риск осложнений.
```

Система должна помогать объяснять, а не пугать пациента ради продажи. Удивительно, но этика иногда ещё нужна.

---

## RiskDescription в preview

RiskDescription может использоваться в patient preview только аккуратно.

Внутренний riskDescription может быть более медицинским.

Patient-facing risk text должен быть адаптирован.

RiskDescription не должен автоматически уходить в amoCRM.

---

## MedicalDocument

MedicalDocument — сохранённый документ.

Документ должен фиксировать данные на момент создания.

MedicalDocument может быть:

- план лечения;
- информированное согласие;
- договор;
- акт;
- рекомендации;
- выписка;
- направление;
- финансовая выписка;
- отказ от лечения.

Не все типы документов нужны сразу.

---

## MedicalDocument snapshot

Главное правило:

**сохранённый документ должен быть snapshot.**

Snapshot означает:

```text
данные документа сохранены такими,
какими они были на момент создания документа
```

Если потом изменился пациент, план, цена, врач, клиника или шаблон, старый документ не должен молча измениться.

---

## Почему snapshot обязателен

Без snapshot возникает проблема:

```text
2026-06-01:
пациенту показали план на 250000 KZT

2026-06-10:
цены изменили на 300000 KZT

если документ live:
старый документ внезапно показывает 300000 KZT
```

Это недопустимо.

Документ должен хранить значения на момент создания.

---

## Document snapshot content

Snapshot может включать:

```text
documentId
tenantId
patientSnapshot
clinicSnapshot
doctorSnapshot
treatmentPlanSnapshot
stageSnapshots
amountSnapshot
currency
templateVersion
createdAt
createdBy
documentText
```

Snapshot должен включать только нужные данные.

Не включать secrets, tokens, raw sync payloads.

---

## Patient snapshot

Patient snapshot может содержать:

```text
fullName
phone
dateOfBirth
patientNumber, if exists
```

Не обязательно включать все данные пациента.

Документ должен включать только то, что нужно для конкретного типа документа.

---

## Clinic snapshot

Clinic snapshot может содержать:

```text
clinicName
address
phone
bin, if needed
licenseInfo, if needed
logo, if supported
```

Каждый tenant должен иметь свои clinic requisites.

Документы разных клиник не должны использовать один общий реквизитный блок без tenant override.

---

## Doctor snapshot

Doctor snapshot может содержать:

```text
doctorName
position
licenseInfo, if needed
signature, if supported
```

Если врач в будущем изменил имя или должность, старый документ должен сохранить данные на момент создания.

---

## TreatmentPlan snapshot

TreatmentPlan snapshot может содержать:

```text
planTitle
planStatus
stages
totalAmount
currency
patientExplanation
riskText
approvalText
createdAt
```

Snapshot должен быть очищен от internal/debug fields.

---

## Stage snapshot

Stage snapshot может содержать:

```text
title
description
priceAmount
currency
order
patientFacingText
```

Медицинские детали должны быть адаптированы для пациента.

Не все internal findings нужно показывать.

---

## DocumentTemplate

DocumentTemplate — шаблон документа.

Шаблоны должны быть tenant-scoped или иметь tenant overrides.

Template может содержать:

```text
id
tenantId
type
name
version
content
isActive
createdAt
updatedAt
```

Не реализовывать сложный template engine без отдельной задачи.

---

## Template version

Документ должен знать, по какой версии шаблона он создан.

Пример:

```text
templateVersion: 3
```

Если шаблон изменился, старые документы не должны менять текст.

---

## Document status

Возможные статусы документа:

```text
draft
generated
printed
sent
signed
cancelled
archived
```

### draft

Документ готовится.

### generated

Документ создан как snapshot.

### printed

Документ распечатан.

### sent

Документ отправлен пациенту.

### signed

Документ подписан.

### cancelled

Документ отменён.

### archived

Документ хранится в истории.

---

## Document cancellation

Отмена документа не должна удалять его бесследно.

Правильная логика:

```text
document status = cancelled
cancelledAt
cancelledBy
cancelReason
```

Hard delete документов должен быть ограничен.

---

## Document не должен переписываться

Запрещено:

```text
update old document snapshot silently
```

Если нужно изменить документ:

- создать новый документ;
- отменить старый;
- указать причину;
- сохранить историю.

Это особенно важно для медицинских и финансовых документов.

---

## Document generation flow

Правильный поток:

```text
doctor creates TreatmentPlan
→ user opens PatientPreview
→ user reviews patient-facing text
→ user clicks Generate Document
→ MedicalDocument snapshot created
→ document can be printed/sent/signed
```

Нельзя создавать официальный документ просто при открытии preview.

---

## Print

Print — действие над документом или preview.

Если печатается preview, он должен быть явно preview.

Если печатается document, он должен быть snapshot.

Печатная версия не должна содержать:

- debug fields;
- raw API errors;
- tokens;
- internal IDs без нужды;
- sync payloads;
- private clinical notes.

---

## PDF

PDF export — будущая задача.

Правила:

- PDF должен строиться из snapshot;
- PDF должен быть tenant-scoped;
- PDF должен иметь permission check;
- PDF не должен уходить в amoCRM, если содержит medical details;
- PDF generation should be logged;
- PDF storage should be secure.

Не реализовывать production PDF без отдельной задачи.

---

## Signed documents

Подписание документов — отдельная будущая задача.

Может включать:

- ручную отметку signed;
- загрузку скана;
- электронную подпись;
- SMS confirmation;
- external signature provider.

Не реализовывать юридически значимую подпись без отдельной architecture/security/legal задачи.

---

## TreatmentPlan and amoCRM

amoCRM может получать только safe commercial summary.

Допустимо:

```text
patient name
phone
lead source
lead status
plan total amount
plan commercial status
next appointment date
responsible manager
```

Запрещено:

```text
toothNumber
dental chart
clinical findings
riskDescription
diagnosis
medical documents
medical PDF
doctor private notes
```

---

## Commercial plan summary

Safe commercial summary может выглядеть так:

```text
План лечения предложен.
Сумма: 250000 KZT.
Статус: ожидает решения пациента.
```

Не включать:

```text
47 tooth
кариес
пульпит
riskDescription
clinical notes
```

amoCRM — sales system, не медицинская карта.

---

## TreatmentPlan external IDs

Если plan синхронизируется с amoCRM в будущем, нужны external IDs.

Пример:

```text
externalDealId
externalLeadId
externalSyncStatus
lastSyncAt
lastSyncError
```

Эти поля должны быть integration metadata.

Они не должны смешиваться с medical content.

---

## Documents and amoCRM

Medical documents нельзя отправлять в amoCRM.

Если в будущем нужна ссылка на документ, это отдельная high-risk задача.

По умолчанию:

```text
no medical PDF to amoCRM
```

Допустимо отправить commercial status, но не сам документ.

---

## TreatmentPlan and finance

TreatmentPlan содержит planned amount.

Finance содержит actual payments.

Связь:

```text
TreatmentPlan.totalAmount
Payment.amount
Debt/balance
```

Но payment не меняет medical completion.

Plan total не равен paid amount.

---

## Payment link

Если в будущем появится payment link, он должен быть отдельной задачей.

Он должен учитывать:

- tenant;
- patient;
- plan;
- amount;
- currency;
- payment provider;
- security;
- expiration;
- audit.

Не добавлять payment provider между делом.

---

## TreatmentPlan and schedule

TreatmentPlan может быть связан с appointments.

Пример:

```text
appointment reason = treatment stage
appointment linkedTreatmentPlanId
appointment linkedStageId
```

Но appointment не завершает stage автоматически.

Врач должен подтвердить выполненную услугу.

---

## CompletedService

CompletedService — future entity для фактически оказанной услуги.

Связь:

```text
TreatmentStage
→ CompletedService
```

CompletedService может закрыть stage или finding, если workflow это разрешает.

Не создавать CompletedService из payment.

Не создавать CompletedService из appointment без врача.

---

## Document permissions

Документы должны иметь permissions.

Примеры:

```text
documents.view
documents.create
documents.print
documents.send
documents.cancel
documents.archive
```

Medical documents могут требовать medical permissions.

Financial documents могут требовать finance permissions.

---

## TreatmentPlan permissions

Права для планов лечения:

```text
treatment_plans.view
treatment_plans.create
treatment_plans.update
treatment_plans.propose
treatment_plans.approve
treatment_plans.decline
treatment_plans.cancel
treatment_plans.archive
```

Роль врача может создавать и редактировать план.

Администратор может видеть коммерческий статус.

Кассир может видеть суммы, если разрешено.

Sales manager может видеть safe commercial summary.

---

## Role-aware treatment plan view

Doctor view:

- medical details;
- findings;
- tooth references;
- clinical notes, if allowed;
- stages;
- patient preview.

Receptionist view:

- plan status;
- next step;
- summary;
- follow-up.

Cashier view:

- amount;
- paid;
- debt;
- payment actions.

Sales manager view:

- commercial status;
- amount;
- approval status;
- follow-up;
- no medical details.

---

## Patient-facing document view

Patient-facing document should not expose:

- internal IDs;
- tenantId;
- database IDs;
- syncStatus;
- amoCRM IDs;
- raw clinical notes;
- private doctor notes;
- debug data;
- tokens;
- internal risk fields unless adapted.

---

## Internal clinical note vs patient text

Internal clinical note:

```text
Врачебная заметка для клиники.
```

Patient text:

```text
Понятное объяснение для пациента.
```

Эти тексты не должны быть одним и тем же полем без контроля.

Если поле используется для patient preview, врач должен понимать, что пациент увидит этот текст.

---

## TreatmentPlan history

В будущем нужно отслеживать историю изменения плана.

Особенно:

- price changed;
- stage added;
- stage removed;
- status changed;
- document generated;
- plan approved;
- plan declined;
- plan cancelled.

На раннем этапе можно не реализовывать full history.

Но нельзя проектировать silent overwrite как норму.

---

## Document history

Document history должна фиксировать:

- generated;
- printed;
- sent;
- signed;
- cancelled;
- archived.

Кто и когда сделал действие.

---

## Audit events

Важные audit events:

```text
treatment_plan.created
treatment_plan.updated
treatment_plan.status_changed
treatment_plan.stage_added
treatment_plan.stage_updated
treatment_plan.proposed
treatment_plan.approved
treatment_plan.declined
treatment_plan.cancelled
medical_document.generated
medical_document.printed
medical_document.sent
medical_document.signed
medical_document.cancelled
```

Audit должен быть tenant-aware.

---

## Storage rules

В прототипе plan/document data может быть localStorage.

Но production source of truth должен быть backend/database.

Запрещено:

- считать localStorage production storage;
- хранить official medical documents только в localStorage;
- хранить PDF только в browser cache;
- делать localStorage.clear() как миграцию;
- хранить secrets рядом с documents.

---

## Tenant isolation

TreatmentPlan и MedicalDocument должны быть tenant-scoped.

Пример:

```text
TreatmentPlan.tenantId = currentTenantId
MedicalDocument.tenantId = currentTenantId
```

Backend должен проверять:

- user belongs to tenant;
- patient belongs to tenant;
- plan belongs to tenant;
- document belongs to tenant;
- permission exists.

---

## Cross-tenant references запрещены

Плохой сценарий:

```text
TreatmentPlan.tenantId = Tenant A
Patient.tenantId = Tenant B
```

Такого быть не должно.

То же:

```text
MedicalDocument.tenantId must equal TreatmentPlan.tenantId
Payment.tenantId must equal TreatmentPlan.tenantId
CompletedService.tenantId must equal TreatmentStage.tenantId
```

---

## Data validation

Backend должен валидировать:

- plan belongs to patient;
- patient belongs to tenant;
- findings belong to patient;
- stages belong to plan;
- document generated from valid plan;
- amount valid;
- currency valid;
- status transition valid;
- user has permission.

Frontend validation не заменяет backend.

---

## Status transition validation

Статусы должны меняться по правилам.

Плохой вариант:

```text
any status → any status
```

Лучше:

```text
draft → proposed
proposed → approved
proposed → declined
approved → in_progress
in_progress → partially_completed
partially_completed → completed
```

Некоторые transitions могут быть allowed only by role.

---

## Documents and legal risk

Документы могут иметь юридическое значение.

Поэтому нельзя:

- silently overwrite document;
- change signed document;
- delete document without trace;
- show wrong clinic requisites;
- show wrong patient data;
- generate from stale tenant;
- expose internal fields.

Документы — не просто UI. Это артефакт, который пациент может сохранить, подписать или использовать в споре. Восхитительно, как быстро “просто кнопка печати” становится юридическим объектом.

---

## MVP rules

Для MVP можно:

- создавать simple treatment plans;
- делать simple stages;
- показывать patient preview;
- хранить в localStorage как prototype;
- не делать full PDF;
- не делать electronic signature;
- не делать full document engine;
- не делать completed services.

Но нельзя:

- считать preview документом;
- считать plan service;
- считать payment treatment completion;
- отправлять medical data в amoCRM;
- переписывать saved documents silently.

---

## Minimal MVP TreatmentPlan

Минимальный TreatmentPlan:

```text
id
patientId
title
status
stages
totalAmount
currency
linkedFindingIds
createdAt
updatedAt
```

Для future SaaS:

```text
tenantId
createdBy
approvedAt
documentIds
syncMetadata
```

---

## Minimal MVP TreatmentStage

Минимальный TreatmentStage:

```text
id
title
description
priceAmount
currency
order
linkedFindingIds
status
```

---

## Minimal MVP PatientPreview

Минимальный PatientPreview:

```text
patient summary
plan title
stages
total amount
patient-facing explanation
next step
```

Preview может быть generated UI, не saved entity.

Но если пользователь нажал “создать документ”, нужен snapshot.

---

## Minimal MVP Document placeholder

На раннем этапе можно иметь placeholder:

```text
Documents will be available after document engine is implemented.
```

Или disabled button:

```text
Создание документа будет доступно позже.
```

Но нельзя делать вид, что PDF/document engine уже готов.

---

## What not to implement early

Не реализовывать рано:

- legal document signing;
- production PDF;
- payment provider;
- real document storage;
- medical PDF to amoCRM;
- completed services automation;
- automatic AI treatment recommendations;
- automatic diagnosis;
- template engine without rules;
- public document links.

---

## UI rules for TreatmentPlansTab

TreatmentPlansTab должен показывать:

- список планов;
- статус;
- сумму;
- этапы;
- связанные findings;
- actions according to role;
- patient preview action;
- document placeholder/action;
- amoCRM disabled/safe status if relevant.

Не должен:

- автоматически завершать лечение;
- автоматически создавать payment;
- отправлять medical data наружу;
- показывать tokens;
- превращаться в весь PatientCardPage.

---

## Empty states

Если планов нет:

```text
План лечения пока не создан.
Создайте план вручную или на основе выявленных проблем.
```

Если нет findings:

```text
Сначала добавьте клинические находки или создайте план вручную.
```

Empty state должен объяснять следующий шаг.

---

## Disabled document action

Если document engine ещё не реализован, кнопка должна быть disabled.

Пример:

```text
Создание документа будет доступно после подключения модуля документов.
```

Не делать активную кнопку, которая ничего не делает.

---

## Disabled amoCRM action

Если real amoCRM sync ещё не реализован:

```text
amoCRM: будет доступно после подключения интеграции.
```

Не отправлять ничего во внешний API.

Не имитировать sync.

---

## Loading/error states

Для планов и документов:

- loading state;
- saving state;
- saved state;
- error state;
- validation error;
- permission denied state.

Ошибки должны быть safe.

Не показывать raw stack traces or secrets.

---

## Document export

Export documents is future.

Export должен быть:

- permission-protected;
- tenant-scoped;
- audit-logged;
- snapshot-based;
- no secrets;
- no raw debug.

---

## Document templates per tenant

Каждый tenant может иметь свои шаблоны.

Примеры:

- логотип;
- реквизиты;
- контакт;
- адрес;
- подпись;
- юридический текст;
- язык.

Не использовать один жёстко зашитый шаблон для всех клиник как финальную production-модель.

---

## Localization

Документы могут потребовать языки:

```text
ru
kk
en
```

На раннем этапе можно использовать русский.

Но архитектура не должна мешать будущей локализации.

---

## Timezone

Document createdAt и printedAt должны учитывать tenant timezone при отображении.

Хранить timestamps лучше в UTC.

Показывать по timezone tenant.

---

## Security notes

Documents и treatment plans содержат sensitive data.

Проверять:

- no tokens;
- no secrets;
- no medical data to amoCRM;
- tenant isolation;
- role permissions;
- safe errors;
- safe logs;
- snapshot not live mutation.

---

## Что нельзя делать

Нельзя:

- считать treatment plan выполненной услугой;
- считать approval выполнением лечения;
- считать payment выполнением лечения;
- считать appointment выполнением лечения;
- создавать completed service из payment;
- создавать completed service из appointment без врача;
- считать patient preview официальным документом;
- менять старый document snapshot после изменения плана;
- отправлять treatment medical details в amoCRM;
- отправлять toothNumber в amoCRM;
- отправлять riskDescription в amoCRM;
- отправлять medical PDF в amoCRM;
- показывать clinical notes пациенту без адаптации;
- давать sales role full medical plan details без permission;
- создавать PDF/document engine без отдельной задачи;
- хранить production documents только в localStorage;
- удалять документы без audit;
- делать payment provider без security task.

---

## Правила для ИИ-задач

Если задача касается TreatmentPlan, PatientPreview, Documents, PDF, approval или payment связи, ИИ должен проверить:

- plan не превращается в service;
- preview не превращается в document;
- document snapshot не live;
- payment не завершает treatment;
- appointment не завершает treatment;
- medical data не уходит в amoCRM;
- role boundaries соблюдены;
- tenant impact указан;
- sensitive data impact указан;
- storage impact указан;
- document actions disabled, если engine не реализован;
- report includes safety notes.

---

## Acceptance для treatment/documents задач

Задача считается корректной, если:

- TreatmentPlan boundaries сохранены;
- TreatmentStage boundaries сохранены;
- PatientPreview отделён от MedicalDocument;
- Document snapshot logic соблюдена или явно future;
- no medical data to amoCRM;
- no automatic medical completion from payment/appointment;
- permissions учтены;
- tenant isolation не нарушена;
- storage impact описан;
- report создан;
- what was not implemented честно указано.

---

## Итог

TreatmentPlan и Documents — критичные части DentalFlow.

Правильная цепочка:

```text
DentalFinding
→ TreatmentPlan
→ TreatmentStage
→ PatientPreview
→ MedicalDocument snapshot
→ CompletedService
→ Payment
```

Главная мысль:

```text
план лечения — это предложение,
документ — это snapshot,
выполненная услуга — это отдельный факт,
оплата — это финансовый факт
```

DentalFlow должна помогать клинике красиво и понятно объяснять лечение пациенту, фиксировать документы и контролировать согласование.

Но система не должна превращать коммерческое согласование, оплату или запись в медицинский факт.

Если эти границы сохранить, планы лечения станут сильной частью продукта.

Если смешать всё вместе, получится цифровая магия: пациент оплатил, зуб вылечился, документ переписался, amoCRM получила медицинскую карту, а потом все делают вид, что “так и задумано”.
