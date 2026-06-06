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
**Основные файлы**: `TreatmentPlanModal.tsx`, `CreatePlanFromFindingsModal.tsx`, `TreatmentPlanPatientPreview.tsx`
**Связанные типы**: `TreatmentPlan`, `TreatmentStage`, `DentalFinding`
**Связанные storage-функции**: `getTreatmentPlans`, `addTreatmentPlan`, `updateTreatmentPlan`, `deleteTreatmentPlan`, `getPatients`, `getChiefComplaint`, `getFindings`, `updateFinding`.
**Связь с проблемами/рисками**: `TreatmentPlansTab` может создать draft plan from findings через `CreatePlanFromFindingsModal.tsx`. Один selected `DentalFinding` создает один `TreatmentStage` с `findingIds`.
**Patient preview**: `TreatmentPlanPatientPreview.tsx` показывает read-only предпросмотр выбранного плана для пациента без PDF, печати и document generation.
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

## Integrations / amoCRM

**Status:** planned / architecture only

**Files:**
- `_ai_work/AMOCRM_INTEGRATION_ARCHITECTURE.md`
- `_ai_work/AMOCRM_FIELD_MAPPING.md`
- `_ai_work/AMOCRM_SECURITY_RULES.md`
- `_ai_work/AMOCRM_SYNC_STRATEGY.md`
- `src/integrations/amocrm/amoCrmMapper.ts`
- `src/integrations/amocrm/amoCrmTypes.ts`

**Important:**
- AMO-001 created frontend-safe preparation only.
- AMO-002 defines future real integration architecture.
- Real API/OAuth/backend not implemented yet.

## Future Routes
- `Settings → Integrations → amoCRM`: Prepared route for future amoCRM settings (UI not implemented yet).


## Backend / Integration Proxy

**Status:** OAuth connection skeleton (AMO-004)

**Files:**
- `backend/package.json`
- `backend/src/server.js`
- `backend/src/config.js`
- `backend/src/routes/healthRoutes.js`
- `backend/src/routes/amoCrmRoutes.js`
- `backend/src/services/amoCrmTokenStore.js`
- `backend/src/services/amoCrmStateStore.js`
- `backend/src/services/amoCrmClient.js`

**Important:**
- no real OAuth yet;
- no real amoCRM API calls yet;
- frontend not connected yet.


## Project Source Documents
**Location:** `_ai_work/SOURCES/`
**Status:** Structure initialized (DOCS-001)

**Files:**
- `_ai_work/SOURCES/SOURCES_INDEX.md`

*(Documents 00-18 are pending content provision)*
