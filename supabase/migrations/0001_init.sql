-- Strong Journal — initial schema
-- Domain documents (mesocycle, progressions, session entries) are stored as
-- jsonb: they are read and written as aggregates by the app, never queried
-- row-by-row inside the database.

-- ---------------------------------------------------------------------------
-- Profiles

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  name text not null default 'Athlete',
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Helper used by content-table policies. security definer so it can read
-- profiles regardless of the caller's own RLS visibility.
create function public.is_admin()
returns boolean
language sql
security definer set search_path = ''
stable
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

create policy "read own profile" on public.profiles
  for select using (id = auth.uid());
create policy "update own profile" on public.profiles
  for update using (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Admin-managed content
-- "Skills" are simply exercises with attribute = 'skill'; there is no
-- separate skills entity. Each progression inside the progressions jsonb
-- carries its own description.

create table public.exercises (
  id text primary key,
  title text not null,
  category text not null check (category in ('push', 'pull', 'both', 'legs')),
  attribute text not null check (attribute in
    ('warmup', 'skill', 'strength', 'cardio', 'prehabilitation', 'isolation', 'flexibility', 'cooldown')),
  progressions jsonb not null default '[]'
);

-- No two exercises may share a title (case-insensitive).
create unique index exercises_title_unique on public.exercises (lower(title));

create table public.default_template (
  id text primary key default 'default',
  entries jsonb not null default '[]'
);

create table public.techniques (
  id text primary key,
  name text not null,
  description text not null default ''
);

alter table public.exercises enable row level security;
alter table public.default_template enable row level security;
alter table public.techniques enable row level security;

create policy "content readable" on public.exercises
  for select to authenticated using (true);
create policy "content admin write" on public.exercises
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "content readable" on public.default_template
  for select to authenticated using (true);
create policy "content admin write" on public.default_template
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "content readable" on public.techniques
  for select to authenticated using (true);
create policy "content admin write" on public.techniques
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- User content

create table public.programs (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  type text not null check (type in ('full_body', 'split', 'sport_mix')),
  split_type text check (split_type in ('straight_arm_bent_arm', 'push_pull', 'upper_lower')),
  sport jsonb,
  periodization text not null check (periodization in ('none', 'daily_undulating', 'high_low')),
  weeks integer not null check (weeks between 6 and 8),
  training_days jsonb not null default '[]',
  mesocycle jsonb not null default '{"weeks": []}',
  status text not null check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table public.runs (
  id text primary key,
  program_id text not null references public.programs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  start_date date not null,
  status text not null check (status in ('active', 'completed', 'abandoned')),
  created_at timestamptz not null
);

create table public.sessions (
  id text primary key,
  run_id text not null references public.runs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  week_index integer not null,
  weekday text not null check (weekday in ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')),
  status text not null check (status in ('planned', 'completed', 'skipped')),
  entries jsonb not null default '[]'
);

create index programs_user_idx on public.programs (user_id);
create index runs_user_idx on public.runs (user_id);
create index sessions_run_idx on public.sessions (run_id);
create index sessions_user_date_idx on public.sessions (user_id, date);

alter table public.programs enable row level security;
alter table public.runs enable row level security;
alter table public.sessions enable row level security;

create policy "own programs" on public.programs
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own runs" on public.runs
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own sessions" on public.sessions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
