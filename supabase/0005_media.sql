-- Photos & message media.
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.
--
-- Adds: a profile picture for the user, a photo for each birthday/contact,
-- and an optional image attached to a birthday's WhatsApp message. Images are
-- stored in a public Storage bucket ("media") so the backend/WAHA can fetch
-- them by URL when sending. Write access is restricted to each user's own
-- folder; read is public (URLs use unguessable ids).

alter table public.profiles add column if not exists avatar_url text;
alter table public.birthdays add column if not exists photo_url text;
alter table public.birthdays add column if not exists media_url text;

-- Public storage bucket for all app images.
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- Anyone can read (images are served by public URL, incl. to WhatsApp/WAHA).
drop policy if exists "media public read" on storage.objects;
create policy "media public read" on storage.objects
  for select using (bucket_id = 'media');

-- A user may only write inside their own top-level folder: media/<user_id>/...
drop policy if exists "media user insert" on storage.objects;
create policy "media user insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "media user update" on storage.objects;
create policy "media user update" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "media user delete" on storage.objects;
create policy "media user delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
