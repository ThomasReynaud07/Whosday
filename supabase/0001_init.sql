-- WhosDay - initial multi-user schema
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.

-- One row per signed-up user. Extends auth.users with app-specific fields.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  is_pro boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.birthdays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone_number text not null,
  month int not null check (month between 1 and 12),
  day int not null check (day between 1 and 31),
  message text not null,
  created_at timestamptz not null default now()
);

create table public.messages_sent (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  birthday_id uuid references public.birthdays(id) on delete set null,
  name text not null,
  phone_number text not null,
  message text not null,
  status text not null,
  error text,
  sent_at timestamptz not null default now()
);

-- One row per user: when their daily birthday check should fire.
-- Mirrors the single-user "settings" table from the local-only prototype.
create table public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  send_mode text not null default 'fixed' check (send_mode in ('fixed', 'random')),
  fixed_time text not null default '09:00',
  random_window_start text not null default '09:00',
  random_window_end text not null default '20:00',
  today_date text,
  today_target_time text,
  last_sent_date text
);

-- New signup -> auto-create their profile + default settings row.
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.settings (user_id) values (new.id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Free plan: 5 birthdays max unless profiles.is_pro is true.
-- Enforced in the database so it can't be bypassed from the client.
create function public.enforce_birthday_limit()
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
    raise exception 'Free plan limit reached (5 birthdays). Upgrade to add more.';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger check_birthday_limit
  before insert on public.birthdays
  for each row execute procedure public.enforce_birthday_limit();

-- Row Level Security: every user can only ever see/touch their own rows.
alter table public.profiles enable row level security;
alter table public.birthdays enable row level security;
alter table public.messages_sent enable row level security;
alter table public.settings enable row level security;

create policy "select own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "select own birthdays" on public.birthdays
  for select using (auth.uid() = user_id);
create policy "insert own birthdays" on public.birthdays
  for insert with check (auth.uid() = user_id);
create policy "update own birthdays" on public.birthdays
  for update using (auth.uid() = user_id);
create policy "delete own birthdays" on public.birthdays
  for delete using (auth.uid() = user_id);

create policy "select own messages" on public.messages_sent
  for select using (auth.uid() = user_id);
-- No insert/update policy for messages_sent: only the backend (service_role,
-- which bypasses RLS) is allowed to write send history.

create policy "select own settings" on public.settings
  for select using (auth.uid() = user_id);
create policy "update own settings" on public.settings
  for update using (auth.uid() = user_id);
