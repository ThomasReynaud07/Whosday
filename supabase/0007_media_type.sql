-- GIF support: a birthday's message media can be a photo or a GIF.
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.
--
-- media_url        : the file the backend sends (JPEG for photos, MP4 for GIFs)
-- media_type       : 'image' (default) or 'gif'
-- media_preview_url: for GIFs, an animated .gif URL to show in the app
--                    (media_url holds the MP4, which RN can't preview)

alter table public.birthdays add column if not exists media_type text;
alter table public.birthdays add column if not exists media_preview_url text;
