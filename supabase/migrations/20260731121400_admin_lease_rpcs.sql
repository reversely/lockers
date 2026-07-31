-- Step 17. The two lease actions only an admin may take. Both run as the definer, so the admin
-- check inside the function is the only thing standing between a caller and the write.

create function public.admin_end_lease(p_lease uuid)
returns public.leases
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lease public.leases;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  update public.leases
     set ended_at = now()
   where id = p_lease
     and ended_at is null
  returning * into v_lease;

  if v_lease.id is null then
    raise exception 'no active lease with that id';
  end if;

  return v_lease;
end;
$$;

-- Reassignment moves one tenancy to another locker and keeps its dates: the same term at a new
-- address. Restarting the term would be a different decision.
create function public.admin_reassign(p_lease uuid, p_locker uuid)
returns public.leases
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.leases;
  v_new public.leases;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  select * into v_old
    from public.leases
   where id = p_lease
     and ended_at is null
     for update;

  if v_old.id is null then
    raise exception 'no active lease with that id';
  end if;

  if not exists (select 1 from public.lockers where id = p_locker and is_active) then
    raise exception 'locker unavailable';
  end if;

  if exists (select 1 from public.leases where locker_id = p_locker and ended_at is null) then
    raise exception 'already leased';
  end if;

  -- An expired hold on the target blocks nothing and goes. A live one belongs to a user who is
  -- mid-selection, so the reassignment refuses rather than deleting it: step 26 gives the admin a
  -- force-release action to take that decision deliberately.
  delete from public.reservations where locker_id = p_locker and expires_at <= now();

  if exists (select 1 from public.reservations where locker_id = p_locker) then
    raise exception 'locker is reserved';
  end if;

  -- The old lease closes first. Both rows would otherwise be active for the same user and
  -- violate leases_one_active_per_user.
  update public.leases set ended_at = now() where id = v_old.id;

  insert into public.leases (locker_id, user_id, request_id, start_date, end_date, comments)
  values (p_locker, v_old.user_id, v_old.request_id, v_old.start_date, v_old.end_date, v_old.comments)
  returning * into v_new;

  return v_new;
end;
$$;

revoke execute on function public.admin_end_lease(uuid) from public;
revoke execute on function public.admin_reassign(uuid, uuid) from public;
grant execute on function public.admin_end_lease(uuid) to authenticated;
grant execute on function public.admin_reassign(uuid, uuid) to authenticated;
