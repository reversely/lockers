-- Step 24 subscribes the wall to changes on these three tables and refetches locker_wall per
-- event. The supabase_realtime publication starts empty on a hosted project, so without this no
-- subscriber receives anything.
--
-- Realtime checks the subscriber against row level security, and all three tables allow select to
-- authenticated, so every signed-in user receives the events. The payload does not matter to the
-- wall: the client refetches the view rather than reading the event body.

alter publication supabase_realtime add table public.lockers;
alter publication supabase_realtime add table public.reservations;
alter publication supabase_realtime add table public.leases;
