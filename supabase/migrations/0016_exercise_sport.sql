-- Sport-specific exercises: the library grows beyond calisthenics (parkour,
-- …). Free-form admin-managed name; null means calisthenics (the app's core,
-- and every exercise saved before sports existed).
alter table public.exercises
  add column if not exists sport text;
