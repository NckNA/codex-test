# MVP-003 Stabilize Complaint, Finding, and Plan Flow Report

## Files inspected
- `src/components/dental/FindingsRisksTab.tsx`
- `src/components/dental/FindingModal.tsx`
- `src/components/treatment/TreatmentPlansTab.tsx`
- `src/components/treatment/CreatePlanFromFindingsModal.tsx`

## Current flow confirmed
- **FindingsRisksTab:** The chief complaint saving works cleanly and displays immediately. Findings marked as related to the complaint appear in a dedicated sub-section.
- **FindingModal:** Supports the `includeInTreatmentPlan` flag.
- **TreatmentPlansTab:** Reads plans from storage and provides the "Создать план из проблем" button to launch the creation modal.
- **CreatePlanFromFindingsModal:** Selectively fetches findings where `includeInTreatmentPlan` is true, ensuring they aren't already included in active plans or completed/declined. Creates a draft plan perfectly while updating the linked findings' status to `included_in_plan`.

## UI guidance added
- **FindingsRisksTab:** Added helper text below the tab header explaining that problems marked «Включить в план лечения» can be bundled into a plan in the Treatment Plan tab.
- **FindingModal:** Improved the checkbox area for `includeInTreatmentPlan`, adding sub-text explaining that this makes the problem available as a candidate for treatment planning, to prevent confusion with completing a treatment.
- **TreatmentPlansTab:** Added a hint under the main header explaining that the "Создать план из проблем" button uses findings configured in the "Проблемы и риски" tab.
- **CreatePlanFromFindingsModal:** Completely overhauled the empty state. Instead of a generic "No findings" message, it now lists the 4 common reasons why findings might be missing (not created, missing the plan flag, archived, or already linked to active plans).

## Behavioral changes
- **Zero behavioral changes.** The data models, `localStorage` mutations, and logical rules for selecting and filtering findings were strictly preserved.

## Intentionally not changed
- No auto-creation of plans.
- No backend logic or amoCRM sync was added.
- The `isChiefComplaintRelated` checkbox logic inside `FindingModal` was not modified since it works properly.
- No global contexts or heavy state managers were introduced.

## Remaining risks
- Since all data fetching and filtering is synchronous (reading `localStorage` directly in `useMemo` hooks), when an eventual backend migration occurs, all of these tabs will require async loading states and potential refactoring of the data fetching patterns.

## Recommended next task
**MVP-004 — Review treatment plan preview and patient-facing summary.**
This next task should audit the usability of the treatment plan preview modal and ensure it effectively presents the unified medical data to the patient.
