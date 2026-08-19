# LAB-WORK-PATIENT-REFERENCE-SURFACE-001I — Patient Laboratory Reference Surface

## Summary

Updated the existing read-only patient `Лаборатория` tab to consume the frozen 001H reference resolver and display human-readable responsible doctor, laboratory and laboratory work-type names. Primary laboratory order facts remain usable even when reference enrichment fails.

Final verdict: **PASS**

## Branch

`feature/lab-work-patient-reference-surface-001i`

## PR URL

https://github.com/NckNA/codex-test/pull/375

- Base branch: `main`.
- Verified baseline: `97cfe299dc9a4105f518488b81c94850d95f31ee`.
- Implementation head: `d7bc5b1c050613a360172112ea1b5b90307eef27`.
- Implementation CI: run `#802` / `32226670455`, **SUCCESS**.
- Report update commit: N/A because the report commit cannot contain its own future SHA; final report commit and CI belong in the immutable finalization receipt.

## Changed files summary

Implementation:

1. `src/components/patients/patient-card/PatientLaboratoryWorkTab.tsx`
2. `src/components/patients/patient-card/PatientLaboratoryWorkTab.test.tsx`

Final report:

3. `_ai_work/REPORTS/LAB-WORK-PATIENT-REFERENCE-SURFACE-001I_reference_surface.md`

No repository, migration, seed, package, lockfile, finance, warehouse, treatment/completed-service, MacDent or amoCRM code belongs in this task.

## 1. UI semantic flow

```text
PatientLaboratoryWorkTab(patientId)
→ usePatientLaboratoryWorkOrders(patientId) [001D]
→ orders
→ usePatientLaboratoryWorkReferences(orders) [001H]
→ referencesByOrderId
→ read-only human-readable order surface
```

Per order, 001I can now display:

- `Ответственный врач` when safely resolved;
- `Лаборатория` when safely resolved;
- `Виды работ` when one or more names are resolved;
- all previously accepted operational fields from 001F.

Raw `responsibleDoctorId`, `laboratoryId` and work-type IDs remain absent from rendered text.

## 2. Failure isolation

Reference enrichment is secondary to the canonical patient laboratory order read.

If 001H is loading, orders remain visible and the UI shows a bounded informational loading message.

If 001H fails:

- laboratory orders remain visible;
- the user receives a safe warning that reference labels could not be loaded;
- retry calls only `refetchReferences()`;
- the primary 001D order read is not discarded or reclassified as failed.

This prevents a reference-dictionary failure from blanking the patient's operational laboratory history.

## 3. Read-only boundary

001I adds no create, edit, delete or status-transition action.

The component consumes only:

```text
usePatientLaboratoryWorkOrders
usePatientLaboratoryWorkReferences
```

It does not import or instantiate the laboratory repository or doctor repository and has no mutation API access.

## 4. Local doctor safety behavior

001H intentionally blocks the legacy unscoped local DoctorRepository. Therefore:

- tenant-scoped Supabase sessions resolve doctor names;
- local fallback may show laboratory/type names while omitting doctor name;
- 001I never substitutes a raw doctor ID when a safe name is unavailable.

No unrelated doctor-repository refactor was introduced here.

## Checks

### Targeted suite

**PASS — 20/20 tests** across:

- `PatientLaboratoryWorkTab.test.tsx`: 6;
- `usePatientLaboratoryWorkReferences.test.tsx`: 6;
- `usePatientLaboratoryWorkOrders.test.tsx`: 8.

Coverage proves resolved doctor/lab/type names, no raw IDs, isolated reference failure/retry, primary order visibility during enrichment failure, tenant-timezone operational fields, and no mutation controls.

### Full quality gate

- `npm run lint`: **PASS**;
- full Vitest: **PASS — 119 files / 1234 tests**;
- `npm run build`: **PASS**;
- `git diff --check`: **PASS**.

### GitHub CI

Implementation SHA `d7bc5b1c050613a360172112ea1b5b90307eef27` passed CI run `#802` / `32226670455` with Merge guard, ESLint, Tests and Build successful.

## Browser smoke

**PASS — real localhost Supabase/browser QA.**

### Admin A

Synthetic fixture included:

- patient;
- doctor;
- laboratory;
- two laboratory work types;
- one laboratory order;
- two order/type relation rows.

Observed in the real patient card after refresh:

- order title/number;
- resolved doctor name;
- resolved laboratory name;
- both work-type names in deterministic order;
- shade/anatomical facts;
- no raw doctor/laboratory UUIDs;
- no create/edit/delete laboratory-work controls.

Console errors: `0`.
Failed requests: `0`.
Secrets visible: `false`.
Cleanup verification: links/orders/types/labs/doctors/patients all `0`.

### Doctor A

Independent synthetic fixture verified the same resolved reference labels under the doctor role through local Supabase RLS.

Console errors: `0`.
Failed requests: `0`.
Secrets visible: `false`.
Cleanup verification: links/orders/types/labs/doctors/patients all `0`.

No MacDent or amoCRM record was read or mutated for browser QA.

## Scope and safety

```text
UI FILES CHANGED: 2
MIGRATIONS: 0
CLOUD SUPABASE WRITES: 0
LOCAL QA FIXTURES: CLEANED TO ZERO
MACDENT WRITES: 0
AMOCRM WRITES: 0
FINANCE COUPLING: 0
WAREHOUSE COUPLING: 0
TREATMENT/COMPLETED-SERVICE COUPLING: 0
RAW UUID DISPLAY: 0
LAB MUTATION CONTROLS: 0
```

## Issues / limitations

- Local backend doctor labels remain intentionally unavailable until local doctor storage has a verified tenant-scoped contract.
- Existing unrelated React `act(...)` warnings remain baseline warnings.
- `npm ci` still reports 7 pre-existing dependency vulnerabilities (1 moderate, 6 high); no package/lockfile change is part of 001I.

## Final verdict

```text
IMPLEMENTATION: PASS
REFERENCE LABEL SURFACE: PASS
ADMIN BROWSER QA: PASS
DOCTOR BROWSER QA: PASS
RAW UUID DISPLAY: BLOCKED
PRIMARY ORDER VISIBILITY DURING REFERENCE ERROR: PRESERVED
MUTATION SURFACE: 0
```

## Recommended next task

**LAB-WORK-NEXT-RECON-001J — run a fresh report-only HERMES STUDY/RECON against the now-complete patient laboratory read surface and current laboratory backlog to choose the next smallest product step, explicitly comparing a clinic-wide laboratory operations queue versus a separately governed laboratory mutation/action contract. Do not auto-add mutations, finance, warehouse, treatment/completed-service coupling, MacDent writes or amoCRM writes during RECON.**