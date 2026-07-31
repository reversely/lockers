-- Step 20, the requests side. A user files their own request and reads it back. An admin reads
-- every request and is the only one who moves its status.
--
-- The insert check pins both the owner and the starting status, so a user cannot file a request
-- that is already approved.

alter table public.requests enable row level security;

grant select, insert on public.requests to authenticated;
grant update on public.requests to authenticated;

create policy requests_select on public.requests
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

create policy requests_insert_own on public.requests
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending');

create policy requests_admin_update on public.requests
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
