-- ============================================================
--  AI Logistics OS — 04 · functions
--
--  Every mutation is an RPC. The rules that decide money and
--  custody are here, not in the browser.
-- ============================================================

-- ------------------------------------------------------------
-- Geography
-- ------------------------------------------------------------
create or replace function public.setting_num(p_key text, p_default numeric)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::numeric from public.settings where key = p_key), p_default);
$$;

/* Driving miles between two points. PostGIS gives metres on the
   geodesic; the road factor turns that into something a dispatcher
   would recognise. Swap the body for a routing API call when miles
   start deciding what people get paid. */
create or replace function public.road_miles(a geography, b geography)
returns int language sql stable parallel safe as $$
  select case when a is null or b is null then null
         else round(
           extensions.ST_Distance(a, b) / 1609.344 * public.setting_num('road_factor', 1.15)
         )::int end;
$$;

create or replace function public.zip_miles(a text, b text)
returns int language sql stable security definer set search_path = public as $$
  select public.road_miles(za.geog, zb.geog)
  from public.us_places za, public.us_places zb
  where za.zip = a and zb.zip = b;
$$;

/* Autocomplete.

   v1 ordered city matches by ZIP, so typing "dallas" offered
   Dallas, GA (30132) ahead of Dallas, TX (75201), and then filled
   the rest of the list with eight ZIPs from the same city. It also
   never matched "Dallas, TX" — the app's own resolve step looked
   for exactly that string and could never find it.

   This returns one row per city for text queries, biggest first,
   and understands "City, ST". */
create or replace function public.search_places(q text, p_limit int default 8)
returns table (zip text, city text, state char(2), label text)
language plpgsql stable security definer set search_path = public as $$
declare
  v_q     text := btrim(coalesce(q, ''));
  v_city  text;
  v_state text;
begin
  if length(v_q) = 0 then return; end if;

  -- numeric input is a ZIP prefix
  if v_q ~ '^\d+$' then
    return query
      select p.zip, p.city, p.state, (p.city || ', ' || p.state)::text
      from public.us_places p
      where p.zip like v_q || '%'
      order by p.zip
      limit p_limit;
    return;
  end if;

  -- "Dallas, TX" / "Dallas TX" / "Dallas"
  v_city  := btrim(split_part(v_q, ',', 1));
  v_state := nullif(upper(btrim(split_part(v_q, ',', 2))), '');
  if v_state is null and v_city ~* '\s+[A-Za-z]{2}$' then
    v_state := upper(right(v_city, 2));
    v_city  := btrim(left(v_city, length(v_city) - 2));
  end if;

  return query
    select distinct on (p.city, p.state)
      p.zip, p.city, p.state, (p.city || ', ' || p.state)::text
    from public.us_places p
    where lower(p.city) like lower(v_city) || '%'
      and (v_state is null or p.state = v_state::char(2))
    order by p.city, p.state, p.city_rank desc, p.zip
    limit p_limit;
end $$;

-- ------------------------------------------------------------
-- search_loads — the board query, server side.
--
-- v1 selected every open load and filtered in JavaScript. That is
-- fine at 8 loads and fatal at 8,000: the whole board crosses the
-- wire on each page view and deadhead cannot be indexed. Here the
-- radius test is a GiST index lookup and the client gets a page.
-- ------------------------------------------------------------
create or replace function public.search_loads(
  p_origin_zip     text    default null,
  p_origin_radius  int     default 150,
  p_dest_zip       text    default null,
  p_dest_radius    int     default 150,
  p_equipment      text[]  default null,
  p_min_rpm        numeric default null,
  p_min_miles      int     default null,
  p_max_miles      int     default null,
  p_max_deadhead   int     default null,
  p_from_geog      geography default null,   -- where the driver is now
  p_sort           text    default 'rpm',
  p_limit          int     default 50,
  p_offset         int     default 0
)
returns table (
  id uuid, ref text, stage smallint,
  origin_city text, origin_state char(2), origin_zip text,
  dest_city text, dest_state char(2), dest_zip text,
  miles int, rate numeric, rate_per_mile numeric,
  commodity text, weight_lb int, pieces int,
  len_in int, wid_in int, hgt_in int, cube_ft numeric,
  equipment_code text, equipment_label text,
  pickup_at timestamptz, deliver_by timestamptz,
  broker_org uuid, broker_name text,
  deadhead_mi int, created_at timestamptz, total_count bigint
)
language sql stable security definer set search_path = public, extensions as $$
  with origin as (select geog from public.us_places where zip = p_origin_zip),
       dest   as (select geog from public.us_places where zip = p_dest_zip),
       base as (
         select l.*,
                case when p_from_geog is null then null
                     else public.road_miles(p_from_geog, l.origin_geog) end as deadhead_mi
         from public.loads l
         where l.stage = 0
           and (p_origin_zip is null or ST_DWithin(
                 l.origin_geog, (select geog from origin), p_origin_radius * 1609.344))
           and (p_dest_zip   is null or ST_DWithin(
                 l.dest_geog,   (select geog from dest),   p_dest_radius   * 1609.344))
           and (p_equipment  is null or l.equipment_code = any(p_equipment))
           and (p_min_rpm    is null or l.rate_per_mile >= p_min_rpm)
           and (p_min_miles  is null or l.miles >= p_min_miles)
           and (p_max_miles  is null or l.miles <= p_max_miles)
       ),
       filtered as (
         select * from base
         where p_max_deadhead is null
            or (deadhead_mi is not null and deadhead_mi <= p_max_deadhead)
       )
  select f.id, f.ref, f.stage,
         o.city, o.state, o.zip,
         d.city, d.state, d.zip,
         f.miles, f.rate, f.rate_per_mile,
         f.commodity, f.weight_lb, f.pieces,
         f.len_in, f.wid_in, f.hgt_in, f.cube_ft,
         f.equipment_code, e.label,
         f.pickup_at, f.deliver_by,
         f.broker_org, b.legal_name,
         f.deadhead_mi, f.created_at,
         count(*) over () as total_count
  from filtered f
  join public.us_places o       on o.zip = f.origin_zip
  join public.us_places d       on d.zip = f.dest_zip
  join public.equipment_types e on e.code = f.equipment_code
  left join public.organizations b on b.id = f.broker_org
  order by
    case when p_sort = 'rpm'      then f.rate_per_mile end desc nulls last,
    case when p_sort = 'rate'     then f.rate          end desc nulls last,
    case when p_sort = 'deadhead' then f.deadhead_mi   end asc  nulls last,
    case when p_sort = 'miles'    then f.miles         end asc  nulls last,
    f.created_at desc
  limit greatest(1, least(p_limit, 200)) offset greatest(0, p_offset);
$$;

-- ------------------------------------------------------------
-- post_load
-- ------------------------------------------------------------
create or replace function public.post_load(
  p_origin_zip text, p_dest_zip text, p_commodity text,
  p_weight int, p_pieces int, p_len int, p_wid int, p_hgt int,
  p_equipment text, p_rate numeric,
  p_pickup timestamptz default null, p_deliver timestamptz default null,
  p_broker_org uuid default null
) returns public.loads
language plpgsql security definer set search_path = public as $$
declare
  v_org   uuid := public.my_org('shipper');
  v_miles int;
  v_cap   int;
  v_load  public.loads;
begin
  if v_org is null then
    raise exception 'Only a shipper account can post a load' using errcode = '42501';
  end if;
  if p_rate is null or p_rate <= 0 then
    raise exception 'Enter the rate you are offering' using errcode = '22023';
  end if;
  if p_weight is null or p_weight <= 0 then
    raise exception 'Enter the total weight' using errcode = '22023';
  end if;
  if p_pickup is not null and p_deliver is not null and p_pickup >= p_deliver then
    raise exception 'Delivery has to be after pickup' using errcode = '22023';
  end if;

  select capacity_lb into v_cap from public.equipment_types
   where code = p_equipment and is_active;
  if v_cap is null then
    raise exception 'Unknown equipment type %', p_equipment using errcode = '22023';
  end if;
  -- v1 would happily post 20,000 lb on a sprinter van
  if p_weight > v_cap then
    raise exception 'A % tops out at % lb', p_equipment, v_cap using errcode = '22023';
  end if;

  v_miles := public.zip_miles(p_origin_zip, p_dest_zip);
  if v_miles is null then
    raise exception 'We do not recognise one of those ZIP codes' using errcode = '22023';
  end if;
  if v_miles = 0 then
    raise exception 'Pickup and delivery are in the same place' using errcode = '22023';
  end if;

  insert into public.loads (
    shipper_org, broker_org, posted_by, miles, rate, commodity,
    weight_lb, pieces, len_in, wid_in, hgt_in, equipment_code,
    pickup_at, deliver_by, needs_liftgate,
    origin_zip, dest_zip
  ) values (
    v_org, p_broker_org, auth.uid(), v_miles, p_rate,
    coalesce(nullif(btrim(p_commodity), ''), 'General freight'),
    p_weight, coalesce(p_pieces, 1), coalesce(p_len, 48), coalesce(p_wid, 40), coalesce(p_hgt, 48),
    p_equipment, p_pickup, p_deliver,
    (select has_liftgate from public.equipment_types where code = p_equipment),
    p_origin_zip, p_dest_zip
  ) returning * into v_load;

  -- the itinerary is the normalised truth; the trigger syncs it back
  insert into public.load_stops (load_id, seq, kind, zip, window_start)
  values (v_load.id, 1, 'pickup', p_origin_zip, p_pickup),
         (v_load.id, 2, 'delivery', p_dest_zip, p_deliver);

  insert into public.load_events (load_id, actor_id, actor_org, from_stage, to_stage, event_type, note)
  values (v_load.id, auth.uid(), v_org, null, 0, 'posted',
          v_load.ref || ' posted — ' || v_miles || ' mi at $' || v_load.rate ||
          ' ($' || v_load.rate_per_mile || '/mi).');

  select * into v_load from public.loads where id = v_load.id;
  return v_load;
end $$;

-- ------------------------------------------------------------
-- book_load — atomic claim, with the checks v1 skipped
-- ------------------------------------------------------------
create or replace function public.book_load(p_load uuid)
returns public.loads
language plpgsql security definer set search_path = public as $$
declare
  v_org    uuid := public.my_org('carrier');
  v_status org_status;
  v_load   public.loads;
  v_equip  text;
  v_cap    int;
begin
  if v_org is null then
    raise exception 'Only a carrier account can book a load' using errcode = '42501';
  end if;

  select status into v_status from public.organizations where id = v_org;
  if v_status <> 'active' then
    raise exception 'Your carrier account is % — add your MC number before booking', v_status
      using errcode = '42501';
  end if;

  select l.equipment_code, e.capacity_lb into v_equip, v_cap
  from public.loads l join public.equipment_types e on e.code = l.equipment_code
  where l.id = p_load;
  if v_equip is null then
    raise exception 'Load not found' using errcode = 'P0002';
  end if;

  -- the claim: whoever gets the row first wins, the loser sees zero rows
  update public.loads
     set carrier_org = v_org,
         driver_id   = auth.uid(),
         stage       = 1,
         booked_at   = now(),
         miles_remaining = miles
   where id = p_load
     and stage = 0
     and carrier_org is null
  returning * into v_load;

  if v_load.id is null then
    raise exception 'That load has already been booked' using errcode = '55006';
  end if;

  insert into public.load_events (load_id, actor_id, actor_org, from_stage, to_stage, event_type, note)
  values (v_load.id, auth.uid(), v_org, 0, 1, 'booked',
          v_load.ref || ' booked by ' ||
          (select legal_name from public.organizations where id = v_org) ||
          ' at $' || v_load.rate || '.');

  update public.load_offers set status = 'declined'
   where load_id = p_load and status = 'open' and carrier_org <> v_org;

  return v_load;
end $$;

-- ------------------------------------------------------------
-- advance_load
--
-- Three v1 defects fixed: the read-then-write was racy and could
-- double-advance under two taps; the legal moves were a CASE in
-- the body rather than data; and a load could be marked delivered
-- with no proof of delivery on file.
-- ------------------------------------------------------------
create or replace function public.advance_load(p_load uuid, p_to_stage smallint default null)
returns public.loads
language plpgsql security definer set search_path = public as $$
declare
  v_load  public.loads;
  v_next  smallint;
  v_left  int;
  v_note  text;
  v_speed numeric := public.setting_num('avg_speed_mph', 50);
begin
  -- take the row lock first; concurrent callers queue here
  select * into v_load from public.loads where id = p_load for update;

  if v_load.id is null then
    raise exception 'Load not found' using errcode = 'P0002';
  end if;
  if v_load.driver_id is distinct from auth.uid() then
    raise exception 'That is not your load' using errcode = '42501';
  end if;

  v_next := coalesce(p_to_stage, (v_load.stage + 1)::smallint);

  if not exists (
    select 1 from public.load_stage_transitions
    where from_ordinal = v_load.stage and to_ordinal = v_next and actor = 'carrier'
  ) then
    raise exception 'Cannot move a load from % to %', v_load.stage, v_next using errcode = '22023';
  end if;

  -- proof of delivery is a database rule, not a checkbox
  if v_next = 6 and not public.load_has_document(p_load, 'pod') then
    raise exception 'Upload the signed POD before marking this delivered' using errcode = '22023';
  end if;

  v_left := case v_next
              when 2 then v_load.miles
              when 3 then v_load.miles
              when 4 then round(v_load.miles * 0.45)
              when 5 then 8
              else 0
            end;

  v_note := case v_next
              when 2 then ' — en route to pickup.'
              when 3 then ' — picked up, BOL on file.'
              when 4 then ' — in transit.'
              when 5 then ' — approaching destination.'
              when 6 then ' — delivered. POD distributed to shipper and broker.'
              when 8 then ' — truck ordered not used.'
              else ' — updated.'
            end;

  update public.loads
     set stage = v_next,
         miles_remaining = v_left,
         eta = case when v_next >= 6 then null
                    else now() + (v_left / v_speed) * interval '1 hour' end,
         delivered_at = case when v_next = 6 then now() else delivered_at end
   where id = p_load
  returning * into v_load;

  insert into public.load_events (load_id, actor_id, actor_org, from_stage, to_stage, event_type, note)
  values (v_load.id, auth.uid(), v_load.carrier_org, v_load.stage, v_next, 'stage_change',
          v_load.ref || v_note);

  -- delivery raises the invoice; broker_stats is measured from these
  if v_next = 6 then
    insert into public.invoices (load_id, payee_org, payer_org, number, amount, terms_days)
    values (v_load.id, v_load.carrier_org,
            coalesce(v_load.broker_org, v_load.shipper_org),
            'INV-' || v_load.ref, v_load.rate, 30)
    on conflict (number) do nothing;
  end if;

  return v_load;
end $$;

-- ------------------------------------------------------------
-- cancel_load — the transition v1 had no way to express
-- ------------------------------------------------------------
create or replace function public.cancel_load(p_load uuid, p_reason text default null)
returns public.loads
language plpgsql security definer set search_path = public as $$
declare
  v_load  public.loads;
  v_actor text;
begin
  select * into v_load from public.loads where id = p_load for update;
  if v_load.id is null then
    raise exception 'Load not found' using errcode = 'P0002';
  end if;

  v_actor := case
               when public.is_org_member(v_load.shipper_org) then 'shipper'
               when v_load.carrier_org is not null and public.is_org_member(v_load.carrier_org) then 'carrier'
               else null
             end;
  if v_actor is null then
    raise exception 'Not your load' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.load_stage_transitions
    where from_ordinal = v_load.stage and to_ordinal = 7 and actor = v_actor
  ) then
    raise exception 'A load at stage % can no longer be cancelled', v_load.stage using errcode = '22023';
  end if;

  update public.loads
     set stage = 7, cancelled_at = now(), cancel_reason = p_reason,
         carrier_org = null, driver_id = null, eta = null, miles_remaining = null
   where id = p_load
  returning * into v_load;

  insert into public.load_events (load_id, actor_id, actor_org, from_stage, to_stage, event_type, note)
  values (v_load.id, auth.uid(), public.my_org(), v_load.stage, 7, 'cancelled',
          v_load.ref || ' cancelled' || coalesce(' — ' || p_reason, '') || '.');

  return v_load;
end $$;

-- ------------------------------------------------------------
-- Offers
-- ------------------------------------------------------------
create or replace function public.make_offer(p_load uuid, p_amount numeric, p_note text default null)
returns public.load_offers
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.my_org('carrier');
  v_out public.load_offers;
begin
  if v_org is null then
    raise exception 'Only a carrier can make an offer' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter an amount' using errcode = '22023';
  end if;
  if not exists (select 1 from public.loads where id = p_load and stage = 0) then
    raise exception 'That load is no longer open' using errcode = '55006';
  end if;

  insert into public.load_offers (load_id, carrier_org, offered_by, amount, note)
  values (p_load, v_org, auth.uid(), p_amount, p_note)
  on conflict (load_id, carrier_org) where status = 'open'
  do update set amount = excluded.amount, note = excluded.note, updated_at = now()
  returning * into v_out;

  return v_out;
end $$;

create or replace function public.accept_offer(p_offer uuid)
returns public.loads
language plpgsql security definer set search_path = public as $$
declare
  v_offer public.load_offers;
  v_load  public.loads;
begin
  select * into v_offer from public.load_offers where id = p_offer for update;
  if v_offer.id is null then
    raise exception 'Offer not found' using errcode = 'P0002';
  end if;

  select * into v_load from public.loads where id = v_offer.load_id for update;
  if not (public.is_org_member(v_load.shipper_org)
          or (v_load.broker_org is not null and public.is_org_member(v_load.broker_org))) then
    raise exception 'Not your load' using errcode = '42501';
  end if;
  if v_load.stage <> 0 then
    raise exception 'That load is no longer open' using errcode = '55006';
  end if;

  update public.loads
     set rate = v_offer.amount, carrier_org = v_offer.carrier_org,
         driver_id = v_offer.offered_by, stage = 1, booked_at = now(),
         miles_remaining = miles
   where id = v_load.id
  returning * into v_load;

  update public.load_offers set status = 'accepted' where id = p_offer;
  update public.load_offers set status = 'declined'
   where load_id = v_load.id and id <> p_offer and status = 'open';

  insert into public.load_events (load_id, actor_id, actor_org, from_stage, to_stage, event_type, note)
  values (v_load.id, auth.uid(), public.my_org(), 0, 1, 'offer_accepted',
          v_load.ref || ' awarded at $' || v_offer.amount || '.');

  return v_load;
end $$;

-- ------------------------------------------------------------
-- Tracking and ETA
-- ------------------------------------------------------------
create or replace function public.record_ping(
  p_load uuid, p_lat double precision, p_lng double precision, p_speed numeric default null
) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_geog  geography := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
  v_load  public.loads;
  v_speed numeric := public.setting_num('avg_speed_mph', 50);
  v_left  int;
begin
  select * into v_load from public.loads where id = p_load;
  if v_load.driver_id is distinct from auth.uid() then
    raise exception 'Not your load' using errcode = '42501';
  end if;

  insert into public.load_tracking (load_id, driver_id, geog, speed_mph)
  values (p_load, auth.uid(), v_geog, p_speed);

  update public.driver_profiles
     set last_geog = v_geog, last_seen_at = now()
   where user_id = auth.uid();

  -- a measured ETA, not an assumed one
  v_left := public.road_miles(v_geog, v_load.dest_geog);
  update public.loads
     set miles_remaining = v_left,
         eta = now() + (v_left / greatest(coalesce(p_speed, v_speed), 5)) * interval '1 hour'
   where id = p_load and stage between 2 and 5;
end $$;

-- ------------------------------------------------------------
-- Messaging, scoped to a load
-- ------------------------------------------------------------
create or replace function public.send_message(p_body text, p_load uuid default null)
returns public.messages
language plpgsql security definer set search_path = public as $$
declare
  v_thread uuid;
  v_msg    public.messages;
begin
  if length(btrim(coalesce(p_body, ''))) = 0 then
    raise exception 'Message is empty' using errcode = '22023';
  end if;

  v_thread := public.ensure_thread(p_load);

  insert into public.messages (thread_id, sender_id, body)
  values (v_thread, auth.uid(), btrim(p_body))
  returning * into v_msg;

  update public.message_threads set last_message_at = now() where id = v_thread;
  return v_msg;
end $$;
