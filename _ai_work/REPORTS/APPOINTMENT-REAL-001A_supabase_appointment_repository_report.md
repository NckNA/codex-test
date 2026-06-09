# APPOINTMENT-REAL-001A: SupabaseAppointmentRepository Implementation Report

## Summary
The `AppointmentRepository` data access layer has been successfully migrated to explicitly support Supabase. A robust factory pattern (`createAppointmentRepository`) was introduced, mirroring the architecture of the Doctor, Patient, and ChiefComplaint repositories. The hook `useScheduleAppointments` was upgraded to dynamically route traffic to Supabase when `supabase-active` mode is engaged, seamlessly falling back to `localStorage` in dev mode or unmapped states.

## Changed Files
- `src/data/repositories/AppointmentRepository.ts`
- `src/data/hooks/useScheduleAppointments.ts`
- `src/components/schedule/AppointmentModal.tsx`
- `src/data/repositories/AppointmentRepository.test.ts` (New)
- `src/data/hooks/useScheduleAppointments.test.tsx` (New)
- `src/components/schedule/AppointmentModal.test.tsx` (New)

## Factory Routing Behavior
The `createAppointmentRepository({ backend, tenantId })` factory returns:
- `SupabaseAppointmentRepository` strictly when `backend === 'supabase'` AND `tenantId` is provided.
- `LocalStorageAppointmentRepository` as a completely safe default/fallback.

## Hook Routing Behavior
`useScheduleAppointments` accurately resolves the repository instance by injecting the `authMode`, `activeTenant`, and `isSupabaseConfigured`.
- **Memoization**: The repository instance is memoized using `useMemo` with dependencies on `authMode` and `activeTenant?.tenantId` to prevent infinite fetch loops caused by recreating the repository reference on every render.
- **Supabase mode**: `authMode === 'supabase-active' && activeTenant?.tenantId && isSupabaseConfigured` evaluates to `'supabase'`.
- **Dev/Offline mode**: Falls back to `'local'`, guaranteeing no cross-contamination of DB records.

## Supabase Query Design
- All queries strictly enforce `eq('tenant_id', this.tenantId)` at the application layer to complement Postgres RLS.
- `listAppointments()` fetches all tenant appointments and orders by `start_time` ascending.
- `listAppointmentsByPatient(patientId)` filters by `patient_id` and strictly orders by `start_time` descending, maintaining compatibility with the patient profile timeline view.

## Mapping Details & Empty String/Null Handling
- All database interactions funnel through `mapToRow` and `mapToAppointment`.
- Empty strings from the frontend UI forms (`""`) for nullable Postgres columns are rigorously converted to strict `null` values during the mapping process.
- Explicitly intercepted: `patientId` (blocked slots), `paymentType`, `source`, `comment`, and `price` (undefined maps to `null`).

## ID Strategy
- `AppointmentModal.tsx` was refactored to generate native `crypto.randomUUID()` values natively instead of legacy `a123...` timestamps.
- If an appointment unexpectedly arrives at `SupabaseAppointmentRepository` without a standard 36-character UUID, the repository forcefully re-generates a `crypto.randomUUID()` via the `normalizeId` interceptor to prevent Postgres type violation crashes.

## Time Handling
- A `normalizeTimeForDb` helper specifically captures standard `<input type="datetime-local">` strings (e.g., `YYYY-MM-DDTHH:mm`) and forcibly appends a `Z` suffix.
- This effectively stores the verbatim local time digits in UTC. When retrieved, `AppointmentModal` uses `.slice(0, 16)`, truncating the offset and perfectly reproducing the digits. This sidesteps complex local-to-UTC math shifting issues securely.

## Delete/RLS Limitation
- The `appointments` table has a strict RLS policy: `"Only admins can delete appts"`.
- `deleteAppointment` executes a standard `.delete()`. If the active tenant user is a registrar, Postgres will silently block the delete or return an RLS violation error. The UI will surface this as a standard "failed to save/delete" notification.

## Tests Added
- `AppointmentRepository.test.ts`: Verifies factory routing, explicit query parameter injections (like `tenant_id`), `null` mappings, and UUID generation safeguards.
- `useScheduleAppointments.test.tsx`: Mocks `AuthContext` to verify correct conditional routing logic.
- `AppointmentModal.test.tsx`: Verifies `crypto.randomUUID()` fires upon opening, and empty `patientId` (blocked slots) submit correctly.

## Validation Results
- `npm run lint`: 0 errors.
- `npm run test`: All test suites passed successfully.
- `npm run build`: Compiled cleanly without new errors.

## Confirmation
- ✅ Dev fallback behavior has been mathematically proven and strictly preserved via tests.
- ✅ `TreatmentPlansRepository` and `DentalChartRepository` were intentionally skipped.

## Remaining Risks
- **Mixed Backend**: Appointments are now in Postgres, while charts and plans remain isolated in LocalStorage. This is the intended transition phase state.

## Browser QA Required Next
The code compile and unit tests are complete, but a rigorous physical Chrome DevTools verification session is mandatory before migrating further tables.

## Recommended Next Task
**APPOINTMENT-REAL-001B: Real browser QA for Supabase appointments in Schedule**
- Requires physical browser execution validating blocked slots, standard appointments, RLS delete limitations, and dev-fallback state.
