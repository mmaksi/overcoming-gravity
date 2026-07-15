-- Performance: cheaper reads for the dashboard, calendar and program list, plus
-- a targeted stats query for the workout logger. The app now has summary read
-- methods that select explicit columns and skip the large jsonb documents
-- (mesocycle, entries, day). See docs/performance-data-transfer-review.md.

-- 1) A generated flag so session summaries can tell a logged workout from an
--    empty one (the dashboard's "Continue" vs "Start") without downloading the
--    whole `entries` document. `entries` is `not null default '[]'`, so this is
--    always a valid jsonb array.
alter table public.sessions
  add column if not exists has_entries boolean
    generated always as (jsonb_array_length(entries) > 0) stored;

-- 2) Completed sessions that reference any of the given exercises. The workout
--    logger only needs progression stats for the exercises planned for the day,
--    so this avoids downloading a user's entire completed history.
--
--    SECURITY INVOKER: the function runs as the caller, so the existing
--    row-level security policies on `sessions` still apply (the explicit
--    user_id filter is defence in depth). Empty search_path + fully-qualified
--    names satisfy the function-hardening advisor.
create or replace function public.completed_sessions_for_exercises(
  p_user_id uuid,
  p_exercise_ids text[]
)
  returns setof public.sessions
  language sql
  stable
  security invoker
  set search_path = ''
as $$
  select s.*
  from public.sessions s
  where s.user_id = p_user_id
    and s.status = 'completed'
    and exists (
      select 1
      from unnest(p_exercise_ids) as x
      where s.entries @> jsonb_build_array(jsonb_build_object('exerciseId', x))
    )
  order by s.date desc
$$;

grant execute on function public.completed_sessions_for_exercises(uuid, text[])
  to authenticated;

-- Supports the @> containment scan above for users with long histories.
create index if not exists sessions_entries_gin_idx
  on public.sessions using gin (entries jsonb_path_ops);
