# ARCH-002: Data Access Boundary and Repository Interfaces

## Scope
This architectural design report defines the future Data Access Layer (DAL) boundary for the DentalFlow CRM frontend. It establishes a set of repository interfaces to abstract data persistence, allowing the UI to decouple from direct synchronous `localStorage` (`storage.ts`) access. This is a purely conceptual design step required before beginning actual backend or hook implementation.

## Inputs Reviewed
- `ARCH-001_frontend_storage_data_access_audit.md` (confirmed tight coupling to synchronous storage).
- `src/types/index.ts` (domain definitions).
- `src/utils/storage.ts` (current method groups for Patients, Doctors, Appointments, DentalCharts, Findings, Complaints, TreatmentPlans).

## Why a Data Access Layer is Needed
The ARCH-001 audit revealed that components currently call `storage.ts` methods synchronously inside React lifecycle hooks (like `useMemo` and `useState`). A DAL provides an abstraction barrier that:
- Allows data operations to become asynchronous (Promises) gracefully.
- Enables safe introduction of `isLoading` and `isError` states.
- Ensures logic such as tenant isolation and role validation can be enforced in one place rather than scattered across UI components.
- Allows switching the underlying storage (e.g., from `localStorage` adapter to HTTP API adapter) without rewriting React components.

## Proposed Repository Boundaries
The following repository interfaces should exist to map and extend the current `storage.ts` responsibilities:
- `PatientRepository`
- `AppointmentRepository`
- `DoctorRepository`
- `DentalChartRepository`
- `ChiefComplaintRepository`
- `FindingRepository`
- `TreatmentPlanRepository`
- `DemoDataRepository` (to handle the seeding currently done by `storage.init()`)

## Repository Interface Draft

**PatientRepository:**
- `listPatients(scope)`
- `getPatientById(patientId, scope)`
- `createPatient(input, scope)`
- `updatePatient(patientId, patch, scope)`

**AppointmentRepository:**
- `listAppointments(scope)`
- `listAppointmentsByPatient(patientId, scope)`
- `createAppointment(input, scope)`
- `updateAppointment(appointmentId, patch, scope)`

**DentalChartRepository:**
- `getDentalChart(patientId, scope)`
- `saveDentalChart(patientId, chart, scope)`

**ChiefComplaintRepository:**
- `getChiefComplaint(patientId, scope)`
- `saveChiefComplaint(patientId, complaint, scope)`

**FindingRepository:**
- `listFindingsByPatient(patientId, scope)`
- `createFinding(input, scope)`
- `updateFinding(findingId, patch, scope)`

**TreatmentPlanRepository:**
- `listTreatmentPlansByPatient(patientId, scope)`
- `createTreatmentPlan(input, scope)`
- `updateTreatmentPlan(planId, patch, scope)`

**DoctorRepository:**
- `listDoctors(scope)`
- `getDoctorById(doctorId, scope)`

*Scope object concept:*
A future-safe `scope` shape should eventually include properties such as:
- `tenantId`
- `userId`
- `role`
- `clinicId` (if needed later)

## Entity Ownership and Scoping Table

| Entity / Interface | Current Scope in `storage.ts` | Target Future Scope |
|---|---|---|
| **Patient** | Global (All patients) | Tenant-scoped |
| **Appointment** | Global (All appointments) | Tenant-scoped |
| **Doctor** | Global (All doctors) | Tenant-scoped |
| **DentalChart** | Patient-scoped | Patient-scoped (within Tenant) |
| **ChiefComplaint**| Patient-scoped | Patient-scoped (within Tenant) |
| **Finding** | Patient-scoped | Patient-scoped (within Tenant) |
| **TreatmentPlan** | Patient-scoped | Patient-scoped (within Tenant) |
| **Demo Seed** | Global execution | Global / Demo-only |

## Async-readiness Strategy
**Should repository methods be async-ready?**
**YES.** All repository contracts must return `Promise<T>`. Even though the first adapter (`localStorage`) is technically synchronous, wrapping the return in a `Promise` ensures the UI components (via data hooks) handle loading and error states exactly as they would when making real HTTP requests.

## LocalStorage Adapter Strategy
**Should current `storage.ts` be deleted now?**
**NO.** The immediate next implementation phase should create a `LocalStorageAdapter` that conforms to the new async Repository interfaces but uses the existing `storage.ts` methods under the hood (e.g., resolving a Promise after reading from `localStorage`).

## UI Consumption Strategy
**Should UI components call repositories directly?**
**NO.** Components should not instantiate or call repository methods directly. Instead, UI components should eventually consume data via a view-model layer or custom hooks (e.g., `usePatient(id)`, `useFindings(id)`) that internally call the repositories and manage the React lifecycle (`isLoading`, `data`, `error`).

## Migration Sequence after ARCH-002
1. **ARCH-003** — Define patient-scoped data hooks contract.
2. **SAAS-001** — SaaS foundation planning: auth, tenant isolation, roles.
3. **BACKEND-001** — Backend/database architecture draft.
4. **MIGRATION-001** — `localStorage` to backend migration plan.

## What must NOT be implemented yet
- Do NOT implement these repository interfaces in code (TypeScript) yet.
- Do NOT refactor React components to use async calls.
- Do NOT implement a real backend, database, auth, or tenant layer.
- Do NOT implement amoCRM sync.
- Do NOT introduce global state managers (like Redux, Zustand) or React Query yet.

## Open Questions
- Should the `scope` object be passed explicitly to every repository call, or injected via a dependency injection container / factory when the user logs in?
- How should we structure the transition period where some components use the old synchronous `storage.ts` and others use the new async hooks?

## Recommended Next Task
**ARCH-003 — Define patient-scoped data hooks contract.**
