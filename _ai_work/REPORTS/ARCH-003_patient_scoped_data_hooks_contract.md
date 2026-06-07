# ARCH-003: Patient-Scoped Data Hooks Contract

## Scope
This architecture design report defines the patient-scoped data hooks contract that UI components will use to interact with the underlying Data Access Layer (DAL) defined in ARCH-002. These hooks will fully abstract the Repositories and `localStorage` adapters from the UI components, enforcing a standard structure for asynchronous data fetching, mutations, and derived data calculations. 

## Inputs Reviewed
- `_ai_work/REPORTS/ARCH-001_frontend_storage_data_access_audit.md` (highlighted direct, synchronous UI storage access).
- `_ai_work/REPORTS/ARCH-002_data_access_boundary_repository_interfaces.md` (defined the DAL interfaces returning Promises).
- Current patient UI flows including `PatientCardPage.tsx` and all child tabs (Overview, History, Chart, Findings, Plans).

## Why Hooks / View-Model Layer is Needed
- **UI Decoupling:** UI components should not know whether data comes from `localStorage` or a remote API. They must only care about presentation and user interaction.
- **State Management:** Hooks inherently manage the complex state machine of async requests (`isLoading`, `isError`, `error`, `isMutating`) across re-renders, preventing UI stutter or silent failures.
- **Encapsulation:** By hiding repositories from the UI, hooks can handle cache invalidation, scope injection (tenant/user), and optimistic updates without duplicating logic inside components.

## Standard Hook Result Shape
Every data hook should return a predictable state container:
```typescript
{
  data: T | null;          // The resulting entity or array
  isLoading: boolean;      // True while the initial or refetch request is pending
  isError: boolean;        // True if the request failed
  error: Error | null;     // Error details
  refetch: () => void;     // Function to manually invalidate and refetch data
  isMutating?: boolean;    // True if a mutation (save/update) is actively running
}
```

## Proposed Patient-Scoped Hooks
The following hooks abstract the Medical MVP workflow:
- `usePatient(patientId)`
- `usePatientAppointments(patientId)`
- `usePatientMedicalSummary(patientId)` (derived read-only summary)
- `useDentalChart(patientId)`
- `useChiefComplaint(patientId)`
- `useFindings(patientId)`
- `useTreatmentPlans(patientId)`
- `useTreatmentPlanPreview(patientId, planId)`

*Global/Tenant Scoped Hooks (for non-patient contexts):*
- `useDoctors(scope)` or `useClinicDoctors(scope)`
- `usePatientsList(scope)`
- `useScheduleData(scope)`

## Hook Contract Details
- **`usePatient(patientId)`**: Read-only. Uses `PatientRepository.getPatientById`. Consumed by `PatientCardPage` header and `PatientOverviewTab`.
- **`usePatientAppointments(patientId)`**: Read-only. Uses `AppointmentRepository.listAppointmentsByPatient`. Consumed by `PatientHistoryTab` and the Overview tab for last/next visit calculation.
- **`usePatientMedicalSummary(patientId)`**: Read-only derived data. Uses multiple repositories internally to calculate the "dentalSummary" (active plans, total price, tooth conditions) currently located inside `PatientCardPage`. 
- **`useDentalChart(patientId)`**: Read/Write. Uses `DentalChartRepository`. Exposes `saveToothState` and `saveClinicalPicture`. Consumed by `DentalChartTab`.
- **`useChiefComplaint(patientId)`**: Read/Write. Uses `ChiefComplaintRepository`. Exposes `saveComplaint`. Consumed by `FindingsRisksTab`.
- **`useFindings(patientId)`**: Read/Write. Uses `FindingRepository`. Exposes `createFinding`, `updateFinding`, `markFindingForPlan`. Consumed by `DentalChartTab`, `FindingsRisksTab`, `CreatePlanFromFindingsModal`.
- **`useTreatmentPlans(patientId)`**: Read/Write. Uses `TreatmentPlanRepository`. Exposes `createPlan`, `createPlanFromFindings`, `updatePlan`. Consumed by `TreatmentPlansTab`.

## Mutation Contracts
Mutations are exposed as functions returned by the hooks. Example signatures:

**useChiefComplaint:**
- `saveComplaint(input: ChiefComplaintInput): Promise<void>`

**useDentalChart:**
- `saveToothState(toothNumber: number, state: ToothCondition): Promise<void>`
- `saveClinicalPicture(text: string): Promise<void>`

**useFindings:**
- `createFinding(input: FindingInput): Promise<void>`
- `updateFinding(findingId: string, patch: FindingPatch): Promise<void>`
- `markFindingForPlan(findingId: string, enabled: boolean): Promise<void>`

**useTreatmentPlans:**
- `createPlan(input: PlanInput): Promise<void>`
- `createPlanFromFindings(findingIds: string[]): Promise<void>`
- `updatePlan(planId: string, patch: PlanPatch): Promise<void>`

## Derived Data Strategy
Currently, `PatientCardPage.tsx` synchronously pulls all data and calculates summary objects. 
Moving forward, this will be handled by the `usePatientMedicalSummary(patientId)` hook. This hook will execute the async calls, perform the calculations in a single centralized place, and return the aggregated summary. This isolates performance optimizations and complex array filtering from the render cycle of the UI layer.

## Cache, Refetch, and Invalidation Strategy
Without a library like React Query, the initial hook implementations must manually handle refetching. 
- **After a finding update:** The mutation `updateFinding` should await the repository save, then internally call its own `refetch()` so the `data` object updates. 
- **After treatment plan creation:** The `createPlanFromFindings` mutation must update the plan list, but it also alters findings (marks them as included). Therefore, a global invalidation or event mechanism must signal `useFindings` to `refetch()` as well.
- *Note:* This complexity explicitly highlights why an async state manager (like React Query) will be highly recommended in Phase 2, though we will not introduce it in the very first step.

## Component Migration Map
- `PatientCardPage` -> `usePatient`, `usePatientMedicalSummary`
- `PatientOverviewTab` -> Data passed down from `PatientCardPage`
- `PatientHistoryTab` -> `usePatientAppointments`
- `DentalChartTab` -> `useDentalChart`, `useFindings`
- `FindingsRisksTab` -> `useFindings`, `useChiefComplaint`
- `TreatmentPlansTab` -> `useTreatmentPlans`

## Safe Migration Sequence after ARCH-003
To avoid an all-at-once rewrite of the entire application:
1. **ARCH-004** — Implement the `LocalStorageAdapter` (Repositories) under the hood.
2. Implement the first hook slice (e.g., `useChiefComplaint`) using the adapter.
3. Refactor just one component (`FindingsRisksTab`) to use the hook, leaving everything else alone.
4. Verify functionality, then migrate remaining modules one-by-one.

## What must NOT be implemented yet
- Do NOT implement these hooks in TypeScript code yet.
- Do NOT refactor components yet.
- Do NOT implement a global state manager (React Query, Zustand) in this design phase.
- Do NOT plan a real backend API or database implementation before the UI is fully transitioned to these async hooks.

## Open Questions
- Should cross-hook invalidation (e.g., updating a plan modifies findings) be handled by a lightweight pub/sub event bus in the interim before adopting React Query?
- How should we structure the context provider if `tenantId` and `doctorId` need to be automatically injected into every hook's scope?

## Recommended Next Task
**ARCH-004 — LocalStorageAdapter implementation plan and first safe migration slice.**
