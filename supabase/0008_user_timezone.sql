-- Per-user timezone so birthday sends fire at the right local time no matter
-- where the user lives (the scheduler used a hardcoded Europe/Paris before).
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.
--
-- Default keeps the previous behaviour for existing rows. The app writes the
-- device's IANA timezone (e.g. "Europe/Zurich") on launch.

alter table public.profiles
  add column if not exists timezone text not null default 'Europe/Paris';

-- Let users save their own timezone (see 0002/0006: profiles column updates
-- are granted explicitly; is_pro stays server-only).
grant update (timezone) on public.profiles to authenticated;
