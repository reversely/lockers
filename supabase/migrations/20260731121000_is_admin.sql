-- Phase 2 helper. Every admin RPC and every phase 3 policy asks the same question, so it lives in
-- one function.
--
-- It is security definer because a policy on profiles that reads profiles would recurse: the
-- policy calls the check, the check selects from the table the policy guards, and that policy runs
-- again. Running as the definer bypasses row level security inside the function body and ends the
-- recursion.

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.profiles
     where id = (select auth.uid())
       and role = 'admin'
  );
$$;

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;
