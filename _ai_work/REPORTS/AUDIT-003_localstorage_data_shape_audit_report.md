# AUDIT-003 localStorage Data Shape Audit Report

## Task ID

AUDIT-003

## Summary

This is an **audit-only** report of the current frontend localStorage/prototype data model in DentalFlow CRM.

The audit inspected how the React frontend prototype currently stores, initializes, reads, writes, updates, and deletes prototype data via browser `localStorage`. All storage access is centralized through `src/utils/storage.ts`, which provides typed helper functions for each entity domain. Seed/demo data is loaded from `src/data/seed.ts` on first launch. No `sessionStorage` usage was found anywhere in the codebase.

**No source code files were changed. No backend files were changed. No issues were fixed. No migrations were created.**

---

## Files inspected

### Primary storage files
- `src/utils/storage.ts` — centralized localStorage helper (240 lines)
- `src/data/seed.ts` — demo/seed data (143 lines)
- `src/types/index.ts` — TypeScript type definitions (189 lines)

### Integration files
- `src/integrations/amocrm/amoCrmMapper.ts` — amoCRM DTO mapper (52 lines)
- `src/integrations/amocrm/amoCrmTypes.ts` — amoCRM type definitions (19 lines)

### Context/hooks
- `src/context/ScheduleContext.tsx` — schedule React context definition
- `src/context/ScheduleProvider.tsx` — schedule context provider (React state only, no localStorage)
- `src/hooks/useScheduleContext.ts` — schedule context hook

### Pages (storage consumers)
- `src/pages/PatientsPage.tsx`
- `src/pages/PatientCardPage.tsx`
- `src/pages/SchedulePage.tsx`

### Components (storage consumers)
- `src/components/dental/DentalChartTab.tsx`
- `src/components/dental/FindingModal.tsx`
- `src/components/dental/FindingsRisksTab.tsx`
- `src/components/treatment/CreatePlanFromFindingsModal.tsx`
- `src/components/treatment/TreatmentPlanModal.tsx`
- `src/components/treatment/TreatmentPlanPatientPreview.tsx`
- `src/components/treatment/TreatmentPlansTab.tsx`
- `src/components/schedule/AppointmentModal.tsx`
- `src/components/patients/PatientModal.tsx`
- `src/components/layout/Header.tsx`

### Application entry
- `src/main.tsx` — calls `storage.init()` at module level

### Source documents consulted
- `_ai_work/SOURCES/03_MULTI_TENANT_ARCHITECTURE_RULES.md`
- `_ai_work/SOURCES/04_DATA_ISOLATION_AND_SECURITY.md`
- `_ai_work/SOURCES/05_MEDICAL_DOMAIN_MODEL.md`
- `_ai_work/SOURCES/06_PATIENT_CARD_AND_DENTAL_CHART_RULES.md`
- `_ai_work/SOURCES/07_TREATMENT_PLAN_AND_DOCUMENTS.md`
- `_ai_work/SOURCES/08_APPOINTMENTS_AND_SCHEDULE.md`
- `_ai_work/SOURCES/09_AMOCRM_INTEGRATION_RULES.md`
- `_ai_work/SOURCES/13_STORAGE_AND_MIGRATION_STRATEGY.md`
- `_ai_work/REPORTS/AUDIT-001_repository_structure_inventory_report.md`
- `_ai_work/REPORTS/AUDIT-002_routes_pages_components_audit_report.md`

---

## Storage mechanism overview

### Mechanism
- **localStorage only** — all persistent prototype data is stored in `window.localStorage`
- **No sessionStorage** — zero references to `sessionStorage` found anywhere in `src/`
- **Centralized helper** — all localStorage access goes through the `storage` object exported from `src/utils/storage.ts`
- **No direct localStorage access outside storage.ts** — confirmed via search: all 21 `localStorage.*` calls are in `storage.ts`, plus one comment in `main.tsx`

### Initialization
- `storage.init()` is called synchronously at module level in `src/main.tsx` (line 26), before `createRoot().render()`
- Initialization is guarded by the `df_initialized` flag key — seed data is only written if this key is absent
- On first load, five entity collections are seeded: doctors, patients, appointments, chief complaints, dental findings
- Dental charts and treatment plans are NOT seeded — they are created on demand

### Sync/async nature
- **Fully synchronous** — all storage reads and writes use `localStorage.getItem()` / `localStorage.setItem()` directly
- No promises, no async/await, no callbacks
- All JSON parsing uses `JSON.parse()` with `|| '[]'` or `|| '{}'` fallback (no try/catch)

### Source of truth
- localStorage is the **sole source of truth** for this prototype
- No backend API calls exist for data persistence
- The `ScheduleProvider` uses React `useState` for view state (selected date, view mode, filters) — this is ephemeral and not persisted

---

## localStorage keys inventory

All keys are defined in the `STORAGE_KEYS` constant object in `src/utils/storage.ts` (lines 4–13):

| Key name | Constant | Entity domain | Read function(s) | Write/update function(s) | Seeded on init | Risk notes |
|---|---|---|---|---|---|---|
| `df_initialized` | `INITIALIZED` | System flag | `init()` reads | `init()` sets to `'true'`; `reset()` removes | Yes (flag itself) | No versioning; any truthy value prevents re-seeding |
| `df_doctors` | `DOCTORS` | Doctor | `getDoctors()` | `init()` seeds | Yes | Read-only after seed; no add/update/delete helpers |
| `df_patients` | `PATIENTS` | Patient | `getPatients()` | `savePatients()`, `addPatient()`, `updatePatient()` | Yes (20 demo patients) | Contains phone numbers, medical notes, allergies |
| `df_appointments` | `APPOINTMENTS` | Appointment | `getAppointments()` | `saveAppointments()`, `addAppointment()`, `updateAppointment()`, `deleteAppointment()` | Yes (7 demo appointments) | Contains financial data (price, paymentType) |
| `df_dental_charts` | `DENTAL_CHARTS` | DentalChart | `getAllDentalCharts()`, `getDentalChart(patientId)` | `saveDentalChart(patientId, chart)` | No — created on first access per patient | Medical data; stored as `Record<string, DentalChart>` (object map, not array) |
| `df_treatment_plans` | `TREATMENT_PLANS` | TreatmentPlan | `getAllTreatmentPlans()`, `getTreatmentPlans(patientId)` | `saveAllTreatmentPlans()`, `addTreatmentPlan()`, `updateTreatmentPlan()`, `deleteTreatmentPlan()` | No | Medical + financial data (stages with prices) |
| `df_chief_complaints` | `CHIEF_COMPLAINTS` | ChiefComplaint | `getAllChiefComplaints()`, `getChiefComplaint(patientId)` | `saveAllChiefComplaints()`, `saveChiefComplaint(patientId, ...)` | Yes (1 demo complaint) | Medical data (patient complaint text, affected teeth) |
| `df_dental_findings` | `DENTAL_FINDINGS` | DentalFinding | `getAllFindings()`, `getFindings(patientId)` | `saveAllFindings()`, `addFinding()`, `updateFinding()`, `deleteFinding()` | Yes (3 demo findings) | Medical data (diagnosis, severity, recommendations) |

**Total keys: 8** (1 system flag + 7 entity collections)

**Key naming convention:** All keys use `df_` prefix (presumably "DentalFlow").

---

## Storage helper functions inventory

All functions are methods on the `storage` object in `src/utils/storage.ts`:

### System functions

| Function | Lines | Behavior | Risks |
|---|---|---|---|
| `init()` | 16–26 | Checks `df_initialized`; if absent, seeds 5 collections and sets flag to `'true'` | No version check; no schema validation; no error handling on JSON.stringify |
| `reset()` | 28–31 | Removes `df_initialized` flag, then calls `init()` to re-seed | **Destructive**: does not clear other keys first — dental_charts and treatment_plans survive reset; only seeded collections are overwritten |

### Doctor functions

| Function | Lines | Behavior | Risks |
|---|---|---|---|
| `getDoctors()` | 33–35 | Returns `Doctor[]` from localStorage | Read-only; no write helpers exist for doctors |

### Patient functions

| Function | Lines | Behavior | Risks |
|---|---|---|---|
| `getPatients()` | 37–39 | Returns `Patient[]` from localStorage | None |
| `savePatients(patients)` | 41–43 | Overwrites entire patients array | Full array replacement — data loss if called with stale data |
| `addPatient(patient)` | 45–49 | Reads all, pushes new, saves all | No duplicate ID check |
| `updatePatient(updated)` | 51–58 | Finds by `id`, replaces, saves | Silent no-op if ID not found |

### Appointment functions

| Function | Lines | Behavior | Risks |
|---|---|---|---|
| `getAppointments()` | 60–62 | Returns `Appointment[]` from localStorage | None |
| `saveAppointments(appointments)` | 64–66 | Overwrites entire appointments array | Full array replacement |
| `addAppointment(appointment)` | 68–72 | Reads all, pushes new, saves all | No duplicate ID check |
| `updateAppointment(updated)` | 74–81 | Finds by `id`, replaces, saves | Silent no-op if ID not found |
| `deleteAppointment(id)` | 83–86 | Filters out by `id`, saves | No cascade delete of related data |

### Dental chart functions

| Function | Lines | Behavior | Risks |
|---|---|---|---|
| `createDefaultDentalChart(patientId)` | 88–109 | Creates chart with 32 teeth, all `'healthy'` | Pure function, no side effects; generates deterministic ID `chart_{patientId}` |
| `getAllDentalCharts()` | 111–113 | Returns `Record<string, DentalChart>` (object map keyed by patientId) | Different storage shape than other entities (object, not array) |
| `getDentalChart(patientId)` | 115–123 | Returns chart for patient; creates default if absent | **Lazy initialization** — auto-creates and saves on first read |
| `saveDentalChart(patientId, chart)` | 125–129 | Reads all charts, sets one, saves all | Full object replacement; O(n) on total charts |

### Treatment plan functions

| Function | Lines | Behavior | Risks |
|---|---|---|---|
| `getAllTreatmentPlans()` | 131–133 | Returns `TreatmentPlan[]` from localStorage | None |
| `saveAllTreatmentPlans(plans)` | 135–137 | Overwrites entire plans array | Full array replacement |
| `getTreatmentPlans(patientId)` | 139–141 | Filters all plans by `patientId` | O(n) scan on every call |
| `addTreatmentPlan(_patientId, plan)` | 143–147 | Reads all, pushes, saves | `_patientId` param unused (underscore prefix) |
| `updateTreatmentPlan(_patientId, plan)` | 149–156 | Finds by `id`, replaces, saves | `_patientId` param unused |
| `deleteTreatmentPlan(_patientId, planId)` | 158–161 | Filters out by `id`, saves | `_patientId` param unused; no cascade |

### Chief complaint functions

| Function | Lines | Behavior | Risks |
|---|---|---|---|
| `getAllChiefComplaints()` | 163–165 | Returns `ChiefComplaint[]` from localStorage | None |
| `saveAllChiefComplaints(complaints)` | 167–169 | Overwrites entire complaints array | Full array replacement |
| `getChiefComplaint(patientId)` | 171–174 | Returns first match or `null` | Assumes one complaint per patient |
| `saveChiefComplaint(patientId, complaint)` | 176–197 | Upserts: updates if exists, creates with `crypto.randomUUID()` if not | **Upsert by patientId** — only one complaint per patient is possible |

### Dental finding functions

| Function | Lines | Behavior | Risks |
|---|---|---|---|
| `getAllFindings()` | 199–201 | Returns `DentalFinding[]` from localStorage | None |
| `saveAllFindings(findings)` | 203–205 | Overwrites entire findings array | Full array replacement |
| `getFindings(patientId)` | 207–210 | Filters all findings by `patientId` | O(n) scan on every call |
| `addFinding(patientId, finding)` | 212–223 | Creates with `crypto.randomUUID()`, pushes, saves | Enriches with id, patientId, timestamps |
| `updateFinding(patientId, finding)` | 225–232 | Finds by `id` AND `patientId`, replaces, saves | Dual-key match provides basic ownership check |
| `deleteFinding(patientId, findingId)` | 234–237 | Filters by `id` AND `patientId`, saves | Dual-key match |

---

## Seed/demo data

Seed data is defined in `src/data/seed.ts` and imported by `storage.ts`.

### Entities seeded

| Export | Entity | Count | Notes |
|---|---|---|---|
| `demoDoctors` | `Doctor[]` | 8 | Russian names, specializations, cabinets, colors; all `active: true` |
| `demoPatients` | `Patient[]` | 20 | Generated programmatically via `Array.from({ length: 20 })`; Russian surnames; demo phone numbers `+7 (999) 000-XXXX` |
| `demoAppointments` | `Appointment[]` | 7 | 4 blocked slots + 3 normal appointments; dates use `new Date().toISOString().split('T')[0]` (today) |
| `demoChiefComplaints` | `ChiefComplaint[]` | 1 | For patient `p1`; tooth 47 discomfort |
| `demoDentalFindings` | `DentalFinding[]` | 3 | All for patient `p1`; teeth 47, 24, 48; varying severity |

### Observations

- **Data is clearly fake/demo**: surnames are generic Russian, phone numbers are patterned, all data references the same patient `p1`
- **IDs are hardcoded strings**: `d1`–`d8`, `p1`–`p20`, `a1`–`a6`+`a_block1`+`a_block2`, `cc1`, `f1`–`f3`
- **Relationships are hardcoded**: appointments reference `patientId: 'p1'`–`'p4'` and `doctorId: 'd1'`–`'d5'`; findings reference `patientId: 'p1'`
- **Dates are dynamic**: `new Date().toISOString()` used for `createdAt`/`updatedAt`, so seed data always appears "fresh"
- **No medical images or file attachments** in seed data
- **Financial data present**: appointment prices (0–5000), payment types
- **No integration-related seed data**: no amoCRM IDs, sync statuses, or external references in seed data
- **Patient seed does not include `integration` field**: no `PatientIntegrationMeta` in demo patients

### Entities NOT seeded (created on demand)

- `DentalChart` — created lazily by `getDentalChart()` on first access per patient
- `TreatmentPlan` — created by user action through `TreatmentPlanModal` or `CreatePlanFromFindingsModal`

---

## Entity shape summary

### Patient

```typescript
interface Patient {
  id: string;                              // e.g., 'p1'
  fullName: string;                        // Sensitive: PII
  phone: string;                           // Sensitive: PII
  birthDate?: string;                      // Sensitive: PII
  source: Source;                           // 'phone' | 'instagram' | 'walk_in' | 'referral'
  status: string;                          // 'active', 'archived'
  notes?: string;                          // Potentially sensitive
  allergies?: string;                      // Sensitive: medical
  balance?: number;                        // Financial
  bonusBalance?: number;                   // Financial
  createdAt: string;                       // ISO timestamp
  integration?: PatientIntegrationMeta;    // CRM integration metadata
}
```

- **tenantId**: absent
- **Sensitive data risk**: HIGH — contains PII (name, phone, birthDate), medical data (allergies, notes), financial data (balance)
- **Migration concern**: `integration` field with nested `ExternalCrmLink` creates a complex shape; `source` type uses `Source` in seed but `PatientSource` in `PatientIntegrationMeta` — two different enums for similar concept
- **Relationships**: linked from Appointment (via `patientId`), DentalChart, TreatmentPlan, ChiefComplaint, DentalFinding

### Doctor

```typescript
interface Doctor {
  id: string;                  // e.g., 'd1'
  fullName: string;            // PII
  specialization: string;
  cabinet: string;
  color: string;               // UI display color
  active: boolean;
}
```

- **tenantId**: absent
- **Sensitive data risk**: LOW — staff names only
- **Migration concern**: read-only in prototype; no CRUD helpers except `getDoctors()`
- **Relationships**: linked from Appointment (via `doctorId`)

### Appointment

```typescript
interface Appointment {
  id: string;                          // e.g., 'a1'
  patientId?: string;                  // Optional for blocked slots
  doctorId: string;
  cabinet: string;
  service: string;
  start: string;                       // ISO datetime
  end: string;                         // ISO datetime
  status: AppointmentStatus;           // 8 possible values
  paymentType?: PaymentType;           // 6 possible values
  source?: Source;
  comment?: string;
  price?: number;                      // Financial
  createdAt: string;
}
```

- **tenantId**: absent
- **Sensitive data risk**: MEDIUM — financial data (price, paymentType), links to patient/doctor
- **Migration concern**: `patientId` is optional (blocked slots have no patient); `status` has 8 values including `'blocked'` which represents a non-appointment
- **Relationships**: references `patientId` (Patient) and `doctorId` (Doctor)

### DentalChart

```typescript
interface DentalChart {
  id: string;                  // e.g., 'chart_p1'
  patientId: string;
  teeth: ToothRecord[];        // 32 teeth
  complaints?: string;         // Free text
  diagnosis?: string;          // Free text — medical
  createdAt: string;
  updatedAt: string;
}
```

- **tenantId**: absent
- **Sensitive data risk**: HIGH — detailed medical data (tooth conditions, diagnosis)
- **Migration concern**: stored as `Record<string, DentalChart>` (object map keyed by patientId), unlike all other entities which are arrays; ID is deterministic (`chart_{patientId}`)
- **Relationships**: belongs to Patient (via `patientId`)

### ToothRecord

```typescript
interface ToothRecord {
  toothNumber: ToothNumber;    // FDI notation: 11-18, 21-28, 31-38, 41-48
  condition: ToothCondition;   // 10 possible values
  surfaces?: ToothSurface[];   // 5 possible values
  crown?: string;
  root?: string;
  gum?: string;
  bone?: string;
  canal?: string;
  notes?: string;
  updatedAt: string;
}
```

- **Sensitive data risk**: HIGH — detailed per-tooth medical data
- **Migration concern**: embedded within DentalChart (not stored separately); many optional free-text fields

### DentalFinding

```typescript
interface DentalFinding {
  id: string;                          // UUID or 'f1', 'f2', etc.
  patientId: string;
  toothNumber?: number;
  title: string;
  category: FindingCategory;           // 12 possible values
  severity: FindingSeverity;           // 4 possible values
  description: string;
  riskDescription?: string;
  recommendation?: string;
  isChiefComplaintRelated: boolean;
  includeInTreatmentPlan: boolean;
  status: FindingStatus;               // 6 possible values
  createdAt: string;
  updatedAt: string;
}
```

- **tenantId**: absent
- **Sensitive data risk**: HIGH — medical diagnosis, risk assessment, treatment recommendations
- **Migration concern**: `toothNumber` is `number` (not `ToothNumber` union type — type safety gap); `status` field drives workflow transitions
- **Relationships**: belongs to Patient (via `patientId`); linked from TreatmentStage (via `findingIds`)

### ChiefComplaint

```typescript
interface ChiefComplaint {
  id: string;                  // UUID or 'cc1'
  patientId: string;
  text: string;                // Free-text complaint
  relatedTeeth: number[];      // Array of tooth numbers
  createdAt: string;
  updatedAt: string;
}
```

- **tenantId**: absent
- **Sensitive data risk**: HIGH — patient-reported medical complaint
- **Migration concern**: one complaint per patient enforced by `saveChiefComplaint` upsert logic; `relatedTeeth` uses `number[]` not `ToothNumber[]`
- **Relationships**: belongs to Patient (via `patientId`)

### TreatmentPlan

```typescript
interface TreatmentPlan {
  id: string;                              // UUID
  patientId: string;
  title: string;
  status: TreatmentPlanStatus;             // 5 possible values
  stages: TreatmentStage[];               // Embedded stages
  totalPrice: number;                      // Financial
  createdAt: string;
  updatedAt: string;
}
```

- **tenantId**: absent
- **Sensitive data risk**: HIGH — medical treatment plan with financial data
- **Migration concern**: stages are embedded (not stored separately); `totalPrice` may diverge from sum of stage prices; `_patientId` parameter in helper functions is unused
- **Relationships**: belongs to Patient (via `patientId`); stages reference findings (via `findingIds`)

### TreatmentStage

```typescript
interface TreatmentStage {
  id: string;
  title: string;
  teeth: number[];
  description: string;
  price: number;                   // Financial
  status: TreatmentStageStatus;   // 4 possible values
  findingIds?: string[];           // Links to DentalFinding IDs
  source?: TreatmentPlanSource;   // 'manual' | 'from_finding'
}
```

- **Sensitive data risk**: HIGH — medical + financial
- **Migration concern**: embedded within TreatmentPlan; `findingIds` creates a loose coupling without referential integrity

### PatientIntegrationMeta (nested in Patient)

```typescript
interface PatientIntegrationMeta {
  source: PatientSource;                   // 8 possible values including 'amocrm'
  sourceComment?: string;
  leadStatus: PatientLeadStatus;           // 8 possible values
  externalCrm?: ExternalCrmLink;
  createdFromExternal?: boolean;
}
```

### ExternalCrmLink (nested in PatientIntegrationMeta)

```typescript
interface ExternalCrmLink {
  provider: ExternalCrmProvider;           // 'amocrm' | 'other'
  externalContactId?: string;
  externalLeadId?: string;
  externalDealId?: string;
  syncStatus: SyncStatus;                  // 4 possible values
  lastSyncAt?: string;
  lastSyncError?: string;
}
```

- **Sensitive data risk**: MEDIUM — external system IDs, sync state
- **Migration concern**: deeply nested (Patient → integration → externalCrm); optional at every level

### amoCRM draft types (not stored in localStorage)

```typescript
interface AmoCrmContactDraft { name: string; phone?: string; email?: string; }
interface AmoCrmLeadDraft { name: string; price?: number; status?: string; source?: string; }
interface AmoCrmSyncPreview { contact?: AmoCrmContactDraft; lead?: AmoCrmLeadDraft; warnings: string[]; }
```

- These are **DTO/mapper types only** — they are not stored in localStorage
- `amoCrmMapper.ts` maps Patient/TreatmentPlan → amoCRM drafts at read time
- No tokens, secrets, or API keys found in these files or anywhere in `src/`

### Entities NOT present in current code

The following entities mentioned in source documents are **not implemented** in the current prototype storage:

- **Document / File / Image** — no storage, no type definitions
- **Invoice / Payment / Finance records** — no separate entity; only `price` field on Appointment/TreatmentStage
- **User / Role / Clinic** — no authentication or authorization model
- **Audit trail / Event log** — not present
- **Notification / SMS / Email** — placeholder pages only

---

## Relationship map

```
Patient (df_patients)
 ├── Appointment (df_appointments) ← via patientId (optional for blocked)
 │    └── Doctor (df_doctors) ← via doctorId
 ├── DentalChart (df_dental_charts) ← via patientId (object key)
 │    └── ToothRecord[] (embedded)
 ├── ChiefComplaint (df_chief_complaints) ← via patientId (1:1 enforced)
 ├── DentalFinding (df_dental_findings) ← via patientId (1:many)
 │    └── TreatmentStage.findingIds (loose reference)
 ├── TreatmentPlan (df_treatment_plans) ← via patientId (1:many)
 │    └── TreatmentStage[] (embedded)
 └── PatientIntegrationMeta (embedded)
      └── ExternalCrmLink (embedded)

Doctor (df_doctors)
 └── Appointment (df_appointments) ← via doctorId
```

### Relationship enforcement

- **No foreign key constraints** — relationships are by convention only
- **No cascade deletes** — deleting a patient does not remove their appointments, charts, findings, or plans
- **No referential integrity checks** — stale IDs can persist indefinitely
- **DentalChart uses patientId as object key** — different pattern from all other entities which use array storage
- **TreatmentStage.findingIds** — loose string array reference to DentalFinding IDs; no validation
- **ChiefComplaint is 1:1 per patient** — enforced by `saveChiefComplaint` upsert logic, but no database constraint

---

## Tenant and multi-tenant readiness

### Current state

- **tenantId**: absent from ALL entity types
- **clinicId**: absent from ALL entity types
- **organizationId**: absent from ALL entity types
- **User/role context**: not implemented — no authentication, no authorization
- **Tenant switching**: not supported
- **Cross-tenant separation**: not present — all data is in a single global localStorage namespace

### Assessment

The current prototype has **zero multi-tenant readiness**. This is expected for a prototype phase.

Source documents (03_MULTI_TENANT_ARCHITECTURE_RULES.md, 04_DATA_ISOLATION_AND_SECURITY.md) specify that `tenantId` must be present on all entities in the target architecture, but the current prototype does not implement this.

**Migration impact**: every stored entity will need a `tenantId` field added during backend migration.

---

## Sensitive data and medical data risk

### Data currently stored in browser localStorage

| Data type | Present in localStorage | Keys affected | Risk level |
|---|---|---|---|
| Patient full name | Yes | `df_patients` | HIGH — PII |
| Patient phone number | Yes | `df_patients` | HIGH — PII |
| Patient birth date | Yes (optional field) | `df_patients` | HIGH — PII |
| Patient allergies | Yes (optional field) | `df_patients` | HIGH — medical |
| Patient notes | Yes (optional field) | `df_patients` | MEDIUM — potentially medical |
| Dental chart (tooth conditions) | Yes | `df_dental_charts` | HIGH — medical |
| Chief complaint text | Yes | `df_chief_complaints` | HIGH — medical |
| Dental findings (diagnosis, severity) | Yes | `df_dental_findings` | HIGH — medical |
| Treatment plans (stages, recommendations) | Yes | `df_treatment_plans` | HIGH — medical |
| Treatment prices | Yes | `df_treatment_plans`, `df_appointments` | MEDIUM — financial |
| Payment types | Yes | `df_appointments` | LOW — category only |
| Doctor names | Yes | `df_doctors` | LOW — staff data |
| amoCRM external IDs | Possible (if integration field populated) | `df_patients` | MEDIUM — external system references |
| API tokens / secrets | **No** — not found anywhere | N/A | N/A |
| OAuth tokens | **No** — not found anywhere | N/A | N/A |
| Passwords | **No** — not found anywhere | N/A | N/A |

### Why browser localStorage is not safe as production source of truth

1. **No encryption at rest** — data is stored as plain-text JSON strings
2. **Accessible via browser DevTools** — any user with physical access can read all medical data
3. **No access control** — any JavaScript on the same origin can read/write localStorage
4. **No audit trail** — no logging of who accessed or modified data
5. **Browser-scoped** — data is per-device, per-browser; users cannot access from other devices
6. **Can be cleared by user** — clearing browser data destroys all patient records
7. **Size limits** — typically 5–10MB per origin; no quota monitoring
8. **No HIPAA/medical compliance** — browser storage does not meet medical data protection requirements
9. **XSS vulnerability** — if an XSS attack occurs, all localStorage data is exposed
10. **No backup/restore** — no mechanism to recover lost data

---

## Integration/storage boundary observations

### amoCRM integration files found

- `src/integrations/amocrm/amoCrmMapper.ts` — pure mapping functions (Patient/TreatmentPlan → amoCRM draft DTOs)
- `src/integrations/amocrm/amoCrmTypes.ts` — TypeScript interfaces for amoCRM drafts

### What is stored in localStorage

- **amoCRM status**: possible via `Patient.integration.externalCrm.syncStatus` field — but seed data does not populate this
- **amoCRM external IDs**: possible via `Patient.integration.externalCrm.externalContactId/externalLeadId/externalDealId` — but seed data does not populate this
- **Sync flags**: `SyncStatus` type exists ('not_synced' | 'synced' | 'sync_error' | 'needs_update') — available in type but not seeded

### What is NOT stored in localStorage

- **No API tokens or secrets** — confirmed via search
- **No OAuth tokens** — confirmed via search
- **No amoCRM API responses** — mapper functions are one-way outbound only
- **No cached external data** — no external data is persisted locally

### Assessment

The amoCRM integration is currently **mapper-only**: it defines how Patient/TreatmentPlan data would be shaped for amoCRM, but does not perform actual API calls or store any external data. The `PatientIntegrationMeta` type is defined and included in the `Patient` interface, but demo/seed data does not use it.

The mapper correctly excludes medical data from amoCRM DTOs (per source document rules). No sensitive medical information (tooth conditions, findings, diagnoses) is included in amoCRM draft objects.

---

## Versioning and migration readiness

### Current state

| Feature | Present | Notes |
|---|---|---|
| Storage version number | **No** | No `storageVersion` key or version field |
| Schema versioning | **No** | No version embedded in stored data |
| Migration functions | **No** | No migration code exists |
| Fallback behavior | **Partial** | `JSON.parse(... \|\| '[]')` prevents crash on missing keys, but no shape validation |
| Data validation | **No** | No runtime validation of loaded data; TypeScript types are compile-time only |
| Corruption handling | **No** | Invalid JSON will throw from `JSON.parse()` with no catch |
| Backup/export | **No** | No export functionality |
| Migration dry-run | **No** | Not applicable to current prototype |
| Data integrity check | **No** | No mechanism to detect or repair data inconsistencies |

### Migration risks

1. **No version field** — impossible to determine what schema version is stored in a user's browser
2. **No JSON.parse error handling** — corrupted localStorage will crash the application
3. **Shape evolution** — if type definitions change, existing localStorage data will silently have the old shape with no migration
4. **`df_initialized` flag is boolean-like** — set to string `'true'`; any code change to initialization logic won't re-run for existing users
5. **DentalChart uses object map** — different storage pattern from other entities; will need different migration approach
6. **Embedded entities** (ToothRecord in DentalChart, TreatmentStage in TreatmentPlan) — cannot be migrated independently
7. **ID format inconsistency** — seed data uses short IDs (`p1`, `d1`, `a1`); runtime creates UUIDs via `crypto.randomUUID()` — mixed ID formats in same collection
8. **`_patientId` unused parameters** — treatment plan functions accept but ignore `patientId`; may cause bugs if logic changes

---

## Data loss and corruption risks

### Evidence-based risks from code inspection

1. **Full array replacement on every write** — all `save*` functions overwrite the entire collection; concurrent writes from multiple tabs will cause data loss (last-write-wins)
2. **No JSON.parse try/catch** — corrupted localStorage (e.g., partial write, manual edit) will throw unhandled error and crash the app
3. **No validation on read** — data loaded from localStorage is cast to TypeScript types without runtime validation; missing fields will appear as `undefined`
4. **Stale data in React state** — `PatientCardPage` uses `useMemo` but doesn't re-read after `updatePatient` (dependency on `patientId` which doesn't change)
5. **Multi-entity writes without transactions** — `CreatePlanFromFindingsModal` writes a treatment plan then updates N findings in a loop; if interrupted, data is partially written
6. **O(n²) serialization in loops** — `updateFinding` in a loop re-reads and re-serializes the entire findings array on each iteration
7. **`reset()` is incomplete** — removes `df_initialized` and re-seeds, but does not clear `df_dental_charts` or `df_treatment_plans`; user-created data in those keys survives
8. **No cascade deletes** — deleting a patient leaves orphaned appointments, charts, findings, plans, and complaints
9. **localStorage.clear() risk** — not called in current code, but any external script or user action can destroy all data
10. **5–10MB browser limit** — no quota monitoring; large clinics with many patients could exceed limit
11. **Per-device storage** — data is not synchronized between devices/browsers
12. **Browser clearing** — user clearing browsing data destroys all records with no warning

---

## Prototype limitations

The following limitations are evident from the code and are expected for a prototype:

1. **Browser-only persistence** — no server-side storage; data exists only in one browser on one device
2. **Synchronous access** — all storage operations block the main thread; acceptable for small datasets, will not scale
3. **No server source of truth** — backend skeleton exists but has no data persistence
4. **No tenant isolation** — all data shares one namespace; no multi-user or multi-clinic support
5. **No real concurrency** — multiple tabs can corrupt data; no locking or optimistic concurrency
6. **No audit trail** — no record of who created, modified, or deleted data
7. **No backup/restore** — no export, import, or recovery mechanism
8. **No backend permissions** — no RBAC; all users can read/write all data
9. **No encryption** — all data stored as plain text
10. **No real-time sync** — no WebSocket or server-sent events
11. **Read-only doctors** — no CRUD operations for doctors beyond initial seed
12. **No file/image storage** — no document upload or storage mechanism
13. **No separate finance entity** — financial data is spread across appointment prices and treatment stage prices

---

## Recommended migration considerations

The following are future considerations, **not implementation tasks for this audit**:

1. **Define backend/database schema** — map each localStorage entity to a database table with proper relations
2. **Preserve IDs during migration** — existing short IDs (`p1`, `d1`) and UUIDs must be handled; consider normalizing to UUID
3. **Add `tenantId` to all entities** — required by multi-tenant architecture rules
4. **Add storage versioning before migration** — introduce a `storageVersion` key to support incremental migration
5. **Create migration dry-run** — test data migration from localStorage → database without data loss
6. **Avoid `localStorage.clear()`** — use per-key removal during migration
7. **Map relationships carefully** — enforce foreign keys at database level; handle orphaned records
8. **Keep document snapshots immutable** — when documents are implemented, treat signed/approved documents as immutable
9. **Separate clinic finance from platform billing** — if implemented, use separate entities
10. **Keep medical data out of amoCRM DTOs** — already enforced by current mapper, maintain this rule
11. **Add JSON.parse error handling** — wrap all localStorage reads in try/catch before migration period
12. **Flatten embedded entities** — consider storing ToothRecord and TreatmentStage as separate tables
13. **Normalize DentalChart storage** — convert from `Record<string, DentalChart>` object map to consistent array storage
14. **Add runtime data validation** — validate loaded data shapes (e.g., with Zod) before trusting them
15. **Handle mixed ID formats** — standardize on UUID format for all new records

---

## Checks

### Commands run and results

| Command | Result |
|---|---|
| `git checkout main; git pull origin main` | Success — up to date with origin/main (fast-forward from 8d911fc to 29788bb) |
| `git checkout -b feature/audit-003-localstorage-data-shape-audit` | Success — branch created |
| `git status --short` | Clean — no modified files |
| `Get-ChildItem ... Select-String "localStorage\|sessionStorage"` | 22 matches — all in `storage.ts` (21) and `main.tsx` (1 comment); **zero sessionStorage** |
| `Get-ChildItem ... Select-String "storage"` | 14 files reference storage; all use centralized `storage` import |
| `Get-ChildItem ... Select-String "seed\|init\|version\|migration"` | `storage.ts` and `main.tsx` only; no versioning or migration code found |
| `Get-ChildItem ... Select-String "invoice\|payment\|finance\|document\|amoCRM\|token\|secret"` | amoCRM references in mapper/types/pages; payment references in types/seed; **no tokens or secrets found** |
| `npm run lint` | **1 warning** (0 errors): `react-hooks/exhaustive-deps` in `DentalChartTab.tsx:33` — missing dependency `loadData` in useEffect |
| `npm run build` | **Success** — built in 343ms; lightningcss warnings about `@tailwind` directives (cosmetic, non-blocking) |

### Verification of no source changes

| Check | Result |
|---|---|
| `git status --short` before report creation | Empty — clean working tree |
| No `src/` files changed | Confirmed |
| No `backend/src/` files changed | Confirmed |
| No `package.json` or `package-lock.json` changed | Confirmed |
| No `backend/package.json` or `backend/package-lock.json` changed | Confirmed |
| No source documents (00–18) changed | Confirmed |
| No `SOURCES_INDEX.md` changed | Confirmed |
| No `PROJECT_ROUTES.md` changed | Confirmed |

---

## Safety notes

- **Audit-only task** — no fixes, refactoring, or implementation performed
- **No source code changed** — confirmed via `git status`
- **No backend code changed**
- **No package files changed**
- **No dependencies added**
- **No real patient data added** — all inspected data is demo/seed
- **No secrets added** — no API keys, tokens, or credentials in this report
- **No production claims made** — this prototype is not production-ready
- **No localStorage was cleared or modified** — all inspection was read-only via code analysis
- **No browser runtime testing** was performed that writes data

---

## What was not implemented

- No code changes of any kind
- No storage logic changes
- No migration scripts or code
- No backend/database work
- No UI changes
- No tests or CI added
- No fixes applied to any discovered issues
- No dependencies added or removed
- No files renamed, moved, or deleted

---

## Issues or observations

The following issues were observed during audit. **None were fixed because this task is audit-only.**

1. **No JSON.parse error handling** — all `JSON.parse()` calls lack try/catch; malformed localStorage will crash the app
2. **`reset()` is incomplete** — only re-seeds collections that `init()` manages; `df_dental_charts` and `df_treatment_plans` survive reset
3. **Unused `_patientId` parameters** — `addTreatmentPlan`, `updateTreatmentPlan`, `deleteTreatmentPlan` accept but ignore `patientId`
4. **Type mismatch for `toothNumber`** — `DentalFinding.toothNumber` is `number` but `ToothRecord.toothNumber` is `ToothNumber` union type
5. **Mixed ID formats** — seed uses short strings (`p1`, `d1`); runtime uses `crypto.randomUUID()`
6. **`getDentalChart` has write side-effect** — creates and persists default chart on read if none exists
7. **Multi-entity writes lack atomicity** — `CreatePlanFromFindingsModal` performs N+1 storage writes without transaction
8. **Stale state in `PatientCardPage`** — `useMemo` depends on `patientId` which doesn't change after update
9. **1 ESLint warning** — `DentalChartTab.tsx:33` missing `loadData` dependency in useEffect
10. **`df_doctors` is read-only** — no add/update/delete functions; doctors cannot be managed at runtime
11. **DentalChart uses different storage shape** — `Record<string, DentalChart>` (object map) vs arrays for all other entities
12. **No storage quota monitoring** — localStorage size limit is not checked

**No blocking storage issues were fixed or modified because this task was audit-only.**

---

## Recommended next step

**AUDIT-004** — Audit current backend skeleton

Additionally, the following tasks are recommended for future phases:

- **AUDIT-005** — Audit amoCRM/OAuth frontend-backend boundary (if backend integration code exists)
- **QA-001** — Create current prototype smoke test checklist
- **CLEAN-001** — Identify fake actions and risky placeholders in UI

---

*Report generated: 2026-06-07*
*Task: AUDIT-003*
*Branch: feature/audit-003-localstorage-data-shape-audit*
*Author: AI Audit Agent*
*Status: Audit complete — no code changes made*
