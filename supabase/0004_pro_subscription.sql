-- Pro subscription bookkeeping.
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.
--
-- profiles.is_pro already exists (0001) and the free-plan trigger already
-- gates birthdays on it. These columns just record *why*/*until when* someone
-- is Pro, written by the RevenueCat webhook (service_role) on the backend.
-- is_pro stays the single source of truth the app reads.

alter table public.profiles
  add column if not exists pro_expires_at timestamptz;

alter table public.profiles
  add column if not exists pro_product text;

alter table public.profiles
  add column if not exists pro_updated_at timestamptz;

-- The webhook writes with the service_role key (bypasses RLS). The app only
-- ever reads its own profile (existing "select own profile" policy), so no
-- new grants are needed - is_pro / pro_expires_at are readable by the owner.
