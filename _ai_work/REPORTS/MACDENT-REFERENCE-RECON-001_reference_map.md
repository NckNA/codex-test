# MACDENT-REFERENCE-RECON-001 — MacDent as Functional Reference for DentalFlow

Date: 2026-08-19
Mode: HERMES SKILL FIRST / READ-ONLY RECON
Repository: `NckNA/codex-test`
Branch: `recon/macdent-reference-001`
MacDent access: dedicated V3 authenticated profile, loopback CDP `127.0.0.1:9366`
Production writes during RECON: `0`
Patient-identifying data intentionally recorded in this report: `0`

## Verdict

**PASS — MacDent can be used as a high-value functional/process reference for DentalFlow under a clean-room semantic transfer rule.**

The correct transfer unit is not MacDent source code or pixel UI. The transfer unit is:

```text
observed clinic workflow
→ semantic behavior contract
→ DentalFlow domain mapping
→ architecture-safe implementation
→ automated validation
→ browser/human acceptance
```

The first broad comparison also shows that DentalFlow has already surpassed a simple MacDent clone in several architectural areas: tenant isolation, explicit medical domain separation, encounter/visit separation, finding-to-treatment links, modern finance guards, audit/activity foundations, communication orchestration and amoCRM separation. The task is therefore not to reproduce MacDent wholesale. The task is to preserve proven clinic workflows that DentalFlow is missing and implement them inside the existing SaaS architecture.

## 1. Permanent project rule established by this RECON

MacDent is a **functional and process reference** for DentalFlow.

Allowed:

- observe workflows;
- observe module boundaries;
- observe fields and statuses as product facts;
- observe how clinic roles move through a process;
- observe the existence of reports, filters, lifecycle states and operational controls;
- derive semantic entities and causal dependencies;
- independently implement equivalent or improved behavior in DentalFlow.

Not allowed by project rule:

- transplant MacDent source code;
- copy unique text blocks;
- copy proprietary UI assets;
- reproduce the interface pixel-for-pixel;
- make MacDent runtime/schema/implementation a technical dependency of DentalFlow;
- infer unknown behavior and present it as observed fact.

DentalFlow remains an independent product with its own code, domain model, tenant isolation, Supabase/backend, RLS, UUID strategy, access model and integrations.

## 2. HERMES semantic contract

### Source identities

`MacDent observed behavior` is the reference source for mature clinic workflow facts.

`DentalFlow current main` is the authority for what already exists and for all implementation boundaries.

No MacDent state becomes DentalFlow state merely because a similarly named field exists.

### Causal chain

```text
MacDent behavior observation
→ identify clinic intent and lifecycle
→ map to existing DentalFlow entities
→ identify true gap
→ decide KEEP / IMPROVE / DO NOT COPY
→ RECON dependency boundary
→ implement a bounded capability
→ verify tenant/RLS/domain invariants
→ browser smoke
→ human clinic acceptance
```

### Invariants

1. `Appointment != treatment != completed service != payment`.
2. `Complaint != finding != diagnosis != treatment plan != completed service`.
3. amoCRM remains sales/communications, not the medical record.
4. Every production DentalFlow row remains tenant-scoped where applicable.
5. MacDent identifiers and implementation details do not become DentalFlow canonical IDs.
6. Unknown MacDent semantics remain `UNKNOWN` until independently observed.
7. RECON does not mutate MacDent, amoCRM or DentalFlow production state.
8. Real patient data is unnecessary for broad structural comparison and must not be copied into research artifacts.

## 3. Evidence boundary

### Existing verified V3 evidence used

The following already-verified Operator V3 studies were used as supporting technical evidence:

- `MACDENT-LIVE-READ-STUDY.md`;
- `MACDENT-READ-LAYER-v0.1.md`;
- `MACDENT-SCHEDULING-READ-v0.1.md`;
- `MACDENT-PRICE-READ-v0.1.md`;
- `LIVE-SHADOW-GATES-v0.1.md`.

These already establish factual read-only surfaces for patients/appointments, doctor registry, schedule/slots and price catalog, and they explicitly guard mutation methods.

### Live evidence collected in this RECON

The dedicated authenticated MacDent V3 profile was active at `https://macdent.kz/app` through loopback CDP port `9366`.

Only structural DOM facts were inspected. No patient row contents, medical notes or patient identifiers were collected into the report.

Observed live:

- the application sidebar/module structure;
- schedule/new-booking field structure;
- treatment-plan list structure and first creation step;
- primary-exam list and initial creation page;
- disease-history list and initial creation page;
- laboratory-work list and add-work form;
- documents list structure;
- payment list structure;
- doctor list/management controls;
- stock movement/accounting structure;
- statistics surface;
- reports entry surface.

No save/delete/create action was executed.

## 4. Live MacDent module inventory

The authenticated clinic account exposes these major functional groups.

### Platform / administration

- My clinic;
- accesses;
- audit journal;
- dump-load history;
- authorization history;
- active sessions.

### Schedule and appointment operations

- schedule;
- canceled appointments;
- rescheduled appointments;
- appointment journal search;
- notes;
- deleted appointments.

The live new-booking UI structurally includes:

- existing-patient search by name/phone;
- patient identity fields;
- referral/source field;
- reason for visit;
- specialty;
- doctor;
- time interval.

This confirms that MacDent treats appointment creation as a composition of patient identity, acquisition source, complaint/reason, provider selection and time reservation.

### CRM / communications

- leads/applications where licensed;
- tasks;
- calls;
- CRM/task/call reports;
- mailing;
- message status;
- reviews;
- mailing rules;
- message templates;
- SMS operations.

DentalFlow must not copy this area mechanically because its declared architecture intentionally assigns sales/lead pipeline responsibility to amoCRM and uses a separate communication orchestration layer.

### Patients and commercial operations

- patients;
- payments;
- insured patients;
- deleted patients;
- debt write-offs.

### Doctors and workforce

- doctors;
- doctor plans;
- doctor working schedules;
- assistants.

The doctor management surface includes specialty, documents/information, working schedule controls, salary calculation rules, payment types and service-linked percentage grids. This is materially broader than DentalFlow's current `DoctorRepository` and placeholder Doctors page.

### Clinical / physician work

- primary examinations;
- disease histories/cards;
- laboratory works;
- treatment plans.

### Finance

- monetary operations;
- cash-flow / DDS.

### Warehouse

- receipt/write-off movement;
- materials;
- material categories;
- attention/low-stock view;
- inventory;
- deleted materials.

### Analytics

- statistics;
- reports;
- insurer/company reporting.

### Dictionaries / support functions

- reference dictionaries;
- tools;
- bonus rules/settings;
- support/news.

## 5. High-value workflow observations

### 5.1 Treatment plans

The live treatment-plan registry exposes these structural facts:

- patient;
- plan name;
- status;
- doctor;
- creation date;
- total amount;
- balance;
- upcoming appointment.

Observed status filters include semantic equivalents of:

- preliminary;
- in treatment;
- completed;
- archived.

The first plan-creation step asks for:

- patient;
- treating doctor;
- plan name;
- plan description;
- note.

This is useful reference evidence, but DentalFlow must preserve its stronger medical invariant that a treatment plan is not a completed service and not a payment.

### 5.2 Primary exam and disease-history entry

The initial creation surfaces are appointment/patient anchored. Structurally they include:

- appointment/visit date;
- patient;
- doctor;
- first-visit marker;
- start/end times;
- patient profile metadata.

DentalFlow already has a more explicit `patient_visits` + `clinical_encounters` model. Therefore the MacDent concept should be mapped into that model instead of recreating parallel “primary exam card” and “disease history card” tables.

### 5.3 Laboratory work

This is the strongest newly discovered functional gap.

The live laboratory-work registry exposes:

- work number;
- patient;
- work name;
- doctor;
- laboratory;
- sent-to-technician date;
- received-from-lab date;
- planned completion date;
- actual delivery/receipt date;
- status;
- paid flag;
- payment amount;
- comment.

The add-work form additionally exposes semantic fields for:

- shade/color;
- try-in date;
- dental formula / anatomical scope;
- upper jaw / lower jaw / oral cavity scope;
- work type;
- common prosthetic work families, including ceramic/zirconia/inlay/provisional/removable/bugel/implant-related categories;
- free-form “other” work type.

DentalFlow currently has no laboratory domain, repository, migration or page implementation.

Important design consequence: the exact MacDent taxonomy must **not** be hard-coded as a universal database enum. Clinic dictionaries/configuration should define laboratory work types because clinics use different names and products evolve.

### 5.4 Documents

MacDent's document list structurally includes:

- document number;
- patient;
- document/appointment relation;
- signing status/date;
- generation date;
- bulk signing;
- copy/share actions, including WhatsApp-oriented delivery.

DentalFlow currently has a `documents` metadata table but its top-level Documents page and patient Documents tab are not implemented. This is a partial foundation, not a finished document workflow.

### 5.5 Payments / finance

MacDent payment list exposes:

- date;
- patient;
- payment type;
- amount;
- source.

MacDent also exposes separate monetary operations and DDS screens.

DentalFlow already has a substantially richer finance backend foundation: invoices, invoice items, payments, allocations, refunds, financial adjustments, patient fund reservations, guarded write-off/refund/payment flows and cashier UI. Therefore MacDent should be a workflow reference for clinic operations and reporting, not a finance data-model template.

### 5.6 Warehouse

MacDent stock movement includes:

- date;
- warehouse;
- material;
- operation type;
- unit price;
- quantity;
- total;
- comment;
- payment type;
- specialty;
- doctor;
- service;
- supplier.

It also exposes materials, categories, low-stock/attention state, inventory and deleted-material history.

DentalFlow's Warehouse page is currently a placeholder and no warehouse schema was found in the current migrations.

## 6. Current DentalFlow coverage from current main

This section is grounded in the current `origin/main` worktree, not the older project memory.

### Implemented / meaningful foundation

- Auth / tenant context;
- patients;
- patient card;
- patient communication profile and consent foundation;
- appointment repository and schedule;
- appointment conflict hardening;
- cancellation/no-show lifecycle;
- confirmation workflow;
- reminder queue/manual operations;
- doctor repository used by scheduling;
- chief complaints;
- dental chart and tooth states;
- clinical dictionaries;
- findings and risks;
- treatment plans and treatment stages;
- patient visits;
- clinical encounters;
- completed services;
- patient file metadata / dental-photo support;
- finance domain with invoices/payments/allocations/refunds/adjustments;
- cashier payment flow;
- patient credit/fund reservations;
- audit/activity events;
- communication orchestration foundation.

### Patient card already exposes a broad semantic workspace

Current patient tabs include:

- Overview;
- Communication;
- Timeline;
- Appointment history;
- Visits;
- Encounters;
- Services;
- Dental chart;
- Findings and risks;
- Treatment plan;
- Finance;
- Documents;
- Summary.

This is already a better structural center than blindly recreating separate MacDent patient/primary-exam/disease-history screens.

### Present as routes/pages but still placeholders or materially incomplete

Current main explicitly contains placeholder top-level pages for:

- CRM;
- Appointments;
- Documents;
- Doctors;
- Finance;
- Warehouse;
- Reports;
- Bonus;
- Mailing;
- SMS.

Statistics is also currently minimal/placeholder-scale compared with MacDent's operational statistics surface.

The patient-card Documents tab is explicitly marked “in development”.

Important nuance: a placeholder top-level Finance page does **not** mean finance is absent. The backend/patient/cashier finance foundations are already substantial. The missing part is the clinic-wide operational finance experience.

## 7. MacDent → DentalFlow feature map

| MacDent capability | Semantic meaning | DentalFlow current state | Classification | Recommended treatment |
|---|---|---|---|---|
| Schedule | Provider/resource time planning | Working SchedulePage + AppointmentRepository | ALREADY_IMPLEMENTED / IMPROVE | Keep DentalFlow model; use MacDent only for UX/workflow comparison |
| Create appointment | Patient + reason + provider + interval | Implemented in schedule flow | ALREADY_IMPLEMENTED / IMPROVE | Compare speed, conflict handling and admin ergonomics |
| Canceled/rescheduled appointment views | Appointment lifecycle operations | Backend lifecycle exists; top-level Appointments page placeholder | IMPROVE | Build operations/history UI later |
| Appointment journal/search | Operational retrieval/history | Partial via patient/schedule/timeline | NEEDS_RECON | Decide clinic-wide search surface |
| Notes | Operational notes/reference | No direct equivalent confirmed | NEEDS_RECON | Clarify note ownership/domain before implementation |
| Patients | Canonical patient registry | Implemented | ALREADY_IMPLEMENTED | Keep DentalFlow tenant model |
| Payments | Patient money events | Strong finance foundation | ALREADY_IMPLEMENTED / IMPROVE | Add clinic-wide operations UI/reporting |
| Debt write-offs | Controlled balance correction | Finance hardening exists | ALREADY_IMPLEMENTED | Keep guarded workflow, do not simplify to MacDent semantics |
| Insured patients | Payer/insurance relation | Not confirmed | NEEDS_RECON | Separate insurance/payer domain if commercially needed |
| Doctors | Provider registry | Repository exists; page placeholder | IMPROVE | Detailed doctor-management RECON before writes |
| Doctor schedules | Working-time planning | Scheduling foundation exists | PARTIAL | Compare schedule administration semantics |
| Doctor plans | Performance/production plans | Missing | NEEDS_RECON | Keep separate from clinical plan treatment |
| Assistants | Clinical workforce relation | Missing | NEEDS_RECON | Add only after staff/role model review |
| Primary exam | Initial clinical encounter | Encounter/visit model exists | DO_NOT_COPY AS PARALLEL MODEL | Map into visit/encounter lifecycle |
| Disease history | Longitudinal clinical record | Timeline + encounters + dental chart + findings | DO_NOT_COPY AS PARALLEL MODEL | Compose from existing canonical entities |
| Treatment plans | Proposed staged care | Implemented | ALREADY_IMPLEMENTED / IMPROVE | Study balance/upcoming-appointment/commercial linkage without collapsing domains |
| Laboratory works | External/internal lab production lifecycle | Absent | **NEEDS_RECON — HIGH PRIORITY** | Create dedicated tenant-scoped laboratory domain after focused RECON |
| Documents | Generated/signed/shared patient docs | Metadata table exists; UI incomplete | PARTIAL / NEEDS_RECON | Define document generation/sign/share lifecycle |
| Monetary operations / DDS | Clinic-wide financial operations | Backend strong; top-level UI absent | IMPROVE | Build operational finance dashboard after scope RECON |
| Warehouse movements | Material inventory operations | Absent; page placeholder | NEEDS_RECON — HIGH PRIORITY | Dedicated warehouse domain later |
| Material catalog/categories | Stock master data | Absent | NEEDS_RECON | Configurable units/categories; tenant-scoped |
| Low-stock attention | Inventory control | Absent | NEEDS_RECON | Derived rule, not copied UI |
| Inventory count | Physical reconciliation | Absent | NEEDS_RECON | Requires transaction/audit design |
| Statistics | Operational KPI dashboard | Minimal page | NEEDS_RECON | Derive from canonical data only |
| Reports | Formal/management reporting | Placeholder | NEEDS_RECON | Report catalog from business questions, not copied screens |
| Dictionaries | Configurable clinic vocabulary | Clinical dictionaries implemented | ALREADY_IMPLEMENTED / EXPAND | Extend pattern by domain |
| CRM | Sales pipeline | amoCRM is canonical integration | **DO_NOT_COPY** | Keep external sales boundary |
| Tasks/calls | Follow-up operations | amoCRM + communication/reminder foundations | DO_NOT_DUPLICATE | Integrate rather than recreate generic CRM |
| Mailing/SMS | Outbound communication | Communication orchestration foundation; placeholder UIs | IMPROVE | Unified channel architecture, not separate legacy silos |
| Bonus system | Loyalty mechanics | Placeholder | OUT_OF_SCOPE FOR CORE | Later commercial module |
| Audit/session history | Operational/security trace | Audit/activity foundation exists | ALREADY_IMPLEMENTED / IMPROVE | Preserve stronger tenant/audit architecture |

## 8. Domain mapping rules

### MacDent concepts that map cleanly

```text
MacDent patient              -> DentalFlow Patient
MacDent appointment          -> DentalFlow Appointment
MacDent doctor               -> DentalFlow Doctor
MacDent primary exam event   -> PatientVisit + ClinicalEncounter
MacDent treatment plan       -> TreatmentPlan + TreatmentStage
MacDent payment              -> Payment (+ Invoice/Allocation as applicable)
MacDent material             -> future Material
MacDent laboratory work      -> future LaboratoryWork
```

### MacDent concepts that must not be copied as one-to-one tables

```text
Disease history card
-> composed longitudinal view over visits, encounters, findings, dental chart, services and documents

Primary exam card
-> visit/encounter workflow, not a separate competing medical truth

CRM
-> amoCRM / communication integration boundary

DDS / money operation
-> reporting/ledger views over DentalFlow canonical finance events
```

## 9. Priority gaps

### P0 — protect and finish existing core

- do not regress patient/schedule/clinical/finance foundations;
- improve operations UI around already-mature data rather than creating duplicate data models;
- preserve plan vs performed service vs payment separation.

### P1 — clinically/operationally valuable missing domains

1. **Laboratory works**;
2. document generation/sign/share lifecycle;
3. doctor/staff management and work schedule administration;
4. clinic-wide appointment operations/history;
5. clinic-wide finance operations.

### P2 — management operations

- warehouse/materials/inventory;
- statistics;
- reports;
- insurer/payer workflows.

### P3 — commercial extras

- bonus/loyalty;
- generic mailing/SMS screens where communication orchestration already provides a better technical foundation.

## 10. Why laboratory workflow is the strongest next candidate

It satisfies several useful conditions simultaneously:

1. It is a real, mature clinic workflow observed live in MacDent.
2. DentalFlow currently has no competing implementation, so there is little duplication risk.
3. It is important for prosthetics and restorative workflows.
4. It has a bounded lifecycle that can be modeled independently.
5. It naturally links to already-canonical Patient and Doctor without forcing treatment/payment identity collapse.
6. The live form exposes enough structure for a focused RECON without reading real patient records.
7. It provides a good test of the new MacDent-reference method before larger warehouse/reporting work.

## 11. Laboratory causal model to validate next

Candidate only; not yet accepted schema:

```text
Patient + Doctor
→ LaboratoryWork order
→ Work type / scope / shade / notes
→ Laboratory assignment
→ Sent timestamp
→ Planned completion
→ Received from lab
→ Try-in / delivery events as applicable
→ Completed / canceled state
```

Payment must remain separate:

```text
LaboratoryWork
!= Invoice
!= Payment
!= CompletedService
```

If the clinic needs cost/accounting links, those must be explicit relations, not a single `paid=true` field carrying multiple meanings.

## 12. Unknowns / blockers

The following must not be guessed:

- exact semantics and transition rules of every MacDent treatment-plan status;
- full internal treatment-plan step structure after patient selection;
- exact relation between laboratory “paid” state and clinic finance/accounting;
- whether laboratory work is linked to a specific appointment/service/plan in MacDent;
- insurance payer model details;
- exact doctor payroll calculation semantics;
- warehouse valuation method and inventory reconciliation rules;
- report formulas;
- deleted-record retention semantics.

A deeper patient-specific workflow study would require a dedicated synthetic/test patient or explicit authorization for a controlled test fixture. Real patient PHI must not be used merely to learn UI behavior.

## 13. Future implementation validation order

Every MacDent-derived capability must pass this order:

1. Semantic contract review.
2. Dependency RECON.
3. Current main / schema fit check.
4. Tenant and RLS design.
5. ID/FK strategy.
6. Repository/API contract.
7. Unit tests.
8. Integration/RLS tests.
9. Browser smoke on a non-production fixture.
10. Human clinic workflow acceptance.
11. Only then production gate.

## 14. Human acceptance criteria for MacDent-derived work

A clinic administrator or doctor must be able to confirm that:

- the same real-world job can be completed;
- the DentalFlow workflow is not slower or more confusing;
- terminology is appropriate for the clinic;
- required information is present;
- irrelevant MacDent legacy complexity was not copied;
- clinical facts, financial facts and operational statuses remain clearly separated;
- the feature works inside the patient/clinic context rather than as an isolated screen.

The owner must additionally be able to confirm that the result supports the SaaS product, not just one clinic's current MacDent configuration.

## 15. Final decision

```text
MACDENT AS FUNCTIONAL REFERENCE: ACCEPTED
MACDENT SOURCE CODE TRANSFER: FORBIDDEN BY PROJECT RULE
PIXEL/UI CLONE: FORBIDDEN BY PROJECT RULE
READ-ONLY STRUCTURAL RECON: PASSED
DENTALFLOW CURRENT MAIN INSPECTED: YES
PRODUCTION MUTATIONS: 0
PHI RECORDED IN REPORT: 0
```

MacDent is now treated as a mature real-world workflow benchmark. DentalFlow keeps its own domain truth and architecture.

## Recommended next task

**MACDENT-LAB-WORKFLOW-RECON-001 — Design the DentalFlow laboratory-work domain from the live MacDent workflow, current Patient/Doctor/Visit/Treatment/Finance architecture, tenant/RLS constraints and configurable clinic dictionaries. Report-only; no schema or application changes.**
