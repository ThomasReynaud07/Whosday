-- Per-birthday send time + optional birth year.
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.
--
-- The send time used to be a single global per-user setting (settings.fixed_time
-- / random window). It now lives on each birthday, so every person can be
-- messaged at their own time. The old settings columns are simply left unused.

-- The time of day (HH:MM, 24h) this birthday's message should be sent.
alter table public.birthdays
  add column send_time text not null default '09:00';

-- Optional year of birth. Only used to show the age they're turning -
-- birthdays still repeat every year regardless of this.
alter table public.birthdays
  add column birth_year int check (birth_year is null or birth_year between 1900 and 2100);

-- Guards against the daily scheduler sending the same birthday twice in one
-- day (the cron ticks every few minutes). Stores the YYYY-MM-DD it last fired.
alter table public.birthdays
  add column last_sent_date text;
