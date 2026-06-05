# Карта маршрутов проекта (Project Routes)

## 1. Маршрутизация (Core)
**Статус**: реализовано
**Точка входа**: `src/main.tsx`
**Что нельзя трогать**: базовую структуру `BrowserRouter` и `Routes`.
**Уровень уверенности**: высокий

## 2. Layout
**Статус**: реализовано
**Точка входа**: `src/components/layout/Layout.tsx`
**Основные файлы**: `Sidebar.tsx`, `Header.tsx`
**Что нельзя трогать**: обертку `<Outlet />`.
**Уровень уверенности**: высокий

## 3. Расписание
**Статус**: реализовано
**Точка входа**: `src/pages/SchedulePage.tsx`
**Основные файлы**:
- `src/components/schedule/ScheduleGrid.tsx`
- `src/components/schedule/AppointmentModal.tsx`
- `src/context/ScheduleContext.tsx`
**Связанные storage-функции**: `getAppointments`, `addAppointment`, `updateAppointment`, `deleteAppointment`.
**Что нельзя трогать**: логику drag-and-drop, структуру контекста.
**Уровень уверенности**: высокий

## 4. Пациенты
**Статус**: реализовано
**Точка входа**: `src/pages/PatientsPage.tsx`
**Основные файлы**:
- `src/components/patients/PatientModal.tsx`
**Связанные storage-функции**: `getPatients`, `addPatient`, `updatePatient`.
**Уровень уверенности**: высокий

## 5. Карточка пациента
**Статус**: реализовано частично (некоторые табы - заглушки)
**Точка входа**: `src/pages/PatientCardPage.tsx`
**Что нельзя трогать**: маршрут `/patients/:patientId`, общий порядок вкладок без задачи.
**Уровень уверенности**: высокий

## 6. Зубная карта
**Статус**: реализовано
**Точка входа**: `src/components/dental/DentalChartTab.tsx`
**Основные файлы**:
- `ToothGrid.tsx`
- `ToothEditorModal.tsx`
**Связанные storage-функции**: `getDentalChart`, `saveDentalChart`.
**Уровень уверенности**: высокий

## 7. Проблемы и риски
**Статус**: реализовано
**Точка входа**: `src/components/dental/FindingsRisksTab.tsx`
**Основные файлы**:
- `FindingModal.tsx`
**Связанные storage-функции**: `getFindings`, `addFinding`, `updateFinding`, `deleteFinding`, `getChiefComplaint`, `saveChiefComplaint`.
**Уровень уверенности**: высокий

## 8. Планы лечения
**Статус**: реализовано частично (нет печати и автогенерации)
**Точка входа**: `src/components/treatment/TreatmentPlansTab.tsx`
**Основные файлы**:
- `TreatmentPlanModal.tsx`
**Связанные storage-функции**: `getTreatmentPlans`, `addTreatmentPlan`, `updateTreatmentPlan`, `deleteTreatmentPlan`.
**Уровень уверенности**: высокий

## 9. Storage
**Статус**: реализовано
**Точка входа**: `src/utils/storage.ts`
**Связанные типы**: Все интерфейсы из `src/types/index.ts`.
**Что нельзя трогать**: имена ключей `STORAGE_KEYS`, логику синхронного возврата без задачи на рефакторинг.
**Уровень уверенности**: высокий

## 10. Типы
**Статус**: реализовано
**Точка входа**: `src/types/index.ts`
**Что нельзя трогать**: существующие обязательные поля.
**Уровень уверенности**: высокий

## 11. Финансы, Документы, Склад, Рассылки, Настройки
**Статус**: заглушки
**Точки входа**: `FinancePage.tsx`, `DocumentsPage.tsx`, `WarehousePage.tsx`, `SmsPage.tsx`, `SettingsPage.tsx` и др.
**Уровень уверенности**: высокий