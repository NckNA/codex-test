# 13_STORAGE_AND_MIGRATION_STRATEGY.md

## Назначение документа

Этот документ описывает стратегию хранения данных и миграций в DentalFlow CRM.

DentalFlow создаётся как SaaS CRM-платформа для стоматологических клиник, поэтому хранение данных не может навсегда оставаться на уровне `localStorage`, случайных JSON-объектов и надежды, что браузер пользователя сегодня проснулся в хорошем настроении.

Главное правило:

**production source of truth для DentalFlow должен быть backend/database, а не localStorage.**

Второе главное правило:

**миграция данных — это контролируемый процесс, а не `localStorage.clear()` с видом “мы всё исправили”.**

`localStorage.clear()` — это не миграция. Это маленький цифровой пожар, после которого данные исчезли, а разработчик почему-то говорит “зато теперь чисто”.

---

## Главная цель storage strategy

Storage strategy должна обеспечить:

- сохранность данных;
- tenant isolation;
- medical data safety;
- financial data safety;
- documents snapshot;
- auditability;
- migrations;
- backups;
- restore;
- controlled imports;
- controlled exports;
- safe integration storage;
- transition from prototype to production;
- predictable schema evolution.

Без нормальной storage strategy DentalFlow нельзя безопасно продавать другим клиникам.

---

## Current prototype storage

На раннем этапе проект может использовать `localStorage`.

Это допустимо как prototype.

`localStorage` может использоваться для:

- демо-данных;
- быстрого UI-прототипа;
- проверки product flow;
- временного хранения пациентов;
- временного хранения планов лечения;
- временного хранения зубной карты;
- тестового состояния UI.

Но `localStorage` не должен считаться production-хранилищем.

---

## localStorage limitations

`localStorage` не подходит для production SaaS.

Ограничения:

- нет настоящей tenant isolation;
- нет backend permission checks;
- нет multi-user concurrency;
- нет audit logs;
- нет reliable backup;
- нет server-side validation;
- нет transactions;
- нет secure secret storage;
- нет нормальных migrations;
- пользователь может изменить данные вручную;
- браузер может очистить данные;
- разные устройства не синхронизируются;
- нельзя безопасно продавать как SaaS.

`localStorage` — это удобный костыль. Костыль полезен, пока ты лечишь ногу. Но строить на нём клинику странновато.

---

## Production source of truth

Production source of truth:

```text
DentalFlow backend/database
```

Не source of truth:

```text
localStorage
sessionStorage
browser cache
PDF export
amoCRM
WhatsApp
Excel
screenshots
frontend state
```

External systems могут иметь свои данные.

Но DentalFlow medical, administrative, billing and tenant data должны храниться в backend/database.

---

## Database как будущая основа

Production DentalFlow должна перейти на database-backed storage.

База должна поддерживать:

- tenantId;
- transactions;
- indexes;
- constraints;
- migrations;
- backups;
- restore;
- audit logs;
- soft delete;
- role-aware access через backend;
- reporting;
- integration mappings;
- encrypted/protected secrets where needed.

Финальный выбор database — отдельная задача.

Для SaaS логично рассматривать SQL-подход, например PostgreSQL, но этот документ не утверждает конкретный движок как уже выбранный.

---

## Storage domains

Данные DentalFlow нужно разделять по доменам.

Основные storage domains:

```text
Platform storage
Tenant storage
User and permission storage
Patient storage
Medical storage
Schedule storage
Treatment plan storage
Document storage
Finance storage
Warehouse storage
Integration storage
Billing storage
Audit storage
File storage
Report/export storage
```

Домены связаны, но не должны быть смешаны в одну неуправляемую JSON-кучу.

---

## Platform storage

Platform storage содержит данные SaaS-платформы.

Примеры:

- tenants;
- platform users;
- platform roles;
- tariff plans;
- subscriptions;
- platform invoices;
- access status;
- feature entitlements;
- platform audit;
- system settings.

Platform storage не должен смешиваться с clinic finance.

---

## Tenant storage

Tenant storage содержит данные конкретной клиники.

Примеры:

- clinic settings;
- clinic users;
- doctors;
- cabinets;
- working hours;
- patients;
- appointments;
- treatment plans;
- documents;
- payments;
- integrations;
- reports;
- files.

Tenant-owned данные должны иметь tenantId.

---

## User and permission storage

User and permission storage должен поддерживать:

```text
User
TenantUser
Role
Permission
RolePermission
UserRole
SupportAccess
```

Пользователь может иметь разные роли в разных tenant.

Нельзя делать роль пользователя глобальной без tenant context.

Плохой вариант:

```text
user.role = "clinic_owner"
```

Правильный вариант:

```text
user has role "clinic_owner" in tenant A
user has no access to tenant B
```

---

## Patient storage

Patient storage содержит:

```text
Patient
PatientContact
PatientComment
PatientIntegrationMetadata
PatientStatus
```

Patient должен быть tenant-scoped.

Минимально:

```text
id
tenantId
fullName
phone
source
leadStatus
createdAt
updatedAt
```

Medical details не должны быть бесконтрольно смешаны с commercial metadata.

---

## Medical storage

Medical storage содержит:

```text
DentalChart
ToothState
DentalFinding
ClinicalNote
ChiefComplaint
MedicalHistory
Allergy
Contraindication
CompletedService
```

Medical data sensitive.

Medical storage должен быть:

- tenant-scoped;
- patient-scoped;
- permission-protected;
- audit-aware;
- not sent to amoCRM;
- not stored only in browser for production.

---

## Schedule storage

Schedule storage содержит:

```text
Appointment
DoctorSchedule
Cabinet
WorkingHours
ScheduleBlock
Reminder
NoShow
RescheduleEvent
CancellationReason
```

Appointment не равен CompletedService.

Schedule storage не должен менять medical facts автоматически.

---

## Treatment plan storage

Treatment plan storage содержит:

```text
TreatmentPlan
TreatmentStage
TreatmentPlanFindingLink
TreatmentPlanApproval
TreatmentPlanVersion
```

TreatmentPlan — это proposal/intent.

Не completed service.

Не payment.

Не document.

---

## Document storage

Document storage содержит:

```text
MedicalDocument
DocumentSnapshot
DocumentTemplate
DocumentTemplateVersion
DocumentFile
DocumentAudit
```

Главное правило:

```text
saved document = snapshot
```

Старый документ не должен изменяться после изменения плана, цены, пациента, шаблона или врача.

---

## Finance storage

Clinic finance storage содержит:

```text
PatientPayment
Refund
Debt
ClinicInvoice
CashierShift
FinanceReport
```

Это финансы клиники.

Не platform billing.

Payment пациента не активирует subscription DentalFlow.

---

## Platform billing storage

Platform billing storage содержит:

```text
Subscription
TariffPlan
FeatureEntitlement
PlatformInvoice
PlatformPayment
TenantAccessStatus
BillingContact
```

Это SaaS billing.

Не patient payment.

---

## Integration storage

Integration storage содержит:

```text
IntegrationConnection
AmoCrmConnection
AmoCrmToken
AmoCrmFieldMapping
ExternalEntityMapping
IntegrationSyncLog
WebhookEvent
IntegrationJob
```

Integration storage должен быть tenant-scoped.

Tokens должны храниться server-side and protected.

---

## Audit storage

Audit storage содержит важные действия.

Примеры:

```text
AuditLog
SecurityEvent
AccessChangeLog
BillingAuditLog
MedicalAuditLog
IntegrationAuditLog
```

Audit logs должны быть tenant-aware.

Audit logs не должны содержать secrets.

---

## File storage

File storage состоит из:

```text
File metadata in database
Binary object in file storage
```

File metadata:

```text
id
tenantId
patientId
documentId
storageKey
fileType
fileSize
createdAt
createdBy
```

Файл без tenantId — будущая дырка.

---

## Report/export storage

Exports and reports могут содержать sensitive data.

Export storage должен учитывать:

- tenantId;
- createdBy;
- createdAt;
- file link;
- expiration;
- permission;
- audit;
- sensitive fields;
- download logs.

Export всей базы пациентов — не игрушка для receptionist.

---

## TenantId правило

Все tenant-owned сущности должны иметь tenantId.

Примеры:

```text
patients.tenantId
appointments.tenantId
dental_charts.tenantId
findings.tenantId
treatment_plans.tenantId
documents.tenantId
payments.tenantId
integration_connections.tenantId
sync_logs.tenantId
audit_logs.tenantId
files.tenantId
```

Если entity принадлежит tenant, tenantId обязателен.

---

## Platform-level entities

Не все сущности имеют tenantId.

Platform-level entities:

```text
PlatformUser
TariffPlan
GlobalFeatureDefinition
SystemSetting
PlatformAudit
```

Но если platform entity относится к tenant, связь должна быть явной.

Пример:

```text
Subscription.tenantId
PlatformInvoice.tenantId
```

---

## Cross-tenant references запрещены

Нельзя допускать cross-tenant references.

Плохой сценарий:

```text
Appointment.tenantId = Tenant A
Appointment.patientId → Patient from Tenant B
```

Правильное правило:

```text
Appointment.tenantId must equal Patient.tenantId
```

То же относится к:

- treatment plan → patient;
- finding → patient;
- document → treatment plan;
- payment → patient;
- file → document;
- sync log → connection;
- appointment → doctor;
- appointment → cabinet.

---

## Foreign keys and tenant safety

Foreign keys помогают, но не всегда достаточно.

Нужно учитывать tenant consistency.

В SQL может потребоваться:

- composite keys;
- tenantId constraints;
- application-level checks;
- repository filters;
- tests.

Backend должен проверять entity ownership.

Database должна помогать не сохранять мусор.

---

## Index strategy

Production database должна иметь индексы.

Примеры:

```text
tenantId
tenantId + createdAt
tenantId + status
tenantId + patientId
tenantId + phone
tenantId + externalEntityId
tenantId + appointmentDate
tenantId + doctorId
tenantId + documentStatus
```

Без индексов SaaS сначала работает быстро, а потом внезапно начинает философски смотреть на пользователя загрузочным экраном.

---

## Unique constraints

Unique constraints должны учитывать tenant.

Примеры:

```text
tenantId + patientNumber
tenantId + externalContactId
tenantId + doctorCode
tenantId + documentNumber
tenantId + invoiceNumber
```

Не делать external IDs globally unique без tenant context.

---

## Entity IDs

В production лучше иметь stable IDs.

Возможные подходы:

- UUID;
- cuid;
- database-generated ID;
- domain-specific number for display.

Internal ID и display number не всегда одно и то же.

Пример:

```text
id = UUID
patientNumber = human-readable number inside tenant
```

---

## Display numbers

Некоторые сущности могут иметь display numbers.

Примеры:

```text
patientNumber
documentNumber
invoiceNumber
appointmentNumber
```

Display number должен быть tenant-scoped.

Не использовать global patient number для всех клиник, если это не platform requirement.

---

## Timestamps

Основные timestamps:

```text
createdAt
updatedAt
deletedAt
archivedAt
cancelledAt
```

Хранить лучше в UTC.

Отображать по tenant timezone.

---

## Timezone

Tenant должен иметь timezone.

Пример:

```text
Asia/Almaty
```

Для schedule, documents, invoices and reports timezone критичен.

Не хранить local date/time как случайную строку без стратегии.

---

## Soft delete

Для важных данных использовать soft delete/archive.

Примеры:

```text
deletedAt
deletedBy
deleteReason
archivedAt
archivedBy
archiveReason
```

Особенно:

- patients;
- appointments;
- dental findings;
- treatment plans;
- documents;
- payments;
- tenants;
- users.

Hard delete должен быть отдельной процедурой.

---

## Hard delete

Hard delete опасен.

Hard delete может быть допустим:

- для ошибочно созданных demo данных;
- по legal retention policy;
- по explicit owner/platform process;
- после export/backup procedure;
- для non-sensitive temporary data.

Hard delete нельзя делать случайно внутри обычной feature-задачи.

---

## Archive

Archive — безопаснее, чем delete.

Archive сохраняет историю.

Примеры:

```text
patient archived
treatment plan archived
document archived
tenant archived
```

Archived data может быть скрыта из обычных списков, но оставаться доступной по permission.

---

## Document snapshot storage

Saved documents должны храниться как snapshot.

Snapshot должен включать данные на момент создания.

Пример:

```text
patientSnapshot
clinicSnapshot
doctorSnapshot
treatmentPlanSnapshot
amountSnapshot
templateVersion
createdAt
createdBy
```

Snapshot не должен быть live reference, который меняется после update плана.

---

## Snapshot не переписывается

Запрещено:

```text
update old document snapshot silently
```

Если документ нужно изменить:

- создать новый документ;
- отменить старый;
- сохранить reason;
- audit event.

Это юридически важная часть системы.

---

## Template version storage

DocumentTemplate должен иметь version.

```text
templateId
version
content
isActive
createdAt
```

Generated document stores:

```text
templateId
templateVersion
snapshot
```

Если template изменился, старый document не меняется.

---

## Migration concept

Migration — контролируемое изменение структуры данных.

Migration может быть:

- schema migration;
- data migration;
- localStorage migration;
- API DTO migration;
- document template migration;
- integration mapping migration;
- billing plan migration.

Migration должна быть описана, проверена и безопасно применена.

---

## Что не является миграцией

Не является нормальной миграцией:

```text
localStorage.clear()
delete all old data
rename fields and hope
manual edit in production database without record
silent data shape change
frontend fallback that hides broken records
```

Так можно делать только в одноразовом прототипе, и даже там лучше не привыкать.

---

## Migration principles

Правила миграций:

- define old shape;
- define new shape;
- define mapping;
- preserve data where possible;
- validate result;
- log/report migration;
- rollback plan if possible;
- test on sample data;
- describe tenant impact;
- describe sensitive data impact;
- do not silently drop fields.

---

## Schema migration

Schema migration меняет database schema.

Примеры:

- add column;
- create table;
- add index;
- add foreign key;
- change enum;
- add constraint;
- split table;
- rename field.

Schema migration должна быть versioned.

---

## Data migration

Data migration меняет сами данные.

Примеры:

```text
source string → source enum
single comment field → adminNote + medicalNote
treatmentPlan.total → amount + currency
patient.integration → integrationMetadata
```

Data migration должна быть осторожной.

Нельзя потерять medical or financial data.

---

## localStorage migration

На этапе прототипа localStorage shape может меняться.

localStorage migration должна:

- читать old version;
- преобразовывать в new version;
- сохранять backup where possible;
- валидировать результат;
- не удалять данные без warning;
- иметь fallback.

Минимально нужно хранить storage schema version.

---

## Storage version

Для localStorage prototype можно использовать:

```text
storageVersion
```

Пример:

```text
DentalFlowStorageVersion = 3
```

При загрузке:

```text
if version < current
→ run migrations
```

Не нужно каждый раз ломать старые данные.

---

## Local backup before migration

Перед localStorage migration можно сохранить backup key.

Пример:

```text
dentalflow_backup_before_v3_migration
```

Это не production backup.

Но лучше, чем потерять всё и сказать “браузер виноват”.

---

## Migration report

Каждая важная migration должна иметь report.

Report включает:

- migration id;
- old shape;
- new shape;
- affected entities;
- tenant impact;
- sensitive data impact;
- fields preserved;
- fields dropped;
- validation result;
- rollback notes;
- risks.

---

## Destructive migration

Destructive migration удаляет данные или поля.

Она требует особой осторожности.

Правила:

- explicit approval;
- backup;
- reason;
- affected data list;
- rollback plan if possible;
- audit/report;
- no hidden destructive changes in unrelated PR.

Пример destructive:

```text
remove field medicalNotes
drop table documents
delete old localStorage key
```

---

## Non-destructive migration

Предпочтительно делать non-destructive migrations.

Примеры:

- add nullable field;
- copy old field to new field;
- keep old field during transition;
- add new table;
- backfill data;
- switch readers later;
- remove old field in separate future task.

Так скучнее. Зато данные живы. Невероятное достижение.

---

## Expand-contract migration

Для production использовать expand-contract pattern.

Шаги:

```text
1. Expand schema: add new fields/tables
2. Write both old and new if needed
3. Backfill old data into new structure
4. Switch reads to new structure
5. Stop writing old structure
6. Remove old structure later
```

Не делать всё одним рискованным PR.

---

## Backward compatibility

Во время миграции нужно учитывать backward compatibility.

Frontend and backend may temporarily support:

- old field;
- new field;
- missing field;
- default value.

Но compatibility не должна скрывать сломанную migration бесконечно.

---

## Default values

Default values должны быть safe.

Пример:

```text
source = "manual"
leadStatus = "new_lead"
currency = "KZT"
syncStatus = "not_connected"
```

Но default не должен подменять реальные данные.

Если поле unknown, иногда лучше:

```text
unknown
```

чем выдумать значение.

---

## Unknown state

Unknown state лучше, чем ложь.

Пример:

```text
toothState = "unknown"
```

лучше, чем:

```text
toothState = "healthy"
```

если данных нет.

Нельзя превращать отсутствие данных в медицинский факт.

---

## Medical data migration

Medical data migration high-risk.

Особенно:

- dental chart;
- findings;
- riskDescription;
- clinical notes;
- treatment plans;
- documents;
- completed services.

Правила:

- no silent deletion;
- preserve history;
- keep audit where possible;
- validate toothNumber;
- validate patient/tenant links;
- do not convert findings to diagnosis automatically;
- do not change medical status from payment/schedule.

---

## Financial data migration

Finance data migration high-risk.

Особенно:

- payments;
- refunds;
- debts;
- invoices;
- balances;
- cashier records.

Правила:

- amount + currency explicit;
- no double counting;
- no silent status change;
- preserve payment timestamps;
- separate clinic finance from platform billing.

---

## Billing data migration

Platform billing migration high-risk.

Особенно:

- subscription status;
- invoices;
- tenant access;
- feature entitlements;
- limits;
- platform payments.

Правила:

- do not suspend wrong tenant;
- do not activate unpaid tenant accidentally;
- audit access changes;
- preserve invoice snapshots.

---

## Integration data migration

Integration migration high-risk.

Особенно:

- tokens;
- external IDs;
- field mapping;
- sync logs;
- webhook settings;
- connection status.

Правила:

- do not expose tokens;
- do not log secrets;
- preserve tenant mapping;
- do not mix tokens between tenants;
- do not send medical data during migration;
- mark connections needs_reconnect if unsafe.

---

## Token migration

Token migration must be security-reviewed.

If moving token storage:

```text
memory → database
plaintext → encrypted/protected
old provider format → new provider format
```

Need:

- secure process;
- no logging;
- no frontend exposure;
- tenant mapping validation;
- rotation if leaked;
- audit/report.

---

## File migration

File migration may include:

- moving from local/demo files to object storage;
- changing storageKey;
- adding metadata;
- generating thumbnails;
- connecting files to documents.

Rules:

- preserve tenantId;
- preserve patient/document links;
- no public exposure;
- validate file existence;
- report missing files;
- no silent data loss.

---

## Document migration

Document migration must preserve snapshots.

Do not regenerate old documents from current templates and call it migration.

Correct:

```text
old document snapshot remains unchanged
new metadata may be added around it
```

If snapshot is missing, mark as legacy/incomplete.

Do not invent historical document data.

---

## Import strategy

Import must be controlled.

Import can be used for:

- patients;
- appointments;
- services;
- finance records;
- documents;
- external mappings.

Every import requires:

- tenant scope;
- validation;
- duplicate detection;
- mapping;
- preview/report;
- rollback plan if possible;
- audit.

---

## Export strategy

Export must be controlled.

Export may include:

- patients;
- appointments;
- treatment plans;
- documents;
- payments;
- audit data;
- billing data.

Export requires:

- permission;
- tenant scope;
- sensitive field filtering;
- file security;
- expiration;
- audit.

Export is not just “download JSON”.

---

## Backup strategy

Production needs backup strategy.

Backups must cover:

- database;
- files;
- documents;
- integration metadata;
- billing data;
- audit logs.

Backups must be:

- protected;
- access-controlled;
- encrypted or secured;
- tested for restore;
- retained by policy.

---

## Backup access

Backup access must be limited.

Backups can contain data of all tenants.

Access should be platform-level and audited.

Never copy production backup to dev without anonymization.

---

## Restore strategy

Restore must be controlled.

Restore risks:

- overwrite current data;
- restore wrong tenant;
- break tenant isolation;
- restore old secrets;
- lose new records;
- duplicate invoices;
- corrupt documents.

Restore requires procedure and testing.

---

## Tenant-level restore

Tenant-level restore is complex.

Need to restore:

- tenant data;
- patients;
- appointments;
- documents;
- files;
- payments;
- audit links;
- integration mappings.

Do not promise tenant-level restore before architecture supports it.

---

## Full restore

Full restore affects all tenants.

Must be rare and controlled.

Needs:

- downtime plan;
- backup validation;
- restore test;
- communication;
- audit;
- rollback if possible.

---

## Development data

Development environment should use fake data.

Allowed:

- fake patients;
- fake phone numbers;
- fake clinic;
- fake documents;
- fake amoCRM account;
- fake payments.

Do not use real production medical data casually.

---

## Anonymization

If real data must be used for testing, anonymize.

Remove or replace:

- fullName;
- phone;
- email;
- IIN;
- address;
- documents;
- medical notes;
- clinical notes;
- file attachments;
- payment identifiers;
- integration external IDs if sensitive.

Anonymization must be reliable, not “I changed two names, good enough”.

---

## Seed data

Seed data can help development.

Seed data should be:

- fake;
- clearly marked;
- tenant-scoped;
- safe;
- resettable;
- not mixed with production data.

Seed data should not include real patients.

---

## Demo tenant data

Demo tenant can contain realistic but fake scenarios.

Examples:

- fake patients;
- fake appointments;
- fake findings;
- fake plans;
- fake payments;
- fake documents.

Demo data must not be confused with production tenant data.

---

## Environment separation

Environments:

```text
development
staging
production
```

Each environment should have separate:

- database;
- secrets;
- storage;
- amoCRM app credentials;
- payment provider credentials;
- file storage;
- logs.

Never point local dev at production database casually. Это не смелость, это просьба к судьбе ударить по лицу.

---

## Staging

Staging should be close to production.

But staging should not contain raw production medical data unless anonymized and permitted.

Staging is for:

- migration testing;
- release testing;
- integration testing;
- performance checks.

---

## Production

Production contains real tenant data.

Rules:

- migrations reviewed;
- backups ready;
- secrets protected;
- logs safe;
- monitoring;
- access controlled;
- no debug dumps;
- no test scripts against production data without approval.

---

## Schema documentation

Database schema should be documented.

Documentation should include:

- entity name;
- fields;
- tenantId;
- relationships;
- indexes;
- constraints;
- sensitive fields;
- audit requirements.

Do not let schema exist only inside code.

---

## ERD future

Future architecture may need ERD.

Entities:

- Tenant;
- User;
- TenantUser;
- Patient;
- Appointment;
- DentalChart;
- DentalFinding;
- TreatmentPlan;
- MedicalDocument;
- Payment;
- Subscription;
- IntegrationConnection;
- AuditLog.

ERD can be separate document or generated from schema later.

---

## Repository pattern and storage

Backend repositories should centralize database access.

Benefits:

- tenant filtering;
- consistent queries;
- testability;
- no raw database access from routes;
- easier migrations.

Do not scatter direct queries everywhere.

---

## Tenant filters in repositories

Repository methods should include tenant context.

Example:

```text
findPatientById(tenantId, patientId)
```

Not:

```text
findPatientById(patientId)
```

For clinic-level operations, tenantId should be explicit.

---

## Safe reads

Safe read:

```text
SELECT * FROM patients WHERE tenant_id = ? AND id = ?
```

Unsafe read:

```text
SELECT * FROM patients WHERE id = ?
```

Unsafe read can leak cross-tenant data.

---

## Safe writes

Safe write must verify tenant.

Example:

```text
update patient
where tenantId = currentTenantId
and patientId = requestedPatientId
```

Do not update entity by ID only.

---

## Transactions for multi-entity writes

Use transactions for operations like:

- create treatment plan with stages;
- generate document snapshot;
- create payment and ledger record;
- import batch;
- connect integration and save tokens;
- change tenant access and audit.

Partial writes create ghosts. Ghosts are fun in stories, not in databases.

---

## Optimistic locking

For sensitive concurrent edits, consider optimistic locking.

Example fields:

```text
version
updatedAt
```

Useful for:

- treatment plans;
- dental chart;
- documents;
- billing records;
- integration mappings.

Prevents silent overwrite.

---

## Concurrency

Production SaaS has multiple users.

Examples:

- two admins book same slot;
- doctor edits plan while admin opens preview;
- cashier records payment while owner views report;
- two sync jobs update same external mapping.

Backend/database must handle concurrency.

Frontend alone cannot.

---

## Conflict resolution

Conflicts should produce safe messages.

Example:

```text
Запись уже изменена другим пользователем. Обновите страницу и повторите действие.
```

Do not silently overwrite.

---

## Audit and storage

Storage changes for important entities should create audit logs.

Examples:

- patient updated;
- dental chart changed;
- finding status changed;
- treatment plan approved;
- document generated;
- payment recorded;
- tenant suspended;
- integration connected.

Audit should not store secrets.

---

## Logs and storage

Application logs are not database.

Logs can help debug but should not be source of truth.

Do not rely on logs to reconstruct business data.

Also, do not put sensitive data into logs, потому что тогда logs становятся второй небезопасной базой. Человечество, конечно, любит создавать базы случайно.

---

## Cache strategy

Cache may be used later.

Cache rules:

- tenant-aware keys;
- no secrets in cache;
- sensitive data protected;
- invalidation strategy;
- do not use stale cache across tenant switch;
- backend remains source of truth.

Frontend cache does not replace backend security.

---

## Frontend state

Frontend state is temporary.

Can store:

- selected tab;
- filters;
- expanded panels;
- draft form values;
- safe UI state.

Should not store:

- production secrets;
- refresh tokens;
- official documents as only copy;
- medical source of truth;
- billing source of truth.

---

## Browser cache and tenant switch

When tenant changes, frontend must clear tenant-scoped state.

Bad scenario:

```text
open Patient A in Tenant A
switch to Tenant B
Patient A still visible
```

This is cross-tenant leak.

---

## Storage and roles

Storage itself does not enforce UI roles.

Backend access layer must enforce:

- role;
- permission;
- tenant;
- feature;
- entity ownership.

Database can help, but application logic still needed.

---

## Row-level security

Future database may use row-level security.

This can strengthen tenant isolation.

But RLS is not a substitute for clean backend design.

If used, it must be carefully tested.

---

## Encryption

Sensitive data may need encryption/protection.

Especially:

- tokens;
- secrets;
- payment provider data;
- private keys;
- integration credentials;
- sensitive documents.

Medical data protection strategy is separate security task.

At minimum, secrets must not be plaintext-exposed.

---

## Secrets storage

Secrets storage should be server-side.

Secrets include:

- amoCRM access token;
- refresh token;
- client secret;
- payment provider secret;
- webhook secret;
- JWT/session secret;
- database credentials.

Secrets must not be stored in:

- frontend;
- localStorage;
- Git;
- Markdown reports;
- screenshots;
- raw logs.

---

## Data classification

Storage strategy should classify data.

Categories:

```text
public
internal
personal
medical
financial
billing
secret
audit
```

Access rules depend on classification.

---

## Personal data

Personal data includes:

- fullName;
- phone;
- email;
- date of birth;
- address;
- identifiers.

Tenant-scoped and permission-protected.

---

## Medical data

Medical data includes:

- dental chart;
- findings;
- diagnosis;
- riskDescription;
- clinical notes;
- allergies;
- contraindications;
- documents;
- completed service notes.

High sensitivity.

No amoCRM.

---

## Financial data

Financial data includes clinic finance:

- patient payments;
- debts;
- refunds;
- treatment plan amounts.

Separate from platform billing.

---

## Billing data

Billing data includes:

- subscription;
- SaaS invoices;
- tenant access status;
- tariff;
- platform payments.

Sensitive business data.

---

## Secret data

Secret data includes:

- tokens;
- keys;
- passwords;
- OAuth codes;
- webhook secrets.

Must be protected server-side.

---

## Audit data

Audit data can reveal sensitive activity.

Access should be restricted.

Audit logs should be immutable or tamper-resistant where possible.

---

## Data retention policy

Retention policy will define how long data is stored.

Needs policies for:

- patients;
- medical records;
- documents;
- payments;
- subscriptions;
- invoices;
- audit logs;
- integration logs;
- exports;
- backups;
- deleted tenants.

This is future legal/business work.

---

## Retention and deletion

Retention should control when hard delete is allowed.

Before hard delete:

- check legal requirements;
- check tenant contract;
- export if needed;
- backup implications;
- audit decision.

No casual deletes.

---

## Export before deletion

If tenant offboards, export may be required.

Export should be controlled:

- clinic_owner request;
- platform approval if needed;
- secure file;
- expiration;
- audit.

---

## Storage checks for PR

Storage-related PR should include checks:

- tenantId present for tenant-owned entity;
- no cross-tenant references;
- no destructive migration hidden;
- no localStorage.clear as migration;
- no secrets in storage;
- no medical data to amoCRM;
- no raw document snapshot mutation;
- report includes storage impact.

---

## Search checks

For storage/security PRs, use searches.

Examples:

```text
rg -n "localStorage.clear|sessionStorage.clear" src backend _ai_work
```

```text
rg -n "access_token|refresh_token|client_secret|clientSecret|DATABASE_URL|PRIVATE_KEY|Bearer" .
```

```text
rg -n "toothNumber|DentalFinding|dentalChart|riskDescription|diagnosis|MedicalDocument" backend/src src/integrations
```

Docs may contain these terms as rules.

Implementation files require stricter review.

---

## package changes

Storage docs task must not change package files.

Real storage implementation may require dependencies later.

If dependency added:

- explain why;
- alternatives;
- security;
- migration impact;
- package impact.

---

## CI future

Future CI should include:

- lint;
- build;
- backend tests;
- migration tests;
- tenant isolation tests;
- secret scan;
- forbidden localStorage destructive scan;
- integration medical leakage scan.

CI does not replace review.

Увы. Было бы удобно, если бы робот всё спасал, но пока люди всё равно находят способы удивить.

---

## Testing migrations

Migration tests should verify:

- old data converts;
- new data validates;
- no data loss;
- tenantId preserved;
- medical status preserved;
- payment amounts preserved;
- documents snapshots preserved;
- integration tokens not exposed;
- migration can handle missing fields.

---

## Test data for migrations

Use fake data.

Include edge cases:

- missing optional fields;
- unknown source;
- old lead status;
- patient without integration metadata;
- plan without currency;
- tooth finding with old structure;
- cancelled appointment;
- archived document.

---

## Migration rollback

Rollback strategy depends on migration.

Possible rollback:

- restore backup;
- keep old fields during transition;
- reverse mapping;
- disable new feature;
- run corrective migration.

Not every migration is easily reversible.

If not reversible, say so.

---

## Release process for migrations

For production migrations:

```text
review
backup
deploy migration
validate
deploy application
monitor
rollback if needed
```

Exact process depends on infrastructure.

But migrations should never be surprise side effects.

---

## Storage versioning for documents

Document snapshots may need version.

Example:

```text
documentSnapshotVersion = 1
```

If document format changes, old snapshots remain readable.

Do not rewrite old snapshots casually.

---

## Storage versioning for integrations

Integration mapping may need version.

Example:

```text
mappingVersion
providerVersion
dtoVersion
```

Useful when amoCRM fields change.

---

## Storage versioning for API DTO

API DTO may evolve.

Possible strategy:

- versioned DTO;
- backward-compatible fields;
- deprecation period.

Do not break frontend without coordinating.

---

## Data ownership

Data belongs to tenant, within platform terms.

DentalFlow platform stores and processes it.

Tenant data must be isolated.

Platform owner can manage access, billing and support, but should not casually access medical data without rules.

---

## Support data access

Support access to tenant data must be:

- scoped;
- temporary;
- audited;
- permission-limited;
- reason-based.

Support should not bypass storage isolation casually.

---

## Platform admin storage access

Platform admin can manage tenants and billing.

Platform admin should not automatically become invisible superuser for medical records.

Medical access policy for platform roles needs explicit design.

---

## Reports storage

Reports should not store stale sensitive snapshots unnecessarily.

If generated report file exists:

- tenantId;
- createdBy;
- createdAt;
- expiresAt;
- permissions;
- audit download.

Report cache must not leak across tenants.

---

## Analytics storage

Analytics should aggregate carefully.

Platform analytics should not expose patient medical details.

Tenant analytics should be tenant-scoped.

Anonymized/aggregated platform analytics can exist later, but rules must be defined.

---

## Warehouse storage

Warehouse storage future entities:

```text
WarehouseItem
StockMovement
Supplier
Purchase
WriteOff
MaterialUsage
```

Material usage should be linked to CompletedService, not Appointment alone.

Warehouse data tenant-scoped.

---

## Payment storage

Payment storage should avoid floating precision issues.

Prefer smallest currency unit or decimal-safe approach.

Example:

```text
amountMinor = 25000000
currency = "KZT"
```

or controlled decimal.

Final money model separate task.

---

## Amount and currency

Every money field should include currency.

Bad:

```text
amount: 250000
```

Better:

```text
amount: 250000
currency: "KZT"
```

For storage, final representation must avoid ambiguity.

---

## Status fields

Status fields should be enums.

Examples:

```text
appointment.status
finding.status
treatmentPlan.status
document.status
payment.status
subscription.status
sync.status
```

Avoid random strings.

Migration must handle old unknown statuses.

---

## Enum migration

Enum migration can break old data.

Rules:

- map old values;
- preserve unknown values safely;
- use fallback;
- report unmapped values;
- do not silently convert unknown medical status to completed.

---

## JSON fields

JSON fields can be useful but dangerous.

Use JSON for:

- flexible metadata;
- integration provider payload summary;
- template config;
- safe snapshot.

Avoid JSON as dumping ground for all domain data.

Если всё — JSON, схема становится слухом.

---

## Snapshot JSON

Document snapshot can be JSON.

But snapshot structure should be versioned.

Example:

```text
snapshotVersion
snapshotData
```

Snapshot should be immutable after generation.

---

## Integration raw payload storage

Avoid storing raw provider payloads.

If needed for debugging:

- sanitize;
- limit retention;
- restrict access;
- remove tokens;
- remove medical data;
- mark sensitive.

Default: store safe metadata, not raw payload.

---

## Webhook event storage

Webhook events may be stored for idempotency/debug.

Store:

```text
provider
tenantId
eventId
eventType
receivedAt
status
safeSummary
```

Do not store raw secret payload unless explicitly needed and protected.

---

## Idempotency storage

For webhooks and payments, store idempotency keys.

Examples:

```text
provider + externalEventId
provider + externalPaymentId
tenantId + operationId
```

Prevents duplicate processing.

---

## Background job storage

Jobs should be stored server-side.

Job fields:

```text
id
tenantId
type
status
attempts
nextRunAt
createdAt
updatedAt
safeError
```

Job payload should not contain secrets or unnecessary medical data.

---

## Temporary data storage

Temporary data:

- OAuth state;
- password reset token;
- export job;
- import preview;
- upload session.

Needs expiration.

Do not keep temporary sensitive data forever.

---

## Expiration

Temporary records should have:

```text
expiresAt
```

Cleanup job can remove expired data.

Examples:

- OAuth state: 10 minutes;
- export file: limited time;
- public link: limited time;
- reset token: limited time.

---

## Cleanup jobs

Cleanup jobs can remove:

- expired OAuth states;
- expired exports;
- old temporary uploads;
- old import previews;
- expired public tokens.

Cleanup must not remove core medical data.

---

## No silent cleanup of important data

Cleanup jobs must not delete:

- patients;
- documents;
- payments;
- findings;
- treatment plans;
- audit logs;
- tenant data;

unless retention policy explicitly allows and process is approved.

---

## Storage and UI placeholders

If storage not implemented, UI should be honest.

Example:

```text
Документы будут сохраняться после подключения backend storage.
```

Not:

```text
Документ сохранён
```

when it only exists in unsaved frontend state.

---

## Prototype labels

Prototype limitations should be explicit.

Examples:

```text
localStorage prototype only
not production storage
data may be reset in development
backend/database migration required
```

Do not hide prototype status in reports.

---

## Reports for storage tasks

Every storage/migration task report must include:

- storage impact;
- tenant impact;
- sensitive data impact;
- migration impact;
- data preservation notes;
- rollback notes;
- what was not implemented;
- risks;
- checks.

---

## What storage tasks must not hide

Do not hide:

- changed data shape;
- dropped fields;
- changed defaults;
- broken backward compatibility;
- destructive migration;
- localStorage key changes;
- loss of old data;
- new sensitive fields;
- no rollback.

If something is risky, write it.

В отчёте лучше неприятная правда, чем приятный некролог данным.

---

## MVP storage path

Safe MVP path:

```text
1. Document current localStorage shape
2. Add storage version
3. Add safe defaults
4. Add non-destructive local migrations
5. Define backend schema
6. Implement backend database
7. Create API endpoints
8. Migrate demo/local data if needed
9. Switch frontend from localStorage to API
10. Keep export/backup path
11. Remove localStorage as source of truth
```

Do not jump from step 1 to “production SaaS”.

---

## Backend migration path

Backend migration path:

```text
1. Choose database
2. Define schema
3. Add migration tool
4. Add tenant model
5. Add user/roles model
6. Add patient tables
7. Add medical tables
8. Add schedule tables
9. Add treatment/document tables
10. Add finance/billing tables
11. Add integration tables
12. Add audit tables
13. Add tests
```

One module at a time.

---

## LocalStorage to backend transition

Transition strategy:

```text
localStorage prototype
→ API-compatible data model
→ backend schema
→ API services
→ frontend reads from API
→ frontend writes to API
→ localStorage only cache/draft
→ localStorage removed as source of truth
```

During transition, avoid duplicated truth.

---

## Dual-write warning

Dual-write is risky.

Example:

```text
write to localStorage
write to backend
```

Can cause divergence.

If dual-write used temporarily:

- define source of truth;
- detect conflicts;
- log failures;
- keep period short;
- migrate off it.

---

## Source of truth during migration

At each phase define source of truth.

Examples:

```text
Phase prototype:
localStorage source of truth

Phase backend migration:
backend source of truth, localStorage cache only

Phase production:
backend/database source of truth
```

Do not leave ambiguous.

---

## Read fallback warning

Fallback reads can hide migration problems.

Example:

```text
try backend
if fails, use old localStorage
```

May show stale data.

Use carefully and temporarily.

---

## Data validation after migration

After migration validate:

- counts;
- tenantIds;
- required fields;
- statuses;
- money totals;
- document snapshots;
- external mappings;
- patient links;
- appointment links;
- no cross-tenant references.

Validation report should exist.

---

## What cannot be migrated automatically

Some data may not be safely migratable.

Examples:

- ambiguous comments;
- unknown medical status;
- old document without snapshot;
- patient duplicates;
- missing tenantId;
- corrupted localStorage.

Mark for manual review instead of guessing.

---

## Do not invent data

Migration must not invent important data.

Bad:

```text
missing diagnosis → "caries"
missing toothState → "healthy"
missing payment status → "paid"
```

Better:

```text
unknown
needs_review
legacy_missing
```

---

## Legacy data

Legacy data should be marked.

Possible fields:

```text
legacySource
migrationVersion
migrationNotes
needsReview
```

This is better than pretending old data is perfect.

---

## Legacy documents

Legacy documents without snapshot should be marked.

Example:

```text
documentStatus = legacy_imported
snapshotCompleteness = partial
```

Do not regenerate and pretend original.

---

## Tenant migration

If old data has no tenantId, migration must assign carefully.

For single-clinic prototype:

```text
create default/demo tenant
assign all local data to that tenant
```

For multi-clinic data:

- require mapping;
- do not guess;
- report unresolved records.

---

## Default tenant

For prototype migration, default tenant may be created.

Example:

```text
tenantId = demo-default-tenant
```

But production data must not all share one tenant.

Default tenant is a bridge, not final architecture.

---

## Sensitive data during migration

Migration scripts may touch sensitive data.

Rules:

- no console dumping full records;
- no logging medical notes;
- no logging tokens;
- no exporting raw data to reports;
- secure temporary files;
- delete temp files when done.

---

## Migration dry-run

Important migrations should support dry-run.

Dry-run reports:

- records to change;
- records skipped;
- errors;
- warnings;
- estimated impact.

Dry-run should not mutate data.

---

## Migration confirmation

Destructive or high-risk migration should require explicit approval.

Examples:

- hard delete;
- merge patients;
- split tenant;
- remove fields;
- change document snapshots;
- token migration.

---

## Migration ownership

Each migration should have owner.

Report should say:

```text
who requested
who executed
when
why
```

For automated migrations, CI/deploy metadata can serve.

---

## Storage and compliance note

This document is not a legal compliance document.

Medical data, personal data and billing retention may require legal review.

Architecture must keep space for compliance requirements.

Do not assume “we are small” removes data responsibility. Data does not become harmless because the company is tired.

---

## Что нельзя делать

Нельзя:

- считать localStorage production database;
- использовать localStorage.clear as migration;
- хранить production medical data only in browser;
- хранить secrets in localStorage;
- хранить tokens in frontend;
- хранить official documents only in browser cache;
- делать migration without version/report;
- silently drop old fields;
- convert unknown medical data into healthy/completed;
- change document snapshot after generation;
- use один tenant для всех production clinics;
- allow cross-tenant references;
- run destructive migration without backup/approval;
- copy production backup to dev without anonymization;
- log sensitive migration data;
- store raw provider payloads with secrets;
- treat PDF/export as source of truth;
- mix platform billing and clinic finance storage;
- hide storage limitations in reports.

---

## Правила для ИИ-задач

Если задача касается storage, localStorage, database, migrations, files, snapshots, imports, exports, backups, restore, schema, IDs or data shape, ИИ должен проверить:

- storage impact указан;
- tenant impact указан;
- sensitive data impact указан;
- source of truth defined;
- no localStorage.clear migration;
- no destructive change hidden;
- tenantId preserved;
- no cross-tenant references;
- document snapshots not mutated;
- medical data not guessed;
- money fields preserve amount/currency;
- secrets not stored/logged;
- migration report exists;
- rollback/backup considered;
- what was not implemented stated.

---

## Acceptance для storage/migration задач

Storage/migration задача считается корректной, если:

- scope ограничен;
- source of truth понятен;
- tenantId strategy учтена;
- data preservation described;
- migration path described;
- destructive changes absent or explicitly approved;
- sensitive data protected;
- no secrets exposed;
- no medical data to amoCRM;
- document snapshot rules preserved;
- localStorage limitations stated if relevant;
- backend/database future path respected;
- report created.

---

## Итог

Storage and migration strategy — фундамент перехода DentalFlow от прототипа к SaaS.

Главная storage-цепочка:

```text
Prototype localStorage
→ Versioned local data
→ Backend API
→ Production database
→ Backups
→ Migrations
→ Audit
→ Restore strategy
```

Главная production-мысль:

```text
backend/database is source of truth
```

Главная migration-мысль:

```text
миграция сохраняет данные,
а не сжигает их ради новой структуры
```

Главная SaaS-мысль:

```text
каждая tenant-owned entity должна быть tenant-scoped
```

DentalFlow может начинаться как frontend prototype.

Но продаваться другим клиникам он сможет только тогда, когда данные будут храниться безопасно, мигрироваться контролируемо, изолироваться по tenant, восстанавливаться из backup and not vanish because someone thought `localStorage.clear()` was a strategy.

Данные — это не мусор в браузере.

Данные — это продукт, ответственность и иногда причина, по которой пользователи не хотят устраивать цифровой бунт.
