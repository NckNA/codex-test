# DEV-RULE-CAPABILITY-RECONCILIATION-001

## Summary

Final verdict: **PASS**

This task converts the project owner's non-duplication/completeness requirement into a permanent development gate.

The new rule requires every user-facing/domain feature task to reconcile three things before implementation:

1. the actual current DentalFlow capability across schema/RPC/repository/hook/UI/tests/frozen reports;
2. the bounded read-only MacDent reference workflow and its evidence limits;
3. an explicit gap decision before any new implementation is allowed.

A living `_ai_work/CAPABILITY_PARITY_MATRIX.md` is now the canonical ledger for this reconciliation.

## Branch

`docs/dev-rule-capability-reconciliation-001`

## PR URL

https://github.com/NckNA/codex-test/pull/410

- Current reviewed head before final report update: `0dbb1845599616b9b4fc894150a53d3f5538ff18`.
- Current CI before final report update: run `#899` / `32583810415`, **SUCCESS** on `0dbb1845599616b9b4fc894150a53d3f5538ff18`.
- Report update commit: N/A because a report cannot truthfully reference its own future update commit; exact final reviewed head/CI/merge evidence belongs in the immutable finalization receipt.

## Changed files

- `_ai_work/AI_WORKFLOW.md`
- `_ai_work/CAPABILITY_PARITY_MATRIX.md`
- `_ai_work/REPORTS/DEV-RULE-CAPABILITY-RECONCILIATION-001_rule.md`

No application code, schema, migration, database, cloud, browser production state, or patient data is changed.

## HERMES skill-first contract

The semantic-skill rule was applied before editing.

Source principles used:

- one semantic source of truth;
- explicit dependency/causal contract before generated implementation;
- forbidden-pattern checks rather than patching duplicated behavior later;
- validation against the declared contract.

For DentalFlow capability work, the corresponding semantic source of truth becomes the capability reconciliation record plus the existing domain architecture, not a newly invented UI surface.

## New mandatory development gate

`_ai_work/AI_WORKFLOW.md` now requires **Capability Reconciliation Gate** before DESIGN/IMPLEMENT.

Each relevant capability must receive a status:

`EXISTS_EQUIVALENT`, `EXISTS_BETTER`, `PARTIAL`, `MISSING`, `WRONG_BOUNDARY`, `REFERENCE_ONLY`, `NOT_REQUIRED`, or `UNKNOWN`.

Each proposed change must receive a decision:

`REUSE`, `EXTEND`, `HARDEN`, `REPLACE`, `NEW`, `DEFER`, or `NOT_REQUIRED`.

An unresolved relevant `UNKNOWN` blocks implementation and requires STUDY/RECON.

## Non-duplication rules added

The workflow now explicitly forbids:

- creating a second table/RPC/repository/hook/page/component/model before checking for an existing equivalent;
- treating missing UI as proof that the backend capability does not exist;
- treating a table/method as proof that an end-to-end workflow is complete;
- silently omitting confirmed fields/states/roles/side effects/lifecycle behavior;
- copying MacDent source, unique text, assets or pixel-perfect UI;
- weakening DentalFlow tenant/security/domain architecture merely to imitate the reference.

## Capability matrix baseline

The first living matrix baseline is the laboratory domain because 002A produced the freshest evidence.

It records, among other things:

- laboratory order model: already exists in DentalFlow; do not duplicate;
- global queue: DentalFlow is intentionally stronger than the inspected patient-level MacDent list;
- reference storage: already exists;
- reference mutation/admin workflow: partial and must be hardened, not rebuilt from scratch;
- print work order: missing and valid future capability;
- share/WhatsApp: present in MacDent but currently unsafe to map onto DentalFlow reminder communication;
- attachments/STL: unresolved;
- lab payables: MacDent reference evidence exists, but DentalFlow finance semantics remain unresolved.

This matrix is intentionally evidence-bounded. Unknowns stay unknown rather than being filled with assumptions.

## Capability reconciliation

### DentalFlow before

The project already had strong frozen reports and architecture decisions, but no single mandatory cross-feature ledger that forced every task to prove whether a capability already existed at schema/repository/UI level before implementation.

### MacDent/reference

MacDent was already an approved read-only functional/process reference. 002A demonstrated why a formal gate is necessary: a shallow earlier search missed a real laboratory module, while broader bounded recon later found `lab.get`, `lab.save`, `lab.getShareLink`, print and send semantics.

### Decision

`NEW` documentation/process capability only. No runtime feature is introduced.

### Implemented delta

- permanent workflow gate added;
- living parity matrix added;
- laboratory baseline populated from frozen 002A evidence.

### Remaining parity gaps

The matrix is not a claim that the entire product has now been re-audited against MacDent. Future tasks must expand/update the relevant domain rows as part of their own STUDY/RECON.

### Non-duplication proof

No application entity, schema object, RPC, repository, hook, page or component was created. This task changes documentation/process only.

## Checks

- HERMES semantic skill source re-read: **PASS**.
- Existing `_ai_work/AI_WORKFLOW.md` inspected before edit: **PASS**.
- Frozen `LAB-WORK-NEXT-RECON-002A` report used as the source for the initial lab matrix: **PASS**.
- No application/migration/database changes: **PASS**.
- No MacDent/amoCRM mutation: **PASS**.
- No production/patient-data access: **PASS**.
- GitHub CI on the reviewed pre-final-report head: **PASS** (`#899` / `32583810415`).

## Browser smoke

**NOT REQUIRED** because the task is documentation/process only and changes no runtime UI or behavior.

## Issues / Limitations

- The matrix is intentionally not a retroactive claim of full product-wide MacDent parity. It starts with the laboratory domain because that is the currently active development track.
- Future feature tasks must expand or refresh only the relevant domain rows from fresh evidence.
- `UNKNOWN` remains a blocking status rather than an invitation to guess.

## Final verdict

**PASS**. The development rule and living parity matrix are complete for this documentation task. Final PR head/CI/merge metadata is finalized by the immutable receipt after merge.

## Recommended next task

**LAB-WORK-REFERENCE-ADMIN-RECON-002B**

Apply the new Capability Reconciliation Gate before any implementation. Reconcile the existing DentalFlow reference tables/repository/RLS behavior against available MacDent reference evidence, then freeze the exact create/update/deactivate/reactivate, stale/idempotency, audit/activity, role, tenant-isolation, historical-reference and hard-delete contracts before UI or migration work.
