# RESEARCH-003: DentalFlow Clinical Domain Model v2

## 1. Title

RESEARCH-003 / ARCH-next - Design DentalFlow clinical domain model v2 from sandbox lessons.

## 2. Scope

This is a documentation-only design task. It defines a backend-ready clinical domain model for DentalFlow without changing the current MVP implementation.

The goal is not to replace current localStorage types today. The goal is to create a DentalFlow-owned target model that future repository/API work can move toward safely.

In scope:

- Summarize the current MVP clinical model.
- Define target backend-ready entities.
- Map current localStorage/MVP entities to the v2 model.
- Preserve the current incremental DAL migration strategy.
- Document licensing and source boundaries for DentalERP and DentalPin lessons.

Out of scope:

- Application code changes.
- `src/` changes.
- Backend changes.
- Storage/type rewrites.
- Migrations, Prisma, SQL, or ORM schema files.
- Direct use of DentalERP or DentalPin code/schema.
- Immediate rewrite of the MVP.

## 3. Inputs Reviewed

Research and architecture reports:

- `_ai_work/RESEARCH/dental_crm_open_source_candidates.md`
- Local sandbox audit notes from `RESEARCH-002 - Dental CRM sandbox audit`
- `_ai_work/REPORTS/ARCH-043_clinical_dal_boundary_map.md`
- `_ai_work/REPORTS/ARCH-047_clinical_workflow_orchestrator_report.md`
- `_ai_work/REPORTS/ARCH-048_review_orchestrator_tests_and_clinical_hooks_boundary.md`
- `_ai_work/REPORTS/ARCH-053_review_dental_chart_fix_next_clinical_slice.md`
- `_ai_work/REPORTS/ARCH-055_review_findings_migration_treatmentplans_boundary.md`

Current MVP model and persistence:

- `src/types/index.ts`
- `src/utils/storage.ts`

Current clinical repositories, hooks, and orchestrator:

- `src/data/repositories/DentalChartRepository.ts`
- `src/data/repositories/FindingsRepository.ts`
- `src/data/repositories/TreatmentPlansRepository.ts`
- `src/data/repositories/ChiefComplaintRepository.ts`
- `src/data/orchestrators/ClinicalWorkflowOrchestrator.ts`
- `src/data/hooks/useDentalChart.ts`
- `src/data/hooks/usePatientFindings.ts`
- `src/data/hooks/useTreatmentPlans.ts`
- `src/data/hooks/useClinicalWorkflow.ts`
- `src/data/hooks/useChiefComplaint.ts`
- `src/data/aggregators/ClinicalSummaryAggregator.ts`
- `src/data/hooks/usePatientMedicalSummary.ts`

Clinical UI behavior reviewed for mapping only:

- `src/components/dental/DentalChartTab.tsx`
- `src/components/dental/FindingsRisksTab.tsx`
- `src/components/dental/FindingModal.tsx`
- `src/components/treatment/TreatmentPlansTab.tsx`
- `src/components/treatment/TreatmentPlanModal.tsx`
- `src/components/treatment/CreatePlanFromFindingsModal.tsx`
- `src/components/schedule/AppointmentModal.tsx`
- `src/pages/SchedulePage.tsx`

## 4. Licensing / Source Boundary

DentalERP:

- May be used as a high-level checklist/reference because it is MIT licensed.
- Useful for comparing module coverage: patients, appointments, staff, billing, prescriptions, inventory, lab, documents, communications, and imports.
- Should not be imported wholesale. It has regional assumptions, broad monolithic schema shape, dependency audit issues, and test failures in sandbox review.

DentalPin:

- May be used only as architectural inspiration/reference unless licensing is reviewed.
- It was useful for thinking about odontogram state, treatment actions, treatment-tooth joins, treatment plan lifecycle, and audit/history.
- Its Business Source License restrictions make it unsafe as a direct code source for DentalFlow's SaaS direction without separate legal/commercial clearance.

DentalFlow boundary decision:

- No third-party code was copied.
- No third-party table definitions or exact implementation were copied.
- No third-party schema should be copied in later tasks.
- DentalFlow v2 must remain our own model, based on our product needs, local MVP behavior, and backend/SaaS readiness.

## 5. Sandbox Lessons Summary

DentalERP is the safer legal checklist, but not the better architecture base. It is useful for reminding us which product areas a full dental CRM may eventually need: billing, lab, inventory, prescriptions, documents, communications, insurance, and imports. Its broad schema should be treated as coverage inspiration only.

DentalPin is more useful for clinical architecture. The strongest ideas are conceptual:

- Separate current tooth state from historical clinical events.
- Model a treatment/action separately from a treatment plan.
- Use a join entity when a treatment touches several teeth or surfaces.
- Treat treatment plans as lifecycle containers, not as the only place where clinical work exists.
- Keep appointment scheduling separate from treatment execution, with a join for what was planned/performed during a visit.
- Add immutable audit events for clinical traceability.

These lessons support the current DentalFlow direction: continue the safe DAL migration and design backend-ready domain boundaries before writing backend code.

## 6. Current MVP Clinical Model Summary

| Current model | What it represents now | Missing for backend readiness | Later mapping/migration |
|---|---|---|---|
| `Patient` | Core profile with contact, source, status, notes, allergy, balance, bonus, and integration metadata. | No tenant/clinic ownership, no actor fields, no full medical identity, no server-side lifecycle, no direct separation between demographic and clinical domains. | Remains `Patient`; clinical state should live in separate patient-scoped entities. |
| `DentalChart` | One chart per patient, stored by patient id, containing text fields and an array of tooth records. | Chart owns all teeth as an embedded array; no per-tooth ids; no history; no audit; text complaints/diagnosis are mixed with odontogram state. | `DentalChart.teeth` becomes many `ToothRecord` rows. Text fields move to clinical notes or summary/read model track later. |
| `ToothRecord` | Current state of one FDI tooth inside the chart. Stores condition, surfaces, crown/root/gum/bone/canal notes, notes, updatedAt. | No `id`, no `patientId`, no lifecycle, no actor, no history, no precise surface/canal/perio model, no separate clinical events. | Becomes first-class `ToothRecord`; changes create `ClinicalAuditEvent` entries. |
| `DentalFinding` | Clinical problem/risk/diagnostic finding. Can be linked to tooth number and flagged for treatment plan inclusion. | Tooth link is only `toothNumber`; no `toothRecordId`; no finding source normalization; no actor; no audit; no explicit link to treatments except later stage `findingIds`. | Becomes `ClinicalFinding`; may link to `ToothRecord` and later to `Treatment` or `TreatmentPlanItem`. |
| `ChiefComplaint` | Patient complaint text and related tooth numbers. Loaded by hook and shown in Findings/Risks and summary. | No visit context, no actor, no source/triage status, no relationship to findings except boolean flag on findings. | Keep as separate model short term, or map to future `PatientClinicalNote`; may serve as `ClinicalFinding.source` for generated findings. |
| `TreatmentPlan` | Plan container with title, status, embedded stages, totalPrice, timestamps. | Stages are embedded; no separate `Treatment`; no join to appointments; no approval actor; no actual vs estimated cost split; no audit. | Becomes `TreatmentPlan` plus many `TreatmentPlanItem` rows. |
| `TreatmentStage` | Line/stage inside a treatment plan; has title, teeth array, description, price, status, findingIds, source. | Mixes plan item, clinical treatment, tooth links, price, and finding references in one embedded object. | Maps to `TreatmentPlanItem`; may later generate/link `Treatment` and `TreatmentTooth`. |
| `Appointment` | Schedule item with doctor, cabinet, service, time, status, payment/source/price/comment. | No treatment link, no visit/procedure completion boundary, no audit events, no clinical outcome model. | Remains scheduling source; link to clinical work through `AppointmentTreatment`. |
| `ClinicalSummaryAggregator` / `usePatientMedicalSummary` | Read-only summary: tooth counts, missing teeth, active plans, totals, chief complaint, finding counts, visits. | Reads localStorage directly; it is a projection, not source of truth; no server cache invalidation strategy yet. | Becomes read model/projection fed by backend entities and events. |

Current DAL state:

- `DentalChartRepository`, `FindingsRepository`, and `TreatmentPlansRepository` are intentionally narrow.
- `ClinicalWorkflowOrchestrator` owns cross-domain flows:
  - tooth status change plus finding synchronization;
  - treatment plan creation from selected findings.
- `DentalChartTab` and `FindingsRisksTab` are already moving through hooks.
- `TreatmentPlansTab` and its modals are the next risky area; `CreatePlanFromFindingsModal` remains the cross-domain hotspot.

## 7. Target Domain Model v2 Overview

The target v2 model separates five concepts that are currently blended together:

- Patient identity/profile.
- Current tooth state.
- Clinical findings/diagnoses/risks.
- Clinical treatments/actions.
- Plans, appointments, and audit events around those actions.

Target source-of-truth entities:

- `Patient`
- `ToothRecord`
- `ClinicalFinding`
- `Treatment`
- `TreatmentTooth`
- `TreatmentPlan`
- `TreatmentPlanItem`
- `AppointmentTreatment`
- `ClinicalAuditEvent`

Target read models/projections:

- Patient medical summary.
- Dental chart visual summary.
- Patient list visit summary.
- Treatment plan preview.
- Future financial summaries.

## 8. Entity Definitions

### A. Patient

Purpose:

- Core patient profile.
- Owns patient identity and contact/business metadata.
- Should not own clinical state directly.

Ownership boundary:

- Patient/profile domain.
- Future backend owner: Patient API/repository.
- Clinical modules reference `patientId`; they do not embed themselves inside `Patient`.

Required fields:

- `id`
- `fullName`
- `phone`
- `status`
- `createdAt`
- `updatedAt`

Optional fields:

- `birthDate`
- `source`
- `notes`
- `allergies`
- `balance`
- `bonusBalance`
- `integration`
- future `clinicId`
- future `tenantId`
- future `createdBy`
- future `updatedBy`

Relationships:

- Has many `ToothRecord`.
- Has many `ClinicalFinding`.
- Has many `Treatment`.
- Has many `TreatmentPlan`.
- Has many `Appointment`.
- Has many `ClinicalAuditEvent`.

Lifecycle/status fields:

- Current MVP `status` remains.
- Future statuses may need stronger states: active, archived, deceased, duplicate, merged.

Audit fields:

- `createdAt`
- `updatedAt`
- future `createdBy`
- future `updatedBy`
- important profile changes may also create `ClinicalAuditEvent` only if clinically relevant.

Backend/API notes:

- `Patient` is a root aggregate for patient profile reads.
- Clinical subresources should be loaded separately: `/patients/:id/tooth-records`, `/patients/:id/findings`, `/patients/:id/treatment-plans`.
- Avoid returning all clinical history inside a generic patient list API.

Mapping from current MVP/localStorage:

- Current `Patient` maps mostly 1:1.
- Add `updatedAt` during migration because current type only guarantees `createdAt`.
- Keep integration metadata, but do not couple clinical data to AmoCRM/lead fields.

### B. ToothRecord

Purpose:

- Current clinical state of a specific tooth for a patient.
- Represents "what is true now" on the dental chart, not the entire history of the tooth.

Ownership boundary:

- Dental chart / odontogram domain.
- Future backend owner: Tooth/DentalChart repository or API resource.

Required fields:

- `id`
- `patientId`
- `toothNumber`
- `status` or `condition`
- `surfaces`
- `createdAt`
- `updatedAt`

Optional fields:

- `crown`
- `root`
- `canal`
- `gum`
- `bone`
- `notes`
- `mobility`
- `perioStatus`
- `implantStatus`
- `lastExaminedAt`
- `lastExaminedBy`

Relationships:

- Belongs to `Patient`.
- May have many `ClinicalFinding`.
- May have many `TreatmentTooth`.
- Changes are recorded by `ClinicalAuditEvent`.

Lifecycle/status fields:

- `condition`: healthy, caries, filled, missing, crown, implant, root, pulpitis, periodontitis, needs_treatment.
- Future model may split condition into multiple dimensions instead of one enum.

Audit fields:

- `createdAt`
- `updatedAt`
- future `updatedBy`
- detailed history through `ClinicalAuditEvent`.

Backend/API notes:

- Enforce uniqueness for `(patientId, toothNumber)`.
- Do not overload `ToothRecord` with historical events.
- Do not store every old condition inside this entity.
- API should support patching one tooth without rewriting the whole chart.

Mapping from current MVP/localStorage:

- `DentalChart.teeth[]` becomes one `ToothRecord` per tooth.
- Current embedded tooth fields map directly where present.
- Missing `id` and `patientId` are generated during migration.
- Every migrated row can use the parent chart timestamps as initial values.

### C. ClinicalFinding

Purpose:

- Clinical problem, risk, diagnostic observation, or recommendation that may require monitoring or treatment.

Ownership boundary:

- Findings/Risks clinical domain.
- Future backend owner: Clinical findings repository/API.

Required fields:

- `id`
- `patientId`
- `category`
- `severity`
- `status`
- `title`
- `description`
- `includeInTreatmentPlan`
- `createdAt`
- `updatedAt`

Optional fields:

- `toothRecordId`
- `toothNumber`
- `riskDescription`
- `recommendation`
- `source`
- `chiefComplaintId`
- `createdBy`
- `updatedBy`
- `resolvedAt`
- `resolvedBy`

Relationships:

- Belongs to `Patient`.
- May relate to `ToothRecord`.
- May relate to `TreatmentPlanItem` through `clinicalFindingId`.
- May relate to `Treatment` through future finding/treatment references.
- Changes are recorded by `ClinicalAuditEvent`.

Lifecycle/status fields:

- Current statuses: discovered, recommended, included_in_plan, observing, declined_by_patient, completed.
- Future status transitions should be explicit and validated server-side.

Audit fields:

- `createdAt`
- `updatedAt`
- future actor fields.
- `ClinicalAuditEvent` for status changes, recommendation changes, and deletion/archive decisions.

Backend/API notes:

- Preserve `toothNumber` even when `toothRecordId` is null, because some findings are mouth-level or created before a tooth record exists.
- `source` should distinguish manual entry, tooth chart workflow, chief complaint, import, AI suggestion, or future template.
- Avoid hiding treatment-plan mutations inside the findings repository.

Mapping from current MVP/localStorage:

- `DentalFinding` maps to `ClinicalFinding`.
- `isChiefComplaintRelated` maps to `chiefComplaintId` or `source = chief_complaint` later.
- `toothNumber` may resolve to `ToothRecord.id` during migration.
- `includeInTreatmentPlan` remains an eligibility hint, not proof that a treatment exists.

### D. Treatment

Purpose:

- Actual clinical treatment/action to be performed, currently being performed, or already performed.
- It is not the same thing as a plan.

Distinction from `TreatmentPlan`:

- `Treatment` is the clinical/service action.
- `TreatmentPlan` is the planned grouping, sequence, approval, and commercial/clinical container.

Ownership boundary:

- Clinical treatment domain.
- Future backend owner: Treatment repository/API.

Required fields:

- `id`
- `patientId`
- `title` or `name`
- `status`
- `createdAt`
- `updatedAt`

Optional fields:

- `clinicalCode`
- `serviceCode`
- `category`
- `description`
- `plannedAt`
- `startedAt`
- `completedAt`
- `estimatedPrice`
- `actualPrice`
- `currency`
- `doctorId`
- `notes`
- `source`

Relationships:

- Belongs to `Patient`.
- Has many `TreatmentTooth`.
- May be referenced by `TreatmentPlanItem`.
- May be referenced by `AppointmentTreatment`.
- May originate from `ClinicalFinding`.
- Changes are recorded by `ClinicalAuditEvent`.

Lifecycle/status fields:

- Suggested statuses: proposed, planned, approved, in_progress, completed, cancelled, declined.
- The current MVP has only stage statuses; v2 should make treatment lifecycle explicit.

Audit fields:

- `createdAt`
- `updatedAt`
- future `createdBy`
- future `updatedBy`
- `ClinicalAuditEvent` for status and price changes.

Backend/API notes:

- Do not confuse a service catalog item with a performed/planned patient-specific treatment.
- A future `ServiceCatalogItem` can supply default title, code, duration, and price.
- `Treatment` stores patient-specific intent/outcome.

Mapping from current MVP/localStorage:

- Current `TreatmentStage` may initially create `TreatmentPlanItem` only.
- In a later migration, stages that represent concrete work can generate `Treatment`.
- Stage `teeth[]` maps through `TreatmentTooth` when treatment rows are introduced.

### E. TreatmentTooth

Purpose:

- Join entity connecting a treatment to one or more teeth and surfaces.

Why it exists:

- One treatment can involve multiple teeth.
- One tooth can appear in multiple treatments over time.
- Tooth arrays inside `Treatment` or `TreatmentPlanItem` will not scale to surfaces, roles, bridges, implants, or multi-tooth work.

Ownership boundary:

- Treatment domain with references to dental chart domain.

Required fields:

- `id`
- `treatmentId`
- `toothNumber`
- `surfaces`

Optional fields:

- `toothRecordId`
- `role`
- `scope`
- `notes`
- `createdAt`
- `updatedAt`

Relationships:

- Belongs to `Treatment`.
- May reference `ToothRecord`.
- Changes are recorded through the parent treatment or a direct `ClinicalAuditEvent`.

Lifecycle/status fields:

- Usually inherits treatment lifecycle.
- `role` or `scope` may indicate primary tooth, adjacent tooth, bridge abutment, pontic, implant site, extraction target, or observation only.

Audit fields:

- `createdAt`
- `updatedAt`
- future `createdBy`
- future `updatedBy`

Backend/API notes:

- Keep `toothNumber` even when `toothRecordId` is available, because it makes clinical display and historical snapshots safer.
- Surfaces should remain structured, not free text, once backend DTOs are designed.

Mapping from current MVP/localStorage:

- `TreatmentStage.teeth[]` can create one `TreatmentTooth` per tooth after a `Treatment` exists.
- Current `ToothRecord.surfaces` can inform default surface selection, but should not be treated as treatment scope automatically.

### F. TreatmentPlan

Purpose:

- Plan container and lifecycle.
- Groups plan items, controls approval/progress/completion, and supports patient-facing previews and future commercial logic.

Ownership boundary:

- Treatment planning domain.
- Future backend owner: Treatment plan repository/API.

Required fields:

- `id`
- `patientId`
- `title`
- `status`
- `totalEstimatedPrice`
- `createdAt`
- `updatedAt`

Optional fields:

- `totalActualPrice`
- `approvedAt`
- `approvedBy`
- `startedAt`
- `completedAt`
- `cancelledAt`
- `cancelledReason`
- `notes`
- `currency`
- `version`

Relationships:

- Belongs to `Patient`.
- Has many `TreatmentPlanItem`.
- May be linked to appointments later through `AppointmentTreatment` via plan items.
- Changes are recorded by `ClinicalAuditEvent`.

Lifecycle/status fields:

- Required statuses: draft, approved, in_progress, completed, cancelled.
- Future statuses may include archived or expired, but do not add them until product behavior needs them.

Audit fields:

- `createdAt`
- `updatedAt`
- actor fields for approval/cancellation/completion.
- `ClinicalAuditEvent` for major lifecycle transitions.

Backend/API notes:

- Do not embed all plan items forever.
- Plan totals should be derived from items when possible, but cached totals are acceptable for list views if invalidated safely.
- Approval should be explicit, not inferred from status text in UI.

Mapping from current MVP/localStorage:

- Current `TreatmentPlan` maps to v2 `TreatmentPlan`.
- `totalPrice` maps to `totalEstimatedPrice`.
- `stages[]` move to `TreatmentPlanItem`.
- Current timestamps are retained.

### G. TreatmentPlanItem

Purpose:

- Item, stage, or line inside a `TreatmentPlan`.
- Orders planned work and optionally links to a `Treatment` and/or `ClinicalFinding`.

Ownership boundary:

- Treatment planning domain.

Required fields:

- `id`
- `treatmentPlanId`
- `title`
- `description`
- `orderIndex`
- `status`
- `estimatedPrice`

Optional fields:

- `treatmentId`
- `clinicalFindingId`
- `actualPrice`
- `plannedDate`
- `completedDate`
- `assignedDoctorId`
- `source`
- `notes`
- `createdAt`
- `updatedAt`

Relationships:

- Belongs to `TreatmentPlan`.
- May point to `ClinicalFinding`.
- May point to `Treatment`.
- Uses `TreatmentTooth` through the linked `Treatment`, not by owning tooth arrays long term.
- May be linked to appointments through `AppointmentTreatment`.

Lifecycle/status fields:

- Suggested statuses: planned, in_progress, completed, cancelled.
- May later need skipped, postponed, declined, or partially_completed.

Audit fields:

- `createdAt`
- `updatedAt`
- future actor fields.
- `ClinicalAuditEvent` for status, price, order, and clinical link changes.

Backend/API notes:

- In early migration, `TreatmentPlanItem` can carry the current stage data without creating `Treatment`.
- Once treatment execution is introduced, concrete work should move into `Treatment` and `TreatmentTooth`.

Mapping from current MVP/localStorage:

- `TreatmentStage` maps directly to `TreatmentPlanItem`.
- `TreatmentStage.findingIds[0]` can map to `clinicalFindingId` for simple cases.
- Multiple `findingIds` may require either several plan items or a future junction; keep this as a migration question.
- `TreatmentStage.price` maps to `estimatedPrice`.
- `TreatmentStage.teeth[]` remains legacy data until `Treatment`/`TreatmentTooth` migration.

### H. AppointmentTreatment

Purpose:

- Join between appointment/visit and a treatment or treatment plan item.

Why it exists:

- An appointment can include multiple treatments.
- A treatment can be planned before an appointment and completed during an appointment.
- Schedule should remain separate from clinical plan/execution.

Ownership boundary:

- Bridge between schedule domain and clinical treatment domain.

Required fields:

- `id`
- `appointmentId`
- `patientId`
- `status`

Optional fields:

- `treatmentId`
- `treatmentPlanItemId`
- `notes`
- `performedAt`
- `performedBy`
- `createdAt`
- `updatedAt`

Relationships:

- Belongs to `Appointment`.
- Belongs to `Patient`.
- May reference `Treatment`.
- May reference `TreatmentPlanItem`.
- Changes are recorded by `ClinicalAuditEvent`.

Lifecycle/status fields:

- Suggested statuses: planned, performed, partially_performed, cancelled, moved, not_done.

Audit fields:

- `createdAt`
- `updatedAt`
- future actor fields.
- `ClinicalAuditEvent` for linking, unlinking, and completion.

Backend/API notes:

- Appointment remains scheduling source of truth.
- `AppointmentTreatment` records what clinical work was expected or performed during the visit.
- This allows future visit notes without forcing a separate `Visit` entity immediately.

Mapping from current MVP/localStorage:

- Current `Appointment` has no clinical treatment link.
- Migration creates no `AppointmentTreatment` initially.
- Future UI can add links from appointment modal or patient visit workflow.

### I. ClinicalAuditEvent

Purpose:

- Immutable event log for clinical changes and traceability.

Ownership boundary:

- Cross-clinical audit domain.
- Written by backend services/repositories/orchestrators around meaningful clinical changes.

Required fields:

- `id`
- `patientId`
- `entityType`
- `entityId`
- `eventType`
- `createdAt`
- `source`

Optional fields:

- `actorId`
- `beforeSnapshot`
- `afterSnapshot`
- `reason`
- `comment`
- `appointmentId`
- `requestId`
- `clientMutationId`

Relationships:

- Belongs to `Patient`.
- References clinical entity by `entityType` and `entityId`.
- May reference `Appointment` when a visit causes the change.

Lifecycle/status fields:

- Immutable after creation.
- Corrections should create a new event, not edit the old one.

Audit fields:

- The event is itself the audit record.
- Store actor and source whenever available.

Backend/API notes:

- Snapshots should be minimal and purpose-driven.
- Do not store giant full-patient snapshots for every small change.
- Use event types such as:
  - tooth_status_changed
  - finding_created
  - finding_status_changed
  - treatment_created
  - treatment_completed
  - treatment_plan_approved
  - treatment_plan_item_completed
  - appointment_linked_to_treatment

Mapping from current MVP/localStorage:

- No current equivalent.
- During backend migration, start generating events for new changes.
- Historical localStorage data can be imported with a single `legacy_imported` event per patient or per domain, depending on compliance needs.

## 9. Relationship Map

Core relationships:

- `Patient` 1:N `ToothRecord`
- `Patient` 1:N `ClinicalFinding`
- `Patient` 1:N `Treatment`
- `Patient` 1:N `TreatmentPlan`
- `Patient` 1:N `ClinicalAuditEvent`
- `ToothRecord` 1:N `ClinicalFinding` where a finding is tooth-specific
- `Treatment` N:M `ToothRecord` through `TreatmentTooth`
- `TreatmentPlan` 1:N `TreatmentPlanItem`
- `TreatmentPlanItem` optional N:1 `ClinicalFinding`
- `TreatmentPlanItem` optional N:1 `Treatment`
- `Appointment` N:M `Treatment` through `AppointmentTreatment`
- `Appointment` N:M `TreatmentPlanItem` through `AppointmentTreatment`
- `ClinicalAuditEvent` references clinical entities by `entityType` and `entityId`

Text map:

```text
Patient
  -> ToothRecord
      -> ClinicalFinding
      <- TreatmentTooth -> Treatment
  -> ClinicalFinding
      -> TreatmentPlanItem
  -> TreatmentPlan
      -> TreatmentPlanItem
          -> Treatment
  -> Appointment
      -> AppointmentTreatment
          -> Treatment / TreatmentPlanItem
  -> ClinicalAuditEvent
```

## 10. MVP-to-v2 Mapping Table

| Current MVP/localStorage entity | v2 entity/entities | Migration notes |
|---|---|---|
| `Patient` | `Patient` | Add missing `updatedAt`, tenant/clinic ownership, and actor metadata later. Keep clinical state separate. |
| `DentalChart` | Container/import source, not necessarily a long-term entity | Use it to create patient-scoped tooth records. Chart-level text fields may become clinical notes or read-model fields later. |
| `DentalChart.teeth` | `ToothRecord` | Create one row per tooth with generated `id`, parent `patientId`, `toothNumber`, condition, surfaces, notes, and timestamps. |
| Current `ToothRecord` fields | `ToothRecord` plus future `ClinicalAuditEvent` | Current state maps directly; future changes should create audit events rather than storing history inside the tooth row. |
| `DentalFinding` | `ClinicalFinding` | Map category/severity/status/title/description/risk/recommendation. Resolve `toothNumber` to `toothRecordId` where possible. |
| `TreatmentPlan` | `TreatmentPlan` | Map title/status/totalPrice/timestamps. Rename `totalPrice` to estimated/actual split later. |
| `TreatmentStage` | `TreatmentPlanItem`, later `Treatment` and `TreatmentTooth` if needed | Initially map embedded stages to plan items. Later create concrete treatments for work execution and join teeth through `TreatmentTooth`. |
| `TreatmentStage.teeth` | `TreatmentTooth` after `Treatment` exists | Do not keep tooth arrays as the long-term model. |
| `TreatmentStage.findingIds` | `TreatmentPlanItem.clinicalFindingId` or future item-finding junction | One finding is simple; multiple findings need a future decision. |
| `Appointment` | `Appointment` plus future `AppointmentTreatment` | Existing schedule data stays. Clinical treatment links are added later without rewriting appointment basics. |
| `ChiefComplaint` | Keep separate short term; later `PatientClinicalNote`, `ClinicalFinding.source`, or separate `ChiefComplaint` model | Do not force it into `ClinicalFinding` immediately. Use it as context/source for findings where applicable. |
| `ClinicalSummaryAggregator` and `usePatientMedicalSummary` | Read models / projections | These are not source of truth. They should later read from API projections or backend query endpoints. |

## 11. Backend/API Readiness Notes

Source of truth:

- `Patient`
- `ToothRecord`
- `ClinicalFinding`
- `Treatment`
- `TreatmentTooth`
- `TreatmentPlan`
- `TreatmentPlanItem`
- `Appointment`
- `AppointmentTreatment`
- `ClinicalAuditEvent`

Read models/projections:

- Patient medical summary.
- Dental chart counters and badges.
- Treatment plan preview.
- Patient list visit summary.
- Future dashboard and reporting totals.

Repository/API evolution:

- Current hooks should stay stable while repository implementations move from localStorage to API calls.
- UI should depend on hook/repository contracts, not localStorage shape.
- Backend DTOs should be introduced behind the hooks before storage migration.
- Repositories should stay domain-specific.
- Cross-domain flows should remain explicit in an orchestrator/service layer.

Why UI should not depend on localStorage shape:

- LocalStorage embeds arrays and blends concerns for MVP speed.
- Backend needs separately addressable resources, validation, permissions, audit, pagination, and conflict handling.
- If UI depends only on hooks, the underlying data can move without rewriting every tab.

Treatment plan lifecycle:

- Plan lifecycle must be explicit server-side.
- Approval, start, completion, and cancellation should be intentional transitions.
- A plan should not become "approved" simply because one item changed.

## 12. Audit / Event Strategy

Clinical audit events should be added after the domain boundaries are stable and before real clinic data is migrated to backend storage.

Events to create first:

- Tooth condition/status changed.
- Finding created.
- Finding status changed.
- Treatment plan created.
- Treatment plan approved.
- Treatment plan item completed.
- Treatment completed.
- Appointment linked to treatment.

Event-writing rules:

- Events are immutable.
- Events should be created by backend services/repositories/orchestrators, not by UI components directly.
- Store actor identity when available.
- Store before/after snapshots only for the fields that matter.
- Use `source` to distinguish manual UI, import, future API, future AI suggestion, and legacy import.

Why this matters:

- Clinical data needs traceability.
- Treatment recommendations and patient decisions should be explainable later.
- Audit events make future backend/SaaS work safer for clinics, disputes, and compliance.

## 13. Migration Strategy

Stage 1 - Finish localStorage DAL/UI decoupling:

- Continue the current narrow migration.
- Keep `DentalChartTab` and `FindingsRisksTab` stable.
- Continue with `TreatmentPlansTab` simple CRUD as planned.
- Do not migrate `CreatePlanFromFindingsModal` together with simple plan CRUD.

Stage 2 - Introduce backend-ready DTO design:

- Create DTO docs/interfaces in a later task, but do not replace current MVP types immediately.
- Define API request/response shapes for tooth records, findings, treatment plans, and appointments.

Stage 3 - Introduce API repositories behind existing hooks:

- Keep hook names and UI-facing behavior stable.
- Swap repository implementation from localStorage to API per domain.
- Preserve orchestrator boundaries for cross-domain workflows.

Stage 4 - Migrate localStorage data to backend entities:

- Convert `DentalChart.teeth` to `ToothRecord`.
- Convert `DentalFinding` to `ClinicalFinding`.
- Convert `TreatmentPlan.stages` to `TreatmentPlanItem`.
- Leave `Treatment`/`TreatmentTooth` empty until treatment execution semantics are implemented, or generate them only when stage data is unambiguous.

Stage 5 - Add audit events and history:

- Start with forward-only events for new mutations.
- Add legacy import events for migrated data.
- Avoid trying to reconstruct perfect history from localStorage.

Stage 6 - Advanced dental visual/perio/implant model:

- Extend tooth surfaces, gum/perio, bone, canals, CBCT references, and implant planning only after the foundational backend model is stable.

Migration principle:

- No big bang migration.
- No immediate rewrite.
- No copying DentalPin schema.
- No replacing all current types now.

## 14. Future Dental Visual / Perio / Bone / Implant Track

Future expansion areas:

- Tooth surfaces beyond the current simple list.
- Gum and periodontal measurements.
- Bone level/loss records.
- Canal/root data.
- Implant planning.
- Prosthetic structures and bridge relationships.
- CBCT/images/attachments references.
- Per-visit odontogram snapshots.

Do not implement these in RESEARCH-003 or ARCH-056.

Recommended future task:

`DENTAL-MODEL-001 - Design extended tooth/perio/bone/implant model`

That task should decide whether advanced dental data belongs in:

- expanded `ToothRecord` fields;
- separate `PerioRecord`;
- separate `CanalRecord`;
- separate `ImplantPlan`;
- attachment/media references;
- clinical event/history records.

## 15. Open Questions

- Do we need a separate `Visit` entity, or is `Appointment` plus `AppointmentTreatment` enough for the next backend slice?
- Should `ChiefComplaint` remain separate, become a clinical note, or become a source/context field for `ClinicalFinding`?
- Should `Treatment` represent service catalog item, planned patient-specific action, performed procedure, or should those be split?
- How should multiple `DentalFinding` records map to one `TreatmentPlanItem` without losing traceability?
- How much surface/canal/gum/bone structure is needed before it overcomplicates the MVP?
- How large can audit snapshots be before storage/reporting becomes a problem?
- How should multi-doctor actor identity be represented in clinical changes?
- How should price, insurance, installment payment, and future OSMS/payment integrations connect to treatment plans?
- Should treatment plan approval require patient signature/consent later?
- Should clinical events be queryable by tooth, appointment, or plan in the first backend version?

## 16. What Must NOT Be Implemented Now

- Do not rewrite current MVP types.
- Do not replace `DentalChart`, `DentalFinding`, or `TreatmentPlan` in `src/types/index.ts`.
- Do not modify `storage.ts`.
- Do not create database schema, Prisma models, SQL, migrations, or ORM files.
- Do not change `DentalChartTab`, `FindingsRisksTab`, `TreatmentPlansTab`, or schedule UI as part of this research task.
- Do not implement `Treatment`, `TreatmentTooth`, `AppointmentTreatment`, or `ClinicalAuditEvent` yet.
- Do not introduce global state, event bus, or broad cache layer.
- Do not block ARCH-056 unless a direct conflict is found.
- Do not copy DentalERP or DentalPin code, schemas, tests, or file structures.

## 17. Recommended Next Task

Expected recommendation:

Continue with `ARCH-056 - Integrate TreatmentPlansTab simple CRUD with useTreatmentPlans only, leave CreatePlanFromFindingsModal workflow unchanged`.

Rationale:

- RESEARCH-003 does not reveal a direct conflict with ARCH-056.
- ARCH-056 is still the safest next product-code step because it continues the existing DAL/UI decoupling path.
- The future v2 model should inform naming and boundaries, but it should not stop the current TreatmentPlansTab migration.

Alternative only if the team wants one more review gate:

`ARCH-056A - Review whether TreatmentPlansTab migration should align with domain model v2 terminology before implementation`

Default decision:

- Choose ARCH-056.
- Keep it narrow.
- Do not include `CreatePlanFromFindingsModal` migration in the same PR.
- Do not introduce v2 backend entities in that PR.
