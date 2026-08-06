-- ============================================================
--  AI Logistics OS — 01 · identity
--
--  v1 modelled a user as a company, which breaks the first time
--  a carrier hires a second driver or a shipper adds a second
--  person to the account. Freight is transacted between
--  organizations; people act on their behalf.
-- ============================================================

create type org_kind    as enum ('shipper', 'carrier', 'broker');
create type org_status  as enum ('pending', 'active', 'suspended');
create type member_role as enum ('owner', 'dispatcher', 'driver', 'member');

-- ------------------------------------------------------------
-- organizations — the legal party on a load
-- ------------------------------------------------------------
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  kind        org_kind   not null,
  legal_name  text       not null check (length(btrim(legal_name)) > 0),
  dba         text,
  -- carriers and brokers are regulated; shippers are not
  mc_number   text unique,
  dot_number  text unique,
  status      org_status not null default 'active',
  billing_email citext,
  phone       text,
  address_zip text references public.us_places(zip),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- a carrier without authority cannot be booked; enforce at the source
  constraint carrier_needs_authority
    check (kind <> 'carrier' or mc_number is not null or status = 'pending')
);

create index organizations_kind_idx on public.organizations (kind, status);

create trigger organizations_touch before update on public.organizations
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- profiles — one row per auth user, no company fields
-- ------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  full_name  text not null default '',
  phone      text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- org_members — who may act for which organization.
-- This is the table every RLS policy leans on.
-- ------------------------------------------------------------
create table public.org_members (
  org_id     uuid not null references public.organizations(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       member_role not null default 'member',
  is_default boolean not null default true,   -- which org this user lands in at sign-in
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index org_members_user_idx on public.org_members (user_id);

-- exactly one default org per user
create unique index org_members_one_default
  on public.org_members (user_id) where is_default;

-- ------------------------------------------------------------
-- driver_profiles — the parts of a driver that a shipper never has
-- ------------------------------------------------------------
create table public.driver_profiles (
  user_id        uuid primary key references public.profiles(id) on delete cascade,
  org_id         uuid not null references public.organizations(id) on delete cascade,
  equipment_code text references public.equipment_types(code),
  cdl_number     text,
  cdl_expires_on date,
  -- where deadhead is measured from; geog is denormalised from the ZIP
  home_zip       text references public.us_places(zip),
  home_geog      geography(Point, 4326),
  -- last known position, updated by load_tracking
  last_geog      geography(Point, 4326),
  last_seen_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index driver_profiles_home_geog_idx on public.driver_profiles using gist (home_geog);
create index driver_profiles_org_idx       on public.driver_profiles (org_id);

create trigger driver_profiles_touch before update on public.driver_profiles
  for each row execute function public.touch_updated_at();

-- Keep home_geog in step with home_zip so nothing can drift apart.
create or replace function public.sync_driver_home_geog()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.home_zip is distinct from old.home_zip or tg_op = 'INSERT' then
    select geog into new.home_geog from public.us_places where zip = new.home_zip;
  end if;
  return new;
end $$;

create trigger driver_profiles_sync_geog
  before insert or update of home_zip on public.driver_profiles
  for each row execute function public.sync_driver_home_geog();

-- ------------------------------------------------------------
-- Membership helpers. SECURITY DEFINER and STABLE so RLS can call
-- them without recursing into the policies on org_members itself.
-- ------------------------------------------------------------
create or replace function public.my_org_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select org_id from public.org_members where user_id = auth.uid();
$$;

create or replace function public.is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.org_members
    where org_id = p_org and user_id = auth.uid()
  );
$$;

create or replace function public.has_org_role(p_org uuid, p_roles member_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.org_members
    where org_id = p_org and user_id = auth.uid() and role = any(p_roles)
  );
$$;

/* The portal a user lands in. Derived from their default org, so it
   cannot drift out of step with what they are actually allowed to do —
   v1 stored this as a free-standing column on the profile. */
create or replace function public.my_portal()
returns text language sql stable security definer set search_path = public as $$
  select case o.kind when 'carrier' then 'driver' else o.kind::text end
  from public.org_members m
  join public.organizations o on o.id = m.org_id
  where m.user_id = auth.uid() and m.is_default
  limit 1;
$$;

create or replace function public.my_org(p_kind org_kind default null)
returns uuid language sql stable security definer set search_path = public as $$
  select m.org_id
  from public.org_members m
  join public.organizations o on o.id = m.org_id
  where m.user_id = auth.uid()
    and (p_kind is null or o.kind = p_kind)
  order by m.is_default desc
  limit 1;
$$;

-- ------------------------------------------------------------
-- Signup: create the profile, the organization and the membership
-- in one transaction.
--
-- v1 inserted straight into profiles and cast raw metadata to an
-- enum, so a malformed signup payload raised inside the auth
-- transaction and the account silently failed to create. Here bad
-- input is coerced to a safe default and the org is always made.
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_meta    jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_kind    org_kind;
  v_org     uuid;
  v_company text;
  v_zip     text;
  v_equip   text;
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, coalesce(v_meta ->> 'full_name', ''), nullif(v_meta ->> 'phone', ''))
  on conflict (id) do nothing;

  v_kind := case lower(coalesce(v_meta ->> 'role', 'shipper'))
              when 'driver'  then 'carrier'
              when 'carrier' then 'carrier'
              when 'broker'  then 'broker'
              else 'shipper'
            end::org_kind;

  v_company := nullif(btrim(coalesce(v_meta ->> 'company', '')), '');
  if v_company is null then
    v_company := coalesce(nullif(v_meta ->> 'full_name', ''), split_part(new.email, '@', 1));
  end if;

  insert into public.organizations (kind, legal_name, mc_number, billing_email, status)
  values (
    v_kind, v_company,
    nullif(btrim(coalesce(v_meta ->> 'mc_number', '')), ''),
    new.email::citext,
    case when v_kind = 'carrier' and nullif(btrim(coalesce(v_meta ->> 'mc_number', '')), '') is null
         then 'pending'::org_status else 'active'::org_status end
  )
  returning id into v_org;

  insert into public.org_members (org_id, user_id, role, is_default)
  values (v_org, new.id, 'owner', true);

  if v_kind = 'carrier' then
    -- unrecognised equipment or ZIP becomes null rather than failing signup
    v_equip := (select code from public.equipment_types
                 where code = nullif(btrim(coalesce(v_meta ->> 'equipment', '')), ''));
    v_zip   := (select zip from public.us_places
                 where zip = nullif(btrim(coalesce(v_meta ->> 'home_zip', '')), ''));

    insert into public.driver_profiles (user_id, org_id, equipment_code, home_zip)
    values (new.id, v_org, v_equip, v_zip);
  end if;

  return new;
exception
  when others then
    -- never take the whole signup down; log and let the user in with a bare profile
    raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
    return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
