-- ============================================================
--  AI Logistics OS — profile self-service
--
--  Registration creates the profile from signup metadata via the
--  on_auth_user_created trigger. Two things were still missing:
--  a way to edit it afterwards, and a way to recover if the
--  trigger ever failed and left an auth user with no profile row.
--
--  Both go through one RPC rather than widening table grants,
--  because `role` and `is_premium` must stay out of reach: role
--  decides which portal you get, is_premium is the paid tier.
-- ============================================================

create or replace function public.upsert_my_profile(
  p_full_name text,
  p_company   text default null,
  p_mc_number text default null,
  p_equipment text default null,
  p_home_zip  text default null,
  p_role      text default null      -- honoured only when creating
) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  v_existing public.profiles;
  v_role     user_role;
  v_equip    equipment_type;
  v_zip      text;
  v_out      public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_full_name, ''))) = 0 then
    raise exception 'Enter your name' using errcode = '22023';
  end if;

  -- an unrecognised equipment code or ZIP is dropped rather than
  -- raised, so one bad field never blocks saving the rest
  begin
    v_equip := nullif(btrim(coalesce(p_equipment, '')), '')::equipment_type;
  exception when others then
    v_equip := null;
  end;

  v_zip := (select zip from public.zips
             where zip = nullif(btrim(coalesce(p_home_zip, '')), ''));
  if p_home_zip is not null and btrim(p_home_zip) <> '' and v_zip is null then
    raise exception 'We do not recognise ZIP %', p_home_zip using errcode = '22023';
  end if;

  select * into v_existing from public.profiles where id = auth.uid();

  if v_existing.id is null then
    -- first time through: this is the recovery path
    v_role := case lower(coalesce(p_role, 'shipper'))
                when 'driver'  then 'driver'
                when 'carrier' then 'driver'
                else 'shipper'
              end::user_role;

    insert into public.profiles (id, role, full_name, company, mc_number, equipment, home_zip)
    values (auth.uid(), v_role, btrim(p_full_name),
            coalesce(btrim(p_company), ''), nullif(btrim(coalesce(p_mc_number, '')), ''),
            case when v_role = 'driver' then v_equip end,
            case when v_role = 'driver' then v_zip end)
    returning * into v_out;
    return v_out;
  end if;

  -- editing: role and is_premium are deliberately not assignable here
  update public.profiles
     set full_name = btrim(p_full_name),
         company   = coalesce(btrim(p_company), company),
         mc_number = nullif(btrim(coalesce(p_mc_number, '')), ''),
         equipment = case when role = 'driver' then coalesce(v_equip, equipment) else null end,
         home_zip  = case when role = 'driver' then coalesce(v_zip, home_zip) else null end
   where id = auth.uid()
  returning * into v_out;

  return v_out;
end $$;

revoke all on function public.upsert_my_profile(text, text, text, text, text, text) from public;
grant execute on function public.upsert_my_profile(text, text, text, text, text, text) to authenticated;
