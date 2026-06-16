# DENTAL-PHOTO-STORAGE-INTEGRATION-001: storage integration report

## Summary

This PR adds a tenant-scoped patient file metadata table and a first dental photo upload/list/archive UI slice using the existing private `patient-files` bucket.

## Branch

`feature/dental-photo-storage-integration-001`

## PR URL

https://github.com/NckNA/codex-test/pull/293

## PR head reviewed before final report update

`ad2f0856a6266c32ba34328c894b662ebf6c2af7`

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

## Root cause / need

The storage bucket existed, but the app did not have a production-style upload flow with database metadata, tenant isolation, signed previews, or archive-by-default file lifecycle.

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
- tenant members can read;
- `clinic_owner`, `clinic_admin`, and `doctor` can insert/archive metadata;
- no runtime hard-delete policy.

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

## Local validation

Not completed in this environment.

Missing:
- local Supabase status/reset;
- SQL validation for `patient_files`, RLS, policies, bucket, and seed rows;
- local upload/list/archive smoke.

Blocker: this runtime does not provide executable local shell access for the required local commands.

## Browser smoke

Not completed in this environment.

Missing:
- admin/doctor upload smoke;
- reload persistence;
- archive smoke;
- registrar/cashier read-only smoke;
- no-tenant smoke.

Blocker: this runtime does not provide browser automation access.

## Cloud safety

- No cloud apply.
- No cloud reset.
- No cloud data touched.
- No real patient files uploaded.
- Migration `0011` must be applied to dev/test cloud in a separate task after merge.

## What was intentionally NOT changed

- No full documents module.
- No DICOM/OCR/annotation/image editor.
- No image compression.
- No treatment/financial modules.
- No dictionary/findings/role-label code.
- No existing migrations changed.
- No seed changes.

## Checks

- `git status --short`: not run locally.
- `npm run lint`: PASS via GitHub Actions CI #446.
- `npm run test -- --run`: PASS via GitHub Actions CI #446.
- `npm run build`: PASS via GitHub Actions CI #446.
- GitHub Actions CI result: PASS, run id `27602263682`, tested commit `ad2f0856a6266c32ba34328c894b662ebf6c2af7`.

## Final verdict

**PARTIAL**

Reason: implementation is present and CI is green, but local validation and browser smoke are not completed.

## Recommended next task

`SUPABASE-CLOUD-APPLY-0011-PATIENT-FILE-METADATA`
