# DENTAL-PHOTO-STORAGE-INTEGRATION-001: storage integration report

## Summary

This PR adds a tenant-scoped patient file metadata table and a first dental photo upload/list/archive UI slice using the existing private `patient-files` bucket.

Latest takeover update hardens raw `storage.objects` write/delete access so registrar/cashier users remain read-only at both UI and storage policy levels.

## Branch

`feature/dental-photo-storage-integration-001`

## PR URL

https://github.com/NckNA/codex-test/pull/293

## PR head reviewed before final report update

`2b2774825d63438260bf36022a1de725a58b7ae3`

## Report update commit

N/A because the final report update commit cannot reference itself before creation.

## Changed files summary

- `supabase/migrations/0011_patient_file_metadata.sql`
- `src/data/repositories/PatientFilesRepository.ts`
- `src/data/repositories/PatientFilesRepository.test.ts`
- `src/data/hooks/usePatientFiles.ts`
- `src/data/hooks/usePatientFiles.test.ts`
- `src/components/dental/DentalPhotosPanel.tsx`
- `src/components/dental/DentalPhotosPanel.test.tsx`
- `src/pages/PatientCardPage.tsx`
- `_ai_work/REPORTS/DENTAL-PHOTO-STORAGE-INTEGRATION-001_storage_integration.md`

Takeover fix changed only:

- `supabase/migrations/0011_patient_file_metadata.sql`
- `_ai_work/REPORTS/DENTAL-PHOTO-STORAGE-INTEGRATION-001_storage_integration.md`

## Root cause / need

The storage bucket existed, but the app did not have a production-style upload flow with database metadata, tenant isolation, signed previews, or archive-by-default file lifecycle.

Request-changes blocker found after initial PR:

- migration `0009` allowed any tenant member to `INSERT` and `DELETE` raw `patient-files` storage objects;
- UI intended registrar/cashier to be read-only, but storage policies did not enforce that boundary.

## Recon findings

- Existing chart snapshot export uses browser canvas download only.
- The existing `files` patient-card tab was the least invasive integration point.
- The existing private bucket is `patient-files`, and storage paths are tenant-scoped by first folder segment.
- Patient ids are UUID in the database and string in the TypeScript domain model.

## Migration

Migration `0011_patient_file_metadata.sql` creates `public.patient_files`.

Key points:

- tenant-scoped metadata;
- composite patient FK on `(tenant_id, patient_id)`;
- image MIME and size constraints;
- supported file kind/source context constraints;
- RLS enabled;
- tenant members can read metadata;
- `clinic_owner`, `clinic_admin`, and `doctor` can insert/archive metadata;
- no runtime metadata hard-delete path.

Takeover storage policy hardening:

- keeps `Tenant members can read patient files` for storage `SELECT`;
- drops the old tenant-member upload/delete policies from migration `0009`;
- creates `Clinical staff can upload patient files` for storage `INSERT`;
- creates `Clinical staff can delete patient files` for storage `DELETE`;
- allowed raw storage write/delete roles: `clinic_owner`, `clinic_admin`, `doctor`;
- blocked raw storage write/delete roles: `registrar`, `cashier`, no-tenant users;
- policy expression uses `tenant_users.user_id = auth.uid()` and `tenant_users.tenant_id::text = (storage.foldername(name))[1]`, avoiding casts from untrusted path text to UUID.

Optional clinical context ids are stored as metadata links in this first slice. Some target tables do not yet expose safe tenant-scoped composite unique keys for FK enforcement.

## Storage path strategy

- Bucket: `patient-files`
- Path format: `${tenantId}/patients/${patientId}/dental-photos/${generatedId}-${safeFilename}`
- Private previews use signed URLs.
- No public bucket access is introduced.

## Repository / hook

- `PatientFilesRepository.ts` adds Supabase and local/dev implementations.
- Supabase mode requires active tenant id.
- Upload validates image-only, non-empty, and <= 10MB.
- Upload writes storage first, then metadata.
- Metadata insert failure attempts uploaded-object cleanup.
- Listing loads metadata and creates signed preview URLs.
- Archive updates metadata instead of deleting.
- `usePatientFiles.ts` loads, uploads, archives, refreshes, and blocks no-tenant writes.

## UI

- `DentalPhotosPanel.tsx` is integrated in the patient card `files` tab.
- Admin/owner/doctor can upload and archive.
- Registrar/cashier are read-only.
- No-tenant users see a safe clinic-selection message and no upload control.
- Empty state and archive wording are explicit.

## Tests

- Repository tests cover storage bucket/path, metadata insert, validation, cleanup on metadata failure, signed URL listing, archive update, and local/dev path.
- Hook tests cover load, upload refresh, archive refresh, and no-tenant boundary.
- UI tests cover empty state, upload visibility, read-only roles, file rendering, and archive wording.

No production test was weakened or deleted during takeover.

## Local Supabase validation

Completed locally on `feature/dental-photo-storage-integration-001`.

Commands:

- `npx supabase status`: running.
- `npx supabase db reset`: PASS, migrations `0001` through `0011` applied.

Schema and bucket:

- migration `0011_patient_file_metadata`: present locally.
- `public.patient_files`: exists.
- `public.patient_files` RLS: enabled.
- metadata policies: read/select for tenant members; insert/update archive for `clinic_owner`, `clinic_admin`, `doctor`.
- bucket `patient-files`: exists.
- bucket public: `false`.
- bucket file size limit: `10485760`.
- bucket allowed MIME types: `image/*`.
- `patient_files` seed rows immediately after reset: `0`.
- `patient_files` null `tenant_id` rows: `0`.

Storage policies:

- `Tenant members can read patient files`: `SELECT`, role `authenticated`, tenant-scoped to first path folder.
- `Clinical staff can upload patient files`: `INSERT`, role `authenticated`, tenant-scoped and role-scoped to `clinic_owner`, `clinic_admin`, `doctor`.
- `Clinical staff can delete patient files`: `DELETE`, role `authenticated`, tenant-scoped and role-scoped to `clinic_owner`, `clinic_admin`, `doctor`.
- Old tenant-member upload/delete policies are removed by migration `0011`.

Role validation:

- admin upload to tenant path: allowed.
- doctor upload to tenant path: allowed.
- registrar upload to tenant path: blocked.
- cashier upload to tenant path: blocked.
- no-tenant upload to tenant path: blocked.
- admin upload to another tenant path: blocked.
- admin storage remove: allowed.
- doctor storage remove: allowed.
- registrar storage remove: blocked with no removed rows.
- cashier storage remove: blocked with no removed rows.
- no-tenant storage remove: blocked with no removed rows.
- registrar list own tenant storage path: allowed.
- registrar list cross-tenant storage path: returns `0` rows.

Application data-flow validation:

- admin API flow: storage upload passed, metadata insert passed, active list showed `1`, archive update set `is_archived = true`, active list after archive showed `0`.
- doctor API flow: storage upload passed, metadata insert passed, active list showed `1`, archive update set `is_archived = true`, active list after archive showed `0`.
- final local validation state after API flow: `patient_files_total = 2`, `active_files = 0`, `null_tenant_rows = 0`.

Notes:

- Local QA auth users were created after `db reset` only in the local database to exercise RLS roles.
- No cloud project was touched.
- No migration was applied to cloud.
- Validation created local test storage objects only.

## Browser smoke

Partially completed with Codex In-app Browser at `http://127.0.0.1:5175`.

Completed browser checks:

- admin login: passed.
- seeded Supabase patient card opened with UUID patient id.
- admin `files` tab: upload control visible, empty active list rendered, console errors: none.
- doctor `files` tab: upload control visible, console errors: none.
- cashier `files` tab: upload control hidden, read-only message visible, role label `Кассир` visible, console errors: none.
- registrar `files` tab: upload control hidden, read-only message visible, role label `Регистратор` visible, console errors: none.
- no-tenant user: no-tenant gate shown, upload control absent, no fake admin role shown, console errors: none.

Missing browser checks:

- real UI file upload through file chooser;
- reload persistence after UI upload;
- archive via UI button after UI upload.

Exact blocker:

- Codex In-app Browser returned `File uploads are not supported by Codex In-app Browser` when attempting the `Загрузить фото` file chooser flow.
- No fake browser upload result is claimed.

## Cloud safety

- No cloud apply.
- No cloud reset.
- No cloud data touched.
- No production patient files uploaded.
- Migration `0011` was validated locally only.
- Do not start `SUPABASE-CLOUD-APPLY-0011-PATIENT-FILE-METADATA` until PR review accepts the remaining browser-smoke limitation or a manual browser run completes it.

## What was intentionally NOT changed

- No full documents module.
- No DICOM/OCR/annotation/image editor.
- No image compression.
- No treatment/financial modules.
- No dictionary/findings/role-label code.
- No seed changes.
- No cloud RLS changes.
- No hard-delete app behavior.

## Checks

- `git status --short`: takeover touched only `supabase/migrations/0011_patient_file_metadata.sql` and this report; pre-existing untracked workspace files remain untracked and were not staged.
- `npm run lint`: PASS.
- `npm run test -- --run`: FAIL in this local environment.
  - exact failure: `src/contexts/AuthContext.test.tsx` expected `authMode` to be `dev`, received `supabase-active`.
  - scope: unrelated to this storage-policy change; the local environment is Supabase-configured while this legacy test assumes dev fallback.
  - result summary: 39 test files passed, 1 failed; 315 tests passed, 1 failed.
- `npm run build`: PASS.
  - Vite emitted only the existing large chunk warning.
- GitHub Actions CI before takeover push: PASS at PR head `2b2774825d63438260bf36022a1de725a58b7ae3`.
- GitHub Actions CI after takeover push: pending; must be checked after this report commit is pushed.

## Final verdict

**PARTIAL**

Reason: the security blocker is fixed and local Supabase validation is complete, but real browser file-upload/reload/archive smoke remains blocked by Codex In-app Browser file upload support.

No known storage security issue remains in the validated local migration.

## Recommended next task

`DENTAL-PHOTO-STORAGE-INTEGRATION-001-MANUAL-FILE-UPLOAD-SMOKE`

Run the remaining browser-only checks in a browser tool or manual environment that supports selecting a local file: admin/doctor upload, reload persistence, archive through UI, and active-list hiding after archive. After that passes, the next separate task can decide whether to apply migration `0011` to dev/test cloud.
