# Правила работы со Storage (Storage Rules)

Система не имеет реального бэкенда. Все данные хранятся локально на клиенте в `localStorage`. Взаимодействие происходит исключительно через обертку `src/utils/storage.ts`.

## Ключи localStorage
- `df_initialized` — Флаг первичной загрузки демо-данных.
- `df_doctors` — Врачи (`Doctor[]`).
- `df_patients` — Пациенты (`Patient[]`).
- `df_appointments` — Записи в расписании (`Appointment[]`).
- `df_dental_charts` — Зубные карты (`Record<string, DentalChart>`).
- `df_treatment_plans` — Планы лечения (`TreatmentPlan[]`).
- `df_chief_complaints` — Основные жалобы (`ChiefComplaint[]`).
- `df_dental_findings` — Проблемы и риски (`DentalFinding[]`).

## Зависимости
Все страницы и компоненты, работающие с данными, импортируют методы из `storage.ts` (например, `storage.getPatients()`).
Связанные типы определены в `src/types/index.ts`.

## Строгие правила для ИИ:
1. **Не менять структуру данных:** Запрещено менять существующие интерфейсы типов в `types/index.ts` и ключи в `storage.ts` без создания миграции или получения явного решения от пользователя.
2. **Не удалять данные:** Нельзя стирать существующие данные пользователей (пациентов, врачей) без прямого задания на это.
3. **Порядок добавления сущностей:** Если задача требует добавить новую сущность, ИИ обязан выполнить 5 шагов:
   - Добавить интерфейс в `src/types/index.ts`.
   - Добавить новый ключ `df_<entity>` в `STORAGE_KEYS`.
   - Написать полный набор CRUD функций (get, save, add, update, delete) в `storage.ts`.
   - Обновить файл `_ai_work/PROJECT_ROUTES.md`.
   - Обновить данный документ `_ai_work/STORAGE_RULES.md`.