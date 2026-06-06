# 12_BILLING_AND_ACCESS_CONTROL.md

## Назначение документа

Этот документ описывает будущую систему подписок, тарифов, доступа tenant, feature entitlement и platform billing в DentalFlow CRM.

DentalFlow создаётся как SaaS-платформа для стоматологических клиник. Это означает, что владелец платформы должен иметь возможность подключать клиники, назначать тарифы, ограничивать функции, контролировать оплату подписки и отключать доступ tenant за неоплату без удаления данных.

Главное правило:

**platform billing не равен clinic finance.**

Platform billing — это деньги, которые клиника платит владельцу DentalFlow за использование SaaS.

Clinic finance — это деньги, которые пациенты платят клинике за лечение.

Если смешать эти две вещи, система быстро превратится в бухгалтерский цирк: пациент оплатил пломбу, tenant получил доступ к amoCRM, кассир закрыл подписку, а владелец платформы пытается понять, почему SaaS оплачивается лечением кариеса. Великолепная схема, если цель — страдать.

---

## Главная цель billing/access control

Billing and access control должны позволить владельцу DentalFlow:

- создавать tenant;
- назначать тариф;
- включать trial;
- активировать tenant;
- видеть статус оплаты;
- видеть просрочку;
- ограничивать доступ при неоплате;
- отключать tenant без удаления данных;
- управлять feature entitlements;
- видеть platform revenue;
- контролировать подписки;
- поддерживать разные тарифные планы;
- развивать SaaS-модель.

Эта система нужна не клинике как медицинский модуль, а владельцу DentalFlow как SaaS-продукта.

---

## Platform billing vs clinic finance

### Platform billing

Platform billing отвечает за:

- подписку клиники на DentalFlow;
- тариф tenant;
- SaaS invoice;
- статус оплаты подписки;
- trial;
- overdue;
- suspended;
- renewal;
- cancellation;
- platform revenue;
- access control.

### Clinic finance

Clinic finance отвечает за:

- планы лечения;
- оплаты пациентов;
- долги пациентов;
- возвраты;
- кассу;
- услуги;
- финансовые отчёты клиники.

### Главное различие

```text
Platform billing:
клиника платит DentalFlow

Clinic finance:
пациент платит клинике
```

Эти домены нельзя смешивать.

---

## Tenant как плательщик SaaS

Tenant — это клиника или компания, которая использует DentalFlow.

Tenant может иметь:

- подписку;
- тариф;
- статус доступа;
- billing contact;
- invoices;
- payment history;
- grace period;
- suspension status;
- cancellation status.

Tenant платит платформе за доступ.

Пациент не платит платформе напрямую за SaaS.

---

## Subscription

Subscription — подписка tenant на DentalFlow.

Subscription может содержать:

```text
id
tenantId
tariffPlanId
status
billingPeriod
startedAt
currentPeriodStart
currentPeriodEnd
trialEndsAt
overdueSince
suspendedAt
cancelledAt
renewalAt
createdAt
updatedAt
```

Не все поля нужны сразу.

Но subscription должна быть отделена от clinic payments.

---

## Subscription status

Возможные статусы подписки:

```text
trial
active
overdue
grace_period
suspended
cancelled
archived
```

### trial

Tenant использует систему в тестовом периоде.

### active

Подписка активна, доступ разрешён.

### overdue

Оплата просрочена, но доступ ещё может быть открыт.

### grace_period

Льготный период после просрочки.

### suspended

Доступ ограничен или заблокирован.

### cancelled

Подписка отменена.

### archived

Tenant больше не активен, данные сохранены по retention policy.

---

## Access status

Subscription status и access status связаны, но не всегда одно и то же.

Пример:

```text
subscriptionStatus = overdue
accessStatus = full_access
```

или:

```text
subscriptionStatus = suspended
accessStatus = read_only
```

Access status может быть:

```text
full_access
limited_access
read_only
billing_only
blocked
archived
```

### full_access

Tenant работает нормально.

### limited_access

Часть функций ограничена.

### read_only

Можно смотреть данные, но нельзя создавать новые записи.

### billing_only

Доступ только к экрану оплаты/подписки для владельца клиники.

### blocked

Обычные пользователи не могут работать.

### archived

Tenant в архиве.

---

## Почему access status нужен отдельно

Иногда подписка может быть просрочена, но владелец платформы хочет дать клинике время.

Пример:

```text
overdue 3 days
→ access still full

overdue 10 days
→ limited_access

overdue 20 days
→ billing_only
```

Если всё завязать только на один status, гибкость исчезнет.

А потом люди начнут править базу руками. Руки и база — союз, после которого обычно появляются отчёты о происшествиях.

---

## TariffPlan

TariffPlan — тариф DentalFlow.

TariffPlan может содержать:

```text
id
code
name
description
priceAmount
currency
billingPeriod
includedFeatures
limits
isActive
createdAt
updatedAt
```

Примеры тарифов:

```text
basic
standard
pro
enterprise
trial
demo
```

Финальные тарифы будут определены отдельно.

---

## Billing period

Billing period может быть:

```text
monthly
quarterly
yearly
custom
```

Для MVP можно начать с monthly.

Но architecture не должна запрещать yearly or custom contract.

---

## Currency

Platform billing должен иметь currency.

Для Казахстана базовая валюта может быть:

```text
KZT
```

Но SaaS architecture может учитывать future multi-currency.

Денежные поля должны быть явными:

```text
amount
currency
```

Плохой вариант:

```text
price: 50000
```

без currency.

---

## Feature entitlement

Feature entitlement — право tenant использовать конкретную функцию.

Примеры features:

```text
patients
appointments
dental_chart
treatment_plans
documents
finance
warehouse
reports
amocrm_integration
sms_reminders
whatsapp_integration
online_booking
multi_doctor_schedule
multi_branch
advanced_reports
api_access
custom_templates
```

Тариф определяет, какие features включены.

---

## Feature entitlement guard

Backend должен проверять доступ к функциям.

Пример:

```text
requireFeature(tenantId, "amocrm_integration")
```

Если feature недоступна:

```text
{
  "ok": false,
  "code": "FEATURE_NOT_AVAILABLE",
  "message": "Эта функция недоступна на текущем тарифе."
}
```

Frontend может показывать disabled button.

Но backend должен enforce.

---

## Feature gate не должен быть только UI

Плохой вариант:

```text
frontend hides amoCRM button
backend sync endpoint still works
```

Правильный вариант:

```text
frontend hides/disables button
backend denies operation without feature entitlement
```

UI — это удобство.

Backend — это контроль.

---

## Пример тарифов

Примерная логика, не финальные коммерческие условия:

```text
Trial:
- patients
- appointments
- dental_chart
- treatment_plans
- limited documents

Basic:
- patients
- appointments
- dental_chart
- treatment_plans

Standard:
- Basic features
- documents
- finance
- reports

Pro:
- Standard features
- amoCRM integration
- reminders
- advanced reports

Enterprise:
- Pro features
- custom limits
- multi-branch
- API access
- custom support
```

Финальный pricing — отдельная бизнес-задача.

---

## Limits

Тариф может иметь limits.

Примеры:

```text
maxUsers
maxDoctors
maxPatients
maxAppointmentsPerMonth
maxDocumentsPerMonth
maxStorageMb
maxBranches
maxIntegrations
maxSmsPerMonth
```

Limits должны быть tenant-scoped.

Backend должен проверять limits.

---

## Limit enforcement

Если лимит превышен:

```text
{
  "ok": false,
  "code": "LIMIT_EXCEEDED",
  "message": "Лимит тарифа исчерпан."
}
```

Пример:

```text
Basic maxDoctors = 3
tenant already has 3 active doctors
creating doctor #4 denied
```

Frontend может предупреждать заранее.

Backend всё равно должен проверять.

---

## Soft limits

Некоторые limits могут быть soft.

Пример:

```text
90% document limit reached
→ show warning

100% reached
→ deny or require upgrade
```

Soft limit behavior должен быть явно определён.

---

## Trial

Trial — тестовый доступ.

Trial может иметь:

```text
trialStartsAt
trialEndsAt
trialStatus
trialConvertedAt
trialExpiredAt
```

Trial может ограничивать:

- срок;
- число пользователей;
- число пациентов;
- интеграции;
- документы;
- exports;
- advanced features.

Trial не должен использоваться как production billing костыль.

---

## Demo tenant

Demo tenant может использоваться для демонстраций.

Demo tenant должен быть явно помечен:

```text
tenantType = demo
```

Demo tenant не должен содержать реальные медицинские данные без обезличивания.

Demo tenant может иметь особые access rules.

---

## Grace period

Grace period — период после просрочки, когда доступ ещё частично или полностью сохраняется.

Пример:

```text
invoice overdue
→ 5 days full_access
→ 10 days limited_access
→ 15 days billing_only
```

Финальные правила зависят от бизнес-модели.

Важно:

```text
grace period is access policy, not data deletion policy
```

---

## Overdue

Overdue означает, что оплата просрочена.

Overdue не означает автоматическое удаление данных.

При overdue можно:

- показать предупреждение clinic_owner;
- отправить уведомление;
- ограничить некоторые premium features;
- создать billing task;
- подготовить suspension if not paid.

Обычные сотрудники могут видеть только безопасное сообщение или вообще не видеть billing details.

---

## Suspended

Suspended означает ограничение доступа tenant.

При suspended:

- данные tenant сохраняются;
- новые write operations могут быть запрещены;
- integrations paused;
- public booking disabled;
- reminders paused;
- exports restricted;
- ordinary users blocked or read-only;
- clinic_owner может видеть billing/access resolution page.

Suspended не означает:

- удалить пациентов;
- удалить документы;
- удалить оплаты;
- удалить зубную карту;
- удалить integration config;
- стереть tenant.

---

## Cancellation

Cancellation означает отмену подписки.

Cancellation может быть:

```text
immediate
end_of_period
manual
non_payment
requested_by_owner
platform_decision
```

Cancelled tenant может перейти в:

```text
read_only
billing_only
archived
```

Данные не удаляются автоматически.

---

## Archive

Archive — состояние, когда tenant больше не работает, но данные сохранены.

Archive может быть нужен для:

- retention policy;
- юридической истории;
- восстановления;
- экспорта;
- закрытия договора.

Archive не равен hard delete.

---

## Hard delete tenant

Hard delete tenant — опасная операция.

Не реализовывать без отдельной high-risk задачи.

Hard delete требует:

- owner decision;
- legal review if needed;
- retention policy;
- backup consideration;
- export option;
- audit;
- confirmation;
- platform admin permission.

Кнопка “удалить клинику” без процедуры — это не функционал, это мина.

---

## Billing contact

Tenant может иметь billing contact.

Пример:

```text
billingContactName
billingContactPhone
billingContactEmail
billingAddress
bin
companyName
```

Эти данные относятся к platform billing.

Они не должны смешиваться с patient contact data.

---

## Billing invoice

Platform invoice — счёт tenant за SaaS.

Invoice может содержать:

```text
id
tenantId
subscriptionId
amount
currency
periodStart
periodEnd
status
issuedAt
dueAt
paidAt
cancelledAt
paymentProvider
externalInvoiceId
```

Это не invoice пациента за лечение.

---

## Invoice status

Статусы platform invoice:

```text
draft
issued
paid
overdue
cancelled
refunded
failed
```

Invoice status может влиять на subscription/access status.

Но не влияет на clinic finance напрямую.

---

## Platform payment

Platform payment — оплата tenant за DentalFlow.

PlatformPayment может содержать:

```text
id
tenantId
invoiceId
amount
currency
paidAt
method
status
externalPaymentId
createdAt
updatedAt
```

Это не patient payment.

---

## Clinic payment

Clinic payment — оплата пациента клинике.

Clinic payment относится к finance domain клиники.

Пример:

```text
patient pays 45000 KZT for treatment
```

Эта оплата не должна активировать SaaS subscription.

Смешивать clinic payment and platform payment нельзя.

---

## Разделение API

Platform billing API:

```text
/api/platform/billing
/api/platform/tenants/:tenantId/subscription
/api/platform/tenants/:tenantId/invoices
/api/platform/tenants/:tenantId/suspend
/api/platform/tenants/:tenantId/activate
```

Clinic finance API:

```text
/api/tenants/:tenantId/payments
/api/tenants/:tenantId/patients/:patientId/payments
/api/tenants/:tenantId/finance/reports
```

Они должны быть разными.

---

## Platform roles

Platform billing видят platform roles.

Примеры:

```text
platform_owner
platform_admin
platform_billing_manager
platform_support
```

Эти роли управляют SaaS-подписками, а не лечением пациентов.

---

## Clinic roles

Clinic roles могут видеть billing/access info ограниченно.

Примеры:

### clinic_owner

Может видеть:

- тариф;
- статус подписки;
- invoices;
- overdue;
- upgrade options;
- payment instructions;
- access restrictions.

### clinic_admin

Может видеть limited status, если разрешено.

### doctor / receptionist / cashier

Обычно не должны видеть platform billing details.

Они могут видеть только access restriction message, если система ограничена.

---

## Permissions для billing

Возможные permissions:

```text
platform.tenants.view
platform.tenants.create
platform.tenants.update
platform.tenants.suspend
platform.tenants.activate
platform.billing.view
platform.billing.manage
platform.tariffs.manage

tenant.billing.view
tenant.billing.pay
tenant.billing.manage
tenant.subscription.view
tenant.subscription.cancel
```

Финальный список будет уточняться.

---

## Billing visibility

Billing details не должны быть видны всем.

Плохой вариант:

```text
every clinic user sees overdue amount
```

Правильный вариант:

```text
clinic_owner sees billing details
ordinary staff sees limited access message
```

Это не медицинская информация, но это бизнес-чувствительная информация tenant.

---

## Access control on suspension

Если tenant suspended, backend должен проверять access.

Пример:

```text
requireTenantAccess(tenantId, operation)
```

Operation categories:

```text
read
write
billing
admin
integration
public_booking
export
```

Правила могут отличаться.

---

## Operation-level access

Access policy может быть operation-level.

Пример:

```text
full_access:
- read allowed
- write allowed
- integrations allowed

read_only:
- read allowed
- write denied
- integrations denied

billing_only:
- billing page allowed
- clinic data denied for ordinary staff
- owner can resolve billing

blocked:
- all tenant operations denied except platform/admin recovery
```

---

## Access policy model

Access policy может быть вычисляемой.

Пример:

```text
tenant.subscriptionStatus
tenant.accessStatus
user.role
operation
feature
```

Решение:

```text
allow / deny / limited
```

Важно:

```text
backend decides
```

---

## Feature entitlement model

Feature entitlement может храниться как:

```text
TariffPlanFeature
- tariffPlanId
- featureKey
- enabled
- limitValue
```

Или как JSON config.

Финальное решение будет в storage/schema задачах.

Главное — feature check должен быть backend-side.

---

## Tenant override

Иногда tenant может иметь override.

Пример:

```text
tenant has custom enterprise deal
amocrm_integration enabled
maxDoctors = 50
special price
```

Overrides должны быть controlled and audited.

Нельзя править тарифные ограничения случайно без истории.

---

## Manual billing MVP

Для MVP можно начать с manual billing.

Manual billing означает:

- platform admin вручную назначает тариф;
- вручную ставит status active/overdue/suspended;
- вручную фиксирует payment;
- без payment provider;
- без automatic charge.

Это допустимо на раннем этапе.

Но должно быть честно помечено как manual.

---

## Payment provider integration

Payment provider integration — отдельная future задача.

Она может включать:

- online SaaS subscription payment;
- card payment;
- invoice payment;
- provider webhook;
- automatic renewal;
- failed payment handling.

Не реализовывать payment provider между делом.

---

## Payment provider safety

Если payment provider появится:

- secrets backend-side;
- webhook signature validation;
- no card data stored unless provider-managed and compliant;
- platform billing separated from clinic finance;
- safe logs;
- audit;
- idempotency;
- retry rules.

---

## Payment webhooks

Payment webhook должен:

- validate provider signature;
- identify invoice;
- identify tenant;
- verify amount/currency;
- update invoice/payment status;
- update subscription/access if rules allow;
- write audit event;
- return safe response.

Не доверять webhook blindly.

---

## Idempotency для billing

Payment webhooks должны быть idempotent.

Повтор webhook не должен создать двойную оплату.

Правило:

```text
externalPaymentId unique per provider
```

или другое controlled uniqueness.

---

## Billing audit

Billing actions должны попадать в audit.

События:

```text
subscription.created
subscription.updated
subscription.cancelled
tenant.suspended
tenant.activated
tenant.access_limited
invoice.issued
invoice.paid
invoice.overdue
payment.recorded
tariff.changed
feature.override_added
feature.override_removed
```

Audit должен быть platform/tenant-aware.

---

## Billing logs не должны содержать secrets

Billing logs не должны содержать:

- payment provider secrets;
- card numbers;
- private keys;
- raw provider payload with secrets;
- tokens;
- passwords.

Можно логировать safe metadata.

---

## Access change audit

Любое изменение доступа tenant должно логироваться.

Пример:

```text
tenant.suspended
tenantId
reason
performedBy
createdAt
previousAccessStatus
newAccessStatus
```

Это важно, потому что отключение клиники — коммерчески чувствительное действие.

---

## Suspension reason

Suspension reason может быть:

```text
non_payment
manual_admin_decision
security_issue
contract_cancelled
trial_expired
abuse
other
```

Reason должен быть сохранён.

Не надо отключать tenant молча.

---

## Reactivation

Reactivation возвращает доступ tenant.

Причины:

```text
payment_received
manual_admin_decision
trial_extended
billing_issue_resolved
```

Reactivation должна:

- обновить status;
- восстановить доступ according to policy;
- possibly resume integrations;
- log audit event;
- not duplicate data.

---

## Trial expiration

Когда trial истёк:

- tenant может перейти в overdue/trial_expired;
- access может стать limited or billing_only;
- clinic_owner sees upgrade/payment screen;
- data remains safe;
- ordinary staff may be blocked.

Trial expiration не удаляет данные.

---

## Upgrade

Upgrade — смена тарифа на более высокий.

Upgrade может:

- включить features;
- увеличить limits;
- активировать integrations;
- изменить billing amount;
- создать invoice or subscription change.

Upgrade должен быть audited.

---

## Downgrade

Downgrade — смена тарифа на более низкий.

Downgrade сложнее.

Нужно проверить:

- current usage vs new limits;
- disabled features;
- integrations;
- documents;
- users/doctors limits;
- reports;
- storage.

Downgrade не должен удалять данные автоматически.

Пример:

```text
Pro has amoCRM
Basic does not
downgrade to Basic
→ amoCRM sync paused
→ connection config retained
→ tokens handled by policy
```

---

## Feature disabled after downgrade

Если feature отключена после downgrade:

- UI hides/disables feature;
- backend denies new operations;
- existing data retained;
- sync/jobs paused;
- owner sees upgrade prompt if appropriate.

Нельзя удалять data created by feature automatically.

---

## Limits after downgrade

Если tenant превышает лимиты нового тарифа:

Пример:

```text
Pro allowed 20 doctors
Basic allowed 3 doctors
tenant has 10 doctors
```

Варианты:

- prevent downgrade;
- allow read-only for excess;
- require deactivation;
- custom override.

Final policy отдельная бизнес-задача.

Не удалять excess entities автоматически.

---

## Billing notifications

Billing notifications могут идти:

- clinic_owner;
- billing contact;
- platform admin;
- support.

Types:

```text
trial ending
invoice issued
payment received
payment failed
overdue warning
access limited
tenant suspended
tenant reactivated
```

Notifications не должны уходить всем сотрудникам без необходимости.

---

## Billing notification content

Safe billing notification:

```text
Срок оплаты подписки DentalFlow истекает 2026-06-10.
```

Не нужно включать лишние sensitive details.

Обычные сотрудники могут видеть:

```text
Доступ к системе ограничен. Обратитесь к владельцу клиники.
```

---

## Public booking and billing

Если tenant suspended:

- public booking может быть disabled;
- existing public links may show safe unavailable message;
- no patient data exposed;
- no new appointments accepted.

Public booking должен проверять tenant access status backend-side.

---

## Integrations and billing

Если tenant suspended или feature disabled:

- amoCRM sync paused;
- reminders paused if feature disabled;
- online booking disabled;
- webhooks restricted;
- background jobs paused or skipped.

Integration config не удаляется автоматически.

---

## Documents and billing

При ограничении доступа документы не должны удаляться.

Document generation может быть disabled for suspended tenant.

Existing documents remain preserved.

Access depends on access policy.

---

## Patient data and billing

Не удалять patient data из-за неоплаты.

Можно ограничить доступ.

Данные tenant должны сохраняться according to retention policy.

Коммерческий спор с клиникой не должен превращаться в потерю медицинской истории.

---

## Exports and billing

Export может быть ограничен при suspended tenant.

Но может потребоваться export before offboarding.

Policy должна быть явной:

- allowed for clinic_owner;
- allowed after payment;
- manual platform support;
- legal/export package.

Не делать export behavior случайным.

---

## Offboarding

Offboarding tenant — процесс завершения работы.

Возможные шаги:

```text
cancel subscription
limit access
offer export
archive tenant
retain data
delete later by policy if allowed
```

Offboarding не должен быть одной кнопкой “удалить всё”.

---

## Data retention

Retention policy нужна для:

- tenant data;
- medical data;
- billing data;
- invoices;
- audit logs;
- documents;
- backups;
- sync logs.

Billing document не определяет финальный legal retention.

Но architecture должна учитывать retention.

---

## Platform revenue reports

Platform owner может видеть SaaS reports:

- active tenants;
- trial tenants;
- overdue tenants;
- suspended tenants;
- MRR;
- revenue by tariff;
- churn;
- conversion trial to paid;
- feature adoption.

Эти reports не должны раскрывать medical patient details.

---

## Clinic finance reports

Clinic owner видит clinic finance reports:

- patient payments;
- treatment plan amounts;
- debts;
- refunds;
- revenue by doctor/service.

Это не platform revenue.

---

## Разделение reports

Platform report:

```text
DentalFlow earned 1 000 000 KZT from subscriptions
```

Clinic report:

```text
Clinic earned 5 000 000 KZT from patients
```

Не смешивать.

---

## Platform billing API access

Platform billing API доступен platform roles.

Clinic owner может видеть только billing info своего tenant.

Обычные clinic users не видят platform billing API.

---

## Security boundaries

Billing содержит чувствительные бизнес-данные.

Защищать:

- tariff;
- invoice;
- payment status;
- billing contacts;
- access restrictions;
- overdue;
- suspension reasons.

Не всё медицинское, но всё равно sensitive.

---

## Safe errors для billing

Safe error:

```text
{
  "ok": false,
  "code": "SUBSCRIPTION_REQUIRED",
  "message": "Доступ к функции ограничен текущим тарифом."
}
```

Safe suspension message:

```text
Доступ к системе временно ограничен. Обратитесь к владельцу клиники.
```

Не показывать обычным сотрудникам подробные billing debt details.

---

## Error codes

Возможные billing/access error codes:

```text
TENANT_SUSPENDED
SUBSCRIPTION_OVERDUE
FEATURE_NOT_AVAILABLE
LIMIT_EXCEEDED
BILLING_PERMISSION_REQUIRED
PAYMENT_REQUIRED
TRIAL_EXPIRED
ACCESS_READ_ONLY
ACCESS_BLOCKED
```

Финальный список будет уточнён при реализации backend.

---

## Billing DTO

Safe billing DTO для clinic_owner:

```text
tenantId
tariffName
subscriptionStatus
accessStatus
currentPeriodEnd
amountDue
currency
nextPaymentDueAt
availableActions
```

Safe billing DTO для ordinary user:

```text
accessStatus
safeMessage
```

Не один DTO для всех ролей.

---

## Platform billing DTO

Platform admin DTO:

```text
tenantId
tenantName
tariffPlan
subscriptionStatus
accessStatus
overdueSince
amountDue
currency
lastPaymentAt
nextRenewalAt
```

Не включать medical data.

---

## Tariff DTO

Tariff DTO:

```text
code
name
priceAmount
currency
billingPeriod
features
limits
isRecommended
```

Можно показывать clinic_owner.

---

## Access middleware

В backend нужен future access middleware.

Пример:

```text
requireTenantOperationAccess(tenantId, operation)
```

Operation examples:

```text
patients.create
appointments.create
documents.generate
integrations.sync
reports.view
billing.view
```

Middleware должен учитывать:

- tenant accessStatus;
- subscriptionStatus;
- feature entitlement;
- permission;
- role.

---

## Billing and permissions order

Порядок проверки может быть:

```text
auth
→ tenant membership
→ permission
→ subscription/access status
→ feature entitlement
→ limit
→ operation
```

Если user не имеет permission, неважно, активен ли тариф.

Если feature не включена, операция запрещена.

---

## Billing and tenant isolation

Billing data tenant-scoped.

Tenant A не видит invoices Tenant B.

Platform roles могут видеть platform-wide billing according to permissions.

Clinic owner видит billing своего tenant.

---

## Billing and support

Support может помогать с billing.

Support access должен быть:

- permission-controlled;
- audited;
- scoped;
- not reveal unnecessary medical data.

Support не должен использовать billing access как проход в medical data.

---

## Billing and audit retention

Billing audit желательно хранить дольше, чем обычные operational logs.

Финальная retention policy отдельная задача.

Но billing actions должны быть traceable.

---

## Billing and legal documents

Invoices and subscription agreements могут иметь legal significance.

Не удалять silently.

Не переписывать paid invoice.

Если нужно корректировать — issue correction/cancelled document.

---

## Invoice snapshot

Invoice should be snapshot.

Если tariff changed later, old invoice amount should remain.

Invoice snapshot may include:

```text
tenant snapshot
tariff snapshot
amount
currency
period
issuedAt
dueAt
```

Не live view.

---

## Billing provider future

Если появится provider, invoice/payment provider data should be separated.

Provider metadata:

```text
provider
externalInvoiceId
externalPaymentId
providerStatus
lastWebhookAt
```

Не хранить card data.

---

## Manual payment recording

Manual payment recording может быть MVP.

Platform billing manager может отметить invoice paid.

Нужно audit:

```text
payment.recorded
invoice.paid
subscription.activated
```

Manual action should require permission.

---

## Fraud/error prevention

Billing actions risky.

Dangerous actions require confirmation:

- suspend tenant;
- cancel subscription;
- mark invoice paid manually;
- change tariff;
- add feature override;
- hard archive tenant.

UI should show consequences.

Backend should enforce permission.

---

## No automatic destructive actions

Billing automation should not destroy data.

Even if:

```text
tenant cancelled
```

Do not:

- delete patients;
- delete documents;
- delete payments;
- delete audit logs;
- delete integrations immediately.

Use archive/retention process.

---

## Background billing jobs

Future jobs:

- trial expiration check;
- invoice generation;
- overdue detection;
- grace period transition;
- suspension transition;
- reminder sending;
- payment reconciliation;
- subscription renewal.

Jobs must be tenant-aware and audited where needed.

---

## Billing job safety

Billing job should:

- be idempotent;
- avoid duplicate invoices;
- avoid duplicate notifications;
- log safe result;
- handle provider failure;
- not delete data;
- not expose secrets.

---

## Idempotent invoice generation

Invoice generation must avoid duplicates.

Example uniqueness:

```text
tenantId + subscriptionId + periodStart + periodEnd
```

If job runs twice, it should not create two invoices for same period.

---

## Access recalculation

Access status may be recalculated.

Example:

```text
invoice paid
→ subscription active
→ access full_access
→ integrations may resume
```

But changes should be logged.

---

## Resuming integrations after payment

If tenant reactivated:

- integrations may resume;
- sync jobs may continue;
- webhooks may process again;
- public booking may enable.

But this should be controlled.

No sudden bulk sync without rules.

---

## Billing and amoCRM

amoCRM integration access can depend on tariff.

Example:

```text
amocrm_integration enabled only for Pro
```

If disabled:

- frontend shows disabled state;
- backend denies connect/sync;
- existing connection paused;
- tokens handled by policy;
- sync logs retained.

Billing status should not send medical data anywhere.

---

## Billing and online booking

Online booking may be feature-gated.

If tenant tariff does not include online booking:

- public booking disabled;
- backend denies public booking creation;
- UI shows upgrade.

---

## Billing and reports

Advanced reports may be feature-gated.

Basic reports can be included.

Advanced reports require feature check.

Backend reports API must enforce.

---

## Billing and users

Tariffs may limit users.

Example:

```text
maxUsers = 10
```

If exceeded:

- prevent inviting new users;
- show upgrade prompt;
- do not disable existing users automatically without policy.

---

## Billing and doctors

Tariffs may limit doctors.

Example:

```text
maxDoctors = 5
```

Same rules:

- enforce on create/activate;
- do not delete doctors automatically.

---

## Billing and storage

Tariffs may limit storage.

Example:

```text
maxStorageMb = 5000
```

If exceeded:

- warn;
- block new uploads;
- allow delete/archive;
- allow upgrade.

Do not delete files automatically.

---

## Billing and documents

Tariffs may limit document generation.

Example:

```text
maxDocumentsPerMonth = 100
```

If exceeded:

- backend denies new document generation;
- existing documents remain available according to access policy.

---

## Billing and reminders

Tariffs may limit reminders.

Example:

```text
maxSmsPerMonth = 500
```

If exceeded:

- reminders paused or denied;
- safe message shown;
- no silent failure.

---

## Billing and API access

API access may be enterprise-only.

If disabled:

- backend denies API token creation;
- existing API tokens disabled according to policy;
- audit created.

---

## Billing and branch support

Multi-branch can be tariff feature.

If tenant does not have multi_branch:

- cannot create branch #2;
- existing branch handling on downgrade needs policy.

Branch architecture is future.

---

## Upgrade prompts

Upgrade prompts should be honest and not block core work aggressively.

Examples:

```text
amoCRM integration is available on Pro.
Upgrade to connect amoCRM.
```

Do not pretend feature is broken.

Say it is tariff-limited.

---

## Billing UI states

UI states:

```text
trial_active
trial_ending
active
overdue_warning
limited_access
read_only
billing_only
suspended
cancelled
archived
```

Each state should have safe message.

---

## Ordinary user blocked message

For ordinary staff:

```text
Доступ к системе временно ограничен. Обратитесь к владельцу клиники.
```

Do not show:

```text
Ваша клиника должна 150000 KZT.
```

unless role allows.

---

## Clinic owner billing message

For clinic_owner:

```text
Подписка просрочена. Для восстановления полного доступа оплатите счёт или свяжитесь с поддержкой.
```

Can show amount, due date, invoice.

---

## Platform admin billing view

Platform admin can see:

- tenant status;
- billing status;
- invoices;
- payments;
- overdue age;
- suspension history;
- tariff;
- feature overrides.

No medical data needed.

---

## Billing search

Platform billing search can search tenants by:

- tenant name;
- billing contact;
- status;
- tariff;
- overdue;
- createdAt.

Clinic users cannot search billing of other tenants.

---

## Billing reports

Reports:

```text
MRR
ARR
active tenants
trial tenants
overdue tenants
suspended tenants
revenue by month
revenue by tariff
churn
trial conversion
average revenue per tenant
```

These are platform reports.

---

## Churn

Churn measures tenant cancellation/loss.

Not patient loss.

Do not confuse:

```text
patient lost lead
```

with:

```text
tenant cancelled subscription
```

Оба “lost”, но смысл разный. Сюрприз: слова иногда недостаточно для модели данных.

---

## Access control testing

Future tests:

- suspended tenant cannot create patient;
- suspended tenant cannot sync amoCRM;
- read_only tenant cannot create appointment;
- billing_only ordinary user blocked;
- clinic_owner can view billing page;
- feature disabled denies endpoint;
- limit exceeded denies create;
- platform admin can suspend;
- clinic doctor cannot suspend tenant;
- clinic finance payment does not activate subscription.

---

## Feature entitlement testing

Tests:

```text
tenant without amocrm feature
→ POST /integrations/amocrm/connect denied

tenant with amocrm feature
→ operation allowed if permission exists
```

---

## Billing separation testing

Test:

```text
patient payment created
→ subscription status unchanged
```

Test:

```text
platform invoice paid
→ clinic patient payments unchanged
```

Это обязательное разделение.

---

## Audit testing

Test:

```text
tenant suspended
→ audit event created
```

Test:

```text
tariff changed
→ audit event created
```

Test:

```text
manual payment recorded
→ audit event created
```

---

## CI checks for billing tasks

For billing/access PRs:

- verify no package changes unless intended;
- verify no secrets;
- verify no payment provider secrets;
- verify no clinic finance mixed with platform billing;
- verify reports mention tenant impact;
- verify access rules not frontend-only.

---

## Docs-only billing task rules

For this task specifically:

- no code changes;
- no billing implementation;
- no payment provider;
- no backend changes;
- no package changes;
- only source document, index update, report.

---

## What can be done early

Safe early tasks:

- docs;
- tariff type definitions;
- disabled UI placeholders;
- billing status placeholder;
- feature entitlement docs;
- backend architecture docs;
- manual billing design.

---

## What must wait

Must wait for separate tasks:

- real payment provider;
- real invoices;
- real subscription automation;
- real tenant suspension enforcement;
- real feature gates;
- billing dashboard;
- export/legal invoices;
- provider webhooks;
- automatic renewal.

---

## Risks

Main risks:

- mixing platform billing with clinic finance;
- deleting tenant data for non-payment;
- frontend-only access restrictions;
- feature gates only in UI;
- ordinary staff seeing sensitive billing debt;
- payment provider secrets leaked;
- webhooks not idempotent;
- duplicate invoices;
- wrong tenant suspended;
- downgrade deleting data;
- suspended tenant integrations still running;
- billing reports leaking tenant medical data.

---

## Что нельзя делать

Нельзя:

- смешивать platform billing and clinic finance;
- считать patient payment SaaS subscription payment;
- считать paid treatment plan paid platform invoice;
- удалять tenant data за неоплату;
- hard delete tenant without procedure;
- отключать tenant only in frontend;
- делать feature gates only in UI;
- показывать billing debt всем сотрудникам;
- делать payment provider без security task;
- хранить payment provider secrets во frontend;
- логировать payment secrets;
- делать duplicate invoices on retry;
- включать features без backend entitlement check;
- удалять data on downgrade;
- смешивать tenant subscription invoice with patient invoice;
- делать billing actions without audit;
- делать access changes without permission.

---

## Правила для ИИ-задач

Если задача касается billing, subscription, tariff, access control, feature entitlement, limits, payment provider, tenant suspension or invoices, ИИ должен проверить:

- platform billing not mixed with clinic finance;
- tenant impact указан;
- storage impact указан;
- sensitive data impact указан;
- backend enforcement considered;
- feature gate not UI-only;
- no data deletion on non-payment;
- no secrets in frontend/Git/logs;
- payment provider not added casually;
- access status and subscription status separated;
- audit impact described;
- report created.

---

## Acceptance для billing/access задач

Billing/access задача считается корректной, если:

- subscription model separated from clinic finance;
- accessStatus considered;
- feature entitlement considered;
- limits considered if relevant;
- tenant suspension does not delete data;
- clinic_owner and ordinary staff visibility separated;
- backend enforcement described or implemented;
- payment provider impact explicit;
- audit events described;
- report includes safety notes;
- what was not implemented clearly stated.

---

## Итог

Billing and access control — это коммерческий фундамент DentalFlow как SaaS.

Главная цепочка:

```text
Tenant
→ Subscription
→ TariffPlan
→ Feature Entitlements
→ Limits
→ Access Status
→ Backend Enforcement
→ Audit
```

Главное разделение:

```text
Platform billing:
клиника платит DentalFlow

Clinic finance:
пациент платит клинике
```

Главная access-мысль:

```text
неоплата ограничивает доступ,
но не удаляет данные
```

Главная technical-мысль:

```text
feature gates and suspension must be enforced by backend
```

Если эти границы сохранить, DentalFlow сможет работать как SaaS-продукт: подключать клиники, продавать тарифы, ограничивать доступ и не превращать финансы в кашу.

Если смешать platform billing, clinic finance, patient payments, tenant access and feature limits, получится система, где никто не понимает, кто кому заплатил и почему у врача исчез amoCRM после оплаты пациентом пломбы. А это уже не SaaS, а бухгалтерская комедия с медицинскими последствиями.
