# Medical MVP Sign-off Checklist and Demo Scenario

## Scope
This report signifies the completion of the Medical MVP stabilization phase (Phase 1) for the DentalFlow CRM prototype. It outlines the current state of the MVP, providing a strict boundary between what is ready for limited testing and what remains in a prototype or mock state. It also provides a structured demo scenario for stakeholders.

## Medical MVP Phase Summary
During Phase 1, the core frontend medical workflow was audited, cleaned up, and stabilized. The flow from registering a patient complaint, noting clinical findings, and building a treatment plan was refined. Key UX gaps, misleading buttons, and hardcoded "fake" behaviors were disabled or replaced with transparent warnings. Terminology was made safer for patient-facing views, avoiding strict diagnostic claims and conveying that treatment plans are preliminary estimates. The component architecture for `PatientCardPage` was also simplified. 

## What is ready for MVP testing
The following frontend workflows are functional (via `localStorage` persistence) and safe for UX/UI demonstrations or limited user testing:
- Opening the patient list and creating/editing a patient.
- Viewing the Patient Card (Overview and Appointment History tabs are modular).
- Registering a Chief Complaint with associated teeth.
- Recording tooth states (visual grid) and general clinical picture text in the Dental Chart.
- Creating "Findings/Risks" (Проблемы и риски) and optionally linking them to the chief complaint.
- Flagging specific findings as candidates for a treatment plan.
- Generating a new Treatment Plan directly from eligible findings.
- Presenting a clean, patient-safe Treatment Plan Preview (without exposing internal CRM data).

## What is still prototype-only
- **Persistence:** All data is currently stored in browser `localStorage`. Refreshing in an Incognito window or different browser will result in an empty state.
- **Backend/Database:** There is no actual backend server or database connected.
- **Authentication/Tenancy:** Multi-tenant isolation, user roles, and secure logins are missing.
- **amoCRM Integration:** The UI shows CRM integration stubs for doctors, but real synchronization is entirely inactive.
- **Document Generation:** PDF export, printing, and digital signatures are not implemented.

## Medical MVP sign-off checklist
- [x] Patient card can be opened.
- [x] Patient overview and appointment history are separated from `PatientCardPage`.
- [x] Complaint can be saved.
- [x] Dental chart can record tooth states.
- [x] Findings/risks can be created and linked to complaint.
- [x] Findings can be marked for treatment plan.
- [x] Treatment plan can be created from findings.
- [x] Patient-facing preview exists and uses safer wording.
- [x] Prototype Mode warning exists globally.
- [x] Data still relies on `localStorage`.
- [x] Backend/database/auth/tenant are not implemented.
- [x] Real amoCRM sync is not implemented and must not be started before SaaS foundation.
- [x] PDF/export/signature are not implemented.
- [x] The app is suitable for controlled MVP testing, not production use.

## Recommended Demo Scenario
This scenario demonstrates the end-to-end "Medical MVP" value proposition—capturing clinical context and instantly translating it into a transparent treatment plan for the patient, while acknowledging prototype constraints.

## Demo script step-by-step
1. **Open patient list:** Navigate to the main `/patients` list. Point out the global "Prototype Mode" warning.
2. **Open or create a patient:** Click on an existing patient or quickly add a new one.
3. **Open patient card:** Enter the patient's card.
4. **Show overview:** Briefly show the "Обзор" tab, noting how it summarizes the financial balance, last visits, and dental summary.
5. **Add/save complaint:** Go to "Проблемы и риски", type a patient complaint (e.g., "Болит зуб при накусывании"), enter related teeth (e.g., 47), and hit Save.
6. **Open dental chart:** Go to "Зубная карта", explain the FDI grid.
7. **Mark tooth condition or clinical picture:** Click a tooth (e.g., 47), mark it as "Кариес". Add a summary in the "Клиническая картина" text box.
8. **Add finding/risk:** From the tooth modal or "Проблемы и риски" tab, create a new finding (e.g., "Глубокий кариес 47").
9. **Mark finding for treatment plan:** Ensure the checkbox "Включить в план лечения" is checked for that finding.
10. **Open treatment plan tab:** Go to "План лечения".
11. **Create plan from findings:** Click "Создать план из проблем". Select the previously created finding, and generate the draft plan.
12. **Open patient-facing preview:** Click "Предпросмотр для пациента" on the newly created plan. Show how the language is safe ("Выявленные проблемы", "Ориентировочная стоимость") and the layout is clean.
13. **Explain prototype limitations:** Conclude the demo by reminding stakeholders that data is currently local, there is no real backend, and amoCRM sync is purposefully disabled until the core SaaS architecture is built.

## Known limitations and risks
- Loss of data is guaranteed if `localStorage` is cleared.
- Without a backend, performance metrics or concurrent user testing cannot be evaluated.
- Direct reliance on `localStorage` in UI components limits scalability and will require refactoring (e.g., introducing a global state manager or React Query) during the backend migration.

## What must NOT be claimed yet
- Do NOT claim that the product is production-ready or safe for real clinical data.
- Do NOT claim that it integrates with amoCRM.
- Do NOT claim it can generate legal medical documents or final diagnoses.

## Recommended next phase
**Phase 2: SaaS Foundation and Backend Architecture**
With the frontend MVP flows proven and stabilized, the project must shift focus to the underlying infrastructure required for a multi-tenant B2B application.

## Suggested next tasks
- **FIX-001** — Resolve pre-existing DentalChartTab ESLint warning
- **ARCH-001** — Audit frontend storage/data access before backend migration
- **SAAS-001** — SaaS foundation planning: auth, tenant isolation, roles
- **BACKEND-001** — Backend/database architecture draft
- **DOCS-001** — Patient document/PDF/export planning, not implementation
