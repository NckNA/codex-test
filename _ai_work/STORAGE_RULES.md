# Правила работы со Storage (Storage Rules)

Приложение DentalFlow CRM не использует серверную базу данных. Все данные хранятся локально в `localStorage` через обертку `src/utils/storage.ts`.

## Существующие ключи localStorage
- `df_initialized`: Флаг, указывающий, были ли загружены демо-данные.
- `df_doctors`: Врачи.
- `df_patients`: Пациенты.
- `df_appointments`: Записи на прием.
- `df_dental_charts`: Зубные карты (FDI и состояния зубов).
- `df_treatment_plans`: Планы лечения.
- `df_chief_complaints`: Основная жалоба (по каждому пациенту).
- `df_dental_findings`: Проблемы и риски (находки врача при осмотре).

## Сущности (Entities)
Все типы связаны со `storage.ts` и импортируются из `src/types/index.ts`. Основные хранимые массивы:
- `patients` (`Patient[]`)
- `doctors` (`Doctor[]`)
- `appointments` (`Appointment[]`)
- `dental charts` (`Record<string, DentalChart>`)
- `treatment plans` (`TreatmentPlan[]`)
- `chief complaints` (`ChiefComplaint[]`)
- `dental findings` (`DentalFinding[]`)

## Зависимости модулей
Любой компонент или страница (например `PatientCardPage.tsx`, `ScheduleContext.tsx`) может импортировать `storage` и вызывать функции `storage.get...()` или `storage.save...()`.

## Строгие ограничения
- **Не менять структуру данных** в `types/index.ts` без реализации ручной миграции или явного решения, так как старые данные в `localStorage` могут сломать приложение у пользователей.
- **Не удалять пользовательские данные** (очистка storage) без явной, обособленной задачи.
- При добавлении новой сущности в систему необходимо:
  1. Создать тип в `types`.
  2. Добавить `df_ключ` в объект `STORAGE_KEYS`.
  3. Написать функции get/save/add/update/delete в `storage.ts`.
  4. Обновить документацию: `PROJECT_ROUTES.md` и этот файл `STORAGE_RULES.md`.
### Integration Storage Rules
- The `integration` field inside `Patient` (`PatientIntegrationMeta`) is strictly optional.
- Existing patients in `localStorage` without the `integration` field must not be force-migrated or overwritten upon load.
- UI components must safely default `source` to `manual` and `leadStatus` to `new_lead` dynamically if `integration` is undefined.
