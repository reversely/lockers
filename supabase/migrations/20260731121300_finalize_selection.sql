-- Step 16. Turn the caller's live hold into a lease. A function body is one transaction, so the
-- lease insert, the request update, and the reservation delete either all land or none do.

create function public.finalize_selection()
returns public.leases
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_reservation public.reservations;
  v_days integer;
  v_lease public.leases;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  select * into v_reservation
    from public.reservations
   where user_id = v_user
     and expires_at > now()
     for update;

  if v_reservation.id is null then
    raise exception 'reservation expired';
  end if;

  select default_lease_days into v_days from public.settings limit 1;

  insert into public.leases (locker_id, user_id, request_id, start_date, end_date)
  values (
    v_reservation.locker_id,
    v_user,
    v_reservation.request_id,
    current_date,
    current_date + v_days
  )
  returning * into v_lease;

  update public.requests
     set status = 'fulfilled'
   where id = v_reservation.request_id;

  delete from public.reservations where id = v_reservation.id;

  return v_lease;
end;
$$;

revoke execute on function public.finalize_selection() from public;
grant execute on function public.finalize_selection() to authenticated;
