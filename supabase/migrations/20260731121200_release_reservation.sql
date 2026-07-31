-- Step 15. The Cancel button. A caller can only ever delete their own hold, since the where clause
-- names them and the table holds at most one row per user.

create function public.release_reservation()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  delete from public.reservations where user_id = v_user;
end;
$$;

revoke execute on function public.release_reservation() from public;
grant execute on function public.release_reservation() to authenticated;
