-- Step 19, the live-state side. Every signed-in user reads reservation and lease rows, because the
-- wall subscribes to changes on both tables and refetches locker_wall on each event (step 24).
-- Realtime only delivers a change a subscriber could have selected, so a policy that hid these rows
-- from peers would leave every other user's wall stale until a reload.
--
-- Nobody writes either table directly except an admin. Every user action goes through the phase 2
-- functions, which run as their definer and are unaffected by these policies.
--
-- leases.comments is an admin's note on a tenancy, so it is left out of the column grant and read
-- through admin_leases below.

alter table public.reservations enable row level security;
alter table public.leases enable row level security;

grant select on public.reservations to authenticated;
grant delete on public.reservations to authenticated;
grant select (id, locker_id, user_id, request_id, start_date, end_date, ended_at, created_at)
  on public.leases to authenticated;
grant insert, update, delete on public.leases to authenticated;

create policy reservations_select on public.reservations
  for select to authenticated
  using (true);

-- The admin's force-release on a reserved cell (step 26).
create policy reservations_admin_delete on public.reservations
  for delete to authenticated
  using (public.is_admin());

create policy leases_select on public.leases
  for select to authenticated
  using (true);

create policy leases_admin_insert on public.leases
  for insert to authenticated
  with check (public.is_admin());

create policy leases_admin_update on public.leases
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy leases_admin_delete on public.leases
  for delete to authenticated
  using (public.is_admin());

-- Owner rights plus an is_admin gate: the admin surfaces read every lease column here, including
-- the comment the grant above withholds from a peer. A non-admin selecting this view gets no rows.
create view public.admin_leases as
  select * from public.leases where public.is_admin();

grant select on public.admin_leases to authenticated;
