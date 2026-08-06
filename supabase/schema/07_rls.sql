-- ============================================================
--  AI Logistics OS — 07 · row level security and grants
--
--  Default deny. Nothing is writable directly: every mutation
--  goes through a SECURITY DEFINER RPC that checks the rule
--  before it touches a row.
-- ============================================================

alter table public.organizations        enable row level security;
alter table public.profiles             enable row level security;
alter table public.org_members          enable row level security;
alter table public.driver_profiles      enable row level security;
alter table public.loads                enable row level security;
alter table public.load_stops           enable row level security;
alter table public.load_events          enable row level security;
alter table public.load_documents       enable row level security;
alter table public.load_tracking        enable row level security;
alter table public.load_offers          enable row level security;
alter table public.invoices             enable row level security;
alter table public.payments             enable row level security;
alter table public.subscriptions        enable row level security;
alter table public.saved_searches       enable row level security;
alter table public.notifications        enable row level security;
alter table public.message_threads      enable row level security;
alter table public.thread_participants  enable row level security;
alter table public.messages             enable row level security;
alter table public.us_places            enable row level security;
alter table public.equipment_types      enable row level security;
alter table public.load_stages          enable row level security;
alter table public.settings             enable row level security;

revoke all on all tables in schema public from anon, authenticated;

-- ------------------------------------------------------------
-- Reference data — readable by anyone signed in, written by nobody
-- ------------------------------------------------------------
grant select on public.us_places, public.equipment_types, public.load_stages to authenticated;

create policy ref_places_read on public.us_places
  for select to authenticated using (true);
create policy ref_equipment_read on public.equipment_types
  for select to authenticated using (true);
create policy ref_stages_read on public.load_stages
  for select to authenticated using (true);

-- settings stay server-side: they set pricing assumptions
-- (no grant, no policy — only SECURITY DEFINER functions read them)

-- ------------------------------------------------------------
-- Identity
-- ------------------------------------------------------------
grant select on public.profiles, public.organizations, public.org_members to authenticated;
grant select on public.driver_profiles to authenticated;

-- your own profile, plus anyone you share an organization or a load with
create policy profiles_read on public.profiles
  for select to authenticated using (
    id = (select auth.uid())
    or exists (
      select 1 from public.org_members a
      join public.org_members b on b.org_id = a.org_id
      where a.user_id = (select auth.uid()) and b.user_id = public.profiles.id
    )
  );

grant update (full_name, phone, avatar_url) on public.profiles to authenticated;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Counterparties are visible: you are transacting with them.
create policy organizations_read on public.organizations
  for select to authenticated using (true);

grant update (legal_name, dba, phone, billing_email, address_zip) on public.organizations to authenticated;
create policy organizations_update_own on public.organizations
  for update to authenticated
  using (public.has_org_role(id, array['owner']::member_role[]))
  with check (public.has_org_role(id, array['owner']::member_role[]));

create policy org_members_read on public.org_members
  for select to authenticated using (org_id in (select public.my_org_ids()));

grant update (equipment_code, home_zip, cdl_number, cdl_expires_on) on public.driver_profiles to authenticated;
create policy driver_profiles_read on public.driver_profiles
  for select to authenticated using (
    user_id = (select auth.uid()) or public.is_org_member(org_id)
  );
create policy driver_profiles_update_own on public.driver_profiles
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ------------------------------------------------------------
-- Loads
--
-- Open loads are the public board. Everything else is scoped to
-- the organizations on the load. No INSERT or UPDATE grant at all:
-- post_load / book_load / advance_load / cancel_load own writes.
-- ------------------------------------------------------------
grant select on public.loads to authenticated;
grant select on public.v_loads, public.v_my_loads, public.v_load_activity to authenticated;
grant select on public.v_brokers, public.v_me, public.v_my_threads to authenticated;

create policy loads_read on public.loads
  for select to authenticated using (
    stage = 0
    or shipper_org in (select public.my_org_ids())
    or carrier_org in (select public.my_org_ids())
    or broker_org  in (select public.my_org_ids())
    or driver_id = (select auth.uid())
  );

grant select on public.load_stops to authenticated;
create policy load_stops_read on public.load_stops
  for select to authenticated using (
    exists (select 1 from public.loads l where l.id = load_id)
  );

grant select on public.load_events to authenticated;
create policy load_events_read on public.load_events
  for select to authenticated using (
    exists (select 1 from public.loads l where l.id = load_id)
  );

-- Documents: only the parties, never the open board. A POD carries
-- a signature and a delivery address.
grant select, insert on public.load_documents to authenticated;
create policy load_documents_read on public.load_documents
  for select to authenticated using (
    exists (
      select 1 from public.loads l
      where l.id = load_id
        and (l.shipper_org in (select public.my_org_ids())
          or l.carrier_org in (select public.my_org_ids())
          or l.broker_org  in (select public.my_org_ids()))
    )
  );
create policy load_documents_insert on public.load_documents
  for insert to authenticated with check (
    uploaded_by = (select auth.uid())
    and exists (
      select 1 from public.loads l
      where l.id = load_id
        and (l.carrier_org in (select public.my_org_ids())
          or l.shipper_org in (select public.my_org_ids()))
    )
  );

grant select on public.load_tracking to authenticated;
create policy load_tracking_read on public.load_tracking
  for select to authenticated using (
    exists (
      select 1 from public.loads l
      where l.id = load_id
        and (l.shipper_org in (select public.my_org_ids())
          or l.carrier_org in (select public.my_org_ids())
          or l.broker_org  in (select public.my_org_ids()))
    )
  );

-- ------------------------------------------------------------
-- Offers — a carrier sees only its own bid; the load's owner sees all
-- ------------------------------------------------------------
grant select on public.load_offers to authenticated;
create policy load_offers_read on public.load_offers
  for select to authenticated using (
    carrier_org in (select public.my_org_ids())
    or exists (
      select 1 from public.loads l
      where l.id = load_id
        and (l.shipper_org in (select public.my_org_ids())
          or l.broker_org  in (select public.my_org_ids()))
    )
  );

-- ------------------------------------------------------------
-- Money — both sides of an invoice can read it, nobody can write it
-- ------------------------------------------------------------
grant select on public.invoices to authenticated;
create policy invoices_read on public.invoices
  for select to authenticated using (
    payee_org in (select public.my_org_ids()) or payer_org in (select public.my_org_ids())
  );

grant select on public.payments to authenticated;
create policy payments_read on public.payments
  for select to authenticated using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_id
        and (i.payee_org in (select public.my_org_ids())
          or i.payer_org in (select public.my_org_ids()))
    )
  );

/* broker_stats carries competitors' payment behaviour. authenticated
   gets no rights to it at all — v_brokers is SECURITY DEFINER and is
   the only way in, and it returns the columns only to subscribers. */
revoke all on public.broker_stats from anon, authenticated;

/* Subscriptions are readable so the UI can show the current plan, but
   there is no INSERT or UPDATE grant and no set_premium() RPC. v1
   exposed exactly such a function to every signed-in user, which made
   the paid tier free to anyone who opened the network tab. Entitlement
   is written by the billing webhook using the service role. */
grant select on public.subscriptions to authenticated;
create policy subscriptions_read on public.subscriptions
  for select to authenticated using (org_id in (select public.my_org_ids()));

-- ------------------------------------------------------------
-- Saved searches and notifications — personal
-- ------------------------------------------------------------
grant select, insert, update, delete on public.saved_searches to authenticated;
create policy saved_searches_own on public.saved_searches
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, update (read_at) on public.notifications to authenticated;
create policy notifications_own on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_mark_read on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ------------------------------------------------------------
-- Messaging — participation is the permission
-- ------------------------------------------------------------
grant select on public.message_threads, public.thread_participants, public.messages to authenticated;

create policy threads_read on public.message_threads
  for select to authenticated using (
    exists (
      select 1 from public.thread_participants p
      where p.thread_id = id and p.user_id = (select auth.uid())
    )
  );

create policy participants_read on public.thread_participants
  for select to authenticated using (
    thread_id in (
      select p.thread_id from public.thread_participants p where p.user_id = (select auth.uid())
    )
  );

grant update (read_at) on public.thread_participants to authenticated;
create policy participants_mark_read on public.thread_participants
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy messages_read on public.messages
  for select to authenticated using (
    exists (
      select 1 from public.thread_participants p
      where p.thread_id = messages.thread_id and p.user_id = (select auth.uid())
    )
  );

-- ------------------------------------------------------------
-- RPC surface. Default EXECUTE on a new function is PUBLIC, so
-- every one has to be revoked and re-granted deliberately.
-- ------------------------------------------------------------
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

grant execute on function
  public.search_places(text, int),
  public.search_loads(text, int, text, int, text[], numeric, int, int, int, geography, text, int, int),
  public.post_load(text, text, text, int, int, int, int, int, text, numeric, timestamptz, timestamptz, uuid),
  public.book_load(uuid),
  public.advance_load(uuid, smallint),
  public.cancel_load(uuid, text),
  public.make_offer(uuid, numeric, text),
  public.accept_offer(uuid),
  public.record_ping(uuid, double precision, double precision, numeric),
  public.send_message(text, uuid),
  public.ensure_thread(uuid),
  public.mark_thread_read(uuid),
  public.my_unread_count(),
  public.zip_miles(text, text),
  public.i_am_premium(),
  public.my_portal(),
  public.my_org(org_kind),
  public.my_org_ids(),
  public.is_org_member(uuid),
  public.has_org_role(uuid, member_role[])
to authenticated;

-- ------------------------------------------------------------
-- Realtime
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['loads', 'load_events', 'messages', 'load_offers', 'notifications'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
