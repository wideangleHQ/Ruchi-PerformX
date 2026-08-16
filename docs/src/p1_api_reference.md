# API reference

Base URL: `http://localhost:4000/api/v1` in development,
`https://api.ruchiperformx.in/api/v1` in production.

Every endpoint requires `Authorization: Bearer <jwt>` unless it is marked
public. Roles listed are what `@Roles(...)` allows; the service layer applies
further department and ownership checks on top. An endpoint with no role list
is reachable by any authenticated user.

Abbreviations: `ASSISTANTS` means EA, PA, and DEPARTMENT_CONTROLLER.

## Auth

| Method | Path | Roles |
| --- | --- | --- |
| POST | `/auth/register` | public |
| POST | `/auth/login` | public |
| POST | `/auth/forgot-password` | public |
| POST | `/auth/verify-reset-otp` | public |
| POST | `/auth/reset-password` | public |
| POST | `/auth/verify` | public, used by CareerX |
| GET | `/auth/check-md` | public |
| GET | `/auth/check-ea` | public |
| GET | `/auth/check-pa` | public |
| GET | `/auth/check-hod/:departmentId` | public |
| GET | `/auth/check-hod-name/:departmentName` | public |
| GET | `/auth/departments` | public |
| POST | `/auth/change-password` | authenticated |
| POST | `/auth/logout` | authenticated |
| GET | `/auth/me` | authenticated |

## Users

| Method | Path | Roles |
| --- | --- | --- |
| GET | `/users` | MD, ADMIN, HOD, EA, PA, PURCHASE_HEAD, EMPLOYEE |
| GET | `/users/assignable` | MD, HOD, EA, PA, DEPT_CONTROLLER, PURCHASE_HEAD |
| GET | `/users/department/:departmentId` | MD, HOD, ADMIN, EA, PA, PURCHASE_HEAD |
| GET | `/users/:id` | MD, HOD, ADMIN, EA, PA, PURCHASE_HEAD |
| GET | `/users/check-md` | MD, HOD, ADMIN |
| GET | `/users/check-hod/:departmentId` | MD, HOD, ADMIN |
| POST | `/users` | ADMIN |
| PATCH | `/users/:id` | ADMIN |
| DELETE | `/users/:id` | ADMIN |
| GET | `/users/pending` | MD, HOD, EA, PA |
| PATCH | `/users/:id/approve` | MD, HOD, EA, PA |
| PATCH | `/users/:id/reject` | MD, HOD, EA, PA |
| GET | `/users/password-reset-requests` | MD, HOD, EA, PA |
| PATCH | `/users/:id/reset-password` | MD, HOD, EA, PA, ADMIN |
| PATCH | `/users/:id/admin-reset-password` | ADMIN |

Route ordering caution: `/users/pending` and `/users/password-reset-requests`
are declared after `/users/:id` in the controller file. Nest matches in
declaration order, so those literal paths are shadowed unless the parameterised
route rejects a non-UUID id. It works today because the service throws on a
malformed UUID, but the ordering is fragile. If you add another literal route
under `/users`, put it above `/users/:id`.

## Departments

| Method | Path | Roles |
| --- | --- | --- |
| GET | `/departments` | MD, EA, PA, DEPT_CONTROLLER, HOD, ADMIN |
| GET | `/departments/:id` | same |
| POST | `/departments` | ADMIN |
| PATCH | `/departments/:id` | ADMIN |
| GET | `/internal/departments` | `x-internal-api-key` header, not a JWT |

## Internal

Service-to-service only. Authenticated by the `x-internal-api-key` header
through `InternalApiGuard`, marked `@Public()` so the JWT guard stands aside,
and hidden from Swagger. CareerX is the only caller.

| Method | Path | Roles |
| --- | --- | --- |
| GET | `/internal/departments` | `x-internal-api-key` header, not a JWT |
| GET | `/internal/employees` | same |

`/internal/employees` returns a bare array of
`{ id, fullName, email, departmentId, role, isActive }`, one entry per user that
has not been soft deleted. Deactivated users are included with
`isActive: false`, on purpose: CareerX deactivates an `hr_employees` row by
seeing that flag flip, so dropping them from the payload would leave a departed
employee with career portal access.

## Tasks

| Method | Path | Roles |
| --- | --- | --- |
| POST | `/tasks` | MD, HOD, ASSISTANTS, PURCHASE_HEAD |
| GET | `/tasks` | MD, HOD, EMPLOYEE, ASSISTANTS, PURCHASE_HEAD |
| GET | `/tasks/pending` | same |
| GET | `/tasks/overdue` | MD, HOD, ASSISTANTS, PURCHASE_HEAD |
| GET | `/tasks/delegated-out` | HOD |
| GET | `/tasks/meta/departments` | MD, HOD, ASSISTANTS, PURCHASE_HEAD |
| GET | `/tasks/meta/assignees` | MD, HOD, ASSISTANTS, PURCHASE_HEAD |
| GET | `/tasks/meta/delegation-departments` | HOD |
| GET | `/tasks/:id` | MD, HOD, EMPLOYEE, ASSISTANTS, PURCHASE_HEAD |
| PATCH | `/tasks/:id` | MD, HOD, ASSISTANTS, PURCHASE_HEAD |
| DELETE | `/tasks/:id` | MD, HOD, ASSISTANTS, PURCHASE_HEAD |
| PATCH | `/tasks/:id/accept` | MD, EMPLOYEE, ASSISTANTS |
| PATCH | `/tasks/:id/reject` | MD, EMPLOYEE, ASSISTANTS |
| PATCH | `/tasks/:id/progress` | MD, EMPLOYEE, ASSISTANTS |
| PATCH | `/tasks/:id/complete` | MD, EMPLOYEE, ASSISTANTS |
| PATCH | `/tasks/:id/review` | MD, HOD, ASSISTANTS, PURCHASE_HEAD |
| PATCH | `/tasks/:id/close` | MD, HOD, ASSISTANTS |
| PATCH | `/tasks/:id/return` | MD, HOD, ASSISTANTS |
| PATCH | `/tasks/:id/status` | MD, HOD, ASSISTANTS, PURCHASE_HEAD, EMPLOYEE |

Employee shared tasks:

| Method | Path | Roles |
| --- | --- | --- |
| POST | `/tasks/employee-sharing` | EMPLOYEE |
| GET | `/tasks/employee-sharing` | MD, HOD, EMPLOYEE, ASSISTANTS, PURCHASE_HEAD |
| GET | `/tasks/employee-sharing/assignees` | same |
| GET | `/tasks/employee-sharing/departments` | EMPLOYEE |
| PATCH | `/tasks/employee-sharing/:id/status` | MD, HOD, EMPLOYEE, ASSISTANTS, PURCHASE_HEAD |
| DELETE | `/tasks/employee-sharing/:id` | HOD, MD, DEPT_CONTROLLER |

## Self actions

All open to EMPLOYEE, HOD, MD, EA, PA, DEPT_CONTROLLER. Reads and updates also
allow ADMIN.

| Method | Path |
| --- | --- |
| POST | `/self-actions` |
| GET | `/self-actions` |
| GET | `/self-actions/:id` |
| PATCH | `/self-actions/:id` |
| PATCH | `/self-actions/:id/status` |
| DELETE | `/self-actions/:id` |
| GET | `/self-actions/:id/comments` |
| POST | `/self-actions/:id/comments` |

## Projects

Every role except VENDOR. Project visibility is company wide, so the role list
only keeps external accounts out; the membership rules below are service-layer
checks that `RolesGuard` cannot express, because the JWT carries a company role
and says nothing about who leads which project. Vendors reach projects through
`vendor_assignments` in the vendor portal namespace, never here.

| Method | Path | Who |
| --- | --- | --- |
| POST | `/projects` | any internal user |
| GET | `/projects` | any internal user |
| GET | `/projects/mine` | any internal user, scoped to their memberships |
| GET | `/projects/:id` | any internal user |
| PATCH | `/projects/:id` | project Lead, Co-Lead |
| DELETE | `/projects/:id` | project Lead, MD, soft delete |
| POST | `/projects/:id/members` | project Lead, Co-Lead |
| DELETE | `/projects/:id/members/:userId` | project Lead, Co-Lead |
| GET | `/projects/:id/activity` | any internal user |

`/projects/mine` is declared above `/projects/:id` in the controller. Keep any
further literal route above it too.

`GET /projects` and `/projects/mine` take the directory filters, which compose:
`search`, `status`, `health`, `priority`, `category`, `departmentId`, `leadId`,
`dateFrom`, `dateTo`, `mine`, `overdue`, `dueThisWeek`, `page`, `limit`. The
date range bounds `created_at`; `overdue` and `dueThisWeek` are the deadline
windows. Both return `{ data, total, page, limit }` with the Lead, Co-Lead, and
creator resolved into `lead_id_user` and friends.

`PATCH /projects/:id` will not accept `project_code`, which is generated once
and immutable, or `health`, which the deadline sweep derives. A `status` in the
payload runs through the transition table in `projects.service.ts`, so a value
that is legal for the enum is still refused when it is not a legal move from
the project's current status. `COMPLETED` additionally requires a
`project_closure_reports` row.

`POST /projects/:id/members` hands out `MEMBER` or `OBSERVER` only, and the
picker behind it lists every active internal user rather than the caller's
department. Leadership is reassigned through PATCH, which rewrites the matching
member rows so the columns and the member list cannot disagree. An observer
reads everything a member reads and writes nothing.

## Comments

| Method | Path |
| --- | --- |
| POST | `/comments` |
| GET | `/comments/task/:taskId` |
| PATCH | `/comments/:id` |
| DELETE | `/comments/:id` |
| POST | `/tasks/:taskId/comments` |
| GET | `/tasks/:taskId/comments` |

## Attachments

| Method | Path |
| --- | --- |
| POST | `/attachments/upload/:taskId` |
| POST | `/attachments/upload/:taskId/comments/:commentId` |
| POST | `/attachments/upload/self-actions/:actionId` |
| POST | `/attachments/upload/self-actions/:actionId/comments/:commentId` |
| GET | `/attachments/task/:taskId` |
| GET | `/attachments/task/:taskId/comments/:commentId` |
| GET | `/attachments/self-actions/:actionId` |
| GET | `/attachments/self-actions/:actionId/comments/:commentId` |
| DELETE | `/attachments/:id` |

## Requests

| Method | Path | Roles |
| --- | --- | --- |
| POST | `/requests` | EMPLOYEE, HOD, EA, PA, DEPT_CONTROLLER, PURCHASE_HEAD |
| GET | `/requests` | above plus MD |
| GET | `/requests/:id` | above plus MD |
| PATCH | `/requests/:id/approve` | HOD, MD, EA, PA, DEPT_CONTROLLER, PURCHASE_HEAD |
| PATCH | `/requests/:id/reject` | same |

## Transfers

| Method | Path | Roles |
| --- | --- | --- |
| POST | `/transfers` | HOD, MD |
| GET | `/transfers` | HOD, MD |
| GET | `/transfers/:id` | HOD, MD |
| PATCH | `/transfers/:id/approve` | HOD, MD |
| PATCH | `/transfers/:id/reject` | HOD, MD |

## Projects

Every project route is open to all internal roles. VENDOR is not on the list;
vendors reach projects through the portal namespace only. Lead and Co-Lead are
project membership rather than JWT roles, so `RolesGuard` cannot express them
and the service checks membership on top. The full route table is in
[Projects](p2_projects.md#endpoints).

Closure:

| Method | Path | Roles |
| --- | --- | --- |
| POST | `/projects/:id/closure` | internal, Lead or Co-Lead of the project |
| GET | `/projects/:id/closure` | internal, 404 until one is filed |
| PATCH | `/projects/:id/close` | internal, Lead or Co-Lead, 400 without a closure report |

There is no MD review. `POST /projects/:id/closure` files the report and
notifies the project; `PATCH /projects/:id/close` moves the project to
`COMPLETED` through the normal transition check. A second POST returns 409 —
the unique constraint on `project_closure_reports.project_id` is what enforces
one report per project.

`projects.health` is not settable through any route. `ProjectDeadlineCron.sweep()`
recomputes it daily at 08:00 from deadline proximity, checklist completion, and
the counts of overdue checklist items and milestones. The same sweep sends
`PROJECT_DEADLINE_NEAR` to the Lead and Co-Lead 7 days out, 1 day out, and on
the day, and `PROJECT_OVERDUE_NO_CLOSURE` to the MD once the deadline passes
with nothing filed.
Every internal role is listed on these; `VENDOR` is not, and must not be added
without the assignment scope check described in
[Vendor management](p2_vendors.md). The route table for the rest of the module
is in [Projects](p2_projects.md#endpoints).

| Method | Path | Who |
| --- | --- | --- |
| GET | `/projects/:id/messages` | project members, not observers |
| POST | `/projects/:id/messages` | project members, not observers |
| GET | `/projects/:id/outcomes` | any internal reader |
| POST | `/projects/:id/outcomes` | project members, not observers |

Membership is a service-layer check against `project_members.role`, not
something `RolesGuard` can express. A caller with no membership row and a caller
with `OBSERVER` both get the same 403.

The message thread is the one part of a project an observer cannot read.
Everything else about a project is visible company-wide; a conversation is
participation, so `GET /messages` is gated the same way `POST /messages` is.

`GET /projects/:id/outcomes` returns the entries grouped, not as a flat list:

```json
{ "TRY": [...], "FAILURE": [...], "OUTCOME": [...] }
```

`POST` takes an explicit `entry_type` of `TRY`, `FAILURE`, or `OUTCOME` with no
default. There is no update or delete route for an outcome, by design: the
entries are the project's permanent record, and a failure that can be edited
away later stops being worth writing down.

Posting an outcome also writes a `project_activity_logs` row. Posting a message
does not. Messages are conversation and the activity log is the audit trail, and
the trail stays skimmable only if chat stays out of it.
## Vendor work tracking

Internal Vendor Management. The role list on every route below is every
internal role, and it decides nothing on its own: the service calls
`VendorScopeService.assertAccess` and the `vendor_dashboard_access` row is what
actually grants entry. `VM` in the table means the level that row has to hold,
with MD and EA holding admin implicitly.

The external vendor role appears on none of these and must not be added.
`just vendor-roles` fails the build if it is. See
[Vendor management](p2_vendors.md#the-trust-boundary).

| Method | Path | VM level |
| --- | --- | --- |
| GET | `/vendor-assignments` | manager |
| POST | `/vendor-assignments` | manager |
| PATCH | `/vendor-assignments/:id` | manager, or viewer if the assigner |
| DELETE | `/vendor-assignments/:id` | manager, or viewer if the assigner |
| GET | `/vendor-contracts` | manager |
| POST | `/vendor-contracts` | manager |
| PATCH | `/vendor-contracts/:id` | manager |
| GET | `/vendor-documents` | manager |
| POST | `/vendor-documents` | manager |
| DELETE | `/vendor-documents/:id` | admin |
| GET | `/vendor-deliverables` | manager |
| POST | `/vendor-deliverables` | manager |
| PATCH | `/vendor-deliverables/:id` | manager, or viewer if the owner |
| GET | `/vendor-notes` | viewer |
| POST | `/vendor-notes` | viewer |
| GET | `/vendor-reviews` | manager |
| POST | `/vendor-reviews` | manager |
| GET | `/vendors/:id/deadlines` | viewer |
| GET | `/vendors/:id/performance` | viewer |

`GET /vendor-documents` rows carry a `status` of `ACTIVE`, `EXPIRING_SOON` or
`EXPIRED`. It is computed from `expiry_date` against a 30 day window on every
read and is not a column; the nightly deadline sweep calls the same function,
so the list and the reminder cannot disagree by a day. A document with no
expiry date is `ACTIVE`.

`POST /vendor-documents` takes `file_url` and `storage_path` for a file already
uploaded through the attachments module. A `storage_path` outside the
`vendors/documents/` prefix is a 400.

`GET /vendors/:id/deadlines` is a read over four tables, not a table. It unions
contract expiry and renewal, document expiry, assignment deadlines and
deliverable due dates, ascending, each with `days_until` and a flag of
`OVERDUE`, `SOON` or `UPCOMING`.

`GET /vendors/:id/performance` computes deliverable counts, on-time percentage
from `submitted_date` against `due_date`, open assignments, and the rating
averaged over `vendor_reviews`. `on_time_percentage` is `null`, not `0`, when
no deliverable has both dates. Internal data; never returned to a vendor.

`GET /vendor-notes` returns both note threads and takes an optional
`thread=internal|shared`. The shared thread has a separate service method with
`is_internal: false` written into it, which is what keeps the RUCHI-only thread
off any portal query path.
## Leave

`STAFF` below means every role except VENDOR: MD, EA, PA,
DEPARTMENT_CONTROLLER, PURCHASE_HEAD, HOD, EMPLOYEE, ADMIN, HR.

| Method | Path | Roles |
| --- | --- | --- |
| POST | `/leave/applications` | STAFF |
| GET | `/leave/applications/pending` | HOD, HR, MD |
| GET | `/leave/applications/mine` | STAFF |
| GET | `/leave/applications/:id` | STAFF, own or actionable |
| PATCH | `/leave/applications/:id/cancel` | STAFF, own and `PENDING` only |
| PATCH | `/leave/applications/:id/approve` | HOD, HR, MD |
| PATCH | `/leave/applications/:id/reject` | HOD, HR, MD, remark required |
| PATCH | `/leave/applications/:id/hr-cancel` | HR, reason required, `APPROVED` only |
| GET | `/leave/balance` | STAFF, own, current financial year |
| GET | `/leave/calendar` | STAFF, scoped to what the caller can see |
| GET | `/leave/types` | STAFF, inactive types shown to HR and ADMIN |
| POST | `/leave/types` | HR, ADMIN |
| PATCH | `/leave/types/:id` | HR, ADMIN |
| GET | `/leave/balances` | HR |
| PATCH | `/leave/balances/:id` | HR, manual correction |
| GET | `/leave/reports/monthly` | HR, MD |
| GET | `/leave/reports/export` | HR, MD, returns xlsx |

The MD is on `approve` and `reject` although
[Leave management](p2_leave.md) lists only HOD and HR. Nobody approves their own
application, so a HOD's or an HR user's own leave has nowhere else to go.

`POST /leave/applications` returns every validation failure at once in the
`message` array, not the first one. Submission runs six rules: date order,
overlap with an existing `PENDING` or `APPROVED` application, a range that is
not entirely holidays and weekly offs, a day count of at least 0.5, a
sufficient balance for paid types, and an attachment for types with
`requires_proof`.

Approve and HR-cancel both put the current status in the `where` clause of an
`updateMany`, so the second of two concurrent approvers gets a 409 rather than a
second deduction. HR cancellation credits the balance back.

Holiday endpoints are in [Leave management](p2_leave.md#endpoints) and belong to
the holidays module, not this one.

## Notifications

| Method | Path |
| --- | --- |
| GET | `/notifications` |
| GET | `/notifications/unread-count` |
| PATCH | `/notifications/:id/read` |
| DELETE | `/notifications/:id` |

## Scoring

| Method | Path | Roles |
| --- | --- | --- |
| GET | `/hod-score/me` | MD, EA, PA, HOD and related |
| GET | `/hod-score/company` | same |
| GET | `/hod-score/trends` | same |
| GET | `/hod-score/department/:departmentId` | same |
| GET | `/hod-score/:hodId` | same, plus `HodScoreAccessGuard` |

Employee scores, added in Phase 2. Unbounded points, a different scale to the
HOD score above:

| Method | Path | Roles |
| --- | --- | --- |
| GET | `/scoring/me` | any authenticated user, own row only |
| GET | `/scoring/me/trend` | same |
| GET | `/scoring/leaderboard` | MD, EA, PA, DEPT_CONTROLLER, HOD |
| GET | `/scoring/department/:departmentId` | same, within department scope |
| GET | `/scoring/department/:departmentId/trend` | same |

The `me` routes take identity from the JWT and carry no `@Roles`, so every role
reaches its own score and no other. The department routes are re-checked against
`DepartmentScopeService`, so a HOD sees only their own departments.

Both trend endpoints accept `month`, `year`, and `months` (1 to 24, default 6)
and return the series oldest first. A month inside the window with no stored row
comes back as `hasScore: false` and `points: null`, which is not the same as a
stored zero. A user with no history at all returns an empty series.

## Holidays

| Method | Path | Roles |
| --- | --- | --- |
| GET | `/holidays` | authenticated |
| GET | `/holidays/upcoming` | authenticated |
| POST | `/holidays` | HR, HOD, ADMIN |
| PATCH | `/holidays/:id` | HR, HOD, ADMIN |
| DELETE | `/holidays/:id` | HR, HOD, ADMIN |

Two tiers. `holidays.department_id` is null for a common holiday, which applies
company-wide, and set for a department-wise one. A user's effective calendar is
the union of both, which is what `GET /holidays` returns, each row tagged
`tier: "COMMON" | "DEPARTMENT"`. A date held by both tiers appears once, as the
common row, so a leave day count never deducts it twice.

`GET /holidays?year=` defaults to the current calendar year.
`GET /holidays/upcoming?limit=` defaults to five and adds `daysUntil`, where
today is zero. It feeds the dashboard countdown banner.

The write roles are not equal, and the difference is in the service rather than
in `@Roles`. HR and ADMIN write both tiers. A HOD writes only the departments
`DepartmentScopeService` resolves for them, and a HOD posting a common holiday
gets a 403. HR is treated as company-wide here and only here; it is not in
`DepartmentScopeService`'s unrestricted list, because for tasks and scores it is
not unrestricted.

`PATCH` takes `name`, `date`, and `isOptional` only. There is no `departmentId`,
so moving a holiday between tiers is a delete plus a create, and sending one
returns a 400 from `forbidNonWhitelisted`.

Dates are `YYYY-MM-DD` in both directions. A duplicate returns 409 rather than
500: the model's `[holiday_date, name, department_id]` unique index catches the
department tier, and the hand-written partial index `holidays_common_uniq`
catches the common tier, where the NULL department would otherwise let a second
identical row through.

`just seed-holidays` loads the fixed-date national holidays as common holidays
for the current and next year. It is safe to rerun.
## Polls

| Method | Path | Roles |
| --- | --- | --- |
| GET | `/polls/active` | every internal role |
| GET | `/polls` | every internal role |
| POST | `/polls` | every internal role |
| GET | `/polls/:id` | every internal role |
| POST | `/polls/:id/vote` | every internal role |
| PATCH | `/polls/:id/close` | every internal role, creator or MD in the service |
| DELETE | `/polls/:id` | every internal role, creator or MD in the service |

"Every internal role" is all of them except VENDOR. Raising a poll is not a
management privilege; any employee can do it. Closing and deleting are open to
the role list and narrowed to the creator or the MD in `PollsService`, which
returns 403 rather than 404 because the poll itself is company wide.

`/polls/active` is declared above `/polls/:id` in the controller so it is not
shadowed.

Polls are not anonymous. Every response carries `createdBy` and the UI shows
that name next to the question.

Whether a poll is open is computed from `closes_at` at read time and returned as
`isOpen`. No job flips a column at midnight, so a poll cannot get stuck open
because a cron did not run. `is_closed` remains for manual early closure by the
creator and overrides `closes_at` in both directions.

One vote per person is the unique key on `(poll_id, user_id)`, not an
application check. `POST /polls/:id/vote` upserts on that key, so voting again
changes your vote rather than failing. Every poll response includes
`myVoteOptionId`, the caller's own choice, so the card paints the right state on
first render without a second request.

A vote or a close broadcasts `poll:updated` on the socket with the new tallies.
Polls are company wide, so this is a genuine broadcast rather than a room.
Creating one notifies every other active internal user with `POLL_CREATED`.

## Dashboard and profile

| Method | Path |
| --- | --- |
| GET | `/dashboard` |
| GET | `/profile` |
| PATCH | `/profile` |

`GET /dashboard` returns a different payload per role. It is the aggregation
layer over tasks, self actions, requests, scores, and incentives, and it also
carries the social layer:

| Field | What it is |
| --- | --- |
| `birthdays` | Everyone whose birthday is today, with department name |
| `upcomingHoliday` | The next holiday with `daysAway`, or null |
| `activePolls` | Up to five open polls with the caller's vote state |

This stays one call. The dashboard loads on every login and five requests to
five endpoints is a worse first paint than one wide one. If a list grows, it is
trimmed inside the payload rather than moved to its own route.

`birthdays` is derived from `users.date_of_birth` on every read, matching month
and day and ignoring the year. There is no `birthday_cards` table: nothing needs
storing, and a table would need one job to populate it and another to expire it.
A 29 February birthday is shown on 28 February in a non-leap year, so it gets a
card every year rather than one every four. There is deliberately no
`BIRTHDAY_TODAY` notification; the card is enough, and a notification per
birthday in a hundred-person company is noise.

`PATCH /profile` accepts `dateOfBirth` as a date string or as null. Null clears
it and removes the person from the birthday card for good. The column is
nullable and is never required anywhere.

## Project execution

Checklist, milestones, success criteria, and KPIs. Every route is open to every
internal role; VENDOR is excluded, because a vendor reaches its projects
through the vendor portal. Write access is decided in the service by project
role, which `RolesGuard` cannot see. See [Projects](p2_projects.md).

| Method | Path | Who |
| --- | --- | --- |
| GET | `/projects/:id/checklist` | any internal role |
| POST | `/projects/:id/checklist` | Lead, Co-Lead |
| PATCH | `/projects/:id/checklist/:itemId` | Lead/Co-Lead any field; member `is_done` only, own assignment only |
| DELETE | `/projects/:id/checklist/:itemId` | Lead, Co-Lead |
| GET | `/projects/:id/milestones` | any internal role |
| POST | `/projects/:id/milestones` | Lead, Co-Lead |
| PATCH | `/projects/:id/milestones/:milestoneId` | Lead, Co-Lead |
| DELETE | `/projects/:id/milestones/:milestoneId` | Lead, Co-Lead |
| GET | `/projects/:id/success-criteria` | any internal role |
| POST | `/projects/:id/success-criteria` | Lead, Co-Lead |
| DELETE | `/projects/:id/success-criteria/:criterionId` | Lead, Co-Lead |
| GET | `/projects/:id/kpis` | any internal role |
| POST | `/projects/:id/kpis` | Lead, Co-Lead |
| PATCH | `/projects/:id/kpis/:kpiId` | Lead, Co-Lead |

`GET /projects/:id/checklist` returns `{ items, progress }`. `progress` is
`{ done, total, percent }`, computed from checklist completion on every read.
There is no column behind it and no endpoint that sets it. Checklist items and
milestones both carry a derived `is_overdue`, so the client does not compare
dates itself.

A member's PATCH is narrowed to `is_done` server side. A body carrying
`due_date`, `priority`, `title`, or `assigned_to_id` is not rejected, those keys
are dropped; a member PATCH with no `is_done` is a 400.

Success criteria are one row per criterion so closure can check them off
individually. KPIs are optional and a project with none is normal.
## Vendor management

Internal only. `INTERNAL` is every role except `VENDOR`; the external portal
has its own namespace and shares no controller with these. The role list is
the outer fence, and it is a wide one. What decides who reads the vendor book
is the level column, checked in `VendorsService` through
`VendorScopeService.assertAccess`. MD and EA hold every level by role and need
no `vendor_dashboard_access` row.

| Method | Path | Roles | Level |
| --- | --- | --- | --- |
| GET | `/vendors` | INTERNAL | VENDOR_VIEWER |
| POST | `/vendors` | INTERNAL | VENDOR_MANAGER |
| GET | `/vendors/pickable` | INTERNAL | none |
| GET | `/vendors/:id` | INTERNAL | VENDOR_VIEWER |
| PATCH | `/vendors/:id` | INTERNAL | VENDOR_MANAGER, or the vendor's internal owner |
| PATCH | `/vendors/:id/status` | INTERNAL | VENDOR_MANAGER |
| GET | `/vendor-categories` | INTERNAL | VENDOR_VIEWER |
| POST | `/vendor-categories` | HR, EA, MD | none |
| GET | `/vendor-access/me` | authenticated | none |
| GET | `/vendor-access` | MD, EA | none |
| POST | `/vendor-access` | MD, EA | none |
| DELETE | `/vendor-access/:userId` | MD, EA | none |

There is no `DELETE /vendors/:id` and there is not going to be one.
`PATCH /vendors/:id/status` moves a vendor to `EXPIRED` or `TERMINATED`
instead, because assignments, documents and contracts point at the row and
have to outlive the relationship.

`GET /vendors/pickable` returns id, name and category for ACTIVE vendors only,
and is the one vendor read an employee without a grant can make. It exists so
that assigning work does not require opening `GET /vendors`, whose rows carry
internal owner, notes, contract and status.

`vendor_code` is generated on create as `VEN-0001` and is not settable or
editable. `forbidNonWhitelisted` rejects a request that sends one.

`GET /vendor-access/me` returns `{ accessLevel: string | null }`. The client's
`useNavAccess` hook reads it to decide whether the Vendors sidebar entry
renders, so the shape is load bearing.

See [Vendor management](p2_vendors.md) for the module, and
[Vendor roles are not employee roles](p1_auth_and_roles.md#vendor-roles-are-not-employee-roles)
for why the external portal never appears in the table above.
## Innovation and R&D

| Method | Path | Roles |
| --- | --- | --- |
| GET | `/rnd/team` | MD, EA, PA |
| POST | `/rnd/team` | MD, EA, PA |
| DELETE | `/rnd/team/:userId` | MD, EA, PA |
| GET | `/rnd/team/me` | authenticated |
| POST | `/rnd/reports` | internal roles, R&D members only |
| GET | `/rnd/reports` | internal roles, scoped by category |
| GET | `/rnd/reports/categories` | internal roles, scoped by category |
| GET | `/rnd/reports/:id` | internal roles, scoped by category |
| PATCH | `/rnd/reports/:id` | the submitter, before the MD office reads it |

Membership is a grant per person rather than a role, so `@Roles` cannot express
it. The report routes are open to every internal role and `RndService` decides
what comes back: MD, EA, and PA read every category, a team member reads the
categories they have submitted into, and everybody else gets an empty list.
`POST /rnd/reports` is the one place a non-member is rejected outright, with a
403.

`GET /rnd/team/me` returns `{ "isMember": boolean }`. `useNavAccess` calls it to
decide whether the R&D sidebar item renders at all, so the shape is load
bearing.

`GET /rnd/reports/:id` is a write when the caller is MD, EA, or PA: it stamps
`md_viewed_at`, which is what closes the submitter's `PATCH` window. Editing
after that returns a 400.

There is no delete endpoint, deliberately. R&D history is retained per category
and removing someone from the roster leaves their reports in place.

R&D projects are ordinary projects with `is_rnd = true`; they use the
`/projects` routes rather than anything under `/rnd`.

## Vendor portal

The external half of the vendor module, and the only place in this API where the
token holder is not an employee. `VENDOR` is the only role on every route, and
`RolesGuard` is the outer fence only: each one is scoped through
`vendor_assignments` in `VendorPortalService` before it returns anything. Detail
routes call `VendorScopeService.assertVendorAccess`, list routes merge
`VendorScopeService.vendorFilter` into their `where`.

| Method | Path | Scope applied |
| --- | --- | --- |
| GET | `/vendor/dashboard` | own assignments only |
| GET | `/vendor/tasks` | `vendorFilter('task')`, optional `?status=` |
| GET | `/vendor/tasks/:id` | `assertVendorAccess`, 403 if not assigned |
| PATCH | `/vendor/tasks/:id/status` | `assertVendorAccess`, then the four vendor transitions |
| GET | `/vendor/projects` | `vendorFilter('project')` |
| GET | `/vendor/projects/:id` | `assertVendorAccess`, 403 if not assigned |
| GET | `/vendor/messages` | shared `vendor_notes` thread for this vendor |
| POST | `/vendor/messages` | writes `is_internal: false`, always |
| GET | `/vendor-deliverables/mine` | `vendor_id` equals this vendor |
| PATCH | `/vendor-deliverables/:id/submit` | own only, sets `SUBMITTED` |

That is the complete list. A vendor reaching anything else is a bug, including
everything under `/vendors`, `/vendor-contracts`, `/vendor-documents`,
`/vendor-notes`, `/vendor-reviews`, `/vendor-categories`, `/vendor-access`,
`/hod-score`, `/scoring`, `/leave`, `/holidays`, `/assets`, `/rnd`, `/polls`,
`/incentives`, `/transfers`, `/vms`, and `/users`. If a vendor needs something
new, it goes in this namespace; it does not go into an internal route behind a
role branch. `just vendor-roles` enforces that in CI.

`PATCH /vendor/tasks/:id/status` accepts `{ status, reason? }` where `status` is
one of `ACCEPTED`, `IN_PROGRESS`, `COMPLETED`, `REJECTED`. The DTO refuses any
other value before the lifecycle table is consulted, and `REJECTED` without a
reason is a 400.

Portal logins are created by an admin: `POST /users` with `role: VENDOR`,
`vendor_id` set, `department_id` null, `must_change_password: true`. There is no
vendor registration flow and there must not be one.

## VMS

See [Visitor management](p1_vms.md) for the full list. VMS endpoints require a
VMS token, not a PerformX token.

## Error shape

There is no global exception filter in PerformX, so errors come out in the
default Nest shape:

```json
{ "statusCode": 403, "message": "Insufficient permissions", "error": "Forbidden" }
```

Validation errors from the global pipe return a `message` array:

```json
{ "statusCode": 400, "message": ["title must be a string"], "error": "Bad Request" }
```

The client's axios interceptor in `src/api/client.ts` normalises both into a
single string for display. CareerX does have a global filter and a response
interceptor; PerformX does not. Adding one is a Phase 2 candidate but it changes
every response shape, so it needs the client updated in the same release.
