-- The project exposes no new table to a Data API role without an explicit grant, so the earlier
-- phase 3 migrations left service_role with nothing. Bypassing row level security does not supply a
-- table privilege, and the secret key answered 42501 on every table until this ran.
--
-- Server-side work needs the access: seeding lockers for step 32, admin tasks outside a user
-- session, and debugging.
--
-- anon still receives nothing. A signed-out visitor reads no locker, which is what step 19 asks for
-- when it gives the wall to every signed-in user.

grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- A later migration would otherwise repeat this bug. The two client-facing roles stay explicit, one
-- grant per object, so exposure to a browser remains a decision rather than a default.
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
