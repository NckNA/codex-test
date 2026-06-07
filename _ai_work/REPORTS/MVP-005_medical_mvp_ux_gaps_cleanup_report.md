# MVP-005 Medical MVP UX Gaps Cleanup Report

## Files inspected
- `src/pages/PatientCardPage.tsx`
- `src/components/patients/patient-card/PatientOverviewTab.tsx`
- `src/components/patients/patient-card/PatientHistoryTab.tsx`
- `src/components/dental/DentalChartTab.tsx`
- `src/components/dental/FindingsRisksTab.tsx`
- `src/components/dental/FindingModal.tsx`
- `src/components/treatment/TreatmentPlansTab.tsx`
- `src/components/treatment/CreatePlanFromFindingsModal.tsx`
- `src/components/treatment/TreatmentPlanPatientPreview.tsx`

## Search results for unsafe/confusing wording
- **“диагноз”**: Found one occurrence in `DentalChartTab.tsx` as a label for a text area ("Диагноз" and "Установленный диагноз...").
- **“Результат осмотра”, “гарант”, “окончатель”**: Not found in any unsafe patient-facing contexts (removed in MVP-004).
- **“amoCRM”, “localStorage”, “backend”, “sync”**: Found only in `PatientOverviewTab.tsx` and `TreatmentPlansTab.tsx`, but strictly within internal doctor-facing panels (e.g., the CRM Sync block and disabled "Export" buttons). Safe and compliant with the rules.

## UX gaps found
- In `DentalChartTab.tsx`, the free-text field for the doctor's conclusion was labeled "Диагноз". Since the MVP lacks a formal diagnosis data model (ICD-10, etc.), using the strict medical term "Диагноз" is legally and architecturally risky for a prototype.

## Changes made
- **`src/components/dental/DentalChartTab.tsx`**: Changed the label from "Диагноз" to "Клиническая картина" and the placeholder from "Установленный диагноз..." to "Описание клинической картины...". This aligns the terminology with the exploratory nature of the MVP findings.

## Files changed
- `src/components/dental/DentalChartTab.tsx`

## What was intentionally not changed
- The `amoCRM` sync stubs in `PatientOverviewTab` and `TreatmentPlansTab` were not removed, as they are safely isolated to the doctor's view and correctly reflect the "in-development" status without deceiving the user.
- Empty states in history and plans tabs were left as-is since they already provide clear guidance and icons.
- No business logic, storage operations, or data models were altered.

## Checks performed
- `npm run lint` — passed (1 pre-existing warning in `DentalChartTab.tsx` intentionally ignored as per rules).
- `npm run build` — passed successfully.
- Verified that the `TreatmentPlanPatientPreview` remains clean of internal variables.

## Remaining risks
- The application still relies fully on `localStorage`.
- There is a pre-existing ESLint warning in `DentalChartTab.tsx` (`react-hooks/exhaustive-deps` on `loadData`) that was out of scope for this UX cleanup task.

## Recommended next task
**MVP-006 — Medical MVP sign-off checklist and demo scenario.**
