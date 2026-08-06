-- ============================================================
--  AI Logistics OS — 02 · loads
--
--  Normalised truth in load_stops, a denormalised read path on
--  loads. The board query filters on origin/dest geography
--  millions of times a day; it must not join two stop rows to do
--  it. Triggers keep the copy correct.
-- ============================================================

create sequence public.load_ref_seq start 4500;

create table public.loads (
  id            uuid primary key default gen_random_uuid(),
  ref           text not null unique default ('LD-' || nextval('public.load_ref_seq')),

  -- parties
  shipper_org   uuid not null references public.organizations(id) on delete restrict,
  broker_org    uuid references public.organizations(id) on delete set null,
  carrier_org   uuid references public.organizations(id) on delete set null,
  driver_id     uuid references public.profiles(id) on delete set null,
  posted_by     uuid references public.profiles(id) on delete set null,  -- null for imported/seeded loads

  -- denormalised endpoints, maintained by trigger from load_stops
  origin_zip    text references public.us_places(zip),
  origin_geog   geography(Point, 4326),
  dest_zip      text references public.us_places(zip),
  dest_geog     geography(Point, 4326),
  stop_count    smallint not null default 2,

  -- distance and money
  miles         int not null check (miles > 0),
  rate          numeric(12,2) not null check (rate > 0),
  currency      char(3) not null default 'USD',
  rate_per_mile numeric(10,2) generated always as (round(rate / nullif(miles, 0), 2)) stored,

  -- freight
  commodity     text not null,
  weight_lb     int  not null check (weight_lb > 0),
  pieces        int  not null default 1 check (pieces > 0),
  len_in        int  not null default 48 check (len_in > 0),
  wid_in        int  not null default 40 check (wid_in > 0),
  hgt_in        int  not null default 48 check (hgt_in > 0),
  cube_ft       numeric(10,1)
                  generated always as (round((len_in * wid_in * hgt_in * pieces) / 1728.0, 1)) stored,
  equipment_code text not null references public.equipment_types(code),
  is_hazmat     boolean not null default false,
  needs_liftgate boolean not null default false,

  -- schedule
  pickup_at     timestamptz,
  pickup_by     timestamptz,
  deliver_at    timestamptz,
  deliver_by    timestamptz,

  -- state
  stage         smallint not null default 0 references public.load_stages(ordinal),
  eta           timestamptz,
  miles_remaining int check (miles_remaining >= 0),
  booked_at     timestamptz,
  delivered_at  timestamptz,
  cancelled_at  timestamptz,
  cancel_reason text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- ---- integrity the v1 schema left to the application ----

  -- a committed stage requires a carrier; an open one must not have one
  constraint carrier_matches_stage check (
    (stage = 0 and carrier_org is null and driver_id is null)
    or (stage between 1 and 6 and carrier_org is not null)
    or stage in (7, 8)
  ),
  constraint booked_at_set        check (stage = 0 or stage = 7 or booked_at is not null),
  constraint delivered_at_set     check ((stage = 6) = (delivered_at is not null)),
  constraint cancelled_at_set     check ((stage = 7) = (cancelled_at is not null)),
  constraint pickup_before_deliver check (
    pickup_at is null or deliver_by is null or pickup_at < deliver_by
  ),
  constraint window_order check (
    pickup_by is null or pickup_at is null or pickup_at <= pickup_by
  )
);

comment on constraint carrier_matches_stage on public.loads is
  'A load cannot be in transit with nobody driving it. v1 allowed that.';

create trigger loads_touch before update on public.loads
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- load_stops — the normalised itinerary
-- ------------------------------------------------------------
create type stop_kind as enum ('pickup', 'delivery');

create table public.load_stops (
  id          uuid primary key default gen_random_uuid(),
  load_id     uuid not null references public.loads(id) on delete cascade,
  seq         smallint not null check (seq > 0),
  kind        stop_kind not null,
  zip         text not null references public.us_places(zip),
  geog        geography(Point, 4326) not null,
  address1    text,
  address2    text,
  contact_name  text,
  contact_phone text,
  window_start  timestamptz,
  window_end    timestamptz,
  reference_no  text,          -- PO / pickup number
  notes         text,
  arrived_at    timestamptz,
  departed_at   timestamptz,
  created_at    timestamptz not null default now(),

  unique (load_id, seq),
  constraint stop_window_order check (
    window_start is null or window_end is null or window_start <= window_end
  ),
  constraint dwell_order check (
    arrived_at is null or departed_at is null or arrived_at <= departed_at
  )
);

create index load_stops_load_idx on public.load_stops (load_id, seq);
create index load_stops_geog_idx on public.load_stops using gist (geog);

-- Fill geog from the ZIP, then push first/last stop onto loads.
create or replace function public.sync_stop_geog()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select geog into new.geog from public.us_places where zip = new.zip;
  if new.geog is null then
    raise exception 'Unknown ZIP code %', new.zip;
  end if;
  return new;
end $$;

create trigger load_stops_geog
  before insert or update of zip on public.load_stops
  for each row execute function public.sync_stop_geog();

create or replace function public.sync_load_endpoints()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_load uuid := coalesce(new.load_id, old.load_id);
begin
  update public.loads l
     set origin_zip  = f.zip,  origin_geog = f.geog,
         dest_zip    = t.zip,  dest_geog   = t.geog,
         stop_count  = c.n
    from (select zip, geog from public.load_stops
           where load_id = v_load order by seq asc limit 1) f,
         (select zip, geog from public.load_stops
           where load_id = v_load order by seq desc limit 1) t,
         (select count(*)::smallint n from public.load_stops where load_id = v_load) c
   where l.id = v_load;
  return null;
end $$;

create trigger load_stops_sync_endpoints
  after insert or update or delete on public.load_stops
  for each row execute function public.sync_load_endpoints();

-- ------------------------------------------------------------
-- load_events — append-only history of state changes.
--
-- v1 stored a prose note. Storing from_stage/to_stage as well
-- makes the table answer real questions: how long does a load sit
-- before it is booked, which carriers run late, where do loads die.
-- ------------------------------------------------------------
create table public.load_events (
  id         bigint generated always as identity primary key,
  load_id    uuid not null references public.loads(id) on delete cascade,
  actor_id   uuid references public.profiles(id) on delete set null,
  actor_org  uuid references public.organizations(id) on delete set null,
  from_stage smallint references public.load_stages(ordinal),
  to_stage   smallint references public.load_stages(ordinal),
  event_type text not null default 'stage_change',
  note       text not null,
  geog       geography(Point, 4326),      -- where the driver was when they tapped
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index load_events_load_idx on public.load_events (load_id, created_at desc);
create index load_events_org_idx  on public.load_events (actor_org, created_at desc);

-- Nothing rewrites history.
create or replace function public.forbid_mutation()
returns trigger language plpgsql as $$
begin
  raise exception '% is append-only', tg_table_name;
end $$;

create trigger load_events_immutable
  before update or delete on public.load_events
  for each row execute function public.forbid_mutation();

-- ------------------------------------------------------------
-- load_documents — BOL, POD, rate confirmation, lumper receipts.
-- Bytes live in Supabase Storage; this is the metadata and the
-- thing RLS can reason about.
-- ------------------------------------------------------------
create type document_kind as enum
  ('rate_confirmation', 'bol', 'pod', 'lumper_receipt', 'invoice', 'insurance', 'other');

create table public.load_documents (
  id           uuid primary key default gen_random_uuid(),
  load_id      uuid not null references public.loads(id) on delete cascade,
  stop_id      uuid references public.load_stops(id) on delete set null,
  kind         document_kind not null,
  storage_path text not null unique,       -- bucket-relative path
  mime_type    text,
  byte_size    int check (byte_size >= 0),
  uploaded_by  uuid references public.profiles(id) on delete set null,
  signed_by    text,                       -- printed name on a POD signature
  captured_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index load_documents_load_idx on public.load_documents (load_id, kind);

-- A delivered load must have proof. v1 enforced this with a checkbox
-- in the browser, which is not enforcement.
create or replace function public.load_has_document(p_load uuid, p_kind document_kind)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.load_documents
    where load_id = p_load and kind = p_kind
  );
$$;

-- ------------------------------------------------------------
-- load_tracking — position pings, the input to a real ETA
-- ------------------------------------------------------------
create table public.load_tracking (
  id          bigint generated always as identity primary key,
  load_id     uuid not null references public.loads(id) on delete cascade,
  driver_id   uuid not null references public.profiles(id) on delete cascade,
  geog        geography(Point, 4326) not null,
  speed_mph   numeric(5,1),
  heading_deg numeric(4,1),
  recorded_at timestamptz not null default now()
);

create index load_tracking_load_idx on public.load_tracking (load_id, recorded_at desc);
create index load_tracking_geog_idx on public.load_tracking using gist (geog);
