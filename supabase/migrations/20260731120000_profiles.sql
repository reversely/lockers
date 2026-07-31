-- Step 6. One profile row per authenticated user, carrying the contact details a locker
-- request needs. The signup trigger creates the row; the user fills in the rest.

create type public.contact_method as enum ('email', 'phone');
create type public.user_role as enum ('user', 'admin');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  id_number text,
  email text,
  phone text,
  preferred_contact public.contact_method,
  comments text,
  role public.user_role not null default 'user',
  created_at timestamptz not null default now()
);

-- The insert into auth.users happens outside any user session, so the trigger runs as its
-- definer. search_path is emptied and every name qualified, which is what Supabase's linter
-- asks of a security definer function.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();
