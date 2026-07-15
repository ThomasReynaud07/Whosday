-- Adds push notification support and makes the free-plan-limit error
-- reliably detectable from the app regardless of display language.
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.

alter table public.profiles add column push_token text;

-- Users may update their own row, but only the push_token column - never
-- is_pro (that must only ever be flipped by the backend/service_role, once
-- payments exist, or it'd be a free way to unlock the paid plan).
create policy "update own push token" on public.profiles
  for update using (auth.uid() = id);

revoke update on public.profiles from authenticated;
grant update (push_token) on public.profiles to authenticated;

create or replace function public.enforce_birthday_limit()
returns trigger as $$
declare
  user_is_pro boolean;
  current_count int;
begin
  select is_pro into user_is_pro from public.profiles where id = new.user_id;
  if user_is_pro then
    return new;
  end if;

  select count(*) into current_count from public.birthdays where user_id = new.user_id;
  if current_count >= 5 then
    -- Stable "FREE_LIMIT_REACHED:" prefix so the app can show a translated,
    -- friendly message instead of this raw Postgres error text.
    raise exception 'FREE_LIMIT_REACHED: free plan is capped at 5 birthdays';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;
