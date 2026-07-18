-- Show the workout-designer intro carousel once per user. Defaults to true so
-- existing users see it on their next visit to the designer, like the welcome
-- tour (but tracked separately from show_welcome).
alter table public.profiles
  add column if not exists show_designer_intro boolean not null default true;
