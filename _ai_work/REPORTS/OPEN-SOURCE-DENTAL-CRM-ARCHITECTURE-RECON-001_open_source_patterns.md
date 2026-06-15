# OPEN-SOURCE-DENTAL-CRM-ARCHITECTURE-RECON-001 — Open-source architecture patterns

## 1. Summary

This report researches open-source medical, dental, clinic CRM, and SaaS architecture patterns before DentalFlow CRM continues into larger product features: documents, payments, stock, subscriptions, file/photo storage, onboarding, reports, and integrations.

Final verdict: **RECON COMPLETE**.

Main conclusion: DentalFlow should not copy code from mature healthcare projects. The most relevant mature healthcare systems are GPL/AGPL/MPL/proprietary, and many smaller dental repositories are desktop/offline, stale, non-SaaS, or incomplete. The useful value is architectural: visit/encounter boundaries, patient timeline, immutable clinical history, document metadata, billing separation, tenant onboarding, audit logs, and role/permission clarity.

DentalFlow's current direction remains correct:

- multi-tenant SaaS;
- Supabase/RLS tenant boundary;
- explicit template bootstrap instead of frontend auto-seeding;
- clinical model separation: complaint != finding != diagnosis != treatment plan != completed service != appointment != payment;
- amoCRM limited to sales/leads, not medical records.

Recommended next implementation after `ROLE-LABEL-UX-001`: **DENTAL-PHOTO-STORAGE-INTEGRATION-001**, but with patient file metadata included from the start.

## 2. Branch name

`recon/open-source-dental-crm-architecture-001`

## 3. PR URL

https://github.com/NckNA/codex-test/pull/291

## 4. PR head reviewed before final report update

`98d50feec182ba082561ee83499383e81b7ddcd3`

## 5. Report update commit

N/A because the final report update commit cannot reference itself before creation.

## 6. Changed files summary

Created exactly one report file:

- `_ai_work/REPORTS/OPEN-SOURCE-DENTAL-CRM-ARCHITECTURE-RECON-001_open_source_patterns.md`

No app code changed.
No database migrations changed.
No cloud touched.
No dependencies added.
No external code copied.

## 7. Search methodology

### Search terms used

- open source dental practice management GitHub
- open source dental clinic management system
- dental chart odontogram GitHub
- GitHub dental topic
- GitHub odontogram topic
- OpenEMR architecture modules patient scheduling billing
- GNU Health architecture Tryton PostgreSQL
- Bahmni OpenMRS appointments configuration
- OpenMRS core license concept dictionary modules
- LibreHealth EHR GitHub license
- Open Dental source license GPL proprietary
- Supabase multi tenant RLS SaaS starter
- tenant invitation Supabase SaaS
- Basejump Supabase teams permissions billing
- Next.js SaaS starter Stripe Postgres RBAC
- BoxyHQ SaaS starter kit roles permissions audit logs

### Sources checked

Public project pages, GitHub repository landing pages, GitHub topic pages, README/license snippets, and public documentation-style pages were checked.

Most useful sources:

- OpenEMR: https://github.com/openemr/openemr
- GNU Health overview: https://en.wikipedia.org/wiki/GNU_Health
- OpenMRS overview and core: https://en.wikipedia.org/wiki/OpenMRS and https://github.com/openmrs/openmrs-core
- Bahmni apps: https://github.com/Bahmni/openmrs-module-bahmniapps
- LibreHealth EHR: https://github.com/LibreHealthIO/lh-ehr
- Open Dental overview and GitHub org: https://en.wikipedia.org/wiki/Open_Dental and https://github.com/OpenDental
- GitHub dental topic: https://github.com/topics/dental
- Apexo: https://github.com/alexcorvi/apexo
- Apexo Flutter: https://github.com/alselawi/apexo-flutter
- QDento: https://github.com/thefinalcutbg/QDento
- JavaFX Periodontal Chart: https://github.com/ZaTribune/javafx-periodontal-chart
- Odonto: https://github.com/odonto/odonto
- Basejump: https://github.com/usebasejump/basejump
- Vercel Next.js Subscription Payments: https://github.com/vercel/nextjs-subscription-payments
- Next.js SaaS Starter: https://github.com/nextjs/saas-starter
- BoxyHQ SaaS Starter Kit: https://github.com/boxyhq/saas-starter-kit
- GitHub multi-tenant topic: https://github.com/topics/multi-tenant

### Inclusion criteria

Included projects if they had at least one of:

- mature EHR/practice management model;
- dental-specific workflow;
- dental chart or periodontal chart implementation;
- appointment, patient, billing, or document modules;
- SaaS/team/tenant/account pattern;
- role/permission/audit/billing pattern useful to DentalFlow.

### Exclusion criteria

Excluded as primary inspiration if:

- only marketing website with no clinic workflow;
- AI-only x-ray detection without clinic workflow;
- abandoned toy project with unclear license;
- no useful architecture beyond CRUD;
- impossible to confirm basic license or scope from public pages.

## 8. Shortlist table

| # | Project | Repository / source | License | Stack | Maintenance signal | Relevance 1-5 | Reason |
|---|---|---|---|---|---|---:|---|
| 1 | OpenEMR | https://github.com/openemr/openemr | GPL-3.0 | PHP, JS, SQL, FHIR/API | Active, large community | 5 | Mature EHR + practice management: patients, scheduling, billing, reports, portal. Study architecture only. |
| 2 | GNU Health | https://www.gnuhealth.org | GPL-3.0-or-later | Python, Tryton, PostgreSQL | Mature GNU package | 4 | Strong modular healthcare/hospital model. GPL risk. |
| 3 | OpenMRS | https://github.com/openmrs/openmrs-core | MPL 2.0 with Healthcare Disclaimer | Java, web app, MySQL/Hibernate | Mature platform | 5 | Concept dictionary, modular distributions, forms/reports. Very useful for clinical dictionary thinking. |
| 4 | Bahmni / OpenMRS distribution | https://github.com/Bahmni/openmrs-module-bahmniapps | AGPL-3.0 for checked app repo | AngularJS + React, OpenMRS ecosystem | Active-ish, some legacy | 4 | Config-driven clinical UI, hospital workflows, terminology integration. Study only. |
| 5 | LibreHealth EHR | https://github.com/LibreHealthIO/lh-ehr | MPL-2.0 plus inherited GPL | PHP, JS, MariaDB/MySQL | Large repo, less active than OpenEMR | 3 | OpenEMR-derived EHR/practice management. Useful comparison. |
| 6 | Open Dental | https://github.com/OpenDental / public overview | Current proprietary; older versions before 24.4 GPL | C#, Windows desktop | Mature commercial product | 4 | Best dental feature benchmark. Use feature taxonomy only. |
| 7 | Apexo | https://github.com/alexcorvi/apexo | MIT | TypeScript, Electron/web | Old release but useful | 4 | Dental clinic manager. Useful for screens/workflow ideas. |
| 8 | Apexo Flutter | https://github.com/alselawi/apexo-flutter | GPL-3.0 | Dart/Flutter | Updated 2025 | 4 | Dental clinic management with mobile/desktop. Study workflow only. |
| 9 | QDento | https://github.com/thefinalcutbg/QDento | GPL-3.0 | C++/Qt6, SQLite | Updated/released 2026 | 4 | Dental status, periodontal status, history, schedule, financial documents. Excellent checklist. |
| 10 | JavaFX Periodontal Chart | https://github.com/ZaTribune/javafx-periodontal-chart | MIT | JavaFX | Updated 2026 | 3 | Focused periodontal measurements and visualization. Useful for future chart expansion. |
| 11 | Odonto | https://github.com/odonto/odonto | License not confidently classified in this pass | Python/Django/Opal | Updated topic page, no releases | 3 | Dental EHR/chairside workflow and test personas. License must be reviewed. |
| 12 | Basejump | https://github.com/usebasejump/basejump | MIT | PLpgSQL + TypeScript, Supabase | Stable, widely starred | 5 | Supabase accounts/teams/permissions/billing, RLS helpers, tests. Highly relevant. |
| 13 | Vercel Next.js Subscription Payments | https://github.com/vercel/nextjs-subscription-payments | MIT | Next.js, Supabase, Stripe | Archived Jan 2025 | 3 | Stripe subscription flow, webhook syncing, environment warnings. Useful for billing planning. |
| 14 | Next.js SaaS Starter | https://github.com/nextjs/saas-starter | MIT | Next.js, Postgres, Drizzle, Stripe | Active/high visibility | 4 | Team CRUD, RBAC owner/member, activity logs, Stripe portal. Useful SaaS skeleton ideas. |
| 15 | BoxyHQ SaaS Starter Kit | https://github.com/boxyhq/saas-starter-kit | Apache-2.0 | Next.js, Postgres, Prisma, SAML Jackson | Active enterprise SaaS starter | 4 | Enterprise SaaS: invites, roles, audit logs, SSO, SCIM, webhooks, payments. Useful later. |

## 9. Deep dives

### 9.1 OpenEMR

Scope:

- general medical practice management;
- EHR;
- scheduling;
- electronic billing;
- reports;
- patient portal;
- FHIR/API support.

Useful architecture patterns:

1. Separate patient demographics from clinical encounters/forms.
2. Keep scheduling distinct from the medical record.
3. Treat billing as a separate module connected to encounters/services, not as the same thing as treatment plan intent.
4. Support reports as first-class modules.
5. Maintain a broad API/FHIR boundary for future integrations.

What DentalFlow should borrow:

- patient summary + timeline concept;
- encounter/visit model as the bridge between appointments and actual clinical notes/services;
- billing not directly attached to appointment alone;
- reporting module separated from transactional clinical logic.

What DentalFlow must not copy:

- GPL code;
- legacy PHP architecture;
- broad medical complexity not needed for dental MVP.

License risk:

- GPL-3.0. Code copying is blocked without explicit legal/product approval.

Usefulness now:

- High for patient timeline, visit/encounter, billing/report separation.

### 9.2 GNU Health

Scope:

- hospital/public health information system;
- EHR;
- laboratory information;
- Python/Tryton/PostgreSQL.

Useful architecture patterns:

1. Strong modularity: health domains are separate modules.
2. Hospital workflows are not flattened into one god table.
3. PostgreSQL-backed medical records with clinical modules.
4. Lab/document concepts separated from patient identity.

What DentalFlow should borrow:

- module boundaries;
- strict separation between administrative, clinical, lab/document, and reporting domains;
- avoid putting all patient information into one patient card blob.

What not to copy:

- GPL code;
- hospital-scale modules not needed now;
- public-health complexity unless future roadmap needs it.

### 9.3 OpenMRS

Scope:

- EMR platform;
- concept dictionary;
- modular distributions;
- forms;
- reports;
- configurable clinical data.

Key pattern:

OpenMRS is built around a concept dictionary. That is highly relevant because DentalFlow already has clinical dictionary templates. The key idea is not to hardcode every clinical data item into the database schema. Clinical concepts, forms, and reports can evolve through controlled configuration.

What DentalFlow should borrow:

- clinical dictionary as first-class product data;
- form/config modules layered on top of stable core entities;
- distribution/template idea for clinic defaults;
- reportable concepts instead of arbitrary free-text blobs.

What not to copy:

- Java/OpenMRS internals;
- a generic concept model so abstract that it slows dental MVP;
- MPL/Healthcare Disclaimer code without review.

### 9.4 Bahmni / OpenMRS ecosystem

Scope:

- OpenMRS-based hospital/clinic distribution;
- clinician-facing frontend;
- configuration-driven UI;
- SNOMED/terminology integration;
- hospital workflows.

Useful patterns:

1. Separate platform/core from implementation-specific configuration.
2. Clinic/hospital workflows can be driven by config rather than compiled UI everywhere.
3. Clinical UI can have module separation, but that has a complexity cost.
4. Terminology integration should be a boundary, not mixed into business tables.

What DentalFlow should borrow:

- configuration approach for clinic-specific clinical forms later;
- avoid hardcoding every future dental diagnosis/work screen;
- terminology mapping as a future module, not immediate MVP.

What not to copy:

- AGPL code;
- old AngularJS structure;
- hospital complexity.

### 9.5 Open Dental

Scope:

- dental practice management;
- C# Windows application;
- dental-specific workflows;
- mature commercial product.

Useful patterns:

- feature taxonomy for real dental clinics;
- appointment/schedule UX;
- odontogram/tooth chart behavior;
- treatment plan/billing/insurance concepts;
- dental procedure status and financial document lifecycle.

What DentalFlow should borrow:

- feature ideas and terminology only;
- workflow checklist for future modules.

What not to copy:

- current code;
- screens/assets/code structure;
- old GPL code without legal review.

### 9.6 Dental GitHub projects

Projects reviewed:

- Apexo;
- Apexo Flutter;
- QDento;
- JavaFX Periodontal Chart;
- Odonto.

Useful patterns:

- dental chart/periodontal chart deserves dedicated submodels;
- patient history should be persistent and searchable;
- schedule and financial documents are separate modules;
- photo upload is often unfinished or platform-specific, which is a warning for DentalFlow;
- test personas like dentist/nurse/admin are useful.

What DentalFlow should borrow:

- dental UI/workflow ideas;
- periodontal measurement model ideas;
- financial document separation;
- QA persona separation.

What not to copy:

- GPL code from Apexo Flutter/QDento;
- unclear-license code from Odonto;
- desktop SQLite assumptions;
- chart assets without provenance review.

### 9.7 Supabase/SaaS starters

Projects reviewed:

- Basejump;
- Vercel Next.js Subscription Payments;
- Next.js SaaS Starter;
- BoxyHQ SaaS Starter Kit.

Useful patterns:

- account/team abstraction;
- team membership roles;
- RLS helper functions and SQL testing;
- invitations and staff/member lifecycle;
- Stripe subscription webhook synchronization;
- activity/audit logs;
- enterprise SSO/SCIM later, not now.

What DentalFlow should borrow:

- SQL/RLS test discipline;
- team/clinic onboarding UX;
- audit log/event model;
- subscription status sync pattern;
- role display/permission separation.

What not to copy:

- wholesale account model replacement;
- simplistic owner/member roles as a substitute for clinic roles;
- archived starter implementations as current best practice;
- billing assumptions before DentalFlow subscription model is finalized.

## 10. Patterns worth borrowing

### 10.1 Patient timeline

DentalFlow needs a chronological patient timeline that can show:

- complaints;
- findings;
- chart changes;
- treatment plan creation/approval/status changes;
- appointments;
- completed services;
- documents/photos/x-rays;
- payments/invoices;
- user actions/audit events.

This should be derived from normalized records plus explicit activity/audit events where needed, not from one denormalized blob.

### 10.2 Encounter / visit model

Existing DentalFlow separates appointment from treatment plan and payments. Good. The missing bridge is likely `encounter` or `visit`:

- appointment = scheduled time;
- encounter/visit = what actually happened clinically;
- completed service = performed work;
- payment = financial transaction;
- document/photo = evidence/artifact attached to patient/visit/tooth/finding.

Recommended future task:

`ENCOUNTER-VISIT-MODEL-RECON-001`

### 10.3 Appointment lifecycle

Suggested statuses:

- scheduled;
- confirmed;
- arrived;
- in_progress;
- completed;
- cancelled;
- no_show;
- rescheduled.

Keep appointment separate from treatment completion.

### 10.4 Treatment plan stages/versioning

DentalFlow already has treatment plan stages and stage sync RPC. Next level:

- plan versioning;
- patient approval state;
- estimate snapshots;
- stage/order changes as auditable events;
- conversion reporting: findings -> plan -> accepted -> completed -> paid.

### 10.5 Document/file metadata

Every file/photo/x-ray should have metadata:

- tenant_id;
- patient_id;
- file kind;
- storage path;
- original filename;
- mime type;
- size;
- uploaded_by;
- uploaded_at;
- optional tooth_id/tooth_number;
- optional finding_id;
- optional treatment_plan_id;
- optional treatment_stage_id;
- optional appointment_id;
- optional encounter_id when introduced;
- source: upload, scanner, imported, generated document;
- visibility/clinical significance;
- archived/deleted state, not hard delete.

### 10.6 Audit/activity log

Borrow from SaaS starters and medical systems:

- who changed what;
- when;
- tenant context;
- patient context if applicable;
- before/after summaries for sensitive changes;
- non-medical events: invites, role changes, subscription changes.

### 10.7 Tenant onboarding/default bootstrap

Extend the explicit bootstrap style already used for dictionaries to:

- clinic creation;
- staff invitation;
- default roles;
- default schedules/rooms/chairs;
- default dictionary import;
- subscription trial state.

No frontend auto-seeding.

### 10.8 Role label/permission separation

Displayed role must come from active membership:

- platform role != clinic role;
- multi-tenant user can have different clinic role per active tenant;
- permission checks must not depend on hardcoded UI labels.

### 10.9 Reports modules

Reports need stable facts:

- appointments by status/date/doctor;
- completed services;
- payments and debts;
- treatment plan conversion;
- patient sources;
- stock movements;
- doctor performance.

Do not build reports from prototype/localStorage state.

## 11. Patterns to avoid

1. Global clinic data without tenant_id.
2. Hardcoded roles.
3. LocalStorage as production data store.
4. Frontend auto-seeding.
5. Hard-deleting clinical history.
6. Mixed appointment/treatment/payment models.
7. Weak license hygiene.
8. Overabstracted OpenMRS-style concept system too early.
9. Desktop-only SQLite assumptions.
10. Unlabeled files/photos without patient/tooth/clinical context.

## 12. License risk section

### Lower risk: MIT / Apache / permissive

Examples:

- Apexo: MIT;
- JavaFX Periodontal Chart: MIT, but asset provenance still needs review;
- Basejump: MIT;
- Next.js SaaS Starter: MIT;
- Vercel Next.js Subscription Payments: MIT but archived;
- BoxyHQ SaaS Starter Kit: Apache-2.0.

Allowed for now:

- study architecture;
- cite ideas;
- write our own implementation.

Not allowed without approval:

- copy files;
- copy non-trivial code blocks;
- copy assets;
- vendor dependencies or modules.

### High risk: GPL

Examples:

- OpenEMR;
- GNU Health;
- Apexo Flutter;
- QDento;
- parts of LibreHealth inherited from OpenEMR.

Allowed:

- study product architecture and domain modeling;
- borrow high-level ideas;
- compare workflows.

Not allowed:

- copying implementation;
- porting code line-by-line;
- using GPL code inside DentalFlow without legal approval.

### Very high SaaS risk: AGPL

Example:

- Bahmni app repo checked contains AGPL-3.0 license text.

AGPL is especially sensitive for SaaS because network use can trigger source distribution obligations. Study only.

### Proprietary/current closed risk

Example:

- Open Dental current versions are proprietary; older versions before 24.4 were GPL according to public overview.

Allowed:

- feature taxonomy;
- workflow inspiration;
- terminology comparisons.

Not allowed:

- copying current code/assets/UI;
- relying on old GPL code without review.

### Unknown/no-confidence license

Example:

- Odonto license was not confidently classified from the public page in this pass.

Rule:

- treat as not reusable code until license is explicitly reviewed.

## 13. DentalFlow backlog impact

### Already done well

- Multi-tenant foundation with tenant_id boundaries.
- RLS and helper hardening.
- No-tenant data boundary.
- Supabase dictionaries and explicit template bootstrap.
- Treatment plan stage sync RPC.
- Archived findings removed from active flows.
- amoCRM separation from medical record.

### Partially done

- Patient card exists but needs timeline/encounter structure.
- Dental chart exists but periodontal model is still basic.
- Treatment plans exist but need approval/version/estimate snapshot model later.
- Storage bucket exists but app-level file/photo integration still pending.
- Roles exist but role label UX task is still pending.

### Missing and important

1. Patient timeline/activity log.
2. Encounter/visit model.
3. File/photo/document metadata layer.
4. Tenant creation/onboarding flow.
5. Staff invitation/member management.
6. Billing/subscription implementation.
7. Clinic invoices/payments/debts.
8. Stock/material movement audit.
9. Reports built from stable facts.
10. Audit log for sensitive medical and role changes.

### Risky if implemented too early

- Generic OpenMRS-style concept system before DentalFlow domain stabilizes.
- Stock write-off automation before completed service model is stable.
- Reports before completed service/payment/encounter facts exist.
- Dental photo upload without metadata/audit/tenant path rules.
- Insurance-like billing before local business model is clear.

## 14. Proposed next 5 architecture tasks after ROLE-LABEL-UX-001

1. **DENTAL-PHOTO-STORAGE-INTEGRATION-001**
   Reason: storage is already backfilled and cloud-aligned. Next, app must upload/read patient photos safely through tenant-scoped storage and metadata.

2. **PATIENT-FILE-METADATA-MODEL-RECON-001**
   Reason: before adding many documents/photos, define metadata model: tenant, patient, tooth, finding, plan, appointment/visit, uploader, file type, archive state.

3. **ENCOUNTER-VISIT-MODEL-RECON-001**
   Reason: appointments, completed services, documents, and payments need a clinical event anchor.

4. **TENANT-CREATION-ONBOARDING-RECON-001**
   Reason: now that dictionary bootstrap exists, define clinic creation, staff invites, default template imports, subscription trial state, and tenant switcher flow.

5. **AUDIT-ACTIVITY-LOG-RECON-001**
   Reason: sensitive medical/financial/role changes need audit history before production clinics.

Alternative if business pressure demands money sooner:

- Move `BILLING-SUBSCRIPTION-ACCESS-CONTROL-001` earlier, but do not mix SaaS subscription billing with clinic patient payments.

## 15. What was intentionally NOT changed

- No code changed.
- No DB migrations changed.
- No cloud touched.
- No dependencies added.
- No external code copied.
- No implementation started.

## 16. Checks

- `git status --short`: not available from connector-only execution; PR diff confirms exactly one report file changed.
- npm checks: not required for report-only recon because no app code, migrations, package files, or tests changed.
- GitHub Actions CI: pending after final report update at the time this report was finalized.

## 17. Final verdict

**RECON COMPLETE**

15 external projects/sources were reviewed. More than 4 deep dives completed. License risks documented. No external code copied.

## 18. Recommended next task

Recommended next implementation task after `ROLE-LABEL-UX-001`:

**DENTAL-PHOTO-STORAGE-INTEGRATION-001**

Important: include patient file metadata rules in that task, not just raw storage upload. A storage bucket without metadata is not a feature. It is a digital sock drawer.
