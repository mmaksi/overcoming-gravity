-- Batch: body stats for BMI + avatar uploads via Supabase Storage.

-- 1. Height and ideal target weight on the profile (both optional).
alter table public.profiles
  add column height_cm double precision
    check (height_cm > 0 and height_cm <= 300),
  add column target_weight_kg double precision
    check (target_weight_kg > 0 and target_weight_kg <= 1000);

-- 2. Public "avatars" bucket. Files live under "<user-id>/..." so ownership
--    is enforceable from the object path.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Anyone may read (the bucket is public anyway); users write only their own
-- folder.
create policy "avatars are readable" on storage.objects
  for select using (bucket_id = 'avatars');
create policy "upload own avatar" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "update own avatar" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "delete own avatar" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
