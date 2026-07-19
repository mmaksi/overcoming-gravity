-- Admin-managed sports the exercise library spans ("Parkour", …).
-- Calisthenics is built into the app and never stored. Exercises reference a
-- sport by NAME (exercises.sport, migration 0016), so a row here is just a
-- picker entry — deleting one leaves its exercises' string untouched.
create table public.sports (
  id text primary key,
  name text not null
);

-- No two sports may share a name (case-insensitive).
create unique index sports_name_unique on public.sports (lower(name));

alter table public.sports enable row level security;

create policy "content readable" on public.sports
  for select to authenticated using (true);
create policy "content admin write" on public.sports
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
