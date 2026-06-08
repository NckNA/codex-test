# ARCH-063: Aggregator / Read Model Storage Boundary Review

## 1. Files inspected
- `src/data/aggregators/ClinicalSummaryAggregator.ts`
- `src/data/aggregators/PatientListVisitSummaryAggregator.ts`
- `src/data/hooks/usePatientMedicalSummary.ts`
- `src/data/hooks/usePatientListVisitSummary.ts`
- `src/pages/PatientCardPage.tsx`
- `src/pages/PatientsPage.tsx`

## 2. Current direct storage dependencies

### `ClinicalSummaryAggregator.ts`
- **Exact storage imports:**
  `import { storage } from '../../utils/storage';`
- **Exact storage calls:**
  - `storage.getDentalChart(patientId)`
  - `storage.getTreatmentPlans(patientId)`
  - `storage.getChiefComplaint(patientId)`
  - `storage.getFindings(patientId)`
  - `storage.getAppointments()`
- **Data read from storage:**
  Reads dental chart data, treatment plans, chief complaint, clinical findings, and all appointments.

### `PatientListVisitSummaryAggregator.ts`
- **Exact storage imports:**
  `import { storage } from '../../utils/storage';`
- **Exact storage calls:**
  - `storage.getAppointments()`
- **Data read from storage:**
  Reads all appointments to calculate `lastVisit` and `nextVisit` dates for all patients.

## 3. Current consumers

### `ClinicalSummaryAggregator`
- **Consumer:** `src/data/hooks/usePatientMedicalSummary.ts` (Hook), which is used in `src/pages/PatientCardPage.tsx`
- **How result is used:** 
  The `usePatientMedicalSummary` hook provides a `useAsyncQuery` wrapper. `PatientCardPage` uses the returned `dentalSummary`, `lastVisit`, and `nextVisit` for the `PatientOverviewTab`.
- **Sync/Async Expectation:** 
  The hook `useAsyncQuery` abstracts the async nature. The consumer expects an async function, though currently the aggregator logic runs synchronously inside an async wrapper.

### `PatientListVisitSummaryAggregator`
- **Consumer:** `src/data/hooks/usePatientListVisitSummary.ts` (Hook), which is used in `src/pages/PatientsPage.tsx`
- **How result is used:** 
  The `usePatientListVisitSummary` hook fetches a `Record<string, PatientVisitSummary>` mapping. `PatientsPage.tsx` accesses `visitSummaryByPatientId[patient.id]` to display last/next visit dates in the patients table.
- **Sync/Async Expectation:** 
  The hook wraps the aggregator in an async query. The component expects async behavior.

## 4. Data responsibility analysis

### `ClinicalSummaryAggregator`
- **patient identity:** Implicitly used to filter records.
- **appointments:** Used for `lastVisit` and `nextVisit`.
- **chief complaint:** Used for `chiefComplaintText`.
- **dental chart:** Used for `needsTreatment` and `missing` teeth counts.
- **findings:** Used for `highUrgentFindings`, `notIncludedFindings`, and `observingFindings` counts.
- **treatment plans:** Used for `activePlans` count and `totalAmount` calculation.
- **completed services:** Not used here.
- **commercial/status data:** Not used here.
- **UI-only summary data:** Yes, aggregates all of the above into `PatientDentalSummary`.

### `PatientListVisitSummaryAggregator`
- **patient identity:** Groups by `patientId`.
- **appointments:** Exclusively reads this domain.
- **UI-only summary data:** Yes, calculates `lastVisit` and `nextVisit` per patient.

## 5. Migration risk analysis

### `PatientListVisitSummaryAggregator`
- **Risk level:** Low
- **Why:** It only touches one data domain (`appointments`).
- **Possible breakage:** Minimal. Logic is a simple date comparison loop over appointments.
- **Async migration required:** Yes, but the UI is already wrapped in `useAsyncQuery`.
- **UI consumer must change:** No, the hook signature can stay identical.
- **Repository/hook layer exists:** Yes, `AppointmentRepository` already exists.

### `ClinicalSummaryAggregator`
- **Risk level:** High
- **Why:** Highly coupled to 5 different data domains.
- **Possible breakage:** Significant. Moving 5 synchronous storage calls to async repository calls requires handling multiple promises (e.g., `Promise.all`), increasing the risk of partial failures or performance bottlenecks on load.
- **Async migration required:** Yes, UI is already wrapped in `useAsyncQuery`.
- **UI consumer must change:** Unlikely, but the orchestration logic will become significantly more complex.
- **Repository/hook layer exists:** Yes, most repositories exist, but coordinating them safely is complex.

## 6. Recommended first safe migration boundary
**Option A: Migrate PatientListVisitSummaryAggregator first.**

**Justification:**
`PatientListVisitSummaryAggregator` is entirely isolated to the appointments domain. Migrating it to use `AppointmentRepository` is the perfect, low-risk way to establish the pattern for migrating read-models without accidentally breaking cross-domain clinical data. Tackling `ClinicalSummaryAggregator` first would introduce a massive "big bang" migration of 5 different domain reads simultaneously, which violates the slice-by-slice strategy we have used so far.

## 7. Explicit non-goals
- [x] no code migration implemented
- [x] no storage.ts changes
- [x] no hook/repository/orchestrator changes
- [x] no UI changes
- [x] no tests changed
- [x] no domain model v2 implementation
- [x] no browser automation used
- [x] no optional/future tools used

## 8. Suggested next task
**ARCH-064 — Migrate PatientListVisitSummaryAggregator to use AppointmentRepository**
Migrate the `PatientListVisitSummaryAggregator` to fetch data from the existing `AppointmentRepository` instead of directly importing `storage.ts`, serving as the first safe read-model migration while leaving `ClinicalSummaryAggregator` unchanged.
