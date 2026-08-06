-- ============================================================
--  AI Logistics OS — functions
--  Every mutation goes through an RPC so the server owns the
--  numbers a client should not be trusted with (mileage, stage
--  transitions, who booked what).
-- ============================================================

-- Great-circle distance with a 1.15 road factor. Planning-grade, not routing-grade.
create or replace function public.road_miles(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
) returns int language sql immutable parallel safe as $$
  select round(
    3958.8 * 2 * asin(sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
    )) * 1.15
  )::int;
$$;

create or replace function public.zip_miles(a text, b text)
returns int language sql stable security definer set search_path = public as $$
  select public.road_miles(za.lat, za.lng, zb.lat, zb.lng)
  from public.zips za, public.zips zb
  where za.zip = a and zb.zip = b;
$$;

-- ------------------------------------------------------------
-- Profile bootstrap: signup metadata becomes the profile row.
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, full_name, company, mc_number, equipment, home_zip)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'role', ''), 'shipper')::user_role,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'company', ''),
    nullif(new.raw_user_meta_data ->> 'mc_number', ''),
    nullif(new.raw_user_meta_data ->> 'equipment', '')::equipment_type,
    nullif(new.raw_user_meta_data ->> 'home_zip', '')
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- Place autocomplete: ZIP prefix, or city prefix.
-- ------------------------------------------------------------
create or replace function public.search_places(q text)
returns table (zip text, city text, state text)
language sql stable security definer set search_path = public as $$
  select z.zip, z.city, z.state
  from public.zips z
  where case
    when btrim(q) ~ '^[0-9]+$' then z.zip like btrim(q) || '%'
    else lower(z.city) like lower(btrim(q)) || '%'
  end
  order by z.zip
  limit 8;
$$;

-- ------------------------------------------------------------
-- post_load: the server computes mileage from the two ZIPs so a
-- client cannot post a 50-mile run advertised as 500.
-- ------------------------------------------------------------
create or replace function public.post_load(
  p_origin_zip text,
  p_dest_zip   text,
  p_commodity  text,
  p_weight     int,
  p_pieces     int,
  p_len        int,
  p_wid        int,
  p_hgt        int,
  p_equipment  equipment_type,
  p_rate       numeric,
  p_pickup     timestamptz,
  p_deliver    timestamptz
) returns public.loads
language plpgsql security definer set search_path = public as $$
declare
  v_miles  int;
  v_broker uuid;
  v_load   public.loads;
begin
  if (select role from public.profiles where id = auth.uid()) is distinct from 'shipper' then
    raise exception 'Only a shipper account can post a load';
  end if;
  if p_rate is null or p_rate <= 0 then
    raise exception 'Enter the rate you are offering';
  end if;
  if p_weight is null or p_weight <= 0 then
    raise exception 'Enter the total weight';
  end if;

  v_miles := public.zip_miles(p_origin_zip, p_dest_zip);
  if v_miles is null then
    raise exception 'We do not recognise one of those ZIP codes';
  end if;
  if v_miles = 0 then
    raise exception 'Pickup and delivery are in the same place';
  end if;

  select id into v_broker from public.brokers order by random() limit 1;

  insert into public.loads (
    shipper_id, broker_id, origin_zip, dest_zip, miles, rate, commodity,
    weight_lb, pieces, len_in, wid_in, hgt_in, equipment, pickup_at, deliver_by
  ) values (
    auth.uid(), v_broker, p_origin_zip, p_dest_zip, v_miles, p_rate, coalesce(nullif(btrim(p_commodity), ''), 'General freight'),
    p_weight, coalesce(p_pieces, 1), coalesce(p_len, 48), coalesce(p_wid, 40), coalesce(p_hgt, 48),
    p_equipment, p_pickup, p_deliver
  ) returning * into v_load;

  insert into public.load_events (load_id, actor_id, stage, note)
  values (v_load.id, auth.uid(), 0,
          v_load.ref || ' posted — ' || v_miles || ' mi at $' || v_load.rate ||
          ' ($' || v_load.rate_per_mile || '/mi).');

  return v_load;
end $$;

-- ------------------------------------------------------------
-- book_load: atomic claim. The WHERE clause is the lock — two
-- drivers tapping at once, exactly one wins.
-- ------------------------------------------------------------
create or replace function public.book_load(p_load uuid)
returns public.loads
language plpgsql security definer set search_path = public as $$
declare
  v_load public.loads;
  v_me   public.profiles;
begin
  select * into v_me from public.profiles where id = auth.uid();
  if v_me.role is distinct from 'driver' then
    raise exception 'Only a driver account can book a load';
  end if;

  update public.loads
     set carrier_id = auth.uid(),
         stage = 1,
         booked_at = now(),
         miles_remaining = miles
   where id = p_load
     and stage = 0
     and carrier_id is null
  returning * into v_load;

  if v_load.id is null then
    raise exception 'That load has already been booked';
  end if;

  insert into public.load_events (load_id, actor_id, stage, note)
  values (v_load.id, auth.uid(), 1,
          v_load.ref || ' booked by ' || coalesce(nullif(v_me.company, ''), v_me.full_name) ||
          ' at $' || v_load.rate || '.');

  return v_load;
end $$;

-- ------------------------------------------------------------
-- advance_load: the stage machine lives here, not in the client.
-- ------------------------------------------------------------
create or replace function public.advance_load(p_load uuid)
returns public.loads
language plpgsql security definer set search_path = public as $$
declare
  v_load public.loads;
  v_next smallint;
  v_left int;
  v_note text;
begin
  select * into v_load from public.loads where id = p_load;
  if v_load.id is null then
    raise exception 'Load not found';
  end if;
  if v_load.carrier_id is distinct from auth.uid() then
    raise exception 'That is not your load';
  end if;
  if v_load.stage >= 6 then
    raise exception 'That load is already delivered';
  end if;

  v_next := v_load.stage + 1;
  v_left := case v_next
              when 2 then v_load.miles
              when 3 then v_load.miles
              when 4 then round(v_load.miles * 0.45)
              when 5 then 8
              else 0
            end;

  v_note := case v_next
              when 2 then ' — en route to pickup.'
              when 3 then ' — picked up, BOL uploaded.'
              when 4 then ' — in transit.'
              when 5 then ' — approaching destination.'
              else ' — delivered. POD distributed to shipper and broker.'
            end;

  update public.loads
     set stage = v_next,
         miles_remaining = v_left,
         eta = case when v_next = 6 then null
                    else now() + (v_left / 50.0) * interval '1 hour' end,
         delivered_at = case when v_next = 6 then now() else delivered_at end
   where id = p_load
  returning * into v_load;

  insert into public.load_events (load_id, actor_id, stage, note)
  values (v_load.id, auth.uid(), v_next, v_load.ref || v_note);

  return v_load;
end $$;

-- ------------------------------------------------------------
-- send_message + a stand-in dispatcher.
-- Replace auto_dispatch_reply with a real dispatcher account when
-- you have humans on the other end; the thread shape is unchanged.
-- ------------------------------------------------------------
create or replace function public.auto_dispatch_reply(p_body text, p_role user_role)
returns text language sql immutable as $$
  select case
    when p_body ~* '(eta|late|delay|traffic)' then
      'Understood — I have pushed the updated ETA to the receiver and the shipper.'
    when p_body ~* '(rate|pay|money|per mile|rpm|\$)' then
      case when p_role = 'driver'
           then 'I can go back to the broker on that. My floor on this lane is $2.60/mi.'
           else 'I will re-shop that lane this afternoon and send you two options, all-in.' end
    when p_body ~* '(detention|waiting|dock|door)' then
      'Start your detention clock and photograph the door assignment. Two free hours, then $65/hr.'
    when p_body ~* '(break ?down|repair|tire|engine)' then
      'Sit tight. I am sourcing a recovery carrier and notifying the shipper — send me your mile marker.'
    when p_body ~* '(pickup|pick up|bol|packet)' then
      'Pickup number and BOL are in the load packet — re-sent to your app just now.'
    when p_body ~* '(broker|reliab|credit|score)' then
      'Broker payment history sits in the reliability panel on each load, on the Premium tier.'
    else 'Copy that — logged. I will follow up if anything changes on my end.'
  end;
$$;

create or replace function public.send_message(p_body text)
returns setof public.messages
language plpgsql security definer set search_path = public as $$
declare
  v_role user_role;
  v_msg  public.messages;
begin
  if length(btrim(coalesce(p_body, ''))) = 0 then
    raise exception 'Message is empty';
  end if;
  select role into v_role from public.profiles where id = auth.uid();
  if v_role is null then
    raise exception 'No profile for this user';
  end if;

  insert into public.messages (owner_id, body, from_dispatch)
  values (auth.uid(), btrim(p_body), false)
  returning * into v_msg;
  return next v_msg;

  insert into public.messages (owner_id, body, from_dispatch)
  values (auth.uid(), public.auto_dispatch_reply(p_body, v_role), true)
  returning * into v_msg;
  return next v_msg;
end $$;

-- ------------------------------------------------------------
-- Premium. Flag-only: wire a payment provider's webhook to this
-- instead of calling it from the client when you take real money.
-- ------------------------------------------------------------
create or replace function public.set_premium(p_on boolean)
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare v_p public.profiles;
begin
  update public.profiles set is_premium = coalesce(p_on, false)
   where id = auth.uid() returning * into v_p;
  if v_p.id is null then raise exception 'No profile for this user'; end if;
  return v_p;
end $$;
