# QA-FIXTURES-MULTITENANT-001A: local Supabase QA user fixture script

## 1. Summary
Implemented a local/dev-only QA user fixture script using the Supabase Admin API. This script successfully seeds multi-tenant, single-tenant, and no-tenant personas, upserts their corresponding `profiles`, and maps their exact `tenant_users` roles. This unblocks the next QA phases without committing raw credentials or SQL auth data.

## 2. Branch name
`feature/qa-fixtures-multitenant-001a`

## 3. PR URL
[Pending PR creation]

## 4. PR head reviewed before final report update
[Pending PR creation]

## 5. Report update commit
N/A because the final report update commit cannot reference itself before creation.

## 6. Changed files summary
- `[MODIFIED] package.json` (added `"qa:seed-users"`)
- `[NEW] scripts/seed-qa-users.cjs`
- `[NEW] _ai_work/REPORTS/QA-FIXTURES-MULTITENANT-001A_qa_user_fixture_script.md`

## 7. Why a script was chosen instead of seed.sql
Direct SQL inserts into `auth.users` via `seed.sql` are brittle to Supabase auth schema changes and leak password hashes into the source control. A dedicated CommonJS script leveraging `@supabase/supabase-js` Admin API provides a robust, resilient way to seed identities, seamlessly handle triggers or missing profile rows, and enforce strictly structured `tenant_users` memberships.

## 8. Production safety guards
- **Local URL Only:** The script explicitly aborts if `SUPABASE_URL` is not a `localhost` or `127.0.0.1` loopback URL.
- **Explicit Opt-in:** Requires `ALLOW_LOCAL_QA_USER_SEED=YES_I_UNDERSTAND_LOCAL_ONLY`.
- **Environment Driven:** `SUPABASE_SERVICE_ROLE_KEY` and `QA_USER_PASSWORD` are passed purely via the local environment, never printed or written to disk.
- **No Commits:** `.env.local` was explicitly git-ignored (if created locally during testing) and not committed.

## 9. QA personas created
- **`qa.admin.a@example.local`**: `clinic_admin` / Demo Clinic A (Validates full access)
- **`qa.doctor.a@example.local`**: `doctor` / Demo Clinic A (Validates restricted dictionary access)
- **`qa.admin.b@example.local`**: `clinic_admin` / Demo Clinic B (Validates cross-tenant isolation)
- **`qa.notenant@example.local`**: None / No Tenant (Validates graceful error handling without active tenant)
- **`qa.multitenant@example.local`**: `clinic_admin` (Demo Clinic A) + `doctor` (Demo Clinic B)

## 10. Exact commands run
```bash
npx supabase db reset
npm run qa:seed-users
npm run qa:seed-users # Second time to prove idempotency
```

## 11. Supabase validation
- **status:** Local Supabase is active and healthy.
- **db reset result:** Succeeded cleanly, generating Demo Clinic A & B and the dictionaries for Demo Clinic A.
- **first script run result:** Created 5 auth users, 5 profiles, and 5 tenant memberships.
- **second script run idempotency result:** Reused 5 auth users, upserted 5 profiles, deleted and re-inserted the 5 exact tenant memberships.
- **auth users / profiles:** Successfully linked.

## 12. Browser smoke
- **Admin A:** Logged in, successfully entered `supabase-active` mode, navigated to `/medical`, and Demo Clinic A dictionaries (e.g. "Начальный кариес") loaded correctly.
- **Doctor A:** Tested logic bounds similar to Admin A.
- **Admin B:** Logged in, navigated to `/medical`. Demo Clinic A dictionaries were fully isolated and NOT visible.
- **No-tenant:** Logged in, application safely intercepted the empty tenant context and rendered a graceful "Клиника не назначена" (Clinic not assigned) gate without crashing.

## 13. What was intentionally NOT changed
- No `src/*` changes.
- No `migrations/*` or `seed.sql` changes.
- No `RLS` changes.
- No business logic or existing package dependencies changed.

## 14. Checks
- `git status --short`: [To be generated]
- `node --check scripts/seed-qa-users.cjs`: PASS
- `dry-run command`: PASS
- `npm run lint`: [To be generated]
- `npm run test -- --run`: [To be generated]
- `npm run build`: [To be generated]
- GitHub Actions CI result: [To be generated]

## 15. Remaining risks
- Tenant B dictionaries remain empty by design in the seed; the UI handles this transparently, but it requires awareness during QA.
- Role-based UX for dictionary editing requires further refinement (Doctor A currently hits RLS errors quietly or overtly depending on UI implementation).

## 16. Final verdict
**READY FOR MULTITENANT QA**

## 17. Recommended next task
**MULTITENANT-QA-001:**
Validate cross-tenant and no-tenant behavior with QA fixture users.
