# Tasks

Files: `server/src/modules/tasks/`. Three pieces matter:
`tasks.service.ts` holds the business logic, `task-lifecycle.service.ts` holds
the state machine, and `employee-sharing.controller.ts` handles the second kind
of task.

## The state machine

`TaskLifecycleService.validate()` is the only place a status change is
authorised. It takes the current status, the target status, the acting user, and
an optional reason, then looks for a matching entry in a `TRANSITIONS` table. If
none matches, the transition is rejected as invalid. If one matches but the
user's role is not in `allowedRoles`, it is rejected as forbidden. Some
transitions set `requiresReason: true` and reject when no reason is supplied.

Here is the table, transcribed from the code:

| From | To | Who may do it | Reason required |
| --- | --- | --- | --- |
| CREATED | ASSIGNED | MD, HOD, EA, PA, DEPT_CONTROLLER, PURCHASE_HEAD | no |
| CREATED, ASSIGNED | ACCEPTED | MD, EMPLOYEE, HOD, EA, PA, DEPT_CONTROLLER, VENDOR | no |
| ACCEPTED, CREATED, ASSIGNED | IN_PROGRESS | MD, EMPLOYEE, HOD, EA, PA, DEPT_CONTROLLER, VENDOR | no |
| IN_PROGRESS | COMPLETED | MD, EMPLOYEE, HOD, EA, PA, DEPT_CONTROLLER, VENDOR | no |
| COMPLETED | HOD_VERIFIED_PENDING | MD, EMPLOYEE, HOD, EA, PA, DEPT_CONTROLLER | no |
| HOD_VERIFIED_PENDING | HOD_VERIFIED | MD, HOD, EA, PA, DEPT_CONTROLLER, PURCHASE_HEAD | no |
| HOD_VERIFIED | REVIEWED | MD, HOD, EA, PA, DEPT_CONTROLLER, PURCHASE_HEAD | no |
| REVIEWED | CLOSED | MD, HOD, EA, PA, DEPT_CONTROLLER, PURCHASE_HEAD | no |
| CREATED, ASSIGNED, ACCEPTED, IN_PROGRESS | REJECTED | MD, EMPLOYEE, HOD, EA, PA, DEPT_CONTROLLER, VENDOR | yes |
| COMPLETED, HOD_VERIFIED_PENDING, HOD_VERIFIED, REVIEWED | IN_PROGRESS | MD, HOD, EA, PA, DEPT_CONTROLLER, PURCHASE_HEAD | yes |
| CLOSED | REJECTED | MD, HOD, EA, PA, DEPT_CONTROLLER, PURCHASE_HEAD | no |

The happy path reads:

```
CREATED -> ASSIGNED -> ACCEPTED -> IN_PROGRESS -> COMPLETED
        -> HOD_VERIFIED_PENDING -> HOD_VERIFIED -> REVIEWED -> CLOSED
```

Two escape hatches: reject with a reason from any early state, and send work
back to `IN_PROGRESS` with a reason from any of the four late states. The second
one is the "this is not good enough, do it again" path and it is the one
supervisors actually use.

`VENDOR` appears on exactly four rows: accept, start, complete, and reject with
a reason. It is absent from `HOD_VERIFIED_PENDING`, `HOD_VERIFIED`, `REVIEWED`,
`CLOSED`, and from the return-for-rework row, so an external vendor can move its
own work forward and refuse it, and can never review, close, or send work back.
The return row shares its target status with the vendor's "start work" row,
which makes it the one an over-eager edit would open by accident;
`vendor-scope.spec.ts` asserts it stays shut. Role is the outer fence only —
whether the vendor is assigned to the task at all is decided by
`VendorScopeService` before `validate()` runs. See
[Vendor management](p2_vendors.md#the-trust-boundary).

`PENDING` is in `task_status_enum` but appears nowhere in the transition table.
Nothing can enter or leave it through the lifecycle service. It is treated as a
pending state by the HOD scoring queries and by the `GET /tasks/pending`
listing, but no code path sets it. Treat it as legacy.

### Timestamp side effects

`tasks.service.ts` stamps a timestamp when certain transitions land, and the
mapping does not line up with the names:

```ts
case IN_PROGRESS: return { accepted_at: now };
case COMPLETED:   return { completed_at: now };
case REVIEWED:    return { completed_at: now };
case CLOSED:      return { reviewed_at: now };
case REJECTED:    return { closed_at: now };
```

Read that carefully. Entering `CLOSED` writes `reviewed_at`, entering `REVIEWED`
writes `completed_at`, and entering `REJECTED` writes `closed_at`. Each column is
one step behind its name.

This matters because the scoring service counts tasks by `completed_at` and
`reviewed_at`. A task that goes all the way to `CLOSED` has `completed_at`
written twice (once at COMPLETED, once at REVIEWED) and `reviewed_at` written at
CLOSED, so it is counted correctly by luck rather than by design. Do not
"fix" the naming without recalculating historical scores, and read
[Scoring](p1_scoring.md) before touching it.

## Naming collision in the enums directory

`modules/tasks/enums/task-status.enum.ts` defines a `TaskStatus` enum whose
member names do not match its values:

```ts
export enum TaskStatus {
  OPEN = 'CREATED',
  ONGOING = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  ABORTED = 'REJECTED',
  HOD_VERIFIED_PENDING = 'REVIEWED',
  HOD_VERIFIED = 'CLOSED',
}
```

This is a presentation-layer alias: the UI calls `CREATED` "Open" and `CLOSED`
"HOD Verified". It overlaps with the real Prisma values in a confusing way,
because `TaskStatus.HOD_VERIFIED_PENDING` is the string `'REVIEWED'` while
`task_status_enum.HOD_VERIFIED_PENDING` is the string `'HOD_VERIFIED_PENDING'`.

Always import `task_status_enum` from `@prisma/client` in service code. Only use
the local `TaskStatus` for display mapping, and preferably not at all.

## Task types

`OFFICIAL` is the normal case: a superior creates the task and assigns it down.
Handled by `tasks.controller.ts`.

`EMPLOYEE_SHARED` is a task an employee raised themselves and shared with
colleagues or other departments. Handled by `employee-sharing.controller.ts`
under `/tasks/employee-sharing`. Only an `EMPLOYEE` may create one. Deleting one
requires HOD, MD, or department controller.

## Endpoints

Creation and reading:

| Method | Path | Roles |
| --- | --- | --- |
| POST | `/tasks` | MD, HOD, EA, PA, DEPT_CONTROLLER, PURCHASE_HEAD |
| GET | `/tasks` | all work roles |
| GET | `/tasks/:id` | all work roles |
| GET | `/tasks/pending` | all work roles |
| GET | `/tasks/overdue` | MD, HOD, assistants, PURCHASE_HEAD |
| GET | `/tasks/delegated-out` | HOD |
| PATCH | `/tasks/:id` | MD, HOD, assistants, PURCHASE_HEAD |
| DELETE | `/tasks/:id` | MD, HOD, assistants, PURCHASE_HEAD |

Metadata for the create form:

| Method | Path | Roles |
| --- | --- | --- |
| GET | `/tasks/meta/departments` | MD, HOD, assistants, PURCHASE_HEAD |
| GET | `/tasks/meta/assignees` | MD, HOD, assistants, PURCHASE_HEAD |
| GET | `/tasks/meta/delegation-departments` | HOD |

Lifecycle transitions. Each is a thin wrapper that calls the lifecycle service
with a fixed target status:

| Method | Path | Target status |
| --- | --- | --- |
| PATCH | `/tasks/:id/accept` | ACCEPTED |
| PATCH | `/tasks/:id/reject` | REJECTED, reason required |
| PATCH | `/tasks/:id/progress` | IN_PROGRESS |
| PATCH | `/tasks/:id/complete` | COMPLETED |
| PATCH | `/tasks/:id/review` | REVIEWED |
| PATCH | `/tasks/:id/close` | CLOSED |
| PATCH | `/tasks/:id/return` | back to IN_PROGRESS, reason required |
| PATCH | `/tasks/:id/status` | arbitrary target, still validated |

`/tasks/:id/status` accepts any target and runs it through the same validator,
so it can do anything the named endpoints can. The named endpoints exist because
they read better on the client and because their `@Roles` lists are narrower.

Employee shared tasks:

| Method | Path | Roles |
| --- | --- | --- |
| POST | `/tasks/employee-sharing` | EMPLOYEE |
| GET | `/tasks/employee-sharing` | MD, HOD, EMPLOYEE, assistants, PURCHASE_HEAD |
| GET | `/tasks/employee-sharing/assignees` | MD, HOD, EMPLOYEE, assistants, PURCHASE_HEAD |
| GET | `/tasks/employee-sharing/departments` | EMPLOYEE |
| PATCH | `/tasks/employee-sharing/:id/status` | MD, HOD, EMPLOYEE, assistants, PURCHASE_HEAD |
| DELETE | `/tasks/employee-sharing/:id` | HOD, MD, DEPT_CONTROLLER |

Comments live under two controllers. `/comments` is the flat CRUD interface and
`/tasks/:taskId/comments` is the nested read and create. Both write to
`task_comments`.

## Deletion

Tasks are soft deleted. `deleted_at`, `deleted_by_id`, and `delete_reason` are
set and the row stays. Every listing query filters `deleted_at: null`, and the
composite indexes on `tasks` are all built with `deleted_at` in them for exactly
this reason. If you write a new task query, include the filter or you will
resurrect deleted work in someone's dashboard.

## Notifications

`tasks.service.ts` calls `sendTransitionNotification()` after a successful
status change. It works out who should hear about it (the assignee, the
assigner, or both) and writes a `notifications` row plus a socket emit. The
`notification_type_enum` values used here are `TASK_ASSIGNED`, `TASK_ACCEPTED`,
`TASK_REJECTED`, `TASK_COMPLETED`, `REVIEW_REQUESTED`, and `REMARKS_ADDED`.

## Adding a transition

If Phase 2 needs a new status or a new path:

1. Add the value to `task_status_enum` in `schema.prisma` and push it.
2. Add rows to `TRANSITIONS` in `task-lifecycle.service.ts` for every legal
   entry into and exit from the new state. A state with no exit transition
   traps the task.
3. Decide whether a timestamp should be stamped, and add it to the switch in
   `tasks.service.ts`. Match the column to the name this time.
4. Check the scoring queries in `scoring.service.ts` and
   `hod-score.service.ts`. Both hardcode lists of statuses that count as
   completed or pending, and a new status is invisible to scoring until it is
   added to those lists.
5. Add a notification type if the transition should tell someone.
