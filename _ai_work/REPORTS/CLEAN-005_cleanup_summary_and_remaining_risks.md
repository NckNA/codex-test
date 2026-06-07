# CLEAN-005 Cleanup Summary and Remaining Risks

## Scope
This report consolidates the results of UI cleanup tasks CLEAN-001 through CLEAN-004. These tasks focused on auditing and removing misleading prototype UI behavior without changing the underlying architecture, storage mechanism, or implementing new features. This report also serves as the current risk register before moving to Medical MVP tasks.

## Completed cleanup items
1. **CLEAN-001**: Audited the entire frontend prototype for fake actions, disabled buttons, and risky placeholders. Documented all `PlaceholderPage` instances and identified P1 risks.
2. **CLEAN-002**: Disabled the non-functional global "Записать пациента" button in the `Header` to prevent user confusion, adding a tooltip explaining the limitation.
3. **CLEAN-003**: Replaced the native browser `alert('Жалоба сохранена')` in `FindingsRisksTab.tsx` with an inline, disappearing success message.
4. **CLEAN-004**: Added a global Prototype Mode warning banner in `Layout.tsx` to clearly inform testers that data is stored only in the browser's `localStorage`.

## Current UI state after CLEAN-001..004
- **Global Patient Creation**: The global "Записать пациента" button is visibly disabled and explains that the action is not fully implemented globally.
- **Complaint Saving**: Complaint saving uses proper inline UI feedback, avoiding disruptive browser alerts.
- **Prototype Warning**: The Prototype Mode warning is visible globally across all pages, ensuring testers understand data persistence limitations.
- **Safe Placeholders**: Incomplete features (e.g., `/finance`, `/warehouse`) safely render a "under construction" placeholder.
- **Integration UI**: The amoCRM sync button remains visibly disabled with a tooltip indicating it is a future feature.

## Remaining known limitations
Despite the cleanup, the following technical and architectural risks remain:
- **No Global Toast/Notification System**: There is still no shared notification component. Any new success/error messages will require localized inline states until a global context is built.
- **Storage limitations**: Data still heavily relies on browser `localStorage` and is strictly prototype-level. It is not production-safe.
- **No Backend/Auth Migration**: No backend, database, authentication, or tenant isolation migrations have been performed.
- **amoCRM Sync Risks**: Real amoCRM sync must NOT be implemented before the SaaS foundation (auth/tenant isolation) is fully integrated.
- **Patient Card Architecture**: Potential "God Component" issues remain in complex medical views like the patient card, which require review.

## Recommended next phase
The next recommended phase is the **Medical MVP review and stabilization phase**. We should not proceed with backend migration or amoCRM sync until the core medical MVP UI flows (patient card, dental chart, treatment plans) are verified and structurally sound.

## Suggested next tasks
- **MVP-001** — Medical MVP current-state audit
- **MVP-002** — Patient card structure review / avoid God Component
- **MVP-003** — Stabilize complaint → finding → treatment plan flow
- **MVP-004** — Review treatment plan preview and patient-facing summary
