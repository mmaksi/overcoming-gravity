-- First/last name from the auth provider. Supabase's Google integration
-- only stores full_name/name in raw_user_meta_data (no given_name /
-- family_name), so the split is: first word = first name, remainder = last
-- name — with the granular keys preferred should a provider ever send
-- them. `name` stays the editable display name; these two are
-- provider-sourced and power the "Hi <first name>" greeting.
alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  display_name text := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    split_part(new.email, '@', 1)
  );
begin
  insert into public.profiles (id, email, name, first_name, last_name)
  values (
    new.id,
    new.email,
    display_name,
    coalesce(
      new.raw_user_meta_data ->> 'given_name',
      nullif(split_part(display_name, ' ', 1), '')
    ),
    coalesce(
      new.raw_user_meta_data ->> 'family_name',
      nullif(btrim(substr(display_name, length(split_part(display_name, ' ', 1)) + 1)), '')
    )
  );
  return new;
end;
$$;

-- Existing accounts: derive from the names Google sent at their signup.
update public.profiles p
set first_name = coalesce(
      u.raw_user_meta_data ->> 'given_name',
      nullif(split_part(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', ''), ' ', 1), '')
    ),
    last_name = coalesce(
      u.raw_user_meta_data ->> 'family_name',
      nullif(btrim(substr(
        coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', ''),
        length(split_part(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', ''), ' ', 1)) + 1
      )), '')
    )
from auth.users u
where u.id = p.id
  and p.first_name is null;
