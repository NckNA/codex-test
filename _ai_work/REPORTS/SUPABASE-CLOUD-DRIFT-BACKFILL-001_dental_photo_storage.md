# SUPABASE-CLOUD-DRIFT-BACKFILL-001: dental photo storage drift backfill

## 1. Summary

The dev/test Supabase cloud project contained an orphan migration named `add_dental_photo_storage` that was present in cloud migration history but absent from Git migrations.

This task inspected the drift, reconstructed the existing cloud storage setup, added an idempotent Git migration, and applied that migration to the dev/test cloud project so future environments can reproduce the storage setup from Git.

Final verdict: **PARTIAL**.

Reason: Git/cloud drift was backfilled and cloud validation passed, but local Supabase validation (`npx supabase status`, `npx supabase db reset`, local bucket/policy checks) was not completed in this run.

## 2. Branch name

`fix/supabase-cloud-drift-backfill-001`

## 3. PR URL

https://github.com/NckNA/codex-test/pull/285

## 4. PR head reviewed before final report update

PR head reviewed before this report update: `4833bc5f43d5a5a15ef3c7f97f580e9fc04a20a8`.

## 5. Report update commit

N/A because the final report update commit cannot reference itself before creation.

## 6. Changed files summary

Expected PR file changes:

- `supabase/migrations/0009_backfill_dental_photo_storage.sql`
- `_ai_work/REPORTS/SUPABASE-CLOUD-DRIFT-BACKFILL-001_dental_photo_storage.md`

No source code changes.
No existing migration edits.
No seed changes.

## 7. Root cause

Cloud migration history included an orphan migration:

- version: `20260612152210`
- name: `add_dental_photo_storage`

That migration created or aligned dental/patient photo storage state in dev/test cloud, but the equivalent setup was not present in Git migrations.

This meant Git was not a complete source of truth for storage setup.

## 8. Git audit

### Migration state

- Current `main` contains migrations through `0008_harden_rls_helper_function_grants.sql`.
- `supabase/migrations/0009_backfill_dental_photo_storage.sql` was absent before this task.
- Git search found no existing `storage.buckets`, `storage.objects`, or `patient-files` migration in current migration files.
- The only `patient-files` reference found before this task was in an older cloud drift report, not in active migrations.

### App/source storage state

Inspected files/searches:

- `src/components/dental/DentalChartTab.tsx`
- `src/lib/supabaseClient.ts`
- `src/utils/storage.ts`
- repo searches for `storage`, `patient-files`, `toDataURL`, `base64`, `canvas`, dental/tooth photo terms.

Findings:

- `DentalChartTab.tsx` currently exports dental chart snapshots as local PNG downloads via browser `canvas.toDataURL('image/png')`.
- It does not upload dental chart snapshots to Supabase Storage.
- `supabaseClient.ts` only creates the standard Supabase frontend client from public env values and explicitly warns not to use service role keys in frontend.
- `src/utils/storage.ts` is localStorage/demo-data storage, not Supabase Storage.
- No bucket name is referenced by current app code.
- No active Git migration existed for the dental photo storage bucket/policies before this task.

Conclusion: this task is storage source-of-truth cleanup, not a product feature or UI upload implementation.

## 9. Cloud preflight

### Project identity

- project name: `codex-test-cloud`
- project id/ref: `cwkgxgubvdkkjcslvdgn`
- status: `ACTIVE_HEALTHY`
- environment classification: dev/test cloud.

### Migration history before apply

Cloud migration history before applying `0009` contained:

- `0001_initial_schema`
- `0002_add_dental_chart_editor_fields_to_tooth_states`
- `0003_add_dental_chart_links_to_findings`
- `20260612152210_add_dental_photo_storage` orphan cloud migration
- `20260614225430_0004_align_findings_status_lifecycle`
- `20260614225512_0005_create_clinical_dictionary_items`
- `20260615104342_0006_treatment_plan_stage_sync_rpc`
- `20260615111827_0007_revoke_anon_execute_from_treatment_plan_rpc`
- `20260615132148_0008_harden_rls_helper_function_grants`

`0009_backfill_dental_photo_storage` was absent before apply.

### Storage bucket found

Cloud bucket:

- id: `patient-files`
- name: `patient-files`
- public: `false`
- file size limit: `10485760` bytes
- allowed mime types: `image/*`
- created_at: `2026-06-12 15:22:10.189002+00`
- updated_at: `2026-06-12 15:22:10.189002+00`

Public exposure: private bucket, not public.

### Storage policies found

Policies on `storage.objects` for the bucket:

1. `Tenant members can read patient files`
   - command: `SELECT`
   - roles: `{authenticated}`
   - condition: bucket is `patient-files` and the first storage path folder is one of the current user's tenant ids from `public.tenant_users` / `auth.uid()`.

2. `Tenant members can upload patient files`
   - command: `INSERT`
   - roles: `{authenticated}`
   - with check: bucket is `patient-files` and the first storage path folder is one of the current user's tenant ids from `public.tenant_users` / `auth.uid()`.

3. `Tenant members can delete patient files`
   - command: `DELETE`
   - roles: `{authenticated}`
   - condition: bucket is `patient-files` and the first storage path folder is one of the current user's tenant ids from `public.tenant_users` / `auth.uid()`.

No storage bucket policies on `storage.buckets` were found or required for this backfill.

### Storage object count

- `patient-files` object count before apply: `0`

No object names, paths, patient names, or medical details were printed.

## 10. Backfill decision

Decision: create and apply an idempotent Git migration.

Reasoning:

- Cloud state was clear and small.
- Bucket is private.
- Policies are tenant-scoped and authenticated-only.
- Object count was `0`, so there were no patient files or paths to inspect, print, move, delete, or migrate.
- Migration can reproduce the bucket and policies for local/future environments without app code changes.
- Applying the idempotent migration to cloud only records the Git backfill in migration history and recreates equivalent policies.

## 11. Migration added

File:

- `supabase/migrations/0009_backfill_dental_photo_storage.sql`

Migration behavior:

- Upserts bucket `patient-files` as private.
- Sets `file_size_limit = 10485760`.
- Sets `allowed_mime_types = array['image/*']`.
- Recreates three storage object policies:
  - `Tenant members can read patient files`
  - `Tenant members can upload patient files`
  - `Tenant members can delete patient files`

Idempotency notes:

- Bucket is inserted with `on conflict (id) do update` and only updates if bucket metadata differs.
- Policies are recreated with `drop policy if exists` followed by `create policy`, using stable policy names matching cloud state.
- No storage objects are inserted, updated, deleted, or moved.
- No patient ids or tenant ids are hardcoded.
- Policy path scoping remains tenant-folder based via `(storage.foldername(name))[1]` and `public.tenant_users` membership for `auth.uid()`.

## 12. Local validation

Local validation was not completed in this run.

Not completed:

- `npx supabase status`
- `npx supabase db reset`
- local migration history check for `0009`
- local bucket existence check
- local storage policy existence check
- local storage object count check

Result: local reproduction is not verified in this report yet.

## 13. Cloud apply

Applied to dev/test cloud: yes.

Migration:

- name: `0009_backfill_dental_photo_storage`
- method: Supabase migration apply workflow via `apply_migration`

Safety confirmations:

- no cloud reset
- no seed applied
- no file uploads
- no file/object deletion
- no patient data printed
- no app code changes
- no existing migration edits

### Cloud post-apply validation

Cloud migration history after apply contains:

- `20260615141156_0009_backfill_dental_photo_storage`

Bucket after apply:

- id: `patient-files`
- name: `patient-files`
- public: `false`
- file size limit: `10485760`
- allowed mime types: `image/*`
- created_at unchanged from preflight: `2026-06-12 15:22:10.189002+00`
- updated_at unchanged from preflight: `2026-06-12 15:22:10.189002+00`

Policies after apply:

- `Tenant members can delete patient files` / `DELETE` / `{authenticated}`
- `Tenant members can read patient files` / `SELECT` / `{authenticated}`
- `Tenant members can upload patient files` / `INSERT` / `{authenticated}`

Object counts:

- before apply: `0`
- after apply: `0`

## 14. Advisor result

Supabase security advisors after apply:

- no new storage-specific warning observed from this migration.
- existing `rls_enabled_no_policy` INFO remains for `public.integration_tokens`, out of scope.
- existing `authenticated_security_definer_function_executable` WARN remains for `public.get_user_tenants()`, out of scope and previously documented as intentional RLS helper exposure after hardening.
- existing `authenticated_security_definer_function_executable` WARN remains for `public.has_tenant_role(target_tenant_id uuid, allowed_roles public.app_role[])`, out of scope and previously documented as intentional RLS helper exposure after hardening.

No new warning was attributed to migration `0009`.

## 15. What was intentionally NOT changed

- no app code changes
- no DentalChartTab behavior changes
- no image upload implementation
- no existing migration edits
- no seed data
- no cloud reset
- no storage object upload
- no storage object deletion
- no bucket deletion
- no patient file migration
- no patient data printed
- no storage object paths printed

## 16. Remaining known issues

- `SUPABASE-CLOUD-DICTIONARY-SEED-RECON-001` / cloud dictionary seed/population decision.
- `FINDINGS-ARCHIVE-UI-CLEANUP-001`.
- `ROLE-LABEL-UX-001` if still applicable.
- Future dental photo upload/storage integration is not implemented in app UI.
- `integration_tokens` advisor INFO remains out of scope.

## 17. Checks

- `git status --short`: not run locally in this report run.
- `npm run lint`: not run locally in this report run.
- `npm run test -- --run`: not run locally in this report run.
- `npm run build`: not run locally in this report run.
- GitHub Actions CI result: pending for PR head after report metadata update.

## 18. Final verdict

**PARTIAL**

Cloud storage drift was inspected and backfilled into Git and dev/test cloud successfully.

Missing validation:

- local Supabase reset and local bucket/policy reproduction checks were not completed;
- GitHub Actions CI was pending at the time of this report update.

## 19. Recommended next task

`SUPABASE-CLOUD-DICTIONARY-SEED-RECON-001`
