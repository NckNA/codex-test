# 08_APPOINTMENTS_AND_SCHEDULE.md

## Назначение документа

Этот документ описывает правила работы с записями, расписанием, визитами, врачами, кабинетами и статусами приёма в DentalFlow CRM.

Расписание — это один из ключевых операционных модулей стоматологической клиники. Через него администратор записывает пациента, врач видит свою загрузку, управляющий контролирует поток пациентов, а клиника понимает, кто должен прийти, когда и зачем.

Главное правило:

**Appointment — это запись пациента на приём, а не факт лечения, не оплата, не выполненная услуга и не изменение зубной карты.**

Если это правило нарушить, один клик в календаре начнёт делать слишком много: лечить зубы, закрывать планы, списывать материалы, создавать оплату и отправлять отчёты. Очень удобно, если цель — построить цифровой домино-апокалипсис.

---

## Главная роль расписания

Расписание должно помогать клинике управлять временем.

Оно отвечает за:

- запись пациента;
- выбор врача;
- выбор кабинета;
- дату и время;
- длительность приёма;
- тип визита;
- причину визита;
- статус записи;
- переносы;
- отмены;
- no-show;
- повторные визиты;
- загрузку врачей;
- загрузку кабинетов;
- напоминания;
- follow-up.

Расписание не должно само принимать медицинские решения.

---

## Главная цепочка расписания

Базовая цепочка:

```text
Patient
→ Appointment
→ Visit happened / not happened
→ Examination, if doctor performs examination
→ DentalFinding, if doctor records findings
→ TreatmentPlan, if doctor creates plan
→ CompletedService, if service was actually performed
→ Payment, if payment was recorded
```

Appointment находится в начале операционного процесса.

Он может привести к медицинскому действию.

Но сам по себе appointment не является медицинским действием.

---

## Appointment

Appointment — запись пациента на приём.

Appointment может содержать:

```text
id
tenantId
patientId
doctorId
cabinetId
startAt
endAt
durationMinutes
type
reason
status
source
createdBy
createdAt
updatedAt
cancelledAt
cancelReason
rescheduledFromAppointmentId
linkedTreatmentPlanId
linkedTreatmentStageId
notes
```

Не все поля нужны в MVP.

Но appointment должен быть отделён от completed service, payment и treatment plan.

---

## Appointment не равен TreatmentPlan

Appointment — это время в расписании.

TreatmentPlan — это план лечения.

Плохая логика:

```text
appointment created
→ treatment plan created automatically
```

Правильная логика:

```text
appointment created
→ patient scheduled
doctor may later create treatment plan
```

Запись на консультацию не означает, что план лечения уже существует.

---

## Appointment не равен Examination

Appointment — административная запись.

Examination — медицинский осмотр.

Плохая логика:

```text
appointment status = completed
→ examination created with findings
```

Правильная логика:

```text
appointment completed
→ visit happened
doctor manually records examination/findings if performed
```

Пациент мог прийти только на консультацию, на примерку, на обсуждение, на оплату или вообще уйти без осмотра.

---

## Appointment не равен CompletedService

Appointment — запись.

CompletedService — фактически оказанная услуга.

Плохая логика:

```text
appointment completed
→ completed service automatically created
```

Правильная логика:

```text
doctor confirms service was performed
→ completed service created
```

Приём мог завершиться, но лечение могло не проводиться.

Пациент мог прийти, поговорить и уйти думать. Да, такое тоже бывает, хотя календарь очень хотел бы считать всё завершённым.

---

## Appointment не равен Payment

Appointment не должен автоматически создавать оплату.

Плохая логика:

```text
appointment completed
→ payment created
```

Правильная логика:

```text
cashier records payment separately
```

Запись может иметь стоимость ожидаемой услуги, но это не факт оплаты.

---

## Appointment не меняет ToothState автоматически

Appointment не должен автоматически менять состояние зуба.

Плохая логика:

```text
appointment completed
→ tooth state = treated
```

Правильная логика:

```text
doctor performs treatment
→ completed service recorded
→ related medical status may change
```

Календарь не лечит зубы.

Врач лечит зубы.

---

## Appointment не закрывает DentalFinding автоматически

Appointment не должен автоматически закрывать finding.

Плохая логика:

```text
appointment linked to finding
appointment completed
→ finding completed
```

Правильная логика:

```text
doctor confirms treatment for finding
→ finding status may become completed
```

Запись могла быть связана с finding, но не факт, что проблема была решена.

---

## Appointment не списывает склад автоматически

Appointment не должен автоматически списывать материалы.

Плохая логика:

```text
appointment completed
→ materials written off
```

Правильная логика:

```text
completed service or warehouse action
→ materials written off according to rules
```

Списание склада должно быть связано с фактически выполненной услугой или отдельным складским действием.

---

## Основные сущности расписания

Будущие сущности schedule domain:

```text
Appointment
DoctorSchedule
Cabinet
WorkingHours
ScheduleBlock
AppointmentType
AppointmentStatus
Reminder
NoShow
RescheduleEvent
CancellationReason
WaitingList
```

Не все нужно реализовывать сразу.

Но архитектура должна сохранять границы.

---

## Appointment status

Возможные статусы appointment:

```text
draft
scheduled
confirmed
arrived
in_progress
completed
cancelled
no_show
rescheduled
waiting
```

### draft

Запись создаётся, но ещё не подтверждена.

### scheduled

Пациент записан.

### confirmed

Пациент подтвердил визит.

### arrived

Пациент пришёл в клинику.

### in_progress

Приём начался.

### completed

Приём завершён.

### cancelled

Запись отменена.

### no_show

Пациент не пришёл.

### rescheduled

Запись перенесена.

### waiting

Пациент в листе ожидания или ожидает времени.

---

## Appointment status lifecycle

Пример нормального пути:

```text
scheduled
→ confirmed
→ arrived
→ in_progress
→ completed
```

Альтернативы:

```text
scheduled
→ cancelled
```

```text
scheduled
→ no_show
```

```text
scheduled
→ rescheduled
→ scheduled
```

```text
confirmed
→ cancelled
```

Не каждый переход должен быть доступен каждой роли.

---

## Status transition rules

Статусы не должны меняться хаотично.

Плохой вариант:

```text
any status → any status
```

Лучше:

```text
scheduled → confirmed
confirmed → arrived
arrived → in_progress
in_progress → completed
scheduled/confirmed → cancelled
scheduled/confirmed → no_show
scheduled/confirmed → rescheduled
```

Финальные правила будут определены при реализации.

Но задача должна учитывать, что status lifecycle существует.

---

## Appointment type

Appointment type описывает тип визита.

Возможные типы:

```text
consultation
treatment
prosthetics
orthodontics
surgery
hygiene
diagnostics
follow_up
control_visit
payment_visit
document_visit
other
```

Appointment type помогает планировать время и врача.

Но appointment type не является completed service.

---

## Appointment reason

Reason — причина записи.

Примеры:

- консультация;
- боль;
- лечение кариеса;
- протезирование;
- имплантация;
- брекеты;
- профчистка;
- повторный визит;
- осмотр;
- примерка;
- коррекция;
- выдача документов;
- оплата.

Reason может быть текстом или справочником.

Reason не должен автоматически создавать clinical finding.

---

## Linked treatment plan

Appointment может быть связан с TreatmentPlan.

Пример:

```text
appointment.linkedTreatmentPlanId
```

Это означает:

```text
запись относится к этому плану
```

Но это не означает:

```text
план выполнен
```

Связь помогает врачу и администратору понимать контекст визита.

---

## Linked treatment stage

Appointment может быть связан с TreatmentStage.

Пример:

```text
appointment.linkedTreatmentStageId
```

Это означает:

```text
на приёме планируется этап лечения
```

Но это не означает:

```text
этап выполнен
```

Этап должен становиться completed только через medical/operational workflow.

---

## Doctor

Doctor — пользователь или сотрудник клиники, который ведёт приём.

Doctor должен быть tenant-scoped.

Doctor может иметь:

```text
id
tenantId
userId
fullName
specialization
status
workingHours
cabinetIds
createdAt
updatedAt
```

Doctor может быть связан с User, но не всегда обязан на раннем этапе.

В MVP doctor может быть простым объектом.

---

## Doctor specialization

Специализация врача может быть:

```text
therapist
orthopedist
orthodontist
surgeon
hygienist
implantologist
general
other
```

Специализация помогает фильтровать доступные типы записей.

Но не должна автоматически давать все permissions.

Role/permission model остаётся отдельной.

---

## Doctor availability

Doctor availability описывает, когда врач может принимать.

Она может зависеть от:

- working hours;
- days off;
- vacations;
- schedule blocks;
- cabinet availability;
- appointment duration;
- tenant working hours.

В MVP можно сделать проще.

Но production schedule должен учитывать реальную доступность.

---

## Cabinet

Cabinet — кабинет клиники.

Cabinet должен быть tenant-scoped.

Cabinet может иметь:

```text
id
tenantId
name
number
status
equipment
notes
```

Appointment может быть связан с cabinetId.

Нельзя записать двух пациентов в один кабинет в одно и то же время, если это не разрешено правилами.

---

## Working hours

Working hours — рабочее время клиники или врача.

Пример:

```text
Monday: 09:00-18:00
Tuesday: 09:00-18:00
...
Sunday: closed
```

Working hours должны учитывать tenant timezone.

---

## Tenant timezone

Расписание должно учитывать timezone tenant.

Для Казахстана часто используется:

```text
Asia/Almaty
```

Но SaaS может поддерживать разные timezones.

Хранить timestamps лучше в UTC.

Показывать время по timezone tenant.

---

## Date and time storage

В production лучше хранить:

```text
startAt UTC
endAt UTC
tenant timezone
```

Отображать:

```text
local time according to tenant timezone
```

Нельзя хранить время как случайную строку без timezone strategy.

Календарь без timezone — это такая маленькая машина для будущих споров.

---

## Duration

Appointment должен иметь duration.

Пример:

```text
durationMinutes: 30
durationMinutes: 60
durationMinutes: 90
```

Duration может зависеть от appointment type.

Например:

- консультация: 30 минут;
- лечение: 60 минут;
- сложное лечение: 90 минут;
- протезирование: 60 минут;
- хирургия: 90 минут или больше.

Финальные правила задаёт клиника.

---

## Schedule conflict

Система должна предотвращать конфликты.

Примеры конфликтов:

- врач занят;
- кабинет занят;
- clinic closed;
- doctor not working;
- appointment overlaps another appointment;
- appointment outside working hours;
- tenant suspended, если запись запрещена.

В MVP можно предупреждать.

В production backend должен проверять конфликты.

---

## Conflict validation

Backend validation должна проверять:

```text
appointment belongs to tenant
patient belongs to tenant
doctor belongs to tenant
cabinet belongs to tenant
time range valid
no forbidden overlap
user has permission
tenant access allowed
```

Frontend validation удобна, но backend validation обязательна.

---

## Overbooking

Overbooking может быть разрешён только явно.

По умолчанию:

```text
no overbooking
```

Если клиника хочет overbooking, это отдельная настройка.

Не делать overbooking случайно из-за отсутствия проверки.

---

## Reschedule

Reschedule — перенос записи.

Перенос должен сохранять историю.

Плохая логика:

```text
appointment.startAt changed silently
```

Лучше:

```text
appointment updated
reschedule event created
old startAt saved
new startAt saved
reason saved
changedBy saved
```

В MVP можно упростить.

Но нельзя считать silent overwrite идеальной production-моделью.

---

## Reschedule history

RescheduleEvent может содержать:

```text
id
tenantId
appointmentId
oldStartAt
oldEndAt
newStartAt
newEndAt
reason
changedBy
createdAt
```

Это помогает видеть историю переносов.

---

## Cancellation

Cancellation — отмена записи.

Отмена должна фиксировать:

```text
cancelledAt
cancelledBy
cancelReason
cancelledByRole
```

Запись не должна исчезать бесследно.

Отмена важна для отчётов и follow-up.

---

## Cancellation reason

Причины отмены:

```text
patient_cancelled
clinic_cancelled
doctor_unavailable
rescheduled
duplicate
wrong_time
financial_reason
medical_reason
other
```

Финальный список можно уточнить позже.

---

## No-show

No-show — пациент не пришёл.

No-show должен быть отдельным статусом.

Он важен для:

- отчётов;
- follow-up;
- анализа дисциплины пациентов;
- работы администраторов;
- повторной записи.

No-show не должен удалять пациента.

No-show не должен закрывать treatment plan.

---

## Arrival

Arrived означает, что пациент пришёл.

Arrived не означает, что лечение началось.

Правильная цепочка:

```text
scheduled
→ arrived
→ in_progress
→ completed
```

Но clinic может упростить workflow.

Главное:

```text
arrived ≠ completed service
```

---

## In progress

In progress означает, что приём начался.

Он может быть полезен для текущей загрузки.

Но in_progress не означает completed treatment.

---

## Completed appointment

Completed appointment означает, что приём как событие расписания завершён.

Он не означает автоматически:

- completed service;
- payment;
- closed finding;
- changed tooth state;
- document generated;
- warehouse write-off.

Это нужно повторять, потому что календарь очень соблазнительно превратить в кнопку “сделать всё”. Не надо.

---

## Waiting list

Waiting list — будущая задача.

Может использоваться, когда пациент хочет прийти раньше или ждёт свободное окно.

Waiting list может содержать:

```text
patientId
tenantId
preferredDoctorId
preferredDateRange
reason
priority
createdAt
status
```

Не реализовывать без отдельной задачи.

---

## Reminders

Reminders — напоминания пациенту.

Могут быть:

- SMS;
- WhatsApp;
- email;
- phone call task;
- internal task.

Reminder должен быть tenant-scoped.

Reminder не должен отправлять лишние medical details.

---

## Reminder content

Reminder должен быть безопасным.

Пример:

```text
Напоминаем о записи в клинику завтра в 10:00.
```

Не надо отправлять:

```text
Завтра лечение 47 зуба с риском осложнений...
```

Напоминания должны быть privacy-safe.

---

## Reminder status

Возможные статусы reminder:

```text
pending
sent
failed
cancelled
skipped
```

Reminder failures должны быть safe logged.

Не логировать secrets от SMS/WhatsApp provider.

---

## Follow-up

Follow-up — последующее действие с пациентом.

Follow-up может быть связан с:

- appointment;
- treatment plan;
- no-show;
- declined plan;
- patient waiting decision;
- post-treatment control.

Follow-up может уходить в amoCRM как commercial task, но без medical details.

---

## Tasks for receptionist

Администратор может иметь задачи:

- подтвердить запись;
- напомнить пациенту;
- перенести запись;
- связаться после no-show;
- уточнить решение по плану;
- подготовить документы;
- передать врачу информацию.

Задачи должны быть tenant-scoped.

---

## Schedule views

UI расписания может иметь виды:

```text
day
week
doctor
cabinet
list
calendar
timeline
```

MVP может начинаться с простого day/week view.

Не нужно сразу строить космический календарь, если ещё нет нормальных статусов.

---

## Day view

Day view показывает расписание на день.

Полезно для:

- администраторов;
- регистраторов;
- врачей;
- управляющих.

Должно быть видно:

- время;
- пациент;
- врач;
- кабинет;
- статус;
- тип визита;
- длительность;
- важные предупреждения.

---

## Week view

Week view помогает планировать загрузку.

Может показывать:

- записи по дням;
- загрузку врача;
- свободные окна;
- отмены;
- no-show;
- будущие визиты.

---

## Doctor view

Doctor view показывает расписание конкретного врача.

Врач должен видеть:

- свои записи;
- пациентов;
- причину визита;
- linked treatment plan/stage, если есть;
- important medical warnings, если разрешено;
- статус визита.

Doctor view не должен показывать лишние finance/platform billing данные.

---

## Cabinet view

Cabinet view показывает загрузку кабинетов.

Полезно для клиник с несколькими кабинетами.

Кабинет не должен быть занят двумя conflicting appointments, если overbooking не разрешён.

---

## Schedule list view

List view полезен для поиска и фильтрации.

Фильтры:

- дата;
- врач;
- статус;
- пациент;
- тип визита;
- source;
- no-show;
- cancelled;
- confirmed.

---

## Patient appointment history

В карточке пациента должна быть история записей.

Показывать:

- дата;
- врач;
- тип;
- статус;
- причина;
- linked plan/stage;
- notes, если разрешено.

Appointment history не должна показывать данные другого tenant.

---

## Appointment notes

Notes могут быть разными.

Нужно различать:

```text
admin note
medical note
internal schedule note
patient-facing note
```

В MVP может быть одно поле notes.

Но важно не отправлять internal/medical notes в reminders or amoCRM без фильтрации.

---

## Appointment source

Источник записи может быть:

```text
manual
phone
whatsapp
instagram
website
amocrm
online_booking
repeat_visit
doctor_recommendation
other
```

Source полезен для отчётов.

Source не является medical data.

---

## Online booking

Online booking — будущая задача.

Если появится public booking, она должна быть tenant-scoped.

Пример:

```text
/booking/:tenantSlug
```

Online booking должна проверять:

- tenant active;
- feature enabled;
- working hours;
- doctor availability;
- cabinet availability;
- appointment type;
- rate limits;
- safe patient data collection.

Не реализовывать public booking без отдельной security/UI задачи.

---

## Public booking security

Public booking не должна раскрывать:

- полный список пациентов;
- внутреннее расписание врачей сверх доступных слотов;
- medical data;
- finance data;
- staff private notes;
- integration tokens.

Public booking должна создавать request или appointment по правилам клиники.

---

## Tenant isolation

Все appointments должны быть tenant-scoped.

Пример:

```text
Appointment.tenantId = currentTenantId
```

Backend должен проверять:

```text
user belongs to tenant
patient belongs to tenant
doctor belongs to tenant
cabinet belongs to tenant
appointment belongs to tenant
permission exists
tenant access allowed
```

---

## Cross-tenant schedule leak

Нельзя показывать записи другой клиники.

Плохой сценарий:

```text
clinic A receptionist sees clinic B appointment
```

Это critical security issue.

Search, filters, reports, calendar views и reminders должны быть tenant-scoped.

---

## Schedule and roles

Роли имеют разные права.

### Receptionist

Может:

- видеть расписание;
- создавать записи;
- переносить записи;
- отменять записи;
- подтверждать записи;
- отмечать no-show;
- видеть limited patient info.

### Doctor

Может:

- видеть свои записи;
- видеть пациентов по своим записям;
- начать/завершить приём;
- перейти к медицинской части.

### Clinic owner / manager

Может:

- видеть расписание клиники;
- видеть загрузку врачей;
- видеть no-show;
- видеть отмены;
- видеть отчёты.

### Cashier

Может:

- видеть записи, связанные с оплатой;
- не обязан редактировать medical status.

### Sales manager

Может:

- видеть follow-up context;
- не видеть full medical schedule details без permission.

---

## Schedule permissions

Возможные permissions:

```text
appointments.view
appointments.create
appointments.update
appointments.cancel
appointments.reschedule
appointments.confirm
appointments.mark_arrived
appointments.mark_no_show
appointments.complete
appointments.view_all_doctors
appointments.view_own
schedule.manage_working_hours
schedule.manage_cabinets
schedule.manage_blocks
```

Финальный список уточняется позже.

---

## Doctor own schedule

Врач может видеть только свои записи, если нет permission на все записи.

Пример:

```text
doctor has appointments.view_own
clinic_admin has appointments.view_all_doctors
```

Это помогает ограничить доступ.

---

## Schedule and medical permissions

Доступ к appointment не должен автоматически давать доступ к full medical chart.

Receptionist может видеть запись и имя пациента.

Но не обязан видеть:

- dental chart;
- clinical findings;
- diagnosis;
- riskDescription;
- medical documents.

Доступ к medical data определяется medical permissions.

---

## Schedule and finance permissions

Доступ к расписанию не должен автоматически давать доступ к финансам.

Doctor или receptionist может видеть факт записи.

Но не обязан видеть:

- долг пациента;
- все платежи;
- возвраты;
- кассу.

Finance permissions отдельные.

---

## Schedule and platform billing

Обычные пользователи клиники не должны видеть platform billing из расписания.

Если tenant suspended, UI может показать ограничение доступа.

Но детали задолженности видит clinic_owner или authorised role.

---

## Suspended tenant behavior

Если tenant suspended:

- backend может запретить создание новых appointments;
- public booking может быть disabled;
- reminders may be paused;
- sync tasks may be paused;
- ordinary staff may see limited access message;
- clinic_owner may see billing/access status.

Данные appointments не удаляются.

---

## Feature entitlement

Некоторые schedule features могут зависеть от тарифа.

Примеры:

- базовое расписание;
- multi-doctor schedule;
- cabinet management;
- reminders;
- online booking;
- advanced no-show reports.

Backend должен проверять feature entitlement.

Frontend disabled state не является защитой.

---

## Schedule reports

Будущие отчёты:

```text
appointments by day
appointments by doctor
appointments by status
cancelled appointments
no-show rate
doctor workload
cabinet utilization
new vs repeat patients
source to appointment conversion
consultation to treatment plan conversion
```

Reports должны быть tenant-scoped.

---

## No-show report

No-show важен для бизнеса клиники.

Report может показывать:

- количество no-show;
- процент no-show;
- no-show по источникам;
- no-show по администраторам;
- no-show по врачам;
- follow-up status.

Не должен раскрывать medical data лишним ролям.

---

## Doctor workload report

Doctor workload показывает загрузку врача.

Может включать:

- количество записей;
- часы приёма;
- completed appointments;
- cancelled appointments;
- no-show;
- свободные окна.

Не путать workload report с medical performance без отдельной модели.

---

## Cabinet utilization report

Cabinet utilization показывает загрузку кабинетов.

Может помочь clinic owner планировать ресурсы.

Это future report.

---

## Appointment reminders and amoCRM

amoCRM может получать commercial follow-up, но не medical appointment details.

Можно отправить:

```text
appointment scheduled
appointment confirmed
appointment cancelled
appointment no_show
next appointment date
```

Нельзя отправлять:

```text
toothNumber
clinical finding
riskDescription
medical notes
doctor private notes
```

---

## amoCRM schedule summary

Safe summary для amoCRM:

```text
Пациент записан на консультацию.
Дата: 2026-06-10 10:00.
Статус: confirmed.
```

Опасный payload:

```text
Записан на лечение 47 зуба, риск осложнений...
```

В sales-систему не уходит медицина.

---

## Appointment external IDs

Если appointment связан с внешней системой, нужны external IDs.

Пример:

```text
externalCalendarEventId
externalTaskId
externalSource
syncStatus
lastSyncAt
lastSyncError
```

Эти поля должны быть integration metadata.

Они не должны смешиваться с medical content.

---

## Calendar integrations

Будущие интеграции:

- Google Calendar;
- Outlook Calendar;
- amoCRM tasks;
- WhatsApp reminders;
- SMS reminders;
- online booking widget.

Не реализовывать без отдельной интеграционной задачи.

---

## Safe sync logs

Schedule sync logs должны быть safe.

Логировать:

```text
tenantId
appointmentId
provider
operation
status
safeMessage
createdAt
```

Не логировать:

- tokens;
- full medical notes;
- raw secret payload;
- private patient medical data.

---

## Appointment created from amoCRM

Если appointment создаётся из amoCRM lead/task в будущем:

- backend должен проверить tenant connection;
- patient mapping должен быть safe;
- medical data не должна приходить из amoCRM как source of truth;
- appointment source can be amocrm;
- appointment reason may be generic;
- user should confirm if needed.

amoCRM не должна создавать medical findings.

---

## Appointment created manually

Manual appointment должен позволять:

- выбрать patient;
- выбрать doctor;
- выбрать date/time;
- выбрать duration;
- выбрать type;
- указать reason;
- добавить note;
- сохранить.

При сохранении backend должен проверить conflicts and permissions.

---

## Appointment without patient

Иногда клиника может захотеть blocked slot без пациента.

Для этого лучше использовать ScheduleBlock, а не Appointment без patient.

Appointment обычно должен иметь patientId.

ScheduleBlock может использоваться для:

- обед;
- отпуск;
- технический перерыв;
- собрание;
- кабинет занят;
- врач недоступен.

---

## ScheduleBlock

ScheduleBlock — блокировка времени.

Может содержать:

```text
id
tenantId
doctorId
cabinetId
startAt
endAt
reason
createdBy
createdAt
```

ScheduleBlock не является patient appointment.

---

## Doctor vacation

Doctor vacation можно моделировать как schedule block или отдельную сущность.

Не нужно реализовывать сразу.

Но schedule architecture должна позволять временную недоступность врача.

---

## Clinic holidays

Clinic holidays — будущая настройка.

Они должны быть tenant-scoped.

Если клиника закрыта, online booking and appointment creation должны учитывать это.

---

## Recurring appointments

Recurring appointments — будущая задача.

Например, ортодонтия или контрольные визиты.

Не реализовывать без отдельной задачи.

Recurring appointments должны учитывать:

- seriesId;
- exceptions;
- cancellations;
- reschedules;
- tenant timezone.

---

## Appointment confirmation

Confirmation может быть:

- вручную администратором;
- через звонок;
- через WhatsApp;
- через SMS;
- через public link;
- через amoCRM task.

Confirmation status должен быть отдельным от appointment completion.

```text
confirmed ≠ completed
```

---

## Appointment communication

Коммуникация по записи может включать:

- звонок;
- WhatsApp;
- SMS;
- email;
- amoCRM message/task.

История коммуникации может быть future module.

Не смешивать communication history с medical notes.

---

## Patient waiting in clinic

В будущем можно отслеживать waiting time.

Статусы:

```text
arrived
waiting
in_progress
completed
```

Это помогает администратору и врачу.

Не обязательно для MVP.

---

## Appointment audit events

Важные audit events:

```text
appointment.created
appointment.updated
appointment.confirmed
appointment.arrived
appointment.started
appointment.completed
appointment.cancelled
appointment.rescheduled
appointment.no_show
appointment.reminder_sent
appointment.reminder_failed
schedule_block.created
schedule_block.cancelled
```

Audit должен быть tenant-aware.

---

## Appointment history

Appointment history должна сохраняться.

Не удалять старые записи бесследно.

История нужна для:

- пациента;
- врача;
- администратора;
- отчётов;
- no-show анализа;
- спорных ситуаций.

---

## Delete appointment

Hard delete appointment должен быть ограничен.

Лучше:

```text
status = cancelled
```

или:

```text
archived
```

Hard delete можно оставить только для ошибок ввода и ограниченных ролей.

Даже тогда нужен audit.

---

## Appointment import

Import schedule — будущая задача.

Опасности:

- неверные timezones;
- неправильные doctor mappings;
- duplicate appointments;
- cross-tenant data;
- broken patient references.

Не реализовывать без отдельной задачи.

---

## Appointment export

Export schedule должен быть tenant-scoped and permission-protected.

Может включать:

- appointments list;
- doctor workload;
- no-show report;
- calendar export.

Не раскрывать medical details лишним ролям.

---

## Calendar UI empty state

Если записей нет:

```text
На выбранную дату записей нет.
Создайте новую запись или выберите другой день.
```

Если врач не выбран:

```text
Выберите врача, чтобы увидеть расписание.
```

Если кабинет не настроен:

```text
Кабинеты пока не добавлены.
```

Empty state должен помогать, а не просто молча смотреть на пользователя.

---

## Loading state

Расписание должно показывать loading state:

```text
Загрузка расписания...
Сохранение записи...
Проверка доступности...
Перенос записи...
```

---

## Error state

Ошибки должны быть safe.

Пример:

```text
Не удалось загрузить расписание.
Повторите попытку.
```

Пример:

```text
Это время уже занято.
Выберите другое время.
```

Не показывать raw stack traces, tokens, tenant internals.

---

## Conflict UI

Если время занято, UI должен объяснить:

- какой ресурс конфликтует;
- врач занят;
- кабинет занят;
- время вне графика;
- пересечение с другой записью.

Но не раскрывать чужие tenant data.

---

## Drag-and-drop

Drag-and-drop перенос записи — future UI feature.

Если реализуется, должен:

- проверять conflicts;
- подтверждать перенос;
- сохранять reschedule history;
- не менять medical status;
- не менять payment.

Не реализовывать без отдельной UI/task.

---

## Quick actions

В расписании могут быть быстрые действия:

- позвонить;
- открыть WhatsApp;
- подтвердить;
- отметить пришёл;
- отметить no-show;
- перенести;
- отменить;
- открыть карточку пациента;
- открыть план лечения.

Quick action не должен выполнять скрытые medical/finance operations.

---

## Appointment card in calendar

Карточка записи в календаре может показывать:

- patient name;
- time;
- doctor;
- cabinet;
- status;
- type;
- short reason;
- source;
- warning icon, if allergy or important note and role allowed.

Не показывать full medical details прямо в календаре обычным ролям.

---

## Privacy in schedule view

Расписание может быть видно в клинике на экране.

Поэтому не стоит показывать слишком много sensitive data в compact view.

Минимум:

- имя пациента;
- время;
- врач;
- статус.

Medical details лучше показывать только после открытия карточки и permission check.

---

## Appointment and patient card

Из appointment можно перейти в PatientCard.

Но открытие PatientCard должно проверять permissions.

Appointment access не всегда равно full patient medical access.

---

## Appointment and treatment plan

Если appointment связан с treatment plan, UI может показывать ссылку.

Но связь не должна автоматически менять status.

---

## Appointment and documents

Appointment может быть связан с document visit.

Но appointment не должен автоматически generate document.

Document generation remains separate controlled action.

---

## Appointment and payments

Appointment может быть связан с expected payment.

Но payment создаётся отдельно.

Cashier role или authorized user должен зафиксировать оплату.

---

## Appointment and warehouse

Appointment может быть связан с planned service.

Но warehouse write-off должен быть separate or based on completed service.

Не списывать materials из simple appointment completion.

---

## MVP schedule

Минимальный MVP расписания:

```text
Appointment
Patient link
Doctor
Date/time
Duration
Status
Type/reason
Create/update/cancel
Patient appointment history
```

Можно отложить:

- reminders;
- online booking;
- cabinet management;
- schedule blocks;
- recurring appointments;
- drag-and-drop;
- calendar integrations;
- advanced reports;
- no-show analytics.

---

## MVP allowed simplifications

В MVP допустимо:

- простой список записей;
- простой day view;
- простой doctor selector;
- статусы scheduled/cancelled/completed/no_show;
- localStorage prototype;
- без timezone complexity, если clearly prototype;
- без reminders.

Но нельзя:

- считать completed appointment completed service;
- создавать payment из appointment;
- менять tooth state from appointment;
- закрывать finding from appointment;
- отправлять medical details to amoCRM.

---

## What not to implement early

Не реализовывать рано:

- production online booking;
- external calendar sync;
- automatic reminders;
- payment provider;
- warehouse write-off;
- completed service automation;
- AI schedule optimization;
- public booking links;
- recurring appointments;
- multi-branch schedule;
- production timezone complexity без backend.

---

## Schedule and localStorage

В прототипе appointments могут храниться в localStorage.

Но production schedule должен быть backend/database.

localStorage не обеспечивает:

- tenant isolation;
- conflict validation;
- audit logs;
- multi-user concurrency;
- backup;
- permissions.

Production schedule needs backend.

---

## Multi-user concurrency

В production несколько администраторов могут записывать одновременно.

Backend должен предотвращать race condition.

Плохой сценарий:

```text
two admins book same doctor same time
both succeed
```

Нужна backend conflict check and transaction.

Не решать только frontend.

---

## Audit and concurrency

Если конфликт возник, backend должен вернуть safe error.

Пример:

```text
Это время уже занято. Обновите расписание и выберите другой слот.
```

---

## Schedule safety notes

Schedule touches sensitive operational data.

Проверять:

- tenant isolation;
- role permissions;
- patient privacy;
- no medical auto-completion;
- no payment auto-creation;
- no warehouse auto-writeoff;
- no medical data to amoCRM;
- safe reminders;
- safe logs;
- safe exports.

---

## Что нельзя делать

Нельзя:

- считать appointment лечением;
- считать appointment completed service;
- считать appointment оплатой;
- менять ToothState из appointment;
- закрывать DentalFinding из appointment;
- закрывать TreatmentStage из appointment;
- списывать склад из appointment;
- создавать document из appointment автоматически;
- отправлять medical appointment details в amoCRM;
- делать search appointments across tenants для clinic user;
- показывать чужие appointments;
- оставлять stale schedule после tenant switch;
- доверять frontend-only conflict check;
- хранить production schedule только в localStorage;
- hard delete appointment без audit;
- делать public booking без security task;
- делать reminders с medical details без правил.

---

## Правила для ИИ-задач

Если задача касается appointments, schedule, calendar, reminders, doctor availability, cabinets или online booking, ИИ должен проверить:

- appointment не превращается в completed service;
- appointment не создаёт payment;
- appointment не меняет medical status;
- appointment не списывает warehouse;
- tenant impact указан;
- sensitive data impact указан;
- role boundaries соблюдены;
- backend enforcement предусмотрен или явно future;
- conflicts не решаются только frontend;
- no medical data to amoCRM;
- reminders privacy-safe;
- report includes safety notes.

---

## Acceptance для schedule задач

Schedule-задача считается корректной, если:

- Appointment boundaries сохранены;
- Appointment status lifecycle понятен;
- Appointment не меняет medical/finance/warehouse data автоматически;
- tenant isolation не нарушена;
- permissions учтены;
- conflict validation описана или реализована;
- timezone impact понятен или явно отложен;
- reminders не раскрывают medical details;
- no medical data to amoCRM;
- storage impact указан;
- report создан.

---

## Итог

Appointments and Schedule — операционный модуль DentalFlow.

Правильная цепочка:

```text
Patient
→ Appointment
→ Visit
→ Examination / Treatment, if actually performed
→ CompletedService, if confirmed
→ Payment, if recorded
```

Главная мысль:

```text
appointment — это время и организационный факт,
а не медицинский результат и не финансовый факт
```

Расписание должно помогать клинике работать быстро и понятно.

Но оно не должно автоматически лечить, закрывать планы, создавать оплаты, списывать склад или отправлять медицинские детали во внешние CRM.

Если эти границы сохранить, schedule станет нормальным рабочим модулем.

Если смешать всё вместе, календарь станет кнопкой “сделать всё”, а потом все будут удивляться, почему в системе лечение завершено, пациент не платил, материалы списались, а врач просто перенёс запись.
