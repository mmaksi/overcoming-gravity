-- Signup attribution: where a new account came from (`?source=` on the
-- login URL, e.g. "instagram", "landing-hero"). Written once by the server
-- at first sign-in; analytics only, never shown in the app.
alter table public.profiles
  add column if not exists signup_source text;
