-- ============================================================
--  AI Logistics OS — 06 · views
--
--  Two rules run through this file:
--    security_invoker = true  → RLS on the base table decides rows
--    SECURITY DEFINER (default) → used only where the view is
--                                 itself the access control
-- ============================================================

-- ------------------------------------------------------------
-- v_loads — the flat shape the app reads.
-- Row visibility comes from RLS on public.loads.
-- ------------------------------------------------------------
create view public.v_loads with (security_invoker = true) as
select
  l.id, l.ref, l.stage, s.code as stage_code, s.label as stage_label,
  l.miles, l.rate, l.rate_per_mile, l.currency,
  l.commodity, l.weight_lb, l.pieces, l.len_in, l.wid_in, l.hgt_in, l.cube_ft,
  l.equipment_code, e.label as equipment_label, e.capacity_lb,
  l.is_hazmat, l.needs_liftgate,
  l.pickup_at, l.pickup_by, l.deliver_at, l.deliver_by,
  l.eta, l.miles_remaining, l.booked_at, l.delivered_at, l.cancelled_at,
  l.created_at, l.updated_at, l.stop_count,

  l.origin_zip, o.city as origin_city, o.state as origin_state,
  o.lat as origin_lat, o.lng as origin_lng,
  l.dest_zip,   d.city as dest_city,   d.state as dest_state,
  d.lat as dest_lat, d.lng as dest_lng,

  l.shipper_org, sh.legal_name as shipper_company,
  l.broker_org,  br.legal_name as broker_company,
  l.carrier_org, ca.legal_name as carrier_company,
  l.driver_id,   dp.full_name  as driver_name,
  l.posted_by
from public.loads l
join public.load_stages s      on s.ordinal = l.stage
join public.equipment_types e  on e.code = l.equipment_code
left join public.us_places o   on o.zip = l.origin_zip
left join public.us_places d   on d.zip = l.dest_zip
left join public.organizations sh on sh.id = l.shipper_org
left join public.organizations br on br.id = l.broker_org
left join public.organizations ca on ca.id = l.carrier_org
left join public.profiles dp      on dp.id = l.driver_id;

-- ------------------------------------------------------------
-- v_brokers — the premium gate.
--
-- SECURITY DEFINER on purpose: the view reads broker_stats, which
-- authenticated has no rights to, and hands back the numbers only
-- when the caller's organization holds a live subscription. The
-- name and contact are free; the payment history is not.
-- ------------------------------------------------------------
create view public.v_brokers as
select
  o.id,
  o.legal_name  as company,
  o.dba,
  o.mc_number,
  public.i_am_premium() as unlocked,
  case when public.i_am_premium() then
    public.broker_score(bs.on_time_pct, bs.avg_days_to_pay, bs.dispute_pct, bs.loads_posted)
  end as reliability_score,
  case when public.i_am_premium() then bs.on_time_pct      end as on_time_pct,
  case when public.i_am_premium() then bs.avg_days_to_pay  end as avg_days_to_pay,
  case when public.i_am_premium() then bs.dispute_pct      end as dispute_pct,
  case when public.i_am_premium() then bs.loads_posted     end as loads_posted,
  case when public.i_am_premium() then bs.member_since     end as member_since,
  case when public.i_am_premium() then bs.invoices_total   end as invoices_total,
  case when public.i_am_premium() then bs.last_settled_on  end as last_settled_on
from public.organizations o
left join public.broker_stats bs on bs.org_id = o.id
where o.kind = 'broker';

-- ------------------------------------------------------------
-- v_my_loads — what a carrier is currently running
-- ------------------------------------------------------------
create view public.v_my_loads with (security_invoker = true) as
select v.*,
       (select count(*) from public.load_documents dd
         where dd.load_id = v.id and dd.kind = 'pod') > 0 as has_pod,
       (select count(*) from public.load_documents dd
         where dd.load_id = v.id and dd.kind = 'bol') > 0 as has_bol
from public.v_loads v
where v.driver_id = auth.uid()
   or (v.carrier_org is not null and public.is_org_member(v.carrier_org));

-- ------------------------------------------------------------
-- v_load_activity — the shared ledger feed
-- ------------------------------------------------------------
create view public.v_load_activity with (security_invoker = true) as
select
  ev.id, ev.load_id, l.ref, ev.event_type, ev.note,
  ev.from_stage, ev.to_stage, ev.created_at,
  p.full_name as actor_name, org.legal_name as actor_company
from public.load_events ev
join public.loads l          on l.id = ev.load_id
left join public.profiles p  on p.id = ev.actor_id
left join public.organizations org on org.id = ev.actor_org;

-- ------------------------------------------------------------
-- v_my_threads — inbox with unread counts
-- ------------------------------------------------------------
create view public.v_my_threads with (security_invoker = true) as
select
  t.id, t.kind, t.load_id, l.ref as load_ref, t.subject, t.last_message_at,
  (select count(*) from public.messages m
    where m.thread_id = t.id
      and m.sender_id is distinct from auth.uid()
      and (p.read_at is null or m.created_at > p.read_at)) as unread_count,
  (select m.body from public.messages m
    where m.thread_id = t.id order by m.created_at desc limit 1) as last_body
from public.message_threads t
join public.thread_participants p on p.thread_id = t.id and p.user_id = auth.uid()
left join public.loads l on l.id = t.load_id;

-- ------------------------------------------------------------
-- v_me — one round trip for everything the shell needs
-- ------------------------------------------------------------
create view public.v_me as
select
  p.id, p.full_name, p.phone, p.avatar_url,
  o.id as org_id, o.kind as org_kind, o.legal_name as company,
  o.mc_number, o.status as org_status,
  public.my_portal() as portal,
  public.i_am_premium() as is_premium,
  dp.equipment_code, dp.home_zip,
  up.city as home_city, up.state as home_state
from public.profiles p
left join public.org_members m   on m.user_id = p.id and m.is_default
left join public.organizations o on o.id = m.org_id
left join public.driver_profiles dp on dp.user_id = p.id
left join public.us_places up on up.zip = dp.home_zip
where p.id = auth.uid();
