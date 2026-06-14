# RECON-QA-FIXTURES-MULTITENANT-001: Plan Multi-Tenant QA Fixtures

## 1. Summary
This report analyzes the current authentication and tenant architectures to determine the safest and most reliable way to seed QA user fixtures. It recommends a dedicated, committed Node.js script utilizing the `@supabase/supabase-js` Admin API, ensuring robust fixture creation without directly manipulating internal Supabase auth tables via SQL.

## 2. Branch Name
`recon/qa-fixtures-multitenant-001`

## 3. PR URL
[Pending PR creation]

## 4. PR head reviewed before final report update
[Pending PR creation]

## 5. Report update commit
N/A because the final report update commit cannot reference itself before creation.

## 6. Changed files summary
[Pending PR creation]

## 7. Current Auth/Tenant Model
- **AuthContext:** Uses `isSupabaseConfigured` (checks environment variables). If true, it binds to `supabase.auth.getSession()` and `onAuthStateChange`. If false, it falls back to a mocked dev user.
- **TenantContext:** Queries `tenant_users` where `user_id = user.id` to load the `availableTenants` array and defaults `activeTenant` to the first available one.
- **Data Model:** 
  - `auth.users` holds core identity.
  - `profiles(id)` is a 1:1 foreign key relation to `auth.users(id)`. Currently, there are **no triggers** to auto-create profiles.
  - `tenant_users(user_id)` is a many-to-many link referencing `profiles(id)`.
- **Roles:** Defined via the `app_role` ENUM (e.g., `clinic_admin`, `doctor`) and stored on the `tenant_users` row.
- **RLS:** Helper functions (like `get_user_tenants()`) explicitly select from `tenant_users` using `auth.uid()`.

## 8. Existing Local Seed State
Based on `supabase/seed.sql` and post-reset inspection:
- **Demo Clinic A:** `11111111-1111-1111-1111-111111111111`
- **Demo Clinic B:** `22222222-2222-2222-2222-222222222222`
- **Demo Clinic A Dictionary Seed:** 25 diagnoses, 18 works (43 total rows).
- **Demo Clinic B Dictionary Seed:** 0 rows.
- **Auth users / Profiles / Tenant Users:** 0 rows. (They are intentionally omitted from `seed.sql` to avoid committing raw SQL auth insertions).

## 9. Required QA Personas
The exact local/dev personas required to unblock multi-tenant validation:

1. **Demo Clinic A Admin**
   - **Email:** `qa.admin.a@example.local`
   - **Role:** `clinic_admin`
   - **Tenant:** Demo Clinic A
2. **Demo Clinic A Doctor**
   - **Email:** `qa.doctor.a@example.local`
   - **Role:** `doctor`
   - **Tenant:** Demo Clinic A
3. **Demo Clinic B Admin**
   - **Email:** `qa.admin.b@example.local`
   - **Role:** `clinic_admin`
   - **Tenant:** Demo Clinic B
4. **No-tenant User**
   - **Email:** `qa.notenant@example.local`
   - **Role:** None
   - **Tenant:** None
5. **Multi-tenant User**
   - **Email:** `qa.multitenant@example.local`
   - **Roles:** `clinic_admin` (Demo Clinic A), `doctor` (Demo Clinic B)

## 10. Fixture Strategy Comparison

| Strategy | Description | Pros | Cons |
| :--- | :--- | :--- | :--- |
| **A. SQL in `seed.sql`** | Raw `INSERT INTO auth.users ...` using SQL crypto functions. | Integrated directly into `db reset`. | Extremely brittle to internal Supabase auth schema changes. Commits password hashes in SQL. |
| **B. Manual (Studio)** | Create users via Supabase UI manually. | Zero code changes. Safest. | Not repeatable. Causes friction for every developer/QA cycle. |
| **C. Uncommitted Script** | Local JS script in `_ai_work/scratch/`. | No secrets committed. | Fails to share fixtures across the team; prone to drift. |
| **D. Committed JS Script** | A test-only Node script (e.g. `scripts/seed-qa-users.cjs`) using Supabase Admin API. | Robust to schema changes. Source-controlled. Easy to maintain. | Requires running a separate `npm run` command after `db reset`. |

## 11. Recommended Fixture Strategy
**Option D: Committed JS Script.**
A dedicated script (`scripts/seed-qa-users.cjs`) utilizes the official `@supabase/supabase-js` Admin API to safely construct the user lifecycle:
1. `admin.createUser()`
2. Insert into `profiles`
3. Insert into `tenant_users`

**Why:** Earlier scratch scripts failed because they forgot to manually create the `profiles` record, violating foreign keys. Managing this in JS is much safer than raw SQL. By strictly using `@example.local` emails and a universal dummy password (`password123`), the risk of credential leakage is mitigated.

## 12. Exact Next Implementation Task
**TASK ID:** `QA-FIXTURES-MULTITENANT-001A`
**Goal:** Implement the multi-tenant QA fixture script.

**Allowed File Changes:**
- `[NEW] scripts/seed-qa-users.cjs`
- `[MODIFIED] package.json` (add `"seed:qa": "node scripts/seed-qa-users.cjs"`)

**Implementation Steps:**
1. Create the script. It must use `process.env.VITE_SUPABASE_URL` and the local Service Role Key.
2. Iterate the defined QA personas.
3. Call `supabase.auth.admin.createUser({ email, password: 'password123', email_confirm: true })`.
4. Insert into `profiles (id, first_name, last_name)`.
5. Insert into `tenant_users (tenant_id, user_id, role)`.

## 13. Proposed Records
- Password for all: `password123`
- Emails: 
  - `qa.admin.a@example.local`
  - `qa.doctor.a@example.local`
  - `qa.admin.b@example.local`
  - `qa.notenant@example.local`
  - `qa.multitenant@example.local`

## 14. Local-only Safety Rules
- Do NOT commit `.env.local`.
- The script must immediately `throw` or `exit` if run against a production URL (e.g. check if URL includes `localhost` or `127.0.0.1`).
- No real credentials or `.env` files will be modified or committed.

## 15. Validation Plan After Fixtures
1. Reset DB (`npx supabase db reset`) and run `npm run seed:qa`.
2. Login as `qa.admin.a@example.local`: verify MedicalPage lists 43 dictionaries and allows saving.
3. Login as `qa.doctor.a@example.local`: verify read access is granted but saves are blocked by RLS.
4. Login as `qa.admin.b@example.local`: verify MedicalPage has an empty dictionary list (isolation check).
5. Login as `qa.notenant@example.local`: verify app does not crash without an active tenant.
6. Login as `qa.multitenant@example.local`: verify tenant switcher functions and roles adapt correctly.

## 16. Risks and Blockers
- **Tenant Context Empty State:** `TenantContext` and the overall UI might not have resilient "empty states" for users without a tenant (the no-tenant user). This could result in UI crashes requiring subsequent fixes.
- **Empty Dictionaries UX:** Tenant B has 0 dictionaries. The UI may not clearly differentiate between "Loading" and "Empty", which might look like a bug initially but is actually correct.
- **Fixture Maintenance:** The script will need updates if the `profiles` or `tenant_users` schema changes in the future.

## 17. What Was Intentionally NOT Changed
- No source code, migrations, or existing seed files were modified.
- No scripts were implemented.
- No `auth.users` were created.
- This PR remains strictly report-only.

## 18. Checks Run
- `git status --short`: [To be generated]
- `npm run lint`: [To be generated]
- `npm run test -- --run`: [To be generated]
- `npm run build`: [To be generated]
- GitHub Actions CI result: [To be generated]

## 19. Final Verdict
**READY FOR QA-FIXTURES-MULTITENANT-001A**
The analysis is complete, the failure mode of previous scratch scripts has been identified (missing `profiles` insertion), and a safe, repeatable fixture strategy is fully planned.
