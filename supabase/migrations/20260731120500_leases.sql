-- Step 11. A lease is the standing assignment of a locker to a user. Ending a lease sets
-- ended_at and keeps the row, so a locker's history survives.

create table public.leases (
  id uuid primary key default gen_random_uuid(),
  locker_id uuid not null references public.lockers (id),
  user_id uuid not null references public.profiles (id),
  -- Nullable: an admin assigns a locker directly, with no request behind it (step 26).
  request_id uuid references public.requests (id),
  start_date date not null default current_date,
  end_date date not null,
  comments text,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  constraint leases_dates_ordered check (end_date >= start_date)
);

create unique index leases_one_active_per_locker
  on public.leases (locker_id)
  where ended_at is null;

create unique index leases_one_active_per_user
  on public.leases (user_id)
  where ended_at is null;
