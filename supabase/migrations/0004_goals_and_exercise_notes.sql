-- Programs gain per-area goals (1–2 each for skills, push, pull), and users
-- gain remembered notes per exercise + inter-exercise technique pair.

alter table public.programs
  add column goals jsonb;

create table public.exercise_notes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  exercise_id text not null references public.exercises (id) on delete cascade,
  technique_id text not null,
  note text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, exercise_id, technique_id)
);

alter table public.exercise_notes enable row level security;

create policy "own notes" on public.exercise_notes
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
