# MVP-001 Medical MVP Current State Audit

## Scope
This report documents the current architectural and functional state of the Medical MVP in the DentalFlow CRM prototype. It evaluates the patient medical flow (Patient → complaint → dental chart → finding/risk → treatment plan → patient preview) and identifies gaps and architectural risks before any backend migration or integration work begins.

## Files inspected
- `src/types/index.ts` (Domain models)
- `src/pages/PatientCardPage.tsx` (Main Patient View)
- `src/components/dental/DentalChartTab.tsx` (Interactive FDI chart)
- `src/components/dental/FindingsRisksTab.tsx` (Complaints and Findings list)
- `src/components/treatment/CreatePlanFromFindingsModal.tsx` (Conversion flow)
- `src/components/treatment/TreatmentPlanPatientPreview.tsx` (Patient-facing presentation)

## Current medical MVP modules
- **Dental Chart**: Interactive 32-tooth FDI grid with state editing (`ToothEditorModal`).
- **Findings & Risks**: List of clinical findings categorised by severity and status.
- **Chief Complaint**: Textual complaint recording with associated teeth.
- **Treatment Plans**: Creation of multi-stage treatment plans, including generation directly from findings.
- **Patient Preview**: A clean, read-only summary for the patient detailing complaints, findings, stages, and costs.

## Current user flow
The core medical flow is **supported** and functionally complete in prototype mode:
1. User opens a patient card.
2. User records a Chief Complaint (`FindingsRisksTab` or `DentalChartTab`).
3. User interacts with the Dental Chart, changing tooth states.
4. User logs a `DentalFinding` (e.g., Caries, high severity) via `ToothEditorModal`.
5. User navigates to the Treatment Plans tab and clicks "Создать план из проблем".
6. User selects active findings, which automatically generate `TreatmentStage` items in a new `TreatmentPlan`.
7. User opens the `TreatmentPlanPatientPreview` to present the cohesive plan to the patient.

## Existing medical domain entities
The following entities are successfully defined in `src/types/index.ts`:
- `Patient`, `Appointment`
- `ChiefComplaint`
- `DentalChart`, `ToothRecord`, `ToothCondition`, `ToothSurface`
- `DentalFinding` (Categories, Severity, Status)
- `TreatmentPlan`, `TreatmentStage`
*(Note: `CompletedService` and `MedicalDocument` are not fully formalized yet).*

## What currently works
- **Patient Card Creation/Opening**: Clinics can successfully create and view patients.
- **Complaints**: Can be saved, viewed, and edited.
- **Tooth States & Findings**: Can be recorded, updated, and visually represented on the chart.
- **Treatment Plan Generation**: Seamlessly creates plans from active clinical findings.
- **Patient-facing Preview**: Highly usable and formatted nicely for MVP testing.

## What is incomplete or risky
- No global notification (Toast) system for save actions (e.g., saving text in the dental chart).
- Finance, Documents, Communications, and Files tabs are just placeholders.
- The `FindingsRisksTab` and `DentalChartTab` somewhat overlap in displaying complaints.
- LocalStorage logic is duplicated across multiple components instead of being managed by a shared context or hook.

## Architecture risks
**Highest Risk: `PatientCardPage.tsx` is becoming a God Component.**
- The file is currently over 540 lines long.
- It directly contains the layout, header, huge inline implementations for the "Overview" and "History" tabs.
- It mixes medical, administrative, CRM, and financial data in one massive file.
- There is unclear ownership of state (components read directly from `storage` rather than a unified patient context).

**Other risks:**
- **Storage Layer:** Everything is heavily tied to synchronous `localStorage` reads. A migration to an async backend will require a complete rewrite of the data-fetching layer if not abstracted soon.
- **Fake UI:** The UI looks very production-ready, which might mask the fact that it's entirely client-side.

## Recommended next tasks
Before any backend migration or amoCRM integration, the frontend architecture of the patient card must be stabilized to prevent the "God Component" from collapsing under its own weight as new tabs are built.

## Suggested priority order
1. **MVP-002** — Patient card structure review / avoid God Component (Extract tabs into separate components).
2. **MVP-003** — Stabilize complaint → finding → treatment plan flow (Address overlap between Dental Chart and Findings tabs).
3. **MVP-004** — Review treatment plan preview and patient-facing summary.
4. **MVP-005** — Medical MVP UX gaps cleanup.
5. **FIX-001** — Resolve pre-existing DentalChartTab ESLint warning (can be grouped with MVP-003).

*(Backend migration and amoCRM sync should NOT be started yet).*
