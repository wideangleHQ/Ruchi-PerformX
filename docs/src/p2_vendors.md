# Vendor management

Two separate systems that share one word. Keep them separate in the schema,
the access model, and the UI:

1. **Internal Vendor Management** — RUCHI's own record of who its vendors and
   agencies are, what they're contracted for, their documents, deadlines, and
   performance. For MD/EA/authorized RUCHI employees only.
2. **External Vendor Portal** — a login for the vendor itself to see its own
   assigned tasks/projects and message the assigning employee. Unchanged in
   spirit from the earlier design, but explicitly secondary to (1) and never
   the same permission as (1).

This is still the highest risk module in Phase 2 because (2) is the first
time an external party gets a login. Everything else in this repository
assumes the person holding a valid JWT is an employee. Read
[Auth and roles](p1_auth_and_roles.md#how-authorization-is-enforced) before
you write the first endpoint.

## Decisions already made

**Vendor Management access and external portal login are different
permissions, granted by different people, for different purposes.** An
employee does not get Vendor Management access automatically because they
are HOD/HR/etc. — MD or EA grants it explicitly. A vendor does not see
internal data just because they have a portal login — `vendor_assignments`
is still the only allowlist for what a logged-in vendor can read.

**Vendors are never hard-deleted.** Historical assignments, documents, and
contracts must survive a vendor going `EXPIRED` or `TERMINATED`. Use
`vendor_status_enum`, not a boolean, and never delete a `vendors` row with
any history attached.

**The external login remains a `role_enum.VENDOR` user**, same database,
same deploy, same login screen — but a `vendors.id` foreign key now sits on
`users` (nullable) rather than the vendor's identity living only on the user
row. The vendor company is the source of truth; the portal account is one
optional attribute of it.

## 1. Vendor / agency master

`vendors`: name, auto-generated vendor code, vendor type, service category
(FK to `vendor_categories`), description/services provided, contact person,
contact email, contact phone, alternate contact, company address, website,
relationship start date, status, internal owner, internal department, notes,
tags.

**No contract dates on this table.** An earlier draft kept a denormalized copy
of the current contract's start and end dates here for list views. Dropped:
`vendor_contracts` is the source of truth, a vendor can have several, and a
copy with no stated sync path is wrong within a month. The directory and the
profile header join the current contract instead. If that join is ever slow
enough to matter, cache the read, do not duplicate the column.

## 2. Vendor categories

`vendor_categories`: configurable, not a hardcoded enum. Seed with Web
Development, Digital Marketing, Design Agency, IT Services, Consultancy,
Recruitment, Maintenance, Printing, Media, Other. HR/EA/MD manage the list.

## 3. Internal vendor owner

Every vendor has an accountable RUCHI employee:

```
Vendor -> Internal Owner -> Department
```

Fields on `vendors`: `owner_id`, `department_id`, `secondary_owner_id`
(nullable). This is who Vendor Management holds accountable for the
relationship, independent of who is granted portal-level Vendor Management
access.

## 4. Vendor dashboard access

Different from vendor assignment (section 5) and different from the
external portal login (section 18). This is: who inside RUCHI can open the
Vendor Management module at all.

```
Vendor Dashboard -> Access Control -> MD / EA -> Selected RUCHI employees
```

`vendor_dashboard_access`: `user_id`, `access_level`
(`VENDOR_ADMIN` / `VENDOR_MANAGER` / `VENDOR_VIEWER`), `granted_by_id`,
`granted_at`. MD and EA hold full access implicitly (checked by role, no row
needed); every other employee needs a row here to open the module at all.
Treat these as permissions granted per person, not as a role added to
`role_enum` — a fifth global role here would leak the same way `VENDOR`
would if mishandled.

## 5. Vendor assignments

Expands the existing `vendor_assignments` concept from a single allowlist
row into a tracked work item:

Fields: vendor, assignment type, project/task reference, assigned by, start
date, deadline, status, description, priority.

This answers "what are we using this vendor for" at a glance, and is still
the same table that gates what a logged-in vendor (section 18) can see —
that access-control role of the table does not change.

## 6. Legal and compliance documents

`vendor_documents` with `category = LEGAL`. Types: Agreement, Contract, NDA,
GST Certificate, PAN, Registration Certificate, Bank Details Document,
Insurance, Compliance Document, Work Order, Purchase Order, Other.

Fields: document name, document type, issue date, expiry date, uploaded by,
uploaded at, status, attachment.

`document_status` is derived, not hand-set: `ACTIVE` / `EXPIRING_SOON`
(inside a configurable window, default 30 days) / `EXPIRED`. Compute on read
or on a daily sweep alongside the deadline tracker in section 8 — pick one
and reuse it, do not build two separate expiry calculators.

## 7. Contract management

A vendor can have one or more contracts.

`vendor_contracts`: contract number, contract type, start date, end date,
renewal date, status, description, plus documents linked via
`vendor_documents.contract_id`.

This is central: deadlines and renewals are one of the main reasons the
module exists.

## 8. Deadline and renewal tracking

A single `GET /vendors/:id/deadlines` view aggregating, per vendor: contract
expiry, renewal date, document expiry, assignment deadlines, project
deadlines, deliverable due dates, review dates, and compliance deadlines.
Do not build a separate table for this — it is a read that unions
`vendor_contracts`, `vendor_documents`, `vendor_assignments`, and
`vendor_deliverables` by date, sorted ascending, with a soon/overdue flag.

Notifications trigger automatically ahead of these dates — see
Notifications below.

## 9. Assignments and work tracking

Per vendor, surface: active assignments, projects, tasks, deliverables,
deadlines, and history, with rollup counts (total, active, completed,
overdue). This is the "how much work is this vendor actually doing" view
and it is built from `vendor_assignments` and `vendor_deliverables`, not a
new table.

## 10. Deliverables

`vendor_deliverables`: name, description, vendor, project (nullable), owner,
due date, submitted date, status, attachments, remarks.

`deliverable_status_enum`: `PENDING`, `IN_PROGRESS`, `SUBMITTED`,
`UNDER_REVIEW`, `ACCEPTED`, `REJECTED`, `OVERDUE`. This is a materially
richer tracking unit than a generic task and should not be modelled as one.

## 11. Vendor documents

Split `vendor_documents.category` into `LEGAL` (section 6) and
`OPERATIONAL` (proposals, quotations, reports, deliverable files, meeting
documents, presentations, invoices, statements, other project documents).
One table, one type field — do not build two document tables.

## 12. Communication and notes

Two separate threads, both scoped to a vendor:

```
Internal Notes         -> RUCHI employees only
Vendor Communication    -> can be shared with the external vendor
```

`vendor_notes`: vendor, author, content, created_at, `is_internal` boolean
distinguishing the two threads (or two tables if the schedule allows — a
single flagged table is simpler and matches the pattern already decided for
[unifying comments](p2_data_model.md#unifying-comments)).

This separation is a hard rule, not a UI toggle: internal notes must never
be reachable from the external vendor portal query path, regardless of the
`is_internal` flag's default.

## 13. Vendor performance

Lightweight, not a scoring engine. Compute from existing data rather than a
separately-entered metric wherever possible:

- Deliverables completed / overdue (from `vendor_deliverables`)
- On-time % (from `vendor_deliverables.submitted_date` vs `due_date`)
- Open assignments (from `vendor_assignments`)
- Failed/rejected deliverables
- Last review date, internal rating, remarks (from `vendor_reviews`, section
  14 — the rating is the average or latest of recorded reviews, not a
  free-standing field to keep in sync by hand)

**Internal RUCHI data only. Never exposed to the vendor**, same rule as
internal notes.

## 14. Vendor review

`vendor_reviews`: review date, reviewer, performance rating, quality,
timeliness, communication, reliability, remarks, action required. Rating
scale 1–5, kept simple by design — do not add a weighted composite formula
unless the client asks for one. Restricted to users with `VENDOR_ADMIN` or
`VENDOR_MANAGER` access (section 4).

## 15. Vendor status

`vendor_status_enum`: `PROSPECT`, `ACTIVE`, `ON_HOLD`, `EXPIRED`,
`TERMINATED`. Never hard-delete a vendor with historical assignments or
documents — status carries the lifecycle instead.

## 16. Vendor overview page

The vendor profile screen, single page, sections in order: header (name,
category, status, owner, department, current contract dates) — overview
counts (active assignments, completed, overdue, upcoming deadlines) —
contract (current expiry) — documents (count, count expiring soon) —
current work (active assignments/projects with progress) — performance
(on-time %, rating) — then tabs: Assignments, Projects, Deliverables,
Documents, Contracts, Activity, Reviews.

## 17. Vendor directory

Main Vendor Management list screen. Search plus filters: status (All /
Active / On Hold / Expired), category, department, internal owner, contract
expiry range. Row/card fields: vendor, category, owner, active work count,
next deadline, contract expiry, status.

## 18. External vendor portal — kept separate

The existing architecture (vendor as `role_enum.VENDOR`, login via the
normal auth flow, `vendor_assignments` as the sole allowlist) remains, but
it is explicitly secondary to and separate from internal Vendor Management:

```
RUCHI Internal Vendor Management
  MD / EA / Authorized Employees -> Vendor Management -> full internal data

External Vendor Portal
  Vendor -> only explicitly assigned -> tasks, projects, messages, deliverables
```

The vendor must never see: contracts, internal notes, internal ratings,
employee data, other vendors, company analytics, internal documents, vendor
performance, or assignments unrelated to them. The strict allowlist approach
below (`RolesGuard` + service-level scope check) is what enforces that.

### The trust boundary

`RolesGuard` checks that `user.role` is in the `@Roles(...)` list. It knows
nothing about assignments. Adding `role_enum.VENDOR` to a decorator opens
that endpoint to every vendor, for every record it can return.

Every vendor-reachable endpoint therefore needs an explicit scope check in
the service. Write it once:

```ts
// vendor-scope.service.ts
async assertVendorAccess(
  vendorId: string,
  entityType: 'task' | 'project' | 'deliverable',
  entityId: string,
): Promise<void> {
  const row = await this.prisma.vendor_assignments.findUnique({
    where: {
      vendor_id_entity_type_entity_id: {
        vendor_id: vendorId, entity_type: entityType, entity_id: entityId,
      },
    },
  });
  if (!row) throw new ForbiddenException('Not assigned');
}

async vendorTaskFilter(vendorId: string): Promise<Prisma.tasksWhereInput> {
  const rows = await this.prisma.vendor_assignments.findMany({
    where: { vendor_id: vendorId, entity_type: 'task' },
    select: { entity_id: true },
  });
  return { id: { in: rows.map(r => r.entity_id) } };
}
```

Call `assertVendorAccess` at the top of every detail endpoint a vendor can
reach. Merge `vendorTaskFilter` into the `where` clause of every list
endpoint. There is no safe default here: an unfiltered list query that a
vendor can reach returns the whole company's tasks.

### Endpoints to audit

Adding `VENDOR` to any of these without a scope check is a data leak. Go
through the list deliberately:

| Endpoint | What a vendor must see |
| --- | --- |
| `GET /tasks` | only assigned tasks |
| `GET /tasks/:id` | only if assigned |
| `PATCH /tasks/:id/status` | only if assigned, and only certain transitions |
| `GET /projects` | only assigned projects |
| `GET /projects/:id` | only if assigned |
| `POST /projects/:id/messages` | only if assigned |
| `GET /vendor-deliverables/mine` | own deliverables only |
| `GET /users` | nothing, or only the assigning employee |
| `GET /users/assignable` | nothing |
| `GET /departments` | nothing |
| `GET /dashboard` | a vendor-specific payload, not the employee one |
| `GET /notifications` | own only, which it already is |

The safest approach for the dashboard is a separate endpoint,
`GET /vendor/dashboard`, rather than branching the existing one. Do the same
for list endpoints if the schedule allows: a `/vendor/tasks` namespace with
its own controller is harder to leak from than a shared controller with a
role branch inside.

Task lifecycle transitions available to a vendor stay limited to `ACCEPTED`,
`IN_PROGRESS`, `COMPLETED`, and `REJECT` with a reason. They may not review,
close, or return work. Add `role_enum.VENDOR` to exactly those four rows of
`TRANSITIONS` in `task-lifecycle.service.ts` and no others. See
[Tasks](p1_tasks.md#the-state-machine).

### What a vendor cannot reach, by construction

The table above is the allowlist. This is the other half: endpoints that must
never list `VENDOR` in their `@Roles`, no matter what a future ticket asks for.
Not by convention, by construction.

Everything under `/hod-score`, `/scoring`, `/leave`, `/holidays`, `/assets`,
`/rnd`, `/polls`, `/incentives`, `/transfers`, `/vms`, and `/users` except a
narrowly scoped lookup of the people they are working with.

Plus every route in this module's own internal half:

| Route | Why a vendor must never reach it |
| --- | --- |
| `/vendors`, `/vendors/:id` | the vendor master, including every other vendor |
| `/vendors/:id/deadlines` | internal deadline tracking across contracts |
| `/vendor-contracts/*` | commercial terms |
| `/vendor-documents/*` | legal and operational documents, both categories |
| `/vendor-notes/*` | internal notes, see section 12 |
| `/vendor-reviews/*` | internal ratings, see section 14 |
| `/vendor-categories/*` | internal taxonomy |
| `/vendor-access/*` | who inside RUCHI can see any of the above |

A vendor's own view of its work comes from the portal routes only:
`GET /vendor/dashboard`, `/vendor/tasks`, `/vendor/projects`, and
`GET /vendor-deliverables/mine`. If a vendor needs to see something new,
add it to that namespace. Do not open an internal route with a role branch.

### Account creation

Vendors do not self-register. `POST /auth/register` writes to
`registration_requests` and the approval flow assumes an internal employee
with a department.

Create a portal login through the admin user endpoint:
`POST /users` with `role: VENDOR`, `vendor_id` set (FK to the `vendors`
row), and `department_id` null. The account gets `must_change_password:
true` and the credentials are handed over out of band. A `vendors` row can
exist with no portal user at all — most vendors will not need one.

Also: `GET /auth/departments`, `check-md`, `check-ea`, `check-pa`, and
`check-hod/:departmentId` are all `@Public()` and disclose organisational
structure. That was an acceptable tradeoff when every user was an employee
on the corporate network. With external accounts in the system it is worth
revisiting, though these endpoints are public regardless of login so the
vendor role does not change the exposure.

## 19. Two concepts, kept apart

| Question | Controlled by |
| --- | --- |
| Who inside RUCHI can manage vendors? | `vendor_dashboard_access`, granted by MD/EA |
| Which vendor is working on what? | `vendor_assignments`, set by any authorized RUCHI employee |
| Can the external vendor log in? | `users.vendor_id` + `role: VENDOR`, created by admin |

These must not collapse into the same permission check anywhere in the
codebase.

## 20. Module structure

```
VENDOR MANAGEMENT
  Dashboard
  Vendors
    Vendor Directory
    Create Vendor
    Vendor Profile
  Assignments (Active / Completed / Overdue)
  Projects
  Deliverables
  Contracts
  Documents
  Deadlines
  Reviews
  Access Management (MD / EA controlled)
```

## 21. Endpoints

Two namespaces, and they never share a controller. `VM` below means a caller
holding a `vendor_dashboard_access` row, or MD/EA who hold it implicitly.
`VENDOR_VIEWER` is read-only, `VENDOR_MANAGER` adds write, `VENDOR_ADMIN` adds
reviews and deletion.

Internal. No `VENDOR` on any row here:

| Method | Path | Who |
| --- | --- | --- |
| GET | `/vendors` | VM, any level |
| POST | `/vendors` | VM manager or admin |
| GET | `/vendors/:id` | VM, any level |
| PATCH | `/vendors/:id` | VM manager or admin, or the vendor's internal owner |
| PATCH | `/vendors/:id/status` | VM manager or admin. No hard delete, ever |
| GET | `/vendors/:id/deadlines` | VM, any level |
| GET | `/vendors/:id/performance` | VM, any level |
| GET | `/vendors/pickable` | any internal role. id, name, category, `ACTIVE` only |
| GET/POST | `/vendor-categories` | GET any VM, POST HR/EA/MD |
| GET/POST | `/vendor-assignments` | VM manager or admin |
| PATCH/DELETE | `/vendor-assignments/:id` | VM manager or admin, or the assigner |
| GET/POST | `/vendor-contracts` | VM manager or admin |
| PATCH | `/vendor-contracts/:id` | VM manager or admin |
| GET/POST | `/vendor-documents` | VM manager or admin |
| DELETE | `/vendor-documents/:id` | VM admin |
| GET/POST | `/vendor-deliverables` | VM manager or admin |
| PATCH | `/vendor-deliverables/:id` | VM manager or admin, or the deliverable owner |
| GET/POST | `/vendor-notes` | VM, any level. `is_internal` never exposed outward |
| GET/POST | `/vendor-reviews` | VM admin or manager only, per section 14 |
| GET | `/vendor-access` | MD, EA |
| POST | `/vendor-access` | MD, EA only. Grants a level to one employee |
| DELETE | `/vendor-access/:userId` | MD, EA only |

External portal. `VENDOR` only, every one scoped through `vendor_assignments`:

| Method | Path | Who |
| --- | --- | --- |
| GET | `/vendor/dashboard` | VENDOR, own assignments only |
| GET | `/vendor/tasks` | VENDOR, filtered by `vendorTaskFilter` |
| GET | `/vendor/projects` | VENDOR, assigned projects only |
| GET | `/vendor-deliverables/mine` | VENDOR, own deliverables only |
| PATCH | `/vendor-deliverables/:id/submit` | VENDOR, own only, sets `SUBMITTED` |

Declare `/vendors/pickable` before `/vendors/:id` in the controller. Nest
matches routes in declaration order, so the reverse binds `id: "pickable"` and
the picker returns a 404 that looks like a data problem for an afternoon.

`POST /vendor-access` is the one to write first and test hardest. Everything in
the internal table depends on it being right, and it is the only endpoint in the
module where a bug hands an employee the entire vendor book rather than one
record.

## Screens

**Vendor directory and profile.** Covered in sections 16 and 17. Internal only,
behind `vendor_dashboard_access`. Hide the whole Vendor Management nav item for
employees without a row rather than 403ing on click.

**Vendor portal dashboard.** Assigned tasks grouped by status, assigned
projects, own deliverables, and unread messages. Nothing else. No sidebar
items for modules a vendor cannot reach.

**Task detail for vendors.** The task, its description, attachments, the
message thread, and the status actions available to a vendor. No department, no
assignee history, no internal notes.

**Internal vendor picker.** An employee assigning work needs to pick a vendor,
and that is the one vendor read an employee without Vendor Management access
legitimately needs. It gets its own endpoint, `GET /vendors/pickable`, returning
id, name and category for `ACTIVE` vendors only. Do not solve this by opening
`GET /vendors` to all internal roles. The directory record carries the internal
owner, notes, performance and status history, none of which belongs in a
dropdown.

## Notifications

Vendors get notifications through the same engine. New types:

```
VENDOR_TASK_ASSIGNED      to the vendor
VENDOR_TASK_UPDATED       to the assigning employee
VENDOR_MESSAGE            to whichever side did not send it
VENDOR_CONTRACT_EXPIRING  to the internal owner and Vendor Management access holders
VENDOR_DOCUMENT_EXPIRING  to the internal owner and Vendor Management access holders
VENDOR_DELIVERABLE_DUE    to the internal owner
```

Email matters more for vendors than for employees, because a vendor will not
have the app open all day. Make sure the notification engine's email channel
is enabled for vendor notification types by default. See
[Notification engine](p2_notifications.md).

## Socket rooms

The gateway joins every connection to `role:<ROLE>`, so vendors would join
`role:VENDOR` and receive anything broadcast to that room. Nothing broadcasts
to role rooms today, but `broadcast()` sends to every connected socket
including vendors. Audit any use of `broadcast()` before this ships, and
tighten the gateway's `origin: '*'` CORS at the same time. See
[Known gaps](p1_known_gaps.md#socket-gateway-cors-is-wide-open).

## Testing this module

This is the one module in Phase 2 where "it works" is not enough. Before it
ships, verify by hand:

1. As an employee with no `vendor_dashboard_access` row, confirm Vendor
   Management endpoints 403.
2. Log in as a vendor portal user. Call `GET /tasks` and confirm the
   response contains only assigned tasks.
3. Take the id of a task the vendor is not assigned to and call
   `GET /tasks/:id`. Confirm 403.
4. Call `GET /users`, `GET /departments`, `GET /vendors`,
   `GET /vendor-notes` (internal), and `GET /leave/balance` as the vendor.
   Confirm 403 on all of them.
5. Revoke an assignment and confirm the task disappears from the vendor's
   list and the detail endpoint starts returning 403.

Write these down as a checklist in the pull request. There is no test suite
in this repository to catch a regression here later.
