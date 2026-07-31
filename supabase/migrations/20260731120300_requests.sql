-- Step 9. A request moves pending, approved, fulfilled. The admin approves it after seeing the
-- e-transfer land in their own bank account.

create type public.request_status as enum ('pending', 'approved', 'fulfilled');

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.request_status not null default 'pending',
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references public.profiles (id)
);

-- One request per user while it is still moving. A fulfilled request stays as history and
-- leaves the user free to request again.
create unique index requests_one_open_per_user
  on public.requests (user_id)
  where status in ('pending', 'approved');
