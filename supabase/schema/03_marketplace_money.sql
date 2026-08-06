-- ============================================================
--  AI Logistics OS — 03 · marketplace and settlement
--
--  This is what makes broker reliability real. v1 stored
--  on_time_pct and avg_days_to_pay as literal columns typed in by
--  hand, then sold access to them. Here they are derived from
--  invoices and payments, so the number a driver pays to see is a
--  measurement rather than a fixture.
-- ============================================================

-- ------------------------------------------------------------
-- load_offers — bids and counteroffers.
--
-- v1 had no negotiation: a load had one rate, take it or leave it.
-- Every real board has an offer round.
-- ------------------------------------------------------------
create type offer_status as enum ('open', 'accepted', 'declined', 'countered', 'withdrawn', 'expired');

create table public.load_offers (
  id           uuid primary key default gen_random_uuid(),
  load_id      uuid not null references public.loads(id) on delete cascade,
  carrier_org  uuid not null references public.organizations(id) on delete cascade,
  offered_by   uuid not null references public.profiles(id) on delete cascade,
  amount       numeric(12,2) not null check (amount > 0),
  note         text,
  status       offer_status not null default 'open',
  -- set when this offer answers another
  counters_id  uuid references public.load_offers(id) on delete set null,
  expires_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index load_offers_load_idx    on public.load_offers (load_id, status);
create index load_offers_carrier_idx on public.load_offers (carrier_org, created_at desc);

-- one live offer per carrier per load
create unique index load_offers_one_open
  on public.load_offers (load_id, carrier_org) where status = 'open';

create trigger load_offers_touch before update on public.load_offers
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- invoices and payments — the source of every reliability figure
-- ------------------------------------------------------------
create type invoice_status as enum ('draft', 'sent', 'part_paid', 'paid', 'disputed', 'written_off');

create table public.invoices (
  id            uuid primary key default gen_random_uuid(),
  load_id       uuid not null references public.loads(id) on delete restrict,
  -- who is owed and who owes
  payee_org     uuid not null references public.organizations(id) on delete restrict,
  payer_org     uuid not null references public.organizations(id) on delete restrict,
  number        text not null unique,
  amount        numeric(12,2) not null check (amount > 0),
  currency      char(3) not null default 'USD',
  -- terms as agreed at booking, so a later change cannot rewrite history
  terms_days    int not null default 30 check (terms_days >= 0),
  issued_on     date not null default current_date,
  due_on        date generated always as (issued_on + terms_days) stored,
  status        invoice_status not null default 'draft',
  disputed_at   timestamptz,
  dispute_reason text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint no_self_billing check (payee_org <> payer_org)
);

create index invoices_payer_idx  on public.invoices (payer_org, status);
create index invoices_payee_idx  on public.invoices (payee_org, status);
create index invoices_load_idx   on public.invoices (load_id);

create trigger invoices_touch before update on public.invoices
  for each row execute function public.touch_updated_at();

create table public.payments (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.invoices(id) on delete restrict,
  amount      numeric(12,2) not null check (amount > 0),
  paid_on     date not null default current_date,
  method      text,
  reference   text,
  created_at  timestamptz not null default now()
);

create index payments_invoice_idx on public.payments (invoice_id);

-- Keep invoice.status in step with what has actually been paid.
create or replace function public.recalc_invoice_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_invoice uuid := coalesce(new.invoice_id, old.invoice_id);
  v_paid    numeric(12,2);
  v_total   numeric(12,2);
begin
  select coalesce(sum(amount), 0) into v_paid from public.payments where invoice_id = v_invoice;
  select amount into v_total from public.invoices where id = v_invoice;

  update public.invoices
     set status = case
                    when v_paid >= v_total then 'paid'::invoice_status
                    when v_paid > 0        then 'part_paid'::invoice_status
                    else status
                  end
   where id = v_invoice
     and status not in ('disputed', 'written_off');
  return null;
end $$;

create trigger payments_recalc
  after insert or update or delete on public.payments
  for each row execute function public.recalc_invoice_status();

-- ------------------------------------------------------------
-- broker_stats — reliability, measured.
--
-- A materialised view so the board can join it cheaply; refresh
-- nightly (pg_cron) or after settlement runs.
-- ------------------------------------------------------------
create materialized view public.broker_stats as
select
  o.id                                                        as org_id,
  count(i.id)                                                 as invoices_total,
  count(i.id) filter (where i.status = 'paid')                as invoices_paid,
  count(i.id) filter (where i.status = 'disputed')            as invoices_disputed,
  -- on-time means fully settled on or before the agreed due date
  round(
    100.0 * count(i.id) filter (where i.status = 'paid' and pp.last_paid_on <= i.due_on)
    / nullif(count(i.id) filter (where i.status = 'paid'), 0)
  )::int                                                      as on_time_pct,
  round(avg(pp.last_paid_on - i.issued_on))::int              as avg_days_to_pay,
  round(
    100.0 * count(i.id) filter (where i.status = 'disputed')
    / nullif(count(i.id), 0), 1
  )                                                           as dispute_pct,
  (select count(*) from public.loads l where l.broker_org = o.id) as loads_posted,
  extract(year from o.created_at)::int                        as member_since,
  max(pp.last_paid_on)                                        as last_settled_on
from public.organizations o
left join public.invoices i on i.payer_org = o.id
left join lateral (
  select max(p.paid_on) as last_paid_on
  from public.payments p
  where p.invoice_id = i.id
) pp on true
where o.kind = 'broker'
group by o.id, o.created_at;

create unique index broker_stats_org_idx on public.broker_stats (org_id);

comment on materialized view public.broker_stats is
  'Derived reliability. Refresh with: refresh materialized view concurrently public.broker_stats;';

-- Composite score, so the UI has one number to show.
create or replace function public.broker_score(
  p_on_time int, p_days int, p_dispute numeric, p_volume bigint
) returns int language sql immutable as $$
  select greatest(0, least(100, round(
      0.50 * coalesce(p_on_time, 60)                                  -- pays when promised
    + 0.25 * greatest(0, 100 - coalesce(p_days, 45) * 1.4)            -- pays quickly
    + 0.15 * greatest(0, 100 - coalesce(p_dispute, 5) * 8)            -- rarely disputes
    + 0.10 * least(100, coalesce(p_volume, 0) / 20.0)                 -- has a track record
  )))::int;
$$;

-- ------------------------------------------------------------
-- subscriptions — Premium, owned by billing rather than the client
-- ------------------------------------------------------------
create type sub_status as enum ('trialing', 'active', 'past_due', 'cancelled');

create table public.subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organizations(id) on delete cascade,
  plan               text not null default 'premium',
  status             sub_status not null default 'trialing',
  provider           text,             -- 'stripe'
  provider_customer  text,
  provider_sub_id    text unique,
  current_period_end timestamptz,
  cancel_at          timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create unique index subscriptions_one_live_per_org
  on public.subscriptions (org_id) where status in ('trialing', 'active', 'past_due');

create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function public.touch_updated_at();

/* The premium test, in one place. Nothing writes is_premium onto a
   profile any more — v1 exposed set_premium() to every signed-in
   user, which meant the paid tier was free to anyone who read the
   network tab. Entitlement is now a fact about a subscription row
   that only the service role can write. */
create or replace function public.org_is_premium(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.subscriptions
    where org_id = p_org
      and status in ('trialing', 'active')
      and (current_period_end is null or current_period_end > now())
  );
$$;

create or replace function public.i_am_premium()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.org_members m
    join public.subscriptions s on s.org_id = m.org_id
    where m.user_id = auth.uid()
      and s.status in ('trialing', 'active')
      and (s.current_period_end is null or s.current_period_end > now())
  );
$$;

-- ------------------------------------------------------------
-- saved_searches — lane alerts, the reason a driver opens the app
-- ------------------------------------------------------------
create table public.saved_searches (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  name           text not null,
  origin_zip     text references public.us_places(zip),
  origin_radius_mi int check (origin_radius_mi > 0),
  dest_zip       text references public.us_places(zip),
  dest_radius_mi int check (dest_radius_mi > 0),
  equipment_code text references public.equipment_types(code),
  min_rate_per_mile numeric(10,2),
  min_miles      int,
  max_miles      int,
  notify         boolean not null default true,
  last_run_at    timestamptz,
  created_at     timestamptz not null default now(),

  constraint miles_range check (min_miles is null or max_miles is null or min_miles <= max_miles)
);

create index saved_searches_user_idx on public.saved_searches (user_id);

create table public.notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null,
  title      text not null,
  body       text,
  load_id    uuid references public.loads(id) on delete cascade,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc)
  where read_at is null;
