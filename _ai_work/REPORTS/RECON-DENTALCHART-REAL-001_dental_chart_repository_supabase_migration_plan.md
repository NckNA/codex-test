# Отчет RECON-DENTALCHART-REAL-001: План миграции DentalChartRepository в Supabase

## 1. Summary (Резюме)
Данный отчет представляет собой анализ (reconnaissance) готовности `DentalChartRepository` и состояний зубов (tooth states) к миграции в Supabase. Анализ показал, что схема базы данных в Supabase (`dental_charts` и `tooth_states`) структурно совместима с frontend-моделями. Зависимостей, жестко блокирующих реализацию (например, от `TreatmentPlans`), не обнаружено. Зубная формула может быть мигрирована независимо от планов лечения, однако требуется аккуратная обработка bulk-обновлений состояний зубов.

## 2. Scope (Область анализа)
Отчет охватывает:
- Инспекцию файлов репозиториев (`DentalChartRepository`, `FindingsRepository`, `TreatmentPlansRepository`, `PatientRepository`, `ChiefComplaintRepository`, `AppointmentRepository`).
- Инспекцию UI компонентов (`DentalChartTab`, `ClinicalWorkflowOrchestrator`).
- Анализ типов (`src/types/index.ts`).
- Проверку текущей SQL-схемы Supabase (`0001_initial_schema.sql`) и файла сидирования данных (`supabase/seed.sql`).
- Инспекцию предыдущих отчетов по миграции других репозиториев для оценки общего состояния системы.
- Оценку зависимостей между планами лечения, проблемами (findings) и состояниями зубов.

## 3. Files and Reports inspected (Проинспектированные файлы и отчеты)
В рамках анализа были изучены следующие файлы и отчеты:

### Основные файлы DentalChart
- `src/data/repositories/DentalChartRepository.ts`
- `src/types/index.ts`
- `src/utils/storage.ts`
- `src/components/dental/DentalChartTab.tsx`
- `src/data/hooks/useDentalChart.ts`
- `src/data/orchestrators/ClinicalWorkflowOrchestrator.ts`
- `src/data/repositories/TreatmentPlansRepository.ts`
- `supabase/migrations/0001_initial_schema.sql`

### Обязательные дополнительные файлы (Required missing areas)
- **`src/data/repositories/FindingsRepository.ts`**: Проверена текущая реализация. Репозиторий уже мигрирован на Supabase и использует `uuid` для `id`. Не влияет негативно на миграцию DentalChart; напротив, доказывает, что паттерн фабрики работает. Вердикт: не меняет READY.
- **`src/data/repositories/PatientRepository.ts`**: Проверено, что `patient_id` теперь генерируется как UUID в Supabase-режиме. Это критично, так как `DentalChartRepository` зависит от валидного `patient_id` (UUID). Вердикт: подтверждает READY.
- **`src/data/repositories/ChiefComplaintRepository.ts`**: Проверена успешная миграция жалоб. Они привязаны к `patient_id` и независимы от `dental_charts`. Вердикт: не меняет READY. У DentalChart нет жесткой зависимости от реализации жалоб.
- **`src/data/repositories/AppointmentRepository.ts`**: Проверена реализация записей на прием. Полностью независима от зубной карты. Вердикт: не меняет READY. Влияние отсутствует.
- **`supabase/seed.sql`**: Изучены mock-данные. Записи для пациентов генерируются с валидными UUID (например, `55555555-5555-5555-5555-555555555555`). Однако, моковых данных для `dental_charts` и `tooth_states` в сиде **NOT FOUND**. Причина: изначально в MVP предполагалось, что карта генерируется пустыми зубами на лету, если ее нет. Это не блокирует миграцию, но при тестировании карта будет создаваться с нуля. Вердикт: не меняет READY.

### Обязательные предыдущие отчеты (Previous reports)
- **`RECON-FINDINGS-REAL-001`**, **`FINDINGS-REAL-001A`**, **`FINDINGS-REAL-001B`**: Проверены для подтверждения того, что Findings полностью мигрированы и стабильны. Это важно, так как UI позволяет создавать Findings из зубной формулы. Влияние на DentalChart: снимает риски интеграции. Вердикт: не меняет READY.
- **`RECON-TREATMENT-REAL-001`**: Отчет показал, что планы лечения используют массив чисел (`teeth: number[]`) и `finding_ids`, но не имеют прямых FK на `tooth_states.id`. Влияние: планы лечения не блокируют миграцию зубной формулы.
- **`PATIENT-REAL-001B`**: Подтвердил стабильность `patient_id` в Supabase.
- **`CHIEF-REAL-001B`**, **`APPOINTMENT-REAL-001B`**, **`DOCTOR-REAL-001C`**: Изучены для понимания статуса стабильности окружения. Показали, что RLS и Tenant isolation работают корректно для других таблиц. Вердикт: не меняет READY, повышает уверенность в успехе.

## 4. Current DentalChartRepository shape
- **Методы**: `getDentalChart(patientId)` и `saveDentalChart(patientId, chart)`.
- **Данные**: Читает и пишет полный объект `DentalChart`, включающий в себя массив `teeth` (все 32 зуба), а также текстовые поля `complaints` и `diagnosis`.
- **Область видимости**: Зависит от пациента (`patientId`).
- **Хранилище**: В текущий момент использует только `localStorage` (через `utils/storage.ts`).
- **Идентификаторы**: Генерирует локальные ID вида `chart_${patientId}` для самого чарта. Состояния зубов (объекты `ToothRecord`) не имеют собственных идентификаторов, опираясь исключительно на номер зуба (`toothNumber`).

## 5. Current frontend dental chart/tooth state model
- **DentalChart**: Объект, объединяющий `id`, `patientId`, текстовые диагнозы и массив `teeth`.
- **ToothRecord (Tooth)**: Содержит `toothNumber` (целое число, 11-48 по системе FDI) и визуальные свойства: `condition` (статус зуба, например `healthy`, `caries`, `missing`), `surfaces` (затронутые поверхности: `occlusal`, `mesial` и т.д.), `crown`, `root`, `gum`, `bone`, `canal`, `notes`.
- **Идентификаторы**: В frontend модели зубы не имеют UUID, идентификация происходит по `toothNumber`. 
- **Разделение сущностей**: Состояния зубов (`ToothRecord`) хранятся отдельно от диагнозов/проблем (`DentalFinding`).

## 6. Supabase schema fit
В `0001_initial_schema.sql` предусмотрены таблицы:
- **`dental_charts`**: Поля (`id`, `tenant_id`, `patient_id`, `complaints`, `diagnosis`) совпадают по типам данных с frontend-интерфейсом.
- **`tooth_states`**: Поля (`id`, `tenant_id`, `dental_chart_id`, `tooth_number`, `condition`, `surfaces` и др.) соответствуют `ToothRecord`. Ограничение `CHECK (condition IN ...)` совпадает с типом `ToothCondition`.
- **Особые типы**: Массив поверхностей `surfaces text[]` совпадает с логикой frontend.
- **Вывод**: Схема Supabase структурно совместима, видимых препятствий в DDL нет, но окончательная совместимость подтвердится только при реализации мапперов (особенно в части конвертации 32 объектов в массив/из массива).

## 7. UI dependency analysis
- **Компоненты**: `DentalChartTab` отрисовывает формулу зубов и вызывает `useDentalChart` для загрузки/сохранения. 
- **События**: Сохранение зуба инициирует `applyToothStatusChange` в `ClinicalWorkflowOrchestrator`, который сохраняет зубную карту целиком (`saveDentalChart`). Текстовые поля сохраняются отдельно.
- **Влияние**: UI слабо связан с реализацией хранилища, полагаясь только на `useDentalChart`.

## 8. Findings dependency analysis
- **Связь**: Проблемы (findings) связаны с зубами только через целочисленный `toothNumber`. Они не используют FK на `tooth_states.id`.
- **Изоляция**: `DentalChart` и `FindingsRepository` функционируют независимо. 
- **Риски**: Умеренные. Если сохранение зубов (`DentalChartRepository.saveDentalChart`) и проблем (`FindingsRepository.createFinding` внутри оркестратора) пересечется во времени, возможны частичные сбои сети, при которых зуб сохранится, а проблема — нет (или наоборот), так как они не используют общую транзакцию в REST.

## 9. TreatmentPlans dependency analysis
- **Связь с зубами**: `TreatmentStage` содержит массив номеров зубов (`teeth: number[]`), а не UUID зубов из БД.
- **Зависимость от DentalChart**: Планы лечения не зависят напрямую от хранилища `DentalChart`. Они опираются на общую бизнес-логику.
- **Вывод**: `TreatmentPlans` не блокируют DentalChart.

## 10. ID strategy
- `DentalChart.id`: В Supabase будет использоваться настоящий UUID из `gen_random_uuid()`.
- `ToothRecord.id`: На frontend отсутствует. В Supabase таблица `tooth_states` генерирует свои UUID. При чтении их можно мапить обратно, игнорируя UUID на клиенте.
- Важное правило: локальные ID `chart_xxx` не должны отправляться на бэкенд.

## 11. Tenant/RLS/FK risk analysis
- **Tenant**: И `dental_charts`, и `tooth_states` имеют `tenant_id`. При сохранении `saveDentalChart` репозиторию потребуется явно передавать текущий `tenant_id`.
- **Patient**: `patient_id` используется как FK в `dental_charts`.
- **RLS и Утечки**: Опасность утечки данных (cross-tenant) минимизируется на уровне базы данных благодаря FK и RLS. Однако требуется точное применение `tenant_id` и `patient_id` в репозитории для предотвращения RLS-ошибок (403 Forbidden) или нарушения целостности данных при записи. В случае отсутствия `tenant_id` (no-tenant mode), приложение должно откатываться в локальный режим.

## 12. Migration strategy options

**Option A: Migrate DentalChartRepository now (Рекомендуется)**
- Создание `SupabaseDentalChartRepository`, использующего `supabase` клиент. Будет выполнять upsert чарта и bulk upsert (или удаление+вставку) связанных зубов в `tooth_states`.
- **Pros**: Завершает перевод клинической карты пациента на Supabase.
- **Cons**: Необходимость управлять 32 записями `tooth_states` при каждом сохранении всей карты.
- **Risk level**: Средний (из-за отсутствия транзакций в REST API привязка "чарт + зубы" может быть прервана сетевой ошибкой).

**Option B: Keep DentalChart local temporarily and proceed to TreatmentPlans**
- **Pros**: Ускоряет переход планов лечения в облако.
- **Cons**: Создает технический долг.
- **Risk level**: Низкий.

## 13. Recommended strategy
**READY for DENTALCHART-REAL-001A**. Рекомендуется приступить к реализации `SupabaseDentalChartRepository`. База данных находится в хорошем состоянии для принятия этих данных.

## 14. Tests required
При реализации потребуются unit-тесты:
- `createDentalChartRepository`: Фабрика должна корректно возвращать Supabase-версию или fallback.
- `getDentalChart`: Проверка запроса к Supabase, включая JOIN таблицы `dental_charts` и `tooth_states`.
- `saveDentalChart`: Проверка upsert-запросов (сохранение chart и bulk сохранение teeth).
- Проверка локального fallback и no-tenant поведения.

## 15. Browser QA plan
Будущее тестирование в реальном браузере:
- Открытие карты пациента в режиме `supabase-active` (генерация пустой формулы).
- Изменение статуса зуба, сохранение, перезагрузка страницы.
- Редактирование текстовых полей, сохранение, перезагрузка.
- Dev/local fallback: UI не падает без `isSupabaseConfigured`.

## 16. Blockers
**NONE FOUND**. 
Обоснование: Осмотр схемы (таблиц `dental_charts`, `tooth_states`) и связанных репозиториев (`Findings`, `TreatmentPlans`) не выявил жестких ограничений, препятствующих созданию мапперов и сохранению данных через REST API Supabase.

## 17. What was NOT changed
- Не был изменен ни один файл в директории `src/*`.
- `DentalChartRepository` не был реализован.
- `Tooth states` не были реализованы в Supabase.
- `TreatmentPlansRepository` не был затронут или реализован.
- Автоматическая генерация планов лечения не затрагивалась.
- Ни один конфигурационный, миграционный (SQL) или package-файл не изменялся. Файл `seed.sql` только читался.

## 18. Commands run
- `npm run lint`
- `npm test`
- `npm run build`

## 19. Final verdict
**READY for DENTALCHART-REAL-001A**

## 20. Recommended next task
**DENTALCHART-REAL-001A: Implement SupabaseDentalChartRepository**
Задача по реализации функционала хранения зубной формулы в Supabase с поддержкой локального хранилища в качестве fallback.
