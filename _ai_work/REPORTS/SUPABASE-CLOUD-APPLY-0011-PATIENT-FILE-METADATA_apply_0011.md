# SUPABASE-CLOUD-APPLY-0011-PATIENT-FILE-METADATA

## Summary
Applied Git migration `0011_patient_file_metadata` to dev/test Supabase cloud and validated schema, RLS, storage policy hardening, and zero data insertion.

## Branch
Requested: `ops/cloud-apply-0011-patient-file-metadata`.
Actual: `cloud-apply-0011`.

The requested branch name was blocked by the available GitHub write tool, so a shorter isolated branch was used.

## PR URL
https://github.com/NckNA/codex-test/pull/294

## PR head reviewed before final report update
`cc7ed56084857283cd21736cd5040c8f04e10515`

## Report update commit
N/A because the final report update commit cannot reference itself before creation.

## Changed files summary
One report file only:
- `_ai_work/REPORTS/SUPABASE-CLOUD-APPLY-0011-PATIENT-FILE-METADATA_apply_0011.md`

## Cloud project identity
- name: `codex-test-cloud`
- id/ref: `cwkgxgubvdkkjcslvdgn`
- status: `ACTIVE_HEALTHY`
- region: `ap-northeast-2`
- DB version: `17.6.1.127`

## Preflight
- migrations through `0010` existed;
- `0011_patient_file_metadata` was absent;
- `public.patient_files` was absent;
- bucket `patient-files` existed and was private;
- bucket limit: `10485760` bytes;
- allowed mime types: `image/*`;
- storage policies before apply were the broader tenant-member read/upload/delete policies from `0009`;
- tenants: `0`;
- tenant_users: `0`;
- patients: `0`;
- storage objects in bucket: `0`.

## Migration applied
- file: `supabase/migrations/0011_patient_file_metadata.sql`
- migration name: `0011_patient_file_metadata`
- apply method: Supabase `apply_migration`
- source: exact Git migration from `main`
- result: success

No seed, reset, tenant/user creation, file upload, or manual metadata insert was performed.

## Post-apply validation
- migration present as version `20260616130814`;
- `public.patient_files` exists;
- expected columns exist;
- primary key exists;
- tenant FK exists;
- composite patient FK exists;
- user archive/upload FKs exist;
- expected check constraints and tenant-scoped unique storage path constraint exist;
- RLS enabled;
- policies: SELECT tenant members, INSERT clinical staff, UPDATE clinical staff;
- no runtime DELETE policy on metadata;
- metadata rows: `0`;
- null tenant id rows: `0`.

## Storage policy hardening
- bucket still exists and remains private;
- bucket limit and mime rules unchanged;
- storage policies after apply:
  - tenant members can read;
  - clinical staff can upload;
  - clinical staff can delete;
- upload/delete policies are role-limited to clinic owner, clinic admin, or doctor;
- registrar/cashier are not included in upload/delete role checks;
- storage objects after apply: `0`.

## Advisor result
No new warning specific to `patient_files` and no new `0011` SECURITY DEFINER warning.

Existing out-of-scope notices remain for `integration_tokens`, `get_user_tenants()`, and `has_tenant_role(...)`.

## Cloud safety
No app data was created or printed. No files were uploaded. Cloud seed and cloud reset were not run.

## Checks
- Local shell checks: not run in this runtime.
- GitHub Actions CI: run `27621815238` / CI `#456` / success on head `cc7ed56084857283cd21736cd5040c8f04e10515`.

## Final verdict
`CLOUD 0011 APPLIED AND VERIFIED`

## Recommended next task
`PATIENT-TIMELINE-RECON-001`
