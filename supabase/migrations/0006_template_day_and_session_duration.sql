-- The default template becomes a full workout day (edited with the same UI
-- as the program designer), and sessions record active workout time.

alter table public.default_template
  add column day jsonb;

-- Backfill: convert the legacy flat entries list into a workout day.
update public.default_template
set day = jsonb_build_object(
  'exercises',
  coalesce(
    (
      select jsonb_agg(
        e || jsonb_build_object(
          'id', 'default-' || (e ->> 'exerciseId') || '-' || (idx - 1),
          'progressionMethod', 'intra'
        )
      )
      from jsonb_array_elements(entries) with ordinality as t(e, idx)
    ),
    '[]'::jsonb
  ),
  'groups', '[]'::jsonb
)
where day is null;

alter table public.sessions
  add column duration_seconds integer;
