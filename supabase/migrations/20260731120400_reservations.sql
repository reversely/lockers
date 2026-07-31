-- Steps 10 and 12. A reservation is a short hold on one locker for one user.
--
-- A partial index predicate has to be immutable, and now() is not, so Postgres rejects an index
-- restricted to live reservations. Both unique indexes therefore cover every row, expired or
-- not. Each RPC in phase 2 deletes the expired rows in its way before inserting, and every read
-- filters on expires_at > now(). The schema needs no cleanup job to stay correct.

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  locker_id uuid not null references public.lockers (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  request_id uuid not null references public.requests (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create unique index reservations_one_per_locker on public.reservations (locker_id);
create unique index reservations_one_per_user on public.reservations (user_id);
