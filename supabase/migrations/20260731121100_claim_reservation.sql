-- Step 14. Take a hold on one locker for the caller.
--
-- The unique indexes on reservations cover every row, expired or not, so expired holds are deleted
-- before anything is tested. Testing first would reject a locker whose hold ran out an hour ago.
--
-- Two callers racing for the same locker both pass the checks. One insert wins and the other
-- violates reservations_one_per_locker, which is caught here and returned as "already reserved".
-- The index is the arbiter, not the check.

create function public.claim_reservation(p_locker uuid)
returns public.reservations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_request uuid;
  v_minutes integer;
  v_reservation public.reservations;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  delete from public.reservations
   where expires_at <= now()
     and (user_id = v_user or locker_id = p_locker);

  select id into v_request
    from public.requests
   where user_id = v_user
     and status = 'approved'
   limit 1;

  if v_request is null then
    raise exception 'no approved request';
  end if;

  if exists (select 1 from public.leases where user_id = v_user and ended_at is null) then
    raise exception 'already holds a locker';
  end if;

  if exists (select 1 from public.reservations where user_id = v_user) then
    raise exception 'already holding a reservation';
  end if;

  if not exists (select 1 from public.lockers where id = p_locker and is_active) then
    raise exception 'locker unavailable';
  end if;

  if exists (select 1 from public.leases where locker_id = p_locker and ended_at is null) then
    raise exception 'already leased';
  end if;

  select reservation_minutes into v_minutes from public.settings limit 1;

  begin
    insert into public.reservations (locker_id, user_id, request_id, expires_at)
    values (p_locker, v_user, v_request, now() + make_interval(mins => v_minutes))
    returning * into v_reservation;
  exception when unique_violation then
    raise exception 'already reserved';
  end;

  return v_reservation;
end;
$$;

revoke execute on function public.claim_reservation(uuid) from public;
grant execute on function public.claim_reservation(uuid) to authenticated;
