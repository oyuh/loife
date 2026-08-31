# loife

A personal school and life dashboard covering courses, assignments, and a daily journal. Postgres stores the data, Railway runs the site, GitHub OAuth guards the door, and Google Calendar carries due dates into Notion Calendar. This plan covers the stack, the schema, the calendar sync, the auth model, the feature set, and the build order.

## Stack

| Layer | Choice |
|---|---|
| Framework | TanStack Start v1 on Vite, React 19, TypeScript |
| Routing and data | TanStack Router, TanStack Query v5 |
| Styling | Tailwind v4, one CSS import and no config file |
| Components | shadcn/ui base, kibo-ui registry on top |
| Database | Postgres on Railway, Drizzle ORM, drizzle-kit migrations |
| Calendar | Google Calendar API v3 via `googleapis` |
| File storage | Cloudflare R2 via `@aws-sdk/client-s3` |
| Auth | Hand-rolled OAuth over `fetch`, sessions sealed by TanStack Start |
| Host | Railway |

No Next.js. TanStack Start covers server rendering and server functions on its own. No Notion API, no Notion databases, and no Notion integration token.

## How the Notion Calendar sync works

Notion Calendar has no public write API. Its only developer surface is a `cron://` URL scheme that opens the desktop app to an event you already have, so nothing can create or edit events in it directly.

Notion Calendar is a client over Google Calendar and Outlook, and it renders whatever calendars live in the account you connect. We write to Google Calendar through its API, and Notion Calendar shows those events because it reads the same account. You keep using Notion Calendar and touch nothing else from Notion.

To be clear about what this means day to day: you never open Google Calendar. It is the storage format the app writes to, not an app you use. Notion Calendar stays the interface.

The app writes to one dedicated Google calendar named `loife`, never to your primary calendar. That keeps school events separable, lets you hide them in one click, and means a sync bug can never damage personal events.

Notion Calendar stores no events itself, so an account always sits underneath it, chosen when you first set the app up. Confirmed: the connected account is Google. Notion Calendar's own delete warning states that calendar data stored with Google survives account deletion, which is the same fact from the other direction.

The alternative, rejected: publish an ICS feed and subscribe to it from Google. Google polls external ICS feeds somewhere between 8 and 24 hours apart, so an assignment you add in the morning might not appear until the next day. That fails the point of the app.

## Schema

Drizzle owns the schema in one TypeScript file, and drizzle-kit generates the migrations. Railway injects `DATABASE_URL` when you add the Postgres plugin, so there is no setup route and no manual table creation.

### courses

- `id`: serial primary key
- `name`, `code`, `color`, `term`: text
- `termStart`, `termEnd`: date, bounding the recurring calendar event
- `days`: smallint array, 0 for Sunday through 6 for Saturday
- `startTime`, `endTime`: time
- `location`, `notes`: text, nullable
- `active`: boolean, default true
- `googleEventId`: text, nullable, holding the recurring meeting event
- `updatedAt`, `syncedAt`: timestamptz

### items

Assignments, exams, tasks, and readings share one table, so the Today view runs one query and one sort.

- `id`: serial primary key
- `courseId`: references courses, nullable for personal tasks
- `name`: text
- `type`: enum of assignment, exam, task, reading
- `dueAt`: timestamptz, nullable
- `allDay`: boolean, true when you gave a date with no time
- `priority`: enum of low, normal, high
- `status`: enum of todo, doing, done
- `location`, `notes`: text, nullable
- `googleEventId`: text, nullable
- `updatedAt`, `syncedAt`: timestamptz

### logEntries

Journal entries and things that happened share one table. A daily journal writes one row per day, and a logged event writes a row whenever you want. The `kind` field separates them.

- `id`: serial primary key
- `date`: date
- `kind`: enum of journal, event
- `title`: text
- `body`: text, no length cap
- `courseId`: references courses, nullable
- `location`: text, nullable
- `createdAt`, `updatedAt`: timestamptz

Log rows do not sync to Google Calendar. A journal is retrospective and would clutter a calendar you read to plan ahead. Revisit if you disagree once it is running.

### attachments

- `id`: serial primary key
- `itemId`: references items, nullable
- `logEntryId`: references logEntries, nullable
- `key`: text, the R2 object key, a UUID with no path structure
- `filename`, `contentType`: text, the original name and type
- `size`: integer, bytes
- `createdAt`: timestamptz

A check constraint requires exactly one of `itemId` and `logEntryId` to be set. Two nullable foreign keys beat a polymorphic owner column here, because Postgres still enforces referential integrity and a deleted item takes its attachment rows with it.

The object key is a UUID rather than the filename, so uploads never collide and no path escaping is needed. The original filename lives in its own column and drives the download name.

## File attachments

Homework files, scanned pages, and anything else you want to hang off an assignment or a journal entry.

### Cost

Your stated load is 20 files a month, each under 100 MB. The R2 free tier covers 10 GB of storage, 1 million Class A operations, and 10 million Class B operations per month, with no egress charge at any volume.

| Scenario | Per month | Year one total | Cost |
|---|---|---|---|
| Realistic, PDFs and photos at about 10 MB | 200 MB | 2.4 GB | Free |
| Every file at the 100 MB ceiling | 2 GB | 24 GB | Free through month 5, then about $0.21 a month |

Twenty uploads a month is 20 Class A operations against an allowance of a million, so operations never register. Even the pessimistic row costs less than a coffee per year, and the realistic row stays free past 2030.

### Design

The bucket stays private. Nothing is world-readable, because homework and journal attachments are personal.

Uploads go browser to R2 directly and never pass through Railway. A server function validates the declared size and content type, then mints a presigned `PUT` URL with `ContentLength` included in the signature. Signing the length means an upload that lies about its size fails at R2 rather than filling your bucket. The browser uploads, then calls a second server function to record the row.

Downloads use a presigned `GET` URL with a one hour expiry, minted only after the session check passes.

Deleting an item or a log entry deletes its attachment rows through the foreign key, and the same server function deletes the R2 objects.

One accepted gap: if the browser dies between minting a URL and recording the row, the object exists with no database row pointing at it. At 20 uploads a month that is noise. Mark it with a `ponytail:` comment and add a monthly sweep if it ever matters.

### Interface

A dropzone inside the assignment modal and the journal day view. Attached files list underneath with name, size, and a download action. Images get a thumbnail, everything else gets a file type icon.

## Calendar sync design

One direction only: the database is the source of truth and Google Calendar is a rendering of it. Two-way sync means conflict resolution, and nothing you do inside Notion Calendar needs to flow back.

Each synced row stores its `googleEventId`. Creating a row inserts an event and saves the returned ID. Editing a row patches that event. Deleting a row deletes it. An item with no `dueAt` gets no event.

Courses become one recurring event each, using an `RRULE` with `BYDAY` from the `days` column and `UNTIL` from `termEnd`. One event per course rather than one per week keeps the API calls at a handful per term.

Failure handling without a queue: every write updates `updatedAt`, and a successful push sets `syncedAt`. A reconcile function selects rows where `syncedAt` is null or older than `updatedAt`, then pushes them. It runs after each write inline and again on Today view load, which costs one indexed query. That covers a Google outage or an expired token with no Redis and no job runner.

## Auth

Two separate OAuth flows that do different jobs.

GitHub signs you in. You are the only user, so this needs no user table and no session store. The callback exchanges the code, reads the profile, and compares the numeric account ID against `ALLOWED_GITHUB_ID`. Every other account gets a 403.

Check the numeric ID rather than the username. GitHub usernames can be changed and then claimed by someone else, which turns a username check into a real hole. Fetch yours once:

```bash
curl -s https://api.github.com/users/your_github_username_here
```

Google grants calendar write access, once, during phase 5. The flow requests the `calendar.events` scope, and the refresh token goes into a one-row `settings` table. Access tokens are minted from it as needed, so you authorize a single time and never again.

Two dependency decisions made during phase 1, recorded here because they changed the plan.

`arctic` was the intended OAuth library, and npm marks it deprecated and unsupported. GitHub's flow is three `fetch` calls, so `src/lib/github.ts` does it directly with no dependency. That file is 80 lines including error handling.

TanStack Start ships `useSession`, which seals cookies with encryption and a signature already. The hand-rolled HMAC from the earlier plan was deleted before it was written.

Five hardening steps that cost nothing:

- Send a `state` parameter on both OAuth requests and verify it on callback, which blocks cross-site request forgery (CSRF)
- Set the session cookie `httpOnly`, `secure` in production, and `sameSite=lax`
- Set `sessionHeader: false`, so a request cannot supply a session through a header instead of the cookie
- Answer 405 on `GET /api/auth/logout`, since sign-out changes state and belongs on POST
- Check the session inside every server function before touching the database

## Data flow

Start's `createServerFn()` gives type-safe calls from client to server with no REST layer between them. Drizzle queries sit inside server functions, TanStack Query calls those functions, and types flow from column to component without a schema file or a fetch wrapper.

Two endpoints need real HTTP routes, because the OAuth providers redirect a browser to them:

- `/api/auth/github` and `/api/auth/callback`
- `/api/google/connect` and `/api/google/callback`

Postgres answers these queries in single-digit milliseconds, so nothing needs a cache layer. The previous plan carried a 60s cache purely to work around Notion's rate limit, and that whole layer is now deleted.

## Features, v1

The nine features below cover a normal school day end to end:

- **Today view**: lives at `/` and renders on the server with real data. Overdue items come first, then today, then the next seven days. Tap a row to toggle it done
- **Urgency sort**: one function buckets items by days remaining and breaks ties on priority. No Eisenhower matrix and no drag ranking
- **Add class modal**: name, code, color, term, term dates, meeting days as toggle chips, start time, end time, location, and notes. Reopening it on an existing course edits that course in place
- **Add assignment modal**: name, course combobox, type, due date through the native picker, priority, location, and notes. Opens from the command palette, from a bottom sheet on mobile, or from a keyboard shortcut
- **Bulk add**: paste a block of syllabus lines, one per row, in the shape `HW1 - Sep 5`. A regular expression pulls the date, you get a preview table with editable rows, and confirming writes them all
- **Courses view**: active courses, tapping through to that course's items, meeting times, and location
- **Inline log**: a single input pinned under the Today list. Type what happened, press enter, and it appends to today's journal entry, creating that entry if the day has none yet. Two keystrokes and a sentence turn a passing thought into a saved record
- **Journal view**: days listed newest first with a preview line each. Tap a day to read or edit the full body
- **File attachments**: drop a homework file onto an assignment or a journal day. Uploads go straight to Cloudflare R2 from the browser, and downloads come back through a signed link

A command palette on `Cmd K` opens the add modals, starts a log entry, and jumps between courses.

## Features, v2

Five things worth building once v1 is in daily use:

- A week timetable grid built on the kibo calendar, cheap now that the data is local
- Recurring tasks
- Effort estimates and a filter for what fits in 30 minutes
- Term archive and grade tracking
- Optional calendar sync for logged events, if the retrospective view turns out to be useful

## Not building

Multi-user support, sharing, and teams. Two-way calendar sync. A background job runner, because the reconcile sweep covers retries. A session database. A state management library, because TanStack Query plus React state already covers it. A light theme. Offline and PWA support.

## UI direction

Mobile first. A bottom tab bar holds Today, Courses, Journal, and Add, and becomes a left rail at `md:` and wider.

Flat dark surfaces, one blue accent, and underline-only hovers. No gradients, no glass blur, and no hover-lift. Where kibo ships a default that trends toward the popular look, override it.

Pull components per phase rather than installing the whole registry:

- From shadcn: button, input, select, dialog, sheet, command, sonner, skeleton, badge, checkbox, popover, tabs, textarea, progress
- From kibo: combobox, list, relative time, status, tags, dropzone

The calendar and kanban components wait for v2. Neither earns its place before the list works.

## Performance rules

Five rules keep the interface responsive on a phone:

- Hydrate the Query cache from the server render, so nothing refetches what the server already sent
- Run an optimistic mutation on every toggle and edit, with rollback and a toast on failure
- Push to Google Calendar after the database commit responds, never before, so a slow Google call never delays your tap
- Prefetch routes on hover and on touchstart
- Size skeletons to the final layout height, so nothing shifts when data arrives

## Accessibility

Contrast at 4.5:1 or better. Visible focus rings. Touch targets at 44x44 px. Full keyboard navigation. View transitions gated behind `prefers-reduced-motion`.

## Phases

Each phase ends deployed to Railway:

1. Start skeleton, Tailwind v4, shadcn init, GitHub OAuth, and a Railway deploy. Ship a page that prints your GitHub handle, which proves the whole pipeline works before any real logic lands
2. Railway Postgres plugin, Drizzle schema, and the first migration
3. Read layer, Today view, and the mobile shell. The app turns useful here
4. Writes: toggle, the add assignment modal, optimistic mutations, and the command palette
5. Google OAuth grant and the calendar push for items. Confirm an assignment appears in Notion Calendar before moving on
6. The add class modal, the courses view, and recurring meeting events
7. The inline log on Today and the journal view
8. Bulk add with the paste-and-preview table
9. R2 attachments: presigned uploads, the dropzone, and signed downloads

Swap phases 7 and 8 if a semester starts before you get there. Bulk add matters most in the first week, and the journal matters every other week. Pull phase 9 forward if you start needing to attach files sooner, since it depends on nothing above it except the modals.

## Env vars

```env
DATABASE_URL
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
ALLOWED_GITHUB_ID
SESSION_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_CALENDAR_ID
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET
PUBLIC_URL
```

Railway injects `DATABASE_URL` when you add the Postgres plugin. `GOOGLE_CALENDAR_ID` gets filled in phase 5, when the app creates the dedicated `loife` calendar.
