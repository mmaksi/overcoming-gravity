-- Billing (provider-neutral) + vouchers.
--
-- The app is loosely coupled to its payment provider: profiles carry a
-- provider name + customer reference and a normalized subscription snapshot,
-- so a second provider can be added without another schema change. Vouchers
-- are our own table (not provider coupons) for the same reason.

alter table public.profiles
  add column if not exists billing_provider text,
  add column if not exists billing_customer_id text,
  add column if not exists billing_subscription_id text,
  add column if not exists subscription_status text,
  add column if not exists subscription_interval text
    check (subscription_interval in ('month', 'year')),
  add column if not exists subscription_period_end timestamptz,
  add column if not exists subscription_cancel_at_period_end boolean not null default false;

-- Webhooks look a profile up by the provider's customer reference.
create index if not exists profiles_billing_customer_idx
  on public.profiles (billing_customer_id);

-- Users may update their own profile row (name, avatar, tour flags, …) but
-- must never be able to grant themselves a subscription: billing columns
-- only change through the server's service-role writes (verified provider
-- webhooks and the post-checkout sync).
create or replace function public.protect_billing_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;
  if new.billing_provider is distinct from old.billing_provider
     or new.billing_customer_id is distinct from old.billing_customer_id
     or new.billing_subscription_id is distinct from old.billing_subscription_id
     or new.subscription_status is distinct from old.subscription_status
     or new.subscription_interval is distinct from old.subscription_interval
     or new.subscription_period_end is distinct from old.subscription_period_end
     or new.subscription_cancel_at_period_end is distinct from old.subscription_cancel_at_period_end
  then
    raise exception 'billing columns are managed by the server';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_billing_columns on public.profiles;
create trigger protect_billing_columns
  before update on public.profiles
  for each row execute function public.protect_billing_columns();

-- Admin-created discount codes with a validity window and a redemption cap.
-- Regular users never read this table — codes are validated server-side with
-- the service role — so there is intentionally no user-facing select policy.
create table if not exists public.vouchers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  percent_off integer not null check (percent_off between 1 and 100),
  valid_from date,
  valid_until date,
  max_redemptions integer check (max_redemptions > 0),
  redemptions integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.vouchers enable row level security;

create policy "admins manage vouchers" on public.vouchers
  for all using (public.is_admin()) with check (public.is_admin());
