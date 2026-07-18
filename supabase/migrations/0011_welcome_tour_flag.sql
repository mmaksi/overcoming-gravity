-- Welcome tour: every profile starts with the tour visible (existing users
-- included — they should see the new carousel once too). Dismissing the tour
-- flips it off; Settings can turn it back on for the next visit.
alter table public.profiles
  add column if not exists show_welcome boolean not null default true;
