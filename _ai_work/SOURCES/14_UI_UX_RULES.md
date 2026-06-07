# 14_UI_UX_RULES.md

## Назначение документа

Этот документ описывает правила UI/UX для DentalFlow CRM.

DentalFlow создаётся как SaaS CRM-платформа для стоматологических клиник. Пользователи системы — не только разработчики и не только владелец бизнеса. С системой будут работать администраторы, врачи, кассиры, управляющие, владельцы клиник, sales managers и platform staff.

Главное правило:

**интерфейс DentalFlow должен помогать пользователю выполнить рабочую задачу, а не заставлять его разгадывать архитектуру проекта.**

Если пользователь смотрит на экран и думает “что мне нажать, чтобы не сломать пациента”, значит UI уже проиграл. Кнопки не должны быть квестом, вкладки не должны быть лабиринтом, а карточка пациента не должна выглядеть как Excel, который получил медицинское образование по переписке.

---

## Главная UX-цель

DentalFlow должен быть рабочим инструментом клиники.

UI должен помогать:

- быстро найти пациента;
- понять статус пациента;
- записать пациента;
- открыть карточку пациента;
- увидеть зубную карту;
- зафиксировать clinical finding;
- составить план лечения;
- показать patient preview;
- увидеть документы;
- принять оплату;
- увидеть долг;
- контролировать follow-up;
- понимать integration status;
- понимать tenant access status;
- не раскрывать sensitive data лишним ролям.

UI должен быть простым, но не примитивным.

---

## Основной принцип интерфейса

Каждый экран должен отвечать на вопросы:

```text
где я нахожусь?
с каким tenant я работаю?
какой объект открыт?
что важно сейчас?
что можно сделать?
что нельзя сделать?
почему нельзя?
что будет после действия?
есть ли несохранённые изменения?
есть ли риск раскрытия sensitive data?
```

Если экран не отвечает на эти вопросы, он создаёт тревогу.
Тревога в CRM — плохой продуктовый паттерн, хотя многие системы почему-то считают её частью onboarding.

---

## UI не должен скрывать смысл

Интерфейс должен различать:

```text
medical data
commercial data
finance data
schedule data
document data
integration data
platform billing data
```

Плохо:

```text
одна большая карточка со всеми статусами подряд
```

Хорошо:

```text
разделы и блоки с понятной ролью
```

Пользователь должен понимать, видит он медицинский статус, коммерческий статус, финансовый статус или статус интеграции.

---

## Role-aware UI

UI должен учитывать роль пользователя.
Один и тот же экран может выглядеть по-разному для разных ролей.

Примеры:

### Doctor

Видит:

- медицинские блоки;
- зубную карту;
- findings;
- treatment plans;
- patient preview;
- clinical warnings.

Не должен отвлекаться на platform billing.

### Receptionist

Видит:

- пациентов;
- телефон;
- записи;
- источник;
- lead status;
- basic treatment plan status;
- next appointment.

Не редактирует зубную карту.

### Cashier

Видит:

- суммы;
- оплаты;
- долги;
- payment status.

Не редактирует clinical findings.

### Clinic owner

Видит:

- общую картину клиники;
- отчёты;
- финансы;
- подписку;
- интеграции;
- пользователей;
- тарифные ограничения.

### Sales manager

Видит:

- source;
- lead status;
- follow-up;
- safe commercial summary;
- amoCRM status.

Не видит full medical details без permission.

### Platform admin

Видит:

- tenants;
- subscription status;
- platform billing;
- integration health;
- support tools.

Не должен становиться невидимым медицинским superuser без отдельной политики доступа.

---

## UI permission rules

UI может скрывать или отключать действия.
Но UI не является security boundary.

Плохой вариант:

```text
button hidden
→ operation secure
```

Правильный вариант:

```text
button hidden or disabled in UI
backend still enforces permission
```

UI должен отражать permissions, но не заменять backend.

---

## Disabled states

Disabled action должен объяснять причину.

Плохо:

```text
кнопка серая и всё
```

Хорошо:

```text
Кнопка disabled
Tooltip / text: "Доступно только пользователю с правом integrations.configure."
```

Или:

```text
"amoCRM будет доступна после подключения интеграции."
```

Или:

```text
"Эта функция доступна на тарифе Pro."
```

Пользователь не должен гадать, почему система внезапно стала мебелью.

---

## Empty states

Пустые состояния должны объяснять следующий шаг.

Плохо:

```text
Нет данных
```

Хорошо:

```text
У пациента пока нет планов лечения. Создайте план вручную или на основе выявленных проблем.
```

Примеры:

```text
Пациенты пока не добавлены. Создайте первого пациента или импортируйте список позже.
```

```text
На выбранную дату записей нет. Создайте запись или выберите другой день.
```

```text
Документы пока не созданы. Документ можно будет сформировать после подготовки плана лечения.
```

Empty state — это часть UX, а не пустота, которую забыли оформить.

---

## Loading states

Каждый важный экран должен иметь loading state.

Примеры:

```text
Загрузка пациентов...
Загрузка карточки пациента...
Загрузка зубной карты...
Загрузка расписания...
Сохранение изменений...
Формирование preview...
Проверка доступности amoCRM...
```

Пользователь должен понимать, что система работает.
Молчаливый экран — не минимализм, а маленький психологический эксперимент.

---

## Error states

Ошибки должны быть понятными и безопасными.

Пример:

```text
Не удалось загрузить карточку пациента. Проверьте подключение и повторите попытку.
```

Пример:

```text
Недостаточно прав для выполнения действия.
```

Пример:

```text
Это время уже занято. Выберите другой слот.
```

Не показывать:

- stack trace;
- raw API error;
- tokens;
- database IDs без необходимости;
- чужие tenant details;
- raw provider response;
- medical details в technical error.

---

## Success states

После действия пользователь должен видеть результат.

Примеры:

```text
Пациент сохранён.
Запись создана.
План лечения сохранён.
Документ сформирован.
Оплата добавлена.
amoCRM отключена.
```

Success message должен быть коротким.
Не надо праздновать сохранение пациента как запуск космического корабля.

---

## Save states

Для форм и медицинских данных важно показывать состояние сохранения:

```text
Сохранение...
Изменения сохранены.
Не удалось сохранить.
Есть несохранённые изменения.
```

Особенно для:

- patient card;
- dental chart;
- findings;
- treatment plan;
- document draft;
- payment;
- appointment.

---

## Unsaved changes

Если пользователь уходит со страницы с несохранёнными изменениями, UI должен предупредить.

Пример:

```text
Есть несохранённые изменения. Уйти без сохранения?
```

Особенно:

- зубная карта;
- clinical finding;
- plan stage;
- document draft;
- appointment edit;
- payment form.

---

## Destructive actions

Опасные действия должны требовать подтверждения.

Опасные действия:

- архивировать пациента;
- отменить запись;
- удалить/архивировать finding;
- отменить план лечения;
- отменить документ;
- отменить оплату;
- отключить amoCRM;
- ограничить tenant;
- изменить тариф;
- удалить файл;
- очистить локальные demo data.

Подтверждение должно объяснять последствия.

Плохой текст:

```text
Вы уверены?
```

Лучше:

```text
Отменить запись пациента на 10 июня 10:00? История записи сохранится.
```

---

## Safe confirmations

Confirmation должен быть конкретным.

Пример:

```text
Отключить amoCRM для этой клиники? Синхронизация будет остановлена, но данные DentalFlow сохранятся.
```

Пример:

```text
Архивировать пациента? Пациент исчезнет из активного списка, но история сохранится.
```

Пример:

```text
Отменить документ? Документ не будет удалён, статус изменится на cancelled.
```

---

## Navigation

Навигация должна быть предсказуемой.

Основные зоны:

```text
Dashboard
Patients
Appointments / Schedule
Treatment Plans
Documents
Finance
Reports
Settings
Integrations
Platform Admin
```

Не все зоны нужны сразу. Но route structure должна быть понятной и не случайной.

---

## Breadcrumbs

Для глубоких экранов полезны breadcrumbs.

Пример:

```text
Пациенты → Иван Иванов → План лечения
```

Или:

```text
Настройки → Интеграции → amoCRM
```

Breadcrumbs помогают не потеряться.
Пользователь и так потерян в жизни достаточно, CRM может хотя бы не добавлять.

---

## Tenant context visibility

В SaaS интерфейсе пользователь должен понимать, в каком tenant работает.

UI должен показывать:

- название клиники;
- текущий tenant;
- возможно branch, если появится;
- access status, если есть ограничение.

При смене tenant нужно очищать tenant-scoped state.

---

## Tenant switch safety

При смене tenant UI должен сбрасывать:

- открытую карточку пациента;
- выбранную запись;
- выбранный план;
- фильтры, если они tenant-specific;
- cached patient data;
- integration status;
- finance data;
- reports data.

Плохой сценарий:

```text
Tenant A patient remains visible after switching to Tenant B
```

Это cross-tenant leak.

---

## Layout consistency

Основные страницы должны иметь общий layout.

Рекомендуемая структура:

```text
Page title
Page description or context
Primary action
Filters / tabs
Content
Empty/loading/error state
Secondary actions
```

Не каждая страница должна быть уникальным дизайнерским приключением.

---

## Page header

Page header должен показывать:

- название страницы;
- контекст;
- primary action;
- important status.

Пример:

```text
Пациенты
Управление базой пациентов клиники
[Добавить пациента]
```

Пример:

```text
Карточка пациента: Иван Иванов
Источник: Instagram · Статус: План предложен
```

---

## Primary action

На странице должен быть понятный primary action.

Примеры:

```text
Добавить пациента
Создать запись
Создать план лечения
Сформировать документ
Добавить оплату
Подключить amoCRM
```

Не должно быть пять одинаково важных синих кнопок.
Если всё главное, значит главное ничего.

---

## Secondary actions

Secondary actions должны быть менее заметными.

Примеры:

- экспорт;
- фильтр;
- настройки колонок;
- архив;
- история;
- открыть логи;
- повторить sync.

Secondary actions не должны спорить с primary action.

---

## Tabs

Tabs подходят для разделения крупных смысловых блоков.

Например PatientCard:

```text
Обзор
Записи
Зубная карта
Проблемы
Планы лечения
Документы
Финансы
История
Интеграции
```

Tabs не должны быть случайным складом всего подряд.
Каждая вкладка должна иметь понятную ответственность.

---

## PatientCardPage

PatientCardPage — центральный экран.

Он не должен быть God Component.
Правильная структура:

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

PatientCardPage объединяет, но не содержит всю бизнес-логику.

---

## PatientCard overview

Overview должен быть кратким.

Показывать:

- ФИО;
- телефон;
- дата рождения / возраст;
- source;
- lead status;
- allergy warning;
- next appointment;
- active findings count;
- active treatment plan;
- debt/balance summary if allowed;
- amoCRM status;
- important notes according to permission.

Не показывать всё сразу. Overview — это приборная панель, а не цифровой чердак.

---

## DentalChart UI

DentalChart должен быть понятен врачу.

Правила:

- номера зубов видны;
- выбранный зуб выделен;
- active findings заметны;
- severity видна;
- missing/implant/crown/filling statuses различимы;
- planned treatment отличается от completed;
- color not only signal;
- tooltip/labels help;
- no accidental status changes on click.

Выбор зуба — это навигация.
Изменение medical data — отдельное действие.

---

## DentalChart visual safety

Зубная карта не должна превращаться в новогоднюю гирлянду.

Severity нужно показывать аккуратно:

```text
urgent
high
medium
low
```

Но UI не должен кричать на врача всеми цветами сразу.
Цвет помогает, но не должен быть единственным носителем смысла.

---

## Tooth details panel

Для деталей зуба лучше использовать side panel или компактный блок.

Показывать:

- toothNumber;
- current state;
- active findings;
- severity;
- linked plan stages;
- actions according to permission.

Не делать большую модалку с полями всего пациента.

---

## Findings UI

Findings должны быть отдельным списком или вкладкой.

Показывать:

- toothNumber, если есть;
- category;
- title;
- severity;
- status;
- linked treatment plan;
- createdAt;
- doctor, если есть.

Фильтры:

```text
active
urgent
planned
in_treatment
completed
monitoring
declined
```

Finding не должен скрываться только потому, что попал в план.

---

## TreatmentPlans UI

TreatmentPlansTab должен показывать:

- список планов;
- статус;
- этапы;
- сумму;
- currency;
- linked findings;
- patient preview action;
- document action;
- commercial status;
- safe amoCRM placeholder/status.

Не должен:

- автоматически завершать лечение;
- создавать payment;
- закрывать finding;
- отправлять medical data в amoCRM.

---

## PatientPreview UI

PatientPreview должен быть patient-facing.

Показывать:

- понятное описание;
- этапы;
- стоимость;
- next step;
- рекомендации;
- предупреждения, адаптированные врачом.

Не показывать:

- internal IDs;
- sync status;
- amoCRM IDs;
- raw clinical notes;
- debug data;
- tokens;
- raw riskDescription without adaptation.

---

## Documents UI

Documents UI должен различать:

```text
preview
draft
generated snapshot
printed
sent
signed
cancelled
archived
```

Preview не должен выглядеть как официальный сохранённый документ.

Если document engine не реализован, action должен быть disabled.

Пример:

```text
Создание документа будет доступно после подключения модуля документов.
```

---

## Snapshot UI

Сохранённый документ должен показывать, что это snapshot.

Пример:

```text
Документ сформирован: 2026-06-06 15:20
Версия шаблона: 3
```

Если план лечения изменился позже, старый документ не должен выглядеть как live view.

---

## Appointments UI

Schedule UI должен показывать:

- patient;
- doctor;
- cabinet;
- start/end time;
- duration;
- status;
- type;
- reason;
- source;
- warnings according to permission.

Appointment completed не должен визуально означать treatment completed.

Статусы должны быть понятными:

```text
scheduled
confirmed
arrived
in_progress
completed
cancelled
no_show
rescheduled
```

---

## Calendar UI

Calendar views могут быть:

```text
day
week
doctor
cabinet
list
```

MVP может быть проще.
В календаре не надо показывать full medical data.
Compact appointment card должна быть privacy-safe.

---

## Conflict UI

Если слот занят, UI должен объяснить:

```text
Это время уже занято у врача.
```

или:

```text
Кабинет занят в выбранное время.
```

или:

```text
Время вне рабочего графика.
```

Conflict message должен быть понятным and safe.

---

## Finance UI

Finance UI должен показывать только тем, кому разрешено.

Показывать:

- planned amount;
- paid amount;
- debt;
- refunds;
- payment history;
- cashier actions.

Не показывать finance data всем ролям автоматически.
Payment не должен визуально закрывать medical status.

---

## Platform billing UI

Platform billing UI отличается от clinic finance.

Clinic owner может видеть:

- tariff;
- subscription status;
- access status;
- invoice;
- amount due;
- payment instructions;
- upgrade options.

Ordinary staff видит только safe message if access limited.
Не показывать debt subscription всем сотрудникам.

---

## Integrations UI

Integrations UI должен быть безопасным.

Показывать:

- connected/disconnected;
- account name;
- last sync;
- safe error;
- reconnect required;
- configure/disconnect actions according to permission.

Не показывать:

- access token;
- refresh token;
- client secret;
- authorization code;
- raw webhook payload;
- raw OAuth response.

---

## amoCRM UI

amoCRM UI должен напоминать, что это sales integration.

Показывать:

- source;
- lead status;
- commercial status;
- sync status;
- safe summary;
- disabled action if not implemented.

Не показывать medical details.
Не отправлять dental chart or findings.

---

## Settings UI

Settings должен быть разделён.

Возможные секции:

```text
Clinic profile
Users and roles
Doctors
Cabinets
Schedule
Templates
Finance
Integrations
Billing
Security
```

Не смешивать tenant billing, amoCRM config, doctors and document templates в одну кашу.

---

## Platform admin UI

Platform admin UI должен быть отдельно от clinic UI.

Platform admin работает с:

- tenants;
- subscriptions;
- tariffs;
- access statuses;
- platform billing;
- support access;
- integration health;
- platform audit.

Clinic users не должны случайно видеть platform admin UI.

---

## Tables

Tables подходят для списков.

Правила:

- понятные колонки;
- не слишком много колонок;
- actions справа;
- filters сверху;
- pagination;
- sorting;
- empty state;
- loading state;
- safe data per role.

Не надо пихать длинные абзацы в таблицу.
Таблица для чисел, статусов, коротких значений и действий, а не для романа о пациенте.

---

## Table columns

Patients table может показывать:

```text
ФИО
Телефон
Источник
Lead status
Следующий визит
План
Баланс, if allowed
Actions
```

Не показывать dental chart в table.

Appointments table:

```text
Время
Пациент
Врач
Тип
Статус
Кабинет
Actions
```

---

## Badges

Badges подходят для статусов.

Примеры:

```text
new_lead
plan_proposed
approved
overdue
connected
needs_reconnect
urgent
no_show
```

Badges должны быть:

- короткими;
- понятными;
- consistent;
- not color-only;
- role-safe.

---

## Status labels

Статусы должны иметь human-readable labels.

Плохо:

```text
leadStatus: plan_proposed
```

Хорошо:

```text
План предложен
```

Internal enum может быть английским.
UI label — понятным пользователю.

---

## Colors

Цвета должны быть consistent.

Примерная логика:

- neutral for draft/unknown;
- positive for success/approved/connected;
- warning for overdue/needs attention;
- danger for urgent/error/suspended;
- info for scheduled/proposed.

Но цвет не должен быть единственным носителем смысла.

---

## Icons

Icons могут помогать, но не заменять текст.

Не делать интерфейс, где всё понятно только человеку, который прошёл курс “угадай пиктограмму”.
Tooltip or label нужен для важных действий.

---

## Forms

Forms должны быть короткими и группированными.

Правила:

- required fields marked;
- validation near field;
- clear labels;
- helper text where needed;
- save/cancel actions visible;
- dangerous action separated;
- no hidden medical consequences.

---

## Form labels

Labels должны быть понятными.

Плохо:

```text
Src
LeadSt
TP Sum
```

Хорошо:

```text
Источник обращения
Статус лида
Сумма плана лечения
```

Сокращения экономят пиксели и тратят человеческую жизнь.

---

## Required fields

Required fields должны быть явно обозначены.

Пример:

```text
ФИО *
Телефон *
Дата записи *
Врач *
```

Validation message:

```text
Укажите телефон пациента.
```

Не просто:

```text
Invalid
```

---

## Validation UX

Validation должна быть:

- рядом с полем;
- понятной;
- не агрессивной;
- не только после submit, если можно заранее;
- backend errors mapped to fields where possible.

Server-side validation errors должны показываться safe.

---

## Phone fields

Phone fields должны быть удобными.

Правила:

- показывать формат;
- не ломать ввод;
- позволять казахстанские номера;
- не делать лишнюю магию;
- не превращать phone normalization в потерю номера.

---

## Date/time fields

Date/time UI должен учитывать tenant timezone.

Показывать понятный формат.

Пример:

```text
10.06.2026 10:00
```

Не показывать raw ISO string пользователю, если это не technical UI.

---

## Money fields

Money fields должны показывать currency.

Пример:

```text
250 000 KZT
```

Не показывать просто:

```text
250000
```

Пользователь не должен гадать, это тенге, баллы лояльности или количество страданий.

---

## Long text fields

Для медицинских описаний нужны нормальные text areas.

Правила:

- placeholder помогает;
- autosize if useful;
- save state visible;
- patient-facing text separated from internal note;
- no accidental sending to amoCRM.

---

## Internal note vs patient-facing text

UI должен различать:

```text
Внутренняя заметка врача
Текст для пациента
Комментарий администратора
Финансовая заметка
```

Не использовать одно поле “Комментарий” для всего подряд без контекста.

---

## Sensitive field warnings

Для sensitive fields можно показывать аккуратную подсказку.

Пример:

```text
Эта заметка видна только пользователям с медицинскими правами.
```

или:

```text
Этот текст не отправляется в amoCRM.
```

Это помогает пользователю не бояться и не гадать.

---

## Medical safety UI

UI не должен создавать впечатление, что система ставит диагноз.

Запрещённые UX-паттерны:

```text
AI diagnosis generated
Auto treatment recommended
Payment completed → treatment completed
Appointment completed → tooth treated
Lead won → medical case closed
```

Если AI/automation когда-нибудь появится, UI должен ясно показывать doctor confirmation.

---

## AI assistance UI

Future AI helper может быть только assistant.

UI должен показывать:

```text
Предложение AI
Требует проверки врача
Не является диагнозом
```

AI output не должен автоматически сохраняться как medical fact.

---

## Medical statuses UI

Medical statuses должны отличаться от commercial statuses.

Пример:
Medical:

```text
finding.status = discovered / planned / in_treatment / completed
```

Commercial:

```text
leadStatus = plan_proposed / plan_approved / lost
```

Не смешивать в одном dropdown.

---

## Commercial statuses UI

Commercial statuses нужны администраторам/sales.

Примеры:

```text
Новый лид
Связались
Записан на консультацию
Консультация проведена
План предложен
План согласован
Потерян
```

Они не должны закрывать medical data.

---

## Finance statuses UI

Finance statuses:

```text
unpaid
partially_paid
paid
refunded
debt
```

Они не должны закрывать treatment.
Payment paid ≠ treatment completed.

---

## Document statuses UI

Document statuses:

```text
draft
generated
printed
sent
signed
cancelled
archived
```

Generated document should look different from preview.
Cancelled document should remain visible in history where allowed.

---

## Integration statuses UI

Integration statuses:

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

Errors must be safe.
No raw token errors.

---

## Access statuses UI

Tenant access statuses:

```text
full_access
limited_access
read_only
billing_only
blocked
archived
```

Messages differ by role.
Clinic owner sees billing details.
Ordinary staff sees limited safe message.

---

## Accessibility

UI should consider accessibility.

Rules:

- sufficient contrast;
- readable font sizes;
- labels for controls;
- keyboard navigation where practical;
- focus states;
- not color-only statuses;
- screen reader friendly labels where possible;
- clickable areas large enough;
- error messages connected to fields.

Accessibility is not decoration. It is how people actually use software without developing a grudge.

---

## Responsive design

DentalFlow should support desktop first for complex medical workflows.

Desktop/tablet priorities:

- dental chart;
- treatment plan editing;
- schedule;
- reports.

Mobile can support:

- patient search;
- quick call;
- appointment view;
- simple status updates;
- owner dashboard summary.

Full dental chart editing on small mobile is future UI task.

---

## Mobile UI

Mobile should be simplified.

Good mobile tasks:

- view patient summary;
- call patient;
- see next appointment;
- confirm appointment;
- see plan summary;
- see payment status if allowed.

Avoid:

- full dental chart editing;
- complex document generation;
- giant tables;
- dense reports.

---

## Tablet UI

Tablet can be useful for doctors.

Tablet-friendly:

- dental chart;
- side panel;
- patient preview;
- treatment plan review;
- appointment day view.

Touch targets should be large enough.

---

## Modals

Modals are useful for small focused tasks.

Good modal use:

- add patient quick form;
- edit appointment;
- add finding;
- confirm destructive action;
- record simple payment;
- reconnect amoCRM confirmation.

Bad modal use:

- entire patient card;
- full treatment plan editor;
- full document engine;
- full report;
- nested modals.

Nested modals are how UI starts asking for exorcism.

---

## Side panels

Side panels are good for contextual details.

Examples:

- tooth details;
- appointment details;
- patient quick view;
- sync log details;
- payment details.

Side panel keeps page context.
Useful for dental chart and schedule.

---

## Drawers

Drawers can be used for:

- filters;
- settings preview;
- detail view;
- mobile navigation.

Do not put critical unsaved medical forms in a drawer without clear save/close behavior.

---

## Toasts

Toasts are good for short feedback.

Use for:

- saved;
- deleted/archived;
- sync started;
- copy success;
- non-critical warning.

Do not use toast as the only place for critical error.
Critical error should remain visible.

---

## Alerts

Alerts are for important persistent messages.

Examples:

```text
У пациента есть медицинские ограничения.
Требуется повторное подключение amoCRM.
Доступ ограничен из-за статуса подписки.
```

Alerts should be clear and dismissible only when safe.

---

## Tooltips

Tooltips explain disabled actions or compact icons.

Do not hide critical information only in tooltip.
Tooltip is support, not main content.

---

## Filters

Filters should be obvious.

Examples:

Patients:

```text
source
lead status
doctor
next appointment
active plan
debt
```

Appointments:

```text
date
doctor
status
type
cabinet
```

Reports:

```text
date range
doctor
source
status
```

Filters should have reset option.

---

## Search

Search should be fast and clear.

Patients search:

```text
ФИО
телефон
patient number
```

Search result should not reveal other tenant data.
No global search for clinic users.

---

## Pagination

Long lists need pagination or lazy loading.

Patients, appointments, documents, sync logs and audit logs should not load everything forever.

Loading 10 000 patients into one page is not ambition, it is a cry for help.

---

## Sorting

Sorting should be controlled.

UI should show current sort.
Sort fields should be safe and known.

Do not let arbitrary sort field from UI become backend query without allowlist.

---

## Performance UX

UI should avoid heavy unnecessary loading.

Rules:

- load summary first;
- lazy load heavy tabs;
- avoid full document load until needed;
- avoid loading all patient dental charts in list;
- avoid giant payloads;
- show skeleton/loading states.

---

## Lazy loading

PatientCard can load:

```text
overview first
dental chart on tab open
documents on tab open
finance on tab open if allowed
audit/history on demand
```

This keeps UI responsive.

---

## Data freshness

When data may be stale, UI should allow refresh.

Examples:

- schedule;
- sync status;
- reports;
- integration logs.

Do not silently show stale critical data as if it is fresh.

---

## Real-time updates

Real-time is future.

If implemented later:

- tenant-scoped;
- permission-aware;
- no cross-tenant leaks;
- safe events;
- no medical data broadcast to unauthorized clients.

MVP can use manual refresh.

---

## Offline behavior

Offline support is not MVP.

If app is offline, show clear message.
Do not pretend save succeeded.

Example:

```text
Нет подключения. Изменения не сохранены.
```

Offline medical data editing is high-risk and needs separate architecture.

---

## Drafts

Drafts can help with long forms.

Examples:

- treatment plan draft;
- document draft;
- clinical note draft.

Draft storage must be clear:

- local draft;
- backend draft;
- unsaved;
- saved.

Do not confuse draft with official saved document.

---

## Autosave

Autosave can be useful but risky.

If used:

- show saving state;
- show saved state;
- handle conflicts;
- avoid silent overwrite;
- distinguish draft vs official;
- avoid autosaving accidental medical facts.

Manual save may be safer for medical data in MVP.

---

## Keyboard shortcuts

Keyboard shortcuts are future.

They can help power users.
But shortcuts must not trigger dangerous medical/finance actions without confirmation.

---

## Internationalization

Future languages may include:

```text
ru
kk
en
```

MVP can use Russian.
But UI text should not be hardcoded in ways that make localization impossible later.

Do not mix languages randomly in visible UI.
Internal enum can be English.
Visible label should be localized.

---

## Terminology consistency

Use consistent terms.

Examples:

```text
Пациент
Запись
Зубная карта
Клиническая находка
План лечения
Документ
Оплата
Интеграция
Подписка
Тариф
```

Do not call the same thing:

```text
заявка
лид
пациент
клиент
карточка
```

interchangeably without meaning.

---

## Naming in UI

UI labels should be human.

Internal:

```text
leadStatus
TreatmentPlan
DentalFinding
```

UI:

```text
Статус лида
План лечения
Клиническая находка
```

For complex terms, add helper text.

---

## Avoid technical noise

Do not show technical fields to normal users:

- tenantId;
- internal ID;
- sync payload;
- DTO name;
- stack trace;
- API route;
- OAuth state;
- webhook secret;
- raw JSON.

Technical data belongs in admin/debug tools with permission.

---

## Debug UI

Debug UI should not be visible in production ordinary roles.

If debug panel exists:

- dev only;
- platform admin only if safe;
- no secrets;
- no medical payload;
- clear label.

No accidental debug dumps in patient card.

---

## Reports UI

Reports should be readable.

Rules:

- date range visible;
- filters visible;
- numbers formatted;
- export permission checked;
- no medical details in platform reports;
- tenant-scoped;
- loading/error states.

Avoid chart overload. A report with 17 charts and no answer is just decorative fog.

---

## Dashboard UI

Dashboard should show actionable summary.

For clinic:

- appointments today;
- no-show;
- new patients;
- treatment plans proposed;
- payments summary if allowed;
- overdue follow-ups;
- integration warnings.

For platform:

- active tenants;
- overdue tenants;
- MRR;
- integration health;
- support alerts.

Do not mix clinic dashboard with platform dashboard.

---

## Settings complexity

Settings should be grouped and searchable later.

Avoid dumping all settings on one page.
Settings are dangerous because users click them once every six months and forget what they meant.

Use descriptions.

---

## Onboarding

Future onboarding can guide clinic setup.

Steps:

```text
Create clinic profile
Add doctors
Set schedule
Add services/prices
Invite users
Configure roles
Connect amoCRM
Set document templates
```

Onboarding should be optional after setup.

---

## First-run experience

For new tenant, show useful empty states.

Example:

```text
Добро пожаловать в DentalFlow.
Начните с добавления врача и первого пациента.
```

Do not show ten empty tables and call it onboarding.

---

## Help text

Helpful microcopy can prevent errors.

Examples:

```text
Источник обращения нужен для отчётов и amoCRM.
```

```text
Lead status не меняет медицинский статус пациента.
```

```text
Документ будет создан как snapshot.
```

Short, clear, not patronizing.

---

## Safety microcopy

Safety microcopy should explain boundaries.

Examples:

```text
Медицинские данные не отправляются в amoCRM.
```

```text
Оплата не завершает лечение автоматически.
```

```text
Запись завершена, но услуга должна быть подтверждена отдельно.
```

These messages prevent wrong mental models.

---

## Role-specific wording

Use wording appropriate to role.

Doctor:

```text
Добавить клиническую находку
```

Receptionist:

```text
Записать пациента
```

Cashier:

```text
Добавить оплату
```

Owner:

```text
Посмотреть отчёт
```

Platform admin:

```text
Ограничить доступ tenant
```

---

## Confirmation wording

Confirmation text should say exactly what changes.

Bad:

```text
Продолжить?
```

Good:

```text
Отменить план лечения? План останется в истории со статусом cancelled.
```

---

## Error wording

Error text should avoid blaming user.

Better:

```text
Не удалось сохранить изменения. Проверьте данные и повторите попытку.
```

Not:

```text
Вы ввели неправильные данные.
```

Unless field validation specifically says what is wrong.

---

## Medical wording

Medical wording should be careful.

Do not make diagnosis claims unless doctor entered them.

UI should say:

```text
Клиническая находка
```

not:

```text
Диагноз
```

unless diagnosis module exists.

Do not auto-label problems as diagnosis.

---

## Commercial wording

Commercial wording should not pretend medical completion.

Bad:

```text
Лечение завершено
```

for lead status.

Better:

```text
Коммерческий статус: лечение завершено
```

or avoid confusing label.
Even better: separate commercial and medical blocks.

---

## Finance wording

Payment labels should be precise.

```text
Оплачено
```

means money. It does not mean treatment completed.

Avoid labels that imply medical result.

---

## UI and source of truth

UI should not imply frontend/localStorage is production source of truth.

If prototype:

```text
Данные сохраняются локально в демо-режиме.
```

In production:

```text
Данные сохраняются в системе клиники.
```

Reports should state limitations.

---

## Prototype warnings

If a feature is prototype-only, UI should not oversell it.

Examples:

```text
Демо-режим
Черновик
Будет доступно позже
Требуется backend
```

No fake production claims.

---

## Skeleton features

Skeleton features should be clearly disabled or labelled.

Examples:

```text
amoCRM: будет доступно после подключения интеграции.
```

```text
PDF: будет доступен после подключения модуля документов.
```

Do not create buttons that silently do nothing.

---

## No fake actions

Do not add fake actions that only show console.log.

Bad:

```text
button "Sync with amoCRM"
→ console.log
```

Better:

```text
disabled button with explanation
```

Fake buttons rot quickly and deceive users.

---

## No hidden network actions

UI action should not secretly perform dangerous external operations.

If action syncs, sends, exports, deletes, charges, or disconnects, the user should know.

No surprise side effects.

---

## External actions

Actions involving external systems need clarity.

Examples:

- send reminder;
- sync amoCRM;
- export document;
- send PDF;
- payment link;
- public booking link.

UI should show what will happen and to whom.

---

## Send actions

Before sending anything to patient or external system:

- show recipient;
- show content or summary;
- show channel;
- confirm if sensitive;
- log action;
- respect permissions.

Do not send medical text accidentally.

---

## Export actions

Export actions must show:

- what will be exported;
- file type;
- sensitive content warning if needed;
- permission requirement.

Export should be audited.

---

## Print actions

Print should distinguish:

```text
print preview
print generated document
```

Do not print full PatientCard as official document.

Official document must be snapshot-based.

---

## Safe patient-facing documents

Patient-facing UI should not include internal fields.

No:

- tenantId;
- internal IDs;
- sync status;
- raw findings;
- private notes;
- debug data;
- tokens;
- raw errors.

---

## Component responsibility

Components should have focused responsibility.

Good:

```text
PatientOverview
DentalChart
ToothDetailsPanel
FindingsList
TreatmentPlanCard
AppointmentForm
IntegrationStatusBadge
```

Bad:

```text
PatientCardPage handles everything
```

God components are where maintainability goes to quietly die.

---

## Component size

If component grows too large, split it.

Warning signs:

- too many states;
- too many effects;
- multiple domains;
- giant JSX;
- unrelated handlers;
- medical + finance + integration logic together;
- impossible to test.

Split by domain and responsibility.

---

## Hooks

Hooks should have clear purpose.

Examples:

```text
usePatients
usePatientCard
useAppointments
useTreatmentPlans
useAmoCrmStatus
```

Avoid hooks that know everything.
A hook called `useEverything` should be considered a confession.

---

## State management

State should be local where possible and shared where needed.

Avoid global state for:

- open patient details across tenant switch;
- sensitive medical data without cleanup;
- temporary form data not needed globally.

Tenant switch must clear tenant-scoped state.

---

## Effects

React effects should not create hidden business logic.

Avoid:

```text
useEffect triggers sync
useEffect completes treatment
useEffect creates payment
```

Effects are for lifecycle/data loading, not surprise domain operations.

---

## API calls from UI

Frontend API calls should go to DentalFlow backend.

No direct external provider calls.
Especially:

```text
no React → amoCRM API
no tokens in frontend
```

UI calls backend, backend enforces safety.

---

## Data fetching

Data fetching should be explicit.

Pages should know:

- what data they load;
- loading state;
- error state;
- permissions;
- tenant context.

No uncontrolled fetches after tenant switch.

---

## Caching

Frontend cache must be tenant-aware.

Cache keys should include tenantId where relevant.

Do not show cached Tenant A data in Tenant B.

---

## Security in UI

UI must avoid exposing:

- secrets;
- tokens;
- raw provider payloads;
- medical data to wrong roles;
- billing debt to ordinary staff;
- other tenant data.

Sensitive display should be permission-aware.

---

## Privacy in visible screens

Clinic screens may be visible to patients in the room.

Compact views should avoid unnecessary sensitive details.

Examples:

- schedule compact card should not show clinical notes;
- waiting room screen should not show medical reasons;
- patient preview should not show internal notes.

---

## Audit visibility

Audit logs should be role-restricted.

Users may see simple history.
Platform/owner may see detailed audit.
Medical audit may require special permission.

Do not show raw audit metadata to everyone.

---

## Sync logs visibility

Sync logs are technical.

Visible to:

- clinic owner;
- admin with integration permission;
- platform support if allowed.

Not visible to ordinary medical roles by default.

Sync logs must not show secrets.

---

## File UI

File lists should show:

- file name;
- type;
- createdAt;
- createdBy;
- linked entity;
- actions according to permission.

Do not expose storageKey or raw file URL if unsafe.

---

## Upload UI

Upload should show:

- allowed types;
- max size;
- progress;
- validation error;
- upload result.

Do not accept any file silently.

---

## Dangerous file actions

Delete/archive file requires confirmation.

If file linked to document, explain impact.
Do not delete legal document files casually.

---

## Import UI

Import is high-risk.

Future import UI should include:

- file upload;
- preview;
- mapping;
- validation result;
- duplicate warnings;
- dry-run;
- confirm import;
- report.

No “upload and pray”.

---

## Export UI

Export UI should include:

- scope;
- format;
- sensitive data warning;
- role check;
- progress;
- expiration;
- audit.

---

## Reports and charts

Charts should answer a question.

Good chart:

```text
No-show rate by month
```

Bad chart:

```text
random colorful dashboard because dashboards need charts
```

Every chart should have title, date range and context.

---

## Print styles

Future print styles should be designed.

Do not rely on browser print of app screen for official documents.
Documents need their own template.

---

## Design system

Future design system should define:

- typography;
- spacing;
- colors;
- buttons;
- badges;
- tables;
- forms;
- modals;
- alerts;
- cards;
- tabs;
- icons;
- empty states.

Consistency prevents UI entropy.
UI entropy is when every button looks like it came from a different civilization.

---

## Spacing

Spacing should be consistent.

Avoid cramped forms.
Medical screens need readability.

Dense does not mean efficient. Sometimes dense just means the user needs coffee and a lawyer.

---

## Typography

Text should be readable.

Rules:

- clear hierarchy;
- page title;
- section title;
- body text;
- helper text;
- error text;
- status labels.

Avoid tiny critical text.

---

## Cards

Cards are useful for summary blocks.

Examples:

- patient overview;
- active treatment plan;
- next appointment;
- billing status;
- integration status.

Cards should not become nested boxes forever.

---

## Lists

Lists should be scannable.

Use:

- title;
- status;
- key metadata;
- action.

Avoid long paragraphs in list rows.

---

## Detail pages

Detail pages should structure information.

Good detail page:

```text
Header
Summary
Tabs
Actions
History
```

Bad detail page:

```text
one endless scroll of unrelated blocks
```

---

## Breadcrumb and back behavior

Back action should be predictable.

From patient card:

```text
Back to patients list
```

From appointment detail:

```text
Back to schedule
```

Avoid browser-history traps.

---

## Route deep links

Important screens should be linkable.

Examples:

- patient card;
- appointment detail;
- treatment plan;
- document;
- settings integration page.

Deep links still require permission checks.

---

## 404 page

404 should be useful.

Example:

```text
Страница не найдена или у вас нет доступа.
```

For tenant-owned entities, avoid revealing whether entity exists in another tenant.

---

## Unauthorized page

Unauthorized state:

```text
Недостаточно прав для просмотра этой страницы.
```

Suggest contacting clinic owner/admin if appropriate.

Do not expose permission internals to all users.

---

## Suspended tenant UI

If tenant suspended, show role-aware message.

Ordinary staff:

```text
Доступ к системе временно ограничен. Обратитесь к владельцу клиники.
```

Clinic owner:

```text
Доступ ограничен из-за статуса подписки. Перейдите в раздел оплаты.
```

Do not delete or hide data as if lost.

---

## Feature unavailable UI

If feature not in tariff:

```text
Эта функция доступна на тарифе Pro.
```

Action:

```text
Посмотреть тарифы
```

only for roles allowed to manage billing.

---

## No permission UI

If user lacks permission:

```text
У вас нет прав для выполнения этого действия.
```

Do not show button as active.
Do not let operation fail only after destructive flow.

---

## No data vs no access

UI should distinguish:

```text
нет данных
```

from:

```text
нет доступа
```

But sometimes for security, use generic message.
For cross-tenant entities, safe 404 may be better.

---

## Medical warnings

Medical warning should be visible to allowed roles.

Examples:

- allergy;
- contraindication;
- urgent finding;
- important note.

Do not show sensitive details to roles without permission.

Receptionist may see:

```text
Есть медицинское предупреждение
```

Doctor may see details.

---

## Allergy UI

Allergy warning should be clear.

Example:

```text
Аллергия: лидокаин
```

or if limited:

```text
Есть медицинское ограничение
```

Do not send allergy to amoCRM.

---

## Urgent findings UI

Urgent findings should be visible in patient card and dental chart.

But not panic-inducing.

Use clear label:

```text
Срочно
```

with context.

---

## No medical data in amoCRM UI

Any amoCRM preview should show only safe fields.

Allowed:

- name;
- phone;
- source;
- lead status;
- plan amount;
- commercial status;
- next appointment.

Forbidden:

- toothNumber;
- finding;
- diagnosis;
- riskDescription;
- clinical notes;
- medical documents.

---

## Sync preview UI

Sync preview should help verify outgoing data.

Show:

```text
Будет отправлено в amoCRM:
ФИО
Телефон
Источник
Статус лида
Сумма плана
Коммерческий статус
```

Also show:

```text
Медицинские данные не отправляются.
```

---

## Audit prompts for risky sync

Manual sync may need confirmation if it updates external system.

Example:

```text
Отправить коммерческий статус в amoCRM?
Медицинские данные не будут отправлены.
```

---

## Avoid accidental submit

Forms should avoid accidental destructive submit.

Enter key in textarea should not submit whole medical form unexpectedly.

Dangerous actions require explicit button.

---

## Button labels

Buttons must be action-specific.

Good:

```text
Сохранить пациента
Создать запись
Добавить находку
Сформировать документ
Записать оплату
Подключить amoCRM
```

Bad:

```text
ОК
Применить
Далее
Сделать
```

unless context is obvious.

---

## Cancel behavior

Cancel should be clear.

If unsaved changes exist, confirm.
Cancel should not delete saved data.

---

## Archive vs delete wording

Use archive where data preserved.

```text
Архивировать пациента
```

not:

```text
Удалить пациента
```

unless hard delete truly happens. Hard delete should be rare.

---

## History UI

History should show meaningful events.

Examples:

- appointment created;
- appointment cancelled;
- finding created;
- plan approved;
- document generated;
- payment recorded;
- sync failed;
- tenant suspended.

History should be filterable later.

---

## Timeline UI

Patient timeline can be future.

It can show:

```text
appointments
findings
plans
documents
payments
comments
```

Role-aware filtering required.

---

## Comments UI

Comments should be typed.

Possible comment types:

```text
admin
medical
finance
support
```

If MVP has one comment field, label limitation.
Do not show medical comments to sales role.

---

## Notifications UI

Notification center is future.

Could show:

- appointment reminders;
- overdue follow-ups;
- sync failures;
- billing alerts;
- document tasks.

Notifications should be role-aware.

---

## Badge overload

Do not put too many badges on one row.

If a patient has 12 statuses, group them.
Too many badges stop being information and become decorative confetti.

---

## Progressive disclosure

Show important summary first, details on demand.

Example:

```text
3 active findings
```

click to view details.
This keeps UI clean.

---

## Avoid hidden critical data

Progressive disclosure should not hide critical warnings.

Allergy, urgent finding and access restriction must be visible to allowed roles.

---

## Critical alerts priority

Priority order:

```text
security/access issue
medical safety warning
save/error state
appointment conflict
billing/access restriction
integration issue
general info
```

UI should not bury urgent medical warning under amoCRM status.

---

## Keyboard and focus

Forms and modals should manage focus.

After opening modal, focus first field.
After error, focus error summary or first invalid field.
After save, return to logical place.

---

## Focus after destructive action

After confirming destructive action, UI should land somewhere sensible.

Example:

- after cancelling appointment, return to schedule;
- after archiving patient, return to patient list;
- after disconnecting amoCRM, show integration status.

---

## Loading skeletons

Skeletons can improve perceived performance.

But they should not look like real data.
Avoid showing fake patient names in skeleton.

---

## Data formatting

Format consistently:

- phone numbers;
- money;
- dates;
- statuses;
- names;
- percentages.

Inconsistent formatting makes product look cheaper than it is. Cruel, but true.

---

## Locale

Default locale can be Russian for MVP.

Future must allow localization.
Date/time/money formatting should not be scattered manually everywhere.

---

## Error recovery

Error should offer recovery action if possible.

Examples:

```text
Повторить
Обновить расписание
Вернуться к списку пациентов
Подключить amoCRM заново
Перейти к оплате подписки
```

---

## Safe fallback

If data missing, show safe fallback.

Examples:

```text
Не указано
Статус неизвестен
Нет телефона
Дата не задана
```

Do not invent medical or financial values.

Missing tooth state should not become healthy.
Missing payment status should not become paid.

---

## Unknown state UI

Unknown is allowed.

Example:

```text
Состояние неизвестно
```

Unknown is better than false certainty.
UI should not lie to look complete.

---

## Patient identity display

Patient name should be prominent.

If name missing:

```text
Пациент без имени
```

But require name on create if business rules demand.
Phone should be easy to copy/call.

---

## Copy actions

Copy actions can exist for:

- phone;
- patient link;
- document number;
- invoice number.

Show success toast:

```text
Скопировано.
```

No need for fireworks. Sadly.

---

## Quick contact actions

Quick contact actions:

- call;
- WhatsApp;
- copy phone.

Do not send medical details automatically.
Opening WhatsApp should not preload sensitive medical message unless carefully controlled.

---

## WhatsApp message templates

Future templates must be privacy-safe.

Allowed:

```text
Напоминаем о записи завтра в 10:00.
```

Forbidden:

```text
Напоминаем о лечении 47 зуба...
```

Message send UI should preview content.

---

## System boundaries in UI

UI should show when something is external.

Example:

```text
amoCRM
WhatsApp
SMS provider
Payment provider
```

User should understand data leaves DentalFlow.

---

## Consent and confirmation for external sends

Before sending externally:

- show recipient;
- show channel;
- show content/summary;
- confirm if sensitive.

No silent external sends.

---

## Public links UI

Public links future.

UI should show:

- expiration;
- access scope;
- copy link;
- revoke link.

Public links should not expose sensitive data by default.

---

## Security UI

Security settings should be clear.

Future:

- users;
- roles;
- sessions;
- support access;
- integration tokens status;
- audit.

Do not show raw secrets.

---

## Support access UI

Support access should show:

- who has access;
- why;
- when expires;
- what scope;
- revoke action.

Support access should be audited.

---

## User management UI

User management should show:

- name;
- email/phone;
- role;
- status;
- last active;
- actions.

Inviting users requires permission.
Do not expose all platform users to clinic owner.

---

## Role management UI

Role management is advanced.

If implemented:

- show permissions grouped by domain;
- explain sensitive permissions;
- confirm dangerous role changes;
- audit changes.

Do not make permissions a giant checkbox swamp without grouping.

---

## Domain grouping for permissions

Groups:

```text
Patients
Appointments
Medical
Treatment Plans
Documents
Finance
Reports
Integrations
Billing
Users
Platform
```

This helps humans survive permission setup.

---

## UI tests future

UI tasks should eventually have tests for:

- rendering;
- empty state;
- loading state;
- error state;
- permission-based visibility;
- disabled feature;
- tenant switch cleanup;
- no secrets displayed;
- no medical data in amoCRM preview.

---

## Manual QA checklist

For UI PRs, check:

- changed screens;
- role visibility;
- tenant context;
- empty/loading/error states;
- disabled states;
- no secrets;
- no medical leakage;
- no accidental backend assumptions;
- mobile/tablet if relevant;
- accessibility basics;
- report.

---

## Visual regression future

Visual regression can help later.

Useful for:

- patient card;
- dental chart;
- schedule;
- treatment plans;
- documents;
- billing states.

Not required in MVP.

---

## Storybook future

Storybook or component examples can help.

Especially for:

- buttons;
- badges;
- cards;
- modals;
- dental chart states;
- empty states;
- error states.

Not required now.

---

## UI PR report requirements

Every UI task report should include:

- changed components;
- changed routes;
- tenant impact;
- sensitive data impact;
- role/permission impact;
- storage impact;
- empty/loading/error states;
- disabled states;
- what was not implemented;
- risks.

---

## What UI tasks must not hide

Do not hide:

- fake action;
- missing backend;
- prototype storage;
- permission not enforced;
- sensitive data shown;
- no error state;
- no loading state;
- no mobile handling if relevant;
- accessibility risk.

Better ugly truth in report than pretty lie in UI.

---

## MVP UI path

Safe MVP UI path:

```text
1. Clear navigation
2. Patients list
3. Patient card overview
4. Dental chart
5. Findings
6. Treatment plans
7. Appointments
8. Documents placeholder
9. Finance placeholder/basic
10. amoCRM placeholder/status
11. Settings placeholder
12. Billing/access placeholder
```

Do not build every module fully at once.

---

## What can be simplified in MVP

Can simplify:

- role model;
- mobile support;
- document engine;
- reports;
- billing UI;
- integrations UI;
- advanced filters;
- dashboard;
- audit UI.

But limitations must be clear.

---

## What cannot be simplified badly

Cannot simplify by:

- showing all medical data to everyone;
- mixing payment and treatment completion;
- making PatientCard a God Component;
- hiding errors;
- fake saving;
- fake sync;
- fake document generation;
- relying on disabled button as security;
- showing other tenant data after switch.

These are not MVP shortcuts. These are future bug reports wearing a fake mustache.

---

## Design review checklist

Before accepting UI PR, ask:

- Is the user’s task obvious?
- Is the current tenant clear?
- Is the patient clear?
- Are medical/commercial/finance/integration meanings separated?
- Are errors safe?
- Are disabled states explained?
- Are dangerous actions confirmed?
- Are permissions reflected?
- Are secrets hidden?
- Is sensitive data role-aware?
- Is there a report?

---

## Что нельзя делать

Нельзя:

- превращать PatientCardPage в God Component;
- смешивать medical, commercial, finance, integration and billing statuses;
- показывать full medical data всем ролям;
- показывать billing debt всем сотрудникам;
- показывать tokens/secrets in UI;
- делать fake buttons with console.log;
- делать active button for not implemented feature;
- создавать document by opening preview;
- завершать treatment from payment UI;
- завершать treatment from appointment UI;
- отправлять medical data from UI to amoCRM;
- делать direct frontend external API calls;
- оставлять stale tenant data after tenant switch;
- скрывать critical errors in toast only;
- использовать color as only status indicator;
- делать tables with huge paragraphs;
- делать destructive actions without confirmation;
- делать import/export without clear warning and permissions;
- заявлять production readiness for prototype UI.

---

## Правила для ИИ-задач

Если задача касается UI, UX, pages, components, forms, navigation, patient card, dental chart, treatment plans, appointments, documents, finance, reports, settings, integrations or billing screens, ИИ должен проверить:

- role-aware UI considered;
- tenant context visible or future-noted;
- no cross-tenant stale state;
- no secrets displayed;
- no medical data to amoCRM;
- medical/commercial/finance domains separated;
- empty/loading/error states included;
- disabled states explained;
- dangerous actions confirmed;
- PatientCard not God Component;
- frontend not treated as security boundary;
- backend limitations stated;
- report created.

---

## Acceptance для UI/UX задач

UI/UX задача считается корректной, если:

- scope ограничен;
- user task понятен;
- states handled;
- permission impact указан;
- tenant impact указан;
- sensitive data impact указан;
- no fake actions;
- disabled actions explain why;
- medical data protected;
- integration data safe;
- platform billing separated from clinic finance;
- component responsibility clear;
- report includes risks and what was not implemented.

---

## Итог

UI/UX DentalFlow должен быть спокойным, понятным и role-aware.

Главная UI-цепочка:

```text
User role
→ Tenant context
→ Page context
→ Domain block
→ Safe action
→ Clear feedback
```

Главная UX-мысль:

```text
интерфейс должен объяснять смысл,
а не только показывать поля
```

Главная safety-мысль:

```text
UI помогает соблюдать границы,
но backend enforcing обязателен
```

Главная product-мысль:

```text
DentalFlow должен быть удобен врачу, администратору, кассиру, владельцу и platform staff,
но каждый должен видеть и делать только то, что ему нужно и разрешено
```

Если UI будет аккуратно разделять смыслы, DentalFlow станет рабочим инструментом.

Если UI смешает всё на одном экране, получится система, где врач ищет зубную карту между amoCRM sync, кассир видит clinical notes, receptionist путает оплату с лечением, а владелец думает, почему красивый интерфейс ведёт себя как склад неподписанных коробок.

Красиво — недостаточно. Понятно, безопасно и полезно — вот цель.
