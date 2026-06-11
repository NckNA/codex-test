# PROJECT-AUDIT-BACKFILL-001 Foundation Reports Reconciliation

## Task ID
PROJECT-AUDIT-BACKFILL-001

## Type
Report-only reconciliation.

No application code, backend code, migrations, tests, package files, seed files, or configuration files were changed.

## Purpose
This report reconciles the first foundation audit reports against the current `main` state after later architecture, Supabase, and dental chart work.

The goal is not to delete old reports. The goal is to mark which early observations are still usable, which are partly true, which have been replaced, and which must not be used as current truth.

## Source reports reconciled

- `AUDIT-001_repository_structure_inventory_report.md`
- `AUDIT-002_routes_pages_components_audit_report.md`
- `AUDIT-003_localstorage_data_shape_audit_report.md`
- `AUDIT-004_backend_skeleton_audit_report.md`
- `AUDIT-005_amocrm_oauth_boundary_audit_report.md`
- `QA-001_current_prototype_smoke_test_checklist.md`

## Current checkpoint inspected

- Base branch: `main`
- Prior checkpoint: PR #214 `DENTALCHART-BACKFILL-RECON-001`
- PR #214 merge commit: `5a6ab5566cc4fe4ab5dc0b86b463d922f4abeb88`

## Labels

| Label | Meaning |
|---|---|
| VALID | Still accurate and safe to use as context. |
| PARTIALLY VALID | Still useful, but must be combined with newer reports and current code. |
| SUPERSEDED | Replaced by newer architecture, code, or reports. |
| STALE | Historical snapshot only. |
| DO NOT USE AS CURRENT TRUTH | Using it alone may lead to wrong scope or wrong implementation route. |

---

## Executive summary

The first foundation reports remain useful as historical baseline. They no longer describe the full current project.

The early project was described as a React frontend prototype with localStorage as the main storage layer and a separate Node backend skeleton for amoCRM. The current project now has additional layers:

- `AuthProvider` and `TenantProvider` wrap the app.
- `App.tsx` owns routing and auth/tenant gates.
- Several domains now have Supabase-aware hooks/repositories.
- localStorage remains present as dev fallback and for legacy or not-yet-migrated paths.
- The Node backend remains a separate amoCRM skeleton, not the core DentalFlow API.
- Dental chart has advanced significantly after the early audits.

Main correction:

```text
OLD: DentalFlow is localStorage-only.
CURRENT: DentalFlow is mixed by domain: localStorage fallback plus Supabase-aware paths where implemented.
```

---

## AUDIT-001 reconciliation

### Original report focus
Repository structure inventory.

### Still valid
- The repository still has `_ai_work`, `backend`, `src`, package/config files.
- `src` remains the React frontend source folder.
- `backend` still represents the separate integration-proxy skeleton, not the main CRM API.
- `_ai_work/REPORTS` remains the project operation log.

### Changed since AUDIT-001
- `_ai_work/REPORTS` is now much larger and contains many RECON/REAL/QA reports.
- `src` now includes more architecture layers: contexts, Supabase client, data hooks, repositories, orchestrators, and tests.
- The statement that file structure strongly implies localStorage-only persistence is now outdated as a global conclusion.

### Verdict
PARTIALLY VALID.

### New note
Use AUDIT-001 only as physical repo baseline. Do not use it as current storage or architecture map.

---

## AUDIT-002 reconciliation

### Original report focus
Routes, pages, major frontend components, and coupling risks.

### Still valid
- The app still has a `Layout` route wrapper.
- The main route still opens the schedule page.
- Patient card, dental chart, findings, treatment, schedule, and patient modules still exist.
- Patient card remains an important coupling watch area.
- amoCRM must remain separated from medical data.

### Changed since AUDIT-002
- Routing is no longer directly inside `src/main.tsx`; it is now in `src/App.tsx`.
- `main.tsx` now initializes localStorage seed data and wraps the app in auth/tenant providers.
- `App.tsx` now contains login/loading/no-clinic gates for Supabase-active mode.
- DentalChartTab is no longer accurately described as just localStorage-driven UI.
- Schedule and other modules have later repository work and must be checked through newer reports.

### Verdict
PARTIALLY VALID / SUPERSEDED.

### New note
Use AUDIT-002 only for old component inventory. Current route work must inspect `App.tsx`, auth context, tenant context, hooks, and repository boundaries.

---

## AUDIT-003 reconciliation

### Original report focus
localStorage data shape and helper methods.

### Still valid
- `src/utils/storage.ts` still exists.
- `storage.init()` is still called before render.
- localStorage seed/fallback still includes doctors, patients, appointments, chief complaints, and findings.
- localStorage dental charts are still lazy-created per patient.
- localStorage treatment plans still use the local helper.
- Old demo IDs such as `p1`, `d1`, `a1`, and `f1` remain important compatibility markers.

### Changed since AUDIT-003
- The report's global claim that localStorage is the only source of truth is outdated.
- Multiple domains now have Supabase-aware hooks and repositories.
- Dental chart localStorage read/write now normalizes tooth records.
- Dental chart and findings have newer structured fields and Supabase migration reports.

### Verdict
PARTIALLY VALID.

### New note
Use AUDIT-003 as the localStorage fallback map only. It must not be used as the full project storage map.

---

## AUDIT-004 reconciliation

### Original report focus
Backend skeleton.

### Still valid
- The Node backend remains a lightweight integration skeleton.
- It is not the general DentalFlow API backend.
- It does not serve patient, appointment, dental chart, finding, treatment plan, finance, document, or billing endpoints.
- It should not be treated as production backend architecture.

### Changed since AUDIT-004
- The frontend now has Supabase-aware data paths. This does not mean the Node backend became the main API.
- Auth and tenant context now exist in the frontend, but not as full backend middleware.

### Verdict
VALID for Node backend only.

### New note
Do not infer from AUDIT-004 that the whole app has no Supabase path. It only describes the Node backend folder.

---

## AUDIT-005 reconciliation

### Original report focus
amoCRM frontend/backend boundary.

### Still valid
- amoCRM must remain a sales/commercial integration, not a medical-record store.
- The Node backend skeleton is separate from the frontend.
- Real amoCRM sync should not be assumed ready.
- Tenant-scoped production integration still needs separate planning.

### Changed since AUDIT-005
- Treatment plan and clinical models have evolved, so old mapper conclusions must be rechecked before real integration.
- Any real integration task needs fresh recon, not only this early boundary audit.

### Verdict
PARTIALLY VALID.

### New note
Use AUDIT-005 as old safety baseline only. Before any real amoCRM work, run a fresh integration recon.

---

## QA-001 reconciliation

### Original report focus
Manual smoke checklist for the early prototype.

### Still valid
- It is a checklist, not proof that QA was executed.
- The general smoke discipline remains useful: run lint, build, dev server, browser checks, console/network checks.
- The placeholder-page discipline remains useful.

### Changed since QA-001
- The checklist's statement that there is no auth, no tenant isolation, and no database path is outdated.
- Dental chart now has adult/child dentition mode and later clinical UI layers.
- Current smoke must distinguish dev/local mode from Supabase-active mode.
- Current lint/test/build expectations must come from current CI, not the old checklist.

### Verdict
VALID as old checklist; STALE as current system description.

### New note
Use QA-001 only as an old smoke template. Current QA tasks must include the newer auth/tenant/Supabase and dental chart paths.

---

## Updated foundation map

```text
src/main.tsx
  -> storage.init()
  -> AuthProvider
  -> TenantProvider
  -> App

src/App.tsx
  -> login/loading/no-clinic gates
  -> BrowserRouter
  -> Layout routes

localStorage
  -> dev fallback
  -> seed/demo data
  -> legacy/local helper methods

Supabase-aware frontend layer
  -> selected domains through hooks/repositories
  -> tenant-aware paths where implemented

backend/
  -> amoCRM integration skeleton only
  -> not current core CRM API
```

## Updated fuse map

| Fuse / boundary | Current status | Why it matters |
|---|---|---|
| AuthProvider | Present | Supabase-active login/session gate exists. |
| TenantProvider | Present | Active tenant context exists. |
| App no-clinic gate | Present | Supabase user without clinic is blocked. |
| localStorage init | Present | Dev fallback and seed data still work. |
| Supabase repositories/hooks | Present by domain | Must be checked per domain before implementation. |
| Node backend | amoCRM skeleton | Do not route core CRM assumptions through it. |
| Old local IDs | Present in seed/fallback | UUID/FK-sensitive work must check mapping. |

---

## Updated rules after this backfill

1. Do not use early AUDIT reports as current truth without this reconciliation.
2. Do not say the whole app is localStorage-only.
3. Say: localStorage remains dev fallback and legacy storage; current persistence is domain-specific.
4. Do not use QA-001 as evidence that manual browser QA passed.
5. Before work in a domain, check the newest RECON/REAL/QA report for that domain.
6. Before connecting two domains, check storage mode, tenant_id, UUID/FK compatibility, and browser QA status.
7. Before amoCRM work, run fresh integration recon.
8. Before core backend/API work, run fresh backend/API recon.

---

## Final verdict table

| Report | Verdict | Use today |
|---|---|---|
| AUDIT-001 | PARTIALLY VALID | Physical repo baseline only. |
| AUDIT-002 | PARTIALLY VALID / SUPERSEDED | Old component inventory only. |
| AUDIT-003 | PARTIALLY VALID | localStorage fallback map only. |
| AUDIT-004 | VALID for Node backend only | Backend skeleton baseline. |
| AUDIT-005 | PARTIALLY VALID | Old amoCRM boundary baseline; fresh recon required before work. |
| QA-001 | VALID checklist / STALE system description | Old smoke discipline template only. |

---

## Recommended next batch

`PROJECT-AUDIT-BACKFILL-002` should reconcile the Auth/Tenant/Supabase foundation:

- `AuthContext`
- `TenantContext`
- `LoginPage`
- `App` gates
- Supabase client config
- repository selection rules
- dev fallback versus supabase-active mode
- no-clinic behavior
- browser QA evidence

## Final note

The foundation reports are not wrong. They are old. The dangerous part is using old reports without labels.

This report labels them so future tasks can use them as history, not as a fresh wiring diagram.
