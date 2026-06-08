# ARCH-032: PatientListVisitSummaryAggregator Contract Design

## 1. Title
ARCH-032 — Design read-only PatientListVisitSummaryAggregator / usePatientListVisitSummary contract.

## 2. Scope
This document designs the contract for abstracting the appointment-derived `lastVisit`/`nextVisit` calculation from `PatientsPage` into a dedicated aggregator and hook. This will sever the last direct `storage.getAppointments()` dependency in `PatientsPage` without expanding `PatientRepository` and without prematurely initiating a massive `SchedulePage` migration.

## 3. Inputs Reviewed
- `_ai_work/REPORTS/ARCH-031_review_patients_page_dal_and_appointment_summary_boundary.md`
- `src/pages/PatientsPage.tsx`
- `src/data/repositories/AppointmentRepository.ts`
- `src/data/hooks/usePatientAppointments.ts`
- `src/data/aggregators/ClinicalSummaryAggregator.ts`
- `src/data/hooks/usePatientMedicalSummary.ts`
- `src/data/hooks/useAsyncQuery.ts`
- `src/utils/storage.ts`
- `src/types/index.ts`

## 4. Current PatientsPage last/next visit behavior
`PatientsPage` calculates `lastVisit` and `nextVisit` directly in a `useMemo` hook using `storage.getAppointments()`. It fetches all appointments, ignores blocked/cancelled ones and those missing a `patientId`, and maps the closest past and future appointments to each `patientId` by relying on ascending chronological sorting.

## 5. Existing appointment/data access state
- `AppointmentRepository` focuses on CRUD operations and schedule presentation, not patient list cross-domain summaries.
- Modifying `AppointmentRepository` to serve `PatientsPage` would mix concerns.
- `ClinicalSummaryAggregator` provides a solid existing precedent for abstracting cross-domain read-only calculations.

## 6. Aggregator Design Options
- **Option 1:** Add method to `PatientRepository`. *Rejected* because `PatientRepository` should not depend on schedule data.
- **Option 2:** Add method to `AppointmentRepository`. *Rejected* because the shape of the data is specifically tailored to the patient list UI, not standard appointment querying.
- **Option 3:** Create `PatientListVisitSummaryAggregator`. *Recommended* because it cleanly isolates the join logic and allows safe local-storage manipulation now, and an easy backend endpoint swap later.

## 7. Recommended Aggregator Contract
**File:** `src/data/aggregators/PatientListVisitSummaryAggregator.ts`
```typescript
import { storage } from '../../utils/storage';

export interface PatientVisitSummary {
  lastVisit?: Date;
  nextVisit?: Date;
}

export type PatientVisitSummaryByPatientId = Record<string, PatientVisitSummary>;

export const PatientListVisitSummaryAggregator = {
  async getVisitSummaryByPatientId(now = new Date()): Promise<PatientVisitSummaryByPatientId> {
    // Exact algorithm from PatientsPage.tsx
  }
};
```
*Note: The `now` parameter allows testing determinism.*

## 8. Recommended Output Types
- `PatientVisitSummary`: `{ lastVisit?: Date; nextVisit?: Date }`
- `PatientVisitSummaryByPatientId`: `Record<string, PatientVisitSummary>`

## 9. Exact Calculation Rules
To ensure absolutely no behavioral changes:
1. Load all appointments (via `storage.getAppointments()` internally).
2. Sort appointments ascending by start date (`new Date(a.start).getTime() - new Date(b.start).getTime()`).
3. Skip any appointment where `!appt.patientId`.
4. Skip any appointment where `appt.status === 'blocked'` or `appt.status === 'cancelled'`.
5. Iterate through the sorted list:
   - Convert `appt.start` to a `Date` object (`apptDate`).
   - If `apptDate < now`: set `lastVisit = apptDate`. (Because of ascending sort, later past appointments overwrite earlier ones, leaving the most recent).
   - If `apptDate >= now`: set `nextVisit = apptDate` **only if** `nextVisit` is not already set. (Because of ascending sort, the first future appointment encountered is the nearest).
6. Return the `Record<string, PatientVisitSummary>`.

## 10. Recommended Hook Contract
**File:** `src/data/hooks/usePatientListVisitSummary.ts`
```typescript
import { useCallback } from 'react';
import { useAsyncQuery } from './useAsyncQuery';
import { PatientListVisitSummaryAggregator, PatientVisitSummaryByPatientId } from '../aggregators/PatientListVisitSummaryAggregator';

export function usePatientListVisitSummary() {
  const queryFn = useCallback(
    () => PatientListVisitSummaryAggregator.getVisitSummaryByPatientId(),
    []
  );

  const { data, isLoading, isError, error, refetch } = useAsyncQuery<PatientVisitSummaryByPatientId>({
    queryFn,
    initialData: {},
    enabled: true,
  });

  return {
    visitSummaryByPatientId: data || {},
    isLoading,
    isError,
    error,
    refetch,
  };
}
```

## 11. Loading/Error/Refetch Behavior
- The hook will use the object-style API of `useAsyncQuery`.
- `initialData` will be an empty object `{}`.
- `enabled` is `true` unconditionally.
- Standard query states (`isLoading`, `isError`, `error`, `refetch`) will be exposed.
- In `PatientsPage`, these states can be safely ignored for the MVP because the visits data is supplementary and shouldn't block rendering the patient table. If it errors, visit columns just show `-`.

## 12. LocalStorage Implementation Boundary
The aggregator `PatientListVisitSummaryAggregator` is permitted to import and use `storage.getAppointments()` directly in its MVP implementation. This isolates the violation inside a dedicated boundary, officially severing `PatientsPage` from direct `storage.ts` usage.

## 13. Future Backend Compatibility
When migrating to a backend, this entire aggregator will simply hit a new endpoint: `GET /api/patients/visit-summaries`. The frontend hook and UI components will remain unchanged.

## 14. What Must NOT be Changed in ARCH-033
- Do **NOT** modify `SchedulePage`.
- Do **NOT** modify `AppointmentRepository` or `usePatientAppointments`.
- Do **NOT** modify appointment mutation logic.
- Do **NOT** modify `PatientRepository` or `usePatientsCollection`.
- Do **NOT** introduce React Query, Redux, Zustand, Event Bus, Context, or global caching.
- Do **NOT** use `useAsyncMutation`.

## 15. Acceptance Criteria for Future ARCH-033
- `PatientListVisitSummaryAggregator` is implemented precisely as designed.
- `usePatientListVisitSummary` is implemented precisely as designed.
- `PatientsPage` is refactored to use `usePatientListVisitSummary` instead of calculating visits internally.
- `PatientsPage` no longer imports `storage` (all direct calls are gone).
- Patient list table correctly displays `lastVisit` and `nextVisit` identical to previous behavior.
- Lint and build pass successfully.

## 16. Recommended Next Task
**ARCH-033 — Implement PatientListVisitSummaryAggregator and usePatientListVisitSummary, then integrate PatientsPage.**

---
### Explicit Architecture Questions Answered
- **Is ARCH-032 implementation or design?** Design only.
- **Should `src/` be changed in ARCH-032?** No.
- **Should `PatientsPage` be changed in ARCH-032?** No.
- **Should `AppointmentRepository` be changed in ARCH-032?** No.
- **Should `SchedulePage` be changed in ARCH-032?** No.
- **Should `PatientRepository` be changed in ARCH-032?** No.
- **Should appointment mutations be touched?** No.
- **What is the aggregator name?** `PatientListVisitSummaryAggregator`.
- **What is the hook name?** `usePatientListVisitSummary`.
- **What is the output shape?** `PatientVisitSummaryByPatientId` (a `Record<string, { lastVisit?: Date; nextVisit?: Date }>`).
- **Should the aggregator be read-only?** Yes.
- **Should appointment-derived data be moved into `PatientRepository`?** No.
- **Should SchedulePage migration happen next?** No.
- **Should the hook use `useAsyncQuery` object-style API?** Yes.
- **Should current lastVisit/nextVisit behavior be preserved exactly?** Yes.
- **What should ARCH-033 implement?** `PatientListVisitSummaryAggregator`, `usePatientListVisitSummary`, and the integration into `PatientsPage`.
