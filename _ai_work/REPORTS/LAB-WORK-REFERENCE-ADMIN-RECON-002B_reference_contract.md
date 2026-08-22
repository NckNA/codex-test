# QA Report: LAB-WORK-REFERENCE-ADMIN-RECON-002B

- Verdict: **PASSED**

## Branch

recon/lab-work-reference-admin-recon-002b

## Pr Url

https://github.com/NckNA/codex-test/pull/411

- Exact recon head: `0b8c438b952c313664cb8fae79d015a6048f078b`.
- Fresh recon CI: run `#902` / `32596653547`, **SUCCESS** on `0b8c438b952c313664cb8fae79d015a6048f078b`.
- PR #411 merge commit: `4f93361fab70173de06ec3ba7469fb37b381c6d0`.
- `finalize_report_metadata` confirmed the exact reviewed head and CI #902, then hit the known bridge bug `replaceReportPlaceholders is not defined`; it made no report commit or push.
- Report update commit: N/A because a report cannot truthfully reference its own future correction commit; correction PR/CI/merge evidence is recorded in the immutable finalization receipt.

## Environment

local repo + authenticated MacDent read-only CDP

## Summary

002B completed and froze the laboratory reference-administration write contract. DentalFlow already has canonical tenant-scoped laboratories and laboratory_work_types and must not create a second reference model. Current direct repository writes are unsafe for a Settings UI because they lack mutation_version stale protection, deterministic create idempotency, same-transaction audit, explicit deactivate/reactivate semantics, and they coexist with authenticated direct INSERT/UPDATE/DELETE including hard DELETE. Fresh bounded MacDent evidence confirms a dedicated authenticated /app/laboratories administration route, while exact fields/actions/roles remain intentionally UNKNOWN because no production navigation or mutation was performed. The persisted parity matrix now records REUSE/HARDEN/EXTEND decisions. The 002C contract is: owner/admin writes only; doctor/registrar read; cashier none; tenant-scoped SECURITY DEFINER RPC checks; caller-provided deterministic UUID create; expected-version update/deactivate/reactivate; identical create retry returns existing row without duplicate audit; conflicting retry errors; one audit_events row per successful state change; no activity_events expansion; inactive references remain readable historically and unavailable for new selection; no hard-delete application path; no invented name/code uniqueness; no second history/snapshot store. The prior Hermes taskId/schema blocker is resolved by the repaired bridge. Development gate PR #410 passed CI #900 on eb36e1bdf9fdd2bf05908e5f0093b2ca7b3d610c and merged as f584f9bf4a400ba03a5788caa8a00f6279baa348. No app code, migration, database, cloud, production or patient-data mutation was performed.

## Checks

```json
{
  "HERMES skill-first semantic contract": "PASS",
  "DentalFlow schema/repository/hooks/UI read-only recon": "PASS",
  "Fresh MacDent read-only laboratory comparison": "PASS",
  "MacDent dedicated /app/laboratories route proof": "PASS",
  "No duplicate reference entity/table required": "PASS",
  "Existing inactive historical-reference preservation proved": "PASS",
  "Direct authenticated INSERT/UPDATE/DELETE bypass risk identified": "PASS",
  "Hard-delete capability identified": "PASS",
  "Audit vs activity boundary corrected": "PASS",
  "Capability parity matrix persisted": "PASS",
  "Accidental report aliases removed": "PASS",
  "Development gate PR #410 merged after green exact-head CI": "PASS",
  "Hermes taskId/schema mutation-tool blocker resolved": "PASS",
  "No cloud/production/patient writes": "PASS",
  "Application/runtime tests": "NOT REQUIRED for report-only recon",
  "Browser localhost smoke": "NOT REQUIRED"
}
```

## Validation Sections

```json
{
  "Capability reconciliation": {
    "DentalFlow before": [
      "Canonical laboratories and laboratory_work_types already exist and are tenant scoped.",
      "LaboratoryWorkRepository already exposes list/create/update for both reference types; current writes go directly to Supabase tables.",
      "SettingsPage has no laboratory-reference administration surface.",
      "useLaboratoryMutationOptions and LaboratoryWorkOrderDialog already preserve an inactive current value while preventing it from being newly selected.",
      "Migration 0036 already establishes proven laboratory-order mutation patterns: actor/tenant role checks, deterministic create identifiers, expected mutation version, stale errors and same-transaction audit."
    ],
    "MacDent reference": [
      "Fresh passive code recon confirms laboratory work order handling and use of laboratory/work-type selectors.",
      "Fresh structural DOM recon proves an authenticated dedicated /app/laboratories route exists and is linked from the laboratory workflow.",
      "Exact fields, roles, create/update/delete/archive behavior and API of /app/laboratories remain UNKNOWN because no production navigation or mutation was performed."
    ],
    "Decision": [
      "REUSE laboratories and laboratory_work_types.",
      "HARDEN the existing write boundary rather than expose direct repository writes.",
      "REUSE current inactive-reference rendering semantics.",
      "Do not create a second reference/history/snapshot model.",
      "DEFER Settings UI until the hardened mutation boundary is frozen."
    ]
  },
  "Frozen 002C mutation contract": {
    "Operations": [
      "create laboratory",
      "update laboratory metadata",
      "deactivate laboratory",
      "reactivate laboratory",
      "create work type",
      "update work type metadata/sort order",
      "deactivate work type",
      "reactivate work type"
    ],
    "Roles": "clinic_owner and clinic_admin write; clinic_owner/clinic_admin/doctor/registrar read; cashier none. Enforce writes server-side.",
    "Tenant isolation": "SECURITY DEFINER RPC verifies auth.uid() membership/role for p_tenant_id and scopes every target lookup by tenant_id. Cross-tenant target IDs fail without leaking foreign data.",
    "Concurrency": "Add mutation_version bigint >=1 to both reference tables. Update/deactivate/reactivate require expected_version and lock/check atomically.",
    "Retry semantics": "Create uses caller-provided UUID. Retry with same tenant/id and canonically identical create payload returns existing row without second audit; same id with conflicting payload returns explicit create-conflict. Update-like retries after an applied write fail stale and require refetch.",
    "Write-boundary enforcement": "Revoke authenticated INSERT, UPDATE and DELETE on both reference tables and retire direct mutation policies. Keep SELECT for allowed roles. Application writes only through guarded RPCs; service_role remains infrastructure-only.",
    "Audit": "Every successful state-changing RPC writes exactly one same-transaction audit_events row using existing laboratory category and safe target/action metadata. Do not log full free-text notes unnecessarily.",
    "Activity": "Do not add activity_events in 002C. Existing taxonomy has no laboratory category and migration 0036 intentionally leaves product-facing activity projection unchanged.",
    "Historical behavior": "Inactive refs remain renderable on existing orders and unavailable for new selection. Renaming changes the live label; immutable snapshots are not introduced without separate compliance/document evidence.",
    "Uniqueness": "Do not invent tenant name/code uniqueness; current evidence does not justify it."
  },
  "Safe error taxonomy": [
    "LAB_REF_ACCESS_DENIED",
    "LAB_REF_REQUIRED_ID_MISSING",
    "LAB_REF_NAME_REQUIRED",
    "LAB_REF_NOT_FOUND",
    "LAB_REF_STALE_WRITE",
    "LAB_REF_CREATE_CONFLICT",
    "LAB_REF_INVALID_STATE",
    "LAB_REF_OPERATION_UNCERTAIN at client boundary"
  ],
  "Non-duplication proof": [
    "No new laboratory or work-type entity/table.",
    "No duplicate historical reference store.",
    "Do not reuse patient communication/reminder infrastructure for reference admin.",
    "Use existing audit helper/category instead of a laboratory-specific audit table.",
    "A dedicated reference mutation client is permitted only for the distinct RPC boundary; it must not duplicate order storage or queue logic.",
    "Existing direct repository write methods must be removed, deprecated, or redirected before Settings UI is allowed."
  ],
  "Forbidden patterns": [
    "No direct Settings UI wired to current table create/update methods.",
    "No hard-delete UI or normal application delete path.",
    "No direct authenticated INSERT/UPDATE/DELETE bypass around RPC audit/version checks.",
    "No activity_events taxonomy expansion merely to make this task look complete.",
    "No copying MacDent code/UI/text.",
    "No assumptions about exact /app/laboratories fields/roles/delete behavior until observed.",
    "No lab finance/payables, file sharing or WhatsApp work in this task."
  ]
}
```

## Changed Files
- _ai_work/CAPABILITY_PARITY_MATRIX.md
- _ai_work/REPORTS/LAB-WORK-REFERENCE-ADMIN-RECON-002B_reference_contract.md
- _ai_work/REPORTS/LAB-WORK-REFERENCE-ADMIN-RECON-002B_reference_contract.json

## Roles Tested
- None

## Limitations
- Exact MacDent /app/laboratories fields/actions/role model remain UNKNOWN; only route existence and linkage are proven read-only.
- 002B freezes the mutation contract only; application/schema implementation belongs to 002C.

## Browser smoke

**NOT REQUIRED** because 002B is report/reconciliation only and changes no runtime UI or application behavior.

## Final verdict

**PASS**

The recon contract and parity delta are complete. PR #411 is verified and merged; this one-file correction persists the final reviewed head, CI, merge evidence and known finalizer failure. After the correction PR is green and merged with its immutable receipt, 002B is **PASS / FROZEN** and 002C is unblocked.

## Ci

```json
{
  "developmentGatePr": 410,
  "developmentGateHead": "eb36e1bdf9fdd2bf05908e5f0093b2ca7b3d610c",
  "developmentGateRun": 32583942033,
  "developmentGateRunNumber": 900,
  "developmentGateConclusion": "SUCCESS",
  "developmentGateMerge": "f584f9bf4a400ba03a5788caa8a00f6279baa348"
}
```

## Recommended Next Task

LAB-WORK-REFERENCE-ADMIN-MUTATION-002C

## Implementation Head

0b8c438b952c313664cb8fae79d015a6048f078b

## Reviewed Head

0b8c438b952c313664cb8fae79d015a6048f078b

## Final Report Update Head

N/A; exact correction commit is recorded in the immutable finalization receipt.

## Latest Ci After Update

CI #902 / run 32596653547 SUCCESS on 0b8c438b952c313664cb8fae79d015a6048f078b before the one-file correction; correction CI is recorded in the immutable finalization receipt.
