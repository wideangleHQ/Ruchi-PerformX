# UX audit backlog

Written 2026-08-23 from a ten-way parallel audit of the client, one agent per
module, every finding checked against the server handler rather than inferred.
About 190 findings. The ones marked FIXED landed in the same change as this
page; everything else is open and ordered by how much damage it causes.

Read [the root cause](#the-root-cause) first. Two thirds of this page is one
mistake repeated.

---

## The root cause

`api-contract.spec.ts` compares **request** payload keys against DTOs, and
`forbidNonWhitelisted` makes a wrong request key a loud 400. Nothing checks the
other direction. A client that reads a **response** key the server never sends
gets `undefined`, which React renders as nothing at all: an empty list, a blank
cell, `Invalid Date`, a permanently-unread badge. No error, no log, green
typecheck.

Every screen the client reported as "not showing anything" was this.

Three variants, all present:

1. **Wrong field name.** `notification.is_read` read as `isRead`,
   `deadline.flag` read as `is_overdue`, `user.fullName` read as `name`.
2. **Wrong envelope.** `{ items }`, `{ balances }`, `{ data, pagination }`,
   `{ success, message, data }` and bare arrays all coexist. The client guesses
   per file, and in `vms/requests/api/request.api.ts` it guesses two different
   ways on lines 11 and 16 of the same file.
3. **Wrong vocabulary.** A `<select>` offering values `@IsIn(...)` rejects.
   `DELIVERED`, `ON_TARGET`, `BEHIND`, `MISSED`, `INSIDE`, `GENERATED`,
   `PRINTED`, `COMPLETED`, `RENEWED` are all offered somewhere and refused.

**The two guards worth building**, both regex over the same two trees the
existing spec already walks:

- Assert every `export const X_STATUSES`/`_ROLES` array in a DTO has an
  identical union in `client/src/api`. Kills variant 3 everywhere at once.
- Settle the response envelope. A global `TransformInterceptor` on the server is
  the smaller change than teaching the client four shapes.

---

## Fixed in this change

| Area | What was broken |
| --- | --- |
| Realtime | `useSocket` read the JWT from a `token=` cookie nothing has ever written, so it bailed on every render. No live notifications, poll tallies, task or comment invalidation anywhere in the product. One line. |
| Notifications | The service returned raw Prisma rows, so the bell read `is_read`/`created_at`/`task_id` as `isRead`/`createdAt`/`taskId`. Every row rendered unread over `Invalid Date`, and "Open task" never appeared. Now mapped, and the envelope flattened to match `PaginatedResponse`. |
| Toasts | The store had listeners and nothing ever subscribed. Every `toast.success`/`toast.error` across ten files was a no-op. `<Toaster />` now mounted in the root layout. |
| Leave | Apply crashed to a blank screen once both dates were set: two competing `Holiday` types, and the day-count preview called `.slice()` on a field the server does not send. |
| Leave | My leave, Pending approvals and the balance cards were always empty: the server wraps in `items` and `balances`, `getList` only read `data`. |
| Leave | Team calendar sent `month`/`year` to a DTO declaring `from`/`to`, so it 400d and rendered as "nobody is on leave". |
| Leave | "Their balance" on the approvals table read `remaining_balance`; the server sends `applicant_balance`. |
| Leave | The proof link an applicant submits was never shown to the approver. |
| Leave | ADMIN was shown Pending Approvals and got a 403 on arrival. |
| Users | `GET /users` returns a bare array; the client typed it as a paginated envelope, so every employee picker in the app was empty. Nine consumers. |
| Vendors | Deadline rows could never show OVERDUE or DUE SOON, and the four profile tiles were hardcoded zero. |
| Sidebar | Scoring, HOD Scores and Analytics hidden pending the score-model decision. |
| Reception | Check-in used `alert()` then `window.location.reload()`, throwing away the session with a visitor at the desk. Now a toast and a form reset; the cache invalidation was already correct. |
| VMS | The employee visitor-request screen showed a hardcoded "Jane Doe, Senior Developer" to every real user. |
| Passes | A "Copies" input reception could set and `handlePrint` never read. |
| Shared | 40 client type errors to zero, four dead role dashboards deleted, `apiMessage` helper for the 25 hand-rolled copies of the axios error dance. |

---

## Open, blocking

### Self-registration creates a live account with any role

`AuthService.register` writes `is_active: true` and never sets
`pending_approval`, which defaults false, so the login gate never trips.
`registration_requests` is referenced by no server code. Anyone who can reach
the signup page can create an active MD account, and `/register-success` tells
them they are awaiting approval.

`GET /users/pending`, `PATCH /users/:id/approve` and `/reject` all exist and no
client code calls any of them. `@Get(':id')` is declared above `@Get('pending')`
in the controller, so the queue route would 404 as an unknown user id even once
a screen calls it. Fix the route order first, then build the queue.

### There is no working way to set a password

Self-service reset is dead (the OTP never sends). `/forgot-password` routes to
the success page from its `catch` as well as its `try`, so every failure reads
as success. `/forgot-password-success` tells the user to contact their HOD for
an approval step that does not exist. `POST /auth/change-password` is fully
implemented and the client never calls it: Settings says "Coming soon".
`must_change_password` is set by nothing and read by nothing.

Adding the change-password form is the cheapest unblock in the codebase and
does not depend on Resend.

### Reception cannot action a visitor request

`RequestDetailsDialog` PATCHes `{ status }` at a DTO that does not declare it,
so approve and reject 400 every time, and the catch only logs. The real
`POST /vms/requests/:id/approve` and `/reject` are never called, and
`/vms/requests/:id/create-visit` is called by no client code at all, so an
approved request never becomes a visit. The Visitor Requests nav entry is
`hidden: true`, so reception cannot reach the queue anyway.

The employee side cannot submit either: the payload sends `company`,
`preferredDate` and `preferredTime`, none of which the DTO accepts, and omits
the required `hostEmployeeId` and `expectedArrival`.

---

## Open, screens that are permanently empty or wrong

- **Projects checklist and progress.** `GET /projects/:id/checklist` returns
  `{ items, progress }`; the client unwraps it as an array. Checklist tab empty,
  every progress figure 0, on the module whose progress is meant to be derived.
- **Projects TRY/FAILURE/OUTCOME.** Returns a grouped object, unwrapped as an
  array. The part of the module the client cares most about shows nothing.
- **Projects directory.** `findAll` sends no `members` and no `checklist_*`, so
  two of eight columns are permanently blank.
- **Project closure report.** The only read path in the module that skips
  `attachUsers`, so it is always signed "Submitted by Unknown".
- **Vendor performance panel** and the **Documents card** read keys `findOne`
  has never returned. `contract_end_date` likewise, on the directory.
- **Vendor viewer tabs.** Five of six reads require MANAGER server-side; a
  VIEWER gets silent 403s rendered as "no history recorded".
- **VMS audit and reports screens** throw or render zeros: double-wrapped
  envelopes, and `GET /vms/reports` has no bare handler at all.
- **VMS settings** calls `/vms/settings`, which does not exist. The page is one
  red box over thirty unreachable fields.
- **Check-out list** is capped at 20 with client-side search over those 20, so
  visitor 21 cannot be checked out and the search says "nobody inside".
- **Requests** render `Invalid Date` on every card, and the reassignment picker
  offers the current assignee because the id it filters on is never sent.
- **Admin** and **Transfers** are "Coming soon" stubs. `src/api/admin.ts` points
  at `/admin/*` routes that do not exist; `src/api/transfers.ts` uses PUT where
  the server is PATCH and reads a paginated envelope from a bare array. ADMINs
  are redirected to the stub on login.
- **Incentives** has no server module at all. The client has an api file, two
  hooks and a stub page reachable only by URL.

## Open, controls that lie

Every one of these offers a value or an action the server refuses, and none
surfaces the refusal:

- Task detail Verify and Abort always 400. Five of the manager dropdown's
  options are unreachable transitions, and two more need a reason the UI never
  collects.
- Self-actions status dropdown offers all four values; the service allows a
  subset and the 400 is swallowed into a silent refetch.
- Project status select offers every status regardless of the transition table.
  KPI statuses, milestone `MISSED`, and member roles `CO_LEAD`/`PROJECT_LEAD`
  are all refused.
- Deliverable `DELIVERED`, contract `RENEWED` missing, pass filters `GENERATED`
  and `PRINTED`, appointment `COMPLETED`, report `INSIDE`.
- Vendor edit cannot clear a field: blanks are pruned, absent means unchanged.
  Same on profile mobile number.
- Paper size does nothing. `data-print-size` is written and no CSS reads it, and
  a duplicate top-level `@page` overrides the A5 rule, so everything prints A4.
- Every date-range filter silently drops the last day; the appointment calendar
  sets from = to and therefore always returns nothing.

## Open, silent failures

Roughly thirty mutations across the app have no `onError` and no `isError`
render. The pattern is always the same: the button re-enables and nothing else
happens. Concentrated in VMS dialogs (six catch blocks that only reach the
console, two of which log a bare string and discard the error), project
checklist ticks and deletes, event writes, holiday delete and tier-move, poll
close and delete, and the whole vendor portal.

`asset-table` copy-to-clipboard is the sharpest: on a non-secure origin the
reveal succeeds and writes an audit row, then the clipboard call throws and the
message blames the read. Retrying burns another audit row.

Related: `queryClient` sets `mutations: { retry: 1 }`, so a failed reveal writes
two audit rows for one user action.

## Open, accessibility

Consistent across all ten slices, so treat it as one workstream rather than
sixty tickets:

- No `htmlFor`/`id` pairing anywhere. Effectively every input in the product is
  unnamed to a screen reader.
- Icon-only buttons without `aria-label`: close, delete, edit, view, chevrons,
  the mobile hamburger, the reception keypad's Clear and Backspace.
- No `autoComplete` on any credential field, so password managers cannot fill
  or save on any screen.
- Hand-rolled modals with no focus trap, no Escape, no `role="dialog"`, while
  `components/ui/dialog.tsx` wraps a primitive that does all three.
- No skip link, no focus move on route change, no `role="alert"` on any error
  banner.
- The reception access code cannot be typed on a keyboard; the on-screen keypad
  is the only input.

## Open, worth a decision rather than a fix

- `ErrorBoundary` is not a boundary. It is a `window` listener that renders
  `[object Object]` over the whole app and offers "Go to Login" as the only
  recovery, sitting above a correct `app/(protected)/error.tsx` that already
  works. The vendor portal has no boundary at all.
- Vendor deliverables is the one vendor payload with no `select`, so it returns
  `owner_id` and `project_id` to an external login. Nothing renders them; they
  are in the body.
- Nothing in the module can edit or delete a vendor work row. A deliverable
  created PENDING can never reach ACCEPTED, so on-time percentage can never move
  off zero for work created through this UI.
- Events notify nobody, by design. A coordinator is added and never told.
- Dashboard "Completion Rate, current month" is all-time; "Active Tasks, across
  all departments" is department-scoped for everyone but MD; "Pending Requests"
  and "Pending Approvals" are the same number twice.
- The scoring table puts an all-time overdue count in a per-month row.
- Every list in VMS is capped at page one with no pager, and the server returns
  the totals that would drive one.

---

## Note on the fixed set

None of it was exercised against a running app with real data; there is no login
in the working copy and 37 of 61 tables are empty. Client and server typecheck
clean, 199 tests pass, the client builds, and each fix was traced to the server
handler that proves it. Verify against real data before relying on any of it.
