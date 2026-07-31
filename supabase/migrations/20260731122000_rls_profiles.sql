-- Step 18. A user reads and edits their own profile. An admin reads and edits every profile.
-- Nobody changes a role except an admin.
--
-- The role rule is a column rule, and row level security filters rows, so a trigger enforces it.
-- A trigger also holds for any path into the table, which a client-side check would not.

alter table public.profiles enable row level security;

grant select on public.profiles to authenticated;
grant update (name, id_number, email, phone, preferred_contact, comments, role)
  on public.profiles to authenticated;

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or public.is_admin())
  with check (id = (select auth.uid()) or public.is_admin());

create function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'only an admin changes a role' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_role
before update on public.profiles
for each row
execute function public.guard_profile_role();
