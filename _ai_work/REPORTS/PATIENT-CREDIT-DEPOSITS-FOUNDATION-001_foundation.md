# PATIENT-CREDIT-DEPOSITS-FOUNDATION-001

## Verdict

**PASS — локальный foundation депозитов пациента реализован и проверен.**

## Scope

Реализована серверная основа резервирования уже полученных денег пациента без второго денежного реестра. Источником денег остаётся `payments`; депозит хранит только блокировку свободной ёмкости конкретного платежа.

Формула доступной ёмкости учитывает:

- активные распределения платежа;
- завершённые возвраты;
- pending/approved возвраты;
- оставшийся активный резерв депозита.

## Implemented

- Таблица `patient_fund_reservations` с tenant/patient/payment/currency scope, purpose, lifecycle, идемпотентностью и архивным состоянием.
- RPC чтения capacity и резервов пациента.
- RPC создания резерва, освобождения резерва и распределения зарезервированного кредита на счёт.
- Единый порядок блокировок payment → refund rows → reservation rows.
- Generic allocation, refund и payment void учитывают активные резервы.
- Reservation-backed allocation атомарно уменьшает резерв и создаёт allocation.
- Одноразовая внутренняя авторизация mutations хранится в закрытой схеме и не подделывается одним GUC.
- Финансовая идентичность reservation/allocation/refund (`tenant_id`, `patient_id`, `payment_id`, `currency` и исходные суммы/ключи) защищена от прямого переноса или изменения.
- Обновлён patient finance summary: gross unallocated, reserved deposit и available credit выводятся отдельно по валютам.
- Добавлены типизированные Repository/RPC client модели и безопасная нормализация ошибок.
- В существующих финансовых карточках добавлено пояснение, что свободный кредит уже уменьшен на резервы.

## Permissions

- `clinic_owner`, `clinic_admin`, `cashier`: создание и controlled consume резерва.
- `clinic_owner`, `clinic_admin`: release резерва.
- `doctor`, `registrar`, пользователь без tenant и пользователь другого tenant: mutation запрещена.
- `anon`: execute новых mutation RPC не предоставлен.
- Прямые записи authenticated запрещены RLS/grants; поддельные service-role mutation contexts проверены отрицательными SQL-тестами.

## Verification

### Clean database application

- Выполнен `supabase db reset --no-seed` после последних изменений миграции.
- Все миграции `0001`–`0022` применились с нуля.
- `0022_patient_credit_deposits_foundation_test.sql` прошёл полностью.

SQL-набор проверяет capacity, tenant/patient/currency isolation, роли, idempotency, audit/activity events, release/consume/archive, generic allocation/refund/void guards, forged service-role contexts и отсутствие побочных изменений в клинических данных и `patients.balance`.

### Concurrency

`0022_patient_credit_deposits_concurrency.ps1` прошёл полностью:

- reservation ↔ reservation;
- reservation ↔ request refund;
- reservation ↔ allocation;
- release ↔ allocation;
- consume ↔ consume;
- одинаковые и конфликтующие idempotency keys;
- reservation ↔ approve refund;
- reservation ↔ complete refund;
- reservation ↔ reject refund;
- reservation ↔ void refund.

Результат: deadlock не обнаружен, отрицательная ёмкость не возникла, один и тот же остаток не был использован дважды.

### TypeScript quality gates

- ESLint: PASS.
- Vitest: **73 files, 767 tests passed**.
- TypeScript/Vite production build: PASS.

Существующие React `act(...)` warnings и предупреждение Vite о размере bundle не связаны с этой задачей и не приводят к падению проверок.

### Browser smoke

На локальном Supabase Auth проверены сценарии A–F:

- 1000 received → reserve 300 → available 700;
- generic allocation сверх available блокируется, allocation 700 разрешён;
- refund сверх available блокируется, refund 700 разрешён;
- release возвращает available credit;
- partial consume корректно меняет remaining/status;
- full consume даёт `fully_used`, reserved = 0.

Ролевая матрица в изолированных браузерных контекстах:

- owner/admin/cashier: разрешённые операции проходят;
- doctor/registrar/другой tenant: безопасный отказ;
- no-tenant: доступ к smoke-странице отсутствует.

Ожидаемые HTTP 400 возникали только на намеренно запрещённых операциях; пользовательские assertions прошли, SQL/секреты в UI не раскрывались.

## Security review history

В ходе независимых read-only reviews были найдены и исправлены:

1. подделываемая GUC-only авторизация privileged writes;
2. противоположный порядок refund/payment locks, создававший deadlock;
3. возможность прямого изменения tenant/patient/currency у allocation/refund;
4. недостаточное покрытие forged service-role и refund-transition races.

После исправлений выполнены чистый reset, полный SQL-набор, concurrency suite и TypeScript quality gates.

Финальный дополнительный запуск внешнего Codex review не состоялся, поскольку исполняемый файл Codex отсутствовал в текущей desktop-сессии. Это не заменено выдуманным verdict: финальная проверка выполнена воспроизводимыми локальными тестами и статическими guard-проверками.

## Boundaries

- Cloud Supabase не изменялся.
- Полноценный UI управления депозитами не создавался.
- Expiry automation, forfeiture и correction/void flow для reservation-backed allocations не входят в foundation.
- `patients.balance`, клинические факты, документы и склад не используются как источник или побочный объект депозитных операций.

## Pull Request

- PR: https://github.com/NckNA/codex-test/pull/340
- Implementation commit: `1d72c2f8cc5da1abfb342c34f5bf19220f0eafd0`
- CI run: `29132986607` / run #677
- CI result on implementation commit: **success**
- PR state: open; слияние не выполнялось.

После этого отчёт обновляется отдельным report-only коммитом; итоговый HEAD дополнительно проверяется свежим PR CI.

## Recommended next task

`PATIENT-CREDIT-DEPOSITS-UI-001` — создать пользовательский интерфейс просмотра, создания, освобождения и controlled consume депозитов поверх готовых scoped RPC.