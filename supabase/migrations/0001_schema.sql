-- ============================================================
--  AI Logistics OS — schema
--  Run order: 0001_schema → 0002_functions → 0003_rls
-- ============================================================

create extension if not exists pgcrypto;

create type user_role      as enum ('driver', 'shipper');
create type equipment_type as enum ('sprinter_van', 'box_16', 'box_24', 'box_26', 'box_26_liftgate');

-- ------------------------------------------------------------
-- profiles: one row per auth user, created by trigger on signup
-- ------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  role        user_role   not null,
  full_name   text        not null default '',
  company     text        not null default '',
  mc_number   text,
  equipment   equipment_type,          -- drivers only
  home_zip    text,                    -- drivers only: deadhead is measured from here
  is_premium  boolean     not null default false,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- zips: every US postal code (see supabase/seed/zips.csv)
-- ------------------------------------------------------------
create table public.zips (
  zip   text primary key,
  city  text not null,
  state text not null,
  lat   double precision not null,
  lng   double precision not null
);
create index zips_city_lower_idx on public.zips (lower(city) text_pattern_ops);
create index zips_prefix_idx     on public.zips (zip text_pattern_ops);

-- ------------------------------------------------------------
-- brokers: reliability columns are premium-gated by v_brokers
-- ------------------------------------------------------------
create table public.brokers (
  id                uuid primary key default gen_random_uuid(),
  company           text not null,
  rep_name          text not null,
  reliability_score int  not null check (reliability_score between 0 and 100),
  on_time_pct       int  not null,
  avg_days_to_pay   int  not null,
  dispute_pct       numeric(4,1) not null,
  loads_posted      int  not null,
  member_since      int  not null,
  payment_terms     text not null
);

-- ------------------------------------------------------------
-- loads: the shared ledger both portals read and write
-- stage 0 posted · 1 booked · 2 en route to pickup · 3 picked up
--       4 in transit · 5 approaching · 6 delivered
-- ------------------------------------------------------------
create sequence public.load_ref_seq start 4500;

create table public.loads (
  id              uuid primary key default gen_random_uuid(),
  ref             text not null unique default ('LD-' || nextval('public.load_ref_seq')),
  shipper_id      uuid not null references public.profiles(id) on delete cascade,
  broker_id       uuid references public.brokers(id),
  carrier_id      uuid references public.profiles(id) on delete set null,
  origin_zip      text not null references public.zips(zip),
  dest_zip        text not null references public.zips(zip),
  miles           int  not null check (miles > 0),
  rate            numeric(10,2) not null check (rate > 0),
  commodity       text not null,
  weight_lb       int  not null check (weight_lb > 0),
  pieces          int  not null default 1 check (pieces > 0),
  len_in          int  not null default 48,
  wid_in          int  not null default 40,
  hgt_in          int  not null default 48,
  equipment       equipment_type not null,
  pickup_at       timestamptz,
  deliver_by      timestamptz,
  stage           smallint not null default 0 check (stage between 0 and 6),
  eta             timestamptz,          -- estimated at 50 mph over miles_remaining
  miles_remaining int,
  booked_at       timestamptz,
  delivered_at    timestamptz,
  created_at      timestamptz not null default now()
);
create index loads_open_idx     on public.loads (stage) where stage = 0;
create index loads_carrier_idx  on public.loads (carrier_id);
create index loads_shipper_idx  on public.loads (shipper_id);

-- rate per mile is derived, never stored by the client
alter table public.loads
  add column rate_per_mile numeric(10,2)
  generated always as (round(rate / nullif(miles, 0), 2)) stored;

-- Name/company of a counterparty on a load. SECURITY DEFINER so v_loads can show
-- who you are hauling for without opening up the whole profiles row.
create or replace function public.profile_label(p uuid, field text)
returns text language sql stable security definer set search_path = public as $$
  select case field when 'company' then company else full_name end
  from public.profiles where id = p
$$;

-- ------------------------------------------------------------
-- load_events: append-only audit trail behind the activity feed
-- ------------------------------------------------------------
create table public.load_events (
  id         bigint generated always as identity primary key,
  load_id    uuid not null references public.loads(id) on delete cascade,
  actor_id   uuid references public.profiles(id) on delete set null,
  stage      smallint,
  note       text not null,
  created_at timestamptz not null default now()
);
create index load_events_load_idx on public.load_events (load_id, created_at desc);

-- ------------------------------------------------------------
-- messages: one dispatch thread per user
-- ------------------------------------------------------------
create table public.messages (
  id            bigint generated always as identity primary key,
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  body          text not null check (length(btrim(body)) > 0),
  from_dispatch boolean not null default false,
  created_at    timestamptz not null default now()
);
create index messages_owner_idx on public.messages (owner_id, created_at);

-- ------------------------------------------------------------
-- views: joined shapes the UI reads
-- ------------------------------------------------------------

-- Premium gate. The view is SECURITY DEFINER (Postgres default), so it can read
-- brokers while the table itself stays locked down — a free account literally
-- cannot fetch the reliability columns, not just hide them.
create view public.v_brokers as
select
  b.id,
  b.company,
  b.rep_name,
  case when p.is_premium then b.reliability_score end as reliability_score,
  case when p.is_premium then b.on_time_pct       end as on_time_pct,
  case when p.is_premium then b.avg_days_to_pay   end as avg_days_to_pay,
  case when p.is_premium then b.dispute_pct       end as dispute_pct,
  case when p.is_premium then b.loads_posted      end as loads_posted,
  case when p.is_premium then b.member_since      end as member_since,
  case when p.is_premium then b.payment_terms     end as payment_terms,
  coalesce(p.is_premium, false)                       as unlocked
from public.brokers b
left join public.profiles p on p.id = auth.uid();

-- security_invoker: RLS on `loads` decides which rows you get back. Without this
-- the view would run as its owner and hand every load to every user.
create view public.v_loads with (security_invoker = true) as
select
  l.id, l.ref, l.stage, l.miles, l.rate, l.rate_per_mile,
  l.commodity, l.weight_lb, l.pieces, l.len_in, l.wid_in, l.hgt_in,
  l.equipment, l.pickup_at, l.deliver_by, l.eta, l.miles_remaining,
  l.booked_at, l.delivered_at, l.created_at,
  l.shipper_id, l.carrier_id, l.broker_id,
  round((l.len_in * l.wid_in * l.hgt_in * l.pieces) / 1728.0, 1) as cube_ft,
  o.zip as origin_zip, o.city as origin_city, o.state as origin_state,
  o.lat as origin_lat, o.lng as origin_lng,
  d.zip as dest_zip,   d.city as dest_city,   d.state as dest_state,
  d.lat as dest_lat,   d.lng as dest_lng,
  br.company as broker_company, br.rep_name as broker_rep,
  public.profile_label(l.shipper_id, 'company') as shipper_company,
  public.profile_label(l.carrier_id, 'name')    as driver_name,
  public.profile_label(l.carrier_id, 'company') as carrier_company
from public.loads l
join public.zips o          on o.zip = l.origin_zip
join public.zips d          on d.zip = l.dest_zip
left join public.brokers br on br.id = l.broker_id;
