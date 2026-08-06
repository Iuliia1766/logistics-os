-- ============================================================
--  AI Logistics OS — row level security
--  Default deny. Every table is locked, then opened deliberately.
-- ============================================================

alter table public.profiles    enable row level security;
alter table public.loads       enable row level security;
alter table public.load_events enable row level security;
alter table public.messages    enable row level security;
alter table public.brokers     enable row level security;
alter table public.zips        enable row level security;

revoke all on public.profiles, public.loads, public.load_events,
              public.messages, public.brokers, public.zips
  from anon, authenticated;

-- ------------------------------------------------------------
-- profiles — yours and only yours
-- ------------------------------------------------------------
grant select on public.profiles to authenticated;

-- Column-level UPDATE grant, deliberately narrow. `role` and `is_premium` are
-- absent, so a user cannot PATCH themselves into the other portal or into a paid
-- tier — is_premium moves only through set_premium(), which a payment webhook owns.
grant update (full_name, company, mc_number, equipment, home_zip)
  on public.profiles to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ------------------------------------------------------------
-- zips — reference data, readable by any signed-in user
-- ------------------------------------------------------------
grant select on public.zips to authenticated;
create policy zips_read on public.zips
  for select to authenticated using (true);

-- ------------------------------------------------------------
-- brokers — the name is free, the reliability columns are not.
-- Column-level GRANT is what enforces it: a free account cannot
-- select reliability_score at all. v_brokers (security definer)
-- hands those columns back only when is_premium is true.
-- ------------------------------------------------------------
grant select (id, company, rep_name) on public.brokers to authenticated;
grant select on public.v_brokers to authenticated;
create policy brokers_read_basic on public.brokers
  for select to authenticated using (true);

-- ------------------------------------------------------------
-- loads — the board is public to signed-in users; everything
-- else is scoped to the shipper who posted it or the driver
-- who booked it.
-- ------------------------------------------------------------
grant select on public.loads to authenticated;
grant select on public.v_loads to authenticated;

create policy loads_select_open_or_mine on public.loads
  for select to authenticated using (
    stage = 0
    or shipper_id = (select auth.uid())
    or carrier_id = (select auth.uid())
  );

-- Writes go through post_load / book_load / advance_load. The only direct
-- write a client gets is a shipper cancelling a load nobody has booked.
grant delete on public.loads to authenticated;
create policy loads_delete_own_unbooked on public.loads
  for delete to authenticated
  using (shipper_id = (select auth.uid()) and stage = 0);

-- ------------------------------------------------------------
-- load_events — visible if you can see the load it belongs to
-- ------------------------------------------------------------
grant select on public.load_events to authenticated;
create policy load_events_read on public.load_events
  for select to authenticated using (
    exists (
      select 1 from public.loads l
      where l.id = load_events.load_id
        and (l.stage = 0
             or l.shipper_id = (select auth.uid())
             or l.carrier_id = (select auth.uid()))
    )
  );

-- ------------------------------------------------------------
-- messages — your dispatch thread only. Inserts go through
-- send_message() so the reply is written server-side.
-- ------------------------------------------------------------
grant select on public.messages to authenticated;
create policy messages_read_own on public.messages
  for select to authenticated using (owner_id = (select auth.uid()));

-- ------------------------------------------------------------
-- RPCs
-- ------------------------------------------------------------
revoke all on function public.post_load(text, text, text, int, int, int, int, int, equipment_type, numeric, timestamptz, timestamptz) from public;
revoke all on function public.book_load(uuid)      from public;
revoke all on function public.advance_load(uuid)   from public;
revoke all on function public.send_message(text)   from public;
revoke all on function public.set_premium(boolean) from public;
revoke all on function public.search_places(text)  from public;
revoke all on function public.zip_miles(text, text) from public;

grant execute on function public.post_load(text, text, text, int, int, int, int, int, equipment_type, numeric, timestamptz, timestamptz) to authenticated;
grant execute on function public.book_load(uuid)       to authenticated;
grant execute on function public.advance_load(uuid)    to authenticated;
grant execute on function public.send_message(text)    to authenticated;
grant execute on function public.set_premium(boolean)  to authenticated;
grant execute on function public.search_places(text)   to authenticated;
grant execute on function public.zip_miles(text, text) to authenticated;

-- ------------------------------------------------------------
-- Realtime: both portals watch the same ledger
-- ------------------------------------------------------------
-- Idempotent: adding a table twice is an error, and this file should be re-runnable.
do $$
declare t text;
begin
  foreach t in array array['loads', 'messages', 'load_events'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
