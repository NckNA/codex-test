# MACDENT-LAB-WORKFLOW-RECON-001 — Laboratory Work Domain

Date: 2026-08-19
Mode: HERMES SKILL FIRST / READ-ONLY RECON
Repository: `NckNA/codex-test`
Branch: `recon/macdent-lab-workflow-001`
Prior contract: `MACDENT-REFERENCE-RECON-001_reference_map.md`
MacDent access: dedicated authenticated V3 profile, loopback CDP `127.0.0.1:9366`
MacDent writes during RECON: `0`
amoCRM writes during RECON: `0`
Patient-identifying data recorded in this report: `0`

## Verdict

**READY for a bounded DentalFlow laboratory-work foundation, with finance linkage explicitly deferred.**

MacDent provides enough live structural evidence to establish a useful laboratory-work domain without copying its implementation. The safest DentalFlow interpretation is:

```text
LaboratoryWork = operational production order supporting dental care
```

It is not:

```text
TreatmentPlan
TreatmentStage
CompletedService
Appointment
ClinicalEncounter
Invoice
Payment
Warehouse movement
Document
```

Those entities may later be linked explicitly, but none should be merged into the laboratory order itself.

The first implementation should be deliberately smaller than the full MacDent form. It should establish tenant-safe laboratory organizations, configurable laboratory work types, laboratory work orders, milestone dates, responsible doctor, patient, anatomical scope, shade and notes. Financial settlement and material consumption must remain out of scope until separately reconciled with DentalFlow finance and future warehouse domains.

## 1. Evidence boundary

### Sources used

1. Current `origin/main` DentalFlow repository.
2. Merged `MACDENT-REFERENCE-RECON-001_reference_map.md`.
3. Existing verified Hermes Operator V3 MacDent read studies.
4. Live authenticated MacDent UI observed through the dedicated V3 CDP session.

### Live actions permitted and performed

- navigated to the MacDent laboratory-work page;
- inspected list filters/headers;
- opened the empty `Add laboratory work` modal;
- inspected empty field/select structure and selectable work-type controls;
- inspected anatomical-scope controls;
- did not select or open any real patient record;
- did not open an existing laboratory work;
- did not save, create, update, delete, export, bulk-change status or alter payment state.

The report therefore describes **structural product facts**, not patient-specific workflow history.

## 2. Live structural findings

### 2.1 Registry/list surface

The MacDent laboratory registry exposes structural columns equivalent to:

- work/order number;
- patient;
- work name;
- doctor;
- laboratory;
- sent-to-technician date;
- received-from-laboratory date;
- planned completion/delivery date;
- actual delivery/receipt date;
- status;
- paid indicator;
- payment amount;
- comment.

The page also exposes:

- export;
- add laboratory work;
- bulk mark paid;
- bulk unmark paid;
- bulk status change.

Bulk write operations were not executed.

### 2.2 Status surface

The live status filter contains only:

```text
All statuses
In progress
Completed
```

The add/edit form status selector likewise contains:

```text
In progress
Completed
```

This is an important modeling clue. MacDent does not expose a large workflow enum in this surface. Operational stage is primarily represented by milestone dates rather than by a status explosion.

No transition rules were executed or inferred.

### 2.3 Date/milestone surface

The live form independently represents:

1. sent-to-technician / work-created date;
2. received-from-laboratory date;
3. planned completion/delivery date;
4. actual final delivery/receipt date;
5. try-in date.

The visible explanatory text distinguishes these as separate operational milestones.

A future DentalFlow model should preserve these independent facts instead of reducing the whole process to a single `status_changed_at` timestamp.

### 2.4 Core identity and responsibility fields

The empty form exposes:

- work number;
- work name;
- patient selector;
- doctor selector;
- laboratory selector;
- ability to enter a new laboratory name;
- status;
- comment.

The doctor selector is populated from the clinic's provider/resource registry. No specific doctor names or identifiers are needed for this report.

The empty patient selector has no selected patient. No patient data was inspected.

### 2.5 Clinical/work specification fields

The form exposes:

- shade/color;
- try-in date;
- dental formula / anatomical selection;
- quick anatomical scope controls for upper jaw, lower jaw and oral cavity;
- multiple selectable work types;
- free-form “other” work type;
- comment.

The observed default work-type choices include several common prosthetic/restorative categories. These are evidence that **one laboratory order may have multiple work-type classifications**, not evidence that MacDent's exact taxonomy should become a DentalFlow enum.

### 2.6 Payment fields

The form exposes:

- paid boolean;
- payment amount.

However, structural UI alone does not establish the financial semantics:

- whether this represents patient payment to clinic;
- clinic payment to laboratory;
- technician settlement;
- an informational flag independent of formal accounting;
- or some historical combination.

Therefore:

```text
MacDent paid/payment amount -> OBSERVED UI FACT
Financial meaning -> UNKNOWN
```

The fields must **not** be copied into the DentalFlow laboratory schema until a finance-specific RECON establishes payer, payee, ledger ownership and reconciliation behavior.

## 3. Lifecycle/status findings

### Confirmed

The live UI confirms these current work states:

```text
in_progress
completed
```

The live UI confirms independent milestones for:

```text
sent_to_lab
planned_ready
received_from_lab
try_in
final_delivery/receipt
```

### Not confirmed

The following lifecycle states were not observed in the MacDent laboratory status selector:

- draft;
- cancelled;
- rejected;
- remake;
- awaiting_try_in;
- delayed;
- archived.

Some of these may be valuable DentalFlow concepts later, but this RECON does not pretend they were observed.

### Recommended modeling principle

Use a **small current-state field plus explicit milestone timestamps**, not one status value per date.

For the first foundation, the safest accepted current status set is:

```text
in_progress
completed
```

`cancelled` and `archived` should be added only in a separately reviewed lifecycle hardening task if operational requirements justify them. Deletion should not be used as an invisible substitute for lifecycle history.

## 4. Stable domain semantics vs configurable clinic vocabulary

### Stable semantics suitable for schema

These concepts are stable enough to become first-class data fields/relations:

- tenant;
- patient;
- responsible doctor;
- laboratory organization;
- order/work number;
- work title/name;
- current state;
- sent date;
- planned ready date;
- received-from-lab date;
- try-in date;
- delivered-to-patient/final receipt date;
- shade/color text;
- anatomical scope;
- selected teeth;
- comment;
- created/updated actors and timestamps.

### Configurable vocabulary

These must not be global hard-coded enums:

- laboratory work types;
- laboratory names;
- clinic-specific prosthetic/product terminology;
- laboratory-specific naming conventions.

MacDent's exact type labels are examples from one product/account, not universal ontology.

### Recommendation

Create a dedicated tenant-scoped laboratory work-type dictionary rather than expanding `clinical_dictionary_items` immediately.

Reason: the current clinical dictionary has explicit schema rules for only:

```text
diagnosis
work
```

Its `work` meaning is tied to tooth-state/clinical-work availability and pricing rules. A laboratory production type is not automatically the same semantic category. Overloading it would couple two domains merely because both contain the English word “work”. Classic schema pun, terrible architecture.

## 5. Current DentalFlow dependency map

### Patient

Current canonical patient identity:

```text
public.patients
(id uuid, tenant_id uuid, ...)
```

A laboratory order must reference the canonical patient with a composite tenant-safe FK pattern.

### Doctor

Current provider registry:

```text
public.doctors
(id uuid, tenant_id uuid, user_id uuid nullable, ...)
```

Appointments already reference `doctors.id`.

A laboratory work order represents a clinic operational responsibility, so the first foundation should reference `doctors.id` as `responsible_doctor_id`, not `auth.users.id`. This preserves the clinical provider identity even when a doctor has no active user account.

### Visit and encounter

DentalFlow explicitly separates:

```text
appointment = scheduled intent
patient_visit = actual attendance
clinical_encounter = documented doctor interaction
completed_service = performed clinical/billable fact
```

A laboratory work order may later originate from a prosthetics encounter, but no mandatory direct relation is justified by the MacDent empty-form evidence.

Therefore an encounter/visit FK should **not** be mandatory in the first schema.

### Treatment plan and stage

Treatment plans represent intended care, not performed work.

A laboratory order may later support a particular treatment stage, but the observed MacDent empty form did not expose a treatment-plan or stage selector.

Therefore:

```text
mandatory treatment_plan_id -> NOT JUSTIFIED
mandatory treatment_stage_id -> NOT JUSTIFIED
```

An optional relation can be added later when DentalFlow defines the creation workflow “create lab order from treatment stage”.

### Completed service

`completed_services` is proof that a service was actually performed.

A lab order may exist before the final clinical service is performed and may continue through try-in/remake cycles. Therefore:

```text
LaboratoryWork != CompletedService
```

A later explicit relation may connect a completed prosthetic service to the supporting lab order, but the lab order cannot itself be the billing/performance truth.

### Finance

DentalFlow currently has a mature patient finance boundary:

- invoices;
- invoice items;
- payments;
- allocations;
- refunds;
- financial adjustments;
- patient fund reservations.

These represent patient-facing/clinic financial facts. The MacDent lab payment flag has unknown semantics and must not bypass this model.

A future laboratory-cost/settlement domain may require a **clinic expense/accounts-payable** model, which is not currently equivalent to patient finance.

### Dental chart

The current dental chart already represents canonical tooth-level clinical state.

A laboratory work order should store only the anatomical scope needed to manufacture/track the order. It must not mutate or become a second dental chart.

Candidate representation:

```text
anatomical_scope: upper_jaw | lower_jaw | oral_cavity | selected_teeth
selected_teeth: integer[]
```

No tooth condition/diagnosis belongs in the lab order itself.

### Documents/files

Current patient files support source contexts such as dental chart, patient card, finding, treatment plan and appointment.

Laboratory attachments may eventually justify a new `laboratory_work` source context, but adding that is a later integration task after the lab domain exists.

### Audit/activity

DentalFlow already has audit/activity foundations. Laboratory create/update/status/milestone operations should emit or be auditable through the same architecture rather than inventing a separate log subsystem.

## 6. Proposed domain boundary

### Core concept

```text
LaboratoryWorkOrder
```

A tenant-scoped production/coordination order for a dental laboratory work related to one patient and one responsible clinical provider.

It owns:

- operational specification;
- responsible parties;
- laboratory assignment;
- current operational state;
- milestone dates;
- anatomical manufacturing scope;
- free-form operational notes.

It does **not** own:

- diagnosis;
- clinical finding;
- treatment-plan truth;
- proof of performed service;
- patient payment;
- clinic expense ledger;
- stock balance;
- clinical document truth.

## 7. Candidate entities and relations — design only

### 7.1 `laboratories`

Candidate fields:

```text
id uuid PK
tenant_id uuid NOT NULL
name text NOT NULL
active boolean NOT NULL default true
notes text nullable
created_at timestamptz
updated_at timestamptz
UNIQUE(tenant_id, id)
```

Recommended business constraint:

```text
UNIQUE(tenant_id, normalized_name)
```

Do not implement normalization casually in the first migration unless the existing project has a trusted normalization pattern. A simple tenant/name uniqueness policy can be reviewed separately.

### 7.2 `laboratory_work_types`

Candidate fields:

```text
id uuid PK
tenant_id uuid NOT NULL
name text NOT NULL
code text nullable
active boolean NOT NULL default true
sort_order integer NOT NULL default 0
created_at timestamptz
updated_at timestamptz
UNIQUE(tenant_id, id)
```

This is a configurable tenant dictionary. Seed data, if any, must be demo-only and not claim MacDent labels are canonical for all clinics.

### 7.3 `laboratory_work_orders`

Candidate minimum fields:

```text
id uuid PK
tenant_id uuid NOT NULL
patient_id uuid NOT NULL
responsible_doctor_id uuid nullable
laboratory_id uuid nullable
order_number text nullable
title text NOT NULL
status text NOT NULL default 'in_progress'
sent_to_lab_at timestamptz nullable
planned_ready_at timestamptz nullable
received_from_lab_at timestamptz nullable
try_in_at timestamptz nullable
delivered_to_patient_at timestamptz nullable
shade text nullable
anatomical_scope text nullable
selected_teeth integer[] NOT NULL default '{}'
comment text nullable
created_by uuid nullable
updated_by uuid nullable
created_at timestamptz
updated_at timestamptz
UNIQUE(tenant_id, id)
```

Status constraint for first foundation:

```text
status IN ('in_progress', 'completed')
```

Anatomical-scope candidate constraint:

```text
upper_jaw
lower_jaw
oral_cavity
selected_teeth
```

This is a DentalFlow semantic design derived from the observed controls, not a copy of MacDent implementation.

### 7.4 `laboratory_work_order_types`

Because MacDent structurally permits multiple selected work types per order, use a relation rather than one enum column:

```text
tenant_id uuid NOT NULL
laboratory_work_order_id uuid NOT NULL
laboratory_work_type_id uuid NOT NULL
PRIMARY KEY (tenant_id, laboratory_work_order_id, laboratory_work_type_id)
```

Composite tenant-safe FKs must prevent cross-tenant joins.

### 7.5 Domain events/history

A dedicated `laboratory_work_events` table is **not required for the first schema foundation** if immutable audit/activity events already record mutations adequately.

If clinicians later need a visible domain timeline such as “sent -> received -> try-in -> remake -> delivered”, then a dedicated event model should be introduced from explicit requirements rather than invented now.

## 8. Relations intentionally deferred

The first foundation should not contain these FKs merely because they might someday be useful:

```text
appointment_id
visit_id
encounter_id
treatment_plan_id
treatment_stage_id
completed_service_id
invoice_id
payment_id
warehouse_movement_id
document_id
```

Reason: the current evidence does not establish one canonical relation or cardinality.

Adding nullable “just in case” FKs everywhere would turn the table into an architectural junk drawer. Future bounded integration tasks can add links when a concrete workflow exists.

## 9. Financial boundary

### Explicit rule

The MacDent fields “paid” and “payment amount” are **not included** in the first DentalFlow laboratory schema.

### Why

Their payer/payee/accounting meaning is unverified.

DentalFlow has two conceptually different future financial possibilities:

1. patient-facing charge/billing for a prosthetic service;
2. clinic-facing payable/cost to an external laboratory or technician.

Those are not the same ledger.

The first already belongs to the current invoice/payment model through completed services. The second likely belongs to a future expenses/accounts-payable domain.

Until a dedicated RECON proves the intended business flow:

```text
no paid boolean
no lab payment amount
no invoice shortcut
no synthetic payment row
```

## 10. Warehouse boundary

MacDent can associate broader operational data with stock/material workflows, but no direct material-consumption relationship was established from the empty laboratory form.

DentalFlow warehouse is currently not implemented.

Therefore the first laboratory foundation must not invent material write-offs.

Future safe route:

```text
LaboratoryWorkOrder
→ explicit requested/consumed materials relation
→ canonical Warehouse domain
```

only after Warehouse RECON and inventory transaction semantics exist.

## 11. Tenant/RLS/audit constraints

### Mandatory tenancy

Every laboratory table must include `tenant_id`.

Cross-tenant references must be impossible by FK design, not merely hidden in UI.

Required composite patterns:

```text
(tenant_id, patient_id) -> patients(tenant_id, id)
(tenant_id, responsible_doctor_id) -> doctors(tenant_id, id)
(tenant_id, laboratory_id) -> laboratories(tenant_id, id)
(tenant_id, order_id) -> laboratory_work_orders(tenant_id, id)
(tenant_id, work_type_id) -> laboratory_work_types(tenant_id, id)
```

### RLS

Minimum role concept for a future implementation:

Read:

```text
clinic_owner
clinic_admin
doctor
registrar
```

Create/update operational data:

```text
clinic_owner
clinic_admin
doctor
registrar
```

Dictionary/laboratory administration:

```text
clinic_owner
clinic_admin
```

Delete should not be the normal lifecycle action. If physical delete is permitted at all, it should be admin-only and separately audited.

These are design recommendations aligned with current clinical workflow policies; implementation must use existing `get_user_tenants()` / `has_tenant_role()` patterns.

### Audit

Future mutation actions should create/enable audit evidence for at least:

- laboratory created/updated/deactivated;
- work type created/updated/deactivated;
- lab order created;
- responsible doctor/laboratory changed;
- status changed;
- milestone date changed;
- anatomical specification changed;
- order archived/deleted if such lifecycle is later allowed.

## 12. API/repository contract candidate

The first application layer after schema should expose typed operations approximately equivalent to:

```text
listLaboratories(tenantId)
createLaboratory(...)
updateLaboratory(...)

listLaboratoryWorkTypes(tenantId)
createLaboratoryWorkType(...)
updateLaboratoryWorkType(...)

listLaboratoryWorkOrders({ tenantId, patientId?, doctorId?, laboratoryId?, status?, dateRange? })
getLaboratoryWorkOrder({ tenantId, id })
createLaboratoryWorkOrder(...)
updateLaboratoryWorkOrder(...)
setLaboratoryWorkOrderTypes(...)
```

Mutation APIs must never accept `tenant_id` from arbitrary untrusted UI state as authorization. Tenant context and RLS remain authoritative.

No generic `saveEverything()` operation should simultaneously mutate laboratory, patient, treatment plan, service and finance.

## 13. UI workflow candidate

### Top-level operations page

MacDent demonstrates that laboratory work is a clinic-wide operational queue, not only a patient-card detail.

DentalFlow should eventually have a top-level Laboratory page with:

- active/in-progress work queue;
- completed filter;
- search by patient/order/work;
- doctor filter;
- laboratory filter;
- planned-ready/overdue visibility;
- add order;
- safe edit of milestones/specification.

### Patient-card integration

The same order should also be visible inside the patient context, either as:

- dedicated Laboratory tab; or
- a laboratory section under treatment/services, depending on later UX review.

Do not create a second patient-specific copy of the data.

### Create/edit order

Preserve the useful MacDent interaction ideas:

- quick patient context;
- responsible doctor;
- laboratory;
- work title;
- configurable type selection;
- shade;
- anatomy/teeth;
- milestone dates;
- comments.

Improve on MacDent by keeping financial settlement outside this operational form unless a verified finance integration is explicitly invoked.

## 14. Migration and seed policy

### First schema migration

A bounded first implementation may create only:

```text
laboratories
laboratory_work_types
laboratory_work_orders
laboratory_work_order_types
indexes
RLS policies
grants consistent with project policy
```

No UI, repository, finance, warehouse or patient-file changes in the same PR.

### Seed policy

Do not copy the live clinic's laboratory names or configuration into source control.

If demo seed data is required later:

- use synthetic laboratory names;
- use a small generic set of synthetic work types;
- clearly identify them as demonstration data;
- keep type definitions tenant-editable.

## 15. Automated test plan for schema foundation

A schema implementation is not complete with “migration applies”. It must verify at least:

### Schema/FK tests

- create a laboratory in tenant A;
- create a work type in tenant A;
- create a laboratory order for patient/doctor/lab all in tenant A;
- attach multiple work types;
- reject invalid status;
- reject invalid anatomical scope;
- reject cross-tenant patient reference;
- reject cross-tenant doctor reference;
- reject cross-tenant laboratory reference;
- reject cross-tenant work-type relation;
- preserve selected teeth and milestone timestamps;
- deletion/deactivation behavior does not silently delete patient/doctor facts.

### RLS tests

- member of tenant A can see allowed tenant A records;
- member of tenant A cannot see tenant B records;
- non-member cannot read;
- allowed operational role can create/update order;
- non-admin cannot administer reference dictionaries if the chosen policy requires admin;
- cross-tenant mutation is rejected.

### Migration regression

- existing patient/doctor/appointment/treatment/finance tests remain green;
- no existing RLS helper/grant regression;
- no service/finance coupling introduced.

## 16. Browser smoke plan for future UI implementation

Browser smoke is **not required for the schema-only next task**.

When UI arrives, real Chrome smoke must cover:

1. top-level lab queue loads in the correct tenant;
2. create an order from a synthetic QA patient;
3. select responsible doctor and laboratory;
4. select multiple configurable work types;
5. set shade/anatomical scope/teeth;
6. set milestone dates;
7. save and refresh;
8. update status to completed;
9. verify patient-card view shows the same canonical record;
10. verify another tenant cannot see it;
11. inspect console/network errors;
12. verify no patient payment is created as a side effect.

No simulated browser QA may be accepted.

## 17. Human acceptance criteria

### Clinic administrator

Must be able to answer:

- Which laboratory works are currently in progress?
- Which are planned to be ready soon or overdue?
- Which patient and doctor are responsible?
- Which laboratory has the work?
- Has the work returned from the lab?
- Is there a try-in date?
- Has it been finally delivered/completed?

### Doctor

Must be able to answer:

- What exactly was ordered?
- For which anatomical scope/teeth?
- What shade/specification is recorded?
- Which laboratory is handling it?
- What are the relevant dates?

### Owner

Must see that:

- laboratory operations are tenant-isolated;
- work types are configurable by clinic;
- the lab domain does not corrupt patient finance or completed-service truth;
- the design scales to other clinics rather than embedding one clinic's MacDent vocabulary.

## 18. Risks and unknowns

### Financial semantics

**BLOCKED / UNKNOWN for integration.**

MacDent's paid flag and amount cannot be mapped safely without identifying payer/payee and accounting ownership.

### Remake/rework lifecycle

Not observed in current status selector. A remake could be a status, child order, revision, or new order. Do not decide in the foundation task.

### Cancellation/archive

Not observed in current MacDent lab status UI. Do not over-model in the first migration.

### Treatment-stage relation

Likely useful for future DentalFlow ergonomics but not established by the observed MacDent empty form. Defer.

### Completed-service relation

Potentially valuable after clinical delivery, but must not turn lab completion into proof that treatment was performed. Defer.

### Laboratory contacts/payables

A laboratory may later need contacts, legal/billing details, price lists and payables. None are required for the first foundation.

### Dental anatomy complexity

MacDent exposes quick upper/lower/oral-cavity controls plus a dental formula. DentalFlow already has canonical tooth numbering. The first implementation should validate tooth numbers using the existing DentalFlow tooth-number domain rather than copying MacDent's UI representation.

## 19. Decision matrix

| Question | Verdict |
|---|---|
| Is LaboratoryWork a separate domain? | YES |
| Is it a TreatmentPlan/Stage? | NO |
| Is it a CompletedService? | NO |
| Is it an Appointment/Encounter? | NO |
| Should Patient be canonical FK? | YES |
| Should responsible Doctor use canonical doctors table? | YES |
| Is Laboratory a tenant-scoped reference entity? | YES |
| Are work types tenant-configurable? | YES |
| Should multiple work types per order be supported? | YES, observed structurally |
| Should milestone dates be first-class? | YES |
| Should status be a large enum now? | NO |
| Should MacDent paid/amount be copied now? | NO |
| Should finance be mutated by lab order save? | NO |
| Should warehouse movements be created now? | NO |
| Is a schema-only foundation bounded enough for next task? | YES |

## 20. Final verdict

```text
MACDENT LAB STRUCTURAL RECON: PASS
PATIENT PHI USED IN REPORT: 0
MACDENT MUTATIONS: 0
AMOCRM MUTATIONS: 0
CURRENT DENTALFLOW MAIN INSPECTED: YES
DOMAIN BOUNDARY: ESTABLISHED
FINANCE LINKAGE: NOT READY / DEFERRED
WAREHOUSE LINKAGE: NOT READY / DEFERRED
SCHEMA FOUNDATION: READY
```

The laboratory module should now move forward as an independent operational domain with strict links to canonical patient/doctor identities and no accidental fusion with treatment, performed service, patient billing or inventory.

## Recommended next task

**LAB-WORK-FOUNDATION-001A — Add the tenant-scoped schema foundation for `laboratories`, `laboratory_work_types`, `laboratory_work_orders`, and `laboratory_work_order_types`, with composite tenant-safe foreign keys, RLS, indexes and SQL tests only. No application/UI/repository/finance/warehouse changes.**
