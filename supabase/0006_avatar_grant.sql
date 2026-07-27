-- Allow users to save their own profile picture.
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.
--
-- 0002 revoked column updates on profiles and only granted `push_token` (to
-- keep is_pro server-only). Saving an avatar needs the avatar_url column too.
-- is_pro stays protected.

grant update (push_token, avatar_url) on public.profiles to authenticated;
