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

`ScoringService` has no controller. Employee scores are read through the
dashboard endpoint.

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

## Dashboard and profile

| Method | Path |
| --- | --- |
| GET | `/dashboard` |
| GET | `/profile` |
| PATCH | `/profile` |

`GET /dashboard` returns a different payload per role. It is the aggregation
layer over tasks, self actions, requests, scores, and incentives.

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
