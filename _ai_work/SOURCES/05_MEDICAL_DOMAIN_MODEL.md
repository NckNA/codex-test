# 05_MEDICAL_DOMAIN_MODEL.md

## Назначение документа

Этот документ описывает медицинскую доменную модель DentalFlow CRM.

DentalFlow создаётся как специализированная CRM-платформа для стоматологических клиник, поэтому система должна правильно различать медицинские, административные, коммерческие и финансовые сущности.

Главное правило:

**жалоба пациента, клиническая находка, диагноз, план лечения, оказанная услуга, запись и оплата — это разные сущности.**

Если их смешать, система быстро превратится в удобную CRM только на вид. Внутри же будет цифровая каша, где запись считается лечением, оплата считается выполненной процедурой, а план лечения внезапно становится медицинским фактом. Человечество и так достаточно натерпелось от таблиц Excel, не надо повторять это в SaaS.

---

## Главный медицинский принцип

DentalFlow должна помогать стоматологу структурировать медицинские данные, но не должна заменять врача.

Система может:

- хранить жалобы пациента;
- хранить зубную карту;
- фиксировать clinical findings;
- показывать риски;
- помогать формировать план лечения;
- помогать показать пациенту понятный preview;
- сохранять документы;
- хранить историю лечения;
- связывать медицинские данные с коммерческим статусом.

Система не должна:

- автоматически ставить диагноз;
- автоматически назначать лечение;
- автоматически закрывать медицинские проблемы из-за оплаты;
- автоматически считать запись выполненной услугой;
- отправлять медицинские данные в amoCRM;
- заменять медицинское решение врача.

Врач остаётся ответственным за медицинскую часть.

---

## Главная цепочка медицинской модели

Базовая медицинская цепочка DentalFlow:

```text
Patient
→ ChiefComplaint
→ Examination
→ DentalChart
→ ToothState
→ DentalFinding
→ TreatmentPlan
→ TreatmentStage
→ PatientPreview
→ MedicalDocument
→ CompletedService
→ Payment
```

Эта цепочка не означает, что все элементы всегда обязательны.

Но она задаёт правильный порядок смысла:

- сначала пациент;
- потом жалоба;
- потом осмотр;
- потом состояние зубов и находки;
- потом план лечения;
- потом документ/preview;
- потом фактически оказанная услуга;
- потом оплата.

Оплата не должна идти раньше медицины как доказательство лечения. Деньги важны, но они не лечат кариес сами по себе, как бы бухгалтерии ни хотелось.

---

## Основные медицинские сущности

Ключевые сущности медицинского домена:

```text
Patient
ChiefComplaint
Examination
DentalChart
ToothState
DentalFinding
TreatmentPlan
TreatmentStage
PatientPreview
MedicalDocument
CompletedService
MedicalHistory
Allergy
Contraindication
ClinicalNote
```

Не все сущности должны быть реализованы сразу.

Но архитектура должна сохранять между ними правильные границы.

---

## Patient

Patient — центральная сущность клинической и административной работы.

Patient принадлежит tenant.

Patient может иметь:

- ФИО;
- телефон;
- дату рождения;
- источник обращения;
- lead status;
- allergy notes;
- medical notes;
- dental chart;
- appointments;
- complaints;
- findings;
- treatment plans;
- documents;
- payments;
- completed services;
- integration metadata.

Patient не должен быть глобальным для всей платформы.

В production каждый patient должен иметь tenantId.

---

## Patient не равен lead

Lead — это потенциальное обращение или коммерческий интерес.

Patient — это пациент клиники.

Один lead может стать patient.

Patient может существовать без amoCRM lead.

DentalFlow должна позволять:

- создать пациента вручную;
- создать пациента из amoCRM lead;
- связать пациента с внешним contact/deal;
- вести пациента без amoCRM.

amoCRM может знать коммерческий статус пациента, но не должна быть source of truth для медицинских данных.

---

## ChiefComplaint

ChiefComplaint — это жалоба пациента.

Примеры:

- болит зуб;
- чувствительность;
- кровоточивость;
- отсутствуют зубы;
- неудобный протез;
- хочет поставить брекеты;
- хочет отбеливание;
- хочет консультацию;
- хочет имплантацию;
- скол;
- опухоль;
- неприятный запах;
- эстетическая проблема.

Жалоба — это слова пациента или причина обращения.

Жалоба не равна clinical finding.

Жалоба не равна диагнозу.

Жалоба не равна плану лечения.

Пациент может жаловаться на одно, а врач при осмотре выявит другое.

---

## Жалоба не равна находке

Пример:

```text
Жалоба:
"Болит нижний зуб справа"

Clinical finding:
"Кариозная полость на 47 зубе"
```

Или:

```text
Жалоба:
"Хочу красивую улыбку"

Clinical findings:
- скученность зубов
- старые реставрации
- изменение цвета эмали
```

Система должна хранить жалобу отдельно от findings.

Нельзя автоматически превращать жалобу в медицинскую находку.

---

## Examination

Examination — осмотр врача.

На раннем этапе examination может не быть отдельной сущностью.

Но концептуально важно понимать:

```text
visit / appointment
→ examination
→ findings
```

Appointment — это запись.

Examination — это медицинское действие врача во время визита.

Один appointment может не привести к полноценному examination.

Например:

- пациент не пришёл;
- запись отменена;
- консультация перенесена;
- был только административный визит.

---

## Appointment не равен Examination

Appointment — административная запись в расписании.

Examination — медицинский осмотр.

Плохая логика:

```text
appointment completed
→ автоматически created examination
→ автоматически treatment completed
```

Правильная логика:

```text
appointment completed
→ визит состоялся
→ врач вручную фиксирует findings / treatment / completed service
```

Запись сама по себе не доказывает медицинский результат.

---

## DentalChart

DentalChart — зубная карта пациента.

DentalChart должна отражать структуру зубов и их состояние.

В базовой модели взрослого пациента используется 32 постоянных зуба.

Зубная карта должна позволять:

- выбрать зуб;
- видеть номер зуба;
- видеть состояние зуба;
- видеть активные findings;
- видеть severity;
- видеть планируемое лечение;
- видеть выполненное лечение, когда появится история;
- отличать состояние зуба от клинических находок.

DentalChart принадлежит patient и tenant.

---

## Tooth numbering

В стоматологии может использоваться FDI-нумерация.

Пример взрослых зубов:

```text
18 17 16 15 14 13 12 11
21 22 23 24 25 26 27 28
48 47 46 45 44 43 42 41
31 32 33 34 35 36 37 38
```

Система должна быть осторожной с нумерацией.

Не путать:

- верхнюю челюсть;
- нижнюю челюсть;
- правую сторону пациента;
- левую сторону пациента;
- молочные зубы;
- постоянные зубы.

На раннем этапе можно поддерживать взрослую постоянную карту.

Молочные зубы и смешанный прикус — отдельная будущая задача.

---

## ToothState

ToothState — состояние зуба.

Примеры:

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

Финальный список может изменяться.

ToothState описывает текущее состояние зуба.

ToothState не равен clinical finding.

Один зуб может иметь состояние `filled`, но при этом иметь новый finding.

Один зуб может быть `missing`, но иметь план протезирования.

---

## ToothState не равен DentalFinding

ToothState — базовое состояние зуба.

DentalFinding — конкретная клиническая находка или проблема.

Пример:

```text
ToothState:
filled

DentalFinding:
secondary caries near old filling
```

Или:

```text
ToothState:
missing

DentalFinding:
need prosthetic replacement
```

Нельзя смешивать состояние зуба и медицинские проблемы в одно поле.

Иначе зубная карта станет набором статусов, которые непонятно что означают: факт, план, риск или историю. Великолепно для путаницы, ужасно для продукта.

---

## DentalFinding

DentalFinding — клиническая находка врача.

Это одна из ключевых медицинских сущностей.

DentalFinding может содержать:

- id;
- tenantId;
- patientId;
- toothNumber;
- category;
- title;
- description;
- severity;
- status;
- riskDescription;
- createdBy;
- createdAt;
- updatedAt;
- linkedTreatmentPlanIds;
- linkedTreatmentStageIds.

DentalFinding фиксирует то, что врач выявил.

---

## DentalFinding не равен diagnosis

DentalFinding — находка.

Diagnosis — диагноз.

На раннем этапе DentalFlow может вообще не вводить отдельную сущность diagnosis.

Это безопаснее.

Пример:

```text
Finding:
visible carious lesion on tooth 46

Diagnosis:
будет указываться врачом, если система позже поддержит diagnosis
```

Система не должна автоматически превращать finding в diagnosis.

Если diagnosis будет добавлен, он должен быть отдельной медицинской задачей и требовать врачебного контроля.

---

## DentalFinding не равен TreatmentPlan

DentalFinding описывает проблему.

TreatmentPlan описывает, что предлагается сделать.

Пример:

```text
DentalFinding:
Кариозная полость на 47 зубе

TreatmentPlan:
Лечение кариеса 47 зуба, восстановление пломбой
```

Finding может существовать без плана лечения.

План лечения может включать несколько findings.

Один finding может быть включён в несколько вариантов плана, если будет поддержка альтернативных планов.

---

## DentalFinding не равен CompletedService

DentalFinding — проблема.

CompletedService — выполненная услуга.

Плохая логика:

```text
finding added to plan
→ finding completed
```

Правильная логика:

```text
finding discovered
→ planned
→ in_treatment
→ completed only after treatment is actually performed
```

Нельзя закрывать finding только потому, что он попал в план.

---

## DentalFinding не равен Payment

Оплата не закрывает medical finding.

Плохая логика:

```text
patient paid
→ finding completed
```

Правильная логика:

```text
patient paid
→ financial status updated
doctor performs treatment
→ completed service created
→ finding may be closed
```

Оплата — финансовый факт.

Завершение лечения — медицинский факт.

Не надо смешивать деньги и медицину. Деньги многое решают, но не закрывают пульпит в базе данных.

---

## DentalFinding category

Finding category может описывать тип проблемы.

Примеры:

```text
caries
pulpitis
periodontitis
missing_tooth
mobility
fracture
old_restoration_problem
gum_problem
occlusion_problem
esthetic_problem
prosthetic_problem
orthodontic_problem
implant_related
other
```

Финальный список должен быть отдельной задачей.

На раннем этапе можно использовать упрощённый список.

---

## DentalFinding severity

Severity показывает срочность или важность finding.

Возможные значения:

```text
low
medium
high
urgent
```

Пример:

```text
low → наблюдение
medium → плановое лечение
high → желательно не откладывать
urgent → требует срочного внимания
```

Severity помогает UI и врачу выделять важное.

Но severity не должна автоматически ставить диагноз или назначать лечение.

---

## DentalFinding status

Finding status показывает жизненный цикл находки.

Возможные значения:

```text
discovered
planned
in_treatment
completed
declined_by_patient
monitoring
archived
```

### discovered

Находка выявлена врачом.

### planned

Находка включена в план лечения.

### in_treatment

По находке начато лечение.

### completed

Проблема закрыта после фактически выполненного лечения.

### declined_by_patient

Пациент отказался от лечения.

### monitoring

Врач решил наблюдать.

### archived

Находка больше не активна, но остаётся в истории.

---

## Finding lifecycle

Правильный жизненный цикл finding:

```text
discovered
→ planned
→ in_treatment
→ completed
```

Альтернативные ветки:

```text
discovered
→ monitoring
```

```text
discovered
→ declined_by_patient
```

```text
planned
→ declined_by_patient
```

```text
completed
→ archived
```

Не каждое изменение статуса должно быть автоматическим.

Медицинские переходы должны быть осознанными.

---

## RiskDescription

RiskDescription — описание риска, связанного с finding.

Пример:

```text
Если не лечить, возможно усиление боли, разрушение зуба или осложнение.
```

RiskDescription предназначен для врача и patient preview, если текст безопасно адаптирован.

RiskDescription не должен отправляться в amoCRM.

RiskDescription может быть sensitive medical data.

---

## ClinicalNote

ClinicalNote — врачебная заметка.

Она может содержать внутренние медицинские детали.

ClinicalNote не должна автоматически показываться пациенту.

ClinicalNote не должна отправляться в amoCRM.

ClinicalNote должна быть доступна только ролям с медицинскими permissions.

---

## Diagnosis

Diagnosis — диагноз.

На раннем этапе DentalFlow не должна автоматически ставить диагноз.

Если diagnosis появится в будущем, правила:

- diagnosis указывает врач;
- diagnosis хранится отдельно от finding;
- diagnosis может быть связан с finding;
- diagnosis может быть связан с document;
- diagnosis может требовать audit;
- diagnosis не отправляется в amoCRM;
- diagnosis не генерируется AI без отдельной медицинской и юридической задачи.

Пока diagnosis лучше считать future entity.

---

## TreatmentPlan

TreatmentPlan — план лечения.

План лечения описывает предложенные действия, этапы, стоимость и статус согласования.

TreatmentPlan может содержать:

- id;
- tenantId;
- patientId;
- title;
- status;
- createdBy;
- createdAt;
- updatedAt;
- stages;
- totalAmount;
- currency;
- linkedFindingIds;
- patientPreview;
- approvalStatus;
- documentIds.

TreatmentPlan не является фактом оказанной услуги.

---

## TreatmentPlan status

Возможные статусы treatment plan:

```text
draft
proposed
approved
declined
in_progress
completed
archived
cancelled
```

### draft

План ещё черновик.

### proposed

План готов к показу пациенту.

### approved

Пациент согласовал план.

### declined

Пациент отказался.

### in_progress

По плану начато лечение.

### completed

Все этапы выполнены.

### archived

План сохранён в истории.

### cancelled

План отменён.

---

## TreatmentPlan не равен CompletedService

TreatmentPlan — намерение.

CompletedService — факт.

Плохая логика:

```text
plan approved
→ service completed
```

Правильная логика:

```text
plan approved
→ treatment may start later
→ doctor performs service
→ completed service is created
```

План может быть согласован, но пациент может не прийти.

План может быть частично выполнен.

План может быть изменён.

---

## TreatmentStage

TreatmentStage — этап плана лечения.

Stage может содержать:

- id;
- title;
- description;
- price;
- currency;
- order;
- status;
- linkedFindingIds;
- plannedDoctorId;
- completedServiceIds.

Stage помогает разбить лечение на понятные части.

Stage не является completed service до фактического выполнения.

---

## TreatmentStage status

Возможные статусы:

```text
planned
approved
in_progress
completed
declined
cancelled
```

Статус stage должен меняться осознанно.

Payment не должен автоматически менять stage на completed.

Appointment completed не должен автоматически менять stage на completed.

---

## CompletedService

CompletedService — фактически оказанная услуга.

Это отдельная сущность.

CompletedService может быть связан с:

- tenantId;
- patientId;
- appointmentId;
- treatmentPlanId;
- treatmentStageId;
- doctorId;
- service name;
- performedAt;
- price;
- payment status;
- materials used, если склад будет реализован;
- notes;
- audit log.

CompletedService появляется только когда услуга реально оказана.

---

## CompletedService не равен Payment

CompletedService — медицинско-операционный факт.

Payment — финансовый факт.

Плохая логика:

```text
payment created
→ completed service created
```

Правильная логика:

```text
doctor marks service performed
→ completed service created
cashier records payment
→ payment created
```

Они могут быть связаны, но не должны заменять друг друга.

---

## CompletedService не равен Appointment

Appointment — запись.

CompletedService — выполненная услуга.

Плохая логика:

```text
appointment status = completed
→ completed service created automatically
```

Правильная логика:

```text
appointment completed
→ visit happened
→ doctor confirms what was actually done
→ completed service created manually or through controlled workflow
```

Пациент мог прийти на консультацию, но лечение могло не проводиться.

---

## Payment

Payment — оплата.

Payment относится к finance domain, но связан с medical workflow через patient, plan или completed service.

Payment может содержать:

- tenantId;
- patientId;
- amount;
- currency;
- paymentMethod;
- paidAt;
- linkedTreatmentPlanId;
- linkedCompletedServiceId;
- status;
- cashierId.

Payment не должен менять medical status автоматически.

---

## MedicalHistory

MedicalHistory — история медицинских событий пациента.

В будущем может включать:

- complaints;
- findings;
- treatment plans;
- completed services;
- documents;
- clinical notes;
- allergies;
- contraindications;
- important events.

На раннем этапе medical history может быть собрана из связанных сущностей.

Не обязательно делать отдельную таблицу сразу.

---

## Allergy

Allergy — информация об аллергиях пациента.

Может быть простым текстовым полем на раннем этапе.

В будущем может стать отдельной структурой:

```text
Allergy
- id
- tenantId
- patientId
- substance
- reaction
- severity
- note
```

Allergy является sensitive medical data.

Не отправлять в amoCRM.

---

## Contraindication

Contraindication — противопоказание или важное медицинское ограничение.

Может быть future entity.

Пример:

- беременность;
- аллергия на препарат;
- заболевания;
- приём антикоагулянтов;
- противопоказания к хирургии.

Эти данные sensitive.

Доступ только по medical permissions.

---

## PatientPreview

PatientPreview — понятное представление плана лечения для пациента.

PatientPreview не равен MedicalDocument.

Preview может показываться пациенту до формирования официального документа.

PatientPreview может содержать:

- понятное описание проблемы;
- план лечения;
- этапы;
- стоимость;
- рекомендации;
- предупреждение;
- контакты клиники.

PatientPreview не должен показывать:

- internal IDs;
- syncStatus;
- raw findings если они слишком технические;
- врачебные private notes;
- amoCRM fields;
- tokens;
- raw errors;
- debug info.

---

## PatientPreview и medical safety

PatientPreview должен быть patient-facing.

Текст должен быть понятным и аккуратным.

Не нужно показывать пациенту сырые technical fields.

Не нужно превращать riskDescription в пугающий текст без контроля врача.

Врач должен контролировать, что показывается пациенту.

---

## MedicalDocument

MedicalDocument — сохранённый документ.

MedicalDocument должен быть snapshot-based.

Пример:

```text
Treatment plan document generated at 2026-06-06
```

Если treatment plan изменился 2026-06-10, старый document не должен измениться автоматически.

Document snapshot нужен для истории и юридической стабильности.

---

## Document snapshot

Document snapshot должен сохранять данные на момент создания.

Snapshot может включать:

- patient data snapshot;
- clinic data snapshot;
- plan data snapshot;
- stage prices;
- doctor name;
- document text;
- createdAt;
- createdBy.

Snapshot не должен содержать:

- tokens;
- raw sync data;
- debug fields;
- unnecessary internal IDs;
- secrets.

---

## MedicalDocument не равен PatientPreview

PatientPreview — экран или режим предпросмотра.

MedicalDocument — сохранённая сущность.

Плохая логика:

```text
preview opened
→ document created
```

Правильная логика:

```text
preview shown
→ user confirms generate document
→ MedicalDocument snapshot created
```

---

## Document status

Возможные статусы документа:

```text
draft
generated
printed
signed
cancelled
archived
```

Отмена документа не должна удалять его бесследно.

Для важных документов нужна история.

---

## Medical data и amoCRM

Medical data не должна уходить в amoCRM.

Запрещено отправлять:

- dental chart;
- toothNumber;
- tooth surfaces;
- findings;
- diagnosis;
- riskDescription;
- medical documents;
- clinical notes;
- allergies;
- contraindications;
- completed service medical notes;
- PDF с медицинскими деталями.

amoCRM может получать только коммерческо-административную сводку.

---

## Safe commercial summary

В amoCRM можно отправлять safe commercial summary.

Пример:

```text
Patient: Иван Иванов
Phone: +7...
Lead source: Instagram
Lead status: consultation_done
Treatment plan total: 250000 KZT
Commercial status: plan_proposed
Next appointment: 2026-06-10
```

Нельзя отправлять:

```text
47 tooth caries, urgent risk, clinical details
```

Sales-система должна продавать и сопровождать, а не становиться медицинской картой.

---

## Medical data и roles

Medical data должны видеть только роли с правом.

Примеры medical permissions:

```text
medical.view
medical.update
dental_chart.view
dental_chart.update
findings.view
findings.create
findings.update
treatment_plans.view
treatment_plans.create
documents.view
documents.create
```

Receptionist может видеть ограниченную информацию.

Sales manager не должен видеть full clinical findings.

Cashier не должен редактировать medical data.

---

## Medical data и tenant

Все medical data должны быть tenant-scoped.

Patient, dental chart, findings, treatment plans, documents и completed services должны принадлежать tenant.

Пользователь другой клиники не должен видеть medical data чужого tenant.

Backend должен enforce tenant isolation.

---

## Medical audit

Важные медицинские действия должны логироваться.

Примеры:

```text
dental_chart.updated
finding.created
finding.status_changed
treatment_plan.created
treatment_plan.updated
treatment_plan.approved
document.generated
document.cancelled
completed_service.created
clinical_note.updated
```

Audit log не должен содержать secrets.

Audit log должен быть tenant-aware.

---

## Medical edit history

В будущем может понадобиться история изменений.

Особенно для:

- dental chart;
- findings;
- treatment plans;
- documents;
- completed services.

На раннем этапе можно не реализовывать full history.

Но нельзя проектировать так, что важные медицинские данные бесследно перезаписываются без возможности понять, кто изменил.

---

## Soft delete medical data

Важные medical data лучше не удалять hard delete.

Использовать:

```text
archived
cancelled
deletedAt
deletedBy
deleteReason
```

Hard delete должен быть ограничен и логироваться.

Особенно нельзя случайно удалять:

- dental chart;
- findings;
- treatment plans;
- documents;
- completed services.

---

## Clinical AI limitations

Если в будущем появится AI-помощник, он не должен автоматически ставить диагноз.

AI может:

- помогать структурировать текст;
- предлагать checklist;
- помогать оформить patient-friendly explanation;
- подсказывать, какие поля не заполнены;
- помогать врачу не забыть follow-up.

AI не должен:

- самостоятельно диагностировать;
- назначать лечение без врача;
- менять medical status;
- закрывать findings;
- формировать final medical document без подтверждения врача.

AI в медицине без контроля врача — это не инновация, а быстрый способ познакомиться с юридическими проблемами.

---

## Manual doctor control

Врач должен контролировать:

- clinical findings;
- diagnosis, если появится;
- treatment plan;
- medical document;
- completed service;
- medical notes.

Система может облегчать работу, но финальное медицинское действие должно быть осознанным.

---

## Medical validation

Backend должен валидировать medical data.

Проверять:

- patient belongs to tenant;
- toothNumber valid;
- finding status valid;
- severity valid;
- treatment plan belongs to patient;
- treatment stage belongs to plan;
- document belongs to patient;
- completed service belongs to patient;
- cross-tenant references absent.

Frontend validation удобна, но backend validation обязательна.

---

## ToothNumber validation

Если используется FDI adult chart, toothNumber должен быть из допустимого списка.

Пример:

```text
11,12,13,14,15,16,17,18
21,22,23,24,25,26,27,28
31,32,33,34,35,36,37,38
41,42,43,44,45,46,47,48
```

Молочные зубы — отдельная будущая задача.

Не нужно случайно принимать toothNumber `99`, потому что JavaScript не возражал. JavaScript вообще много чему не возражает, и вот мы здесь.

---

## Money in treatment plans

TreatmentPlan и TreatmentStage могут содержать стоимость.

Money fields должны быть аккуратными.

Рекомендуемая логика:

```text
amount
currency
```

Для Казахстана базовая валюта:

```text
KZT
```

Не смешивать medical status и payment status.

Стоимость плана — это коммерческая часть плана, а не факт оплаты.

---

## Currency

Currency должна быть явной.

Плохой вариант:

```text
price: 250000
```

без валюты.

Лучше:

```text
amount: 250000
currency: "KZT"
```

Финальная денежная модель будет отдельной задачей.

---

## Medical reports

Медицинские отчёты могут появиться позже.

Примеры:

- active findings;
- treatment plans by status;
- completed services;
- doctor workload;
- repeated complaints;
- declined treatment;
- urgent findings.

Reports должны быть tenant-scoped и permission-protected.

---

## Medical imports

Импорт medical data — рискованная задача.

Не реализовывать без отдельной архитектуры.

Если когда-нибудь импортировать:

- patients;
- dental chart;
- findings;
- treatment plans;
- documents;

нужны:

- validation;
- tenantId;
- mapping;
- duplicate detection;
- audit;
- rollback plan.

---

## Medical exports

Export medical data должен быть ограничен.

Требуется:

- permission;
- tenant scope;
- audit;
- safe file generation;
- no secrets;
- role-aware fields.

Обычный пользователь не должен выгружать всю медицинскую базу клиники без права.

---

## Medical documents and legal risk

MedicalDocument может иметь юридическое значение.

Поэтому:

- snapshot обязателен;
- createdAt обязателен;
- createdBy желательно;
- отмена должна быть логируемой;
- старый документ не должен меняться молча;
- PDF/print должны быть контролируемыми.

Не делать documents как “просто HTML на экране и распечатали”. Так рождаются споры, а споры, как известно, отлично едят время и деньги.

---

## Минимальная MVP-модель

Для раннего MVP достаточно:

```text
Patient
DentalChart
ToothState
DentalFinding
TreatmentPlan
TreatmentStage
PatientPreview
Appointment reference
```

Можно не делать сразу:

- full diagnosis;
- full completed service;
- full documents;
- full medical history;
- full audit;
- full PDF;
- full import/export.

Но нельзя нарушать будущие границы.

---

## Что можно упростить в MVP

Можно упростить:

- один dental chart на patient;
- adult teeth only;
- simple finding statuses;
- simple severity;
- text-based complaints;
- simple treatment stages;
- localStorage prototype;
- patient preview without saved document;
- basic role assumptions.

Но каждый упрощённый элемент должен быть честно отмечен как prototype/skeleton.

---

## Что нельзя упрощать даже в MVP

Нельзя упрощать так, чтобы сломать домен.

Запрещено:

- complaint = finding;
- finding = diagnosis;
- plan = completed service;
- appointment = completed service;
- payment = completed service;
- tooth state = finding;
- patient preview = saved document;
- amoCRM = medical record;
- localStorage = production medical storage;
- frontend role = security.

Это не “быстрое MVP”, это фундаментальная ошибка.

---

## Domain boundaries

DentalFlow должна разделять домены:

```text
Medical domain
Scheduling domain
Commercial domain
Finance domain
Document domain
Integration domain
Platform billing domain
```

Они связаны, но не одно и то же.

Пример связи:

```text
TreatmentPlan has totalAmount
Payment may reference TreatmentPlan
CompletedService may reference TreatmentStage
amoCRM may receive commercial summary
```

Но это не значит, что payment закрывает stage, а amoCRM получает finding.

---

## Medical domain и commercial domain

Medical domain отвечает за:

- жалобы;
- зубную карту;
- findings;
- diagnosis;
- treatment plan medical details;
- completed services;
- documents.

Commercial domain отвечает за:

- lead source;
- lead status;
- plan proposal;
- approval status;
- follow-up;
- amoCRM status;
- conversion.

Они связаны через patient and treatment plan.

Но commercial users не должны автоматически видеть full medical details.

---

## Medical domain и finance domain

Finance domain отвечает за:

- amount;
- payment;
- debt;
- refund;
- cashier;
- finance reports.

Medical domain отвечает за:

- clinical state;
- treatment plan;
- completed service.

Оплата может быть связана с treatment plan или completed service.

Но оплата не меняет медицинский факт автоматически.

---

## Medical domain и schedule domain

Schedule domain отвечает за:

- appointment;
- doctor;
- cabinet;
- time;
- appointment status.

Medical domain отвечает за:

- examination;
- findings;
- treatment;
- completed services.

Appointment может быть связан с treatment plan.

Но appointment не должен менять tooth state или finding status автоматически без врача.

---

## Medical domain и document domain

Document domain фиксирует medical/commercial data в snapshot.

MedicalDocument может быть создан на основе TreatmentPlan.

Но document не должен быть live view, который меняется каждый раз после изменения плана.

---

## Medical domain и integration domain

Integration domain отвечает за внешние системы.

amoCRM должна получать только safe commercial summary.

Medical domain не должен вытекать во внешние sales-системы.

Если интеграция требует medical data, это отдельная high-risk задача с отдельными правилами, но amoCRM к этому не относится.

---

## Medical source of truth

Production source of truth для medical data:

```text
DentalFlow backend/database
```

Не source of truth:

```text
amoCRM
Excel
localStorage production
WhatsApp
PDF export
browser cache
```

amoCRM может быть source of truth для sales pipeline.

Но не для dental chart, findings, treatment plans и medical documents.

---

## Medical data in localStorage

На этапе прототипа medical data может находиться в localStorage.

Но это временно.

Production medical data должна храниться backend-side.

Запрещено считать localStorage медицинским production-хранилищем.

---

## Medical data in reports

Reports не должны раскрывать лишнюю medical data.

Например, owner может видеть количество treatment plans, statuses, conversion.

Но detailed clinical findings должны быть доступны только ролям с medical permissions.

---

## Medical data in logs

Логи не должны содержать полные medical documents, dental chart или private notes без необходимости.

Допустимо логировать safe metadata:

```text
tenantId
patientId
entityType
entityId
action
status
createdAt
```

Не логировать sensitive text полностью, если это не нужно.

---

## Medical data in errors

Ошибки не должны раскрывать medical data.

Плохой вариант:

```text
Cannot sync finding: 47 tooth severe caries riskDescription...
```

Правильный вариант:

```text
Cannot sync record. Medical data is not allowed in external sync payload.
```

---

## Что нельзя делать

Нельзя:

- автоматически ставить диагноз;
- превращать жалобу в finding;
- превращать finding в diagnosis;
- превращать finding в plan без контроля;
- считать plan выполненной услугой;
- считать appointment выполненной услугой;
- считать payment выполненной услугой;
- закрывать finding из-за оплаты;
- закрывать stage из-за оплаты;
- менять tooth state из-за appointment status;
- отправлять dental chart в amoCRM;
- отправлять toothNumber в amoCRM;
- отправлять riskDescription в amoCRM;
- отправлять clinical notes в amoCRM;
- переписывать saved document после изменения плана;
- удалять medical history без audit;
- хранить production medical data только в localStorage;
- давать sales role full medical access без permission;
- делать AI diagnosis без отдельной медицинской/legal задачи.

---

## Правила для ИИ-задач

Если задача касается medical domain, ИИ должен проверить:

- не смешиваются ли complaint, finding, diagnosis, treatment plan, completed service, payment;
- не меняется ли medical status автоматически из finance/schedule;
- не отправляются ли medical data в amoCRM;
- не показываются ли sensitive medical data лишним ролям;
- не ломается ли tenant isolation;
- не создаётся ли diagnosis automation;
- не переписываются ли documents задним числом;
- есть ли patient-facing safe preview;
- не используется ли localStorage как production medical storage;
- есть ли report with medical safety notes.

---

## Acceptance для medical-domain задач

Medical-domain задача считается корректной, если:

- medical entities separated;
- tenant impact указан;
- sensitive data impact указан;
- complaint не равна finding;
- finding не равна diagnosis;
- treatment plan не равен completed service;
- payment не равен treatment completion;
- appointment не равен treatment completion;
- medical data не уходит в amoCRM;
- document snapshot rules не нарушены;
- role boundaries не нарушены;
- report создан.

---

## Итог

DentalFlow должна иметь аккуратную медицинскую доменную модель.

Главная медицинская цепочка:

```text
Patient
→ ChiefComplaint
→ Examination
→ DentalChart
→ ToothState
→ DentalFinding
→ TreatmentPlan
→ TreatmentStage
→ PatientPreview
→ MedicalDocument
→ CompletedService
→ Payment
```

Главная защитная мысль:

```text
медицинский факт ≠ коммерческий статус ≠ финансовый факт
```

DentalFlow должна помогать стоматологии работать с пациентом, но не должна превращать медицину в набор случайных статусов CRM.

Если границы медицинской модели сохранить, продукт можно развивать безопасно.

Если их смешать, потом придётся объяснять, почему у пациента лечение “выполнено”, потому что он оплатил, хотя врач ещё даже не включил лампу. А это уже не CRM, а театр абсурда с зубной картой.
