# DentalFlow ↔ MacDent Capability Parity Matrix

This file is a living pre-implementation and post-verification ledger. It exists to prevent duplicate, partial, or wrongly-bounded feature implementation.

## Mandatory status vocabulary

- `EXISTS_EQUIVALENT` — DentalFlow already has the required capability at the relevant end-to-end level.
- `EXISTS_BETTER` — DentalFlow intentionally has a stronger architecture/workflow than the reference and should keep it.
- `PARTIAL` — part of the capability exists, but the workflow/contract is incomplete.
- `MISSING` — required capability is not implemented in DentalFlow.
- `WRONG_BOUNDARY` — something exists, but ownership/domain placement is unsafe or semantically wrong.
- `REFERENCE_ONLY` — observed in MacDent/reference workflow, but not yet accepted as a DentalFlow requirement.
- `NOT_REQUIRED` — deliberately excluded from DentalFlow with documented reason.
- `UNKNOWN` — evidence is insufficient. Implementation is blocked until STUDY/RECON resolves it.

## Mandatory decision vocabulary

`REUSE` | `EXTEND` | `HARDEN` | `REPLACE` | `NEW` | `DEFER` | `NOT_REQUIRED`

## Rules

1. Before DESIGN/IMPLEMENT, update every row touched by the task from fresh DentalFlow evidence and bounded MacDent read-only evidence.
2. Absence of UI does not mean absence of capability. Check schema, RPC, repositories, hooks, UI, tests and frozen reports.
3. Presence of a table/method does not mean the capability is complete. Check the end-to-end lifecycle, roles, states, side effects, audit and error behavior.
4. MacDent is a workflow/process reference only. Do not copy source code, unique text, assets or pixel-perfect UI.
5. If DentalFlow already has the stronger design, preserve it and mark `EXISTS_BETTER` rather than regressing toward the reference.
6. Any `UNKNOWN` relevant to the proposed implementation blocks implementation until a separate recon resolves it.
7. After VERIFY/AUDIT, update the same rows again to reflect the actual merged state.

## Laboratory domain baseline after LAB-WORK-NEXT-RECON-002A

| Capability | DentalFlow current state | MacDent reference evidence | Status | Decision | Next evidence/task |
| --- | --- | --- | --- | --- | --- |
| Patient-context laboratory work list | Patient laboratory surface exists; global clinic queue also exists | Patient-context `lab.get` list observed | `EXISTS_BETTER` | `REUSE` | Preserve DentalFlow global + patient views |
| Laboratory work-order data model | Tenant-scoped work orders with doctor/laboratory/work types, lifecycle fields and hardened mutations already exist | `lab.save` with patient, zapis, filial, number, name, send day, doctor, laboratory, dates, shade, teeth, work types, status, paid/pay, comment observed | `EXISTS_BETTER` | `REUSE` | Do not create a second order model |
| Global laboratory queue | Server-side filtering/search/order/pagination/whole-tenant summary frozen in 001W–001Z | Inspected MacDent module showed patient-context list; equivalent clinic-wide server-paged queue not established in bounded evidence | `EXISTS_BETTER` | `REUSE` | Keep DentalFlow queue architecture |
| Laboratory/work-type reference storage | Canonical tenant-scoped `laboratories` and `laboratory_work_types` exist | Laboratory and work-type values are used by the order workflow | `EXISTS_EQUIVALENT` | `REUSE` | No duplicate settings-only copy |
| Safe reference mutation contract | Canonical tables and direct repository create/update already exist, but authenticated writes still bypass stale/idempotency/audit guards and current grants/RLS permit hard DELETE | Dedicated authenticated MacDent `/app/laboratories` administration route is now proven; exact fields/actions/role semantics remain intentionally unknown because production mutation/navigation was not performed | `PARTIAL` | `HARDEN` | `LAB-WORK-REFERENCE-ADMIN-MUTATION-002C`: versioned audited RPC-only writes, deterministic create IDs, stale guard, explicit deactivate/reactivate, hard-delete prohibition |
| Owner/admin reference-management UI | No production management surface in current Settings page; existing repository mutation methods must not be wired directly to UI | Dedicated MacDent `/app/laboratories` management route is proven, but exact controls/roles remain unobserved | `PARTIAL` | `EXTEND` | Harden mutation boundary in 002C first, then extend the existing Settings page without creating a second reference model/page |
| Historical inactive reference preservation | Existing order read/edit paths already preserve and render an inactive current laboratory/work type while preventing it from being newly selected; mutation lifecycle itself is not yet hardened | Exact MacDent inactive/archive semantics remain unproven | `EXISTS_BETTER` | `REUSE` | Preserve current read/use semantics; 002C adds deactivate/reactivate + no hard-delete application path without introducing snapshots or a second history store |
| Printable laboratory work order | No dedicated laboratory print/work-order projection yet | Dedicated `print_lab/{id}` action observed | `MISSING` | `NEW` | After reference administration is frozen |
| Laboratory share link / generated share text | No lab-specific share contract | `lab.getShareLink` and generated send text observed | `MISSING` | `DEFER` | Separate communication/share recon; recipient/consent semantics unresolved |
| WhatsApp send from laboratory workflow | Existing DentalFlow communication contract is appointment-reminder-oriented and simulation-only for this purpose | MacDent send action opens WhatsApp flow with empty phone parameter in inspected code | `WRONG_BOUNDARY` | `DEFER` | Do not reuse appointment reminder path for lab orders |
| Laboratory attachments / STL / scans | Generic patient-file path is not suitable: current validation/storage is dental-image-oriented despite `document` type | Not proven in the bounded MacDent laboratory module | `UNKNOWN` | `DEFER` | Separate storage/attachment recon if product need is selected |
| Laboratory payables / paid amount | No accepted lab-payables ledger semantics | `isPaid` / `pay` fields observed in MacDent order workflow | `REFERENCE_ONLY` | `DEFER` | Separate finance semantics recon; do not mix with patient payments |
| amoCRM ownership of laboratory truth | DentalFlow owns medical/operational laboratory truth | No evidence that amoCRM owns laboratory domain truth | `NOT_REQUIRED` | `NOT_REQUIRED` | amoCRM may later orchestrate communication only |

## Required per-task reconciliation block

Every feature report that changes user-facing or domain behavior must include:

- **DentalFlow before:** exact existing capability and evidence.
- **MacDent/reference:** exact observed workflow evidence and its limits.
- **Decision:** reuse/extend/harden/replace/new/defer/not-required.
- **Implemented delta:** what changed and what did not.
- **Remaining parity gaps:** explicit deferred/unknown items.
- **Non-duplication proof:** why no second entity/table/RPC/repository/hook/page was accidentally introduced for an existing capability.
