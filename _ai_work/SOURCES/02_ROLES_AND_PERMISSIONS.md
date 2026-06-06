# 02_ROLES_AND_PERMISSIONS.md

## Назначение документа

Этот документ описывает будущую систему ролей и прав доступа в DentalFlow CRM.

DentalFlow создаётся как SaaS-платформа для разных стоматологических клиник, поэтому права доступа должны учитывать два уровня:

1. Уровень платформы.
2. Уровень конкретной клиники.

Главное правило:

**пользователь одной клиники не должен видеть данные другой клиники.**

Если в будущем система будет продаваться другим клиникам, роли и права доступа нельзя делать “на глазок”. Иначе получится типичная человеческая архитектура: “все видят всё, но мы надеемся, что никто не нажмёт лишнее”. Надежда — плохой security layer, хотя люди почему-то регулярно пытаются её деплоить.

---

## Главный принцип доступа

В DentalFlow доступ должен строиться на связке:

```text
user
→ tenant membership
→ role
→ permissions
→ backend checks
→ allowed / denied operation
```

Пользователь сам по себе не должен иметь полный доступ ко всем данным.

Права пользователя должны определяться в контексте конкретного tenant.

Один и тот же человек может быть:

- владельцем одной клиники;
- врачом во второй клинике;
- консультантом в третьей клинике;
- platform admin на уровне платформы.

Поэтому роль нельзя хранить как одно глобальное поле пользователя.

---

## Два уровня доступа

В системе должно быть два независимых уровня ролей.

### 1. Роли платформы

Это роли владельца DentalFlow как SaaS-продукта.

Они управляют:

- клиниками;
- подписками;
- доступом;
- тарифами;
- техническими настройками;
- поддержкой;
- глобальными интеграциями;
- системным аудитом.

### 2. Роли клиники

Это роли сотрудников конкретной стоматологической клиники.

Они работают с:

- пациентами своей клиники;
- расписанием своей клиники;
- врачами своей клиники;
- зубными картами своей клиники;
- планами лечения своей клиники;
- оплатами своей клиники;
- складом своей клиники;
- отчётами своей клиники.

Эти уровни нельзя смешивать.

Platform owner управляет SaaS-платформой.

Clinic owner управляет своей клиникой.

Врач лечит пациентов своей клиники.

Кассир фиксирует оплаты своей клиники.

Администратор записывает пациентов своей клиники.

---

## Термины

### Platform

DentalFlow как SaaS-платформа.

Платформа может обслуживать много клиник.

### Tenant

Отдельная клиника, компания или сеть клиник, подключённая к DentalFlow.

Возможные будущие названия:

```text
tenant
organization
clinic
company
```

Пока в документации используется термин:

```text
tenant
```

### User

Глобальная учётная запись человека в DentalFlow.

User может иметь доступ к одному или нескольким tenant.

### TenantUser

Связь пользователя с конкретным tenant.

Именно здесь должна храниться роль пользователя внутри клиники.

### Role

Роль пользователя.

Например:

```text
clinic_owner
doctor
receptionist
cashier
platform_admin
```

### Permission

Конкретное право на действие.

Например:

```text
patients.view
patients.create
patients.update
billing.manage
integrations.configure
```

---

## Почему одной роли недостаточно

Нельзя делать систему так:

```text
user.role = "doctor"
```

Потому что один пользователь может быть врачом в одной клинике и владельцем в другой.

Правильная будущая модель:

```text
User
Tenant
TenantUser
Role
Permission
```

Пример:

```text
User A
→ Tenant 1: clinic_owner
→ Tenant 2: doctor
→ Tenant 3: viewer
```

Это важно для SaaS.

Иначе при росте проекта начнётся классический цирк: “почему врач из одной клиники видит другую клинику?” Ответ обычно неприятный: потому что архитектура была сделана как табуретка, а на неё поставили многоэтажный дом.

---

## Роли уровня платформы

Роли платформы управляют DentalFlow как SaaS-продуктом.

Платформенные роли не должны автоматически получать медицинский доступ ко всем данным клиник без отдельного правила.

Возможные platform roles:

```text
platform_owner
platform_admin
support
technical_admin
billing_manager
```

---

## platform_owner

`platform_owner` — владелец DentalFlow как SaaS-платформы.

Может:

- видеть список tenant;
- создавать tenant;
- активировать tenant;
- приостанавливать tenant;
- восстанавливать tenant;
- управлять тарифами;
- управлять подписками;
- видеть platform billing;
- видеть platform audit;
- управлять platform admins;
- видеть системные настройки;
- принимать решения по доступу клиник.

Не должен автоматически:

- редактировать зубные карты пациентов всех клиник;
- менять планы лечения всех клиник;
- создавать медицинские документы от имени врача;
- видеть медицинские данные без специального режима поддержки и audit log.

Platform owner управляет платформой, а не лечит пациентов.

---

## platform_admin

`platform_admin` — администратор платформы.

Может:

- помогать управлять tenant;
- смотреть технический статус клиник;
- помогать с подписками, если есть permission;
- видеть базовую информацию по tenant;
- помогать с настройками платформы;
- работать с support-запросами.

Не должен автоматически:

- иметь полный доступ к медицинским данным;
- менять данные пациентов без разрешённого support access;
- обходить tenant isolation;
- видеть токены интеграций в открытом виде.

---

## support

`support` — сотрудник поддержки DentalFlow.

Support может помогать клинике с техническими вопросами.

Support access должен быть ограниченным и логируемым.

Правила:

- support не должен иметь постоянный доступ ко всем данным клиник;
- support-доступ должен быть временным;
- support-доступ должен иметь причину;
- действия support должны попадать в audit log;
- support не должен видеть больше данных, чем нужно для решения проблемы.

Пример будущей логики:

```text
clinic_owner grants support access
→ support gets temporary access
→ all actions are audited
→ access expires
```

---

## technical_admin

`technical_admin` — технический администратор платформы.

Может:

- видеть системное состояние;
- проверять backend;
- смотреть безопасные логи;
- управлять техническими настройками;
- помогать с интеграциями.

Не должен:

- видеть medical documents без необходимости;
- видеть secrets в открытом виде;
- менять данные пациентов без audit;
- использовать technical role как медицинский superuser.

---

## billing_manager

`billing_manager` — роль для управления platform billing.

Может:

- видеть подписки tenant;
- видеть invoices платформы;
- видеть оплаты за SaaS;
- видеть overdue/suspended tenants;
- помогать с billing contact;
- готовить ручные корректировки, если разрешено.

Не должен:

- видеть оплаты пациентов как clinic finance, если это не требуется;
- редактировать зубные карты;
- менять планы лечения;
- иметь медицинский доступ.

Platform billing и clinic finance должны быть разделены.

---

## Роли уровня клиники

Роли клиники действуют только внутри конкретного tenant.

Возможные clinic roles:

```text
clinic_owner
clinic_admin
manager
head_doctor
doctor
orthopedist
orthodontist
surgeon
receptionist
cashier
warehouse_manager
marketer
sales_manager
viewer
```

Названия могут уточняться позже.

Главное:

**роль клиники не должна давать доступ к другим tenant.**

---

## clinic_owner

`clinic_owner` — владелец клиники внутри tenant.

Может:

- видеть данные своей клиники;
- управлять сотрудниками своей клиники;
- назначать роли;
- видеть отчёты;
- видеть финансы клиники;
- видеть настройки клиники;
- управлять интеграциями своей клиники;
- видеть billing status своей подписки;
- обращаться в поддержку;
- запрашивать export данных;
- управлять доступом сотрудников.

Не может:

- видеть данные других клиник;
- управлять platform billing всех tenant;
- менять тарифы платформы самостоятельно;
- отключать другие клиники;
- обходить ограничения подписки.

---

## clinic_admin

`clinic_admin` — администратор клиники или управляющий с расширенными правами.

Может:

- управлять расписанием;
- управлять пациентами;
- управлять врачами;
- видеть отчёты своей клиники;
- управлять настройками клиники, если разрешено;
- видеть часть финансов, если разрешено;
- контролировать администраторов;
- контролировать записи и follow-up.

Может не иметь:

- полного доступа к platform billing;
- права удалять критичные данные;
- права управлять подпиской;
- права менять owner-level настройки.

---

## manager

`manager` — управляющий или руководитель клиники.

Может:

- видеть операционные отчёты;
- видеть расписание;
- видеть пациентов своей клиники;
- контролировать планы лечения;
- контролировать оплату, если разрешено;
- видеть работу администраторов;
- видеть эффективность врачей;
- видеть источники пациентов.

Не должен автоматически:

- редактировать медицинские данные;
- менять зубную карту;
- ставить диагноз;
- видеть platform-level billing details.

---

## head_doctor

`head_doctor` — главный врач.

Может:

- видеть медицинские данные пациентов своей клиники;
- контролировать врачей;
- просматривать зубные карты;
- просматривать clinical findings;
- просматривать планы лечения;
- контролировать качество медицинского ведения;
- возможно утверждать сложные планы лечения.

Не должен автоматически:

- управлять platform billing;
- отключать tenant;
- видеть данные других клиник;
- управлять токенами интеграций.

---

## doctor

`doctor` — врач-стоматолог.

Может:

- видеть своих пациентов или пациентов клиники, если разрешено;
- открывать карточку пациента;
- работать с зубной картой;
- фиксировать жалобы;
- создавать clinical findings;
- создавать планы лечения;
- редактировать свои планы лечения;
- формировать patient preview;
- просматривать историю лечения;
- видеть свои записи в расписании.

Не должен автоматически:

- видеть platform billing;
- управлять подпиской;
- подключать amoCRM;
- видеть токены;
- видеть данные других tenant;
- удалять критичные финансовые данные;
- редактировать чужие планы без permission.

---

## orthopedist

`orthopedist` — стоматолог-ортопед.

Это специализированная роль врача.

Может иметь права doctor плюс специфические права:

- работать с протезированием;
- создавать ортопедические планы;
- видеть связанные документы;
- вести этапы протезирования.

Не должен автоматически получать административные или billing-права.

---

## orthodontist

`orthodontist` — ортодонт.

Может иметь права doctor плюс специфические права:

- вести ортодонтические планы;
- видеть длительные планы лечения;
- работать с этапами;
- фиксировать наблюдения.

Не должен автоматически получать доступ к финансам или platform settings.

---

## surgeon

`surgeon` — хирург.

Может иметь права doctor плюс специфические права:

- вести хирургические планы;
- работать с имплантацией, если такая модель будет добавлена;
- фиксировать хирургические этапы;
- видеть relevant medical data.

Не должен автоматически получать права администратора или кассира.

---

## receptionist

`receptionist` — администратор/регистратор.

Может:

- создавать пациента;
- искать пациента;
- записывать пациента;
- менять статус записи;
- видеть расписание;
- видеть источник обращения;
- видеть lead status;
- видеть коммерческий статус плана;
- связываться с пациентом;
- создавать follow-up, если разрешено.

Не должен автоматически:

- редактировать зубную карту;
- создавать clinical findings;
- ставить диагноз;
- редактировать медицинские этапы лечения;
- видеть sensitive medical details сверх необходимого;
- управлять platform billing;
- подключать интеграции.

Администратор должен помогать клинике работать, а не случайно становиться врачом через лишнюю кнопку.

---

## cashier

`cashier` — кассир.

Может:

- видеть финансовый блок пациента;
- фиксировать оплату;
- видеть долг пациента;
- видеть возвраты, если разрешено;
- видеть стоимость плана лечения;
- формировать финансовую выписку, если будет реализовано.

Не должен автоматически:

- редактировать зубную карту;
- создавать clinical findings;
- менять медицинский статус лечения;
- считать оплату фактом выполненной услуги;
- видеть platform billing;
- подключать интеграции.

Payment не должен автоматически закрывать treatment stage.

---

## warehouse_manager

`warehouse_manager` — сотрудник склада.

Может:

- видеть материалы;
- видеть остатки;
- создавать движения склада;
- фиксировать закупки;
- фиксировать списания;
- видеть складские отчёты;
- связывать материалы с выполненными услугами, если это реализовано.

Не должен автоматически:

- менять планы лечения;
- менять зубную карту;
- видеть platform billing;
- видеть медицинские данные сверх необходимости;
- списывать материалы из appointment или treatment plan без правил.

---

## marketer

`marketer` — маркетолог клиники.

Может:

- видеть источники пациентов;
- видеть отчёты по каналам;
- видеть conversion reports;
- видеть рекламные источники;
- видеть обезличенную или ограниченную аналитику, если требуется.

Не должен автоматически:

- видеть полные медицинские карты;
- редактировать зубную карту;
- видеть sensitive clinical details;
- видеть токены интеграций;
- управлять platform billing.

---

## sales_manager

`sales_manager` — менеджер по продажам или follow-up.

Может:

- видеть лидов;
- видеть lead status;
- видеть источник;
- видеть коммерческий статус плана лечения;
- видеть сумму плана;
- создавать follow-up;
- работать с amoCRM status;
- связываться с пациентом.

Не должен автоматически:

- видеть dental chart;
- видеть clinical findings;
- видеть diagnosis;
- видеть riskDescription;
- редактировать медицинские данные;
- видеть медицинские документы.

Sales role должна работать с коммерческой сводкой, а не с медицинской картой.

---

## viewer

`viewer` — роль только для просмотра.

Может:

- смотреть разрешённые данные;
- не создавать;
- не редактировать;
- не удалять.

Используется для:

- аудиторов;
- временного доступа;
- наблюдателей;
- ограниченного доступа руководителя;
- будущих external viewers, если появятся.

---

## Permission-based модель

Роли должны быть набором permissions.

Не нужно жёстко зашивать всю логику только в названия ролей.

Пример permissions:

```text
patients.view
patients.create
patients.update
patients.archive

appointments.view
appointments.create
appointments.update
appointments.cancel

dental_chart.view
dental_chart.update

findings.view
findings.create
findings.update
findings.close

treatment_plans.view
treatment_plans.create
treatment_plans.update
treatment_plans.approve
treatment_plans.archive

documents.view
documents.create
documents.print
documents.cancel

payments.view
payments.create
payments.refund

finance.view
finance.reports

warehouse.view
warehouse.update

reports.view
reports.export

integrations.view
integrations.configure
integrations.sync

billing.view
billing.manage

users.view
users.invite
users.update_role
users.disable

tenant.settings.view
tenant.settings.update

platform.tenants.view
platform.tenants.create
platform.tenants.suspend
platform.tenants.activate
platform.billing.manage
platform.audit.view
```

Финальный список permissions будет уточняться позже.

---

## Почему permissions лучше одной роли

Роли удобны для пользователя.

Permissions удобны для backend.

Например, роль `clinic_admin` может иметь:

```text
patients.view
patients.create
appointments.view
appointments.create
reports.view
```

Но не иметь:

```text
dental_chart.update
platform.tenants.suspend
integrations.configure
```

Так систему легче расширять.

Иначе каждый новый клиент начнёт просить “почти как администратор, но без вот этой кнопки, зато с вот той”. Человеческая фантазия в ролях бесконечна, и лучше встретить её permission-моделью, а не истерикой в коде.

---

## Backend enforcement

Права должны проверяться на backend.

Frontend может:

- скрывать кнопки;
- показывать disabled actions;
- показывать объяснение;
- адаптировать меню;
- ограничивать UI.

Но frontend не является защитой.

Backend обязан проверять:

```text
current user
current tenant
membership
role
permission
subscription status
entity ownership
```

Пример плохой логики:

```text
кнопка скрыта во frontend
→ значит пользователь не сможет выполнить действие
```

Пример правильной логики:

```text
POST /api/tenants/:tenantId/patients
→ backend checks patients.create
→ backend checks tenant membership
→ backend checks subscription status
→ allowed / denied
```

---

## Tenant membership

Пользователь должен иметь membership в tenant.

Будущая модель:

```text
TenantUser
- id
- tenantId
- userId
- roleId
- status
- invitedAt
- joinedAt
- disabledAt
```

Возможные статусы membership:

```text
invited
active
disabled
removed
```

Если membership disabled, пользователь не должен иметь доступ к tenant.

---

## User status

User может иметь глобальный статус.

Примеры:

```text
active
disabled
pending
blocked
```

Если user disabled на уровне платформы, он не должен входить в систему.

Если user active глобально, но disabled внутри tenant, он не должен видеть этот tenant.

---

## Роли нельзя хранить только во frontend

Frontend может хранить текущую роль в UI state.

Но source of truth должен быть backend/database.

Нельзя доверять роли из localStorage.

Плохая логика:

```text
localStorage.role = "clinic_owner"
```

и UI открывает доступ.

Правильная логика:

```text
backend returns currentUser + tenant memberships + permissions
backend checks every important operation
```

---

## Platform roles и tenant roles нельзя смешивать

Плохой вариант:

```text
role = "admin"
```

И непонятно:

- admin платформы?
- admin клиники?
- admin склада?
- admin billing?
- admin amoCRM?

Правильнее:

```text
platform_admin
clinic_admin
```

и отдельно permissions.

Названия должны быть точными.

Иначе потом один “admin” случайно получит доступ ко всему. Люди любят короткие названия, а потом долго чинят последствия.

---

## Principle of least privilege

Каждая роль должна получать минимально необходимые права.

Примеры:

- receptionist не должен редактировать зубную карту;
- cashier не должен ставить диагноз;
- marketer не должен видеть full medical chart;
- support не должен иметь постоянный доступ к данным клиник;
- platform billing manager не должен видеть medical details;
- doctor не должен управлять platform subscription;
- sales manager не должен видеть riskDescription.

Доступ должен расширяться осознанно.

---

## Медицинские данные и роли

Медицинские данные должны быть ограничены.

К медицинским данным относятся:

- жалобы;
- зубная карта;
- tooth state;
- clinical findings;
- diagnosis, если появится;
- riskDescription;
- medical documents;
- врачебные комментарии;
- completed services;
- медицинская история.

Доступ к ним должен иметь только медицинская роль или роль с явным permission.

---

## Коммерческие данные и роли

Коммерческие данные:

- источник пациента;
- lead status;
- сумма плана лечения;
- статус согласования;
- follow-up;
- amoCRM status;
- deal status;
- communication status.

Их могут видеть:

- администратор;
- управляющий;
- sales manager;
- clinic owner;
- marketer в ограниченном виде.

Но коммерческая роль не должна автоматически видеть медицинскую карту.

---

## Финансовые данные и роли

Финансовые данные клиники:

- оплаты пациентов;
- долги;
- возвраты;
- касса;
- финансовые отчёты;
- стоимость планов.

Их могут видеть:

- cashier;
- clinic owner;
- manager;
- clinic admin, если разрешено.

Не каждый врач должен видеть всю кассу клиники.

Не каждый администратор должен делать возвраты.

---

## Platform billing и роли

Platform billing:

- подписка клиники;
- тариф;
- SaaS invoice;
- overdue;
- suspended;
- cancelled;
- billing contact.

Эти данные видят:

- platform_owner;
- platform_admin с permission;
- billing_manager;
- clinic_owner своей клиники.

Обычные сотрудники клиники не должны видеть задолженность клиники перед DentalFlow, если это не разрешено.

---

## Интеграции и роли

Интеграции должны иметь отдельные права.

Permissions:

```text
integrations.view
integrations.configure
integrations.disconnect
integrations.sync
```

Подключать amoCRM должен только пользователь с право настройки интеграций.

Обычный врач или кассир не должен подключать amoCRM.

Токены интеграций никто не должен видеть в открытом виде.

---

## amoCRM и роли

amoCRM-интеграция должна учитывать роли.

Можно разрешить:

- clinic_owner: configure;
- clinic_admin: view/status;
- sales_manager: view commercial sync status;
- receptionist: see lead source/status;
- doctor: not required, unless clinic policy allows limited view.

Нельзя разрешать:

- отправлять medical data в amoCRM;
- видеть access_token;
- видеть refresh_token;
- видеть client_secret;
- менять mapping без permission.

---

## Документы и роли

Документы могут быть медицинскими, финансовыми или административными.

Permissions должны различать:

```text
documents.view
documents.create
documents.print
documents.cancel
documents.archive
```

Medical documents может создавать врач или уполномоченная роль.

Финансовые документы может видеть кассир или owner.

Patient-facing preview не должен показывать технические поля.

---

## Удаление и архивирование

Удаление важных данных должно быть ограничено.

Лучше использовать archive/soft delete.

Permissions:

```text
patients.archive
appointments.cancel
documents.cancel
treatment_plans.archive
payments.refund
```

Hard delete должен быть недоступен обычным ролям.

Особенно нельзя случайно удалять:

- пациентов;
- зубные карты;
- findings;
- планы лечения;
- документы;
- оплаты;
- audit logs.

---

## Audit для важных действий

Важные действия должны попадать в audit log.

Примеры:

```text
user.invited
user.role_changed
user.disabled
patient.created
patient.updated
appointment.cancelled
dental_chart.updated
finding.created
treatment_plan.created
document.generated
payment.created
integration.connected
integration.disconnected
tenant.suspended
tenant.activated
support.access_granted
support.access_revoked
```

Audit log должен быть tenant-aware.

---

## Support access

Support access должен быть отдельным режимом.

Правила:

- support access не постоянный;
- support access имеет срок;
- support access имеет причину;
- support access логируется;
- support access ограничен permission;
- clinic_owner или platform_owner может разрешить доступ по процедуре.

Плохой вариант:

```text
support видит все клиники всегда
```

Правильный вариант:

```text
support gets temporary scoped access
```

---

## Tenant switcher

Если пользователь имеет доступ к нескольким tenant, в будущем нужен tenant switcher.

UI должен явно показывать текущий tenant.

Пример:

```text
Текущая клиника: Алтынсака
```

При переключении tenant:

- данные старой клиники должны исчезнуть с экрана;
- frontend должен загрузить данные нового tenant;
- backend должен проверять доступ;
- local state не должен показывать stale данные.

---

## Multi-branch clinics

В будущем один tenant может иметь несколько филиалов.

Это отдельная задача.

Не нужно путать:

```text
tenant
```

и

```text
branch
```

Tenant — клиент платформы.

Branch — филиал внутри tenant.

Роль может быть ограничена филиалом, если такая модель будет добавлена позже.

Но на раннем этапе достаточно tenant-level ролей.

---

## Subscription status и права

Даже если у пользователя есть permission, tenant может быть suspended.

Пример:

```text
user has patients.create
tenant is suspended
→ operation denied
```

Права пользователя не отменяют billing/access control.

Backend должен учитывать:

```text
permission + tenant status + subscription status
```

---

## Feature entitlements

Тариф может ограничивать функции.

Например:

- amoCRM доступна только на Pro;
- warehouse доступен только на Pro;
- advanced reports доступны только на Pro/Enterprise;
- multi-branch доступен только на Enterprise.

Даже если пользователь имеет permission, функция может быть недоступна по тарифу.

Пример:

```text
user has integrations.configure
tenant tariff does not include amocrm_integration
→ operation denied
```

---

## Роли по умолчанию

В будущем можно создать стандартные роли.

Пример:

```text
clinic_owner
clinic_admin
doctor
receptionist
cashier
viewer
```

Но система должна позволять расширять роли.

Не обязательно сразу делать custom roles в MVP.

Но архитектура не должна закрывать такую возможность.

---

## Custom roles

В будущем клиника может захотеть свои роли.

Например:

- старший администратор;
- младший администратор;
- врач без доступа к финансам;
- управляющий без медицинских данных;
- маркетолог только с отчётами;
- бухгалтер только с finance.

Custom roles должны строиться через permissions.

Не реализовывать без отдельной задачи.

---

## MVP-подход к ролям

На раннем этапе можно использовать упрощённые роли.

Например:

```text
clinic_owner
doctor
receptionist
cashier
```

Но даже в MVP нельзя проектировать так, будто multi-tenant и permissions никогда не появятся.

Если сейчас всё построить на `isAdmin: true`, потом будет больно. И не “чуть-чуть неприятно”, а “почему у нас role check размазан по 80 компонентам”.

---

## Frontend UI по ролям

Frontend должен учитывать роли:

- скрывать недоступные разделы;
- показывать disabled-кнопки;
- объяснять, почему действие недоступно;
- не показывать лишние medical/finance/billing данные;
- не показывать platform admin обычным clinic users.

Но frontend не должен быть единственным контролем.

---

## Backend API по ролям

Backend API должен проверять permissions на каждом важном endpoint.

Примеры:

```text
GET /api/tenants/:tenantId/patients
→ patients.view

POST /api/tenants/:tenantId/patients
→ patients.create

PUT /api/tenants/:tenantId/dental-chart/:id
→ dental_chart.update

POST /api/tenants/:tenantId/integrations/amocrm/connect
→ integrations.configure

POST /api/platform/tenants/:tenantId/suspend
→ platform.tenants.suspend
```

Финальные endpoints будут определены позже.

---

## Forbidden by default

Если право не выдано явно, действие должно быть запрещено.

Лучше:

```text
deny by default
```

чем:

```text
allow by default
```

Allow by default — это когда система говорит: “ну вроде можно всем”, а потом юристы и клиенты дружно объясняют, почему нельзя.

---

## Ошибки доступа

Ошибки доступа должны быть безопасными.

Пример:

```text
{
  "ok": false,
  "code": "FORBIDDEN",
  "message": "Недостаточно прав для выполнения действия."
}
```

Если пользователь пытается открыть чужой tenant, лучше не раскрывать лишние детали.

Не нужно писать:

```text
Пациент существует, но принадлежит другой клинике.
```

Это лишняя информация.

---

## Доступ к чужим данным

Пользователь не должен видеть данные чужого tenant даже если знает ID.

Плохая логика:

```text
GET /patients/:patientId
```

и backend возвращает пациента по ID.

Правильная логика:

```text
GET /tenants/:tenantId/patients/:patientId
```

и backend проверяет:

```text
user belongs to tenant
patient belongs to tenant
user has permission
```

---

## Export и роли

Export данных должен быть доступен только ограниченным ролям.

Возможные permissions:

```text
data.export
patients.export
finance.export
documents.export
```

Export должен быть tenant-scoped.

Обычный врач или регистратор не должен выгружать всю базу клиники без разрешения.

---

## Import и роли

Import данных тоже должен быть ограничен.

Permissions:

```text
data.import
patients.import
services.import
warehouse.import
```

Import может повредить данные, поэтому он не должен быть доступен всем.

---

## Reports и роли

Отчёты должны быть role-aware.

Примеры:

- doctor видит свои записи и свои планы;
- manager видит операционные отчёты;
- clinic_owner видит все отчёты своей клиники;
- platform_owner видит platform-level отчёты;
- marketer видит источники и конверсию, но не full medical details;
- cashier видит finance reports, если разрешено.

---

## Минимальная будущая permission-модель

Минимальные сущности:

```text
User
Tenant
TenantUser
Role
Permission
RolePermission
AuditLog
```

Для SaaS также нужны:

```text
Subscription
FeatureEntitlement
```

Но это будет описано подробнее в отдельных документах.

---

## Что нельзя делать

Нельзя:

- делать одну глобальную роль пользователя на всю систему;
- использовать только `isAdmin`;
- давать всем пользователям доступ ко всем tenant;
- хранить роль как единственный security-layer во frontend;
- доверять localStorage для прав;
- смешивать platform_admin и clinic_admin;
- давать support постоянный доступ ко всем клиникам;
- показывать медицинские данные sales_manager без необходимости;
- показывать platform billing обычным сотрудникам клиники;
- давать receptionist редактировать зубную карту без permission;
- давать cashier менять medical statuses;
- давать marketer видеть full medical chart;
- разрешать integration configuration всем ролям;
- разрешать hard delete обычным ролям;
- обходить subscription status через permission.

---

## Правила для ИИ-задач

Если задача касается ролей, пользователей, доступа или permissions, ИИ должен проверить:

- относится ли роль к platform или tenant;
- не смешиваются ли platform roles и clinic roles;
- не даётся ли пользователю глобальный доступ ко всем tenant;
- проверяется ли tenant membership;
- есть ли backend enforcement;
- не полагается ли безопасность только на frontend;
- не раскрываются ли medical data лишним ролям;
- не раскрывается ли platform billing обычным сотрудникам;
- не получает ли support постоянный полный доступ;
- не ломается ли future custom roles;
- не используется ли `isAdmin` как универсальный костыль.

---

## Acceptance для будущих задач по ролям

Задача по ролям и permissions считается корректной, если:

- разделены platform roles и clinic roles;
- tenant context учтён;
- permissions понятны;
- backend enforcement описан или реализован;
- frontend не является единственным security layer;
- least privilege соблюдён;
- sensitive medical/financial/billing data не раскрывается лишним ролям;
- support access ограничен;
- audit impact описан;
- subscription status не обходится permission;
- report создан.

---

## Итог

DentalFlow должна иметь role/permission модель, которая поддерживает SaaS.

Правильная цепочка доступа:

```text
User
→ TenantUser
→ Role
→ Permissions
→ Tenant check
→ Subscription check
→ Entity ownership check
→ Allowed / Denied
```

Главная мысль:

```text
пользователь имеет права не вообще,
а внутри конкретной клиники или на уровне платформы
```

Роли должны помогать людям работать, но не должны превращать систему в проходной двор.

DentalFlow должна защищать:

- данные пациентов;
- медицинские данные;
- финансовые данные;
- документы;
- интеграции;
- platform billing;
- данные других tenant.

Иначе SaaS-платформа быстро станет не продуктом, а лотереей доступа, где каждый новый пользователь — маленькая угроза архитектуре. А такие лотереи обычно выигрывают не владельцы бизнеса, а проблемы.
