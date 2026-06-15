# OPEN-SOURCE-DENTAL-CRM-ARCHITECTURE-RECON-001 — Open-source patterns recon

## 1. Summary

This report researches open-source medical, dental, clinic CRM, and SaaS architecture patterns before DentalFlow CRM continues into larger product features: documents, payments, stock, subscriptions, file/photo storage, onboarding, reports, and integrations.

Result: **RECON COMPLETE**.

Key conclusion: DentalFlow should not copy code from mature healthcare projects because the most relevant systems are GPL/AGPL/MPL/proprietary, and many smaller dental repositories are either desktop/offline, stale, non-SaaS, or incomplete. The useful value is architectural: visit/encounter boundaries, patient timeline, immutable clinical history, document metadata, billing separation, tenant onboarding, audit logs, and role/permission clarity.

DentalFlow's current direction is correct:

- multi-tenant SaaS;
- Supabase/RLS tenant boundary;
- explicit template bootstrap instead of frontend auto-seeding;
- clinical model separation: complaint != finding != diagnosis != treatment plan != completed service != appointment != payment;
- amoCRM limited to sales/leads, not medical records.

Recommended next implementation after current UX cleanup: **DENTAL-PHOTO-STORAGE-INTEGRATION-001**, but with one warning: attach every file/photo to tenant, patient, optional tooth, optional finding, optional treatment plan/stage, optional appointment/visit, and audit metadata. Otherwise file storage becomes a drawer full of unlabeled x-rays. Humanity has already suffered enough drawers.

## 2. Branch name

`recon/open-source-dental-crm-architecture-001`

## 3. PR URL

[Pending PR creation]

## 4. PR head reviewed before final report update

[Pending PR creation]

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

Public project pages, GitHub repository landing pages, GitHub topic pages, README/license snippets, and public documentation-style pages were checked. Most useful sources were:

- OpenEMR: https://github.com/openemr/openemr
- GNU Health overview: https://en.wikipedia.org/wiki/GNU_Health
- OpenMRS overview: https://en.wikipedia.org/wiki/OpenMRS and https://github.com/openmrs/openmrs-core
- Bahmni apps: https://github.com/Bahmni/openmrs-module-bahmniapps
- LibreHealth EHR: https://github.com/LibreHealthIO/lh-ehr
- Open Dental overview: https://en.wikipedia.org/wiki/Open_Dental and https://github.com/OpenDental
- GitHub dental topic: https://github.com/topics/dental
- Apexo: https://github.com/alexcorvi/apexo
- Apexo Flutter: https://github.com/alselawi/apexo-flutter
- QDento: https://github.com/thefinalcutbg/QDento
- JavaFX Periodontal Chart: https://github.com/ZaTribune/javafx-periodontal-chart
- Odonto: https://github.com/odonto/odonto
- Basejump: https://github.com/usebasejump/basejump
- Next.js Subscription Payments: https://github.com/vercel/nextjs-subscription-payments
- Next.js SaaS Starter: https://github.com/nextjs/saas-starter
- BoxyHQ SaaS Starter Kit: https://github.com/boxyhq/saas-starter-kit
- GitHub multi-tenant topic: https://github.com/topics/multi-tenant

### Inclusion criteria

Included projects if they had at least one of:

- mature EHR/practice management model;
- dental-specific workflow;
- dental chart/periodontal chart implementation;
- appointment/patient/billing modules;
- SaaS/team/tenant/account pattern;
- role/permission/audit/billing pattern useful to DentalFlow.

### Exclusion criteria

Excluded as primary inspiration if:

- only marketing website with no clinic workflow;
- AI-only x-ray detection without clinic workflow;
- abandoned toy project with unclear license;
- no useful architecture beyond CRUD;
- impossible to confirm even basic license or scope from public pages.

## 8. Shortlist table

| # | Project | Repository / source | License | Stack | Maintenance signal | Relevance 1-5 | Reason |
|---|---|---|---|---|---|---:|---|
| 1 | OpenEMR | https://github.com/openemr/openemr | GPL-3.0 | PHP, JS, SQL, FHIR/API | Very active, large community, OpenEMR 8.1.0 release shown June 2026 | 5 | Mature EHR + practice management: patients, scheduling, billing, reports, portal. Study architecture, do not copy code. |
| 2 | GNU Health | https://www.gnuhealth.org / public overview | GPL-3.0-or-later | Python, Tryton, PostgreSQL | Mature GNU package | 4 | Good module separation for hospital/public health, lab, EHR. Less dental-specific. GPL risk. |
| 3 | OpenMRS | https://github.com/openmrs/openmrs-core | MPL 2.0 with Healthcare Disclaimer | Java, web app, MySQL/Hibernate | Mature platform, active releases | 5 | Concept dictionary, modular distributions, forms/reports. Great for dictionary/config ideas. No code copying without review. |
| 4 | Bahmni / OpenMRS distribution | https://github.com/Bahmni/openmrs-module-bahmniapps | AGPL-3.0 for checked app repo | AngularJS + React frontend, OpenMRS ecosystem | Active-ish, but legacy AngularJS in places | 4 | Config-driven clinical UI, hospital workflows, SNOMED integration. Strong AGPL risk. Study only. |
| 5 | LibreHealth EHR | https://github.com/LibreHealthIO/lh-ehr | MPL-2.0 plus inherited GPL | PHP, JS, MariaDB/MySQL | Large repo, but appears less active than OpenEMR | 3 | OpenEMR-derived EHR/practice management. Useful for comparison and license warning. |
| 6 | Open Dental | https://github.com/OpenDental / public overview | Current proprietary; older versions before 24.4 GPL | C#, Windows desktop | Mature product, commercial | 4 | Best dental feature benchmark, but code/license minefield. Use feature taxonomy only. |
| 7 | Apexo | https://github.com/alexcorvi/apexo | MIT | TypeScript, Electron/web | Last visible release old, repo still useful | 4 | Dental clinic manager, web/desktop. Useful for screens and workflow ideas; code can be studied carefully due MIT, but no copying without approval. |
| 8 | Apexo Flutter | https://github.com/alselawi/apexo-flutter | GPL-3.0 | Dart/Flutter | Updated 2025, used by author's clinic | 4 | Dental clinic management with mobile/desktop. GPL: study workflow only. |
| 9 | QDento | https://github.com/thefinalcutbg/QDento | GPL-3.0 | C++/Qt6, SQLite | Updated/released 2026 | 4 | Dental status, periodontal status, history, schedule, financial docs. Excellent feature checklist, GPL risk. |
| 10 | JavaFX Periodontal Chart | https://github.com/ZaTribune/javafx-periodontal-chart | MIT | JavaFX | Updated 2026 | 3 | Focused periodontal chart: tooth availability, implant, mobility, furcation, BOP, plaque, gingival margin, probing depth. Useful chart model ideas. |
| 11 | Odonto | https://github.com/odonto/odonto | License not confidently parsed from public page | Python/Django/Opal | Updated 2026 topic page, no releases | 3 | Dental EHR/chairside application. Useful to inspect chairside roles and test users. License must be reviewed. |
| 12 | Basejump | https://github.com/usebasejump/basejump | MIT | PLpgSQL + TypeScript, Supabase | Stable, 935 stars, release 2024 | 5 | Supabase accounts/teams/permissions/billing, RLS helpers, tests. Highly relevant for tenant/team/account ideas. Do not blindly replace DentalFlow model. |
| 13 | Vercel Next.js Subscription Payments | https://github.com/vercel/nextjs-subscription-payments | MIT | Next.js, Supabase, Stripe | Archived Jan 2025, but influential | 3 | Stripe subscription flow, webhook syncing, local/staging warnings. Useful for billing architecture, not current template. |
| 14 | Next.js SaaS Starter | https://github.com/nextjs/saas-starter | MIT | Next.js, Postgres, Drizzle, Stripe | Active, 15.9k stars | 4 | Team CRUD, RBAC owner/member, activity logs, Stripe portal. Good SaaS product skeleton ideas. Not Supabase-specific. |
| 15 | BoxyHQ SaaS Starter Kit | https://github.com/boxyhq/saas-starter-kit | Apache-2.0 | Next.js, Postgres, Prisma, SAML Jackson | 4.8k stars, enterprise features | 4 | Enterprise SaaS: SAML, SCIM, team invites, roles, audit logs, webhooks, payments. Useful later, heavier than DentalFlow needs now. |

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
- social medicine;
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

License risk:

- GPL-3.0-or-later. Study only.

Usefulness now:

- Medium-high for module discipline.

### 9.3 OpenMRS

Scope:

- EMR platform;
- concept dictionary;
- modular distributions;
- forms;
- reports;
- configurable clinical data.

Key pattern:

OpenMRS is built around a concept dictionary. That is highly relevant because DentalFlow just added clinical dictionary templates. The key idea is not to hardcode every clinical data item into the database schema. Clinical concepts, forms, and reports can evolve through controlled configuration.

What DentalFlow should borrow:

- clinical dictionary as first-class product data;
- form/config modules layered on top of stable core entities;
- distribution/template idea for clinic defaults;
- reportable concepts instead of arbitrary free-text blobs.

What not to copy:

- Java/OpenMRS internals;
- generic concept model that becomes too abstract for dental workflows;
- MPL/Healthcare Disclaimer code without legal review.

License risk:

- MPL 2.0 with Healthcare Disclaimer. Easier than GPL for ideas, but code reuse still requires review.

Usefulness now:

- Very high for dictionary/template/onboarding and future custom clinical forms.

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
3. Clinical UI can have micro-frontends / module separation, but that has a complexity cost.
4. Terminology integration should be a boundary, not mixed into business tables.

What DentalFlow should borrow:

- configuration approach for clinic-specific clinical forms later;
- avoid hardcoding every future dental diagnosis/work screen;
- terminology mapping as a future module, not immediate MVP.

What not to copy:

- AGPL code;
- old AngularJS structure;
- hospital complexity.

License risk:

- The checked Bahmni apps repo contains AGPL-3.0 license text. AGPL is especially dangerous for SaaS code reuse. Study only.

Usefulness now:

- Medium-high for config-driven clinical UI and terminology boundaries.

### 9.5 LibreHealth EHR

Scope:

- EHR and medical practice management;
- derived from OpenEMR community;
- PHP/JS/MariaDB.

Useful patterns:

- alternative OpenEMR lineage;
- patient portal / forms / modules;
- legacy migration reality.

What DentalFlow should borrow:

- only comparative ideas;
- warnings about legacy baggage and backward compatibility.

What not to copy:

- inherited GPL code;
- old installation assumptions;
- architecture that depends on legacy PHP module sprawl.

License risk:

- MPL-2.0 plus inherited GPL. Code reuse is not clean.

Usefulness now:

- Medium for comparison, lower than OpenEMR/OpenMRS.

### 9.6 Open Dental

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

License risk:

- Current product is proprietary; public overview says versions before 24.4 were GPL. Treat as feature inspiration only.

Usefulness now:

- High as dental product benchmark, low for direct code reuse.

### 9.7 Apexo

Scope:

- dental clinic manager;
- web/desktop app;
- TypeScript/Electron/web;
- MIT license.

Useful patterns:

- desktop/web hybrid approach;
- dental practice UI organization;
- clinic data screens;
- tests with Jest/Cypress noted in README.

What DentalFlow should borrow:

- UX inspiration for dental modules;
- test layering idea;
- simple dental practice screens.

What not to copy:

- code without explicit review;
- old offline/local assumptions;
- outdated dependencies/build patterns.

License risk:

- MIT. Lower risk, but still do not copy without approval.

Usefulness now:

- High for screens and lightweight dental workflow ideas.

### 9.8 Apexo Flutter

Scope:

- dental clinic management software;
- Dart/Flutter;
- Windows/Android supported, web partial, photo upload todo;
- GPL-3.0.

Useful patterns:

- mobile/desktop dental workflow;
- real clinic author context;
- note that web photo upload was not complete, which is directly relevant to our storage work.

What DentalFlow should borrow:

- workflow understanding;
- mobile-friendly structure ideas;
- caution around file upload support across platforms.

What not to copy:

- GPL code;
- offline/mobile storage model if it conflicts with Supabase/RLS.

License risk:

- GPL-3.0. Study only.

Usefulness now:

- Medium-high, especially for mobile and photo-storage pitfalls.

### 9.9 QDento

Scope:

- free open-source dental management software;
- Qt6/C++/SQLite;
- GPL-3.0;
- features: dental status/procedure input, periodontal status, patient history, appointment schedule, financial documents.

Useful patterns:

- dental status and procedure input belong together visually but not as one data type;
- periodontal status deserves a separate submodel;
- financial documents are separate from schedule and treatment intent;
- patient history is a persistent timeline/history concept.

What DentalFlow should borrow:

- feature checklist;
- financial document separation;
- periodontal status as future dedicated domain.

What not to copy:

- GPL code;
- SQLite desktop-only architecture;
- Bulgarian healthcare assumptions from DinoDent lineage.

License risk:

- GPL-3.0. Study only.

Usefulness now:

- High for dental feature backlog.

### 9.10 JavaFX Periodontal Chart

Scope:

- focused dental/periodontal chart;
- JavaFX;
- MIT;
- tooth availability, implant status, mobility, furcation, BOP, plaque, gum width, gingival margin, probing depth.

Useful patterns:

- periodontal chart is not just tooth status;
- it has repeated measurements per tooth/surface/point;
- gum margin and probing depth need time-series/history if used clinically;
- visualization should derive from structured values.

What DentalFlow should borrow:

- future periodontal submodel;
- measurement-point structure;
- visual graph overlay concept.

What not to copy:

- JavaFX code;
- tooth image assets without checking origin/licensing.

License risk:

- MIT for repo, but README acknowledges third-party dental photos/chart mechanisms. Asset provenance requires extra review.

Usefulness now:

- High for future dental chart/periodontal expansion.

### 9.11 Odonto

Scope:

- Open Odonto Application;
- Python/Django/Opal;
- chairside/dental EHR topic;
- creates test users: super, dentist, nurse.

Useful patterns:

- dentist/nurse test persona separation;
- chairside app mindset;
- clinical workflow may be built on a generic healthcare framework.

What DentalFlow should borrow:

- QA persona pattern;
- chairside workflow idea.

What not to copy:

- code until license is confirmed;
- Opal framework assumptions.

License risk:

- License file exists, but public page did not expose enough text in this pass to confidently classify. Treat as unknown until legal/repo inspection.

Usefulness now:

- Medium.

### 9.12 Basejump

Scope:

- Supabase extension/project for personal accounts, team accounts, permissions, billing;
- RLS-based account access helpers;
- PLpgSQL-heavy;
- MIT.

Useful patterns:

- account/team abstraction;
- team membership roles;
- RLS helper functions;
- billing linked to accounts/teams;
- pgtap testing for Supabase functions/schema.

What DentalFlow should borrow:

- testing discipline for SQL/RPC/RLS;
- account/team pattern as comparison to tenant/clinic;
- convenience helpers, but only conceptually because DentalFlow already has tenant_users and custom RLS helpers.

What not to copy:

- wholesale account model replacement;
- function names/SQL without review;
- billing assumptions before subscription model is finalized.

License risk:

- MIT. Lower risk, but still no copy without approval.

Usefulness now:

- Very high for tenant onboarding, invitations, RLS tests, billing.

### 9.13 Vercel Next.js Subscription Payments

Scope:

- archived SaaS subscription starter;
- Next.js + Supabase + Stripe;
- MIT;
- webhook syncing pricing/subscription statuses.

Useful patterns:

- Stripe Checkout and customer portal flow;
- webhooks as source of truth for subscription status;
- local/staging/prod environment warnings;
- separate test/live Stripe mode.

What DentalFlow should borrow:

- subscription status sync via webhooks;
- environment hygiene warnings;
- do not pull production data into local seeds.

What not to copy:

- archived implementation as current best practice;
- broad env/service-role handling into frontend;
- raw code without review.

License risk:

- MIT, archived. Study architecture, not copy.

Usefulness now:

- Medium for billing/subscription planning.

### 9.14 Next.js SaaS Starter

Scope:

- Next.js + Postgres + Drizzle + Stripe + shadcn/ui;
- MIT;
- team CRUD, RBAC Owner/Member, activity logs, Stripe portal.

Useful patterns:

- minimal SaaS skeleton;
- team owner/member roles;
- activity log system;
- Stripe portal and subscription management;
- middleware-protected routes and server action validation.

What DentalFlow should borrow:

- activity log as a first-class module;
- team/clinic management UX;
- Stripe subscription UI concepts;
- RBAC labels and team settings structure.

What not to copy:

- simplistic owner/member roles as a replacement for clinic roles;
- non-RLS security if it bypasses our Supabase model.

License risk:

- MIT. Lower risk, still no copy without approval.

Usefulness now:

- High for billing, tenant admin, activity log.

### 9.15 BoxyHQ SaaS Starter Kit

Scope:

- enterprise SaaS starter;
- Next.js, Postgres, Prisma;
- Apache-2.0;
- SAML SSO, SCIM/directory sync, team invites, roles, audit logs, webhooks, payments.

Useful patterns:

- invite/team/member lifecycle;
- roles and permissions UI;
- audit logs;
- webhooks/events;
- enterprise SSO later.

What DentalFlow should borrow:

- audit log/event model;
- staff invite/member management;
- future clinic enterprise features.

What not to copy:

- overbuilt enterprise SSO for early MVP;
- Prisma/Postgres architecture over our Supabase/RLS architecture;
- code without review.

License risk:

- Apache-2.0. Lower risk, but still no code copy without approval.

Usefulness now:

- Medium-high for staff/team/admin/account modules.

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

This should not be a giant denormalized blob. It should be derived from normalized records plus an explicit activity/audit log where needed.

### 10.2 Encounter / visit model

Existing DentalFlow separates appointment from treatment plan and payments. Good. The missing bridge is likely `encounter` or `visit`:

- appointment = scheduled time;
- encounter/visit = what actually happened clinically;
- completed service = performed work;
- payment = financial transaction;
- document/photo = evidence/artifact attached to patient/visit/tooth/finding.

Recommendation: add a future RECON before implementing documents/payments deeply:

`ENCOUNTER-VISIT-MODEL-RECON-001`

### 10.3 Appointment lifecycle

Borrow appointment statuses from practice systems:

- scheduled;
- confirmed;
- arrived;
- in_progress;
- completed;
- cancelled;
- no_show;
- rescheduled.

But keep appointment separate from treatment completion.

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

This should be implemented before images/photos become real clinic data.

### 10.6 Audit/activity log

Borrow from SaaS starters and medical systems:

- who changed what;
- when;
- tenant context;
- patient context if applicable;
- before/after summaries for sensitive changes;
- non-medical events: invites, role changes, subscription changes.

Do not expose all audit data to normal clinic staff by default.

### 10.7 Tenant onboarding/default bootstrap

DentalFlow just implemented dictionary template/bootstrap correctly. Extend the same explicit bootstrap style to:

- clinic creation;
- staff invitation;
- default roles;
- default schedules/rooms/chairs;
- default dictionary import;
- subscription trial state.

No frontend auto-seeding. No magic records appearing because a page loaded. We have suffered enough magic.

### 10.8 Role label/permission separation

SaaS starters reinforce the same rule already in DentalFlow:

- displayed role must come from active membership;
- permissions must be centralized;
- platform role != clinic role;
- multi-tenant role can change by active tenant.

This supports the current `ROLE-LABEL-UX-001` task.

### 10.9 Reports modules

Reports should not query random UI state. They need stable facts:

- appointments by status/date/doctor;
- completed services;
- payments and debts;
- treatment plan conversion;
- patient sources;
- stock movements;
- doctor performance.

Reports should be late enough to avoid reporting on fake/prototype/localStorage data.

## 11. Patterns to avoid

1. **Global clinic data without tenant_id**
   Fine for desktop apps, unacceptable for DentalFlow SaaS.

2. **Hardcoded roles**
   Doctor/receptionist/cashier must not display or behave as admin.

3. **LocalStorage as production data store**
   OK for local/dev fallback only. Not a SaaS boundary.

4. **Frontend auto-seeding**
   Data bootstrap must be explicit and server/database controlled.

5. **Deleting clinical history**
   Archive/void/supersede instead. Clinical history must survive.

6. **Mixed appointment/treatment/payment model**
   Appointment is time. Treatment plan is intent. Completed service is fact. Payment is money. Mixing them creates reporting rot.

7. **Weak license hygiene**
   GPL/AGPL/proprietary code must not enter DentalFlow without legal approval.

8. **Overabstracted clinical concept model too early**
   OpenMRS-style concepts are powerful, but DentalFlow should not turn a dental MVP into a generic hospital platform. Build domain-specific first, configurable later.

9. **Desktop-only assumptions**
   SQLite/local desktop flows can inspire dental UX, but not SaaS security.

10. **Unlabeled files**
   A photo without patient/tooth/context metadata is future garbage.

## 12. License risk section

### Low/moderate risk: MIT / Apache / permissive

Examples:

- Apexo: MIT;
- JavaFX Periodontal Chart: MIT, but asset provenance needs review;
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

- OpenEMR: GPL-3.0;
- GNU Health: GPL-3.0-or-later;
- Apexo Flutter: GPL-3.0;
- QDento: GPL-3.0;
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
- Stock write-off automation before completed service model is fully stable.
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

- move `BILLING-SUBSCRIPTION-ACCESS-CONTROL-001` before encounter model, but do not mix SaaS subscription billing with clinic patient payments.

## 15. What was intentionally NOT changed

- No code changed.
- No DB migrations changed.
- No cloud touched.
- No dependencies added.
- No external code copied.
- No implementation started.
- No feature branch beyond report-only recon.

## 16. Checks

- `git status --short`: not run locally; report-only GitHub file creation expected.
- npm checks: not required for report-only recon because no app code, migrations, package files, or tests changed.
- GitHub Actions CI: pending until PR creation/update if workflow triggers.

## 17. Final verdict

**RECON COMPLETE**

At least 15 external projects/sources were reviewed. More than 4 deep dives completed. License risks documented. No code copied.

## 18. Recommended next task

Recommended next implementation task after `ROLE-LABEL-UX-001`:

**DENTAL-PHOTO-STORAGE-INTEGRATION-001**

However, this recon strongly recommends adding/including patient file metadata rules in that task, not just raw storage upload. A storage bucket without metadata is not a feature. It is a digital sock drawer.

