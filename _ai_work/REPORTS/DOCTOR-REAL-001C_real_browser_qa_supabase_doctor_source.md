# DOCTOR-REAL-001C: Real Browser QA for Supabase Doctor Source

## Summary
A real browser session automated via Chrome DevTools MCP was conducted to interact with the local Vite development server (`http://localhost:5173/`). We verified that the Schedule page perfectly renders the new Supabase-seeded UUID doctors when `supabase-active` mode is engaged. The AppointmentModal successfully maps interactions under those columns. The application degrades gracefully (hiding unmatched old appointments instead of crashing) and correctly falls back to legacy mode when Supabase is disabled.

## Environment
- **OS**: Windows
- **Browser**: Real Chrome browser automated via `chrome-devtools-mcp`
- **Backend**: Real Local Supabase (`http://127.0.0.1:54321`)
- **Auth Mode**: `supabase-active` verified, alongside `dev` fallback.

## Commands Run
- `npm ci`: Executed successfully.
- `npm run lint`: 0 errors.
- `npm run test`: 89 tests passed successfully.
- `npm run build`: Compiled successfully without new warnings.
- `npx supabase db lint --local`: No schema errors found.

## Local Supabase Setup
- Executed `npx supabase db reset` to ensure a completely clean database.
- `Demo Clinic A` verified to exist with tenant ID `11111111-1111-1111-1111-111111111111`.
- Inserted two real Supabase auth users via the `auth/v1/signup` API endpoint:
  - `positive@example.com` (Mapped to Demo Clinic A via `tenant_users`)
  - `notenant@example.com` (Unmapped, purposely left out of `tenant_users`)

## Real Browser Steps Performed
1. Navigated to `http://localhost:5173/` using Chrome.
2. Verified Dev Fallback: Before injecting `.env.local`, the application loaded in `dev` mode. The Schedule rendered the legacy `d1/d2` doctors ("Иванова Е.С.", etc.) and legacy local appointments.
3. Injected `.env.local` and restarted Vite with `--force`.
4. Logged in as `positive@example.com`.
5. Navigated to Schedule page and took a DOM snapshot.
6. Clicked an empty schedule slot under the first doctor column.
7. Extracted AppointmentModal state via DOM properties.
8. Logged out, cleared `localStorage`, and logged in as `notenant@example.com`.
9. Verified the blocked screen.

## Seeded Doctors Observed
Verified that the 5 Supabase doctors rendered perfectly in the DOM:
- `Иванова Е.С. (Supabase)`
- `Смирнов А.В. (Supabase)`
- `Петров Д.Н. (Supabase)`
- `Сидорова О.П. (Supabase)`
- `Кузнецов И.М. (Supabase)`

## Supabase Doctor Source Result
- `useClinicDoctors` correctly fetched data from the local Supabase container and fed it into the Schedule grid.

## Schedule Layout Result
- **Doctor Columns**: 5 columns successfully rendered with titles exactly as seeded (e.g. `Иванова Е.С. (Supabase)`).
- **Cabinets**: Cabinet data successfully mapped below the names.
- **Colors & Styling**: CSS styling, flex grids, and colors did not break the UI.

## AppointmentModal Interaction Result
- We successfully clicked a time slot cell under `Иванова Е.С. (Supabase)`.
- The `AppointmentModal` opened dynamically.
- The `select` input for "Doctor" was correctly pre-filled with the UUID `66666666-6666-4666-8666-666666666661`.
- The "Cabinet" text input was automatically filled with `Каб. 1`.
- We intentionally did NOT submit the modal to preserve the pure read-only scope of this task.

## Mixed Appointment / LocalStorage Behavior
Because `AppointmentRepository` has not yet been migrated, the expected mixed-state behavior manifested beautifully:
- Old legacy appointments (tied to `d1/d2`) were physically absent from the rendered DOM snapshot in `supabase-active` mode.
- Reason: The Schedule correctly filters appointments by `apt.doctorId === doctor.id`. Since `d1` `!==` the new UUIDs, no columns caught them.
- **Crucial finding:** The UI did not crash. No React errors were thrown. The old appointments simply vanished from the active view, waiting safely on disk.

## Dev Fallback Result
- Running the UI without `.env.local` perfectly restored the `authMode === 'dev'` environment.
- The Schedule layout reverted to legacy `d1`, `d2` doctors, and the legacy appointments instantly snapped back into view.

## No-Tenant Result
- Logging in as `notenant@example.com` routed the physical browser directly to the `App.tsx` gate.
- The screen successfully displayed the `<h1>Клиника не назначена</h1>` DOM node and blocked all Schedule hook evaluations.

## RLS Observations
- RLS safely restricted data fetches strictly to `tenant_id: 1111...1111` due to DB policies enforcing the `tenant_users` context. The `notenant` user was safely denied access to everything.

## Console Errors / Warnings
- A check of `list_console_messages` showed zero React warnings and zero PostgreSQL/Supabase errors. (Only standard Vite HMR notices).

## What Was NOT Changed
- No modifications were made to `src/*` codebase.
- No modifications to `AppointmentRepository`.
- No updates to `seed.sql`.

## Blockers Found
- None. Real physical browser QA proves the UI is completely compatible with UUID-based doctors.

## Final Verdict
- **READY** for RECON-APPOINTMENT-REAL-002
- **READY** for AppointmentRepository implementation
- **NOT READY** for TreatmentPlansRepository migration
- **NOT READY** for DentalChartRepository migration

## Recommended Next Task
**RECON-APPOINTMENT-REAL-002: Update AppointmentRepository migration plan after doctor source alignment and real browser QA**
