-- Push / pull / legs is a property of *strength* work only — a warm-up, a
-- stretch or a prehab drill has no movement pattern to balance. Make the
-- category nullable, clear it from every non-strength row, and enforce
-- "categorised if and only if strength" from here on.

alter table public.exercises
  alter column category drop not null;

update public.exercises
  set category = null
  where attribute <> 'strength';

-- Replace the old NOT NULL enum check with one that also admits null.
alter table public.exercises
  drop constraint if exists exercises_category_check;

alter table public.exercises
  add constraint exercises_category_check
    check (category is null or category in ('push', 'pull', 'both', 'legs'));

-- The invariant itself: a category is present exactly when the exercise is
-- strength, and absent for every other attribute.
alter table public.exercises
  add constraint exercises_category_strength
    check ((category is not null) = (attribute = 'strength'));
