-- Step 8. The physical wall. (row, col) is the grid position the layout editor manages, and
-- an inactive locker keeps its position while accepting no reservation.

create table public.lockers (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  row integer not null,
  col integer not null,
  is_active boolean not null default true,
  comments text,
  created_at timestamptz not null default now(),
  unique (row, col)
);
