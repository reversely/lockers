# Copy inventory

This document lists every line a person can read in the app, in the order each flow presents it.
Strings appear verbatim inside quotation marks. `{braces}` mark a runtime value. Three provenance
labels recur:

- **admin-authored**: the admin writes this text on the settings page, and the app shows it
  unchanged.
- **Supabase**: the text comes from Supabase Auth and passes through unedited. The free tier
  refuses email-template changes, so the confirmation email keeps Supabase's stock wording.
- **default**: a fallback the app uses when the admin-authored field is blank.

Everything else is fixed app copy, editable in the source files this document cites.

## The user's flow

### 1. Sign in (`app/login/page.tsx`)

| Element | Copy |
|---|---|
| Eyebrow | "Lockers" |
| Heading | "Sign in" |
| Field labels | "Email", "Password" |
| Submit button | "Sign in" |
| Footer link | "Don't have an account? Sign up" |
| Notice after signup | "Check your email for a confirmation link." |
| Notice after a dead link | "The confirmation link is invalid or has expired." |
| Failed sign-in | Supabase, for example "Invalid login credentials" |

### 2. Sign up (`app/signup/page.tsx`)

| Element | Copy |
|---|---|
| Eyebrow | "Lockers" |
| Heading | "Sign up" |
| Field labels | "Email", "Password" |
| Field helper | "Your password must be at least 6 characters." |
| Submit button | "Sign up" |
| Footer link | "Already have an account? Sign in" |
| Failed signup | Supabase, for example a weak-password message |

### 3. The confirmation email (Supabase stock template)

| Element | Copy |
|---|---|
| Subject | "Confirm your email address" |
| Body | "Confirm your email address" / "Follow the link below to confirm this email address and finish signing up." (Supabase stock wording; the free tier refuses template edits, so "finish signup" is not reachable) |
| Link text | "Confirm email address" |

### 4. Top bar, on every signed-in page (`components/top-bar.tsx`)

| Element | Copy |
|---|---|
| Wordmark | "Lockers" |
| Nav | "Profile", `{signed-in email}`, "Sign out" |

The email hides under 640px.

### 5. Profile (`app/profile/page.tsx`)

| Element | Copy |
|---|---|
| Eyebrow | "Profile" |
| Heading | "Contact details" |
| Intro | "A locker request needs a name, an ID number, a phone number, and a preferred contact." |
| Field labels | "Name", "ID number", "Email", "Phone", "Preferred contact", "Comments" |
| Select options | "Choose one" (disabled), "Email", "Phone" |
| Submit button | "Save" |
| After save | "Saved." |

### 6. Dashboard, one panel state at a time (`components/status-panel.tsx`)

No request yet, two elements only:

| Element | Copy |
|---|---|
| Body | "Submit a request, then pay by e-transfer." |
| Body, profile incomplete | "Complete your profile first." ("profile" links to the profile page; the button stays disabled until the profile has the fields a request needs) |
| Button | "Request a locker" |

Request pending:

| Element | Copy |
|---|---|
| Eyebrow | "Request pending" |
| Body | admin-authored e-transfer instructions, written in the settings field "E-transfer instructions, shown to a user with a pending request" |
| Body when blank | "Please contact your admin for assistance with signup." |
| Status line | "Awaiting confirmation from admin. Please allow 3-5 working days." |

Request approved:

| Element | Copy |
|---|---|
| Body | "Please select an available locker." |

Holding a locker:

| Element | Copy |
|---|---|
| Countdown line | "Holding locker for {mm:ss}", "--:--" before the first tick |
| Buttons | "Confirm locker", "Cancel" |

Lease in place:

| Element | Copy |
|---|---|
| Heading | `{label}` |
| Dates | "{Jul 31, 2026} to {Nov 28, 2026}" |

### 7. Locker wall (`components/wall.tsx`)

| Element | Copy |
|---|---|
| Surface heading | "Locker wall" |
| Empty state | "No lockers yet. The admin creates them." |
| Occupied cell | `{label}` over `{occupant name}` |
| Own held cell | `{label}` over the countdown |
| Other cells | `{label}` |

Occupied-cell popup:

| Element | Copy |
|---|---|
| Eyebrow | "Locker {label}" |
| Body | `{occupant name}`, then "{start date} to {end date}" |
| Button | "Close" |

### 8. Errors the panel can show (`lib/errors.ts` over the RPC strings)

The RPCs raise short fact strings, which stay as raised because tests and callers assert them.
`lib/errors.ts` maps each to the sentence the panel renders; an unmapped message passes through
raw.

| Raised | Rendered |
|---|---|
| "already reserved" | "Someone already holds that locker." |
| "no approved request" | "Your request is not approved yet." |
| "already holds a locker" | "You already have a locker." |
| "already holding a reservation" | "You already hold a locker. Cancel it first." |
| "locker unavailable" | "That locker is not available." |
| "already leased" | "That locker is occupied." |
| "reservation expired" | "Your hold expired. Pick another locker." |
| "not signed in" | "Your session ended. Sign in again." |

## The admin's flow

### 1. Admin nav (`app/admin/layout.tsx`)

| Element | Copy |
|---|---|
| Second bar | "Requests", "Wall", "Users", "Settings" |

### 2. Requests queue (`app/admin/requests/page.tsx`)

| Element | Copy |
|---|---|
| Eyebrow | "Requests" |
| Heading | "Pending requests" |
| Table headers | "Name", "ID number", "Email", "Phone", "Preferred contact", "Submitted" |
| Missing name | "no name yet" |
| Row button | "Approve" |
| Empty state | "No pending requests." |
| After a sent approval | "Approved. The email went out." |
| After a failed send | "Approved. The email did not send. {reason}" |
| Retry button | "Retry send" |

The `{reason}` values (`app/admin/requests/actions.ts`, `lib/resend.ts`):

- "Email sending is not configured: RESEND_API_KEY or RESEND_FROM_EMAIL is missing."
- "The requester has no email on file."
- "That request is not approved." (a retry on a request that is not approved)
- "That request is not pending anymore." (an approve that lost a race)
- A Resend API error message, passed through.

### 3. The approval email (`app/admin/requests/actions.ts`)

| Element | Copy |
|---|---|
| Subject | admin-authored; default "Your locker request is approved" |
| Body | admin-authored; default "Your locker request is approved. Sign in to pick your locker." |

### 4. Admin wall (`components/admin-wall.tsx`)

| Element | Copy |
|---|---|
| Surface heading | "Locker wall" |
| Mode toggle | "Edit layout", then "Done" |
| Empty state | "No lockers yet." then "Edit layout to create them." or, in edit mode, "Add a row to create the first cell." |
| Cells | as the user wall, plus a countdown on any held cell |

Side panel on an available cell:

| Element | Copy |
|---|---|
| Eyebrow | "Locker {label}" |
| Field labels | "Label", "Comments" |
| Buttons | "Save", "Deactivate" or "Activate" |
| Assign section | "Assign to a user", placeholder "Search by name or ID number" |
| Match buttons | "{name} ({ID number})" |
| Footer button | "Close" |

Side panel on an occupied cell:

| Element | Copy |
|---|---|
| Eyebrow | "Locker {label}" |
| Tenant lines | `{name}`, then "{ID number} {email} {phone}" |
| Field labels | "Start date", "End date", "Lease comments" |
| Buttons | "Save", "End lease" |
| Reassign row | "Reassign to", select placeholder "Choose an available locker", button "Move" |
| Dates line | "{start date} to {end date}" |
| Footer button | "Close" |

Side panel on a held cell:

| Element | Copy |
|---|---|
| Eyebrow | "Locker {label}" |
| Body | "Held by {name}", falling back to the email, then "a user" |
| Countdown | `{mm:ss}` |
| Buttons | "Force release", "Close" |

Errors the panel can show, beyond the shared table above, rendered through the same lookup:

| Raised | Rendered |
|---|---|
| "admin only" | "Only an admin can do that." |
| "no active lease with that id" | "That lease is not active anymore." |
| "locker is reserved" (a reassign into a live hold) | "A user is holding that locker. Release the hold first." |

### 5. Edit layout mode (`components/admin-wall.tsx`)

| Element | Copy |
|---|---|
| Stepper row | "{n} row" or "{n} rows", button "Add row", "{n} column" or "{n} columns", button "Add column" |
| Hint | "Click a cell to rename it. New cells start inactive." |
| Cell inputs | the label, with accessible name "Rename {label}" |

### 6. Users (`app/admin/users/page.tsx`)

| Element | Copy |
|---|---|
| Eyebrow | "Users" |
| Heading | "All users" |
| Table headers | "Name", "ID number", "Email", "Phone", "Preferred contact", "Comments", "Locker" |
| Missing name | "no name yet" |
| Empty state | "No users yet." |

Edit form, opened by a row click:

| Element | Copy |
|---|---|
| Eyebrow | "Editing {email}" |
| Field labels | "Name", "ID number", "Phone", "Preferred contact", "Comments" |
| Select options | "none", "Email", "Phone" |
| Buttons | "Save", "Cancel" |
| After save | "Saved." |

### 7. Settings (`app/admin/settings/page.tsx`)

| Element | Copy |
|---|---|
| Eyebrow | "Settings" |
| Heading | "Requests, leases, and the approval email" |
| Field labels | "E-transfer instructions, shown to a user with a pending request", "Reservation minutes", "Default lease days", "Approval email subject", "Approval email body" |
| Button | "Save" |
| After save | "Saved." |
| Validation | "Reservation minutes needs a positive whole number.", "Default lease days needs a positive whole number." |

## Browser tab titles

| Page | Title |
|---|---|
| Root layout | "Lockers", description "Request, reserve, and manage lockers." |
| Sign in | "Sign in" |
| Sign up | "Sign up" |
| Profile | "Profile" |
| Admin pages | "Requests", "Wall", "Users", "Settings" |
