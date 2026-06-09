# ARCH-066: Full Storage Dependency Audit

## 1. Files inspected / search strategy
Performed full recursive repository text searches (`grep_search`) across the entire `src/` directory for the following patterns:
- `utils/storage`
- `\bstorage\.` (regex)
- `getAppointments(`
- `getDentalChart(`
- `getTreatmentPlans(`
- `getChiefComplaint(`
- `getFindings(`

Specific target directories verified:
- `src/components`
- `src/pages`
- `src/data/hooks`
- `src/data/aggregators`
- `src/data/orchestrators`
- `src/data/repositories`

## 2. Full list of remaining storage imports
- `src/data/repositories/AppointmentRepository.ts`
  - **Import:** `import { storage } from '../../utils/storage';`
  - **Classification:** Allowed (Expected storage boundary)
- `src/data/repositories/ChiefComplaintRepository.ts`
  - **Import:** `import { storage } from '../../utils/storage';`
  - **Classification:** Allowed (Expected storage boundary)
- `src/data/repositories/DentalChartRepository.ts`
  - **Import:** `import { storage } from '../../utils/storage';`
  - **Classification:** Allowed (Expected storage boundary)
- `src/data/repositories/DoctorRepository.ts`
  - **Import:** `import { storage } from '../../utils/storage';`
  - **Classification:** Allowed (Expected storage boundary)
- `src/data/repositories/FindingsRepository.ts`
  - **Import:** `import { storage } from '../../utils/storage';`
  - **Classification:** Allowed (Expected storage boundary)
- `src/data/repositories/PatientRepository.ts`
  - **Import:** `import { storage } from '../../utils/storage';`
  - **Classification:** Allowed (Expected storage boundary)
- `src/data/repositories/TreatmentPlansRepository.ts`
  - **Import:** `import { storage } from '../../utils/storage';`
  - **Classification:** Allowed (Expected storage boundary)
- `src/main.tsx`
  - **Import:** `import { storage } from './utils/storage';`
  - **Classification:** Legacy dependency requiring future migration
  - **Why risky:** Directly accesses local storage logic. However, it is used exclusively to call `storage.init()` to seed initial mock data for the prototype environment.

## 3. Full list of remaining storage.* calls
- All `src/data/repositories/*.ts` files call their respective `storage.get...`, `storage.save...`, `storage.add...`, `storage.delete...` methods.
  - **Classification:** Allowed (Expected storage boundary to encapsulate the prototype DAL).
- `src/main.tsx`
  - **Call:** `storage.init();`
  - **Classification:** Allowed during prototype phase.
  - **Why allowed:** It is an initialization seed, not an ongoing data read/write operation bound to UI components.

## 4. Storage dependency map by layer

### UI components
- **Result:** **Clean**
- **Findings:** Zero direct storage imports or calls found.

### Pages
- **Result:** **Clean** (with the exception of the `main.tsx` root entrypoint)
- **Findings:** No `src/pages/*` files import or call `storage.ts`.

### Hooks
- **Result:** **Clean**
- **Findings:** Zero direct storage imports or calls found. Data fetching happens via repositories.

### Aggregators / read-models
- **Result:** **Clean**
- **Findings:** All aggregators (`ClinicalSummaryAggregator`, `PatientListVisitSummaryAggregator`) now successfully depend exclusively on the Repository layer.

### Orchestrators
- **Result:** **Clean**
- **Findings:** Zero direct storage imports or calls found.

### Repositories
- **Result:** Expected storage boundary
- **Findings:** This is the only application layer that communicates with `storage.ts`. This represents a 100% successful implementation of the Repository pattern.

### Utils / storage layer
- **Result:** `src/utils/storage.ts` exists as the centralized LocalStorage implementation mock.

## 5. Confirmed clean modules
Explicitly confirm:
- [x] Treatment Plans UI
- [x] Header
- [x] PatientListVisitSummaryAggregator
- [x] ClinicalSummaryAggregator
- [x] Dental Chart UI 
- [x] Findings UI 
- [x] Schedule UI 

## 6. Remaining migration candidates
**Risk: Low**
- `src/main.tsx`
  - **Why it still depends on storage:** Calls `storage.init()` to ensure local storage has mock seed data on app startup.
  - **Suggested future ARCH task:** Remove `storage.init()` when migrating to a real database backend, as initial data state will be handled server-side.

## 7. Recommended next task
**Option D: Create a backend/database storage migration plan before further code changes.**

**Justification:**
The frontend architecture phase is completely and entirely successful. 100% of the UI, hooks, pages, components, aggregators, and orchestrators are decoupled from the persistence layer. The `storage.ts` file is fully isolated behind Repository interfaces.
Since there are no more frontend storage decoupling tasks needed, the most logical next step is to plan the database architecture (e.g., PostgreSQL / Supabase / Firebase). The Repository interfaces now serve as the exact contract the backend will need to fulfill.

## 8. Explicit non-goals
- [x] no source code changed
- [x] no storage.ts changed
- [x] no repositories changed
- [x] no hooks changed
- [x] no UI changed
- [x] no tests changed
- [x] no browser automation used
- [x] no optional/future tools used
- [x] no backend/database implementation started
