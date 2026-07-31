-- Step 20, the settings side. A user reads the e-transfer instructions and nothing else, since the
-- pending panel renders them. An admin reads and writes every column.
--
-- The difference is columns rather than rows, and the table holds a single row, so a policy cannot
-- separate the two. The column grant gives a peer the instructions, and admin_settings gives an
-- admin the full row through the view owner.

alter table public.settings enable row level security;

grant select (id, etransfer_instructions) on public.settings to authenticated;
grant update on public.settings to authenticated;

create policy settings_select on public.settings
  for select to authenticated
  using (true);

create policy settings_admin_update on public.settings
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create view public.admin_settings as
  select * from public.settings where public.is_admin();

grant select on public.admin_settings to authenticated;
