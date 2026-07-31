-- Step 13. One row per locker with the state both walls render. The UIs read this view and no
-- other table.
--
-- The view runs with its owner's rights rather than the caller's. Phase 3 restricts profiles to
-- the owning user and the admin, while step 13 asks the wall to show every signed-in user the
-- occupant's name and ID number. Row level security cannot express that, since it filters rows
-- and the difference here is which columns a stranger may read. The grant on this view is
-- therefore the access control: it exposes the occupant columns named below and nothing else
-- from profiles.
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
  locker.comments as locker_comments,
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
  occupant.id_number as occupant_id_number,
  occupant.comments as occupant_comments,
  lease.start_date,
  lease.end_date,
  lease.comments as lease_comments
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
  'One row per locker with its derived state. Occupant columns come from profiles through the view owner, not through the caller.';
