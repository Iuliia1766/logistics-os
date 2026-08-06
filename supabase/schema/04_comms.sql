-- ============================================================
--  AI Logistics OS — 04 · messaging
--
--  v1 had a flat messages table keyed by owner_id with a
--  from_dispatch boolean. That models exactly one conversation
--  with exactly one counterparty and cannot express the thing
--  dispatch actually does: talk to the driver and the shipper
--  about a specific load, with everyone seeing the same history.
-- ============================================================

create type thread_kind as enum ('load', 'support');

create table public.message_threads (
  id              uuid primary key default gen_random_uuid(),
  kind            thread_kind not null default 'load',
  load_id         uuid references public.loads(id) on delete cascade,
  subject         text,
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),

  -- a load thread must name its load; a support thread must not
  constraint thread_load_matches_kind
    check ((kind = 'load') = (load_id is not null))
);

-- one load thread per load
create unique index message_threads_one_per_load
  on public.message_threads (load_id) where kind = 'load';

create index message_threads_recent_idx on public.message_threads (last_message_at desc);

create table public.thread_participants (
  thread_id  uuid not null references public.message_threads(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  org_id     uuid references public.organizations(id) on delete set null,
  read_at    timestamptz,
  created_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

create index thread_participants_user_idx on public.thread_participants (user_id);

create table public.messages (
  id         bigint generated always as identity primary key,
  thread_id  uuid not null references public.message_threads(id) on delete cascade,
  sender_id  uuid references public.profiles(id) on delete set null,  -- null = system
  body       text not null check (length(btrim(body)) > 0),
  is_system  boolean not null default false,
  created_at timestamptz not null default now()
);

create index messages_thread_idx on public.messages (thread_id, created_at);

-- Messages are a record of what was said. Editing one rewrites history
-- that a detention or damage claim may later depend on.
create trigger messages_immutable
  before update or delete on public.messages
  for each row execute function public.forbid_mutation();

-- ------------------------------------------------------------
-- ensure_thread — find or create the conversation, and make sure
-- everyone with a stake in the load is in it.
-- ------------------------------------------------------------
create or replace function public.ensure_thread(p_load uuid default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_thread uuid;
  v_load   public.loads;
begin
  if p_load is null then
    -- personal support thread, one per user
    select t.id into v_thread
    from public.message_threads t
    join public.thread_participants p on p.thread_id = t.id
    where t.kind = 'support' and p.user_id = auth.uid()
    limit 1;

    if v_thread is null then
      insert into public.message_threads (kind, subject) values ('support', 'Dispatch')
      returning id into v_thread;
      insert into public.thread_participants (thread_id, user_id, org_id)
      values (v_thread, auth.uid(), public.my_org());
    end if;
    return v_thread;
  end if;

  select * into v_load from public.loads where id = p_load;
  if v_load.id is null then
    raise exception 'Load not found' using errcode = 'P0002';
  end if;
  if not (public.is_org_member(v_load.shipper_org)
          or (v_load.carrier_org is not null and public.is_org_member(v_load.carrier_org))
          or (v_load.broker_org  is not null and public.is_org_member(v_load.broker_org))) then
    raise exception 'Not your load' using errcode = '42501';
  end if;

  select id into v_thread from public.message_threads where load_id = p_load;
  if v_thread is null then
    insert into public.message_threads (kind, load_id, subject)
    values ('load', p_load, v_load.ref)
    returning id into v_thread;
  end if;

  -- everyone on the load belongs in the thread
  insert into public.thread_participants (thread_id, user_id, org_id)
  select v_thread, m.user_id, m.org_id
  from public.org_members m
  where m.org_id in (v_load.shipper_org, v_load.carrier_org, v_load.broker_org)
    and m.org_id is not null
  on conflict (thread_id, user_id) do nothing;

  return v_thread;
end $$;

create or replace function public.mark_thread_read(p_thread uuid)
returns void language sql security definer set search_path = public as $$
  update public.thread_participants set read_at = now()
   where thread_id = p_thread and user_id = auth.uid();
$$;

create or replace function public.my_unread_count()
returns bigint language sql stable security definer set search_path = public as $$
  select count(*)
  from public.messages m
  join public.thread_participants p
    on p.thread_id = m.thread_id and p.user_id = auth.uid()
  where m.sender_id is distinct from auth.uid()
    and (p.read_at is null or m.created_at > p.read_at);
$$;
