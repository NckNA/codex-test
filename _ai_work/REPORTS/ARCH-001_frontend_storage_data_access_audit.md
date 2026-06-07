# ARCH-001 Frontend Storage & Data Access Audit

## Scope
This report documents the current frontend storage architecture of the DentalFlow CRM prototype. It maps direct dependencies on the local `storage.ts` utility, identifies risks for migrating to an asynchronous backend, and outlines a safe architectural sequence for the transition.

## Files Inspected
- `src/utils/storage.ts`
- `src/main.tsx`
- `src/pages/PatientCardPage.tsx`
- `src/pages/PatientsPage.tsx`
- `src/pages/SchedulePage.tsx`
- `src/components/layout/Header.tsx`
- `src/components/patients/AppointmentModal.tsx`
- `src/components/dental/DentalChartTab.tsx`
- `src/components/dental/FindingModal.tsx`
- `src/components/dental/FindingsRisksTab.tsx`
- `src/components/treatment/TreatmentPlansTab.tsx`
- `src/components/treatment/TreatmentPlanModal.tsx`
- `src/components/treatment/CreatePlanFromFindingsModal.tsx`
- `src/components/treatment/TreatmentPlanPatientPreview.tsx`

## Storage Utility Overview
`src/utils/storage.ts` acts as a synchronous wrapper over browser `localStorage`. 
- Data is parsed/stringified synchronously on every read/write.
- Entities currently stored: `Doctors`, `Patients`, `Appointments`, `Dental Charts`, `Treatment Plans`, `Chief Complaints`, `Dental Findings`.
- Global seed logic (`storage.init()`) is injected on mount in `main.tsx`.

## Direct Storage Access Map
The following modules import and tightly couple to `storage.ts`:

**Global / Multi-Entity Reads**
- `PatientsPage.tsx`: Reads all patients and appointments to render the list.
- `SchedulePage.tsx`: Reads all appointments, patients, and doctors to render the calendar.
- `Header.tsx`: Reads doctors.

**Patient-Scoped Reads & Writes**
- `PatientCardPage.tsx`: Heavily coupled. Synchronously reads `patients`, `dentalCharts`, `plans`, `complaints`, `findings`, `appointments`, and `doctors` to construct a unified patient view and compute derived summaries.
- `DentalChartTab.tsx`: Reads/writes `chart`, `findings`, `complaints` directly on mount and during tooth edits.
- `FindingsRisksTab.tsx`: Reads/writes `findings`, `complaint`.
- `TreatmentPlansTab.tsx`: Reads/writes `plans`.
- `FindingModal.tsx`, `AppointmentModal.tsx`, `CreatePlanFromFindingsModal.tsx`, `TreatmentPlanModal.tsx`, `TreatmentPlanPatientPreview.tsx`: Read contextual data or write modal payloads directly to storage.

## Read/Write Patterns
- **Synchronous Render Reads:** Extensively used in `useState` initializers (e.g., `useState(storage.getPatients())`) and `useMemo` hooks (e.g., `useMemo(() => storage.getAppointments(), [])`).
- **Synchronous Writes:** Event handlers (e.g., `handleSaveTooth`) synchronously write to storage and immediately trigger a re-read to update local React state.
- **Derived Data:** Components like `PatientCardPage.tsx` fetch raw arrays of appointments/findings and calculate complex summaries (`lastVisit`, `nextVisit`, `dentalSummary`) synchronously in `useMemo`.

## Medical MVP Data Flow
- **Patient Scoped:** Almost all medical records are requested via `(patientId: string)`.
- **Relational Integrity:** Currently simulated via array filtering (e.g., `findings.filter(f => f.patientId === patientId)`). There are no actual foreign key constraints.

## Non-medical Data Flow
- **Global Collections:** `getDoctors()` and `getPatients()` read entire collections. For a real SaaS, this will instantly break due to pagination and tenant isolation limits.

## Backend Migration Risks
1. **Missing Asynchronous State:** UI lacks `isLoading`, `isError`, or `isFetching` states because `localStorage` is instantaneous. Switching to async fetch will break synchronous `useMemo` and `useState` initializations.
2. **Missing UI Feedback:** Buttons have no disabled/loading states during saves.
3. **No Optimistic Updates / Cache Invalidation:** The current pattern of "write to storage -> immediately read from storage to state" works for local memory but will cause massive lag/stutter over HTTP.
4. **Scattered Source-of-Truth:** `PatientCardPage` and its child tabs both fetch the exact same data from `storage` independently, leading to massive over-fetching if replaced directly by API calls.
5. **No Tenant Isolation:** The UI assumes it can pull "all patients." In SaaS, data must be isolated by `tenantId`.

## Recommended Architecture Direction
Before writing backend APIs, the frontend must abstract data access. Direct `storage` imports must be replaced by a Data Access Layer (DAL) or custom hooks (e.g., via React Query/RTK Query) that natively handle async states, caching, and cache invalidation.

## Safe Migration Preparation Sequence
1. **ARCH-002** — Define frontend data access boundary / repository interfaces.
2. **ARCH-003** — Define patient-scoped data hooks contract (abstracting local vs async logic).
3. **SAAS-001** — SaaS foundation planning: auth, tenant isolation, roles.
4. **BACKEND-001** — Backend/database architecture draft.
5. **MIGRATION-001** — `localStorage` to backend migration plan.

## What must NOT be done yet
- **Do NOT migrate clinical data to a backend yet.** The backend architecture (auth, multi-tenancy) must be fully designed first.
- **Do NOT implement real amoCRM sync.** It requires webhooks and a persistent backend layer.
- **Do NOT introduce a global state manager right now.** Stick to defining boundaries first in `ARCH-002`.

## Suggested next tasks
- ARCH-002 — Define frontend data access boundary / repository interfaces
- SAAS-001 — SaaS foundation planning: auth, tenant isolation, roles
