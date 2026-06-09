# ARCH-075: Repository Adapter Boundary Design Report

## Summary
This report analyzes the current data layer of the application and proposes a minimal, safe adapter boundary to prepare for Supabase migration. The core challenge is that the current repositories are static singletons that cannot access the `TenantContext`, which is strictly required for Supabase RLS. We evaluated multiple dependency injection patterns and recommend a **Repository Factory** approach, allowing us to migrate one repository at a time without breaking the rest of the application.

## Files Inspected
- `src/data/repositories/*`
- `src/data/hooks/*`
- `src/contexts/AuthContext.tsx`
- `src/contexts/TenantContext.tsx`
- `_ai_work/REPORTS/RECON-074_auth_tenant_wiring_readiness_report.md`

## 1. Current Repository Structure
The application currently defines 7 repositories exported as static singleton objects:
1. `AppointmentRepository`
2. `ChiefComplaintRepository`
3. `DentalChartRepository`
4. `DoctorRepository`
5. `FindingsRepository`
6. `PatientRepository`
7. `TreatmentPlansRepository`

None of these repositories currently possess a concept of `tenant_id`.

### Hook-to-Repository Dependency Map

| Hook File | Imported Repository | Risk Level | Pilot Candidate |
|---|---|---|---|
| `useChiefComplaint.ts` | `ChiefComplaintRepository` | LOW | **YES (Recommended)** |
| `useClinicDoctors.ts` | `DoctorRepository` | MEDIUM | NO |
| `useDentalChart.ts` | `DentalChartRepository` | HIGH | NO |
| `usePatientAppointments.ts` | `AppointmentRepository` | HIGH | NO |
| `usePatientFindings.ts` | `FindingsRepository` | HIGH | NO |
| `usePatientProfile.ts` | `PatientRepository` | HIGH | NO |
| `usePatientsCollection.ts` | `PatientRepository` | HIGH | NO |
| `useScheduleAppointments.ts`| `AppointmentRepository` | HIGH | NO |
| `useTreatmentPlans.ts` | `TreatmentPlansRepository` | HIGH | NO |

**Risk Assessment:**
- **HIGH RISK**: `PatientRepository`, `AppointmentRepository` (Central to CRM, Schedule, and Routing).
- **HIGH RISK**: `DentalChartRepository`, `TreatmentPlansRepository`, `FindingsRepository` (Complex JSON-like data structures, heavy UI coupling).
- **MEDIUM RISK**: `DoctorRepository` (Simple data, but heavily used in Scheduling filters).
- **LOW RISK**: `ChiefComplaintRepository` (Simple text/string payload, isolated entirely to the Medical tab of a specific patient).

## 2. Adapter Boundary Options

### Option A: `RepositoryProvider` (React Context)
Create a `<RepositoryProvider>` that wraps the app. It consumes `useTenant()` and exposes pre-instantiated repositories to the app via `useRepositories()`.
- **Pros**: Clean dependency injection. Hooks don't need to manually pass `tenant_id`.
- **Cons**: High boilerplate. Requires rewriting *all* hooks and *all* repositories at once to avoid a messy dual-state.
- **Verdict**: Rejected due to high "big bang" rewrite risk.

### Option B: Repository Factory Functions
Refactor repositories to export a factory function: `create[Name]Repository(tenantId?: string)`. React hooks pull `tenant_id` via `useTenant()` and memoize the repository instance.
- **Pros**: Can be implemented **one repository at a time**. The factory decides whether to return a LocalStorage implementation (if no `tenantId` or in dev mode) or a Supabase implementation. Repositories remain completely unaware of React.
- **Cons**: Requires adding `useTenant()` and `useMemo()` to every hook that is migrated.
- **Verdict**: **Recommended**. It perfectly isolates the migration safely.

### Option C: Global Service Locator
A centralized registry (e.g., `Registry.getRepo('Patient', tenantId)`).
- **Pros**: Centralized instance management.
- **Cons**: Loses strict TypeScript interfaces easily. Harder to tree-shake.
- **Verdict**: Rejected as overkill.

## 3. Recommended Architecture: Option B (Factory Pattern)
The minimal safe boundary is to convert the static singleton usage in a target hook into a factory instantiation.

**Example Design:**
```typescript
// In repository file
export function createChiefComplaintRepository(tenantId?: string): IChiefComplaintRepository {
  // Future: if (tenantId && !isDev) return new SupabaseChiefComplaintRepository(tenantId);
  return LocalStorageChiefComplaintRepository;
}

// In hook file
export function useChiefComplaint(patientId: string) {
  const { activeTenant } = useTenant();
  
  const repo = useMemo(() => {
    return createChiefComplaintRepository(activeTenant?.tenantId);
  }, [activeTenant?.tenantId]);

  const queryFn = useCallback(() => repo.getChiefComplaint(patientId), [repo, patientId]);
  // ...
}
```
This satisfies all requirements:
- Repositories avoid React hooks.
- Hardcoded tenant IDs are avoided.
- Current `localStorage` continues working.
- Allows a single repository to be migrated independently.

## 4. First Pilot Candidate
**Candidate**: `ChiefComplaintRepository`
- **Why**: As seen in the dependency map, it handles a very simple flat object tied to one `patientId`. It is consumed by exactly one hook (`useChiefComplaint`) and rendered in exactly one isolated component (the Medical page). If it breaks, it does not prevent scheduling, patient creation, or CRM workflows.

*Note: `PatientRepository` and `AppointmentRepository` MUST NOT be first. They are structurally critical to the entire application.*

## 5. Explicit "Do NOT do yet"
- **DO NOT** rewrite all repositories to use the factory at once.
- **DO NOT** implement Supabase logic inside the factory yet. We must validate the factory boundary with `localStorage` first.
- **DO NOT** use `PatientRepository` for the pilot.

## 6. Final Verdict
- **READY** for adapter boundary implementation (via Factory pattern).
- **READY** for first repository pilot (`ChiefComplaintRepository`).
- **NOT READY** for Supabase repository migration (Adapter boundary must be built and tested with `localStorage` first).

---

## 7. Proposed Next Implementation Task

**Task**: ARCH-076: Implement Repository Adapter Boundary for Pilot
**Prompt for Coordinator/AI**:
```text
ARCH-076: Implement Repository Adapter Boundary for Pilot

Goal:
Implement the factory adapter boundary designed in ARCH-075 for exactly ONE pilot repository (`ChiefComplaintRepository`) using ONLY the `localStorage` implementation.

Primary objective:
1. Refactor `ChiefComplaintRepository.ts` to export a `createChiefComplaintRepository(tenantId?: string)` factory.
2. Ensure it returns the existing `LocalStorageChiefComplaintRepository`.
3. Update `useChiefComplaint.ts` to import `useTenant` from `TenantContext` and instantiate the repository using `useMemo`.
4. Do NOT implement Supabase yet.
5. Verify the Medical > Chief Complaint UI still works via tests/build.

Allowed files:
- src/data/repositories/ChiefComplaintRepository.ts
- src/data/hooks/useChiefComplaint.ts

Forbidden:
- Do not migrate to Supabase.
- Do not touch other repositories.
- Do not change UI components.
```
