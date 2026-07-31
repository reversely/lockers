-- Step 13. One row per locker with the state the wall renders, and nothing a peer should not
-- read. The user wall reads this view and no other table.
--
-- The view runs with its owner's rights rather than the caller's. Phase 3 restricts profiles to
-- the owning user and the admin, while the wall has to show every signed-in user who holds a
-- locker. Row level security filters rows, and the difference here is which columns a stranger
-- may read, so the grant on this view is the access control.
--
-- What a peer reads: the locker's label, grid position, active flag and state, the occupant's
-- name, and the lease dates. An ID number, a personal comment, and an admin's note on a lease
-- stay out, and the admin surfaces read those from profiles and leases directly.
--
-- A reservation counts only while expires_at > now(), so an expired hold shows as available
-- without any cleanup job having run.

create view public.locker_wall as
select
  locker.id as locker_id,
  locker.label,
  locker.row,
  locker.col,
  locker.is_active,
  case
    when not locker.is_active then 'inactive'
    when lease.id is not null then 'occupied'
    when reservation.id is not null then 'reserved'
    else 'available'
  end as state,
  reservation.user_id as reserved_by,
  reservation.expires_at as reserved_until,
  lease.id as lease_id,
  lease.user_id as occupant_id,
  occupant.name as occupant_name,
  lease.start_date,
  lease.end_date
from public.lockers locker
left join public.leases lease
  on lease.locker_id = locker.id
  and lease.ended_at is null
left join public.reservations reservation
  on reservation.locker_id = locker.id
  and reservation.expires_at > now()
left join public.profiles occupant
  on occupant.id = lease.user_id;

comment on view public.locker_wall is
  'One row per locker with its derived state. Peer-visible fields only: an ID number, a personal comment, and a lease comment come from the base tables, which phase 3 restricts to the admin.';
