-- Step 19, the wall side. Every signed-in user reads the lockers and the wall view. Only an admin
-- writes a locker row, and the layout editor is the only thing that does.

alter table public.lockers enable row level security;

grant select on public.lockers to authenticated;
grant insert, update, delete on public.lockers to authenticated;
grant select on public.locker_wall to authenticated;

create policy lockers_select on public.lockers
  for select to authenticated
  using (true);

create policy lockers_admin_insert on public.lockers
  for insert to authenticated
  with check (public.is_admin());

create policy lockers_admin_update on public.lockers
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy lockers_admin_delete on public.lockers
  for delete to authenticated
  using (public.is_admin());
