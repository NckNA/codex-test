# DENTAL-PHOTO-STORAGE-INTEGRATION-001: storage integration report

## Summary

This PR adds the first production-oriented patient photo/file storage slice using the existing private `patient-files` Supabase Storage bucket and a new tenant-scoped metadata table.

## Branch

`feature/dental-photo-storage-integration-001`

## PR URL

[Pending PR creation]

## PR head reviewed before final report update

[Pending PR creation]

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

The `patient-files` bucket already existed, but the app only had local PNG snapshot download via canvas. There was no production-safe Supabase upload flow, no metadata table, no tenant-scoped file records, and no signed private preview flow.

## Recon findings

- `0009_backfill_dental_photo_storage.sql` defines the private `patient-files` bucket with image-only MIME policy and tenant-scoped Storage object policies by first folder segment.
- `DentalChartTab` had canvas export via `toDataURL('image/png')`; this remains a local browser download only.
- `PatientCardPage` already had a `files` tab placeholder, so the integration point is the patient card Files tab.
- `patients.id` is UUID in the database and string in TypeScript. Metadata uses UUID `patient_id` with a composite `(tenant_id, patient_id)` FK to `patients`.

## Migration

- Filename: `supabase/migrations/0011_patient_file_metadata.sql`
- Table: `public.patient_files`
- Metadata includes tenant, patient, storage bucket/path, original filename, MIME type, size, file kind, source context, optional tooth/finding/plan/stage/appointment ids, uploader, caption/notes, archive state, timestamps.
- Constraints enforce `patient-files`, image MIME, non-negative size, supported file kinds and source contexts.
- RLS enabled.
- Runtime SELECT allowed for tenant members.
- INSERT/UPDATE archive allowed for `clinic_owner`, `clinic_admin`, `doctor`.
- No runtime DELETE policy is created; archive is metadata update.
- FK added to `tenants` and composite `(tenant_id, patient_id)` to `patients`.
- Other clinical context ids are metadata links only in this first slice because not every target table exposes a safe tenant-scoped composite unique key.

## Storage path strategy

- Bucket: `patient-files`
- Supabase path format: `${tenantId}/patients/${patientId}/dental-photos/${generatedId}-${safeFilename}`
- The first path segment is the tenant id to match existing Storage policies.
- Private previews use short-lived signed URLs.
- No public bucket access is introduced.

## Repository / hook

- Added `PatientFilesRepository.ts` with Supabase and local/dev implementations.
- Supabase mode requires active tenant id and throws: `Active clinic is required for Supabase file access.`
- Upload validates image-only, non-empty, <= 10MB.
- Upload writes Storage object first, then metadata.
- If metadata insert fails after upload, repository attempts Storage cleanup.
- Listing loads metadata and creates signed preview URLs.
- Archive updates metadata state instead of hard-deleting.
- Hook `usePatientFiles` loads, uploads, archives and refreshes.
- Supabase no-tenant boundary returns empty files and blocks writes.

## UI

- Added `DentalPhotosPanel.tsx`.
- Integrated into `PatientCardPage` under the existing `files` tab.
- Admin/owner/doctor can upload and archive.
- Registrar/cashier are read-only.
- No-tenant shows a safe active clinic message and no upload control.
- Empty state: `Файлы ещё не загружены.`
- Archive wording says archive, not delete.

## Tests

- Repository tests cover tenant-scoped bucket path, metadata insert, validation, cleanup on metadata failure, signed URL listing, archive update, local/dev path.
- Hook tests cover load, upload refresh, archive refresh, no-tenant boundary.
- UI tests cover empty state, upload visibility, read-only roles, file rendering, archive wording.

## Local Supabase validation

Not completed in this environment.

Missing:
- `npx supabase status`
- `npx supabase db reset`
- SQL validation for `patient_files`, RLS, policies, bucket and seed rows.
- Local upload/list/archive smoke.

Blocker: executable local shell / Terminal Bridge is not available in the current runtime.

## Browser smoke

Not completed in this environment.

Missing:
- admin/doctor upload smoke;
- reload persistence;
- archive smoke;
- registrar/cashier read-only smoke;
- no-tenant smoke.

Blocker: Chrome DevTools MCP is not available in the current runtime.

## Cloud safety

- No cloud apply.
- No cloud reset.
- No cloud data touched.
- No real patient files uploaded.
- Migration `0011` must be applied to dev/test cloud in a separate task after merge.

## What was intentionally NOT changed

- No full document module.
- No DICOM/OCR/annotation/image editor.
- No image compression.
- No treatment/financial modules.
- No dictionary/findings/role-label code.
- No existing migrations changed.
- No seed changes.

## Checks

- `git status --short`: not run locally.
- `npm run lint`: pending GitHub Actions.
- `npm run test -- --run`: pending GitHub Actions.
- `npm run build`: pending GitHub Actions.
- GitHub Actions CI result: pending PR creation.

## Remaining known issues

- patient timeline;
- encounter/visit model;
- tenant creation/onboarding;
- tenant switcher UI;
- full documents module;
- payments/debts;
- stock/inventory;
- billing/subscriptions;
- audit/activity log;
- reports.

## Final verdict

**PARTIAL**

Reason: implementation is present, but local Supabase validation, browser smoke, and CI are not completed yet.

## Recommended next task

`SUPABASE-CLOUD-APPLY-0011-PATIENT-FILE-METADATA`
