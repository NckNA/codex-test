# MVP-004 Treatment Plan Preview Review Report

## What was inspected
- `src/components/treatment/TreatmentPlanPatientPreview.tsx`
- The entire layout and presentation text of the patient-facing Treatment Plan preview.

## What patient-facing risks were found
- The word "Результат осмотра" (exam result) was somewhat ambiguous and lacked clarity regarding the risks being communicated to the patient.
- The disclaimer at the bottom was dense and used clinical wording ("клинические обстоятельства").
- The treatment stages block used rigid "key: value" formatting (e.g. `Зубы: не указаны`, `Описание: не указано`), which looked too technical and robotic for a patient summary.
- The total amount stated "Итого по плану" which could incorrectly imply a final, guaranteed price.

## What wording/layout improvements were made
- Changed section 2 title to **"Выявленные проблемы и риски"** to be clear and patient-safe without asserting a final diagnosis.
- Rewrote the main disclaimer to be simpler and safer: **"План лечения является предварительным и может быть уточнён врачом после осмотра, снимков или дополнительных данных."**
- Refactored the treatment stages display to gracefully hide empty attributes (no more "не указаны"). Teeth, descriptions, and prices only show up if they actually exist, making the list look clean.
- Updated total pricing language to **"Ориентировочная итоговая стоимость"** to clearly indicate the estimate is not legally binding.

## What was intentionally not changed
- The underlying `TreatmentPlan` and `DentalFinding` data models were entirely untouched.
- No storage logic or CRM sync logic was modified.
- No PDF generation or document signing mechanisms were added.

## Checks performed
- `npm run lint` — passed.
- `npm run build` — passed successfully.
- Verified no internal `amoCRM` sync details were ever visible on the preview modal.

## Remaining risks
- The patient preview still relies heavily on the `PatientCardPage` and `storage` utility running fully client-side.
- A future print functionality (`window.print()`) or PDF export might be needed for actual clinical use if patients request a physical copy.

## Recommended next task
**MVP-005 — Medical MVP UX gaps cleanup.**
This task should focus on rounding out the remaining minor UI/UX issues across the entire medical flow before we sign off the MVP phase.
