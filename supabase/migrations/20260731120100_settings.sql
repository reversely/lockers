-- Step 7. One row of admin-editable settings. The boolean primary key and the check that it
-- stays true hold the table to a single row, so every read can select it without a filter.

create table public.settings (
  id boolean primary key default true,
  etransfer_instructions text not null default '',
  reservation_minutes integer not null default 15,
  default_lease_days integer not null default 120,
  approval_email_subject text not null default '',
  approval_email_body text not null default '',
  constraint settings_single_row check (id),
  constraint settings_reservation_minutes_positive check (reservation_minutes > 0),
  constraint settings_default_lease_days_positive check (default_lease_days > 0)
);

insert into public.settings (id) values (true);
