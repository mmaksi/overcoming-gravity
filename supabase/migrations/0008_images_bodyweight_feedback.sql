-- Batch: exercise images, profile avatars, bodyweight tracking, and feedback.

-- 1. Optional illustration per exercise (admin-managed) and profile avatar.
alter table public.exercises add column image_url text;
alter table public.profiles add column avatar_url text;

-- 2. Bodyweight log: one weigh-in per user per day (latest wins via upsert).
create table public.bodyweight_entries (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  weight_kg double precision not null check (weight_kg > 0 and weight_kg <= 1000),
  created_at timestamptz not null,
  unique (user_id, date)
);

alter table public.bodyweight_entries enable row level security;

create policy "own bodyweight" on public.bodyweight_entries
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index bodyweight_entries_user_date
  on public.bodyweight_entries (user_id, date);

-- 3. Feedback: collected in-app instead of by email, tagged with a type.
create table public.feedback (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('bug', 'idea', 'praise', 'other')),
  message text not null check (char_length(message) between 1 and 4000),
  created_at timestamptz not null
);

alter table public.feedback enable row level security;

-- A user may submit feedback and read their own; admins can read everything.
create policy "insert own feedback" on public.feedback
  for insert to authenticated
  with check (user_id = auth.uid());
create policy "read own feedback" on public.feedback
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
