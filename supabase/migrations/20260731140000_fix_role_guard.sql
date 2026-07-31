-- The original guard raised for every caller that failed is_admin(). A service-role call has no
-- auth.uid(), so is_admin() returned false and the trigger blocked the service key too, leaving
-- no path to a first admin: row level security never applies to the service role, but a trigger
-- fires for every role.
--
-- The rule the guard means to enforce binds user sessions: a signed-in non-admin may not change
-- a role. A caller with no user context (the service role, direct SQL) is not a user session.

create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and (select auth.uid()) is not null
     and not public.is_admin() then
    raise exception 'only an admin changes a role' using errcode = '42501';
  end if;
  return new;
end;
$$;
