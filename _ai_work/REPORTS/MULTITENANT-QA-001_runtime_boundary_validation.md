# MULTITENANT-QA-001: Cross-Tenant and No-Tenant Runtime Boundary Validation

## 1. Summary
Real browser QA validating cross-tenant data isolation and no-tenant runtime boundary using local Supabase with seeded QA fixture users. All five personas tested. Core isolation requirements PASS. Two low-severity UX observations noted.

## 2. Branch name
`qa/multitenant-runtime-boundary-001`

## 3. PR URL
N/A (report-only PR)

## 4. PR head reviewed before final report update
N/A

## 5. Report update commit
N/A because the final report update commit cannot reference itself before creation.

## 6. Environment

| Item | Value |
| :--- | :--- |
| Local Supabase CLI | v2.105.0 |
| Local API URL | http://127.0.0.1:54321 |
| Vite dev server | http://localhost:5173/ |
| Auth mode at test time | supabase-active (.env.local with local anon key) |
| DB reset branch | qa/multitenant-runtime-boundary-001 |
| Seed state after reset | Demo Clinic A: 25 diagnoses + 18 works = 43 rows; Demo Clinic B: 0 rows |

## 7. QA fixture users

| Email | Role | Tenant | DB confirmed |
| :--- | :--- | :--- | :--- |
| qa.admin.a@example.local | clinic_admin | Demo Clinic A | YES |
| qa.doctor.a@example.local | doctor | Demo Clinic A | YES |
| qa.admin.b@example.local | clinic_admin | Demo Clinic B | YES |
| qa.notenant@example.local | none | None | YES |
| qa.multitenant@example.local | clinic_admin (Clinic A) + doctor (Clinic B) | Both | YES |

Seed idempotency confirmed: second run reused all 5 users, upserted profiles, reset memberships cleanly.

## 8. Validation matrix results

### Persona 1: qa.admin.a (Demo Clinic A admin) - PASS

| Check | Expected | Result |
| :--- | :--- | :--- |
| Login | Supabase auth success | PASS |
| Schedule shows | Demo Clinic A doctors with (Supabase) suffix | PASS |
| No Clinic B data in schedule | Correct | PASS |
| /medical loads dictionaries | 25 diagnoses + 18 works = 43 total | PASS |
| Dictionary filter works | Shows exactly 25 diagnoses when filtered | PASS |
| /patients loads | John Doe, Jane Smith (Clinic A seed) visible | PASS |
| No Clinic B patients visible | Confirmed | PASS |
| Patient dental chart tab | Empty chart, 0 active problems (Supabase backend, not localStorage) | PASS |
| Patient findings tab | Empty findings, no localStorage demo data | PASS |
| Console errors | Accessibility warnings only (pre-existing), no fetch errors | PASS |
| Logout | Returns to login screen | PASS |

### Persona 2: qa.doctor.a (Demo Clinic A doctor) - PASS with observations

| Check | Expected | Result |
| :--- | :--- | :--- |
| Login | Supabase auth success | PASS |
| /medical dictionaries | 25 diagnoses + 18 works (Clinic A) | PASS |
| No Clinic B data | Confirmed | PASS |
| Role label in header | Shows "Администратор" instead of "Доктор" | OBSERVATION Bug #1 (LOW) |
| Edit/Disable buttons visible | Buttons visible for Doctor role (should be read-only) | OBSERVATION Bug #2 (LOW) |

### Persona 3: qa.admin.b (Demo Clinic B admin) - PASS (cross-tenant isolation confirmed)

| Check | Expected | Result |
| :--- | :--- | :--- |
| Login | Supabase auth success | PASS |
| Schedule shows | Empty columns - no doctors in Clinic B | PASS |
| /medical dictionaries | "Ничего не найдено" - 0 rows | PASS |
| Clinic A dictionaries NOT visible | Confirmed - 43 Clinic A rows completely invisible | PASS |
| /patients | "Пациенты не найдены" - 0 patients | PASS |
| Clinic A patients NOT visible | John Doe and Jane Smith NOT visible | PASS |

### Persona 4: qa.notenant (no tenant user) - PASS (boundary enforcement confirmed)

| Check | Expected | Result |
| :--- | :--- | :--- |
| Login | Supabase auth success | PASS |
| App renders | "Клиника не назначена" gate dialog appears immediately | PASS |
| No app content visible | No schedule, no patients, no dictionaries | PASS |
| No localStorage/demo data shown | Gate blocks all content | PASS |
| Direct URL /medical bypass attempt | Gate still shown, not bypassed | PASS |
| No tenant-scoped API calls fired | Zero calls to clinical_dictionary_items, patient_findings, dental_chart, tooth_state | PASS |
| Logout button in gate | "Выйти" visible and functional | PASS |

### Persona 5: qa.multitenant (multi-tenant user) - PASS

| Check | Expected | Result |
| :--- | :--- | :--- |
| Login | Supabase auth success | PASS |
| Default tenant | Demo Clinic A (first in availableTenants) | PASS |
| /medical shows | 25 diagnoses + 18 works (Clinic A) | PASS |
| DB confirms 2 memberships | clinic_admin/Demo Clinic A + doctor/Demo Clinic B | PASS |
| Tenant switcher UI | Not yet implemented (future roadmap) | EXPECTED / NOT A BUG |
| No crash | Correct | PASS |

## 9. Observations

### Bug #1 (LOW): Role label shows "Администратор" for all roles
- Observed: Doctor A header shows "Администратор" instead of "Доктор"
- Impact: UI cosmetic only; RLS still enforces correct permissions server-side
- Status: Out of scope for this QA task

### Bug #2 (LOW): Edit/Disable buttons visible to Doctor role on /medical
- Observed: Doctor A sees Редактировать/Отключить buttons on dictionary items
- Expected: Doctor role should see read-only dictionary view
- Impact: UX permission gap; actual write protection still enforced by Supabase RLS
- Note: Previously documented in QA-FIXTURES-MULTITENANT-001A report (section 15)
- Status: Out of scope for this QA task; requires a separate role-based UI gating task

### Known (not a bug): Static "Режим прототипа" banner in Supabase-active mode
- The banner still shows even in supabase-active mode
- Impact: UX confusion only; no security implications
- Status: Static component not yet conditioned on authMode

## 10. DB verification

```
-- Auth users: 5 confirmed
SELECT COUNT(*) FROM auth.users; --> 5

-- Clinical dictionary split (Demo Clinic A only):
SELECT type, COUNT(*) FROM clinical_dictionary_items GROUP BY type;
--> diagnosis: 25, work: 18

-- Multitenant memberships:
--> Demo Clinic A / clinic_admin, Demo Clinic B / doctor
```

## 11. No-tenant API call verification
After logging in as qa.notenant@example.local and navigating to /medical, network request log inspected:
- ZERO calls to clinical_dictionary_items
- ZERO calls to patient_findings
- ZERO calls to dental_chart or tooth_state

The isNoTenantSupabase guard in usePatientFindings, useDentalChart, and useDictionaries correctly short-circuits all queries.

## 12. What was intentionally NOT changed
- No src/* source code changes
- No migrations/* or seed.sql changes
- No RLS policies altered
- No cloud (production) database accessed
- .env.local created locally (gitignored by *.local rule) and not committed

## 13. Checks
- npx supabase db reset: PASS (all 5 migrations applied cleanly)
- npm run qa:seed-users (first run): PASS - 5 users created, 5 profiles upserted
- npm run qa:seed-users (second run / idempotency): PASS - 5 reused, 0 created
- Browser QA - Admin A: PASS
- Browser QA - Doctor A: PASS (2 low observations noted)
- Browser QA - Admin B: PASS (cross-tenant isolation confirmed)
- Browser QA - No-Tenant: PASS (boundary gate working)
- Browser QA - Multi-Tenant: PASS (defaults to Clinic A)
- Console errors across all sessions: pre-existing accessibility warnings only

## 14. Final verdict
PASS - All core runtime isolation requirements are met.

| Requirement | Status |
| :--- | :--- |
| Demo Clinic A users see only Clinic A data | PASS |
| Demo Clinic B users do not see Clinic A data | PASS |
| No-tenant users do not see localStorage/demo data | PASS |
| No-tenant users do not trigger tenant-scoped Supabase calls without tenant_id | PASS |
| Multi-tenant users default to first available tenant safely | PASS |
| Clinical dictionaries load correctly per tenant | PASS |
| Tenant switching UI | Not yet implemented (future task) |

## 15. Recommended next tasks
1. TREATMENT-STAGES-SYNC-TRANSACTION-001
2. FINDINGS-ARCHIVE-UI-CLEANUP-001
3. SECURITY-DEFINER-RPC-HARDENING-001
4. SUPABASE-CLOUD-DRIFT-BACKFILL-001
5. SUPABASE-CLOUD-DICTIONARY-SEED-RECON-001
6. (Future) Doctor-role UI gating on /medical (hide Edit/Disable buttons for doctor role)
7. (Future) Tenant switcher UI for multi-tenant users
