# Текущая архитектура (Architecture Current)

Документ описывает фактическое текущее состояние проекта по коду.

## 1. Маршруты приложения и страницы
Используется `react-router-dom` в `src/main.tsx`. Все страницы обернуты в `<Layout />`.

Основные страницы (`src/pages/`):
- `SchedulePage.tsx` - Главная страница, сетка расписания.
- `PatientsPage.tsx` - Список пациентов.
- `PatientCardPage.tsx` - Карточка конкретного пациента со вкладками.
- *Заглушки:* `AppointmentsPage`, `BonusPage`, `CrmPage`, `DoctorsPage`, `DocumentsPage`, `FinancePage`, `MailingPage`, `MedicalPage`, `ReportsPage`, `SettingsPage`, `SmsPage`, `StatisticsPage`, `WarehousePage`.

**Уровень уверенности:** Высокий.

## 2. Layout
Находится в `src/components/layout/`.
Включает в себя боковое меню (Sidebar) со ссылками на страницы и верхнюю панель (Header).

**Уровень уверенности:** Высокий.

## 3. Контекст расписания
Находится в `src/context/ScheduleContext.tsx` и `src/context/ScheduleProvider.tsx`.
Отвечает за глобальное состояние расписания: выбранная дата, управление модалкой записи (`AppointmentModal`), функции drag-and-drop.
**Риск:** Логика сильно завязана на компонент `ScheduleGrid`.

**Уровень уверенности:** Высокий.

## 4. Storage (Хранилище)
Находится в `src/utils/storage.ts`.
Все данные хранятся синхронно в браузере через `localStorage`.
Модуль предоставляет CRUD-функции для:
- Doctors
- Patients
- Appointments
- DentalCharts
- TreatmentPlans
- ChiefComplaints
- DentalFindings
При первом запуске инициализируется демо-данными из `src/data/seed.ts`.

**Уровень уверенности:** Высокий.

## 5. Типы (Types)
Находятся в `src/types/index.ts`.
Включают интерфейсы сущностей: `Patient`, `Doctor`, `Appointment`, `ToothRecord`, `DentalChart`, `TreatmentPlan`, `TreatmentStage`, `DentalFinding`, `ChiefComplaint`.

**Уровень уверенности:** Высокий.

## 6. Компоненты

### 6.1 Пациенты
- `PatientModal.tsx` - Форма создания/редактирования пациента.

### 6.2 Зубная карта
- `DentalChartTab.tsx` - Вкладка зубной карты. Содержит текстовые поля диагноза и жалоб.
- `ToothGrid.tsx` - Сетка из 32 зубов по системе FDI.
- `ToothEditorModal.tsx` - Модальное окно редактирования состояния одного зуба (поверхности, корни и т.д.).

### 6.3 Проблемы и риски
- `FindingsRisksTab.tsx` - Вкладка фиксации жалобы и списков находок (разбитых по категориям).
- `FindingModal.tsx` - Модалка добавления/редактирования находки (Dental Finding).

### 6.4 Планы лечения
- `TreatmentPlansTab.tsx` - Список планов лечения пациента.
- `TreatmentPlanModal.tsx` - Редактор плана и его этапов.

**Уровень уверенности (по компонентам):** Высокий.

## 7. Рискованные зоны в коде
- **`PatientCardPage.tsx`**: Файл начинает перегружаться логикой агрегации данных (`dentalSummary`), что может усложнить поддержку при добавлении новых вкладок (Финансы, Документы).
- **Синхронность Storage**: Работа с `localStorage` полностью синхронная. Добавление "псевдо-бэкенда" в будущем потребует полного рефакторинга компонентов на асинхронные хуки (`useEffect` + loading states).
- **Дублирование состояния жалоб**: Исторически жалобы сохранялись как строка в `DentalChart`, теперь они переведены в отдельную сущность `ChiefComplaint`. Присутствует риск рассинхрона, если логика сохранения не будет обновляться согласованно.