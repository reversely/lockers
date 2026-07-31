# Locker management system: implementation breakdown

The app runs on Next.js (App Router, server actions), Supabase (Auth, Postgres, RLS, Realtime), and Resend. Vercel hosts the deployment. Postgres enforces every reservation rule; the browser client only calls RPCs.

## User flow

1. The user signs up and completes a profile.
2. The user submits a locker request. The app then shows the e-transfer instructions and nothing else.
3. The admin verifies the e-transfer in their own bank account and approves the request.
4. The approval action sends the user an email through Resend with instructions to pick a locker.
5. The user reserves one locker for up to 15 minutes. During the reservation no other user can claim that locker.
6. The user selects the reserved locker. The select action writes a lease row and marks the request fulfilled.
7. Only the admin can switch, reassign, edit, or end leases. Every signed-in user sees the live wall.

Unique partial indexes and one SECURITY DEFINER RPC per action enforce the reservation rules. Every query filters reservations on `expires_at > now()`, so the schema requires no cleanup job for correctness.

## Phase 0: project skeleton

1. Run `bun create next-app` with TypeScript, App Router, and Tailwind.
2. Create a Supabase project and store the URL, anon key, and service key in `.env.local`.
3. Run `bun add @supabase/supabase-js @supabase/ssr resend`, then `bunx shadcn@latest init` for the behavioral layer (dialogs, dropdowns, data tables). Map its theme variables onto the tokens: `--paper` to background, `--ink` to foreground, `--signature` to primary.
4. Copy `tokens.css` from the light-enterprise-ui skill into `app/` and import it in the root layout. Declare `@font-face` for Aeonik Light, Regular, and Medium from `public/fonts/`. That directory stays gitignored because the repo is public: a prebuild script writes the three files from the `AEONIK_FONTS_B64` environment variable, and the build fails when the variable is missing. Converting the `.ttf` weights to woff2 needs fonttools, which is not installed.
5. Enable email/password auth with email confirmation in Supabase.

## Phase 1: schema (one migration per step)

6. Create `profiles`: `id uuid PK references auth.users`, `name`, `id_number`, `email`, `phone`, `preferred_contact` enum(`email`,`phone`), `comments`, `role` enum(`user`,`admin`) default `user`. A trigger inserts a profile row on auth signup.
7. Create `settings` as one admin-editable row: `etransfer_instructions text`, `reservation_minutes int default 15`, `default_lease_days int default 120`, `approval_email_subject text`, `approval_email_body text`.
8. Create `lockers`: `id uuid PK`, `label text unique`, `row int`, `col int`, `is_active bool default true`, `comments text`, unique `(row, col)`.
9. Create `requests`: `id`, `user_id FK`, `status` enum(`pending`,`approved`,`fulfilled`), `created_at`, `approved_at`, `approved_by FK`. Add a partial unique index that limits each user to one request with status `pending` or `approved`.
10. Create `reservations`: `id`, `locker_id FK`, `user_id FK`, `request_id FK`, `expires_at timestamptz`. Add plain unique indexes on `locker_id` and on `user_id`.
11. Create `leases`: `id`, `locker_id FK`, `user_id FK`, `request_id FK`, `start_date date`, `end_date date`, `comments text`, `ended_at timestamptz null`. Add partial unique indexes that limit each locker and each user to one lease where `ended_at is null`.
12. Postgres rejects `now()` inside index predicates, so the unique indexes in step 10 cover all reservation rows and each RPC deletes expired reservations before it inserts (step 14).
13. Create view `locker_wall`: one row per locker with a derived `state` column (`inactive`, `available`, `reserved`, `occupied`) and, on occupied rows, `name`, `id_number`, and user `comments` joined from `profiles` plus `start_date`, `end_date`, and lease `comments` from `leases`. Both UIs render this view and nothing else.

## Phase 2: concurrency RPCs (SECURITY DEFINER, all checks server-side)

14. Write `claim_reservation(p_locker uuid)`. The function deletes the caller's expired reservations and any expired reservation on `p_locker`, verifies the caller has an approved request with no active lease and no live reservation, verifies the locker is active with no lease and no reservation, then inserts a reservation with `expires_at = now() + settings.reservation_minutes`. A concurrent duplicate insert violates the unique index and the function returns "already reserved".
15. Write `release_reservation()`. The function deletes the caller's own reservation (the Cancel button).
16. Write `finalize_selection()`. The function verifies the caller's reservation has not expired, inserts the lease with `start_date = current_date` and `end_date = start_date + settings.default_lease_days`, marks the request `fulfilled`, and deletes the reservation inside one transaction.
17. Write admin RPCs: `admin_end_lease(lease_id)` and `admin_reassign(lease_id, new_locker_id)` (ends one lease and creates another inside one transaction).

## Phase 3: RLS

18. `profiles`: each user reads and updates their own row except `role`; the admin reads and updates every row.
19. Grant authenticated users read access on `lockers`, `locker_wall`, reservation existence, and the public lease fields, so every signed-in user sees the live wall. Route all user writes through the RPCs and grant direct table writes to the admin only.
20. `requests`: a user inserts and reads their own rows; the admin reads and updates all rows. `settings`: users read `etransfer_instructions`; the admin reads and writes every column.

## Phase 4: user surface

21. Build the auth pages and the profile form (name, ID number, phone, preferred contact, comments). Block the request button until the profile is complete.
22. Build the dashboard: the read-only wall plus one status panel that renders exactly one state.
    - No request: the panel shows a "Request a locker" button.
    - Pending: the panel shows the e-transfer instructions from Settings and an "awaiting confirmation" line.
    - Approved: the panel shows "Pick your locker" and the wall becomes clickable.
    - Reserving: the panel shows a mm:ss countdown, the locker label, a Select button, and a Cancel button.
    - Fulfilled: the panel shows the locker label and the lease dates.
23. When the request status reads approved, a click on an available cell calls `claim_reservation`. The viewer's own reserved cell shows a `--signature` outline and the countdown. The Select button calls `finalize_selection`.
24. Subscribe to Realtime changes on `lockers`, `reservations`, and `leases` and refetch `locker_wall` on each event. A 1-second client tick drives the countdown; on expiry the panel returns to the Approved state.

## Phase 5: admin surface (routes under `/admin`, restricted to `role = admin`)

25. Build the requests queue: pending requests with name, ID number, email, phone, preferred contact, and submitted date. The Approve action updates the request and sends the Resend email from the Settings template; on a send failure the UI shows a retry button and the approval still stands.
26. Build the admin wall. A click on any cell opens a side panel.
    - Available cell: the panel edits label, comments, and the active toggle, and assigns the locker directly to a user (search by name or ID; direct assignment creates a lease without a request).
    - Occupied cell: the panel shows tenant info with editable `start_date`, `end_date`, and lease comments, plus End lease and Reassign actions.
    - Reserved cell: the panel shows the reserving user, the countdown, and a force-release action.
27. Add a grid editor as an "Edit layout" toggle on the wall. Row and column steppers grow the grid with inactive cells. The editor refuses to deactivate a cell with an active lease. A click on a cell renumbers it inline.
28. Build the users page: a table with name, ID, email, phone, preferred contact, comments, and current locker joined from `leases`. A click on a row opens the profile fields for editing.
29. Build the settings page: inputs for e-transfer instructions, reservation minutes, default lease days, and the approval email subject and body. Save updates the single row.

## Phase 6: UI implementation (per the light-enterprise-ui skill)

Checkpoint rule: each checkpoint delivers the surface running on real data at a review route, with a switchable variant for every review dimension listed. The reviewer rules on each dimension; the builder revises and re-presents until sign-off. Sign-off freezes the surface; a later change to a frozen surface reopens its checkpoint. Style conformance (tokens, type roles, the skill review checklist) gets one dedicated pass at the end instead of repeating inside every checkpoint.

30. Read the skill's reference files before writing component CSS: `references/app-screens.md` (this project is a product surface), `references/cards.md`, `references/tables.md`, `references/motion.md`, and `references/flow-audit.md` (it defines the squint and grayscale tests used in step 45).
31. Build the app shell: page on `--paper`, top nav in Aeonik Medium 14px, 1200px content column, and typography utility classes for each role in the skill's role table.
32. Build the wall and cell GUI on real seeded data (create lockers in the editor, reserve one as a test user, lease one via admin direct assignment; the Forbidden list bans fabricated seed personas). Cell states: available renders white with a `--line` hairline; reserved renders `--signature-soft` with a `--signature` outline on the viewer's own; occupied renders `--steel-1` fill with `--ink` text; inactive renders `--paper` with no border.
33. **Checkpoint: wall GUI.** Review dimensions: what a cell shows at rest (label plus state word against label only); where occupied detail renders (name, ID number, comments, lease dates, and lease comments on the cell against in a click-opened detail); cell size and grid gap at the real locker count; overflow at 390px (horizontal scroll against scaled cells); whether a state legend appears and where.
34. Build the reservation interaction: click on an available cell, the 15-minute countdown, Select, and Cancel.
35. **Checkpoint: reservation GUI.** Review dimensions: countdown placement (on the cell, in the status panel, or both); click behavior (a click reserves immediately against a click opening a confirm step); Cancel prominence relative to Select; what the screen shows at the moment a reservation expires.
36. Build the status panel with its five states from step 22.
37. **Checkpoint: status panel GUI.** Review dimensions: e-transfer instructions typography, measure, and container; panel placement relative to the wall (above against beside at 1440px); how the panel transitions between states.
38. Build the requests queue and the users page as working tables per `references/tables.md`.
39. **Checkpoint: tables GUI.** Review dimensions: column order and row density on each table; Approve placement (a button on the row against inside a row-click detail); the zero-row empty state wording.
40. Build the admin side panel with its three variants from step 26 and the grid editor from step 27.
41. **Checkpoint: admin editing GUI.** Review dimensions: field editing style (inline edits against an explicit edit mode with Save); whether End lease, Reassign, and force-release require a confirm step; row and column input control (steppers against numeric fields); the inline renumber interaction on a cell.
42. Build the settings page from step 29.
43. **Checkpoint: settings GUI.** Review dimensions: instructions textarea sizing; whether the email subject and body sit on one screen with the other settings or in their own section; save feedback (toast against inline confirmation).
44. Add motion per `references/motion.md`: status panel entrance with a 200ms fade and 12px rise, cell state crossfade, card hover rise of 2px, durations inside 200 to 400ms on the skill's ease, and `prefers-reduced-motion` disabling transforms.
45. Run the style pass: the skill's full review checklist, the grayscale and squint tests, and the under-5% signature budget on 1440px and 390px screenshots of every route. Tune tokens and spacing until every line passes; a structural change here reopens the affected surface's checkpoint.

## Phase 7: verify

46. Open two browsers. User A reserves a locker; user B's wall must grey that cell within one second and B's click on it must return "already reserved".
47. Two approved users click the same cell at the same moment from two tabs. Exactly one reservation row may exist afterward.
48. Let a reservation expire. The cell must return to available on both screens without a refresh, and the same user must succeed at a second reservation.
49. Run the full path: signup, request, admin approval, email receipt, reservation, selection, occupied cell with joined name and ID, admin date edit, admin reassign, freed cell.
50. As a user, attempt a direct insert into `leases` and a direct update on `lockers` through the JS client. RLS must reject both attempts.
50. As a user, attempt a direct insert into `leases` and a direct update on `lockers` through the JS client. RLS must reject both attempts.