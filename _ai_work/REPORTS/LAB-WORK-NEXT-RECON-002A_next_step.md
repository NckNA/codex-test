# LAB-WORK-NEXT-RECON-002A

## Summary

Final verdict: **PASS**

002A re-ran the laboratory roadmap after the 001W/001X/001Y/001Z pagination track was fully frozen. The purpose was not to add another feature by momentum, but to identify the next missing production capability from current DentalFlow state, passive MacDent evidence, amoCRM boundary evidence, current Kazakhstan documentation sources, and real laboratory workflow examples.

Selected next direction:

**laboratory reference administration must be hardened before adding another operator-facing laboratory feature.**

The next task is therefore a report-only write-contract reconnaissance for clinic-managed `laboratories` and `laboratory_work_types`.

## Branch

`recon/lab-work-next-recon-002a`

## PR URL

https://github.com/NckNA/codex-test/pull/408

- Baseline: `ea5836757dbee67cd00b484700fc22fc8732d1ea` (001Z finalization merged/frozen).
- Initial report commit: `2c37849218a0902eef0c92c8c663ac4fcaddba57`.
- Initial report CI: run `#893` / `32581554804`, **SUCCESS** on `2c37849218a0902eef0c92c8c663ac4fcaddba57`.
- Final reviewed PR #408 head: `3d661552c5bb69e5a0a4e45f8a992192c5785793`.
- Final PR #408 CI: run `#894` / `32581874753`, **SUCCESS** on `3d661552c5bb69e5a0a4e45f8a992192c5785793`.
- PR #408 merge commit: `a381a0b7d860a81cc15ee082845cee18d00bc2da`.
- Metadata finalizer verified the exact reviewed head and green CI, then hit the known Hermes defect `replaceReportPlaceholders is not defined`; it made no report commit or push. This correction records the immutable final evidence after merge.

## Changed files

Exactly one report file belongs to 002A:

`_ai_work/REPORTS/LAB-WORK-NEXT-RECON-002A_next_step.md`

No application, migration, seed, package, lockfile, screenshot or environment file is changed.

## Scope

002A is STUDY/RECON only.

Allowed:

- read frozen DentalFlow reports and source;
- passive read-only inspection of code already parsed by authenticated MacDent/amoCRM pages;
- public web research;
- compare candidate next capabilities;
- write this report.

Forbidden and not performed:

- DentalFlow application code changes;
- migrations;
- local or cloud database mutation;
- MacDent mutation or request replay;
- amoCRM mutation;
- patient-field value reading from production pages;
- real-patient QA;
- speculative finance semantics.

## Frozen DentalFlow baseline after 001Z

The laboratory track now already has:

- tenant-scoped laboratory/work-type/order schema;
- repository and fail-closed Supabase selection;
- patient-card laboratory read surface;
- resolved doctor/laboratory/work-type references;
- clinic-wide operational queue;
- hardened create/update/complete/reopen order mutations;
- bounded patient lookup for queue create;
- exact-ID patient label hydration;
- server-side queue filters/search/order/pagination/summary;
- real `/laboratory` queue UI with role gate and browser-tested tenant isolation.

Therefore another queue/read/mutation task would be duplication, not progression.

## Corrected MacDent evidence

### Correction to the shallow 001Z observation

A shallow search during 001Z did not identify a separate MacDent laboratory workflow in loaded resources. 002A deliberately re-ran that study with broader passive code search on the already-authenticated `https://macdent.kz/app` page.

The deeper search **did identify a real laboratory module**. This report supersedes the earlier shallow negative observation for roadmap purposes.

No MacDent action was invoked. Evidence came only from source already parsed by the browser.

### Observed MacDent laboratory model

The loaded application contains a laboratory surface mounted as `labRefPaneTemplate` and labelled `Лаборатория`.

Observed state and workflow include:

- patient context;
- appointment/record reference (`zapis`);
- branch (`filial`);
- laboratory work list;
- create/edit form;
- work number;
- work name;
- doctor;
- laboratory;
- send date;
- planned ready date;
- take date;
- fit date;
- shade/color;
- teeth/anatomical selection;
- multiple work types plus free-text `other`;
- status;
- paid flag and amount;
- comment.

Observed save call shape uses `DoQuery('lab', 'save', ...)`.

002A **did not call it**.

### MacDent patient-context list

The observed list call is approximately:

`lab.get(patientId, page=1, atPage=200, order=labDate, desc=1)`

This confirms MacDent's patient-level list but does not change the frozen DentalFlow global queue architecture. DentalFlow's server-paged clinic queue remains its own product architecture.

### Print/share evidence

MacDent renders explicit actions:

- `Изменить`;
- `Печать`;
- `Отправить`.

Print opens a dedicated `print_lab/{id}` page.

Send first asks the laboratory backend for `getShareLink`, then opens the WhatsApp sending page with generated order text. The observed code leaves the phone parameter empty.

Consequences:

1. A printable laboratory work order is a real workflow and should remain on the DentalFlow roadmap.
2. The recipient semantics for automated sharing are **not proven** by this evidence. An empty phone parameter means 002A must not infer that the recipient is the patient, technician, laboratory contact, or another party.
3. DentalFlow must not copy MacDent source, text, HTML or UI assets. Only the workflow semantics are reusable.

### MacDent reference-management evidence

The loaded laboratory module exposes `laboratory` and work-type values as order inputs. The inspected client-side module shows only `lab.get`, `lab.save` and `lab.getShareLink`; no separate laboratory-reference administration API was identified in this bounded source search.

That does **not** imply DentalFlow should use free-text laboratory names. DentalFlow already deliberately models laboratories and work types as tenant-scoped references with stable IDs, historical inactive values and referential integrity.

The resulting obligation is ours: those references need a safe clinic-management surface.

## amoCRM boundary evidence

Passive read-only search of the authenticated amoCRM page did not identify laboratory-domain semantics such as a laboratory order entity or work-type model.

Generic amoCRM/files/tasks/WhatsApp capabilities exist, but that is not evidence that amoCRM should own laboratory truth.

Frozen boundary remains:

- DentalFlow owns the laboratory work order and its medical/operational references;
- amoCRM may later participate in customer communication or delivery orchestration;
- amoCRM must not become the canonical laboratory record.

## External research

### Kazakhstan medical-document forms

Current official Kazakhstan health-accounting documentation was checked through the updated Ministry order on medical accounting forms. The current material includes the dental patient medical card (form 058/у), but the bounded official-source search did not identify a dedicated statutory form named dental laboratory `заказ-наряд` / `наряд`.

Decision:

- do not represent a future DentalFlow laboratory work-order sheet as an official state form unless a later legal/compliance study proves that status;
- treat it as an operational production document generated from canonical laboratory-order facts.

This is a bounded research result, not a legal opinion.

### Real laboratory workflows

Current dental-laboratory sites in Kazakhstan expose online `наряд` / `наряд-задание` workflows. Observed examples request clinic/doctor, due date and work data and may accept scans/files; other examples describe status tracking from order intake through production and delivery.

This supports the product value of a future structured work-order/print/share surface.

It does not override DentalFlow tenant, medical, finance or document boundaries.

## Current DentalFlow gaps found by 002A

### 1. Laboratory references have backend CRUD but no application management surface

`ILaboratoryWorkRepository` already exposes:

- `createLaboratory`;
- `updateLaboratory`;
- `createWorkType`;
- `updateWorkType`.

Repository implementation and tests are currently the only callers. No application component/hook uses these write methods.

`SettingsPage` currently contains only amoCRM integration settings.

### 2. Production seed does not provide real laboratory/work-type data

No production seed/bootstrap inserts clinic laboratories or laboratory work types. Entries exist only in SQL tests.

Therefore a newly configured clinic cannot rely on seed data to make laboratory/work-type selectors meaningful.

### 3. Existing reference writes are foundation-level, not hardened operational writes

Migration 0035 RLS correctly restricts reference maintenance to `clinic_owner` / `clinic_admin` and allows clinical operational roles to read them.

However the current direct-table write path has no dedicated mutation contract equivalent to frozen laboratory-order mutations:

- no explicit operation key/idempotency contract;
- no stale-write/version contract;
- no laboratory-reference audit/activity event contract identified in 0035;
- direct RLS also permits hard DELETE to owner/admin.

A UI must not simply expose those old repository methods and call the job finished.

### 4. Hard delete is a bad default for historical references

Laboratory orders reference laboratories by tenant+ID, and work types are linked to orders.

Historical orders must continue to resolve a previously used laboratory/work type after it stops being selectable for new work.

Selected lifecycle for recon:

- create;
- edit metadata;
- deactivate/reactivate;
- preserve inactive historical references;
- **no hard-delete UI** unless a later explicit contract proves a safe use case.

### 5. Print/order-sheet workflow is real but secondary

The current queue already possesses most facts required for a printable order sheet, and `getOrder(id)` exists.

But `DocumentsPage` is still a placeholder and `PatientFilesRepository` currently validates uploads as images and writes storage paths under `dental-photos`, even though the type union includes `document`.

Therefore the first printable laboratory order should be a read-only projection/print view, not prematurely persisted into the generic document/file system.

### 6. Communication/share workflow is not ready for laboratory semantics

Current `CommunicationPurpose` values are appointment-reminder purposes only. Communication adapters are simulation-only.

A laboratory share action therefore cannot be safely shoehorned into existing reminder orchestration.

Recipient/contact semantics are also unresolved.

## Candidate comparison

| Candidate | Evidence | Product value now | Architectural uncertainty | Decision |
| --- | --- | --- | --- | --- |
| Reference administration | Strong DentalFlow gap; required by existing selectors; owner/admin RLS exists | Critical | Write/audit/version lifecycle must be hardened | **NEXT** |
| Printable work-order sheet | Strong MacDent + real laboratory evidence | High | Document persistence/status classification still open | Next after reference admin |
| WhatsApp/share | MacDent has generated share text | Medium/high | Recipient identity, consent, route and communication purpose unresolved | Defer |
| Attachments/STL/files | Real labs use digital files | High later | Patient-files subsystem is image-centric; lab vs patient ownership unresolved | Defer |
| Lab finance/payables | MacDent exposes paid/pay amount | Potentially high | Payer/payee/ledger semantics unresolved | Defer |
| Appointment/treatment-stage links | Possible contextual value | Medium | Canonical lifecycle dependency not proven | Defer |
| Remake/cancel/archive | Mentioned in older backlog | Medium | No sufficient current workflow evidence | Defer |
| Bulk/export | MacDent heritage evidence exists | Medium | Less fundamental than tenant setup | Defer |

## Semantic contract for the selected next direction

The next reference-administration track must preserve one source of truth:

`tenant laboratory/work-type references -> order selection/rendering`

It must **not** create a second settings-only copy of reference data.

Required invariants for the next write-contract recon:

1. `laboratories` and `laboratory_work_types` remain tenant-scoped canonical tables.
2. Only owner/admin may mutate reference configuration.
3. Doctor/registrar may read references required for operational work but may not maintain them.
4. Cashier and unrelated roles receive no laboratory-reference management capability.
5. Deactivation prevents a reference from being offered for new orders but does not erase historical labels.
6. Existing orders using an inactive reference remain valid and readable.
7. No hard delete is exposed by default.
8. Mutations require a defined stale/conflict strategy before UI implementation.
9. Mutations require a defined audit/activity strategy before UI implementation.
10. Cross-tenant IDs must never be accepted as mutation targets.
11. Production Supabase failure must fail closed; no localStorage fallback is allowed in active Supabase mode.
12. No finance, treatment-plan, completed-service, document, warehouse, MacDent or amoCRM side effects are introduced by reference administration.

## Recommended implementation sequence

The selected sequence is intentionally narrow:

1. **002B — reference-admin mutation RECON/write contract**.
2. If 002B passes: atomic/hardened reference mutation foundation.
3. Then typed client/hook and owner/admin settings UI with browser role/tenant QA.
4. After reference administration is frozen: return to **laboratory work-order sheet / print** as the next independent capability.
5. Share/files/finance each require their own separate STUDY/RECON before implementation.

## Browser smoke

**NOT REQUIRED**

002A is report-only reconnaissance. It changes no DentalFlow route, component, hook, repository, schema or runtime behavior. Website evidence was gathered through passive read-only inspection of already-loaded MacDent/amoCRM browser sources, not through DentalFlow browser mutation QA.

## Checks

- Frozen 001A–001Z reports/source inspected: **PASS**.
- Current lab repository/reference write usage inspected: **PASS**.
- Current production seed/reference bootstrap search: **PASS** — no lab/work-type production seed found.
- Current `SettingsPage`: **PASS** — amoCRM settings only.
- Migration 0035 reference RLS reviewed: **PASS**.
- 0035 audit/activity hook search: **PASS** — no reference mutation audit/activity contract identified.
- MacDent loaded-source passive recon: **PASS**.
- MacDent `lab.get` / `lab.save` / `lab.getShareLink` structure identified without invocation: **PASS**.
- MacDent print/share actions identified without invoking them: **PASS**.
- amoCRM passive lab-domain search: **PASS** — no lab-domain ownership evidence found.
- Current DentalFlow communication contract inspected: **PASS** — appointment-only purposes, simulation-only execution.
- Current document/file surfaces inspected: **PASS** — DocumentsPage placeholder, patient upload path image-centric.
- Kazakhstan official-form research: **PASS / bounded** — no dedicated statutory dental-lab order form identified in the searched current medical-form source.
- Current Kazakhstan laboratory workflow examples reviewed: **PASS**.
- Application code changes: **0**.
- Migration changes: **0**.
- Database writes: **0**.
- MacDent writes: **0**.
- amoCRM writes: **0**.
- Cloud Supabase: **NOT USED**.

## Issues / limitations

1. MacDent client code proves workflow fields/actions, not full backend schema or all business rules.
2. The exact HTML input type for every MacDent laboratory field was not required to select the next DentalFlow capability and was not inferred where evidence was incomplete.
3. The official Kazakhstan search result is not a legal certification that no laboratory work-order form exists anywhere in regulation. A compliance-specific task must be used before labeling any generated document as an official form.
4. Real laboratory websites are workflow evidence, not normative sources.
5. Shared Hermes task policy was repeatedly overwritten by parallel sessions. Every sensitive operation remained behind policy verification/reapplication; 002A performed no data or application mutation.

## Final verdict

**PASS**

The pagination/queue track is complete. The next production blocker is configuration safety, not another queue feature.

## Recommended next task

**LAB-WORK-REFERENCE-ADMIN-RECON-002B**

Report-only reconnaissance and semantic write contract for tenant laboratory/work-type administration. Decide exact create/update/deactivate/reactivate operations, stale/idempotency semantics, audit/activity requirements, role matrix, historical-reference preservation, hard-delete prohibition, error taxonomy, local QA and tenant-isolation evidence. Do not implement UI or migrations until that contract is frozen.
