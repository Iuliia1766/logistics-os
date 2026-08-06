-- ============================================================
--  AI Logistics OS — 00 · extensions and reference data
--
--  Reference tables are the things that are true regardless of
--  who is signed in: geography, equipment classes, the stage
--  machine. They are readable by everyone and written by nobody.
-- ============================================================

create extension if not exists pgcrypto  with schema extensions;  -- gen_random_uuid
create extension if not exists postgis   with schema extensions;  -- geography + GiST radius search
create extension if not exists pg_trgm   with schema extensions;  -- fuzzy city search
create extension if not exists citext     with schema extensions;  -- case-insensitive email

-- ------------------------------------------------------------
-- Shared trigger: keep updated_at honest without trusting clients
-- ------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ------------------------------------------------------------
-- us_places — every US postal code, with a real geography point.
--
-- The v1 schema stored lat/lng as two doubles and computed
-- distance in JavaScript, which meant every open load had to be
-- shipped to the browser before it could be filtered. A
-- geography column with a GiST index lets Postgres answer
-- "within 150 miles of here" directly, which is the query this
-- product is built on.
-- ------------------------------------------------------------
create table public.us_places (
  zip        text primary key check (zip ~ '^\d{5}$'),
  city       text not null,
  state      char(2) not null,
  county     text,
  geog       geography(Point, 4326) not null,
  -- kept alongside geog so views and clients never cast geometry
  lat        double precision not null,
  lng        double precision not null,
  -- how many ZIPs share this city name, used to rank autocomplete
  -- so "dallas" offers Dallas, TX before Dallas, GA
  city_rank  int not null default 1,
  created_at timestamptz not null default now()
);

create index us_places_geog_idx  on public.us_places using gist (geog);
create index us_places_city_trgm on public.us_places using gin (city extensions.gin_trgm_ops);
create index us_places_city_idx  on public.us_places (lower(city), state);
create index us_places_state_idx on public.us_places (state);

comment on column public.us_places.geog is
  'WGS84 point. ST_Distance on geography returns metres.';

-- ------------------------------------------------------------
-- equipment_types — a lookup table, not an enum.
--
-- Enums need a migration and an exclusive lock to add a value.
-- A load board adds equipment classes as it grows (reefer,
-- flatbed, hotshot), so this has to be a table.
-- ------------------------------------------------------------
create table public.equipment_types (
  code          text primary key,
  label         text not null,
  family        text not null check (family in ('van', 'box', 'flatbed', 'reefer', 'other')),
  capacity_lb   int  not null,
  deck_len_in   int,
  deck_wid_in   int,
  deck_hgt_in   int,
  has_liftgate  boolean not null default false,
  sort_order    int  not null default 0,
  is_active     boolean not null default true
);

insert into public.equipment_types
  (code, label, family, capacity_lb, deck_len_in, deck_wid_in, deck_hgt_in, has_liftgate, sort_order) values
  ('sprinter_van',    'Sprinter Van',               'van',  3500,  144, 68,  70,  false, 10),
  ('box_16',          'Box Truck 16 ft',            'box',  12000, 192, 92,  90,  false, 20),
  ('box_24',          'Box Truck 24 ft',            'box',  16000, 288, 96,  96,  false, 30),
  ('box_26',          'Box Truck 26 ft',            'box',  26000, 312, 96,  102, false, 40),
  ('box_26_liftgate', 'Box Truck 26 ft + Liftgate', 'box',  26000, 312, 96,  102, true,  50);

-- ------------------------------------------------------------
-- load_stages — the state machine as data.
--
-- v1 hard-coded stage numbers in a CASE inside advance_load().
-- Putting the legal transitions in a table means the machine can
-- be inspected, extended (cancelled, refused, re-brokered) and
-- enforced by a foreign key instead of by reviewer attention.
-- ------------------------------------------------------------
create table public.load_stages (
  ordinal     smallint primary key,
  code        text not null unique,
  label       text not null,
  is_terminal boolean not null default false,
  -- true once a carrier is committed; used to block edits and deletes
  is_committed boolean not null default false
);

insert into public.load_stages (ordinal, code, label, is_terminal, is_committed) values
  (0, 'posted',      'Posted',              false, false),
  (1, 'booked',      'Booked',              false, true),
  (2, 'to_pickup',   'En Route to Pickup',  false, true),
  (3, 'picked_up',   'Picked Up',           false, true),
  (4, 'in_transit',  'In Transit',          false, true),
  (5, 'approaching', 'Approaching',         false, true),
  (6, 'delivered',   'Delivered',           true,  true),
  (7, 'cancelled',   'Cancelled',           true,  false),
  (8, 'tonu',        'Truck Ordered Not Used', true, true);

create table public.load_stage_transitions (
  from_ordinal smallint not null references public.load_stages(ordinal),
  to_ordinal   smallint not null references public.load_stages(ordinal),
  -- who is allowed to make this move
  actor        text not null check (actor in ('carrier', 'shipper', 'broker', 'system')),
  primary key (from_ordinal, to_ordinal, actor)
);

insert into public.load_stage_transitions (from_ordinal, to_ordinal, actor) values
  (0, 1, 'carrier'),   -- booking
  (1, 2, 'carrier'), (2, 3, 'carrier'), (3, 4, 'carrier'),
  (4, 5, 'carrier'), (5, 6, 'carrier'),
  (0, 7, 'shipper'),   -- cancel while nobody is committed
  (1, 7, 'shipper'), (1, 7, 'carrier'),
  (2, 8, 'carrier'), (3, 8, 'carrier');

-- ------------------------------------------------------------
-- Pricing assumptions live in one place so they can be tuned
-- without hunting through function bodies.
-- ------------------------------------------------------------
create table public.settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.settings (key, value) values
  ('road_factor',        '1.15'::jsonb),   -- great-circle → driving miles
  ('avg_speed_mph',      '50'::jsonb),     -- ETA arithmetic until telematics land
  ('detention_free_hrs', '2'::jsonb),
  ('detention_rate_usd', '65'::jsonb);

create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();
