-- ============================================================
--  AI Logistics OS — 08 · seed
--
--  Run AFTER loading supabase/seed/zips.csv into zip_import.
--  See supabase/schema/README.md for the two-step ZIP load.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Geography. zips.csv arrives as flat lat/lng; build the
--    geography point and the city_rank that orders autocomplete.
-- ------------------------------------------------------------
create table if not exists public.zip_import (
  zip text, city text, state text, lat double precision, lng double precision
);

insert into public.us_places (zip, city, state, lat, lng, geog)
select z.zip, z.city, z.state, z.lat, z.lng,
       extensions.ST_SetSRID(extensions.ST_MakePoint(z.lng, z.lat), 4326)::geography
from public.zip_import z
where z.zip ~ '^\d{5}$'
on conflict (zip) do nothing;

-- Bigger cities have more ZIPs; that is a good enough proxy for
-- "did they mean Dallas, TX or Dallas, GA" without a census table.
update public.us_places p
   set city_rank = c.n
  from (select city, state, count(*)::int n from public.us_places group by city, state) c
 where p.city = c.city and p.state = c.state;

drop table if exists public.zip_import;

-- ------------------------------------------------------------
-- 2. Brokers, as organizations
-- ------------------------------------------------------------
insert into public.organizations (kind, legal_name, mc_number, status, created_at) values
  ('broker', 'Meridian Freight Group',  'MC 552104', 'active', '2014-03-01'),
  ('broker', 'Trinity Bay Brokerage',   'MC 318870', 'active', '2009-06-15'),
  ('broker', 'Southstar Load Partners', 'MC 701223', 'active', '2017-01-20'),
  ('broker', 'Alamo Transit Group',     'MC 884516', 'active', '2019-09-04'),
  ('broker', 'Gulfline Brokerage',      'MC 912330', 'active', '2020-11-11'),
  ('broker', 'Crosswind Logistics',     'MC 990412', 'active', '2021-05-27'),
  ('broker', 'HighPlains Freight',      'MC 104778', 'active', '2023-02-08')
on conflict (mc_number) do nothing;

-- ------------------------------------------------------------
-- 3. Reliability has to be earned, so synthesise a payment
--    history rather than typing scores in. Delete this block for
--    a clean production install — real invoices will populate
--    broker_stats on their own.
-- ------------------------------------------------------------
do $$
declare
  b record;
  v_shipper uuid;
  v_carrier uuid;
  v_load    uuid;
  v_inv     uuid;
  i int;
  -- (broker, invoices, on-time share, typical days to pay, dispute share)
  v_profile jsonb := '{
    "Meridian Freight Group":  [60, 0.97, 21, 0.012],
    "Trinity Bay Brokerage":   [90, 0.98, 15, 0.006],
    "Southstar Load Partners": [45, 0.92, 27, 0.028],
    "Alamo Transit Group":     [35, 0.89, 30, 0.035],
    "Gulfline Brokerage":      [28, 0.85, 34, 0.041],
    "Crosswind Logistics":     [22, 0.78, 41, 0.064],
    "HighPlains Freight":      [14, 0.64, 58, 0.113]
  }'::jsonb;
  p jsonb;
begin
  insert into public.organizations (kind, legal_name, status)
  values ('shipper', 'Seed Shipper Co.', 'active') returning id into v_shipper;
  insert into public.organizations (kind, legal_name, mc_number, status)
  values ('carrier', 'Seed Carrier LLC', 'MC 000001', 'active') returning id into v_carrier;

  for b in select id, legal_name from public.organizations where kind = 'broker' loop
    p := v_profile -> b.legal_name;
    continue when p is null;

    for i in 1..(p ->> 0)::int loop
      -- posted_by stays null: these are historical fixtures, not
      -- something a person in this database typed in
      insert into public.loads (
        shipper_org, broker_org, carrier_org,
        origin_zip, dest_zip, miles, rate, commodity, weight_lb,
        equipment_code, stage, booked_at, delivered_at
      ) values (
        v_shipper, b.id, v_carrier,
        '75201', '38103', 483, 1400, 'Seed freight', 3000,
        'box_16', 6, now() - (i || ' days')::interval, now() - (i || ' days')::interval
      )
      returning id into v_load;

      insert into public.load_stops (load_id, seq, kind, zip)
      values (v_load, 1, 'pickup', '75201'), (v_load, 2, 'delivery', '38103');

      insert into public.invoices (load_id, payee_org, payer_org, number, amount, terms_days, issued_on, status)
      values (v_load, v_carrier, b.id, 'SEED-' || b.id || '-' || i, 1400, 30,
              (current_date - (i * 3))::date,
              case when random() < (p ->> 3)::numeric then 'disputed' else 'sent' end)
      returning id into v_inv;

      -- pay it, on time or late according to the broker's habit
      if (select status from public.invoices where id = v_inv) <> 'disputed' then
        insert into public.payments (invoice_id, amount, paid_on)
        values (v_inv, 1400,
                (current_date - (i * 3) +
                 case when random() < (p ->> 1)::numeric
                      then least((p ->> 2)::int, 30)
                      else (p ->> 2)::int + 15 end)::date);
      end if;
    end loop;
  end loop;
end $$;

refresh materialized view public.broker_stats;
