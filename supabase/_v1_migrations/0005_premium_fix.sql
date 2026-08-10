-- ============================================================
--  Close the premium hole
--
--  0002 granted EXECUTE on set_premium(boolean) to `authenticated`,
--  which meant any signed-in user could call it from the browser
--  console and unlock the paid tier for free. The column-level
--  grant on profiles blocked the direct UPDATE, and then this RPC
--  did the same write on their behalf.
--
--  Entitlement now moves only from the server side: a billing
--  webhook or an operator using the service role.
-- ============================================================

revoke execute on function public.set_premium(boolean) from authenticated, anon, public;

-- Grant premium to one account by email. service_role only — there is
-- no path to this from a browser session.
create or replace function public.admin_set_premium(p_email text, p_on boolean default true)
returns public.profiles
language plpgsql security definer set search_path = public, auth as $$
declare v_id uuid; v_out public.profiles;
begin
  select id into v_id from auth.users where lower(email) = lower(btrim(p_email));
  if v_id is null then
    raise exception 'No user with email %', p_email;
  end if;

  update public.profiles set is_premium = coalesce(p_on, false)
   where id = v_id returning * into v_out;

  if v_out.id is null then
    raise exception 'That user has no profile yet';
  end if;
  return v_out;
end $$;

revoke all on function public.admin_set_premium(text, boolean) from public, anon, authenticated;
grant execute on function public.admin_set_premium(text, boolean) to service_role;

-- To switch your own account on for testing, run this in the SQL editor
-- (it runs as the service role there):
--
--   select public.admin_set_premium('you@example.com', true);
