# Карта маршрутов проекта (Project Routes)

## 1. Маршрутизация (Core)
**Статус**: Реализовано
**Точка входа**: `src/main.tsx`
**Основные файлы**: `main.tsx`
**Что нельзя трогать без отдельной задачи**: Общую структуру `BrowserRouter` и `Routes`.
**Соседние маршруты**: Все приложение зависит от этого файла.
**Уровень уверенности**: Высокий

## 2. Layout
**Статус**: Реализовано
**Точка входа**: `src/components/layout/Layout.tsx`
**Основные файлы**: `Sidebar.tsx`, `Header.tsx`
**Что нельзя трогать**: Обертку `<Outlet />`, базовые стили.
**Уровень уверенности**: Высокий

## 3. Расписание
**Статус**: Реализовано
**Точка входа**: `src/pages/SchedulePage.tsx`
**Основные файлы**: `src/pages/SchedulePage.tsx`, `src/components/schedule/AppointmentModal.tsx`, `src/context/ScheduleContext.tsx`, `src/context/ScheduleProvider.tsx`, `src/hooks/useScheduleContext.ts`
**Связанные типы**: `Appointment`, `AppointmentStatus`
**Связанные storage-функции**: `getAppointments`, `addAppointment`, `updateAppointment`, `deleteAppointment`.
**Что нельзя трогать без отдельной задачи**: Структуру провайдера контекста, CRUD записей и проверки конфликтов времени.
**Уровень уверенности**: Высокий

## 4. Пациенты
**Статус**: Реализовано
**Точка входа**: `src/pages/PatientsPage.tsx`
**Основные файлы**: `src/components/patients/PatientModal.tsx`
**Связанные типы**: `Patient`
**Связанные storage-функции**: `getPatients`, `addPatient`, `updatePatient`.
**Уровень уверенности**: Высокий

## 5. Карточка пациента
**Статус**: Частично
**Точка входа**: `src/pages/PatientCardPage.tsx`
**Что нельзя трогать без отдельной задачи**: Маршрут параметров `/patients/:patientId`, общий порядок `TABS`.
**Соседние маршруты**: Зависит от всех вложенных табов.
**Уровень уверенности**: Высокий

## 6. Зубная карта
**Статус**: Реализовано
**Точка входа**: `src/components/dental/DentalChartTab.tsx`
**Основные файлы**: `ToothGrid.tsx`, `ToothEditorModal.tsx`
**Связанные типы**: `DentalChart`, `ToothRecord`, `ToothCondition`
**Связанные storage-функции**: `getDentalChart`, `saveDentalChart`.
**Уровень уверенности**: Высокий

## 7. Проблемы и риски
**Статус**: Реализовано
**Точка входа**: `src/components/dental/FindingsRisksTab.tsx`
**Основные файлы**: `FindingModal.tsx`
**Связанные типы**: `DentalFinding`, `ChiefComplaint`
**Связанные storage-функции**: `getChiefComplaint`, `saveChiefComplaint`, `getFindings`, `addFinding`, `updateFinding`, `deleteFinding`.
**Уровень уверенности**: Высокий

## 8. Планы лечения
**Статус**: Частично
**Точка входа**: `src/components/treatment/TreatmentPlansTab.tsx`
**Основные файлы**: `TreatmentPlanModal.tsx`
**Связанные типы**: `TreatmentPlan`, `TreatmentStage`
**Связанные storage-функции**: `getTreatmentPlans`, `addTreatmentPlan`, `updateTreatmentPlan`, `deleteTreatmentPlan`.
**Уровень уверенности**: Высокий

## 9. Финансы, Документы, Склад, Рассылки, Настройки
**Статус**: Заглушка
**Точки входа**: `FinancePage.tsx`, `DocumentsPage.tsx`, `WarehousePage.tsx`, `MailingPage.tsx`, `SettingsPage.tsx` и проч.
**Что нельзя трогать**: Это плейсхолдеры, их можно обновлять только при явной задаче на реализацию модуля.
**Уровень уверенности**: Высокий

## 10. Storage
**Статус**: Реализовано
**Точка входа**: `src/utils/storage.ts`
**Что нельзя трогать без отдельной задачи**: Синхронную природу localStorage, существующие ключи `STORAGE_KEYS`.
**Уровень уверенности**: Высокий

## 11. UI
**Статус**: Реализовано
**Точка входа**: `index.css`, `tailwind.config.js`
**Что нельзя трогать**: Цветовую палитру (использование Tailwind default `slate` и `blue` акцентов).
**Уровень уверенности**: Высокий
