-- Migration: Backfill dental photo storage cloud drift into Git
-- Filename: 0009_backfill_dental_photo_storage.sql
-- Scope: idempotent source-of-truth backfill for the existing dev/test patient-files storage bucket and tenant-member object policies.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('patient-files', 'patient-files', false, 10485760, array['image/*'])
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types
where
  storage.buckets.name is distinct from excluded.name
  or storage.buckets.public is distinct from excluded.public
  or storage.buckets.file_size_limit is distinct from excluded.file_size_limit
  or storage.buckets.allowed_mime_types is distinct from excluded.allowed_mime_types;

drop policy if exists "Tenant members can read patient files" on storage.objects;
create policy "Tenant members can read patient files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'patient-files'
  and (storage.foldername(name))[1] in (
    select tenant_users.tenant_id::text
    from public.tenant_users
    where tenant_users.user_id = auth.uid()
  )
);

drop policy if exists "Tenant members can upload patient files" on storage.objects;
create policy "Tenant members can upload patient files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'patient-files'
  and (storage.foldername(name))[1] in (
    select tenant_users.tenant_id::text
    from public.tenant_users
    where tenant_users.user_id = auth.uid()
  )
);

drop policy if exists "Tenant members can delete patient files" on storage.objects;
create policy "Tenant members can delete patient files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'patient-files'
  and (storage.foldername(name))[1] in (
    select tenant_users.tenant_id::text
    from public.tenant_users
    where tenant_users.user_id = auth.uid()
  )
);
