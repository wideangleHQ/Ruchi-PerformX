# Vendor management

Brings regular external suppliers, the web development team and the digital
media team, into PerformX as their own user type instead of managing them over
email and WhatsApp.

This is the highest risk module in Phase 2 because it is the first time an
external party gets a login. Everything else in this repository assumes the
person holding a valid JWT is an employee. Read
[Auth and roles](p1_auth_and_roles.md#how-authorization-is-enforced) before you
write the first endpoint.

## Decisions already made

**A vendor is a role, not a separate application.** Add `VENDOR` to `role_enum`.
Same database, same deploy, same login screen.

**A vendor sees only what is explicitly assigned to them.** Not their department,
not their company, not anything by default. The `vendor_assignments` table is
an allowlist and it is the only thing that grants visibility.

**Vendors never see internal company data.** No dashboard analytics, no scoring,
no polls, no birthdays, no leave, no company assets, no other vendors, no
employee directory beyond the people they are working with.

## Tables

`vendor_assignments`, plus `users.vendor_company` for the company name. See
[Schema changes](p2_data_model.md#vendors).

```prisma
model vendor_assignments {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  vendor_id      String   @db.Uuid
  entity_type    String   @db.VarChar(20)   // 'task', 'project'
  entity_id      String   @db.Uuid
  assigned_by_id String   @db.Uuid
  created_at     DateTime @default(now()) @db.Timestamptz(6)

  @@unique([vendor_id, entity_type, entity_id])
  @@index([vendor_id])
  @@index([entity_type, entity_id])
}
```

A row is created when an internal user assigns a task or adds a vendor to a
project. It is deleted when the assignment is revoked. There is no other path to
vendor visibility.

## The trust boundary

`RolesGuard` checks that `user.role` is in the `@Roles(...)` list. It knows
nothing about assignments. Adding `role_enum.VENDOR` to a decorator opens that
endpoint to every vendor, for every record it can return.

Every vendor-reachable endpoint therefore needs an explicit scope check in the
service. Write it once:

```ts
// vendor-scope.service.ts
async assertVendorAccess(
  vendorId: string,
  entityType: 'task' | 'project',
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
reach. Merge `vendorTaskFilter` into the `where` clause of every list endpoint.
There is no safe default here: an unfiltered list query that a vendor can reach
returns the whole company's tasks.

### Endpoints to audit

Adding `VENDOR` to any of these without a scope check is a data leak. Go through
the list deliberately:

| Endpoint | What a vendor must see |
| --- | --- |
| `GET /tasks` | only assigned tasks |
| `GET /tasks/:id` | only if assigned |
| `PATCH /tasks/:id/status` | only if assigned, and only certain transitions |
| `GET /projects` | only assigned projects |
| `GET /projects/:id` | only if assigned |
| `POST /projects/:id/messages` | only if assigned |
| `GET /users` | nothing, or only the assigning employee |
| `GET /users/assignable` | nothing |
| `GET /departments` | nothing |
| `GET /dashboard` | a vendor-specific payload, not the employee one |
| `GET /notifications` | own only, which it already is |

The safest approach for the dashboard is a separate endpoint,
`GET /vendor/dashboard`, rather than branching the existing one. The existing
dashboard service aggregates across scores, incentives, and department
statistics; adding a vendor branch to it invites a future edit that leaks by
accident.

Do the same for the list endpoints if the schedule allows: a `/vendor/tasks`
namespace with its own controller is harder to leak from than a shared
controller with a role branch inside.

## What a vendor can do

Per the scope document:

- Log in and see a dashboard of tasks and requests assigned to them
- Receive task and complaint assignments raised by internal employees
- Update the status of assigned tasks
- Communicate through a messaging thread on the task or project
- Mark a task complete, which notifies the assigning employee

Task lifecycle transitions available to a vendor should be limited. A vendor may
move a task to `ACCEPTED`, `IN_PROGRESS`, and `COMPLETED`, and may `REJECT` with
a reason. They may not review, close, or return work. Add
`role_enum.VENDOR` to exactly those four rows of `TRANSITIONS` in
`task-lifecycle.service.ts` and no others. See [Tasks](p1_tasks.md#the-state-machine).

## What a vendor cannot do

Not by convention, by construction. These endpoints must not list `VENDOR` in
their `@Roles`:

Everything under `/hod-score`, `/scoring`, `/leave`, `/assets`, `/rnd`,
`/polls`, `/holidays`, `/incentives`, `/transfers`, `/vms`, and `/users`
except a narrowly scoped lookup of the people they are working with.

## Account creation

Vendors do not self-register. `POST /auth/register` writes to
`registration_requests` and the approval flow assumes an internal employee with
a department.

Create vendor accounts through the admin user endpoint instead:
`POST /users` with `role: VENDOR`, `vendor_company` set, and `department_id`
null. The account gets `must_change_password: true` and the credentials are
handed over out of band.

Also: `GET /auth/departments`, `check-md`, `check-ea`, `check-pa`, and
`check-hod/:departmentId` are all `@Public()` and disclose organisational
structure. That was an acceptable tradeoff when every user was an employee on
the corporate network. With external accounts in the system it is worth
revisiting, though these endpoints are public regardless of login so the vendor
role does not change the exposure.

## Notifications

Vendors get notifications through the same engine. New types:

```
VENDOR_TASK_ASSIGNED     to the vendor
VENDOR_TASK_UPDATED      to the assigning employee
VENDOR_MESSAGE           to whichever side did not send it
```

Email matters more for vendors than for employees, because a vendor will not
have the app open all day. Make sure the notification engine's email channel is
enabled for vendor notification types by default. See
[Notification engine](p2_notifications.md).

## Socket rooms

The gateway joins every connection to `role:<ROLE>`, so vendors would join
`role:VENDOR` and receive anything broadcast to that room. Nothing broadcasts to
role rooms today, but `broadcast()` sends to every connected socket including
vendors. Audit any use of `broadcast()` before this ships, and tighten the
gateway's `origin: '*'` CORS at the same time. See
[Known gaps](p1_known_gaps.md#socket-gateway-cors-is-wide-open).

## Screens

**Vendor dashboard.** Assigned tasks grouped by status, assigned projects, and
unread messages. Nothing else. No sidebar items for modules a vendor cannot
reach; hide them rather than 403ing on click.

**Task detail for vendors.** The task, its description, attachments, the message
thread, and the status actions available to a vendor. No department, no
assignee history, no internal comments if the client wants an internal-only
comment mode.

Internal-only comments are not in the scope document. If the client asks for
them later it is a boolean on the comment row plus a filter, which is why
[unifying the comment tables](p2_data_model.md#unifying-comments) before this
module is worth the time.

**Internal view of vendors.** An employee assigning work needs a vendor picker.
`GET /users?role=VENDOR` scoped so that only internal roles can call it.

## Testing this module

This is the one module in Phase 2 where "it works" is not enough. Before it
ships, verify by hand with a real vendor account:

1. Log in as a vendor. Call `GET /tasks` and confirm the response contains only
   assigned tasks.
2. Take the id of a task the vendor is not assigned to and call
   `GET /tasks/:id`. Confirm 403.
3. Call `GET /users`, `GET /departments`, `GET /hod-score/company`,
   `GET /polls/active`, and `GET /leave/balance`. Confirm 403 on all of them.
4. Revoke an assignment and confirm the task disappears from the list and the
   detail endpoint starts returning 403.

Write these down as a checklist in the pull request. There is no test suite in
this repository to catch a regression here later.
