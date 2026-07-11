-- Standalone custom workouts (a title + one workout day, no goals or
-- periodization). Sessions may now belong to a custom workout instead of a
-- program run.

create table public.custom_workouts (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  day jsonb not null default '{"exercises": [], "groups": []}',
  created_at timestamptz not null,
  updated_at timestamptz not null
);

alter table public.custom_workouts enable row level security;

create policy "own custom workouts" on public.custom_workouts
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table public.sessions
  alter column run_id drop not null,
  add column custom_workout_id text references public.custom_workouts (id) on delete cascade,
  add constraint sessions_owner_check
    check (run_id is not null or custom_workout_id is not null);
