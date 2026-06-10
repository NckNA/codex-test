# Отчет RECON-DENTALCHART-REAL-001: План миграции DentalChartRepository в Supabase

## 1. Summary (Резюме)
Данный отчет представляет собой анализ (reconnaissance) готовности `DentalChartRepository` и состояний зубов (tooth states) к миграции в Supabase. Анализ показал, что схема базы данных в Supabase (`dental_charts` и `tooth_states`) полностью готова и соответствует frontend-моделям. Зависимостей, блокирующих реализацию (например, от `TreatmentPlans`), не обнаружено. Зубная формула может быть мигрирована независимо от планов лечения. 

## 2. Scope (Область анализа)
Отчет охватывает:
- Инспекцию файлов репозиториев (`DentalChartRepository`, `FindingsRepository`, `TreatmentPlansRepository`).
- Инспекцию UI компонентов (`DentalChartTab`, `ClinicalWorkflowOrchestrator`).
- Анализ типов (`src/types/index.ts`).
- Проверку текущей SQL-схемы Supabase (`0001_initial_schema.sql`).
- Оценку зависимостей между планами лечения, проблемами (findings) и состояниями зубов.

## 3. Files inspected (Проинспектированные файлы)
В рамках анализа были изучены:
- `src/data/repositories/DentalChartRepository.ts`
- `src/types/index.ts`
- `src/utils/storage.ts`
- `src/components/dental/DentalChartTab.tsx`
- `src/data/hooks/useDentalChart.ts`
- `src/data/orchestrators/ClinicalWorkflowOrchestrator.ts`
- `src/data/repositories/TreatmentPlansRepository.ts`
- `supabase/migrations/0001_initial_schema.sql`

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
В `0001_initial_schema.sql` уже предусмотрены таблицы:
- **`dental_charts`**: Поля (`id`, `tenant_id`, `patient_id`, `complaints`, `diagnosis`) полностью соответствуют frontend типу `DentalChart`.
- **`tooth_states`**: Поля (`id`, `tenant_id`, `dental_chart_id`, `tooth_number`, `condition`, `surfaces`, `crown` и др.) соответствуют `ToothRecord`. Ограничение `CHECK (condition IN ...)` полностью совпадает с типом `ToothCondition`.
- **RLS/FK**: Присутствуют `tenant_id` и `patient_id` (FK на `patients`). Есть каскадное удаление.
- **Особые типы**: Массив поверхностей `surfaces text[]` совпадает с логикой frontend.
- **Вывод**: Схема Supabase **полностью совместима** и не требует модификаций.

## 7. UI dependency analysis
- **Компоненты**: `DentalChartTab` отрисовывает формулу зубов (используя `ToothGrid`) и вызывает `useDentalChart` для загрузки/сохранения. Модальное окно `ToothEditorModal` обновляет локальное состояние выбранного зуба.
- **События**: Сохранение зуба инициирует `applyToothStatusChange` в `ClinicalWorkflowOrchestrator`, который, в свою очередь, сохраняет зубную карту целиком (`saveDentalChart`). Текстовые поля сохраняются отдельно.
- **Влияние**: UI слабо связан с реализацией хранилища, полагаясь только на `useDentalChart`.

## 8. Findings dependency analysis
- **Связь**: Проблемы (findings) связаны с зубами только через целочисленный `toothNumber`. Они не используют FK на `tooth_states.id`.
- **Изоляция**: `DentalChart` и `FindingsRepository` функционируют независимо. Во время QA для Findings (FINDINGS-REAL-001B) было доказано, что `SupabaseFindingsRepository` может корректно работать параллельно с `LocalStorageDentalChartRepository`.
- **Риски**: Отсутствуют. Миграция DentalChart никак не сломает логику отображения или сохранения Findings.

## 9. TreatmentPlans dependency analysis
- **Связь с зубами**: `TreatmentStage` содержит массив номеров зубов (`teeth: number[]`), а не UUID зубов из БД.
- **Связь с Findings**: Ранее `TreatmentPlansRepository` был заблокирован из-за того, что планы лечения ожидают массив `finding_ids` (типа `uuid[]`), а проблемы хранились локально как `f1/f2`. Теперь `Findings` успешно мигрировали в Supabase и генерируют UUID.
- **Зависимость от DentalChart**: Планы лечения **не зависят** напрямую от хранилища `DentalChart`. Они опираются на `Findings` и общую логику приложения. 
- **Вывод**: `TreatmentPlans` может мигрировать в любой момент (даже до DentalChart), но логично сначала перенести зубную формулу, так как это ключевая часть карты пациента.

## 10. ID strategy
- `DentalChart.id`: Сейчас это локальная строка `chart_uuid`. В Supabase будет заменено на настоящий UUID из `gen_random_uuid()`.
- `ToothRecord.id`: На frontend отсутствует. При отправке в Supabase таблица `tooth_states` будет генерировать свои UUID. При чтении их можно мапить обратно, игнорируя UUID на клиенте (или добавив опциональное поле). Уникальность зуба определяется композитным ключом `dental_chart_id + tooth_number`.
- Важное правило: локальные ID `chart_xxx` не должны отправляться на бэкенд, при создании записи в Supabase `id` следует опускать.

## 11. Tenant/RLS/FK risk analysis
- **Tenant**: И `dental_charts`, и `tooth_states` имеют `tenant_id`. При сохранении `saveDentalChart` репозиторию потребуется передавать текущий `tenant_id`.
- **Patient**: `patient_id` используется как FK в `dental_charts`.
- **RLS**: Политики в БД ожидают строгую привязку к `tenant_id`. Если `tenant_id` отсутствует (no-tenant mode), репозиторий должен выбрасывать ошибку или откатываться в локальный режим, чтобы предотвратить крэши UI или запись в неверный tenant.
- Опасность утечки данных (cross-tenant) исключена благодаря строгим FK и RLS.

## 12. Migration strategy options

**Option A: Migrate DentalChartRepository now (Рекомендуется)**
- Создание `SupabaseDentalChartRepository`, использующего `supabase` клиент для операций с `dental_charts` и `tooth_states` внутри одной функции (в идеале транзакционно, но в REST это два последовательных запроса: upsert chart, затем bulk upsert teeth).
- **Pros**: Завершает перевод клинической части пациента на Supabase (Chart + Findings), подготавливая почву для лечения.
- **Cons**: Чуть более сложная логика сохранения (upsert 32 записей зубов).
- **Risk level**: Низкий.

**Option B: Keep DentalChart local temporarily and proceed to TreatmentPlans**
- **Pros**: Позволяет быстрее получить работающие планы лечения в облаке.
- **Cons**: Оставляет DentalChart локальным, создавая технический долг.
- **Risk level**: Низкий.

**Option C: Split into multiple smaller steps**
- Сначала согласование схемы, затем реализация. В данном случае излишне, так как схема уже 100% готова.

## 13. Recommended strategy
**READY for DENTALCHART-REAL-001A**. Рекомендуется приступить к непосредственной реализации `SupabaseDentalChartRepository` за паттерном Factory (аналогично `FindingsRepository`).

## 14. Tests required
При реализации потребуются следующие unit-тесты:
- `createDentalChartRepository`: Фабрика должна корректно возвращать Supabase-версию при `authMode === 'supabase-active'` и `localStorage`-версию в остальных случаях.
- `getDentalChart`: Проверка запроса к Supabase, включая JOIN (сборку) таблицы `dental_charts` и связанных `tooth_states` в единый объект.
- `saveDentalChart`: Проверка upsert-запросов (сохранение chart и bulk сохранение teeth).
- Проверка локального fallback.

## 15. Browser QA plan
Для будущей задачи браузерного тестирования (DENTALCHART-REAL-001B) необходимо проверить:
- Открытие карты пациента в режиме `supabase-active` (успешная генерация дефолтной пустой формулы из 32 здоровых зубов).
- Изменение статуса зуба (например, на Кариес), сохранение, перезагрузка страницы -> статус должен восстановиться из БД.
- Редактирование текстовых полей жалоб и картины, сохранение, перезагрузка -> текст сохраняется.
- Dev/local fallback: UI не падает без интернета или `.env`.
- No-tenant: UI не падает без авторизации/выбора клиники.

## 16. Blockers
**NONE FOUND**. 
Обоснование: SQL схема в Supabase полностью соответствует frontend-моделям, и зависимости от других модулей либо устранены (Findings уже в Supabase), либо однонаправлены (TreatmentPlans не блокируют DentalChart).

## 17. What was NOT changed
- Не был изменен ни один файл в директории `src/*`.
- `DentalChartRepository` не был реализован.
- `Tooth states` не были реализованы в Supabase.
- `TreatmentPlansRepository` не был затронут или реализован.
- Автоматическая генерация планов лечения не затрагивалась.
- Ни один конфигурационный или package-файл не изменялся.

## 18. Commands run
- `npm run lint`
- `npm test`
- `npm run build`

## 19. Final verdict
**READY for DENTALCHART-REAL-001A**

## 20. Recommended next task
**DENTALCHART-REAL-001A: Implement SupabaseDentalChartRepository**
Задача по реализации функционала хранения зубной формулы в Supabase с поддержкой локального хранилища в качестве fallback.
