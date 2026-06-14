# RECON-FINDINGS-REAL-001 — FindingsRepository Supabase Migration Plan

## 1. Executive Summary

This report refreshes the original Findings reconnaissance against current `main` at commit
`1e05a4ebc34da200f39fc2127d892a1f1f735c02`.

The requested future migration is no longer hypothetical:

- `SupabaseFindingsRepository` was implemented in commit `4248af1`.
- `usePatientFindings` selects Supabase only for `supabase-active` mode with an active tenant and configured client.
- Supabase findings use UUIDs, explicit `tenant_id` and `patient_id` filters, and the local fallback remains isolated.
- Dental Chart and Treatment Plans Supabase repositories were subsequently implemented.
- Migration `0003_add_dental_chart_links_to_findings.sql` added structured chart-editor link fields.

The current repository is operational, but it is not domain-complete. The most important remaining
gap is the mismatch between the source-document finding lifecycle and the legacy lifecycle encoded
in TypeScript, UI logic, tests, and the database constraint. The current hard-delete behavior also
conflicts with the medical history and archive rules.

Therefore:

- A duplicate `FINDINGS-REAL-001A` implementation task must not be started.
- Dental Chart reconnaissance is not a prerequisite for Findings; there is no direct chart FK, and
  Dental Chart migration has already been completed.
- `STATUS-MODEL-ALIGN-001` is required before Findings can be considered domain-complete.
- Treatment Plans are no longer blocked by local finding IDs in Supabase mode.

No application code, migrations, seed data, tests, packages, configuration, or backend files were
changed during this report-only task.

## 2. Files Inspected

### Source documents

- `_ai_work/SOURCES/00_PROJECT_MASTER_CONTEXT.md`
- `_ai_work/SOURCES/01_PRODUCT_VISION_AND_BUSINESS_MODEL.md`
- `_ai_work/SOURCES/03_MULTI_TENANT_ARCHITECTURE_RULES.md`
- `_ai_work/SOURCES/04_DATA_ISOLATION_AND_SECURITY.md`
- `_ai_work/SOURCES/05_MEDICAL_DOMAIN_MODEL.md`
- `_ai_work/SOURCES/06_PATIENT_CARD_AND_DENTAL_CHART_RULES.md`
- `_ai_work/SOURCES/07_TREATMENT_PLAN_AND_DOCUMENTS.md`
- `_ai_work/SOURCES/11_BACKEND_AND_API_ARCHITECTURE.md`
- `_ai_work/SOURCES/13_STORAGE_AND_MIGRATION_STRATEGY.md`
- `_ai_work/SOURCES/15_AI_WORKFLOW_FOR_JULES_CODEX_CHATGPT.md`
- `_ai_work/SOURCES/16_DEVELOPMENT_ROADMAP_AND_TASK_BACKLOG.md`
- `_ai_work/SOURCES/17_TASK_TEMPLATE_AND_PR_REVIEW_CHECKLIST.md`
- `_ai_work/SOURCES/18_TESTING_AND_QUALITY_ASSURANCE_STRATEGY.md`

`19_TOOL_REGISTRY_AND_USAGE_POLICY.md` and `Рабочее-правило-проекта-20.txt` were not present under
the expected names on current `main`.

### Findings implementation and storage

- `src/data/repositories/FindingsRepository.ts`
- `src/data/repositories/FindingsRepository.test.ts`
- `src/data/hooks/usePatientFindings.ts`
- `src/data/hooks/usePatientFindings.test.tsx`
- `src/utils/storage.ts`
- `src/types/index.ts`
- `src/data/seed.ts`

### Findings consumers and workflow

- `src/components/dental/FindingsRisksTab.tsx`
- `src/components/dental/FindingModal.tsx`
- `src/components/dental/DentalChartTab.tsx`
- `src/components/dental/ToothEditorModal.tsx`
- `src/components/dental/ToothGrid.tsx`
- `src/components/treatment/CreatePlanFromFindingsModal.tsx`
- `src/components/treatment/TreatmentPlansTab.tsx`
- `src/components/treatment/TreatmentPlanModal.tsx`
- `src/components/treatment/TreatmentPlanPatientPreview.tsx`
- `src/data/hooks/useClinicalWorkflow.ts`
- `src/data/orchestrators/ClinicalWorkflowOrchestrator.ts`
- `src/data/aggregators/ClinicalSummaryAggregator.ts`
- `src/data/hooks/usePatientMedicalSummary.ts`

### Related repositories

- `src/data/repositories/PatientRepository.ts`
- `src/data/repositories/ChiefComplaintRepository.ts`
- `src/data/repositories/DentalChartRepository.ts`
- `src/data/repositories/TreatmentPlansRepository.ts`
- `src/data/repositories/AppointmentRepository.ts`
- `src/data/hooks/useDentalChart.ts`
- `src/data/hooks/useTreatmentPlans.ts`

### Schema and seed

- `supabase/migrations/0001_initial_schema.sql`
- `supabase/migrations/0002_add_dental_chart_editor_fields_to_tooth_states.sql`
- `supabase/migrations/0003_add_dental_chart_links_to_findings.sql`
- `supabase/seed.sql`

### Relevant tests

- `src/data/hooks/useClinicalWorkflow.test.tsx`
- `src/data/orchestrators/ClinicalWorkflowOrchestrator.test.ts`
- `src/data/aggregators/ClinicalSummaryAggregator.test.ts`
- `src/data/repositories/TreatmentPlansRepository.test.ts`
- `src/components/dental/ToothEditorModal.test.tsx`
- `src/components/dental/ToothGrid.test.tsx`

### Previous reports

- `RECON-TREATMENT-REAL-001_treatment_plans_repository_supabase_migration_plan.md`
- `RECON-TREATMENT-REAL-002_treatment_plans_supabase_migration_refresh_after_findings_dentalchart.md`
- `RECON-DENTALCHART-REAL-001_dental_chart_repository_supabase_migration_plan.md`
- `FINDINGS-REAL-001A_supabase_findings_repository_implementation.md`
- `FINDINGS-REAL-001B_real_browser_qa_supabase_findings.md`
- `DENTALCHART-REAL-001A_supabase_dental_chart_repository_implementation.md`
- `DENTALCHART-REAL-001B_real_browser_qa_supabase_dental_chart.md`
- `CHIEF-REAL-001B_supabase_chief_complaint_browser_qa.md`
- `PATIENT-REAL-001B_supabase_patient_repository_browser_qa.md`
- `APPOINTMENT-REAL-001B_real_browser_qa_supabase_appointments.md`

## 3. Current FindingsRepository Shape

The current interface is:

```ts
interface FindingsRepository {
  listFindingsByPatient(patientId: string): Promise<DentalFinding[]>;
  createFinding(patientId: string, finding: CreateFindingInput): Promise<void>;
  updateFinding(patientId: string, finding: DentalFinding): Promise<void>;
  deleteFinding(patientId: string, findingId: string): Promise<void>;
}
```

### Local implementation

`LocalStorageFindingsRepository` delegates to `storage`:

- `getFindings(patientId)`
- `addFinding(patientId, finding)`
- `updateFinding(patientId, finding)`
- `deleteFinding(patientId, findingId)`

The local store key is `df_dental_findings`. New local records use `crypto.randomUUID()`, but the
demo seed still contains legacy IDs `f1`, `f2`, and `f3`.

### Supabase implementation

`SupabaseFindingsRepository` is already implemented and:

- accepts `tenantId` and an injected `SupabaseClient`;
- reads from `findings`;
- explicitly filters list/update/delete by `tenant_id`;
- filters list/update/delete by `patient_id`;
- filters update/delete by finding `id`;
- orders patient findings by `created_at DESC`;
- generates `crypto.randomUUID()` before insert;
- maps between camelCase frontend fields and snake_case database columns;
- retries create/update without link fields when the deployed schema lacks migration `0003`.

### Factory and backend mode

The factory already matches the requested pattern:

```ts
createFindingsRepository({
  backend,
  tenantId,
})
```

It returns Supabase only when:

- `backend === 'supabase'`;
- `tenantId` is truthy;
- the shared Supabase client exists.

Otherwise it returns `LocalStorageFindingsRepository`.

`usePatientFindings` computes `backend: 'supabase'` only when:

- `authMode === 'supabase-active'`;
- `activeTenant?.tenantId` exists;
- `isSupabaseConfigured` is true.

The repository is memoized with `useMemo`, and the query function is memoized with `useCallback`, so
the hook does not recreate the repository on each render and does not introduce a refetch loop.

### Coupling

The repository is directly coupled to:

- `patientId`, required on every method;
- optional `toothNumber`;
- optional structured clinical links added by migration `0003`.

It is not directly coupled to:

- `chartId`;
- `complaintId`;
- `planId`;
- `appointmentId`;
- a tooth-state row ID.

## 4. Current DentalFinding Frontend Model

Current fields:

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | UUID in Supabase; legacy arbitrary string possible in local/demo mode |
| `patientId` | `string` | Required; UUID in Supabase mode |
| `toothNumber` | `number?` | Optional FDI number; no chart/tooth FK |
| `title` | `string` | Required |
| `category` | `FindingCategory` | Legacy code enum |
| `severity` | `low \| medium \| high \| urgent` | Matches current DB check |
| `description` | `string` | Required, but may be an empty string |
| `riskDescription` | `string?` | Optional; UI/orchestrator may supply an empty string |
| `recommendation` | `string?` | Optional; UI/orchestrator may supply an empty string |
| `isChiefComplaintRelated` | `boolean` | Boolean only; no complaint ID |
| `includeInTreatmentPlan` | `boolean` | Planning intent flag; no plan ID |
| `status` | `FindingStatus` | Legacy lifecycle, analyzed below |
| `clinicalZone` | `ClinicalZone?` | Added for chart/editor linking |
| `diagnosisIds` | `string[]?` | Dictionary IDs stored as `text[]`, not relational FKs |
| `plannedWorkIds` | `string[]?` | Dictionary IDs stored as `text[]` |
| `plannedWorkRecordIds` | `string[]?` | Record IDs stored as `text[]` |
| `createdAt` | `string` | ISO timestamp from DB/local storage |
| `updatedAt` | `string` | ISO timestamp from DB/local storage |

The model has no direct chief complaint, treatment plan, appointment, or dental chart identifier.
Treatment Plans hold the reverse link through `TreatmentStage.findingIds`.

## 5. Status Model Analysis

### Canonical source-document statuses

The medical domain and dental chart rules define:

- `discovered`
- `planned`
- `in_treatment`
- `completed`
- `declined_by_patient`
- `monitoring`
- `archived`

The documented active statuses are `discovered`, `planned`, `in_treatment`, and `monitoring`.

### Current code and database statuses

Current TypeScript, UI filters, tests, orchestrator logic, and the database check constraint use:

- `discovered`
- `recommended`
- `included_in_plan`
- `observing`
- `declined_by_patient`
- `completed`

### Exact mismatch

| Current | Canonical | Assessment |
|---|---|---|
| `discovered` | `discovered` | Direct match |
| `recommended` | no direct status | Recommendation is better represented as content/decision metadata; provisional mapping to `discovered` |
| `included_in_plan` | `planned` | Direct lifecycle rename |
| `observing` | `monitoring` | Direct lifecycle rename |
| no value | `in_treatment` | Missing; current Findings cannot represent treatment started |
| `completed` | `completed` | Direct match |
| `declined_by_patient` | `declined_by_patient` | Direct match |
| no value | `archived` | Missing; blocks compliant archive behavior |

Statuses are embedded in:

- `src/types/index.ts`;
- `0001_initial_schema.sql`;
- `FindingModal`;
- `FindingsRisksTab`;
- `DentalChartTab`;
- `ToothGrid`;
- treatment plan selection and preview components;
- `ClinicalWorkflowOrchestrator`;
- `ClinicalSummaryAggregator`;
- repository, hook, orchestrator, chart, and treatment tests.

### Mapping safety

`included_in_plan -> planned` and `observing -> monitoring` are safe semantic renames.

`recommended -> discovered` is not fully lossless unless recommendation intent remains preserved in
the `recommendation` field or separate audit/event data. Unknown or malformed statuses must not be
silently converted to `completed`.

`in_treatment` and `archived` require new behavior, not just renaming.

### Recommendation

The canonical model should be the source-document model:

```text
discovered
planned
in_treatment
completed
declined_by_patient
monitoring
archived
```

`STATUS-MODEL-ALIGN-001` must coordinate TypeScript, schema constraint/backfill, UI groupings,
orchestrator transitions, summary aggregation, treatment-plan logic, tests, and browser QA.

## 6. Supabase Schema Fit

### Table and base columns

The table is `findings`:

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`
- `patient_id uuid NOT NULL`
- `tooth_number integer NULL`
- `title text NOT NULL`
- `category text NOT NULL` with a check constraint
- `status text NOT NULL DEFAULT 'discovered'` with the legacy status check
- `severity text NOT NULL` with `low/medium/high/urgent` check
- `description text NOT NULL`
- `risk_description text NULL`
- `recommendation text NULL`
- `is_chief_complaint_related boolean DEFAULT false`
- `include_in_treatment_plan boolean DEFAULT false`
- `created_at timestamptz DEFAULT now()`
- `updated_at timestamptz DEFAULT now()`

The composite FK `(tenant_id, patient_id)` references `patients(tenant_id, id)` with
`ON DELETE CASCADE`.

Migration `0003` adds:

- `clinical_zone text NULL` with a zone check;
- `diagnosis_ids text[] NOT NULL DEFAULT '{}'`;
- `planned_work_ids text[] NOT NULL DEFAULT '{}'`;
- `planned_work_record_ids text[] NOT NULL DEFAULT '{}'`.

### Indexes

- `idx_findings_tenant_patient (tenant_id, patient_id)`
- `idx_findings_tenant_patient_tooth_zone (tenant_id, patient_id, tooth_number, clinical_zone)`

### RLS

RLS is enabled. Policies allow tenant members to select, insert, and update findings in their
tenants. Delete is limited to `clinic_admin` and `clinic_owner`.

The migration explicitly warns that current policies provide tenant isolation, not final
production role authorization. The present policies do not distinguish clinical roles for
select/insert/update.

### Fit and mismatches

The mechanical field mapping is mostly compatible, but the fit is not perfect:

- The status constraint matches legacy code, not the canonical medical lifecycle.
- Booleans and timestamps have defaults but are not declared `NOT NULL`.
- `tooth_number` has no range/FDI validation and no FK to a tooth-state row.
- Clinical dictionary arrays are `text[]` without FK enforcement.
- There is no `complaint_id`, `chart_id`, `plan_id`, `appointment_id`, `archived_at`, or audit actor.
- `treatment_stages.finding_ids` is `uuid[]` but is not a relational FK to `findings`.
- `supabase/seed.sql` contains no Findings seed rows.

## 7. Dependency Analysis

| Dependency | Read | Write | ID dependency | Tenant dependency | Readiness and risk |
|---|---|---|---|---|---|
| `PatientRepository` | Findings are listed by patient | Findings require an existing patient row | Supabase patient UUID required by composite FK | Same tenant required | Ready; migrated and browser-QA reports exist |
| `ChiefComplaintRepository` | UI shows complaint and findings together | Finding stores only a boolean relationship | No complaint ID | Both repositories tenant-scoped | Mechanically ready; relationship is not traceable to a specific complaint |
| `DentalChartRepository` | Chart UI reads chart and findings separately | Orchestrator saves chart, then creates/updates finding | Shared patient UUID and tooth number only | Both must resolve the same active tenant | Implemented; no direct FK, but two writes are non-transactional |
| Tooth states | ToothGrid combines tooth fields and findings | Tooth editor can produce both tooth and finding payloads | Tooth number and dictionary IDs | Same tenant through separate repos | Implemented; duplicate/partial state can occur after one write fails |
| `TreatmentPlansRepository` | UI resolves `findingIds` against loaded findings | Orchestrator changes finding status after plan save/delete | `finding_ids uuid[]` requires Supabase finding UUIDs | Same patient and tenant expected | Implemented; UUID blocker resolved, but no FK prevents dangling references |
| `ClinicalSummaryAggregator` | Counts findings in patient overview | None | Patient ID | None in current implementation | **Not Supabase-ready:** hard-coded local repositories produce stale/wrong summary in Supabase mode |
| Patient card hooks | Findings and plans use backend-aware hooks | CRUD through repositories | Patient ID | Active tenant selects backend | Mostly ready; overview summary is the exception |
| `DentalChartTab` | Passes findings into `ToothGrid` and editor | Saves through workflow orchestrator | Tooth number | Active tenant through hooks | Ready with partial-write risk |
| `ToothEditorModal` | Reads existing findings for the selected tooth | Emits optional finding payload | No finding ID for new item | Indirect through orchestrator | Ready; creates legacy status `discovered` |
| `ToothGrid` | Filters active findings and displays zone markers | None | Tooth number | Receives already-scoped findings | Coupled to legacy statuses |
| Treatment Plan UI | Lists/selects/previews findings | Plan generation updates finding statuses | Exact finding UUID equality | Hooks use same tenant | Implemented; coupled to `included_in_plan` and `observing` |
| Patient preview | Resolves linked and additional findings | None | `stage.findingIds` | Already-scoped input | Broken links render as missing; hard delete can create them |
| Appointments | Medical summary reads appointments | No Findings write | Patient ID only | Aggregator currently local | No direct Findings repository blocker |

## 8. TreatmentPlans Blocker Analysis

The original `RECON-TREATMENT-REAL-001` blocker was valid: local findings used IDs such as `f1`,
while `treatment_stages.finding_ids` requires `uuid[]`.

Current state:

- Supabase findings are created with UUIDs.
- `ClinicalWorkflowOrchestrator` rejects non-UUID finding IDs in Supabase mode.
- `SupabaseTreatmentPlansRepository` filters invalid IDs before writing `finding_ids`.
- Current Treatment Plans repository and routing are already implemented.
- Existing local plans may still reference `f1/f2/f3`, but those plans remain in local/dev storage.
- There is no implemented import/remapping pipeline from local plans/findings into Supabase.

Migrating Findings first did solve the Supabase Treatment Plans UUID-source blocker. It did not
migrate legacy local plan references. Any future import must create an explicit old-ID-to-new-UUID
map and rewrite every `findingIds` reference; it must never send `f1/f2/f3` to UUID columns.

Findings can operate independently of Treatment Plans. The reverse link is stored in plan stages,
not in Findings. The original repository-only Treatment Plans implementation was unblocked after
Findings, and current `main` has already implemented it.

Remaining Treatment Plans risks:

- `finding_ids` has no database FK and can become dangling after finding hard delete.
- plan creation and finding status updates are sequential, not transactional;
- plan deletion and finding status restoration are sequential, not transactional;
- status semantics still use `included_in_plan` rather than canonical `planned`.

## 9. DentalChart Dependency Analysis

Findings are stored independently from Dental Chart:

- `findings` has no `dental_chart_id`;
- `dental_charts` and `tooth_states` do not store finding IDs;
- chart components load the chart and findings through separate hooks;
- the join key in the UI is `patientId + toothNumber`, optionally refined by `clinicalZone`;
- structured diagnosis/work links are duplicated into Findings as text arrays.

`DentalChartRepository` does not read or write finding IDs. `ClinicalWorkflowOrchestrator` is the
coordination layer: it saves the chart first and then lists/creates/updates findings.

Historical conclusion:

- Findings could be migrated before Dental Chart while Dental Chart remained local.
- `RECON-DENTALCHART-REAL-001` was useful for the wider workflow but was not required before the
  Findings repository adapter.

Current conclusion:

- Dental Chart reconnaissance and implementation have already occurred.
- A new Dental Chart recon is not required before any Findings repository work.
- Future status/archive changes still require Dental Chart UI regression testing because
  `ToothGrid` and `DentalChartTab` encode the current active-status set.

## 10. ID Strategy

### Current safe strategy

- Supabase finding IDs are UUIDs.
- `SupabaseFindingsRepository.createFinding` generates `crypto.randomUUID()` before insert.
- The DB also has a UUID default, but the current frontend-generated strategy is consistent with
  other project repositories and makes the ID available to the insert payload.
- Local-created Findings also use UUIDs.
- Legacy seed IDs `f1/f2/f3` remain local-only.

### Required boundary rules

- Never send legacy local IDs into `findings.id`, `patient_id`, or `finding_ids uuid[]`.
- Do not infer that a 36-character string is a valid/owned UUID; validate format and ownership.
- Supabase mode must only consume patients and findings loaded from the same Supabase tenant.
- `treatment_stages.finding_ids` must contain only UUIDs from Findings belonging to the same patient
  and tenant.

### Legacy migration

No legacy local-to-Supabase data migration exists. If one is later required:

1. Create each Supabase finding and record `{legacyId -> uuid}`.
2. Rewrite every local treatment stage `findingIds` entry using that map.
3. Reject or quarantine unmapped references.
4. Validate patient and tenant ownership before insert.
5. Preserve a migration report; do not silently drop references.

Until such a task is approved, local IDs must remain local-only.

## 11. Tenant Strategy

The existing constructor strategy is correct:

```ts
new SupabaseFindingsRepository(tenantId, supabaseClient)
```

Every Supabase operation must:

- inject `tenant_id` on insert;
- filter `tenant_id` on select/update/delete;
- filter `patient_id` on patient-scoped operations;
- rely on the composite patient FK and RLS as additional enforcement.

No-tenant behavior:

- the factory must not construct the Supabase repository;
- the hook must not issue a Supabase query;
- the current app-level no-tenant blocked screen should remain the primary UX;
- direct hook fallback to local mode is safe from network leakage but can expose demo/local data if
  the hook is ever rendered outside the app-level tenant gate.

Dev/local behavior:

- keep `LocalStorageFindingsRepository`;
- do not dual-write;
- do not fall back to local data after a Supabase query error, because that would hide backend
  failures and display stale data;
- local mode is prototype/demo storage, not production truth.

RLS requirements:

- retain tenant-membership enforcement;
- add explicit clinical role authorization in a separate security task;
- verify cross-tenant and cross-patient isolation with real integration tests;
- decide whether delete remains admin-only after archive replaces normal deletion.

## 12. Backend Selection Strategy

The requested behavior is already implemented:

```ts
createFindingsRepository({
  backend:
    authMode === 'supabase-active'
    && activeTenant?.tenantId
    && isSupabaseConfigured
      ? 'supabase'
      : 'local',
  tenantId: activeTenant?.tenantId,
})
```

Expected behavior:

| State | Repository |
|---|---|
| Supabase active + configured + tenant | `SupabaseFindingsRepository` |
| Dev mode | `LocalStorageFindingsRepository` |
| No tenant | Local fallback; app-level tenant gate should block clinical UI |
| Supabase not configured | Local fallback |

The repository and query function are memoized. Future consumers must preserve `useMemo`/stable
dependencies when a repository instance is used inside an effect or query function.

## 13. Mapping Design

### Current frontend to database mapping

| Frontend | Database | Current normalization |
|---|---|---|
| generated `id` | `id` | UUID generated in frontend |
| constructor tenant | `tenant_id` | Required |
| method `patientId` | `patient_id` | Required |
| `toothNumber` | `tooth_number` | `undefined -> null` |
| `title` | `title` | Passed through |
| `category` | `category` | Passed through |
| `severity` | `severity` | Passed through |
| `description` | `description` | Passed through, including empty string |
| `riskDescription` | `risk_description` | `undefined -> null`; empty string remains empty |
| `recommendation` | `recommendation` | `undefined -> null`; empty string remains empty |
| `isChiefComplaintRelated` | `is_chief_complaint_related` | Defaults false |
| `includeInTreatmentPlan` | `include_in_treatment_plan` | Defaults false |
| `status` | `status` | Legacy value passed through |
| `clinicalZone` | `clinical_zone` | `undefined -> null` |
| `diagnosisIds` | `diagnosis_ids` | `undefined -> []` |
| `plannedWorkIds` | `planned_work_ids` | `undefined -> []` |
| `plannedWorkRecordIds` | `planned_work_record_ids` | `undefined -> []` |

### Current database to frontend mapping

- nullable `tooth_number`, `risk_description`, `recommendation`, and `clinical_zone` become
  `undefined`;
- missing/non-array link fields become `[]`;
- timestamps are returned as strings;
- enums are type assertions, not runtime validation;
- nullable booleans are coerced with `Boolean(...)`.

### Recommended improvements for a future alignment task

- trim optional text and map empty optional strings to `null`;
- keep required `title` and `description` explicitly validated;
- validate status/category/severity at runtime when mapping DB rows;
- reject unknown medical statuses rather than silently coercing them;
- map legacy statuses through an explicit versioned migration;
- use UTC ISO strings for timestamps;
- keep `toothNumber` nullable and validate allowed FDI numbers;
- do not introduce `complaintId`, `chartId`, or `planId` until their ownership semantics and FKs are
  designed;
- do not treat dictionary text-array IDs as relational integrity.

## 14. Query Design

### Existing methods

#### `listFindingsByPatient(patientId)`

- Filter: `tenant_id = active tenant`.
- Filter: `patient_id = patientId`.
- Order: `created_at DESC`.
- Empty state: return `[]`.
- Error: throw the Supabase error; do not substitute local data.

#### `createFinding(patientId, input)`

- Validate tenant and patient context before query.
- Generate a UUID or let the DB generate one consistently.
- Insert `tenant_id` and `patient_id`.
- Normalize optional values.
- Return the created finding in a future API revision; current API returns `void` and requires a
  refetch.

#### `updateFinding(patientId, finding)`

- Filter by `tenant_id`, `patient_id`, and `id`.
- Update `updated_at`.
- Prefer returning/validating the affected row count so an ownership mismatch cannot look like a
  successful no-op.

#### `deleteFinding(patientId, findingId)`

- Current behavior is hard delete.
- Future normal workflow should archive instead.
- Any retained destructive delete must filter tenant/patient/id and be restricted/audited.

### Optional future methods

#### `listByTooth(patientId, toothNumber)`

Useful when chart data grows. Filter tenant, patient, and tooth; order by severity/status and
creation date. Do not add until there is a measured need because the patient list is currently
already loaded for the chart.

#### `listActiveByPatient(patientId)`

Should use the canonical active set:
`discovered`, `planned`, `in_treatment`, `monitoring`.
This is useful for chart and summary consistency after status alignment.

#### `listByComplaint(complaintId)`

Not implementable correctly with the current boolean-only schema. Requires a real complaint FK or
association table.

#### `listByChart(chartId)`

Not implementable correctly with the current schema. Findings are patient/tooth scoped, not chart
scoped.

## 15. Delete vs Archive Strategy

Current `deleteFinding` physically deletes rows. This is inconsistent with source-document medical
history rules:

- Findings are important medical data.
- Status changes should be traceable.
- Archived findings should remain historical.
- Hard delete should be exceptional, restricted, and audited.

Hard delete also creates an integrity problem because `treatment_stages.finding_ids` is an
unconstrained UUID array. Deleting a referenced finding leaves a dangling ID and can make previews
show "linked finding not found".

Recommendation:

- normal user action: set status to `archived`;
- optionally add `archived_at`, `archived_by`, and `archive_reason`;
- hide archived findings from normal active lists but retain them in history;
- prevent archive while an active plan requires the finding, or display a controlled warning;
- reserve hard delete for privileged data-correction/retention workflows;
- audit any destructive delete.

This requires `archived` to be added to the canonical status model and database constraint first.

## 16. Required Automated Tests

Existing tests already cover:

- local list/create/update/delete;
- factory local/Supabase selection;
- tenant and patient filters on list/update/delete;
- row mapping and null tooth handling;
- structured link fields;
- legacy-schema fallback for missing link columns;
- hook routing for Supabase, dev, and no-tenant;
- orchestrator UUID validation in Supabase mode;
- Treatment Plans filtering of invalid local finding IDs;
- chart zone markers based on findings.

Required additions for future Findings/status work:

1. Supabase-disabled hook route (`isSupabaseConfigured === false`) for `usePatientFindings`.
2. Proof that no Supabase client method is called in no-tenant/dev modes.
3. Create/update/delete error propagation tests.
4. Valid UUID format assertion for inserted finding IDs.
5. Cross-patient update/delete no-op detection or returned-row validation.
6. Empty optional string to `null` mapping.
7. Runtime handling of unknown category/severity/status rows.
8. Full canonical status mapping and backfill tests.
9. Active-status query/filter tests for `in_treatment` and `monitoring`.
10. Archive behavior tests, including archived rows excluded from active lists.
11. Treatment stage reference behavior when a finding is archived.
12. Prevention or explicit handling of hard delete for referenced findings.
13. Backend-aware `ClinicalSummaryAggregator` tests in Supabase mode.
14. RLS integration tests for tenant A vs tenant B.
15. RLS role tests for clinical read/write and admin-only destructive delete.
16. Legacy local import mapping tests if local data migration is ever approved.

## 17. Future Browser QA Plan

No browser QA was performed in this report-only task.

A future Findings lifecycle QA should:

1. Start the app with a configured local/test Supabase.
2. Log in as a mapped Supabase user.
3. Confirm an active tenant is selected.
4. Open a real Supabase patient card.
5. Create a finding from the Findings/Risks UI.
6. Create a finding from the tooth editor if supported.
7. Edit title, severity, notes, tooth, and clinical zone.
8. Change every supported canonical status.
9. Link/include the finding in a treatment plan.
10. Confirm plan stages contain the finding UUID.
11. Reload and verify persistence.
12. Confirm ToothGrid markers match the current finding zone/status.
13. Confirm the patient overview summary uses Supabase findings.
14. Archive the finding and verify it leaves active views but remains in history.
15. Verify a referenced finding cannot be silently hard-deleted.
16. Test a second patient in the same tenant for patient isolation.
17. Test another tenant for tenant isolation when a safe fixture exists.
18. Verify no-tenant state makes no Findings request.
19. Verify dev/local fallback remains local.
20. Inspect console and network for React errors, PostgREST errors, RLS failures, duplicate writes,
    invalid UUIDs, and unexpected localStorage reads.
21. Confirm Treatment Plans and Dental Chart do not crash after reload/status changes.

## 18. Risks and Blockers

### BLOCKER

1. **Duplicate implementation task is obsolete.** `FINDINGS-REAL-001A` is already merged. Starting
   it again risks replacing working behavior based on an outdated report.
2. **Canonical lifecycle cannot be implemented with the current DB constraint.** `planned`,
   `in_treatment`, `monitoring`, and `archived` are not all accepted by the current schema, while
   legacy values remain embedded throughout the app.
3. **Compliant archive is impossible in the current model.** There is no `archived` status or archive
   metadata, so replacing hard delete requires status/schema work.

### HIGH RISK

1. **Hard delete of medical findings.** This conflicts with history rules and can leave dangling
   `treatment_stages.finding_ids`.
2. **Patient overview uses local Findings in Supabase mode.** `ClinicalSummaryAggregator` directly
   imports local repositories, so the overview can disagree with Findings, Dental Chart, and
   Treatment Plans tabs after reload or on another device.
3. **RLS is tenant-only for read/write.** Any tenant member can select/insert/update Findings; final
   clinical role authorization is not implemented.
4. **Multi-repository writes are non-transactional.** Chart-save/finding-save and
   plan-save/finding-status updates can partially succeed.
5. **No status-change audit trail.** Medical lifecycle changes overwrite the row without actor,
   reason, or history.

### MEDIUM RISK

1. `recommended` has no lossless canonical status mapping without preserving recommendation intent.
2. Optional text empty strings are stored as empty strings instead of `null`.
3. Legacy-schema retry can save a finding while silently omitting structured link fields if
   migration `0003` is absent.
4. Dictionary ID arrays have no FK validation.
5. `tooth_number` has no FDI constraint and no tooth-state FK.
6. Update/delete do not verify that a row was actually affected.
7. Local seed records retain `f1/f2/f3`; safe today only because backend modes are isolated.
8. Findings browser QA reports did not fully verify no-tenant and unrelated-patient isolation.

### LOW RISK

1. The repository returns `void` after mutations and always refetches.
2. Patient-level lists are filtered in memory for tooth/status views.
3. Database boolean/timestamp defaults are not accompanied by `NOT NULL`.
4. Appointment dependency is indirect and currently limited to the local-only summary aggregator.

## 19. Strategy Options

### Strategy A: Migrate Findings first and keep Dental Chart local fallback

Historical status: already executed.

Pros:

- Findings has no chart FK.
- Supabase UUIDs unblock `treatment_stages.finding_ids`.
- Small repository boundary and low migration blast radius.
- Local/dev mode remains isolated.

Cons:

- Originally created a mixed-backend clinical workflow.
- Did not address canonical statuses or archive semantics.
- Summary aggregation remained local-only.

Risk: medium. Mechanically safe, but incomplete as a clinical-domain migration.

### Strategy B: Recon Dental Chart first, then migrate Findings and Dental Chart

Historical status: not required for Findings; Dental Chart recon and implementation later completed.

Pros:

- Allows end-to-end chart/finding workflow analysis before combined changes.
- Makes persistence behavior easier to QA across devices.

Cons:

- Findings does not depend on chart IDs, so it would have delayed the UUID blocker unnecessarily.
- A combined implementation would have had a larger blast radius.

Risk: medium-high if implemented together; low as reconnaissance only.

### Strategy C: Align status model first, then migrate/rework Findings

Current recommended next direction.

Pros:

- Aligns source documents, schema, repository, UI, summaries, and plans.
- Enables `in_treatment`, `monitoring`, and compliant `archived`.
- Prevents another compatibility layer around legacy statuses.
- Creates a sound basis for medical history and audit work.

Cons:

- Requires a coordinated schema migration and data backfill.
- Touches many components and tests.
- Requires explicit treatment-plan transition rules.
- Requires browser QA and rollback planning.

Risk: high if done casually; acceptable when isolated as `STATUS-MODEL-ALIGN-001` with a reviewed
mapping and migration plan.

### Recommendation

Do not repeat Strategy A and do not block on another Dental Chart recon. Preserve the current
working repository, then perform Strategy C as a separately scoped task. After status alignment,
address the Supabase-aware clinical summary and archive/audit behavior.

## 20. Final Verdict

### Checks

- `npm run lint`: PASS with 2 existing warnings and 0 errors.
  - `src/components/dental/DentalChartTab.tsx:165`: unused
    `react-hooks/set-state-in-effect` disable directive.
  - `src/data/hooks/useDictionaries.tsx:78`: `react-refresh/only-export-components`.
  - Neither warning was caused by this report-only change.
- `npm run test -- --run`: PASS, 29 test files and 208 tests passed.
- `npm run build`: PASS. Vite reported the existing advisory that one minified chunk is larger than
  500 kB; this is unrelated to the report-only change.

### Explicit verdicts

**FINDINGS-REAL-001A: NOT READY**

Reason: the implementation task is obsolete because `SupabaseFindingsRepository` is already merged
and used. A replacement implementation should not start from the old plan. Any further
domain-complete Findings work must first resolve status and archive semantics.

**RECON-DENTALCHART-REAL-001: NOT REQUIRED BEFORE FINDINGS IMPLEMENTATION**

Reason: Findings has no direct Dental Chart FK and historically could be migrated independently.
Dental Chart reconnaissance and implementation are also already complete on current `main`.

**STATUS-MODEL-ALIGN-001: REQUIRED BEFORE FINDINGS IMPLEMENTATION**

Reason: required before any replacement/domain-complete Findings implementation or archive
behavior. It is not required merely to keep the already-merged legacy adapter running.

**TREATMENTPLANS IMPLEMENTATION: READY**

Reason: the Findings UUID blocker was resolved and `SupabaseTreatmentPlansRepository` is already
implemented. Remaining status, dangling-reference, and transaction risks require follow-up but do
not recreate the original `finding_ids uuid[]` blocker.

### Scope confirmation

This task changed only:

- `_ai_work/REPORTS/RECON-FINDINGS-REAL-001_findings_repository_supabase_migration_plan.md`

It did not change:

- `src/`
- `backend/`
- `supabase/migrations/`
- `supabase/seed.sql`
- `package.json`
- `package-lock.json`
- `.env*`
- `scripts/`
- tests
- configuration

## 21. Recommended Next Task

**STATUS-MODEL-ALIGN-001 — Align DentalFinding lifecycle and archive semantics**

Prepare and implement one coordinated, reviewed change that maps legacy statuses
(`recommended`, `included_in_plan`, `observing`) to the canonical lifecycle, adds
`in_treatment` and `archived`, updates the database constraint/backfill, replaces normal hard delete
with archive behavior, updates all chart/treatment/summary consumers, and adds tenant/RLS,
transition, reference-integrity, and browser QA coverage. This is the highest-value next step
because the repository migration already exists and the remaining risk is semantic and medical,
not basic Supabase connectivity.
